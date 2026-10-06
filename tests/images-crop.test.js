// 4-b13 的 B13.1：scripts/images.mjs 的裁切設定（每張圖指定裁切框、輸出 640／1280／1920 寬）。介面細則見 tests/README.md「4-b13」。真的開子程序跑、在暫存資料夾真的寫檔。
//
// 量什麼（不需要 cwebp 的，必過）：設定檔壞掉、框的欄位不對（缺、不是整數、負數、寬高 0）、框超出原圖、widths 不對、--config 指到不存在的檔、
//   --config 給的設定檔有一張 --from 裡沒有的圖 → 結束碼 1、stderr 第一行中文、講出那張圖（與欄位或框）、沒有堆疊、--out 一個位元組都不動、--from 不變；--config= 空字串 → 結束碼 2。
// 量什麼（要 cwebp，找不到就 skip；量像素的另外要 dwebp）：
//   裁切：輸出寬度 ＝ widths 每個取「它」與框寬之中小的那個（不放大、不重複），高 ＝ 框高 × 寬 ÷ 框寬四捨五入；框寬夠的圖出 640／1280／1920 三張；
//   檔名照舊 <來源檔名去掉副檔名>-<寬>.webp；images.json 那一筆 { width, height, crop: { x, y, width, height }, sizes }（width、height 是原圖的）；
//   沒有設定的圖照舊（{ width, height, sizes }，640／1280）；
//   幾何：框寬比最小的寬度還窄時輸出就是框的原寸，無損 —— 解開來跟手切原圖的像素逐一相同（x、y 對調、忽略框都會不一樣）；
//   冪等：重跑位元組相同、不重寫（修改時間不變）；**改了框（寬高一樣、只換位置）重跑要重算**；原檔一個位元組都不變；homepage/site/ 不動。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B13.1"
//   CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "B13.1"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { patternPng, pixelAt, decodeWebp, dwebp, runImages, usageError, tmp, snapshot, stamp, cwebp } from './images-crop-fixture.js';

const CROP = { x: 37, y: 11, width: 120, height: 50 };
const WIDE_CROP = { x: 20, y: 2, width: 1960, height: 20 };

// 素材資料夾（名字有空白與中文）：pattern.png 300×200（有裁切框、框比 640 窄 → 原寸）、wide.png 2000×24（框 1960 寬 → 640／1280／1920）、plain.png 300×20（沒有設定）
function setup(t, config) {
    const base = tmp(t, 'site-crop-');
    const from = path.join(base, '素材 資料夾');
    fs.mkdirSync(from);
    fs.writeFileSync(path.join(from, 'pattern.png'), patternPng(300, 200));
    fs.writeFileSync(path.join(from, 'wide.png'), patternPng(2000, 24));
    fs.writeFileSync(path.join(from, 'plain.png'), patternPng(300, 20));
    const configFile = path.join(base, '設定 檔.json');
    fs.writeFileSync(configFile, typeof config === 'string' ? config : JSON.stringify(config ?? {
        'pattern.png': { crop: CROP, widths: [640, 1280, 1920] },
        'wide.png': { crop: WIDE_CROP, widths: [640, 1280, 1920] },
    }, null, 2));
    const out = path.join(base, '輸出 資料夾');
    return { base, from, configFile, out };
}

