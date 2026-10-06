// 四支模組的輸出能直接給網頁用（目標檔 4-b1 的 B1.7）。
//
// 量什麼：
//   B1.7 JSON.stringify 再 parse，內容一模一樣（deepStrictEqual：Date 物件會變字串、undefined 欄位會消失、函式會不見、NaN 變 null，都會紅）；
//        量的是好的 content/ 資料夾整份 readContent 的結果，以及混著各種壞行的 parseChangelog／parseNews／parseLinks 結果。
//        不讀現在的時間：把全域的 Date 換成「new Date() 不帶參數、Date.now() 一呼叫就丟例外」的版本再跑一次
//        （帶參數的 new Date(…) 照常，檢查日期是不是真的日曆日期可以用）。
//        同樣輸入永遠同樣輸出：同一份輸入跑兩次，結果一模一樣。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B1.7"
//   node --test tests/output.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { lib, lines, FIXTURES, noThrow, noReject } from './helpers.js';

const needContent = await lib('content.js', ['readContent']);
const needChangelog = await lib('changelog.js', ['parseChangelog']);
const needNews = await lib('news.js', ['parseNews']);
const needLinks = await lib('links.js', ['parseLinks']);

const GOOD = path.join(FIXTURES, 'content');

// 好的、壞的混在一起：每一種輸出形狀（好紀錄、壞紀錄、好版本裡的壞 item、link 為 null）都出現
const CHANGELOG = lines(['<!-- 說明 -->', '雜字', '## 1.0.5 · 2026-10-02', '- 修好：a', '亂碼', '- 沒有冒號', '## 1.0 · 2026-10-02', '## 1.0.4 · 2026-02-30']);
const NEWS = lines(['<!-- 說明 -->', '雜字', '## 2026-10-02 · 更新 · 標題', '一句。', '連結：https://jerromy.com/', '置頂', '## 2026-10-01 · 注意 · 沒連結', '## 2026-09-30 · 更新 · 壞連結', '連結：http://x', '## 2026-09-29 · 更新 · 壞置頂', 'pinned', '## 2026-09-28 ·  · 沒類別']);
const LINKS = lines(['<!-- 說明 -->', '- blog · https://jerromy.com', '- Bad · https://x.com', '- blog http://x', '亂碼']);

function outputs() {
    const { parseChangelog } = needChangelog();
    const { parseNews } = needNews();
    const { parseLinks } = needLinks();
    return {
        changelog: noThrow('parseChangelog', () => parseChangelog(CHANGELOG)),
        news: noThrow('parseNews', () => parseNews(NEWS)),
        links: noThrow('parseLinks', () => parseLinks(LINKS)),
    };
}

async function everything() {
    const { readContent } = needContent();
    return { parsed: outputs(), content: await noReject('readContent', () => readContent(GOOD)) };
}

test('B1.7 JSON 來回一次內容不變（沒有 Date 物件、undefined、函式）', async () => {
    const all = await everything();
    for (const [label, value] of [['parseChangelog', all.parsed.changelog], ['parseNews', all.parsed.news], ['parseLinks', all.parsed.links], ['readContent', all.content]]) {
        assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value, `${label} 的輸出 JSON 來回一次之後變了`);
    }
    // 防呆：混合輸入真的有壞紀錄，不然上面量不到壞紀錄的形狀
    assert.ok(all.parsed.changelog.some((r) => r.ok === false) && all.parsed.news.some((r) => r.ok === false) && all.parsed.links.some((r) => r.ok === false), '混合輸入要有壞紀錄');
});

test('B1.7 不讀現在的時間（new Date()、Date.now() 一呼叫就紅）', async () => {
    const RealDate = globalThis.Date;
    class NoNow extends RealDate {
        constructor(...args) {
            if (args.length === 0) throw new Error('模組讀了現在的時間（new Date()）');
            super(...args);
        }
        static now() {
            throw new Error('模組讀了現在的時間（Date.now()）');
        }
    }
    let all;
    globalThis.Date = NoNow;
    try {
        all = await everything();
    } finally {
        globalThis.Date = RealDate;
    }
    const again = await everything();
    assert.deepStrictEqual(all, again, '換掉 Date 跑出來的結果要跟平常一樣');
});

test('B1.7 同樣輸入永遠同樣輸出', async () => {
    const first = await everything();
    const second = await everything();
    assert.deepStrictEqual(first, second);
});
