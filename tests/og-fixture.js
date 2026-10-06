// 4-b14（分享卡圖 npm run og、圖示驗收）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。介面細則見 tests/README.md「4-b14」。
//
// LANGS                 三種語言；分享卡圖一個語言一張 og-<語言>.png（「/」用英文那張，不另做）
// OG_NAMES              ['og-zh.png', 'og-en.png', 'og-ja.png']
// MAX_BYTES             一張分享卡圖的上限 300 KB（理由在 tests/README.md「4-b14」）
// runOg(args, env)      跑 scripts/og.mjs（runScript；SITE_PLAYWRIGHT 預設拿掉，要瀏覽器的測試自己用 --playwright 給）
// playwrightDir()       環境變數 SITE_PLAYWRIGHT；沒設回 null（要瀏覽器的測試就 skip）
// readPng(file|Buffer)  測試自己讀 PNG：{ width, height, colorType, rgba }（rgba 是每個像素 4 個位元組；沒有 alpha 的格式補 255）。
//                       只認 8 位元、不交錯、色彩型態 2（RGB）與 6（RGBA）；別的丟 Error（講是哪一種）。不靠被測的程式。
// pngSize(file)         只讀檔頭（IHDR）的寬高：{ width, height }；不是 PNG 丟 Error
// blankProblem(img)     「不是空白圖」：至少 16 種顏色、跟左上角顏色不同的像素至少 2%；回傳問題（字串）或 null
// diffRatio(a, b)       兩張同尺寸圖、RGBA 有任何一個通道不同的像素比例（0～1）
// ogRoot(t, breaks)     在暫存資料夾做一個假的專案根目錄，照真的設計稿的放法：
//                         design/homepage/og/{zh,en,ja}/index.html（連 ../../../../clipper/css/fonts.css 與 ../../og.css，跟真的稿一樣多四層）
//                         design/homepage/og.css（1200×630，三語各自的字型堆疊，照設計稿 og.css 寫死的家族）
//                         clipper/css/fonts.css ＋ clipper/fonts/GoogleSansFlex-site.woff2（public/fonts 的複本）
//                       breaks 是要放進去的壞法（陣列）：
//                         'missing-ja'      拿掉 og/ja/index.html
//                         'font-file'       拿掉字型檔（fonts.css 照樣連它：載不到）
//                         'font-family-en'  英文的字型堆疊改成 "Nope Sans 404", sans-serif（指定的字型這台沒有）
//                         'css-404-zh'      中文頁多連一個不存在的 CSS（console 會有載入失敗）
//                         'script-error-ja' 日文頁連一支會丟例外的外部 .js（頁面錯誤）
//                         'overflow-zh'     中文大標重複六次：字往下撐破 630（scrollHeight 超出）
//                         'overflow-en'     英文大標接一個 60 個字母、不能斷的字：往右撐破 1200（scrollWidth 超出）
//                         'overflow-ja'     日文那一行不換行、重複三次：往右撐破 1200
//                       回傳根目錄的真實路徑（路徑裡有空白與中文）。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SITE } from './helpers.js';
import { runScript, tmp } from './b6-fixture.js';

export { tmp };

export const LANGS = ['zh', 'en', 'ja'];
export const OG_NAMES = LANGS.map((lang) => `og-${lang}.png`);
export const MAX_BYTES = 300 * 1024;

export function runOg(args, env = {}, opts = {}) {
    return runScript('og.mjs', args, { ...opts, env: { SITE_PLAYWRIGHT: undefined, ...env } });
}

export function playwrightDir() {
    return process.env.SITE_PLAYWRIGHT || null;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunks(buf) {
    if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('不是 PNG（檔頭不對）');
    const out = [];
    let at = 8;
    while (at + 8 <= buf.length) {
        const len = buf.readUInt32BE(at);
        const type = buf.toString('latin1', at + 4, at + 8);
        out.push({ type, data: buf.subarray(at + 8, at + 8 + len) });
        at += 12 + len;
        if (type === 'IEND') break;
    }
    return out;
}

export function pngSize(file) {
    const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
    const ihdr = chunks(buf)[0];
    if (!ihdr || ihdr.type !== 'IHDR') throw new Error('PNG 第一個區塊不是 IHDR');
    return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4) };
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

