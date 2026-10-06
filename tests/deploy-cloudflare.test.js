// B5.1／B5.2 部署設定（2026-10-07 從 GitHub Pages 改成 Cloudflare Pages，使用者決定；原本的 pages.yml、public/CNAME 與它們的測試拿掉了）。
//
// 量什麼：
//   B5.1 不再有 GitHub Pages 的部署設定（.github/workflows/ 沒有檔、沒有 public/CNAME）—— 留著的話每次推送都會跑出一次失敗。
//   B5.1 .node-version 是 22（Cloudflare 的建置讀它挑 Node 版本；跟本機測試用的同一版）。
//   B5.1 package.json 有 build:pages：先 content:check、寫壞不擋（|| 接一句警告）、再 npm run build；build 失敗才擋。
//   B5.2 public/_headers：*.pages.dev 與預覽網址都 X-Robots-Tag: noindex（不讓重複的網站被收錄）；/_next/static/* 一年 immutable；
//        其他路徑不設長快取（HTML、字型、圖片檔名不帶雜湊）。規則數 ≤ 100、每行 ≤ 2000 字（官方上限）。
//   B5.2 .gitattributes 有 * text=auto eol=lf（Windows 那台 checkout 也不會把設定檔換成 CRLF）。
//   README 有一節講 Cloudflare 的設定：build:pages、out、.node-version、_headers。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B5.1|B5.2"
//   node --test tests/deploy-cloudflare.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { HEADERS, NODE_VERSION, GITATTRIBUTES, README, exists, readSite, sections } from './deploy-files.js';

// _headers 切成規則：一行網址（不縮排）接著幾行縮排的「名稱: 值」；# 開頭是註解
function rules() {
    const out = [];
    for (const row of readSite(HEADERS).split('\n')) {
        if (!row.trim() || row.trim().startsWith('#')) continue;
        if (/^\s/.test(row)) {
            assert.ok(out.length, `${HEADERS}：標頭「${row.trim()}」前面要先有一行網址`);
            const m = row.trim().match(/^([^:]+):\s*(.+)$/);
            assert.ok(m, `${HEADERS}：看不懂「${row.trim()}」（要是「名稱: 值」）`);
            out[out.length - 1].headers[m[1].trim().toLowerCase()] = m[2].trim();
        } else {
            out.push({ url: row.trim(), headers: {} });
        }
    }
    return out;
}

test('B5.1 部署：沒有 GitHub Pages 的部署設定（.github/workflows/、public/CNAME）', () => {
    const dir = path.join(SITE, '.github', 'workflows');
    const left = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    assert.deepEqual(left, [], '.github/workflows/ 不要有檔（改用 Cloudflare Pages，留著的話每次推送都會跑出一次失敗）');
    assert.ok(!exists('public/CNAME'), 'public/CNAME 是 GitHub Pages 用的，拿掉');
});

test('B5.1 部署：.node-version 是 22', () => {
    assert.equal(readSite(NODE_VERSION), '22\n', `${NODE_VERSION} 要恰好是「22」加一個換行`);
});

test('B5.1 部署：build:pages 先 content:check、寫壞不擋、再 npm run build', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    const cmd = pkg.scripts['build:pages'];
    assert.ok(cmd, 'package.json 要有 scripts["build:pages"]（Cloudflare 的建置指令）');
    const m = cmd.match(/^npm run content:check \|\| (.+) && npm run build$/);
    assert.ok(m, `build:pages 要寫成「npm run content:check || <警告> && npm run build」，得到「${cmd}」`);
    assert.match(m[1], /^echo /, '|| 後面接 echo 一句警告（寫壞不擋部署）');
    assert.ok(m[1].includes('警告') && m[1].includes('這一條讀不到'), '警告要講「寫壞的那一條顯示這一條讀不到」');
});

test('B5.2 _headers：*.pages.dev 與預覽網址都 noindex', () => {
    const all = rules();
    for (const url of ['https://:project.pages.dev/*', 'https://:version.:project.pages.dev/*']) {
        const rule = all.find((r) => r.url === url);
        assert.ok(rule, `${HEADERS} 要有「${url}」這條`);
        assert.equal(rule.headers['x-robots-tag'], 'noindex', `${url} 要 X-Robots-Tag: noindex`);
    }
    const leak = all.filter((r) => r.headers['x-robots-tag'] && !r.url.includes('pages.dev'));
    assert.deepEqual(leak.map((r) => r.url), [], '正式網址不准 noindex（只有 pages.dev 那兩條可以）');
});

test('B5.2 _headers：只有 /_next/static/* 長快取，其他不設', () => {
    const all = rules();
    const long = all.filter((r) => /max-age=\d{6,}|immutable/.test(r.headers['cache-control'] || ''));
    assert.deepEqual(long.map((r) => r.url), ['/_next/static/*'], '只有檔名帶雜湊的 /_next/static/* 可以長快取');
    assert.equal(long[0].headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('B5.2 _headers：在官方上限內（規則 ≤ 100、每行 ≤ 2000 字）', () => {
    assert.ok(rules().length <= 100, '規則超過 100 條');
    const long = readSite(HEADERS).split('\n').filter((row) => row.length > 2000);
    assert.deepEqual(long, [], '有一行超過 2000 字');
});

test('B5.2 .gitattributes：有 * text=auto eol=lf', () => {
    const lines = readSite(GITATTRIBUTES).split('\n').map((row) => row.trim().split(/\s+/).join(' '));
    assert.ok(lines.includes('* text=auto eol=lf'), `${GITATTRIBUTES} 要有一行「* text=auto eol=lf」`);
});

test('B5.2 README：有一節講 Cloudflare 的設定（build:pages、out、.node-version、_headers）', () => {
    const words = ['Cloudflare', 'npm run build:pages', '`out`', '.node-version', '_headers'];
    assert.ok(sections(readSite(README)).some((s) => words.every((w) => s.includes(w))), `${README} 要有一節同時寫到 ${words.join('、')}`);
});
