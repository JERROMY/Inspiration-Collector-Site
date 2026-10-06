// F1b.1：<Seg> 元件 —— 把字串表裡帶斷行標記的一條字轉成 React 元素（lib/segments.js 的 parseSegments），全域 CSS 有標記要的樣式。
//
// 量什麼：
//   F1b.1 components/Seg/Seg.js 在純 Node 載得起來（不用 JSX、不 import CSS）、預設匯出一個元件、用 lib/segments.js 的 parseSegments、自己沒有 dangerouslySetInnerHTML。
//   F1b.1 三語字串表裡每一條帶標記的字（含 %url% %nn% %章名%，代入值故意放 <script>、&、"），用 react-dom/server 的 renderToStaticMarkup 轉出來，
//         跟照 strings/README.md「轉換順序」8 步轉出來的 HTML 一樣（tests/b7-fixture.js 的 readmeHtml；<wbr/> 與 <wbr> 算一樣、&#x27; 與 ' 算一樣）。
//   F1b.1 沒有標記的字原樣（只有 React 的跳脫）；代入值裡的 <script> 被跳脫、不會變成標籤。
//   F1b.1 ↵ 的兩行大標（forai.title）：剛好一個 forai__l1、一個 forai__l2；中文、日文兩個 span 之間什麼都沒有，英文是一個空白。
//   F1b.1 壞標記丟錯、不吞（沒關的 «、{ 裡又有 {、字面的 %）。
//   F1b.1 app/、components/ 裡每一個 dangerouslySetInnerHTML 放的都是 bindTail(…) 的輸出（使用者寫的內容）；也不用 renderToString／renderToStaticMarkup 把 <Seg> 轉成字串。
//   F1b.1 build 出來的 CSS 有標記的樣式（全域、class 名稱沒被換掉）：.u（inline-block、max-width 100%）、.nw（nowrap）、.clamp、.brk、.brk--l、.brk--r、
//         320 寬起 .nw-wide nowrap、319 寬以下 .brk-narrow::after 的零寬空白、.forai__l1、.forai__l2。對照 strings/README.md 標記表的「樣式」欄。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1b.1"
//   最後一條讀 build 出來的 out/，要先 npm run build；其餘不必 build，但要先 npm ci（react、react-dom）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITE, LANGS, listFiles, outCss, cssRules, stripCssComments } from './helpers.js';
import { readmeHtml } from '../tests/b7-fixture.js';

const SEG = path.join(SITE, 'components', 'Seg', 'Seg.js');
const MARKS = /[«»{}|⟨⟩⟦⟧⁅⁆¦↵%]/;
// 代入值故意放會被當成 HTML 的字：要被跳脫，而且不再轉標記
const VALUES = { url: 'https://collector.jerromy.com/zh/?a=1&b="2"<script>x</script>', nn: '07', 章名: '<b>章&名«不轉»{也不}</b>' };

const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));

let loaded = null;
async function load() {
    if (loaded) return loaded;
    assert.ok(fs.existsSync(SEG), '缺 components/Seg/Seg.js（<Seg> 元件）');
    let mod;
    try {
        mod = await import(pathToFileURL(SEG).href);
    } catch (err) {
        assert.fail(`components/Seg/Seg.js 在純 Node 載不起來（不能用 JSX、不能 import CSS）：${err.message}`);
    }
    assert.equal(typeof mod.default, 'function', 'components/Seg/Seg.js 要預設匯出 <Seg> 元件');
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    loaded = { render: (props) => renderToStaticMarkup(createElement(mod.default, props)), createElement };
    return loaded;
}

