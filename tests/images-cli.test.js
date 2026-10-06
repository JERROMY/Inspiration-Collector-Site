// 圖片轉 WebP 的命令 scripts/images.mjs（目標檔 4-b6 的 B6.4；介面細則見 tests/README.md「4-b6」）。
//
// node scripts/images.mjs --from <素材資料夾> [--out <輸出資料夾，預設 public/images>]；cwebp 的路徑：環境變數 CWEBP（空字串當作沒設），沒設就用 PATH 的 cwebp。
//   來源：--from 那一層（不往下找）副檔名是 .png、.jpg、.jpeg 的檔（大小寫都算）；其他（.svg、.txt、. 開頭的檔）略過，不算壞。
//   每張輸出 <檔名去掉副檔名>-<寬>.webp：寬 640 與 1280，原圖比那個寬度窄（或一樣）就改出原寬、不放大、不重複
//   （1920 → 640、1280；1000 → 640、1000；1280 → 640、1280；300 → 300）。高照比例（四捨五入，誤差 1px）。
//   images.json：JSON.stringify(物件, null, 2) ＋ 換行；鍵是來源檔名（含副檔名）、照字典序排；
//     值剛好 { width, height, sizes }（原圖的寬高），sizes 照寬度由小到大，每筆剛好 { file, width, height, bytes }（輸出檔的實際寬高與大小）。
//   --out 裡只管這批圖產生的 .webp 與 images.json：來源拿掉了，它的 .webp 也拿掉；〔派工 2026-10-02〕不是這批圖產生的 .webp（例如 other-name.webp）與其他檔一律不動。
//   重跑：來源沒變的不重算（.webp 不重寫，修改時間不變）；來源換了才重算那一張。
//   壞檔、讀不了的圖：只壞那一張，其餘照做（寫進 images.json），stderr 最後幾行一張一行列出壞的檔名與原因，結束碼 1。
//   先看來源有沒有圖、再查 cwebp：一張圖都沒有 → 結束碼 1、講「沒有」，--out 不動（路徑給錯不能把 public/images 清空）；
//   cwebp 跑不起來 → 結束碼 1、「cwebp 跑不起來」＋試的路徑＋「找不到」，--out 不動。用法錯誤 → 結束碼 2。
//
// 需要真的 cwebp 的那幾條：找不到就 skip 並寫出原因（環境變數 CWEBP，沒設就用 PATH 的 cwebp；這台 mac 是 /opt/homebrew/bin/cwebp）。
// 來源圖由 tests/fixtures/fake-tools/pixels.js 現組（PNG 是漸層加雜點、JPEG 是整張同一個灰），專案裡不放二進位檔。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.4"
//   CWEBP=/opt/homebrew/bin/cwebp node --test tests/images-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { runScript, usageError, cwebp, webpInfo, snapshot, stamp, tmp } from './b6-fixture.js';
import { pngImage, jpegImage } from './fixtures/fake-tools/pixels.js';

const TOOL = cwebp();
const NEED = TOOL.skip ? TOOL.skip : false;
const WITH_TOOL = TOOL.path ? { CWEBP: TOOL.path } : {};

function images(args, opts = {}) {
    return runScript('images.mjs', args, { ...opts, env: { ...WITH_TOOL, ...(opts.env ?? {}) } });
}

// 來源資料夾（路徑有空白與中文）：每筆 [檔名, 位元組]
function makeSources(t, files) {
    const from = path.join(tmp(t, 'site-images-src-'), '素材 資料夾');
    fs.mkdirSync(from, { recursive: true });
    for (const [name, bytes] of files) fs.writeFileSync(path.join(from, name), bytes);
    return from;
}

function newOut(t) {
    return path.join(tmp(t, 'site-images-out-'), '輸出 資料夾', 'images');
}

