// 拉丁字型瘦身的命令 scripts/fonts.mjs（目標檔 4-b6 的 B6.2；派工 2026-10-02 第三版：中日文走系統字型、只放瘦身過的拉丁字型。介面細則見 tests/README.md「4-b6」）。
//
// node scripts/fonts.mjs --from <來源資料夾> --text <檔> [--text <檔>…] [--out <資料夾，預設 public/fonts>]
//   來源資料夾裡要有 GoogleSansFlex-lite-latin.woff2 與 JetBrainsMono-latin.woff2（clipper/fonts 或 design_system_nox/web/fonts）。
//   收字：每個 --text 整份，用 lib/font-text.js 的 charsOf 取字、去掉 isCjk 的（中日文走系統字型），再加上 U+0020～U+007E 全部。
//   Google Sans Flex：python -m fontTools.varLib.instancer opsz=8:64 wdth=100 slnt=0 wght=300:700（〔派工 2026-10-02〕opsz 不固定、留 8～64；wdth、slnt 固定），
//     再 python -m fontTools.subset 只留收到的字、--flavor=woff2 → <out>/GoogleSansFlex-site.woff2（可變軸剛好是 opsz 8～64 與 wght 300～700）。
//   JetBrains Mono：一樣切子集或原樣複製（後端量過決定）→ <out>/JetBrainsMono-site.woff2。
//   <out>/fonts.css：剛好兩個 @font-face（一個檔一個）、font-display: swap、format("woff2")、有 unicode-range（含 U+0020～007E 全部、不碰中日文）；
//     Google Sans Flex 那個 font-weight 是「300 700」；沒有任何中日文字型。
//   python：環境變數 PYTHON（空字串當作沒設），沒設用 PATH 的 python3；要能 import fontTools 與 brotli。
//   先查輸入（來源檔、文字檔）、再查工具；全部做好才放進 --out（--out 裡只管兩個瘦身檔與 fonts.css；〔派工 2026-10-02〕LICENSES.md、授權檔、
//   不是這支命令產出的 .woff2（別的檔名）一律不動、不刪）。
//   失敗 → 結束碼 1、stderr 中文講缺什麼、--out 一個位元組都不變、系統暫存資料夾清乾淨；用法錯誤 → 結束碼 2。
//
// 這裡用假的 python（tests/fixtures/fake-tools/python.mjs，用 PYTHON 指過去）量流程與失敗；假字型的 private data 記著它有哪些字、哪些軸，
// 所以「軸有沒有固定」「收了哪些字」看輸出檔就知道。真的 fonttools 見 fonts-real.test.js（選擇性）。假工具是開頭 #! 的腳本，Windows 上這些 skip。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.2 字型命令"
//   node --test tests/fonts-cli.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';
import { runScript, usageError, parseCss, snapshot, stamp, tmp } from './b6-fixture.js';
import { ASCII, CJK, fakeSource, installFakePython, readLog, readNote, rangesOf, covers, overlapsCjk } from './b6-font-fixture.js';

const WIN = process.platform === 'win32' ? '假的 python 是開頭 #! 的腳本，Windows 不能直接執行；這幾條在 mac／Linux 上跑' : false;
const GSF = 'GoogleSansFlex-site.woff2';
const JBM = 'JetBrainsMono-site.woff2';
// 文字檔裡的非中日文字：要進 Google Sans Flex 的子集（來源字型都有）
const USED = 'é·’“”—…→';
const isCjkCp = (cp) => CJK.some(([a, b]) => cp >= a && cp <= b);

function fonts(args, opts) {
    return runScript('fonts.mjs', args, opts);
}

function texts(t) {
    const dir = path.join(tmp(t, 'site-fonts-text-'), '文字 檔');
    fs.mkdirSync(dir);
    const copy = path.join(dir, 'copy.md');
    fs.writeFileSync(copy, `| id | zh | en | ja |\n|---|---|---|---|\n| a | 你好，「靈感」・ | It’s “ok” — é… | かな、カナ。 |\n`);
    const news = path.join(dir, 'news.zh.md');
    fs.writeFileSync(news, '## 2026-10-01 · 公告 · 標題\n下一步 → 看教學\n');
    return { copy, news };
}

