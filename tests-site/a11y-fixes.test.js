// F4.0a 關掉公告後的焦點、F4.0b 給讀屏的字用純文字。
//
// 量什麼：
//   F4.0a 三語 1440（真的內容，公告條有一則置頂、一定看得到）：從頁首按 Tab 到公告條的 ✕（aria-label 是 bulletin.close）、按 Enter ——
//         公告條收起；焦點不是 BODY，是 #main 或「公告條之後第一個停得到的東西」；再按 Tab 停在原處的下一個（焦點在 #main 時是那第一個、焦點在它身上時是它後面那一個）；
//         焦點在 #main 時 main 不畫焦點框（不改長相）；按下去之後沒有多出新的動畫（跟按之前比）。localStorage 被擋掉時一樣。
//   F4.0b 靜態：components/、app/ 的程式裡，aria-*、title、alt、label 這幾個屬性（或傳給元件的同名 props）的值不能直接是 getString(…)（要 getPlainString）。
//   F4.0b 真的 build：把網站複製到暫存資料夾，字串表裡每一條沒有標記的字外面包一層 «…»（合法的標記，畫面上看不出來；hero.mobile.bold 除外），build 之後
//         out/ 每一頁所有 aria-*、title、alt、data-label* 屬性與 <title> 裡都不能出現標記字元（«»{}|⟨⟩⟦⟧⁅⁆¦↵）—— 用 getString 放進屬性的地方會漏出 «。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F4.0"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, LANGS, playwright, browserSession, listFiles, buildCopy, tail } from './helpers.js';
import { say, bulletinParts, NO_STORAGE_SCRIPT } from './page-helpers.js';

const { pw, why } = playwright();
const session = pw ? browserSession(pw) : null;
let build = null;
after(async () => {
    await session?.close();
    build?.cleanup();
});

