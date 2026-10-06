// 素材處理的命令 scripts/media.mjs（目標檔 4-b3 的 B3.3 的命令那一半；介面細則見 tests/README.md「4-b3」）。
//
// 量什麼（一律用 spawnSync(process.execPath, [scripts/media.mjs, …]) 真的跑那支命令；輸出寫到暫存資料夾，不碰 public/media/）：
//   B3.3 用法錯誤（不認得的參數、--out／--ffmpeg／--max-video-mb 缺值）→ 結束碼 2、stderr 有字、--out 不動，而且在碰工具之前就停（FFMPEG 指到不存在的檔也是 2）。
//   B3.3 空字串當用法錯誤（--out=、--root=、--ffmpeg=、--cwebp=：不靜靜退回預設或環境變數），
//        --max-video-mb 不是正的有限數（0、=-1、-1、abc、=、Infinity）也是用法錯誤：結束碼 2、中文訊息、--out 不動、從暫存資料夾叫它 → 那裡跑完還是空的。
//        「中文訊息」看的是 stderr 第一行：要有中文、不能是 Node parseArgs 的英文原文（Unknown option、argument missing、ambiguous、Unexpected argument）；
//        不認得的參數、多出來的位置參數、缺值也各量一次。
//   B3.3 工具開不起來（--ffmpeg 指到不存在的檔）→ 結束碼 1、stderr「ffmpeg 跑不起來」＋那個路徑、--out 的舊檔一個位元組都不變、
//        系統暫存資料夾（子程序的 TMPDIR／TEMP／TMP）是空的。
//        找不到程式時訊息有「找不到」（白話，不是只有 ENOENT 原文）。
//        環境變數 FFMPEG＝空字串當作沒設（退回 PATH）；命令列的 --ffmpeg= 空字串才是用法錯誤。
//        工具路徑的來源：--ffmpeg 優先，其次環境變數 FFMPEG，都沒有才用 PATH 裡的 ffmpeg（PATH 指到空資料夾 → 一樣講「ffmpeg 跑不起來」）。
//   B3.3 缺原檔（--root 指到沒有 release/ 的資料夾）→ 結束碼 1、stderr 講出缺哪個檔、--out 不動。
//   B3.3 不給 --root 時，專案根目錄從 scripts/media.mjs 的位置往上三層算（從暫存資料夾叫它）：
//        那裡有 release/ 的六個原檔 → 過了缺檔檢查、停在「ffmpeg 跑不起來」（工具指到不存在的檔）；沒有 → 講缺哪個檔。
//   成功那條路要能跑起來的 ffmpeg 與 cwebp：這裡不量（runMedia 用假工具量過；真工具見 media-real.test.js）。預設的 --out 不量（一跑就寫進專案）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B3.3 命令"
//   node --test tests/media-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { tmp, makeProject, snapshot } from './media-fixture.js';

const SCRIPT = path.join(SITE, 'scripts', 'media.mjs');

// env：疊在 process.env 上；值是 undefined 的鍵會被拿掉。PATH 在 Windows 叫 Path（不分大小寫），一律先拿掉同名的再設
function run(args, { cwd = SITE, env = {} } = {}) {
    if (!fs.existsSync(SCRIPT)) assert.fail('缺 scripts/media.mjs（後端之後實作）');
    const merged = { ...process.env };
    for (const key of Object.keys(env)) {
        for (const have of Object.keys(merged)) if (have.toLowerCase() === key.toLowerCase()) delete merged[have];
        if (env[key] !== undefined) merged[key] = env[key];
    }
    const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: merged, encoding: 'utf8', timeout: 60000 });
    assert.equal(res.error, undefined, `跑不起來：${res.error && res.error.message}`);
    return res;
}

function outWithOld(t) {
    const out = tmp(t, 'site-media-out-');
    fs.writeFileSync(path.join(out, 'hero-zh.mp4'), 'OLD zh video');
    fs.writeFileSync(path.join(out, 'media.json'), '{\n  "old": true\n}\n');
    return out;
}

// 子程序的系統暫存資料夾：三個環境變數都指到同一個空資料夾
function sysTmpEnv(t) {
    const dir = tmp(t, 'site-media-systmp-');
    return { dir, env: { TMPDIR: dir, TEMP: dir, TMP: dir } };
}

const NO_TOOLS = { FFMPEG: undefined, CWEBP: undefined };

