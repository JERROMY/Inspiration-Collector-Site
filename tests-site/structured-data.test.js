// F2.3 結構化資料跳不出 <script>：字裡有 </script> 時，JSON-LD 那一段照樣完整（「<」要跳脫成 <）。
//
// 為什麼要另外 build 一次：字串表本來就沒有「<」，量真的 out/ 永遠是綠的 —— 把跳脫拿掉也看不出來。
// 這裡在暫存複本把英文的 faq.1.q 改成含 </script><script>…</script> 的字（常見問題的題目會進 JSON-LD），build 一次再看 out/en/index.html：
//   第一段 <script type="application/ld+json"> 到它後面第一個 </script> 之間，JSON 讀得起來、裡面沒有「<」，
//   第 1 題的 name 讀回來剛好是改過的那句（字沒有被吃掉）；整份 HTML 裡沒有那段假的 <script>。
// 專案裡的 strings/、out/ 一個都不動（helpers.js 的 buildCopy）。
//
// 跑法（在 homepage/site/）：
//   node tests-site/run.mjs --test-name-pattern "F2.3 跳不出"
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCopy, tail } from './helpers.js';

const EVIL = 'Does it </script><script>window.__ldBroke = 1</script> cost anything?';
let built = null;
after(() => built?.cleanup());

test('F2.3 跳不出 <script>：字裡有 </script> 時 JSON-LD 照樣完整（英文 faq.1.q 改過再 build 一次）', { timeout: 10 * 60 * 1000 }, () => {
    built = buildCopy({
        label: 'json-ld-escape',
        prepare: (dir) => {
            const file = path.join(dir, 'strings', 'en.json');
            const s = JSON.parse(fs.readFileSync(file, 'utf8'));
            assert.ok(s['faq.1.q'], '防呆：字串表要有 faq.1.q');
            s['faq.1.q'] = EVIL;
            fs.writeFileSync(file, JSON.stringify(s, null, 2));
        },
    });
    assert.equal(built.status, 0, `暫存複本 build 失敗：\n${tail(built.output)}`);
    const html = fs.readFileSync(path.join(built.out, 'en', 'index.html'), 'utf8');
    assert.ok(!html.includes('<script>window.__ldBroke'), '字裡的 <script> 跑出來變成真的標籤了（JSON-LD 被 </script> 提早結束）');
    const blocks = [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    assert.ok(blocks.length > 0, '找不到 JSON-LD');
    const faq = [];
    for (const [i, body] of blocks.entries()) {
        assert.ok(!body.includes('<'), `第 ${i + 1} 段 JSON-LD 裡有「<」（要跳脫成 \\u003c）`);
        let data;
        assert.doesNotThrow(() => { data = JSON.parse(body); }, `第 ${i + 1} 段 JSON-LD 讀不起來（被 </script> 切斷了？）`);
        for (const item of [].concat(data)) for (const node of item['@graph'] ?? [item]) if ([].concat(node['@type']).includes('FAQPage')) faq.push(node);
    }
    assert.equal(faq.length, 1, '防呆：要找到 FAQPage');
    assert.equal(faq[0].mainEntity[0].name, EVIL, '第 1 題的題目讀回來要剛好是改過的那句（含 </script>）');
});
