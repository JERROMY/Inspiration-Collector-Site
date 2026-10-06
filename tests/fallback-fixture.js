// 4-b12（回退字型的產生器與係數掃描）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。介面細則見 tests/README.md「4-b12」。
//
// GOLDEN                tests/fixtures/fallback-fonts/golden.css：前端 2026-10-03 用的 app/styles/fallback-fonts.css 原樣複製（凍結的參考輸出，424 個 @font-face）
// ROLES / FACTORS       設定檔 scripts/fallback-fonts.config.json 該有的內容（照產生 GOLDEN 的那一次：字級×字重 8 組、微調係數 12 條）
// MICRO_ALLOWANCE       靜態檢查的例外：微調組（GOLDEN 檔尾那幾段）可以超出 85%～120% 的明確容許值，[family, 字重範圍, 下限, 上限]
// parseFaces(css)       測試自己讀 CSS：每個 @font-face 一筆 { family, weight, range, codes, sizeAdjust, ascent, descent, line }（不靠被測的程式）
// checkSizeAdjust(css)  靜態檢查：除了空白（unicode-range 只有 U+20），size-adjust 都要在 85%～120%；微調組照 MICRO_ALLOWANCE；回傳問題清單（空的＝過）
// decodeRange(text)     "U+2C, U+3A-3B" → [0x2c, 0x3a, 0x3b]
// playwrightDir()       環境變數 SITE_PLAYWRIGHT（Playwright 套件的資料夾）；沒設回 null（要瀏覽器的測試就 skip）
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES } from './helpers.js';
import { runScript, usageError, tmp, snapshot, stamp } from './b6-fixture.js';

export { runScript, usageError, tmp, snapshot, stamp };

export const GOLDEN = path.join(FIXTURES, 'fallback-fonts', 'golden.css');
export const BASE = 'Google Sans Flex Fallback';

export const ROLES = [
    { suffix: '', size: 14, opsz: 18, weights: [400, 500, 600] },
    { suffix: ' 14', size: 14, opsz: 'auto', weights: [400, 500, 600] },
    { suffix: ' 16', size: 16, opsz: 'auto', weights: [400, 500, 600] },
    { suffix: ' 18', size: 18, opsz: 'auto', weights: [400, 500] },
    { suffix: ' 24', size: 24, opsz: 'auto', weights: [500] },
    { suffix: ' 32', size: 32, opsz: 'auto', weights: [600] },
    { suffix: ' 48', size: 48, opsz: 'auto', weights: [600] },
    { suffix: ' 64', size: 64, opsz: 'auto', weights: [600] },
];

export const FACTORS = [
    { family: `${BASE} sub en`, from: `${BASE} 16`, weight: '100 449', k: 1.0264, spaceK: 0.7125 },
    { family: `${BASE} sub ja`, from: `${BASE} 16`, weight: '100 449', k: 1.0075 },
    { family: `${BASE} sub zh`, from: `${BASE} 16`, weight: '100 449', k: 1.0074 },
    { family: `${BASE} touch en`, from: `${BASE} 14`, weight: '100 449', k: 1.0138 },
    { family: `${BASE} touch en`, from: `${BASE} 14`, weight: '450 599', k: 1.01 },
    { family: `${BASE} touch en`, from: `${BASE} 14`, weight: '600 900', k: 0.9975 },
    { family: `${BASE} title en`, from: `${BASE} 32`, weight: '600 900', k: 0.9935, spaceK: 1.035 },
    { family: `${BASE} title zh`, from: `${BASE} 32`, weight: '600 900', k: 0.985 },
    { family: `${BASE} bulletin en`, from: `${BASE} 14`, weight: '100 449', k: 1.0082 },
    { family: `${BASE} bulletin zh`, from: `${BASE} 14`, weight: '100 449', k: 1.01 },
    { family: `${BASE} title48 en`, from: `${BASE} 48`, weight: '600 900', k: 0.9988 },
    { family: `${BASE} meta en`, from: `${BASE} 14`, weight: '100 449', k: 1.0025 },
];

// 微調組：基本組夾在 85%～120%，再整組乘 k，所以容許 [85×k, 120×k]（四捨五入到 0.01，兩邊各放 0.01）。
// 照 FACTORS 算出來、寫成明確的數字（GOLDEN 裡實際最低 84.12%（title zh）、最高 123.17%（sub en））
export const MICRO_ALLOWANCE = [
    [`${BASE} sub en`, '100 449', 87.23, 123.18],
    [`${BASE} sub ja`, '100 449', 85.63, 120.91],
    [`${BASE} sub zh`, '100 449', 85.62, 120.9],
    [`${BASE} touch en`, '100 449', 86.16, 121.67],
    [`${BASE} touch en`, '450 599', 85.84, 121.21],
    [`${BASE} touch en`, '600 900', 84.78, 119.71],
    [`${BASE} title en`, '600 900', 84.44, 119.23],
    [`${BASE} title zh`, '600 900', 83.71, 118.21],
    [`${BASE} bulletin en`, '100 449', 85.69, 120.99],
    [`${BASE} bulletin zh`, '100 449', 85.84, 121.21],
    [`${BASE} title48 en`, '600 900', 84.89, 119.87],
    [`${BASE} meta en`, '100 449', 85.2, 120.31],
];

export function decodeRange(text) {
    const codes = [];
    for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
        const m = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part);
        if (!m) throw new Error(`看不懂的 unicode-range：${part}`);
        const a = parseInt(m[1], 16);
        const b = m[2] ? parseInt(m[2], 16) : a;
        for (let c = a; c <= b; c += 1) codes.push(c);
    }
    return codes;
}

export function parseFaces(css) {
    const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...src.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
        const get = (name) => (new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(m[1]) || [])[1]?.trim();
        const family = (get('font-family') || '').replace(/^"|"$/g, '');
        const range = get('unicode-range') || '';
        return {
            family,
            weight: get('font-weight') || '',
            range,
            codes: range ? decodeRange(range) : [],
            sizeAdjust: Number((get('size-adjust') || '').replace('%', '')),
            ascent: get('ascent-override'),
            descent: get('descent-override'),
            line: m[0],
        };
    });
}

export function checkSizeAdjust(css) {
    const problems = [];
    const allowance = new Map(MICRO_ALLOWANCE.map(([family, weight, lo, hi]) => [`${family}|${weight}`, [lo, hi]]));
    const baseFamilies = new Set(ROLES.map((r) => `${BASE}${r.suffix}`));
    for (const face of parseFaces(css)) {
        if (face.range === 'U+20') continue;
        const key = `${face.family}|${face.weight}`;
        let lo = 85;
        let hi = 120;
        if (allowance.has(key)) [lo, hi] = allowance.get(key);
        else if (!baseFamilies.has(face.family)) {
            problems.push(`不認得的 family「${face.family}」（${face.weight}）：不是基本組，也不在微調組的容許清單裡`);
            continue;
        }
        if (!(face.sizeAdjust >= lo && face.sizeAdjust <= hi)) problems.push(`${face.family}（${face.weight}）${face.range}：size-adjust ${face.sizeAdjust}% 不在 ${lo}%～${hi}%`);
    }
    return problems;
}

export function playwrightDir() {
    return process.env.SITE_PLAYWRIGHT || null;
}

export function readGolden() {
    return fs.readFileSync(GOLDEN, 'utf8');
}
