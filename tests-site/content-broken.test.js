// F1.3（內容寫壞不壞站）與 F1.4 的「bindTail 的輸出只跳脫一次」。
//
// 做法：把整個網站複製到系統暫存資料夾，content/ 換成 tests-site/fixtures/content-bad/，在那裡 build（helpers.js 的 buildCopy）。
// 專案裡的 content/、out/、.next/ 一個都不動。預期的數字不手數：用後端的 lib/content.js 的 readContent 讀同一份 fixture 算。
//
// fixture 寫壞的地方（content-bad/）：
//   zh：更新紀錄 1 條壞 item、1 個壞的版本標題（##1.0.3 少了空格）；公告 1 則壞（連結不是 https）—— 好的那則標題是「A<b> & "q" 測試標題」
//   en：公告 1 則壞（同上）—— 好的那則標題是「Fix <b> & "quotes" in titles」
//   ja：更新紀錄 1 條壞 item；news.ja.md 整支不在（那一區 ok:false）
//   links.md（三語共用）：1 個壞的（代號有大寫）
//
// 量什麼：
//   F1.3 build 成功（結束碼 0），三語頁都在。
//   F1.3 每一頁「標示讀不到」的元素（data-state="unreadable"，字由字串表決定、這裡不綁字）至少有那一頁寫壞的地方那麼多個：
//        壞的 item、壞的版本、壞的公告、壞的連結各算一個，整區讀不到算一個（zh ≥ 4、en ≥ 2、ja ≥ 3）。
//   F1.3 其餘條目照常：好的版本號、每一條好的 item（bindTail 之後的樣子）、好的公告標題（bindTail 之後）、好的連結（href）都在那一頁的 HTML 裡。
//        更新紀錄只算 app/site.js 的 CHANGELOG_FROM 那一版以後的（派工決定不列 1.0.3，F8.1 守著「不列」）：比它舊的好版本不算「要出現」，裡面寫壞的條目也不算「讀不到」。
//        標題寫壞的版本讀不出版本號，照樣算一個「讀不到」。
//   F1.3 整支讀不到（news.ja.md 不在）也不丟例外：ja 頁照樣產生。
//   F1.3 reason（寫給開發者的中文）不出現在畫面上：每一頁看得到的字（去掉 script、style 與標籤）裡沒有任何一個 reason。
//   F1.3reason 不隨網頁送到瀏覽器：out/ 的 .html、.txt（RSC 資料）與 out/_next/ 的 .js 都沒有 fixture 的任何一個 reason
//        （比對每個 reason 的開頭一段，到第一個會被跳脫的字為止；先還原 \\uXXXX）。把整個 readContent 結果交給 client 元件會紅。
//   F1.3 真的 content/ 沒寫壞時，真的 out/ 三語頁一個「讀不到」都沒有。
//   F1.4 公告標題含 < & " 時：HTML 裡剛好是 bindTail(標題, 語言) 的輸出（dangerouslySetInnerHTML 原樣放、不再跳脫）——
//        沒有 &amp;lt; 這種跳脫兩次的字、標題的 <b> 沒有變成真的標籤。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1.3|F1.4 公告標題"
//   要先 npm ci（用的是專案的 node_modules/next）；不需要先 build（自己在暫存資料夾 build）。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITE, LANGS, needOut, readOut, buildCopy, tail, visibleText, listFiles, decodeEntities } from './helpers.js';

const FIXTURE = path.join(SITE, 'tests-site', 'fixtures', 'content-bad');
const MARKER = /\bdata-state\s*=\s*["']?unreadable\b/g;

const { readContent } = await import(pathToFileURL(path.join(SITE, 'lib', 'content.js')).href);
const { bindTail } = await import(pathToFileURL(path.join(SITE, 'lib', 'bind-tail.js')).href);
const { CHANGELOG_FROM } = await import(pathToFileURL(path.join(SITE, 'app', 'site.js')).href);

// 這一版列不列：不比 CHANGELOG_FROM 舊（一段一段照數字比，1.0.10 比 1.0.9 新）。自己算，不借網站的 listed()，網站算錯才抓得到
function listedVersion(version) {
    const a = version.split('.').map(Number);
    const b = CHANGELOG_FROM.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d > 0;
    }
    return true;
}

