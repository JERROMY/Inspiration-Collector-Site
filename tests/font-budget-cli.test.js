// 字型預算的命令 scripts/fonts-budget.mjs（目標檔 4-b6 的 B6.3；派工 2026-10-02 第三版：中日文走系統字型、網頁字型只有瘦身過的拉丁字型。介面細則見 tests/README.md「4-b6」）。
//
// node scripts/fonts-budget.mjs --text <檔> [--text <檔>…] [--fonts <字型資料夾，預設 public/fonts>]
//   ① <字型資料夾> 底下所有 .woff2 合計 ≤ 153600 位元組（150 KB，1 KB＝1024 位元組；剛好等於算過）。
//   ② 沒有中日文字型：每個 .woff2 的 cmap（lib/woff2-cmap.js）都沒有中日文字（lib/font-text.js 的 isCjk）；fonts.css 每個 @font-face 都有 unicode-range、而且不碰中日文
//      ＝ 中文頁的網頁字型下載量是 0。
//   ③ 缺字〔派工 2026-10-02〕：--text 每個檔整份，charsOf 取字、去掉中日文（走系統字型，不算缺字）與空白，
//      不在「資料夾裡所有 .woff2 的 cmap 聯集」裡的字分兩類 ——
//      字母與數字（Unicode 類別 L*、N*，含帶重音的拉丁字母）→ 列出字與 U+XXXX、結束碼 1；
//      其他（符號 S*、標點 P*、組合記號 M* 等，例如 ☰ ✕ ↺ ▶ ─ ├ €）→ 只印「警告」與「系統字型」並列字與 U+XXXX，結束碼照舊（不因此變 1）。
//   stdout：每個 .woff2 一行（檔名＋位元組）；一行「合計：<N> 位元組…」（N 是整數、不加千分位）。
//   結束碼：0 ＝ ①② 都過、沒有缺字母數字（有符號警告也是 0）；1 ＝ 超過（「超過」）、有中日文字型（講出檔名或「unicode-range」，訊息有「中日文」）、缺字母或數字、fonts.css 不在、GoogleSansFlex-site.woff2 不在或讀不了、
//          文字檔不在／是資料夾／空的；2 ＝ 用法錯誤（含 --fonts 不存在）。只讀不寫、不叫 python。
//
// 子集檔由 b6-font-fixture.js 的 woff2Font() 現組（cmap 由測試決定、大小補到剛好）。
// B6.3（選擇性）設了 SITE_COPY_MD＝<真的 copy.md> 才跑：用提交進來的 public/fonts/ 量 copy.md ＋ content/*.md，要結束碼 0；
//      copy.md 用到的 → ↓ ↺ ─ ├ ▶ ☰ ✕ 裡，聯集還找不到的要出現在警告裡。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.3 預算命令"
//   SITE_COPY_MD=<GPTPlugins>/design/homepage/copy.md npm test -- --test-name-pattern "B6.3 真的文案"
//   node --test tests/font-budget-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { runScript, usageError, snapshot, tmp } from './b6-fixture.js';
import { ASCII, woff2Font } from './b6-font-fixture.js';
import { lib } from './helpers.js';

const cmap = await lib('woff2-cmap.js', ['woff2CodePoints']);

const LIMIT = 150 * 1024;
const GSF = 'GoogleSansFlex-site.woff2';
const JBM = 'JetBrainsMono-site.woff2';
const cps = (chars) => [...chars].map((c) => c.codePointAt(0));
const LATIN_RANGE = 'U+0020-007E, U+00A0-00FF, U+2010-2027, U+2190-21FF';

function budget(args, opts) {
    return runScript('fonts-budget.mjs', args, opts);
}

function face(family, file, range = LATIN_RANGE) {
    return `@font-face {\n  font-family: "${family}";\n  src: url("${file}") format("woff2");\n  font-display: swap;\n${range === null ? '' : `  unicode-range: ${range};\n`}}\n`;
}

