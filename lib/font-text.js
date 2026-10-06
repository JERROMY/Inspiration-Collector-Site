/**
 * font-text.js —— 網頁字型要收哪些字：從文字檔取字、分辨哪些是「中日文」（走系統字型，不放網頁字型）。
 *
 * 純函式，不讀檔。`npm run fonts`（切字型）與 `npm run fonts:budget`（量預算與缺字）都用它，
 * 兩邊收字的規則只寫在這裡一次，不會一邊收、一邊不收。
 *
 * 「中日文」的定義（碼位範圍，見 CJK_RANGES）：CJK 部首與符號、CJK 標點（、。「」）、平假名與片假名（含「・」）、注音、
 * 筆畫與擴充、圈字、相容字、統一漢字、直排標點、全形與半形（，：（）！）、擴充 B 以後。
 * 不算中日文、要進拉丁字型的：「·」「—」「…」彎引號、「→」「↺」、€、é……；韓文、emoji 也不算（目前用不到）。
 */

/** 中日文的碼位範圍 [起, 迄]（含兩端），由小到大。 */
export const CJK_RANGES = [
    [0x2e80, 0x2fff], [0x3000, 0x303f], [0x3040, 0x30ff], [0x3100, 0x312f], [0x3190, 0x31ff], [0x3200, 0x33ff],
    [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xffef], [0x20000, 0x3ffff],
];

/**
 * @param {number} codePoint 碼位
 * @returns {boolean} 碼位是不是落在中日文的範圍裡
 */
export function isCjkCodePoint(codePoint) {
    return CJK_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high);
}

/**
 * 文字裡出現過的字：以碼位算（𠮷 是一個字）、不重複、照碼位由小到大。空白（含全形空白、BOM）不算。
 *
 * @param {string} text 文字檔的內容
 * @returns {string[]} 每個字一個元素
 * @throws {TypeError} text 不是字串
 */
export function charsOf(text) {
    if (typeof text !== 'string') throw new TypeError(`charsOf 只收字串，收到 ${typeof text}`);
    const seen = new Set();
    for (const ch of text) {
        if (!/\s/u.test(ch)) seen.add(ch);
    }
    return [...seen].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

/**
 * @param {string} ch 剛好一個字（一個碼位）
 * @returns {boolean} 是不是中日文（中日文走系統字型，不放網頁字型）
 * @throws {TypeError} ch 不是剛好一個碼位的字串
 */
export function isCjk(ch) {
    if (typeof ch !== 'string' || [...ch].length !== 1) throw new TypeError(`isCjk 只收剛好一個字的字串，收到 ${JSON.stringify(ch)}`);
    return isCjkCodePoint(ch.codePointAt(0));
}

/**
 * 缺了這個字，算不算「要補的缺字」：字母與數字（Unicode 的 L 與 N 類）算，符號、標點、組合符號、空白一類不算
 * （那些缺了，瀏覽器會改用系統字型顯示，看起來差一點但不壞）。
 *
 * @param {string} ch 剛好一個字
 * @returns {boolean} 是字母或數字
 * @throws {TypeError} ch 不是剛好一個碼位的字串
 */
export function isLetterOrNumber(ch) {
    if (typeof ch !== 'string' || [...ch].length !== 1) throw new TypeError(`isLetterOrNumber 只收剛好一個字的字串，收到 ${JSON.stringify(ch)}`);
    return /^[\p{L}\p{N}]$/u.test(ch);
}
