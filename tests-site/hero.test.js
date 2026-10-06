// F4.1 首屏的按鈕與手機的分享框、F4.2 宣傳片。讀 out/（真的內容），真的開瀏覽器。
//
// 量什麼：
//   F4.1 桌機（1440，三語）：首屏「加到 Chrome」（hero.cta）連到商店頁、點了真的走過去；「看教學影片」（hero.watch）連到 #tutorial；「看支援裝置」（hero.meta.devices）連到 #devices。
//   F4.1 只有手指（isMobile＋hasTouch，390，三語）：看不到 hero.cta；看得到分享框 —— hero.mobile.text（第一段包 <b>，＝hero.mobile.bold）、
//        「分享這個網址」（hero.share）、「寄給自己」（hero.mail：mailto: 收件人空白、主旨是 mail.self.subject、內文有 https://collector.jerromy.com/<語言>/?ref=mail）、
//        「用的是電腦？」（hero.pc：連到商店、最後一個 .nw 的最後是箭頭 data-icon="arrow"）。
//   F4.1 分享：有 navigator.share 就呼叫它（title＝share.title、text＝share.text、url 有 /<語言>/）；沒有就把網址寫進剪貼簿、浮出 role="status" 的「已複製」（state.copied）：
//        position: fixed（不推動版面：main 的位置不變）、1 秒與 3 秒時看得到、4 秒時已經收掉（設計稿第四批：停 --dur-breathe 3.2 秒再淡出，原本是約 2 秒）。
//   F4.1b 分享的退路（設計第三批 notes/4-3.md、home.css 的 .touch--noshare）：只有手指 390 三語 ——
//        沒有 navigator.share、剪貼簿也寫不進去（或 share 丟出 AbortError 以外的錯、剪貼簿也不行）→ 按「分享這個網址」之後，手指框加上 class touch--noshare：
//        分享鈕收起、看得到 share.fallback（data-id）的那一句與網址框（translate="no"，字是 https://collector.jerromy.com/<語言>/），焦點移到網址框；
//        不跳 prompt()／alert() 這類對話框、不浮「已複製」。share 丟出 AbortError（使用者自己取消）→ 什麼都不做。
//        關掉 JS：不用按，網址框直接看得到、分享鈕看不到（網址寫在 HTML 裡）。
//   F4.2 桌機 1440×360（宣傳片在第一屏下面）：載入畫面期間就開始下載這一語的 mp4，但看不到不播；捲到看得到 → 播（靜音、循環、/media/hero-<語言>.mp4）、
//        第一次播在首頁出現（collector:loaded）之後；捲出去 → 停。
//        預覽圖（/images/hero-poster-<語言>-*.webp 或 /media/hero-poster-<語言>.webp）整張顯示、不水平裁切（框是 1920:1080，圖跟框同寬、同左緣）；燒進去的進度條由框裡最下方一條遮罩（框的 ::after，高 50/1080、不擋點擊）蓋住；影片跟預覽圖同一個框（位置與大小一樣）。
//   F4.2 只有手指 390（宣傳片在第一屏）：一樣自動播 —— <html> 有 video-auto、載入畫面期間抓這一語的 mp4、首頁出現（collector:loaded）之後才開始播、
//        靜音；鈕是暫停鍵（hero.video.pause）；按下去暫停。
//   F4.2 載入畫面（public/motion.js 的 html.loading）：有 JS 才有（DOMContentLoaded 時就在）；會自動播宣傳片時等影片能順順播完（canplaythrough），
//        影片一直不回 → 1.3 秒時還在、2.6 秒內收掉（上限 2 秒＋淡出）；減少動態（不自動播、不等影片）→ 影片一直不回也在 1.3 秒內收掉（上限 1 秒）、不抓 mp4。
//   F4.2 省流量（navigator.connection.saveData）、減少動態（桌機 1440×900）：不播、不抓 mp4，看得到預覽圖與播放鈕。
//   F4.2 桌機 1440×900 的 LCP 是預覽圖（hero-poster），而且 ≤ 2.5 秒。
//   F4.2 影片說明（<details>，summary 的字是 hero.video.label）：鍵盤 Enter 打開、再按一次收起。
//   F4.2 預覽圖的替代文字（alt）是字串表 hero.video.alt 的純文字（三語）。
//
// 2026-10-07 為什麼改（使用者決定：手機也自動播；載入畫面期間就下載首屏影片、canplaythrough 才淡出、最多等 2 秒；淡出那一刻才 play()；public/hero.js、public/motion.js）：
//   F4.2 桌機「還沒進畫面不能抓 mp4」→「載入畫面期間就抓、看不到不播」；F4.2 手機「開頁不抓 mp4、按了才播」→「一樣自動播、首頁出現之後才播」；
//   新加載入畫面那一條。開頁之後一律先等載入畫面收掉（它蓋住整頁，最多 2 秒）：F4.1 分享那條按鈕被它擋住時，Playwright 換角度捲動重試，main 的位置就變了。
//   F4.10 三語 × 有滑鼠 1440、只有手指 390：開頁、等動態 A 播完（2.5 秒）、捲到 04 再等 2 秒（B 播完），整段沒有頁面錯誤（pageerror，
//        例如 React 的 #418：接手時 DOM 跟伺服器畫的對不上）、主控台沒有 error。紅的時候列出每一則。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.1|F4.2|F4.10"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';
import { say, heroParts, STORE } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const TOUCH = { isMobile: true, hasTouch: true };

