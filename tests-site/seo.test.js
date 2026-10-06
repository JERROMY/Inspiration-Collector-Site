// F2.1～F2.3、F2.5～F2.7 SEO 標記、404、網站地圖與 robots、圖示一套。讀 build 出來的 out/（送出來的 HTML，不跑腳本；圖示的角落另外開瀏覽器量）。
// 「/」的分流（F2.4）在 root-redirect.test.js。
//
// 規則來源：規格書 §4、§10.2～§10.7；網站必備（SEO 與語言版本、圖示一套）；設計稿第四批的分享卡 <head> 與圖示規格（icons/site/README.md「給前端的清單」）。
// 正式網址一律 https://collector.jerromy.com/（app/site.js 的 SITE_URL，一個地方）。字一律從字串表（app/strings.js 的 getPlainString）取，跟網站同一份。
//
// 量什麼（四頁＝/zh/、/en/、/ja/、/；五頁＝四頁加 404）：
//   F2.1 四頁的 hreflang 剛好五條、一樣的一組：zh-Hant 與 zh → /zh/、en → /en/、ja → /ja/、x-default → /（絕對網址）；canonical 一條，指到自己（/ 指到 /），結尾有 /、沒有 ? 與 #；
//        每頁剛好一個 <h1>；標題不跳層（下一個標題最多比上一個深一層）。帶 ?ref=x 開頁時 canonical 不變（瀏覽器裡量，在 root-redirect.test.js）。
//   F2.2 三語頁：<title>＝meta.title、description＝meta.desc（中日 ≤ 30 字寬、英文 ≤ 60 字母）；分享卡 og:type website、og:site_name＝meta.siteName、og:title、og:description、
//        og:url＝canonical、og:locale（zh_TW／en_US／ja_JP）與另外兩個 og:locale:alternate、og:image＝https://collector.jerromy.com/og/og-<語言>.png、
//        og:image:width 1200、og:image:height 630、og:image:type image/png、og:image:alt＝og.image.alt；twitter:card summary_large_image。
//        「/」：<title>＝root.meta.title、description＝英、中、日三個語言頁的 meta.desc 依序用「 / 」接起來（規格書 §10.2「三語的一句話各一行」）；
//        分享卡只用英文那一句：og:description（與有放的 twitter:description）＝英文的 meta.desc（規格書 §10.6）；
//        og:title＝root.meta.title、og:url＝/、og:locale en_US、og:image＝og-en.png、og:image:alt＝英文的 og.image.alt；「/」不可以有 noindex（它是 x-default）。
//        四頁有放 twitter:description 的話要跟 og:description 一樣。
//        分享卡圖檔本身（out/og/og-<語言>.png、1200×630）與 twitter:image、404 的分享卡圖：solo.test.js 的 F8.5f。
//   F2.3 三語頁的 JSON-LD（離線檢查 schema.org 的結構）：每一段 JSON 讀得起來、裡面沒有「<」（要跳脫成 \u003c）、@context 是 schema.org、每個節點有 @type；
//        SoftwareApplication：name＝meta.siteName、description＝meta.desc、applicationCategory＝BrowserApplication、operatingSystem 只有 Windows 與 macOS、
//        offers 是 Offer、price 0、有 priceCurrency；installUrl＝商店頁；image 是正式網址底下的圖；author 指到作者；沒有 aggregateRating、review（不編評分）。
//        Person：name＝author.name；url＝content/links.md 的 blog；url 與 sameAs 合起來包含 links.md 每一個好的連結。
//        三語頁不放 WebSite。「/」的 JSON-LD 只有一個 WebSite：url＝https://collector.jerromy.com/、name＝英文的 meta.siteName、alternateName＝中文與日文的 meta.siteName（Google〈Site names〉：網站名稱放在網域首頁、一個網站一個名稱）。
//        FAQPage：mainEntity 剛好七個 Question，第 N 個的 name＝faq.N.q、acceptedAnswer 是 Answer、text＝faq.N.a（跟字串表同一份，不另寫一份）。沒有 VideoObject（宣傳片還沒上 YouTube）。
//   F2.5 out/404.html：在；<meta name="robots"> 剛好一條、有 noindex；三語各一段（剛好一個 <li lang＝zh-Hant／en／ja>；<h1> 裡的三段也標 lang，所以只認 <li>），各有一個連到自己語言頁（/zh/ 這種從根目錄算的路徑）的「回首頁」（404.home）。
//   F2.6 out/sitemap.xml：剛好三個 <loc>（/zh/、/en/、/ja/ 的正式網址），不含 /；每個 <url> 有五條 xhtml:link（zh-Hant、zh、en、ja、x-default）。
//        out/robots.txt：沒有任何非空的 Disallow（全部允許，AI 爬蟲也是）、有 User-agent: *、有 Sitemap: https://collector.jerromy.com/sitemap.xml。
//   F2.7 五頁的 <head>：icon 32（/favicon-32.png、image/png、32x32）、icon 16（/favicon-16.png、16x16）、apple-touch-icon（/apple-touch-icon.png）、
//        manifest（三語頁 /<語言>/site.webmanifest，/ 與 404 用 /en/site.webmanifest）、theme-color #1b1d24；不連 SVG 的 icon（一倍螢幕會被拿去畫 16px）。
//        out/ 的圖檔：寬高對（PNG 檔頭）；開瀏覽器量四個角 —— favicon-16、favicon-32、icon-192、icon-512 透明（alpha 0），apple-touch-icon 與兩張 maskable 不透明（alpha 255）。
//        有 clipper/icons/ 時（這個 repo），favicon-16、favicon-32 跟擴充的 icon-16.png、icon-32.png 位元組一樣（16 是畫在 16 格線上的那一組，不是縮出來的）。
//        三份 site.webmanifest：name＝nav.brand、short_name＝manifest.shortName、lang、start_url /<語言>/、scope /、display browser、theme_color 與 background_color #1b1d24、
//        icons 四個（192、512 any；192、512 maskable），每一個檔都在。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F2\\."
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OUT, LANGS, HTML_LANG, readOut, tagAttrs, playwright, browserSession, needOut } from './helpers.js';
import { width as wide } from './page-helpers.js';
import { getPlainString } from '../app/strings.js';
import { SITE_URL, STORE_URL } from '../app/site.js';
import { readContent } from '../lib/content.js';

