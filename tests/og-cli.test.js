// 4-b14 的 F8.5a～F8.5c、F8.5e：分享卡圖的命令 scripts/og.mjs（npm run og）。介面細則見 tests/README.md「4-b14」。
//
// 命令：node scripts/og.mjs --root <專案根目錄> [--out <資料夾>] [--check] [--playwright <Playwright 套件的資料夾>]
//   讀 <root>/design/homepage/og/{zh,en,ja}/index.html（設計師的分享卡版面），從 <root> 開本機伺服器，1200×630 拍成 og-<語言>.png 寫進 --out（預設 public/og）。
//   「/」不另做圖（SPEC §10.6、設計稿 notes/4-4.md：用英文那張），所以剛好三張。
//
// 量什麼（不需要瀏覽器，必過）：用法錯誤 → 結束碼 2；來源缺一張 → 結束碼 1（在開瀏覽器之前就停）；找不到 Playwright → 結束碼 1、講到 SITE_PLAYWRIGHT。
// 量什麼（要瀏覽器：設了 SITE_PLAYWRIGHT 才跑，沒設就 skip 並寫原因）：用 og-fixture.js 的假專案（路徑有空白與中文）——
//   F8.5a 三張、1200×630、≤ 300 KB、不是空白、彼此不同；--out 裡別的檔與上一層都不動
//   F8.5c 跑兩次逐位元組相同；--check 只驗證不寫檔（跟 --out 裡的圖比，不同或沒有 → 結束碼 1）
//   F8.5b 字型檔載不到、console 有錯、頁面丟例外 → 結束碼 1、講哪一張、--out 一個位元組都不動（不產半套）
//   F8.5e 輸出前印每張實際用到的字型家族；指定的字型這台沒有 → 結束碼 1
//   F8.5b′ 字撐破版面（scrollWidth／scrollHeight 超出 1200×630，notes/4-4.md 第 3 條的拍前自我檢查）→ 結束碼 1、講哪一張，三語各驗一次
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "F8.5"
//   SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "F8.5"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { usageError } from './b6-fixture.js';
import { snapshot } from './media-fixture.js';
import { LANGS, OG_NAMES, MAX_BYTES, runOg, playwrightDir, ogRoot, tmp, readPng, pngSize, blankProblem, diffRatio, printedFonts } from './og-fixture.js';

const SKIP_PW = '沒設 SITE_PLAYWRIGHT（Playwright 套件的資料夾，例如擴充那邊 clipper/node_modules/playwright）：要開瀏覽器拍分享卡的這一層不跑';

function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊：\n${res.stderr}`);
}

// --out 先放一些舊東西：舊的 og-zh.png、別的檔、子資料夾 —— 失敗時這些要一個位元組都不動
function seededOut(t) {
    const parent = path.join(tmp(t, 'site-og-out-'), '公開 public');
    const out = path.join(parent, 'og');
    fs.mkdirSync(path.join(out, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(parent, 'CNAME'), 'collector.jerromy.com\n');
    fs.writeFileSync(path.join(out, 'og-zh.png'), 'OLD');
    fs.writeFileSync(path.join(out, 'keep.txt'), '使用者的檔\n');
    fs.writeFileSync(path.join(out, 'og-old-2.png'), 'OLD2');
    fs.writeFileSync(path.join(out, 'sub', 'x.png'), 'X');
    return { parent, out };
}

test('F8.5 命令：用法錯誤 → 結束碼 2、stderr 第一行是中文，叫它的資料夾不多任何檔', (t) => {
    const root = ogRoot(t);
    const base = path.dirname(root);
    const file = path.join(base, '一個檔.txt');
    fs.writeFileSync(file, 'x');
    const cases = [
        ['沒給 --root', []],
        ['--root 不存在', ['--root', path.join(base, '沒有這個')]],
        ['--root 是檔', ['--root', file]],
        ['--root 給空字串', ['--root=']],
        ['--out 給空字串', ['--root', root, '--out=']],
        ['--out 是檔', ['--root', root, '--out', file]],
        ['不認得的參數', ['--root', root, '--force']],
        ['多出一個沒有 -- 的字', ['--root', root, 'zh']],
    ];
    for (const [label, args] of cases) {
        const cwd = fs.mkdtempSync(path.join(base, 'cwd-'));
        usageError(runOg(args, {}, { cwd }), label);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：叫它的資料夾還是空的`);
    }
});

