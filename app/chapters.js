// 教學影片的 16 章（後端 npm run chapters 寫的 data/chapters.<語言>.json：{ id, name, desc, start, end }，秒）。只在產生網頁時、伺服器端跑。
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {'zh' | 'en' | 'ja'} lang
 * @returns {Array<{ id: string, name: string, desc: string, start: number, end: number }>}
 * @throws {Error} 檔案讀不到、不是 JSON（產生網頁就該失敗，不然 09 是空的）
 */
export function loadChapters(lang) {
    const file = path.join(process.cwd(), 'data', `chapters.${lang}.json`);
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        throw new Error(`data/chapters.${lang}.json 讀不到或不是 JSON（先跑 npm run chapters，見 README.md）：${err.message}`);
    }
}

/** 秒 → m:ss */
export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
