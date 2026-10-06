// 4-b10 的 B10.1：bindTail(text, 'zh', …) 在中文的詞界插 <wbr>（Intl.Segmenter，zh-Hant，granularity: 'word'）；日文不插。介面細則見 tests/README.md「4-b10」。
//
// 量什麼：
//   B10.1 〔派工 4-b10 改〕只對中文插：日文插了反而把動詞活用切碎（「使え｜ません」），日文靠 CSS 的 word-break: auto-phrase。
//         日文的輸出沒有 <wbr>，跟 4-b9 版逐字相同（最後三字綁住、tail、跳脫、多行）；放回「日文也插」要紅。
//   B10.1 期待值〔派工 4-b10 定〕：不寫死某一版 ICU 的切法 —— 測試用同一個環境的 Intl.Segmenter 切詞，再套同樣的規則推出期待的輸出（expected()），整批句子逐字比。
//         規則：同一行裡相鄰的兩段都是「詞」（isWordLike）才插；所以不在標點、空白前後插；不插在 <span class="nw"> 裡面（span 開頭那一處可以，<wbr> 在 span 外）；
//         短引號（「…」『…』“…” 裡面 12 個字以內，不算引號本身）裡面不插，13 個字以上照插，引號外面照插；不連續兩個；不在字串、每一行的開頭或結尾；英文不插。
//         另外寫死幾條具體字例：只挑 Node 21.6（ICU 74.1）與 Node 22.17（ICU 77.1）切法一模一樣的句子（2026-10-02 兩版各跑一次比過）。
//   B10.1 性質（一批句子都量）：拿掉所有 <wbr> 之後，跟「不插詞界時的輸出」（測試自己照 4-b2 規則算的）逐字相同；<wbr> 後面不是標點或空白；
//         跳脫只一次（&amp; 不會變 &amp;amp;）；tail 照舊在 span 裡；多行每行各自處理、\n 與 \r\n 原樣。
//   B10.1 二十萬字 2 秒內；沒有 Intl.Segmenter 的環境（子程序裡把它設成 undefined 再載入）：載得進來、英文照常、中日文丟講到 Intl.Segmenter 的 Error
//         （日文雖然不插詞界，找最後三個字位還是要 Segmenter）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B10.1"
//   node --test tests/bind-tail-wbr.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { lib, SITE } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const OPEN = '<span class="nw">';
const CLOSE = '</span>';
const W = '<wbr>';
const nw = (s) => OPEN + s + CLOSE;
const ARROW = '<span class="i i--arrow"></span>';

// 〔測試工程師〕寫死的字例：2026-10-02 用 Node 21.6.2（ICU 74.1）與 Node 22.17.0（ICU 77.1）各跑一次 new Intl.Segmenter('zh-Hant'|'ja', { granularity: 'word' })，
// 兩版切法一模一樣的才放進來：
//   暫時|不能|用；資料|夾|上鎖|時；修正|跟| |1.0.5| |一起|出；ChatGPT| |改版|：|「|存|這|則|」|「|存|這|頁|」|暫時|不能|用；搜尋|「|靈感|收集|器|」
//   請先|「|到|擴充|功能|頁|面|重新|整理|一次|」|再試；請到|網站|「|存|這|則|」|之後|再|試|一次
//   （日文不插，所以日文不放在這裡；日文的例子在 JA，期待值是 4-b9 版的輸出）
const STABLE = [
    ['zh', '暫時不能用', '暫時' + W + nw('不能用'), '詞界剛好在綁住那段的開頭：<wbr> 在 span 前面'],
    ['zh', '資料夾上鎖時', '資料' + W + '夾' + W + nw('上鎖時'), '兩處詞界'],
    ['zh', '修正跟 1.0.5 一起出', '修正' + W + '跟 1.0.5 ' + nw('一起出'), '空白前後不插'],
    ['zh', 'ChatGPT 改版：「存這則」「存這頁」暫時不能用', 'ChatGPT 改版：「存這則」「存這頁」暫時' + W + nw('不能用'), '公告條的標題：短引號裡不插、標點前後不插'],
    ['zh', '搜尋「靈感收集器」', '搜尋「靈感收' + nw('集器」'), '短引號裡不插（5 個字）'],
    ['zh', '請到網站「存這則」之後再試一次', '請到' + W + '網站「存這則」之後' + W + '再' + nw('試一次'), '引號外面照插'],
];

