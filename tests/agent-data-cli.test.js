// 4-b8 的 B8.1（轉換）、B8.2（壞來源、用法錯誤、不寫半套）、B8.3（安全：來源當資料讀，不執行）：命令 scripts/agent-data.mjs，真的開子程序、在暫存資料夾真的寫檔。
// 介面細則見 tests/README.md「4-b8」。資料是 tests/fixtures/agent-tutorial/（形狀照真的 tutorial/agent-*.js 縮小），不讀 tutorial/ 的真檔。
//
// 量什麼：
//   B8.1 --from <tutorial 資料夾> --out <資料夾>：寫 agent.zh.json、agent.en.json、agent.ja.json，內容剛好是
//        JSON.stringify({ model, prompt, steps, outline, reply, say }, null, 2) + '\n'（欄位就這個順序），值跟來源逐筆相同（測試自己用 vm 沙盒讀來源比）；
//        字不改（換行、Tab、全形空白、不換行空白、emoji、𠮷、引號、反斜線、</script>）；重跑位元組相同；--out 不存在就建、裡面別的檔不動；--from 一個位元組都不變。
//   B8.2 來源壞了（缺檔、是資料夾、空的、沒有 window.AGENT、JSON 壞掉、不是物件、欄位缺、多欄位、型別錯、空字串、steps 不是陣列或空的、某一步不是 [工具, 參數]）
//        → 結束碼 1、stderr 第一行是中文、講出哪支檔（與哪個欄位、第幾步）、沒有堆疊、--out 一個位元組都不動；用法錯誤 → 結束碼 2。
//   B8.3 來源裡塞程式（process.exit、require('fs') 寫檔、無窮迴圈、改 globalThis.JSON、等號右邊是函式呼叫、window.AGENT 後面還有程式）
//        → 不執行：結束碼 1、5 秒內結束、沒有寫出任何檔（連來源想寫的檔也沒有）。
//   B8.4 給了 --out 跑完，homepage/site/ 底下每個檔的大小與修改時間都不變（不碰 data/）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B8"
//   node --test tests/agent-data-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { LANGS, FIELDS, fixtureAgent, sourceWith, tutorialCopy, runAgentData, usageError, snapshot, stamp } from './agent-fixture.js';

const OUT_FILES = ['agent.en.json', 'agent.ja.json', 'agent.zh.json'];

function expectedText(agent) {
    return JSON.stringify(Object.fromEntries(FIELDS.map((key) => [key, agent[key]])), null, 2) + '\n';
}

