// F3.9 通用（十二種寬度 × 三語的版面、減少動態、關掉 JS、內嵌腳本、照設計稿的數字）與 F3.10 換行樣式、字跟字串表一致。
// 讀 out/（真的內容），真的開瀏覽器。設計稿的數字取自 design/homepage/home.css（第二批）：
//   --nav-h：手機 64（--space-60 ＋ --space-4）、1024 起 72（--space-60 ＋ --space-12）；公告條 min-height 60（--tap ＋ --space-16）；
//   按鈕、圖示鈕、語言切換每一段 44（--tap）；☰ 選單的連結 52（--tap ＋ --space-8）；
//   兩邊留白 --gx：手機 16、640 起 32；內容最寬 1180（--max）→ 1440 寬時內容左緣在 (1440 − 1180 − 64) / 2 ＋ 32 ＝ 130。
//
// 量什麼：
//   F3.9 十二種寬度 × 三語（有滑鼠；320、390 另外量只有手指）：不橫捲（scrollWidth ≤ innerWidth）；導覽列上看得到的東西（記號、導覽連結、語言切換、加到 Chrome、☰）
//        互不重疊；公告條的「公告」標籤、標題、✕ 互不重疊；導覽列與公告條每一個按鈕與連結裡的字沒跑出框（scrollWidth ≤ clientWidth＋1）；
//        收成 ☰ 的寬度打開選單：選單不橫捲。日文 320、1024 一定在裡面（十二種寬度都量）。
//   F3.9 減少動態：開頁後、打開選單後，沒有在跑的動畫（getAnimations 裡時間 > 1ms 的）。
//   F3.9 關掉 JS：1440 寬三語，導覽列六個連結的字、公告條的標題都看得到。
//   F3.9 網站自己的 CSS 不用 --mira-*（只用語意 token；寫死色碼由 F1.5 那條守）。
//   F3.9 out/ 的每一頁 HTML：沒有自己寫的內嵌腳本 —— 沒有 src 的 <script> 只能是 type="application/ld+json"，或 Next.js 自己放的 self.__next_f（規格書第 3 節）。
//   F3.9 照設計稿的數字：導覽列高 72（1024 起）／64（以下）；公告條高 60（1440，一行）、窄的時候 ≥ 60；加到 Chrome 高 44；☰ 44×44；語言切換每段 44；
//        選單的連結高 52；內容左緣（記號的左邊）在 16（< 640）、32（640～1243）、130（1440）；捲下去之後導覽列釘在最上面、公告條跟著捲走。
//   F3.10 中文：導覽列、選單、main、公告條標題的 word-break 都是 keep-all，公告條標題另外 overflow-wrap: anywhere（設計第三批）；
//         日文 auto-phrase（公告條標題在 lang="ja" 的元素裡）；英文 normal；:root 的 --measure 是 25em。
//   F3.10 公告條標題的詞界 <wbr>（後端 bindTail 插的）：中文的 DOM 裡有 <wbr>，日文、英文沒有（用 content/ 真的內容：有一則置頂、一定看得到）。
//   F3.10 導覽列與公告條的字跟字串表逐字一樣：六個連結、加到 Chrome、記號的名字（nav.brand）、導覽的讀屏名字（nav.label）、語言切換（lang.label）、
//         ☰（nav.menu.open）、「公告」標籤（bulletin.label）、✕（bulletin.close）、跳到主要內容（nav.skip，連到 #main）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.9|F3.10"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OUT, LANGS, needOut, listFiles, siteCss, stripCssComments, playwright, browserSession } from './helpers.js';
import { parts, bulletinParts, say, NAV_IDS, WIDTHS } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, contextOptions = {}, height = 900) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height }, ...contextOptions });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);   // 找不到東西時 15 秒就紅（預設 30 秒；5 秒在機器忙時開頁會逾時，量過）
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    return { page, context };
}

async function boxes(locators) {
    const out = [];
    for (const [name, locator] of locators) {
        const count = await locator.count();
        for (let i = 0; i < count; i += 1) {
            const el = locator.nth(i);
            if (await el.isVisible()) out.push({ name: count > 1 ? `${name} ${i + 1}` : name, box: await el.boundingBox() });
        }
    }
    return out;
}

function overlaps(items) {
    const bad = [];
    for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i].box;
            const b = items[j].box;
            const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            if (w > 0.5 && h > 0.5) bad.push(`${items[i].name} × ${items[j].name}`);
        }
    }
    return bad;
}

