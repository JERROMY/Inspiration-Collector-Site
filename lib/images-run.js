/**
 * images-run.js —— 圖片轉 WebP 的流程：把素材資料夾裡的 PNG、JPEG 各轉成幾個寬度的 WebP，寫一份 images.json 給前端讀寬高。
 *
 * 做事的順序（要出哪幾個寬度、讀來源圖的寬高、組 cwebp 的參數是 images.js 的事，這裡只管流程）：
 * 1. 先看來源有沒有圖（一張都沒有就停，輸出資料夾不動），再查兩張圖不會寫成同一個檔名，最後查 cwebp 跑得起來（先查輸入、再查工具）。
 * 2. 每張圖各自做：量原圖寬高 → 要出的每個尺寸，如果輸出已經在、比來源新、寬高對得上就沿用（重跑不重算），否則轉到系統暫存資料夾。
 *    一張壞了（讀不了、不是圖、cwebp 轉不出來）只壞那一張：記下原因，其餘照做。
 * 3. 把新轉好的 .webp 與 images.json 放進輸出資料夾，輸出資料夾裡不再需要的輸出檔（檔名是「<名字>-<寬>.webp」：來源拿掉了、尺寸變了、那張壞了）拿掉，
 *    其他檔（包括檔名不是這個樣子的 .webp）一律不動 —— --out 給錯資料夾，不會刪到別人的圖。
 *    一張都沒轉成功的話不動輸出資料夾（免得把舊的整批清空）。
 *
 * 設定檔（images-config.js）可以替某幾張圖指定裁切框與輸出寬度：有裁切框的圖，先照框裁（以原圖像素算）、再縮，寬度每個跟框寬取小的、不放大。
 * 設定先對上這次的素材檢查（框不能超出原圖；--config 指定的設定檔裡有、素材裡沒有的圖算錯），錯就在碰任何圖、查 cwebp 之前停。
 * 重跑不重算的判斷多看一件事：這張圖上次的裁切框（記在輸出資料夾的 images.json 裡）跟這次的設定一樣才沿用 —— 框只換了位置、寬高沒變，也要重算。
 *
 * 外部工具由呼叫端傳進來的 run 執行（命令用 spawnSync），所以這裡不需要為了測試開任何後門。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkConfigAgainstSources } from './images-config.js';
import { buildImagesJson, cwebpArgs, isLossless, isOutputName, isSourceName, outputName, readSourceSize, targetHeight, targetWidths } from './images.js';
import { readImageSize } from './media.js';
import { publish } from './publish.js';
import { checkTool, launched, reasonOf } from './tools.js';

const READ_REASONS = { EACCES: '沒有讀取權限', EPERM: '沒有讀取權限' };

/**
 * @param {string} from 來源資料夾
 * @returns {string[]} 這一層（不往下找）算來源圖的檔名，照預設的 sort() 排
 */
function listSources(from) {
    return fs.readdirSync(from)
        .filter((name) => isSourceName(name) && fs.statSync(path.join(from, name), { throwIfNoEntry: false })?.isFile())
        .sort();
}

/**
 * @param {string[]} names 來源檔名
 * @throws {Error} 兩張圖會寫成同一個輸出檔名（例如 a.png 與 a.jpg）；訊息列出是哪幾張
 */
function checkNoCollision(names) {
    const seen = new Map();
    for (const name of names) {
        const key = outputName(name, 0);
        if (seen.has(key)) throw new Error(`兩張圖會寫成同一個檔名：${seen.get(key)} 與 ${name}（輸出檔名是去掉副檔名之後接寬度；請改其中一張的名字）`);
        seen.set(key, name);
    }
}

/**
 * @param {{ x: number, y: number, width: number, height: number } | null | undefined} a 一個裁切框（沒有是 null 或 undefined）
 * @param {{ x: number, y: number, width: number, height: number } | null | undefined} b 另一個
 * @returns {boolean} 兩個框一樣（都沒有也算一樣）
 */
function sameCrop(a, b) {
    if (!a || !b) return !a && !b;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * @param {string} out 輸出資料夾
 * @returns {Record<string, { crop?: object }>} 上次寫的 images.json；沒有或讀不了是空物件
 */
function readPrevious(out) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(out, 'images.json'), 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
        return {};
    }
}

/**
 * @param {string} file 輸出的 .webp
 * @param {{ width: number, height: number }} want 預期的寬高
 * @param {number} sourceMtimeMs 來源圖的修改時間
 * @returns {{ file: string, width: number, height: number, bytes: number } | null}
 *   輸出已經在、不比來源舊、是 WebP 而且寬高對得上就回它的資料（可以沿用）；否則 null（要重算）
 */
