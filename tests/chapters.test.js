// 教學章節轉換 lib/chapters.js（目標檔 4-b2 的 B2.4；介面細則見 tests/README.md「4-b2」）。
//
// 量什麼：
//   B2.4 parseTimetable(text)：timetable-<語言>.txt 一行「m:ss 標題」→ { start（秒）, title（時間後面整段，含編號）}；h:mm:ss 也收；空白行略過、行號照算；
//        壞掉（缺時間、時間不是 m:ss／h:mm:ss、秒或分 ≥ 60、時間倒退或重複、只有時間沒有標題、雜行）丟 Error，訊息講出「第 N 行」與那一行原文。
//   B2.4 loadChaptersScript(sourceText)：在只有空 window 的 node:vm 沙箱裡跑 chapters.js，回傳 window.TUTORIAL_CHAPTERS；
//        沒有 TUTORIAL_CHAPTERS、少一種語言、list 不是陣列、章少了 name／desc、語法錯誤、無限迴圈（要逾時、5 秒內結束）都丟 Error；
//        沙箱裡沒有 process、require、module、Buffer。
//   B2.4 buildChapters({ chapters, timetables })：16 章的假專案 → 三語各 16 章 { id, name, desc, start, end }；
//        第 1 章從 0 起（開頭 7 秒併進 01，「開頭」不列成一章）、第 16 章的 end 是「結尾」那一行的時間（529）、結尾不列成一章、
//        每章 end ＝ 下一章 start、三語時間逐章相同、name 與 desc 取 chapters.js 的（不取時間表的寫法）、章名比對時去掉空白；
//        章數不是 16、三語章數不一致、某語言時間不同、編號對不上或沒寫、章名對不上、少一種語言的時間表、時間表格式壞掉 都丟 Error，
//        訊息講出哪一語言（zh／en／ja 或 中文／英文／日文）、哪一章（第 N 章）或哪一行（第 N 行）。
//   測 buildChapters 時 chapters 物件由測試自己跑 vm 拿（chapters-fixture.js），不靠 loadChaptersScript。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B2.4"
//   node --test tests/chapters.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { types } from 'node:util';
import { lib, lines } from './helpers.js';
import { PROJECT, SMALL, LANGS, STARTS, ENDS, readText, fixtureChapters, timetables, expected, plain, replaceLine } from './chapters-fixture.js';

const need = await lib('chapters.js', ['parseTimetable', 'loadChaptersScript', 'buildChapters']);

const LANG_WORD = { zh: /\bzh\b|中文/, en: /\ben\b|英文/, ja: /\bja\b|日文/ };
const lineWord = (n) => new RegExp(`第\\s*${n}\\s*行`);
const chapterWord = (n) => new RegExp(`第\\s*0?${n}\\s*章`);

// 要丟 Error（跨 realm 的也算），而且訊息講到每一個 pattern
function expectError(fn, patterns, label) {
    let err = null;
    let value;
    try { value = fn(); } catch (e) { err = e; }
    assert.ok(err !== null, `${label}：要丟 Error，結果沒丟，回傳了 ${JSON.stringify(plain(value))?.slice(0, 200)}`);
    assert.ok(types.isNativeError(err), `${label}：丟出來的要是 Error，得到 ${String(err)}`);
    for (const p of patterns) {
        const ok = p instanceof RegExp ? p.test(err.message) : err.message.includes(p);
        assert.ok(ok, `${label}：錯誤訊息要講到 ${p}，得到「${err.message}」`);
    }
    return err;
}

function build(mutate = {}) {
    const { buildChapters } = need();
    const chapters = mutate.chapters ?? fixtureChapters(PROJECT);
    const tables = { ...timetables(PROJECT), ...(mutate.timetables ?? {}) };
    return () => buildChapters({ chapters, timetables: tables });
}

// ── parseTimetable ──

test('B2.4 parseTimetable：一行一個 { start（秒）, title（含編號）}，開頭與結尾那兩行也在', () => {
    const { parseTimetable } = need();
    const text = lines(['0:00 開頭', '0:07 01 安裝到 Chrome', '0:35 02 打開側邊欄，選一個資料夾', '8:13 16 說明與求助', '8:49 結尾']);
    assert.deepEqual(plain(parseTimetable(text)), [
        { start: 0, title: '開頭' },
        { start: 7, title: '01 安裝到 Chrome' },
        { start: 35, title: '02 打開側邊欄，選一個資料夾' },
        { start: 493, title: '16 說明與求助' },
        { start: 529, title: '結尾' },
    ]);
});

