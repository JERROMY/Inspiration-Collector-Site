// 分享卡圖的命令：把設計師的分享卡版面拍成三張 1200×630 的 PNG（og-zh.png、og-en.png、og-ja.png），放進 public/og/。
// 貼網址到 Facebook、Threads、LINE、X 時，預覽圖就是它們。「/」不另做圖，用 og-en.png。
//
// 跑法（在 homepage/site/）：
//   npm run og -- --root <專案根目錄> [--out <資料夾>] [--check] [--playwright <Playwright 套件的資料夾>]
//   --root        專案根目錄（GPTPlugins，不是 og 資料夾）：版面在 <根目錄>/design/homepage/og/{zh,en,ja}/index.html，稿裡的 CSS 是從根目錄往上四層連的，所以要從根目錄開本機伺服器。
//   --out         輸出資料夾，預設是這支檔旁邊的 ../public/og（從哪裡叫都一樣）；不存在會自己建。只新增或改寫那三張，裡面別的檔不動。
//   --check       只檢查：照樣開瀏覽器拍、照樣檢查，但不寫任何檔；拍出來的跟 --out 裡的三張逐位元組比，都相同是結束碼 0，有不同或不在是 1（講哪幾張）。
//   --playwright  Playwright 不裝進這個網站：用這個或環境變數 SITE_PLAYWRIGHT 指到 Playwright 套件的資料夾（同 fallback-fonts）。
//
// 拍照前每一張都要過關：沒有 console 錯誤、頁面例外與載不到的檔；@font-face 的字型都載到；字沒有撐破版面（scrollWidth ≤ 1200、scrollHeight ≤ 630）；
//   畫字用到的字型家族都在那個元素 font-family 寫的家族裡（指定的字型這台沒有，瀏覽器掉到回退字型，圖看起來正常卻不是設計的字形）；每張 ≤ 300 KB。
//   任何一張有問題，三張都不寫（舊的圖留著，不產半套）。
// 輸出：每張一行「og-<語言> 字型：A、B」（實際畫字用到的字型家族）。
//
// 一律在 mac 上產（中日文是設計稿旁邊切好的 Noto Sans TC／JP，但 Chromium 在不同系統上算圖不同）：指定的字型沒載到時這支命令會失敗。
//   同一台機器跑兩次逐位元組相同；換了 Chromium 版本、系統字型或換一台電腦，PNG 就會不同 —— 這時 --check 會紅，重跑再提交。PNG 進 git，部署時不產圖。
//
// 結束碼：0 ＝ 成功；1 ＝ 來源缺檔（在開瀏覽器之前就停）、找不到 Playwright、瀏覽器開不起來、有一張沒過關、--check 對不上、寫不進輸出資料夾；
//   2 ＝ 用法錯誤（沒給 --root、--root 不是資料夾、--out 是檔、路徑是空的、不認得的參數）。
// 流程在 lib/og-run.js、規矩在 lib/og.js，這裡只讀參數、印結果。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { LANGS, checkProblems, missingSources, ogName } from '../lib/og.js';
import { shootAll } from '../lib/og-run.js';
import { launchChromium, loadPlaywright, playwrightDir } from '../lib/playwright-loader.js';
import { publish } from '../lib/publish.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'public', 'og');
const USAGE = '用法：node scripts/og.mjs --root <專案根目錄> [--out <資料夾>] [--check] [--playwright <Playwright 套件的資料夾>]';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ root: string, out: string, check: boolean, playwright: string | undefined }} 路徑都換成絕對路徑
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --root、--root 不是資料夾、--out 是檔
 */
function readOptions(argv) {
    // --check 是開關，不帶值；parseCli 只認帶值的參數，所以先拿出來
    const check = argv.includes('--check');
    const values = parseCli(argv.filter((arg) => arg !== '--check'), { root: {}, out: {}, playwright: {} });
    if (values.root === undefined) throw new Error('沒給 --root（專案根目錄）');
    if (!fs.statSync(values.root, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--root ${values.root} 不存在，或不是資料夾`);
    const out = path.resolve(values.out ?? DEFAULT_OUT);
    if (fs.statSync(out, { throwIfNoEntry: false })?.isFile()) throw new Error(`--out ${out} 是檔案，要給資料夾`);
    return { root: path.resolve(values.root), out, check, playwright: values.playwright };
}

/**
 * @param {string} heading 第一行（講發生了什麼）
 * @param {string[]} lines 每個問題一行
 */
function fail(heading, lines) {
    console.error(`${heading}\n${lines.map((line) => `  ${line}`).join('\n')}`);
    process.exitCode = 1;
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`og.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    const { root, out, check } = options;
    // 先查來源、再找瀏覽器：缺檔時不必開瀏覽器，也不會被「找不到 Playwright」蓋掉真正的原因
    const missing = missingSources(root);
    if (missing.length > 0) {
        fail('og.mjs 失敗：分享卡的設計稿缺檔（--root 給對了嗎？）：', missing);
    } else {
        let browser;
        try {
            const playwright = loadPlaywright(playwrightDir(options.playwright, process.env), createRequire(import.meta.url));
            browser = await launchChromium(playwright);
            const shots = await shootAll({ browser, root });
            for (const lang of LANGS) console.log(`og-${lang} 字型：${shots[lang].fonts.join('、')}`);
            const problems = LANGS.flatMap((lang) => shots[lang].problems.map((problem) => `og-${lang}：${problem}`));
            const pngs = Object.fromEntries(LANGS.map((lang) => [lang, shots[lang].png]));
            if (problems.length > 0) {
                fail(`og.mjs 失敗：分享卡有地方不對，${check ? '沒有檢查完' : '一張都沒寫（舊的圖留著）'}：`, problems);
            } else if (check) {
                const stale = checkProblems(out, pngs);
                if (stale.length > 0) fail('og.mjs --check 失敗：分享卡跟設計稿對不上（設計稿或環境變了？重跑 npm run og 再提交）：', stale);
                else console.log('分享卡跟設計稿一致');
            } else {
                // 全部沒問題才寫：先放暫存資料夾，再一起放進 --out
                const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-og-'));
                try {
                    for (const lang of LANGS) fs.writeFileSync(path.join(tmpDir, ogName(lang)), pngs[lang]);
                    publish(tmpDir, out, LANGS.map(ogName));
                } finally {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                }
                console.log(`輸出：${out}（${LANGS.map((lang) => `${ogName(lang)} ${pngs[lang].length} 位元組`).join('、')}）`);
            }
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exitCode = 1;
        } finally {
            await browser?.close();
        }
    }
}
