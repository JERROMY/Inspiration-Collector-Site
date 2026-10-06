// 章節轉換的命令 scripts/chapters.mjs（目標檔 4-b2 的 B2.4、B2.5 的命令那一半；介面細則見 tests/README.md「4-b2」）。
//
// 量什麼（一律用 spawnSync(process.execPath, …) 真的跑那支命令，Windows 也跑得動；輸出寫到暫存資料夾，不碰 homepage/site/data/）：
//   B2.4 --root 指到 16 章的假專案、--out 指到暫存資料夾 → 結束碼 0，寫出 chapters.zh.json、chapters.en.json、chapters.ja.json 三個檔，
//        每個檔的內容剛好是 JSON.stringify(該語言 16 章, null, 2) ＋ 結尾換行（欄位順序 id、name、desc、start、end）。
//        --out 指到還不存在的資料夾，要自己建起來。
//        出錯（4 章的假專案、某語言時間表壞掉、缺檔）→ 結束碼 1、stderr 有訊息、一個檔都不寫：
//        暫存資料夾原本就有的舊 chapters.*.json 一個位元組都不變，也沒有多出任何檔（不留半套）。
//        缺檔時 stderr 講出缺哪個檔（timetable-en.txt；chapters.js 要帶路徑 tutorial/chapters.js，免得 lib/chapters.js 的堆疊混過去）。
//        不給 --root 時，預設的專案根目錄從 scripts/chapters.mjs 的位置往上三層算，跟從哪個資料夾叫無關
//        （從暫存資料夾叫它：那個根目錄有 tutorial/preview/timetable-zh.txt 的話要成功；沒有的話要講出缺哪個檔）。
//   預設的 --out（homepage/site/data/）這裡不量：一跑就會寫進專案。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "命令"
//   node --test tests/chapters-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { PROJECT, SMALL, LANGS, expected, replaceLine } from './chapters-fixture.js';

const SCRIPT = path.join(SITE, 'scripts', 'chapters.mjs');
const OUT_FILES = LANGS.map((lang) => `chapters.${lang}.json`);

function run(args, cwd = SITE) {
    if (!fs.existsSync(SCRIPT)) assert.fail('缺 scripts/chapters.mjs（後端之後實作）');
    const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 30000 });
    assert.equal(res.error, undefined, `跑不起來：${res.error && res.error.message}`);
    return res;
}