// 第一次用到才 build（約 10 秒）；用 --test-name-pattern 只跑別的條目時不 build
let build = null;

function built() {
    build ??= buildCopy({ content: FIXTURE, label: 'content-bad' });
    return build;
}

after(() => {
    if (build) build.cleanup();
});

function page(lang) {
    built();
    assert.equal(build.status, 0, `內容寫壞時 build 失敗（結束碼 ${build.status}）：\n${tail(build.output)}`);
    const file = path.join(build.out, lang, 'index.html');
    assert.ok(fs.existsSync(file), `內容寫壞時沒有產生 out/${lang}/index.html`);
    return fs.readFileSync(file, 'utf8');
}

// 一個語言頁要看到的：壞的幾個、好的有哪些字
function expected(content, lang) {
    let bad = 0;
    const good = [];
    const changelog = content.changelog[lang];
    if (!changelog.ok) bad += 1;
    else {
        for (const version of changelog.entries) {
            if (!version.ok) { bad += 1; continue; }
            if (!listedVersion(version.version)) continue;
            good.push({ what: `更新紀錄 ${version.version} 的版本號`, text: version.version });
            for (const item of version.items) {
                if (!item.ok) bad += 1;
                else good.push({ what: `更新紀錄 ${version.version} 的「${item.text}」`, text: bindTail(item.text, lang) });
            }
        }
    }
    const news = content.news[lang];
    if (!news.ok) bad += 1;
    else {
        for (const entry of news.entries) {
            if (!entry.ok) bad += 1;
            else good.push({ what: `公告「${entry.title}」的標題`, text: bindTail(entry.title, lang) });
        }
    }
    if (!content.links.ok) bad += 1;
    else {
        for (const link of content.links.entries) {
            if (!link.ok) bad += 1;
            else good.push({ what: `社群連結 ${link.code}`, text: `href="${link.url}"` });
        }
    }
    return { bad, good };
}

function reasons(content) {
    const all = [];
    const slot = (s) => {
        if (!s.ok) { all.push(s.reason); return; }
        for (const e of s.entries) {
            if (!e.ok) all.push(e.reason);
            for (const item of e.items ?? []) if (!item.ok) all.push(item.reason);
        }
    };
    for (const kind of ['changelog', 'news']) for (const lang of LANGS) slot(content[kind][lang]);
    slot(content.links);
    return all;
}

test('F1.3 內容寫壞：build 成功、三語頁都在（整支 news.ja.md 不在也不丟例外）', () => {
    for (const lang of LANGS) page(lang);
});

test('F1.3 每個寫壞的地方都有一則「讀不到」（data-state="unreadable"）', async () => {
    const content = await readContent(FIXTURE);
    const want = { zh: 4, en: 2, ja: 3 };
    for (const lang of LANGS) {
        const { bad } = expected(content, lang);
        assert.equal(bad, want[lang], `防呆：fixture 的 ${lang} 應該壞 ${want[lang]} 個，readContent 讀出 ${bad} 個（fixture 被改了？）`);
        const count = (page(lang).match(MARKER) ?? []).length;
        assert.ok(count >= bad, `/${lang}/：寫壞了 ${bad} 個地方（壞的 item、版本、公告、連結各一個，整區讀不到一個），只找到 ${count} 個 data-state="unreadable"`);
    }
});

test('F1.3 其餘條目照常（好的版本、item、公告標題、連結都在）', async () => {
    const content = await readContent(FIXTURE);
    for (const lang of LANGS) {
        const html = page(lang);
        const { good } = expected(content, lang);
        assert.ok(good.length >= 4, `防呆：fixture 的 ${lang} 好的條目太少（${good.length}）`);
        for (const { what, text } of good) {
            assert.ok(html.includes(text), `/${lang}/：寫壞的地方旁邊，好的條目要照常出現 —— 找不到${what}（要有 ${JSON.stringify(text)}）`);
        }
    }
});

