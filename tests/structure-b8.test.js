// 4-b8 的結構（B8.2 邊界：07 區「AI 開始打字」的資料轉換）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b8」。
//
// 量什麼：
//   B8.2 package.json：scripts["agent-data"] ＝ "node scripts/agent-data.mjs"；套件只在白名單（helpers.js 有 assertPackageWhitelist 就用它，沒有就是不准有任何套件）。
//   B8.2 lib/agent.js：第一個 export 之前有 JSDoc、寫了 @param 與 @returns；匯出 parseAgentSource；只 import node: 與 ./。
//   B8.3 lib/agent.js、scripts/agent-data.mjs 去掉註解之後沒有 eval、Function、node:vm、動態 import()、require —— 來源要當資料讀，不能執行。
//   B8.2 scripts/agent-data.mjs：只 import node: 與 ../lib/<檔>.js；import ../lib/agent.js、用 parseAgentSource、不自己定義；沒有寫死的外部路徑；
//        檔頭註解（第一個 import 之前）寫到 npm run agent-data、--from、--out、agent-{zh,en,ja}.js、data/、重跑。
//   B8.2 網站 README.md 有 agent-data 的一節（## 標題寫到 agent-data）：寫到 npm run agent-data、--from、agent-{zh,en,ja}.js（或 agent-zh.js）、data/agent.、
//        教學片、重跑（什麼時候要重跑）；那一節沒有開發流程的字眼（派工、後端、測試工程師、檢查員、目標檔、4-b8、B8）。
//   這一段新加的測試與小工具第一行寫到 4-b8 或 B8、不往 homepage/site/ 外面讀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B8.2 結構|B8.3 結構"
//   node --test tests/structure-b8.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as helpers from './helpers.js';

const { SITE } = helpers;
const TESTS = ['tests/agent-fixture.js', 'tests/agent-data-cli.test.js', 'tests/agent-parse.test.js', 'tests/agent-real.test.js', 'tests/agent-data-edge.test.js', 'tests/structure-b8.test.js'];

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

function read(rel) {
    const file = path.join(SITE, rel);
    if (!fs.existsSync(file)) assert.fail(`缺 ${rel}（後端之後實作）`);
    return fs.readFileSync(file, 'utf8');
}

test('B8.2 結構：package.json 有 npm run agent-data，套件只在白名單', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.scripts && pkg.scripts['agent-data'], 'node scripts/agent-data.mjs', 'package.json 的 scripts["agent-data"] 要是 "node scripts/agent-data.mjs"');
    if (typeof helpers.assertPackageWhitelist === 'function') {
        helpers.assertPackageWhitelist(pkg);
    } else {
        assert.equal(pkg.dependencies, undefined, '後端分支：package.json 不准有 dependencies');
        assert.equal(pkg.devDependencies, undefined, '後端分支：package.json 不准有 devDependencies');
    }
});

test('B8.2 結構：lib/agent.js 檔頭用 JSDoc 寫收什麼、給什麼，匯出 parseAgentSource，只用 node: 與 ./', () => {
    const text = read('lib/agent.js');
    const firstExport = text.search(/^export\s/m);
    assert.ok(firstExport >= 0, 'lib/agent.js 沒有 export');
    assert.ok(text.slice(0, firstExport).includes('/**'), 'lib/agent.js：第一個 export 之前要有 JSDoc（/** … */）');
    assert.match(text, /@param\b/, 'lib/agent.js：JSDoc 要寫 @param');
    assert.match(text, /@returns?\b/, 'lib/agent.js：JSDoc 要寫 @returns');
    assert.match(code(text), /\bexport\s+function\s+parseAgentSource\b|\bexport\s*\{[^}]*\bparseAgentSource\b/, 'lib/agent.js 要匯出 parseAgentSource');
    for (const spec of specifiers(text)) assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `lib/agent.js import 了「${spec}」：只准 node: 內建與 ./`);
});

