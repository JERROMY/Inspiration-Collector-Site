// F2.4 「/」依語言分流（規格書 §4），與 F2.1 帶 ?ref= 開頁時 canonical 不變。讀 out/，真的開瀏覽器。
//
// 介面（README.md「SEO 標記、/ 分流、404、網站地圖、圖示（F2）」）：「/」的 <head> 裡有一支外部的同步 .js（沒有 async、defer、type="module"）負責分流，
// 檔名由前端決定；測試從 out/index.html 的 <head> 找 <script src>，讀那支檔確認它在做分流（裡面有 collector-lang 與 location）。
//
// 量什麼：
//   F2.4 靜態：out/index.html 的 <head> 有外部的同步 <script src>，那支檔在 out/ 裡、內容有 collector-lang 與 location；分流不是寫在內嵌的 <script> 裡（內嵌腳本另由 F3.9 守）。
//   F2.4 瀏覽器語言（Playwright 的 locale）zh-HK、zh-CN、zh-TW、zh、ja、ja-JP、fr、en-US 開「/」：分別到 /zh/、/zh/、/zh/、/zh/、/ja/、/ja/、/en/、/en/，
//        只導航一次（中間沒有別的頁）；「/」的三語選單沒有畫出來（在畫面出來之前就跳：「/」那一頁離開前沒有 first-contentful-paint —— 字與圖一個都沒畫）。
//   F2.4 zh-TW 開 /?ref=store#faq：到 /zh/?ref=store#faq（query 與 hash 帶過去）。
//   F2.4 選過語言（localStorage 的 collector-lang＝ja、zh、en）優先於瀏覽器語言（fr、ja、zh-TW）；值不是 zh／en／ja 時照瀏覽器語言；localStorage 擋掉時照瀏覽器語言。
//   F2.4 /zh/、/en/、/ja/ 本身不跳（瀏覽器語言 fr、localStorage 選了別的語言也不跳）。
//   F2.4 關掉 JS：「/」不跳，看得到三顆連結（/zh/、/en/、/ja/，字是各語言的 root.pick）。
//   F2.1 「/」的 <h1> 的讀屏名字（Playwright 的 ariaSnapshot，關掉 JS）：三語名稱（meta.siteName）都在，任兩個不直接黏在一起。
//   F2.1 三語頁帶 ?ref=x 開（開著 JS，等 React 接手）：<link rel="canonical"> 還是不帶 query 的正式網址，而且只有一條。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F2.4|F2.1 帶"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OUT, LANGS, readOut, tagAttrs, playwright, browserSession } from './helpers.js';
import { NO_STORAGE_SCRIPT } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';
import { SITE_URL } from '../app/site.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

