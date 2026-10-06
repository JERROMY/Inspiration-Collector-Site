// 4-b9 的 B9.5：content:check 警告社群代號缺名稱 —— links.md 的代號在字串表（strings/<zh|en|ja>.json）沒有 social.<代號> 時印警告，不擋部署。介面細則見 tests/README.md「4-b9」。
//
// 量什麼（一律在暫存資料夾組一份 content/ 與 strings/：content 是 tests/fixtures/content-check/good/ 的複本、strings 是測試自己寫的小 JSON，不碰專案的檔）：
//   B9.5 checkContent(dir, { strings: <字串表資料夾> })：
//        三語都有 → 沒有警告；缺的 → warnings 有 { file: 'links.md', message }，message 寫到代號、social.<代號> 與缺的那個語言的檔名（zh.json／en.json／ja.json）；
//        ok 與 problems 不受影響（警告不算錯）；寫壞的連結那一行（代號不合法）照舊是 problem，不另外警告；
//        字串表資料夾不在、某一語的檔不在、不是 JSON → 一條警告講清楚（寫到「找不到」或那支檔名），其他語言照常檢查，不丟例外；
//        沒給 strings 選項 → 不做這項檢查（跟以前一樣）。
//   B9.5 命令：--strings <資料夾>，沒給就用網站的 strings/（scripts/../strings）；缺名稱 → 輸出「警告」與代號、結束碼照舊（沒有要修的是 0、有要修的是 1）；
//        --strings 指到不存在的資料夾 → 警告、結束碼 0；--strings= 空字串 → 用法錯誤（結束碼 2）；跑完 homepage/site/ 底下一個檔都不變。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B9.5"
//   node --test tests/content-check-social.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE, lib } from './helpers.js';
import { fixture } from './content-check-fixture.js';
import { stamp } from './b6-fixture.js';

const need = await lib('content-check.js', ['checkContent']);
const SCRIPT = path.join(SITE, 'scripts', 'content-check.mjs');
const LANGS = ['zh', 'en', 'ja'];
// good/links.md 的代號：blog、facebook、x、threads
const NAMES = { 'social.blog': '部落格', 'social.facebook': 'Facebook', 'social.x': 'X', 'social.threads': 'Threads' };

// 暫存資料夾裡的 content/（good 的複本，links.md 可以多加幾行）與 strings/（每一語的 JSON，可以拿掉或寫壞）
function setup(t, { extraLinks = [], strings = {} } = {}) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'site-social-'));
    t.after(() => fs.rmSync(base, { recursive: true, force: true }));
    const content = path.join(base, '內容 資料夾', 'content');
    fs.mkdirSync(content, { recursive: true });
    for (const name of fs.readdirSync(fixture('good'))) fs.copyFileSync(path.join(fixture('good'), name), path.join(content, name));
    if (extraLinks.length) fs.appendFileSync(path.join(content, 'links.md'), extraLinks.map((row) => `${row}\n`).join(''));
    const dir = path.join(base, '字串 表', 'strings');
    fs.mkdirSync(dir, { recursive: true });
    for (const lang of LANGS) {
        const value = strings[lang] === undefined ? NAMES : strings[lang];
        if (value === null) continue;
        fs.writeFileSync(path.join(dir, `${lang}.json`), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
    }
    return { base, content, strings: dir };
}

async function check(content, strings) {
    const { checkContent } = need();
    try {
        return await checkContent(content, strings === undefined ? undefined : { strings });
    } catch (err) {
        assert.fail(`checkContent 丟了例外（要變成警告）：${err.message}`);
    }
}

const about = (warnings, word) => warnings.filter((w) => w.message.includes(word));

