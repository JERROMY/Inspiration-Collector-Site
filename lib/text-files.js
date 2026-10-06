/**
 * text-files.js —— 讀「要收字的文字檔」：不存在、是資料夾、讀不了、是空的，都用一句中文講出是哪個檔。
 *
 * 字型的兩支命令（fonts、fonts:budget）共用；「空的」是指一個字都沒有（只有空白也算空的）。
 */
import fs from 'node:fs';
import { charsOf } from './font-text.js';

/**
 * @param {string} file 文字檔的路徑
 * @returns {string} 檔案內容（UTF-8）
 * @throws {Error} 不存在、是資料夾、讀不了、是空的或只有空白；訊息講出是哪個檔
 */
export function readTextFile(file) {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) throw new Error(`找不到文字檔 ${file}`);
    if (!stat.isFile()) throw new Error(`文字檔 ${file} 是資料夾，不是檔案`);
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (err) {
        throw new Error(`讀不了文字檔 ${file}（${err.code ?? err.message}）`, { cause: err });
    }
    if (charsOf(text).length === 0) throw new Error(`文字檔 ${file} 是空的（或只有空白）`);
    return text;
}