function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊（不丟難懂的例外）：\n${res.stderr}`);
}

// --out 裡先放舊東西：舊的三個 agent 檔與一份 chapters（data/ 裡本來就有的）
function oldOut(out) {
    fs.mkdirSync(out, { recursive: true });
    for (const name of OUT_FILES) fs.writeFileSync(path.join(out, name), `舊的 ${name}\n`);
    fs.writeFileSync(path.join(out, 'chapters.zh.json'), '[]\n');
    return snapshot(out);
}

// 一支壞來源：結束碼 1、stderr 有那支檔名與 words、--out 不動
function badSource(t, edits, words, label) {
    const { from, out } = tutorialCopy(t, edits);
    const before = oldOut(out);
    const res = runAgentData(['--from', from, '--out', out]);
    failed(res, label);
    for (const word of words) {
        assert.ok(typeof word === 'string' ? res.stderr.includes(word) : word.test(res.stderr), `${label}：stderr 要講到 ${word}；stderr：${res.stderr}`);
    }
    assert.deepEqual(snapshot(out), before, `${label}：--out 一個位元組都不動（不寫半套）`);
    return res;
}

const good = (lang) => fixtureAgent(lang);
const withField = (lang, change) => sourceWith(lang, change({ ...good(lang) }));

// ── B8.1 轉換 ──

test('B8.1 成功：三個 JSON 照固定格式寫進 --out（不存在就建），值跟來源逐筆相同，--from 不變', (t) => {
    const { from, out } = tutorialCopy(t);
    const source = snapshot(from);
    const res = runAgentData(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out).sort(), OUT_FILES, '--out 裡剛好三個檔（沒有暫存檔）');
    for (const lang of LANGS) {
        const text = fs.readFileSync(path.join(out, `agent.${lang}.json`), 'utf8');
        const agent = good(lang);
        assert.equal(text, expectedText(agent), `agent.${lang}.json 要剛好是 JSON.stringify({ model, prompt, steps, outline, reply, say }, null, 2) + '\\n'`);
        const parsed = JSON.parse(text);
        assert.deepEqual(Object.keys(parsed), FIELDS, `agent.${lang}.json 的欄位剛好是 ${FIELDS.join('、')}，照這個順序`);
        assert.deepStrictEqual(parsed, Object.fromEntries(FIELDS.map((key) => [key, agent[key]])), `agent.${lang}.json 的值跟來源逐筆相同`);
        parsed.steps.forEach((step, i) => assert.deepEqual(step, agent.steps[i], `agent.${lang}.json 第 ${i + 1} 步`));
    }
    assert.deepEqual(snapshot(from), source, '--from 一個位元組都不變（不改 tutorial/）');
});

test('B8.1 字不改：換行、Tab、全形空白、不換行空白、emoji、𠮷、引號、反斜線、</script>、看起來像註解的 // 與 /* */', (t) => {
    const { from, out } = tutorialCopy(t);
    assert.equal(runAgentData(['--from', from, '--out', out]).status, 0);
    const zh = JSON.parse(fs.readFileSync(path.join(out, 'agent.zh.json'), 'utf8'));
    for (const piece of ['\n\t縮排用 Tab', '「\u3000」', '「\u00A0」', '\u{1F40B}✨', '\u{20BB7}', '"雙"', "'單'", '反斜線 \\ 與 </script>', 'https://example.com/a//b', '/* 這也不是註解 */']) {
        assert.ok(zh.outline.includes(piece), `outline 要原樣留著 ${JSON.stringify(piece)}`);
    }
    assert.equal(zh.outline, good('zh').outline);
    const en = JSON.parse(fs.readFileSync(path.join(out, 'agent.en.json'), 'utf8'));
    assert.ok(en.outline.includes('It’s “quoted” – with'), '彎引號、en dash 原樣');
});

test('B8.1 冪等：重跑兩次、換一個 --out、從別的資料夾叫，位元組相同；--out 裡舊的 agent 檔換新、別的檔不動', (t) => {
    const { base, from, out } = tutorialCopy(t);
    oldOut(out);
    assert.equal(runAgentData(['--from', from, '--out', out]).status, 0);
    assert.equal(fs.readFileSync(path.join(out, 'chapters.zh.json'), 'utf8'), '[]\n', '--out 裡別的檔（chapters）不動');
    const first = snapshot(out);
    assert.equal(runAgentData(['--from', from, '--out', out]).status, 0);
    assert.deepEqual(snapshot(out), first, '同一個 --out 重跑：位元組相同');
    const other = path.join(base, '另一個 輸出');
    const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
    assert.equal(runAgentData(['--from', from, '--out', other], { cwd }).status, 0);
    for (const name of OUT_FILES) assert.ok(fs.readFileSync(path.join(other, name)).equals(first[name]), `${name}：換一個 --out、從別的資料夾叫，位元組相同`);
    assert.deepEqual(fs.readdirSync(cwd), [], '叫它的資料夾不多出檔');
});

// ── B8.2 來源壞了 ──

test('B8.2 缺一個語言、是資料夾、空的、只有註解 → 講出那支檔', (t) => {
    badSource(t, { 'agent-ja.js': null }, ['agent-ja.js'], '缺 agent-ja.js');
    const { from } = tutorialCopy(t);
    fs.rmSync(path.join(from, 'agent-en.js'));
    fs.mkdirSync(path.join(from, 'agent-en.js'));
    const out = path.join(path.dirname(from), 'out');
    failed(runAgentData(['--from', from, '--out', out]), 'agent-en.js 是資料夾');
    assert.ok(!fs.existsSync(out), 'agent-en.js 是資料夾：--out 不建');
    badSource(t, { 'agent-zh.js': '' }, ['agent-zh.js'], '空檔');
    badSource(t, { 'agent-zh.js': '/* 只有註解 */\n// 還是註解\n' }, ['agent-zh.js', 'window.AGENT'], '只有註解');
});

test('B8.2 沒有 window.AGENT、JSON 壞掉、不是物件 → 講出檔與原因', (t) => {
    const json = JSON.stringify(good('en'), null, 1);
    badSource(t, { 'agent-en.js': `window.OTHER = ${json};\n` }, ['agent-en.js', 'window.AGENT'], '沒有 window.AGENT');
    badSource(t, { 'agent-en.js': `window.AGENT = ${json.replace(/\n}$/, ',\n}')};\n` }, ['agent-en.js', 'JSON'], 'JSON 多一個逗號');
    badSource(t, { 'agent-en.js': `window.AGENT = { model: "x" };\n` }, ['agent-en.js', 'JSON'], '鍵沒有引號（JavaScript 物件，不是 JSON）');
    badSource(t, { 'agent-en.js': `window.AGENT = ${json.slice(0, 200)}` }, ['agent-en.js', 'JSON'], 'JSON 截斷');
    badSource(t, { 'agent-en.js': 'window.AGENT = [1, 2];\n' }, ['agent-en.js'], '是陣列不是物件');
    badSource(t, { 'agent-en.js': 'window.AGENT = "text";\n' }, ['agent-en.js'], '是字串不是物件');
});

test('B8.2 欄位缺、多一個欄位（改版）、型別錯、空字串 → 講出檔與欄位', (t) => {
    for (const field of FIELDS) {
        badSource(t, { 'agent-ja.js': withField('ja', (a) => { delete a[field]; return a; }) }, ['agent-ja.js', field], `缺 ${field}`);
    }
    badSource(t, { 'agent-ja.js': withField('ja', (a) => ({ ...a, tokens: 123 })) }, ['agent-ja.js', 'tokens'], '多一個欄位 tokens（來源改版了）');
    badSource(t, { 'agent-zh.js': withField('zh', (a) => ({ ...a, model: 5 })) }, ['agent-zh.js', 'model'], 'model 是數字');
    badSource(t, { 'agent-zh.js': withField('zh', (a) => ({ ...a, outline: null })) }, ['agent-zh.js', 'outline'], 'outline 是 null');
    badSource(t, { 'agent-zh.js': withField('zh', (a) => ({ ...a, prompt: '' })) }, ['agent-zh.js', 'prompt'], 'prompt 是空字串');
});

test('B8.2 steps 不是陣列、是空的、某一步不是 [工具, 參數] → 講出檔、steps 與第幾步', (t) => {
    badSource(t, { 'agent-en.js': withField('en', (a) => ({ ...a, steps: { 0: ['Bash', 'ls'] } })) }, ['agent-en.js', 'steps'], 'steps 是物件');
    badSource(t, { 'agent-en.js': withField('en', (a) => ({ ...a, steps: [] })) }, ['agent-en.js', 'steps'], 'steps 是空的');
    const bad = [
        [['Bash'], '只有工具'],
        [['Bash', 'ls', 'extra'], '三個元素'],
        [[1, 'ls'], '工具不是字串'],
        [['Bash', 2], '參數不是字串'],
        [['', 'ls'], '工具是空字串'],
        [['Bash', ''], '參數是空字串'],
        ['Bash ls', '整步是字串'],
        [null, '整步是 null'],
    ];
    for (const [step, label] of bad) {
        badSource(t, { 'agent-en.js': withField('en', (a) => ({ ...a, steps: [a.steps[0], step, ...a.steps.slice(1)] })) },
            ['agent-en.js', 'steps', /第\s*2\s*步/], `第 2 步${label}`);
    }
});

test('B8.2 不寫半套：--out 裡 agent.ja.json 的位置是資料夾 → 在寫任何檔之前就發現，其他檔還是舊的', (t) => {
    const { from, out } = tutorialCopy(t);
    oldOut(out);
    fs.rmSync(path.join(out, 'agent.ja.json'));
    fs.mkdirSync(path.join(out, 'agent.ja.json'));
    const before = snapshot(out);
    const res = runAgentData(['--from', from, '--out', out]);
    failed(res, 'agent.ja.json 是資料夾');
    assert.match(res.stderr, /agent\.ja\.json/, '講出 agent.ja.json');
    assert.deepEqual(snapshot(out), before, 'agent.zh.json、agent.en.json 不能先換成新的');
});

test('B8.2 用法錯誤：結束碼 2、stderr 第一行是中文、不寫任何檔', (t) => {
    const { base, from, out } = tutorialCopy(t);
    const cases = [
        ['沒給 --from', ['--out', out]],
        ['--from 空字串', ['--from=', '--out', out]],
        ['--from 缺值', ['--out', out, '--from']],
        ['--from 不存在', ['--from', path.join(base, '沒有這個資料夾'), '--out', out]],
        ['--from 是檔', ['--from', path.join(from, 'agent-zh.js'), '--out', out]],
        ['--out 空字串', ['--from', from, '--out=']],
        ['不認得的參數', ['--from', from, '--out', out, '--force']],
        ['多出來的位置參數', ['--from', from, '--out', out, 'extra']],
    ];
    for (const [label, args] of cases) {
        const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
        usageError(runAgentData(args, { cwd }), label);
        assert.ok(!fs.existsSync(out), `${label}：不建 --out`);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：叫它的資料夾還是空的`);
    }
});

