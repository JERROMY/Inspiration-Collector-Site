/**
 * agent.js —— 讀教學片的「AI 開始打字」來源（tutorial/agent-{zh,en,ja}.js）：把它當資料讀，不執行。
 *
 * 來源是瀏覽器的全域指派，不是模組：開頭一段註解，然後 `window.AGENT = { … };`，等號右邊是合法的 JSON。
 * 這裡只認這個形狀：開頭只能有空白與註解（區塊註解、或 // 開頭的整行註解），接著 `window.AGENT =`，等號右邊找出那一個 JSON 物件、用 JSON.parse 讀，
 * 後面只能有分號、空白與註解（行註解到 \n、\r、U+2028、U+2029 為止，跟 JavaScript 一樣：這幾種換行後面的字在瀏覽器裡是程式，不是註解）。其他東西（函式呼叫、別的程式、不是 JSON 的寫法）一律當作壞掉，丟出中文的錯誤；來源裡的任何程式都不會被執行，
 * 所以來源裡被塞了東西也傷不到這台電腦。
 *
 * 讀出來的是六個欄位，順序固定：model、prompt、steps、outline、reply、say。欄位多一個或少一個都算壞（多一個當作教學片的來源改版了，要先看過再收）。
 */

const FIELDS = ['model', 'prompt', 'steps', 'outline', 'reply', 'say'];
const HEAD = 'window.AGENT';
// JavaScript 的行註解遇到這四種字就結束（不只 \n）；它們後面的字在瀏覽器裡是程式，不是註解
const LINE_ENDS = new Set(['\n', '\r', '\u2028', '\u2029']);
const SPACE = /\s/;

/**
 * 跳過空白（JavaScript 的空白與換行）、區塊註解、行註解，選擇性連分號也跳過。用迴圈掃，不用正規表示式，
 * 所以來源再大（幾百萬行註解、幾千萬個分號）也不會撐爆堆疊。
 *
 * @param {string} text 整份來源
 * @param {number} from 從哪裡開始
 * @param {{ comments: boolean, semicolons: boolean }} allow 要不要連註解、分號也跳過（空白一定跳過）
 * @returns {number} 跳過之後的位置（沒有可以跳的就是 from）
 */
function skip(text, from, { comments, semicolons }) {
    let at = from;
    while (at < text.length) {
        const char = text[at];
        const code = char.charCodeAt(0);
        if (code === 32 || (code >= 9 && code <= 13) || (code > 127 && SPACE.test(char)) || (semicolons && char === ';')) {
            at += 1;
        } else if (comments && char === '/' && text[at + 1] === '*') {
            const close = text.indexOf('*/', at + 2);
            if (close < 0) return at;
            at = close + 2;
        } else if (comments && char === '/' && text[at + 1] === '/') {
            at += 2;
            while (at < text.length && !LINE_ENDS.has(text[at])) at += 1;
        } else {
            return at;
        }
    }
    return at;
}

/**
 * 從 { 開始，找出對應的 } 之後的位置。字串（"…"，裡面的 \\ 與 \" 跳過）裡的括號不算。
 *
 * @param {string} text 整份來源
 * @param {number} start 開頭的 { 的位置
 * @returns {number} 對應的結尾之後的位置；括號沒有成對、字串沒有關起來是 -1
 */
function objectEnd(text, start) {
    let depth = 0;
    for (let at = start; at < text.length; at += 1) {
        const char = text[at];
        if (char === '"') {
            for (at += 1; at < text.length && text[at] !== '"'; at += 1) {
                if (text[at] === '\\') at += 1;
            }
        } else if (char === '{' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ']') {
            depth -= 1;
            if (depth === 0) return at + 1;
        }
    }
    return -1;
}

/**
 * @param {unknown} value 任何值
 * @returns {boolean} 是不是有字的字串（只有空白不算）
 */
function filled(value) {
    return typeof value === 'string' && value.trim() !== '';
}

