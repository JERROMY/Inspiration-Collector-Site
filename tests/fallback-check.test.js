// 4-b12 的 B12.3 靜態檢查：除了空白，每個 size-adjust 都要在 85%～120%；微調組照明確的容許值（tests/fallback-fixture.js 的 MICRO_ALLOWANCE）。介面細則見 tests/README.md「4-b12」。
//
// 量什麼：
//   凍結的參考輸出 golden.css（前端 2026-10-03 的 app/styles/fallback-fonts.css）要過；手改一個成 130% 要被抓到；微調組超出它的容許值要被抓到；不認得的 family 要被抓到。
//   網站有 app/styles/fallback-fonts.css 的時候（前端合併之後）它也要過；後端分支沒有 app/ 就 skip 並寫原因。
//   〔檢查員第 1 輪〕同樣五種情況直接呼叫 lib/fallback-check.js 的 checkFallbackCss（命令靠它決定沒過就不寫輸出檔）：0／1／1／1／1 個問題。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12.3 靜態檢查"
//   node --test tests/fallback-check.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { checkSizeAdjust, readGolden, parseFaces, MICRO_ALLOWANCE, BASE } from './fallback-fixture.js';

test('B12.3 靜態檢查：golden.css（424 個 @font-face）過；空白不算', () => {
    const css = readGolden();
    assert.equal(parseFaces(css).length, 424, '防呆：golden.css 424 個 @font-face');
    assert.deepEqual(checkSizeAdjust(css), [], 'golden.css 要過');
    const spaces = parseFaces(css).filter((f) => f.range === 'U+20').map((f) => f.sizeAdjust);
    assert.ok(spaces.some((v) => v < 85), '防呆：golden.css 裡有空白小於 85%（空白不夾，所以不算）');
});

test('B12.3 靜態檢查：手改一個基本組成 130%、一個成 80% → 抓到', () => {
    const css = readGolden();
    const high = css.replace('size-adjust: 85.4%', 'size-adjust: 130%');
    assert.notEqual(high, css, '防呆：有改到');
    assert.equal(checkSizeAdjust(high).length, 1, `130% 要被抓到一條：${checkSizeAdjust(high).join('；')}`);
    assert.match(checkSizeAdjust(high)[0], /130/);
    const low = css.replace('size-adjust: 85.4%', 'size-adjust: 80%');
    assert.equal(checkSizeAdjust(low).length, 1, '80% 要被抓到');
});

test('B12.3 靜態檢查：微調組在它的容許值以內過、超出就抓到；容許值以外的 family 抓到', () => {
    const css = readGolden();
    const target = parseFaces(css).find((f) => f.family === `${BASE} sub en` && f.sizeAdjust > 123);
    assert.ok(target, '防呆：golden.css 有 sub en 123.17% 那一個');
    const [, , , hi] = MICRO_ALLOWANCE.find(([family]) => family === `${BASE} sub en`);
    assert.ok(target.sizeAdjust <= hi, 'sub en 123.17% 在容許值以內');
    const over = css.replace(`size-adjust: ${target.sizeAdjust}%`, `size-adjust: ${(hi + 0.5).toFixed(2)}%`);
    assert.equal(checkSizeAdjust(over).length, 1, '超出容許值要被抓到');
    const unknown = css.replace(`font-family: "${BASE} meta en"`, `font-family: "${BASE} nobody en"`);
    assert.ok(checkSizeAdjust(unknown).some((p) => p.includes('nobody en')), '不認得的 family 要被抓到');
});

test('B12.3 靜態檢查：網站的 app/styles/fallback-fonts.css（前端合併之後才有）也要過', (t) => {
    const file = path.join(SITE, 'app', 'styles', 'fallback-fonts.css');
    if (!fs.existsSync(file)) {
        t.skip('這個分支沒有 app/styles/fallback-fonts.css（前端合併之後才有）');
        return;
    }
    assert.deepEqual(checkSizeAdjust(fs.readFileSync(file, 'utf8')), [], 'app/styles/fallback-fonts.css 要過');
});

// ── 檢查員第 1 輪：直接量 lib/fallback-check.js 的 checkFallbackCss（命令靠它決定「沒過就不寫輸出檔」）──
// 上面幾條用的是測試自己寫的 checkSizeAdjust（當作對照）；這幾條同樣五種情況改呼叫 lib 那支，設定照產生 golden.css 那一次（ROLES、FACTORS）。

test('B12.3 靜態檢查（lib）：checkFallbackCss —— golden 過、130%、80%、sub en 超出容許值、不認得的 family，各 0／1／1／1／1 個問題', async () => {
    const { lib } = await import('./helpers.js');
    const { ROLES, FACTORS } = await import('./fallback-fixture.js');
    const { checkFallbackCss } = (await lib('fallback-check.js', ['checkFallbackCss']))();
    const config = { roles: ROLES, factors: FACTORS };
    const css = readGolden();
    const target = parseFaces(css).find((f) => f.family === `${BASE} sub en` && f.sizeAdjust > 123);
    const [, , , hi] = MICRO_ALLOWANCE.find(([family]) => family === `${BASE} sub en`);
    const cases = [
        ['golden.css', css, 0, null],
        ['基本組手改成 130%', css.replace('size-adjust: 85.4%', 'size-adjust: 130%'), 1, /130/],
        ['基本組手改成 80%', css.replace('size-adjust: 85.4%', 'size-adjust: 80%'), 1, /80/],
        ['sub en 超出微調組容許值', css.replace(`size-adjust: ${target.sizeAdjust}%`, `size-adjust: ${(hi + 0.5).toFixed(2)}%`), 1, /sub en/],
        ['不認得的 family', css.replace(`font-family: "${BASE} meta en"`, `font-family: "${BASE} nobody en"`), 1, /nobody en/],
    ];
    for (const [label, input, count, word] of cases) {
        assert.notEqual(label === 'golden.css' ? null : input, css, `${label}：防呆，要真的有改到`);
        const problems = checkFallbackCss(input, config);
        assert.ok(Array.isArray(problems), `${label}：要回傳陣列`);
        assert.equal(problems.length, count, `${label}：要有 ${count} 個問題，得到 ${problems.length}：${problems.join('；')}`);
        if (word) assert.match(problems[0], word, `${label}：問題要講到 ${word}`);
        if (word) assert.match(problems[0], /[一-鿿]/, `${label}：問題是中文`);
    }
});