// ── B8.3 來源當資料讀，不執行 ──

test('B8.3 來源裡塞程式不會被執行：結束碼 1、5 秒內、不寫任何檔、來源想寫的檔也不存在', (t) => {
    const { base } = tutorialCopy(t);
    const pwned = path.join(base, 'pwned.txt');
    const json = JSON.stringify(good('zh'), null, 1);
    const attacks = [
        ['process.exit(0)', `process.exit(0);\nwindow.AGENT = ${json};\n`],
        ["require('fs') 寫檔", `require('fs').writeFileSync(${JSON.stringify(pwned)}, 'x');\nwindow.AGENT = ${json};\n`],
        ['無窮迴圈', `while (true) {}\nwindow.AGENT = ${json};\n`],
        ['改寫 globalThis.JSON', `globalThis.JSON = { parse: () => ({}) };\nwindow.AGENT = ${json};\n`],
        ['等號右邊是函式呼叫', `window.AGENT = (() => { require('fs').writeFileSync(${JSON.stringify(pwned)}, 'x'); return ${json}; })();\n`],
        ['window.AGENT 後面還有程式', `window.AGENT = ${json};\nrequire('fs').writeFileSync(${JSON.stringify(pwned)}, 'x');\nprocess.exit(0);\n`],
        ['JSON 裡塞函式', `window.AGENT = ${json.replace('"say":', '"say": (function () { process.exit(0); })(), "x":')};\n`],
    ];
    for (const [label, source] of attacks) {
        const { from, out } = tutorialCopy(t, { 'agent-zh.js': source });
        const started = Date.now();
        const res = runAgentData(['--from', from, '--out', out]);
        const ms = Date.now() - started;
        failed(res, label);
        assert.ok(ms < 5000, `${label}：要在 5 秒內失敗，花了 ${ms} ms`);
        assert.match(res.stderr, /agent-zh\.js/, `${label}：講出 agent-zh.js`);
        assert.match(res.stderr, /window\.AGENT|JSON|資料/, `${label}：講出原因（來源要是 window.AGENT = JSON 資料）`);
        assert.ok(!fs.existsSync(out), `${label}：--out 不建`);
        assert.ok(!fs.existsSync(pwned), `${label}：來源裡的程式不能被執行（${pwned} 被寫出來了）`);
    }
});

