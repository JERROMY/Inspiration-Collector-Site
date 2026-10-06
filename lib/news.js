/**
 * news.js —— 讀公告（content/news.<語言>.md）。
 *
 * 格式：一則一個「## 2026-10-02 · 更新 · 標題」，底下一兩句內文；可以再加一行「連結：https://…」，
 * 要一直掛在公告條的再加一行「置頂」。三種語言的檔都用中文的「連結：」與「置頂」。最新的寫在最上面。
 *
 * 內文照寫的人的換行：行與行之間是 \n，中間有空白行（段落）是 \n\n，連續好幾個空白行壓成一個 \n\n；每行去掉頭尾空白，整段去掉頭尾的空白行，
 * 沒有 \r。「連結：」「置頂」那一行與註解、落單的 --> 不算內文，也不算空白行（前後兩行之間是 \n 還是 \n\n，只看中間有沒有真的空白行）。
 * 網頁顯示時用 white-space: pre-line（或照行拆）把換行顯示出來。
 *
 * 給網頁用的紀錄：
 *   好的公告  { ok: true, id, date, category, title, body, link, pinned }
 *   壞的公告  { ok: false, line, raw, reason }（標題壞指標題那一行；連結或置頂寫壞指寫壞的那一行）
 * 寫壞一條只壞那一條，不丟例外、不靜靜略過。日期與標題都相同的兩則，先出現的算數、後面的壞。
 * 不讀現在的時間：「30 天內才出現」在瀏覽器判斷，這裡只給日期字串。
 */
import { createHash } from 'node:crypto';
import { bad, dateProblem, dotReason, readBlocks, splitFields, urlProblem } from './entries.js';

const PIN = '置頂';
const PIN_MISSPELLED = /^(?:置[頂顶]|pin(?:ned)?$)/i;
const PIN_VARIANTS = new Set(['置頂', '置顶', 'pin', 'pinned', 'ピン留め', 'ピン止め']);
const PIN_NOISE = /[\s【】\[\]（）()「」『』:：!！]/g;
const LINK = /^連結\s*[:：]\s*(.*)$/;
const LOOKS_LIKE_LINK = [
    /^(?:link|url|リンク|连结)\s*[:：]/i,
    /^(?:連結|链接|網址)\s+https?:\/\//i,
    /^https?:\/\/\S+$/i,
    /^[^:：]{1,8}[:：]\s*https?:\/\/\S+$/u,
];
const EXAMPLE = '## 2026-10-02 · 更新 · 標題';
const SHAPE = `標題要寫成「${EXAMPLE}」（日期 · 類別 · 標題）`;
const STRAY = `不在任何公告底下的字：每一則要從「${EXAMPLE}」這樣的標題開始`;

/**
 * 公告的 id：n- 加（日期＋標題）的 sha256 前 8 碼。只跟日期與標題有關，跟順序、行號、內文、連結、置頂、類別無關。
 *
 * @param {string} date 日期（YYYY-MM-DD）
 * @param {string} title 標題
 * @returns {string} 例如 n-1a2b3c4d
 */
function newsId(date, title) {
    return `n-${createHash('sha256').update(`${date}\n${title}`).digest('hex').slice(0, 8)}`;
}

/**
 * 置頂寫錯了嗎：「置頂」「置顶」開頭但不是單獨一行的「置頂」、pin／pinned，
 * 或去掉空白與括號、冒號、驚嘆號之後等於置頂、置顶、pin、pinned、ピン留め、ピン止め（【置頂】、(PIN)、置頂！…）。
 * 單獨一行的「置頂」是對的，由呼叫的人先挑掉。
 *
 * @param {string} text 內文裡的一行（已去頭尾空白）
 * @returns {boolean} 是不是置頂寫錯了
 */
function isPinTypo(text) {
    return PIN_MISSPELLED.test(text) || PIN_VARIANTS.has(text.replace(PIN_NOISE, '').toLowerCase());
}

/**
 * 看起來是連結、但不是「連結：https://…」的寫法：link／url／リンク／连结 接冒號、整行只有網址、
 * 短標籤（8 字以內）＋冒號＋網址、「連結」「链接」「網址」後面直接接網址（少了冒號）。
 * 句子中間夾網址、標籤很長的句子不算。
 *
 * @param {string} text 內文裡的一行（已去頭尾空白）
 * @returns {boolean} 是不是看起來是連結
 */
function looksLikeLink(text) {
    return LOOKS_LIKE_LINK.some((pattern) => pattern.test(text));
}

/**
 * 把內文的行接成 body：行與行之間 \n；兩行中間隔著真的空白行（段落）就是 \n\n，隔幾個空白行都一樣。
 * 連結、置頂、註解那幾行不是空白行：它們夾在兩行中間不造成分段。
 *
 * @param {import('./lines.js').Line[]} lines 內文的行（已去頭尾空白，不含連結與置頂），依原檔順序
 * @param {(line: number) => boolean} isBlank 原檔第幾行（1 起算）是不是只有空白的行
 * @returns {string} 接好的 body；沒有內文是空字串
 */