// waitLoaded：開頁之後等載入畫面（html.loading）收掉再交給測試（它蓋住整頁，點擊會被擋）
async function open(lang, { width = 1440, height = 900, context: extra = {}, init = [], hash = '', waitLoaded = true } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, ...extra });
    await context.route('https://chromewebstore.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>store</title>' }));
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    // 抓了哪些 mp4：看伺服器收到的請求（Playwright 的 request 事件在影片的請求上量過會漏）；同一支檔的測試一個接一個跑，從開頁那一刻算起
    const start = site.requests.length;
    const mp4 = {
        get list() { return site.requests.slice(start).filter((r) => /\.mp4$/.test(r.path)).map((r) => r.path); },
    };
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`${msg.text()}${msg.location()?.url ? `（${msg.location().url}）` : ''}`); });
    for (const script of init) await page.addInitScript(script);
    await page.goto(`${site.url}/${lang}/${hash}`, { waitUntil: 'load' });
    if (waitLoaded) await page.waitForFunction(() => !document.documentElement.classList.contains('loading'), null, { timeout: 5000 });
    return { site, page, context, mp4, errors, consoleErrors, h: heroParts(page) };
}

const hrefOf = async (locator) => locator.getAttribute('href');

for (const lang of LANGS) {
    test(`F4.1 桌機的按鈕（${lang} 1440）：加到 Chrome 連到商店、看教學影片、看支援裝置`, { skip: pw ? false : why }, async () => {
        const { page, context, h } = await open(lang);
        try {
            const cta = h.hero.getByRole('link', { name: say(lang, 'hero.cta'), exact: true });
            assert.ok(await cta.isVisible(), `首屏要看得到「${say(lang, 'hero.cta')}」`);
            assert.equal(await hrefOf(cta), STORE, '「加到 Chrome」連到商店頁');
            assert.equal(await hrefOf(h.hero.getByRole('link', { name: say(lang, 'hero.watch') })), '#tutorial', '「看教學影片」連到 #tutorial');
            assert.equal(await hrefOf(h.hero.getByRole('link', { name: say(lang, 'hero.meta.devices') })), '#devices', '「看支援裝置」連到 #devices');
            assert.ok(!(await h.block('hero.mobile.text').isVisible()), '有滑鼠時看不到手機的分享框');
            await Promise.all([page.waitForURL((u) => u.href.startsWith(STORE), { timeout: 5000 }), cta.click()]);
            assert.ok(page.url().startsWith(STORE), `點了要走到商店頁，得到 ${page.url()}`);
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    test(`F4.1 只有手指（${lang} 390）：分享框 —— 粗體那段、分享、寄給自己（mailto）、用的是電腦？`, { skip: pw ? false : why }, async () => {
        const { page, context, h } = await open(lang, { width: 390, height: 844, context: TOUCH });
        try {
            assert.equal(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches), true, '防呆：模擬只有手指沒有生效');
            assert.ok(!(await h.hero.getByRole('link', { name: say(lang, 'hero.cta'), exact: true }).isVisible()), '只有手指時看不到「加到 Chrome」那顆');
            const text = h.block('hero.mobile.text');
            assert.ok(await text.isVisible(), '看得到分享框的說明（data-id="hero.mobile.text"）');
            assert.equal(await text.locator('b').count(), 1, '分享框的說明要有一個 <b>（<Seg bold>：hero.mobile.bold 那一段）');
            assert.equal((await text.locator('b').textContent()).replace(/\s+/g, ' ').trim(), say(lang, 'hero.mobile.bold'), '<b> 包的是 hero.mobile.bold 那一段');
            assert.ok(await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).isVisible(), `看得到「${say(lang, 'hero.share')}」`);
            const mail = h.hero.getByRole('link', { name: say(lang, 'hero.mail') });
            assert.ok(await mail.isVisible(), `看得到「${say(lang, 'hero.mail')}」`);
            const href = await hrefOf(mail);
            assert.ok(href.startsWith('mailto:?'), `寄給自己的收件人要空白（mailto:?…），得到 ${href}`);
            const q = new URLSearchParams(href.slice('mailto:?'.length));
            assert.equal(q.get('subject'), say(lang, 'mail.self.subject'), '主旨是 mail.self.subject');
            const url = `https://collector.jerromy.com/${lang}/?ref=mail`;
            assert.ok((q.get('body') ?? '').includes(url), `內文要有 ${url}，得到 ${q.get('body')}`);
            assert.equal(q.get('body'), plainBody(lang, url), '內文是 mail.self.body（%url% 換成這一頁的網址＋?ref=mail）');
            const pc = h.block('hero.pc').locator('xpath=ancestor::a[1]');
            assert.ok(await pc.isVisible(), `看得到「${say(lang, 'hero.pc')}」（連結裡的 data-id="hero.pc"）`);
            assert.equal((await pc.textContent()).replace(/\s+/g, ''), say(lang, 'hero.pc').replace(/\s+/g, ''), '連結的字是 hero.pc');
            assert.equal(await hrefOf(pc), STORE, '「用的是電腦？」連到商店頁');
            assert.equal(await pc.evaluate((a) => { const nws = a.querySelectorAll('.nw'); const last = nws[nws.length - 1]; return last && last.lastElementChild ? last.lastElementChild.getAttribute('data-icon') : null; }), 'arrow', '箭頭圖示（data-icon="arrow"）在最後一個 .nw 的最後面');
        } finally {
            await context.close();
        }
    });
}

function plainBody(lang, url) {
    return say(lang, 'mail.self.body').replace('%url%', url);
}

const SHARE_STUB = () => {
    window.__shared = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data) => { window.__shared = data; } });
};
const NO_SHARE = () => {
    window.__copied = null;
    try { delete Navigator.prototype.share; } catch {}
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
};

