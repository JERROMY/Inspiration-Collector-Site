// F1.5（字型與樣式）裡不用瀏覽器的那幾條。用瀏覽器量的（實際請求、CLS）在 fonts-browser.test.js。
//
// 量什麼：
//   F1.5 out/fonts/ 有 GoogleSansFlex-site.woff2、JetBrainsMono-site.woff2、fonts.css，跟 public/fonts/ 位元組相同，三個合計 ≤ 150 KB（153600 位元組）。
//   F1.5 out/ 裡的字型檔就只有那兩個（next/font 這類會另外產字型檔的做法、中日文字型都會紅）；
//        build 出來的每一個用 url() 的 @font-face 都指到那兩個檔、都有 unicode-range、而且不碰中日文（中文頁才不會下載）。
//   F1.5 設計系統的複本：app/styles/nox/ 底下每一支跟 clipper/css 的同名檔位元組相同（不手改）；至少有 tokens.color.css、tokens.type.css、tokens.scale.css、base.css。
//        GPTPlugins 外面（搬進公開 repo 之後）沒有 clipper/css，比對那一半 skip。
//   F1.5 網站自己的 CSS（app/、components/ 底下，app/styles/nox/ 除外）沒有寫死色碼：宣告的值裡沒有 #色碼、rgb(數字…)、rgba(、hsl(數字…)。
//   F1.5 [hidden] { display: none !important } 在 build 出來的 CSS 裡（坑 2）。
//   F1.5 坑 9：網站自己的 CSS 檔同時有 white-space: nowrap 與 grid-template-columns 時，每一欄都要是 minmax(0, …) 或固定寬度 ——
//        不能是 auto、1fr、min-content、max-content、fit-content()、minmax(auto, …)（會被最長那行撐寬）。
//   F1.5 三語頁與 404 的 <head> 預載首屏的拉丁字型：剛好一條 <link rel="preload" as="font" href="/fonts/GoogleSansFlex-site.woff2" crossorigin>（重複一條也會紅）；
//        「/」零條（有 JS 時它一開頁就跳走，先下載字型只是跟分流搶頻寬）。
//   F1.5 回退字型同寬：build 出來的 CSS（或 HTML 的 <style>）有一個 src 用 local() 的 @font-face，寫了 size-adjust。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.5"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, OUT, LANGS, NOX_DIR, FONT_FILES, needOut, readOut, listFiles, tagAttrs, siteCss, outCss, cssRules, stripCssComments, parseUnicodeRange, touchesCjk } from './helpers.js';

const BUDGET = 153600;
const CLIPPER_CSS = path.join(SITE, '..', '..', 'clipper', 'css');
const NOX_REQUIRED = ['tokens.color.css', 'tokens.type.css', 'tokens.scale.css', 'base.css'];

