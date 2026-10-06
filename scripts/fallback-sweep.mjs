// 回退字型的係數掃描：開瀏覽器，比「網頁字型載好」與「字型擋掉、用回退字型」兩種樣子下，每個區塊（data-id）的高度一不一樣；也可以掃微調係數。
//
// 跑法（在 homepage/site/）：
//   npm run fallback-sweep -- --site <已產生的網站資料夾> [--langs zh,en,ja] [--widths 280,390,…] [--playwright <Playwright 套件的資料夾>]
//   npm run fallback-sweep -- --site <網站> --css <fallback-fonts.css> --scan "<family>|<字重範圍>" --k <起:迄:間隔> [--langs …] [--widths …] [--playwright …]
//   --site        已經產生好的網站資料夾（Next.js 的 out/），在本機開一個靜態伺服器送它；每個語言的頁面在 /<語言>/。
//   --langs       要量的語言，預設 zh,en,ja。
//   --widths      要量的視窗寬度（正整數，逗號隔開），預設 280,320,360,375,390,414,430,640,768,1024,1280,1440。
//   --css         回退字型的 CSS（掃係數時，從這裡挑要乘係數的那一組）。
//   --scan        要乘係數的那一組，寫成 "<font-family>|<字重範圍>"，例如 "Google Sans Flex Fallback 16|100 449"。要跟 --css、--k 一起給。
//   --k           係數範圍「起:迄:間隔」（含迄），例如 0.98:1.02:0.01。
//   --playwright  Playwright 套件的資料夾；沒給就看環境變數 SITE_PLAYWRIGHT。要開瀏覽器，Playwright 不裝進這個網站（不進 package.json），要用的人自己指路徑。
//
// 做什麼：每個「語言 × 寬度」開兩次頁面：一次正常載入、一次把 *.woff2 擋掉（只剩回退字型）；量每個看得到的 [data-id] 的高度（四捨五入）。
//   檢查（沒給 --scan）：每一組一行「一致 <語言> <寬度>px」或「不一致 <語言> <寬度>px：<id>、<id>」，最後一行「共 N 組：一致 A、不一致 B」。
//   掃描（給了 --scan）：把 --css 裡那一組整組乘上每一個係數，注入擋掉字型的那一頁，每個係數一行「k=<係數> 不一致 <N> 組」，有不一致時接「：<語言> <寬度>px <id>、…；…」。
//   一個區塊的高度不同，通常是行數變了（換字型時它下面的東西會被推動）；行數不變、字左右移的那種不量。
//
// 結束碼：檢查有不一致是 1、全部一致是 0；掃描是 0。1 也是做不完（--css 讀不到、找不到 Playwright、瀏覽器開不起來）；
//   2 ＝ 用法錯誤（沒給 --site、--site 不是資料夾、--widths 不是正整數、--langs 不是 zh／en／ja、--scan 少了 --css 或 --k、--k 寫錯、不認得的參數、路徑是空的）。
// 量高度在 lib/fallback-sweep-run.js，這裡只讀參數、開伺服器與瀏覽器、叫它、印結果。
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseCli } from '../lib/cli-args.js';
import { runSweep } from '../lib/fallback-sweep-run.js';
import { parseKRange } from '../lib/fallback-sweep.js';
import { launchChromium, loadPlaywright, playwrightDir } from '../lib/playwright-loader.js';
import { serveSite } from '../lib/static-site.js';

const USAGE = '用法：node scripts/fallback-sweep.mjs --site <網站資料夾> [--langs zh,en,ja] [--widths 280,390,…] [--css <fallback-fonts.css> --scan "<family>|<字重>" --k <起:迄:間隔>] [--playwright <資料夾>]';
const LANGS = ['zh', 'en', 'ja'];
const DEFAULT_WIDTHS = [280, 320, 360, 375, 390, 414, 430, 640, 768, 1024, 1280, 1440];

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ site: string, langs: string[], widths: number[], scan: null | { css: string, family: string, weight: string, ks: number[] }, playwright: string | undefined }}
 * @throws {Error} 用法錯誤（中文訊息）
 */