test('F4.1 分享：有 navigator.share 就用它（三語 390 只有手指）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { width: 390, height: 844, context: TOUCH, init: [SHARE_STUB] });
        try {
            await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).click();
            await page.waitForFunction(() => window.__shared !== null, null, { timeout: 2000 }).catch(() => {});
            const shared = await page.evaluate(() => window.__shared);
            assert.ok(shared, `${lang}：按「分享這個網址」要呼叫 navigator.share`);
            assert.equal(shared.title, say(lang, 'share.title'), `${lang}：分享的 title 是 share.title`);
            assert.equal(shared.text, say(lang, 'share.text'), `${lang}：分享的 text 是 share.text`);
            assert.ok(new URL(shared.url).pathname === `/${lang}/`, `${lang}：分享的網址是這一頁（/${lang}/），得到 ${shared.url}`);
        } finally {
            await context.close();
        }
    }
});

test('F4.1 分享：沒有 navigator.share 就複製網址、浮出「已複製」（role=status、不推動版面、停 3.2 秒後收掉）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { width: 390, height: 844, context: TOUCH, init: [NO_SHARE] });
        try {
            const before = await page.locator('main').first().boundingBox();
            const height = await page.evaluate(() => document.documentElement.scrollHeight);
            await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).click();
            const toast = page.getByRole('status').filter({ hasText: say(lang, 'state.copied') });
            await toast.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
            assert.ok(await toast.isVisible(), `${lang}：要浮出 role="status" 的「${say(lang, 'state.copied')}」`);
            assert.ok(new URL(await page.evaluate(() => window.__copied)).pathname === `/${lang}/`, `${lang}：要把這一頁的網址寫進剪貼簿`);
            assert.equal(await toast.evaluate((el) => { let n = el; while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement; return Boolean(n); }), true, `${lang}：「已複製」要 position: fixed（浮在畫面上，不推動版面）`);
            assert.deepEqual(await page.locator('main').first().boundingBox(), before, `${lang}：浮出「已複製」之後 main 的位置不能變`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), height, `${lang}：頁面高度不能變`);
            await page.waitForTimeout(1000);
            assert.ok(await toast.isVisible(), `${lang}：1 秒時「已複製」還在`);
            await page.waitForTimeout(2000);
            assert.ok(await toast.isVisible(), `${lang}：3 秒時「已複製」還在（停 --dur-breathe，3.2 秒）`);
            await page.waitForTimeout(1000);
            assert.ok(!(await toast.isVisible()), `${lang}：停 3.2 秒、淡出之後要收掉（4 秒時還在）`);
        } finally {
            await context.close();
        }
    }
});

