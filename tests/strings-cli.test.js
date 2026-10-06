// 4-b7 的 B7.1（驗證與產出）、B7.3（壞輸入）、B7.4 一部分（不寫到別的地方）：命令 scripts/strings.mjs，真的開子程序、在暫存資料夾裡真的寫檔。
// 介面細則見 tests/README.md「4-b7」。資料是 b7-fixture.js 組的（真的字串表挑出來的 10 個 id），不讀 design/ 的真檔。
//
// 量什麼：
//   B7.1 成功：--from 的 zh.json、en.json、ja.json、README.md 原樣（位元組相同）寫進 --out；--copy 可給可不給；--out 不存在就建；--out 裡別的檔不動；
//        重跑位元組相同（同一個 --out、另一個 --out、從別的資料夾叫）；三語 id 不一致、標記寫錯、copy.md 有而字串表沒有 → 結束碼 1、講出哪個 id、哪個語言，全部列出；
//        出錯時 --out 一個位元組都不變（原本不存在就還是不存在），連「寫到一半才會撞到的」（--out 裡同名的是資料夾）也要先發現。
//   B7.3 壞輸入：空檔、只有空白、不是 JSON、不是物件、缺語言檔、語言檔是資料夾、值不是字串、字面的標記字元、缺 README.md、copy.md 不在／是資料夾／沒有 id 表 →
//        結束碼 1、stderr 第一行是中文、講出哪個檔（與哪個 id）、沒有堆疊、--out 不動。用法錯誤 → 結束碼 2。
//   B7.4 跑完 --from 一個位元組都不變；homepage/site/ 底下每個檔的大小與修改時間都不變。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B7.1|B7.3"
//   node --test tests/strings-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import {
    runScript, usageError, tmp, snapshot, stamp, tables, writeStrings, COPY_MD, LANGS, LANG_WORD, lineWith, failed,
} from './b7-fixture.js';

const SCRIPT = 'strings.mjs';
const FILES = ['README.md', 'en.json', 'ja.json', 'zh.json'];

// 一份好的來源（資料夾名有空白與中文）、copy.md、還不存在的 --out
function setup(t, { data = tables(), readme = true, copy = COPY_MD } = {}) {
    const base = tmp(t, 'site-strings-');
    const from = writeStrings(path.join(base, '字串 來源'), data, { readme });
    const copyMd = path.join(base, '文案 表', 'copy.md');
    fs.mkdirSync(path.dirname(copyMd), { recursive: true });
    fs.writeFileSync(copyMd, copy);
    const out = path.join(base, '輸出 資料夾', 'strings');
    return { base, from, copyMd, out };
}

// --out 裡先放舊東西：舊的四個檔與一個不相干的檔
function oldOut(out) {
    fs.mkdirSync(out, { recursive: true });
    for (const name of FILES) fs.writeFileSync(path.join(out, name), `舊的 ${name}\n`);
    fs.writeFileSync(path.join(out, 'keep.txt'), '不相干的檔\n');
    return snapshot(out);
}

function run(args, opts) {
    return runScript(SCRIPT, args, opts);
}

function untouched(out, before, label) {
    assert.deepEqual(snapshot(out), before, `${label}：--out 一個位元組都不變（不留半成品）`);
}

test('B7.1 成功：四個檔原樣寫進 --out（不存在就建），--from 不變，結束碼 0', (t) => {
    const { from, copyMd, out } = setup(t);
    const source = snapshot(from);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out).sort(), FILES, '--out 裡剛好 zh.json、en.json、ja.json、README.md（沒有暫存檔）');
    for (const name of FILES) {
        assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(path.join(from, name))), `${name} 要跟來源位元組相同（原樣複製）`);
    }
    assert.deepEqual(snapshot(from), source, '--from 一個位元組都不變（不改設計師的資料夾）');
});

test('B7.1 成功：不給 --copy 也可以', (t) => {
    const { from, out } = setup(t);
    const res = run(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out).sort(), FILES);
});

test('B7.1 成功：--out 裡的舊檔換成新的，別的檔不動', (t) => {
    const { from, copyMd, out } = setup(t);
    oldOut(out);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    for (const name of FILES) assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(path.join(from, name))), `${name} 要換成新的`);
    assert.equal(fs.readFileSync(path.join(out, 'keep.txt'), 'utf8'), '不相干的檔\n', '--out 裡不是這四個名字的檔不動');
    assert.deepEqual(fs.readdirSync(out).sort(), [...FILES, 'keep.txt'].sort(), '沒有多出暫存檔');
});

