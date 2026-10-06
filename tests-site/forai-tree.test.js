// F5.6～F5.8 與樹的排法 —— 07 資料夾樹的細節（設計稿 350fdf4：ba016e9 之上改了 07 的樹；notes/4-4.md「給前端的事」5‴）。讀 out/，真的開瀏覽器。
//
// 量法：page-helpers.js 的 TREE_GEOMETRY（跟產生 fixtures/design-6511462.json 的 tree 同一套），以框的內緣為準：
//   gapEnd＝捲到最右之後最右一個字的右緣到框的右內緣；padL＝第一行第一個字到框的左內緣；descX＝第 3～6 行說明欄（tree.material…tree.assets）第一個字的 x；
//   treeW／colW＝樹的外框寬／它外層那一欄的寬；scrollable＝scrollWidth > clientWidth。
//
// 量什麼：
//   F5.6 右內距進捲動範圍（三語 × 有滑鼠十二種寬度＋只有手指 280、320、360、375、390、430、480、540、640、768、1024、1280）：gapEnd ≥ 15（設計內距 30 的一半）；
//        能捲的捲到最右再量，不用捲的直接量。紅的時候寫語言、寬度、模式、能不能捲、距離、設計稿的距離。
//   F5.7 鍵盤焦點框看得見（三語 × 有滑鼠 390、1440，減少動態）：焦點停在樹上、:focus-visible 成立；截圖量樹的框外 3px 那一圈 ——
//        上緣、左緣各三點、右緣上半段三點，每一邊至少兩點是螢光綠（#e0ff98 附近）；螢光綠對再外面 8px 的底色對比 ≥ 3:1。
//        下緣不量：1440 時大綱圖疊在樹的右下角，下緣大部分被蓋住（設計稿也是這樣）。
//   F5.8 桌機英日放得下（英文 1024、1280、1440，日文 1024，有滑鼠）：樹不用捲（scrollWidth ≤ clientWidth）；樹右邊沒有淡出蓋住字（右邊 48px 那一條，拿掉 mask 前後截圖每個像素差 ≤ 24；淡出時最右邊差一百以上，沒淡出只有合成的捨入差 6 左右）。
//        窄的時候照舊能滑、有淡出（英文 280～430、日文 280～414 的十二種寬度那幾個）：能捲、右邊那一條拿掉 mask 前後截圖差 > 24。
//   F5.6 樹的排法（三語 × 有滑鼠十二種寬度）：跟設計稿一樣 —— 樹寬／欄寬（1024～1279 整欄、1280 起 84%）差 ≤ 1%、左內距（1024～1279 是 24、其他 30）差 ≤ 1px、
//        說明欄的 x（檔名欄 13 個字寬、框線字用跟 JetBrains Mono 同寬的回退字）四行都一樣、跟設計稿差 ≤ 1px。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F5\\.[678]"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { WIDTHS, TREE_GEOMETRY, pool } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8')).tree;
const TOUCH = { isMobile: true, hasTouch: true };
const TOUCH_WIDTHS = [280, 320, 360, 375, 390, 430, 480, 540, 640, 768, 1024, 1280];
const TREE = '[data-section="forai"] [data-tree]';
const descsOf = (lang) => ['tree.material', 'tree.readme', 'tree.index', 'tree.assets'].map((id) => getPlainString(lang, id));

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, { touch = false, reduced = true } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: touch ? 844 : 900 }, ...(touch ? TOUCH : {}), ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return { page, context, tree: page.locator(TREE) };
}

async function geometry(lang, width, touch) {
    const { page, context, tree } = await open(lang, width, { touch });
    try {
        if (!(await tree.count())) return null;
        await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
        return await page.evaluate(TREE_GEOMETRY, { tree: TREE, line: '[data-line]', descs: descsOf(lang) });
    } finally {
        await context.close();
    }
}

const mode = (touch) => (touch ? '只有手指' : '有滑鼠');

