// F1.4：資料只在產生網頁時（伺服器端）讀；全域的 .nw 規則在 CSS Modules 底下仍有效。
//
// 量什麼：
//   F1.4 瀏覽器端的程式（out/_next/ 底下每一支 .js）沒有後端模組的特徵字串 —— 讀內容、解析、綁孤字、檢查內容的程式都沒被打包送到瀏覽器。
//        特徵挑「程式裡的字串」（函式名稱壓縮後會不見，字串不會）；比對前先把 \uXXXX 還原（壓縮器可能把中文寫成跳脫）。
//        防呆：每一個特徵都要真的還在 lib/ 那支檔的程式裡（不是只在註解）—— 後端改了字，這裡先紅、提醒換一個，不會靜靜變成假的綠。
//   F1.4 全域的 .nw：build 出來的 CSS 有一條選擇器剛好是 .nw（沒被 CSS Modules 換成 xxx_nw__hash）、內容有 white-space: nowrap；
//        中文、日文頁的 HTML 裡有 bindTail 產的 <span class="nw">（class 名稱原樣）。
//   （「bindTail 的輸出只跳脫一次」在 content-broken.test.js，要用寫壞的內容另外 build 一次。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.4"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, OUT, needOut, readOut, listFiles, outCss, cssRules } from './helpers.js';

// [lib 裡的檔, 特徵字串]
const SIGNATURES = [
    ['content.js', '讀取時出錯（程式的問題，不是檔案寫壞）'],
    ['bind-tail.js', 'bindTail 的 lang 只收'],
    ['news.js', '連結寫了兩行：一則公告只能有一個連結'],
    ['changelog.js', '版本底下每一條要以「- 」開頭'],
    ['links.js', '代號只能是英文小寫與數字'],
    ['lines.js', 'toLines 只收字串'],
    ['lines.js', 'commentError'],
    ['entries.js', '註解沒關起來（缺 -->）'],
    ['content-check.js', '一則公告都沒有（0 則）'],
];

function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function unescapeJs(text) {
    return text
        .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

test('F1.4 防呆：特徵字串都還在 lib/ 的程式裡', () => {
    for (const [file, sig] of SIGNATURES) {
        const src = fs.readFileSync(path.join(SITE, 'lib', file), 'utf8');
        assert.ok(stripComments(src).includes(sig), `lib/${file} 的程式裡找不到「${sig}」：後端改了字，請在 client-bundle.test.js 換一個還在的特徵`);
    }
});

test('F1.4 瀏覽器端的程式（out/_next/**/*.js）沒有後端模組', () => {
    needOut();
    const js = listFiles(path.join(OUT, '_next')).filter((r) => /\.m?js$/.test(r));
    assert.ok(js.length > 0, 'out/_next/ 底下沒有 .js（Next.js 的 build 一定會有）—— out/ 不對？');
    for (const rel of js) {
        const text = unescapeJs(fs.readFileSync(path.join(OUT, '_next', ...rel.split('/')), 'utf8'));
        for (const [file, sig] of SIGNATURES) {
            assert.ok(!text.includes(sig), `out/_next/${rel} 裡有 lib/${file} 的「${sig}」：讀內容的程式被打包送到瀏覽器了（只能在產生網頁時、伺服器端跑）`);
        }
    }
});

test('F1.4 全域的 .nw（white-space: nowrap）在 build 出來的 CSS 裡，class 名稱沒被換掉', () => {
    const hit = outCss().some(({ text }) => cssRules(text).some((rule) =>
        rule.selectors.split(',').map((s) => s.trim()).includes('.nw') && /white-space\s*:\s*nowrap/.test(rule.body)));
    assert.ok(hit, 'build 出來的 CSS 沒有「.nw { white-space: nowrap }」：CSS Modules 裡要寫成 :global(.nw)，或放在全域 CSS（bindTail 產的是字面的 class="nw"）');
    for (const lang of ['zh', 'ja']) {
        assert.match(readOut(`${lang}/index.html`), /<span class="nw">/, `/${lang}/ 的 HTML 裡沒有 bindTail 產的 <span class="nw">（使用者寫的更新紀錄與公告沒經過 bindTail？）`);
    }
});
