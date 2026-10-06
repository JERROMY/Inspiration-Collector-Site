// 導覽列、選單、公告條在瀏覽器裡怎麼找（不是測試）。只認讀屏與使用者看得到的東西：角色、名字（字串表的字）、連結的位址；
// 唯一額外的約定是 ☰ 的 aria-controls 指到選單的 id、圖示有 data-icon。介面寫在 README.md「導覽列、公告條」那一節。
//
// parts(page, lang)        導覽列的各部分（Playwright 的 locator）：header、bar（一整排的導覽連結）、cta、langGroup、menuButton、menu、menuLinks、menuLang、socials、brand
// bulletinParts(page, lang) 公告條：region（看得到的那一條）、text（標題連結）、close（✕）
// say(lang, id)            字串表那一條去掉標記（畫面上的字）
import { strings, plain } from './helpers.js';

export const NAV_IDS = ['nav.features', 'nav.tutorial', 'nav.devices', 'nav.news', 'nav.changelog', 'nav.faq'];
export const NAV_HASH = { 'nav.features': '#features', 'nav.tutorial': '#tutorial', 'nav.devices': '#devices', 'nav.news': '#news', 'nav.changelog': '#changelog', 'nav.faq': '#faq' };
export const WIDTHS = [280, 320, 360, 375, 390, 414, 430, 640, 768, 1024, 1280, 1440];

export const say = (lang, id) => plain(strings[lang][id]);
const css = (s) => s.replace(/["\\]/g, '\\$&');

export async function parts(page, lang) {
    const header = page.locator('header').first();
    const menuButton = header.locator('button[aria-controls]').first();
    const menuId = await menuButton.getAttribute('aria-controls', { timeout: 10000 }).catch(() => null);
    const inMenu = menuId ? `#${css(menuId)}` : '#__no_menu__';
    const label = css(say(lang, 'nav.label'));
    const langLabel = css(say(lang, 'lang.label'));
    return {
        header,
        menuId,
        menuButton,
        menu: page.locator(inMenu),
        brand: header.locator('a').first(),
        bar: header.locator(`nav[aria-label="${label}"]:not(${inMenu} nav)`),
        cta: header.locator(`a:not(${inMenu} a)`, { hasText: say(lang, 'nav.cta') }),
        langGroup: header.locator(`[role="group"][aria-label="${langLabel}"]:not(${inMenu} [role="group"])`),
        menuLinks: page.locator(`${inMenu} nav[aria-label="${label}"]`),
        menuLang: page.locator(`${inMenu} [role="group"][aria-label="${langLabel}"]`),
        socials: page.locator(`${inMenu} ul[aria-label="${css(say(lang, 'author.socials'))}"]`),
    };
}

export function bulletinParts(page, lang) {
    const region = page.locator(`[role="region"][aria-label="${css(say(lang, 'bulletin.label'))}"]:visible`);
    return {
        all: page.locator(`[role="region"][aria-label="${css(say(lang, 'bulletin.label'))}"]`),
        region,
        text: region.locator('a[href$="#news"]'),
        close: region.locator(`button[aria-label="${css(say(lang, 'bulletin.close'))}"]`),
    };
}

// 頁面上所有 layout-shift 的總和（扣掉使用者操作之後的）；在 goto 之前 addInitScript
export const CLS_SCRIPT = () => {
    window.__cls = 0;
    window.__shifts = [];
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            window.__cls += entry.value;
            window.__shifts.push({ value: entry.value, nodes: (entry.sources ?? []).map((s) => s.node && (s.node.id || s.node.className || s.node.nodeName)).filter(Boolean) });
        }
    }).observe({ type: 'layout-shift', buffered: true });
};

// 設定 localStorage 不能用（讀寫都丟 SecurityError），模擬隱私模式或被擋掉的情況；在 goto 之前 addInitScript
export const NO_STORAGE_SCRIPT = () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('localStorage 被擋掉了（測試）', 'SecurityError'); } });
};

// ---- 03 首屏、04 能用在哪裡 ----
// 介面（README.md「03 首屏、04 能用在哪裡」）：<section data-section="hero">、<section data-section="where">；
// 字串表的一段字畫在帶 data-id="<字串表的 id>" 的元素裡（例如 data-id="hero.sub"）；媒體框 data-corners；04 的三個 0 各是一個 data-zero；
// 動態 A 拆出來的每個字是 data-char。
export const STORE = 'https://chromewebstore.google.com/detail/fmggdnlabihonmakkgcdenfmcmebmmol';

