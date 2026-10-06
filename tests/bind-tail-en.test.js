// 4-b9 的 B9.2：bindTail(text, 'en') —— 英文最後兩個字也綁（以空白分，標點跟著字），跟字串表說明「使用者自己寫的內容」一致。介面細則見 tests/README.md「4-b9」。
//
// 量什麼：
//   B9.2 最後一個非空行的最後兩個「字」（以空白切開的一段，標點、連字號、縮寫的點、emoji、網址都跟著它）包進 <span class="nw">；
//        兩字之間的空白在 span 裡、前面的空白與結尾的空白／換行在 span 外；只有一個字就整個包；不從上一行借字；
//        換行原樣（\n、\r\n、空白行）；跳脫 & < > " ' 照舊、不二次跳脫；很短、空字串、全空白、只有標點都不丟例外；很長的字不卡住。
//        每一條另外過一次 checkSafe（拿掉 span、還原實體要跟輸入一樣；非空白剛好一組 span）。
//        中文、日文照舊（最後三個字）；lib/bind-tail.js 的檔頭不能再寫「英文不綁」，strings/README.md 那一節還是寫英文最後兩個字。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B9.2"
//   node --test tests/bind-tail-en.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const OPEN = '<span class="nw">';
const CLOSE = '</span>';
const nw = (s) => OPEN + s + CLOSE;

function unescape(html) {
    return html.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
}

