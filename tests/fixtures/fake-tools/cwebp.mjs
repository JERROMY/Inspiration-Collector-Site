// 假的 cwebp（4-b3 的測試用）。用 `node cwebp.mjs <參數…>` 跑 —— 測試注入的 run 一律是 spawnSync(process.execPath, [這支, …參數])。
//
// 兩種叫法：
//   -version                 印版本、結束碼 0
//   … <輸入.png> … -o <輸出>  讀輸入 PNG 的 IHDR 拿寬高，寫一支同寬高的 WebP：有 -lossless 就是無損的 'VP8L' 檔頭（跟真的 cwebp -lossless 一樣），沒有就是有損的 'VP8 '，
//                            預設 1500 位元組（比任何測試用的 PNG 都小）。輸入是「參數裡唯一存在的檔案」，輸出是 -o 後面那個。
//
// 環境變數：
//   FAKE_CWEBP      noversion   -version 結束碼 1
//                   bigger      輸出比輸入 PNG 還大（多 2 位元組）
//                   resize      輸出寬度少 1（1919）
//                   notwebp     輸出是 PNG 位元組（副檔名照樣 .webp）
//                   fail        結束碼 1、stderr「fake cwebp failed: Cannot read input picture」、不寫檔
//   FAKE_ONLY       zh／en／ja  壞法只套在檔名含 -<語言>. 的那張
//   FAKE_LOG        檔案路徑    每叫一次就附加一行 JSON：{ tool: 'cwebp', args }
import fs from 'node:fs';
import { png, webpLossless, webpLossy } from './images.js';

const args = process.argv.slice(2);
const env = process.env;

if (env.FAKE_LOG) fs.appendFileSync(env.FAKE_LOG, JSON.stringify({ tool: 'cwebp', args }) + '\n');

if (args.includes('-version')) {
    if (env.FAKE_CWEBP === 'noversion') {
        process.stderr.write('dyld[4243]: Library not loaded: /opt/homebrew/opt/libwebp/lib/libsharpyuv.0.dylib\n');
        process.exit(1);
    }
    process.stdout.write('1.6.0\nlibsharpyuv: 0.4.2\n');
    process.exit(0);
}

const at = args.indexOf('-o');
const output = at >= 0 ? args[at + 1] : undefined;
const input = args.find((arg, i) => i !== at + 1 && fs.existsSync(arg) && fs.statSync(arg).isFile());
if (!output || !input) {
    process.stderr.write('fake cwebp: 找不到輸入檔或沒給 -o\n');
    process.exit(1);
}

const fault = !env.FAKE_ONLY || new RegExp(`-${env.FAKE_ONLY}\\.`).test(input) ? env.FAKE_CWEBP : undefined;
if (fault === 'fail') {
    process.stderr.write('fake cwebp failed: Cannot read input picture\n');
    process.exit(1);
}

const src = fs.readFileSync(input);
const width = src.readUInt32BE(16);
const height = src.readUInt32BE(20);
let out;
if (fault === 'notwebp') {
    out = png(width, height);
} else {
    let size = 1500;
    if (fault === 'bigger') size = src.length + 2 + (src.length % 2);
    const build = args.includes('-lossless') ? webpLossless : webpLossy;
    out = build(fault === 'resize' ? width - 1 : width, height, { size });
}
fs.writeFileSync(output, out);
process.exit(0);
