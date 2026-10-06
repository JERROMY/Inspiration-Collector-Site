// F6.4 15 最後的安裝：有滑鼠是「加到 Chrome」，只有手指換成分享框（跟首屏一樣，包括分享的退路）。讀 out/，真的開瀏覽器。
// 照設計稿 350fdf4 的 15 那一段；規格書 §5-15。計數名字（install-final、install-mobile-final、share-final、mail-final）在 goatcounter.test.js。
//
// 介面（README.md「05、06、08、15（F6）」）：<section data-section="final" id="install">；data-id：final.title、final.meta、final.cta（連到商店頁）；
//   只有手指時的框是 [data-touch]：final.mobile.lead、分享鈕（data-share）、寄給自己（data-id="final.mail"）、「用的是電腦？」（裡面有 data-id="final.pc" 的連結）、
//   分享退路的網址框（data-share-urlbox）。分享的行為跟首屏一樣（public/hero.js 那一套）。
//
// 量什麼：
//   F6.4 有滑鼠（三語 1440）：看得到 final.title、final.meta、final.cta（連到商店頁、字是 final.cta），看不到手指框。
//   F6.4 只有手指（三語 390）：看不到 final.cta；看得到手指框（說明、分享、寄給自己、用的是電腦？）；寄給自己是 mailto（收件人空白、主旨 mail.self.subject、內文有這一頁的網址）；
//        用的是電腦？連到商店頁。
//   F6.4 分享（三語 390 只有手指）：有 navigator.share 就呼叫它（url 有 /<語言>/）；沒有就複製網址、浮出「已複製」（role="status"）；
//        分享選單與剪貼簿都不行時，15 區的手指框加上 touch--noshare、網址框看得到、焦點移到網址框（不跳對話框）。
//   F6.4「已複製」看得見（三語 × 只有手指 390、360、768；首屏與 15 區各按一次；分享鈕捲到畫面中間、畫面底部各一次）：
//        走複製網址那條路，0.6 秒後提示框在畫面裡、透明度 1，提示框中心那一點最上面的元素（elementFromPoint）是提示框自己或它裡面的東西 ——
//        提示框放在某一區裡面、那一區又是 isolation: isolate 時，z-index 只在那一區裡面有效，排在後面的區會蓋住它。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F6.4"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';
import { STORE_URL } from '../app/site.js';
import { getPlainString } from '../app/strings.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());
const say = (lang, id) => getPlainString(lang, id);
const TOUCH = { isMobile: true, hasTouch: true };

async function open(lang, { width = 1440, height = 900, extra = {}, init = [] } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...extra });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
    for (const s of init) await page.addInitScript(s);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    const sec = page.locator('[data-section="final"]');
    return { page, context, sec, dialogs, block: (id) => sec.locator(`[data-id="${id}"]`) };
}

test('F6.4 有滑鼠（三語 1440）：大標、說明、「加到 Chrome」連到商店頁，看不到手指框', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { context, sec, block } = await open(lang);
        try {
            assert.equal(await sec.count(), 1, `${lang}：要有 [data-section="final"]`);
            assert.equal(await sec.getAttribute('id'), 'install', `${lang}：15 的 id 是 install`);
            for (const id of ['final.title', 'final.meta', 'final.cta']) assert.ok(await block(id).isVisible(), `${lang}：要看得到 ${id}`);
            const cta = await block('final.cta').evaluate((e) => { const a = e.closest('a') || e; return { href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim() }; });
            assert.equal(cta.href, STORE_URL, `${lang}：「加到 Chrome」要連到商店頁`);
            assert.equal(cta.text, say(lang, 'final.cta'), `${lang}：按鈕的字是 final.cta`);
            assert.ok(!(await sec.locator('[data-touch]').isVisible()), `${lang}：有滑鼠時看不到手指框`);
        } finally {
            await context.close();
        }
    }
});

test('F6.4 只有手指（三語 390）：換成分享框 —— 說明、分享、寄給自己（mailto）、用的是電腦？', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { context, sec, block } = await open(lang, { width: 390, height: 844, extra: TOUCH });
        try {
            assert.ok(!(await block('final.cta').isVisible()), `${lang}：只有手指時看不到「加到 Chrome」`);
            const box = sec.locator('[data-touch]');
            assert.ok(await box.isVisible(), `${lang}：要看得到 15 區的手指框（[data-touch]）`);
            assert.ok(await box.locator('[data-id="final.mobile.lead"]').isVisible(), `${lang}：要看得到 final.mobile.lead`);
            assert.ok(await box.locator('[data-share]').isVisible(), `${lang}：要看得到分享鈕（data-share）`);
            const mail = await box.locator('[data-id="final.mail"]').evaluate((e) => (e.closest('a') || e).getAttribute('href'));
            const m = /^mailto:\?(.*)$/.exec(mail ?? '');
            assert.ok(m, `${lang}：寄給自己要是 mailto:?…（收件人空白），得到 ${mail}`);
            const q = new URLSearchParams(m[1]);
            assert.equal(q.get('subject'), say(lang, 'mail.self.subject'), `${lang}：主旨是 mail.self.subject`);
            assert.ok((q.get('body') ?? '').includes(`https://collector.jerromy.com/${lang}/`), `${lang}：內文要有這一頁的網址`);
            const pc = await box.locator('[data-id="final.pc"]').evaluate((e) => e.closest('a')?.getAttribute('href'));
            assert.equal(pc, STORE_URL, `${lang}：「用的是電腦？」連到商店頁`);
        } finally {
            await context.close();
        }
    }
});