// 影片什麼都還沒載：沒有 video、或 readyState 0 而且沒有緩衝（量網路請求之外再量一次：同一個瀏覽器裡別的分頁抓過的影片，請求可能不會再送到伺服器）
const idle = (h) => h.hero.evaluate((hero) => { const v = hero.querySelector('video'); return !v || (v.readyState === 0 && v.buffered.length === 0); });

async function media(page, h) {
    return h.hero.evaluate((hero) => {
        const v = hero.querySelector('video');
        const img = [...hero.querySelectorAll('img')].find((i) => /hero-poster/.test(i.currentSrc || i.src));
        // 文件座標（加上捲動量）：捲動前後比得起來
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n * 10) / 10) : null; };
        const crop = img ? img.parentElement.getBoundingClientRect() : null;
        const ir = img ? img.getBoundingClientRect() : null;
        const mask = img ? getComputedStyle(img.parentElement, '::after') : null;
        return {
            fullWidth: crop && ir ? Math.abs(ir.width - crop.width) <= 1 && Math.abs(ir.left - crop.left) <= 1 : null,
            mask: mask && crop ? { content: mask.content, height: parseFloat(mask.height), crop: crop.height, events: mask.pointerEvents, bottom: mask.bottom } : null,
            video: v ? { paused: v.paused, muted: v.muted, loop: v.loop, src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || '', box: box(v), visible: getComputedStyle(v).visibility !== 'hidden' && getComputedStyle(v).opacity !== '0' } : null,
            poster: img ? { src: img.currentSrc || img.src, box: box(img), visible: getComputedStyle(img).visibility !== 'hidden' && Boolean(box(img)) } : null,
            ratio: crop && crop.height ? crop.width / crop.height : null,
        };
    });
}

