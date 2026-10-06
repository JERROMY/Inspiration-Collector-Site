// F8.2 常見問題、F8.3 頁尾與作者、F8.4 支援裝置、F8.6 文案與通用（用現在的 content/ 產生的 out/）—— 10 支援裝置、11 公告、12 更新紀錄、13 常見問題、14 作者與社群、16 頁尾。
// 讀 out/，真的開瀏覽器。寫壞的內容、內容比畫面多、更新紀錄的類型標記在 f8-content.test.js（另外 build 兩份暫存複本）。
// 照設計稿 5b74044 的 {zh,en,ja}/index.html 10～16 那幾段、home.css「10 支援裝置」與第三批（4-3）那一段、strings/README.md「使用者自己寫的內容」「句子裡的連結」；
// 規格書 §5-10～16、§7、§10.4、§10.5、§11、§12、§14。對照資料：fixtures/design-lines-10-16.json（逐行）、fixtures/design-f8-1d18ae2.json（位置與字到框邊；004264c 只在 5b74044 之上改了 14 社群讀不到的虛線框上下內距；1d18ae2 再改了日文 faq.7.a 的斷行、狀態一覽多一格 12 的空狀態），
// 用 tools/measure-design.mjs --only f8 量設計稿產生。
//
// 2026-10-07 為什麼改：真的內容 9-29 那則公告取消置頂，現在沒有一則畫得出「置頂」標籤 —— F8.6 字到框邊的 news.pinned 搬到 f8-content.test.js（content-many 有一則置頂）。
//
// 介面（README.md「10～16（F8）」）：
//   <section data-section="devices" id="devices">、news／#news、changelog／#changelog、faq／#faq、author／#author 依序排在 09 之後、15 之前；頁尾是 <main> 後面的 <footer data-section="footer">。
//   版型裡的字（字串表的 id）畫在 data-id="<id>" 的元素上（連結、按鈕、<summary> 的 data-id 放在它本身；常見問題的題目在 <h3>、答案在 <p>）。
//   13：每一題一個 <details>，<summary> 裡是 data-id="faq.N.q"，答案 data-id="faq.N.a" 在同一個 <details> 裡；第一題 open。
//   14：照片 <img alt＝author.photo.alt>；社群一排 <ul aria-label＝author.socials>，每個連結 aria-label＝social.<代號>、data-goatcounter-click="social-<代號>-author"。
//   16：社群一排同上（social-<代號>-footer）；回報問題 <a data-id="foot.report" href="mailto:npc10091983@gmail.com?subject=…&body=…" data-goatcounter-click="report">。
//
// 量什麼：
//   F8.2 三語：預設只有第一題打開；用鍵盤（從 13 前面那個東西 Tab 過來）走到每一題，Enter／空白鍵打開、再按收起，看得出焦點停在哪；
//        結構化資料（JSON-LD 的 FAQPage）七題的問與答跟頁面上的字逐題一樣；收起來的答案也在 HTML 裡、關掉 JS 點得開（§10.4、§13、§14）；答案裡兩個句子連結。
//   F8.3 三語：頁尾兩句（沒有隸屬關係、GoatCounter）在而且看得到 —— GOATCOUNTER_CODE 空的時候也要在；回報問題的收件人、標題、內文；頁尾其他連結與計數名字；
//        14 與 16 的社群連結照 content/links.md（三語各自的名字）、計數名字；14 的照片、名字、部落格。
//   F8.4 三語 × 有滑鼠十二種寬度：規格表 640 以下標題在上、內容在下（左緣對齊），640 起兩欄（同一列、內容欄左緣對齊）；不橫捲、規格表自己也不橫捲；
//        四張卡（能用兩張、不行兩張）；不寫最低版本號、Linux、Chromebook、Edge、Brave（§5-10）。
//   F8.6 三語 × 十二種寬度：逐行跟設計稿一樣（13 全打開）與斷行規則（短行、長行、行首標點、拆詞）；每一段字的位置與大小跟設計稿差 ≤ 1px；
//        框裡的字到框的內緣 ≥ 設計稿量到的距離（差 1px 內）；不橫捲、區塊不重疊、控件 ≥ 44×44、控件裡的字沒跑出框（平常、13 全打開兩種）、減少動態沒有在跑的動畫；
//        關掉 JS 字都在；區塊順序與錨點；公告與更新紀錄（使用者寫的）中日文最後一行不只一個字。
//   CSS 沒有寫死色碼、HTML 沒有自己寫的內嵌腳本：F1.5、F3.9 掃全站，這幾區跟著被量，這裡不重複。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F8\\.[2346]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, readOut, tagAttrs, decodeEntities } from './helpers.js';
import { textLines, width as wide, WIDTHS, EDGE_GAPS, edgeFloor, BOXES, f8Item, F8_SECTIONS, sectionSweep, lastLineProblems, PUNCT, FOCUS_BEFORE } from './page-helpers.js';
import { getPlainString, hasString } from '../app/strings.js';
import { readContent } from '../lib/content.js';

