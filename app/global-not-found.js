import FontLinks from '../components/FontLinks/FontLinks.js';
import Solo from '../components/Solo/Solo.js';
import { getPlainString } from './strings.js';
import { iconMetadata, ogImage, viewport as siteViewport } from './seo.js';
import './styles/global.css';

// 三語並列的標題（三種語言的 404.meta.title 是同一句）；圖示同其他頁，manifest 用英文那份。
// 不給搜尋引擎收（設計稿加了，規格書沒寫）：Next.js 的 404 自己會放 <meta name="robots" content="noindex">，這裡不再寫一條（寫了就重複）；F2.5、F8.5f 守著那一條。
// 路徑都從根目錄算（iconMetadata、FontLinks、Solo 都是）：Cloudflare Pages 在任何深度的網址都回這一頁
export const metadata = {
    title: getPlainString('en', '404.meta.title'),
    ...iconMetadata('en'),
};

export const viewport = siteViewport;

// 分享卡只放英文那張圖＋大圖樣式（同「/」，規格書 10.6）。404 的說明、og:title、og:url 規格書沒寫，不放 ——
// 所以不走 metadata 的 openGraph：Next.js 會從 <title> 自己補 og:title 與 twitter:title，改成在 <head> 直接寫這幾條
const OG = ogImage('en');
const SHARE = [
    ['property', 'og:image', OG.url],
    ['property', 'og:image:type', OG.type],
    ['property', 'og:image:width', String(OG.width)],
    ['property', 'og:image:height', String(OG.height)],
    ['property', 'og:image:alt', OG.alt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:image', OG.url],
    ['name', 'twitter:image:alt', OG.alt],
];

/**
 * 404.html。這個網站有好幾個根版面，沒有共用的 layout 能包 not-found.js，所以用 global-not-found.js 自己畫整頁
 * （next.config.js 的 experimental.globalNotFound）。跟 / 同一個版型（components/Solo）：整頁標英文，中文、日文那兩段各自標 lang，
 * 記號下面多一個「404」，三語各一個「回首頁」連到自己的語言頁（規格書 10.7）。
 */
export default function GlobalNotFound() {
    return (
        <html lang="en" data-theme="dark">
            <head>
                <FontLinks />
                {SHARE.map(([key, name, content]) => <meta key={name} {...{ [key]: name }} content={content} />)}
            </head>
            <body>
                <Solo ids={{ title: '404.title', lead: '404.body', btn: '404.home' }} code="404" />
            </body>
        </html>
    );
}