// 日文〔派工 4-b10 改〕：不插 <wbr>，輸出跟 4-b9 版逐字相同（檢查員在 Chromium 窄寬度量到的那幾句也在裡面）
const JA = [
    ['修正は 1.0.5 で配信します。', '修正は 1.0.5 で配信し' + nw('ます。'), '日文'],
    ['フォルダーがロックされたとき', 'フォルダーがロックされ' + nw('たとき'), '日文的假名'],
    ['ChatGPT のデザイン変更で「これを保存」「ページを保存」が一時的に使えません', 'ChatGPT のデザイン変更で' + nw('「これを保存」') + nw('「ページを保存」') + 'が一時的に使え' + nw('ません'), '公告條標題（「使え｜ません」；〔派工 4-b11〕兩對短引號各包一個 nw）'],
    ['ほかのサイトと Claude・Perplexity には影響ありません。', 'ほかのサイトと Claude・Perplexity には影響ありま' + nw('せん。'), '「影響ありま｜せん」'],
    ['一行目です。\n二行目は A&B と <b> です。', '一行目です。\n二行目は A&amp;B と &lt;b&gt; ' + nw('です。'), '多行、跳脫'],
];

const CORPUS = [
    ...STABLE.map(([lang, text]) => [lang, text]),
    ['zh', '這是第一句'],
    ['zh', '修好：縮圖一多，格子會疊在一起'],
    ['zh', '不再只剩「已存」'],
    ['zh', '請按存這頁。'],
    ['zh', '請「擴充功能頁面重新整理一次」再試'],
    ['zh', '請先「到擴充功能頁面重新整理一次」再試'],
    ['zh', '叫做『靈感收集器』的工具，按下“存這則”就好'],
    ['zh', '「沒有關起來的引號裡面也照插'],
    ['ja', '「これを保存」を押してから一度再読み込みしてください'],
    ['zh', '其他網頁與 Claude、Perplexity 不受影響。修正跟 1.0.5 一起出。'],
    ['zh', '從 Chrome 線上應用程式商店更新就好。\n之後網站再改版，收集器也會先自己試著找出對話的位置。'],
    ['zh', '第一段的話。\r\n\r\n第二段的結尾。\r\n'],
    ['zh', '比較 A&B 與 <b> 的差別，還有 "引號" 與 \'單引號\''],
    ['zh', '（括號裡的字）「引號裡的字」『雙引號』《書名》：冒號；分號！驚嘆號？問號……'],
    ['zh', '好'],
    ['ja', 'Chrome ウェブストアから更新するだけです。\nサイトのレイアウトがまた変わっても、まずは会話の位置を自分で探します。'],
    ['ja', '（かっこ）「かぎ」、読点。'],
];

// 測試自己照 4-b2 的規則算「不插詞界時的輸出」：最後一個非空行的最後三個字位包進 span，其餘跳脫
function plain(text) {
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    let end = text.length;
    while (end > 0 && /\s/.test(text[end - 1])) end -= 1;
    if (end === 0) return esc(text);
    const lineStart = text.lastIndexOf('\n', end - 1) + 1;
    // 只切最後 64 個 UTF-16 單位就夠找出最後三個字位（舊版 Node 的 Segmenter 切二十萬字的一行會吃光記憶體）
    const chars = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.slice(Math.max(lineStart, end - 64), end))].map((s) => s.segment);
    const start = end - chars.slice(Math.max(0, chars.length - 3)).join('').length;
    return esc(text.slice(0, start)) + nw(esc(text.slice(start, end))) + esc(text.slice(end));
}

