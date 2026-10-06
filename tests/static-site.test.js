// 4-b12 檢查員第 1 輪補的：lib/static-site.js 的 serveSite(dir) —— 給瀏覽器量版面用的本機靜態伺服器，壞掉的請求不能讓它掛掉、不能讀到資料夾外面。
// 介面細則見 tests/README.md「4-b12」第 18 條。伺服器開在子程序裡（跟命令真的用法一樣：一個程序開著它），測試從外面送請求。
//
// 量什麼：
//   GET /%00、/%00.html、/a%00b、/%2e%2e%2f、/%2e%2e%2foutside.txt（.. 編碼）、/%E0%A4%A（壞掉的編碼）→ 回 404 或 400；每一個之後再送一個正常請求要回 200；
//   伺服器程序一直活著（沒有結束）、stderr 沒有任何字（沒有未捕捉的例外與堆疊）。
//   符號連結穿越：網站資料夾裡一個指向外面檔案的連結（link.txt）、一個指向外面資料夾的連結（linkdir/）→ 讀不到外面的檔（404）。Windows 上這一條 skip。
//   正常的：/a.txt、/sub/（送 sub/index.html）回 200。
//
// 跑法（在 homepage/site/）：
//   npm test -- --test-name-pattern "B12 伺服器"
//   node --test tests/static-site.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SITE } from './helpers.js';
import { tmp } from './fallback-fixture.js';

const LIB = path.join(SITE, 'lib', 'static-site.js');
const SECRET = '資料夾外面的祕密';

// 網站資料夾：a.txt、sub/index.html；外面：outside.txt（祕密）、外面的資料夾 outdir/secret.txt
function layout(t) {
    const base = tmp(t, 'site-static-');
    const root = path.join(base, '網站 資料夾');
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a.txt'), 'A\n');
    fs.writeFileSync(path.join(root, 'sub', 'index.html'), '<p>sub</p>\n');
    fs.writeFileSync(path.join(base, 'outside.txt'), `${SECRET}\n`);
    fs.mkdirSync(path.join(base, 'outdir'));
    fs.writeFileSync(path.join(base, 'outdir', 'secret.txt'), `${SECRET}\n`);
    return { base, root };
}

// 子程序開伺服器，等它印出網址；回傳 { url, child, stderr(), alive() }
async function start(t, root) {
    if (!fs.existsSync(LIB)) assert.fail('缺 lib/static-site.js（後端之後實作）');
    const code = `const { serveSite } = await import(${JSON.stringify(pathToFileURL(LIB).href)});
const site = await serveSite(${JSON.stringify(root)});
console.log(site.url);
setInterval(() => {}, 1000);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    let exited = null;
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (status, signal) => { exited = { status, signal }; });
    t.after(() => { if (exited === null) child.kill(); });
    const url = await new Promise((resolve, reject) => {
        let out = '';
        const timer = setTimeout(() => reject(new Error(`伺服器 10 秒內沒有開起來；stderr：${err}`)), 10000);
        child.stdout.on('data', (d) => {
            out += d;
            const line = out.split('\n').find((row) => row.startsWith('http://'));
            if (line) { clearTimeout(timer); resolve(line.trim()); }
        });
        child.on('exit', () => { clearTimeout(timer); reject(new Error(`伺服器還沒開起來就結束了；stderr：${err}`)); });
    });
    return { url, stderr: () => err, alive: () => exited === null };
}

async function get(url, rawPath) {
    // 用 fetch 會把 %2e%2e 之類的先正規化掉；這裡照原樣送
    const { request } = await import('node:http');
    const target = new URL(url);
    return new Promise((resolve) => {
        const req = request({ host: target.hostname, port: target.port, path: rawPath, method: 'GET' }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (d) => { body += d; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', (err) => resolve({ status: null, body: '', error: err.code ?? err.message }));
        req.setTimeout(5000, () => { req.destroy(); resolve({ status: null, body: '', error: 'timeout' }); });
        req.end();
    });
}

test('B12 伺服器：正常的請求回 200（/a.txt、/sub/ 送 sub/index.html）', async (t) => {
    const { root } = layout(t);
    const server = await start(t, root);
    const a = await get(server.url, '/a.txt');
    assert.equal(a.status, 200);
    assert.equal(a.body, 'A\n');
    const sub = await get(server.url, '/sub/');
    assert.equal(sub.status, 200);
    assert.match(sub.body, /sub/);
});

test('B12 伺服器：%00、.. 編碼、壞掉的編碼 → 404 或 400，伺服器不掛、之後照常回 200、沒有堆疊', async (t) => {
    const { root } = layout(t);
    const server = await start(t, root);
    for (const bad of ['/%00', '/%00.html', '/a%00b', '/%2e%2e%2f', '/%2e%2e%2foutside.txt', '/%E0%A4%A', '/sub/%00/']) {
        const res = await get(server.url, bad);
        assert.ok(res.status === 404 || res.status === 400, `${bad}：要回 404 或 400，得到 ${res.status ?? res.error}；伺服器 stderr：${server.stderr()}`);
        assert.ok(!res.body.includes(SECRET), `${bad}：不能讀到資料夾外面的檔`);
        const ok = await get(server.url, '/a.txt');
        assert.equal(ok.status, 200, `${bad} 之後：伺服器要還活著，正常的請求回 200，得到 ${ok.status ?? ok.error}；伺服器 stderr：${server.stderr()}`);
    }
    assert.ok(server.alive(), `伺服器程序不能結束；stderr：${server.stderr()}`);
    assert.equal(server.stderr(), '', '伺服器的 stderr 要是空的（沒有未捕捉的例外與堆疊）');
});

test('B12 伺服器：符號連結指到資料夾外面 → 讀不到（404）', async (t) => {
    if (process.platform === 'win32') {
        t.skip('Windows 建符號連結要權限，這一條不跑');
        return;
    }
    const { base, root } = layout(t);
    fs.symlinkSync(path.join(base, 'outside.txt'), path.join(root, 'link.txt'));
    fs.symlinkSync(path.join(base, 'outdir'), path.join(root, 'linkdir'));
    const server = await start(t, root);
    for (const rawPath of ['/link.txt', '/linkdir/secret.txt']) {
        const res = await get(server.url, rawPath);
        assert.ok(!res.body.includes(SECRET), `${rawPath}：不能讀到資料夾外面的檔（得到 ${res.status}：${res.body.trim()}）`);
        assert.equal(res.status, 404, `${rawPath}：要回 404`);
    }
    assert.equal((await get(server.url, '/a.txt')).status, 200, '之後照常');
});
