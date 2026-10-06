// 4-b7 的 B7.2：lib/segments.js 的 parseSegments(text, values?) —— 把設計師字串表裡帶斷行標記的一條字，轉成前端 React 元件用的元素樹（不產 HTML 字串）。
// 介面細則見 tests/README.md「4-b7」。標記與轉換順序照設計師的字串表說明（strings/README.md）。
//
// 量什麼：
//   B7.2 每一種標記轉成的節點（逐字比對預期的樹）；不含標記的字原樣回；代入值（%url% %nn% %章名%）；
//        跟「照 README 的 8 步轉出來的 HTML」同構（測試自己的序列化器 toHtml 對 readmeHtml，b7-fixture.js）；
//        不成對、巢狀違規、字面的標記字元丟 Error，講出是哪個字、第幾個字（err.index 是字串裡的位置）；
//        參數型別不對丟 TypeError；Unicode、很長的字、很深的巢狀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B7.2"
//   node --test tests/segments.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib } from './helpers.js';
import { el, WBR, BRK_L, BRK_R, BRK_NARROW, toHtml, readmeHtml, checkTree, tables, LANGS, IDS } from './b7-fixture.js';

const need = await lib('segments.js', ['parseSegments']);

const VALUES = { url: 'https://collector.jerromy.com/zh/', nn: '05', 章名: '安裝到 Chrome' };

// 比對樹，順便量形狀與同構
function same(text, values, want, label) {
    const { parseSegments } = need();
    const got = values === undefined ? parseSegments(text) : parseSegments(text, values);
    checkTree(got, label);
    assert.deepEqual(JSON.parse(JSON.stringify(got)), want, `${label}：元素樹不對`);
    assert.equal(toHtml(got), readmeHtml(text, values), `${label}：轉成 HTML 要跟照 README 的轉換順序轉出來的一樣`);
}

// 丟 Error：不是 TypeError、不是 RangeError；err.index 是那個字在字串裡的位置（JS 的索引）；訊息有那個字與「第 N 字」（N 以字算、1 起算）
function bad(text, { index, char, n }, label, values) {
    const { parseSegments } = need();
    let err = null;
    try {
        if (values === undefined) parseSegments(text); else parseSegments(text, values);
    } catch (e) {
        err = e;
    }
    assert.ok(err, `${label}：「${text}」要丟 Error，結果沒丟`);
    assert.ok(err instanceof Error, `${label}：要丟 Error，得到 ${err}`);
    assert.ok(!(err instanceof TypeError) && !(err instanceof RangeError), `${label}：標記寫錯不是 TypeError／RangeError，得到 ${err.name}：${err.message}`);
    const indexes = [index].flat();
    assert.ok(indexes.includes(err.index), `${label}：err.index 要是 ${indexes.join(' 或 ')}（${JSON.stringify(text)} 裡出錯的那個字），得到 ${err.index}；訊息：${err.message}`);
    const at = indexes.indexOf(err.index);
    const wantChar = [char].flat()[at] ?? [char].flat()[0];
    const wantN = [n].flat()[at] ?? [n].flat()[0];
    assert.ok(err.message.includes(wantChar), `${label}：訊息要寫出是哪個字「${wantChar}」，得到：${err.message}`);
    assert.match(err.message, new RegExp(`第\\s*${wantN}\\s*個?字`), `${label}：訊息要寫「第 ${wantN} 字」，得到：${err.message}`);
    return err;
}

test('B7.2 不含標記：原樣回一個字串；空字串回空陣列', () => {
    same('這是一句話。', undefined, ['這是一句話。'], '中文');
    same('Hello world', undefined, ['Hello world'], '英文');
    same('インスピレーション・コレクター', undefined, ['インスピレーション・コレクター'], '日文');
    same('  ', undefined, ['  '], '只有空白');
    same('', undefined, [], '空字串');
});

test('B7.2 «…» 斷行單位：一層、兩個並排、中間夾空白', () => {
    same('«甲»', undefined, [el('u', ['甲'])], '一層');
    same('«甲»«乙»', undefined, [el('u', ['甲']), el('u', ['乙'])], '兩個並排');
    same('«On a computer?» «Add to it»', undefined, [el('u', ['On a computer?']), ' ', el('u', ['Add to it'])], '中間夾空白');
    same('前«甲»後', undefined, ['前', el('u', ['甲']), '後'], '前後有字');
});

