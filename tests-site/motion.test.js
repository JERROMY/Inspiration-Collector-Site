// F4.3 動態 A、B、D（設計稿第三批的 動態.md、motion.js、notes/4-2.md；A、B、D 跟第二批一樣），與 C 不放。讀 out/（真的內容），真的開瀏覽器。
//
// 介面（README.md「03 首屏、04 能用在哪裡」）：A 拆出來的每個字是括號裡（hero.title 的 .clamp）的一個 data-char 元素，順序從 Math.random 來；
//   B 的三個 0 各是一個 data-zero（會動的那個數字，外層把它裁掉）；D 的括號角畫在 data-corners 元素的 ::after。
//
// 量什麼（每一頁開頁前覆寫 Math.random 成固定種子的亂數，順序就固定；每一幀記一次）：
//   F4.3 A（三語 1440）：拆出來的字數＝括號裡那半句不含空白的字數；拆出來的那一刻每個字都是透明的；每個字都會冒出來（透明度過 0.5）；
//        冒出來的時刻分散在 200～1000ms 的窗裡（不是同時、也不拖太久）、不是照字的順序；2.5 秒後每個字透明度 1、顏色跟大標其他的字一樣；
//        括號從頭到尾透明度 1、身上沒有動畫（括號靜態）；第一個字冒出來時拉丁字型已經載好。
//   F4.3 A：同一個種子兩次每個字的 --k（拆字時寫上的出場位置）一樣、換一個種子不一樣（順序真的從 Math.random 來；讀 --k，不看每一幀的透明度）。
//   F4.3 A：字型晚到：扣住字型 600ms 再放 → 第一個字在字型載好之後才冒；字型擋掉 → 最多約 1 秒就照樣開始（DOMContentLoaded 後 1.5 秒內有字冒出來），3 秒後每個字都在。
//   F4.3 A：拆字不改變斷行 —— 三語 × 320、390、1024、1440，播完之後大標的每一行跟關掉 JS 時一樣。
//   F4.3 A：關掉 JS 完整顯示 —— 括號裡的字完整、看得到（透明度 1、顏色不是透明）。
//   F4.3 B（1440×900）：04 一開始在畫面外，三個 0 都在上面一格（位移約 −100%）；捲到 04 之後依序（第一、二、三個）滾到 0、1.5 秒內停好；
//        從頭到尾每個 data-zero 的字都只有「0」（不編數字）；捲走再捲回來不再播一次。
//   F4.3 D（1440×360）：首屏的媒體框一開始在畫面外，::after 的 scale 1.03、透明度 0；捲到看得到 1 秒後 scale 1、透明度 1；捲走再捲回來不再播。
//   F4.3 減少動態（三語 1440×360）：沒有拆字（0 個 data-char）、沒有在跑的動畫；捲動之前三個 0 已經在 0、括號角已經是 scale 1、透明度 1。
//   F4.3 只動 opacity／transform／顏色、CLS 0：開頁、捲到 04 的整段（字型擋掉），每一幀看到的動畫（CSS 轉場與動畫）只動透明度、位移縮放旋轉、顏色；layout-shift 總和 0。
//   F4.3 C 不放（設計定稿的決定）：捲下去之後頁面底色、04 的底色跟捲動之前一樣。
//   F4.3 A'（2026-10-07 使用者加的；public/motion.js、components/Final/Final.module.css）：15 最後的安裝，大標括號裡那半句（final.title 的 .clamp）——
//        React 接手之後拆字（字數＝括號裡不含空白的字數）、大標加 data-a="wait"，每個字透明（藏起來等）；大標露出四成時還在等，露出六成以上才換 data-a="go"、
//        隨機冒出來；2.5 秒後括號裡的字都看得到（透明度 1、顏色跟大標其他的字一樣，字一個不少）；捲走再捲回來不再播（停在 go）。
//        減少動態（三語）：不拆字、沒有 data-a、字一開始就看得到。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.3"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession, strings, plain } from './helpers.js';
import { heroParts, textLines, CLS_SCRIPT } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const clampText = (lang) => plain(/⟨(.*)⟩/.exec(strings[lang]['hero.title'])[1]);
const charCount = (lang) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clampText(lang).replace(/\s+/g, ''))).length;

