// 從設計稿重新產生測試的對照資料（不是測試，測試套件不會跑它；設計稿改版時手動跑一次）。
//
// 設計稿不在這個 repo 裡，要從別的地方取得一份 checkout（或某個 commit 的快照）。這支程式要的是那份 checkout 的根目錄：
// 三語的頁面在 <根目錄>/<--page>/{zh,en,ja}/index.html，頁面用相對路徑連到同一個根目錄底下的 CSS 與字型，所以整個根目錄都要在，
// 字型（拉丁的 Google Sans Flex、等寬的 JetBrains Mono）也要在 —— 少了字型量出來的寬度會差幾 px，這支程式量之前會檢查，沒載到就停。
// 例如用 git 取某個 commit 的快照：git archive <commit> <設計稿資料夾> <它連到的 CSS 與字型資料夾> | tar -x -C <暫存資料夾>
//
// 跑法（在網站資料夾，也就是 tests-site 的上一層）：
//   node tests-site/tools/measure-design.mjs --root <設計稿根目錄> --commit <設計稿的 commit> [--page <頁面所在的資料夾，預設 design/homepage>]
//        [--lines <逐行表輸出檔>] [--lines07 <07 的逐行表輸出檔>] [--positions <位置與樣子輸出檔>] [--only f8 [--lines1016 <檔>] [--boxes <檔>]]
//   Playwright 照測試的找法（SITE_PLAYWRIGHT 環境變數，或 clipper/node_modules/playwright）。
//
// 輸出（預設寫進 tests-site/fixtures/）：
//   --lines      預設 fixtures/design-lines-03-04.json：03 首屏、04 每個文字區塊的每一行（F4.4、F4b.6 讀）。
//                lines＝有滑鼠、三語 × 十二種寬度（高 900）；touch＝只有手指（isMobile＋hasTouch，高 844）、320～430 的手指框。鍵是字串表的 id。
//   --lines07    預設 fixtures/design-lines-07.json：07 為 AI 做的每個文字區塊的每一行（F5.4 讀），有滑鼠、三語 × 十二種寬度。
//   --lines0515  預設 fixtures/design-lines-05-15.json：05 三步驟、06 能收什麼、08 隱私、15 最後的安裝每個文字區塊的每一行（F6.5 讀）；
//                lines＝有滑鼠、三語 × 十二種寬度；touch＝只有手指 320～430 時 15 區手指框的說明與「用的是電腦？」。
//   --lines09    預設 fixtures/design-lines-09.json：09 教學影片每個文字區塊的每一行（F7.5 讀），有滑鼠、三語 × 十二種寬度，09 的 <details> 全打開；
//                設計稿頁面上的 09 是「有影片」的樣子（大標 tutorial.title），章名與摘要的鍵是 ch.NN.name／ch.NN.desc。
//   --positions  預設 fixtures/design-<commit>.json：bulletin（02 公告條整條高與「公告」標籤、標題、✕ 的 [x, y, 寬, 高]，有滑鼠、高 900，F3.11 讀）、
//                shareBottom（只有手指 360×780 時手指框主要按鈕的下緣，F3.11）、links（首屏與 04 每個連結每個字有沒有底線，F4.11）、
//                press（只有手指 390、強制 :active 時十個元件的樣子，F4b.4）、
//                zeros（04「擴充本身」三格的字右緣到下一格分隔線的距離與單位排成幾行，mouse＝有滑鼠十二種寬度、touch＝只有手指 280～1280，F4.12）、
//                forai（07 四點前面括號記號的寬高、AI 工具小標籤的圓角，F5.2）、
//                tree（07 資料夾樹的幾何：page-helpers.js 的 TREE_GEOMETRY，mouse＝有滑鼠十二種寬度、touch＝只有手指 280～1280，F5.6、F5.8 與樹的排法）、
//                cards（05 的步驟、06 與 08 的卡片：page-helpers.js 的 CARD_GEOMETRY，有滑鼠十二種寬度，F6.1、F6.5）、
//                cardsTouch（只有手指 280～430 時 15 區的手指框，同一套量法，F6.5）、
//                chapters（09 章節那幾列：page-helpers.js 的 CHAPTER_GEOMETRY，有滑鼠十二種寬度、09 的 <details> 全打開，F7.5 字到邊）。
//   --only f8    只量 10 支援裝置、11 公告、12 更新紀錄、13 常見問題、14 作者與社群、16 頁尾（F8.6 讀），其他幾份不動：
//                --lines1016 預設 fixtures/design-lines-10-16.json：這幾區版型裡的字（字串表的 id）每一行，有滑鼠、三語 × 十二種寬度，13 的 <details> 全打開；
//                --boxes     預設 fixtures/design-f8-<commit>.json：boxes＝每一段字（與 14 的照片）離那一區外框左上角的 [x, y, 寬, 高]（page-helpers.js 的 BOXES，13 照預設只打開第一題）；
//                            gaps＝框裡的字到框的內緣，左右與上下分開（EDGE_GAPS）：10 的卡片、11 的公告卡、標籤（已實測、最新、置頂）、14 的「到部落格看更多」，
//                            與狀態一覽裡畫的「看更早的」按鈕、四種「這一條讀不到」的虛線框（正式那一段沒有這幾樣）。
//   --only f9    只量 07 右邊放大綱圖的框（AI 開始打字的位置）與靜態大綱圖上字的位置（打完要對得上）：寫 --f9 預設 fixtures/design-f9-<commit>.json（F9 讀，typing.test.js），其他幾份不動。
//   --only solo  只量「/」三語選單頁與 404（<--page>/root/、<--page>/404/ 的 index.html），寫 --solo 預設 fixtures/design-solo-<commit>.json（F8.6b 讀，solo.test.js）。
//   測試是照檔名讀位置那一份的（bulletin-layout、underline、touch、where-zeros、forai、forai-tree、cards、tutorial 八支），換了 commit 要一起改那幾支裡的檔名。
//   量法跟測試同一套（page-helpers.js 的 textLines、LINK_DECORATION、pressStyles），都用減少動態開頁。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '../helpers.js';
import { serve } from '../server.js';
import { textLines, WIDTHS, LINK_DECORATION, pressStyles, ZERO_GAPS, TREE_GEOMETRY, CARD_GEOMETRY, CHAPTER_GEOMETRY, BOXES, EDGE_GAPS, soloItems, SOLO_BUTTONS, LINEBOX_GAPS, CONTRAST } from '../page-helpers.js';
import { getPlainString } from '../../app/strings.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, '..', 'fixtures');

