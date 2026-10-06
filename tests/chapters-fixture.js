// 章節轉換的測試共用的東西（不是測試；scripts/test.mjs 只跑 *.test.js）。
//
// PROJECT / SMALL   tests/fixtures/chapters/ 底下的兩個假專案根目錄（tutorial/chapters.js ＋ tutorial/preview/timetable-<語言>.txt）：
//                   project 是 16 章（時間跟真的教學片一樣、章名與摘要是假的），small 只有 4 章。
// readText(root, rel)       讀假專案裡的檔。
// fixtureChapters(root)     自己用 node:vm 跑一次假的 chapters.js 拿到資料，再 JSON 轉一次變成這個 realm 的普通物件
//                           —— 測 buildChapters 時不靠被測的 loadChaptersScript。
// timetables(root)          三種語言的時間表原文 { zh, en, ja }。
// expected(root, lang)      16 章那份的預期輸出：時間寫死在下面（手算的秒數），章名與摘要從假的 chapters.js 取。
// plain(value)              JSON 轉一次：vm 沙箱裡做出來的陣列與物件屬於另一個 realm，deepStrictEqual 會因為原型不同而紅在不相干的地方。
// replaceLine(text, from, to)  把時間表裡剛好等於 from 的那一行換成 to（to 是 null 就刪掉那一行）；找不到就是測試自己寫錯。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { FIXTURES } from './helpers.js';

export const PROJECT = path.join(FIXTURES, 'chapters', 'project');
export const SMALL = path.join(FIXTURES, 'chapters', 'small');
export const LANGS = ['zh', 'en', 'ja'];

// 0:07 那一行是「01」的時間表起點，但網站上 01 從 0 起（開頭 7 秒併進 01）
export const STARTS = [0, 35, 61, 85, 112, 147, 171, 202, 233, 279, 312, 350, 381, 424, 456, 493];
export const ENDS = [35, 61, 85, 112, 147, 171, 202, 233, 279, 312, 350, 381, 424, 456, 493, 529];

export function readText(root, rel) {
    return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
}

export function fixtureChapters(root = PROJECT) {
    const sandbox = { window: {} };
    vm.runInNewContext(readText(root, 'tutorial/chapters.js'), sandbox, { timeout: 1000 });
    return JSON.parse(JSON.stringify(sandbox.window.TUTORIAL_CHAPTERS));
}

export function timetables(root = PROJECT) {
    const out = {};
    for (const lang of LANGS) out[lang] = readText(root, `tutorial/preview/timetable-${lang}.txt`);
    return out;
}

export function expected(root, lang) {
    const list = fixtureChapters(root)[lang].list;
    assert.equal(list.length, 16, '測試自己寫錯：expected() 只給 16 章那份用');
    return list.map((item, i) => ({
        id: String(i + 1).padStart(2, '0'),
        name: item.name,
        desc: item.desc,
        start: STARTS[i],
        end: ENDS[i],
    }));
}

export function plain(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function replaceLine(text, from, to) {
    const rows = text.split('\n');
    const i = rows.indexOf(from);
    if (i < 0) throw new Error(`測試自己寫錯：時間表裡沒有「${from}」這一行`);
    if (to === null) rows.splice(i, 1);
    else rows[i] = to;
    return rows.join('\n');
}