test('B2.4 parseTimetable：分鐘可以兩位數以上，h:mm:ss 也收', () => {
    const { parseTimetable } = need();
    const text = lines(['0:00 Opening', '9:59 01 a', '10:05 02 b', '59:59 03 c', '1:00:00 04 d', '1:02:03 Ending']);
    assert.deepEqual(plain(parseTimetable(text)).map((r) => r.start), [0, 599, 605, 3599, 3600, 3723]);
});

test('B2.4 parseTimetable：空白行略過（開頭、中間、結尾、只有空白），結尾沒換行也可以', () => {
    const { parseTimetable } = need();
    const text = ['', '0:00 開頭', '', '   ', '0:07 01 a', '0:35 結尾'].join('\n');
    assert.deepEqual(plain(parseTimetable(text)), [
        { start: 0, title: '開頭' },
        { start: 7, title: '01 a' },
        { start: 35, title: '結尾' },
    ]);
});

test('B2.4 parseTimetable：假專案的三份時間表各 18 行（開頭＋16 章＋結尾）', () => {
    const { parseTimetable } = need();
    for (const lang of LANGS) {
        const rows = plain(parseTimetable(readText(PROJECT, `tutorial/preview/timetable-${lang}.txt`)));
        assert.equal(rows.length, 18, `${lang}：要 18 行`);
        assert.equal(rows[0].start, 0, `${lang}：第一行是 0:00`);
        assert.equal(rows[17].start, 529, `${lang}：最後一行是 8:49`);
    }
});

const BAD_TIMETABLES = [
    ['缺時間', ['0:00 開頭', '01 安裝到 Chrome', '0:35 結尾'], 2],
    ['秒只寫一位數', ['0:00 開頭', '0:7 01 a', '0:35 結尾'], 2],
    ['秒是 60', ['0:00 開頭', '1:60 01 a', '2:35 結尾'], 2],
    ['h:mm:ss 的分只寫一位數', ['0:00 開頭', '1:2:03 01 a', '2:00:00 結尾'], 2],
    ['h:mm:ss 的分是 60', ['0:00 開頭', '1:60:00 01 a', '3:00:00 結尾'], 2],
    ['用點不用冒號', ['0:00 開頭', '1.05 01 a', '2:35 結尾'], 2],
    ['時間倒退', ['0:00 開頭', '0:35 01 a', '0:20 02 b', '0:50 結尾'], 3],
    ['時間重複（零秒的章）', ['0:00 開頭', '0:35 01 a', '0:35 02 b', '0:50 結尾'], 3],
    ['只有時間沒有標題', ['0:00 開頭', '0:07', '0:35 結尾'], 2],
    ['雜行', ['0:00 開頭', '0:07 01 a', '這是雜行', '0:35 結尾'], 3],
    ['行號把空白行算進去', ['', '0:00 開頭', '', '雜行', '0:35 結尾'], 4],
];

for (const [label, rows, line] of BAD_TIMETABLES) {
    test(`B2.4 parseTimetable 壞掉要丟 Error 並講出哪一行：${label}`, () => {
        const { parseTimetable } = need();
        expectError(() => parseTimetable(lines(rows)), [lineWord(line), rows[line - 1].trim()], label);
    });
}

// ── loadChaptersScript ──

test('B2.4 loadChaptersScript：跑出 window.TUTORIAL_CHAPTERS（16 章的假 chapters.js）', () => {
    const { loadChaptersScript } = need();
    const got = plain(loadChaptersScript(readText(PROJECT, 'tutorial/chapters.js')));
    assert.deepEqual(got, fixtureChapters(PROJECT));
    for (const lang of LANGS) assert.equal(got[lang].list.length, 16, `${lang} 要 16 章`);
});

const GOOD_JSON = JSON.stringify(fixtureChapters(PROJECT));
const withChapters = (edit) => {
    const data = JSON.parse(GOOD_JSON);
    edit(data);
    return `window.TUTORIAL_CHAPTERS = ${JSON.stringify(data)};`;
};

