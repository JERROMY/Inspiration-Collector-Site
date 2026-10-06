// 4-b10 的 B10.4：bindTail(text, 'en') 最後兩個字的長度上限 EN_TAIL_MAX_CHARS = 20（字元＝Unicode 碼位；避免 280 寬時綁住那段撐出橫捲）。介面細則見 tests/README.md「4-b10」。
//
// 量什麼：
//   B10.4 最後兩個字（含中間的空白）合計 ≤ 20 → 照舊兩個字一起包；> 20 → 只包最後一個字；最後一個字本身 > 20 → 不包（沒有 span）。邊界用 20／21。
//         網址、很長的單字、emoji（以碼位算：👍🏽 是 2）；多行只看最後一行；tail 照舊（沒有 span 時接在最後一個字後面、結尾空白前面）；
//         中文、日文不受影響。lib/bind-tail.js 要有 const EN_TAIL_MAX_CHARS = 20，JSDoc 寫到它。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B10.4"
//   node --test tests/bind-tail-cap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const nw = (s) => '<span class="nw">' + s + '</span>';
const ARROW = '<span class="i i--arrow"></span>';
const a = (n) => 'a'.repeat(n);
const b = (n) => 'b'.repeat(n);
const cp = (s) => [...s].length;

function en(text, want, label, options) {
    const { bindTail } = need();
    assert.equal(bindTail(text, 'en', options), want, `${label}：bindTail(${JSON.stringify(text)}, 'en'${options ? ', { tail }' : ''})`);
}

test('B10.4 兩個字合計 20 個字元：照舊一起包；21 個：只包最後一個字', () => {
    assert.equal(cp(`${a(9)} ${b(10)}`), 20, '防呆');
    en(`Then ${a(9)} ${b(10)}`, `Then ${nw(`${a(9)} ${b(10)}`)}`, '剛好 20（含中間的空白）');
    en(`Then ${a(10)} ${b(10)}`, `Then ${a(10)} ${nw(b(10))}`, '21：只包最後一個字');
    en(`Then ${a(9)}  ${b(10)}`, `Then ${a(9)}  ${nw(b(10))}`, '中間兩個空白也算：21');
});

test('B10.4 最後一個字 20 個字元：只包它；21 個：不包', () => {
    en(`see ${b(20)}`, `see ${nw(b(20))}`, '最後一個字 20');
    en(`see ${b(21)}`, `see ${b(21)}`, '最後一個字 21：不包');
    en(b(20), nw(b(20)), '整段只有一個字 20');
    en(b(21), b(21), '整段只有一個字 21');
});

test('B10.4 網址與很長的單字', () => {
    const short = 'https://x.co/abcdefgh';
    const long = 'https://jerromy.com/en/collector-1-0-5/';
    assert.equal(cp(short), 21, '防呆');
    en(`Docs at ${short}`, `Docs at ${short}`, '網址 21 個字元：不包');
    en(`Docs at x.co/abc`, `Docs ${nw('at x.co/abc')}`, '短網址：照舊兩個字');
    en(`Read the notes: ${long}`, `Read the notes: ${long}`, '長網址');
    en('A Supercalifragilisticexpialidocious', 'A Supercalifragilisticexpialidocious', '34 個字母的單字：不包');
    en('Pneumonoultra word', nw('Pneumonoultra word'), '13＋1＋4＝18：兩個字');
});

test('B10.4 字元以 Unicode 碼位算（👍🏽 是 2 個）', () => {
    const thumbs = '\u{1F44D}\u{1F3FD}';
    assert.equal(cp(`${a(17)} ${thumbs}`), 20, '防呆');
    en(`ok ${a(17)} ${thumbs}`, `ok ${nw(`${a(17)} ${thumbs}`)}`, '17＋1＋2＝20');
    en(`ok ${a(18)} ${thumbs}`, `ok ${a(18)} ${nw(thumbs)}`, '18＋1＋2＝21');
});

test('B10.4 多行只看最後一行；結尾的空白與換行照舊在外面', () => {
    en(`${a(30)} ${b(30)}\nshort tail`, `${a(30)} ${b(30)}\n${nw('short tail')}`, '上一行很長不影響');
    en(`first\n${a(10)} ${b(10)}\n`, `first\n${a(10)} ${nw(b(10))}\n`, '最後一行 21：只包最後一個字');
    en(`first\n${b(25)}  \n`, `first\n${b(25)}  \n`, '最後一行一個字 25：不包');
});

test('B10.4 tail：只包最後一個字時 tail 在 span 裡；不包時 tail 接在最後一個字後面、結尾空白前面', () => {
    const tail = { tail: ARROW };
    en(`Then ${a(10)} ${b(10)}`, `Then ${a(10)} ${nw(b(10) + ARROW)}`, '只包最後一個字', tail);
    en(`see ${b(21)}`, `see ${b(21)}${ARROW}`, '不包：tail 接在後面', tail);
    en(`see ${b(21)}\n`, `see ${b(21)}${ARROW}\n`, '不包、結尾有換行：tail 在換行前面', tail);
});

test('B10.4 中文、日文不受影響', () => {
    const { bindTail } = need();
    const out = bindTail(`中文裡的 ${a(30)}`, 'zh').split('<wbr>').join('');
    assert.equal(out, `中文裡的 ${a(27)}${nw(a(3))}`, '中文照最後三個字位');
});

test('B10.4 上限寫成常數 EN_TAIL_MAX_CHARS = 20，JSDoc 寫到它', () => {
    const src = fs.readFileSync(path.join(SITE, 'lib', 'bind-tail.js'), 'utf8');
    assert.match(src, /^const EN_TAIL_MAX_CHARS = 20;/m, 'lib/bind-tail.js 要有 const EN_TAIL_MAX_CHARS = 20;');
    const docs = (src.match(/\/\*\*[\s\S]*?\*\//g) || []).join('\n');
    assert.match(docs, /EN_TAIL_MAX_CHARS/, 'JSDoc 要寫到 EN_TAIL_MAX_CHARS');
    assert.match(docs, /20/, 'JSDoc 要寫到上限 20');
});
