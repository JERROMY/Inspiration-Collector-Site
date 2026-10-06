// lib/changelog.js 的 parseChangelog(text) —— 更新紀錄（規格書第 7 節、第 12 區）。
//
// 量什麼（編號照目標檔 4-b1 的測試案例）：
//   B1.1 格式正確的文字讀得出來：每個「## 版本 · 日期」一筆 { ok: true, version, date, items }，順序跟檔案一樣；
//        items 每條 { ok: true, kind, text }，kind 是冒號前的字（全形「：」與半形「:」都算，英文檔寫 Fixed:），
//        沒有冒號的整行當 text、kind 是空字串；版本號 x.y.z 可以多位數；閏年的 2 月 29 日算真的日期。
//   B1.4 寫壞一條只壞那一條：缺日期、日期不是 YYYY-MM-DD、日曆上不存在的日期、版本號不是 x.y.z、
//        版本裡的亂碼行（只壞那一條 item）、第一個「##」之前的雜字、整檔空白。
//        每條先量「條目數＝好的＋壞的」（靜靜略過會紅在這一步），再量壞紀錄 { ok: false, line, raw, reason }：
//        line 是原檔行號、raw 是那一行原文（比對時去掉頭尾空白）、reason 是中文而且講到壞的那一欄（「日期」「版本」）。
//        版本標題壞掉時，整個區塊算一筆壞紀錄，底下的「- 」行不另外算。
//   B1.6 檔頭的 <!-- … --> 註解（多行、單行都測）不當條目、不算錯；註解裡的格式範例不會被讀成真的版本；
//        註解行也算進行號。
//
//   第 1 次修補（名稱帶「修補N」，N 是派工人員那九條的編號；細則見 tests/README.md）：
//        修補1 註解沒關起來 → 註解開頭那行一筆壞紀錄（reason 講到「註解」「-->」），之後照常解析；
//        修補3 tests/fixtures/crlf-bom/changelog.zh.md（CRLF＋BOM）跟 LF 版結果一樣；修補4 標題多一段算壞；
//        修補6 版本底下沒條目算好的（items: []）；修補7 冒號後面緊接 // 的不算分隔；
//        修補8 連續的雜字一行一筆；修補9 註解在任何位置都去掉、行號不變。
//
//   第 2 次修補（名稱帶「二修」）：落單的「-->」一筆壞紀錄（最上層或那版的 item 都可以，只能一筆，reason 講「多出來」「-->」）；
//        「- 修好：」冒號後空的、「- 」後面沒字那一條壞；kind 只看第一個冒號（後面緊接 // 就沒有 kind、不往後找）；
//        年份 0000 壞；版本底下的「###」是壞 item。
//
//   第 3 次修補（名稱帶「三修」＋字母；細則見 tests/README.md 第 37 條起）：A 版本標題寫壞自己開壞區塊、條目跟著它；
//        B 標題的點打錯要點名字元；E 版本號重複（只跟好的比）；G 10:30 的冒號不算分隔。
//
//   第 4 次修補（名稱帶「四修」）：「##」後面沒空格一律自己開壞區塊（上一版照常、檔案最上面也一樣）。
//
//   第 5 次修補（名稱帶「五修」）：全形井號「＃」開頭的行一律自己開壞區塊（上一版照常、檔案最上面也一樣）。
//
// 跑法（在 homepage/site/）：
//   npm test                                       整套
//   npm test -- --test-name-pattern "B1.4"          只跑某一條（Windows 的 cmd 一樣）
//   npm test -- --test-name-pattern "修補"           只跑第 1 次修補的案例
//   npm test -- --test-name-pattern "二修"           只跑第 2 次修補的案例
//   npm test -- --test-name-pattern "三修"           只跑第 3 次修補的案例
//   npm test -- --test-name-pattern "四修"           只跑第 4 次修補的案例
//   npm test -- --test-name-pattern "五修"           只跑第 5 次修補的案例
//   node --test tests/changelog.test.js             只跑這支
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib, lines, lineOf, noThrow, expectCount, expectBad, crlfBom } from './helpers.js';

const need = await lib('changelog.js', ['parseChangelog']);