// 字型資料夾（路徑有空白與中文）：兩個瘦身檔，合計剛好 153600；Google Sans Flex 有 ASCII 與 é·’“”—…
function makeFonts(t, { gsf = ASCII + 'é·’“”—…', gsfSize = 100000, jbmSize = 53600, css, omit = [] } = {}) {
    const dir = path.join(tmp(t, 'site-budget-fonts-'), '字 型');
    fs.mkdirSync(dir, { recursive: true });
    if (!omit.includes(GSF)) fs.writeFileSync(path.join(dir, GSF), woff2Font(cps(gsf), { size: gsfSize }));
    if (!omit.includes(JBM)) fs.writeFileSync(path.join(dir, JBM), woff2Font(cps(ASCII + '→'), { size: jbmSize }));
    if (css !== null) fs.writeFileSync(path.join(dir, 'fonts.css'), css ?? face('Site Sans', GSF) + face('Site Mono', JBM));
    return dir;
}

function textFile(t, name, body) {
    const dir = path.join(tmp(t, 'site-budget-text-'), '文案 表');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, body);
    return file;
}

// 中日文與全形標點很多、非中日文字都在 Google Sans Flex 裡的文案
const GOOD = '| id | zh | en | ja |\n|---|---|---|---|\n| a | 你好，「靈感」・教學 | It’s “ok” — é… | かな、カナ。 |\n';

function total(res) {
    const out = `${res.stdout}\n${res.stderr}`;
    const m = /合計[:：]\s*(\d+)\s*位元組/.exec(out);
    assert.ok(m, `輸出要有一行「合計：<N> 位元組」（N 是整數、不加千分位），得到：${out}`);
    return Number(m[1]);
}

const all = (res) => `${res.stdout}\n${res.stderr}`;

