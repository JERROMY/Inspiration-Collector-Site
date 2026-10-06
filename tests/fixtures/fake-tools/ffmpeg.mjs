// 假的 ffmpeg（4-b3 的測試用）。用 `node ffmpeg.mjs <參數…>` 跑 —— 測試注入的 run 一律是 spawnSync(process.execPath, [這支, …參數])，Windows 也跑得動。
//
// 它認得的「影片」是 JSON 文字檔：{ "fake": "mp4", "durationSec": 63.02, "width": 1920, "height": 1080, "audio": true }，後面可以補空白到指定大小。
// 三種叫法（跟真的 ffmpeg 一樣的結束碼與 stderr 格式）：
//   -version                     印版本、結束碼 0
//   … -i <檔>（最後一個參數緊跟在 -i 後面，沒有輸出檔）
//                                把那支假影片的資訊照真 ffmpeg 的格式印到 stderr（Duration、Stream …: Video、有音軌才印 Audio），結束碼 1
//   … -i <輸入> … <輸出>        轉檔：照參數的意思寫出一支假影片 —— 有 -an 才拿掉音軌；解析度不變；
//                                長度比輸入短 0.02 秒（真的 ffmpeg 拿掉音軌之後 63.02 → 63.00，量過）
//
// 環境變數（測試用來控制壞法）：
//   FAKE_FFMPEG     noversion   -version 結束碼 1、stderr 是 dyld 找不到函式庫（這台 Homebrew 的 ffmpeg 壞掉的樣子）
//                   keepaudio   轉檔時就算有 -an 也留著音軌
//                   resize      轉檔時解析度變成 1280x720
//                   fail        轉檔時結束碼 1、stderr「fake ffmpeg failed: Conversion failed!」、不寫檔
//                   nowrite     轉檔時結束碼 0 但不寫檔
//   FAKE_DURATION_DELTA         轉檔後比輸入短幾秒（預設 0.02；負數＝變長；跟著 FAKE_ONLY）
//   FAKE_VIDEO_BYTES            轉檔的輸出補到剛好幾位元組（預設不補，約 100 位元組；跟著 FAKE_ONLY）
//   FAKE_ONLY       zh／en／ja  壞法只套在檔名含 -<語言>. 的那支（沒設＝每支都壞）
//   FAKE_LOG        檔案路徑    每叫一次就附加一行 JSON：{ tool: 'ffmpeg', args }
import fs from 'node:fs';

const args = process.argv.slice(2);
const env = process.env;

if (env.FAKE_LOG) fs.appendFileSync(env.FAKE_LOG, JSON.stringify({ tool: 'ffmpeg', args }) + '\n');

function hits(file) {
    return !env.FAKE_ONLY || new RegExp(`-${env.FAKE_ONLY}\\.`).test(file);
}

function clock(sec) {
    const cs = Math.round(sec * 100);
    const h = Math.floor(cs / 360000);
    const m = Math.floor((cs % 360000) / 6000);
    const s = Math.floor((cs % 6000) / 100);
    const two = (n) => String(n).padStart(2, '0');
    return `${two(h)}:${two(m)}:${two(s)}.${two(cs % 100)}`;
}

function readFake(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        process.stderr.write(`[in#0 @ 0x7b1ec10000] Error opening input: No such file or directory\nError opening input file ${file}.\nError opening input files: No such file or directory\n`);
        process.exit(254);
    }
    try {
        const info = JSON.parse(text);
        if (info.fake === 'mp4') return info;
    } catch { /* 往下：不是假影片 */ }
    process.stderr.write(`[in#0 @ 0x78ae808000] moov atom not found\n[in#0 @ 0x78af40c000] Error opening input: Invalid data found when processing input\nError opening input file ${file}.\nError opening input files: Invalid data found when processing input\n`);
    process.exit(1);
}

if (args.includes('-version')) {
    if (env.FAKE_FFMPEG === 'noversion') {
        process.stderr.write('dyld[4242]: Library not loaded: /opt/homebrew/opt/x265/lib/libx265.215.dylib\n  Referenced from: /opt/homebrew/Cellar/ffmpeg/8.0/bin/ffmpeg\n');
        process.exit(1);
    }
    process.stdout.write('ffmpeg version 8.1.2-fake Copyright (c) 2000-2026 the FFmpeg developers\n');
    process.exit(0);
}

const at = args.indexOf('-i');
if (at < 0 || at + 1 >= args.length) {
    process.stderr.write('fake ffmpeg: 測試自己寫錯或實作沒給 -i\n');
    process.exit(1);
}
const input = args[at + 1];

// 只看資訊：-i <檔> 是最後兩個參數
if (at + 1 === args.length - 1) {
    const info = readFake(input);
    const lines = [
        `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '${input}':`,
        '  Metadata:',
        '    major_brand     : isom',
        '    encoder         : Lavf60.3.100',
        `  Duration: ${clock(info.durationSec)}, start: 0.000000, bitrate: 555 kb/s`,
        `  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), ${info.width}x${info.height}, 367 kb/s, 30 fps, 30 tbr, 15360 tbn (default)`,
        '    Metadata:',
        '      handler_name    : VideoHandler',
    ];
    if (info.audio) {
        lines.push('  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 179 kb/s (default)');
        lines.push('    Metadata:', '      handler_name    : SoundHandler');
    }
    lines.push('At least one output file must be specified');
    process.stderr.write(lines.join('\n') + '\n');
    process.exit(1);
}

// 轉檔
const output = args[args.length - 1];
const info = readFake(input);
const fault = hits(input) ? env.FAKE_FFMPEG : undefined;
if (fault === 'fail') {
    process.stderr.write('fake ffmpeg failed: Conversion failed!\n');
    process.exit(1);
}
if (fault === 'nowrite') process.exit(0);

const delta = hits(input) && env.FAKE_DURATION_DELTA !== undefined ? Number(env.FAKE_DURATION_DELTA) : 0.02;
const out = {
    fake: 'mp4',
    durationSec: Math.round((info.durationSec - delta) * 100) / 100,
    width: fault === 'resize' ? 1280 : info.width,
    height: fault === 'resize' ? 720 : info.height,
    audio: fault === 'keepaudio' ? info.audio : (args.includes('-an') ? false : info.audio),
};
let text = JSON.stringify(out);
const bytes = hits(input) && env.FAKE_VIDEO_BYTES ? Number(env.FAKE_VIDEO_BYTES) : 0;
if (bytes > text.length) text += ' '.repeat(bytes - text.length);
fs.writeFileSync(output, text);
process.exit(0);
