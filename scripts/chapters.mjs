// 教學章節轉換的命令：把教學片的章名摘要與三份時間表，轉成網站 09 教學影片區讀的三份資料檔。
//
// **教學片重算過（時間表變了、章名或摘要改了）就要重跑**，再把 data/ 裡的三個檔一起提交。
//
// 跑法（在 homepage/site/）：
//   node scripts/chapters.mjs                                  讀專案根目錄的 tutorial/，寫進 data/
//   node scripts/chapters.mjs --root <專案根目錄> --out <資料夾>   指定讀哪裡、寫哪裡（--out 不存在會自己建）
//   npm run chapters                                           同第一行
//
// 讀：<root>/tutorial/chapters.js、<root>/tutorial/preview/timetable-<zh|en|ja>.txt
// 寫：<out>/chapters.<zh|en|ja>.json，一個語言 16 章 { id, name, desc, start, end }（秒）。
//
// 出錯：讀檔與轉換時出錯（缺檔、時間表寫壞、章數或時間三語對不上）→ stderr 講出哪裡、結束碼 1，完全不動 <out>
// ——先全部讀完算好、確認沒錯才開始寫。只有寫檔寫到一半才失敗（磁碟滿、同名的資料夾擋著）可能留下半套，重跑即可。
// 轉換的邏輯全在 lib/chapters.js，這裡只讀參數、讀檔、寫檔。
//
// 要在 GPTPlugins 這個 repo 裡跑：拆成公開的網站 repo 之後，預設的 --root（這支檔往上三層）會指到 repo 外面；
// 這支在 GPTPlugins 跑，產出的 data/ 再帶進網站 repo 提交。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildChapters, loadChaptersScript } from '../lib/chapters.js';

const LANGS = ['zh', 'en', 'ja'];
const HERE = path.dirname(fileURLToPath(import.meta.url));
// 這支檔在 <專案根目錄>/homepage/site/scripts/，往上三層是專案根目錄
const DEFAULT_ROOT = path.resolve(HERE, '..', '..', '..');
const DEFAULT_OUT = path.resolve(HERE, '..', 'data');

/**
 * @param {string} file 檔案的路徑
 * @returns {Promise<string>} 檔案內容（UTF-8）
 * @throws {Error} 讀不到；訊息帶著路徑
 */
async function readText(file) {
    try {
        return await readFile(file, 'utf8');
    } catch (err) {
        throw new Error(`讀不到 ${file}：${err.code === 'ENOENT' ? '檔案不存在' : err.message}`, { cause: err });
    }
}

/**
 * 讀來源、轉換、再寫出；任何一步出錯都不會寫出半套。
 *
 * @param {string[]} argv 命令列參數（--root、--out）
 * @returns {Promise<string[]>} 寫出的檔案路徑
 */
async function run(argv) {
    const { values } = parseArgs({ args: argv, options: { root: { type: 'string' }, out: { type: 'string' } } });
    const root = path.resolve(values.root ?? DEFAULT_ROOT);
    const out = path.resolve(values.out ?? DEFAULT_OUT);

    const chapters = loadChaptersScript(await readText(path.join(root, 'tutorial', 'chapters.js')));
    const timetables = {};
    for (const lang of LANGS) timetables[lang] = await readText(path.join(root, 'tutorial', 'preview', `timetable-${lang}.txt`));
    const built = buildChapters({ chapters, timetables });

    const files = LANGS.map((lang) => [path.join(out, `chapters.${lang}.json`), JSON.stringify(built[lang], null, 2) + '\n']);
    await mkdir(out, { recursive: true });
    for (const [file, text] of files) await writeFile(file, text);
    return files.map(([file]) => file);
}

try {
    for (const file of await run(process.argv.slice(2))) console.log(`寫好了：${file}`);
} catch (err) {
    console.error(`chapters.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
}
