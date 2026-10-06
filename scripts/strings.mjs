// 字串表的命令：檢查設計師的首頁字串表（zh.json、en.json、ja.json），沒問題就連同字串表說明（README.md）原樣放進 strings/。
//
// 跑法（在 homepage/site/）：
//   npm run strings -- --from <字串表資料夾> [--copy <copy.md>] [--out <資料夾>]
//   --from   設計師的字串表資料夾，裡面要有 zh.json、en.json、ja.json 與 README.md。沒有預設：它在網站 repo 外面。
//   --copy   設計師的文案表 copy.md，可以不給。給了就多查一件事：文案表裡的每個 id 都在三種語言的字串表裡。
//   --out    輸出資料夾，預設是這支檔旁邊的 ../strings（也就是 homepage/site/strings/，從哪裡叫都一樣）；不存在會自己建。
//   例：npm run strings -- --from <GPTPlugins>/design/homepage/strings --copy <GPTPlugins>/design/homepage/copy.md
//
// 做什麼：
//   1. 讀 --from 的四個檔：三個 JSON 要是「id → 字串」的物件；README.md 要在（它是這份字串表的說明，跟著放進 strings/，網站的 repo 裡就有一份跟資料同版的說明）。
//   2. 檢查（lib/strings-check.js）：值都是字串；每一條的標記都轉得過（lib/segments.js 的 parseSegments，前端用同一支轉成畫面）；三種語言的 id 完全相同；有給 --copy 的話，文案表的每個 id 都在。
//      文案表 = copy.md 裡表頭剛好是「| id | zh | en | ja | 來源 | 確認 |」的表，每一列的第一格是 id（版本表、字數表不算）。只查「文案表有、字串表沒有」。
//   3. 全部沒問題才放進 --out：四個檔原樣複製（位元組相同，不重新排版）。--out 裡別的檔不動；失敗時 --out 一個位元組都不動。重跑結果相同。
//   不比對字的內容：拿掉標記之後跟 copy.md 一字不差，是設計師的產稿程式每次產生時核對的。
//
// 輸出：沒問題時 stdout 印每個寫好的檔；有問題時 stderr 第一行說有幾個問題，之後每個問題一行，同一行寫到檔名與 id（標記寫錯還有「第 N 字」）。
// 結束碼：0 ＝ 成功；1 ＝ 輸入或驗證不過（缺檔、不是 JSON、值不是字串、標記寫錯、id 對不上、文案表缺 id）或放不進 --out；2 ＝ 用法錯誤（沒給 --from、不認得的參數、缺值、路徑是空的、--from 不是資料夾）。
// 讀檔在 lib/strings-input.js、檢查在 lib/strings-check.js，這裡只讀參數、叫它們、放進 --out、印結果。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { publish } from '../lib/publish.js';
import { parseSegments } from '../lib/segments.js';
import { checkStrings } from '../lib/strings-check.js';
import { FILE_NAMES, LANGS, readCopyIds, readStrings } from '../lib/strings-input.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'strings');
const USAGE = '用法：node scripts/strings.mjs --from <字串表資料夾> [--copy <copy.md>] [--out <資料夾>]';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ from: string, copy: string | null, out: string }} 路徑都換成絕對路徑；沒給 --copy 是 null
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --from、--from 不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { from: {}, copy: {}, out: {} });
    if (values.from === undefined) throw new Error('沒給 --from（設計師的字串表資料夾）');
    if (!fs.statSync(values.from, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--from ${values.from} 不存在，或不是資料夾`);
    return {
        from: path.resolve(values.from),
        copy: values.copy === undefined ? null : path.resolve(values.copy),
        out: path.resolve(values.out ?? DEFAULT_OUT),
    };
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`strings.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        const input = readStrings(options.from);
        const copy = options.copy === null ? { ids: null, problems: [] } : readCopyIds(options.copy);
        const problems = [...input.problems, ...copy.problems, ...checkStrings({ tables: input.tables, copyIds: copy.ids, parse: parseSegments })];
        if (problems.length > 0) {
            console.error(`strings.mjs 失敗：字串表有 ${problems.length} 個問題要修（${options.out} 沒有動）：`);
            for (const problem of problems) console.error(`  ${problem}`);
            process.exitCode = 1;
        } else {
            // 寫進系統暫存資料夾、再一次放進 --out：放的是驗證過的那份位元組，也不會留半成品
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-strings-'));
            try {
                for (const name of FILE_NAMES) fs.writeFileSync(path.join(tmpDir, name), input.files[name]);
                publish(tmpDir, options.out, FILE_NAMES);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            for (const name of FILE_NAMES) console.log(`寫好了：${path.join(options.out, name)}（${input.files[name].length} 位元組）`);
            console.log(`字串表：${LANGS.join('、')} 各 ${Object.keys(input.tables.zh).length} 條，標記都轉得過、三語 id 相同${copy.ids === null ? '' : `、copy.md 的 ${copy.ids.length} 個 id 都在`}`);
        }
    } catch (err) {
        console.error(`strings.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