// 〔派工 4-b11〕日文「不插詞界時的輸出」：plain() 再加上短引號的 nw（同一行、開引號往後找最近的同一種關引號、裡面 8 個碼位以內；
// 由前到後挑、跟挑到的重疊就不挑；整對在最後三字裡不另外包，部分重疊就把最後三字的 span 往前延伸到開引號，延伸後超過 10 個碼位就不延伸、那一對也不包）。中文照舊是 plain()
const QUOTE_PAIRS = { '「': '」', '『': '』', '“': '”' };
function base(text, lang) {
    if (lang === 'zh') return plain(text);
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    let end = text.length;
    while (end > 0 && /\s/.test(text[end - 1])) end -= 1;
    if (end === 0) return esc(text);
    const lineStart = text.lastIndexOf('\n', end - 1) + 1;
    const chars = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.slice(Math.max(lineStart, end - 64), end))].map((s) => s.segment);
    let start = end - chars.slice(Math.max(0, chars.length - 3)).join('').length;
    const wrap = [];
    let offset = 0;
    for (const line of text.slice(0, end).split('\n')) {
        let reach = -1;
        for (let i = 0; i < line.length; i += 1) {
            const close = QUOTE_PAIRS[line[i]];
            const j = close ? line.indexOf(close, i + 1) : -1;
            if (j < 0 || i <= reach || [...line.slice(i + 1, j)].length > 8) continue;
            reach = j;
            const [a, b] = [offset + i, offset + j + 1];
            if (a >= start) continue;
            if (b > start) {
                if ([...text.slice(a, end)].length <= 10) start = a;
            } else wrap.push([a, b]);
        }
        offset += line.length + 1;
    }
    let out = '';
    let from = 0;
    for (const [a, b] of wrap) {
        out += esc(text.slice(from, a)) + nw(esc(text.slice(a, b)));
        from = b;
    }
    return out + esc(text.slice(from, start)) + nw(esc(text.slice(start, end))) + esc(text.slice(end));
}

// 測試自己推的期待值：同一個環境的 Intl.Segmenter 切詞，套 B10.1 的規則（相鄰兩段都是詞、不在 span 裡、不在短引號裡、每一行各自切），
// 再把 <wbr> 插進 plain() 的結果 —— 不靠被測的程式，也不寫死某一版 ICU 的切法
const PAIRS = { '「': '」', '『': '』', '“': '”' };
function expected(text, lang) {
    let end = text.length;
    while (end > 0 && /\s/.test(text[end - 1])) end -= 1;
    if (end === 0 || lang !== 'zh') return base(text, lang);  // 〔派工 4-b10 改〕只有中文插；〔派工 4-b11〕日文、英文有短引號的 nw
    const lineStart = text.lastIndexOf('\n', end - 1) + 1;
    // 只切最後 64 個 UTF-16 單位就夠找出最後三個字位（舊版 Node 的 Segmenter 切二十萬字的一行會吃光記憶體）
    const chars = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.slice(Math.max(lineStart, end - 64), end))].map((s) => s.segment);
    const start = end - chars.slice(Math.max(0, chars.length - 3)).join('').length;
    const words = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    const cuts = [];
    let at = 0;
    for (const line of text.slice(0, end).split('\n')) {
        const quiet = [];
        for (let i = 0; i < line.length; i += 1) {
            const close = PAIRS[line[i]];
            const j = close ? line.indexOf(close, i + 1) : -1;
            if (j >= 0 && [...line.slice(i + 1, j)].length <= 12) quiet.push([at + i, at + j]);
        }
        let prev = null;
        for (const seg of words.segment(line)) {
            const pos = at + seg.index;
            if (prev && prev.isWordLike && seg.isWordLike && pos <= start && !quiet.some(([a, b]) => pos > a && pos <= b)) cuts.push(pos);
            prev = seg;
        }
        at += line.length + 1;
    }
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    let out = '';
    let from = 0;
    for (const pos of cuts) {
        out += esc(text.slice(from, pos)) + W;
        from = pos;
    }
    return out + esc(text.slice(from, start)) + nw(esc(text.slice(start, end))) + esc(text.slice(end));
}

