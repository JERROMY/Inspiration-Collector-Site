/**
 * woff2-cmap.js —— 讀 WOFF2 字型檔的 cmap：這個字型裡有哪些字。
 *
 * 純函式，不讀檔、不叫外部程式（沒有 python 的電腦也能跑 `npm run fonts:budget`）。只用 Node 內建的 node:zlib 解 brotli。
 *
 * 做法：WOFF2 檔頭 48 位元組，後面是表目錄（每張表一筆：旗標、長度；長度用 UIntBase128 這種變長整數寫），
 * 再後面是一整塊用 brotli 壓過的表資料，各表照表目錄的順序接在一起。cmap 從來不被轉換，所以它的位置就是
 * 前面每張表「在壓縮資料裡的長度」加起來 —— glyf、loca（轉換版本 0）與 hmtx（轉換版本 1）是轉換過的，壓縮資料裡放的是 transformLength，
 * 其他表放的是 origLength。
 */
import zlib from 'node:zlib';

const HEADER_SIZE = 48;
const KNOWN_TAGS = [
    'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
    'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
    'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
    'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];
const ARBITRARY_TAG = 63;
const MAX_CODE_POINT = 0x10ffff;

/**
 * 讀表目錄裡的一個 UIntBase128（每個位元組用低 7 位，最高位是 1 表示後面還有；最多 5 個位元組）。
 *
 * @param {Buffer} buffer 檔案位元組
 * @param {number} at 從哪個位置開始讀
 * @returns {{ value: number, next: number }} 讀到的數字與下一個位置
 * @throws {Error} 檔案不夠長、前面多了沒用的 0x80、超過 32 位元
 */
function readBase128(buffer, at) {
    let value = 0;
    for (let i = 0; i < 5; i++) {
        if (at + i >= buffer.length) throw new Error('WOFF2 的表目錄被截斷');
        const byte = buffer[at + i];
        if (i === 0 && byte === 0x80) throw new Error('WOFF2 的表目錄寫壞了（長度的開頭不能是 0x80）');
        if (value > 0x1ffffff) throw new Error('WOFF2 的表目錄寫壞了（長度超過 32 位元）');
        value = value * 128 + (byte & 0x7f);
        if ((byte & 0x80) === 0) return { value, next: at + i + 1 };
    }
    throw new Error('WOFF2 的表目錄寫壞了（長度超過 5 個位元組）');
}

/**
 * 讀表目錄：每張表的標籤，與它在解壓縮後的資料裡佔多長。
 *
 * @param {Buffer} buffer 整個 WOFF2 檔
 * @returns {{ tables: { tag: string, size: number }[], dataStart: number, compressedSize: number }}
 *   size 是這張表在壓縮資料裡的長度；dataStart 是壓縮資料在檔案裡的起點
 * @throws {Error} 不是 WOFF2、被截斷、表目錄寫壞了
 */
function readDirectory(buffer) {
    if (buffer.length < 4 || buffer.toString('latin1', 0, 4) !== 'wOF2') throw new Error('不是 WOFF2（檔頭不是 wOF2）');
    if (buffer.length < HEADER_SIZE) throw new Error(`WOFF2 被截斷：只有 ${buffer.length} 位元組，連檔頭（${HEADER_SIZE} 位元組）都不夠`);
    const numTables = buffer.readUInt16BE(12);
    const compressedSize = buffer.readUInt32BE(20);
    if (numTables === 0) throw new Error('WOFF2 裡一張表都沒有');
    const tables = [];
    let at = HEADER_SIZE;
    for (let i = 0; i < numTables; i++) {
        if (at >= buffer.length) throw new Error('WOFF2 的表目錄被截斷');
        const flags = buffer[at++];
        const index = flags & 0x3f;
        const version = flags >> 6;
        let tag;
        if (index === ARBITRARY_TAG) {
            if (at + 4 > buffer.length) throw new Error('WOFF2 的表目錄被截斷');
            tag = buffer.toString('latin1', at, at + 4);
            at += 4;
        } else {
            tag = KNOWN_TAGS[index];
        }
        const orig = readBase128(buffer, at);
        at = orig.next;
        // glyf、loca：版本 0 是轉換過的（3 才是沒轉換）；hmtx：版本 1 是轉換過的；其他表從不轉換
        const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : tag === 'hmtx' ? version === 1 : false;
        let size = orig.value;
        if (transformed) {
            const transform = readBase128(buffer, at);
            at = transform.next;
            size = transform.value;
        }
        tables.push({ tag, size });
    }
    return { tables, dataStart: at, compressedSize };
}

/**
 * 解壓縮表資料，回傳 cmap 那張表。
 *
 * @param {Buffer} buffer 整個 WOFF2 檔
 * @returns {Buffer} cmap 表的位元組
 * @throws {Error} 不是 WOFF2、被截斷、brotli 解不開、沒有 cmap、cmap 超出資料範圍
 */
function readCmapTable(buffer) {
    const { tables, dataStart, compressedSize } = readDirectory(buffer);
    if (compressedSize === 0 || dataStart + compressedSize > buffer.length) {
        throw new Error(`WOFF2 被截斷：壓縮資料要 ${compressedSize} 位元組，檔案只剩 ${Math.max(0, buffer.length - dataStart)}`);
    }
    let data;
    try {
        data = zlib.brotliDecompressSync(buffer.subarray(dataStart, dataStart + compressedSize));
    } catch (err) {
        throw new Error(`WOFF2 的壓縮資料解不開（brotli）：${err.message}`, { cause: err });
    }
    let at = 0;
    for (const table of tables) {
        if (table.tag === 'cmap') {
            if (at + table.size > data.length) throw new Error('WOFF2 的 cmap 超出解壓縮後的資料範圍（檔案壞了）');
            return data.subarray(at, at + table.size);
        }
        at += table.size;
    }
    throw new Error('這個字型沒有 cmap 表');
}

/**
 * @param {Buffer} table cmap 表
 * @param {number} start 子表（format 4）在 cmap 表裡的位置
 * @param {Set<number>} found 把讀到的碼位加進這裡
 * @throws {Error} 子表超出 cmap 表的範圍
 */
function readFormat4(table, start, found) {
    if (start + 14 > table.length) throw new Error('cmap 的 format 4 子表被截斷');
    const segCount = table.readUInt16BE(start + 6) / 2;
    const ends = start + 14;
    const starts = ends + segCount * 2 + 2;
    const deltas = starts + segCount * 2;
    const rangeOffsets = deltas + segCount * 2;
    if (rangeOffsets + segCount * 2 > table.length) throw new Error('cmap 的 format 4 子表被截斷');
    for (let i = 0; i < segCount; i++) {
        const end = table.readUInt16BE(ends + i * 2);
        const first = table.readUInt16BE(starts + i * 2);
        const delta = table.readUInt16BE(deltas + i * 2);
        const rangeOffset = table.readUInt16BE(rangeOffsets + i * 2);
        for (let code = first; code <= end; code++) {
            let glyph;
            if (rangeOffset === 0) {
                glyph = (code + delta) & 0xffff;
            } else {
                const at = rangeOffsets + i * 2 + rangeOffset + (code - first) * 2;
                if (at + 2 > table.length) throw new Error('cmap 的 format 4 子表指到範圍外面（檔案壞了）');
                glyph = table.readUInt16BE(at);
                if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
            }
            if (glyph !== 0) found.add(code);
        }
    }
}

/**
 * @param {Buffer} table cmap 表
 * @param {number} start 子表（format 12）在 cmap 表裡的位置
 * @param {Set<number>} found 把讀到的碼位加進這裡
 * @throws {Error} 子表超出 cmap 表的範圍、碼位不合理
 */
function readFormat12(table, start, found) {
    if (start + 16 > table.length) throw new Error('cmap 的 format 12 子表被截斷');
    const groups = table.readUInt32BE(start + 12);
    if (start + 16 + groups * 12 > table.length) throw new Error('cmap 的 format 12 子表被截斷');
    for (let i = 0; i < groups; i++) {
        const at = start + 16 + i * 12;
        const first = table.readUInt32BE(at);
        const end = table.readUInt32BE(at + 4);
        const glyph = table.readUInt32BE(at + 8);
        if (first > end || end > MAX_CODE_POINT) throw new Error(`cmap 的 format 12 有不合理的碼位範圍 ${first}～${end}`);
        for (let code = first; code <= end; code++) {
            if (glyph + (code - first) !== 0) found.add(code);
        }
    }
}

/**
 * 讀 WOFF2 的 cmap，回傳字型裡有對應字形的碼位。
 * 認 platform 0（Unicode）、platform 3 encoding 1 與 10 的子表，格式 4 與 12（其他格式略過），全部合起來；對到 glyph 0（.notdef）的不算。
 *
 * @param {Buffer} buffer 整個 WOFF2 檔（檔尾有 private data 也行）
 * @returns {number[]} 碼位，不重複、由小到大；一個字都沒有就是空陣列
 * @throws {TypeError} buffer 不是 Buffer
 * @throws {Error} 不是 WOFF2（wOFF、OTTO、純文字、空的）、被截斷、brotli 解不開、沒有 cmap、cmap 寫壞了；不回傳讀到一半的結果
 */
export function woff2CodePoints(buffer) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError(`woff2CodePoints 只收 Buffer，收到 ${typeof buffer}`);
    const table = readCmapTable(buffer);
    if (table.length < 4) throw new Error('cmap 表被截斷');
    const found = new Set();
    const subtables = table.readUInt16BE(2);
    if (4 + subtables * 8 > table.length) throw new Error('cmap 的子表目錄被截斷');
    for (let i = 0; i < subtables; i++) {
        const platform = table.readUInt16BE(4 + i * 8);
        const encoding = table.readUInt16BE(6 + i * 8);
        const start = table.readUInt32BE(8 + i * 8);
        const wanted = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
        if (!wanted) continue;
        if (start + 2 > table.length) throw new Error('cmap 的子表位置超出範圍（檔案壞了）');
        const format = table.readUInt16BE(start);
        if (format === 4) readFormat4(table, start, found);
        else if (format === 12) readFormat12(table, start, found);
    }
    return [...found].sort((a, b) => a - b);
}