function fontFaces(css) {
    return [...stripCssComments(css).matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
}

function prop(body, name) {
    const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(body);
    return m ? m[1].trim() : null;
}

test('F1.5 out/fonts/ 是 public/fonts/ 的兩個瘦身字型與 fonts.css，合計 ≤ 150 KB', () => {
    needOut();
    let total = 0;
    for (const name of [...FONT_FILES, 'fonts.css']) {
        const built = path.join(OUT, 'fonts', name);
        assert.ok(fs.existsSync(built), `out/fonts/${name} 不在（字型要用後端放好的 public/fonts/）`);
        assert.ok(fs.readFileSync(built).equals(fs.readFileSync(path.join(SITE, 'public', 'fonts', name))), `out/fonts/${name} 跟 public/fonts/${name} 不一樣`);
        total += fs.statSync(built).size;
    }
    assert.ok(total <= BUDGET, `兩個字型＋fonts.css 合計 ${total} 位元組，超過 150 KB（${BUDGET}）`);
});

test('F1.5 out/ 裡的字型檔只有那兩個；用 url() 的 @font-face 都指到它們、都有 unicode-range、不碰中日文', () => {
    needOut();
    const fonts = listFiles(OUT).filter((r) => /\.(woff2?|ttf|otf|eot)$/i.test(r));
    assert.deepEqual(fonts, FONT_FILES.map((n) => `fonts/${n}`).sort(), `out/ 裡的字型檔要剛好是 fonts/ 那兩個（中文走系統字型；不用 next/font），得到 ${fonts.join('、')}`);
    const css = [...outCss(), { rel: 'fonts/fonts.css', text: readOut('fonts/fonts.css') }];
    let withUrl = 0;
    for (const { rel, text } of css) {
        for (const body of fontFaces(text)) {
            const src = prop(body, 'src') ?? '';
            const urls = [...src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
            if (urls.length === 0) continue;
            withUrl += 1;
            for (const url of urls) {
                assert.ok(FONT_FILES.some((n) => url === `/fonts/${n}` || url.endsWith(`/fonts/${n}`) || url === n),
                    `${rel} 的 @font-face 指到 ${url}：網頁字型只有 /fonts/ 那兩個瘦身檔`);
            }
            const range = prop(body, 'unicode-range');
            assert.ok(range, `${rel} 有一個 @font-face 沒寫 unicode-range（等於全部的字，中文頁也會去下載）：${body.trim()}`);
            const parsed = parseUnicodeRange(range);
            assert.ok(parsed, `${rel} 的 unicode-range 看不懂：${range}`);
            assert.ok(!touchesCjk(parsed), `${rel} 的 @font-face 的 unicode-range 碰到中日文（${range}）：中日文走系統字型`);
        }
    }
    assert.ok(withUrl >= 2, `build 出來的 CSS 與 fonts.css 裡，用 url() 的 @font-face 要至少兩個（拉丁、等寬），得到 ${withUrl}`);
});

test('F1.5 設計系統的複本跟 clipper/css 位元組相同（不手改）', (t) => {
    assert.ok(fs.existsSync(NOX_DIR), '設計系統的複本放 app/styles/nox/（檔名跟 clipper/css 一樣）');
    const files = fs.readdirSync(NOX_DIR).filter((n) => n.endsWith('.css')).sort();
    for (const name of NOX_REQUIRED) assert.ok(files.includes(name), `app/styles/nox/ 少了 ${name}`);
    if (!fs.existsSync(CLIPPER_CSS)) {
        t.skip('這裡沒有 clipper/css（搬進公開 repo 之後）：只量了檔案在，位元組比對要在 GPTPlugins 裡跑');
        return;
    }
    for (const name of files) {
        const ref = path.join(CLIPPER_CSS, name);
        assert.ok(fs.existsSync(ref), `app/styles/nox/${name}：clipper/css 沒有同名檔 —— 這一夾只放設計系統的複本，網站自己的 CSS 放外面`);
        assert.ok(fs.readFileSync(path.join(NOX_DIR, name)).equals(fs.readFileSync(ref)), `app/styles/nox/${name} 跟 clipper/css/${name} 不一樣：設計系統的複本不要手改，要改回設計系統改`);
    }
});

test('F1.5 網站自己的 CSS 沒有寫死色碼（只用 token 的 var(--…)）', () => {
    const files = siteCss();
    assert.ok(files.length > 0, 'app/、components/ 底下沒有網站自己的 CSS？（全域樣式、CSS Modules）');
    for (const { rel, text } of files) {
        for (const rule of cssRules(text)) {
            for (const decl of rule.body.split(';')) {
                const colon = decl.indexOf(':');
                if (colon < 0) continue;
                const name = decl.slice(0, colon).trim();
                const value = decl.slice(colon + 1);
                assert.doesNotMatch(value, /#[0-9a-fA-F]{3,8}\b/, `${rel}：${rule.selectors} 的 ${name} 寫死了色碼（${value.trim()}），用設計系統的 var(--color-…)`);
                assert.doesNotMatch(value, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-\d.]/i, `${rel}：${rule.selectors} 的 ${name} 寫死了顏色（${value.trim()}），用設計系統的 var(--color-…)`);
            }
        }
    }
});

test('F1.5 [hidden] { display: none !important } 在全域 CSS（坑 2）', () => {
    const hit = outCss().some(({ text }) => cssRules(text).some((rule) =>
        rule.selectors.split(',').map((s) => s.trim()).includes('[hidden]') && /display\s*:\s*none\s*!\s*important/.test(rule.body)));
    assert.ok(hit, 'build 出來的 CSS 沒有「[hidden] { display: none !important }」：自己寫的 display 會蓋掉 hidden（坑 2）');
});

function badTracks(value) {
    // 拆最外層的軌道（括號裡的空白不拆），repeat(n, X) 看 X
    const tracks = [];
    let depth = 0;
    let cur = '';
    for (const ch of value.trim()) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (/\s/.test(ch) && depth === 0) {
            if (cur) tracks.push(cur);
            cur = '';
        } else cur += ch;
    }
    if (cur) tracks.push(cur);
    const bad = [];
    for (const track of tracks) {
        const rep = /^repeat\(\s*[^,]+,\s*(.+)\)$/i.exec(track);
        if (rep) {
            bad.push(...badTracks(rep[1]));
            continue;
        }
        if (/^\[.*\]$/.test(track)) continue; // 線的名字
        if (/^minmax\(\s*0(px|rem|em|%)?\s*,/i.test(track)) continue;
        if (/^(auto|min-content|max-content)$/i.test(track) || /fr$/i.test(track) || /^fit-content\(/i.test(track) || /^minmax\(/i.test(track)) bad.push(track);
    }
    return bad;
}

test('F1.5 坑 9：有 nowrap 的 CSS 檔，grid 的欄要是 minmax(0, …)', () => {
    const files = siteCss();
    assert.ok(files.length > 0, 'app/、components/ 底下沒有網站自己的 CSS？（全域樣式、CSS Modules）—— 沒有檔就量不到');
    for (const { rel, text } of files) {
        const rules = cssRules(text);
        if (!rules.some((r) => /white-space\s*:\s*nowrap/.test(r.body))) continue;
        for (const rule of rules) {
            const value = prop(rule.body, 'grid-template-columns');
            if (!value) continue;
            const bad = badTracks(value);
            assert.deepEqual(bad, [], `${rel}：${rule.selectors} 的 grid-template-columns: ${value} —— 這支檔有 nowrap 的字，欄要寫成 minmax(0, 1fr)，不然英文、日文會把整欄撐寬（坑 9）`);
        }
    }
});

// 四頁（三語頁、404）剛好一條、「/」零條。React 19 會把 JSX 畫的 <link rel="preload"> 另外提一份到 <head> 最前面，變成兩條一模一樣的 ——
// 所以前端改用 react-dom 的 preload()（2409966）；「剛好一條」守著別再改回去（重複下載另由 fonts-browser.test.js 在瀏覽器裡量）
const PRELOAD_PAGES = { zh: 'zh/index.html', en: 'en/index.html', ja: 'ja/index.html', 404: '404.html', root: 'index.html' };

test('F1.5 三語頁與 404 剛好一條預載首屏的拉丁字型（<link rel="preload" as="font" crossorigin>），「/」零條', () => {
    const bad = [];
    for (const [page, rel] of Object.entries(PRELOAD_PAGES)) {
        const html = readOut(rel);
        const head = html.slice(0, Math.max(0, html.search(/<\/head>/i)));
        const links = tagAttrs(head, 'link').filter((a) => (a.rel ?? '').split(/\s+/).includes('preload') && /\/fonts\/GoogleSansFlex-site\.woff2$/.test(a.href ?? ''));
        const want = page === 'root' ? 0 : 1;
        if (links.length !== want) bad.push(`${page}：<head> 預載 GoogleSansFlex-site.woff2 的 <link> 要剛好 ${want} 條，得到 ${links.length}${page === 'root' ? '（「/」有 JS 時一開頁就跳走，不預載）' : ''}`);
        for (const link of links) {
            if (link.href !== '/fonts/GoogleSansFlex-site.woff2') bad.push(`${page}：預載字型的 href 要從根目錄算（/fonts/GoogleSansFlex-site.woff2），得到 ${link.href}`);
            if (link.as !== 'font') bad.push(`${page}：預載字型要寫 as="font"，得到 ${link.as}`);
            if (!('crossorigin' in link)) bad.push(`${page}：預載字型要有 crossorigin（字型一律用 CORS 模式抓，沒有它會下載兩次）`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F1.5 回退字型同寬：有一個 local() 的 @font-face 寫了 size-adjust', () => {
    const hit = outCss().some(({ text }) => fontFaces(text).some((body) => /\bsrc\s*:[^;]*local\(/i.test(body) && /\bsize-adjust\s*:/i.test(body)));
    assert.ok(hit, 'build 出來的 CSS 沒有「src: local(…) ＋ size-adjust」的回退字型：字型換上來時字寬會變、按鈕會跳（設計審查量到日文 1440 的 CLS 0.039）');
});
