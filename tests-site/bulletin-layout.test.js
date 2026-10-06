// F3.11 02 公告條照設計稿的排法（第三批 4fce811 定的，第四批 3f2310c 沒變）、F3.10 公告條標題的詞界、F3.12 ✕ 的框。真的開瀏覽器。
//
// 2026-10-07 為什麼改：
//   - 真的公告換成 10-02 那一則、9-29 那則取消置頂（使用者），公告條的字跟設計稿不一樣，高度與位置跟著變（中 320 高 101、英 640 一行 61）、30 天後還會不見。
//     改用暫存複本：content/news.*.md 換成 fixtures/news-design/（設計稿那一則 9-29「ChatGPT 改版…」，置頂；helpers.js 的 buildDesignNews），其他照真的 content/。
//   - 有 JS 時公告條浮在導覽列下面（position: absolute、top: var(--nav-h)，不佔版面；public/bulletin.js、components/Bulletin）：
//     公告條自己的高度與三樣東西的位置，有 JS、關掉 JS 都照設計稿量（設計稿畫在導覽列正下方，兩種都在同一個位置）；
//     「公告條的高度一路推下來」（手指框按鈕的下緣）改成：有 JS 時＝設計稿扣掉公告條的高度、跟沒有公告條時一樣（不被推下去）。
//   - F3.10 詞界 <wbr> 從 layout.test.js 搬過來：原本用真的內容（「一定有一則置頂」），現在真的內容沒有置頂、新那一則的中文標題也沒有詞界可插。
//
// 設計稿的數字在 fixtures/design-6511462.json 的 bulletin（公告條整條高、「公告」標籤、標題、✕ 的 [x, y, 寬, 高]，有滑鼠、高 900）與 shareBottom。
// 量到的（2026-10-03，跟設計審查第三輪的實量一致）：手機（< 640）中 106、106、101、101、101、101，英 102，日 131、106、106、106、106、106（280～430）；
// 640 中 61、英 78、日 82；768～1440 三語 61。只有手指 360×780 的日文，手指框主要按鈕的下緣 737。
//
// 量什麼：
//   F3.11 手機（三語 × 280、320、360、375、390、430；有 JS、關掉 JS 各一次）：「公告」標籤與 ✕ 在上排、標題在下排（標題的頂在標籤與 ✕ 的底之下、左緣對齊標籤）；
//         整條高、標籤／標題／✕ 的位置與大小跟設計稿差 ≤ 2px；✕ 44×44；標籤與 ✕ 不重疊、✕ 不壓到標題。
//   F3.11 桌機（三語 × 640、768、1024、1280、1440；有 JS、關掉 JS 各一次）：整條高、三樣東西的位置與大小跟設計稿差 ≤ 2px（標題不限 25em，放得下就一行：768 起 61 高）。
//   F3.11 只有手指 360×780 的日文：有 JS 時公告條浮著（position: absolute、在導覽列正下方）—— 手指框主要按鈕（hero.share 那一顆）的下緣＝設計稿的 737
//         扣掉設計稿的公告條高（106），差 ≤ 2px；跟「沒有公告條」（全部記成看過）那一頁差 ≤ 1px。關掉 JS 時沒有分享鈕（F4.1b），比不了這一顆。
//   F3.10 公告條標題的詞界 <wbr>（後端 bindTail 插的）：中文的 DOM 裡有 <wbr>，日文、英文沒有（設計稿那一則：中文「暫時<wbr>不能用」）。
//   （F3.9 的「至少 60、左緣」不動。）
//   F3.12 公告條的 ✕ 是沒有框的圖示鈕：有滑鼠 390 強制 :hover、只有手指 390 強制 :active（Chrome 開發者協定）時，框是透明的（沒有框、寬 0 或透明）；
//         同一個寬度的 ☰（有框的圖示鈕）照樣長出螢光綠框（--color-accent-lime-default）。三語。設計稿 ba016e9 的 .iconbtn--ghost:is(:hover, :active…)。
//
// 跑法（在網站 repo 根目錄）：
//   node tests-site/run.mjs --test-name-pattern "F3.10|F3.11|F3.12"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, buildDesignNews, tail, tagAttrs } from './helpers.js';
import { bulletinParts, heroParts, say, parts, pressStyles } from './page-helpers.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));
const MOBILE = [280, 320, 360, 375, 390, 430];
const DESKTOP = [640, 768, 1024, 1280, 1440];
const TOL = 2;
const KEY = 'collector-bulletin-dismissed';

let build = null;
function built() {
    build ??= buildDesignNews('bulletin-layout');
    assert.equal(build.status, 0, `content/news.*.md 換成 fixtures/news-design 之後 build 失敗：\n${tail(build.output)}`);
    return build.out;
}
const { pw, why } = playwright();
const session = pw ? browserSession(pw, built) : null;
after(async () => { await session?.close(); build?.cleanup(); });