// 每一幀記一次：A 的每個字第一次透明度過 0.5 的時刻、拆字那一刻是不是全透明、括號的透明度與動畫、拉丁字型載好的時刻、看到的動畫動了哪些屬性
const SAMPLER = (seed) => {
    if (seed !== null) {
        let s = seed >>> 0;
        Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    }
    const m = { chars: {}, k: null, split: 0, initialHidden: null, fontAt: null, dcl: null, brk: { frames: 0, notOpaque: 0, anims: 0 }, bad: [], zeros: [], frames: 0 };
    window.__m = m;
    addEventListener('DOMContentLoaded', () => { m.dcl = performance.now(); });
    const ALLOWED = /^(opacity|transform|translate|scale|rotate|color|background-color|border-(top-|right-|bottom-|left-)?color|border-color|outline-color|text-decoration-color|fill|stroke|-webkit-text-fill-color)$/;
    const tick = () => {
        m.frames += 1;
        const now = performance.now();
        if (m.fontAt === null && [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Google Sans Flex' && f.status === 'loaded')) m.fontAt = now;
        const chars = document.querySelectorAll('[data-section="hero"] [data-id="hero.title"] [data-char]');
        if (chars.length && m.initialHidden === null) m.initialHidden = [...chars].every((c) => parseFloat(getComputedStyle(c).opacity) < 0.1);
        // 每個字的出場位置（--k，拆字時寫上的 0～1）：拆字那一刻記一次（播完會換回純文字）
        if (chars.length && m.k === null) m.k = [...chars].map((c) => (c.style.getPropertyValue('--k') || getComputedStyle(c).getPropertyValue('--k')).trim());
        m.split = Math.max(m.split, chars.length);
        chars.forEach((c, i) => { if (m.chars[i] === undefined && parseFloat(getComputedStyle(c).opacity) >= 0.5) m.chars[i] = now; });
        for (const b of document.querySelectorAll('[data-section="hero"] [data-id="hero.title"] .brk')) {
            m.brk.frames += 1;
            if (getComputedStyle(b).opacity !== '1') m.brk.notOpaque += 1;
            m.brk.anims += b.getAnimations().length;
        }
        for (const a of document.getAnimations()) {
            const props = a.transitionProperty ? [a.transitionProperty]
                : (a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)) : []);
            for (const p of props) {
                const name = p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
                if (!ALLOWED.test(name) && !m.bad.includes(name)) m.bad.push(name);
            }
        }
        document.querySelectorAll('[data-section="where"] [data-zero]').forEach((z, i) => {
            const r = z.getBoundingClientRect();
            const p = z.parentElement.getBoundingClientRect();
            m.zeros.push({ t: now, i, off: r.height ? (r.top - p.top) / r.height : 0, text: z.textContent });
        });
        if (now < 30000) requestAnimationFrame(tick);   // 原本 8 秒：機器忙時開頁就用掉大半，捲到 04 時已經不記了（量過一次「三個 0 都要滾到定位，得到 Infinity」）
    };
    requestAnimationFrame(tick);
};