async function check(page, lang, label) {
    const problems = [];
    const p = await parts(page, lang);
    const b = bulletinParts(page, lang);
    if (!p.menuId) problems.push('找不到導覽列的 ☰（header 裡帶 aria-controls 的 button）—— 量不到導覽列');
    const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    if (scroll.sw > scroll.iw) problems.push(`橫捲：scrollWidth ${scroll.sw} > ${scroll.iw}`);
    const row = await boxes([['記號', p.brand], ['導覽連結', p.bar.locator('a')], ['語言切換', p.langGroup], ['加到 Chrome', p.cta], ['☰', p.menuButton]]);
    problems.push(...overlaps(row).map((s) => `導覽列重疊：${s}`));
    if (await b.region.count()) {
        const strip = await boxes([['公告標籤', b.region.getByText(say(lang, 'bulletin.label'), { exact: true })], ['公告標題', b.text], ['✕', b.close]]);
        problems.push(...overlaps(strip).map((s) => `公告條重疊：${s}`));
    }
    const spill = await page.locator('header a:visible, header button:visible, [role="region"] a:visible, [role="region"] button:visible')
        .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
            .map((el) => `${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}（${el.scrollWidth} > ${el.clientWidth}）`));
    problems.push(...spill.map((s) => `字跑出框：${s}`));
    if (await p.menuButton.isVisible()) {
        await p.menuButton.click();
        const menu = await p.menu.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth })).catch(() => null);
        if (menu && menu.sw > menu.cw + 1) problems.push(`選單橫捲：${menu.sw} > ${menu.cw}`);
        await page.keyboard.press('Escape');
    }
    return problems.map((s) => `${label}：${s}`);
}

for (const lang of LANGS) {
    test(`F3.9 十二種寬度（${lang}）：不橫捲、導覽列與公告條不重疊、字不跑出框、選單不橫捲（320、390 另外量只有手指）`, { skip: pw ? false : why }, async () => {
        const problems = [];
        for (const width of WIDTHS) {
            const { page, context } = await open(lang, width);
            try { problems.push(...await check(page, lang, `${lang} ${width}`)); } finally { await context.close(); }
        }
        for (const width of [320, 390]) {
            const { page, context } = await open(lang, width, { isMobile: true, hasTouch: true }, 844);
            try { problems.push(...await check(page, lang, `${lang} ${width} 只有手指`)); } finally { await context.close(); }
        }
        assert.deepEqual(problems, [], `${problems.length} 個版面問題`);
    });
}

test('F3.9 減少動態：開頁後、打開選單後沒有在跑的動畫（三語 390、1440）', { skip: pw ? false : why }, async () => {
    const running = () => document.getAnimations()
        .filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration ?? 0) > 1)
        .map((a) => `${a.constructor.name} ${a.animationName || a.transitionProperty || ''} @ ${a.effect?.target?.className || a.effect?.target?.nodeName}`);
    for (const lang of LANGS) {
        for (const width of [390, 1440]) {
            const { page, context } = await open(lang, width, { reducedMotion: 'reduce' });
            try {
                assert.deepEqual(await page.evaluate(running), [], `${lang} ${width}：減少動態時開頁就有動畫在跑`);
                const p = await parts(page, lang);
                if (await p.menuButton.isVisible()) {
                    await p.menuButton.click();
                    assert.deepEqual(await page.evaluate(running), [], `${lang} ${width}：減少動態時打開選單有動畫`);
                }
            } finally {
                await context.close();
            }
        }
    }
});

test('F3.9 關掉 JS：導覽列的六個連結、公告條的標題都看得到（1440 三語）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440, { javaScriptEnabled: false });
        try {
            const p = await parts(page, lang);
            for (const id of NAV_IDS) assert.ok(await p.bar.getByRole('link', { name: say(lang, id) }).isVisible(), `${lang} 關掉 JS：導覽列要看得到「${say(lang, id)}」`);
            const b = bulletinParts(page, lang);
            assert.equal(await b.region.count(), 1, `${lang} 關掉 JS：公告條要在（內容寫在 HTML 裡，不靠 JS）`);
            assert.ok((await b.text.textContent()).trim().length > 0, `${lang} 關掉 JS：公告條的標題要看得到`);
        } finally {
            await context.close();
        }
    }
});

