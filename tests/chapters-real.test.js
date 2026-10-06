// 真的教學片資料（目標檔 4-b2 的 B2.5）：選擇性跑。
//
// 只有設了環境變數 SITE_REAL_ROOT（指到有 tutorial/chapters.js 與 tutorial/preview/timetable-<zh|en|ja>.txt 的專案根目錄）才跑；
// 沒設就 skip 並寫出原因（不算紅也不算綠）。設了但那裡沒有這些檔 → 紅（打錯路徑不能靜靜略過）。
// tutorial/preview/ 不進 git，只在使用者那台 mac 的主資料夾有；網站搬到公開 repo 之後連 tutorial/ 都沒有，所以預設不跑。
//
// 量什麼：用 lib/chapters.js 讀真的檔（跟 scripts/chapters.mjs 走同一條：loadChaptersScript → buildChapters）——
//   三語各 16 章、id 01～16；第 1 章從 0 起；第 16 章結束在中文時間表的「結尾」（8:49＝529 秒）；三語時間逐章相同；
//   每章 end ＝ 下一章 start；章名、摘要跟 tutorial/chapters.js 的 list 逐章相同（tutorial.html 的目錄讀的就是那份）。
//   另外：已提交的 homepage/site/data/chapters.<zh|en|ja>.json 要跟重算的結果位元組相同（JSON.stringify(…, null, 2)＋結尾換行）——
//   守住「教學片重算過就要重跑」；沒有那三個檔就紅，講「請執行 npm run chapters」。
//
// 跑法（在 homepage/site/）：
//   SITE_REAL_ROOT=<GPTPlugins 的路徑> npm test -- --test-name-pattern "B2.5"
//   （Windows cmd：set "SITE_REAL_ROOT=C:\…\GPTPlugins" && npm test -- --test-name-pattern "B2.5" —— 要加引號，不然 && 前面的空白會變成值的一部分）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib, SITE } from './helpers.js';
import { LANGS, plain } from './chapters-fixture.js';

const need = await lib('chapters.js', ['parseTimetable', 'loadChaptersScript', 'buildChapters']);

const ROOT = process.env.SITE_REAL_ROOT;
const SKIP = ROOT ? false : '沒設 SITE_REAL_ROOT（要指到有 tutorial/preview/ 的專案根目錄，例如 SITE_REAL_ROOT=<GPTPlugins 的路徑>）';

test('B2.5 真的資料：三語各 16 章、01 從 0 起、16 結束在 8:49、三語時間相同、章名對得上 tutorial/chapters.js', { skip: SKIP }, () => {
    const files = ['tutorial/chapters.js', ...LANGS.map((lang) => `tutorial/preview/timetable-${lang}.txt`)];
    for (const rel of files) {
        assert.ok(fs.existsSync(path.join(ROOT, ...rel.split('/'))), `SITE_REAL_ROOT=${ROOT} 底下沒有 ${rel}（路徑打錯了？）`);
    }
    const read = (rel) => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
    const { loadChaptersScript, buildChapters } = need();
    const chapters = plain(loadChaptersScript(read('tutorial/chapters.js')));
    const timetables = {};
    for (const lang of LANGS) timetables[lang] = read(`tutorial/preview/timetable-${lang}.txt`);
    const got = plain(buildChapters({ chapters, timetables }));

    for (const lang of LANGS) {
        const list = got[lang];
        assert.equal(list.length, 16, `${lang} 要 16 章`);
        assert.deepEqual(list.map((c) => c.id), Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0')), `${lang} 的 id`);
        assert.equal(list[0].start, 0, `${lang}：第 1 章從 0 起`);
        assert.equal(list[15].end, 529, `${lang}：第 16 章結束在 8:49（529 秒）`);
        for (let i = 0; i < 15; i++) assert.equal(list[i].end, list[i + 1].start, `${lang} 第 ${i + 1} 章的 end ＝ 下一章 start`);
        assert.deepEqual(list.map((c) => [c.start, c.end]), got.zh.map((c) => [c.start, c.end]), `${lang} 的時間跟中文逐章相同`);
        assert.deepEqual(list.map((c) => c.name), chapters[lang].list.map((c) => c.name), `${lang} 的章名跟 tutorial/chapters.js 一樣`);
        assert.deepEqual(list.map((c) => c.desc), chapters[lang].list.map((c) => c.desc), `${lang} 的摘要跟 tutorial/chapters.js 一樣`);
    }
});

test('B2.5 真的資料：已提交的 data/chapters.<語言>.json 跟重算的結果位元組相同（教學片重算過就要重跑）', { skip: SKIP }, () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
    const { loadChaptersScript, buildChapters } = need();
    const timetables = {};
    for (const lang of LANGS) timetables[lang] = read(`tutorial/preview/timetable-${lang}.txt`);
    const got = buildChapters({ chapters: loadChaptersScript(read('tutorial/chapters.js')), timetables });
    for (const lang of LANGS) {
        const file = path.join(SITE, 'data', `chapters.${lang}.json`);
        assert.ok(fs.existsSync(file), `沒有 data/chapters.${lang}.json：請執行 npm run chapters（在 homepage/site/）`);
        assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify(plain(got[lang]), null, 2) + '\n',
            `data/chapters.${lang}.json 跟重算的結果不同：教學片重算過了？請執行 npm run chapters 再提交`);
    }
});
