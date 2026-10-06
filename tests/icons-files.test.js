// 4-b14 的 F8.5d：圖示驗收（回歸測試；圖示是前端 4-f2 放進 public/ 的）。只讀 PNG，不開瀏覽器。介面細則見 tests/README.md「4-b14」。
//
// 量什麼（public/ 底下七張，規格見設計稿 design/homepage/icons/site/README.md）：
//   寬高：favicon-16 16、favicon-32 32、apple-touch-icon 180、icon-192 192、icon-512 512、icon-maskable-192 192、icon-maskable-512 512（PNG 檔頭與解出來的像素都量）。
//   四個角：透明的（favicon-16、favicon-32、icon-192、icon-512）alpha 0；不透明的（apple-touch-icon、兩張 maskable）alpha 255（沒有 alpha 通道的 RGB 算 255）。
//     設計稿的 README 寫「透明的五張」，但清單上透明的是四張、不透明的三張（共七張；第八個檔 favicon.svg 不是 PNG）—— 照清單量。
//   favicon-16、favicon-32 跟擴充的 clipper/icons/icon-16.png、icon-32.png 逐像素相同（16 是畫在 16 格線上的那一組，不是縮出來的）；
//     找不到擴充那兩張（搬進公開 repo 之後）就 skip 那一條並寫原因。
//
// 這個分支還沒有前端（沒有 app/）時，public/ 沒有圖示：skip 並寫原因。要在這裡量別處的圖示，用 SITE_ICONS_DIR 指到那個資料夾（例如前端工作資料夾的 public/）。
// 前端合併之後（有 app/）一律量 public/，圖示不見就紅。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "F8.5d"
//   SITE_ICONS_DIR=<放圖示的資料夾> npm test -- --test-name-pattern "F8.5d"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { readPng, pngSize } from './og-fixture.js';

const ICONS = [
    { file: 'favicon-16.png', size: 16, corner: 0 },
    { file: 'favicon-32.png', size: 32, corner: 0 },
    { file: 'icon-192.png', size: 192, corner: 0 },
    { file: 'icon-512.png', size: 512, corner: 0 },
    { file: 'apple-touch-icon.png', size: 180, corner: 255 },
    { file: 'icon-maskable-192.png', size: 192, corner: 255 },
    { file: 'icon-maskable-512.png', size: 512, corner: 255 },
];
const EXTENSION = path.resolve(SITE, '..', '..', 'clipper', 'icons');
const DIR = process.env.SITE_ICONS_DIR || path.join(SITE, 'public');
const SKIP = !process.env.SITE_ICONS_DIR && !fs.existsSync(path.join(SITE, 'app'))
    ? '這個分支還沒有前端（沒有 app/），public/ 沒有圖示（前端 4-f2 放的）；要量別處的圖示請設 SITE_ICONS_DIR'
    : false;

test('F8.5d 圖示：七張 PNG 都在、寬高對（檔頭與像素）', { skip: SKIP }, () => {
    for (const { file, size } of ICONS) {
        const full = path.join(DIR, file);
        assert.ok(fs.existsSync(full), `缺 ${full}`);
        assert.deepEqual(pngSize(full), { width: size, height: size }, `${file}：PNG 檔頭要是 ${size}×${size}`);
        const img = readPng(full);
        assert.equal(img.rgba.length, size * size * 4, `${file}：解出來的像素數要是 ${size}×${size}`);
    }
});

test('F8.5d 圖示：四個角 —— 透明的四張 alpha 0，不透明的三張（apple-touch-icon、兩張 maskable）alpha 255', { skip: SKIP }, () => {
    const bad = [];
    for (const { file, size, corner } of ICONS) {
        const img = readPng(path.join(DIR, file));
        const alphas = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]].map(([x, y]) => img.rgba[(y * size + x) * 4 + 3]);
        if (!alphas.every((a) => a === corner)) bad.push(`${file}：四個角的 alpha 要都是 ${corner}（${corner ? '不透明' : '透明'}），得到 ${alphas.join('、')}`);
    }
    assert.deepEqual(bad, []);
});

test('F8.5d 圖示：favicon-16、favicon-32 跟擴充的 icon-16.png、icon-32.png 逐像素相同', { skip: SKIP }, (t) => {
    if (!fs.existsSync(path.join(EXTENSION, 'icon-16.png'))) return t.skip(`找不到擴充的圖示（${EXTENSION}；搬進公開 repo 之後就沒有）`);
    for (const [site, ext] of [['favicon-16.png', 'icon-16.png'], ['favicon-32.png', 'icon-32.png']]) {
        const a = readPng(path.join(DIR, site));
        const b = readPng(path.join(EXTENSION, ext));
        assert.equal(`${a.width}×${a.height}`, `${b.width}×${b.height}`, `${site} 與擴充的 ${ext} 寬高要一樣`);
        let diff = 0;
        for (let i = 0; i < a.rgba.length; i += 1) if (a.rgba[i] !== b.rgba[i]) diff += 1;
        assert.equal(diff, 0, `${site} 跟擴充的 ${ext} 要逐像素相同，不同的通道值 ${diff} 個`);
    }
});
