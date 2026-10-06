// 4-b6 拉丁字型瘦身（npm run fonts）與預算（npm run fonts:budget）的測試共用的東西（不是測試）。介面細則見 tests/README.md「4-b6」。
//
// woff2Font(codePoints, { size, format12, noCmap, note })
//     用程式組一個「讀得出 cmap」的最小 WOFF2：檔頭照規格、表目錄照規格（UIntBase128）、表資料用 node:zlib 的 brotli 壓。
//     表依序是 glyf、loca（都是「轉換過」：表目錄有 transformLength，壓縮資料裡放的是轉換後的長度）、OS/2、cmap、TEST（任意標籤，flags 63 ＋ 4 個位元組的標籤）——
//     cmap 不在第一個、前面還有轉換過的表，讀的人要照表目錄（轉換過的用 transformLength）算位移。noCmap: true 就不放 cmap。
//     cmap：(3,1) format 4 放 BMP 的字（一個字一段）；有 BMP 以外的字（或 format12: true）再加一個 (3,10) format 12 放全部。
//     note（物件）放進 WOFF2 的 private data 區（JSON）—— 假的 python 用它記「這個字型有哪些字、還有哪些可變軸」；size 給了就再補到剛好那麼大。
//     不是能顯示的字型 —— 只有 cmap。fontTools 讀得懂它（測試工程師核對過）。
// readNote(buffer)   讀回 private data 區的 note（沒有就回 null）。
// FAKE_PYTHON        tests/fixtures/fake-tools/python.mjs（假的 python：只會 -c、-m fontTools.varLib.instancer、-m fontTools.subset；行為寫在它的檔頭）。
// fakeSource(t, opts)
//     假的字型來源資料夾（路徑有空白與中文）：GoogleSansFlex-lite-latin.woff2（四個軸 opsz、wdth、slnt、wght；字有 ASCII、常用標點、還有「你」「か」）
//     與 JetBrainsMono-latin.woff2（一個軸 wght；字是 ASCII 與幾個符號）。opts.omit 少放哪個檔。回傳 { from, gsf, jbm }。
// installFakePython(t)
//     在暫存資料夾（路徑有空白與中文）做一個可以直接執行的 python：第一行 #!<node>，內容是 import() 假工具 —— 用 PYTHON 指過去。
//     回傳 { tool, log }：log 是假工具的呼叫紀錄檔（FAKE_LOG）。Windows 不能直接執行有 #! 的檔，回傳 { skip: 原因 }。
// readLog(file)      假工具的呼叫紀錄：[{ argv, step, family, output }]。
// realPython()       找能 import fontTools 與 brotli 的 python：環境變數 PYTHON，沒設用 PATH 的 python3。回傳 { python } 或 { skip: 原因 }。
// ASCII              U+0020～U+007E 全部（含空白）。
// CJK                「中日文」的碼位範圍（[起, 迄]）—— 跟 lib/font-text.js 的 isCjk 同一份定義（README 第 25 條）。
// rangesOf(unicodeRange)   把 CSS 的 unicode-range 讀成 [[起, 迄], …]（測試自己的讀法）；寫壞就丟 Error。
// covers(ranges, cp) / overlapsCjk(ranges)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FIXTURES } from './helpers.js';
import { tmp } from './media-fixture.js';

export const FAKE_PYTHON = path.join(FIXTURES, 'fake-tools', 'python.mjs');
export const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)).join('');
export const CJK = [
    [0x2e80, 0x2fff], [0x3000, 0x303f], [0x3040, 0x309f], [0x30a0, 0x30ff], [0x3100, 0x312f], [0x3190, 0x31ff],
    [0x3200, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xffef], [0x20000, 0x3ffff],
];

function uintBase128(value) {
    const bytes = [value & 0x7f];
    for (let v = Math.floor(value / 128); v > 0; v = Math.floor(v / 128)) bytes.unshift((v & 0x7f) | 0x80);
    return Buffer.from(bytes);
}

