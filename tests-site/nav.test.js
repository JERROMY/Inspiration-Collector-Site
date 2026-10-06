// F3.1 導覽列斷點、F3.2 ☰ 選單、F3.3 只有手指的裝置。真的 build（out/）、真的開瀏覽器。
//
// 量什麼：
//   F3.1 有滑鼠時：中文 1024 起、英文日文 1280 起是一整排（六個導覽連結、語言切換、加到 Chrome 看得到，☰ 看不到）；
//        中文 1023、英日 1279 以下收成 ☰（導覽連結與語言切換不在列上，☰ 看得到）。十二種寬度三語沒有橫捲在 layout.test.js 與 shots.test.js。
//   F3.2 390 寬、三語：點 ☰ 打開選單（看得到六個連結），☰ 的讀屏名字從 nav.menu.open 變成 nav.menu.close、圖示從 list 換成 close；
//        點選單裡的「公告」：選單收起、網址變成 #news、#news 那一區的頂端不被導覽列蓋住（在導覽列下緣之下）；
//        Esc 會關；點選單外面（導覽列上沒有東西的地方）會關。
//   F3.2 模擬不支援 popover：開頁前拿掉 HTMLElement.prototype 的 showPopover／hidePopover／togglePopover 與 popover 屬性 —— ☰ 照樣打得開、Esc 與點連結照樣會關。
//        （Chromium 本身還是會照 popovertarget 開關，這條只量得到「程式沒有因為少了這些方法而壞掉」。）
//   F3.2 手機橫拿 844×390：打開選單、捲到底，最下面那排社群圖示的最後一個整個在畫面裡、點得到（elementFromPoint 是它）。
//   F3.3 只有手指（isMobile＋hasTouch：hover:none、pointer:coarse），390 寬三語：看不到「加到 Chrome」；看得到記號、名稱（nav.brand）、☰。
//        防呆：先確認 matchMedia('(hover: none) and (pointer: coarse)') 成立。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.1|F3.2|F3.3"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, playwright, browserSession } from './helpers.js';
import { parts, say, NAV_IDS } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(lang, width, options = {}) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: options.height ?? 900 }, ...options.context });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);   // 找不到東西時 15 秒就紅（預設 30 秒；5 秒在機器忙時開頁會逾時，量過）
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (options.init) await page.addInitScript(options.init);
    await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
    return { page, context, errors, p: await parts(page, lang) };
}

const FULL_ROW = { zh: 1024, en: 1280, ja: 1280 };

for (const lang of LANGS) {
    test(`F3.1 導覽列斷點：${lang} ${FULL_ROW[lang]} 起一整排、${FULL_ROW[lang] - 1} 以下收成 ☰`, { skip: pw ? false : why }, async () => {
        for (const [width, row] of [[FULL_ROW[lang], true], [1440, true], [FULL_ROW[lang] - 1, false], [390, false]]) {
            const { context, p } = await open(lang, width);
            try {
                assert.ok(p.menuId, `${lang} ${width}：找不到 ☰（header 裡帶 aria-controls 的 button）`);
                if (row) {
                    for (const id of NAV_IDS) assert.ok(await p.bar.getByRole('link', { name: say(lang, id) }).isVisible(), `${lang} ${width}：一整排要看得到「${say(lang, id)}」`);
                    assert.ok(await p.langGroup.isVisible(), `${lang} ${width}：一整排要看得到語言切換`);
                    assert.ok(await p.cta.first().isVisible(), `${lang} ${width}：一整排要看得到「${say(lang, 'nav.cta')}」`);
                    assert.ok(!(await p.menuButton.isVisible()), `${lang} ${width}：一整排時 ☰ 要收起來`);
                } else {
                    assert.ok(await p.menuButton.isVisible(), `${lang} ${width}：收成 ☰ 時要看得到 ☰`);
                    assert.ok(!(await p.bar.isVisible()), `${lang} ${width}：收成 ☰ 時導覽連結不在列上`);
                    assert.ok(!(await p.langGroup.isVisible()), `${lang} ${width}：收成 ☰ 時語言切換不在列上`);
                }
            } finally {
                await context.close();
            }
        }
    });
}