export function readPng(file) {
    const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
    const list = chunks(buf);
    const ihdr = list[0].data;
    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    const depth = ihdr[8];
    const colorType = ihdr[9];
    const interlace = ihdr[12];
    if (depth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
        throw new Error(`測試的 PNG 讀法只認 8 位元、不交錯、RGB 或 RGBA；這張是 ${depth} 位元、色彩型態 ${colorType}、交錯 ${interlace}`);
    }
    const bpp = colorType === 6 ? 4 : 3;
    const raw = zlib.inflateSync(Buffer.concat(list.filter((c) => c.type === 'IDAT').map((c) => c.data)));
    const stride = width * bpp;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y += 1) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        for (let x = 0; x < stride; x += 1) {
            const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
            const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
            const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0;
            const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
            if (pred === undefined) throw new Error(`PNG 第 ${y} 列的過濾器 ${filter} 不認得`);
            pixels[y * stride + x] = (line[x] + pred) & 0xff;
        }
    }
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
        rgba[i * 4] = pixels[i * bpp];
        rgba[i * 4 + 1] = pixels[i * bpp + 1];
        rgba[i * 4 + 2] = pixels[i * bpp + 2];
        rgba[i * 4 + 3] = bpp === 4 ? pixels[i * bpp + 3] : 255;
    }
    return { width, height, colorType, rgba };
}

export function blankProblem(img) {
    const total = img.width * img.height;
    const colors = new Set();
    const first = img.rgba.readUInt32BE(0);
    let other = 0;
    for (let i = 0; i < total; i += 1) {
        const px = img.rgba.readUInt32BE(i * 4);
        if (colors.size < 1000) colors.add(px);
        if (px !== first) other += 1;
    }
    if (colors.size < 16) return `只有 ${colors.size} 種顏色（要至少 16 種：字與記號的邊緣會有很多種）`;
    if (other / total < 0.02) return `跟左上角顏色不同的像素只有 ${(other / total * 100).toFixed(2)}%（要至少 2%）`;
    return null;
}

export function diffRatio(a, b) {
    if (a.width !== b.width || a.height !== b.height) return 1;
    let diff = 0;
    for (let i = 0; i < a.width * a.height; i += 1) {
        if (a.rgba.readUInt32BE(i * 4) !== b.rgba.readUInt32BE(i * 4)) diff += 1;
    }
    return diff / (a.width * a.height);
}

const TEXT = {
    zh: { lang: 'zh-Hant', brand: '靈感收集器', title: '把網頁收成 AI 讀得懂的素材庫', line: '給 AI 讀的網頁剪藏 · 免費的 Chrome 擴充' },
    en: { lang: 'en', brand: 'Inspiration Collector', title: 'Turn the web into material your AI can read', line: 'Web clipper for AI agents · Free Chrome extension' },
    ja: { lang: 'ja', brand: 'インスピレーション・コレクター', title: 'ウェブで見つけたものを、AI が読める素材ライブラリに', line: 'AI 向けウェブクリッパー · 無料の Chrome 拡張機能' },
};

const STACKS = {
    zh: '"Google Sans Flex", "PingFang TC", sans-serif',
    en: '"Google Sans Flex", sans-serif',
    ja: '"Google Sans Flex", "Hiragino Sans", sans-serif',
};

