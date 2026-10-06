// F1b.3：骨架的占位字換成字串表的正式字 —— 畫面上的字從 strings/<語言>.json 來，前端程式裡不再寫死。
//
// 量什麼（三語各一次）：
//   F1b.3 /zh/、/en/、/ja/ 看得到的字裡有那個語言的 root.name、news.title、changelog.title。
//   F1b.3 社群的字用在讀屏與滑過的提示上，不是畫面字（定稿的 14 是一排只有圖示的圓鈕，設計稿 {zh,en,ja}/index.html 的 .socials 與 strings/README.md「社群連結」）：
//         author.socials → 社群那一排 <ul> 的 aria-label（14 作者與社群那一區一定要有；☰ 選單、頁尾的那一排也是）；
//         social.<代號> → 那一排裡每一顆連到 content/links.md 好連結的 <a> 的 aria-label 與 title（字串表有那個代號才量）。
//         三語各自用自己的字：比對的是那一語的字串表；字跟中文不一樣的（author.socials、social.blog），那一頁不准出現中文的字。
//   F1b.3 / 看得到三語的 root.pick 與英文的 root.name；每一個 root.pick 在標了那個語言 lang 的元素裡（zh-Hant、en、ja）。
//   F1b.3 404.html 看得到三語的 404.title、404.body、404.home；<title> 是 404.meta.title。
//   比對的是「去掉標記之後的字」（«» ⟨⟩ ⟦⟧ ⁅⁆ ¦ ↵ | 拿掉、{…} 留裡面的字），畫面的字是 HTML 拿掉標籤、還原實體。
//   F1b.3 app/、components/ 的程式（去掉註解）裡沒有這些占位字的字面常數 —— 引號裡的字串或 JSX 的字（>…<）剛好等於字串表那一條的字，就算寫死。
//         量的 id：state.unreadable、news.title、changelog.title、author.socials、social.*（「X」太短不量）、root.name、root.pick、404.*、root.meta.title。
//   （「讀不到」的字是 state.unreadable：content-broken.test.js 用寫壞的內容量。）
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F1b.3"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SITE, LANGS, HTML_LANG, readOut, listFiles, decodeEntities } from './helpers.js';

const strings = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'strings', `${lang}.json`), 'utf8'))]));
const { readContent } = await import(pathToFileURL(path.join(SITE, 'lib', 'content.js')).href);

function plain(text) {
    return text.replace(/[«»⟨⟩⟦⟧⁅⁆¦↵|]/g, '').replace(/\{([^{}]*)\}/g, '$1');
}

// 畫面上的字：拿掉 script、style、標籤（標籤直接拿掉、不補空白 —— <wbr>、span 不會把字切開），還原實體
function shown(html) {
    return decodeEntities(html.replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ''));
}

function want(text, lang, id, page) {
    const s = plain(strings[lang][id]);
    assert.ok(text.includes(s), `${page}：要看得到 ${lang} 的 ${id}「${s}」（從字串表來的字）`);
}

test('F1b.3 三語頁的字從字串表來：root.name、news.title、changelog.title', () => {
    for (const lang of LANGS) {
        const text = shown(readOut(`${lang}/index.html`));
        for (const id of ['root.name', 'news.title', 'changelog.title']) want(text, lang, id, `/${lang}/`);
    }
});

