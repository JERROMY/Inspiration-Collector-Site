// 4-b6 的結構（字型授權、拉丁字型瘦身、預算、圖片 WebP；派工 2026-10-02 第三版）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b6」。
//
// 量什麼：
//   B6.5 package.json：scripts.fonts ＝ "node scripts/fonts.mjs"、scripts["fonts:budget"] ＝ "node scripts/fonts-budget.mjs"、scripts.images ＝ "node scripts/images.mjs"；
//        沒有 scripts["fonts:subset"]（第二版的做法作廢）；套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//   B6.5 lib/font-text.js（匯出 charsOf、isCjk）、lib/woff2-cmap.js（匯出 woff2CodePoints）：第一個 export 之前有 JSDoc、寫了 @param 與 @returns；只 import node: 與 ./。
//   B6.5 三支命令只 import node: 內建與 ../lib/<檔>.js；fonts.mjs 呼叫 charsOf、isCjk；fonts-budget.mjs 呼叫 charsOf、isCjk、woff2CodePoints；都不自己定義這幾個函式。
//   B6.5 三支命令與兩支 lib 去掉註解之後沒有寫死的外部路徑：design/、release/、tutorial/、clipper/、ArticleCreator、design_system_nox、/Users/、homebrew、venv、scratchpad、
//        ../..、'..', '..'（來源一律從參數與環境變數給；之後搬進公開 repo 也一樣）。
//   B6.5 三支命令的檔頭註解（第一個 import 之前）寫到怎麼跑：fonts.mjs —— npm run fonts、--from、--text、PYTHON、fontTools、instancer；
//        fonts-budget.mjs —— npm run fonts:budget、--text、150；images.mjs —— npm run images、--from、CWEBP、無損、有損。
//   B6.5 這一段新加的測試與小工具：第一行是 // 說明、檔頭寫到 4-b6 或 B6；去掉註解之後不往 homepage/site/ 外面讀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.5 結構"
//   node --test tests/structure-b6.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const LIBS = { 'font-text.js': ['charsOf', 'isCjk'], 'woff2-cmap.js': ['woff2CodePoints'] };
const SCRIPTS = { 'fonts.mjs': 'fonts', 'fonts-budget.mjs': 'fonts:budget', 'images.mjs': 'images' };
const TESTS = [
    'tests/b6-fixture.js', 'tests/b6-font-fixture.js', 'tests/fixtures/fake-tools/pixels.js', 'tests/fixtures/fake-tools/python.mjs',
    'tests/font-text.test.js', 'tests/woff2-cmap.test.js', 'tests/font-budget-cli.test.js', 'tests/fonts-cli.test.js', 'tests/fonts-real.test.js',
    'tests/fonts-files.test.js', 'tests/images-cli.test.js',
];

// 去掉註解，免得註解裡寫到的東西被當成真的（跟 structure-b4.test.js 同一個寫法）
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

test('B6.5 結構：package.json 有 npm run fonts、fonts:budget、images，沒有 fonts:subset、套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(read(path.join(SITE, 'package.json'), 'package.json'));
    for (const [file, name] of Object.entries(SCRIPTS)) {
        assert.equal(pkg.scripts && pkg.scripts[name], `node scripts/${file}`, `package.json 的 scripts["${name}"] 要是 "node scripts/${file}"`);
    }
    assert.equal(pkg.scripts && pkg.scripts['fonts:subset'], undefined, '不要 fonts:subset（中文子集的做法作廢了）');
    assertPackageWhitelist(pkg);
});