/**
 * @param {unknown} steps steps 欄位的值
 * @returns {[string, string][]} 新的陣列：每一步是 [工具, 參數]
 * @throws {Error} 不是非空陣列、或某一步不是兩個非空字串（中文訊息，講到 steps 與第幾步，從 1 算）
 */
function readSteps(steps) {
    if (!Array.isArray(steps)) throw new Error('steps 要是陣列（[[工具, 參數], …]）');
    if (steps.length === 0) throw new Error('steps 是空的，至少要有一步');
    return steps.map((step, index) => {
        if (!Array.isArray(step) || step.length !== 2 || !step.every(filled)) {
            throw new Error(`steps 第 ${index + 1} 步要是 [工具, 參數]（兩個有字的字串）`);
        }
        return [step[0], step[1]];
    });
}

/**
 * 把 tutorial/agent-*.js 的內容當資料讀成六個欄位。不執行來源。
 *
 * @param {string} text 來源檔的內容（可以帶 UTF-8 BOM）
 * @returns {{ model: string, prompt: string, steps: [string, string][], outline: string, reply: string, say: string }}
 *   六個欄位，順序固定；值跟來源一模一樣（字不改）；每次給新的物件
 * @throws {TypeError} text 不是字串（呼叫的人寫錯了）
 * @throws {Error} 來源壞了，訊息是中文、講出原因：找不到 window.AGENT =、等號右邊不是 JSON 物件、JSON 讀不了、JSON 後面還有別的東西、
 *   不是物件、缺欄位或多一個欄位（講那個欄位名）、欄位不是有字的字串、steps 不是非空陣列、某一步不是 [工具, 參數]（講 steps 與第幾步）
 */
export function parseAgentSource(text) {
    if (typeof text !== 'string') throw new TypeError(`parseAgentSource 只收字串，收到 ${typeof text}`);
    const head = skip(text, 0, { comments: true, semicolons: false });
    const equals = head + HEAD.length;
    const equalsAt = text.startsWith(HEAD, head) ? skip(text, equals, { comments: false, semicolons: false }) : -1;
    if (equalsAt < 0 || text[equalsAt] !== '=' || text[equalsAt + 1] === '=') {
        throw new Error('找不到 window.AGENT =（檔案開頭只能有註解，接著要是 window.AGENT = { … }）');
    }
    const start = skip(text, equalsAt + 1, { comments: false, semicolons: false });
    if (text[start] !== '{') throw new Error('window.AGENT = 右邊要是 JSON 資料（{ … }），不能是程式');
    const end = objectEnd(text, start);
    if (end < 0) throw new Error('window.AGENT 右邊的 JSON 沒有結束（括號或引號沒有成對）');
    let data;
    try {
        data = JSON.parse(text.slice(start, end));
    } catch (err) {
        // 巢狀深到 JSON.parse 撐爆堆疊：不把 JavaScript 的英文原文印給人看
        if (err instanceof RangeError) throw new Error('window.AGENT 右邊的 JSON 巢狀太深，讀不了（來源結構異常）', { cause: err });
        throw new Error(`window.AGENT 右邊不是合法的 JSON（${err.message.replace(/\s+/g, ' ')}）`, { cause: err });
    }
    if (skip(text, end, { comments: true, semicolons: true }) !== text.length) throw new Error('window.AGENT 的 JSON 後面還有別的東西：只能有分號與註解，不能再有程式');
    if (Object.prototype.toString.call(data) !== '[object Object]') throw new Error('window.AGENT 的 JSON 要是物件');
    for (const field of FIELDS) {
        if (!Object.hasOwn(data, field)) throw new Error(`少了欄位 ${field}`);
    }
    const extra = Object.keys(data).find((key) => !FIELDS.includes(key));
    if (extra !== undefined) throw new Error(`多了欄位 ${extra}（來源可能改版了，要先看過再收）`);
    const agent = {};
    for (const field of FIELDS) {
        if (field === 'steps') {
            agent.steps = readSteps(data.steps);
        } else {
            if (!filled(data[field])) throw new Error(`欄位 ${field} 要是有字的字串`);
            agent[field] = data[field];
        }
    }
    return agent;
}