// 首頁出現（collector:loaded）與宣傳片第一次 playing 的時刻（performance.now()）；載入畫面什麼時候收掉、DOMContentLoaded 時有沒有載入畫面
const TIMES = () => {
    window.__t = { loaded: null, playing: null, loadingAtDcl: null, loadingSeen: false, loadingOff: null };
    document.addEventListener('collector:loaded', () => { window.__t.loaded ??= performance.now(); }, true);
    // playing 不會冒泡：在 document 的捕獲階段接（一樣收得到）
    document.addEventListener('playing', (e) => { if (e.target.closest?.('[data-section="hero"]')) window.__t.playing ??= performance.now(); }, true);
    document.addEventListener('DOMContentLoaded', () => { window.__t.loadingAtDcl = document.documentElement.classList.contains('loading'); });
    // 看 document 整棵（init script 跑的時候 <html> 還不是後來那一個，直接看 documentElement 收不到）
    new MutationObserver(() => {
        const on = document.documentElement.classList.contains('loading');
        if (on) window.__t.loadingSeen = true;
        else if (window.__t.loadingSeen && window.__t.loadingOff === null) window.__t.loadingOff = performance.now();
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
};
const times = (page) => page.evaluate(() => window.__t);

for (const lang of LANGS) {
    test(`F4.2 桌機（${lang} 1440×360）：載入畫面期間就下載、看不到不播；看得到才播（首頁出現之後）、靜音循環、捲出去就停；跟語言換那一支；預覽圖與影片同一個裁切`, { skip: pw ? false : why }, async () => {
        const { page, context, h, mp4 } = await open(lang, { width: 1440, height: 360, init: [TIMES] });
        try {
            await page.waitForTimeout(800);
            const first = await media(page, h);
            assert.ok(first.poster, '首屏要有宣傳片的預覽圖（hero-poster）');
            assert.match(new URL(first.poster.src).pathname, new RegExp(`^/(images/hero-poster-${lang}-\\d+\\.webp|media/hero-poster-${lang}\\.webp)$`), `預覽圖是這個語言的那一張，得到 ${first.poster.src}`);
            assert.ok(first.ratio && Math.abs(first.ratio - 1920 / 1080) < 0.01, `預覽圖的框是 1920:1080（整張顯示），得到 ${first.ratio}`);
            assert.equal(first.fullWidth, true, '預覽圖不水平裁切：跟框同寬、同左緣（粒子版的記號括號與頁數貼近左右邊）');
            assert.ok(first.mask && first.mask.content !== 'none' && first.mask.bottom === '0px' && first.mask.events === 'none'
                && Math.abs(first.mask.height - first.mask.crop * 50 / 1080) <= 1, `框裡最下方要有一條蓋住進度條的遮罩（高 50/1080、貼底、不擋點擊），得到 ${JSON.stringify(first.mask)}`);
            assert.equal(await page.evaluate(() => document.documentElement.classList.contains('video-auto')), true, '桌機要自動播（<html> 有 video-auto）');
            assert.ok(mp4.list.includes(`/media/hero-${lang}.mp4`), `載入畫面期間就要開始下載這一語的 mp4（/media/hero-${lang}.mp4），得到 ${mp4.list.join('、') || '沒有'}`);
            assert.ok(mp4.list.every((u) => u === `/media/hero-${lang}.mp4`), `只抓這一語那一支，得到 ${[...new Set(mp4.list)].join('、')}`);
            assert.ok(!first.video || first.video.paused, '影片還沒進畫面時不能播');
            assert.equal((await times(page)).playing, null, '影片還沒進畫面時不能播過');
            await h.frame.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForFunction(() => { const v = document.querySelector('[data-section="hero"] video'); return v && !v.paused; }, null, { timeout: 4000 }).catch(() => {});
            const playing = await media(page, h);
            assert.ok(playing.video && !playing.video.paused, '捲到看得到要開始播');
            assert.equal(playing.video.muted, true, '要靜音');
            assert.equal(playing.video.loop, true, '要循環');
            assert.equal(new URL(playing.video.src).pathname, `/media/hero-${lang}.mp4`, '播的是這個語言那一支');
            assert.ok(playing.video.box && first.poster.box && playing.video.box.every((n, i) => Math.abs(n - first.poster.box[i]) <= 1), `影片要跟預覽圖同一個裁切（同大小、同位置），影片 ${playing.video.box}、預覽圖 ${first.poster.box}`);
            const t = await times(page);
            assert.ok(t.loaded !== null && t.playing !== null && t.playing >= t.loaded, `第一次播要在首頁出現（collector:loaded）之後，得到 ${JSON.stringify(t)}`);
            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await page.waitForTimeout(800);
            const out = await media(page, h);
            assert.ok(out.video && out.video.paused, '捲出畫面就要停');
        } finally {
            await context.close();
        }
    });
}

test('F4.2 只有手指（390，三語）：一樣自動播 —— 載入畫面期間抓這一語的 mp4、首頁出現之後才播、靜音；鈕是暫停鍵、按下去暫停', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h, mp4 } = await open(lang, { width: 390, height: 844, context: TOUCH, init: [TIMES] });
        try {
            assert.equal(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches), true, '防呆：模擬只有手指沒有生效');
            assert.equal(await page.evaluate(() => document.documentElement.classList.contains('video-auto')), true, `${lang}：手機也要自動播（<html> 有 video-auto）`);
            assert.ok(mp4.list.includes(`/media/hero-${lang}.mp4`), `${lang}：載入畫面期間就要開始下載這一語的 mp4，得到 ${mp4.list.join('、') || '沒有'}`);
            await page.waitForFunction(() => { const v = document.querySelector('[data-section="hero"] video'); return v && !v.paused; }, null, { timeout: 5000 }).catch(() => {});
            const m = await media(page, h);
            assert.ok(m.video && !m.video.paused, `${lang}：首頁出現之後要自己播（宣傳片在第一屏）`);
            assert.equal(new URL(m.video.src).pathname, `/media/hero-${lang}.mp4`, `${lang}：播的是這一語那一支`);
            assert.equal(m.video.muted, true, `${lang}：要靜音`);
            const t = await times(page);
            assert.ok(t.loaded !== null && t.playing !== null && t.playing >= t.loaded, `${lang}：第一次播要在首頁出現（collector:loaded）之後，得到 ${JSON.stringify(t)}`);
            const pause = h.hero.getByRole('button', { name: say(lang, 'hero.video.pause') });
            assert.ok(await pause.isVisible(), `${lang}：播放中的鈕是暫停鍵（${say(lang, 'hero.video.pause')}）`);
            await pause.click();
            await page.waitForTimeout(300);
            assert.equal((await media(page, h)).video.paused, true, `${lang}：按暫停要停`);
        } finally {
            await context.close();
        }
    }
});

