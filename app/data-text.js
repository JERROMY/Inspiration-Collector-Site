// 從資料轉進來的字（09 教學影片的章名、摘要）怎麼斷行：規則寫在 strings/README.md「從資料轉進來的字」，跟設計稿的產生程式同一套。
// 章名與摘要是教學片的章節資料，沒辦法一句一句人工排；這裡在產生網頁時照規則找出「綁住不換行」的範圍與斷行單位，
// 給一棵小小的節點樹（不產 HTML 字串），由 components/DataText 畫成元素。只在產生網頁時、伺服器端跑。
//
// 節點：字串（字）、{ wbr: true }（可以在這裡換行）、{ cls, kids }（<span class="cls">，cls 是 u、nw、nw-320、nw-360）。
import { getPlainString } from './strings.js';

const PUNCT = /[，。、；：！？「」『』（）・ ]/;
// 產品名與檔名清單（整段綁住，不管在不在引號裡）：取自文案表實際的用字，加新名字跟 strings/README.md 同一節一起加。
// 產品自己的名字從字串表取（三語的 root.name），不在程式裡再寫一次
const NAMES = [...['zh', 'ja', 'en'].map((lang) => getPlainString(lang, 'root.name')), 'Chrome 線上應用程式商店', 'Chrome ウェブストア', 'Chrome Web Store',
    'Claude Code', 'Gemini CLI', 'Codex', 'ChatGPT', 'Perplexity', 'MATERIAL.md', 'README.md', 'OUTLINE.md', 'index.json'];
const SEG = { zh: new Intl.Segmenter('zh-Hant', { granularity: 'word' }), ja: new Intl.Segmenter('ja', { granularity: 'word' }) };
const BIND = {
    en: [/\b[A-Z][\w’-]*(?: [A-Z][\w’-]*)+/g, /(?<![\d.])\b\d+ [A-Za-z]+/g, /“[^”]{1,24}”/g],
    cjk: [/[A-Za-z0-9][\w.+#/-]*(?: [A-Za-z0-9][\w.+#/-]*)+/g, /(?<![\d.])\d+ [^\s，。、；：！？]/g, /「[^」]{1,12}」/g,
        /」[をにがはでとのもへや]/g, /[A-Za-z0-9./]+ [をにがはでとのもへや]/g],
};

const letters = (x) => [...x].filter((ch) => !PUNCT.test(ch)).length;

// 中日文：位置落在一個詞（Intl.Segmenter 的 word）中間時，往前挪到那個詞的開頭
function wordStart(lang, text, at) {
    if (lang === 'en') return at;
    for (const seg of SEG[lang].segment(text)) if (at > seg.index && at < seg.index + seg.segment.length) return seg.index;
    return at;
}

// 從 z 往前數 n 個「字」（標點不算），再對齊到詞的開頭（英文：最後 n 個字）
function backFrom(lang, text, a, z, n) {
    if (lang === 'en') {
        const sub = text.slice(a, z).trimEnd();
        let at = sub.length;
        for (let k = 0; k < n; k += 1) at = sub.lastIndexOf(' ', at - 1);
        return a + at + 1;
    }
    let at = z;
    let k = 0;
    while (at > a && k < n) {
        at -= 1;
        if (!PUNCT.test(text[at])) k += 1;
    }
    return Math.max(a, wordStart(lang, text, at));
}

// ④ 結尾：中日文最後 3 個字（對齊到詞的開頭）連同後面的標點；英文最後兩個字。前面剩不到 5 個字（英文 2 個字）就整段綁住
function tailStart(lang, text) {
    const at = backFrom(lang, text, 0, text.length, lang === 'en' ? 2 : 3);
    const rest = lang === 'en' ? text.slice(0, at).trim().split(' ').filter(Boolean).length : letters(text.slice(0, at));
    return rest < (lang === 'en' ? 2 : 5) ? 0 : at;
}

// 範圍重疊的合併；剛好相接的留兩段 —— 但後一段是收尾的標點開頭時要合併（兩個 nowrap 之間瀏覽器不套避頭規則）
function merge(ranges, text = '') {
    const merged = [];
    for (const r of [...ranges].sort((a, b) => a[0] - b[0])) {
        const last = merged.at(-1);
        if (last && (r[0] < last[1] || (r[0] === last[1] && /^[」』）”’、。，；：！？]/.test(text[r[0]] || '')))) last[1] = Math.max(last[1], r[1]);
        else merged.push([...r]);
    }
    return merged;
}

// 1. 綁住的範圍（①～⑥）
function bindRanges(lang, text) {
    const ranges = [[tailStart(lang, text), text.length]];
    for (const re of BIND[lang === 'en' ? 'en' : 'cjk']) for (const m of text.matchAll(re)) ranges.push([m.index, m.index + m[0].length]);
    for (const name of NAMES) {
        for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) ranges.push([at > 0 && '「（“‘『'.includes(text[at - 1]) ? at - 1 : at, at + name.length]);
    }
    if (lang === 'ja') for (const seg of SEG.ja.segment(text)) if (seg.isWordLike && seg.segment.length >= 2) ranges.push([seg.index, seg.index + seg.segment.length]);
    return merge(ranges, text);
}

