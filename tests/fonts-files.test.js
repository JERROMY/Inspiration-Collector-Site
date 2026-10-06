// 提交進來的字型授權與字型檔（目標檔 4-b6 的 B6.1、B6.2／B6.3 的產出那一半；派工 2026-10-02 第三版。介面細則見 tests/README.md「4-b6」）。只讀 homepage/site/ 裡的檔，不連網路、不叫 python。
//
// 量什麼：
//   B6.1 public/fonts/LICENSES.md：
//        Google Sans Flex、JetBrains Mono 各一節（「## 」標題寫到字型名稱，一套剛好一節），每節剛好各一行
//        「- 授權：」「- 原文：」「- 公開 repo：」「- 授權檔：」「- 保留字型名稱：」「- CSS 名稱：」（全形或半形冒號），值不是空的；
//        原文：一個以上的 https://<有點的主機名>… 網址；公開 repo：「可以」或「不放」開頭，「不放」要寫原因；可以 → 授權檔在 public/fonts/ 底下、存在、不是空的；
//        保留字型名稱：「有」或「沒有」開頭、後面寫依據；有的話瘦身檔是修改版，CSS 名稱裡不能有原來的名字（Google Sans、JetBrains Mono）。
//        另外一節標題含「Glow Sans TC」：公開 repo 寫「不放」與原因（要寫到完整字型缺 教、告、清、真，與「系統」字型），授權檔寫「無」。網址打不打得開由檢查員用 curl 驗。
//   B6.2 public/fonts/：.woff2 剛好是 GoogleSansFlex-site.woff2 與 JetBrainsMono-site.woff2（沒有 Glow Sans TC、沒有原樣的拉丁字型）；
//        每個的 cmap（lib/woff2-cmap.js）有 U+0020～007E 全部、沒有中日文字。
//        fonts.css 剛好兩個 @font-face：font-family ＝ LICENSES.md 的 CSS 名稱、各指一個瘦身檔、swap、unicode-range 含 ASCII 全部而且不碰中日文；Google Sans Flex 是 300 700。
//        @font-face 不用 font-variation-settings 把 opsz 釘死。GoogleSansFlex-site.woff2 < 71680 位元組（70 KB）。
//        （Google Sans Flex 的可變軸剛好是 opsz 8～64 與 wght 300～700：要 python 才讀得到 fvar，放在 fonts-real.test.js。）
//   B6.1〔派工 2026-10-02〕public/ 底下的文字檔（.md、.css、.json、.txt，含 LICENSES.md）不能有內部字眼：派工、後端、測試工程師、檢查員。
//   B6.3 public/fonts/ 所有 .woff2 合計 ≤ 153600 位元組；content/*.md 的字母數字都在瘦身檔的聯集裡（npm run fonts:budget -- --text content/*.md 結束碼 0；符號只警告）。
//   B6.2 README.md 有一段（空行切段）寫到 public/fonts 與它的大小（數字＋KB／MB／KiB／MiB），跟 public/fonts/ 整個資料夾實際的大小差 5% 以內。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.1"
//   npm test -- --test-name-pattern "B6.2 public/fonts"
//   node --test tests/fonts-files.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, lib } from './helpers.js';
import { parseCss, runScript } from './b6-fixture.js';
import { ASCII, CJK, rangesOf, covers, overlapsCjk } from './b6-font-fixture.js';

const need = await lib('woff2-cmap.js', ['woff2CodePoints']);
const FONTS = path.join(SITE, 'public', 'fonts');
const LICENSES = path.join(FONTS, 'LICENSES.md');
const CSS = path.join(FONTS, 'fonts.css');
const LIMIT = 150 * 1024;
const LATIN = [
    { name: 'Google Sans Flex', reserved: /google\s*sans/i, file: 'GoogleSansFlex-site.woff2' },
    { name: 'JetBrains Mono', reserved: /jetbrains\s*mono/i, file: 'JetBrainsMono-site.woff2' },
];
const FIELDS = ['授權', '原文', '公開 repo', '授權檔', '保留字型名稱', 'CSS 名稱'];

function sections(text) {
    const list = [];
    let current = null;
    for (const row of text.split(/\r?\n/)) {
        const heading = /^##\s+(.+?)\s*$/.exec(row);
        if (heading) {
            current = { title: heading[1], rows: [] };
            list.push(current);
        } else if (current) {
            current.rows.push(row);
        }
    }
    return list;
}

