// F9.1～F9.3 07 右邊「AI 開始打字」。讀 out/（真的內容），真的開瀏覽器。
// 依據：設計稿 90de030 的 動態.md「07 為 AI 做的」最後一列（樹長完之後逐字打出來；減少動態、關掉 JS 只有靜態大綱圖）、規格書 §8、§9、§12、§14，
// 與派工人員 2026-10-04 的決定（打靜態大綱圖上那一段、速度與停頓、游標、框裡的長相、HTML 不變大、代表組合）。
// 要打的字：fixtures/typing-f9.json 的 excerpt —— 靜態大綱圖上那一段（tutorial/13-ai.js 的 REPORT.first 套在 data/agent.<語言>.json 的 outline 上，不是前 12 行）。
// 靜態大綱圖上字的位置與框：fixtures/design-f9-c41f0dd.json（tools/measure-design.mjs --only f9）。
//
// 2026-10-07 為什麼改（派工人員決定）：
//   - F9.3 框的位置改用較晚的設計稿 c41f0dd 重量（F5.4 逐行比對 07 用的就是這一份）。原本的 90de030（10-04 10:36）07 大標在中文 320 排 4 行，
//     c41f0dd（10-04 23:11）排 3 行、網站照它排，於是中文 320、日文 414、640 的框差 40～60px（重量之後只有這三格變，show、imageText 不變）。舊的 design-f9-90de030.json 刪掉。
//   - F9.1 HTML 大小的基準從 c046013（f8b）換成 9f0594c：三語填了真的影片 ID 之後 09 多了有影片的標記（gzip 約 +850），其餘 +682～814 在 01aa2e0 就已經多了；
//     要打的字照樣沒放進 HTML。上限 512 照舊。原因也寫在 fixtures/typing-f9.json 的 source。
//
// 介面（README.md「07 右邊 AI 開始打字（F9）」，前端照這個做）：
//   框：07 裡唯一的 [data-corners]，靜態大綱圖（src 有 ai-outline、alt＝forai.outline.alt）永遠在裡面。
//   [data-typing]：框裡、蓋在圖上的打字層（跟圖的那一塊同位置同大小、不透明的底、aria-hidden="true"、不在 live region 裡），
//     data-src="/<語言>/typing.json"（build 時產生的 { "text": 要打的字 }；字不放進 HTML）。送出來的 HTML 裡看不到它。
//   [data-typed]：[data-typing] 裡面，textContent＝已經打出來的字（excerpt 的開頭一段）；游標是裡面一個 [data-caret]（沒有字）。
//   時間：樹的七行都長出來那一幀算 0；第一個字 400ms；之後每個字 30ms、換行那一步 150ms；第一個字到最後一個字超過 6 秒時，所有間隔等比例縮到剛好 6 秒。打完停住，不重打。
//   游標：2px 寬、一個字高、--color-accent-lime-default 的實心塊、不閃（沒有動畫、透明度 1）；打字中在最後一個字後面，打完拿掉。
//   打完的樣子：字用 --font-mono；長行自動換行、超過框高的裁掉（overflow: hidden、不捲動）；第一行字的左緣、上緣、下緣跟靜態大綱圖上的差 ≤ 6px。
//   減少動態、關掉 JS：打字層看不到、不抓 typing.json，只有圖。程式：public/typing.js（defer），gzip ≤ 3 KB。
//
// 量什麼（案例全文在 README）：
//   F9.1 結構（三語，關掉 JS）、typing.json 的字、HTML 大小（不算 Next.js 接手用的資料，gzip 不比基準 9f0594c 大 512 位元組以上；2026-10-07 前是 f8b）。
//   F9.1 時間、游標、打完的樣子（代表組合：中文只有手指 390、英文 1440、日文 320；page.clock）。
//   F9.2 減少動態、關掉 JS（同上三組）；離開再回來與切到背景（英文 1440）；換語言（中文 1440 → 英文）；打到一半改寬度（日文）。
//   F9.3 通用（三語 × 十二種寬度：不橫捲、不壓字、框與打字層照設計稿、CLS 0、只動 opacity／transform）；長工作（中文 390 CPU 慢 4 倍、英文 1440）；JS 預算與原始碼。
//   （CSS 只用語意 token、不寫死色碼：F1.5、F3.9；HTML 沒有自己寫的內嵌腳本：F3.9 —— 這裡不重複。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F9"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SITE, LANGS, playwright, browserSession, readOut, tagAttrs, listFiles } from './helpers.js';
import { WIDTHS, parts, pool } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';

const FIX = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'typing-f9.json'), 'utf8'));
const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-f9-c41f0dd.json'), 'utf8'));
const AGENT = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'data', `agent.${lang}.json`), 'utf8'))]));
const TOUCH = { isMobile: true, hasTouch: true };
const SEC = '[data-section="forai"]';
const BUDGET = 3 * 1024;
const HTML_SLACK = 512;
const TOL = 50;   // 時間的容許（ms）：假時鐘一幀 16ms，偵測樹長完可能晚一幀
// 代表組合：[語言, 寬, 只有手指]
const REPS = [['zh', 390, true], ['en', 1440, false], ['ja', 320, false]];
const label = ([lang, width, touch]) => `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}`;
// 打字層蓋的是圖上的「文字欄」：標題列（OUTLINE.md）下緣、行號欄右邊起到圖的那一塊的右下角（原圖像素；設計審查 2026-10-04：標題列與行號欄留給圖）
const TEXT_AREA = { x: 347, y: 207 };
// 圖的那一塊 [x, y, 寬, 高] → 文字欄在畫面上的 [x, y, 寬, 高]
function textArea(crop, width) {
    if (!crop) return null;
    const show = width >= DESIGN.show.wideFrom ? DESIGN.show.wide : DESIGN.show.narrow;
    const k = crop[2] / show.width;
    const dx = (TEXT_AREA.x - show.x) * k;
    const dy = (TEXT_AREA.y - show.y) * k;
    const round = (n) => Math.round(n * 10) / 10;
    return [round(crop[0] + dx), round(crop[1] + dy), round(crop[2] - dx), round(crop[3] - dy)];
}

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

