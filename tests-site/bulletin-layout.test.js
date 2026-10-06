// F3.11 02 公告條照設計稿的排法（第三批 4fce811 定的，第四批 3f2310c 沒變）。讀 out/（真的內容：公告條那則跟設計稿的字一樣），真的開瀏覽器。
//
// 設計稿的數字在 fixtures/design-6511462.json 的 bulletin（公告條整條高、「公告」標籤、標題、✕ 的 [x, y, 寬, 高]，有滑鼠、高 900）與 shareBottom。
// 量到的（2026-10-03，跟設計審查第三輪的實量一致）：手機（< 640）中 106、106、101、101、101、101，英 102，日 131、106、106、106、106、106（280～430）；
// 640 中 61、英 78、日 82；768～1440 三語 61。只有手指 360×780 的日文，手指框主要按鈕的下緣 737。
//
// 量什麼：
//   F3.11 手機（三語 × 280、320、360、375、390、430）：「公告」標籤與 ✕ 在上排、標題在下排（標題的頂在標籤與 ✕ 的底之下、左緣對齊標籤）；
//         整條高、標籤／標題／✕ 的位置與大小跟設計稿差 ≤ 2px；✕ 44×44；標籤與 ✕ 不重疊、✕ 不壓到標題。
//   F3.11 桌機（三語 × 640、768、1024、1280、1440）：整條高、三樣東西的位置與大小跟設計稿差 ≤ 2px（標題不限 25em，放得下就一行：768 起 61 高）。
//   F3.11 只有手指 360×780 的日文：手指框主要按鈕（hero.share 那一顆）的下緣跟設計稿差 ≤ 2px（公告條的高度會一路推下來）。
//   （F3.9 的「至少 60、左緣」不動。）
//   F3.12 公告條的 ✕ 是沒有框的圖示鈕：有滑鼠 390 強制 :hover、只有手指 390 強制 :active（Chrome 開發者協定）時，框是透明的（沒有框、寬 0 或透明）；
//         同一個寬度的 ☰（有框的圖示鈕）照樣長出螢光綠框（--color-accent-lime-default）。三語。設計稿 ba016e9 的 .iconbtn--ghost:is(:hover, :active…)。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.11|F3.12"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { bulletinParts, heroParts, say, parts, pressStyles } from './page-helpers.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));
const MOBILE = [280, 320, 360, 375, 390, 430];
const DESKTOP = [640, 768, 1024, 1280, 1440];
const TOL = 2;

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function measure(lang, width) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    try {
        const b = bulletinParts(page, lang);
        if ((await b.region.count()) !== 1) return null;
        const box = async (loc) => { const r = await loc.boundingBox(); return r ? [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10) : null; };
        return {
            h: (await b.region.boundingBox()).height,
            label: await box(b.region.getByText(say(lang, 'bulletin.label'), { exact: true })),
            text: await box(b.text),
            close: await box(b.close),
        };
    } finally {
        await context.close();
    }
}

const near = (a, b) => Math.abs(a - b) <= TOL;
const NAMES = { label: '「公告」標籤', text: '標題', close: '✕' };

function compare(lang, width, got, want) {
    const bad = [];
    if (!got) return [`${lang} ${width}：找不到公告條`];
    if (!near(got.h, want.h)) bad.push(`${lang} ${width}：整條高 ${got.h.toFixed(1)}，設計稿 ${want.h}`);
    for (const k of ['label', 'text', 'close']) {
        if (!got[k]) { bad.push(`${lang} ${width}：找不到${NAMES[k]}`); continue; }
        const diff = got[k].map((n, i) => n - want[k][i]);
        if (diff.some((d) => Math.abs(d) > TOL)) bad.push(`${lang} ${width}：${NAMES[k]} [x,y,寬,高] 網站 ${got[k].join(',')}，設計稿 ${want[k].join(',')}`);
    }
    return bad;
}

const overlap = (a, b) => Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > 0.5 && Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > 0.5;

for (const lang of LANGS) {
    test(`F3.11 公告條手機排法（${lang}，280～430）：標籤與 ✕ 上排、標題下排，高度與位置照設計稿`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of MOBILE) {
            const got = await measure(lang, width);
            bad.push(...compare(lang, width, got, DESIGN.bulletin[lang][width]));
            if (!got || !got.label || !got.text || !got.close) continue;
            if (!(got.text[1] >= Math.max(got.label[1] + got.label[3], got.close[1] + got.close[3]) - 1)) bad.push(`${lang} ${width}：標題要在下排（頂在標籤與 ✕ 的底之下）`);
            if (!near(got.text[0], got.label[0])) bad.push(`${lang} ${width}：標題的左緣要對齊標籤（佔整個寬度）`);
            if (!near(got.close[2], 44) || !near(got.close[3], 44)) bad.push(`${lang} ${width}：✕ 要 44×44，得到 ${got.close[2]}×${got.close[3]}`);
            if (overlap(got.label, got.close)) bad.push(`${lang} ${width}：標籤與 ✕ 重疊`);
            if (overlap(got.text, got.close)) bad.push(`${lang} ${width}：✕ 壓到標題`);
        }
        assert.deepEqual(bad, [], `${bad.length} 處跟設計稿不一樣`);
    });
}

for (const lang of LANGS) {
    test(`F3.11 公告條桌機排法（${lang}，640～1440）：高度與位置照設計稿（768 起一行、61 高）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of DESKTOP) bad.push(...compare(lang, width, await measure(lang, width), DESIGN.bulletin[lang][width]));
        assert.deepEqual(bad, [], `${bad.length} 處跟設計稿不一樣`);
    });
}

test('F3.11 只有手指 360×780 的日文：手指框主要按鈕的下緣照設計稿（公告條的高度一路推下來）', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/ja/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    try {
        const share = heroParts(page).hero.getByRole('button', { name: say('ja', 'hero.share') });
        const r = await share.boundingBox();
        assert.ok(r, '找不到手指框的「この URL を共有」');
        const want = DESIGN.shareBottom.ja;
        assert.ok(near(r.y + r.height, want), `主要按鈕的下緣 ${(r.y + r.height).toFixed(1)}，設計稿 ${want}`);
    } finally {
        await context.close();
    }
});

test('F3.12 公告條 ✕ 滑過與按下時保持透明框，☰ 照樣有螢光綠框（三語：有滑鼠 390 強制 :hover、只有手指 390 強制 :active）', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    const bad = [];
    for (const lang of LANGS) {
        for (const [mode, extra, state] of [['有滑鼠', {}, 'hover'], ['只有手指', { isMobile: true, hasTouch: true }, 'active']]) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...extra });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            try {
                await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                const lime = await page.evaluate(() => {
                    const probe = document.createElement('span');
                    probe.style.color = 'var(--color-accent-lime-default)';
                    document.body.append(probe);
                    const c = getComputedStyle(probe).color;
                    probe.remove();
                    return c;
                });
                const close = bulletinParts(page, lang).close;
                if (!(await close.count())) { bad.push(`${lang} ${mode}：找不到公告條的 ✕`); continue; }
                const x = await pressStyles(page, close.first(), [state]);
                if (x.active.border !== '-') bad.push(`${lang} ${mode}：✕ 強制 :${state} 時框是 ${x.active.border}，要透明（平常 ${x.normal.border}）`);
                const menu = (await parts(page, lang)).menuButton;
                const m = await pressStyles(page, menu, [state]);
                if (m.active.border !== lime) bad.push(`${lang} ${mode}：☰ 強制 :${state} 時框是 ${m.active.border}，要螢光綠 ${lime}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

