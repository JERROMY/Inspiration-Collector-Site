// F3.4：公告條挑哪一則 —— 純函式，在純 Node 量（不 build、不開瀏覽器）。瀏覽器裡的行為在 bulletin.test.js。
//
// 介面：public/bulletin.js 是一般的（classic）腳本，放在 <head>、畫面畫出來之前跑；同一支檔在 Node 裡 import 也載得起來（不碰 document 就不做畫面的事），
//       載入後有 globalThis.collectorBulletin.pick(entries, now, dismissed)：
//         entries   公告陣列（readContent 的 news[語言].entries 那種：好的有 id、date 'YYYY-MM-DD'、pinned；壞的 ok:false）
//         now       Date（看的人的現在時間；用它的「當地日期」算）
//         dismissed 已經按 ✕ 關掉的 id 陣列
//       回傳該顯示的那一則（entries 裡的那個物件）或 null。
// 規則：壞的（ok:false）跳過 → 留下「30 天內」與「置頂」的 → 去掉 dismissed 裡的 → 取日期最新的一則（同一天取陣列裡較前面那則）。
//       30 天：發布日當天（第 0 天）到第 30 天都算；第 31 天起不算；發布日在看的人當地日期之後（未來的日期）也不算 ——
//       時區比發布的人晚的看的人，晚一天才看到（接受）。天數用當地的日曆日期算，不是 UTC、也不是毫秒相減。置頂的不看日期。
//
// 量什麼：
//   F3.4 public/bulletin.js 在 Node 載得起來、有 pick；空陣列、全是壞的 → null。
//   F3.4 取日期最新的（不是陣列最前面那則）；同一天取前面那則；壞的第一則跳過；置頂的超過 30 天也在；31 天前沒置頂的不在。
//   F3.4 關掉的跳過、換下一則；全關掉 → null；dismissed 有不認得的 id 不影響。
//   F3.4 第 0 天、第 30 天（當天 23:59）在；第 31 天（00:00）不在；發布日之前（前一天 23:59、更早）不在。
//   F3.4 當地日期：在 America/Los_Angeles 與 Asia/Taipei 兩個時區各跑一次（子程序設 TZ）—— 用 UTC 日期或毫秒相減的寫法，在其中一個時區會差一天。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F3.4 挑"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SITE } from './helpers.js';

const FILE = path.join(SITE, 'public', 'bulletin.js');

async function pick() {
    assert.ok(fs.existsSync(FILE), '缺 public/bulletin.js（公告條挑哪一則：<head> 的外部腳本）');
    const src = fs.readFileSync(FILE, 'utf8');
    assert.doesNotMatch(src, /^\s*(import|export)\s/m, 'public/bulletin.js 要是一般的腳本（<head> 裡用 <script src> 同步載入），不能有 import／export');
    try {
        await import(pathToFileURL(FILE).href);
    } catch (err) {
        assert.fail(`public/bulletin.js 在 Node 載不起來（沒有 document 時不要碰畫面）：${err.message}`);
    }
    const api = globalThis.collectorBulletin;
    assert.ok(api && typeof api.pick === 'function', 'public/bulletin.js 載入後要有 globalThis.collectorBulletin.pick(entries, now, dismissed)');
    return api.pick;
}

const E = (id, date, pinned = false) => ({ ok: true, id, date, category: '更新', title: id, body: '', link: null, pinned });
const BAD = { ok: false, line: 3, raw: '## 2026-10-28 · 更新', reason: '壞的' };
// 跟 fixtures/content-bulletin 同一個形狀：壞的在最上面、日期較早的寫在較晚的上面、一則很舊、一則置頂
const LIST = [BAD, E('oct05', '2026-10-05'), E('oct20', '2026-10-20'), E('sep01', '2026-09-01'), E('aug01', '2026-08-01', true)];
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);   // 當地時間
const id = (entry) => (entry === null ? null : entry.id);

test('F3.4 挑：public/bulletin.js 在 Node 載得起來；空的、全是壞的 → null', async () => {
    const p = await pick();
    assert.equal(p([], at(2026, 10, 25), []), null, '沒有公告 → null');
    assert.equal(p([BAD, { ...BAD, line: 9 }], at(2026, 10, 25), []), null, '全是壞的 → null');
});