function tmp(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-chapters-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

// 把假專案整份複製到暫存資料夾，好改壞它
function copyProject(t, from = PROJECT) {
    const root = path.join(tmp(t), 'project');
    fs.cpSync(from, root, { recursive: true });
    return root;
}

function snapshot(dir) {
    const out = {};
    for (const name of fs.readdirSync(dir).sort()) out[name] = fs.readFileSync(path.join(dir, name), 'utf8');
    return out;
}

// 出錯時：結束碼 1、stderr 有字、out 裡的東西跟跑之前一模一樣
function expectFailNoWrite(res, out, before, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stderr：${res.stderr}`);
    assert.ok(res.stderr.trim().length > 0, `${label}：stderr 要講出錯在哪裡`);
    assert.deepEqual(snapshot(out), before, `${label}：出錯時一個檔都不能寫（舊檔不變、不多出檔）`);
}

const OLD = '[\n  "舊的，不能被動到"\n]\n';
function outWithOldFiles(t) {
    const out = tmp(t);
    for (const name of OUT_FILES) fs.writeFileSync(path.join(out, name), OLD);
    return out;
}

test('B2.4 命令：--root 假專案、--out 暫存資料夾 → 寫出三個檔，內容剛好是 2 空格縮排的 JSON＋結尾換行', (t) => {
    const out = tmp(t);
    const res = run(['--root', PROJECT, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out).sort(), [...OUT_FILES].sort(), '剛好三個檔');
    for (const lang of LANGS) {
        const text = fs.readFileSync(path.join(out, `chapters.${lang}.json`), 'utf8');
        assert.equal(text, JSON.stringify(expected(PROJECT, lang), null, 2) + '\n', `chapters.${lang}.json 的內容`);
    }
});

test('B2.4 命令：成功時覆蓋舊檔', (t) => {
    const out = outWithOldFiles(t);
    const res = run(['--root', PROJECT, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    for (const lang of LANGS) {
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, `chapters.${lang}.json`), 'utf8')), expected(PROJECT, lang));
    }
});

test('B2.4 命令：--out 指到還不存在的資料夾要自己建', (t) => {
    const out = path.join(tmp(t), 'a', 'data');
    const res = run(['--root', PROJECT, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out).sort(), [...OUT_FILES].sort());
});

test('B2.4 命令：出錯（4 章的假專案）→ 結束碼 1、不寫任何檔', (t) => {
    const out = outWithOldFiles(t);
    const before = snapshot(out);
    expectFailNoWrite(run(['--root', SMALL, '--out', out]), out, before, '4 章');
});

test('B2.4 命令：只有日文時間表壞掉 → 中文、英文也不寫（不留半套）', (t) => {
    const root = copyProject(t);
    const file = path.join(root, 'tutorial', 'preview', 'timetable-ja.txt');
    fs.writeFileSync(file, replaceLine(fs.readFileSync(file, 'utf8'), '1:52 05 画像保存', '1:53 05 画像保存'));
    const out = outWithOldFiles(t);
    const before = snapshot(out);
    expectFailNoWrite(run(['--root', root, '--out', out]), out, before, '日文第 5 章晚一秒');
});

test('B2.4 命令：出錯時空的 --out 資料夾還是空的', (t) => {
    const out = tmp(t);
    expectFailNoWrite(run(['--root', SMALL, '--out', out]), out, {}, '4 章、空資料夾');
});

test('B2.4 命令：缺時間表 → 結束碼 1、講出缺哪個檔、不寫任何檔', (t) => {
    const root = copyProject(t);
    fs.rmSync(path.join(root, 'tutorial', 'preview', 'timetable-en.txt'));
    const out = outWithOldFiles(t);
    const before = snapshot(out);
    const res = run(['--root', root, '--out', out]);
    expectFailNoWrite(res, out, before, '缺 timetable-en.txt');
    assert.match(res.stderr, /timetable-en\.txt/, `stderr 要講出缺 timetable-en.txt，得到：${res.stderr}`);
});

test('B2.4 命令：缺 chapters.js → 結束碼 1、講出缺哪個檔、不寫任何檔', (t) => {
    const root = copyProject(t);
    fs.rmSync(path.join(root, 'tutorial', 'chapters.js'));
    const out = outWithOldFiles(t);
    const before = snapshot(out);
    const res = run(['--root', root, '--out', out]);
    expectFailNoWrite(res, out, before, '缺 chapters.js');
    assert.match(res.stderr, /tutorial[\\/]chapters\.js/, `stderr 要講出缺 tutorial/chapters.js（路徑），得到：${res.stderr}`);
});

test('B2.4 命令：不給 --root 時，專案根目錄從檔案位置往上三層算（跟從哪裡叫無關）', (t) => {
    const root = path.resolve(SITE, '..', '..');
    const out = tmp(t);
    const res = run(['--out', out], tmp(t));
    if (fs.existsSync(path.join(root, 'tutorial', 'preview', 'timetable-zh.txt'))) {
        assert.equal(res.status, 0, `${root} 有時間表，要成功；stderr：${res.stderr}`);
        assert.deepEqual(fs.readdirSync(out).sort(), [...OUT_FILES].sort());
    } else {
        assert.equal(res.status, 1, `${root} 沒有時間表，結束碼要是 1；stderr：${res.stderr}`);
        assert.match(res.stderr, /timetable-(zh|en|ja)\.txt|tutorial[\\/]chapters\.js/, `要講出缺哪個檔，得到：${res.stderr}`);
        assert.deepEqual(fs.readdirSync(out), [], '不寫任何檔');
    }
});
