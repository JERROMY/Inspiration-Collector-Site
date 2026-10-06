// F6b 圖片改吃裁切版：07 的大綱圖與 05 第 3 張終端機截圖，改用後端裁好的 WebP（public/images/images.json 有 crop 的那幾筆）。讀 out/，真的開瀏覽器。
//
// 前提：後端把那兩組圖改成裁切版 —— 大綱圖 ai-outline-<語言>-640.webp 與裁切寬那一張、終端機截圖 ai-terminal-<語言>-640.webp 與裁切寬那一張；原本的 -1280.webp 已刪。
// 檔名、寬高、裁切範圍一律從 images.json 讀（裁切範圍會照實際看得到的那一塊各邊多留一點，數字可能再變），測試不寫死。
// images.json 有裁切的那一筆是 { width, height（原圖）, crop {x,y,width,height}, sizes [{ file, width, height, bytes }] }。
// 網站要改成：srcset 用那兩個檔、sizes 寫圖實際畫出來的寬、CSS 不再在整張原圖上偏移（圖本身就是那一塊）—— 畫面看起來跟換圖之前一樣。
//
// 量什麼：
//   F6b.1 三語頁的 HTML 引用的每一個 /images/*.webp（src 與 srcset 每一項）在 out/images/ 與 public/images/ 都在；
//         開三語頁（1440 與 390）、捲到 05 與 07，網路請求裡 /images/ 全部 200。
//   F6b.2 大綱圖與終端機截圖的 srcset：每一項的檔名與 w 剛好是 images.json 那一筆 sizes 的檔名與寬度（一個不多一個不少）；沒有 -1280.webp。
//   F6b.3 三語 × 280、390、640、768、1024、1440 × 螢幕倍率 1、2、3：圖實際畫出來的寬 W（getBoundingClientRect）；
//         sizes 在這個寬度算出來的值跟 W 差 ≤ 10%；瀏覽器挑的檔（currentSrc）是「寬度 ≥ W × 倍率」裡最小的那個，沒有夠大的就是最大的那個。
//   F6b.4 畫面不變（跟換圖之前 c5b3787 那一版比；暫存資料夾現場取出、build）：三語 × 390、1024、1440，大綱圖與第 3 張截圖的框
//         （量之前只捲整頁、把外層框自己的捲動歸零，不用 scrollIntoView：見 CENTER）
//         位置、大小一樣（差 ≤ 0.5px）、圓角與括號角（::after）一樣；框的截圖逐像素比，平均差 ≤ 10 階（新圖解析度較高，邊緣會清楚一點）。
//         c5b3787 不在（公開 repo、淺 clone）時 skip。07、05 的長相之後改了，這條就拿掉（它只守這一次換圖）。
//   F6b.5 版面不變：同上那一版，三語 × 280、390、640、1024、1440，05 與 07 兩區的高度一樣（差 ≤ 1px）；兩張圖的 width／height 屬性的長寬比跟檔案一樣（差 ≤ 1%）。
//         CLS、逐行等其他的不退步由原本的測試守（F4.6、F4.6b、F5、F6）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F6b"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, OUT, LANGS, readOut, tagAttrs, playwright, browserSession, tail } from './helpers.js';
import { serve } from './server.js';

const IMAGES = JSON.parse(fs.readFileSync(path.join(SITE, 'public', 'images', 'images.json'), 'utf8'));
const BEFORE = 'c5b3787';
// 取換圖之前那一版的 git 工作樹（網站資料夾那一層）；預設就是這個網站自己（有 git 歷史時）。在別的複本跑時可以用 F6B_BEFORE_SITE 指到有那個 commit 的網站資料夾
const BEFORE_SITE = process.env.F6B_BEFORE_SITE || SITE;
const KINDS = { outline: { sec: 'forai', key: (lang) => `ai-outline-${lang}.png`, sel: '[data-section="forai"] img[src*="ai-outline"]' },
    terminal: { sec: 'how', key: (lang) => `ai-terminal-${lang}.png`, sel: '[data-section="how"] img[src*="ai-terminal"]' } };

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
let before = null;
after(async () => { await session?.close(); if (before) { await before.site?.close(); fs.rmSync(before.dir, { recursive: true, force: true }); } });

