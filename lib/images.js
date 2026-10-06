/**
 * images.js —— 圖片轉 WebP 的純函式：哪些檔算來源、要出哪幾個寬度、讀來源圖的寬高、組 cwebp 的參數、組 images.json。
 *
 * 這裡一個外部工具都不開、一個檔都不讀不寫（那是 images-run.js 的事），收字串或位元組、給資料；錯誤一律丟 Error 並講出缺什麼。
 *
 * - isSourceName   檔名算不算來源圖（.png、.jpg、.jpeg）
 * - targetWidths   原圖（或裁切框）的寬 → 要出哪幾個寬度（預設 640、1280，設定檔可以換；不放大）
 * - targetHeight   縮到某個寬度時的高（照原圖或裁切框的比例）
 * - outputName     輸出檔名
 * - isOutputName   檔名是不是我們這個命令會產的輸出檔（<名字>-<寬>.webp）
 * - isLossless     這張圖用無損還是有損：照副檔名（PNG 無損、JPEG 有損）
 * - readSourceSize PNG／JPEG 的位元組 → { width, height }（只讀檔頭，不解碼）
 * - cwebpArgs      轉 WebP 的 cwebp 參數（可以先裁切、再縮）
 * - buildImagesJson 轉好的結果 → 前端讀的 images.json 內容（有裁切的圖多一個 crop）
 */
import { readImageSize } from './media.js';

const WIDTHS = [640, 1280];
const SOURCE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
// 有損的品質：量過的（見 README「圖片」一節），PSNR 46.8 dB（超過 45 dB 肉眼分不出差別）
const LOSSY_QUALITY = '85';
// SOF 之前的 JPEG 標記：只有這幾種有「寬高」；C4（DHT）、C8、CC（DAC）長得像但不是
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * @param {string} name 檔名（不含資料夾）
 * @returns {boolean} 是不是來源圖：副檔名是 .png、.jpg、.jpeg（大小寫都算），而且不是 . 開頭的檔
 */
export function isSourceName(name) {
    if (name.startsWith('.')) return false;
    const dot = name.lastIndexOf('.');
    return dot > 0 && SOURCE_EXTENSIONS.includes(name.slice(dot).toLowerCase());
}

/**
 * @param {number} width 原圖的寬；這張圖有裁切框的話，是框的寬（看得到的那一塊）
 * @param {number[]} [widths] 想要的寬度，預設 640、1280（設定檔裡這張圖的 widths）
 * @returns {number[]} 要出的寬度，由小到大、不重複：想要的每個寬度各取「它」與 width 之中小的那個（不放大）
 */
export function targetWidths(width, widths = WIDTHS) {
    return [...new Set(widths.map((target) => Math.min(target, width)))].sort((a, b) => a - b);
}

/**
 * @param {number} width 原圖的寬（有裁切框的話是框的寬）
 * @param {number} height 原圖的高（有裁切框的話是框的高）
 * @param {number} to 要縮成的寬
 * @returns {number} 縮成寬 to 時的高：照原圖（或裁切框）的比例、四捨五入、至少 1
 */
export function targetHeight(width, height, to) {
    return Math.max(1, Math.round((height * to) / width));
}

/**
 * @param {string} sourceName 來源檔名（含副檔名）
 * @param {number} width 輸出的寬
 * @returns {string} 「<來源檔名去掉副檔名>-<寬>.webp」
 */
export function outputName(sourceName, width) {
    return `${sourceName.slice(0, sourceName.lastIndexOf('.'))}-${width}.webp`;
}

/**
 * @param {string} name 檔名（不含資料夾）
 * @returns {boolean} 是不是這個命令產的輸出檔：「<名字>-<寬>.webp」。重跑時只准刪這種檔，輸出資料夾裡別的 .webp（例如給錯成 public/media）不動
 */
export function isOutputName(name) {
    return /^.+-\d+\.webp$/.test(name);
}

/**
 * 介面截圖是 PNG：字的邊緣與暗色的漸層用有損會有雜訊與色階斷層，用無損。
 * 照片是 JPEG：來源本來就是有損，轉無損會比原檔大好幾倍（量過約 3 倍），用有損。
 *
 * @param {string} sourceName 來源檔名（含副檔名）
 * @returns {boolean} 用不用無損（照副檔名：.png 是、其他否）
 */
export function isLossless(sourceName) {
    return sourceName.toLowerCase().endsWith('.png');
}

/**
 * 讀 JPEG 的寬高：從檔頭一段一段跳，找到 SOF 那一段就讀（只讀檔頭，不解碼）。
 *
 * @param {Buffer} buffer JPEG 檔的位元組
 * @returns {{ width: number, height: number }}
 * @throws {Error} 不是 JPEG（沒有 FFD8）、被截斷或寫壞（找不到 SOF）、寬高是 0
 */
