/**
 * fonts-run.js —— 拉丁字型瘦身的流程：把設計系統的 Google Sans Flex、JetBrains Mono 瘦成網站用的兩個檔，驗證沒問題才放進輸出資料夾。
 *
 * 做事的順序（要收哪些碼位、組 fontTools 的參數、寫 fonts.css 都是 fonts.js 的事，這裡只管流程）：
 * 1. 先查來源字型都在，再查 python 跑得起來、能 import fontTools 與 brotli（先查輸入、再查工具）。
 * 2. 在系統暫存資料夾裡自己開的資料夾做：Google Sans Flex 先用 fontTools.varLib.instancer 固定用不到的軸（wdth、slnt；opsz 與 wght 留範圍）、
 *    再用 fontTools.subset 只留要的字、輸出 WOFF2；JetBrains Mono 只切子集。
 * 3. 驗證：輸出是 WOFF2、有 U+0020～007E 全部；從輸出字型的 cmap 讀出真正有哪些字，寫成 fonts.css 的 unicode-range（精確，不多不少）。
 * 4. 全部通過才放進輸出資料夾（兩個字型與 fonts.css；原本的 fonts.css 引用過、這次不用的舊 .woff2 拿掉，其他檔一律不動）。任何一步出錯，輸出資料夾一個位元組都不動，暫存資料夾清掉。
 *
 * python 由呼叫端傳進來的 run 執行（命令用 spawnSync），所以這裡不需要為了測試開任何後門。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FONTS, fontFilesOf, fontsCss, instancerArgs, latinCodePoints, subsetArgs, unicodeRangeOf } from './fonts.js';
import { publish } from './publish.js';
import { launched, reasonOf } from './tools.js';
import { woff2CodePoints } from './woff2-cmap.js';

const SUGGESTION = '裝法見 README 的「字型」一節（建一個 venv，pip install fonttools brotli）';

/**
 * @param {string} file 路徑
 * @returns {number} 檔案的位元組數；不存在、不是檔案回 -1
 */
function sizeOf(file) {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return stat?.isFile() ? stat.size : -1;
}

/**
 * @param {string} from 來源資料夾
 * @throws {Error} 來源字型不在、不是檔案或是空的；訊息講出是哪個檔
 */
function checkSources(from) {
    for (const { source } of Object.values(FONTS)) {
        const size = sizeOf(path.join(from, source));
        if (size < 0) throw new Error(`來源資料夾裡找不到 ${source}（${from}）`);
        if (size === 0) throw new Error(`來源字型 ${source} 是空的（${path.join(from, source)}）`);
    }
}

/**
 * @param {(command: string, args: string[]) => any} run 執行外部工具
 * @param {string} python python 的路徑或指令
 * @throws {Error} python 開不起來、或不能 import fontTools 與 brotli；訊息有試的路徑與原因
 */
async function checkPython(run, python) {
    const res = launched(await run(python, ['-c', 'import fontTools, brotli']), 'python', python);
    if (res.status !== 0) {
        throw new Error(`python 缺了 fontTools 或 brotli（試的是 ${python}）：${reasonOf(res)}\n${SUGGESTION}`);
    }
}

/**
 * 叫一次 fontTools；失敗就丟錯，講是哪個字型的哪一步、工具自己說了什麼。
 *
 * @param {(command: string, args: string[]) => any} run 執行外部工具
 * @param {string} python python 的路徑或指令
 * @param {string} label 這一步是什麼（寫進錯誤訊息）
 * @param {string[]} args 給 python 的參數
 * @throws {Error} 開不起來、或結束碼不是 0
 */
async function runPython(run, python, label, args) {
    const res = launched(await run(python, args), 'python', python);
    if (res.status !== 0) throw new Error(`${label}失敗（python 結束碼 ${res.status}）：${reasonOf(res)}`);
}

/**
 * 切一個字型，驗證輸出：有檔、不是空的、是 WOFF2、有 U+0020～007E 全部。
 *
 * @param {object} font FONTS 裡的一筆
 * @param {string} file 輸出檔的路徑
 * @returns {number[]} 輸出字型裡有哪些碼位（由 cmap 讀出）
 * @throws {Error} 沒寫出檔、是空的、不是 WOFF2、少了 ASCII 的字
 */
