// lib/news.js 的 parseNews(text) —— 公告（規格書第 7 節、第 02 公告條與第 11 區）。
//
// 量什麼（編號照目標檔 4-b1 的測試案例）：
//   B1.2 格式正確的文字讀得出來：每個「## 日期 · 類別 · 標題」一筆 { ok: true, id, date, category, title, body, link, pinned }。
//        body：標題後面到下一個「##」之間、不是「連結：」也不是「置頂」的行；〔派工 4-b9〕保留換行：行與行之間 \n、空白行 \n\n
//        （原本三修F 是接成一段；細則在 news-lines.test.js）；
//        link：「連結：https://…」的網址，沒寫是 null；pinned：有一行 trim 之後等於「置頂」才是 true。
//        順序跟檔案一樣（第一則就是公告條的來源）；類別是自由文字（「教學」也收）；
//        內文句子中間出現「置頂」兩個字不算置頂寫錯。
//        id：格式 n-<8 碼十六進位>；同樣內容重跑相同；標題或日期不同就不同；
//        跟順序、行號、內文、連結、置頂都無關（前面多塞註解與空行、兩則對調、改內文與連結，id 不變）。
//        （id 是 date＋title 的 sha256 取前 8 碼；兩者怎麼接沒定，所以這裡不比對確切的值。）
//   B1.4 寫壞一條只壞那一條：缺日期、日期不是 YYYY-MM-DD、日曆上不存在的日期、標題空白、類別空白、
//        連結不是 https（整則壞）、置頂寫法不對（「置顶」「置頂了」「置頂：是」「pinned」「PIN」…，整則壞）、
//        第一個「##」之前的雜字、整檔空白。
//        每條先量「條目數＝好的＋壞的」，再量壞紀錄 { ok: false, line, raw, reason }：
//        標題壞 → line／raw 是標題那一行；連結、置頂壞 → line／raw 是寫壞的那一行（講得出哪裡壞）；
//        reason 是中文、講到壞的那一欄（「日期」「標題」「類別」「https」「置頂」）。
//   B1.6 檔頭的 <!-- … --> 註解不當條目、不算錯；註解裡的格式範例（含「連結：」「置頂」）不會變成真的公告；行號照原檔算。
//
//   第 1 次修補（名稱帶「修補N」，N 是派工人員那九條的編號；細則見 tests/README.md）：
//        修補1 註解沒關起來 → 一筆壞紀錄、之後照常；修補2「連結:」半形也收、link／リンク／连结／url 接冒號整則壞
//        （reason 講到「連結」）、沒接冒號的句子照常是內文、「置頂」前後空白也算、英文公告也用中文關鍵字；
//        修補3 crlf-bom/news.zh.md 跟 LF 版一樣；修補4 標題裡的「 · 」留在標題；修補8 雜字一行一筆；
//        修補9 註解在任何位置（含內文中間）都去掉、裡面的「置頂」「連結」不算、行號不變。
//        類別空白那條拿掉了「· ·」（只有一個空白）的寫法：照修補 4 的「 · 」切不出三段，原因不一定講到類別。
//
//   第 2 次修補（名稱帶「二修」）：日期與標題都相同（id 撞號）→ 後面那則壞（reason 講「日期與標題重複」）；
//        撞號只跟好的比（前一則壞了，後面同日期同標題的照常）；落單的「-->」一筆壞紀錄、放原位、不算進內文；兩行「連結：」整則壞（指第二行）；「link :」冒號前有空白也算寫錯的連結、
//        「連結 ：」照常收；年份 0000 壞；沒有內文算好的（body: ''）；內文裡的「###」是一般內文。
//
//   第 3 次修補（名稱帶「三修」＋字母，字母是派工人員那幾條的代號；細則見 tests/README.md 第 37 條起）：
//        A 標題寫壞自己開壞區塊、不併進上一則（日期開頭的一般句子照常是內文）；B 標題的點打錯要點名字元；
//        C 整行網址、短標籤＋冒號＋網址、「連結」少冒號、置頂變體都整則壞（句中夾網址照常）；D 連結網址要像真的；
//        F 內文接縫有中日文字就直接接（〔派工 4-b9〕作廢，改成保留換行）；H 箭頭寫成 --> 的原因要提醒 → 或 ->。
//
//   第 4 次修補（名稱帶「四修」）：「##」後面沒空格一律自己開壞區塊（上一則照常、檔案最上面也一樣）。
//
//   第 5 次修補（名稱帶「五修」）：全形井號「＃」開頭的行一律自己開壞區塊（上一則照常、檔案最上面也一樣）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B1.2"          只跑某一條
//   npm test -- --test-name-pattern "修補"           只跑第 1 次修補的案例
//   npm test -- --test-name-pattern "二修"           只跑第 2 次修補的案例
//   npm test -- --test-name-pattern "三修"           只跑第 3 次修補的案例
//   npm test -- --test-name-pattern "四修"           只跑第 4 次修補的案例
//   npm test -- --test-name-pattern "五修"           只跑第 5 次修補的案例
//   node --test tests/news.test.js                  只跑這支
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib, lines, lineOf, noThrow, expectCount, expectBad, crlfBom } from './helpers.js';

