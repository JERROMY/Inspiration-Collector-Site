// F6.1 卡片排法、F6.2 06 的「看教學 NN」、F6.3 08 隱私、F6.5 文案與通用 —— 05 三步驟、06 能收什麼、08 隱私（15 最後的安裝在 final.test.js）。讀 out/，真的開瀏覽器。
// 照設計稿 607a536（08 隱私的措辭限定為「擴充」；之前是 350fdf4）的 {zh,en,ja}/index.html 05、06、08、15 那幾段與 home.css；規格書 §5-05、5-06、5-08、5-15。
//
// 介面（README.md「05、06、08、15（F6）」）：
//   <section data-section="how" id="how">、<section data-section="features" id="features">、<section data-section="privacy" id="privacy">、<section data-section="final" id="install">；
//   字串表的每一段字畫在 data-id="<id>" 的元素裡；每一張卡（05 的每一步）是一個 <li>，裡面有 <id>.title 與 <id>.body；
//   06 每張卡的「看教學 NN」是 data-id="features.N.more" 的連結：字是 features.more 代入章號、href="#ch-NN"、data-chapter="NN"。
//   對照資料：fixtures/design-6511462.json 的 cards、cardsTouch；fixtures/design-lines-05-15.json（tools/measure-design.mjs 產生）。
//
// 量什麼：
//   F6.1 三語 × 有滑鼠十二種寬度：05 第一排幾步、06 與 08 第一排幾張跟設計稿一樣（05：640 起三欄、手機一欄；06、08：1280 起四欄、640 起兩欄、手機一欄），張數 3／8／4；
//        06 與 08 的卡片長得一樣（同一個卡片元件：內距、圓角、框線、底色都一樣）。
//   F6.2 三語：06 八張卡的「看教學 NN」依序 03、04、05、06、07、08、09、03，字＝features.more 代入章號，href＝#ch-NN、data-chapter＝NN；
//        06 的字不寫「檔名從內容算出來」、不寫「來源全部保留」（規格書 §5-06）。點了跳到 09 區那一章、從那一章播：在 tutorial.test.js 的 F7.3。
//   F6.3 三語：08 四張卡（沒有伺服器、沒有帳號、沒有追蹤、只碰你挑的資料夾），每一張講的事在隱私條款（release/privacy 那一語）裡找得到；
//        「看完整的隱私條款」連到 https://jerromy.com/privacy/；隱私條款的日期在 release/privacy 四份、側邊欄 _locales 的 ui_privacyUpdated 一致，
//        08 若寫了日期也要是同一天（網站 08 是第五份拷貝）。release/、clipper/ 不在（公開 repo）時那幾項不量。
//        主詞（設計稿 607a536）：08 的標題講「你存的東西」、導言講「用擴充存下的東西」、第 1、3 張卡的標題講「擴充本身」（字串表與畫出來的字都量）；
//        08 每一條字串逐句掃：講了「沒有追蹤／No tracking／追跡なし」的那一句一定要有擴充當主詞（網站本身會用 GoatCounter 數人次）。
//        16 區頁尾那句（網站用 GoatCounter、擴充本身沒有追蹤）：f8-sections.test.js 的 F8.3。
//   F6.5 文案（三語 × 十二種寬度，有滑鼠、減少動態）：05、06、08、15 每一段字的每一行跟設計稿一樣；說明文字中日文每行 5～25 字寬（跟設計稿同一行的不算）、行首沒有孤標點，英文沒有只有一個字的行。
//   F6.5 字到邊（三語 × 有滑鼠十二種寬度；15 區手指框另外量只有手指 280～430）：06、08 每張卡、15 的手指框裡的字到框的內緣 ≥ 設計內距的一半。
//   F6.5 通用（三語 × 十二種寬度、減少動態）：整頁不橫捲；這四區的 data-id 區塊不重疊；連結與按鈕 ≥ 44×44（這四區沒有句子裡的連結）；捲到每一區之後沒有在跑的動畫；
//        關掉 JS（390、1440）四區每一段字都在。
//   F6.5 區塊順序與導覽列的錨點：hero → where → how → features → forai → privacy → final（DOM 順序）；#features 在。#tutorial 在 tutorial.test.js 的 F7.5；#devices、#news、#changelog、#faq 在 f8-sections.test.js 的 F8.6。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F6\\.[1235]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { textLines, width as wide, WIDTHS, CARD_GEOMETRY } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';

