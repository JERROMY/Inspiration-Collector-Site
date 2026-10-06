/**
 * media-run.js —— 素材處理的流程：把 release/ 的宣傳片去掉音軌、預覽圖換成 WebP，驗證沒問題才放進輸出資料夾。
 *
 * 做事的順序（讀圖片與影片資訊、組參數都是 media.js 的事，這裡只管流程）：
 * 1. 先查原檔都在（缺的一次全列出），再查 ffmpeg 與 cwebp 跑得起來。
 * 2. 每個語言：量來源影片 → 轉檔到系統暫存資料夾裡自己開的資料夾 → 再量一次轉出來的影片 → 驗證；海報同理。
 *    影片要驗：沒有音軌、長度跟來源差不超過 0.05 秒、解析度相同、不超過大小上限。海報要驗：是 WebP、寬高跟原 PNG 一樣、比原 PNG 小。
 * 3. 三個語言全部通過，才把成品與 media.json 放進輸出資料夾。轉檔與驗證任何一步出錯，輸出資料夾與原檔一個位元組都不動，暫存資料夾清掉。
 *    放進輸出資料夾這一步：先確認每個目標名字都不是資料夾，再全部複製成 <名字>.partial，複製階段失敗就清掉 .partial、舊檔不動；
 *    複製都成功才一個一個改成正式名字，改名階段失敗（外部程式佔著檔案，Windows 的 EPERM／EBUSY）已改好的是新的、其餘是舊的，可能半新半舊，重跑即可。
 *
 * 外部工具由呼叫端傳進來的 run 執行（命令用 spawnSync），所以這裡不需要為了測試開任何後門。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMediaJson, cwebpArgs, ffmpegArgs, parseFfmpegInfo, planMedia, readImageSize } from './media.js';
import { publish } from './publish.js';
import { checkTool, launched, reasonOf } from './tools.js';

const DEFAULT_LANGS = ['zh', 'en', 'ja'];
const DEFAULT_MAX_VIDEO_MB = 4;
const MB = 1024 * 1024;
const DURATION_TOLERANCE_SEC = 0.05;

/**
 * @param {string} file 檔案路徑
 * @returns {boolean} 是不是存在的檔案
 */
function isFile(file) {
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true;
}

/**
 * @param {{ lang: string, videoIn: string, posterIn: string }[]} plan planMedia 的結果
 * @throws {Error} 有原檔不在；訊息一次列出缺的每一個
 */
function checkInputs(plan) {
    const missing = plan.flatMap((item) => [item.videoIn, item.posterIn]).filter((file) => !isFile(file));
    if (missing.length > 0) throw new Error(`缺原檔，找不到：${missing.join('、')}`);
}

/**
 * `ffmpeg -hide_banner -i <檔>` 沒有輸出檔，印完資訊一定以結束碼 1 結束，所以只有開不起來才算工具出錯；資訊讀不出來才算檔案有問題。
 *
 * @param {(command: string, args: string[]) => any} run 執行外部工具
 * @param {string} ffmpeg ffmpeg 的路徑或指令
 * @param {string} file 影片路徑
 * @returns {Promise<{ durationSec: number, video: { width: number, height: number }, hasAudio: boolean }>}
 * @throws {Error} 讀不出資訊、或這個檔沒有影像
 */
async function inspect(run, ffmpeg, file) {
    const res = launched(await run(ffmpeg, ['-hide_banner', '-i', file]), 'ffmpeg', ffmpeg);
    const stderr = String(res.stderr ?? '');
    let info;
    try {
        info = parseFfmpegInfo(stderr);
    } catch (err) {
        const tail = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop() ?? '（沒有輸出）';
        throw new Error(`${path.basename(file)} 讀不出影片資訊：${err.message}（ffmpeg 最後說：${tail}）`, { cause: err });
    }
    if (info.video === null) throw new Error(`${path.basename(file)} 沒有影像串流`);
    return info;
}

/**
 * 轉一支影片到暫存資料夾，再量轉出來的檔，驗證都過了才回傳量到的資料。
 *
 * @param {{ run: Function, ffmpeg: string, maxVideoMb: number }} tools 執行器、ffmpeg、大小上限（MB，1 MB＝1024×1024 位元組）
 * @param {{ videoIn: string }} item planMedia 的一筆
 * @param {string} tmpFile 暫存的輸出路徑（.mp4）
 * @returns {Promise<{ bytes: number, durationSec: number, width: number, height: number }>}
 * @throws {Error} 轉檔失敗、沒寫出檔、還有音軌、長度差超過 0.05 秒、解析度變了、超過大小上限
 */
async function makeVideo({ run, ffmpeg, maxVideoMb }, item, tmpFile) {
    const source = await inspect(run, ffmpeg, item.videoIn);
    const res = launched(await run(ffmpeg, ffmpegArgs(item.videoIn, tmpFile)), 'ffmpeg', ffmpeg);
    if (res.status !== 0) throw new Error(`影片轉檔失敗（ffmpeg 結束碼 ${res.status}）：${reasonOf(res)}`);
    if (!isFile(tmpFile)) throw new Error('影片轉檔結束碼是 0，卻沒有寫出檔');

    const made = await inspect(run, ffmpeg, tmpFile);
    if (made.hasAudio) throw new Error('輸出的影片還有音軌（要拿掉）');
    const drift = Math.abs(made.durationSec - source.durationSec);
    if (drift > DURATION_TOLERANCE_SEC + 1e-9) {
        throw new Error(`輸出的影片長度不對：來源 ${source.durationSec} 秒、輸出 ${made.durationSec} 秒（差超過 ${DURATION_TOLERANCE_SEC} 秒）`);
    }
    if (made.video.width !== source.video.width || made.video.height !== source.video.height) {
        throw new Error(`輸出的影片解析度變了：來源 ${source.video.width}x${source.video.height}、輸出 ${made.video.width}x${made.video.height}`);
    }
    const bytes = fs.statSync(tmpFile).size;
    if (bytes > maxVideoMb * MB) {
        throw new Error(`輸出的影片 ${(bytes / MB).toFixed(2)} MB（${bytes} 位元組），超過大小上限 ${maxVideoMb} MB（${Math.round(maxVideoMb * MB)} 位元組；1 MB＝1024×1024 位元組）`);
    }
    return { bytes, durationSec: made.durationSec, width: made.video.width, height: made.video.height };
}

