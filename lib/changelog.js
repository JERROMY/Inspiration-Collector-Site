/**
 * changelog.js —— 讀更新紀錄（content/changelog.<語言>.md）。
 *
 * 格式：一版一個「## 1.0.5 · 2026-10-02」，底下一行一條「- 修好：…」；最新的寫在最上面。
 *
 * 給網頁用的紀錄：
 *   好的版本  { ok: true, version, date, items }
 *   版本裡每一條 items[i]：好的 { ok: true, kind, text, raw }，壞的 { ok: false, line, raw, reason }
 *     好條目的 raw 是使用者寫的原句：那一行去掉開頭的「-」與頭尾空白（冒號、冒號兩邊的空白、kind 都留著，註解已經拿掉），
 *     給網頁在 kind 不是已知的類型詞（「修好」「新增」…以外的，像「雜項」「Misc」）時，把冒號接回去、整句當內文。
 *     注意名字撞到：壞紀錄的 raw 是原檔那一行（含「- 」），好條目的 raw 是去掉「- 」的原句，意思不同。
 *   壞的版本（標題寫壞、版本號重複）整版一筆 { ok: false, line, raw, reason }，底下的「- 」行不另外算
 * 寫壞一條只壞那一條，不丟例外、不靜靜略過。版本號重複時，先出現的算數、後面的整版壞。
 */
import { bad, dateProblem, dotReason, isListItem, readBlocks, shown, splitFields } from './entries.js';

const VERSION = /^\d+\.\d+\.\d+$/;
const EXAMPLE = '## 1.0.5 · 2026-10-02';
const SHAPE = `標題要寫成「${EXAMPLE}」（版本 · 日期）`;
const STRAY = `不在任何版本底下的字：每一版要從「${EXAMPLE}」這樣的標題開始`;

/**
 * 找 kind 的冒號：第一個全形「：」或半形「:」。兩個數字之間的半形冒號（10:30）不算、繼續找；
 * 冒號後面緊接 // 的是網址（https://…），整行沒有 kind，不往後找。
 *
 * @param {string} body 條目「- 」後面的字
 * @returns {number} 冒號的位置；沒有 kind 是 -1
 */
function kindColon(body) {
    for (let at = 0; at < body.length; at += 1) {
        const colon = body[at] === ':' || body[at] === '：';
        const clock = body[at] === ':' && /\d/.test(body[at - 1] ?? '') && /\d/.test(body[at + 1] ?? '');
        if (colon && !clock) return body.startsWith('//', at + 1) ? -1 : at;
    }
    return -1;
}

/**
 * 一條「- 修好：…」。
 *
 * @param {import('./lines.js').Line} line 版本底下的一行
 * @returns {object} { ok: true, kind, text, raw } 或壞紀錄；raw 是這一行去掉開頭的「-」與頭尾空白的原句（沒有 kind 時 text 跟它一樣）
 */
function readItem(line) {
    if (!isListItem(line.text)) return bad(line, '版本底下每一條要以「- 」開頭，例如「- 修好：…」，這一行沒有');
    const body = line.text.slice(1).trim();
    if (body === '') return bad(line, '「- 」後面沒有內容');
    const colon = kindColon(body);
    if (colon < 0) return { ok: true, kind: '', text: body, raw: body };
    const text = body.slice(colon + 1).trim();
    if (text === '') return bad(line, '冒號後面沒有內容（「- 修好：…」冒號後面要接這一條的內容）');
    return { ok: true, kind: body.slice(0, colon).trim(), text, raw: body };
}

/**
 * 一個版本：「## 版本 · 日期」加底下的條目。標題只能剛好兩段；版本號已經有好的版本用過，這一版整版壞。
 *
 * @param {{ head: import('./lines.js').Line, body: import('./lines.js').Line[] }} block 一個區塊
 * @param {Map<string, number>} seen 已經讀成好紀錄的版本號 → 它的標題在第幾行；好的才會記進去
 * @returns {object} { ok: true, version, date, items } 或壞紀錄（標題壞、版本號重複）
 */
function readVersion(block, seen) {
    const title = block.head.text.slice(2);
    const dot = dotReason(title, 2);
    if (dot !== '') return bad(block.head, `${dot}；${SHAPE}`);
    const parts = splitFields(title);
    if (parts.length > 2) {
        return bad(block.head, `標題多了一段「 · 」：只能寫「## 版本 · 日期」兩段，這一行有 ${parts.length} 段`);
    }
    const [version, date = ''] = parts;
    const problems = [];
    if (!VERSION.test(version)) problems.push(`版本號要寫成 x.y.z（例如 1.0.5）（${shown(version)}）`);
    const dateIssue = parts.length < 2 ? `缺日期：${SHAPE}` : dateProblem(date);
    if (dateIssue !== '') problems.push(dateIssue);
    if (problems.length > 0) return bad(block.head, problems.join('；'));
    if (seen.has(version)) {
        return bad(block.head, `版本重複：${version} 已經在第 ${seen.get(version)} 行寫過了，同一個版本號只能出現一次`);
    }
    seen.set(version, block.head.line);
    return { ok: true, version, date, items: block.body.map(readItem) };
}

/**
 * 把 changelog.<語言>.md 的內容讀成一版一版的更新紀錄。
 *
 * @param {string} text 檔案內容（可以帶 UTF-8 BOM、CRLF；開頭的 <!-- … --> 說明註解不算內容）
 * @returns {object[]} 每一版一筆（好的或壞的），順序跟檔案一樣；整檔空白回 []
 */
export function parseChangelog(text) {
    const seen = new Map();
    return readBlocks(text, {
        read: (block) => readVersion(block, seen),
        stray: STRAY,
        lookalike: { start: '\\d+\\.\\d+\\.\\d+', what: '一版', example: EXAMPLE, parts: 2 },
    });
}
