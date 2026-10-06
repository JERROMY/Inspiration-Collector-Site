import { getString, getPlainString } from '../../app/strings.js';
import { STORE_URL } from '../../app/site.js';
import Seg from '../Seg/Seg.js';
import Button from '../Button/Button.js';
import TouchBox from '../TouchBox/TouchBox.js';
import styles from './Final.module.css';

/**
 * 15 最後的安裝（規格書 §5-15）：首屏的呼應 —— 大標的後半句被螢光綠括號夾住、同一團氛圍光放在左邊；桌機左大標、右邊按鈕（落在大標的底線）。
 * 有滑鼠是「加到 Chrome」；只有手指換成跟首屏一樣的手指框（components/TouchBox）。伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Final({ lang }) {
    return (
        <section className={styles.final} data-section="final" id="install" aria-labelledby="install-title">
            <div className={`wrap ${styles.in}`}>
                <h2 className={styles.title} id="install-title" data-id="final.title"><Seg text={getString(lang, 'final.title')} /></h2>
                <div className={styles.act}>
                    <p className={styles.meta} data-id="final.meta"><Seg text={getString(lang, 'final.meta')} /></p>
                    <Button href={STORE_URL} size="lg" className={styles.cta} data-id="final.cta" data-goatcounter-click="install-final" data-goatcounter-title={getPlainString(lang, 'final.cta')}>
                        <Seg text={getString(lang, 'final.cta')} />
                    </Button>
                    <TouchBox
                        lang={lang}
                        prefix="final"
                        className={styles.touch}
                        lead={<p data-id="final.mobile.lead"><Seg text={getString(lang, 'final.mobile.lead')} /></p>}
                    />
                </div>
            </div>
        </section>
    );
}