for (const [label, args] of [
    ['不認得的參數 --bogus', ['--bogus']],
    ['--out 缺值', ['--out']],
    ['--ffmpeg 缺值', ['--ffmpeg']],
    ['--max-video-mb 缺值', ['--max-video-mb']],
]) {
    test(`B3.3 命令：用法錯誤（${label}）→ 結束碼 2、stderr 有字、不碰工具也不動 --out`, (t) => {
        const out = outWithOld(t);
        const before = snapshot(out);
        const missing = path.join(tmp(t), 'no-such-ffmpeg');
        const res = run(['--root', makeProject(t), '--out', out, ...args], { env: { FFMPEG: missing } });
        assert.equal(res.status, 2, `結束碼要是 2（用法錯誤），得到 ${res.status}；stderr：${res.stderr}`);
        assert.ok(res.stderr.trim().length > 0, 'stderr 要講哪裡用錯');
        assert.doesNotMatch(res.stderr, /跑不起來/, '用法錯誤要在碰工具之前就停');
        assert.deepEqual(snapshot(out), before, '--out 不動');
    });
}

// 用法錯誤的共同檢查：從空的暫存資料夾叫它，跑完 cwd 還是空的、--out 不變、結束碼 2、stderr 是中文
function expectUsageError(t, args, label) {
    const out = outWithOld(t);
    const before = snapshot(out);
    const cwd = tmp(t, 'site-media-cwd-');
    const missing = path.join(tmp(t), 'no-such-ffmpeg');
    const full = args.map((arg) => (arg === '<root>' ? makeProject(t) : arg === '<out>' ? out : arg));
    const res = run(full, { cwd, env: { FFMPEG: missing, CWEBP: missing } });
    assert.equal(res.status, 2, `${label}：結束碼要是 2（用法錯誤），得到 ${res.status}；stderr：${res.stderr}`);
    // 只看第一行：後面接的「用法：…」永遠是中文，看整段的話 Node 的英文原文混在前面也擋不到
    const first = res.stderr.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(first, /Unknown option|argument|ambiguous|missing|Unexpected|positional|ERR_PARSE_ARGS/i,
        `${label}：stderr 第一行不能是 Node parseArgs 的英文原文（要翻成白話），得到：${first}`);
    assert.doesNotMatch(res.stderr, /跑不起來/, `${label}：用法錯誤要在碰工具之前就停`);
    assert.deepEqual(snapshot(out), before, `${label}：--out 不動`);
    assert.deepEqual(fs.readdirSync(cwd), [], `${label}：跑完 cwd 不能多出任何檔`);
}

for (const [label, args] of [
    ['--out=（空字串）', ['--root', '<root>', '--out=']],
    ['--root=（空字串）', ['--root=', '--out', '<out>']],
    ['--ffmpeg=（空字串，不退回環境變數 FFMPEG）', ['--root', '<root>', '--out', '<out>', '--ffmpeg=']],
    ['--cwebp=（空字串，不退回環境變數 CWEBP）', ['--root', '<root>', '--out', '<out>', '--cwebp=']],
    ['--max-video-mb 0', ['--root', '<root>', '--out', '<out>', '--max-video-mb', '0']],
    ['--max-video-mb=-1', ['--root', '<root>', '--out', '<out>', '--max-video-mb=-1']],
    ['--max-video-mb abc', ['--root', '<root>', '--out', '<out>', '--max-video-mb', 'abc']],
    ['--max-video-mb=（空字串）', ['--root', '<root>', '--out', '<out>', '--max-video-mb=']],
    ['--max-video-mb Infinity', ['--root', '<root>', '--out', '<out>', '--max-video-mb', 'Infinity']],
    ['--max-video-mb -1（空白隔開）', ['--root', '<root>', '--out', '<out>', '--max-video-mb', '-1']],
    ['不認得的參數 --bogus（中文訊息）', ['--root', '<root>', '--out', '<out>', '--bogus']],
    ['多出來的位置參數 extra', ['--root', '<root>', '--out', '<out>', 'extra']],
    ['--out 缺值（中文訊息）', ['--root', '<root>', '--out']],
]) {
    test(`B3.3 命令：用法錯誤（${label}）→ 結束碼 2、中文訊息、不寫任何檔、cwd 沒多東西`, (t) => {
        expectUsageError(t, args, label);
    });
}

