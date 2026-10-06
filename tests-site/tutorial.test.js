// F7.0～F7.16 09 教學影片（自己網站上的 <video>、章節）。真的開瀏覽器；「有影片 ID」「沒有影片 ID」兩種各在暫存複本把三語 ID 換掉再 build 一次（out/ 現在是真的 ID）。
// 照設計稿 6511462 的 {zh,en,ja}/index.html 09 那一段（頁面上是「有影片、還沒按」）與狀態一覽的 ②～⑥、home.css「09 教學影片」、動態.md 09 那張表、notes/4-2.md、
// notes/4-4.md 開頭那一節（09 沒有影片那一態的修正）、strings/README.md「從資料轉進來的字」；規格書 §5-09、§9、§10.5、§11、§14。章節資料：data/chapters.{zh,en,ja}.json（[{ id, name, desc, start, end }]，16 章）。
//
// 2026-10-07 為什麼改（使用者決定：教學影片改成自己的網站播，不嵌 YouTube；public/tutorial.js、components/Tutorial）：
//   - 三語的 YouTube ID 填了真的（app/site.js）：F7.0 改量「三語都是 11 碼的真 ID」；「沒有影片」那一種另外清空 ID 再 build 一份（不再是 out/）。
//   - 播放器從 YouTube 的 iframe（iframe_api、YT.Player、每 250ms 看 getCurrentTime）換成影片框裡自己建的 <video>，一章一支 /media/tutorial/<語言>/<章>.mp4（沒有音軌）：
//     F7.1（按了才載入）、F7.2（章節、章尾那一層）、F7.3（06 的「看教學 NN」）、F7.5（章尾那一層的版面）、F7.9、F7.10（載不到）、F7.12、F7.14、F7.15 改量 <video>：
//     src、真的在播（currentTime 往前走）、播完（ended）才蓋章尾那一層；快轉到結尾改成把 currentTime 設到「長度 −0.4 秒」（tests-site/server.js 加了 Range）。
//   - 刪掉：F7.10 的「播放器程式晚到」「建了卻一直沒 ready」「已經有 YT.Player」（沒有播放器程式了）、F7.11 播放中拖進度到別章（<video> 沒有控制列，拖不了）、
//     F7.1 的 iframe_api／youtube-nocookie／rel／playsinline 參數；fake-youtube.js 沒人用了一起刪（README「09 教學影片」記了一句）。
//   - 新加 F7.16：<video> 沒有 controls、靜音、playsinline、不給子母畫面與下載、tabindex=0；點畫面、空白鍵、Enter、k 暫停與繼續；換章是換同一支 <video> 的 src。
//
// 介面（README.md「09 教學影片（F7）」）：
//   影片 ID 放 app/site.js 的 export const TUTORIAL_VIDEO_IDS = { zh, en, ja };（一語一支；空字串＝還沒上 YouTube → 沒有影片的樣子；有 ID＝影片已上線）。
//   <section data-section="tutorial" id="tutorial">：大標 <h2 data-id="tutorial.title">（沒有影片時 data-id="tutorial.title.noid"）、data-id 的 tutorial.eyebrow、
//     說明 data-id="tutorial.lead"（沒有影片時 data-id="tutorial.lead.noid"）；
//   [data-player]：16:9 的影片框（data-state＝idle｜loading｜playing｜paused｜ended），裡面是預覽圖 <img src*="tutorial-poster-<語言>">（srcset 照 images.json）、
//     播放鈕 <button data-play aria-label＝tutorial.play>（只有有影片時）；沒有影片時一句 data-id="tutorial.noid.note"（影片框的下一個兄弟：手機在框底下，640 起疊在框的左下角）；
//     章尾那一層 [data-endcard]：data-id="tutorial.done"（代入章名）、<button data-id="tutorial.replay">、<button data-id="tutorial.next">（代入下一章的章名）；
//     第 16 章只有 <button data-id="tutorial.again">。載不到時 [data-api-fail]（role="status"，字是 tutorial.apifail）。
//   <a data-id="tutorial.youtube">（只有有影片時）連到 https://www.youtube.com/watch?v=<那一語的 ID>（或 youtu.be/<ID>）。
//   [data-chapters]：章節那一欄（標頭＋清單）。每一章一個 <li id="ch-NN">：data-id="ch.NN.name"、data-id="ch.NN.desc"（摘要在那一列的 <details> 裡）、起點 m:ss；
//     有影片時那一列是 <button data-chapter="NN" data-goatcounter-click="tutorial-NN">，正在播的那一章 aria-current="true"、列裡出現 tutorial.nowPlaying；
//     沒有影片時那一列是摘要的開關（<summary>），沒有 button[data-chapter]。
//   「看全部 16 章」：data-id="tutorial.showAll"，在一個 <summary>（或 <button aria-expanded>）裡；1024 起（09 的內容寬 ≥ 960）藏起來、16 章全列。
//   播放（有影片）：按了播放鈕（從第 01 章）、章名（從那一章）、或 06 的「看教學 NN」才在 [data-player] 裡建一個 <video>（之前整頁不抓 /media/tutorial/ 的 mp4、不連 YouTube）；
//     <video> 沒有 controls、muted、playsinline、disablepictureinpicture、controlslist 含 nodownload、tabindex=0，src＝/media/tutorial/<語言>/<章>.mp4（box 的 data-clips 是 /media/tutorial/<語言>/）；
//     真的播起來（playing）才標那一章；播完（ended）蓋上章尾那一層、焦點移到「播下一段」（第 16 章是「從頭再看一次」），Esc 收掉；換章是換同一支 <video> 的 src。
//     載不到（video error、play() 被拒、或 8 秒還在 loading；測試的上限 10 秒）：拿掉 <video>、回到 idle、播放鈕放回來、那一句出現、框加 data-fail-class；再按重試。
//
// 量什麼（案例全文在 README）：
//   F7.0 設定：TUTORIAL_VIDEO_IDS 在 app/site.js、三語都是 11 碼的真 ID（不是測試用的假 ID）、寫成換得掉的那一行。
//   F7.1 不按不載入：兩種 build × 三語 × 有滑鼠 1440、只有手指 390：開頁、整頁捲過一遍（有滑鼠時滑過播放鈕）—— 沒有往 YouTube 網域的請求、沒有 iframe、
//        影片框裡沒有 <video>、伺服器沒收到 /media/tutorial/ 的請求；送出來的 HTML 裡沒有往 YouTube 網域的 <script>、<link>、<iframe>，09 裡沒有 <video>；預覽圖看得到；有影片才有播放鈕。
//        有影片時按下播放鈕：影片框裡一個 <video>、src 是這一語的 01.mp4、伺服器收到那一支、真的在播（從 0 秒開始、時間往前走）、第 01 章標出來；沒有 iframe、沒有往 YouTube 的請求。
//   F7.2 章節（有影片，三語 × 1440）：16 章逐一按 —— src 是那一章的 mp4、從頭播、真的在播、只標那一章；跳到結尾播完蓋上章尾那一層（重播＋播下一段：下一章的章名；
//        第 16 章只問從頭再看一次）、焦點在那顆鈕；從頭到尾只有一個 <video>（換章是換 src）。重播、播下一段、從頭再看一次、Esc；換語言之後播那一語的 mp4。
//   F7.3 沒有影片 ID：沒有播放鈕與「在 YouTube 上看」、大標是 tutorial.title.noid、有 tutorial.noid.note；16 章的章名與摘要都在 HTML、每一列能打開摘要；
//        06 的「看教學 NN」跳到清單那一章（390、1440）；整個過程沒有頁面錯誤。有影片時：播放鈕、「在 YouTube 上看」連到這一語的影片，06 的「看教學 NN」從那一章播。
//   F7.4 清單排法（兩種 build）：1024 起影片在左、章節在右，章節那一欄的上下緣跟影片框對齊、清單自己捲、16 章都看得到、沒有「看全部」；
//        640 以下到 768（內容寬 < 960）影片在上、先看得到 5 章、「看全部 16 章」≥ 44×44、鍵盤 Enter／空白鍵打得開也收得起來、讀屏讀得到展開／收起；關掉 JS 16 章都在、點得開。
//   F7.5 通用：逐行跟設計稿一樣（有影片、十二種寬度）、說明文字的斷行規則；沒有影片時照斷行規則；字到邊（章節一列、章尾那一層、封面那一句）；
//        不橫捲、區塊不重疊、44×44、按鈕裡的字沒跑出框（平常、全部展開、章尾那一層三種畫面）、減少動態時沒有在跑的動畫；關掉 JS 字都在；
//        標題層級（09 一個 h2、不跳層）、JSON-LD 現在不放 VideoObject、GoatCounter 的 tutorial-NN、錨點 #tutorial、#ch-01～#ch-16、區塊順序。
//   F7.6 沒有影片時的說明句：用 tutorial.lead.noid，不說「點章名就從那一章開始播」這類做不到的話（字串表與畫出來的字，三語）；有影片時照舊 tutorial.lead。
//   F7.7 手機封面句的位置：封面那一句的框不壓到影片框左下角的螢光綠括號角那一塊（排出來的矩形；括號角用截圖找）；三語 × 手機九種寬度（只有手指、有滑鼠）與 640 起。
//   F7.8 章節摘要的斷行規則（app/data-text.js）：逐行跟設計稿一樣在 F7.5（fixtures/design-lines-09.json，設計稿 6511462 重量）；
//        這裡量規則：沒有影片、三語 × 十二種寬度、16 章摘要 —— 中日文沒有估寬 < 5 全形字寬的短行（設計稿自己放不下的 5 處除外）、日文行首沒有助詞、
//        沒有一行 > 25 字寬；英文沒有一個字一行；三語的字都不超出摘要的框。
//   F7.9 06「看教學 NN」的落點（動態.md 09 表）：三語 × 390、1024、1440 × 03、07、09 —— 停下來之後播放器上緣（窄而沒有影片時是那一列）沒被導覽列蓋住、
//        就在導覽列底下；沒有影片時摘要已打開、寬的時候那一列捲到清單頂；有影片時從那一章播、清單只捲清單；關掉 JS 照原生 #ch-NN 跳。
//   F7.10 載不到（有影片，三語 × 1440）：mp4 擋掉、一直不回（快轉 10 秒）、play() 被拒各一次 —— 回到還沒按的樣子（idle、播放鈕、沒有 <video>、沒有章被標正在播）、
//        影片框裡有一句話、「在 YouTube 上看」還在；失敗之後按章名也不標；網路好了再按播得起來。載入中（mp4 還沒回）不標正在播，回了、真的播起來才標。
//   F7.12 Esc 收掉章尾那一層之後，焦點回到影片框或正在播的那一章的按鈕；窄的時候播到收在「看全部」裡的章（第 05 章播完按「播下一段」）也一樣，打開時影片框不跳。
//   F7.13 影片 ID 只准空字串或 11 個 [A-Za-z0-9_-]：不合格（整個網址、太短、含空白）build 失敗，訊息講到格式與哪一語。
//   F7.14 兩句的版位（設計稿 5b74044）：載入失敗那一句（role="status"）—— 手機蓋滿整個影片框、字不壓播放鈕、播放鈕 44 而且按得到、焦點留在播放鈕；
//        640 起在框的左上角（上 16、左 24）。沒有影片那一句 —— 手機排在影片框外面（框底下 16、離畫面左邊 16），640 起疊在框的左下角（左 24、下 24）。
//   F7.15 用鍵盤（Tab 到播放鈕、Enter）播：播放鈕藏起來之後焦點不掉到 <body>，載入中與播起來之後都在影片框裡；載不到時回到播放鈕；重試播起來之後同上。
//   F7.16 <video> 本身（有影片，三語 × 1440）：沒有 controls（屬性與 property）、muted、playsinline、disablepictureinpicture、controlslist 含 nodownload、tabindex=0；
//        點影片暫停（data-state paused）、再點繼續；焦點在影片上按空白鍵（整頁不捲）、Enter、k 輪流暫停與繼續。
//
// 跑法（在網站 repo 根目錄）：
//   node tests-site/run.mjs --test-name-pattern "F7\\."
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, buildCopy, tail, decodeEntities } from './helpers.js';
import { textLines, width as wide, WIDTHS, CHAPTER_GEOMETRY, parts, FOCUS_BEFORE } from './page-helpers.js';
import { clock } from '../app/chapters.js';
import { getPlainString } from '../app/strings.js';

const say = (lang, id) => getPlainString(lang, id);
const SITE_JS = path.join(SITE, 'app', 'site.js');
// 2026-10-07 起三語填了真的 ID：不管填了什麼都換得掉（沒有影片的那一組換成空字串、有影片的那一組換成假的）
const ID_LINE = /export\s+const\s+TUTORIAL_VIDEO_IDS\s*=\s*\{[^}]*\}\s*;/;
// 假的影片 ID（YouTube 的 ID 是 11 個字元）：三語各不一樣，量得出「換語言換影片」
const IDS = { zh: 'TstZh000001', en: 'TstEn000002', ja: 'TstJa000003' };
const CHAPTERS = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(SITE, 'data', `chapters.${lang}.json`), 'utf8'))]));
const IMAGES = JSON.parse(fs.readFileSync(path.join(SITE, 'public', 'images', 'images.json'), 'utf8'));
const LINES = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-lines-09.json'), 'utf8'));
const POS = JSON.parse(fs.readFileSync(path.join(SITE, 'tests-site', 'fixtures', 'design-6511462.json'), 'utf8'));
const SEC = '[data-section="tutorial"]';
const PROSE = ['tutorial.lead', 'tutorial.lead.noid', ...Array.from({ length: 16 }, (_, i) => `ch.${String(i + 1).padStart(2, '0')}.desc`)];
const HEAD_PUNCT = /^[、。，．：；！？」』）】〉》,.;:!?)\]]/;
const NARROW = [280, 320, 360, 375, 390, 414, 430, 640, 768];
const WIDE = [1024, 1280, 1440];
const flat = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

const { pw, why } = playwright();
let built = null;
// 兩份暫存複本各一個伺服器：三語 ID 清空（沒有影片）、三語 ID 換成假的（有影片；三語各不一樣，量得出換語言換影片）
let builtNoId = null;
const noid = pw ? browserSession(pw, () => noIdOut()) : null;   // 2026-10-07 起現在的 out/ 有真的 ID，「沒有影片」另外產生一份
const withId = pw ? browserSession(pw, () => withIdOut()) : null;
after(async () => { await noid?.close(); await withId?.close(); built?.cleanup(); builtNoId?.cleanup(); });

function noIdOut() {
    builtNoId ??= buildCopy({
        label: 'tutorial-noid',
        prepare: (copy) => {
            const file = path.join(copy, 'app', 'site.js');
            const src = fs.readFileSync(file, 'utf8');
            if (!ID_LINE.test(src)) throw new Error('app/site.js 要有一行 export const TUTORIAL_VIDEO_IDS = { … };（見 F7.0）');
            fs.writeFileSync(file, src.replace(ID_LINE, "export const TUTORIAL_VIDEO_IDS = { zh: '', en: '', ja: '' };"));
        },
    });
    assert.equal(builtNoId.status, 0, `三語 ID 清空之後 build 失敗：\n${tail(builtNoId.output)}`);
    return builtNoId.out;
}

function withIdOut() {
    built ??= buildCopy({
        label: 'tutorial-ids',
        prepare: (copy) => {
            const file = path.join(copy, 'app', 'site.js');
            const src = fs.readFileSync(file, 'utf8');
            if (!ID_LINE.test(src)) throw new Error('app/site.js 要有一行 export const TUTORIAL_VIDEO_IDS = { … };（測試才換得掉；見 F7.0）');
            fs.writeFileSync(file, src.replace(ID_LINE, `export const TUTORIAL_VIDEO_IDS = { zh: '${IDS.zh}', en: '${IDS.en}', ja: '${IDS.ja}' };`));
        },
    });
    assert.equal(built.status, 0, `三語 ID 換成假的之後 build 失敗：\n${tail(built.output)}`);
    return built.out;
}

// YouTube 的網域（2026-10-07 起網站自己播，頁面上任何時候都不該連過去；「在 YouTube 上看」是一般的連結，點了才走）
const YT_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|ggpht\.com)$/;
// 那一章的影片：一章一支（scripts/tutorial-clips.mjs 從配樂版切的，沒有音軌）
const CLIP = (lang, nn) => `/media/tutorial/${lang}/${nn}.mp4`;
const CLIP_RE = /^\/media\/tutorial\//;
// 前端定的「按下去多久還沒開始播就放棄」（public/tutorial.js 的 LOAD_TIMEOUT_MS 是 8 秒）不能超過這麼久；測試把頁面的時鐘快轉這麼多再量
const LOAD_TIMEOUT_MAX = 10;

