// 4-b12 的結構（B12.1～B12.3 的邊界與文件）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b12」。
//
// 量什麼：
//   package.json：scripts["fallback-fonts"] ＝ "node scripts/fallback-fonts.mjs"、scripts["fallback-sweep"] ＝ "node scripts/fallback-sweep.mjs"；
//     套件只在白名單（helpers.js 有 assertPackageWhitelist 就用它，沒有就是不准有任何套件）；**Playwright 不在 package.json 裡**（dependencies、devDependencies、optionalDependencies 都沒有）。
//   lib/fallback-fonts.js、lib/fallback-sweep.js：JSDoc（@param、@returns）、只 import node: 與 ./（純函式，不碰瀏覽器）。
//   scripts/fallback-fonts.mjs、scripts/fallback-sweep.mjs：靜態 import 只准 node: 與 ../lib/<檔>.js；**Playwright 的例外**：只能用 createRequire 從
//     --playwright 或環境變數 SITE_PLAYWRIGHT 給的路徑載入（檔裡要寫到 SITE_PLAYWRIGHT 與 --playwright），不准 import 'playwright'、不准寫死 clipper/node_modules；
//     沒有寫死的本機路徑（/Users/、GPTPlugins、scratchpad、clipper/、design/、../..）；檔頭註解（第一個 import 之前）寫到怎麼跑。
//   README.md 有回退字型的一節（## 標題寫到 fallback-fonts）：寫到 npm run fallback-fonts、npm run fallback-sweep、SITE_PLAYWRIGHT、
//     什麼時候要重跑（字型、字級、字重、文案、換機器）、不同機器不保證位元組相同（Arial）、85%～120%；沒有開發流程的字眼。
//   〔檢查員第 1 輪〕README.md 那一節講「不同機器」的句子不准寫沒量過的百分比數字（有百分比就要同一句寫明「未量」或「沒量」）。
//   這一段新加的測試與小工具第一行寫到 4-b12 或 B12、不往 homepage/site/ 外面讀；golden.css 存在。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12 結構"
//   node --test tests/structure-b12.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as helpers from './helpers.js';

const { SITE } = helpers;
const LIBS = { 'fallback-fonts.js': ['groupGlyphs', 'unicodeRange', 'fontFaceRule', 'scaleFaces', 'renderFallbackCss', 'charsFromFontsCss'], 'fallback-sweep.js': ['compareBlocks', 'parseKRange'] };
const SCRIPTS = { 'fallback-fonts.mjs': 'fallback-fonts', 'fallback-sweep.mjs': 'fallback-sweep' };
const TESTS = ['tests/fallback-fixture.js', 'tests/fallback-fonts-lib.test.js', 'tests/fallback-check.test.js', 'tests/fallback-fonts-cli.test.js', 'tests/fallback-sweep.test.js', 'tests/static-site.test.js', 'tests/structure-b12.test.js'];

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function specifiers(text) {
    const src = code(text);
    const found = [];
    for (const re of [/\bimport\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\bexport\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g]) {
        for (const m of src.matchAll(re)) found.push(m[1]);
    }
    return found;
}

function read(rel) {
    const file = path.join(SITE, rel);
    if (!fs.existsSync(file)) assert.fail(`缺 ${rel}（後端之後實作）`);
    return fs.readFileSync(file, 'utf8');
}

test('B12 結構：package.json 有 npm run fallback-fonts、fallback-sweep；套件只在白名單；Playwright 不在 package.json', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const [file, name] of Object.entries(SCRIPTS)) assert.equal(pkg.scripts && pkg.scripts[name], `node scripts/${file}`, `package.json 的 scripts["${name}"] 要是 "node scripts/${file}"`);
    if (typeof helpers.assertPackageWhitelist === 'function') helpers.assertPackageWhitelist(pkg);
    else {
        assert.equal(pkg.dependencies, undefined, '後端分支：package.json 不准有 dependencies');
        assert.equal(pkg.devDependencies, undefined, '後端分支：package.json 不准有 devDependencies');
    }
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        for (const name of Object.keys(pkg[key] || {})) assert.ok(!/playwright/i.test(name), `Playwright 不能進 package.json（${key} 有 ${name}）：用 --playwright 或 SITE_PLAYWRIGHT 指定路徑`);
    }
});

test('B12 結構：兩支 lib 檔頭用 JSDoc 寫收什麼、給什麼，匯出該有的函式，只用 node: 與 ./', () => {
    for (const [file, names] of Object.entries(LIBS)) {
        const text = read(`lib/${file}`);
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0 && text.slice(0, firstExport).includes('/**'), `lib/${file}：第一個 export 之前要有 JSDoc`);
        assert.match(text, /@param\b/, `lib/${file}：JSDoc 要寫 @param`);
        assert.match(text, /@returns?\b/, `lib/${file}：JSDoc 要寫 @returns`);
        for (const name of names) assert.match(code(text), new RegExp(`\\bexport\\s+function\\s+${name}\\b|\\bexport\\s*\\{[^}]*\\b${name}\\b`), `lib/${file} 要匯出 ${name}`);
        for (const spec of specifiers(text)) assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `lib/${file} import 了「${spec}」：只准 node: 內建與 ./`);
        assert.doesNotMatch(code(text), /playwright|createRequire/i, `lib/${file} 是純函式，不碰瀏覽器`);
    }
});