// --out 裡先放舊東西：fonts.css、不是這支命令產出的 .woff2（舊做法的分片、原樣的拉丁字型、別人的字型）、LICENSES.md、licenses/
function outWithOld(t) {
    const parent = tmp(t, 'site-fonts-out-');
    const out = path.join(parent, '輸出 資料夾', 'fonts');
    fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });
    fs.writeFileSync(path.join(out, 'fonts.css'), '/* OLD */\n');
    fs.writeFileSync(path.join(out, 'GlowSansTC-Book.3.woff2'), 'OLD slice');
    fs.writeFileSync(path.join(out, 'GoogleSansFlex-lite-latin.woff2'), 'OLD latin');
    fs.writeFileSync(path.join(out, 'other-name.woff2'), 'someone else');
    fs.writeFileSync(path.join(out, 'LICENSES.md'), '# 授權\n');
    fs.writeFileSync(path.join(out, 'licenses', 'OFL.txt'), 'SIL OPEN FONT LICENSE\n');
    return { parent, out };
}

function setup(t, { omit } = {}) {
    const fake = installFakePython(t);
    const src = fakeSource(t, { omit });
    const txt = texts(t);
    const { parent, out } = outWithOld(t);
    const sysDir = tmp(t, 'site-fonts-systmp-');
    const env = { TMPDIR: sysDir, TEMP: sysDir, TMP: sysDir, PYTHON: fake.tool, FAKE_LOG: fake.log };
    const args = ['--from', src.from, '--text', txt.copy, '--text', txt.news, '--out', out];
    return { fake, src, txt, parent, out, sysDir, env, args };
}

function noteOf(file) {
    const buf = fs.readFileSync(file);
    assert.equal(buf.toString('latin1', 0, 4), 'wOF2', `${path.basename(file)} 要是 WOFF2（--flavor=woff2）`);
    const note = readNote(buf);
    assert.ok(note, `${path.basename(file)} 讀不到假字型的 note（不是由假工具或來源檔來的？）`);
    return note;
}

test('B6.2 字型命令：成功 —— --out 多了兩個瘦身檔與 fonts.css；不是這支命令產出的 .woff2、LICENSES.md、授權檔都不動；路徑有空白與中文', { skip: WIN }, (t) => {
    const ctx = setup(t);
    const before = snapshot(ctx.out);
    const res = fonts(ctx.args, { env: ctx.env });
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    const after = snapshot(ctx.out);
    for (const name of [GSF, JBM, 'fonts.css']) assert.ok(after[name], `要有 ${name}`);
    for (const name of ['GlowSansTC-Book.3.woff2', 'GoogleSansFlex-lite-latin.woff2', 'other-name.woff2', 'LICENSES.md', 'licenses/OFL.txt']) {
        assert.ok(after[name] && after[name].equals(before[name]), `${name} 不是這支命令產出的，要原封不動（不能刪、不能改）`);
    }
    assert.deepEqual(Object.keys(after).sort(), [...new Set([...Object.keys(before), GSF, JBM])].sort(), '--out 只多兩個瘦身檔（fonts.css 換新）');
});

test('B6.2 字型命令：Google Sans Flex —— 可變軸剛好是 opsz 8:64 與 wght 300:700（opsz 不固定），wdth=100、slnt=0 固定；是 WOFF2', { skip: WIN }, (t) => {
    const ctx = setup(t);
    assert.equal(fonts(ctx.args, { env: ctx.env }).status, 0, '要成功');
    const note = noteOf(path.join(ctx.out, GSF));
    assert.deepEqual(note.axes, { opsz: '8:64', wght: '300:700' }, `可變軸要剛好是 opsz 8:64 與 wght 300:700（opsz 不能固定：font 簡寫會讓瀏覽器走 optical-sizing auto），得到 ${JSON.stringify(note.axes)}`);
    assert.deepEqual(note.pinned, { wdth: '100', slnt: '0' }, `wdth、slnt 要固定成 100、0（opsz 不固定），得到 ${JSON.stringify(note.pinned)}`);
});

