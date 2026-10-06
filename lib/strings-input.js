/**
 * strings-input.js —— 讀 `npm run strings` 的輸入：設計師的字串表資料夾（zh.json、en.json、ja.json 與說明 README.md）和文案表 copy.md。
 *
 * 只管「讀得到、形狀對」：檔不在、是資料夾、空的、不是 JSON、最外層不是物件，各講一句白話放進 problems（一次全部列出，不是遇到第一個就停）。
 * 每一條字轉不轉得過、三語 id 對不對得上、copy.md 的 id 在不在，是 strings-check.js 的事。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describeType } from './strings-check.js';

/** 字串表的三種語言，順序也是列問題的順序 */
export const LANGS = ['zh', 'en', 'ja'];
/** 要放進輸出資料夾的四個檔（三個字串表加上設計師的說明） */
export const FILE_NAMES = [...LANGS.map((lang) => `${lang}.json`), 'README.md'];

// 文案表的表頭（每個欄位去掉頭尾空白後接起來）。copy.md 裡另有版本表、字數表，表頭不同，不算
const COPY_HEADER = 'id|zh|en|ja|來源|確認';

/**
 * @param {string} file 檔案路徑
 * @param {string} label 訊息裡怎麼稱呼這個檔
 * @param {string[]} problems 問題清單（讀不了就加一行）
 * @returns {Buffer | null} 檔案的位元組；不存在、是資料夾、讀不了回 null（原因已經放進 problems）
 */
function readInput(file, label, problems) {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) {
        problems.push(`${label}：找不到（${file}）`);
        return null;
    }
    if (!stat.isFile()) {
        problems.push(`${label}：是資料夾，不是檔案（${file}）`);
        return null;
    }
    try {
        return fs.readFileSync(file);
    } catch (err) {
        problems.push(`${label}：讀不了（${err.code ?? err.message}）`);
        return null;
    }
}

/**
 * @param {string} name 檔名（zh.json）
 * @param {string} text 檔案內容
 * @param {string[]} problems 問題清單
 * @returns {Record<string, unknown> | null} id → 值的物件；空的、不是 JSON、最外層不是物件回 null（原因已經放進 problems）
 */
function parseTable(name, text, problems) {
    if (text.trim() === '') {
        problems.push(`${name}：是空的`);
        return null;
    }
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        const reason = text.startsWith('\u{FEFF}') ? '開頭有 BOM，請存成沒有 BOM 的 UTF-8' : err.message.replace(/\s+/g, ' ');
        problems.push(`${name}：不是 JSON（${reason}）`);
        return null;
    }
    if (Object.prototype.toString.call(data) !== '[object Object]') {
        problems.push(`${name}：最外層要是物件（id → 字串），得到 ${describeType(data)}`);
        return null;
    }
    return data;
}

/**
 * @param {string} dir 設計師的字串表資料夾
 * @returns {{ files: Record<string, Buffer>, tables: Record<string, Record<string, unknown> | null>, problems: string[] }}
 *   files：讀得到的檔的原始位元組（檔名 → 內容，要原樣放進輸出資料夾）；
 *   tables：每個語言的 id → 值（讀不了、不是 JSON、最外層不是物件的是 null）；
 *   problems：讀不了的原因，每個一行（缺 README.md 也算）
 */
export function readStrings(dir) {
    const problems = [];
    const files = {};
    const tables = {};
    for (const lang of LANGS) {
        const name = `${lang}.json`;
        const buffer = readInput(path.join(dir, name), name, problems);
        tables[lang] = buffer === null ? null : parseTable(name, buffer.toString('utf8'), problems);
        if (buffer !== null) files[name] = buffer;
    }
    const readme = readInput(path.join(dir, 'README.md'), 'README.md（設計師的字串表說明，要跟著放進輸出資料夾）', problems);
    if (readme !== null) files['README.md'] = readme;
    return { files, tables, problems };
}

/**
 * @param {string} markdown copy.md 的內容
 * @returns {string[]} 文案表（表頭剛好是「| id | zh | en | ja | 來源 | 確認 |」的表）每一列的第一格，照出現的順序、不重複；
 *   分隔列（|---|）不算；表格到第一個不是 | 開頭的行為止
 */
function copyIdsOf(markdown) {
    const ids = new Set();
    let inTable = false;
    for (const row of markdown.split(/\r?\n/)) {
        if (!row.startsWith('|')) {
            inTable = false;
            continue;
        }
        const cells = row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (cells.join('|') === COPY_HEADER) {
            inTable = true;
        } else if (inTable && cells[0] !== '' && !/^:?-+:?$/.test(cells[0])) {
            ids.add(cells[0]);
        }
    }
    return [...ids];
}

/**
 * @param {string} file copy.md 的路徑
 * @returns {{ ids: string[] | null, problems: string[] }} 文案表的 id；檔不在、是資料夾、讀不了、裡面沒有文案表時 ids 是 null、problems 講原因
 */
export function readCopyIds(file) {
    const problems = [];
    const buffer = readInput(file, '--copy', problems);
    if (buffer === null) return { ids: null, problems };
    const ids = copyIdsOf(buffer.toString('utf8'));
    if (ids.length === 0) {
        problems.push(`${file}：裡面找不到文案表（表頭是「| id | zh | en | ja | 來源 | 確認 |」的表）`);
        return { ids: null, problems };
    }
    return { ids, problems };
}