// 一組正常的來源：寬的、照片、中等的、剛好 1280 的、比 640 窄的、檔名有中文與空白的、副檔名大寫的，加上該略過的
const MAIN = () => [
    ['wide.png', pngImage(1920, 30, { seed: 1 })],
    ['photo.jpg', jpegImage(2000, 150)],
    ['mid.png', pngImage(1000, 30, { seed: 2 })],
    ['exact.png', pngImage(1280, 24, { seed: 3 })],
    ['small.png', pngImage(300, 20, { seed: 4 })],
    ['步驟 一.png', pngImage(800, 30, { seed: 5 })],
    ['upper.PNG', pngImage(700, 30, { seed: 6 })],
    ['portrait.jpeg', jpegImage(660, 1100, { gray: 60 })],
    ['mark.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>')],
    ['notes.txt', Buffer.from('不是圖片')],
    ['.DS_Store', Buffer.from('mac')],
];
const EXPECT = {
    'wide.png': { width: 1920, height: 30, widths: [640, 1280] },
    'photo.jpg': { width: 2000, height: 150, widths: [640, 1280] },
    'mid.png': { width: 1000, height: 30, widths: [640, 1000] },
    'exact.png': { width: 1280, height: 24, widths: [640, 1280] },
    'small.png': { width: 300, height: 20, widths: [300] },
    '步驟 一.png': { width: 800, height: 30, widths: [640, 800] },
    'upper.PNG': { width: 700, height: 30, widths: [640, 700] },
    'portrait.jpeg': { width: 660, height: 1100, widths: [640, 660] },
};
// 重跑、換一張那兩條用的一小組：要有會縮兩次的 PNG、JPEG、比 640 窄的（之後換掉）、要拿掉的；規則的每一種寬度在「成功」那條量過
const RERUN = ['wide.png', 'photo.jpg', 'small.png', 'mid.png'];
const RERUN_SOURCES = () => MAIN().filter(([name]) => RERUN.includes(name));
const RERUN_EXPECT = Object.fromEntries(RERUN.map((name) => [name, EXPECT[name]]));
const base = (name) => name.replace(/\.[^.]+$/, '');
const outName = (name, width) => `${base(name)}-${width}.webp`;

function readJson(out) {
    const file = path.join(out, 'images.json');
    assert.ok(fs.existsSync(file), '--out 裡要有 images.json');
    const text = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(text);
    assert.equal(text, JSON.stringify(data, null, 2) + '\n', 'images.json 要是 JSON.stringify(…, null, 2) 加一個換行');
    return data;
}

function mtimes(out) {
    return Object.fromEntries(fs.readdirSync(out).filter((n) => n.endsWith('.webp')).map((n) => [n, fs.statSync(path.join(out, n)).mtimeMs]));
}

// 等到檔案系統的時間確實往前走（重寫的話修改時間一定會不同）
function tick() {
    const end = Date.now() + 30;
    while (Date.now() < end) { /* 等 */ }
}

// 檢查一份 images.json 與 --out 裡的 .webp 對得上 expect
function checkOutput(out, expect, { others = [] } = {}) {
    const data = readJson(out);
    assert.deepEqual(Object.keys(data), Object.keys(expect).sort(), 'images.json 的鍵要剛好是那些來源檔名、照字典序（.svg、.txt、. 開頭的不算）');
    const files = [];
    for (const [name, want] of Object.entries(expect)) {
        const entry = data[name];
        assert.deepEqual(Object.keys(entry), ['width', 'height', 'sizes'], `${name}：欄位剛好 width、height、sizes（照這個順序）`);
        assert.equal(entry.width, want.width, `${name}：width 是原圖的寬`);
        assert.equal(entry.height, want.height, `${name}：height 是原圖的高`);
        assert.deepEqual(entry.sizes.map((s) => s.width), want.widths, `${name}：輸出的寬要是 ${want.widths.join('、')}（不放大、不重複、由小到大）`);
        for (const size of entry.sizes) {
            assert.deepEqual(Object.keys(size), ['file', 'width', 'height', 'bytes'], `${name}：sizes 每筆剛好 file、width、height、bytes`);
            assert.equal(size.file, outName(name, size.width), `${name}：輸出檔名要是 <檔名>-<寬>.webp`);
            const full = path.join(out, size.file);
            assert.ok(fs.existsSync(full), `${size.file} 不存在`);
            const buf = fs.readFileSync(full);
            const info = webpInfo(buf);
            assert.equal(info.width, size.width, `${size.file}：實際寬 ${info.width}，images.json 寫 ${size.width}`);
            assert.equal(info.height, size.height, `${size.file}：實際高 ${info.height}，images.json 寫 ${size.height}`);
            assert.equal(size.bytes, buf.length, `${size.file}：bytes 要是檔案的實際大小`);
            const ideal = (want.height * size.width) / want.width;
            assert.ok(Math.abs(info.height - ideal) <= 1, `${size.file}：寬高比要跟原圖一樣（高應該約 ${ideal.toFixed(2)}，得到 ${info.height}）`);
            files.push(size.file);
        }
    }
    const webp = fs.readdirSync(out).filter((n) => n.endsWith('.webp')).sort();
    assert.deepEqual(webp, [...files, ...others].sort(), '--out 裡的 .webp 要剛好是 images.json 列的那些（加上原本就在、不是這批圖產生的）');
    return data;
}

