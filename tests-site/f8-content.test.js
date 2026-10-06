// F8.1 寫壞的內容與收合、F8.7 更新紀錄的類型標記、F8.6 內容比畫面多的時候 —— 11 公告、12 更新紀錄、14 與 16 的社群連結（使用者在 content/ 寫的東西）。
// 另外 build 兩份暫存複本（helpers.js 的 buildCopy，專案裡的 content/、out/ 不動）：
//   壞的：content/ 換成 tests/fixtures/content-check/bad-entry（後端的 fixture：公告第三則網址是 http、中文 1.0.4 第二條少了「- 」的空格、links.md 的 Blog 大寫，各語言都有 1.0.3）；
//   多的：content/ 換成 tests-site/fixtures/content-many（五則公告、第二則日期寫壞；五個好的版本加一個標題寫壞的、1.0.6 有一條寫壞、最後是 1.0.3；
//         類型詞有清單裡的、清單外的短詞、沒有前綴的整句、沒有冒號的；標題與條目故意寫長；社群多一個沒有圖示的 ghost、一行寫壞的）—— 內容比畫面多、按鈕最多的那一種。
// 現在的 content/（out/）也量 F8.7：中文第 32 行那種沒有類型前綴、卻有冒號的整句，三語各一。
// 照設計稿 5b74044 的 11、12 那兩段與狀態一覽（11 滿的時候、有一則寫壞、12 兩版以上、有一條寫壞、14 一條寫壞；14 那個虛線框的上下內距照 004264c）、strings/README.md「公告」「更新紀錄的類型標記」「這一條讀不到」「社群連結」；規格書 §5-11、§5-12、§7、§14。
//
// 介面（README.md「10～16（F8）」）：
//   11：每一則（好的、寫壞的）一個 <li data-entry>，照內容檔的順序；寫壞的那一則 <li data-entry data-state="unreadable">（虛線卡，字＝state.unreadable）。
//       好的一則：<time datetime>、類別、標題 <h3>、內文 [data-body]（使用者的換行照留）、有連結時 <a data-id="news.more" href＝那個網址 data-goatcounter-click="blog-news">、置頂的加 data-id="news.pinned"。
//       前三則在外面；第四則起收在 11 裡的一個 <details>，<summary data-id="news.older">，預設收著。
//   12：每一版一個 [data-version]（好的：值是版本號；標題寫壞的：值是空字串，裡面或它本身是 data-state="unreadable"）；版本號在 <h3>、日期 <time datetime>；
//       最上面那一個好的版本有 data-id="changelog.latest"（整區只有一個）；每一條一個 <li data-item>：類型標記 [data-kind]、內文 [data-text]；寫壞的那一條裡面或它本身是 data-state="unreadable"。
//       前兩版在外面；第三版起收在 12 裡的一個 <details>，<summary data-id="changelog.older">，預設收著。
//   14、16：社群一排 <ul aria-label＝author.socials>；寫壞的那一條只在 14 畫 data-state="unreadable"，16 與 ☰ 選單直接跳過。
//   類型詞清單：strings/README.md「更新紀錄的類型標記」那三行（測試從那裡讀，網站照同一份）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F8\\.[167]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, buildCopy, tail } from './helpers.js';
import { WIDTHS, EDGE_GAPS, edgeFloor, F8_SECTIONS, sectionSweep, lastLineProblems } from './page-helpers.js';
import { getPlainString, hasString } from '../app/strings.js';
import { readContent } from '../lib/content.js';

const say = (lang, id) => getPlainString(lang, id);
const flat = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const BAD_DIR = path.join(SITE, 'tests', 'fixtures', 'content-check', 'bad-entry');
const MANY_DIR = path.join(SITE, 'tests-site', 'fixtures', 'content-many');
const DES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-f8-1d18ae2.json'), 'utf8'));
const DATA = {
    real: await readContent(path.join(SITE, 'content')),
    bad: await readContent(BAD_DIR),
    many: await readContent(MANY_DIR),
};

// 類型詞清單：strings/README.md「### 更新紀錄的類型標記」那一節的「- 中文：…」「- 英文：…」「- 日文：…」
function kindWords() {
    const md = fs.readFileSync(path.join(SITE, 'strings', 'README.md'), 'utf8');
    const part = md.split('### 更新紀錄的類型標記')[1]?.split('\n### ')[0] ?? '';
    const words = {};
    for (const [lang, label] of [['zh', '中文'], ['en', '英文'], ['ja', '日文']]) {
        const line = new RegExp(`^\\s*-\\s*${label}：(.+)$`, 'm').exec(part);
        words[lang] = line ? line[1].split(/[、,]\s*/).map((w) => w.trim()).filter(Boolean) : [];
    }
    return words;
}
const KINDS = kindWords();
const known = (lang, kind) => (lang === 'en' ? KINDS.en.some((w) => w.toLowerCase() === kind.toLowerCase()) : KINDS[lang].includes(kind));