function args(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i += 2) {
        if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`參數不對：${argv[i]}（要 --名字 值）`);
        out[argv[i].slice(2)] = argv[i + 1];
    }
    return out;
}

const opt = args(process.argv.slice(2));
if (!opt.root || !opt.commit) {
    console.error('要 --root <設計稿根目錄> 與 --commit <設計稿的 commit>（見檔頭）');
    process.exit(1);
}
const ROOT = path.resolve(opt.root);
const PAGE = (opt.page ?? 'design/homepage').replace(/^\/+|\/+$/g, '');
const OUT_LINES = path.resolve(opt.lines ?? path.join(FIXTURES, 'design-lines-03-04.json'));
const OUT_POS = path.resolve(opt.positions ?? path.join(FIXTURES, `design-${opt.commit}.json`));
const OUT_LINES07 = path.resolve(opt.lines07 ?? path.join(FIXTURES, 'design-lines-07.json'));
const OUT_LINES0515 = path.resolve(opt.lines0515 ?? path.join(FIXTURES, 'design-lines-05-15.json'));
const OUT_LINES09 = path.resolve(opt.lines09 ?? path.join(FIXTURES, 'design-lines-09.json'));
const LANGS = ['zh', 'en', 'ja'];
for (const lang of LANGS) {
    if (!fs.existsSync(path.join(ROOT, PAGE, lang, 'index.html'))) throw new Error(`找不到設計稿頁面：${path.join(ROOT, PAGE, lang, 'index.html')}`);
}

// 設計稿的 class → 字串表的 id（同一個選擇器有幾個 id 就照順序取第幾個）
const LINES_MAP = [['.hero__kicker', ['hero.kicker']], ['.hero__title', ['hero.title']], ['.hero__sub', ['hero.sub']], ['.hero__meta p', ['hero.meta.free', 'hero.meta.os']],
    ['.hero__meta .link', ['hero.meta.devices']], ['.hero .vdesc summary', ['hero.video.label']], ['.hero .vdesc p', ['hero.video.desc']],
    ['.where .label', ['where.label', 'zeros.cap']], ['.where__list li', ['where.chatgpt', 'where.claude', 'where.perplexity', 'where.web']],
    ['.zero__unit', ['zeros.server', 'zeros.account', 'zeros.tracking']]];
