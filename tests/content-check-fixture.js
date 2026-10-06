// 4-b4 的測試共用的小工具（不是測試；scripts/test.mjs 只跑 *.test.js）。
//
// CASES              tests/fixtures/content-check/：一個情況一個小資料夾（好的一組、壞條目、整區讀不到、三語不一致、只有警告…），
//                    每個資料夾都是一份完整的 content/（七支檔，unreadable/ 刻意少了 news.ja.md）。
// CONTENT            真的內容檔 homepage/site/content/。
// LANG_WORDS         reason 裡要點名的語言：zh／中文、en／英文、ja／日文。
// expectedProblems   用 4-b1 的 readContent 自己數一次「讀到的壞東西」，當作 checkContent 的 problems 該有的那幾條（只算檔案那幾條，不含三語不一致）：
//                    整區讀不到 → { file, line: null, raw: null, reason }；壞的版本、壞的條目（版本裡的 item）、壞的公告、壞的連結 → { file, line, raw, reason }。
// sortProblems       排成固定順序再比（problems 的順序沒有規定）。
// tmp                開一個空的暫存資料夾，測試結束就刪。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES, SITE } from './helpers.js';
import { readContent } from '../lib/content.js';

export const CASES = path.join(FIXTURES, 'content-check');
export const CONTENT = path.join(SITE, 'content');
export const LANGS = ['zh', 'en', 'ja'];
export const FILES = [
    'changelog.zh.md', 'changelog.en.md', 'changelog.ja.md',
    'news.zh.md', 'news.en.md', 'news.ja.md',
    'links.md',
];
export const LANG_WORDS = { zh: /zh|中文/, en: /en|英文/, ja: /ja|日文/ };

export function fixture(name) {
    return path.join(CASES, name);
}

export async function expectedProblems(dir) {
    const content = await readContent(dir);
    const found = [];
    const slot = (file, s, each) => {
        if (!s.ok) {
            found.push({ file, line: null, raw: null, reason: s.reason });
            return;
        }
        for (const entry of s.entries) each(entry);
    };
    const badOne = (file, rec) => found.push({ file, line: rec.line, raw: rec.raw, reason: rec.reason });
    for (const lang of LANGS) {
        const file = `changelog.${lang}.md`;
        slot(file, content.changelog[lang], (version) => {
            if (!version.ok) return badOne(file, version);
            for (const item of version.items) if (!item.ok) badOne(file, item);
        });
    }
    for (const lang of LANGS) {
        const file = `news.${lang}.md`;
        slot(file, content.news[lang], (entry) => { if (!entry.ok) badOne(file, entry); });
    }
    slot('links.md', content.links, (entry) => { if (!entry.ok) badOne('links.md', entry); });
    return found;
}

export function sortProblems(list) {
    const key = (p) => `${p.file}|${String(p.line).padStart(6, '0')}|${p.reason}`;
    return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export function tmp(t, prefix = 'site-content-check-') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}
