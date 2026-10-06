// 12 更新紀錄：哪幾版列出來、哪些類型詞畫成類型標記。只在產生網頁時跑（伺服器端元件 import）。
import { CHANGELOG_FROM } from './site.js';

// 類型詞清單（strings/README.md「更新紀錄的類型標記」那三行，設計稿產生程式的 KINDS 是同一份；加詞三邊一起加）。
// 只有在這個語言的清單裡的 kind 才畫成左邊的螢光綠標記：後端（lib/changelog.js）把第一個冒號前面的字都當 kind，
// 沒有前綴的整句也會被切出一個 kind（例：「拿掉選取文字後浮出的按鈕：選起來之後…」），所以不能只看「有沒有 kind」。
const KINDS = {
    zh: ['修好', '修正', '新增', '改善', '改進', '調整', '變更', '拿掉', '移除', '更新', '安全性', '效能'],
    en: ['Fixed', 'Fix', 'New', 'Added', 'Improved', 'Changed', 'Removed', 'Updated', 'Security', 'Performance'],
    ja: ['修正', '不具合修正', '新機能', '追加', '改善', '改良', '変更', '削除', '廃止', '更新', 'セキュリティ', '性能'],
};

/**
 * 這個 kind 是不是這個語言認得的類型詞（完全相同；英文不分大小寫）。
 *
 * @param {'zh' | 'en' | 'ja'} lang 語言
 * @param {string} kind 後端給的 kind（冒號前面的字；沒有冒號是空字串）
 * @returns {boolean}
 */
export function knownKind(lang, kind) {
    if (!kind) return false;
    if (lang === 'en') return KINDS.en.some((word) => word.toLowerCase() === kind.toLowerCase());
    return KINDS[lang].includes(kind);
}

// 版本號 → 數字陣列（「1.0.10」比「1.0.9」新：一段一段照數字比，不照字典序）
const parts = (version) => version.split('.').map((n) => Number.parseInt(n, 10) || 0);

/**
 * 這一版要不要列（不比 CHANGELOG_FROM 舊）。
 *
 * @param {string} version 好的版本的版本號（lib/changelog.js 驗過格式）
 * @returns {boolean}
 */
export function listed(version) {
    const a = parts(version);
    const b = parts(CHANGELOG_FROM);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d > 0;
    }
    return true;
}