export function heroParts(page) {
    const hero = page.locator('[data-section="hero"]');
    const where = page.locator('[data-section="where"]');
    return {
        hero,
        where,
        // 只在首屏與 04 裡找：15 區的手指框跟首屏用同一組元件，share.fallback 這類 id 會出現兩次
        block: (id) => page.locator(`:is([data-section="hero"], [data-section="where"]) [data-id="${css(id)}"]`),
        clamp: hero.locator('[data-id="hero.title"] .clamp'),
        video: hero.locator('video'),
        frame: hero.locator('[data-corners]').first(),
        zeros: where.locator('[data-zero]'),
    };
}

// 一個元素畫出來的每一行（逐字量 Range 的位置：比上一個字低半個字高以上就是新的一行）；空白合併、每行去頭尾空白
export async function textLines(locator) {
    return locator.evaluate((el) => {
        const lines = [];
        let line = null;
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            const chars = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(node.data));
            for (const { segment, index } of chars) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + segment.length);
                const r = range.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
                if (!line || r.top > line.top + r.height * 0.5) {
                    line = { top: r.top, text: '' };
                    lines.push(line);
                }
                line.text += segment;
            }
        }
        return lines.map((l) => l.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    });
}

// 字數（中日文一個字算 1、英數算 0.5，跟設計稿 copy.md「寬」的算法一樣）
export function width(text) {
    let n = 0;
    for (const ch of text.replace(/\s+/g, '')) n += /[\u0000-ɏ]/.test(ch) ? 0.5 : 1;
    return n;
}

// 連結裡每一個字算出來有沒有底線（在頁面裡跑：page.evaluate(LINK_DECORATION, 選擇器)）。
// text-decoration 不是一般的繼承：祖先畫的底線會延伸到行內的子孫，但「行內區塊」（inline-block、inline-flex…）擋住延伸 ——
// 所以從字的上一層一路往上走到 <a>：遇到自己畫底線（textDecorationLine 有 underline）的就是有；先遇到行內區塊、又還沒遇到有底線的，就是沒有。
// 回傳每個連結 { key: 字去掉空白＋'|'＋href（mailto: 只留 mailto:）, flags: 每個非空白字一個 'u' 或 '-' }。
export const LINK_DECORATION = (selector) => [...document.querySelectorAll(selector)].map((a) => {
    let flags = '';
    let text = '';
    const walk = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
        const node = walk.currentNode;
        let decorated = false;
        for (let el = node.parentElement; el; el = el.parentElement) {
            const s = getComputedStyle(el);
            if (s.textDecorationLine.includes('underline')) { decorated = true; break; }
            if (el === a) break;
            if (/^inline-(block|flex|grid|table)$/.test(s.display)) break;
        }
        for (const ch of node.data) if (ch.trim()) { flags += decorated ? 'u' : '-'; text += ch; }
    }
    const href = a.getAttribute('href') || '';
    return { key: `${text}|${href.startsWith('mailto:') ? 'mailto:' : href}`, flags };
});

// ---- 整頁 CLS（F4.6、F4.6b）----
// 字型晚到時整頁跳多少：這一頁的 .woff2 先扣住（只扣這個 context 的請求，好幾頁可以同時量），回退字型畫出第一次畫面（兩個畫格）才放，
// 再等 load、字型、1.2 秒。layout-shift 全部加起來，**不扣 hadRecentInput**：量的時候沒有人操作，
// 而 Playwright 開只有手指（isMobile＋hasTouch）時，字型換上來那一下的位移會被標成 hadRecentInput: true（量過），扣掉的話只有手指永遠是 0。
// 回傳 { cls, flagged（被標成 hadRecentInput 的那幾筆加起來）, moved（每個元素移了最多幾 px）}；放字型之前拉丁字型就載好了回 { guard: true }。
const CLS_DETAIL = () => {
    window.__cls = 0;
    window.__flagged = 0;
    window.__moved = {};
    const name = (n) => {
        if (n && n.nodeType === 3 && n.parentElement) return `${name(n.parentElement)} 的字`;
        if (!n || n.nodeType !== 1) return n ? n.nodeName : '?';
        const own = n.dataset && (n.dataset.id ? `data-id=${n.dataset.id}` : n.dataset.section ? `data-section=${n.dataset.section}` : '');
        const near = n.closest && n.closest('[data-id], [data-section], [role="region"], header, footer');
        const label = (e) => (e.dataset.id ? `data-id=${e.dataset.id}` : e.dataset.section ? `data-section=${e.dataset.section}` : e.getAttribute('role') === 'region' ? `公告條「${e.getAttribute('aria-label')}」` : e.tagName.toLowerCase());
        const where = near && near !== n ? ` 在 ${label(near)} 裡` : '';
        return own || `${n.tagName.toLowerCase()}${typeof n.className === 'string' && n.className ? `.${n.className.split(' ')[0]}` : ''}${n.id ? `#${n.id}` : ''}${where}`;
    };
    new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            window.__cls += entry.value;
            if (entry.hadRecentInput) window.__flagged += entry.value;
            for (const s of entry.sources ?? []) {
                // 剛出現或消失的元素（其中一邊是空的方框）不算位移量，免得「從 0,0 移過來」排到最前面
                if (!s.previousRect.width || !s.currentRect.width) continue;
                const d = Math.max(Math.abs(s.currentRect.x - s.previousRect.x), Math.abs(s.currentRect.y - s.previousRect.y), Math.abs(s.currentRect.height - s.previousRect.height));
                const key = name(s.node);
                window.__moved[key] = Math.max(window.__moved[key] ?? 0, Math.round(d));
            }
        }
    }).observe({ type: 'layout-shift', buffered: true });
};

