/**
 * media.js —— 素材處理的純函式：宣傳片去音軌、預覽圖換 WebP 時，讀工具的輸出、讀圖片大小、組工具的參數、組 media.json。
 *
 * 這裡一個外部工具都不開、一個檔都不讀不寫（那是 media-run.js 的事），收字串或位元組、給資料；錯誤一律丟 Error 並講出缺什麼，
 * 不回傳亂猜的值。六個函式各做一件事：
 * - parseFfmpegInfo  `ffmpeg -hide_banner -i <檔>` 的 stderr → { durationSec, video, hasAudio }
 * - readImageSize    PNG／WebP 的位元組 → { type, width, height }（只讀檔頭，不解碼）
 * - planMedia        每個語言的輸入與輸出路徑
 * - ffmpegArgs       去音軌的 ffmpeg 參數（影像直接複製，不重新編碼）
 * - cwebpArgs        轉 WebP 的 cwebp 參數
 * - buildMediaJson   驗證過的結果 → 前端讀的 media.json 內容
 */
import path from 'node:path';

const VIDEO_PREFIX = 'demo-dust-1920x1080';
const POSTER_PREFIX = 'demo-dust-poster';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DURATION_LINE = /^\s*Duration:\s*([0-9]+):([0-9]{2}):([0-9]{2}(?:\.[0-9]+)?)/m;
const STREAM_LINE = /^\s*Stream\s+#\S+:\s*(Video|Audio):\s*(.*)$/;
const RESOLUTION = /(?<![\w.])([0-9]+)x([0-9]+)(?![\w.])/;

/**
 * 影像串流那一行「Video:」後面的字裡找解析度。編碼標記（`(avc1 / 0x31637661)`、`([27][0][0][0] / 0x001B)`）、
 * 色彩空間的括號（`yuv420p(tv, bt709, progressive)`）、`[SAR 1:1 DAR 16:9]` 裡都有「數字x數字」的樣子，先整段拿掉再找。
 *
 * @param {string} rest 「Video:」後面的整段字
 * @returns {{ width: number, height: number } | null} 找不到是 null
 */
function resolutionOf(rest) {
    let bare = rest;
    while (/\([^()]*\)/.test(bare)) bare = bare.replace(/\([^()]*\)/g, ' ');
    const found = RESOLUTION.exec(bare.replace(/\[[^\]]*\]/g, ' '));
    return found ? { width: Number(found[1]), height: Number(found[2]) } : null;
}

/**
 * 讀 `ffmpeg -hide_banner -i <檔>` 印在 stderr 的資訊。
 *
 * @param {string} stderr ffmpeg 的 stderr 全文（LF 或 CRLF 都行）
 * @returns {{ durationSec: number, video: { width: number, height: number } | null, hasAudio: boolean }}
 *   durationSec 是秒（時×3600＋分×60＋秒，到小數）；video 是第一條影像串流的寬高，只有音軌的檔是 null；hasAudio 是有沒有任何音軌
 * @throws {TypeError} stderr 不是字串
 * @throws {Error} 沒有 Duration（或 N/A）、影像與音軌都沒有、有影像卻讀不到解析度；訊息講缺什麼
 */
export function parseFfmpegInfo(stderr) {
    if (typeof stderr !== 'string') throw new TypeError(`parseFfmpegInfo 只收字串，收到 ${typeof stderr}`);
    const text = stderr.replace(/\r\n/g, '\n');
    const clock = DURATION_LINE.exec(text);
    if (!clock) throw new Error('ffmpeg 沒有印出長度（Duration 不見或是 N/A）：檔案可能被截斷、損壞，或不是影片');
    const durationSec = Number((Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])).toFixed(6));

    let firstVideo = null;
    let hasAudio = false;
    for (const line of text.split('\n')) {
        const stream = STREAM_LINE.exec(line);
        if (!stream) continue;
        if (stream[1] === 'Audio') hasAudio = true;
        else if (firstVideo === null) firstVideo = stream[2];
    }
    if (firstVideo === null && !hasAudio) throw new Error('ffmpeg 沒有印出任何影像（Video）或音軌（Audio）串流：檔案可能被截斷或損壞');
    if (firstVideo === null) return { durationSec, video: null, hasAudio };
    const video = resolutionOf(firstVideo);
    if (video === null) throw new Error(`讀不到影像串流的解析度：「${firstVideo.trim()}」`);
    return { durationSec, video, hasAudio };
}

/**
 * 讀 PNG 或 WebP 的寬高（只讀檔頭）。PNG 讀 IHDR；WebP 認三種檔頭：VP8（有損）、VP8L（無損）、VP8X（擴充）。
 *
 * @param {Buffer} buffer 圖片檔的位元組
 * @returns {{ type: 'png' | 'webp', width: number, height: number }}
 * @throws {TypeError} buffer 不是 Buffer
 * @throws {Error} 不是 PNG 也不是 WebP、檔被截斷（讀不到寬高）、認不得的 WebP 檔頭、寬高是 0
 */
