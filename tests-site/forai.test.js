// F5.1 資料夾樹、F5.2 大綱圖與四點、F5.4 文案、F5.5 通用 —— 07 為 AI 做的。讀 out/（真的內容），真的開瀏覽器。
// 照設計稿第四批（350fdf4：ba016e9 之上改了 07 的樹）的 {zh,en,ja}/index.html 07 那一段、home.css「07 為 AI 做的」、動態.md 07 那張表；規格書 §5-07、§8。
// 右邊「AI 開始打字」是另一段，這裡不量；現在那個位置放的是靜態的大綱圖（設計稿的樣子）。
//
// 介面（README.md「07 為 AI 做的與 GoatCounter（F5）」）：
//   <section data-section="forai" id="for-ai">；字串表的每一段字畫在 data-id="<id>" 的元素裡：forai.eyebrow、forai.title、forai.1～forai.4（四點，每一點一個 <li>）、
//   forai.agents（AI 工具那一排的 <ul>，每一個名字一個 <li>）；資料夾樹是 [data-tree]（role="region"、tabindex="0"、aria-label＝tree.label），七行各是一個 [data-line]；
//   大綱圖是 07 裡 src 有 ai-outline 的 <img>。
//
// 量什麼：
//   F5.1 結構（三語，關掉 JS）：section 的 id 是 for-ai；樹有 role="region"、tabindex="0"、aria-label＝tree.label；剛好七行，依序是 tree.root、tree.topic、
//        MATERIAL.md＋tree.material、README.md＋tree.readme、index.json＋tree.index、assets/＋tree.assets、tree.file。
//   F5.1 跟著捲動長出來（三語 × 有滑鼠 1440×900、只有手指 390×844）：從樹剛要進畫面（樹的頂在畫面下緣下面一點）往下捲到樹的頂在畫面 20% 的地方，分 16 步、每步等兩個畫格：
//        一開始七行都是透明（< 0.5），最後七行都是 1；看得見的行數只增不減、中間有「一部分看得見」的時候（一行一行長）；第 N 行看得見時前面的行都看得見；
//        再捲回一開始的位置，七行又都透明（往回捲收回去）。
//   F5.1 減少動態（三語 1440）：沒捲之前與捲到之後，七行透明度都是 1，樹的行身上沒有在跑的動畫。
//   F5.1 關掉 JS（三語 1440）：把樹捲到畫面中間，七行透明度都是 1。
//   F5.1 太寬在自己的框裡滑（三語 × 280、320、390，只有手指）：overflow-x 是 auto 或 scroll；280 寬時樹一定比框寬（scrollWidth > clientWidth）；整頁不橫捲；
//        比框寬的時候：樹在最左邊時右邊有淡出（mask-image 不是 none），捲到最右邊時淡出收掉（mask-image 跟最左邊時不一樣）。放得下時（例如中文 390）不要求滑、不要求淡出。
//   F5.1 程式不聽 scroll 事件：public/ 的 .js 與 app/、components/ 的程式沒有 addEventListener('scroll' 與 onscroll（用捲動時間軸或 IntersectionObserver）。
//   F5.2 大綱圖（三語）：srcset 剛好是 images.json 裡 ai-outline-<語言>.png 那一筆的檔與寬度（不寫死尺寸）、src 是 webp、alt＝forai.outline.alt、有 width 與 height、loading="lazy"。
//   F5.2 四點與 AI 工具（三語 1440）：四點各一個 <li>（forai.1～4），每一點的 ::before 是那個小括號記號（有內容、寬高跟設計稿一樣 14×16，差 ≤ 1px），07 裡沒有 checkbox；
//        forai.agents 那一排的名字＝字串表 forai.agents 用「、」或「, 」切開的那幾個、照順序，每一個是 3px 圓角的小標籤（跟設計稿一樣）、不換行。
//   F5.2 排法（三語）：1024、1280、1440 寬時樹在左、四點在右（樹的左緣 < 四點的左緣，兩個都在大標下面）；280～768 時四點在上、樹在下。
//   F5.4 文案（三語 × 十二種寬度，有滑鼠、減少動態）：forai.eyebrow、forai.title、forai.1～4 的每一行跟設計稿一樣（fixtures/design-lines-07.json）；
//        四點中日文每一行 ≥ 5、≤ 25 字寬、行首沒有孤標點，英文沒有只有一個字的行。
//   F5.5 通用（三語 × 十二種寬度，減少動態）：整頁不橫捲、07 的 data-id 區塊彼此不重疊；捲到 07 之後 07 裡沒有在跑的動畫（減少動態；
//        跟著捲動走的動畫不算 —— 樹右邊的淡出跟著手指的捲動改變，設計稿說減少動態時照樣有）；
//        關掉 JS 時 07 每一個 data-id 的字都在、看得到。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F5\\.[1245]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, listFiles } from './helpers.js';
import { textLines, width as wide, WIDTHS } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8')).forai;
const LINES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-07.json'), 'utf8')).lines;
const TOUCH = { isMobile: true, hasTouch: true };
const IDS = ['forai.eyebrow', 'forai.title', 'forai.1', 'forai.2', 'forai.3', 'forai.4'];
const POINTS = ['forai.1', 'forai.2', 'forai.3', 'forai.4'];
const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;
const say = (lang, id) => getPlainString(lang, id);
const IMAGES = JSON.parse(fs.readFileSync(path.join(SITE, 'public', 'images', 'images.json'), 'utf8'));

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, { height, touch = false, js = true, reduced = false } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? TOUCH : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const sec = page.locator('[data-section="forai"]');
    return { page, context, sec, tree: sec.locator('[data-tree]'), lines: sec.locator('[data-tree] [data-line]') };
}

