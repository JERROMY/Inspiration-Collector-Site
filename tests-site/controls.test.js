// F3.6 按鈕與觸控、F3.8 語言切換。真的 build（out/）、真的開瀏覽器。
//
// 量什麼：
//   F3.6 三語 × 320、390、1024、1440（窄的時候也把 ☰ 打開量選單裡的）：導覽列、選單、公告條裡每一個看得到的 a、button 寬高都 ≥ 44（Playwright 的 boundingBox，容許 0.5px）。
//   F3.6 鍵盤焦點看得到：從頁首按 Tab 走過導覽列每一個停得到的東西，每一個都有看得到的焦點框（outline 不是 none 而且寬度 > 0，或有 box-shadow）。
//   F3.6 主要按鈕（導覽列的「加到 Chrome」）滑過時括號夾住字：括號是按鈕的 ::before／::after ——
//        滑過前透明度 0、左括號往左偏（translate 的 x < 0）、右括號往右偏（x > 0）；滑過 0.6 秒後透明度 1、兩邊的 x 都是 0。
//        沒設減少動態時，括號透明度的轉場 ≥ 100ms（在滑）；設了減少動態時轉場 ≤ 1ms，滑過之後兩個畫格已經是 1、x 已經是 0（直接變、不滑），底色也已經變了。
//        （原本量「滑過 50ms 時」的樣子，機器忙時誤紅過，改量轉場時間與畫格。）
//   F3.8 1440 寬：在 /zh/#faq 點語言切換的「日」→ 網址是 /ja/#faq（錨點跟著帶過去）、只走一次導航（中間沒有別的頁）；
//        localStorage 的 collector-lang 記成 'ja'；localStorage 被擋掉時照樣切得過去、頁面不報錯。
//        語言切換每一段：讀屏名字是 lang.<語言>.name、字是 lang.<語言>.short、hreflang 對、目前那一段 aria-current="page"。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.6|F3.8"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, HTML_LANG, playwright, browserSession } from './helpers.js';
import { parts, bulletinParts, say, NO_STORAGE_SCRIPT } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
after(() => session?.close());

async function open(path, width, contextOptions = {}, init = null) {
    const { site, browser } = await session.get();
    const context = await browser.newContext({ viewport: { width, height: 900 }, ...contextOptions });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);   // 找不到東西時 15 秒就紅（預設 30 秒；5 秒在機器忙時開頁會逾時，量過）
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    if (init) await page.addInitScript(init);
    await page.goto(site.url + path, { waitUntil: 'load' });
    return { site, page, context, errors };
}

async function tooSmall(scope) {
    return scope.evaluateAll((els) => els
        .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; })
        .map((el) => { const r = el.getBoundingClientRect(); return { what: `${el.tagName.toLowerCase()} 「${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}」`, w: r.width, h: r.height }; })
        .filter((b) => b.w < 43.5 || b.h < 43.5));
}

for (const lang of LANGS) {
    test(`F3.6 按鈕、圖示鈕、語言切換、連結 ≥ 44×44（${lang}，320／390／1024／1440，選單打開也量）`, { skip: pw ? false : why }, async () => {
        for (const width of [320, 390, 1024, 1440]) {
            const { page, context } = await open(`/${lang}/`, width);
            try {
                const p = await parts(page, lang);
                const b = bulletinParts(page, lang);
                const small = [...await tooSmall(p.header.locator('a, button')), ...await tooSmall(b.all.locator('a, button'))];
                if (await p.menuButton.isVisible()) {
                    await p.menuButton.click();
                    small.push(...await tooSmall(p.menu.locator('a, button')));
                }
                assert.ok((await p.header.locator('a, button').count()) >= 3, `${lang} ${width}：導覽列裡找不到按鈕與連結`);
                assert.deepEqual(small, [], `${lang} ${width}：這些不到 44×44`);
            } finally {
                await context.close();
            }
        }
    });
}

