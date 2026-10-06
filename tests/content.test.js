// lib/content.js 的 readContent(dir) —— 讀整個 content/ 資料夾（規格書第 3、7 節）。
//
// 回傳 { changelog: { zh, en, ja }, news: { zh, en, ja }, links }；每個位置是 { ok: true, entries } 或 { ok: false, reason }。
// 讀的檔：changelog.<zh|en|ja>.md、news.<zh|en|ja>.md、links.md。readContent 是 async，測試用 await。
//
// 量什麼（編號照目標檔 4-b1 的測試案例）：
//   B1.5 好的資料夾（tests/fixtures/content/）七個位置都是 ok:true，entries 等於拿同一支檔餵 parseChangelog／parseNews／parseLinks 的結果；
//        某一支檔不存在、某一支是資料夾（讀不了）→ 只有那個位置 { ok: false, reason }（只有這兩個欄位），
//        reason 寫出那支檔的檔名，其他六個位置照常；整個資料夾不存在 → 七個位置都 ok:false、不丟例外。
//   B1.4 檔案層級的壞法（每條在暫存資料夾複製一份好的、只弄壞一支）：
//        編碼不是 UTF-8（Big5 位元組）→ 那個位置 ok:false，reason 寫出檔名與「UTF-8」；
//        二進位檔（合法 UTF-8 但夾著 NUL 位元組；以及一張 PNG 的開頭）→ ok:false，reason 寫出檔名；
//        整檔空白（空檔、只有空行）→ { ok: true, entries: [] }（公告本來就可以一則都沒有）。
//        都不丟例外，其他位置照常。
//   修補 2：好的資料夾裡英日文的公告用中文的「連結：」「連結:」「置頂」，要讀得到。
//   修補 3：tests/fixtures/crlf-bom/ 的三支（CRLF 行尾＋UTF-8 BOM）放進資料夾，結果跟 LF 版一樣。
//
// 介面細則見 tests/README.md。
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B1.5"          只跑某一條
//   node --test tests/content.test.js               只跑這支
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lib, FIXTURES, noReject, crlfBom } from './helpers.js';

const needContent = await lib('content.js', ['readContent']);
const needChangelog = await lib('changelog.js', ['parseChangelog']);
const needNews = await lib('news.js', ['parseNews']);
const needLinks = await lib('links.js', ['parseLinks']);

const GOOD = path.join(FIXTURES, 'content');
const LANGS = ['zh', 'en', 'ja'];

// 七個位置：[取值, 檔名, 用哪個 parser]
function slots() {
    const { parseChangelog } = needChangelog();
    const { parseNews } = needNews();
    const { parseLinks } = needLinks();
    const list = [];
    for (const lang of LANGS) {
        list.push({ name: `changelog.${lang}.md`, get: (r) => r.changelog?.[lang], parse: parseChangelog });
        list.push({ name: `news.${lang}.md`, get: (r) => r.news?.[lang], parse: parseNews });
    }
    list.push({ name: 'links.md', get: (r) => r.links, parse: parseLinks });
    return list;
}

async function read(dir) {
    const { readContent } = needContent();
    return noReject('readContent', () => readContent(dir));
}

function expectShape(result) {
    assert.ok(result && typeof result === 'object', `readContent 要回傳物件，得到 ${JSON.stringify(result)}`);
    assert.deepEqual(Object.keys(result).sort(), ['changelog', 'links', 'news'], '最上層是 changelog、news、links');
    assert.deepEqual(Object.keys(result.changelog).sort(), ['en', 'ja', 'zh'], 'changelog 有 zh、en、ja');
    assert.deepEqual(Object.keys(result.news).sort(), ['en', 'ja', 'zh'], 'news 有 zh、en、ja');
}

// 除了 broken 列出的檔，其他位置都要跟好的資料夾讀出來的一樣
function expectOthersFine(result, broken) {
    for (const slot of slots()) {
        if (broken.includes(slot.name)) continue;
        const text = fs.readFileSync(path.join(GOOD, slot.name), 'utf8');
        assert.deepStrictEqual(slot.get(result), { ok: true, entries: slot.parse(text) }, `${slot.name} 沒壞，要照常`);
    }
}

function expectSlotBad(result, name, words = []) {
    const slot = slots().find((s) => s.name === name);
    const got = slot.get(result);
    assert.ok(got && got.ok === false, `${name} 要是 ok:false，得到 ${JSON.stringify(got)}`);
    assert.deepEqual(Object.keys(got).sort(), ['ok', 'reason'], `${name}：讀不到的位置只有 ok 與 reason`);
    assert.ok(typeof got.reason === 'string' && got.reason.includes(name), `${name}：reason 要寫出是哪一支檔，得到「${got.reason}」`);
    for (const word of words) {
        assert.ok(got.reason.includes(word), `${name}：reason 要講到「${word}」，得到「${got.reason}」`);
    }
}