// 開頁；有 JS 時等載入畫面收掉（public/motion.js 的 html.loading）
async function openPage(lang, { width, height = 900, js = true, extra = {}, init = [] }) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', javaScriptEnabled: js, ...extra });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    for (const script of init) await page.addInitScript(script);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (js) await page.waitForFunction(() => !document.documentElement.classList.contains('loading'), null, { timeout: 5000 });
    return { page, context };
}

async function measure(lang, width, js) {
    const { page, context } = await openPage(lang, { width, js });
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
    test(`F3.11 公告條手機排法（${lang}，280～430，有 JS 與關掉 JS）：標籤與 ✕ 上排、標題下排，高度與位置照設計稿`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [width, js] of MOBILE.flatMap((w) => [[w, true], [w, false]])) {
            const got = await measure(lang, width, js);
            bad.push(...compare(`${lang}${js ? '' : '（關掉 JS）'}`, width, got, DESIGN.bulletin[lang][width]));
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
    test(`F3.11 公告條桌機排法（${lang}，640～1440，有 JS 與關掉 JS）：高度與位置照設計稿（768 起一行、61 高）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const js of [true, false]) for (const width of DESKTOP) bad.push(...compare(`${lang}${js ? '' : '（關掉 JS）'}`, width, await measure(lang, width, js), DESIGN.bulletin[lang][width]));
        assert.deepEqual(bad, [], `${bad.length} 處跟設計稿不一樣`);
    });
}

test('F3.11 只有手指 360×780 的日文：有 JS 時公告條浮在導覽列下面 —— 手指框主要按鈕的下緣＝設計稿扣掉公告條的高度，跟沒有公告條時一樣', { skip: pw ? false : why }, async () => {
    // 關掉 JS 時沒有分享鈕（網址直接寫在框裡，F4.1b），比不了這一顆；關掉 JS 時公告條在原位推下 main，在 bulletin.test.js 的 F3.4 量
    const extra = { isMobile: true, hasTouch: true };
    const shareBottom = async (opts) => {
        const { page, context } = await openPage('ja', { width: 360, height: 780, extra, ...opts });
        try {
            const share = heroParts(page).hero.getByRole('button', { name: say('ja', 'hero.share') });
            const r = await share.boundingBox();
            assert.ok(r, '找不到手指框的「この URL を共有」');
            const b = bulletinParts(page, 'ja');
            const bar = (await b.region.count()) ? await b.region.evaluate((el) => ({ position: getComputedStyle(el).position, top: el.getBoundingClientRect().top, nav: document.querySelector('header')?.getBoundingClientRect().bottom ?? null })) : null;
            return { bottom: r.y + r.height, bar };
        } finally {
            await context.close();
        }
    };
    const on = await shareBottom({});
    assert.ok(on.bar, '防呆：有 JS 時公告條要看得到（設計稿那一則、置頂）');
    assert.equal(on.bar.position, 'absolute', '有 JS 時公告條要浮著（position: absolute，不佔版面）');
    assert.ok(on.bar.nav !== null && Math.abs(on.bar.top - on.bar.nav) <= 1, `有 JS 時公告條要貼在導覽列正下方（公告條上緣 ${on.bar.top}、導覽列下緣 ${on.bar.nav}）`);
    const want = DESIGN.shareBottom.ja - DESIGN.bulletin.ja['360'].h;
    assert.ok(Math.abs(on.bottom - want) <= TOL, `有 JS：主要按鈕的下緣 ${on.bottom.toFixed(1)}，要是設計稿 ${DESIGN.shareBottom.ja} 扣掉公告條高 ${DESIGN.bulletin.ja['360'].h}＝${want}`);
    // 「沒有公告條」的那一頁：把公告的 id 都記成看過（<head> 的 <meta name="collector-bulletin"> 裡的 id）
    const meta = tagAttrs(fs.readFileSync(path.join(built(), 'ja', 'index.html'), 'utf8'), 'meta').find((a) => a.name === 'collector-bulletin');
    const ids = JSON.parse(meta.content).map((e) => e.id);
    const hidden = await shareBottom({ init: [`(() => { try { localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(ids))}); } catch {} })()`] });
    assert.equal(hidden.bar, null, '防呆：記成看過之後公告條不出現');
    assert.ok(Math.abs(on.bottom - hidden.bottom) <= 1, `有 JS 時公告條不能把首屏推下去：有公告條 ${on.bottom.toFixed(1)}、沒有公告條 ${hidden.bottom.toFixed(1)}`);
});

test('F3.10 公告條標題的詞界 <wbr>：中文有、日文英文沒有（設計稿那一則，fixtures/news-design）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await openPage(lang, { width: 390 });
        try {
            const b = bulletinParts(page, lang);
            assert.equal(await b.region.count(), 1, `${lang}：防呆：公告條要看得到`);
            const n = await b.text.evaluate((el) => el.querySelectorAll('wbr').length);
            if (lang === 'zh') assert.ok(n > 0, 'zh：公告條標題的 DOM 裡要有 <wbr>（後端 bindTail 在中文詞界插的）');
            else assert.equal(n, 0, `${lang}：公告條標題不能有 <wbr>（只有中文插）`);
        } finally {
            await context.close();
        }
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