const LINES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-10-16.json'), 'utf8'));
const DES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-f8-1d18ae2.json'), 'utf8'));
const say = (lang, id) => getPlainString(lang, id);
const flat = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const SITE_JS = fs.readFileSync(path.join(SITE, 'app', 'site.js'), 'utf8');
const SITE_URL = /export\s+const\s+SITE_URL\s*=\s*'([^']+)'/.exec(SITE_JS)[1];
const STORE_URL = /export\s+const\s+STORE_URL\s*=\s*'([^']+)'/.exec(SITE_JS)[1];
const REPORT_TO = 'npc10091983@gmail.com';
const SEVEN = [1, 2, 3, 4, 5, 6, 7];
const REQ = ['browser', 'ai', 'web', 'lang', 'price'];
const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;
// 說明文字（照斷行規則量）：不含標題、標籤、連結
const PROSE = ['devices.lead', 'devices.mobile.why', 'devices.other.why', ...REQ.filter((r) => r !== 'price').map((r) => `req.${r}`), 'changelog.lead',
    ...SEVEN.map((n) => `faq.${n}.a`), 'author.bio.1', 'author.bio.2', 'foot.line', 'foot.affiliation', 'foot.analytics'];
// 鍵 → 哪一區
const sectionOf = (key) => (/^(devices|req)\./.test(key) ? 'devices' : key.startsWith('foot.') ? 'footer' : key.split('.')[0]);

// 頂層的 await 要在登記任何測試之前：登記到一半才 await 的話，用 --test-name-pattern 篩的時候 after() 不會跑、瀏覽器沒關，整支卡住不結束（量過）
const content = await readContent(path.join(SITE, 'content'));
const goodLinks = content.links.ok ? content.links.entries.filter((e) => e.ok) : [];

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, { touch = false, js = true, reduced = true, height } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? { isMobile: true, hasTouch: true } : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, errors };
}

const toCenter = (el) => {
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - (innerHeight - r.height) / 2, behavior: 'instant' });
};

// ---------- F8.2 常見問題 ----------

// 每一題：<summary> 與 <details> 的狀態、答案看不看得到
const QA_STATE = (sec) => {
    const root = document.querySelector(sec);
    if (!root) return null;
    return [1, 2, 3, 4, 5, 6, 7].map((n) => {
        const q = root.querySelector(`[data-id="faq.${n}.q"]`);
        const a = root.querySelector(`[data-id="faq.${n}.a"]`);
        const summary = q?.closest('summary');
        const details = summary?.closest('details');
        return { q: Boolean(q), a: Boolean(a), summary: Boolean(summary), sameDetails: Boolean(details && a && details.contains(a)), open: Boolean(details?.open), shown: Boolean(a?.checkVisibility()) };
    });
};

