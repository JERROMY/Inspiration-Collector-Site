// F10 前的三個設計小項（設計稿 claude/home-4 @ 1d18ae2，notes/4-4.md 的 A1、A3、A4）。
//   F10.1 12 更新紀錄的空狀態：字串表多一條 changelog.empty（三語、303 → 304 個 id）；內容檔讀得到、但過濾掉不列的版本（app/site.js 的 CHANGELOG_FROM 以前的）
//         之後一版都沒有時，12 區畫一句 changelog.empty，樣式同 11 的 news.empty；不畫虛線框、不畫任何一版。
//         另外 build 兩份暫存複本（helpers.js 的 buildCopy，專案的 content/、out/ 不動）：content/ 照真的那份，只把三語的 changelog 換掉 ——
//         「只有 1.0.3」（只有一版、是不列的那一版）與「空檔」；兩份的 news 也換成空檔，好在同一頁量 news.empty 的樣式來比。
//         整支讀不到、每一版都寫壞仍是整區虛線框（state.unreadable.section）—— 那條由 content-broken.test.js 的 F1b.3 守著，這裡不重寫。
//   F10.2 日文 faq.7.a 的斷行：字串表 ja 的 faq.7.a 跟設計稿 1d18ae2 的 strings/ja.json 位元組相同（下面的 FAQ_7A_JA；給了 SITE_STRINGS_DIR 也跟那份比）；
//         日文 1440、1024、768、640 這題答案畫出來的每一行 ≤ 25 個全形字寬（每一行的字照 page-helpers.js 的 width() 算：中日文一個字 1、拉丁字母與數字 0.5；
//         修前第二行「（「困ったときは」）を押すと、その場で各所を点検し、」是 26）；另外量那一行實際的寬（字的左緣到右緣 ÷ 字級）也要 ≤ 25em。
//   F10.3 語言切換「中」「日」的字型：三語頁 × 導覽列、☰ 選單、頁尾（每頁 9 顆）：用 CDP 的 CSS.getPlatformFontsForNode 量實際畫字的字型 ——
//         標 lang="zh-Hant" 的「中」是 PingFang TC、lang="ja" 的「日」是 Hiragino Sans、「EN」是 JetBrains Mono；每一顆跟設計稿一樣 44×44（差 ≤ 1px）。
//         字型名是 mac 的系統字型，只在 mac 上跑（其他系統 skip 並寫原因）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F10\\."
//   SITE_COPY_MD=<design/homepage/copy.md> SITE_STRINGS_DIR=<design/homepage/strings> node --test tests-site/f10-small.test.js   （多比對設計稿的檔）
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, HTML_LANG, strings, playwright, browserSession, buildCopy, tail } from './helpers.js';
import { parts, say, width as charWidth } from './page-helpers.js';

// 2026-10-04：09 章節清單多兩條（tutorial.count、tutorial.moreHint），先加在 strings/，之後補回設計稿 → 306
const IDS = 306;
const EMPTY = { zh: '目前沒有更新紀錄。', en: 'No release notes yet.', ja: '現在、更新履歴はありません。' };
// 設計稿 1d18ae2 的 strings/ja.json 的 faq.7.a（只比修前多一對 «»：「その場で各所を点検し、」「どこが悪いか、」包成一個外層單位）
const FAQ_7A_JA = '««サイドパネル上部の»«聴診器アイコン»«（「困ったときは」）を押すと、»««その場で各所を点検し、»«どこが悪いか、»»«どのボタンを押せばいいかを»«教えてくれます。»»««点検結果を»«作者宛てのメールに»«まとめることもできます。»»««送るかどうかは»«あなたが決めます。»»';
const FONT = { 'zh-Hant': 'PingFang TC', ja: 'Hiragino Sans', en: 'JetBrains Mono' };
const DESIGN_BOX = { w: 44, h: 44 };   // 設計稿 1d18ae2 三語頁 1440、390（選單打開）每一顆語言切換都量到 44×44

