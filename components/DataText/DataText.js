/**
 * DataText —— 從資料轉進來的字（app/data-text.js 照規則算好的節點樹）畫成元素：字、<wbr>、<span class>（u、nw、nw-320、nw-360，global.css 的全域 class）。
 * 不放 HTML 字串，字交給 React 跳脫。
 *
 * @param {{ nodes: Array }} props nodes：chapterName／chapterDesc 的結果
 */
export default function DataText({ nodes }) {
    return nodes.map((n, i) => {
        if (typeof n === 'string') return n;
        if (n.wbr) return <wbr key={i} />;
        return <span key={i} className={n.cls}><DataText nodes={n.kids} /></span>;
    });
}