async function open(lang, { width = 1440, height = 900, seed = 1, context: extra = {}, hold = false, noFonts = false, init = [] } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, ...extra });
    if (noFonts) await context.route('**/*.woff2', (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    if (extra.javaScriptEnabled !== false) await page.addInitScript(SAMPLER, seed);
    for (const script of init) await page.addInitScript(script);
    if (hold) site.holdFonts();
    await page.goto(`${site.url}/${lang}/`, { waitUntil: hold ? 'domcontentloaded' : 'load' });
    return { site, page, context, h: heroParts(page) };
}

const result = (page) => page.evaluate(() => window.__m);
const order = (m) => Object.entries(m.chars).sort((a, b) => a[1] - b[1]).map(([i]) => Number(i));

for (const lang of LANGS) {
    test(`F4.3 A（${lang} 1440）：括號裡的字以隨機順序冒出來一次、之後靜止；括號靜態；等字型`, { skip: pw ? false : why }, async () => {
        const { page, context, h } = await open(lang);
        try {
            await page.waitForTimeout(2500);
            const m = await result(page);
            const n = charCount(lang);
            assert.equal(m.split, n, `括號裡那半句要拆成 ${n} 個 data-char（「${clampText(lang)}」不含空白），得到 ${m.split}`);
            assert.equal(m.initialHidden, true, '拆字那一刻每個字都要是透明的（之後才一個一個冒出來）');
            const times = Object.values(m.chars);
            assert.equal(times.length, n, `每個字都要冒出來（透明度過 0.5），只看到 ${times.length} 個`);
            const spread = Math.max(...times) - Math.min(...times);
            assert.ok(spread >= 200 && spread <= 1000, `冒出來的時刻要分散在一個窗裡（200～1000ms），得到 ${Math.round(spread)}ms`);
            const seq = order(m);
            assert.notDeepEqual(seq, [...seq].sort((a, b) => a - b), `冒出來的順序不能照字的順序（要隨機），得到 ${seq}`);
            assert.ok(m.fontAt !== null && Math.min(...times) >= m.fontAt - 20, `第一個字要在拉丁字型載好之後才冒（字型 ${Math.round(m.fontAt)}ms、第一個字 ${Math.round(Math.min(...times))}ms）`);
            assert.ok(m.brk.frames > 0, '防呆：大標的括號（.brk）量不到');
            assert.equal(m.brk.notOpaque, 0, '括號從頭到尾透明度 1（一開始就在定位）');
            assert.equal(m.brk.anims, 0, '括號身上不能有動畫（括號靜態）');
            const final = await h.block('hero.title').evaluate((title) => {
                const base = getComputedStyle(title).color;
                const chars = [...title.querySelectorAll('.clamp [data-char]')];
                return { base, text: title.querySelector('.clamp').textContent, chars: chars.map((c) => ({ op: getComputedStyle(c).opacity, color: getComputedStyle(c).color })) };
            });
            assert.equal(final.text.replace(/\s+/g, ' ').trim(), clampText(lang), '播完括號裡的字要完整');
            assert.ok(final.chars.every((c) => c.op === '1' && c.color === final.base), `播完每個字透明度 1、顏色跟大標其他的字一樣（${final.base}），得到 ${JSON.stringify(final.chars.slice(0, 3))}…`);
        } finally {
            await context.close();
        }
    });
}

// 讀每個字的 --k（出場位置），不看每一幀的透明度：相鄰兩個字的出場時間最少只差約 11ms，比一幀短，機器一忙看到的先後會對調（量過）
test('F4.3 A：順序從 Math.random 來（同一個種子兩次每個字的 --k 一樣、換種子不一樣）', { skip: pw ? false : why }, async () => {
    const runs = [];
    for (const seed of [7, 7, 12345]) {
        const { page, context } = await open('en', { seed });
        try {
            await page.waitForFunction(() => window.__m && window.__m.k !== null, null, { timeout: 4000 }).catch(() => {});
            runs.push((await result(page)).k ?? []);
        } finally {
            await context.close();
        }
    }
    assert.ok(runs[0].length >= 10, `防呆：英文括號裡拆出來的字太少（${runs[0].length}）`);
    assert.ok(runs.flat().every((k) => k !== '' && Number.isFinite(Number(k))), `每個字都要有數字的 --k，得到 ${runs[0].slice(0, 5).join('、')}…`);
    assert.deepEqual(runs[1], runs[0], '同一個種子兩次，每個字的 --k 要一樣（順序只從 Math.random 來）');
    assert.notDeepEqual(runs[2], runs[0], '換一個種子 --k 要不一樣');
});

test('F4.3 A：字型晚到 —— 扣住 600ms 就等字型；字型擋掉最多約 1 秒照樣開始', { skip: pw ? false : why }, async () => {
    {
        const { site, page, context } = await open('zh', { hold: true });
        try {
            await page.waitForTimeout(600);
            site.releaseFonts();
            await page.waitForTimeout(2500);
            const m = await result(page);
            const times = Object.values(m.chars);
            assert.equal(times.length, charCount('zh'), '字型晚到：每個字最後都要冒出來');
            assert.ok(m.fontAt !== null && Math.min(...times) >= m.fontAt - 20, `字型晚到：第一個字要等字型載好（字型 ${Math.round(m.fontAt)}ms、第一個字 ${Math.round(Math.min(...times))}ms）`);
        } finally {
            site.releaseFonts();
            await context.close();
        }
    }
    {
        const { page, context } = await open('zh', { noFonts: true });
        try {
            await page.waitForTimeout(3000);
            const m = await result(page);
            const times = Object.values(m.chars);
            assert.equal(times.length, charCount('zh'), '字型擋掉：3 秒後每個字都要在');
            assert.ok(Math.min(...times) <= m.dcl + 1500, `字型擋掉：最多約 1 秒就要照樣開始（DOMContentLoaded ${Math.round(m.dcl)}ms、第一個字 ${Math.round(Math.min(...times))}ms）`);
        } finally {
            await context.close();
        }
    }
});

test('F4.3 A：拆字不改變斷行（三語 × 320、390、1024、1440，播完跟關掉 JS 一樣）', { skip: pw ? false : why }, async () => {
    const diff = [];
    for (const lang of LANGS) {
        for (const width of [320, 390, 1024, 1440]) {
            const on = await open(lang, { width });
            const off = await open(lang, { width, context: { javaScriptEnabled: false } });
            try {
                await on.page.waitForTimeout(2500);
                await off.page.evaluate(() => document.fonts.ready);
                const a = await textLines(on.h.block('hero.title'));
                const b = await textLines(off.h.block('hero.title'));
                if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`${lang} ${width}：拆字後 ${a.join(' ／ ')}；沒拆 ${b.join(' ／ ')}`);
            } finally {
                await on.context.close();
                await off.context.close();
            }
        }
    }
    assert.deepEqual(diff, [], '拆字前後大標的斷行要一樣');
});

