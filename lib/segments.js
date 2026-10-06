/**
 * segments.js —— 把設計師字串表裡「帶斷行標記」的一條字，轉成元素樹（前端的 React 元件接成畫面；不產 HTML 字串，也就不需要 dangerouslySetInnerHTML）。
 *
 * 標記與樣式的定義在設計師的字串表說明（`npm run strings` 會把一份複本放進 strings/README.md）。這一支只做那張「標記」表，
 * 結果跟照說明「轉換順序」那 8 步做字串取代得到的 HTML 同構；說明另外寫的（章名與摘要、使用者自己寫的內容、結尾的箭頭圖示、hero.mobile.text 的 <b>）不在這裡。
 *
 * 這一支沒有任何 import、不碰檔案：網站產生網頁時（Node）與瀏覽器裡的 React 元件都要能直接用它。
 *
 * 元素樹的節點是兩種之一：
 * - 一段字：非空字串，是原字，相鄰的字併成一段。**字串節點沒有跳脫：不要拼成 HTML、不要放進 dangerouslySetInnerHTML；用 React 元素樹放，React 會跳脫。**
 * - 一個元素：剛好 `{ type, props, children }` 三欄的一般物件；props 用 React 的屬性名，前端可以直接 createElement(type, props, ...children)。
 *
 * 標記 → 節點（className 都是 span，除了 `|` 是 wbr）：
 *   «…» u,  {…} nw,  ⟨…⟩ clamp,  ⁅…⁆ nw-wide,  ¦ brk-narrow（空的）,  | wbr（空的）
 *   ⟦ ⟧ 空的括號，className 是 'brk brk--l'／'brk brk--r'，帶 'aria-hidden': 'true'
 *   ↵ 整句變成 [l1, 空白?, l2]：l1、l2 是 className 為 forai__l1、forai__l2 的 span；↵ 前面緊接著的空白（英文）放在兩個 span 之間
 *
 * 寫錯的標記丟 Error（不是 TypeError、RangeError），err.index 是出錯那個字在字串裡的索引（JS 的 UTF-16 索引）；
 * 訊息寫出那個字與「第 N 字」（以字算、1 起算：前面有 𠮷、emoji 時跟索引不同）。
 * 用自己的堆疊、不遞迴，所以很長、很深的字串也不會撐爆呼叫堆疊。
 */

// 成對的標記：開頭 → 結尾與樣式；結尾 → 開頭
const PAIRS = {
    '«': { closer: '»', className: 'u' },
    '{': { closer: '}', className: 'nw' },
    '⟨': { closer: '⟩', className: 'clamp' },
    '⁅': { closer: '⁆', className: 'nw-wide' },
};
const OPENERS = { '»': '«', '}': '{', '⟩': '⟨', '⁆': '⁅' };
const MARKS = '[«»{}|⟨⟩⟦⟧⁅⁆¦↵%]';
const SUBSTITUTIONS = ['url', 'nn', '章名'];
// «…» 最多三層（設計師說明的巢狀規則）
const MAX_UNIT_DEPTH = 3;

/**
 * @param {string} className 樣式名
 * @param {Array} children 裡面的節點
 * @returns {{ type: 'span', props: { className: string }, children: Array }} 一個 span 節點
 */
function span(className, children) {
    return { type: 'span', props: { className }, children };
}

/**
 * @param {'l' | 'r'} side 左括號或右括號
 * @returns {object} 空的括號節點（只是畫面上的裝飾，不進文字，所以 aria-hidden）
 */
function bracket(side) {
    return { type: 'span', props: { className: `brk brk--${side}`, 'aria-hidden': 'true' }, children: [] };
}

/**
 * @param {Array} nodes 要接字的那一層
 * @param {string} text 要接的字；空字串不留節點，前一個也是字就併進去
 */
function addText(nodes, text) {
    if (text === '') return;
    const last = nodes.length - 1;
    if (last >= 0 && typeof nodes[last] === 'string') nodes[last] += text;
    else nodes.push(text);
}

/**
 * @param {unknown} value 任何值
 * @returns {string} 白話的型別名（講給人看的，寫進錯誤訊息）
 */
function describeType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '陣列';
    return typeof value;
}

/**
 * @param {{ url?: string, nn?: string, 章名?: string } | undefined} values 呼叫端給的代入值
 * @returns {Record<string, string | undefined> | null} 三個代入值各自的字串（沒給的是 undefined）；呼叫端沒給 values 是 null
 * @throws {TypeError} values 不是一般物件、或 url／nn／章名 有給但不是字串
 */
function readValues(values) {
    if (values === undefined) return null;
    if (Object.prototype.toString.call(values) !== '[object Object]') {
        throw new TypeError(`parseSegments 的 values 要是物件（{ url, nn, 章名 }），得到 ${describeType(values)}`);
    }
    const fill = {};
    for (const name of SUBSTITUTIONS) {
        const value = Object.hasOwn(values, name) ? values[name] : undefined;
        if (value !== undefined && typeof value !== 'string') {
            throw new TypeError(`parseSegments 的 values.${name} 要是字串，得到 ${describeType(value)}`);
        }
        fill[name] = value;
    }
    return fill;
}

/**
 * @param {string} text 整句字
 * @param {number} index 出錯的字在字串裡的索引
 * @param {string} token 出錯的字（代入值寫整個 %nn%）
 * @param {string} reason 哪裡錯、怎麼修
 * @returns {Error} 訊息是「第 N 字「x」…」，err.index 是 index
 */
function fail(text, index, token, reason) {
    const place = Array.from(text.slice(0, index)).length + 1;
    return Object.assign(new Error(`第 ${place} 字「${token}」${reason}`), { index });
}