test('B7.2 «…» 巢狀：««…»«…»»、日文 privacy.lead（README 的例子）、三層', () => {
    same('««甲»«乙»»', undefined, [el('u', [el('u', ['甲']), el('u', ['乙'])])], '兩層');
    const lead = '««作者があなたのデータを»«受け取ることはできません。»»«受け取る場所が存在しないからです。»';
    same(lead, undefined, [
        el('u', [el('u', ['作者があなたのデータを']), el('u', ['受け取ることはできません。'])]),
        el('u', ['受け取る場所が存在しないからです。']),
    ], '日文 privacy.lead');
    // README 的例子逐字寫出來（不只跟 readmeHtml 比，免得兩邊一起錯）
    const { parseSegments } = need();
    assert.equal(toHtml(parseSegments(lead)),
        '<span class="u"><span class="u">作者があなたのデータを</span><span class="u">受け取ることはできません。</span></span><span class="u">受け取る場所が存在しないからです。</span>',
        '日文 privacy.lead 轉成 HTML');
    same('«««甲»»»', undefined, [el('u', [el('u', [el('u', ['甲'])])])], '三層（最多三層）');
});

test('B7.2 {…} 整段不換行：單獨、在 «…» 裡、«…» 裡兩段', () => {
    same('{Chrome}', undefined, [el('nw', ['Chrome'])], '單獨');
    same('«這是|{AI 讀得懂的}»', undefined, [el('u', ['這是', WBR, el('nw', ['AI 讀得懂的'])])], '在 «…» 裡、前面有 |');
    same('«{甲}{乙}»', undefined, [el('u', [el('nw', ['甲']), el('nw', ['乙'])])], '«…» 裡兩段');
    same('Windows・Mac の{デスクトップ版に対応}', undefined, ['Windows・Mac の', el('nw', ['デスクトップ版に対応'])], '在最外層');
});

test('B7.2 | 變 wbr：中間、開頭結尾、連續兩個、在最外層', () => {
    same('甲|乙', undefined, ['甲', WBR, '乙'], '中間');
    same('|甲|', undefined, [WBR, '甲', WBR], '開頭結尾');
    same('甲||乙', undefined, ['甲', WBR, WBR, '乙'], '連續兩個');
    same('可以在|這些地方用', undefined, ['可以在', WBR, '這些地方用'], 'where.label（最外層的 |）');
});

test('B7.2 ⟨…⟩ 夾 ⟦ ⟧：中文、英文首屏大標（⟨ 裡有 {…} 與 |，⟦ ⟧ 在 {…} 裡）', () => {
    same('{把網頁收成} ⟨{⟦AI 讀得懂的}|{素材庫⟧}⟩', undefined, [
        el('nw', ['把網頁收成']), ' ',
        el('clamp', [el('nw', [BRK_L, 'AI 讀得懂的']), WBR, el('nw', ['素材庫', BRK_R])]),
    ], '中文 hero.title');
    same('Turn the web into ⟨{⟦material} your AI {can read⟧}⟩', undefined, [
        'Turn the web into ',
        el('clamp', [el('nw', [BRK_L, 'material']), ' your AI ', el('nw', ['can read', BRK_R])]),
    ], '英文 hero.title');
    same('⟨⟦AI⟧⟩', undefined, [el('clamp', [BRK_L, 'AI', BRK_R])], '⟦ ⟧ 直接在 ⟨…⟩ 裡');
    // 逐字寫出中文大標的 HTML（跟設計稿 zh/index.html 的 h1 裡面一樣）
    const { parseSegments } = need();
    assert.equal(toHtml(parseSegments('{把網頁收成} ⟨{⟦AI 讀得懂的}|{素材庫⟧}⟩')),
        '<span class="nw">把網頁收成</span> <span class="clamp"><span class="nw"><span class="brk brk--l" aria-hidden="true"></span>AI 讀得懂的</span><wbr><span class="nw">素材庫<span class="brk brk--r" aria-hidden="true"></span></span></span>',
        '中文 hero.title 轉成 HTML');
});

test('B7.2 ⁅…¦…⁆：日文首屏大標（⟨ 裡有 ⁅，⁅ 裡有 ¦ 與 {…}，⟧ 在 {…} 裡）', () => {
    same('ウェブで見つけたものを、⟨{⟦AI} が読める⁅素材¦{ライブラリに⟧}⁆⟩', undefined, [
        'ウェブで見つけたものを、',
        el('clamp', [
            el('nw', [BRK_L, 'AI']), ' が読める',
            el('nw-wide', ['素材', BRK_NARROW, el('nw', ['ライブラリに', BRK_R])]),
        ]),
    ], '日文 hero.title');
    same('⁅甲¦乙⁆', undefined, [el('nw-wide', ['甲', BRK_NARROW, '乙'])], '最簡單的 ⁅¦⁆');
});

