// 4-b8 的 B8.1 真的資料與提交進來的 data/agent.*.json。介面細則見 tests/README.md「4-b8」。
//
// 量什麼：
//   提交進來的 homepage/site/data/agent.{zh,en,ja}.json：三個都在、欄位剛好六個（照順序、型別對、steps 每一步是兩個非空字串）、
//   檔案就是 JSON.stringify(…, null, 2) + '\n' 的樣子。
//   設了 SITE_REAL_TUTORIAL（真的 tutorial 資料夾）才跑：命令讀真的 agent-{zh,en,ja}.js、--out 暫存資料夾 → 結束碼 0；
//   三個輸出跟測試自己用 vm 沙盒讀的來源逐筆相同；tutorial/ 跑前跑後每個檔的雜湊相同；提交進來的 data/agent.*.json 跟重算的位元組相同（不同就要重跑 npm run agent-data）。
//   設了但那裡沒有三支 agent-*.js → 紅（路徑打錯不能靜靜略過）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B8.1 提交|B8.1 真的資料"
//   SITE_REAL_TUTORIAL=<tutorial 資料夾> npm test -- --test-name-pattern "B8.1 真的資料"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SITE } from './helpers.js';
import { LANGS, FIELDS, oracle, runAgentData, tmp } from './agent-fixture.js';

const DATA = path.join(SITE, 'data');

function hashes(dir) {
    const out = {};
    const walk = (abs, rel) => {
        for (const name of fs.readdirSync(abs).sort()) {
            const full = path.join(abs, name);
            const key = rel ? `${rel}/${name}` : name;
            if (fs.statSync(full).isDirectory()) walk(full, key);
            else out[key] = createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        }
    };
    walk(dir, '');
    return out;
}

test('B8.1 提交進來的 data/agent.{zh,en,ja}.json：三個都在、六個欄位照順序、格式固定', () => {
    for (const lang of LANGS) {
        const file = path.join(DATA, `agent.${lang}.json`);
        assert.ok(fs.existsSync(file), `缺 data/agent.${lang}.json（請用真的 tutorial 資料夾執行 npm run agent-data -- --from <tutorial 資料夾>，再提交）`);
        const text = fs.readFileSync(file, 'utf8');
        const agent = JSON.parse(text);
        assert.deepEqual(Object.keys(agent), FIELDS, `agent.${lang}.json 的欄位剛好 ${FIELDS.join('、')}，照這個順序`);
        for (const key of ['model', 'prompt', 'outline', 'reply', 'say']) assert.ok(typeof agent[key] === 'string' && agent[key] !== '', `agent.${lang}.json 的 ${key} 要是非空字串`);
        assert.ok(Array.isArray(agent.steps) && agent.steps.length > 0, `agent.${lang}.json 的 steps 要是非空陣列`);
        agent.steps.forEach((step, i) => assert.ok(Array.isArray(step) && step.length === 2 && step.every((s) => typeof s === 'string' && s !== ''), `agent.${lang}.json 第 ${i + 1} 步要是 [工具, 參數]`));
        assert.equal(text, JSON.stringify(agent, null, 2) + '\n', `agent.${lang}.json 要是 JSON.stringify(…, null, 2) + '\\n'`);
    }
});

test('B8.1 真的資料：npm run agent-data 讀真的 tutorial/agent-*.js，逐筆相同、tutorial/ 不變、提交進來的相同（SITE_REAL_TUTORIAL）', (t) => {
    const from = process.env.SITE_REAL_TUTORIAL;
    if (!from) {
        t.skip('沒設 SITE_REAL_TUTORIAL（真的 tutorial 資料夾，例如專案根目錄的 tutorial/）');
        return;
    }
    for (const lang of LANGS) assert.ok(fs.existsSync(path.join(from, `agent-${lang}.js`)), `SITE_REAL_TUTORIAL=${from} 裡沒有 agent-${lang}.js（路徑打錯不能靜靜略過）`);
    const before = hashes(from);
    const out = path.join(tmp(t, 'site-agent-real-'), 'data');
    const res = runAgentData(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.deepEqual(hashes(from), before, 'tutorial/ 跑前跑後每個檔的雜湊相同（不改 tutorial/）');
    for (const lang of LANGS) {
        const want = oracle(fs.readFileSync(path.join(from, `agent-${lang}.js`), 'utf8'));
        const text = fs.readFileSync(path.join(out, `agent.${lang}.json`), 'utf8');
        assert.equal(text, JSON.stringify(Object.fromEntries(FIELDS.map((key) => [key, want[key]])), null, 2) + '\n', `agent.${lang}.json 跟來源逐筆相同、格式固定`);
        const committed = path.join(DATA, `agent.${lang}.json`);
        assert.ok(fs.existsSync(committed), `缺 data/agent.${lang}.json`);
        assert.equal(fs.readFileSync(committed, 'utf8'), text, `data/agent.${lang}.json 跟重算的不同：教學片重算過的話，要重跑 npm run agent-data 再提交`);
    }
});