/**
 * @param {string} chunk 一段字
 * @returns {number} 結尾那一串空白從哪裡開始（沒有空白就是 chunk 的長度）
 */
function trailingSpaceAt(chunk) {
    let at = chunk.length;
    while (at > 0 && /\s/.test(chunk[at - 1])) at -= 1;
    return at;
}

/**
 * 把一條帶標記的字轉成元素樹。
 *
 * @param {string} text 字串表裡的一條字
 * @param {{ url?: string, nn?: string, 章名?: string }} [values] 代入值：字裡的 %url%、%nn%、%章名% 換成這裡的字串（大小寫要對）。
 *   沒給 values：原樣留在字裡（檢查字串表時這樣叫）。給了：字裡每一個代入值都要有字串值，沒有就丟 Error；
 *   最後才換，所以值裡的標記字元、HTML、%…% 都只是普通的字，不轉、也不再換一次；值是空字串就不留節點；多給的鍵不管。
 * @returns {Array<string | { type: string, props: object, children: Array }>} 元素樹；空字串回 []
 * @throws {TypeError} text 不是字串、values 不是一般物件、url／nn／章名 有給但不是字串
 * @throws {Error} 標記寫錯（開了沒關、多出來的結尾、交錯、{…} 裡有 { 或 «、«…» 超過三層、↵ 不在最外層或一句兩個、
 *   ¦ 不在 ⁅…⁆ 裡、字面的 %、給了 values 卻少了要的那個）；err.index 指出錯的字
 */
export function parseSegments(text, values) {
    if (typeof text !== 'string') throw new TypeError(`parseSegments 的 text 要是字串，得到 ${describeType(text)}`);
    const fill = readValues(values);
    const marks = new RegExp(MARKS, 'g');
    const open = []; // 還沒關的開頭：{ mark, index, parent（外面那一層的節點）, children }
    const depth = { '«': 0, '{': 0, '⁅': 0 };
    let nodes = [];
    let first = null; // 遇到 ↵ 之後：{ nodes: 前半句, gap: ↵ 前面的空白 }
    let from = 0;

    for (let hit = marks.exec(text); hit !== null; hit = marks.exec(text)) {
        const mark = hit[0];
        const at = hit.index;
        const chunk = text.slice(from, at);
        from = at + 1;
        if (mark !== '↵') addText(nodes, chunk);

        if (mark in PAIRS) {
            if (mark === '«' && depth['{'] > 0) throw fail(text, at, mark, '不能放在「{…}」裡面');
            if (mark === '«' && depth['«'] >= MAX_UNIT_DEPTH) throw fail(text, at, mark, `超過 ${MAX_UNIT_DEPTH} 層（「«…»」最多巢狀 ${MAX_UNIT_DEPTH} 層）`);
            if (mark === '{' && depth['{'] > 0) throw fail(text, at, mark, '不能放在另一個「{…}」裡面');
            if (mark in depth) depth[mark] += 1;
            const frame = { mark, index: at, parent: nodes, children: [] };
            open.push(frame);
            nodes = frame.children;
        } else if (mark in OPENERS) {
            const frame = open[open.length - 1];
            if (frame === undefined) throw fail(text, at, mark, `多出來了，前面沒有可以配對的「${OPENERS[mark]}」`);
            if (frame.mark !== OPENERS[mark]) throw fail(text, at, mark, `對不上：它前面還沒關起來的是「${frame.mark}」（要先關「${PAIRS[frame.mark].closer}」）`);
            open.pop();
            if (frame.mark in depth) depth[frame.mark] -= 1;
            nodes = frame.parent;
            nodes.push(span(PAIRS[frame.mark].className, frame.children));
        } else if (mark === '|') {
            nodes.push({ type: 'wbr', props: {}, children: [] });
        } else if (mark === '⟦' || mark === '⟧') {
            nodes.push(bracket(mark === '⟦' ? 'l' : 'r'));
        } else if (mark === '¦') {
            if (depth['⁅'] === 0) throw fail(text, at, mark, '只能放在「⁅…⁆」裡面');
            nodes.push(span('brk-narrow', []));
        } else if (mark === '↵') {
            if (open.length > 0) throw fail(text, at, mark, '只能放在最外層，不能在成對的標記裡面');
            if (first !== null) throw fail(text, at, mark, '一句只能有一個');
            // ↵ 前面緊接著的空白（英文）留在兩個 span 之間；只看原字，代入值的字不算
            const cut = trailingSpaceAt(chunk);
            addText(nodes, chunk.slice(0, cut));
            first = { nodes, gap: chunk.slice(cut) };
            nodes = [];
        } else {
            // %：只認 %url%、%nn%、%章名%
            const name = SUBSTITUTIONS.find((candidate) => text.startsWith(`%${candidate}%`, at));
            if (name === undefined) throw fail(text, at, mark, '不是代入值（只有 %url%、%nn%、%章名%；字面的 % 不能寫在字串表裡）');
            const token = `%${name}%`;
            from = at + token.length;
            marks.lastIndex = from;
            if (fill === null) addText(nodes, token);
            else if (fill[name] === undefined) throw fail(text, at, token, '沒有給代入值');
            else addText(nodes, fill[name]);
        }
    }

    const unclosed = open[open.length - 1];
    if (unclosed !== undefined) throw fail(text, unclosed.index, unclosed.mark, `沒有關起來（少了配對的「${PAIRS[unclosed.mark].closer}」）`);
    addText(nodes, text.slice(from));
    if (first === null) return nodes;
    return [span('forai__l1', first.nodes), ...(first.gap === '' ? [] : [first.gap]), span('forai__l2', nodes)];
}
