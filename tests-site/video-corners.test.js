// F4.13 影片框在括號角裡（使用者 2026-10-04：手機上首屏宣傳片與 09 教學影片撐到視窗兩邊，括號角落在影片畫面上）。讀 out/，真的開瀏覽器。
//
// 量什麼：三語 × 280、320、360、375、390、414、640、1024、1440（有滑鼠，高 900，減少動態）：首屏的影片框與 09 的影片框（帶 data-corners 的那一個）——
//   括號角圍出的矩形（框的 ::after：框的矩形加上 ::after 的 top／right／bottom／left）要整個包住框本身與框裡的預覽圖、影片（差 0.5px 內）；
//   括號角離視窗左右邊 ≥ 8（手機版心內距 16 的一半）；整頁不橫捲。
//   放回舊的手機版（框貼齊兩邊、括號角 inset 12 收進框裡）會紅：括號角矩形比框小。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.13"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';

const WIDTHS = [280, 320, 360, 375, 390, 414, 640, 1024, 1440];
const EDGE = 8;

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

function measure() {
    const one = (frame) => {
        if (!frame) return null;
        const f = frame.getBoundingClientRect();
        const a = getComputedStyle(frame, '::after');
        const c = { left: f.left + parseFloat(a.left), top: f.top + parseFloat(a.top), right: f.right - parseFloat(a.right), bottom: f.bottom - parseFloat(a.bottom) };
        const boxes = [frame, ...frame.querySelectorAll('img, video, iframe')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
        const out = boxes.filter((r) => r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5)
            .map((r) => [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n * 10) / 10));
        return { out, corners: [c.left, c.top, c.right, c.bottom].map((n) => Math.round(n * 10) / 10), edge: Math.round(Math.min(c.left, innerWidth - c.right) * 10) / 10 };
    };
    return {
        hero: one(document.querySelector('[data-section="hero"] [data-corners]')),
        tutorial: one(document.querySelector('[data-section="tutorial"] [data-corners]')),
        scroll: document.documentElement.scrollWidth - innerWidth,
    };
}

for (const lang of LANGS) {
    test(`F4.13 首屏與 09 的影片框在括號角裡、括號角離視窗邊 ≥ ${EDGE}（${lang}：280～1440）`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const bad = [];
        for (const width of WIDTHS) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            try {
                await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                const got = await page.evaluate(measure);
                for (const [name, m] of [['首屏', got.hero], ['09', got.tutorial]]) {
                    if (!m) { bad.push(`${lang} ${width}：找不到${name}的影片框（data-corners）`); continue; }
                    if (m.out.length) bad.push(`${lang} ${width}：${name}有東西超出括號角 ${JSON.stringify(m.corners)}：${JSON.stringify(m.out)}`);
                    if (m.edge < EDGE) bad.push(`${lang} ${width}：${name}的括號角離視窗邊 ${m.edge}px（要 ≥ ${EDGE}）`);
                }
                if (got.scroll > 0) bad.push(`${lang} ${width}：整頁橫捲 ${got.scroll}px`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}