// 〔派工 4-b10〕好的條目多了 raw（使用者寫的整行去掉「- 」與頭尾空白，細則在 changelog-raw.test.js）。
// 這支量的是其他欄位，比之前先確認每一條好的條目都有字串的 raw，再把它拿掉 —— 原本的期待值不用一條一條改
function parse(text) {
    const { parseChangelog } = need();
    const result = noThrow('parseChangelog', () => parseChangelog(text));
    for (const version of result) {
        if (!version.ok) continue;
        for (const item of version.items) {
            if (!item.ok) continue;
            assert.equal(typeof item.raw, 'string', `好的條目要有字串的 raw（4-b10），得到 ${JSON.stringify(item)}`);
            delete item.raw;
        }
    }
    return result;
}

// ───────────────────────── B1.1 ─────────────────────────

test('B1.1 更新紀錄讀得出來：版本、日期、一行一條，順序跟檔案一樣', () => {
    const rows = [
        '## 1.0.5 · 2026-10-02',
        '- 修好：ChatGPT 改版後「存這則」不見了',
        '- 新增：資料夾被刪掉時回到挑資料夾的畫面',
        '- 三種語言的版面都重新排過',
        '',
        '## 1.0.4 · 2026-09-30',
        '- 修好：選取文字後浮出的按鈕拿掉了',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩版');
    assert.deepStrictEqual(result, [
        {
            ok: true, version: '1.0.5', date: '2026-10-02', items: [
                { ok: true, kind: '修好', text: 'ChatGPT 改版後「存這則」不見了' },
                { ok: true, kind: '新增', text: '資料夾被刪掉時回到挑資料夾的畫面' },
                { ok: true, kind: '', text: '三種語言的版面都重新排過' },
            ],
        },
        {
            ok: true, version: '1.0.4', date: '2026-09-30', items: [
                { ok: true, kind: '修好', text: '選取文字後浮出的按鈕拿掉了' },
            ],
        },
    ]);
});

test('B1.1 英文檔的半形冒號、日文檔的全形冒號都分得出 kind', () => {
    const en = parse(lines(['## 1.0.5 · 2026-10-02', '- Fixed: The "Save this" button is back on ChatGPT']));
    expectCount(en, 1, '英文');
    assert.deepStrictEqual(en[0].items, [{ ok: true, kind: 'Fixed', text: 'The "Save this" button is back on ChatGPT' }]);

    const ja = parse(lines(['## 1.0.5 · 2026-10-02', '- 修正：ChatGPT の「この回答を保存」が戻りました']));
    expectCount(ja, 1, '日文');
    assert.deepStrictEqual(ja[0].items, [{ ok: true, kind: '修正', text: 'ChatGPT の「この回答を保存」が戻りました' }]);
});

test('B1.1 版本號 x.y.z 可以多位數；閏年的 2 月 29 日是真的日期', () => {
    const result = parse(lines(['## 10.20.300 · 2028-02-29', '- 新增：a']));
    expectCount(result, 1, '多位數版本號');
    assert.deepStrictEqual(result[0], { ok: true, version: '10.20.300', date: '2028-02-29', items: [{ ok: true, kind: '新增', text: 'a' }] });
});

// ───────────────────────── B1.4 ─────────────────────────

// 壞的版本標題放在第一個，後面接一個好的：壞的只壞自己，好的照常
function badHeaderCase(header, words, label) {
    const rows = [header, '- 修好：a', '', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, label);
    expectBad(result[0], { line: 1, raw: header, words }, label);
    assert.deepStrictEqual(result[1], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'b' }] },
        `${label}：後面那個好的版本要照常`);
}

test('B1.4 更新紀錄：缺日期', () => {
    badHeaderCase('## 1.0.5', ['日期'], '缺日期');
});

test('B1.4 更新紀錄：日期不是 YYYY-MM-DD', () => {
    for (const date of ['2026/10/02', '2026-10-2', '10-02-2026', '2026年10月2日']) {
        badHeaderCase(`## 1.0.5 · ${date}`, ['日期'], `日期寫成 ${date}`);
    }
});

test('B1.4 更新紀錄：日曆上不存在的日期', () => {
    for (const date of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00']) {
        badHeaderCase(`## 1.0.5 · ${date}`, ['日期'], `日期 ${date}`);
    }
});

test('B1.4 更新紀錄：版本號不是 x.y.z', () => {
    for (const version of ['1.0', 'v1.0.5', '1.0.5.1', '1.0.5-beta', '一點零點五']) {
        badHeaderCase(`## ${version} · 2026-10-02`, ['版本'], `版本號 ${version}`);
    }
});

