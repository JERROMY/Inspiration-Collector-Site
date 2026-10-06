/**
 * links.js —— 讀社群連結（content/links.md，三種語言共用一支）。
 *
 * 格式：一行一個「- 代號 · 網址」，例如「- threads · https://www.threads.com/@jerromy」。
 * 代號只收英文小寫與數字，同時是 icon 的檔名（icons/<代號>.svg）與流量統計的名字，所以同一個代號只能出現一次。
 *
 * 給網頁用的紀錄：
 *   好的  { ok: true, code, url }
 *   壞的  { ok: false, line, raw, reason }
 * 寫壞一行只壞那一行，不丟例外、不靜靜略過。
 */
import { bad, dotReason, isListItem, readFlat, shown, splitFields, urlProblem } from './entries.js';

const CODE = /^[a-z0-9]+$/;
const SHAPE = '要寫成「- 代號 · 網址」';

/**
 * 一行「- 代號 · 網址」。代號重複時，先出現的算數，後面那行算壞。
 *
 * @param {import('./lines.js').Line} line 一行（已去註解、非空白）
 * @param {Map<string, number>} seen 已經讀成好紀錄的代號 → 它在第幾行；好的才會記進去
 * @returns {object} { ok: true, code, url } 或壞紀錄
 */
function readLink(line, seen) {
    if (!isListItem(line.text)) return bad(line, `每個連結要以「- 」開頭，${SHAPE}，這一行沒有`);
    const dot = dotReason(line.text.slice(2), 2);
    if (dot !== '') return bad(line, `${dot}；${SHAPE}`);
    const parts = splitFields(line.text.slice(2));
    if (parts.length < 2) return bad(line, `少了「 · 」：${SHAPE}（代號跟網址中間用「 · 」隔開）`);
    if (parts.length > 2) return bad(line, `多了一段「 · 」：${SHAPE}，只有代號與網址兩段`);
    const [code, url] = parts;
    const problems = [];
    if (!CODE.test(code)) {
        problems.push(`代號只能是英文小寫與數字（${shown(code)}）`);
    }
    const urlIssue = urlProblem(url);
    if (urlIssue !== '') problems.push(urlIssue);
    if (problems.length > 0) return bad(line, problems.join('；'));
    if (seen.has(code)) return bad(line, `代號重複：「${code}」已經在第 ${seen.get(code)} 行用過了，同一個代號只能出現一次`);
    seen.set(code, line.line);
    return { ok: true, code, url };
}

/**
 * 把 links.md 的內容讀成一個一個社群連結。
 *
 * @param {string} text 檔案內容（可以帶 UTF-8 BOM、CRLF；<!-- … --> 註解可以在任何位置，不算內容）
 * @returns {object[]} 每一行一筆（好的或壞的），順序跟檔案一樣；整檔空白回 []
 */
export function parseLinks(text) {
    const seen = new Map();
    return readFlat(text, (line) => readLink(line, seen));
}