// 等兩個畫格；關掉 JS 時頁面裡的 requestAnimationFrame、setTimeout 都不會回呼，所以在這邊最多等 400ms
const frames = (page) => Promise.race([page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))).catch(() => {}), page.waitForTimeout(400)]);
const opacities = (lines) => lines.evaluateAll((ls) => ls.map((l) => parseFloat(getComputedStyle(l).opacity)));

// ---------- F5.1 ----------

for (const lang of LANGS) {
    test(`F5.1 資料夾樹的結構（${lang}）：section id、樹的 role、tabindex、aria-label、七行的字`, { skip: pw ? false : why }, async () => {
        const { context, sec, tree, lines } = await open(lang, 1440, { js: false });
        try {
            assert.equal(await sec.count(), 1, '要有一個 [data-section="forai"]');
            assert.equal(await sec.getAttribute('id'), 'for-ai', '07 的 section id 要是 for-ai');
            assert.equal(await tree.count(), 1, '07 裡要有一個 [data-tree]');
            assert.equal(await tree.getAttribute('role'), 'region', '樹要是 role="region"（讀屏報得出這是一塊可以捲的區域）');
            assert.equal(await tree.getAttribute('tabindex'), '0', '樹要 tabindex="0"（鍵盤停得到、才捲得動）');
            assert.equal(await tree.getAttribute('aria-label'), say(lang, 'tree.label'), `樹的讀屏名字是 tree.label「${say(lang, 'tree.label')}」`);
            const text = (await lines.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
            assert.equal(text.length, 7, `樹要剛好七行（data-line），得到 ${text.length}`);
            const want = [[say(lang, 'tree.root')], [say(lang, 'tree.topic')], ['MATERIAL.md', say(lang, 'tree.material')], ['README.md', say(lang, 'tree.readme')],
                ['index.json', say(lang, 'tree.index')], ['assets/', say(lang, 'tree.assets')], [say(lang, 'tree.file')]];
            want.forEach((parts, i) => parts.forEach((p) => assert.ok(text[i]?.includes(p), `第 ${i + 1} 行要有「${p}」，得到「${text[i]}」`)));
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    for (const [label, width, touch] of [['有滑鼠 1440', 1440, false], ['只有手指 390', 390, true]]) {
        test(`F5.1 樹跟著捲動一行一行長出來、往回捲收回去（${lang} ${label}）`, { skip: pw ? false : why }, async () => {
            const { page, context, tree, lines } = await open(lang, width, { touch });
            try {
                assert.equal(await lines.count(), 7, '防呆：樹要有七行');
                const top = await tree.evaluate((t) => t.getBoundingClientRect().top + scrollY);
                const vh = await page.evaluate(() => innerHeight);
                const from = Math.max(0, top - vh - 40);
                const to = top - vh * 0.2;
                const samples = [];
                for (let i = 0; i <= 16; i += 1) {
                    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), from + ((to - from) * i) / 16);
                    await frames(page);
                    samples.push(await opacities(lines));
                }
                // 最後一步多等一秒再量一次（照時間播的做法也有時間播完），看的是「捲到這裡之後全部出來」
                await page.waitForTimeout(1000);
                samples[16] = await opacities(lines);
                const shown = samples.map((o) => o.filter((v) => v >= 0.99).length);
                const bad = [];
                if (!samples[0].every((v) => v < 0.5)) bad.push(`樹剛要進畫面時七行都要透明，得到 ${samples[0].map((v) => v.toFixed(2)).join(' ')}`);
                if (!samples[16].every((v) => v >= 0.99)) bad.push(`捲到樹的頂在畫面 20% 時七行都要出來，得到 ${samples[16].map((v) => v.toFixed(2)).join(' ')}`);
                if (shown.some((n, i) => i > 0 && n < shown[i - 1])) bad.push(`往下捲時看得見的行數只能增加，得到 ${shown.join(',')}`);
                if (!shown.some((n) => n > 0 && n < 7)) bad.push(`要一行一行長出來（中間有一部分看得見的時候），得到 ${shown.join(',')}`);
                samples.forEach((o, s) => o.forEach((v, i) => { if (v >= 0.99 && o.slice(0, i).some((u) => u < 0.99)) bad.push(`第 ${s} 步：第 ${i + 1} 行出來了、前面還有沒出來的（${o.map((x) => x.toFixed(2)).join(' ')}）`); }));
                await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), from);
                await frames(page);
                await page.waitForTimeout(1000);
                const back = await opacities(lines);
                if (!back.every((v) => v < 0.5)) bad.push(`捲回去之後七行要收回去（透明），得到 ${back.map((v) => v.toFixed(2)).join(' ')}`);
                assert.deepEqual(bad.slice(0, 6), [], `${bad.length} 處不對`);
            } finally {
                await context.close();
            }
        });
    }
}

