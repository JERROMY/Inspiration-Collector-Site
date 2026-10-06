// F7.8 09 章節清單（寬的時候自己捲）：露出半列、「還有 N 章 ↓」（使用者 2026-10-04）。讀 out/，真的開瀏覽器。
//
// 量什麼：三語 × 1280、1440（有滑鼠，高 900，減少動態）：
//   - 清單下緣切在影片框高度裡放得下的最後一章的一半（目標第 7 章；影片框旁放不下第 7 章的一半時切在前一章）：1280、1440 是第 6 章，
//     前面的章整列看得到，那一章露出 40%～60%；
//   - 「還有 N 章」看得到，N ＝ 還沒整列露出來的章數（自己數：列的下緣 ＞ 清單看得到的下緣），字是那一語的 tutorial.moreHint 代入 N；
//   - 按它清單往下捲（scrollTop 變大）；捲到底它收起來（hidden）。
//   三語 × 1024：影片框比較矮，切在第 5 章的一半 —— 量「那一列露出 40%～60%」與提示的 N。
//   三語 × 640、768（清單沒在捲）：提示不出現。
//   放回舊行為（沒有 public/tutorial.js 的切高度與提示）會紅：沒有剛好露出一半的那一列、提示不在。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F7.8"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));
const plain = (text) => text.replace(/[«»⟨⟩⟦⟧⁅⁆¦↵|]/g, '').replace(/\{([^{}]*)\}/g, '$1');

function state() {
    const box = document.querySelector('[data-chapters]');
    const sc = box.querySelector('[data-chapters-scroll]');
    const hint = box.querySelector('[data-chapters-more]');
    const top = sc.getBoundingClientRect().top;
    const bottom = top + sc.clientHeight;
    const vis = [...sc.querySelectorAll('li[id^="ch-"]')].map((li) => {
        const r = li.getBoundingClientRect();
        return { full: r.bottom <= bottom + 1, part: Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top)) / r.height };
    });
    const shown = hint && !hint.hidden && getComputedStyle(hint).display !== 'none' && hint.getBoundingClientRect().width > 0;
    return { vis, left: vis.filter((v) => !v.full).length, hint: shown ? hint.textContent.trim() : null, scrollTop: sc.scrollTop, scrolls: sc.scrollHeight > sc.clientHeight + 1 };
}

for (const lang of LANGS) {
    test(`F7.8 09 章節清單：露出半列、「還有 N 章」對、按了往下捲、捲到底收起來（${lang}）`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const bad = [];
        const template = plain(strings[lang]['tutorial.moreHint']);
        for (const width of [640, 768, 1024, 1280, 1440]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            try {
                await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                await page.evaluate(() => document.fonts.ready);
                await page.waitForFunction(() => window.__collectorHydrated === true);
                await page.waitForTimeout(100);
                const s = await page.evaluate(state);
                if (width < 1024) {
                    if (s.hint !== null) bad.push(`${lang} ${width}：清單沒在捲，不該有提示，得到「${s.hint}」`);
                    continue;
                }
                const cutRow = width >= 1280 ? 6 : 5;
                const fullRows = s.vis.slice(0, cutRow - 1).every((v) => v.full);
                const part = s.vis[cutRow - 1]?.part ?? 0;
                if (!fullRows) bad.push(`${lang} ${width}：第 1～${cutRow - 1} 章要整列看得到`);
                if (part < 0.4 || part > 0.6) bad.push(`${lang} ${width}：第 ${cutRow} 章要露出一半左右，得到 ${part.toFixed(2)}`);
                const want = template.replace('%nn%', String(s.left));
                if (s.hint !== want) bad.push(`${lang} ${width}：提示要是「${want}」（還有 ${s.left} 章沒整列露出來），得到「${s.hint}」`);
                if (width < 1280) continue;
                await page.locator('[data-chapters-more]').click();
                await page.waitForTimeout(150);
                const after1 = await page.evaluate(state);
                if (!(after1.scrollTop > s.scrollTop)) bad.push(`${lang} ${width}：按了提示清單要往下捲（${s.scrollTop} → ${after1.scrollTop}）`);
                await page.evaluate(() => { const sc = document.querySelector('[data-chapters-scroll]'); sc.scrollTop = sc.scrollHeight; });
                await page.waitForTimeout(150);
                const end = await page.evaluate(state);
                if (end.hint !== null) bad.push(`${lang} ${width}：捲到底提示要收起來，得到「${end.hint}」`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}
