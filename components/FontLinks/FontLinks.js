import { preload as preloadResource } from 'react-dom';

/**
 * FontLinks —— 放在每個根版面的 <head> 裡：接上網頁字型，並預載內文字型。
 *
 * 收：preload（預設 true；「/」傳 false —— 有 JS 時它一開頁就跳走，先下載字型只是跟分流搶頻寬）。給：字型的 <link>；preload 時 <head> 另有一條預載（React 放的）。
 * - /fonts/fonts.css 是後端產的（public/fonts/，npm run fonts），不要從 CSS import：
 *   那樣 Next.js 會把字型檔再複製一份到 _next/，同一個字型變成兩個網址。
 * - 預載要 crossOrigin：字型一律用 CORS 模式抓，少了它預載的那份用不到，會下載兩次。
 */
export default function FontLinks({ preload = true }) {
    // 用 react-dom 的 preload() 而不是畫一個 <link rel="preload">：畫出來的那個 React 19 會再提一份到 <head> 最前面，變成兩條一模一樣的
    if (preload) preloadResource('/fonts/GoogleSansFlex-site.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
    return <link rel="stylesheet" href="/fonts/fonts.css" />;
}