export const TOUCH_HEIGHT = 844;
export const MOUSE_HEIGHT = 900;

export async function measureCls(browser, url, { width, touch }) {
    const context = await browser.newContext({ viewport: { width, height: touch ? TOUCH_HEIGHT : MOUSE_HEIGHT }, ...(touch ? { isMobile: true, hasTouch: true } : {}) });
    let release;
    const gate = new Promise((done) => { release = done; });
    await context.route('**/*.woff2', async (route) => { await gate; await route.continue(); });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.addInitScript(CLS_DETAIL);
    try {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
            const early = await page.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'Google Sans Flex' && f.status === 'loaded').length);
            if (early) return { guard: true };
        } finally {
            release();
        }
        await page.waitForLoadState('load');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        return await page.evaluate(() => ({ cls: window.__cls, flagged: window.__flagged, moved: window.__moved }));
    } finally {
        await context.close();
    }
}

// 位移最大的三個元素，寫進失敗訊息
export const topMoved = (moved) => Object.entries(moved).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}（${v}px）`).join('、') || '（沒有來源）';

// 同時開幾頁一起量（每頁自己扣字型，互不影響）
export async function pool(items, size, work) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await work(items[i]);
        }
    }));
    return out;
}

// ---- 手指「按下」的樣子（F4b.4）----
// 用 Chrome 開發者協定把一個元素強制成 :active（states 可以換成 ['hover'] 之類），讀算出來的底色、字色、框線、底線色與 ::before／::after 的透明度（主要按鈕的括號）。
// 要配減少動態開頁（轉場一下到位，不用等）。回傳 { normal, active }。
// 沒有框線（border-style: none、寬 0 或透明）、沒有底線、沒有 ::before／::after 內容時寫「-」：那時的顏色值只是跟著字色，不是畫出來的東西
export const READ_PRESS = (el) => {
    const s = getComputedStyle(el);
    const pseudo = (which) => { const p = getComputedStyle(el, which); return p.content === 'none' || p.content === 'normal' ? '-' : p.opacity; };
    return {
        background: s.backgroundColor, color: s.color,
        border: s.borderTopStyle === 'none' || s.borderTopWidth === '0px' || s.borderTopColor === 'rgba(0, 0, 0, 0)' ? '-' : s.borderTopColor,
        underline: s.textDecorationLine.includes('underline') ? s.textDecorationColor : '-',
        before: pseudo('::before'), after: pseudo('::after'),
    };
};

export async function pressStyles(page, locator, states = ['active']) {
    await locator.evaluate((el) => el.setAttribute('data-press-probe', ''));
    const cdp = await page.context().newCDPSession(page);
    try {
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-press-probe]' });
        const normal = await locator.evaluate(READ_PRESS);
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
        await page.waitForTimeout(50);
        const active = await locator.evaluate(READ_PRESS);
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        return { normal, active };
    } finally {
        await locator.evaluate((el) => el.removeAttribute('data-press-probe'));
        await cdp.detach();
    }
}

// ---- 04「擴充本身」三格的字離分隔線多遠（F4.12）----
// 收：三格的 <ul>（每一格是一個 <li>，最後一個子元素是單位那段字）。給：每一格 { gap, lines }：
//   gap＝這一格裡所有字（數字與單位）的右緣，到下一格的左緣（分隔線畫在下一格的左框）；最後一格量到 <ul> 的右緣。單位 px，一位小數。
//   lines＝單位那段字排成幾行（逐字量位置，比上一個字低半個字高以上算新的一行）。
export const ZERO_GAPS = (ul) => {
    const items = [...ul.children];
    return items.map((li, i) => {
        let right = -Infinity;
        const tops = [];
        const unit = li.lastElementChild;
        const walk = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const r = range.getBoundingClientRect();
                if (!r.width) continue;
                right = Math.max(right, r.right);
                if (unit && unit.contains(node) && !tops.some((t) => Math.abs(t - r.top) < r.height * 0.5)) tops.push(r.top);
            }
        }
        const edge = i < items.length - 1 ? items[i + 1].getBoundingClientRect().left : ul.getBoundingClientRect().right;
        return { gap: Math.round((edge - right) * 10) / 10, lines: tops.length };
    });
};

// ---- 07 資料夾樹的幾何（F5.6、F5.8 與樹的排法）----
// 收：{ tree: 樹的選擇器, line: 每一行的選擇器, descs: 第 3～6 行說明欄的字（tree.material、tree.readme、tree.index、tree.assets） }。
// 給（px，一位小數，以框的內緣為準）：scrollable（scrollWidth > clientWidth）、gapEnd（捲到最右之後，最右一個字的右緣到框的右內緣）、
//   padL（第一行第一個字到框的左內緣）、descX（第 3～6 行說明欄第一個字的 x，捲在最左時）、treeW（樹的外框寬）、colW（樹的外層那一欄的寬）。
export const TREE_GEOMETRY = ({ tree: treeSel, line: lineSel, descs }) => {
    const t = document.querySelector(treeSel);
    if (!t) return null;
    const round = (n) => Math.round(n * 10) / 10;
    const box = t.getBoundingClientRect();
    const innerL = () => t.getBoundingClientRect().left + t.clientLeft;
    const chars = (root) => {
        const out = [];
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            for (let k = 0; k < node.data.length; k += 1) out.push({ node, k, ch: node.data[k] });
        }
        return out;
    };
    const rect = ({ node, k }) => { const r = document.createRange(); r.setStart(node, k); r.setEnd(node, k + 1); return r.getBoundingClientRect(); };
    const lines = [...t.querySelectorAll(lineSel)];
    t.scrollLeft = 0;
    const first = chars(lines[0]).find((c) => c.ch.trim());
    const padL = first ? rect(first).left - innerL() : null;
    const descX = descs.map((d, i) => {
        const cs = chars(lines[i + 2]);
        const at = cs.map((c) => c.ch).join('').indexOf(d);
        return at < 0 ? null : round(rect(cs[at]).left - innerL());
    });
    const scrollable = t.scrollWidth > t.clientWidth;
    t.scrollLeft = t.scrollWidth;
    const right = Math.max(...chars(t).filter((c) => c.ch.trim()).map((c) => rect(c).right));
    const gapEnd = innerL() + t.clientWidth - right;
    t.scrollLeft = 0;
    return { scrollable, gapEnd: round(gapEnd), padL: round(padL), descX, treeW: round(box.width), colW: round(t.parentElement.getBoundingClientRect().width) };
};

// ---- 卡片排法與字到邊（F6.1、F6.5）----
// 收：卡片的選擇器（每一張一個元素）。給：cols（第一排有幾張：跟第一張同一個頂的卡片數）、w（第一張的寬）、
//   pad（第一張四邊內距裡最小的那個）、minGap（每一張卡裡所有字到卡片內緣（框線裡面）的最近距離，取所有卡片的最小值；
//   沒有框線、沒有底色的卡片也照量）、count（幾張）。px，一位小數。
export const CARD_GEOMETRY = (selector) => {
    const items = [...document.querySelectorAll(selector)].filter((e) => e.getBoundingClientRect().width > 0);
    if (!items.length) return null;
    const round = (n) => Math.round(n * 10) / 10;
    const top = items[0].getBoundingClientRect().top;
    const cols = items.filter((e) => Math.abs(e.getBoundingClientRect().top - top) < 2).length;
    const cs = getComputedStyle(items[0]);
    const pad = Math.min(...['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`padding${s}`])));
    let minGap = Infinity;
    for (const item of items) {
        const r = item.getBoundingClientRect();
        const c = getComputedStyle(item);
        const inner = { l: r.left + parseFloat(c.borderLeftWidth), r: r.right - parseFloat(c.borderRightWidth), t: r.top + parseFloat(c.borderTopWidth), b: r.bottom - parseFloat(c.borderBottomWidth) };
        const walk = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            if (!node.parentElement.checkVisibility()) continue;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (!g.width) continue;
                minGap = Math.min(minGap, g.left - inner.l, inner.r - g.right, g.top - inner.t, inner.b - g.bottom);
            }
        }
    }
    return { cols, w: round(items[0].getBoundingClientRect().width), pad: round(pad), minGap: round(minGap), count: items.length };
};

// ---- 09 章節一列的字到邊（F7.5）----
// 收：章節那幾列的選擇器（每一章一個 <li>）。一列＝<li> 裡第一顆 <button>（有影片時：按了從那一章播），沒有 <button> 就是 <summary>（沒有影片時：摘要的開關）；
//   有 <button> 時同一個 <li> 裡的 <summary> 是右邊那顆摘要開關。只量看得見的列（收在「看全部」裡的不算）。
// 給：padL（第一列的左內距）、minLeft（每一列的字到那一列左緣（框線裡面）最近的距離）、
//   minToggle（字的右緣到摘要開關左緣最近的距離，只算跟開關上下有重疊的字；沒有開關是 null；負的＝字壓到開關）、
//   clipped（字超出捲動容器看得見的範圍（左右）的字數）、rows（量了幾列）。px，一位小數。
export const CHAPTER_GEOMETRY = (selector) => {
    const items = [...document.querySelectorAll(selector)].filter((li) => li.checkVisibility());
    if (!items.length) return null;
    const round = (n) => Math.round(n * 10) / 10;
    const rowOf = (li) => li.querySelector('button') || li.querySelector('summary');
    let minLeft = Infinity;
    let minToggle = null;
    let clipped = 0;
    for (const li of items) {
        const row = rowOf(li);
        if (!row) continue;
        const toggle = li.querySelector('button') ? li.querySelector('summary') : null;
        const t = toggle && toggle.checkVisibility() ? toggle.getBoundingClientRect() : null;
        const r = row.getBoundingClientRect();
        const left = r.left + parseFloat(getComputedStyle(row).borderLeftWidth);
        let box = row.parentElement;
        while (box && box !== document.body && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(box).overflowX + getComputedStyle(box).overflowY)) box = box.parentElement;
        const view = box && box !== document.body ? box.getBoundingClientRect() : { left: 0, right: innerWidth };
        const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            if (!node.parentElement.checkVisibility()) continue;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (!g.width) continue;
                minLeft = Math.min(minLeft, g.left - left);
                if (g.left < view.left - 0.5 || g.right > view.right + 0.5) clipped += 1;
                if (t && Math.min(g.bottom, t.bottom) - Math.max(g.top, t.top) > 0) minToggle = Math.min(minToggle ?? Infinity, t.left - g.right);
            }
        }
    }
    const padL = parseFloat(getComputedStyle(rowOf(items[0])).paddingLeft);
    return { padL: round(padL), minLeft: round(minLeft), minToggle: minToggle === null ? null : round(minToggle), clipped, rows: items.length };
};

// ---- 10 支援裝置、11 公告、12 更新紀錄、13 常見問題、14 作者與社群、16 頁尾（F8.6）----
// 收：{ section: 那一區的選擇器, items: [{ key, sel, nth }] }（sel 在那一區裡找、取第 nth 個）。
// 給：{ key: [x, y, 寬, 高] }，x、y 是離那一區外框左上角的距離（px，一位小數）；找不到是 null，排出來沒有大小（收起來、藏起來）是 [0, 0, 0, 0]。
// 量設計稿（tools/measure-design.mjs）與量網站（f8-layout.test.js）用同一支。
export const BOXES = ({ section, items }) => {
    const sec = document.querySelector(section);
    if (!sec) return null;
    const s = sec.getBoundingClientRect();
    const round = (n) => Math.round(n * 10) / 10;
    const out = {};
    for (const { key, sel, nth } of items) {
        const el = sec.querySelectorAll(sel)[nth];
        if (!el) { out[key] = null; continue; }
        const r = el.getBoundingClientRect();
        out[key] = r.width || r.height ? [round(r.left - s.left), round(r.top - s.top), round(r.width), round(r.height)] : [0, 0, 0, 0];
    }
    return out;
};

// 10～16 的鍵 → 網站上怎麼找：字串表的 id 就是 data-id；同一個 id 出現第二次寫成「id#2」；author.photo 是 14 區的照片 <img>
export function f8Item(key) {
    if (key === 'author.photo') return { key, sel: 'img', nth: 0 };
    const [id, n] = key.split('#');
    return { key, sel: `[data-id="${id.replace(/["\\]/g, '\\$&')}"]`, nth: n ? Number(n) - 1 : 0 };
}
// 網站上這六區的選擇器（介面約定：README.md「10～16（F8）」）
export const F8_SECTIONS = { devices: '[data-section="devices"]', news: '[data-section="news"]', changelog: '[data-section="changelog"]', faq: '[data-section="faq"]', author: '[data-section="author"]', footer: 'footer[data-section="footer"]' };

