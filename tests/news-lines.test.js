// 4-b9 的 B9.1：公告內文保留使用者的換行（lib/news.js 的 parseNews；走網站讀的那條路 readContent 也量一次）。介面細則見 tests/README.md「4-b9」。
//
// 量什麼：
//   B9.1 好的公告 body：行與行之間是 \n；中間有空白行（段落）是 \n\n，連續好幾個空白行壓成一個 \n\n；
//        每行去掉頭尾空白（行尾的空白、Tab、全形空白）；只有空白的行也算空白行；整段去掉頭尾的空白行；不再接成一行。
//        「連結：」「置頂」那一行、註解那幾行、落單的 --> 不算內文、也不算空白行（前後兩行之間是不是段落，只看中間有沒有真的空白行）。
//        單行內文照舊是那一行；欄位、壞紀錄、id 都不變（id 只看日期與標題，換行怎麼排都一樣）。
//        三語各一支 fixture（tests/fixtures/news-lines/），CRLF＋BOM 版本結果一樣；readContent 讀到的跟 parseNews 一樣。
//        前端拿 body 給 bindTail 時：換行原樣留著，只有最後一行的尾巴被綁（B9.2 的規則）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B9.1"
//   node --test tests/news-lines.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lib, lines, lineOf, noThrow, expectCount, FIXTURES } from './helpers.js';

const need = await lib('news.js', ['parseNews']);
const needContent = await lib('content.js', ['readContent']);
const needBind = await lib('bind-tail.js', ['bindTail']);

const DIR = path.join(FIXTURES, 'news-lines');
const LANGS = ['zh', 'en', 'ja'];
const KEYS = ['body', 'category', 'date', 'id', 'link', 'ok', 'pinned', 'title'];

// 每一語：第一則（三個段落、段落之間有一個或三個空白行、標題下與結尾有空白行、連結與置頂）、第二則（一行）、
// 第三則（連結夾在兩行中間，沒有空白行）、第四則（寫壞的標題，底下有段落）、第五則（兩段中間夾著置頂，前後都有空白行）
const WANT = {
    zh: [
        { date: '2026-10-02', title: '1.0.5 上架了', link: 'https://jerromy.com/collector-1-0-5/', pinned: true,
            body: 'ChatGPT 改版後「存這則」不見的問題修好了。\n到擴充功能頁按「更新」就會拿到。\n\n如果還是看不到按鈕，\n把分頁重新整理一次。\n\n之後網站再改版，收集器會先自己找對話的位置。' },
        { date: '2026-09-30', title: '只有一行', link: null, pinned: false, body: '這則只有一行內文。' },
        { date: '2026-09-29', title: '連結夾在中間', link: 'https://jerromy.com/news/', pinned: false, body: '第一行。\n第二行。' },
        { bad: '##2026-09-28 · 注意 · 寫壞的標題' },
        { date: '2026-09-27', title: '段落之間夾著置頂', link: null, pinned: true, body: '第一段。\n\n第二段。' },
    ],
    en: [
        { date: '2026-10-02', title: '1.0.5 is out', link: 'https://jerromy.com/en/collector-1-0-5/', pinned: true,
            body: '"Save this" is back after the ChatGPT redesign.\nUpdate from the extensions page to get it.\n\nStill no button?\nReload the tab once.\n\nIf a site changes again, the collector first tries to find the conversation on its own.' },
        { date: '2026-09-30', title: 'Just one line', link: null, pinned: false, body: 'This one has a single line.' },
        { date: '2026-09-29', title: 'Link in the middle', link: 'https://jerromy.com/en/news/', pinned: false, body: 'First line.\nSecond line.' },
        { bad: '##2026-09-28 · Heads-up · Broken heading' },
        { date: '2026-09-27', title: 'Pinned between paragraphs', link: null, pinned: true, body: 'First paragraph.\n\nSecond paragraph.' },
    ],
    ja: [
        { date: '2026-10-02', title: '1.0.5 を公開しました', link: 'https://jerromy.com/ja/collector-1-0-5/', pinned: true,
            body: 'ChatGPT のデザイン変更で消えた「これを保存」を修正しました。\n拡張機能ページで「更新」を押すと届きます。\n\nそれでもボタンが出ないときは、\nタブを一度再読み込みしてください。\n\nサイトがまた変わっても、まずは会話の位置を自分で探します。' },
        { date: '2026-09-30', title: '一行だけ', link: null, pinned: false, body: 'このお知らせは一行だけです。' },
        { date: '2026-09-29', title: '途中にリンク', link: 'https://jerromy.com/ja/news/', pinned: false, body: '一行目。\n二行目。' },
        { bad: '##2026-09-28 · お知らせ · 壊れた見出し' },
        { date: '2026-09-27', title: '段落のあいだに固定', link: null, pinned: true, body: '一段落目。\n\n二段落目。' },
    ],
};

