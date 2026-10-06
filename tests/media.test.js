// 素材處理的純函式 lib/media.js（目標檔 4-b3 的 B3.1～B3.3 的函式那一半；介面細則見 tests/README.md「4-b3」）。
//
// 量什麼（不跑任何外部工具）：
//   B3.1 parseFfmpegInfo：輸入是 `ffmpeg -hide_banner -i <檔>` 的 stderr。樣本是從真的 ffmpeg 8.1.2 抓下來的
//        （release/demo-dust-1920x1080-zh.mp4 原檔、拿掉音軌之後、切成 mpegts、只有音軌的 m4a、裸 h264 的 Duration: N/A、截斷的檔、亂碼檔），
//        另有手組的：時分秒都不是 0 的 Duration、yuv420p(tv, bt709) 與 [SAR 1:1 DAR 16:9]、第二條影像串流（封面圖）、CRLF 行尾。
//        陷阱：每一行串流都有 0x31637661、0x001B 這種編碼標記，寫成「找第一個 數字x數字」會讀成 0x31637661。
//   B3.1 ffmpegArgs：去音軌、影像直接複製、只取第一條影像串流、faststart、-y；是參數陣列（含空白的路徑是一個元素），不是 shell 字串。
//   B3.2 readImageSize：PNG（IHDR，寬高 32 位元大端）、WebP 三種檔頭（VP8 有損、VP8L 無損、VP8X 擴充），位元組在測試裡現組（fixtures/fake-tools/images.js）。
//        壞的：截斷、不是圖片（JPEG、RIFF 但不是 WEBP、純文字、空的）一律丟 Error。
//   B3.2 cwebpArgs：無損（-lossless -z 9；有損在暗色放射漸層會出色階斷層，只有無損跟原圖逐像素相同，檢查員量的）、沒有品質參數、-o 輸出、輸入在裡面。
//   B3.3 planMedia：輸入輸出路徑；buildMediaJson：欄位順序固定、file 是檔名。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B3"
//   node --test tests/media.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { lib } from './helpers.js';
import { png, webpLossy, webpLossless, webpExtended } from './fixtures/fake-tools/images.js';

const need = await lib('media.js', ['parseFfmpegInfo', 'readImageSize', 'planMedia', 'ffmpegArgs', 'cwebpArgs', 'buildMediaJson']);

// ---- 真的 ffmpeg 8.1.2 的 stderr（2026-10-02 在這台 mac 上抓的；路徑換成短的）----

const REAL_WITH_AUDIO = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'release/demo-dust-1920x1080-zh.mp4':",
    '  Metadata:',
    '    major_brand     : isom',
    '    minor_version   : 512',
    '    compatible_brands: isomiso2avc1mp41',
    '    encoder         : Lavf60.3.100',
    '  Duration: 00:01:03.02, start: 0.000000, bitrate: 555 kb/s',
    '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1920x1080, 367 kb/s, 30 fps, 30 tbr, 15360 tbn (default)',
    '    Metadata:',
    '      handler_name    : VideoHandler',
    '      encoder         : Lavc60.3.100 libx264',
    '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 179 kb/s (default)',
    '    Metadata:',
    '      handler_name    : SoundHandler',
    'At least one output file must be specified',
].join('\n') + '\n';

const REAL_NO_AUDIO = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'hero-zh.mp4':",
    '  Metadata:',
    '    major_brand     : isom',
    '    minor_version   : 512',
    '    compatible_brands: isomiso2avc1mp41',
    '    encoder         : Lavf62.12.102',
    '  Duration: 00:01:03.00, start: 0.000000, bitrate: 369 kb/s',
    '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1920x1080, 367 kb/s, 30 fps, 30 tbr, 15360 tbn (default)',
    '    Metadata:',
    '      handler_name    : VideoHandler',
    '      encoder         : Lavc60.3.100 libx264',
    'At least one output file must be specified',
].join('\n') + '\n';

