// 檢查使用者寫的內容：lib/content-check.js 的 checkContent(dir)（目標檔 4-b4 的 B4.2；介面細則見 tests/README.md「4-b4」）。
//
// 量什麼（一律用 tests/fixtures/content-check/ 的小資料夾，每個是一份完整的 content/）：
//   B4.2 回傳剛好 { ok, problems, warnings, summary }；problems 每條剛好 { file, line, raw, reason }；ok ＝ 沒有 problems。
//   B4.2 好的一組（good/）：ok、problems 與 warnings 都是空的。
//   B4.2 壞條目（bad-entry/）：readContent 讀到的每一筆 ok:false（壞的 item、壞的公告、壞的連結）都在 problems 裡，
//        file＝檔名、line／raw／reason 跟 readContent 給的一模一樣；三語兩邊都壞在同一個位置、或壞的是版本裡的一條 item，不另外報「三語不一致」。
//   B4.2 整區讀不到（unreadable/，少了 news.ja.md）：problems 有 { file: 'news.ja.md', line: null, raw: null, reason: readContent 的原因 }。
//   B4.2 三語不一致：版本號不同（changelog-versions/）、某一版的條數不同（changelog-items/）、版本順序不同（changelog-order/）、
//        公告日期不同（news-dates/）、公告則數不同（news-count/）、置頂不同（news-pinned/）
//        → ok:false，problems 有一條 file 是 'changelog' 或 'news'、line 與 raw 是 null、reason 是中文、點名不一樣的那個語言與那一版／那一則。
//   B4.2 〔檢查員第 1 輪〕同一版的日期三語不一樣（changelog-dates/，日文 1.0.4 是 2026-09-29）→ file＝changelog，reason 點名 ja、1.0.4 與兩個日期。
//   B4.2 警告（不影響 ok）：順序不是由新到舊（order-reversed/，六支檔各一條，file＝那支檔名）、公告完全空白（empty-news/，三支公告檔各一條）、
//        沒有任何置頂（no-pinned/，file 是 news 開頭、message 講「置頂」）。
//   B4.2 dir 不存在、dir 是一個檔 → 丟 Error，訊息是中文。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B4.2 檢查"
//   node --test tests/content-check.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib } from './helpers.js';
import { fixture, expectedProblems, sortProblems, tmp, LANG_WORDS, FILES } from './content-check-fixture.js';

const need = await lib('content-check.js', ['checkContent']);
const CJK = /[一-鿿]/;

async function check(name) {
    const { checkContent } = need();
    const result = await checkContent(fixture(name));
    assert.ok(result && typeof result === 'object', `${name}：checkContent 要回傳物件，得到 ${JSON.stringify(result)}`);
    assert.deepEqual(Object.keys(result).sort(), ['ok', 'problems', 'summary', 'warnings'],
        `${name}：回傳要剛好有 ok、problems、warnings、summary，得到 ${Object.keys(result).join('、')}`);
    assert.ok(Array.isArray(result.problems), `${name}：problems 要是陣列`);
    assert.ok(Array.isArray(result.warnings), `${name}：warnings 要是陣列`);
    for (const p of result.problems) {
        assert.deepEqual(Object.keys(p).sort(), ['file', 'line', 'raw', 'reason'], `${name}：problems 每條剛好 file、line、raw、reason，得到 ${JSON.stringify(p)}`);
        assert.ok(typeof p.reason === 'string' && CJK.test(p.reason), `${name}：problem 的 reason 要是中文，得到 ${JSON.stringify(p)}`);
    }
    for (const w of result.warnings) {
        assert.deepEqual(Object.keys(w).sort(), ['file', 'message'], `${name}：warnings 每條剛好 file、message，得到 ${JSON.stringify(w)}`);
        assert.ok(typeof w.message === 'string' && CJK.test(w.message), `${name}：warning 的 message 要是中文，得到 ${JSON.stringify(w)}`);
    }
    assert.equal(result.ok, result.problems.length === 0, `${name}：ok 要等於「沒有 problems」，得到 ok=${result.ok}、problems ${result.problems.length} 條`);
    return result;
}

// 防呆：這個 fixture 用 readContent 讀起來每一條都是好的（三語不一致、警告那幾組不能夾著別的壞法）
async function fixtureAllOk(name) {
    const found = await expectedProblems(fixture(name));
    assert.deepEqual(found, [], `測試自己的 fixture 壞了：${name}/ 用 readContent 讀起來要每一條都好，得到 ${JSON.stringify(found)}`);
}

const fileProblems = (result) => result.problems.filter((p) => FILES.includes(p.file));
const crossProblems = (result) => result.problems.filter((p) => p.file === 'changelog' || p.file === 'news');