function parse(text) {
    const { parseNews } = need();
    return noThrow('parseNews', () => parseNews(text));
}

function fixture(lang) {
    const text = fs.readFileSync(path.join(DIR, `news.${lang}.md`), 'utf8');
    // 防呆：fixture 要是 LF、沒有 BOM、有連續三個空白行（被編輯器或 git 改掉的話，下面的比對是假的）
    assert.ok(!text.includes('\r') && !text.startsWith('\uFEFF'), `fixtures/news-lines/news.${lang}.md 要是 LF、沒有 BOM`);
    assert.ok(text.includes('\n\n\n\n'), `fixtures/news-lines/news.${lang}.md 要有連續三個空白行`);
    return text;
}

// 好的 body 的共同形狀：沒有 \r、沒有三個以上的換行、頭尾不是換行、每行頭尾沒有空白
function bodyShape(body, label) {
    assert.equal(typeof body, 'string', `${label}：body 要是字串`);
    assert.doesNotMatch(body, /\r/, `${label}：body 不能有 \\r`);
    assert.doesNotMatch(body, /\n\n\n/, `${label}：連續的空白行要壓成一個 \\n\\n`);
    assert.doesNotMatch(body, /^\n|\n$/, `${label}：頭尾的空白行要去掉`);
    for (const row of body.split('\n')) assert.equal(row, row.trim(), `${label}：每一行頭尾不能有空白，得到 ${JSON.stringify(row)}`);
}

function check(result, lang, text, label) {
    const rows = text.split('\n');
    expectCount(result, WANT[lang].length, `${label}：五筆（四則好的＋一則寫壞的標題）`);
    WANT[lang].forEach((want, i) => {
        const rec = result[i];
        if (want.bad) {
            assert.equal(rec.ok, false, `${label} 第 ${i + 1} 筆要是壞的`);
            assert.equal(rec.line, lineOf(rows, want.bad), `${label} 第 ${i + 1} 筆：line 是寫壞的標題那一行`);
            assert.equal(rec.raw, want.bad);
            return;
        }
        assert.deepEqual(Object.keys(rec).sort(), KEYS, `${label} 第 ${i + 1} 筆：欄位剛好 ${KEYS.join('、')}`);
        const { id, ...rest } = rec;
        assert.match(id, /^n-[0-9a-f]{8}$/, `${label} 第 ${i + 1} 筆：id 的格式不變`);
        assert.deepStrictEqual(rest, { ok: true, date: want.date, category: rest.category, title: want.title, body: want.body, link: want.link, pinned: want.pinned },
            `${label} 第 ${i + 1} 筆（${want.title}）`);
        bodyShape(rec.body, `${label} 第 ${i + 1} 筆`);
    });
}

for (const lang of LANGS) {
    test(`B9.1 公告內文保留換行（${lang}）：行之間 \\n、段落 \\n\\n、連續空白行壓成一個、頭尾空白行去掉；連結與置頂那行不算`, () => {
        const text = fixture(lang);
        check(parse(text), lang, text, lang);
    });
}

test('B9.1 CRLF＋BOM：結果跟 LF 版一模一樣（body 裡沒有 \\r）', () => {
    for (const lang of LANGS) {
        const text = fixture(lang);
        const crlf = '\uFEFF' + text.replace(/\n/g, '\r\n');
        assert.deepStrictEqual(parse(crlf), parse(text), `${lang}：CRLF＋BOM 要跟 LF 一樣`);
    }
});

test('B9.1 走網站讀的那條路：readContent 讀到的 news 跟 parseNews 一樣（換行留著）', async (t) => {
    const { readContent } = needContent();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-news-lines-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const name of fs.readdirSync(path.join(FIXTURES, 'content'))) fs.copyFileSync(path.join(FIXTURES, 'content', name), path.join(dir, name));
    for (const lang of LANGS) fs.copyFileSync(path.join(DIR, `news.${lang}.md`), path.join(dir, `news.${lang}.md`));
    const content = await readContent(dir);
    for (const lang of LANGS) {
        assert.equal(content.news[lang].ok, true, `${lang}：讀得到`);
        check(content.news[lang].entries, lang, fixture(lang), `readContent ${lang}`);
    }
});

