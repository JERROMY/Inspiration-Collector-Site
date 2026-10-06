// 搜尋與分享用的 <head> 標記（規格書 §10）：標題與說明、語言版本、分享卡、圖示、結構化資料。
// 只在產生網頁時、伺服器端跑；字一律從字串表取（getPlainString），網址從 app/site.js 的 SITE_URL 組。
import { getPlainString } from './strings.js';
import { SITE_URL, STORE_URL } from './site.js';

export const LANGS = ['zh', 'en', 'ja'];

// 網址的語言 → <html lang>（規格書 10.3：中文標 zh-Hant）、分享卡的 og:locale
export const HTML_LANG = { zh: 'zh-Hant', en: 'en', ja: 'ja' };
const OG_LOCALE = { zh: 'zh_TW', en: 'en_US', ja: 'ja_JP' };

// 分頁列與 manifest 的底色（設計系統 --color-bg-primary；manifest 與 <meta> 吃不到 CSS 變數，只在這裡寫 hex）
export const THEME_COLOR = '#1b1d24';

/** 語言頁的正式網址（結尾有 /） */
export const pageUrl = (lang) => `${SITE_URL}${lang}/`;

// 語言版本：四頁都放同一組五條（含自己）；中文同時標 zh-Hant 與 zh，「/」是 x-default（規格書 10.3）
export const LANGUAGE_URLS = {
    'zh-Hant': pageUrl('zh'),
    zh: pageUrl('zh'),
    en: pageUrl('en'),
    ja: pageUrl('ja'),
    'x-default': SITE_URL,
};

// 圖示（規格書 10.6、網站必備「圖示一套」）：16 與 32 是 PNG（跟擴充同一組），不連 SVG —— 一倍螢幕可能被拿去畫 16px，兩條會糊
const icons = {
    icon: [
        { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/apple-touch-icon.png',
};

/**
 * 五頁共用的圖示與 manifest（「/」與 404 用英文那份 manifest）。
 *
 * @param {'zh' | 'en' | 'ja'} lang manifest 的語言
 */
export function iconMetadata(lang) {
    return { icons, manifest: `/${lang}/site.webmanifest` };
}

/** 五頁共用的 viewport（theme-color 一個值：只有暗色） */
export const viewport = { themeColor: THEME_COLOR };

/**
 * 分享卡的預覽圖（那一語的 og-<語言>.png，絕對網址）與替代文字。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 * @returns {{ url: string, width: number, height: number, type: string, alt: string }}
 */
export const ogImage = (lang) => ({ url: `${SITE_URL}og/og-${lang}.png`, width: 1200, height: 630, type: 'image/png', alt: getPlainString(lang, 'og.image.alt') });

/**
 * 分享卡（Open Graph＋twitter:card）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', title: string, description: string, url: string }} card 圖與 og:locale 用 lang 那一語
 */
function share({ lang, title, description, url }) {
    return {
        openGraph: {
            type: 'website',
            siteName: getPlainString(lang, 'meta.siteName'),
            title,
            description,
            url,
            locale: OG_LOCALE[lang],
            alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
            images: [ogImage(lang)],
        },
        twitter: { card: 'summary_large_image' },
    };
}

/**
 * 語言頁（/zh/、/en/、/ja/）的 metadata：標題、說明、canonical、語言版本、分享卡、圖示。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 */
export function langMetadata(lang) {
    const title = getPlainString(lang, 'meta.title');
    const description = getPlainString(lang, 'meta.desc');
    const url = pageUrl(lang);
    return {
        title,
        description,
        alternates: { canonical: url, languages: LANGUAGE_URLS },
        ...share({ lang, title, description, url }),
        ...iconMetadata(lang),
    };
}

/**
 * 「/」的 metadata：三語的標題、三語的一句話（英、中、日依序，用「 / 」接起來，規格書 10.2）；它是 x-default，可以被索引。
 * 分享卡是三語的標題、英文的一句話、英文那張圖（規格書 10.6）。
 */
export function rootMetadata() {
    const title = getPlainString('en', 'root.meta.title');
    const description = ['en', 'zh', 'ja'].map((lang) => getPlainString(lang, 'meta.desc')).join(' / ');
    return {
        title,
        description,
        alternates: { canonical: SITE_URL, languages: LANGUAGE_URLS },
        ...share({ lang: 'en', title, description: getPlainString('en', 'meta.desc'), url: SITE_URL }),
        ...iconMetadata('en'),
    };
}

/**
 * 「/」的結構化資料：網站名稱（WebSite）。Google〈Site names〉：放在網域的首頁、url 是網域根、一個網站一個名稱，
 * 所以只放在「/」：英文名稱是 name，中文與日文的放 alternateName。
 *
 * @returns {object} 一份 JSON-LD
 */
export function rootStructuredData() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: getPlainString('en', 'meta.siteName'),
        alternateName: ['zh', 'ja'].map((lang) => getPlainString(lang, 'meta.siteName')),
        url: SITE_URL,
    };
}

/**
 * 語言頁的結構化資料（規格書 10.5）：軟體、作者、常見問題（網站名稱只放在「/」）。不放評分（沒有真的評分）、不放影片（宣傳片還沒上 YouTube）。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 * @param {{ ok: boolean, entries?: Array<{ ok: boolean, code?: string, url?: string }> }} links content/links.md 讀出來的社群連結
 * @returns {object} 一份 JSON-LD（@graph）
 */
export function structuredData(lang, links) {
    const say = (id) => getPlainString(lang, id);
    const good = links.ok ? links.entries.filter((e) => e.ok) : [];
    const blog = good.find((e) => e.code === 'blog');
    const author = {
        '@type': 'Person',
        '@id': `${SITE_URL}#author`,
        name: say('author.name'),
        ...(blog ? { url: blog.url } : {}),
        sameAs: good.filter((e) => e !== blog).map((e) => e.url),
    };
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'SoftwareApplication',
                name: say('meta.siteName'),
                description: say('meta.desc'),
                applicationCategory: 'BrowserApplication',
                operatingSystem: 'Windows, macOS',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                installUrl: STORE_URL,
                image: `${SITE_URL}icon-512.png`,
                inLanguage: HTML_LANG[lang],
                author: { '@id': author['@id'] },
            },
            author,
            {
                '@type': 'FAQPage',
                inLanguage: HTML_LANG[lang],
                mainEntity: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
                    '@type': 'Question',
                    name: say(`faq.${n}.q`),
                    acceptedAnswer: { '@type': 'Answer', text: say(`faq.${n}.a`) },
                })),
            },
        ],
    };
}
