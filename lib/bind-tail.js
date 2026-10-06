/**
 * bind-tail.js —— 把使用者寫的一段話變成安全的 HTML，順便處理換行：
 * 最後幾個字包進 <span class="nw">…</span>（不換行），讓最後一行不會只剩一個字；中文再在詞界插 <wbr>，讓瀏覽器不從詞的中間斷。
 * 使用者寫的內容（更新紀錄、公告）沒辦法一句一句人工排，產生網頁時用這支處理。
 *
 * 孤字綁定：
 * - 中文、日文：最後三個字（連同結尾標點）。「字」是書寫字位（Intl.Segmenter 的 grapheme）：漢字、假名、標點、英文字母、數字、空白都算一個；
 *   emoji（膚色、ZWJ 組合、國旗）、組合用濁點、半形片假名的濁點、surrogate pair 都跟前面合成一個字，不會被切半。
 * - 英文：最後兩個字。「字」是以空白（JS 的 \s：空白、Tab…）切開的一段，標點、連字號、縮寫的點、撇號、emoji、網址都跟著它
 *   （well-known、e.g.、It’s、https://… 都是一個字）；兩個字之間的空白在 span 裡。中文頁面裡的英文照中文的規則。
 *   **長度上限 EN_TAIL_MAX_CHARS（20 個字元，以 Unicode 碼位算）**：兩個字合計（含中間的空白）超過 20 就只綁最後一個字，最後一個字本身超過 20 就不綁
 *   （長網址、長單字不換行會撐出橫向捲軸，手機 280 寬放不下）；不綁時 tail 接在最後一個字後面。
 * - 只處理最後一個非空行，不跨行去借字；不足（中日三個字、英文兩個字）就整行有的字都包。
 * - 結尾的空白與換行不算字，原樣留在 span 外面。
 *
 * 日文、英文的短引號：
 * - 同一行裡成對的短引號（「…」『…』“…”）連引號本身整個包成 <span class="nw">「…」</span>（日文、英文才包，中文不包），
 *   免得公告與更新紀錄在短引號裡面斷行（「これを／保存」「Save／page」）；沒關起來的不包。
 * - 各語言有自己的門檻與上限（QUOTE_LIMITS，以 Unicode 碼位算）：日文引號裡 8 個以內才包（不算引號本身），整個 nw span（含引號本身與往前延伸的部分）最多 10 個；
 *   英文引號裡 12 個以內才包，整個 nw span 最多 20 個（EN_TAIL_MAX_CHARS）。超過就不包。
 *   日文比較小，是因為日文是全形字：12 字的引號連引號是 14 個全形字，包成不換行之後在手機 280 寬會撐出橫向捲軸（設計稿量到：12 字引號在公告標題超出內容框 65px，
 *   8 字以下四種容器在 280 寬都是 0）。所以日文 9 個碼位以上的引號照舊可能在引號裡斷，這是為了 280 寬刻意放掉的。
 * - 配對：開引號往後找同一行最近的同一種關引號，不跨行；由前到後挑，跟已經挑到的那一對重疊的不挑（巢狀只包最外面那一對，外面那對太長、不算短引號時，裡面的照包）。
 * - 已經整個在最後幾個字的綁定範圍裡的不重複包；跟綁定範圍部分重疊的，綁定範圍往前延伸到開引號
 *   （ボタン<span class="nw">「これを保存」</span>）。延伸後超過那個語言的 span 上限（日文 10、英文 20）就不延伸，那一對也不包（少見）。
 * - 每個 span 都不巢狀、不跨行；日文的短引號與延伸後的 span 在 10 個碼位以內（最後三個字照字位綁，複合 emoji 的碼位可能超過，畫面上仍只有約三個字寬），英文每個 span 在 20 個以內。
 *
 * 中文的詞界 <wbr>（日文不插）：
 * - 用 Intl.Segmenter（zh-Hant，granularity 是 word）切詞，在詞界插 <wbr>，只插在同一行裡「相鄰兩段都是詞」的地方：
 *   標點與空白的前後都不插，不連續兩個，不在每一行的開頭與結尾，不在綁住的 <span class="nw"> 裡面（詞界剛好在 span 開頭時，<wbr> 在 span 前面）。
 * - 中文的短引號裡不插 <wbr>（不包 nw）：「…」『…』“…” 一對裡面 12 個字以內（以碼位算，不算引號本身）整段不插，13 個以上照插；沒關起來的引號不算。
 * - 日文、英文不插詞界：ICU 把日文動詞活用切得太碎（使｜え｜ませ｜ん），插了反而把動詞從中間拆開、短行變多；日文靠網頁樣式的 word-break: auto-phrase
 *   （元素要有 lang="ja" 才生效）。拿掉所有 <wbr>，結果跟不插詞界時逐字相同。
 * - 這要搭配網頁的樣式：中文使用者內容的區塊要設 word-break: keep-all（只在 <wbr>、空白、標點處斷），並加 overflow-wrap: anywhere
 *   （一長串中文沒有斷點時才不會橫向捲動；放在 flex 子項裡 break-word 兜不住，要用 anywhere 或子項加 min-width: 0）。
 * - 切字位（綁最後三個字）中日文都要用 Intl.Segmenter，切詞只有中文要。沒有 Intl.Segmenter 的環境載得進來（不在載入時建），英文照常；
 *   處理中文、日文時丟一個寫到 Intl.Segmenter 的中文 Error。
 * - 舊版 Node 的 Intl.Segmenter 切一整段很長的字非常慢（Node 21 一行二十萬字、沒有標點與空白，中文切詞約 7～8 秒；日文不切詞，不受影響），所以找最後三個字只切最後 64 個 UTF-16 單位，
 *   詞界照「不含標點與空白的一串」分開切（標點與空白前後本來就不插，結果一樣）。
 *
 * 其他：
 * - 先切字、再跳脫：實體（&lt; 之類）不會被切開，<wbr> 也不會插進實體中間。輸出一律跳脫 & < > " '，所以餵 <script> 不會變成標籤。
 * - 沒有「冪等」這回事：輸入裡字面的 <span class="nw"> 只是普通文字，照樣跳脫、照樣切字；同一段處理兩次會跳脫兩次。
 * - 尾端圖示：呼叫端可以給 tail（已經安全的 HTML 片段，例如箭頭圖示），插在綁住那段 span 的裡面、結尾，跟最後幾個字一起換行。
 */

