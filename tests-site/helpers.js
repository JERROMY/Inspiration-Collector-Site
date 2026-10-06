// 網站前端測試共用的小工具（不是測試；run.mjs 只跑 *.test.js）。
//
// needOut()            out/ 不在就紅，講清楚是「還沒 build」還是「package.json 沒有 build 指令」—— 這是現在（前端還沒做）該紅的那一步。
// readOut(rel)         讀 out/ 底下的檔（不在就紅，講是哪個檔）。
// listFiles(dir)       整個資料夾的檔案（相對路徑、用 / 分隔、排好）。
// tagAttrs(html, tag)  每一個 <tag …> 的屬性（小寫屬性名 → 值；沒寫值的是 ''）。
// visibleText(html)    畫面上看得到的字：拿掉 <script>、<style>、<template>、<noscript> 與所有標籤，還原實體。
// cssRules(css)        把 CSS（含壓縮過的）拆成最內層的 { selectors, body }。
// siteCss()            網站自己的 CSS 原始檔（app/、components/ 底下，設計系統複本 app/styles/nox/ 除外）。
// outCss()             build 出來的 CSS（out/_next/ 底下的 .css 與每頁 HTML 裡的 <style>）。
// buildCopy(opts)      把整個網站複製到系統暫存資料夾（不動專案裡的任何檔），換掉 content/、用 prepare(複本的路徑) 改複本裡的檔、或換一支 node，在那裡 build。
// browserSession(pw, dir)  第一次 get() 才開伺服器與瀏覽器（dir 當根目錄，預設 out/；可以給函式，第一次 get() 才算）；close() 收掉。不放在 before()：量過 —— 用 --test-name-pattern
//                      篩掉整支檔時，node:test 不等 async 的 before 跑完就跑 after，瀏覽器開了沒人關，整個測試卡住。
// playwright()         找 Playwright（環境變數 SITE_PLAYWRIGHT，或 GPTPlugins 的 clipper/node_modules/playwright；git worktree 用主資料夾那一份）；找不到回 null 與原因。
// strings / plain      三語字串表（strings/<語言>.json）；plain(字) 拿掉斷行標記（{…} 留裡面的字）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from './server.js';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(SITE, 'out');
export const LANGS = ['zh', 'en', 'ja'];
export const HTML_LANG = { zh: 'zh-Hant', en: 'en', ja: 'ja' };
// 設計系統的複本放這裡（檔名跟 clipper/css 一樣、位元組相同）；網站自己的 CSS 不能寫死色碼，這一夾除外
export const NOX_DIR = path.join(SITE, 'app', 'styles', 'nox');
export const FONT_FILES = ['GoogleSansFlex-site.woff2', 'JetBrainsMono-site.woff2'];

function readPkg() {
    const file = path.join(SITE, 'package.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

export function needOut(dir = OUT) {
    if (fs.existsSync(path.join(dir, 'zh', 'index.html'))) return;
    const pkg = readPkg();
    if (!pkg.scripts || typeof pkg.scripts.build !== 'string') {
        assert.fail('package.json 沒有 build 指令（前端加 Next.js 之後才有）—— 所以沒有 out/。npm run test:site 會先跑 npm run build 再跑這裡');
    }
    if (!fs.existsSync(dir)) assert.fail(`沒有 out/（${dir}）：先跑 npm run build（npm run test:site 會先 build）`);
    assert.fail(`out/ 在，但沒有 out/zh/index.html：build 出來的路由不對（要 /zh/、/en/、/ja/，trailingSlash: true）`);
}

export function readOut(rel, dir = OUT) {
    needOut(dir);
    const file = path.join(dir, ...rel.split('/'));
    if (!fs.existsSync(file)) assert.fail(`out/${rel} 不在`);
    return fs.readFileSync(file, 'utf8');
}

export function listFiles(dir) {
    const found = [];
    const walk = (abs, rel) => {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const childRel = rel ? `${rel}/${ent.name}` : ent.name;
            if (ent.isDirectory()) walk(path.join(abs, ent.name), childRel);
            else found.push(childRel);
        }
    };
    if (fs.existsSync(dir)) walk(dir, '');
    return found.sort();
}

export function decodeEntities(text) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            return String.fromCodePoint(code);
        }
        return named[body] ?? whole;
    });
}

