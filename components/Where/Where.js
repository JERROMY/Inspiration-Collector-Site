import { getPlainString, getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import styles from './Where.module.css';

// 能用在哪裡：三家 AI＋一般網頁。每一個前面一個單色圖示（使用者 2026-10-04 要的；三家是 Simple Icons 的標誌，一般網頁是 Phosphor 的地球，出處見 README.md「圖示的出處」）
const PLACES = ['chatgpt', 'claude', 'perplexity', 'web'];
const PLACE_ICONS = { chatgpt: 'openai', claude: 'claude', perplexity: 'perplexity', web: 'where-globe' };
// 「擴充本身」的三個 0（不能拿掉「擴充本身」，規格書第 5 節 04）
const ZEROS = ['server', 'account', 'tracking'];

/**
 * Where —— 04 能用在哪裡：一條讀數帶。左邊能用的地方、右邊「擴充本身」的三個 0。
 * 動態 B：三個 0 捲到這一區時，依序從上面一格滾下來停在 0，只播一次（public/motion.js 加 data-in；data-zero 是會動的那個數字，
 * 外層把它裁掉）。字一直只有「0」，不編數字。減少動態、沒有 JS 時一開始就在 0。
 *
 * 伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Where({ lang }) {
    return (
        <section className={styles.where} data-section="where" aria-labelledby="where-label" data-reveal="">
            <div className={`wrap ${styles.in}`}>
                <div className={styles.on}>
                    <p className={styles.label} id="where-label" data-id="where.label"><Seg text={getString(lang, 'where.label')} /></p>
                    <ul className={styles.list}>
                        {PLACES.map((key) => (
                            <li key={key} data-id={`where.${key}`}><Icon name={PLACE_ICONS[key]} /><Seg text={getString(lang, `where.${key}`)} /></li>
                        ))}
                    </ul>
                </div>
                <div className={styles.zerosCol}>
                    {/* 2026-10-07 使用者：「擴充本身」畫面上拿掉、三個 0 往上提；讀屏仍念得到（清單的 aria-label） */}
                    <ul className={styles.zeros} aria-label={getPlainString(lang, 'zeros.cap')} data-id="zeros.cap">
                        {ZEROS.map((key) => (
                            <li key={key}>
                                <span className={styles.zero}><span className={styles.digit} data-zero="">0</span></span>
                                <span className={styles.unit} data-id={`zeros.${key}`}><Seg text={getString(lang, `zeros.${key}`)} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