const BAD_SCRIPTS = [
    ['沒有 TUTORIAL_CHAPTERS', 'var x = 1;', [/TUTORIAL_CHAPTERS/]],
    ['掛在別的名字上', `window.CHAPTERS = ${GOOD_JSON};`, [/TUTORIAL_CHAPTERS/]],
    ['少一種語言（ja）', withChapters((d) => { delete d.ja; }), [LANG_WORD.ja]],
    ['list 不是陣列', withChapters((d) => { d.zh.list = 'x'; }), [/list/]],
    ['有一章少了 desc', withChapters((d) => { delete d.en.list[2].desc; }), [/desc/]],
    ['有一章的 name 不是字串', withChapters((d) => { d.ja.list[4].name = 5; }), [/name/]],
    ['語法錯誤', 'window.TUTORIAL_CHAPTERS = {', []],
];

for (const [label, source, patterns] of BAD_SCRIPTS) {
    test(`B2.4 loadChaptersScript 跑不出來或結構不對要丟 Error：${label}`, () => {
        const { loadChaptersScript } = need();
        expectError(() => loadChaptersScript(source), patterns, label);
    });
}

test('B2.4 loadChaptersScript：無限迴圈會逾時、丟 Error（5 秒內結束）', () => {
    const { loadChaptersScript } = need();
    const t0 = Date.now();
    expectError(() => loadChaptersScript(`window.TUTORIAL_CHAPTERS = ${GOOD_JSON}; while (true) {}`), [/逾時|timed? ?out/i], '無限迴圈');
    const ms = Date.now() - t0;
    assert.ok(ms < 5000, `要在 5 秒內逾時，花了 ${ms} ms`);
});

test('B2.4 loadChaptersScript：沙箱裡沒有 process、require、module、Buffer', () => {
    const { loadChaptersScript } = need();
    const source = `window.TUTORIAL_CHAPTERS = ${GOOD_JSON};
window.TUTORIAL_CHAPTERS.probe = [typeof process, typeof require, typeof module, typeof Buffer];`;
    const got = plain(loadChaptersScript(source));
    assert.deepEqual(got.probe, ['undefined', 'undefined', 'undefined', 'undefined'],
        `沙箱漏了東西進去：typeof process／require／module／Buffer = ${JSON.stringify(got.probe)}`);
});

// ── buildChapters：正常 ──

test('B2.4 buildChapters：三語各 16 章 { id, name, desc, start, end }，整份對得上', () => {
    const got = plain(build()());
    assert.deepEqual(Object.keys(got ?? {}).sort(), ['en', 'ja', 'zh'], '要回傳 { zh, en, ja }');
    for (const lang of LANGS) {
        assert.ok(Array.isArray(got[lang]), `${lang} 要是陣列`);
        assert.equal(got[lang].length, 16, `${lang} 要 16 章`);
        assert.deepEqual(got[lang], expected(PROJECT, lang), `${lang} 的整份內容`);
    }
});

test('B2.4 buildChapters：開頭 7 秒併進第 1 章 —— 第 1 章從 0 起，「開頭」不列成一章', () => {
    const got = plain(build()());
    for (const lang of LANGS) {
        assert.equal(got[lang][0].id, '01', `${lang}：第一個是 01`);
        assert.equal(got[lang][0].start, 0, `${lang}：第 1 章要從 0 起（時間表寫 0:07，但開頭 7 秒要併進來）`);
        assert.equal(got[lang][0].end, 35, `${lang}：第 1 章到 0:35`);
        const intro = fixtureChapters(PROJECT)[lang].intro.name;
        assert.ok(!got[lang].some((c) => c.name === intro), `${lang}：「${intro}」不列成一章`);
    }
});

test('B2.4 buildChapters：第 16 章結束在「結尾」那一行（8:49＝529），結尾卡不列成一章', () => {
    const got = plain(build()());
    for (const lang of LANGS) {
        const last = got[lang][got[lang].length - 1];
        assert.equal(last.id, '16', `${lang}：最後一個是 16`);
        assert.equal(last.start, 493, `${lang}：第 16 章從 8:13 起`);
        assert.equal(last.end, 529, `${lang}：第 16 章的 end 是結尾那一行的時間`);
        const end = fixtureChapters(PROJECT)[lang].end.name;
        assert.ok(!got[lang].some((c) => c.name === end), `${lang}：「${end}」不列成一章`);
    }
});

