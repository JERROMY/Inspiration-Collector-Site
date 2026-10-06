import { getString, getPlainString } from '../../app/strings.js';
import { SITE_URL, STORE_URL } from '../../app/site.js';
import Seg from '../Seg/Seg.js';
import LangSwitch from '../LangSwitch/LangSwitch.js';
import Socials from '../Socials/Socials.js';
import styles from './Footer.module.css';

const PRIVACY_URL = 'https://jerromy.com/privacy/';
const BLOG_URL = 'https://jerromy.com';
// 回報問題的收件人：跟擴充「遇到問題」寄的是同一個（GPTPlugins 的 clipper/panel/dialogs.js）
const REPORT_TO = 'npc10091983@gmail.com';

/**
 * 16 頁尾（規格書 §5-16）：<main> 後面；淺的那一層。記號＋名稱＋一句＋社群（跳過寫壞的）｜產品｜幫助，
 * 最下面一條髮絲線：一定要有的兩句（沒有隸屬關係、GoatCounter —— GOATCOUNTER_CODE 還是空的時候也在，規格書 §16、上線前清單）＋©，語言切換。
 * 回報問題開一封寫好標題與內文的信（mail.report.*，內文的 %url% 是這一頁的正式網址）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', links: { ok: boolean, entries?: object[] } }} props links：readContent(...).links
 */
export default function Footer({ lang, links }) {
    const body = getPlainString(lang, 'mail.report.body').replace('%url%', `${SITE_URL}${lang}/`);
    const report = `mailto:${REPORT_TO}?subject=${encodeURIComponent(getPlainString(lang, 'mail.report.subject'))}&body=${encodeURIComponent(body)}`;
    const link = (id, href, count) => (
        <li key={id}>
            <a className={styles.link} href={href} data-id={id} {...(count ? { 'data-goatcounter-click': count, 'data-goatcounter-title': getPlainString(lang, id) } : {})}>
                <Seg text={getString(lang, id)} />
            </a>
        </li>
    );
    return (
        <footer className={styles.foot} data-section="footer">
            <div className={`wrap ${styles.in}`}>
                <div className={styles.brandCol}>
                    <a className={styles.brand} href="#top">
                        <img className={styles.mark} src="/mark.svg" alt="" width="128" height="128" loading="lazy" />
                        <span className={styles.name} data-id="foot.brand"><Seg text={getString(lang, 'foot.brand')} /></span>
                    </a>
                    <p className={styles.line} data-id="foot.line"><Seg text={getString(lang, 'foot.line')} /></p>
                    <Socials lang={lang} slot={links} place="footer" />
                </div>
                <div className={styles.cols}>
                    <nav className={styles.col} aria-labelledby="foot-product">
                        <h2 className={styles.h} id="foot-product" data-id="foot.product"><Seg text={getString(lang, 'foot.product')} /></h2>
                        <ul className={styles.list}>
                            {link('foot.store', STORE_URL, 'install-footer')}
                            {link('foot.tutorial', '#tutorial')}
                            {link('foot.changelog', '#changelog')}
                            {link('foot.privacy', PRIVACY_URL)}
                        </ul>
                    </nav>
                    <nav className={styles.col} aria-labelledby="foot-help">
                        <h2 className={styles.h} id="foot-help" data-id="foot.help"><Seg text={getString(lang, 'foot.help')} /></h2>
                        <ul className={styles.list}>
                            {link('foot.faq', '#faq')}
                            {link('foot.report', report, 'report')}
                            {link('foot.blog', BLOG_URL, 'blog-footer')}
                        </ul>
                    </nav>
                </div>
                <div className={styles.bottom}>
                    <div className={styles.legal}>
                        <p data-id="foot.affiliation"><Seg text={getString(lang, 'foot.affiliation')} /></p>
                        <p data-id="foot.analytics"><Seg text={getString(lang, 'foot.analytics')} /></p>
                        <p data-id="foot.copyright"><Seg text={getString(lang, 'foot.copyright')} /></p>
                    </div>
                    <LangSwitch lang={lang} className={styles.lang} />
                </div>
            </div>
        </footer>
    );
}
