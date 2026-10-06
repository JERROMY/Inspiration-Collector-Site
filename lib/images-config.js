/**
 * images-config.js —— 圖片設定檔（scripts/images.config.json）：每張圖要不要裁切、要出哪幾個寬度。純函式，不讀檔。
 *
 * 設定檔是一個物件：鍵是來源圖的檔名（含副檔名），值是 { crop?, widths? }。
 *   crop    裁切框 { x, y, width, height }，以原圖像素算（左上角 x、y，往右 width、往下 height）：先裁出看得到的那一塊，再縮。
 *   widths  想要的輸出寬度，每個跟「框寬（沒裁切就是原圖寬）」取小的、不放大；沒寫就是 640、1280。
 * 沒寫的圖照舊。設定寫錯，一律在碰任何圖之前擋下，並講出是哪張圖。
 */

const BOX_KEYS = ['x', 'y', 'width', 'height'];

/**
 * @param {unknown} value 任何值
 * @returns {boolean} 是不是一般物件（不是陣列、不是 null）
 */
function isObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * @param {string} name 圖的檔名
 * @param {unknown} crop 設定檔裡的 crop
 * @returns {{ x: number, y: number, width: number, height: number }} 檢查過的框（欄位照 x、y、width、height 的順序）
 * @throws {Error} 不是物件、缺欄位、多欄位、不是整數、x／y 是負數、寬高小於 1（訊息講出是哪張圖與哪個欄位）
 */
function readCrop(name, crop) {
    if (!isObject(crop)) throw new Error(`設定檔裡 ${name} 的 crop 要是物件 { x, y, width, height }`);
    const extra = Object.keys(crop).find((key) => !BOX_KEYS.includes(key));
    if (extra !== undefined) throw new Error(`設定檔裡 ${name} 的 crop 多了欄位 ${extra}（只認 ${BOX_KEYS.join('、')}）`);
    const box = {};
    for (const key of BOX_KEYS) {
        const value = crop[key];
        if (value === undefined) throw new Error(`設定檔裡 ${name} 的 crop 缺 ${key}`);
        if (!Number.isInteger(value)) throw new Error(`設定檔裡 ${name} 的 crop.${key} 要是整數，收到 ${JSON.stringify(value)}`);
        if ((key === 'x' || key === 'y') && value < 0) throw new Error(`設定檔裡 ${name} 的 crop.${key} 不能是負數，收到 ${value}`);
        if ((key === 'width' || key === 'height') && value < 1) throw new Error(`設定檔裡 ${name} 的 crop.${key} 要大於 0，收到 ${value}`);
        box[key] = value;
    }
    return box;
}

/**
 * @param {string} name 圖的檔名
 * @param {unknown} widths 設定檔裡的 widths
 * @returns {number[]} 檢查過的寬度（照設定檔的順序）
 * @throws {Error} 不是有東西的陣列、或有不是正整數的（訊息講出是哪張圖）
 */
function readWidths(name, widths) {
    if (!Array.isArray(widths) || widths.length === 0 || !widths.every((width) => Number.isInteger(width) && width > 0)) {
        throw new Error(`設定檔裡 ${name} 的 widths 要是有東西的陣列，每個都是正整數（例如 [640, 1280]），收到 ${JSON.stringify(widths)}`);
    }
    return [...widths];
}

/**
 * @param {string} text 設定檔的內容
 * @returns {Record<string, { crop?: { x: number, y: number, width: number, height: number }, widths?: number[] }>} 檢查過的設定：鍵是來源圖檔名
 * @throws {Error} 不是 JSON、不是物件、某一張圖的設定不對（訊息是中文，講出是哪張圖、哪個欄位）
 */
export function parseImagesConfig(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error(`設定檔不是 JSON（${err.message.replace(/\s+/g, ' ')}）`, { cause: err });
    }
    if (!isObject(data)) throw new Error('設定檔要是物件：鍵是來源圖的檔名，值是 { crop, widths }');
    const config = {};
    for (const [name, entry] of Object.entries(data)) {
        if (!isObject(entry)) throw new Error(`設定檔裡 ${name} 要是物件 { crop, widths }`);
        const extra = Object.keys(entry).find((key) => key !== 'crop' && key !== 'widths');
        if (extra !== undefined) throw new Error(`設定檔裡 ${name} 多了欄位 ${extra}（只認 crop、widths）`);
        config[name] = {
            ...(entry.crop === undefined ? {} : { crop: readCrop(name, entry.crop) }),
            ...(entry.widths === undefined ? {} : { widths: readWidths(name, entry.widths) }),
        };
    }
    return config;
}

/**
 * 設定檔對上這次的素材：裁切框不能超出原圖；設定檔裡有、素材裡沒有的圖，用 --config 明確指定的設定檔算錯，預設的設定檔只警告。
 *
 * @param {Record<string, { crop?: { x: number, y: number, width: number, height: number } }>} config parseImagesConfig 的結果
 * @param {Map<string, { width: number, height: number } | null>} sources 這次素材裡每張來源圖的原圖寬高；讀不出來的是 null（那一張之後自己會被報壞檔，這裡不查框）
 * @param {boolean} strict 設定檔是不是使用者明確指定的（--config）
 * @returns {{ problems: string[], warnings: string[] }} 要修的（每個一行）與只是提醒的（每個一行）
 */
export function checkConfigAgainstSources(config, sources, strict) {
    const problems = [];
    const warnings = [];
    for (const [name, { crop }] of Object.entries(config)) {
        if (!sources.has(name)) {
            (strict ? problems : warnings).push(`設定檔裡的 ${name} 在素材資料夾裡找不到${strict ? '' : '（這次略過它的設定）'}`);
            continue;
        }
        const size = sources.get(name);
        if (crop && size && (crop.x + crop.width > size.width || crop.y + crop.height > size.height)) {
            problems.push(`設定檔裡 ${name} 的裁切框 { x: ${crop.x}, y: ${crop.y}, width: ${crop.width}, height: ${crop.height} } 超出原圖（原圖寬 ${size.width}、高 ${size.height}）`);
        }
    }
    return { problems, warnings };
}
