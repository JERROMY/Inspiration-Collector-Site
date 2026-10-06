// F4b.1 首屏宣傳片的暫停鍵（WCAG 2.2.2：自動播超過 5 秒要停得下來）。讀 out/（真的內容），真的開瀏覽器。
// 照設計稿第四批（3f2310c）的 動態.md「宣傳片的播放與暫停」與 home.css 的 .play／.play--ctl。
//
// 介面（README.md「03 首屏」那一節的 F4b）：首屏裡同一顆 <button data-play>，data-state 是 idle｜loading｜playing｜paused，
// 裡面兩個圖示（data-icon="play"、data-icon="pause"）都在；影片框是 data-corners 那個元素，鈕在它的左下角。
//
// 量什麼：
//   F4b.1 桌機會自動播（三語 1440×900，有滑鼠）：<html> 第一次畫就有 video-auto；從開頁到播放，鈕每一幀都是 44×44（不先閃 72）；
//         載入中、播放中的讀屏名字是 hero.video.pause；離影片框左緣、下緣各 24；播起來之後 data-state="playing"。
//         按一下 → 影片停、paused、讀屏名字 hero.video.play、還是 44、影片框與底下的影片說明不動、頁高不變；
//         捲走再捲回來 → 還是停著（使用者暫停的不會自己播回去）；再按 → 播、playing。
//         播放中捲出畫面 → 停（系統暫停）；捲回來 → 自己接著播。
//   F4b.1 鍵盤（三語 1440×900）：Tab 停得到、有焦點框；Enter 暫停、空白鍵播放。
//   F4b.1 載入中按下去（三語 1440×900，mp4 晚 5 秒才給）：開頁是 loading、44；按了 → video 沒有 src 屬性（停止載入）、paused、讀屏名字 hero.video.play；
//         mp4 放行之後 2 秒照樣沒在播。
//   F4b.1 自動播被擋（三語 1440×900，play() 丟 NotAllowedError）：鈕回到 idle、72×72、讀屏名字 hero.video.play（不能只靠 html.video-auto 畫成 44）。
//   F4b.1 不自動播的三種（三語）：只有手指 390 → idle、56×56；省流量、減少動態（1440×900）→ idle、72×72，<html> 沒有 video-auto；讀屏名字 hero.video.play；
//         只有手指按了 → 播、playing、44、讀屏名字 hero.video.pause。
//   F4b.1 關掉 JS（三語 1440×900、只有手指 390）：首屏看不到播放／暫停鈕；預覽圖與影片說明還在。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4b.1"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';
import { say, heroParts } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const TOUCH = { isMobile: true, hasTouch: true };
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

// 每一幀記鈕的大小（看得到的時候），與第一幀 <html> 有沒有 video-auto
const WATCH = () => {
    window.__btn = { sizes: [], autoAtFirstFrame: null };
    const tick = () => {
        if (window.__btn.autoAtFirstFrame === null && document.body) window.__btn.autoAtFirstFrame = document.documentElement.classList.contains('video-auto');
        const b = document.querySelector('[data-section="hero"] [data-play]');
        if (b) {
            const r = b.getBoundingClientRect();
            if (r.width > 0 && getComputedStyle(b).visibility !== 'hidden') window.__btn.sizes.push([Math.round(r.width), Math.round(r.height)]);
        }
        if (performance.now() < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};
const SAVE_DATA = () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g', addEventListener() {}, removeEventListener() {} } });
};
const BLOCK_AUTOPLAY = () => {
    HTMLMediaElement.prototype.play = function play() { return Promise.reject(new DOMException('自動播被擋（測試）', 'NotAllowedError')); };
};

async function open(lang, { width = 1440, height = 900, context: extra = {}, init = [], route = null } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, ...extra });
    if (route) await context.route(...route);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    for (const script of [WATCH, ...init]) await page.addInitScript(script);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    const h = heroParts(page);
    return { page, context, h, button: h.hero.locator('[data-play]') };
}

