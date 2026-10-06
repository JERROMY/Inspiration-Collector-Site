// F4.7 原始碼的整潔：會公開的程式裡不放看不見的字、不寫內部流程的字眼。靜態掃描，不用建置、不開瀏覽器。
//
// 掃哪些：app/、components/ 底下所有的 .js、.jsx、.mjs、.css、.json、.md、.txt、.svg；public/ 第一層的 .js 與 .css。
// 量什麼：
//   F4.7 看不見的字（私用區 U+E000～F8FF、零寬 U+200B～200D 與 U+2060、BOM U+FEFF、不換行空白 U+00A0）不能直接寫在檔案裡，
//        要寫成 \uXXXX（打開檔案看得出那裡有東西、複製貼上不會掉）。紅的時候列出 檔案:行 與字碼。
//   F4.7 不寫內部流程的字眼：「notes/4-」「設計第一批」「設計第二批」「設計第三批」「設計稿 notes」「派工」「檢查員」「設計審查」「4-f」「4-b」。
//        紅的時候列出 檔案:行、哪個字眼與那一行的開頭。（「後端 bindTail」這類講模組的字可以留。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.7"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from './helpers.js';

const TEXT = /\.(js|jsx|mjs|css|json|md|txt|svg)$/;

function sources() {
    const files = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const f = path.join(dir, e.name);
            if (e.isDirectory()) walk(f);
            else if (TEXT.test(e.name)) files.push(f);
        }
    };
    walk(path.join(SITE, 'app'));
    walk(path.join(SITE, 'components'));
    for (const name of fs.readdirSync(path.join(SITE, 'public'))) if (/\.(js|css)$/.test(name)) files.push(path.join(SITE, 'public', name));
    return files;
}

function scan(each) {
    const files = sources();
    const bad = [];
    for (const f of files) {
        fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => each(line, `${path.relative(SITE, f)}:${i + 1}`, bad));
    }
    return { files, bad };
}

const INVISIBLE = /[-​-‍⁠﻿ ]/g;
const WORDS = ['notes/4-', '設計第一批', '設計第二批', '設計第三批', '設計稿 notes', '派工', '檢查員', '設計審查', '4-f', '4-b'];

test('F4.7 看不見的字（私用區、零寬、BOM、不換行空白）要寫成 \\uXXXX，不直接放在檔案裡', () => {
    const { files, bad } = scan((line, at, out) => {
        for (const m of line.matchAll(INVISIBLE)) out.push(`${at} U+${m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
    });
    assert.ok(files.length > 10, `防呆：只掃到 ${files.length} 個檔`);
    assert.deepEqual(bad, [], `${bad.length} 處直接放了看不見的字`);
});

test('F4.7 程式與註解不寫內部流程的字眼（notes/4-、設計第幾批、派工、檢查員、設計審查、4-f、4-b）', () => {
    const { files, bad } = scan((line, at, out) => {
        for (const w of WORDS) if (line.includes(w)) out.push(`${at}「${w}」：${line.trim().slice(0, 60)}`);
    });
    assert.ok(files.length > 10, `防呆：只掃到 ${files.length} 個檔`);
    assert.deepEqual(bad, [], `${bad.length} 處寫了內部流程的字眼`);
});
