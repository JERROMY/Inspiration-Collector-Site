import { SITE_URL } from './site.js';

// out/robots.txt（規格書 10.4）：全部允許，AI 爬蟲也是（這個網站就是要讓更多人、更多 AI 找得到）
export const dynamic = 'force-static';

export default function robots() {
    return {
        rules: { userAgent: '*', allow: '/' },
        sitemap: `${SITE_URL}sitemap.xml`,
    };
}
