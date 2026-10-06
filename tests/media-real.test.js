// 素材處理用真的 ffmpeg 與 cwebp 跑（目標檔 4-b3 的 B3.1～B3.3）：選擇性跑。
//
// 只有三個環境變數都設了才跑：SITE_REAL_TOOLS=1、FFMPEG（ffmpeg 的路徑）、CWEBP（cwebp 的路徑）；少一個就 skip 並寫出原因（不算紅也不算綠）。
// 都設了但工具跑不起來、或 release/ 的原檔不在 → 紅（路徑打錯不能靜靜略過）。
// 這台 mac：Homebrew 的 ffmpeg 壞了（dyld 找不到 libx265），能用的是 VideoConverter 帶的那支（沒有 ffprobe、沒有 PNG／WebP 編碼器，但能 -c copy -an）。
//
// 量什麼：用真的 release/demo-dust-1920x1080-<語言>.mp4 的前 2 秒（ffmpeg -t 2 -c copy 切到暫存資料夾，留著音軌）與真的 release/demo-dust-poster-<語言>.png
//   做一個暫存的小專案根目錄，命令 scripts/media.mjs --root 指過去（工具只從環境變數 FFMPEG、CWEBP 來，不給 --ffmpeg／--cwebp）：
//   結束碼 0；每支影片沒有音軌、1920x1080、長度跟切出來的來源差 0.05 秒以內；每張海報是 WebP、比 PNG 小、寬高跟 PNG 一樣；
//   media.json 的寬高、位元組數、長度跟實際檔案對得上；系統暫存資料夾用完是空的；小專案根目錄一個位元組都不變；
//   重跑（同一個 --out、另一個 --out）位元組相同。
//   檢查一律用測試自己的讀法（ffmpeg -i 的 stderr 用自己的正規表示式、WebP 自己讀檔頭），不靠被測的 lib/media.js。
//   B3.2 逐像素相同（另一條，還要 dwebp 與 ImageMagick 的 magick；找不到或跑不起來就 skip）：海報是無損 WebP，
//        dwebp 解回 PNG 之後跟來源 PNG 用 `magick compare -metric AE` 比，不同的像素數要是 0。
//        dwebp：環境變數 DWEBP，沒設就用 CWEBP 同資料夾的 dwebp；magick：環境變數 MAGICK，沒設就用 PATH 的 magick。
//   B3.3 環境變數 CWEBP 是空字串（FFMPEG 是真的、PATH 指到空資料夾）→ 當作沒設、退回 PATH 的 cwebp → 「cwebp 跑不起來」「找不到」，
//        不是 Node 的英文錯誤（要先有跑得起來的 ffmpeg 才走得到 cwebp，所以放在這裡）。
//   完整 63 秒的三支由派工人員最後實跑，不在這裡（要 10 秒以上、而且會寫進 public/media/）。
//
// 跑法（在 homepage/site/）：
//   SITE_REAL_TOOLS=1 FFMPEG=<VideoConverter 帶的 ffmpeg> CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "真工具"
//   （Windows cmd：set "SITE_REAL_TOOLS=1" && set "FFMPEG=C:\…\ffmpeg.exe" && set "CWEBP=C:\…\cwebp.exe" && npm test -- --test-name-pattern "真工具"）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { LANGS, tmp, snapshot, makeProject } from './media-fixture.js';

const SCRIPT = path.join(SITE, 'scripts', 'media.mjs');
const RELEASE = path.resolve(SITE, '..', '..', 'release');
const { SITE_REAL_TOOLS, FFMPEG, CWEBP } = process.env;

const SKIP = SITE_REAL_TOOLS !== '1'
    ? '沒設 SITE_REAL_TOOLS=1（真工具的整合測試預設不跑）'
    : !FFMPEG || !CWEBP
        ? '設了 SITE_REAL_TOOLS=1 但沒設 FFMPEG 或 CWEBP（要指到跑得起來的 ffmpeg 與 cwebp）'
        : false;

function tool(file, args) {
    const res = spawnSync(file, args, { encoding: 'utf8', timeout: 60000 });
    assert.equal(res.error, undefined, `${file} 開不起來：${res.error && res.error.message}`);
    return res;
}

function probe(file) {
    const { stderr } = tool(FFMPEG, ['-hide_banner', '-i', file]);
    const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    assert.ok(d, `${file}：ffmpeg -i 沒印出 Duration：${stderr}`);
    // 第一條影像串流那一行：先拿掉 (…) 與 […]（編碼標記 0x31637661、串流標記 [0x1] 都在裡面），剩下的第一個「數字x數字」就是解析度
    const line = stderr.split(/\r?\n/).find((l) => /Stream #\S+: Video:/.test(l));
    let bare = line ?? '';
    while (/\([^()]*\)/.test(bare)) bare = bare.replace(/\([^()]*\)/g, '');
    const video = /\b(\d+)x(\d+)\b/.exec(bare.replace(/\[[^\]]*\]/g, ''));
    return {
        durationSec: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]),
        width: video ? Number(video[1]) : null,
        height: video ? Number(video[2]) : null,
        hasAudio: /Stream #\S+: Audio:/.test(stderr),
    };
}

