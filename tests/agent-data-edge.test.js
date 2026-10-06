// 4-b8 檢查員第 1 輪補的（B8.3、B8.2）：藏在特殊換行後面的程式、系統暫存資料夾寫不進去、來源太大。介面細則見 tests/README.md「4-b8」第 15～17 條。
//
// 量什麼：
//   B8.3 JavaScript 的行註解遇到 \r、U+2028、U+2029 也會結束，後面的字在瀏覽器裡是程式。藏在這三種字後面的程式
//        （資料後面的行註解、來源開頭的行註解）→ 結束碼 1、stderr 第一行中文、講出 agent-zh.js、--out 一個位元組都不動、來源想寫的檔不存在。
//        另外量不誤傷：整份是 CRLF 行尾（行註解以 \r\n 結束）的來源照常轉，結果跟 LF 版一樣。
//   B8.2 系統暫存資料夾寫不進去（TMPDIR 指到唯讀資料夾、指到不存在的資料夾）→ 結束碼 1、stderr 講「系統暫存資料夾」「寫不進去」、沒有堆疊、--out 不動。
//   B8.2 來源太大或結構異常（開頭八百萬行行註解、結尾兩千萬個分號；2026-10-03 在這台量到三百萬行、一千萬個就會撐爆正規表示式的堆疊）
//        → 不能印出「Maximum call stack size exceeded」這種原文；失敗的話結束碼 1、stderr 講「來源太大」或「結構異常」、沒有堆疊、--out 不動；
//        實作改成不會撐爆而照常轉出來也可以（那就要轉得對）。5 秒內。
//   測試檔裡的 U+2028、U+2029 一律寫成 \u2028、\u2029 跳脫。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B8.3 特殊換行|B8.2 暫存|B8.2 來源太大"
//   node --test tests/agent-data-edge.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIELDS, fixtureAgent, tutorialCopy, runAgentData, snapshot, tmp } from './agent-fixture.js';

const OUT_FILES = ['agent.en.json', 'agent.ja.json', 'agent.zh.json'];

function oldOut(out) {
    fs.mkdirSync(out, { recursive: true });
    for (const name of OUT_FILES) fs.writeFileSync(path.join(out, name), `舊的 ${name}\n`);
    return snapshot(out);
}

function failedPlainly(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊：\n${res.stderr}`);
}

const TERMINATORS = [['\\r', '\r'], ['U+2028', '\u2028'], ['U+2029', '\u2029']];

test('B8.3 特殊換行：資料後面的行註解，用 \\r、U+2028、U+2029 換行之後藏著程式 → 結束碼 1、不寫任何檔', (t) => {
    const json = JSON.stringify(fixtureAgent('zh'), null, 1);
    for (const [name, lt] of TERMINATORS) {
        const { base, from, out } = tutorialCopy(t);
        const pwned = path.join(base, 'pwned.txt');
        fs.writeFileSync(path.join(from, 'agent-zh.js'), `/* 註解 */\nwindow.AGENT = ${json};\n// c${lt}require('fs').writeFileSync(${JSON.stringify(pwned)}, 'x')\n`);
        const before = oldOut(out);
        const res = runAgentData(['--from', from, '--out', out]);
        failedPlainly(res, `資料後面 ${name}`);
        assert.match(res.stderr, /agent-zh\.js/, `資料後面 ${name}：講出 agent-zh.js`);
        assert.deepEqual(snapshot(out), before, `資料後面 ${name}：--out 一個位元組都不動`);
        assert.ok(!fs.existsSync(pwned), `資料後面 ${name}：來源裡的程式不能被執行`);
    }
});

test('B8.3 特殊換行：來源開頭的行註解，用 \\r、U+2028、U+2029 換行之後藏著程式 → 結束碼 1、不寫任何檔', (t) => {
    const json = JSON.stringify(fixtureAgent('zh'), null, 1);
    for (const [name, lt] of TERMINATORS) {
        const { from, out } = tutorialCopy(t);
        fs.writeFileSync(path.join(from, 'agent-zh.js'), `// c${lt}process.exit(1)\nwindow.AGENT = ${json};\n`);
        const before = oldOut(out);
        const res = runAgentData(['--from', from, '--out', out]);
        failedPlainly(res, `來源開頭 ${name}`);
        assert.match(res.stderr, /agent-zh\.js/, `來源開頭 ${name}：講出 agent-zh.js`);
        assert.deepEqual(snapshot(out), before, `來源開頭 ${name}：--out 一個位元組都不動`);
    }
});