function checkSafe(out, text, label) {
    // 〔派工 4-b10〕最後一個字超過 20 個字元就不綁（0 組 span）
    const lastWord = text.trim().split(/\s+/).pop() ?? '';
    const want = text.trim() === '' || [...lastWord].length > 20 ? 0 : 1;
    assert.equal(out.split(OPEN).length - 1, want, `${label}：要剛好 ${want} 組 span：${out}`);
    assert.equal(out.split(CLOSE).length - 1, want, `${label}：要剛好 ${want} 個 </span>：${out}`);
    const bare = out.split(OPEN).join('').split(CLOSE).join('');
    assert.doesNotMatch(bare, /[<>"']/, `${label}：拿掉 span 之後還有沒跳脫的 < > " '：${out}`);
    assert.doesNotMatch(bare, /&(?!(amp|lt|gt|quot|#39);)/, `${label}：& 要跳脫成 &amp;：${out}`);
    assert.equal(unescape(bare), text, `${label}：拿掉 span、還原實體之後要跟輸入一模一樣：${out}`);
}

function en(text, want, label) {
    const { bindTail } = need();
    let out;
    try {
        out = bindTail(text, 'en');
    } catch (err) {
        assert.fail(`${label}：bindTail(${JSON.stringify(text)}, 'en') 丟了例外：${err.message}`);
    }
    assert.equal(out, want, `${label}：bindTail(${JSON.stringify(text)}, 'en')`);
    checkSafe(out, text, label);
}

test('B9.2 英文：最後兩個字包進 span，兩字之間的空白在裡面、前面的空白在外面', () => {
    en('Save the page.', 'Save ' + nw('the page.'), '一般句子');
    en('Update from the extensions page to get it.', 'Update from the extensions page to ' + nw('get it.'), '長一點的句子');
    en('Thank you', nw('Thank you'), '剛好兩個字');
    en('a  b   c', 'a  ' + nw('b   c'), '好幾個空白：兩字之間的在裡面、前面的在外面');
    en('Save\tthe\tpage', 'Save\t' + nw('the\tpage'), 'Tab 也是空白');
});

test('B9.2 英文：只有一個字就整個包；開頭有空白留在外面', () => {
    en('Done.', nw('Done.'), '一個字＋句號');
    en('A', nw('A'), '一個字母');
    en('   word', '   ' + nw('word'), '開頭的空白在外面');
});

test('B9.2 英文：結尾的空白與換行留在 span 外面', () => {
    en('Save the page.  ', 'Save ' + nw('the page.') + '  ', '結尾空白');
    en('Save the page.\n', 'Save ' + nw('the page.') + '\n', '結尾換行');
    en('Save the page.\t \n\n', 'Save ' + nw('the page.') + '\t \n\n', '結尾空白＋空白行');
});

test('B9.2 「字」的定義：連字號、縮寫的點、所有格與縮寫的撇號跟著字', () => {
    en('It is well-known.', 'It ' + nw('is well-known.'), '連字號（well-known 是一個字）');
    en('A state-of-the-art tool', 'A state-of-the-art ' + nw('tool'), '好幾個連字號（〔派工 4-b10〕兩字合計 21 個字元超過上限，只綁最後一個字）');
    en('It is state-of-the-art', 'It ' + nw('is state-of-the-art'), '好幾個連字號、在最後（兩字合計 19 個字元，照舊兩個字）');
    en('Use a tab, e.g.', 'Use a ' + nw('tab, e.g.'), '縮寫的點（e.g. 是一個字）');
    en('It’s the user’s folder', 'It’s the ' + nw('user’s folder'), '彎撇號');
    en("Don't touch it", 'Don&#39;t ' + nw('touch it'), '直撇號（跳脫成 &#39;）');
});

test('B9.2 「字」的定義：標點跟著前面的字；全形標點結尾；只有標點的那一段也算一個字', () => {
    en('It works now！', 'It ' + nw('works now！'), '全形驚嘆號');
    en('Saved。', nw('Saved。'), '全形句號');
    en('Save the page (Ctrl+S).', 'Save the ' + nw('page (Ctrl+S).'), '括號');
    en('Wait for it — done.', 'Wait for it ' + nw('— done.'), '前後有空白的破折號自己是一段');
});

test('B9.2 「字」的定義：emoji 跟一個字一樣（帶膚色、ZWJ 組合不切開）', () => {
    en('Thanks a lot \u{1F44D}\u{1F3FD}', 'Thanks a ' + nw('lot \u{1F44D}\u{1F3FD}'), '👍 ＋膚色');
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    en('For the whole ' + family, 'For the ' + nw('whole ' + family), 'ZWJ 組合');
    en('Done\u{1F389}', nw('Done\u{1F389}'), 'emoji 黏在字後面');
});

test('B9.2 網址不從中間拆：網址整個在 span 裡或整個在外面', () => {
    const url = 'https://jerromy.com/en/collector-1-0-5/?a=1&b=2#top';
    en(`Read more at ${url}`, `Read more at ${url.replace('&', '&amp;')}`, '網址在最後（〔派工 4-b10〕網址超過 20 個字元，不綁）');
    en('Read more at jerromy.com/a', 'Read more ' + nw('at jerromy.com/a'), '短網址在最後（16 個字元，照舊綁兩個字）');
    en('See https://jerromy.com/a-b for details.', 'See https://jerromy.com/a-b ' + nw('for details.'), '網址在中間');
    en(url, url.replace('&', '&amp;'), '整段只有網址（〔派工 4-b10〕超過 20 個字元，不綁）');
});

test('B9.2 跳脫照舊：& < > " \' 都跳脫、實體不被切開、不二次跳脫', () => {
    en('Tom & Jerry <3', 'Tom &amp; ' + nw('Jerry &lt;3'), '& 與 <');
    en('He said "yes" and \'no\'', 'He said &quot;yes&quot; ' + nw('and &#39;no&#39;'), '雙引號與單引號');
    en('A &amp; B', 'A ' + nw('&amp;amp; B'), '輸入裡字面的 &amp; 是字，照樣跳脫一次（不是二次跳脫，也不是不跳）');
    en('<b>bold</b> text', nw('&lt;b&gt;bold&lt;/b&gt; text'), 'HTML 標籤是字');
    en('<span class="nw">x</span> y', '&lt;span class=&quot;nw&quot;&gt;x&lt;/span&gt; ' + nw('y'), '字面的 nw 標記是字（照空白切；〔派工 4-b10〕兩字合計 21 個字元，只綁 y）');
});

test('B9.2 多行：只綁最後一個非空行的尾巴，換行原樣；最後一行不足兩字不從上一行借', () => {
    en('First line here.\nSecond line here.', 'First line here.\nSecond ' + nw('line here.'), '兩行');
    en('First paragraph.\n\nSecond paragraph here.\n', 'First paragraph.\n\nSecond ' + nw('paragraph here.') + '\n', '兩段（空白行原樣）');
    en('A long first line.\nOK', 'A long first line.\n' + nw('OK'), '最後一行只有一個字');
    en('One two three.\n\n  \n', 'One ' + nw('two three.') + '\n\n  \n', '後面有空白行與只有空白的行');
    en('One two.\r\nThree four five.\r\n', 'One two.\r\nThree ' + nw('four five.') + '\r\n', 'CRLF 行尾');
});

test('B9.2 很短、空字串、全空白、只有標點：不丟例外', () => {
    en('', '', '空字串');
    en('   ', '   ', '只有空白');
    en('\n\n', '\n\n', '只有換行');
    en(' \t\n \r\n', ' \t\n \r\n', '空白、Tab、換行混在一起');
    en('...', nw('...'), '只有點');
    en('! ?', nw('! ?'), '兩個標點');
    en('<', nw('&lt;'), '只有 <');
    en('&', nw('&amp;'), '只有 &');
});

test('B9.2 很長的字：二十萬字的一行 2 秒內處理完，只綁最後兩個字', () => {
    const { bindTail } = need();
    const text = 'word '.repeat(40000) + 'last one.';
    const started = performance.now();
    const out = bindTail(text, 'en');
    const ms = performance.now() - started;
    assert.ok(ms < 2000, `要在 2 秒內，花了 ${Math.round(ms)} ms`);
    assert.equal(out, 'word '.repeat(40000) + nw('last one.'));
    const long = 'a'.repeat(200000);
    assert.equal(bindTail(long, 'en'), long, '二十萬字沒有空白：整段是一個字，〔派工 4-b10〕超過 20 個字元不綁');
});

test('B9.2 中文、日文照舊：最後三個字', () => {
    // 〔派工 4-b10〕中文在詞界插 <wbr>：中文比之前先拿掉 <wbr>；日文不插，照原樣比
    const { bindTail: bind } = need();
    const bindTail = (text, lang) => (lang === 'zh' ? bind(text, lang).split('<wbr>').join('') : bind(text, lang));
    assert.equal(bindTail('請按存這頁。', 'zh'), '請按存' + nw('這頁。'));
    assert.equal(bindTail('第一行。\n第二行的結尾。', 'zh'), '第一行。\n第二行的' + nw('結尾。'));
    assert.equal(bindTail('一行目です。\n二行目です。', 'ja'), '一行目です。\n二行目' + nw('です。'));
    assert.equal(bindTail('Save the page.', 'zh'), 'Save the pa' + nw('ge.'), '中文頁面裡的英文照中文的規則（三個字位）');
});

test('B9.2 說法一致：bind-tail.js 檔頭不再寫「英文不綁」、寫到英文最後兩個字；strings/README.md 那一節寫英文最後兩個字', () => {
    const src = fs.readFileSync(path.join(SITE, 'lib', 'bind-tail.js'), 'utf8');
    const head = src.slice(0, src.search(/^const\s|^import\s|^export\s/m));
    assert.doesNotMatch(head, /英文不綁/, 'lib/bind-tail.js 的檔頭還寫著「英文不綁」');
    assert.match(head, /英文[^\n]*最後兩個字/, 'lib/bind-tail.js 的檔頭要寫到英文綁最後兩個字');
    const readme = fs.readFileSync(path.join(SITE, 'strings', 'README.md'), 'utf8');
    const at = readme.indexOf('使用者自己寫的內容');
    assert.ok(at >= 0, 'strings/README.md 要有「使用者自己寫的內容」那一節');
    const end = readme.indexOf('\n## ', at);
    const section = readme.slice(at, end < 0 ? undefined : end);
    assert.match(section, /英文：最後兩個字包進 `<span class="nw">`/, 'strings/README.md 那一節要寫英文最後兩個字');
    assert.match(section, /中文、日文：最後三個字/, 'strings/README.md 那一節要寫中文、日文最後三個字');
});