function verify(font, file) {
    const size = sizeOf(file);
    if (size < 0) throw new Error(`${font.output} 沒有寫出來（fontTools 結束碼是 0，卻沒有輸出檔）`);
    if (size === 0) throw new Error(`${font.output} 是 0 位元組（fontTools 結束碼是 0，輸出卻是空的）`);
    let codePoints;
    try {
        codePoints = woff2CodePoints(fs.readFileSync(file));
    } catch (err) {
        throw new Error(`${font.output} 讀不了：${err.message}（輸出要是 WOFF2）`, { cause: err });
    }
    const have = new Set(codePoints);
    const lack = latinCodePoints([]).filter((cp) => !have.has(cp));
    if (lack.length > 0) {
        throw new Error(`${font.output} 少了 ASCII 的字：${lack.map((cp) => String.fromCodePoint(cp)).join(' ')}（來源字型 ${font.source} 沒有這些字？）`);
    }
    return codePoints;
}

/**
 * 重跑時要拿掉哪些舊字型：只拿掉「out 裡原本的 fonts.css 引用過、這次不用」的 .woff2（那是我們以前產的）。
 * out 裡不是我們產的 .woff2（沒被 fonts.css 引用）一律不動 —— --out 給錯資料夾，不會刪到別人的字型。
 *
 * @param {string} out 輸出資料夾
 * @param {string[]} names 這次要放進去的檔名
 * @returns {string[]} 要拿掉的檔名
 */
function staleFonts(out, names) {
    const cssFile = path.join(out, 'fonts.css');
    if (sizeOf(cssFile) < 0) return [];
    return fontFilesOf(fs.readFileSync(cssFile, 'utf8')).filter((name) => name.endsWith('.woff2') && !names.includes(name));
}

/**
 * 把兩個來源字型瘦身成網站用的兩個檔、寫 fonts.css，放進 out。
 *
 * @param {object} options
 * @param {string} options.from 來源資料夾（要有 GoogleSansFlex-lite-latin.woff2 與 JetBrainsMono-latin.woff2）
 * @param {string} options.out 輸出資料夾（GoogleSansFlex-site.woff2、JetBrainsMono-site.woff2、fonts.css；不存在會建；
 *   原本的 fonts.css 引用過、這次不用的舊 .woff2 會拿掉；其他東西（LICENSES.md、授權檔、不是我們產的 .woff2）不動）
 * @param {number[]} options.codePoints 要收的碼位（latinCodePoints 的結果：U+0020～007E 全部加上文字裡的非中日文字）
 * @param {string} options.python python 的路徑或指令
 * @param {(command: string, args: string[]) => ({ status: number | null, stdout?: string, stderr?: string, error?: Error } | Promise<object>)} options.run
 *   執行外部工具，回傳 spawnSync 的形狀（也可以是 Promise）
 * @returns {Promise<{ files: { file: string, bytes: number, chars: number }[], totalBytes: number }>}
 *   放進 out 的字型（絕對路徑、位元組、字數）與兩個字型加起來的位元組數
 * @throws {Error} 來源字型不在、python 跑不起來或缺套件、fontTools 失敗、輸出驗證沒過、放進 out 失敗；
 *   訊息講出缺什麼、是哪個字型的哪一步；失敗時 out 一個位元組都不動
 */
export async function runFonts({ from, out, codePoints, python, run }) {
    checkSources(from);
    await checkPython(run, python);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-fonts-'));
    try {
        const { sans, mono } = FONTS;
        const fixed = path.join(tmpDir, 'sans-fixed.woff2');
        await runPython(run, python, `${sans.family} 固定可變軸（instancer）`, instancerArgs(path.join(from, sans.source), fixed));
        await runPython(run, python, `${sans.family} 切子集（subset）`, subsetArgs(fixed, path.join(tmpDir, sans.output), codePoints));
        await runPython(run, python, `${mono.family} 切子集（subset）`, subsetArgs(path.join(from, mono.source), path.join(tmpDir, mono.output), codePoints));

        const made = [sans, mono].map((font) => ({ font, codePoints: verify(font, path.join(tmpDir, font.output)) }));
        fs.writeFileSync(path.join(tmpDir, 'fonts.css'), fontsCss(made.map(({ font, codePoints: have }) => ({
            family: font.family, file: font.output, weight: font.weight, unicodeRange: unicodeRangeOf(have),
        }))));

        const names = [sans.output, mono.output, 'fonts.css'];
        const stale = staleFonts(out, names);
        publish(tmpDir, out, names, stale);
        const files = made.map(({ font, codePoints: have }) => ({ file: path.join(out, font.output), bytes: sizeOf(path.join(out, font.output)), chars: have.length }));
        return { files, totalBytes: files.reduce((sum, item) => sum + item.bytes, 0) };
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
