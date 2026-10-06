// F3.4 公告條挑哪一則（在瀏覽器裡）、F3.5 公告標題、F3.7 社群圖示一排（導覽列的選單）。
//
// 做法：把網站複製到系統暫存資料夾、content/ 換成 tests-site/fixtures/content-bulletin/ 再 build（helpers.js 的 buildCopy；專案的檔不動），
//       開本機伺服器、用 Playwright 固定時鐘（page.clock.setFixedTime）與時區（timezoneId）量。預期的 id 用 lib/content.js 讀同一份 fixture 算。
// fixture 的公告（三語同一個形狀）：第一則寫壞（連結是 http）、10-05（寫在上面）、10-20（最新的好公告）、09-01（很舊）、08-01（置頂）。
// fixture 的社群連結：blog、Facebook（代號有大寫 → 寫壞）、threads、mastodon（字串表沒有 social.mastodon）。
//
// 量什麼：
//   F3.4 <head> 裡先有 <meta name="collector-bulletin" content="[{ id, date, pinned }…]">（好的公告、照檔案順序），後面接一支一般的外部腳本
//        （<script src="…/bulletin.js">，沒有 async、defer、type="module"）—— 畫面畫出來之前就決定要不要出現、出現哪一則；不是內嵌腳本。
//   F3.4 中文 1280 寬、Asia/Taipei：
//        10-25 → 10-20 那則（不是寫在上面的 10-05、也不是壞的那則）；關掉 10-20 → 10-05；再關掉 10-05 → 置頂的；全關掉 → 整條不出現；
//        只關掉較舊的（10-05、置頂）→ 10-20 照樣出現（換新 id 又出現）；
//        11-19 23:30（第 30 天）→ 10-20；11-20 00:30（第 31 天）→ 置頂的；10-15（10-20 還沒發布）→ 10-05。
//   F3.4 America/Los_Angeles、UTC 2026-11-20 06:30（當地 11-19 23:30，第 30 天）→ 10-20（用當地日期，不是 UTC 日期）；
//        當地 10-19（台北已經 10-20）→ 10-20 還沒到，換 10-05（時區晚的人晚一天看到）。
//   F3.4 按 ✕：下一幀整條就不在（高度 0 或拿掉），沒有在跑的動畫（不做高度動畫）；localStorage 的 collector-bulletin-dismissed 記了那一則的 id；
//        重新整理：那一則不再出現（換下一則 10-05）。
//   F3.4 localStorage 被擋掉：照樣出現、按 ✕ 收起、重新整理又出現（只在這次瀏覽關掉）、頁面不報錯。
//   F3.4 CLS 0：字型擋掉（沒有字型換上來的那一下）時，公告條出現（10-25）與不出現（全關掉）兩種，layout-shift 總和都是 0。
//   F3.5 三語：標題連結的最後一個 .nw（bindTail 綁的那一段）的最後一個子元素是箭頭圖示（data-icon="arrow"）；
//        .nw 裡的字：中日文是標題最後三個字、英文是最後兩個字（英文要 bindTail 也綁最後兩個字）；
//        280、320、390 寬時標題的最後一行不只一個字；公告條裡看不到任何 reason（「這一條讀不到」以外的原始錯誤）。
//   F3.7 390 寬三語打開 ☰：選單的社群圖示一排只有好的那三個（寫壞的 Facebook 跳過、裡面沒有「讀不到」）、照檔案順序；
//        讀屏名字：blog、threads 是字串表的 social.<代號>，mastodon 字串表沒有 → 用代號當名字；href 是 links.md 的網址。
//   F3.7 npm run content:check 讀這份 fixture：有一條警告講到 mastodon（字串表沒有它的名字）。
//   F3.7 14 區（作者與社群）「這一條讀不到」：todo，等 14 區做出來。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.4 瀏覽器|F3.5|F3.7"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SITE, LANGS, playwright, browserSession, buildCopy, tail, tagAttrs, strings } from './helpers.js';
import { parts, bulletinParts, say, CLS_SCRIPT, NO_STORAGE_SCRIPT } from './page-helpers.js';

