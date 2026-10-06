// F4.6b 寬度掃描：字型晚到時整頁跳多少，十二種寬度以外也要量。讀 out/（真的內容），真的開瀏覽器。
//
// 為什麼要掃：回退字型與網頁字型的寬度比會隨字級、字重變（一般字重 12px 窄 3%、18～24px 寬 5%……），一個 size-adjust 蓋不住；
// 一段字只要剛好卡在換行邊界，任何寬度都可能多一行或少一行，底下整頁跟著移。只量十二種寬度，量到的是剛好調好的那幾個。
//
// 量法：page-helpers.js 的 measureCls（跟 F4.6 一樣：這一頁的 .woff2 扣到回退字型畫出第一次畫面才放，不扣 hadRecentInput）；
// 只有手指 isMobile＋hasTouch、高 844，有滑鼠高 900。好幾頁同時量（每頁自己扣字型）。
//
// 量什麼（三語）：
//   F4.6b 常見寬度 ≤ 0.02：十二種寬度加手機寬度 344、393、402、412、428、440，只有手指與有滑鼠都量。
//   F4.6b 掃描 ≤ 0.1（規格書 §9）：280～480 每 4px 只有手指、488～1456 每 16px 有滑鼠、平板只有手指 640～1366 每 32px（加 1366）。
//   F4.6b 迴歸清單（2026-10-03 另外每 4～16px 掃、壞的地方再每 1px 量到會壞的寬度，每一個一條）：上面兩級的門檻照用 —— 寬度在常見寬度裡 ≤ 0.02，其餘 ≤ 0.1；
//        480 以下量只有手指、以上量有滑鼠（當初掃的時候就是這樣）；寫成 [寬度, 'both'] 的兩種都量（中文 353：只有手指 0.2583、有滑鼠 0.2451，公告條標題 44→49 高），
//        [寬度, 'desktop'] 只量有滑鼠、[寬度, 'touch'] 只量只有手指；第三個值是這一個寬度自己的門檻（英文 290 用 0.02：沒調時只有 0.0259，0.1 守不住）。
//   紅的時候寫語言、寬度、模式、CLS、位移最大的三個元素。每一級量完印一行 `# F4.6b …`（全部的值）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.6b"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';
import { WIDTHS, measureCls, topMoved, pool } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

const PHONES = [344, 393, 402, 412, 428, 440];
const COMMON = [...WIDTHS, ...PHONES].sort((a, b) => a - b);
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const SWEEP = [...range(280, 480, 4).map((w) => [w, true]), ...range(488, 1456, 16).map((w) => [w, false]), ...[...range(640, 1366, 32), 1366].map((w) => [w, true])];
const COMMON_LIMIT = 0.02;
const SWEEP_LIMIT = 0.1;
const REGRESSION = {
    en: [428, 338, 344, 366, 368, 370, 372, 374, 394, 418, 422, 426, 430, 333, 334, 284, 285,
        // 首屏按鈕下面那幾行（hero.meta.os 22→45）：沒調時 0.0259，比 0.1 低，要用 0.02 才守得住
        [290, 'desktop', COMMON_LIMIT],
        // 640～1023 的大標（餘裕不到 0.5%）：652 沒調時 0.2579（大標 180→120），另取幾個代表寬度
        [640, 'desktop'], [652, 'desktop'], [700, 'desktop'], [900, 'desktop'], [1023, 'desktop']],
    zh: [354, 322, 488, 361, 362, [353, 'both']],
    ja: [306, 342, 344, 346, ...range(434, 478, 4), 440, 340],
};
const PARALLEL = 6;

// 同一組（語言、寬度、模式）只量一次，幾條測試共用
const cache = new Map();
async function cls(lang, width, touch) {
    const key = `${lang}${width}${touch}`;
    if (!cache.has(key)) {
        cache.set(key, (async () => {
            const { site, browser } = await session.get();
            return measureCls(browser, `${site.url}/${lang}/`, { width, touch });
        })());
    }
    return cache.get(key);
}

const mode = (touch) => (touch ? '只有手指' : '有滑鼠');

async function check(lang, combos, limit, title) {
    const results = await pool(combos, PARALLEL, ([width, touch]) => cls(lang, width, touch));
    const bad = [];
    const table = [];
    combos.forEach(([width, touch], i) => {
        const r = results[i];
        const label = `${lang} ${width} ${mode(touch)}`;
        if (r.guard) { bad.push(`${label}：防呆：放字型之前拉丁字型就載好了，量不到`); return; }
        table.push(`${label} ${r.cls.toFixed(4)}`);
        if (r.cls > limit) bad.push(`${label}：CLS ${r.cls.toFixed(4)}（上限 ${limit}），位移最大的是 ${topMoved(r.moved)}`);
    });
    console.log(`# F4.6b ${title} ${table.join('｜')}`);
    return bad;
}

for (const lang of LANGS) {
    test(`F4.6b 常見寬度 CLS ≤ ${COMMON_LIMIT}（${lang}：十二種寬度＋344、393、402、412、428、440，只有手指與有滑鼠）`, { skip: pw ? false : why, timeout: 10 * 60 * 1000 }, async () => {
        const bad = await check(lang, COMMON.flatMap((w) => [[w, true], [w, false]]), COMMON_LIMIT, `常見寬度 ${lang}`);
        assert.deepEqual(bad, [], `${bad.length} 組超過 ${COMMON_LIMIT}`);
    });
}

for (const lang of LANGS) {
    test(`F4.6b 掃描 CLS ≤ ${SWEEP_LIMIT}（${lang}：280～480 每 4px 只有手指、488～1456 每 16px 有滑鼠、640～1366 每 32px 只有手指）`, { skip: pw ? false : why, timeout: 10 * 60 * 1000 }, async () => {
        const bad = await check(lang, SWEEP, SWEEP_LIMIT, `掃描 ${lang}`);
        assert.deepEqual(bad, [], `${bad.length} 組超過 ${SWEEP_LIMIT}`);
    });
}

for (const lang of LANGS) {
    for (const entry of REGRESSION[lang]) {
        const [width, modes, own] = Array.isArray(entry) ? entry : [entry, null, null];
        const limit = own ?? (COMMON.includes(width) ? COMMON_LIMIT : SWEEP_LIMIT);
        const touches = modes === 'both' ? [true, false] : modes === 'desktop' ? [false] : modes === 'touch' ? [true] : [width <= 480];
        for (const touch of touches) {
            test(`F4.6b 迴歸（${lang} ${width} ${mode(touch)}）：CLS ≤ ${limit}`, { skip: pw ? false : why }, async () => {
                const bad = await check(lang, [[width, touch]], limit, `迴歸 ${lang} ${width} ${mode(touch)}`);
                assert.deepEqual(bad, [], bad.join('；'));
            });
        }
    }
}