const TOUCH_MAP = [['.hero__touch p', ['hero.mobile.text']], ['.hero__touch .touch__pc', ['hero.pc']]];
const MAP_0515 = [['.how .shead__title', ['how.title']], ['.how .shead__lead', ['how.pain']], ['.step__title', ['how.1.title', 'how.2.title', 'how.3.title']], ['.step__body', ['how.1.body', 'how.2.body', 'how.3.body']],
    ['.features .shead__title', ['features.title']], ['.features .card__title', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `features.${n}.title`)], ['.features .card__body', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `features.${n}.body`)],
    ['.features .card__more', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `features.${n}.more`)],
    ['.privacy .shead__title', ['privacy.title']], ['.privacy .shead__lead', ['privacy.lead']], ['.privacy .card__title', [1, 2, 3, 4].map((n) => `privacy.${n}.title`)], ['.privacy .card__body', [1, 2, 3, 4].map((n) => `privacy.${n}.body`)],
    ['.privacy .sec__body > p a', ['privacy.link']], ['.final__title', ['final.title']], ['.final__meta', ['final.meta']], ['.final__cta', ['final.cta']]];
const TOUCH_0515 = [['.final__touch > p', ['final.mobile.lead']], ['.final__touch .touch__pc', ['final.pc']]];
const CARDS = { how: 'main .how .step', features: 'main .features .card', privacy: 'main .privacy .card' };
const CH = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'));
const MAP_09 = [['.tutorial .eyebrow', ['tutorial.eyebrow']], ['.tutorial .shead__title', ['tutorial.title']], ['.tutorial .shead__lead', ['tutorial.lead']], ['.tutorial .player__yt', ['tutorial.youtube']],
    ['.tutorial .chapters__head .label', ['tutorial.chapters', 'tutorial.total']], ['.tutorial .chapters__all', ['tutorial.showAll']],
    ['.tutorial .ch__name', CH.map((n) => `ch.${n}.name`)], ['.tutorial .ch__desc', CH.map((n) => `ch.${n}.desc`)]];
const FORAI_MAP = [['.forai .eyebrow', ['forai.eyebrow']], ['.forai__title', ['forai.title']], ['.points li', ['forai.1', 'forai.2', 'forai.3', 'forai.4']]];
const TOUCH_WIDTHS = [320, 360, 375, 390, 414, 430];
const BULLETIN_WIDTHS = [280, 320, 360, 375, 390, 430, 640, 768, 1024, 1280, 1440];
// 「按下」的十個元件（名字是 touch.test.js 的 F4b.4 用的鍵）
const PRESS = {
    primary: 'main .hero__touch .btn--primary', secondary: 'main .hero__touch .btn--secondary', menu: 'header .nav__menu',
    close: '.bulletin:not(.bulletin--static) .bulletin__close', social: '#menu .socials a', play: 'main .hero .play',
    lang: '#menu .lang a:not([aria-current])', link: 'main .hero__touch .touch__pc', navlink: '#menu .menu__links a', summary: 'main .hero .vdesc summary',
};
const TOUCH = { isMobile: true, hasTouch: true };
const ZERO_TOUCH_WIDTHS = [280, 320, 360, 375, 390, 430, 480, 540, 640, 768, 1024, 1280];

const { pw, why } = playwright();
if (!pw) throw new Error(why);
const site = await serve(ROOT);
const browser = await pw.chromium.launch();

