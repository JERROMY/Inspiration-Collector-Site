import { getPlainString } from '../../strings.js';
import { HTML_LANG, THEME_COLOR } from '../../seo.js';

// 產生網頁時就寫成檔（out/<語言>/site.webmanifest），一個語言一份：加到主畫面時名字才是那個語言的
export const dynamic = 'force-static';

export function generateStaticParams() {
    return Object.keys(HTML_LANG).map((lang) => ({ lang }));
}

/**
 * 網站的 manifest（網站必備「圖示一套」）：名字從字串表取；display: browser —— 這是網站不是 App，加到主畫面打開還是瀏覽器。
 *
 * @param {Request} request
 * @param {{ params: Promise<{ lang: 'zh' | 'en' | 'ja' }> }} context
 */
export async function GET(request, { params }) {
    const { lang } = await params;
    const manifest = {
        name: getPlainString(lang, 'nav.brand'),
        short_name: getPlainString(lang, 'manifest.shortName'),
        lang: HTML_LANG[lang],
        start_url: `/${lang}/`,
        scope: '/',
        display: 'browser',
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
    return new Response(JSON.stringify(manifest, null, 4), { headers: { 'Content-Type': 'application/manifest+json' } });
}
