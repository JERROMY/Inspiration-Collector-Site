// F5.3 GoatCounter 接線（規格書 §11）。讀 out/，開瀏覽器；有站台代碼的那一種另外在暫存複本 build 一次。
//
// 介面（README.md「07 為 AI 做的與 GoatCounter（F5）」）：
//   站台代碼放 app/site.js 的 export const GOATCOUNTER_CODE（字串；空字串＝還沒開帳號 → 不載入）。不寫死假代碼。
//   有代碼時三個語言頁的 <head> 放一支外部 <script async src="//gc.zgo.at/count.js"（或 https://gc.zgo.at/count.js） data-goatcounter="https://<代碼>.goatcounter.com/count">。
//   要數的按鈕帶 data-goatcounter-click="<名字>"（GoatCounter 的寫法），名字照規格書 §11 那張表。
//
// 量什麼：
//   F5.3 設定：app/site.js 有 GOATCOUNTER_CODE，現在是空字串（使用者還沒開帳號；不寫死假代碼）。
//   F5.3 代碼空的時候：out/ 每一頁都沒有 gc.zgo.at 或 goatcounter 的 <script>；開三語頁（開著 JS）沒有往 gc.zgo.at、goatcounter.com 的請求、沒有頁面錯誤。
//   F5.3 有代碼時（暫存複本把 GOATCOUNTER_CODE 換成 collector-test 再 build）：三語頁各剛好一支 GoatCounter 的 <script>，有 src、有 async、
//        data-goatcounter 是 https://collector-test.goatcounter.com/count。
//   F5.3 已經有的按鈕都帶對名字（三語，關掉 JS，1440）：每個名字剛好一個元素，而且是對的那一個 ——
//        install-nav：導覽列（<header> 裡、不在選單）連到商店頁的「加到 Chrome」；install-hero：data-id="hero.cta"；
//        install-mobile-hero：手指框裡「用的是電腦？」那個連結（裡面有 data-id="hero.pc"）；share-hero：data-share 那顆；mail-hero：data-id="hero.mail"；
//        social-<代號>-menu：選單裡每一個社群圖示（content/links.md 每一個好的連結，href 是那個網址）；
//        15 區（最後的安裝）：install-final（data-id="final.cta"、連到商店頁）、install-mobile-final（手指框裡「用的是電腦？」，裡面有 data-id="final.pc"）、
//        share-final（15 區的 data-share）、mail-final（data-id="final.mail"）。首屏那幾個也要在首屏裡（data-section="hero"）。
//   09 的 tutorial-NN 在 tutorial.test.js 的 F7.5（要有影片 ID 才有，在那支的暫存複本量）。
//   11～14、16 的名字在 f8-sections.test.js（F8.3）與 f8-content.test.js（F8.1 的 blog-news）。05、06、08 沒有要數的按鈕。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F5.3"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, OUT, LANGS, listFiles, needOut, tagAttrs, buildCopy, tail, playwright, browserSession } from './helpers.js';
import { STORE_URL } from '../app/site.js';
import { readContent } from '../lib/content.js';

const SITE_JS = path.join(SITE, 'app', 'site.js');
const GC = /gc\.zgo\.at|goatcounter/i;

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
let built = null;
after(async () => { built?.cleanup(); await session?.close(); });

test('F5.3 站台代碼放在 app/site.js 的 GOATCOUNTER_CODE，現在是空的（不寫死假代碼）', async () => {
    const mod = await import(`../app/site.js?t=${Date.now()}`);
    assert.ok('GOATCOUNTER_CODE' in mod, 'app/site.js 要 export const GOATCOUNTER_CODE（空字串＝還沒開帳號、不載入）');
    assert.equal(mod.GOATCOUNTER_CODE, '', `使用者還沒開 GoatCounter 帳號，GOATCOUNTER_CODE 要是空字串，得到 ${JSON.stringify(mod.GOATCOUNTER_CODE)}`);
});