const { pw, why } = playwright();
const isMac = process.platform === 'darwin';

// ---------- F10.1 ----------

test('F10.1 字串表：三語各 306 個 id、changelog.empty 三語是設計稿的字；給了 SITE_COPY_MD 時 copy.md 文案表的每個 id 都在', (t) => {
    for (const lang of LANGS) {
        assert.equal(Object.keys(strings[lang]).length, IDS, `strings/${lang}.json 要有 ${IDS} 個 id，得到 ${Object.keys(strings[lang]).length}`);
        assert.equal(strings[lang]['changelog.empty'], EMPTY[lang], `strings/${lang}.json 的 changelog.empty 要是「${EMPTY[lang]}」`);
    }
    const copy = process.env.SITE_COPY_MD;
    if (!copy) {
        t.diagnostic('沒設 SITE_COPY_MD（設計師的 copy.md），copy.md 那一段沒比');
        return;
    }
    assert.ok(fs.existsSync(copy), `SITE_COPY_MD=${copy} 不存在`);
    const ids = [];
    let inTable = false;
    for (const row of fs.readFileSync(copy, 'utf8').split(/\r?\n/)) {
        if (!row.startsWith('|')) { inTable = false; continue; }
        const cells = row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (cells.join('|') === 'id|zh|en|ja|來源|確認') { inTable = true; continue; }
        if (inTable && !/^-+$/.test(cells[0]) && cells[0] !== '') ids.push(cells[0]);
    }
    assert.ok(ids.includes('changelog.empty'), 'copy.md 的文案表裡沒有 changelog.empty（SITE_COPY_MD 指到舊版？）');
    for (const lang of LANGS) assert.deepEqual(ids.filter((id) => !(id in strings[lang])), [], `strings/${lang}.json 缺 copy.md 的 id`);
});

const VARIANTS = {
    only103: { what: '只有 1.0.3', log: { zh: '## 1.0.3 · 2026-09-26\n- 修好：只有不列的這一版\n', en: '## 1.0.3 · 2026-09-26\n- Fixed: only the unlisted version\n', ja: '## 1.0.3 · 2026-09-26\n- 修正：表示しないバージョンだけ\n' } },
    empty: { what: 'changelog 空檔', log: { zh: '', en: '', ja: '' } },
};
const builds = {};
function out(name) {
    builds[name] ??= buildCopy({
        label: `f10-${name}`,
        prepare: (copy) => {
            for (const lang of LANGS) {
                fs.writeFileSync(path.join(copy, 'content', `changelog.${lang}.md`), VARIANTS[name].log[lang]);
                fs.writeFileSync(path.join(copy, 'content', `news.${lang}.md`), '');
            }
        },
    });
    assert.equal(builds[name].status, 0, `changelog 換成「${VARIANTS[name].what}」之後 build 失敗：\n${tail(builds[name].output)}`);
    return builds[name].out;
}
const sessions = pw ? { real: browserSession(pw), only103: browserSession(pw, () => out('only103')), empty: browserSession(pw, () => out('empty')) } : {};
after(async () => {
    for (const s of Object.values(sessions)) await s.close();
    for (const b of Object.values(builds)) b.cleanup();
});

async function open(which, lang, width, { js = true } = {}) {
    const { site, browser } = await sessions[which].get();
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, errors };
}

const STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'letterSpacing'];
const EMPTY_STATE = ({ text, newsText, keys }) => {
    const pick = (el) => (el ? Object.fromEntries(keys.map((k) => [k, getComputedStyle(el)[k]])) : null);
    const flat = (s) => s.replace(/\s+/g, ' ').trim();
    const find = (root, want) => (root ? [...root.querySelectorAll('p, div, span')].filter((e) => flat(e.textContent) === want && ![...e.children].some((c) => flat(c.textContent) === want)) : []);
    const log = document.querySelector('[data-section="changelog"]');
    const news = document.querySelector('[data-section="news"]');
    const hits = find(log, text);
    return {
        hits: hits.length,
        shown: hits.length === 1 && hits[0].checkVisibility(),
        style: pick(hits[0]),
        newsStyle: pick(find(news, newsText)[0]),
        unreadable: log ? log.querySelectorAll('[data-state="unreadable"]').length : -1,
        versions: log ? log.querySelectorAll('[data-version]').length : -1,
    };
};

