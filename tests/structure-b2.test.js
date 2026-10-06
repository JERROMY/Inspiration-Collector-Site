// 4-b2 的結構（目標檔 4-b2 的 B2.6）。只看檔案，不執行模組。
//
// 量什麼：
//   B2.6 lib/bind-tail.js、lib/chapters.js 都在；第一個 export 之前有 JSDoc（/** … */），檔裡寫了 @param 與 @returns。
//        兩支只 import node: 內建與相對路徑、不用 require。
//        scripts/chapters.mjs 薄薄一層：只 import node: 內建與 ../lib/chapters.js（不 import 別的 lib、不 import node:vm），
//        呼叫 loadChaptersScript 與 buildChapters；自己沒有解析邏輯（程式裡沒有 \d 的正規表示式、不碰 TUTORIAL_CHAPTERS、
//        沒有自己的 parseTimetable／buildChapters／loadChaptersScript 定義）。
//        檔頭註解寫「教學片重算過就要重跑」與怎麼跑（node scripts/chapters.mjs）。
//        package.json 的套件只在白名單（4-f1 的 F1.7 改的：dependencies 只准 next、react、react-dom，見 helpers.js 的 assertPackageWhitelist）。
//        假資料在 tests/fixtures/chapters/（測試與 fixture 分開）。
//   （4-b1 的測試不受影響、Node 20 與 22 都過：這支量不到，要實際跑整套 npm test。）
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B2.6"
//   node --test tests/structure-b2.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const LIB = path.join(SITE, 'lib');
const CLI = path.join(SITE, 'scripts', 'chapters.mjs');
const MODULES = ['bind-tail.js', 'chapters.js'];

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

test('B2.6 lib/bind-tail.js、lib/chapters.js 都在，檔頭用 JSDoc 寫收什麼、給什麼', () => {
    for (const name of MODULES) {
        const text = read(path.join(LIB, name), `lib/${name}`);
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0, `lib/${name} 沒有 export`);
        assert.ok(text.slice(0, firstExport).includes('/**'), `lib/${name}：第一個 export 之前要有 JSDoc（/** … */）`);
        assert.match(text, /@param\b/, `lib/${name}：JSDoc 要寫 @param（收什麼）`);
        assert.match(text, /@returns?\b/, `lib/${name}：JSDoc 要寫 @returns（給什麼）`);
    }
});

test('B2.6 lib/bind-tail.js、lib/chapters.js 只用 Node 內建與相對路徑', () => {
    for (const name of MODULES) {
        const text = read(path.join(LIB, name), `lib/${name}`);
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `lib/${name} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'), `lib/${name} import 了「${spec}」：只准 node: 內建與相對路徑`);
        }
    }
});

test('B2.6 scripts/chapters.mjs 薄薄一層：只讀參數、呼叫 lib/chapters.js、寫檔', () => {
    const text = read(CLI, 'scripts/chapters.mjs');
    const src = code(text);
    const specs = specifiers(text);
    for (const spec of specs) {
        assert.ok(spec.startsWith('node:') || spec === '../lib/chapters.js', `scripts/chapters.mjs import 了「${spec}」：只准 node: 內建與 ../lib/chapters.js`);
    }
    assert.ok(specs.includes('../lib/chapters.js'), 'scripts/chapters.mjs 要 import ../lib/chapters.js');
    assert.ok(!specs.includes('node:vm'), 'scripts/chapters.mjs 不跑 vm（那是 lib/chapters.js 的事）');
    assert.match(src, /\bloadChaptersScript\s*\(/, '要呼叫 loadChaptersScript');
    assert.match(src, /\bbuildChapters\s*\(/, '要呼叫 buildChapters');
    assert.doesNotMatch(src, /\bfunction\s+(parseTimetable|buildChapters|loadChaptersScript)\b|\b(const|let)\s+(parseTimetable|buildChapters|loadChaptersScript)\s*=/,
        'scripts/chapters.mjs 不要自己定義轉換函式');
    assert.doesNotMatch(src, /\\d/, 'scripts/chapters.mjs 不要自己解析時間（程式裡出現了 \\d）');
    assert.doesNotMatch(src, /TUTORIAL_CHAPTERS/, 'scripts/chapters.mjs 不要自己碰 TUTORIAL_CHAPTERS（交給 loadChaptersScript）');
});

test('B2.6 scripts/chapters.mjs 檔頭寫「教學片重算過就要重跑」與怎麼跑', () => {
    const text = read(CLI, 'scripts/chapters.mjs');
    const head = text.slice(0, Math.max(0, text.search(/^import\s/m)));
    assert.ok(head.length > 0, 'scripts/chapters.mjs：import 之前要有檔頭註解');
    assert.match(head, /重算/, '檔頭要寫「教學片重算過就要重跑」');
    assert.match(head, /重跑/, '檔頭要寫「教學片重算過就要重跑」');
    assert.match(head, /node\s+\S*chapters\.mjs/, '檔頭要寫怎麼跑（node scripts/chapters.mjs …）');
});

test('B2.6 package.json 的套件只在白名單（F1.7：next、react、react-dom；後端程式不用套件由 import 檢查守）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assertPackageWhitelist(pkg);
});

test('B2.6 假資料在 tests/fixtures/chapters/', () => {
    for (const rel of ['project/tutorial/chapters.js', 'project/tutorial/preview/timetable-zh.txt', 'small/tutorial/chapters.js']) {
        assert.ok(fs.existsSync(path.join(SITE, 'tests', 'fixtures', 'chapters', ...rel.split('/'))), `缺 tests/fixtures/chapters/${rel}`);
    }
});
