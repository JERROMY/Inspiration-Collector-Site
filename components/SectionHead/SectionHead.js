import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import styles from './SectionHead.module.css';

/**
 * SectionHead —— 一區的標題組（規格書 §6）：小標（英文大寫、等寬）＋大標（h2）＋一句說明，上下疊。
 * 字從字串表的 <prefix>.eyebrow、<prefix>.title 與 lead（給了才畫）取，畫在帶 data-id 的元素裡。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', prefix: string, id: string, title?: string, lead?: string, className?: string, titleClassName?: string,
 *   children?: import('react').ReactNode }} props
 *   prefix：字串表的前綴（how、features、privacy）；id：h2 的 id（Band 的 aria-labelledby）；
 *   title：大標的字串表 id（預設 <prefix>.title）；lead：說明那句的字串表 id；
 *   className、titleClassName：外面要加的樣式（13 的標題組捲動時停住、14 的名字）；children：說明之後再放的東西（14 的簡介）
 */
export default function SectionHead({ lang, prefix, id, title = `${prefix}.title`, lead, className, titleClassName, children }) {
    return (
        <header className={[styles.head, className].filter(Boolean).join(' ')}>
            <p className={styles.eyebrow} data-id={`${prefix}.eyebrow`}><Seg text={getString(lang, `${prefix}.eyebrow`)} /></p>
            <h2 className={[styles.title, titleClassName].filter(Boolean).join(' ')} id={id} data-id={title}><Seg text={getString(lang, title)} /></h2>
            {lead && <p className={styles.lead} data-id={lead}><Seg text={getString(lang, lead)} /></p>}
            {children}
        </header>
    );
}
