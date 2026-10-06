// 4-b14 的 F8.5a／F8.5c／F8.5e，用真的設計稿：<SITE_OG_ROOT>/design/homepage/og/{zh,en,ja}/index.html。介面細則見 tests/README.md「4-b14」。
//
// 要兩個環境變數：SITE_OG_ROOT（有分享卡設計稿的專案根目錄，例如 GPTPlugins 主資料夾或設計師的工作資料夾）與 SITE_PLAYWRIGHT；
// 少一個就 skip 並寫原因（不算紅也不算綠）。設了 SITE_OG_ROOT 但那裡沒有三份設計稿 → 紅（打錯路徑不能靜靜略過）。
//
// 量什麼：
//   重產到暫存資料夾：結束碼 0、三張的檔頭 1200×630、≤ 300 KB；印出的字型（中 Google Sans Flex＋Noto Sans TC、英 Google Sans Flex、日 Google Sans Flex＋Noto Sans JP）
//   跟提交進來的 public/og/ 逐位元組相同（設計稿改了就要重跑 npm run og 再提交）；npm run og -- --check 對提交進來的那份是 0、public/og/ 一個位元組都不動。
//
// 跑法（在 homepage/site/）：
//   SITE_OG_ROOT=<專案根目錄> SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "F8.5 真的"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { snapshot } from './media-fixture.js';
import { LANGS, OG_NAMES, MAX_BYTES, runOg, playwrightDir, tmp, pngSize, printedFonts } from './og-fixture.js';

const ROOT = process.env.SITE_OG_ROOT || null;
const SKIP = !ROOT ? '沒設 SITE_OG_ROOT（有 design/homepage/og/ 的專案根目錄）' : !playwrightDir() ? '沒設 SITE_PLAYWRIGHT（Playwright 套件的資料夾）' : false;
const PUBLIC_OG = path.join(SITE, 'public', 'og');

test('F8.5 真的設計稿：重產三張 1200×630、≤ 300 KB，印出的字型對，跟提交進來的 public/og/ 逐位元組相同', { skip: SKIP }, (t) => {
    for (const lang of LANGS) {
        const page = path.join(ROOT, 'design', 'homepage', 'og', lang, 'index.html');
        assert.ok(fs.existsSync(page), `SITE_OG_ROOT 底下要有 ${page}（打錯路徑？）`);
    }
    const out = path.join(tmp(t, 'site-og-real-'), 'og');
    const res = runOg(['--root', ROOT, '--out', out, '--playwright', playwrightDir()]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const want = { zh: ['Google Sans Flex', 'Noto Sans TC'], en: ['Google Sans Flex'], ja: ['Google Sans Flex', 'Noto Sans JP'] };
    for (const lang of LANGS) {
        const fonts = printedFonts(res.stdout, lang);
        assert.ok(fonts, `stdout 要有「og-${lang} 字型：…」；stdout：${res.stdout}`);
        assert.deepEqual([...fonts].sort(), [...want[lang]].sort(), `og-${lang} 實際用到的字型家族`);
    }
    for (const name of OG_NAMES) {
        const file = path.join(out, name);
        assert.deepEqual(pngSize(file), { width: 1200, height: 630 }, `${name}：1200×630`);
        assert.ok(fs.statSync(file).size <= MAX_BYTES, `${name}：${fs.statSync(file).size} 位元組，上限 ${MAX_BYTES}`);
        const committed = path.join(PUBLIC_OG, name);
        assert.ok(fs.existsSync(committed), `缺 public/og/${name}（要提交進來）`);
        assert.ok(fs.readFileSync(file).equals(fs.readFileSync(committed)), `public/og/${name} 跟重產的不同：設計稿改過了？重跑 npm run og 再提交`);
    }
});

test('F8.5 真的設計稿：--check 對提交進來的 public/og/ → 結束碼 0，public/og/ 一個位元組都不動', { skip: SKIP }, () => {
    const before = snapshot(PUBLIC_OG);
    assert.ok(before, '缺 public/og/');
    const res = runOg(['--root', ROOT, '--check', '--playwright', playwrightDir()]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    assert.deepEqual(snapshot(PUBLIC_OG), before, '--check 不寫檔');
});
