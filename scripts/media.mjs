// 素材處理的命令：把宣傳片拿掉音軌、把預覽圖換成 WebP，放進網站的 public/media/，再寫一份 media.json 給前端讀寬高。
//
// 跑法（在 homepage/site/）：
//   npm run media                                                   讀專案根目錄的 release/，寫進 public/media/
//   node scripts/media.mjs --root <專案根目錄> --out <資料夾>          指定讀哪裡、寫哪裡（--out 不存在會自己建）
//   node scripts/media.mjs --max-video-mb 4                         每支影片的大小上限，單位 MB（1 MB＝1024×1024 位元組），預設 4
// 參數的值若是 - 開頭（例如負數），要寫成 --max-video-mb=-1 這種有等號的樣子；--root、--out、--ffmpeg、--cwebp 給了就不能是空的。
//
// 來源是粒子版（demo-dust-*）；一般版（demo-*）與粒子版共用 demo.html，差在第 1、2、10 幕。2026-10-04 使用者說首頁影片應該是粒子版。
// 讀：<root>/release/demo-dust-1920x1080-<zh|en|ja>.mp4（宣傳片）、<root>/release/demo-dust-poster-<zh|en|ja>.png（預覽圖）。原檔絕不修改。
// 寫：<out>/hero-<語言>.mp4（沒有音軌）、<out>/hero-poster-<語言>.webp、<out>/media.json（每個語言的檔名、位元組數、長度、寬高）。
//
// 要用兩個外部工具，路徑不寫死在程式裡：--ffmpeg、--cwebp 優先，其次環境變數 FFMPEG、CWEBP，都沒有才用 PATH 裡的 ffmpeg、cwebp
// （環境變數是空字串當作沒設；旗標給空字串 --ffmpeg= 是用法錯誤）。
//   mac／Linux：   FFMPEG=/path/to/ffmpeg CWEBP=/path/to/cwebp npm run media
//   Windows cmd：  set "FFMPEG=C:\path\to\ffmpeg.exe" && set "CWEBP=C:\path\to\cwebp.exe" && npm run media
//                  FFMPEG、CWEBP 要指到 .exe：指到 .cmd 或 .bat，Node 20.12 之後不開 shell 就跑不了（會是 EINVAL）。
// 這台 mac（2026-10-02）：Homebrew 的 ffmpeg 壞了（dyld 找不到 libx265），FFMPEG 要指到 VideoConverter 帶的那支 ffmpeg
//   （能去音軌、能看資訊，沒有 PNG／WebP 編碼器）；CWEBP 用 Homebrew 的 /opt/homebrew/bin/cwebp。
//   工具找不到或跑不起來時，錯誤訊息會帶著試的那個路徑與原因。
//
// 為什麼這樣做：
//   不重新編碼：影像串流原樣複製（-c:v copy），只拿掉音軌，所以畫面與長度不變、速度快（三支 63 秒的片加起來不到一秒）、不會再多一次畫質損失。
//   音軌占檔案約三成；首屏本來就靜音播，有聲版放 YouTube（規格書第 9 節）。
//   不用 ffprobe：ffmpeg 的安裝常常只有 ffmpeg 一支，這裡只讀 `ffmpeg -hide_banner -i` 印的資訊。
//   WebP 用無損（cwebp -lossless -z 9）：預覽圖是暗色的放射漸層，有損（q80、q90 加 -sharp_yuv 都試過）會出現一圈一圈的色階斷層，
//   只有無損跟原 PNG 逐像素相同（解碼回來用 magick compare -metric AE 比是 0）。-z 9 壓得最緊也最慢，三張加起來約 10 秒，整個命令約 11 秒。
//
// 大小（2026-10-02 在這台量的；這裡的 MB 都是 1024×1024 位元組，寫成 MiB 的地方括號裡附十進位）：
//   三支影片各約 3.4 MiB（粒子版，2026-10-04 量；3,596,071／3,631,728／3,625,282 位元組＝zh／en／ja，原檔各約 4.8 MiB；以下合計數字是一般版的舊值）、
//   三張 WebP 各約 104～107 KB（104,454／104,042／106,680 位元組，約 102～104 KiB；原 PNG 各約 346～350 KB，WebP 約是它的 30%），
//   media.json 846 位元組，合計 9,115,532 位元組（約 8.7 MiB＝9.1 MB 十進位），所以 git 增加量約 8.7 MiB（目標 15 MB 以內）；
//   重跑一次，檔案位元組相同。
// 「重跑相同」只在同一支 ffmpeg 上成立：ffmpeg 會把自己的版本字串寫進 mp4，換一支版本不同的 ffmpeg，位元組就會不同（內容一樣）。
// 素材要重做（影片重算過、海報換了）就重跑一次，再把 public/media/ 一起提交。
//
// 出錯：原檔缺了、工具跑不起來、驗證沒過（還有音軌、長度或解析度變了、超過大小、WebP 沒有比 PNG 小）→ stderr 講出哪裡、結束碼 1，
// 完全不動 <out> 與原檔，暫存資料夾（系統暫存資料夾裡自己開的）也會清掉。
// 驗證都過、放進 <out> 的時候：先確認 hero-*、media.json 這幾個名字沒有被資料夾佔著，再全部複製成 <名字>.partial，
// 複製階段失敗（磁碟滿、沒有權限）不留 .partial、<out> 裡的舊檔不動，訊息是「放進 <out> 失敗：原因」；
// 都複製好了才一個一個改成正式名字，改名階段失敗（外部程式佔著檔案，Windows 的 EPERM／EBUSY）已改好的是新的、其餘還是舊的，可能半新半舊，重跑即可。
// 用法錯誤（不認得的參數、缺值、路徑是空的、--max-video-mb 不是正數）→ 結束碼 2，工具還沒碰就停。
// 流程與驗證全在 lib/media-run.js，這裡只讀參數、組成執行外部工具的函式、印結果。
// 要在 GPTPlugins 這個 repo 裡跑：拆成公開的網站 repo 之後，預設的 --root（這支檔往上三層）會指到 repo 外面；
// 這支在 GPTPlugins 跑，產出的 public/media/ 再帶進網站 repo 提交。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runMedia } from '../lib/media-run.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 這支檔在 <專案根目錄>/homepage/site/scripts/，往上三層是專案根目錄
const DEFAULT_ROOT = path.resolve(HERE, '..', '..', '..');
const DEFAULT_OUT = path.resolve(HERE, '..', 'public', 'media');
const USAGE = '用法：node scripts/media.mjs [--root <專案根目錄>] [--out <資料夾>] [--ffmpeg <路徑>] [--cwebp <路徑>] [--max-video-mb <正數>]';
const MB = 1024 * 1024;
// 路徑類的參數，給了就不能是空的（--out= 這種寫法）；不靜靜退回預設或環境變數
const PATH_OPTIONS = ['root', 'out', 'ffmpeg', 'cwebp'];
// Node 的 parseArgs 丟的錯是英文，照 code 換成中文；name 是訊息裡引號中的第一個字（參數名或多出來的那一個字）
const PARSE_ERRORS = {
    ERR_PARSE_ARGS_UNKNOWN_OPTION: (name) => `不認得的參數 ${name}`,
    ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL: (name) => `多出一個參數「${name}」，每個參數都要用 -- 開頭`,
    ERR_PARSE_ARGS_INVALID_OPTION_VALUE: (name) => `${name} 後面缺值，或值是 - 開頭的字（例如負數，要寫成 ${name}=值）`,
};

