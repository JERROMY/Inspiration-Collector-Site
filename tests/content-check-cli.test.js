// 檢查指令 scripts/content-check.mjs（npm run content:check；目標檔 4-b4 的 B4.2；介面細則見 tests/README.md「4-b4」）。
//
// 量什麼（一律用 spawnSync(process.execPath, [scripts/content-check.mjs, …]) 真的跑那支命令，cwd 是一個空的暫存資料夾，跑完要還是空的）：
//   B4.2 好的一組 → 結束碼 0；輸出有七支檔的檔名，每支那一行有它的數字（更新紀錄幾個版本、公告幾則、連結幾個）。
//   B4.2 不給 --dir → 讀 <site>/content（真的內容檔，跟從哪裡叫無關）→ 結束碼 0。
//   B4.2 壞條目 → 結束碼 1；每一筆逐條印成「檔名：第 N 行：原因（原文）」（原因與原文跟 checkContent 給的一樣）。
//   B4.2 整區讀不到 → 結束碼 1；有一行講 news.ja.md 與原因（檔案不存在），〔檢查員第 1 輪〕而且沒有一行把 news.ja.md 說兩遍
//        （不能印「news.ja.md：讀不到 news.ja.md：檔案不存在」）。
//   B4.2 〔檢查員第 1 輪〕摘要的版本數不算落單的 -->（stray-close/：changelog.zh.md 有 2 版加一行落單的 -->）→ 結束碼 1，
//        摘要那一行（有 changelog.zh.md、不是「第 N 行」那種問題行）有 2、沒有 3。
//   B4.2 三語不一致（版本號不同、〔檢查員第 1 輪〕同一版日期不同、公告日期不同）→ 結束碼 1；印「changelog：原因」／「news：原因」。
//   B4.2 只有警告（順序倒過來）→ 結束碼 0；輸出有「警告」與每一條 warning 的 message。
//   B4.2 用法錯誤（不認得的參數、多出來的位置參數、--dir 缺值、--dir= 空字串、--dir '' 空字串、--dir 不存在、--dir 是一個檔）→ 結束碼 2；
//        stderr 第一行要有中文、不能是 Node parseArgs 的英文原文（Unknown option、argument、ambiguous、missing、Unexpected、ERR_PARSE_ARGS）。
//   印出來的字 stdout、stderr 都可以（兩邊合起來找），只有用法錯誤規定在 stderr。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B4.2 命令"
//   node --test tests/content-check-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, lib } from './helpers.js';
import { fixture, tmp, CONTENT, FILES } from './content-check-fixture.js';

const SCRIPT = path.join(SITE, 'scripts', 'content-check.mjs');
const need = await lib('content-check.js', ['checkContent']);

// 從空的暫存資料夾叫它；跑完那裡要還是空的
function run(t, args) {
    if (!fs.existsSync(SCRIPT)) assert.fail('缺 scripts/content-check.mjs（後端之後實作）');
    const cwd = tmp(t, 'site-content-check-cwd-');
    const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000 });
    assert.equal(res.error, undefined, `跑不起來：${res.error && res.error.message}`);
    assert.deepEqual(fs.readdirSync(cwd), [], '跑完 cwd 不能多出任何檔');
    return { ...res, all: `${res.stdout}\n${res.stderr}` };
}

const lineOut = (p) => (p.line === null ? `${p.file}：${p.reason}` : `${p.file}：第 ${p.line} 行：${p.reason}（${p.raw.trim()}）`);

test('B4.2 命令：好的一組 → 結束碼 0，摘要列出七支檔與各自的數字', (t) => {
    const res = run(t, ['--dir', fixture('good')]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；輸出：${res.all}`);
    const lines = res.all.split(/\r?\n/);
    const counts = {
        'changelog.zh.md': 2, 'changelog.en.md': 2, 'changelog.ja.md': 2,
        'news.zh.md': 3, 'news.en.md': 3, 'news.ja.md': 3,
        'links.md': 4,
    };
    for (const [file, n] of Object.entries(counts)) {
        const line = lines.find((l) => l.includes(file));
        assert.ok(line, `摘要要有 ${file} 那一行，得到：${res.all}`);
        assert.match(line, new RegExp(`(^|[^0-9.])${n}([^0-9.]|$)`), `${file} 那一行要有它的數字 ${n}（${file.startsWith('changelog') ? '幾個版本' : file.startsWith('news') ? '幾則公告' : '幾個連結'}），得到：${line}`);
    }
    for (const word of ['版本', '公告', '連結']) {
        assert.ok(res.all.includes(word), `摘要要講到「${word}」，得到：${res.all}`);
    }
});

test('B4.2 命令：不給 --dir → 讀 <site>/content（真的內容檔），從別的資料夾叫也一樣 → 結束碼 0', (t) => {
    if (!fs.existsSync(CONTENT)) assert.fail('缺 content/（後端之後寫內容檔）');
    const res = run(t, []);
    assert.equal(res.status, 0, `真的內容檔要過檢查（結束碼 0），得到 ${res.status}；輸出：${res.all}`);
    for (const file of FILES) assert.ok(res.all.includes(file), `摘要要列出 ${file}，得到：${res.all}`);
});

test('B4.2 命令：壞條目 → 結束碼 1，每一筆印成「檔名：第 N 行：原因（原文）」', async (t) => {
    const { checkContent } = need();
    const { problems } = await checkContent(fixture('bad-entry'));
    const res = run(t, ['--dir', fixture('bad-entry')]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${res.all}`);
    assert.ok(problems.length >= 5, `checkContent 要列出 5 筆壞的，得到 ${JSON.stringify(problems)}`);
    for (const p of problems) {
        assert.ok(res.all.includes(lineOut(p)), `要印「${lineOut(p)}」，得到：${res.all}`);
    }
});

