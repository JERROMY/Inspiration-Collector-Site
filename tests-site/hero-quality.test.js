// F4.6 整頁 CLS（十二種寬度 × 三語＋只有手指）、F4.8「已複製」一直在 DOM 裡、F4.9 React 接手太慢時首屏的字不能等。讀 out/（真的內容），真的開瀏覽器。
//
// 量什麼：
//   F4.6 三語 × 規格書第 14 節的十二種寬度（有滑鼠，高 900），再加只有手指（isMobile＋hasTouch，高 844）的 320、360、375、390、412、414、430：
//        page-helpers.js 的 measureCls —— 這一頁的 .woff2 先扣住，第一次畫面用回退字型畫出來（兩個畫格）之後才放，再等 load、字型、1.2 秒；
//        整頁的 CLS（layout-shift 總和，**不扣 hadRecentInput**：只有手指時字型換上來的位移會被 Playwright 標成有人操作，扣掉就永遠是 0）≤ 0.02。
//        紅的時候每一組寫出語言、寬度、模式、CLS，與位移最大的元素（data-id／data-section／標籤.class，移了幾 px）。
//        兩種模式都量的寬度（320、360、375、390、414、430）：手指框之上的東西（hero.kicker、hero.title、hero.sub、公告條）位移要一樣（差 ≤ 1px）。
//        防呆：放字型之前拉丁字型（Google Sans Flex）還沒載好。（F1.5 的 0.01、F4.3「動態本身 CLS 0」不動。寬度掃描是 F4.6b，cls-sweep.test.js。）
//   F4.8 三語 390 只有手指：開頁時就有 role="status" 的元素在 DOM 裡、沒有 hidden 屬性、display 不是 none、visibility 不是 hidden（讀屏才念得到之後換的字）、字是空的；
//        按「分享這個網址」（沒有 navigator.share、剪貼簿寫得進去）之後，就是那一個元素換成 state.copied 的字、看得見；停 --dur-breathe（3.2 秒）、淡出之後（4 秒時）字清空。
//   F4.9 三語 390：把 Next.js 的 JS（/_next/static/chunks/ 底下的 .js；同一個資料夾的 .css 照常給）晚 4 秒才給 —— React 接不了手 —— 開頁 1.5 秒時，括號裡（hero.title 的 .clamp）的字全部看得見：
//        沒有 data-char，或每個 data-char 透明度 1；括號裡的字與它的外層透明度都是 1、顏色不是透明。JS 到了、React 接手之後字照樣完整、沒有頁面錯誤。
//        （正常情況的動態 A 不變：F4.3。）
//   F4.9 慢手機（三語 390 只有手指，用 Chrome 開發者協定把網路調成延遲 150ms、下載 1.6 Mbps，CPU 慢 4 倍，字型照常載）：
//        每一幀看括號裡的字（自己與外層透明度乘起來 ≥ 0.5、顏色不是透明才算看得見），
//        從畫面第一次出字（first-contentful-paint）算起 ≤ 1.2 秒（約 1 秒，多 0.2 秒寬容）就有字看得見，最後全部看得見，沒有頁面錯誤。
//        兩個時刻（第一個字、全部）都寫進輸出（# F4.9 慢手機 …）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.6|F4.8|F4.9"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession, strings, plain } from './helpers.js';
import { say, heroParts, WIDTHS, measureCls, topMoved, pool } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const TOUCH = [320, 360, 375, 390, 412, 414, 430];
const LIMIT = 0.02;

const SHARED = TOUCH.filter((w) => WIDTHS.includes(w));
// 只有手指與有滑鼠都畫的東西（手指框之上）：同一個寬度兩種模式位移要一樣 —— 只有手指那邊量少了（例如又被當成有人操作扣掉）就抓得到
const ABOVE_TOUCH = /data-id=hero\.(kicker|title|sub)|Bulletin/;

