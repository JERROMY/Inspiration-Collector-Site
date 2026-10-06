import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import styles from './SkipLink.module.css';

/**
 * SkipLink —— 跳到主要內容：鍵盤第一個 Tab 才出現，連到 <main id="main">。放在導覽列前面。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function SkipLink({ lang }) {
    return (
        <a className={styles.skip} href="#main">
            <Seg text={getString(lang, 'nav.skip')} />
        </a>
    );
}