test('B9.1 每行去掉頭尾空白（空白、Tab、全形空白）；只有空白的行算空白行', () => {
    const result = parse(lines([
        '## 2026-10-02 · 更新 · 標題',
        '  第一行。  ',
        '第二行。\t',
        '\u3000第三行。\u3000',
        ' \t ',
        '\u3000',
        'Last line.   ',
    ]));
    expectCount(result, 1, '一則');
    assert.equal(result[0].body, '第一行。\n第二行。\n第三行。\n\nLast line.');
});

test('B9.1 單行內文照舊是那一行；沒有內文照舊是空字串', () => {
    for (const row of ['這則只有一行內文。', 'Just one line.', '一行だけです。', 'A']) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', row]));
        expectCount(result, 1, row);
        assert.equal(result[0].body, row);
    }
    const blankOnly = parse(lines(['## 2026-10-02 · 更新 · 標題', '', '', '連結：https://jerromy.com/', '', '置頂', '']));
    expectCount(blankOnly, 1, '只有空白行、連結、置頂');
    assert.equal(blankOnly[0].body, '', '只有空白行沒有字：body 是空字串');
});

test('B9.1 不再接成一行：英文兩行之間不是空白、中文兩行之間不是直接接', () => {
    const result = parse(lines(['## 2026-10-02 · 更新 · 標題', 'First line.', 'Second line.', '', '中文第一行。', '中文第二行。']));
    expectCount(result, 1, '一則');
    assert.equal(result[0].body, 'First line.\nSecond line.\n\n中文第一行。\n中文第二行。');
    assert.notEqual(result[0].body, 'First line. Second line.中文第一行。中文第二行。');
});

test('B9.1 id 只看日期與標題：同一則的內文排成一行、好幾行、好幾段，id 都一樣', () => {
    const head = '## 2026-10-02 · 更新 · 1.0.5 上架了';
    const ids = [
        [head, '第一句。第二句。'],
        [head, '第一句。', '第二句。'],
        [head, '', '第一句。', '', '', '第二句。', ''],
    ].map((rows) => {
        const result = parse(lines(rows));
        expectCount(result, 1, JSON.stringify(rows));
        return result[0].id;
    });
    assert.equal(new Set(ids).size, 1, `id 要都一樣，得到 ${ids.join('、')}`);
});

test('B9.1 壞紀錄照舊：好幾段的公告裡連結寫壞、置頂寫壞，整則壞，line／raw 指寫壞的那一行', () => {
    const rows = ['## 2026-10-02 · 更新 · 標題', '第一段。', '', '第二段。', 'link: https://jerromy.com/', '', '## 2026-10-01 · 更新 · 第二則', '第一段。', '', '置頂了', '第二段。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩則都壞');
    assert.deepEqual(Object.keys(result[0]).sort(), ['line', 'ok', 'raw', 'reason']);
    assert.equal(result[0].ok, false);
    assert.equal(result[0].line, lineOf(rows, 'link: https://jerromy.com/'));
    assert.match(result[0].reason, /連結/);
    assert.equal(result[1].ok, false);
    assert.equal(result[1].line, lineOf(rows, '置頂了'));
    assert.match(result[1].reason, /置頂/);
});

test('B9.1 交給 bindTail：換行原樣留著，只有最後一行的尾巴被綁', () => {
    const { bindTail } = needBind();
    for (const lang of LANGS) {
        const body = parse(fixture(lang))[0].body;
        const html = bindTail(body, lang);
        const rows = html.split('\n');
        assert.equal(rows.length, body.split('\n').length, `${lang}：換行數不變`);
        // 〔派工 4-b11〕日文內文有兩對短引號（「これを保存」「更新」），各自包成 nw：日文是 3 組（兩對短引號＋最後三字），中文、英文照舊 1 組
        const spans = { zh: 1, en: 1, ja: 3 }[lang];
        assert.equal((html.match(/<span class="nw">/g) || []).length, spans, `${lang}：剛好 ${spans} 組 span`);
        assert.ok(rows[rows.length - 1].includes('<span class="nw">') && rows[rows.length - 1].endsWith('</span>'), `${lang}：span 在最後一行的結尾：${rows[rows.length - 1]}`);
    }
});