// mpegts：串流標記沒有 (und)、編碼標記是 ([27][0][0][0] / 0x001B)
const REAL_TS = [
    "Input #0, mpegts, from 'x.ts':",
    '  Duration: 00:00:02.19, start: 1.445333, bitrate: 573 kb/s',
    '  Program 1 ',
    '    Metadata:',
    '      service_name    : Service01',
    '      service_provider: FFmpeg',
    '  Stream #0:0[0x100]: Video: h264 (High) ([27][0][0][0] / 0x001B), yuv420p(progressive), 1920x1080, 30 fps, 30 tbr, 90k tbn, start 1.466667',
    '  Stream #0:1[0x101](und): Audio: aac (LC) ([15][0][0][0] / 0x000F), 48000 Hz, stereo, fltp, 192 kb/s, start 1.445333',
    'At least one output file must be specified',
].join('\n') + '\n';

const REAL_AUDIO_ONLY = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'a.m4a':",
    '  Metadata:',
    '    major_brand     : M4A ',
    '    minor_version   : 512',
    '    compatible_brands: M4A isomiso2',
    '    encoder         : Lavf62.12.102',
    '  Duration: 00:00:02.01, start: 0.000000, bitrate: 196 kb/s',
    '  Stream #0:0[0x1](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 189 kb/s (default)',
    '    Metadata:',
    '      handler_name    : SoundHandler',
    'At least one output file must be specified',
].join('\n') + '\n';

const REAL_DURATION_NA = [
    "Input #0, h264, from 'x.h264':",
    '  Duration: N/A, bitrate: N/A',
    '  Stream #0:0: Video: h264 (High), yuv420p(progressive), 1920x1080, 25 fps, 60 tbr, 1200k tbn',
    'At least one output file must be specified',
].join('\n') + '\n';

const REAL_TRUNCATED = [
    '[in#0 @ 0x7b8f018000] reached eof, corrupted CTTS atom',
    '[in#0 @ 0x7b8f018000] error reading header',
    '[in#0 @ 0x7b8ec10000] Error opening input: End of file',
    'Error opening input file trunc.mp4.',
    'Error opening input files: End of file',
].join('\n') + '\n';

const REAL_GARBAGE = [
    '[in#0 @ 0x78ae808000] Format mov,mp4,m4a,3gp,3g2,mj2 detected only with low score of 1, misdetection possible!',
    '[in#0 @ 0x78ae808000] moov atom not found',
    '[in#0 @ 0x78af40c000] Error opening input: Invalid data found when processing input',
    'Error opening input file bad.mp4.',
    'Error opening input files: Invalid data found when processing input',
].join('\n') + '\n';

// ---- 手組的（真的 ffmpeg 會印的形狀）----

const HOURS = REAL_WITH_AUDIO.replace('Duration: 00:01:03.02', 'Duration: 01:02:03.45');

const TV_BT709 = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'tv.mp4':",
    '  Duration: 00:00:10.50, start: 0.000000, bitrate: 2000 kb/s',
    '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 1800 kb/s, 29.97 fps, 29.97 tbr, 30k tbn (default)',
    '  Stream #0:1[0x2](eng): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)',
].join('\n') + '\n';

// 第二條影像串流是封面圖（attached pic）：要的是第一條
const COVER_ART = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'cover.mp4':",
    '  Duration: 00:00:05.00, start: 0.000000, bitrate: 900 kb/s',
    '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1280x720, 800 kb/s, 30 fps, 30 tbr, 15360 tbn (default)',
    '  Stream #0:1[0x0]: Video: mjpeg (Baseline), yuvj420p(pc, bt470bg/unknown/unknown), 600x600 [SAR 1:1 DAR 1:1], 90k tbr, 90k tbn (attached pic)',
].join('\n') + '\n';

const CRLF = REAL_WITH_AUDIO.replace(/\n/g, '\r\n');

function close(actual, expected, label) {
    assert.equal(typeof actual, 'number', `${label}：durationSec 要是數字，得到 ${JSON.stringify(actual)}`);
    assert.ok(Math.abs(actual - expected) < 1e-9, `${label}：durationSec 要是 ${expected}，得到 ${actual}`);
}

