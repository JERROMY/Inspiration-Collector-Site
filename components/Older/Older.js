import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import styles from './Older.module.css';

/**
 * Older —— 「看更早的公告／版本」：原生 <details>（預設收著；關掉 JS、只用鍵盤都打得開），<summary> 是一顆靠左、照字寬的膠囊按鈕，
 * 箭頭在打開時轉 180°。打開之後的內容跟外面同一個樣子（同樣的卡片、同樣的一版一段），由呼叫端放進 children。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', id: string, className?: string, children: import('react').ReactNode }} props
 *   id：按鈕上的字（字串表 news.older、changelog.older），也是 <summary> 的 data-id；className：外面要加的版面樣式
 */
export default function Older({ lang, id, className, children }) {
    return (
        <details className={[styles.older, className].filter(Boolean).join(' ')}>
            <summary className={styles.btn} data-id={id}><span><Seg text={getString(lang, id)} /></span><Icon name="caret" /></summary>
            {children}
        </details>
    );
}
