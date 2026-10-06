// 4-b7（字串表：驗證設計師的 strings/*.json、parseSegments 把帶標記的字轉成元素樹）的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。
// 介面細則見 tests/README.md「4-b7」。標記的定義照設計師的字串表說明（design/homepage/strings/README.md，網站裡的複本是 strings/README.md）。
//
// toHtml(nodes)                 測試自己的序列化器：元素樹 → HTML 字串（文字跳脫 & < > "；class 先寫、其他屬性照字母序；wbr 不寫結束標籤）。不靠被測的程式。
// readmeHtml(text, values)      照設計師 README「轉換順序」那 8 步做字串取代，得到「稿裡的 HTML」—— 用來證明 parseSegments 的結果跟它同構。
//                               README 的取代不跳脫；這裡先把字（與代入值）的 & < > " 跳脫再取代，才跟 toHtml 比得起來（真的字裡有 "）。
// checkTree(nodes, label)       元素樹的形狀：陣列；每個節點是非空字串，或剛好 { type, props, children } 三欄的物件；相鄰兩個字串要併成一個。
// el(className, children)       組預期的節點：{ type: 'span', props: { className }, children }；WBR、BRK_L、BRK_R、BRK_NARROW 是固定的節點。
// TABLES / COPY_MD / DESIGN_README   一份好的字串表（真的資料挑出來的 10 個 id，含每一種標記）、對得上的 copy.md、字串表說明的假複本。
// writeStrings(dir, tables, opts)    把 tables 寫成 <dir>/<語言>.json（JSON.stringify(…, null, 2) + '\n'，跟設計師的 build.mjs 一樣），預設也寫 README.md。
// runScript / usageError / tmp / snapshot / stamp   沿用 b6-fixture.js。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runScript, usageError, tmp, snapshot, stamp } from './b6-fixture.js';

export { runScript, usageError, tmp, snapshot, stamp };

export const LANGS = ['zh', 'en', 'ja'];
export const LANG_WORD = { zh: /\bzh\b|中文/, en: /\ben\b|英文/, ja: /\bja\b|日文/ };

export const el = (className, children = []) => ({ type: 'span', props: { className }, children });
export const WBR = { type: 'wbr', props: {}, children: [] };
export const BRK_L = { type: 'span', props: { className: 'brk brk--l', 'aria-hidden': 'true' }, children: [] };
export const BRK_R = { type: 'span', props: { className: 'brk brk--r', 'aria-hidden': 'true' }, children: [] };
export const BRK_NARROW = { type: 'span', props: { className: 'brk-narrow' }, children: [] };

const CLASSES = new Set(['u', 'nw', 'clamp', 'nw-wide', 'brk brk--l', 'brk brk--r', 'brk-narrow', 'forai__l1', 'forai__l2']);

