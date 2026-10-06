import styles from './IconButton.module.css';

/**
 * IconButton —— 圓形的圖示鈕，44×44。有 href 是連結（社群），沒有是 <button type="button">（☰、✕）。
 *
 * @param {{ label: string, href?: string, ghost?: boolean, className?: string, children: import('react').ReactNode }} props
 *   label：讀屏的名字（aria-label；連結另外放 title，滑過看得到）；ghost：沒有框（公告條的 ✕）；
 *   其餘屬性（aria-controls、popovertarget、data-*…）原樣放到那個元素上
 */
export default function IconButton({ label, href, ghost = false, className, children, ...rest }) {
    const name = [styles.iconbtn, ghost && styles.ghost, className].filter(Boolean).join(' ');
    if (href) {
        return <a className={name} href={href} aria-label={label} title={label} {...rest}>{children}</a>;
    }
    return <button className={name} type="button" aria-label={label} {...rest}>{children}</button>;
}