test('B7.2 ↵ 兩行大標：中文（↵ 前沒空白）、英文（↵ 前的空白留在兩個 span 之間）、日文', () => {
    same('«存檔工具的|{讀者是人。}»↵«這個的|{讀者是 ⟨⟦AI⟧⟩。}»', undefined, [
        el('forai__l1', [el('u', ['存檔工具的', WBR, el('nw', ['讀者是人。'])])]),
        el('forai__l2', [el('u', ['這個的', WBR, el('nw', ['讀者是 ', el('clamp', [BRK_L, 'AI', BRK_R]), '。'])])]),
    ], '中文 forai.title');
    same('«Web clippers are written» «for {human readers.}» ↵«This one is written» «for {an ⟨⟦AI⟧⟩.}»', undefined, [
        el('forai__l1', [el('u', ['Web clippers are written']), ' ', el('u', ['for ', el('nw', ['human readers.'])])]),
        ' ',
        el('forai__l2', [el('u', ['This one is written']), ' ', el('u', ['for ', el('nw', ['an ', el('clamp', [BRK_L, 'AI', BRK_R]), '.'])])]),
    ], '英文 forai.title');
    same('«{保存ツールは、}»«読み手が|{人間です。}»↵«これは|読み手が {⟨⟦AI⟧⟩ です。}»', undefined, [
        el('forai__l1', [el('u', [el('nw', ['保存ツールは、'])]), el('u', ['読み手が', WBR, el('nw', ['人間です。'])])]),
        el('forai__l2', [el('u', ['これは', WBR, '読み手が ', el('nw', [el('clamp', [BRK_L, 'AI', BRK_R]), ' です。'])])]),
    ], '日文 forai.title');
    same('甲 ↵乙', undefined, [el('forai__l1', ['甲']), ' ', el('forai__l2', ['乙'])], '沒有其他標記');
});

test('B7.2 代入值：%nn%、%章名%、%url% 換成字，跟旁邊的字併成一段', () => {
    same('{看教學 %nn%}', VALUES, [el('nw', ['看教學 05'])], 'features.more');
    same('{%nn% 章を見る}', VALUES, [el('nw', ['05 章を見る'])], '日文 features.more');
    same('«「%章名%」»«{看完了}»', VALUES, [el('u', ['「安裝到 Chrome」']), el('u', [el('nw', ['看完了'])])], 'tutorial.done');
    same('Open this link: %url%', VALUES, ['Open this link: https://collector.jerromy.com/zh/'], 'mail.self.body');
    same('%nn%%nn%', VALUES, ['0505'], '連著兩個');
    same('沒有代入值的字', VALUES, ['沒有代入值的字'], '給了 values 但字裡沒有');
});

test('B7.2 代入值：沒給 values 就原樣留著 %…%（命令驗證時用這條）', () => {
    same('{看教學 %nn%}', undefined, [el('nw', ['看教學 %nn%'])], 'features.more');
    same('«「%章名%」»', undefined, [el('u', ['「%章名%」'])], 'tutorial.done');
    same('網址：%url%', undefined, ['網址：%url%'], 'mail');
});

test('B7.2 代入值最後才換：值裡的標記字元、HTML、%…% 都是普通的字', () => {
    const { parseSegments } = need();
    const values = { ...VALUES, 章名: 'A«B»{C}|D⟨E⟩↵%nn%' };
    const got = parseSegments('«「%章名%」»', values);
    checkTree(got, '值裡有標記字元');
    assert.deepEqual(JSON.parse(JSON.stringify(got)), [el('u', ['「A«B»{C}|D⟨E⟩↵%nn%」'])], '值裡的標記不轉、%nn% 不再換一次');
    assert.deepEqual(JSON.parse(JSON.stringify(parseSegments('%章名%', { ...VALUES, 章名: '<b>x</b> & y' }))), ['<b>x</b> & y'], '值裡的 HTML 是字');
    assert.deepEqual(JSON.parse(JSON.stringify(parseSegments('%url%', { url: '' }))), [], '值是空字串：沒有字就沒有節點');
});