test('B6.2 字型命令：Google Sans Flex 的字 —— 有 U+0020～007E 全部與文字檔裡的非中日文字（é ’ “ ” — … → ·），沒有任何中日文字', { skip: WIN }, (t) => {
    const ctx = setup(t);
    assert.equal(fonts(ctx.args, { env: ctx.env }).status, 0, '要成功');
    const chars = new Set(noteOf(path.join(ctx.out, GSF)).chars);
    for (const ch of ASCII + USED) assert.ok(chars.has(ch), `${GSF} 要有「${ch}」（U+${ch.codePointAt(0).toString(16).toUpperCase()}）`);
    const cjk = [...chars].filter((ch) => isCjkCp(ch.codePointAt(0)));
    assert.deepEqual(cjk, [], `${GSF} 不能有中日文字（來源字型有「你」「か」，文字檔也有，但中日文走系統字型）`);
});

test('B6.2 字型命令：JetBrains Mono —— 是 WOFF2、有 U+0020～007E 全部、沒有中日文字（切子集或原樣複製都可以）', { skip: WIN }, (t) => {
    const ctx = setup(t);
    assert.equal(fonts(ctx.args, { env: ctx.env }).status, 0, '要成功');
    const chars = new Set(noteOf(path.join(ctx.out, JBM)).chars);
    for (const ch of ASCII) assert.ok(chars.has(ch), `${JBM} 要有「${ch}」`);
    assert.deepEqual([...chars].filter((ch) => isCjkCp(ch.codePointAt(0))), [], `${JBM} 不能有中日文字`);
});