test('B1.4 更新紀錄：版本裡的亂碼行只壞那一條 item', () => {
    const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', '@@ ### ~~~ 亂碼 ]]]', '- 新增：b', '', '## 1.0.4 · 2026-09-30', '- 修好：c'];
    const result = parse(lines(rows));
    expectCount(result, 2, '版本數');
    assert.equal(result[0].ok, true, '版本標題是對的，整版照常');
    assert.equal(result[0].version, '1.0.5');
    expectCount(result[0].items, 3, '1.0.5 的條目（好的兩條＋壞的一條）');
    assert.deepStrictEqual(result[0].items[0], { ok: true, kind: '修好', text: 'a' });
    expectBad(result[0].items[1], { line: lineOf(rows, '@@ ### ~~~ 亂碼 ]]]'), raw: '@@ ### ~~~ 亂碼 ]]]' }, '亂碼行');
    assert.deepStrictEqual(result[0].items[2], { ok: true, kind: '新增', text: 'b' });
    assert.deepStrictEqual(result[1].items, [{ ok: true, kind: '修好', text: 'c' }], '下一版照常');
});

test('B1.4 更新紀錄：第一個「##」之前的雜字也要有一筆壞紀錄', () => {
    const rows = ['隨手寫的一行字', '', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, '雜字＋一版');
    expectBad(result[0], { line: 1, raw: '隨手寫的一行字' }, '雜字');
    assert.equal(result[1].ok, true);
    assert.equal(result[1].version, '1.0.4');
});

test('B1.4 更新紀錄：整檔空白回空陣列、不丟例外', () => {
    for (const text of ['', '\n\n   \n\t\n']) {
        expectCount(parse(text), 0, `整檔空白 ${JSON.stringify(text)}`);
    }
});

// ───────────────────────── B1.6 ─────────────────────────

test('B1.6 更新紀錄：檔頭多行註解不當條目，註解裡的格式範例不會變成版本，行號照原檔算', () => {
    const rows = [
        '<!--',
        '這支檔是「更新紀錄」，網站的更新紀錄那一區照這裡排。最新的寫在最上面。',
        '格式：一版一個標題，底下一行一條，例如：',
        '## 1.0.5 · 2026-10-02',
        '- 修好：…',
        '改完存檔，通常幾分鐘後網站更新，最久約 20 分鐘。',
        '-->',
        '',
        '## 1.0.4 · 2026-09-30',
        '- 修好：a',
        '這行沒有「- 」',
    ];
    const result = parse(lines(rows));
    expectCount(result, 1, '只有註解後面那一版');
    assert.equal(result[0].ok, true);
    assert.equal(result[0].version, '1.0.4', '註解裡的 1.0.5 是範例，不是真的版本');
    expectCount(result[0].items, 2, '1.0.4 的條目');
    assert.deepStrictEqual(result[0].items[0], { ok: true, kind: '修好', text: 'a' });
    expectBad(result[0].items[1], { line: lineOf(rows, '這行沒有「- 」'), raw: '這行沒有「- 」' }, '註解後面的壞行（行號含註解行）');
});

test('B1.6 更新紀錄：單行註解也一樣', () => {
    const rows = ['<!-- 更新紀錄：一版一個「## 1.0.5 · 2026-10-02」，底下「- 修好：…」 -->', '## 1.0.4 · 2026-09-30', '- 修好：a'];
    const result = parse(lines(rows));
    expectCount(result, 1, '單行註解');
    assert.deepStrictEqual(result[0], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'a' }] });
});

test('B1.6 更新紀錄：只有註解的檔是零筆、不算錯', () => {
    const result = parse(lines(['<!--', '## 1.0.5 · 2026-10-02', '- 修好：…', '-->']));
    expectCount(result, 0, '只有註解');
});

// ───────────────────────── 第 1 次修補（派工人員 2026-10-02 的九條決定；--test-name-pattern "修補" 只跑這些） ─────────────────────────

