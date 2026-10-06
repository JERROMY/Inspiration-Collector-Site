// F4.11 連結的底線：手指框的「用的是電腦？直接加到 Chrome →」（hero.pc）要有底線；首屏與 04 每個連結的每個字，算出來有沒有底線要跟設計稿一樣。
//
// 為什麼要量樣式：網站在 <a> 與斷行單位 .u 中間多包一層 <span data-id>，.u 是行內區塊、靠 text-decoration: inherit 拿底線，繼承到的是那層 span 的 none ——
// 位置與大小跟設計稿一樣，比位置抓不到。
// 設計稿的對照在 fixtures/design-6511462.json 的 links（設計稿 commit 6511462 量的，數字跟 607a536、350fdf4、ba016e9、3f2310c 一樣；量法是 page-helpers.js 的 LINK_DECORATION）。
//
// 量什麼：
//   F4.11 只有手指 390 三語：手指框的出口連結（裡面有 data-id="hero.pc"）每一個 .u 的 textDecorationLine 是 underline；
//         按下時（只有手指沒有滑過：設計稿第四批把滑過收進 @media (hover: hover)，手指用 @media (hover: none) 的 :active；用 Chrome 開發者協定強制 :active）
//         每一個 .u 的底線顏色（textDecorationColor）是螢光綠（設計系統 --color-accent-lime-default）；
//         鍵盤聚焦時連結有看得到的焦點框（設計稿的 .link 聚焦時不換底線顏色，畫 base.css 的螢光綠焦點框）。
//   F4.11 通則：三語 × 有滑鼠 1440、只有手指 390，首屏與 04 的每一個 <a>（照「字去掉空白｜href」對上設計稿的同一個連結；mailto 只比 mailto:），
//         每個字算出來有沒有底線跟設計稿一樣；設計稿有的連結網站也要有。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.11"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { heroParts, LINK_DECORATION } from './page-helpers.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, touch) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width: touch ? 390 : 1440, height: touch ? 844 : 900 }, reducedMotion: 'reduce', ...(touch ? { isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    return { page, context, h: heroParts(page) };
}

const lime = (page) => page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-accent-lime-default)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
});

for (const lang of LANGS) {
    test(`F4.11 手指框的出口連結（${lang} 390 只有手指）：每個 .u 有底線、按下轉螢光綠、聚焦有焦點框`, { skip: pw ? false : why }, async () => {
        const { page, context, h } = await open(lang, true);
        try {
            const link = h.block('hero.pc').locator('xpath=ancestor::a[1]');
            assert.equal(await link.count(), 1, '找不到手指框的出口連結（裡面有 data-id="hero.pc" 的 <a>）');
            const units = link.locator('.u');
            assert.ok((await units.count()) >= 1, '出口連結裡要有斷行單位（.u）');
            const lines = await units.evaluateAll((us) => us.map((u) => getComputedStyle(u).textDecorationLine));
            assert.ok(lines.every((l) => l.includes('underline')), `每一個 .u 的 textDecorationLine 要是 underline（設計稿的樣子），得到 ${lines.join('、')}`);
            const green = await lime(page);
            await link.evaluate((a) => a.setAttribute('data-press-probe', ''));
            const cdp = await context.newCDPSession(page);
            await cdp.send('DOM.enable');
            await cdp.send('CSS.enable');
            const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
            const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-press-probe]' });
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
            await page.waitForTimeout(400);
            const colors = await units.evaluateAll((us) => us.map((u) => getComputedStyle(u).textDecorationColor));
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
            await cdp.detach();
            assert.ok(colors.every((c) => c === green), `按下時底線要轉螢光綠（${green}），得到 ${colors.join('、')}`);
            await page.keyboard.press('Tab');
            await link.focus();
            await page.keyboard.press('Shift+Tab');
            await page.keyboard.press('Tab');
            const ring = await link.evaluate((a) => ({ focused: document.activeElement === a, style: getComputedStyle(a).outlineStyle, width: parseFloat(getComputedStyle(a).outlineWidth) }));
            assert.ok(ring.focused, '防呆：鍵盤焦點要在出口連結上');
            assert.ok(ring.style !== 'none' && ring.width > 0, `鍵盤聚焦時要看得到焦點框，得到 ${JSON.stringify(ring)}`);
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    test(`F4.11 首屏與 04 每個連結的每個字，底線跟設計稿一樣（${lang}：有滑鼠 1440、只有手指 390）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const mode of ['mouse', 'touch']) {
            const { page, context } = await open(lang, mode === 'touch');
            try {
                const site = await page.evaluate(LINK_DECORATION, '[data-section="hero"] a, [data-section="where"] a');
                for (const want of DESIGN.links[lang][mode]) {
                    const got = site.find((s) => s.key === want.key);
                    if (!got) { bad.push(`${mode} 找不到連結「${want.key}」`); continue; }
                    if (got.flags !== want.flags) bad.push(`${mode}「${want.key.split('|')[0]}」：網站 ${got.flags}、設計稿 ${want.flags}（u＝有底線）`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 個連結的底線跟設計稿不一樣`);
    });
}