test('F1.3 reason（寫給開發者的中文）不出現在畫面上', async () => {
    const all = reasons(await readContent(FIXTURE));
    assert.ok(all.length >= 6, `防呆：fixture 的 reason 太少（${all.length}）`);
    for (const lang of LANGS) {
        const text = visibleText(page(lang)).replace(/\s+/g, ' ');
        for (const reason of all) {
            const head = reason.replace(/\s+/g, ' ').slice(0, 24);
            assert.ok(!text.includes(head), `/${lang}/ 的畫面上出現了 reason「${reason}」：那是寫給開發者看的，畫面上只顯示「這一條讀不到」`);
        }
    }
});

// reason 拿來比對的那一段：從頭取到第一個會被 JSON／HTML 跳脫的字（" \\ < > &）之前，最多 24 字
function probe(reason) {
    return reason.split(/["\\<>&]/)[0].slice(0, 24);
}

test('F1.3 reason 不隨網頁送到瀏覽器：HTML、.txt（RSC 資料）、out/_next 的 JS 都沒有', async () => {
    const probes = reasons(await readContent(FIXTURE)).map(probe);
    assert.ok(probes.every((p) => p.length >= 8), `防呆：fixture 的 reason 拿來比對的那一段太短：${JSON.stringify(probes)}`);
    page('zh');
    const files = listFiles(build.out).filter((r) => /\.(html|txt)$/.test(r) || (r.startsWith('_next/') && /\.m?js$/.test(r)));
    for (const rel of files) {
        const raw = fs.readFileSync(path.join(build.out, ...rel.split('/')), 'utf8')
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        for (const p of probes) {
            assert.ok(!raw.includes(p), `out/${rel} 裡有 reason「${p}…」：寫給開發者看的原因跟著網頁送到瀏覽器了 —— 只把要畫的欄位傳給元件，不要把整個 readContent 結果交給 client 元件`);
        }
    }
});

test('F1.3 真的 content/ 沒寫壞時，真的 out/ 一個「讀不到」都沒有', async () => {
    needOut();
    const content = await readContent(path.join(SITE, 'content'));
    for (const lang of LANGS) {
        const { bad } = expected(content, lang);
        const count = (readOut(`${lang}/index.html`).match(MARKER) ?? []).length;
        if (bad === 0) assert.equal(count, 0, `/${lang}/：真的 content/ 沒寫壞，卻有 ${count} 個 data-state="unreadable"`);
        else assert.ok(count >= bad, `/${lang}/：真的 content/ 寫壞了 ${bad} 個地方（npm run content:check 看哪裡），只找到 ${count} 個「讀不到」`);
    }
});

test('F1.4 公告標題含 < & " 時：HTML 裡是 bindTail 的輸出、只跳脫一次', async () => {
    const content = await readContent(FIXTURE);
    for (const lang of ['zh', 'en']) {
        const html = page(lang);
        const entry = content.news[lang].entries.find((e) => e.ok && /[<&"]/.test(e.title));
        assert.ok(entry, `防呆：fixture 的 news.${lang}.md 要有一則標題含 < & " 的好公告`);
        const want = bindTail(entry.title, lang);
        if (lang === 'zh') assert.match(want, /<span class="nw">/, '防呆：中文的 bindTail 要有 <span class="nw">');
        assert.ok(html.includes(want), `/${lang}/：公告標題要原樣放 bindTail 的輸出（dangerouslySetInnerHTML），找不到 ${JSON.stringify(want)}`);
        assert.ok(!/&amp;(lt|gt|quot|amp|#39);/.test(html), `/${lang}/：有跳脫兩次的字（&amp;lt; 之類）—— bindTail 已經跳脫過，不要再當文字放一次`);
        assert.ok(!html.includes(entry.title), `/${lang}/：標題原文沒跳脫就放進 HTML 了（<b> 會變成真的標籤）`);
    }
});

// ---- F1b：字串表接進來之後 ----

const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));

test('F1b.2 使用者寫的內容不走 <Seg>：公告標題裡的 « { | ⟨ 照原字顯示（走 bindTail）', async () => {
    const content = await readContent(FIXTURE);
    for (const lang of ['zh', 'en']) {
        const entry = content.news[lang].entries.find((e) => e.ok && /[«{|⟨]/.test(e.title));
        assert.ok(entry, `防呆：fixture 的 news.${lang}.md 要有一則標題含 « { | ⟨ 的好公告`);
        assert.ok(page(lang).includes(bindTail(entry.title, lang)), `/${lang}/：公告標題「${entry.title}」要照原字（bindTail 的輸出）放 —— 使用者寫的內容不是字串表，不能交給 <Seg> 轉標記`);
    }
});

// 「讀不到」用哪一個字（strings/README.md「這一條讀不到」那張表；設計稿 notes/4-3.md 同一條）：
//   公告、更新紀錄整支讀不到、或每一條都寫壞 → 整區一個虛線框，字是 state.unreadable.section；
//   其他（一則公告、一條、一整版、一個社群連結，含 links.md 整支讀不到時 14 的那一格）→ state.unreadable。
// 哪一區是「整區」從 readContent 讀同一份 fixture 自己算（更新紀錄只算 CHANGELOG_FROM 以後的版本與寫壞的版本），不看網站畫了什麼。
const unreadableText = (lang, id) => strings[lang][id].replace(/[«»⟨⟩⟦⟧⁅⁆¦↵|]/g, '').replace(/\{([^{}]*)\}/g, '$1');

function wholeRegions(content, lang) {
    const regions = [];
    const news = content.news[lang];
    if (!news.ok || (news.entries.length > 0 && news.entries.every((e) => !e.ok))) regions.push('news');
    const log = content.changelog[lang];
    const shown = log.ok ? log.entries.filter((v) => !v.ok || listedVersion(v.version)) : [];
    if (!log.ok || (shown.length > 0 && shown.every((v) => !v.ok))) regions.push('changelog');
    return regions;
}

// 每一個 data-state="unreadable" 的元素：在 HTML 的位置、字（去掉標籤、還原實體）、在哪一區（<section data-section>）
function markers(html) {
    const sections = [...html.matchAll(/<section\b[^>]*\bdata-section="([^"]+)"[^>]*>[\s\S]*?<\/section>/g)]
        .map((m) => ({ name: m[1], from: m.index, to: m.index + m[0].length }));
    return [...html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bdata-state="unreadable"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
        text: decodeEntities(m[2].replace(/<[^>]+>/g, '')).trim(),
        section: sections.find((x) => m.index >= x.from && m.index < x.to)?.name ?? '（不在任何一區）',
    }));
}

test('F1b.3「讀不到」整區讀不到時是字串表的 state.unreadable.section（ja 的公告整支不在）', async () => {
    const content = await readContent(FIXTURE);
    let checked = 0;
    for (const lang of LANGS) {
        const want = unreadableText(lang, 'state.unreadable.section');
        const found = markers(page(lang));
        for (const region of wholeRegions(content, lang)) {
            const inside = found.filter((m) => m.section === region);
            assert.equal(inside.length, 1, `/${lang}/ ${region}：整區讀不到，要剛好一個「讀不到」（整區一個虛線框），找到 ${inside.length} 個`);
            assert.equal(inside[0].text, want, `/${lang}/ ${region}：整區讀不到，字要是 strings/${lang}.json 的 state.unreadable.section（不是單條的 state.unreadable）`);
            checked += 1;
        }
    }
    assert.ok(checked >= 1, '防呆：fixture 沒有一區整支讀不到（content-bad 的 news.ja.md 應該不在）');
});

test('F1b.3「讀不到」單條（一則、一條、一整版、一個連結）是字串表的 state.unreadable（三語）', async () => {
    const content = await readContent(FIXTURE);
    for (const lang of LANGS) {
        const want = unreadableText(lang, 'state.unreadable');
        const whole = wholeRegions(content, lang);
        const single = markers(page(lang)).filter((m) => !whole.includes(m.section));
        assert.ok(single.length > 0, `/${lang}/：找不到單條的 data-state="unreadable"（fixture 每一語都有寫壞的單條）`);
        for (const m of single) assert.equal(m.text, want, `/${lang}/ ${m.section}：單條讀不到，字要是 strings/${lang}.json 的 state.unreadable（state.unreadable.section 只給整區讀不到）`);
    }
});