test('F4.3 A：關掉 JS 時括號裡的字完整、看得到（三語）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { context: { javaScriptEnabled: false } });
        try {
            const got = await h.clamp.evaluate((clamp) => {
                const hidden = [];
                for (let el = clamp; el; el = el.parentElement) if (parseFloat(getComputedStyle(el).opacity) < 1) hidden.push(el.tagName);
                return { text: clamp.textContent, color: getComputedStyle(clamp).color, hidden, chars: clamp.querySelectorAll('[data-char]').length };
            });
            assert.equal(got.text.replace(/\s+/g, ' ').trim(), clampText(lang), `${lang}：括號裡的字要完整`);
            assert.deepEqual(got.hidden, [], `${lang}：括號裡的字要看得到（沒有透明的外層）`);
            assert.notEqual(got.color, 'rgba(0, 0, 0, 0)', `${lang}：括號裡的字不能是透明色`);
            assert.equal(got.chars, 0, `${lang}：關掉 JS 時沒有拆字`);
            assert.ok(await page.locator('[data-section="hero"]').isVisible(), '首屏要在');
        } finally {
            await context.close();
        }
    }
});

async function cornerState(frame) {
    return frame.evaluate((el) => {
        const s = getComputedStyle(el, '::after');
        const scale = s.scale === 'none' ? 1 : parseFloat(s.scale);
        const m = s.transform === 'none' ? 1 : new DOMMatrix(s.transform).a;
        return { scale: Math.round(scale * m * 1000) / 1000, opacity: parseFloat(s.opacity), content: s.content };
    });
}