test('B6.4 圖片：成功 —— 每張出 640 與 1280（不夠寬就出原寬）、寬高比對、images.json 對得上；路徑有空白與中文、--out 不存在就建', { skip: NEED }, (t) => {
    const from = makeSources(t, MAIN());
    const before = snapshot(from);
    const out = newOut(t);
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    checkOutput(out, EXPECT);
    assert.deepEqual(snapshot(from), before, '來源資料夾一個位元組都不變');
});

test('B6.4 圖片：寬的圖縮成 640 之後，比原圖小 50% 以上（PNG 與 JPEG 都量）', { skip: NEED }, (t) => {
    const from = makeSources(t, MAIN().filter(([name]) => ['wide.png', 'photo.jpg', 'exact.png'].includes(name)));
    const out = newOut(t);
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    for (const name of ['wide.png', 'photo.jpg', 'exact.png']) {
        const src = fs.statSync(path.join(from, name)).size;
        const small = fs.statSync(path.join(out, outName(name, 640))).size;
        assert.ok(small < src * 0.5, `${outName(name, 640)} 是 ${small} 位元組，要比原圖 ${name}（${src} 位元組）小 50% 以上`);
    }
});

test('B6.4 圖片：重跑不重算 —— .webp 不重寫（修改時間不變）、images.json 位元組相同、結束碼 0', { skip: NEED }, (t) => {
    const from = makeSources(t, RERUN_SOURCES());
    const out = newOut(t);
    assert.equal(images(['--from', from, '--out', out]).status, 0, '第一次要成功');
    const json = fs.readFileSync(path.join(out, 'images.json'));
    const times = mtimes(out);
    const bytes = snapshot(out);
    tick();
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `重跑要成功；stderr：${res.stderr}`);
    assert.ok(fs.readFileSync(path.join(out, 'images.json')).equals(json), 'images.json 位元組相同');
    assert.deepEqual(mtimes(out), times, '來源沒變：.webp 一個都不重寫（修改時間不變）');
    assert.deepEqual(snapshot(out), bytes, '--out 位元組相同');
});

test('B6.4 圖片：來源換了一張 → 只重算那一張；拿掉一張 → 它的 .webp 與 images.json 那一筆都拿掉；--out 裡別的檔不動', { skip: NEED }, (t) => {
    const from = makeSources(t, RERUN_SOURCES());
    const out = newOut(t);
    assert.equal(images(['--from', from, '--out', out]).status, 0, '第一次要成功');
    fs.writeFileSync(path.join(out, 'keep.txt'), '不是我們的檔');
    const times = mtimes(out);
    tick();
    fs.writeFileSync(path.join(from, 'small.png'), pngImage(400, 30, { seed: 9 }));
    fs.rmSync(path.join(from, 'mid.png'));
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    const expect = { ...RERUN_EXPECT, 'small.png': { width: 400, height: 30, widths: [400] } };
    delete expect['mid.png'];
    checkOutput(out, expect);
    assert.ok(!fs.existsSync(path.join(out, 'small-300.webp')), '舊的 small-300.webp 要拿掉');
    assert.ok(!fs.existsSync(path.join(out, 'mid-640.webp')) && !fs.existsSync(path.join(out, 'mid-1000.webp')), '拿掉的 mid.png，它的 .webp 也要拿掉');
    const now = mtimes(out);
    for (const [name, time] of Object.entries(times)) {
        if (name.startsWith('small-') || name.startsWith('mid-')) continue;
        assert.equal(now[name], time, `${name}：來源沒變，不該重寫`);
    }
    assert.equal(fs.readFileSync(path.join(out, 'keep.txt'), 'utf8'), '不是我們的檔', '--out 裡不是 .webp 的檔不動');
});

