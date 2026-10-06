import { createElement, Fragment } from 'react';
import { parseSegments } from '../../lib/segments.js';

// 不用 JSX、不 import CSS：純 Node 也載得起來（測試直接 import 它）。標記用到的 class（.u、.nw、.clamp…）在全域 CSS（app/styles/global.css）。

// bold 那一段的頭尾記號：私用區的字，字串表裡不會出現（出現了就丟錯，不猜）
const BOLD_START = '\uE000';
const BOLD_END = '\uE001';
// link 那幾個字的頭尾記號：同上，私用區的字
const LINK_START = '\uE002';
const LINK_END = '\uE003';
// tail 放在元素樹裡的位置（toElement 換成呼叫端給的 React 元素）
const TAIL = { tail: true };

/**
 * parseSegments 的一個節點 → React 的子節點。字串交給 React 跳脫；元素的 props 已經是 React 的屬性名（className、aria-hidden）。
 *
 * @param {string | { type: string, props: object, children: Array } | typeof TAIL} node 元素樹的一個節點
 * @param {import('react').ReactNode} tail 呼叫端給的結尾元素
 * @returns {import('react').ReactNode}
 */
function toElement(node, tail) {
    if (node === TAIL) return tail;
    if (typeof node === 'string') return node;
    return createElement(node.type, node.props, ...node.children.map((child) => toElement(child, tail)));
}

/**
 * 在帶標記的原字裡，把 bold 那一段（緊接在第一個 « 之後）用兩個記號框起來，parseSegments 之後再換成 <b>。
 *
 * @param {string} text 字串表的原字
 * @param {string} bold 字串表的另一條原字（要包 <b> 的那一段）
 * @returns {string} 框起來的原字
 * @throws {Error} text 沒有 «、bold 不在第一個 « 的緊後面、或字裡已經有記號
 */
function markBold(text, bold) {
    if (text.includes(BOLD_START) || text.includes(BOLD_END)) throw new Error('<Seg bold>：字裡有私用區的字（U+E000、U+E001），沒辦法標出粗體那一段');
    const open = text.indexOf('«');
    if (open < 0) throw new Error(`<Seg bold>：字裡沒有「«」，找不到要包 <b> 的那一段（${JSON.stringify(bold)}）`);
    if (bold === '' || !text.startsWith(bold, open + 1)) throw new Error(`<Seg bold>：${JSON.stringify(bold)} 要緊接在第一個「«」之後（${JSON.stringify(text)}）`);
    const end = open + 1 + bold.length;
    return text.slice(0, open + 1) + BOLD_START + bold + BOLD_END + text.slice(end);
}

/**
 * 把一層子節點裡兩個記號之間的節點包成 <b>。bold 本身是一條合法的字（標記成對），所以兩個記號一定在同一層。
 *
 * @param {Array} nodes 元素樹的一層（會被改掉）
 * @returns {boolean} 這一層（或更裡面）有沒有找到並包好
 */
function wrapBold(nodes) {
    // 先把含記號的字串拆開，記號自己成一個節點
    const flat = [];
    for (const node of nodes) {
        if (typeof node !== 'string' || (!node.includes(BOLD_START) && !node.includes(BOLD_END))) {
            flat.push(node);
            continue;
        }
        for (const part of node.split(/([\uE000\uE001])/)) if (part !== '') flat.push(part);
    }
    const start = flat.indexOf(BOLD_START);
    const end = flat.indexOf(BOLD_END);
    if (start >= 0 && end > start) {
        flat.splice(start, end - start + 1, { type: 'b', props: {}, children: flat.slice(start + 1, end) });
        nodes.splice(0, nodes.length, ...flat);
        return true;
    }
    return nodes.some((node) => typeof node === 'object' && Array.isArray(node.children) && wrapBold(node.children));
}

/**
 * 在帶標記的原字裡，找第一次出現的 phrase（strings/README.md「句子裡的連結」：在轉換標記之前、在字串裡找），前後放記號。
 * phrase 裡不能有標記字元（不然它跨過了標記，包不成一個 <a>）。
 *
 * @param {string} text 字串表的原字
 * @param {string} phrase 要變成連結的那幾個字
 * @returns {string} 標好的原字
 * @throws {Error} 找不到、phrase 帶標記字元、或字裡已經有記號
 */
