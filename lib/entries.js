/**
 * entries.js —— changelog、news、links 三支讀取程式共用的零件：把行組成區塊、做壞紀錄、檢查日期與網址、講得出標題的點哪裡打錯。
 *
 * 一條一條接住的做法都在這裡：
 * - 壞紀錄一律是 { ok: false, line, raw, reason }，留在檔案裡原本的位置（不集中到最後、不靜靜略過）。
 * - 沒關起來的註解、落單的 -->、不在任何區塊底下的雜字，各自一筆壞紀錄。
 * - 長得像標題、但不是合法「## 」標題的一行（「##」後面沒空格、井號數不對、沒寫井號…），自己開一個壞區塊，
 *   它底下的內容跟著它，不會悄悄併進上一則／上一版。
 * - 這支檔不丟例外（輸入不是字串除外，那是呼叫的人寫錯）。
 *
 * 區塊檔（changelog、news）：「## 標題」開頭，到下一個「## 」之前都是它的內容。
 * 逐行檔（links）：一行一筆。
 */
import { toLines } from './lines.js';

const HEADING = /^##(?:\s|$)/;
const HEADING_WITHOUT_SPACE = /^##[^\s#]/;
const FULLWIDTH_HASH = '\uFF03';
const ITEM = /^-(?:\s|$)/;
const SEPARATOR = ' · ';
const DOT = '·';
const WRONG_DOTS = /[\u30FB\u2027\u2022\uFF65]/u;
const ANY_DOT = '[\\u00B7\\u30FB\\u2027\\u2022\\uFF65]';
const ODD_SPACES = {
    '\u3000': '全形空白（U+3000）',
    '\u00A0': '不換行空白 NBSP（U+00A0）',
    '\t': 'Tab（U+0009）',
};
const COMMENT_REASONS = {
    unclosed: '註解沒關起來（缺 -->）：<!-- 後面要有 -->；這一行整行先不讀，下面的內容照常讀',
    'stray-close': '多出來的 -->（缺開頭的 <!--？）（如果是箭頭，請寫成 → 或 ->）：這一行整行先不讀，其他內容照常讀',
};

/** 日曆上每個月有幾天（2 月另外算閏年）。 */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * 做一筆壞紀錄。
 *
 * @param {import('./lines.js').Line} line 寫壞的那一行（line、raw 從這裡拿）
 * @param {string} reason 中文，講得出哪裡壞、怎麼寫才對
 * @returns {{ ok: false, line: number, raw: string, reason: string }} 壞紀錄
 */
export function bad(line, reason) {
    return { ok: false, line: line.line, raw: line.raw, reason };
}

/**
 * 在 reason 裡指出讀到的是什麼：空的講「沒有寫」，否則講「讀到「…」」。
 *
 * @param {string} value 讀到的欄位內容
 * @returns {string} 例如「讀到「1.0」」或「沒有寫」
 */
export function shown(value) {
    return value === '' ? '沒有寫' : `讀到「${value}」`;
}

/**
 * 這一行是不是「- 」開頭的條目（「-」單獨一行也算，後面沒字由呼叫的人報）。
 *
 * @param {string} text 已去頭尾空白的一行
 * @returns {boolean} 是不是條目
 */
export function isListItem(text) {
    return ITEM.test(text);
}

/**
 * 把「## 標題」開頭的檔讀成一筆一筆的紀錄。每個區塊交給 read 變成一筆好紀錄或壞紀錄。
 *
 * @param {string} text 檔案內容
 * @param {object} options
 * @param {(block: { head: import('./lines.js').Line, body: import('./lines.js').Line[] }) => object} options.read
 *   收一個合法的區塊（head 是「## 」那一行，body 是它底下非空白的行），回傳那一區塊的紀錄（好或壞）
 * @param {string} options.stray 第一個區塊之前的雜字，每一行各一筆壞紀錄，reason 寫這個
 * @param {{ start: string, what: string, example: string, parts: number }} options.lookalike
 *   長得像標題卻不是合法「## 」標題的一行：自己一筆壞紀錄，底下的行都屬於它。「像標題」有兩種：
 *   「##」後面緊接著不是空白也不是 # 的字（不管後面長什麼樣）；以全形井號（U+FF03）開頭；或去掉開頭的 # 與空白之後，以 start（RegExp 的原始碼，
 *   標題開頭那一欄，例如日期、版本號）開頭、後面緊接著點狀分隔符（U+00B7、U+30FB、U+2027、U+2022、U+FF65，前後可有空白）。
 *   what 是「一則公告」「一版」、example 是標題範例、parts 是標題該有幾段（拿來判斷點是不是打錯）
 * @returns {object[]} 紀錄，順序跟檔案一樣；註解寫壞（沒關起來、落單的 -->）的那一筆排在它所在區塊的後面
 */
export function readBlocks(text, { read, stray, lookalike }) {
    const looksLikeHeading = new RegExp(String.raw`^#*\s*(?:${lookalike.start})\s*${ANY_DOT}`, 'u');
    const nodes = [];
    let current = null;
    for (const line of toLines(text)) {
        if (line.commentError) {
            nodes.push({ kind: 'comment', line });
        } else if (HEADING.test(line.text)) {
            current = { kind: 'block', head: line, body: [] };
            nodes.push(current);
        } else if (HEADING_WITHOUT_SPACE.test(line.text) || line.text.startsWith(FULLWIDTH_HASH) || looksLikeHeading.test(line.text)) {
            current = { kind: 'lookalike', head: line, body: [] };
            nodes.push(current);
        } else if (current) {
            current.body.push(line);
        } else {
            nodes.push({ kind: 'stray', line });
        }
    }
    return nodes.map((node) => {
        if (node.kind === 'block') return read(node);
        if (node.kind === 'lookalike') return bad(node.head, lookalikeReason(node.head.text, lookalike));
        return bad(node.line, node.kind === 'stray' ? stray : COMMENT_REASONS[node.line.commentError]);
    });
}