test('B6.4 圖片：--out 裡不是這批圖產生的 .webp（other-name.webp）不刪、不改 —— 第一次跑、拿掉一張來源再跑都一樣', { skip: NEED }, (t) => {
    const from = makeSources(t, RERUN_SOURCES());
    const out = newOut(t);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'other-name.webp'), 'someone else');
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.equal(fs.readFileSync(path.join(out, 'other-name.webp'), 'utf8'), 'someone else', '第一次跑：other-name.webp 不是這批圖產生的，不能刪、不能改');
    checkOutput(out, RERUN_EXPECT, { others: ['other-name.webp'] });
    fs.rmSync(path.join(from, 'mid.png'));
    const again = images(['--from', from, '--out', out]);
    assert.equal(again.status, 0, `結束碼要是 0；stderr：${again.stderr}`);
    assert.ok(!fs.existsSync(path.join(out, 'mid-640.webp')), '拿掉的 mid.png，它的 .webp 照樣拿掉');
    assert.equal(fs.readFileSync(path.join(out, 'other-name.webp'), 'utf8'), 'someone else', '拿掉一張來源再跑：other-name.webp 還是不能刪');
});

test('B6.4 圖片：壞檔、讀不了的圖只壞那一張 —— 其餘照做、寫進 images.json，最後列出壞的、結束碼 1', { skip: NEED }, (t) => {
    const bad = {
        'broken.png': Buffer.from('這不是 PNG，只是文字'),
        'truncated.png': pngImage(1920, 30).subarray(0, 40),
        'fake.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x03]),
        'empty.png': Buffer.alloc(0),
    };
    const from = makeSources(t, [['good.png', pngImage(1000, 30, { seed: 11 })], ...Object.entries(bad)]);
    const canLock = process.platform !== 'win32' && process.getuid?.() !== 0;
    if (canLock) {
        fs.writeFileSync(path.join(from, 'locked.png'), pngImage(800, 30, { seed: 12 }));
        fs.chmodSync(path.join(from, 'locked.png'), 0o000);
        // after 照登記的順序跑：暫存資料夾可能已經被刪掉了（刪檔不需要那個檔的權限），所以先看在不在
        t.after(() => { if (fs.existsSync(path.join(from, 'locked.png'))) fs.chmodSync(path.join(from, 'locked.png'), 0o644); });
    }
    const names = [...Object.keys(bad), ...(canLock ? ['locked.png'] : [])];
    const out = newOut(t);
    const res = images(['--from', from, '--out', out]);
    assert.equal(res.status, 1, `有壞檔要是結束碼 1，得到 ${res.status}；stderr：${res.stderr}`);
    checkOutput(out, { 'good.png': { width: 1000, height: 30, widths: [640, 1000] } });
    const tail = res.stderr.split(/\r?\n/).filter((line) => line.trim() !== '').slice(-(names.length + 1));
    for (const name of names) {
        const line = tail.find((l) => l.includes(name));
        assert.ok(line, `stderr 最後幾行要列出壞的 ${name}，得到最後幾行：\n${tail.join('\n')}`);
        assert.match(line, /[一-鿿]/, `${name} 那一行要用中文講原因，得到：${line}`);
    }
    for (const name of names) assert.ok(!fs.readdirSync(out).some((n) => n.startsWith(base(name) + '-')), `壞的 ${name} 不該有輸出`);
});

test('B6.4 圖片：一張圖都沒有（空資料夾、只有 .svg 與 .txt）→ 結束碼 1、講「沒有」、--out 不動', (t) => {
    for (const files of [[], [['mark.svg', Buffer.from('<svg/>')], ['notes.txt', Buffer.from('x')]]]) {
        const from = makeSources(t, files);
        const out = newOut(t);
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'old-640.webp'), 'OLD');
        fs.writeFileSync(path.join(out, 'images.json'), '{}\n');
        const before = snapshot(out);
        const missing = path.join(tmp(t), 'no-such-cwebp');
        const res = images(['--from', from, '--out', out], { env: { CWEBP: missing } });
        assert.equal(res.status, 1, `沒有圖要是結束碼 1，得到 ${res.status}；stderr：${res.stderr}`);
        assert.match(res.stderr, /沒有/, `要講來源裡沒有圖（先看來源、再查 cwebp），得到：${res.stderr}`);
        assert.doesNotMatch(res.stderr, /跑不起來/, '先看來源有沒有圖、再查 cwebp');
        assert.deepEqual(snapshot(out), before, '--out 不動（路徑給錯不能把 public/images 清空）');
    }
});

