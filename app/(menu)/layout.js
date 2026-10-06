import FontLinks from '../../components/FontLinks/FontLinks.js';
import StructuredData from '../../components/StructuredData/StructuredData.js';
import { rootStructuredData, viewport as siteViewport } from '../seo.js';
import '../styles/global.css';

export const viewport = siteViewport;

/**
 * / 的根版面。/ 不是任何一個語言版本（規格書第 4 節）：整頁標英文，中文、日文那幾段各自標自己的 lang。
 * (menu) 是路由群組，不出現在網址裡；有它才能讓 / 跟 /zh/ 這類各有自己的 <html lang>（多個根版面）。
 * <head> 的 pick-lang.js 是同步的外部腳本：在畫面出來之前依選過的語言或瀏覽器語言跳到 /zh/、/en/、/ja/（不寫內嵌腳本，規格書第 3 節）。
 * 跳走之前不先下載用不到的東西：不預載字型；記號的 <img> 是 loading="lazy"（不然 React 會替它在 <head> 放一條預載）。
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function MenuLayout({ children }) {
    return (
        <html lang="en" data-theme="dark">
            <head>
                <script src="/pick-lang.js" />
                <FontLinks preload={false} />
            </head>
            <body>
                {children}
                <StructuredData data={rootStructuredData()} />
            </body>
        </html>
    );
}
