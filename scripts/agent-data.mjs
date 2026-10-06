// 「AI 開始打字」資料的命令：把教學片的 tutorial/agent-{zh,en,ja}.js 轉成網站用的 data/agent.{zh,en,ja}.json（07 區的打字動畫用）。
//
// 跑法（在 homepage/site/）：
//   npm run agent-data -- --from <tutorial 資料夾> [--out <資料夾>]
//   --from   教學片的資料夾，裡面要有 agent-zh.js、agent-en.js、agent-ja.js。沒有預設：它在網站 repo 外面。
//   --out    輸出資料夾，預設是這支檔旁邊的 ../data（也就是 homepage/site/data/，從哪裡叫都一樣）；不存在會自己建。
//   例：npm run agent-data -- --from <GPTPlugins>/tutorial
//
// 做什麼：
//   1. 讀 --from 的三支來源。來源是瀏覽器的全域指派（開頭註解、接著 window.AGENT = { JSON };），這裡把它當資料讀、不執行（lib/agent.js 的 parseAgentSource）：
//      來源裡就算被塞了程式也不會跑。
//   2. 檢查：六個欄位 model、prompt、steps、outline、reply、say 都要有、不能多；字串不能是空的；steps 是非空陣列，每一步是 [工具, 參數] 兩個有字的字串。
//   3. 三種語言都沒問題才寫進 --out：agent.zh.json、agent.en.json、agent.ja.json，每個檔剛好是 JSON.stringify({ model, prompt, steps, outline, reply, say }, null, 2) + '\n'。
//      字不改；--out 裡別的檔（chapters.*.json）不動；失敗時 --out 一個位元組都不動；重跑結果相同。
//   教學片重算、agent-*.js 改了之後，要重跑這個命令、把 data/ 一起提交。
//
// 輸出：沒問題時 stdout 印每個寫好的檔；有問題時 stderr 第一行說有幾個問題，之後每個問題一行，同一行寫到來源檔名與原因。
// 結束碼：0 ＝ 成功；1 ＝ 來源有問題（缺檔、是資料夾、空的、讀不了、欄位或步驟不對）或放不進 --out；2 ＝ 用法錯誤（沒給 --from、不認得的參數、缺值、路徑是空的、--from 不是資料夾）。
// 讀法在 lib/agent.js，這裡只讀參數、讀檔、叫它、放進 --out、印結果。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAgentSource } from '../lib/agent.js';
import { parseCli } from '../lib/cli-args.js';
import { publish } from '../lib/publish.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'data');
const USAGE = '用法：node scripts/agent-data.mjs --from <tutorial 資料夾> [--out <資料夾>]';
const LANGS = ['zh', 'en', 'ja'];

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ from: string, out: string }} 路徑都換成絕對路徑
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --from、--from 不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { from: {}, out: {} });
    if (values.from === undefined) throw new Error('沒給 --from（教學片 tutorial 資料夾）');
    if (!fs.statSync(values.from, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--from ${values.from} 不存在，或不是資料夾`);
    return { from: path.resolve(values.from), out: path.resolve(values.out ?? DEFAULT_OUT) };
}

/**
 * 讀一種語言的來源，轉成要寫的 JSON 文字。
 *
 * @param {string} from tutorial 資料夾
 * @param {string} lang zh、en 或 ja
 * @returns {{ text: string } | { problem: string }} 成功給要寫的內容；有問題給一句中文（寫到來源檔名）
 */
function convert(from, lang) {
    const name = `agent-${lang}.js`;
    const file = path.join(from, name);
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) return { problem: `${name}：找不到（${file}）` };
    if (!stat.isFile()) return { problem: `${name}：是資料夾，不是檔案（${file}）` };
    let source;
    try {
        source = fs.readFileSync(file, 'utf8');
    } catch (err) {
        return { problem: `${name}：讀不了（${err.code ?? err.message}）` };
    }
    if (source.trim() === '') return { problem: `${name}：是空的` };
    try {
        return { text: `${JSON.stringify(parseAgentSource(source), null, 2)}\n` };
    } catch (err) {
        if (err instanceof RangeError) return { problem: `${name}：來源太大或結構異常，讀不了` };
        return { problem: `${name}：${err instanceof Error ? err.message : String(err)}` };
    }
}

/**
 * 把要寫的內容先寫進系統暫存資料夾裡自己開的資料夾（放進 --out 之前的中間站）。
 *
 * @param {string[]} names 檔名
 * @param {string[]} texts 每個檔的內容（跟 names 一一對應）
 * @returns {string} 暫存資料夾的路徑
 * @throws {Error} 系統暫存資料夾寫不進去（不存在、唯讀、滿了…）：中文白話，附錯誤碼；--out 還沒動
 */
function stage(names, texts) {
    let tmpDir;
    try {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-agent-'));
        names.forEach((name, i) => fs.writeFileSync(path.join(tmpDir, name), texts[i]));
        return tmpDir;
    } catch (err) {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
        throw new Error(`系統暫存資料夾（${os.tmpdir()}）寫不進去（${err.code ?? err.message}）：沒有寫任何檔，${options.out} 沒有動`, { cause: err });
    }
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`agent-data.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        const results = LANGS.map((lang) => convert(options.from, lang));
        const problems = results.filter((result) => result.problem).map((result) => result.problem);
        if (problems.length > 0) {
            console.error(`agent-data.mjs 失敗：來源有 ${problems.length} 個問題要修（${options.out} 沒有動）：`);
            for (const problem of problems) console.error(`  ${problem}`);
            process.exitCode = 1;
        } else {
            // 先寫進系統暫存資料夾、再一次放進 --out：三個一起換，不會留半成品
            const names = LANGS.map((lang) => `agent.${lang}.json`);
            const tmpDir = stage(names, results.map((result) => result.text));
            try {
                publish(tmpDir, options.out, names);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            names.forEach((name, i) => console.log(`寫好了：${path.join(options.out, name)}（${Buffer.byteLength(results[i].text)} 位元組）`));
        }
    } catch (err) {
        console.error(`agent-data.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
