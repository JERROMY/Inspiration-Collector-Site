// 4-b7 的結構（B7.4：字串表命令與標記解析）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b7」。
//
// 量什麼：
//   B7.4 package.json：scripts.strings ＝ "node scripts/strings.mjs"；套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//   B7.4 lib/segments.js：第一個 export 之前有 JSDoc、寫了 @param 與 @returns；匯出 parseSegments；一個 import 都沒有 ——
//        前端的 React 元件也要用它，不能拉進 node: 的模組（瀏覽器裡沒有）。
//   B7.4 scripts/strings.mjs：只 import node: 內建與 ../lib/<檔>.js；import ../lib/segments.js、用 parseSegments、不自己定義；
//        去掉註解之後沒有寫死的外部路徑（design/、/Users/、../.. …）；檔頭註解（第一個 import 之前）寫到 npm run strings、--from、--copy、--out、strings/。
//   B7.4 這一段新加的測試與小工具：第一行是 // 說明、檔頭寫到 4-b7 或 B7；去掉註解之後不往 homepage/site/ 外面讀（真的資料只從環境變數給）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B7.4 結構"
//   node --test tests/structure-b7.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const TESTS = ['tests/b7-fixture.js', 'tests/segments.test.js', 'tests/strings-cli.test.js', 'tests/strings-files.test.js', 'tests/strings-real.test.js'];

// 去掉註解，免得註解裡寫到的東西被當成真的（跟 structure-b6.test.js 同一個寫法）
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

test('B7.4 結構：package.json 有 npm run strings，套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(read(path.join(SITE, 'package.json'), 'package.json'));
    assert.equal(pkg.scripts && pkg.scripts.strings, 'node scripts/strings.mjs', 'package.json 的 scripts.strings 要是 "node scripts/strings.mjs"');
    assertPackageWhitelist(pkg);
});

test('B7.4 結構：lib/segments.js 檔頭用 JSDoc 寫收什麼、給什麼，匯出 parseSegments，不 import 任何東西', () => {
    const text = read(path.join(SITE, 'lib', 'segments.js'), 'lib/segments.js');
    const firstExport = text.search(/^export\s/m);
    assert.ok(firstExport >= 0, 'lib/segments.js 沒有 export');
    assert.ok(text.slice(0, firstExport).includes('/**'), 'lib/segments.js：第一個 export 之前要有 JSDoc（/** … */）');
    assert.match(text, /@param\b/, 'lib/segments.js：JSDoc 要寫 @param（收什麼）');
    assert.match(text, /@returns?\b/, 'lib/segments.js：JSDoc 要寫 @returns（給什麼）');
    assert.match(code(text), /\bexport\s+function\s+parseSegments\b|\bexport\s*\{[^}]*\bparseSegments\b/, 'lib/segments.js 要匯出 parseSegments');
    assert.deepEqual(specifiers(text), [], 'lib/segments.js 不 import 任何東西（前端在瀏覽器裡也要能用）');
    assert.doesNotMatch(code(text), /\brequire\s*\(|\bprocess\.|\bBuffer\b/, 'lib/segments.js 不用 require、process、Buffer（只做字串轉換）');
});

test('B7.4 結構：scripts/strings.mjs 只 import node: 與 ../lib/，用 lib 的 parseSegments、不自己定義', () => {
    const text = read(path.join(SITE, 'scripts', 'strings.mjs'), 'scripts/strings.mjs');
    assert.doesNotMatch(code(text), /\brequire\s*\(/, 'scripts/strings.mjs 不用 require（ESM）');
    for (const spec of specifiers(text)) {
        assert.ok(spec.startsWith('node:') || /^\.\.\/lib\/[^/]+\.js$/.test(spec), `scripts/strings.mjs import 了「${spec}」：只准 node: 內建與 ../lib/<檔>.js`);
    }
    assert.ok(specifiers(text).includes('../lib/segments.js'), 'scripts/strings.mjs 要 import ../lib/segments.js');
    assert.match(code(text), /\bparseSegments\b/, 'scripts/strings.mjs 要用 parseSegments 驗證每一條');
    assert.doesNotMatch(code(text), /function\s+parseSegments\b|\bparseSegments\s*=\s*(\(|function|async)/, 'scripts/strings.mjs 不要自己定義 parseSegments（用 lib 的）');
});

test('B7.4 結構：scripts/strings.mjs 與 lib/segments.js 沒有寫死的外部路徑', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /ArticleCreator/, /design_system_nox/, /\/Users\//, /scratchpad/,
        /GPTPlugins/, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of ['scripts/strings.mjs', 'lib/segments.js']) {
        const src = code(read(path.join(SITE, rel), rel));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 寫死了外部路徑「${hit && hit[0]}」：來源要從參數給`);
        }
    }
});

test('B7.4 結構：scripts/strings.mjs 的檔頭註解寫到怎麼跑', () => {
    const text = read(path.join(SITE, 'scripts', 'strings.mjs'), 'scripts/strings.mjs');
    const firstImport = text.search(/^import\s/m);
    assert.ok(firstImport > 0, 'scripts/strings.mjs 要有 import，而且前面要有檔頭註解');
    const head = text.slice(0, firstImport);
    for (const word of ['npm run strings', '--from', '--copy', '--out', 'strings/']) {
        assert.ok(head.includes(word), `scripts/strings.mjs 的檔頭註解要寫到「${word}」`);
    }
});

test('B7.4 結構：這一段新加的測試與小工具檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of [...TESTS, 'tests/structure-b7.test.js']) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        const head = text.split('\n').filter((row) => row.startsWith('//')).slice(0, 5).join('\n');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.ok(/4-b7|B7/.test(head), `${rel}：檔頭的說明要寫到 4-b7 或 B7`);
    }
    for (const rel of TESTS) {
        const src = code(fs.readFileSync(path.join(SITE, rel), 'utf8'));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：真的資料要從環境變數給`);
        }
    }
});
