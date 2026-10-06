// 4-b12 的 B12.2：係數掃描 scripts/fallback-sweep.mjs（npm run fallback-sweep）與 lib/fallback-sweep.js。介面細則見 tests/README.md「4-b12」。
//
// 量什麼（不需要瀏覽器，必過）：
//   compareBlocks(want, got)  兩次量到的 { data-id: 高度 }：高度不同、或第二次量不到的 id，照 id 排序回傳；第二次多出來的不算。
//   parseKRange("0.98:1.02:0.01")  → [0.98, 0.99, 1, 1.01, 1.02]（四捨五入到小數 4 位）；寫錯丟 Error。
//   命令的用法錯誤 → 結束碼 2；找不到 Playwright → 結束碼 1、中文、講到 SITE_PLAYWRIGHT。
// 量什麼（要瀏覽器：設了 SITE_PLAYWRIGHT 才跑）：在暫存資料夾組一個小網站（三語各一頁，兩個 data-id 區塊，字型用 public/fonts 的複本），
//   回退字型對得上 → 每一個語言×寬度印「一致」、結束碼 0；對不上（size-adjust 300%）→ 印「不一致 <語言> <寬度>px：<data-id>」、結束碼 1；
//   掃描（--scan、--k）→ 每一個係數一行「k=<係數> 不一致 <N> 組」，有不一致時列出語言、寬度、區塊。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12.2"
//   SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "B12.2"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';
import { runScript, usageError, tmp, playwrightDir, BASE } from './fallback-fixture.js';

const need = await lib('fallback-sweep.js', ['compareBlocks', 'parseKRange']);
const run = (args, env = {}, opts = {}) => runScript('fallback-sweep.mjs', args, { ...opts, env: { SITE_PLAYWRIGHT: undefined, ...env } });

function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊：\n${res.stderr}`);
}

// 小網站：/fonts/（public/fonts 的複本）、/fallback.css（回退字型，size-adjust 由測試給）、/zh/、/en/、/ja/ 各一頁
function site(t, sizeAdjust) {
    const dir = path.join(tmp(t, 'site-sweep-'), '小 網站');
    fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
    for (const name of ['fonts.css', 'GoogleSansFlex-site.woff2', 'JetBrainsMono-site.woff2']) fs.copyFileSync(path.join(SITE, 'public', 'fonts', name), path.join(dir, 'fonts', name));
    const sa = sizeAdjust.toFixed(1);
    fs.writeFileSync(path.join(dir, 'fallback.css'), `@font-face { font-family: "${BASE} 16"; src: local("Arial"), local("ArialMT"), local("Helvetica"), local("Liberation Sans"); font-weight: 100 449; unicode-range: U+20-7E; size-adjust: ${sa}%; ascent-override: ${(96.6 / sizeAdjust * 100).toFixed(2)}%; descent-override: ${(28.6 / sizeAdjust * 100).toFixed(2)}%; line-gap-override: 0%; }\n`);
    for (const lang of ['zh', 'en', 'ja']) {
        fs.mkdirSync(path.join(dir, lang));
        fs.writeFileSync(path.join(dir, lang, 'index.html'), `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/fallback.css">
