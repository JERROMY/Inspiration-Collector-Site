// 4-b6（字型授權、拉丁字型瘦身、預算、圖片 WebP）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。介面細則見 tests/README.md「4-b6」。
//
// runScript(name, args, { cwd, env })   真的開子程序跑 scripts/<name>（spawnSync(process.execPath, …)）；檔不存在就以「缺 scripts/<name>（後端之後實作）」失敗。
//                                       env 疊在 process.env 上，值是 undefined 的鍵會被拿掉；PATH 在 Windows 叫 Path，先拿掉同名的再設。
// usageError(res, label)                用法錯誤的共同檢查：結束碼 2、stderr 第一行是中文、不是 Node parseArgs 的英文原文。
// parseCss(text)                        測試自己的讀法：去掉註解，每個 @font-face 一筆 { props（小寫屬性名 → 值）, url, format }。不靠被測的程式。
// snapshot(dir) / tmp(t, prefix)        沿用 media-fixture.js。
// stamp(dir)                            整個資料夾的 { 相對路徑: 大小與修改時間 }（不讀內容；跳過 node_modules、out、.next）—— 量「有沒有寫到別的地方」。
// cwebp()                               找跑得起來的 cwebp：環境變數 CWEBP，沒設就用 PATH 的 cwebp；回傳 { path } 或 { skip: 原因 }。
// webpInfo(buf)                         測試自己讀 WebP 檔頭：{ kind: 'VP8 '|'VP8L'|'VP8X', width, height }；不是 WebP 就丟 Error。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { tmp, snapshot } from './media-fixture.js';

export { tmp, snapshot };

export function runScript(name, args, { cwd = SITE, env = {} } = {}) {
    const script = path.join(SITE, 'scripts', name);
    if (!fs.existsSync(script)) assert.fail(`缺 scripts/${name}（後端之後實作）`);
    const merged = { ...process.env };
    for (const key of Object.keys(env)) {
        for (const have of Object.keys(merged)) if (have.toLowerCase() === key.toLowerCase()) delete merged[have];
        if (env[key] !== undefined) merged[key] = env[key];
    }
    const res = spawnSync(process.execPath, [script, ...args], { cwd, env: merged, encoding: 'utf8', timeout: 120000 });
    assert.equal(res.error, undefined, `跑不起來：${res.error && res.error.message}`);
    return res;
}

export function usageError(res, label) {
    assert.equal(res.status, 2, `${label}：結束碼要是 2（用法錯誤），得到 ${res.status}；stderr：${res.stderr}`);
    // 只看第一行：後面接的「用法：…」永遠是中文，看整段的話 Node 的英文原文混在前面也擋不到
    const first = res.stderr.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(first, /Unknown option|argument|ambiguous|missing|Unexpected|positional|ERR_PARSE_ARGS|ENOENT/i,
        `${label}：stderr 第一行不能是 Node 的英文原文（要翻成白話），得到：${first}`);
}

export function parseCss(text) {
    const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const faces = [];
    for (const m of src.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const props = {};
        for (const decl of m[1].split(';')) {
            const at = decl.indexOf(':');
            if (at < 0) continue;
            props[decl.slice(0, at).trim().toLowerCase()] = decl.slice(at + 1).trim().replace(/\s+/g, ' ');
        }
        const u = /url\(\s*(["']?)([^"')]+)\1\s*\)/.exec(props.src ?? '');
        const f = /format\(\s*["']?([^"')]+)["']?\s*\)/.exec(props.src ?? '');
        faces.push({ props, url: u ? u[2] : null, format: f ? f[1] : null });
    }
    return faces;
}

export function stamp(dir) {
    const out = {};
    const walk = (abs, rel) => {
        for (const name of fs.readdirSync(abs).sort()) {
            if (!rel && ['node_modules', 'out', '.next'].includes(name)) continue;
            const full = path.join(abs, name);
            const key = rel ? `${rel}/${name}` : name;
            const st = fs.statSync(full);
            if (st.isDirectory()) walk(full, key);
            else out[key] = `${st.size}@${st.mtimeMs}`;
        }
    };
    walk(dir, '');
    return out;
}

export function cwebp() {
    const candidate = process.env.CWEBP || 'cwebp';
    const res = spawnSync(candidate, ['-version'], { encoding: 'utf8', timeout: 30000 });
    if (res.error || res.status !== 0) {
        return { skip: `找不到跑得起來的 cwebp（試了 ${candidate}：${res.error ? res.error.code || res.error.message : `結束碼 ${res.status}`}）；要跑這條請裝 cwebp 或用環境變數 CWEBP 指到它（這台 mac 是 /opt/homebrew/bin/cwebp）` };
    }
    return { path: candidate };
}

export function webpInfo(buf) {
    if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new Error('不是 WebP（沒有 RIFF…WEBP 檔頭）');
    const kind = buf.toString('latin1', 12, 16);
    if (kind === 'VP8 ') return { kind, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8X') return { kind, width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { kind, width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    throw new Error(`認不得的 WebP 檔頭 ${JSON.stringify(kind)}`);
}
