/**
 * fonts.js —— 網頁字型的純函式：要收哪些碼位、怎麼叫 fontTools、fonts.css 怎麼寫、怎麼讀 fonts.css。
 *
 * 這裡一個外部工具都不開、一個檔都不讀不寫（那是 fonts-run.js 與兩支命令的事），收資料、給資料。
 * 網頁字型只有兩個瘦身過的拉丁字型（Google Sans Flex、JetBrains Mono）；中日文走系統字型，不放網頁字型。
 *
 * - FONTS                  兩個字型的來源檔名、輸出檔名、CSS 名稱、字重範圍
 * - FONT_BUDGET_BYTES      public/fonts 底下所有 .woff2 合計的上限（150 KB）
 * - latinCodePoints        要收的碼位：U+0020～007E 全部＋文字裡出現的非中日文字
 * - toRanges / unicodeRangeOf / unicodesArg   碼位 → 連續的範圍／CSS 的 unicode-range／fonttools 的 --unicodes
 * - instancerArgs / subsetArgs               叫 fontTools 的參數
 * - fontsCss               fonts.css 的內容
 * - parseFontFaces / parseUnicodeRange / overlapsCjk   讀 fonts.css（預算檢查用）
 * - fontFilesOf           fonts.css 引用了哪些字型檔（重跑時，舊的、這次不用的檔要拿掉）
 */
import { CJK_RANGES } from './font-text.js';

/**
 * 兩個網頁字型。family 就是授權文件（LICENSES.md）的「CSS 名稱」：兩套的授權都沒有宣告保留字型名稱，瘦身後可以沿用原名，
 * 設計系統的 --font-sans、--font-mono 也才接得上。
 * weight：Google Sans Flex 固定掉 wdth、slnt 之後剩 opsz 與 wght 兩個軸，字重留 300～700（設計系統用到的字重）；
 * JetBrains Mono 原樣留 100～800（切子集只省了字，沒有動軸；再限縮字重只省 2 KB，不值得改變設計系統能用的字重）。
 */
export const FONTS = {
    sans: { source: 'GoogleSansFlex-lite-latin.woff2', output: 'GoogleSansFlex-site.woff2', family: 'Google Sans Flex', weight: '300 700' },
    mono: { source: 'JetBrainsMono-latin.woff2', output: 'JetBrainsMono-site.woff2', family: 'JetBrains Mono', weight: '100 800' },
};

/** public/fonts 底下所有 .woff2 加起來的上限：150 KB（1 KB＝1024 位元組）。 */
export const FONT_BUDGET_BYTES = 150 * 1024;

const ASCII_FIRST = 0x20;
const ASCII_LAST = 0x7e;
// 要保留的 GSUB／GPOS 功能：字距（kern）、連字（liga、calt）、組合字（ccmp）、語言變體（locl）、
// 標記定位（mark、mkmk）、大寫配合標點（case）、等寬數字與齊線數字（tnum、lnum）
const LAYOUT_FEATURES = 'kern,liga,ccmp,locl,mark,mkmk,calt,case,tnum,lnum';
// 保留的字型名稱欄位：0 版權、1～6 名稱，加上 13 授權說明、14 授權網址（OFL 要求每一份附版權聲明與授權，字型檔本身也帶著）
const NAME_IDS = '0,1,2,3,4,5,6,13,14';

/**
 * @param {string[]} chars 文字裡出現的非中日文字（每個元素一個字）
 * @returns {number[]} 要收的碼位：U+0020～007E 全部、加上 chars，不重複、由小到大
 */
export function latinCodePoints(chars) {
    const set = new Set(Array.from({ length: ASCII_LAST - ASCII_FIRST + 1 }, (_, i) => ASCII_FIRST + i));
    for (const ch of chars) set.add(ch.codePointAt(0));
    return [...set].sort((a, b) => a - b);
}

/**
 * @param {number[]} codePoints 碼位，不重複、由小到大
 * @returns {[number, number][]} 連續的碼位併成 [起, 迄]
 */
export function toRanges(codePoints) {
    const ranges = [];
    for (const cp of codePoints) {
        const last = ranges[ranges.length - 1];
        if (last && cp === last[1] + 1) last[1] = cp;
        else ranges.push([cp, cp]);
    }
    return ranges;
}

const hex = (cp) => cp.toString(16).toUpperCase().padStart(4, '0');
const rangeText = ([low, high]) => (low === high ? `U+${hex(low)}` : `U+${hex(low)}-${hex(high)}`);

/**
 * @param {number[]} codePoints 碼位，不重複、由小到大
 * @returns {string} CSS 的 unicode-range 值，例如「U+0020-007E, U+00A7」
 */
export function unicodeRangeOf(codePoints) {
    return toRanges(codePoints).map(rangeText).join(', ');
}

/**
 * @param {number[]} codePoints 碼位，不重複、由小到大
 * @returns {string} fonttools 的 --unicodes 值，例如「U+0020-007E,U+00A7」
 */
export function unicodesArg(codePoints) {
    return toRanges(codePoints).map(rangeText).join(',');
}

