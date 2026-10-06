// 給做網站的人與使用者的說明 README.md（目標檔 4-b5 的 B5.3；介面細則見 tests/README.md「4-b5」）。
// 搬進公開 repo 之後它就是 repo 首頁顯示的那一份。
//
// 量什麼（〔挑〕的是測試工程師挑的量法）：
//   B5.3 使用者自己要做的事：〔挑〕有一個標題寫到「自己做」，那一節裡用編號清單（1. 2. …）依序寫：
//        建 GitHub repo → Cloudflare 建 Pages 專案、連到 repo（建置指令 npm run build:pages、輸出 out）→ 在專案填自訂網域
//        → Search Console 與 Bing 驗證網域並送網站地圖 → 商店後台填網站網址。〔挑〕每一步都有「為什麼」三個字。
//        （2026-10-07 從 GitHub Pages 改成 Cloudflare Pages：DNS 本來就在 Cloudflare，填自訂網域時它自己加 DNS、發 HTTPS 憑證，
//        所以不再有「網域商加 DNS」「打開 HTTPS」兩步；GitHub 的「驗證網域」與 git subtree 搬家兩條也拿掉了 —— 公開 repo 用乾淨的第一個提交。）
//   B5.3 本機預覽：有 npm run dev、npm run build；有一段同時寫到「靜態伺服器」與 out/；
//        有一段同時寫到 Live Server、「不要」（或「別」）與原因「插」（它會往 HTML 插自己的腳本）。
//   B5.3 〔派工 2026-10-02〕內容寫壞時：〔檢查員第 1 輪收緊〕標題含「內容寫壞」的那一節裡，有一段同時寫到 content:check、「警告」、「不擋」、「這一條讀不到」
//        （寫壞不擋部署，建置紀錄留下警告，網頁上顯示「這一條讀不到」）；同一節裡有一段同時寫到 npm run build、「失敗」、「上一版」
//        （build 失敗才擋部署、網站維持上一版）。不再要求「content:check 失敗」。只看那一節、而且要同一段：別處（例如「與範本不同」那一節）講到不算。
//   B5.3 〔挑〕有一段同時寫到 npm test、「上線」與「不是／不會／不跑／不擋」其中一個（npm test 不是上線關卡）；
//        有一段同時寫到 content:check、「提交」（或 commit）與「前」（做網站的人提交前跑）。
//   B5.3 章節與素材工具：〔挑〕有一節同時寫到 scripts/chapters.mjs、scripts/media.mjs、GPTPlugins、data/、public/media/（留在 GPTPlugins 跑，產出再帶進網站 repo）。
//   B5.3 乾淨：繁體中文（有中文、沒有簡體才有的字）；沒有 /Users/、\Users\、jerromylee；沒有電子郵件（〔挑〕git@github.com: 這種 ssh 網址不算）；
//        沒有看不見的字（零寬、方向控制、NBSP、全形空白、BOM、控制字元）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B5.3"
//   node --test tests/deploy-readme.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { README, readSite, paragraphs, sections } from './deploy-files.js';

const HAN = /[一-鿿]/;
// 簡體才有的字（日文也不用的；跟 content-files.test.js 同一份）
const SIMPLIFIED = ['这', '们', '个', '时', '么', '说', '读', '显', '坏', '样', '页', '网', '语', '录', '发', '后'];
// 看不見、或看起來像空白的字（跟 content-files.test.js 同一份）
const INVISIBLE = [
    0x00A0, 0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x180E,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x2028, 0x2029, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x202F,
    0x205F, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x2066, 0x2067, 0x2068, 0x2069,
    0x3000, 0x3164, 0xFEFF, 0xFFA0,
];

// [名稱, 對得上的條件]
const STEPS = [
    ['建 GitHub repo', (s) => /repo/i.test(s) && /建|新增|開一個/.test(s)],
    ['Cloudflare 建 Pages 專案、連到 repo', (s) => /Cloudflare/.test(s) && /Pages/.test(s) && /npm run build:pages/.test(s) && /`out`/.test(s)],
    ['在專案填自訂網域', (s) => /自訂網域|Custom domains/i.test(s) && /collector\.jerromy\.com/.test(s)],
    ['Search Console 與 Bing 驗證網域、送網站地圖', (s) => /Search Console/.test(s) && /Bing/.test(s) && /網站地圖|sitemap/i.test(s)],
    ['商店後台填網站網址', (s) => /商店/.test(s) && /網址/.test(s)],
];

function some(label, pick) {
    const text = readSite(README);
    assert.ok(paragraphs(text).some(pick), `${README}：${label}`);
}

// 「自己做」那一節的編號清單：每一項是編號那行加上它底下接著的行
function userSteps() {
    const text = readSite(README);
    const section = sections(text).find((s) => /^#{1,6} .*自己做/.test(s));
    assert.ok(section, `${README} 要有一個標題寫到「自己做」（使用者自己要做的事）`);
    const items = [];
    items.section = section;
    for (const row of section.split('\n').slice(1)) {
        if (/^\s*\d+[.)] /.test(row)) items.push(row);
        else if (items.length) items[items.length - 1] += `\n${row}`;
    }
    assert.ok(items.length >= STEPS.length - 1, `${README}「自己做」那一節要用編號清單（1. 2. …）寫至少 ${STEPS.length - 1} 步，得到 ${items.length} 步`);
    return items;
}

// 照順序一步一步往後找：第 n 步從第 n-1 步那一項的下一項開始找（一項只算一步）；找不到是 -1
function inOrder(items) {
    let prev = -1;
    return STEPS.map(([label, match]) => {
        const from = prev + 1;
        const k = items.findIndex((item, n) => n >= from && match(item));
        if (k >= 0) prev = k;
        return [label, k];
    });
}