// 斷行規則用的標點（與空白）：數「字」時不算
export const PUNCT = /[\s、。，．：；！？「」『』（）【】〈〉《》・…—–\-,.;:!?()[\]"'“”‘’]/u;

// 一區裡的版面問題：區塊重疊、控件小於 44、控件裡的字跑出框、在跑的動畫
export const SECTION_PROBLEMS = (sec) => {
    const root = document.querySelector(sec);
    if (!root) return null;
    const candidates = [...root.querySelectorAll('[data-id], [data-kind], [data-text], [data-body], [data-entry] h3, [data-entry] time, [data-version] h3, [data-version] time, [data-state="unreadable"]')]
        .filter((e) => e.checkVisibility());
    const set = new Set(candidates);
    const blocks = candidates.filter((e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) if (set.has(p)) return false; return true; });
    const name = (e) => e.dataset.id || (e.hasAttribute('data-kind') ? 'data-kind' : e.hasAttribute('data-text') ? 'data-text' : e.hasAttribute('data-body') ? 'data-body' : e.tagName.toLowerCase());
    const hits = [];
    for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i].getBoundingClientRect();
        const b = blocks[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) hits.push(`${name(blocks[i])}／${name(blocks[j])}`);
    }
    // 控件：連結、按鈕、<summary>；句子裡的連結（常見問題的答案裡）不算（§6）
    const controls = [...root.querySelectorAll('a, button, summary')].filter((e) => e.checkVisibility() && !e.closest('[data-id$=".a"]'));
    const small = [];
    const spill = [];
    for (const c of controls) {
        const r = c.getBoundingClientRect();
        const label = (c.getAttribute('aria-label') || c.textContent).trim().slice(0, 14);
        if (r.width < 43.5 || r.height < 43.5) small.push(`${label}（${Math.round(r.width)}×${Math.round(r.height)}）`);
        const walk = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
        let out = 0;
        while (walk.nextNode()) {
            const node = walk.currentNode;
            if (!node.parentElement.checkVisibility()) continue;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (!g.width) continue;
                if (g.left < r.left - 0.5 || g.right > r.right + 0.5 || g.top < r.top - 0.5 || g.bottom > r.bottom + 0.5) out += 1;
            }
        }
        if (out) spill.push(`${label}（${out} 個字）`);
    }
    const running = root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length;
    return { hits, small, spill, running };
};