const need = await lib('news.js', ['parseNews']);

function parse(text) {
    const { parseNews } = need();
    return noThrow('parseNews', () => parseNews(text));
}

const ID = /^n-[0-9a-f]{8}$/;

const GOOD = [
    '## 2026-10-02 · 更新 · 1.0.5 上架了',
    'ChatGPT 改版後「存這則」不見的問題修好了。',
    '到擴充功能頁按「更新」就會拿到。',
    '連結：https://jerromy.com/collector-1-0-5/',
    '置頂',
    '',
    '## 2026-09-29 · 注意 · ChatGPT 改版了',
    '這幾天 ChatGPT 換了網頁結構，「存這則」暫時不會出現。',
];

function withoutId(rec) {
    const { id, ...rest } = rec;
    return rest;
}

// ───────────────────────── B1.2 ─────────────────────────

test('B1.2 公告讀得出來：日期、類別、標題、內文、連結、置頂，順序跟檔案一樣', () => {
    const result = parse(lines(GOOD));
    expectCount(result, 2, '兩則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true,
        date: '2026-10-02',
        category: '更新',
        title: '1.0.5 上架了',
        body: 'ChatGPT 改版後「存這則」不見的問題修好了。\n到擴充功能頁按「更新」就會拿到。',  // 〔派工 4-b9〕保留換行（原本三修F 接成一段）
        link: 'https://jerromy.com/collector-1-0-5/',
        pinned: true,
    }, '第一則（公告條的來源）');
    assert.deepStrictEqual(withoutId(result[1]), {
        ok: true,
        date: '2026-09-29',
        category: '注意',
        title: 'ChatGPT 改版了',
        body: '這幾天 ChatGPT 換了網頁結構，「存這則」暫時不會出現。',
        link: null,
        pinned: false,
    }, '第二則：沒寫連結是 null、沒寫置頂是 false');
    for (const rec of result) assert.match(rec.id, ID, 'id 的格式是 n-<8 碼十六進位>');
});

test('B1.2 類別是自由文字；內文裡出現「置頂」兩個字不算置頂寫錯', () => {
    const rows = ['## 2026-10-01 · 教學 · 第一章上線', '這則會一直置頂到月底。'];
    const result = parse(lines(rows));
    expectCount(result, 1, '一則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-10-01', category: '教學', title: '第一章上線', body: '這則會一直置頂到月底。', link: null, pinned: false,
    });
});

test('B1.2 id：同樣內容重跑相同；標題或日期不同就不同', () => {
    const a = parse(lines(GOOD));
    const b = parse(lines(GOOD));
    expectCount(a, 2, '第一次');
    assert.deepStrictEqual(a.map((r) => r.id), b.map((r) => r.id), '同樣內容重跑，id 要一樣');
    assert.notEqual(a[0].id, a[1].id, '兩則不同的公告 id 要不同');

    const retitled = parse(lines(['## 2026-10-02 · 更新 · 1.0.5 上架囉', '一句。']));
    assert.notEqual(retitled[0].id, a[0].id, '只改標題，id 要變');
    const redated = parse(lines(['## 2026-10-03 · 更新 · 1.0.5 上架了', '一句。']));
    assert.notEqual(redated[0].id, a[0].id, '只改日期，id 要變');
});

test('B1.2 id 跟順序、行號、內文、連結、置頂、類別都無關', () => {
    const base = parse(lines(GOOD));
    expectCount(base, 2, '原本');
    const moved = [
        '<!--',
        '公告：一則一個「## 日期 · 類別 · 標題」',
        '-->',
        '',
        '',
        '## 2026-09-29 · 注意 · ChatGPT 改版了',
        '內文整個改掉了。',
        '連結：https://jerromy.com/chatgpt/',
        '置頂',
        '',
        '## 2026-10-02 · 公告 · 1.0.5 上架了',
        '內文也改了。',
    ];
    const result = parse(lines(moved));
    expectCount(result, 2, '對調之後');
    assert.equal(result[0].title, 'ChatGPT 改版了');
    assert.equal(result[0].id, base[1].id, '同一則公告換了位置、行號、內文、加了連結與置頂，id 要一樣');
    assert.equal(result[1].id, base[0].id, '同一則公告換了位置、類別、拿掉連結與置頂，id 要一樣');
});

// ───────────────────────── B1.4 ─────────────────────────

function badHeaderCase(header, words, label) {
    const rows = [header, '一句。', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, label);
    expectBad(result[0], { line: 1, raw: header, words }, label);
    assert.deepStrictEqual(withoutId(result[1]), {
        ok: true, date: '2026-09-29', category: '注意', title: '好的那則', body: '內文。', link: null, pinned: false,
    }, `${label}：後面那則要照常`);
}