function expectMissing(result, code, langs, label) {
    const hits = about(result.warnings, `social.${code}`);
    assert.ok(hits.length > 0, `${label}：要有一條警告寫到 social.${code}，得到 ${JSON.stringify(result.warnings)}`);
    for (const w of hits) {
        assert.deepEqual(Object.keys(w).sort(), ['file', 'message'], `${label}：警告剛好 file、message`);
        assert.equal(w.file, 'links.md', `${label}：警告的 file 是 links.md`);
    }
    for (const lang of langs) {
        assert.ok(hits.some((w) => w.message.includes(`${lang}.json`)), `${label}：要講到缺 ${lang}.json，得到 ${JSON.stringify(hits)}`);
    }
}

test('B9.5 字串表三語都有：沒有警告', async (t) => {
    const { content, strings } = setup(t);
    const result = await check(content, strings);
    assert.deepEqual(result.warnings, [], `不該有警告，得到 ${JSON.stringify(result.warnings)}`);
    assert.equal(result.ok, true);
});

test('B9.5 三語都缺 social.mastodon：警告寫到代號與 zh.json、en.json、ja.json；不算錯', async (t) => {
    const { content, strings } = setup(t, { extraLinks: ['- mastodon · https://mastodon.social/@jerromy'] });
    const result = await check(content, strings);
    expectMissing(result, 'mastodon', LANGS, 'mastodon');
    assert.ok(about(result.warnings, 'social.mastodon').every((w) => w.message.includes('mastodon')));
    assert.equal(result.ok, true, '警告不算錯：ok 還是 true');
    assert.deepEqual(result.problems, [], 'problems 還是空的');
    assert.equal(about(result.warnings, 'social.blog').length, 0, '三語都有的代號不警告');
});

test('B9.5 只缺某一語：講出缺的那一語', async (t) => {
    const { content, strings } = setup(t, {
        extraLinks: ['- mastodon · https://mastodon.social/@jerromy', '- github · https://github.com/jerromy'],
        strings: {
            zh: { ...NAMES, 'social.mastodon': 'Mastodon' },
            en: { ...NAMES, 'social.mastodon': 'Mastodon', 'social.github': 'GitHub' },
            ja: { ...NAMES, 'social.github': 'GitHub' },
        },
    });
    const result = await check(content, strings);
    expectMissing(result, 'mastodon', ['ja'], 'mastodon 只缺日文');
    expectMissing(result, 'github', ['zh'], 'github 只缺中文');
    assert.equal(result.ok, true);
});

test('B9.5 寫壞的連結（代號不合法）照舊是 problem，不另外警告名稱', async (t) => {
    const { content, strings } = setup(t, { extraLinks: ['- Mastodon · https://mastodon.social/@jerromy'] });
    const result = await check(content, strings);
    assert.equal(result.ok, false, '寫壞的連結是要修的');
    assert.ok(result.problems.some((p) => p.file === 'links.md'), 'problems 有 links.md 那一行');
    assert.equal(about(result.warnings, 'Mastodon').length + about(result.warnings, 'social.mastodon').length, 0, '壞的那一行不另外警告名稱');
});

test('B9.5 字串表資料夾不在：一條警告講「找不到」與那個資料夾，不丟例外；problems 不受影響', async (t) => {
    const { base, content } = setup(t, { extraLinks: ['- mastodon · https://mastodon.social/@jerromy'] });
    const missing = path.join(base, '沒有 這個', 'strings');
    const result = await check(content, missing);
    const hits = result.warnings.filter((w) => w.message.includes('找不到'));
    assert.equal(hits.length, 1, `要剛好一條「找不到」的警告，得到 ${JSON.stringify(result.warnings)}`);
    assert.ok(hits[0].message.includes(missing) || hits[0].message.includes('strings'), `要寫到那個資料夾：${hits[0].message}`);
    assert.equal(result.ok, true);
});

