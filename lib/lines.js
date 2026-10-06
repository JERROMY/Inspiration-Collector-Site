/**
 * lines.js —— 把一支文字檔的內容整理成「一行一個物件」。只做這一件事：去 BOM、統一行尾、去註解、切行。
 *
 * 給 entries.js 用（changelog、news、links 三支讀取程式都經過它）。這裡不認識任何一種內容的格式。
 *
 * 規則：
 * - 檔案開頭的 UTF-8 BOM 去掉；行尾 \r\n（Windows）與單獨的 \r 都當成換行。
 * - HTML 註解 <!-- … --> 可以在任何位置、可以跨行；整段去掉，但換行留著，所以行號永遠是原檔的行號。
 * - 有 <!-- 卻沒有 --> 的（沒關起來）：那一行整行不當內容、commentError 標成 'unclosed'，由呼叫的人回一筆壞紀錄；
 *   它後面的行照常當內容（不吞掉，免得整支檔靜靜變成零筆）。
 * - 不在註解裡、落單的 -->（通常是刪掉了開頭的 <!--）：同樣那一行整行不當內容、commentError 標成 'stray-close'。
 * - 空行與只剩註解的行不回傳。
 */

const OPEN = '<!--';
const CLOSE = '-->';

/**
 * @typedef {object} Line
 * @property {number} line 原檔行號，1 起算（註解行、空行都算進去）
 * @property {string} raw 那一行的原文（不含行尾，不帶 \r；註解沒有拿掉）
 * @property {string} text 去掉註解、去掉頭尾空白之後的內容；commentError 不是 null 的那一行是空字串
 * @property {null | 'unclosed' | 'stray-close'} commentError 註解寫壞了：這一行有 <!-- 卻沒有 -->（'unclosed'），
 *   或有不在註解裡的 -->（'stray-close'）；沒問題是 null
 */

/**
 * 把註解整段拿掉，換行留著（行數不變）；沒關起來的 <!-- 記下它在第幾行，那一行的內容也清掉。
 *
 * @param {string} source 已經統一成 \n 行尾的文字
 * @returns {{ clean: string, unclosed: Set<number> }} 去掉註解的文字（行數跟 source 一樣）、沒關起來的註解所在的行號
 */
function stripComments(source) {
    const unclosed = new Set();
    let clean = '';
    let at = 0;
    for (;;) {
        const open = source.indexOf(OPEN, at);
        if (open < 0) {
            clean += source.slice(at);
            break;
        }
        clean += source.slice(at, open);
        const close = source.indexOf(CLOSE, open + OPEN.length);
        if (close >= 0) {
            clean += source.slice(open, close + CLOSE.length).replace(/[^\n]/g, '');
            at = close + CLOSE.length;
            continue;
        }
        unclosed.add(clean.split('\n').length);
        clean = clean.slice(0, clean.lastIndexOf('\n') + 1);
        const lineEnd = source.indexOf('\n', open);
        if (lineEnd < 0) break;
        at = lineEnd;
    }
    return { clean, unclosed };
}

/**
 * 把整支檔的文字切成非空白的行。
 *
 * @param {string} text 檔案內容（可以帶 BOM、CRLF）
 * @returns {Line[]} 依原檔順序、不含空行與純註解行；註解寫壞的那一行 commentError 不是 null
 * @throws {TypeError} text 不是字串（呼叫的人寫錯了，不是內容寫壞）
 */
export function toLines(text) {
    if (typeof text !== 'string') throw new TypeError(`toLines 只收字串，收到 ${typeof text}`);
    const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const { clean, unclosed } = stripComments(source);
    const rawLines = source.split('\n');
    const cleanLines = clean.split('\n');
    const lines = [];
    rawLines.forEach((raw, index) => {
        const line = index + 1;
        if (unclosed.has(line)) {
            lines.push({ line, raw, text: '', commentError: 'unclosed' });
            return;
        }
        if (cleanLines[index].includes(CLOSE)) {
            lines.push({ line, raw, text: '', commentError: 'stray-close' });
            return;
        }
        const content = cleanLines[index].trim();
        if (content !== '') lines.push({ line, raw, text: content, commentError: null });
    });
    return lines;
}
