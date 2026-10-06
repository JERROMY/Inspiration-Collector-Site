// 拉丁字型瘦身的命令：把設計系統的 Google Sans Flex 與 JetBrains Mono 瘦成網站用的兩個小檔，放進 public/fonts/，再寫 fonts.css。
// 中日文不放網頁字型，走系統字型（原因見 public/fonts/LICENSES.md 的 Glow Sans TC 一節與 README 的「字型」一節）。
//
// 跑法（在 homepage/site/）：
//   npm run fonts -- --from <來源資料夾> --text <文字檔> [--text <文字檔>…] [--out <資料夾>]
//   --from   來源資料夾，裡面要有 GoogleSansFlex-lite-latin.woff2 與 JetBrainsMono-latin.woff2（擴充的 fonts/ 或設計系統的 web/fonts/）。沒有預設：來源都在網站 repo 外面。
//   --text   要收字的文字檔，可以給好幾個、每個都整份收（三種語言的頁面都會用到拉丁字型，所以 copy.md 不是只取某一欄）。沒有預設。
//   --out    輸出資料夾，預設是這支檔旁邊的 ../public/fonts（從哪裡叫都一樣）；不存在會自己建。
//   例：npm run fonts -- --from <GPTPlugins>/clipper/fonts --text <GPTPlugins>/design/homepage/copy.md --text content/news.zh.md --text content/news.en.md …
//   一個 --text 只收一個檔，所以 content/ 底下的每個 .md 檔各給一個 --text（用 shell 的萬用字元展開會多出字、被當成用法錯誤；bash 或 zsh 用 for 迴圈收，寫法在 README 的「字型」一節）。
//
// 收哪些字：每個 --text 整份取字、去掉中日文（lib/font-text.js 的 charsOf、isCjk；`npm run fonts:budget` 用同一份規則）、再加上 U+0020～007E 全部。
// 之後在 content/ 寫了字型裡沒有的新符號，那個字會用系統字型顯示（不壞）；`npm run fonts:budget` 會提醒，補了文字就重跑這個命令、把 public/fonts/ 一起提交。
//
// 做什麼（用 python 的 fontTools，一次性安裝，見 README；上線部署（Cloudflare Pages）不需要它，因為產出的字型進 git）：
//   Google Sans Flex  python -m fontTools.varLib.instancer 把 wdth=100、slnt=0 固定、opsz 留 8～64、wght 留 300～700，
//                     再 python -m fontTools.subset 只留收到的字、輸出 WOFF2 → GoogleSansFlex-site.woff2（還是 wght 300～700 的可變字型）。
//                     wdth 100 是設計系統本來就設的值（--gsf-wdth），slnt 預設就是 0；opsz 不固定：設計稿的 font: 簡寫會把 font-variation-settings 重設掉，瀏覽器照字級自動選 opsz，固定成 18 會讓大標變寬（原因與量測在 README 的「字型」一節、lib/fonts.js）。
//   JetBrains Mono    只切子集（不動可變軸，字重留 100～800）→ JetBrainsMono-site.woff2。
//   fonts.css         剛好兩個 @font-face（font-display: swap；unicode-range 是各自檔案的 cmap，所以中文頁不會去下載、也不碰任何中日文碼位）。
//   --layout-features 只留 kern、liga、ccmp、locl、mark、mkmk、calt、case、tnum、lnum（頁面用到字距、連字、等寬數字）；名稱欄位保留 0～6 與 13、14（版權與授權說明，OFL 要求每份附著）。
//
// python：環境變數 PYTHON（空字串當作沒設），沒設就用 PATH 裡的 python3；它要能 import fontTools 與 brotli。
//   macOS／Linux： PYTHON=<有 fonttools 與 brotli 的 python> npm run fonts -- …
//   Windows cmd：  set "PYTHON=C:\path\to\python.exe" && npm run fonts -- …      （要指到 .exe，指到 .cmd 或 .bat 在不開 shell 時會是 EINVAL）
//
// 輸出：先查輸入（來源字型、文字檔）、再查工具；全部做好、驗證過才放進 --out，所以失敗時 --out 一個位元組都不動、系統暫存資料夾也清掉。
// --out 裡只動這次產的兩個字型與 fonts.css；原本的 fonts.css 引用過、這次不用的舊 .woff2 才拿掉。LICENSES.md、licenses/、不是我們產的 .woff2 一律不動（--out 給錯資料夾也不會刪到別人的字型）。
// 同樣的輸入重跑，輸出位元組相同（沒有路徑、沒有時間；instancer 預設會把字型的修改時間改成「現在」，所以叫它時加了 --no-recalc-timestamp）。換一個版本的 fontTools，輸出的位元組可能不同（內容一樣）。
//
// 結束碼：0 ＝ 成功；1 ＝ 做不完（來源或文字檔不在、不是檔案、是空的，python 跑不起來或缺套件，fontTools 失敗，驗證沒過）；2 ＝ 用法錯誤（不認得的參數、缺值、路徑是空的、--from 不是資料夾、沒給 --from 或 --text）。
// 流程在 lib/fonts-run.js，這裡只讀參數、讀文字檔、收字、叫它、印結果。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { charsOf, isCjk } from '../lib/font-text.js';
import { latinCodePoints } from '../lib/fonts.js';
import { runFonts } from '../lib/fonts-run.js';
import { readTextFile } from '../lib/text-files.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'public', 'fonts');
const USAGE = '用法：node scripts/fonts.mjs --from <來源資料夾> --text <文字檔> [--text <文字檔>…] [--out <資料夾>]';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ from: string, texts: string[], out: string }} 路徑都換成絕對路徑
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --from 或 --text、--from 不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { from: {}, text: { multiple: true }, out: {} });
    if (values.from === undefined) throw new Error('沒給 --from（來源字型的資料夾）');
    if (values.text === undefined) throw new Error('沒給 --text（要收字的文字檔，至少一個）');
    if (!fs.statSync(values.from, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--from ${values.from} 不存在，或不是資料夾`);
    return { from: path.resolve(values.from), texts: values.text.map((file) => path.resolve(file)), out: path.resolve(values.out ?? DEFAULT_OUT) };
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`fonts.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        const texts = options.texts.map(readTextFile);
        // 整份收（三種語言都用拉丁字型），去掉中日文（走系統字型），再加上 ASCII 全部
        const chars = charsOf(texts.join('\n')).filter((ch) => !isCjk(ch));
        const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
        const { files, totalBytes } = await runFonts({
            from: options.from, out: options.out, codePoints: latinCodePoints(chars), python: process.env.PYTHON || 'python3', run,
        });
        for (const { file, bytes, chars: count } of files) console.log(`寫好了：${file}（${bytes} 位元組，${count} 個字）`);
        console.log(`寫好了：${path.join(options.out, 'fonts.css')}`);
        console.log(`合計：${totalBytes} 位元組（兩個字型；用 npm run fonts:budget 量預算與缺字）`);
    } catch (err) {
        console.error(`fonts.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