// <wbr> 的位置規則（每一處都量）
function checkWbr(out, label) {
    assert.ok(!out.startsWith(W) && !out.endsWith(W), `${label}：<wbr> 不能在開頭或結尾：${out}`);
    assert.ok(!out.includes(W + W), `${label}：不能連續兩個 <wbr>：${out}`);
    const inside = out.slice(out.indexOf(OPEN), out.lastIndexOf(CLOSE));
    assert.ok(out.indexOf(OPEN) < 0 || !inside.includes(W), `${label}：<wbr> 不能在 <span class="nw"> 裡面：${out}`);
    for (let at = out.indexOf(W); at >= 0; at = out.indexOf(W, at + 1)) {
        const after = out.slice(at + W.length).replace(/^<span class="nw">/, '');
        const before = out.slice(0, at);
        assert.doesNotMatch(after, /^(?:[\s\p{P}\p{S}]|&(?:amp|lt|gt|quot|#39);)/u, `${label}：<wbr> 不能在標點、空白前面：…${out.slice(Math.max(0, at - 6), at + 12)}…`);
        assert.doesNotMatch(before, /(?:[\s\p{P}\p{S}]|&(?:amp|lt|gt|quot|#39);)$/u, `${label}：<wbr> 不能在標點、空白後面：…${out.slice(Math.max(0, at - 6), at + 12)}…`);
    }
}

test('B10.1 期待值用同一個環境的 Intl.Segmenter 推：整批句子逐字相同', () => {
    const { bindTail } = need();
    for (const [lang, text] of CORPUS) {
        assert.equal(expected(text, lang).split(W).join(''), base(text, lang), '測試自己的防呆：expected() 拿掉 <wbr> 要等於 base()（〔派工 4-b11〕日文、英文含短引號的 nw）');
        assert.equal(bindTail(text, lang), expected(text, lang), `bindTail(${JSON.stringify(text)}, '${lang}')`);
    }
});

test('B10.1 寫死的字例（ICU 74.1 與 77.1 切法相同的句子）', () => {
    const { bindTail } = need();
    for (const [lang, text, want, label] of STABLE) {
        assert.equal(expected(text, lang), want, `${label}：測試自己的防呆 —— 這個環境的 Segmenter 切法跟寫死的不同（ICU 換版了？），先比對切法`);
        assert.equal(bindTail(text, lang), want, `${label}：bindTail(${JSON.stringify(text)}, '${lang}')`);
    }
});

test('B10.1 短引號：「…」『…』“…” 裡 12 個字以內不插，13 個字以上照插；沒關起來的引號不算', () => {
    const { bindTail } = need();
    const inside = (out, open, close) => out.slice(out.indexOf(open) + open.length, out.indexOf(close, out.indexOf(open)));
    const q12 = '擴充功能頁面重新整理一次';
    const q13 = '到擴充功能頁面重新整理一次';
    assert.equal([...q12].length, 12, '防呆');
    assert.equal([...q13].length, 13, '防呆');
    assert.ok(!inside(bindTail(`請「${q12}」再試`, 'zh'), '「', '」').includes(W), '12 個字：不插');
    assert.ok(inside(bindTail(`請先「${q13}」再試`, 'zh'), '「', '」').includes(W), '13 個字：照插');
    assert.ok(!inside(bindTail(`叫做『${q12}』的工具`, 'zh'), '『', '』').includes(W), '『』12 個字：不插');
    assert.ok(inside(bindTail(`叫做『${q13}』的工具`, 'zh'), '『', '』').includes(W), '『』13 個字：照插');
    assert.ok(!inside(bindTail(`按下“${q12}”就好了啦`, 'zh'), '“', '”').includes(W), '“”12 個字：不插');
    assert.ok(inside(bindTail(`按下“${q13}”就好了啦`, 'zh'), '“', '”').includes(W), '“”13 個字：照插');
    assert.ok(bindTail('「沒有關起來的引號裡面也照插', 'zh').includes(W), '沒關起來的引號不算短引號：照插');
    assert.ok(bindTail('請到網站「存這則」之後再試一次', 'zh').startsWith('請到' + W + '網站'), '引號前面的詞界照插');
});

test('B10.1 性質：拿掉 <wbr> 跟不插詞界時逐字相同；<wbr> 不在標點、空白前後，不在 span 裡，不連續、不在頭尾', () => {
    const { bindTail } = need();
    let total = 0;
    for (const [lang, text] of CORPUS) {
        const out = bindTail(text, lang);
        const label = `${lang} ${JSON.stringify(text)}`;
        assert.equal(out.split(W).join(''), base(text, lang), `${label}：拿掉 <wbr> 之後要跟不插詞界時一模一樣（〔派工 4-b11〕日文、英文含短引號的 nw）`);
        checkWbr(out, label);
        total += out.split(W).length - 1;
    }
    assert.ok(total >= 40, `這一批句子要插得出 <wbr>（防呆：完全不插也會過上面幾條），只插了 ${total} 個`);
});

test('B10.1 多行：每行各自處理，\\n 與 \\r\\n 原樣；<wbr> 不貼著換行', () => {
    const { bindTail } = need();
    assert.equal(bindTail('暫時不能用\n資料夾上鎖時', 'zh'), '暫時' + W + '不能' + W + '用\n資料' + W + '夾' + W + nw('上鎖時'), '兩行：第一行整行都插（沒有 span）');
    assert.equal(bindTail('暫時不能用\r\n\r\n資料夾上鎖時\r\n', 'zh'), '暫時' + W + '不能' + W + '用\r\n\r\n資料' + W + '夾' + W + nw('上鎖時') + '\r\n', 'CRLF 與空白行');
    for (const [lang, text] of CORPUS.filter(([, t]) => t.includes('\n'))) {
        const out = bindTail(text, lang);
        assert.doesNotMatch(out, /<wbr>\r?\n|\n<wbr>|<wbr>\r/, `${lang} ${JSON.stringify(text)}：<wbr> 不能貼著換行`);
        assert.equal((out.match(/\n/g) || []).length, (text.match(/\n/g) || []).length, '換行數不變');
    }
});

test('B10.1 跳脫只一次：& < > " \' 照舊跳脫、實體不被 <wbr> 切開', () => {
    const { bindTail } = need();
    const out = bindTail('比較 A&B 與 <b> 的差別，還有 "引號" 與 \'單引號\'', 'zh');
    assert.ok(out.includes('A&amp;B') && out.includes('&lt;b&gt;') && out.includes('&quot;') && out.includes('&#39;'), `要跳脫：${out}`);
    assert.doesNotMatch(out, /&amp;(?:amp|lt|gt|quot|#39);/, `不能二次跳脫：${out}`);
    assert.doesNotMatch(out, /&[a-z#0-9]*<wbr>/, `<wbr> 不能插進實體中間：${out}`);
    assert.equal(bindTail('A &amp; 不能用', 'zh').split(W).join(''), 'A &amp;amp; ' + nw('不能用'), '輸入裡字面的 &amp; 是字，跳脫一次');
});

test('B10.1 英文不插；tail 照舊在 span 裡的結尾', () => {
    const { bindTail } = need();
    assert.doesNotMatch(bindTail('Save the page and update the extension now', 'en'), /<wbr>/, '英文不插');
    assert.doesNotMatch(bindTail('Just update from the Chrome Web Store.\nIf a site changes again, it tries.', 'en'), /<wbr>/, '英文多行也不插');
    assert.equal(bindTail('暫時不能用', 'zh', { tail: ARROW }), '暫時' + W + nw('不能用' + ARROW), '中文 + tail');
    assert.equal(bindTail('修正は 1.0.5 で配信します。', 'ja', { tail: ARROW }), '修正は 1.0.5 で配信し' + nw('ます。' + ARROW), '日文 + tail：不插');
});

test('B10.1 日文不插〔4-b10 改〕：輸出沒有 <wbr>，跟 4-b9 版逐字相同（最後三字、tail、跳脫、多行）', () => {
    const { bindTail } = need();
    for (const [text, want, label] of JA) {
        const out = bindTail(text, 'ja');
        assert.ok(!out.includes(W), `${label}：日文不插 <wbr>，得到 ${out}`);
        assert.equal(out, want, `${label}：bindTail(${JSON.stringify(text)}, 'ja')`);
        assert.equal(out, base(text, 'ja'), `${label}：跟 4-b9 版的規則（最後三個字位、跳脫）逐字相同，〔派工 4-b11〕加上短引號的 nw`);
        assert.equal(bindTail(text, 'ja', { tail: ARROW }), want.slice(0, want.lastIndexOf(CLOSE)) + ARROW + CLOSE, `${label}：tail 照舊在 span 裡的結尾`);
    }
    for (const [lang, text] of CORPUS.filter(([l]) => l === 'ja')) {
        assert.ok(!bindTail(text, lang).includes(W), `日文 ${JSON.stringify(text)}：不插 <wbr>`);
    }
    assert.ok(!bindTail('一時的に使えません\r\n\r\n影響ありません\r\n', 'ja').includes(W), '日文 CRLF 多行：不插');
});

test('B10.1 很短、空字串、只有空白、只有標點：不插也不丟例外', () => {
    const { bindTail } = need();
    assert.equal(bindTail('', 'zh'), '');
    assert.equal(bindTail('  \n', 'ja'), '  \n');
    assert.equal(bindTail('好', 'zh'), nw('好'));
    assert.equal(bindTail('。，、', 'zh'), nw('。，、'));
    assert.equal(bindTail('「」（）……', 'ja').split(W).length - 1, 0, '只有標點不插');
});

test('B10.1 很長的字：二十萬字 2 秒內（單行、多行各一次），結果拿掉 <wbr> 跟不插時相同', () => {
    const { bindTail } = need();
    for (const text of ['暫時不能用，資料夾上鎖時。'.repeat(15400), '暫時不能用，資料夾上鎖時。\n'.repeat(14300)]) {
        assert.ok(text.length >= 200000, '測試自己的防呆：要二十萬字');
        const started = performance.now();
        const out = bindTail(text, 'zh');
        const ms = performance.now() - started;
        assert.ok(ms < 2000, `要在 2 秒內，花了 ${Math.round(ms)} ms`);
        assert.equal(out.split(W).join(''), plain(text), '拿掉 <wbr> 之後跟不插時相同');
        assert.ok(out.split(W).length - 1 > 40000, '每一句都有插');
    }
});

test('B10.1 沒有 Intl.Segmenter 的環境：載得進來、英文照常、中日文丟講到 Intl.Segmenter 的 Error', () => {
    need();
    const url = pathToFileURL(path.join(SITE, 'lib', 'bind-tail.js')).href;
    const code = `
        Intl.Segmenter = undefined;
        const out = {};
        try {
            const { bindTail } = await import(${JSON.stringify(url)});
            out.loaded = true;
            out.en = bindTail('Save the page.', 'en');
            for (const lang of ['zh', 'ja']) {
                try { out[lang] = { result: bindTail('暫時不能用', lang) }; }
                catch (err) { out[lang] = { name: err.name, message: err.message }; }
            }
        } catch (err) { out.loadError = err.message; }
        console.log(JSON.stringify(out));`;
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 30000 });
    assert.equal(res.status, 0, `子程序要正常結束：${res.stderr}`);
    const out = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.equal(out.loadError, undefined, `沒有 Intl.Segmenter 也要載得進來（不在載入時就建 Segmenter），得到：${out.loadError}`);
    assert.equal(out.en, 'Save ' + nw('the page.'), '英文用不到 Intl.Segmenter，照常');
    for (const lang of ['zh', 'ja']) {
        assert.ok(out[lang].message, `${lang}：要丟 Error，結果回了 ${JSON.stringify(out[lang].result)}`);
        assert.match(out[lang].message, /Intl\.Segmenter/, `${lang}：訊息要講到 Intl.Segmenter，得到：${out[lang].message}`);
        assert.match(out[lang].message, /[一-鿿]/, `${lang}：訊息要是中文，得到：${out[lang].message}`);
        assert.doesNotMatch(out[lang].message, /is not a constructor|Cannot read/, `${lang}：不能是 JavaScript 的原始錯誤，得到：${out[lang].message}`);
    }
});
