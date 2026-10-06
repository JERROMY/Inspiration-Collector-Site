// 4-b13 的結構（B13.2 邊界與文件：07 大綱圖裁切）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b13」。
//
// 量什麼：
//   package.json：scripts.images 照舊是 "node scripts/images.mjs"；套件只在白名單（helpers.js 有 assertPackageWhitelist 就用它，沒有就是不准有任何套件）。
//   lib/images.js、lib/images-run.js 只 import node: 與 ./；scripts/images.mjs 只 import node: 與 ../lib/<檔>.js；裁切框的數字不寫死在程式裡（新框 297／140／1017／566、277／137／781／805／657 與舊框 1010、143、774、798 都不准出現）。
//   scripts/images.mjs 的檔頭註解寫到 --config、images.config.json、裁切。
//   README.md 的「圖片」那一節寫到：裁切、images.config.json、--config、crop、什麼時候要重跑；沒有開發流程的字眼。
//   這一段新加的測試與小工具第一行寫到 4-b13 或 B13、不往 homepage/site/ 外面讀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B13.2 結構"
//   node --test tests/structure-b13.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as helpers from './helpers.js';

const { SITE } = helpers;
const TESTS = ['tests/images-crop-fixture.js', 'tests/images-crop.test.js', 'tests/images-crop-real.test.js', 'tests/fixtures/images-crop/measure-visible.mjs', 'tests/structure-b13.test.js'];

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

const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');

test('B13.2 結構：package.json 的 images 照舊、套件只在白名單', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.scripts && pkg.scripts.images, 'node scripts/images.mjs');
    if (typeof helpers.assertPackageWhitelist === 'function') helpers.assertPackageWhitelist(pkg);
    else {
        assert.equal(pkg.dependencies, undefined, '後端分支：package.json 不准有 dependencies');
        assert.equal(pkg.devDependencies, undefined, '後端分支：package.json 不准有 devDependencies');
    }
});

test('B13.2 結構：lib 只用 node: 與 ./、命令只用 node: 與 ../lib/；裁切框的數字不寫死在程式裡；命令檔頭寫到 --config', () => {
    for (const rel of ['lib/images.js', 'lib/images-run.js']) {
        for (const spec of specifiers(read(rel))) assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `${rel} import 了「${spec}」：只准 node: 與 ./`);
    }
    const script = read('scripts/images.mjs');
    for (const spec of specifiers(script)) assert.ok(spec.startsWith('node:') || /^\.\.\/lib\/[^/]+\.js$/.test(spec), `scripts/images.mjs import 了「${spec}」`);
    for (const rel of ['lib/images.js', 'lib/images-run.js', 'scripts/images.mjs']) {
        assert.doesNotMatch(code(read(rel)), /\b1010\b|\b1017\b|\b143\b|\b140\b|\b137\b|\b257\b|\b297\b|\b277\b|\b566\b|\b657\b|\b774\b|\b781\b|\b798\b|\b805\b|ai-outline|ai-terminal/, `${rel}：裁切框與圖名要從設定檔讀，不寫死在程式裡`);
    }
    const head = script.slice(0, script.search(/^import\s/m));
    for (const word of ['--config', 'images.config.json', '裁切']) assert.ok(head.includes(word), `scripts/images.mjs 的檔頭註解要寫到「${word}」`);
});

test('B13.2 結構：README.md 的「圖片」那一節寫到裁切設定怎麼寫、什麼時候要重跑；沒有開發流程的字眼', () => {
    const readme = read('README.md');
    const at = readme.search(/^## 圖片/m);
    assert.ok(at >= 0, 'README.md 要有「## 圖片」那一節');
    const next = readme.indexOf('\n## ', at + 1);
    const section = readme.slice(at, next < 0 ? undefined : next);
    for (const word of ['裁切', 'images.config.json', '--config', 'crop', '1920', '重跑']) assert.ok(section.includes(word), `README.md 的「圖片」那一節要寫到「${word}」`);
    for (const word of ['派工', '後端', '測試工程師', '檢查員', '目標檔', '4-b13', 'B13']) assert.ok(!section.includes(word), `README.md 的「圖片」那一節不能有開發流程的字眼「${word}」`);
});

test('B13.2 結構：這一段新加的測試與小工具檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = read(rel);
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b13|B13/, `${rel}：第一行要寫到 4-b13 或 B13`);
        if (rel.endsWith('structure-b13.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：真的素材要從 SITE_ASSETS 給`);
        }
    }
});