/**
 * @param {string[]} argv 命令列參數
 * @returns {{ root: string, out: string, ffmpeg: string, cwebp: string, maxVideoMb: number | undefined }}
 * @throws {Error} 用法錯誤（中文訊息）：不認得的參數、缺值、路徑參數是空的、--max-video-mb 不是正數
 */
function readOptions(argv) {
    let values;
    try {
        ({ values } = parseArgs({
            args: argv,
            options: { root: { type: 'string' }, out: { type: 'string' }, ffmpeg: { type: 'string' }, cwebp: { type: 'string' }, 'max-video-mb': { type: 'string' } },
        }));
    } catch (err) {
        const explain = PARSE_ERRORS[err.code];
        const name = /'([^'\s]+)/.exec(err.message)?.[1] ?? '';
        throw new Error(explain ? explain(name) : err.message, { cause: err });
    }
    for (const key of PATH_OPTIONS) {
        if (values[key] !== undefined && values[key].trim() === '') throw new Error(`--${key} 不能是空的，要給一個路徑`);
    }
    let maxVideoMb;
    if (values['max-video-mb'] !== undefined) {
        maxVideoMb = Number(values['max-video-mb']);
        if (!Number.isFinite(maxVideoMb) || maxVideoMb <= 0) throw new Error(`--max-video-mb 要是正數，收到「${values['max-video-mb']}」`);
    }
    return {
        root: path.resolve(values.root ?? DEFAULT_ROOT),
        out: path.resolve(values.out ?? DEFAULT_OUT),
        // 旗標給了空字串是用法錯誤（上面擋掉）；環境變數是空字串當作沒設，退回 PATH 裡的
        ffmpeg: values.ffmpeg ?? (process.env.FFMPEG || 'ffmpeg'),
        cwebp: values.cwebp ?? (process.env.CWEBP || 'cwebp'),
        maxVideoMb,
    };
}

let options;
try {
    options = readOptions(process.argv.slice(2));
} catch (err) {
    console.error(`media.mjs 用法錯誤：${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
    process.exit(2);
}

try {
    const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
    const { files, totalBytes } = await runMedia({ ...options, run });
    for (const file of files) console.log(`寫好了：${file}`);
    console.log(`合計 ${(totalBytes / MB).toFixed(2)} MB（${files.length} 個檔）`);
} catch (err) {
    console.error(`media.mjs 失敗：${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
}