const TAIL_LENGTH = 3;
const EN_TAIL_MAX_CHARS = 20;
// 中文的短引號（不插 <wbr>）：引號裡 12 個碼位以內
const QUOTE_MAX_CHARS = 12;
// 日文、英文的短引號包成 nw：引號裡幾個碼位以內才包、整個 span（含引號本身與往前延伸的部分）最多幾個碼位。
// 日文是全形字，所以比英文小：12 字的引號連引號 14 個全形字，在手機 280 寬會撐出橫捲
const QUOTE_LIMITS = { ja: { inner: 8, span: 10 }, en: { inner: 12, span: EN_TAIL_MAX_CHARS } };
// 找最後三個字位只切最後這麼多個 UTF-16 單位（三個字位最長的組合也遠不到 64）
const GRAPHEME_WINDOW = 64;
const SPAN_OPEN = '<span class="nw">';
const SPAN_CLOSE = '</span>';
const LANGS = new Set(['zh', 'ja', 'en']);
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const WORD_LOCALE = 'zh-Hant';
const QUOTES = { '「': '」', '『': '』', '“': '”' };
// 不含標點、符號與空白的一串：詞界只在這樣的一串裡面找
const RUN = /[^\s\p{P}\p{S}]+/gu;
const segmenters = new Map();

/**
 * @param {string} text 任意文字
 * @returns {string} 跳脫 & < > " ' 之後的文字
 */
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/**
 * 結尾空白（空白、Tab、換行、全形空白等 JS 的 \s）開始的位置。
 *
 * @param {string} text 任意文字
 * @returns {number} 最後一個非空白字之後的位置；整段都是空白（或空字串）是 0
 */
function contentEnd(text) {
    let end = text.length;
    while (end > 0 && /\s/.test(text[end - 1])) end -= 1;
    return end;
}

/**
 * Intl.Segmenter 在第一次要用的時候才建（載入時不建：沒有 Intl.Segmenter 的環境，英文要照常能用）。
 *
 * @param {string | undefined} locale 語言（字位的邊界不隨語言變，給 undefined）
 * @param {'grapheme' | 'word'} granularity 切字位或切詞
 * @returns {Intl.Segmenter} 這個語言與粒度的切分器（同一種只建一次）
 * @throws {Error} 這個環境沒有 Intl.Segmenter（中文訊息）
 */