test('B1.4 修補1 更新紀錄：註解沒關起來（缺 -->）回一筆壞紀錄，後面的內容照常解析', () => {
    const rows = ['<!--', '說明：一版一個標題', '## 1.0.4 · 2026-09-30', '- 修好：a'];
    const result = parse(lines(rows));
    expectCount(result, 3, '註解開頭＋被當成雜字的說明＋一版（不准整支靜靜變零筆）');
    expectBad(result[0], { line: 1, raw: '<!--', words: ['註解', '-->'] }, '沒關的註解');
    expectBad(result[1], { line: 2, raw: '說明：一版一個標題' }, '註解開頭之後的雜字照常當內容');
    assert.deepStrictEqual(result[2], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'a' }] });
});

test('B1.4 修補3 更新紀錄：CRLF 行尾＋UTF-8 BOM 的結果（含行號）跟 LF 版一模一樣', () => {
    const { crlf, lf } = crlfBom('changelog.zh.md');
    const want = parse(lf);
    expectCount(want, 2, 'LF 版（防呆：fixture 有一個好版本、一個壞版本）');
    assert.equal(want[0].ok, true);
    assert.equal(want[1].ok, false);
    assert.deepStrictEqual(parse(crlf), want, 'CRLF＋BOM 版要跟 LF 版一樣（raw 不能帶 \\r、第一行的 BOM 不能讓註解失效）');
});

test('B1.4 修補4 更新紀錄：標題「版本 · 日期」只能剛好兩段，多一段算壞', () => {
    badHeaderCase('## 1.0.5 · 2026-10-02 · 多一段', [], '多一段');
});

test('B1.1 修補6 版本底下一條都沒有也算好的（items 是空陣列）', () => {
    const rows = ['## 1.0.5 · 2026-10-02', '', '## 1.0.4 · 2026-09-30', '- 修好：a'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩版');
    assert.deepStrictEqual(result[0], { ok: true, version: '1.0.5', date: '2026-10-02', items: [] });
    assert.deepStrictEqual(result[1], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'a' }] });
});

test('B1.1 修補7 kind：冒號後面緊接著 // 的不算分隔，其餘取第一個全形或半形冒號之前', () => {
    const rows = [
        '## 1.0.5 · 2026-10-02',
        '- See https://jerromy.com/collector/',
        '- 參考 http://example.com/a',
        '- 修好：見 https://jerromy.com/',
        '- Fixed: https://jerromy.com/',
        '- Note: see https://x.com/a',
    ];
    const result = parse(lines(rows));
    expectCount(result, 1, '一版');
    assert.deepStrictEqual(result[0].items, [
        { ok: true, kind: '', text: 'See https://jerromy.com/collector/' },
        { ok: true, kind: '', text: '參考 http://example.com/a' },
        { ok: true, kind: '修好', text: '見 https://jerromy.com/' },
        { ok: true, kind: 'Fixed', text: 'https://jerromy.com/' },
        { ok: true, kind: 'Note', text: 'see https://x.com/a' },
    ]);
});

test('B1.4 修補8 更新紀錄：連續好幾行雜字，每一行各一筆壞紀錄', () => {
    const rows = ['雜字一', '雜字二', '', '雜字三', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 4, '三行雜字＋一版');
    for (const [i, row] of ['雜字一', '雜字二', '雜字三'].entries()) {
        expectBad(result[i], { line: lineOf(rows, row), raw: row }, row);
    }
    assert.equal(result[3].ok, true);
});

test('B1.6 修補9 更新紀錄：註解在任何位置（開頭前有空行、版本中間、兩版之間、結尾）都去掉，行號不變', () => {
    const rows = [
        '',
        '',
        '<!-- 開頭前面有空行 -->',
        '## 1.0.5 · 2026-10-02',
        '- 修好：a',
        '<!-- 版本中間的註解，裡面的範例不算：',
        '- 修好：這行是註解裡的範例',
        '## 9.9.9 · 2026-01-01',
        '-->',
        '- 新增：b',
        '亂碼行',
        '',
        '<!-- 兩版中間 -->',
        '## 1.0.4 · 2026-09-30',
        '- 修好：c',
        '<!-- 結尾的註解 -->',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩版（註解裡的 9.9.9 不算）');
    assert.equal(result[0].ok, true);
    expectCount(result[0].items, 3, '1.0.5 的條目（a、b、亂碼行）');
    assert.deepStrictEqual(result[0].items[0], { ok: true, kind: '修好', text: 'a' });
    assert.deepStrictEqual(result[0].items[1], { ok: true, kind: '新增', text: 'b' });
    expectBad(result[0].items[2], { line: lineOf(rows, '亂碼行'), raw: '亂碼行' }, '註解後面的壞行（行號含註解行）');
    assert.deepStrictEqual(result[1], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'c' }] });
});

