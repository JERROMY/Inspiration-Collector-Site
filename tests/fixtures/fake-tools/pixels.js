// 4-b6：用程式組出「真的解得開」的 PNG 與 JPEG（不是測試；專案裡不放二進位檔，要用的時候現組）。
//
// 跟同資料夾的 images.js 不一樣：那支只組到檔頭（讀寬高用），畫面解不出來；這支組的是 cwebp 真的讀得進去、轉得出來的圖。
//
// pngImage(width, height, { seed })   RGB 8 位元的 PNG：橫向漸層＋一點雜點（seed 決定雜點，seed 不同位元組就不同），
//                                      用 node:zlib 壓 IDAT、CRC 算對。漸層加雜點是刻意的：純色太好壓，量不出「縮小之後有沒有變小」。
// jpegImage(width, height, { gray })   灰階 baseline JPEG，整張同一個灰（gray 0～255，預設 200）。
//                                      自己寫的最小編碼器：量化表全 1、霍夫曼表只放用得到的符號（DC 兩個、AC 只有 EOB），
//                                      每個 8×8 區塊只有 DC 係數 —— 第一塊寫差值，其餘差值 0。寬高不必是 8 的倍數。
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
}

export function pngImage(width, height, { seed = 1 } = {}) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // 位元深度
    ihdr[9] = 2;   // RGB
    const stride = width * 3 + 1;
    const raw = Buffer.alloc(stride * height);
    let state = seed >>> 0 || 1;
    for (let y = 0; y < height; y++) {
        raw[y * stride] = 0;   // 不用濾波
        for (let x = 0; x < width; x++) {
            if (x % 8 === 0) state = (state * 1103515245 + 12345 + (y >> 3)) >>> 0;   // 雜點以 8×1 為一格：PNG 不會大到不像話，又不是純色
            const noise = (state >>> 24) & 0x07;
            const i = y * stride + 1 + x * 3;
            raw[i] = (Math.floor((x * 255) / Math.max(1, width - 1)) + noise) & 0xff;
            raw[i + 1] = (Math.floor((y * 255) / Math.max(1, height - 1)) + noise) & 0xff;
            raw[i + 2] = 96 + noise;
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

function segment(marker, payload) {
    const head = Buffer.alloc(4);
    head[0] = 0xff;
    head[1] = marker;
    head.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([head, payload]);
}

// 霍夫曼表：符號都用長度 2 的碼（00、01、…），避開「全 1 的碼」
function dht(tableClassId, symbols) {
    const counts = Buffer.alloc(16);
    counts[1] = symbols.length;   // 長度 2 的碼有幾個
    return segment(0xc4, Buffer.concat([Buffer.from([tableClassId]), counts, Buffer.from(symbols)]));
}

export function jpegImage(width, height, { gray = 200 } = {}) {
    const dc = (gray - 128) * 8;   // 整塊同一個值：DC 係數＝8 ×（值−128），量化表是 1
    const magnitude = Math.abs(dc);
    const category = magnitude === 0 ? 0 : Math.floor(Math.log2(magnitude)) + 1;
    const dcSymbols = category === 0 ? [0] : [0, category];
    const dcCode = (cat) => dcSymbols.indexOf(cat);   // 長度 2 的碼：第幾個符號就是幾
    const blocks = Math.ceil(width / 8) * Math.ceil(height / 8);

    const bits = [];
    const put = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    for (let b = 0; b < blocks; b++) {
        if (b === 0 && category > 0) {
            put(dcCode(category), 2);
            put(dc > 0 ? dc : dc + (1 << category) - 1, category);
        } else {
            put(dcCode(0), 2);
        }
        put(0, 2);   // AC：EOB（AC 表只有這一個符號，碼是 00）
    }
    while (bits.length % 8) bits.push(1);
    const scan = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let k = 0; k < 8; k++) byte = (byte << 1) | bits[i + k];
        scan.push(byte);
        if (byte === 0xff) scan.push(0x00);
    }

    const sof = Buffer.alloc(9);
    sof[0] = 8;
    sof.writeUInt16BE(height, 1);
    sof.writeUInt16BE(width, 3);
    sof[5] = 1;      // 一個分量（灰階）
    sof[6] = 1;      // 分量 id
    sof[7] = 0x11;   // 取樣 1×1
    sof[8] = 0;      // 量化表 0
    return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        segment(0xdb, Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)])),
        segment(0xc0, sof),
        dht(0x00, dcSymbols),
        dht(0x10, [0x00]),
        segment(0xda, Buffer.from([1, 1, 0x00, 0, 63, 0])),
        Buffer.from(scan),
        Buffer.from([0xff, 0xd9]),
    ]);
}
