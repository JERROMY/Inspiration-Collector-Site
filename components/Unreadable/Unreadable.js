import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import styles from './Unreadable.module.css';

/**
 * Unreadable —— 內容檔寫壞的那一條（或整區讀不到）在畫面上的樣子（規格書第 7 節：不能靜靜地略過）。
 * 圖示 ui-warning-circle＋字串表的字，虛線框＝「這一格缺了一塊」（不用錯誤的粉紅：寫壞的是網站管理者，不是看的人做錯事）。
 * 不收 reason：reason 是寫給做網站的人看的（npm run content:check 會印），不進畫面、也不進 HTML。
 *
 * 伺服器端元件。照 strings/README.md「這一條讀不到」那張表：
 *   variant 'plain'   沒有框（放在 11 公告那張一樣大的虛線卡裡，框是卡片自己畫的）
 *           'inline'  12 寫壞的一條：那一行一個虛線框
 *           'section' 12 寫壞的一版、或整區讀不到：一整塊虛線框（8px 圓角）
 *           'social'  14 寫壞的一個社群連結：44 高的虛線框
 *   whole：整區讀不到（或每一條都寫壞），字用 state.unreadable.section；不然是 state.unreadable
 *   marked：自己帶 data-state="unreadable"（預設要；11 那張虛線卡由 <li> 帶，裡面這個就不帶，一個寫壞的地方只算一個）
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', variant?: 'plain' | 'inline' | 'section' | 'social', whole?: boolean, marked?: boolean }} props
 */
export default function Unreadable({ lang, variant = 'plain', whole = false, marked = true }) {
    return (
        <p className={[styles.bad, styles[variant]].filter(Boolean).join(' ')} {...(marked ? { 'data-state': 'unreadable' } : {})}>
            <Icon name="warn" />
            <span><Seg text={getString(lang, whole ? 'state.unreadable.section' : 'state.unreadable')} /></span>
        </p>
    );
}
