// 4-b13（07 大綱圖裁切、補 1920 寬）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。介面細則見 tests/README.md「4-b13」。
//
// patternPng(w, h)        RGB 8 位元的 PNG，每個像素 pixelAt(x, y) ＝ [x*7 % 256, y*13 % 256, (x*3 + y*5) % 256]：x、y 對調的話顏色不同（量得出框的 x、y 有沒有對調）
// pixelAt(x, y)           上面那個公式
// decodeWebp(file)        用 dwebp 把 WebP 解成 PAM（環境變數 DWEBP，沒設用 CWEBP 同資料夾的 dwebp，再沒有用 PATH 的 dwebp）→ { width, height, depth, pixels }；dwebp 不在丟 Error
// dwebp()                 找跑得起來的 dwebp：{ path } 或 { skip: 原因 }
// runImages(args, opts)   真的開子程序跑 scripts/images.mjs（逾時 10 分鐘：真的素材整批轉要一兩分鐘）
// cwebp / tmp / snapshot / stamp / usageError   沿用 b6-fixture.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { runScript, usageError, tmp, snapshot, stamp, cwebp } from './b6-fixture.js';

export { usageError, tmp, snapshot, stamp, cwebp };

export const pixelAt = (x, y) => [(x * 7) % 256, (y * 13) % 256, (x * 3 + y * 5) % 256];

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

export function patternPng(width, height) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const row = y * (width * 3 + 1);
        for (let x = 0; x < width; x += 1) {
            const [r, g, b] = pixelAt(x, y);
            raw[row + 1 + x * 3] = r;
            raw[row + 2 + x * 3] = g;
            raw[row + 3 + x * 3] = b;
        }
    }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function dwebp() {
    const candidates = [];
    if (process.env.DWEBP) candidates.push(process.env.DWEBP);
    if (process.env.CWEBP) candidates.push(path.join(path.dirname(process.env.CWEBP), 'dwebp'));
    candidates.push('dwebp');
    for (const candidate of candidates) {
        const res = spawnSync(candidate, ['-version'], { encoding: 'utf8', timeout: 30000 });
        if (!res.error && res.status === 0) return { path: candidate };
    }
    return { skip: `找不到跑得起來的 dwebp（試了 ${candidates.join('、')}）：要量裁出來的像素，請裝 libwebp 或用環境變數 DWEBP 指到它` };
}

export function decodeWebp(file) {
    const tool = dwebp();
    if (!tool.path) throw new Error(tool.skip);
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'site-dwebp-')), 'out.pam');
    try {
        const res = spawnSync(tool.path, ['-quiet', '-pam', file, '-o', out], { encoding: 'utf8' });
        if (res.status !== 0) throw new Error(`dwebp 解不開 ${file}：${res.stderr}`);
        const buf = fs.readFileSync(out);
        const end = buf.indexOf('ENDHDR\n');
        const head = buf.slice(0, end).toString('latin1');
        const num = (key) => Number(new RegExp(`${key} (\\d+)`).exec(head)[1]);
        return { width: num('WIDTH'), height: num('HEIGHT'), depth: num('DEPTH'), pixels: buf.slice(end + 7) };
    } finally {
        fs.rmSync(path.dirname(out), { recursive: true, force: true });
    }
}

// 真的素材整批轉（-z 9）一次要一兩分鐘：timeout 給 10 分鐘（b6-fixture 的 runScript 是 2 分鐘）
export function runImages(args, { cwd, env = {}, timeout = 600000 } = {}) {
    if (timeout === 120000) return runScript('images.mjs', args, { cwd, env });
    const script = path.join(SITE, 'scripts', 'images.mjs');
    if (!fs.existsSync(script)) throw new Error('缺 scripts/images.mjs');
    const merged = { ...process.env };
    for (const key of Object.keys(env)) {
        for (const have of Object.keys(merged)) if (have.toLowerCase() === key.toLowerCase()) delete merged[have];
        if (env[key] !== undefined) merged[key] = env[key];
    }
    const res = spawnSync(process.execPath, [script, ...args], { cwd: cwd ?? SITE, env: merged, encoding: 'utf8', timeout });
    if (res.error) throw new Error(`跑不起來：${res.error.message}`);
    return res;
}