function readOptions(argv) {
    const values = parseCli(argv, { site: {}, langs: {}, widths: {}, css: {}, scan: {}, k: {}, playwright: {} });
    if (values.site === undefined) throw new Error('沒給 --site（已經產生好的網站資料夾）');
    if (!fs.statSync(values.site, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--site ${values.site} 不存在，或不是資料夾`);
    const langs = values.langs === undefined ? LANGS : values.langs.split(',').map((item) => item.trim());
    for (const lang of langs) if (!LANGS.includes(lang)) throw new Error(`--langs 只認 ${LANGS.join('、')}，收到「${lang}」`);
    const widths = values.widths === undefined ? DEFAULT_WIDTHS : values.widths.split(',').map((item) => item.trim());
    for (const width of widths) if (!/^[1-9]\d*$/.test(String(width))) throw new Error(`--widths 要是正整數（逗號隔開），收到「${width}」`);
    let scan = null;
    if (values.scan !== undefined) {
        if (values.css === undefined || values.k === undefined) throw new Error('--scan 要跟 --css、--k 一起給');
        const [family, weight, ...rest] = values.scan.split('|');
        if (!family || !weight || rest.length > 0) throw new Error(`--scan 要寫成 "<font-family>|<字重範圍>"（例如 "Google Sans Flex Fallback 16|100 449"），收到「${values.scan}」`);
        scan = { css: path.resolve(values.css), family, weight, ks: parseKRange(values.k) };
    } else if (values.css !== undefined || values.k !== undefined) {
        throw new Error('--css、--k 要跟 --scan 一起給');
    }
    return { site: path.resolve(values.site), langs, widths: widths.map(Number), scan, playwright: values.playwright };
}

/**
 * @param {{ css: string, family: string, weight: string, ks: number[] }} scan 掃描的參數
 * @returns {{ lines: string[], family: string, weight: string, ks: number[] }} 把 --css 讀成 @font-face 的行
 * @throws {Error} --css 讀不到、或裡面沒有要掃的那一組（中文）
 */
function readScan(scan) {
    const stat = fs.statSync(scan.css, { throwIfNoEntry: false });
    if (!stat?.isFile()) throw new Error(`--css ${scan.css} 不存在，或不是檔案`);
    const lines = fs.readFileSync(scan.css, 'utf8').split('\n').filter((row) => row.startsWith('@font-face'));
    if (!lines.some((row) => row.includes(`font-family: "${scan.family}";`) && row.includes(`font-weight: ${scan.weight};`))) {
        throw new Error(`--css ${scan.css} 裡找不到「${scan.family}」字重 ${scan.weight} 的 @font-face`);
    }
    return { lines, family: scan.family, weight: scan.weight, ks: scan.ks };
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`fallback-sweep.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    let server;
    try {
        const scan = options.scan ? readScan(options.scan) : null;
        const playwright = loadPlaywright(playwrightDir(options.playwright, process.env), createRequire(import.meta.url));
        const browser = await launchChromium(playwright);
        server = await serveSite(options.site);
        try {
            const results = await runSweep({ browser, url: server.url, langs: options.langs, widths: options.widths, scan });
            if (scan) {
                for (const { k, bad } of results) {
                    const detail = bad.map(({ lang, width, ids }) => `${lang} ${width}px ${ids.join('、')}`).join('；');
                    console.log(`k=${k.toFixed(4)} 不一致 ${bad.length} 組${bad.length > 0 ? `：${detail}` : ''}`);
                }
            } else {
                for (const { lang, width, bad } of results) console.log(bad.length === 0 ? `一致 ${lang} ${width}px` : `不一致 ${lang} ${width}px：${bad.join('、')}`);
                const mismatched = results.filter(({ bad }) => bad.length > 0).length;
                console.log(`共 ${results.length} 組：一致 ${results.length - mismatched}、不一致 ${mismatched}`);
                if (mismatched > 0) process.exitCode = 1;
            }
        } finally {
            await browser.close();
        }
    } catch (err) {
        console.error(`fallback-sweep.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    } finally {
        await server?.close();
    }
}
