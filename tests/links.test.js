// lib/links.js 的 parseLinks(text) —— 社群連結（規格書第 7 節、第 14 區；三語共用 links.md）。
//
// 量什麼（編號照目標檔 4-b1 的測試案例）：
//   B1.3 格式正確的文字讀得出來：一行一個「- 代號 · 網址」→ { ok: true, code, url }，順序跟檔案一樣；
//        代號英文小寫與數字（x2 也收）；網址 https。（code 同時是 icons/<code>.svg 與流量統計的名字，那是前端的事，這裡只量讀出來的值。）
//   B1.4 寫壞一條只壞那一條：少了「·」、代號有大寫、代號有空白或空的、網址不是 https、整行亂碼、沒有「- 」開頭、整檔空白。
//        每條先量「條目數＝好的＋壞的」，再量壞紀錄 { ok: false, line, raw, reason }（line 是原檔行號、
//        raw 是那一行原文、reason 是中文而且講到「·」「代號」「https」）。中間夾空行，行號照原檔算。
//   B1.6 檔頭的 <!-- … --> 註解不當條目、不算錯；註解裡的範例行「- threads · https://…」不會被讀成真的連結。
//
//   第 1 次修補（名稱帶「修補N」，N 是派工人員那九條的編號；細則見 tests/README.md）：
//        修補1 註解沒關起來（開頭、中間）→ 一筆壞紀錄、之後照常；修補3 crlf-bom/links.md 跟 LF 版一樣；
//        修補5 代號重複 → 先出現的算數，後面那行壞（reason 講「代號重複」）；修補8 雜字一行一筆；
//        修補9 註解在任何位置都去掉、行號不變。
//
//   第 2 次修補（名稱帶「二修」）：落單的「-->」一筆壞紀錄；「 · 」多一段算壞；代號重複只跟好的比。
//
//   第 3 次修補（名稱帶「三修」＋字母；細則見 tests/README.md 第 37 條起）：D 網址要像真的；H 落單 --> 的原因提醒 → 或 ->。
//
//   第 4 次修補（名稱帶「四修」）：點打錯要點名字元、點兩邊沒空格要講「點的兩邊各空一格」。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B1.3"          只跑某一條
//   npm test -- --test-name-pattern "修補"           只跑第 1 次修補的案例
//   npm test -- --test-name-pattern "二修"           只跑第 2 次修補的案例
//   npm test -- --test-name-pattern "三修"           只跑第 3 次修補的案例
//   npm test -- --test-name-pattern "四修"           只跑第 4 次修補的案例
//   node --test tests/links.test.js                 只跑這支
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib, lines, lineOf, noThrow, expectCount, expectBad, crlfBom } from './helpers.js';

const need = await lib('links.js', ['parseLinks']);

function parse(text) {
    const { parseLinks } = need();
    return noThrow('parseLinks', () => parseLinks(text));
}

const BLOG = { ok: true, code: 'blog', url: 'https://jerromy.com' };

// ───────────────────────── B1.3 ─────────────────────────

test('B1.3 社群連結讀得出來：代號與網址，順序跟檔案一樣', () => {
    const rows = [
        '- blog · https://jerromy.com',
        '- facebook · https://www.facebook.com/jerromy',
        '- instagram · https://www.instagram.com/jerromy',
        '- x · https://x.com/LeeChihMin',
        '- threads · https://www.threads.com/@jerromy',
        '- x2 · https://example.com/a',
    ];
    const result = parse(lines(rows));
    expectCount(result, 6, '六個');
    assert.deepStrictEqual(result, [
        BLOG,
        { ok: true, code: 'facebook', url: 'https://www.facebook.com/jerromy' },
        { ok: true, code: 'instagram', url: 'https://www.instagram.com/jerromy' },
        { ok: true, code: 'x', url: 'https://x.com/LeeChihMin' },
        { ok: true, code: 'threads', url: 'https://www.threads.com/@jerromy' },
        { ok: true, code: 'x2', url: 'https://example.com/a' },
    ]);
});

// ───────────────────────── B1.4 ─────────────────────────

// 壞行夾在兩個好的中間、前後有空行：壞的只壞自己，行號照原檔
function badLineCase(badLine, words, label) {
    const rows = ['- blog · https://jerromy.com', '', badLine, '', '- threads · https://www.threads.com/@jerromy'];
    const result = parse(lines(rows));
    expectCount(result, 3, label);
    assert.deepStrictEqual(result[0], BLOG, `${label}：前面那個要照常`);
    expectBad(result[1], { line: lineOf(rows, badLine), raw: badLine, words }, label);
    assert.deepStrictEqual(result[2], { ok: true, code: 'threads', url: 'https://www.threads.com/@jerromy' }, `${label}：後面那個要照常`);
}

test('B1.4 社群連結：少了「·」', () => {
    for (const row of ['- blog https://jerromy.com', '- blog - https://jerromy.com']) {
        badLineCase(row, ['·'], row);
    }
});

