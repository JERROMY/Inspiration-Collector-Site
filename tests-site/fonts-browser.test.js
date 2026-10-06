// F1.5（字型）裡要用真瀏覽器量的部分。不用瀏覽器的在 fonts-styles.test.js。
//
// 量什麼：
//   F1.5 中文頁、日文頁（英文頁也量）實際下載的字型：只有 /fonts/ 的兩個拉丁瘦身檔（同一個來源）、每個最多下載一次，
//        沒有任何中日文字型的請求 —— 中日文字型 0 位元組，中文走系統字型（--font-zh 的回退）。
//   F1.5 日文頁 1440×900 與英文頁 390×844，字型晚到（伺服器先扣住 .woff2，第一次畫面用回退字型畫出來之後才放）：
//        整頁的 CLS（layout-shift 的總和，扣掉使用者操作後的）≤ 0.01。設計審查在第一批設計稿量到 0.039（字型換上來時按鈕跳動）。
//        防呆：放字型之前拉丁字型要還沒載好（不然量不到「換上來」那一下）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.5 實際|F1.5 CLS"
//   Playwright 不在網站的套件裡：用 GPTPlugins 的 clipper/node_modules/playwright，或設 SITE_PLAYWRIGHT=<那個資料夾>；找不到就 skip 並寫原因。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, FONT_FILES, playwright, browserSession } from './helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;

after(() => session?.close());

for (const lang of LANGS) {
    test(`F1.5 實際下載的字型只有兩個拉丁瘦身檔、沒有中日文字型 —— /${lang}/`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const fonts = [];
        context.on('request', (req) => {
            if (req.resourceType() === 'font' || /\.(woff2?|ttf|otf)(\?|$)/i.test(req.url())) fonts.push(req.url());
        });
        try {
            const tab = await context.newPage();
            await tab.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
            await tab.evaluate(() => document.fonts.ready);
            await tab.waitForTimeout(300);
            const allowed = FONT_FILES.map((n) => `${site.url}/fonts/${n}`);
            const extra = fonts.filter((u) => !allowed.includes(u.split('?')[0]));
            assert.deepEqual(extra, [], `/${lang}/ 下載了不該下載的字型（中日文走系統字型，網頁字型只有 /fonts/ 那兩個）：${extra.join('、')}`);
            const twice = [...new Set(fonts.filter((u, i) => fonts.indexOf(u) !== i))];
            assert.deepEqual(twice, [], `/${lang}/ 同一個字型檔下載了兩次（preload 少了 crossorigin 會這樣）：${twice.join('、')}`);
        } finally {
            await context.close();
        }
    });
}

// 日文 1440：設計審查在第一批設計稿量到 0.039 的那個情況。英文 390：骨架階段就分得出來的情況
// （檢查員 2026-10-02 量的：有回退字型 0.00009，拿掉 0.0211；日文 1440 拿掉回退字型只到 0.0033，骨架上抓不到）
const CLS_CASES = [
    { lang: 'ja', width: 1440, height: 900, why: '設計審查量到跳動的那個寬度' },
    { lang: 'en', width: 390, height: 844, why: '手機寬，回退字型拿掉就量得到' },
];

for (const { lang, width, height, why: because } of CLS_CASES) {
    test(`F1.5 CLS：/${lang}/ ${width} 寬，字型晚到時版面不跳（≤ 0.01）—— ${because}`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ viewport: { width, height } });
        try {
            const tab = await context.newPage();
            await tab.addInitScript(() => {
                window.__cls = 0;
                window.__shifts = [];
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.hadRecentInput) continue;
                        window.__cls += entry.value;
                        window.__shifts.push({ value: entry.value, at: Math.round(entry.startTime), nodes: (entry.sources ?? []).map((s) => s.node && (s.node.id || s.node.className || s.node.nodeName)).filter(Boolean) });
                    }
                }).observe({ type: 'layout-shift', buffered: true });
            });
            site.holdFonts();
            try {
                await tab.goto(`${site.url}/${lang}/`, { waitUntil: 'domcontentloaded' });
                // 等兩個畫格：第一次畫面已經用回退字型畫出來了
                await tab.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                // 只算網頁字型本身；回退字型（Google Sans Flex Fallback，src 是 local()）一下就載好，不能算進來
                const early = await tab.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'Google Sans Flex' && f.status === 'loaded').length);
                assert.equal(early, 0, '防呆：字型還扣著，拉丁字型卻已經載好了（扣字型沒生效？），量不到字型換上來那一下');
            } finally {
                site.releaseFonts();
            }
            await tab.waitForLoadState('load');
            await tab.evaluate(() => document.fonts.ready);
            await tab.waitForTimeout(500);
            const loaded = await tab.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'Google Sans Flex' && f.status === 'loaded').length);
            assert.ok(loaded >= 1, '防呆：等完之後 Google Sans Flex 還沒載好 —— 頁面沒用到它？（fonts.css 沒接上）');
            const { cls, shifts } = await tab.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
            assert.ok(cls <= 0.01, `/${lang}/ ${width} 的 CLS 是 ${cls.toFixed(4)}，要 ≤ 0.01（回退字型的 size-adjust 沒對準？）：${JSON.stringify(shifts)}`);
        } finally {
            await context.close();
        }
    });
}
