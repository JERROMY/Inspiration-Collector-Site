// 回退字型的產生器：網頁字型（Google Sans Flex）還沒下載好時先用 Arial 畫，這支命令量每個字的寬度比，寫出 app/styles/fallback-fonts.css，讓字型換上來時版面不跳。
//
// 跑法（在 homepage/site/）：
//   npm run fallback-fonts -- [--fonts <字型資料夾>] [--config <設定檔>] [--out <輸出檔>] [--playwright <Playwright 套件的資料夾>]
//   --fonts       網頁字型的資料夾，裡面要有 GoogleSansFlex-site.woff2 與 fonts.css。預設是這支檔旁邊的 ../public/fonts。
//   --config      設定檔，預設是這支檔旁邊的 fallback-fonts.config.json：{ roles, factors }。roles 是字級×字重（每筆 { suffix, size, opsz, weights }，opsz 是數字或 "auto"），
//                 factors 是整組乘上係數的微調組（每筆 { family, from, weight, k, spaceK? }）。
//   --out         輸出檔，預設是這支檔旁邊的 ../app/styles/fallback-fonts.css；它的資料夾要已經存在（不幫忙建；還沒有 app/ 的時候請用 --out 指定）。
//   --playwright  Playwright 套件的資料夾；沒給就看環境變數 SITE_PLAYWRIGHT。量字寬要開瀏覽器，Playwright 不裝進這個網站（不進 package.json），要用的人自己指路徑。
//
// 做什麼：
//   1. 先查輸入：設定檔、字型檔、fonts.css（要收哪些字：它裡面 "Google Sans Flex" 那個 @font-face 的 unicode-range）、輸出檔的資料夾。
//   2. 再找 Playwright 與瀏覽器（用 createRequire 從 --playwright 或 SITE_PLAYWRIGHT 的路徑載入）。
//   3. 在 Chromium 量每個字在網頁字型與 Arial 的寬度比（lib/fallback-measure.js），照字級×字重分組、寫 @font-face、再接微調組（lib/fallback-fonts.js）。
//   4. 靜態檢查（lib/fallback-check.js）：除了空白，每個 size-adjust 都要在 85%～120%（微調組在它的容許範圍）。
//   5. 全部成功才換上輸出檔（先寫暫存檔）；失敗時輸出檔一個位元組都不動。
//   量的是這台機器的 Arial：同一台機器重跑位元組相同，不同機器（Arial 版本、作業系統）不保證相同。
//   什麼時候要重跑：字型換了、字級或字重新增、頁面文案大改（fonts.css 的字變了）、換機器；重跑後把輸出檔一起提交。
//
// 輸出：stdout 印寫好的檔與 @font-face 個數；問題印在 stderr（第一行是中文）。
// 結束碼：0 ＝ 成功；1 ＝ 做不完（設定檔不在或不對、字型資料夾缺檔、輸出檔的資料夾不在、找不到 Playwright、瀏覽器開不起來、檢查沒過）；
//   2 ＝ 用法錯誤（不認得的參數、缺值、路徑是空的、--fonts 不是資料夾）。
// 量字寬在 lib/fallback-measure.js，分組與寫 CSS 在 lib/fallback-fonts.js，這裡只讀參數、讀檔、叫它們、寫檔、印結果。
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { checkFallbackCss } from '../lib/fallback-check.js';
import { BASE_FAMILY, charsFromFontsCss, renderFallbackCss } from '../lib/fallback-fonts.js';
import { measureRatios } from '../lib/fallback-measure.js';
import { launchChromium, loadPlaywright, playwrightDir } from '../lib/playwright-loader.js';
import { publish } from '../lib/publish.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const DEFAULT_OUT = path.join(SITE, 'app', 'styles', 'fallback-fonts.css');
const USAGE = '用法：node scripts/fallback-fonts.mjs [--fonts <字型資料夾>] [--config <設定檔>] [--out <輸出檔>] [--playwright <Playwright 套件的資料夾>]';
const WOFF2 = 'GoogleSansFlex-site.woff2';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ fonts: string, config: string, out: string, outGiven: boolean, playwright: string | undefined }} 路徑都換成絕對路徑
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、--fonts 不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { fonts: {}, config: {}, out: {}, playwright: {} });
    if (values.fonts !== undefined && !fs.statSync(values.fonts, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--fonts ${values.fonts} 不存在，或不是資料夾`);
    return {
        fonts: path.resolve(values.fonts ?? path.join(SITE, 'public', 'fonts')),
        config: path.resolve(values.config ?? path.join(HERE, 'fallback-fonts.config.json')),
        out: path.resolve(values.out ?? DEFAULT_OUT),
        outGiven: values.out !== undefined,
        playwright: values.playwright,
    };
}

/**
 * @param {string} file 檔案路徑
 * @returns {string} 檔案內容（UTF-8）
 * @throws {Error} 不存在、是資料夾、讀不了（中文，講出是哪個檔）
 */
function readInput(file) {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) throw new Error(`找不到 ${file}`);
    if (!stat.isFile()) throw new Error(`${file} 是資料夾，不是檔案`);
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        throw new Error(`讀不了 ${file}（${err.code ?? err.message}）`, { cause: err });
    }
}

/**
 * @param {string} file 設定檔路徑
 * @returns {{ roles: object[], factors: object[] }} 設定檔的內容
 * @throws {Error} 不存在、不是 JSON、roles 是空的或某一筆寫得不對、factors 不是陣列（中文，講出是哪個檔與哪裡）
 */
function readConfig(file) {
    const text = readInput(file);
    let config;
    try {
        config = JSON.parse(text);
    } catch (err) {
        throw new Error(`設定檔 ${file} 不是 JSON（${err.message.replace(/\s+/g, ' ')}）`, { cause: err });
    }
    const { roles, factors } = config ?? {};
    if (!Array.isArray(roles) || roles.length === 0) throw new Error(`設定檔 ${file} 的 roles 要是有東西的陣列（字級×字重）`);
    roles.forEach((role, i) => {
        const fine = typeof role?.suffix === 'string' && Number(role.size) > 0 && (role.opsz === 'auto' || Number.isFinite(role.opsz))
            && Array.isArray(role.weights) && role.weights.length > 0 && role.weights.every((w) => [400, 500, 600].includes(w));
        if (!fine) throw new Error(`設定檔 ${file} 的 roles 第 ${i + 1} 筆要是 { suffix, size, opsz（數字或 "auto"）, weights（400、500、600 的陣列） }`);
    });
    if (!Array.isArray(factors)) throw new Error(`設定檔 ${file} 的 factors 要是陣列（可以是空的）`);
    factors.forEach((factor, i) => {
        const fine = typeof factor?.family === 'string' && typeof factor.from === 'string' && typeof factor.weight === 'string' && factor.k > 0 && (factor.spaceK === undefined || factor.spaceK > 0);
        if (!fine) throw new Error(`設定檔 ${file} 的 factors 第 ${i + 1} 筆要是 { family, from, weight, k, spaceK（可省） }`);
    });
    return { roles, factors };
}

/**
 * 先查輸入（Playwright 之前）：設定檔、字型檔、fonts.css、輸出檔的資料夾。
 *
 * @param {{ fonts: string, config: string, out: string, outGiven: boolean }} options 讀好的參數
 * @returns {{ config: { roles: object[], factors: object[] }, codes: number[], woff2: string }} 設定、要量的碼位、字型檔
 * @throws {Error} 任何一樣不對（中文，講出是哪個檔）
 */
function checkInputs(options) {
    const config = readConfig(options.config);
    const woff2 = path.join(options.fonts, WOFF2);
    if (!fs.statSync(woff2, { throwIfNoEntry: false })?.isFile()) throw new Error(`字型資料夾 ${options.fonts} 裡找不到 ${WOFF2}`);
    let codes;
    try {
        codes = charsFromFontsCss(readInput(path.join(options.fonts, 'fonts.css')));
    } catch (err) {
        throw new Error(`字型資料夾 ${options.fonts} 的 fonts.css 不能用：${err.message}`, { cause: err });
    }
    const outDir = path.dirname(options.out);
    if (!fs.statSync(outDir, { throwIfNoEntry: false })?.isDirectory()) {
        throw new Error(options.outGiven
            ? `輸出檔 ${options.out} 的資料夾不存在（不幫忙建）`
            : `預設的輸出位置 app/styles/ 不存在（${outDir}）：這個網站還沒有 app/ 的話，請用 --out 指定輸出檔`);
    }
    if (fs.statSync(options.out, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`輸出檔 ${options.out} 是資料夾，不是檔案`);
    return { config, codes, woff2 };
}

/**
 * 把 CSS 先寫進系統暫存資料夾，再一次換上輸出檔（失敗時輸出檔不動）。
 *
 * @param {string} out 輸出檔
 * @param {string} css 內容
 * @throws {Error} 暫存資料夾寫不進去、或換不上輸出檔（中文白話）
 */
function writeOut(out, css) {
    let tmpDir;
    try {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-fallback-'));
        fs.writeFileSync(path.join(tmpDir, path.basename(out)), css);
    } catch (err) {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        throw new Error(`系統暫存資料夾（${os.tmpdir()}）寫不進去（${err.code ?? err.message}）：輸出檔 ${out} 沒有動`, { cause: err });
    }
    try {
        publish(tmpDir, path.dirname(out), [path.basename(out)]);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`fallback-fonts.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        const { config, codes, woff2 } = checkInputs(options);
        const playwright = loadPlaywright(playwrightDir(options.playwright, process.env), createRequire(import.meta.url));
        const browser = await launchChromium(playwright);
        let measurements;
        try {
            measurements = await measureRatios({ browser, woff2, roles: config.roles, codes, baseFamily: BASE_FAMILY });
        } finally {
            await browser.close();
        }
        const css = renderFallbackCss({ roles: config.roles, factors: config.factors, measurements });
        const problems = checkFallbackCss(css, config);
        if (problems.length > 0) {
            console.error(`fallback-fonts.mjs 失敗：靜態檢查有 ${problems.length} 個問題（${options.out} 沒有動）：`);
            for (const problem of problems) console.error(`  ${problem}`);
            process.exitCode = 1;
        } else {
            writeOut(options.out, css);
            console.log(`寫好了：${options.out}（${css.split('\n').filter((row) => row.startsWith('@font-face')).length} 個 @font-face）`);
        }
    } catch (err) {
        console.error(`fallback-fonts.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