test('B1.4 社群連結：代號有大寫', () => {
    for (const row of ['- Threads · https://www.threads.com/@jerromy', '- X · https://x.com/LeeChihMin']) {
        badLineCase(row, ['代號'], row);
    }
});

test('B1.4 社群連結：代號有空白或是空的', () => {
    for (const row of ['- my blog · https://jerromy.com', '-  · https://jerromy.com']) {
        badLineCase(row, ['代號'], JSON.stringify(row));
    }
});

test('B1.4 社群連結：網址不是 https', () => {
    for (const row of ['- blog · http://jerromy.com', '- blog · jerromy.com']) {
        badLineCase(row, ['https'], row);
    }
});

test('B1.4 社群連結：整行亂碼、沒有「- 」開頭', () => {
    for (const row of ['@@@ ~~~ 亂碼 ###', 'threads · https://www.threads.com/@jerromy']) {
        badLineCase(row, [], row);
    }
});

test('B1.4 社群連結：整檔空白回空陣列、不丟例外', () => {
    for (const text of ['', '\n\n   \n\t\n']) {
        expectCount(parse(text), 0, `整檔空白 ${JSON.stringify(text)}`);
    }
});

// ───────────────────────── B1.6 ─────────────────────────

test('B1.6 社群連結：檔頭註解不當條目，註解裡的範例行不會變成真的連結，行號照原檔算', () => {
    const rows = [
        '<!--',
        '這支檔是「社群連結」，三種語言共用。一行一個：',
        '- threads · https://www.threads.com/@jerromy',
        '代號是英文小寫，同時是 icons/<代號>.svg 的檔名。',
        '改完存檔，通常幾分鐘後網站更新，最久約 20 分鐘。',
        '-->',
        '- blog · https://jerromy.com',
        '- Bad · https://example.com',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '註解後面的兩行');
    assert.deepStrictEqual(result[0], BLOG, '註解裡的 threads 是範例，不是真的連結');
    expectBad(result[1], { line: lineOf(rows, '- Bad · https://example.com'), raw: '- Bad · https://example.com', words: ['代號'] }, '註解後面的壞行（行號含註解行）');
});

test('B1.6 社群連結：單行註解也一樣', () => {
    const result = parse(lines(['<!-- 一行一個「- 代號 · 網址」，例如 - x · https://x.com/a -->', '- blog · https://jerromy.com']));
    expectCount(result, 1, '單行註解');
    assert.deepStrictEqual(result[0], BLOG);
});

// ───────────────────────── 第 1 次修補（派工人員 2026-10-02 的九條決定；--test-name-pattern "修補" 只跑這些） ─────────────────────────

test('B1.4 修補1 社群連結：註解沒關起來（缺 -->）回一筆壞紀錄，後面的內容照常解析（開頭、中間各一次）', () => {
    for (const rows of [
        ['<!--', '- blog · https://jerromy.com'],
        ['- x · https://x.com/LeeChihMin', '<!--', '- blog · https://jerromy.com'],
    ]) {
        const result = parse(lines(rows));
        expectCount(result, rows.length, `${JSON.stringify(rows)}（不准把註解開頭之後全部吞掉）`);
        const at = rows.indexOf('<!--');
        expectBad(result[at], { line: at + 1, raw: '<!--', words: ['註解', '-->'] }, '沒關的註解');
        assert.deepStrictEqual(result.at(-1), BLOG, '註解開頭之後的連結照常');
    }
});

test('B1.4 修補3 社群連結：CRLF 行尾＋UTF-8 BOM 的結果（含行號）跟 LF 版一模一樣', () => {
    const { crlf, lf } = crlfBom('links.md');
    const want = parse(lf);
    expectCount(want, 3, 'LF 版（防呆：fixture 有兩個好的、一個壞的）');
    assert.deepStrictEqual(want[0], BLOG, 'LF 版的網址不能帶 \\r');
    assert.equal(want[1].ok, false);
    assert.deepStrictEqual(parse(crlf), want, 'CRLF＋BOM 版要跟 LF 版一樣');
});

test('B1.4 修補5 社群連結：代號重複，先出現的算數，後面那行算壞', () => {
    const rows = ['- blog · https://jerromy.com', '- x · https://x.com/LeeChihMin', '- blog · https://other.example.com'];
    const result = parse(lines(rows));
    expectCount(result, 3, '三行');
    assert.deepStrictEqual(result[0], BLOG, '先出現的那個照常');
    assert.deepStrictEqual(result[1], { ok: true, code: 'x', url: 'https://x.com/LeeChihMin' });
    expectBad(result[2], { line: 3, raw: '- blog · https://other.example.com', words: ['代號重複'] }, '重複的代號');
});

test('B1.4 修補8 社群連結：連續好幾行雜字，每一行各一筆壞紀錄', () => {
    const rows = ['雜字一', '雜字二', '', '雜字三', '- blog · https://jerromy.com'];
    const result = parse(lines(rows));
    expectCount(result, 4, '三行雜字＋一個連結');
    for (const [i, row] of ['雜字一', '雜字二', '雜字三'].entries()) {
        expectBad(result[i], { line: lineOf(rows, row), raw: row }, row);
    }
    assert.deepStrictEqual(result[3], BLOG);
});

