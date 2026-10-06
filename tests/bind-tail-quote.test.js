// 4-b11 的 B11.1、B11.2：bindTail(text, 'ja'|'en', …) 把短引號（「…」『…』“…”，裡面日文 8、英文 12 個碼位以內）連引號本身整個包進 <span class="nw">。介面細則見 tests/README.md「4-b11」。
//
// 量什麼：
//   B11.1 日文、英文：同一行裡成對的短引號（開引號往後找最近的同一種關引號；裡面日文 8、英文 12 個碼位以內，不算引號本身）包成 <span class="nw">「…」</span>；
//         日文 9、英文 13 個以上不包；沒關起來的不包；巢狀的只包最外面那一對（裡面的不另外包）；
//         已經整個在最後幾個字的綁定範圍裡 → 不重複包；跟綁定範圍部分重疊 → 綁定範圍往前延伸到開引號
//         （延伸後的 span 日文超過 10、英文超過 20 個碼位就不延伸、那一對也不包）；
//         〔派工 4-b11 改〕日文的門檻與上限比英文小：檢查員量到 12 字的日文引號（連引號 14 個全形字）在 280 寬撐破版面，8 字以下才不會；
//         拿掉標記、還原跳脫之後跟輸入逐字相同；中文完全不變（不包短引號、照舊插 <wbr>）。
//   B11.2 不誤傷：引號裡有 & < > " '（照跳脫）、tail（照舊在最後那個 span 裡）、換行（引號不跨行配對，span 不跨行）、空字串、一整行只有一對引號、巢狀引號，都不丟例外；
//         每一個 span 的字（不算 tail）日文在 10、英文在 20 個碼位以內；二十萬字 2 秒內（Node 22）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B11.1|B11.2"
//   node --test tests/bind-tail-quote.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib } from './helpers.js';

const need = await lib('bind-tail.js', ['bindTail']);

const OPEN = '<span class="nw">';
const CLOSE = '</span>';
const nw = (s) => OPEN + s + CLOSE;
const ARROW = '<span class="i i--arrow"></span>';
const unescape = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
const q8 = 'あいうえおかきく';
const q9 = 'あいうえおかきくけ';
const q13 = 'あいうえおかきくけこさしす';
const e12 = 'abcdefghijkl';
const e13 = 'abcdefghijklm';

// 共同檢查：拿掉 span（與 tail）、還原跳脫要跟輸入一樣；span 不巢狀、不跨行；英文每個 span 的字 ≤ 20 碼位
function check(out, text, lang, label, tail = '') {
    const bare = (tail ? out.split(tail).join('') : out).split(OPEN).join('').split(CLOSE).join('');
    assert.equal(unescape(bare), text, `${label}：拿掉 span、還原跳脫之後要跟輸入逐字相同：${out}`);
    const plain = tail ? out.split(tail).join('') : out;
    let depth = 0;
    for (const piece of plain.split(/(<span class="nw">|<\/span>)/)) {
        if (piece === OPEN) {
            depth += 1;
            assert.equal(depth, 1, `${label}：span 不能巢狀：${out}`);
        } else if (piece === CLOSE) {
            depth -= 1;
        } else if (depth === 1) {
            assert.ok(!piece.includes('\n'), `${label}：span 不能跨行：${out}`);
            if (lang === 'en') assert.ok([...unescape(piece)].length <= 20, `${label}：英文的 span 要在 20 個碼位以內，得到「${unescape(piece)}」`);
            if (lang === 'ja') assert.ok([...unescape(piece)].length <= 10, `${label}：日文的 span 要在 10 個碼位以內（含引號與往前延伸的部分），得到「${unescape(piece)}」`);
        }
    }
    assert.equal(depth, 0, `${label}：span 要成對：${out}`);
}

function expect(lang, text, want, label, options) {
    const { bindTail } = need();
    let out;
    try {
        out = options ? bindTail(text, lang, options) : bindTail(text, lang);
    } catch (err) {
        assert.fail(`${label}：bindTail(${JSON.stringify(text)}, '${lang}') 丟了例外：${err.message}`);
    }
    assert.equal(out, want, `${label}：bindTail(${JSON.stringify(text)}, '${lang}')`);
    check(out, text, lang, label, options?.tail ?? '');
}

test('B11.1 日文：短引號連引號本身包成 nw（設計審查量到的公告條標題）', () => {
    expect('ja', 'ChatGPT のデザイン変更で「これを保存」「ページを保存」が一時的に使えません',
        'ChatGPT のデザイン変更で' + nw('「これを保存」') + nw('「ページを保存」') + 'が一時的に使え' + nw('ません'), '兩對短引號各包一個');
    expect('ja', `ボタン『${q8}』を押す、それだけです`, `ボタン${nw(`『${q8}』`)}を押す、それだ${nw('けです')}`, '『』8 個碼位');
});