test('B7.1 冪等：重跑兩次、換一個 --out、從別的資料夾叫，結果位元組相同', (t) => {
    const { base, from, copyMd, out } = setup(t);
    assert.equal(run(['--from', from, '--copy', copyMd, '--out', out]).status, 0);
    const first = snapshot(out);
    assert.equal(run(['--from', from, '--copy', copyMd, '--out', out]).status, 0);
    assert.deepEqual(snapshot(out), first, '同一個 --out 重跑：位元組相同');
    const other = path.join(base, '另一個 輸出');
    const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
    assert.equal(run(['--from', from, '--copy', copyMd, '--out', other], { cwd }).status, 0);
    assert.deepEqual(snapshot(other), first, '另一個 --out、從別的資料夾叫：位元組相同');
    assert.deepEqual(fs.readdirSync(cwd), [], '叫它的資料夾不多出檔');
});

test('B7.1 copy.md：只認表頭剛好是「| id | zh | en | ja | 來源 | 確認 |」的文案表（版本表的 1.0.5、字數表的 `not.in.strings` 不算 id）', (t) => {
    const { from, copyMd, out } = setup(t);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    assert.equal(res.status, 0, `fixture 的 copy.md 另有版本表（第一格 1.0.5）與字數表（表頭 | id | zh | en | ja | 為什麼要注意 |），不能被當成缺的 id；stderr：${res.stderr}`);
});

test('B7.1 三語 id 不一致：缺一條、多一條，各講出 id 與語言，兩個都列出；--out 不動', (t) => {
    const data = tables();
    delete data.en['privacy.lead'];
    data.ja['extra.only.ja'] = '日本語だけ';
    const { from, out } = setup(t, { data });
    const before = oldOut(out);
    const res = run(['--from', from, '--out', out]);
    failed(res, 'id 不一致');
    lineWith(res.stderr, ['privacy.lead', LANG_WORD.en], 'en 缺 privacy.lead');
    lineWith(res.stderr, ['extra.only.ja', LANG_WORD.ja], 'ja 多了 extra.only.ja');
    untouched(out, before, 'id 不一致');
});

test('B7.1 三語 id 不一致：中文多一條（以哪一語為準都要講得出來）', (t) => {
    const data = tables();
    data.zh['zh.only'] = '只有中文';
    const { from, out } = setup(t, { data });
    const res = run(['--from', from, '--out', out]);
    failed(res, '中文多一條');
    lineWith(res.stderr, ['zh.only'], '講出 zh.only');
    assert.ok(!fs.existsSync(out), '--out 原本不存在，出錯之後還是不存在');
});

test('B7.1 標記寫錯：講出語言、id、第幾個字；好幾條錯全部列出；--out 不動', (t) => {
    const data = tables();
    data.ja['privacy.lead'] = '««作者があなたのデータを»«受け取ることはできません。»«受け取る場所が存在しないからです。»'; // 最外層少一個 »
    data.zh['hero.meta.os'] = '支援 {Windows、{Mac} 桌機版}'; // { 裡有 {
    data.en['forai.title'] = '«Web clippers are written ↵for human readers.»'; // ↵ 在 «…» 裡
    const { from, copyMd, out } = setup(t, { data });
    const before = oldOut(out);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    failed(res, '標記寫錯');
    lineWith(res.stderr, ['privacy.lead', LANG_WORD.ja, /第\s*1\s*個?字/], 'ja privacy.lead：沒關的 « 在第 1 字');
    lineWith(res.stderr, ['hero.meta.os', LANG_WORD.zh, /第\s*13\s*個?字/], 'zh hero.meta.os：{ 裡的 { 在第 13 字');
    lineWith(res.stderr, ['forai.title', LANG_WORD.en, /第\s*27\s*個?字/], 'en forai.title：↵ 在第 27 字');
    untouched(out, before, '標記寫錯');
});

test('B7.1 copy.md 有而字串表沒有：列出每一個缺的 id 與 copy.md；--out 不動', (t) => {
    const copy = COPY_MD.replace('|---|---|---|---|---|---|\n', '|---|---|---|---|---|---|\n| bulletin.text | 公告 | News | お知らせ | 測試用 | 測試用 |\n| hero.cta | 加到 Chrome | Add to Chrome | Chrome に追加 | 測試用 | 測試用 |\n');
    const { from, copyMd, out } = setup(t, { copy });
    const before = oldOut(out);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    failed(res, 'copy.md 多了 id');
    lineWith(res.stderr, ['bulletin.text'], '列出 bulletin.text');
    lineWith(res.stderr, ['hero.cta'], '列出 hero.cta');
    assert.match(res.stderr, /copy\.md/, 'stderr 要講到 copy.md');
    untouched(out, before, 'copy.md 多了 id');
});