const SITE = SITE_URL.replace(/\/$/, '');
const URL_OF = { zh: `${SITE}/zh/`, en: `${SITE}/en/`, ja: `${SITE}/ja/`, root: `${SITE}/` };
const REL_OF = { zh: 'zh/index.html', en: 'en/index.html', ja: 'ja/index.html', root: 'index.html', 404: '404.html' };
const FOUR = [...LANGS, 'root'];
const FIVE = [...FOUR, '404'];
const HREFLANG = { 'zh-hant': URL_OF.zh, zh: URL_OF.zh, en: URL_OF.en, ja: URL_OF.ja, 'x-default': URL_OF.root };
const OG_LOCALE = { zh: 'zh_TW', en: 'en_US', ja: 'ja_JP' };
const THEME = '#1b1d24';
const say = (lang, id) => getPlainString(lang, id);

const head = (rel) => {
    const html = readOut(rel);
    const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
    assert.ok(m, `out/${rel} 找不到 <head>`);
    return m[1];
};
const links = (rel, relName) => tagAttrs(head(rel), 'link').filter((a) => (a.rel || '').toLowerCase().split(/\s+/).includes(relName));
const metas = (rel) => tagAttrs(head(rel), 'meta');
const metaContent = (rel, key, value) => metas(rel).filter((a) => (a[key] || '').toLowerCase() === value.toLowerCase()).map((a) => a.content);
const titleOf = (rel) => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head(rel));
    return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'") : null;
};

// ---------- F2.1 ----------