function format4(cps) {
    const bmp = cps.filter((cp) => cp <= 0xfffe);
    const segs = [...bmp.map((cp, i) => ({ start: cp, end: cp, delta: (i + 1 - cp) & 0xffff })), { start: 0xffff, end: 0xffff, delta: 1 }];
    const n = segs.length;
    const buf = Buffer.alloc(16 + n * 8);
    let pow = 1;
    while (pow * 2 <= n) pow *= 2;
    buf.writeUInt16BE(4, 0);
    buf.writeUInt16BE(buf.length, 2);
    buf.writeUInt16BE(n * 2, 6);
    buf.writeUInt16BE(pow * 2, 8);
    buf.writeUInt16BE(Math.log2(pow), 10);
    buf.writeUInt16BE(n * 2 - pow * 2, 12);
    segs.forEach((s, i) => {
        buf.writeUInt16BE(s.end, 14 + i * 2);
        buf.writeUInt16BE(s.start, 16 + n * 2 + i * 2);
        buf.writeUInt16BE(s.delta, 16 + n * 4 + i * 2);
        buf.writeUInt16BE(0, 16 + n * 6 + i * 2);   // idRangeOffset
    });
    return buf;
}

function format12(cps) {
    const buf = Buffer.alloc(16 + cps.length * 12);
    buf.writeUInt16BE(12, 0);
    buf.writeUInt32BE(buf.length, 4);
    buf.writeUInt32BE(cps.length, 12);
    cps.forEach((cp, i) => {
        buf.writeUInt32BE(cp, 16 + i * 12);
        buf.writeUInt32BE(cp, 20 + i * 12);
        buf.writeUInt32BE(i + 1, 24 + i * 12);
    });
    return buf;
}

function cmapTable(cps, { format12: force = false } = {}) {
    const subs = [{ platform: 3, encoding: 1, data: format4(cps) }];
    if (force || cps.some((cp) => cp > 0xffff)) subs.push({ platform: 3, encoding: 10, data: format12(cps) });
    const head = Buffer.alloc(4 + subs.length * 8);
    head.writeUInt16BE(subs.length, 2);
    let offset = head.length;
    subs.forEach((s, i) => {
        head.writeUInt16BE(s.platform, 4 + i * 8);
        head.writeUInt16BE(s.encoding, 6 + i * 8);
        head.writeUInt32BE(offset, 8 + i * 8);
        offset += s.data.length;
    });
    return Buffer.concat([head, ...subs.map((s) => s.data)]);
}

export function woff2Font(codePoints, { size, format12 = false, noCmap = false, note } = {}) {
    const cps = [...new Set(codePoints)].sort((a, b) => a - b);
    const tables = [
        { flags: 10, orig: 400, data: Buffer.alloc(37, 0x22), transformed: true },   // glyf（已知標籤第 10 個）
        { flags: 11, orig: 64, data: Buffer.alloc(0), transformed: true },            // loca（已知標籤第 11 個，轉換後長度一定是 0）
        { flags: 6, data: Buffer.alloc(96, 0x11) },                                   // OS/2（已知標籤第 6 個）
        ...(noCmap ? [] : [{ flags: 0, data: cmapTable(cps, { format12 }) }]),        // cmap（已知標籤第 0 個）
        { flags: 63, tag: 'TEST', data: Buffer.from('fake table for 4-b6 tests') },  // 任意標籤
    ];
    const dir = Buffer.concat(tables.map((tb) => Buffer.concat([
        Buffer.from([tb.flags]),
        tb.tag ? Buffer.from(tb.tag, 'latin1') : Buffer.alloc(0),
        uintBase128(tb.transformed ? tb.orig : tb.data.length),
        tb.transformed ? uintBase128(tb.data.length) : Buffer.alloc(0),
    ])));
    const compressed = zlib.brotliCompressSync(Buffer.concat(tables.map((tb) => tb.data)));
    let body = Buffer.concat([Buffer.alloc(48), dir, compressed]);
    const aligned = Math.ceil(body.length / 4) * 4;
    body = Buffer.concat([body, Buffer.alloc(aligned - body.length)]);
    let priv = note === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(note) + '\n', 'utf8');
    if (size !== undefined) {
        if (size < aligned + priv.length) throw new Error(`測試自己寫錯：這個 WOFF2 至少 ${aligned + priv.length} 位元組，要 ${size}`);
        priv = Buffer.concat([priv, Buffer.alloc(size - aligned - priv.length, 0x20)]);
    }
    const out = Buffer.concat([body, priv]);
    out.write('wOF2', 0, 'latin1');
    out.writeUInt32BE(0x00010000, 4);
    out.writeUInt32BE(out.length, 8);
    out.writeUInt16BE(tables.length, 12);
    out.writeUInt32BE(12 + 16 * tables.length + tables.reduce((n, tb) => n + Math.ceil((tb.orig ?? tb.data.length) / 4) * 4, 0), 16);
    out.writeUInt32BE(compressed.length, 20);
    out.writeUInt16BE(1, 24);
    if (priv.length) {
        out.writeUInt32BE(aligned, 40);
        out.writeUInt32BE(priv.length, 44);
    }
    return out;
}

