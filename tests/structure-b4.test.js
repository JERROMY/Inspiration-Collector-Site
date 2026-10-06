// 4-b4 的結構（內容檔初稿與檢查指令）。只看檔案，不執行模組。
//
// 量什麼：
//   B4.2 lib/content-check.js 在 lib/：第一個 export 之前有 JSDoc（/** … */），寫了 @param 與 @returns；匯出 checkContent；
//        只 import node: 內建與相對路徑、不用 require；用 4-b1 的 ./content.js 讀（import 它、呼叫 readContent），不自己重寫讀檔與解析。
//   B4.2 lib/ 每一支 .js 檔頭都有 JSDoc（第一個 export 之前有 /** … */）。
//   B4.2 scripts/content-check.mjs 薄薄一層（只讀參數、呼叫 checkContent、印結果）：只 import node: 內建與 ../lib/content-check.js、呼叫 checkContent；
//        不碰 readContent、parseChangelog、parseNews、parseLinks，不用 readFile／readdir 自己讀內容。
//   B4.2 package.json 有 "content:check": "node scripts/content-check.mjs"；套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//   B4.2 公開 repo 相容（homepage/site/ 之後用 subtree split 搬出去）：這一段的程式與測試、4-b1 的讀內容模組、共用的 helpers.js
//        都不往 homepage/site/ 外面讀 —— 去掉註解之後沒有 design/、release/、tutorial/、clipper/、../../、'..', '..' 這些字。
//        （4-b2、4-b3 的章節與素材工具本來就讀主資料夾的 tutorial/、release/，不在這一條裡；見 tests/README.md「4-b4」已知限制。）
//   B4.2 fixture 在 tests/fixtures/content-check/。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B4.2 結構"
//   node --test tests/structure-b4.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const LIB = path.join(SITE, 'lib');
const CLI = path.join(SITE, 'scripts', 'content-check.mjs');
const CHECK = path.join(LIB, 'content-check.js');

