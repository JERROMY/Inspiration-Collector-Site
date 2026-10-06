// 真的內容檔 homepage/site/content/（目標檔 4-b4 的 B4.1、B4.2、B4.4；介面細則見 tests/README.md「4-b4」）。
//
// 量什麼（讀的是專案裡真的那七支檔，用 4-b1 的 readContent 讀）：
//   B4.1 七支都在：changelog.<zh|en|ja>.md、news.<zh|en|ja>.md、links.md。
//   B4.1 每支檔第一個非空白的東西是 <!-- … --> 說明註解，用繁體中文寫，寫到：
//        這支檔做什麼（更新紀錄／公告／社群連結）、格式的範例（一行標題或連結＋條目）、
//        改完多久生效（一字不差「通常幾分鐘，最久約 20 分鐘」）、寫壞會怎樣（「這一條讀不到」「其他」「照常」「不會壞」）。
//        公告檔另外要提醒：「連結：」「置頂」三種語言都用中文；標題的點要用 ·（U+00B7）、不是日文輸入法的那個點（U+30FB）—— 兩個字元都要出現；
//        「##」後面「空一格」；井號用「半形」。
//   B4.1 〔檢查員第 1 輪〕說明字句：
//        changelog 的說明要講三語同一版的「日期也要一樣」（或「日期要一樣」），要有一句同時講到「那一版」「每一條」「讀不到」
//        （版本標題寫壞時，那一版底下的每一條都會跟著讀不到）；
//        有待填的版本範本（註解裡有「## x.y.z · 2026-MM-DD」）時，要有一段註解講怎麼打開它：有「刪掉」「<!--」「2026-MM-DD」
//        （「-->」寫不進註解裡 —— 寫了註解就在那裡結束、後面變成落單的 -->，所以不量；沒有範本就 skip）；
//        公告檔與 links.md 整支不能有「規格書」（公開 repo 的讀者看不到）；links.md 整支不能有「字串檔」（不叫使用者去改程式）。
//   B4.1 內容檔乾淨：沒有看不見的字（零寬、方向控制、NBSP、全形空白、軟連字號、BOM、控制字元）、沒有 /Users/ 與 \Users\、沒有電子郵件。
//   B4.2 註解裡的範例不算內容：readContent 讀到的條目數 ＝ 拿掉註解之後「## 」（或「- 」）開頭的行數，而說明註解裡確實有範例那一行。
//   B4.2 readContent 每一條都是 ok:true（七個位置都讀得到、每一版、每一條 item、每一則、每一個連結）。
//   B4.2 〔檢查員第 1 輪〕checkContent 對真的 content/ 沒有任何 problem（含三語一致）—— 跟 npm run content:check 結束碼 0 是同一件事。
//        順序由新到舊、公告有幾則、有沒有置頂只是 checkContent 的警告，這支不強制（公告可以是 0 則）。
//   B4.2 更新紀錄至少一個版本（三語都是）。
//   B4.4 links.md：至少一個連結、代號是 [a-z0-9]+、代號不重複。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B4.1"
//   npm test -- --test-name-pattern "B4.2 內容檔"
//   node --test tests/content-files.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readContent } from '../lib/content.js';
import { lib } from './helpers.js';
import { CONTENT, FILES, LANGS } from './content-check-fixture.js';

const need = await lib('content-check.js', ['checkContent']);

const DOT = String.fromCodePoint(0xB7);
const KATAKANA_DOT = String.fromCodePoint(0x30FB);
const HAN = /[一-鿿]/;
// 簡體才有的字（日文也不用的），出現了就是說明不是用繁體寫的
const SIMPLIFIED = ['这', '们', '个', '时', '么', '说', '读', '显', '坏', '样', '页', '网', '语', '录', '发', '后'];
// 看不見、或看起來像空白的字：零寬、方向控制、NBSP、全形空白、軟連字號、BOM、行／段分隔
const INVISIBLE = [
    0x00A0, 0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x180E,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x2028, 0x2029, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x202F,
    0x205F, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069,
    0x3000, 0x3164, 0xFEFF, 0xFFA0,
];

