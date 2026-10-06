/**
 * og-run.js —— 開瀏覽器，把設計師的分享卡版面拍成三張 1200×630 的 PNG。
 *
 * 做事的順序：
 * 1. 從專案根目錄開一個本機伺服器（static-site.js 的 serveSite；稿裡的 CSS 是從根目錄往上四層連的，不能用 file:// 開）。
 * 2. 每個語言各開一個頁面（1200×630、一倍螢幕、減少動態）：等字型與版面停下來 → 查有沒有錯（console、頁面例外、檔載不到、字型沒載到、
 *    字撐破版面、畫字用了沒指定的字型）→ 記下實際畫字的字型 → 拍照。
 * 3. 三張都拍完才回傳；每一張的問題都收起來，由呼叫端決定要不要寫檔（有任何問題就一張都不寫）。
 *
 * 瀏覽器由呼叫端開好交進來（見 playwright-loader.js）。
 */
import { HEIGHT, LANGS, WIDTH, fontProblems, overflowProblems, sizeProblems } from './og.js';
import { serveSite } from './static-site.js';

/**
 * 用 Chrome DevTools Protocol 問每個元素實際用哪些字型畫字（CSS.getPlatformFontsForNode）。
 *
 * @param {any} context 瀏覽器的 context
 * @param {any} page 頁面
 * @returns {Promise<Array<{ used: string[], named: string[] }>>} 每個畫了字的元素：實際用的家族、它的 font-family 寫的家族
 */
async function platformFonts(context, page) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'body *' });
    const nodes = [];
    for (const nodeId of nodeIds) {
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        if (fonts.length === 0) continue;
        const { computedStyle } = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
        const family = computedStyle.find((property) => property.name === 'font-family')?.value ?? '';
        nodes.push({
            used: fonts.map((font) => font.familyName),
            named: family.split(',').map((name) => name.trim().replace(/^["']|["']$/g, '')),
        });
    }
    return nodes;
}

/**
 * 拍一個語言。
 *
 * @param {any} browser 開好的 Chromium
 * @param {string} url 本機伺服器的網址
 * @param {string} lang 語言
 * @returns {Promise<{ png: Buffer, fonts: string[], problems: string[] }>} 圖、實際用到的字型家族、這一張的問題（沒有問題是空陣列）
 */
async function shoot(browser, url, lang) {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    try {
        const page = await context.newPage();
        const problems = [];
        // 檔載不到會同時有一則 console 錯誤（只有一句 Failed to load resource）與 response 的狀態碼：留後者，它有網址
        page.on('console', (message) => {
            if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(`console 錯誤：${message.text()}`);
        });
        page.on('pageerror', (error) => problems.push(`頁面丟例外：${error.message}`));
        page.on('response', (response) => {
            if (response.status() >= 400) problems.push(`有檔載不到：${response.url()}（${response.status()}）`);
        });
        page.on('requestfailed', (request) => problems.push(`有檔載不到：${request.url()}`));

        await page.goto(`${url}/design/homepage/og/${lang}/index.html`, { waitUntil: 'load' });
        // 字型與版面都停下來再量、再拍
        await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await document.fonts.ready;
        });
        const failedFaces = await page.evaluate(() => [...document.fonts].filter((face) => face.status === 'error').map((face) => face.family.replace(/^["']|["']$/g, '')));
        for (const family of new Set(failedFaces)) problems.push(`字型沒載到：${family}（@font-face 的檔載不進來）`);
        problems.push(...overflowProblems(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))));
        const { used, problems: fontIssues } = fontProblems(await platformFonts(context, page));
        problems.push(...fontIssues);
        const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
        problems.push(...sizeProblems(lang, png));
        return { png, fonts: used, problems: [...new Set(problems)] };
    } finally {
        await context.close();
    }
}

/**
 * @param {object} input
 * @param {any} input.browser 開好的 Chromium
 * @param {string} input.root 專案根目錄
 * @returns {Promise<Record<string, { png: Buffer, fonts: string[], problems: string[] }>>} 語言 → 拍的結果（三個語言都拍，不是遇到壞的就停）
 */
export async function shootAll({ browser, root }) {
    // 本機伺服器用網站已經防好的那支（擋 ..、符號連結、空字元、壞編碼），不自己再寫一支
    const server = await serveSite(root);
    try {
        const shots = {};
        for (const lang of LANGS) shots[lang] = await shoot(browser, server.url, lang);
        return shots;
    } finally {
        await server.close();
    }
}