test('F8.5b 來源缺一張（ja/index.html 不在）→ 結束碼 1、講 og-ja 與缺的路徑；在開瀏覽器之前就停（沒設 Playwright 也是這個錯）；--out 不動', (t) => {
    const root = ogRoot(t, ['missing-ja']);
    const { parent } = seededOut(t);
    const before = snapshot(parent);
    const res = runOg(['--root', root, '--out', path.join(parent, 'og')]);
    failed(res, '缺 ja');
    assert.match(res.stderr, /og-ja/, '要講是哪一張（og-ja）');
    assert.match(res.stderr, /design[\\/]homepage[\\/]og[\\/]ja[\\/]index\.html/, '要講缺的是哪個檔');
    assert.doesNotMatch(res.stderr, /SITE_PLAYWRIGHT|Playwright/, '來源缺檔要在開瀏覽器之前就講，不是先報找不到 Playwright');
    assert.deepEqual(snapshot(parent), before, '--out 與上一層一個位元組都不動');
});

test('F8.5 命令：找不到 Playwright → 結束碼 1、中文、講到 SITE_PLAYWRIGHT；--out 不動', (t) => {
    const root = ogRoot(t);
    const { parent } = seededOut(t);
    const before = snapshot(parent);
    const res = runOg(['--root', root, '--out', path.join(parent, 'og')]);
    failed(res, '找不到 Playwright');
    assert.match(res.stderr, /SITE_PLAYWRIGHT/);
    assert.deepEqual(snapshot(parent), before, '--out 與上一層一個位元組都不動');
});