function read(name) {
    const file = path.join(CONTENT, name);
    if (!fs.existsSync(file)) assert.fail(`缺 content/${name}（後端之後寫內容檔）`);
    return fs.readFileSync(file, 'utf8');
}

// 第一個非空白的東西要是 <!--；回傳那段註解裡面的字
function headComment(name) {
    const text = read(name);
    const start = text.trimStart();
    assert.ok(start.startsWith('<!--'), `content/${name}：第一個非空白的東西要是 <!-- … --> 說明註解，開頭是：${JSON.stringify(start.slice(0, 40))}`);
    const end = start.indexOf('-->');
    assert.ok(end > 0, `content/${name}：說明註解要關起來（-->）`);
    return start.slice(4, end);
}

// 整支檔裡所有的 <!-- … -->（含記號）
function comments(name) {
    return read(name).match(/<!--[\s\S]*?-->/g) ?? [];
}

function kindOf(name) {
    return name.startsWith('changelog') ? 'changelog' : name.startsWith('news') ? 'news' : 'links';
}

async function content() {
    for (const name of FILES) read(name);
    return readContent(CONTENT);
}

// 某一區讀到的條目；那一區讀不到就以它的原因失敗（不讓後面的比對丟看不懂的例外）
function entries(data, kind, lang) {
    const slot = kind === 'links' ? data.links : data[kind][lang];
    const file = kind === 'links' ? 'links.md' : `${kind}.${lang}.md`;
    assert.ok(slot.ok, `${file} 讀不到：${slot.reason}`);
    return slot.entries;
}

test('B4.1 內容檔：七支都在', () => {
    const missing = FILES.filter((name) => !fs.existsSync(path.join(CONTENT, name)));
    assert.deepEqual(missing, [], `缺 ${missing.map((n) => `content/${n}`).join('、')}（後端之後寫內容檔）`);
});

for (const name of FILES) {
    test(`B4.1 內容檔：${name} 開頭是繁體中文的說明註解：做什麼、格式範例、多久生效、寫壞會怎樣`, () => {
        const note = headComment(name);
        assert.match(note, HAN, `${name}：說明要用中文寫（編輯的人是使用者）`);
        const simplified = SIMPLIFIED.filter((ch) => note.includes(ch));
        assert.deepEqual(simplified, [], `${name}：說明要用繁體中文寫，出現了簡體字 ${simplified.join('、')}`);
        const what = { changelog: '更新紀錄', news: '公告', links: '社群' }[kindOf(name)];
        assert.ok(note.includes(what), `${name}：說明要講這支檔做什麼（寫到「${what}」）`);
        const example = {
            changelog: new RegExp(`^\\s*## \\d+\\.\\d+\\.\\d+ ${DOT} \\d{4}-\\d{2}-\\d{2}\\s*$`, 'm'),
            news: new RegExp(`^\\s*## \\d{4}-\\d{2}-\\d{2} ${DOT} \\S.* ${DOT} \\S.*$`, 'm'),
            links: new RegExp(`^\\s*- [a-z0-9]+ ${DOT} https://\\S+\\s*$`, 'm'),
        }[kindOf(name)];
        assert.match(note, example, `${name}：說明要附一個格式範例（一整行，點是 U+00B7），像 ${example}`);
        if (kindOf(name) === 'changelog') {
            assert.match(note, /^\s*- \S+[：:]\s*\S/m, `${name}：範例要有一條「- 類型：內容」`);
        }
        assert.ok(note.includes('通常幾分鐘，最久約 20 分鐘'), `${name}：說明要一字不差寫「通常幾分鐘，最久約 20 分鐘」（改完多久生效）`);
        for (const word of ['這一條讀不到', '其他', '照常', '不會壞']) {
            assert.ok(note.includes(word), `${name}：說明要講寫壞會怎樣（只有那一條「這一條讀不到」、其他照常、整個網站不會壞），沒寫到「${word}」`);
        }
    });
}