export function readNote(buf) {
    if (buf.length < 48) return null;
    const offset = buf.readUInt32BE(40);
    const length = buf.readUInt32BE(44);
    if (!offset || !length || offset + length > buf.length) return null;
    const text = buf.toString('utf8', offset, offset + length);
    const line = text.slice(0, text.indexOf('\n'));
    try { return JSON.parse(line); } catch { return null; }
}

export const GSF_CHARS = ASCII + 'é·’“”—…→©' + '你か';
export const JBM_CHARS = ASCII + '→←·';

function fontFile(family, chars, axes) {
    const cps = [...chars].map((c) => c.codePointAt(0));
    return woff2Font(cps, { note: { fake: true, family, chars, axes, pinned: {} } });
}

export function fakeSource(t, { omit = [] } = {}) {
    const from = path.join(tmp(t, 'site-fonts-src-'), '字型 原檔');
    fs.mkdirSync(from, { recursive: true });
    const gsf = path.join(from, 'GoogleSansFlex-lite-latin.woff2');
    const jbm = path.join(from, 'JetBrainsMono-latin.woff2');
    if (!omit.includes('GoogleSansFlex-lite-latin.woff2')) {
        fs.writeFileSync(gsf, fontFile('GSF', GSF_CHARS, { opsz: '8:144', wdth: '25:151', slnt: '-10:0', wght: '1:1000' }));
    }
    if (!omit.includes('JetBrainsMono-latin.woff2')) fs.writeFileSync(jbm, fontFile('JBM', JBM_CHARS, { wght: '100:800' }));
    return { from, gsf, jbm };
}

export function installFakePython(t) {
    if (process.platform === 'win32') return { skip: 'Windows 不能直接執行開頭是 #! 的假工具（真的 python 在 Windows 是 .exe）；這幾條在 mac／Linux 上跑' };
    const dir = path.join(tmp(t, 'site-fonts-tool-'), '工具 資料夾');
    fs.mkdirSync(dir, { recursive: true });
    const tool = path.join(dir, 'python3');
    fs.writeFileSync(tool, `#!${process.execPath}\nimport(${JSON.stringify(pathToFileURL(FAKE_PYTHON).href)});\n`);
    fs.chmodSync(tool, 0o755);
    return { tool, log: path.join(dir, 'calls.log') };
}

export function readLog(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function realPython() {
    const python = process.env.PYTHON || 'python3';
    const res = spawnSync(python, ['-c', 'import fontTools, brotli'], { encoding: 'utf8', timeout: 60000 });
    if (res.error || res.status !== 0) {
        const why = res.error ? (res.error.code || res.error.message) : (res.stderr.trim().split('\n').pop() || `結束碼 ${res.status}`);
        return { skip: `找不到能 import fontTools 與 brotli 的 python（試了 ${python}：${why}）；要跑這條請用環境變數 PYTHON 指到裝了 fonttools 與 brotli 的 python` };
    }
    return { python };
}

export function rangesOf(unicodeRange) {
    return String(unicodeRange).split(',').map((part) => {
        const m = /^\s*U\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?\s*$/i.exec(part);
        if (!m) throw new Error(`unicode-range 讀不懂：「${part}」`);
        return [parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)];
    });
}

export function covers(ranges, cp) {
    return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

export function overlapsCjk(ranges) {
    return ranges.some(([lo, hi]) => CJK.some(([a, b]) => lo <= b && hi >= a));
}
