// 網站前端測試用的靜態伺服器（不是測試）：把一個資料夾（通常是 out/）當網站根目錄，照 Cloudflare Pages 的主要規則回（它另外會把 /x/index.html 轉到 /x/，這裡不轉）：
//   /zh/ → zh/index.html；找不到 → 404 狀態碼＋404.html；只收 GET／HEAD（其他方法回 405）；不出這個資料夾。
// holdFonts()／releaseFonts()：先扣住 .woff2 的回應，等測試確定第一次畫面已經用回退字型畫出來再放 —— 量「字型換上來時版面跳不跳」（CLS）。
//   不用固定的延遲：固定延遲時字型什麼時候到，要看機器忙不忙（整套一起跑時旁邊在 build），量到的結果不穩。
// requests：每一個請求的 { path, status, bytes }（量「中文頁有沒有下載中日文字型」用）。
// Range（bytes=…）回 206 —— 2026-10-07 起 09 教學影片是自己的 <video>，測試要把影片跳到快結尾才量得到「播完」。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
    '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

export function serve(root) {
    const requests = [];
    let held = null; // 扣住時是等著回應的陣列，沒扣是 null
    const base = path.resolve(root);
    const server = http.createServer((req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { allow: 'GET, HEAD' }).end();
            return;
        }
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        } catch {
            res.writeHead(400).end();
            return;
        }
        let file = path.join(base, pathname);
        if (file !== base && !file.startsWith(base + path.sep)) {
            res.writeHead(403).end();
            return;
        }
        if (pathname.endsWith('/')) file = path.join(file, 'index.html');
        let status = 200;
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            status = 404;
            file = path.join(base, '404.html');
        }
        let body = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.from('not found');
        const headers = { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' };
        // Range（2026-10-07 加）：09 教學影片改成自己的網站播 <video>，測試要把影片跳到快結尾（currentTime）—— 沒有 Range 時 Chrome 跳不過去。
        // 只收一段 bytes=起-迄（或 起-、-後 N 個）；Cloudflare Pages 也照 Range 回 206
        const range = status === 200 && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
        if (range && (range[1] || range[2])) {
            const size = body.length;
            const from = Math.max(0, range[1] ? Number(range[1]) : size - Number(range[2]));
            const to = Math.min(size - 1, range[1] && range[2] ? Number(range[2]) : size - 1);
            if (from > to) {
                status = 416;
                headers['content-range'] = `bytes */${size}`;
                body = Buffer.alloc(0);
            } else {
                status = 206;
                headers['content-range'] = `bytes ${from}-${to}/${size}`;
                body = body.subarray(from, to + 1);
            }
        }
        const send = () => {
            requests.push({ path: pathname, status, bytes: body.length });
            res.writeHead(status, headers);
            res.end(req.method === 'HEAD' ? undefined : body);
        };
        if (held && file.endsWith('.woff2')) held.push(send);
        else send();
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                url: `http://127.0.0.1:${port}`,
                requests,
                holdFonts() { held ??= []; },
                releaseFonts() {
                    const waiting = held ?? [];
                    held = null;
                    waiting.forEach((send) => send());
                },
                close: () => new Promise((done) => server.close(done)),
            });
        });
    });
}