<style>body { margin: 0 } p { font: 400 16px/24px "Google Sans Flex", "${BASE} 16"; margin: 0 0 8px; }</style></head>
<body><p data-id="short">OK</p><p data-id="long">This is a short sentence for the sweep.</p></body></html>\n`);
    }
    return dir;
}

test('B12.2 純函式 compareBlocks：高度不同、第二次量不到的 id，照 id 排序；第二次多出來的不算', () => {
    const { compareBlocks } = need();
    assert.deepEqual(compareBlocks({ a: 24, b: 48, c: 24 }, { a: 24, b: 72, c: 24 }), ['b']);
    assert.deepEqual(compareBlocks({ z: 24, b: 48 }, { z: 48, b: 72, extra: 10 }), ['b', 'z'], '照 id 排序、多出來的 extra 不算');
    assert.deepEqual(compareBlocks({ a: 24, b: 48 }, { a: 24 }), ['b'], '第二次量不到 b');
    assert.deepEqual(compareBlocks({}, {}), []);
});

test('B12.2 純函式 parseKRange：起:迄:間隔，四捨五入到小數 4 位；寫錯丟 Error', () => {
    const { parseKRange } = need();
    assert.deepEqual(parseKRange('0.98:1.02:0.01'), [0.98, 0.99, 1, 1.01, 1.02]);
    assert.deepEqual(parseKRange('1:1:0.1'), [1]);
    assert.deepEqual(parseKRange('1.0264:1.0266:0.0001'), [1.0264, 1.0265, 1.0266]);
    for (const bad of ['', '1', '1:2', 'a:b:c', '1:0.9:0.01', '1:2:0', '1:2:-0.1']) assert.throws(() => parseKRange(bad), Error, `「${bad}」要丟 Error`);
});

test('B12.2 命令：用法錯誤 → 結束碼 2；找不到 Playwright → 結束碼 1、中文、講到 SITE_PLAYWRIGHT', (t) => {
    const dir = site(t, 100);
    const base = path.dirname(dir);
    const cases = [
        ['沒給 --site', ['--widths', '360']],
        ['--site 不存在', ['--site', path.join(base, '沒有這個')]],
        ['--site 是檔', ['--site', path.join(dir, 'fallback.css')]],
        ['--widths 不是數字', ['--site', dir, '--widths', '360,abc']],
        ['--langs 不認得', ['--site', dir, '--langs', 'zh,fr']],
        ['--scan 沒給 --css 與 --k', ['--site', dir, '--scan', `${BASE} 16|100 449`]],
        ['--k 寫錯', ['--site', dir, '--css', path.join(dir, 'fallback.css'), '--scan', `${BASE} 16|100 449`, '--k', '1:0.9:0.01']],
        ['不認得的參數', ['--site', dir, '--force']],
    ];
    for (const [label, args] of cases) {
        const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
        usageError(run(args, {}, { cwd }), label);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：叫它的資料夾還是空的`);
    }
    const res = run(['--site', dir, '--widths', '360']);
    failed(res, '找不到 Playwright');
    assert.match(res.stderr, /SITE_PLAYWRIGHT/);
});

test('B12.2 命令（要瀏覽器）：回退字型對得上 → 每一個語言×寬度「一致」、結束碼 0；對不上 → 列出語言、寬度、區塊，結束碼 1', (t) => {
    const pw = playwrightDir();
    if (!pw) {
        t.skip('沒設 SITE_PLAYWRIGHT（Playwright 套件的資料夾）：要開瀏覽器量換字型前後高度的這一層不跑');
        return;
    }
    const good = run(['--site', site(t, 100), '--langs', 'en,ja', '--widths', '1280,1440', '--playwright', pw]);
    assert.equal(good.status, 0, `對得上：結束碼要是 0，得到 ${good.status}；stdout：${good.stdout}；stderr：${good.stderr}`);
    for (const lang of ['en', 'ja']) for (const w of [1280, 1440]) assert.match(good.stdout, new RegExp(`^一致 ${lang} ${w}px`, 'm'), `要有「一致 ${lang} ${w}px」那一行`);
    const bad = run(['--site', site(t, 300), '--langs', 'en', '--widths', '360,1280', '--playwright', pw]);
    assert.equal(bad.status, 1, `對不上：結束碼要是 1，得到 ${bad.status}；stdout：${bad.stdout}；stderr：${bad.stderr}`);
    const line = bad.stdout.split('\n').find((row) => row.startsWith('不一致 en 360px'));
    assert.ok(line, `要有「不一致 en 360px：…」那一行；stdout：${bad.stdout}`);
    assert.match(line, /long/, '列出不一致的區塊 long');
    assert.doesNotMatch(line, /short/, '一致的區塊 short 不列');
});

test('B12.2 命令（要瀏覽器）：掃描 --scan --k → 每一個係數一行，不一致時列出語言、寬度、區塊', (t) => {
    const pw = playwrightDir();
    if (!pw) {
        t.skip('沒設 SITE_PLAYWRIGHT：掃描這一層不跑');
        return;
    }
    const dir = site(t, 300);
    const res = run(['--site', dir, '--css', path.join(dir, 'fallback.css'), '--scan', `${BASE} 16|100 449`, '--k', '0.3333:1:0.6667', '--langs', 'en', '--widths', '360', '--playwright', pw]);
    assert.equal(res.status, 0, `掃描：結束碼 0，得到 ${res.status}；stderr：${res.stderr}`);
    const rows = res.stdout.split('\n').filter((row) => row.startsWith('k='));
    assert.equal(rows.length, 2, `兩個係數各一行，得到：${res.stdout}`);
    assert.match(rows[0], /^k=0\.3333 不一致 0 組/, '乘 0.3333 之後 size-adjust 約 100%：一致');
    assert.match(rows[1], /^k=1\.0000 不一致 1 組/, '乘 1（300%）：不一致');
    assert.match(rows[1], /en 360px/);
    assert.match(rows[1], /long/);
});