test('F8.5a 出圖（要瀏覽器）：三張 og-zh／en／ja.png、1200×630、≤ 300 KB、不是空白、三張彼此不同；--out 裡別的檔與上一層不動', (t) => {
    const pw = playwrightDir();
    if (!pw) return t.skip(SKIP_PW);
    const root = ogRoot(t);
    const { parent, out } = seededOut(t);
    const before = snapshot(parent);
    const res = runOg(['--root', root, '--out', out, '--playwright', pw]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const after = snapshot(parent);
    const same = (x, y) => (Buffer.isBuffer(x) && Buffer.isBuffer(y) ? x.equals(y) : x === y);
    const changed = Object.keys({ ...before, ...after }).filter((key) => !same(before[key], after[key]));
    assert.deepEqual(changed.sort(), OG_NAMES.map((name) => `og/${name}`).sort(), `只能新增或改寫三張 og-<語言>.png，得到變動的：${changed.join('、')}`);
    const imgs = {};
    for (const name of OG_NAMES) {
        const file = path.join(out, name);
        assert.deepEqual(pngSize(file), { width: 1200, height: 630 }, `${name}：PNG 檔頭的寬高要是 1200×630`);
        const bytes = fs.statSync(file).size;
        assert.ok(bytes <= MAX_BYTES, `${name}：${bytes} 位元組，上限 ${MAX_BYTES}`);
        imgs[name] = readPng(file);
        const blank = blankProblem(imgs[name]);
        assert.equal(blank, null, `${name}：不能是空白圖 —— ${blank}`);
    }
    for (let i = 0; i < OG_NAMES.length; i += 1) {
        for (let j = i + 1; j < OG_NAMES.length; j += 1) {
            const ratio = diffRatio(imgs[OG_NAMES[i]], imgs[OG_NAMES[j]]);
            assert.ok(ratio >= 0.005, `${OG_NAMES[i]} 與 ${OG_NAMES[j]} 要是不同的圖（不同的像素至少 0.5%），得到 ${(ratio * 100).toFixed(3)}%`);
        }
    }
    assert.ok(!fs.existsSync(path.join(out, 'og-root.png')), '「/」不另做圖（用英文那張）');
});

test('F8.5e 字型（要瀏覽器）：輸出前印每張實際用到的字型家族 ——「og-<語言> 字型：A、B」，中 Google Sans Flex＋PingFang TC、英只有 Google Sans Flex、日 Google Sans Flex＋Hiragino Sans', (t) => {
    const pw = playwrightDir();
    if (!pw) return t.skip(SKIP_PW);
    const root = ogRoot(t);
    const out = path.join(tmp(t, 'site-og-fonts-'), 'og');
    const res = runOg(['--root', root, '--out', out, '--playwright', pw]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    const want = { zh: ['Google Sans Flex', 'PingFang TC'], en: ['Google Sans Flex'], ja: ['Google Sans Flex', 'Hiragino Sans'] };
    for (const lang of LANGS) {
        const fonts = printedFonts(res.stdout, lang);
        assert.ok(fonts, `stdout 要有「og-${lang} 字型：…」那一行；stdout：${res.stdout}`);
        assert.deepEqual([...fonts].sort(), [...want[lang]].sort(), `og-${lang} 實際用到的字型家族`);
    }
});

test('F8.5c 可重複（要瀏覽器）：同一份來源跑兩次（另一個 --out、同一個 --out 重跑），三張逐位元組相同；--out 不存在就建', (t) => {
    const pw = playwrightDir();
    if (!pw) return t.skip(SKIP_PW);
    const root = ogRoot(t);
    const base = tmp(t, 'site-og-twice-');
    const a = path.join(base, '第一次', 'og');
    const b = path.join(base, '第二次', 'og');
    for (const out of [a, b, a]) {
        const res = runOg(['--root', root, '--out', out, '--playwright', pw]);
        assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    }
    for (const name of OG_NAMES) {
        assert.ok(fs.readFileSync(path.join(a, name)).equals(fs.readFileSync(path.join(b, name))), `${name}：兩次產出要逐位元組相同`);
    }
});

test('F8.5c --check（要瀏覽器）：只驗證不寫檔 —— 剛產完 → 0；改了一張的位元組 → 1、講 og-ja；--out 沒有圖 → 1；三種情況 --out 都一個位元組都不動，也照樣印字型', (t) => {
    const pw = playwrightDir();
    if (!pw) return t.skip(SKIP_PW);
    const root = ogRoot(t);
    const { parent, out } = seededOut(t);
    const made = runOg(['--root', root, '--out', out, '--playwright', pw]);
    assert.equal(made.status, 0, `先產一次：結束碼要是 0，得到 ${made.status}；stderr：${made.stderr}`);

    let before = snapshot(parent);
    const same = runOg(['--root', root, '--out', out, '--check', '--playwright', pw]);
    assert.equal(same.status, 0, `剛產完就 --check：結束碼要是 0，得到 ${same.status}；stdout：${same.stdout}；stderr：${same.stderr}`);
    for (const lang of LANGS) assert.ok(printedFonts(same.stdout, lang), `--check 也要印「og-${lang} 字型：…」`);
    assert.deepEqual(snapshot(parent), before, '--check：一個位元組都不動');

    const ja = path.join(out, 'og-ja.png');
    const bytes = fs.readFileSync(ja);
    bytes[bytes.length - 20] ^= 0xff;
    fs.writeFileSync(ja, bytes);
    before = snapshot(parent);
    const stale = runOg(['--root', root, '--out', out, '--check', '--playwright', pw]);
    failed(stale, '--check 圖跟來源對不上');
    assert.match(stale.stderr, /og-ja/, '要講是哪一張對不上');
    assert.doesNotMatch(stale.stderr, /og-zh|og-en/, '對得上的兩張不要列成錯');
    assert.deepEqual(snapshot(parent), before, '--check 對不上：照樣一個位元組都不動（不偷偷修好）');

    const empty = path.join(tmp(t, 'site-og-empty-'), 'og');
    fs.mkdirSync(empty);
    const none = runOg(['--root', root, '--out', empty, '--check', '--playwright', pw]);
    failed(none, '--check 但 --out 沒有圖');
    for (const name of OG_NAMES) assert.match(none.stderr, new RegExp(name.replace('.', '\\.')), `要講 ${name} 不在`);
    assert.deepEqual(fs.readdirSync(empty), [], '--check：不寫檔');
});

// 壞的來源：結束碼 1、講哪一張、--out 與上一層一個位元組都不動（不產半套）
function brokenCase(name, breaks, expectations) {
    test(name, (t) => {
        const pw = playwrightDir();
        if (!pw) return t.skip(SKIP_PW);
        const root = ogRoot(t, breaks);
        const { parent, out } = seededOut(t);
        const before = snapshot(parent);
        const res = runOg(['--root', root, '--out', out, '--playwright', pw]);
        failed(res, breaks.join('、'));
        for (const [re, why] of expectations) assert.match(res.stderr, re, why);
        assert.deepEqual(snapshot(parent), before, '失敗時 --out 與上一層一個位元組都不動（好的那幾張也不寫：不產半套）');
    });
}

brokenCase('F8.5b 字型檔載不到（fonts.css 連的 woff2 不在）→ 結束碼 1、三張都講到、講到字型與 Google Sans Flex；--out 不動', ['font-file'], [
    [/og-zh/, '要講 og-zh'], [/og-en/, '要講 og-en'], [/og-ja/, '要講 og-ja'], [/字型/, '要講是字型的問題'], [/Google Sans Flex/, '要講是哪個字型'],
]);

brokenCase('F8.5e 指定的字型這台沒有（英文堆疊是 "Nope Sans 404", sans-serif，畫字的是系統的回退字型）→ 結束碼 1、講 og-en 與字型；--out 不動', ['font-family-en'], [
    [/og-en/, '要講 og-en'], [/字型/, '要講是字型的問題'],
]);

brokenCase('F8.5b console 有錯（中文頁連了不存在的 CSS）→ 結束碼 1、講 og-zh 與 nope.css；--out 不動', ['css-404-zh'], [
    [/og-zh/, '要講 og-zh'], [/nope\.css/, '要講載不到的是哪個檔'],
]);

brokenCase('F8.5b 頁面丟例外（日文頁的外部 .js）→ 結束碼 1、講 og-ja 與例外的訊息；--out 不動', ['script-error-ja'], [
    [/og-ja/, '要講 og-ja'], [/boom from fixture/, '要講例外的訊息'],
]);

// 字撐破版面（notes/4-4.md「分享卡：給前端怎麼出圖」第 3 條：拍之前 scrollWidth === 1200、scrollHeight === 630）：三語各驗一次，只壞那一張
for (const [lang, how] of [['zh', '中文大標重複六次，往下超出 630'], ['en', '英文大標接一個不能斷的長字，往右超出 1200'], ['ja', '日文那一行不換行，往右超出 1200']]) {
    const others = LANGS.filter((other) => other !== lang);
    brokenCase(`F8.5b 字撐破版面（${how}）→ 結束碼 1、講 og-${lang} 與 1200×630 的哪一邊超出；另外兩張不列成錯；--out 不動`, [`overflow-${lang}`], [
        [new RegExp(`og-${lang}`), `要講 og-${lang}`],
        [lang === 'zh' ? /630/ : /1200/, lang === 'zh' ? '要講高度超出 630' : '要講寬度超出 1200'],
        [new RegExp(`^(?![\\s\\S]*og-(?:${others.join('|')}))`), `另外兩張（${others.map((o) => `og-${o}`).join('、')}）沒壞，不要列成錯`],
    ]);
}
