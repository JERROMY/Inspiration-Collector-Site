import { getString, getPlainString } from '../../app/strings.js';
import { STORE_URL, SITE_URL } from '../../app/site.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import Button from '../Button/Button.js';
import TextLink from '../TextLink/TextLink.js';
import styles from './TouchBox.module.css';

/**
 * TouchBox —— 只有手指的裝置看到的「把網址帶到電腦上」框（規格書第 5 節 03、15）：一句說明、分享這個網址、寄給自己、用的是電腦？
 * 有滑鼠時整個框藏起來（CSS 的 (hover: none) and (pointer: coarse)），那時看到的是「加到 Chrome」。首屏與 15 區用同一個。
 *
 * 「分享這個網址」（data-share）的行為在 public/hero.js：有 navigator.share 就用；沒有就複製網址、浮出「已複製」；
 * 都不行時（App 裡的瀏覽器）在框上加字面的 class touch--noshare：分享鈕收起，改顯示 share.fallback 那一句與網址（長按複製），焦點移到網址框；
 * 關掉 JS 時（<html> 沒有 js class）CSS 直接這樣顯示。伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', prefix: 'hero' | 'final', lead: import('react').ReactNode, className?: string }} props
 *   prefix：字串表的前綴（<prefix>.share、<prefix>.mail、<prefix>.pc），也是 GoatCounter 名字的位置（share-<prefix>…）；
 *   lead：最上面那一句（已經是畫好的元素，帶 data-id）；className：外面要加的版面樣式
 */
export default function TouchBox({ lang, prefix, lead, className }) {
    const page = `${SITE_URL}${lang}/`;
    const mailBody = getPlainString(lang, 'mail.self.body').replace('%url%', `${page}?ref=mail`);
    const mailto = `mailto:?subject=${encodeURIComponent(getPlainString(lang, 'mail.self.subject'))}&body=${encodeURIComponent(mailBody)}`;
    return (
        <div className={[styles.touch, className].filter(Boolean).join(' ')} data-touch="">
            {lead}
            <Button
                className={`${styles.btn} ${styles.share}`}
                data-id={`${prefix}.share`}
                data-share=""
                data-goatcounter-click={`share-${prefix}`}
                data-goatcounter-title={getPlainString(lang, `${prefix}.share`)}
                data-share-title={getPlainString(lang, 'share.title')}
                data-share-text={getPlainString(lang, 'share.text')}
                data-share-url={page}
            >
                <Icon name="share" /><Seg text={getString(lang, `${prefix}.share`)} />
            </Button>
            <div className={styles.url}>
                <p data-id="share.fallback"><Seg text={getString(lang, 'share.fallback')} /></p>
                <p className={styles.urlbox} translate="no" tabIndex={-1} data-share-urlbox="">
                    https://<wbr />{page.slice('https://'.length)}
                </p>
            </div>
            <Button href={mailto} variant="secondary" className={styles.btn} data-id={`${prefix}.mail`} data-goatcounter-click={`mail-${prefix}`} data-goatcounter-title={getPlainString(lang, `${prefix}.mail`)}>
                <Icon name="mail" /><Seg text={getString(lang, `${prefix}.mail`)} />
            </Button>
            <TextLink href={STORE_URL} className={styles.pc} data-goatcounter-click={`install-mobile-${prefix}`} data-goatcounter-title={getPlainString(lang, `${prefix}.pc`)}>
                <span data-id={`${prefix}.pc`}><Seg text={getString(lang, `${prefix}.pc`)} tail={<Icon name="arrow" />} /></span>
            </TextLink>
        </div>
    );
}
