// F1.10 與 F3.1：用截圖工具（GPTPlugins 的 clipper/scripts/shots）把 out/ 當網站根目錄，拍三語 × 十二種寬度，驗收要過。
//
// 做法：把 clipper/（不含 node_modules）複製到系統暫存資料夾、node_modules 連到找得到的那一份（有 @playwright/test 的），
//       在那裡跑 `node scripts/shots/run.mjs --site <out 的絕對路徑> --page "/{lang}/" --widths all`，再跑 `node scripts/shots/verify.mjs`。
//       不在專案裡跑：截圖工具每次會清掉專案根目錄的 shots/now/（別人剛拍好要看的那一份）。
// node_modules 找哪一份：環境變數 SHOTS_TEST_NODE_MODULES → 這個工作資料夾的 clipper/node_modules → git 主資料夾的 clipper/node_modules。都沒有就 skip 並寫原因。
// 搬進公開 repo 之後沒有 clipper/，整支 skip。
//
// 量什麼：
//   F1.10 拍：結束碼 0；三語 × 十二種寬度的單張都在（shots/now/page/site/<語言>/<寬度>.png）。
//   F1.10、F3.1 驗收：verify.mjs 結束碼 0 —— 包含「任何一種寬度橫捲就不過」（P6）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "截圖工具"      約兩分鐘
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, OUT, LANGS, needOut, clipperModules, tail } from './helpers.js';
import { WIDTHS } from './page-helpers.js';

const CLIPPER = path.join(SITE, '..', '..', 'clipper');
const hasPlaywright = (dir) => Boolean(dir) && fs.existsSync(path.join(dir, '@playwright', 'test', 'package.json'));
const MODULES = [process.env.SHOTS_TEST_NODE_MODULES, ...clipperModules()].find(hasPlaywright) ?? null;
const SKIP = !fs.existsSync(path.join(CLIPPER, 'scripts', 'shots', 'run.mjs'))
    ? '這裡沒有 clipper/scripts/shots（搬進公開 repo 之後）：截圖要在 GPTPlugins 裡跑'
    : MODULES ? false : '找不到有 @playwright/test 的 node_modules：設 SHOTS_TEST_NODE_MODULES，或在 GPTPlugins 的 clipper/ 跑 npm install';

let project = null;
after(() => { if (project) fs.rmSync(project, { recursive: true, force: true }); });

function run(script, args) {
    return spawnSync(process.execPath, [path.join('scripts', 'shots', script), ...args], {
        cwd: path.join(project, 'clipper'),
        encoding: 'utf8',
        timeout: 15 * 60 * 1000,
        env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('SHOTS_') && k !== 'E2E_HEADED')), TMPDIR: project, TMP: project, TEMP: project },
    });
}

test('F1.10 F3.1 截圖工具拍 out/（--site、三語 × 十二種寬度）：結束碼 0、張數對、驗收通過（含不橫捲）', { skip: SKIP, timeout: 20 * 60 * 1000 }, () => {
    needOut();
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-site-shots-'));
    fs.cpSync(CLIPPER, path.join(project, 'clipper'), {
        recursive: true,
        filter: (src) => !['node_modules', 'test-results', 'playwright-report'].includes(path.relative(CLIPPER, src).split(path.sep)[0]),
    });
    fs.symlinkSync(MODULES, path.join(project, 'clipper', 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const shot = run('run.mjs', ['--site', path.resolve(OUT), '--page', '/{lang}/', '--widths', 'all']);
    assert.equal(shot.status, 0, `截圖工具結束碼要是 0：\n${tail(`${shot.stdout}\n${shot.stderr}`, 40)}`);
    const dir = path.join(project, 'shots', 'now', 'page', 'site');
    const missing = LANGS.flatMap((lang) => WIDTHS.map((w) => `${lang}/${w}.png`)).filter((rel) => !fs.existsSync(path.join(dir, ...rel.split('/'))));
    assert.deepEqual(missing, [], '少了這幾張');
    const check = run('verify.mjs', []);
    assert.equal(check.status, 0, `驗收（verify.mjs）要過 —— 包含任何一種寬度都不能橫捲：\n${tail(`${check.stdout}\n${check.stderr}`, 40)}`);
});
