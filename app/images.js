// 圖片的寬高與裁切範圍：讀 public/images/images.json（後端 npm run images 寫的），不在程式裡寫死檔名與寬度 —— 後端重出圖時數字會變。
// 只在產生網頁時、伺服器端跑（讀檔用 node:fs）。
import fs from 'node:fs';
import path from 'node:path';

let table = null;

/**
 * 一張原圖轉出來的檔（images.json 的一筆）。
 *
 * @param {string} source 原圖的檔名（images.json 的鍵，例如 'ai-outline-zh.png'）
 * @returns {{ width: number, height: number, crop?: { x: number, y: number, width: number, height: number },
 *   files: Array<{ src: string, width: number, height: number }> }}
 *   width／height：原圖；crop：有裁切時，轉出來的檔是原圖的哪一塊（原圖的像素座標）；files：由小到大，src 從網站根目錄算
 * @throws {Error} images.json 讀不到、或沒有這一筆（產生網頁就該失敗，不然頁面上是一張 404 的圖）
 */
export function imageSet(source) {
    table ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'images', 'images.json'), 'utf8'));
    const entry = table[source];
    if (!entry) throw new Error(`public/images/images.json 沒有「${source}」：先跑 npm run images（見 README.md「圖片」）`);
    return {
        width: entry.width,
        height: entry.height,
        crop: entry.crop,
        files: entry.sizes.map((s) => ({ src: `/images/${s.file}`, width: s.width, height: s.height })),
    };
}
