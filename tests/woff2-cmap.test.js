// 讀子集檔的 cmap（目標檔 4-b6 的 B6.3「列出不在子集裡的字」；介面細則見 tests/README.md「4-b6」）。純函式，不讀檔、不叫 python。
//
// lib/woff2-cmap.js 的 woff2CodePoints(buffer)：
//   WOFF2 → 字型裡有對應字形的碼位（數字陣列，不重複、由小到大）。用 node:zlib 的 brotli 解壓，照表目錄算 cmap 的位置
//   （UIntBase128；glyf、loca 的 transform version 0 與 hmtx 的 version 1 是轉換過的，壓縮資料裡的長度是 transformLength）。
//   cmap 讀 platform 0 的、platform 3 encoding 1 與 10 的子表，format 4 與 12（其他格式略過），全部合起來；對到 glyph 0 的不算。
//   不是 WOFF2（wOFF、OTTO、亂碼、空的）、截斷、brotli 解不開、沒有 cmap → Error（不回傳半套）。
// 測試用的 WOFF2 由 b6-font-fixture.js 的 woff2Font() 現組（前面有轉換過的 glyf、loca，cmap 不在第一個）；
// 真的 pyftsubset 產出的檔在 fonts-subset-real.test.js 量（選擇性）。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B6.3 cmap"
//   node --test tests/woff2-cmap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lib } from './helpers.js';
import { woff2Font } from './b6-font-fixture.js';

const need = await lib('woff2-cmap.js', ['woff2CodePoints']);

function read(buf) {
    const result = need().woff2CodePoints(buf);
    assert.ok(Array.isArray(result), `要回傳陣列，得到 ${JSON.stringify(result)}`);
    return result;
}

test('B6.3 cmap：BMP 的字（format 4）照碼位由小到大回傳；0xFFFF 那一段對到 glyph 0，不算', () => {
    assert.deepEqual(read(woff2Font([0x597d, 0x41, 0x4f60])), [0x41, 0x4f60, 0x597d]);
});

test('B6.3 cmap：BMP 以外的字（format 12，𠮷 U+20BB7）也讀得到，兩個子表合起來、不重複', () => {
    assert.deepEqual(read(woff2Font([0x41, 0x20bb7, 0x4f60])), [0x41, 0x4f60, 0x20bb7]);
    assert.deepEqual(read(woff2Font([0x41, 0x4f60], { format12: true })), [0x41, 0x4f60]);
});

test('B6.3 cmap：檔尾有 private data（補到 409600 位元組）也照讀', () => {
    const buf = woff2Font([0x4f60], { size: 409600 });
    assert.equal(buf.length, 409600);
    assert.deepEqual(read(buf), [0x4f60]);
});

test('B6.3 cmap：一個字都沒有的子集 → 空陣列（不是 Error）', () => {
    assert.deepEqual(read(woff2Font([])), []);
});

test('B6.3 cmap：不是 WOFF2、截斷、brotli 解不開、沒有 cmap → Error', () => {
    const { woff2CodePoints } = need();
    const good = woff2Font([0x4f60, 0x597d]);
    const corrupt = Buffer.from(good);
    corrupt.fill(0xff, 80, Math.min(corrupt.length, 120));   // 壓縮資料的中間塗掉
    const cases = {
        '空的': Buffer.alloc(0),
        'WOFF 1（wOFF）': Buffer.concat([Buffer.from('wOFF', 'latin1'), good.subarray(4)]),
        'OpenType（OTTO）': Buffer.concat([Buffer.from('OTTO', 'latin1'), Buffer.alloc(60)]),
        '純文字': Buffer.from('這不是字型'),
        '只剩檔頭': good.subarray(0, 48),
        '截斷一半': good.subarray(0, Math.floor(good.length / 2)),
        '壓縮資料壞了': corrupt,
        '沒有 cmap': woff2Font([0x4f60], { noCmap: true }),
    };
    for (const [label, buf] of Object.entries(cases)) {
        assert.throws(() => woff2CodePoints(buf), Error, `${label}：要丟 Error`);
    }
});
