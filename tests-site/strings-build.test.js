// F1b.1、F1b.2：字串表寫壞時 build 要失敗，而且講得出是哪個 id、哪個語言 —— 不是靜靜畫成空白或照原字畫出來。
//
// 做法：把整個網站複製到系統暫存資料夾，在複本裡改壞 strings/*.json 再 build（helpers.js 的 buildCopy）；專案裡的 strings/ 一個位元組都不動。
// 四種壞法，各 build 一次（第一次用到才 build）：
//   a. ja.json 少了 news.title（三語的 id 不一樣）
//   b. 三語都少了 news.title（頁面要的字不存在）
//   c. zh.json 的 news.title 改成「«最新公告」（頁面用到的字，標記沒關）
//   d. zh.json 的 hero.title 少了右邊的 }（這一段還沒有頁面用到 —— 字串表要整份先驗過，不是用到才發現）
// 量什麼：結束碼不是 0；輸出（stdout＋stderr）裡有那個 id 與那個語言（zh／en／ja 或 中文／英文／日文；b 只要求 id）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "壞的字串表"
//   要先 npm ci；不需要先 build。四次 build 在 mac 上約 20～40 秒。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCopy, tail } from './helpers.js';

const LANG_WORD = { zh: /\bzh\b|中文/, en: /\ben\b|英文/, ja: /\bja\b|日文/ };
const builds = [];

after(() => {
    for (const b of builds) b.cleanup();
});

function edit(lang, change) {
    return (copy) => {
        const file = path.join(copy, 'strings', `${lang}.json`);
        const table = JSON.parse(fs.readFileSync(file, 'utf8'));
        change(table);
        fs.writeFileSync(file, JSON.stringify(table, null, 2) + '\n');
    };
}

function broken(label, ...changes) {
    const build = buildCopy({ label, prepare: (copy) => changes.forEach((change) => change(copy)) });
    builds.push(build);
    assert.notEqual(build.status, 0, `${label}：build 要失敗（結束碼不是 0），卻成功了 —— 寫壞的字串表被靜靜畫出來了`);
    return build.output;
}

function mentions(output, id, lang, label) {
    assert.ok(output.includes(id), `${label}：build 的錯誤訊息要講出 id「${id}」：\n${tail(output)}`);
    if (lang) assert.match(output, LANG_WORD[lang], `${label}：build 的錯誤訊息要講出語言（${lang}）：\n${tail(output)}`);
}

test('F1b.2 壞的字串表 a：ja.json 少了 news.title（三語的 id 不一樣）→ build 失敗，講出 id 與 ja', () => {
    const label = 'ja 少一個 id';
    mentions(broken(label, edit('ja', (t) => delete t['news.title'])), 'news.title', 'ja', label);
});

test('F1b.2 壞的字串表 b：三語都少了 news.title（頁面要的字不存在）→ build 失敗，講出 id', () => {
    const label = '三語都少一個 id';
    mentions(broken(label, ...['zh', 'en', 'ja'].map((lang) => edit(lang, (t) => delete t['news.title']))), 'news.title', null, label);
});

test('F1b.1 壞的字串表 c：zh 的 news.title 標記沒關（頁面用到的字）→ build 失敗，講出 id 與 zh', () => {
    const label = 'zh news.title 壞標記';
    mentions(broken(label, edit('zh', (t) => { t['news.title'] = '«最新公告'; })), 'news.title', 'zh', label);
});

test('F1b.1 壞的字串表 d：zh 的 hero.title 少了 }（還沒有頁面用到的字）→ build 失敗，講出 id 與 zh', () => {
    const label = 'zh hero.title 壞標記';
    mentions(broken(label, edit('zh', (t) => { t['hero.title'] = t['hero.title'].replace('}', ''); })), 'hero.title', 'zh', label);
});
