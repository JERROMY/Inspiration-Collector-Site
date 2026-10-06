// 4-b12 的 B12.1（不需要瀏覽器的那一層）：lib/fallback-fonts.js 的純函式 —— 分組、夾 85%～120%、unicode-range、@font-face 一行的寫法、微調組、整份 CSS、從 fonts.css 取字。
// 介面細則見 tests/README.md「4-b12」。用小 fixture 與凍結的參考輸出（tests/fixtures/fallback-fonts/golden.css），不開瀏覽器，必過。
//
// 量什麼：
//   groupGlyphs(ratios, options)   夾到 [min, max]（預設 0.85～1.20，空白不夾）→ 照比例由小到大（一樣大照碼位）→ 跟那一組第一個字比，差 ≤ tolerance（預設 2%）就收進去；
//                                  空白自己一組、排在最後；每組 { codes（由小到大）, ratio（夾過的比例的幾何平均） }。
//   unicodeRange(codes)            連續的碼位寫成 U+3A-3B，其他 U+2C；大寫十六進位；由小到大、去重複；「, 」接起來。
//   fontFaceRule(face)             一行 @font-face，格式跟 golden.css 一樣（字重 400／500／600 → 100 449／450 599／600 900，600 用 Arial Bold 那一串；
//                                  size-adjust 一位小數；ascent／descent ＝ 96.6／28.6 除以「沒四捨五入的」size-adjust，兩位小數）。
//   scaleFaces(baseLines, factor)  微調組：從基本組那幾行整組乘 k（空白另外乘 spaceK）→ golden.css 的 193 行微調組逐字相同。
//   renderFallbackCss({ roles, factors, measurements })  整份 CSS：照 roles 的順序（每組照列的字重）、再照 factors 的順序；輸入的順序打亂結果一樣（冪等）；沒有日期與路徑。
//   charsFromFontsCss(css)         fonts.css 裡 "Google Sans Flex" 那一個 @font-face 的 unicode-range 展開成碼位。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12.1 純函式"
//   node --test tests/fallback-fonts-lib.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';
import { BASE, FACTORS, ROLES, readGolden, parseFaces } from './fallback-fixture.js';

const need = await lib('fallback-fonts.js', ['groupGlyphs', 'unicodeRange', 'fontFaceRule', 'scaleFaces', 'renderFallbackCss', 'charsFromFontsCss']);

const REG = 'local("Arial"), local("ArialMT"), local("Helvetica"), local("Liberation Sans")';
const BOLD = 'local("Arial Bold"), local("Arial-BoldMT"), local("Helvetica Bold"), local("Helvetica-Bold"), local("Liberation Sans Bold")';
const near = (a, b) => Math.abs(a - b) < 1e-9;

function sameGroups(got, want, label) {
    assert.ok(Array.isArray(got), `${label}：要回傳陣列`);
    assert.equal(got.length, want.length, `${label}：組數，得到 ${JSON.stringify(got)}`);
    want.forEach((w, i) => {
        assert.deepEqual(got[i].codes, w.codes, `${label} 第 ${i + 1} 組的字`);
        assert.ok(near(got[i].ratio, w.ratio), `${label} 第 ${i + 1} 組的比例要是 ${w.ratio}，得到 ${got[i].ratio}`);
    });
}

const SAMPLE = [[0x61, 1.0], [0x62, 1.019], [0x63, 1.021], [0x64, 0.8], [0x65, 1.3], [0x20, 0.81], [0x66, 1.0]];

test('B12.1 純函式 groupGlyphs：夾 85%～120%、差 2% 以內收一組、空白自己一組排最後', () => {
    const { groupGlyphs } = need();
    sameGroups(groupGlyphs(SAMPLE), [
        { codes: [0x64], ratio: 0.85 },
        { codes: [0x61, 0x62, 0x66], ratio: Math.cbrt(1.019) },
        { codes: [0x63], ratio: 1.021 },
        { codes: [0x65], ratio: 1.2 },
        { codes: [0x20], ratio: 0.81 },
    ], '一般的一組');
});

