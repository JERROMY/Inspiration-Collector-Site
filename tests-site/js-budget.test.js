// F1.8：/zh/ 第一次打開的 JS 有多大（gzip 之後），當「第一次打開 ≤ 1 MB」（規格書第 9 節）的基準。
//
// 量什麼：
//   F1.8 /zh/ 的 HTML 裡會載入的 JS：<script src> 與 <link rel="preload"|"modulepreload" as="script">，指到 out/_next/ 底下的檔，
//        去掉重複、每支 gzip（Node 的 zlib 預設等級）之後加總。骨架階段要 < 300 KB（307200 位元組）。
//   F1.8 有記錄：homepage/site/README.md 有一段（空行切段）同時寫到「/zh/」「JS」「gzip」與一個「數字＋KB」，
//        那個數字跟這次量到的差在兩倍以內（KB 用 1000 或 1024 算都可以），而且 ≤ 300 KB。前端每次大改後照這條測試印出的數字更新。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.8"      量到的數字印在 # 開頭的那一行（diagnostic）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SITE, OUT, readOut, tagAttrs } from './helpers.js';

const LIMIT = 300 * 1024;

function firstLoadJs() {
    const html = readOut('zh/index.html');
    const urls = new Set();
    for (const a of tagAttrs(html, 'script')) if (a.src) urls.add(a.src);
    for (const a of tagAttrs(html, 'link')) {
        const rel = (a.rel ?? '').split(/\s+/);
        if (a.href && (rel.includes('modulepreload') || (rel.includes('preload') && a.as === 'script'))) urls.add(a.href);
    }
    const files = [];
    for (const url of urls) {
        const pathname = new URL(url, 'https://collector.jerromy.com/zh/').pathname;
        if (!pathname.startsWith('/_next/')) continue;
        const file = path.join(OUT, ...decodeURIComponent(pathname).split('/').filter(Boolean));
        assert.ok(fs.existsSync(file), `/zh/ 載入 ${pathname}，但 out/ 裡沒有這個檔`);
        files.push({ pathname, gzip: zlib.gzipSync(fs.readFileSync(file)).length });
    }
    return files;
}

test('F1.8 /zh/ 第一次打開的 JS（gzip）< 300 KB', (t) => {
    const files = firstLoadJs();
    assert.ok(files.length > 0, '/zh/ 的 HTML 裡沒有任何 /_next/ 的 JS —— Next.js 一定會有，out/ 不對？');
    const total = files.reduce((sum, f) => sum + f.gzip, 0);
    t.diagnostic(`/zh/ 第一次打開的 JS：${files.length} 支，gzip 後合計 ${total} 位元組（${(total / 1024).toFixed(1)} KB）`);
    assert.ok(total < LIMIT, `/zh/ 第一次打開的 JS gzip 後 ${total} 位元組，骨架階段要 < 300 KB：${files.map((f) => `${f.pathname} ${f.gzip}`).join('、')}`);
});

test('F1.8 README 記了這個數字（基準）', () => {
    const total = firstLoadJs().reduce((sum, f) => sum + f.gzip, 0);
    const readme = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const paras = readme.split(/\n\s*\n/).filter((p) => p.includes('/zh/') && /\bJS\b/.test(p) && /gzip/i.test(p) && /\d[\d,.]*\s*(KB|KiB)\b/.test(p));
    assert.ok(paras.length > 0, 'homepage/site/README.md 要有一段同時寫到「/zh/」「JS」「gzip」與「數字＋KB」—— 第一次打開的 JS 有多大（npm run test:site 的 F1.8 會印出來）');
    const recorded = paras.flatMap((p) => [...p.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(KB|KiB)\b/g)].map((m) => Number(m[1].replace(/,/g, ''))));
    const ok = recorded.some((kb) => kb * 1024 <= LIMIT && [1000, 1024].some((unit) => kb * unit >= total / 2 && kb * unit <= total * 2));
    assert.ok(ok, `README 記的數字（${recorded.join('、')} KB）跟這次量到的 ${(total / 1024).toFixed(1)} KB 差超過兩倍（或超過 300 KB）：請照這次的數字更新`);
});
