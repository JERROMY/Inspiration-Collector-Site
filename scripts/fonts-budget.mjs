// 字型預算的命令：量 public/fonts/ 的網頁字型有沒有超過預算、有沒有放中日文字型、文字裡有哪些字字型裡沒有。只讀不寫，不叫 python。
//
// 跑法（在 homepage/site/）：
//   npm run fonts:budget -- --text <文字檔> [--text <文字檔>…] [--fonts <字型資料夾>]
//   --text   要檢查的文字檔，可以給好幾個、每個都整份收（跟 npm run fonts 收字的規則一樣，用同一份 lib/font-text.js）。沒有預設。
//   --fonts  字型資料夾，預設是這支檔旁邊的 ../public/fonts（從哪裡叫都一樣）。
//   例：npm run fonts:budget -- --text <GPTPlugins>/design/homepage/copy.md --text content/news.zh.md --text content/news.en.md …
//   一個 --text 只收一個檔，所以 content/ 底下的每個 .md 檔各給一個 --text（用 shell 的萬用字元展開會多出字、被當成用法錯誤；bash 或 zsh 用 for 迴圈收，寫法在 README 的「字型」一節）。
//
// 三項檢查：
//   ① 預算：資料夾裡所有 .woff2 合計不超過 153600 位元組（150 KB，1 KB＝1024 位元組；剛好等於算過）。
//   ② 沒有中日文字型（中日文字元不會觸發網頁字型下載，走系統字型）：每個 .woff2 的 cmap（lib/woff2-cmap.js，在 Node 裡讀、不叫 python）都沒有中日文字；
//      fonts.css 每個 @font-face 都有 unicode-range、而且不碰中日文碼位（沒寫 unicode-range 等於全部的字，中文頁也會去下載）。
//   ③ 缺字：文字檔裡的非中日文字（整份、空白不算），不在「所有 .woff2 的 cmap 聯集」裡的。
//      字母與數字（Unicode 的 L、N 類）缺了 → 列出字與碼位、算沒過；符號與標點等缺了（例如 ☰ ✕ ↺ ▶ ─ ├）→ 只印警告，瀏覽器會用系統字型顯示；中日文走系統字型，不算缺字。
//
// 輸出：stdout 每個 .woff2 一行（檔名與位元組）、一行「合計：<N> 位元組」；問題與警告印在 stderr。
// 結束碼：0 ＝ 三項都過（有警告也是 0）；1 ＝ 沒過（超過預算、有中日文字型、有缺的字母或數字、fonts.css 或 GoogleSansFlex-site.woff2 不在或讀不了、文字檔不在／是資料夾／是空的）；
//   2 ＝ 用法錯誤（不認得的參數、缺值、路徑是空的、沒給 --text、--fonts 不存在或不是資料夾）。
// 檢查全在 lib/fonts-budget.js，這裡只讀參數、讀檔、收字、讀 cmap、叫它、印結果。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { charsOf, isCjk } from '../lib/font-text.js';
import { checkFonts } from '../lib/fonts-budget.js';
import { FONT_BUDGET_BYTES } from '../lib/fonts.js';
import { readTextFile } from '../lib/text-files.js';
import { woff2CodePoints } from '../lib/woff2-cmap.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FONTS = path.resolve(HERE, '..', 'public', 'fonts');
const USAGE = '用法：node scripts/fonts-budget.mjs --text <文字檔> [--text <文字檔>…] [--fonts <字型資料夾>]';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ texts: string[], fonts: string }} 路徑都換成絕對路徑
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --text、--fonts 不存在或不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { text: { multiple: true }, fonts: {} });
    if (values.text === undefined) throw new Error('沒給 --text（要檢查的文字檔，至少一個）');
    // 自己給的 --fonts 不是資料夾是用法錯誤；預設的 public/fonts 還不存在，是「字型還沒做」，照缺檔量（缺 GoogleSansFlex-site.woff2、缺 fonts.css）
    if (values.fonts !== undefined && !fs.statSync(values.fonts, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--fonts ${values.fonts} 不存在，或不是資料夾`);
    return { texts: values.text.map((file) => path.resolve(file)), fonts: path.resolve(values.fonts ?? DEFAULT_FONTS) };
}

/**
 * @param {string} file .woff2 的路徑
 * @returns {{ name: string, bytes: number, codePoints: number[] | null, error?: string }} 讀不了的字型 codePoints 是 null、error 說原因
 */
function readFont(file) {
    const buffer = fs.readFileSync(file);
    const name = path.basename(file);
    try {
        return { name, bytes: buffer.length, codePoints: woff2CodePoints(buffer) };
    } catch (err) {
        return { name, bytes: buffer.length, codePoints: null, error: err.message };
    }
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`fonts-budget.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        const texts = options.texts.map(readTextFile);
        const chars = charsOf(texts.join('\n')).filter((ch) => !isCjk(ch));
        const names = fs.statSync(options.fonts, { throwIfNoEntry: false })?.isDirectory() ? fs.readdirSync(options.fonts) : [];
        const fonts = names.filter((name) => name.endsWith('.woff2')).sort().map((name) => readFont(path.join(options.fonts, name)));
        const cssFile = path.join(options.fonts, 'fonts.css');
        const css = fs.statSync(cssFile, { throwIfNoEntry: false })?.isFile() ? fs.readFileSync(cssFile, 'utf8') : null;

        const { total, problems, warnings } = checkFonts({ fonts, css, chars, limit: FONT_BUDGET_BYTES });
        for (const font of fonts) console.log(`${font.name}：${font.bytes} 位元組`);
        console.log(`合計：${total} 位元組（上限 ${FONT_BUDGET_BYTES} 位元組＝150 KB，用掉 ${Math.round((total / FONT_BUDGET_BYTES) * 100)}%）`);
        for (const warning of warnings) console.error(`警告：${warning}`);
        for (const problem of problems) console.error(`沒過：${problem}`);
        if (problems.length > 0) process.exitCode = 1;
        else console.log('通過：預算、中日文、缺字三項都沒問題');
    } catch (err) {
        console.error(`fonts-budget.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