// 去掉註解，免得註解裡寫到的東西被當成真的
function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function specifiers(text) {
    const src = code(text);
    const found = [];
    for (const re of [/\bimport\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\bexport\s[^'"]*?from\s*['"]([^'"]+)['"]/g]) {
        for (const m of src.matchAll(re)) found.push(m[1]);
    }
    return found;
}

function read(file, label) {
    if (!fs.existsSync(file)) assert.fail(`缺 ${label}（後端之後實作）`);
    return fs.readFileSync(file, 'utf8');
}

test('B4.2 結構：lib/content-check.js 在 lib/，檔頭 JSDoc、匯出 checkContent、只用 Node 內建與相對路徑', () => {
    const text = read(CHECK, 'lib/content-check.js');
    const firstExport = text.search(/^export\s/m);
    assert.ok(firstExport >= 0, 'lib/content-check.js 沒有 export');
    assert.ok(text.slice(0, firstExport).includes('/**'), 'lib/content-check.js：第一個 export 之前要有 JSDoc（/** … */）');
    assert.match(text, /@param\b/, 'lib/content-check.js：JSDoc 要寫 @param（收什麼）');
    assert.match(text, /@returns?\b/, 'lib/content-check.js：JSDoc 要寫 @returns（給什麼）');
    const src = code(text);
    assert.match(src, /\bexport\s+(async\s+)?function\s+checkContent\b|\bexport\s*\{[^}]*\bcheckContent\b/, 'lib/content-check.js 要匯出 checkContent');
    assert.doesNotMatch(src, /\brequire\s*\(/, 'lib/content-check.js 不用 require（ESM）');
    for (const spec of specifiers(text)) {
        assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `lib/content-check.js import 了「${spec}」：只准 node: 內建與同資料夾的 ./`);
    }
});

test('B4.2 結構：lib/content-check.js 用 4-b1 的 ./content.js 讀（呼叫 readContent），不自己重寫讀檔與解析', () => {
    const text = read(CHECK, 'lib/content-check.js');
    const src = code(text);
    assert.ok(specifiers(text).includes('./content.js'), 'lib/content-check.js 要 import ./content.js（4-b1 的讀內容模組）');
    assert.match(src, /\breadContent\s*\(/, 'lib/content-check.js 要呼叫 readContent');
    for (const name of ['parseChangelog', 'parseNews', 'parseLinks', 'toLines', 'readBlocks']) {
        assert.doesNotMatch(src, new RegExp(`\\b(function|const|let)\\s+${name}\\b`), `lib/content-check.js 不要自己定義 ${name}（4-b1 已經有）`);
    }
});

test('B4.2 結構：lib/ 每一支 .js 檔頭都有 JSDoc', () => {
    for (const name of fs.readdirSync(LIB).filter((n) => n.endsWith('.js')).sort()) {
        const text = fs.readFileSync(path.join(LIB, name), 'utf8');
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0, `lib/${name} 沒有 export`);
        assert.ok(text.slice(0, firstExport).includes('/**'), `lib/${name}：第一個 export 之前要有 JSDoc（/** … */）`);
    }
});

test('B4.2 結構：scripts/content-check.mjs 薄薄一層：只讀參數、呼叫 checkContent、印結果', () => {
    const text = read(CLI, 'scripts/content-check.mjs');
    const src = code(text);
    const specs = specifiers(text);
    for (const spec of specs) {
        assert.ok(spec.startsWith('node:') || spec === '../lib/content-check.js', `scripts/content-check.mjs import 了「${spec}」：只准 node: 內建與 ../lib/content-check.js`);
    }
    assert.ok(specs.includes('../lib/content-check.js'), 'scripts/content-check.mjs 要 import ../lib/content-check.js');
    assert.match(src, /\bcheckContent\s*\(/, '要呼叫 checkContent');
    for (const name of ['readContent', 'parseChangelog', 'parseNews', 'parseLinks']) {
        assert.doesNotMatch(src, new RegExp(`\\b${name}\\b`), `scripts/content-check.mjs 不要碰 ${name}（那是 lib 的事）`);
    }
    assert.doesNotMatch(src, /\b(readFile|readFileSync|readdir|readdirSync|createReadStream)\b/, 'scripts/content-check.mjs 不要自己讀內容檔（那是 lib 的事）');
});

test('B4.2 結構：package.json 有 npm run content:check、套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(read(path.join(SITE, 'package.json'), 'package.json'));
    assert.equal(pkg.scripts && pkg.scripts['content:check'], 'node scripts/content-check.mjs', 'package.json 的 scripts["content:check"] 要是 "node scripts/content-check.mjs"');
    assertPackageWhitelist(pkg);
});

test('B4.2 結構：讀內容那一路的程式與測試不往 homepage/site/ 外面讀（之後要搬進公開 repo）', () => {
    const files = [
        'lib/content-check.js', 'scripts/content-check.mjs',
        'lib/content.js', 'lib/changelog.js', 'lib/news.js', 'lib/links.js', 'lib/entries.js', 'lib/lines.js',
        'tests/helpers.js', 'tests/content-check-fixture.js',
        'tests/content-check.test.js', 'tests/content-check-cli.test.js', 'tests/content-files.test.js',
    ];
    // 這支自己的字串裡就寫著要找的字，不掃自己
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of files) {
        const src = code(read(path.join(SITE, rel), rel));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：之後搬進公開 repo 就讀不到了`);
        }
    }
});

test('B4.2 結構：fixture 在 tests/fixtures/content-check/', () => {
    for (const name of ['good', 'bad-entry', 'unreadable', 'changelog-versions', 'changelog-items', 'changelog-order',
        'news-dates', 'news-count', 'news-pinned', 'order-reversed', 'empty-news', 'no-pinned', 'changelog-dates', 'stray-close']) {
        assert.ok(fs.existsSync(path.join(SITE, 'tests', 'fixtures', 'content-check', name)), `tests/fixtures/content-check/${name}/ 不見了`);
    }
});
