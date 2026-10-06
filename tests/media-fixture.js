// 素材處理的測試共用的東西（4-b3；不是測試，scripts/test.mjs 只跑 *.test.js）。
//
// LANGS                       三種語言，順序就是 media.json 的順序
// FAKE_FFMPEG / FAKE_CWEBP    tests/fixtures/fake-tools/ 的假工具（node 腳本；壞法用環境變數控制，寫在各自檔頭）
// tmp(t)                      開一個暫存資料夾（在載入時的系統暫存資料夾裡，不受 systemTmp 影響），測試結束刪掉
// makeProject(t, opts)        在暫存資料夾做一個假的專案根目錄：release/demo-dust-1920x1080-<語言>.mp4（假影片，63.02 秒、1920x1080、有音軌）
//                             與 release/demo-dust-poster-<語言>.png（1920x1080，三張大小不同，約 40 KB）。opts.langs 預設三種。
// fakeRun(env)                注入給 runMedia 的 run：spawnSync(process.execPath, [工具, …參數])，所以「工具」要傳假工具腳本的路徑；
//                             env 疊在 process.env 上（FAKE_FFMPEG、FAKE_ONLY、FAKE_LOG …）。
// snapshot(dir)               整個資料夾（含子資料夾）{ 相對路徑（/ 分隔）: Buffer }；資料夾不存在回 null
// systemTmp(t)                把 TMPDIR／TEMP／TMP 指到一個新的空資料夾（os.tmpdir() 每次都重讀這幾個環境變數），測試結束還原；回傳那個資料夾的真實路徑
// readLog(file)               假工具的呼叫紀錄 [{ tool, args }]
// inside(child, parent)       child 在 parent 底下（都先取真實路徑；mac 的 /var 是 /private/var 的捷徑）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FIXTURES } from './helpers.js';
import { png } from './fixtures/fake-tools/images.js';

export const LANGS = ['zh', 'en', 'ja'];
export const FAKE_FFMPEG = path.join(FIXTURES, 'fake-tools', 'ffmpeg.mjs');
export const FAKE_CWEBP = path.join(FIXTURES, 'fake-tools', 'cwebp.mjs');
export const SOURCE_SEC = 63.02;
export const POSTER_BYTES = { zh: 40000, en: 41000, ja: 42000 };
// 載入時就記下來：systemTmp() 會改 TMPDIR，之後開的測試用資料夾不能跑進被量的那個暫存資料夾裡
const BASE_TMP = os.tmpdir();

export function tmp(t, prefix = 'site-media-') {
    const dir = fs.mkdtempSync(path.join(BASE_TMP, prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return fs.realpathSync(dir);
}

export function fakeVideo({ durationSec = SOURCE_SEC, width = 1920, height = 1080, audio = true } = {}) {
    return JSON.stringify({ fake: 'mp4', durationSec, width, height, audio });
}

export function makeProject(t, { langs = LANGS } = {}) {
    const root = path.join(tmp(t, 'site-media-root-'), 'project');
    const release = path.join(root, 'release');
    fs.mkdirSync(release, { recursive: true });
    for (const lang of langs) {
        fs.writeFileSync(path.join(release, `demo-dust-1920x1080-${lang}.mp4`), fakeVideo());
        fs.writeFileSync(path.join(release, `demo-dust-poster-${lang}.png`), png(1920, 1080, { size: POSTER_BYTES[lang] }));
    }
    return root;
}

export function fakeRun(env = {}) {
    return (command, args) => spawnSync(process.execPath, [command, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
        timeout: 30000,
    });
}

export function snapshot(dir) {
    if (!fs.existsSync(dir)) return null;
    const out = {};
    const walk = (abs, rel) => {
        for (const name of fs.readdirSync(abs).sort()) {
            const full = path.join(abs, name);
            const key = rel ? `${rel}/${name}` : name;
            if (fs.statSync(full).isDirectory()) {
                out[`${key}/`] = null;
                walk(full, key);
            } else {
                out[key] = fs.readFileSync(full);
            }
        }
    };
    walk(dir, '');
    return out;
}

export function systemTmp(t) {
    const dir = tmp(t, 'site-media-systmp-');
    const saved = { TMPDIR: process.env.TMPDIR, TEMP: process.env.TEMP, TMP: process.env.TMP };
    for (const key of Object.keys(saved)) process.env[key] = dir;
    t.after(() => {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    return dir;
}

export function readLog(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function inside(child, parent) {
    const real = (p) => {
        let probe = path.resolve(p);
        const rest = [];
        while (!fs.existsSync(probe)) {
            rest.unshift(path.basename(probe));
            probe = path.dirname(probe);
        }
        return path.join(fs.realpathSync(probe), ...rest);
    };
    const rel = path.relative(real(parent), real(child));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