function expectInfo(info, { durationSec, video, hasAudio }, label) {
    assert.ok(info && typeof info === 'object', `${label}：要回傳物件`);
    assert.deepEqual(Object.keys(info).sort(), ['durationSec', 'hasAudio', 'video'], `${label}：欄位剛好是 durationSec、video、hasAudio，得到 ${JSON.stringify(info)}`);
    close(info.durationSec, durationSec, label);
    assert.deepEqual(info.video, video, `${label}：video`);
    assert.equal(info.hasAudio, hasAudio, `${label}：hasAudio`);
}

function throwsMentioning(fn, words, label) {
    let caught = null;
    try { fn(); } catch (err) { caught = err; }
    assert.ok(caught instanceof Error, `${label}：要丟 Error`);
    assert.ok(words.test(caught.message), `${label}：訊息要講出缺什麼（${words}），得到「${caught.message}」`);
}

// ---------------- parseFfmpegInfo ----------------

test('B3.1 parseFfmpegInfo：真的原檔（有音軌）→ 63.02 秒、1920x1080、有音軌（不被 0x31637661 騙）', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(REAL_WITH_AUDIO), { durationSec: 63.02, video: { width: 1920, height: 1080 }, hasAudio: true }, '原檔');
});

test('B3.1 parseFfmpegInfo：真的拿掉音軌之後 → 63.00 秒、1920x1080、沒有音軌', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(REAL_NO_AUDIO), { durationSec: 63, video: { width: 1920, height: 1080 }, hasAudio: false }, '去音軌');
});

test('B3.1 parseFfmpegInfo：mpegts（串流標記 [0x100] 沒有 (und)、編碼標記 0x001B）→ 2.19 秒、1920x1080、有音軌', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(REAL_TS), { durationSec: 2.19, video: { width: 1920, height: 1080 }, hasAudio: true }, 'mpegts');
});

test('B3.1 parseFfmpegInfo：只有音軌的檔 → video 是 null、有音軌（不丟例外）', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(REAL_AUDIO_ONLY), { durationSec: 2.01, video: null, hasAudio: true }, '只有音軌');
});

test('B3.1 parseFfmpegInfo：時分秒都算進去（01:02:03.45 → 3723.45 秒）', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(HOURS), { durationSec: 3723.45, video: { width: 1920, height: 1080 }, hasAudio: true }, '一小時多');
});

test('B3.1 parseFfmpegInfo：yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9] → 1920x1080（括號與 SAR、DAR 不干擾）', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(TV_BT709), { durationSec: 10.5, video: { width: 1920, height: 1080 }, hasAudio: true }, 'tv, bt709');
});

test('B3.1 parseFfmpegInfo：有兩條影像串流（第二條是封面圖）→ 取第一條的 1280x720', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(COVER_ART), { durationSec: 5, video: { width: 1280, height: 720 }, hasAudio: false }, '封面圖');
});

test('B3.1 parseFfmpegInfo：CRLF 行尾（Windows 的 ffmpeg）結果一樣', () => {
    const { parseFfmpegInfo } = need();
    expectInfo(parseFfmpegInfo(CRLF), { durationSec: 63.02, video: { width: 1920, height: 1080 }, hasAudio: true }, 'CRLF');
});

test('B3.1 parseFfmpegInfo：Duration: N/A → 丟 Error，訊息講缺長度', () => {
    const { parseFfmpegInfo } = need();
    throwsMentioning(() => parseFfmpegInfo(REAL_DURATION_NA), /Duration|長度/, 'Duration: N/A');
});

test('B3.1 parseFfmpegInfo：截斷的檔、亂碼檔（沒有 Duration 也沒有串流）→ 丟 Error，訊息講缺什麼', () => {
    const { parseFfmpegInfo } = need();
    throwsMentioning(() => parseFfmpegInfo(REAL_TRUNCATED), /Duration|長度|Video|影像|畫面/, '截斷');
    throwsMentioning(() => parseFfmpegInfo(REAL_GARBAGE), /Duration|長度|Video|影像|畫面/, '亂碼');
    throwsMentioning(() => parseFfmpegInfo(''), /Duration|長度|Video|影像|畫面/, '空字串');
});