export async function sectionSweep(page, label) {
    const bad = [];
    for (const [name, sec] of Object.entries(F8_SECTIONS)) {
        const s = page.locator(sec);
        if (!(await s.count())) { bad.push(`${label}：找不到 ${name}（${sec}）`); continue; }
        await s.evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.waitForTimeout(100);
        const r = await page.evaluate(SECTION_PROBLEMS, sec);
        if (r.hits.length) bad.push(`${label} ${name}：字壓到別的東西 ${r.hits.join('、')}`);
        if (r.small.length) bad.push(`${label} ${name}：小於 44×44 ${r.small.join('、')}`);
        if (r.spill.length) bad.push(`${label} ${name}：控件裡的字跑出框 ${r.spill.join('、')}`);
        if (r.running) bad.push(`${label} ${name}：減少動態時有 ${r.running} 個在跑的動畫`);
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (scroll > 0) bad.push(`${label}：整頁橫捲 ${scroll}px`);
    return bad;
}

// 使用者寫的內容（公告的標題與內文、更新紀錄的每一條）：中日文最後一行不只一個字（規格書 §7、§14；產生網頁時 bindTail 綁最後三個字）
export async function lastLineProblems(page, label) {
    const bad = [];
    const els = page.locator(`${F8_SECTIONS.news} :is([data-entry] h3, [data-body]), ${F8_SECTIONS.changelog} [data-text]`);
    const n = await els.count();
    for (let i = 0; i < n; i += 1) {
        const el = els.nth(i);
        if (!(await el.isVisible())) continue;
        const lines = await textLines(el);
        if (!lines.length) continue;
        const last = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(lines.at(-1))].map((s) => s.segment).filter((c) => !PUNCT.test(c));
        const total = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(lines.join(''))].filter((s) => !PUNCT.test(s.segment)).length;
        if (last.length < 2 && total >= 2) bad.push(`${label}：最後一行只剩一個字「${lines.at(-1)}」（${JSON.stringify(lines.slice(-2))}）`);
    }
    return bad;
}


