// 4-b14 檢查員第 1 輪：在子程序裡跑 lib/og-run.js 的 shootAll，量它開的本機伺服器（og-serve.test.js 用；不是測試）。
//
// 用法：node probe.mjs <根目錄> <要送的路徑，JSON 陣列>
// 交給 shootAll 一個假的瀏覽器：shootAll 開好伺服器、叫 page.goto(<伺服器網址>/design/…) 的那一刻，伺服器正開著 ——
// 假的 goto 就照原樣（不正規化）送那幾個路徑，每一個之後再送一次正常的 /a.txt，看伺服器還活不活著；
// 另外試著從 ::1 與這台的區域網路 IPv4 連同一個埠（只聽 127.0.0.1 的話要連不上）。量完丟一個例外讓 shootAll 收掉伺服器。
// 印一行「RESULT <JSON>」：{ url, results: [{ path, status, body, error, after }], other: [{ host, status, error }] }。
// 伺服器被請求弄掛的話，這個程序會在印 RESULT 之前結束（結束碼不是 0），測試就知道。
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const [root, pathsJson] = process.argv.slice(2);
const paths = JSON.parse(pathsJson);
const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'lib', 'og-run.js');
const { shootAll } = await import(pathToFileURL(lib).href);

function get(host, port, rawPath) {
    return new Promise((resolve) => {
        const req = http.request({ host, port, path: rawPath, method: 'GET' }, (res) => {
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

let result = null;
const DONE = 'og-serve-probe：量完了';
const page = {
    on() {},
    async goto(target) {
        const url = new URL(target);
        const port = Number(url.port);
        const results = [];
        for (const rawPath of paths) {
            const res = await get(url.hostname, port, rawPath);
            const after = await get(url.hostname, port, '/a.txt');
            results.push({ path: rawPath, ...res, after: after.status ?? after.error });
        }
        const lan = Object.values(os.networkInterfaces()).flat().find((nic) => nic && nic.family === 'IPv4' && !nic.internal);
        const other = [];
        for (const host of ['::1', ...(lan ? [lan.address] : [])]) {
            const res = await get(host, port, '/a.txt');
            other.push({ host, status: res.status, error: res.error ?? null });
        }
        result = { url: url.origin, results, other };
        throw new Error(DONE);
    },
};
const browser = { async newContext() { return { async newPage() { return page; }, async close() {}, async newCDPSession() { throw new Error(DONE); } }; } };

try {
    await shootAll({ browser, root });
} catch (err) {
    if (err.message !== DONE) {
        process.stdout.write(`ERROR ${err.message}\n`);
    }
}
if (result) process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
