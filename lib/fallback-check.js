/**
 * fallback-check.js —— 回退字型 CSS 的靜態檢查：除了空白，每個 size-adjust 都要在 85%～120%。純函式，不碰檔案。
 *
 * 基本組（roles 的 family）一定夾在 85%～120%。微調組（factors 的 family）是基本組整組乘上係數 k，所以容許範圍是 [85×k, 120×k]：
 * 四捨五入到 0.01，兩邊各放寬 0.01（size-adjust 輸出是兩位小數）。空白（unicode-range 只有 U+20）不夾，不檢查。
 * family 不是基本組、也不是微調組的，一律抓到（有人手加了不認得的組）。
 */
import { BASE_FAMILY } from './fallback-fonts.js';

const LOW = 85;
const HIGH = 120;
const SLACK = 0.01;

/**
 * @param {number} value 一個數字
 * @returns {number} 四捨五入到小數 2 位
 */
function cents(value) {
    return Math.round(value * 100) / 100;
}

/**
 * @param {string} css 回退字型的 CSS
 * @param {{ roles: Array<{ suffix: string }>, factors: Array<{ family: string, weight: string, k: number }> }} config 設定檔的內容（字級×字重與微調係數）
 * @returns {string[]} 問題清單，每個問題一句中文（講 family、字重、size-adjust 與容許範圍）；空的就是全部過了
 */
export function checkFallbackCss(css, { roles, factors }) {
    const bases = new Set(roles.map(({ suffix }) => `${BASE_FAMILY}${suffix}`));
    const allowed = new Map(factors.map(({ family, weight, k }) => [`${family}|${weight}`, [cents(LOW * k) - SLACK, cents(HIGH * k) + SLACK]]));
    const problems = [];
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const get = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(match[1])?.[1].trim();
        const family = (get('font-family') ?? '').replace(/^"|"$/g, '');
        const weight = get('font-weight') ?? '';
        const range = get('unicode-range') ?? '';
        if (range === 'U+20') continue;
        const key = `${family}|${weight}`;
        const [low, high] = allowed.get(key) ?? (bases.has(family) ? [LOW, HIGH] : [null, null]);
        if (low === null) {
            problems.push(`不認得的 family「${family}」（字重 ${weight}）：不是基本組，也不在微調組的清單裡`);
            continue;
        }
        const sizeAdjust = Number((get('size-adjust') ?? '').replace('%', ''));
        if (!(sizeAdjust >= low && sizeAdjust <= high)) {
            problems.push(`${family}（字重 ${weight}）${range}：size-adjust ${get('size-adjust')} 不在 ${low}%～${high}% 以內`);
        }
    }
    return problems;
}
