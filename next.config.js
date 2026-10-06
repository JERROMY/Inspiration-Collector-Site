// Next.js 設定：產生靜態網頁放 Cloudflare Pages（規格書第 3 節）。package.json 是 type: module，所以這支是 ESM。
//
// output: 'export'          npm run build 產出 out/，不需要一直開著的主機
// trailingSlash: true       產生 out/zh/index.html、連結是 /zh/（規格書 10.3：網址結尾一律有 /）
// images.unoptimized: true  靜態網頁沒有圖片最佳化的伺服器，圖片事先做好（npm run images）
// agentRules: false         Next.js 16.3 起，next dev 偵測到 AI agent 在跑時會在這一層自己寫出 AGENTS.md 與 CLAUDE.md；
//                           這個網站之後要搬進公開 repo，不要這兩個檔（Next.js 文件 ai-agents「Opting out」）
// experimental.globalNotFound  app/global-not-found.js 做 404.html。Next.js 文件仍標實驗功能（15.4 起）。
//                           用它是為了讓 404 與 / 各自有 lang：這個網站有三個根版面（/、/zh/ 這類、404 各自寫 <html>），
//                           沒有一個共用的 layout 可以包 not-found.js（文件 not-found.md「global-not-found.js」那節）。
//                           若之後拿掉：改成單一的 app/layout.js ＋ app/not-found.js，<html lang> 就只剩一個值，
//                           三語頁的 lang 不能再照網址寫在 <html> 上，要先想好怎麼標再拿。

/** @type {import('next').NextConfig} */
const config = {
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
    agentRules: false,
    experimental: { globalNotFound: true },
};

export default config;