test('B1.4 公告：缺日期', () => {
    badHeaderCase('## 更新 · 1.0.5 上架了', ['日期'], '缺日期');
});

test('B1.4 公告：日期不是 YYYY-MM-DD', () => {
    for (const date of ['2026/10/02', '2026-10-2', '10-02-2026']) {
        badHeaderCase(`## ${date} · 更新 · 標題`, ['日期'], `日期寫成 ${date}`);
    }
});

test('B1.4 公告：日曆上不存在的日期', () => {
    for (const date of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01']) {
        badHeaderCase(`## ${date} · 更新 · 標題`, ['日期'], `日期 ${date}`);
    }
});

test('B1.4 公告：標題空白', () => {
    for (const header of ['## 2026-10-02 · 更新 · ', '## 2026-10-02 · 更新 ·    ']) {
        badHeaderCase(header, ['標題'], `標題空白 ${JSON.stringify(header)}`);
    }
});

test('B1.4 公告：類別空白', () => {
    // （「## 2026-10-02 · · 標題」只有一個空白的那種拿掉了：照修補 4，分隔是「 · 」（空白＋·＋空白），那樣寫切不出三段，原因不一定講到類別）
    for (const header of ['## 2026-10-02 ·  · 1.0.5 上架了']) {
        badHeaderCase(header, ['類別'], `類別空白 ${JSON.stringify(header)}`);
    }
});

// 某一行寫壞讓整則壞掉：line／raw 指著寫壞的那一行
function badLineCase(badLine, words, label) {
    const rows = ['## 2026-10-02 · 更新 · 1.0.5 上架了', '一句。', badLine, '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, label);
    expectBad(result[0], { line: lineOf(rows, badLine), raw: badLine, words }, label);
    assert.equal(result[1].ok, true, `${label}：後面那則要照常`);
    assert.equal(result[1].title, '好的那則');
}

test('B1.4 公告：連結不是 https 整則壞', () => {
    for (const link of ['連結：http://jerromy.com/', '連結：jerromy.com/collector', '連結：ftp://jerromy.com/']) {
        badLineCase(link, ['https'], link);
    }
});

test('B1.4 公告：置頂寫法不對整則壞（不准靜靜變成內文）', () => {
    for (const pin of ['置顶', '置頂了', '置頂：是', 'pinned', 'PIN', 'Pinned', 'pin']) {
        badLineCase(pin, ['置頂'], `置頂寫成 ${JSON.stringify(pin)}`);
    }
});

test('B1.4 公告：第一個「##」之前的雜字也要有一筆壞紀錄', () => {
    const rows = ['@@ ~~~ 亂碼 ###', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '雜字＋一則');
    expectBad(result[0], { line: 1, raw: '@@ ~~~ 亂碼 ###' }, '雜字');
    assert.equal(result[1].ok, true);
});

test('B1.4 公告：整檔空白回空陣列、不丟例外', () => {
    for (const text of ['', '\n\n   \n\t\n']) {
        expectCount(parse(text), 0, `整檔空白 ${JSON.stringify(text)}`);
    }
});

// ───────────────────────── B1.6 ─────────────────────────

test('B1.6 公告：檔頭註解不當條目，註解裡的「連結：」「置頂」範例不會變成真的公告，行號照原檔算', () => {
    const rows = [
        '<!--',
        '這支檔是「公告」，最上面那則同時是網站最上面的公告條。',
        '格式：',
        '## 2026-10-02 · 更新 · 標題',
        '一兩句。',
        '連結：http://不是https也沒關係，這是範例',
        '置頂',
        'pinned',
        '改完存檔，通常幾分鐘後網站更新，最久約 20 分鐘。',
        '-->',
        '',
        '## 2026-09-29 · 注意 · 好的那則',
        '內文。',
        '',
        '## 2026-09-28 · 更新 · ',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '註解後面的兩則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-09-29', category: '注意', title: '好的那則', body: '內文。', link: null, pinned: false,
    }, '註解裡的範例不是真的公告');
    expectBad(result[1], { line: lineOf(rows, '## 2026-09-28 · 更新 · '), raw: '## 2026-09-28 · 更新 · ', words: ['標題'] }, '註解後面的壞標題（行號含註解行）');
});

test('B1.6 公告：單行註解也一樣', () => {
    const rows = ['<!-- 公告：## 2026-10-02 · 更新 · 標題 -->', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 1, '單行註解');
    assert.equal(result[0].title, '好的那則');
});

// ───────────────────────── 第 1 次修補（派工人員 2026-10-02 的九條決定；--test-name-pattern "修補" 只跑這些） ─────────────────────────

test('B1.4 修補1 公告：註解沒關起來（缺 -->）回一筆壞紀錄，後面的內容照常解析', () => {
    const rows = ['<!--', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '註解開頭＋一則（不准整支靜靜變零筆）');
    expectBad(result[0], { line: 1, raw: '<!--', words: ['註解', '-->'] }, '沒關的註解');
    assert.deepStrictEqual(withoutId(result[1]), {
        ok: true, date: '2026-09-29', category: '注意', title: '好的那則', body: '內文。', link: null, pinned: false,
    });
});