test('B1.6 修補9 社群連結：註解在任何位置（開頭前有空行、中間、結尾）都去掉，行號不變', () => {
    const rows = [
        '',
        '<!-- 開頭前面有空行 -->',
        '- blog · https://jerromy.com',
        '<!-- 中間的註解，裡面的範例不算：',
        '- threads · https://www.threads.com/@jerromy',
        '-->',
        '- Bad · https://example.com',
        '<!-- 結尾的註解 -->',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩行（註解裡的 threads 不算）');
    assert.deepStrictEqual(result[0], BLOG);
    expectBad(result[1], { line: lineOf(rows, '- Bad · https://example.com'), raw: '- Bad · https://example.com', words: ['代號'] }, '註解後面的壞行（行號含註解行）');
});

// ───────────────────────── 第 2 次修補（派工人員 2026-10-02；--test-name-pattern "二修" 只跑這些） ─────────────────────────

test('B1.4 二修2 社群連結：落單的「-->」一筆壞紀錄（中間、關好的註解後面各一次）', () => {
    for (const rows of [
        ['- blog · https://jerromy.com', '-->', '- threads · https://www.threads.com/@jerromy'],
        ['- blog · https://jerromy.com', '<!-- 關好的註解 -->', '-->', '- threads · https://www.threads.com/@jerromy'],
    ]) {
        const result = parse(lines(rows));
        expectCount(result, 3, JSON.stringify(rows));
        assert.deepStrictEqual(result[0], BLOG);
        expectBad(result[1], { line: lineOf(rows, '-->'), raw: '-->', words: ['多出來', '-->'] }, '落單的 -->');
        assert.deepStrictEqual(result[2], { ok: true, code: 'threads', url: 'https://www.threads.com/@jerromy' });
    }
});

test('B1.4 二修細則 社群連結：「 · 」多一段算壞', () => {
    // 代號用 facebook：前後兩行是 blog 與 threads，用 blog 的話少了這條檢查也會被「代號重複」擋下來，量不到
    badLineCase('- facebook · https://www.facebook.com/jerromy · 臉書', [], '多一段');
});

test('B1.4 二修細則 社群連結：代號重複只跟好的比（前一條壞了，後面同代號的照常）', () => {
    const rows = ['- blog · http://jerromy.com', '- blog · https://jerromy.com'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩行');
    expectBad(result[0], { line: 1, raw: '- blog · http://jerromy.com', words: ['https'] }, '壞的那條');
    assert.deepStrictEqual(result[1], BLOG, '前一條壞了，這條不算重複');
});

// ───────────────────────── 第 3 次修補（派工人員 2026-10-02，檢查員抓到的；--test-name-pattern "三修" 只跑這些） ─────────────────────────

test('B1.4 三修D 社群連結：網址要像真的（範例、不完整、沒有點的主機名、夾空白都壞）', () => {
    for (const row of ['- facebook · https://…', '- facebook · https://...', '- facebook · https://www.facebook.com/…']) {
        badLineCase(row, ['範例或不完整'], row);
    }
    for (const row of ['- facebook · https://localhost', '- facebook · https://', '- facebook · https://face book.com/jerromy']) {
        badLineCase(row, [], row);
    }
});

test('B1.4 三修H 社群連結：落單的「-->」原因要提醒箭頭改寫成 → 或 ->', () => {
    const rows = ['- blog · https://jerromy.com', '-->'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩行');
    expectBad(result[1], { line: 2, raw: '-->', words: ['多出來', '-->', '→', '->'] }, '落單的 -->');
});

// ───────────────────────── 第 4 次修補（派工人員 2026-10-02，檢查員複查抓到的；--test-name-pattern "四修" 只跑這些） ─────────────────────────

test('B1.4 四修2 社群連結：點打錯，原因要點名實際用的字元（跟標題同一種寫法）', () => {
    const cases = [
        ['- facebook \u30FB https://www.facebook.com/jerromy', ['U+00B7', '\u30FB', 'U+30FB']],
        ['- facebook \u2022 https://www.facebook.com/jerromy', ['U+00B7', '\u2022', 'U+2022']],
        ['- facebook\u00A0·\u00A0https://www.facebook.com/jerromy', ['U+00A0']],
        ['- facebook\u3000·\u3000https://www.facebook.com/jerromy', ['U+3000']],
        ['- facebook·https://www.facebook.com/jerromy', ['兩邊各空一格']],
    ];
    for (const [row, words] of cases) badLineCase(row, words, JSON.stringify(row));
});

test('B1.4 四修2 社群連結：點的兩邊是 Tab，原因要講到 Tab（或 U+0009）', () => {
    const row = '- facebook\t·\thttps://www.facebook.com/jerromy';
    const result = parse(lines([row]));
    expectCount(result, 1, 'Tab');
    expectBad(result[0], { line: 1, raw: row }, 'Tab');
    assert.match(result[0].reason, /Tab|U\+0009/i, `reason 要點名 Tab，得到「${result[0].reason}」`);
});
