/**
 * fallback-sweep.js —— 回退字型係數掃描的純函式：比對換字型前後每個區塊的高度、讀「起:迄:間隔」的係數範圍。純函式：不碰檔案、不碰瀏覽器。
 *
 * 換字型前後，一段字的行數變了，它的高度就變，底下整頁都被推動；所以掃描量每個 data-id 區塊的高度（四捨五入的整數），兩次比。
 * 開瀏覽器量、掃係數的是 `npm run fallback-sweep`，那一段不在這裡。
 */

/**
 * @param {Record<string, number>} want 第一次量到的 { data-id: 高度 }（字型載好的樣子）
 * @param {Record<string, number>} got 第二次量到的 { data-id: 高度 }（字型擋掉、用回退字型的樣子）
 * @returns {string[]} 高度不同、或第二次量不到的 id，照 id 排序；第二次多出來的 id 不算
 */
export function compareBlocks(want, got) {
    return Object.keys(want).filter((id) => got[id] === undefined || got[id] !== want[id]).sort();
}

/**
 * @param {string} text 係數範圍「起:迄:間隔」，例如 "0.98:1.02:0.01"（含迄）
 * @returns {number[]} 係數，由小到大，每個四捨五入到小數 4 位
 * @throws {Error} 格式不對（不是三個數字）、迄小於起、間隔不是正數
 */
export function parseKRange(text) {
    const parts = String(text).split(':');
    const [from, to, step] = parts.map((part) => (part.trim() === '' ? Number.NaN : Number(part)));
    if (parts.length !== 3 || [from, to, step].some((value) => !Number.isFinite(value))) throw new Error(`係數範圍要寫成「起:迄:間隔」（三個數字，例如 0.98:1.02:0.01），收到「${text}」`);
    if (to < from) throw new Error(`係數範圍的迄（${to}）不能小於起（${from}）`);
    if (step <= 0) throw new Error(`係數範圍的間隔要大於 0，收到 ${step}`);
    const count = Math.floor((to - from) / step + 1e-9);
    return Array.from({ length: count + 1 }, (_, index) => Math.round((from + index * step) * 10000) / 10000);
}