test('B1.2 修補2 「連結:」半形冒號也收', () => {
    for (const row of ['連結:https://jerromy.com/a', '連結: https://jerromy.com/a', '連結：https://jerromy.com/a']) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', '一句。', row]));
        expectCount(result, 1, row);
        assert.equal(result[0].ok, true, `${row}：要是好的，得到 ${JSON.stringify(result[0])}`);
        assert.equal(result[0].link, 'https://jerromy.com/a', `${row}：要讀成連結`);
        assert.equal(result[0].body, '一句。', `${row}：不能變成內文`);
    }
});

test('B1.4 修補2 看起來是連結但寫法不對（link／リンク／连结／url 接冒號）整則壞，不准靜靜變成內文', () => {
    for (const row of ['link: https://jerromy.com/', 'Link：https://jerromy.com/', 'LINK:https://jerromy.com/', 'リンク：https://jerromy.com/',
        '连结：https://jerromy.com/', 'URL: https://jerromy.com/', 'url：https://jerromy.com/']) {
        badLineCase(row, ['連結'], row);
    }
});

test('B1.2 修補2 只是開頭剛好是 link／URL／リンク、後面沒接冒號的句子，照常是內文', () => {
    for (const row of ['Link to the docs is below.', 'URL 不要貼太長。', 'リンクは下にあります。']) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', row]));
        expectCount(result, 1, row);
        assert.equal(result[0].ok, true, `${row}：要是好的，得到 ${JSON.stringify(result[0])}`);
        assert.equal(result[0].body, row);
    }
});

test('B1.2 修補2 「置頂」前後有空白也算置頂（trim 之後相等）', () => {
    for (const row of ['置頂 ', ' 置頂', '置頂\t']) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', '一句。', row]));
        expectCount(result, 1, JSON.stringify(row));
        assert.equal(result[0].ok, true, `${JSON.stringify(row)}：要是好的，得到 ${JSON.stringify(result[0])}`);
        assert.equal(result[0].pinned, true, `${JSON.stringify(row)}：要算置頂`);
        assert.equal(result[0].body, '一句。');
    }
});

test('B1.2 修補2 英文、日文的公告也用中文的「連結：」「置頂」', () => {
    const rows = ['## 2026-10-02 · Update · 1.0.5 is out', 'The "Save this" button is back.', '連結：https://jerromy.com/en/', '置頂'];
    const result = parse(lines(rows));
    expectCount(result, 1, '英文一則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-10-02', category: 'Update', title: '1.0.5 is out', body: 'The "Save this" button is back.', link: 'https://jerromy.com/en/', pinned: true,
    });
});

test('B1.4 修補3 公告：CRLF 行尾＋UTF-8 BOM 的結果（含行號、id）跟 LF 版一模一樣', () => {
    const { crlf, lf } = crlfBom('news.zh.md');
    const want = parse(lf);
    expectCount(want, 2, 'LF 版（防呆：fixture 有一則好的、一則壞的）');
    assert.equal(want[0].ok, true);
    assert.equal(want[0].pinned, true, 'LF 版的「置頂」要讀得到');
    assert.equal(want[1].ok, false);
    assert.deepStrictEqual(parse(crlf), want, 'CRLF＋BOM 版要跟 LF 版一樣（「置頂\\r」也要算置頂、連結不能帶 \\r）');
});

test('B1.2 修補4 標題裡的「 · 」留在標題（只切前兩個）', () => {
    const result = parse(lines(['## 2026-10-02 · 更新 · 1.0.5 · 三種語言都更新了', '一句。']));
    expectCount(result, 1, '一則');
    assert.equal(result[0].ok, true, `要是好的，得到 ${JSON.stringify(result[0])}`);
    assert.equal(result[0].category, '更新');
    assert.equal(result[0].title, '1.0.5 · 三種語言都更新了');
    const other = parse(lines(['## 2026-10-02 · 更新 · 1.0.5', '一句。']));
    assert.notEqual(result[0].id, other[0].id, 'id 用的是整個標題');
});

test('B1.4 修補8 公告：連續好幾行雜字，每一行各一筆壞紀錄', () => {
    const rows = ['雜字一', '雜字二', '', '雜字三', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 4, '三行雜字＋一則');
    for (const [i, row] of ['雜字一', '雜字二', '雜字三'].entries()) {
        expectBad(result[i], { line: lineOf(rows, row), raw: row }, row);
    }
    assert.equal(result[3].ok, true);
});

