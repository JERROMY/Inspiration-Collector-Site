// F4b.2～F4b.6 平板與觸控的修正（設計稿第四批 3f2310c 的 notes/4-4.md 的修正五項與「給前端的事」）。讀 out/（真的內容），真的開瀏覽器。
//
// 量什麼：
//   F4b.2 只有手指（isMobile＋hasTouch，三語 × 280、320、360、375、390、430、480、540、640、768、1024、1280）：首屏只看得到手指框（data-touch），
//         看不到主要按鈕那一組（hero.cta、hero.watch），導覽列的「加到 Chrome」也看不到；有滑鼠（三語 × 十二種寬度）：只看得到按鈕、看不到手指框。
//         15 區一樣（只有手指只看得到 [data-touch]、看不到 final.cta；有滑鼠反過來），而且不橫捲。
//   F4b.3 網站自己的 CSS（app/、components/，去掉註解）：每一條選擇器有 :hover 的規則都在 @media (hover: hover) 裡面。
//   F4b.3 模擬手機（三語 390 只有手指）：點過分享、寄給自己、公告 ✕、☰、播放鈕之後（點擊本身的效果先擋掉，只留按過的狀態），
//         算出來的底色、字色、框線、底線色、::before／::after 透明度跟點之前一樣（沒有黏住的 hover）。
//   F4b.4 模擬手機（三語 390 只有手指、減少動態）：用 Chrome 開發者協定強制 :active，主要（分享）、次要（寄給自己）、圖示鈕（☰、公告 ✕、社群第一個）、
//         播放鈕、語言切換、文字連結（用的是電腦？）、選單連結、影片說明開關，算出來的樣子跟設計稿同一個元件強制 :active 時一樣
//         （fixtures/design-6511462.json 的 press；量法是 page-helpers.js 的 pressStyles，框線透明或沒有、底線沒有、沒有 ::before／::after 時記「-」）。
//         公告 ✕ 按下時框保持透明（設計稿 ba016e9 改的；之前的 3f2310c 會長出螢光綠框）。05、06、09、11～16 還沒做，不量。
//   F4b.5 分享退路的網址框（關掉 JS 就看得到，三語只有手指）：280、320 兩行「https://」／「collector.jerromy.com/<語言>/」；360、390 一行。
//   F4b.6 首屏大標短行（三語有滑鼠）：中文 280、320 是「把網頁收成 AI」／「讀得懂的素材庫」；英文 280 是「Turn the」／「web into」／「material your AI」／「can read」
//         （括號是畫的，不在字裡）；日文 280、320 照設計稿逐行（已知限制：一行 4 字，不要求更好）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4b.[2-6]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, siteCss, stripCssComments } from './helpers.js';
import { parts, bulletinParts, heroParts, textLines, pressStyles, READ_PRESS, WIDTHS } from './page-helpers.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-03-04.json'), 'utf8')).lines;
const TOUCH = { isMobile: true, hasTouch: true };
const TOUCH_WIDTHS = [280, 320, 360, 375, 390, 430, 480, 540, 640, 768, 1024, 1280];

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, { touch = false, height, js = true, reduced = false } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({
        viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? TOUCH : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}),
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, h: heroParts(page) };
}

for (const lang of LANGS) {
    test(`F4b.2 只有手指只看得到手指框、有滑鼠只看得到按鈕（${lang}：只有手指 280～1280、有滑鼠十二種寬度）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [touch, widths] of [[true, TOUCH_WIDTHS], [false, WIDTHS]]) {
            for (const width of widths) {
                const { page, context, h } = await open(lang, width, { touch });
                try {
                    const mode = touch ? '只有手指' : '有滑鼠';
                    const box = await h.hero.locator('[data-touch]').isVisible();
                    const ctas = (await Promise.all(['hero.cta', 'hero.watch'].map((id) => h.block(id).isVisible()))).some(Boolean);
                    if (touch && !box) bad.push(`${lang} ${width} ${mode}：看不到手指框`);
                    if (touch && ctas) bad.push(`${lang} ${width} ${mode}：看得到主要按鈕那一組（hero.cta／hero.watch）`);
                    if (!touch && box) bad.push(`${lang} ${width} ${mode}：看得到手指框`);
                    if (!touch && !ctas) bad.push(`${lang} ${width} ${mode}：看不到主要按鈕那一組`);
                    if (touch && (await (await parts(page, lang)).cta.isVisible())) bad.push(`${lang} ${width} ${mode}：導覽列的「加到 Chrome」看得到`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 組不對`);
    });
}