test('B6.4 圖片：CWEBP 指到不存在的檔 → 結束碼 1、「cwebp 跑不起來」＋路徑＋「找不到」、--out 不動', (t) => {
    const from = makeSources(t, [['wide.png', pngImage(1920, 30)]]);
    const out = newOut(t);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'old-640.webp'), 'OLD');
    const before = snapshot(out);
    const missing = path.join(tmp(t), 'env-cwebp');
    const res = images(['--from', from, '--out', out], { env: { CWEBP: missing } });
    assert.equal(res.status, 1, `結束碼要是 1，得到 ${res.status}；stderr：${res.stderr}`);
    assert.match(res.stderr, /cwebp 跑不起來/, `要講「cwebp 跑不起來」，得到：${res.stderr}`);
    assert.ok(res.stderr.includes('env-cwebp'), `要講出試的路徑，得到：${res.stderr}`);
    assert.match(res.stderr, /找不到/, `找不到程式要講「找不到」，得到：${res.stderr}`);
    assert.deepEqual(snapshot(out), before, '--out 不動');
});

test('B6.4 圖片：環境變數 CWEBP 是空字串 → 當作沒設、用 PATH 的 cwebp（PATH 指到空資料夾 → 「cwebp 跑不起來」「找不到」，不是 Node 的英文錯誤）', (t) => {
    const from = makeSources(t, [['wide.png', pngImage(1920, 30)]]);
    const res = images(['--from', from, '--out', newOut(t)], { env: { CWEBP: '', PATH: tmp(t) } });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.doesNotMatch(res.stderr, /cannot be empty|The argument/, `空的環境變數不能被當成工具路徑，得到：${res.stderr}`);
    assert.match(res.stderr, /cwebp 跑不起來/, `得到：${res.stderr}`);
    assert.match(res.stderr, /找不到/, `得到：${res.stderr}`);
});

for (const [label, args] of [
    ['沒給 --from', ['--out', '<out>']],
    ['--from 缺值', ['--out', '<out>', '--from']],
    ['--from=（空字串）', ['--from=', '--out', '<out>']],
    ['--out=（空字串）', ['--from', '<from>', '--out=']],
    ['不認得的參數 --bogus', ['--from', '<from>', '--out', '<out>', '--bogus']],
    ['多出來的位置參數 extra', ['--from', '<from>', '--out', '<out>', 'extra']],
    ['--from 不存在', ['--from', '<missing>', '--out', '<out>']],
    ['--from 是一個檔', ['--from', '<file>', '--out', '<out>']],
]) {
    test(`B6.4 圖片：用法錯誤（${label}）→ 結束碼 2、中文、不碰 cwebp、不寫任何檔、cwd 沒多東西`, (t) => {
        const from = makeSources(t, [['wide.png', pngImage(640, 360)]]);
        const out = newOut(t);
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, 'old-640.webp'), 'OLD');
        const before = snapshot(out);
        const cwd = tmp(t, 'site-images-cwd-');
        const file = path.join(tmp(t), 'a-file.png');
        fs.writeFileSync(file, pngImage(10, 10));
        const map = { '<from>': from, '<out>': out, '<missing>': path.join(tmp(t), 'no-such-folder'), '<file>': file };
        const res = images(args.map((arg) => map[arg] ?? arg), { cwd, env: { CWEBP: path.join(tmp(t), 'no-such-cwebp') } });
        usageError(res, label);
        assert.doesNotMatch(res.stderr, /跑不起來/, `${label}：用法錯誤要在碰 cwebp 之前就停`);
        assert.deepEqual(snapshot(out), before, `${label}：--out 不動`);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：cwd 不能多出任何檔`);
    });
}

test('B6.5 圖片：給了 --out 時，homepage/site/ 底下一個檔都不動', { skip: NEED }, (t) => {
    const from = makeSources(t, [['small.png', pngImage(300, 20)]]);
    const before = stamp(SITE);
    const res = images(['--from', from, '--out', newOut(t)], { cwd: tmp(t) });
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下不能有檔被改、被加、被刪');
});

test('B6.4 圖片：README.md 寫了哪種圖用無損、哪種用有損，照副檔名或檔名判斷', () => {
    const readme = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const paragraphs = readme.split(/\r?\n\s*\r?\n/);
    const hit = paragraphs.find((p) => /npm run images|scripts\/images\.mjs/.test(p) && p.includes('無損') && p.includes('有損') && /副檔名|檔名/.test(p));
    assert.ok(hit, 'README.md 要有一段同時寫到 npm run images（或 scripts/images.mjs）、「無損」「有損」，以及照「副檔名」或「檔名」判斷用哪一種');
});