const { pw, why } = playwright();
const builds = {};
function out(name) {
    builds[name] ??= buildCopy({ label: `f8-${name}`, content: name === 'bad' ? BAD_DIR : MANY_DIR });
    assert.equal(builds[name].status, 0, `content/ 換成 ${name === 'bad' ? 'bad-entry' : 'content-many'} 之後 build 失敗（寫壞的內容不能讓整站產生失敗）：\n${tail(builds[name].output)}`);
    return builds[name].out;
}
const sessions = pw ? { real: browserSession(pw), bad: browserSession(pw, () => out('bad')), many: browserSession(pw, () => out('many')) } : {};
after(async () => {
    for (const s of Object.values(sessions)) await s.close();
    for (const b of Object.values(builds)) b.cleanup();
});

async function open(which, lang, width, { touch = false, js = true, reduced = true } = {}) {
    const { site, browser } = await sessions[which].get();
    const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 900 }, ...(touch ? { isMobile: true, hasTouch: true } : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, errors };
}

// 11 每一則：在不在收合裡、看不看得到、寫壞沒、標題、內文（innerText 保留使用者的換行）、連結、置頂
const NEWS = (sec) => {
    const root = document.querySelector(sec);
    if (!root) return null;
    const older = root.querySelector('details:has([data-id="news.older"])');
    return {
        older: older ? { open: older.open, summary: Boolean(older.querySelector(':scope > summary[data-id="news.older"], :scope > summary [data-id="news.older"]')), text: older.querySelector('summary')?.textContent.replace(/\s+/g, ' ').trim() } : null,
        entries: [...root.querySelectorAll('li[data-entry]')].map((li) => {
            const more = li.querySelector('a[data-id="news.more"]');
            return {
                folded: Boolean(older && older.contains(li)), shown: li.checkVisibility(), bad: li.getAttribute('data-state') === 'unreadable',
                badText: li.getAttribute('data-state') === 'unreadable' ? li.textContent.replace(/\s+/g, ' ').trim() : null,
                title: li.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim() ?? null, body: li.querySelector('[data-body]')?.innerText ?? null,
                date: li.querySelector('time')?.getAttribute('datetime') ?? null, pinned: Boolean(li.querySelector('[data-id="news.pinned"]')),
                more: more ? { href: more.getAttribute('href'), gc: more.getAttribute('data-goatcounter-click'), text: more.textContent.replace(/\s+/g, ' ').trim() } : null,
            };
        }),
        unreadable: root.querySelectorAll('[data-state="unreadable"]').length,
    };
};

// 12 每一版：版本號、在不在收合裡、最新、每一條（寫壞沒、類型標記、內文）
const LOG = (sec) => {
    const root = document.querySelector(sec);
    if (!root) return null;
    const older = root.querySelector('details:has([data-id="changelog.older"])');
    const isBad = (e) => e.matches('[data-state="unreadable"]') || Boolean(e.querySelector('[data-state="unreadable"]'));
    return {
        older: older ? { open: older.open, text: older.querySelector('summary')?.textContent.replace(/\s+/g, ' ').trim() } : null,
        latest: [...root.querySelectorAll('[data-id="changelog.latest"]')].map((e) => ({ in: e.closest('[data-version]')?.getAttribute('data-version') ?? null, text: e.textContent.trim() })),
        text: root.textContent,
        versions: [...root.querySelectorAll('[data-version]')].map((v) => ({
            v: v.getAttribute('data-version'), folded: Boolean(older && older.contains(v)), shown: v.checkVisibility(), bad: v.getAttribute('data-version') === '' && isBad(v),
            h3: v.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim() ?? null, date: v.querySelector('time')?.getAttribute('datetime') ?? null,
            items: [...v.querySelectorAll('li[data-item]')].map((li) => {
                const k = li.querySelector('[data-kind]');
                return { bad: isBad(li), kind: k && k.textContent.trim() ? k.textContent.trim() : null, kindColor: k ? getComputedStyle(k).color : null, text: li.querySelector('[data-text]')?.textContent.replace(/\s+/g, ' ').trim() ?? null };
            }),
        })),
    };
};

// 頁面上螢光綠小標的顏色（設計系統的 --color-accent-lime-text）：放一個暫時的元素量
const LIME = () => { const s = document.createElement('span'); s.style.color = 'var(--color-accent-lime-text)'; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; };

