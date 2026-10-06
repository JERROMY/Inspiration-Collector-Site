// F4.12 04「擴充本身」三格：字不壓到分隔線。讀 out/（真的內容），真的開瀏覽器。
//
// 為什麼：三格原本平分（minmax(0, 1fr)），字比格子寬時越過分隔線 —— 日文「アカウント」280 寬壓線 4.3px、1024 寬只剩 0.9px，英文「accounts」280 寬剩 4.5px。
// 設計稿 ba016e9 改成每一格至少放得下自己的字（minmax(max-content, 1fr)）。不能在格子上用 minmax(0, 1fr) 硬塞：那會把「accounts」「アカウント」從中間拆開，
// 所以這裡也量「單位不斷成兩行」。
//
// 量法：page-helpers.js 的 ZERO_GAPS —— 每一格裡所有字（數字與單位）的右緣，到下一格的左緣（分隔線是下一格的左框）；第三格量到這一欄（<ul>）的右緣。
// 設計稿量到的在 fixtures/design-6511462.json 的 zeros（tools/measure-design.mjs 產生；最小 16.0，英日 280 與 1024 那幾格；中文最小 32.5），只寫進失敗訊息對照、當防呆。
//
// 量什麼：
//   F4.12 三語 × 十二種寬度（有滑鼠，高 900）＋只有手指 280、320、360、375、390、430、480、540、640、768、1024、1280（高 844），減少動態：
//         每一格的距離 ≥ 14px（設計稿最小 16、640 起 30；留 2px 給捨入，退到 9px 這種要紅）；單位那段字一行；整頁不橫捲。紅的時候寫語言、寬度、模式、哪一格（單位的字）、距離、設計稿的距離。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.12"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { say, heroParts, WIDTHS, ZERO_GAPS } from './page-helpers.js';

const DESIGN = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8')).zeros;
const TOUCH_WIDTHS = [280, 320, 360, 375, 390, 430, 480, 540, 640, 768, 1024, 1280];
const MIN = 14;
const UNITS = ['zeros.server', 'zeros.account', 'zeros.tracking'];
const CELLS = ['第一格', '第二格', '第三格'];

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

for (const lang of LANGS) {
    test(`F4.12 04「擴充本身」的字離分隔線 ≥ ${MIN}px、單位不斷行、不橫捲（${lang}：有滑鼠十二種寬度、只有手指 280～1280）`, { skip: pw ? false : why }, async () => {
        const { site, browser } = await session.get();
        const bad = [];
        for (const [mode, widths, height, extra] of [['mouse', WIDTHS, 900, {}], ['touch', TOUCH_WIDTHS, 844, { isMobile: true, hasTouch: true }]]) {
            const label = mode === 'touch' ? '只有手指' : '有滑鼠';
            for (const width of widths) {
                const design = DESIGN[lang][mode][String(width)];
                assert.ok(design && design.every((c) => c.gap >= MIN && c.lines === 1), `防呆：設計稿 ${lang} ${width} ${label} 本身要做得到（${JSON.stringify(design)}）`);
                const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...extra });
                const page = await context.newPage();
                page.setDefaultTimeout(15000);
                try {
                    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
                    await page.evaluate(() => document.fonts.ready);
                    const list = heroParts(page).zeros.first().locator('xpath=ancestor::ul[1]');
                    if (!(await list.count())) { bad.push(`${lang} ${width} ${label}：找不到三格（data-zero 外面的 <ul>）`); continue; }
                    const got = await list.evaluate(ZERO_GAPS);
                    if (got.length !== 3) bad.push(`${lang} ${width} ${label}：要三格，得到 ${got.length}`);
                    got.forEach((cell, i) => {
                        const name = `${CELLS[i]}「${say(lang, UNITS[i])}」`;
                        if (cell.gap < MIN) bad.push(`${lang} ${width} ${label}：${name}的字離${i < 2 ? '下一格的分隔線' : '這一欄右緣'} ${cell.gap}px（要 ≥ ${MIN}，設計稿 ${design[i]?.gap}）`);
                        if (cell.lines !== 1) bad.push(`${lang} ${width} ${label}：${name}的單位斷成 ${cell.lines} 行`);
                    });
                    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
                    if (scroll > 0) bad.push(`${lang} ${width} ${label}：整頁橫捲 ${scroll}px`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}