test('B12.1 純函式 groupGlyphs：門檻剛好 2% 收進去、超過就分開；比的是那一組最小的那個字', () => {
    const { groupGlyphs } = need();
    sameGroups(groupGlyphs([[0x41, 1.0], [0x42, 1.02]]), [{ codes: [0x41, 0x42], ratio: Math.sqrt(1.02) }], '剛好 2%');
    sameGroups(groupGlyphs([[0x41, 1.0], [0x42, 1.0201]]), [{ codes: [0x41], ratio: 1.0 }, { codes: [0x42], ratio: 1.0201 }], '超過 2%');
    sameGroups(groupGlyphs([[0x41, 1.0], [0x42, 1.015], [0x43, 1.025]]), [{ codes: [0x41, 0x42], ratio: Math.sqrt(1.015) }, { codes: [0x43], ratio: 1.025 }], '跟第一個字比（1.025÷1.0 超過），不是跟上一個字比');
});

test('B12.1 純函式 groupGlyphs：夾的上下限、門檻、不夾的字可以用 options 換；輸入順序打亂結果一樣', () => {
    const { groupGlyphs } = need();
    sameGroups(groupGlyphs([[0x41, 0.5], [0x42, 2]], { min: 0.6, max: 1.5 }), [{ codes: [0x41], ratio: 0.6 }, { codes: [0x42], ratio: 1.5 }], 'min／max');
    sameGroups(groupGlyphs([[0x41, 1.0], [0x42, 1.05]], { tolerance: 0.1 }), [{ codes: [0x41, 0x42], ratio: Math.sqrt(1.05) }], 'tolerance');
    sameGroups(groupGlyphs([[0x41, 0.5], [0x2e, 0.5]], { exempt: [0x2e] }), [{ codes: [0x41], ratio: 0.85 }, { codes: [0x2e], ratio: 0.5 }], 'exempt 換成句點');
    const shuffled = [...SAMPLE].reverse();
    assert.deepEqual(JSON.stringify(groupGlyphs(shuffled)), JSON.stringify(groupGlyphs(SAMPLE)), '輸入順序打亂結果一樣');
    sameGroups(groupGlyphs([[0x5a, 1.0], [0x41, 1.0]]), [{ codes: [0x41, 0x5a], ratio: 1.0 }], '一樣大照碼位');
});

test('B12.1 純函式 unicodeRange：連續的寫成範圍、大寫、由小到大、去重複', () => {
    const { unicodeRange } = need();
    assert.equal(unicodeRange([0x2c, 0x2e, 0x31, 0x3a, 0x3b, 0x3f, 0x45, 0x50, 0x52, 0x53, 0xb7, 0x2026]), 'U+2C, U+2E, U+31, U+3A-3B, U+3F, U+45, U+50, U+52-53, U+B7, U+2026');
    assert.equal(unicodeRange([0x3b, 0x3a, 0x3a, 0x2c]), 'U+2C, U+3A-3B', '亂序、重複');
    assert.equal(unicodeRange([0x20]), 'U+20');
    assert.equal(unicodeRange([0x2d, 0x35, 0x36, 0x37, 0x68, 0x69, 0x6a, 0x6b]), 'U+2D, U+35-37, U+68-6B');
});

