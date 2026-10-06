// F10 /favicon.ico 不 404：out/favicon.ico 是 ICO（檔頭 00 00 01 00）、剛好兩張（16、32），內容是 public/favicon-16.png、favicon-32.png 原樣（不改像素）。
// 產生：npm run favicon（scripts/favicon.mjs）寫 public/favicon.ico，build 時原樣複製到 out/。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, OUT, needOut } from './helpers.js';

test('F10 /favicon.ico 不 404：out/favicon.ico 是 ICO、兩張（16、32）、內容是 favicon-16／32.png 原樣', () => {
    needOut();
    const file = path.join(OUT, 'favicon.ico');
    assert.ok(fs.existsSync(file), 'out/favicon.ico 不在（瀏覽器會去要 /favicon.ico，沒有就 404）：npm run favicon 再 build');
    const ico = fs.readFileSync(file);
    assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], '檔頭要是 ICO（00 00 01 00）');
    assert.equal(ico.readUInt16LE(4), 2, '要剛好兩張');
    const got = [0, 1].map((i) => {
        const at = 6 + 16 * i;
        return { size: ico.readUInt8(at), data: ico.subarray(ico.readUInt32LE(at + 12), ico.readUInt32LE(at + 12) + ico.readUInt32LE(at + 8)) };
    });
    assert.deepEqual(got.map((g) => g.size), [16, 32], '兩張是 16 與 32');
    for (const g of got) assert.ok(g.data.equals(fs.readFileSync(path.join(SITE, 'public', `favicon-${g.size}.png`))), `${g.size} 那張要跟 public/favicon-${g.size}.png 位元組一樣`);
});
