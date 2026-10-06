import { LANGS, LANGUAGE_URLS, pageUrl } from './seo.js';

// out/sitemap.xml（規格書 10.4）：只列三個語言頁，每一頁標所有語言版本（含自己與 x-default）；「/」不列（它只是分流）
export const dynamic = 'force-static';

export default function sitemap() {
    return LANGS.map((lang) => ({
        url: pageUrl(lang),
        alternates: { languages: LANGUAGE_URLS },
    }));
}