test('B3.3 命令：--ffmpeg 指到不存在的檔 → 結束碼 1、「ffmpeg 跑不起來」＋路徑、--out 舊檔不變、暫存資料夾是空的', (t) => {
    const out = outWithOld(t);
    const before = snapshot(out);
    const { dir, env } = sysTmpEnv(t);
    const missing = path.join(tmp(t), 'arg-ffmpeg');
    const res = run(['--root', makeProject(t), '--out', out, '--ffmpeg', missing, '--cwebp', missing], { env: { ...env, ...NO_TOOLS } });
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；stderr：${res.stderr}`);
    assert.match(res.stderr, /ffmpeg 跑不起來/, `stderr 要講「ffmpeg 跑不起來」，得到：${res.stderr}`);
    assert.ok(res.stderr.includes('arg-ffmpeg'), `stderr 要講出試的是哪個路徑（arg-ffmpeg），得到：${res.stderr}`);
    assert.match(res.stderr, /找不到/, `找不到程式要講「找不到」，得到：${res.stderr}`);
    assert.deepEqual(snapshot(out), before, '--out 的舊檔一個位元組都不變');
    assert.deepEqual(fs.readdirSync(dir), [], '暫存資料夾是空的');
});

test('B3.3 命令：沒給 --ffmpeg 時用環境變數 FFMPEG；兩個都給時 --ffmpeg 優先', (t) => {
    const root = makeProject(t);
    const envPath = path.join(tmp(t), 'env-ffmpeg');
    const argPath = path.join(tmp(t), 'arg-ffmpeg');
    const fromEnv = run(['--root', root, '--out', tmp(t)], { env: { FFMPEG: envPath, CWEBP: envPath } });
    assert.equal(fromEnv.status, 1, `結束碼要是 1；stderr：${fromEnv.stderr}`);
    assert.ok(fromEnv.stderr.includes('env-ffmpeg'), `沒給 --ffmpeg：要用 FFMPEG 的 env-ffmpeg，得到：${fromEnv.stderr}`);
    const both = run(['--root', root, '--out', tmp(t), '--ffmpeg', argPath], { env: { FFMPEG: envPath, CWEBP: envPath } });
    assert.equal(both.status, 1, `結束碼要是 1；stderr：${both.stderr}`);
    assert.ok(both.stderr.includes('arg-ffmpeg') && !both.stderr.includes('env-ffmpeg'), `兩個都給：用 --ffmpeg 的 arg-ffmpeg，得到：${both.stderr}`);
});

test('B3.3 命令：環境變數 FFMPEG、CWEBP 是空字串 → 當作沒設、退回 PATH 的 ffmpeg（PATH 指到空資料夾 → 「ffmpeg 跑不起來」「找不到」，不是 Node 的英文錯誤）', (t) => {
    const out = outWithOld(t);
    const before = snapshot(out);
    const res = run(['--root', makeProject(t), '--out', out], { env: { FFMPEG: '', CWEBP: '', PATH: tmp(t) } });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.doesNotMatch(res.stderr, /cannot be empty|The argument/, `空的環境變數不能被當成工具路徑，得到：${res.stderr}`);
    assert.match(res.stderr, /ffmpeg 跑不起來/, `要退回 PATH 的 ffmpeg 再講「ffmpeg 跑不起來」，得到：${res.stderr}`);
    assert.match(res.stderr, /找不到/, `得到：${res.stderr}`);
    assert.deepEqual(snapshot(out), before, '--out 不動');
});

test('B3.3 命令：都沒給時用 PATH 裡的 ffmpeg（PATH 指到空資料夾 → 「ffmpeg 跑不起來」）', (t) => {
    const res = run(['--root', makeProject(t), '--out', tmp(t)], { env: { ...NO_TOOLS, PATH: tmp(t) } });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.match(res.stderr, /ffmpeg 跑不起來/, `得到：${res.stderr}`);
});

test('B3.3 命令：缺原檔 → 結束碼 1、講出缺哪個檔、--out 不動', (t) => {
    const out = outWithOld(t);
    const before = snapshot(out);
    const empty = tmp(t);
    const res = run(['--root', empty, '--out', out, '--ffmpeg', path.join(empty, 'no-ffmpeg'), '--cwebp', path.join(empty, 'no-cwebp')]);
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.match(res.stderr, /demo-dust-1920x1080-(zh|en|ja)\.mp4|demo-dust-poster-(zh|en|ja)\.png/, `要講出缺哪個原檔，得到：${res.stderr}`);
    assert.deepEqual(snapshot(out), before, '--out 不動');
});

test('B3.3 命令：不給 --root 時，專案根目錄從檔案位置往上三層算（跟從哪裡叫無關）', (t) => {
    const root = path.resolve(SITE, '..', '..');
    const out = tmp(t);
    const missing = path.join(tmp(t), 'no-ffmpeg');
    const res = run(['--out', out, '--ffmpeg', missing, '--cwebp', missing], { cwd: tmp(t) });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    const names = ['zh', 'en', 'ja'].flatMap((lang) => [`demo-dust-1920x1080-${lang}.mp4`, `demo-dust-poster-${lang}.png`]);
    if (names.every((name) => fs.existsSync(path.join(root, 'release', name)))) {
        assert.match(res.stderr, /ffmpeg 跑不起來/, `${root}/release/ 原檔都在：要過缺檔檢查、停在工具，得到：${res.stderr}`);
    } else {
        assert.match(res.stderr, /demo-dust-1920x1080-(zh|en|ja)\.mp4|demo-dust-poster-(zh|en|ja)\.png/, `${root}/release/ 缺原檔：要講缺哪個，得到：${res.stderr}`);
    }
    assert.deepEqual(fs.readdirSync(out), [], '不寫任何檔');
});