test('F3.9 網站自己的 CSS 不用 --mira-*（只用語意 token）', () => {
    const files = siteCss();
    assert.ok(files.length > 0, 'app/、components/ 底下沒有網站自己的 CSS？');
    const bad = files.filter(({ text }) => /var\(\s*--mira-/.test(stripCssComments(text))).map(({ rel }) => rel);
    assert.deepEqual(bad, [], '這些 CSS 直接用了設計系統的 --mira-* 原色（要用 --color-* 這類語意 token）');
});

test('F3.9 out/ 的 HTML 沒有自己寫的內嵌腳本（只准 JSON-LD 與 Next.js 的 self.__next_f）', () => {
    needOut();
    const bad = [];
    for (const rel of listFiles(OUT).filter((r) => r.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(OUT, ...rel.split('/')), 'utf8');
        for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/\bsrc\s*=/.test(m[1])) continue;
            if (/type\s*=\s*["']?application\/ld\+json/i.test(m[1])) continue;
            if (/^\s*\(?\s*self\.__next_f\b/.test(m[2])) continue;
            bad.push(`${rel}：<script${m[1]}>${m[2].trim().slice(0, 60)}…`);
        }
    }
    assert.deepEqual(bad, [], '自己寫的程式要放外部 .js（Live Server 會往 HTML 插腳本、SEO 規格書第 3 節）');
});

const LEFT = (width) => (width >= 1244 ? (width - 1244) / 2 + 32 : width >= 640 ? 32 : 16);

test('F3.9 照設計稿的數字：導覽列 72／64、公告條 60、按鈕 44、選單連結 52、內容左緣、導覽列釘住', { skip: pw ? false : why }, async () => {
    const problems = [];
    const near = (got, want, what, tol = 1) => { if (Math.abs(got - want) > tol) problems.push(`${what}：要 ${want}，得到 ${got.toFixed(1)}`); };
    for (const lang of LANGS) {
        for (const width of [390, 768, 1024, 1440]) {
            const { page, context } = await open(lang, width);
            try {
                const p = await parts(page, lang);
                const b = bulletinParts(page, lang);
                const label = `${lang} ${width}`;
                near((await p.header.boundingBox()).height, width >= 1024 ? 72 : 64, `${label} 導覽列高`);
                near((await p.brand.boundingBox()).x, LEFT(width), `${label} 內容左緣（記號）`);
                if (await b.region.count()) {
                    const box = await b.region.boundingBox();
                    if (width === 1440) near(box.height, 60, `${label} 公告條高（一行）`);
                    else if (box.height < 59) problems.push(`${label} 公告條高：至少 60，得到 ${box.height.toFixed(1)}`);
                    near((await b.region.getByText(say(lang, 'bulletin.label'), { exact: true }).boundingBox()).x, LEFT(width), `${label} 公告條左緣（「公告」標籤）`);
                }
                if (await p.cta.first().isVisible()) near((await p.cta.first().boundingBox()).height, 44, `${label} 加到 Chrome 高`, 0.5);
                if (await p.langGroup.isVisible()) {
                    for (const box of await p.langGroup.locator('a').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) near(box, 44, `${label} 語言切換每段高`, 0.5);
                }
                if (await p.menuButton.isVisible()) {
                    const box = await p.menuButton.boundingBox();
                    near(box.width, 44, `${label} ☰ 寬`, 0.5);
                    near(box.height, 44, `${label} ☰ 高`, 0.5);
                    await p.menuButton.click();
                    for (const h of await p.menuLinks.locator('a').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) near(h, 52, `${label} 選單連結高`, 1);
                    await page.keyboard.press('Escape');
                }
                await page.evaluate(() => scrollTo({ top: 400, behavior: 'instant' }));
                await page.waitForTimeout(100);
                near((await p.header.boundingBox()).y, 0, `${label} 捲下去之後導覽列要釘在最上面`, 0.5);
                if (await b.region.count()) {
                    const y = (await b.all.first().boundingBox())?.y;
                    if (y !== undefined && y > -1) problems.push(`${label} 公告條不釘住：捲下去 400 之後要跟著捲走，得到 y=${y}`);
                }
            } finally {
                await context.close();
            }
        }
    }
    assert.deepEqual(problems, [], `${problems.length} 個跟設計稿的數字對不上`);
});

test('F3.10 換行樣式：中文 keep-all（公告條標題也是，加 overflow-wrap: anywhere）、日文 auto-phrase（lang="ja"）、英文 normal、--measure 25em', { skip: pw ? false : why }, async () => {
    const want = { zh: 'keep-all', ja: 'auto-phrase', en: 'normal' };
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 390);
        try {
            const p = await parts(page, lang);
            const b = bulletinParts(page, lang);
            const wb = (locator) => locator.evaluate((el) => getComputedStyle(el).wordBreak);
            assert.equal(await wb(p.header), want[lang], `${lang}：導覽列的 word-break`);
            assert.equal(await wb(page.locator('main').first()), want[lang], `${lang}：main 的 word-break`);
            assert.equal(await wb(p.menu), want[lang], `${lang}：選單的 word-break`);
            assert.equal(await b.region.count(), 1, `${lang}：防呆：公告條要看得到（真的內容有一則置頂）`);
            assert.equal(await wb(b.text), want[lang], `${lang}：公告條標題的 word-break（設計第三批：中文 keep-all＋後端在詞界插的 <wbr>，日文 auto-phrase，英文 normal）`);
            if (lang === 'zh') assert.equal(await b.text.evaluate((el) => getComputedStyle(el).overflowWrap), 'anywhere', 'zh：公告條標題要 overflow-wrap: anywhere（keep-all 時一段沒有斷點、比一行長的兜底）');
            if (lang === 'ja') assert.equal(await b.text.evaluate((el) => el.closest('[lang]')?.getAttribute('lang')), 'ja', 'ja：公告條標題要在 lang="ja" 的元素裡（auto-phrase 才生效）');
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--measure').trim()), '25em', `${lang}：:root 的 --measure 要是 25em（說明文字一行約 25 個中文字）`);
        } finally {
            await context.close();
        }
    }
});

