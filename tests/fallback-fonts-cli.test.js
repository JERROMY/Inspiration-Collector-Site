// 4-b12 的 B12.1 命令：scripts/fallback-fonts.mjs（npm run fallback-fonts）。介面細則見 tests/README.md「4-b12」。真的開子程序跑。
//
// 量什麼（不需要瀏覽器，必過）：
//   用法錯誤 → 結束碼 2；設定檔、字型資料夾、--out 的資料夾有問題 → 結束碼 1、講出是哪個檔；找不到 Playwright（沒給 --playwright、沒設 SITE_PLAYWRIGHT，
//   或指到的資料夾不是 Playwright）→ 結束碼 1、中文、講到 SITE_PLAYWRIGHT；先查輸入、再找 Playwright；任何失敗 --out 一個位元組都不動、沒有堆疊；
//   不給 --out 時預設寫 app/styles/fallback-fonts.css，這個分支沒有 app/styles/ 就結束碼 1、講要用 --out、不建 app/。homepage/site/ 底下一個檔都不動。
// 量什麼（要瀏覽器：設了 SITE_PLAYWRIGHT 才跑，沒設就 skip 並寫原因）：
//   同一台機器重跑位元組相同；過靜態檢查；基本組照 roles×字重（15 組）、每組剛好收齊 fonts.css 的字一次、空白自己一個排最後；
//   微調組跟「基本組照係數乘出來」逐字相同；homepage/site/ 不動；瀏覽器開不起來 → 結束碼 1、中文、--out 不動；
//   〔檢查員第 1 輪〕系統暫存資料夾寫不進去（TMPDIR 唯讀）→ 結束碼 1、訊息要講到「暫存資料夾」（不能只說瀏覽器開不起來）。
//   **不比對 golden.css 的位元組**：量的是這台機器的 Arial，換一台不保證相同（README 寫明）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12.1 命令"
//   SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "B12.1 命令"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { runScript, usageError, tmp, stamp, playwrightDir, parseFaces, checkSizeAdjust, ROLES, FACTORS, BASE } from './fallback-fixture.js';

const NO_PW = { SITE_PLAYWRIGHT: undefined };
const run = (args, env = {}, opts = {}) => runScript('fallback-fonts.mjs', args, { ...opts, env: { ...NO_PW, ...env } });

function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊：\n${res.stderr}`);
}

// 暫存資料夾：字型資料夾（public/fonts 的複本）、設定檔（scripts/ 那份的複本，沒有就用測試的 ROLES、FACTORS）、已經有舊內容的 --out
function setup(t) {
    const base = tmp(t, 'site-fallback-');
    const fonts = path.join(base, '字型 資料夾');
    fs.mkdirSync(fonts);
    for (const name of ['fonts.css', 'GoogleSansFlex-site.woff2', 'JetBrainsMono-site.woff2']) fs.copyFileSync(path.join(SITE, 'public', 'fonts', name), path.join(fonts, name));
    const config = path.join(base, 'config.json');
    fs.writeFileSync(config, JSON.stringify({ roles: ROLES, factors: FACTORS }, null, 2) + '\n');
    const outDir = path.join(base, '輸出 資料夾');
    fs.mkdirSync(outDir);
    const out = path.join(outDir, 'fallback-fonts.css');
    fs.writeFileSync(out, '/* 舊的 */\n');
    return { base, fonts, config, out };
}

const unchanged = (out, label) => assert.equal(fs.readFileSync(out, 'utf8'), '/* 舊的 */\n', `${label}：--out 一個位元組都不動`);

test('B12.1 命令：用法錯誤 → 結束碼 2、stderr 第一行中文、不寫任何檔', (t) => {
    const { base, fonts, config, out } = setup(t);
    const cases = [
        ['不認得的參數', ['--fonts', fonts, '--config', config, '--out', out, '--force']],
        ['多出來的位置參數', ['--fonts', fonts, '--config', config, '--out', out, 'extra']],
        ['--out 空字串', ['--fonts', fonts, '--config', config, '--out=']],
        ['--fonts 空字串', ['--fonts=', '--config', config, '--out', out]],
        ['--config 空字串', ['--fonts', fonts, '--config=', '--out', out]],
        ['--playwright 空字串', ['--fonts', fonts, '--config', config, '--out', out, '--playwright=']],
        ['--fonts 不存在', ['--fonts', path.join(base, '沒有這個'), '--config', config, '--out', out]],
        ['--fonts 是檔', ['--fonts', config, '--config', config, '--out', out]],
    ];
    for (const [label, args] of cases) {
        const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
        usageError(run(args, {}, { cwd }), label);
        unchanged(out, label);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：叫它的資料夾還是空的`);
    }
});