test('B7.2 字裡的 HTML 只是字（不產 HTML 字串）', () => {
    const { parseSegments } = need();
    assert.deepEqual(JSON.parse(JSON.stringify(parseSegments('a<b>c</b> & d'))), ['a<b>c</b> & d'], 'HTML 標籤與 & 是字');
    const got = parseSegments('«<span class="u">»');
    assert.deepEqual(JSON.parse(JSON.stringify(got)), [el('u', ['<span class="u">'])], '«…» 裡的 HTML 也是字');
    assert.equal(toHtml(got), '<span class="u">&lt;span class=&quot;u&quot;&gt;</span>', '序列化時被跳脫，表示它是字不是元素');
});

test('B7.2 Unicode：𠮷、emoji（膚色、ZWJ）、組合字元原樣在節點裡', () => {
    same('«𠮷野家»«👍🏽»', undefined, [el('u', ['𠮷野家']), el('u', ['👍🏽'])], '𠮷 與帶膚色的 emoji');
    same('{\u{1F468}\u200D\u{1F469}\u200D\u{1F467}}|か\u3099', undefined, [el('nw', ['\u{1F468}\u200D\u{1F469}\u200D\u{1F467}']), WBR, 'か\u3099'], 'ZWJ 與組合濁點');
});

test('B7.2 回傳的是一般物件：JSON 轉一次再轉回來一模一樣；每次呼叫各給一份', () => {
    const { parseSegments } = need();
    const text = '«存檔工具的|{讀者是人。}»↵«這個的|{讀者是 ⟨⟦AI⟧⟩。}»';
    const a = parseSegments(text);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a, 'JSON 來回要一樣（沒有函式、undefined、類別）');
    a[0].children.push('被改了');
    a[0].props.className = '被改了';
    assert.deepEqual(JSON.parse(JSON.stringify(parseSegments(text))), JSON.parse(JSON.stringify(parseSegments(text))), '同一句兩次結果相同');
    assert.notEqual(parseSegments(text)[0].props.className, '被改了', '改了上一次的結果不影響下一次（不共用節點）');
});

test('B7.2 字串表的 10 個 id × 三語：每一條都跟照 README 轉出來的 HTML 同構（有給、沒給 values 各一次）', () => {
    const { parseSegments } = need();
    const all = tables();
    for (const lang of LANGS) {
        for (const id of IDS) {
            const text = all[lang][id];
            for (const values of [undefined, VALUES]) {
                const got = values === undefined ? parseSegments(text) : parseSegments(text, values);
                checkTree(got, `${lang} ${id}`);
                assert.equal(toHtml(got), readmeHtml(text, values), `${lang} ${id}${values ? '（有 values）' : ''}：要跟 README 的轉換同構`);
            }
        }
    }
});

test('B7.2 不成對：開了沒關、多出來的結尾、交錯', () => {
    bad('«甲', { index: 0, char: '«', n: 1 }, '«沒關（講開頭那個 « 的位置）');
    bad('甲»', { index: 1, char: '»', n: 2 }, '多出來的 »');
    bad('{甲', { index: 0, char: '{', n: 1 }, '{ 沒關');
    bad('甲}', { index: 1, char: '}', n: 2 }, '多出來的 }');
    bad('⟨甲', { index: 0, char: '⟨', n: 1 }, '⟨ 沒關');
    bad('甲⟩', { index: 1, char: '⟩', n: 2 }, '多出來的 ⟩');
    bad('⁅甲', { index: 0, char: '⁅', n: 1 }, '⁅ 沒關');
    bad('甲⁆', { index: 1, char: '⁆', n: 2 }, '多出來的 ⁆');
    bad('«{甲»}', { index: [3, 1], char: ['»', '{'], n: [4, 2] }, '交錯（講 » 或沒關的 {）');
    bad('«甲»«乙', { index: 3, char: '«', n: 4 }, '第二個單位沒關');
});

test('B7.2 巢狀違規：{ 裡有 {、{ 裡有 «、« 超過三層、↵ 在成對標記裡或兩個 ↵、¦ 不在 ⁅…⁆ 裡', () => {
    bad('{甲{乙}丙}', { index: 2, char: '{', n: 3 }, '{ 裡有 {');
    bad('{甲«乙»}', { index: 2, char: '«', n: 3 }, '{ 裡有 «');
    bad('««««甲»»»»', { index: 3, char: '«', n: 4 }, '«…» 第四層');
    bad('«甲↵乙»', { index: 2, char: '↵', n: 3 }, '↵ 在 «…» 裡');
    bad('{甲↵乙}', { index: 2, char: '↵', n: 3 }, '↵ 在 {…} 裡');
    bad('甲↵乙↵丙', { index: 3, char: '↵', n: 4 }, '兩個 ↵');
    bad('甲¦乙', { index: 1, char: '¦', n: 2 }, '¦ 不在 ⁅…⁆ 裡');
    bad('«甲¦乙»', { index: 2, char: '¦', n: 3 }, '¦ 在 «…» 裡但不在 ⁅…⁆ 裡');
});

