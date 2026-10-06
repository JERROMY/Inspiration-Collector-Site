// 4-b3 的結構（素材處理）。只看檔案，不執行模組。
//
// 量什麼：
//   B3.3 lib/media.js、lib/media-run.js 都在；第一個 export 之前有 JSDoc（/** … */），檔裡寫了 @param 與 @returns；
//        只 import node: 內建與相對路徑、不用 require。lib/media-run.js 匯出 runMedia。
//        scripts/media.mjs 薄薄一層（只讀參數、組成 run、呼叫 runMedia、印結果）：
//          只 import node: 內建與 ../lib/media-run.js；呼叫 runMedia；
//          自己不解析、不驗證、不搬檔：不呼叫也不定義 parseFfmpegInfo／readImageSize／planMedia／ffmpegArgs／cwebpArgs／buildMediaJson，
//          程式裡沒有 Duration、Audio、RIFF、WEBP、IHDR 這些字，沒有 \d 的正規表示式，不用 rename／copyFile／mkdtemp／rm／writeFile。
//        scripts/media.mjs 的檔頭註解（第一個 import 之前）寫清楚：環境變數 FFMPEG、CWEBP 怎麼設，為什麼不用 ffprobe，
//          為什麼影片不重新編碼（只拿掉音軌），輸出多大、git 增加多少（寫到 MB）。
//        package.json 有 "media": "node scripts/media.mjs"（npm run media）；套件只在白名單（4-f1 的 F1.7 改的，見 helpers.js 的 assertPackageWhitelist）。
//        假工具在 tests/fixtures/fake-tools/（測試與 fixture 分開）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B3.3 結構"
//   node --test tests/structure-b3.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const LIB = path.join(SITE, 'lib');
const CLI = path.join(SITE, 'scripts', 'media.mjs');
const MODULES = ['media.js', 'media-run.js'];
const LIB_FUNCS = ['parseFfmpegInfo', 'readImageSize', 'planMedia', 'ffmpegArgs', 'cwebpArgs', 'buildMediaJson'];

// 去掉註解，免得註解裡寫到的東西被當成真的
function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function specifiers(text) {
    const src = code(text);
    const found = [];
    for (const re of [/\bimport\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\bexport\s[^'"]*?from\s*['"]([^'"]+)['"]/g]) {
        for (const m of src.matchAll(re)) found.push(m[1]);
    }
    return found;
}

function read(file, label) {
    if (!fs.existsSync(file)) assert.fail(`缺 ${label}（後端之後實作）`);
    return fs.readFileSync(file, 'utf8');
}

test('B3.3 結構：lib/media.js、lib/media-run.js 都在，檔頭用 JSDoc 寫收什麼、給什麼', () => {
    for (const name of MODULES) {
        const text = read(path.join(LIB, name), `lib/${name}`);
        const firstExport = text.search(/^export\s/m);
        assert.ok(firstExport >= 0, `lib/${name} 沒有 export`);
        assert.ok(text.slice(0, firstExport).includes('/**'), `lib/${name}：第一個 export 之前要有 JSDoc（/** … */）`);
        assert.match(text, /@param\b/, `lib/${name}：JSDoc 要寫 @param（收什麼）`);
        assert.match(text, /@returns?\b/, `lib/${name}：JSDoc 要寫 @returns（給什麼）`);
    }
    assert.match(code(read(path.join(LIB, 'media-run.js'), 'lib/media-run.js')), /\bexport\s+(async\s+)?function\s+runMedia\b|\bexport\s*\{[^}]*\brunMedia\b/, 'lib/media-run.js 要匯出 runMedia');
});

test('B3.3 結構：lib/media.js、lib/media-run.js 只用 Node 內建與相對路徑', () => {
    for (const name of MODULES) {
        const text = read(path.join(LIB, name), `lib/${name}`);
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `lib/${name} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'), `lib/${name} import 了「${spec}」：只准 node: 內建與相對路徑`);
        }
    }
});

test('B3.3 結構：scripts/media.mjs 薄薄一層：只讀參數、組成 run、呼叫 runMedia、印結果', () => {
    const text = read(CLI, 'scripts/media.mjs');
    const src = code(text);
    const specs = specifiers(text);
    for (const spec of specs) {
        assert.ok(spec.startsWith('node:') || spec === '../lib/media-run.js', `scripts/media.mjs import 了「${spec}」：只准 node: 內建與 ../lib/media-run.js`);
    }
    assert.ok(specs.includes('../lib/media-run.js'), 'scripts/media.mjs 要 import ../lib/media-run.js');
    assert.match(src, /\brunMedia\s*\(/, '要呼叫 runMedia');
    for (const name of LIB_FUNCS) {
        assert.doesNotMatch(src, new RegExp(`\\b${name}\\b`), `scripts/media.mjs 不要碰 ${name}（那是 lib 的事）`);
    }
    assert.doesNotMatch(src, /\b(Duration|Audio|RIFF|WEBP|IHDR)\b/, 'scripts/media.mjs 不要自己解析影片或圖片');
    assert.doesNotMatch(src, /\\d/, 'scripts/media.mjs 不要自己解析（程式裡出現了 \\d）');
    assert.doesNotMatch(src, /\b(rename|renameSync|copyFile|copyFileSync|mkdtemp|mkdtempSync|rm|rmSync|writeFile|writeFileSync|cp|cpSync)\s*\(/,
        'scripts/media.mjs 不要自己寫檔、搬檔、開暫存（那是 runMedia 的事）');
});

test('B3.3 結構：scripts/media.mjs 的檔頭註解寫清楚工具怎麼設、為什麼不用 ffprobe、為什麼不重新編碼、輸出多大與 git 增量', () => {
    const text = read(CLI, 'scripts/media.mjs');
    const firstImport = text.search(/^import\s/m);
    assert.ok(firstImport > 0, 'scripts/media.mjs 要有 import，而且前面要有檔頭註解');
    const head = text.slice(0, firstImport);
    for (const [word, why] of [
        ['FFMPEG', '環境變數 FFMPEG 怎麼設'],
        ['CWEBP', '環境變數 CWEBP 怎麼設'],
        ['ffprobe', '為什麼不用 ffprobe'],
        ['音軌', '只拿掉音軌'],
        ['重新編碼', '為什麼不重新編碼'],
        ['MB', '輸出多大（MB）'],
        ['git', 'git 增加多少'],
        ['npm run media', '怎麼跑'],
    ]) {
        assert.ok(head.includes(word), `檔頭註解要寫到「${word}」（${why}）`);
    }
});

test('B3.3 結構：package.json 有 npm run media、套件只在白名單（F1.7）', () => {
    const pkg = JSON.parse(read(path.join(SITE, 'package.json'), 'package.json'));
    assert.equal(pkg.scripts && pkg.scripts.media, 'node scripts/media.mjs', 'package.json 的 scripts.media 要是 "node scripts/media.mjs"');
    assertPackageWhitelist(pkg);
});

test('B3.3 結構：假工具在 tests/fixtures/fake-tools/', () => {
    for (const name of ['ffmpeg.mjs', 'cwebp.mjs', 'images.js']) {
        assert.ok(fs.existsSync(path.join(SITE, 'tests', 'fixtures', 'fake-tools', name)), `tests/fixtures/fake-tools/${name} 不見了`);
    }
});
