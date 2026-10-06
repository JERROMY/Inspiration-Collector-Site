// 測試共用的小工具（不是測試；scripts/test.mjs 只跑 *.test.js）。
//
// lib(file, names)  先試著載入 lib/<file>，回傳一個 need()：每條測試開頭呼叫它。
//                   檔還不存在、載入失敗、少了匯出 → 以「缺 lib/changelog.js」這類清楚的訊息失敗，不是 import 丟出看不懂的例外。
// noThrow / noReject 包住被測的函式：它丟例外的話，紅在「不丟例外」這一步（B1.4、B1.5 要的就是這個）。
// crlfBom           讀 fixtures/crlf-bom/ 的檔，順便確認它真的還是 BOM＋CRLF（防呆）。
// expectBad         壞紀錄的形狀：{ ok: false, line, raw, reason }，line 是原檔行號、raw 是那一行原文、reason 是講得出哪裡壞的中文。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES = path.join(SITE, 'tests', 'fixtures');

export async function lib(file, names) {
    const full = path.join(SITE, 'lib', file);
    let mod = null;
    let loadError = null;
    if (fs.existsSync(full)) {
        try { mod = await import(pathToFileURL(full).href); } catch (err) { loadError = err; }
    }
    return function need() {
        if (!fs.existsSync(full)) assert.fail(`缺 lib/${file}（後端之後實作）`);
        if (loadError) assert.fail(`lib/${file} 載入失敗：${loadError.message}`);
        for (const name of names) {
            if (typeof mod[name] !== 'function') assert.fail(`lib/${file} 沒有匯出 ${name}`);
        }
        return mod;
    };
}

// 一行一個元素，接成檔案內容（結尾有換行，跟 GitHub 網頁存出來的一樣）
export function lines(rows) {
    return rows.join('\n') + '\n';
}

// 某一行在原檔是第幾行（1 起算）；用這個算預期的行號，不手數
export function lineOf(rows, row) {
    const i = rows.indexOf(row);
    if (i < 0) throw new Error(`測試自己寫錯：rows 裡沒有「${row}」`);
    return i + 1;
}

// tests/fixtures/crlf-bom/<name>：回傳 { crlf: 原樣（BOM＋CRLF）, lf: 拿掉 BOM、CRLF 換成 LF 的同一份 }。
// 防呆：檔案要真的是 BOM＋CRLF —— 被 git 或編輯器改成 LF 的話，比對兩份會是假的綠，這裡先紅
export function crlfBom(name) {
    const text = fs.readFileSync(path.join(FIXTURES, 'crlf-bom', name), 'utf8');
    assert.ok(text.startsWith('\uFEFF'), `fixtures/crlf-bom/${name} 開頭要有 UTF-8 BOM（被改掉了？）`);
    assert.ok(text.includes('\r\n') && !/[^\r]\n/.test(text), `fixtures/crlf-bom/${name} 每一行都要是 CRLF（被 git 改成 LF 了？看同資料夾的 .gitattributes）`);
    return { crlf: text, lf: text.slice(1).replace(/\r\n/g, '\n') };
}

export function noThrow(label, fn) {
    try {
        return fn();
    } catch (err) {
        assert.fail(`${label} 丟了例外（要一條一條接住，不准丟）：${err && err.message}`);
    }
}

export async function noReject(label, fn) {
    try {
        return await fn();
    } catch (err) {
        assert.fail(`${label} 丟了例外（要一條一條接住，不准丟）：${err && err.message}`);
    }
}

// 條目數＝好的＋壞的：放在每條壞法測試的第一步，靜靜略過的實作會紅在這裡
export function expectCount(result, count, label) {
    assert.ok(Array.isArray(result), `${label}：要回傳陣列，得到 ${JSON.stringify(result)}`);
    assert.equal(result.length, count,
        `${label}：條目數要是 ${count}（好的＋壞的，一條都不能靜靜略過），得到 ${result.length}：${JSON.stringify(result)}`);
}

export function expectBad(rec, { line, raw, words = [] }, label) {
    assert.ok(rec && typeof rec === 'object', `${label}：沒有這一筆`);
    assert.equal(rec.ok, false, `${label}：要是 ok:false，得到 ${JSON.stringify(rec)}`);
    assert.deepEqual(Object.keys(rec).sort(), ['line', 'ok', 'raw', 'reason'], `${label}：壞紀錄只有 ok、line、raw、reason，得到 ${JSON.stringify(rec)}`);
    assert.equal(rec.line, line, `${label}：line 要是原檔第 ${line} 行，得到 ${rec.line}`);
    assert.equal(typeof rec.raw, 'string', `${label}：raw 要是字串`);
    assert.equal(rec.raw.trim(), raw.trim(), `${label}：raw 要是那一行原文`);
    assert.ok(typeof rec.reason === 'string' && /[一-鿿]/.test(rec.reason), `${label}：reason 要是中文，得到 ${JSON.stringify(rec.reason)}`);
    for (const word of words) {
        assert.ok(rec.reason.includes(word), `${label}：reason 要講到「${word}」，得到「${rec.reason}」`);
    }
}

// F1.7（4-f1）：網站的套件白名單。前端加 Next.js 之後 dependencies 只准這三個；devDependencies 等其他種類一律沒有（或空的）。
// 「後端程式不用 npm 套件」不靠這裡守，靠 lib/、scripts/ 的 import 檢查（structure.test.js、structure-f1.test.js）。
export const PACKAGE_WHITELIST = ['next', 'react', 'react-dom'];

export function assertPackageWhitelist(pkg) {
    const deps = pkg.dependencies ?? {};
    assert.ok(deps && typeof deps === 'object' && !Array.isArray(deps), `package.json 的 dependencies 要是物件，得到 ${JSON.stringify(deps)}`);
    const extra = Object.keys(deps).filter((name) => !PACKAGE_WHITELIST.includes(name));
    assert.deepEqual(extra, [], `package.json 的 dependencies 只准 ${PACKAGE_WHITELIST.join('、')}，多了：${extra.join('、')}`);
    for (const key of ['devDependencies', 'optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies']) {
        const value = pkg[key];
        const count = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length;
        assert.equal(count, 0, `package.json 不要有 ${key}：${JSON.stringify(value)}`);
    }
}