test('F5.1 減少動態（三語 1440）：沒捲之前與捲到之後七行都是 1、沒有在跑的動畫', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, tree, lines } = await open(lang, 1440, { reduced: true });
        try {
            const before = await opacities(lines);
            assert.ok(before.length === 7 && before.every((v) => v === 1), `${lang}：沒捲之前七行透明度都是 1，得到 ${before.join(' ')}`);
            await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await frames(page);
            const after = await opacities(lines);
            assert.ok(after.every((v) => v === 1), `${lang}：捲到之後七行透明度都是 1，得到 ${after.join(' ')}`);
            const running = await lines.evaluateAll((ls) => ls.flatMap((l) => l.getAnimations()).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length);
            assert.equal(running, 0, `${lang}：減少動態時樹的行身上不能有在跑的動畫`);
        } finally {
            await context.close();
        }
    }
});

test('F5.1 關掉 JS（三語 1440）：樹捲到畫面中間時七行都看得到', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context, tree, lines } = await open(lang, 1440, { js: false });
        try {
            assert.equal(await tree.count(), 1, `${lang}：07 裡要有一個 [data-tree]`);
            await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await frames(page);
            const o = await opacities(lines);
            assert.ok(o.length === 7 && o.every((v) => v >= 0.99), `${lang}：關掉 JS 時七行都要看得到，得到 ${o.join(' ')}`);
        } finally {
            await context.close();
        }
    }
});

