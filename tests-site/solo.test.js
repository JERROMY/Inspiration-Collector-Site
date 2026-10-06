// F8.5f 分享卡圖與圖示 <head> 一組、F8.6b 「/」三語選單頁與 404 的外觀與通用。讀 out/；F8.6b 真的開瀏覽器。
//
// 照設計稿 90de030（004264c 之上修了「/」與 404 大標日文那一段的字型）的 design/homepage/root/index.html、404/index.html（home.css 的 .solo、notes/4-3.md「/」「404」與「給前端的事」）、
// copy.md「`/` 三語選單頁」「404 找不到的頁面」、icons/site/README.md、規格書 §4、§10.2、§10.6、§10.7、§12、§14。
// 對照資料：fixtures/design-solo-90de030.json（tools/measure-design.mjs --only solo 量設計稿產生）。
//
// 兩頁用哪一種語言（依據：規格書 §4「這一頁整頁標成英文，中文、日文那兩行各自標自己的語言」、§10.6、§10.7「三種語言各一個回首頁」；notes/4-3.md「整頁 lang="en"、三段各標語言」；copy.md 兩節）：
//   一頁三語並列，<html lang="en">；每一段字用它自己那一語的字串表 —— 「/」是 root.name、root.lead、root.pick，404 是 404.title、404.body、404.home。
//   <title>：「/」＝root.meta.title（F2.2 守），404＝404.meta.title（三語的字串表是同一句）。分享卡圖：「/」與 404 用英文那張 og-en.png、og:image:alt 用英文（規格書 §10.6；404 照「/」）。
//   manifest：「/」與 404 用 /en/site.webmanifest（F2.7 的介面），name 是英文的 nav.brand。
//
// 介面（README.md「「/」與 404 的外觀、分享卡圖與圖示 <head>（F8.5f、F8.6b）」）：
//   <main> 裡一個 <header>：記號 <img alt="">、404 多一個 aria-hidden="true" 的「404」、<h1> 裡三段各標 lang（zh-Hant、en、ja）；
//   一個 <ul>，每一語一個 <li lang>：一段說明 <p>、一顆連到 /<語言>/（從根目錄算）的 <a>。設計稿與網站都用這組選擇器找（page-helpers.js 的 soloItems），不靠 class 名稱。
//
// 量什麼：
//   F8.5f 五頁（/zh/、/en/、/ja/、/、404）的 <head>：og:image 與 twitter:image 各一條、一樣、是 https://collector.jerromy.com/og/og-<語言>.png（「/」與 404 是 og-en.png），
//         那個檔在 out/og/、是 1200×630 的 PNG；og:image:width／height 1200／630；og:image:alt＝那一語的 og.image.alt（有放 twitter:image:alt 的話一樣）。
//         圖示一組（favicon-16、favicon-32、apple-touch-icon、manifest、theme-color）都在、href 從根目錄算（開頭是一個「/」）、指到 out/ 裡在的檔；
//         theme-color 跟那一頁連的 manifest 的 theme_color 同值；manifest 的 name、lang 是那一頁的語言（「/」與 404 是英文）；三份 manifest 的 name 各是自己的語言。
//         404：<title>＝404.meta.title、<meta name="robots"> 剛好一條、內容有 noindex（兩條也紅）。
//   F8.6b 兩頁 × 十二種寬度（高 900、有滑鼠、減少動態；「/」關掉 JS 開 —— 有 JS 會跳走，看得到這一頁的就是關掉 JS 的人；404 開著 JS 從 /zh/a/b/c/d/ 開）：
//         版面：每一塊離 <main> 左上角的 x、y、寬、高跟設計稿差 ≤ 1px；每一行的字跟設計稿一樣。
//         字到框邊：三顆按鈕的字到框內緣 ≥ 設計稿（字形框：內距寫 0 的那一邊用設計稿量到的距離；行盒：設計稿量到的距離），都差 1px 內。
//         通用：不橫捲（scrollWidth ≤ innerWidth）、字不壓到別的東西、按鈕 ≥ 44×44、按鈕裡的字沒跑出框；滑過、鍵盤焦點之後沒有在跑的動畫。
//         文案：字跟字串表一樣；說明文字中日文每行 5～25 字寬、行首沒有孤標點（跟設計稿同一行的不算），英文沒有一個字一行。
//         結構：一個 <main>、一個 <h1>、<html lang="en">、三段各標自己的 lang、記號的替代文字是空的、404 的「404」aria-hidden。
//         對比：每一段字對底 ≥ 設計稿（差 0.05 內）而且 ≥ 4.5。
//   F8.6b 404 在深路徑（/zh/a/b/c/d/、200 個 a 的網址）：CSS、字型、記號、圖示、manifest 都載得到（沒有 4xx 的請求，除了頁面本身的 404）；長網址 280、320、1440 不橫捲、字沒有超出畫面。
//   F8.6b 「/」關掉 JS：三顆連結點下去到 /zh/、/en/、/ja/。
//   F8.6b 鍵盤（「/」關掉 JS、404 開著 JS）：從頁首 Tab 三次依序停在中、英、日三顆按鈕，看得出停在哪（:focus-visible 有外框或陰影）；Enter 走得到。
//   F8.6b 寬度清單照規格書 §14（防呆：日文已知會壞的 320、1024 在裡面）。
//   「/」依瀏覽器語言分流（F2.4）、HTML 沒有自己寫的內嵌腳本（F3.9）、CSS 只用語意 token 不寫死色碼（F1.5、F3.9 的 --mira-*）、「/」的 <h1> 不黏字（F2.1）、
//   兩頁的 <html lang>（F1.2、F1.9）掃全站或已經有，這裡不重複。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F8\\.5f|F8\\.6b"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OUT, SITE, LANGS, HTML_LANG, readOut, tagAttrs, playwright, browserSession, needOut } from './helpers.js';
import { textLines, width as wide, WIDTHS, BOXES, EDGE_GAPS, edgeFloor, soloItems, SOLO_BUTTONS, LINEBOX_GAPS, CONTRAST } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';
import { SITE_URL } from '../app/site.js';