test('B11.1 英文：短引號連引號本身包成 nw', () => {
    expect('en', 'Fixed: after ChatGPT’s redesign the “Save this” button disappeared and “Save page” could not find the messages',
        'Fixed: after ChatGPT’s redesign the ' + nw('“Save this”') + ' button disappeared and ' + nw('“Save page”') + ' could not find ' + nw('the messages'), '更新紀錄的一條');
    expect('en', `Press “${e12}” and wait please`, `Press ${nw(`“${e12}”`)} and ${nw('wait please')}`, '12 個碼位');
});

test('B11.1 日文 8 個碼位包、9 個不包；英文 12 個包、13 個不包（不算引號本身）；沒關起來的不包', () => {
    assert.equal([...q8].length, 8, '防呆');
    assert.equal([...q9].length, 9, '防呆');
    const { bindTail } = need();
    assert.ok(bindTail(`まず「${q8}」を押してください`, 'ja').includes(nw(`「${q8}」`)), '日文 8：包');
    assert.ok(!bindTail(`まず「${q9}」を押してください`, 'ja').includes(`${OPEN}「`), '日文 9：不包（〔派工 4-b11 改〕原本 12 包、13 不包）');
    assert.ok(!bindTail(`まず『${q9}』を押してください`, 'ja').includes(`${OPEN}『`), '日文『』9：不包');
    assert.ok(bindTail(`Press “${e12}” and wait for it`, 'en').includes(nw(`“${e12}”`)), '英文 12：包');
    assert.ok(!bindTail(`Press “${e13}” and wait for it`, 'en').includes(`${OPEN}“`), '英文 13：不包');
    expect('ja', 'まず「これを保存して、それから押す', 'まず「これを保存して、それか' + nw('ら押す'), '日文沒關起來：不包');
    expect('en', 'Press “Save page and then wait for it', 'Press “Save page and then wait ' + nw('for it'), '英文沒關起來：不包');
    expect('ja', 'まず」これを保存「してから押す', 'まず」これを保存「してか' + nw('ら押す'), '關引號在前、開引號在後：不算一對');
});

test('B11.1 已經在綁定範圍裡：不重複包；部分重疊：綁定範圍往前延伸到開引號', () => {
    expect('ja', '「これを保存」', nw('「これを保存」'), '一整行只有一對引號（日文最後三字跟引號重疊 → 整對）');
    expect('ja', 'ボタン「これを保存」', 'ボタン' + nw('「これを保存」'), '日文：最後三字是「保存」」→ 延伸到開引號');
    expect('ja', 'ボタン「A」', 'ボタン' + nw('「A」'), '日文：引號整個在最後三字裡（「A」三個字位）→ 只有一個 span');
    expect('en', 'Click “Save page”', 'Click ' + nw('“Save page”'), '英文：最後兩個字剛好是整對');
    expect('en', '“Save page” is back', nw('“Save page”') + ' ' + nw('is back'), '英文：引號在前、最後兩字在後，各一個');
    expect('en', 'then tap “Save page” now', 'then tap ' + nw('“Save page” now'), '英文：最後兩字是「page” now」→ 延伸到開引號（15 個碼位）');
    expect('en', 'Open “abcde fghijk” zzzzzz', 'Open “abcde ' + nw('fghijk” zzzzzz'), '英文：延伸後 21 個碼位超過上限 → 不延伸、那一對也不包');
});

test('B11.1 日文延伸的上限 10 個碼位：剛好 10 延伸，11 不延伸、那一對也不包', () => {
    assert.equal([...'「あいうえおか」です'].length, 10, '防呆');
    expect('ja', '押す「あいうえおか」です', '押す' + nw('「あいうえおか」です'), '延伸後剛好 10：延伸');
    expect('ja', '押す「あいうえおかき」です', '押す「あいうえおかき' + nw('」です'), '延伸後 11：不延伸、那一對也不包（引號裡 7 個，單獨包是 9，但跟最後三字重疊）');
    expect('ja', `ボタン「${q8}」`, `ボタン${nw(`「${q8}」`)}`, '引號裡 8 個、引號整對 10 個：延伸到開引號');
    expect('ja', `ボタン「${q8}」です`, `ボタン「${q8}${nw('」です')}`, '引號裡 8 個再接「です」：延伸後 12 → 不延伸、不包');
});

test('B11.1 中文不變：不包短引號、照舊插 <wbr>', () => {
    const { bindTail } = need();
    assert.equal(bindTail('ChatGPT 改版：「存這則」「存這頁」暫時不能用', 'zh'), 'ChatGPT 改版：「存這則」「存這頁」暫時<wbr>' + nw('不能用'), '公告條標題');
    assert.equal(bindTail('按下“存這則”就好了', 'zh').split(OPEN).length - 1, 1, '中文的 “” 也不包（只有最後三字一個 span）');
    assert.equal(bindTail('搜尋「靈感收集器」', 'zh'), '搜尋「靈感收' + nw('集器」'), '中文引號跟最後三字重疊也不延伸');
});

