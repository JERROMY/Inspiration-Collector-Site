// 4-b13 的 B13.1、B13.2：真的素材（設計稿的 assets 資料夾）與提交進來的 public/images/、scripts/images.config.json。介面細則見 tests/README.md「4-b13」。
//
// 量什麼：
//   提交進來的 scripts/images.config.json：
//     〔派工 2026-10-03 改〕裁切框 ＝ 實際露出的矩形（tests/fixtures/images-crop/visible-rects.json，設計稿 350fdf4 與前端 c5b3787 三語 × 24 種寬度量的）的聯集，四邊各多留 2 原圖像素：
//     三語大綱圖（07，ai-outline-{zh,en,ja}.png）{ x: 297, y: 140, width: 1017, height: 566 }；
//     終端機截圖（05 第 3 張，ai-terminal-{zh,en,ja}.png）中文 { x: 277, y: 137, width: 781, height: 657 }、英日 { x: 277, y: 137, width: 805, height: 657 }；
//     widths 都是 [640, 1280, 1920]（取小、不放大：大綱圖出 640／1017，終端機出 640／781 或 805）。
//   〔派工 2026-10-03 加〕露出的矩形都在裁切框內（容許 0 像素）：拿 visible-rects.json 的每一筆對提交進來的 scripts/images.config.json。
//   提交進來的 public/images/images.json：這六張那一筆有同一個 crop，sizes 照「widths 每個取它與框寬之中小的」，檔案都在。
//   設了 SITE_ASSETS（真的素材資料夾）＋找得到 cwebp 才跑：
//     用設定檔跑一次（--out 暫存）→ 結束碼 0、提交進來的 public/images/ 每個檔與 images.json 跟重跑的位元組相同（不同就要重跑 npm run images 再提交）；
//     不裁切跑一次（空的設定檔）→ 六張裁切後最大那張比不裁切的 1280 小（位元組；大綱圖原本瀏覽器下載的就是那張 1280）。
//     提交進來的 public/images/ 的 .webp 與 images.json 剛好是重跑產出的那些（多了終端機截圖三語是預期的）。
//     （〔派工 2026-10-03 定〕不比 640：裁切後的 640 字比較密，無損壓起來比不裁切的 640 大，見 README「4-b13」。）
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B13.1 提交|B13.1 真的素材"
//   SITE_ASSETS=<設計稿的 assets 資料夾> CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "B13.1 真的素材"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { runImages, tmp, cwebp } from './images-crop-fixture.js';

const LANGS = ['zh', 'en', 'ja'];
const WIDTHS = [640, 1280, 1920];
const capped = (width) => [...new Set(WIDTHS.map((w) => Math.min(w, width)))];
// 來源檔名 → 裁切框（實際露出的矩形的聯集＋四邊各 2 原圖像素；量的表在 tests/fixtures/images-crop/visible-rects.json）
const CROPS = Object.fromEntries(LANGS.flatMap((lang) => [
    [`ai-outline-${lang}.png`, { x: 297, y: 140, width: 1017, height: 566 }],
    [`ai-terminal-${lang}.png`, { x: 277, y: 137, width: lang === 'zh' ? 781 : 805, height: 657 }],
]));
const VISIBLE = JSON.parse(fs.readFileSync(path.join(SITE, 'tests', 'fixtures', 'images-crop', 'visible-rects.json'), 'utf8')).rows;

test('B13.1 量的表：聯集＋四邊各 2 像素就是 CROPS（測試自己的防呆：表或 CROPS 改了一邊，這條先紅）', () => {
    assert.equal(VISIBLE.length, 2 * 3 * 24 * 2, '兩個版本 × 三語 × 24 種寬度 × 兩張圖');
    for (const [name, crop] of Object.entries(CROPS)) {
        const rows = VISIBLE.filter((r) => r.image === name);
        const x0 = Math.max(0, Math.floor(Math.min(...rows.map((r) => r.x))) - 2);
        const y0 = Math.max(0, Math.floor(Math.min(...rows.map((r) => r.y))) - 2);
        const x1 = Math.min(1920, Math.ceil(Math.max(...rows.map((r) => r.x + r.w))) + 2);
        const y1 = Math.min(1080, Math.ceil(Math.max(...rows.map((r) => r.y + r.h))) + 2);
        assert.deepEqual({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, crop, `${name}：量的表算出來的框`);
    }
});

test('B13.1 露出的矩形都在裁切框內：設計稿與換圖之前的網站，三語 × 24 種寬度，每一筆都在提交進來的 scripts/images.config.json 的框裡（容許 0 像素）', () => {
    const file = path.join(SITE, 'scripts', 'images.config.json');
    assert.ok(fs.existsSync(file), '缺 scripts/images.config.json（後端之後實作）');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    const out = [];
    for (const r of VISIBLE) {
        const crop = config[r.image]?.crop;
        if (!crop) { out.push(`${r.image}：設定檔沒有裁切框`); continue; }
        const over = [];
        if (r.x < crop.x) over.push(`左 ${(crop.x - r.x).toFixed(1)}`);
        if (r.y < crop.y) over.push(`上 ${(crop.y - r.y).toFixed(1)}`);
        if (r.x + r.w > crop.x + crop.width) over.push(`右 ${(r.x + r.w - crop.x - crop.width).toFixed(1)}`);
        if (r.y + r.h > crop.y + crop.height) over.push(`下 ${(r.y + r.h - crop.y - crop.height).toFixed(1)}`);
        if (over.length) out.push(`${r.site} ${r.lang} ${r.mode} ${r.width}：${r.image} 露出 (${r.x}, ${r.y}) ${r.w}×${r.h}，超出框 ${over.join('、')} 原圖像素`);
    }
    assert.deepEqual([...new Set(out)].slice(0, 12), [], `露出的矩形要完全在裁切框裡（共 ${out.length} 筆超出，列前 12 筆）`);
});

test('B13.1 提交進來的 scripts/images.config.json：三語大綱圖與終端機截圖的裁切框與寬度', () => {
    const file = path.join(SITE, 'scripts', 'images.config.json');
    assert.ok(fs.existsSync(file), '缺 scripts/images.config.json（後端之後實作）');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(config).sort(), Object.keys(CROPS).sort(), '設定檔剛好這六張');
    for (const [name, crop] of Object.entries(CROPS)) assert.deepEqual(config[name], { crop, widths: WIDTHS }, `${name} 的設定`);
});