// 鍵盤的起點：把焦點放到「在這個元素前面、最後一個 Tab 停得到的東西」上（看得到的連結、按鈕、<summary>、tabindex ≥ 0），
// 之後按一次 Tab 就是使用者從上一個東西 Tab 過來的那一下。（點一下不會拿到焦點的字，在 headless Chromium 裡不會把 Tab 的起點移過去 —— 量過，Tab 從頁首開始）
// 回傳那個東西的說明；前面沒有可以停的就回 null（那時 Tab 從頁首開始）。
export const FOCUS_BEFORE = (sel) => {
    const target = document.querySelector(sel);
    if (!target) return null;
    const all = [...document.querySelectorAll('a[href], button, summary, input, select, textarea, [tabindex]')]
        .filter((e) => e.tabIndex >= 0 && !e.disabled && e.checkVisibility() && (target.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING) && !e.contains(target));
    const last = all.at(-1);
    if (!last) return null;
    last.focus({ preventScroll: true });
    return `${last.tagName.toLowerCase()} ${(last.textContent || '').trim().slice(0, 16)}`;
};

// ---- 框裡的字到框的內緣，左右與上下分開量（F8.6）----
// 收：框的選擇器（每一個框一個元素）。給：padX／padY（第一個框左右、上下內距裡小的那個）、gapX／gapY（每個框裡看得到的字到框內緣（框線裡面）最近的距離，左右與上下分開，取所有框的最小值）、
// height／lines（最高的那一個框的外框高（含框線）與那個框的字排成幾行；14 社群「讀不到」排兩行時框要跟著長高，設計稿 004264c —— 設計稿畫在狀態一覽裡、
// 比網站的 14 窄（280 寬窄 32px），同一個寬度兩邊排的行數不一定一樣，所以框高要跟「設計稿排同樣行數時」比）、count。
// 分開量是因為按鈕這類「固定高度、字上下置中」的框上下內距寫 0，只看最小值的話左右內距縮掉也量不出來；卡片在同一排被拉高、字上下置中時，上下的距離會比內距大很多。
export const EDGE_GAPS = (selector) => {
    const items = [...document.querySelectorAll(selector)].filter((e) => e.getBoundingClientRect().width > 0);
    if (!items.length) return null;
    const round = (n) => Math.round(n * 10) / 10;
    const cs = getComputedStyle(items[0]);
    let gapX = Infinity;
    let gapY = Infinity;
    let height = 0;
    let lines = 0;
    for (const item of items) {
        const r = item.getBoundingClientRect();
        const c = getComputedStyle(item);
        const tops = [];
        const inner = { l: r.left + parseFloat(c.borderLeftWidth), r: r.right - parseFloat(c.borderRightWidth), t: r.top + parseFloat(c.borderTopWidth), b: r.bottom - parseFloat(c.borderBottomWidth) };
        const walk = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            if (!node.parentElement.checkVisibility()) continue;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (!g.width) continue;
                gapX = Math.min(gapX, g.left - inner.l, inner.r - g.right);
                gapY = Math.min(gapY, g.top - inner.t, inner.b - g.bottom);
                tops.push(g.top);
            }
        }
        // 行數：字的上緣排序後，跟上一個差超過半行高就是新的一行（同一行裡中日文與拉丁字的上緣會差幾 px）
        const half = (parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.2) / 2;
        const count = tops.sort((a, b) => a - b).filter((t, i) => i === 0 || t - tops[i - 1] > half).length;
        if (r.height > height) {
            height = r.height;
            lines = count;
        }
    }
    return {
        padX: round(Math.min(parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight))), padY: round(Math.min(parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom))),
        gapX: round(gapX), gapY: round(gapY), height: round(height), lines, count: items.length,
    };
};

