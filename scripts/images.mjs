// 圖片轉 WebP 的命令：把素材資料夾裡的 PNG、JPEG 各轉成 640 與 1280 兩個寬度的 WebP（設定檔可以替某幾張圖指定裁切與別的寬度），放進 public/images/，再寫一份 images.json 給前端讀寬高。
//
// 跑法（在 homepage/site/）：
//   npm run images -- --from <素材資料夾> [--out <資料夾>] [--config <設定檔>]
//   --from   素材資料夾（沒有預設：素材在網站 repo 外面）。只看這一層（不往下找）副檔名是 .png、.jpg、.jpeg（大小寫都算）的檔；.svg、.txt、「.」開頭的檔略過。
//            mark.svg 這類向量圖不轉：轉成 WebP 只會變糊又變大。
//   --out    輸出資料夾，預設是這支檔旁邊的 ../public/images（從哪裡叫都一樣）；不存在會自己建。
//   --config 設定檔，預設是這支檔旁邊的 images.config.json（從哪裡叫都一樣）。
//   例：npm run images -- --from <GPTPlugins>/design/homepage/assets
//
// 裁切與寬度的設定（images.config.json）：一個物件，鍵是來源檔名（含副檔名），值是 { crop?, widths? }；沒寫的圖照舊（640、1280，不裁切）。
//   crop    裁切框 { x, y, width, height }，以原圖像素算：網頁只顯示圖的一塊時，先裁出那一塊再縮，免得瀏覽器下載看不到的部分。
//   widths  想要的輸出寬度；每個跟「框寬（沒有 crop 就是原圖寬）」取小的、不放大、不重複。
//   設定寫錯（不是 JSON、框的欄位不對、框超出原圖、widths 不對）在碰任何圖之前就停，講出是哪張圖。--config 指定的設定檔裡有、--from 沒有的圖也算錯；
//   預設的設定檔裡有、--from 沒有的圖只在 stderr 印一行警告、照常轉。框改了就重跑（框只換位置、寬高沒變也會重算）。
//
// cwebp 的路徑不寫死在程式裡：環境變數 CWEBP（空字串當作沒設），沒設就用 PATH 裡的 cwebp。
//   mac／Linux：   CWEBP=/path/to/cwebp npm run images -- --from …        （Homebrew：brew install webp）
//   Windows cmd：  set "CWEBP=C:\path\to\cwebp.exe" && npm run images -- --from …      （要指到 .exe）
//   工具找不到或跑不起來時，錯誤訊息會帶著試的那個路徑。
//
// 輸出：每張 <檔名去掉副檔名>-<寬>.webp（步驟 一.png → 步驟 一-640.webp）。寬度是 640 與 1280（設定檔有寫就用它的 widths）各取「它」與原圖寬（有裁切框是框寬）之中小的那個、不放大、不重複
//   （1920 → 640、1280；1000 → 640、1000；300 → 300）。高照原圖（或框）的比例四捨五入。
//   images.json：鍵是來源檔名（含副檔名），照 sort() 排；值是 { width, height, sizes }（原圖的寬高；sizes 每筆 { file, width, height, bytes }，由小到大）；
//   有裁切的圖多一個 crop（照設定檔）：{ width, height, crop, sizes }，width、height 還是原圖的，裁切後的長寬比是 crop.width : crop.height。
//
// 無損或有損，照副檔名判斷（量過，數字在 README 的「圖片」一節）：
//   .png 用無損（-lossless -z 9）：介面截圖是字與暗色漸層，有損會在字的邊緣出雜訊、在漸層出色階斷層，無損跟原圖逐像素相同；
//   .jpg、.jpeg 用有損（-q 85 -m 6 -sharp_yuv）：照片來源本來就是有損的 JPEG，轉無損會比原檔大約 3 倍；q85 的 PSNR 約 46.8 dB（45 dB 以上肉眼分不出差別）。
//
// 重跑不重算：輸出已經在、修改時間不比來源舊、寬高對得上就沿用（.webp 不重寫）；來源換了才重算那一張。要整批重做（改了轉檔設定之後）就刪掉 public/images/ 裡的 .webp 再跑。
//   來源拿掉一張，它的 .webp 與 images.json 那一筆也拿掉；只拿檔名是「<名字>-<寬>.webp」的檔，輸出資料夾裡別的檔（包括別的 .webp，例如 --out 給錯成 public/media）不動。
//
// 壞檔只壞那一張：讀不了、是空檔案、不是圖、cwebp 轉不出來的那一張記下原因，其餘照做、寫進 images.json；最後在 stderr 一張一行列出壞的與原因，結束碼 1。
// 結束碼：0 ＝ 都轉好；1 ＝ 有壞檔，或做不完（來源裡沒有圖、兩張圖會寫成同一個檔名、cwebp 跑不起來、一張都沒轉成功 —— 這幾種輸出資料夾都不動，路徑給錯不會把 public/images 清空）；
//   2 ＝ 用法錯誤（不認得的參數、缺值、路徑是空的、沒給 --from、--from 不存在或不是資料夾）。用法錯誤與找不到 cwebp 都在碰任何圖之前就停。
// 流程在 lib/images-run.js，這裡只讀參數、組成執行 cwebp 的函式、印結果。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCli } from '../lib/cli-args.js';
import { parseImagesConfig } from '../lib/images-config.js';
import { runImages } from '../lib/images-run.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'public', 'images');
const DEFAULT_CONFIG = path.resolve(HERE, 'images.config.json');
const USAGE = '用法：node scripts/images.mjs --from <素材資料夾> [--out <資料夾>] [--config <設定檔>]';

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ from: string, out: string, config: string, configGiven: boolean }} 路徑都換成絕對路徑；configGiven 是有沒有用 --config 明確指定
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑是空的、沒給 --from、--from 不是資料夾
 */
