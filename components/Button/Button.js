import styles from './Button.module.css';

/**
 * Button —— 膠囊按鈕。主要：白底，滑過變螢光綠、括號從兩側滑進來夾住字（記號的括號）；次要：髮絲框。高至少 44。
 * 有 href 是連結，沒有是 <button type="button">（例如「分享這個網址」，程式接手）。
 *
 * @param {{ href?: string, variant?: 'primary' | 'secondary', size?: 'md' | 'lg', className?: string, children: import('react').ReactNode }} props
 *   size：lg 是首屏那種大顆（52 高、16px 字）；className：外面要加的版面樣式；其餘屬性（data-*…）原樣放到那個元素上
 */
export default function Button({ href, variant = 'primary', size = 'md', className, children, ...rest }) {
    const name = [styles.btn, styles[variant], size === 'lg' && styles.lg, className].filter(Boolean).join(' ');
    if (href) {
        return <a className={name} href={href} {...rest}>{children}</a>;
    }
    return <button className={name} type="button" {...rest}>{children}</button>;
}