test('B2.4 buildChapters：每章 end ＝ 下一章 start；三語時間逐章相同；id 是 01～16', () => {
    const got = plain(build()());
    for (const lang of LANGS) {
        assert.deepEqual(got[lang].map((c) => c.id), STARTS.map((_, i) => String(i + 1).padStart(2, '0')), `${lang} 的 id`);
        for (let i = 0; i + 1 < got[lang].length; i++) {
            assert.equal(got[lang][i].end, got[lang][i + 1].start, `${lang} 第 ${i + 1} 章的 end 要等於下一章的 start`);
        }
        assert.deepEqual(got[lang].map((c) => [c.start, c.end]), got.zh.map((c) => [c.start, c.end]), `${lang} 的時間要跟中文逐章相同`);
    }
    assert.deepEqual(got.zh.map((c) => c.end), ENDS);
});

test('B2.4 buildChapters：name、desc 取 chapters.js 的；章名比對去掉空白（時間表寫「存一則AI回覆」、chapters.js 是「存一則 AI 回覆」）', () => {
    const got = plain(build()());
    assert.equal(got.zh[5].name, '存一則 AI 回覆');
    assert.equal(got.ja[5].name, 'AI の返信を 1 件保存');
    assert.equal(got.en[4].name, '2 ways to save images', '英文章名以數字開頭，編號只取最前面那兩位');
    assert.equal(got.zh[0].desc, fixtureChapters(PROJECT).zh.list[0].desc, 'desc 原樣（含單引號、雙引號）');
});

// ── buildChapters：壞掉 ──

test('B2.4 buildChapters：章數不是 16 要丟 Error（4 章的假專案）', () => {
    const { buildChapters } = need();
    expectError(() => buildChapters({ chapters: fixtureChapters(SMALL), timetables: timetables(SMALL) }), [/16/], '4 章');
});

test('B2.4 buildChapters：chapters.js 某語言只有 15 章要丟 Error、講出哪一語言', () => {
    const chapters = fixtureChapters(PROJECT);
    chapters.en.list.pop();
    expectError(build({ chapters }), [LANG_WORD.en], 'en 少一章');
});

test('B2.4 buildChapters：三語章數不一致（中文時間表少一章）要丟 Error、講出哪一語言', () => {
    const zh = replaceLine(timetables(PROJECT).zh, '3:53 09 開專題', null);
    expectError(build({ timetables: { zh } }), [LANG_WORD.zh], '中文時間表少第 9 章');
});

test('B2.4 buildChapters：某語言的時間跟其他語言不同要丟 Error、講出哪一語言哪一章', () => {
    const ja = replaceLine(timetables(PROJECT).ja, '1:52 05 画像保存', '1:53 05 画像保存');
    // 第 5 章的起點晚一秒，第 4 章的終點也跟著晚一秒：講第 4 章或第 5 章都算講對
    expectError(build({ timetables: { ja } }), [LANG_WORD.ja, chapterWord('[45]')], '日文第 5 章晚一秒');
});

test('B2.4 buildChapters：某語言的結尾時間不同（第 16 章的 end）要丟 Error、講出哪一語言', () => {
    const en = replaceLine(timetables(PROJECT).en, '8:49 Ending', '8:50 Ending');
    expectError(build({ timetables: { en } }), [LANG_WORD.en], '英文結尾晚一秒');
});

test('B2.4 buildChapters：時間表標題的編號跟章序對不上要丟 Error、講出哪一語言哪一章', () => {
    const zh = replaceLine(timetables(PROJECT).zh, '1:01 03 存網頁', '1:01 04 存網頁');
    expectError(build({ timetables: { zh } }), [LANG_WORD.zh, chapterWord(3)], '中文第 3 章寫成 04');
});

test('B2.4 buildChapters：時間表標題沒寫編號要丟 Error、講出哪一語言哪一章', () => {
    const zh = replaceLine(timetables(PROJECT).zh, '1:01 03 存網頁', '1:01 存網頁');
    expectError(build({ timetables: { zh } }), [LANG_WORD.zh, chapterWord(3)], '中文第 3 章沒編號');
});

test('B2.4 buildChapters：時間表標題跟 chapters.js 的章名對不上要丟 Error、講出哪一語言哪一章', () => {
    const en = replaceLine(timetables(PROJECT).en, '1:25 04 Save text', '1:25 04 Save texts');
    expectError(build({ timetables: { en } }), [LANG_WORD.en, chapterWord(4)], '英文第 4 章多一個 s');
});