function markLink(text, phrase) {
    if (text.includes(LINK_START) || text.includes(LINK_END)) throw new Error('<Seg link>：字裡有私用區的字（U+E002、U+E003），沒辦法標出連結那一段');
    if (phrase === '' || /[«»{}|⟨⟩⟦⟧⁅⁆¦↵%]/.test(phrase)) throw new Error(`<Seg link>：${JSON.stringify(phrase)} 不能是空的、也不能帶標記字元`);
    const at = text.indexOf(phrase);
    if (at < 0) throw new Error(`<Seg link>：字裡找不到 ${JSON.stringify(phrase)}（${JSON.stringify(text)}）`);
    return text.slice(0, at) + LINK_START + phrase + LINK_END + text.slice(at + phrase.length);
}

/**
 * 把兩個記號夾住的那段字換成 <a>。記號之間沒有標記，所以一定在同一個字串節點裡。
 *
 * @param {Array} nodes 元素樹的一層（會被改掉）
 * @param {{ href: string, className?: string }} link 連到哪裡、樣式
 * @returns {boolean} 有沒有找到並換好
 */
function wrapLink(nodes, link) {
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (typeof node === 'string' && node.includes(LINK_START)) {
            const [before, rest] = node.split(LINK_START);
            const [inside, after] = rest.split(LINK_END);
            const a = { type: 'a', props: { href: link.href, ...(link.className ? { className: link.className } : {}) }, children: [inside] };
            nodes.splice(i, 1, ...[before, a, after].filter((part) => part !== ''));
            return true;
        }
        if (typeof node === 'object' && Array.isArray(node.children) && wrapLink(node.children, link)) return true;
    }
    return false;
}

/**
 * 元素樹裡最後一個 {…}（className 是 nw 的 span，照文件順序的最後一個）。
 *
 * @param {Array} nodes 元素樹
 * @returns {object | null}
 */
function lastNowrap(nodes) {
    let found = null;
    const walk = (list) => {
        for (const node of list) {
            if (typeof node !== 'object' || !Array.isArray(node.children)) continue;
            if (node.props && node.props.className === 'nw') found = node;
            walk(node.children);
        }
    };
    walk(nodes);
    return found;
}

/**
 * Seg —— 字串表裡帶斷行標記的一條字（app/strings.js 的 getString 取來的原字）畫成元素。
 *
 * 收：
 * - text：原字。values（選填）：%url%、%nn%、%章名% 的代入值。
 * - bold（選填）：字串表的另一條原字；在 text 的第一個 «…» 裡、緊接著那個 « 之後的那一段包 <b>。找不到就丟錯（不靜靜不包）。
 * - tail（選填）：一個 React 元素（例如箭頭圖示），放進最後一個 {…} 的裡面、結尾，跟最後一個詞一起換行；沒有 {…} 時放在最後面。
 * - link（選填）：{ text, href, className }，原字裡第一次出現的 text 包成 <a>（句子裡的連結，strings/README.md「句子裡的連結」）。找不到就丟錯。
 * 給：一組 React 元素（Fragment 包著）。沒給 bold、tail、link 時跟原本一樣。
 * 標記寫錯時 parseSegments 丟的錯照樣往外丟（產生網頁會失敗），不吞。
 * 使用者自己寫的內容（公告、更新紀錄）不走這裡，走 lib/bind-tail.js。
 *
 * @param {{ text: string, values?: { url?: string, nn?: string, 章名?: string }, bold?: string, tail?: import('react').ReactNode,
 *   link?: { text: string, href: string, className?: string } }} props
 */
export default function Seg({ text, values, bold, tail, link }) {
    let raw = bold === undefined ? text : markBold(text, bold);
    if (link !== undefined) raw = markLink(raw, link.text);
    const nodes = parseSegments(raw, values);
    if (bold !== undefined && !wrapBold(nodes)) throw new Error(`<Seg bold>：標不出 ${JSON.stringify(bold)} 那一段`);
    if (link !== undefined && !wrapLink(nodes, link)) throw new Error(`<Seg link>：標不出 ${JSON.stringify(link.text)} 那一段`);
    if (tail !== undefined) {
        const target = lastNowrap(nodes);
        (target ? target.children : nodes).push(TAIL);
    }
    return createElement(Fragment, null, ...nodes.map((node) => toElement(node, tail)));
}