test('F4.2 載入畫面：有 JS 才有；等宣傳片時影片一直不回最多約 2 秒、不等影片（減少動態）最多約 1 秒（zh 1440×900）', { skip: pw ? false : why }, async () => {
    for (const [label, extra, min, max] of [['自動播（等影片）', {}, 1300, 2600], ['減少動態（不等影片）', { reducedMotion: 'reduce' }, 0, 1300]]) {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...extra });
        await context.route('**/media/hero-*.mp4', () => {});   // 一直不回
        const page = await context.newPage();
        try {
            await page.addInitScript(TIMES);
            await page.goto(`${site.url}/zh/`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__t.loadingOff !== null, null, { timeout: 6000 }).catch(() => {});
            const t = await times(page);
            assert.equal(t.loadingAtDcl, true, `${label}：有 JS 時 DOMContentLoaded 那一刻要有載入畫面（html.loading）`);
            assert.ok(t.loadingOff !== null, `${label}：載入畫面要收掉`);
            assert.ok(t.loadingOff >= min && t.loadingOff <= max, `${label}：影片一直不回時載入畫面要在 ${min}～${max}ms 之間收掉（從開頁算），得到 ${Math.round(t.loadingOff)}ms`);
            const auto = await page.evaluate(() => document.documentElement.classList.contains('video-auto'));
            assert.equal(auto, label.startsWith('自動播'), `${label}：防呆：video-auto 要是 ${label.startsWith('自動播')}`);
        } finally {
            await context.close();
        }
    }
    const { site, browser } = await session.get();
    const off = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    try {
        const page = await off.newPage();
        await page.goto(`${site.url}/zh/`, { waitUntil: 'load' });
        assert.equal(await page.evaluate(() => document.documentElement.className.includes('loading')), false, '關掉 JS 時沒有載入畫面');
        const cover = await page.evaluate(() => getComputedStyle(document.documentElement, '::after').content);
        assert.ok(cover === 'none' || cover === 'normal', `關掉 JS 時 <html> 的 ::after 不能蓋住頁面，得到 content ${cover}`);
    } finally {
        await off.close();
    }
});

const SAVE_DATA = () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g', addEventListener() {}, removeEventListener() {} } });
};

for (const [label, options] of [['省流量（saveData）', { init: [SAVE_DATA] }], ['減少動態', { context: { reducedMotion: 'reduce' } }]]) {
    test(`F4.2 ${label}（桌機 1440×900，三語）：不播、不抓 mp4，顯示預覽圖＋播放鈕`, { skip: pw ? false : why }, async () => {
        for (const lang of LANGS) {
            const { page, context, h, mp4 } = await open(lang, options);
            try {
                if (options.init) assert.equal(await page.evaluate(() => navigator.connection.saveData), true, '防呆：saveData 要是 true');
                await page.waitForTimeout(2000);
                assert.deepEqual(mp4.list, [], `${lang}：${label}時不能抓 mp4`);
                assert.equal(await idle(h), true, `${lang}：${label}時影片什麼都還沒載（readyState 0、沒有緩衝）`);
                const m = await media(page, h);
                assert.ok(!m.video || m.video.paused, `${lang}：${label}時不能播`);
                assert.ok(m.poster && m.poster.visible, `${lang}：看得到預覽圖`);
                assert.ok(await h.hero.getByRole('button', { name: say(lang, 'hero.video.play') }).isVisible(), `${lang}：看得到播放鈕`);
            } finally {
                await context.close();
            }
        }
    });
}

