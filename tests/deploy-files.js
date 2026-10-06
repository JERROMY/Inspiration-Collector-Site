// 4-b5（部署設定與給使用者的說明）測試共用的小工具（不是測試；scripts/test.mjs 只跑 *.test.js）。
//
// 讀的都是 homepage/site/ 裡面的檔（搬進公開 repo 之後它就是 repo 的根）：
//   public/_headers、.node-version、.gitignore、.gitattributes、README.md（2026-10-07 部署從 GitHub Pages 改成 Cloudflare Pages）。
// readSite(rel)  檔案不在就以「缺 <rel>（後端之後寫）」失敗，不讓 readFileSync 丟出看不懂的例外。
// paragraphs()   用空行切段；sections() 用標題（# 開頭的行）切節；codeBlocks() 撿 ``` 包起來的區塊。
// git(args)      在 homepage/site/ 叫 git；叫不起來回 null（測試自己決定要 skip 還是失敗）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';

export const HEADERS = 'public/_headers';
export const NODE_VERSION = '.node-version';
export const GITIGNORE = '.gitignore';
export const GITATTRIBUTES = '.gitattributes';
export const README = 'README.md';

export function exists(rel) {
    return fs.existsSync(path.join(SITE, rel));
}

export function readSite(rel) {
    const file = path.join(SITE, rel);
    if (!fs.existsSync(file)) assert.fail(`缺 ${rel}（後端之後寫）`);
    return fs.readFileSync(file, 'utf8');
}

export function paragraphs(text) {
    return text.split(/\n[ ]*\n/);
}

// 一節＝一個標題行到下一個標題行之前（不分層級）；第一個標題之前那段也算一節
export function sections(text) {
    return text.split(/\n(?=#{1,6} )/);
}

export function codeBlocks(text) {
    return [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]);
}

export function git(args) {
    const run = spawnSync('git', args, { cwd: SITE, encoding: 'utf8' });
    if (run.error) return null;
    return run;
}
