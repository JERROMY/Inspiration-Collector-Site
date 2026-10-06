// 4-b8 的 B8.1、B8.3：lib/agent.js 的 parseAgentSource(text) —— 把 tutorial/agent-*.js（註解 + window.AGENT = { JSON };）當資料讀，不執行。介面細則見 tests/README.md「4-b8」。
//
// 量什麼：
//   B8.1 讀 fixture 得到 { model, prompt, steps, outline, reply, say }（欄位就這個順序），值跟測試自己用 vm 沙盒讀的一樣；每次給新的物件。
//   B8.2 寫壞的來源丟 Error（不是 TypeError），訊息是中文、講到原因（window.AGENT、JSON、欄位名、第幾步）；text 不是字串丟 TypeError。
//   B8.3 不執行來源：來源裡寫 globalThis.__agentPwned = 1，讀完之後 globalThis 上沒有它。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B8.1 解析|B8.2 解析|B8.3 解析"
//   node --test tests/agent-parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib } from './helpers.js';
import { LANGS, FIELDS, FIXTURE, fixtureAgent, sourceWith } from './agent-fixture.js';

const need = await lib('agent.js', ['parseAgentSource']);

function bad(text, words, label) {
    const { parseAgentSource } = need();
    let err = null;
    try {
        parseAgentSource(text);
    } catch (e) {
        err = e;
    }
    assert.ok(err instanceof Error, `${label}：要丟 Error`);
    assert.ok(!(err instanceof TypeError), `${label}：來源寫壞不是 TypeError（那是呼叫的人寫錯），得到 ${err.name}：${err.message}`);
    assert.match(err.message, /[一-鿿]/, `${label}：訊息要是中文：${err.message}`);
    for (const word of words) assert.ok(typeof word === 'string' ? err.message.includes(word) : word.test(err.message), `${label}：訊息要講到 ${word}：${err.message}`);
}

test('B8.1 解析：三語的 fixture 讀成六個欄位（照順序），值跟 vm 沙盒讀的一樣', () => {
    const { parseAgentSource } = need();
    for (const lang of LANGS) {
        const got = parseAgentSource(fs.readFileSync(path.join(FIXTURE, `agent-${lang}.js`), 'utf8'));
        assert.deepEqual(Object.keys(got), FIELDS, `${lang}：欄位剛好 ${FIELDS.join('、')}，照這個順序`);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), fixtureAgent(lang), `${lang}：值跟來源一樣`);
    }
    const text = fs.readFileSync(path.join(FIXTURE, 'agent-zh.js'), 'utf8');
    const a = parseAgentSource(text);
    a.steps[0][0] = '被改了';
    assert.equal(parseAgentSource(text).steps[0][0], 'Bash', '每次給新的物件');
});

test('B8.2 解析：寫壞的來源丟 Error（中文、講到原因）；text 不是字串丟 TypeError', () => {
    const json = JSON.stringify(fixtureAgent('en'), null, 1);
    bad('', ['window.AGENT'], '空字串');
    bad('/* 只有註解 */', ['window.AGENT'], '只有註解');
    bad(`window.OTHER = ${json};`, ['window.AGENT'], '沒有 window.AGENT');
    bad('window.AGENT = { model: "x" };', ['JSON'], '不是 JSON');
    bad(sourceWith('en', { ...fixtureAgent('en'), tokens: 1 }), ['tokens'], '多一個欄位');
    const { steps, ...noSteps } = fixtureAgent('en');
    void steps;
    bad(sourceWith('en', noSteps), ['steps'], '缺 steps');
    bad(sourceWith('en', { ...fixtureAgent('en'), steps: [['Bash', 'ls'], ['Read']] }), ['steps', /第\s*2\s*步/], '第 2 步只有工具');
    const { parseAgentSource } = need();
    for (const text of [undefined, null, 5, Buffer.from('x')]) assert.throws(() => parseAgentSource(text), TypeError, `text 是 ${String(text)} 要丟 TypeError`);
});

test('B8.3 解析：不執行來源（globalThis 不會多出東西、process.exit 不會被叫）', () => {
    const json = JSON.stringify(fixtureAgent('zh'), null, 1);
    bad(`globalThis.__agentPwned = 1;\nwindow.AGENT = ${json};`, [/window\.AGENT|JSON|資料/], '前面有程式');
    bad(`window.AGENT = ${json};\nglobalThis.__agentPwned = 1;`, [/window\.AGENT|JSON|資料/], '後面有程式');
    assert.equal(globalThis.__agentPwned, undefined, '來源裡的程式不能被執行');
});