async function open(lang, width, height, extra = {}) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', ...extra });
    const page = await context.newPage();
    await page.goto(`${site.url}/${PAGE}/${lang}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
    if (!loaded.includes('Google Sans Flex') || !loaded.includes('JetBrains Mono')) throw new Error(`${lang} ${width}：設計稿的網頁字型沒載到（${loaded.join('、') || '一個都沒有'}），根目錄底下要有它連到的字型`);
    return { context, page };
}

async function lines(lang, width, height, extra, map, opened = '.hero details') {
    const { context, page } = await open(lang, width, height, extra);
    try {
        await page.evaluate((sel) => { for (const d of document.querySelectorAll(sel)) d.open = true; }, opened);
        const got = {};
        for (const [selector, ids] of map) {
            const loc = page.locator(`main ${selector}`);
            for (let i = 0; i < ids.length; i += 1) got[ids[i]] = await textLines(loc.nth(i));
        }
        return got;
    } finally {
        await context.close();
    }
}

// 10～16：設計稿那一區的選擇器、區裡的 class → 鍵（字串表的 id；同一個 id 第二次寫成 id#2；author.photo 是照片）
const SEVEN = [1, 2, 3, 4, 5, 6, 7];
const REQ = ['browser', 'ai', 'web', 'lang', 'price'];
const F8_DESIGN = {
    devices: ['main .devices', [['.eyebrow', ['devices.eyebrow']], ['.shead__title', ['devices.title']], ['.shead__lead', ['devices.lead']],
        ['.card__title', ['devices.win', 'devices.mac', 'devices.mobile', 'devices.other']], ['.card__body', ['devices.chrome', 'devices.chrome#2', 'devices.mobile.why', 'devices.other.why']],
        ['.card__note', ['devices.tested', 'devices.tested#2']], ['.req dt', REQ.map((r) => `req.${r}.label`)], ['.req dd', REQ.map((r) => `req.${r}`)]]],
    news: ['main .news-sec', [['.eyebrow', ['news.eyebrow']], ['.shead__title', ['news.title']]]],
    changelog: ['main .changelog', [['.eyebrow', ['changelog.eyebrow']], ['.shead__title', ['changelog.title']], ['.shead__lead', ['changelog.lead']]]],
    faq: ['main .faq', [['.eyebrow', ['faq.eyebrow']], ['.shead__title', ['faq.title']], ['.qa__h', SEVEN.map((n) => `faq.${n}.q`)], ['.qa__a p', SEVEN.map((n) => `faq.${n}.a`)]]],
    author: ['main .author', [['.author__photo', ['author.photo']], ['.eyebrow', ['author.eyebrow']], ['.author__name', ['author.name']], ['.author__bio p', ['author.bio.1', 'author.bio.2']], ['.author__blog', ['author.blog']]]],
    footer: ['footer.foot', [['.brand__name', ['foot.brand']], ['.foot__line', ['foot.line']], ['.foot__h', ['foot.product', 'foot.help']],
        ['.foot__link', ['foot.store', 'foot.tutorial', 'foot.changelog', 'foot.privacy', 'foot.faq', 'foot.report', 'foot.blog']], ['.foot__legal p', ['foot.affiliation', 'foot.analytics', 'foot.copyright']]]],
};
const F8_GAPS = { devicesCard: 'main .devices .card', newsCard: 'main .news-sec .card', tested: 'main .devices .card__note', latest: 'main .changelog .rel__new', pinned: 'main .news-sec .news__pin',
    blog: 'main .author__blog', older: '.states details.older > .older__btn', badCard: '.states .card--bad', badInline: '.states .bad--inline', badSection: '.states .bad--section', badSocial: '.states .bad--social' };

async function measureF8() {
    const OUT_L = path.resolve(opt.lines1016 ?? path.join(FIXTURES, 'design-lines-10-16.json'));
    const OUT_B = path.resolve(opt.boxes ?? path.join(FIXTURES, `design-f8-${opt.commit}.json`));
    const stamp = `設計稿 ${PAGE}/{zh,en,ja}/index.html，commit ${opt.commit}；${new Date().toISOString().slice(0, 10)} 用 tests-site/tools/measure-design.mjs --only f8 量的（本機伺服器開、Playwright 的 Chromium、減少動態、有滑鼠、高 900，量之前確認 Google Sans Flex 與 JetBrains Mono 都載好了）。`;
    const L = { source: `${stamp}10、11、12 的標題、13、14、16 版型裡的字每一行（13 的 <details> 全打開）。鍵是字串表的 id；同一個 id 第二次出現寫成 id#2。`, lines: {} };
    const B = { source: `${stamp}boxes：每一段字離那一區外框左上角的 [x, y, 寬, 高]（BOXES；13 只打開第一題，跟網站的預設一樣）；gaps：框裡的字到框內緣（EDGE_GAPS：左右、上下分開的內距與字到框內緣的距離），「看更早的」與「這一條讀不到」量的是狀態一覽裡畫的那幾個。`, boxes: {}, gaps: {} };
    for (const lang of LANGS) {
        L.lines[lang] = {};
        B.boxes[lang] = {};
        B.gaps[lang] = {};
        for (const width of WIDTHS) {
            const { context, page } = await open(lang, width, 900);
            try {
                B.boxes[lang][width] = {};
                for (const [name, [section, map]] of Object.entries(F8_DESIGN)) {
                    const items = map.flatMap(([sel, keys]) => keys.map((key, nth) => ({ key, sel, nth })));
                    const got = await page.evaluate(BOXES, { section, items });
                    if (!got) throw new Error(`${lang} ${width}：設計稿裡找不到 ${name}（${section}）`);
                    for (const [key, box] of Object.entries(got)) if (!box) throw new Error(`${lang} ${width}：設計稿的 ${name} 裡找不到 ${key}`);
                    Object.assign(B.boxes[lang][width], got);
                }
                B.gaps[lang][width] = {};
                for (const [name, sel] of Object.entries(F8_GAPS)) B.gaps[lang][width][name] = await page.evaluate(EDGE_GAPS, sel);
                await page.evaluate(() => { for (const d of document.querySelectorAll('main .faq details')) d.open = true; });
                L.lines[lang][width] = {};
                for (const [, [section, map]] of Object.entries(F8_DESIGN)) {
                    for (const [sel, keys] of map) {
                        for (let i = 0; i < keys.length; i += 1) if (keys[i] !== 'author.photo') L.lines[lang][width][keys[i]] = await textLines(page.locator(`${section} ${sel}`).nth(i));
                    }
                }
            } finally {
                await context.close();
            }
        }
    }
    fs.writeFileSync(OUT_L, JSON.stringify(L, null, 1) + '\n');
    fs.writeFileSync(OUT_B, JSON.stringify(B, null, 1) + '\n');
    console.log(`寫好了：${path.relative(process.cwd(), OUT_L)}、${path.relative(process.cwd(), OUT_B)}`);
}