test('F4.3 減少動態（三語 1440×360）：A、B、D 直接是最後的樣子', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { height: 360, context: { reducedMotion: 'reduce' } });
        try {
            await page.waitForTimeout(1200);
            const m = await result(page);
            assert.equal(m.split, 0, `${lang}：減少動態時不拆字（0 個 data-char）`);
            const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration ?? 0) > 1).length);
            assert.equal(running, 0, `${lang}：減少動態時沒有在跑的動畫`);
            assert.equal(await h.zeros.count(), 3, `${lang}：04 要有三個 data-zero`);
            const offs = await h.zeros.evaluateAll((zs) => zs.map((z) => Math.round((z.getBoundingClientRect().top - z.parentElement.getBoundingClientRect().top) * 10) / 10));
            assert.deepEqual(offs, [0, 0, 0], `${lang}：減少動態時三個 0 一開始就在定位`);
            const c = await cornerState(h.frame);
            assert.ok(c.content !== 'none', `${lang}：媒體框（data-corners）的括號角要畫在 ::after`);
            assert.deepEqual([c.scale, c.opacity], [1, 1], `${lang}：減少動態時括號角一開始就是 scale 1、透明度 1`);
        } finally {
            await context.close();
        }
    }
});

// ---------- A'：15 最後的安裝的大標（2026-10-07 加） ----------

const finalText = (lang) => plain(/⟨(.*)⟩/.exec(strings[lang]['final.title'])[1]);
const finalCount = (lang) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(finalText(lang).replace(/\s+/g, ''))).length;
const FINAL = '[data-section="final"] [data-id="final.title"]';

// 15 大標：data-a、拆出來的字（透明度）、括號裡的字、跟大標其他字的顏色比
const FINAL_STATE = (sel) => {
    const title = document.querySelector(sel);
    const clamp = title?.querySelector('.clamp');
    if (!title || !clamp) return null;
    const chars = [...clamp.querySelectorAll('[data-char]')];
    const r = title.getBoundingClientRect();
    // 大標裡括號外面的字（拿來比顏色）
    let other = null;
    const walk = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) if (walk.currentNode.data.trim() && !clamp.contains(walk.currentNode)) { other = getComputedStyle(walk.currentNode.parentElement).color; break; }
    return {
        a: title.getAttribute('data-a'),
        n: chars.length,
        opacity: chars.map((c) => parseFloat(getComputedStyle(c).opacity)),
        colors: [...new Set((chars.length ? chars : [clamp]).map((c) => getComputedStyle(c).color))],
        other,
        text: clamp.textContent.replace(/\s+/g, ''),
        visible: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height,
    };
};

// 把 15 大標捲到露出 ratio（從畫面下緣露出來）
const showFinal = (page, ratio) => page.evaluate(([sel, k]) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - (innerHeight - r.height * k), behavior: 'instant' });
}, [FINAL, ratio]);

