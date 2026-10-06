import styles from './Band.module.css';

/**
 * Band —— 頁面上的一區（05 以下的區塊）：上下留 --gap-section，裡面是 .wrap，標題組與內容之間 --gap-group。
 * raised：淺的那一層（06、08…，深淺交錯，規格書 §5）；裡面的卡片反過來用深底（Card 讀 --card-bg）。
 *
 * @param {{ section: string, id: string, raised?: boolean, className?: string, children: import('react').ReactNode }} props
 *   section：data-section 的名字；id：錨點（導覽列連的 #features 之類），標題的 id 是「<id>-title」（aria-labelledby）；
 *   className：加在裡面那一層（.wrap）上的版面樣式（13 標題在左、題目在右，14 照片在左這種左右排）
 */
export default function Band({ section, id, raised = false, className, children }) {
    return (
        <section className={[styles.band, raised && styles.raised].filter(Boolean).join(' ')} data-section={section} id={id} aria-labelledby={`${id}-title`}>
            <div className={['wrap', styles.in, className].filter(Boolean).join(' ')}>{children}</div>
        </section>
    );
}