for (const name of Object.keys(VARIANTS)) {
    for (const lang of LANGS) {
        test(`F10.1 12 沒有可列的版本（${lang}，${VARIANTS[name].what}，關 JS 1440 與開 JS 390）：一句 changelog.empty、樣式同 news.empty、沒有虛線框`, { skip: pw ? false : why }, async () => {
            for (const [width, js] of [[1440, false], [390, true]]) {
                const { page, context, errors } = await open(name, lang, width, { js });
                try {
                    const got = await page.evaluate(EMPTY_STATE, { text: EMPTY[lang], newsText: say(lang, 'news.empty'), keys: STYLE_KEYS });
                    const at = `${lang} ${width}${js ? '' : ' 關 JS'}`;
                    assert.equal(got.versions, 0, `${at}：12 不該畫任何一版（[data-version] 有 ${got.versions} 個）`);
                    assert.equal(got.unreadable, 0, `${at}：沒有可列的版本不是讀不到，12 不該有虛線框（data-state="unreadable" 有 ${got.unreadable} 個）`);
                    assert.equal(got.hits, 1, `${at}：12 要剛好一句「${EMPTY[lang]}」，找到 ${got.hits} 句`);
                    assert.ok(got.shown, `${at}：12 的「${EMPTY[lang]}」要看得到`);
                    assert.ok(got.newsStyle, `${at}：防呆 —— 11 的 news.empty 要在（內容 news 是空檔）`);
                    assert.deepEqual(got.style, got.newsStyle, `${at}：changelog.empty 的樣式要跟 news.empty 一樣`);
                    assert.deepEqual(errors, [], `${at}：頁面不該報錯`);
                } finally {
                    await context.close();
                }
            }
        });
    }
}

// ---------- F10.2 ----------

test('F10.2 字串表 ja 的 faq.7.a 跟設計稿 1d18ae2 位元組相同（給了 SITE_STRINGS_DIR 也跟那份比）', () => {
    const raw = fs.readFileSync(path.join(SITE, 'strings', 'ja.json'), 'utf8');
    assert.equal(JSON.parse(raw)['faq.7.a'], FAQ_7A_JA, 'strings/ja.json 的 faq.7.a 要是設計稿 1d18ae2 的那一條（「その場で各所を点検し、」「どこが悪いか、」包成一個外層單位）');
    const dir = process.env.SITE_STRINGS_DIR;
    if (dir) {
        const want = JSON.parse(fs.readFileSync(path.join(dir, 'ja.json'), 'utf8'))['faq.7.a'];
        assert.equal(JSON.parse(raw)['faq.7.a'], want, `strings/ja.json 的 faq.7.a 要跟 ${dir}/ja.json 一樣`);
    }
});

const ANSWER_LINES = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const details = el.closest('details');
    if (details) details.open = true;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const lines = [];
    let line = null;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
        const node = walk.currentNode;
        for (const { segment, index } of new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(node.data)) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + segment.length);
            const r = range.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (!line || r.top > line.top + r.height * 0.5) {
                line = { top: r.top, text: '', left: Infinity, right: -Infinity };
                lines.push(line);
            }
            line.text += segment;
            if (/\S/.test(segment)) {
                line.left = Math.min(line.left, r.left);
                line.right = Math.max(line.right, r.right);
            }
        }
    }
    return lines.map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), em: (l.right - l.left) / fs })).filter((l) => l.text);
};