for (const lang of LANGS) {
    const name = `news.${lang}.md`;
    test(`B4.1 內容檔：${name} 的說明提醒「連結：」「置頂」三種語言都用中文、點是 U+00B7 不是 U+30FB、## 後面空一格、井號用半形`, () => {
        const note = headComment(name);
        for (const [word, why] of [
            ['連結：', '關鍵字「連結：」'],
            ['置頂', '關鍵字「置頂」'],
            ['三種語言', '三種語言都用中文的關鍵字'],
            ['中文', '關鍵字三種語言都用中文'],
            [DOT, `標題的點要用「${DOT}」（U+00B7）`],
            [KATAKANA_DOT, `不要寫成日文輸入法的「${KATAKANA_DOT}」（U+30FB）`],
            ['空一格', '「##」後面要空一格'],
            ['半形', '井號用半形'],
        ]) {
            assert.ok(note.includes(word), `${name}：說明要提醒${why}（沒寫到「${word}」）`);
        }
    });
}

for (const lang of LANGS) {
    const name = `changelog.${lang}.md`;
    test(`B4.1 內容檔：${name} 的說明講三語同一版的日期也要一樣、標題寫壞時那一版的每一條都讀不到`, () => {
        const note = headComment(name);
        assert.match(note, /日期(也)?要一樣/, `${name}：說明要講三種語言同一版的「日期也要一樣」（使用者最可能在三支檔各填一次日期）`);
        const sentences = note.split(/[。！？]/);
        assert.ok(sentences.some((s) => ['那一版', '每一條', '讀不到'].every((w) => s.includes(w))),
            `${name}：說明要有一句講版本標題寫壞時，「那一版」底下的「每一條」都會跟著「讀不到」`);
    });

    test(`B4.1 內容檔：${name} 有待填的版本範本時，註解講怎麼打開它（刪掉、<!--、2026-MM-DD）`, (t) => {
        const template = new RegExp(`^\\s*## \\d+\\.\\d+\\.\\d+ ${DOT} 2026-MM-DD\\s*$`, 'm');
        const all = comments(name);
        if (!all.some((c) => template.test(c))) {
            t.skip(`${name} 沒有待填的版本範本（「## x.y.z ${DOT} 2026-MM-DD」），不用量`);
            return;
        }
        const how = all.filter((c) => c.includes('刪掉'));
        assert.ok(how.length >= 1, `${name}：有待填的版本範本，要有一段註解講怎麼打開它（寫到「刪掉」）`);
        assert.ok(how.some((c) => c.slice(4).includes('<!--') && c.includes('2026-MM-DD')),
            `${name}：講怎麼打開範本的那段註解要點名要刪的「<!--」與要換掉的「2026-MM-DD」，得到：${how.join('\n')}`);
    });
}

test('B4.1 內容檔：公告檔與 links.md 不提「規格書」、links.md 不叫人去改「字串檔」（公開 repo 的讀者看不到那些）', () => {
    for (const name of ['news.zh.md', 'news.en.md', 'news.ja.md', 'links.md']) {
        assert.ok(!read(name).includes('規格書'), `${name}：不能出現「規格書」（公開 repo 的讀者看不到規格書）`);
    }
    assert.ok(!read('links.md').includes('字串檔'), 'links.md：不能叫使用者去改「字串檔」（那是程式的事）');
});