function reusable(file, want, sourceMtimeMs) {
    try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.mtimeMs < sourceMtimeMs) return null;
        const size = readImageSize(fs.readFileSync(file));
        if (size.type !== 'webp' || size.width !== want.width || size.height !== want.height) return null;
        return { file: path.basename(file), width: size.width, height: size.height, bytes: stat.size };
    } catch {
        return null;
    }
}

/**
 * 轉一個尺寸到暫存資料夾，驗證輸出。
 *
 * @param {{ run: Function, cwebp: string }} tools 執行器、cwebp
 * @param {string} input 來源圖
 * @param {string} output 暫存的輸出路徑（.webp）
 * @param {{ lossless: boolean, crop: object | null, resize: { width: number, height: number } | null, width: number, height: number }} job 無損或有損、裁切框（沒有是 null）、要縮成的寬高（不縮是 null）、預期的輸出寬高
 * @returns {Promise<{ file: string, width: number, height: number, bytes: number }>}
 * @throws {Error} cwebp 轉不出來、沒寫出檔、輸出不是 WebP 或寬高不對
 */
async function convert({ run, cwebp }, input, output, job) {
    const res = launched(await run(cwebp, cwebpArgs(input, output, job)), 'cwebp', cwebp);
    if (res.status !== 0) {
        // cwebp 的錯誤訊息有好幾行，壓成一行（壞檔清單一張一行）
        throw new Error(`cwebp 轉不出來（結束碼 ${res.status}）：${reasonOf(res).replace(/\s+/g, ' ')}`);
    }
    if (fs.statSync(output, { throwIfNoEntry: false })?.isFile() !== true) throw new Error('cwebp 結束碼是 0，卻沒有寫出檔');
    const made = fs.readFileSync(output);
    let size;
    try {
        size = readImageSize(made);
    } catch (err) {
        throw new Error(`輸出不是 WebP，或讀不出寬高：${err.message}`, { cause: err });
    }
    if (size.type !== 'webp' || size.width !== job.width || size.height !== job.height) {
        throw new Error(`輸出的寬高不對：要 ${job.width}x${job.height}，得到 ${size.width}x${size.height}`);
    }
    return { file: path.basename(output), width: size.width, height: size.height, bytes: made.length };
}

/**
 * 做一張圖：量原圖、決定要出哪些尺寸、沿用或轉檔。
 *
 * @param {{ run: Function, cwebp: string, from: string, out: string, tmpDir: string, config: object, previous: object }} context
 *   執行器、cwebp、來源資料夾、輸出資料夾、暫存資料夾、設定檔（每張圖的裁切框與寬度）、上次寫的 images.json
 * @param {string} name 來源檔名
 * @returns {Promise<{ image: { name: string, width: number, height: number, crop: object | null, sizes: object[] }, fresh: string[] }>}
 *   image 是 images.json 的一筆；fresh 是新轉到暫存資料夾的檔名（沿用的不在裡面）
 * @throws {Error} 這張圖壞了：讀不了、是空的、讀不出寬高、轉不出來；訊息是一句中文原因
 */
async function makeImage(context, name) {
    const { from, out, tmpDir, config, previous } = context;
    const file = path.join(from, name);
    let buffer;
    try {
        buffer = fs.readFileSync(file);
    } catch (err) {
        throw new Error(`讀不了（${READ_REASONS[err.code] ?? err.code ?? err.message}）`, { cause: err });
    }
    if (buffer.length === 0) throw new Error('是空檔案（0 位元組）');
    let source;
    try {
        source = readSourceSize(buffer, name);
    } catch (err) {
        throw new Error(`讀不出寬高，不是有效的圖：${err.message}`, { cause: err });
    }
    const sourceMtimeMs = fs.statSync(file).mtimeMs;
    const lossless = isLossless(name);
    const crop = config[name]?.crop ?? null;
    // 要縮的基準：有裁切框就是框（看得到的那一塊），沒有就是整張原圖
    const base = crop ?? source;
    // 上次的框跟這次一樣才沿用舊檔；框只換了位置、寬高沒變，檔名與寬高都對得上，只有這一關擋得住
    const sameAsBefore = sameCrop(previous[name]?.crop, crop) && (crop === null || previous[name] !== undefined);
    const sizes = [];
    const fresh = [];
    for (const width of targetWidths(base.width, config[name]?.widths)) {
        const height = targetHeight(base.width, base.height, width);
        const kept = sameAsBefore ? reusable(path.join(out, outputName(name, width)), { width, height }, sourceMtimeMs) : null;
        if (kept) {
            sizes.push(kept);
            continue;
        }
        const resize = width === base.width ? null : { width, height };
        sizes.push(await convert(context, file, path.join(tmpDir, outputName(name, width)), { lossless, crop, resize, width, height }));
        fresh.push(outputName(name, width));
    }
    return { image: { name, width: source.width, height: source.height, crop, sizes }, fresh };
}

