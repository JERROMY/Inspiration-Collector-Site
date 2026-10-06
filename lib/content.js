/**
 * content.js —— 讀整個 content/ 資料夾：三種語言的更新紀錄與公告、共用的社群連結。
 *
 * 讀的檔：changelog.<zh|en|ja>.md、news.<zh|en|ja>.md、links.md。
 * 每一個位置各自讀、各自接住錯誤：檔案不存在、讀不了、不是 UTF-8、是二進位檔，只有那一個位置是 { ok: false, reason }，
 * 其他位置照常；reason 寫得出是哪一支檔。整檔空白不算讀不到（公告本來就可以一則都沒有）。
 * 整個過程不丟例外。內容本身寫壞的（某一條格式不對）是各 parse 函式的事，會留在 entries 裡當壞紀錄。
 */
import { readFile } from 'node:fs/promises';
import { isUtf8 } from 'node:buffer';
import path from 'node:path';
import { parseChangelog } from './changelog.js';
import { parseNews } from './news.js';
import { parseLinks } from './links.js';

const LANGS = ['zh', 'en', 'ja'];

/** readFile 的錯誤碼 → 白話原因；沒列的照原樣寫出來。 */
const WHY = {
    ENOENT: '檔案不存在',
    EISDIR: '這是資料夾，不是檔案',
    EACCES: '沒有讀取的權限',
    EPERM: '沒有讀取的權限',
};

/**
 * 讀一支檔、交給 parse；任何一步失敗都變成 { ok: false, reason }。
 *
 * @param {string} dir content/ 資料夾的路徑
 * @param {string} name 檔名（寫進 reason）
 * @param {(text: string) => object[]} parse 這支檔的 parse 函式
 * @returns {Promise<{ ok: true, entries: object[] } | { ok: false, reason: string }>} 讀得到＝entries，讀不到＝原因
 */
async function readSlot(dir, name, parse) {
    let bytes;
    try {
        bytes = await readFile(path.join(dir, name));
    } catch (err) {
        return { ok: false, reason: `讀不到 ${name}：${WHY[err.code] ?? err.message}` };
    }
    if (bytes.includes(0)) {
        return { ok: false, reason: `${name} 不是文字檔：裡面有 NUL 位元組（像是圖片等二進位檔，或存成了 UTF-16）；請存成 UTF-8 的純文字` };
    }
    if (!isUtf8(bytes)) {
        return { ok: false, reason: `${name} 的編碼不是 UTF-8（可能存成了 Big5 之類）；請另存成 UTF-8` };
    }
    try {
        return { ok: true, entries: parse(bytes.toString('utf8')) };
    } catch (err) {
        return { ok: false, reason: `${name} 讀取時出錯（程式的問題，不是檔案寫壞）：${err.message}` };
    }
}

/**
 * 同一種內容的三個語言各讀一支（changelog.zh.md、changelog.en.md、changelog.ja.md …）。
 *
 * @param {string} dir content/ 資料夾的路徑
 * @param {string} kind 檔名的前半：changelog 或 news
 * @param {(text: string) => object[]} parse 這種檔的 parse 函式
 * @returns {Promise<{ zh: object, en: object, ja: object }>} 每個語言一個位置（各自是 ok:true 或 ok:false）
 */
async function readLangs(dir, kind, parse) {
    const slots = await Promise.all(LANGS.map((lang) => readSlot(dir, `${kind}.${lang}.md`, parse)));
    return Object.fromEntries(LANGS.map((lang, index) => [lang, slots[index]]));
}

/**
 * 讀整個 content/ 資料夾，七個位置各自接住錯誤。
 *
 * @param {string} dir content/ 資料夾的路徑
 * @returns {Promise<{ changelog: object, news: object, links: object }>}
 *   changelog 與 news 各有 zh、en、ja；links 一個；每個位置是 { ok: true, entries } 或 { ok: false, reason }
 */
export async function readContent(dir) {
    const [changelog, news, links] = await Promise.all([
        readLangs(dir, 'changelog', parseChangelog),
        readLangs(dir, 'news', parseNews),
        readSlot(dir, 'links.md', parseLinks),
    ]);
    return { changelog, news, links };
}