test('B1.6 修補9 公告：註解在任何位置（開頭前有空行、內文中間、兩則之間、結尾）都去掉，行號不變', () => {
    const rows = [
        '',
        '<!-- 開頭前面有空行 -->',
        '## 2026-10-02 · 更新 · 第一則',
        '第一句。',
        '<!-- 內文中間的註解，裡面寫的不算：',
        '置頂',
        '連結：http://不是https也沒關係',
        '## 2026-01-01 · 假的 · 註解裡的範例',
        '-->',
        '第二句。',
        '',
        '<!-- 兩則中間 -->',
        '## 2026-09-29 · 更新 · ',
        '<!-- 結尾的註解 -->',
    ];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩則（註解裡的範例不算）');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-10-02', category: '更新', title: '第一則', body: '第一句。\n第二句。', link: null, pinned: false,
    }, '註解裡的「置頂」「連結」不算；〔派工 4-b9〕註解那幾行不算空白行，兩句之間是一個 \\n');
    expectBad(result[1], { line: lineOf(rows, '## 2026-09-29 · 更新 · '), raw: '## 2026-09-29 · 更新 · ', words: ['標題'] }, '註解後面的壞標題（行號含註解行）');
});

// ───────────────────────── 第 2 次修補（派工人員 2026-10-02；--test-name-pattern "二修" 只跑這些） ─────────────────────────

test('B1.4 二修1 公告：日期與標題都相同（id 撞號），先出現的算數，後面那則整則壞', () => {
    const rows = [
        '## 2026-10-02 · 更新 · 1.0.5 上架了',
        '第一則。',
        '',
        '## 2026-10-02 · 注意 · 1.0.5 上架了',
        '類別不同、內文不同，日期與標題一樣。',
        '',
        '## 2026-09-29 · 注意 · 好的那則',
        '內文。',
    ];
    const result = parse(lines(rows));
    expectCount(result, 3, '三則');
    assert.equal(result[0].ok, true, '先出現的那則照常');
    assert.equal(result[0].body, '第一則。');
    expectBad(result[1], { line: 4, raw: '## 2026-10-02 · 注意 · 1.0.5 上架了', words: ['日期與標題重複'] }, '後面重複的那則');
    assert.equal(result[2].ok, true, '其他照常');
    assert.notEqual(result[2].id, result[0].id);
});

test('B1.4 二修2 公告：內文裡落單的「-->」是一筆壞紀錄（放原位），不算進內文', () => {
    const rows = ['## 2026-10-02 · 更新 · 標題', '第一句。', '-->', '第二句。', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 3, '一則＋落單的 -->＋一則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-10-02', category: '更新', title: '標題', body: '第一句。\n第二句。', link: null, pinned: false,
    }, '「-->」不准變成內文（〔派工 4-b9〕那一行不算空白行，兩句之間是一個 \\n）');
    expectBad(result[1], { line: 3, raw: '-->', words: ['多出來', '-->'] }, '落單的 -->');
    assert.equal(result[2].ok, true);
    assert.equal(result[2].title, '好的那則');
});

test('B1.4 二修2 公告：檔頭說明的「<!--」被刪掉，留下的說明行各一筆、「-->」一筆，後面照常', () => {
    const rows = ['這支檔是公告。', '格式：## 日期 · 類別 · 標題', '-->', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 4, '兩行說明＋落單的 -->＋一則');
    expectBad(result[0], { line: 1, raw: '這支檔是公告。' }, '說明第一行');
    expectBad(result[1], { line: 2, raw: '格式：## 日期 · 類別 · 標題' }, '說明第二行');
    expectBad(result[2], { line: 3, raw: '-->', words: ['多出來', '-->'] }, '落單的 -->');
    assert.equal(result[3].ok, true);
});

test('B1.4 二修細則 公告：寫了兩行「連結：」整則壞，指第二行', () => {
    const rows = ['## 2026-10-02 · 更新 · 標題', '一句。', '連結：https://jerromy.com/a', '連結：https://jerromy.com/b'];
    const result = parse(lines(rows));
    expectCount(result, 1, '一則');
    expectBad(result[0], { line: 4, raw: '連結：https://jerromy.com/b', words: ['連結'] }, '寫了兩行連結');
});

test('B1.4 二修細則 公告：「link :」「URL ：」冒號前有空白也算看起來是連結（整則壞）；「連結 ：」照常收', () => {
    for (const row of ['link : https://jerromy.com/', 'URL ：https://jerromy.com/', 'リンク ： https://jerromy.com/']) {
        badLineCase(row, ['連結'], row);
    }
    const result = parse(lines(['## 2026-10-02 · 更新 · 標題', '一句。', '連結 ：https://jerromy.com/a']));
    expectCount(result, 1, '一則');
    assert.equal(result[0].ok, true, `「連結 ：」要是好的，得到 ${JSON.stringify(result[0])}`);
    assert.equal(result[0].link, 'https://jerromy.com/a');
});

test('B1.4 二修細則 公告：年份 0000 算壞', () => {
    badHeaderCase('## 0000-01-01 · 更新 · 標題', ['日期'], '年份 0000');
});

