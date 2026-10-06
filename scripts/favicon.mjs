// npm run favicon：把 public/favicon-16.png、public/favicon-32.png 原樣包成 public/favicon.ico（ICO 容器、裡面是 PNG，不改像素、不重畫）。
// 為什麼要有：瀏覽器與爬蟲不看 <head> 也會去要 /favicon.ico，沒有就是 404。<head> 照舊只連 PNG（網站 README「搜尋與分享」的圖示一套）。
// 什麼時候重跑：favicon-16.png 或 favicon-32.png 換了（記號改了）。產出的 favicon.ico 一起提交；重跑結果相同（位元組一樣）。
// 只用 Node 內建模組。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SOURCES = ['favicon-16.png', 'favicon-32.png'];

// PNG 的寬高在 IHDR（第 16～23 位元組）
function pngSize(buf, name) {
    if (buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('latin1', 12, 16) !== 'IHDR') throw new Error(`${name} 不是 PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const images = SOURCES.map((name) => {
    const data = fs.readFileSync(path.join(PUBLIC, name));
    const { width, height } = pngSize(data, name);
    if (width > 256 || height > 256) throw new Error(`${name} 是 ${width}×${height}，ICO 一張最大 256`);
    return { data, width, height };
});

// ICONDIR（6）＋每張一個 ICONDIRENTRY（16），之後依序放 PNG
const head = Buffer.alloc(6 + 16 * images.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(images.length, 4);
let offset = head.length;
images.forEach((img, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(img.width === 256 ? 0 : img.width, at);
    head.writeUInt8(img.height === 256 ? 0 : img.height, at + 1);
    head.writeUInt8(0, at + 2);
    head.writeUInt8(0, at + 3);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(img.data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += img.data.length;
});
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), Buffer.concat([head, ...images.map((img) => img.data)]));
console.log(`public/favicon.ico：${images.map((img) => `${img.width}×${img.height}`).join('、')}，${offset} 位元組`);