test('B12.1 命令：設定檔、字型資料夾、--out 的資料夾有問題 → 結束碼 1、講出是哪個檔、--out 不動', (t) => {
    const { base, fonts, config, out } = setup(t);
    let res = run(['--fonts', fonts, '--config', path.join(base, 'nope.json'), '--out', out]);
    failed(res, '設定檔不存在');
    assert.match(res.stderr, /nope\.json/);
    fs.writeFileSync(config, '{ not json');
    res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '設定檔不是 JSON');
    assert.match(res.stderr, /config\.json/);
    fs.writeFileSync(config, JSON.stringify({ roles: [], factors: [] }));
    res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '設定檔的 roles 是空的');
    assert.match(res.stderr, /roles/);
    fs.writeFileSync(config, JSON.stringify({ roles: ROLES, factors: FACTORS }));
    fs.rmSync(path.join(fonts, 'GoogleSansFlex-site.woff2'));
    res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '缺 GoogleSansFlex-site.woff2');
    assert.match(res.stderr, /GoogleSansFlex-site\.woff2/);
    fs.copyFileSync(path.join(SITE, 'public', 'fonts', 'GoogleSansFlex-site.woff2'), path.join(fonts, 'GoogleSansFlex-site.woff2'));
    fs.rmSync(path.join(fonts, 'fonts.css'));
    res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '缺 fonts.css');
    assert.match(res.stderr, /fonts\.css/);
    fs.copyFileSync(path.join(SITE, 'public', 'fonts', 'fonts.css'), path.join(fonts, 'fonts.css'));
    res = run(['--fonts', fonts, '--config', config, '--out', path.join(base, '沒有這個資料夾', 'a.css')]);
    failed(res, '--out 的資料夾不存在');
    assert.match(res.stderr, /沒有這個資料夾/);
    unchanged(out, '以上每一種');
});

test('B12.1 命令：找不到 Playwright → 結束碼 1、中文、講到 SITE_PLAYWRIGHT、--out 不動；先查輸入再找 Playwright', (t) => {
    const { base, fonts, config, out } = setup(t);
    let res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '沒給 --playwright、沒設 SITE_PLAYWRIGHT');
    assert.match(res.stderr, /Playwright/);
    assert.match(res.stderr, /SITE_PLAYWRIGHT/);
    const empty = fs.mkdtempSync(path.join(base, 'not-playwright-'));
    res = run(['--fonts', fonts, '--config', config, '--out', out, '--playwright', empty]);
    failed(res, '--playwright 指到不是 Playwright 的資料夾');
    assert.match(res.stderr, /找不到 Playwright/);
    assert.ok(res.stderr.includes(empty), '講出試的那個路徑');
    res = run(['--fonts', fonts, '--config', config, '--out', out], { SITE_PLAYWRIGHT: empty });
    failed(res, 'SITE_PLAYWRIGHT 指到不是 Playwright 的資料夾');
    assert.match(res.stderr, /找不到 Playwright/);
    fs.rmSync(path.join(fonts, 'fonts.css'));
    res = run(['--fonts', fonts, '--config', config, '--out', out]);
    failed(res, '輸入缺檔又沒有 Playwright');
    assert.match(res.stderr, /fonts\.css/, '先查輸入：講缺 fonts.css，不是 Playwright');
    unchanged(out, '以上每一種');
});

test('B12.1 命令：不給 --out 預設寫 app/styles/fallback-fonts.css；這個分支沒有 app/styles/ → 結束碼 1、講要用 --out、不建 app/', (t) => {
    if (fs.existsSync(path.join(SITE, 'app', 'styles'))) {
        t.skip('這個分支有 app/styles/（前端合併之後）：預設的 --out 會寫進專案，不量');
        return;
    }
    const { fonts, config } = setup(t);
    const res = run(['--fonts', fonts, '--config', config]);
    failed(res, '沒有 app/styles/');
    assert.match(res.stderr, /app\/styles/, '講到 app/styles');
    assert.match(res.stderr, /--out/, '講要用 --out');
    assert.ok(!fs.existsSync(path.join(SITE, 'app')), '不建 app/');
});

test('B12.1 命令：給了 --out 跑完（成功或失敗），homepage/site/ 底下每個檔的大小與修改時間都不變', (t) => {
    const { fonts, config, out } = setup(t);
    const before = stamp(SITE);
    run(['--fonts', fonts, '--config', config, '--out', out]);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不動');
});

// ── 要瀏覽器的那一層 ──