// 寬度分級：估寬（全形 1、拉丁字母與數字 0.55、其他 0.3）→ nw（≤14）、nw-320（≤17）、nw-360（≤20）、不包
const est = (x) => [...x].reduce((n, ch) => n + (/[\u2E80-\uFFEF]/.test(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? 0.55 : 0.3), 0);
function nwClass(x, less = 0) {
    const w = est(x) + less;
    if (w <= 14) return 'nw';
    if (w <= 17) return 'nw-320';
    return w <= 20 ? 'nw-360' : '';
}

// ⑤′ 結尾是「收引號＋助詞」或「英數字＋空白＋助詞」的一段，從哪裡起要另外綁；沒有就 -1
function particleCut(piece) {
    if (/[」』）][をにがはでとのもへや]$/.test(piece)) {
        const last = piece.length - 3;
        for (const sg of SEG.ja.segment(piece)) if (last >= sg.index && last < sg.index + sg.segment.length) return sg.index;
        return last;
    }
    const m = piece.match(/[A-Za-z0-9./]+ [をにがはでとのもへや]$/);
    return m ? m.index : -1;
}

// 字串裡每個「前面補一個斷點（中文 keep-all 時「前面不給斷）；open 是 false 時原樣
function free(x, open) {
    if (!open || !x) return x ? [x] : [];
    const out = [];
    x.split('「').forEach((part, i) => {
        if (i > 0) out.push({ wbr: true }, '「');
        if (part) out.push(part);
    });
    return out;
}

// 把 [a, z) 畫成節點：範圍裡的照分級包起來，其餘照原字
function renderBound(text, ranges, a = 0, z = text.length, open = false, less = 0) {
    const out = [];
    let at = a;
    for (const [ra, rz] of ranges) {
        if (rz <= a || ra >= z) continue;
        const s0 = Math.max(ra, a);
        const e0 = Math.min(rz, z);
        const piece = text.slice(s0, e0);
        const cls = nwClass(piece, less);
        const cut = cls === 'nw' ? -1 : particleCut(piece);
        const body = cut > 0 && nwClass(piece.slice(cut), less) === 'nw'
            ? [...(cls ? [piece.slice(0, cut)] : free(piece.slice(0, cut), open)), { cls: 'nw', kids: [piece.slice(cut)] }]
            : (cls ? [piece] : free(piece, open));
        out.push(...free(text.slice(at, s0), open));
        if (open && text[s0] === '「' && s0 > a) out.push({ wbr: true });
        if (cls) out.push({ cls, kids: body });
        else out.push(...body);
        at = e0;
    }
    out.push(...free(text.slice(at, z), open));
    return out;
}

// ⑦ 一段綁住的字前面、同一個分句裡只剩不到 5 個字（英文 2 個字）時，那幾個字併進來一起綁
function absorb(lang, text, ranges, clauses) {
    return merge(ranges.map(([ra, rz]) => {
        const c = clauses.find(([s0, e0]) => ra >= s0 && ra < e0);
        if (!c || ra === c[0]) return [ra, rz];
        const before = text.slice(c[0], ra);
        const few = lang === 'en' ? before.trim().split(' ').filter(Boolean).length < 2 : letters(before) < 5;
        return few ? [c[0], rz] : [ra, rz];
    }), text);
}

/**
 * 章名：只綁住、不切單位（章名那一欄比摘要窄，估寬加 5）。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 * @param {string} text 章名（原字，不帶標記）
 * @returns {Array} 節點
 */
export function chapterName(lang, text) {
    return renderBound(text, absorb(lang, text, bindRanges(lang, text), [[0, text.length]]), 0, text.length, false, 5);
}

// 從 z 往前數到「n 個全形字寬」（照 est 的估法；標點與空白不算），再對齊到詞的開頭。
// 日文：起點剛好是助詞（Segmenter 把它切成自己一個詞）時，再往前併一個詞 —— 不然助詞會跑到行首
function backWidth(lang, text, a, z, n) {
    let at = z;
    let w = 0;
    while (at > a && w < n) {
        at -= 1;
        if (!PUNCT.test(text[at])) w += est(text[at]);
    }
    at = wordStart(lang, text, at);
    if (lang === 'ja' && at > a && /[をにがはでとのもへや]/.test(text[at]) && !PUNCT.test(text[at - 1])) at = wordStart(lang, text, at - 1);
    return Math.max(a, at);
}

// 單位自己的尾巴：中日文最後 5 個全形字寬（對齊到詞的開頭；不到 10 個字整段綁住），英文最後兩個字
function pieceTail(lang, text, a, z) {
    if (lang === 'en') return [backFrom(lang, text, a, z, 2), z];
    return letters(text.slice(a, z)) < 10 ? [a, z] : [backWidth(lang, text, a, z, 5), z];
}

/**
 * 摘要：綁住＋切單位（一句一個外層單位，句子裡再照分句切；中文的「、」是列舉不切）。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 * @param {string} text 摘要（原字，不帶標記）
 * @returns {Array} 節點
 */
export function chapterDesc(lang, text) {
    const en = lang === 'en';
    const base = bindRanges(lang, text);
    const isFree = (at) => !base.some(([a, z]) => at > a && at < z);
    const cuts = (re, a, z) => [...text.slice(a, z).matchAll(re)].map((m) => a + m.index + m[0].length).filter((at) => at < z && isFree(at));
    const pieces = (a, z, re, gap) => {
        const at = [a, ...cuts(re, a, z), z];
        return at.slice(0, -1).map((s0, n) => [s0 + (n && gap ? 1 : 0), at[n + 1]]).filter(([s0, e0]) => e0 > s0);
    };
    // 不到 5 個字的分句併進下一個
    const short = (list) => list.reduce((acc, p) => {
        const prev = acc.at(-1);
        if (prev && letters(text.slice(prev[0], prev[1])) < 5) prev[1] = p[1];
        else acc.push([...p]);
        return acc;
    }, []);
    // 中日文不到 5 個字的句子併回前一句（同分句的規則往上一層）
    const shortSentence = (list) => list.reduce((acc, p) => {
        const prev = acc.at(-1);
        if (prev && letters(text.slice(p[0], p[1])) < 5) prev[1] = p[1];
        else acc.push([...p]);
        return acc;
    }, []);
    const sentences = (en ? pieces(0, text.length, /[.!?;:](?= )/g, true) : shortSentence(pieces(0, text.length, /[。！？；]/g, false)))
        .map(([a, z]) => [a, z, en ? [[a, z]] : short(pieces(a, z, lang === 'ja' ? /[、，：]/g : /[，：]/g, false))]);
    const clauses = sentences.flatMap(([, , inner]) => inner);
    const ranges = absorb(lang, text, merge([...base, ...clauses.map(([s0, e0]) => pieceTail(lang, text, s0, e0))], text), clauses);
    const zh = lang === 'zh';
    const out = [];
    sentences.forEach(([a, z, inner], n) => {
        if (n > 0 && en) out.push(' ');
        const kids = inner.length > 1
            ? inner.map(([s0, e0]) => ({ cls: 'u', kids: renderBound(text, ranges, s0, e0, zh) }))
            : renderBound(text, ranges, a, z, zh);
        out.push({ cls: 'u', kids });
    });
    return out;
}

/**
 * 節點樹 → HTML 字串（只給對照設計稿的檢查程式用；網頁用 components/DataText 畫元素，不放 HTML 字串）。
 *
 * @param {Array} nodes
 * @returns {string}
 */
export function toHtml(nodes) {
    return nodes.map((n) => (typeof n === 'string' ? n : n.wbr ? '<wbr>' : `<span class="${n.cls}">${toHtml(n.kids)}</span>`)).join('');
}