export function ogRoot(t, breaks = []) {
    const root = path.join(tmp(t, 'site-og-'), '假的 專案');
    const og = path.join(root, 'design', 'homepage', 'og');
    const css = path.join(root, 'clipper', 'css');
    const fonts = path.join(root, 'clipper', 'fonts');
    fs.mkdirSync(css, { recursive: true });
    fs.mkdirSync(fonts, { recursive: true });
    if (!breaks.includes('font-file')) fs.copyFileSync(path.join(SITE, 'public', 'fonts', 'GoogleSansFlex-site.woff2'), path.join(fonts, 'GoogleSansFlex-site.woff2'));
    fs.writeFileSync(path.join(css, 'fonts.css'), `@font-face {
  font-family: "Google Sans Flex";
  src: url("../fonts/GoogleSansFlex-site.woff2") format("woff2");
  font-weight: 300 700;
  font-display: block;
  unicode-range: U+0020-007E, U+00B7;
}
`);
    const stacks = { ...STACKS };
    if (breaks.includes('font-family-en')) stacks.en = '"Nope Sans 404", sans-serif';
    fs.mkdirSync(og, { recursive: true });
    fs.writeFileSync(path.join(root, 'design', 'homepage', 'og.css'), `html, body { margin: 0; }
:root:lang(zh-Hant) body.og { font-family: ${stacks.zh}; }
:root:lang(en) body.og { font-family: ${stacks.en}; }
:root:lang(ja) body.og { font-family: ${stacks.ja}; }
body.og { width: 1200px; height: 630px; overflow: hidden; background: #1b1d24; color: #fff; }
.og__card { box-sizing: border-box; width: 1200px; height: 630px; padding: 72px; display: grid; grid-template-columns: minmax(0, 1fr) 224px; column-gap: 60px; align-items: center; }
.og__text p { margin: 0 0 40px; }
.og__brand { font-size: 32px; font-weight: 600; }
.og__title { font-size: 64px; font-weight: 600; line-height: 1.15; }
.og__line { font-size: 32px; color: #b1b2b9; }
.og__mark { width: 224px; height: 224px; border: 20px solid #e0ff98; box-sizing: border-box; border-radius: 12px; }
`);
    fs.writeFileSync(path.join(root, 'design', 'homepage', 'boom.js'), "throw new Error('boom from fixture');\n");
    for (const lang of LANGS) {
        if (lang === 'ja' && breaks.includes('missing-ja')) continue;
        const text = { ...TEXT[lang] };
        // 字撐破版面：中文大標重複六次（往下超出 630）、英文大標接一個 60 個字母不能斷的字（往右超出 1200）、日文那一行不換行再重複三次（往右超出）
        if (lang === 'zh' && breaks.includes('overflow-zh')) text.title = Array(6).fill(text.title).join(' ');
        if (lang === 'en' && breaks.includes('overflow-en')) text.title = `${text.title} ${'Inspirationcollector'.repeat(3)}`;
        if (lang === 'ja' && breaks.includes('overflow-ja')) text.line = `<span style="white-space: nowrap">${Array(3).fill(text.line).join(' ')}</span>`;
        const extra = [];
        if (lang === 'zh' && breaks.includes('css-404-zh')) extra.push('<link rel="stylesheet" href="../../nope.css">');
        if (lang === 'ja' && breaks.includes('script-error-ja')) extra.push('<script src="../../boom.js"></script>');
        fs.mkdirSync(path.join(og, lang), { recursive: true });
        fs.writeFileSync(path.join(og, lang, 'index.html'), `<!doctype html>
<html lang="${text.lang}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1200">
<title>og:image · ${lang}</title>
<link rel="stylesheet" href="../../../../clipper/css/fonts.css">
<link rel="stylesheet" href="../../og.css">
${extra.join('\n')}
</head>
<body class="og">
<main class="og__card">
    <div class="og__text">
        <p class="og__brand">${text.brand}</p>
        <p class="og__title">${text.title}</p>
        <p class="og__line">${text.line}</p>
    </div>
    <div class="og__mark"></div>
</main>
</body>
</html>
`);
    }
    return fs.realpathSync(root);
}

// stdout 裡「og-<語言> 字型：A、B」那一行的家族清單（照印出來的順序）；沒有那一行回 null
export function printedFonts(stdout, lang) {
    const row = stdout.split(/\r?\n/).find((line) => line.startsWith(`og-${lang} 字型：`));
    if (!row) return null;
    return row.slice(`og-${lang} 字型：`.length).split('、').map((name) => name.trim()).filter(Boolean);
}