async function state(button) {
    return button.evaluate((b) => {
        const r = b.getBoundingClientRect();
        const frame = b.closest('[data-corners]');
        const f = frame ? frame.getBoundingClientRect() : null;
        const v = document.querySelector('[data-section="hero"] video');
        return {
            state: b.getAttribute('data-state'), label: b.getAttribute('aria-label'), w: r.width, h: r.height,
            left: f ? r.left - f.left : null, bottom: f ? f.bottom - r.bottom : null,
            icons: [...b.querySelectorAll('[data-icon]')].map((i) => i.getAttribute('data-icon')),
            visible: r.width > 0 && getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden',
            video: v ? { paused: v.paused, hasSrc: v.hasAttribute('src'), src: v.getAttribute('src') } : null,
        };
    });
}

const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout }).catch(() => {});
const playing = (page) => until(page, () => { const v = document.querySelector('[data-section="hero"] video'); const b = document.querySelector('[data-section="hero"] [data-play]'); return v && !v.paused && b && b.getAttribute('data-state') === 'playing'; });
const layout = (page) => page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n)); };
    return { frame: box(document.querySelector('[data-section="hero"] [data-corners]')), desc: box(document.querySelector('[data-section="hero"] [data-id="hero.video.label"]')), height: document.documentElement.scrollHeight };
});

for (const lang of LANGS) {
    test(`F4b.1 桌機會自動播（${lang} 1440×900）：一開始就是 44 的暫停鍵、按了暫停、捲走捲回來不自己播、系統暫停會接著播`, { skip: pw ? false : why }, async () => {
        const { page, context, button } = await open(lang);
        const pause = say(lang, 'hero.video.pause');
        const play = say(lang, 'hero.video.play');
        try {
            assert.equal(await button.count(), 1, '首屏要有一顆 [data-play] 的鈕（只有一顆）');
            const first = await state(button);
            assert.ok(['idle', 'loading', 'playing', 'paused'].includes(first.state), `要有 data-state（idle｜loading｜playing｜paused），得到 ${first.state}`);
            assert.ok(first.icons.includes('play') && first.icons.includes('pause'), `鈕裡兩個圖示都要在（data-icon="play"、"pause"），得到 ${first.icons.join('、')}`);
            await playing(page);
            const watch = await page.evaluate(() => window.__btn);
            assert.equal(watch.autoAtFirstFrame, true, '第一個畫格 <html> 就要有 video-auto（<head> 的外部 .js 在畫面出來之前加）');
            const big = watch.sizes.filter(([w, h]) => w > 45 || h > 45);
            assert.deepEqual(big.slice(0, 3), [], `從開頁到播放，鈕每一幀都要是 44×44（不先閃大的播放鈕），有 ${big.length} 幀比 44 大`);
            const on = await state(button);
            assert.equal(on.state, 'playing', `播起來之後 data-state 是 playing，得到 ${on.state}`);
            assert.ok(on.video && !on.video.paused, '影片要在播');
            assert.equal(on.label, pause, `播放中的讀屏名字是 hero.video.pause「${pause}」`);
            assert.ok(near(on.w, 44) && near(on.h, 44), `播放中是 44×44，得到 ${on.w}×${on.h}`);
            assert.ok(near(on.left, 24) && near(on.bottom, 24), `鈕在影片框左下角、離框邊 24，得到左 ${on.left}、下 ${on.bottom}`);

            const before = await layout(page);
            await button.click();
            await page.waitForTimeout(300);
            const off = await state(button);
            assert.ok(off.video.paused, '按了要停');
            assert.equal(off.state, 'paused', `按了之後 data-state 是 paused，得到 ${off.state}`);
            assert.equal(off.label, play, `暫停時的讀屏名字是 hero.video.play「${play}」`);
            assert.ok(near(off.w, 44) && near(off.h, 44), `暫停時還是 44×44，得到 ${off.w}×${off.h}`);
            assert.deepEqual(await layout(page), before, '換狀態不推動版面（影片框、影片說明、頁高不變）');

            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await page.waitForTimeout(600);
            await button.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(1500);
            const back = await state(button);
            assert.ok(back.video.paused && back.state === 'paused', `使用者按了暫停，捲走再捲回來不能自己播（paused ${back.video.paused}、data-state ${back.state}）`);

            await button.click();
            await playing(page);
            const again = await state(button);
            assert.ok(!again.video.paused && again.state === 'playing' && again.label === pause, `再按要播、playing、讀屏名字變回暫停，得到 ${JSON.stringify({ paused: again.video.paused, state: again.state, label: again.label })}`);

            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await page.waitForTimeout(800);
            assert.ok((await state(button)).video.paused, '播放中捲出畫面要停（系統暫停）');
            await button.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await playing(page);
            const resumed = await state(button);
            assert.ok(!resumed.video.paused && resumed.state === 'playing', `系統暫停的，捲回來要接著播（paused ${resumed.video.paused}、data-state ${resumed.state}）`);
        } finally {
            await context.close();
        }
    });
}