test('B8.3 結構：讀來源不執行 —— lib/agent.js、scripts/agent-data.mjs 沒有 eval、Function、node:vm、動態 import()、require', () => {
    const forbidden = [[/\beval\s*\(/, 'eval('], [/\bnew\s+Function\b|\bFunction\s*\(/, 'Function'], [/node:vm|['"]vm['"]/, 'node:vm'], [/\bimport\s*\(/, '動態 import()'], [/\brequire\s*\(/, 'require(']];
    for (const rel of ['lib/agent.js', 'scripts/agent-data.mjs']) {
        const src = code(read(rel));
        for (const [re, what] of forbidden) assert.doesNotMatch(src, re, `${rel} 不能用 ${what} —— 來源（tutorial/agent-*.js）要當資料讀，不能執行`);
    }
});

test('B8.2 結構：scripts/agent-data.mjs 只 import node: 與 ../lib/，用 lib 的 parseAgentSource、不自己定義；沒有寫死的外部路徑', () => {
    const text = read('scripts/agent-data.mjs');
    for (const spec of specifiers(text)) assert.ok(spec.startsWith('node:') || /^\.\.\/lib\/[^/]+\.js$/.test(spec), `scripts/agent-data.mjs import 了「${spec}」：只准 node: 內建與 ../lib/<檔>.js`);
    assert.ok(specifiers(text).includes('../lib/agent.js'), 'scripts/agent-data.mjs 要 import ../lib/agent.js');
    assert.match(code(text), /\bparseAgentSource\b/, 'scripts/agent-data.mjs 要用 parseAgentSource');
    assert.doesNotMatch(code(text), /function\s+parseAgentSource\b|\bparseAgentSource\s*=\s*(\(|function|async)/, '不要自己定義 parseAgentSource');
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /ArticleCreator/, /\/Users\//, /scratchpad/, /GPTPlugins/, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of ['scripts/agent-data.mjs', 'lib/agent.js']) {
        const src = code(read(rel));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 寫死了外部路徑「${hit && hit[0]}」：來源要從 --from 給`);
        }
    }
    const head = text.slice(0, text.search(/^import\s/m));
    for (const word of ['npm run agent-data', '--from', '--out', 'data/', '重跑']) assert.ok(head.includes(word), `scripts/agent-data.mjs 的檔頭註解要寫到「${word}」`);
    assert.ok(/agent-\{zh,en,ja\}\.js|agent-zh\.js/.test(head), 'scripts/agent-data.mjs 的檔頭註解要寫到來源檔名（agent-{zh,en,ja}.js）');
});

test('B8.2 結構：網站 README.md 有 agent-data 的一節：怎麼跑、來源在哪、什麼時候要重跑；沒有開發流程的字眼', () => {
    const readme = read('README.md');
    const at = readme.search(/^##\s.*agent-data/m);
    assert.ok(at >= 0, 'README.md 要有一節（## 標題寫到 agent-data）');
    const next = readme.indexOf('\n## ', at + 1);
    const section = readme.slice(at, next < 0 ? undefined : next);
    for (const word of ['npm run agent-data', '--from', 'data/agent.', '教學片', '重跑']) assert.ok(section.includes(word), `README.md 的 agent-data 那一節要寫到「${word}」`);
    assert.ok(/agent-\{zh,en,ja\}\.js|agent-zh\.js/.test(section), 'README.md 的 agent-data 那一節要寫到來源檔名（agent-{zh,en,ja}.js）');
    for (const word of ['派工', '後端', '測試工程師', '檢查員', '目標檔', '4-b8', 'B8']) assert.ok(!section.includes(word), `README.md 的 agent-data 那一節不能有開發流程的字眼「${word}」`);
});

test('B8.2 結構：這一段新加的測試與小工具檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b8|B8/, `${rel}：第一行要寫到 4-b8 或 B8`);
        if (rel.endsWith('structure-b8.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：真的資料要從 SITE_REAL_TUTORIAL 給`);
        }
    }
    for (const lang of ['zh', 'en', 'ja']) {
        const first = fs.readFileSync(path.join(SITE, 'tests', 'fixtures', 'agent-tutorial', `agent-${lang}.js`), 'utf8').split('\n')[0];
        assert.match(first, /4-b8/, `fixtures/agent-tutorial/agent-${lang}.js 第一行要寫到 4-b8`);
    }
});