test('B6.5 結構：lib/font-text.js、lib/woff2-cmap.js 檔頭用 JSDoc 寫收什麼、給什麼，匯出該有的函式，只用 Node 內建與 ./', () => {
    for (const [file, names] of Object.entries(LIBS)) {
        const text = read(path.join(SITE, 'lib', file), `lib/${file}`);
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0, `lib/${file} 沒有 export`);
        assert.ok(text.slice(0, firstExport).includes('/**'), `lib/${file}：第一個 export 之前要有 JSDoc（/** … */）`);
        assert.match(text, /@param\b/, `lib/${file}：JSDoc 要寫 @param（收什麼）`);
        assert.match(text, /@returns?\b/, `lib/${file}：JSDoc 要寫 @returns（給什麼）`);
        for (const name of names) {
            assert.match(code(text), new RegExp(`\\bexport\\s+function\\s+${name}\\b|\\bexport\\s*\\{[^}]*\\b${name}\\b`), `lib/${file} 要匯出 ${name}`);
        }
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `lib/${file} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `lib/${file} import 了「${spec}」：只准 node: 內建與 ./`);
        }
    }
});

test('B6.5 結構：三支命令只 import node: 內建與 ../lib/；收字、判斷中日文、讀 cmap 用 lib 的函式、不自己定義', () => {
    for (const file of Object.keys(SCRIPTS)) {
        const text = read(path.join(SITE, 'scripts', file), `scripts/${file}`);
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `scripts/${file} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || /^\.\.\/lib\/[^/]+\.js$/.test(spec), `scripts/${file} import 了「${spec}」：只准 node: 內建與 ../lib/<檔>.js`);
        }
    }
    const uses = {
        'fonts.mjs': { '../lib/font-text.js': ['charsOf', 'isCjk'] },
        'fonts-budget.mjs': { '../lib/font-text.js': ['charsOf', 'isCjk'], '../lib/woff2-cmap.js': ['woff2CodePoints'] },
    };
    for (const [file, libs] of Object.entries(uses)) {
        const text = read(path.join(SITE, 'scripts', file), `scripts/${file}`);
        for (const [spec, names] of Object.entries(libs)) {
            assert.ok(specifiers(text).includes(spec), `scripts/${file} 要 import ${spec}`);
            for (const name of names) {
                assert.match(code(text), new RegExp(`\\b${name}\\b`), `scripts/${file} 要用到 ${name}`);
                assert.doesNotMatch(code(text), new RegExp(`function\\s+${name}\\b|\\b${name}\\s*=\\s*(\\(|function|async)`), `scripts/${file} 不要自己定義 ${name}（用 lib 的）`);
            }
        }
    }
});

test('B6.5 結構：三支命令與兩支 lib 沒有寫死的外部路徑', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /ArticleCreator/, /design_system_nox/, /\/Users\//, /homebrew/i, /\bvenv\b/, /scratchpad/,
        /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of [...Object.keys(SCRIPTS).map((f) => `scripts/${f}`), ...Object.keys(LIBS).map((f) => `lib/${f}`)]) {
        const src = code(read(path.join(SITE, rel), rel));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 寫死了外部路徑「${hit && hit[0]}」：來源要從參數或環境變數給`);
        }
    }
});

test('B6.5 結構：三支命令的檔頭註解寫到怎麼跑', () => {
    const words = {
        'fonts.mjs': ['npm run fonts', '--from', '--text', 'PYTHON', 'fontTools', 'instancer'],
        'fonts-budget.mjs': ['npm run fonts:budget', '--text', '150'],
        'images.mjs': ['npm run images', '--from', 'CWEBP', '無損', '有損'],
    };
    for (const [file, list] of Object.entries(words)) {
        const text = read(path.join(SITE, 'scripts', file), `scripts/${file}`);
        const firstImport = text.search(/^import\s/m);
        assert.ok(firstImport > 0, `scripts/${file} 要有 import，而且前面要有檔頭註解`);
        const head = text.slice(0, firstImport);
        for (const word of list) assert.ok(head.includes(word), `scripts/${file} 的檔頭註解要寫到「${word}」`);
    }
});

test('B6.5 結構：這一段新加的測試與小工具檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of [...TESTS, 'tests/structure-b6.test.js']) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        const head = text.split('\n').filter((row) => row.startsWith('//')).slice(0, 5).join('\n');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.ok(/4-b6|B6/.test(head), `${rel}：檔頭的說明要寫到 4-b6 或 B6`);
    }
    // 這支自己的字串裡就寫著要找的字，不掃自己。fake-tools/python.mjs 要 import ../../b6-font-fixture.js（在 tests/ 裡面），不算往外走
    for (const rel of TESTS) {
        let src = code(fs.readFileSync(path.join(SITE, rel), 'utf8'));
        if (rel.endsWith('python.mjs')) src = src.replace("'../../b6-font-fixture.js'", "''");
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：之後搬進公開 repo 就讀不到了`);
        }
    }
});