function field(section, name, label) {
    const re = new RegExp(`^-\\s*${name}\\s*[：:]\\s*(.*?)\\s*$`);
    const rows = section.rows.map((row) => re.exec(row)).filter(Boolean);
    assert.equal(rows.length, 1, `LICENSES.md「${label}」那一節要剛好一行「- ${name}：…」，找到 ${rows.length} 行`);
    assert.ok(rows[0][1].length > 0, `LICENSES.md「${label}」的「${name}」不能是空的`);
    return rows[0][1];
}

function licenses() {
    assert.ok(fs.existsSync(LICENSES), '缺 public/fonts/LICENSES.md（後端查完兩套拉丁字型的授權原文之後寫）');
    const all = sections(fs.readFileSync(LICENSES, 'utf8'));
    const result = {};
    for (const font of LATIN) {
        const hits = all.filter((s) => s.title.includes(font.name));
        assert.equal(hits.length, 1, `LICENSES.md 要剛好一節「## ${font.name}」，找到 ${hits.length} 節（${all.map((s) => s.title).join('、') || '沒有任何 ## 標題'}）`);
        result[font.name] = Object.fromEntries(FIELDS.map((name) => [name, field(hits[0], name, font.name)]));
    }
    const glow = all.filter((s) => s.title.includes('Glow Sans TC'));
    assert.equal(glow.length, 1, `LICENSES.md 要剛好一節標題含「Glow Sans TC」（寫不放與原因），找到 ${glow.length} 節`);
    result.glow = glow[0];
    return result;
}

function allowed(fields, name) {
    const value = fields['公開 repo'];
    if (value.startsWith('可以')) return true;
    if (value.startsWith('不放')) return false;
    assert.fail(`${name}：「公開 repo」要以「可以」或「不放」開頭，得到「${value}」`);
}

const cssName = (fields) => fields['CSS 名稱'].replace(/[`"'「」]/g, '').trim();
const familyOf = (face) => (face.props['font-family'] ?? '').replace(/["']/g, '').trim();
const fileOf = (face) => path.basename(decodeURI((face.url ?? '').replace(/^\/fonts\//, '')));

function cssFaces() {
    assert.ok(fs.existsSync(CSS), '缺 public/fonts/fonts.css（請執行 npm run fonts -- --from <字型來源> --text <文字檔>…）');
    return parseCss(fs.readFileSync(CSS, 'utf8'));
}

function dirSize(dir) {
    let total = 0;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        total += st.isDirectory() ? dirSize(full) : st.size;
    }
    return total;
}

test('B6.1 授權：Google Sans Flex、JetBrains Mono 各一節，六個欄位齊；另有一節 Glow Sans TC', () => {
    const all = licenses();
    assert.deepEqual(Object.keys(all), [...LATIN.map((f) => f.name), 'glow']);
});

test('B6.1 授權：原文是 https 網址（一個以上；寫成 Markdown 連結也可以）', () => {
    const all = licenses();
    for (const font of LATIN) {
        const value = all[font.name]['原文'];
        const urls = value.match(/[a-z][a-z0-9+.-]*:\/\/[^\s<>()（）「」、，,]+/gi) ?? [];
        assert.ok(urls.length >= 1, `${font.name}：原文要有網址，得到「${value}」`);
        for (const url of urls) assert.match(url, /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/, `${font.name}：原文「${url}」要是 https:// 開頭、主機名有點的網址`);
    }
});

