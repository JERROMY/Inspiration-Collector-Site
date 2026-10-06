// 用真的 fonttools 跑拉丁字型瘦身與預算（目標檔 4-b6 的 B6.2、B6.3；派工 2026-10-02 第三版）：選擇性跑。介面細則見 tests/README.md「4-b6」。
//
// 要有能 import fontTools 與 brotli 的 python（環境變數 PYTHON，沒設用 PATH 的 python3）；沒有就 skip 並寫出原因。
// 不讀設計系統與 clipper 的字型：用那個 python 的 fontTools.fontBuilder 現做兩個很小的可變字型 ——
//   GoogleSansFlex-lite-latin.woff2（四個軸 opsz 8～144、wdth 25～151、slnt -10～0、wght 1～1000；字有 ASCII、é … → ·、還有「你」）
//   JetBrainsMono-latin.woff2（一個軸 wght 100～800；字有 ASCII 與 →）。
//
// 量什麼：
//   B6.2 命令 scripts/fonts.mjs 只靠 PYTHON 拿工具：結束碼 0；兩個輸出都是 WOFF2；Google Sans Flex 的 fvar 軸剛好是 opsz 8～64 與 wght 300～700（〔派工 2026-10-02〕opsz 不固定）；
//        cmap 有 ASCII 全部與文字檔裡的非中日文字（é … →）、沒有「你」（在字型裡、也在文字檔裡，但中日文走系統字型）；JetBrains Mono 沒有中日文字、有 ASCII。
//   B6.3 lib/woff2-cmap.js 讀真的輸出，跟 fontTools 讀到的一樣；fonts:budget 量這兩個檔：結束碼 0；文字檔多一個字型沒有的符號 ↺ → 還是 0、警告 U+21BA；
//        再多一個字型沒有的字母 ñ → 結束碼 1、列出 U+00F1。
//   B6.2 提交進來的 public/fonts/GoogleSansFlex-site.woff2：fvar 軸剛好是 opsz 8～64 與 wght 300～700（不在就紅，請執行 npm run fonts）。
//
// 跑法（在 homepage/site/）：
//   PYTHON=<有 fonttools 與 brotli 的 python> npm test -- --test-name-pattern "真的 fonttools"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, lib } from './helpers.js';
import { runScript, tmp } from './b6-fixture.js';
import { ASCII, realPython } from './b6-font-fixture.js';

const REAL = realPython();
const need = await lib('woff2-cmap.js', ['woff2CodePoints']);

const BUILD = `
import sys, json
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
out, family, chars_file, axes = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
chars = open(chars_file, encoding='utf-8').read()
cps = sorted(set(ord(c) for c in chars))
names = ['.notdef'] + ['u%04X' % c for c in cps]
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(names)
fb.setupCharacterMap({c: 'u%04X' % c for c in cps})
pen = TTGlyphPen(None); pen.moveTo((0, 0)); pen.lineTo((0, 500)); pen.lineTo((500, 500)); pen.closePath()
glyph = pen.glyph()
fb.setupGlyf({n: glyph for n in names})
fb.setupHorizontalMetrics({n: (600, 0) for n in names})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({'familyName': family, 'styleName': 'Regular'})
fb.setupOS2(); fb.setupPost()
fb.setupFvar([tuple(a) for a in axes], [])
fb.setupGvar({})
fb.font.flavor = 'woff2'
fb.save(out)
`;
const INSPECT = `
import sys, json
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1])
axes = [[a.axisTag, a.minValue, a.maxValue] for a in f['fvar'].axes] if 'fvar' in f else []
print(json.dumps({'flavor': f.flavor, 'axes': axes, 'cmap': sorted(f.getBestCmap().keys())}))
`;

function python(dir, script, args) {
    const file = path.join(dir, 'script.py');
    fs.writeFileSync(file, script);
    const res = spawnSync(REAL.python, [file, ...args], { encoding: 'utf8', timeout: 120000 });
    assert.equal(res.status, 0, `python 跑失敗：${res.stderr}`);
    return res.stdout;
}

function makeFont(dir, out, family, chars, axes) {
    const list = path.join(dir, `${family}.txt`);
    fs.writeFileSync(list, chars);
    python(dir, BUILD, [out, family, list, JSON.stringify(axes)]);
}

const inspect = (dir, file) => JSON.parse(python(dir, INSPECT, [file]));
// 〔派工 2026-10-02〕opsz 不固定（font 簡寫會把 font-variation-settings 重設，瀏覽器走 font-optical-sizing: auto，opsz 跟著字級走），留 8～64
const WANT_AXES = [['opsz', 8, 64], ['wght', 300, 700]];
const sortAxes = (axes) => [...axes].sort((a, b) => a[0].localeCompare(b[0]));
const cps = (chars) => [...new Set([...chars].map((c) => c.codePointAt(0)))].sort((a, b) => a - b);

