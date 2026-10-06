// 4-b10 的 B10.2：lib/changelog.js 好的條目多交原句 raw（使用者寫的整行去掉開頭「- 」與頭尾空白）。介面細則見 tests/README.md「4-b10」。
//
// 量什麼：
//   B10.2 好的條目剛好 { ok, kind, text, raw }；raw ＝ 那一行去掉「-」與頭尾空白（冒號、冒號兩邊的空白、kind 都留著；註解拿掉）。
//         沒有冒號的（「- 修好」）raw 與 text 都是那幾個字、kind 是空字串。三語各一組。
//         壞的條目、壞的版本照舊 { ok: false, line, raw, reason }（壞紀錄的 raw 是原檔那一行，跟好條目的 raw 不同，照 4-b1）。
//         CRLF＋BOM 一樣；走網站讀的那條路（readContent）每一條好條目的 raw 都對得上內容檔裡的那一行。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B10.2"
//   node --test tests/changelog-raw.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lib, lines, noThrow, FIXTURES } from './helpers.js';

const need = await lib('changelog.js', ['parseChangelog']);
const needContent = await lib('content.js', ['readContent']);

function items(rows) {
    const { parseChangelog } = need();
    const result = noThrow('parseChangelog', () => parseChangelog(lines(rows)));
    assert.equal(result.length, 1, `一版，得到 ${JSON.stringify(result)}`);
    assert.equal(result[0].ok, true, `版本要是好的，得到 ${JSON.stringify(result[0])}`);
    return result[0].items;
}

function expectItems(got, want, label) {
    assert.equal(got.length, want.length, `${label}：條數`);
    want.forEach((w, i) => {
        if (w.ok === false) {
            assert.deepEqual(Object.keys(got[i]).sort(), ['line', 'ok', 'raw', 'reason'], `${label} 第 ${i + 1} 條：壞紀錄照舊`);
            assert.equal(got[i].ok, false);
            assert.equal(got[i].raw, w.raw, `${label} 第 ${i + 1} 條：壞紀錄的 raw 是原檔那一行`);
            return;
        }
        assert.deepEqual(Object.keys(got[i]).sort(), ['kind', 'ok', 'raw', 'text'], `${label} 第 ${i + 1} 條：好的條目剛好 ok、kind、text、raw，得到 ${JSON.stringify(got[i])}`);
        assert.deepStrictEqual(got[i], { ok: true, ...w }, `${label} 第 ${i + 1} 條`);
    });
}

test('B10.2 中文：raw 是去掉「- 」的整行（冒號接回去的原句）', () => {
    expectItems(items([
        '## 1.0.5 · 2026-10-02',
        '- 修好：ChatGPT 改版後「存這則」不見了',
        '- 拿掉：選取文字後浮出的按鈕',
        '- 修好',
        '-   新增：  前後有空白  ',
        '- 新增:半形冒號',
        '- 修好：a <!-- 註解 -->',
        '- 見 https://jerromy.com/ 修好：網址後面',
        '- 修好：',
    ]), [
        { kind: '修好', text: 'ChatGPT 改版後「存這則」不見了', raw: '修好：ChatGPT 改版後「存這則」不見了' },
        { kind: '拿掉', text: '選取文字後浮出的按鈕', raw: '拿掉：選取文字後浮出的按鈕' },
        { kind: '', text: '修好', raw: '修好' },
        { kind: '新增', text: '前後有空白', raw: '新增：  前後有空白' },
        { kind: '新增', text: '半形冒號', raw: '新增:半形冒號' },
        { kind: '修好', text: 'a', raw: '修好：a' },
        { kind: '', text: '見 https://jerromy.com/ 修好：網址後面', raw: '見 https://jerromy.com/ 修好：網址後面' },
        { ok: false, raw: '- 修好：' },
    ], '中文');
});

test('B10.2 英文：raw 留著半形冒號與空白', () => {
    expectItems(items([
        '## 1.0.5 · 2026-10-02',
        '- Fixed: The "Save this" button is back on ChatGPT',
        '- Removed: the button that popped up after selecting text',
        '- Fixed : spaced colon',
        '- See https://jerromy.com/collector/',
        '- Crash at 10:30 is gone',
    ]), [
        { kind: 'Fixed', text: 'The "Save this" button is back on ChatGPT', raw: 'Fixed: The "Save this" button is back on ChatGPT' },
        { kind: 'Removed', text: 'the button that popped up after selecting text', raw: 'Removed: the button that popped up after selecting text' },
        { kind: 'Fixed', text: 'spaced colon', raw: 'Fixed : spaced colon' },
        { kind: '', text: 'See https://jerromy.com/collector/', raw: 'See https://jerromy.com/collector/' },
        { kind: '', text: 'Crash at 10:30 is gone', raw: 'Crash at 10:30 is gone' },
    ], '英文');
});

test('B10.2 日文：raw 是整行', () => {
    expectItems(items([
        '## 1.0.5 · 2026-10-02',
        '- 修正：ChatGPT のデザイン変更で消えた「これを保存」を修正しました',
        '- 廃止：テキスト選択時に浮き出るボタン',
        '- 10:30 からメンテナンス',
        '-',
    ]), [
        { kind: '修正', text: 'ChatGPT のデザイン変更で消えた「これを保存」を修正しました', raw: '修正：ChatGPT のデザイン変更で消えた「これを保存」を修正しました' },
        { kind: '廃止', text: 'テキスト選択時に浮き出るボタン', raw: '廃止：テキスト選択時に浮き出るボタン' },
        { kind: '', text: '10:30 からメンテナンス', raw: '10:30 からメンテナンス' },
        { ok: false, raw: '-' },
    ], '日文');
});

test('B10.2 CRLF＋BOM：raw 一樣、沒有 \\r', () => {
    const { parseChangelog } = need();
    const rows = ['## 1.0.5 · 2026-10-02', '- 修好：第一條  ', '- Removed: second', ''];
    const lf = parseChangelog(rows.join('\n'));
    const crlf = parseChangelog('\uFEFF' + rows.join('\r\n'));
    assert.deepStrictEqual(crlf, lf);
    assert.deepEqual(lf[0].items.map((it) => it.raw), ['修好：第一條', 'Removed: second']);
});

test('B10.2 走網站讀的那條路：readContent 三語每一條好條目的 raw 都是內容檔裡那一行去掉「- 」', async (t) => {
    const { readContent } = needContent();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-changelog-raw-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    for (const name of fs.readdirSync(path.join(FIXTURES, 'content'))) fs.copyFileSync(path.join(FIXTURES, 'content', name), path.join(dir, name));
    const content = await readContent(dir);
    for (const lang of ['zh', 'en', 'ja']) {
        const source = fs.readFileSync(path.join(dir, `changelog.${lang}.md`), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        const rows = new Set(source.split(/\r?\n/).map((row) => row.trim()).filter((row) => row.startsWith('-')).map((row) => row.slice(1).trim()));
        assert.equal(content.changelog[lang].ok, true, `${lang}：讀得到`);
        let count = 0;
        for (const version of content.changelog[lang].entries.filter((v) => v.ok)) {
            for (const item of version.items.filter((it) => it.ok)) {
                assert.ok(rows.has(item.raw), `${lang}：raw「${item.raw}」要是內容檔裡的一行（去掉「- 」）`);
                count += 1;
            }
        }
        assert.ok(count > 0, `${lang}：至少要有一條好條目`);
    }
});