function pngSize(buf) {
    assert.equal(buf.toString('latin1', 12, 16), 'IHDR');
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function webpSize(buf) {
    assert.equal(buf.toString('latin1', 0, 4), 'RIFF', '要是 RIFF');
    assert.equal(buf.toString('latin1', 8, 12), 'WEBP', '要是 WEBP');
    const kind = buf.toString('latin1', 12, 16);
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    assert.fail(`認不得的 WebP 檔頭 ${JSON.stringify(kind)}`);
}

// 用真的原檔做一個暫存的小專案根目錄：影片切前 2 秒（留著音軌）、海報原樣複製。回傳 { root, source（切出來的影片量到的資訊）}
function miniProject(t) {
    for (const lang of LANGS) {
        for (const name of [`demo-dust-1920x1080-${lang}.mp4`, `demo-dust-poster-${lang}.png`]) {
            assert.ok(fs.existsSync(path.join(RELEASE, name)), `${RELEASE} 底下沒有 ${name}`);
        }
    }
    const ver = tool(FFMPEG, ['-version']);
    assert.equal(ver.status, 0, `FFMPEG=${FFMPEG} 跑不起來：${ver.stderr}`);
    const wver = tool(CWEBP, ['-version']);
    assert.equal(wver.status, 0, `CWEBP=${CWEBP} 跑不起來：${wver.stderr}`);

    const root = path.join(tmp(t, 'site-media-real-'), 'project');
    fs.mkdirSync(path.join(root, 'release'), { recursive: true });
    const source = {};
    for (const lang of LANGS) {
        const cut = path.join(root, 'release', `demo-dust-1920x1080-${lang}.mp4`);
        const res = tool(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(RELEASE, `demo-dust-1920x1080-${lang}.mp4`), '-t', '2', '-c', 'copy', cut]);
        assert.equal(res.status, 0, `切前 2 秒失敗：${res.stderr}`);
        fs.copyFileSync(path.join(RELEASE, `demo-dust-poster-${lang}.png`), path.join(root, 'release', `demo-dust-poster-${lang}.png`));
        source[lang] = probe(cut);
        assert.equal(source[lang].hasAudio, true, `測試自己的前提：切出來的 ${lang} 還有音軌`);
    }
    return { root, source };
}

test('B3.1 B3.2 B3.3 真工具：真的影片前 2 秒與真的海報 → 沒音軌、長度與解析度不變、WebP 比 PNG 小、media.json 對得上、重跑相同', { skip: SKIP, timeout: 300000 }, (t) => {
    const { root, source } = miniProject(t);
    const beforeRoot = snapshot(root);

    const sys = tmp(t, 'site-media-systmp-');
    const env = { ...process.env, TMPDIR: sys, TEMP: sys, TMP: sys, FFMPEG, CWEBP };
    const cli = (out) => {
        const res = spawnSync(process.execPath, [SCRIPT, '--root', root, '--out', out], { env, encoding: 'utf8', timeout: 120000 });
        assert.equal(res.error, undefined, `命令跑不起來：${res.error && res.error.message}`);
        assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    };

    const out = path.join(tmp(t, 'site-media-out-'), 'media');
    cli(out);
    const media = JSON.parse(fs.readFileSync(path.join(out, 'media.json'), 'utf8'));
    assert.deepEqual(Object.keys(media), LANGS, 'media.json 的語言順序');
    for (const lang of LANGS) {
        const videoFile = path.join(out, `hero-${lang}.mp4`);
        const got = probe(videoFile);
        assert.equal(got.hasAudio, false, `hero-${lang}.mp4 不能有音軌`);
        assert.deepEqual([got.width, got.height], [1920, 1080], `hero-${lang}.mp4 解析度`);
        assert.ok(Math.abs(got.durationSec - source[lang].durationSec) <= 0.05, `hero-${lang}.mp4 長度 ${got.durationSec}，來源 ${source[lang].durationSec}`);

        const pngFile = path.join(root, 'release', `demo-dust-poster-${lang}.png`);
        const posterFile = path.join(out, `hero-poster-${lang}.webp`);
        const poster = fs.readFileSync(posterFile);
        const want = pngSize(fs.readFileSync(pngFile));
        assert.deepEqual(webpSize(poster), want, `hero-poster-${lang}.webp 寬高跟 PNG 一樣`);
        assert.ok(poster.length < fs.statSync(pngFile).size, `hero-poster-${lang}.webp（${poster.length}）要比 PNG（${fs.statSync(pngFile).size}）小`);

        const v = media[lang].video;
        const p = media[lang].poster;
        assert.deepEqual(Object.keys(v), ['file', 'bytes', 'durationSec', 'width', 'height'], 'video 的欄位順序');
        assert.deepEqual(Object.keys(p), ['file', 'bytes', 'width', 'height'], 'poster 的欄位順序');
        assert.deepEqual([v.file, v.bytes, v.width, v.height], [`hero-${lang}.mp4`, fs.statSync(videoFile).size, 1920, 1080], `media.json 的 ${lang}.video`);
        assert.ok(Math.abs(v.durationSec - got.durationSec) < 0.011, `media.json 的 ${lang}.video.durationSec ${v.durationSec}，量到 ${got.durationSec}`);
        assert.deepEqual([p.file, p.bytes, p.width, p.height], [`hero-poster-${lang}.webp`, poster.length, want.width, want.height], `media.json 的 ${lang}.poster`);
    }
    assert.deepEqual(fs.readdirSync(sys), [], '系統暫存資料夾用完是空的');
    assert.deepEqual(snapshot(root), beforeRoot, '小專案根目錄（原檔）一個位元組都不變');

    const first = snapshot(out);
    cli(out);
    assert.deepEqual(snapshot(out), first, '同一個 --out 重跑，位元組相同');
    const other = path.join(tmp(t, 'site-media-out-'), 'media');
    cli(other);
    assert.deepEqual(snapshot(other), first, '另一個 --out 跑，位元組相同');
});