test('B3.1 parseFfmpegInfo：有 Duration 但沒有影像也沒有音軌 → 丟 Error，訊息講缺影像', () => {
    const { parseFfmpegInfo } = need();
    const text = REAL_WITH_AUDIO.split('\n').filter((line) => !/Stream #/.test(line)).join('\n');
    throwsMentioning(() => parseFfmpegInfo(text), /Video|影像|畫面/, '沒有串流');
});

// ---------------- readImageSize ----------------

function expectSize(got, expected, label) {
    assert.deepEqual(got, expected, `${label}：要是 ${JSON.stringify(expected)}，得到 ${JSON.stringify(got)}`);
    assert.deepEqual(Object.keys(got), ['type', 'width', 'height'], `${label}：欄位順序 type、width、height`);
}

function throwsError(fn, label) {
    let caught = null;
    try { fn(); } catch (err) { caught = err; }
    assert.ok(caught instanceof Error, `${label}：要丟 Error，結果沒丟（回傳了東西）`);
    assert.ok(caught.message.length > 0, `${label}：訊息不能是空的`);
}

test('B3.2 readImageSize：PNG 讀 IHDR（1920x1080；寬超過 65535 也對，是 32 位元大端）', () => {
    const { readImageSize } = need();
    expectSize(readImageSize(png(1920, 1080)), { type: 'png', width: 1920, height: 1080 }, 'PNG 1920x1080');
    expectSize(readImageSize(png(70000, 3)), { type: 'png', width: 70000, height: 3 }, 'PNG 70000x3');
    expectSize(readImageSize(png(1920, 1080, { size: 40000 })), { type: 'png', width: 1920, height: 1080 }, 'PNG 40 KB');
});

test('B3.2 readImageSize：WebP 有損（VP8 ）→ 寬高是 14 位元，上面兩位元的縮放旗標要去掉', () => {
    const { readImageSize } = need();
    expectSize(readImageSize(webpLossy(1920, 1080)), { type: 'webp', width: 1920, height: 1080 }, 'VP8 1920x1080');
    expectSize(readImageSize(webpLossy(1920, 1080, { hscale: 2, vscale: 1 })), { type: 'webp', width: 1920, height: 1080 }, 'VP8 帶縮放旗標');
    expectSize(readImageSize(webpLossy(16383, 1)), { type: 'webp', width: 16383, height: 1 }, 'VP8 16383x1');
});

test('B3.2 readImageSize：WebP 無損（VP8L）→ 寬-1、高-1 各 14 位元', () => {
    const { readImageSize } = need();
    expectSize(readImageSize(webpLossless(1920, 1080)), { type: 'webp', width: 1920, height: 1080 }, 'VP8L 1920x1080');
    expectSize(readImageSize(webpLossless(7, 16384)), { type: 'webp', width: 7, height: 16384 }, 'VP8L 7x16384');
    expectSize(readImageSize(webpLossless(16384, 1)), { type: 'webp', width: 16384, height: 1 }, 'VP8L 16384x1');
});

test('B3.2 readImageSize：WebP 擴充（VP8X）→ 畫布寬-1、高-1 各 24 位元（可以超過 16384）', () => {
    const { readImageSize } = need();
    expectSize(readImageSize(webpExtended(1920, 1080)), { type: 'webp', width: 1920, height: 1080 }, 'VP8X 1920x1080');
    expectSize(readImageSize(webpExtended(20000, 3)), { type: 'webp', width: 20000, height: 3 }, 'VP8X 20000x3');
});

test('B3.2 readImageSize：截斷的檔 → 丟 Error（不回傳亂讀的寬高）', () => {
    const { readImageSize } = need();
    throwsError(() => readImageSize(png(1920, 1080).subarray(0, 20)), 'PNG 只剩 20 位元組');
    throwsError(() => readImageSize(webpLossy(1920, 1080).subarray(0, 26)), 'VP8 切在寬高前面');
    throwsError(() => readImageSize(webpLossless(1920, 1080).subarray(0, 23)), 'VP8L 切在寬高中間');
    throwsError(() => readImageSize(webpExtended(1920, 1080).subarray(0, 28)), 'VP8X 切在寬高中間');
    throwsError(() => readImageSize(webpLossy(1920, 1080).subarray(0, 12)), '只有 RIFF 檔頭');
});

test('B3.2 readImageSize：不是 PNG 也不是 WebP → 丟 Error', () => {
    const { readImageSize } = need();
    throwsError(() => readImageSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'JPEG');
    const wave = webpLossy(1920, 1080);
    wave.write('WAVE', 8, 'latin1');
    throwsError(() => readImageSize(wave), 'RIFF 但是 WAVE');
    throwsError(() => readImageSize(Buffer.from('這不是圖片，只是一段文字而已，夠長夠長夠長夠長夠長。', 'utf8')), '純文字');
    throwsError(() => readImageSize(Buffer.alloc(0)), '空的');
});

// ---------------- planMedia ----------------

test('B3.3 planMedia：每個語言一筆，輸入在 <root>/release/、輸出在 <out>/，順序照 langs', () => {
    const { planMedia } = need();
    const root = path.join(path.sep, 'tmp', 'project root');
    const out = path.join(path.sep, 'tmp', 'site', 'public', 'media');
    const got = planMedia({ root, out, langs: ['zh', 'en', 'ja'] });
    const expected = ['zh', 'en', 'ja'].map((lang) => ({
        lang,
        videoIn: path.join(root, 'release', `demo-dust-1920x1080-${lang}.mp4`),
        posterIn: path.join(root, 'release', `demo-dust-poster-${lang}.png`),
        videoOut: path.join(out, `hero-${lang}.mp4`),
        posterOut: path.join(out, `hero-poster-${lang}.webp`),
    }));
    assert.deepEqual(got, expected);
    assert.deepEqual(planMedia({ root, out, langs: ['ja'] }), [expected[2]], '只給 ja 就只有 ja');
});

// ---------------- ffmpegArgs ----------------

function after(args, flag, label) {
    const i = args.indexOf(flag);
    assert.ok(i >= 0, `${label}：要有 ${flag}，得到 ${JSON.stringify(args)}`);
    return args[i + 1];
}

test('B3.1 ffmpegArgs：-i 輸入、-map 0:v:0、-c:v copy、-an、-movflags +faststart、-y，最後一個是輸出', () => {
    const { ffmpegArgs } = need();
    const input = path.join(path.sep, 'tmp', 'a b', 'demo-dust-1920x1080-zh.mp4');
    const output = path.join(path.sep, 'tmp', 'c d', 'hero-zh.mp4');
    const args = ffmpegArgs(input, output);
    assert.ok(Array.isArray(args) && args.every((a) => typeof a === 'string'), `要是字串陣列，得到 ${JSON.stringify(args)}`);
    assert.equal(after(args, '-i', '輸入'), input, '-i 後面是輸入（含空白的路徑是一個元素）');
    assert.equal(args[args.length - 1], output, '最後一個是輸出（含空白的路徑是一個元素）');
    assert.equal(args.filter((a) => a === input).length, 1, '輸入只出現一次');
    assert.ok(args.includes('-an'), '要有 -an（拿掉音軌）');
    assert.equal(after(args, '-map', '只取第一條影像'), '0:v:0', '-map 0:v:0');
    assert.equal(after(args, '-c:v', '影像直接複製'), 'copy', '-c:v copy（不重新編碼）');
    assert.equal(after(args, '-movflags', 'faststart'), '+faststart', '-movflags +faststart');
    assert.ok(args.includes('-y'), '要有 -y');
    const iAt = args.indexOf('-i');
    for (const flag of ['-map', '-c:v', '-an', '-movflags']) {
        assert.ok(args.indexOf(flag) > iAt, `${flag} 是輸出的選項，要放在 -i 輸入後面`);
    }
});

test('B3.1 ffmpegArgs：不重新編碼、不切長度、不是 shell 字串', () => {
    const { ffmpegArgs } = need();
    const input = path.join(path.sep, 'tmp', 'a b', 'in.mp4');
    const output = path.join(path.sep, 'tmp', 'a b', 'out.mp4');
    const args = ffmpegArgs(input, output);
    for (const bad of ['libx264', 'libx265', '-crf', '-vf', '-filter:v', '-b:v', '-t', '-to', '-ss']) {
        assert.ok(!args.includes(bad), `不准有 ${bad}（只拿掉音軌，畫面與長度不動），得到 ${JSON.stringify(args)}`);
    }
    for (const arg of args) {
        if (arg === input || arg === output) continue;
        assert.ok(!/\s/.test(arg), `「${arg}」裡有空白：每個參數要分開放，不是一整串 shell 字串`);
    }
    assert.ok(!args.some((a) => a.includes(input) && a !== input), '輸入路徑不能跟別的參數黏在一起');
});

// ---------------- cwebpArgs ----------------

test('B3.2 cwebpArgs：無損（-lossless、-z 9）、輸入、-o 輸出；沒有 -q', () => {
    const { cwebpArgs } = need();
    const input = path.join(path.sep, 'tmp', 'a b', 'demo-dust-poster-zh.png');
    const output = path.join(path.sep, 'tmp', 'c d', 'hero-poster-zh.webp');
    const args = cwebpArgs(input, output);
    assert.ok(Array.isArray(args) && args.every((a) => typeof a === 'string'), `要是字串陣列，得到 ${JSON.stringify(args)}`);
    assert.ok(args.includes('-lossless'), '要有 -lossless（無損：跟原 PNG 逐像素相同）');
    assert.equal(after(args, '-z', '壓縮等級'), '9', '-z 9');
    assert.ok(!args.includes('-q'), '無損不帶 -q 品質參數');
    assert.equal(after(args, '-o', '輸出'), output, '-o 後面是輸出');
    assert.equal(args.filter((a) => a === input).length, 1, '輸入剛好出現一次');
    for (const arg of args) {
        if (arg === input || arg === output) continue;
        assert.ok(!/\s/.test(arg), `「${arg}」裡有空白：每個參數要分開放`);
    }
});

// ---------------- buildMediaJson ----------------

function result(lang, { videoOut, posterOut }) {
    // 故意把欄位順序打亂、多帶幾個欄位：輸出要照固定順序、只留介面上的欄位
    return {
        poster: { height: 1080, type: 'webp', bytes: 14042, width: 1920 },
        posterOut,
        video: { hasAudio: false, height: 1080, width: 1920, durationSec: 63, bytes: 2913698 },
        videoOut,
        posterIn: `/x/release/demo-dust-poster-${lang}.png`,
        videoIn: `/x/release/demo-dust-1920x1080-${lang}.mp4`,
        lang,
    };
}

test('B3.3 buildMediaJson：{ 語言: { video: { file, bytes, durationSec, width, height }, poster: { file, bytes, width, height } } }，欄位順序固定、file 是檔名', () => {
    const { buildMediaJson } = need();
    const out = path.join(path.sep, 'tmp', 'staging');
    const results = ['zh', 'en', 'ja'].map((lang) => result(lang, {
        videoOut: path.join(out, `hero-${lang}.mp4`),
        posterOut: path.join(out, `hero-poster-${lang}.webp`),
    }));
    const got = buildMediaJson(results);
    const expected = {};
    for (const lang of ['zh', 'en', 'ja']) {
        expected[lang] = {
            video: { file: `hero-${lang}.mp4`, bytes: 2913698, durationSec: 63, width: 1920, height: 1080 },
            poster: { file: `hero-poster-${lang}.webp`, bytes: 14042, width: 1920, height: 1080 },
        };
    }
    assert.equal(JSON.stringify(got, null, 2), JSON.stringify(expected, null, 2), '逐字相同（含欄位順序、語言順序、沒有多的欄位）');
});