test('B2.4 buildChapters：少一種語言的時間表要丟 Error、講出哪一語言', () => {
    const { buildChapters } = need();
    const tables = timetables(PROJECT);
    delete tables.ja;
    expectError(() => buildChapters({ chapters: fixtureChapters(PROJECT), timetables: tables }), [LANG_WORD.ja], '沒有 ja 的時間表');
});

test('B2.4 buildChapters：時間表格式壞掉要丟 Error、講出哪一語言與第幾行', () => {
    const ja = replaceLine(timetables(PROJECT).ja, '1:01 03 ページ保存', '1:01 03 ページ保存\nこれは雑な行');
    expectError(build({ timetables: { ja } }), [LANG_WORD.ja, lineWord(5), 'これは雑な行'], '日文第 5 行是雜行');
});

// ── 檢查員第 1 輪補的 ──

test('B2.4 buildChapters：開頭那一行的時間不是 0:00 要丟 Error、講出哪一語言、第幾行與原文', () => {
    const zh = replaceLine(timetables(PROJECT).zh, '0:00 開頭', '0:03 開頭');
    expectError(build({ timetables: { zh } }), [LANG_WORD.zh, lineWord(1), '0:03 開頭'], '中文開頭寫 0:03');
    // 前面有空白行時，行號照原檔算（第 2 行），不是寫死第 1 行
    const ja = replaceLine(timetables(PROJECT).ja, '0:00 オープニング', '\n0:01 オープニング');
    expectError(build({ timetables: { ja } }), [LANG_WORD.ja, lineWord(2), '0:01 オープニング'], '日文開頭寫 0:01、前面有空行');
});

test('B2.4 buildChapters：開頭與結尾那兩行的標題不檢查（各語言寫法不同）', () => {
    const tables = timetables(PROJECT);
    const en = replaceLine(replaceLine(tables.en, '0:00 Opening', '0:00 Intro'), '8:49 Ending', '8:49 The end');
    const zh = replaceLine(replaceLine(tables.zh, '0:00 開頭', '0:00 片頭'), '8:49 結尾', '8:49 片尾');
    const got = plain(build({ timetables: { en, zh } })());
    for (const lang of LANGS) assert.deepEqual(got[lang], expected(PROJECT, lang), `${lang} 照常產出`);
});

// CRLF 與 BOM：用假專案的時間表（內容跟真的教學片同一個形狀）換成 CRLF、加 BOM
const BOM = String.fromCharCode(0xFEFF);
const crlf = (text) => text.replace(/\n/g, '\r\n');

test('B2.4 parseTimetable：CRLF 行尾、開頭有 BOM，結果跟 LF 版一模一樣', () => {
    const { parseTimetable } = need();
    for (const lang of LANGS) {
        const lf = timetables(PROJECT)[lang];
        const want = plain(parseTimetable(lf));
        assert.deepEqual(plain(parseTimetable(crlf(lf))), want, `${lang}：CRLF`);
        assert.deepEqual(plain(parseTimetable(BOM + lf)), want, `${lang}：BOM`);
        assert.deepEqual(plain(parseTimetable(BOM + crlf(lf))), want, `${lang}：BOM＋CRLF`);
    }
});

test('B2.4 parseTimetable：CRLF 時壞行的訊息照樣講第幾行，原文不帶 \\r', () => {
    const { parseTimetable } = need();
    const err = expectError(() => parseTimetable(crlf(lines(['0:00 開頭', '0:07 01 a', '雜行', '0:35 結尾']))), [lineWord(3), '雜行'], 'CRLF 的雜行');
    assert.ok(!err.message.includes('\r'), `訊息裡不能有 \\r：${JSON.stringify(err.message)}`);
});

test('B2.4 buildChapters：三份時間表都是 CRLF＋BOM，結果跟 LF 版一模一樣', () => {
    const tables = timetables(PROJECT);
    const odd = {};
    for (const lang of LANGS) odd[lang] = BOM + crlf(tables[lang]);
    const got = plain(build({ timetables: odd })());
    for (const lang of LANGS) assert.deepEqual(got[lang], expected(PROJECT, lang), `${lang}：CRLF＋BOM`);
});
