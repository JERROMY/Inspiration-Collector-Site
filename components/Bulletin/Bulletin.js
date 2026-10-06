import '../../public/bulletin.js';
import { bindTail } from '../../lib/bind-tail.js';
import { getString, getPlainString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Icon, { iconHtml } from '../Icon/Icon.js';
import IconButton from '../IconButton/IconButton.js';
import styles from './Bulletin.module.css';

/**
 * Bulletin —— 02 公告條（規格書第 5 節 02、第 7 節）。在導覽列下面，不釘住，字太長就換行、不截斷。
 *
 * 每一則好的公告各畫一條，同一時間只看得到一條：
 * - 沒有 JS：看得到產生網頁時挑的那條（data-default）。
 * - 有 JS：<head> 裡的 public/bulletin.js 在畫面畫出來之前用看的人的當地日期再挑一次、蓋掉產生網頁時挑的（不跳版面）；
 *   按 ✕（data-bulletin-close）把那條拿掉並記住 id，也是它做的。挑的規則只寫在 bulletin.js 一個地方，這裡 import 它來用。
 * 標題是使用者寫的字：bindTail 的輸出（已跳脫），箭頭圖示插在最後一個 </span> 前，跟最後幾個字一起換行。
 *
 * 伺服器端元件（產生網頁時跑）：收得到 reason，不畫；寫壞的公告跳過（「讀不到」只在 11 區顯示）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', slot: { ok: boolean, entries?: object[] } }} props slot：readContent(...).news[lang]
 */
export default function Bulletin({ lang, slot }) {
    if (!slot.ok) return null;
    const picked = globalThis.collectorBulletin.pick(slot.entries, new Date(), []);
    const label = getPlainString(lang, 'bulletin.label');
    return slot.entries.filter((entry) => entry.ok).map((entry) => (
        <div
            key={entry.id}
            className={styles.bulletin}
            role="region"
            aria-label={label}
            data-bulletin={entry.id}
            data-default={entry === picked ? '' : undefined}
        >
            <div className={styles.inner}>
                <span className={styles.label}><Seg text={getString(lang, 'bulletin.label')} /></span>
                <a className={styles.text} href="#news" dangerouslySetInnerHTML={{ __html: bindTail(entry.title, lang, { tail: iconHtml('arrow') }) }} />
                <IconButton ghost className={styles.close} label={getPlainString(lang, 'bulletin.close')} data-bulletin-close="">
                    <Icon name="close" />
                </IconButton>
            </div>
        </div>
    ));
}

/**
 * 給 <head> 的 <meta name="collector-bulletin">：好的公告的 id、日期、置頂（照檔案順序），public/bulletin.js 讀它來挑。
 *
 * @param {{ ok: boolean, entries?: object[] }} slot readContent(...).news[lang]
 * @returns {string} JSON
 */
export function bulletinMeta(slot) {
    const entries = slot.ok ? slot.entries.filter((entry) => entry.ok) : [];
    return JSON.stringify(entries.map(({ id, date, pinned }) => ({ id, date, pinned })));
}
