// 素材處理的流程 lib/media-run.js 的 runMedia（目標檔 4-b3 的 B3.1～B3.3；介面細則見 tests/README.md「4-b3」）。
//
// 怎麼量：runMedia({ root, out, langs, ffmpeg, cwebp, maxVideoMb, run }) 的 run 是注入的 ——
//   測試給的 run 是 spawnSync(process.execPath, [工具, …參數])，ffmpeg／cwebp 傳 tests/fixtures/fake-tools/ 的假工具腳本路徑，
//   壞法用環境變數控制（寫在假工具檔頭）。真的子程序、真的結束碼與 stderr，Windows 也跑得動；程式裡不必為了測試開後門。
//   專案根目錄是暫存資料夾裡的假專案（media-fixture.js 的 makeProject）；系統暫存資料夾（TMPDIR／TEMP／TMP）
//   指到每條測試自己的空資料夾，量「暫存放那裡、用完清掉」。
//
// 量什麼：
//   B3.1／B3.2 成功：輸出資料夾剛好是三支 hero-<語言>.mp4（沒有音軌、長度 63.00、1920x1080）、三張 hero-poster-<語言>.webp
//        （WebP、1920x1080、比原 PNG 小）、media.json（JSON.stringify(…, null, 2)＋結尾換行，寬高與位元組數是量出來的）；
//        轉檔的參數就是 ffmpegArgs／cwebpArgs 給的，工具只寫進系統暫存資料夾、而且輸出有被重新量過（-i 輸出）。
//   B3.3 原檔與專案根目錄一個位元組都不變、不多出檔；暫存資料夾用完是空的；--out 不存在會自己建；舊檔被覆蓋；重跑兩次位元組相同。
//   B3.3 出錯（工具跑不起來、缺輸入檔、影片或海報驗證沒過、工具結束碼不是 0、工具沒寫出檔）：
//        reject 一個 Error、訊息講出是什麼（下面每條寫了要講到的字）、輸出資料夾的舊檔一個位元組都不變、暫存資料夾是空的。
//        壞法只套在 ja（最後一個語言）：前面的語言都過了也不准先搬進去。
//   B3.1 大小上限的 MB 是 1024×1024 位元組（上限 1：1040000 位元組要過、1100000 要擋）；擋下來的訊息講出實際大小與上限。
//   B3.3 放進 --out 才失敗（--out 是檔案、唯讀資料夾、hero-ja.mp4 的位置是資料夾）：中文訊息有「放進」、--out 的路徑、白話原因；
//        --out 一個位元組都不變（改名之前先查每個目標名字都不是資料夾 —— 不會半新半舊）、沒有 .partial、暫存清掉。
//        唯讀時訊息附的是 --out 底下寫不進去的目的地，不是暫存資料夾裡的來源檔。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B3"
//   node --test tests/media-run.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib } from './helpers.js';
import {
    LANGS, FAKE_FFMPEG, FAKE_CWEBP, POSTER_BYTES,
    tmp, makeProject, fakeRun, snapshot, systemTmp, readLog, inside,
} from './media-fixture.js';

const needRun = await lib('media-run.js', ['runMedia']);
const needMedia = await lib('media.js', ['ffmpegArgs', 'cwebpArgs']);

const OLD = {
    'hero-zh.mp4': 'OLD zh video',
    'hero-ja.mp4': 'OLD ja video',
    'hero-poster-zh.webp': 'OLD zh poster',
    'hero-poster-ja.webp': 'OLD ja poster',
    'media.json': '{\n  "old": true\n}\n',
};

function outWithOld(t) {
    const out = tmp(t, 'site-media-out-');
    for (const [name, text] of Object.entries(OLD)) fs.writeFileSync(path.join(out, name), text);
    return out;
}

// 跑一次 runMedia；回傳 { error（沒出錯是 null）, log（假工具的呼叫紀錄）}
async function go(t, { root, out, langs = LANGS, env = {}, maxVideoMb = 4, ffmpeg = FAKE_FFMPEG, cwebp = FAKE_CWEBP, run } = {}) {
    const { runMedia } = needRun();
    const log = path.join(tmp(t, 'site-media-log-'), 'calls.jsonl');
    const opts = { root, out, langs, ffmpeg, cwebp, maxVideoMb, run: run ?? fakeRun({ ...env, FAKE_LOG: log }) };
    let error = null;
    try {
        await runMedia(opts);
    } catch (err) {
        error = err;
    }
    return { error, log: readLog(log) };
}

