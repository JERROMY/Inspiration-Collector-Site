// 4-b14 檢查員第 1 輪補的：npm run og 拍照時開的本機伺服器（lib/og-run.js 的 shootAll）不能讀到根目錄外面、不能被壞請求弄掛。介面細則見 tests/README.md「4-b14」第 21～22 條。
//
// 做法：子程序跑 tests/fixtures/og-serve/probe.mjs —— 交給 shootAll 一個假的瀏覽器，在它叫 page.goto 的那一刻（伺服器開著）照原樣送請求；不需要 Playwright。
// 量什麼（每一種一條）：
//   符號連結：根目錄裡 sub/link.txt 指到外面的檔、linkdir/ 指到外面的資料夾 → 404、讀不到外面的字（Windows skip）
//   /sub/a.txt%00.png（空字元）→ 404；/%E0%A4%A（編碼壞掉）→ 400；兩者之後 /a.txt 照常 200、程序沒掛、stderr 沒有堆疊
//   防回歸：/../outside.txt、/..%2foutside.txt、/%2e%2e/outside.txt 與 /%2e%2e%2foutside.txt → 404；只聽 127.0.0.1（網址是 127.0.0.1，::1 與區域網路的位址連不上）
//   結構：lib/og-run.js 用 lib/static-site.js 的 serveSite，不自己開伺服器（不 import node:http、不寫 createServer）
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "F8.5 伺服器"
//   node --test tests/og-serve.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, FIXTURES } from './helpers.js';
import { tmp } from './og-fixture.js';

const LIB = path.join(SITE, 'lib', 'og-run.js');
const PROBE = path.join(FIXTURES, 'og-serve', 'probe.mjs');
const SECRET = '根目錄外面的祕密';

// 根目錄：a.txt、sub/a.txt；外面：outside.txt、outdir/secret.txt（祕密）；links 時根目錄裡多 sub/link.txt → outside.txt、linkdir → outdir
function layout(t, { links = false } = {}) {
    const base = tmp(t, 'site-og-serve-');
    const root = path.join(base, '專案 根目錄');
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a.txt'), 'A\n');
    fs.writeFileSync(path.join(root, 'sub', 'a.txt'), 'SUB\n');
    fs.writeFileSync(path.join(base, 'outside.txt'), `${SECRET}\n`);
    fs.mkdirSync(path.join(base, 'outdir'));
    fs.writeFileSync(path.join(base, 'outdir', 'secret.txt'), `${SECRET}\n`);
    if (links) {
        fs.symlinkSync(path.join(base, 'outside.txt'), path.join(root, 'sub', 'link.txt'));
        fs.symlinkSync(path.join(base, 'outdir'), path.join(root, 'linkdir'));
    }
    return root;
}

// 跑探針：回傳 { url, results, other }；伺服器掛了（程序在量完之前結束）就紅在這裡
function probe(root, paths) {
    if (!fs.existsSync(LIB)) assert.fail('缺 lib/og-run.js（後端之後實作）');
    const res = spawnSync(process.execPath, [PROBE, root, JSON.stringify(paths)], { encoding: 'utf8', timeout: 60000 });
    const row = res.stdout.split('\n').find((line) => line.startsWith('RESULT '));
    assert.ok(row, `伺服器要還活著把請求量完：探針的程序結束碼 ${res.status}，沒有量到結果（被請求弄掛了？）；stdout：${res.stdout}；stderr：${res.stderr.split('\n').slice(0, 6).join('\n')}`);
    assert.equal(res.status, 0, `探針結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `伺服器不能印堆疊（有沒接住的例外）：\n${res.stderr}`);
    return JSON.parse(row.slice('RESULT '.length));
}

function expectStatus(results, status) {
    for (const r of results) {
        assert.ok(!r.body.includes(SECRET), `${r.path}：不能送出根目錄外面的檔（得到 ${r.status}：${r.body.trim()}）`);
        assert.equal(r.status, status, `${r.path}：要回 ${status}，得到 ${r.status ?? r.error}`);
        assert.equal(r.after, 200, `${r.path} 之後：伺服器要還活著，/a.txt 回 200，得到 ${r.after}`);
    }
}

test('F8.5 伺服器：符號連結指到根目錄外面（sub/link.txt → 外面的檔、linkdir/ → 外面的資料夾）→ 404、讀不到外面的檔', (t) => {
    if (process.platform === 'win32') return t.skip('Windows 建符號連結要權限，這一條不跑');
    expectStatus(probe(layout(t, { links: true }), ['/sub/link.txt', '/linkdir/secret.txt']).results, 404);
});

test('F8.5 伺服器：/sub/a.txt%00.png（路徑裡有空字元）→ 404，伺服器不掛、之後照常回 200', (t) => {
    expectStatus(probe(layout(t), ['/sub/a.txt%00.png']).results, 404);
});

test('F8.5 伺服器：/%E0%A4%A（編碼壞掉）→ 400，伺服器不掛、之後照常回 200', (t) => {
    expectStatus(probe(layout(t), ['/%E0%A4%A']).results, 400);
});

test('F8.5 伺服器（防回歸）：/../outside.txt → 404', (t) => {
    expectStatus(probe(layout(t), ['/../outside.txt', '/sub/../../outside.txt']).results, 404);
});

test('F8.5 伺服器（防回歸）：/..%2foutside.txt → 404', (t) => {
    expectStatus(probe(layout(t), ['/..%2foutside.txt', '/sub/..%2f..%2foutside.txt']).results, 404);
});

test('F8.5 伺服器（防回歸）：/%2e%2e/outside.txt、/%2e%2e%2foutside.txt → 404', (t) => {
    expectStatus(probe(layout(t), ['/%2e%2e/outside.txt', '/%2e%2e%2foutside.txt', '/sub/%2e%2e/%2e%2e/outside.txt']).results, 404);
});

test('F8.5 伺服器（防回歸）：只聽 127.0.0.1 —— 網址是 http://127.0.0.1:埠，::1 與這台的區域網路位址連不上同一個埠', (t) => {
    const got = probe(layout(t), ['/a.txt']);
    assert.match(got.url, /^http:\/\/127\.0\.0\.1:\d+$/, `網址要是 http://127.0.0.1:埠，得到 ${got.url}`);
    expectStatus(got.results, 200);
    for (const o of got.other) assert.equal(o.status, null, `${o.host}：連到同一個埠要連不上（只聽 127.0.0.1），得到 ${o.status}`);
});

test('F8.5 伺服器（結構）：lib/og-run.js 用 lib/static-site.js 的 serveSite，不自己開伺服器', () => {
    if (!fs.existsSync(LIB)) assert.fail('缺 lib/og-run.js（後端之後實作）');
    const code = fs.readFileSync(LIB, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.match(code, /import\s*\{[^}]*\bserveSite\b[^}]*\}\s*from\s*['"]\.\/static-site\.js['"]/, '要 import { serveSite } from \'./static-site.js\'');
    assert.match(code, /\bserveSite\s*\(/, '要呼叫 serveSite(…)');
    assert.doesNotMatch(code, /['"]node:https?['"]|['"]https?['"]/, '不准 import node:http（伺服器只用 static-site.js 那一支）');
    assert.doesNotMatch(code, /createServer/, '不准自己 createServer');
});