const FIXTURE = path.join(SITE, 'tests-site', 'fixtures', 'content-bulletin');
const KEY = 'collector-bulletin-dismissed';
const { readContent } = await import(pathToFileURL(path.join(SITE, 'lib', 'content.js')).href);
const { bindTail } = await import(pathToFileURL(path.join(SITE, 'lib', 'bind-tail.js')).href);
const content = await readContent(FIXTURE);
const good = Object.fromEntries(LANGS.map((lang) => [lang, content.news[lang].entries.filter((e) => e.ok)]));
const byDate = (lang, date) => good[lang].find((e) => e.date === date);

let build = null;
function built() {
    build ??= buildCopy({ content: FIXTURE, label: 'content-bulletin' });
    assert.equal(build.status, 0, `用 fixtures/content-bulletin build 失敗：\n${tail(build.output)}`);
    return build.out;
}
const { pw, why } = playwright();
const session = pw ? browserSession(pw, built) : null;
after(async () => {
    await session?.close();
    build?.cleanup();
});

async function open(lang, { width = 1280, height = 800, time = '2026-10-25T12:00:00+08:00', timezoneId = 'Asia/Taipei', dismissed = null, init = [], noFonts = false, context: extra = {} } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, timezoneId, ...extra });
    // 字型擋掉才量得到「公告條自己」造成的跳動（不然字型換上來的那一下也算進去）
    if (noFonts) await context.route('**/*.woff2', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);   // 找不到東西時 15 秒就紅（預設 30 秒；5 秒在機器忙時開頁會逾時，量過）
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.clock.setFixedTime(new Date(time));
    if (dismissed) await page.addInitScript(([key, ids]) => { try { localStorage.setItem(key, JSON.stringify(ids)); } catch {} }, [KEY, dismissed]);
    for (const script of init) await page.addInitScript(script);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    return { site, page, context, errors };
}

async function shown(page, lang) {
    const b = bulletinParts(page, lang);
    const count = await b.region.count();
    assert.ok(count <= 1, `${lang}：同時看得到 ${count} 條公告條`);
    return count ? (await b.text.textContent()).replace(/\s+/g, ' ').trim() : null;
}
const titleOf = (entry) => (entry ? entry.title : null);

test('F3.4 瀏覽器：<head> 裡先有 <meta name="collector-bulletin">，後面接一支一般的外部腳本（不是內嵌）', () => {
    const out = built();
    for (const lang of LANGS) {
        const html = fs.readFileSync(path.join(out, lang, 'index.html'), 'utf8');
        const head = html.slice(0, html.search(/<\/head>/i));
        const meta = tagAttrs(head, 'meta').find((a) => a.name === 'collector-bulletin');
        assert.ok(meta, `/${lang}/：<head> 裡要有 <meta name="collector-bulletin" content="…">`);
        let list;
        try { list = JSON.parse(meta.content); } catch (err) { assert.fail(`/${lang}/：collector-bulletin 的 content 要是 JSON：${err.message}`); }
        assert.deepEqual(list.map((e) => [e.id, e.date, e.pinned]), good[lang].map((e) => [e.id, e.date, e.pinned]), `/${lang}/：collector-bulletin 是好的公告（id、date、pinned），照檔案順序、壞的不放`);
        const scripts = tagAttrs(head, 'script').filter((a) => /\/bulletin\.js(\?|$)/.test(a.src ?? ''));
        assert.equal(scripts.length, 1, `/${lang}/：<head> 裡要有一支 <script src="…/bulletin.js">`);
        assert.ok(!('async' in scripts[0]) && !('defer' in scripts[0]) && scripts[0].type !== 'module', `/${lang}/：bulletin.js 要同步跑（沒有 async、defer、type="module"），畫面畫出來之前就決定`);
        assert.ok(head.indexOf('collector-bulletin') < head.search(/<script[^>]*bulletin\.js/), `/${lang}/：<meta> 要在 bulletin.js 前面（腳本跑的時候讀得到）`);
    }
});

