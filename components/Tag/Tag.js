import styles from './Tag.module.css';

/**
 * Tag —— 不會按的標籤（10「已實測」、11「置頂」、12「最新」）：方角 3px、等寬字，跟膠囊按鈕分得開（設計稿 home.css 的 .tag）。
 *
 * @param {{ outline?: boolean, as?: string, className?: string, children: import('react').ReactNode }} props
 *   outline：螢光綠細框、透明底（12「最新」＝現在商店上的那一版，同 09「正在播放」用螢光綠）；
 *   as：元素（預設 span；10 的「已實測」是一段 <p>）；其餘屬性（data-id…）原樣放到那個元素上
 */
export default function Tag({ outline = false, as: Element = 'span', className, children, ...rest }) {
    return <Element className={[styles.tag, outline && styles.outline, className].filter(Boolean).join(' ')} {...rest}>{children}</Element>;
}
