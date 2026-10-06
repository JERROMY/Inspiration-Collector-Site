// 孤字綁定 lib/bind-tail.js 的 bindTail(text, lang)（目標檔 4-b2 的 B2.1、B2.2、B2.3；介面細則見 tests/README.md「4-b2」）。
//
// 量什麼：
//   B2.1 中文：最後三個「字」（書寫字位，連同結尾標點）包進 <span class="nw">；全形半形標點、省略號、……、不足三字整段包、空字串。
//   B2.2 日文跟中文一樣（假名、長音符、全形括號、組合用濁點、半形片假名）；emoji（膚色、ZWJ、國旗）與少見漢字（surrogate pair）不被切半；
//        英文〔派工 4-b9 改〕最後兩個字包進 span（原本只跳脫不包，跟字串表說明不一致；細則在 bind-tail-en.test.js）；lang 寫錯或 text 不是字串丟 TypeError。
//   B2.3 結尾的空白與換行留在 span 外面；多行只處理最後一個非空行、不跨行去借字；輸出一律跳脫（& < > " '），
//        輸入有 <script> 不會變成標籤；輸入裡字面的 <span class="nw"> 只是普通文字、照樣跳脫。
//   每一條的輸出另外過一次 checkSafe()：拿掉我們加的 span 之後，不准還有 < > " '，& 只能是五種實體之一，
//   而且把實體還原回去要跟輸入一模一樣（沒有掉字、沒有多字）；非空白的輸入剛好一組 span（〔派工 4-b9〕英文也是一組，原本是零組）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B2.1"
//   node --test tests/bind-tail.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const OPEN = '<span class="nw">';
const CLOSE = '</span>';
const nw = (s) => OPEN + s + CLOSE;

function unescape(html) {
    return html.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
}

