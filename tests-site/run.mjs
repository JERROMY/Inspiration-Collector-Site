// 網站前端測試的進入點：npm run test:site ＝ npm run build && node tests-site/run.mjs（在 homepage/site/ 底下）。
//
// 為什麼不在 package.json 直接寫 node --test tests-site/*.test.js：跟 scripts/test.mjs 同一個理由 ——
// 萬用字元在 Windows 的 cmd.exe 不展開（npm 在 Windows 走 cmd.exe），node --test <目錄> 在 Node 22 找不到模組。
// 所以檔案清單自己列。只跑 tests-site/*.test.js；helpers.js、server.js、fixtures/ 不是測試。
//
// 只跑某一條：node tests-site/run.mjs --test-name-pattern "F1.2"（後面的參數照原樣交給 node --test）。
// 這支不 build：先 npm run build（或直接 npm run test:site）。
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');

// 截圖工具那一支最後單獨跑：它開瀏覽器拍三語 × 十二種寬度，每張有 15 秒的上限；跟其他幾支（暫存複本 build、開瀏覽器）同時跑，
// 機器一忙就會超過（量過：整套一起跑時 1～2 次裡有 1 次 page.screenshot 逾時）。
// 量時間與版面跳動的那一支（CLS 二十幾組、慢手機的 CPU 模擬）也單獨跑：跟其他幾支同時跑時，它量到的時間會被拖慢，
// 也會把別支拖到逾時（量過：加進來之後整套一起跑，F3.2 的 header 連兩次 5 秒逾時，單獨跑都過）。
// 寬度掃描（F4.6b，五百組左右的開頁，自己同時開六頁）也單獨一段，理由同上。
// 07 打字（F9）也單獨一段：它量 Long Task 與 layout-shift，旁邊在 build 或開頁會量到別人的長工作；假時鐘快轉到打完也要好幾分鐘。
const LAST = 'shots.test.js';
const ALONE = ['hero-quality.test.js', 'cls-sweep.test.js', 'typing.test.js'];
const names = readdirSync(HERE).filter((name) => name.endsWith('.test.js')).sort();
const phases = [
    names.filter((name) => name !== LAST && !ALONE.includes(name)),
    ...ALONE.map((one) => names.filter((name) => name === one)),
    names.filter((name) => name === LAST),
].filter((list) => list.length > 0);

let status = 0;
for (const list of phases) {
    const run = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...list.map((name) => path.join(HERE, name))], { stdio: 'inherit', cwd: SITE });
    if ((run.status ?? 1) !== 0) status = run.status ?? 1;
}
process.exit(status);
