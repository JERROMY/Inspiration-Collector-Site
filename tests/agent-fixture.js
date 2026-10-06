// 4-b8（07 區「AI 開始打字」的資料轉換）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。介面細則見 tests/README.md「4-b8」。
//
// LANGS / FIELDS               三種語言；輸出的欄位，順序就是這個（model、prompt、steps、outline、reply、say）
// FIXTURE                      tests/fixtures/agent-tutorial/：形狀照真的 tutorial/agent-{zh,en,ja}.js 縮小（註解 + window.AGENT = { JSON };）
// oracle(source)               測試自己讀來源：在 node:vm 的空沙盒裡跑（只有 window、逾時 1 秒），拿 window.AGENT 再 JSON 轉一次。
//                              只拿來讀我們自己的 fixture 與真的來源（可信的），不讀測試裡故意塞壞東西的來源；被測的程式不准這樣讀（見 B8.3）。
// tutorialCopy(t, edits)       在暫存資料夾（名字有空白與中文）複製一份 fixture 的 tutorial 資料夾；edits 是 { 'agent-zh.js': 新內容 | null（刪掉） }
// sourceWith(lang, agent, …)   用同樣的形狀（註解 + window.AGENT = JSON;）組一支來源
// runAgentData(args, opts)     真的開子程序跑 scripts/agent-data.mjs（b6-fixture.js 的 runScript）
// runScript / usageError / tmp / snapshot / stamp   沿用 b6-fixture.js
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { FIXTURES } from './helpers.js';
import { runScript, usageError, tmp, snapshot, stamp } from './b6-fixture.js';

export { runScript, usageError, tmp, snapshot, stamp };

export const LANGS = ['zh', 'en', 'ja'];
export const FIELDS = ['model', 'prompt', 'steps', 'outline', 'reply', 'say'];
export const FIXTURE = path.join(FIXTURES, 'agent-tutorial');

export function oracle(source) {
    const sandbox = vm.createContext({ window: {} });
    vm.runInContext(source, sandbox, { timeout: 1000 });
    return JSON.parse(vm.runInContext('JSON.stringify(window.AGENT)', sandbox, { timeout: 1000 }));
}

export function fixtureAgent(lang) {
    return oracle(fs.readFileSync(path.join(FIXTURE, `agent-${lang}.js`), 'utf8'));
}

export function sourceWith(lang, agent, { before = '', after = '' } = {}) {
    return `/* ${lang} 測試用來源 */\n${before}window.AGENT = ${JSON.stringify(agent, null, 1)};\n${after}`;
}

export function tutorialCopy(t, edits = {}) {
    const base = tmp(t, 'site-agent-');
    const from = path.join(base, '教學 資料夾', 'tutorial');
    fs.mkdirSync(from, { recursive: true });
    for (const name of fs.readdirSync(FIXTURE)) fs.copyFileSync(path.join(FIXTURE, name), path.join(from, name));
    for (const [name, content] of Object.entries(edits)) {
        const file = path.join(from, name);
        if (content === null) fs.rmSync(file, { recursive: true, force: true });
        else fs.writeFileSync(file, content);
    }
    const out = path.join(base, '輸出 資料夾', 'data');
    return { base, from, out };
}

export function runAgentData(args, opts) {
    return runScript('agent-data.mjs', args, opts);
}