test('B1.2 二修細則 公告沒有內文也算好的（body 是空字串）', () => {
    const rows = ['## 2026-10-02 · 更新 · 只有標題', '', '## 2026-10-01 · 注意 · 只有標題和連結', '連結：https://jerromy.com/'];
    const result = parse(lines(rows));
    expectCount(result, 2, '兩則');
    assert.deepStrictEqual(withoutId(result[0]), {
        ok: true, date: '2026-10-02', category: '更新', title: '只有標題', body: '', link: null, pinned: false,
    });
    assert.deepStrictEqual(withoutId(result[1]), {
        ok: true, date: '2026-10-01', category: '注意', title: '只有標題和連結', body: '', link: 'https://jerromy.com/', pinned: false,
    });
});

test('B1.2 二修細則 公告內文裡的「###」是一般內文', () => {
    const result = parse(lines(['## 2026-10-02 · 更新 · 標題', '### 小標', '內文。']));
    expectCount(result, 1, '一則（### 不是新的一則）');
    assert.equal(result[0].ok, true, `要是好的，得到 ${JSON.stringify(result[0])}`);
    assert.equal(result[0].body, '### 小標\n內文。');  // 〔派工 4-b9〕保留換行（原本三修F 接成一段）
});

test('B1.4 二修1 公告：日期與標題重複只跟好的比（前一則壞了，後面同日期同標題的照常；再下一則才算重複）', () => {
    const rows = [
        '## 2026-10-02 · 更新 · 1.0.5 上架了',
        '連結：http://jerromy.com/',
        '',
        '## 2026-10-02 · 更新 · 1.0.5 上架了',
        '第二則本身是好的。',
        '',
        '## 2026-10-02 · 注意 · 1.0.5 上架了',
        '第三則又一樣。',
    ];
    const result = parse(lines(rows));
    expectCount(result, 3, '三則');
    expectBad(result[0], { line: 2, raw: '連結：http://jerromy.com/', words: ['https'] }, '第一則連結寫壞');
    assert.equal(result[1].ok, true, `第一則壞了，第二則不算重複，要是好的，得到 ${JSON.stringify(result[1])}`);
    assert.equal(result[1].body, '第二則本身是好的。');
    expectBad(result[2], { line: 7, raw: '## 2026-10-02 · 注意 · 1.0.5 上架了', words: ['日期與標題重複'] }, '第三則才是重複');
});

// ───────────────────────── 第 3 次修補（派工人員 2026-10-02，檢查員抓到的；--test-name-pattern "三修" 只跑這些） ─────────────────────────