function same(html) {
    return html.replace(/<wbr\s*\/>/g, '<wbr>').replace(/&#x27;|&#39;/g, "'");
}

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sources() {
    const files = [];
    for (const top of ['app', 'components']) {
        for (const rel of listFiles(path.join(SITE, top))) {
            if (/\.(m?js|jsx)$/.test(rel)) files.push({ rel: `${top}/${rel}`, text: fs.readFileSync(path.join(SITE, top, ...rel.split('/')), 'utf8') });
        }
    }
    return files;
}

test('F1b.1 <Seg> 在純 Node 載得起來，用 lib/segments.js 的 parseSegments，自己沒有 dangerouslySetInnerHTML', async () => {
    await load();
    const src = code(fs.readFileSync(SEG, 'utf8'));
    assert.doesNotMatch(src, /import\s[^;]*\.css['"]|import\s*['"][^'"]*\.css['"]/, 'components/Seg/Seg.js 不 import CSS（.u .nw 這些是全域 class，由全域 CSS 提供）');
    assert.match(src, /from\s*['"][./]*lib\/segments\.js['"]/, 'components/Seg/Seg.js 要 import lib/segments.js');
    assert.match(src, /\bparseSegments\s*\(/, 'components/Seg/Seg.js 要用 parseSegments 解析（不自己再寫一次）');
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/, 'components/Seg/Seg.js 不能用 dangerouslySetInnerHTML（字串節點沒跳脫，要交給 React）');
});

test('F1b.1 三語每一條帶標記的字：<Seg> 轉出的 HTML 跟 README 的 8 步同構（含代入值）', async () => {
    const { render } = await load();
    let count = 0;
    const wrong = [];
    for (const lang of LANGS) {
        for (const [id, text] of Object.entries(strings[lang])) {
            if (!MARKS.test(text)) continue;
            count += 1;
            const values = text.includes('%') ? VALUES : undefined;
            const got = same(render({ text, values }));
            const want = readmeHtml(text, values);
            if (got !== want) wrong.push(`${lang} ${id}\n  得到 ${got}\n  應該 ${want}`);
        }
    }
    assert.ok(count >= 100, `防呆：帶標記的字太少（${count}），字串表不對？`);
    assert.deepEqual(wrong.slice(0, 5), [], `${wrong.length} 條跟 README 的轉換結果不一樣（列前 5 條）`);
});

test('F1b.1 沒有標記的字原樣（只有 React 的跳脫）', async () => {
    const { render } = await load();
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let count = 0;
    for (const lang of LANGS) {
        for (const [id, text] of Object.entries(strings[lang])) {
            if (MARKS.test(text)) continue;
            count += 1;
            assert.equal(same(render({ text })), escape(text), `${lang} ${id}：沒有標記的字要原樣出來`);
        }
    }
    assert.ok(count >= 20, `防呆：沒有標記的字太少（${count}）`);
    assert.equal(same(render({ text: 'A <b> & "q"' })), 'A &lt;b&gt; &amp; &quot;q&quot;', '字裡的 < & " 要被跳脫');
});

test('F1b.1 代入值被跳脫、不會變成標籤，也不再轉標記', async () => {
    const { render } = await load();
    for (const lang of LANGS) {
        for (const id of ['mail.self.body', 'tutorial.done', 'features.more']) {
            const html = render({ text: strings[lang][id], values: VALUES });
            assert.doesNotMatch(html, /<script|<b>/, `${lang} ${id}：代入值裡的 <script>、<b> 變成了真的標籤`);
            if (strings[lang][id].includes('%url%')) assert.match(html, /&lt;script&gt;/, `${lang} ${id}：%url% 的值要跳脫後放進去`);
            if (strings[lang][id].includes('%章名%')) assert.ok(html.includes('&lt;b&gt;章&amp;名«不轉»{也不}&lt;/b&gt;'), `${lang} ${id}：%章名% 的值原樣（跳脫）放進去，裡面的 «» {} 不轉`);
        }
    }
});

test('F1b.1 ↵ 的兩行大標（forai.title）：一個 l1、一個 l2，中日文中間沒有東西、英文一個空白', async () => {
    const { render } = await load();
    for (const lang of LANGS) {
        const html = same(render({ text: strings[lang]['forai.title'] }));
        assert.ok(html.startsWith('<span class="forai__l1">'), `${lang}：forai.title 要從 <span class="forai__l1"> 開始，得到 ${html}`);
        assert.equal((html.match(/class="forai__l1"/g) ?? []).length, 1, `${lang}：剛好一個 forai__l1`);
        assert.equal((html.match(/class="forai__l2"/g) ?? []).length, 1, `${lang}：剛好一個 forai__l2`);
        const gap = lang === 'en' ? ' ' : '';
        assert.ok(html.includes(`</span>${gap}<span class="forai__l2">`), `${lang}：兩個 span 之間要是 ${JSON.stringify(gap)}，得到 ${html}`);
        assert.ok(html.endsWith('</span>'), `${lang}：forai.title 要以 forai__l2 結束`);
    }
});

test('F1b.1 壞標記丟錯、不吞', async () => {
    const { render } = await load();
    for (const bad of ['«沒有關起來', '{外{內}}', '50% 的人', '»多出來']) {
        assert.throws(() => render({ text: bad }), /第 \d+ 字/, `「${bad}」：壞標記要丟錯（parseSegments 的錯誤），不能靜靜畫出來`);
    }
});

test('F1b.1 app/、components/ 的 dangerouslySetInnerHTML 只放 bindTail 的輸出（結構化資料例外：JSON.stringify 並跳脫 <）；<Seg> 不轉成字串', () => {
    const files = sources();
    assert.ok(files.length > 0, 'app/、components/ 底下沒有程式？');
    for (const { rel, text } of files) {
        const src = code(text);
        for (const m of src.matchAll(/dangerouslySetInnerHTML/g)) {
            const after = src.slice(m.index, m.index + 200);
            // 例外：結構化資料（<script type="application/ld+json">）只能這樣放，內容要是 JSON.stringify(…)，而且把 < 換成 \u003c（字裡有 </script> 也跳不出去）
            if (/application\/ld\+json/.test(src.slice(Math.max(0, m.index - 200), m.index))) {
                // 換成的字也要比對：要是轉義寫法 '\\u003c'（原始碼裡是反斜線＋u003c），換成「<」本身等於沒跳脫
                assert.match(src.slice(m.index, m.index + 400), /__html\s*:\s*JSON\.stringify\([\s\S]*?\)\s*\.replace\(\s*\/<\/g\s*,\s*(['"])\\\\u003c\1\s*\)/, `${rel}：結構化資料的 dangerouslySetInnerHTML 要放 JSON.stringify(…).replace(/</g, '\\\\u003c')`);
                continue;
            }
            assert.match(after, /__html\s*:\s*bindTail\s*\(/, `${rel}：dangerouslySetInnerHTML 只能放 bindTail(…) 的輸出（使用者寫的內容）；字串表的字用 <Seg>、交給 React 跳脫`);
        }
        assert.doesNotMatch(src, /\brenderTo(Static)?(Markup|String)\b/, `${rel}：不要把元件轉成 HTML 字串再放（renderToString／renderToStaticMarkup）`);
    }
});

// @media 區塊：[{ query, rules }]（rules 是區塊裡最內層的規則）
function mediaBlocks(css) {
    const out = [];
    const src = stripCssComments(css);
    for (const m of src.matchAll(/@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) out.push({ query: m[1].trim(), rules: cssRules(m[2]) });
    return out;
}

function hasClass(selector, name) {
    return new RegExp(`\\.${name.replace(/-/g, '\\-')}(?![\\w-])`).test(selector);
}

test('F1b.1 build 出來的 CSS 有標記的樣式（全域 class）：.u .nw .clamp .brk .brk--l .brk--r .nw-wide .brk-narrow .forai__l1 .forai__l2', () => {
    const css = outCss();
    const rules = css.flatMap(({ text }) => cssRules(text));
    const media = css.flatMap(({ text }) => mediaBlocks(text));
    const rule = (name, body) => rules.some((r) => r.selectors.split(',').some((s) => hasClass(s, name)) && (!body || body.test(r.body)));
    const missing = [];
    if (!rule('u', /display\s*:\s*inline-block/) || !rule('u', /max-width\s*:\s*100%/)) missing.push('.u { display: inline-block; max-width: 100% }');
    if (!rule('nw', /white-space\s*:\s*nowrap/)) missing.push('.nw { white-space: nowrap }');
    for (const name of ['clamp', 'brk', 'brk--l', 'brk--r', 'forai__l1', 'forai__l2']) if (!rule(name)) missing.push(`.${name}`);
    const wide = media.some((b) => /min-width\s*:\s*320px|width\s*>=\s*320px/.test(b.query)
        && b.rules.some((r) => hasClass(r.selectors, 'nw-wide') && /white-space\s*:\s*nowrap/.test(r.body)));
    if (!wide) missing.push('@media (min-width: 320px) { .nw-wide { white-space: nowrap } }');
    const narrow = media.some((b) => /max-width\s*:\s*319px|width\s*<=\s*319px|width\s*<\s*320px/.test(b.query)
        && b.rules.some((r) => /\.brk-narrow::?after/.test(r.selectors) && /content\s*:\s*["'](\\200[bB]\s*|​)["']/.test(r.body)));
    if (!narrow) missing.push('@media (max-width: 319px) { .brk-narrow::after { content: "\\200B" } }');
    assert.deepEqual(missing, [], `build 出來的 CSS 少了這些標記的樣式（照 strings/README.md 標記表的「樣式」欄，寫在全域 CSS、class 名稱不能被 CSS Modules 換掉）`);
});

// ---- <b> 與結尾圖示（hero.mobile.text、hero.pc）：<Seg bold="…"> 與 <Seg tail={…}> ----
// 介面（README.md「<Seg> 的 bold 與 tail」）：
//   bold：字串表的另一條原字（帶標記，例如 getString(lang, 'hero.mobile.bold')）。在 text 的第一個 «…» 裡、緊接著那個 « 之後原樣出現 → 那一段包 <b>。
//         找不到（不在第一個 «…» 開頭、或 text 沒有 «）丟 Error（產生網頁失敗），不靜靜不包。
//   tail：一個 React 元素（例如箭頭圖示），放進最後一個 {…}（.nw）的裡面、結尾；text 沒有 {…} 時放在最後面。
// 預期的 HTML 用 README 的 8 步（readmeHtml）轉出來，再照上面的規則插 <b>、<i>T</i>（測試的 tail）。

// 從 at 起（at 是一個 <span 的開頭）找它對應的 </span> 的位置
function closeOf(html, at) {
    let depth = 0;
    const re = /<span\b|<\/span>/g;
    re.lastIndex = at;
    for (let m = re.exec(html); m; m = re.exec(html)) {
        depth += m[0] === '</span>' ? -1 : 1;
        if (depth === 0) return m.index;
    }
    return -1;
}

function withBold(html, boldHtml) {
    const open = '<span class="u">';
    assert.ok(html.startsWith(open) && html.slice(open.length).startsWith(boldHtml), `防呆：測試的字不是「第一個 «…» 開頭就是 bold」的形狀：${html}`);
    return open + '<b>' + boldHtml + '</b>' + html.slice(open.length + boldHtml.length);
}

function withTail(html, tailHtml) {
    const at = html.lastIndexOf('<span class="nw">');
    if (at < 0) return html + tailHtml;
    const close = closeOf(html, at);
    return html.slice(0, close) + tailHtml + html.slice(close);
}

test('F4.1 <Seg bold>：hero.mobile.text 第一個 «…» 開頭那段（＝hero.mobile.bold）包 <b>（三語）', async () => {
    const { render } = await load();
    for (const lang of LANGS) {
        const text = strings[lang]['hero.mobile.text'];
        const bold = strings[lang]['hero.mobile.bold'];
        const got = same(render({ text, bold }));
        assert.equal(got, withBold(readmeHtml(text), readmeHtml(bold)), `${lang}：<b> 要剛好包住 hero.mobile.bold 那一段（在第一個 «…» 開頭）`);
        assert.equal((got.match(/<b>/g) ?? []).length, 1, `${lang}：剛好一個 <b>`);
    }
});

test('F4.1 <Seg tail>：hero.pc 的結尾圖示放進最後一個 {…} 的裡面（三語）；沒有 {…} 時放在最後', async () => {
    const { render, createElement } = await load();
    const tail = createElement('i', null, 'T');
    for (const lang of LANGS) {
        const text = strings[lang]['hero.pc'];
        assert.ok(text.includes('{'), `防呆：${lang} hero.pc 要有 {…}`);
        assert.equal(same(render({ text, tail })), withTail(readmeHtml(text), '<i>T</i>'), `${lang}：tail 要在最後一個 <span class="nw"> 的裡面、結尾（跟最後一個詞一起換行）`);
    }
    assert.equal(same(render({ text: '{外 ⟨⟦AI⟧⟩。}', tail })), withTail(readmeHtml('{外 ⟨⟦AI⟧⟩。}'), '<i>T</i>'), '{…} 裡面還有 span 時，tail 放在 .nw 自己的結尾（不是裡面那個 span）');
    assert.equal(same(render({ text: 'A «b» c', tail })), readmeHtml('A «b» c') + '<i>T</i>', '沒有 {…}：tail 放在最後面');
    assert.equal(same(render({ text: strings.zh['hero.sub'] })), readmeHtml(strings.zh['hero.sub']), '沒給 bold、tail：跟原本一樣');
});

test('F4.1 <Seg bold> 找不到那一段要丟錯（不靜靜不包）', async () => {
    const { render } = await load();
    assert.throws(() => render({ text: '«甲乙丙，»«丁。»', bold: '戊己' }), Error, 'bold 不在第一個 «…» 開頭：要丟錯');
    assert.throws(() => render({ text: '甲乙丙，丁。', bold: '甲乙' }), Error, 'text 沒有 «…»：要丟錯');
    assert.throws(() => render({ text: '«乙甲丙»', bold: '甲' }), Error, 'bold 出現了但不在 « 的緊後面：要丟錯');
});