test('F3.4 瀏覽器：挑最新的、關掉的跳過、全關掉不出現、換新 id 又出現（zh 1280、Asia/Taipei、10-25）', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    const cases = [
        [null, '2026-10-20', '沒關掉任何一則：日期最新的 10-20（不是寫在上面的 10-05、也不是壞的第一則）'],
        [['2026-10-20'], '2026-10-05', '關掉 10-20：換 10-05'],
        [['2026-10-20', '2026-10-05'], '2026-08-01', '再關掉 10-05：置頂的（超過 30 天也出現）'],
        [['2026-10-20', '2026-10-05', '2026-08-01'], null, '全關掉：整條不出現'],
        [['2026-10-05', '2026-08-01'], '2026-10-20', '只關掉較舊的：10-20 照樣出現（換新 id 又出現）'],
    ];
    for (const [dates, want, what] of cases) {
        const dismissed = dates ? dates.map((d) => byDate(lang, d).id) : null;
        const { page, context, errors } = await open(lang, { dismissed });
        try {
            assert.equal(await shown(page, lang), titleOf(want && byDate(lang, want)), what);
            assert.deepEqual(errors, [], `${what}：頁面不能有錯誤`);
        } finally {
            await context.close();
        }
    }
});

test('F3.4 瀏覽器：30 天的邊界用看的人的當地日期（Asia/Taipei 第 30、31 天；America/Los_Angeles 第 30 天）', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    const cases = [
        ['2026-11-19T23:30:00+08:00', 'Asia/Taipei', '2026-10-20', 'Asia/Taipei 11-19 23:30（第 30 天）：10-20 還在'],
        ['2026-11-20T00:30:00+08:00', 'Asia/Taipei', '2026-08-01', 'Asia/Taipei 11-20 00:30（第 31 天）：10-20 掉出去，換置頂的'],
        ['2026-11-20T06:30:00Z', 'America/Los_Angeles', '2026-10-20', 'America/Los_Angeles 當地 11-19 23:30（UTC 已經 11-20）：第 30 天，10-20 還在'],
        ['2026-10-15T12:00:00+08:00', 'Asia/Taipei', '2026-10-05', 'Asia/Taipei 10-15：10-20 還沒發布（未來的日期）不顯示，換已經發布的 10-05'],
        ['2026-10-20T06:30:00+08:00', 'America/Los_Angeles', '2026-10-05', 'America/Los_Angeles 當地 10-19 15:30（台北已經 10-20）：10-20 對這個人還沒到，換 10-05'],
    ];
    for (const [time, timezoneId, want, what] of cases) {
        const { page, context } = await open(lang, { time, timezoneId });
        try {
            assert.equal(await shown(page, lang), titleOf(byDate(lang, want)), what);
        } finally {
            await context.close();
        }
    }
});

test('F3.4 瀏覽器：按 ✕ 下一幀整條就不在、不做高度動畫、記住 id；重新整理不出現（換下一則）', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    const { page, context, errors } = await open(lang);
    try {
        const b = bulletinParts(page, lang);
        assert.equal(await shown(page, lang), titleOf(byDate(lang, '2026-10-20')), '防呆：一開始是 10-20');
        const after = await b.close.evaluate(async (button) => {
            const bar = button.closest('[role="region"]');
            button.click();
            await new Promise((done) => requestAnimationFrame(() => done()));
            const r = bar.getBoundingClientRect();
            const anims = bar.isConnected ? bar.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0;
            return { connected: bar.isConnected, height: r.height, display: bar.isConnected ? getComputedStyle(bar).display : 'none', anims };
        });
        assert.ok(!after.connected || after.height === 0 || after.display === 'none', `按 ✕ 之後下一幀整條要不在（直接拿掉，不做高度動畫），得到 ${JSON.stringify(after)}`);
        assert.equal(after.anims, 0, '按 ✕ 之後公告條上不能有在跑的動畫');
        assert.equal(await shown(page, lang), null, '按 ✕ 之後看不到公告條');
        const stored = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), KEY) ?? '[]');
        assert.ok(Array.isArray(stored) && stored.includes(byDate(lang, '2026-10-20').id), `localStorage 的 ${KEY} 要是 id 陣列、記了 10-20 的 id，得到 ${JSON.stringify(stored)}`);
        await page.reload({ waitUntil: 'load' });
        assert.equal(await shown(page, lang), titleOf(byDate(lang, '2026-10-05')), '重新整理：關掉的那則不再出現，換下一則 10-05');
        assert.deepEqual(errors, [], '頁面不能有錯誤');
    } finally {
        await context.close();
    }
});