for (const lang of LANGS) {
    test(`F4b.2 15 區（最後的安裝）只有手指只看得到手指框、有滑鼠只看得到按鈕、不橫捲（${lang}：只有手指 280～1280、有滑鼠十二種寬度）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [touch, widths] of [[true, TOUCH_WIDTHS], [false, WIDTHS]]) {
            for (const width of widths) {
                const { page, context } = await open(lang, width, { touch });
                try {
                    const mode = touch ? '只有手指' : '有滑鼠';
                    const sec = page.locator('[data-section="final"]');
                    if (!(await sec.count())) { bad.push(`${lang} ${width} ${mode}：找不到 15 區`); continue; }
                    const box = await sec.locator('[data-touch]').isVisible();
                    const cta = await sec.locator('[data-id="final.cta"]').isVisible();
                    if (touch && !box) bad.push(`${lang} ${width} ${mode}：15 區看不到手指框`);
                    if (touch && cta) bad.push(`${lang} ${width} ${mode}：15 區看得到「加到 Chrome」`);
                    if (!touch && box) bad.push(`${lang} ${width} ${mode}：15 區看得到手指框`);
                    if (!touch && !cta) bad.push(`${lang} ${width} ${mode}：15 區看不到「加到 Chrome」`);
                    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                    if (scroll > 0) bad.push(`${lang} ${width} ${mode}：整頁橫捲 ${scroll}px`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 組不對`);
    });
}

// CSS 走一遍：每一條規則記下它外面包著的 @ 規則（巢狀），挑出選擇器有 :hover、外面沒有 @media (hover: hover) 的
function hoverOutsideMedia(css) {
    const bad = [];
    const stack = [];
    let start = 0;
    const text = stripCssComments(css);
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '{') {
            const prelude = text.slice(start, i).trim();
            stack.push(prelude);
            if (!prelude.startsWith('@') && /:hover\b/.test(prelude) && !stack.some((p) => /^@media\b/.test(p) && /\(\s*hover\s*:\s*hover\s*\)/.test(p))) bad.push(prelude.replace(/\s+/g, ' '));
            start = i + 1;
        } else if (ch === '}') {
            stack.pop();
            start = i + 1;
        } else if (ch === ';' && stack.length === 0) {
            start = i + 1;
        }
    }
    return bad;
}

test('F4b.3 網站的 CSS：每一條 :hover 都在 @media (hover: hover) 裡（去掉註解）', () => {
    const files = siteCss();
    assert.ok(files.length > 5, `防呆：只找到 ${files.length} 支 CSS`);
    assert.deepEqual(hoverOutsideMedia('.a:hover{x:1}@media (hover: hover){.b:hover{x:1}}@media (min-width: 1px){.c:hover{x:1}}'), ['.a:hover', '.c:hover'], '防呆：掃描本身要分得出裡外');
    const bad = files.flatMap(({ rel, text }) => hoverOutsideMedia(text).map((s) => `${rel}：${s}`));
    assert.deepEqual(bad, [], `${bad.length} 條 :hover 不在 @media (hover: hover) 裡（手機點過之後會黏住）`);
});