test('F3.10 公告條標題的詞界 <wbr>：中文有、日文英文沒有（真的內容）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 390);
        try {
            const b = bulletinParts(page, lang);
            assert.equal(await b.region.count(), 1, `${lang}：防呆：公告條要看得到`);
            const n = await b.text.evaluate((el) => el.querySelectorAll('wbr').length);
            if (lang === 'zh') assert.ok(n > 0, 'zh：公告條標題的 DOM 裡要有 <wbr>（後端 bindTail 在中文詞界插的）');
            else assert.equal(n, 0, `${lang}：公告條標題不能有 <wbr>（只有中文插）`);
        } finally {
            await context.close();
        }
    }
});

test('F3.10 導覽列與公告條的字跟字串表逐字一樣（三語）', { skip: pw ? false : why }, async () => {
    for (const lang of LANGS) {
        const { page, context } = await open(lang, 1440);
        try {
            const p = await parts(page, lang);
            const b = bulletinParts(page, lang);
            assert.equal(await p.bar.count(), 1, `${lang}：導覽列要有一個 aria-label 是 nav.label「${say(lang, 'nav.label')}」的 <nav>`);
            const texts = (await p.bar.locator('a').allTextContents()).map((s) => s.trim());
            assert.deepEqual(texts, NAV_IDS.map((id) => say(lang, id)), `${lang}：導覽列六個連結的字（照 nav.features…nav.faq 的順序）`);
            assert.equal((await p.cta.first().textContent()).trim(), say(lang, 'nav.cta'), `${lang}：加到 Chrome 的字是 nav.cta`);
            assert.equal((await p.brand.textContent()).trim(), say(lang, 'nav.brand'), `${lang}：記號連結的字（名稱）是 nav.brand`);
            assert.equal(await p.langGroup.count(), 1, `${lang}：語言切換的 aria-label 是 lang.label「${say(lang, 'lang.label')}」`);
            assert.equal(await p.menuButton.getAttribute('aria-label'), say(lang, 'nav.menu.open'), `${lang}：☰ 的讀屏名字是 nav.menu.open`);
            const skip = page.locator('a[href="#main"]').first();
            assert.equal((await skip.textContent()).trim(), say(lang, 'nav.skip'), `${lang}：跳到主要內容的連結（href="#main"）的字是 nav.skip`);
            assert.equal(await page.locator('main#main').count(), 1, `${lang}：要有 <main id="main">（跳到主要內容的目的地）`);
            assert.equal(await b.all.count() > 0, true, `${lang}：公告條（role="region"、aria-label 是 bulletin.label）要在`);
            if (await b.region.count()) {
                assert.equal(await b.region.getByText(say(lang, 'bulletin.label'), { exact: true }).count(), 1, `${lang}：公告條的標籤字是 bulletin.label`);
                assert.equal(await b.close.count(), 1, `${lang}：✕ 的讀屏名字是 bulletin.close「${say(lang, 'bulletin.close')}」`);
            }
        } finally {
            await context.close();
        }
    }
});