// dwebp 與 magick 跑得起來嗎；跑不起來回 skip 的原因
function pixelTools() {
    if (SKIP) return { skip: SKIP };
    const exe = process.platform === 'win32' ? '.exe' : '';
    const dwebp = process.env.DWEBP || path.join(path.dirname(CWEBP), `dwebp${exe}`);
    const magick = process.env.MAGICK || 'magick';
    for (const [name, file] of [['dwebp', dwebp], ['magick', magick]]) {
        const res = spawnSync(file, ['-version'], { encoding: 'utf8', timeout: 30000 });
        if (res.error || res.status !== 0) return { skip: `找不到能跑的 ${name}（試的是 ${file}；可用環境變數 ${name.toUpperCase()} 指定）` };
    }
    return { skip: false, dwebp, magick };
}
const PIXEL = pixelTools();

test('B3.2 真工具：海報是無損 WebP —— dwebp 解回 PNG 之後跟來源 PNG 逐像素相同（magick compare -metric AE 是 0）', { skip: PIXEL.skip, timeout: 300000 }, (t) => {
    const { root } = miniProject(t);
    const sys = tmp(t, 'site-media-systmp-');
    const out = path.join(tmp(t, 'site-media-out-'), 'media');
    const res = spawnSync(process.execPath, [SCRIPT, '--root', root, '--out', out],
        { env: { ...process.env, TMPDIR: sys, TEMP: sys, TMP: sys, FFMPEG, CWEBP }, encoding: 'utf8', timeout: 120000 });
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    const work = tmp(t, 'site-media-decoded-');
    for (const lang of LANGS) {
        const webp = path.join(out, `hero-poster-${lang}.webp`);
        assert.equal(fs.readFileSync(webp).toString('latin1', 12, 16), 'VP8L', `hero-poster-${lang}.webp 要是無損（VP8L）`);
        const decoded = path.join(work, `${lang}.png`);
        const dec = tool(PIXEL.dwebp, ['-quiet', webp, '-o', decoded]);
        assert.equal(dec.status, 0, `dwebp 解不開 ${webp}：${dec.stderr}`);
        const cmp = tool(PIXEL.magick, ['compare', '-metric', 'AE', path.join(root, 'release', `demo-dust-poster-${lang}.png`), decoded, 'null:']);
        const ae = /^\s*([0-9.e+]+)/i.exec(cmp.stderr || cmp.stdout);
        assert.ok(ae, `magick compare 沒印出數字：${cmp.stderr}${cmp.stdout}`);
        assert.equal(Number(ae[1]), 0, `${lang}：解回來的 PNG 跟來源不同的像素數要是 0，得到 ${ae[1]}（magick 結束碼 ${cmp.status}）`);
    }
});

test('B3.3 真工具：環境變數 CWEBP 是空字串 → 當作沒設、退回 PATH 的 cwebp（PATH 是空資料夾 →「cwebp 跑不起來」「找不到」，不是 Node 的英文錯誤）', { skip: SKIP, timeout: 120000 }, (t) => {
    const ver = tool(FFMPEG, ['-version']);
    assert.equal(ver.status, 0, `FFMPEG=${FFMPEG} 跑不起來：${ver.stderr}`);
    const out = tmp(t, 'site-media-out-');
    const env = { ...process.env, FFMPEG, CWEBP: '' };
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
    env.PATH = tmp(t);
    const res = spawnSync(process.execPath, [SCRIPT, '--root', makeProject(t), '--out', out], { env, encoding: 'utf8', timeout: 60000 });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.doesNotMatch(res.stderr, /cannot be empty|The argument/, `空的 CWEBP 不能被當成工具路徑，得到：${res.stderr}`);
    assert.match(res.stderr, /cwebp 跑不起來/, `得到：${res.stderr}`);
    assert.match(res.stderr, /找不到/, `得到：${res.stderr}`);
    assert.deepEqual(fs.readdirSync(out), [], '--out 不動');
});