test('B6.2／B6.3 真的 fonttools：瘦身、fvar、cmap、預算與缺字', { skip: REAL.skip ?? false }, (t) => {
    const work = path.join(tmp(t, 'site-fonts-real-'), '真的 工具');
    const from = path.join(work, '字型 原檔');
    fs.mkdirSync(from, { recursive: true });
    makeFont(work, path.join(from, 'GoogleSansFlex-lite-latin.woff2'), 'Fake Flex', ASCII + 'é…→·你',
        [['opsz', 8, 18, 144, 'Optical size'], ['wdth', 25, 100, 151, 'Width'], ['slnt', -10, 0, 0, 'Slant'], ['wght', 1, 400, 1000, 'Weight']]);
    makeFont(work, path.join(from, 'JetBrainsMono-latin.woff2'), 'Fake Mono', ASCII + '→', [['wght', 100, 400, 800, 'Weight']]);
    const text = path.join(work, 'copy.md');
    fs.writeFileSync(text, '| id | zh | en |\n|---|---|---|\n| a | 你好，教學・ | é… → |\n');
    const out = path.join(work, 'out');

    const res = runScript('fonts.mjs', ['--from', from, '--text', text, '--out', out], { env: { PYTHON: REAL.python } });
    assert.equal(res.status, 0, `npm run fonts 要成功，得到 ${res.status}；stderr：${res.stderr}`);
    const gsf = path.join(out, 'GoogleSansFlex-site.woff2');
    const jbm = path.join(out, 'JetBrainsMono-site.woff2');
    const g = inspect(work, gsf);
    assert.equal(g.flavor, 'woff2', 'GoogleSansFlex-site.woff2 要是 WOFF2');
    assert.deepEqual(sortAxes(g.axes), WANT_AXES, `Google Sans Flex 的可變軸要剛好是 opsz 8～64 與 wght 300～700，得到 ${JSON.stringify(g.axes)}`);
    for (const cp of cps(ASCII + 'é…→')) assert.ok(g.cmap.includes(cp), `Google Sans Flex 要有 U+${cp.toString(16).toUpperCase()}（ASCII 與文字檔裡的非中日文字）`);
    assert.ok(!g.cmap.includes(0x4f60), 'Google Sans Flex 不能有「你」（字型有、文字檔也有，但中日文走系統字型）');
    const j = inspect(work, jbm);
    assert.equal(j.flavor, 'woff2', 'JetBrainsMono-site.woff2 要是 WOFF2');
    for (const cp of cps(ASCII)) assert.ok(j.cmap.includes(cp), `JetBrains Mono 要有 U+${cp.toString(16).toUpperCase()}`);
    assert.ok(j.cmap.every((cp) => cp < 0x2e80 || (cp > 0x9fff && cp < 0xf900) || (cp > 0xffef && cp < 0x20000)), 'JetBrains Mono 不能有中日文字');

    const { woff2CodePoints } = need();
    assert.deepEqual(woff2CodePoints(fs.readFileSync(gsf)), g.cmap, 'lib/woff2-cmap.js 讀真的輸出，要跟 fontTools 一樣');
    assert.deepEqual(woff2CodePoints(fs.readFileSync(jbm)), j.cmap, 'lib/woff2-cmap.js 讀真的輸出，要跟 fontTools 一樣');

    const ok = runScript('fonts-budget.mjs', ['--text', text, '--fonts', out]);
    assert.equal(ok.status, 0, `fonts:budget 要是結束碼 0，得到 ${ok.status}；輸出：${ok.stdout}${ok.stderr}`);
    fs.appendFileSync(text, '| b | 重來 | Again ↺ |\n');
    const warn = runScript('fonts-budget.mjs', ['--text', text, '--fonts', out]);
    assert.equal(warn.status, 0, `字型沒有的符號 ↺ 只警告：fonts:budget 要是結束碼 0，得到 ${warn.status}；輸出：${warn.stdout}${warn.stderr}`);
    assert.ok((warn.stdout + warn.stderr).includes('U+21BA') && /警告/.test(warn.stdout + warn.stderr), `要警告 ↺ U+21BA，得到：${warn.stdout}${warn.stderr}`);
    fs.appendFileSync(text, '| c | 西班牙 | Año |\n');
    const bad = runScript('fonts-budget.mjs', ['--text', text, '--fonts', out]);
    assert.equal(bad.status, 1, `字型沒有字母 ñ：fonts:budget 要是結束碼 1，得到 ${bad.status}`);
    assert.ok((bad.stdout + bad.stderr).includes('U+00F1'), `要列出 ñ U+00F1，得到：${bad.stdout}${bad.stderr}`);
});

test('B6.2 真的 fonttools：提交進來的 public/fonts/GoogleSansFlex-site.woff2 的可變軸剛好是 opsz 8～64 與 wght 300～700', { skip: REAL.skip ?? false }, (t) => {
    const file = path.join(SITE, 'public', 'fonts', 'GoogleSansFlex-site.woff2');
    assert.ok(fs.existsSync(file), '缺 public/fonts/GoogleSansFlex-site.woff2（請執行 npm run fonts）');
    const info = inspect(tmp(t, 'site-fonts-real-'), file);
    assert.equal(info.flavor, 'woff2');
    assert.deepEqual(sortAxes(info.axes), WANT_AXES, `可變軸要剛好是 opsz 8～64 與 wght 300～700，得到 ${JSON.stringify(info.axes)}`);
});