// ───────────────────────── 第 2 次修補（派工人員 2026-10-02；--test-name-pattern "二修" 只跑這些） ─────────────────────────

// 所有壞紀錄（最上層與版本裡的 item），依出現順序
function allBad(result) {
    const out = [];
    for (const rec of result) {
        if (rec.ok === false) out.push(rec);
        else for (const it of rec.items ?? []) if (it.ok === false) out.push(it);
    }
    return out;
}

test('B1.4 二修2 更新紀錄：落單的「-->」一筆壞紀錄（開頭被刪掉的說明、版本中間各一次）', () => {
    // 檔頭說明的 <!-- 被刪掉：說明行與 --> 都在第一個 ## 之前，是最上層的壞紀錄
    const top = ['說明：一版一個標題', '-->', '## 1.0.4 · 2026-09-30', '- 修好：a'];
    const r1 = parse(lines(top));
    expectCount(r1, 3, '說明＋落單的 -->＋一版');
    expectBad(r1[0], { line: 1, raw: '說明：一版一個標題' }, '說明行');
    expectBad(r1[1], { line: 2, raw: '-->', words: ['多出來', '-->'] }, '落單的 -->');
    assert.deepStrictEqual(r1[2], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'a' }] });

    // 版本中間：算最上層的一筆或算那版的一條 item 都可以，但只能一筆、原因要講「多出來的 -->」，那版本身照常
    const mid = ['## 1.0.5 · 2026-10-02', '- 修好：a', '-->', '- 新增：b'];
    const r2 = parse(lines(mid));
    assert.equal(r2[0].ok, true, '版本照常');
    const bads = allBad(r2);
    assert.equal(bads.length, 1, `只能一筆壞紀錄，得到 ${JSON.stringify(bads)}`);
    expectBad(bads[0], { line: 3, raw: '-->', words: ['多出來', '-->'] }, '版本中間落單的 -->');
    assert.deepStrictEqual(r2[0].items.filter((it) => it.ok), [{ ok: true, kind: '修好', text: 'a' }, { ok: true, kind: '新增', text: 'b' }]);
});

test('B1.4 二修細則 更新紀錄：「- 修好：」冒號後面是空的、「- 」後面沒字，那一條壞', () => {
    for (const row of ['- 修好：', '- 修好：   ', '- Fixed:', '- ', '-']) {
        const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', row, '- 新增：b'];
        const result = parse(lines(rows));
        expectCount(result, 1, JSON.stringify(row));
        assert.equal(result[0].ok, true, `${JSON.stringify(row)}：版本照常`);
        expectCount(result[0].items, 3, `${JSON.stringify(row)}：條目`);
        expectBad(result[0].items[1], { line: 3, raw: row }, JSON.stringify(row));
        assert.deepStrictEqual(result[0].items[2], { ok: true, kind: '新增', text: 'b' }, '後面那條照常');
    }
});

test('B1.1 二修細則 kind 只看第一個冒號：它後面緊接 // 就整行沒有 kind，不往後找下一個冒號', () => {
    const result = parse(lines(['## 1.0.5 · 2026-10-02', '- See https://jerromy.com/ 修好：a', '- 修好：見 https://x.com/ 新增：b']));
    expectCount(result, 1, '一版');
    assert.deepStrictEqual(result[0].items, [
        { ok: true, kind: '', text: 'See https://jerromy.com/ 修好：a' },
        { ok: true, kind: '修好', text: '見 https://x.com/ 新增：b' },
    ]);
});

test('B1.4 二修細則 更新紀錄：年份 0000 算壞', () => {
    badHeaderCase('## 1.0.5 · 0000-01-01', ['日期'], '年份 0000');
});

test('B1.4 二修細則 更新紀錄：版本底下的「###」是壞 item（不是新的一版）', () => {
    const rows = ['## 1.0.5 · 2026-10-02', '### 修好', '- 修好：a'];
    const result = parse(lines(rows));
    expectCount(result, 1, '一版');
    assert.equal(result[0].ok, true);
    expectCount(result[0].items, 2, '條目');
    expectBad(result[0].items[0], { line: 2, raw: '### 修好' }, '###');
    assert.deepStrictEqual(result[0].items[1], { ok: true, kind: '修好', text: 'a' });
});