// 「/」三語選單頁與 404（設計稿 <PAGE>/root/、<PAGE>/404/ 的 index.html）：十二種寬度、高 900、有滑鼠、減少動態。
// boxes＝每一塊離 <main> 左上角的 [x, y, 寬, 高]（BOXES）；lines＝大標三段、說明三段、按鈕三顆（與 404 的「404」）每一行；
// gaps＝三顆按鈕的字到框內緣（EDGE_GAPS 字形框）、lineGaps＝同上用行盒量（LINEBOX_GAPS）；contrast＝字對底的對比（CONTRAST，記號不算）。
async function measureSolo() {
    const OUT_S = path.resolve(opt.solo ?? path.join(FIXTURES, `design-solo-${opt.commit}.json`));
    const S = { source: `設計稿 ${PAGE}/root/index.html 與 ${PAGE}/404/index.html，commit ${opt.commit}；${new Date().toISOString().slice(0, 10)} 用 tests-site/tools/measure-design.mjs --only solo 量的（本機伺服器開、Playwright 的 Chromium、減少動態、有滑鼠、高 900，量之前確認 Google Sans Flex 載好了，404 另外確認 JetBrains Mono）。boxes：離 <main> 左上角的 [x, y, 寬, 高]；lines：每一行；gaps／lineGaps：三顆按鈕的字到框內緣（字形框／行盒）；contrast：字對底的對比。鍵見 page-helpers.js 的 soloItems。`, pages: {} };
    for (const name of ['root', '404']) {
        const file = path.join(ROOT, PAGE, name, 'index.html');
        if (!fs.existsSync(file)) throw new Error(`找不到設計稿頁面：${file}`);
        S.pages[name] = {};
        const items = soloItems(name);
        for (const width of WIDTHS) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            try {
                await page.goto(`${site.url}/${PAGE}/${name}/index.html`, { waitUntil: 'load' });
                await page.evaluate(() => document.fonts.ready);
                const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
                const need = name === '404' ? ['Google Sans Flex', 'JetBrains Mono'] : ['Google Sans Flex'];
                for (const f of need) if (!loaded.includes(f)) throw new Error(`${name} ${width}：設計稿的網頁字型 ${f} 沒載到（${loaded.join('、') || '一個都沒有'}）`);
                const boxes = await page.evaluate(BOXES, { section: 'main', items });
                for (const [key, box] of Object.entries(boxes)) if (!box) throw new Error(`${name} ${width}：設計稿裡找不到 ${key}`);
                const lines = {};
                for (const { key, sel, nth } of items) if (key !== 'mark') lines[key] = await textLines(page.locator(`main ${sel}`).nth(nth));
                S.pages[name][width] = {
                    boxes, lines,
                    gaps: await page.evaluate(EDGE_GAPS, SOLO_BUTTONS),
                    lineGaps: await page.evaluate(LINEBOX_GAPS, SOLO_BUTTONS),
                    contrast: await page.evaluate(CONTRAST, items.filter((i) => i.key !== 'mark')),
                };
            } finally {
                await context.close();
            }
        }
    }
    fs.writeFileSync(OUT_S, JSON.stringify(S, null, 1) + '\n');
    console.log(`寫好了：${path.relative(process.cwd(), OUT_S)}`);
}