function jpegSize(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('不是 JPEG（沒有 FFD8 檔頭）');
    let at = 2;
    while (at + 4 <= buffer.length) {
        if (buffer[at] !== 0xff) throw new Error('JPEG 的區段標記寫壞了');
        const marker = buffer[at + 1];
        if (marker === 0xff) {
            at += 1;
            continue;
        }
        if (marker === 0xd9) break;
        const length = buffer.readUInt16BE(at + 2);
        if (SOF_MARKERS.has(marker)) {
            if (at + 9 > buffer.length) throw new Error('JPEG 被截斷：讀不到寬高');
            const height = buffer.readUInt16BE(at + 5);
            const width = buffer.readUInt16BE(at + 7);
            if (width < 1 || height < 1) throw new Error(`JPEG 的寬高是 ${width}x${height}，不合理`);
            return { width, height };
        }
        at += 2 + length;
    }
    throw new Error('JPEG 被截斷或寫壞：找不到寬高');
}

/**
 * @param {Buffer} buffer 圖片檔的位元組
 * @param {string} sourceName 來源檔名（看副檔名決定照 PNG 還是 JPEG 讀）
 * @returns {{ width: number, height: number }} 原圖的寬高
 * @throws {Error} 讀不出來（不是那種圖、被截斷、寬高是 0）
 */
export function readSourceSize(buffer, sourceName) {
    if (isLossless(sourceName)) {
        const { type, width, height } = readImageSize(buffer);
        if (type !== 'png') throw new Error(`副檔名是 .png，內容卻是 ${type}`);
        return { width, height };
    }
    return jpegSize(buffer);
}

/**
 * 轉 WebP 的 cwebp 參數。無損用 -lossless -z 9（壓得最緊；量過比 -z 6 小 0%～45%，只是慢，一張約 1～3 秒）；有損用 -q 85 -m 6 -sharp_yuv。
 * 都加 -mt（多執行緒：量過輸出的位元組跟不加完全相同，速度約快一倍；沒有多核心也只是不加速）。
 * 有裁切框的話先給 -crop x y 寬 高（以原圖像素算），cwebp 先裁再縮。要縮的時候給 -resize 寬 高（兩個都給，高照原圖或框的比例算好）；
 * 輸出跟原圖（或框）一樣寬就不縮（不重新取樣）。不帶中繼資料（cwebp 預設）。
 *
 * @param {string} input 來源圖的路徑
 * @param {string} output WebP 的路徑
 * @param {{ lossless: boolean, crop?: { x: number, y: number, width: number, height: number } | null, resize: { width: number, height: number } | null }} options
 *   無損或有損；裁切框（沒有是 null 或不給）；要縮成的寬高（不縮是 null）
 * @returns {string[]} 一個元素一個參數（不是 shell 字串，路徑裡有空白也沒關係）
 */
export function cwebpArgs(input, output, { lossless, crop = null, resize }) {
    return [
        '-quiet', '-mt',
        ...(lossless ? ['-lossless', '-z', '9'] : ['-q', LOSSY_QUALITY, '-m', '6', '-sharp_yuv']),
        ...(crop ? ['-crop', String(crop.x), String(crop.y), String(crop.width), String(crop.height)] : []),
        ...(resize ? ['-resize', String(resize.width), String(resize.height)] : []),
        input, '-o', output,
    ];
}

/**
 * @param {{ name: string, width: number, height: number, crop?: { x: number, y: number, width: number, height: number } | null, sizes: { file: string, width: number, height: number, bytes: number }[] }[]} images
 *   每張來源圖一筆：來源檔名（含副檔名）、原圖的寬高、裁切框（沒有裁切是 null 或不給）、輸出的每個尺寸（已經照寬度由小到大）
 * @returns {Record<string, { width: number, height: number, crop?: { x: number, y: number, width: number, height: number }, sizes: { file: string, width: number, height: number, bytes: number }[] }>}
 *   鍵是來源檔名，照預設的 sort()（UTF-16 碼的順序，不是 localeCompare）；欄位順序固定：width、height（原圖的）、crop（有裁切才有）、sizes
 */
export function buildImagesJson(images) {
    const json = {};
    for (const image of [...images].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        json[image.name] = {
            width: image.width,
            height: image.height,
            ...(image.crop ? { crop: { x: image.crop.x, y: image.crop.y, width: image.crop.width, height: image.crop.height } } : {}),
            sizes: image.sizes.map(({ file, width, height, bytes }) => ({ file, width, height, bytes })),
        };
    }
    return json;
}