test('B12.1 命令（要瀏覽器）：同一台機器重跑位元組相同、過靜態檢查、每組收齊 fonts.css 的字、微調組照係數乘出來', (t) => {
    const pw = playwrightDir();
    if (!pw) {
        t.skip('沒設 SITE_PLAYWRIGHT（Playwright 套件的資料夾，例如擴充那邊 node_modules 裡的 playwright）：要開瀏覽器量字寬的這一層不跑');
        return;
    }
    const { fonts, config, out } = setup(t);
    const second = path.join(path.dirname(out), 'second.css');
    const before = stamp(SITE);
    let res = run(['--fonts', fonts, '--config', config, '--out', out, '--playwright', pw]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    res = run(['--fonts', fonts, '--config', config, '--out', second], { SITE_PLAYWRIGHT: pw });
    assert.equal(res.status, 0, `用 SITE_PLAYWRIGHT 也要過，得到 ${res.status}；stderr：${res.stderr}`);
    const css = fs.readFileSync(out, 'utf8');
    assert.equal(fs.readFileSync(second, 'utf8'), css, '同一台機器重跑位元組相同');
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不動');
    assert.deepEqual(checkSizeAdjust(css), [], '過靜態檢查');
    assert.ok(css.slice(0, css.indexOf('*/')).includes('npm run fallback-fonts'), '檔頭寫到 npm run fallback-fonts');

    const chars = [];
    for (let c = 0x20; c <= 0x7e; c += 1) chars.push(c);
    chars.push(0xa6, 0xa7, 0xa9, 0xab, 0xb7, 0xbb, 0xd7, 0x2013, 0x2014, 0x2019, 0x201c, 0x201d, 0x2026);
    const faces = parseFaces(css);
    const RANGE = { 400: '100 449', 500: '450 599', 600: '600 900' };
    const baseKeys = ROLES.flatMap((r) => r.weights.map((w) => `${BASE}${r.suffix}|${RANGE[w]}`));
    const seen = [];
    for (const f of faces) {
        const key = `${f.family}|${f.weight}`;
        if (baseKeys.includes(key) && seen[seen.length - 1] !== key) seen.push(key);
    }
    assert.deepEqual(seen, baseKeys, '基本組照 roles 的順序、每組照列的字重，15 組');
    const baseLines = [];
    for (const key of baseKeys) {
        const group = faces.filter((f) => `${f.family}|${f.weight}` === key);
        const codes = group.flatMap((f) => f.codes).sort((a, b) => a - b);
        assert.deepEqual(codes, chars, `${key}：剛好收齊 fonts.css 的字，每個字一次`);
        assert.equal(group[group.length - 1].range, 'U+20', `${key}：空白自己一個、排最後`);
        baseLines.push(...group.map((f) => f.line));
    }
    const micro = faces.filter((f) => !baseKeys.includes(`${f.family}|${f.weight}`)).map((f) => f.line);
    const want = FACTORS.flatMap(({ family, from, weight, k, spaceK = 1 }) => baseLines
        .filter((l) => l.includes(`font-family: "${from}";`) && l.includes(`font-weight: ${weight};`))
        .map((l) => l.replace(`font-family: "${from}";`, `font-family: "${family}";`).replace(/size-adjust: ([\d.]+)%; ascent-override: [\d.]+%; descent-override: [\d.]+%;/, (_, sa) => {
            const v = Number(sa) * k * (l.includes('unicode-range: U+20;') ? spaceK : 1);
            return `size-adjust: ${v.toFixed(2)}%; ascent-override: ${(96.6 / v * 100).toFixed(2)}%; descent-override: ${(28.6 / v * 100).toFixed(2)}%;`;
        })));
    assert.deepEqual(micro, want, '微調組＝基本組照係數乘出來（測試自己乘的）');
});

test('B12.1 命令（要瀏覽器）：瀏覽器開不起來 → 結束碼 1、中文、--out 不動', (t) => {
    const pw = playwrightDir();
    if (!pw) {
        t.skip('沒設 SITE_PLAYWRIGHT：這一條要真的 Playwright 才量得到「瀏覽器開不起來」');
        return;
    }
    const { base, fonts, config, out } = setup(t);
    const res = run(['--fonts', fonts, '--config', config, '--out', out, '--playwright', pw], { PLAYWRIGHT_BROWSERS_PATH: path.join(base, '沒有瀏覽器') });
    failed(res, '瀏覽器開不起來');
    assert.match(res.stderr, /瀏覽器/);
    unchanged(out, '瀏覽器開不起來');
});

test('B12.1 命令（要瀏覽器）：系統暫存資料夾寫不進去（TMPDIR 指到唯讀資料夾）→ 結束碼 1、訊息指出暫存資料夾（不能只說瀏覽器）、--out 不動', (t) => {
    const pw = playwrightDir();
    if (!pw) {
        t.skip('沒設 SITE_PLAYWRIGHT：這一條要真的 Playwright 才量得到（Playwright 開瀏覽器時要在暫存資料夾開資料夾）');
        return;
    }
    if (process.platform === 'win32' || process.getuid?.() === 0) {
        t.skip('Windows 與 root 的唯讀資料夾擋不住寫入，這一條不跑');
        return;
    }
    const { base, fonts, config, out } = setup(t);
    const ro = path.join(base, '唯讀 暫存');
    fs.mkdirSync(ro);
    fs.chmodSync(ro, 0o555);
    t.after(() => { if (fs.existsSync(ro)) fs.chmodSync(ro, 0o755); });
    const res = run(['--fonts', fonts, '--config', config, '--out', out, '--playwright', pw], { TMPDIR: ro, TEMP: ro, TMP: ro });
    failed(res, '暫存資料夾寫不進去');
    assert.match(res.stderr, /暫存資料夾/, `訊息要指出暫存資料夾（真正的原因），不能只說瀏覽器；得到：${res.stderr}`);
    unchanged(out, '暫存資料夾寫不進去');
});