// 07 右邊「AI 開始打字」那個框（設計稿的 .forai__shot：放靜態大綱圖、四個括號角的那個框）：三語 × 十二種寬度、高 900、有滑鼠、減少動態。
// frame＝框離 07 那一區（main .forai）左上角的 [x, y, 寬, 高]（BOXES）；section＝07 那一區自己的 [寬, 高]。打字的時候、打完之後框都要在這個位置、這個大小（F9.1、F9.3 讀，typing.test.js）。
// 框裡面打字的樣子（字級、內距、內容比框多時怎麼辦）設計稿還沒畫，這裡不量。
async function measureF9() {
    const OUT_F = path.resolve(opt.f9 ?? path.join(FIXTURES, `design-f9-${opt.commit}.json`));
    const F = { source: `設計稿 ${PAGE}/{zh,en,ja}/index.html，commit ${opt.commit}；${new Date().toISOString().slice(0, 10)} 用 tests-site/tools/measure-design.mjs --only f9 量的（本機伺服器開、Playwright 的 Chromium、減少動態、有滑鼠、高 900，量之前確認 Google Sans Flex 與 JetBrains Mono 都載好了）。frame：07 放大綱圖的框（.forai__shot）離 07 左上角的 [x, y, 寬, 高]；section：07 的 [寬, 高]；show：框露出原圖的哪一塊（窄、640 起）；imageText：靜態大綱圖上第一行字的左緣、上緣、下緣（原圖的像素座標）。`, frame: {}, section: {} };
    for (const lang of LANGS) {
        F.frame[lang] = {};
        F.section[lang] = {};
        for (const width of WIDTHS) {
            const { context, page } = await open(lang, width, 900);
            try {
                const got = await page.evaluate(BOXES, { section: 'main .forai', items: [{ key: 'frame', sel: '.forai__shot', nth: 0 }] });
                if (!got || !got.frame) throw new Error(`${lang} ${width}：設計稿裡找不到 07 的框（main .forai .forai__shot）`);
                F.frame[lang][width] = got.frame;
                F.section[lang][width] = await page.evaluate(() => { const r = document.querySelector('main .forai').getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; });
            } finally {
                await context.close();
            }
        }
    }
    // 靜態大綱圖上的字（原圖 1920×1080 的像素座標）：<--page>/assets/ai-outline-<語言>.png，只看框露出的那一塊（x 300～1310）、檔名列以下（y ≥ 200）。
    // 亮度 > 110 的點算字；left＝第一個寬 ≥ 6px 的字欄（左邊 3px 寬的螢光綠標記條、暗灰的行號不算），top／firstBottom＝第一行字的上下緣。
    F.show = { narrow: { x: 300, y: 143, width: 640, height: 540 }, wide: { x: 300, y: 143, width: 1010, height: 560 }, wideFrom: 640 };
    F.imageText = {};
    const page = await browser.newPage();
    try {
        for (const lang of LANGS) {
            await page.goto(`${site.url}/${PAGE}/assets/ai-outline-${lang}.png`);
            F.imageText[lang] = await page.evaluate(async () => {
                const img = document.querySelector('img');
                await img.decode();
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0);
                const px = g.getImageData(0, 0, c.width, c.height).data;
                const lit = (x, y) => { const i = (y * c.width + x) * 4; return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] > 110; };
                const X0 = 300, X1 = 1310, Y0 = 200, Y1 = 703;
                const cols = [];
                for (let x = X0; x < X1; x += 1) { let n = 0; for (let y = Y0; y < Y1; y += 1) if (lit(x, y)) n += 1; cols.push(n > 2); }
                let left = null;
                for (let i = 0; i < cols.length && left === null; i += 1) { if (!cols[i]) continue; let j = i; while (j < cols.length && cols[j]) j += 1; if (j - i >= 6) left = X0 + i; i = j; }
                let top = null;
                let bottom = null;
                for (let y = Y0; y < Y1; y += 1) {
                    let n = 0;
                    for (let x = left; x < X1; x += 1) if (lit(x, y)) n += 1;
                    if (n > 2 && top === null) top = y;
                    if (top !== null && n <= 2) { bottom = y - 1; break; }
                }
                return { left, top, firstBottom: bottom };
            });
        }
    } finally {
        await page.close();
    }
    fs.writeFileSync(OUT_F, JSON.stringify(F, null, 1) + '\n');
    console.log(`寫好了：${path.relative(process.cwd(), OUT_F)}`);
}

if (opt.only === 'f9') {
    try {
        await measureF9();
    } finally {
        await browser.close();
        await site.close();
    }
    process.exit(0);
}

if (opt.only === 'solo') {
    try {
        await measureSolo();
    } finally {
        await browser.close();
        await site.close();
    }
    process.exit(0);
}

