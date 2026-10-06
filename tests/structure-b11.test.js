// 4-b11 的 B11.3（文件）與 B11.4（結構）。只看檔案，不執行模組。介面細則見 tests/README.md「4-b11」。
//
// 量什麼：
//   B11.3 不認得的類型詞的舉例：lib/changelog.js 的檔頭、網站 README.md 講 raw 的那一段，講「不認得／不是已知」的那幾句
//         要舉真的不認得的詞「雜項」「Misc」，不能再拿「拿掉」「Removed」當例子（那兩個在已知類型詞清單裡）。
//         已知類型詞清單照設計稿 strings/README.md「更新紀錄的類型標記」（中文 12 個、英文 10 個，抄在下面 KNOWN；測試量個數，防抄漏）。
//   B11.3 日文、英文短引號的規則：lib/bind-tail.js 的檔頭與網站 README.md「孤字綁定」那一節，要有一句同時寫到「短引號」「日文」「英文」與 nw（或 <span class="nw">）。
//   B11.4 package.json 的套件只在白名單（helpers.js 有 assertPackageWhitelist 就用它；沒有的話 —— 後端分支 —— 就是不准有 dependencies、devDependencies）。
//   B11.4 這一段新加的測試第一行寫到 4-b11 或 B11、不往 homepage/site/ 外面讀。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B11.3|B11.4"
//   node --test tests/structure-b11.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as helpers from './helpers.js';

const { SITE } = helpers;
const TESTS = ['tests/bind-tail-quote.test.js', 'tests/structure-b11.test.js'];

// 設計稿 strings/README.md「更新紀錄的類型標記」的清單（2026-10-03 抄的；改清單時兩邊一起改）
const KNOWN = {
    zh: ['修好', '修正', '新增', '改善', '改進', '調整', '變更', '拿掉', '移除', '更新', '安全性', '效能'],
    en: ['Fixed', 'Fix', 'New', 'Added', 'Improved', 'Changed', 'Removed', 'Updated', 'Security', 'Performance'],
};

function read(rel) {
    return fs.readFileSync(path.join(SITE, rel), 'utf8');
}

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// 把一段文字切成句子（句號、換行之後的「- 」條目、空行都算分開）；JSDoc 先去掉每行開頭的「 * 」
function sentences(text) {
    return text.replace(/^\s*\*\s?/gm, '').split(/。|\n\s*\n|\n(?=\s*- )/).map((s) => s.replace(/\s+/g, ' '));
}

function headerDocs(rel) {
    const text = read(rel);
    const first = text.search(/^(?:const|import|export)\s/m);
    return text.slice(0, first);
}

function readmeSection(pattern, label) {
    const readme = read('README.md');
    const at = readme.search(pattern);
    assert.ok(at >= 0, `README.md 要有 ${label}`);
    const next = readme.indexOf('\n## ', at + 1);
    return readme.slice(at, next < 0 ? undefined : next);
}

function checkUnknownExamples(text, where) {
    const about = sentences(text).filter((s) => /不認得|不是已知|不在清單/.test(s));
    assert.ok(about.length > 0, `${where}：要有一句講到不認得（不是已知）的類型詞`);
    const joined = about.join('\n');
    assert.ok(joined.includes('雜項') && joined.includes('Misc'), `${where}：講不認得的類型詞那句要舉「雜項」「Misc」當例子，得到：${joined}`);
    for (const word of ['拿掉', 'Removed']) {
        assert.ok(!joined.includes(`「${word}」`), `${where}：「${word}」在已知類型詞清單裡，不能當不認得的例子：${joined}`);
    }
}

test('B11.3 已知類型詞清單：中文 12 個、英文 10 個（照設計稿 strings/README）；「雜項」「Misc」不在清單裡', () => {
    assert.equal(KNOWN.zh.length, 12);
    assert.equal(KNOWN.en.length, 10);
    assert.ok(!KNOWN.zh.includes('雜項') && !KNOWN.en.map((w) => w.toLowerCase()).includes('misc'));
    assert.ok(KNOWN.zh.includes('拿掉') && KNOWN.en.includes('Removed'), '拿掉、Removed 是已知類型詞（所以不能當不認得的例子）');
    const site = read('strings/README.md');
    if (site.includes('更新紀錄的類型標記')) {
        for (const word of [...KNOWN.zh, ...KNOWN.en]) assert.ok(site.includes(word), `strings/README.md 的清單要有「${word}」`);
    }
});

test('B11.3 lib/changelog.js 檔頭：不認得的類型詞舉「雜項」「Misc」，不拿「拿掉」「Removed」當例子', () => {
    checkUnknownExamples(headerDocs('lib/changelog.js'), 'lib/changelog.js 檔頭');
});

test('B11.3 網站 README.md 講 raw 的那一段：不認得的類型詞舉「雜項」「Misc」，不拿「拿掉」「Removed」當例子', () => {
    const readme = read('README.md');
    const paragraph = readme.split(/\n\s*\n/).find((p) => p.includes('raw') && /不認得|不是已知|不在清單/.test(p));
    assert.ok(paragraph, 'README.md 要有一段講更新紀錄的 raw 與不認得的類型詞');
    checkUnknownExamples(paragraph, 'README.md 講 raw 的那一段');
});

function checkQuoteRule(text, where) {
    const hit = sentences(text).find((s) => s.includes('短引號') && s.includes('日文') && s.includes('英文') && /nw/.test(s));
    assert.ok(hit, `${where}：要有一句同時寫到「短引號」「日文」「英文」與 nw（日文、英文的短引號整個包成 <span class="nw">）`);
}

test('B11.3 lib/bind-tail.js 檔頭：寫到日文、英文的短引號整個包成 nw', () => {
    checkQuoteRule(headerDocs('lib/bind-tail.js'), 'lib/bind-tail.js 檔頭');
});

test('B11.3 網站 README.md「孤字綁定」那一節：寫到日文、英文的短引號整個包成 nw', () => {
    checkQuoteRule(readmeSection(/^##\s.*孤字綁定/m, '「孤字綁定」那一節'), 'README.md「孤字綁定」那一節');
});

test('B11.4 結構：package.json 的套件只在白名單', () => {
    const pkg = JSON.parse(read('package.json'));
    if (typeof helpers.assertPackageWhitelist === 'function') {
        helpers.assertPackageWhitelist(pkg);
    } else {
        assert.equal(pkg.dependencies, undefined, '後端分支：package.json 不准有 dependencies');
        assert.equal(pkg.devDependencies, undefined, '後端分支：package.json 不准有 devDependencies');
    }
});

test('B11.4 結構：這一段新加的測試檔頭有說明、不往 homepage/site/ 外面讀', () => {
    const outside = [/\bdesign\//, /\brelease\//, /\btutorial\//, /\bclipper\//, /GPTPlugins/, /\/Users\//, /\.\.\/\.\./, /\.\.\\\.\./, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/];
    for (const rel of TESTS) {
        const text = read(rel);
        assert.ok(text.startsWith('//'), `${rel}：第一行要是 // 說明`);
        assert.match(text.split('\n')[0], /4-b11|B11/, `${rel}：第一行要寫到 4-b11 或 B11`);
        if (rel.endsWith('structure-b11.test.js')) continue;
        const src = code(text);
        for (const re of outside) {
            const hit = src.match(re);
            assert.equal(hit, null, `${rel} 有往 homepage/site/ 外面走的路徑「${hit && hit[0]}」`);
        }
    }
});