for (const blocked of [false, true]) {
    test(`F4.0a 按公告條的 ✕ 之後焦點不是 BODY、接著原處往下（三語 1440${blocked ? '，localStorage 被擋掉' : ''}）`, { skip: pw ? false : why }, async () => {
        for (const lang of LANGS) {
            const { site, browser } = await session.get();
            const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            if (blocked) await page.addInitScript(NO_STORAGE_SCRIPT);
            await page.goto(`${site.url}/${lang}/`, { waitUntil: 'load' });
            try {
                const b = bulletinParts(page, lang);
                assert.equal(await b.region.count(), 1, `${lang}：防呆：公告條要看得到`);
                // 公告條之後第一個停得到的東西，先做記號
                await b.region.evaluate((bar) => {
                    const tabbable = [...document.querySelectorAll('a[href], button, summary, input, select, textarea, [tabindex]')]
                        .filter((el) => el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
                    const after = tabbable.filter((el) => !bar.contains(el) && (bar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
                    if (after[0]) after[0].setAttribute('data-test-next', '1');
                    if (after[1]) after[1].setAttribute('data-test-next', '2');
                });
                const anims = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running')
                    .map((a) => `${a.constructor.name} ${a.animationName || a.transitionProperty || ''} @ ${a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.className || a.effect.target.tagName) : ''}`));
                let reached = false;
                for (let i = 0; i < 40 && !reached; i += 1) {
                    await page.keyboard.press('Tab');
                    reached = await page.evaluate((label) => document.activeElement && document.activeElement.getAttribute('aria-label') === label, say(lang, 'bulletin.close'));
                }
                assert.ok(reached, `${lang}：按 Tab 走不到公告條的 ✕`);
                const before = new Set(await anims());
                await page.keyboard.press('Enter');
                await page.waitForTimeout(100);
                const added = (await anims()).filter((a) => !before.has(a));
                assert.equal(await b.region.count(), 0, `${lang}：按 Enter 之後公告條要收起`);
                const now = await page.evaluate(() => {
                    const el = document.activeElement;
                    return { tag: el ? el.tagName : null, id: el ? el.id : null, mark: el ? el.getAttribute('data-test-next') : null, outline: el ? getComputedStyle(el).outlineStyle : null, };
                });
                assert.notEqual(now.tag, 'BODY', `${lang}：收起之後焦點不能掉到 BODY（讀屏會從頭念）`);
                assert.ok(now.id === 'main' || now.mark === '1', `${lang}：焦點要在 #main 或公告條之後第一個停得到的東西，得到 ${JSON.stringify(now)}`);
                if (now.id === 'main') assert.equal(now.outline, 'none', `${lang}：焦點在 #main 時不畫焦點框（不改長相）`);
                assert.deepEqual(added, [], `${lang}：收起時不能多出新的動畫`);
                await page.keyboard.press('Tab');
                const next = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-test-next'));
                assert.equal(next, now.id === 'main' ? '1' : '2', `${lang}：再按 Tab 要接著原處的下一個`);
            } finally {
                await context.close();
            }
        }
    });
}

function code(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('F4.0b 靜態：給讀屏的屬性（aria-*、title、alt、label）不直接用 getString', () => {
    const bad = [];
    for (const top of ['components', 'app']) {
        for (const rel of listFiles(path.join(SITE, top)).filter((r) => /\.(m?js|jsx)$/.test(r))) {
            const src = code(fs.readFileSync(path.join(SITE, top, ...rel.split('/')), 'utf8'));
            for (const m of src.matchAll(/\b(aria-[a-z]+|ariaLabel|title|alt|label|[a-zA-Z]*Label)\s*[=:]\s*\{?\s*`?\$?\{?\s*getString\s*\(/g)) {
                const line = src.slice(0, m.index).split('\n').length;
                bad.push(`${top}/${rel}:${line}（${m[1]}）`);
            }
        }
    }
    assert.deepEqual(bad, [], '這些給讀屏的字用了 getString（帶標記的原字）：改成 getPlainString');
});

const MARKS = /[«»{}|⟨⟩⟦⟧⁅⁆¦↵]/;

test('F4.0b 真的 build：字串表每一條包一層 «…» 之後，out/ 的 aria-*、title、alt、data-label* 與 <title> 沒有標記字元', () => {
    build ??= buildCopy({
        label: 'strings-wrapped',
        prepare: (copy) => {
            for (const lang of LANGS) {
                const file = path.join(copy, 'strings', `${lang}.json`);
                const table = JSON.parse(fs.readFileSync(file, 'utf8'));
                // hero.mobile.bold 不包：它要原樣出現在 hero.mobile.text 的第一個 «…» 開頭（<Seg bold>），包了就對不上
                for (const [id, text] of Object.entries(table)) if (id !== 'hero.mobile.bold' && !/[«»{}|⟨⟩⟦⟧⁅⁆¦↵%]/.test(text) && text.trim()) table[id] = `«${text}»`;
                fs.writeFileSync(file, JSON.stringify(table, null, 2) + '\n');
            }
        },
    });
    assert.equal(build.status, 0, `包了 «…» 的字串表 build 失敗：\n${tail(build.output)}`);
    const bad = [];
    for (const rel of listFiles(build.out).filter((r) => r.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(build.out, ...rel.split('/')), 'utf8');
        for (const m of html.matchAll(/\s(aria-[a-z-]+|title|alt|data-label[a-z-]*)\s*=\s*"([^"]*)"/g)) {
            if (MARKS.test(m[2])) bad.push(`${rel}：${m[1]}="${m[2].slice(0, 40)}"`);
        }
        for (const m of html.matchAll(/<title>([^<]*)<\/title>/g)) if (MARKS.test(m[1])) bad.push(`${rel}：<title>${m[1].slice(0, 40)}`);
    }
    assert.ok(listFiles(build.out).some((r) => r === 'zh/index.html'), '防呆：build 出來要有 zh/index.html');
    assert.deepEqual([...new Set(bad)].slice(0, 20), [], `${bad.length} 個給讀屏的屬性漏出了標記字元（用了 getString，要 getPlainString）`);
});