// ───────────────────────── 第 3 次修補（派工人員 2026-10-02，檢查員抓到的；--test-name-pattern "三修" 只跑這些） ─────────────────────────

test('B1.4 三修A 更新紀錄：版本標題寫壞的那行自己開一個壞區塊，底下的條目跟著它，不併進上一版', () => {
    const variants = [
        '##1.0.4 · 2026-09-30',
        '# 1.0.4 · 2026-09-30',
        '### 1.0.4 · 2026-09-30',
        '1.0.4 · 2026-09-30',
        '1.0.4\u30FB2026-09-30',
        '#1.0.4 \u2022 2026-09-30',
    ];
    for (const head of variants) {
        const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', head, '- 修好：屬於寫壞的那版', '亂碼也屬於它', '', '## 1.0.3 · 2026-09-25', '- 新增：c'];
        const result = parse(lines(rows));
        expectCount(result, 3, `${head}：上一版＋寫壞的那版＋好的那版（底下的條目不另外報錯）`);
        assert.deepStrictEqual(result[0], { ok: true, version: '1.0.5', date: '2026-10-02', items: [{ ok: true, kind: '修好', text: 'a' }] },
            `${head}：上一版照常，寫壞那版的條目不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: ['看起來是新的', '##'] }, head);
        assert.deepStrictEqual(result[2], { ok: true, version: '1.0.3', date: '2026-09-25', items: [{ ok: true, kind: '新增', text: 'c' }] });
    }
});

test('B1.4 三修B 更新紀錄：標題的點打錯，原因要點名實際用的字元', () => {
    const cases = [
        ['## 1.0.5 \u30FB 2026-10-02', ['U+00B7', '\u30FB', 'U+30FB']],
        ['## 1.0.5 \u2022 2026-10-02', ['U+00B7', '\u2022', 'U+2022']],
        ['## 1.0.5\u3000·\u30002026-10-02', ['U+3000']],
        ['## 1.0.5·2026-10-02', ['兩邊各空一格']],
    ];
    for (const [header, words] of cases) badHeaderCase(header, words, JSON.stringify(header));
});

test('B1.4 三修E 更新紀錄：版本號重複，先出現的算數，後面那版整版壞', () => {
    const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', '## 1.0.5 · 2026-10-03', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩版');
    assert.deepStrictEqual(result[0], { ok: true, version: '1.0.5', date: '2026-10-02', items: [{ ok: true, kind: '修好', text: 'a' }] });
    expectBad(result[1], { line: 3, raw: '## 1.0.5 · 2026-10-03', words: ['版本重複'] }, '重複的版本');
});

test('B1.4 三修E 更新紀錄：版本號重複只跟好的比（前一版壞了，後面同版本號的照常；再下一版才算重複）', () => {
    const rows = ['## 1.0.5 · 2026-02-30', '- 修好：a', '## 1.0.5 · 2026-10-02', '- 修好：b', '## 1.0.5 · 2026-10-03', '- 修好：c'];
    const result = parse(lines(rows));
    expectCount(result, 3, '三版');
    expectBad(result[0], { line: 1, raw: '## 1.0.5 · 2026-02-30', words: ['日期'] }, '日期壞的那版');
    assert.deepStrictEqual(result[1], { ok: true, version: '1.0.5', date: '2026-10-02', items: [{ ok: true, kind: '修好', text: 'b' }] },
        '前一版壞了，這版不算重複');
    expectBad(result[2], { line: 5, raw: '## 1.0.5 · 2026-10-03', words: ['版本重複'] }, '第三版才是重複');
});

test('B1.1 三修G kind：兩個數字之間的半形冒號（10:30）不算分隔', () => {
    const result = parse(lines(['## 1.0.5 · 2026-10-02', '- 10:30 起維護一小時', '- 修好：10:30 的排程', '- Fixed: crash at 10:30', '- 維護時間 9:00 到 10:30']));
    expectCount(result, 1, '一版');
    assert.deepStrictEqual(result[0].items, [
        { ok: true, kind: '', text: '10:30 起維護一小時' },
        { ok: true, kind: '修好', text: '10:30 的排程' },
        { ok: true, kind: 'Fixed', text: 'crash at 10:30' },
        { ok: true, kind: '', text: '維護時間 9:00 到 10:30' },
    ]);
});

test('B1.4 三修A 更新紀錄：寫壞的標題在檔案最上面（第一個「##」之前）也自己開壞區塊，底下的條目歸它、不另外各報雜字', () => {
    const rows = ['# 1.0.5 · 2026-10-02', '- 修好：a', '亂碼也屬於它', '', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那版＋好的那版（底下的條目不各算一筆雜字）');
    expectBad(result[0], { line: 1, raw: '# 1.0.5 · 2026-10-02', words: ['看起來是新的', '##'] }, '最上面寫壞的標題');
    assert.deepStrictEqual(result[1], { ok: true, version: '1.0.4', date: '2026-09-30', items: [{ ok: true, kind: '修好', text: 'b' }] });
});

// ───────────────────────── 第 4 次修補（派工人員 2026-10-02，檢查員複查抓到的；--test-name-pattern "四修" 只跑這些） ─────────────────────────

test('B1.4 四修1 更新紀錄：「##」後面沒空格，不管後面長什麼樣都自己開壞區塊，底下的條目歸它、不併進上一版', () => {
    for (const head of ['##1.0.4 2026-09-30', '##更新紀錄', '##v1.0.4', '  ##1.0.4 · 2026-09-30']) {
        const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', head, '- 修好：屬於寫壞的那版', '', '## 1.0.3 · 2026-09-25', '- 新增：c'];
        const result = parse(lines(rows));
        expectCount(result, 3, `${head}：上一版＋寫壞的那版＋好的那版`);
        assert.deepStrictEqual(result[0], { ok: true, version: '1.0.5', date: '2026-10-02', items: [{ ok: true, kind: '修好', text: 'a' }] },
            `${head}：上一版照常，寫壞那版的條目不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: ['##', '空一格'] }, head);
        assert.deepStrictEqual(result[2], { ok: true, version: '1.0.3', date: '2026-09-25', items: [{ ok: true, kind: '新增', text: 'c' }] });
    }
});

