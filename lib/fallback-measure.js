/**
 * fallback-measure.js —— 在瀏覽器裡量字寬：每個字在 Google Sans Flex（網頁字型）與 Arial 的寬度比，照「字級×字重」各量一份。
 *
 * 量法：Chromium 裡每個字重複 40 次、關掉字距調整（font-kerning: none），量重複之後的總寬再除以 40；
 * 網頁字型直接用字型檔（base64 內嵌在空白頁裡，不靠任何網站）；Arial 在 600 以上對 Arial Bold（700），其他對 Arial（400）；
 * 光學尺寸照 roles 的 opsz：數字就固定那個值，"auto" 就跟字級走（跟網頁裡自己寫 font: 簡寫的元素一樣）。
 * 量的是這台機器裝的 Arial，所以不同機器的結果可能不同。
 *
 * 瀏覽器由呼叫端開好交進來（見 playwright-loader.js），這裡不載入 Playwright。
 */
import fs from 'node:fs';

const FAMILY = 'Google Sans Flex';

/**
 * 在瀏覽器頁面裡跑的函式（會被序列化送進頁面，所以不能用外面的變數）：量一組字級×字重每個字的寬度比。
 *
 * @param {[number, number | string, number, number[]]} args [字級 px, opsz（數字或 "auto"）, 字重, 碼位們]
 * @returns {Array<[number, number]>} 每個碼位的 [碼位, 網頁字型的寬 ÷ Arial 的寬]
 */
function measureInPage([size, opsz, weight, codes]) {
    const settings = opsz === 'auto' ? 'normal' : `"opsz" ${opsz}`;
    const width = (char, family, fontWeight) => {
        const span = document.createElement('span');
        span.style.cssText = `position:absolute;white-space:pre;font-family:${family};font-size:${size}px;font-weight:${fontWeight};font-kerning:none;font-variation-settings:${settings}`;
        span.textContent = char.repeat(40);
        document.body.append(span);
        const value = span.getBoundingClientRect().width / 40;
        span.remove();
        return value;
    };
    return codes.map((code) => {
        const char = String.fromCodePoint(code);
        return [code, width(char, '"Google Sans Flex"', weight) / width(char, 'Arial', weight >= 600 ? 700 : 400)];
    });
}

/**
 * @param {object} input
 * @param {any} input.browser 開好的 Chromium（呼叫端負責關）
 * @param {string} input.woff2 網頁字型檔（GoogleSansFlex-site.woff2）的路徑
 * @param {Array<{ suffix: string, size: number, opsz: number | string, weights: number[] }>} input.roles 字級×字重
 * @param {number[]} input.codes 要量的碼位（網頁字型負責的字）
 * @param {string} input.baseFamily 回退字型的 font-family 名字（後面加 suffix）
 * @returns {Promise<Array<{ family: string, weight: number, ratios: Array<[number, number]> }>>} 每一組（family＋字重）量到的 [碼位, 寬度比]
 * @throws {Error} 網頁字型載不進瀏覽器（檔壞了）：中文
 */
export async function measureRatios({ browser, woff2, roles, codes, baseFamily }) {
    const page = await browser.newPage();
    try {
        const data = fs.readFileSync(woff2).toString('base64');
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"${FAMILY}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:300 700;font-style:normal}</style><body></body>`);
        const ready = await page.evaluate(async () => {
            await document.fonts.load('400 16px "Google Sans Flex"');
            await document.fonts.ready;
            return document.fonts.check('16px "Google Sans Flex"');
        });
        if (!ready) throw new Error(`網頁字型 ${woff2} 載不進瀏覽器（檔案壞了？）`);
        const measurements = [];
        for (const { suffix, size, opsz, weights } of roles) {
            for (const weight of weights) {
                measurements.push({ family: `${baseFamily}${suffix}`, weight, ratios: await page.evaluate(measureInPage, [size, opsz, weight, codes]) });
            }
        }
        return measurements;
    } finally {
        await page.close();
    }
}