function checkSafe(out, text, lang, label, spanCount) {
    assert.equal(typeof out, 'string', `${label}：要回傳字串，得到 ${JSON.stringify(out)}`);
    const spans = out.split(OPEN).length - 1;
    const closes = out.split(CLOSE).length - 1;
    // 〔派工 4-b9〕英文也綁，原本英文是 0 組；〔派工 4-b10〕英文最後一個字超過 20 個字元就不綁（0 組）
    const lastWord = text.trim().split(/\s+/).pop() ?? '';
    // 〔派工 4-b11〕日文、英文的短引號另外包一個 span：有短引號的那幾條由呼叫的人給確切的組數（spanCount）
    const want = spanCount ?? (text.trim() === '' || (lang === 'en' && [...lastWord].length > 20) ? 0 : 1);
    assert.equal(spans, want, `${label}：要剛好 ${want} 組 ${OPEN}，得到 ${spans} 組：${out}`);
    assert.equal(closes, want, `${label}：要剛好 ${want} 個 ${CLOSE}，得到 ${closes} 個：${out}`);
    const bare = out.split(OPEN).join('').split(CLOSE).join('');
    assert.doesNotMatch(bare, /[<>"']/, `${label}：拿掉 span 之後還有沒跳脫的 < > " '：${out}`);
    assert.doesNotMatch(bare, /&(?!(amp|lt|gt|quot|#39);)/, `${label}：& 要跳脫成 &amp;（實體只用 &amp; &lt; &gt; &quot; &#39;）：${out}`);
    assert.equal(unescape(bare), text, `${label}：拿掉 span、還原實體之後要跟輸入一模一樣（掉字或多字）：${out}`);
}

// 〔派工 4-b10〕中文在詞界插 <wbr>（細則與確切位置在 bind-tail-wbr.test.js）：這裡的期待值是「不插詞界時的輸出」，
// 中文比之前先拿掉所有 <wbr> —— 4-b10 要的就是「拿掉 <wbr> 之後跟原本逐字相同」。日文、英文不插，照原樣比
function expectBind(lang, text, want, label, spanCount) {
    const { bindTail } = need();
    const raw = bindTail(text, lang);
    const out = lang === 'zh' ? raw.split('<wbr>').join('') : raw;  // 〔派工 4-b10 改〕只有中文插，日文、英文照原樣比（日文要是插了會紅）
    assert.equal(out, want, `${label}：bindTail(${JSON.stringify(text)}, '${lang}')（拿掉 <wbr> 之後）`);
    checkSafe(out, text, lang, label, spanCount);
}

// ── B2.1 中文 ──

test('B2.1 中文：最後三個字連同結尾的句號一起包', () => {
    expectBind('zh', '請按存這頁。', '請按存' + nw('這頁。'), '句號算一個字');
    expectBind('zh', '收集器存好了', '收集器' + nw('存好了'), '沒有標點');
});

test('B2.1 中文：剛好三字、不足三字整段包；空字串回空字串', () => {
    expectBind('zh', '存好了', nw('存好了'), '剛好三字');
    expectBind('zh', '好。', nw('好。'), '兩個字');
    expectBind('zh', '好', nw('好'), '一個字');
    expectBind('zh', '', '', '空字串');
});

test('B2.1 中文：全形標點、半形標點、括號與引號都算一個字', () => {
    expectBind('zh', '真的可以嗎？', '真的可' + nw('以嗎？'), '全形問號');
    expectBind('zh', '結尾是半形!', '結尾是' + nw('半形!'), '半形驚嘆號');
    expectBind('zh', '這是（第二版）', '這是（第' + nw('二版）'), '全形括號');
    expectBind('zh', '請按「存這頁」', '請按「存' + nw('這頁」'), '引號');
    expectBind('zh', '一行，兩行；', '一行，' + nw('兩行；'), '分號');
});

test('B2.1 中文：省略號以字算（「…」一個字、「……」兩個字、「...」三個字）', () => {
    expectBind('zh', '請稍候……', '請稍' + nw('候……'), '「……」是兩個字');
    expectBind('zh', '等一下…', '等' + nw('一下…'), '「…」是一個字');
    expectBind('zh', '等一下...', '等一下' + nw('...'), '三個半形點是三個字');
});

test('B2.1 中文：中間夾英文也是一個字一個字算（不是以詞算）', () => {
    expectBind('zh', '支援 Chrome。', '支援 Chro' + nw('me。'), '英文字母一個一個算');
    expectBind('zh', '詳見 https://jerromy.com/。', '詳見 https://jerromy.co' + nw('m/。'), '連結文字照樣算字');
});

// ── B2.2 日文、英文、不能切半的字 ──

test('B2.2 日文：跟中文一樣（假名、長音符、全形括號、引號）', () => {
    expectBind('ja', '保存しました。', '保存しま' + nw('した。'), '句點');
    expectBind('ja', 'フォルダー', 'フォ' + nw('ルダー'), '長音符算一個字');
    expectBind('ja', '（テスト）', '（テ' + nw('スト）'), '全形括號');
    expectBind('ja', '「保存」を押す', nw('「保存」') + nw('を押す'), '引號後面（〔派工 4-b11〕短引號連引號包成 nw：兩組 span）', 2);
    expectBind('ja', 'です', nw('です'), '不足三字');
});

test('B2.2 日文：組合用濁點、半形片假名的濁點跟前一個字算一個字', () => {
    expectBind('ja', '\u3053\u308C\u306F\u304B\u3099', '\u3053' + nw('\u308C\u306F\u304B\u3099'), '「か」＋組合用濁點 U+3099');
    // 半形片假名「データベース」：倒數第三個字是 U+FF8D（半形「へ」）＋ U+FF9E（半形濁點），合起來一個字
    expectBind('ja', '\uFF83\uFF9E\uFF70\uFF80\uFF8D\uFF9E\uFF70\uFF7D', '\uFF83\uFF9E\uFF70\uFF80' + nw('\uFF8D\uFF9E\uFF70\uFF7D'), '半形片假名＋半形濁點');
});

test('B2.2 surrogate pair 不切半：少見漢字（𠮷 U+20BB7）', () => {
    expectBind('zh', '這是\u{20BB7}野家', '這是' + nw('\u{20BB7}野家'), '𠮷 在倒數第三個字');
    expectBind('zh', '野家的\u{20BB7}', '野' + nw('家的\u{20BB7}'), '𠮷 在最後');
});

test('B2.2 emoji 不切半：帶膚色、ZWJ 組合、國旗都是一個字', () => {
    expectBind('zh', '做得很好\u{1F44D}\u{1F3FD}', '做得' + nw('很好\u{1F44D}\u{1F3FD}'), '👍 ＋膚色');
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    expectBind('zh', '我們一家' + family, '我們' + nw('一家' + family), 'ZWJ 組合的一家人');
    expectBind('zh', '來自台灣\u{1F1F9}\u{1F1FC}', '來自' + nw('台灣\u{1F1F9}\u{1F1FC}'), '國旗（兩個區域指示符）');
    expectBind('ja', 'できた\u{1F389}', 'で' + nw('きた\u{1F389}'), '日文＋emoji');
});

// 〔派工 4-b9〕英文改成最後兩個字也綁（以空白分）：這一條原本是「英文：只跳脫、不包」，期待值照新規則改
test('B2.2 英文〔4-b9 改〕：最後兩個字包進 span，其餘只跳脫', () => {
    expectBind('en', 'Save the page.', 'Save ' + nw('the page.'), '一般句子');
    expectBind('en', 'Tom & "Jerry" <b> it\'s', 'Tom &amp; &quot;Jerry&quot; ' + nw('&lt;b&gt; it&#39;s'), '五種字元都跳脫');
    expectBind('en', 'Line one.\nLine two.\n', 'Line one.\n' + nw('Line two.') + '\n', '多行：只綁最後一行');
    expectBind('en', 'Collector 收集器。', nw('Collector 收集器。'), '英文頁面裡有中文：照空白分，兩個字整個綁');
    expectBind('en', '', '', '空字串');
});

test('B2.2 lang 寫錯丟 TypeError', () => {
    const { bindTail } = need();
    for (const lang of [undefined, null, '', 'zh-TW', 'zh_TW', 'ZH', 'jp', 'ko', 'fr']) {
        assert.throws(() => bindTail('請按存這頁。', lang), TypeError, `lang 是 ${JSON.stringify(lang)} 要丟 TypeError`);
    }
});

test('B2.2 text 不是字串丟 TypeError', () => {
    const { bindTail } = need();
    for (const text of [undefined, null, 123, ['請按存這頁。'], { toString: () => '請按存這頁。' }]) {
        for (const lang of ['zh', 'ja', 'en']) {
            assert.throws(() => bindTail(text, lang), TypeError, `text 是 ${JSON.stringify(text)}（${lang}）要丟 TypeError`);
        }
    }
});

// ── B2.3 空白、多行、跳脫 ──

test('B2.3 結尾的空白與換行不算字、留在 span 外面', () => {
    expectBind('zh', '請按存這頁。  \n', '請按存' + nw('這頁。') + '  \n', '空白＋換行');
    expectBind('zh', '請按存這頁。\t', '請按存' + nw('這頁。') + '\t', 'Tab');
    expectBind('zh', '好。\n', nw('好。') + '\n', '不足三字＋換行');
});

test('B2.3 多行：只處理最後一個非空行，前面的行原樣', () => {
    expectBind('zh', '第一段的話。\n第二段的結尾。\n', '第一段的話。\n第二段的' + nw('結尾。') + '\n', '兩行');
    expectBind('zh', '第一段。\n第二段。\n\n  \n', '第一段。\n第' + nw('二段。') + '\n\n  \n', '後面有空行與只有空白的行');
    expectBind('ja', '一行目です。\n二行目です。', '一行目です。\n二行目' + nw('です。'), '日文兩行');
    expectBind('zh', '第一行。\r\n第二行。\r\n', '第一行。\r\n第' + nw('二行。') + '\r\n', 'CRLF 行尾');
});

test('B2.3 不跨行：最後一行不足三字只包那一行，不從上一行借字', () => {
    expectBind('zh', '第一段很長的話。\n好', '第一段很長的話。\n' + nw('好'), '最後一行只有一個字');
    expectBind('zh', '第一段很長的話。\n好。\n', '第一段很長的話。\n' + nw('好。') + '\n', '最後一行兩個字＋換行');
});

test('B2.3 只有空白：原樣回傳、不包', () => {
    expectBind('zh', '  \n', '  \n', '空白與換行');
    expectBind('ja', '\n\n', '\n\n', '只有換行');
});

test('B2.3 輸出一律跳脫：實體不被切開（先數字、再跳脫）', () => {
    expectBind('zh', '請看 <b>', '請看 ' + nw('&lt;b&gt;'), '< 與 > 各算一個字');
    expectBind('zh', '比較 A&B', '比較 ' + nw('A&amp;B'), '& 算一個字');
    expectBind('zh', '他說"好"與\'行\'', '他說&quot;好&quot;與' + nw('&#39;行&#39;'), '雙引號與單引號');
});

test('B2.3 輸入有 <script> 不會變成標籤', () => {
    expectBind('zh', '<script>alert("x")</script>', '&lt;script&gt;alert(&quot;x&quot;)&lt;/scri' + nw('pt&gt;'), '中文');
    expectBind('ja', '<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(' + nw('1)&gt;'), '日文');
    expectBind('en', '<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;', '英文〔4-b10 改〕：沒有空白，整段是一個 25 個字元的字，超過上限不綁');
    expectBind('en', '<b>x</b>', nw('&lt;b&gt;x&lt;/b&gt;'), '英文：短的標籤字整段包');
});

test('B2.3 輸入裡字面的 <span class="nw"> 只是普通文字：照樣跳脫、照樣包最後三個字', () => {
    expectBind('zh', '<span class="nw">已包</span>',
        '&lt;span class=&quot;nw&quot;&gt;已包&lt;/sp' + nw('an&gt;'), '字面的 nw 標記');
});