test('B1.4 四修1 更新紀錄：檔案最上面的「##」後面沒空格也一樣', () => {
    const rows = ['##更新紀錄', '- 修好：屬於它', '', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那版＋好的那版（底下的條目不各算一筆雜字）');
    expectBad(result[0], { line: 1, raw: '##更新紀錄', words: ['##', '空一格'] }, '最上面');
    assert.equal(result[1].ok, true);
});

// ───────────────────────── 第 5 次修補（派工人員 2026-10-02；--test-name-pattern "五修" 只跑這些） ─────────────────────────

const FW_REASON = ['半形', '\uFF03'];

test('B1.4 五修 更新紀錄：全形井號「\uFF03」開頭的行自己開壞區塊，底下的條目歸它、不併進上一版', () => {
    for (const head of ['\uFF03\uFF03 1.0.4 · 2026-09-30', '\uFF03\uFF031.0.4 · 2026-09-30', '\uFF03 1.0.4', '  \uFF03\uFF03 更新紀錄']) {
        const rows = ['## 1.0.5 · 2026-10-02', '- 修好：a', head, '- 修好：屬於寫壞的那版', '', '## 1.0.3 · 2026-09-25', '- 新增：c'];
        const result = parse(lines(rows));
        expectCount(result, 3, `${JSON.stringify(head)}：上一版＋寫壞的那版＋好的那版`);
        assert.deepStrictEqual(result[0], { ok: true, version: '1.0.5', date: '2026-10-02', items: [{ ok: true, kind: '修好', text: 'a' }] },
            `${JSON.stringify(head)}：上一版照常，寫壞那版的條目不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: FW_REASON }, JSON.stringify(head));
        assert.deepStrictEqual(result[2], { ok: true, version: '1.0.3', date: '2026-09-25', items: [{ ok: true, kind: '新增', text: 'c' }] });
    }
});

test('B1.4 五修 更新紀錄：檔案最上面的全形井號也一樣', () => {
    const rows = ['\uFF03\uFF03 1.0.5 · 2026-10-02', '- 修好：屬於它', '', '## 1.0.4 · 2026-09-30', '- 修好：b'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那版＋好的那版（底下的條目不各算一筆雜字）');
    expectBad(result[0], { line: 1, raw: rows[0], words: FW_REASON }, '最上面');
    assert.equal(result[1].ok, true);
});
