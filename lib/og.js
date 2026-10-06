/**
 * og.js —— 分享卡圖（1200×630 PNG，三語各一張）的規矩：哪三張、來源在哪、拍之前要查什麼、拍出來的怎麼比。
 *
 * 只放不開瀏覽器就能判斷的事（可以直接測）；開瀏覽器拍照是 og-run.js 的事。
 * 設計稿的說明：design/homepage/notes/4-4.md「分享卡：給前端怎麼出圖」。
 */
import fs from 'node:fs';
import path from 'node:path';

export const LANGS = ['zh', 'en', 'ja'];
export const WIDTH = 1200;
export const HEIGHT = 630;
// 一張的上限：設計師量到約 130～150 KB；超過兩倍多半是拍錯了（兩倍螢幕、拍到照片類的底），不是平台的規定
export const MAX_BYTES = 300 * 1024;

/**
 * @param {string} lang zh、en、ja
 * @returns {string} 圖的檔名（「/」不另做圖，用 og-en.png）
 */
export function ogName(lang) {
    return `og-${lang}.png`;
}

/**
 * @param {string} root 專案根目錄（稿裡的 CSS 是從這裡算的，往上四層）
 * @param {string} lang 語言
 * @returns {string} 設計師那一頁的路徑
 */
export function sourcePage(root, lang) {
    return path.join(root, 'design', 'homepage', 'og', lang, 'index.html');
}

/**
 * @param {string} root 專案根目錄
 * @returns {string[]} 缺來源的訊息，一個語言一行（講是哪一張與缺的路徑）；都在就是空陣列
 */
export function missingSources(root) {
    return LANGS.flatMap((lang) => {
        const page = sourcePage(root, lang);
        return fs.statSync(page, { throwIfNoEntry: false })?.isFile() ? [] : [`og-${lang}：找不到來源 ${page}`];
    });
}

/**
 * 拍前自我檢查：字撐破版面，scrollWidth 與 scrollHeight 就會大於畫面。
 *
 * @param {{ width: number, height: number }} box 頁面的 scrollWidth、scrollHeight
 * @returns {string[]} 超出的那一邊各一句（寬超出講 1200、高超出講 630）；沒超出是空陣列
 */
export function overflowProblems(box) {
    const problems = [];
    if (box.width > WIDTH) problems.push(`字撐破版面：寬 ${box.width}px，超出 ${WIDTH}px`);
    if (box.height > HEIGHT) problems.push(`字撐破版面：高 ${box.height}px，超出 ${HEIGHT}px`);
    return problems;
}

/**
 * 字型檢查：畫字用到的字型家族，每一個都要在那個元素 font-family 寫的家族裡 —— 不在就是指定的字型這台沒有，
 * 瀏覽器自己挑了回退字型（掉到 Helvetica 之類，圖看起來正常，字形不是設計的那一套）。
 *
 * @param {Array<{ used: string[], named: string[] }>} nodes 每個畫了字的元素：實際用的家族、font-family 寫的家族
 * @returns {{ used: string[], problems: string[] }} 全部實際用到的家族（不重複，照出現順序）、沒指定卻用到的各一句
 */
export function fontProblems(nodes) {
    const used = new Set();
    const problems = new Set();
    for (const node of nodes) {
        const named = node.named.map((family) => family.toLowerCase());
        for (const family of node.used) {
            used.add(family);
            if (!named.includes(family.toLowerCase())) {
                problems.add(`字型不對：畫字用了沒指定的「${family}」（font-family 寫的是 ${node.named.join('、')}；指定的字型這台沒有？）`);
            }
        }
    }
    return { used: [...used], problems: [...problems] };
}

/**
 * @param {string} lang 語言
 * @param {Buffer} png 拍出來的圖
 * @returns {string[]} 檔案太大的話一句（講位元組與上限）；沒問題是空陣列
 */
export function sizeProblems(lang, png) {
    return png.length > MAX_BYTES ? [`${ogName(lang)} 有 ${png.length} 位元組，超過上限 ${MAX_BYTES}（拍錯了？例如兩倍螢幕）`] : [];
}

/**
 * --check：拍出來的跟輸出資料夾裡的比。
 *
 * @param {string} out 輸出資料夾
 * @param {Record<string, Buffer>} shots 語言 → 拍出來的圖
 * @returns {string[]} 不在的、位元組不同的各一句（相同的不列）；全都對得上是空陣列
 */
export function checkProblems(out, shots) {
    return LANGS.flatMap((lang) => {
        const file = path.join(out, ogName(lang));
        if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return [`${ogName(lang)}：${out} 裡沒有這張`];
        return fs.readFileSync(file).equals(shots[lang]) ? [] : [`${ogName(lang)}：跟照來源拍出來的位元組不同`];
    });
}
