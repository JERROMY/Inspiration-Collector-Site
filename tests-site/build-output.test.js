// F1.1（能 build）。讀 npm run build 產出的 out/ 與設定檔。
//
// 量什麼：
//   F1.1 package.json 有 build 指令（next build）；dependencies 有 next、react、react-dom；有 package-lock.json，而且鎖的就是 package.json 寫的那幾個（npm ci 才裝得起來）。
//   F1.1 next.config：output 'export'、trailingSlash true、images.unoptimized true（載入設定檔讀出來比，不是找字）。
//   F1.1 out/ 有 zh/index.html、en/index.html、ja/index.html、index.html、404.html、_headers（跟 public/_headers 位元組相同，Cloudflare Pages 讀它）；
//        trailingSlash 真的有效：沒有 out/zh.html 這種檔。
//   F1.1 沒有 Tailwind：沒有 tailwind.config.*、postcss 設定沒提到 tailwind、網站的 CSS 沒有 @tailwind／@import "tailwindcss"、build 出來的 CSS 沒有 --tw- 變數。
//   F1.1 JavaScript 不用 TypeScript：app/、components/ 沒有 .ts／.tsx，沒有 tsconfig.json；前端程式不放 lib/（lib/ 沒有 .jsx、不 import react）。
//   F1.1 用 Node 20 或 21 也 build 得起來：設 SITE_ALT_NODE=<那支 node> 才跑（在系統暫存資料夾的複本裡 build，不動專案的 out/）；沒設就 skip。
//   （F1.10 截圖工具拍 out/：shots.test.js。）
//
// 跑法（在 homepage/site/）：
//   npm run test:site                                         先 build 再跑全部
//   node tests-site/run.mjs --test-name-pattern "F1.1"        已經 build 過，只跑這幾條
//   SITE_ALT_NODE=/usr/local/bin/node node tests-site/run.mjs --test-name-pattern "F1.1 Node"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SITE, OUT, LANGS, needOut, listFiles, siteCss, outCss, buildCopy, tail } from './helpers.js';

const PAGES = ['zh/index.html', 'en/index.html', 'ja/index.html', 'index.html', '404.html', '_headers'];

function pkg() {
    return JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
}

async function nextConfig() {
    const name = ['next.config.js', 'next.config.mjs', 'next.config.cjs'].find((n) => fs.existsSync(path.join(SITE, n)));
    if (!name) assert.fail('沒有 next.config.js（或 .mjs）');
    const mod = await import(pathToFileURL(path.join(SITE, name)).href);
    let config = mod.default ?? mod;
    if (typeof config === 'function') config = await config('phase-production-build', { defaultConfig: {} });
    return { name, config };
}

test('F1.1 package.json 有 build（next build）與 next、react、react-dom；package-lock.json 鎖的是同一組', () => {
    const p = pkg();
    assert.equal(typeof p.scripts?.build, 'string', 'package.json 要有 scripts.build（前端加 Next.js 時加）');
    assert.match(p.scripts.build, /\bnext\s+build\b/, `scripts.build 要跑 next build，現在是「${p.scripts.build}」`);
    for (const name of ['next', 'react', 'react-dom']) {
        assert.ok(p.dependencies && p.dependencies[name], `dependencies 要有 ${name}`);
    }
    const lockFile = path.join(SITE, 'package-lock.json');
    assert.ok(fs.existsSync(lockFile), '要有 package-lock.json（npm ci 與 Cloudflare Pages 的建置要它）');
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    assert.ok(lock.lockfileVersion >= 2, `package-lock.json 的 lockfileVersion 要 ≥ 2，得到 ${lock.lockfileVersion}`);
    const root = lock.packages && lock.packages[''];
    assert.ok(root, 'package-lock.json 沒有 packages[""]（不是 npm 7 以後產的？）');
    assert.deepEqual(root.dependencies ?? {}, p.dependencies ?? {}, 'package-lock.json 跟 package.json 的 dependencies 對不上：改完 package.json 要重跑 npm install 更新 lock（不然 npm ci 會失敗）');
    assert.deepEqual(root.devDependencies ?? {}, p.devDependencies ?? {}, 'package-lock.json 跟 package.json 的 devDependencies 對不上');
    for (const name of ['next', 'react', 'react-dom']) {
        assert.ok(lock.packages[`node_modules/${name}`], `package-lock.json 裡沒有 node_modules/${name}`);
    }
});

test('F1.1 next.config：output export、trailingSlash、images.unoptimized', async () => {
    const { name, config } = await nextConfig();
    assert.equal(config.output, 'export', `${name} 的 output 要是 'export'（產生靜態網頁）`);
    assert.equal(config.trailingSlash, true, `${name} 的 trailingSlash 要是 true（網址結尾一律有 /，規格書第 3、10.3 節）`);
    assert.equal(config.images && config.images.unoptimized, true, `${name} 的 images.unoptimized 要是 true（靜態網頁沒有圖片最佳化的伺服器）`);
});