test('F2.4 「/」的 <head> 有一支外部的同步 .js 做分流（不是內嵌）', () => {
    const html = readOut('index.html');
    const head = (/<head[^>]*>([\s\S]*?)<\/head>/i.exec(html) || [])[1] || '';
    const sync = tagAttrs(head, 'script').filter((a) => a.src && !('async' in a) && !('defer' in a) && a.type !== 'module' && !('nomodule' in a) && !/^\/_next\//.test(a.src));
    assert.ok(sync.length > 0, '「/」的 <head> 要有外部的同步 <script src>（沒有 async、defer、type="module"），在畫面出來之前跑');
    const doing = sync.filter((a) => {
        const file = path.join(OUT, a.src.split('?')[0].replace(/^\//, ''));
        if (!fs.existsSync(file)) return false;
        const js = fs.readFileSync(file, 'utf8');
        return js.includes('collector-lang') && /location/.test(js);
    });
    assert.ok(doing.length > 0, `分流要寫在 <head> 那支外部 .js 裡（裡面要有 collector-lang 與 location），找過 ${sync.map((a) => a.src).join('、')}`);
});

// 每一份文件都跑：記「/」那一頁的字與圖畫過沒有（離開前看 first-contentful-paint），與每一次導航的網址
const TRACE = () => {
    try {
        const log = JSON.parse(sessionStorage.getItem('__trace') || '[]');
        log.push(location.pathname + location.search + location.hash);
        sessionStorage.setItem('__trace', JSON.stringify(log));
        if (location.pathname === '/') {
            addEventListener('pagehide', () => {
                sessionStorage.setItem('__rootPaint', String(performance.getEntriesByName('first-contentful-paint').length));
            });
        }
    } catch {
        // localStorage／sessionStorage 被擋掉的那一組：不記
    }
};

async function openRoot({ locale = 'en-US', path: url = '/', init = [], js = true } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ locale, javaScriptEnabled: js, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    // init 的每一項是函式，或 [函式, 參數]（addInitScript 把函式轉成字串送過去，閉包裡的變數帶不過去）
    for (const script of [TRACE, ...init]) await (Array.isArray(script) ? page.addInitScript(script[0], script[1]) : page.addInitScript(script));
    await page.goto(`${site.url}${url}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const landed = new URL(page.url());
    const trace = await page.evaluate(() => { try { return { log: JSON.parse(sessionStorage.getItem('__trace') || '[]'), paint: sessionStorage.getItem('__rootPaint') }; } catch { return { log: null, paint: null }; } });
    return { page, context, landed: landed.pathname + landed.search + landed.hash, trace };
}

for (const [locale, want] of [['zh-HK', '/zh/'], ['zh-CN', '/zh/'], ['zh-TW', '/zh/'], ['zh', '/zh/'], ['ja', '/ja/'], ['ja-JP', '/ja/'], ['fr', '/en/'], ['en-US', '/en/']]) {
    test(`F2.4 瀏覽器語言 ${locale} 開「/」→ ${want}（只跳一次、「/」沒有畫出來）`, { skip: pw ? false : why }, async () => {
        const { context, landed, trace } = await openRoot({ locale });
        try {
            assert.equal(landed, want, `瀏覽器語言 ${locale} 要到 ${want}，得到 ${landed}`);
            assert.deepEqual(trace.log, ['/', want], `只導航一次（/ → ${want}），得到 ${JSON.stringify(trace.log)}`);
            assert.equal(trace.paint, '0', `在畫面出來之前就要跳：「/」那一頁的字與圖不能畫出來（離開前有 ${trace.paint} 次 first-contentful-paint）`);
        } finally {
            await context.close();
        }
    });
}

test('F2.4 query 與 hash 帶過去（zh-TW 開 /?ref=store#faq → /zh/?ref=store#faq）', { skip: pw ? false : why }, async () => {
    const { context, landed } = await openRoot({ locale: 'zh-TW', path: '/?ref=store#faq' });
    try {
        assert.equal(landed, '/zh/?ref=store#faq');
    } finally {
        await context.close();
    }
});

const SET_PICK = (value) => { try { localStorage.setItem('collector-lang', value); } catch { /* 擋掉的那一組不設 */ } };
const PICK = (value) => [SET_PICK, value];

for (const [stored, locale, want] of [['ja', 'fr', '/ja/'], ['zh', 'ja', '/zh/'], ['en', 'zh-TW', '/en/'], ['xx', 'ja', '/ja/']]) {
    test(`F2.4 選過的語言優先（collector-lang＝${stored}、瀏覽器 ${locale}）→ ${want}`, { skip: pw ? false : why }, async () => {
        const { context, landed } = await openRoot({ locale, init: [PICK(stored)] });
        try {
            assert.equal(landed, want, `collector-lang＝${stored}、瀏覽器語言 ${locale} 要到 ${want}${stored === 'xx' ? '（不是 zh／en／ja 的值照瀏覽器語言）' : ''}，得到 ${landed}`);
        } finally {
            await context.close();
        }
    });
}

test('F2.4 localStorage 擋掉時照瀏覽器語言（ja → /ja/）、頁面不報錯', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ locale: 'ja' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.addInitScript(NO_STORAGE_SCRIPT);
    try {
        await page.goto(`${site.url}/`, { waitUntil: 'load' });
        await page.waitForTimeout(300);
        assert.equal(new URL(page.url()).pathname, '/ja/');
        assert.deepEqual(errors.filter((e) => !/localStorage 被擋掉了/.test(e)), [], `頁面不能有別的錯誤：${errors.join('｜')}`);
    } finally {
        await context.close();
    }
});

test('F2.4 /zh/、/en/、/ja/ 本身不跳（瀏覽器 fr、選過別的語言也一樣）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const other = lang === 'ja' ? 'zh' : 'ja';
        const { context, landed } = await openRoot({ locale: 'fr', path: `/${lang}/?ref=x#faq`, init: [PICK(other)] });
        try {
            assert.equal(landed, `/${lang}/?ref=x#faq`, `/${lang}/ 不能自動跳走，得到 ${landed}`);
        } finally {
            await context.close();
        }
    }
});

test('F2.4 關掉 JS：「/」不跳，看得到三顆語言連結', { skip: pw ? false : why }, async () => {
    const { page, context, landed } = await openRoot({ locale: 'zh-TW', js: false });
    try {
        assert.equal(landed, '/', '關掉 JS 時留在 /');
        for (const lang of LANGS) {
            const link = page.locator(`a[href="/${lang}/"]`).filter({ hasText: getPlainString(lang, 'root.pick') });
            assert.equal(await link.count(), 1, `要有一顆連到 /${lang}/、寫「${getPlainString(lang, 'root.pick')}」的連結`);
            assert.ok(await link.isVisible(), `連到 /${lang}/ 的那顆要看得到`);
        }
    } finally {
        await context.close();
    }
});

test('F2.1 「/」的 <h1> 讀屏念出來的名字：三語的名稱都在、彼此不黏在一起（關掉 JS）', { skip: pw ? false : why }, async () => {
    const { page, context } = await openRoot({ locale: 'en-US', js: false });
    try {
        const snap = await page.getByRole('heading', { level: 1 }).ariaSnapshot();
        const name = (/heading "([^"]*)"/.exec(snap) || [])[1] ?? '';
        const names = LANGS.map((l) => getPlainString(l, 'meta.siteName'));
        const bad = [];
        for (const n of names) if (!name.includes(n)) bad.push(`缺「${n}」`);
        for (const a of names) for (const b of names) if (a !== b && name.includes(a + b)) bad.push(`「${a}」與「${b}」黏在一起`);
        assert.deepEqual(bad, [], `<h1> 的讀屏名字「${name}」：${bad.join('；')}`);
    } finally {
        await context.close();
    }
});

test('F2.1 帶 ?ref=x 開三語頁（開著 JS）：canonical 還是不帶 query 的正式網址、只有一條', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await openRoot({ locale: 'fr', path: `/${lang}/?ref=x` });
        try {
            await page.waitForTimeout(1500);
            const hrefs = await page.evaluate(() => [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')));
            assert.deepEqual(hrefs, [`${SITE_URL}${lang}/`], `${lang}：canonical 要是 ${SITE_URL}${lang}/、只有一條，得到 ${JSON.stringify(hrefs)}`);
        } finally {
            await context.close();
        }
    }
});