test('F4.2 桌機 LCP 是預覽圖、≤ 2.5 秒（1440×900，三語）', { skip: pw ? false : why }, async () => {
    const LCP = () => {
        window.__lcp = [];
        new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lcp.push({ t: e.startTime, tag: e.element ? e.element.tagName : null, url: e.url }); })
            .observe({ type: 'largest-contentful-paint', buffered: true });
    };
    for (const lang of LANGS) {
        const { page, context } = await open(lang, { init: [LCP] });
        try {
            await page.waitForTimeout(1500);
            const entries = await page.evaluate(() => window.__lcp);
            const last = entries[entries.length - 1];
            assert.ok(last, `${lang}：量不到 LCP`);
            assert.ok(/hero-poster/.test(last.url ?? ''), `${lang}：LCP 要是宣傳片的預覽圖，得到 ${JSON.stringify(last)}`);
            assert.ok(last.t <= 2500, `${lang}：LCP 要 ≤ 2.5 秒，得到 ${Math.round(last.t)}ms`);
        } finally {
            await context.close();
        }
    }
});

test('F4.2 影片說明（<details>）可以用鍵盤開合（三語）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang);
        try {
            const summary = h.hero.locator('details > summary').filter({ hasText: say(lang, 'hero.video.label') });
            assert.equal(await summary.count(), 1, `${lang}：要有一個 summary 寫著 hero.video.label「${say(lang, 'hero.video.label')}」`);
            const desc = h.block('hero.video.desc');
            assert.equal((await desc.textContent()).replace(/\s+/g, ''), say(lang, 'hero.video.desc').replace(/\s+/g, ''), `${lang}：說明的字是 hero.video.desc（收著也在 HTML 裡）`);
            await summary.focus();
            await page.keyboard.press('Enter');
            assert.equal(await summary.evaluate((s) => s.parentElement.open), true, `${lang}：Enter 要打開`);
            assert.ok(await desc.isVisible(), `${lang}：打開後看得到說明`);
            await page.keyboard.press('Enter');
            assert.equal(await summary.evaluate((s) => s.parentElement.open), false, `${lang}：再按 Enter 要收起`);
        } finally {
            await context.close();
        }
    }
});

test('F4.2 預覽圖的替代文字是字串表的 hero.video.alt（三語）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang);
        try {
            const alts = await h.hero.locator('img').evaluateAll((imgs) => imgs.filter((i) => /hero-poster/.test(i.currentSrc || i.src)).map((i) => i.getAttribute('alt')));
            assert.equal(alts.length, 1, `${lang}：首屏要有一張宣傳片的預覽圖（hero-poster）`);
            assert.equal(alts[0], say(lang, 'hero.video.alt'), `${lang}：預覽圖的 alt 要是 hero.video.alt 的純文字（getPlainString）`);
            assert.ok(await page.locator('[data-section="hero"]').isVisible(), '首屏要在');
        } finally {
            await context.close();
        }
    }
});

const CANONICAL = (lang) => `https://collector.jerromy.com/${lang}/`;
const SHARE_FAILS = (mode) => {
    window.__dialogs = 0;
    if (mode === 'missing') {
        try { delete Navigator.prototype.share; } catch {}
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    } else {
        const name = mode === 'abort' ? 'AbortError' : 'NotAllowedError';
        Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('測試：分享不行', name); } });
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('測試：剪貼簿不行', 'NotAllowedError'); } } });
};

async function noshare(lang, mode) {
    const { page, context, h } = await open(lang, { width: 390, height: 844, context: TOUCH });
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs += 1; d.dismiss().catch(() => {}); });
    await page.addInitScript(SHARE_FAILS, mode);
    await page.reload({ waitUntil: 'load' });
    return { page, context, h, dialogs: () => dialogs };
}

