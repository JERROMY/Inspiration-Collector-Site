// 4-b10 的結構（B10.3：中日文詞界 <wbr>、更新紀錄原句 raw、英文綁字上限）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b10」。
//
// 量什麼：
//   B10.3 package.json 的套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//   B10.3 lib/bind-tail.js 的 JSDoc 寫到 <wbr>、Intl.Segmenter、keep-all（前端對中文使用者內容設 word-break: keep-all）；lib/changelog.js 的 JSDoc 寫到 raw。
//   B10.3 〔派工 4-b10〕網站的 README.md「公告的換行與孤字綁定」那一節（給前端看）寫到：只對中文、日文不插、auto-phrase、lang、keep-all、Intl.Segmenter、overflow-wrap。
//   B10.3 這一段新加的測試第一行寫到 4-b10 或 B10、不往 homepage/site/ 外面讀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B10.3"
//   node --test tests/structure-b10.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const TESTS = ['tests/bind-tail-wbr.test.js', 'tests/bind-tail-cap.test.js', 'tests/changelog-raw.test.js', 'tests/structure-b10.test.js'];

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function docs(rel) {
    return (fs.readFileSync(path.join(SITE, rel), 'utf8').match(/\/\*\*[\s\S]*?\*\//g) || []).join('\n');
}

test('B10.3 結構：package.json 的套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assertPackageWhitelist(pkg);
});

test('B10.3 結構：bind-tail.js 的 JSDoc 寫到 <wbr>、Intl.Segmenter、keep-all；changelog.js 的 JSDoc 寫到 raw', () => {
    const bind = docs('lib/bind-tail.js');
    for (const word of ['<wbr>', 'Intl.Segmenter', 'keep-all']) assert.ok(bind.includes(word), `lib/bind-tail.js 的 JSDoc 要寫到「${word}」`);
    assert.match(docs('lib/changelog.js'), /\braw\b/, 'lib/changelog.js 的 JSDoc 要寫到 raw（好條目的原句）');
});

test('B10.3 結構：網站的 README.md「公告的換行與孤字綁定」那一節寫到只對中文、日文不插、auto-phrase、lang、keep-all、Intl.Segmenter、overflow-wrap', () => {
    const readme = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const at = readme.search(/^##\s.*孤字綁定/m);
    assert.ok(at >= 0, 'README.md 要有「公告的換行與孤字綁定」那一節（## 標題寫到「孤字綁定」）');
    const next = readme.indexOf('\n## ', at + 1);
    const section = readme.slice(at, next < 0 ? undefined : next);
    const words = {
        只對中文: '詞界 <wbr> 只對中文插',
        日文不插: '日文不插 <wbr>（插了會把動詞活用切碎）',
        'auto-phrase': '日文靠 word-break: auto-phrase',
        lang: 'auto-phrase 要元素有 lang="ja" 才生效',
        'keep-all': '中文使用者內容的區塊設 word-break: keep-all',
        'Intl.Segmenter': '詞界 <wbr> 是 Intl.Segmenter 切的',
        'overflow-wrap': '中文區塊加 overflow-wrap: anywhere（放在 flex 子項裡 break-word 兜不住，或子項加 min-width: 0）',
    };
    for (const [word, why] of Object.entries(words)) {
        assert.ok(section.includes(word), `README.md 那一節要寫到「${word}」：${why}`);
    }
});

test('B10.3 結構：這一段新加的測試檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b10|B10/, `${rel}：第一行要寫到 4-b10 或 B10`);
        if (rel.endsWith('structure-b10.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」`);
        }
    }
});
