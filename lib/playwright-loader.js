/**
 * playwright-loader.js —— 取得 Playwright 與瀏覽器：Playwright 不裝進這個網站（不進 package.json），要用的人用 --playwright 或環境變數 SITE_PLAYWRIGHT
 * 指到 Playwright 套件的資料夾（例如別的專案 node_modules 裡的 playwright），再用呼叫端給的載入函式（createRequire 做的 require）從那個路徑載入。
 *
 * 量字寬、掃係數這兩支命令共用。每一個錯誤都是一句中文白話（講出缺什麼、怎麼補），不丟 Playwright 的英文原文。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * @param {string | undefined} flag --playwright 給的路徑
 * @param {Record<string, string | undefined>} env 環境變數（讀 SITE_PLAYWRIGHT）
 * @returns {string | null} 要用的 Playwright 資料夾（參數優先、其次環境變數；空字串當作沒給）；都沒有是 null
 */
export function playwrightDir(flag, env) {
    return flag || env.SITE_PLAYWRIGHT || null;
}

/**
 * @param {string | null} dir Playwright 套件的資料夾
 * @param {(request: string) => any} load 載入函式（呼叫端用 createRequire 做的 require）
 * @returns {{ chromium: any }} Playwright 模組
 * @throws {Error} 沒給路徑、路徑不是 Playwright（沒有 package.json）、載入失敗、載進來的沒有 chromium；訊息是中文，開頭都是「找不到 Playwright」
 */
export function loadPlaywright(dir, load) {
    if (!dir) {
        throw new Error('找不到 Playwright：沒給 --playwright，也沒設環境變數 SITE_PLAYWRIGHT。量字寬要開瀏覽器，請把它們指到 Playwright 套件的資料夾（Playwright 不裝進這個網站）');
    }
    const resolved = path.resolve(dir);
    if (!fs.existsSync(path.join(resolved, 'package.json'))) {
        throw new Error(`找不到 Playwright：${resolved} 不是 Playwright 套件的資料夾（裡面沒有 package.json）；請把 --playwright 或 SITE_PLAYWRIGHT 指到 Playwright 套件的資料夾`);
    }
    let mod;
    try {
        mod = load(resolved);
    } catch (err) {
        throw new Error(`找不到 Playwright：${resolved} 載入失敗（${String(err.message).split('\n')[0]}）`, { cause: err });
    }
    if (!mod || typeof mod.chromium?.launch !== 'function') throw new Error(`找不到 Playwright：${resolved} 載進來的不是 Playwright（沒有 chromium）`);
    return mod;
}

/**
 * @param {{ chromium: { launch: () => Promise<any> } }} playwright loadPlaywright 的結果
 * @returns {Promise<any>} 開好的 Chromium（用完要 close）
 * @throws {Error} 瀏覽器開不起來（沒裝瀏覽器、被擋住…）：中文，開頭是「瀏覽器開不起來」，附 Playwright 回報的第一行
 */
export async function launchChromium(playwright) {
    try {
        return await playwright.chromium.launch();
    } catch (err) {
        // Playwright 開瀏覽器要先在系統暫存資料夾建資料夾；暫存資料夾寫不進去，真正的原因是它，不是瀏覽器沒裝
        const probe = tmpFolderProblem();
        if (probe !== null) {
            throw new Error(`瀏覽器開不起來：系統暫存資料夾（${os.tmpdir()}）寫不進去（${probe}）。Playwright 開瀏覽器要在暫存資料夾裡建資料夾；請檢查環境變數 TMPDIR（Windows 是 TEMP、TMP）指到的資料夾存在、而且可以寫入`, { cause: err });
        }
        const reason = String(err.message).split('\n').map((row) => row.trim()).find((row) => row !== '') ?? '原因不明';
        throw new Error(`瀏覽器開不起來（Chromium）：${reason.replace(/\u001b\[[0-9;]*m/g, '')}。可能是還沒裝瀏覽器，請在 Playwright 那邊執行安裝瀏覽器的命令`, { cause: err });
    }
}

/**
 * @returns {string | null} 系統暫存資料夾能不能建資料夾：可以是 null；不行是錯誤碼（ENOENT、EACCES…）
 */
function tmpFolderProblem() {
    try {
        fs.rmSync(fs.mkdtempSync(path.join(os.tmpdir(), 'site-probe-')), { recursive: true, force: true });
        return null;
    } catch (err) {
        return err.code ?? err.message;
    }
}