function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊：\n${res.stderr}`);
}

function oldOut(out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'pattern-120.webp'), 'old');
    fs.writeFileSync(path.join(out, 'images.json'), '{}\n');
    return snapshot(out);
}

// ── 設定檔壞掉（不需要 cwebp）──

test('B13.1 設定檔壞掉、框不對、框超出原圖、widths 不對 → 結束碼 1、講出那張圖、--out 與 --from 都不動', (t) => {
    const cases = [
        ['設定檔不是 JSON', '{ not json', [/JSON/]],
        ['設定檔是陣列', '[]', [/設定/]],
        ['框缺 height', { 'pattern.png': { crop: { x: 0, y: 0, width: 10 } } }, ['pattern.png', 'height']],
        ['框的 x 不是整數', { 'pattern.png': { crop: { ...CROP, x: 1.5 } } }, ['pattern.png', 'x']],
        ['框的 y 是負數', { 'pattern.png': { crop: { ...CROP, y: -1 } } }, ['pattern.png', 'y']],
        ['框的寬是 0', { 'pattern.png': { crop: { ...CROP, width: 0 } } }, ['pattern.png', 'width']],
        ['框的高是負數', { 'pattern.png': { crop: { ...CROP, height: -5 } } }, ['pattern.png', 'height']],
        ['框超出原圖的右邊', { 'pattern.png': { crop: { x: 200, y: 0, width: 101, height: 10 } } }, ['pattern.png', /300/]],
        ['框超出原圖的下面', { 'pattern.png': { crop: { x: 0, y: 150, width: 10, height: 51 } } }, ['pattern.png', /200/]],
        ['widths 是空的', { 'pattern.png': { crop: CROP, widths: [] } }, ['pattern.png', 'widths']],
        ['widths 有 0', { 'pattern.png': { crop: CROP, widths: [640, 0] } }, ['pattern.png', 'widths']],
        ['--from 裡沒有這張圖', { 'nobody.png': { crop: CROP } }, ['nobody.png']],
    ];
    for (const [label, config, words] of cases) {
        const { from, configFile, out } = setup(t, config);
        const before = oldOut(out);
        const source = snapshot(from);
        const res = runImages(['--from', from, '--out', out, '--config', configFile]);
        failed(res, label);
        for (const word of words) assert.ok(typeof word === 'string' ? res.stderr.includes(word) : word.test(res.stderr), `${label}：stderr 要講到 ${word}；stderr：${res.stderr}`);
        assert.deepEqual(snapshot(out), before, `${label}：--out 一個位元組都不動（不寫半套）`);
        assert.deepEqual(snapshot(from), source, `${label}：原檔不動`);
    }
});

test('B13.1 --config 指到不存在的檔 → 結束碼 1、講出那個檔；--config= 空字串 → 用法錯誤 2', (t) => {
    const { base, from, out } = setup(t);
    const missing = path.join(base, '沒有 這個.json');
    const res = runImages(['--from', from, '--out', out, '--config', missing]);
    failed(res, '--config 不存在');
    assert.ok(res.stderr.includes('沒有 這個.json'), `講出那個檔：${res.stderr}`);
    assert.ok(!fs.existsSync(out), '--out 不建');
    usageError(runImages(['--from', from, '--out', out, '--config=']), '--config 空字串');
});

// ── 要 cwebp 的 ──

function needCwebp(t) {
    const tool = cwebp();
    if (!tool.path) {
        t.skip(tool.skip);
        return null;
    }
    return { CWEBP: tool.path };
}

test('B13.1 裁切：寬度不放大（框 120 → 120；框 1960 → 640／1280／1920），高照框的比例，檔名照舊，images.json 多一個 crop', (t) => {
    const env = needCwebp(t);
    if (!env) return;
    const { from, configFile, out } = setup(t);
    const source = snapshot(from);
    const res = runImages(['--from', from, '--out', out, '--config', configFile], { env });
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    const json = JSON.parse(fs.readFileSync(path.join(out, 'images.json'), 'utf8'));
    assert.deepEqual(Object.keys(json), ['pattern.png', 'plain.png', 'wide.png'], 'images.json 的鍵照 sort()');
    assert.deepEqual(Object.keys(json['wide.png']), ['width', 'height', 'crop', 'sizes'], '有裁切的那一筆：width、height、crop、sizes，照這個順序');
    assert.deepEqual(json['wide.png'].crop, WIDE_CROP, 'crop 照設定檔');
    assert.equal(json['wide.png'].width, 2000, 'width、height 是原圖的');
    assert.equal(json['wide.png'].height, 24);
    const sizes = (name) => json[name].sizes.map(({ file, width, height }) => [file, width, height]);
    assert.deepEqual(sizes('wide.png'), [['wide-640.webp', 640, 7], ['wide-1280.webp', 1280, 13], ['wide-1920.webp', 1920, 20]], '框 1960×20 → 640×7、1280×13、1920×20（高 ＝ 框高×寬÷框寬 四捨五入）');
    assert.deepEqual(sizes('pattern.png'), [['pattern-120.webp', 120, 50]], '框 120×50 比 640 窄：只出原寸 120×50（不放大）');
    assert.deepEqual(Object.keys(json['plain.png']), ['width', 'height', 'sizes'], '沒有設定的圖照舊：沒有 crop');
    assert.deepEqual(sizes('plain.png'), [['plain-300.webp', 300, 20]], '沒有設定的圖照舊（640／1280 各取跟原寬比小的）');
    for (const name of Object.keys(json)) for (const size of json[name].sizes) {
        const file = path.join(out, size.file);
        assert.ok(fs.existsSync(file), `${size.file} 要寫出來`);
        assert.equal(size.bytes, fs.statSync(file).size, `${size.file} 的 bytes 要對`);
    }
    assert.deepEqual(snapshot(from), source, '原檔一個位元組都不變');
});

test('B13.1 裁切的幾何：原寸的那一張解開來，跟用同一個框手切原圖的像素逐一相同', (t) => {
    const env = needCwebp(t);
    if (!env) return;
    const decoder = dwebp();
    if (!decoder.path) {
        t.skip(decoder.skip);
        return;
    }
    const { from, configFile, out } = setup(t);
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    const img = decodeWebp(path.join(out, 'pattern-120.webp'));
    assert.equal(img.width, CROP.width);
    assert.equal(img.height, CROP.height);
    let wrong = 0;
    let first = null;
    for (let y = 0; y < CROP.height; y += 1) {
        for (let x = 0; x < CROP.width; x += 1) {
            const at = (y * img.width + x) * img.depth;
            const got = [img.pixels[at], img.pixels[at + 1], img.pixels[at + 2]];
            const want = pixelAt(x + CROP.x, y + CROP.y);
            if (got.some((v, i) => v !== want[i])) {
                wrong += 1;
                first ??= `(${x}, ${y}) 要 ${want} 得到 ${got}`;
            }
        }
    }
    assert.equal(wrong, 0, `裁出來的 ${CROP.width}×${CROP.height} 個像素要跟原圖 (${CROP.x}, ${CROP.y}) 起那一塊一模一樣，有 ${wrong} 個不同，第一個：${first}`);
});

test('B13.1 冪等：重跑位元組相同、不重寫；改了框的位置（寬高一樣）重跑要重算；拿掉輸出再跑位元組相同', (t) => {
    const env = needCwebp(t);
    if (!env) return;
    const { from, configFile, out } = setup(t);
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    const first = snapshot(out);
    const mtime = fs.statSync(path.join(out, 'wide-1920.webp')).mtimeMs;
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    assert.deepEqual(snapshot(out), first, '重跑：位元組相同');
    assert.equal(fs.statSync(path.join(out, 'wide-1920.webp')).mtimeMs, mtime, '重跑：不重寫（修改時間不變）');
    for (const name of fs.readdirSync(out)) fs.rmSync(path.join(out, name));
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    assert.deepEqual(snapshot(out), first, '拿掉輸出再跑：位元組相同');
    fs.writeFileSync(configFile, JSON.stringify({ 'pattern.png': { crop: { ...CROP, x: CROP.x + 5 }, widths: [640, 1280, 1920] }, 'wide.png': { crop: WIDE_CROP, widths: [640, 1280, 1920] } }));
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    const moved = JSON.parse(fs.readFileSync(path.join(out, 'images.json'), 'utf8'))['pattern.png'];
    assert.equal(moved.crop.x, CROP.x + 5, 'images.json 的 crop 跟著改');
    assert.ok(!fs.readFileSync(path.join(out, 'pattern-120.webp')).equals(first['pattern-120.webp']), '框換了位置（寬高一樣）：pattern-120.webp 要重算，不能沿用舊的');
});

test('B13.1 給了 --out 跑完，homepage/site/ 底下每個檔都不變', (t) => {
    const env = needCwebp(t);
    if (!env) return;
    const { from, configFile, out } = setup(t);
    const before = stamp(SITE);
    assert.equal(runImages(['--from', from, '--out', out, '--config', configFile], { env }).status, 0);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不動');
});

test('B13.1 不給 --config 用預設的 scripts/images.config.json；裡面有、--from 裡沒有的圖 → 只印「警告」、照常轉（結束碼不因此變 1）', (t) => {
    const env = needCwebp(t);
    if (!env) return;
    const defaults = path.join(SITE, 'scripts', 'images.config.json');
    assert.ok(fs.existsSync(defaults), '缺 scripts/images.config.json（後端之後實作）');
    const { from, out } = setup(t);
    const res = runImages(['--from', from, '--out', out], { env });
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.match(res.stderr, /警告/, '預設設定檔裡的大綱圖不在這個 --from：要印警告');
    assert.match(res.stderr, /ai-outline-zh\.png/, '警告要講出是哪張圖');
    const json = JSON.parse(fs.readFileSync(path.join(out, 'images.json'), 'utf8'));
    assert.deepEqual(Object.keys(json['pattern.png']), ['width', 'height', 'sizes'], '預設設定檔沒有 pattern.png：不裁切');
});