/**
 * 轉一張海報到暫存資料夾，驗證都過了才回傳量到的資料。
 *
 * @param {{ run: Function, cwebp: string }} tools 執行器、cwebp
 * @param {{ posterIn: string }} item planMedia 的一筆
 * @param {string} tmpFile 暫存的輸出路徑（.webp）
 * @returns {Promise<{ bytes: number, width: number, height: number }>}
 * @throws {Error} 轉檔失敗、沒寫出檔、輸出不是 WebP、寬高跟原 PNG 不同、沒有比原 PNG 小
 */
async function makePoster({ run, cwebp }, item, tmpFile) {
    const source = fs.readFileSync(item.posterIn);
    let png;
    try {
        png = readImageSize(source);
    } catch (err) {
        throw new Error(`原檔 ${path.basename(item.posterIn)} 讀不出寬高：${err.message}`, { cause: err });
    }
    const res = launched(await run(cwebp, cwebpArgs(item.posterIn, tmpFile)), 'cwebp', cwebp);
    if (res.status !== 0) throw new Error(`海報轉檔失敗（cwebp 結束碼 ${res.status}）：${reasonOf(res)}`);
    if (!isFile(tmpFile)) throw new Error('海報轉檔結束碼是 0，卻沒有寫出檔');

    const made = fs.readFileSync(tmpFile);
    let webp;
    try {
        webp = readImageSize(made);
    } catch (err) {
        throw new Error(`輸出的海報不是 WebP，或讀不出寬高：${err.message}`, { cause: err });
    }
    if (webp.type !== 'webp') throw new Error(`輸出的海報不是 WebP（讀到的是 ${webp.type}）`);
    if (webp.width !== png.width || webp.height !== png.height) {
        throw new Error(`輸出的海報寬高變了：原 PNG ${png.width}x${png.height}、WebP ${webp.width}x${webp.height}`);
    }
    if (made.length >= source.length) {
        throw new Error(`輸出的 WebP（${made.length} 位元組）沒有比原 PNG（${source.length} 位元組）小`);
    }
    return { bytes: made.length, width: webp.width, height: webp.height };
}

/**
 * 去掉宣傳片的音軌、把預覽圖換成 WebP，放進 out，並寫 media.json 給前端讀寬高。
 *
 * @param {object} options
 * @param {string} options.root 專案根目錄（原檔在 <root>/release/：demo-dust-1920x1080-<語言>.mp4、demo-dust-poster-<語言>.png）
 * @param {string} options.out 輸出資料夾（hero-<語言>.mp4、hero-poster-<語言>.webp、media.json；舊的同名檔會被覆蓋，不存在會建）
 * @param {string[]} [options.langs] 語言，預設 zh、en、ja
 * @param {string} [options.ffmpeg] ffmpeg 的路徑或指令，預設 'ffmpeg'
 * @param {string} [options.cwebp] cwebp 的路徑或指令，預設 'cwebp'
 * @param {number} [options.maxVideoMb] 每支影片的大小上限，單位 MB（1 MB＝1024×1024 位元組），預設 4
 * @param {(command: string, args: string[]) => ({ status: number | null, stdout?: string, stderr?: string, error?: Error } | Promise<object>)} options.run
 *   執行外部工具，回傳 spawnSync 的形狀（也可以是 Promise）
 * @returns {Promise<{ files: string[], totalBytes: number }>} 放進 out 的檔案（絕對路徑，影片與海報照語言、最後是 media.json）與它們的總位元組數
 * @throws {Error} 缺原檔、工具跑不起來、轉檔或驗證沒過（訊息講出是哪一個語言、哪一步）、放進 out 失敗（「放進 <out> 失敗：原因」）；
 *   轉檔或驗證沒過時 out 與原檔都沒動；放進 out 的失敗見 publish 的說明
 */
export async function runMedia({ root, out, langs = DEFAULT_LANGS, ffmpeg = 'ffmpeg', cwebp = 'cwebp', maxVideoMb = DEFAULT_MAX_VIDEO_MB, run }) {
    const plan = planMedia({ root, out, langs });
    checkInputs(plan);
    await checkTool(run, 'ffmpeg', ffmpeg);
    await checkTool(run, 'cwebp', cwebp);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-media-'));
    try {
        const results = [];
        for (const item of plan) {
            try {
                const video = await makeVideo({ run, ffmpeg, maxVideoMb }, item, path.join(tmpDir, path.basename(item.videoOut)));
                const poster = await makePoster({ run, cwebp }, item, path.join(tmpDir, path.basename(item.posterOut)));
                results.push({ ...item, video, poster });
            } catch (err) {
                throw new Error(`${item.lang}：${err.message}`, { cause: err });
            }
        }
        fs.writeFileSync(path.join(tmpDir, 'media.json'), JSON.stringify(buildMediaJson(results), null, 2) + '\n');
        const names = [...plan.flatMap((item) => [path.basename(item.videoOut), path.basename(item.posterOut)]), 'media.json'];
        publish(tmpDir, out, names);
        const files = names.map((name) => path.join(out, name));
        return { files, totalBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0) };
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
