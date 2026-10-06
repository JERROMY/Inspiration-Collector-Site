/**
 * cli-args.js —— 命令列參數的讀法：包住 Node 的 parseArgs，錯誤都換成中文（Node 丟的是英文，使用者看不懂）。
 *
 * 字型、圖片的三支命令（fonts、fonts:budget、images）共用。值都是字串；給了空字串（`--out=`）也是用法錯誤，
 * 不靜靜退回預設值 —— 路徑給成空的，退回預設會寫到不該寫的地方。
 */
import { parseArgs } from 'node:util';

// Node 的 parseArgs 丟的錯是英文，照 code 換成中文；name 是訊息裡引號中的第一個字（參數名或多出來的那一個字）
const PARSE_ERRORS = {
    ERR_PARSE_ARGS_UNKNOWN_OPTION: (name) => `不認得的參數 ${name}`,
    ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL: (name) => `多出一個參數「${name}」，每個參數都要用 -- 開頭`,
    ERR_PARSE_ARGS_INVALID_OPTION_VALUE: (name) => `${name} 後面缺值，要給一個值（路徑）`,
};

/**
 * @param {string[]} argv 命令列參數（不含 node 與腳本路徑）
 * @param {Record<string, { multiple?: boolean }>} options 認得的參數：名字（不含 --）→ 要不要可以給好幾次
 * @returns {Record<string, string | string[] | undefined>} 每個參數給的值（沒給是 undefined；可以給好幾次的是陣列）
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、多出來的字、缺值、值是空字串
 */
export function parseCli(argv, options) {
    let values;
    try {
        const config = Object.fromEntries(Object.entries(options).map(([key, { multiple = false }]) => [key, { type: 'string', multiple }]));
        ({ values } = parseArgs({ args: argv, options: config }));
    } catch (err) {
        const explain = PARSE_ERRORS[err.code];
        const name = /'([^'\s]+)/.exec(err.message)?.[1] ?? '';
        throw new Error(explain ? explain(name) : '參數看不懂', { cause: err });
    }
    for (const [key, value] of Object.entries(values)) {
        if ([value].flat().some((item) => item.trim() === '')) throw new Error(`--${key} 不能是空的，要給一個值（路徑）`);
    }
    return values;
}
