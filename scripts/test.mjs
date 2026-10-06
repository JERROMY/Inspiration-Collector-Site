// homepage/site 的測試進入點：在 homepage/site/ 底下跑 npm test。
//
// **不要改回 package.json 裡直接寫 node --test。** 跟 clipper/scripts/test.mjs 同一個理由，兩種寫法各在一邊壞掉：
//
//   node --test tests/*.test.js   Windows 壞 —— 萬用字元靠 shell 展開，npm 在 Windows 走 cmd.exe，它不展開
//   node --test tests/            Node 22 壞 —— Cannot find module '…/tests'（Node 20 會掃目錄，22 不會）
//
// 所以檔案清單自己列，不靠 shell、也不靠 Node 的目錄行為。路徑從這支檔的位置算，從哪個資料夾叫都一樣。
// tests/ 底下只跑 *.test.js；helpers.js 與 fixtures/ 不是測試。
//
// 只跑某一條：npm test -- --test-name-pattern "B1.4"（-- 後面的參數照原樣交給 node --test）。
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(SITE, 'tests');

const files = readdirSync(TESTS)
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => path.join(TESTS, name));

const run = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit', cwd: SITE });
process.exit(run.status ?? 1);