function segmenter(locale, granularity) {
    if (typeof Intl.Segmenter !== 'function') {
        throw new Error('處理中文、日文需要 Intl.Segmenter（切字位與詞界），這個環境沒有；請改用比較新的 Node 或瀏覽器');
    }
    const key = `${locale}/${granularity}`;
    if (!segmenters.has(key)) segmenters.set(key, new Intl.Segmenter(locale, { granularity }));
    return segmenters.get(key);
}

/**
 * 從 from 到 to 的字，碼位數有沒有在 max 以內（emoji 與 𠮷 這類 surrogate pair 算 1 個）。
 *
 * @param {string} text 整段話
 * @param {number} from 開始的位置
 * @param {number} to 結束的位置
 * @param {number} max 上限
 * @returns {boolean} 碼位數 ≤ max
 */
function within(text, from, to, max) {
    // 一個碼位最多佔 2 個 UTF-16 單位，所以超過 2 倍一定放不下，不必數
    if (to - from > 2 * max) return false;
    return Array.from(text.slice(from, to)).length <= max;
}

/**
 * 英文最後的字從哪裡開始。字是以空白切開的一段；最後兩個字（含中間的空白）合計不超過 EN_TAIL_MAX_CHARS 就一起綁，
 * 超過就只綁最後一個字，最後一個字本身超過就不綁。這一行只有一個字就只算它，不從上一行借。
 *
 * @param {string} text 整段話
 * @param {number} lineStart 最後一個非空行開始的位置
 * @param {number} end 最後一個非空白字之後的位置（比 lineStart 大）
 * @returns {number} 要包進 span 的第一個字的位置；一個字都放不下（最後一個字超過上限）是 -1
 */
function englishTailStart(text, lineStart, end) {
    const isSpace = (at) => /\s/.test(text[at]);
    let last = end;
    while (last > lineStart && !isSpace(last - 1)) last -= 1;
    let two = last;
    while (two > lineStart && isSpace(two - 1)) two -= 1;
    if (two > lineStart) {
        while (two > lineStart && !isSpace(two - 1)) two -= 1;
    } else {
        two = last;
    }
    if (within(text, two, end, EN_TAIL_MAX_CHARS)) return two;
    return within(text, last, end, EN_TAIL_MAX_CHARS) ? last : -1;
}

/**
 * 中文、日文最後三個字從哪裡開始（照字位算，不切開 emoji 與組合字）。只切最後 GRAPHEME_WINDOW 個 UTF-16 單位。
 *
 * @param {string} text 整段話
 * @param {number} lineStart 最後一個非空行開始的位置
 * @param {number} end 最後一個非空白字之後的位置（比 lineStart 大）
 * @returns {number} 要包進 span 的第一個字的位置
 */
function cjkTailStart(text, lineStart, end) {
    const window = text.slice(Math.max(lineStart, end - GRAPHEME_WINDOW), end);
    const chars = Array.from(segmenter(undefined, 'grapheme').segment(window), (part) => part.segment);
    return end - chars.slice(Math.max(0, chars.length - TAIL_LENGTH)).join('').length;
}

/**
 * 一行裡的短引號：「…」『…』“…” 一對裡面 inner 個碼位以內（不算引號本身）。開引號往後找最近的同一種關引號，沒關起來的不算。
 *
 * @param {string} line 一行
 * @param {number} inner 引號裡最多幾個碼位
 * @returns {Array<[number, number]>} 每一對的 [開引號位置, 關引號位置]，依開引號由前到後
 */
function shortQuotes(line, inner) {
    const found = [];
    const nextClose = {};
    for (let at = 0; at < line.length; at += 1) {
        const close = QUOTES[line[at]];
        if (close === undefined) continue;
        // 上一次找到的關引號還在後面就直接用（它就是最近的那個），免得很多個開引號各掃一遍
        let to = nextClose[close];
        if (to === undefined || (to !== -1 && to <= at)) to = line.indexOf(close, at + 1);
        nextClose[close] = to;
        if (to >= 0 && within(line, at + 1, to, inner)) found.push([at, to]);
    }
    return found;
}