test('F3.6 鍵盤焦點看得到：Tab 走過導覽列（zh 1440、zh 390）每一個都有焦點框', { skip: pw ? false : why }, async () => {
    for (const width of [1440, 390]) {
        const { page, context } = await open('/zh/', width);
        try {
            const p = await parts(page, 'zh');
            const seen = [];
            for (let i = 0; i < 20; i += 1) {
                await page.keyboard.press('Tab');
                const info = await page.evaluate(() => {
                    const el = document.activeElement;
                    if (!el || !el.closest('header')) return null;
                    const s = getComputedStyle(el);
                    return { what: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' };
                });
                if (info) seen.push(info);
                if (seen.length && !info) break;
            }
            assert.ok(seen.length >= 3, `zh ${width}：Tab 停不進導覽列（只停到 ${seen.length} 個）`);
            const hidden = seen.filter((s) => !s.outline && !s.shadow).map((s) => s.what);
            assert.deepEqual(hidden, [], `zh ${width}：這些拿到焦點時看不到焦點框`);
            assert.ok(await p.header.isVisible(), '導覽列要在');
        } finally {
            await context.close();
        }
    }
});

async function brackets(locator) {
    return locator.evaluate((el) => {
        const read = (pseudo) => {
            const s = getComputedStyle(el, pseudo);
            // 位移可以寫在 translate 或 transform：兩個加起來
            const t = s.translate === 'none' ? 0 : parseFloat(s.translate.split(' ')[0]) || 0;
            const m = s.transform === 'none' ? 0 : new DOMMatrix(s.transform).m41;
            // 透明度那一項轉場的時間（ms）：transition-property 與 transition-duration 是兩串對應的清單
            const props = s.transitionProperty.split(',').map((x) => x.trim());
            const durs = s.transitionDuration.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000));
            const at = props.findIndex((x) => x === 'opacity' || x === 'all');
            return { opacity: parseFloat(s.opacity), x: t + m, content: s.content, fade: at < 0 ? 0 : durs[at % durs.length] };
        };
        return { before: read('::before'), after: read('::after'), bg: getComputedStyle(el).backgroundColor };
    });
}

for (const reduce of [false, true]) {
    test(`F3.6 主要按鈕滑過時括號夾住字（zh 1440）${reduce ? '—— 減少動態：直接變色、括號直接出現不滑' : '—— 括號從外側滑進來'}`, { skip: pw ? false : why }, async () => {
        const { page, context } = await open('/zh/', 1440, reduce ? { reducedMotion: 'reduce' } : {});
        try {
            const p = await parts(page, 'zh');
            const cta = p.cta.first();
            assert.ok(await cta.isVisible(), '導覽列的「加到 Chrome」要看得到');
            const rest = await brackets(cta);
            assert.ok(rest.before.content !== 'none' && rest.after.content !== 'none', '主要按鈕的括號要畫在 ::before 與 ::after');
            assert.equal(rest.before.opacity, 0, '滑過前左括號是透明的');
            assert.equal(rest.after.opacity, 0, '滑過前右括號是透明的');
            assert.ok(rest.before.x < 0 && rest.after.x > 0, `滑過前括號在外側（左括號往左、右括號往右），得到 左 ${rest.before.x}、右 ${rest.after.x}`);
            // 量轉場時間，不量「滑過 50ms 時」的樣子：機器忙的時候兩個畫格可能隔好幾百 ms，固定的時間窗會誤紅（量過）
            if (reduce) assert.ok(rest.before.fade <= 1 && rest.after.fade <= 1, `減少動態：括號的透明度不做轉場（≤ 1ms），得到 左 ${rest.before.fade}ms、右 ${rest.after.fade}ms`);
            else assert.ok(rest.before.fade >= 100 && rest.after.fade >= 100, `沒設減少動態：括號是滑進來的（透明度轉場 ≥ 100ms），得到 左 ${rest.before.fade}ms、右 ${rest.after.fade}ms`);
            await cta.hover();
            if (reduce) {
                // 減少動態：滑過之後過兩個畫格（轉場 ≤ 1ms，一定已經到位）就是最後的樣子
                await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                const early = await brackets(cta);
                assert.equal(early.before.opacity, 1, '減少動態：滑過就直接出現（兩個畫格後透明度已經是 1）');
                assert.equal(early.before.x, 0, '減少動態：括號不滑（兩個畫格後已經在定位）');
                assert.notEqual(early.bg, rest.bg, '減少動態：底色直接變');
            }
            await page.waitForTimeout(600);
            const end = await brackets(cta);
            assert.equal(end.before.opacity, 1, '滑過之後左括號看得到');
            assert.equal(end.after.opacity, 1, '滑過之後右括號看得到');
            assert.ok(Math.abs(end.before.x) < 0.01 && Math.abs(end.after.x) < 0.01, `滑過之後括號在定位夾住字（x 是 0），得到 左 ${end.before.x}、右 ${end.after.x}`);
            assert.notEqual(end.bg, rest.bg, '滑過之後底色變了');
        } finally {
            await context.close();
        }
    });
}