// 頁面上的社群一排（14 或 16）
const SOCIAL_ROW = ({ sec, label }) => {
    const root = document.querySelector(sec);
    const ul = root && [...root.querySelectorAll('ul')].find((u) => u.getAttribute('aria-label') === label);
    return ul ? { hrefs: [...ul.querySelectorAll('a')].map((a) => a.getAttribute('href')), names: [...ul.querySelectorAll('a')].map((a) => (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent).trim()), unreadable: [...ul.querySelectorAll('[data-state="unreadable"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) } : null;
};

// ---------- F8.1 寫壞的內容（bad-entry） ----------

for (const lang of LANGS) {
    test(`F8.1 寫壞的內容（${lang}，content/ 換成 bad-entry，關掉 JS 1440）：寫壞的那一則、那一條、那個連結各畫「這一條讀不到」，其他照常；頁尾與選單跳過寫壞的連結`, { skip: pw ? false : why }, async () => {
        const data = DATA.bad;
        const bad = [];
        const { page, context } = await open('bad', lang, 1440, { js: false });
        try {
            const unread = say(lang, 'state.unreadable');
            // 11
            const news = await page.evaluate(NEWS, F8_SECTIONS.news);
            if (!news) bad.push('找不到 11 公告');
            else {
                const want = data.news[lang].entries;
                if (news.entries.length !== want.length) bad.push(`11：要 ${want.length} 則（寫壞的照樣佔它的位置），得到 ${news.entries.length}`);
                want.forEach((e, i) => {
                    const got = news.entries[i];
                    if (!got) return;
                    if (!e.ok) {
                        if (!got.bad) bad.push(`11 第 ${i + 1} 則（寫壞的）：要是 <li data-entry data-state="unreadable">`);
                        else if (got.badText !== flat(unread)) bad.push(`11 第 ${i + 1} 則：寫壞的那一張要寫「${unread}」，得到「${got.badText}」（不寫原因）`);
                        return;
                    }
                    if (got.bad) bad.push(`11 第 ${i + 1} 則是好的，不能畫成讀不到`);
                    if (got.title !== flat(e.title)) bad.push(`11 第 ${i + 1} 則：標題要是「${e.title}」，得到「${got.title}」`);
                    if (got.date !== e.date) bad.push(`11 第 ${i + 1} 則：<time datetime> 要是 ${e.date}，得到 ${got.date}`);
                    if (e.link && got.more?.href !== e.link) bad.push(`11 第 ${i + 1} 則：「${say(lang, 'news.more')}」要連到 ${e.link}，得到 ${got.more?.href}`);
                    if (e.link && got.more?.gc !== 'blog-news') bad.push(`11 第 ${i + 1} 則：「看全文」的計數名字要是 blog-news，得到 ${got.more?.gc}`);
                    if (!e.link && got.more) bad.push(`11 第 ${i + 1} 則：沒有連結就不放「看全文」`);
                    if (got.pinned !== Boolean(e.pinned)) bad.push(`11 第 ${i + 1} 則：置頂的標籤要${e.pinned ? '有' : '沒有'}`);
                });
                const wantBad = want.filter((e) => !e.ok).length;
                if (news.unreadable !== wantBad) bad.push(`11：要剛好 ${wantBad} 個 data-state="unreadable"，得到 ${news.unreadable}`);
            }
            // 12（1.0.3 不列，另一條量）
            const log = await page.evaluate(LOG, F8_SECTIONS.changelog);
            if (!log) bad.push('找不到 12 更新紀錄');
            else {
                for (const v of data.changelog[lang].entries.filter((x) => x.ok && x.version !== '1.0.3')) {
                    const got = log.versions.find((x) => x.v === v.version);
                    if (!got) { bad.push(`12：找不到 [data-version="${v.version}"]`); continue; }
                    if (got.h3 !== v.version) bad.push(`12 ${v.version}：<h3> 要是版本號，得到「${got.h3}」`);
                    if (got.date !== v.date) bad.push(`12 ${v.version}：<time datetime> 要是 ${v.date}，得到 ${got.date}`);
                    if (got.items.length !== v.items.length) { bad.push(`12 ${v.version}：要 ${v.items.length} 條（寫壞的照樣佔它的位置），得到 ${got.items.length}`); continue; }
                    v.items.forEach((it, i) => {
                        if (!it.ok && !got.items[i].bad) bad.push(`12 ${v.version} 第 ${i + 1} 條（寫壞的）：要畫「${unread}」（data-state="unreadable"）`);
                        if (it.ok && got.items[i].bad) bad.push(`12 ${v.version} 第 ${i + 1} 條是好的，不能畫成讀不到`);
                    });
                }
                const items = data.changelog[lang].entries.filter((x) => x.ok && x.version !== '1.0.3').flatMap((x) => x.items).filter((x) => !x.ok).length;
                const flagged = log.versions.flatMap((v) => v.items).filter((x) => x.bad).length;
                if (flagged !== items) bad.push(`12：寫壞的條目要剛好 ${items} 個畫成讀不到，得到 ${flagged}`);
            }
            // 14、16、選單：寫壞的連結只在 14 講
            const good = data.links.entries.filter((e) => e.ok);
            const label = say(lang, 'author.socials');
            const author = await page.evaluate(SOCIAL_ROW, { sec: F8_SECTIONS.author, label });
            const footer = await page.evaluate(SOCIAL_ROW, { sec: F8_SECTIONS.footer, label });
            const badLinks = data.links.entries.filter((e) => !e.ok).length;
            if (!author) bad.push('找不到 14 的社群一排');
            else {
                if (author.unreadable.length !== badLinks) bad.push(`14：寫壞的連結要畫 ${badLinks} 個「${unread}」，得到 ${author.unreadable.length}`);
                if (JSON.stringify(author.hrefs) !== JSON.stringify(good.map((e) => e.url))) bad.push(`14：好的連結照 links.md 的順序，得到 ${JSON.stringify(author.hrefs)}`);
            }
            if (!footer) bad.push('找不到 16 的社群一排');
            else {
                if (footer.unreadable.length) bad.push(`16：寫壞的連結直接跳過，不畫「${unread}」（得到 ${footer.unreadable.length} 個）`);
                if (JSON.stringify(footer.hrefs) !== JSON.stringify(good.map((e) => e.url))) bad.push(`16：好的連結照 links.md 的順序，得到 ${JSON.stringify(footer.hrefs)}`);
            }
            const menu = await page.evaluate(() => { const id = document.querySelector('header button[aria-controls]')?.getAttribute('aria-controls'); const m = id && document.getElementById(id); return m ? m.querySelectorAll('[data-state="unreadable"]').length : null; });
            if (menu) bad.push(`☰ 選單：寫壞的連結直接跳過，得到 ${menu} 個「讀不到」`);
        } finally {
            await context.close();
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// 【待派工人員確認】規格書 §5-12 寫「從 1.0.3 開始列」，設計稿 5b74044 與派工的測試案例寫「從 1.0.4 開始，不列 1.0.3」（使用者 2026-10-02 決定）。
// 現在的 content/ 沒有 1.0.3；bad-entry 與 content-many 有。這一條照派工的案例：內容檔裡就算有 1.0.3，網站也不列。
for (const which of ['bad', 'many']) {
    test(`F8.1 更新紀錄從 1.0.4 開始、不列 1.0.3（三語，content/ 換成 ${which === 'bad' ? 'bad-entry' : 'content-many'}，內容檔裡有 1.0.3）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const lang of LANGS) {
            assert.ok(DATA[which].changelog[lang].entries.some((v) => v.ok && v.version === '1.0.3'), `防呆：${which} 的 changelog.${lang}.md 要有 1.0.3`);
            const { page, context } = await open(which, lang, 1440, { js: false });
            try {
                const log = await page.evaluate(LOG, F8_SECTIONS.changelog);
                if (!log) { bad.push(`${lang}：找不到 12`); continue; }
                if (!log.versions.some((v) => v.v === '1.0.4')) bad.push(`${lang}：1.0.4 要列（防呆）`);
                if (log.versions.some((v) => v.v === '1.0.3') || log.text.includes('1.0.3')) bad.push(`${lang}：不列 1.0.3（收合裡也不放）`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// ---------- F8.1 收合（content-many：五則公告、六版） ----------

for (const lang of LANGS) {
    test(`F8.1 公告最近三則、更早的收在「看更早的公告」（${lang}，content-many；有滑鼠 1440、只有手指 390）：預設收著，鍵盤 Enter 打開、看得到第四、五則，再按收起；「看全文」、置頂、使用者的換行`, { skip: pw ? false : why }, async () => {
        const want = DATA.many.news[lang].entries;
        assert.equal(want.length, 5, '防呆：content-many 要五則公告');
        const bad = [];
        for (const [width, touch] of [[1440, false], [390, true]]) {
            const { page, context, errors } = await open('many', lang, width, { touch });
            try {
                const n = await page.evaluate(NEWS, F8_SECTIONS.news);
                if (!n) { bad.push(`${width}：找不到 11`); continue; }
                if (n.entries.length !== 5) { bad.push(`${width}：要 5 則 <li data-entry>（寫壞的照樣佔位置），得到 ${n.entries.length}`); continue; }
                const folded = n.entries.map((e) => e.folded);
                if (JSON.stringify(folded) !== '[false,false,false,true,true]') bad.push(`${width}：前三則在外面、第四則起收在「${say(lang, 'news.older')}」裡，得到 ${folded.map((f) => (f ? '收' : '外')).join('')}`);
                if (!n.older) { bad.push(`${width}：11 裡要有一個 <details>，<summary data-id="news.older">`); continue; }
                if (n.older.text !== flat(say(lang, 'news.older'))) bad.push(`${width}：收合的按鈕字要是「${say(lang, 'news.older')}」，得到「${n.older.text}」`);
                if (n.older.open) bad.push(`${width}：「${say(lang, 'news.older')}」預設要收著`);
                if (n.entries[3].shown || n.entries[4].shown) bad.push(`${width}：收著時第四、五則不能看得到`);
                if (!n.entries[1].bad) bad.push(`${width}：第二則（日期寫壞）要畫成讀不到，照樣佔第二個位置`);
                // 「看全文」與置頂
                want.forEach((e, i) => {
                    if (!e.ok) return;
                    const got = n.entries[i];
                    if (e.link && (got.more?.href !== e.link || got.more?.gc !== 'blog-news' || got.more?.text !== flat(say(lang, 'news.more')))) bad.push(`${width} 第 ${i + 1} 則：「${say(lang, 'news.more')}」要連到 ${e.link}、計數名字 blog-news，得到 ${JSON.stringify(got.more)}`);
                    if (!e.link && got.more) bad.push(`${width} 第 ${i + 1} 則：沒有連結就不放「看全文」`);
                    if (got.pinned !== Boolean(e.pinned)) bad.push(`${width} 第 ${i + 1} 則：置頂的標籤要${e.pinned ? '有' : '沒有'}`);
                });
                // 使用者的換行照留（第一則內文三行、中間空一行）
                const body = n.entries[0].body ?? '';
                const lines = want[0].body.split('\n').filter(Boolean);
                const shownLines = body.split('\n').map((l) => l.trim()).filter(Boolean);
                if (!lines.every((l) => shownLines.some((s) => s.replace(/\s/g, '') === l.replace(/\s/g, '')))) bad.push(`${width} 第 1 則：內文要照使用者的換行一行一行顯示（[data-body] 的 innerText），得到 ${JSON.stringify(body)}`);
                // 鍵盤：焦點放到「看更早的公告」，Enter 打開、Enter 收起
                const summary = page.locator(`${F8_SECTIONS.news} details:has([data-id="news.older"]) > summary`);
                await summary.evaluate((s) => { const r = s.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - innerHeight / 2, behavior: 'instant' }); });
                await summary.focus();
                await page.keyboard.press('Enter');
                await page.waitForTimeout(80);
                let m = await page.evaluate(NEWS, F8_SECTIONS.news);
                if (!m.older.open || !m.entries[3].shown || !m.entries[4].shown) bad.push(`${width}：在「${say(lang, 'news.older')}」上按 Enter 要打開，看得到第四、五則（得到 open ${m.older.open}）`);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(80);
                m = await page.evaluate(NEWS, F8_SECTIONS.news);
                if (m.older.open || m.entries[3].shown) bad.push(`${width}：再按 Enter 要收起`);
                if (errors.length) bad.push(`${width}：頁面錯誤 ${errors.slice(0, 2).join('、')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });

    test(`F8.1 更新紀錄最新兩版、更早的收在「看更早的版本」（${lang}，content-many；有滑鼠 1440、只有手指 390）：最上面那版標「最新」、寫壞的那一版與那一條各畫讀不到；鍵盤打開`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [width, touch] of [[1440, false], [390, true]]) {
            const { page, context } = await open('many', lang, width, { touch });
            try {
                const log = await page.evaluate(LOG, F8_SECTIONS.changelog);
                if (!log) { bad.push(`${width}：找不到 12`); continue; }
                const order = log.versions.map((v) => v.v);
                const top = order.slice(0, 2);
                if (JSON.stringify(top) !== '["1.0.7","1.0.6"]') bad.push(`${width}：最前面兩版要是 1.0.7、1.0.6（內容檔的順序），得到 ${JSON.stringify(order)}`);
                const outside = log.versions.filter((v) => !v.folded).map((v) => v.v);
                if (JSON.stringify(outside) !== '["1.0.7","1.0.6"]') bad.push(`${width}：只有最新兩版攤開，其他收在「${say(lang, 'changelog.older')}」裡，攤開的是 ${JSON.stringify(outside)}`);
                for (const v of ['', '1.0.5', '1.0.4']) {
                    const got = log.versions.find((x) => x.v === v);
                    if (!got) bad.push(`${width}：找不到 [data-version="${v}"]${v === '' ? '（標題寫壞的那一版）' : ''}`);
                    else if (!got.folded) bad.push(`${width}：${v || '寫壞的那一版'} 要收在「${say(lang, 'changelog.older')}」裡`);
                }
                const broken = log.versions.find((x) => x.v === '');
                if (broken && !broken.bad) bad.push(`${width}：標題寫壞的那一版要畫一個讀不到（data-state="unreadable"）`);
                if (!log.older) bad.push(`${width}：12 裡要有一個 <details>，<summary data-id="changelog.older">`);
                else {
                    if (log.older.text !== flat(say(lang, 'changelog.older'))) bad.push(`${width}：收合的按鈕字要是「${say(lang, 'changelog.older')}」，得到「${log.older.text}」`);
                    if (log.older.open) bad.push(`${width}：「${say(lang, 'changelog.older')}」預設要收著`);
                }
                if (log.latest.length !== 1 || log.latest[0].in !== '1.0.7' || log.latest[0].text !== say(lang, 'changelog.latest')) bad.push(`${width}：「${say(lang, 'changelog.latest')}」只標在最上面那一個好的版本（1.0.7），得到 ${JSON.stringify(log.latest)}`);
                const v106 = log.versions.find((x) => x.v === '1.0.6');
                if (v106 && JSON.stringify(v106.items.map((i) => i.bad)) !== '[false,true,false]') bad.push(`${width}：1.0.6 的第二條寫壞了，要畫讀不到、其他兩條照常，得到 ${JSON.stringify(v106.items.map((i) => (i.bad ? '壞' : '好')))}`);
                if (log.older) {
                    const summary = page.locator(`${F8_SECTIONS.changelog} details:has([data-id="changelog.older"]) > summary`);
                    await summary.evaluate((s) => { const r = s.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - innerHeight / 2, behavior: 'instant' }); });
                    await summary.focus();
                    await page.keyboard.press(' ');
                    await page.waitForTimeout(80);
                    const m = await page.evaluate(LOG, F8_SECTIONS.changelog);
                    const hidden = m.versions.filter((v) => !v.shown).map((v) => v.v || '寫壞的那一版');
                    if (!m.older.open || hidden.length) bad.push(`${width}：在「${say(lang, 'changelog.older')}」上按空白鍵要打開，每一版都看得到（看不到：${hidden.join('、')}）`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });

    test(`F8.1 收合在關掉 JS 時也打得開（${lang}，content-many，390）：點「看更早的公告」「看更早的版本」`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const { page, context } = await open('many', lang, 390, { js: false });
        try {
            for (const [sec, id] of [[F8_SECTIONS.news, 'news.older'], [F8_SECTIONS.changelog, 'changelog.older']]) {
                const summary = page.locator(`${sec} details:has([data-id="${id}"]) > summary`);
                if (!(await summary.count())) { bad.push(`找不到 ${id} 的 <summary>`); continue; }
                await summary.click();
                const open = await summary.evaluate((s) => s.parentElement.open);
                if (!open) bad.push(`關掉 JS 點「${say(lang, id)}」要打得開`);
            }
            const n = await page.evaluate(NEWS, F8_SECTIONS.news);
            if (n && !(n.entries[3]?.shown && n.entries[4]?.shown)) bad.push('打開之後第四、五則公告要看得到');
        } finally {
            await context.close();
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });

    test(`F8.1 社群：沒有圖示的代號與寫壞的那一行（${lang}，content-many，關掉 JS 1440）：14 與 16 都放 ghost（名字用代號）；寫壞的只在 14 講讀不到`, { skip: pw ? false : why }, async () => {
        const good = DATA.many.links.entries.filter((e) => e.ok);
        const { page, context } = await open('many', lang, 1440, { js: false });
        try {
            const label = say(lang, 'author.socials');
            const bad = [];
            for (const [place, sec] of [['14', F8_SECTIONS.author], ['16', F8_SECTIONS.footer]]) {
                const row = await page.evaluate(SOCIAL_ROW, { sec, label });
                if (!row) { bad.push(`${place}：找不到社群一排`); continue; }
                if (JSON.stringify(row.hrefs) !== JSON.stringify(good.map((e) => e.url))) bad.push(`${place}：連結要照 links.md 寫對的那幾行（含沒有圖示的 ghost），得到 ${JSON.stringify(row.hrefs)}`);
                const ghost = row.names[good.findIndex((e) => e.code === 'ghost')];
                if (ghost !== (hasString(lang, 'social.ghost') ? say(lang, 'social.ghost') : 'ghost')) bad.push(`${place}：ghost 字串表沒有名字，名字要用代號，得到「${ghost}」`);
                const wantBad = place === '14' ? [flat(say(lang, 'state.unreadable'))] : [];
                if (JSON.stringify(row.unreadable) !== JSON.stringify(wantBad)) bad.push(`${place}：寫壞的那一行 ${place === '14' ? '要畫一個讀不到' : '直接跳過'}，得到 ${JSON.stringify(row.unreadable)}`);
            }
            assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

// ---------- F8.7 更新紀錄的類型標記 ----------

test('F8.7 類型詞清單（strings/README.md「更新紀錄的類型標記」）三語都在、每個詞都短（6 個全形字／12 個字元以內）', () => {
    for (const lang of LANGS) {
        assert.ok(KINDS[lang].length >= 3, `${lang}：讀不到類型詞清單（strings/README.md 那一節的「- 中文／英文／日文：…」），得到 ${JSON.stringify(KINDS[lang])}`);
        for (const w of KINDS[lang]) assert.ok([...w].length <= (lang === 'en' ? 12 : 6), `${lang}：「${w}」太長，類型詞要短`);
    }
    // 防呆：三份內容裡「有前綴的」與「沒有前綴的整句」兩種都有
    for (const lang of LANGS) {
        const items = DATA.real.changelog[lang].entries.filter((v) => v.ok).flatMap((v) => v.items).filter((i) => i.ok);
        assert.ok(items.some((i) => known(lang, i.kind)), `防呆：現在的 changelog.${lang}.md 要有一條已知類型的`);
        assert.ok(items.some((i) => i.kind && !known(lang, i.kind) && [...i.kind].length > (lang === 'en' ? 12 : 6)), `防呆：現在的 changelog.${lang}.md 要有一條「沒有前綴、卻有冒號」的整句（後端把冒號前整句當 kind）`);
    }
});

for (const which of ['real', 'bad', 'many']) {
    for (const lang of LANGS) {
        test(`F8.7 類型標記（${lang}，${which === 'real' ? '現在的 content/' : which === 'bad' ? 'bad-entry' : 'content-many'}，關掉 JS 1440）：只有清單裡的短詞畫成螢光綠的類型標記；沒有前綴的整句不當類型、整句（原句）當內文；跟 lib/changelog.js 讀到的逐條一致`, { skip: pw ? false : why }, async () => {
            const bad = [];
            const { page, context } = await open(which, lang, 1440, { js: false });
            try {
                const log = await page.evaluate(LOG, F8_SECTIONS.changelog);
                const lime = await page.evaluate(LIME);
                if (!log) bad.push('找不到 12');
                for (const v of log ? DATA[which].changelog[lang].entries.filter((x) => x.ok && x.version !== '1.0.3') : []) {
                    const got = log.versions.find((x) => x.v === v.version);
                    if (!got) { bad.push(`找不到 [data-version="${v.version}"]`); continue; }
                    v.items.forEach((it, i) => {
                        const g = got.items[i];
                        if (!it.ok || !g) return;
                        const where = `${v.version} 第 ${i + 1} 條「${it.raw.slice(0, 18)}…」`;
                        if (it.kind && known(lang, it.kind)) {
                            if (g.kind !== it.kind) bad.push(`${where}：「${it.kind}」在清單裡，要畫成類型標記（照內容檔寫的字），得到 ${JSON.stringify(g.kind)}`);
                            else if (g.kindColor !== lime) bad.push(`${where}：類型標記要是螢光綠（--color-accent-lime-text ${lime}），得到 ${g.kindColor}`);
                            if (g.text !== flat(it.text)) bad.push(`${where}：內文要是冒號後面那段「${it.text}」，得到「${g.text}」`);
                        } else {
                            if (g.kind) bad.push(`${where}：${it.kind ? `「${it.kind}」不在類型詞清單裡` : '沒有冒號'}，不能畫成類型標記（得到「${g.kind}」）`);
                            if (g.text !== flat(it.raw)) bad.push(`${where}：整句（原句，冒號照使用者寫的）當內文「${it.raw}」，得到「${g.text}」`);
                        }
                    });
                }
            } finally {
                await context.close();
            }
            assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
        });
    }
}

// ---------- F8.6 內容比畫面多（content-many）、寫壞的（bad-entry） ----------

for (const lang of LANGS) {
    test(`F8.6 內容比畫面多（${lang}，content-many，十二種寬度、減少動態，兩個收合與 13 全打開）：不橫捲、字不壓到別的東西、控件 ≥ 44×44、控件裡的字沒跑出框；中日文使用者的字最後一行不只一個字`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open('many', lang, width);
            try {
                bad.push(...await sectionSweep(page, `${width}`));
                await page.evaluate((secs) => { for (const s of secs) for (const d of document.querySelectorAll(`${s} details`)) d.open = true; }, [F8_SECTIONS.news, F8_SECTIONS.changelog, F8_SECTIONS.faq]);
                bad.push(...await sectionSweep(page, `${width} 全打開`));
                if (lang !== 'en') bad.push(...await lastLineProblems(page, `${width}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

// 「看更早的」與四種「這一條讀不到」的虛線框：字到框的內緣 ≥ 設計稿（狀態一覽裡畫的那幾個）的內距減 1（左右、上下分開；那一邊內距寫 0 的用量到的距離）
const GAP_CONTENT = {
    older: `:is(${F8_SECTIONS.news}, ${F8_SECTIONS.changelog}) details > summary:is([data-id$=".older"], :has([data-id$=".older"]))`,
    badCard: `${F8_SECTIONS.news} li[data-entry][data-state="unreadable"]`,
    badInline: `${F8_SECTIONS.changelog} li[data-item] [data-state="unreadable"], ${F8_SECTIONS.changelog} li[data-item][data-state="unreadable"]`,
    badSection: `${F8_SECTIONS.changelog} [data-version=""] [data-state="unreadable"], ${F8_SECTIONS.changelog} [data-version=""][data-state="unreadable"]`,
    badSocial: `${F8_SECTIONS.author} ul [data-state="unreadable"]`,
};

for (const lang of LANGS) {
    test(`F8.6 字到框邊（${lang}，content-many，有滑鼠十二種寬度，收合全打開）：「看更早的」按鈕、四種「這一條讀不到」的虛線框 —— 字到框的內緣 ≥ 設計稿`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const socialLines = new Set();
        for (const width of WIDTHS) {
            const { page, context } = await open('many', lang, width);
            try {
                await page.evaluate((secs) => { for (const s of secs) for (const d of document.querySelectorAll(`${s} details`)) d.open = true; }, [F8_SECTIONS.news, F8_SECTIONS.changelog]);
                for (const [name, sel] of Object.entries(GAP_CONTENT)) {
                    const want = DES.gaps[lang][String(width)][name];
                    const got = await page.evaluate(EDGE_GAPS, sel);
                    if (!got) { bad.push(`${width} ${name}：找不到（${sel}）`); continue; }
                    const floor = edgeFloor(want);
                    if (got.gapX < floor.x) bad.push(`${width} ${name}：字到框的左右內緣最近 ${got.gapX}px，要 ≥ ${floor.x}（設計稿左右內距 ${want.padX}、字到框 ${want.gapX}）`);
                    if (got.gapY < floor.y) bad.push(`${width} ${name}：字到框的上下內緣最近 ${got.gapY}px，要 ≥ ${floor.y}（設計稿上下內距 ${want.padY}、字到框 ${want.gapY}）`);
                    // 14 社群的虛線框（設計稿 004264c）：排一行 44 高、排兩行跟著長高 —— 上下內距（10.5）與框高都跟設計稿差 ≤ 1px。
                    // 框高跟「設計稿排同樣行數時」比：設計稿畫在狀態一覽裡，比網站的 14 窄（280 寬 216 對 248、320 寬 256 對 260），
                    // 同一個寬度兩邊排的行數不一定一樣（英文 280、日文 320 設計稿排兩行，網站放得下一行）。
                    if (name === 'badSocial') {
                        if (Math.abs(got.padY - want.padY) > 1) bad.push(`${width} ${name}：上下內距 ${got.padY}px，設計稿 ${want.padY}（差要 ≤ 1）`);
                        const same = Object.values(DES.gaps[lang]).map((g) => g[name]).find((g) => g.lines === got.lines);
                        if (!same) bad.push(`${width} ${name}：排成 ${got.lines} 行，設計稿沒有排成 ${got.lines} 行的時候可以比框高`);
                        else if (Math.abs(got.height - same.height) > 1) bad.push(`${width} ${name}：排 ${got.lines} 行時框高 ${got.height}px，設計稿排 ${got.lines} 行是 ${same.height}（差要 ≤ 1）`);
                        socialLines.add(got.lines);
                    }
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
        // 防呆：日文 280 網站的 14 也排兩行 —— 兩行時的框高才真的比到（設計稿 004264c 改的就是那一種）
        if (lang === 'ja') assert.ok(socialLines.has(2), `防呆：日文十二種寬度裡 14 的「讀不到」虛線框沒有一次排兩行（量到 ${[...socialLines].join('、')} 行），兩行的框高沒比到`);
    });
}

for (const lang of LANGS) {
    test(`F8.6 寫壞的內容（${lang}，bad-entry，十二種寬度、減少動態）：不橫捲、字不壓到別的東西、控件 ≥ 44×44、控件裡的字沒跑出框`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open('bad', lang, width);
            try {
                bad.push(...await sectionSweep(page, `${width}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}
