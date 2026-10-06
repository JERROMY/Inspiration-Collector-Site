/**
 * static-site.js —— 在本機開一個靜態伺服器，把一個已經產生好的網站資料夾（Next.js 的 out/ 之類）當根目錄送出去，給瀏覽器量版面用。
 *
 * 只聽 127.0.0.1、埠由系統挑；網址以 / 結尾就送那個資料夾的 index.html。只送資料夾裡的檔案，三層防線各自獨立：路徑含空字元（%00）不理、
 * 寫出來就跳出資料夾（..）不理、解掉符號連結的真實路徑不在資料夾裡不理；壞的請求（編碼壞掉、檔案系統丟錯）只回 400／404，不會讓伺服器掛掉。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8',
};

/**
 * @param {string} root 網站資料夾（已解成真實路徑）
 * @param {string} urlPath 網址的路徑（已經去掉 ? 之後，還沒解碼）
 * @returns {{ status: 200, file: string } | { status: 400 | 404 }} 要送的檔案（真實路徑）；編碼壞了是 400；找不到、不是檔案、含空字元、跳出資料夾（含符號連結指到外面）是 404
 */
function resolveRequest(root, urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch {
        return { status: 400 };
    }
    // 第一層：空字元（%00）一律不理，不丟給檔案系統
    if (decoded.includes('\0')) return { status: 404 };
    // 第二層：路徑寫出來就跳出資料夾（..）
    const wanted = path.resolve(root, `.${decoded.endsWith('/') ? `${decoded}index.html` : decoded}`);
    if (wanted !== root && !wanted.startsWith(root + path.sep)) return { status: 404 };
    // 第三層：解掉符號連結之後的真實路徑也要在資料夾裡面；任何檔案系統的錯都當作找不到
    try {
        const real = fs.realpathSync(wanted);
        if (real !== root && !real.startsWith(root + path.sep)) return { status: 404 };
        return fs.statSync(real).isFile() ? { status: 200, file: real } : { status: 404 };
    } catch {
        return { status: 404 };
    }
}

/**
 * @param {string} dir 網站資料夾
 * @returns {Promise<{ url: string, close: () => Promise<void> }>} 伺服器的網址（http://127.0.0.1:埠）與關掉它的函式
 * @throws {Error} 網站資料夾不存在（解不出真實路徑）
 */
export function serveSite(dir) {
    const root = fs.realpathSync(path.resolve(dir));
    const server = http.createServer((request, response) => {
        // 最外面一層保險：任何沒想到的例外都只回 500、記一行，不讓整個程序結束
        try {
            const result = resolveRequest(root, new URL(request.url, 'http://localhost').pathname);
            if (result.status !== 200) {
                response.writeHead(result.status, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end(result.status === 400 ? 'bad request' : 'not found');
                return;
            }
            response.writeHead(200, { 'Content-Type': TYPES[path.extname(result.file).toLowerCase()] ?? 'application/octet-stream' });
            fs.createReadStream(result.file).on('error', () => response.destroy()).pipe(response);
        } catch (err) {
            console.error(`static-site：處理 ${String(request.url).slice(0, 200)} 時出錯，回 500（${err.message}）`);
            if (response.headersSent) response.destroy();
            else response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('server error');
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); }) });
        });
    });
}