function readOptions(argv) {
    const values = parseCli(argv, { from: {}, out: {}, config: {} });
    if (values.from === undefined) throw new Error('沒給 --from（素材資料夾）');
    if (!fs.statSync(values.from, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`--from ${values.from} 不存在，或不是資料夾`);
    return { from: path.resolve(values.from), out: path.resolve(values.out ?? DEFAULT_OUT), config: path.resolve(values.config ?? DEFAULT_CONFIG), configGiven: values.config !== undefined };
}

/**
 * @param {string} file 設定檔路徑
 * @returns {Record<string, object>} 檢查過的設定（見 lib/images-config.js）
 * @throws {Error} 設定檔不存在、是資料夾、讀不了、內容不對（中文，講出是哪個檔）
 */
function readConfig(file) {
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat) throw new Error(`找不到設定檔 ${file}`);
    if (!stat.isFile()) throw new Error(`設定檔 ${file} 是資料夾，不是檔案`);
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (err) {
        throw new Error(`讀不了設定檔 ${file}（${err.code ?? err.message}）`, { cause: err });
    }
    try {
        return parseImagesConfig(text);
    } catch (err) {
        throw new Error(`${err.message}（${file}）`, { cause: err });
    }
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`images.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exitCode = 2;
}

if (options) {
    try {
        // 環境變數是空字串當作沒設，退回 PATH 裡的 cwebp
        const cwebp = process.env.CWEBP || 'cwebp';
        const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
        const config = readConfig(options.config);
        const { images, bad, warnings, converted, reused, totalBytes } = await runImages({ from: options.from, out: options.out, cwebp, run, config, strictConfig: options.configGiven });
        for (const warning of warnings) console.error(`警告：${warning}`);
        for (const image of images) {
            console.log(`${image.name}（${image.width}x${image.height}${image.crop ? `，裁切 ${image.crop.x},${image.crop.y} 起 ${image.crop.width}x${image.crop.height}` : ''}）：${image.sizes.map((size) => `${size.width} 寬 ${size.bytes} 位元組`).join('、')}`);
        }
        console.log(`輸出：${options.out}（${converted} 個檔新轉、${reused} 個沿用；合計 ${totalBytes} 位元組）`);
        if (bad.length > 0) {
            console.error(`有 ${bad.length} 張圖沒轉成（其餘照常做完了）：`);
            for (const item of bad) console.error(`  ${item.name}：${item.reason}`);
            process.exitCode = 1;
        }
    } catch (err) {
        console.error(`images.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    }
}