test('B12 結構：兩支命令只 import node: 與 ../lib/；Playwright 只能從 --playwright 或 SITE_PLAYWRIGHT 的路徑用 createRequire 載入；沒有寫死的本機路徑', () => {
    const outside = [/\/Users\//, /GPTPlugins/, /scratchpad/, /\bclipper\//, /\bdesign\//, /\brelease\//, /\btutorial\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/, /node_modules/];
    for (const file of Object.keys(SCRIPTS)) {
        const text = read(`scripts/${file}`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || /^\.\.\/lib\/[^/]+\.js$/.test(spec), `scripts/${file} import 了「${spec}」：只准 node: 內建與 ../lib/<檔>.js（Playwright 用 createRequire 從給的路徑載入）`);
        }
        const src = code(text);
        assert.match(src, /createRequire/, `scripts/${file}：Playwright 用 createRequire 從給的路徑載入`);
        assert.match(text, /SITE_PLAYWRIGHT/, `scripts/${file}：要認環境變數 SITE_PLAYWRIGHT`);
        assert.match(text, /--playwright|['"]playwright['"]\s*:/, `scripts/${file}：要認參數 --playwright`);
        assert.doesNotMatch(src, /createRequire\([^)]*\)\(\s*['"]playwright['"]\s*\)|from\s+['"]playwright['"]/, `scripts/${file}：不准直接載入套件名 playwright（要從給的路徑）`);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `scripts/${file} 寫死了本機路徑「${hit && hit[0]}」`);
        }
        const head = text.slice(0, text.search(/^import\s/m));
        assert.ok(head.includes(`npm run ${SCRIPTS[file]}`), `scripts/${file} 的檔頭註解要寫到 npm run ${SCRIPTS[file]}`);
        assert.ok(head.includes('SITE_PLAYWRIGHT'), `scripts/${file} 的檔頭註解要寫到 SITE_PLAYWRIGHT`);
    }
    for (const file of Object.keys(LIBS)) {
        const src = code(read(`lib/${file}`));
        for (const re of outside) assert.equal(src.match(re), null, `lib/${file} 寫死了本機路徑`);
    }
});

test('B12 結構：README.md 有回退字型的一節：怎麼跑、Playwright 怎麼給、何時重跑、換機器不保證相同、85%～120%；沒有開發流程的字眼', () => {
    const readme = read('README.md');
    const at = readme.search(/^##\s.*fallback-fonts/m);
    assert.ok(at >= 0, 'README.md 要有一節（## 標題寫到 fallback-fonts）');
    const next = readme.indexOf('\n## ', at + 1);
    const section = readme.slice(at, next < 0 ? undefined : next);
    for (const word of ['npm run fallback-fonts', 'npm run fallback-sweep', 'SITE_PLAYWRIGHT', '--out', '字型', '字級', '字重', '文案', '換機器', 'Arial', '85%', '120%']) {
        assert.ok(section.includes(word), `README.md 的 fallback-fonts 那一節要寫到「${word}」`);
    }
    assert.match(section, /重跑/, '要寫什麼時候要重跑');
    assert.match(section, /不保證|不一定/, '要寫不同機器不保證位元組相同');
    for (const word of ['派工', '後端', '測試工程師', '檢查員', '目標檔', '4-b12', 'B12']) assert.ok(!section.includes(word), `README.md 的 fallback-fonts 那一節不能有開發流程的字眼「${word}」`);
});

test('B12 結構：README.md 回退字型那一節講不同機器的句子，不寫沒量過的百分比（有就要寫明未量）', () => {
    const readme = read('README.md');
    const at = readme.search(/^##\s.*fallback-fonts/m);
    assert.ok(at >= 0, 'README.md 要有一節（## 標題寫到 fallback-fonts）');
    const next = readme.indexOf('\n## ', at + 1);
    const section = readme.slice(at, next < 0 ? undefined : next);
    const sentences = section.split(/。|\n/).filter((s) => /機器/.test(s));
    assert.ok(sentences.length > 0, '防呆：那一節要有講到機器的句子');
    for (const sentence of sentences) {
        if (/\d+(?:\.\d+)?\s*[%％]/.test(sentence)) {
            assert.match(sentence, /未量|沒量|沒有量/, `講不同機器的句子寫了百分比，要寫明是「未量」（沒量過的數字不能當事實寫）：${sentence.trim()}`);
        }
    }
});

test('B12 結構：這一段新加的測試與小工具檔頭有說明、不往 homepage/site/ 外面讀；golden.css 在', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b12|B12/, `${rel}：第一行要寫到 4-b12 或 B12`);
        if (rel.endsWith('structure-b12.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」`);
        }
    }
    assert.ok(fs.existsSync(path.join(SITE, 'tests', 'fixtures', 'fallback-fonts', 'golden.css')), '缺 tests/fixtures/fallback-fonts/golden.css');
});