/**
 * 長得像標題卻不是合法「## 」標題的那一行，要怎麼改。點打錯的話一起講。
 *
 * @param {string} text 那一行（已去頭尾空白）
 * @param {{ what: string, example: string, parts: number }} lookalike 見 readBlocks
 * @returns {string} 中文原因（講到「看起來是新的」「##」）
 */
function lookalikeReason(text, { what, example, parts }) {
    const reason = `看起來是新的${what}，標題要寫成「## 」開頭、## 後面空一格（例如「${example}」）`;
    const hash = text.startsWith(FULLWIDTH_HASH) ? `；井號要用半形的「#」（這一行用了全形的「${FULLWIDTH_HASH}」）` : '';
    const dot = dotReason(text.replace(/^[#\uFF03]+\s*/u, ''), parts);
    return `${reason}${hash}${dot === '' ? '' : `；${dot}`}`;
}

/**
 * 把一行一筆的檔讀成一筆一筆的紀錄。
 *
 * @param {string} text 檔案內容
 * @param {(line: import('./lines.js').Line) => object} readLine 收一行（非空白、已去註解），回傳那一行的紀錄（好或壞）；依檔案順序呼叫
 * @returns {object[]} 紀錄，順序跟檔案一樣；註解寫壞（沒關起來、落單的 -->）的那一行自己一筆壞紀錄
 */
export function readFlat(text, readLine) {
    return toLines(text).map((line) => (line.commentError ? bad(line, COMMENT_REASONS[line.commentError]) : readLine(line)));
}

/**
 * 用「 · 」（空白＋·＋空白）切欄位，每一欄去掉頭尾空白。結尾是「 ·」（編輯器吃掉了最後的空白）也算切開，最後一欄是空字串。
 *
 * @param {string} text 要切的字（標題「## 」之後的部分、或連結「- 」之後的部分）
 * @returns {string[]} 欄位；沒有「 · 」就只有一欄
 */
export function splitFields(text) {
    return `${text.trimEnd()} `.split(SEPARATOR).map((field) => field.trim());
}

/**
 * 標題切出來的段數不夠時，看是不是點打錯了：換成了別種點（U+30FB、U+2027、U+2022、U+FF65）、點的兩邊是全形空白／NBSP／Tab、或點的兩邊沒空格。
 *
 * @param {string} text 標題「##」之後的部分
 * @param {number} parts 標題該有幾段（更新紀錄 2、公告 3）
 * @returns {string} 空字串＝段數夠了、或看不出是點的問題；否則是中文的原因，點名實際用的字元
 */
export function dotReason(text, parts) {
    if (splitFields(text).length >= parts) return '';
    const wrong = WRONG_DOTS.exec(text);
    if (wrong) {
        const code = wrong[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        return `中間的點要用「${DOT}」（U+00B7），這一行用的是「${wrong[0]}」（U+${code}）`;
    }
    for (let at = text.indexOf(DOT); at >= 0; at = text.indexOf(DOT, at + 1)) {
        const [before, after] = [text[at - 1], text[at + 1]];
        if (before === ' ' && (after === ' ' || after === undefined)) continue;
        const odd = [before, after].find((char) => ODD_SPACES[char] !== undefined);
        if (odd !== undefined) return `點的兩邊要各空一個半形空格，這一行用的是${ODD_SPACES[odd]}`;
        return `點的兩邊各空一格：要寫成「 ${DOT} 」（空格＋${DOT}＋空格），這一行的點兩邊沒有空格`;
    }
    return '';
}

/**
 * 日期是不是 YYYY-MM-DD、而且是日曆上真的有的一天（2026-02-29 沒有、2028-02-29 有）。不讀現在的時間。
 *
 * @param {string} value 日期的字
 * @returns {string} 空字串＝沒問題；否則是中文的原因（講到「日期」）
 */
export function dateProblem(value) {
    const hint = `日期要寫成 YYYY-MM-DD，而且是日曆上真的有的一天（${shown(value)}）`;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return hint;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (year < 1 || month < 1 || month > 12 || day < 1) return hint;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const last = month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1];
    return day > last ? hint : '';
}

/**
 * 網址要像真的：https 開頭、不含「…」「...」與空白、URL 解析得了、主機名裡有「.」。
 *
 * @param {string} value 網址的字（已去頭尾空白）
 * @returns {string} 空字串＝沒問題；否則是中文的原因（不是 https 講到「https」，範例或不完整講到「範例或不完整」）
 */
export function urlProblem(value) {
    if (value === '') return '網址只收 https（沒有寫網址）';
    if (!/^https:\/\//i.test(value)) return `網址只收 https 開頭的（讀到「${value}」）`;
    if (value.includes('…') || value.includes('...')) return `網址看起來是範例或不完整（讀到「${value}」）`;
    if (/\s/.test(value)) return `網址裡面有空白，不能是一個完整的網址（讀到「${value}」）`;
    let host;
    try {
        host = new URL(value).hostname;
    } catch (err) {
        return `網址看起來是範例或不完整，解析不了（讀到「${value}」）：${err.message}`;
    }
    return host.includes('.') ? '' : `網址的主機名要像 jerromy.com，中間要有「.」（讀到「${value}」）`;
}
