import fs from 'node:fs';
import path from 'node:path';
import { HTML_LANG } from '../../seo.js';

// 產生網頁時就寫成檔（out/<語言>/typing.json），一個語言一份：07「AI 開始打字」要打的字。字不放進 HTML（網頁會變大），public/typing.js 捲到 07 才抓
export const dynamic = 'force-static';

export function generateStaticParams() {
    return Object.keys(HTML_LANG).map((lang) => ({ lang }));
}

// 靜態大綱圖上那一段在 data/agent.<語言>.json 的 outline 裡是哪幾行（行號從 1 起，含頭尾）：教學片第 13 章報告卡（tutorial/13-ai.js 的 REPORT.first）。
// 教學片重算、這幾行換了，跟著改這裡與 tests-site/fixtures/typing-f9.json
const RANGES = {
    zh: [[1, 4], [22, 30]],
    en: [[1, 1], [11, 13], [135, 135], [137, 137], [139, 142]],
    ja: [[1, 1], [4, 4], [37, 44]],
};
const MAX_LINES = 12;

// 圖上亮起來的行（螢光綠字、左邊直條；照 tutorial/13-ai.js 的 REPORT.firstHot）與圖上折成兩行的行（行號 → 第二列開頭的字；
// 報告卡的欄比框寬，其餘長行往右被裁掉、不折）。打字層照這兩樣排，停住的樣子才跟圖一樣
const HOT = {
    zh: (line) => line.includes('〔素〕') && !line.includes('標示'),
    en: (line) => /^\|.*\[S\d\]/.test(line),
    ja: (line) => line.includes('〔資料〕') && !line.includes('凡例'),
};
const WRAPS = {
    zh: { 26: '點。〔素〕鯨落', 27: '生細菌供養', 30: '機制而不重複' },
    en: { 141: 'global variable' },
    ja: {},
};

/**
 * 照教學片 tutorial/engine.js 的 fileCard 挑行（回傳 { n: 原檔行號, line }）：範圍裡的行照原檔順序，`<!--` 開頭的不算、空行照留、有字的最多 12 行，行與行之間 \n。
 *
 * @param {string} outline 整份大綱
 * @param {number[][]} ranges [起, 迄] 行號
 * @returns {string}
 */
function excerpt(outline, ranges) {
    const lines = outline.split('\n');
    const out = [];
    let filled = 0;
    for (const [from, to] of ranges) {
        for (let n = from; n <= to && filled < MAX_LINES; n += 1) {
            const line = lines[n - 1];
            if (line === undefined || line.startsWith('<!--')) continue;
            out.push({ n, line });
            if (line.trim()) filled += 1;
        }
    }
    return out;
}

/**
 * typing.json 的內容：text＝要打的字；hot＝第幾行（從 0 起，節錄裡的行）是亮的；wraps＝在第幾個字（Array.from 切的）前面折到下一列。
 * 折的字找不到就讓產生網頁失敗（教學片重算過，要回來對一次圖）。
 *
 * @param {string} outline 整份大綱
 * @param {'zh' | 'en' | 'ja'} lang
 */
function typing(outline, lang) {
    const picked = excerpt(outline, RANGES[lang]);
    const hot = [];
    const wraps = [];
    let at = 0;
    picked.forEach(({ n, line }, i) => {
        if (HOT[lang](line)) hot.push(i);
        const head = WRAPS[lang][n];
        if (head) {
            const cut = line.indexOf(head);
            if (cut < 1) throw new Error(`typing.json（${lang}）：第 ${n} 行找不到要折的「${head}」`);
            wraps.push(at + Array.from(line.slice(0, cut)).length);
        }
        at += Array.from(line).length + 1;
    });
    return { text: picked.map((p) => p.line).join('\n'), hot, wraps };
}

/**
 * @param {Request} request
 * @param {{ params: Promise<{ lang: 'zh' | 'en' | 'ja' }> }} context
 */
export async function GET(request, { params }) {
    const { lang } = await params;
    const agent = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', `agent.${lang}.json`), 'utf8'));
    return new Response(JSON.stringify(typing(agent.outline, lang)), { headers: { 'Content-Type': 'application/json' } });
}
