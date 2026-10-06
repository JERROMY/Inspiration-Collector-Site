// 4-b5 的結構（部署設定與給使用者的說明）。只看檔案，不執行模組。
//
// 量什麼：
//   B5 結構：package.json 的套件只在白名單（4-f1 的 F1.7 改的：next、react、react-dom；不加套件）。
//   B5 結構：這一段新加的測試與小工具，檔頭第一行是 // 註解、而且寫到 4-b5 或 B5（講這支做什麼）。
//   B5 結構：這一段新加的測試與小工具不往 homepage/site/ 外面讀 —— 去掉註解之後沒有 design/、release/、tutorial/、clipper/、../..、'..', '..'
//            （沿用 4-b4 的掃法；4-b2、4-b3 的章節與素材工具不在這一條裡，見 tests/README.md「4-b4」已知限制）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B5 結構"
//   node --test tests/structure-b5.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const FILES = [
    'tests/deploy-files.js', 'tests/deploy-cloudflare.test.js', 'tests/deploy-readme.test.js', 'tests/deploy-gitignore.test.js',
];

// 去掉註解，免得註解裡寫到的東西被當成真的（跟 structure-b4.test.js 同一個寫法）
function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('B5 結構：package.json 的套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assertPackageWhitelist(pkg);
});

test('B5 結構：這一段新加的測試與小工具檔頭有說明', () => {
    for (const rel of [...FILES, 'tests/structure-b5.test.js']) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        const head = text.split('\n').filter((row) => row.startsWith('//')).slice(0, 5).join('\n');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.ok(/4-b5|B5/.test(head), `${rel}：檔頭的說明要寫到 4-b5 或 B5`);
    }
});

test('B5 結構：這一段新加的測試與小工具不往 homepage/site/ 外面讀（之後要搬進公開 repo）', () => {
    // 這支自己的字串裡就寫著要找的字，不掃自己
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of FILES) {
        const src = code(fs.readFileSync(path.join(SITE, rel), 'utf8'));
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」：之後搬進公開 repo 就讀不到了`);
        }
    }
});