test("F4.3 A'（三語 1440×900）：15 大標括號裡的字拆好後藏著等、露出六成才隨機冒出來、之後都看得到、只播一次", { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context } = await open(lang);
        try {
            const wait = await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-a') === 'wait', FINAL, { timeout: 5000 }).then(() => true, () => false);
            let st = await page.evaluate(FINAL_STATE, FINAL);
            if (!wait) { bad.push(`${lang}：React 接手之後大標要加 data-a="wait"（拆好、藏著等），得到 ${st?.a}`); continue; }
            if (st.n !== finalCount(lang)) bad.push(`${lang}：括號裡那半句要拆成 ${finalCount(lang)} 個 data-char（「${finalText(lang)}」不含空白），得到 ${st.n}`);
            if (st.opacity.some((o) => o > 0.1)) bad.push(`${lang}：還沒捲到時拆出來的字要藏著（透明），得到透明度 ${[...new Set(st.opacity)].join('、')}`);
            await showFinal(page, 0.4);
            await page.waitForTimeout(600);
            st = await page.evaluate(FINAL_STATE, FINAL);
            if (st.a !== 'wait') bad.push(`${lang}：大標只露出 ${Math.round(st.visible * 100)}% 時還不能開始（要露出六成），得到 data-a="${st.a}"`);
            await showFinal(page, 1);
            const go = await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('data-a') === 'go', FINAL, { timeout: 3000 }).then(() => true, () => false);
            if (!go) { bad.push(`${lang}：大標整個露出來之後要換 data-a="go"`); continue; }
            await page.waitForTimeout(2500);
            st = await page.evaluate(FINAL_STATE, FINAL);
            if (st.opacity.some((o) => o < 1)) bad.push(`${lang}：2.5 秒後括號裡每個字都要看得到（透明度 1），得到 ${[...new Set(st.opacity)].join('、')}`);
            if (st.colors.length !== 1 || st.colors[0] !== st.other) bad.push(`${lang}：2.5 秒後括號裡的字顏色要跟大標其他的字一樣（${st.other}），得到 ${st.colors.join('、')}`);
            if (st.text !== finalText(lang).replace(/\s+/g, '')) bad.push(`${lang}：括號裡的字要一個不少，得到「${st.text}」`);
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
            await page.waitForTimeout(300);
            await showFinal(page, 1);
            await page.waitForTimeout(300);
            st = await page.evaluate(FINAL_STATE, FINAL);
            if (st.a !== 'go' || st.opacity.some((o) => o < 1)) bad.push(`${lang}：捲走再捲回來不能再播一次（data-a ${st.a}、透明度 ${[...new Set(st.opacity)].join('、')}）`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test("F4.3 A' 減少動態（三語 1440×900）：15 大標不拆字、沒有 data-a、括號裡的字一開始就看得到", { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context } = await open(lang, { context: { reducedMotion: 'reduce' } });
        try {
            await page.waitForTimeout(1500);
            await showFinal(page, 1);
            await page.waitForTimeout(300);
            const st = await page.evaluate(FINAL_STATE, FINAL);
            if (!st) { bad.push(`${lang}：找不到 ${FINAL} .clamp`); continue; }
            if (st.a !== null) bad.push(`${lang}：減少動態時大標不能有 data-a，得到「${st.a}」`);
            if (st.n) bad.push(`${lang}：減少動態時不拆字，得到 ${st.n} 個 data-char`);
            if (st.text !== finalText(lang).replace(/\s+/g, '')) bad.push(`${lang}：括號裡的字要完整，得到「${st.text}」`);
            const shown = await page.locator(`${FINAL} .clamp`).evaluate((c) => parseFloat(getComputedStyle(c).opacity) === 1 && getComputedStyle(c).color !== 'rgba(0, 0, 0, 0)');
            if (!shown) bad.push(`${lang}：減少動態時括號裡的字要看得到`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F4.3 B（1440×900，三語）：捲到 04，三個 0 依序從上面一格滾下來停在 0、只播一次、只有「0」', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang);
        try {
            assert.ok((await h.where.boundingBox()).y > 900, `${lang}：防呆：04 一開始要在畫面外`);
            assert.equal(await h.zeros.count(), 3, `${lang}：04 要有三個 data-zero`);
            await page.waitForTimeout(300);
            const before = await h.zeros.evaluateAll((zs) => zs.map((z) => (z.getBoundingClientRect().top - z.parentElement.getBoundingClientRect().top) / z.getBoundingClientRect().height));
            assert.ok(before.every((o) => o < -0.9), `${lang}：捲到之前三個 0 都在上面一格（約 −100%），得到 ${before.map((o) => o.toFixed(2))}`);
            const t0 = await page.evaluate(() => performance.now());
            await h.where.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(1500);
            const m = await result(page);
            const after = m.zeros.filter((z) => z.t >= t0);
            const reach = [0, 1, 2].map((i) => after.find((z) => z.i === i && z.off >= -0.5)?.t ?? Infinity);
            assert.ok(reach.every(Number.isFinite), `${lang}：三個 0 都要滾到定位，得到 ${reach.map((t) => Math.round(t - t0))}`);
            assert.ok(reach[0] < reach[1] && reach[1] < reach[2], `${lang}：三個 0 要依序（第一、二、三個），到半格的時刻 ${reach.map((t) => Math.round(t - t0))}ms`);
            const last = [0, 1, 2].map((i) => after.filter((z) => z.i === i).pop().off);
            assert.ok(last.every((o) => Math.abs(o) < 0.01), `${lang}：1.5 秒內停在 0，得到 ${last.map((o) => o.toFixed(3))}`);
            assert.deepEqual([...new Set(m.zeros.map((z) => z.text))], ['0'], `${lang}：從頭到尾只有「0」（不編別的數字）`);
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            await page.waitForTimeout(300);
            const t1 = await page.evaluate(() => performance.now());
            await h.where.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(600);
            const again = (await result(page)).zeros.filter((z) => z.t >= t1);
            assert.ok(again.length > 0 && again.every((z) => Math.abs(z.off) < 0.01), `${lang}：捲走再捲回來不再播一次（一直在 0）`);
        } finally {
            await context.close();
        }
    }
});

test('F4.3 D（1440×360，三語）：媒體框的括號角捲到才對焦一次（scale 1.03 → 1、透明度 0 → 1）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { height: 360 });
        try {
            assert.ok((await h.frame.boundingBox()).y > 360, `${lang}：防呆：媒體框一開始要在畫面外`);
            await page.waitForTimeout(300);
            const before = await cornerState(h.frame);
            assert.ok(before.content !== 'none', `${lang}：括號角要畫在 data-corners 的 ::after`);
            assert.deepEqual([before.scale, before.opacity], [1.03, 0], `${lang}：捲到之前括號角在框外（scale 1.03）、透明度 0`);
            await h.frame.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(1000);
            assert.deepEqual(Object.values(await cornerState(h.frame)).slice(0, 2), [1, 1], `${lang}：捲到 1 秒後括號角收到框邊（scale 1）、透明度 1`);
            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await page.waitForTimeout(300);
            await h.frame.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(50);
            assert.deepEqual(Object.values(await cornerState(h.frame)).slice(0, 2), [1, 1], `${lang}：捲走再捲回來不再播（一直是 scale 1、透明度 1）`);
        } finally {
            await context.close();
        }
    }
});