for (const lang of LANGS) {
    test(`F3.8 語言切換的每一段（${lang}）：讀屏名字、字、hreflang、目前那段 aria-current`, { skip: pw ? false : why }, async () => {
        const { page, context } = await open(`/${lang}/`, 1440);
        try {
            const p = await parts(page, lang);
            for (const to of LANGS) {
                const link = p.langGroup.locator(`a[hreflang="${HTML_LANG[to]}"]`);
                assert.equal(await link.count(), 1, `${lang}：語言切換要有一段 hreflang="${HTML_LANG[to]}"`);
                assert.equal(await link.getAttribute('aria-label'), say(to, `lang.${to}.name`), `${lang}：那一段的讀屏名字是 lang.${to}.name`);
                assert.equal((await link.textContent()).trim(), say(lang, `lang.${to}.short`), `${lang}：那一段的字是 lang.${to}.short`);
                assert.equal(new URL(await link.getAttribute('href'), 'https://x/').pathname, `/${to}/`, `${lang}：那一段連到 /${to}/`);
                assert.equal(await link.getAttribute('aria-current'), to === lang ? 'page' : null, `${lang}：只有目前這個語言那段是 aria-current="page"`);
            }
        } finally {
            await context.close();
        }
    });
}

for (const blocked of [false, true]) {
    test(`F3.8 語言切換：/zh/#faq 切到日文 → /ja/#faq、只走一次導航${blocked ? '（localStorage 被擋掉也照樣切）' : '、記住選的語言'}`, { skip: pw ? false : why }, async () => {
        const { page, context, errors } = await open('/zh/#faq', 1440, {}, blocked ? NO_STORAGE_SCRIPT : null);
        try {
            const p = await parts(page, 'zh');
            const navigations = [];
            page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
            await p.langGroup.locator('a[hreflang="ja"]').click();
            await page.waitForURL(/\/ja\//, { timeout: 5000 });
            await page.waitForLoadState('load');
            const url = new URL(page.url());
            assert.equal(url.pathname, '/ja/', '要切到 /ja/');
            assert.equal(url.hash, '#faq', '錨點要跟著帶過去（/ja/#faq）');
            assert.equal(navigations.filter((u) => !u.endsWith('#faq') || !u.includes('/ja/')).length, 0, `中間不能先到別的頁再跳（閃一下）：${navigations.join(' → ')}`);
            if (!blocked) {
                assert.equal(await page.evaluate(() => localStorage.getItem('collector-lang')), 'ja', "要記住選的語言：localStorage 的 collector-lang 是 'ja'");
            }
            assert.deepEqual(errors, [], '頁面不能有錯誤');
        } finally {
            await context.close();
        }
    });
}
