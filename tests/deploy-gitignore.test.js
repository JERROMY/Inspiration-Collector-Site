// 網站 repo 的 .gitignore（目標檔 4-b5 的 B5.4，派工 2026-10-02 補記進目標檔：.gitignore 與換行；介面細則見 tests/README.md「4-b5」）。
// 搬進公開 repo 之後它就是根目錄的 .gitignore。
//
// 量什麼：用真的 git 判斷（不自己猜規則）：把 homepage/site/.gitignore 單獨複製到一個空的暫存 git repo，
// 關掉這台電腦的全域忽略設定（core.excludesFile 指到空檔），再用 git check-ignore 問：
//   B5.4 要擋掉：node_modules/、out/、.next/ 底下的檔。
//   B5.4 不准擋：content/、data/、public/（含 public/media/、public/_headers）底下現在有的每一個檔，
//        〔挑〕以及 package.json、package-lock.json（npm ci 要它）、.node-version、.gitattributes、README.md、lib/、scripts/、tests/ 的代表檔。
//   叫不起 git 就 skip（測試寫明原因）；.gitignore 不在就以「缺 .gitignore」失敗。暫存 repo 用完刪掉。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B5.4"
//   node --test tests/deploy-gitignore.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { GITIGNORE, readSite } from './deploy-files.js';

const IGNORED = ['node_modules/next/package.json', 'out/index.html', 'out/zh/index.html', '.next/cache/webpack/x.pack'];
const KEPT_FIXED = [
    'package.json', 'package-lock.json', '.node-version', '.gitattributes', 'README.md', 'public/_headers',
    'public/media/hero-zh.mp4', 'public/media/hero-poster-zh.webp', 'public/media/media.json',
    'data/chapters.zh.json', 'content/news.zh.md', 'content/changelog.zh.md', 'content/links.md',
    'lib/content.js', 'scripts/test.mjs', 'tests/helpers.js',
];

// content/、data/、public/ 底下現在有的每一個檔（相對 homepage/site/，用 / 分隔）
function existing() {
    const out = [];
    const walk = (rel) => {
        const full = path.join(SITE, rel);
        if (!fs.existsSync(full)) return;
        for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
            const child = `${rel}/${ent.name}`;
            if (ent.isDirectory()) walk(child);
            else out.push(child);
        }
    };
    ['content', 'data', 'public'].forEach(walk);
    return out;
}

function sh(cwd, args) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

test('B5.4 .gitignore：擋掉 node_modules/、out/、.next/，不擋 content/、data/、public/media/ 這些要進 git 的', (t) => {
    const rules = readSite(GITIGNORE);
    if (sh(SITE, ['--version']).error) return t.skip('叫不起 git');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-gitignore-'));
    try {
        assert.equal(sh(dir, ['init', '-q']).status, 0, 'git init 失敗');
        fs.writeFileSync(path.join(dir, '.gitignore'), rules);
        fs.writeFileSync(path.join(dir, 'no-global-excludes'), '');
        const kept = [...new Set([...KEPT_FIXED, ...existing()])];
        for (const rel of [...IGNORED, ...kept]) {
            fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), '');
        }
        const run = sh(dir, ['-c', `core.excludesFile=${path.join(dir, 'no-global-excludes')}`, '-c', 'core.quotePath=off',
            'check-ignore', '--no-index', '--', ...IGNORED, ...kept]);
        assert.ok(run.status === 0 || run.status === 1, `git check-ignore 失敗：${run.stderr}`);
        const hit = new Set(run.stdout.split('\n').map((s) => s.trim()).filter(Boolean));
        const leaked = IGNORED.filter((rel) => !hit.has(rel));
        assert.deepEqual(leaked, [], `${GITIGNORE} 沒擋到：${leaked.join('、')}（至少要有 node_modules/、out/、.next/）`);
        const dropped = kept.filter((rel) => hit.has(rel));
        assert.deepEqual(dropped, [], `${GITIGNORE} 擋掉了要進 git 的檔：${dropped.join('、')}`);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