test('B6.3 預算命令：合計剛好 153600 位元組、沒有中日文字型、非中日文字都在 → 結束碼 0；每個 .woff2 都列出；中日文字不算缺字', (t) => {
    const res = budget(['--text', textFile(t, 'copy.md', GOOD), '--fonts', makeFonts(t)]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(res.stdout.includes(GSF) && res.stdout.includes(JBM), `stdout 要列出每個 .woff2，得到：${res.stdout}`);
    assert.equal(total(res), LIMIT);
});

test('B6.3 預算命令：合計 153601 位元組（超過一個位元組）→ 結束碼 1、講「超過」', (t) => {
    const res = budget(['--text', textFile(t, 'copy.md', GOOD), '--fonts', makeFonts(t, { jbmSize: 53601 })]);
    assert.equal(res.status, 1, `超過要是結束碼 1，得到 ${res.status}；輸出：${all(res)}`);
    assert.match(all(res), /超過/, '要講「超過」');
    assert.equal(total(res), LIMIT + 1);
});

test('B6.3 預算命令：合計算的是資料夾裡所有 .woff2（多一個沒寫進 fonts.css 的檔也算）', (t) => {
    const fonts = makeFonts(t, { gsfSize: 60000, jbmSize: 60000 });
    fs.writeFileSync(path.join(fonts, 'Extra-latin.woff2'), woff2Font(cps(ASCII), { size: 40000 }));
    const res = budget(['--text', textFile(t, 'copy.md', GOOD), '--fonts', fonts]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
    assert.equal(total(res), 160000);
    assert.match(all(res), /超過/);
});

test('B6.3 預算命令：資料夾裡有中日文字型（cmap 有「你」的 GlowSansTC-Book.0.woff2）→ 結束碼 1、講出檔名與「中日文」', (t) => {
    const fonts = makeFonts(t, { gsfSize: 50000, jbmSize: 50000 });
    fs.writeFileSync(path.join(fonts, 'GlowSansTC-Book.0.woff2'), woff2Font(cps('A你')));
    const res = budget(['--text', textFile(t, 'copy.md', GOOD), '--fonts', fonts]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(all(res).includes('GlowSansTC-Book.0.woff2') && all(res).includes('中日文'), `要講出 GlowSansTC-Book.0.woff2 是中日文字型，得到：${all(res)}`);
});

for (const [label, css] of [
    ['fonts.css 有中日文的 @font-face（unicode-range U+4E00-9FFF）', face('Site Sans', GSF) + face('Site Mono', JBM) + face('Glow Sans TC', 'GlowSansTC-site-Book.woff2', 'U+4E00-9FFF')],
    ['fonts.css 的拉丁 @font-face 範圍碰到全形標點（U+0020-007E, U+FF01-FF5E）', face('Site Sans', GSF, 'U+0020-007E, U+FF01-FF5E') + face('Site Mono', JBM)],
    ['fonts.css 有一個 @font-face 沒寫 unicode-range（等於全部的字）', face('Site Sans', GSF, null) + face('Site Mono', JBM)],
]) {
    test(`B6.3 預算命令：${label} → 結束碼 1、講「中日文」或「unicode-range」`, (t) => {
        const res = budget(['--text', textFile(t, 'copy.md', GOOD), '--fonts', makeFonts(t, { css })]);
        assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
        assert.match(all(res), /中日文|unicode-range/, `要講出是中日文或 unicode-range 的問題，得到：${all(res)}`);
    });
}

test('B6.3 預算命令：缺字母與數字（ñ U+00F1、Ω U+03A9、½ U+00BD）→ 結束碼 1、列出字與 U+XXXX；中日文字、有的字不列', (t) => {
    const res = budget(['--text', textFile(t, 'copy.md', GOOD + '| b | 西班牙 | Año Ω ½ |\n'), '--fonts', makeFonts(t)]);
    assert.equal(res.status, 1, `缺字母或數字要是結束碼 1，得到 ${res.status}；輸出：${all(res)}`);
    const out = all(res);
    for (const [ch, code] of [['ñ', 'U+00F1'], ['Ω', 'U+03A9'], ['½', 'U+00BD']]) assert.ok(out.includes(ch) && out.includes(code), `要列出 ${ch} ${code}，得到：${out}`);
    for (const code of ['U+4F60', 'U+3001', 'U+FF0C', 'U+30FB', 'U+6559', 'U+00E9', 'U+2019', 'U+0041']) {
        assert.ok(!out.includes(code), `${code} 不該列（中日文走系統字型、或瘦身檔有），得到：${out}`);
    }
});

test('B6.3 預算命令：缺的只有符號與標點（↺ ☰ ✕ ▶ ─ ├ € §，與組合記號 U+0301）→ 只警告、結束碼 0，警告裡有「系統字型」與每個字的 U+XXXX', (t) => {
    const res = budget(['--text', textFile(t, 'copy.md', GOOD + '| b | 重來 ↺ ☰ ✕ ▶ | ├─ €5 § e\u0301 |\n'), '--fonts', makeFonts(t)]);
    assert.equal(res.status, 0, `只缺符號與標點要是結束碼 0（只警告），得到 ${res.status}；輸出：${all(res)}`);
    const out = all(res);
    assert.match(out, /警告/, `要印「警告」，得到：${out}`);
    assert.match(out, /系統字型/, `警告要講這些符號會用「系統字型」顯示，得到：${out}`);
    for (const code of ['U+21BA', 'U+2630', 'U+2715', 'U+25B6', 'U+2500', 'U+251C', 'U+20AC', 'U+00A7', 'U+0301']) assert.ok(out.includes(code), `警告要列出 ${code}，得到：${out}`);
});

test('B6.3 預算命令：缺字母也缺符號 → 結束碼 1，兩種都列出', (t) => {
    const res = budget(['--text', textFile(t, 'news.en.md', '## Año ↺\n'), '--fonts', makeFonts(t)]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(all(res).includes('U+00F1') && all(res).includes('U+21BA'), `ñ U+00F1 與 ↺ U+21BA 都要列出，得到：${all(res)}`);
});

test('B6.3 預算命令：缺字量的是所有 .woff2 的聯集 —— 只在 JetBrains Mono 有的字（→ U+2192）不算缺、不警告', (t) => {
    const res = budget(['--text', textFile(t, 'news.zh.md', '下一步 → 看教學\n'), '--fonts', makeFonts(t)]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(!all(res).includes('U+2192'), `→ 在 JetBrains Mono 裡有，不該列，得到：${all(res)}`);
});

test('B6.3 預算命令：只在 JetBrains Mono 有的字母也不算缺（Ω 放進 Mono）', (t) => {
    const fonts = makeFonts(t);
    fs.writeFileSync(path.join(fonts, 'JetBrainsMono-site.woff2'), woff2Font(cps(ASCII + '→Ω'), { size: 53600 }));
    const res = budget(['--text', textFile(t, 'news.en.md', 'Ω\n'), '--fonts', fonts]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(!all(res).includes('U+03A9'), `Ω 在 JetBrains Mono 裡有，不該列，得到：${all(res)}`);
});

test('B6.3 預算命令：--text 可以給好幾個，每個都整份收（不只 zh 欄）', (t) => {
    const a = textFile(t, 'copy.md', GOOD);
    const b = textFile(t, 'news.en.md', '## 2026-10-01 · News · Ø Title\n');
    const res = budget(['--text', a, '--text', b, '--fonts', makeFonts(t)]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
    assert.ok(all(res).includes('U+00D8'), `第二個檔的 Ø U+00D8 不在瘦身檔，要列出，得到：${all(res)}`);
});

for (const [label, prepare, word] of [
    ['GoogleSansFlex-site.woff2 不在', (t) => ({ fonts: makeFonts(t, { omit: [GSF] }) }), GSF],
    ['GoogleSansFlex-site.woff2 不是 WOFF2', (t) => { const fonts = makeFonts(t); fs.writeFileSync(path.join(fonts, GSF), 'not a font'); return { fonts }; }, GSF],
    ['fonts.css 不在', (t) => ({ fonts: makeFonts(t, { css: null }) }), 'fonts.css'],
    ['文字檔不存在', (t) => ({ text: path.join(tmp(t), 'no-such-news.zh.md') }), 'no-such-news.zh.md'],
    ['文字檔是空的', (t) => ({ text: textFile(t, 'news.zh.md', '') }), 'news.zh.md'],
    ['文字檔只有空白', (t) => ({ text: textFile(t, 'news.zh.md', ' \n\t\n') }), 'news.zh.md'],
    ['文字檔是一個資料夾', (t) => { const dir = path.join(tmp(t), 'news.zh.md'); fs.mkdirSync(dir); return { text: dir }; }, 'news.zh.md'],
]) {
    test(`B6.3 預算命令：${label} → 結束碼 1、講出是哪個`, (t) => {
        const got = prepare(t);
        const res = budget(['--text', got.text ?? textFile(t, 'copy.md', GOOD), '--fonts', got.fonts ?? makeFonts(t)]);
        assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${all(res)}`);
        assert.ok(res.stderr.includes(word), `stderr 要講到「${word}」，得到：${res.stderr}`);
        assert.match(res.stderr, /[一-鿿]/, 'stderr 要是中文');
    });
}

test('B6.3 預算命令：不給 --fonts 時讀這支檔往上一層的 public/fonts/（從暫存資料夾叫它）', (t) => {
    const res = budget(['--text', textFile(t, 'copy.md', GOOD)], { cwd: tmp(t) });
    const fonts = path.join(SITE, 'public', 'fonts');
    if (fs.existsSync(path.join(fonts, GSF))) {
        assert.ok(res.status === 0 || res.status === 1, `public/fonts/ 的瘦身檔在：要量得出來（結束碼 0 或 1），得到 ${res.status}；stderr：${res.stderr}`);
        const sum = fs.readdirSync(fonts).filter((n) => n.endsWith('.woff2')).reduce((n, f) => n + fs.statSync(path.join(fonts, f)).size, 0);
        assert.equal(total(res), sum);
    } else {
        assert.equal(res.status, 1, `public/fonts/ 還沒有瘦身檔：結束碼要是 1，得到 ${res.status}；stderr：${res.stderr}`);
        assert.match(res.stderr, /GoogleSansFlex-site\.woff2|fonts\.css/, `要講找不到哪個檔，得到：${res.stderr}`);
    }
});

test('B6.3 預算命令：只讀不寫 —— 文字檔與字型資料夾一個位元組都不變、cwd 沒多東西', (t) => {
    const text = textFile(t, 'copy.md', GOOD);
    const fonts = makeFonts(t);
    const before = [snapshot(path.dirname(text)), snapshot(fonts)];
    const cwd = tmp(t, 'site-budget-cwd-');
    budget(['--text', text, '--fonts', fonts], { cwd });
    assert.deepEqual([snapshot(path.dirname(text)), snapshot(fonts)], before);
    assert.deepEqual(fs.readdirSync(cwd), []);
});

for (const [label, args] of [
    ['沒給 --text', ['--fonts', '<fonts>']],
    ['--text 缺值', ['--fonts', '<fonts>', '--text']],
    ['--text=（空字串）', ['--text=', '--fonts', '<fonts>']],
    ['--fonts=（空字串）', ['--text', '<text>', '--fonts=']],
    ['--fonts 不存在', ['--text', '<text>', '--fonts', '<missing>']],
    ['不認得的參數 --bogus', ['--text', '<text>', '--fonts', '<fonts>', '--bogus']],
    ['多出來的位置參數 extra', ['--text', '<text>', '--fonts', '<fonts>', 'extra']],
]) {
    test(`B6.3 預算命令：用法錯誤（${label}）→ 結束碼 2、中文、cwd 沒多東西`, (t) => {
        const cwd = tmp(t, 'site-budget-cwd-');
        const map = { '<text>': textFile(t, 'copy.md', GOOD), '<fonts>': makeFonts(t), '<missing>': path.join(tmp(t), 'no-such-thing') };
        const res = budget(args.map((arg) => map[arg] ?? arg), { cwd });
        usageError(res, label);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：cwd 不能多出任何檔`);
    });
}

const REAL = process.env.SITE_COPY_MD;
test('B6.3 真的文案：用提交進來的 public/fonts/ 量 copy.md ＋ content/*.md，結束碼 0；→ ↓ ↺ ─ ├ ▶ ☰ ✕ 裡聯集找不到的都在警告裡', { skip: REAL ? false : '沒設 SITE_COPY_MD（真的文案預設不量；要量請設成 copy.md 的路徑）' }, () => {
    assert.ok(fs.existsSync(REAL), `SITE_COPY_MD 指到的 ${REAL} 不存在`);
    const content = path.join(SITE, 'content');
    const md = fs.readdirSync(content).filter((name) => name.endsWith('.md')).sort().map((name) => path.join(content, name));
    const res = budget(['--text', REAL, ...md.flatMap((file) => ['--text', file])]);
    assert.equal(res.status, 0, `真的文案要過（≤ 153600 位元組、沒有中日文字型、字母數字都在；符號只警告），得到結束碼 ${res.status}；輸出：${all(res)}`);
    const fonts = path.join(SITE, 'public', 'fonts');
    const { woff2CodePoints } = cmap();
    const union = new Set(fs.readdirSync(fonts).filter((n) => n.endsWith('.woff2')).flatMap((n) => woff2CodePoints(fs.readFileSync(path.join(fonts, n)))));
    const lacking = [...'→↓↺─├▶☰✕'].filter((ch) => !union.has(ch.codePointAt(0)));
    if (lacking.length) assert.match(all(res), /警告/, `有符號瘦身檔沒有（${lacking.join(' ')}），要印「警告」`);
    for (const ch of lacking) {
        const code = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
        assert.ok(all(res).includes(code), `${ch} ${code} 瘦身檔沒有，要出現在警告裡，得到：${all(res)}`);
    }
});