test('B4.2 命令：整區讀不到 → 結束碼 1，有一行講 news.ja.md 檔案不存在，而且沒有一行把檔名說兩遍', (t) => {
    const res = run(t, ['--dir', fixture('unreadable')]);
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${res.all}`);
    const lines = res.all.split(/\r?\n/);
    assert.ok(lines.some((l) => l.includes('news.ja.md') && l.includes('檔案不存在')), `要有一行講 news.ja.md 與原因「檔案不存在」，得到：${res.all}`);
    const twice = lines.filter((l) => l.split('news.ja.md').length > 2);
    assert.deepEqual(twice, [], '同一行不要把 news.ja.md 說兩遍（例如「news.ja.md：讀不到 news.ja.md：檔案不存在」）');
});

test('B4.2 命令：摘要的版本數不算落單的 -->（2 版加一行落單的 --> 要印 2 個版本，不是 3）', (t) => {
    const res = run(t, ['--dir', fixture('stray-close')]);
    assert.equal(res.status, 1, `落單的 --> 是一條要修的，結束碼要是 1，得到 ${res.status}；輸出：${res.all}`);
    const summary = res.all.split(/\r?\n/).filter((l) => l.includes('changelog.zh.md') && !/第 \d+ 行/.test(l));
    assert.ok(summary.length >= 1, `摘要要有 changelog.zh.md 那一行，得到：${res.all}`);
    for (const line of summary) {
        assert.match(line, /(^|[^0-9.])2([^0-9.]|$)/, `changelog.zh.md 有 2 個版本，摘要那一行要有 2，得到：${line}`);
        assert.doesNotMatch(line, /(^|[^0-9.])3([^0-9.]|$)/, `落單的 --> 不是一個版本，摘要那一行不能有 3，得到：${line}`);
    }
});

for (const [name, kind] of [['changelog-versions', 'changelog'], ['changelog-dates', 'changelog'], ['news-dates', 'news']]) {
    test(`B4.2 命令：三語不一致（${name}）→ 結束碼 1，印「${kind}：原因」`, async (t) => {
        const { checkContent } = need();
        const { problems } = await checkContent(fixture(name));
        const cross = problems.filter((p) => p.file === kind);
        assert.ok(cross.length >= 1, `checkContent 要列出 ${kind} 三語不一致，得到 ${JSON.stringify(problems)}`);
        const res = run(t, ['--dir', fixture(name)]);
        assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；輸出：${res.all}`);
        for (const p of cross) assert.ok(res.all.includes(lineOut(p)), `要印「${lineOut(p)}」，得到：${res.all}`);
    });
}

test('B4.2 命令：只有警告（順序倒過來）→ 結束碼 0，印「警告」與每一條 warning', async (t) => {
    const { checkContent } = need();
    const { warnings } = await checkContent(fixture('order-reversed'));
    assert.ok(warnings.length >= 6, `checkContent 要給 6 條以上的警告，得到 ${JSON.stringify(warnings)}`);
    const res = run(t, ['--dir', fixture('order-reversed')]);
    assert.equal(res.status, 0, `只有警告不影響結束碼，要是 0，得到 ${res.status}；輸出：${res.all}`);
    assert.ok(res.all.includes('警告'), `輸出要有「警告」字樣，得到：${res.all}`);
    for (const w of warnings) assert.ok(res.all.includes(w.message), `要印出這條警告「${w.message}」，得到：${res.all}`);
});

for (const [label, args] of [
    ['不認得的參數 --bogus', () => ['--bogus']],
    ['多出來的位置參數 extra', () => ['extra']],
    ['--dir 缺值', () => ['--dir']],
    ['--dir=（空字串）', () => ['--dir=']],
    ['--dir 後面接空字串', () => ['--dir', '']],
    ['--dir 不存在', (t) => ['--dir', path.join(tmp(t), 'no-such-content')]],
    ['--dir 是一個檔', (t) => {
        const file = path.join(tmp(t), 'content');
        fs.writeFileSync(file, 'not a folder');
        return ['--dir', file];
    }],
]) {
    test(`B4.2 命令：用法錯誤（${label}）→ 結束碼 2，stderr 第一行是中文、不是 Node 的英文原文`, (t) => {
        const res = run(t, args(t));
        assert.equal(res.status, 2, `${label}：結束碼要是 2（用法錯誤），得到 ${res.status}；輸出：${res.all}`);
        // 只看第一行：後面接的「用法：…」永遠是中文，看整段的話 Node 的英文原文混在前面也擋不到
        const first = res.stderr.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
        assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
        assert.doesNotMatch(first, /Unknown option|argument|ambiguous|missing|Unexpected|ERR_PARSE_ARGS/i,
            `${label}：stderr 第一行不能是 Node parseArgs 的英文原文（要翻成白話），得到：${first}`);
    });
}