test('B4.2 檢查：好的一組 → ok、沒有 problems、沒有 warnings、有 summary', async () => {
    await fixtureAllOk('good');
    const result = await check('good');
    assert.deepEqual(result.problems, [], `好的一組不該有 problems，得到 ${JSON.stringify(result.problems)}`);
    assert.deepEqual(result.warnings, [], `好的一組不該有 warnings（由新到舊、有公告、有置頂），得到 ${JSON.stringify(result.warnings)}`);
    assert.equal(result.ok, true);
    assert.notEqual(result.summary, undefined, '要有 summary');
    assert.notEqual(result.summary, null, '要有 summary');
});

test('B4.2 檢查：壞條目 → readContent 讀到的每一筆 ok:false 都在 problems 裡（file＝檔名，line、raw、reason 照條目的），不靜靜略過', async () => {
    const want = await expectedProblems(fixture('bad-entry'));
    assert.equal(want.length, 5, `測試自己的 fixture：bad-entry/ 要剛好 5 筆壞的（1 條 item、3 則公告、1 個連結），得到 ${JSON.stringify(want)}`);
    const result = await check('bad-entry');
    assert.equal(result.ok, false, '有壞條目時 ok 要是 false');
    assert.deepEqual(sortProblems(fileProblems(result)), sortProblems(want),
        '每一筆壞的都要列出來，file 是檔名、line／raw／reason 跟 readContent 給的一樣（不多不少）');
    assert.deepEqual(crossProblems(result), [],
        `壞在同一個位置（三語都壞）或壞的是版本裡的一條 item（條數照樣算進去），不另外報三語不一致，得到 ${JSON.stringify(crossProblems(result))}`);
});

test('B4.2 檢查：整區讀不到（少了 news.ja.md）→ problems 有 { file: news.ja.md, line: null, raw: null, reason }', async () => {
    const want = await expectedProblems(fixture('unreadable'));
    assert.equal(want.length, 1, `測試自己的 fixture：unreadable/ 要剛好一區讀不到，得到 ${JSON.stringify(want)}`);
    const result = await check('unreadable');
    assert.equal(result.ok, false, '有一區讀不到時 ok 要是 false');
    assert.deepEqual(fileProblems(result), want, '讀不到的那一區要列出來：file 是 news.ja.md、line 與 raw 是 null、reason 是 readContent 的原因');
    assert.ok(result.problems.find((p) => p.file === 'news.ja.md').reason.includes('news.ja.md'), 'reason 要講出檔名');
});

for (const { name, kind, lang, words, what } of [
    { name: 'changelog-versions', kind: 'changelog', lang: 'en', words: ['1.0.3', '1.0.2'], what: '英文少了 1.0.3、多了 1.0.2' },
    { name: 'changelog-items', kind: 'changelog', lang: 'ja', words: ['1.0.4'], what: '日文 1.0.4 少一條' },
    { name: 'changelog-order', kind: 'changelog', lang: 'ja', words: ['1.0.3', '1.0.4', '順序'], what: '日文版本順序倒過來' },
    { name: 'news-dates', kind: 'news', lang: 'en', words: ['2026-09-28', '2026-09-29', '第 2 則'], what: '英文第 2 則日期不同' },
    { name: 'news-count', kind: 'news', lang: 'ja', words: ['則'], what: '日文少一則' },
    { name: 'news-pinned', kind: 'news', lang: 'en', words: ['置頂'], what: '英文第 2 則沒有置頂' },
]) {
    test(`B4.2 檢查：三語不一致（${what}）→ ok:false，problems 有一條 file＝${kind}、點名 ${lang} 與那一版／那一則`, async () => {
        await fixtureAllOk(name);
        const result = await check(name);
        assert.equal(result.ok, false, `${name}：三語不一致時 ok 要是 false`);
        assert.deepEqual(fileProblems(result), [], `${name}：每一條本身都是好的，不該有檔案的 problems，得到 ${JSON.stringify(fileProblems(result))}`);
        const cross = result.problems.filter((p) => p.file === kind);
        assert.ok(cross.length >= 1, `${name}：要有一條 file 是「${kind}」的 problem，得到 ${JSON.stringify(result.problems)}`);
        for (const p of cross) {
            assert.equal(p.line, null, `${name}：三語不一致沒有單一行號，line 要是 null，得到 ${JSON.stringify(p)}`);
            assert.equal(p.raw, null, `${name}：三語不一致沒有單一原文，raw 要是 null，得到 ${JSON.stringify(p)}`);
        }
        assert.ok(cross.some((p) => LANG_WORDS[lang].test(p.reason) && words.some((w) => p.reason.includes(w))),
            `${name}：reason 要點名 ${lang}（或它的中文名）與「${words.join('」或「')}」，得到 ${JSON.stringify(cross.map((p) => p.reason))}`);
    });
}