for (const lang of LANGS) {
    test(`F5.1 樹太寬時在自己的框裡左右滑、右邊淡出、整頁不橫捲（${lang} 只有手指 280、320、390）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of [280, 320, 390]) {
            const { page, context, tree } = await open(lang, width, { touch: true });
            try {
                if (!(await tree.count())) { bad.push(`${width}：找不到 [data-tree]`); continue; }
                await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
                await frames(page);
                const s = await tree.evaluate((t) => { const c = getComputedStyle(t); return { sw: t.scrollWidth, cw: t.clientWidth, ox: c.overflowX, mask: c.maskImage || c.webkitMaskImage }; });
                if (!['auto', 'scroll'].includes(s.ox)) bad.push(`${width}：樹的 overflow-x 要是 auto 或 scroll，得到 ${s.ox}`);
                // 放得下（中文的檔名比較短，390 寬時剛好放得下）就沒得滑、也不淡出；280 寬三語都放不下（檔名 COLLECT-… 一行 32 個等寬字），一定要滑
                if (width === 280 && !(s.sw > s.cw)) bad.push(`280：樹要比框寬（在框裡滑），scrollWidth ${s.sw}、clientWidth ${s.cw}`);
                if (s.sw > s.cw) {
                    if (!s.mask || s.mask === 'none') bad.push(`${width}：樹在最左邊時右邊要淡出（mask-image），得到 ${s.mask}`);
                    await tree.evaluate((t) => { t.scrollLeft = t.scrollWidth; });
                    await frames(page);
                    const end = await tree.evaluate((t) => { const c = getComputedStyle(t); return c.maskImage || c.webkitMaskImage; });
                    if (s.mask && s.mask !== 'none' && end === s.mask) bad.push(`${width}：捲到最右邊時淡出要收掉（mask-image 要跟最左邊時不一樣），兩邊都是 ${end}`);
                }
                const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                if (scroll > 0) bad.push(`${width}：整頁橫捲 ${scroll}px`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

test('F5.1 程式不聽 scroll 事件（用捲動時間軸或 IntersectionObserver）', () => {
    const files = [
        ...fs.readdirSync(path.join(SITE, 'public')).filter((n) => n.endsWith('.js')).map((n) => `public/${n}`),
        ...['app', 'components'].flatMap((top) => listFiles(path.join(SITE, top)).filter((r) => /\.(m?js|jsx)$/.test(r)).map((r) => `${top}/${r}`)),
    ];
    assert.ok(files.length > 5, '防呆：程式檔太少');
    const bad = files.filter((rel) => {
        const src = fs.readFileSync(path.join(SITE, rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        return /addEventListener\(\s*['"]scroll['"]|\bonscroll\b|onScroll\s*=/.test(src);
    });
    assert.deepEqual(bad, [], `這幾支聽了 scroll 事件：${bad.join('、')}`);
});

// ---------- F5.2 ----------

test('F5.2 大綱圖（三語）：WebP 兩個尺寸的 srcset、alt＝forai.outline.alt、寬高、lazy', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { context, sec } = await open(lang, 1440, { js: false });
        try {
            const img = sec.locator('img[src*="ai-outline"]');
            assert.equal(await img.count(), 1, `${lang}：07 裡要有一張 ai-outline 的大綱圖`);
            const a = await img.evaluate((i) => ({ src: i.getAttribute('src'), srcset: i.getAttribute('srcset') || '', alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), loading: i.getAttribute('loading') }));
            const set = a.srcset.split(',').map((s) => s.trim().split(/\s+/).join(' '));
            const entry = IMAGES[`ai-outline-${lang}.png`];
            assert.ok(entry?.sizes?.length >= 2, `${lang}：images.json 要有 ai-outline-${lang}.png 那一筆、至少兩個尺寸`);
            const want = entry.sizes.map((s) => `/images/${s.file} ${s.width}w`).sort();
            assert.deepEqual([...set].sort(), want, `${lang}：srcset 要剛好是 images.json 那一筆的檔與寬度，得到 ${a.srcset}`);
            assert.match(a.src, new RegExp(`^/images/ai-outline-${lang}-\\d+\\.webp$`), `${lang}：src 要是這個語言的 webp`);
            assert.equal(a.alt, say(lang, 'forai.outline.alt'), `${lang}：alt 要是 forai.outline.alt`);
            assert.ok(Number(a.w) > 0 && Number(a.h) > 0, `${lang}：要寫 width 與 height（不讓版面跳）`);
            assert.equal(a.loading, 'lazy', `${lang}：首屏以下的圖要 loading="lazy"`);
        } finally {
            await context.close();
        }
    }
});

test('F5.2 四點前面是括號小記號、AI 工具是 3px 小標籤（三語 1440）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { context, sec } = await open(lang, 1440, { reduced: true });
        try {
            for (const id of POINTS) {
                const li = sec.locator(`li[data-id="${id}"], [data-id="${id}"]`).first();
                if (!(await li.count())) { bad.push(`${lang}：找不到 ${id}`); continue; }
                const m = await li.evaluate((el) => { const host = el.closest('li') || el; const b = getComputedStyle(host, '::before'); return { tag: host.tagName, content: b.content, w: parseFloat(b.width), h: parseFloat(b.height) }; });
                if (m.tag !== 'LI') bad.push(`${lang} ${id}：每一點要是 <li>`);
                if (m.content === 'none' || m.content === 'normal') bad.push(`${lang} ${id}：前面要有括號小記號（::before）`);
                else if (Math.abs(m.w - DESIGN[lang].marker[0]) > 1 || Math.abs(m.h - DESIGN[lang].marker[1]) > 1) bad.push(`${lang} ${id}：括號記號 ${m.w}×${m.h}，設計稿 ${DESIGN[lang].marker.join('×')}`);
            }
            if (await sec.locator('input[type="checkbox"]').count()) bad.push(`${lang}：07 裡不能有 checkbox（不是待辦清單）`);
            const want = say(lang, 'forai.agents').split(/、|,\s*/).map((s) => s.trim()).filter(Boolean);
            const tags = sec.locator('[data-id="forai.agents"] li');
            const got = (await tags.allTextContents()).map((t) => t.trim());
            if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${lang}：AI 工具要是 ${want.join('｜')}（照順序、一個名字一個 <li>），得到 ${got.join('｜')}`);
            const styles = await tags.evaluateAll((ts) => ts.map((t) => { const c = getComputedStyle(t); return { r: c.borderTopLeftRadius, ws: c.whiteSpace, over: t.scrollWidth > t.clientWidth + 1 }; }));
            styles.forEach((s, i) => {
                if (s.r !== DESIGN[lang].tagRadius) bad.push(`${lang}：第 ${i + 1} 個小標籤圓角 ${s.r}，要 ${DESIGN[lang].tagRadius}（不會按的標籤，方角）`);
                if (s.ws !== 'nowrap') bad.push(`${lang}：第 ${i + 1} 個小標籤要不換行（nowrap）`);
                if (s.over) bad.push(`${lang}：第 ${i + 1} 個小標籤的字跑出框`);
            });
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F5.2 排法（三語）：1024 起樹在左、四點在右；280～768 四點在上、樹在下', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of WIDTHS) {
            const { context, sec, tree } = await open(lang, width, { reduced: true });
            try {
                const box = async (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top + scrollY, b: r.bottom + scrollY }; });
                if (!(await tree.count()) || !(await sec.locator('[data-id="forai.1"]').count())) { bad.push(`${lang} ${width}：找不到樹或四點`); continue; }
                const t = await box(tree);
                const p = await box(sec.locator('[data-id="forai.1"]').first());
                const h = await box(sec.locator('[data-id="forai.title"]').first());
                if (width >= 1024) {
                    if (!(t.l < p.l)) bad.push(`${lang} ${width}：樹要在左、四點在右（樹左緣 ${t.l}、四點左緣 ${p.l}）`);
                    if (!(t.t >= h.b - 1 && p.t >= h.b - 1)) bad.push(`${lang} ${width}：樹與四點都要在大標下面`);
                } else if (!(p.b <= t.t + 1)) bad.push(`${lang} ${width}：四點要在樹的上面（四點底 ${p.b}、樹頂 ${t.t}）`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F5.4 ----------

for (const lang of LANGS) {
    test(`F5.4 07 的文案（${lang}，十二種寬度）：每一行跟設計稿一樣；四點照斷行規則`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { context, sec } = await open(lang, width, { reduced: true });
            try {
                for (const id of IDS) {
                    const el = sec.locator(`[data-id="${id}"]`).first();
                    if (!(await el.count())) { bad.push(`${width} ${id}：找不到`); continue; }
                    const got = await textLines(el);
                    const want = LINES[lang][String(width)][id];
                    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${width} ${id}：網站 ${JSON.stringify(got)}，設計稿 ${JSON.stringify(want)}`);
                    if (POINTS.includes(id)) {
                        for (const line of got) {
                            if (lang === 'en') { if (!/\s/.test(line)) bad.push(`${width} ${id}：一行只有一個字「${line}」`); continue; }
                            if (wide(line) < 5 || wide(line) > 25) bad.push(`${width} ${id}：一行 ${wide(line)} 字寬（要 5～25）「${line}」`);
                            if (HEAD_PUNCT.test(line)) bad.push(`${width} ${id}：行首是孤標點「${line}」`);
                        }
                    }
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// ---------- F5.5 ----------

for (const lang of LANGS) {
    test(`F5.5 07 通用（${lang}，十二種寬度、減少動態）：不橫捲、區塊不重疊、捲到之後沒有在跑的動畫`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context, sec } = await open(lang, width, { reduced: true });
            try {
                if (!(await sec.count())) { bad.push(`${width}：找不到 07`); continue; }
                await sec.evaluate((s) => s.scrollIntoView({ block: 'start', behavior: 'instant' }));
                await frames(page);
                const r = await sec.evaluate((s) => {
                    const boxes = [...s.querySelectorAll('[data-id], [data-tree]')].filter((e) => e.checkVisibility() && !e.parentElement.closest('[data-id], [data-tree]'))
                        .map((e) => ({ id: e.dataset.id || 'tree', r: e.getBoundingClientRect() }));
                    const hits = [];
                    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
                        const a = boxes[i].r;
                        const b = boxes[j].r;
                        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) hits.push(`${boxes[i].id}／${boxes[j].id}`);
                    }
                    return { hits, scroll: document.documentElement.scrollWidth - innerWidth, running: s.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length };
                });
                if (r.scroll > 0) bad.push(`${width}：整頁橫捲 ${r.scroll}px`);
                if (r.hits.length) bad.push(`${width}：重疊 ${r.hits.join('、')}`);
                if (r.running) bad.push(`${width}：減少動態時 07 裡有 ${r.running} 個在跑的動畫`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

test('F5.5 關掉 JS（三語 390、1440）：07 每一段字都在、看得到', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 1440]) {
            const { context, sec } = await open(lang, width, { js: false });
            try {
                for (const id of [...IDS, 'forai.agents']) {
                    const el = sec.locator(`[data-id="${id}"]`).first();
                    if (!(await el.count()) || !(await el.isVisible())) { bad.push(`${lang} ${width}：${id} 看不到`); continue; }
                    const text = (await el.textContent()).replace(/\s+/g, '');
                    const want = say(lang, id).replace(/\s+/g, '');
                    if (id !== 'forai.agents' && text !== want) bad.push(`${lang} ${width}：${id} 的字要是「${say(lang, id)}」，得到「${(await el.textContent()).trim()}」`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});