test('F4.3 動態只動 opacity／transform／顏色，CLS 0（三語 1440，字型擋掉，開頁＋捲到 04）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang, { noFonts: true, init: [CLS_SCRIPT] });
        try {
            await page.waitForTimeout(1500);
            await h.where.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForTimeout(1500);
            const m = await result(page);
            assert.deepEqual(m.bad, [], `${lang}：動畫只能動透明度、位移縮放旋轉、顏色，看到動了這些`);
            const { cls, shifts } = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
            assert.equal(cls, 0, `${lang}：CLS 要是 0，得到 ${cls}：${JSON.stringify(shifts)}`);
        } finally {
            await context.close();
        }
    }
});

test('F4.3 C 不放：捲下去之後頁面底色、04 的底色不變（三語 1440）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, h } = await open(lang);
        try {
            const colors = () => page.evaluate(() => [document.documentElement, document.body, document.querySelector('[data-section="where"]')].map((el) => getComputedStyle(el).backgroundColor));
            const top = await colors();
            await h.where.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
            await page.waitForTimeout(400);
            const mid = await colors();
            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await page.waitForTimeout(400);
            assert.deepEqual(mid, top, `${lang}：捲到 04 時底色變了（動態 C 不放）`);
            assert.deepEqual(await colors(), top, `${lang}：捲到底時底色變了（動態 C 不放）`);
        } finally {
            await context.close();
        }
    }
});