function fakeOut(file) {
    const text = fs.readFileSync(file, 'utf8');
    return JSON.parse(text);
}

// 我們自己讀 WebP（無損 VP8L、有損 VP8）的寬高，不靠被測的 readImageSize
function webpSize(buf) {
    assert.equal(buf.toString('latin1', 0, 4), 'RIFF', '要是 RIFF');
    assert.equal(buf.toString('latin1', 8, 12), 'WEBP', '要是 WEBP');
    if (buf.toString('latin1', 12, 16) === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
}

// ---------------- 成功 ----------------

test('B3.1 B3.2 runMedia 成功：輸出剛好三支影片（沒音軌、長度、解析度不變）、三張 WebP（同寬高、比 PNG 小）、media.json', async (t) => {
    const root = makeProject(t);
    const out = path.join(tmp(t, 'site-media-out-'), 'public', 'media');
    systemTmp(t);
    const { error } = await go(t, { root, out });
    assert.equal(error, null, `不該出錯：${error && error.message}`);

    const names = [...LANGS.flatMap((lang) => [`hero-${lang}.mp4`, `hero-poster-${lang}.webp`]), 'media.json'].sort();
    assert.deepEqual(fs.readdirSync(out).sort(), names, '--out 不存在要自己建；裡面剛好這七個檔');

    const expected = {};
    for (const lang of LANGS) {
        const video = fakeOut(path.join(out, `hero-${lang}.mp4`));
        assert.equal(video.audio, false, `hero-${lang}.mp4 不能有音軌`);
        assert.equal(video.durationSec, 63, `hero-${lang}.mp4 長度（假 ffmpeg 去音軌後 63.00）`);
        assert.deepEqual([video.width, video.height], [1920, 1080], `hero-${lang}.mp4 解析度不變`);
        const poster = fs.readFileSync(path.join(out, `hero-poster-${lang}.webp`));
        assert.deepEqual(webpSize(poster), { width: 1920, height: 1080 }, `hero-poster-${lang}.webp 寬高跟原 PNG 一樣`);
        assert.ok(poster.length < POSTER_BYTES[lang], `hero-poster-${lang}.webp 要比原 PNG 小`);
        expected[lang] = {
            video: { file: `hero-${lang}.mp4`, bytes: fs.statSync(path.join(out, `hero-${lang}.mp4`)).size, durationSec: 63, width: 1920, height: 1080 },
            poster: { file: `hero-poster-${lang}.webp`, bytes: poster.length, width: 1920, height: 1080 },
        };
    }
    assert.equal(fs.readFileSync(path.join(out, 'media.json'), 'utf8'), JSON.stringify(expected, null, 2) + '\n',
        'media.json 逐字相同（2 空格縮排、結尾換行；durationSec 是輸出影片量到的、bytes 是輸出檔的大小）');
});

test('B3.3 runMedia 成功：轉檔參數來自 ffmpegArgs／cwebpArgs、工具只寫進系統暫存資料夾、輸出有重新量過', async (t) => {
    const root = makeProject(t);
    const out = tmp(t, 'site-media-out-');
    const sys = systemTmp(t);
    const { error, log } = await go(t, { root, out });
    assert.equal(error, null, `不該出錯：${error && error.message}`);
    const { ffmpegArgs, cwebpArgs } = needMedia();

    assert.ok(log.some((c) => c.tool === 'ffmpeg' && c.args.includes('-version')), '要先跑 ffmpeg -version');
    assert.ok(log.some((c) => c.tool === 'cwebp' && c.args.includes('-version')), '要先跑 cwebp -version');

    for (const lang of LANGS) {
        const videoIn = path.join(root, 'release', `demo-dust-1920x1080-${lang}.mp4`);
        const posterIn = path.join(root, 'release', `demo-dust-poster-${lang}.png`);
        const conv = log.filter((c) => c.tool === 'ffmpeg' && c.args.includes(videoIn) && c.args[c.args.length - 1] !== videoIn);
        assert.equal(conv.length, 1, `${lang}：影片要剛好轉一次，得到 ${JSON.stringify(conv)}`);
        const tmpVideo = conv[0].args[conv[0].args.length - 1];
        assert.deepEqual(conv[0].args, ffmpegArgs(videoIn, tmpVideo), `${lang}：ffmpeg 的參數就是 ffmpegArgs(輸入, 暫存輸出)`);
        assert.ok(inside(tmpVideo, sys), `${lang}：影片先寫到系統暫存資料夾，得到 ${tmpVideo}`);
        assert.ok(log.some((c) => c.tool === 'ffmpeg' && c.args[c.args.length - 1] === tmpVideo && c.args[c.args.length - 2] === '-i'),
            `${lang}：寫出來的影片要再用 ffmpeg -i 量一次（驗證沒音軌、長度、解析度）`);

        const webp = log.filter((c) => c.tool === 'cwebp' && c.args.includes(posterIn));
        assert.equal(webp.length, 1, `${lang}：海報要剛好轉一次`);
        const tmpPoster = webp[0].args[webp[0].args.indexOf('-o') + 1];
        assert.deepEqual(webp[0].args, cwebpArgs(posterIn, tmpPoster), `${lang}：cwebp 的參數就是 cwebpArgs(輸入, 暫存輸出)`);
        assert.ok(inside(tmpPoster, sys), `${lang}：海報先寫到系統暫存資料夾，得到 ${tmpPoster}`);
    }
    assert.deepEqual(fs.readdirSync(sys), [], '成功之後暫存資料夾要清掉');
});

test('B3.3 runMedia 成功：原檔與專案根目錄一個位元組都不變、不多出檔', async (t) => {
    const root = makeProject(t);
    const before = snapshot(root);
    systemTmp(t);
    const { error } = await go(t, { root, out: tmp(t, 'site-media-out-') });
    assert.equal(error, null, `不該出錯：${error && error.message}`);
    assert.deepEqual(snapshot(root), before, '專案根目錄（含 release/ 的原檔）完全不變');
});

test('B3.3 runMedia 成功：舊的輸出被覆蓋', async (t) => {
    const root = makeProject(t);
    const out = outWithOld(t);
    systemTmp(t);
    const { error } = await go(t, { root, out });
    assert.equal(error, null, `不該出錯：${error && error.message}`);
    assert.equal(fakeOut(path.join(out, 'hero-zh.mp4')).audio, false, 'hero-zh.mp4 換成新的');
    assert.equal(fs.readFileSync(path.join(out, 'hero-poster-ja.webp')).toString('latin1', 0, 4), 'RIFF', 'hero-poster-ja.webp 換成新的');
    assert.ok(!('old' in JSON.parse(fs.readFileSync(path.join(out, 'media.json'), 'utf8'))), 'media.json 換成新的');
});

test('B3.3 runMedia 重跑兩次：輸出位元組相同（同一個資料夾重跑、換一個資料夾跑都一樣）', async (t) => {
    const root = makeProject(t);
    const out = tmp(t, 'site-media-out-');
    const other = tmp(t, 'site-media-out-');
    systemTmp(t);
    const first = await go(t, { root, out });
    assert.equal(first.error, null, `第一次不該出錯：${first.error && first.error.message}`);
    const a = snapshot(out);
    const second = await go(t, { root, out });
    assert.equal(second.error, null, `第二次不該出錯：${second.error && second.error.message}`);
    assert.deepEqual(snapshot(out), a, '同一個資料夾重跑，位元組相同');
    const third = await go(t, { root, out: other });
    assert.equal(third.error, null, `換資料夾不該出錯：${third.error && third.error.message}`);
    assert.deepEqual(snapshot(other), a, '換一個資料夾跑，位元組相同（media.json 裡沒有時間戳、絕對路徑）');
});

test('B3.1 runMedia 長度差 0.04 秒、影片剛好在上限內 → 還是算過', async (t) => {
    const root = makeProject(t, { langs: ['zh', 'ja'] });
    const out = tmp(t, 'site-media-out-');
    systemTmp(t);
    const { error } = await go(t, { root, out, langs: ['zh', 'ja'], maxVideoMb: 1, env: { FAKE_DURATION_DELTA: '0.04', FAKE_VIDEO_BYTES: '900000' } });
    assert.equal(error, null, `差 0.04 秒（< 0.05）、900000 位元組（< 1 MB）要過：${error && error.message}`);
    assert.equal(fs.statSync(path.join(out, 'hero-ja.mp4')).size, 900000);
});

test('B3.1 runMedia 大小上限的 MB 是 1024×1024 位元組：上限 1、影片 1040000 位元組 → 要過（用 1000×1000 算會被擋）', async (t) => {
    const root = makeProject(t, { langs: ['zh', 'ja'] });
    const out = tmp(t, 'site-media-out-');
    systemTmp(t);
    const { error } = await go(t, { root, out, langs: ['zh', 'ja'], maxVideoMb: 1, env: { FAKE_VIDEO_BYTES: '1040000' } });
    assert.equal(error, null, `1040000 位元組 < 1 MB（1048576）要過：${error && error.message}`);
    assert.equal(fs.statSync(path.join(out, 'hero-ja.mp4')).size, 1040000);
});

// ---------------- 出錯：輸出資料夾不動、暫存清掉 ----------------

// 出錯的共同檢查：reject Error、訊息符合 words（每個都要中）、輸出資料夾不變、暫存資料夾是空的
async function expectFail(t, { label, words, langs = ['zh', 'ja'], env = {}, maxVideoMb = 4, ffmpeg, cwebp, run, prepare }) {
    const root = makeProject(t, { langs });
    if (prepare) prepare(root);
    const out = outWithOld(t);
    const beforeOut = snapshot(out);
    const beforeRoot = snapshot(root);
    const sys = systemTmp(t);
    const { error, log } = await go(t, { root, out, langs, env, maxVideoMb, ffmpeg, cwebp, run });
    assert.ok(error instanceof Error, `${label}：runMedia 要 reject 一個 Error，結果成功了`);
    for (const word of words) assert.match(error.message, word, `${label}：訊息要講到 ${word}，得到「${error.message}」`);
    assert.deepEqual(snapshot(out), beforeOut, `${label}：輸出資料夾的舊檔一個位元組都不能動、不能多出檔`);
    assert.deepEqual(fs.readdirSync(sys), [], `${label}：暫存資料夾要清掉`);
    assert.deepEqual(snapshot(root), beforeRoot, `${label}：專案根目錄（原檔）不變`);
    return { error, log, root };
}

test('B3.3 runMedia 工具壞了：ffmpeg -version 結束碼 1 → 「ffmpeg 跑不起來：」＋原因', async (t) => {
    await expectFail(t, { label: 'ffmpeg 壞了', words: [/ffmpeg 跑不起來/, /Library not loaded/], env: { FAKE_FFMPEG: 'noversion' } });
});

test('B3.3 runMedia 工具壞了：ffmpeg 根本開不起來（spawn ENOENT）→ 「ffmpeg 跑不起來」＋「找不到」（白話，不是只有 ENOENT 原文）', async (t) => {
    const missing = path.join(path.sep, 'no', 'such', 'ffmpeg');
    const base = fakeRun();
    const run = (command, args) => (command === missing
        ? { pid: 0, status: null, signal: null, stdout: '', stderr: '', output: [null, '', ''], error: Object.assign(new Error(`spawnSync ${missing} ENOENT`), { code: 'ENOENT', errno: -2, syscall: `spawnSync ${missing}`, path: missing }) }
        : base(command, args));
    await expectFail(t, { label: 'ffmpeg 找不到', words: [/ffmpeg 跑不起來/, /找不到/], ffmpeg: missing, run });
});

test('B3.3 runMedia 工具壞了：cwebp -version 結束碼 1 → 「cwebp 跑不起來」', async (t) => {
    await expectFail(t, { label: 'cwebp 壞了', words: [/cwebp 跑不起來/, /Library not loaded/], env: { FAKE_CWEBP: 'noversion' } });
});

test('B3.3 runMedia 缺原檔：少了 demo-dust-poster-en.png → 講出缺哪個、一支工具都還沒開始轉', async (t) => {
    const { log } = await expectFail(t, {
        label: '缺海報', words: [/demo-dust-poster-en\.png/], langs: LANGS,
        prepare: (root) => fs.rmSync(path.join(root, 'release', 'demo-dust-poster-en.png')),
    });
    const conversions = log.filter((c) => !c.args.includes('-version') && !(c.tool === 'ffmpeg' && c.args[c.args.length - 2] === '-i'));
    assert.deepEqual(conversions, [], '缺檔要在轉任何一支之前就發現（先檢查輸入都在）');
});

test('B3.3 runMedia 缺原檔：少了 demo-dust-1920x1080-ja.mp4 → 講出缺哪個', async (t) => {
    await expectFail(t, {
        label: '缺影片', words: [/demo-dust-1920x1080-ja\.mp4/],
        prepare: (root) => fs.rmSync(path.join(root, 'release', 'demo-dust-1920x1080-ja.mp4')),
    });
});

test('B3.3 runMedia 缺原檔又 ffmpeg 壞了 → 先講缺檔（先查輸入檔、再查工具）', async (t) => {
    await expectFail(t, {
        label: '缺檔＋ffmpeg 壞', words: [/demo-dust-poster-ja\.png/], env: { FAKE_FFMPEG: 'noversion' },
        prepare: (root) => fs.rmSync(path.join(root, 'release', 'demo-dust-poster-ja.png')),
    });
});

const VIDEO_FAILS = [
    { label: '影片還有音軌', env: { FAKE_FFMPEG: 'keepaudio' }, words: [/音軌|audio/i] },
    { label: '長度短了 0.2 秒', env: { FAKE_DURATION_DELTA: '0.2' }, words: [/長度|秒|duration/i] },
    { label: '長度長了 0.1 秒', env: { FAKE_DURATION_DELTA: '-0.1' }, words: [/長度|秒|duration/i] },
    { label: '解析度變成 1280x720', env: { FAKE_FFMPEG: 'resize' }, words: [/解析度|寬高|尺寸|1280/] },
    // 訊息要講出實際大小（1100000 位元組，或換成 MiB 的 1.05）與上限（1 MB，或 1048576 位元組）
    { label: '超過大小上限（1100000 位元組 > 1 MB）', env: { FAKE_VIDEO_BYTES: '1100000' }, maxVideoMb: 1, words: [/上限/, /1,?100,?000|1\.05/, /(?<![\d.])1(\.0+)? ?Mi?B|1,?048,?576/] },
    { label: 'ffmpeg 轉檔結束碼 1', env: { FAKE_FFMPEG: 'fail' }, words: [/Conversion failed/] },
    { label: 'ffmpeg 結束碼 0 卻沒寫出檔', env: { FAKE_FFMPEG: 'nowrite' }, words: [] },
];

for (const c of VIDEO_FAILS) {
    test(`B3.1 runMedia 影片驗證沒過（只有 ja）：${c.label} → 出錯、講出是哪支、輸出資料夾不動、暫存清掉`, async (t) => {
        await expectFail(t, { label: c.label, words: [...c.words, /ja/], env: { ...c.env, FAKE_ONLY: 'ja' }, maxVideoMb: c.maxVideoMb });
    });
}

const POSTER_FAILS = [
    { label: 'WebP 比原 PNG 大', env: { FAKE_CWEBP: 'bigger' }, words: [/大|小|size|KB|位元組|bytes/i] },
    { label: 'WebP 寬高不同（1919x1080）', env: { FAKE_CWEBP: 'resize' }, words: [/寬高|尺寸|解析度|1919/] },
    { label: '輸出不是 WebP', env: { FAKE_CWEBP: 'notwebp' }, words: [/WebP/i] },
    { label: 'cwebp 結束碼 1', env: { FAKE_CWEBP: 'fail' }, words: [/Cannot read input picture/] },
];

for (const c of POSTER_FAILS) {
    test(`B3.2 runMedia 海報驗證沒過（只有 ja）：${c.label} → 出錯、講出是哪張、輸出資料夾不動、暫存清掉`, async (t) => {
        await expectFail(t, { label: c.label, words: [...c.words, /ja/], env: { ...c.env, FAKE_ONLY: 'ja' } });
    });
}

// ---------------- 放進 --out 失敗 ----------------
// 驗證都過了、要放進 --out 時才失敗：訊息是中文、有「放進」、有 --out 的路徑、有白話原因；--out 一個位元組都不變、沒有 .partial、暫存清掉。

function expectPublishFail(error, out, reason, label) {
    assert.ok(error instanceof Error, `${label}：runMedia 要 reject 一個 Error，結果成功了`);
    assert.match(error.message, /放進/, `${label}：訊息要有「放進」，得到「${error.message}」`);
    assert.ok(error.message.includes(out), `${label}：訊息要有 --out 的路徑 ${out}，得到「${error.message}」`);
    assert.match(error.message, reason, `${label}：訊息要講白話原因 ${reason}，得到「${error.message}」`);
}

function noPartial(dir, label) {
    const left = Object.keys(snapshot(dir) ?? {}).filter((name) => /\.partial\/?$/.test(name));
    assert.deepEqual(left, [], `${label}：不能留下 .partial`);
}

test('B3.3 runMedia 放進 --out 失敗：--out 是一個檔案 → 「放進」＋路徑＋「不是資料夾」、那個檔不變、沒有 .partial、暫存清掉', async (t) => {
    const root = makeProject(t, { langs: ['zh', 'ja'] });
    const parent = tmp(t, 'site-media-out-');
    const out = path.join(parent, 'media');
    fs.writeFileSync(out, 'I am a file, not a folder');
    const before = snapshot(parent);
    const sys = systemTmp(t);
    const { error } = await go(t, { root, out, langs: ['zh', 'ja'] });
    expectPublishFail(error, out, /不是資料夾/, '--out 是檔案');
    assert.deepEqual(snapshot(parent), before, '--out 那個檔與它旁邊都不變');
    noPartial(parent, '--out 是檔案');
    assert.deepEqual(fs.readdirSync(sys), [], '暫存資料夾要清掉');
});

const CANT_CHMOD = process.platform === 'win32'
    ? 'Windows 的 chmod 做不出唯讀資料夾'
    : (typeof process.getuid === 'function' && process.getuid() === 0 ? 'root 不受唯讀限制' : false);

test('B3.3 runMedia 放進 --out 失敗：--out 是唯讀資料夾 → 「放進」＋路徑＋「沒有寫入權限」、舊檔不變、沒有 .partial、暫存清掉', { skip: CANT_CHMOD }, async (t) => {
    const root = makeProject(t, { langs: ['zh', 'ja'] });
    const out = outWithOld(t);
    const before = snapshot(out);
    const sys = systemTmp(t);
    fs.chmodSync(out, 0o555);
    let result;
    try {
        result = await go(t, { root, out, langs: ['zh', 'ja'] });
    } finally {
        fs.chmodSync(out, 0o755);
    }
    expectPublishFail(result.error, out, /沒有寫入權限/, '唯讀資料夾');
    // 〔檢查員第 2 輪〕括號裡附的是寫不進去的目的地（--out 底下），不是已經清掉的暫存來源檔
    assert.ok(result.error.message.includes(out + path.sep), `唯讀資料夾：訊息要附 --out 底下寫不進去的那個位置（${out}${path.sep}…），得到「${result.error.message}」`);
    assert.ok(!result.error.message.includes(sys), `唯讀資料夾：訊息不能附暫存資料夾的路徑（${sys}），得到「${result.error.message}」`);
    assert.deepEqual(snapshot(out), before, '舊檔一個位元組都不變');
    noPartial(out, '唯讀資料夾');
    assert.deepEqual(fs.readdirSync(sys), [], '暫存資料夾要清掉');
});

test('B3.3 runMedia 放進 --out 失敗：hero-ja.mp4 的位置是一個資料夾 → 開始改名之前就停：zh、en 沒被換成新的、media.json 還是舊的', async (t) => {
    const root = makeProject(t);
    const out = tmp(t, 'site-media-out-');
    fs.writeFileSync(path.join(out, 'hero-zh.mp4'), 'OLD zh video');
    fs.writeFileSync(path.join(out, 'hero-en.mp4'), 'OLD en video');
    fs.writeFileSync(path.join(out, 'hero-poster-zh.webp'), 'OLD zh poster');
    fs.writeFileSync(path.join(out, 'media.json'), OLD['media.json']);
    fs.mkdirSync(path.join(out, 'hero-ja.mp4'));
    const before = snapshot(out);
    const sys = systemTmp(t);
    const { error } = await go(t, { root, out });
    expectPublishFail(error, out, /資料夾佔住/, 'hero-ja.mp4 是資料夾');
    assert.equal(fs.readFileSync(path.join(out, 'hero-zh.mp4'), 'utf8'), 'OLD zh video', 'hero-zh.mp4 不能被換成新的（半新半舊）');
    assert.equal(fs.readFileSync(path.join(out, 'hero-en.mp4'), 'utf8'), 'OLD en video', 'hero-en.mp4 不能被換成新的');
    assert.equal(fs.readFileSync(path.join(out, 'media.json'), 'utf8'), OLD['media.json'], 'media.json 還是舊的');
    assert.deepEqual(snapshot(out), before, '--out 一個位元組都不變（hero-ja.mp4 還是資料夾、不多出檔）');
    noPartial(out, 'hero-ja.mp4 是資料夾');
    assert.deepEqual(fs.readdirSync(sys), [], '暫存資料夾要清掉');
});