test('F1.1 out/ 有三語頁、/、404.html、_headers；trailingSlash 產的是資料夾', () => {
    needOut();
    for (const rel of PAGES) assert.ok(fs.existsSync(path.join(OUT, ...rel.split('/'))), `out/${rel} 不在`);
    for (const lang of LANGS) assert.ok(!fs.existsSync(path.join(OUT, `${lang}.html`)), `out/${lang}.html 不該存在（trailingSlash: true 時是 out/${lang}/index.html）`);
    assert.ok(fs.readFileSync(path.join(OUT, '_headers')).equals(fs.readFileSync(path.join(SITE, 'public', '_headers'))), 'out/_headers 要跟 public/_headers 位元組相同');
});

test('F1.1 沒有 Tailwind', () => {
    const top = fs.readdirSync(SITE);
    const tw = top.filter((n) => /^tailwind\.config\./.test(n));
    assert.deepEqual(tw, [], `不用 Tailwind（它自帶一套顏色與間距，會跟設計系統打架）：${tw.join('、')}`);
    for (const n of top.filter((x) => /^postcss\.config\./.test(x) || x === '.postcssrc' || x === '.postcssrc.json')) {
        assert.doesNotMatch(fs.readFileSync(path.join(SITE, n), 'utf8'), /tailwind/i, `${n} 提到了 tailwind`);
    }
    const p = pkg();
    assert.doesNotMatch(JSON.stringify(p), /tailwind/i, 'package.json 提到了 tailwind');
    for (const { rel, text } of siteCss()) {
        assert.doesNotMatch(text, /@tailwind\b|@import\s+["']tailwindcss|@import\s+url\(\s*["']?tailwindcss/, `${rel} 用了 Tailwind`);
    }
    for (const { rel, text } of outCss()) {
        assert.doesNotMatch(text, /--tw-[a-z]/, `build 出來的 ${rel} 有 Tailwind 的 --tw- 變數`);
    }
});

test('F1.1 JavaScript 不用 TypeScript；前端程式在 app/、components/，不放 lib/', () => {
    assert.ok(fs.existsSync(path.join(SITE, 'app')), '前端程式放 app/（Next.js 的 App Router）');
    assert.ok(fs.existsSync(path.join(SITE, 'components')), '元件放 components/');
    assert.ok(!fs.existsSync(path.join(SITE, 'tsconfig.json')), '不用 TypeScript：不要 tsconfig.json（要設路徑別名用 jsconfig.json）');
    for (const top of ['app', 'components']) {
        const ts = listFiles(path.join(SITE, top)).filter((r) => /\.(ts|tsx|mts|cts)$/.test(r));
        assert.deepEqual(ts, [], `${top}/ 不要有 TypeScript 檔：${ts.join('、')}`);
    }
    for (const name of fs.readdirSync(path.join(SITE, 'lib'))) {
        assert.ok(!/\.(jsx|tsx)$/.test(name), `lib/${name}：lib/ 是後端的，前端程式放 app/ 或 components/`);
        const text = fs.readFileSync(path.join(SITE, 'lib', name), 'utf8');
        assert.doesNotMatch(text, /from\s+['"](react|react-dom|next)(\/[^'"]*)?['"]/, `lib/${name} import 了 React／Next.js：lib/ 是後端的`);
    }
});

test('F1.1 Node 20 或 21 也 build 得起來（SITE_ALT_NODE）', (t) => {
    const alt = process.env.SITE_ALT_NODE;
    if (!alt) {
        t.skip('沒設 SITE_ALT_NODE（例如 SITE_ALT_NODE=/usr/local/bin/node，那支是 Node 20 或 21）');
        return;
    }
    const version = spawnSync(alt, ['--version'], { encoding: 'utf8' });
    assert.equal(version.status, 0, `SITE_ALT_NODE=${alt} 跑不起來：${version.error?.message ?? version.stderr}`);
    t.diagnostic(`SITE_ALT_NODE 是 ${version.stdout.trim()}`);
    assert.match(version.stdout.trim(), /^v2[01]\./, `SITE_ALT_NODE 要是 Node 20 或 21，得到 ${version.stdout.trim()}`);
    const build = buildCopy({ node: alt, label: version.stdout.trim() });
    try {
        assert.equal(build.status, 0, `用 ${version.stdout.trim()} build 失敗：\n${tail(build.output)}`);
        for (const rel of PAGES) assert.ok(fs.existsSync(path.join(build.out, ...rel.split('/'))), `用 ${version.stdout.trim()} build 出來沒有 out/${rel}`);
    } finally {
        build.cleanup();
    }
});