for (const lang of LANGS) {
    test(`F4.6 整頁 CLS ≤ ${LIMIT}（${lang}：十二種寬度＋只有手指 320～430，字型晚到）`, { skip: pw ? false : why, timeout: 10 * 60 * 1000 }, async () => {
        const { site, browser } = await session.get();
        const combos = [...WIDTHS.map((w) => [w, false]), ...TOUCH.map((w) => [w, true])];
        const results = await pool(combos, 4, ([width, touch]) => measureCls(browser, `${site.url}/${lang}/`, { width, touch }));
        const bad = [];
        const table = [];
        const byKey = new Map();
        combos.forEach(([width, touch], i) => {
            const r = results[i];
            const label = `${lang} ${width} ${touch ? '只有手指' : '有滑鼠'}`;
            byKey.set(`${width}${touch}`, r);
            if (r.guard) { bad.push(`${label}：防呆：放字型之前拉丁字型就載好了，量不到`); return; }
            table.push(`${label} ${r.cls.toFixed(4)}`);
            if (r.cls > LIMIT) bad.push(`${label}：CLS ${r.cls.toFixed(4)}，位移最大的是 ${topMoved(r.moved)}`);
        });
        for (const width of SHARED) {
            const mouse = byKey.get(`${width}false`);
            const touch = byKey.get(`${width}true`);
            if (mouse.guard || touch.guard) continue;
            for (const key of new Set([...Object.keys(mouse.moved), ...Object.keys(touch.moved)].filter((k) => ABOVE_TOUCH.test(k)))) {
                if (Math.abs((mouse.moved[key] ?? 0) - (touch.moved[key] ?? 0)) > 1) bad.push(`${lang} ${width}：${key} 有滑鼠移 ${mouse.moved[key] ?? 0}px、只有手指移 ${touch.moved[key] ?? 0}px —— 手指框之上的東西兩種模式要一樣（只有手指量少了？）`);
            }
        }
        console.log(`# CLS ${table.join('｜')}`);
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

const COPY_OK = () => {
    try { delete Navigator.prototype.share; } catch {}
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
};

for (const lang of LANGS) {
    test(`F4.8「已複製」一直在 DOM 裡（${lang} 390 只有手指）：開頁就在、看不見但不是 hidden、字是空的；按了換字變看得見、停 3.2 秒後清空`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        await page.addInitScript(COPY_OK);
        await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
        try {
            const before = await page.evaluate(() => [...document.querySelectorAll('[role="status"]')].map((el, i) => {
                el.setAttribute('data-test-status', String(i));
                const s = getComputedStyle(el);
                return { i, hidden: el.hidden, display: s.display, visibility: s.visibility, text: el.textContent.trim() };
            }));
            assert.ok(before.length > 0, '開頁時就要有 role="status" 的元素在 DOM 裡（讀屏只念內容改變，不念剛出現的元素）');
            await heroParts(page).hero.getByRole('button', { name: say(lang, 'hero.share') }).click();
            await page.waitForTimeout(400);
            const copied = say(lang, 'state.copied');
            const now = await page.evaluate((text) => {
                const el = [...document.querySelectorAll('[role="status"]')].find((e) => e.textContent.trim() === text);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return { mark: el.getAttribute('data-test-status'), visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.5 };
            }, copied);
            assert.ok(now, `按了之後要有 role="status" 的元素寫著「${copied}」`);
            assert.ok(now.mark !== null, '寫著「已複製」的要是開頁時就在的那一個元素（只換字，不是新加的）');
            const was = before.find((b) => String(b.i) === now.mark);
            assert.equal(was.hidden, false, '開頁時那個元素不能有 hidden 屬性（讀屏會略過）');
            assert.notEqual(was.display, 'none', '開頁時那個元素 display 不能是 none（用 visually-hidden 或透明）');
            assert.notEqual(was.visibility, 'hidden', '開頁時那個元素 visibility 不能是 hidden');
            assert.equal(was.text, '', '開頁時那個元素的字是空的（按了才換成「已複製」，讀屏才會念）');
            assert.ok(now.visible, '按了之後「已複製」要看得見');
            await page.waitForTimeout(3600);
            const later = await page.evaluate((mark) => document.querySelector(`[data-test-status="${mark}"]`)?.textContent.trim(), now.mark);
            assert.equal(later, '', '停 3.2 秒、淡出之後（4 秒時）字要清空（元素還留在 DOM 裡）');
        } finally {
            await context.close();
        }
    });
}

const clampText = (lang) => plain(/⟨(.*)⟩/.exec(strings[lang]['hero.title'])[1]);

for (const lang of LANGS) {
    test(`F4.9 React 接手太慢（Next.js 的 JS 晚 4 秒，${lang} 390）：開頁 1.5 秒時括號裡的字全部看得見`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.route('**/_next/static/chunks/**/*.js', async (route) => { await new Promise((done) => setTimeout(done, 4000)); await route.continue(); });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        // 不等 DOMContentLoaded：Next.js 的 script 晚到時它也跟著晚 4 秒
        await page.goto(`${site.url}/${lang}/`, { waitUntil: 'commit' });
        try {
            await page.waitForFunction(() => performance.now() >= 1500, null, { timeout: 5000, polling: 50 });
            const state = await heroParts(page).clamp.evaluate((clamp) => {
                const chars = [...clamp.querySelectorAll('[data-char]')];
                const faded = [];
                for (let el = clamp; el; el = el.parentElement) if (parseFloat(getComputedStyle(el).opacity) < 1) faded.push(el.tagName);
                return {
                    t: Math.round(performance.now()),
                    text: clamp.textContent.replace(/\s+/g, ' ').trim(),
                    color: getComputedStyle(clamp).color,
                    faded,
                    chars: chars.length,
                    hiddenChars: chars.filter((c) => parseFloat(getComputedStyle(c).opacity) < 1 || getComputedStyle(c).color === 'rgba(0, 0, 0, 0)').length,
                };
            });
            assert.ok(state.t <= 2500, `防呆：量的時候已經 ${state.t}ms 了（太慢，量不準）`);
            assert.equal(state.text, clampText(lang), `${state.t}ms：括號裡的字要完整`);
            assert.deepEqual(state.faded, [], `${state.t}ms：括號裡的字與外層不能是透明的（React 還沒接手也要露字）`);
            assert.notEqual(state.color, 'rgba(0, 0, 0, 0)', `${state.t}ms：括號裡的字不能是透明色`);
            assert.equal(state.hiddenChars, 0, `${state.t}ms：拆出來的字（data-char ${state.chars} 個）要全部看得見`);
            await page.waitForTimeout(5000);
            const final = await heroParts(page).clamp.evaluate((clamp) => ({ text: clamp.textContent.replace(/\s+/g, ' ').trim(), hidden: [...clamp.querySelectorAll('[data-char]')].filter((c) => parseFloat(getComputedStyle(c).opacity) < 1).length }));
            assert.equal(final.text, clampText(lang), 'JS 到了、React 接手之後字還是完整的');
            assert.equal(final.hidden, 0, 'React 接手之後不能再把字藏起來重播');
            assert.deepEqual(errors, [], `頁面不能有錯誤：${errors.join('｜')}`);
        } finally {
            await context.close();
        }
    });
}

// 每一幀看括號裡的字：幾個字看得見（自己與外層的透明度乘起來 ≥ 0.5、顏色不是透明）；記第一個字看得見、全部看得見的時刻
const REVEAL_WATCH = () => {
    window.__reveal = { first: null, all: null, total: null };
    const seen = (el) => {
        let o = 1;
        for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
        return o >= 0.5 && getComputedStyle(el).color !== 'rgba(0, 0, 0, 0)';
    };
    const tick = () => {
        const clamp = document.querySelector('[data-section="hero"] [data-id="hero.title"] .clamp');
        if (clamp && clamp.textContent.trim()) {
            const chars = [...clamp.querySelectorAll('[data-char]')];
            const total = chars.length || 1;
            const shown = chars.length ? chars.filter(seen).length : (seen(clamp) ? 1 : 0);
            const now = performance.now();
            if (shown > 0 && window.__reveal.first === null) window.__reveal.first = now;
            if (shown === total && window.__reveal.all === null) { window.__reveal.all = now; window.__reveal.total = chars.length; }
        }
        if (window.__reveal.all === null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};
const SLOW = { latency: 150, download: 1.6e6 / 8, upload: 750e3 / 8, cpu: 4 };
const SOON = 1000;
const ABOUT = 200;

for (const lang of LANGS) {
    test(`F4.9 慢手機（延遲 ${SLOW.latency}ms、1.6 Mbps、CPU 慢 ${SLOW.cpu} 倍，${lang} 390 只有手指）：從畫面第一次出字算起，約 1 秒內括號裡的字看得見`, { skip: pw ? false : why, timeout: 60 * 1000 }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: SLOW.latency, downloadThroughput: SLOW.download, uploadThroughput: SLOW.upload });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW.cpu });
        await page.addInitScript(REVEAL_WATCH);
        try {
            await page.goto(`${site.url}/${lang}/`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.__reveal.all !== null, null, { timeout: 20000, polling: 100 }).catch(() => {});
            const r = await page.evaluate(() => ({ ...window.__reveal, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null }));
            assert.ok(r.fcp !== null, '防呆：量不到畫面第一次出字（first-contentful-paint）');
            const at = (t) => (t === null ? '20 秒內都沒有' : `出字後 ${Math.round(t - r.fcp)}ms`);
            console.log(`# F4.9 慢手機 ${lang}：第一次出字 ${Math.round(r.fcp)}ms；括號裡第一個字看得見 ${at(r.first)}、全部看得見 ${at(r.all)}`);
            assert.ok(r.first !== null && r.first - r.fcp <= SOON + ABOUT, `從畫面第一次出字算起約 1 秒內（≤ ${SOON + ABOUT}ms）括號裡的字要看得見：第一個字 ${at(r.first)}、全部 ${at(r.all)}`);
            assert.ok(r.all !== null, `括號裡的字最後要全部看得見：${at(r.all)}`);
            assert.deepEqual(errors, [], `頁面不能有錯誤：${errors.join('｜')}`);
        } finally {
            await context.close();
        }
    });
}