test('F5.3 代碼空的時候：out/ 每一頁都沒有 GoatCounter 的 <script>', () => {
    needOut();
    const bad = [];
    for (const rel of listFiles(OUT).filter((r) => r.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(OUT, ...rel.split('/')), 'utf8');
        for (const a of tagAttrs(html, 'script')) if (GC.test(`${a.src ?? ''} ${a['data-goatcounter'] ?? ''}`)) bad.push(`${rel}：${JSON.stringify(a)}`);
        if (/<script\b[^>]*>[^<]*gc\.zgo\.at/i.test(html)) bad.push(`${rel}：內嵌腳本裡有 gc.zgo.at`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處載入了 GoatCounter`);
});

test('F5.3 代碼空的時候：開三語頁沒有往 GoatCounter 的請求、沒有頁面錯誤', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    for (const lang of LANGS) {
        const context = await browser.newContext();
        const requests = [];
        await context.route(/gc\.zgo\.at|goatcounter\.com/, (route) => { requests.push(route.request().url()); return route.abort(); });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        try {
            await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
            await page.waitForTimeout(800);
            assert.deepEqual(requests, [], `${lang}：代碼空的時候不能往 GoatCounter 送請求`);
            assert.deepEqual(errors, [], `${lang}：不能有頁面錯誤`);
        } finally {
            await context.close();
        }
    }
});

test('F5.3 有代碼時：三語頁各一支 GoatCounter 的外部 <script>，async、data-goatcounter 對（暫存複本 build）', { timeout: 10 * 60 * 1000 }, () => {
    const source = fs.readFileSync(SITE_JS, 'utf8');
    assert.match(source, /export\s+const\s+GOATCOUNTER_CODE\s*=\s*(['"])\1\s*;/, '防呆：app/site.js 要有 export const GOATCOUNTER_CODE = \'\';（才換得掉）');
    built = buildCopy({
        label: 'goatcounter',
        prepare: (dir) => {
            const file = path.join(dir, 'app', 'site.js');
            fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/export\s+const\s+GOATCOUNTER_CODE\s*=\s*(['"])\1\s*;/, "export const GOATCOUNTER_CODE = 'collector-test';"));
        },
    });
    assert.equal(built.status, 0, `暫存複本 build 失敗：\n${tail(built.output)}`);
    for (const lang of LANGS) {
        const html = fs.readFileSync(path.join(built.out, lang, 'index.html'), 'utf8');
        const gc = tagAttrs(html, 'script').filter((a) => GC.test(`${a.src ?? ''} ${a['data-goatcounter'] ?? ''}`));
        assert.equal(gc.length, 1, `${lang}：要剛好一支 GoatCounter 的 <script>，得到 ${gc.length}`);
        assert.match(gc[0].src ?? '', /^(https:)?\/\/gc\.zgo\.at\/count\.js$/, `${lang}：src 要是 //gc.zgo.at/count.js，得到 ${gc[0].src}`);
        assert.ok('async' in gc[0], `${lang}：要 async（不擋畫面）`);
        assert.equal(gc[0]['data-goatcounter'], 'https://collector-test.goatcounter.com/count', `${lang}：data-goatcounter 要是 https://<代碼>.goatcounter.com/count`);
    }
});

for (const lang of LANGS) {
    test(`F5.3 已經有的按鈕都帶對 data-goatcounter-click（${lang}）`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const content = await readContent(path.join(SITE, 'content'));
        const good = content.links.ok ? content.links.entries.filter((e) => e.ok) : [];
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
        const page = await context.newPage();
        try {
            await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
            const check = async (name, rule) => page.evaluate(({ name, rule, store }) => {
                const all = [...document.querySelectorAll(`[data-goatcounter-click="${name}"]`)];
                if (all.length !== 1) return `${name}：要剛好一個元素，得到 ${all.length}`;
                const el = all[0];
                const menuId = document.querySelector('header button[aria-controls]')?.getAttribute('aria-controls');
                const inMenu = menuId ? Boolean(el.closest(`#${CSS.escape(menuId)}`)) : false;
                const sec = rule.sec ? el.closest(`[data-section="${rule.sec}"]`) : null;
                const ok = {
                    nav: () => el.closest('header') && !inMenu && el.getAttribute('href') === store,
                    cta: () => sec && el.getAttribute('data-id') === `${rule.sec}.cta` && el.getAttribute('href') === store,
                    pc: () => sec && el.tagName === 'A' && Boolean(el.querySelector(`[data-id="${rule.sec}.pc"]`)),
                    share: () => sec && el.hasAttribute('data-share'),
                    mail: () => sec && el.getAttribute('data-id') === `${rule.sec}.mail`,
                }[rule.kind] ?? (() => inMenu && el.getAttribute('href') === rule.href);
                return ok() ? null : `${name}：放錯元素（${el.outerHTML.slice(0, 120)}…）`;
            }, { name, rule, store: STORE_URL });
            const rules = [
                ['install-nav', { kind: 'nav' }], ['install-hero', { kind: 'cta', sec: 'hero' }], ['install-mobile-hero', { kind: 'pc', sec: 'hero' }],
                ['share-hero', { kind: 'share', sec: 'hero' }], ['mail-hero', { kind: 'mail', sec: 'hero' }],
                ['install-final', { kind: 'cta', sec: 'final' }], ['install-mobile-final', { kind: 'pc', sec: 'final' }],
                ['share-final', { kind: 'share', sec: 'final' }], ['mail-final', { kind: 'mail', sec: 'final' }],
                ...good.map((e) => [`social-${e.code}-menu`, { kind: 'social', href: e.url }]),
            ];
            const bad = [];
            for (const [name, rule] of rules) { const r = await check(name, rule); if (r) bad.push(r); }
            assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

// 10～16 的計數名字已轉成必過：install-footer、blog-footer、report、social-<代號>-footer、頁尾那句（f8-sections.test.js 的 F8.3 頁尾）、
// blog-author、social-<代號>-author（F8.3 作者與社群）、blog-news（現在的公告沒有連結，在 f8-content.test.js 的 F8.1 用寫壞的、內容多的那兩份量）。