test('B8.3 註解裡寫到 window.AGENT = 不會被當成真的那一行；字串裡的 // 與 /* */ 不會被當成註解', (t) => {
    const { from, out } = tutorialCopy(t);
    assert.ok(fs.readFileSync(path.join(from, 'agent-zh.js'), 'utf8').indexOf('window.AGENT = { … }') < fs.readFileSync(path.join(from, 'agent-zh.js'), 'utf8').indexOf('window.AGENT = {\n'), '防呆：fixture 的註解裡要有 window.AGENT = { … }');
    assert.equal(runAgentData(['--from', from, '--out', out]).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'agent.zh.json'), 'utf8')).outline, good('zh').outline);
    const block = sourceWith('en', good('en'), { before: '/* 前面的註解 */\n// 一行註解\n', after: '/* 後面的註解 */\n// 結尾\n' });
    const { from: f2, out: o2 } = tutorialCopy(t, { 'agent-en.js': block });
    assert.equal(runAgentData(['--from', f2, '--out', o2]).status, 0, '前後的註解與空行可以');
    assert.equal(fs.readFileSync(path.join(o2, 'agent.en.json'), 'utf8'), expectedText(good('en')));
    const noSemicolon = `window.AGENT = ${JSON.stringify(good('ja'))}\n`;
    const { from: f3, out: o3 } = tutorialCopy(t, { 'agent-ja.js': noSemicolon });
    assert.equal(runAgentData(['--from', f3, '--out', o3]).status, 0, '結尾沒有分號也可以');
});

// ── B8.4 不寫到別的地方 ──

test('B8.4 給了 --out 跑完，homepage/site/ 底下每個檔的大小與修改時間都不變', (t) => {
    const { from, out } = tutorialCopy(t);
    const before = stamp(SITE);
    assert.equal(runAgentData(['--from', from, '--out', out]).status, 0);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不動（只寫 --out）');
});
