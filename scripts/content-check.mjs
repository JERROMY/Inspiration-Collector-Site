// 檢查使用者寫的內容（content/ 底下的更新紀錄、公告、社群連結）。
//
// 跑法（在 homepage/site/）：
//   npm run content:check                                 檢查這個網站的 content/
//   node scripts/content-check.mjs --dir <content 資料夾>    檢查別的資料夾
//   node scripts/content-check.mjs --strings <字串表資料夾>   社群連結的名稱到這個資料夾的 zh.json、en.json、ja.json 找（沒給就用網站的 strings/）
//
// 印出來的：
//   先一支檔一行的摘要（幾個版本、幾則公告、幾個連結），再印警告（不算錯），最後印要修的地方，一條一行：
//   「檔名：第 N 行：原因（原文）」；三種語言對不上的沒有行號，印「檔名：原因」（檔名是 changelog／news）；
//   整支讀不到的原因本來就講到檔名，只印原因。
//   警告裡有一種是社群代號缺名稱：links.md 的代號在字串表沒有 social.<代號>（缺哪幾個語言一起講）。只是警告，不算錯；
//   字串表資料夾不在、某一語的檔不在或不是 JSON 也只是一條警告（那一部分沒檢查）。
//
// 結束碼：0 ＝ 沒有要修的（有警告也是 0）；1 ＝ 有要修的；2 ＝ 用法錯誤（不認得的參數、多出來的字、--dir 或 --strings 沒給值或是空的、
//   --dir 不存在或是一個檔），用法錯誤印在 stderr，第一行是中文。--strings 指到不存在的資料夾不是用法錯誤：只警告、結束碼不變（不擋部署）。
// 檢查全在 lib/content-check.js，這裡只讀參數、呼叫它、印結果。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkContent } from '../lib/content-check.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 這支檔在 homepage/site/scripts/，往上一層的 content/ 就是網站的內容
const DEFAULT_DIR = path.resolve(HERE, '..', 'content');
const DEFAULT_STRINGS = path.resolve(HERE, '..', 'strings');
const USAGE = '用法：node scripts/content-check.mjs [--dir <content 資料夾>] [--strings <字串表資料夾>]';
const UNITS = { changelog: '個版本', news: '則公告', links: '個連結' };
// Node 的 parseArgs 丟的錯是英文，照 code 換成中文；name 是訊息裡引號中的第一個字（參數名或多出來的那一個字）
const PARSE_ERRORS = {
    ERR_PARSE_ARGS_UNKNOWN_OPTION: (name) => `不認得的參數 ${name}`,
    ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL: (name) => `多出一個參數「${name}」，要指定資料夾請寫 --dir <資料夾>`,
    ERR_PARSE_ARGS_INVALID_OPTION_VALUE: (name) => `${name} 後面缺值，要給一個資料夾`,
};

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ dir: string, strings: string }} 要檢查的資料夾、字串表資料夾（都是絕對路徑）
 * @throws {Error} 用法錯誤（中文訊息）
 */
function readOptions(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, options: { dir: { type: 'string' }, strings: { type: 'string' } } }));
    } catch (err) {
        const explain = PARSE_ERRORS[err.code];
        const name = /'([^'\s]+)/.exec(err.message)?.[1] ?? '';
        throw new Error(explain ? explain(name) : '參數看不懂', { cause: err });
    }
    for (const name of ['dir', 'strings']) {
        if (values[name] !== undefined && values[name].trim() === '') throw new Error(`--${name} 不能是空的，要給一個資料夾`);
    }
    return { dir: path.resolve(values.dir ?? DEFAULT_DIR), strings: path.resolve(values.strings ?? DEFAULT_STRINGS) };
}

/**
 * 印用法錯誤（stderr，第一行中文）。
 *
 * @param {string} message 哪裡錯
 * @returns {number} 結束碼 2
 */
function usageError(message) {
    console.error(`content-check.mjs 用法錯誤：${message}\n${USAGE}`);
    return 2;
}

/**
 * 印摘要、警告與要修的地方。
 *
 * @param {string} dir 檢查的資料夾
 * @param {Awaited<ReturnType<typeof checkContent>>} result checkContent 的結果
 * @returns {number} 結束碼：沒有要修的 0、有要修的 1
 */
function report(dir, result) {
    console.log(`檢查 ${dir}`);
    for (const { file, kind, count, bad } of result.summary) {
        const read = count === null ? '讀不到' : `${count} ${UNITS[kind]}`;
        console.log(`  ${file}：${read}${count !== null && bad > 0 ? `，另有 ${bad} 條讀不到` : ''}`);
    }
    if (result.warnings.length > 0) {
        console.log(`\n警告（${result.warnings.length} 條，不算錯）：`);
        for (const { file, message } of result.warnings) console.log(`  ${file}：${message}`);
    }
    if (result.ok) {
        console.log('\n沒有要修的地方。');
        return 0;
    }
    console.error(`\n要修的地方（${result.problems.length} 條）：`);
    for (const { file, line, raw, reason } of result.problems) {
        // 沒有行號、原因已經講到檔名的（整支讀不到）只印原因，不把檔名說兩遍
        const where = line === null ? (reason.includes(file) ? '' : `${file}：`) : `${file}：第 ${line} 行：`;
        console.error(line === null ? `  ${where}${reason}` : `  ${where}${reason}（${raw.trim()}）`);
    }
    return 1;
}

/**
 * @returns {Promise<number>} 結束碼
 */
async function main() {
    let dir;
    let strings;
    try {
        ({ dir, strings } = readOptions(process.argv.slice(2)));
    } catch (err) {
        return usageError(err.message);
    }
    let result;
    try {
        result = await checkContent(dir, { strings });
    } catch (err) {
        if (err.code === 'CONTENT_DIR') return usageError(err.message);
        console.error(`content-check.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
    return report(dir, result);
}

// 用 exitCode 不用 process.exit：輸出接到管線時（mac 等平台上管線是非同步寫），process.exit 可能把還沒寫完的字切掉
process.exitCode = await main();
