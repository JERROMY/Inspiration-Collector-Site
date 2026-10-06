/**
 * fallback-sweep-run.js —— 開瀏覽器，量「字型載好」與「字型擋掉、用回退字型」兩種樣子，每個區塊（data-id）的高度一不一樣。
 *
 * 每個「語言 × 寬度」開兩次頁面：一次正常載入、一次把 *.woff2 擋掉（只剩回退字型）；量每個看得到的 [data-id] 的高度（四捨五入，
 * 同一個 id 第二個起加 #2、#3…），用 compareBlocks 比。掃係數時，擋掉字型的那一頁留著，每換一個係數就把整組回退字型乘上係數、
 * 注入那一頁，再量一次。瀏覽器由呼叫端開好交進來（見 playwright-loader.js）。
 */
import { scaleFaces } from './fallback-fonts.js';
import { compareBlocks } from './fallback-sweep.js';

const HEIGHT = 900;
const WORKERS = 6;

/**
 * 在瀏覽器頁面裡跑的函式（會被序列化送進頁面，所以不能用外面的變數）：量每個看得到的 [data-id] 的高度。
 *
 * @returns {Record<string, number>} { data-id: 高度（四捨五入）}；同一個 id 第二個起加 #2、#3…
 */
function measureBlocks() {
    const heights = {};
    const seen = {};
    for (const element of document.querySelectorAll('[data-id]')) {
        if (element.getClientRects().length === 0 || (element.checkVisibility && !element.checkVisibility())) continue;
        const id = element.dataset.id;
        seen[id] = (seen[id] ?? 0) + 1;
        heights[seen[id] === 1 ? id : `${id}#${seen[id]}`] = Math.round(element.getBoundingClientRect().height);
    }
    return heights;
}

/**
 * 等字型（載好或擋掉）與版面都停下來：字型的事做完，再等兩個畫面。
 *
 * @param {any} page 頁面
 * @returns {Promise<void>}
 */
async function settle(page) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await document.fonts.ready;
    });
}

/**
 * @param {Array<() => Promise<void>>} jobs 要做的事
 * @returns {Promise<void>} 同時最多 WORKERS 件，全部做完
 */
async function inParallel(jobs) {
    const queue = jobs.slice();
    await Promise.all(Array.from({ length: WORKERS }, async () => {
        while (queue.length > 0) await queue.shift()();
    }));
}

/**
 * @param {object} input
 * @param {any} input.browser 開好的 Chromium
 * @param {string} input.url 網站的網址（http://127.0.0.1:埠）
 * @param {string[]} input.langs 語言（網址第一層：/zh/、/en/、/ja/）
 * @param {number[]} input.widths 視窗寬度
 * @param {{ lines: string[], family: string, weight: string, ks: number[] } | null} [input.scan] 掃係數：lines 是回退字型 CSS 的 @font-face 行，
 *   family 與 weight（"100 449"）挑出要整組乘係數的那一組，ks 是要試的係數；沒給就只比有沒有一致
 * @returns {Promise<Array<{ lang: string, width: number, bad: string[] }> | Array<{ k: number, bad: Array<{ lang: string, width: number, ids: string[] }> }>>}
 *   檢查：每個語言×寬度一筆（bad 是高度不一致的區塊 id）；掃描：每個係數一筆（bad 是不一致的語言×寬度與區塊）
 */
export async function runSweep({ browser, url, langs, widths, scan = null }) {
    const pages = [];
    const jobs = [];
    for (const lang of langs) {
        for (const width of widths) {
            const slot = { lang, width, want: null, page: null, context: null };
            pages.push(slot);
            jobs.push(async () => {
                const options = { viewport: { width, height: HEIGHT }, reducedMotion: 'reduce' };
                const normal = await browser.newContext(options);
                try {
                    const page = await normal.newPage();
                    await page.goto(`${url}/${lang}/`, { waitUntil: 'load' });
                    await settle(page);
                    slot.want = await page.evaluate(measureBlocks);
                } finally {
                    await normal.close();
                }
                slot.context = await browser.newContext(options);
                await slot.context.route('**/*.woff2', (route) => route.abort());
                slot.page = await slot.context.newPage();
                await slot.page.goto(`${url}/${lang}/`, { waitUntil: 'load' });
                await slot.page.evaluate(() => { const style = document.createElement('style'); style.id = 'sweep-k'; document.head.append(style); });
                await settle(slot.page);
            });
        }
    }
    try {
        await inParallel(jobs);
        if (!scan) {
            const checked = [];
            for (const slot of pages) checked.push({ lang: slot.lang, width: slot.width, bad: compareBlocks(slot.want, await slot.page.evaluate(measureBlocks)) });
            return checked;
        }
        const swept = [];
        for (const k of scan.ks) {
            const css = scaleFaces(scan.lines, { family: scan.family, from: scan.family, weight: scan.weight, k }).join('\n');
            const bad = [];
            await inParallel(pages.map((slot) => async () => {
                await slot.page.evaluate((text) => { document.getElementById('sweep-k').textContent = text; document.body.getBoundingClientRect(); }, css);
                await settle(slot.page);
                const ids = compareBlocks(slot.want, await slot.page.evaluate(measureBlocks));
                if (ids.length > 0) bad.push({ lang: slot.lang, width: slot.width, ids });
            }));
            const order = (item) => langs.indexOf(item.lang) * 1e6 + item.width;
            swept.push({ k, bad: bad.sort((a, b) => order(a) - order(b)) });
        }
        return swept;
    } finally {
        for (const slot of pages) await slot.context?.close();
    }
}