test('B8.3 特殊換行不誤傷：整份 CRLF 行尾的來源（行註解以 \\r\\n 結束）照常轉，結果跟 LF 版一樣', (t) => {
    const { from, out } = tutorialCopy(t);
    const lfOut = path.join(path.dirname(out), 'lf');
    assert.equal(runAgentData(['--from', from, '--out', lfOut]).status, 0, 'LF 版要過');
    for (const lang of ['zh', 'en', 'ja']) {
        const file = path.join(from, `agent-${lang}.js`);
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    }
    assert.ok(fs.readFileSync(path.join(from, 'agent-en.js'), 'utf8').startsWith('// '), '防呆：en 那支開頭是行註解');
    const res = runAgentData(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `CRLF 版要過，得到 ${res.status}；stderr：${res.stderr}`);
    for (const name of OUT_FILES) assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(path.join(lfOut, name))), `${name}：CRLF 版跟 LF 版位元組相同`);
});

test('B8.2 暫存資料夾寫不進去：TMPDIR 指到唯讀資料夾或不存在的資料夾 → 結束碼 1、講「系統暫存資料夾」「寫不進去」、--out 不動', (t) => {
    const cases = [['不存在的資料夾', (dir) => path.join(dir, '沒有這個')]];
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
        cases.push(['唯讀資料夾', (dir) => {
            const ro = path.join(dir, '唯讀');
            fs.mkdirSync(ro);
            fs.chmodSync(ro, 0o555);
            t.after(() => { if (fs.existsSync(ro)) fs.chmodSync(ro, 0o755); });
            return ro;
        }]);
    }
    for (const [label, make] of cases) {
        const { from, out } = tutorialCopy(t);
        const tmpdir = make(tmp(t, 'site-agent-tmpdir-'));
        const before = oldOut(out);
        const res = runAgentData(['--from', from, '--out', out], { env: { TMPDIR: tmpdir, TEMP: tmpdir, TMP: tmpdir } });
        failedPlainly(res, label);
        assert.ok(res.stderr.includes('系統暫存資料夾') && res.stderr.includes('寫不進去'), `${label}：要講「系統暫存資料夾」「寫不進去」，得到：${res.stderr}`);
        assert.deepEqual(snapshot(out), before, `${label}：--out 一個位元組都不動`);
    }
});

test('B8.2 來源太大或結構異常：開頭八百萬行行註解、結尾兩千萬個分號 → 不印 Maximum call stack，失敗就講白話、--out 不動（5 秒內）', (t) => {
    const good = fs.readFileSync(path.join(tutorialCopy(t).from, 'agent-zh.js'), 'utf8');
    for (const [label, source] of [['八百萬行行註解', '// c\n'.repeat(8e6) + good], ['兩千萬個分號', good + ';'.repeat(2e7)]]) {
        const { from, out } = tutorialCopy(t, { 'agent-zh.js': source });
        const before = oldOut(out);
        const started = Date.now();
        const res = runAgentData(['--from', from, '--out', out]);
        const ms = Date.now() - started;
        assert.ok(ms < 5000, `${label}：要在 5 秒內，花了 ${ms} ms`);
        assert.doesNotMatch(res.stderr, /Maximum call stack|RangeError/, `${label}：不能把 JavaScript 的原文印給人看：${res.stderr}`);
        if (res.status === 0) {
            const zh = JSON.parse(fs.readFileSync(path.join(out, 'agent.zh.json'), 'utf8'));
            assert.deepStrictEqual(zh, Object.fromEntries(FIELDS.map((key) => [key, fixtureAgent('zh')[key]])), `${label}：照常轉出來的話要轉得對`);
            continue;
        }
        failedPlainly(res, label);
        assert.match(res.stderr, /來源太大|結構異常/, `${label}：要講「來源太大」或「結構異常」，得到：${res.stderr}`);
        assert.deepEqual(snapshot(out), before, `${label}：--out 一個位元組都不動`);
    }
});