for (const lang of LANGS) {
    test(`F5.6 樹的右內距在捲動範圍裡（${lang}：有滑鼠十二種寬度、只有手指 280～1280）：最右的字到框的右內緣 ≥ 15px`, { skip: pw ? false : why }, async () => {
        const combos = [...WIDTHS.map((w) => [w, false]), ...TOUCH_WIDTHS.map((w) => [w, true])];
        const got = await pool(combos, 6, ([w, t]) => geometry(lang, w, t));
        const bad = [];
        combos.forEach(([width, touch], i) => {
            const g = got[i];
            const d = DESIGN[lang][touch ? 'touch' : 'mouse'][String(width)];
            if (!g) { bad.push(`${lang} ${width} ${mode(touch)}：找不到樹`); return; }
            if (!(g.gapEnd >= 15)) bad.push(`${lang} ${width} ${mode(touch)}（${g.scrollable ? '能捲，捲到最右' : '不用捲'}）：最右的字到框的右內緣 ${g.gapEnd}px，要 ≥ 15（設計稿 ${d?.gapEnd}）`);
        });
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F5.6 樹的排法跟設計稿一樣（${lang}，有滑鼠十二種寬度）：樹寬／欄寬、左內距、說明欄的 x`, { skip: pw ? false : why }, async () => {
        const got = await pool(WIDTHS, 6, (w) => geometry(lang, w, false));
        const bad = [];
        WIDTHS.forEach((width, i) => {
            const g = got[i];
            const d = DESIGN[lang].mouse[String(width)];
            if (!g) { bad.push(`${width}：找不到樹`); return; }
            if (Math.abs(g.treeW / g.colW - d.treeW / d.colW) > 0.01) bad.push(`${width}：樹寬／欄寬 ${(g.treeW / g.colW).toFixed(3)}，設計稿 ${(d.treeW / d.colW).toFixed(3)}（1024～1279 整欄、1280 起 84%）`);
            if (Math.abs(g.padL - d.padL) > 1) bad.push(`${width}：左內距 ${g.padL}，設計稿 ${d.padL}`);
            if (g.descX.some((x) => x === null)) bad.push(`${width}：第 3～6 行找不到說明欄的字`);
            else {
                if (Math.max(...g.descX) - Math.min(...g.descX) > 0.5) bad.push(`${width}：說明欄四行沒對齊 ${g.descX.join('、')}`);
                if (Math.abs(g.descX[0] - d.descX[0]) > 1) bad.push(`${width}：說明欄的 x ${g.descX[0]}，設計稿 ${d.descX[0]}（檔名欄 13 個字寬、框線字跟 JetBrains Mono 同寬）`);
            }
        });
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

const LIME = [224, 255, 152];
const near = (p, c, tol = 60) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) < tol;
const lum = (p) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// 截一塊圖，在頁面裡解碼，回傳指定座標的像素（座標是畫面座標）
async function pixels(page, clip, points) {
    const png = await page.screenshot({ clip });
    return page.evaluate(async ({ url, clip, points }) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return points.map(([x, y]) => [...ctx.getImageData(Math.round(x - clip.x), Math.round(y - clip.y), 1, 1).data].slice(0, 3));
    }, { url: `data:image/png;base64,${png.toString('base64')}`, clip, points });
}

test('F5.7 樹的鍵盤焦點框看得見（三語 × 有滑鼠 390、1440）：上、左、右緣看得到螢光綠，對底對比 ≥ 3:1', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const width of [390, 1440]) {
            const { page, context, tree } = await open(lang, width);
            try {
                if (!(await tree.count())) { bad.push(`${lang} ${width}：找不到樹`); continue; }
                await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
                await page.keyboard.press('Shift');
                await tree.focus();
                await page.waitForTimeout(200);
                const fv = await tree.evaluate((t) => document.activeElement === t && t.matches(':focus-visible'));
                if (!fv) { bad.push(`${lang} ${width}：焦點要停在樹上、:focus-visible 成立`); continue; }
                const r = await tree.evaluate((t) => { const b = t.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
                const clip = { x: Math.max(0, Math.floor(r.x - 16)), y: Math.max(0, Math.floor(r.y - 16)), width: Math.ceil(r.w + 32), height: Math.ceil(r.h + 32) };
                const edges = {
                    上緣: [0.25, 0.5, 0.75].map((f) => [[r.x + r.w * f, r.y - 3], [r.x + r.w * f, r.y - 11]]),
                    左緣: [0.25, 0.5, 0.75].map((f) => [[r.x - 3, r.y + r.h * f], [r.x - 11, r.y + r.h * f]]),
                    右緣: [0.15, 0.3, 0.45].map((f) => [[r.x + r.w + 2, r.y + r.h * f], [r.x + r.w + 10, r.y + r.h * f]]),
                };
                for (const [edge, pairs] of Object.entries(edges)) {
                    const px = await pixels(page, clip, pairs.flat());
                    let hits = 0;
                    for (let i = 0; i < pairs.length; i += 1) {
                        const ring = px[i * 2];
                        const bg = px[i * 2 + 1];
                        if (near(ring, LIME)) {
                            hits += 1;
                            if (contrast(ring, bg) < 3) bad.push(`${lang} ${width} ${edge}：焦點框對底對比 ${contrast(ring, bg).toFixed(2)}，要 ≥ 3`);
                        }
                    }
                    if (hits < 2) bad.push(`${lang} ${width} ${edge}：三點裡只有 ${hits} 點看得到螢光綠焦點框（淡出的 mask 把框外裁掉了？）`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 樹右邊 48px 那一條：有 mask 與拿掉 mask 各截一次，比每個像素差多少（淡出時最右邊幾乎整個透明，差好幾十；有 mask 但沒淡出時只有合成的捨入誤差）
const FADE_DIFF = 24;
async function fadeDiff(page, tree) {
    const r = await tree.evaluate((t) => { const b = t.getBoundingClientRect(); return { x: b.right - 48, y: b.top, width: 46, height: b.height }; });
    const clip = { x: Math.floor(r.x), y: Math.max(0, Math.floor(r.y)), width: Math.floor(r.width), height: Math.floor(Math.min(r.height, 400)) };
    const a = await page.screenshot({ clip });
    await tree.evaluate((t) => { t.style.setProperty('mask', 'none', 'important'); t.style.setProperty('-webkit-mask', 'none', 'important'); });
    const b = await page.screenshot({ clip });
    await tree.evaluate((t) => { t.style.removeProperty('mask'); t.style.removeProperty('-webkit-mask'); });
    return page.evaluate(async ([ua, ub]) => {
        const read = async (url) => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; };
        const [da, db] = [await read(ua), await read(ub)];
        let max = 0;
        for (let i = 0; i < da.length; i += 4) for (let k = 0; k < 3; k += 1) max = Math.max(max, Math.abs(da[i + k] - db[i + k]));
        return max;
    }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
}
const fadeCovers = async (page, tree) => (await fadeDiff(page, tree)) > FADE_DIFF;

test('F5.8 桌機英日放得下（英文 1024、1280、1440，日文 1024）：不用捲、右邊沒有淡出蓋住字', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [lang, width] of [['en', 1024], ['en', 1280], ['en', 1440], ['ja', 1024]]) {
        const { page, context, tree } = await open(lang, width);
        try {
            if (!(await tree.count())) { bad.push(`${lang} ${width}：找不到樹`); continue; }
            await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
            const s = await tree.evaluate((t) => ({ sw: t.scrollWidth, cw: t.clientWidth }));
            if (s.sw > s.cw) bad.push(`${lang} ${width}：樹要放得下、不用捲（scrollWidth ${s.sw} > clientWidth ${s.cw}）`);
            if (await fadeCovers(page, tree)) bad.push(`${lang} ${width}：放得下時右邊不能有淡出（拿掉 mask 前後截圖差很多）`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F5.8 窄的時候照舊能滑、有淡出（英文 280～430、日文 280～414，有滑鼠）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [lang, widths] of [['en', [280, 320, 360, 375, 390, 414, 430]], ['ja', [280, 320, 360, 375, 390, 414]]]) {
        for (const width of widths) {
            const { page, context, tree } = await open(lang, width);
            try {
                if (!(await tree.count())) { bad.push(`${lang} ${width}：找不到樹`); continue; }
                await tree.evaluate((t) => t.scrollIntoView({ block: 'center', behavior: 'instant' }));
                const s = await tree.evaluate((t) => ({ sw: t.scrollWidth, cw: t.clientWidth }));
                if (!(s.sw > s.cw)) bad.push(`${lang} ${width}：樹要能滑（scrollWidth ${s.sw}、clientWidth ${s.cw}）`);
                else if (!(await fadeCovers(page, tree))) bad.push(`${lang} ${width}：能滑的時候右邊要有淡出`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});