test('F2.1 四頁的 hreflang 是同一組五條（zh-Hant、zh、en、ja、x-default，含自己）', () => {
    const bad = [];
    for (const page of FOUR) {
        const got = links(REL_OF[page], 'alternate').filter((a) => a.hreflang);
        const map = {};
        for (const a of got) {
            const key = a.hreflang.toLowerCase();
            if (map[key]) bad.push(`${page}：hreflang="${a.hreflang}" 出現兩次`);
            map[key] = a.href;
        }
        for (const [key, href] of Object.entries(HREFLANG)) if (map[key] !== href) bad.push(`${page}：hreflang="${key}" 要指到 ${href}，得到 ${map[key] ?? '沒有'}`);
        for (const key of Object.keys(map)) if (!(key in HREFLANG)) bad.push(`${page}：多了 hreflang="${key}"`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F2.1 四頁的 canonical 指到自己的正式網址（結尾有 /、不帶 ? 與 #）', () => {
    for (const page of FOUR) {
        const got = links(REL_OF[page], 'canonical');
        assert.equal(got.length, 1, `${page}：canonical 要剛好一條，得到 ${got.length}`);
        assert.equal(got[0].href, URL_OF[page], `${page}：canonical 要是 ${URL_OF[page]}`);
        assert.ok(/\/$/.test(got[0].href) && !/[?#]/.test(got[0].href), `${page}：canonical 結尾要有 /、不帶 ? 與 #`);
    }
});

// 送出來的 HTML 裡每一個 <h1>～<h6>，照文件順序
const headings = (html) => [...html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '').matchAll(/<h([1-6])(?=[\s>])/gi)].map((m) => Number(m[1]));

test('F2.1 四頁各剛好一個 <h1>，標題不跳層（h1 → h2 → h3）', () => {
    const bad = [];
    for (const page of FOUR) {
        const levels = headings(readOut(REL_OF[page]));
        const h1 = levels.filter((n) => n === 1).length;
        if (h1 !== 1) bad.push(`${page}：<h1> 要剛好一個，得到 ${h1}`);
        if (levels[0] !== 1) bad.push(`${page}：第一個標題要是 <h1>，得到 <h${levels[0]}>`);
        levels.forEach((n, i) => { if (i > 0 && n > levels[i - 1] + 1) bad.push(`${page}：第 ${i + 1} 個標題從 <h${levels[i - 1]}> 跳到 <h${n}>`); });
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// 純文字擷取（搜尋引擎、複製貼上）時三個名字不能黏在一起
test('F2.1 「/」的 <h1> 有三語的名稱，名稱之間有分隔（純文字不黏在一起）', () => {
    const html = readOut(REL_OF.root);
    const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    assert.ok(m, '「/」要有 <h1>');
    const text = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const names = ['zh', 'en', 'ja'].map((l) => say(l, 'meta.siteName'));
    const bad = [];
    for (const n of names) if (!text.includes(n)) bad.push(`缺「${n}」`);
    for (const a of names) for (const b of names) if (a !== b && text.includes(a + b)) bad.push(`「${a}」與「${b}」黏在一起`);
    assert.deepEqual(bad, [], `<h1> 的純文字「${text}」：${bad.join('；')}`);
});

// ---------- F2.2 ----------

// 「/」的說明：三語的一句話各一行（規格書 §10.2），英、中、日依序、各自是那個語言頁的 meta.desc，用「 / 」接起來。
// 分享卡的說明只用英文那一句（規格書 §10.6、網站必備：「/」的分享卡是三語的名稱、英文說明、英文那張圖）
const ROOT_DESC = ['en', 'zh', 'ja'].map((lang) => say(lang, 'meta.desc')).join(' / ');

const OG_EXPECT = (page) => {
    if (page === 'root') {
        return {
            title: say('en', 'root.meta.title'), description: ROOT_DESC,
            'og:title': say('en', 'root.meta.title'), 'og:description': say('en', 'meta.desc'), 'og:url': URL_OF.root, 'og:locale': 'en_US',
            'og:image': `${SITE}/og/og-en.png`, 'og:image:alt': say('en', 'og.image.alt'), 'og:site_name': say('en', 'meta.siteName'),
            alternates: ['ja_JP', 'zh_TW'],
        };
    }
    return {
        title: say(page, 'meta.title'), description: say(page, 'meta.desc'),
        'og:title': say(page, 'meta.title'), 'og:description': say(page, 'meta.desc'), 'og:url': URL_OF[page], 'og:locale': OG_LOCALE[page],
        'og:image': `${SITE}/og/og-${page}.png`, 'og:image:alt': say(page, 'og.image.alt'), 'og:site_name': say(page, 'meta.siteName'),
        alternates: Object.values(OG_LOCALE).filter((l) => l !== OG_LOCALE[page]).sort(),
    };
};

test('F2.2 四頁的 <title> 與 description 照規格書 §10.2（字串表 meta.*、root.meta.title），三語頁的標題不超過長度', () => {
    const bad = [];
    for (const page of FOUR) {
        const want = OG_EXPECT(page);
        const rel = REL_OF[page];
        if (titleOf(rel) !== want.title) bad.push(`${page}：<title> 要是「${want.title}」，得到「${titleOf(rel)}」`);
        const desc = metaContent(rel, 'name', 'description');
        if (desc.length !== 1 || desc[0] !== want.description) bad.push(`${page}：description 要剛好一條「${want.description}」，得到 ${JSON.stringify(desc)}`);
        if (page === 'en' && want.title.length > 60) bad.push(`en：標題 ${want.title.length} 個字母，超過 60`);
        if ((page === 'zh' || page === 'ja') && wide(want.title) > 30) bad.push(`${page}：標題約 ${wide(want.title)} 字寬，超過 30`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F2.2 四頁的分享卡（Open Graph＋twitter:card）', () => {
    const bad = [];
    for (const page of FOUR) {
        const rel = REL_OF[page];
        const want = OG_EXPECT(page);
        const one = (prop) => {
            const got = metaContent(rel, 'property', prop);
            return got.length === 1 ? got[0] : `（${got.length} 條：${JSON.stringify(got)}）`;
        };
        const expect = {
            'og:type': 'website', 'og:site_name': want['og:site_name'], 'og:title': want['og:title'], 'og:description': want['og:description'], 'og:url': want['og:url'],
            'og:locale': want['og:locale'], 'og:image': want['og:image'], 'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/png', 'og:image:alt': want['og:image:alt'],
        };
        for (const [prop, value] of Object.entries(expect)) if (one(prop) !== value) bad.push(`${page}：${prop} 要是「${value}」，得到「${one(prop)}」`);
        const alt = metaContent(rel, 'property', 'og:locale:alternate').sort();
        if (JSON.stringify(alt) !== JSON.stringify(want.alternates)) bad.push(`${page}：og:locale:alternate 要是 ${want.alternates.join('、')}，得到 ${alt.join('、') || '沒有'}`);
        const twDesc = metaContent(rel, 'name', 'twitter:description');
        if (twDesc.length > 1 || (twDesc.length === 1 && twDesc[0] !== want['og:description'])) bad.push(`${page}：twitter:description（有放的話）要跟 og:description 一樣「${want['og:description']}」，得到 ${JSON.stringify(twDesc)}`);
        const card = metaContent(rel, 'name', 'twitter:card');
        if (card.length !== 1 || card[0] !== 'summary_large_image') bad.push(`${page}：twitter:card 要是 summary_large_image，得到 ${JSON.stringify(card)}`);
        const canonical = links(rel, 'canonical')[0]?.href;
        if (canonical && one('og:url') !== canonical) bad.push(`${page}：og:url 要跟 canonical 一樣`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F2.2 「/」可以被索引（它是 hreflang 的 x-default）：沒有 noindex', () => {
    const robots = metaContent(REL_OF.root, 'name', 'robots');
    assert.ok(!robots.some((c) => /\bnoindex\b/i.test(c)), `「/」不可以有 noindex，得到 ${JSON.stringify(robots)}`);
});

// ---------- F2.3 ----------

function jsonLd(rel) {
    const html = readOut(rel);
    const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => /type\s*=\s*["']?application\/ld\+json/i.test(m[1]));
    const nodes = [];
    const errors = [];
    for (const [i, m] of blocks.entries()) {
        if (m[2].includes('<')) errors.push(`第 ${i + 1} 段 JSON-LD 裡有「<」：要換成 \\u003c（字裡有 </script> 時會提早結束）`);
        let data;
        try {
            data = JSON.parse(m[2]);
        } catch (err) {
            errors.push(`第 ${i + 1} 段 JSON 讀不起來：${err.message}`);
            continue;
        }
        for (const item of Array.isArray(data) ? data : [data]) {
            if (!/^https?:\/\/schema\.org\/?$/.test(item['@context'] ?? '')) errors.push(`第 ${i + 1} 段的 @context 要是 https://schema.org，得到 ${item['@context']}`);
            for (const node of item['@graph'] ?? [item]) nodes.push(node);
        }
    }
    return { count: blocks.length, nodes, errors };
}

const typesOf = (node) => [].concat(node['@type'] ?? []);
const ofType = (nodes, type) => nodes.filter((n) => typesOf(n).includes(type));
const resolve = (nodes, ref) => (ref && ref['@id'] && !ref['@type'] ? nodes.find((n) => n['@id'] === ref['@id']) : ref);

for (const lang of LANGS) {
    test(`F2.3 結構化資料（${lang}）：軟體、作者、常見問題七題，跟字串表同一份，不編評分；不放 WebSite`, async () => {
        const { count, nodes, errors } = jsonLd(REL_OF[lang]);
        const bad = [...errors];
        if (!count) bad.push('<script type="application/ld+json"> 一段都沒有');
        nodes.forEach((n, i) => { if (!typesOf(n).length) bad.push(`第 ${i + 1} 個節點沒有 @type`); });

        const apps = ofType(nodes, 'SoftwareApplication');
        if (apps.length !== 1) bad.push(`SoftwareApplication 要剛好一個，得到 ${apps.length}`);
        const app = apps[0];
        if (app) {
            if (app.name !== say(lang, 'meta.siteName')) bad.push(`SoftwareApplication.name 要是「${say(lang, 'meta.siteName')}」，得到「${app.name}」`);
            if (app.description !== say(lang, 'meta.desc')) bad.push('SoftwareApplication.description 要是 meta.desc');
            if (app.applicationCategory !== 'BrowserApplication') bad.push(`applicationCategory 要是 BrowserApplication，得到 ${app.applicationCategory}`);
            const os = [].concat(app.operatingSystem ?? []).join(',').split(',').map((s) => s.trim()).filter(Boolean).sort();
            if (JSON.stringify(os) !== JSON.stringify(['Windows', 'macOS'])) bad.push(`operatingSystem 只寫 Windows、macOS，得到 ${JSON.stringify(app.operatingSystem)}`);
            const offers = [].concat(app.offers ?? []);
            if (offers.length !== 1 || !typesOf(offers[0]).includes('Offer') || Number(offers[0].price) !== 0 || !offers[0].priceCurrency) bad.push(`offers 要是一個 Offer、price 0、有 priceCurrency，得到 ${JSON.stringify(app.offers)}`);
            if (app.installUrl !== STORE_URL) bad.push(`installUrl 要是商店頁 ${STORE_URL}，得到 ${app.installUrl}`);
            const image = typeof app.image === 'string' ? app.image : app.image?.url;
            if (!image || !image.startsWith(`${SITE}/`)) bad.push(`image 要是正式網址底下的圖示，得到 ${JSON.stringify(app.image)}`);
            if ('aggregateRating' in app || 'review' in app) bad.push('不能放 aggregateRating、review（沒有真的評分）');
            const author = resolve(nodes, app.author);
            if (!author || !typesOf(author).includes('Person')) bad.push(`SoftwareApplication.author 要指到作者（Person），得到 ${JSON.stringify(app.author)}`);
        }
        if (nodes.some((n) => 'aggregateRating' in n || 'review' in n || typesOf(n).includes('Review') || typesOf(n).includes('AggregateRating'))) bad.push('任何節點都不能有評分、評論');

        const people = ofType(nodes, 'Person');
        const person = people.find((p) => p.name === say(lang, 'author.name'));
        if (!person) bad.push(`要有 Person，name＝「${say(lang, 'author.name')}」`);
        else {
            const content = await readContent(path.join(path.dirname(OUT), 'content'));
            const good = content.links.ok ? content.links.entries.filter((e) => e.ok) : [];
            const blog = good.find((e) => e.code === 'blog');
            if (blog && person.url !== blog.url) bad.push(`Person.url 要是部落格 ${blog.url}，得到 ${person.url}`);
            const all = new Set([person.url, ...[].concat(person.sameAs ?? [])]);
            for (const e of good) if (!all.has(e.url)) bad.push(`Person 的 url／sameAs 少了 ${e.code}（${e.url}）`);
        }

        if (ofType(nodes, 'WebSite').length) bad.push('語言頁不放 WebSite（網站名稱只放在首頁「/」，一個網站一個名稱）');

        const faqs = ofType(nodes, 'FAQPage');
        if (faqs.length !== 1) bad.push(`FAQPage 要剛好一個，得到 ${faqs.length}`);
        else {
            const qs = [].concat(faqs[0].mainEntity ?? []);
            if (qs.length !== 7) bad.push(`常見問題要七題，得到 ${qs.length}`);
            qs.slice(0, 7).forEach((q, i) => {
                const n = i + 1;
                if (!typesOf(q).includes('Question')) bad.push(`第 ${n} 題的 @type 要是 Question`);
                if (q.name !== say(lang, `faq.${n}.q`)) bad.push(`第 ${n} 題的 name 要跟字串表 faq.${n}.q 一樣：「${say(lang, `faq.${n}.q`)}」，得到「${q.name}」`);
                const a = q.acceptedAnswer;
                if (!a || !typesOf(a).includes('Answer')) bad.push(`第 ${n} 題的 acceptedAnswer 要是 Answer`);
                else if (a.text !== say(lang, `faq.${n}.a`)) bad.push(`第 ${n} 題的答案要跟字串表 faq.${n}.a 一樣`);
            });
        }
        if (ofType(nodes, 'VideoObject').length) bad.push('先不放 VideoObject（宣傳片還沒上 YouTube）');
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// Google〈Site names〉：WebSite 放在網域的首頁、url 是網域根、一個網站一個名稱（其他語言的名稱放 alternateName）
test('F2.3 「/」的結構化資料只有 WebSite：url 是網域根、name 是英文名稱、alternateName 是中文與日文名稱', () => {
    const { count, nodes, errors } = jsonLd(REL_OF.root);
    const bad = [...errors];
    if (!count) bad.push('「/」的 <script type="application/ld+json"> 一段都沒有');
    const others = nodes.filter((n) => !typesOf(n).includes('WebSite')).map((n) => typesOf(n).join('/') || '（沒有 @type）');
    if (others.length) bad.push(`「/」只放 WebSite（軟體、常見問題在語言頁，不重複），多了 ${others.join('、')}`);
    const sites = ofType(nodes, 'WebSite');
    if (sites.length !== 1) bad.push(`WebSite 要剛好一個，得到 ${sites.length}`);
    else {
        const site = sites[0];
        if (site.url !== URL_OF.root) bad.push(`WebSite.url 要是網域根 ${URL_OF.root}，得到 ${site.url}`);
        if (site.name !== say('en', 'meta.siteName')) bad.push(`WebSite.name 要是「${say('en', 'meta.siteName')}」，得到「${site.name}」`);
        const alt = [].concat(site.alternateName ?? []).sort();
        const want = [say('zh', 'meta.siteName'), say('ja', 'meta.siteName')].sort();
        if (JSON.stringify(alt) !== JSON.stringify(want)) bad.push(`WebSite.alternateName 要是 ${want.join('、')}，得到 ${JSON.stringify(site.alternateName)}`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F2.5 ----------

test('F2.5 404：out/404.html 在、noindex、三語各一個「回首頁」連到自己的語言頁', () => {
    const html = readOut(REL_OF[404]);
    const robots = metaContent(REL_OF[404], 'name', 'robots');
    assert.ok(robots.length === 1 && /\bnoindex\b/i.test(robots[0]), `404 的 <meta name="robots"> 要剛好一條、內容有 noindex，得到 ${JSON.stringify(robots)}`);
    const body = html.replace(/<head[\s\S]*?<\/head>/i, '');
    // 三語各一段＝每一語一個 <li lang>（solo.test.js 的介面）：<h1> 裡的三段也標 lang，但連結在 <li> 裡
    const homes = [];
    for (const lang of LANGS) {
        const secs = [...body.matchAll(new RegExp(`<li\\b[^>]*\\blang="${HTML_LANG[lang]}"[^>]*>([\\s\\S]*?)</li>`, 'gi'))];
        assert.equal(secs.length, 1, `404 要剛好一個 <li lang="${HTML_LANG[lang]}">（那一語的一段），得到 ${secs.length}`);
        const links = tagAttrs(secs[0][1], 'a').map((a) => a.href);
        assert.deepEqual(links, [`/${lang}/`], `404 的 ${lang} 那一段要剛好一個連到 /${lang}/（從根目錄算的路徑）的連結`);
        assert.ok(secs[0][1].replace(/<[^>]+>/g, '').includes(say(lang, '404.home')), `404 的 ${lang} 那一段要寫「${say(lang, '404.home')}」`);
        homes.push(links[0]);
    }
    assert.equal(new Set(homes).size, LANGS.length, `三語的「回首頁」要連到三個不同的語言頁，得到 ${homes.join('、')}`);
});

// ---------- F2.6 ----------

test('F2.6 sitemap.xml：只列三個語言頁，每一頁標五個語言版本（含自己與 x-default），不含 /', () => {
    const xml = readOut('sitemap.xml');
    assert.match(xml, /<urlset\b[^>]*xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/, 'urlset 要宣告 xmlns:xhtml');
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
    const locs = urls.map((u) => (/<loc>\s*([^<]+?)\s*<\/loc>/.exec(u) || [])[1]);
    assert.deepEqual([...locs].sort(), [URL_OF.en, URL_OF.ja, URL_OF.zh], `<loc> 要剛好是三個語言頁，得到 ${locs.join('、')}`);
    for (const [i, u] of urls.entries()) {
        const alt = Object.fromEntries(tagAttrs(u, 'xhtml:link').filter((a) => a.rel === 'alternate').map((a) => [a.hreflang.toLowerCase(), a.href]));
        assert.deepEqual(alt, HREFLANG, `${locs[i]} 的 xhtml:link 要是那五條，得到 ${JSON.stringify(alt)}`);
    }
});

test('F2.6 robots.txt：全部允許（AI 爬蟲也是），有 Sitemap 一行', () => {
    const txt = readOut('robots.txt');
    const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
    assert.ok(lines.some((l) => /^user-agent:\s*\*$/i.test(l)), '要有 User-agent: *');
    const disallow = lines.filter((l) => /^disallow:\s*\S/i.test(l));
    assert.deepEqual(disallow, [], `不能擋任何東西（含 GPTBot、ClaudeBot、PerplexityBot 這類 AI 爬蟲），得到 ${disallow.join('；')}`);
    assert.ok(lines.some((l) => l === `Sitemap: ${SITE}/sitemap.xml`), `要有一行 Sitemap: ${SITE}/sitemap.xml`);
});

// ---------- F2.7 ----------

const MANIFEST_OF = { zh: '/zh/site.webmanifest', en: '/en/site.webmanifest', ja: '/ja/site.webmanifest', root: '/en/site.webmanifest', 404: '/en/site.webmanifest' };

test('F2.7 五頁的 <head>：16、32 的 PNG 小圖、apple-touch-icon、manifest、theme-color，不連 SVG 小圖', () => {
    const bad = [];
    for (const page of FIVE) {
        const rel = REL_OF[page];
        const icons = links(rel, 'icon');
        const find = (href) => icons.find((a) => a.href === href);
        const i32 = find('/favicon-32.png');
        const i16 = find('/favicon-16.png');
        if (!i32 || i32.type !== 'image/png' || i32.sizes !== '32x32') bad.push(`${page}：要有 <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">，得到 ${JSON.stringify(i32)}`);
        if (!i16 || i16.type !== 'image/png' || i16.sizes !== '16x16') bad.push(`${page}：要有 <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">，得到 ${JSON.stringify(i16)}`);
        const svg = icons.filter((a) => /svg/i.test(a.type || '') || /\.svg(\?|$)/i.test(a.href || ''));
        if (svg.length) bad.push(`${page}：不連 SVG 的小圖（一倍螢幕會被拿去畫 16px），得到 ${JSON.stringify(svg)}`);
        const apple = links(rel, 'apple-touch-icon');
        if (apple.length !== 1 || apple[0].href !== '/apple-touch-icon.png') bad.push(`${page}：apple-touch-icon 要剛好一條指到 /apple-touch-icon.png，得到 ${JSON.stringify(apple)}`);
        const manifest = links(rel, 'manifest');
        if (manifest.length !== 1 || manifest[0].href !== MANIFEST_OF[page]) bad.push(`${page}：manifest 要剛好一條指到 ${MANIFEST_OF[page]}，得到 ${JSON.stringify(manifest)}`);
        const theme = metaContent(rel, 'name', 'theme-color');
        if (theme.length !== 1 || theme[0].toLowerCase() !== THEME) bad.push(`${page}：theme-color 要剛好一條 ${THEME}，得到 ${JSON.stringify(theme)}`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

const ICONS = [
    { file: 'favicon-16.png', size: 16, corner: 0 },
    { file: 'favicon-32.png', size: 32, corner: 0 },
    { file: 'apple-touch-icon.png', size: 180, corner: 255 },
    { file: 'icon-192.png', size: 192, corner: 0 },
    { file: 'icon-512.png', size: 512, corner: 0 },
    { file: 'icon-maskable-192.png', size: 192, corner: 255 },
    { file: 'icon-maskable-512.png', size: 512, corner: 255 },
];
const pngSize = (buf) => (buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null);

test('F2.7 out/ 的圖示檔都在、寬高對；16、32 跟擴充的同一組', () => {
    needOut();
    const bad = [];
    for (const { file, size } of ICONS) {
        const full = path.join(OUT, file);
        if (!fs.existsSync(full)) { bad.push(`out/${file} 不在`); continue; }
        const got = pngSize(fs.readFileSync(full));
        if (!got || got[0] !== size || got[1] !== size) bad.push(`out/${file} 要是 ${size}×${size} 的 PNG，得到 ${got ? got.join('×') : '不是 PNG'}`);
    }
    const clipperIcons = path.join(path.dirname(OUT), '..', '..', 'clipper', 'icons');
    if (fs.existsSync(clipperIcons)) {
        for (const n of [16, 32]) {
            const site = path.join(OUT, `favicon-${n}.png`);
            if (fs.existsSync(site) && !fs.readFileSync(site).equals(fs.readFileSync(path.join(clipperIcons, `icon-${n}.png`)))) bad.push(`out/favicon-${n}.png 要跟擴充的 clipper/icons/icon-${n}.png 位元組一樣（${n === 16 ? '16 是畫在 16 格線上的那一組，不是縮出來的' : '同一個記號'}）`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

for (const lang of LANGS) {
    test(`F2.7 site.webmanifest（${lang}）`, () => {
        const text = readOut(`${lang}/site.webmanifest`);
        let m;
        assert.doesNotThrow(() => { m = JSON.parse(text); }, `${lang}/site.webmanifest 要是 JSON`);
        const bad = [];
        const expect = { name: say(lang, 'nav.brand'), short_name: say(lang, 'manifest.shortName'), lang: HTML_LANG[lang], start_url: `/${lang}/`, scope: '/', display: 'browser', theme_color: THEME, background_color: THEME };
        for (const [k, v] of Object.entries(expect)) if (String(m[k]).toLowerCase() !== v.toLowerCase()) bad.push(`${k} 要是「${v}」，得到「${m[k]}」`);
        const icons = (m.icons ?? []).map((i) => `${i.src} ${i.sizes} ${i.type} ${i.purpose}`).sort();
        const want = ['/icon-192.png 192x192 image/png any', '/icon-512.png 512x512 image/png any', '/icon-maskable-192.png 192x192 image/png maskable', '/icon-maskable-512.png 512x512 image/png maskable'].sort();
        if (JSON.stringify(icons) !== JSON.stringify(want)) bad.push(`icons 要是那四個，得到 ${JSON.stringify(icons)}`);
        for (const i of m.icons ?? []) if (!fs.existsSync(path.join(OUT, i.src.replace(/^\//, '')))) bad.push(`icons 的 ${i.src} 不在 out/`);
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

test('F2.7 圖示的四個角：小圖與 192、512 透明，apple-touch-icon 與 maskable 不透明', { skip: pw ? false : why }, async () => {
    needOut();
    const { browser } = await session.get();
    const page = await browser.newPage();
    const bad = [];
    try {
        for (const { file, size, corner } of ICONS) {
            const full = path.join(OUT, file);
            if (!fs.existsSync(full)) { bad.push(`out/${file} 不在`); continue; }
            const url = `data:image/png;base64,${fs.readFileSync(full).toString('base64')}`;
            const alphas = await page.evaluate(async ({ url, size }) => {
                const img = new Image();
                img.src = url;
                await img.decode();
                const c = document.createElement('canvas');
                c.width = size;
                c.height = size;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                return [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]].map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3]);
            }, { url, size });
            if (!alphas.every((a) => a === corner)) bad.push(`out/${file} 四個角的 alpha 要都是 ${corner}（${corner ? '不透明' : '透明'}），得到 ${alphas.join('、')}`);
        }
    } finally {
        await page.close();
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});