// 一個標籤的屬性（值還原實體）
function attrs(tag) {
    return Object.fromEntries([...tag.matchAll(/\s([a-zA-Z-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], decodeEntities(m[2] ?? '')]));
}

test('F1b.3 社群的字從字串表來（三語各自的字）：author.socials 是那一排 <ul> 的 aria-label，social.<代號> 是每一顆的 aria-label 與 title', async () => {
    const links = (await readContent(path.join(SITE, 'content'))).links;
    const good = links.ok ? links.entries.filter((e) => e.ok) : [];
    assert.ok(good.length > 0, '防呆：content/links.md 沒有好的連結');
    for (const lang of LANGS) {
        const html = readOut(`${lang}/index.html`);
        const label = plain(strings[lang]['author.socials']);
        // 社群那一排：aria-label 是這一語的 author.socials 的 <ul>
        const rows = [...html.matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/g)].filter((m) => attrs(m[0].match(/^<ul\b[^>]*>/)[0])['aria-label'] === label);
        const author = /<section\b[^>]*\bdata-section="author"[^>]*>[\s\S]*?<\/section>/.exec(html);
        assert.ok(author, `/${lang}/：找不到 14 作者與社群（data-section="author"）`);
        assert.ok(rows.some((m) => m.index > author.index && m.index < author.index + author[0].length),
            `/${lang}/：14 作者與社群那一排社群圖示的 <ul> 要有 aria-label="${label}"（strings/${lang}.json 的 author.socials）`);
        for (const row of rows) {
            for (const link of good) {
                if (!(`social.${link.code}` in strings[lang])) continue;
                const name = plain(strings[lang][`social.${link.code}`]);
                const a = [...row[0].matchAll(/<a\b[^>]*>/g)].map((m) => attrs(m[0])).find((x) => x.href === link.url);
                assert.ok(a, `/${lang}/：社群那一排（aria-label="${label}"）沒有連到 ${link.url} 的 <a>（${link.code}）`);
                assert.equal(a['aria-label'], name, `/${lang}/ ${link.code}：圖示鈕的 aria-label 要是 strings/${lang}.json 的 social.${link.code}「${name}」`);
                assert.equal(a.title, name, `/${lang}/ ${link.code}：圖示鈕的 title（滑過的提示）要是 strings/${lang}.json 的 social.${link.code}「${name}」`);
            }
        }
        // 三語各自的字：中文的字不准出現在英文、日文頁的 aria-label／title 上
        if (lang === 'zh') continue;
        const zhOnly = ['author.socials', ...good.map((l) => `social.${l.code}`)]
            .filter((id) => id in strings.zh && id in strings[lang] && plain(strings.zh[id]) !== plain(strings[lang][id]));
        assert.ok(zhOnly.length >= 2, `防呆：${lang} 跟中文不一樣的社群字太少（${zhOnly.join('、')}），量不出「用了中文的字」`);
        const used = [...html.matchAll(/\b(?:aria-label|title)="([^"]*)"/g)].map((m) => decodeEntities(m[1]));
        for (const id of zhOnly) {
            const zh = plain(strings.zh[id]);
            assert.ok(!used.includes(zh), `/${lang}/：aria-label／title 用了中文的 ${id}「${zh}」，要用 strings/${lang}.json 的「${plain(strings[lang][id])}」`);
        }
    }
});

test('F1b.3 / 的字從字串表來：三語的 root.pick（各自標 lang）、英文的 root.name', () => {
    const html = readOut('index.html');
    const text = shown(html);
    want(text, 'en', 'root.name', '/');
    for (const lang of LANGS) {
        want(text, lang, 'root.pick', '/');
        const label = plain(strings[lang]['root.pick']).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tagged = new RegExp(`<[a-z][^>]*\\blang="${HTML_LANG[lang]}"[^>]*>(?:\\s|<[^>]+>)*${label}`).test(html);
        assert.ok(tagged, `/：「${plain(strings[lang]['root.pick'])}」要在標了 lang="${HTML_LANG[lang]}" 的元素裡`);
    }
});

test('F1b.3 404 的字從字串表來：三語的 404.title、404.body、404.home，<title> 是 404.meta.title', () => {
    const html = readOut('404.html');
    const text = shown(html);
    for (const lang of LANGS) for (const id of ['404.title', '404.body', '404.home']) want(text, lang, id, '404.html');
    const title = /<title>([^<]*)<\/title>/.exec(html);
    assert.ok(title, '404.html 要有 <title>');
    assert.equal(decodeEntities(title[1]), plain(strings.en['404.meta.title']), '404.html 的 <title> 要是字串表的 404.meta.title');
});

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('F1b.3 前端程式裡沒有寫死占位字（字面的字只在 strings/）', () => {
    const ids = ['state.unreadable', 'news.title', 'changelog.title', 'author.socials', 'root.name', 'root.pick', 'root.meta.title',
        '404.title', '404.body', '404.home', '404.meta.title', ...Object.keys(strings.zh).filter((id) => id.startsWith('social.'))];
    const values = new Map();
    for (const lang of LANGS) {
        for (const id of ids) {
            const s = plain(strings[lang][id] ?? '');
            if (s.length >= 2 && s !== 'X') values.set(s, `${lang} ${id}`);
        }
    }
    assert.ok(values.size >= 25, `防呆：要找的字太少（${values.size}）`);
    const found = [];
    for (const top of ['app', 'components']) {
        for (const rel of listFiles(path.join(SITE, top)).filter((r) => /\.(m?js|jsx)$/.test(r))) {
            const src = code(fs.readFileSync(path.join(SITE, top, ...rel.split('/')), 'utf8'));
            const literals = [
                ...[...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]),
                ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
            ].map((s) => s.trim());
            for (const s of literals) if (values.has(s)) found.push(`${top}/${rel}：「${s}」（${values.get(s)}）`);
        }
    }
    assert.deepEqual(found, [], '前端程式裡還有寫死的占位字：改成從字串表取（getString）');
});
