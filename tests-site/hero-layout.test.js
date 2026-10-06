// F4.5 通用：03 首屏、04 在十二種寬度 × 三語的版面、減少動態、關掉 JS。讀 out/（真的內容），真的開瀏覽器。
// （CSS 沒有寫死色碼：F1.5；HTML 沒有自己寫的內嵌腳本：F3.9；每一行的字數、短行、拆詞與設計稿逐行一致：F4.4 —— 這裡不重複。）
//
// 量什麼：
//   F4.5 十二種寬度 × 三語（有滑鼠；320、390 另外量只有手指 —— 按鈕最多的畫面是手指的分享框）：
//        不橫捲；首屏與 04 裡每個 data-id 區塊互不重疊（巢狀的不算）；首屏與 04 的每個 a、button 裡的字沒跑出框、≥ 44×44；
//        桌機（1024 起）首屏是大標橫跨、底下左字右片：hero.sub 的區塊在媒體框的左邊；手機、平板一欄：媒體框在按鈕下面。
//   F4.5 減少動態（三語 1440）：開頁後、捲到 04 之後都沒有在跑的動畫。
//   F4.5 關掉 JS（三語 1440，與只有手指 390）：首屏與 04 的每個 data-id 區塊的字＝字串表那一條去掉標記（%url% 這類除外）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.5"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession, strings, plain } from './helpers.js';
import { heroParts, WIDTHS } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, extra = {}, height = 900) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, ...extra });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    if (extra.javaScriptEnabled !== false) await page.evaluate(() => document.fonts.ready);
    return { page, context, h: heroParts(page) };
}

async function check(page, h, label) {
    const problems = [];
    if ((await h.hero.count()) === 0) return [`${label}：找不到首屏（data-section="hero"）`];
    if ((await h.where.count()) === 0) problems.push(`${label}：找不到 04（data-section="where"）`);
    const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    if (scroll.sw > scroll.iw) problems.push(`${label}：橫捲 scrollWidth ${scroll.sw} > ${scroll.iw}`);
    const found = await page.evaluate(() => {
        const scope = [...document.querySelectorAll('[data-section="hero"], [data-section="where"]')];
        // checkVisibility：收著的 <details> 裡面的字也算看不到
        const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.checkVisibility({ visibilityProperty: true }); };
        const blocks = scope.flatMap((s) => [...s.querySelectorAll('[data-id]')]).filter(visible);
        const overlaps = [];
        for (let i = 0; i < blocks.length; i += 1) {
            for (let j = i + 1; j < blocks.length; j += 1) {
                const a = blocks[i]; const b = blocks[j];
                if (a.contains(b) || b.contains(a)) continue;
                const p = a.getBoundingClientRect(); const q = b.getBoundingClientRect();
                const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
                const hh = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
                if (w > 0.5 && hh > 0.5) overlaps.push(`${a.dataset.id} × ${b.dataset.id}`);
            }
        }
        const controls = scope.flatMap((s) => [...s.querySelectorAll('a, button, summary')]).filter(visible);
        const name = (el) => (el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 20);
        return {
            overlaps,
            spill: controls.filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0).map((el) => `${name(el)}（${el.scrollWidth} > ${el.clientWidth}）`),
            small: controls.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map((el) => { const r = el.getBoundingClientRect(); return `${name(el)}（${r.width.toFixed(1)}×${r.height.toFixed(1)}）`; }),
        };
    });
    problems.push(...found.overlaps.map((s) => `${label}：區塊重疊 ${s}`));
    problems.push(...found.spill.map((s) => `${label}：字跑出框 ${s}`));
    problems.push(...found.small.map((s) => `${label}：不到 44×44 ${s}`));
    return problems;
}

for (const lang of LANGS) {
    test(`F4.5 十二種寬度（${lang}）：不橫捲、區塊不重疊、字不跑出框、按鈕 ≥ 44、桌機左字右片（320、390 另外量只有手指）`, { skip: pw ? false : why }, async () => {
        const problems = [];
        for (const width of WIDTHS) {
            const { page, context, h } = await open(lang, width);
            try {
                problems.push(...await check(page, h, `${lang} ${width}`));
                const sub = await h.block('hero.sub').boundingBox();
                const frame = await h.frame.boundingBox();
                const cta = await h.hero.locator('a[href^="https://chromewebstore"]').first().boundingBox();
                if (sub && frame) {
                    if (width >= 1024 && !(sub.x + sub.width <= frame.x + 1)) problems.push(`${lang} ${width}：桌機要左字右片（說明在媒體框左邊）`);
                    if (width < 1024 && cta && !(frame.y >= cta.y + cta.height - 1)) problems.push(`${lang} ${width}：一欄時媒體框要在按鈕下面`);
                } else problems.push(`${lang} ${width}：找不到 hero.sub 或媒體框（data-corners）`);
            } finally {
                await context.close();
            }
        }
        for (const width of [320, 390]) {
            const { page, context, h } = await open(lang, width, { isMobile: true, hasTouch: true }, 844);
            try { problems.push(...await check(page, h, `${lang} ${width} 只有手指`)); } finally { await context.close(); }
        }
        assert.deepEqual(problems, [], `${problems.length} 個版面問題`);
    });
}

test('F4.5 減少動態（三語 1440）：開頁後、捲到 04 之後沒有在跑的動畫', { skip: pw ? false : why }, async () => {
    const running = () => document.getAnimations()
        .filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration ?? 0) > 1)
        .map((a) => `${a.constructor.name} ${a.animationName || a.transitionProperty || ''} @ ${a.effect?.target?.className || a.effect?.target?.nodeName}`);
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, 1440, { reducedMotion: 'reduce' });
        try {
            assert.deepEqual(await page.evaluate(running), [], `${lang}：開頁就有動畫在跑`);
            await h.where.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(100);
            assert.deepEqual(await page.evaluate(running), [], `${lang}：捲到 04 有動畫在跑`);
        } finally {
            await context.close();
        }
    }
});

test('F4.5 關掉 JS：首屏與 04 的字都在（每個 data-id＝字串表的字，三語 1440 與只有手指 390）', { skip: pw ? false : why }, async () => {
    const norm = (s) => s.replace(/\s+/g, '');
    const missing = [];
    for (const lang of LANGS) {
        for (const [width, extra] of [[1440, {}], [390, { isMobile: true, hasTouch: true }]]) {
            const { page, context } = await open(lang, width, { javaScriptEnabled: false, ...extra });
            try {
                const blocks = await page.locator('[data-section="hero"] [data-id], [data-section="where"] [data-id]').evaluateAll((els) => els.map((el) => ({ id: el.dataset.id, text: el.textContent })));
                if (blocks.length < 10) missing.push(`${lang} ${width}：首屏與 04 的 data-id 區塊只有 ${blocks.length} 個`);
                for (const { id, text } of blocks) {
                    const want = strings[lang][id];
                    if (want === undefined) { missing.push(`${lang} ${width}：data-id="${id}" 不是字串表的 id`); continue; }
                    if (want.includes('%')) continue;
                    if (norm(text) !== norm(plain(want))) missing.push(`${lang} ${width} ${id}：要是「${plain(want)}」，得到「${text.trim()}」`);
                }
                for (const id of ['hero.kicker', 'hero.title', 'hero.sub', 'hero.cta', 'where.label', 'zeros.cap']) {
                    if (!blocks.some((b) => b.id === id)) missing.push(`${lang} ${width}：找不到 data-id="${id}"`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(missing, [], '關掉 JS 時首屏與 04 的字要都在');
});