if (opt.only === 'f8') {
    try {
        await measureF8();
    } finally {
        await browser.close();
        await site.close();
    }
    process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const how = `設計稿 ${PAGE}/{zh,en,ja}/index.html，commit ${opt.commit}；${today} 用 tests-site/tools/measure-design.mjs 量的（本機伺服器開、Playwright 的 Chromium、減少動態，量之前確認 Google Sans Flex 與 JetBrains Mono 都載好了）。`;
const L515 = { source: `${how}lines：有滑鼠，三語 × 十二種寬度（高 900）；touch：只有手指（isMobile＋hasTouch，高 844），320～430 的 15 區手指框。05、06、08、15 的標題、說明、卡片、按鈕。06 的「看教學 NN」鍵是 features.N.more（字串表是一條 features.more 代入章號）。鍵是字串表的 id。`, lines: {}, touch: {} };
const L9 = { source: `${how}有滑鼠，三語 × 十二種寬度（高 900）；09 教學影片（頁面上那一份＝有影片的樣子）：小標、大標、說明、在 YouTube 上看、章節標頭、看全部、16 章的章名與摘要。量之前 09 裡每一個 <details> 都打開（摘要、看全部）。「看全部」在 1024 起是藏起來的（空陣列）。鍵是字串表的 id（章名、摘要是 ch.NN.name／desc，字跟 data/chapters.*.json 一樣）。`, lines: {} };
const L7 = { source: `${how}有滑鼠，三語 × 十二種寬度（高 900）；07 為 AI 做的：小標、大標、四點。鍵是字串表的 id。`, lines: {} };
const L = { source: `${how}lines：有滑鼠，三語 × 十二種寬度（高 900）；touch：只有手指（isMobile＋hasTouch，高 844），320～430 六種寬度頁面上的手指框。<details> 全打開。鍵是字串表的 id。`, lines: {}, touch: {} };
const P = { source: `${how}bulletin：02 公告條整條高與「公告」標籤、標題、✕ 的 [x, y, 寬, 高]（有滑鼠、高 900）；shareBottom：只有手指 360×780 時手指框主要按鈕的下緣；links：首屏與 04 每個連結每個字有沒有底線（mouse＝有滑鼠 1440、touch＝只有手指 390）；press：只有手指 390、強制 :active 時十個元件的樣子（normal＝平常、active＝按下）；zeros：04「擴充本身」每一格的 { gap：字右緣到下一格分隔線（最後一格到這一欄右緣）, lines：單位排成幾行 }（mouse＝有滑鼠、高 900，touch＝只有手指、高 844）；forai：07 四點括號記號的寬高與小標籤圓角；tree：07 資料夾樹的幾何（TREE_GEOMETRY，mouse 與 touch 同上）；cards：05 的步驟、06 與 08 的卡片（CARD_GEOMETRY：第一排幾張、寬、內距、字到卡片內緣最近的距離），有滑鼠、高 900；cardsTouch：只有手指 280～430 時 15 區的手指框（同一套量法）；chapters：09 章節那幾列（CHAPTER_GEOMETRY：左內距、字到列左緣、字到摘要開關、超出捲動容器的字），有滑鼠十二種寬度、09 的 <details> 全打開。`, bulletin: {}, shareBottom: {}, links: {}, press: {}, zeros: {}, tree: {} };

try {
    for (const lang of LANGS) {
        L.lines[lang] = {};
        L.touch[lang] = {};
        for (const width of WIDTHS) L.lines[lang][width] = await lines(lang, width, 900, {}, LINES_MAP);
        for (const width of TOUCH_WIDTHS) L.touch[lang][width] = await lines(lang, width, 844, TOUCH, TOUCH_MAP);
        L515.lines[lang] = {};
        L515.touch[lang] = {};
        P.cards = P.cards ?? {};
        P.cards[lang] = {};
        for (const width of WIDTHS) {
            L515.lines[lang][width] = await lines(lang, width, 900, {}, MAP_0515);
            const { context, page } = await open(lang, width, 900);
            P.cards[lang][width] = {};
            for (const [name, sel] of Object.entries(CARDS)) P.cards[lang][width][name] = await page.evaluate(CARD_GEOMETRY, sel);
            await context.close();
        }
        P.cardsTouch = P.cardsTouch ?? {};
        P.cardsTouch[lang] = {};
        for (const width of [280, ...TOUCH_WIDTHS]) {
            if (width !== 280) L515.touch[lang][width] = await lines(lang, width, 844, TOUCH, TOUCH_0515);
            const { context, page } = await open(lang, width, 844, TOUCH);
            P.cardsTouch[lang][width] = { final: await page.evaluate(CARD_GEOMETRY, 'main .final__touch') };
            await context.close();
        }
        L9.lines[lang] = {};
        P.chapters = P.chapters ?? {};
        P.chapters[lang] = {};
        for (const width of WIDTHS) {
            L9.lines[lang][width] = await lines(lang, width, 900, {}, MAP_09, 'main .tutorial details');
            const { context, page } = await open(lang, width, 900);
            await page.evaluate(() => { for (const d of document.querySelectorAll('main .tutorial details')) d.open = true; });
            P.chapters[lang][width] = await page.evaluate(CHAPTER_GEOMETRY, 'main .tutorial li.ch');
            await context.close();
        }
        L7.lines[lang] = {};
        for (const width of WIDTHS) L7.lines[lang][width] = await lines(lang, width, 900, {}, FORAI_MAP);
        {
            const { context, page } = await open(lang, 1440, 900);
            P.forai = P.forai ?? {};
            P.forai[lang] = await page.evaluate(() => {
                const mark = getComputedStyle(document.querySelector('main .points li'), '::before');
                const tag = getComputedStyle(document.querySelector('main .agents .tag'));
                return { marker: [parseFloat(mark.width), parseFloat(mark.height)], tagRadius: tag.borderTopLeftRadius };
            });
            await context.close();
        }

        P.bulletin[lang] = {};
        for (const width of BULLETIN_WIDTHS) {
            const { context, page } = await open(lang, width, 900);
            P.bulletin[lang][width] = await page.evaluate(() => {
                const b = document.querySelector('.bulletin:not(.bulletin--static)');
                const r = (s) => { const x = b.querySelector(s).getBoundingClientRect(); return [x.x, x.y, x.width, x.height].map((n) => Math.round(n * 10) / 10); };
                return { h: Math.round(b.getBoundingClientRect().height * 10) / 10, label: r('.bulletin__label'), text: r('.bulletin__text'), close: r('.bulletin__close') };
            });
            await context.close();
        }
        {
            const { context, page } = await open(lang, 360, 780, TOUCH);
            P.shareBottom[lang] = await page.evaluate(() => Math.round(document.querySelector('main .hero__touch .btn--primary').getBoundingClientRect().bottom * 10) / 10);
            await context.close();
        }
        P.links[lang] = {};
        for (const [width, touch] of [[1440, false], [390, true]]) {
            const { context, page } = await open(lang, width, touch ? 844 : 900, touch ? TOUCH : {});
            P.links[lang][touch ? 'touch' : 'mouse'] = await page.evaluate(LINK_DECORATION, 'main .hero a, main .where a');
            await context.close();
        }
        P.tree = P.tree ?? {};
        P.tree[lang] = { mouse: {}, touch: {} };
        const descs = ['tree.material', 'tree.readme', 'tree.index', 'tree.assets'].map((id) => getPlainString(lang, id));
        for (const [mode, widths, height, extra] of [['mouse', WIDTHS, 900, {}], ['touch', ZERO_TOUCH_WIDTHS, 844, TOUCH]]) {
            for (const width of widths) {
                const { context, page } = await open(lang, width, height, extra);
                P.tree[lang][mode][width] = await page.evaluate(TREE_GEOMETRY, { tree: 'main .tree', line: '.tree__ln', descs });
                await context.close();
            }
        }
        P.zeros[lang] = { mouse: {}, touch: {} };
        for (const [mode, widths, height, extra] of [['mouse', WIDTHS, 900, {}], ['touch', ZERO_TOUCH_WIDTHS, 844, TOUCH]]) {
            for (const width of widths) {
                const { context, page } = await open(lang, width, height, extra);
                P.zeros[lang][mode][width] = await page.locator('main .zeros').evaluate(ZERO_GAPS);
                await context.close();
            }
        }
        {
            const { context, page } = await open(lang, 390, 844, TOUCH);
            P.press[lang] = {};
            for (const [name, selector] of Object.entries(PRESS)) {
                const loc = page.locator(selector).first();
                if (!(await loc.count())) throw new Error(`${lang}：設計稿裡找不到「${name}」（${selector}）`);
                P.press[lang][name] = await pressStyles(page, loc);
            }
            await context.close();
        }
    }
} finally {
    await browser.close();
    await site.close();
}

fs.writeFileSync(OUT_LINES, JSON.stringify(L, null, 1) + '\n');
fs.writeFileSync(OUT_POS, JSON.stringify(P, null, 1) + '\n');
fs.writeFileSync(OUT_LINES07, JSON.stringify(L7, null, 1) + '\n');
fs.writeFileSync(OUT_LINES0515, JSON.stringify(L515, null, 1) + '\n');
fs.writeFileSync(OUT_LINES09, JSON.stringify(L9, null, 1) + '\n');
console.log(`寫好了：${path.relative(process.cwd(), OUT_LINES)}、${path.relative(process.cwd(), OUT_LINES07)}、${path.relative(process.cwd(), OUT_LINES0515)}、${path.relative(process.cwd(), OUT_LINES09)}、${path.relative(process.cwd(), OUT_POS)}`);