test('B12.1 純函式 fontFaceRule：一行的寫法跟 golden.css 一樣', () => {
    const { fontFaceRule } = need();
    assert.equal(fontFaceRule({ family: `${BASE} 16`, weight: 400, codes: [0x2c, 0x2e, 0x3a, 0x3b], sizeAdjust: 85.4123 }),
        `@font-face { font-family: "${BASE} 16"; src: ${REG}; font-weight: 100 449; unicode-range: U+2C, U+2E, U+3A-3B; size-adjust: 85.4%; ascent-override: 113.10%; descent-override: 33.48%; line-gap-override: 0%; }`);
    assert.equal(fontFaceRule({ family: BASE, weight: 500, codes: [0x20], sizeAdjust: 101.0444 }),
        `@font-face { font-family: "${BASE}"; src: ${REG}; font-weight: 450 599; unicode-range: U+20; size-adjust: 101.0%; ascent-override: 95.60%; descent-override: 28.30%; line-gap-override: 0%; }`);
    assert.equal(fontFaceRule({ family: `${BASE} 64`, weight: 600, codes: [0x41], sizeAdjust: 119.96 }),
        `@font-face { font-family: "${BASE} 64"; src: ${BOLD}; font-weight: 600 900; unicode-range: U+41; size-adjust: 120.0%; ascent-override: 80.53%; descent-override: 23.84%; line-gap-override: 0%; }`, '600 用粗體');
    const shape = /^@font-face \{ font-family: "[^"]+"; src: local\("Arial[^;]+; font-weight: (?:100 449|450 599|600 900); unicode-range: [^;]+; size-adjust: \d+\.\d%; ascent-override: \d+\.\d\d%; descent-override: \d+\.\d\d%; line-gap-override: 0%; \}$/;
    for (const face of parseFaces(readGolden()).slice(0, 231)) assert.match(face.line.replace(/\s+/g, ' '), shape, 'golden.css 的基本組每一行都是這個形狀（防呆）');
});

test('B12.1 純函式 scaleFaces：從 golden.css 的基本組照 12 條係數乘出來，跟 golden.css 的 193 行微調組逐字相同', () => {
    const { scaleFaces } = need();
    const lines = readGolden().split('\n').filter((l) => l.startsWith('@font-face'));
    const base = lines.slice(0, 231);
    const micro = lines.slice(231);
    assert.equal(micro.length, 193, '防呆：golden.css 的微調組 193 行');
    const got = FACTORS.flatMap((factor) => scaleFaces(base, factor));
    assert.equal(got.length, micro.length, '行數');
    got.forEach((line, i) => assert.equal(line, micro[i], `第 ${i + 1} 行微調組`));
    assert.deepEqual(scaleFaces(base, { family: `${BASE} x`, from: `${BASE} 99`, weight: '100 449', k: 1 }), [], '來源組不存在：空的（整份 CSS 那層再報錯）');
});

// 小 fixture：兩組字級、一條係數
const MINI_ROLES = [{ suffix: ' 16', size: 16, opsz: 'auto', weights: [400, 600] }, { suffix: '', size: 14, opsz: 18, weights: [400] }];
const MINI_FACTORS = [{ family: `${BASE} sub en`, from: `${BASE} 16`, weight: '100 449', k: 1.0264, spaceK: 0.7125 }];
const MINI_MEASURE = [
    { family: `${BASE} 16`, weight: 400, ratios: [[0x61, 1.0], [0x62, 1.01], [0x63, 1.2], [0x31, 0.66], [0x20, 0.81]] },
    { family: `${BASE} 16`, weight: 600, ratios: [[0x61, 0.97], [0x62, 1.05], [0x63, 1.1], [0x31, 0.7], [0x20, 0.9]] },
    { family: BASE, weight: 400, ratios: [[0x61, 1.03], [0x62, 1.03], [0x63, 1.47], [0x31, 0.9], [0x20, 0.8]] },
];

test('B12.1 純函式 renderFallbackCss：照 roles、字重、factors 的順序；基本組＝groupGlyphs＋fontFaceRule、微調組＝scaleFaces', () => {
    const { renderFallbackCss, groupGlyphs, fontFaceRule, scaleFaces } = need();
    const css = renderFallbackCss({ roles: MINI_ROLES, factors: MINI_FACTORS, measurements: MINI_MEASURE });
    assert.equal(typeof css, 'string');
    assert.ok(css.endsWith('\n') && !css.endsWith('\n\n\n'), '換行結尾');
    assert.ok(css.startsWith('/*'), '檔頭是說明怎麼產的註解');
    const head = css.slice(0, css.indexOf('*/'));
    assert.ok(head.includes('npm run fallback-fonts'), '檔頭要寫到 npm run fallback-fonts');
    const order = [[`${BASE} 16`, 400], [`${BASE} 16`, 600], [BASE, 400]];
    const base = order.flatMap(([family, weight]) => {
        const m = MINI_MEASURE.find((x) => x.family === family && x.weight === weight);
        return groupGlyphs(m.ratios).map((g) => fontFaceRule({ family, weight, codes: g.codes, sizeAdjust: g.ratio * 100 }));
    });
    const want = [...base, ...MINI_FACTORS.flatMap((f) => scaleFaces(base, f))];
    assert.deepEqual(css.split('\n').filter((l) => l.startsWith('@font-face')), want, '@font-face 的行：照 roles 順序的基本組，再照 factors 順序的微調組');
    // 本機路徑的字拆開寫，免得這支測試檔自己被「不往外面讀」的結構檢查當成路徑
    const local = new RegExp(['\\d{4}-\\d{2}-\\d{2}', '\\/Us' + 'ers\\/', '[A-Z]:\\\\', 'scratch' + 'pad', 'GPT' + 'Plugins'].join('|'));
    assert.doesNotMatch(css, local, '沒有日期與本機路徑（重跑才會位元組相同）');
});