test('B7.2 字面的標記字元：單獨的 %、沒關的 %、不認得的代入值', () => {
    bad('成長 100%', { index: 6, char: '%', n: 7 }, '單獨的 %');
    bad('網址：%url', { index: 3, char: '%', n: 4 }, '%url 沒關');
    bad('%foo%', { index: 0, char: '%', n: 1 }, '不認得的 %foo%');
    bad('%URL%', { index: 0, char: '%', n: 1 }, '大小寫不同也不認得');
    bad('%%', { index: 0, char: '%', n: 1 }, '空的 %%');
    bad('a { b', { index: 2, char: '{', n: 3 }, '字面的 {');
});

test('B7.2 位置以字算：前面有 emoji、𠮷 時「第 N 字」照字數，err.index 照字串索引', () => {
    bad('😀«甲', { index: 2, char: '«', n: 2 }, 'emoji 後面的 « 沒關');
    bad('𠮷𠮷}', { index: 4, char: '}', n: 3 }, '𠮷 後面多出來的 }');
});

test('B7.2 ↵ 後半段出錯：位置照整句算', () => {
    bad('«甲»↵«乙', { index: 4, char: '«', n: 5 }, '後半段的 « 沒關');
    bad('甲 ↵乙}', { index: 4, char: '}', n: 5 }, '後半段多出來的 }');
});

test('B7.2 給了 values 卻少了要的那個：丟 Error，講出是哪個代入值', () => {
    const err = bad('{看教學 %nn%}', { index: 5, char: '%nn%', n: 6 }, '少了 nn', { url: 'x' });
    assert.ok(err.message.includes('%nn%'), `訊息要寫出 %nn%：${err.message}`);
});

test('B7.2 參數型別不對：丟 TypeError', () => {
    const { parseSegments } = need();
    for (const text of [undefined, null, 5, ['«甲»'], { toString: () => '甲' }]) {
        assert.throws(() => parseSegments(text), TypeError, `text 是 ${JSON.stringify(text) ?? String(text)} 要丟 TypeError`);
    }
    for (const values of [null, 'nn', 5, ['05']]) {
        assert.throws(() => parseSegments('%nn%', values), TypeError, `values 是 ${JSON.stringify(values)} 要丟 TypeError`);
    }
    for (const value of [5, null, ['05'], { toString: () => '05' }]) {
        assert.throws(() => parseSegments('%nn%', { nn: value }), TypeError, `值是 ${JSON.stringify(value)} 要丟 TypeError（值只收字串）`);
    }
});

test('B7.2 很長的字：兩萬個單位、二十萬字以內 2 秒內轉完，結果同構', () => {
    const { parseSegments } = need();
    const text = '«字{詞語}|⟨⟦括⟧⟩»'.repeat(20000);
    const started = performance.now();
    const got = parseSegments(text);
    const ms = performance.now() - started;
    assert.equal(got.length, 20000, '要有兩萬個單位');
    assert.ok(ms < 2000, `要在 2 秒內轉完，花了 ${Math.round(ms)} ms`);
    assert.equal(toHtml(got), readmeHtml(text), '很長的字也要同構');
    const flat = '字'.repeat(200000);
    assert.deepEqual(parseSegments(flat), [flat], '二十萬字沒有標記：一個字串');
});

test('B7.2 很深的巢狀：兩萬層 ⟨ 不能把堆疊撐爆（回樹或丟 Error 都可以，不能是 RangeError）', () => {
    const { parseSegments } = need();
    for (const text of ['⟨'.repeat(20000) + '甲' + '⟩'.repeat(20000), '⟨'.repeat(20000) + '甲', '«{' + '⟨'.repeat(20000)]) {
        try {
            const got = parseSegments(text);
            assert.ok(Array.isArray(got), '回傳要是陣列');
        } catch (err) {
            assert.ok(!(err instanceof RangeError) && !/call stack/i.test(String(err && err.message)), `不能撐爆堆疊：${err && err.message}`);
            assert.ok(err instanceof Error && Number.isInteger(err.index), `丟的話要是帶 index 的 Error：${err && err.message}`);
        }
    }
});