for (const lang of LANGS) {
    test(`F8.2 常見問題（${lang}，有滑鼠 1440、390）：預設只有第一題打開；鍵盤 Tab 走到每一題，Enter／空白鍵打開、再按收起，焦點看得出來`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of [1440, 390]) {
            const { page, context, errors } = await open(lang, width);
            const sec = F8_SECTIONS.faq;
            try {
                const first = await page.evaluate(QA_STATE, sec);
                if (!first) { bad.push(`${width}：找不到 13 常見問題（${sec}）`); continue; }
                first.forEach((s, i) => {
                    const n = i + 1;
                    if (!s.q || !s.summary) bad.push(`${width} 第 ${n} 題：題目 data-id="faq.${n}.q" 要在一個 <summary> 裡`);
                    if (!s.a || !s.sameDetails) bad.push(`${width} 第 ${n} 題：答案 data-id="faq.${n}.a" 要在同一個 <details> 裡`);
                });
                if (bad.length) continue;
                const opened = first.map((s) => s.open);
                if (JSON.stringify(opened) !== JSON.stringify([true, false, false, false, false, false, false])) bad.push(`${width}：預設要只有第一題打開，得到 ${opened.map((o) => (o ? '開' : '關')).join('')}`);
                if (!first[0].shown) bad.push(`${width}：第一題的答案要看得到`);
                if (first.slice(1).some((s) => s.shown)) bad.push(`${width}：收著的題目答案不能看得到`);
                // 走使用者那條路：焦點放在 13 前面最後一個 Tab 停得到的東西上，之後只用鍵盤
                await page.locator(sec).evaluate(toCenter);
                await page.evaluate(FOCUS_BEFORE, sec);
                for (const n of SEVEN) {
                    await page.keyboard.press('Tab');
                    const at = await page.evaluate(({ sec, n }) => {
                        const summary = document.querySelector(`${sec} [data-id="faq.${n}.q"]`).closest('summary');
                        const a = document.activeElement;
                        const s = getComputedStyle(a);
                        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
                        return { onIt: a === summary, what: `${a.tagName.toLowerCase()}${a.dataset?.id ? `[data-id=${a.dataset.id}]` : ''} ${(a.textContent || '').trim().slice(0, 16)}`, focusVisible: a.matches(':focus-visible'), ring };
                    }, { sec, n });
                    if (!at.onIt) { bad.push(`${width}：按 Tab 要停在第 ${n} 題，停在 ${at.what}`); break; }
                    if (!at.focusVisible || !at.ring) bad.push(`${width} 第 ${n} 題：鍵盤停在上面時要看得出來（:focus-visible ${at.focusVisible}、外框或陰影 ${at.ring}）`);
                    const keys = n === 1 ? ['Enter', 'Enter'] : n % 2 ? ['Enter', 'Enter'] : [' ', ' '];
                    const name = (k) => (k === ' ' ? '空白鍵' : 'Enter');
                    const before = n === 1;
                    await page.keyboard.press(keys[0]);
                    await page.waitForTimeout(50);
                    let s = (await page.evaluate(QA_STATE, sec))[n - 1];
                    if (s.open === before || s.shown === before) bad.push(`${width} 第 ${n} 題：按 ${name(keys[0])} 要${before ? '收起' : '打開'}（得到 open ${s.open}、答案${s.shown ? '看得到' : '看不到'}）`);
                    await page.keyboard.press(keys[1]);
                    await page.waitForTimeout(50);
                    s = (await page.evaluate(QA_STATE, sec))[n - 1];
                    if (s.open !== before || s.shown !== before) bad.push(`${width} 第 ${n} 題：再按 ${name(keys[1])} 要${before ? '打開' : '收起'}（得到 open ${s.open}、答案${s.shown ? '看得到' : '看不到'}）`);
                }
                const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                if (scroll > 0) bad.push(`${width}：開合之後整頁橫捲 ${scroll}px`);
                if (errors.length) bad.push(`${width}：頁面錯誤 ${errors.slice(0, 2).join('、')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// JSON-LD 裡的 FAQPage（在 <script type="application/ld+json"> 的最上層、陣列或 @graph 裡）
function faqLd(html) {
    const found = [];
    for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(m[1]); } catch { continue; }
        const walk = (node) => {
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (!node || typeof node !== 'object') return;
            const type = [].concat(node['@type'] ?? []);
            if (type.includes('FAQPage')) found.push(node);
            if (node['@graph']) walk(node['@graph']);
        };
        walk(data);
    }
    return found;
}

for (const lang of LANGS) {
    test(`F8.2 結構化資料的七題跟頁面上的字逐題一樣（${lang}，關掉 JS）：問與答、順序`, { skip: pw ? false : why }, async () => {
        const html = readOut(`${lang}/index.html`);
        const pages = faqLd(html);
        assert.equal(pages.length, 1, `${lang}：JSON-LD 裡要剛好一個 FAQPage，得到 ${pages.length}`);
        const ld = [].concat(pages[0].mainEntity ?? []).map((q) => ({ q: flat(q.name), a: flat(q.acceptedAnswer?.text) }));
        assert.equal(ld.length, 7, `${lang}：FAQPage 要七題，得到 ${ld.length}`);
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const shown = await page.evaluate((sec) => [1, 2, 3, 4, 5, 6, 7].map((n) => ({
                q: document.querySelector(`${sec} [data-id="faq.${n}.q"]`)?.textContent ?? null,
                a: document.querySelector(`${sec} [data-id="faq.${n}.a"]`)?.textContent ?? null,
            })), F8_SECTIONS.faq);
            const bad = [];
            shown.forEach((s, i) => {
                const n = i + 1;
                if (s.q === null || s.a === null) { bad.push(`第 ${n} 題：頁面上找不到 faq.${n}.q 或 faq.${n}.a`); return; }
                if (flat(s.q) !== ld[i].q) bad.push(`第 ${n} 題的問：頁面「${flat(s.q)}」，JSON-LD「${ld[i].q}」`);
                if (flat(s.a) !== ld[i].a) bad.push(`第 ${n} 題的答：頁面「${flat(s.a)}」，JSON-LD「${ld[i].a}」`);
            });
            assert.deepEqual(bad, [], `${lang}：${bad.length} 處不一樣`);
        } finally {
            await context.close();
        }
    });
}

// 收起來的答案：§10.4「內容都要在 HTML 裡，不靠 JS」（章節摘要那條明寫「可以收起來，但要在 HTML 裡」）、§13「預設收著，第一題打開」、§14「把 JS 關掉，每一區的字（含常見問題）都還在」。
// 所以量：送出來的 HTML 裡就有七個答案的字；收著的那幾題只靠原生 <details> 收起來（答案和 <details> 之間沒有 hidden、aria-hidden、display:none），
// 關掉 JS 也點得開、點開就看得到。Google 對「結構化資料的問答要在頁面上看得到」與收合式答案的說法沒有抓原文核對（未查證），這裡照規格書。
for (const lang of LANGS) {
    test(`F8.2 收起來的答案也在 HTML 裡、關掉 JS 點得開（${lang}，390、1440）；答案裡的句子連結`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const html = readOut(`${lang}/index.html`).replace(/<!--[\s\S]*?-->/g, '');
        const text = flat(decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, '')));
        for (const n of SEVEN) if (!text.replace(/\s/g, '').includes(say(lang, `faq.${n}.a`).replace(/\s/g, ''))) bad.push(`送出來的 HTML 裡沒有第 ${n} 題答案的字`);
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { js: false });
            try {
                const sec = F8_SECTIONS.faq;
                const hidden = await page.evaluate((sec) => [1, 2, 3, 4, 5, 6, 7].map((n) => {
                    const a = document.querySelector(`${sec} [data-id="faq.${n}.a"]`);
                    const d = a?.closest('details');
                    if (!a || !d) return `第 ${n} 題：答案不在 <details> 裡`;
                    for (let e = a; e && e !== d; e = e.parentElement) {
                        if (e.hidden || e.getAttribute('aria-hidden') === 'true') return `第 ${n} 題：答案外面有 hidden／aria-hidden（${e.tagName.toLowerCase()}）`;
                    }
                    return null;
                }).filter(Boolean), sec);
                bad.push(...hidden.map((h) => `${width} ${h}`));
                for (const n of SEVEN.slice(1)) {
                    const summary = page.locator(`${sec} summary:has([data-id="faq.${n}.q"])`);
                    if (!(await summary.count())) { bad.push(`${width} 第 ${n} 題：找不到 <summary>`); continue; }
                    await summary.evaluate(toCenter);
                    await summary.click();
                    const shown = await page.locator(`${sec} [data-id="faq.${n}.a"]`).isVisible();
                    if (!shown) bad.push(`${width} 關掉 JS 第 ${n} 題：點了題目答案要看得到`);
                }
                const links = await page.evaluate((sec) => ({
                    2: [...document.querySelectorAll(`${sec} [data-id="faq.2.a"] a`)].map((a) => a.getAttribute('href')),
                    4: [...document.querySelectorAll(`${sec} [data-id="faq.4.a"] a`)].map((a) => a.getAttribute('href')),
                }), sec);
                if (JSON.stringify(links[2]) !== '["#privacy"]') bad.push(`${width} 第 2 題的答案要有一個句子連結到 #privacy，得到 ${JSON.stringify(links[2])}`);
                if (JSON.stringify(links[4]) !== '["#devices"]') bad.push(`${width} 第 4 題的答案要有一個句子連結到 #devices，得到 ${JSON.stringify(links[4])}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F8.3 頁尾、作者與社群 ----------

const socialName = (lang, code) => (hasString(lang, `social.${code}`) ? say(lang, `social.${code}`) : code);

// 一排社群連結：{ href, name（aria-label 或 title 或字）, gc }；寫壞的那一條數幾個
const SOCIALS = ({ sec, label }) => {
    const root = document.querySelector(sec);
    const ul = root && [...root.querySelectorAll('ul')].find((u) => u.getAttribute('aria-label') === label);
    if (!ul) return null;
    return {
        links: [...ul.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), name: (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent).trim(), gc: a.getAttribute('data-goatcounter-click'), w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height })),
        unreadable: ul.querySelectorAll('[data-state="unreadable"]').length,
    };
};

function socialProblems(got, lang, place, links = goodLinks) {
    if (!got) return [`${place}：找不到社群那一排（<ul aria-label="${say(lang, 'author.socials')}">）`];
    const bad = [];
    if (got.links.length !== links.length) bad.push(`${place}：社群連結要 ${links.length} 個（content/links.md 寫對的那幾行），得到 ${got.links.length}`);
    links.forEach((e, i) => {
        const a = got.links[i];
        if (!a) return;
        if (a.href !== e.url) bad.push(`${place} 第 ${i + 1} 個：要連到 ${e.url}（照 links.md 的順序），得到 ${a.href}`);
        if (a.name !== socialName(lang, e.code)) bad.push(`${place} 第 ${i + 1} 個（${e.code}）：讀屏的名字要是「${socialName(lang, e.code)}」，得到「${a.name}」`);
        if (a.gc !== `social-${e.code}-${place}`) bad.push(`${place} 第 ${i + 1} 個（${e.code}）：計數名字要是 social-${e.code}-${place}，得到 ${a.gc}`);
        if (a.w < 43.5 || a.h < 43.5) bad.push(`${place} 第 ${i + 1} 個（${e.code}）：要 ≥ 44×44，得到 ${Math.round(a.w)}×${Math.round(a.h)}`);
    });
    return bad;
}

test('F8.3 頁尾那句 GoatCounter 在代碼還是空的時候也要在（app/site.js 的 GOATCOUNTER_CODE）', { skip: pw ? false : why }, () => {
    assert.match(SITE_JS, /export\s+const\s+GOATCOUNTER_CODE\s*=\s*(['"])\1\s*;/, '防呆：這一條量的是「代碼還是空的」那一種（規格書 §16 與上線前清單：填代碼之前這句話就要在）');
    for (const lang of LANGS) {
        const html = readOut(`${lang}/index.html`);
        const footer = /<footer\b[^>]*data-section="footer"[\s\S]*?<\/footer>/.exec(html)?.[0] ?? '';
        assert.ok(footer, `${lang}：送出來的 HTML 裡沒有 <footer data-section="footer">`);
        const text = flat(decodeEntities(footer.replace(/<[^>]+>/g, ''))).replace(/\s/g, '');
        for (const id of ['foot.affiliation', 'foot.analytics']) assert.ok(text.includes(say(lang, id).replace(/\s/g, '')), `${lang}：頁尾送出來的 HTML 裡要有 ${id}「${say(lang, id)}」`);
    }
});

for (const lang of LANGS) {
    test(`F8.3 頁尾（${lang}，關掉 JS，390、1440）：兩句一定要有的話、回報問題寄到 ${REPORT_TO}、產品與幫助的連結、計數名字、社群照 content/links.md、語言切換、©`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { js: false });
            try {
                const foot = page.locator(F8_SECTIONS.footer);
                if ((await foot.count()) !== 1) { bad.push(`${width}：要剛好一個 <footer data-section="footer">，得到 ${await foot.count()}`); continue; }
                const after = await page.evaluate((sel) => { const f = document.querySelector(sel); const m = document.querySelector('main'); return Boolean(m && !m.contains(f) && (m.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING)); }, F8_SECTIONS.footer);
                if (!after) bad.push(`${width}：頁尾要在 <main> 外面、後面`);
                for (const id of ['foot.affiliation', 'foot.analytics', 'foot.copyright', 'foot.line']) {
                    const el = foot.locator(`[data-id="${id}"]`);
                    if (!(await el.count())) { bad.push(`${width}：頁尾找不到 data-id="${id}"`); continue; }
                    const got = flat(await el.first().textContent());
                    if (got !== flat(say(lang, id))) bad.push(`${width} ${id}：字要是「${say(lang, id)}」，得到「${got}」`);
                    if (!(await el.first().isVisible())) bad.push(`${width} ${id}：要看得到`);
                }
                // 頁尾那句講的是網站數人次、擴充本身沒有追蹤 —— 跟 08 不矛盾（08 講的是擴充）
                const analytics = say(lang, 'foot.analytics');
                // 2026-10-07 使用者決定不用 GoatCounter（瀏覽數看 Cloudflare 後台），頁尾拿掉「計算瀏覽人次」：不能再提 GoatCounter，要講到 cookie 與擴充本身
                if (/GoatCounter/.test(analytics) || !/cookie/i.test(analytics) || !{ zh: /擴充/, en: /extension/i, ja: /拡張機能/ }[lang].test(analytics)) bad.push(`foot.analytics 不提 GoatCounter、要講到 cookie 與擴充本身：「${analytics}」`);
                const links = await page.evaluate((sel) => Object.fromEntries([...document.querySelector(sel).querySelectorAll('a[data-id]')].map((a) => [a.dataset.id, { href: a.getAttribute('href'), gc: a.getAttribute('data-goatcounter-click'), text: a.textContent.replace(/\s+/g, ' ').trim() }])), F8_SECTIONS.footer);
                const want = {
                    'foot.store': { href: STORE_URL, gc: 'install-footer' }, 'foot.tutorial': { href: '#tutorial' }, 'foot.changelog': { href: '#changelog' },
                    'foot.privacy': { href: 'https://jerromy.com/privacy/' }, 'foot.faq': { href: '#faq' }, 'foot.blog': { href: 'https://jerromy.com', gc: 'blog-footer' },
                };
                for (const [id, w] of Object.entries(want)) {
                    const a = links[id];
                    if (!a) { bad.push(`${width}：頁尾要有 <a data-id="${id}">`); continue; }
                    if (a.href !== w.href && !(w.href === 'https://jerromy.com' && a.href === 'https://jerromy.com/')) bad.push(`${width} ${id}：要連到 ${w.href}，得到 ${a.href}`);
                    if (w.gc && a.gc !== w.gc) bad.push(`${width} ${id}：計數名字要是 ${w.gc}，得到 ${a.gc}`);
                    if (a.text !== flat(say(lang, id))) bad.push(`${width} ${id}：字要是「${say(lang, id)}」，得到「${a.text}」`);
                }
                const report = links['foot.report'];
                if (!report) bad.push(`${width}：頁尾要有 <a data-id="foot.report">（回報問題）`);
                else {
                    const m = /^mailto:([^?]*)\?(.*)$/.exec(report.href ?? '');
                    if (!m) bad.push(`${width} 回報問題：要是 mailto: 連結（帶標題與內文），得到 ${report.href}`);
                    else {
                        const to = decodeURIComponent(m[1]);
                        const q = new URLSearchParams(m[2].replace(/\+/g, '%2B'));
                        if (to !== REPORT_TO) bad.push(`${width} 回報問題：收件人要是 ${REPORT_TO}（跟擴充「遇到問題」同一個），得到 ${to}`);
                        if (q.get('subject') !== say(lang, 'mail.report.subject')) bad.push(`${width} 回報問題：標題要是「${say(lang, 'mail.report.subject')}」，得到「${q.get('subject')}」`);
                        const body = say(lang, 'mail.report.body').replace('%url%', `${SITE_URL}${lang}/`);
                        if (q.get('body') !== body) bad.push(`${width} 回報問題：內文要是「${body}」，得到「${q.get('body')}」`);
                    }
                    if (report.gc !== 'report') bad.push(`${width} 回報問題：計數名字要是 report，得到 ${report.gc}`);
                }
                bad.push(...socialProblems(await page.evaluate(SOCIALS, { sec: F8_SECTIONS.footer, label: say(lang, 'author.socials') }), lang, 'footer').map((b) => `${width} ${b}`));
                const langs = await page.evaluate(({ sel, label }) => {
                    const g = [...document.querySelector(sel).querySelectorAll('[role="group"]')].find((e) => e.getAttribute('aria-label') === label);
                    return g ? [...g.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), current: a.getAttribute('aria-current') })) : null;
                }, { sel: F8_SECTIONS.footer, label: say(lang, 'lang.label') });
                if (!langs || langs.length !== 3) bad.push(`${width}：頁尾要有語言切換（role="group"、aria-label「${say(lang, 'lang.label')}」、三個連結），得到 ${JSON.stringify(langs)}`);
                else {
                    for (const l of LANGS) if (!langs.some((a) => new RegExp(`(^|/)${l}/$`).test(a.href ?? ''))) bad.push(`${width}：語言切換少了 /${l}/`);
                    const cur = langs.filter((a) => a.current === 'page');
                    if (cur.length !== 1 || !new RegExp(`(^|/)${lang}/$`).test(cur[0].href)) bad.push(`${width}：語言切換的 aria-current="page" 要在 /${lang}/`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });

    test(`F8.3 作者與社群（${lang}，關掉 JS，390、1440）：照片的替代文字、名字、簡介、到部落格看更多、社群照 content/links.md`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { js: false });
            try {
                const sec = page.locator(F8_SECTIONS.author);
                if ((await sec.count()) !== 1) { bad.push(`${width}：找不到 14 作者與社群（${F8_SECTIONS.author}）`); continue; }
                if ((await sec.getAttribute('id')) !== 'author') bad.push(`${width}：14 要 id="author"`);
                const img = await sec.evaluate((s) => [...s.querySelectorAll('img')].map((i) => ({ alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height') })));
                if (img.length !== 1) bad.push(`${width}：14 要剛好一張照片，得到 ${img.length}`);
                else {
                    if (img[0].alt !== say(lang, 'author.photo.alt')) bad.push(`${width}：照片的替代文字要是「${say(lang, 'author.photo.alt')}」，得到「${img[0].alt}」`);
                    if (!img[0].w || !img[0].h) bad.push(`${width}：照片要寫 width 與 height（不跳版）`);
                }
                for (const id of ['author.eyebrow', 'author.name', 'author.bio.1', 'author.bio.2', 'author.blog']) {
                    const el = sec.locator(`[data-id="${id}"]`);
                    if (!(await el.count())) { bad.push(`${width}：14 找不到 data-id="${id}"`); continue; }
                    const got = flat(await el.first().textContent());
                    if (got !== flat(say(lang, id))) bad.push(`${width} ${id}：字要是「${say(lang, id)}」，得到「${got}」`);
                }
                const blog = await sec.evaluate((s) => { const a = s.querySelector('[data-id="author.blog"]'); const l = a && (a.closest('a') || a); return l ? { tag: l.tagName, href: l.getAttribute('href'), gc: l.getAttribute('data-goatcounter-click') } : null; });
                if (!blog || blog.tag !== 'A' || !/^https:\/\/jerromy\.com\/?$/.test(blog.href ?? '') || blog.gc !== 'blog-author') bad.push(`${width}：「到部落格看更多」要是連到 https://jerromy.com 的 <a>、計數名字 blog-author，得到 ${JSON.stringify(blog)}`);
                const h2 = await sec.evaluate((s) => [...s.querySelectorAll('h2')].map((h) => h.getAttribute('data-id') || h.querySelector('[data-id]')?.dataset.id));
                if (JSON.stringify(h2) !== '["author.name"]') bad.push(`${width}：14 的 <h2> 要剛好一個、是名字（author.name），得到 ${JSON.stringify(h2)}`);
                bad.push(...socialProblems(await page.evaluate(SOCIALS, { sec: F8_SECTIONS.author, label: say(lang, 'author.socials') }), lang, 'author').map((b) => `${width} ${b}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F8.4 支援裝置 ----------

const REQ_GEOMETRY = (sec) => {
    const root = document.querySelector(sec);
    if (!root) return null;
    const box = (id) => { const e = root.querySelector(`[data-id="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
    const rows = ['browser', 'ai', 'web', 'lang', 'price'].map((k) => ({ k, label: box(`req.${k}.label`), value: box(`req.${k}`) }));
    // 規格表外層：label 與 value 共同的最近祖先
    const l = root.querySelector('[data-id="req.browser.label"]');
    let table = l;
    while (table && table !== root && !table.querySelector('[data-id="req.price"]')) table = table.parentElement;
    return { rows, overflow: table ? table.scrollWidth - table.clientWidth : null, page: document.documentElement.scrollWidth - innerWidth };
};

for (const lang of LANGS) {
    test(`F8.4 支援裝置的規格表（${lang}，有滑鼠十二種寬度）：640 以下標題在上、內容在下；640 起兩欄；不橫捲`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                const g = await page.evaluate(REQ_GEOMETRY, F8_SECTIONS.devices);
                if (!g) { bad.push(`${width}：找不到 10 支援裝置（${F8_SECTIONS.devices}）`); continue; }
                const missing = g.rows.filter((r) => !r.label || !r.value).map((r) => r.k);
                if (missing.length) { bad.push(`${width}：規格表少了 ${missing.map((k) => `req.${k}.label／req.${k}`).join('、')}`); continue; }
                if (width < 640) {
                    for (const r of g.rows) {
                        if (r.value.t < r.label.b - 1) bad.push(`${width} ${r.k}：手機要標題在上、內容在下（標題下緣 ${Math.round(r.label.b)}、內容上緣 ${Math.round(r.value.t)}）`);
                        if (Math.abs(r.value.l - r.label.l) > 1) bad.push(`${width} ${r.k}：手機的標題與內容左緣要對齊（${Math.round(r.label.l)}／${Math.round(r.value.l)}）`);
                    }
                } else {
                    for (const r of g.rows) {
                        if (r.value.l < r.label.r) bad.push(`${width} ${r.k}：640 起內容要在標題右邊（標題右緣 ${Math.round(r.label.r)}、內容左緣 ${Math.round(r.value.l)}）`);
                        if (r.value.t >= r.label.b || r.label.t >= r.value.b) bad.push(`${width} ${r.k}：640 起標題與內容要在同一列`);
                    }
                    const lefts = g.rows.map((r) => r.value.l);
                    if (Math.max(...lefts) - Math.min(...lefts) > 1) bad.push(`${width}：640 起每一列的內容左緣要對齊（表格的一欄），得到 ${lefts.map(Math.round).join('、')}`);
                }
                if (g.overflow > 0) bad.push(`${width}：規格表自己橫捲 ${g.overflow}px`);
                if (g.page > 0) bad.push(`${width}：整頁橫捲 ${g.page}px`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

test('F8.4 支援裝置的內容（三語，關掉 JS）：四張卡（能用兩張、不行兩張）、規格表五列的字；不寫最低版本號、Linux、Chromebook、Edge、Brave', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const sec = page.locator(F8_SECTIONS.devices);
            if ((await sec.count()) !== 1) { bad.push(`${lang}：找不到 10 支援裝置`); continue; }
            if ((await sec.getAttribute('id')) !== 'devices') bad.push(`${lang}：10 要 id="devices"`);
            const cards = await sec.evaluate((s, ids) => ids.map((id) => { const t = s.querySelector(`[data-id="${id}"]`); const li = t?.closest('li'); return li ? li.textContent.replace(/\s+/g, ' ').trim() : null; }), ['devices.win', 'devices.mac', 'devices.mobile', 'devices.other']);
            cards.forEach((c, i) => {
                const yes = i < 2;
                if (c === null) { bad.push(`${lang} 第 ${i + 1} 張卡：要是一個 <li>，裡面有那張卡的標題`); return; }
                const mark = say(lang, yes ? 'devices.yes' : 'devices.no');
                if (!c.includes(mark)) bad.push(`${lang} 第 ${i + 1} 張卡：要講「${mark}」（讀屏念得到，可以只給讀屏）`);
            });
            for (const id of [...REQ.map((r) => `req.${r}.label`), ...REQ.map((r) => `req.${r}`), 'devices.title', 'devices.lead', 'devices.mobile.why', 'devices.other.why']) {
                const el = sec.locator(`[data-id="${id}"]`);
                if (!(await el.count())) { bad.push(`${lang}：找不到 data-id="${id}"`); continue; }
                const got = flat(await el.first().textContent());
                if (got !== flat(say(lang, id))) bad.push(`${lang} ${id}：字要是「${say(lang, id)}」，得到「${got}」`);
            }
            const all = flat(await sec.textContent());
            for (const word of ['Linux', 'Chromebook', 'Edge', 'Brave', '114']) if (all.includes(word)) bad.push(`${lang}：10 不寫「${word}」（沒測過的不列；版本號不是我們量的）`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F8.6 文案與通用 ----------

// 一次斷行有沒有把詞拆開：在整段字（去掉換行的空白）裡找每一個斷行的位置，Intl.Segmenter 的詞界上才算沒拆（標點、空白旁邊不算）
function splitWords(lines, lang) {
    const seg = new Intl.Segmenter(lang === 'zh' ? 'zh-Hant' : 'ja', { granularity: 'word' });
    const out = [];
    for (let i = 0; i < lines.length - 1; i += 1) {
        const a = lines[i];
        const b = lines[i + 1];
        const last = [...a].at(-1);
        const head = [...b][0];
        if (PUNCT.test(last) || PUNCT.test(head)) continue;
        const joined = a + b;
        const bounds = new Set([0]);
        for (const s of seg.segment(joined)) bounds.add(s.index + s.segment.length);
        if (!bounds.has(a.length)) out.push(`「${a.slice(-4)}｜${b.slice(0, 4)}」`);
    }
    return out;
}

const KEYS = Object.keys(LINES.lines.zh['1440']);

for (const lang of LANGS) {
    test(`F8.6 10～16 的文案（${lang}，有滑鼠十二種寬度，13 全打開）：每一行跟設計稿一樣；說明文字中日文每行 5～25 字寬、行首沒有孤標點、詞不拆開，英文沒有一個字一行`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                await page.evaluate((sec) => { for (const d of document.querySelectorAll(`${sec} details`)) d.open = true; }, F8_SECTIONS.faq);
                for (const key of KEYS) {
                    const { sel, nth } = f8Item(key);
                    const el = page.locator(`${F8_SECTIONS[sectionOf(key)]} ${sel}`).nth(nth);
                    if (!(await el.count())) { bad.push(`${width} ${key}：找不到`); continue; }
                    const got = await textLines(el);
                    // foot.analytics：2026-10-07 拿掉「用 GoatCounter 計算瀏覽人次」，設計稿還是舊句 —— 不逐行比，斷行規則照樣量（want 用網站自己的行）
                    const want = key === 'foot.analytics' ? got : LINES.lines[lang][String(width)][key];
                    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${width} ${key}：網站 ${JSON.stringify(got)}，設計稿 ${JSON.stringify(want)}`);
                    if (!PROSE.includes(key)) continue;
                    const pairs = new Set(want.slice(0, -1).map((l, i) => `${l}\n${want[i + 1]}`));
                    for (const [i, line] of got.entries()) {
                        if (lang === 'en') { if (!/\s/.test(line) && !want.includes(line)) bad.push(`${width} ${key}：一行只有一個字「${line}」`); continue; }
                        if ((wide(line) < 5 || wide(line) > 25) && !want.includes(line)) bad.push(`${width} ${key}：一行 ${wide(line)} 字寬（要 5～25，少於 5 字要併回上一行）「${line}」`);
                        if (HEAD_PUNCT.test(line) && !want.includes(line)) bad.push(`${width} ${key}：行首是孤標點「${line}」`);
                        if (i < got.length - 1 && !pairs.has(`${line}\n${got[i + 1]}`)) for (const s of splitWords([line, got[i + 1]], lang)) bad.push(`${width} ${key}：詞被拆開 ${s}`);
                    }
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F8.6 10～16 的版面跟設計稿一樣（${lang}，有滑鼠十二種寬度）：每一段字離那一區左上角的位置與大小差 ≤ 1px`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                const want = DES.boxes[lang][String(width)];
                for (const [name, section] of Object.entries(F8_SECTIONS)) {
                    // 13 收著的那幾題（2～7 的答案）不量位置：預設收著，看不到；它們的字在上一條全打開量
                    // foot.analytics 與它下面的 ©：2026-10-07 頁尾那句拿掉「計算瀏覽人次」、少一行，設計稿還是舊句 —— 不比位置（字與斷行在上一條量）
                    const keys = Object.keys(want).filter((k) => sectionOf(k) === name && !/^faq\.[2-7]\.a$/.test(k) && k !== 'foot.analytics' && k !== 'foot.copyright');
                    const got = await page.evaluate(BOXES, { section, items: keys.map(f8Item) });
                    if (!got) { bad.push(`${width}：找不到 ${section}`); continue; }
                    for (const k of keys) {
                        if (!got[k]) { bad.push(`${width} ${k}：找不到`); continue; }
                        const d = got[k].map((v, i) => Math.abs(v - want[k][i]));
                        if (d.some((v) => v > 1)) bad.push(`${width} ${k}：網站 [x ${got[k][0]}, y ${got[k][1]}, 寬 ${got[k][2]}, 高 ${got[k][3]}]，設計稿 [${want[k].join(', ')}]`);
                    }
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處跟設計稿差超過 1px`);
    });
}

// 框裡的字到框的內緣（EDGE_GAPS，左右與上下分開）：網站 ≥ 設計稿的內距（那一邊內距寫 0 的，用設計稿量到的距離）減 1。只量現在的內容畫得出來的那幾種；
// 「看更早的」與「這一條讀不到」在 f8-content.test.js 用寫壞的、內容多的那兩份量。
// 2026-10-07：「置頂」標籤（news.pinned）搬到 f8-content.test.js 的 content-many 量 —— 真的內容 9-29 那則取消置頂，現在沒有一則畫得出這個標籤。
const GAP_SITE = {
    devicesCard: `${F8_SECTIONS.devices} li:has([data-id="devices.win"], [data-id="devices.mac"], [data-id="devices.mobile"], [data-id="devices.other"])`,
    newsCard: `${F8_SECTIONS.news} li[data-entry]:not([data-state="unreadable"])`,
    tested: `${F8_SECTIONS.devices} [data-id="devices.tested"]`,
    latest: `${F8_SECTIONS.changelog} [data-id="changelog.latest"]`,
    blog: `${F8_SECTIONS.author} [data-id="author.blog"]`,
};

for (const lang of LANGS) {
    test(`F8.6 字到框邊（${lang}，有滑鼠十二種寬度）：10 的卡片、11 的公告卡、兩種標籤、到部落格看更多 —— 字到框的內緣 ≥ 設計稿`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                for (const [name, sel] of Object.entries(GAP_SITE)) {
                    const want = DES.gaps[lang][String(width)][name];
                    const got = await page.evaluate(EDGE_GAPS, sel);
                    if (!got) { bad.push(`${width} ${name}：找不到（${sel}）`); continue; }
                    const floor = edgeFloor(want);
                    if (got.gapX < floor.x) bad.push(`${width} ${name}：字到框的左右內緣最近 ${got.gapX}px，要 ≥ ${floor.x}（設計稿左右內距 ${want.padX}、字到框 ${want.gapX}）`);
                    if (got.gapY < floor.y) bad.push(`${width} ${name}：字到框的上下內緣最近 ${got.gapY}px，要 ≥ ${floor.y}（設計稿上下內距 ${want.padY}、字到框 ${want.gapY}）`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F8.6 通用（${lang}，十二種寬度、減少動態；平常與 13 全打開）：不橫捲、字不壓到別的東西、控件 ≥ 44×44、控件裡的字沒跑出框、沒有在跑的動畫`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                bad.push(...await sectionSweep(page, `${width}`));
                await page.evaluate((sec) => { for (const d of document.querySelectorAll(`${sec} details`)) d.open = true; }, F8_SECTIONS.faq);
                bad.push(...await sectionSweep(page, `${width} 13 全打開`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

test('F8.6 關掉 JS（三語 390、1440）：10～16 版型裡的每一段字都在、看得到（13 收著的答案點開才看得到）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { js: false });
            try {
                for (const key of KEYS) {
                    const { sel, nth } = f8Item(key);
                    const el = page.locator(`${F8_SECTIONS[sectionOf(key)]} ${sel}`).nth(nth);
                    if (!(await el.count())) { bad.push(`${lang} ${width}：${key} 不在`); continue; }
                    if (/^faq\.[2-7]\.a$/.test(key)) continue;
                    if (!(await el.isVisible())) bad.push(`${lang} ${width}：${key} 看不到`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F8.6 區塊順序與錨點（三語，關掉 JS）：… → tutorial → devices → news → changelog → faq → author → final，頁尾在 <main> 後面；導覽列的 #devices、#news、#changelog、#faq 連得到', { skip: pw ? false : why }, async () => {
    const want = ['tutorial', 'devices', 'news', 'changelog', 'faq', 'author', 'final', 'footer'];
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const order = await page.evaluate((ids) => [...document.querySelectorAll('[data-section]')].map((e) => e.dataset.section).filter((s) => ids.includes(s)), want);
            assert.deepEqual(order, want, `${lang}：區塊順序`);
            for (const [hash, sec] of [['#devices', 'devices'], ['#news', 'news'], ['#changelog', 'changelog'], ['#faq', 'faq'], ['#author', 'author']]) {
                const ok = await page.evaluate(({ hash, sec }) => document.querySelector(hash)?.dataset.section === sec, { hash, sec });
                assert.ok(ok, `${lang}：${hash} 要是 [data-section="${sec}"] 那一區`);
            }
            const nav = await page.evaluate(() => [...document.querySelectorAll('header a[href^="#"]')].map((a) => a.getAttribute('href')));
            for (const hash of ['#devices', '#news', '#changelog', '#faq']) assert.ok(nav.includes(hash), `${lang}：導覽列要有 ${hash}`);
        } finally {
            await context.close();
        }
    }
});

for (const lang of ['zh', 'ja']) {
    test(`F8.6 公告與更新紀錄（使用者寫的）最後一行不只一個字（${lang}，有滑鼠十二種寬度，現在的 content/）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                const n = await page.locator(`${F8_SECTIONS.news} [data-entry] h3, ${F8_SECTIONS.changelog} [data-text]`).count();
                if (!n) { bad.push(`${width}：11、12 裡找不到使用者寫的字（[data-entry] h3、[data-text]）`); continue; }
                bad.push(...await lastLineProblems(page, `${width}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}
