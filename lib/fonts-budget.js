/**
 * fonts-budget.js —— 網頁字型的預算檢查：大小有沒有超過、有沒有放中日文字型、文字裡有哪些字字型裡沒有。純函式，不讀檔。
 *
 * 三項檢查（`npm run fonts:budget` 讀好檔案、把資料交進來）：
 * 1. 預算：所有 .woff2 合計不超過上限（150 KB）。
 * 2. 沒有中日文字型（中日文字元不會觸發網頁字型下載，走系統字型）：每個 .woff2 的 cmap 都沒有中日文字；fonts.css 每個 @font-face 都有 unicode-range、而且不碰中日文碼位
 *    （沒寫 unicode-range 等於全部的字，中文頁也會去下載）。
 * 3. 缺字：文字裡的非中日文字，不在「所有瘦身檔 cmap 的聯集」裡的。字母與數字缺了算要補（問題）；
 *    符號與標點等缺了只警告（瀏覽器會用系統字型顯示，看起來差一點但不壞）。中日文走系統字型，不算缺字。
 */
import { isLetterOrNumber, isCjkCodePoint } from './font-text.js';
import { overlapsCjk, parseFontFaces, parseUnicodeRange } from './fonts.js';

const REQUIRED_FONT = 'GoogleSansFlex-site.woff2';

/**
 * @param {string} ch 一個字
 * @returns {string} 「ä（U+00E4）」這種寫法：字與碼位（大寫十六進位、至少 4 位）
 */
function describe(ch) {
    return `${ch}（U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}）`;
}

/**
 * @param {{ name: string, codePoints: number[] | null, error?: string }[]} fonts 每個 .woff2 一筆（讀得了才有 codePoints）
 * @returns {string[]} 有中日文字的字型、讀不了的字型，每個一行問題
 */
function checkFontFiles(fonts) {
    const problems = [];
    for (const font of fonts) {
        if (font.codePoints === null) {
            problems.push(`${font.name} 讀不了：${font.error}`);
            continue;
        }
        const cjk = font.codePoints.filter(isCjkCodePoint);
        if (cjk.length > 0) problems.push(`${font.name} 有中日文字（${cjk.length} 個，例如 ${describe(String.fromCodePoint(cjk[0]))}）：中日文要走系統字型，不放網頁字型`);
    }
    return problems;
}

/**
 * @param {string | null} css fonts.css 的內容；沒有這個檔是 null
 * @returns {string[]} 每個問題一行：沒有 fonts.css、@font-face 沒寫 unicode-range、unicode-range 讀不懂或碰到中日文
 */
function checkCss(css) {
    if (css === null) return ['缺 fonts.css（要有它，才量得到中文頁會不會去下載網頁字型）'];
    const problems = [];
    parseFontFaces(css).forEach((face, i) => {
        const label = `fonts.css 的第 ${i + 1} 個 @font-face（${face['font-family'] ?? '沒有 font-family'}）`;
        if (!face['unicode-range']) {
            problems.push(`${label} 沒寫 unicode-range（等於全部的字，中文頁也會去下載；中日文走系統字型）`);
            return;
        }
        try {
            if (overlapsCjk(parseUnicodeRange(face['unicode-range']))) problems.push(`${label} 的 unicode-range 碰到中日文碼位（${face['unicode-range']}）：中日文不放網頁字型`);
        } catch (err) {
            problems.push(`${label}：${err.message}`);
        }
    });
    return problems;
}

/**
 * @param {object} input
 * @param {{ name: string, bytes: number, codePoints: number[] | null, error?: string }[]} input.fonts 資料夾裡每個 .woff2 一筆
 * @param {string | null} input.css fonts.css 的內容；沒有這個檔是 null
 * @param {string[]} input.chars 文字檔裡的非中日文字（每個元素一個字，不含空白）
 * @param {number} input.limit 所有 .woff2 合計的上限（位元組）
 * @returns {{ total: number, problems: string[], warnings: string[] }}
 *   total 是所有 .woff2 的位元組合計；problems 非空就是沒過（每項一行，講出是哪個檔或哪些字）；warnings 只是提醒
 */
export function checkFonts({ fonts, css, chars, limit }) {
    const total = fonts.reduce((sum, font) => sum + font.bytes, 0);
    const problems = [];
    const warnings = [];
    if (total > limit) problems.push(`超過預算：.woff2 合計 ${total} 位元組，上限 ${limit} 位元組（多了 ${total - limit}）`);
    if (!fonts.some((font) => font.name === REQUIRED_FONT)) problems.push(`缺 ${REQUIRED_FONT}（內文字型；請執行 npm run fonts）`);
    problems.push(...checkFontFiles(fonts), ...checkCss(css));

    const have = new Set(fonts.flatMap((font) => font.codePoints ?? []));
    const lacking = chars.filter((ch) => !have.has(ch.codePointAt(0)));
    const important = lacking.filter(isLetterOrNumber);
    const minor = lacking.filter((ch) => !isLetterOrNumber(ch));
    if (important.length > 0) problems.push(`缺字（字母或數字，字型裡沒有）：${important.map(describe).join('、')}。請重跑 npm run fonts 補進去`);
    if (minor.length > 0) warnings.push(`缺字（符號或標點，會用系統字型顯示）：${minor.map(describe).join('、')}`);
    return { total, problems, warnings };
}