test('B1.4 三修A 公告：標題寫壞的那行自己開一個壞區塊，底下的內文、連結、置頂跟著它，不併進上一則', () => {
    const variants = [
        '##2026-10-01 · 注意 · 少了空格的標題',
        '# 2026-10-01 · 注意 · 只有一個井號',
        '### 2026-10-01 · 注意 · 三個井號',
        '2026-10-01 · 注意 · 完全沒寫井號',
        '2026/10/01 · 注意 · 斜線日期',
        '2026.10.01\u30FB注意\u30FB點日期配片假名點',
        '#2026-10-01 \u2027 注意 \u2027 連字點',
        '2026-10-01\u2022 注意 \u2022 項目符號',
    ];
    for (const head of variants) {
        const rows = [
            '## 2026-10-02 · 更新 · 第一則',
            '第一句。',
            head,
            '這句屬於寫壞的那則。',
            '連結：https://jerromy.com/a',
            '置頂',
            '',
            '## 2026-09-29 · 注意 · 好的那則',
            '內文。',
        ];
        const result = parse(lines(rows));
        expectCount(result, 3, `${head}：上一則＋寫壞的那則＋好的那則（底下的內文、連結、置頂不另外報錯）`);
        assert.deepStrictEqual(withoutId(result[0]), {
            ok: true, date: '2026-10-02', category: '更新', title: '第一則', body: '第一句。', link: null, pinned: false,
        }, `${head}：上一則照常，寫壞那則的內文、連結、置頂不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: ['看起來是新的', '##'] }, head);
        assert.equal(result[2].ok, true, `${head}：後面那則照常`);
        assert.equal(result[2].title, '好的那則');
    }
});

test('B1.2 三修A 公告：日期開頭但後面沒有點狀分隔符的句子照常是內文', () => {
    for (const row of ['2026-10-02 起暫停服務。', '2026/10/02 的更新已經上線。', '2026.10.02 以後請改用新版。']) {
        const result = parse(lines(['## 2026-10-02 · 注意 · 暫停服務', row]));
        expectCount(result, 1, row);
        assert.equal(result[0].ok, true, `${row}：要是好的，得到 ${JSON.stringify(result[0])}`);
        assert.equal(result[0].body, row);
    }
});

test('B1.4 三修B 公告：標題的點打錯，原因要點名實際用的字元', () => {
    const cases = [
        ['## 2026-10-02 \u30FB 更新 \u30FB 標題', ['U+00B7', '\u30FB', 'U+30FB']],
        ['## 2026-10-02 \u2027 更新 \u2027 標題', ['U+00B7', '\u2027', 'U+2027']],
        ['## 2026-10-02 \u2022 更新 \u2022 標題', ['U+00B7', '\u2022', 'U+2022']],
        ['## 2026-10-02 \uFF65 更新 \uFF65 標題', ['U+00B7', '\uFF65', 'U+FF65']],
        ['## 2026-10-02\u3000·\u3000更新\u3000·\u3000標題', ['U+3000']],
        ['## 2026-10-02\u00A0·\u00A0更新\u00A0·\u00A0標題', ['U+00A0']],
        ['## 2026-10-02·更新·標題', ['兩邊各空一格']],
    ];
    for (const [header, words] of cases) badHeaderCase(header, words, JSON.stringify(header));
});

test('B1.4 三修B 公告：點的兩邊是 Tab，原因要講到 Tab（或 U+0009）', () => {
    const header = '## 2026-10-02\t·\t更新\t·\t標題';
    const rows = [header, '一句。'];
    const result = parse(lines(rows));
    expectCount(result, 1, 'Tab');
    expectBad(result[0], { line: 1, raw: header }, 'Tab');
    assert.match(result[0].reason, /Tab|U\+0009/i, `reason 要點名 Tab，得到「${result[0].reason}」`);
});

test('B1.4 三修C 公告：整行只有網址、短標籤＋冒號＋網址、「連結」後面少了冒號，都整則壞', () => {
    for (const row of [
        'https://jerromy.com/a',
        '  https://jerromy.com/a  ',
        '網址：https://jerromy.com/',
        '链接：https://jerromy.com/',
        '詳情: https://jerromy.com/',
        'Docs: https://jerromy.com/',
        '連結 https://jerromy.com/',
        '链接 https://jerromy.com/',
        '網址 https://jerromy.com/',
    ]) {
        badLineCase(row, ['看起來是連結'], JSON.stringify(row));
    }
});

test('B1.2 三修C 公告：句子中間夾網址、標籤很長的句子，照常是內文', () => {
    for (const row of ['詳情請看 https://jerromy.com/ 的說明。', '請到這個網頁下載最新的版本：https://jerromy.com/']) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', row]));
        expectCount(result, 1, row);
        assert.equal(result[0].ok, true, `${row}：要是好的，得到 ${JSON.stringify(result[0])}`);
        assert.equal(result[0].body, row);
        assert.equal(result[0].link, null);
    }
});

test('B1.4 三修C 公告：置頂的變體（括號、驚嘆號、中間空白、英日文）整則壞', () => {
    for (const row of ['【置頂】', '[pinned]', '(PIN)', '置 頂', 'ピン留め', 'ピン止め', '「置頂」', '置頂！', 'Pinned!', '（置顶）']) {
        badLineCase(row, ['置頂'], JSON.stringify(row));
    }
});

test('B1.4 三修D 公告：「連結：」的網址要像真的（範例、不完整、沒有點的主機名、夾空白都壞）', () => {
    for (const row of ['連結：https://…', '連結：https://...', '連結：https://jerromy.com/…']) {
        badLineCase(row, ['範例或不完整'], row);
    }
    for (const row of ['連結：https://localhost/', '連結：https://', '連結：https://jerromy .com/', '連結：https://jerromy.com/ 的文章']) {
        badLineCase(row, [], row);
    }
});

// 〔派工 4-b9〕三修F「接縫兩邊有中日文字就直接接，否則加一個空白」作廢：使用者的換行要保留。原本的九組改成用 \n 接
test('B1.2 三修F〔4-b9 改〕公告內文多行：保留換行，行與行之間是 \\n（不管兩邊是不是中日文字）', () => {
    const cases = [
        [['第一句。', '第二句。'], '第一句。\n第二句。'],
        [['ChatGPT 改版了', 'Update now.'], 'ChatGPT 改版了\nUpdate now.'],
        [['Update now.', '到擴充功能頁按更新'], 'Update now.\n到擴充功能頁按更新'],
        [['First line.', 'Second line.'], 'First line.\nSecond line.'],
        [['トピックを直しました', 'ご確認ください'], 'トピックを直しました\nご確認ください'],
        [['See the note（註）', 'then go.'], 'See the note（註）\nthen go.'],
        [['Version 1.0.5', '「存這則」回來了'], 'Version 1.0.5\n「存這則」回來了'],
        [['中文', 'English', '日本語'], '中文\nEnglish\n日本語'],
        [['A', 'B', 'C'], 'A\nB\nC'],
    ];
    for (const [body, want] of cases) {
        const result = parse(lines(['## 2026-10-02 · 更新 · 標題', ...body]));
        expectCount(result, 1, JSON.stringify(body));
        assert.equal(result[0].body, want, `${JSON.stringify(body)} 要是 ${JSON.stringify(want)}`);
    }
});

test('B1.4 三修H 公告：內文裡的「-->」（當成箭頭寫的）一筆壞紀錄，原因要提醒改寫成 → 或 ->', () => {
    const rows = ['## 2026-10-02 · 更新 · 標題', '第一句。', '設定 --> 進階 --> 重新整理', '第二句。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '一則＋那一行');
    assert.equal(result[0].ok, true);
    assert.equal(result[0].body, '第一句。\n第二句。', '那一行不算進內文（〔派工 4-b9〕也不算空白行）');
    expectBad(result[1], { line: 3, raw: '設定 --> 進階 --> 重新整理', words: ['多出來', '-->', '→', '->'] }, '箭頭寫成 -->');
});

test('B1.4 三修A 公告：寫壞的標題在檔案最上面（第一個「##」之前）也自己開壞區塊，底下的內容歸它、不另外各報雜字', () => {
    const rows = ['<!-- 說明 -->', '##2026-10-02 · 更新 · 寫壞的標題', '這句屬於它。', '連結：https://jerromy.com/a', '置頂', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那則＋好的那則（底下的內文、連結、置頂不各算一筆雜字）');
    expectBad(result[0], { line: 2, raw: '##2026-10-02 · 更新 · 寫壞的標題', words: ['看起來是新的', '##'] }, '最上面寫壞的標題');
    assert.deepStrictEqual(withoutId(result[1]), {
        ok: true, date: '2026-09-29', category: '注意', title: '好的那則', body: '內文。', link: null, pinned: false,
    });
});

// ───────────────────────── 第 4 次修補（派工人員 2026-10-02，檢查員複查抓到的；--test-name-pattern "四修" 只跑這些） ─────────────────────────

test('B1.4 四修1 公告：「##」後面沒空格，不管後面長什麼樣都自己開壞區塊，底下的內容歸它、不併進上一則', () => {
    for (const head of ['##2026-10-01 注意 第二則', '##更新 · 標題', '##第二則', '  ##2026-10-01 · 注意 · 前面有空白']) {
        const rows = ['## 2026-10-02 · 更新 · 第一則', '第一句。', head, '這句屬於寫壞的那則。', '連結：https://jerromy.com/a', '置頂', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
        const result = parse(lines(rows));
        expectCount(result, 3, `${head}：上一則＋寫壞的那則＋好的那則`);
        assert.deepStrictEqual(withoutId(result[0]), {
            ok: true, date: '2026-10-02', category: '更新', title: '第一則', body: '第一句。', link: null, pinned: false,
        }, `${head}：上一則照常，寫壞那則的內容不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: ['##', '空一格'] }, head);
        assert.equal(result[2].ok, true, `${head}：後面那則照常`);
    }
});