test('B5.3 說明：使用者自己要做的事照順序（repo → Cloudflare Pages 專案 → 填自訂網域 → Search Console 與 Bing → 商店）', () => {
    const items = userSteps();
    const missing = STEPS.filter(([, match]) => !items.some(match)).map(([label]) => label);
    assert.deepEqual(missing, [], `${README}「自己做」那一節少了：${missing.join('、')}`);
    const at = inOrder(items);
    assert.ok(at.every(([, k]) => k >= 0),
        `${README}「自己做」的順序不對（一步一個編號）：照順序找得到的只有 ${at.filter(([, k]) => k >= 0).map(([label, k]) => `${label}＝第 ${k + 1} 項`).join('、')}`);
});

test('B5.3 說明：每一步都講「為什麼」', () => {
    const items = userSteps();
    // 順序錯了由上一條報；這裡順序找不到就退回「第一個對得上的那一項」，免得同一個錯報兩次
    const bad = inOrder(items).map(([label, k], n) => [label, items[k >= 0 ? k : items.findIndex(STEPS[n][1])]])
        .filter(([, item]) => !item || !item.includes('為什麼')).map(([label]) => label);
    assert.deepEqual(bad, [], `${README}：這幾步沒寫「為什麼」：${bad.join('、')}`);
});

test('B5.3 說明：本機預覽 npm run dev、npm run build 後用靜態伺服器開 out/', () => {
    const text = readSite(README);
    assert.ok(text.includes('npm run dev'), `${README} 要寫 npm run dev`);
    assert.ok(text.includes('npm run build'), `${README} 要寫 npm run build`);
    some('要有一段同時寫到「靜態伺服器」與 out/', (p) => p.includes('靜態伺服器') && p.includes('out/'));
});

test('B5.3 說明：明確寫不要用 VS Code 的 Live Server 與原因', () => {
    some('要有一段同時寫到 Live Server、「不要」（或「別」）與原因（它會往 HTML「插」自己的腳本）',
        (p) => p.includes('Live Server') && /不要|別/.test(p) && p.includes('插'));
});

test('B5.3 說明：「內容寫壞」那一節講 content:check 不擋部署（留警告、網頁上顯示「這一條讀不到」），npm run build 失敗才維持上一版', () => {
    const section = sections(readSite(README)).find((s) => /^#{1,6} .*內容寫壞/.test(s));
    assert.ok(section, `${README} 要有一個標題寫到「內容寫壞」`);
    const parts = paragraphs(section);
    assert.ok(parts.some((p) => p.includes('content:check') && p.includes('警告') && p.includes('不擋') && p.includes('這一條讀不到')),
        `${README}「內容寫壞」那一節要有一段同時寫到 content:check、「警告」、「不擋」與「這一條讀不到」（內容寫壞不擋部署，建置紀錄留下警告，網頁上顯示「這一條讀不到」）`);
    assert.ok(parts.some((p) => p.includes('npm run build') && p.includes('失敗') && p.includes('上一版')),
        `${README}「內容寫壞」那一節要有一段同時寫到 npm run build、「失敗」與「上一版」（build 失敗才擋部署、網站維持上一版）`);
});

test('B5.3 說明：npm test 不是上線關卡；content:check 是做網站的人提交前跑的', () => {
    some('要有一段同時寫到 npm test、「上線」與「不是／不會／不跑／不擋」', (p) => p.includes('npm test') && p.includes('上線') && /不是|不會|不跑|不擋/.test(p));
    some('要有一段同時寫到 content:check、「提交」（或 commit）與「前」', (p) => p.includes('content:check') && /提交|commit/i.test(p) && p.includes('前'));
});

test('B5.3 說明：scripts/chapters.mjs 與 scripts/media.mjs 留在 GPTPlugins 跑，產出的 data/ 與 public/media/ 再帶進網站 repo', () => {
    const text = readSite(README);
    const words = ['scripts/chapters.mjs', 'scripts/media.mjs', 'GPTPlugins', 'data/', 'public/media/'];
    assert.ok(sections(text).some((s) => words.every((w) => s.includes(w))), `${README} 要有一節同時寫到 ${words.join('、')}`);
});

test('B5.3 說明：繁體中文，沒有本機路徑、帳號名稱、電子郵件、看不見的字', () => {
    const text = readSite(README);
    assert.ok(HAN.test(text), `${README} 要用繁體中文寫`);
    const simplified = SIMPLIFIED.filter((ch) => text.includes(ch));
    assert.deepEqual(simplified, [], `${README} 出現了簡體字 ${simplified.join('、')}`);
    assert.ok(!text.includes('/Users/') && !text.includes('\\Users\\'), `${README} 不能有本機路徑（/Users/）`);
    assert.ok(!/jerromylee/i.test(text), `${README} 不能有這台電腦的帳號名稱`);
    const mail = text.replace(/\bgit@github\.com:/g, '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
    assert.equal(mail, null, `${README} 不能有電子郵件，找到「${mail && mail[0]}」`);
    const hidden = [...text].map((ch, i) => [ch.codePointAt(0), i])
        .filter(([code]) => INVISIBLE.includes(code) || (code < 0x20 && code !== 0x0A && code !== 0x09) || code === 0x7F);
    assert.deepEqual(hidden.map(([code, i]) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}（第 ${i} 個字）`), [],
        `${README} 有看不見的字（零寬、NBSP、全形空白、BOM、CR 之類）`);
});
