import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Icon from '../Icon/Icon.js';
import styles from './Faq.module.css';

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7];

// 答案裡的句子連結（strings/README.md「句子裡的連結」那張表）：在原字裡找第一次出現的那幾個字，包成 <a>
const LINKS = {
    2: { href: '#privacy', text: { zh: '沒有伺服器', en: 'There’s no server', ja: 'サーバーがない' } },
    4: { href: '#devices', text: { zh: '電腦上的 Chrome', en: 'Chrome on your computer', ja: 'パソコンの Chrome' } },
};

/**
 * 13 常見問題（規格書 §5-13）：七題，一題一個原生 <details>（預設收著、第一題打開；不設 name，開一題不關別題）——
 * 關掉 JS、只用鍵盤（Enter／空白鍵）都能開合，收起來的答案也在 HTML 裡（§10.4、§14）。題目是 <summary> 裡的 h3，答案在同一個 <details> 裡。
 * 1024 起標題在左（捲動時停在畫面上）、題目在右。結構化資料的 FAQPage 用同一份字串表的字（app/seo.js），所以兩邊逐題一樣。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Faq({ lang }) {
    return (
        <Band section="faq" id="faq" className={styles.in}>
            <SectionHead lang={lang} prefix="faq" id="faq-title" className={styles.head} />
            <div className={styles.qas}>
                {QUESTIONS.map((n) => {
                    const link = LINKS[n];
                    return (
                        <details key={n} className={styles.qa} open={n === 1}>
                            <summary className={styles.q}>
                                <h3 className={styles.h} data-id={`faq.${n}.q`}><Seg text={getString(lang, `faq.${n}.q`)} /></h3>
                                <span className={styles.icon}><Icon name="caret" /></span>
                            </summary>
                            <div className={styles.a}>
                                <p data-id={`faq.${n}.a`}>
                                    <Seg text={getString(lang, `faq.${n}.a`)} {...(link ? { link: { text: link.text[lang], href: link.href, className: styles.tlink } } : {})} />
                                </p>
                            </div>
                        </details>
                    );
                })}
            </div>
        </Band>
    );
}