for (const lang of LANGS) {
    test(`F3.2 ☰ 選單（${lang} 390）：打開變 ✕、點連結收起並跳到那一區不被蓋住、Esc 與點外面會關`, { skip: pw ? false : why }, async () => {
        const { page, context, errors, p } = await open(lang, 390);
        try {
            assert.ok(p.menuId, '找不到 ☰（header 裡帶 aria-controls 的 button）');
            assert.equal(await p.menuButton.getAttribute('aria-label'), say(lang, 'nav.menu.open'), `☰ 的讀屏名字要是 nav.menu.open「${say(lang, 'nav.menu.open')}」`);
            assert.ok(!(await p.menu.isVisible()), '一開始選單是收著的');
            await p.menuButton.click();
            assert.ok(await p.menu.isVisible(), '點 ☰ 要打開選單');
            for (const id of NAV_IDS) assert.ok(await p.menuLinks.getByRole('link', { name: say(lang, id) }).isVisible(), `選單裡要看得到「${say(lang, id)}」`);
            assert.equal(await p.menuButton.getAttribute('aria-label'), say(lang, 'nav.menu.close'), `打開後 ☰ 的讀屏名字要變成 nav.menu.close「${say(lang, 'nav.menu.close')}」`);
            assert.ok(await p.menuButton.locator('[data-icon="close"]').isVisible(), '打開後 ☰ 的圖示換成 ✕（data-icon="close"）');
            assert.ok(!(await p.menuButton.locator('[data-icon="list"]').isVisible()), '打開後 ☰ 的圖示（data-icon="list"）收起來');

            await p.menuLinks.getByRole('link', { name: say(lang, 'nav.news') }).click();
            await page.waitForFunction(() => location.hash === '#news', null, { timeout: 3000 }).catch(() => {});
            assert.equal(new URL(page.url()).hash, '#news', '點選單裡的「公告」要跳到 #news');
            assert.ok(!(await p.menu.isVisible()), '點了連結要收起選單');
            assert.equal(await p.menuButton.getAttribute('aria-label'), say(lang, 'nav.menu.open'), '收起之後讀屏名字要變回 nav.menu.open');
            await page.waitForTimeout(1200);   // 平滑捲動
            const navBottom = (await p.header.boundingBox()).y + (await p.header.boundingBox()).height;
            const target = await page.locator('#news').boundingBox();
            assert.ok(target, '#news 那一區不在');
            assert.ok(target.y >= navBottom - 1, `#news 的頂端（${target.y.toFixed(1)}）被導覽列（下緣 ${navBottom.toFixed(1)}）蓋住了 —— 要 scroll-padding-top`);

            await p.menuButton.click();
            assert.ok(await p.menu.isVisible(), '再點 ☰ 要打開');
            await page.keyboard.press('Escape');
            assert.ok(!(await p.menu.isVisible()), '按 Esc 要關');

            await p.menuButton.click();
            assert.ok(await p.menu.isVisible(), '再點 ☰ 要打開');
            const brand = await p.brand.boundingBox();
            const button = await p.menuButton.boundingBox();
            const cta = await p.cta.first().boundingBox();
            const right = cta && cta.x > brand.x + brand.width ? cta.x : button.x;
            const x = (brand.x + brand.width + right) / 2;
            assert.ok(right - (brand.x + brand.width) > 4, '防呆：導覽列上記號與按鈕之間沒有空的地方可以點');
            await page.mouse.click(x, button.y + button.height / 2);
            assert.ok(!(await p.menu.isVisible()), '點選單外面（導覽列上空的地方）要關');
            assert.deepEqual(errors, [], '頁面不能有錯誤');
        } finally {
            await context.close();
        }
    });
}

const NO_POPOVER = () => {
    for (const name of ['showPopover', 'hidePopover', 'togglePopover', 'popover']) delete HTMLElement.prototype[name];
};

test('F3.2 ☰ 選單：不支援 popover 的瀏覽器（拿掉 showPopover 這幾個）照樣打得開、Esc 與點連結會關', { skip: pw ? false : why }, async () => {
    const lang = 'zh';
    const { page, context, errors, p } = await open(lang, 390, { init: NO_POPOVER });
    try {
        assert.equal(await page.evaluate(() => 'showPopover' in HTMLElement.prototype), false, '防呆：showPopover 要被拿掉了');
        await p.menuButton.click();
        assert.ok(await p.menu.isVisible(), '點 ☰ 要打開');
        assert.equal(await p.menuButton.getAttribute('aria-label'), say(lang, 'nav.menu.close'), '打開後讀屏名字要變成 nav.menu.close');
        await page.keyboard.press('Escape');
        assert.ok(!(await p.menu.isVisible()), '按 Esc 要關');
        await p.menuButton.click();
        await p.menuLinks.getByRole('link', { name: say(lang, 'nav.news') }).click();
        assert.ok(!(await p.menu.isVisible()), '點了連結要收起選單');
        assert.deepEqual(errors, [], '頁面不能有錯誤（沒有 popover 時不能呼叫不存在的方法）');
    } finally {
        await context.close();
    }
});

for (const lang of LANGS) {
    test(`F3.2 手機橫拿 844×390（${lang}）：選單自己捲得到底，最下面那排社群圖示點得到`, { skip: pw ? false : why }, async () => {
        const { page, context, p } = await open(lang, 844, { height: 390, context: { isMobile: true, hasTouch: true } });
        try {
            await p.menuButton.click();
            assert.ok(await p.menu.isVisible(), '點 ☰ 要打開');
            const last = p.socials.locator('a').last();
            assert.ok(await last.count(), '選單裡要有社群圖示一排（ul 的 aria-label 是 author.socials）');
            await p.menu.evaluate((el) => { el.scrollTop = el.scrollHeight; });
            await page.waitForTimeout(200);
            const box = await last.boundingBox();
            assert.ok(box && box.y >= 0 && box.y + box.height <= 390 + 0.5, `捲到底之後最後一個社群圖示要整個在畫面裡（得到 ${JSON.stringify(box)}）`);
            const hit = await last.evaluate((el) => {
                const r = el.getBoundingClientRect();
                const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return at === el || el.contains(at);
            });
            assert.ok(hit, '最後一個社群圖示被別的東西蓋住了（點不到）');
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    test(`F3.3 只有手指（${lang} 390）：不顯示「加到 Chrome」，顯示記號＋名稱＋☰`, { skip: pw ? false : why }, async () => {
        const { page, context, p } = await open(lang, 390, { height: 844, context: { isMobile: true, hasTouch: true } });
        try {
            assert.equal(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches), true, '防呆：模擬只有手指沒有生效');
            assert.ok(!(await p.cta.first().isVisible()), `只有手指時不放「${say(lang, 'nav.cta')}」（手機裝不了）`);
            assert.ok(await p.brand.isVisible(), '記號要看得到');
            assert.ok(await p.brand.locator('img, svg').first().isVisible(), '記號（img 或 svg）要看得到');
            assert.ok(await p.brand.getByText(say(lang, 'nav.brand'), { exact: true }).isVisible(), `名稱「${say(lang, 'nav.brand')}」要看得到`);
            assert.ok(await p.menuButton.isVisible(), '☰ 要看得到');
        } finally {
            await context.close();
        }
    });
}