export function readImageSize(buffer) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError(`readImageSize 只收 Buffer，收到 ${typeof buffer}`);
    const need = (length, what) => {
        if (buffer.length < length) throw new Error(`${what} 檔被截斷：只有 ${buffer.length} 位元組，讀不到寬高（至少要 ${length}）`);
    };
    const done = (type, width, height) => {
        if (width < 1 || height < 1) throw new Error(`${type} 的寬高是 ${width}x${height}，不合理`);
        return { type, width, height };
    };

    if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        need(24, 'PNG');
        if (buffer.toString('latin1', 12, 16) !== 'IHDR') throw new Error('PNG 的第一個區塊不是 IHDR，讀不到寬高');
        return done('png', buffer.readUInt32BE(16), buffer.readUInt32BE(20));
    }
    if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
        need(16, 'WebP');
        const kind = buffer.toString('latin1', 12, 16);
        if (kind === 'VP8 ') {
            need(30, 'WebP（VP8）');
            if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) throw new Error('WebP（VP8）的影格起始碼不對，讀不到寬高');
            return done('webp', buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff);
        }
        if (kind === 'VP8L') {
            need(25, 'WebP（VP8L）');
            if (buffer[20] !== 0x2f) throw new Error('WebP（VP8L）的簽章不對，讀不到寬高');
            const bits = buffer.readUInt32LE(21);
            return done('webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
        }
        if (kind === 'VP8X') {
            need(30, 'WebP（VP8X）');
            return done('webp', buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1);
        }
        throw new Error(`認不得的 WebP 檔頭 ${JSON.stringify(kind)}`);
    }
    throw new Error('不是 PNG 也不是 WebP（檔頭對不上），讀不到寬高');
}

/**
 * 每個語言要讀哪兩個原檔、寫哪兩個成品。
 *
 * @param {{ root: string, out: string, langs: string[] }} options root 是專案根目錄（原檔在 <root>/release/）、out 是成品資料夾、langs 是語言（結果照它的順序）
 * @returns {{ lang: string, videoIn: string, posterIn: string, videoOut: string, posterOut: string }[]}
 */
export function planMedia({ root, out, langs }) {
    return langs.map((lang) => ({
        lang,
        videoIn: path.join(root, 'release', `${VIDEO_PREFIX}-${lang}.mp4`),
        posterIn: path.join(root, 'release', `${POSTER_PREFIX}-${lang}.png`),
        videoOut: path.join(out, `hero-${lang}.mp4`),
        posterOut: path.join(out, `hero-poster-${lang}.webp`),
    }));
}

/**
 * 只拿掉音軌的 ffmpeg 參數：影像直接複製（不重新編碼，畫面與長度原樣）、只取第一條影像串流、mp4 的索引移到檔頭（網頁邊下載邊播）。
 *
 * @param {string} input 來源影片的路徑
 * @param {string} output 輸出影片的路徑（副檔名要是 .mp4）
 * @returns {string[]} 一個元素一個參數（不是 shell 字串，路徑裡有空白也沒關係）
 */
export function ffmpegArgs(input, output) {
    return ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', output];
}

/**
 * 轉成無損 WebP 的 cwebp 參數（-lossless、壓縮力道最大的 -z 9）：預覽圖是暗色的放射漸層，
 * 有損（q80、q90 加 -sharp_yuv 都試過）會出現一圈一圈的色階斷層，只有無損跟原圖逐像素相同；無損每張約 104～107 KB，約是原 PNG 的 30%。
 *
 * @param {string} input PNG 的路徑
 * @param {string} output WebP 的路徑
 * @returns {string[]} 一個元素一個參數
 */
export function cwebpArgs(input, output) {
    return ['-quiet', '-lossless', '-z', '9', input, '-o', output];
}

/**
 * 把每個語言量到的結果，整理成前端寫 width／height、選檔案用的 media.json 內容。
 *
 * @param {{ lang: string, videoOut: string, posterOut: string,
 *   video: { bytes: number, durationSec: number, width: number, height: number },
 *   poster: { bytes: number, width: number, height: number } }[]} results planMedia 的每一筆加上輸出檔量到的 video、poster（多的欄位不輸出）
 * @returns {Record<string, { video: { file: string, bytes: number, durationSec: number, width: number, height: number },
 *   poster: { file: string, bytes: number, width: number, height: number } }>}
 *   語言照 results 的順序、欄位順序固定；file 是檔名（不含資料夾）
 */
export function buildMediaJson(results) {
    const json = {};
    for (const { lang, videoOut, posterOut, video, poster } of results) {
        json[lang] = {
            video: { file: path.basename(videoOut), bytes: video.bytes, durationSec: video.durationSec, width: video.width, height: video.height },
            poster: { file: path.basename(posterOut), bytes: poster.bytes, width: poster.width, height: poster.height },
        };
    }
    return json;
}
