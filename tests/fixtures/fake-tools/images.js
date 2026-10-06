// 用程式組出小的 PNG／WebP 位元組（4-b3）。不是測試；專案裡不放二進位檔，要用的時候現組。
//
// 只組到「讀寬高」用得到的那一段：檔頭與第一個（或前兩個）chunk 照規格寫，CRC 是算對的；
// 圖片內容（IDAT、VP8 的壓縮資料）是填充用的位元組，解不出畫面 —— readImageSize 只讀檔頭，不解碼。
//
// png(width, height, { size })                  PNG：簽章＋IHDR（寬高是 32 位元大端）＋填充的 IDAT＋IEND；size 給了就補到剛好那麼大
// webpLossy(width, height, { hscale, vscale, size })   WebP 有損（'VP8 '）：寬高各 14 位元，上面 2 位元是縮放旗標（hscale／vscale，0～3）
// webpLossless(width, height, { size })         WebP 無損（'VP8L'）：簽章 0x2f 後 32 位元小端，寬-1（14 位元）、高-1（14 位元）、alpha、版本
// webpExtended(width, height, { size })         WebP 擴充（'VP8X'）：畫布寬-1、高-1 各 24 位元小端（可以超過 16383）；後面接一個 ICCP chunk
//
// 假的 cwebp（同資料夾的 cwebp.mjs）也用這支組出它的輸出。
import { Buffer } from 'node:buffer';

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

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function png(width, height, { size } = {}) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // 位元深度
    ihdr[9] = 6;   // RGBA
    const head = Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr)]);
    const end = pngChunk('IEND', Buffer.alloc(0));
    const fixed = head.length + end.length + 12;   // IDAT 的長度、型別、CRC
    const fill = size === undefined ? 16 : size - fixed;
    if (fill < 0) throw new Error(`測試自己寫錯：PNG 至少 ${fixed} 位元組，要 ${size}`);
    const idat = Buffer.alloc(fill, 0x5a);
    return Buffer.concat([head, pngChunk('IDAT', idat), end]);
}

function riffChunk(fourcc, payload) {
    const head = Buffer.alloc(8);
    head.write(fourcc, 0, 'latin1');
    head.writeUInt32LE(payload.length, 4);
    return Buffer.concat([head, payload, payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function riff(chunks) {
    const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]);
    const head = Buffer.alloc(8);
    head.write('RIFF', 0, 'latin1');
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
}

// size 給了就把最後一個 chunk 的填充補到整檔剛好 size 位元組（偶數長度才不會多一個補齊位元組）
function padded(build, size) {
    const bare = build(0);
    if (size === undefined) return build(16);
    const fill = size - bare.length;
    if (fill < 0 || fill % 2) throw new Error(`測試自己寫錯：WebP 的 size 要 ≥ ${bare.length} 且跟它同奇偶，得到 ${size}`);
    return build(fill);
}

export function webpLossy(width, height, { hscale = 0, vscale = 0, size } = {}) {
    return padded((fill) => {
        const payload = Buffer.alloc(10 + fill, 0x33);
        payload[0] = 0x10; payload[1] = 0x00; payload[2] = 0x00;   // 關鍵影格、要顯示
        payload[3] = 0x9d; payload[4] = 0x01; payload[5] = 0x2a;   // 起始碼
        payload.writeUInt16LE((width & 0x3fff) | (hscale << 14), 6);
        payload.writeUInt16LE((height & 0x3fff) | (vscale << 14), 8);
        return riff([riffChunk('VP8 ', payload)]);
    }, size);
}

export function webpLossless(width, height, { size } = {}) {
    return padded((fill) => {
        const payload = Buffer.alloc(5 + fill, 0x44);
        payload[0] = 0x2f;
        const bits = ((width - 1) | ((height - 1) << 14) | (1 << 28)) >>> 0;   // alpha 開著、版本 0
        payload.writeUInt32LE(bits, 1);
        return riff([riffChunk('VP8L', payload)]);
    }, size);
}

export function webpExtended(width, height, { size } = {}) {
    return padded((fill) => {
        const payload = Buffer.alloc(10);
        payload[0] = 0x20;   // ICC 旗標
        payload.writeUIntLE(width - 1, 4, 3);
        payload.writeUIntLE(height - 1, 7, 3);
        return riff([riffChunk('VP8X', payload), riffChunk('ICCP', Buffer.alloc(fill + 2, 0x55))]);
    }, size);
}