// 點擊本身的效果擋掉（不分享、不關公告、不開選單、不播影片），只留「被手指按過」的狀態
const BLOCK_TAP = () => {
    addEventListener('click', (event) => {
        if (event.target.closest && event.target.closest('[data-tap-probe]')) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
};

test('F4b.3 模擬手機點過之後顏色回到一般的樣子（三語 390 只有手指）：分享、寄給自己、公告 ✕、☰、播放鈕', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...TOUCH, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        await page.addInitScript(BLOCK_TAP);
        try {
            await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
            const h = heroParts(page);
            const p = await parts(page, lang);
            const targets = {
                分享: h.hero.locator('[data-share]'), 寄給自己: h.block('hero.mail'), '公告 ✕': bulletinParts(page, lang).close, '☰': p.menuButton, 播放鈕: h.hero.locator('[data-play]'),
            };
            for (const [name, loc] of Object.entries(targets)) {
                if (!(await loc.count()) || !(await loc.first().isVisible())) { bad.push(`${lang}：找不到看得到的「${name}」`); continue; }
                const el = loc.first();
                await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
                const before = await el.evaluate(READ_PRESS);
                await el.evaluate((e) => e.setAttribute('data-tap-probe', ''));
                await el.tap();
                await page.waitForTimeout(300);
                const later = await el.evaluate(READ_PRESS);
                await el.evaluate((e) => e.removeAttribute('data-tap-probe'));
                if (JSON.stringify(later) !== JSON.stringify(before)) bad.push(`${lang}「${name}」點過之後黏住：點之前 ${JSON.stringify(before)}，點之後 ${JSON.stringify(later)}`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 個點過之後沒有回到一般的樣子`);
});

const PRESS_NAMES = { primary: '主要按鈕（分享）', secondary: '次要按鈕（寄給自己）', menu: '☰', close: '公告 ✕', social: '社群圖示', play: '播放鈕', lang: '語言切換', link: '文字連結（用的是電腦？）', navlink: '選單連結', summary: '影片說明開關' };

test('F4b.4 手指「按下」的樣子跟設計稿一樣（三語 390 只有手指，強制 :active）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, 390, { touch: true, reduced: true });
        try {
            const p = await parts(page, lang);
            const site = {
                primary: h.hero.locator('[data-share]'), secondary: h.block('hero.mail'), menu: p.menuButton, close: bulletinParts(page, lang).close,
                social: p.socials.locator('a'), play: h.hero.locator('[data-play]'), lang: p.menuLang.locator('a:not([aria-current])'),
                link: h.block('hero.pc').locator('xpath=ancestor::a[1]'), navlink: p.menuLinks.locator('a'), summary: h.hero.locator('details summary'),
            };
            for (const [key, loc] of Object.entries(site)) {
                const want = DESIGN.press[lang][key];
                if (!(await loc.count())) { bad.push(`${lang} ${PRESS_NAMES[key]}：網站上找不到`); continue; }
                const got = await pressStyles(page, loc.first());
                const diff = Object.keys(want.active).filter((k) => got.active[k] !== want.active[k]);
                if (diff.length) bad.push(`${lang} ${PRESS_NAMES[key]}：按下時 ${diff.map((k) => `${k} 網站 ${got.active[k]}、設計稿 ${want.active[k]}`).join('；')}（網站平常 ${diff.map((k) => got.normal[k]).join('、')}）`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 個元件按下時跟設計稿不一樣`);
});

test('F4b.5 分享退路的網址框（關掉 JS，三語只有手指）：280、320 兩行，360 起一行', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const host = `collector.jerromy.com/${lang}/`;
        for (const width of [280, 320, 360, 390]) {
            const { context, h } = await open(lang, width, { touch: true, js: false });
            try {
                const box = h.hero.locator('[data-share-urlbox]');
                if (!(await box.isVisible())) { bad.push(`${lang} ${width}：看不到網址框`); continue; }
                const got = await textLines(box);
                const want = width < 360 ? ['https://', host] : [`https://${host}`];
                if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${lang} ${width}：網址框 ${JSON.stringify(got)}，要 ${JSON.stringify(want)}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 組不對`);
});

const TITLE = {
    zh: { 280: ['把網頁收成 AI', '讀得懂的素材庫'], 320: ['把網頁收成 AI', '讀得懂的素材庫'] },
    en: { 280: ['Turn the', 'web into', 'material your AI', 'can read'] },
    ja: { 280: LINES.ja['280']['hero.title'], 320: LINES.ja['320']['hero.title'] },
};

test('F4b.6 首屏大標短行（中文 280、320，英文 280；日文照設計稿）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [width, want] of Object.entries(TITLE[lang])) {
            assert.deepEqual(LINES[lang][width]['hero.title'], want, `防呆：${lang} ${width} 的期望要跟設計稿逐行表一樣`);
            const { context, h } = await open(lang, Number(width), { reduced: true });
            try {
                const got = await textLines(h.block('hero.title'));
                if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${lang} ${width}：大標 ${JSON.stringify(got)}，設計稿 ${JSON.stringify(want)}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], bad.join('；'));
});