/**
 * 把素材資料夾裡的 PNG、JPEG 轉成 WebP（每張 640 與 1280 兩個寬度，不夠寬就只出原寬、不放大），放進 out，並寫 images.json。
 *
 * @param {object} options
 * @param {string} options.from 素材資料夾（這一層的 .png、.jpg、.jpeg；其他檔略過）
 * @param {string} options.out 輸出資料夾（<檔名>-<寬>.webp 與 images.json；不存在會建；裡面別的檔不動）
 * @param {Record<string, { crop?: object, widths?: number[] }>} [options.config] 每張圖的裁切框與寬度（images-config.js 檢查過的）；沒給就都照舊（640、1280，不裁切）
 * @param {boolean} [options.strictConfig] config 是不是使用者明確指定的：是的話，設定裡有、素材裡沒有的圖算錯；不是（預設的設定檔）就只警告
 * @param {string} [options.cwebp] cwebp 的路徑或指令，預設 'cwebp'
 * @param {(command: string, args: string[]) => ({ status: number | null, stdout?: string, stderr?: string, error?: Error } | Promise<object>)} options.run
 *   執行外部工具，回傳 spawnSync 的形狀
 * @returns {Promise<{ images: { name: string, width: number, height: number, crop: object | null, sizes: object[] }[], bad: { name: string, reason: string }[], warnings: string[], converted: number, reused: number, totalBytes: number }>}
 *   images 是做好的（照來源檔名排）、bad 是壞掉的每一張與原因、warnings 是只提醒的話（預設的設定檔裡有、這次素材裡沒有的圖）、
 *   converted 是這次轉了幾個檔、reused 是沿用了幾個、totalBytes 是 images 裡所有輸出檔的位元組合計
 * @throws {Error} 來源裡沒有圖、兩張圖會寫成同一個檔名、設定對不上素材（框超出原圖、指定的設定檔裡有素材沒有的圖）、cwebp 跑不起來、一張都沒轉成功、放進 out 失敗；這幾種 out 都不動。
 *   只有一部分圖壞掉不丟錯：好的照做，壞的在 bad 裡，由呼叫的人決定結束碼
 */
export async function runImages({ from, out, cwebp = 'cwebp', run, config = {}, strictConfig = false }) {
    const names = listSources(from);
    if (names.length === 0) throw new Error(`來源資料夾裡沒有圖片（要有 .png、.jpg、.jpeg；其他檔略過）：${from}`);
    checkNoCollision(names);
    const sources = new Map(names.map((name) => [name, null]));
    for (const name of names.filter((item) => config[item]?.crop)) {
        try {
            sources.set(name, readSourceSize(fs.readFileSync(path.join(from, name)), name));
        } catch {
            // 讀不出來的圖，之後做那一張時會被記成壞檔；框超不超出就不查了
        }
    }
    const { problems, warnings } = checkConfigAgainstSources(config, sources, strictConfig);
    if (problems.length > 0) throw new Error(`設定檔有 ${problems.length} 個地方要修，輸出資料夾沒有動：\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
    await checkTool(run, 'cwebp', cwebp);
    const previous = readPrevious(out);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-images-'));
    try {
        const images = [];
        const bad = [];
        const fresh = [];
        for (const name of names) {
            try {
                const done = await makeImage({ run, cwebp, from, out, tmpDir, config, previous }, name);
                images.push(done.image);
                fresh.push(...done.fresh);
            } catch (err) {
                bad.push({ name, reason: err.message });
            }
        }
        if (images.length === 0) throw new Error(`一張圖都沒轉成功，輸出資料夾沒有動：\n${bad.map((item) => `  ${item.name}：${item.reason}`).join('\n')}`);

        fs.writeFileSync(path.join(tmpDir, 'images.json'), JSON.stringify(buildImagesJson(images), null, 2) + '\n');
        const keep = new Set(images.flatMap((image) => image.sizes.map((size) => size.file)));
        const existing = fs.statSync(out, { throwIfNoEntry: false })?.isDirectory() ? fs.readdirSync(out) : [];
        const stale = existing.filter((file) => isOutputName(file) && !keep.has(file));
        publish(tmpDir, out, [...fresh, 'images.json'], stale);

        const sizes = images.flatMap((image) => image.sizes);
        return { images, bad, warnings, converted: fresh.length, reused: sizes.length - fresh.length, totalBytes: sizes.reduce((sum, size) => sum + size.bytes, 0) };
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
