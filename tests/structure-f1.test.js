// 4-f1 的 F1.7：前端加了 Next.js 之後，「不加套件」改成兩條。只看檔案，不執行模組。
//
// 量什麼：
//   F1.7 package.json 的套件只在白名單：dependencies 只准 next、react、react-dom；devDependencies、optionalDependencies、
//        peerDependencies、bundleDependencies 沒有或空的（helpers.js 的 assertPackageWhitelist；structure-b2～b6 也叫它）。
//   F1.7 後端程式不用 npm 套件：scripts/ 每一支 .js／.mjs 只 import node: 內建與相對路徑、不用 require
//        （lib/ 每一支由 structure.test.js 的 B1.8 守，這裡不重複）。
//   F1.7 白名單本身：白名單外的套件、devDependencies 有東西，assertPackageWhitelist 都要丟（防呆：它永遠不丟的話上面那條是假的綠）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "F1.7"
//   node --test tests/structure-f1.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, assertPackageWhitelist } from './helpers.js';

const SCRIPTS = path.join(SITE, 'scripts');

// 去掉註解，免得註解裡寫到的 import 被當成真的（跟 structure.test.js 同一個寫法）
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

test('F1.7 package.json 的套件只在白名單（next、react、react-dom）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assertPackageWhitelist(pkg);
});

test('F1.7 scripts/ 每一支只 import node: 內建與相對路徑（後端程式不用 npm 套件）', () => {
    const files = fs.readdirSync(SCRIPTS).filter((name) => /\.(m?js|cjs)$/.test(name)).sort();
    assert.ok(files.length > 0, 'scripts/ 底下沒有程式？');
    for (const name of files) {
        const text = fs.readFileSync(path.join(SCRIPTS, name), 'utf8');
        assert.doesNotMatch(code(text), /\brequire\s*\(/, `scripts/${name} 不用 require（ESM）`);
        for (const spec of specifiers(text)) {
            assert.ok(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'),
                `scripts/${name} import 了「${spec}」：後端程式只准 node: 內建與相對路徑（npm 套件只給網站的畫面用）`);
        }
    }
});

test('F1.7 白名單本身：白名單外的套件、devDependencies 有東西都要擋（防呆）', () => {
    assert.doesNotThrow(() => assertPackageWhitelist({}), '沒有任何套件要過');
    assert.doesNotThrow(() => assertPackageWhitelist({ dependencies: { next: '16.0.0', react: '19.0.0', 'react-dom': '19.0.0' } }), '剛好三個要過');
    assert.doesNotThrow(() => assertPackageWhitelist({ dependencies: { next: '16.0.0' }, devDependencies: {} }), '空的 devDependencies 要過');
    for (const [label, pkg] of [
        ['白名單外的套件（tailwindcss）', { dependencies: { next: '16.0.0', tailwindcss: '4.0.0' } }],
        ['白名單外的套件（lodash）', { dependencies: { lodash: '4.0.0' } }],
        ['devDependencies 有東西', { dependencies: { next: '16.0.0' }, devDependencies: { eslint: '9.0.0' } }],
        ['optionalDependencies 有東西', { optionalDependencies: { sharp: '0.33.0' } }],
        ['peerDependencies 有東西', { peerDependencies: { react: '19.0.0' } }],
    ]) {
        assert.throws(() => assertPackageWhitelist(pkg), `${label}：要擋下來`);
    }
});