test('B7.1 不留半成品：--out 裡 ja.json 的位置是資料夾 → 在寫任何檔之前就發現，其他檔還是舊的', (t) => {
    const { from, copyMd, out } = setup(t);
    const before = oldOut(out);
    fs.rmSync(path.join(out, 'ja.json'));
    fs.mkdirSync(path.join(out, 'ja.json'));
    fs.writeFileSync(path.join(out, 'ja.json', 'inside.txt'), '佔住名字的資料夾\n');
    const blocked = snapshot(out);
    assert.notDeepEqual(blocked, before);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    failed(res, 'ja.json 是資料夾');
    lineWith(res.stderr, ['ja.json'], '講出 ja.json');
    untouched(out, blocked, 'ja.json 是資料夾（zh.json、en.json、README.md 不能先換成新的）');
});

test('B7.1 --out 是一個檔：結束碼不是 0、那個檔不變、stderr 第一行是中文', (t) => {
    const { base, from } = setup(t);
    const file = path.join(base, '是檔 不是資料夾');
    fs.writeFileSync(file, '原本的內容\n');
    const res = run(['--from', from, '--out', file]);
    assert.notEqual(res.status, 0, `結束碼不能是 0；stderr：${res.stderr}`);
    assert.equal(fs.readFileSync(file, 'utf8'), '原本的內容\n', '那個檔不變');
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, 'stderr 不能有堆疊');
});

// ── B7.3 壞輸入 ──

const BAD_FILES = [
    ['空檔', '', null],
    ['只有空白', ' \n\t\n', null],
    ['不是 JSON', '{ "nav.brand": "靈感收集器", }\n', /JSON/],
    ['亂碼', 'not json at all', /JSON/],
    ['是陣列', '["nav.brand"]\n', null],
    ['是 null', 'null\n', null],
    ['是字串', '"nav.brand"\n', null],
];

for (const [label, content, word] of BAD_FILES) {
    test(`B7.3 壞輸入：en.json ${label} → 結束碼 1、講出 en.json、--out 不動`, (t) => {
        const data = tables();
        data.en = content;
        const { from, out } = setup(t, { data });
        const before = oldOut(out);
        const res = run(['--from', from, '--out', out]);
        failed(res, label);
        lineWith(res.stderr, ['en.json', ...(word ? [word] : [])], `${label}：講出 en.json${word ? ` 與 ${word}` : ''}`);
        untouched(out, before, label);
    });
}

test('B7.3 壞輸入：缺 ja.json → 講出 ja.json；--out 原本不存在就還是不存在', (t) => {
    const { from, out } = setup(t);
    fs.rmSync(path.join(from, 'ja.json'));
    const res = run(['--from', from, '--out', out]);
    failed(res, '缺 ja.json');
    lineWith(res.stderr, ['ja.json'], '講出 ja.json');
    assert.ok(!fs.existsSync(out), '--out 不建');
});

test('B7.3 壞輸入：zh.json 是資料夾 → 講出 zh.json', (t) => {
    const { from, out } = setup(t);
    fs.rmSync(path.join(from, 'zh.json'));
    fs.mkdirSync(path.join(from, 'zh.json'));
    const res = run(['--from', from, '--out', out]);
    failed(res, 'zh.json 是資料夾');
    lineWith(res.stderr, ['zh.json'], '講出 zh.json');
    assert.ok(!fs.existsSync(out), '--out 不建');
});

test('B7.3 壞輸入：缺 README.md（字串表說明要跟著一起放進 --out）→ 講出 README.md', (t) => {
    const { from, out } = setup(t, { readme: false });
    const res = run(['--from', from, '--out', out]);
    failed(res, '缺 README.md');
    lineWith(res.stderr, ['README.md'], '講出 README.md');
    assert.ok(!fs.existsSync(out), '--out 不建');
});

test('B7.3 壞輸入：值不是字串（數字、null、物件、陣列）→ 每一條都講出檔與 id', (t) => {
    const data = tables();
    data.zh['nav.brand'] = 3;
    data.en['where.label'] = null;
    data.ja['hero.title'] = { text: 'x' };
    data.ja['req.lang'] = ['x'];
    const { from, out } = setup(t, { data });
    const before = oldOut(out);
    const res = run(['--from', from, '--out', out]);
    failed(res, '值不是字串');
    lineWith(res.stderr, ['nav.brand', LANG_WORD.zh], 'zh nav.brand 是數字');
    lineWith(res.stderr, ['where.label', LANG_WORD.en], 'en where.label 是 null');
    lineWith(res.stderr, ['hero.title', LANG_WORD.ja], 'ja hero.title 是物件');
    lineWith(res.stderr, ['req.lang', LANG_WORD.ja], 'ja req.lang 是陣列');
    untouched(out, before, '值不是字串');
});

