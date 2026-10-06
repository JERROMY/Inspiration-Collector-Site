// F1b.2：字串表接進網站 —— 取字函式（app/strings.js 的 getString）在伺服器端讀 strings/*.json；client 的 JS 沒有字串表。
//
// 量什麼：
//   F1b.2 app/strings.js 在純 Node 載得起來（不用 JSX），匯出 getString(lang, id)：回 strings/<lang>.json 那一條的原字（帶標記，交給 <Seg>）。
//   F1b.2 取不存在的 id、不認得的語言：丟 Error，訊息有那個 id 與語言 —— 不能回空字串或 undefined（畫面會靜靜空一塊）。
//   F1b.2 字串表只在伺服器端讀：out/_next/ 底下的 .js（先還原 \uXXXX）沒有字串表的原字 —— 帶標記的原字（«…»、{…} 這些只在字串表裡有）、
//         字串表的 id 當成 JSON 的鍵（"tutorial.title.noid": 這種）都不能出現。
//   （壞的字串表讓 build 失敗：strings-build.test.js。使用者寫的內容不走 <Seg>：content-broken.test.js。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1b.2"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITE, OUT, LANGS, needOut, listFiles } from './helpers.js';

const MODULE = path.join(SITE, 'app', 'strings.js');
const MARKS = /[«»{}|⟨⟩⟦⟧⁅⁆¦↵]/;
const LANG_WORD = { zh: /\bzh\b|中文/, en: /\ben\b|英文/, ja: /\bja\b|日文/ };

const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));

async function getString() {
    assert.ok(fs.existsSync(MODULE), '缺 app/strings.js（取字函式 getString(lang, id)）');
    let mod;
    try {
        mod = await import(pathToFileURL(MODULE).href);
    } catch (err) {
        assert.fail(`app/strings.js 在純 Node 載不起來（不能用 JSX；讀檔用 process.cwd() 底下的 strings/）：${err.message}`);
    }
    assert.equal(typeof mod.getString, 'function', 'app/strings.js 要匯出 getString(lang, id)');
    return mod.getString;
}

test('F1b.2 getString(lang, id) 回字串表那一條的原字（帶標記）', async () => {
    const get = await getString();
    for (const lang of LANGS) {
        for (const id of ['state.unreadable', 'news.title', 'hero.title', 'forai.title', 'mail.self.body', '404.home']) {
            assert.equal(get(lang, id), strings[lang][id], `getString('${lang}', '${id}') 要回 strings/${lang}.json 的那一條原字`);
        }
    }
});

test('F1b.2 取不存在的 id、不認得的語言：丟錯，訊息有 id 與語言（不回空字串）', async () => {
    const get = await getString();
    for (const lang of LANGS) {
        let got;
        let error = null;
        try {
            got = get(lang, 'no.such.id');
        } catch (err) {
            error = err;
        }
        assert.ok(error instanceof Error, `getString('${lang}', 'no.such.id') 要丟 Error，得到 ${JSON.stringify(got)}（回空字串或 undefined，畫面會靜靜空一塊）`);
        assert.match(error.message, /no\.such\.id/, `錯誤訊息要有 id：${error.message}`);
        assert.match(error.message, LANG_WORD[lang], `錯誤訊息要講是哪個語言（${lang}）：${error.message}`);
    }
    assert.throws(() => get('fr', 'news.title'), /fr/, "getString('fr', …) 要丟錯，訊息有 fr");
    assert.throws(() => get('zh', ''), Error, "getString('zh', '') 要丟錯");
});

test('F1b.2 字串表只在伺服器端讀：out/_next 的 JS 沒有字串表的原字', () => {
    needOut();
    const probes = [];
    for (const lang of LANGS) {
        for (const [id, text] of Object.entries(strings[lang])) {
            if (MARKS.test(text) && text.length >= 8) probes.push({ what: `${lang} ${id} 的原字`, text });
        }
    }
    for (const id of ['tutorial.title.noid', 'hero.mobile.bold', 'state.unreadable', 'news.title']) probes.push({ what: `id「${id}」當 JSON 的鍵`, text: `"${id}":` });
    assert.ok(probes.length >= 100, `防呆：要比對的字太少（${probes.length}）`);
    const js = listFiles(path.join(OUT, '_next')).filter((r) => /\.m?js$/.test(r));
    assert.ok(js.length > 0, 'out/_next/ 底下沒有 .js —— out/ 不對？');
    for (const rel of js) {
        const text = fs.readFileSync(path.join(OUT, '_next', ...rel.split('/')), 'utf8')
            .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        for (const { what, text: probe } of probes) {
            assert.ok(!text.includes(probe), `out/_next/${rel} 裡有${what}：字串表被打包送到瀏覽器了（只在產生網頁時、伺服器端讀，client 元件拿 props）`);
        }
    }
});