test('B6.1 授權：能放的附授權檔原文（在 public/fonts/ 底下、存在、不是空的）；不放的寫原因、授權檔「無」、public/fonts/ 沒有它', () => {
    const all = licenses();
    for (const font of LATIN) {
        const fields = all[font.name];
        if (allowed(fields, font.name)) {
            const files = [...fields['授權檔'].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
            assert.ok(files.length >= 1, `${font.name}：「授權檔」要用 \` \` 包起來寫出相對於 public/fonts/ 的路徑，得到「${fields['授權檔']}」`);
            for (const rel of files) {
                const full = path.resolve(FONTS, rel);
                assert.ok(!path.isAbsolute(rel) && full.startsWith(FONTS + path.sep), `${font.name}：授權檔 ${rel} 要在 public/fonts/ 底下（相對路徑）`);
                assert.ok(fs.existsSync(full) && fs.statSync(full).isFile(), `${font.name}：授權檔 ${rel} 不存在`);
                assert.ok(fs.readFileSync(full, 'utf8').trim().length > 0, `${font.name}：授權檔 ${rel} 是空的`);
            }
        } else {
            const reason = fields['公開 repo'].slice('不放'.length);
            assert.ok((reason.match(/[一-鿿]/g) ?? []).length >= 4, `${font.name}：寫「不放」要接著寫原因（至少 4 個中文字）`);
            assert.equal(fields['授權檔'], '無', `${font.name}：不放的話「授權檔」寫「無」`);
            assert.ok(!fs.existsSync(path.join(FONTS, font.file)), `${font.name} 寫了不放，public/fonts/ 卻有 ${font.file}`);
        }
    }
});

test('B6.1 授權：保留字型名稱寫了有沒有宣告與依據；有的話 CSS 名稱不能用原來的名字', () => {
    const all = licenses();
    for (const font of LATIN) {
        const fields = all[font.name];
        const rfn = fields['保留字型名稱'];
        assert.ok(/^(有|沒有)/.test(rfn), `${font.name}：「保留字型名稱」要以「有」或「沒有」開頭，得到「${rfn}」`);
        assert.ok(rfn.replace(/^(有|沒有)/, '').trim().length > 0, `${font.name}：「保留字型名稱」後面要寫依據（看授權原文），得到「${rfn}」`);
        const name = cssName(fields);
        assert.ok(name.length > 0, `${font.name}：「CSS 名稱」不能是空的`);
        if (rfn.startsWith('有')) assert.doesNotMatch(name, font.reserved, `${font.name}：有保留字型名稱，瘦身檔是修改版，CSS 名稱「${name}」不能用原來的名字`);
    }
});

test('B6.1 授權：Glow Sans TC 那一節寫「不放」與原因（完整字型缺 教、告、清、真；中文走系統字型），授權檔「無」', () => {
    const { glow } = licenses();
    const text = glow.rows.join('\n');
    const repo = field(glow, '公開 repo', 'Glow Sans TC');
    assert.ok(repo.startsWith('不放'), `Glow Sans TC：「公開 repo」要寫「不放」，得到「${repo}」`);
    for (const ch of ['教', '告', '清', '真']) assert.ok(text.includes(ch), `Glow Sans TC 那一節要寫到完整字型缺「${ch}」`);
    assert.ok(text.includes('系統'), 'Glow Sans TC 那一節要寫到中文改走「系統」字型');
    assert.equal(field(glow, '授權檔', 'Glow Sans TC'), '無', 'Glow Sans TC：「授權檔」寫「無」');
});

test('B6.2 public/fonts：.woff2 剛好是兩個瘦身檔（沒有 Glow Sans TC、沒有原樣的拉丁字型），每個都有 ASCII 全部、沒有中日文字', () => {
    assert.ok(fs.existsSync(FONTS), '缺 public/fonts/（請執行 npm run fonts）');
    const woff2 = fs.readdirSync(FONTS).filter((name) => name.endsWith('.woff2')).sort();
    assert.deepEqual(woff2, LATIN.map((f) => f.file).sort(), `public/fonts/ 的 .woff2 要剛好是 ${LATIN.map((f) => f.file).join('、')}`);
    const { woff2CodePoints } = need();
    for (const name of woff2) {
        const cps = new Set(woff2CodePoints(fs.readFileSync(path.join(FONTS, name))));
        const lack = [...ASCII].filter((ch) => !cps.has(ch.codePointAt(0)));
        assert.deepEqual(lack, [], `${name} 少了 ASCII 的字：${lack.join(' ')}`);
        const cjk = [...cps].filter((cp) => CJK.some(([a, b]) => cp >= a && cp <= b));
        assert.deepEqual(cjk, [], `${name} 有中日文字（中日文走系統字型）`);
    }
});

test('B6.2 public/fonts：fonts.css 剛好兩個 @font-face —— CSS 名稱、各指一個瘦身檔、swap、unicode-range 含 ASCII 不碰中日文、Google Sans Flex 300 700', () => {
    const all = licenses();
    const faces = cssFaces();
    assert.equal(faces.length, 2, `fonts.css 要剛好兩個 @font-face（沒有中日文），得到 ${faces.length}`);
    for (const font of LATIN) {
        const hits = faces.filter((face) => fileOf(face) === font.file);
        assert.equal(hits.length, 1, `fonts.css 要剛好一個 @font-face 指到 ${font.file}`);
        const face = hits[0];
        assert.equal(familyOf(face), cssName(all[font.name]), `${font.file}：font-family 要是 LICENSES.md 的 CSS 名稱`);
        assert.equal(face.props['font-display'], 'swap', `${font.file}：font-display 要是 swap`);
        assert.ok(face.props['unicode-range'], `${font.file}：要有 unicode-range`);
        const ranges = rangesOf(face.props['unicode-range']);
        for (const ch of ASCII) assert.ok(covers(ranges, ch.codePointAt(0)), `${font.file}：unicode-range 要含 U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
        assert.equal(overlapsCjk(ranges), false, `${font.file}：unicode-range 不能碰到中日文`);
    }
    const gsf = faces.find((face) => fileOf(face) === LATIN[0].file);
    assert.equal(gsf.props['font-weight'], '300 700', 'Google Sans Flex 的 font-weight 要是「300 700」');
    for (const face of faces) assert.doesNotMatch(face.props['font-variation-settings'] ?? '', /opsz/, `${fileOf(face)}：@font-face 不能用 font-variation-settings 把 opsz 釘死`);
});

test('B6.3 public/fonts：GoogleSansFlex-site.woff2 < 71680 位元組（70 KB；opsz 留 8～64 量過約 61,840）', () => {
    const file = path.join(FONTS, LATIN[0].file);
    assert.ok(fs.existsSync(file), `缺 public/fonts/${LATIN[0].file}（請執行 npm run fonts）`);
    const size = fs.statSync(file).size;
    assert.ok(size < 70 * 1024, `${LATIN[0].file} 是 ${size} 位元組，要小於 71680（70 KB）`);
});

test('B6.1 授權：public/ 底下的文字檔（含 LICENSES.md）沒有內部字眼（派工、後端、測試工程師、檢查員）', () => {
    const PUBLIC = path.join(SITE, 'public');
    const hits = [];
    const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) walk(full);
            else if (/\.(md|css|json|txt)$/i.test(name)) {
                const text = fs.readFileSync(full, 'utf8');
                for (const word of ['派工', '後端', '測試工程師', '檢查員']) if (text.includes(word)) hits.push(`${path.relative(SITE, full)}：「${word}」`);
            }
        }
    };
    walk(PUBLIC);
    assert.ok(fs.existsSync(LICENSES), '缺 public/fonts/LICENSES.md');
    assert.deepEqual(hits, [], `public/ 的檔會原樣放上網站，不能有開發流程的內部字眼：${hits.join('、')}`);
});

test('B6.3 public/fonts：所有 .woff2 合計 ≤ 153600 位元組（150 KB）', () => {
    assert.ok(fs.existsSync(FONTS), '缺 public/fonts/');
    const total = fs.readdirSync(FONTS).filter((n) => n.endsWith('.woff2')).reduce((n, f) => n + fs.statSync(path.join(FONTS, f)).size, 0);
    assert.ok(total > 0, 'public/fonts/ 沒有 .woff2（請執行 npm run fonts）');
    assert.ok(total <= LIMIT, `public/fonts/ 的 .woff2 合計 ${total} 位元組，超過 ${LIMIT}（150 KB）`);
});

test('B6.3 public/fonts：content/*.md 的字母數字都在瘦身檔裡（npm run fonts:budget 結束碼 0；使用者寫了瘦身檔沒有的字母會紅 —— 提醒重跑 npm run fonts；符號只警告）', () => {
    const content = path.join(SITE, 'content');
    const md = fs.readdirSync(content).filter((name) => name.endsWith('.md')).sort().map((name) => path.join(content, name));
    const res = runScript('fonts-budget.mjs', md.flatMap((file) => ['--text', file]));
    assert.equal(res.status, 0, `npm run fonts:budget -- --text content/*.md 要是結束碼 0，得到 ${res.status}；輸出：${res.stdout}${res.stderr}`);
});

test('B6.2 public/fonts：README.md 寫了 public/fonts 整個資料夾的大小（跟實際差 5% 以內）', () => {
    assert.ok(fs.existsSync(FONTS), '缺 public/fonts/');
    const actual = dirSize(FONTS);
    const readme = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const paragraphs = readme.split(/\r?\n\s*\r?\n/).filter((p) => p.includes('public/fonts'));
    assert.ok(paragraphs.length > 0, 'README.md 要有一段寫到 public/fonts');
    const unit = { KB: [1000, 1024], KIB: [1024], MB: [1000 ** 2, 1024 ** 2], MIB: [1024 ** 2] };
    const claims = [];
    for (const p of paragraphs) {
        for (const m of p.matchAll(/(\d+(?:[.,]\d+)?)\s*(KiB|MiB|KB|MB)\b/gi)) {
            const value = Number(m[1].replace(',', '.'));
            for (const factor of unit[m[2].toUpperCase()]) claims.push({ text: m[0], bytes: value * factor });
        }
    }
    assert.ok(claims.length > 0, `README.md 寫到 public/fonts 的那一段要寫出大小（數字＋KB／MB），實際是 ${actual} 位元組`);
    assert.ok(claims.some((c) => Math.abs(c.bytes - actual) / actual <= 0.05),
        `README.md 寫的大小（${[...new Set(claims.map((c) => c.text))].join('、')}）跟 public/fonts/ 實際的 ${actual} 位元組差超過 5%`);
});