function joinLines(lines, isBlank) {
    let body = '';
    lines.forEach((line, index) => {
        if (index > 0) {
            let paragraph = false;
            for (let n = lines[index - 1].line + 1; n < line.line && !paragraph; n += 1) paragraph = isBlank(n);
            body += paragraph ? '\n\n' : '\n';
        }
        body += line.text;
    });
    return body;
}

/**
 * 標題「## 日期 · 類別 · 標題」。只切前兩個「 · 」，後面的「 · 」留在標題裡。
 *
 * @param {import('./lines.js').Line} head 「## 」那一行
 * @returns {{ problem: string } | { date: string, category: string, title: string }} 壞了給原因（中文），好的給三個欄位
 */
function readHead(head) {
    const text = head.text.slice(2);
    const dot = dotReason(text, 3);
    if (dot !== '') return { problem: `${dot}；${SHAPE}` };
    const parts = splitFields(text);
    const [date, category = '', ...rest] = parts;
    const title = rest.join(' · ');
    const problems = [];
    const dateIssue = dateProblem(date);
    if (dateIssue !== '') problems.push(dateIssue);
    if (parts.length < 3) {
        problems.push(`這一行只有 ${parts.length} 段，${SHAPE}，中間用「 · 」隔開`);
    } else {
        if (category === '') problems.push(`類別不能空白（像「更新」「注意」），${SHAPE}`);
        if (title === '') problems.push(`標題不能空白，${SHAPE}`);
    }
    return problems.length > 0 ? { problem: problems.join('；') } : { date, category, title };
}

/**
 * 一則公告：標題加底下的內文、連結、置頂。連結或置頂寫壞，整則壞，line／raw 指寫壞的那一行。
 * 日期與標題都相同的公告 id 一定一樣（前端拿 id 當 key 會撞）：先出現的算數，後面重複的那則整則壞，line／raw 指它的標題行。
 *
 * @param {{ head: import('./lines.js').Line, body: import('./lines.js').Line[] }} block 一個區塊
 * @param {Map<string, number>} seen 已經讀成好紀錄的公告 id → 它的標題在第幾行；好的才會記進去
 * @param {(line: number) => boolean} isBlank 原檔第幾行（1 起算）是不是只有空白的行（內文要分段落用）
 * @returns {object} { ok: true, id, date, category, title, body, link, pinned } 或壞紀錄
 */
function readEntry(block, seen, isBlank) {
    const head = readHead(block.head);
    if (head.problem) return bad(block.head, head.problem);
    const id = newsId(head.date, head.title);
    if (seen.has(id)) {
        return bad(block.head, `日期與標題重複：同一天、同一個標題已經在第 ${seen.get(id)} 行寫過了，一則公告只能出現一次（標題改幾個字就能分開）`);
    }
    const content = [];
    let link = null;
    let pinned = false;
    for (const line of block.body) {
        const linkMatch = LINK.exec(line.text);
        if (line.text === PIN) {
            pinned = true;
        } else if (isPinTypo(line.text)) {
            return bad(line, `置頂寫法不對：要置頂就單獨一行寫「${PIN}」（不加別的字）；不要置頂就拿掉這一行`);
        } else if (linkMatch) {
            const issue = urlProblem(linkMatch[1].trim());
            if (issue !== '') return bad(line, `連結的${issue}，要寫成「連結：https://…」`);
            if (link !== null) return bad(line, '連結寫了兩行：一則公告只能有一個連結');
            link = linkMatch[1].trim();
        } else if (looksLikeLink(line.text)) {
            return bad(line, '看起來是連結但寫法不對，請寫「連結：https://…」');
        } else {
            content.push(line);
        }
    }
    const { date, category, title } = head;
    seen.set(id, block.head.line);
    return { ok: true, id, date, category, title, body: joinLines(content, isBlank), link, pinned };
}

/**
 * 把 news.<語言>.md 的內容讀成一則一則的公告。
 *
 * @param {string} text 檔案內容（可以帶 UTF-8 BOM、CRLF；<!-- … --> 註解可以在任何位置，不算內容）
 * @returns {object[]} 每一則一筆（好的或壞的），依檔案順序；公告條由前端挑日期最新的一則（同一天取檔案裡較上面那則），不看位置；整檔空白回 []
 */
export function parseNews(text) {
    const seen = new Map();
    // 要到真的有一則好的公告要讀的時候才切行（text 不是字串的話，readBlocks 已經先丟 TypeError 了）
    let rows = null;
    const isBlank = (line) => {
        rows ??= text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
        return rows[line - 1].trim() === '';
    };
    return readBlocks(text, {
        read: (block) => readEntry(block, seen, isBlank),
        stray: STRAY,
        lookalike: { start: '\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}', what: '一則公告', example: EXAMPLE, parts: 3 },
    });
}