/**
 * Google Sans Flex 的軸：wdth 100、slnt 0 固定掉（設計系統的 --gsf-wdth 是 100、slnt 預設就是 0，頁面沒有用到變寬與斜體）；
 * **opsz 不固定，留 8～64**、wght 留 300～700。opsz 不能固定成 18：設計稿的 `font:` 簡寫會把 font-variation-settings 重設掉，
 * 瀏覽器走 font-optical-sizing: auto，實際的 opsz 就是字級（64px 的大標用 64、14px 的導覽用 14）；固定成 18 會讓大標變寬、
 * 導覽變窄、說明文字少一行（量過）。8～64 涵蓋頁面用到的字級（10～64px）。
 * --no-recalc-timestamp：instancer 預設把字型的修改時間改成「現在」，同樣的輸入每次輸出的位元組就不一樣（量過差了 10 秒的時間戳）；不改的話，重跑的輸出位元組相同。
 *
 * @param {string} input 來源字型
 * @param {string} output 輸出字型
 * @returns {string[]} `python <這些參數>` 的參數（一個元素一個參數）
 */
export function instancerArgs(input, output) {
    return ['-m', 'fontTools.varLib.instancer', input, 'opsz=8:64', 'wdth=100', 'slnt=0', 'wght=300:700', '--no-recalc-timestamp', '-o', output];
}

/**
 * @param {string} input 來源字型
 * @param {string} output 輸出字型（WOFF2）
 * @param {number[]} codePoints 要留的碼位
 * @returns {string[]} `python <這些參數>` 的參數
 */
export function subsetArgs(input, output, codePoints) {
    return [
        '-m', 'fontTools.subset', input,
        `--unicodes=${unicodesArg(codePoints)}`,
        `--layout-features=${LAYOUT_FEATURES}`,
        `--name-IDs=${NAME_IDS}`,
        '--flavor=woff2',
        `--output-file=${output}`,
    ];
}

/**
 * @param {{ family: string, file: string, weight: string, unicodeRange: string }[]} faces 每個字型一筆（照這個順序寫）
 * @returns {string} fonts.css 的內容：每筆一個 @font-face、font-display: swap；沒有路徑、沒有時間（同樣的輸入永遠同樣的輸出）
 */
export function fontsCss(faces) {
    const blocks = faces.map((face) => [
        '@font-face {',
        `    font-family: "${face.family}";`,
        `    src: url("/fonts/${face.file}") format("woff2");`,
        `    font-weight: ${face.weight};`,
        '    font-style: normal;',
        '    font-display: swap;',
        `    unicode-range: ${face.unicodeRange};`,
        '}',
    ].join('\n'));
    return [
        '/* 網頁字型：拉丁與等寬，各一個瘦身過的檔。由 scripts/fonts.mjs 產生，不要手改；改了文字或字型之後重跑 npm run fonts。',
        '   中日文不放網頁字型，走系統字型（設計系統 --font-zh 的回退）。授權見 LICENSES.md。 */',
        '',
        blocks.join('\n\n'),
        '',
    ].join('\n');
}

/**
 * 讀 fonts.css：去掉註解，每個 @font-face 一筆，屬性名一律小寫。
 *
 * @param {string} css fonts.css 的內容
 * @returns {Record<string, string>[]} 每個 @font-face 的屬性（名稱小寫、值去頭尾空白）
 */
export function parseFontFaces(css) {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
        const props = {};
        for (const declaration of block[1].split(';')) {
            const at = declaration.indexOf(':');
            if (at >= 0) props[declaration.slice(0, at).trim().toLowerCase()] = declaration.slice(at + 1).trim();
        }
        return props;
    });
}

/**
 * @param {string} value unicode-range 的值，例如「U+0020-007E, U+25??」
 * @returns {[number, number][]} 每一段的 [起, 迄]；萬用字元的 ? 展開成 0～F
 * @throws {Error} 有一段讀不懂
 */
export function parseUnicodeRange(value) {
    return value.split(',').map((part) => {
        const found = /^\s*U\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?\s*$/i.exec(part);
        if (!found) throw new Error(`unicode-range 讀不懂：「${part.trim()}」`);
        const [, from, to] = found;
        if (from.includes('?')) return [parseInt(from.replace(/\?/g, '0'), 16), parseInt(from.replace(/\?/g, 'F'), 16)];
        return [parseInt(from, 16), parseInt(to ?? from, 16)];
    });
}

/**
 * @param {[number, number][]} ranges unicode-range 讀出來的範圍
 * @returns {boolean} 有沒有哪一段碰到中日文的碼位
 */
export function overlapsCjk(ranges) {
    return ranges.some(([low, high]) => CJK_RANGES.some(([a, b]) => low <= b && high >= a));
}

/**
 * @param {string} css fonts.css 的內容
 * @returns {string[]} 每個 @font-face 的 src 引用的檔名（不含資料夾），照出現的順序
 */
export function fontFilesOf(css) {
    return parseFontFaces(css)
        .flatMap((face) => [...(face.src ?? '').matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)].map((match) => match[2].split('/').pop()));
}