const SHARE_OK = () => { window.__shared = []; navigator.share = (data) => { window.__shared.push(data); return Promise.resolve(); }; };
const NO_SHARE_COPY_OK = () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
};
const NOTHING_WORKS = () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('擋掉（測試）', 'NotAllowedError')) } });
    document.execCommand = () => false;
};

test('F6.4 15 區的分享（三語 390 只有手指）：navigator.share、複製網址＋「已複製」、都不行時改顯示網址', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        {
            const { page, context, sec } = await open(lang, { width: 390, height: 844, extra: TOUCH, init: [SHARE_OK] });
            try {
                await sec.locator('[data-touch] [data-share]').click();
                await page.waitForTimeout(300);
                const shared = await page.evaluate(() => window.__shared);
                assert.equal(shared.length, 1, `${lang}：有 navigator.share 時要呼叫它`);
                assert.ok(new URL(shared[0].url).pathname === `/${lang}/`, `${lang}：分享的網址是這一頁，得到 ${shared[0].url}`);
            } finally {
                await context.close();
            }
        }
        {
            const { page, context, sec } = await open(lang, { width: 390, height: 844, extra: TOUCH, init: [NO_SHARE_COPY_OK] });
            try {
                await sec.locator('[data-touch] [data-share]').click();
                const toast = page.getByRole('status').filter({ hasText: say(lang, 'state.copied') });
                await toast.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
                assert.ok(await toast.isVisible(), `${lang}：沒有 navigator.share 時要浮出「${say(lang, 'state.copied')}」`);
                assert.ok(new URL(await page.evaluate(() => window.__copied)).pathname === `/${lang}/`, `${lang}：要把這一頁的網址寫進剪貼簿`);
            } finally {
                await context.close();
            }
        }
        {
            const { page, context, sec, dialogs } = await open(lang, { width: 390, height: 844, extra: TOUCH, init: [NOTHING_WORKS] });
            try {
                const box = sec.locator('[data-touch]');
                await box.locator('[data-share]').click();
                await page.waitForTimeout(400);
                assert.ok(await box.evaluate((b) => b.classList.contains('touch--noshare')), `${lang}：分享選單與剪貼簿都不行時，15 區的手指框要加 touch--noshare`);
                const url = box.locator('[data-share-urlbox]');
                assert.ok(await url.isVisible(), `${lang}：要看得到網址框`);
                assert.equal(await url.evaluate((u) => document.activeElement === u), true, `${lang}：焦點要移到網址框`);
                assert.deepEqual(dialogs, [], `${lang}：不能跳 prompt()／alert()`);
            } finally {
                await context.close();
            }
        }
    }
});

// 「已複製」浮在畫面最上層：按完分享之後，提示框中心那一點最上面的元素要是提示框自己（或它裡面的東西）。
// 提示框平常 pointer-events: none，elementFromPoint 會穿過它 —— 量的那一下暫時打開再關回去。
const TOAST_ON_TOP = (text) => {
    const toast = [...document.querySelectorAll('[role="status"]')].find((e) => e.textContent.trim() === text);
    if (!toast) return { found: false };
    const r = toast.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const keep = toast.style.pointerEvents;
    toast.style.pointerEvents = 'auto';
    const hit = document.elementFromPoint(cx, cy);
    toast.style.pointerEvents = keep;
    const sec = hit?.closest('[data-section]')?.getAttribute('data-section');
    return { found: true, onTop: Boolean(hit && toast.contains(hit)), hit: hit ? `${hit.tagName.toLowerCase()}${sec ? `（在 ${sec} 裡）` : ''}` : '沒有', inView: cy > 0 && cy < innerHeight, opacity: parseFloat(getComputedStyle(toast).opacity) };
};

test('F6.4「已複製」看得見（三語 × 只有手指 390、360、768；首屏與 15 區各按一次；分享鈕在畫面中間、在畫面底部）：提示框中心最上面是提示框自己', { skip: pw ? false : why, timeout: 10 * 60 * 1000 }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 360, 768]) {
            for (const sec of ['hero', 'final']) {
                for (const block of ['center', 'end']) {
                    const { page, context } = await open(lang, { width, height: 844, extra: TOUCH, init: [NO_SHARE_COPY_OK] });
                    const label = `${lang} ${width} ${sec === 'hero' ? '首屏' : '15 區'}（分享鈕在畫面${block === 'center' ? '中間' : '底部'}）`;
                    try {
                        const share = page.locator(`[data-section="${sec}"] [data-touch] [data-share]`);
                        if (!(await share.count())) { bad.push(`${label}：找不到分享鈕`); continue; }
                        await share.evaluate((b, where) => b.scrollIntoView({ block: where, behavior: 'instant' }), block);
                        await share.click();
                        await page.waitForTimeout(600);
                        const r = await page.evaluate(TOAST_ON_TOP, say(lang, 'state.copied'));
                        if (!r.found) bad.push(`${label}：沒有浮出「${say(lang, 'state.copied')}」`);
                        else if (!r.inView || r.opacity < 0.99) bad.push(`${label}：提示框不在畫面裡或沒浮出來（opacity ${r.opacity}）`);
                        else if (!r.onTop) bad.push(`${label}：提示框被蓋住了，中心最上面是 ${r.hit}`);
                    } finally {
                        await context.close();
                    }
                }
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處看不見`);
});