test('B4.1 內容檔乾淨：沒有看不見的字、沒有 /Users/、沒有電子郵件', () => {
    for (const name of FILES) {
        const text = read(name);
        const hidden = [...text].map((ch, i) => [ch.codePointAt(0), i])
            .filter(([code]) => INVISIBLE.includes(code) || (code < 0x20 && code !== 0x0A && code !== 0x0D && code !== 0x09) || code === 0x7F);
        assert.deepEqual(hidden.map(([code, i]) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}（第 ${i} 個字）`), [],
            `${name}：有看不見的字（零寬、NBSP、全形空白、BOM 之類）`);
        assert.ok(!text.includes('/Users/') && !text.includes('\\Users\\'), `${name}：不能有本機路徑（/Users/）`);
        const mail = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
        assert.equal(mail, null, `${name}：不能有電子郵件之類的個資，找到「${mail && mail[0]}」`);
    }
});

test('B4.2 內容檔：註解裡的範例不算內容（readContent 的條目數 ＝ 拿掉註解之後的真條目數）', async () => {
    const data = await content();
    for (const name of FILES) {
        const kind = kindOf(name);
        const marker = kind === 'links' ? /^\s*- / : /^\s*## /;
        const note = headComment(name);
        assert.ok(note.split('\n').some((line) => marker.test(line)), `${name}：說明註解裡要有範例那一行（${marker}），這條才量得到「範例不算內容」`);
        const real = read(name).replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).filter((line) => marker.test(line)).length;
        const list = entries(data, kind, name.split('.')[1]);
        assert.equal(list.length, real, `${name}：readContent 讀到 ${list.length} 條，拿掉註解之後真的有 ${real} 條（註解裡的範例被當成內容了？）`);
    }
});

test('B4.2 內容檔：readContent 讀起來每一條都是 ok:true', async () => {
    const data = await content();
    const bad = [];
    for (const lang of LANGS) {
        for (const kind of ['changelog', 'news']) {
            const file = `${kind}.${lang}.md`;
            const slot = data[kind][lang];
            if (!slot.ok) {
                bad.push(`${file}：${slot.reason}`);
                continue;
            }
            for (const entry of slot.entries) {
                if (!entry.ok) bad.push(`${file}：第 ${entry.line} 行：${entry.reason}（${entry.raw}）`);
                for (const item of entry.items ?? []) if (!item.ok) bad.push(`${file}：第 ${item.line} 行：${item.reason}（${item.raw}）`);
            }
        }
    }
    if (!data.links.ok) bad.push(`links.md：${data.links.reason}`);
    for (const entry of data.links.entries ?? []) if (!entry.ok) bad.push(`links.md：第 ${entry.line} 行：${entry.reason}（${entry.raw}）`);
    assert.deepEqual(bad, [], `內容檔有讀不到的：\n${bad.join('\n')}`);
});

test('B4.2 內容檔：checkContent 對真的 content/ 沒有任何 problem（含三語一致；警告不算）', async () => {
    for (const name of FILES) read(name);
    const { checkContent } = need();
    const result = await checkContent(CONTENT);
    const lines = result.problems.map((p) => (p.line === null ? `${p.file}：${p.reason}` : `${p.file}：第 ${p.line} 行：${p.reason}（${p.raw}）`));
    assert.deepEqual(lines, [], `真的內容檔有要修的（npm run content:check 會結束碼 1）：\n${lines.join('\n')}`);
    assert.equal(result.ok, true);
});

test('B4.2 內容檔：更新紀錄至少一個版本（三語都是）', async () => {
    const data = await content();
    for (const lang of LANGS) {
        assert.ok(entries(data, 'changelog', lang).filter((v) => v.ok).length >= 1, `changelog.${lang}.md 至少要有一個（讀得到的）版本`);
    }
});

test('B4.4 links.md：至少一個連結、代號是英文小寫與數字、不重複', async () => {
    const data = await content();
    const codes = entries(data, 'links').filter((e) => e.ok).map((e) => e.code);
    assert.ok(codes.length >= 1, 'links.md 至少要有一個連結');
    for (const code of codes) assert.match(String(code), /^[a-z0-9]+$/, `代號「${code}」只能是英文小寫與數字（同時是 icons/<代號>.svg 的檔名）`);
    assert.equal(new Set(codes).size, codes.length, `代號不能重複：${codes.join('、')}`);
});
