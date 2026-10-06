// homepage/site/ 的結構與命令（目標檔 4-b1 的 B1.8）。只看檔案，不執行模組。
//
// 量什麼：
//   B1.8 package.json：type 是 module、private 是 true、scripts.test 走 scripts/test.mjs（不寫萬用字元、不寫 node --test <目錄>）。
//        scripts/test.mjs 自己列檔案清單（readdirSync＋node:path），不靠 shell 展開。
//        lib/ 有 changelog.js、news.js、links.js、content.js，另外至少一支共用的；changelog、news、links 三支都 import 那支共用的
//        （相對路徑、不是彼此）—— 一個模組一件事，共用的讀檔與接住錯誤放另一支。
//        lib/ 每支 .js 在第一個 export 之前有 JSDoc（/** … */），而且檔裡寫了 @param 與 @returns（收什麼、給什麼）。
//        lib/ 只 import node: 內建與相對路徑（不加任何套件），不用 require。
//        測試在 tests/、fixture 在 tests/fixtures/。
//        （Node 20 與 22 都跑得動、Windows cmd 跑得動：這支量不到，要在那幾個環境實際跑 npm test。）
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B1.8"
//   node --test tests/structure.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';

const LIB = path.join(SITE, 'lib');
const PARSERS = ['changelog.js', 'news.js', 'links.js'];
const NAMED = [...PARSERS, 'content.js'];

function libFiles() {
    if (!fs.existsSync(LIB)) assert.fail('缺 lib/（後端之後實作）');
    return fs.readdirSync(LIB).filter((name) => name.endsWith('.js')).sort();
}

// 去掉註解，免得註解裡寫到的 import 被當成真的
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

test('B1.8 package.json：type module、private、npm test 走 scripts/test.mjs', () => {
    const file = path.join(SITE, 'package.json');
    assert.ok(fs.existsSync(file), '缺 package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(pkg.type, 'module', 'type 要是 module');
    assert.equal(pkg.private, true, 'private 要是 true');
    const cmd = pkg.scripts?.test;
    assert.equal(typeof cmd, 'string', '要有 scripts.test');
    assert.match(cmd, /scripts\/test\.mjs/, 'npm test 要走 scripts/test.mjs');
    assert.doesNotMatch(cmd, /\*/, 'npm test 不能寫萬用字元（Windows cmd 不展開）');
    assert.doesNotMatch(cmd, /--test\s+\S*tests\/?(\s|$)/, 'npm test 不能寫 node --test <目錄>（Node 22 不掃目錄）');
});

test('B1.8 scripts/test.mjs 自己列檔案清單', () => {
    const file = path.join(SITE, 'scripts', 'test.mjs');
    assert.ok(fs.existsSync(file), '缺 scripts/test.mjs');
    const src = code(fs.readFileSync(file, 'utf8'));
    assert.match(src, /readdirSync/, '用 readdirSync 自己列 tests/ 底下的檔');
    assert.match(src, /node:path/, '路徑用 node:path 接');
    assert.match(src, /'--test'/, '把列好的檔交給 node --test');
});

test('B1.8 lib/ 一個模組一件事：changelog、news、links、content 各一支，另有共用的一支', () => {
    const files = libFiles();
    for (const name of NAMED) assert.ok(files.includes(name), `缺 lib/${name}`);
    const shared = files.filter((name) => !NAMED.includes(name));
    assert.ok(shared.length >= 1, `lib/ 要有一支共用的（讀檔、去註解、切區塊、做壞紀錄），現在只有 ${files.join('、')}`);
    for (const name of PARSERS) {
        const used = specifiers(fs.readFileSync(path.join(LIB, name), 'utf8'))
            .filter((s) => s.startsWith('.'))
            .map((s) => path.basename(s));
        assert.ok(used.some((s) => shared.includes(s)), `lib/${name} 要 import 共用的那支（${shared.join('、')}），現在 import 了：${used.join('、') || '（沒有）'}`);
        for (const other of PARSERS.filter((p) => p !== name)) {
            assert.ok(!used.includes(other), `lib/${name} 不要 import lib/${other}（共用的東西放共用那支）`);
        }
    }
});

test('B1.8 lib/ 每支檔頭用 JSDoc 寫收什麼、給什麼', () => {
    for (const name of libFiles()) {
        const text = fs.readFileSync(path.join(LIB, name), 'utf8');
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0, `lib/${name} 沒有 export`);
        assert.ok(text.slice(0, firstExport).includes('/**'), `lib/${name}：第一個 export 之前要有 JSDoc（/** … */）`);
        assert.match(text, /@param\b/, `lib/${name}：JSDoc 要寫 @param（收什麼）`);
        assert.match(text, /@returns?\b/, `lib/${name}：JSDoc 要寫 @returns（給什麼）`);
    }
});

test('B1.8 lib/ 只用 Node 內建（node:）與相對路徑，不加套件', () => {
    for (const name of libFiles()) {
        const text = fs.readFileSync(path.join(LIB, name), 'utf8');
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `lib/${name} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'),
                `lib/${name} import 了「${spec}」：只准 node: 內建與相對路徑`);
        }
    }
});

test('B1.8 測試在 tests/、fixture 在 tests/fixtures/', () => {
    assert.ok(fs.existsSync(path.join(SITE, 'tests')), '缺 tests/');
    assert.ok(fs.existsSync(path.join(SITE, 'tests', 'fixtures', 'content', 'links.md')), '缺 tests/fixtures/content/');
});