test('B7.3 壞輸入：字面的標記字元（單獨的 %、落單的 }、落單的 »）→ 講出 id 與第幾個字', (t) => {
    const data = tables();
    data.zh['nav.brand'] = '靈感收集器 100%';
    data.en['nav.brand'] = 'Inspiration} Collector';
    data.ja['nav.brand'] = 'インスピレーション»コレクター';
    const { from, out } = setup(t, { data });
    const res = run(['--from', from, '--out', out]);
    failed(res, '字面的標記字元');
    lineWith(res.stderr, ['nav.brand', LANG_WORD.zh, /第\s*10\s*個?字/], 'zh 的 % 在第 10 字');
    lineWith(res.stderr, ['nav.brand', LANG_WORD.en, /第\s*12\s*個?字/], 'en 的 } 在第 12 字');
    lineWith(res.stderr, ['nav.brand', LANG_WORD.ja, /第\s*10\s*個?字/], 'ja 的 » 在第 10 字');
    assert.ok(!fs.existsSync(out), '--out 不建');
});

test('B7.3 邊界：空字串的值、很長的字（二十萬字）、Unicode 都可以，原樣寫出', (t) => {
    const data = tables();
    for (const lang of LANGS) {
        data[lang]['empty.text'] = '';
        data[lang]['long.text'] = '«字{詞語}|⟨⟦括⟧⟩»'.repeat(20000);
        data[lang]['unicode.text'] = '«𠮷野家»«👍🏽 {\u{1F468}\u200D\u{1F469}\u200D\u{1F467}}»';
    }
    const { from, out } = setup(t, { data });
    const res = run(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    for (const name of FILES) assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(path.join(from, name))), `${name} 原樣寫出`);
});

test('B7.3 壞輸入：--copy 的檔不在、是資料夾、裡面沒有 id 表 → 結束碼 1、講出那個檔', (t) => {
    const { base, from, out } = setup(t);
    const missing = path.join(base, '沒有 這個', 'copy.md');
    let res = run(['--from', from, '--copy', missing, '--out', out]);
    failed(res, 'copy.md 不在');
    lineWith(res.stderr, ['copy.md'], 'copy.md 不在：講出檔名');
    const dir = path.join(base, 'copy 資料夾.md');
    fs.mkdirSync(dir);
    res = run(['--from', from, '--copy', dir, '--out', out]);
    failed(res, 'copy.md 是資料夾');
    lineWith(res.stderr, ['copy 資料夾.md'], 'copy.md 是資料夾：講出檔名');
    const empty = path.join(base, 'no-table.md');
    fs.writeFileSync(empty, '# 沒有文案表\n\n| 版本 | 用在哪裡 |\n|---|---|\n| 1.0.5 | news |\n\n| id | zh | en | ja | 為什麼要注意 |\n|---|---|---|---|---|\n| `nav.brand` | 甲 | A | あ | 字數表 |\n');
    res = run(['--from', from, '--copy', empty, '--out', out]);
    failed(res, 'copy.md 沒有 id 表');
    lineWith(res.stderr, ['no-table.md'], 'copy.md 沒有 id 表：講出檔名');
    assert.ok(!fs.existsSync(out), '三種都不建 --out');
});

test('B7.3 用法錯誤：結束碼 2、stderr 第一行是中文、不寫任何檔', (t) => {
    const { base, from, out } = setup(t);
    const file = path.join(from, 'zh.json');
    const cases = [
        ['沒給 --from', ['--out', out]],
        ['--from 空字串', ['--from=', '--out', out]],
        ['--from 缺值', ['--out', out, '--from']],
        ['--from 不存在', ['--from', path.join(base, '沒有這個資料夾'), '--out', out]],
        ['--from 是檔', ['--from', file, '--out', out]],
        ['--out 空字串', ['--from', from, '--out=']],
        ['--copy 空字串', ['--from', from, '--copy=', '--out', out]],
        ['不認得的參數', ['--from', from, '--out', out, '--force']],
        ['多出來的位置參數', ['--from', from, '--out', out, 'extra']],
    ];
    for (const [label, args] of cases) {
        const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
        const res = run(args, { cwd });
        usageError(res, label);
        assert.ok(!fs.existsSync(out), `${label}：不建 --out`);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：叫它的資料夾還是空的`);
    }
});

test('B7.4 不寫到別的地方：給了 --out 跑完，homepage/site/ 底下每個檔的大小與修改時間都不變', (t) => {
    const { from, copyMd, out } = setup(t);
    const before = stamp(SITE);
    const res = run(['--from', from, '--copy', copyMd, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不動（只寫 --out）');
});

test('B7.4 來源不變：出錯時 --from 一個位元組都不變', (t) => {
    const data = tables();
    data.ja['privacy.lead'] = '«沒關';
    const { from, out } = setup(t, { data });
    const source = snapshot(from);
    failed(run(['--from', from, '--out', out]), '標記寫錯');
    assert.deepEqual(snapshot(from), source, '--from 不變');
});