// 把元素捲到畫面中間：只捲整頁（window.scrollTo），不用 scrollIntoView —— 它會連圖外面 overflow: hidden 的框一起捲，
// 使用者捲不動那個框，量到的是使用者永遠看不到的位置（量過：1440 寬時框被捲了 53px）。順便把外層每一個框自己的捲動歸零。
const CENTER = (el) => {
    const root = document.scrollingElement;
    for (let p = el.parentElement; p && p !== root && p !== document.body; p = p.parentElement) {
        if (p.scrollTop || p.scrollLeft) { p.scrollTop = 0; p.scrollLeft = 0; }
    }
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - (innerHeight - r.height) / 2, behavior: 'instant' });
};

const srcsetOf = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [url, w] = x.split(/\s+/); return { url, w: parseInt(w, 10) }; });

// ---------- F6b.1 ----------

test('F6b.1 三語頁引用的 /images/*.webp 都在 out/images/ 與 public/images/', () => {
    const bad = [];
    for (const lang of LANGS) {
        const html = readOut(`${lang}/index.html`);
        const urls = new Set();
        for (const a of [...tagAttrs(html, 'img'), ...tagAttrs(html, 'source'), ...tagAttrs(html, 'link')]) {
            for (const u of [a.src, a.href, ...srcsetOf(a.srcset ?? a.imagesrcset).map((x) => x.url)]) if (u && /^\/images\/.*\.webp$/.test(u)) urls.add(u);
        }
        assert.ok(urls.size > 3, `防呆：${lang} 只找到 ${urls.size} 個 /images/ 的圖`);
        for (const u of urls) {
            const rel = u.replace(/^\//, '');
            if (!fs.existsSync(path.join(OUT, rel))) bad.push(`${lang}：${u} 不在 out/`);
            if (!fs.existsSync(path.join(SITE, 'public', rel))) bad.push(`${lang}：${u} 不在 public/`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 個圖檔不在`);
});

test('F6b.1 開三語頁捲到 05 與 07，/images/ 的請求全部 200（1440、390）', { skip: pw ? false : why }, async () => {
    const { site, browser } = await session.get();
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [1440, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            const seen = [];
            page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/images/')) seen.push(`${r.status()} ${u.pathname}`); });
            try {
                await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                for (const sec of ['how', 'forai']) {
                    await page.locator(`[data-section="${sec}"]`).evaluate((s) => s.scrollIntoView({ block: 'start', behavior: 'instant' }));
                    await page.waitForTimeout(400);
                    await page.locator(`[data-section="${sec}"]`).evaluate((s) => s.scrollIntoView({ block: 'end', behavior: 'instant' }));
                    await page.waitForTimeout(400);
                }
                await page.waitForLoadState('networkidle').catch(() => {});
                for (const s of seen) if (!s.startsWith('200 ')) bad.push(`${lang} ${width}：${s}`);
                for (const kind of Object.values(KINDS)) if (!seen.some((s) => s.includes(kind.key(lang).replace('.png', '')))) bad.push(`${lang} ${width}：沒有抓 ${kind.key(lang).replace('.png', '')} 的圖`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F6b.2 ----------

test('F6b.2 大綱圖與終端機截圖的 srcset 跟 images.json 一樣（檔名與寬度），沒有 -1280.webp', () => {
    const bad = [];
    for (const lang of LANGS) {
        const html = readOut(`${lang}/index.html`);
        for (const [name, kind] of Object.entries(KINDS)) {
            const entry = IMAGES[kind.key(lang)];
            assert.ok(entry?.crop && entry.sizes?.length, `防呆：images.json 要有 ${kind.key(lang)} 的裁切版（crop 與 sizes）`);
            const imgs = tagAttrs(html, 'img').filter((a) => (a.src || '').includes(kind.key(lang).replace('.png', '')));
            if (imgs.length !== 1) { bad.push(`${lang} ${name}：要剛好一張，得到 ${imgs.length}`); continue; }
            const got = srcsetOf(imgs[0].srcset).map((x) => `${x.url} ${x.w}w`).sort();
            const want = entry.sizes.map((s) => `/images/${s.file} ${s.width}w`).sort();
            if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${lang} ${name}：srcset 要是 ${want.join('、')}，得到 ${got.join('、') || '沒有'}`);
            if (!entry.sizes.some((s) => `/images/${s.file}` === imgs[0].src)) bad.push(`${lang} ${name}：src 要是 images.json 裡的其中一個檔，得到 ${imgs[0].src}`);
            if (/-1280\.webp/.test(`${imgs[0].src} ${imgs[0].srcset}`)) bad.push(`${lang} ${name}：還在用 -1280.webp`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F6b.3 ----------

// sizes 在目前視窗算出來是幾 px：第一個 media 成立（或沒有 media）的那一項，長度用一個暫時的元素量
const SIZES_PX = (img) => {
    const parts = (img.getAttribute('sizes') || '').split(',').map((p) => p.trim()).filter(Boolean);
    // 前面的 media 條件：一個或幾個用 and／or 接起來的括號（括號裡可能還有括號，calc() 裡也有括號，所以數括號，不用正規式）
    const split = (p) => {
        if (p[0] !== '(') return [null, p];
        let depth = 0;
        for (let i = 0; i < p.length; i += 1) {
            if (p[i] === '(') depth += 1;
            else if (p[i] === ')') {
                depth -= 1;
                if (depth === 0) {
                    const rest = p.slice(i + 1).trim();
                    const more = /^(and|or)\s+/.exec(rest);
                    if (more) { i = p.length - rest.length + more[0].length - 1; continue; }
                    return [p.slice(0, i + 1), rest];
                }
            }
        }
        return [null, p];
    };
    for (const p of parts) {
        const [media, len] = split(p);
        if (media && !matchMedia(media).matches) continue;
        const probe = document.createElement('div');
        probe.style.cssText = `position:absolute;visibility:hidden;width:${len}`;
        document.body.append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
    }
    return null;
};

for (const lang of LANGS) {
    test(`F6b.3 sizes 寫的是圖實際畫出來的寬、瀏覽器挑對檔（${lang}：280～1440 × 螢幕倍率 1、2、3）`, { skip: pw ? false : why, timeout: 10 * 60 * 1000 }, async () => {
        const { site, browser } = await session.get();
        const bad = [];
        for (const width of [280, 390, 640, 768, 1024, 1440]) {
            for (const dpr of [1, 2, 3]) {
                const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
                const page = await context.newPage();
                page.setDefaultTimeout(15000);
                try {
                    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                    for (const [name, kind] of Object.entries(KINDS)) {
                        const img = page.locator(kind.sel).first();
                        if (!(await img.count())) { bad.push(`${width} ${dpr}x ${name}：找不到圖`); continue; }
                        await img.evaluate(CENTER);
                        await img.evaluate((i) => (i.complete ? null : new Promise((d) => { i.onload = d; i.onerror = d; })));
                        const r = await img.evaluate((i, fn) => ({ w: i.getBoundingClientRect().width, src: new URL(i.currentSrc).pathname, sizes: (0, eval)(`(${fn})`)(i) }), SIZES_PX.toString());
                        const files = IMAGES[kind.key(lang)].sizes;
                        const need = r.w * dpr;
                        const enough = files.filter((f) => f.width >= need).sort((a, b) => a.width - b.width);
                        const want = enough[0] ?? [...files].sort((a, b) => b.width - a.width)[0];
                        if (r.sizes === null || Math.abs(r.sizes - r.w) > r.w * 0.1) bad.push(`${width} ${dpr}x ${name}：sizes 算出來 ${r.sizes === null ? '沒有' : Math.round(r.sizes)}px，圖實際畫 ${Math.round(r.w)}px（差要 ≤ 10%）`);
                        if (r.src !== `/images/${want.file}`) bad.push(`${width} ${dpr}x ${name}：要挑 ${want.file}（畫 ${Math.round(r.w)}px × ${dpr}），挑了 ${r.src}`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F6b.4、F6b.5：跟換圖之前比 ----------

function hasBefore() {
    const r = spawnSync('git', ['-C', BEFORE_SITE, 'cat-file', '-e', `${BEFORE}^{commit}`]);
    return r.status === 0;
}

async function beforeSite() {
    if (before) return before;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-before-'));
    const top = spawnSync('git', ['-C', BEFORE_SITE, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
    const rel = path.relative(fs.realpathSync(top), fs.realpathSync(BEFORE_SITE));
    const archive = spawnSync('sh', ['-c', `git -C "${top}" archive ${BEFORE} "${rel}" | tar -x -C "${dir}"`], { encoding: 'utf8' });
    assert.equal(archive.status, 0, `取出 ${BEFORE} 失敗：${archive.stderr}`);
    const copy = path.join(dir, rel);
    fs.cpSync(path.join(SITE, 'node_modules'), path.join(copy, 'node_modules'), { recursive: true, mode: fs.constants.COPYFILE_FICLONE, verbatimSymlinks: true });
    const run = spawnSync(process.execPath, [path.join(copy, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: copy, encoding: 'utf8', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, timeout: 10 * 60 * 1000 });
    assert.equal(run.status, 0, `${BEFORE} build 失敗：\n${tail(`${run.stdout}\n${run.stderr}`)}`);
    before = { dir, site: await serve(path.join(copy, 'out')) };
    return before;
}

// 圖所在的框（有括號角的那一層或 figure）：位置（相對它那一區的頂）、大小、圓角、括號角
const FRAME = (img) => {
    const f = img.closest('[data-corners]') || img.closest('figure') || img.parentElement;
    const sec = img.closest('[data-section]');
    const r = f.getBoundingClientRect();
    const s = sec.getBoundingClientRect();
    const a = getComputedStyle(f, '::after');
    const c = getComputedStyle(f);
    return { x: r.left, y: r.top - s.top, w: r.width, h: r.height, radius: c.borderRadius, after: `${a.content}|${a.inset}|${a.top}|${a.left}|${a.width}|${a.height}`, clip: { x: r.left, y: r.top, width: r.width, height: r.height } };
};

async function shoot(siteUrl, lang, width, sel) {
    const { browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    try {
        await page.goto(`${siteUrl}/${lang}/`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const img = page.locator(sel).first();
        // 先從圖往外把每一層框的捲動歸零，再把框（不是圖）捲到畫面中間
        await img.evaluate(CENTER);
        const box = await img.evaluateHandle((i) => i.closest('[data-corners]') || i.closest('figure') || i.parentElement);
        await box.evaluate(CENTER);
        await img.evaluate((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((d) => { i.onload = d; i.onerror = d; })));
        await page.waitForTimeout(300);
        const frame = await img.evaluate(FRAME);
        const png = await page.screenshot({ clip: { x: Math.round(frame.clip.x), y: Math.max(0, Math.round(frame.clip.y)), width: Math.round(frame.clip.width), height: Math.round(Math.min(frame.clip.height, 900)) } });
        const heights = await page.evaluate(() => Object.fromEntries(['how', 'forai'].map((s) => [s, document.querySelector(`[data-section="${s}"]`)?.getBoundingClientRect().height ?? null])));
        return { frame, png, heights, page, context };
    } catch (err) {
        await context.close();
        throw err;
    }
}

async function meanDiff(page, a, b) {
    return page.evaluate(async ([ua, ub]) => {
        const read = async (url) => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return { w: img.width, h: img.height, d: ctx.getImageData(0, 0, c.width, c.height).data }; };
        const [x, y] = [await read(ua), await read(ub)];
        if (x.w !== y.w || x.h !== y.h) return { size: `${x.w}×${x.h} 對 ${y.w}×${y.h}` };
        let sum = 0;
        for (let i = 0; i < x.d.length; i += 4) for (let k = 0; k < 3; k += 1) sum += Math.abs(x.d[i + k] - y.d[i + k]);
        return { mean: sum / (x.w * x.h * 3) };
    }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
}

const withBefore = pw ? (hasBefore() ? false : `沒有 ${BEFORE}（公開 repo 或淺 clone）`) : why;

test(`F6b.4 畫面不變：大綱圖與第 3 張截圖的框跟換圖之前（${BEFORE}）一樣（三語 × 390、1024、1440）`, { skip: withBefore, timeout: 20 * 60 * 1000 }, async () => {
    const old = await beforeSite();
    const { site } = await session.get();
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 1024, 1440]) {
            for (const [name, kind] of Object.entries(KINDS)) {
                const a = await shoot(old.site.url, lang, width, kind.sel);
                const b = await shoot(site.url, lang, width, kind.sel);
                try {
                    const label = `${lang} ${width} ${name}`;
                    for (const k of ['x', 'y', 'w', 'h']) if (Math.abs(a.frame[k] - b.frame[k]) > 0.5) bad.push(`${label}：框的 ${k} 換圖前 ${a.frame[k].toFixed(1)}、換圖後 ${b.frame[k].toFixed(1)}`);
                    if (a.frame.radius !== b.frame.radius) bad.push(`${label}：圓角 ${a.frame.radius} → ${b.frame.radius}`);
                    if (a.frame.after !== b.frame.after) bad.push(`${label}：括號角 ${a.frame.after} → ${b.frame.after}`);
                    const d = await meanDiff(b.page, a.png, b.png);
                    if (d.size) bad.push(`${label}：截圖大小不一樣 ${d.size}`);
                    // 第 3 張（terminal）2026-10-04 起刻意往左上移了 9px、1px（框貼著終端機視窗，使用者要求），畫面本來就不一樣：只比框的位置、大小、圓角、括號角
                    else if (d.mean > 10 && name !== 'terminal') bad.push(`${label}：框裡的畫面平均差 ${d.mean.toFixed(1)} 階（要 ≤ 10；圖錯位或縮放不對？）`);
                } finally {
                    await a.context.close();
                    await b.context.close();
                }
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test(`F6b.5 版面不變：05 與 07 的高度跟換圖之前（${BEFORE}）一樣；圖的 width／height 長寬比跟檔案一樣`, { skip: withBefore, timeout: 20 * 60 * 1000 }, async () => {
    const old = await beforeSite();
    const { site } = await session.get();
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [280, 390, 640, 1024, 1440]) {
            const a = await shoot(old.site.url, lang, width, KINDS.outline.sel);
            const b = await shoot(site.url, lang, width, KINDS.outline.sel);
            try {
                // 07 的大標 2026-10-04 拿掉句尾的句點（設計稿 14ecc90），斷行跟著變、高度不比；05 照比
                for (const sec of ['how']) if (Math.abs(a.heights[sec] - b.heights[sec]) > 1) bad.push(`${lang} ${width}：${sec} 的高度換圖前 ${a.heights[sec]?.toFixed(1)}、換圖後 ${b.heights[sec]?.toFixed(1)}`);
                if (width === 1440) {
                    for (const [name, kind] of Object.entries(KINDS)) {
                        const attr = await b.page.locator(kind.sel).first().evaluate((i) => ({ w: Number(i.getAttribute('width')), h: Number(i.getAttribute('height')) }));
                        const file = IMAGES[kind.key(lang)].sizes.at(-1);
                        if (!attr.w || !attr.h) bad.push(`${lang} ${name}：要寫 width 與 height`);
                        else if (Math.abs(attr.w / attr.h - file.width / file.height) > (file.width / file.height) * 0.01) bad.push(`${lang} ${name}：width／height ${attr.w}×${attr.h} 的長寬比跟檔案 ${file.width}×${file.height} 不一樣`);
                    }
                }
            } finally {
                await a.context.close();
                await b.context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});