// 網站的字到框邊要 ≥ 多少：設計稿那一邊有內距就是內距，內距寫 0（按鈕的上下）就是設計稿量到的距離；都減 1px 的容許
export const edgeFloor = (want) => ({ x: (want.padX > 0 ? want.padX : want.gapX) - 1, y: (want.padY > 0 ? want.padY : want.gapY) - 1 });

// ---- 「/」三語選單頁與 404（F8.6b）----
// 兩頁同一個版型（設計稿 4-3 的 .solo）：<main> 裡 <header>（記號 <img>；404 多一個 aria-hidden 的「404」；<h1> 裡三段各標 lang）、
// 一個 <ul>，每一個語言一個 <li lang>：一段說明 <p> 與一顆連到 /<語言>/ 的 <a>。設計稿與網站都用這組選擇器找（不靠 class 名稱）。
// 鍵：mark、code（只有 404）、title.<語言>、lead.<語言>、btn.<語言>；語言是 zh／en／ja，lang 屬性是 zh-Hant／en／ja。
const SOLO_LANG = { zh: 'zh-Hant', en: 'en', ja: 'ja' };
export function soloItems(page) {
    const items = [{ key: 'mark', sel: 'header img', nth: 0 }];
    if (page === '404') items.push({ key: 'code', sel: 'header [aria-hidden="true"]', nth: 0 });
    for (const [lang, attr] of Object.entries(SOLO_LANG)) {
        items.push({ key: `title.${lang}`, sel: `h1 [lang="${attr}"]`, nth: 0 });
        items.push({ key: `lead.${lang}`, sel: `li[lang="${attr}"] p`, nth: 0 });
        items.push({ key: `btn.${lang}`, sel: `li[lang="${attr}"] a`, nth: 0 });
    }
    return items;
}
export const SOLO_BUTTONS = 'main li[lang] a';