test('B1.4 四修1 公告：檔案最上面的「##」後面沒空格也一樣', () => {
    const rows = ['##公告', '這句屬於它。', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那則＋好的那則（底下的內文不各算一筆雜字）');
    expectBad(result[0], { line: 1, raw: '##公告', words: ['##', '空一格'] }, '最上面');
    assert.equal(result[1].ok, true);
});

// ───────────────────────── 第 5 次修補（派工人員 2026-10-02；--test-name-pattern "五修" 只跑這些） ─────────────────────────

const FW_REASON = ['半形', '\uFF03'];

test('B1.4 五修 公告：全形井號「\uFF03」開頭的行自己開壞區塊，底下的內容歸它、不併進上一則', () => {
    for (const head of ['\uFF03\uFF03 2026-10-01 · 注意 · 第二則', '\uFF03\uFF032026-10-01 · 注意 · 第二則', '\uFF03 2026-10-01 · 注意 · 第二則', '  \uFF03\uFF03 第二則']) {
        const rows = ['## 2026-10-02 · 更新 · 第一則', '第一句。', head, '這句屬於寫壞的那則。', '連結：https://jerromy.com/a', '置頂', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
        const result = parse(lines(rows));
        expectCount(result, 3, `${JSON.stringify(head)}：上一則＋寫壞的那則＋好的那則`);
        assert.deepStrictEqual(withoutId(result[0]), {
            ok: true, date: '2026-10-02', category: '更新', title: '第一則', body: '第一句。', link: null, pinned: false,
        }, `${JSON.stringify(head)}：上一則照常，寫壞那則的內容不准併進來`);
        expectBad(result[1], { line: 3, raw: head, words: FW_REASON }, JSON.stringify(head));
        assert.equal(result[2].ok, true, `${JSON.stringify(head)}：後面那則照常`);
    }
});

test('B1.4 五修 公告：檔案最上面的全形井號也一樣', () => {
    const rows = ['\uFF03\uFF03 2026-10-02 · 更新 · 標題', '這句屬於它。', '', '## 2026-09-29 · 注意 · 好的那則', '內文。'];
    const result = parse(lines(rows));
    expectCount(result, 2, '寫壞的那則＋好的那則（底下的內文不各算一筆雜字）');
    expectBad(result[0], { line: 1, raw: rows[0], words: FW_REASON }, '最上面');
    assert.equal(result[1].ok, true);
});