// 開一頁。time：裝 page.clock（時間照常走，要快轉時 runFor —— 只快轉網頁的計時器，影片照真的時間播）。
// 往 YouTube 網域的請求一律擋掉並記下來（requests.yt）；伺服器收到的 /media/tutorial/ 請求在 requests.clips（從開頁那一刻算；Playwright 的 request 事件在影片的請求上量過會漏）。
// 開頁之後等載入畫面收掉（html.loading，public/motion.js：最多 1 秒，等首屏影片時 2 秒），量畫面與點擊才不會被它蓋住。
async function open(session, lang, width, { touch = false, js = true, reduced = true, height, time = false, init = [] } = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: height ?? (touch ? 844 : 900) }, ...(touch ? { isMobile: true, hasTouch: true } : {}), javaScriptEnabled: js, ...(reduced ? { reducedMotion: 'reduce' } : {}) });
    const yt = [];
    await context.route((url) => YT_HOSTS.test(url.hostname), (route) => { yt.push(route.request().url()); return route.abort(); });
    const start = site.requests.length;
    const requests = { yt, get clips() { return site.requests.slice(start).filter((r) => CLIP_RE.test(r.path)).map((r) => r.path); } };
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(`頁面錯誤：${e.message}`));
    // 影片被測試擋掉時，主控台的「載入資源失敗」不算頁面的錯
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`主控台 error：${m.text()}`); });
    for (const script of init) await page.addInitScript(script);
    if (time) await page.clock.install();
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (js) {
        const ok = await until(page, async () => { const loading = await page.evaluate(() => document.documentElement.classList.contains('loading')); return { ok: !loading, got: 'html.loading' }; }, '載入畫面要收掉', 5000);
        assert.ok(ok.ok, ok.why);
    }
    return { page, context, requests, errors };
}

// 只捲整頁（不用 scrollIntoView：它會連外面 overflow 的框一起捲）
const toCenter = (el) => {
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + r.top - (innerHeight - r.height) / 2, behavior: 'instant' });
};
const toTop = (el) => window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top, behavior: 'instant' });

// 影片框裡的 <video> 現在的樣子（n：09 裡有幾支 <video>；src：路徑）
const player = (page) => page.evaluate((sec) => {
    const all = document.querySelectorAll(`${sec} video`);
    const v = all[all.length - 1];
    if (!v) return null;
    const src = v.getAttribute('src');
    return { n: all.length, src: src ? new URL(src, location.href).pathname : null, t: v.currentTime, d: v.duration, paused: v.paused, ended: v.ended, inPlayer: Boolean(v.closest(`${sec} [data-player]`)) };
}, SEC);

// 真的在播：沒暫停、時間在 0.05 秒之後（播起來了）
const isPlaying = (p) => Boolean(p && !p.paused && !p.ended && p.t > 0.05);

// 等那一支影片真的播起來（從頭播：時間 < 3 秒）
async function playingClip(page, lang, nn, label) {
    return until(page, async () => { const p = await player(page); return { ok: isPlaying(p) && p.src === CLIP(lang, nn) && p.t < 3, got: p }; }, `${label}：要播 ${CLIP(lang, nn)}（從頭、真的在播）`);
}

// 跳到快結尾（長度 −0.4 秒）讓它自己播完；等章尾那一層蓋上（最多 5 秒）
async function toEnd(page) {
    await page.evaluate((sec) => { const v = [...document.querySelectorAll(`${sec} video`)].at(-1); if (v && v.duration) v.currentTime = Math.max(0, v.duration - 0.4); }, SEC);
    return until(page, async () => { const s = await panel(page); return { ok: s.endcard, got: { panel: s, video: await player(page) } }; }, '跳到結尾之後播完、蓋上章尾那一層', 5000);
}

async function until(page, fn, label, ms = 8000) {
    const end = Date.now() + ms;
    let last = null;
    while (Date.now() < end) {
        last = await fn();
        if (last?.ok) return last;
        await page.waitForTimeout(60);
    }
    return { ok: false, why: `${label}（${ms / 1000} 秒內沒等到；最後：${JSON.stringify(last?.got ?? last)}）` };
}