test('B4.2 檢查：三語同一版的日期不一樣（日文 1.0.4 寫 2026-09-29、中英寫 2026-09-30）→ ok:false，file＝changelog，reason 點名 ja、1.0.4 與兩個日期', async () => {
    await fixtureAllOk('changelog-dates');
    const result = await check('changelog-dates');
    assert.equal(result.ok, false, 'changelog-dates：同一版三語日期不一樣時 ok 要是 false（使用者最可能在三支檔各填一次日期）');
    assert.deepEqual(fileProblems(result), [], `每一條本身都是好的，不該有檔案的 problems，得到 ${JSON.stringify(fileProblems(result))}`);
    const cross = crossProblems(result);
    assert.ok(cross.length >= 1, `要有一條 file 是「changelog」的 problem，得到 ${JSON.stringify(result.problems)}`);
    for (const p of cross) {
        assert.equal(p.file, 'changelog', `只有更新紀錄的日期不一樣，file 要是 changelog，得到 ${JSON.stringify(p)}`);
        assert.equal(p.line, null, `line 要是 null，得到 ${JSON.stringify(p)}`);
        assert.equal(p.raw, null, `raw 要是 null，得到 ${JSON.stringify(p)}`);
    }
    assert.ok(cross.some((p) => LANG_WORDS.ja.test(p.reason) && ['1.0.4', '2026-09-29', '2026-09-30'].every((w) => p.reason.includes(w))),
        `reason 要點名 ja（或日文）、版本 1.0.4 與兩個日期 2026-09-29、2026-09-30，得到 ${JSON.stringify(cross.map((p) => p.reason))}`);
});

test('B4.2 檢查：順序不是由新到舊（六支檔都倒過來）→ 只是警告：ok、沒有 problems，六支檔各有一條 warning', async () => {
    await fixtureAllOk('order-reversed');
    const result = await check('order-reversed');
    assert.deepEqual(result.problems, [], `順序倒過來只是警告，不是錯誤，得到 problems ${JSON.stringify(result.problems)}`);
    assert.equal(result.ok, true, '只有警告時 ok 要是 true');
    for (const file of FILES.filter((f) => f !== 'links.md')) {
        assert.ok(result.warnings.some((w) => w.file === file), `${file} 的順序是由舊到新，要有一條 file 是「${file}」的 warning，得到 ${JSON.stringify(result.warnings)}`);
    }
});

test('B4.2 檢查：公告完全空白 → 只是警告：ok、沒有 problems，三支公告檔各有一條講空白的 warning', async () => {
    await fixtureAllOk('empty-news');
    const result = await check('empty-news');
    assert.deepEqual(result.problems, [], `公告一則都沒有是允許的，得到 problems ${JSON.stringify(result.problems)}`);
    assert.equal(result.ok, true, '只有警告時 ok 要是 true');
    for (const lang of ['zh', 'en', 'ja']) {
        const file = `news.${lang}.md`;
        assert.ok(result.warnings.some((w) => w.file === file && /空白|空的|沒有公告|一則都沒有|0 則/.test(w.message)),
            `${file} 一則都沒有，要有一條 file 是「${file}」、講「空白」（或「沒有公告」「一則都沒有」「0 則」）的 warning，得到 ${JSON.stringify(result.warnings)}`);
    }
});

test('B4.2 檢查：沒有任何置頂 → 只是警告：ok、沒有 problems，有一條 file 是 news 開頭、講「置頂」的 warning', async () => {
    await fixtureAllOk('no-pinned');
    const result = await check('no-pinned');
    assert.deepEqual(result.problems, [], `沒有置頂是允許的，得到 problems ${JSON.stringify(result.problems)}`);
    assert.equal(result.ok, true, '只有警告時 ok 要是 true');
    assert.ok(result.warnings.some((w) => /^news/.test(w.file) && w.message.includes('置頂')),
        `要有一條 file 是 news 開頭、講「置頂」的 warning，得到 ${JSON.stringify(result.warnings)}`);
});

test('B4.2 檢查：dir 不存在 → 丟 Error，訊息是中文', async (t) => {
    const { checkContent } = need();
    const missing = path.join(tmp(t), 'no-such-content');
    await assert.rejects(() => checkContent(missing), (err) => {
        assert.ok(err instanceof Error, `要丟 Error，得到 ${err}`);
        assert.match(err.message, CJK, `訊息要是中文，得到：${err.message}`);
        return true;
    });
});

test('B4.2 檢查：dir 是一個檔、不是資料夾 → 丟 Error，訊息是中文', async (t) => {
    const { checkContent } = need();
    const file = path.join(tmp(t), 'content');
    fs.writeFileSync(file, 'not a folder');
    await assert.rejects(() => checkContent(file), (err) => {
        assert.ok(err instanceof Error, `要丟 Error，得到 ${err}`);
        assert.match(err.message, CJK, `訊息要是中文，得到：${err.message}`);
        return true;
    });
});