test('F4b.1 鍵盤（三語 1440×900）：Tab 停得到、有焦點框；Enter 暫停、空白鍵播放', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, button } = await open(lang);
        try {
            await playing(page);
            const on = await state(button);
            assert.ok(on.visible && on.state === 'playing', `${lang}：播放中要看得到暫停鍵、data-state 是 playing，得到 ${JSON.stringify({ visible: on.visible, state: on.state })}`);
            await page.keyboard.press('Tab');
            await button.focus();
            const ring = await button.evaluate((b) => ({ focused: document.activeElement === b, style: getComputedStyle(b).outlineStyle, width: parseFloat(getComputedStyle(b).outlineWidth) }));
            assert.ok(ring.focused, `${lang}：防呆：焦點要在鈕上`);
            assert.ok(ring.style !== 'none' && ring.width > 0, `${lang}：鍵盤聚焦時要看得到焦點框，得到 ${JSON.stringify(ring)}`);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);
            const s1 = await state(button);
            assert.ok(s1.video.paused && s1.state === 'paused', `${lang}：Enter 要暫停（paused ${s1.video.paused}、data-state ${s1.state}）`);
            await page.keyboard.press(' ');
            await playing(page);
            const s2 = await state(button);
            assert.ok(!s2.video.paused && s2.state === 'playing', `${lang}：空白鍵要播（paused ${s2.video.paused}、data-state ${s2.state}）`);
        } finally {
            await context.close();
        }
    }
});

test('F4b.1 載入中按下去（三語 1440×900，mp4 晚 5 秒）：停止載入、換成 44 的播放、之後不自己播', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        let release;
        const gate = new Promise((done) => { release = done; });
        const { page, context, button } = await open(lang, { route: ['**/*.mp4', async (route) => { await gate; await route.continue().catch(() => {}); }] });
        try {
            await page.waitForTimeout(800);
            const loading = await state(button);
            assert.equal(loading.state, 'loading', `${lang}：mp4 還沒到時是 loading，得到 ${loading.state}`);
            assert.ok(near(loading.w, 44), `${lang}：載入中是 44，得到 ${loading.w}`);
            assert.equal(loading.label, say(lang, 'hero.video.pause'), `${lang}：載入中的讀屏名字是 hero.video.pause`);
            await button.click();
            await page.waitForTimeout(300);
            const stopped = await state(button);
            assert.equal(stopped.video.hasSrc, false, `${lang}：載入中按下去要停止載入（video 拿掉 src 屬性），得到 src=${stopped.video.src}`);
            assert.equal(stopped.state, 'paused', `${lang}：載入中按下去換成 paused，得到 ${stopped.state}`);
            assert.equal(stopped.label, say(lang, 'hero.video.play'), `${lang}：讀屏名字換成 hero.video.play`);
            assert.ok(near(stopped.w, 44), `${lang}：還是 44，得到 ${stopped.w}`);
            release();
            await page.waitForTimeout(2000);
            const later = await state(button);
            assert.ok(later.video.paused && later.state === 'paused', `${lang}：mp4 放行之後也不能自己播（paused ${later.video.paused}、data-state ${later.state}）`);
        } finally {
            release();
            await context.close();
        }
    }
});