// 那一章的狀態：正在播的是哪幾章、章尾那一層、焦點
const panel = (page) => page.evaluate((sec) => {
    const root = document.querySelector(sec);
    const end = root?.querySelector('[data-endcard]');
    const shown = Boolean(end && end.checkVisibility());
    const txt = (sel) => { const e = end?.querySelector(sel); return e && e.checkVisibility() ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return {
        current: [...(root?.querySelectorAll('[aria-current="true"]') ?? [])].map((e) => e.closest('li')?.id ?? e.tagName),
        endcard: shown,
        done: shown ? txt('[data-id="tutorial.done"]') : null,
        replay: shown ? txt('[data-id="tutorial.replay"]') : null,
        next: shown ? txt('[data-id="tutorial.next"]') : null,
        again: shown ? txt('[data-id="tutorial.again"]') : null,
        focus: document.activeElement?.closest('[data-id]')?.getAttribute('data-id') ?? document.activeElement?.tagName ?? null,
        state: root?.querySelector('[data-player]')?.getAttribute('data-state') ?? null,
    };
}, SEC);

// ---------- F7.0 設定 ----------

test('F7.0 影片 ID 放在 app/site.js 的 TUTORIAL_VIDEO_IDS（三語各一個；2026-10-07 起都填了真的 YouTube ID）', async () => {
    const mod = await import(`${SITE_JS}?t=${Date.now()}`);
    assert.ok('TUTORIAL_VIDEO_IDS' in mod, 'app/site.js 要 export const TUTORIAL_VIDEO_IDS（{ zh, en, ja }；空字串＝還沒上 YouTube）');
    for (const lang of ['zh', 'en', 'ja']) assert.match(mod.TUTORIAL_VIDEO_IDS[lang], /^[A-Za-z0-9_-]{11}$/, `${lang} 的影片 ID 要是 11 碼的 YouTube ID`);
    assert.ok(!Object.values(mod.TUTORIAL_VIDEO_IDS).some((id) => id.startsWith('Tst')), '不是測試用的假 ID');
    assert.match(fs.readFileSync(SITE_JS, 'utf8'), ID_LINE, '防呆：app/site.js 要有一行 export const TUTORIAL_VIDEO_IDS = { … };（測試才換得掉）');
});

// ---------- F7.1 不按不載入 ----------

const POSTER = (lang) => `${SEC} [data-player] img[src*="tutorial-poster-${lang}"]`;

for (const [name, which] of [['沒有影片 ID', () => noid], ['有影片 ID', () => withId]]) {
    test(`F7.1 不按不載入（${name}）：三語 × 有滑鼠 1440、只有手指 390，整頁捲過一遍沒有往 YouTube 的請求、沒有 iframe、沒有 <video>、沒抓教學影片的 mp4；預覽圖看得到`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const id = which() === withId;
        for (const lang of LANGS) {
            for (const [width, touch] of [[1440, false], [390, true]]) {
                const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}`;
                const { page, context, requests, errors } = await open(which(), lang, width, { touch });
                try {
                    const sec = page.locator(SEC);
                    if (!(await sec.count())) { bad.push(`${label}：找不到 ${SEC}`); continue; }
                    for (let y = 0; ; y += 600) {
                        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
                        await page.waitForTimeout(30);
                        if (await page.evaluate((top) => top + innerHeight >= document.documentElement.scrollHeight, y)) break;
                    }
                    await sec.evaluate(toCenter);
                    await page.waitForTimeout(400);
                    const play = page.locator(`${SEC} [data-player] [data-play]`);
                    if (id && !touch && (await play.count()) && (await play.isVisible())) {
                        await play.hover();
                        await page.waitForTimeout(400);
                    }
                    if (requests.yt.length) bad.push(`${label}：有 ${requests.yt.length} 個往 YouTube 的請求（${requests.yt.slice(0, 3).join('、')}）`);
                    if (requests.clips.length) bad.push(`${label}：沒按播放就抓了教學影片（${[...new Set(requests.clips)].slice(0, 3).join('、')}）`);
                    const frames = await page.locator('iframe').count();
                    if (frames) bad.push(`${label}：頁面上有 ${frames} 個 iframe`);
                    const videos = await page.locator(`${SEC} video`).count();
                    if (videos) bad.push(`${label}：沒按播放，09 裡就有 ${videos} 個 <video>`);
                    const poster = page.locator(POSTER(lang));
                    if ((await poster.count()) !== 1) bad.push(`${label}：影片框裡要有一張 tutorial-poster-${lang} 的預覽圖，得到 ${await poster.count()}`);
                    else if (!(await poster.isVisible())) bad.push(`${label}：預覽圖看不到`);
                    const n = await play.count();
                    if (id && n !== 1) bad.push(`${label}：有影片 ID 時影片框裡要有一顆 [data-play]，得到 ${n}`);
                    if (id && n === 1) {
                        if (!(await play.isVisible())) bad.push(`${label}：播放鈕看不到`);
                        const aria = await play.getAttribute('aria-label');
                        if (aria !== say(lang, 'tutorial.play')) bad.push(`${label}：播放鈕的 aria-label 要是「${say(lang, 'tutorial.play')}」，得到「${aria}」`);
                    }
                    if (!id && n) bad.push(`${label}：沒有影片 ID 時不能有播放鈕（得到 ${n} 顆）`);
                    if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

test('F7.1 送出來的 HTML（兩種 build、三語）沒有往 YouTube 網域的 <script>、<link>、<iframe>，09 裡沒有 <video>；預覽圖 srcset 照 images.json、alt、寬高、lazy', { skip: pw ? false : why }, async () => {
    const bad = [];
    const dirs = [['沒有影片 ID', noIdOut()], ['有影片 ID', withIdOut()]];
    for (const [name, dir] of dirs) {
        for (const lang of LANGS) {
            const html = fs.readFileSync(path.join(dir, lang, 'index.html'), 'utf8');
            for (const m of html.matchAll(/<(script|link|iframe)\b[^>]*>/gi)) {
                const urls = [...m[0].matchAll(/(?:src|href|imagesrcset)\s*=\s*"([^"]*)"/gi)].map((x) => x[1]);
                for (const u of urls) { try { if (YT_HOSTS.test(new URL(u, 'https://x/').hostname)) bad.push(`${name} ${lang}：<${m[1]}> 連到 ${u}`); } catch { /* 不是網址 */ } }
            }
            if (/<iframe\b/i.test(html)) bad.push(`${name} ${lang}：HTML 裡有 <iframe>`);
            const sec = /<section\b[^>]*data-section="tutorial"[^>]*>([\s\S]*?)<\/section>/i.exec(html);
            if (sec && /<video\b/i.test(sec[1])) bad.push(`${name} ${lang}：09 的 HTML 裡就有 <video>（要按了才建）`);
            if (sec && /\.mp4/i.test(sec[1].replace(/data-clips="[^"]*"/g, ''))) bad.push(`${name} ${lang}：09 的 HTML 裡有 .mp4 的網址（只能寫在 data-clips 的資料夾，按了才組出來）`);
        }
    }
    for (const [name, session] of [['沒有影片 ID', noid], ['有影片 ID', withId]]) {
        for (const lang of LANGS) {
            const { page: p, context: c } = await open(session, lang, 1440, { js: false });
            try {
                const img = p.locator(POSTER(lang));
                if ((await img.count()) !== 1) { bad.push(`${name} ${lang}：找不到預覽圖`); continue; }
                const a = await img.evaluate((i) => ({ src: i.getAttribute('src'), srcset: i.getAttribute('srcset') || '', alt: i.getAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), loading: i.getAttribute('loading') }));
                const entry = IMAGES[`tutorial-poster-${lang}.png`];
                const want = entry.sizes.map((s) => `/images/${s.file} ${s.width}w`).sort();
                const got = a.srcset.split(',').map((s) => s.trim().split(/\s+/).join(' ')).filter(Boolean).sort();
                if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${name} ${lang}：預覽圖 srcset 要是 ${want.join('、')}，得到 ${a.srcset}`);
                if (!entry.sizes.some((s) => a.src === `/images/${s.file}`)) bad.push(`${name} ${lang}：預覽圖 src 要是 images.json 那一筆的其中一個檔，得到 ${a.src}`);
                if (a.alt !== say(lang, 'tutorial.poster.alt')) bad.push(`${name} ${lang}：預覽圖 alt 要是 tutorial.poster.alt`);
                if (!(Number(a.w) > 0 && Number(a.h) > 0) || Math.abs(Number(a.w) / Number(a.h) - 16 / 9) > 0.01) bad.push(`${name} ${lang}：預覽圖要寫 16:9 的 width／height，得到 ${a.w}×${a.h}`);
                if (a.loading !== 'lazy') bad.push(`${name} ${lang}：預覽圖在首屏以下，要 loading="lazy"`);
            } finally {
                await c.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F7.1 一章一支的影片都在（三語 × 16 章）：public/media/tutorial/<語言>/<章>.mp4 是 mp4、不是空檔', () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const ch of CHAPTERS[lang]) {
            const file = path.join(SITE, 'public', ...CLIP(lang, ch.id).split('/').filter(Boolean));
            if (!fs.existsSync(file)) { bad.push(`${lang} 第 ${ch.id} 章：沒有 ${CLIP(lang, ch.id)}`); continue; }
            const head = fs.readFileSync(file).subarray(0, 12);
            if (fs.statSync(file).size < 10000 || head.toString('latin1', 4, 8) !== 'ftyp') bad.push(`${lang} 第 ${ch.id} 章：${CLIP(lang, ch.id)} 不像一支 mp4（大小 ${fs.statSync(file).size}、開頭 ${head.toString('latin1', 4, 8)}）`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

for (const lang of LANGS) {
    test(`F7.1 按了播放鈕才載入（${lang}，有影片 ID，1440）：影片框裡一個 <video>、src 是這一語的 01.mp4、從頭真的在播、第 01 章標出來；沒有 iframe、沒有往 YouTube 的請求`, { skip: pw ? false : why }, async () => {
        const { page, context, requests, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(SEC).evaluate(toCenter);
            const play = page.locator(`${SEC} [data-player] [data-play]`);
            assert.equal(await play.count(), 1, '有影片 ID 時要有播放鈕 [data-play]');
            assert.deepEqual(requests.clips, [], `按之前就抓了教學影片：${requests.clips.join('、')}`);
            await play.click();
            const ok = await playingClip(page, lang, '01', '按了播放鈕');
            assert.ok(ok.ok, ok.why);
            const p = await player(page);
            assert.equal(p.n, 1, `09 裡要剛好一個 <video>，得到 ${p.n}`);
            assert.ok(p.inPlayer, '<video> 要在 [data-player] 影片框裡');
            assert.ok(requests.clips.includes(CLIP(lang, '01')), `伺服器要收到 ${CLIP(lang, '01')} 的請求，得到 ${requests.clips.join('、') || '沒有'}`);
            assert.ok(requests.clips.every((c) => c === CLIP(lang, '01')), `只能抓第 01 章那一支，得到 ${[...new Set(requests.clips)].join('、')}`);
            const box = await page.locator(`${SEC} [data-tutorial]`).getAttribute('data-clips');
            assert.equal(box, `/media/tutorial/${lang}/`, `[data-tutorial] 的 data-clips 要是 /media/tutorial/${lang}/`);
            const s = await panel(page);
            assert.equal(s.state, 'playing', `影片框的 data-state 要是 playing，得到 ${s.state}`);
            assert.deepEqual(s.current, ['ch-01'], `正在播的要標第 01 章（aria-current="true" 只有一章），得到 ${JSON.stringify(s.current)}`);
            assert.equal(await page.locator('iframe').count(), 0, '不能有 iframe');
            assert.deepEqual(requests.yt, [], `不能連 YouTube：${requests.yt.join('、')}`);
            assert.deepEqual(errors, [], '不能有頁面錯誤');
        } finally {
            await context.close();
        }
    });
}

// ---------- F7.2 章節 ----------

// 按一章，等那一支從頭真的播起來；回傳錯誤（沒有錯回 null）
async function startChapter(page, lang, ch) {
    const button = page.locator(`${SEC} button[data-chapter="${ch.id}"]`);
    if ((await button.count()) !== 1) return `第 ${ch.id} 章：找不到 button[data-chapter="${ch.id}"]（得到 ${await button.count()}）`;
    await button.click();
    const ok = await playingClip(page, lang, ch.id, `按第 ${ch.id} 章`);
    return ok.ok ? null : ok.why;
}

for (const lang of LANGS) {
    test(`F7.2 章節（${lang}，有影片 ID，1440）：16 章逐一按 —— 播那一章的 mp4、從頭真的在播、只標那一章；播完蓋上章尾那一層、焦點在那顆鈕；從頭到尾只有一支 <video>`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const chapters = CHAPTERS[lang];
        assert.equal(chapters.length, 16, `data/chapters.${lang}.json 要 16 章`);
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(SEC).evaluate(toCenter);
            for (const [i, ch] of chapters.entries()) {
                const err = await startChapter(page, lang, ch);
                if (err) { bad.push(err); continue; }
                let s = await panel(page);
                if (JSON.stringify(s.current) !== JSON.stringify([`ch-${ch.id}`])) bad.push(`第 ${ch.id} 章：正在播的要只標 ch-${ch.id}（aria-current="true"），得到 ${JSON.stringify(s.current)}`);
                const now = await page.locator(`${SEC} li#ch-${ch.id}`).evaluate((li, word) => li.checkVisibility() && li.textContent.includes(word), say(lang, 'tutorial.nowPlaying'));
                if (!now) bad.push(`第 ${ch.id} 章：那一列要寫「${say(lang, 'tutorial.nowPlaying')}」`);
                if (s.endcard) bad.push(`第 ${ch.id} 章：剛開始播就蓋著章尾那一層`);
                if (s.state !== 'playing') bad.push(`第 ${ch.id} 章：影片框的 data-state 要是 playing，得到 ${s.state}`);
                const p = await player(page);
                if (p.n !== 1) bad.push(`第 ${ch.id} 章：09 裡要只有一支 <video>（換章是換 src），得到 ${p.n}`);
                const end = await toEnd(page);
                if (!end.ok) { bad.push(`第 ${ch.id} 章：${end.why}`); continue; }
                s = await panel(page);
                const v = await player(page);
                if (!v.ended) bad.push(`第 ${ch.id} 章：蓋上章尾那一層時影片要是播完的（ended），得到 ${JSON.stringify(v)}`);
                if (s.state !== 'ended') bad.push(`第 ${ch.id} 章：播完影片框的 data-state 要是 ended，得到 ${s.state}`);
                const done = say(lang, 'tutorial.done').replace('%章名%', ch.name);
                if (s.done !== flat(done)) bad.push(`第 ${ch.id} 章：章尾那一層的標題要是「${done}」，得到「${s.done}」`);
                if (i < chapters.length - 1) {
                    const next = say(lang, 'tutorial.next').replace('%章名%', chapters[i + 1].name);
                    if (s.replay !== flat(say(lang, 'tutorial.replay'))) bad.push(`第 ${ch.id} 章：要有「${say(lang, 'tutorial.replay')}」，得到 ${s.replay}`);
                    if (s.next !== flat(next)) bad.push(`第 ${ch.id} 章：要有「${next}」，得到 ${s.next}`);
                    if (s.again) bad.push(`第 ${ch.id} 章：不是最後一章，不能問「${say(lang, 'tutorial.again')}」`);
                    if (s.focus !== 'tutorial.next') bad.push(`第 ${ch.id} 章：焦點要在「播下一段」，在 ${s.focus}`);
                } else {
                    if (s.again !== flat(say(lang, 'tutorial.again'))) bad.push(`第 16 章：要問「${say(lang, 'tutorial.again')}」，得到 ${s.again}`);
                    if (s.next || s.replay) bad.push(`第 16 章：只問從頭再看一次，不能有重播或播下一段（得到 ${s.replay}／${s.next}）`);
                    if (s.focus !== 'tutorial.again') bad.push(`第 16 章：焦點要在「從頭再看一次」，在 ${s.focus}`);
                }
            }
            if (errors.length) bad.push(...errors.slice(0, 3));
        } finally {
            await context.close();
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F7.2 章尾那一層的鈕（${lang}，有影片 ID，1440）：重播這一段、播下一段、從頭再看一次、Esc 收掉`, { skip: pw ? false : why }, async () => {
        const chapters = CHAPTERS[lang];
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(SEC).evaluate(toCenter);
            const c3 = chapters[2];
            assert.equal(await startChapter(page, lang, c3), null);
            let end = await toEnd(page);
            assert.ok(end.ok, `第 03 章：${end.why}`);
            await page.locator(`${SEC} [data-endcard] [data-id="tutorial.replay"]`).click();
            let ok = await playingClip(page, lang, c3.id, '重播這一段');
            assert.ok(ok.ok, ok.why);
            assert.equal((await panel(page)).endcard, false, '重播之後章尾那一層要收掉');
            end = await toEnd(page);
            assert.ok(end.ok, `第 03 章重播：${end.why}`);
            await page.locator(`${SEC} [data-endcard] [data-id="tutorial.next"]`).click();
            ok = await playingClip(page, lang, chapters[3].id, '播下一段');
            assert.ok(ok.ok, ok.why);
            assert.deepEqual((await panel(page)).current, ['ch-04'], '播下一段之後正在播的要標第 04 章');
            end = await toEnd(page);
            assert.ok(end.ok, `第 04 章：${end.why}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            assert.equal((await panel(page)).endcard, false, 'Esc 要收掉章尾那一層');
            const c16 = chapters[15];
            assert.equal(await startChapter(page, lang, c16), null);
            end = await toEnd(page);
            assert.ok(end.ok, `第 16 章：${end.why}`);
            await page.locator(`${SEC} [data-endcard] [data-id="tutorial.again"]`).click();
            ok = await playingClip(page, lang, '01', '從頭再看一次');
            assert.ok(ok.ok, ok.why);
            assert.deepEqual((await panel(page)).current, ['ch-01'], '從頭再看一次之後正在播的要標第 01 章');
            assert.equal((await player(page)).n, 1, '從頭到尾只有一支 <video>');
            assert.deepEqual(errors, [], '不能有頁面錯誤');
        } finally {
            await context.close();
        }
    });
}

test('F7.2 換語言之後換成那一語的影片（有影片 ID，1440）：中文播第 03 章 → 語言切換到英文、日文 → 按第 03 章播的是那一語的 mp4', { skip: pw ? false : why }, async () => {
    const { page, context } = await open(withId, 'zh', 1440);
    try {
        await page.locator(SEC).evaluate(toCenter);
        assert.equal(await startChapter(page, 'zh', CHAPTERS.zh[2]), null);
        for (const to of ['en', 'ja']) {
            const from = to === 'en' ? 'zh' : 'en';
            const p = await parts(page, from);
            const link = p.langGroup.locator(`a[hreflang="${to}"]`);
            if (await link.isVisible()) await link.click();
            else await page.goto(new URL(`/${to}/`, page.url()).href);
            await page.waitForURL(new RegExp(`/${to}/`));
            await page.evaluate(() => document.fonts.ready);
            await until(page, async () => ({ ok: !(await page.evaluate(() => document.documentElement.classList.contains('loading'))) }), '載入畫面收掉', 5000);
            await page.locator(SEC).evaluate(toCenter);
            assert.equal(await startChapter(page, to, CHAPTERS[to][2]), null, `${to}：要播 ${CLIP(to, '03')}`);
            assert.equal((await player(page)).n, 1, `${to}：要剛好一支 <video>`);
        }
    } finally {
        await context.close();
    }
});

// ---------- F7.3 沒有影片 ID 的時候 ----------

for (const lang of LANGS) {
    test(`F7.3 沒有影片 ID（${lang}）：沒有播放鈕與「在 YouTube 上看」、大標換成 tutorial.title.noid、封面一句實話；16 章的章名與摘要都在、每一列打得開摘要；沒有頁面錯誤`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [width, touch] of [[1440, false], [390, true]]) {
            const label = `${touch ? '只有手指' : '有滑鼠'} ${width}`;
            const { page, context, errors, requests } = await open(noid, lang, width, { touch });
            try {
                const sec = page.locator(SEC);
                if (!(await sec.count())) { bad.push(`${label}：找不到 ${SEC}`); continue; }
                await sec.evaluate(toCenter);
                if (await page.locator(`${SEC} [data-play]`).count()) bad.push(`${label}：沒有影片 ID 時不能有播放鈕`);
                if (await page.locator(`${SEC} [data-id="tutorial.youtube"], ${SEC} a[href*="youtube"], ${SEC} a[href*="youtu.be"]`).count()) bad.push(`${label}：沒有影片 ID 時不能有「在 YouTube 上看」`);
                const h2 = page.locator(`${SEC} h2`);
                const title = (await h2.count()) ? flat(await h2.first().textContent()) : null;
                if (title !== flat(say(lang, 'tutorial.title.noid'))) bad.push(`${label}：大標要是「${say(lang, 'tutorial.title.noid')}」（tutorial.title.noid），得到「${title}」`);
                if (await page.locator(`${SEC} [data-id="tutorial.title"]`).count()) bad.push(`${label}：沒有影片時不能出現 tutorial.title（「${say(lang, 'tutorial.title')}」）`);
                const note = page.locator(`${SEC} [data-id="tutorial.noid.note"]`);
                if (!(await note.count()) || !(await note.isVisible())) bad.push(`${label}：要有那一句「${say(lang, 'tutorial.noid.note')}」`);
                else if (flat(await note.textContent()) !== flat(say(lang, 'tutorial.noid.note'))) bad.push(`${label}：封面那一句的字不對：「${flat(await note.textContent())}」`);
                if (await page.locator(`${SEC} button[data-chapter]`).count()) bad.push(`${label}：沒有影片時章節不能是播放的按鈕（button[data-chapter]）`);
                const ids = await page.locator(`${SEC} li[id^="ch-"]`).evaluateAll((lis) => lis.map((li) => li.id));
                const want = CHAPTERS[lang].map((c) => `ch-${c.id}`);
                if (JSON.stringify(ids) !== JSON.stringify(want)) bad.push(`${label}：章節要依序 ch-01～ch-16，得到 ${ids.join(',')}`);
                for (const ch of CHAPTERS[lang]) {
                    const li = page.locator(`${SEC} li#ch-${ch.id}`);
                    if (!(await li.count())) continue;
                    const got = await li.evaluate((e) => ({ name: e.querySelector(`[data-id$=".name"]`)?.textContent, desc: e.querySelector(`[data-id$=".desc"]`)?.textContent, text: e.textContent }));
                    if (flat(got.name) !== flat(ch.name)) bad.push(`${label} 第 ${ch.id} 章：章名（data-id="ch.${ch.id}.name"）要是「${ch.name}」，得到「${flat(got.name)}」`);
                    if (flat(got.desc) !== flat(ch.desc)) bad.push(`${label} 第 ${ch.id} 章：摘要（data-id="ch.${ch.id}.desc"）要是「${ch.desc}」，得到「${flat(got.desc)}」`);
                    if (!got.text.includes(clock(ch.start))) bad.push(`${label} 第 ${ch.id} 章：要寫起點 ${clock(ch.start)}`);
                }
                // 每一列是摘要的開關：先打開「看全部」，再一列一列點，摘要要看得到
                const all = page.locator(`${SEC} [data-id="tutorial.showAll"]`);
                if ((await all.count()) && (await all.isVisible())) await all.click();
                for (const ch of CHAPTERS[lang]) {
                    const li = page.locator(`${SEC} li#ch-${ch.id}`);
                    const row = li.locator('summary').first();
                    if (!(await row.count())) { bad.push(`${label} 第 ${ch.id} 章：那一列要是摘要的開關（<summary>）`); continue; }
                    await row.click();
                    if (!(await li.locator(`[data-id="ch.${ch.id}.desc"]`).isVisible())) bad.push(`${label} 第 ${ch.id} 章：點了那一列，摘要要看得到`);
                }
                if (requests.yt.length) bad.push(`${label}：有往 YouTube 的請求`);
                if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

const MORE = [['03', 1], ['04', 2], ['05', 3], ['06', 4], ['07', 5], ['08', 6], ['09', 7], ['03', 8]];

test('F7.3 沒有影片 ID 時 06 的「看教學 NN」跳到清單那一章（三語 × 有滑鼠 1440、只有手指 390；收在「看全部」裡的也看得到）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [width, touch] of [[1440, false], [390, true]]) {
            const { page, context, errors } = await open(noid, lang, width, { touch });
            try {
                for (const [nn, n] of MORE) {
                    const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width} 第 ${n} 張「看教學 ${nn}」`;
                    const link = page.locator(`[data-section="features"] [data-id="features.${n}.more"]`);
                    if (!(await link.count())) { bad.push(`${label}：找不到`); continue; }
                    await link.evaluate(toCenter);
                    await link.click();
                    const ok = await until(page, () => page.evaluate((id) => {
                        const li = document.getElementById(id);
                        if (!li) return { ok: false, got: `沒有 #${id}` };
                        const r = li.getBoundingClientRect();
                        return { ok: location.hash === `#${id}` && li.checkVisibility() && r.top >= -1 && r.top < innerHeight - 20, got: { hash: location.hash, visible: li.checkVisibility(), top: Math.round(r.top) } };
                    }, `ch-${nn}`), `跳到 #ch-${nn} 而且那一章在畫面裡`, 3000);
                    if (!ok.ok) bad.push(`${label}：${ok.why}`);
                }
                if (errors.length) bad.push(`${lang} ${width}：${errors.slice(0, 3).join('、')}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

for (const lang of LANGS) {
    test(`F7.3 有影片 ID（${lang}）：大標 tutorial.title、播放鈕、「在 YouTube 上看」連到這一語的影片；06 的「看教學 NN」從那一章播`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            const title = flat(await page.locator(`${SEC} h2`).first().textContent());
            if (title !== flat(say(lang, 'tutorial.title'))) bad.push(`大標要是「${say(lang, 'tutorial.title')}」，得到「${title}」`);
            if (await page.locator(`${SEC} [data-id="tutorial.noid.note"]`).count()) bad.push('有影片時不能有 tutorial.noid.note');
            const yt = page.locator(`${SEC} [data-id="tutorial.youtube"]`);
            if (!(await yt.count()) || !(await yt.isVisible())) bad.push('要有看得到的「在 YouTube 上看」（data-id="tutorial.youtube"）');
            else {
                const href = await yt.evaluate((e) => (e.closest('a') || e).getAttribute('href'));
                let u = null;
                try { u = new URL(href); } catch { /* 下面講 */ }
                const okHref = u && ((/^(www\.)?youtube\.com$/.test(u.hostname) && u.pathname === '/watch' && u.searchParams.get('v') === IDS[lang]) || (u.hostname === 'youtu.be' && u.pathname === `/${IDS[lang]}`));
                if (!okHref) bad.push(`「在 YouTube 上看」要連到 https://www.youtube.com/watch?v=${IDS[lang]}（或 youtu.be/${IDS[lang]}），得到 ${href}`);
                if (flat(await yt.textContent()) !== flat(say(lang, 'tutorial.youtube'))) bad.push('「在 YouTube 上看」的字不對');
            }
            const buttons = await page.locator(`${SEC} button[data-chapter]`).evaluateAll((bs) => bs.map((b) => b.getAttribute('data-chapter')));
            if (JSON.stringify(buttons) !== JSON.stringify(CHAPTERS[lang].map((c) => c.id))) bad.push(`有影片時每一章一顆 button[data-chapter]，依序 01～16，得到 ${buttons.join(',')}`);
            const ch = CHAPTERS[lang][4];
            const link = page.locator('[data-section="features"] [data-id="features.3.more"]');
            await link.evaluate(toCenter);
            await link.click();
            const ok = await playingClip(page, lang, ch.id, '06「看教學 05」');
            if (!ok.ok) bad.push(ok.why);
            else {
                const s = await panel(page);
                if (JSON.stringify(s.current) !== '["ch-05"]') bad.push(`06「看教學 05」之後正在播的要標第 05 章，得到 ${JSON.stringify(s.current)}`);
                const inView = await page.locator(`${SEC} [data-player]`).evaluate((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
                if (!inView) bad.push('06「看教學 05」之後影片框要在畫面裡（捲到 09）');
            }
            if (errors.length) bad.push(...errors.slice(0, 3));
        } finally {
            await context.close();
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F7.4 清單排法 ----------

// 章節的捲動容器：第 16 章往上第一個 overflow-y 是 auto／scroll 的祖先（在 09 裡）
const LAYOUT = (sec) => {
    const root = document.querySelector(sec);
    const player = root?.querySelector('[data-player]');
    const col = root?.querySelector('[data-chapters]');
    const last = root?.querySelector('li#ch-16');
    if (!player || !col || !last) return { missing: [!player && '[data-player]', !col && '[data-chapters]', !last && 'li#ch-16'].filter(Boolean) };
    let box = last.parentElement;
    while (box && box !== root && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const scroller = box && box !== root ? box : null;
    const p = player.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    const visible = [...root.querySelectorAll('li[id^="ch-"]')].filter((li) => li.checkVisibility()).map((li) => li.id);
    const all = root.querySelector('[data-id="tutorial.showAll"]');
    return {
        p: { top: p.top, bottom: p.bottom, left: p.left, right: p.right }, c: { top: c.top, bottom: c.bottom, left: c.left, right: c.right },
        scroller: scroller ? { sh: scroller.scrollHeight, ch: scroller.clientHeight } : null,
        visible, showAll: Boolean(all && all.checkVisibility()),
    };
};

for (const [name, which] of [['沒有影片 ID', () => noid], ['有影片 ID', () => withId]]) {
    test(`F7.4 桌機（${name}，三語 × 1024、1280、1440）：影片在左、章節在右且上下緣對齊、清單自己捲、16 章都看得到、沒有「看全部」`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const lang of LANGS) {
            for (const width of WIDE) {
                const label = `${lang} ${width}`;
                const { page, context } = await open(which(), lang, width);
                try {
                    await page.locator(SEC).evaluate(toCenter);
                    const g = await page.evaluate(LAYOUT, SEC);
                    if (g.missing) { bad.push(`${label}：找不到 ${g.missing.join('、')}`); continue; }
                    if (!(g.p.right <= g.c.left + 0.5)) bad.push(`${label}：章節要在影片右邊（影片右緣 ${g.p.right.toFixed(1)}、章節左緣 ${g.c.left.toFixed(1)}）`);
                    if (Math.abs(g.p.top - g.c.top) > 1 || Math.abs(g.p.bottom - g.c.bottom) > 1) bad.push(`${label}：章節那一欄的上下緣要跟影片框對齊（影片 ${g.p.top.toFixed(1)}～${g.p.bottom.toFixed(1)}、章節 ${g.c.top.toFixed(1)}～${g.c.bottom.toFixed(1)}）`);
                    if (!g.scroller) bad.push(`${label}：清單要自己捲（第 16 章外面要有 overflow-y: auto 的容器）`);
                    else if (g.scroller.sh <= g.scroller.ch + 1) bad.push(`${label}：清單要捲得動（內容 ${g.scroller.sh}、看得到 ${g.scroller.ch}）`);
                    if (g.visible.length !== 16) bad.push(`${label}：16 章都要看得到（不用按「看全部」），得到 ${g.visible.length}`);
                    if (g.showAll) bad.push(`${label}：桌機不能有「看全部 16 章」`);
                    if (g.scroller) {
                        const moved = await page.evaluate((sec) => {
                            const last = document.querySelector(`${sec} li#ch-16`);
                            let box = last.parentElement;
                            while (!/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
                            const y = window.scrollY;
                            box.scrollTop = box.scrollHeight;
                            const r = last.getBoundingClientRect();
                            const b = box.getBoundingClientRect();
                            const out = { scrolled: box.scrollTop > 0, page: window.scrollY === y, lastIn: r.bottom <= b.bottom + 1 && r.top >= b.top - 1 };
                            box.scrollTop = 0;
                            return out;
                        }, SEC);
                        if (!moved.scrolled || !moved.page || !moved.lastIn) bad.push(`${label}：清單捲到底要看得到第 16 章、整頁不跟著捲（${JSON.stringify(moved)}）`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad, [], `${bad.length} 處不對`);
    });
}

// 讀屏看到的展開／收起（Chrome 的無障礙樹；<summary> 與 aria-expanded 都算）
async function expanded(page, selector) {
    const cdp = await page.context().newCDPSession(page);
    try {
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
        if (!nodeId) return undefined;
        const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
        const prop = nodes[0]?.properties?.find((p) => p.name === 'expanded');
        return prop ? prop.value.value : null;
    } finally {
        await cdp.detach();
    }
}

for (const [name, which] of [['沒有影片 ID', () => noid], ['有影片 ID', () => withId]]) {
    test(`F7.4 手機與平板（${name}，三語 × 280～768）：影片在上、先 5 章、「看全部 16 章」≥ 44×44、鍵盤打得開收得起、讀屏讀得到展開`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const lang of LANGS) {
            for (const width of NARROW) {
                const touch = width <= 430;
                const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}`;
                const { page, context } = await open(which(), lang, width, { touch });
                try {
                    await page.locator(SEC).evaluate(toCenter);
                    const g = await page.evaluate(LAYOUT, SEC);
                    if (g.missing) { bad.push(`${label}：找不到 ${g.missing.join('、')}`); continue; }
                    if (!(g.p.bottom <= g.c.top + 0.5)) bad.push(`${label}：影片要在章節上面（影片下緣 ${g.p.bottom.toFixed(1)}、章節上緣 ${g.c.top.toFixed(1)}）`);
                    const five = ['ch-01', 'ch-02', 'ch-03', 'ch-04', 'ch-05'];
                    if (JSON.stringify(g.visible) !== JSON.stringify(five)) bad.push(`${label}：一開始只看得到前 5 章，得到 ${g.visible.join(',')}`);
                    const all = page.locator(`${SEC} [data-id="tutorial.showAll"]`);
                    if (!(await all.count()) || !g.showAll) { bad.push(`${label}：要有看得到的「${say(lang, 'tutorial.showAll')}」`); continue; }
                    const ctl = await all.evaluateHandle((e) => e.closest('summary, button') || e);
                    await ctl.evaluate((e) => e.setAttribute('data-test-showall', ''));
                    const box = await ctl.evaluate((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, tag: e.tagName }; });
                    if (box.w < 43.5 || box.h < 43.5) bad.push(`${label}：「看全部」要 ≥ 44×44，得到 ${Math.round(box.w)}×${Math.round(box.h)}`);
                    if (!['SUMMARY', 'BUTTON'].includes(box.tag)) bad.push(`${label}：「看全部」要是 <summary> 或 <button>，得到 <${box.tag.toLowerCase()}>`);
                    const sel = `${SEC} [data-test-showall]`;
                    const before = await expanded(page, sel);
                    if (before !== false) bad.push(`${label}：收著時讀屏要讀到「收起」（expanded=false），得到 ${before}`);
                    await ctl.evaluate((e) => e.focus());
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(100);
                    let vis = (await page.evaluate(LAYOUT, SEC)).visible;
                    if (vis.length !== 16) bad.push(`${label}：按 Enter 之後 16 章都要看得到，得到 ${vis.length}`);
                    const open1 = await expanded(page, sel);
                    if (open1 !== true) bad.push(`${label}：打開之後讀屏要讀到「展開」（expanded=true），得到 ${open1}`);
                    await page.keyboard.press('Space');
                    await page.waitForTimeout(100);
                    vis = (await page.evaluate(LAYOUT, SEC)).visible;
                    if (vis.length !== 5) bad.push(`${label}：再按空白鍵要收回 5 章，得到 ${vis.length}`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
    });
}

test('F7.4 關掉 JS（兩種 build、三語 × 390、1440）：16 章的章名與摘要都在 HTML，手機點「看全部」打得開', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [name, session] of [['沒有影片 ID', noid], ['有影片 ID', withId]]) {
        for (const lang of LANGS) {
            for (const width of [390, 1440]) {
                const label = `${name} ${lang} ${width}`;
                const { page, context } = await open(session, lang, width, { js: false });
                try {
                    for (const ch of CHAPTERS[lang]) {
                        const got = await page.evaluate(([sec, id]) => {
                            const li = document.querySelector(`${sec} li#ch-${id}`);
                            return li ? { name: li.querySelector(`[data-id="ch.${id}.name"]`)?.textContent ?? null, desc: li.querySelector(`[data-id="ch.${id}.desc"]`)?.textContent ?? null } : null;
                        }, [SEC, ch.id]);
                        if (!got) { bad.push(`${label}：沒有 li#ch-${ch.id}`); continue; }
                        if (flat(got.name) !== flat(ch.name) || flat(got.desc) !== flat(ch.desc)) bad.push(`${label} 第 ${ch.id} 章：章名或摘要不在 HTML（${flat(got.name)}／${flat(got.desc).slice(0, 12)}）`);
                    }
                    if (width === 390) {
                        const all = page.locator(`${SEC} [data-id="tutorial.showAll"]`);
                        if (!(await all.count()) || !(await all.isVisible())) { bad.push(`${label}：要有「看全部」`); continue; }
                        await all.click();
                        const n = (await page.evaluate(LAYOUT, SEC)).visible?.length;
                        if (n !== 16) bad.push(`${label}：關掉 JS 點「看全部」要看得到 16 章，得到 ${n}`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

// ---------- F7.5 通用 ----------

const IDS_LINES = Object.keys(LINES.lines.zh['1440']);
const openAll = (sec) => { for (const d of document.querySelectorAll(`${sec} details`)) d.open = true; };

// want：設計稿同一個寬度那一段的每一行（跟設計稿一樣的行不算）；整段不到 10 字寬的（短的章名、大標），怎麼斷都會有一行不到 5 字，不量短行
function lineRules(lang, id, got, want) {
    const bad = [];
    if (!PROSE.includes(id) && !/\.(name|title|title\.noid|noid\.note)$/.test(id)) return bad;
    const total = wide(got.join(''));
    for (const line of got) {
        if (lang === 'en') { if (PROSE.includes(id) && !/\s/.test(line) && !(want ?? []).includes(line)) bad.push(`一行只有一個字「${line}」`); continue; }
        if (wide(line) < 5 && !(want ?? []).includes(line) && got.length > 1 && total >= 10) bad.push(`一行只有 ${wide(line)} 字寬「${line}」`);
        if (PROSE.includes(id) && wide(line) > 25 && !(want ?? []).includes(line)) bad.push(`一行 ${wide(line)} 字寬（要 ≤ 25）「${line}」`);
        if (HEAD_PUNCT.test(line)) bad.push(`行首是孤標點「${line}」`);
    }
    return bad;
}

for (const lang of LANGS) {
    test(`F7.5 09 的文案（${lang}，有影片 ID，十二種寬度）：每一行跟設計稿一樣（<details> 全打開）；說明文字照斷行規則`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(withId, lang, width);
            try {
                await page.evaluate(openAll, SEC);
                for (const id of IDS_LINES) {
                    const el = page.locator(`${SEC} [data-id="${id}"]`).first();
                    const want = LINES.lines[lang][String(width)][id];
                    if (!(await el.count())) { bad.push(`${width} ${id}：找不到`); continue; }
                    const got = await textLines(el);
                    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${width} ${id}：網站 ${JSON.stringify(got)}，設計稿 ${JSON.stringify(want)}`);
                    for (const b of lineRules(lang, id, got, want)) bad.push(`${width} ${id}：${b}`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

for (const lang of LANGS) {
    test(`F7.5 09 的文案（${lang}，沒有影片 ID，十二種寬度）：大標、封面那一句、章名、摘要照斷行規則（中日文不到 5 字的行、超過 25 字的行、行首標點；英文一個字一行）`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const ids = ['tutorial.title.noid', 'tutorial.noid.note', 'tutorial.lead.noid', ...CHAPTERS[lang].flatMap((c) => [`ch.${c.id}.name`, `ch.${c.id}.desc`])];
        for (const width of WIDTHS) {
            const { page, context } = await open(noid, lang, width);
            try {
                await page.evaluate(openAll, SEC);
                for (const id of ids) {
                    const el = page.locator(`${SEC} [data-id="${id}"]`).first();
                    if (!(await el.count())) { bad.push(`${width} ${id}：找不到`); continue; }
                    const got = await textLines(el);
                    if (!got.length) bad.push(`${width} ${id}：看不到字`);
                    const twin = id === 'tutorial.title.noid' ? 'tutorial.title' : id;
                    for (const b of lineRules(lang, id, got, LINES.lines[lang][String(width)][twin])) bad.push(`${width} ${id}：${b}`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

for (const [name, which, key] of [['沒有影片 ID', () => noid, 'noid'], ['有影片 ID', () => withId, 'id']]) {
    test(`F7.5 字到邊（${name}，三語 × 十二種寬度，<details> 全打開）：章節每一列的字到列左緣 ≥ 設計內距的一半、不壓到摘要開關、不超出清單${key === 'noid' ? '；封面那一句離影片框左右 ≥ 8px' : ''}`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const lang of LANGS) {
            for (const width of WIDTHS) {
                const label = `${lang} ${width}`;
                const { page, context } = await open(which(), lang, width);
                try {
                    await page.evaluate(openAll, SEC);
                    const got = await page.evaluate(CHAPTER_GEOMETRY, `${SEC} li[id^="ch-"]`);
                    const want = POS.chapters[lang][String(width)];
                    if (!got) { bad.push(`${label}：找不到章節`); continue; }
                    if (got.rows !== 16) bad.push(`${label}：<details> 全打開時 16 列都要看得到，得到 ${got.rows}`);
                    if (got.minLeft < want.padL / 2) bad.push(`${label}：章節的字到那一列左緣最近 ${got.minLeft}px，要 ≥ ${want.padL / 2}（設計內距 ${want.padL} 的一半；設計稿 ${want.minLeft}）`);
                    if (key === 'id' && got.minToggle !== null && got.minToggle < Math.min(4, want.minToggle ?? 4) - 0.5) bad.push(`${label}：章名或起點離右邊的摘要開關只剩 ${got.minToggle}px（要 ≥ ${Math.min(4, want.minToggle ?? 4) - 0.5}；設計稿 ${want.minToggle}）`);
                    if (key === 'id' && got.minToggle === null) bad.push(`${label}：有影片時每一列右邊要有摘要開關（<summary>）`);
                    if (got.clipped) bad.push(`${label}：有 ${got.clipped} 個字超出清單看得見的範圍`);
                    if (key === 'noid') {
                        const gap = await page.evaluate((sec) => {
                            const note = document.querySelector(`${sec} [data-id="tutorial.noid.note"]`);
                            const frame = document.querySelector(`${sec} [data-player]`);
                            if (!note || !frame) return null;
                            // 疊在框上（640 起）量到影片框；排在框底下（手機）量到畫面左右兩邊
                            const f = frame.getBoundingClientRect();
                            const b = note.getBoundingClientRect().top < f.bottom ? f : { left: 0, right: innerWidth, top: -Infinity, bottom: Infinity };
                            let min = Infinity;
                            const walk = document.createTreeWalker(note, NodeFilter.SHOW_TEXT);
                            while (walk.nextNode()) {
                                const n = walk.currentNode;
                                for (let k = 0; k < n.data.length; k += 1) {
                                    if (!n.data[k].trim()) continue;
                                    const r = document.createRange();
                                    r.setStart(n, k);
                                    r.setEnd(n, k + 1);
                                    const g = r.getBoundingClientRect();
                                    if (g.width) min = Math.min(min, g.left - b.left, b.right - g.right, g.top - b.top, b.bottom - g.bottom);
                                }
                            }
                            return Math.round(min * 10) / 10;
                        }, SEC);
                        if (gap === null) bad.push(`${label}：找不到封面那一句`);
                        else if (gap < 8) bad.push(`${label}：那一句離影片框（排在框底下時是畫面邊）最近 ${gap}px（要 ≥ 8）`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
    });
}

// 09 裡看得到的控件：≥ 44×44、字沒有跑出框；data-id 的區塊不重疊；沒有在跑的動畫；整頁不橫捲
const GENERAL = (sec) => {
    const root = document.querySelector(sec);
    // 「還有 N 章 ↓」（2026-10-04）是刻意疊在清單下緣（半露的那一列與淡出上）的提示鈕，同章尾那一層不算重疊
    const blocks = [...root.querySelectorAll('[data-id]')].filter((e) => e.checkVisibility() && !e.parentElement.closest('[data-id]') && !e.closest('[data-endcard], [data-chapters-more]')).map((e) => ({ id: e.dataset.id, r: e.getBoundingClientRect() }));
    const hits = [];
    for (let i = 0; i < blocks.length; i += 1) for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i].r;
        const b = blocks[j].r;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) hits.push(`${blocks[i].id}／${blocks[j].id}`);
    }
    const controls = [...root.querySelectorAll('a, button, summary')].filter((e) => e.checkVisibility());
    const small = controls.map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 12), r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width < 43.5 || x.r.height < 43.5).map((x) => `${x.t}（${Math.round(x.r.width)}×${Math.round(x.r.height)}）`);
    const spill = [];
    for (const e of controls) {
        const r = e.getBoundingClientRect();
        const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
            const n = walk.currentNode;
            if (!n.parentElement.checkVisibility()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const g of range.getClientRects()) {
                if (g.width && (g.left < r.left - 1 || g.right > r.right + 1 || g.top < r.top - 1 || g.bottom > r.bottom + 1)) { spill.push(`${e.textContent.trim().slice(0, 14)}`); break; }
            }
        }
    }
    const running = root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.timeline instanceof DocumentTimeline).length;
    return { hits, small, spill: [...new Set(spill)], running, scroll: document.documentElement.scrollWidth - innerWidth };
};

for (const [name, which] of [['沒有影片 ID', () => noid], ['有影片 ID', () => withId]]) {
    test(`F7.5 通用（${name}，三語 × 十二種寬度、減少動態；收著與 <details> 全打開兩種）：不橫捲、區塊不重疊、44×44、按鈕裡的字沒跑出框、沒有在跑的動畫`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const lang of LANGS) {
            for (const width of WIDTHS) {
                const { page, context } = await open(which(), lang, width);
                try {
                    const sec = page.locator(SEC);
                    if (!(await sec.count())) { bad.push(`${lang} ${width}：找不到 ${SEC}`); continue; }
                    await sec.evaluate(toTop);
                    await page.waitForTimeout(100);
                    for (const state of ['收著', '全打開']) {
                        if (state === '全打開') { await page.evaluate(openAll, SEC); await page.waitForTimeout(150); }
                        const r = await page.evaluate(GENERAL, SEC);
                        const label = `${lang} ${width} ${state}`;
                        if (r.scroll > 0) bad.push(`${label}：整頁橫捲 ${r.scroll}px`);
                        if (r.hits.length) bad.push(`${label}：重疊 ${r.hits.join('、')}`);
                        if (r.small.length) bad.push(`${label}：小於 44×44 ${r.small.join('、')}`);
                        if (r.spill.length) bad.push(`${label}：字跑出控件的框 ${r.spill.join('、')}`);
                        if (r.running) bad.push(`${label}：減少動態時有 ${r.running} 個在跑的動畫`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
    });
}

// 章尾那一層：下一章章名最長的那一章（量會壞的那種）
const LONGEST = Object.fromEntries(LANGS.map((lang) => {
    const ch = CHAPTERS[lang];
    let best = 0;
    for (let i = 0; i < ch.length - 1; i += 1) if (wide(ch[i].name) + wide(ch[i + 1].name) > wide(ch[best].name) + wide(ch[best + 1].name)) best = i;
    return [lang, best];
}));

test('F7.5 章尾那一層（有影片 ID，三語 × 十二種寬度，章名最長的那一章）：鈕 ≥ 44×44、字不跑出鈕、字離影片框左右 ≥ 8px、不橫捲、不推動版面', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const ch = CHAPTERS[lang][LONGEST[lang]];
        for (const width of WIDTHS) {
            const label = `${lang} ${width}（第 ${ch.id} 章）`;
            const { page, context } = await open(withId, lang, width, { touch: width <= 430 });
            try {
                await page.locator(SEC).evaluate(toCenter);
                if (width < 1024) {
                    const all = page.locator(`${SEC} [data-id="tutorial.showAll"]`);
                    if ((await all.count()) && (await all.isVisible()) && Number(ch.id) > 5) await all.click();
                }
                const err = await startChapter(page, lang, ch);
                if (err) { bad.push(`${label}：${err}`); continue; }
                const before = await page.locator(SEC).evaluate((s) => s.getBoundingClientRect().height);
                const end = await toEnd(page);
                if (!end.ok) { bad.push(`${label}：${end.why}`); continue; }
                const r = await page.evaluate((sec) => {
                    const end = document.querySelector(`${sec} [data-endcard]`);
                    if (!end || !end.checkVisibility()) return null;
                    const box = end.closest('[data-player]').getBoundingClientRect();
                    const buttons = [...end.querySelectorAll('button, a')].filter((b) => b.checkVisibility());
                    const small = buttons.map((b) => b.getBoundingClientRect()).filter((x) => x.width < 43.5 || x.height < 43.5).map((x) => `${Math.round(x.width)}×${Math.round(x.height)}`);
                    let edge = Infinity;
                    const spill = [];
                    const walk = document.createTreeWalker(end, NodeFilter.SHOW_TEXT);
                    while (walk.nextNode()) {
                        const n = walk.currentNode;
                        if (!n.data.trim() || !n.parentElement.checkVisibility()) continue;
                        const range = document.createRange();
                        range.selectNodeContents(n);
                        const host = n.parentElement.closest('button, a');
                        const hr = host?.getBoundingClientRect();
                        for (const g of range.getClientRects()) {
                            if (!g.width) continue;
                            edge = Math.min(edge, g.left - box.left, box.right - g.right);
                            if (hr && (g.left < hr.left - 1 || g.right > hr.right + 1 || g.top < hr.top - 1 || g.bottom > hr.bottom + 1)) spill.push(n.data.trim().slice(0, 12));
                        }
                    }
                    const e = end.getBoundingClientRect();
                    return { small, edge: Math.round(edge * 10) / 10, spill, out: e.left < -0.5 || e.right > innerWidth + 0.5, scroll: document.documentElement.scrollWidth - innerWidth };
                }, SEC);
                if (!r) { bad.push(`${label}：播完沒有章尾那一層`); continue; }
                if (r.small.length) bad.push(`${label}：章尾那一層的鈕小於 44×44：${r.small.join('、')}`);
                if (r.spill.length) bad.push(`${label}：字跑出鈕：${r.spill.join('、')}`);
                if (r.edge < 8) bad.push(`${label}：章尾那一層的字離影片框左右最近 ${r.edge}px（要 ≥ 8）`);
                if (r.out) bad.push(`${label}：章尾那一層超出畫面`);
                if (r.scroll > 0) bad.push(`${label}：整頁橫捲 ${r.scroll}px`);
                const afterH = await page.locator(SEC).evaluate((s) => s.getBoundingClientRect().height);
                if (Math.abs(afterH - before) > 1) bad.push(`${label}：章尾那一層推動了版面（播放中 09 高 ${before.toFixed(1)} → 蓋上之後 ${afterH.toFixed(1)}）`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F7.5 關掉 JS（兩種 build、三語 × 390、1440）：09 每一段字都在、看得到（摘要與收在「看全部」裡的章節不算看得到）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [name, session, ids] of [['沒有影片 ID', noid, ['tutorial.eyebrow', 'tutorial.title.noid', 'tutorial.lead.noid', 'tutorial.noid.note', 'tutorial.chapters', 'tutorial.total']], ['有影片 ID', withId, ['tutorial.eyebrow', 'tutorial.title', 'tutorial.lead', 'tutorial.youtube', 'tutorial.chapters', 'tutorial.total']]]) {
        for (const lang of LANGS) {
            for (const width of [390, 1440]) {
                const { page, context } = await open(session, lang, width, { js: false });
                try {
                    for (const id of ids) {
                        const el = page.locator(`${SEC} [data-id="${id}"]`).first();
                        if (!(await el.count())) { bad.push(`${name} ${lang} ${width}：${id} 不在`); continue; }
                        if (!(await el.isVisible())) bad.push(`${name} ${lang} ${width}：${id} 看不到`);
                        else if (flat(await el.textContent()) !== flat(say(lang, id))) bad.push(`${name} ${lang} ${width}：${id} 的字不對`);
                    }
                    if (name === '有影片 ID' && (await page.locator(`${SEC} [data-play]`).isVisible().catch(() => false))) bad.push(`${name} ${lang} ${width}：關掉 JS 時不能有播放鈕（按了也播不了；動態.md 09）`);
                } finally {
                    await context.close();
                }
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F7.5 SEO（兩種 build、三語，送出來的 HTML）：09 剛好一個 <h2>（大標）、不跳層、沒有 <h1>；16 章的章名與摘要在看得到的字裡；JSON-LD 現在沒有 VideoObject', () => {
    const bad = [];
    // 2026-10-07：out/ 現在是真的 ID（有影片），「沒有影片」那一份改用清空 ID 再 build 的暫存複本
    for (const [name, dir, title] of [['沒有影片 ID', noIdOut(), 'tutorial.title.noid'], ['有影片 ID', withIdOut(), 'tutorial.title']]) {
        for (const lang of LANGS) {
            const html = fs.readFileSync(path.join(dir, lang, 'index.html'), 'utf8');
            const m = /<section\b[^>]*data-section="tutorial"[^>]*>([\s\S]*?)<\/section>/i.exec(html);
            if (!m) { bad.push(`${name} ${lang}：找不到 <section data-section="tutorial">`); continue; }
            if (!/\bid="tutorial"/.test(m[0].slice(0, m[0].indexOf('>')))) bad.push(`${name} ${lang}：09 的 <section> 要 id="tutorial"（導覽列「${say(lang, 'nav.tutorial')}」連到 #tutorial）`);
            const heads = [...m[1].matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((x) => ({ level: Number(x[1]), text: decodeEntities(x[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() }));
            const h2 = heads.filter((h) => h.level === 2);
            if (h2.length !== 1) bad.push(`${name} ${lang}：09 要剛好一個 <h2>，得到 ${h2.length}`);
            else if (h2[0].text !== flat(say(lang, title))) bad.push(`${name} ${lang}：09 的 <h2> 要是「${say(lang, title)}」，得到「${h2[0].text}」`);
            if (heads.some((h) => h.level === 1)) bad.push(`${name} ${lang}：09 裡不能有 <h1>`);
            let prev = 2;
            for (const h of heads.filter((x) => x.level >= 2)) { if (h.level > prev + 1) bad.push(`${name} ${lang}：標題跳層 h${prev} → h${h.level}（${h.text}）`); prev = h.level; }
            // 去掉標籤（不補空白：<span>、<wbr> 是斷行用的，原本的空白在字裡）再比
            const text = decodeEntities(m[1].replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
            for (const ch of CHAPTERS[lang]) {
                if (!text.includes(flat(ch.name))) bad.push(`${name} ${lang}：HTML 裡沒有第 ${ch.id} 章的章名`);
                if (!text.includes(flat(ch.desc))) bad.push(`${name} ${lang}：HTML 裡沒有第 ${ch.id} 章的摘要`);
            }
            for (const ld of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) if (/"VideoObject"/.test(ld[1])) bad.push(`${name} ${lang}：JSON-LD 現在不能有 VideoObject（教學片還沒有上傳日期與網址，規格書 §10.5）`);
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test.todo('F7.5 有影片 ID 與上傳日期時 JSON-LD 加 VideoObject（名稱、說明、預覽圖、長度、上傳日期、16 章的 Clip 起訖；規格書 §10.5）—— 上傳日期放哪裡等決定');

test('F7.5 GoatCounter（關掉 JS，1440）：有影片時每一章的 button[data-chapter="NN"] 帶 data-goatcounter-click="tutorial-NN"（剛好一個）；沒有影片時沒有 tutorial-*', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [name, session] of [['沒有影片 ID', noid], ['有影片 ID', withId]]) {
        for (const lang of LANGS) {
            const { page, context } = await open(session, lang, 1440, { js: false });
            try {
                const got = await page.evaluate(() => [...document.querySelectorAll('[data-goatcounter-click^="tutorial-"]')].map((e) => ({ name: e.getAttribute('data-goatcounter-click'), chapter: e.getAttribute('data-chapter'), tag: e.tagName, inSec: Boolean(e.closest('[data-section="tutorial"]')) })));
                if (name === '沒有影片 ID') { if (got.length) bad.push(`${name} ${lang}：沒有影片時不能有 tutorial-*（得到 ${got.length}）`); continue; }
                for (const ch of CHAPTERS[lang]) {
                    const hit = got.filter((g) => g.name === `tutorial-${ch.id}`);
                    if (hit.length !== 1) { bad.push(`${name} ${lang}：tutorial-${ch.id} 要剛好一個，得到 ${hit.length}`); continue; }
                    if (hit[0].tag !== 'BUTTON' || hit[0].chapter !== ch.id || !hit[0].inSec) bad.push(`${name} ${lang}：tutorial-${ch.id} 要放在 09 裡那一章的 button[data-chapter="${ch.id}"]`);
                }
                if (got.length !== 16) bad.push(`${name} ${lang}：tutorial-* 要剛好 16 個，得到 ${got.length}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F7.5 錨點與順序（兩種 build、三語，關掉 JS）：#tutorial 是 09、#ch-01～#ch-16 是那一章的 <li>、09 在 08 隱私與 15 最後的安裝之間', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [name, session] of [['沒有影片 ID', noid], ['有影片 ID', withId]]) {
        for (const lang of LANGS) {
            const { page, context } = await open(session, lang, 1440, { js: false });
            try {
                const r = await page.evaluate(() => ({
                    tutorial: document.getElementById('tutorial')?.getAttribute('data-section') ?? null,
                    chapters: Array.from({ length: 16 }, (_, i) => { const id = `ch-${String(i + 1).padStart(2, '0')}`; const e = document.getElementById(id); return e && e.tagName === 'LI' && e.closest('[data-section="tutorial"]') ? null : id; }).filter(Boolean),
                    order: [...document.querySelectorAll('[data-section]')].map((e) => e.dataset.section),
                }));
                if (r.tutorial !== 'tutorial') bad.push(`${name} ${lang}：#tutorial 要是 09（data-section="tutorial"），得到 ${r.tutorial}`);
                if (r.chapters.length) bad.push(`${name} ${lang}：這幾個錨點不是 09 裡那一章的 <li>：${r.chapters.join('、')}`);
                const i = (s) => r.order.indexOf(s);
                if (!(i('privacy') >= 0 && i('tutorial') > i('privacy') && (i('final') < 0 || i('tutorial') < i('final')))) bad.push(`${name} ${lang}：09 要排在 08 隱私之後、15 最後的安裝之前，得到 ${r.order.join(' → ')}`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F7.6 沒有影片時的說明句 ----------

// tutorial.lead 裡「點章名就播」那一句（沒有影片時做不到：點了只會打開摘要）
const PLAYS_ON_CLICK = { zh: '點章名就從那一章開始播', en: 'Click a chapter to start there.', ja: '章名をクリックすると、その章から再生します。' };

test('F7.6 字串表（三語）：tutorial.lead.noid 有字、不說「點章名就從那一章開始播」這類做不到的話', () => {
    const bad = [];
    for (const lang of LANGS) {
        if (!flat(say(lang, 'tutorial.lead')).includes(PLAYS_ON_CLICK[lang])) bad.push(`防呆 ${lang}：tutorial.lead 裡要找得到「${PLAYS_ON_CLICK[lang]}」（字串表改過的話這條要跟著改）`);
        let noid = '';
        try { noid = flat(say(lang, 'tutorial.lead.noid')); } catch (e) { bad.push(`${lang}：字串表沒有 tutorial.lead.noid（${e.message}）`); continue; }
        if (!noid) bad.push(`${lang}：tutorial.lead.noid 是空的`);
        if (noid.includes(PLAYS_ON_CLICK[lang])) bad.push(`${lang}：tutorial.lead.noid 不能說「${PLAYS_ON_CLICK[lang]}」`);
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F7.6 畫出來的說明句（三語）：沒有影片時是 tutorial.lead.noid、09 裡沒有「點章名就播」那一句（有滑鼠 1440、只有手指 390、關掉 JS 1440）；有影片時照舊 tutorial.lead', { skip: pw ? false : why }, async () => {
    const bad = [];
    const LEAD = (sec) => {
        const root = document.querySelector(sec);
        const pick = (id) => { const e = root?.querySelector(`[data-id="${id}"]`); return e ? { text: e.textContent, visible: e.checkVisibility() } : null; };
        return { lead: pick('tutorial.lead'), noid: pick('tutorial.lead.noid'), all: root?.textContent ?? '' };
    };
    for (const lang of LANGS) {
        for (const [width, touch, js] of [[1440, false, true], [390, true, true], [1440, false, false]]) {
            const label = `沒有影片 ${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}${js ? '' : ' 關掉 JS'}`;
            const { page, context, errors } = await open(noid, lang, width, { touch, js });
            try {
                const r = await page.evaluate(LEAD, SEC);
                if (!r.noid) bad.push(`${label}：說明要是 data-id="tutorial.lead.noid"，找不到`);
                else {
                    if (!r.noid.visible) bad.push(`${label}：tutorial.lead.noid 看不到`);
                    if (flat(r.noid.text) !== flat(say(lang, 'tutorial.lead.noid'))) bad.push(`${label}：說明的字要是「${say(lang, 'tutorial.lead.noid')}」，得到「${flat(r.noid.text)}」`);
                }
                if (r.lead) bad.push(`${label}：沒有影片時不能用 tutorial.lead（「${flat(r.lead.text)}」）`);
                if (flat(r.all).includes(PLAYS_ON_CLICK[lang])) bad.push(`${label}：09 畫出來的字裡有「${PLAYS_ON_CLICK[lang]}」（沒有影片時點章名不會播）`);
                if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
            } finally {
                await context.close();
            }
        }
        const label = `有影片 ${lang} 有滑鼠 1440`;
        const { page, context } = await open(withId, lang, 1440);
        try {
            const r = await page.evaluate(LEAD, SEC);
            if (!r.lead) bad.push(`${label}：說明要是 data-id="tutorial.lead"，找不到`);
            else if (flat(r.lead.text) !== flat(say(lang, 'tutorial.lead'))) bad.push(`${label}：說明的字要是「${say(lang, 'tutorial.lead')}」，得到「${flat(r.lead.text)}」`);
            if (r.noid) bad.push(`${label}：有影片時不能用 tutorial.lead.noid`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F7.7 手機封面句的位置 ----------

// 設計稿：手機（< 640）括號角畫在影片框內 12～32px，那一句排在影片框底下（隔 16、離畫面邊 16）；640 起括號角在框外（−8～12），那一句疊在框的左 24、下 24
const PHONE_WIDTHS = [280, 320, 360, 375, 390, 430, 480, 540, 639];
const NOT_PHONE_WIDTHS = [640, 768, 1024, 1280, 1440];

// 影片框左下角的括號角那一塊（viewport 座標）：把預覽圖與那一句先藏起來、拍影片框四周，找螢光綠（--color-accent-lime-default）的像素，取左下四分之一的外框
async function bottomLeftCorner(page) {
    const info = await page.evaluate((sec) => {
        const frame = document.querySelector(`${sec} [data-player]`);
        const note = frame && document.querySelector(`${sec} [data-id="tutorial.noid.note"]`);
        if (!frame || !note) return null;
        const f = frame.getBoundingClientRect();
        const n = note.getBoundingClientRect();
        const c = document.createElement('canvas').getContext('2d');
        const probe = document.createElement('i');
        probe.style.color = 'var(--color-accent-lime-default)';
        document.body.append(probe);
        c.fillStyle = getComputedStyle(probe).color;
        probe.remove();
        c.fillRect(0, 0, 1, 1);
        const lime = [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        for (const e of [note, ...frame.querySelectorAll('img')]) e.style.visibility = 'hidden';
        return { f: { left: f.left, top: f.top, right: f.right, bottom: f.bottom }, note: { left: n.left, top: n.top, right: n.right, bottom: n.bottom }, lime, vw: innerWidth, vh: innerHeight };
    }, SEC);
    if (!info) return null;
    const x = Math.max(0, Math.floor(info.f.left - 16));
    const y = Math.max(0, Math.floor(info.f.top - 16));
    const clip = { x, y, width: Math.min(info.vw, Math.ceil(info.f.right + 16)) - x, height: Math.min(info.vh, Math.ceil(info.f.bottom + 16)) - y };
    const png = await page.screenshot({ clip });
    await page.evaluate((sec) => { for (const e of document.querySelectorAll(`${sec} [data-id="tutorial.noid.note"], ${sec} [data-player] img`)) e.style.visibility = ''; }, SEC);
    const corner = await page.evaluate(async ([url, lime, clip, f]) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const k = img.width / clip.width;
        let box = null;
        for (let py = 0; py < cv.height; py += 1) {
            for (let px = 0; px < cv.width; px += 1) {
                const vx = clip.x + px / k;
                const vy = clip.y + py / k;
                if (vx > (f.left + f.right) / 2 || vy < (f.top + f.bottom) / 2) continue;
                const i = (py * cv.width + px) * 4;
                if (Math.abs(d[i] - lime[0]) + Math.abs(d[i + 1] - lime[1]) + Math.abs(d[i + 2] - lime[2]) > 60) continue;
                box = box ? { left: Math.min(box.left, vx), top: Math.min(box.top, vy), right: Math.max(box.right, vx + 1 / k), bottom: Math.max(box.bottom, vy + 1 / k) } : { left: vx, top: vy, right: vx + 1 / k, bottom: vy + 1 / k };
            }
        }
        return box;
    }, [`data:image/png;base64,${png.toString('base64')}`, info.lime, clip, info.f]);
    return { corner, note: info.note, frame: info.f };
}

test('F7.7 封面那一句不壓到左下角的括號角（沒有影片，三語 × 手機 280～639 只有手指與有滑鼠、640～1440 有滑鼠）：兩個框排出來的矩形重疊 0', { skip: pw ? false : why }, async () => {
    const bad = [];
    const combos = [...PHONE_WIDTHS.flatMap((w) => [[w, true], [w, false]]), ...NOT_PHONE_WIDTHS.map((w) => [w, false])];
    for (const lang of LANGS) {
        for (const [width, touch] of combos) {
            const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}`;
            const { page, context } = await open(noid, lang, width, { touch });
            try {
                const frame = page.locator(`${SEC} [data-player]`);
                if (!(await frame.count())) { bad.push(`${label}：找不到 [data-player]`); continue; }
                await frame.evaluate(toCenter);
                await page.waitForTimeout(50);
                const r = await bottomLeftCorner(page);
                if (!r) { bad.push(`${label}：找不到那一句（data-id="tutorial.noid.note"）`); continue; }
                const c = r.corner;
                if (!c || c.right - c.left < 10 || c.bottom - c.top < 10) { bad.push(`${label}：防呆：影片框左下角找不到螢光綠的括號角（${JSON.stringify(c)}）`); continue; }
                const n = r.note;
                const w = Math.min(n.right, c.right) - Math.max(n.left, c.left);
                const h = Math.min(n.bottom, c.bottom) - Math.max(n.top, c.top);
                const f = (v) => Math.round(v * 10) / 10;
                if (w > 0 && h > 0) bad.push(`${label}：封面那一句的框壓到左下角的括號角 ${f(w)}×${f(h)}（那一句離框左 ${f(n.left - r.frame.left)}、下 ${f(r.frame.bottom - n.bottom)}；括號角離框左 ${f(c.left - r.frame.left)}～${f(c.right - r.frame.left)}、下 ${f(r.frame.bottom - c.bottom)}～${f(r.frame.bottom - c.top)}）`);
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

// ---------- F7.8 章節摘要的斷行規則 ----------

// 估寬（strings/README.md「從資料轉進來的字」③）：全形 1、拉丁字母與數字 0.55、其他半形字 0.3；short＝標點與空白不算（量短行），long＝都算（量長行）
const DATA_PUNCT = /[，。、；：！？「」『』（）・\s]/;
const est = (x, { punct = false } = {}) => [...x].reduce((n, ch) => n + (!punct && DATA_PUNCT.test(ch) ? 0 : /[⺀-￯]/.test(ch) ? 1 : /[A-Za-z0-9]/.test(ch) ? 0.55 : 0.3), 0);
const PARTICLES = /^[をにがはでとのもへや]$/;
// 設計稿 6511462 自己在 280／320 放不下的短行（notes/4-4.md「量到的」；tools/measure-design.mjs 量的逐行表裡全部的短行就這 5 處）
const SHORT_OK = [['zh', 280, '04', '一段一筆。'], ['zh', 320, '04', '一段一筆。'], ['zh', 280, '08', 'xlsx、py、md'], ['zh', 280, '15', '「頁面功能」'], ['zh', 280, '16', '（當場檢查）、']];
const shortOk = (lang, width, id, line) => SHORT_OK.some(([l, w, c, s]) => l === lang && w === width && c === id && s === line);

// 摘要每一個字有沒有超出摘要那個元素的框（左右）或清單看得見的範圍
const DESC_SPILL = (el) => {
    const b = el.getBoundingClientRect();
    let box = el.parentElement;
    while (box && box !== document.body && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(box).overflowX + getComputedStyle(box).overflowY)) box = box.parentElement;
    const view = box && box !== document.body ? box.getBoundingClientRect() : { left: 0, right: innerWidth };
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
        const n = walk.currentNode;
        for (let k = 0; k < n.data.length; k += 1) {
            if (!n.data[k].trim()) continue;
            const r = document.createRange();
            r.setStart(n, k);
            r.setEnd(n, k + 1);
            const g = r.getBoundingClientRect();
            if (g.width && (g.left < Math.max(b.left, view.left) - 0.5 || g.right > Math.min(b.right, view.right) + 0.5)) out.push(n.data[k]);
        }
    }
    return out.join('');
};

// 日文：每一行（第二行起）的開頭在原文的哪裡；開頭剛好是 Segmenter 切出來的單獨一個助詞就算
function particleHeads(text, lines) {
    const seg = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)];
    const heads = [];
    let at = 0;
    for (const [k, line] of lines.entries()) {
        const i = text.indexOf(line, at);
        if (i < 0) continue;
        at = i + line.length;
        if (k === 0) continue;
        const s = seg.find((x) => x.index === i);
        if (s && PARTICLES.test(s.segment)) heads.push(line);
    }
    return heads;
}

for (const lang of LANGS) {
    test(`F7.8 章節摘要的斷行規則（${lang}，沒有影片，十二種寬度，16 章全打開）：${lang === 'en' ? '沒有一個字一行' : `沒有估寬 < 5 全形字寬的行${lang === 'zh' ? '（設計稿自己放不下的 5 處除外）' : ''}、${lang === 'ja' ? '行首沒有助詞、' : ''}沒有一行 > 25 字寬`}、字不超出框`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(noid, lang, width);
            try {
                await page.evaluate(openAll, SEC);
                for (const ch of CHAPTERS[lang]) {
                    const id = `ch.${ch.id}.desc`;
                    const el = page.locator(`${SEC} [data-id="${id}"]`).first();
                    if (!(await el.count())) { bad.push(`${width} ${id}：找不到`); continue; }
                    const lines = await textLines(el);
                    if (!lines.length) { bad.push(`${width} ${id}：看不到字`); continue; }
                    for (const line of lines) {
                        if (lang === 'en') {
                            if (lines.length > 1 && !/\s/.test(line)) bad.push(`${width} ${id}：一行只有一個字「${line}」`);
                            continue;
                        }
                        if (lines.length > 1 && est(line) < 5 && !shortOk(lang, width, ch.id, line)) bad.push(`${width} ${id}：一行估寬 ${est(line).toFixed(2)} 全形字寬（要 ≥ 5）「${line}」`);
                        if (est(line, { punct: true }) > 25) bad.push(`${width} ${id}：一行 ${est(line, { punct: true }).toFixed(2)} 字寬（要 ≤ 25）「${line}」`);
                    }
                    if (lang === 'ja') for (const line of particleHeads(flat(ch.desc), lines)) bad.push(`${width} ${id}：行首是助詞「${line}」`);
                    const spill = await el.evaluate(DESC_SPILL);
                    if (spill) bad.push(`${width} ${id}：有字超出摘要的框或清單「${spill.slice(0, 12)}」`);
                }
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad.slice(0, 40), [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F7.9 06「看教學 NN」的落點 ----------

// 03、07、09 三章各從 06 的哪一張卡跳（MORE 那張表：第 1 張→03、第 5 張→07、第 7 張→09）
const JUMPS = [['03', 1], ['07', 5], ['09', 7]];
const NAV_GAP = 40; // 落點離導覽列下緣最多幾 px（scroll-padding-top 是導覽列高＋12）

// 等整頁與 09 裡的捲動都停下來（連續三次一樣）
async function settle(page, ms = 4000) {
    const end = Date.now() + ms;
    let last = null;
    let same = 0;
    while (Date.now() < end) {
        const now = await page.evaluate((sec) => [window.scrollY, ...[...document.querySelectorAll(`${sec} *`)].map((e) => e.scrollTop).filter(Boolean)].join(','), SEC);
        same = now === last ? same + 1 : 0;
        last = now;
        if (same >= 3) return;
        await page.waitForTimeout(80);
    }
}

// 停下來之後量：版面是寬（清單在影片右邊）還是窄、導覽列下緣、播放器上緣與那一列有沒有被蓋住（elementFromPoint）、那一列在清單裡的位置、摘要開了沒
const LANDING = ([sec, nn]) => {
    const root = document.querySelector(sec);
    const player = root?.querySelector('[data-player]');
    const col = root?.querySelector('[data-chapters]');
    const li = root?.querySelector(`li#ch-${nn}`);
    if (!player || !col || !li) return null;
    const header = document.querySelector('header');
    const h = header && header.checkVisibility() ? header.getBoundingClientRect() : null;
    const p = player.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    const hit = (x, y, el) => { const e = document.elementFromPoint(x, y); return e ? (el.contains(e) ? 'ok' : `${e.tagName.toLowerCase()}${e.closest('header') ? '（導覽列）' : ''}`) : '畫面外'; };
    let box = li.parentElement;
    while (box && box !== root && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    const scroller = box && box !== root && box.scrollHeight > box.clientHeight + 1 ? box : null;
    const s = scroller?.getBoundingClientRect();
    const desc = li.querySelector(`[data-id="ch.${nn}.desc"]`);
    return {
        wide: p.right <= c.left + 0.5,
        nav: h && h.bottom > 0 ? h.bottom : 0,
        playerTop: p.top,
        playerHit: hit(p.left + p.width / 2, p.top + 2, player),
        rowTop: r.top,
        rowHit: hit(r.left + r.width / 2, r.top + 2, li),
        list: scroller ? { top: r.top - s.top, bottom: s.bottom - r.bottom, height: s.height, atMax: scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1 } : null,
        open: Boolean(desc && desc.checkVisibility()),
        scrollY: window.scrollY,
        hash: location.hash,
    };
};

const round = (v) => Math.round(v * 10) / 10;

test('F7.9 沒有影片時「看教學 NN」的落點（三語 × 只有手指 390、有滑鼠 1024、1440 × 03、07、09）：寬的時候落在播放器上緣、那一列捲到清單頂；窄的時候落在那一列；都沒被導覽列蓋住、摘要已打開', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [width, touch] of [[390, true], [1024, false], [1440, false]]) {
            for (const [nn, n] of JUMPS) {
                const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}「看教學 ${nn}」`;
                const { page, context, errors } = await open(noid, lang, width, { touch });
                try {
                    const link = page.locator(`[data-section="features"] [data-id="features.${n}.more"]`);
                    if (!(await link.count())) { bad.push(`${label}：找不到`); continue; }
                    await link.evaluate(toCenter);
                    await link.click();
                    await settle(page);
                    const g = await page.evaluate(LANDING, [SEC, nn]);
                    if (!g) { bad.push(`${label}：找不到 [data-player]、[data-chapters] 或 li#ch-${nn}`); continue; }
                    if (g.wide) {
                        const gap = g.playerTop - g.nav;
                        if (g.playerHit !== 'ok') bad.push(`${label}：寬的時候要落在播放器上緣，播放器上緣被蓋住（那一點是 ${g.playerHit}；播放器上緣 ${round(g.playerTop)}、導覽列下緣 ${round(g.nav)}）`);
                        else if (gap < 0 || gap > NAV_GAP) bad.push(`${label}：寬的時候要落在播放器上緣（在導覽列底下 0～${NAV_GAP}px），播放器上緣離導覽列下緣 ${round(gap)}px`);
                        if (!g.list) bad.push(`${label}：寬的時候清單要自己捲`);
                        else if (!((g.list.top >= -1 && g.list.top <= 24) || (g.list.atMax && g.list.top >= -1 && g.list.top < g.list.height - 40))) bad.push(`${label}：清單要把那一列捲到清單頂（那一列離清單上緣 ${round(g.list.top)}px${g.list.atMax ? '，清單已捲到底' : ''}）`);
                    } else {
                        const gap = g.rowTop - g.nav;
                        if (g.rowHit !== 'ok') bad.push(`${label}：窄的時候要落在那一列，那一列的上緣被蓋住（那一點是 ${g.rowHit}；那一列上緣 ${round(g.rowTop)}、導覽列下緣 ${round(g.nav)}）`);
                        else if (gap < 0 || gap > NAV_GAP) bad.push(`${label}：窄的時候要落在那一列（在導覽列底下 0～${NAV_GAP}px），那一列上緣離導覽列下緣 ${round(gap)}px`);
                    }
                    if (!g.open) bad.push(`${label}：停下來之後第 ${nn} 章的摘要要打開（看得到 ch.${nn}.desc）`);
                    if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
                } finally {
                    await context.close();
                }
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F7.9 有影片時「看教學 NN」的落點（三語 × 只有手指 390、有滑鼠 1024、1440 × 03、07、09）：從那一章播、落在播放器上緣（沒被導覽列蓋住）、寬的時候那一列在清單裡看得到', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [width, touch] of [[390, true], [1024, false], [1440, false]]) {
            for (const [nn, n] of JUMPS) {
                const label = `${lang} ${touch ? '只有手指' : '有滑鼠'} ${width}「看教學 ${nn}」`;
                const { page, context, errors } = await open(withId, lang, width, { touch });
                try {
                    const link = page.locator(`[data-section="features"] [data-id="features.${n}.more"]`);
                    if (!(await link.count())) { bad.push(`${label}：找不到`); continue; }
                    await link.evaluate(toCenter);
                    await link.click();
                    const ok = await playingClip(page, lang, nn, `「看教學 ${nn}」`);
                    if (!ok.ok) { bad.push(`${label}：${ok.why}`); continue; }
                    await settle(page);
                    const g = await page.evaluate(LANDING, [SEC, nn]);
                    if (!g) { bad.push(`${label}：找不到 [data-player]、[data-chapters] 或 li#ch-${nn}`); continue; }
                    const gap = g.playerTop - g.nav;
                    if (g.playerHit !== 'ok') bad.push(`${label}：要落在播放器上緣，播放器上緣被蓋住（那一點是 ${g.playerHit}；播放器上緣 ${round(g.playerTop)}、導覽列下緣 ${round(g.nav)}）`);
                    else if (gap < 0 || gap > NAV_GAP) bad.push(`${label}：要落在播放器上緣（在導覽列底下 0～${NAV_GAP}px），播放器上緣離導覽列下緣 ${round(gap)}px`);
                    const s = await panel(page);
                    if (JSON.stringify(s.current) !== JSON.stringify([`ch-${nn}`])) bad.push(`${label}：正在播的要標第 ${nn} 章，得到 ${JSON.stringify(s.current)}`);
                    if (g.wide && (!g.list || g.list.top < -1 || g.list.bottom < -1)) bad.push(`${label}：寬的時候正在播的那一列要在清單裡看得到（${JSON.stringify(g.list)}）`);
                    if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
                } finally {
                    await context.close();
                }
            }
        }
    }
    assert.deepEqual(bad.slice(0, 40), [], `${bad.length} 處不對`);
});

test('F7.9 有影片時按清單裡的章名（三語 × 1440，07、09、03）：只捲清單（整頁不動）、正在播的那一列在清單裡看得到', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
            for (const nn of ['07', '09', '03']) {
                const label = `${lang} 1440 第 ${nn} 章`;
                const ch = CHAPTERS[lang][Number(nn) - 1];
                const before = await page.evaluate(() => window.scrollY);
                // 那一顆可能在清單捲動範圍外：只捲清單（scrollTop）讓它露出來，不用會連整頁一起捲的方法
                await page.evaluate(([sec, id]) => {
                    const b = document.querySelector(`${sec} button[data-chapter="${id}"]`);
                    let box = b?.parentElement;
                    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
                    if (b && box) { const r = b.getBoundingClientRect(); const s = box.getBoundingClientRect(); if (r.top < s.top || r.bottom > s.bottom) box.scrollTop += r.top - s.top; }
                }, [SEC, nn]);
                const err = await startChapter(page, lang, ch);
                if (err) { bad.push(`${label}：${err}`); continue; }
                await settle(page);
                const g = await page.evaluate(LANDING, [SEC, nn]);
                if (Math.abs(g.scrollY - before) > 1) bad.push(`${label}：按章名之後整頁捲了 ${round(g.scrollY - before)}px（只能捲清單）`);
                if (!g.list || g.list.top < -1 || g.list.bottom < -1) bad.push(`${label}：正在播的那一列要在清單裡看得到（${JSON.stringify(g.list)}）`);
            }
            if (errors.length) bad.push(`${lang}：${errors.slice(0, 3).join('、')}`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

test('F7.9 關掉 JS（兩種 build、三語 × 390、1440 × 03、07、09）：「看教學 NN」照原生 #ch-NN 跳，那一章在畫面裡', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const [name, session] of [['沒有影片', noid], ['有影片', withId]]) {
        for (const lang of LANGS) {
            for (const width of [390, 1440]) {
                const { page, context } = await open(session, lang, width, { js: false });
                try {
                    for (const [nn, n] of JUMPS) {
                        const label = `${name} ${lang} ${width}「看教學 ${nn}」`;
                        const link = page.locator(`[data-section="features"] [data-id="features.${n}.more"]`);
                        if (!(await link.count())) { bad.push(`${label}：找不到`); continue; }
                        const href = await link.evaluate((e) => (e.closest('a') || e).getAttribute('href'));
                        if (href !== `#ch-${nn}`) bad.push(`${label}：href 要是 #ch-${nn}，得到 ${href}`);
                        await link.evaluate(toCenter);
                        await link.click();
                        const ok = await until(page, () => page.evaluate((id) => {
                            const li = document.getElementById(id);
                            if (!li) return { ok: false, got: `沒有 #${id}` };
                            const r = li.getBoundingClientRect();
                            return { ok: location.hash === `#${id}` && li.checkVisibility() && r.top >= -1 && r.top < innerHeight - 20, got: { hash: location.hash, visible: li.checkVisibility(), top: Math.round(r.top) } };
                        }, `ch-${nn}`), `跳到 #ch-${nn} 而且那一章在畫面裡`, 3000);
                        if (!ok.ok) bad.push(`${label}：${ok.why}`);
                    }
                } finally {
                    await context.close();
                }
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F7.10 影片載不到 ----------

// 影片框裡看得到的字（不含預覽圖的替代文字與按鈕的 aria-label）、播放鈕、「在 YouTube 上看」、正在播的章、<video> 還在不在、失敗的樣式
const FAILED = ([sec, nowWord]) => {
    const root = document.querySelector(sec);
    const frame = root.querySelector('[data-player]');
    let text = '';
    const walk = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) if (walk.currentNode.data.trim() && walk.currentNode.parentElement.checkVisibility()) text += walk.currentNode.data;
    const f = frame.getBoundingClientRect();
    const yt = root.querySelector('[data-id="tutorial.youtube"]');
    const link = yt && (yt.closest('a') || yt);
    const y = link?.checkVisibility() ? link.getBoundingClientRect() : null;
    const play = frame.querySelector('[data-play]');
    const failClass = root.querySelector('[data-tutorial]')?.getAttribute('data-fail-class');
    return {
        state: frame.getAttribute('data-state'),
        text: text.replace(/\s+/g, ' ').trim(),
        play: Boolean(play && play.checkVisibility()),
        link: y ? { gap: Math.round((y.top - f.bottom) * 10) / 10, href: link.getAttribute('href') } : null,
        current: [...root.querySelectorAll('[aria-current="true"]')].map((e) => e.closest('li')?.id ?? e.tagName),
        now: [...root.querySelectorAll('li[id^="ch-"]')].filter((li) => li.checkVisibility() && li.textContent.includes(nowWord)).map((li) => li.id),
        endcard: Boolean(root.querySelector('[data-endcard]')?.checkVisibility()),
        videos: root.querySelectorAll('video').length,
        failClass: failClass ? frame.classList.contains(failClass) : null,
    };
};

// 失敗之後的樣子：回到 idle、播放鈕回來、<video> 拿掉、沒有章被標正在播、影片框裡有一句話（框加上失敗的樣式）、「在 YouTube 上看」還在而且就在影片框底下
function failedProblems(r, lang) {
    const bad = [];
    if (r.state !== 'idle') bad.push(`影片框的 data-state 要回到 idle，得到 ${r.state}`);
    if (!r.play) bad.push('播放鈕要放回來（看得到 [data-play]）');
    if (r.videos) bad.push(`<video> 要拿掉，還有 ${r.videos} 支`);
    if (r.current.length) bad.push(`不能有章被標 aria-current="true"（得到 ${r.current.join('、')}）`);
    if (r.now.length) bad.push(`不能有章寫「${say(lang, 'tutorial.nowPlaying')}」（得到 ${r.now.join('、')}）`);
    if (!r.text) bad.push('影片框裡要有一句白話說明（看得到的字），得到空的');
    if (r.failClass !== true) bad.push(`影片框要加上 [data-tutorial] 的 data-fail-class（得到 ${r.failClass}）`);
    if (!r.link) bad.push('「在 YouTube 上看」要還在、看得到');
    else if (r.link.gap < -1 || r.link.gap > 48) bad.push(`「在 YouTube 上看」要在說明附近（就在影片框底下 0～48px），離影片框下緣 ${r.link.gap}px`);
    if (r.endcard) bad.push('不能蓋著章尾那一層');
    return bad;
}

const CLIPS_GLOB = '**/media/tutorial/**';
// play() 被拒（瀏覽器不准播、省電模式）：window.__rejectPlay 是 true 時 HTMLMediaElement 的 play() 丟 NotAllowedError
const REJECT_PLAY = () => {
    const play = HTMLMediaElement.prototype.play;
    window.__rejectPlay = true;
    HTMLMediaElement.prototype.play = function () {
        return window.__rejectPlay ? Promise.reject(new DOMException('play() 被拒（測試）', 'NotAllowedError')) : play.call(this);
    };
};

for (const lang of LANGS) {
    test(`F7.10 影片載不到（${lang}，有影片 ID，1440；mp4 擋掉、一直不回、play() 被拒各一次）：回到還沒按的樣子、說一句話指向「在 YouTube 上看」、按章名也不標正在播放、之後再按播放鈕重試得起來`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const mode of ['擋掉', '一直不回', 'play() 被拒']) {
            const { page, context, errors } = await open(withId, lang, 1440, { time: mode === '一直不回', init: mode === 'play() 被拒' ? [REJECT_PLAY] : [] });
            // 一直不回的那幾個，重試之前才讓它失敗：不然瀏覽器可能把重試的同一個網址併進那個還沒回的請求
            const pending = [];
            const block = (route) => (mode === '擋掉' ? route.abort() : pending.push(route));
            if (mode !== 'play() 被拒') await context.route(CLIPS_GLOB, block);
            const fail = async (what) => {
                if (mode === '一直不回') await page.clock.runFor(LOAD_TIMEOUT_MAX * 1000);
                const ok = await until(page, async () => { const r = await page.evaluate(FAILED, [SEC, say(lang, 'tutorial.nowPlaying')]); return { ok: failedProblems(r, lang).length === 0, got: r }; }, `${mode}，${what}：回到還沒按的樣子`, 5000);
                const r = await page.evaluate(FAILED, [SEC, say(lang, 'tutorial.nowPlaying')]);
                for (const b of failedProblems(r, lang)) bad.push(`${mode}，${what}：${b}`);
                return ok.ok;
            };
            try {
                await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
                const play = page.locator(`${SEC} [data-player] [data-play]`);
                if ((await play.count()) !== 1) { bad.push(`${mode}：要有播放鈕`); continue; }
                await play.click();
                if (mode === '一直不回') {
                    await page.waitForTimeout(300);
                    const s = await panel(page);
                    if (s.current.length) bad.push(`${mode}：影片還沒回來（載入中）就標了 ${s.current.join('、')}（真的播起來才標）`);
                    // 還在等影片時按第 04 章
                    await page.locator(`${SEC} button[data-chapter="04"]`).click();
                    await page.waitForTimeout(300);
                    const s4 = await panel(page);
                    if (s4.current.length) bad.push(`${mode}：還在等影片時按第 04 章，不能標 ${s4.current.join('、')}`);
                }
                await fail(mode === '一直不回' ? `按了播放之後 ${LOAD_TIMEOUT_MAX} 秒` : '按了播放之後');
                // 失敗之後（還是載不到）按第 04 章：一樣不能標成正在播放
                await page.locator(`${SEC} button[data-chapter="04"]`).click();
                await page.waitForTimeout(300);
                await fail('失敗之後按第 04 章');
                // 網路好了，再按播放鈕：要播得起來
                if (mode === 'play() 被拒') await page.evaluate(() => { window.__rejectPlay = false; });
                else {
                    await context.unroute(CLIPS_GLOB, block);
                    for (const route of pending) await route.abort().catch(() => {});
                }
                if (await play.isVisible()) {
                    await play.click();
                    const ok = await playingClip(page, lang, '01', `${mode}：好了之後再按播放鈕`);
                    if (!ok.ok) bad.push(ok.why);
                    else {
                        const r = await page.evaluate(FAILED, [SEC, say(lang, 'tutorial.nowPlaying')]);
                        if (r.failClass) bad.push(`${mode}：重試播起來之後，影片框還帶著失敗的樣式`);
                        if (await page.locator(`${SEC} [data-api-fail]`).isVisible()) bad.push(`${mode}：重試播起來之後，載不到那一句還在`);
                    }
                } else bad.push(`${mode}：沒辦法重試（播放鈕看不到）`);
                if (errors.length) bad.push(`${mode}：${errors.slice(0, 3).join('、')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

test('F7.10 真的播起來才標那一章（三語，有影片 ID，1440）：影片還沒回來時 data-state 是 loading、不標任何章、不寫「正在播放」；回來播起來才標', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        const { page, context, errors } = await open(withId, lang, 1440);
        const pending = [];
        const hold = (route) => pending.push(route);
        await context.route(CLIPS_GLOB, hold);
        try {
            await page.locator(SEC).evaluate(toCenter);
            await page.locator(`${SEC} button[data-chapter="03"]`).click();
            const asked = await until(page, async () => ({ ok: pending.length > 0, got: pending.length }), '防呆：要攔到 03.mp4 的請求', 5000);
            if (!asked.ok) { bad.push(`${lang}：${asked.why}`); continue; }
            await page.waitForTimeout(300);
            const r = await page.evaluate(FAILED, [SEC, say(lang, 'tutorial.nowPlaying')]);
            if (r.state !== 'loading') bad.push(`${lang}：影片還沒回來時 data-state 要是 loading，得到 ${r.state}`);
            if (r.current.length || r.now.length) bad.push(`${lang}：影片還沒回來就標了 ${[...r.current, ...r.now].join('、')}（真的播起來才標）`);
            await context.unroute(CLIPS_GLOB, hold);
            for (const route of pending) await route.fallback().catch(() => {});
            const ok = await playingClip(page, lang, '03', '影片回來之後');
            if (!ok.ok) { bad.push(`${lang}：${ok.why}`); continue; }
            const s = await panel(page);
            if (JSON.stringify(s.current) !== '["ch-03"]') bad.push(`${lang}：播起來之後要標第 03 章，得到 ${JSON.stringify(s.current)}`);
            if (errors.length) bad.push(`${lang}：${errors.slice(0, 3).join('、')}`);
        } finally {
            await context.close();
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});

// ---------- F7.15 用鍵盤按播放鈕之後的焦點 ----------

// 現在焦點在哪：不是 <body>／<html>、看得到、在影片框裡（含 <video>）、是不是播放鈕
const FOCUS = (sec) => {
    const a = document.activeElement;
    const body = !a || a === document.body || a === document.documentElement;
    return {
        body, inPlayer: Boolean(!body && a.closest(`${sec} [data-player]`)), visible: Boolean(!body && a.checkVisibility()), play: Boolean(!body && a.matches(`${sec} [data-play]`)),
        what: body ? (a ? a.tagName.toLowerCase() : 'null') : `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ''}${a.getAttribute('data-play') !== null ? '[data-play]' : ''}${a.checkVisibility() ? '' : '（看不到）'}`,
    };
};

// 走鍵盤的路：焦點放到 09 前面最後一個 Tab 停得到的東西（page-helpers.js 的 FOCUS_BEFORE），再按 Tab 直到停在播放鈕
// 回傳 null＝停在播放鈕了；不然是一路停過的地方（寫進失敗訊息）
async function tabToPlay(page) {
    await page.evaluate(FOCUS_BEFORE, SEC);
    const seen = [];
    for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(FOCUS, SEC);
        if (f.play) return null;
        seen.push(f.what);
    }
    return seen.join(' → ');
}

for (const lang of LANGS) {
    test(`F7.15 用鍵盤按播放鈕之後的焦點（${lang}，有影片 ID，1440）：按 Enter 之後播放鈕藏起來，焦點不掉到 <body>；播起來之後在影片框裡；載不到時留在播放鈕；重試播起來之後也在影片框裡`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const reasonable = (f, when) => {
            if (f.body) bad.push(`${when}：焦點掉到 <${f.what}>，要留在影片框裡（或一個明確、看得到的元素）`);
            else if (!f.inPlayer || !f.visible) bad.push(`${when}：焦點要在影片框裡、看得到，現在在 ${f.what}`);
        };
        // 一般：載得到
        {
            const { page, context, errors } = await open(withId, lang, 1440);
            try {
                await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
                const path1 = await tabToPlay(page);
                if (path1) bad.push(`從 09 前面那個連結按 Tab 走不到播放鈕（停過：${path1}）`);
                else {
                    await page.keyboard.press('Enter');
                    reasonable(await page.evaluate(FOCUS, SEC), '剛按下 Enter（播放鈕藏起來、影片載入中）');
                    const ok = await playingClip(page, lang, '01', '用鍵盤按播放鈕');
                    if (!ok.ok) bad.push(ok.why);
                    else reasonable(await page.evaluate(FOCUS, SEC), '開始播放之後');
                }
                if (errors.length) bad.push(...errors.slice(0, 3));
            } finally {
                await context.close();
            }
        }
        // 載不到 → 焦點留在播放鈕 → 網路好了再按 Enter → 播起來之後焦點在影片框裡
        {
            const { page, context, errors } = await open(withId, lang, 1440);
            const block = (route) => route.abort();
            await context.route(CLIPS_GLOB, block);
            try {
                await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
                const path2 = await tabToPlay(page);
                if (path2) bad.push(`載不到那次：從 09 前面那個連結按 Tab 走不到播放鈕（停過：${path2}）`);
                else {
                    await page.keyboard.press('Enter');
                    const back = await until(page, async () => { const f = await page.evaluate(FOCUS, SEC); return { ok: f.play, got: f.what }; }, '載不到之後焦點要回到播放鈕', 5000);
                    if (!back.ok) bad.push(back.why);
                    await context.unroute(CLIPS_GLOB, block);
                    if (back.ok) {
                        await page.keyboard.press('Enter');
                        reasonable(await page.evaluate(FOCUS, SEC), '重試：剛按下 Enter');
                        const ok = await playingClip(page, lang, '01', '網路好了用鍵盤再按播放鈕');
                        if (!ok.ok) bad.push(ok.why);
                        else reasonable(await page.evaluate(FOCUS, SEC), '重試：開始播放之後');
                    }
                }
                if (errors.length) bad.push(...errors.slice(0, 3));
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F7.16 <video> 本身 ----------

for (const lang of LANGS) {
    test(`F7.16 <video>（${lang}，有影片 ID，1440）：沒有 controls、muted、playsinline、不給子母畫面與下載、tabindex=0；點影片、空白鍵、Enter、k 暫停與繼續`, { skip: pw ? false : why }, async () => {
        const bad = [];
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(SEC).evaluate(toCenter);
            await page.locator(`${SEC} [data-player] [data-play]`).click();
            const ok = await playingClip(page, lang, '01', '按了播放鈕');
            assert.ok(ok.ok, ok.why);
            const a = await page.locator(`${SEC} [data-player] video`).evaluate((v) => ({
                controlsAttr: v.hasAttribute('controls'), controls: v.controls, muted: v.muted, mutedAttr: v.hasAttribute('muted'), playsinline: v.hasAttribute('playsinline'),
                pip: v.hasAttribute('disablepictureinpicture') && v.disablePictureInPicture === true, list: (v.getAttribute('controlslist') || '').split(/\s+/), tabindex: v.getAttribute('tabindex'),
            }));
            if (a.controlsAttr || a.controls) bad.push(`<video> 不能有 controls（瀏覽器內建的控制列不出現），得到屬性 ${a.controlsAttr}、property ${a.controls}`);
            if (!a.muted || !a.mutedAttr) bad.push(`<video> 要靜音（muted 屬性與 property），得到屬性 ${a.mutedAttr}、property ${a.muted}`);
            if (!a.playsinline) bad.push('<video> 要 playsinline（iPhone 不自動全螢幕）');
            if (!a.pip) bad.push('<video> 要 disablepictureinpicture（不給子母畫面）');
            if (!a.list.includes('nodownload')) bad.push(`<video> 的 controlslist 要有 nodownload，得到「${a.list.join(' ')}」`);
            if (a.tabindex !== '0') bad.push(`<video> 要 tabindex="0"（鍵盤停得到、空白鍵暫停），得到 ${a.tabindex}`);
            const state = async () => ({ s: (await panel(page)).state, v: await player(page) });
            const paused = async (want, what) => {
                const r = await until(page, async () => { const x = await state(); return { ok: want ? x.v.paused && x.s === 'paused' : !x.v.paused && x.s === 'playing', got: x }; }, what, 3000);
                if (!r.ok) bad.push(r.why);
            };
            // 點影片
            await page.locator(`${SEC} [data-player] video`).click();
            await paused(true, '點影片要暫停（data-state paused）');
            await page.locator(`${SEC} [data-player] video`).click();
            await paused(false, '再點一次要繼續播（data-state playing）');
            // 鍵盤：焦點在影片上
            await page.locator(`${SEC} [data-player] video`).focus();
            const y0 = await page.evaluate(() => window.scrollY);
            await page.keyboard.press('Space');
            await paused(true, '空白鍵要暫停');
            if (Math.abs((await page.evaluate(() => window.scrollY)) - y0) > 1) bad.push('在影片上按空白鍵，整頁不能跟著捲（要擋掉預設動作）');
            await page.keyboard.press('Enter');
            await paused(false, 'Enter 要繼續播');
            await page.keyboard.press('k');
            await paused(true, 'k 要暫停');
            await page.keyboard.press('k');
            await paused(false, '再按 k 要繼續播');
            if (errors.length) bad.push(...errors.slice(0, 3));
        } finally {
            await context.close();
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

// ---------- F7.12 Esc 收掉章尾那一層之後的焦點 ----------

for (const lang of LANGS) {
    test(`F7.12 Esc 收掉章尾那一層（${lang}，有影片 ID，1440）：焦點回到影片框或正在播的那一章的按鈕，不是 <body>`, { skip: pw ? false : why }, async () => {
        const chapters = CHAPTERS[lang];
        const { page, context, errors } = await open(withId, lang, 1440);
        try {
            await page.locator(SEC).evaluate(toCenter);
            const ch = chapters[2];
            assert.equal(await startChapter(page, lang, ch), null);
            const end = await toEnd(page);
            assert.ok(end.ok, `第 03 章：${end.why}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            assert.equal((await panel(page)).endcard, false, 'Esc 要收掉章尾那一層');
            const focus = await page.evaluate(([sec, id]) => {
                const a = document.activeElement;
                if (!a || a === document.body || a === document.documentElement) return { ok: false, got: a ? a.tagName.toLowerCase() : 'null' };
                const inFrame = Boolean(a.closest(`${sec} [data-player]`));
                const row = a.matches(`${sec} button[data-chapter="${id}"]`);
                return { ok: (inFrame || row) && a.checkVisibility(), got: `${a.tagName.toLowerCase()}${a.getAttribute('data-id') ? `[data-id=${a.getAttribute('data-id')}]` : ''}${a.getAttribute('data-chapter') ? `[data-chapter=${a.getAttribute('data-chapter')}]` : ''}${inFrame ? '（影片框裡）' : ''}${a.checkVisibility() ? '' : '（看不到）'}` };
            }, [SEC, ch.id]);
            assert.ok(focus.ok, `Esc 之後焦點要在影片框（或框裡看得到的元素）或第 ${ch.id} 章的按鈕，現在在 ${focus.got}`);
            assert.deepEqual(errors, [], '不能有頁面錯誤');
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    test(`F7.12 Esc 之後的焦點（${lang}，有影片 ID，只有手指 390）：第 05 章播完按「播下一段」→ 第 06 章（收在「看全部」裡）播完 → Esc：焦點在第 06 章看得到的按鈕；打開「看全部」時影片框不跳`, { skip: pw ? false : why }, async () => {
        const chapters = CHAPTERS[lang];
        const { page, context, errors } = await open(withId, lang, 390, { touch: true });
        try {
            await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
            const five = chapters[4];
            const rest = () => page.evaluate(() => { const li = document.getElementById('ch-06'); const d = li?.parentElement.closest('details'); return d ? d.open : null; });
            assert.equal(await rest(), false, '防呆：390 時第 06 章要收在還沒打開的「看全部」裡');
            assert.equal(await startChapter(page, lang, five), null);
            let end = await toEnd(page);
            assert.ok(end.ok, `第 05 章：${end.why}`);
            const s = await panel(page);
            assert.equal(s.focus, 'tutorial.next', `第 05 章播完焦點要在「播下一段」，得到 ${s.focus}`);
            const top = () => page.locator(`${SEC} [data-player]`).evaluate((f) => f.getBoundingClientRect().top);
            const before = await top();
            await page.keyboard.press('Enter');
            const ok = await playingClip(page, lang, '06', '「播下一段」');
            assert.ok(ok.ok, ok.why);
            await page.waitForTimeout(300);
            const bad = [];
            const moved = (await top()) - before;
            if (Math.abs(moved) > 1) bad.push(`播到第 06 章（打開「看全部」）時影片框不能跳，上緣移了 ${moved.toFixed(1)}px`);
            end = await toEnd(page);
            assert.ok(end.ok, `第 06 章：${end.why}`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            assert.equal((await panel(page)).endcard, false, 'Esc 要收掉章尾那一層');
            const focus = await page.evaluate((sec) => {
                const a = document.activeElement;
                if (!a || a === document.body || a === document.documentElement) return { ok: false, got: a ? a.tagName.toLowerCase() : 'null' };
                const row = a.matches(`${sec} button[data-chapter="06"]`);
                const inFrame = Boolean(a.closest(`${sec} [data-player]`));
                return { ok: (row || inFrame) && a.checkVisibility(), got: `${a.tagName.toLowerCase()}${a.getAttribute('data-chapter') ? `[data-chapter=${a.getAttribute('data-chapter')}]` : ''}${a.checkVisibility() ? '' : '（看不到）'}` };
            }, SEC);
            if (!focus.ok) bad.push(`Esc 之後焦點要在第 06 章看得到的按鈕（或影片框裡），現在在 ${focus.got}${(await rest()) ? '' : '（「看全部」還收著）'}`);
            bad.push(...errors.slice(0, 3));
            assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
        } finally {
            await context.close();
        }
    });
}

// ---------- F7.13 影片 ID 的格式 ----------

// 一語填一個不合格的值，其他兩語填合格的假 ID：build 要失敗、訊息裡同一行講到格式與那一語
const BAD_IDS = [['zh', 'https://youtu.be/TstZh000001', '整個網址'], ['en', 'TstEn02', '太短'], ['ja', 'TstJa 00003', '含空白']];
const builtBad = [];
after(() => { for (const b of builtBad) b.cleanup(); });

for (const [lang, value, kind] of BAD_IDS) {
    test(`F7.13 影片 ID 格式不對（${lang} 填${kind}「${value}」）：產生網頁要失敗，訊息講到格式與是哪一語`, () => {
        const ids = { ...IDS, [lang]: value };
        const b = buildCopy({
            label: `tutorial-bad-id-${lang}`,
            prepare: (copy) => {
                const file = path.join(copy, 'app', 'site.js');
                const src = fs.readFileSync(file, 'utf8');
                if (!ID_LINE.test(src)) throw new Error('app/site.js 要有一行 export const TUTORIAL_VIDEO_IDS = { … };（見 F7.0）');
                fs.writeFileSync(file, src.replace(ID_LINE, `export const TUTORIAL_VIDEO_IDS = { zh: ${JSON.stringify(ids.zh)}, en: ${JSON.stringify(ids.en)}, ja: ${JSON.stringify(ids.ja)} };`));
            },
        });
        builtBad.push(b);
        assert.notEqual(b.status, 0, `${lang} 的影片 ID 是「${value}」（${kind}），build 卻成功了 —— 要檢查 /^[A-Za-z0-9_-]{11}$/（或空字串），不合格就讓 build 失敗`);
        const lines = b.output.split('\n');
        const why = lines.find((l) => /格式|format/i.test(l) && (l.includes(value) || new RegExp(`\\b${lang}\\b`).test(l)));
        assert.ok(why, `build 失敗的訊息要有一行同時講到格式（「格式」或 format）與是哪一語（${lang} 或那個值）；輸出最後幾行：\n${tail(b.output, 15)}`);
    });
}

test('F7.13 影片 ID 合格與空字串都 build 得過（三語合格的假 ID：有影片那一份；三語空字串：沒有影片那一份）', () => {
    const empty = noIdOut();   // 2026-10-07：out/ 現在是真的 ID，空字串那一份改用暫存複本
    for (const lang of LANGS) assert.ok(fs.existsSync(path.join(empty, lang, 'index.html')), `三語空字串的 ${lang}/index.html 要在`);
    const dir = withIdOut();
    for (const lang of LANGS) assert.ok(fs.existsSync(path.join(dir, lang, 'index.html')), `三語合格 ID 的 ${lang}/index.html 要在`);
    for (const id of Object.values(IDS)) assert.match(id, /^[A-Za-z0-9_-]{11}$/, `防呆：測試用的假 ID「${id}」本身要合格`);
});

// ---------- F7.14 兩句的版位 ----------

const near = (v, want) => Math.abs(v - want) <= 1;

for (const lang of LANGS) {
    test(`F7.14 載入失敗那一句的版位（${lang}，有影片 ID，只有手指 280、320、390，有滑鼠 640、1024、1440）：role="status"；手機蓋滿影片框、字不壓播放鈕、播放鈕 ≥ 44 而且按得到；640 起在框的左上角（上 16、左 24）；焦點留在播放鈕`, { skip: pw ? false : why }, async () => {
        const bad = [];
        for (const [width, touch] of [[280, true], [320, true], [390, true], [640, false], [1024, false], [1440, false]]) {
            const label = `${width}`;
            const { page, context, errors } = await open(withId, lang, width, { touch });
            await context.route(CLIPS_GLOB, (route) => route.abort());
            try {
                await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
                const play = page.locator(`${SEC} [data-player] [data-play]`);
                // 用鍵盤按：按下去播放鈕會藏起來，失敗之後焦點要回到它（不掉到 <body>）
                await play.focus();
                await page.keyboard.press('Enter');
                const shown = await until(page, async () => { const got = await page.evaluate(() => Boolean(document.querySelector('[data-api-fail]')?.checkVisibility())); return { ok: got, got }; }, '載入失敗那一句要出現');
                if (!shown.ok) { bad.push(`${label}：${shown.why}`); continue; }
                await page.waitForTimeout(100);
                const r = await page.evaluate((sec) => {
                    const frame = document.querySelector(`${sec} [data-player]`);
                    const fail = frame.querySelector('[data-api-fail]');
                    const play = frame.querySelector('[data-play]');
                    const f = frame.getBoundingClientRect();
                    const n = fail.getBoundingClientRect();
                    const p = play.getBoundingClientRect();
                    const range = document.createRange();
                    range.selectNodeContents(fail);
                    const rects = [...range.getClientRects()].filter((g) => g.width > 0.5);
                    const t = { left: Math.min(...rects.map((g) => g.left)), right: Math.max(...rects.map((g) => g.right)), top: Math.min(...rects.map((g) => g.top)), bottom: Math.max(...rects.map((g) => g.bottom)) };
                    const hit = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
                    const r1 = (v) => Math.round(v * 10) / 10;
                    const c = document.createElement('canvas').getContext('2d');
                    c.fillStyle = getComputedStyle(fail).backgroundColor;
                    c.fillRect(0, 0, 1, 1);
                    return {
                        role: fail.getAttribute('role'),
                        text: fail.textContent.replace(/\s+/g, ' ').trim(),
                        frame: { w: r1(f.width), h: r1(f.height) },
                        cover: { left: r1(n.left - f.left), top: r1(n.top - f.top), right: r1(f.right - n.right), bottom: r1(f.bottom - n.bottom) },
                        alpha: c.getImageData(0, 0, 1, 1).data[3],
                        textIn: t.left >= f.left - 0.5 && t.right <= f.right + 0.5 && t.top >= f.top - 0.5 && t.bottom <= f.bottom + 0.5,
                        toPlay: r1(Math.max(p.left - t.right, t.left - p.right, p.top - t.bottom, t.top - p.bottom)),
                        boxToPlay: r1(Math.max(p.left - n.right, n.left - p.right, p.top - n.bottom, n.top - p.bottom)),
                        play: { w: r1(p.width), h: r1(p.height) },
                        hit: Boolean(hit && play.contains(hit)),
                        hitWhat: hit ? `${hit.tagName.toLowerCase()}${hit.hasAttribute('data-api-fail') ? '[data-api-fail]' : ''}` : null,
                        focus: document.activeElement === play ? 'play' : `${document.activeElement?.tagName.toLowerCase()}`,
                    };
                }, SEC);
                if (r.role !== 'status') bad.push(`${label}：那一句要 role="status"（讀屏念出來），得到 ${r.role}`);
                if (r.text !== flat(say(lang, 'tutorial.apifail'))) bad.push(`${label}：字要是 tutorial.apifail「${flat(say(lang, 'tutorial.apifail'))}」，得到「${r.text}」`);
                if (!r.textIn) bad.push(`${label}：字跑出影片框`);
                if (!r.hit) bad.push(`${label}：播放鈕中心被蓋住（elementFromPoint 打到 ${r.hitWhat}），要按得到`);
                if (r.play.w < 43.5 || r.play.h < 43.5) bad.push(`${label}：播放鈕 ${r.play.w}×${r.play.h}，要 ≥ 44×44`);
                if (r.focus !== 'play') bad.push(`${label}：失敗之後焦點要在播放鈕（那一句是 role="status"，不搶焦點），得到 ${r.focus}`);
                if (width < 640) {
                    if (!(near(r.cover.left, 0) && near(r.cover.top, 0) && near(r.cover.right, 0) && near(r.cover.bottom, 0))) bad.push(`${label}：手機那一層要蓋滿整個影片框，離框邊 ${JSON.stringify(r.cover)}`);
                    if (r.alpha !== 255) bad.push(`${label}：手機那一層的底要不透明（不會字疊在封面的字上），alpha ${r.alpha}`);
                    if (r.toPlay < 8) bad.push(`${label}：字離播放鈕只有 ${r.toPlay}px（要 ≥ 8，不壓播放鈕）`);
                } else {
                    if (!near(r.cover.top, 16) || !near(r.cover.left, 24)) bad.push(`${label}：640 起那一句在框的左上角（上 16、左 24），得到上 ${r.cover.top}、左 ${r.cover.left}`);
                    if (r.boxToPlay < 8) bad.push(`${label}：那一句的框離播放鈕只有 ${r.boxToPlay}px（要 ≥ 8）`);
                }
                if (errors.length) bad.push(`${label}：${errors.slice(0, 3).join('、')}`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(bad, [], `${lang}：${bad.length} 處不對`);
    });
}

test('F7.14 沒有影片那一句的版位（三語 × 只有手指 280、390，有滑鼠 640、1024、1440）：手機排在影片框外面（框底下 16、離畫面左邊 16、不超出右邊）；640 起疊在框的左下角（左 24、下 24、在框裡）', { skip: pw ? false : why }, async () => {
    const bad = [];
    for (const lang of LANGS) {
        for (const [width, touch] of [[280, true], [390, true], [640, false], [1024, false], [1440, false]]) {
            const label = `${lang} ${width}`;
            const { page, context } = await open(noid, lang, width, { touch });
            try {
                await page.locator(`${SEC} [data-player]`).evaluate(toCenter);
                const r = await page.evaluate((sec) => {
                    const frame = document.querySelector(`${sec} [data-player]`);
                    const note = document.querySelector(`${sec} [data-id="tutorial.noid.note"]`);
                    if (!frame || !note || !note.checkVisibility()) return null;
                    const f = frame.getBoundingClientRect();
                    const n = note.getBoundingClientRect();
                    const r1 = (v) => Math.round(v * 10) / 10;
                    return { inFrame: frame.contains(note), below: r1(n.top - f.bottom), left: r1(n.left), right: r1(innerWidth - n.right), inLeft: r1(n.left - f.left), inBottom: r1(f.bottom - n.bottom), inRight: r1(f.right - n.right), inTop: r1(n.top - f.top) };
                }, SEC);
                if (!r) { bad.push(`${label}：找不到看得到的那一句（data-id="tutorial.noid.note"）`); continue; }
                if (r.inFrame) bad.push(`${label}：那一句要放在影片框外面（框的下一個兄弟），不是 [data-player] 裡面`);
                if (width < 640) {
                    if (!near(r.below, 16)) bad.push(`${label}：手機那一句要排在影片框底下隔 16，得到 ${r.below}`);
                    if (!near(r.left, 16)) bad.push(`${label}：手機那一句離畫面左邊要 16，得到 ${r.left}`);
                    if (r.right < 15) bad.push(`${label}：手機那一句離畫面右邊 ${r.right}（要 ≥ 16）`);
                } else {
                    if (!near(r.inLeft, 24) || !near(r.inBottom, 24)) bad.push(`${label}：640 起那一句疊在框的左下角（左 24、下 24），得到左 ${r.inLeft}、下 ${r.inBottom}`);
                    if (r.inRight < 23 || r.inTop < 0) bad.push(`${label}：640 起那一句要在框裡（右 ${r.inRight}、上 ${r.inTop}）`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(bad, [], `${bad.length} 處不對`);
});
