// 4-b13 的量測工具（不是測試；scripts/test.mjs 只跑 *.test.js）：量 07 大綱圖與 05 第 3 張終端機截圖在框裡「實際露出」的矩形，換算回原圖 1920×1080 的像素，
// 寫成 visible-rects.json 的形狀（同一個資料夾那份就是這支量出來的）。裁切框（scripts/images.config.json）要包住這些矩形。
//
// 用法（在 homepage/site/）：
//   SITE_PLAYWRIGHT=<Playwright 套件的資料夾> node tests/fixtures/images-crop/measure-visible.mjs \
//     --site <name>=<網站資料夾>=<網址樣式> [--site …] --out <輸出的 json>
//   <網址樣式> 裡的 {lang} 換成 zh、en、ja，例如：
//     --site c5b3787=<換圖之前那一版 build 出來的 out/>=/{lang}/
//     --site design350=<設計稿取出來的根目錄>=/design/homepage/{lang}/index.html
//   設計稿那一版要連 clipper/css 與 clipper/fonts 一起取出（設計稿的頁面連到 ../../../clipper/css/）。
//
// 量法：
//   - 三語 × 有滑鼠 280、320、360、375、390、414、430、640、768、1024、1280、1440 ＋ 只有手指 280、320、360、375、390、430、480、540、640、768、1024、1280（isMobile、hasTouch）。
//   - 找到圖（設計稿 .crop--outline img、.crop--step3 img；網站 [data-section="forai"] img[src*="ai-outline"]、[data-section="how"] img[src*="ai-terminal"]）。
//   - **只捲整頁（window.scrollTo），再把圖往上每一層的 scrollTop／scrollLeft 歸零**。不能用 scrollIntoView：它會連 overflow: hidden 的框一起捲
//     （1440 時把框捲了 53px），量到的是使用者看不到的位置 —— 2026-10-03 第一次量就踩到，量到 y 約 259（實際是 143）。
//   - 露出的矩形 ＝ 圖的 getBoundingClientRect 跟每一層 overflow 不是 visible 的祖先（內距框：clientLeft、clientTop、clientWidth、clientHeight）取交集；
//     圖畫出來的寬對應原圖 1920，換算成原圖像素。
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { site: { type: 'string', multiple: true }, out: { type: 'string' }, playwright: { type: 'string' } } });
const pwDir = values.playwright || process.env.SITE_PLAYWRIGHT;
if (!pwDir || !values.out || !values.site?.length) {
    console.error('用法：SITE_PLAYWRIGHT=<Playwright 的資料夾> node measure-visible.mjs --site <name>=<資料夾>=<網址樣式> … --out <json>');
    process.exit(2);
}
const pw = createRequire(import.meta.url)(pwDir);
const MOUSE = [280, 320, 360, 375, 390, 414, 430, 640, 768, 1024, 1280, 1440];
const TOUCH = [280, 320, 360, 375, 390, 430, 480, 540, 640, 768, 1024, 1280];
const SELECTORS = {
    design: { outline: '.crop--outline img', terminal: '.crop--step3 img' },
    site: { outline: '[data-section="forai"] img[src*="ai-outline"]', terminal: '[data-section="how"] img[src*="ai-terminal"]' },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve(root) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
            if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
            if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
            res.end(fs.readFileSync(file));
        });
        server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }));
    });
}

async function measure(page, selector) {
    return page.evaluate(async (selector) => {
        const img = document.querySelector(selector);
        if (!img) return null;
        const first = img.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + first.top - innerHeight / 3);
        for (let e = img.parentElement; e && e !== document.body; e = e.parentElement) { e.scrollTop = 0; e.scrollLeft = 0; }
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (!img.complete) await new Promise((r) => { img.addEventListener('load', r, { once: true }); setTimeout(r, 3000); });
        const r = img.getBoundingClientRect();
        let c = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        for (let e = img.parentElement; e && e !== document.body; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
                const q = e.getBoundingClientRect();
                const L = q.left + e.clientLeft;
                const T = q.top + e.clientTop;
                c = { l: Math.max(c.l, L), t: Math.max(c.t, T), r: Math.min(c.r, L + e.clientWidth), b: Math.min(c.b, T + e.clientHeight) };
            }
        }
        const s = 1920 / r.width;
        return { x: (c.l - r.left) * s, y: (c.t - r.top) * s, w: (c.r - c.l) * s, h: (c.b - c.t) * s };
    }, selector);
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const rows = [];
const browser = await pw.chromium.launch();
for (const spec of values.site) {
    const [name, root, pattern] = spec.split('=');
    const server = await serve(path.resolve(root));
    for (const lang of ['zh', 'en', 'ja']) {
        for (const [mode, widths] of [['mouse', MOUSE], ['touch', TOUCH]]) {
            for (const width of widths) {
                const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(mode === 'touch' ? { isMobile: true, hasTouch: true } : {}) });
                const page = await context.newPage();
                await page.goto(server.url + pattern.replace('{lang}', lang), { waitUntil: 'load' });
                await page.evaluate(() => document.fonts.ready);
                // 設計稿與網站的 class 不一樣：先找設計稿的（.crop--outline），沒有就用網站的
                const selectors = (await page.$(SELECTORS.design.outline)) ? SELECTORS.design : SELECTORS.site;
                for (const kind of ['outline', 'terminal']) {
                    const got = await measure(page, selectors[kind]);
                    if (!got) throw new Error(`${name} ${lang} ${mode} ${width}：找不到 ${kind} 的圖`);
                    rows.push({ site: name, lang, mode, width, image: `ai-${kind}-${lang}.png`, x: r3(got.x), y: r3(got.y), w: r3(got.w), h: r3(got.h) });
                }
                await context.close();
            }
        }
    }
    server.close();
}
await browser.close();
fs.writeFileSync(values.out, JSON.stringify({ note: '4-b13：大綱圖與終端機截圖在框裡實際露出的矩形（原圖像素）。量法見 measure-visible.mjs。', rows }, null, 1) + '\n');
console.log(`寫好了：${values.out}（${rows.length} 筆）`);
