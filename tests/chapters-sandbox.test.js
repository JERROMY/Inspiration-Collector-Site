// loadChaptersScript 的沙箱：取值的時候卡住也要逾時（目標檔 4-b2 的 B2.4，檢查員第 1 輪第 1 項；介面細則見 tests/README.md「4-b2」第 16 條）。
//
// 量什麼：chapters.js 跑完之後，「把 window.TUTORIAL_CHAPTERS 拿出來」這一步也可能卡死 ——
//   ① TUTORIAL_CHAPTERS 本身是 getter、② 它是 Proxy、③ 裡面某一層（zh.list）是 getter，三種都在取值時跑無限迴圈。
//   每一種都要在 5 秒內丟 Error，訊息有「逾時」或 timed out（做法是在沙箱裡、同樣設逾時，用 JSON.stringify 轉成文字再拿出來）。
// 卡死的實作會把整支測試掛住，所以每一條都在子程序裡跑：子程序 10 秒沒結束就被殺掉，那一條紅在「卡死」，其他條照跑。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "沙箱取值"
//   node --test tests/chapters-sandbox.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { lib, SITE } from './helpers.js';

const need = await lib('chapters.js', ['loadChaptersScript']);
const LIB_URL = pathToFileURL(path.join(SITE, 'lib', 'chapters.js')).href;
const HARD_KILL_MS = 10000;

// 子程序：載入 lib/chapters.js、跑一次 loadChaptersScript，把「有沒有丟、訊息、花多久」印成 JSON
const CHILD = `
const { loadChaptersScript } = await import(process.env.LIB_URL);
const t0 = Date.now();
let out;
try {
    loadChaptersScript(process.env.SRC);
    out = { threw: false };
} catch (err) {
    out = { threw: true, message: String(err && err.message) };
}
out.ms = Date.now() - t0;
process.stdout.write(JSON.stringify(out));
`;

function runInChild(source) {
    need();
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], {
        env: { ...process.env, LIB_URL, SRC: source },
        encoding: 'utf8',
        timeout: HARD_KILL_MS,
        killSignal: 'SIGKILL',
    });
    if (res.error?.code === 'ETIMEDOUT' || res.signal) {
        assert.fail(`卡死：${HARD_KILL_MS / 1000} 秒還沒結束，子程序被殺掉（取值這一步沒有逾時）`);
    }
    assert.equal(res.status, 0, `子程序出錯：${res.stderr}`);
    return JSON.parse(res.stdout);
}

const CASES = [
    ['TUTORIAL_CHAPTERS 本身是 getter', 'Object.defineProperty(window, "TUTORIAL_CHAPTERS", { get() { while (true) {} } });'],
    ['TUTORIAL_CHAPTERS 是 Proxy', 'window.TUTORIAL_CHAPTERS = new Proxy({}, { get() { while (true) {} } });'],
    ['zh.list 是 getter', 'window.TUTORIAL_CHAPTERS = { zh: { get list() { while (true) {} } } };'],
];

for (const [label, source] of CASES) {
    test(`B2.4 沙箱取值：${label}，取值時無限迴圈也要 5 秒內丟逾時 Error`, () => {
        const out = runInChild(source);
        assert.equal(out.threw, true, `${label}：要丟 Error，結果沒丟`);
        assert.match(out.message, /逾時|timed? ?out/i, `${label}：訊息要講逾時，得到「${out.message}」`);
        assert.ok(out.ms < 5000, `${label}：要在 5 秒內逾時，花了 ${out.ms} ms`);
    });
}
