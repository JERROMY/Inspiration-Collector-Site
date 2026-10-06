// 4-b7 的 B7.1：提交進來的 homepage/site/strings/（npm run strings 用設計師真的字串表產出、再提交的那一份）。介面細則見 tests/README.md「4-b7」。
//
// 量什麼：
//   strings/ 剛好有 zh.json、en.json、ja.json、README.md；三個 JSON 都是 id → 字串的物件、三語 id 完全相同；
//   每一條都轉得過 parseSegments，轉出來的樹跟照 README 轉出來的 HTML 同構（有給、沒給代入值各一次）。
//   設了 SITE_STRINGS_DIR（設計師的 design/homepage/strings 資料夾）的話，另外比：提交進來的四個檔跟它位元組相同 —— 不同就是設計師改過、要重跑 npm run strings。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B7.1 提交"
//   SITE_STRINGS_DIR=<design/homepage/strings 的路徑> npm test -- --test-name-pattern "B7.1 提交"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, lib } from './helpers.js';
import { LANGS, toHtml, readmeHtml, checkTree } from './b7-fixture.js';

const DIR = path.join(SITE, 'strings');
const FILES = ['README.md', 'en.json', 'ja.json', 'zh.json'];
const VALUES = { url: 'https://collector.jerromy.com/zh/', nn: '05', 章名: '安裝到 Chrome' };
const need = await lib('segments.js', ['parseSegments']);

function load() {
    if (!fs.existsSync(DIR)) assert.fail('缺 homepage/site/strings/（請用設計師的字串表資料夾執行 npm run strings -- --from <資料夾> --copy <copy.md>，再提交）');
    const files = fs.readdirSync(DIR).sort();
    assert.deepEqual(files, FILES, `strings/ 要剛好 ${FILES.join('、')}，得到 ${files.join('、')}`);
    return Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf8'))]));
}

test('B7.1 提交進來的 strings/：四個檔都在，三語 id 相同、值都是字串', () => {
    const data = load();
    const ids = Object.keys(data.zh).sort();
    assert.ok(ids.length > 0, 'zh.json 至少要有一條');
    for (const lang of LANGS) {
        assert.ok(data[lang] && typeof data[lang] === 'object' && !Array.isArray(data[lang]), `${lang}.json 要是物件`);
        assert.deepEqual(Object.keys(data[lang]).sort(), ids, `${lang}.json 的 id 要跟 zh.json 完全相同`);
        for (const [id, value] of Object.entries(data[lang])) assert.equal(typeof value, 'string', `${lang}.json 的 ${id} 要是字串`);
    }
    assert.ok(fs.readFileSync(path.join(DIR, 'README.md'), 'utf8').includes('«'), 'strings/README.md 要是字串表說明（寫到標記 «…»）');
});

test('B7.1 提交進來的 strings/：每一條都轉得過 parseSegments，跟照 README 轉出來的 HTML 同構', () => {
    const { parseSegments } = need();
    const data = load();
    for (const lang of LANGS) {
        for (const [id, text] of Object.entries(data[lang])) {
            for (const values of [undefined, VALUES]) {
                let got;
                try {
                    got = values === undefined ? parseSegments(text) : parseSegments(text, values);
                } catch (err) {
                    assert.fail(`${lang} ${id}：轉不過（${err.message}）：${text}`);
                }
                checkTree(got, `${lang} ${id}`);
                assert.equal(toHtml(got), readmeHtml(text, values), `${lang} ${id}${values ? '（有代入值）' : ''}：要跟 README 的轉換同構`);
            }
        }
    }
});

test('B7.1 提交進來的 strings/：跟設計師的字串表位元組相同（SITE_STRINGS_DIR）', (t) => {
    const source = process.env.SITE_STRINGS_DIR;
    if (!source) {
        t.skip('沒設 SITE_STRINGS_DIR（設計師的字串表資料夾），不比對來源');
        return;
    }
    assert.ok(fs.existsSync(source) && fs.statSync(source).isDirectory(), `SITE_STRINGS_DIR=${source} 不是資料夾（路徑打錯不能靜靜略過）`);
    load();
    for (const name of FILES) {
        const from = path.join(source, name);
        assert.ok(fs.existsSync(from), `SITE_STRINGS_DIR 裡沒有 ${name}`);
        assert.ok(fs.readFileSync(path.join(DIR, name)).equals(fs.readFileSync(from)), `strings/${name} 跟設計師的不同：請重跑 npm run strings 再提交`);
    }
});