const POS = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-05-15.json'), 'utf8'));
const say = (lang, id) => getPlainString(lang, id);
const CHAPTERS = ['03', '04', '05', '06', '07', '08', '09', '03'];
const SECTIONS = { how: 'how', features: 'features', privacy: 'privacy' };
const cardSel = (sec) => `[data-section="${sec}"] li:has([data-id$=".title"])`;
const PROSE = ['how.pain', 'how.1.body', 'how.2.body', 'how.3.body', ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `features.${n}.body`), 'privacy.lead', ...[1, 2, 3, 4].map((n) => `privacy.${n}.body`), 'final.meta'];
const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;
const REPO = path.resolve(SITE, '..', '..');

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, { touch = false, js = true, reduced = true, height } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? { isMobile: true, hasTouch: true } : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context };
}

// ---------- F6.1 ----------

for (const lang of LANGS) {
    test(`F6.1 卡片排法（${lang}，有滑鼠十二種寬度）：05、06、08 第一排幾張跟設計稿一樣、張數對`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                for (const sec of Object.keys(SECTIONS)) {
                    const got = await page.evaluate(CARD_GEOMETRY, cardSel(sec));
                    const want = POS.cards[lang][String(width)][sec];
                    if (!got) { bad.push(`${width} ${sec}：找不到卡片（[data-section="${sec}"] 裡帶 data-id 的 <li>）`); continue; }
                    if (got.count !== want.count) bad.push(`${width} ${sec}：要 ${want.count} 張，得到 ${got.count}`);
                    if (got.cols !== want.cols) bad.push(`${width} ${sec}：第一排要 ${want.cols} 張，得到 ${got.cols}`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

test('F6.1 06 與 08 用同一個卡片元件（三語 1440）：內距、圓角、框線、底色一樣', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440);
        try {
            const look = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { padding: c.padding, radius: c.borderRadius, border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`, bg: c.backgroundColor }; }, sel);
            const a = await look(cardSel('features'));
            const b = await look(cardSel('privacy'));
            assert.ok(a && b, `${lang}：找不到 06 或 08 的卡片`);
            assert.deepEqual(b, a, `${lang}：08 的卡片要跟 06 長得一樣（同一個元件）`);
        } finally {
            await context.close();
        }
    }
});

// ---------- F6.2 ----------

test('F6.2 06 的「看教學 NN」（三語）：章號依序 03、04、05、06、07、08、09、03，連到 #ch-NN', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            for (const [i, nn] of CHAPTERS.entries()) {
                const n = i + 1;
                const a = page.locator(`[data-section="features"] [data-id="features.${n}.more"]`);
                if ((await a.count()) !== 1) { bad.push(`${lang} 第 ${n} 張：找不到 data-id="features.${n}.more"`); continue; }
                const got = await a.evaluate((e) => { const link = e.closest('a') || e; return { tag: link.tagName, href: link.getAttribute('href'), chapter: link.getAttribute('data-chapter'), text: link.textContent.replace(/\s+/g, ' ').trim() }; });
                const text = say(lang, 'features.more').replace('%nn%', nn);
                if (got.tag !== 'A') bad.push(`${lang} 第 ${n} 張：「看教學」要是連結`);
                if (got.href !== `#ch-${nn}`) bad.push(`${lang} 第 ${n} 張：href 要是 #ch-${nn}，得到 ${got.href}`);
                if (got.chapter !== nn) bad.push(`${lang} 第 ${n} 張：data-chapter 要是 ${nn}，得到 ${got.chapter}`);
                if (got.text !== text) bad.push(`${lang} 第 ${n} 張：字要是「${text}」，得到「${got.text}」`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 點「看教學 NN」跳到 09 區那一章（沒有影片 ID 時）、從那一章開始播（有影片 ID 時）：已轉成必過，在 tutorial.test.js 的 F7.3。

const FORBIDDEN = {
    zh: [/檔名.{0,8}(從|由|依|照)內容/, /來源.{0,2}全部保留|全部的?來源都(保留|存)/],
    en: [/file ?names? (are |is )?(derived|computed|generated|calculated|worked out) from (the )?content/i, /(keeps?|saves?|preserves?) (all|every) (of the )?(sources|citations)/i],
    ja: [/ファイル名.{0,12}内容から/, /出典(を|は)?(すべて|全部)/],
};

test('F6.2 06 的字不寫「檔名從內容算出來」、不寫「來源全部保留」（三語，字串表與畫出來的字）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const ids = Object.keys(JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))).filter((k) => k.startsWith('features.'));
        for (const id of ids) for (const re of FORBIDDEN[lang]) if (re.test(say(lang, id))) bad.push(`${lang} 字串表 ${id}：「${say(lang, id)}」`);
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const sec = page.locator('[data-section="features"]');
            if (!(await sec.count())) { bad.push(`${lang}：找不到 06`); continue; }
            const text = (await sec.textContent()).replace(/\s+/g, ' ');
            for (const re of FORBIDDEN[lang]) if (re.test(text)) bad.push(`${lang} 畫面：${re}`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處寫了不該寫的`);
});

// ---------- F6.3 ----------

// 每張卡講的事（畫面上要這樣講），與隱私條款裡支持它的那句（條款那一語）
const FACTS = {
    zh: [{ card: /沒有伺服器/, policy: [/沒有伺服器/] }, { card: /沒有帳號/, policy: [/沒有帳號|不會建立帳號/] },
        { card: /分析.*追蹤.*廣告|沒有追蹤/, policy: [/分析/, /廣告/] }, { card: /只.{0,4}碰.{0,4}(你挑|那一個)|碰不到/, policy: [/只有你.{0,20}挑的.{0,4}那一個資料夾/] }],
    en: [{ card: /no server/i, policy: [/no server/i] }, { card: /no account/i, policy: [/no account/i] },
        { card: /analytics.*tracking.*ads|no tracking/i, policy: [/analytics/i, /advertising/i] }, { card: /only the folder|no other folder/i, policy: [/only touch the single folder you selected/i] }],
    ja: [{ card: /サーバーなし/, policy: [/サーバーも/] }, { card: /アカウントなし/, policy: [/アカウントも|アカウントは作成されず/] },
        { card: /解析.*追跡.*広告|追跡なし/, policy: [/解析/, /広告/] }, { card: /選んだフォルダーだけ|一切触れません/, policy: [/その一つのフォルダー/] }],
};
const POLICY = { zh: 'PRIVACY-zh_TW.md', en: 'PRIVACY-en.md', ja: 'PRIVACY-ja.md' };
const PRIVACY_DIR = path.join(REPO, 'release', 'privacy');

test('F6.3 08 四張卡講的事都在隱私條款裡（三語）、「看完整的隱私條款」連到 jerromy.com/privacy/', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const policy = fs.existsSync(PRIVACY_DIR) ? fs.readFileSync(path.join(PRIVACY_DIR, POLICY[lang]), 'utf8').replace(/\s*\n\s*/g, ' ').replace(/\*\*/g, '') : null;
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const cards = [];
            for (const n of [1, 2, 3, 4]) {
                const t = page.locator(`[data-section="privacy"] [data-id="privacy.${n}.title"]`);
                const b = page.locator(`[data-section="privacy"] [data-id="privacy.${n}.body"]`);
                cards.push((await t.count()) && (await b.count()) ? `${(await t.textContent()).trim()} ${(await b.textContent()).trim()}`.replace(/\s+/g, ' ') : null);
            }
            if (cards.some((c) => c === null)) { bad.push(`${lang}：08 要有四張卡（privacy.1～4 的 title 與 body）`); continue; }
            const extra = await page.locator('[data-section="privacy"] li:has([data-id$=".title"])').count();
            if (extra !== 4) bad.push(`${lang}：08 要剛好四張卡，得到 ${extra}`);
            FACTS[lang].forEach((f, i) => {
                if (!f.card.test(cards[i])) bad.push(`${lang} 第 ${i + 1} 張「${cards[i]}」沒講到 ${f.card}`);
                if (policy) for (const re of f.policy) if (!re.test(policy)) bad.push(`${lang} 第 ${i + 1} 張講的事在隱私條款（${POLICY[lang]}）找不到 ${re}`);
            });
            const link = page.locator('[data-section="privacy"] [data-id="privacy.link"]');
            const href = (await link.count()) ? await link.evaluate((e) => (e.closest('a') || e).getAttribute('href')) : null;
            if (href !== 'https://jerromy.com/privacy/') bad.push(`${lang}：「看完整的隱私條款」要連到 https://jerromy.com/privacy/，得到 ${href}`);
            const dates = ((await page.locator('[data-section="privacy"]').textContent()) || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
            if (dates.length && fs.existsSync(PRIVACY_DIR)) {
                const want = (/(\d{4}-\d{2}-\d{2})/.exec(fs.readFileSync(path.join(PRIVACY_DIR, POLICY[lang]), 'utf8')) || [])[1];
                if (dates.some((d) => d !== want)) bad.push(`${lang}：08 寫的日期 ${dates.join('、')} 要跟隱私條款 ${want} 一樣（網站 08 是第五份拷貝）`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 08 的主詞限定為擴充或你存下的東西：網站本身會用 GoatCounter 數人次、放在 Cloudflare Pages 的伺服器上，
// 所以「沒有伺服器」「不追蹤」「不會離開這台電腦」都要講清楚是誰。每一條的每一個 regex 都要中（標題、導言、第 1、3 張卡的標題）。
const SUBJECT = {
    zh: { 'privacy.title': [/你(存|收集)的東西|存下(來)?的東西/], 'privacy.lead': [/擴充/, /存下|存的/], 'privacy.1.title': [/擴充/, /沒有伺服器/], 'privacy.3.title': [/擴充/, /不追蹤|沒有追蹤/] },
    en: { 'privacy.title': [/what you save/i], 'privacy.lead': [/extension/i, /what you save/i], 'privacy.1.title': [/extension/i, /no server/i], 'privacy.3.title': [/extension/i, /no tracking/i] },
    ja: { 'privacy.title': [/保存したもの/], 'privacy.lead': [/拡張機能/, /保存したもの/], 'privacy.1.title': [/拡張機能/, /サーバーなし/], 'privacy.3.title': [/拡張機能/, /追跡なし/] },
};

test('F6.3 08 的標題、導言、第 1、3 張卡講明主詞是擴充或你存下的東西（三語，字串表與畫出來的字）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [id, res] of Object.entries(SUBJECT[lang])) {
            for (const re of res) if (!re.test(say(lang, id))) bad.push(`${lang} 字串表 ${id}「${say(lang, id)}」沒講到 ${re}`);
        }
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            for (const [id, res] of Object.entries(SUBJECT[lang])) {
                const el = page.locator(`[data-section="privacy"] [data-id="${id}"]`);
                if (!(await el.count())) { bad.push(`${lang} 畫面：08 裡找不到 data-id="${id}"`); continue; }
                const text = (await el.first().textContent()).replace(/\s+/g, ' ').trim();
                for (const re of res) if (!re.test(text)) bad.push(`${lang} 畫面 ${id}「${text}」沒講到 ${re}`);
            }
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 「沒有追蹤」一類的話，同一句裡要有擴充當主詞（掃 08 每一條字串的純文字，逐句）
const NO_TRACK = {
    zh: { track: /(沒有|不|無|零|不會)追蹤|追蹤.{0,2}(沒有|無)/, subject: /擴充/ },
    en: { track: /no tracking|(not|n['’]t|never) track|zero tracking|tracking-free|without tracking/i, subject: /extension/i },
    ja: { track: /追跡(なし|ゼロ|しません|はしません|もしません|はありません|もありません|しない)|追跡も(、|\s)?[^。]*ありません|追跡のない/, subject: /拡張機能/ },
};
const SENTENCES = (s) => s.split(/(?<=[。．！？!?])|(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean);

test('F6.3 08 不寫沒有主詞的「No tracking／沒有追蹤」（三語，掃字串表 privacy.* 的純文字）', () => {
    const bad = [];
    for (const lang of LANGS) {
        const ids = Object.keys(JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))).filter((k) => k.startsWith('privacy.'));
        assert.ok(ids.length, `${lang}：字串表裡沒有 privacy.*`);
        for (const id of ids) {
            for (const s of SENTENCES(say(lang, id))) {
                if (NO_TRACK[lang].track.test(s) && !NO_TRACK[lang].subject.test(s)) bad.push(`${lang} ${id}：「${s}」講了不追蹤，但同一句沒講是擴充（網站本身會用 GoatCounter 數人次）`);
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 16 區頁尾那句（網站用 GoatCounter 數人次、擴充本身沒有任何追蹤）三語都在、同時講到 GoatCounter 與擴充：已轉成必過，在 f8-sections.test.js 的 F8.3。

test('F6.3 隱私條款的日期各處一致（release/privacy 四份、側邊欄 _locales 的 ui_privacyUpdated）', { skip: fs.existsSync(PRIVACY_DIR) ? false : '沒有 release/privacy（公開 repo）' }, () => {
    const dates = {};
    for (const f of fs.readdirSync(PRIVACY_DIR)) {
        const m = /(\d{4}-\d{2}-\d{2})/.exec(fs.readFileSync(path.join(PRIVACY_DIR, f), 'utf8'));
        dates[`release/privacy/${f}`] = m ? m[1] : null;
    }
    const locales = path.join(REPO, 'clipper', '_locales');
    if (fs.existsSync(locales)) {
        for (const l of fs.readdirSync(locales)) {
            const msg = JSON.parse(fs.readFileSync(path.join(locales, l, 'messages.json'), 'utf8')).ui_privacyUpdated?.message ?? '';
            dates[`_locales/${l} ui_privacyUpdated`] = (/(\d{4}-\d{2}-\d{2})/.exec(msg) || [])[1] ?? null;
        }
    }
    const values = [...new Set(Object.values(dates))];
    assert.equal(values.length, 1, `日期不一致：${JSON.stringify(dates)}`);
    assert.ok(values[0], '找不到日期');
});

// ---------- F6.5 ----------

const IDS_MOUSE = Object.keys(LINES.lines.zh['1440']);

for (const lang of LANGS) {
    test(`F6.5 05、06、08、15 的文案（${lang}，十二種寬度）：每一行跟設計稿一樣；說明文字照斷行規則`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                for (const id of IDS_MOUSE) {
                    const el = page.locator(`[data-id="${id}"]`).first();
                    if (!(await el.count())) { bad.push(`${width} ${id}：找不到`); continue; }
                    const got = await textLines(el);
                    const want = LINES.lines[lang][String(width)][id];
                    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${width} ${id}：網站 ${JSON.stringify(got)}，設計稿 ${JSON.stringify(want)}`);
                    if (!PROSE.includes(id)) continue;
                    for (const line of got) {
                        if (lang === 'en') { if (!/\s/.test(line)) bad.push(`${width} ${id}：一行只有一個字「${line}」`); continue; }
                        if ((wide(line) < 5 || wide(line) > 25) && !want.includes(line)) bad.push(`${width} ${id}：一行 ${wide(line)} 字寬（要 5～25）「${line}」`);
                        if (HEAD_PUNCT.test(line)) bad.push(`${width} ${id}：行首是孤標點「${line}」`);
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
    test(`F6.5 字到邊（${lang}）：06、08 每張卡、15 的手指框裡的字到框的內緣 ≥ 設計內距的一半`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                for (const sec of ['features', 'privacy']) {
                    const got = await page.evaluate(CARD_GEOMETRY, cardSel(sec));
                    const want = POS.cards[lang][String(width)][sec];
                    if (!got) { bad.push(`${width} ${sec}：找不到卡片`); continue; }
                    if (got.minGap < want.pad / 2) bad.push(`有滑鼠 ${width} ${sec}：字到卡片內緣最近 ${got.minGap}px，要 ≥ ${want.pad / 2}（設計內距 ${want.pad} 的一半；設計稿 ${want.minGap}）`);
                }
            } finally {
                await context.close();
            }
        }
        for (const width of [280, 320, 360, 375, 390, 414, 430]) {
            const { page, context } = await open(lang, width, { touch: true });
            try {
                const got = await page.evaluate(CARD_GEOMETRY, '[data-section="final"] [data-touch]');
                const want = POS.cardsTouch[lang][String(width)].final;
                if (!got) { bad.push(`只有手指 ${width}：找不到 15 區的手指框`); continue; }
                if (got.minGap < want.pad / 2) bad.push(`只有手指 ${width} 15 區手指框：字到框的內緣最近 ${got.minGap}px，要 ≥ ${want.pad / 2}（設計內距 ${want.pad} 的一半；設計稿 ${want.minGap}）`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F6.5 通用（${lang}，十二種寬度、減少動態）：不橫捲、區塊不重疊、44×44、捲到之後沒有在跑的動畫`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try {
                for (const sec of ['how', 'features', 'privacy', 'final']) {
                    const s = page.locator(`[data-section="${sec}"]`);
                    if (!(await s.count())) { bad.push(`${width}：找不到 [data-section="${sec}"]`); continue; }
                    await s.evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
                    await page.waitForTimeout(100);
                    const r = await s.evaluate((root) => {
                        const blocks = [...root.querySelectorAll('[data-id]')].filter((e) => e.checkVisibility() && !e.parentElement.closest('[data-id]')).map((e) => ({ id: e.dataset.id, r: e.getBoundingClientRect() }));
                        const hits = [];
                        for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
                            const a = blocks[i].r;
                            const b = blocks[j].r;
                            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) hits.push(`${blocks[i].id}／${blocks[j].id}`);
                        }
                        const small = [...root.querySelectorAll('a, button')].filter((e) => e.checkVisibility())
                            .map((e) => ({ t: e.textContent.trim().slice(0, 12), r: e.getBoundingClientRect() })).filter((x) => x.r.width < 43.5 || x.r.height < 43.5).map((x) => `${x.t}（${Math.round(x.r.width)}×${Math.round(x.r.height)}）`);
                        const running = root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length;
                        return { hits, small, running };
                    });
                    if (r.hits.length) bad.push(`${width} ${sec}：重疊 ${r.hits.join('、')}`);
                    if (r.small.length) bad.push(`${width} ${sec}：小於 44×44 ${r.small.join('、')}`);
                    if (r.running) bad.push(`${width} ${sec}：減少動態時有 ${r.running} 個在跑的動畫`);
                }
                const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                if (scroll > 0) bad.push(`${width}：整頁橫捲 ${scroll}px`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

test('F6.5 關掉 JS（三語 390、1440）：05、06、08、15 每一段字都在、看得到', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { js: false });
            try {
                for (const id of IDS_MOUSE) {
                    const el = page.locator(`[data-id="${id}"]`).first();
                    if (!(await el.count())) { bad.push(`${lang} ${width}：${id} 不在`); continue; }
                    if (id === 'final.cta') continue;
                    if (!(await el.isVisible())) bad.push(`${lang} ${width}：${id} 看不到`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F6.5 區塊順序與錨點（三語）：hero → where → how → features → forai → privacy → final，#features 在', { skip: pw ? false : why }, async () => {
    const want = ['hero', 'where', 'how', 'features', 'forai', 'privacy', 'final'];
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440, { js: false });
        try {
            const order = await page.evaluate((ids) => [...document.querySelectorAll('[data-section]')].map((e) => e.dataset.section).filter((s) => ids.includes(s)), want);
            assert.deepEqual(order, want, `${lang}：區塊順序`);
            assert.equal(await page.locator('#features').count(), 1, `${lang}：導覽列的 #features 要連得到（06 的 id）`);
        } finally {
            await context.close();
        }
    }
});

// #tutorial（09 教學影片）已轉成必過，在 tutorial.test.js 的 F7.5「錨點與順序」；#devices、#news、#changelog、#faq（10～13）在 f8-sections.test.js 的 F8.6「區塊順序與錨點」