test('F3.4 瀏覽器：localStorage 被擋掉 —— 照樣出現、✕ 收起、重新整理又出現、不報錯', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    const { page, context, errors } = await open(lang, { init: [NO_STORAGE_SCRIPT] });
    try {
        assert.equal(await page.evaluate(() => { try { localStorage.length; return 'ok'; } catch { return 'blocked'; } }), 'blocked', '防呆：localStorage 要被擋掉');
        assert.equal(await shown(page, lang), titleOf(byDate(lang, '2026-10-20')), 'localStorage 被擋掉也要照樣出現');
        await bulletinParts(page, lang).close.click();
        assert.equal(await shown(page, lang), null, '按 ✕ 要收起（只在這次瀏覽）');
        await page.reload({ waitUntil: 'load' });
        assert.equal(await shown(page, lang), titleOf(byDate(lang, '2026-10-20')), '重新整理又出現（存不了，就只在那次瀏覽關掉）');
        assert.deepEqual(errors, [], '頁面不能有錯誤');
    } finally {
        await context.close();
    }
});

test('F3.4 瀏覽器：公告條造成的 CLS 是 0（出現、不出現兩種；字型擋掉）', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    for (const [dismissed, what] of [[null, '出現'], [['2026-10-20', '2026-10-05', '2026-08-01'], '全關掉、不出現']]) {
        const { page, context } = await open(lang, { width: 390, height: 844, dismissed: dismissed && dismissed.map((d) => byDate(lang, d).id), init: [CLS_SCRIPT], noFonts: true });
        try {
            await page.waitForTimeout(500);
            assert.equal(await shown(page, lang), dismissed ? null : titleOf(byDate(lang, '2026-10-20')), `${what}：防呆：公告條${dismissed ? '不該出現' : '要出現（10-20）'}`);
            const { cls, shifts } = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
            assert.equal(cls, 0, `${what}：CLS 要是 0（要不要出現在畫面畫出來之前就決定），得到 ${cls}：${JSON.stringify(shifts)}`);
        } finally {
            await context.close();
        }
    }
});