// 複製一份好的資料夾到暫存處，交給 fn 弄壞；做完刪掉
async function withCopy(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'home-content-'));
    try {
        fs.cpSync(GOOD, dir, { recursive: true });
        return await fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ───────────────────────── B1.5 ─────────────────────────

test('B1.5 好的 content/ 資料夾：七個位置都讀得出來，內容跟 parser 一樣', async () => {
    const result = await read(GOOD);
    expectShape(result);
    expectOthersFine(result, []);
    // 防呆：fixture 本身要真的有東西，不然上面那條是空對空
    assert.ok(result.changelog.zh.entries.length >= 2 && result.news.zh.entries.length >= 2 && result.links.entries.length >= 5, 'fixture 要有內容');
    // 修補 2：英日文的公告檔也用中文的「連結：」（英文那支是半形冒號）「置頂」
    assert.equal(result.news.en.entries[0].link, 'https://jerromy.com/en/', 'news.en.md 的「連結:」要讀得到');
    assert.equal(result.news.en.entries[0].pinned, true, 'news.en.md 的「置頂」要讀得到');
    assert.equal(result.news.ja.entries[0].link, 'https://jerromy.com/ja/', 'news.ja.md 的「連結：」要讀得到');
});

test('B1.5 某一語言的檔不存在：只有那一區 ok:false，原因寫出檔名', async () => {
    await withCopy(async (dir) => {
        fs.rmSync(path.join(dir, 'changelog.ja.md'));
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'changelog.ja.md');
        expectOthersFine(result, ['changelog.ja.md']);
    });
});

test('B1.5 links.md 不存在：只有 links ok:false', async () => {
    await withCopy(async (dir) => {
        fs.rmSync(path.join(dir, 'links.md'));
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'links.md');
        expectOthersFine(result, ['links.md']);
    });
});

test('B1.5 某一支檔讀不了（是資料夾）：只有那一區 ok:false', async () => {
    await withCopy(async (dir) => {
        fs.rmSync(path.join(dir, 'news.en.md'));
        fs.mkdirSync(path.join(dir, 'news.en.md'));
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'news.en.md');
        expectOthersFine(result, ['news.en.md']);
    });
});

test('B1.5 整個 content/ 資料夾不存在：七個位置都 ok:false、不丟例外', async () => {
    const missing = path.join(os.tmpdir(), `home-content-missing-${process.pid}-${Date.now()}`);
    const result = await read(missing);
    expectShape(result);
    for (const slot of slots()) expectSlotBad(result, slot.name);
});

// ───────────────────────── B1.4（檔案層級） ─────────────────────────

// Big5 編碼的「## 1.0.5 - 2026-10-02 / - 中文」：0xA4 在 UTF-8 是接續位元組，不能當開頭
const BIG5 = Buffer.concat([
    Buffer.from('## 1.0.5 - 2026-10-02\n- ', 'ascii'),
    Buffer.from([0xa4, 0xa4, 0xa4, 0xe5]),
    Buffer.from('\n', 'ascii'),
]);
// 合法 UTF-8，但夾著 NUL 位元組（二進位檔的記號）
const NUL = Buffer.concat([Buffer.from('## 2026-09-30 · 更新 · 標題\n', 'utf8'), Buffer.from([0, 0, 1, 2, 0]), Buffer.from('\n', 'utf8')]);
// 一張 PNG 的開頭（上傳錯檔）
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);

test('B1.4 檔案編碼不是 UTF-8：那一區 ok:false，原因寫出檔名與 UTF-8', async () => {
    await withCopy(async (dir) => {
        fs.writeFileSync(path.join(dir, 'changelog.zh.md'), BIG5);
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'changelog.zh.md', ['UTF-8']);
        expectOthersFine(result, ['changelog.zh.md']);
    });
});

test('B1.4 二進位檔（合法 UTF-8 但夾著 NUL）：那一區 ok:false', async () => {
    await withCopy(async (dir) => {
        fs.writeFileSync(path.join(dir, 'news.ja.md'), NUL);
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'news.ja.md');
        expectOthersFine(result, ['news.ja.md']);
    });
});

test('B1.4 二進位檔（一張 PNG）：那一區 ok:false', async () => {
    await withCopy(async (dir) => {
        fs.writeFileSync(path.join(dir, 'links.md'), PNG);
        const result = await read(dir);
        expectShape(result);
        expectSlotBad(result, 'links.md');
        expectOthersFine(result, ['links.md']);
    });
});

test('B1.4 整檔空白：那一區 { ok: true, entries: [] }，不算讀不到', async () => {
    await withCopy(async (dir) => {
        fs.writeFileSync(path.join(dir, 'news.zh.md'), '');
        fs.writeFileSync(path.join(dir, 'changelog.en.md'), '\n\n   \n');
        const result = await read(dir);
        expectShape(result);
        assert.deepStrictEqual(result.news.zh, { ok: true, entries: [] }, '空檔');
        assert.deepStrictEqual(result.changelog.en, { ok: true, entries: [] }, '只有空行');
        expectOthersFine(result, ['news.zh.md', 'changelog.en.md']);
    });
});

// ───────────────────────── 第 1 次修補 ─────────────────────────

test('B1.4 修補3 檔案是 CRLF 行尾＋UTF-8 BOM：那幾區照常讀得出來，結果跟 LF 版一樣', async () => {
    const { parseChangelog } = needChangelog();
    const { parseNews } = needNews();
    const { parseLinks } = needLinks();
    const files = { 'changelog.zh.md': parseChangelog, 'news.zh.md': parseNews, 'links.md': parseLinks };
    await withCopy(async (dir) => {
        const want = {};
        for (const [name, parse] of Object.entries(files)) {
            const { lf } = crlfBom(name);
            fs.copyFileSync(path.join(FIXTURES, 'crlf-bom', name), path.join(dir, name));
            want[name] = { ok: true, entries: parse(lf) };
        }
        const result = await read(dir);
        expectShape(result);
        assert.deepStrictEqual(result.changelog.zh, want['changelog.zh.md'], 'changelog.zh.md（CRLF＋BOM）');
        assert.deepStrictEqual(result.news.zh, want['news.zh.md'], 'news.zh.md（CRLF＋BOM）');
        assert.deepStrictEqual(result.links, want['links.md'], 'links.md（CRLF＋BOM）');
        expectOthersFine(result, Object.keys(files));
    });
});
