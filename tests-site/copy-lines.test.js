// F4.4 文案：03 首屏、04 每個文字區塊的每一行。讀 out/（真的內容），真的開瀏覽器。
//
// 設計稿逐行表：fixtures/design-lines-03-04.json（設計稿第四批 3f2310c 的 HTML 直接量的，鍵是字串表的 id；量法同這裡：Playwright 的 Chromium、減少動態、<details> 全打開；
// lines 是有滑鼠的三語 × 十二種寬度、touch 是只有手指時 320～430 的手指框。來源與核對寫在那支檔的 source）。
// 網站這邊：每個區塊是 data-id="<字串表的 id>" 的元素，逐字量 Range 的位置分行（page-helpers.js 的 textLines）；減少動態（A 不拆字，斷行一樣，由 F4.3 量）、等拉丁字型載好再量。
//
// 量什麼：
//   F4.4 三語 × 十二種寬度：hero.kicker、hero.title、hero.sub、hero.meta.free、hero.meta.os、hero.meta.devices、hero.video.label、hero.video.desc、
//        where.label、zeros.cap、where.chatgpt…where.web、zeros.server…zeros.tracking 的每一行跟設計稿一樣（空白合併、每行去頭尾空白）。
//   F4.4 只有手指（三語 × 320、360、375、390、414、430）：手指框的 hero.mobile.text、hero.pc 每一行跟設計稿一樣。
//   F4.4 說明文字（hero.sub、hero.video.desc；只有手指時另量 hero.mobile.text）照 CLAUDE.md 的斷行規則：
//        中日文每一行 ≥ 5 字、≤ 25 字（中日文一個字算 1、英數算 0.5，同設計稿）、行首不是句讀或收尾的括號引號（孤標點）；英文沒有只有一個字的行。
//        （「一行 12～20 字」是目標、不判：設計稿本身就有 8、9 字的行。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.4"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession } from './helpers.js';
import { heroParts, textLines, width as wide, WIDTHS } from './page-helpers.js';

const FIXTURE = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-03-04.json'), 'utf8'));
const DESIGN = FIXTURE.lines;
const DESIGN_TOUCH = FIXTURE.touch;
const PROSE = ['hero.sub', 'hero.video.desc'];
const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, extra = {}, height = 900) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...extra });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
        await document.fonts.ready;
        for (const d of document.querySelectorAll('[data-section="hero"] details, [data-section="where"] details')) d.open = true;
    });
    return { page, context, h: heroParts(page) };
}

function rules(lang, id, lines, label) {
    const bad = [];
    for (const line of lines) {
        if (lang === 'en') {
            if (line.split(' ').length === 1) bad.push(`${label} ${id}：只有一個字的行「${line}」`);
            continue;
        }
        const n = wide(line);
        if (n < 5) bad.push(`${label} ${id}：不到 5 字的行「${line}」（${n}）`);
        if (n > 25) bad.push(`${label} ${id}：超過 25 字的行「${line}」（${n}）`);
        if (HEAD_PUNCT.test(line)) bad.push(`${label} ${id}：孤標點在行首「${line}」`);
    }
    return bad;
}

for (const lang of LANGS) {
    test(`F4.4 文案（${lang}）：03、04 每個區塊的每一行跟設計稿一樣（十二種寬度、只有手指的手指框）；說明文字照斷行規則`, { skip: pw ? false : why }, async () => {
        const diff = [];
        const bad = [];
        for (const width of WIDTHS) {
            const want = DESIGN[lang][String(width)];
            const { context, h } = await open(lang, width);
            try {
                for (const [id, lines] of Object.entries(want)) {
                    const block = h.block(id);
                    if ((await block.count()) === 0) { diff.push(`${lang} ${width} ${id}：找不到 data-id="${id}"`); continue; }
                    const got = await textLines(block.first());
                    if (JSON.stringify(got) !== JSON.stringify(lines)) diff.push(`${lang} ${width} ${id}\n    網站 ${got.join(' ／ ')}\n    設計 ${lines.join(' ／ ')}`);
                    if (PROSE.includes(id)) bad.push(...rules(lang, id, got, `${lang} ${width}`));
                }
            } finally {
                await context.close();
            }
        }
        for (const width of [320, 360, 375, 390, 414, 430]) {
            const { context, h } = await open(lang, width, { isMobile: true, hasTouch: true }, 844);
            try {
                for (const [id, lines] of Object.entries(DESIGN_TOUCH[lang][String(width)])) {
                    const block = h.block(id);
                    if ((await block.count()) === 0) { diff.push(`${lang} ${width} 只有手指 ${id}：找不到 data-id="${id}"`); continue; }
                    const got = await textLines(block.first());
                    if (JSON.stringify(got) !== JSON.stringify(lines)) diff.push(`${lang} ${width} 只有手指 ${id}\n    網站 ${got.join(' ／ ')}\n    設計 ${lines.join(' ／ ')}`);
                    if (id === 'hero.mobile.text') bad.push(...rules(lang, id, got, `${lang} ${width} 只有手指`));
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(diff, [], `${diff.length} 處跟設計稿的斷行不一樣`);
        assert.deepEqual(bad, [], `${bad.length} 處不合斷行規則`);
    });
}