export function tagAttrs(html, tag) {
    const result = [];
    const re = new RegExp(`<${tag}(?=[\\s>/])([^>]*)>`, 'gi');
    for (const m of html.matchAll(re)) {
        const attrs = {};
        for (const a of m[1].matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
            attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
        }
        result.push(attrs);
    }
    return result;
}

export function htmlAttrs(html) {
    const all = tagAttrs(html, 'html');
    assert.equal(all.length, 1, `要剛好一個 <html> 標籤，找到 ${all.length} 個`);
    return all[0];
}

export function visibleText(html) {
    const body = html
        .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ');
    return decodeEntities(body);
}

export function stripCssComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function cssRules(css) {
    const rules = [];
    for (const m of stripCssComments(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        rules.push({ selectors: m[1].trim(), body: m[2] });
    }
    return rules;
}

export function siteCss() {
    const files = [];
    for (const top of ['app', 'components']) {
        for (const rel of listFiles(path.join(SITE, top))) {
            const full = path.join(SITE, top, ...rel.split('/'));
            if (!rel.endsWith('.css')) continue;
            if (full.startsWith(NOX_DIR + path.sep)) continue;
            files.push({ rel: `${top}/${rel}`, text: fs.readFileSync(full, 'utf8') });
        }
    }
    return files;
}

export function outCss(dir = OUT) {
    needOut(dir);
    const parts = [];
    for (const rel of listFiles(path.join(dir, '_next'))) {
        if (rel.endsWith('.css')) parts.push({ rel: `_next/${rel}`, text: fs.readFileSync(path.join(dir, '_next', ...rel.split('/')), 'utf8') });
    }
    for (const rel of listFiles(dir).filter((r) => r.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
        for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parts.push({ rel: `${rel} 的 <style>`, text: m[1] });
    }
    return parts;
}

// 網站整份複製到系統暫存資料夾再 build：不動專案裡的 content/、out/、.next/。
// node_modules 也一起複製 —— Next.js 16 的 Turbopack 不收指到專案外面的 node_modules 捷徑（「Symlink … points out of the filesystem root」，量過）。
// 用 COPYFILE_FICLONE：mac 的 APFS 上是瞬間的複本（約 2 秒）；不支援的檔案系統會退回一般複製（較慢，Windows 上可能要幾十秒）。
export function buildCopy({ content = null, prepare = null, node = process.execPath, label = 'build' } = {}) {
    const nextBin = path.join(SITE, 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!fs.existsSync(nextBin)) assert.fail('沒有 node_modules/next：先在 homepage/site/ 跑 npm ci（網站的套件由前端加）');
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-site-build-'));
    const copy = path.join(scratch, 'site');
    const skip = new Set(['out', '.next', 'tests', 'tests-site', '.git']);
    fs.cpSync(SITE, copy, {
        recursive: true,
        mode: fs.constants.COPYFILE_FICLONE,
        verbatimSymlinks: true,
        filter: (src) => {
            const rel = path.relative(SITE, src);
            return rel === '' || !skip.has(rel.split(path.sep)[0]);
        },
    });
    if (content) {
        fs.rmSync(path.join(copy, 'content'), { recursive: true, force: true });
        fs.cpSync(content, path.join(copy, 'content'), { recursive: true });
    }
    if (prepare) prepare(copy);
    const run = spawnSync(node, [path.join(copy, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
        cwd: copy,
        encoding: 'utf8',
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
        timeout: 10 * 60 * 1000,
    });
    return {
        label,
        status: run.status,
        output: `${run.stdout ?? ''}\n${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`,
        out: path.join(copy, 'out'),
        cleanup: () => fs.rmSync(scratch, { recursive: true, force: true }),
    };
}

export function tail(text, lines = 30) {
    return text.trim().split('\n').slice(-lines).join('\n');
}

// Playwright 不加進網站的套件：借 GPTPlugins 的 clipper/node_modules/playwright（或 SITE_PLAYWRIGHT 指的那一份）。
// 搬進公開 repo 之後沒有 clipper/，要設 SITE_PLAYWRIGHT，不然這幾條 skip。
// GPTPlugins 的 clipper/node_modules：這個資料夾往上兩層的那一份；git worktree 沒有的話，用主資料夾的那一份（git rev-parse --git-common-dir 找）
export function clipperModules() {
    const found = [path.join(SITE, '..', '..', 'clipper', 'node_modules')];
    const git = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: SITE, encoding: 'utf8' });
    if (git.status === 0 && git.stdout.trim()) found.push(path.join(path.dirname(git.stdout.trim()), 'clipper', 'node_modules'));
    return found;
}

export function playwright() {
    const candidates = [];
    if (process.env.SITE_PLAYWRIGHT) candidates.push(process.env.SITE_PLAYWRIGHT);
    for (const dir of clipperModules()) candidates.push(path.join(dir, 'playwright'));
    for (const dir of candidates) {
        if (!fs.existsSync(path.join(dir, 'package.json'))) continue;
        try {
            return { pw: createRequire(import.meta.url)(dir), why: '' };
        } catch (err) {
            return { pw: null, why: `Playwright 載入失敗（${dir}）：${err.message}` };
        }
    }
    return { pw: null, why: `找不到 Playwright（試過：${candidates.join('、')}）。設 SITE_PLAYWRIGHT=<…/clipper/node_modules/playwright> 再跑` };
}

// 「不能下載中日文字型」用的中日文碼位（跟 lib/font-text.js 的 isCjk、tests/b6-font-fixture.js 同一份定義）
export const CJK_RANGES = [
    [0x2E80, 0x2FFF], [0x3000, 0x303F], [0x3040, 0x30FF], [0x3100, 0x312F], [0x3190, 0x31FF], [0x3200, 0x33FF],
    [0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF], [0xFE30, 0xFE4F], [0xFF00, 0xFFEF], [0x20000, 0x3FFFF],
];

// unicode-range 的值 → [起, 迄] 陣列；看不懂的寫法回 null（呼叫的人當成紅）
export function parseUnicodeRange(value) {
    const out = [];
    for (const raw of value.split(',')) {
        const part = raw.trim().toUpperCase();
        let m;
        if ((m = /^U\+([0-9A-F]{1,6})-([0-9A-F]{1,6})$/.exec(part))) out.push([parseInt(m[1], 16), parseInt(m[2], 16)]);
        else if ((m = /^U\+([0-9A-F?]{1,6})$/.exec(part))) out.push([parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'F'), 16)]);
        else return null;
    }
    return out;
}

export function touchesCjk(ranges) {
    return ranges.some(([a, b]) => CJK_RANGES.some(([c, d]) => a <= d && c <= b));
}

export function browserSession(pw, dir = OUT) {
    let started = null;
    return {
        get() {
            started ??= (async () => {
                const root = typeof dir === 'function' ? dir() : dir;
                needOut(root);
                const site = await serve(root);
                const browser = await pw.chromium.launch();
                return { site, browser };
            })();
            return started;
        },
        async close() {
            if (!started) return;
            const got = await started.catch(() => null);
            if (!got) return;
            await got.browser.close();
            await got.site.close();
        },
    };
}

export const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));

export function plain(text) {
    return text.replace(/[«»⟨⟩⟦⟧⁅⁆¦↵|]/g, '').replace(/\{([^{}]*)\}/g, '$1');
}

