import path from 'node:path';
import { readContent } from '../../lib/content.js';
import FontLinks from '../../components/FontLinks/FontLinks.js';
import SkipLink from '../../components/SkipLink/SkipLink.js';
import Nav from '../../components/Nav/Nav.js';
import Bulletin, { bulletinMeta } from '../../components/Bulletin/Bulletin.js';
import StructuredData from '../../components/StructuredData/StructuredData.js';
import Footer from '../../components/Footer/Footer.js';
import { HTML_LANG, langMetadata, structuredData, viewport as siteViewport } from '../seo.js';
import { GOATCOUNTER_CODE } from '../site.js';
import '../styles/global.css';

// 只產生這三頁；其他網址（/fr/ 之類）不產生，交給 404
export const dynamicParams = false;

export function generateStaticParams() {
    return Object.keys(HTML_LANG).map((lang) => ({ lang }));
}

// 標題、說明、canonical、語言版本、分享卡、圖示（app/seo.js；規格書 §10）
export async function generateMetadata({ params }) {
    const { lang } = await params;
    return langMetadata(lang);
}

export const viewport = siteViewport;

/**
 * 三語頁（/zh/、/en/、/ja/）的根版面：跳到主要內容、01 導覽列、02 公告條，底下是那一頁的 <main id="main">，最後是 16 頁尾（<main> 外面）。
 * lang 與 data-theme 寫在這裡，送出來的 HTML 就對，不靠腳本。
 * <head> 的外部腳本：bulletin.js、motion.js 同步跑（畫面畫出來之前挑公告條、決定動態進場前的樣子；bulletin.js 前面先放它要讀的 <meta>）；
 * nav.js、hero.js 畫完才跑（☰、語言切換；宣傳片、分享）；tutorial.js 是 09 的播放器（有影片 ID 時按了才載入 YouTube）與 06「看教學 NN」跳過去的落點；typing.js 是 07 的「AI 開始打字」；有 GoatCounter 代碼（app/site.js）才放它的 async 腳本，按鈕上的 data-goatcounter-click 是它數點擊用的名字。
 * 不寫內嵌腳本（規格書第 3 節）；結構化資料（JSON-LD）不是腳本，放在 <body> 最後（<head> 短一點，前面的東西早一點讀到）。
 *
 * @param {{ children: import('react').ReactNode, params: Promise<{ lang: 'zh' | 'en' | 'ja' }> }} props
 */
export default async function LangLayout({ children, params }) {
    const { lang } = await params;
    const content = await readContent(path.join(process.cwd(), 'content'));
    return (
        <html lang={HTML_LANG[lang]} data-theme="dark">
            <head>
                <FontLinks />
                <meta name="collector-bulletin" content={bulletinMeta(content.news[lang])} />
                <script src="/bulletin.js" />
                <script src="/motion.js" />
                <script src="/nav.js" defer />
                <script src="/hero.js" defer />
                <script src="/tutorial.js" defer />
                <script src="/typing.js" defer />
                {GOATCOUNTER_CODE && <script async src="//gc.zgo.at/count.js" data-goatcounter={`https://${GOATCOUNTER_CODE}.goatcounter.com/count`} />}
            </head>
            <body>
                <SkipLink lang={lang} />
                <Nav lang={lang} links={content.links} />
                <Bulletin lang={lang} slot={content.news[lang]} />
                {children}
                <Footer lang={lang} links={content.links} />
                <StructuredData data={structuredData(lang, content.links)} />
            </body>
        </html>
    );
}