test('B12.1 純函式 renderFallbackCss 冪等：measurements 與 ratios 的順序打亂、重跑，位元組相同', () => {
    const { renderFallbackCss } = need();
    const first = renderFallbackCss({ roles: MINI_ROLES, factors: MINI_FACTORS, measurements: MINI_MEASURE });
    const shuffled = [...MINI_MEASURE].reverse().map((m) => ({ ...m, ratios: [...m.ratios].reverse() }));
    assert.equal(renderFallbackCss({ roles: MINI_ROLES, factors: MINI_FACTORS, measurements: shuffled }), first, '輸入的順序打亂，結果一樣');
    assert.equal(renderFallbackCss({ roles: MINI_ROLES, factors: MINI_FACTORS, measurements: MINI_MEASURE }), first, '重跑一樣');
});

test('B12.1 純函式 renderFallbackCss：少一組量測、係數指到不存在的組 → 丟 Error，講出是哪一組', () => {
    const { renderFallbackCss } = need();
    assert.throws(() => renderFallbackCss({ roles: MINI_ROLES, factors: MINI_FACTORS, measurements: MINI_MEASURE.slice(1) }),
        (err) => err instanceof Error && err.message.includes(`${BASE} 16`) && err.message.includes('400'), '少了 16 的 400');
    assert.throws(() => renderFallbackCss({ roles: MINI_ROLES, factors: [{ ...MINI_FACTORS[0], from: `${BASE} 99` }], measurements: MINI_MEASURE }),
        (err) => err instanceof Error && err.message.includes(`${BASE} 99`), '係數指到不存在的組');
});

test('B12.1 純函式 charsFromFontsCss：取 "Google Sans Flex" 那個 @font-face 的 unicode-range', () => {
    const { charsFromFontsCss } = need();
    const css = fs.readFileSync(path.join(SITE, 'public', 'fonts', 'fonts.css'), 'utf8');
    const want = [];
    for (let c = 0x20; c <= 0x7e; c += 1) want.push(c);
    want.push(0xa6, 0xa7, 0xa9, 0xab, 0xb7, 0xbb, 0xd7, 0x2013, 0x2014, 0x2019, 0x201c, 0x201d, 0x2026);
    assert.deepEqual(charsFromFontsCss(css), want, 'public/fonts/fonts.css 的 Google Sans Flex（不是 JetBrains Mono 那個）');
    assert.throws(() => charsFromFontsCss('@font-face { font-family: "JetBrains Mono"; unicode-range: U+20-7E; }'), Error, '沒有 Google Sans Flex 那個 @font-face → Error');
});

test('B12.1 純函式：設定檔 scripts/fallback-fonts.config.json 是產生 golden.css 那一次的字級×字重與係數', () => {
    const file = path.join(SITE, 'scripts', 'fallback-fonts.config.json');
    assert.ok(fs.existsSync(file), '缺 scripts/fallback-fonts.config.json（後端之後實作）');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(config.roles, ROLES, 'roles（字級×字重）');
    assert.deepEqual(config.factors, FACTORS, 'factors（微調係數）');
});