test('B6.2 字型命令：fonts.css —— 剛好兩個 @font-face、swap、woff2、unicode-range 含 U+0020～007E 全部而且不碰中日文；Google Sans Flex 是 300 700', { skip: WIN }, (t) => {
    const ctx = setup(t);
    assert.equal(fonts(ctx.args, { env: ctx.env }).status, 0, '要成功');
    const text = fs.readFileSync(path.join(ctx.out, 'fonts.css'), 'utf8');
    const faces = parseCss(text);
    assert.equal(faces.length, 2, `fonts.css 要剛好兩個 @font-face（拉丁、等寬各一；沒有中日文），得到 ${faces.length}`);
    const files = faces.map((face) => {
        assert.ok(face.url, `每個 @font-face 都要有 url(…)，得到 ${JSON.stringify(face.props)}`);
        const rel = face.url.startsWith('/fonts/') ? face.url.slice('/fonts/'.length) : face.url;
        assert.ok(!/^[a-z]+:/i.test(rel) && !rel.startsWith('/') && !rel.includes('/'), `url 要是同一層的檔名或 /fonts/<檔>，得到 ${face.url}`);
        assert.equal(face.format, 'woff2', `${rel}：format 要是 woff2`);
        assert.equal(face.props['font-display'], 'swap', `${rel}：font-display 要是 swap`);
        assert.ok((face.props['font-family'] ?? '').replace(/["']/g, '').trim(), `${rel}：要有 font-family`);
        assert.ok(face.props['unicode-range'], `${rel}：要有 unicode-range（沒寫等於全部的字，中文頁也會去下載）`);
        const ranges = rangesOf(face.props['unicode-range']);
        for (const ch of ASCII) assert.ok(covers(ranges, ch.codePointAt(0)), `${rel}：unicode-range 要含 U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
        assert.equal(overlapsCjk(ranges), false, `${rel}：unicode-range 不能碰到中日文（${face.props['unicode-range']}）`);
        if (rel === GSF) assert.equal(face.props['font-weight'], '300 700', `${GSF}：font-weight 要是「300 700」`);
        assert.doesNotMatch(face.props['font-variation-settings'] ?? '', /opsz/, `${rel}：@font-face 不能用 font-variation-settings 把 opsz 釘死（要讓瀏覽器照字級自動選）`);
        return rel;
    });
    assert.deepEqual(files.sort(), [GSF, JBM].sort(), '兩個 @font-face 各指一個瘦身檔');
    for (const bad of [ctx.src.from, ctx.out, '/Users/', '../', 'file:']) assert.ok(!text.includes(bad), `fonts.css 不能有「${bad}」`);
});

test('B6.2 字型命令：叫 python 的方式 —— 用 -m fontTools.varLib.instancer 處理 Google Sans Flex、用 -m fontTools.subset 切它', { skip: WIN }, (t) => {
    const ctx = setup(t);
    assert.equal(fonts(ctx.args, { env: ctx.env }).status, 0, '要成功');
    const calls = readLog(ctx.fake.log);
    assert.ok(calls.some((c) => c.step === 'instancer' && c.family === 'GSF'), `要用 python -m fontTools.varLib.instancer 處理 Google Sans Flex，得到 ${JSON.stringify(calls.map((c) => c.step))}`);
    assert.ok(calls.some((c) => c.step === 'subset' && c.family === 'GSF'), '要用 python -m fontTools.subset 切 Google Sans Flex');
});

test('B6.2 字型命令：冪等 —— 同一個 --out 重跑位元組相同；換來源、換文字檔的位置與 --text 的順序，輸出也相同', { skip: WIN }, (t) => {
    const a = setup(t);
    assert.equal(fonts(a.args, { env: a.env }).status, 0, '第一次要成功');
    const first = snapshot(a.out);
    assert.equal(fonts(a.args, { env: a.env }).status, 0, '重跑要成功');
    assert.deepEqual(snapshot(a.out), first, '同一個 --out 重跑：位元組相同');
    const b = setup(t);
    assert.equal(fonts(['--text', b.txt.news, '--text', b.txt.copy, '--from', b.src.from, '--out', b.out], { env: b.env }).status, 0, '換地方、換順序要成功');
    for (const name of [GSF, JBM, 'fonts.css']) {
        assert.ok(fs.readFileSync(path.join(b.out, name)).equals(first[name]), `${name} 跟輸入放在哪裡、--text 的順序無關（沒有路徑、沒有時間）`);
    }
});

for (const [label, prepare, words, opts] of [
    ['來源缺 GoogleSansFlex-lite-latin.woff2', null, ['GoogleSansFlex-lite-latin.woff2'], { omit: ['GoogleSansFlex-lite-latin.woff2'] }],
    ['來源缺 JetBrainsMono-latin.woff2', null, ['JetBrainsMono-latin.woff2'], { omit: ['JetBrainsMono-latin.woff2'] }],
    ['文字檔不存在', (ctx) => fs.rmSync(ctx.txt.news), ['news.zh.md']],
    ['文字檔是空的', (ctx) => fs.writeFileSync(ctx.txt.news, ''), ['news.zh.md']],
    ['文字檔只有空白', (ctx) => fs.writeFileSync(ctx.txt.news, ' \n\t\n'), ['news.zh.md']],
    ['PYTHON 指到不存在的檔', (ctx) => { ctx.env.PYTHON = path.join(ctx.parent, 'no-such-python'); }, ['python 跑不起來', 'no-such-python', '找不到']],
    ['PYTHON 是空字串（當作沒設、用 PATH 的 python3；PATH 指到空資料夾）', (ctx, t) => { ctx.env.PYTHON = ''; ctx.env.PATH = tmp(t, 'site-fonts-path-'); }, ['python 跑不起來', '找不到']],
    ['python 沒有 brotli', (ctx) => { ctx.env.FAKE_NO = 'brotli'; }, ['brotli']],
    ['python 沒有 fontTools', (ctx) => { ctx.env.FAKE_NO = 'fontTools'; }, ['fontTools']],
    ['instancer 失敗', (ctx) => { ctx.env.FAKE_FAIL_INSTANCER = 'GSF'; }, ['ERR-FAKE-42']],
    ['subset 切 Google Sans Flex 失敗', (ctx) => { ctx.env.FAKE_FAIL_SUBSET = 'GSF'; }, ['ERR-FAKE-42']],
    ['subset 結束碼 0 卻沒寫出檔', (ctx) => { ctx.env.FAKE_NOOUT = 'GSF'; }, ['GoogleSansFlex']],
    ['subset 寫出 0 位元組的檔', (ctx) => { ctx.env.FAKE_EMPTY = 'GSF'; }, ['GoogleSansFlex']],
    ['來源檔不在而且 python 也找不到（先講輸入）', (ctx) => { ctx.env.PYTHON = path.join(ctx.parent, 'no-such-python'); }, ['JetBrainsMono-latin.woff2'], { omit: ['JetBrainsMono-latin.woff2'] }],
]) {
    test(`B6.2 字型命令：失敗（${label}）→ 結束碼 1、講清楚缺什麼、--out 一個位元組都不變、不留暫存`, { skip: WIN }, (t) => {
        const ctx = setup(t, opts);
        if (prepare) prepare(ctx, t);
        const before = snapshot(ctx.parent);
        const res = fonts(ctx.args, { env: ctx.env });
        assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stderr：${res.stderr}`);
        assert.match(res.stderr, /[一-鿿]/, `${label}：stderr 要是中文，得到：${res.stderr}`);
        for (const word of words) assert.ok(res.stderr.includes(word), `${label}：stderr 要講到「${word}」，得到：${res.stderr}`);
        assert.doesNotMatch(res.stderr, /cannot be empty|The argument/, `${label}：不能是 Node 的英文錯誤`);
        if (label.includes('先講輸入')) assert.doesNotMatch(res.stderr, /跑不起來/, '先查輸入、再查工具');
        assert.deepEqual(snapshot(ctx.parent), before, `${label}：--out（與它的上一層）一個位元組都不變 —— 不留半成品`);
        assert.deepEqual(fs.readdirSync(ctx.sysDir), [], `${label}：系統暫存資料夾要清乾淨`);
    });
}

test('B6.2 字型命令：--out 原本不存在、做到一半失敗 → 失敗之後 --out 還是不存在（或是空的）', { skip: WIN }, (t) => {
    const ctx = setup(t);
    ctx.env.FAKE_FAIL_SUBSET = 'GSF';
    const out = path.join(tmp(t, 'site-fonts-out-'), 'fonts');
    const res = fonts([...ctx.args.slice(0, -2), '--out', out], { env: ctx.env });
    assert.equal(res.status, 1, `結束碼要是 1；stderr：${res.stderr}`);
    assert.ok(!fs.existsSync(out) || fs.readdirSync(out).length === 0, `--out 不能留半成品，得到：${fs.existsSync(out) ? fs.readdirSync(out).join('、') : ''}`);
});

for (const [label, args] of [
    ['沒給 --from', ['--text', '<news>', '--out', '<out>']],
    ['--from 缺值', ['--text', '<news>', '--out', '<out>', '--from']],
    ['--from=（空字串）', ['--from=', '--text', '<news>', '--out', '<out>']],
    ['--from 不存在', ['--from', '<missing>', '--text', '<news>', '--out', '<out>']],
    ['--from 是一個檔', ['--from', '<news>', '--text', '<news>', '--out', '<out>']],
    ['沒給 --text', ['--from', '<from>', '--out', '<out>']],
    ['--text=（空字串）', ['--from', '<from>', '--text=', '--out', '<out>']],
    ['--out=（空字串）', ['--from', '<from>', '--text', '<news>', '--out=']],
    ['不認得的參數 --bogus', ['--from', '<from>', '--text', '<news>', '--out', '<out>', '--bogus']],
    ['多出來的位置參數 extra', ['--from', '<from>', '--text', '<news>', '--out', '<out>', 'extra']],
]) {
    test(`B6.2 字型命令：用法錯誤（${label}）→ 結束碼 2、中文、不叫 python、不寫任何檔、cwd 沒多東西`, { skip: WIN }, (t) => {
        const ctx = setup(t);
        const before = snapshot(ctx.parent);
        const cwd = tmp(t, 'site-fonts-cwd-');
        const map = { '<from>': ctx.src.from, '<news>': ctx.txt.news, '<out>': ctx.out, '<missing>': path.join(ctx.parent, 'no-such-folder') };
        const res = fonts(args.map((a) => map[a] ?? a), { cwd, env: ctx.env });
        usageError(res, label);
        assert.equal(readLog(ctx.fake.log).length, 0, `${label}：用法錯誤不能叫 python`);
        assert.deepEqual(snapshot(ctx.parent), before, `${label}：--out 不動`);
        assert.deepEqual(fs.readdirSync(cwd), [], `${label}：cwd 不能多出任何檔`);
    });
}

test('B6.5 字型命令：給了 --out 時，homepage/site/ 底下一個檔都不動', { skip: WIN }, (t) => {
    const ctx = setup(t);
    const before = stamp(SITE);
    const res = fonts(ctx.args, { env: ctx.env, cwd: tmp(t) });
    assert.equal(res.status, 0, `結束碼要是 0；stderr：${res.stderr}`);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下不能有檔被改、被加、被刪');
});
