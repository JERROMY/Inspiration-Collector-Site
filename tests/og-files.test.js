// 4-b14 的 F8.5a（提交進來的檔）與 F8.5e（README 的字型清單）：只看檔案，不開瀏覽器。介面細則見 tests/README.md「4-b14」。
//
// 量什麼：
//   public/og/ 剛好三張 og-zh.png、og-en.png、og-ja.png（「/」用英文那張，不另做）；每張 PNG 檔頭 1200×630、≤ 300 KB、不是空白、三張彼此不同。
//   public/og/ 的圖沒有被 .gitignore 擋掉（要進 git：部署時不產圖）；叫不起 git 就 skip。
//   package.json 的 scripts.og 是 "node scripts/og.mjs"。
//   README.md 有一節講分享卡：npm run og、--root、--check、用到的字型（Google Sans Flex、Noto Sans TC、Noto Sans JP）與授權、「/」用 og-en.png。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "F8.5"
//   node --test tests/og-files.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SITE } from './helpers.js';
import { OG_NAMES, MAX_BYTES, readPng, pngSize, blankProblem, diffRatio } from './og-fixture.js';

const OG = path.join(SITE, 'public', 'og');

test('F8.5a 提交的圖：public/og/ 剛好三張 og-zh／en／ja.png，1200×630、≤ 300 KB、不是空白、三張彼此不同', () => {
    assert.ok(fs.existsSync(OG), '缺 public/og/（分享卡圖要產好提交進來：npm run og）');
    assert.deepEqual(fs.readdirSync(OG).filter((name) => !name.startsWith('.')).sort(), [...OG_NAMES].sort(), 'public/og/ 只放三張分享卡圖（「/」用 og-en.png，不另做）');
    const imgs = {};
    for (const name of OG_NAMES) {
        const file = path.join(OG, name);
        assert.deepEqual(pngSize(file), { width: 1200, height: 630 }, `${name}：PNG 檔頭的寬高要是 1200×630`);
        const bytes = fs.statSync(file).size;
        assert.ok(bytes <= MAX_BYTES, `${name}：${bytes} 位元組，上限 ${MAX_BYTES}`);
        imgs[name] = readPng(file);
        assert.equal(blankProblem(imgs[name]), null, `${name}：不能是空白圖`);
    }
    for (let i = 0; i < OG_NAMES.length; i += 1) {
        for (let j = i + 1; j < OG_NAMES.length; j += 1) {
            const ratio = diffRatio(imgs[OG_NAMES[i]], imgs[OG_NAMES[j]]);
            assert.ok(ratio >= 0.005, `${OG_NAMES[i]} 與 ${OG_NAMES[j]} 要是不同的圖，得到不同的像素 ${(ratio * 100).toFixed(3)}%`);
        }
    }
});

test('F8.5a 提交的圖：public/og/ 的圖沒有被 .gitignore 擋掉（要進 git）', (t) => {
    if (spawnSync('git', ['--version']).error) return t.skip('叫不起 git');
    for (const name of OG_NAMES) {
        const res = spawnSync('git', ['check-ignore', '-q', `public/og/${name}`], { cwd: SITE });
        if (res.status === 128) return t.skip('不在 git repo 裡');
        assert.equal(res.status, 1, `public/og/${name} 被 .gitignore 擋掉了（git check-ignore 結束碼 ${res.status}）`);
    }
});

test('F8.5 package.json：scripts.og 是 "node scripts/og.mjs"', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SITE, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts && pkg.scripts.og, 'node scripts/og.mjs');
});

test('F8.5e README：有一節講分享卡 —— 指令（npm run og、--root、--check）、用到的字型（Google Sans Flex、Noto Sans TC、Noto Sans JP）與授權、「/」用 og-en.png', () => {
    const text = fs.readFileSync(path.join(SITE, 'README.md'), 'utf8');
    const sections = text.split(/^(?=## )/m);
    const section = sections.find((part) => /^## .*分享卡/.test(part));
    assert.ok(section, 'README.md 要有一節標題寫著「分享卡」（## 開頭）');
    for (const word of ['npm run og', '--root', '--check', 'public/og', 'Google Sans Flex', 'Noto Sans TC', 'Noto Sans JP', '授權', 'og-en.png']) {
        assert.ok(section.includes(word), `README 的分享卡那一節要寫到「${word}」`);
    }
});