/**
 * 整段話裡要整個包成 nw 的短引號（日文、英文用）：每一行各自配對（不跨行），再由前到後挑，跟已經挑到的那一對重疊的不挑。
 *
 * @param {string} text 整段話
 * @param {number} end 最後一個非空白字之後的位置（後面的空白不處理）
 * @param {number} inner 引號裡最多幾個碼位（日文 8、英文 12）
 * @returns {Array<[number, number]>} 每一對的 [開引號位置, 關引號之後的位置]，由前到後、互不重疊
 */
function quotePairs(text, end, inner) {
    const picked = [];
    let offset = 0;
    let last = -1;
    for (const line of text.slice(0, end).split('\n')) {
        for (const [open, close] of shortQuotes(line, inner)) {
            if (offset + open <= last) continue;
            picked.push([offset + open, offset + close + 1]);
            last = offset + close;
        }
        offset += line.length + 1;
    }
    return picked;
}

/**
 * 整段話裡可以插 <wbr> 的位置（只有中文用）：每一行各自找，相鄰兩段都是詞、不在短引號裡、不超過 limit（綁住那段的開頭）。
 *
 * @param {string} text 整段話
 * @param {number} end 最後一個非空白字之後的位置（後面的空白不處理）
 * @param {number} limit 位置要小於等於這個（再後面是綁住的 span，裡面不插）
 * @param {Intl.Segmenter} words 這個語言的切詞器
 * @returns {number[]} 要插 <wbr> 的位置，由小到大
 */
function wordBreaks(text, end, limit, words) {
    const cuts = [];
    let offset = 0;
    for (const line of text.slice(0, end).split('\n')) {
        const quotes = shortQuotes(line, QUOTE_MAX_CHARS);
        let next = 0;
        let reach = -1;
        for (const run of line.matchAll(RUN)) {
            let previous = null;
            for (const part of words.segment(run[0])) {
                const at = run.index + part.index;
                if (previous?.isWordLike && part.isWordLike && offset + at <= limit) {
                    // 位置在某一對短引號裡面（開引號之後、關引號以前）就不插
                    while (next < quotes.length && quotes[next][0] < at) {
                        reach = Math.max(reach, quotes[next][1]);
                        next += 1;
                    }
                    if (reach < at) cuts.push(offset + at);
                }
                previous = part;
            }
        }
        offset += line.length + 1;
    }
    return cuts;
}

/**
 * @param {unknown} options bindTail 的第三個參數
 * @returns {string} 要插在 span 結尾的 tail；沒給（不給參數、{}、tail 是 undefined 或空字串）是空字串
 * @throws {TypeError} options 不是物件、或 tail 不是字串（呼叫的人寫錯了）
 */
function readTail(options) {
    if (options === undefined) return '';
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError(`bindTail 的第三個參數要是 { tail } 物件，收到 ${options === null ? 'null' : typeof options}`);
    }
    if (options.tail === undefined) return '';
    if (typeof options.tail !== 'string') throw new TypeError(`bindTail 的 tail 要是字串（HTML 片段），收到 ${options.tail === null ? 'null' : typeof options.tail}`);
    return options.tail;
}

/**
 * 中文：最後三個字包進 span，前面的詞界插 <wbr>。
 *
 * @param {string} text 整段話
 * @param {number} lineStart 最後一個非空行開始的位置
 * @param {number} end 最後一個非空白字之後的位置
 * @param {string} tail 要插在 span 結尾的 HTML 片段（沒有就是空字串）
 * @returns {string} HTML 字串
 */
function withWordBreaks(text, lineStart, end, tail) {
    const start = cjkTailStart(text, lineStart, end);
    let out = '';
    let from = 0;
    for (const cut of wordBreaks(text, end, start, segmenter(WORD_LOCALE, 'word'))) {
        out += `${escapeHtml(text.slice(from, cut))}<wbr>`;
        from = cut;
    }
    return out + escapeHtml(text.slice(from, start)) + SPAN_OPEN + escapeHtml(text.slice(start, end)) + tail + SPAN_CLOSE + escapeHtml(text.slice(end));
}