for (const lang of LANGS) {
    test(`F4.1b 分享的退路（${lang} 390 只有手指）：分享選單與剪貼簿都不行 → 手指框改顯示 share.fallback 與網址（.touch--noshare），不用 prompt()`, { skip: pw ? false : why }, async () => {
        const { page, context, h, dialogs } = await noshare(lang, 'missing');
        try {
            assert.equal(await h.hero.locator('.touch--noshare').count(), 0, '防呆：還沒按之前不是 touch--noshare');
            await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).click();
            await page.waitForTimeout(300);
            assert.equal(dialogs(), 0, '不能跳 prompt()／alert() 這類對話框');
            const box = h.hero.locator('.touch--noshare');
            assert.equal(await box.count(), 1, '按了之後手指框要加上 class touch--noshare');
            assert.equal(await box.locator('[data-id="hero.mobile.text"]').count(), 1, 'touch--noshare 要加在手指框上（裡面有 hero.mobile.text）');
            assert.ok(!(await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).isVisible()), '分享鈕要收起來');
            const fallback = box.locator('[data-id="share.fallback"]');
            assert.ok(await fallback.isVisible(), '看得到 share.fallback 那一句（data-id="share.fallback"）');
            assert.equal((await fallback.textContent()).replace(/\s+/g, ''), say(lang, 'share.fallback').replace(/\s+/g, ''), '那一句是 share.fallback 的純文字');
            const url = box.locator('[translate="no"]');
            assert.ok(await url.isVisible(), '看得到網址框（translate="no"）');
            assert.equal((await url.textContent()).replace(/\s+/g, ''), CANONICAL(lang), `網址框的字是這一頁的網址 ${CANONICAL(lang)}`);
            assert.equal(await url.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)), true, '焦點要移到網址框');
            assert.equal(await page.getByRole('status').filter({ hasText: say(lang, 'state.copied') }).count(), 0, '剪貼簿沒寫進去，不能浮「已複製」');
        } finally {
            await context.close();
        }
    });
}

test('F4.1b 分享的退路：share 丟出別的錯、剪貼簿也不行 → 一樣改顯示網址；share 丟出 AbortError（使用者取消）→ 什麼都不做（zh 390）', { skip: pw ? false : why }, async () => {
    {
        const { page, context, h, dialogs } = await noshare('zh', 'error');
        try {
            await h.hero.getByRole('button', { name: say('zh', 'hero.share') }).click();
            await page.waitForTimeout(300);
            assert.equal(await h.hero.locator('.touch--noshare').count(), 1, 'share 丟出 NotAllowedError、剪貼簿也不行：要改顯示網址（touch--noshare）');
            assert.equal(dialogs(), 0, '不能跳對話框');
        } finally {
            await context.close();
        }
    }
    {
        const { page, context, h, dialogs } = await noshare('zh', 'abort');
        try {
            await h.hero.getByRole('button', { name: say('zh', 'hero.share') }).click();
            await page.waitForTimeout(300);
            assert.equal(await h.hero.locator('.touch--noshare').count(), 0, '使用者自己取消（AbortError）：不改顯示網址');
            assert.equal(await page.getByRole('status').filter({ hasText: say('zh', 'state.copied') }).count(), 0, '使用者自己取消：不浮「已複製」');
            assert.ok(await h.hero.getByRole('button', { name: say('zh', 'hero.share') }).isVisible(), '使用者自己取消：分享鈕還在');
            assert.equal(dialogs(), 0, '不能跳對話框');
        } finally {
            await context.close();
        }
    }
});

test('F4.1b 關掉 JS（三語 390 只有手指）：網址框直接看得到、分享鈕看不到', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { context, h } = await open(lang, { width: 390, height: 844, context: { ...TOUCH, javaScriptEnabled: false } });
        try {
            const url = h.hero.locator('[translate="no"]');
            assert.ok(await url.isVisible(), `${lang}：關掉 JS 時網址框要直接看得到（網址寫在 HTML 裡）`);
            assert.equal((await url.textContent()).replace(/\s+/g, ''), CANONICAL(lang), `${lang}：網址框的字是 ${CANONICAL(lang)}`);
            assert.ok(await h.block('share.fallback').isVisible(), `${lang}：關掉 JS 時看得到 share.fallback 那一句`);
            assert.ok(!(await h.hero.getByRole('button', { name: say(lang, 'hero.share') }).isVisible()), `${lang}：關掉 JS 時分享鈕按了沒用，不顯示`);
        } finally {
            await context.close();
        }
    }
});


for (const lang of LANGS) {
    test(`F4.10 首屏沒有頁面錯誤、主控台沒有 error（${lang}：有滑鼠 1440、只有手指 390；開頁、動態播完、捲到 04）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [label, options] of [['1440', {}], ['390 只有手指', { width: 390, height: 844, context: TOUCH }]]) {
            const { page, context, errors, consoleErrors, h } = await open(lang, options);
            try {
                await page.waitForTimeout(2500);
                await h.where.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
                await page.waitForTimeout(2000);
                bad.push(...errors.map((e) => `${label} 頁面錯誤：${e}`), ...consoleErrors.map((e) => `${label} 主控台 error：${e}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 則錯誤`);
    });
}