test('B9.5 字串表某一語的檔不在、不是 JSON：警告寫到那支檔名，其他語言照常檢查', async (t) => {
    const { content, strings } = setup(t, {
        extraLinks: ['- mastodon · https://mastodon.social/@jerromy'],
        strings: { en: null, ja: '{ not json' },
    });
    const result = await check(content, strings);
    assert.ok(result.warnings.some((w) => w.message.includes('en.json')), `en.json 不在要有警告：${JSON.stringify(result.warnings)}`);
    assert.ok(result.warnings.some((w) => w.message.includes('ja.json') && !w.message.includes('social.')), `ja.json 不是 JSON 要有一條講那支檔的警告：${JSON.stringify(result.warnings)}`);
    expectMissing(result, 'mastodon', ['zh'], '中文照常檢查');
    assert.equal(result.ok, true);
});

test('B9.5 沒給 strings 選項：不做這項檢查（跟以前一樣）', async (t) => {
    const { content } = setup(t, { extraLinks: ['- mastodon · https://mastodon.social/@jerromy'] });
    const result = await check(content, undefined);
    assert.equal(about(result.warnings, 'mastodon').length, 0, `沒給 strings 不警告：${JSON.stringify(result.warnings)}`);
});

// ── 命令 ──

function run(args) {
    if (!fs.existsSync(SCRIPT)) assert.fail('缺 scripts/content-check.mjs');
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'site-social-cwd-'));
    try {
        const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000 });
        assert.equal(res.error, undefined);
        assert.deepEqual(fs.readdirSync(cwd), [], '跑完 cwd 不多出檔');
        return { ...res, all: `${res.stdout}\n${res.stderr}` };
    } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
    }
}

test('B9.5 命令：--strings 給了、缺名稱 → 印警告與代號，結束碼 0（不擋部署）；homepage/site/ 不動', (t) => {
    const { content, strings } = setup(t, { extraLinks: ['- mastodon · https://mastodon.social/@jerromy'] });
    const before = stamp(SITE);
    const res = run(['--dir', content, '--strings', strings]);
    assert.equal(res.status, 0, `只有警告，結束碼要是 0，得到 ${res.status}：${res.all}`);
    assert.match(res.all, /警告/);
    assert.ok(res.all.split(/\r?\n/).some((row) => row.includes('social.mastodon') && row.includes('links.md')), `要有一行寫到 links.md 與 social.mastodon：${res.all}`);
    assert.deepEqual(stamp(SITE), before, 'homepage/site/ 底下一個檔都不變');
});

test('B9.5 命令：同時有要修的 → 結束碼照舊是 1（警告不改變結束碼的規則）', (t) => {
    const { content, strings } = setup(t, { extraLinks: ['- mastodon · https://mastodon.social/@jerromy', '- Bad · https://example.com/'] });
    const res = run(['--dir', content, '--strings', strings]);
    assert.equal(res.status, 1, `有要修的，結束碼要是 1，得到 ${res.status}：${res.all}`);
    assert.match(res.all, /social\.mastodon/);
});

test('B9.5 命令：不給 --strings 用網站的 strings/（不認得的代號會被警告）', (t) => {
    const { content } = setup(t, { extraLinks: ['- zzqtestcode · https://example.com/zzq'] });
    const res = run(['--dir', content]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}：${res.all}`);
    assert.match(res.all, /social\.zzqtestcode/, '網站的字串表沒有這個代號，要警告');
    assert.doesNotMatch(res.all, /social\.blog/, '網站的字串表有 blog，不警告');
});

test('B9.5 命令：--strings 指到不存在的資料夾 → 警告講「找不到」、結束碼 0；--strings= 空字串 → 用法錯誤 2', (t) => {
    const { base, content } = setup(t);
    const res = run(['--dir', content, '--strings', path.join(base, '沒有這個')]);
    assert.equal(res.status, 0, `結束碼要是 0，得到 ${res.status}：${res.all}`);
    assert.match(res.all, /找不到/);
    const bad = run(['--dir', content, '--strings=']);
    assert.equal(bad.status, 2, `--strings= 空字串是用法錯誤，得到 ${bad.status}：${bad.all}`);
    const first = bad.stderr.split(/\r?\n/).find((row) => row.trim() !== '') ?? '';
    assert.match(first, /[一-鿿]/, `stderr 第一行要是中文：${first}`);
});