test('B13.1 提交進來的 public/images/images.json：大綱圖與終端機截圖有 crop、寬度照框寬（不放大）、檔案都在', () => {
    const json = JSON.parse(fs.readFileSync(path.join(SITE, 'public', 'images', 'images.json'), 'utf8'));
    for (const [name, crop] of Object.entries(CROPS)) {
        const entry = json[name];
        assert.ok(entry, `images.json 要有 ${name}`);
        assert.deepEqual(Object.keys(entry), ['width', 'height', 'crop', 'sizes'], `${name}：width、height、crop、sizes`);
        assert.deepEqual([entry.width, entry.height], [1920, 1080], `${name}：width、height 是原圖的`);
        assert.deepEqual(entry.crop, crop, `${name} 的 crop`);
        const stem = name.replace(/\.png$/, '');
        assert.deepEqual(entry.sizes.map((s) => [s.file, s.width, s.height]),
            capped(crop.width).map((w) => [`${stem}-${w}.webp`, w, Math.round((crop.height * w) / crop.width)]), `${name} 的 sizes`);
        for (const size of entry.sizes) {
            const file = path.join(SITE, 'public', 'images', size.file);
            assert.ok(fs.existsSync(file), `public/images/${size.file} 要提交`);
            assert.equal(fs.statSync(file).size, size.bytes, `public/images/${size.file} 的 bytes 跟 images.json 一樣`);
        }
    }
});

test('B13.1 真的素材：提交進來的 public/images/ 跟重跑相同；裁切後最大那張比不裁切的 1280 小（SITE_ASSETS）', (t) => {
    const assets = process.env.SITE_ASSETS;
    if (!assets) {
        t.skip('沒設 SITE_ASSETS（設計稿的 assets 資料夾）：真的素材這一條不跑');
        return;
    }
    const tool = cwebp();
    if (!tool.path) {
        t.skip(tool.skip);
        return;
    }
    for (const name of Object.keys(CROPS)) assert.ok(fs.existsSync(path.join(assets, name)), `SITE_ASSETS=${assets} 裡沒有 ${name}（路徑打錯不能靜靜略過）`);
    const base = tmp(t, 'site-crop-real-');
    const cropped = path.join(base, 'cropped');
    let res = runImages(['--from', assets, '--out', cropped, '--config', path.join(SITE, 'scripts', 'images.config.json')], { env: { CWEBP: tool.path } });
    assert.equal(res.status, 0, `用設定檔跑：結束碼 0，得到 ${res.status}；stderr：${res.stderr}`);
    const committed = path.join(SITE, 'public', 'images');
    assert.deepEqual(fs.readdirSync(committed).filter((n) => n.endsWith('.webp') || n === 'images.json').sort(), fs.readdirSync(cropped).sort(), 'public/images/ 的 .webp 與 images.json 剛好是重跑產出的那些（不多不少）');
    for (const name of fs.readdirSync(cropped)) {
        assert.ok(fs.existsSync(path.join(committed, name)), `public/images/${name} 要提交`);
        assert.ok(fs.readFileSync(path.join(committed, name)).equals(fs.readFileSync(path.join(cropped, name))), `public/images/${name} 跟重跑的不同：請重跑 npm run images 再提交`);
    }
    const emptyConfig = path.join(base, 'empty.json');
    fs.writeFileSync(emptyConfig, '{}\n');
    const plain = path.join(base, 'plain');
    res = runImages(['--from', assets, '--out', plain, '--config', emptyConfig], { env: { CWEBP: tool.path } });
    assert.equal(res.status, 0, `不裁切跑：結束碼 0，得到 ${res.status}；stderr：${res.stderr}`);
    for (const [name, crop] of Object.entries(CROPS)) {
        const stem = name.replace(/\.png$/, '');
        const size = (dir, w) => fs.statSync(path.join(dir, `${stem}-${w}.webp`)).size;
        const largest = Math.max(...capped(crop.width));
        // 〔派工 2026-10-03 定〕不比 640：瀏覽器原本在任何寬度都只用不裁切的 1280，640 從來沒被下載；裁切後的 640 是把 1017 寬的字縮成 640，字比較密，
        // 無損壓起來反而比不裁切的 640 大（2026-10-03 量的：大綱圖 zh 110,432 對 51,404）。只要求裁切後最大那張比不裁切的 1280 小
        assert.ok(size(cropped, largest) < size(plain, 1280), `${name}：裁切後最大那張（${largest}）要比不裁切的 1280 小（${size(cropped, largest)} 對 ${size(plain, 1280)}）`);
    }
});