test('B11.2 跳脫：引號裡有 & < > " \' 照樣跳脫，包在 span 裡', () => {
    expect('ja', '「<b>&保存」です', nw('「&lt;b&gt;&amp;保存」です'), '日文：最後三字重疊 → 延伸，裡面都跳脫');
    expect('ja', 'まず「a<b>"c\'」を押してください', 'まず' + nw('「a&lt;b&gt;&quot;c&#39;」') + 'を押してく' + nw('ださい'), '日文：引號裡五種字元');
    expect('en', 'Press “<b> & co” and wait for it', 'Press ' + nw('“&lt;b&gt; &amp; co”') + ' and wait ' + nw('for it'), '英文');
});

test('B11.2 tail：照舊在最後那個 span 的裡面、結尾', () => {
    const tail = { tail: ARROW };
    expect('ja', 'ボタン「これを保存」', 'ボタン' + nw('「これを保存」' + ARROW), '日文：延伸過的 span', tail);
    expect('ja', '「これを保存」が一時的に使えません', nw('「これを保存」') + 'が一時的に使え' + nw('ません' + ARROW), '日文：引號在前', tail);
    expect('en', '“Save page” is back', nw('“Save page”') + ' ' + nw('is back' + ARROW), '英文', tail);
});

test('B11.2 換行：引號不跨行配對，span 不跨行；前面幾行的短引號照包', () => {
    expect('ja', '「これを\n保存」です', '「これを\n保存' + nw('」です'), '開引號與關引號在不同行：不算一對');
    expect('ja', 'これは「保存」です。\n二行目です。', 'これは' + nw('「保存」') + 'です。\n二行目' + nw('です。'), '第一行的短引號照包');
    expect('en', 'Tap “Save page” first.\r\nThen wait for it.\r\n', 'Tap ' + nw('“Save page”') + ' first.\r\nThen wait ' + nw('for it.') + '\r\n', 'CRLF');
});

test('B11.2 空字串、只有空白、巢狀引號、同一種引號連開兩次：不丟例外', () => {
    expect('ja', '', '', '空字串');
    expect('en', '  \n', '  \n', '只有空白');
    expect('ja', '「『保存』を押す」と終わります', nw('「『保存』を押す」') + 'と終わ' + nw('ります'), '巢狀：只包最外面那一對');
    expect('ja', `「${q13}『保存』」と終わります`, `「${q13}${nw('『保存』')}」と終わ${nw('ります')}`, '外面那對太長：只包裡面的短引號');
    const { bindTail } = need();
    for (const text of ['「a「b」c」です', '「「「」」」', '“”', '「」です', '”“', '『』『』『']) {
        let out;
        assert.doesNotThrow(() => { out = bindTail(text, 'ja'); }, `${text}：不丟例外`);
        check(out, text, 'ja', text);
        assert.doesNotThrow(() => { out = bindTail(text, 'en'); }, `${text}（en）：不丟例外`);
        check(out, text, 'en', `${text}（en）`);
    }
});

test('B11.2 日文每一個 nw span 不超過 10 個碼位（含引號與往前延伸的部分）', () => {
    const { bindTail } = need();
    const texts = [
        'ChatGPT のデザイン変更で「これを保存」「ページを保存」が一時的に使えません',
        `まず「${q8}」を押して『${q9}』と「${q13}」を見る`,
        '押す「あいうえおかき」です',
        `「${q8}」`,
        `「${q9}」`,
        '「これを保存」を押してから一度再読み込みしてください',
        '「『保存』を押す」と終わります',
        `「${q8}『保存』」と終わります`,
    ];
    for (const text of texts) check(bindTail(text, 'ja'), text, 'ja', text);
});

test('B11.2 英文 20 個碼位的上限不被破壞：最後兩字的規則照 4-b10', () => {
    const { bindTail } = need();
    const url = 'https://jerromy.com/en/collector-1-0-5/';
    assert.equal(bindTail(`Read “the notes” at ${url}`, 'en'), `Read ${nw('“the notes”')} at ${url}`, '最後一個字超過 20 不綁，前面的短引號照包');
    assert.equal(bindTail('Then aaaaaaaaaa bbbbbbbbbb', 'en'), 'Then aaaaaaaaaa ' + nw('bbbbbbbbbb'), '沒有引號：照 4-b10');
    for (const text of ['A “b” c', 'Open “abcde fghijk” zzzzzz', 'Tap “Save” to save the long thing', `“${e12}” ${'x'.repeat(19)}`]) check(bindTail(text, 'en'), text, 'en', text);
});

test('B11.2 二十萬字 2 秒內（Node 22），結果拿掉標記跟輸入相同', () => {
    const { bindTail } = need();
    for (const [lang, text] of [['ja', '「保存」を押す。'.repeat(25000)], ['en', '“Save” it now. '.repeat(13400)], ['ja', '「'.repeat(100000) + '」'.repeat(100000)]]) {
        assert.ok(text.length >= 200000, '測試自己的防呆：要二十萬字');
        const started = performance.now();
        const out = bindTail(text, lang);
        const ms = performance.now() - started;
        assert.ok(ms < 2000, `${lang}：要在 2 秒內，花了 ${Math.round(ms)} ms`);
        check(out, text, lang, `${lang} 二十萬字`);
    }
});
