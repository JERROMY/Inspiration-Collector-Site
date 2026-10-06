// 4-b9 的結構（B9.3：公告保留換行、英文孤字綁定）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b9」。
//
// 量什麼：
//   B9.3 package.json 的套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//   B9.3 這一段新加的測試與小工具：第一行是 // 說明、檔頭寫到 4-b9 或 B9；去掉註解之後不往 homepage/site/ 外面讀；
//        fixtures/news-lines/ 三支檔都在、開頭的註解寫到 4-b9。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B9.3"
//   node --test tests/structure-b9.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const TESTS = ['tests/news-lines.test.js', 'tests/bind-tail-en.test.js', 'tests/bind-tail-icon.test.js', 'tests/content-check-social.test.js', 'tests/structure-b9.test.js'];

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('B9.3 結構：package.json 的套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assertPackageWhitelist(pkg);
});

test('B9.3 結構：這一段新加的測試與 fixture 檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b9|B9/, `${rel}：第一行要寫到 4-b9 或 B9`);
        if (rel.endsWith('structure-b9.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」`);
        }
    }
    for (const lang of ['zh', 'en', 'ja']) {
        const file = path.join(SITE, 'tests', 'fixtures', 'news-lines', `news.${lang}.md`);
        assert.ok(fs.existsSync(file), `缺 tests/fixtures/news-lines/news.${lang}.md`);
        assert.match(fs.readFileSync(file, 'utf8').split('\n')[0], /4-b9/, `news.${lang}.md 第一行的註解要寫到 4-b9`);
    }
});
