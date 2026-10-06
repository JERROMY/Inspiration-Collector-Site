// 4-b9 的 B9.4：bindTail(text, lang, { tail }) —— 呼叫端給的尾端圖示（已安全的 HTML 片段）插在綁住那段 span 的裡面、結尾。介面細則見 tests/README.md「4-b9」。
//
// 量什麼：
//   B9.4 tail 插在最後那個 </span> 前面（跟最後幾個字一起換行，不會單獨掉到下一行）；結尾的空白與換行照舊在 span 外面；
//        tail 原樣放、不跳脫（呼叫端負責安全：只能傳自己寫的固定片段，lib/bind-tail.js 的 JSDoc 要寫明）；
//        沒給 tail（不給第三個參數、{}、tail 是 undefined 或 ''）跟現在一模一樣；中日英三語、只有一個字、很短、多行（只放最後一行的尾巴）；
//        tail 不是字串 → TypeError；文字是空的或只有空白也不丟例外、tail 只出現一次。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B9.4"
//   node --test tests/bind-tail-icon.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const OPEN = '<span class="nw">';
const CLOSE = '</span>';
const nw = (s) => OPEN + s + CLOSE;
const ARROW = '<span class="i i--arrow" data-icon="arrow"></span>';
const SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h10l-3-3 1-1 5 5-5 5-1-1 3-3H2z"/></svg>';

function withTail(text, lang, tail, want, label) {
    const { bindTail } = need();
    let out;
    try {
        out = bindTail(text, lang, { tail });
    } catch (err) {
        assert.fail(`${label}：bindTail(${JSON.stringify(text)}, '${lang}', { tail }) 丟了例外：${err.message}`);
    }
    // 〔派工 4-b10〕中文在詞界插 <wbr>：期待值是不插詞界時的輸出，中文比之前先拿掉 <wbr>（tail 本身沒有 <wbr>）；日文、英文不插，照原樣比
    assert.equal(lang === 'zh' ? out.split('<wbr>').join('') : out, want, `${label}：bindTail(${JSON.stringify(text)}, '${lang}', { tail: ${JSON.stringify(tail)} })（拿掉 <wbr> 之後）`);
    assert.equal(out.split(tail).length - 1, 1, `${label}：tail 要原樣出現剛好一次（不跳脫）`);
    assert.equal(out.replace(tail, ''), bindTail(text, lang), `${label}：拿掉 tail 之後要跟沒給 tail 的結果一模一樣`);
    return out;
}

test('B9.4 中文：tail 放在綁住的最後三個字後面、同一個 span 裡', () => {
    withTail('請按存這頁。', 'zh', ARROW, '請按存' + nw('這頁。' + ARROW), '一般句子');
    withTail('ChatGPT 改版：「存這則」「存這頁」暫時不能用', 'zh', ARROW, 'ChatGPT 改版：「存這則」「存這頁」暫時' + nw('不能用' + ARROW), '公告條的標題');
});

test('B9.4 日文、英文：同樣放在 span 裡的結尾', () => {
    withTail('一行目です。', 'ja', ARROW, '一行目' + nw('です。' + ARROW), '日文');
    withTail('Save the page.', 'en', ARROW, 'Save ' + nw('the page.' + ARROW), '英文');
    withTail('“Save this” is back after the ChatGPT redesign', 'en', SVG, nw('“Save this”') + ' is back after the ' + nw('ChatGPT redesign' + SVG), 'svg 片段（英文最後兩個字；〔派工 4-b11〕“Save this” 是短引號，另外包一個 nw）');
});

test('B9.4 很短、只有一個字：整段跟 tail 一起包', () => {
    withTail('好', 'zh', ARROW, nw('好' + ARROW), '中文一個字');
    withTail('はい', 'ja', ARROW, nw('はい' + ARROW), '日文兩個字');
    withTail('OK', 'en', ARROW, nw('OK' + ARROW), '英文一個字');
});

test('B9.4 結尾的空白與換行照舊在 span 外面；多行只放最後一行的尾巴', () => {
    withTail('請按存這頁。  \n', 'zh', ARROW, '請按存' + nw('這頁。' + ARROW) + '  \n', '中文結尾空白＋換行');
    withTail('First line.\n\nSecond line here.\n', 'en', ARROW, 'First line.\n\nSecond ' + nw('line here.' + ARROW) + '\n', '英文兩段');
    withTail('一行目。\n二行目です。', 'ja', ARROW, '一行目。\n二行目' + nw('です。' + ARROW), '日文兩行');
});

test('B9.4 tail 原樣放、不跳脫；文字照舊跳脫', () => {
    const tail = '<i data-x="a&b">→</i>';
    withTail('Tom & Jerry <3', 'en', tail, 'Tom &amp; ' + nw('Jerry &lt;3' + tail), '英文');
    withTail('請看 <b>', 'zh', tail, '請看 ' + nw('&lt;b&gt;' + tail), '中文');
});

test('B9.4 沒給 tail：跟現在一模一樣（不給、{}、undefined、空字串）', () => {
    const { bindTail } = need();
    for (const [text, lang] of [['請按存這頁。', 'zh'], ['一行目です。\n二行目です。', 'ja'], ['Save the page.', 'en'], ['', 'en'], ['  \n', 'zh']]) {
        const plain = bindTail(text, lang);
        assert.equal(bindTail(text, lang, {}), plain, `${JSON.stringify(text)}：{} 要跟不給一樣`);
        assert.equal(bindTail(text, lang, { tail: undefined }), plain, `${JSON.stringify(text)}：tail undefined 要跟不給一樣`);
        assert.equal(bindTail(text, lang, { tail: '' }), plain, `${JSON.stringify(text)}：tail 空字串要跟不給一樣`);
        assert.equal(bindTail(text, lang, undefined), plain, `${JSON.stringify(text)}：第三個參數 undefined 要跟不給一樣`);
    }
});

test('B9.4 文字是空的或只有空白：不丟例外，tail 只出現一次', () => {
    const { bindTail } = need();
    for (const [text, lang] of [['', 'zh'], ['   ', 'en'], ['\n\n', 'ja']]) {
        const out = bindTail(text, lang, { tail: ARROW });
        assert.equal(out.split(ARROW).length - 1, 1, `${JSON.stringify(text)}（${lang}）：tail 要出現剛好一次，得到 ${out}`);
    }
});

test('B9.4 tail 不是字串：丟 TypeError（呼叫端寫錯）', () => {
    const { bindTail } = need();
    for (const tail of [5, null, ['<i></i>'], { toString: () => '<i></i>' }]) {
        assert.throws(() => bindTail('請按存這頁。', 'zh', { tail }), TypeError, `tail 是 ${JSON.stringify(tail)} 要丟 TypeError`);
    }
});

test('B9.4 文件：lib/bind-tail.js 寫明 tail 原樣放、不跳脫，只能傳自己寫的固定片段', () => {
    const src = fs.readFileSync(path.join(SITE, 'lib', 'bind-tail.js'), 'utf8');
    const docs = (src.match(/\/\*\*[\s\S]*?\*\//g) || []).join('\n');
    assert.match(docs, /tail/, 'JSDoc 要寫到 tail');
    assert.match(docs, /不跳脫|不會跳脫|原樣/, 'JSDoc 要寫明 tail 原樣放、不跳脫');
    assert.match(docs, /固定/, 'JSDoc 要寫明只能傳自己寫的固定片段（不能放使用者寫的字）');
});
