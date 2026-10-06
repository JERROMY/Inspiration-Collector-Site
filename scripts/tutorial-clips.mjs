// 教學影片一章一支（2026-10-07 使用者決定：影片放在自己的網站上播，不嵌 YouTube；「在 YouTube 上看」照樣連過去）。
//
//   node scripts/tutorial-clips.mjs --src <放 tutorial-1920x1080-<語言>.mp4 的資料夾（GPTPlugins 的 tutorial/preview/）> [--ffmpeg <ffmpeg>]
//
// 讀 data/chapters.<語言>.json 的 start／end（秒），從無聲版切出每一章，寫 public/media/tutorial/<語言>/<章>.mp4（01～16）。
// 不帶音軌（-an）：使用者 2026-10-07「音樂沒什麼意義，YouTube 上有就好，網站上的 mute」—— 配樂只在 YouTube 那三支。
// 為什麼一章一支：Cloudflare Pages 單一檔案最大 25 MiB，整支 9 分鐘放不下；網站的播放器本來就是一章一章播（播完蓋章尾那一層）。
// 壓法：H.264 high、CRF 23、preset slow、yuv420p、沒有音軌、faststart（開頭就有索引，不用下載完才播）。
//   畫面多半是介面與字，CRF 23 跟原片看不出差別；最長的第 09 章（46 秒）約 3.7 MB，三語 48 支合計約 110 MB。
// 影片檔（GPTPlugins 的 tutorial/preview/）不在這個 repo：這支在有影片的那台電腦跑，產出的 mp4 進 git（同 scripts/media.mjs 的做法）。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf('--' + name); return i === -1 ? fallback : process.argv[i + 1]; };
const SRC = arg('src');
const FFMPEG = arg('ffmpeg', 'ffmpeg');
if (!SRC) { console.error('用法：node scripts/tutorial-clips.mjs --src <資料夾> [--ffmpeg <ffmpeg>]'); process.exit(2); }

let total = 0;
for (const lang of ['zh', 'en', 'ja']) {
    const input = path.join(SRC, `tutorial-1920x1080-${lang}.mp4`);
    if (!fs.existsSync(input)) { console.error('找不到：' + input); process.exit(1); }
    const chapters = JSON.parse(fs.readFileSync(path.join(SITE, 'data', `chapters.${lang}.json`), 'utf8'));
    const outDir = path.join(SITE, 'public', 'media', 'tutorial', lang);
    fs.mkdirSync(outDir, { recursive: true });
    for (const ch of chapters) {
        const out = path.join(outDir, `${ch.id}.mp4`);
        const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
            '-ss', String(ch.start), '-to', String(ch.end), '-i', input,
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
            '-an', '-movflags', '+faststart', out], { stdio: ['ignore', 'inherit', 'inherit'] });
        if (r.status !== 0) { console.error(`壓 ${lang}/${ch.id} 失敗`); process.exit(1); }
        const size = fs.statSync(out).size;
        if (size > 25 * 1024 * 1024) { console.error(`${lang}/${ch.id}.mp4 ${(size / 1048576).toFixed(1)} MB，超過 Cloudflare Pages 單檔 25 MiB`); process.exit(1); }
        total += size;
        console.log(`${lang}/${ch.id}.mp4  ${ch.end - ch.start} 秒  ${(size / 1048576).toFixed(1)} MB`);
    }
}
console.log(`合計 ${(total / 1048576).toFixed(1)} MB`);