/**
 * 日文、英文：最後幾個字包進 span，前面的短引號各包一個 span。短引號跟最後幾個字的綁定範圍重疊時：整對都在裡面就不重複包；
 * 一半在裡面，綁定範圍往前延伸到開引號（延伸後超過那個語言的 span 上限就不延伸，那一對也不包）。
 *
 * @param {string} text 整段話
 * @param {'ja' | 'en'} lang 這段話的語言
 * @param {number} lineStart 最後一個非空行開始的位置
 * @param {number} end 最後一個非空白字之後的位置
 * @param {string} tail 要插在最後那個 span 結尾的 HTML 片段（沒有就是空字串）
 * @returns {string} HTML 字串
 */
function withQuotes(text, lang, lineStart, end, tail) {
    const limits = QUOTE_LIMITS[lang];
    let tailFrom = lang === 'en' ? englishTailStart(text, lineStart, end) : cjkTailStart(text, lineStart, end);
    const spans = [];
    for (const [from, to] of quotePairs(text, end, limits.inner)) {
        if (tailFrom < 0 || to <= tailFrom) {
            spans.push([from, to]);
        } else if (from < tailFrom && within(text, from, end, limits.span)) {
            tailFrom = from;
        }
    }
    let out = '';
    let at = 0;
    for (const [from, to] of spans) {
        out += escapeHtml(text.slice(at, from)) + SPAN_OPEN + escapeHtml(text.slice(from, to)) + SPAN_CLOSE;
        at = to;
    }
    if (tailFrom < 0) return out + escapeHtml(text.slice(at, end)) + tail + escapeHtml(text.slice(end));
    return out + escapeHtml(text.slice(at, tailFrom)) + SPAN_OPEN + escapeHtml(text.slice(tailFrom, end)) + tail + SPAN_CLOSE + escapeHtml(text.slice(end));
}

/**
 * 產生網頁時，把一段使用者寫的話變成安全的 HTML，順便把最後幾個字綁在一起；中文再在詞界插 <wbr>（日文、英文不插），日文、英文再把短引號整個包成 nw（日文引號裡 8 個碼位以內、span 最多 10 個；英文 12 與 20）。
 *
 * @param {string} text 一段話（可以多行）
 * @param {'zh' | 'ja' | 'en'} lang 這段話的語言
 * @param {{ tail?: string }} [options] tail：尾端圖示之類的 HTML 片段，**原樣插入（不跳脫）**在綁住那段 span 的裡面、結尾。
 *   呼叫的人負責安全：**只能傳自己寫的固定片段**（例如 `<span class="i i--arrow"></span>`），不能放使用者寫的字。
 *   沒給（不給參數、{}、tail 是 undefined 或空字串）跟不用 tail 完全一樣；只放最後一行的尾巴。
 *   文字是空的或只有空白（沒有可以綁的字）、或英文最後一個字超過 EN_TAIL_MAX_CHARS 不綁時，tail 接在最後一個字後面（結尾空白前面）、不包 span
 * @returns {string} HTML 字串：把最後一個非空行的最後幾個字包進 <span class="nw">（zh、ja 最後三個字，en 最後兩個字、超過 EN_TAIL_MAX_CHARS 的
 *   規則見檔頭），中文另外在詞界插 <wbr>（搭配 word-break: keep-all，見檔頭；日文不插），日文、英文另外把短引號連引號本身包成 <span class="nw">（見檔頭）；空字串回空字串（沒給 tail 時），只有空白的原樣（跳脫後）回
 * @throws {TypeError} lang 不是 'zh'、'ja'、'en'，text 不是字串，options 不是物件，或 tail 不是字串（呼叫的人寫錯了，不是內容寫壞）
 * @throws {Error} 中文、日文要用 Intl.Segmenter，這個環境沒有
 */
export function bindTail(text, lang, options) {
    if (!LANGS.has(lang)) throw new TypeError(`bindTail 的 lang 只收 zh、ja、en，收到 ${JSON.stringify(lang)}`);
    if (typeof text !== 'string') throw new TypeError(`bindTail 只收字串，收到 ${typeof text}`);
    const tail = readTail(options);
    const end = contentEnd(text);
    if (end === 0) return escapeHtml(text) + tail;

    const lineStart = text.lastIndexOf('\n', end - 1) + 1;
    return lang === 'zh' ? withWordBreaks(text, lineStart, end, tail) : withQuotes(text, lang, lineStart, end, tail);
}