for (const lang of LANGS) {
    test(`F3.5 公告標題（${lang}）：bindTail 綁最後幾個字、箭頭在最後一個 .nw 裡、最後一行不只一個字、沒有原始錯誤`, { skip: pw ? false : why }, async () => {
        const entry = byDate(lang, '2026-10-20');
        const words = lang === 'en' ? entry.title.split(' ').slice(-2).join(' ') : Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(entry.title), (s) => s.segment).slice(-3).join('');
        for (const width of [1280, 390, 320, 280]) {
            const { page, context } = await open(lang, { width });
            try {
                const b = bulletinParts(page, lang);
                assert.equal(await shown(page, lang), entry.title, `${lang} ${width}：防呆：公告條是 10-20 那則`);
                const tailInfo = await b.text.evaluate((a) => {
                    const nws = a.querySelectorAll('.nw');
                    const last = nws[nws.length - 1];
                    if (!last) return null;
                    const lastChild = last.lastElementChild;
                    return { text: last.textContent.replace(/\s+/g, ' ').trim(), icon: lastChild ? lastChild.getAttribute('data-icon') : null, afterNw: a.innerHTML.slice(a.innerHTML.lastIndexOf('</span>') + 7).trim() };
                });
                assert.ok(tailInfo, `${lang} ${width}：標題裡要有 bindTail 綁的 <span class="nw">`);
                assert.equal(tailInfo.text, words, `${lang} ${width}：最後一個 .nw 要是標題的${lang === 'en' ? '最後兩個字' : '最後三個字'}「${words}」`);
                assert.equal(tailInfo.icon, 'arrow', `${lang} ${width}：箭頭圖示（data-icon="arrow"）要插在最後一個 .nw 裡的最後面（跟最後一個詞一起換行）`);
                assert.equal(tailInfo.afterNw, '', `${lang} ${width}：最後一個 </span> 後面不能還有字`);
                const lastLine = await b.text.evaluate((a) => {
                    const chars = [];
                    const walk = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
                    while (walk.nextNode()) {
                        const node = walk.currentNode;
                        for (let i = 0; i < node.data.length; i += 1) {
                            if (!node.data[i].trim()) continue;
                            const range = document.createRange();
                            range.setStart(node, i);
                            range.setEnd(node, i + 1);
                            const r = range.getBoundingClientRect();
                            if (r.width > 0) chars.push({ ch: node.data[i], y: Math.round(r.top) });
                        }
                    }
                    const bottom = Math.max(...chars.map((c) => c.y));
                    return chars.filter((c) => Math.abs(c.y - bottom) <= 2).map((c) => c.ch).join('');
                });
                assert.ok(Array.from(lastLine).length >= 2, `${lang} ${width}：標題最後一行只剩「${lastLine}」`);
                const text = await b.region.textContent();
                for (const reason of [...content.news[lang].entries.filter((e) => !e.ok).map((e) => e.reason)]) {
                    assert.ok(!text.includes(reason.slice(0, 12)), `${lang} ${width}：公告條裡出現了 reason「${reason}」`);
                }
            } finally {
                await context.close();
            }
        }
        const html = fs.readFileSync(path.join(built(), lang, 'index.html'), 'utf8');
        const bound = bindTail(entry.title, lang);
        if (lang !== 'en') assert.ok(html.includes(bound.slice(0, bound.lastIndexOf('</span>'))), `${lang}：公告標題要用 bindTail 的輸出（箭頭插在最後一個 </span> 前）`);
    });
}

for (const lang of LANGS) {
    test(`F3.7 社群圖示一排（${lang} 390 選單）：跳過寫壞的那條、新代號用代號當名字、照檔案順序`, { skip: pw ? false : why }, async () => {
        const { page, context } = await open(lang, { width: 390 });
        try {
            const p = await parts(page, lang);
            await p.menuButton.click();
            const links = await p.socials.locator('a').evaluateAll((els) => els.map((a) => ({ name: a.getAttribute('aria-label'), href: a.getAttribute('href') })));
            const want = content.links.entries.filter((e) => e.ok).map((e) => ({
                name: Object.hasOwn(strings[lang], `social.${e.code}`) ? say(lang, `social.${e.code}`) : e.code,
                href: e.url,
            }));
            assert.deepEqual(links, want, `${lang}：選單的社群圖示一排要是好的那幾個（寫壞的跳過），新代號用代號當名字`);
            assert.equal(await p.menu.locator('[data-state="unreadable"]').count(), 0, `${lang}：選單裡不顯示「讀不到」（只在 14 區顯示）`);
            assert.equal(await p.header.locator('[data-state="unreadable"]').count(), 0, `${lang}：導覽列裡不顯示「讀不到」`);
        } finally {
            await context.close();
        }
    });
}

test('F3.7 content:check：字串表沒有名字的社群代號（mastodon）要有一條警告', () => {
    const run = spawnSync(process.execPath, [path.join(SITE, 'scripts', 'content-check.mjs'), '--dir', FIXTURE], { cwd: SITE, encoding: 'utf8' });
    const out = `${run.stdout}\n${run.stderr}`;
    const line = out.split('\n').find((l) => l.includes('mastodon') && /警告|名字|名稱|字串表/.test(l)) ?? out.split('\n').find((l) => l.includes('mastodon'));
    assert.ok(/警告/.test(out) && line, `content:check 要警告「社群代號 mastodon 在字串表裡沒有名字（social.mastodon）」，輸出：\n${tail(out)}`);
});

test('F3.7 14 區（作者與社群）顯示「這一條讀不到」', { todo: '14 區還沒做（之後那一段）；做出來之後量：寫壞的社群連結在 14 區顯示 data-state="unreadable"，頁尾跳過' }, () => {});
