// 拉丁字型要收哪些字（目標檔 4-b6 的 B6.2、B6.3；派工 2026-10-02 第三版：中日文走系統字型，網頁字型只收「非中日文字元」）。純函式，不讀檔。
// 介面細則見 tests/README.md「4-b6」。
//
// lib/font-text.js（npm run fonts 與 npm run fonts:budget 共用，兩邊收字的規則一定要一樣）：
//   charsOf(text)  text 裡出現過的字，以碼位算（𠮷 是一個字）、不重複、照碼位由小到大，回傳字串陣列；空白（/\s/u，含全形空白 U+3000、BOM U+FEFF）不算。
//                  text 不是字串 → TypeError。
//   isCjk(ch)      ch（一個字）是不是「中日文」：碼位落在 b6-font-fixture.js 的 CJK 那幾段（CJK 部首與符號、CJK 標點 U+3000～303F、平假名、片假名、注音、
//                  CJK 筆畫與擴充、圈字、相容字、擴充 A、統一漢字 U+4E00～9FFF、相容漢字、直排標點 U+FE30～FE4F、全形與半形 U+FF00～FFEF、擴充 B 以後 U+20000～3FFFF）。
//                  所以「、。「」・」與全形的「，：（）」算中日文（走系統字型）；「·」U+00B7、「—」U+2014、「…」U+2026、「→」U+2192、「↺」U+21BA 不算（要進拉丁子集）。
//                  ch 不是剛好一個碼位的字串 → TypeError。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.3 收字"
//   node --test tests/font-text.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib } from './helpers.js';
import { CJK } from './b6-font-fixture.js';

const need = await lib('font-text.js', ['charsOf', 'isCjk']);

test('B6.3 收字：charsOf —— 以碼位算、不重複、照碼位排、空白（含全形空白、BOM）不算', () => {
    const { charsOf } = need();
    assert.deepEqual(charsOf('好你 好\n你\t𠮷\u3000A\uFEFF'), ['A', '你', '好', '𠮷']);
    assert.deepEqual(charsOf(''), []);
    assert.deepEqual(charsOf(' \n\t\r\u3000\uFEFF'), []);
});

test('B6.3 收字：charsOf 整份都收 —— Markdown 表格的 |、-、英文欄的彎引號都算', () => {
    const { charsOf } = need();
    assert.deepEqual(charsOf('| zh | en |\n|---|---|\n| 你 | It’s |'), ['-', 'I', 'e', 'h', 'n', 's', 't', 'z', '|', '’', '你'].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)));
});

test('B6.3 收字：isCjk —— 每一段的頭尾都算中日文、段外的鄰居不算', () => {
    const { isCjk } = need();
    for (const [lo, hi] of CJK) {
        assert.equal(isCjk(String.fromCodePoint(lo)), true, `U+${lo.toString(16).toUpperCase()} 要算中日文`);
        assert.equal(isCjk(String.fromCodePoint(hi)), true, `U+${hi.toString(16).toUpperCase()} 要算中日文`);
    }
    for (const cp of [0x2e7f, 0x318f, 0x4dc0, 0xa000, 0xf8ff, 0xfb00, 0xfe2f, 0xfe50, 0xfff0, 0x1ffff, 0x40000]) {
        assert.equal(isCjk(String.fromCodePoint(cp)), false, `U+${cp.toString(16).toUpperCase()} 不算中日文`);
    }
});

test('B6.3 收字：isCjk —— 常見的字', () => {
    const { isCjk } = need();
    for (const ch of ['你', '靈', '𠮷', 'か', 'カ', 'ー', '、', '。', '「', '」', '・', '，', '：', '（', '）', '！', 'ㄅ']) assert.equal(isCjk(ch), true, `「${ch}」要算中日文`);
    for (const ch of ['A', 'z', '0', ' ', '·', '—', '–', '…', '→', '↺', '’', '“', 'é', '©', '€', '👍', '한']) assert.equal(isCjk(ch), false, `「${ch}」不算中日文`);
});

test('B6.3 收字：不是字串、不是剛好一個字 → TypeError', () => {
    const { charsOf, isCjk } = need();
    for (const bad of [undefined, null, 42, ['你'], Buffer.from('你')]) {
        assert.throws(() => charsOf(bad), TypeError, `charsOf(${String(bad)}) 要丟 TypeError`);
        assert.throws(() => isCjk(bad), TypeError, `isCjk(${String(bad)}) 要丟 TypeError`);
    }
    for (const bad of ['', '你好', 'ab']) assert.throws(() => isCjk(bad), TypeError, `isCjk(${JSON.stringify(bad)}) 要丟 TypeError`);
});