const DES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-solo-90de030.json'), 'utf8'));
const say = (lang, id) => getPlainString(lang, id);
const ORIGIN = SITE_URL.replace(/\/$/, '');
const REL_OF = { zh: 'zh/index.html', en: 'en/index.html', ja: 'ja/index.html', root: 'index.html', 404: '404.html' };
const FIVE = [...LANGS, 'root', '404'];
const LANG_OF = (page) => (LANGS.includes(page) ? page : 'en');
const THEME = '#1b1d24';
// 兩頁每一段字用的字串表 id
const IDS = { root: { title: 'root.name', lead: 'root.lead', btn: 'root.pick' }, 404: { title: '404.title', lead: '404.body', btn: '404.home' } };
const PAGES = ['root', '404'];
const DEEP = '/zh/a/b/c/d/';
const LONG = `/${'a'.repeat(200)}`;

const head = (rel) => {
    const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(readOut(rel));
    assert.ok(m, `out/${rel} 找不到 <head>`);
    return m[1];
};
const linksOf = (rel, name) => tagAttrs(head(rel), 'link').filter((a) => (a.rel || '').toLowerCase().split(/\s+/).includes(name));
const metaOf = (rel, key, value) => tagAttrs(head(rel), 'meta').filter((a) => (a[key] || '').toLowerCase() === value).map((a) => a.content);
const pngSize = (buf) => (buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);
// 從根目錄算的路徑：開頭剛好一個「/」（不是 ./、../、相對路徑，也不是 //網域）
const fromRoot = (href) => typeof href === 'string' && /^\/(?!\/)/.test(href);
const inOut = (href) => fs.existsSync(path.join(OUT, decodeURIComponent(href.split(/[?#]/)[0]).replace(/^\//, '')));

// ---------- F8.5f 分享卡圖與圖示 <head> ----------

test('F8.5f 五頁的分享卡圖：og:image 與 twitter:image 是絕對網址、指到 out/og/ 裡 1200×630 的那一語（「/」與 404 是英文），寬高與替代文字', () => {
    needOut();
    const bad = [];
    for (const page of FIVE) {
        const rel = REL_OF[page];
        const lang = LANG_OF(page);
        const want = `${ORIGIN}/og/og-${lang}.png`;
        const og = metaOf(rel, 'property', 'og:image');
        const tw = metaOf(rel, 'name', 'twitter:image');
        if (og.length !== 1 || og[0] !== want) bad.push(`${page}：og:image 要剛好一條 ${want}，得到 ${JSON.stringify(og)}`);
        if (tw.length !== 1 || tw[0] !== want) bad.push(`${page}：twitter:image 要剛好一條 ${want}，得到 ${JSON.stringify(tw)}`);
        for (const [prop, value] of [['og:image:width', '1200'], ['og:image:height', '630'], ['og:image:alt', say(lang, 'og.image.alt')]]) {
            const got = metaOf(rel, 'property', prop);
            if (got.length !== 1 || got[0] !== value) bad.push(`${page}：${prop} 要剛好一條「${value}」，得到 ${JSON.stringify(got)}`);
        }
        const twAlt = metaOf(rel, 'name', 'twitter:image:alt');
        if (twAlt.length > 1 || (twAlt.length === 1 && twAlt[0] !== say(lang, 'og.image.alt'))) bad.push(`${page}：twitter:image:alt（有放的話）要跟 og:image:alt 一樣，得到 ${JSON.stringify(twAlt)}`);
    }
    for (const lang of LANGS) {
        const file = path.join(OUT, 'og', `og-${lang}.png`);
        if (!fs.existsSync(file)) { bad.push(`out/og/og-${lang}.png 不在`); continue; }
        const size = pngSize(fs.readFileSync(file));
        if (!size || size[0] !== 1200 || size[1] !== 630) bad.push(`out/og/og-${lang}.png 要是 1200×630 的 PNG，得到 ${size ? size.join('×') : '不是 PNG'}`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F8.5f 五頁的圖示 <head> 一組都在、從根目錄算、指到 out/ 裡在的檔；theme-color 跟 manifest 同值；manifest 是那一頁的語言', () => {
    needOut();
    const bad = [];
    for (const page of FIVE) {
        const rel = REL_OF[page];
        const lang = LANG_OF(page);
        const icons = linksOf(rel, 'icon');
        const wanted = [
            ['favicon-32', icons.filter((a) => a.sizes === '32x32')],
            ['favicon-16', icons.filter((a) => a.sizes === '16x16')],
            ['apple-touch-icon', linksOf(rel, 'apple-touch-icon')],
            ['manifest', linksOf(rel, 'manifest')],
        ];
        for (const [name, found] of wanted) {
            if (found.length !== 1) { bad.push(`${page}：${name} 要剛好一條，得到 ${found.length}`); continue; }
            const { href } = found[0];
            if (!fromRoot(href)) bad.push(`${page}：${name} 的 href 要從根目錄算（開頭一個 /，404 在任何深度都會出現），得到「${href}」`);
            else if (!inOut(href)) bad.push(`${page}：${name} 指到 ${href}，out/ 裡沒有這個檔`);
        }
        const theme = metaOf(rel, 'name', 'theme-color');
        if (theme.length !== 1 || theme[0].toLowerCase() !== THEME) bad.push(`${page}：theme-color 要剛好一條 ${THEME}，得到 ${JSON.stringify(theme)}`);
        const manifestHref = linksOf(rel, 'manifest')[0]?.href;
        if (!manifestHref || !fromRoot(manifestHref) || !inOut(manifestHref)) continue;
        let m;
        try {
            m = JSON.parse(fs.readFileSync(path.join(OUT, manifestHref.replace(/^\//, '')), 'utf8'));
        } catch (err) {
            bad.push(`${page}：${manifestHref} 不是 JSON（${err.message}）`);
            continue;
        }
        if (String(m.theme_color).toLowerCase() !== String(theme[0]).toLowerCase()) bad.push(`${page}：theme-color（${theme[0]}）要跟 ${manifestHref} 的 theme_color（${m.theme_color}）同值`);
        if (m.name !== say(lang, 'nav.brand')) bad.push(`${page}：${manifestHref} 的 name 要是 ${lang} 的「${say(lang, 'nav.brand')}」，得到「${m.name}」`);
        if (m.lang !== HTML_LANG[lang]) bad.push(`${page}：${manifestHref} 的 lang 要是 ${HTML_LANG[lang]}，得到 ${m.lang}`);
        for (const icon of m.icons ?? []) if (!fromRoot(icon.src) || !inOut(icon.src)) bad.push(`${page}：${manifestHref} 的圖示 ${icon.src} 要從根目錄算、在 out/ 裡`);
    }
    const names = LANGS.map((lang) => { try { return JSON.parse(readOut(`${lang}/site.webmanifest`)).name; } catch { return null; } });
    if (new Set(names).size !== LANGS.length) bad.push(`三份 manifest 的 name 要各是自己的語言（三個不一樣），得到 ${JSON.stringify(names)}`);
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F8.5f 404 的 <title> 是 404.meta.title、不給搜尋引擎收（noindex）', () => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head(REL_OF[404]));
    const title = m ? m[1].replace(/&amp;/g, '&').trim() : null;
    assert.equal(title, say('en', '404.meta.title'), `404 的 <title> 要是「${say('en', '404.meta.title')}」`);
    for (const lang of LANGS) assert.equal(say(lang, '404.meta.title'), say('en', '404.meta.title'), '防呆：三語的 404.meta.title 是同一句（一頁三語並列）');
    const robots = metaOf(REL_OF[404], 'name', 'robots');
    assert.ok(robots.length === 1 && /\bnoindex\b/i.test(robots[0]), `404 的 <meta name="robots"> 要剛好一條、內容有 noindex，得到 ${JSON.stringify(robots)}`);
});

// ---------- F8.6b 兩頁的外觀與通用 ----------

test('F8.6b 寬度清單照規格書 §14 的十二種（日文已知會壞的 320、1024 在裡面）', () => {
    assert.deepEqual(WIDTHS, [280, 320, 360, 375, 390, 414, 430, 640, 768, 1024, 1280, 1440]);
    for (const page of PAGES) for (const w of WIDTHS) assert.ok(DES.pages[page][String(w)], `設計稿的對照資料少了 ${page} ${w}`);
});

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());
const skip = pw ? false : why;

// 「/」關掉 JS（有 JS 的人在畫面出來之前就跳走了）；404 開著 JS，從深路徑開
async function open(name, width, { js, url, reduced = true, height = 900 } = {}) {
    const { site, browser } = await session.get();
    const useJs = js ?? name !== 'root';
    const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: useJs, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const failed = [];
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400 && r.request().resourceType() !== 'document') failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    page.on('requestfailed', (r) => failed.push(`失敗 ${new URL(r.url()).pathname}`));
    const res = await page.goto(`${site.url}${url ?? (name === 'root' ? '/' : DEEP)}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, failed, errors, status: res?.status(), base: site.url };
}

const keysOf = (name) => soloItems(name);

for (const name of PAGES) {
    test(`F8.6b ${name} 的版面跟設計稿一樣（十二種寬度）：每一塊離 <main> 左上角的位置與大小差 ≤ 1px、每一行的字一樣`, { skip }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(name, width);
            try {
                const want = DES.pages[name][String(width)];
                const items = keysOf(name);
                const got = await page.evaluate(BOXES, { section: 'main', items });
                if (!got) { bad.push(`${width}：找不到 <main>`); continue; }
                for (const { key, sel, nth } of items) {
                    if (!got[key]) { bad.push(`${width} ${key}：找不到（main ${sel}）`); continue; }
                    const d = got[key].map((v, i) => Math.abs(v - want.boxes[key][i]));
                    if (d.some((v) => v > 1)) bad.push(`${width} ${key}：網站 [x ${got[key][0]}, y ${got[key][1]}, 寬 ${got[key][2]}, 高 ${got[key][3]}]，設計稿 [${want.boxes[key].join(', ')}]`);
                    if (key === 'mark') continue;
                    const lines = await textLines(page.locator(`main ${sel}`).nth(nth));
                    if (JSON.stringify(lines) !== JSON.stringify(want.lines[key])) bad.push(`${width} ${key}：網站 ${JSON.stringify(lines)}，設計稿 ${JSON.stringify(want.lines[key])}`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${name}：${bad.length} 處跟設計稿不一樣`);
    });
}

for (const name of PAGES) {
    test(`F8.6b ${name} 的字到框邊（十二種寬度）：三顆按鈕的字到框內緣 ≥ 設計稿（字形框與行盒兩種）`, { skip }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(name, width);
            try {
                const want = DES.pages[name][String(width)];
                const glyph = await page.evaluate(EDGE_GAPS, SOLO_BUTTONS);
                const box = await page.evaluate(LINEBOX_GAPS, SOLO_BUTTONS);
                if (!glyph || !box) { bad.push(`${width}：找不到按鈕（${SOLO_BUTTONS}）`); continue; }
                if (glyph.count !== 3) bad.push(`${width}：按鈕要三顆，得到 ${glyph.count}`);
                const floor = edgeFloor(want.gaps);
                if (glyph.gapX < floor.x) bad.push(`${width}：字形到框的左右內緣最近 ${glyph.gapX}px，要 ≥ ${floor.x}（設計稿左右內距 ${want.gaps.padX}）`);
                if (glyph.gapY < floor.y) bad.push(`${width}：字形到框的上下內緣最近 ${glyph.gapY}px，要 ≥ ${floor.y}（設計稿字到框 ${want.gaps.gapY}）`);
                if (box.gapX < want.lineGaps.gapX - 1) bad.push(`${width}：行盒到框的左右內緣最近 ${box.gapX}px，要 ≥ ${want.lineGaps.gapX - 1}`);
                if (box.gapY < want.lineGaps.gapY - 1) bad.push(`${width}：行盒到框的上下內緣最近 ${box.gapY}px，要 ≥ ${want.lineGaps.gapY - 1}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${name}：${bad.length} 處不對`);
    });
}

// 版面問題：塊與塊重疊、按鈕 < 44×44、按鈕裡的字跑出框、整頁橫捲
const SOLO_PROBLEMS = (items) => {
    const main = document.querySelector('main');
    if (!main) return null;
    const blocks = items.map(({ key, sel, nth }) => ({ key, el: main.querySelectorAll(sel)[nth] })).filter((b) => b.el && b.el.checkVisibility());
    const hits = [];
    for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i].el.getBoundingClientRect();
        const b = blocks[j].el.getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) hits.push(`${blocks[i].key}／${blocks[j].key}`);
    }
    const small = [];
    const spill = [];
    for (const c of main.querySelectorAll('a, button')) {
        if (!c.checkVisibility()) continue;
        const r = c.getBoundingClientRect();
        const label = c.textContent.trim().slice(0, 14);
        if (r.width < 43.5 || r.height < 43.5) small.push(`${label}（${Math.round(r.width)}×${Math.round(r.height)}）`);
        let out = 0;
        const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (g.width && (g.left < r.left - 0.5 || g.right > r.right + 0.5 || g.top < r.top - 0.5 || g.bottom > r.bottom + 0.5)) out += 1;
            }
        }
        if (out) spill.push(`${label}（${out} 個字）`);
    }
    return { hits, small, spill, scroll: document.documentElement.scrollWidth - innerWidth };
};
const running = () => document.getAnimations().filter((a) => a.playState === 'running').length;

for (const name of PAGES) {
    test(`F8.6b ${name} 通用（十二種寬度、減少動態）：不橫捲、字不壓字、按鈕 ≥ 44×44、按鈕裡的字沒跑出框；滑過、焦點之後沒有在跑的動畫`, { skip }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context, errors } = await open(name, width);
            try {
                const r = await page.evaluate(SOLO_PROBLEMS, keysOf(name));
                if (!r) { bad.push(`${width}：找不到 <main>`); continue; }
                if (r.scroll > 0) bad.push(`${width}：整頁橫捲 ${r.scroll}px`);
                if (r.hits.length) bad.push(`${width}：字壓到別的東西 ${r.hits.join('、')}`);
                if (r.small.length) bad.push(`${width}：小於 44×44 ${r.small.join('、')}`);
                if (r.spill.length) bad.push(`${width}：按鈕裡的字跑出框 ${r.spill.join('、')}`);
                const btns = page.locator(SOLO_BUTTONS);
                for (let i = 0; i < await btns.count(); i += 1) {
                    await btns.nth(i).hover();
                    await btns.nth(i).focus();
                }
                await page.waitForTimeout(100);
                const n = await page.evaluate(running);
                if (n) bad.push(`${width}：減少動態時滑過、焦點之後還有 ${n} 個在跑的動畫`);
                if (errors.length) bad.push(`${width}：頁面錯誤 ${errors.join('；')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${name}：${bad.length} 處不對`);
    });
}

const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;

for (const name of PAGES) {
    test(`F8.6b ${name} 的文案（十二種寬度）：字跟字串表一樣；說明文字中日文每行 5～25 字寬、行首沒有孤標點，英文沒有一個字一行`, { skip }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(name, width);
            try {
                const want = DES.pages[name][String(width)];
                for (const lang of LANGS) {
                    for (const part of ['title', 'lead', 'btn']) {
                        const key = `${part}.${lang}`;
                        const { sel, nth } = keysOf(name).find((i) => i.key === key);
                        const el = page.locator(`main ${sel}`).nth(nth);
                        if (!(await el.count())) { bad.push(`${width} ${key}：找不到（main ${sel}）`); continue; }
                        const text = (await el.textContent()).replace(/\s+/g, ' ').trim();
                        const id = IDS[name][part];
                        if (width === WIDTHS[0] && text !== say(lang, id).replace(/\s+/g, ' ').trim()) bad.push(`${key}：字要是字串表 ${lang} 的 ${id}「${say(lang, id)}」，得到「${text}」`);
                        if (part !== 'lead') continue;
                        const lines = await textLines(el);
                        for (const line of lines) {
                            if (want.lines[key].includes(line)) continue;
                            if (lang === 'en') { if (!/\s/.test(line)) bad.push(`${width} ${key}：一行只有一個字「${line}」`); continue; }
                            if (wide(line) < 5 || wide(line) > 25) bad.push(`${width} ${key}：一行 ${wide(line)} 字寬（要 5～25，少於 5 字要併回上一行）「${line}」`);
                            if (HEAD_PUNCT.test(line)) bad.push(`${width} ${key}：行首是孤標點「${line}」`);
                        }
                    }
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${name}：${bad.length} 處不對`);
    });
}

for (const name of PAGES) {
    test(`F8.6b ${name} 的結構（關掉 JS，390）：一個 <main>、一個 <h1>、整頁 lang="en"、三段各標自己的 lang、連到 /<語言>/、記號的替代文字是空的${name === '404' ? '、「404」aria-hidden' : ''}`, { skip }, async () => {
        const { page, context } = await open(name, 390, { js: false });
        try {
            const r = await page.evaluate(() => {
                const main = document.querySelectorAll('main');
                const m = main[0];
                return {
                    lang: document.documentElement.lang, mains: main.length, h1: document.querySelectorAll('h1').length,
                    h1Langs: m ? [...m.querySelectorAll('h1 [lang]')].map((e) => e.lang) : [],
                    parts: m ? [...m.querySelectorAll('ul > li[lang]')].map((li) => ({ lang: li.lang, p: li.querySelectorAll('p').length, a: [...li.querySelectorAll('a')].map((a) => a.getAttribute('href')) })) : [],
                    mark: m ? [...m.querySelectorAll('header img')].map((i) => i.getAttribute('alt')) : [],
                    code: m ? [...m.querySelectorAll('header [aria-hidden="true"]')].map((e) => e.textContent.trim()) : [],
                };
            });
            const bad = [];
            if (r.lang !== 'en') bad.push(`<html lang> 要是 en（一頁三語、英文為底），得到 ${r.lang}`);
            if (r.mains !== 1) bad.push(`<main> 要剛好一個，得到 ${r.mains}`);
            if (r.h1 !== 1) bad.push(`<h1> 要剛好一個，得到 ${r.h1}`);
            const order = LANGS.map((l) => HTML_LANG[l]);
            if (JSON.stringify(r.h1Langs) !== JSON.stringify(order)) bad.push(`<h1> 裡三段要依序標 ${order.join('、')}，得到 ${JSON.stringify(r.h1Langs)}`);
            if (JSON.stringify(r.parts.map((p) => p.lang)) !== JSON.stringify(order)) bad.push(`<ul> 裡每一語一個 <li lang>，依序 ${order.join('、')}，得到 ${JSON.stringify(r.parts.map((p) => p.lang))}`);
            for (const [i, p] of r.parts.entries()) {
                const lang = LANGS[i];
                if (p.p !== 1) bad.push(`${lang}：一段說明 <p>，得到 ${p.p}`);
                if (JSON.stringify(p.a) !== JSON.stringify([`/${lang}/`])) bad.push(`${lang}：一顆連到 /${lang}/（從根目錄算）的連結，得到 ${JSON.stringify(p.a)}`);
            }
            if (JSON.stringify(r.mark) !== JSON.stringify([''])) bad.push(`<header> 裡一個記號 <img alt="">（名稱就在旁邊），得到 ${JSON.stringify(r.mark)}`);
            if (name === '404' && JSON.stringify(r.code) !== JSON.stringify(['404'])) bad.push(`<header> 裡一個 aria-hidden 的「404」（標題已經講了），得到 ${JSON.stringify(r.code)}`);
            assert.deepEqual(bad, [], `${name}：${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

for (const name of PAGES) {
    test(`F8.6b ${name} 的對比（390、1440）：每一段字對底 ≥ 設計稿（差 0.05 內）而且 ≥ 4.5`, { skip }, async () => {
        const bad = [];
        for (const width of [390, 1440]) {
            const { page, context } = await open(name, width);
            try {
                const want = DES.pages[name][String(width)].contrast;
                const got = await page.evaluate(CONTRAST, keysOf(name).filter((i) => i.key !== 'mark'));
                for (const [key, ratio] of Object.entries(want)) {
                    if (got[key] == null) { bad.push(`${width} ${key}：找不到`); continue; }
                    if (got[key] < ratio - 0.05 || got[key] < 4.5) bad.push(`${width} ${key}：對比 ${got[key]}，設計稿 ${ratio}（至少 4.5）`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${name}：${bad.length} 處不對`);
    });
}

test('F8.6b 404 在深路徑也載得到 CSS、字型、記號、圖示與 manifest（資產路徑從根目錄算）；長網址不橫捲、字沒超出畫面', { skip }, async () => {
    const bad = [];
    const cases = [[DEEP, 1440], [DEEP, 390], [LONG, 280], [LONG, 320], [LONG, 1440]];
    for (const [url, width] of cases) {
        const label = `${url.length > 30 ? `${url.slice(0, 12)}…（${url.length} 字）` : url} ${width}`;
        const { page, context, failed, status, base } = await open('404', width, { url });
        try {
            if (status !== 404) bad.push(`${label}：伺服器要回 404，得到 ${status}（防呆：要量的是 404 頁）`);
            const r = await page.evaluate(async (origin) => {
                const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => ({ href: l.getAttribute('href'), ok: Boolean(l.sheet) }));
                const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''));
                const imgs = [...document.querySelectorAll('main img')].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
                const heads = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((l) => l.getAttribute('href'));
                const fetched = await Promise.all(heads.map(async (href) => ({ href, status: (await fetch(new URL(href, location.href), { cache: 'no-store' })).status })));
                let clipped = 0;
                const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                while (walk.nextNode()) {
                    const node = walk.currentNode;
                    if (!node.parentElement.checkVisibility()) continue;
                    for (let k = 0; k < node.data.length; k += 1) {
                        if (!node.data[k].trim()) continue;
                        const range = document.createRange();
                        range.setStart(node, k);
                        range.setEnd(node, k + 1);
                        const g = range.getBoundingClientRect();
                        if (g.width && (g.left < -0.5 || g.right > innerWidth + 0.5)) clipped += 1;
                    }
                }
                return { sheets, fonts, imgs, fetched, clipped, scroll: document.documentElement.scrollWidth - innerWidth, origin };
            }, base);
            if (!r.sheets.length) bad.push(`${label}：一支 CSS 都沒有`);
            for (const s of r.sheets) if (!s.ok) bad.push(`${label}：CSS ${s.href} 沒載到`);
            if (!r.fonts.includes('Google Sans Flex')) bad.push(`${label}：網頁字型 Google Sans Flex 沒載到（載到 ${r.fonts.join('、') || '沒有'}）`);
            if (!r.fonts.includes('JetBrains Mono')) bad.push(`${label}：等寬字型 JetBrains Mono 沒載到（「404」用等寬讀數）`);
            if (!r.imgs.length) bad.push(`${label}：<main> 裡沒有記號`);
            for (const i of r.imgs) if (!i.ok) bad.push(`${label}：圖 ${i.src} 沒載到`);
            if (r.fetched.length < 4) bad.push(`${label}：圖示與 manifest 要有 4 條（16、32、apple-touch-icon、manifest），得到 ${r.fetched.length}`);
            for (const f of r.fetched) if (f.status !== 200) bad.push(`${label}：${f.href} 從這個網址開是 ${f.status}`);
            if (failed.length) bad.push(`${label}：有載不到的東西 ${failed.join('、')}`);
            if (r.scroll > 0) bad.push(`${label}：整頁橫捲 ${r.scroll}px`);
            if (r.clipped) bad.push(`${label}：${r.clipped} 個字超出畫面`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F8.6b 「/」關掉 JS：三顆連結點下去到 /zh/、/en/、/ja/', { skip }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context } = await open('root', 390, { js: false });
        try {
            const link = page.locator(`main li[lang="${HTML_LANG[lang]}"] a`);
            if (!(await link.count())) { bad.push(`${lang}：找不到連結`); continue; }
            await link.click();
            await page.waitForURL(`**/${lang}/`, { timeout: 15000 }).catch(() => {});
            const at = new URL(page.url()).pathname;
            if (at !== `/${lang}/`) bad.push(`${lang}：點下去要到 /${lang}/，得到 ${at}`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 焦點外框看不看得到：:focus-visible、外框有寬度有顏色（不是 none、不是透明），或有陰影
const FOCUS_SHOWN = () => {
    const a = document.activeElement;
    const s = getComputedStyle(a);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && !/rgba\([^)]*,\s*0\)$|transparent/.test(s.outlineColor);
    return { href: a.getAttribute('href'), visible: a.matches(':focus-visible'), shown: outline || (s.boxShadow && s.boxShadow !== 'none') };
};

for (const name of PAGES) {
    test(`F8.6b ${name} 鍵盤（390、1440${name === 'root' ? '，關掉 JS' : ''}）：從頁首 Tab 依序停在中、英、日三顆，看得出停在哪；Enter 走得到`, { skip }, async () => {
        const bad = [];
        for (const width of [390, 1440]) {
            const { page, context } = await open(name, width);
            try {
                for (const lang of LANGS) {
                    await page.keyboard.press('Tab');
                    const f = await page.evaluate(FOCUS_SHOWN);
                    if (f.href !== `/${lang}/`) { bad.push(`${width}：第 ${LANGS.indexOf(lang) + 1} 次 Tab 要停在 /${lang}/ 那一顆，停在 ${f.href ?? '別的地方'}`); break; }
                    if (!f.visible || !f.shown) bad.push(`${width} ${lang}：焦點外框看不到（:focus-visible ${f.visible}、外框或陰影 ${f.shown}）`);
                }
                if (width === 390 && !bad.length) {
                    await page.keyboard.press('Enter');
                    await page.waitForURL('**/ja/', { timeout: 15000 }).catch(() => {});
                    if (new URL(page.url()).pathname !== '/ja/') bad.push(`${width}：焦點在日文那一顆按 Enter 要到 /ja/，得到 ${new URL(page.url()).pathname}`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${name}：${bad.length} 處不對`);
    });
}
