// F1.2（<html lang> 與只有暗色）與 F1.9（多個根版面時 / 與 404 的 lang）。
//
// 量什麼：
//   F1.2 送出來的 HTML（不跑腳本）：out/zh/index.html 的 <html lang="zh-Hant">、en 是 "en"、ja 是 "ja"、out/index.html 是 "en"；
//        四頁的 <html> 都有 data-theme="dark"（寫在 HTML 裡，不是腳本後來加的）。
//   F1.2 真瀏覽器（Playwright，系統設成亮色 colorScheme: 'light'）：四頁量到的背景都是暗色 —— 關掉 JS 一次、開著 JS 一次。
//        防呆：先確認 prefers-color-scheme: light 真的成立（模擬沒生效的話量到的暗色是假的綠）。
//   F1.9 out/404.html 與 out/index.html 的 <html lang> 都在、是 en／zh-Hant／ja 其中一個；404 也有 data-theme="dark"。
//   F1.9404 三語並列：<html lang="en">（第 1 步），<body> 裡有標 lang="zh-Hant"（第 2 步）與 lang="ja"（第 3 步）的元素。
//        前端若回報 Next.js 做不到，看訊息裡的「第 N 步」就知道卡在哪。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.2|F1.9"
//   Playwright 不在網站的套件裡：用 GPTPlugins 的 clipper/node_modules/playwright，或設 SITE_PLAYWRIGHT=<那個資料夾>；找不到就 skip 並寫原因。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, HTML_LANG, readOut, htmlAttrs, tagAttrs, playwright, browserSession } from './helpers.js';

const PAGES = [
    ...LANGS.map((lang) => ({ rel: `${lang}/index.html`, url: `/${lang}/`, lang: HTML_LANG[lang] })),
    { rel: 'index.html', url: '/', lang: 'en' },
];

test('F1.2 三語頁與 / 的 <html lang> 寫在送出來的 HTML 裡', () => {
    for (const page of PAGES) {
        const attrs = htmlAttrs(readOut(page.rel));
        assert.equal(attrs.lang, page.lang, `out/${page.rel} 的 <html lang> 要是 "${page.lang}"，得到 ${JSON.stringify(attrs.lang)}`);
    }
});

test('F1.2 四頁的 <html> 都有 data-theme="dark"（在 HTML 裡就對，不靠腳本）', () => {
    for (const page of PAGES) {
        const attrs = htmlAttrs(readOut(page.rel));
        assert.equal(attrs['data-theme'], 'dark', `out/${page.rel} 的 <html> 要有 data-theme="dark"，得到 ${JSON.stringify(attrs['data-theme'])}`);
    }
});

test('F1.9 out/404.html 與 out/index.html 的 <html lang> 都在（多個根版面也不能漏）', () => {
    for (const rel of ['404.html', 'index.html']) {
        const attrs = htmlAttrs(readOut(rel));
        assert.ok(['en', 'zh-Hant', 'ja'].includes(attrs.lang), `out/${rel} 的 <html lang> 要是 en、zh-Hant、ja 其中一個，得到 ${JSON.stringify(attrs.lang)}`);
        assert.equal(attrs['data-theme'], 'dark', `out/${rel} 的 <html> 要有 data-theme="dark"`);
    }
});

test('F1.9 404 三語並列：整頁 lang="en"，中文、日文那兩段各標 lang="zh-Hant"、lang="ja"', () => {
    const html = readOut('404.html');
    assert.equal(htmlAttrs(html).lang, 'en', `第 1 步：out/404.html 的 <html lang> 要是 "en"（整頁標英文，跟 / 一樣），得到 ${JSON.stringify(htmlAttrs(html).lang)}`);
    const body = html.slice(html.search(/<body[\s>]/i));
    const langs = new Set(tagAttrs(body, '[a-z][a-z0-9-]*').map((a) => a.lang).filter(Boolean));
    assert.ok(langs.has('zh-Hant'), `第 2 步：out/404.html 的 <body> 裡要有一個元素標 lang="zh-Hant"（中文那一段），找到的 lang：${[...langs].join('、') || '（沒有）'}`);
    assert.ok(langs.has('ja'), `第 3 步：out/404.html 的 <body> 裡要有一個元素標 lang="ja"（日文那一段），找到的 lang：${[...langs].join('、') || '（沒有）'}`);
});

// ---- 真瀏覽器：系統是亮色時背景還是暗的 ----
const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;

after(() => session?.close());

function luminance(rgb) {
    const lin = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

for (const javaScriptEnabled of [false, true]) {
    test(`F1.2 系統設成亮色（colorScheme: light）時背景仍是暗色 —— ${javaScriptEnabled ? '開著' : '關掉'} JS`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const context = await browser.newContext({ colorScheme: 'light', javaScriptEnabled, viewport: { width: 1280, height: 800 } });
        try {
            for (const page of PAGES) {
                const tab = await context.newPage();
                await tab.goto(site.url + page.url, { waitUntil: 'load' });
                const got = await tab.evaluate(() => {
                    // canvas 把任何寫法的顏色（hex、rgb、oklch…）轉成 sRGB 的數字
                    const ctx = document.createElement('canvas').getContext('2d');
                    const toRgba = (css) => {
                        ctx.clearRect(0, 0, 1, 1);
                        ctx.fillStyle = '#000';
                        ctx.fillStyle = css;
                        ctx.fillRect(0, 0, 1, 1);
                        return Array.from(ctx.getImageData(0, 0, 1, 1).data);
                    };
                    const layers = [document.body, document.documentElement].map((el) => ({ tag: el.tagName, css: getComputedStyle(el).backgroundColor }));
                    return { light: matchMedia('(prefers-color-scheme: light)').matches, layers: layers.map((l) => ({ ...l, rgba: toRgba(l.css) })) };
                });
                assert.equal(got.light, true, '防呆：prefers-color-scheme: light 沒有生效，這條量不到');
                const solid = got.layers.find((l) => l.rgba[3] > 0 && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(l.css));
                assert.ok(solid, `${page.url}：body 與 html 的背景都是透明的 —— 亮色系統下會露出白色的底（${JSON.stringify(got.layers)}）`);
                const lum = luminance(solid.rgba);
                assert.ok(lum < 0.1, `${page.url}：系統亮色時 ${solid.tag} 的背景是 ${solid.css}（亮度 ${lum.toFixed(3)}），要是暗色`);
                await tab.close();
            }
        } finally {
            await context.close();
        }
    });
}