test('F4b.1 自動播被擋（三語 1440×900，play() 丟 NotAllowedError）：回到大的播放鈕 72、idle', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, button } = await open(lang, { init: [BLOCK_AUTOPLAY] });
        try {
            await until(page, () => document.querySelector('[data-section="hero"] [data-play]')?.getAttribute('data-state') === 'idle', null, 4000);
            const s = await state(button);
            assert.equal(s.state, 'idle', `${lang}：被擋之後 data-state 是 idle，得到 ${s.state}`);
            assert.ok(near(s.w, 72) && near(s.h, 72), `${lang}：被擋之後是 72×72 的大播放鈕（html 還有 video-auto 也一樣），得到 ${s.w}×${s.h}`);
            assert.equal(s.label, say(lang, 'hero.video.play'), `${lang}：讀屏名字是 hero.video.play`);
            assert.ok(s.visible, `${lang}：看得到`);
        } finally {
            await context.close();
        }
    }
});

for (const [label, options, size] of [
    ['只有手指 390', { width: 390, height: 844, context: TOUCH }, 56],
    ['省流量 1440', { init: [SAVE_DATA] }, 72],
    ['減少動態 1440', { context: { reducedMotion: 'reduce' } }, 72],
]) {
    test(`F4b.1 不自動播（${label}，三語）：一開始是 ${size} 的大播放鈕、idle、沒有 video-auto`, { skip: pw ? false : why }, async () => {
        for (const lang of LANGS) {
            const { page, context, button } = await open(lang, options);
            try {
                await page.waitForTimeout(800);
                const s = await state(button);
                assert.equal(s.state, 'idle', `${lang}：data-state 是 idle，得到 ${s.state}`);
                assert.ok(s.visible && near(s.w, size) && near(s.h, size), `${lang}：是 ${size}×${size} 的大播放鈕，得到 ${s.w}×${s.h}`);
                assert.equal(s.label, say(lang, 'hero.video.play'), `${lang}：讀屏名字是 hero.video.play`);
                assert.equal(await page.evaluate(() => document.documentElement.classList.contains('video-auto')), false, `${lang}：不自動播時 <html> 沒有 video-auto`);
                if (options.context === TOUCH) {
                    await button.click();
                    await playing(page);
                    const on = await state(button);
                    assert.ok(!on.video.paused && on.state === 'playing', `${lang}：按了要播、playing（paused ${on.video.paused}、data-state ${on.state}）`);
                    assert.ok(near(on.w, 44) && near(on.h, 44), `${lang}：播起來縮成 44×44，得到 ${on.w}×${on.h}`);
                    assert.equal(on.label, say(lang, 'hero.video.pause'), `${lang}：讀屏名字換成 hero.video.pause`);
                }
            } finally {
                await context.close();
            }
        }
    });
}

test('F4b.1 關掉 JS（三語 × 1440、只有手指 390）：沒有播放／暫停鈕，預覽圖與影片說明還在', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    for (const lang of LANGS) {
        for (const options of [{ viewport: { width: 1440, height: 900 } }, { viewport: { width: 390, height: 844 }, ...TOUCH }]) {
            const context = await browser.newContext({ ...options, javaScriptEnabled: false });
            const page = await context.newPage();
            try {
                await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                const h = heroParts(page);
                const w = options.viewport.width;
                assert.equal(await h.hero.locator('[data-play]:visible').count(), 0, `${lang} ${w}：關掉 JS 時看不到播放／暫停鈕（按了也不會動）`);
                assert.ok(await h.hero.locator('img[src*="hero-poster"]').first().isVisible(), `${lang} ${w}：預覽圖還在`);
                assert.ok(await h.block('hero.video.label').isVisible(), `${lang} ${w}：影片說明還在`);
            } finally {
                await context.close();
            }
        }
    }
});