// 框裡的字到框內緣，用「行盒」量（EDGE_GAPS 量的是每個字的字形框）：每個字的上下各取那一行的行高（字形框的中線 ± 行高的一半）。
// 左右跟字形框一樣。給 { gapX, gapY }（所有框的最小值，px，一位小數）；找不到框是 null。
export const LINEBOX_GAPS = (selector) => {
    const items = [...document.querySelectorAll(selector)].filter((e) => e.getBoundingClientRect().width > 0);
    if (!items.length) return null;
    const round = (n) => Math.round(n * 10) / 10;
    let gapX = Infinity;
    let gapY = Infinity;
    for (const item of items) {
        const r = item.getBoundingClientRect();
        const c = getComputedStyle(item);
        const inner = { l: r.left + parseFloat(c.borderLeftWidth), r: r.right - parseFloat(c.borderRightWidth), t: r.top + parseFloat(c.borderTopWidth), b: r.bottom - parseFloat(c.borderBottomWidth) };
        const walk = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const node = walk.currentNode;
            if (!node.parentElement.checkVisibility()) continue;
            const pc = getComputedStyle(node.parentElement);
            const lh = parseFloat(pc.lineHeight) || parseFloat(pc.fontSize) * 1.2;
            for (let k = 0; k < node.data.length; k += 1) {
                if (!node.data[k].trim()) continue;
                const range = document.createRange();
                range.setStart(node, k);
                range.setEnd(node, k + 1);
                const g = range.getBoundingClientRect();
                if (!g.width) continue;
                const mid = (g.top + g.bottom) / 2;
                gapX = Math.min(gapX, g.left - inner.l, inner.r - g.right);
                gapY = Math.min(gapY, mid - lh / 2 - inner.t, inner.b - (mid + lh / 2));
            }
        }
    }
    return { gapX: round(gapX), gapY: round(gapY) };
};

// 字與底的對比（WCAG 的相對亮度）：收 [{ key, sel, nth }]（在 <main> 裡找），每一個回字色對它看得到的底色的比值（兩位小數）；找不到是 null。
// 底色：從元素往上找第一個不透明的 background-color（半透明的一層一層疊上去），都沒有就是 <html> 的。顏色交給 canvas 轉成 sRGB（oklch、color-mix 也吃）。
// 不算漸層與 ::before 的光暈（只看 background-color）。
export const CONTRAST = (items) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (color) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];   // getImageData 給的是沒有預乘的值
    };
    const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
    const lum = ([r, g, b]) => {
        const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const main = document.querySelector('main');
    const out = {};
    for (const { key, sel, nth } of items) {
        const el = main && main.querySelectorAll(sel)[nth];
        if (!el) { out[key] = null; continue; }
        const layers = [];
        for (let e = el; e; e = e.parentElement) {
            const c = rgba(getComputedStyle(e).backgroundColor);
            if (c[3] > 0) layers.push(c);
            if (c[3] >= 1) break;
        }
        let bg = [0, 0, 0, 1];
        if (!layers.length || layers.at(-1)[3] < 1) bg = rgba(getComputedStyle(document.documentElement).backgroundColor);
        for (const layer of layers.reverse()) bg = over(layer, bg);
        const fg = over(rgba(getComputedStyle(el).color), bg);
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        out[key] = Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
    }
    return out;
};
