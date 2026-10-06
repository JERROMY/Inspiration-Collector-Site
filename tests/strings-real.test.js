// 4-b7 的 B7.1 真的資料：用設計師真的字串表跑一次 npm run strings（SITE_STRINGS_DIR、SITE_COPY_MD；沒設就 skip）。介面細則見 tests/README.md「4-b7」。
//
// 量什麼：
//   命令只靠參數拿到真的資料、結束碼 0；--out（暫存資料夾）的四個檔跟來源位元組相同；
//   每一條（三語）都跟照 README 轉出來的 HTML 同構；給了 SITE_COPY_MD 的話，copy.md 那幾張 id 表的每一個 id 都在三語裡。
//   測試自己讀 copy.md（表頭剛好是「| id | zh | en | ja | 來源 | 確認 |」的文案表、每一列的第一格），不靠被測的程式。
//
// 跑法（在 homepage/site/）：
//   SITE_STRINGS_DIR=<design/homepage/strings> SITE_COPY_MD=<design/homepage/copy.md> npm test -- --test-name-pattern "B7.1 真的資料"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lib } from './helpers.js';
import { LANGS, toHtml, readmeHtml, checkTree, runScript, tmp, snapshot } from './b7-fixture.js';

const need = await lib('segments.js', ['parseSegments']);
const VALUES = { url: 'https://collector.jerromy.com/ja/', nn: '16', 章名: '遇到問題怎麼辦' };

function copyIds(text) {
    const ids = [];
    let inTable = false;
    for (const row of text.split(/\r?\n/)) {
        if (!row.startsWith('|')) {
            inTable = false;
            continue;
        }
        const cells = row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (cells.join('|') === 'id|zh|en|ja|來源|確認') {
            inTable = true;
            continue;
        }
        if (inTable && !/^-+$/.test(cells[0]) && cells[0] !== '') ids.push(cells[0]);
    }
    return ids;
}

test('B7.1 真的資料：npm run strings 跑真的字串表，原樣寫出、每一條同構', (t) => {
    const source = process.env.SITE_STRINGS_DIR;
    if (!source) {
        t.skip('沒設 SITE_STRINGS_DIR（設計師的字串表資料夾）');
        return;
    }
    for (const name of ['zh.json', 'en.json', 'ja.json', 'README.md']) {
        assert.ok(fs.existsSync(path.join(source, name)), `SITE_STRINGS_DIR=${source} 裡沒有 ${name}（路徑打錯不能靜靜略過）`);
    }
    const copy = process.env.SITE_COPY_MD;
    if (copy) assert.ok(fs.existsSync(copy), `SITE_COPY_MD=${copy} 不存在`);
    const out = path.join(tmp(t, 'site-strings-real-'), 'strings');
    const before = snapshot(source);
    const res = runScript('strings.mjs', ['--from', source, ...(copy ? ['--copy', copy] : []), '--out', out]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}；stderr：${res.stderr}`);
    assert.deepEqual(snapshot(source), before, '設計師的資料夾一個位元組都不變');
    for (const name of ['zh.json', 'en.json', 'ja.json', 'README.md']) {
        assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(path.join(source, name))), `${name} 要原樣寫出`);
    }

    const { parseSegments } = need();
    const data = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(source, `${lang}.json`), 'utf8'))]));
    for (const lang of LANGS) {
        for (const [id, text] of Object.entries(data[lang])) {
            for (const values of [undefined, VALUES]) {
                const got = values === undefined ? parseSegments(text) : parseSegments(text, values);
                checkTree(got, `${lang} ${id}`);
                assert.equal(toHtml(got), readmeHtml(text, values), `${lang} ${id}${values ? '（有代入值）' : ''}：要跟 README 的轉換同構`);
            }
        }
    }
    if (copy) {
        const ids = copyIds(fs.readFileSync(copy, 'utf8'));
        assert.ok(ids.length > 0, 'copy.md 讀不到任何 id（測試自己的讀法）');
        for (const lang of LANGS) {
            const missing = ids.filter((id) => !(id in data[lang]));
            assert.deepEqual(missing, [], `${lang}.json 缺 copy.md 的 id`);
        }
    }
});