test('F3.4 挑：取日期最新的、同一天取前面那則、壞的跳過、置頂超過 30 天也在、31 天前沒置頂的不在', async () => {
    const p = await pick();
    assert.equal(id(p(LIST, at(2026, 10, 25), [])), 'oct20', '要取日期最新的 10-20（不是檔案最上面的 10-05，也不是壞的那則）');
    const sameDay = [E('first', '2026-10-20'), E('second', '2026-10-20')];
    assert.equal(id(p(sameDay, at(2026, 10, 25), [])), 'first', '同一天：取前面那則');
    assert.equal(p(LIST, at(2026, 10, 25), []) === LIST[2], true, '回傳 entries 裡的那個物件');
    assert.equal(id(p([E('sep01', '2026-09-01')], at(2026, 10, 25), [])), null, '54 天前、沒置頂 → 不出現');
    assert.equal(id(p([E('aug01', '2026-08-01', true)], at(2026, 10, 25), [])), 'aug01', '置頂的超過 30 天也出現');
    assert.equal(id(p([E('aug01', '2026-08-01', true), E('oct20', '2026-10-20')], at(2026, 10, 25), [])), 'oct20', '置頂的較舊：取日期最新的那則');
});

test('F3.4 挑：關掉的跳過、換下一則；全關掉 → null；不認得的 id 不影響', async () => {
    const p = await pick();
    assert.equal(id(p(LIST, at(2026, 10, 25), ['oct20'])), 'oct05', '關掉最新的 → 換下一則（10-05）');
    assert.equal(id(p(LIST, at(2026, 10, 25), ['oct20', 'oct05'])), 'aug01', '再關掉 10-05 → 置頂的');
    assert.equal(id(p(LIST, at(2026, 10, 25), ['oct20', 'oct05', 'aug01'])), null, '全關掉 → null');
    assert.equal(id(p(LIST, at(2026, 10, 25), ['n-unknown', 'oct05'])), 'oct20', '關掉的是較舊的／不認得的 id → 最新的照樣出現（換新 id 又出現）');
});

test('F3.4 挑：第 0 天、第 30 天在；第 31 天不在（當地日期）', async () => {
    const p = await pick();
    const one = [E('oct20', '2026-10-20')];
    assert.equal(id(p(one, at(2026, 10, 20, 0, 0), [])), 'oct20', '發布日當天 00:00（第 0 天）');
    assert.equal(id(p(one, at(2026, 11, 19, 23, 59), [])), 'oct20', '第 30 天 23:59');
    assert.equal(id(p(one, at(2026, 11, 20, 0, 0), [])), null, '第 31 天 00:00');
    assert.equal(id(p([...one, E('aug01', '2026-08-01', true)], at(2026, 11, 20, 0, 0), [])), 'aug01', '第 31 天：10-20 掉出去，換置頂的');
});

test('F3.4 挑：發布日在當地日期之後（未來的日期）不顯示', async () => {
    const p = await pick();
    const one = [E('oct20', '2026-10-20')];
    assert.equal(id(p(one, at(2026, 10, 19, 23, 59), [])), null, '發布日前一天 23:59：還沒到，不顯示');
    assert.equal(id(p(one, at(2026, 10, 1, 12, 0), [])), null, '發布日前 19 天：不顯示');
    assert.equal(id(p([...one, E('oct05', '2026-10-05')], at(2026, 10, 15), [])), 'oct05', '10-15：10-20 還沒到 → 顯示已經發布的 10-05（不是日期最大的那則）');
});

// 子程序設 TZ：Node 在啟動時讀時區，這樣才是真的在那個時區
const CASES = [
    // [說明, 年, 月, 日, 時, 分, 預期]
    ['第 30 天晚上 20:00', 2026, 11, 19, 20, 0, 'oct20'],
    ['第 30 天 23:30', 2026, 11, 19, 23, 30, 'oct20'],
    ['第 31 天清晨 05:00', 2026, 11, 20, 5, 0, null],
    ['第 0 天清晨 00:30', 2026, 10, 20, 0, 30, 'oct20'],
    ['發布前一天 23:30（還沒到）', 2026, 10, 19, 23, 30, null],
];

for (const tz of ['America/Los_Angeles', 'Asia/Taipei']) {
    test(`F3.4 挑：當地日期 —— TZ=${tz}`, async () => {
        await pick();
        const script = `
            await import(${JSON.stringify(pathToFileURL(FILE).href)});
            const one = [{ ok: true, id: 'oct20', date: '2026-10-20', pinned: false }];
            const cases = ${JSON.stringify(CASES)};
            console.log(JSON.stringify(cases.map(([, y, m, d, h, min]) => {
                const got = globalThis.collectorBulletin.pick(one, new Date(y, m - 1, d, h, min), []);
                return got === null ? null : got.id;
            })));`;
        const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ: tz } });
        assert.equal(run.status, 0, run.stderr);
        const got = JSON.parse(run.stdout.trim().split('\n').pop());
        CASES.forEach(([label, , , , , , want], i) => {
            assert.equal(got[i], want, `${tz}「${label}」：要${want ? '出現' : '不出現'}（用當地日期算天數）`);
        });
    });
}