function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function toHtml(nodes) {
    return nodes.map((node) => {
        if (typeof node === 'string') return escapeText(node);
        const { className, ...rest } = node.props;
        const attrs = [
            ...(className === undefined ? [] : [`class="${escapeText(className)}"`]),
            ...Object.keys(rest).sort().map((key) => `${key}="${escapeText(String(rest[key]))}"`),
        ];
        const open = `<${node.type}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
        return node.type === 'wbr' ? open : `${open}${toHtml(node.children)}</${node.type}>`;
    }).join('');
}

// 設計師 README「轉換順序」：1 ⟦⟧ → 2 ⟨⟩ → 3 ⁅⁆¦ → 4 «» → 5 {…} → 6 | ；7 ↵ 先切兩段、各自轉、放進兩個 span（↵ 前面的空白留在兩個 span 之間）；8 代入值最後換
export function readmeHtml(text, values) {
    const convert = (s) => s
        .replace(/⟦/g, '<span class="brk brk--l" aria-hidden="true"></span>').replace(/⟧/g, '<span class="brk brk--r" aria-hidden="true"></span>')
        .replace(/⟨/g, '<span class="clamp">').replace(/⟩/g, '</span>')
        .replace(/⁅/g, '<span class="nw-wide">').replace(/⁆/g, '</span>').replace(/¦/g, '<span class="brk-narrow"></span>')
        .replace(/«/g, '<span class="u">').replace(/»/g, '</span>')
        .replace(/\{([^{}]*)\}/g, '<span class="nw">$1</span>').replace(/\|/g, '<wbr>');
    text = escapeText(text);
    let html;
    const at = text.indexOf('↵');
    if (at < 0) {
        html = convert(text);
    } else {
        const left = text.slice(0, at);
        const space = /\s*$/.exec(left)[0];
        html = `<span class="forai__l1">${convert(left.slice(0, left.length - space.length))}</span>${space}<span class="forai__l2">${convert(text.slice(at + 1))}</span>`;
    }
    if (values) html = html.replace(/%(url|nn|章名)%/g, (all, name) => escapeText(values[name]));
    return html;
}

export function checkTree(nodes, label) {
    assert.ok(Array.isArray(nodes), `${label}：要回傳陣列，得到 ${JSON.stringify(nodes)}`);
    nodes.forEach((node, i) => {
        if (typeof node === 'string') {
            assert.notEqual(node, '', `${label}：不能有空字串的節點`);
            assert.ok(typeof nodes[i + 1] !== 'string', `${label}：相鄰的兩段字要併成一個字串，得到 ${JSON.stringify(nodes.slice(i, i + 2))}`);
            return;
        }
        assert.ok(node && typeof node === 'object' && !Array.isArray(node), `${label}：節點要是字串或物件，得到 ${JSON.stringify(node)}`);
        assert.deepEqual(Object.keys(node).sort(), ['children', 'props', 'type'], `${label}：節點剛好 type、props、children 三欄，得到 ${JSON.stringify(node)}`);
        assert.ok(['span', 'wbr'].includes(node.type), `${label}：type 只有 span 與 wbr，得到 ${JSON.stringify(node.type)}`);
        assert.ok(node.props && typeof node.props === 'object' && !Array.isArray(node.props), `${label}：props 要是物件`);
        assert.ok(Array.isArray(node.children), `${label}：children 要是陣列`);
        if (node.type === 'wbr') {
            assert.deepEqual(node, WBR, `${label}：wbr 是 { type: 'wbr', props: {}, children: [] }`);
            return;
        }
        assert.ok(CLASSES.has(node.props.className), `${label}：className 只有 ${[...CLASSES].join('、')}，得到 ${JSON.stringify(node.props.className)}`);
        const keys = Object.keys(node.props).sort();
        const brk = node.props.className.startsWith('brk ');
        assert.deepEqual(keys, brk ? ['aria-hidden', 'className'] : ['className'], `${label}：${node.props.className} 的 props 只有 ${brk ? "className 與 'aria-hidden'" : 'className'}，得到 ${JSON.stringify(node.props)}`);
        if (brk) assert.equal(node.props['aria-hidden'], 'true', `${label}：括號的 'aria-hidden' 是字串 'true'`);
        if (brk || node.props.className === 'brk-narrow') assert.deepEqual(node.children, [], `${label}：${node.props.className} 是空的 span`);
        checkTree(node.children, label);
    });
}

// 真的字串表挑出來的 10 個 id（設計師 2026-10-02 的版本）：沒有標記、«» 一層到三層、{}、|（含最外層的）、⟨⟩ 夾 ⟦⟧、⁅¦⁆、↵（中文沒空白、英文有空白）、%nn%、%章名%、%url%
const ROWS = {
    'nav.brand': ['靈感收集器', 'Inspiration Collector', 'インスピレーション・コレクター'],
    'hero.title': ['{把網頁收成} ⟨{⟦AI 讀得懂的}|{素材庫⟧}⟩', 'Turn the web into ⟨{⟦material} your AI {can read⟧}⟩', 'ウェブで見つけたものを、⟨{⟦AI} が読める⁅素材¦{ライブラリに⟧}⁆⟩'],
    'where.label': ['可以在|這些地方用', 'Works on', '使える場所'],
    'forai.title': ['«存檔工具的|{讀者是人。}»↵«這個的|{讀者是 ⟨⟦AI⟧⟩。}»', '«Web clippers are written» «for {human readers.}» ↵«This one is written» «for {an ⟨⟦AI⟧⟩.}»', '«{保存ツールは、}»«読み手が|{人間です。}»↵«これは|読み手が {⟨⟦AI⟧⟩ です。}»'],
    'privacy.lead': ['««作者收不到|{你的任何資料，}»«因為根本沒有|{地方可以收。}»»', '««The author cannot receive {your data,}» «because there is nowhere {for it to go.}»»', '««作者があなたのデータを»«受け取ることはできません。»»«受け取る場所が存在しないからです。»'],
    'features.more': ['{看教學 %nn%}', '{Watch chapter %nn%}', '{%nn% 章を見る}'],
    'tutorial.done': ['«「%章名%」»«{看完了}»', '«Finished “%章名%”»', '«「%章名%」を»«{見終わりました}»'],
    'mail.self.body': ['在電腦的 Chrome 打開這個網址，就能免費加到 Chrome：%url%', 'Open this link in Chrome on your computer to add it for free: %url%', 'パソコンの Chrome でこの URL を開くと、無料で追加できます：%url%'],
    'req.lang': ['««繁體中文、|English、|{日本語}»«{（自動挑選，}|{其他語言顯示英文）}»»', '««Traditional Chinese,» «English, Japanese» «(chosen automatically;» «any other language {shows English)}»»', '««繁体字中国語・英語・日本語»««（自動で選択、»«その他の言語は英語で表示）»»»'],
    'hero.meta.os': ['支援 Windows、Mac 桌機版', 'Desktop Chrome on Windows {and Mac}', 'Windows・Mac の{デスクトップ版に対応}'],
};

export const IDS = Object.keys(ROWS);

export function tables() {
    return Object.fromEntries(LANGS.map((lang, n) => [lang, Object.fromEntries(IDS.map((id) => [id, ROWS[id][n]]))]));
}

const plain = (s) => s.replace(/[«»⟨⟩⟦⟧⁅⁆¦↵|]/g, '').replace(/\{([^{}]*)\}/g, '$1').replace(/%(url|nn|章名)%/g, '{$1}');
const copyRow = (id) => `| ${id} | ${ROWS[id].map(plain).join(' | ')} | 測試用 | 測試用 |`;

// 跟真的 copy.md 一樣的形狀：說明文字、兩張「| id | zh | en | ja | 來源 | 確認 |」的文案表；另外兩張不是文案表 ——
// 表頭不同的版本表（第一格 1.0.5 長得像 id），與「| id | zh | en | ja | 為什麼要注意 |」的字數表（id 用 ` 包著，有一個字串表沒有的 not.in.strings）
export const COPY_MD = [
    '# 首頁三語文案表（測試用）',
    '',
    '- `{url}`、`{nn}` 是要換成真的值的地方。',
    '',
    '## 01',
    '',
    '| id | zh | en | ja | 來源 | 確認 |',
    '|---|---|---|---|---|---|',
    ...IDS.slice(0, 5).map(copyRow),
    '',
    '## 02',
    '',
    '| id | zh | en | ja | 來源 | 確認 |',
    '|---|---|---|---|---|---|',
    ...IDS.slice(5).map(copyRow),
    '',
    '## 版本',
    '',
    '| 版本 | 用在哪裡 | 依據 |',
    '|---|---|---|',
    '| 1.0.5 | bulletin、news.1 | SPEC §5-02 |',
    '',
    '## 會放不下的字',
    '',
    '| id | zh | en | ja | 為什麼要注意 |',
    '|---|---|---|---|---|',
    '| `nav.brand` | 靈感收集器（5 字） | Inspiration Collector（21 字） | インスピレーション・コレクター（15 字） | 日文品牌名最長 |',
    '| `not.in.strings` | 甲 | A | あ | 不是文案表，不算 id |',
    '',
].join('\n');

export const DESIGN_README = '# 首頁字串表（帶斷行標記）\n\n測試用的假複本：標記的定義見設計師的字串表說明。\n';

export function writeStrings(dir, data, { readme = true } = {}) {
    fs.mkdirSync(dir, { recursive: true });
    for (const [lang, table] of Object.entries(data)) {
        fs.writeFileSync(path.join(dir, `${lang}.json`), typeof table === 'string' ? table : JSON.stringify(table, null, 2) + '\n');
    }
    if (readme) fs.writeFileSync(path.join(dir, 'README.md'), DESIGN_README);
    return dir;
}

// 一行一行看 stderr：有一行同時有 words 裡的每一個（字串用 includes、正規表示式用 test）
export function lineWith(stderr, words, label) {
    const rows = stderr.split(/\r?\n/);
    const hit = rows.find((row) => words.every((w) => (typeof w === 'string' ? row.includes(w) : w.test(row))));
    assert.ok(hit, `${label}：stderr 要有一行同時寫到 ${words.map(String).join('、')}；stderr：\n${stderr}`);
    return hit;
}

// 出錯的共同檢查：結束碼 1、stderr 第一行是中文、沒有堆疊（不丟難懂的例外）
export function failed(res, label) {
    assert.equal(res.status, 1, `${label}：結束碼要是 1，得到 ${res.status}；stdout：${res.stdout}；stderr：${res.stderr}`);
    const first = res.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `${label}：stderr 第一行要是中文，得到：${first}`);
    assert.doesNotMatch(res.stderr, /^\s+at .+[:(]\d+:\d+\)?\s*$/m, `${label}：stderr 不能有堆疊（不丟難懂的例外）：\n${res.stderr}`);
}