// 每一個字什麼時候出來：樹長完那一幀算 0。回傳每個字（照 Array.from 切）出來的時刻、打到那個字時 textContent 的長度
function schedule(text) {
    const chars = Array.from(text);
    const gaps = chars.map((c, i) => (i === 0 ? 0 : c === '\n' ? 150 : 30));
    const total = gaps.reduce((a, b) => a + b, 0);
    const s = Math.min(1, 6000 / total);
    let t = 400;
    let len = 0;
    return { total, scale: s, steps: chars.map((c, i) => { t += gaps[i] * s; len += c.length; return { c, t, len }; }) };
}

// 每一幀記一次（goto 之前 addInitScript；有 page.clock 時 performance.now 也是假的）。text 是這一語要打的字
const SAMPLER = (text) => {
    const m = { treeHidden: false, treeDoneAt: null, changes: [], last: '', resets: [], notPrefix: '', shifts: [], longtasks: [], vis: [], badProps: [],
        caret: { frames: 0, bad: '', afterDone: 0 } };
    window.__t = m;
    document.addEventListener('visibilitychange', () => m.vis.push(document.visibilityState));
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) m.shifts.push({ t: e.startTime, v: e.value, nodes: (e.sources ?? []).map((s) => s.node && (s.node.id || (typeof s.node.className === 'string' && s.node.className) || s.node.nodeName)).filter(Boolean) });
        }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* 不支援就沒有紀錄 */ }
    try {
        new PerformanceObserver((list) => { for (const e of list.getEntries()) m.longtasks.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true });
    } catch { /* 同上 */ }
    const OK = /^(opacity|transform|translate|scale|rotate)$/;
    let lime = null;
    const limeColor = () => {
        if (lime) return lime;
        const probe = document.createElement('i');
        probe.style.cssText = 'position:absolute;color:var(--color-accent-lime-default)';
        document.body.append(probe);
        lime = getComputedStyle(probe).color;
        probe.remove();
        return lime;
    };
    const opacityChain = (e, stop) => { let o = 1; for (; e && e !== stop.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
    const checkCaret = (typing, typed) => {
        const carets = [...typing.querySelectorAll('[data-caret]')].filter((c) => c.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
        if (carets.length !== 1) return `打字中要剛好一個看得到的游標 [data-caret]，得到 ${carets.length}`;
        const c = carets[0];
        const cs = getComputedStyle(c);
        const r = c.getBoundingClientRect();
        const size = parseFloat(getComputedStyle(typed).fontSize);
        if (r.width < 1.5 || r.width > 2.5) return `游標要 2px 寬，得到 ${r.width.toFixed(1)}`;
        if (r.height < size * 0.75 || r.height > size * 1.6) return `游標要一個字高（字級 ${size}px），得到 ${r.height.toFixed(1)}`;
        if (cs.backgroundColor !== limeColor()) return `游標要是螢光綠（--color-accent-lime-default ${limeColor()}）的實心塊，得到 ${cs.backgroundColor}`;
        if (opacityChain(c, typing) < 0.999) return '游標的透明度要是 1（不閃）';
        if (c.getAnimations().some((a) => a.playState === 'running')) return '游標不能有動畫（不閃）';
        // 位置：最後一個字後面；最後一個字剛好在行尾時，可以在下一行的行首（最後一個字是空白或換行時不量）
        const walk = document.createTreeWalker(typed, NodeFilter.SHOW_TEXT);
        let node = null;
        while (walk.nextNode()) if (walk.currentNode.data.length) node = walk.currentNode;
        if (node && /\S/.test(node.data.at(-1))) {
            const range = document.createRange();
            range.setStart(node, node.data.length - 1);
            range.setEnd(node, node.data.length);
            const rects = range.getClientRects();
            const g = rects[rects.length - 1];
            if (g) {
                const same = r.left >= g.right - 1 && r.left <= g.right + 4 && Math.min(r.bottom, g.bottom) - Math.max(r.top, g.top) > 0;
                const start = typed.getBoundingClientRect().left + parseFloat(getComputedStyle(typed).paddingLeft);
                const next = r.top >= g.bottom - 2 && r.left <= start + 4;
                if (!same && !next) return `游標要在最後一個字後面（字右緣 ${g.right.toFixed(1)}、上緣 ${g.top.toFixed(1)}；游標左緣 ${r.left.toFixed(1)}、上緣 ${r.top.toFixed(1)}）`;
            }
        }
        return '';
    };
    const tick = () => {
        const now = performance.now();
        const sec = document.querySelector('[data-section="forai"]');
        if (sec) {
            const tree = sec.querySelectorAll('[data-tree] [data-line]');
            // 「樹長完」＝先看過還沒長出來的行（透明度 < 0.5），之後七行都到 1（開頁那一刻樣式還沒套上，七行會先是 1，不能算）
            if (tree.length === 7 && m.treeDoneAt === null) {
                const o = [...tree].map((l) => parseFloat(getComputedStyle(l).opacity));
                if (o.some((v) => v < 0.5)) m.treeHidden = true;
                else if (m.treeHidden && o.every((v) => v >= 0.99)) m.treeDoneAt = now;
            }
            const typing = sec.querySelector('[data-typing]');
            const typed = typing?.querySelector('[data-typed]');
            const t = typed ? typed.textContent : '';
            if (t !== m.last) {
                if (!t.startsWith(m.last)) m.resets.push({ t: Math.round(now), from: m.last.length, to: t.length });
                if (!m.notPrefix && !text.startsWith(t)) {
                    const a = Array.from(t);
                    const b = Array.from(text);
                    m.notPrefix = `打出來的字要是要打的那一段的開頭，第 ${a.findIndex((c, i) => c !== b[i]) + 1} 個字不一樣：「${t.slice(-20)}」`;
                }
                m.changes.push([now, t.length]);
                m.last = t;
            }
            if (typing && typed && t.length > 0 && t.length < text.length) {
                m.caret.frames += 1;
                if (!m.caret.bad) m.caret.bad = checkCaret(typing, typed);
            }
            if (typing && t.length === text.length && [...typing.querySelectorAll('[data-caret]')].some((c) => c.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) m.caret.afterDone += 1;
            const frame = sec.querySelector('[data-corners]');
            if (frame) {
                for (const a of frame.getAnimations({ subtree: true })) {
                    if (!(a.timeline instanceof DocumentTimeline)) continue;
                    const props = a.transitionProperty ? [a.transitionProperty]
                        : (a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'computedOffset', 'easing', 'composite'].includes(k)) : []);
                    for (const p of props) {
                        const name = p.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
                        if (!OK.test(name) && !m.badProps.includes(name)) m.badProps.push(name);
                    }
                }
            }
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};

async function open(lang, width, { touch = false, js = true, reduced = false, clock = false, height } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? TOUCH : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const requests = [];
    page.on('pageerror', (err) => errors.push(`頁面錯誤：${err.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`主控台：${msg.text()}${msg.location()?.url ? `（${msg.location().url}）` : ''}`); });
    page.on('request', (r) => requests.push(new URL(r.url()).pathname));
    if (clock) await page.clock.install();
    if (js) await page.addInitScript(SAMPLER, FIX.excerpt[lang]);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // 假時鐘照真的時間走到這裡；停在「現在＋2 秒」（同時開好幾頁時，讀時間與停下來之間可能過了不少，停在過去會丟錯）
    if (clock) await page.clock.pauseAt(Math.max(Date.now(), await page.evaluate(() => Date.now())) + 2000);
    return { site, page, context, errors, requests, sec: page.locator(SEC) };
}

const state = (page) => page.evaluate(() => { const { last, ...rest } = window.__t; return { ...rest, len: last.length }; });
const typedText = (page) => page.evaluate((sel) => document.querySelector(`${sel} [data-typing] [data-typed]`)?.textContent ?? null, SEC);
const near = (a, b, tol) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const firstErrors = (errors) => errors.slice(0, 5);

// 把樹捲到七行都長出來的位置（樹頂在畫面 20%，F5.1 量過），再等真的畫面跑一下（IntersectionObserver 回報、捲動時間軸更新）
async function growTree(page) {
    await page.evaluate((sel) => {
        const t = document.querySelector(`${sel} [data-tree]`);
        if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - innerHeight * 0.2, behavior: 'instant' });
    }, SEC);
    await page.waitForTimeout(150);
}
const leave = async (page) => { await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(120); };
const centerFrame = async (page) => { await page.evaluate((sel) => document.querySelector(`${sel} [data-corners]`)?.scrollIntoView({ block: 'center', behavior: 'instant' }), SEC); await page.waitForTimeout(120); };

// 07、框、打字層、圖的那一塊（img 的外層）的位置；框與打字層的 [x, y, 寬, 高] 從 07 的左上角算
const GEOM = (sel) => {
    const sec = document.querySelector(sel);
    if (!sec) return null;
    const s = sec.getBoundingClientRect();
    const round = (n) => Math.round(n * 10) / 10;
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [round(r.left - s.left), round(r.top - s.top), round(r.width), round(r.height)]; };
    const img = sec.querySelector('[data-corners] img[src*="ai-outline"]');
    return { top: round(s.top + scrollY), height: round(s.height), page: round(document.documentElement.scrollHeight), frame: box(sec.querySelector('[data-corners]')), typing: box(sec.querySelector('[data-typing]')), crop: box(img?.parentElement) };
};

// 打字層裡的字畫到它外面、框壓到 07 的字
const INSIDE = (sel) => {
    const sec = document.querySelector(sel);
    const typing = sec?.querySelector('[data-typing]');
    const frame = sec?.querySelector('[data-corners]');
    if (!typing || !frame) return { missing: true };
    const out = { missing: false, outside: 0, sample: '', overlap: [] };
    const c = getComputedStyle(typing);
    const tr = typing.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    if (c.overflowX === 'visible' || c.overflowY === 'visible') {
        const walk = document.createTreeWalker(typing, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (g.width && (g.left < tr.left - 0.5 || g.right > tr.right + 0.5 || g.top < tr.top - 0.5 || g.bottom > tr.bottom + 0.5)) { out.outside += 1; if (!out.sample) out.sample = node.data.slice(Math.max(0, k - 10), k + 10); }
            }
        }
    }
    for (const e of sec.querySelectorAll('[data-id]')) {
        if (e.parentElement.closest('[data-id]') || !e.checkVisibility()) continue;
        const r = e.getBoundingClientRect();
        if (Math.min(r.right, fr.right) - Math.max(r.left, fr.left) > 1 && Math.min(r.bottom, fr.bottom) - Math.max(r.top, fr.top) > 1) out.overlap.push(e.dataset.id);
    }
    return out;
};

// 打完的樣子：不透明的底、字型、換行與裁切、第一行字的左緣／上緣／下緣（從圖的那一塊左上角算）
const LOOK = (sel) => {
    const sec = document.querySelector(sel);
    const typing = sec.querySelector('[data-typing]');
    const typed = typing.querySelector('[data-typed]');
    const crop = sec.querySelector('[data-corners] img[src*="ai-outline"]').parentElement.getBoundingClientRect();
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;font-family:var(--font-mono)';
    typing.append(probe);
    const mono = getComputedStyle(probe).fontFamily;
    probe.remove();
    const cs = getComputedStyle(typing);
    let left = Infinity;
    let top = null;
    let bottom = null;
    const walk = document.createTreeWalker(typed, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
        const node = walk.currentNode;
        for (let k = 0; k < node.data.length; k += 1) {
            if (!node.data[k].trim()) continue;
            const range = document.createRange();
            range.setStart(node, k);
            range.setEnd(node, k + 1);
            const g = range.getBoundingClientRect();
            if (!g.width) continue;
            left = Math.min(left, g.left - crop.left);
            if (top === null) { top = g.top - crop.top; bottom = g.bottom - crop.top; } else if (g.top - crop.top < top + 2) bottom = Math.max(bottom, g.bottom - crop.top);
        }
    }
    return { mono, font: getComputedStyle(typed).fontFamily, bg: cs.backgroundColor, overflowX: cs.overflowX, overflowY: cs.overflowY, scrollTop: typing.scrollTop, scrollLeft: typing.scrollLeft, liga: getComputedStyle(typed).fontVariantLigatures, left, top, bottom, cropW: crop.width };
};

// 靜態大綱圖上第一行字在「圖的那一塊」裡的位置（原圖座標換成畫面上的 px）
function imageText(lang, width, cropW) {
    const show = width >= DESIGN.show.wideFrom ? DESIGN.show.wide : DESIGN.show.narrow;
    const k = cropW / show.width;
    const t = DESIGN.imageText[lang];
    return { left: (t.left - show.x) * k, top: (t.top - show.y) * k, bottom: (t.firstBottom - show.y) * k };
}

// 量到的每一個改變 → 第一個字、每一個換行、最後一個字出來的時刻（從樹長完算），跟 schedule 比
function timingProblems(m, lang) {
    const bad = [];
    const sch = schedule(FIX.excerpt[lang]);
    if (m.treeDoneAt === null) return ['防呆：樹的七行要長出來（捲到樹頂在畫面 20%）'];
    const at = (len) => { const hit = m.changes.find(([, l]) => l >= len); return hit ? hit[0] - m.treeDoneAt : null; };
    const first = sch.steps[0];
    const last = sch.steps.at(-1);
    const marks = [first, ...sch.steps.filter((s) => s.c === '\n'), last];
    let nl = 0;
    for (const s of marks) {
        if (s.c === '\n') nl += 1;
        const name = s === first ? '第一個字' : s === last ? '最後一個字' : `第 ${nl} 個換行`;
        const got = at(s.len);
        if (got === null) { bad.push(`${name}：要在樹長完之後 ${Math.round(s.t)}ms 出來，一直沒出來（打到 ${m.changes.at(-1)?.[1] ?? 0} 個字）`); break; }
        if (Math.abs(got - s.t) > TOL) bad.push(`${name}：要在樹長完之後 ${Math.round(s.t)}ms（±${TOL}）出來，得到 ${Math.round(got)}ms`);
    }
    const early = m.changes.find(([t, l]) => l > 0 && t < m.treeDoneAt);
    if (early) bad.push(`樹還沒長完就開始打了（${Math.round(early[0])}ms，樹長完 ${Math.round(m.treeDoneAt)}ms）`);
    return bad.slice(0, 6);
}

// ---------- F9.1 結構、typing.json、HTML 大小 ----------

for (const lang of LANGS) {
    test(`F9.1 結構（${lang}，關掉 JS）：圖在框裡、打字層蓋在上面（aria-hidden、不在 live region、data-src）、沒有大綱全文`, { skip: pw ? false : why }, async () => {
        const { context, sec } = await open(lang, 1440, { js: false });
        try {
            const r = await sec.evaluate((s) => {
                const frames = [...s.querySelectorAll('[data-corners]')];
                const typing = [...s.querySelectorAll('[data-typing]')];
                const img = frames[0]?.querySelector('img[src*="ai-outline"]');
                const LIVE = /^(status|log|alert|marquee|timer)$/;
                const live = [];
                for (let e = typing[0]; e; e = e.parentElement) {
                    const al = e.getAttribute('aria-live');
                    if ((al && al !== 'off') || LIVE.test(e.getAttribute('role') || '')) live.push(`${e.tagName.toLowerCase()} aria-live=${al} role=${e.getAttribute('role')}`);
                }
                return {
                    frames: frames.length, typings: typing.length, inFrame: typing[0] ? !!frames[0]?.contains(typing[0]) : false,
                    typeds: s.querySelectorAll('[data-typing] [data-typed]').length, typed: s.querySelector('[data-typing] [data-typed]')?.textContent ?? null,
                    ariaHidden: typing[0]?.getAttribute('aria-hidden'), src: typing[0]?.getAttribute('data-src'), live,
                    shown: typing[0] ? typing[0].checkVisibility({ opacityProperty: true, visibilityProperty: true }) : false,
                    img: img ? { alt: img.getAttribute('alt'), shown: img.checkVisibility() } : null, outline: s.querySelectorAll('[data-outline]').length,
                };
            });
            const bad = [];
            if (r.frames !== 1) bad.push(`07 裡要剛好一個框（[data-corners]），得到 ${r.frames}`);
            if (!r.img) bad.push('框裡要有靜態大綱圖（src 有 ai-outline）');
            else {
                if (r.img.alt !== getPlainString(lang, 'forai.outline.alt')) bad.push(`靜態大綱圖的 alt 要是 forai.outline.alt，得到 ${r.img.alt}`);
                if (!r.img.shown) bad.push('關掉 JS 時靜態大綱圖要看得到');
            }
            if (r.typings !== 1) bad.push(`07 裡要剛好一個打字層 [data-typing]，得到 ${r.typings}`);
            else {
                if (!r.inFrame) bad.push('[data-typing] 要在框（[data-corners]）裡');
                if (r.ariaHidden !== 'true') bad.push(`[data-typing] 要 aria-hidden="true"（讀屏只讀圖的 alt），得到 ${r.ariaHidden}`);
                if (r.live.length) bad.push(`打字層不能在 live region 裡（每打一個字讀屏就念一次）：${r.live.join('、')}`);
                if (r.src !== `/${lang}/typing.json`) bad.push(`[data-typing] 的 data-src 要是 /${lang}/typing.json，得到 ${r.src}`);
                if (r.shown) bad.push('關掉 JS 時打字層要看不到（只有圖）');
                if (r.typeds !== 1) bad.push(`[data-typing] 裡要剛好一個 [data-typed]，得到 ${r.typeds}`);
                else if (r.typed !== '') bad.push(`送出來的 HTML 裡 [data-typed] 要是空的，得到 ${r.typed.length} 個字`);
            }
            if (r.outline) bad.push('不放大綱全文（[data-outline]）');
            assert.deepEqual(bad, [], `${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

test('F9.1 typing.json（三語）：{ text } 剛好是靜態大綱圖上那一段，每一行都是 json 的 outline 裡的行', () => {
    const bad = [];
    for (const lang of LANGS) {
        const lines = AGENT[lang].outline.split('\n');
        const want = FIX.lines[lang].map((n) => lines[n - 1]).join('\n');
        if (want !== FIX.excerpt[lang]) bad.push(`防呆：fixtures/typing-f9.json 的 ${lang} 跟 data/agent.${lang}.json 對不上（後端重轉過資料？重新產生 fixture）`);
        let got;
        try { got = JSON.parse(readOut(`${lang}/typing.json`)); } catch (err) { bad.push(`${lang}：out/${lang}/typing.json 讀不到或不是 JSON（${err.message.split('\n')[0]}）`); continue; }
        if (got?.text !== FIX.excerpt[lang]) bad.push(`${lang}：typing.json 的 text 要剛好是靜態大綱圖上那一段（原檔第 ${FIX.lines[lang].join('、')} 行），得到 ${typeof got?.text === 'string' ? `${got.text.length} 個字、開頭「${got.text.slice(0, 20)}」` : JSON.stringify(got).slice(0, 60)}`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 比的是拿掉 self.__next_f 那幾段（Next.js 給 React 接手用的資料）之後的 HTML：那幾段的切法會隨內容變，加 200 位元組的標記，整份 gzip 量到 +104 也量到 +514（同一份程式改一行 CSS），
// 拿掉之後穩定。字若放進 HTML（data-* 或文字），畫面那一段就會變大，照樣抓得到。整份的 gzip 只印出來。
const domPart = (html) => html.replace(/<script>self\.__next_f\.push\([\s\S]*?<\/script>/g, '');

test('F9.1 HTML 大小（三語）：gzip 後不比基準（9f0594c）大 512 位元組以上（不算 Next.js 接手用的資料）', (t) => {
    const bad = [];
    for (const lang of LANGS) {
        const html = readOut(`${lang}/index.html`);
        const now = zlib.gzipSync(domPart(html)).length;
        const was = FIX.htmlGzip[lang];
        const full = zlib.gzipSync(html).length;
        t.diagnostic(`F9 ${lang}/index.html gzip（不算接手資料）${was} → ${now}（${now - was >= 0 ? '+' : ''}${now - was}）；整份 ${FIX.htmlGzipFull[lang]} → ${full}`);
        if (now > was + HTML_SLACK) bad.push(`${lang}：gzip 後 ${now} 位元組，比基準（${FIX.htmlGzip.commit}）的 ${was} 大 ${now - was}（上限 ${HTML_SLACK}）—— 要打的字放 typing.json，不放進 HTML`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F9.1 時間、游標、打完的樣子（代表組合，假時鐘） ----------

for (const rep of REPS) {
    const [lang, width, touch] = rep;
    test(`F9.1 時間、游標、打完的樣子（${label(rep)}）`, { skip: pw ? false : why }, async (t) => {
        const { page, context, errors } = await open(lang, width, { touch, clock: true });
        try {
            const before = await page.evaluate(GEOM, SEC);
            // 先停在 07 已經進畫面、樹還沒長出來的地方（樹頂剛進畫面下緣）1 秒：一個字都不能打
            await page.evaluate((sel) => { const tr = document.querySelector(`${sel} [data-tree]`); if (tr) scrollTo({ top: tr.getBoundingClientRect().top + scrollY - innerHeight + 10, behavior: 'instant' }); }, SEC);
            await page.waitForTimeout(150);
            await page.clock.runFor(1000);
            const early = (await typedText(page))?.length ?? 0;
            await growTree(page);
            // 打字中（2 秒，第一行已經打完）：框、打字層的位置與長相（打完會淡出露出圖，所以長相在打字中量）
            await page.clock.runFor(2000);
            await centerFrame(page);
            const bad = [];
            const g = await page.evaluate(GEOM, SEC);
            const want = DESIGN.frame[lang][String(width)];
            if (!near(g?.frame, want, 1)) bad.push(`框 ${JSON.stringify(g?.frame)}，設計稿 ${JSON.stringify(want)}`);
            if (!near(g?.typing, textArea(g?.crop, width), 1)) bad.push(`打字層要蓋在圖的文字欄（標題列下面、行號欄右邊）：打字層 ${JSON.stringify(g?.typing)}、文字欄 ${JSON.stringify(textArea(g?.crop, width))}`);
            if (before && g && (Math.abs(g.height - before.height) > 0.5 || Math.abs(g.page - before.page) > 0.5)) bad.push(`07 或整頁的高度變了（07 ${before.height} → ${g.height}、整頁 ${before.page} → ${g.page}）`);
            if (g?.typing) {
                const look = await page.evaluate(LOOK, SEC);
                if (look.font !== look.mono) bad.push(`字要用 --font-mono（${look.mono}），得到 ${look.font}`);
                if (look.liga !== 'none') bad.push(`等寬字不合成連字（JetBrains Mono 會把「##」畫成一個字）：font-variant-ligatures 要是 none，得到 ${look.liga}`);
                if (!/^rgb\(/.test(look.bg) && !/^rgba\(.*,\s*1\)$/.test(look.bg)) bad.push(`打字層要有不透明的底（蓋住下面的圖），得到 ${look.bg}`);
                if (look.overflowX !== 'hidden' || look.overflowY !== 'hidden') bad.push(`超過框的字要裁掉：overflow 要是 hidden，得到 ${look.overflowX} ${look.overflowY}`);
                if (look.scrollTop !== 0 || look.scrollLeft !== 0) bad.push(`不捲動：打字層的 scrollTop、scrollLeft 要是 0，得到 ${look.scrollTop}、${look.scrollLeft}`);
                const img = imageText(lang, width, look.cropW);
                for (const k of ['left', 'top', 'bottom']) {
                    if (look[k] === null || !Number.isFinite(look[k]) || Math.abs(look[k] - img[k]) > 6) bad.push(`第一行字的${{ left: '左緣', top: '上緣', bottom: '下緣' }[k]}要跟靜態大綱圖上的差 ≤ 6px：打字層 ${Number.isFinite(look[k]) ? look[k].toFixed(1) : look[k]}、圖 ${img[k].toFixed(1)}`);
                }
                const r = await page.evaluate(INSIDE, SEC);
                if (!r.missing && r.outside) bad.push(`${r.outside} 個字畫到打字層外面（例如「${r.sample}」）`);
            }
            await page.clock.runFor(5200);
            const m = await state(page);
            const sch = schedule(FIX.excerpt[lang]);
            t.diagnostic(`F9 ${label(rep)}：${Array.from(FIX.excerpt[lang]).length} 個字，照 30／150ms 要 ${sch.total}ms，縮成 ${Math.round(sch.steps.at(-1).t - 400)}ms（×${sch.scale.toFixed(3)}）`);
            bad.push(...timingProblems(m, lang));
            if (early) bad.push(`07 進畫面、樹還沒長完就開始打了（停 1 秒打了 ${early} 個字）`);
            const text = await typedText(page);
            if (text !== FIX.excerpt[lang]) bad.push(`打完要剛好是靜態大綱圖上那一段（${FIX.excerpt[lang].length} 個字），得到 ${text?.length ?? 'null'} 個字${text?.length === FIX.excerpt[lang].length ? '（字數一樣、字不一樣）' : ''}`);
            if (m.notPrefix) bad.push(m.notPrefix);
            if (m.resets.length) bad.push(`打過的字只能往後加：${JSON.stringify(m.resets.slice(0, 3))}`);
            if (!m.caret.frames) bad.push('防呆：打字中的畫格一格都沒量到');
            if (m.caret.bad) bad.push(m.caret.bad);
            if (m.caret.afterDone) bad.push('打完要把游標拿掉');
            // 打完：打字層淡出、露出圖本身（停住的畫面＝靜態圖，跟減少動態一樣）；淡出是 CSS 的轉場，走真的時間
            await page.waitForTimeout(1500);
            const end = await page.evaluate((sel) => {
                const s = document.querySelector(sel);
                const typing = s.querySelector('[data-typing]');
                const img = s.querySelector('[data-corners] img[src*="ai-outline"]');
                return { typing: typing.checkVisibility({ opacityProperty: true, visibilityProperty: true }), opacity: getComputedStyle(typing).opacity, img: img.checkVisibility({ opacityProperty: true, visibilityProperty: true }) };
            }, SEC);
            if (end.typing) bad.push(`打完要把打字層淡出、露出圖（打字層透明度 ${end.opacity}）`);
            if (!end.img) bad.push('打完要看得到靜態大綱圖');
            // 捲走再捲回來：不重打
            await leave(page);
            await page.clock.runFor(1000);
            await growTree(page);
            await page.clock.runFor(3000);
            if ((await typedText(page)) !== text) bad.push('打完之後捲走再捲回來，字要一個都不變（不重打）');
            if ((await state(page)).resets.length) bad.push('捲回來之後重打了');
            if (errors.length) bad.push(...firstErrors(errors));
            assert.deepEqual(bad, [], `${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

// ---------- F9.2 減少動態、關掉 JS（代表組合） ----------

for (const [mode, opts] of [['減少動態', { reduced: true }], ['關掉 JS', { js: false }]]) {
    test(`F9.2 ${mode}（中 390、英 1440、日 320）：只有靜態大綱圖、打字層不出現、不抓 typing.json、不動`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const rep of REPS) {
            const [lang, width, touch] = rep;
            const { page, context, errors, requests, sec } = await open(lang, width, { ...opts, touch });
            try {
                await growTree(page);
                await centerFrame(page);
                await page.waitForTimeout(1500);
                const r = await sec.evaluate((s) => {
                    const img = s.querySelector('[data-corners] img[src*="ai-outline"]');
                    const typing = s.querySelector('[data-typing]');
                    const frame = s.querySelector('[data-corners]');
                    const chain = (e) => { let o = 1; for (; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
                    return {
                        img: img ? { shown: img.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && chain(img) > 0.99, loaded: img.complete && img.naturalWidth > 0 } : null,
                        typing: typing ? typing.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && chain(typing) > 0.01 : false,
                        typed: s.querySelector('[data-typing] [data-typed]')?.textContent ?? '',
                        running: frame ? frame.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length : 0,
                    };
                });
                const name = label(rep);
                if (!r.img) bad.push(`${name}：框裡要有靜態大綱圖`);
                else {
                    if (!r.img.shown) bad.push(`${name}：靜態大綱圖要看得到`);
                    if (!r.img.loaded) bad.push(`${name}：靜態大綱圖捲到之後要載好`);
                }
                if (r.typing) bad.push(`${name}：打字層要看不到（${mode}只有圖）`);
                if (r.typed !== '') bad.push(`${name}：不能打字，[data-typed] 有 ${r.typed.length} 個字`);
                if (r.running) bad.push(`${name}：框裡有 ${r.running} 個在跑的動畫`);
                if (requests.some((p) => p.endsWith('/typing.json'))) bad.push(`${name}：${mode}時不用抓 typing.json`);
                if (errors.length) bad.push(...firstErrors(errors).map((e) => `${name}：${e}`));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// ---------- F9.2 離開再回來、切到背景（英文 1440，假時鐘） ----------

const VISIBILITY = (v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
};

test('F9.2 打到一半離開再回來五次、切到背景三次（en 1440）：時間照樣、不重打、不疊', { skip: pw ? false : why }, async () => {
    const { page, context, errors } = await open('en', 1440, { clock: true });
    try {
        await growTree(page);
        await page.clock.runFor(1500);
        // 假時鐘停著來回：上一輪的計時器還排著的時候又回來，最容易多開一份；切到背景用改 visibilityState 再發 visibilitychange（headless 換分頁不會變 hidden）
        for (let i = 0; i < 5; i += 1) { await leave(page); await growTree(page); }
        for (let i = 0; i < 3; i += 1) { await page.evaluate(VISIBILITY, 'hidden'); await page.waitForTimeout(80); await page.evaluate(VISIBILITY, 'visible'); await page.waitForTimeout(80); }
        await page.clock.runFor(6000);
        const m = await state(page);
        const bad = [...timingProblems(m, 'en')];
        if (!m.vis.includes('hidden')) bad.push('防呆：visibilitychange 要發出 hidden');
        if (m.resets.length) bad.push(`打過的字只能往後加，不能清掉重打：${JSON.stringify(m.resets.slice(0, 3))}`);
        if (m.notPrefix) bad.push(m.notPrefix);
        if ((await typedText(page)) !== FIX.excerpt.en) bad.push('最後要剛好打完那一段（沒有多、沒有重複）');
        if (errors.length) bad.push(...firstErrors(errors));
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    } finally {
        await context.close();
    }
});

// ---------- F9.2 換語言 ----------

test('F9.2 換語言（zh 1440 打到一半按 EN）：英文頁打英文那段、抓 /en/typing.json', { skip: pw ? false : why }, async () => {
    const { page, context, errors, requests, site } = await open('zh', 1440);
    try {
        await growTree(page);
        await page.waitForTimeout(1200);
        assert.ok((await typedText(page))?.length > 0, '中文頁：樹長完之後要開始打');
        await page.addInitScript(SAMPLER, FIX.excerpt.en);
        const p = await parts(page, 'zh');
        const en = p.langGroup.locator('a[href*="/en/"]').first();
        assert.ok(await en.count(), '防呆：導覽列的語言切換要有英文那個連結');
        const from = requests.length;
        await Promise.all([page.waitForURL(`${site.url}/en/**`), en.click()]);
        await page.evaluate(() => document.fonts.ready);
        await growTree(page);
        await page.waitForTimeout(1500);
        const m = await state(page);
        const text = await typedText(page);
        const bad = [];
        if (!text) bad.push('英文頁：樹長完之後要開始打');
        if (m.notPrefix) bad.push(`英文頁：${m.notPrefix}`);
        const after = requests.slice(from);
        if (!after.includes('/en/typing.json')) bad.push('英文頁要抓 /en/typing.json');
        if (after.includes('/zh/typing.json')) bad.push('英文頁不能抓 /zh/typing.json');
        if (errors.length) bad.push(...firstErrors(errors));
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    } finally {
        await context.close();
    }
});

// ---------- F9.2 打到一半改寬度（日文，假時鐘） ----------

test('F9.2 打到一半改寬度（ja 1440 → 320 → 1024 → 1440）：框與打字層照設計稿、不橫捲、照樣打完', { skip: pw ? false : why }, async () => {
    const { page, context, errors } = await open('ja', 1440, { clock: true });
    try {
        await growTree(page);
        await page.clock.runFor(1500);
        const bad = [];
        for (const [w, h] of [[320, 844], [1024, 900], [1440, 900]]) {
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(200);
            await centerFrame(page);
            await page.clock.runFor(500);
            const g = await page.evaluate(GEOM, SEC);
            const want = DESIGN.frame.ja[String(w)];
            if (!near(g?.frame, want, 1)) bad.push(`改成 ${w}：框 ${JSON.stringify(g?.frame)}，設計稿 ${JSON.stringify(want)}`);
            if (!near(g?.typing, textArea(g?.crop, w), 1)) bad.push(`改成 ${w}：打字層 ${JSON.stringify(g?.typing)} 要蓋在圖的文字欄 ${JSON.stringify(textArea(g?.crop, w))}`);
            const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
            if (over > 0) bad.push(`改成 ${w}：整頁橫捲 ${over}px`);
        }
        await page.clock.runFor(6000);
        const m = await state(page);
        if ((await typedText(page)) !== FIX.excerpt.ja) bad.push('改完寬度要照樣打完那一段');
        if (m.resets.length) bad.push(`打過的字只能往後加：${JSON.stringify(m.resets.slice(0, 3))}`);
        if (m.notPrefix) bad.push(m.notPrefix);
        if (errors.length) bad.push(...firstErrors(errors));
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    } finally {
        await context.close();
    }
});

// ---------- F9.3 通用（三語 × 十二種寬度，假時鐘，同時開四頁） ----------

for (const lang of LANGS) {
    test(`F9.3 通用（${lang}，十二種寬度）：不橫捲、不壓字、框與打字層照設計稿、CLS 0、只動 opacity／transform`, { skip: pw ? false : why }, async () => {
        const bad = (await pool(WIDTHS, 4, async (width) => {
            const out = [];
            const { page, context, errors } = await open(lang, width, { clock: true });
            try {
                const before = await page.evaluate(GEOM, SEC);
                const mark = await page.evaluate(() => performance.now());
                await growTree(page);
                await page.clock.runFor(1500);
                const m = await state(page);
                if (!m.len) out.push(`${width}：樹長完 1.5 秒後要在打字`);
                const shifts = m.shifts.filter((s) => s.t >= mark);
                const cls = shifts.reduce((sum, s) => sum + s.v, 0);
                if (cls > 0) out.push(`${width}：layout-shift ${cls.toFixed(4)}（${[...new Set(shifts.flatMap((s) => s.nodes))].slice(0, 3).join('、')}）`);
                if (m.badProps.length) out.push(`${width}：框裡的動畫只能動 opacity、transform，看到 ${m.badProps.join('、')}`);
                await centerFrame(page);
                const g = await page.evaluate(GEOM, SEC);
                const want = DESIGN.frame[lang][String(width)];
                if (!near(g?.frame, want, 1)) out.push(`${width}：框 ${JSON.stringify(g?.frame)}，設計稿 ${JSON.stringify(want)}`);
                if (!near(g?.typing, textArea(g?.crop, width), 1)) out.push(`${width}：打字層 ${JSON.stringify(g?.typing)} 要蓋在圖的文字欄 ${JSON.stringify(textArea(g?.crop, width))}`);
                if (before && g && (Math.abs(g.height - before.height) > 0.5 || Math.abs(g.page - before.page) > 0.5)) out.push(`${width}：07 或整頁的高度變了（07 ${before.height} → ${g.height}、整頁 ${before.page} → ${g.page}）`);
                const r = await page.evaluate(INSIDE, SEC);
                if (r.missing) out.push(`${width}：找不到打字層或框`);
                else {
                    if (r.outside) out.push(`${width}：${r.outside} 個字畫到打字層外面（例如「${r.sample}」）`);
                    if (r.overlap.length) out.push(`${width}：框壓到 ${r.overlap.join('、')}`);
                }
                const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                if (over > 0) out.push(`${width}：整頁橫捲 ${over}px`);
                if (errors.length) out.push(...firstErrors(errors).map((e) => `${width}：${e}`));
            } finally {
                await context.close();
            }
            return out;
        })).flat();
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// ---------- F9.3 長工作 ----------

for (const [lang, width, touch, cpu] of [['zh', 390, true, 4], ['en', 1440, false, 1]]) {
    test(`F9.3 打字不造成長工作（${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}${cpu > 1 ? `、CPU 慢 ${cpu} 倍` : ''}）：捲到 07 起 4 秒內沒有 > 50ms 的 Long Task`, { skip: pw ? false : why }, async (t) => {
        const { page, context, errors } = await open(lang, width, { touch });
        try {
            if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
            await page.waitForTimeout(2000);
            const mark = await page.evaluate(() => performance.now());
            await growTree(page);
            await page.waitForTimeout(4000);
            const m = await state(page);
            const long = m.longtasks.filter((x) => x.t + x.d >= mark && x.d > 50);
            t.diagnostic(`F9 ${lang} ${width}：Long Task ${long.map((x) => `${Math.round(x.d)}ms`).join('、') || '沒有'}`);
            const bad = [];
            if (!m.len) bad.push('防呆：捲到 07 之後要開始打');
            if (long.length) bad.push(`捲到 07、開始打之後有 ${long.length} 個 > 50ms 的 Long Task（${long.map((x) => `${Math.round(x.d)}ms`).join('、')}）`);
            if (errors.length) bad.push(...firstErrors(errors));
            assert.deepEqual(bad, [], `${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

// ---------- F9.3 JS 預算與原始碼 ----------

const TYPING_JS = path.join(SITE, 'public', 'typing.js');

test('F9.3 三語頁載入 /typing.js（defer）、「/」與 404 不載', () => {
    const bad = [];
    for (const [rel, want] of [['zh/index.html', true], ['en/index.html', true], ['ja/index.html', true], ['index.html', false], ['404.html', false]]) {
        const scripts = tagAttrs(readOut(rel), 'script').filter((a) => a.src && new URL(a.src, 'https://collector.jerromy.com/zh/').pathname === '/typing.js');
        if (want && scripts.length !== 1) bad.push(`${rel}：要剛好一個 <script src="/typing.js">，得到 ${scripts.length}`);
        if (want && scripts.length === 1 && !('defer' in scripts[0])) bad.push(`${rel}：/typing.js 要 defer`);
        if (!want && scripts.length) bad.push(`${rel}：不用載 /typing.js`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F9.3 typing.js gzip 後 ≤ 3 KB、不含要打的字、不寫死色碼', (t) => {
    assert.ok(fs.existsSync(TYPING_JS), 'public/typing.js 不在（07 打字的程式放這一支）');
    const src = fs.readFileSync(TYPING_JS, 'utf8');
    const gz = zlib.gzipSync(src).length;
    t.diagnostic(`F9 public/typing.js：${Buffer.byteLength(src)} 位元組，gzip 後 ${gz} 位元組（${(gz / 1024).toFixed(2)} KB）`);
    const bad = [];
    if (gz > BUDGET) bad.push(`gzip 後 ${gz} 位元組，要 ≤ ${BUDGET}（3 KB）`);
    for (const lang of LANGS) {
        const probe = FIX.excerpt[lang].split('\n').find((l) => l.trim().length >= 12)?.trim().slice(0, 12);
        if (probe && src.includes(probe)) bad.push(`typing.js 裡有 ${lang} 要打的字「${probe}」：字在 typing.json`);
    }
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const color = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|hsla?\(\s*\d/.exec(code);
    if (color) bad.push(`typing.js 寫死了顏色「${color[0]}」：顏色寫在 CSS、用語意 token`);
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F9.3 README 記了 typing.js 的大小', () => {
    assert.ok(fs.existsSync(TYPING_JS), 'public/typing.js 不在');
    const gz = zlib.gzipSync(fs.readFileSync(TYPING_JS)).length;
    const readme = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const paras = readme.split(/\n\s*\n/).filter((p) => p.includes('typing.js') && /gzip/i.test(p) && /\d[\d,.]*\s*(KB|KiB)\b/.test(p));
    assert.ok(paras.length > 0, 'homepage/site/README.md 要有一段同時寫到「typing.js」「gzip」與「數字＋KB」');
    const recorded = paras.flatMap((p) => [...p.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(KB|KiB)\b/g)].map((m) => Number(m[1].replace(/,/g, ''))));
    assert.ok(recorded.some((kb) => [1000, 1024].some((unit) => kb * unit >= gz / 2 && kb * unit <= gz * 2)), `README 記的數字（${recorded.join('、')} KB）跟 typing.js 量到的 ${(gz / 1024).toFixed(2)} KB 差超過兩倍`);
});

test('F9.3 07 的元件還是伺服器端元件（打字不靠 React）', () => {
    const files = listFiles(path.join(SITE, 'components', 'ForAI')).filter((r) => /\.(m?js|jsx)$/.test(r));
    assert.ok(files.length > 0, '防呆：components/ForAI 要有程式');
    const bad = files.filter((r) => /^\s*['"]use client['"]/m.test(fs.readFileSync(path.join(SITE, 'components', 'ForAI', r), 'utf8')));
    assert.deepEqual(bad, [], `這幾支是 client 元件：${bad.join('、')}`);
});