test('F10.2 日文 faq.7.a 畫出來每一行 ≤ 25 個全形字寬（1440、1024、768、640）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const width of [1440, 1024, 768, 640]) {
        const { page, context } = await open('real', 'ja', width);
        try {
            const lines = await page.evaluate(ANSWER_LINES, '[data-section="faq"] [data-id="faq.7.a"]');
            assert.ok(lines && lines.length > 1, `ja ${width}：找不到 13 第七題的答案（[data-id="faq.7.a"]）或只有一行`);
            for (const l of lines) {
                const n = charWidth(l.text);
                if (n > 25) bad.push(`ja ${width}：「${l.text}」${n} 字寬`);
                if (l.em > 25.05) bad.push(`ja ${width}：「${l.text}」實際寬 ${l.em.toFixed(2)}em`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], '每一行要 ≤ 25 個全形字寬');
});

// ---------- F10.3 ----------

// 每一顆語言切換：在哪一排、lang、實際畫字的字型（glyph 最多的那個）、寬高
async function langButtons(page, context, rows) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const found = [];
    for (const [where, locator] of rows) {
        const handles = await locator.locator('a[lang]').elementHandles();
        for (const h of handles) {
            const info = await h.evaluate((a) => ({ lang: a.getAttribute('lang'), text: a.textContent.trim(), r: a.getBoundingClientRect().toJSON() }));
            const marker = `f10-${found.length}`;
            await h.evaluate((a, m) => a.setAttribute('data-f10', m), marker);
            const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
            const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-f10="${marker}"]` });
            const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
            const main = [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0]?.familyName ?? '（沒有畫字）';
            found.push({ where, ...info, font: main });
        }
    }
    await cdp.detach();
    return found;
}

for (const lang of LANGS) {
    test(`F10.3 語言切換的字型（${lang}，導覽列、☰ 選單、頁尾 9 顆）：「中」PingFang TC、「日」Hiragino Sans、「EN」JetBrains Mono；44×44`, { skip: !pw ? why : !isMac ? 'PingFang TC、Hiragino Sans 是 mac 的系統字型，只在 mac 上量' : false }, async () => {
        const all = [];
        const label = say(lang, 'lang.label').replace(/["\\]/g, '\\$&');
        for (const width of [1440, 390]) {
            const { page, context } = await open('real', lang, width);
            try {
                const p = await parts(page, lang);
                const rows = [];
                if (width === 1440) {
                    rows.push(['導覽列', p.langGroup]);
                    rows.push(['頁尾', page.locator(`footer[data-section="footer"] [role="group"][aria-label="${label}"]`)]);
                } else {
                    await p.menuButton.click();
                    await p.menuLang.first().waitFor({ state: 'visible' });
                    rows.push(['☰ 選單', p.menuLang]);
                }
                all.push(...await langButtons(page, context, rows));
            } finally {
                await context.close();
            }
        }
        const where = (b) => `${lang} 頁 ${b.where} lang="${b.lang}"「${b.text}」`;
        assert.equal(all.length, 9, `要量到 9 顆（三排 × 中／EN／日），量到 ${all.length}：${all.map(where).join('、')}`);
        for (const want of Object.values(HTML_LANG)) assert.equal(all.filter((b) => b.lang === want).length, 3, `lang="${want}" 要有 3 顆`);
        const bad = [];
        for (const b of all) {
            if (b.font !== FONT[b.lang]) bad.push(`${where(b)}：字型是 ${b.font}，要是 ${FONT[b.lang]}`);
            if (Math.abs(b.r.width - DESIGN_BOX.w) > 1 || Math.abs(b.r.height - DESIGN_BOX.h) > 1) bad.push(`${where(b)}：${b.r.width}×${b.r.height}，設計稿 ${DESIGN_BOX.w}×${DESIGN_BOX.h}`);
        }
        assert.deepEqual(bad, [], '語言切換每一顆的字型與大小');
    });
}
