import styles from './Frame.module.css';

/**
 * Frame —— 媒體框：髮絲框、8px 圓角。corners：四個螢光綠的括號角（觀景窗：框住「收進來的東西」，例如 AI 交出的大綱）畫在框外 8px，
 * 捲進畫面三成時從框外收到框邊一次（動態 D，public/motion.js 給 data-reveal 的元素加 data-in）；減少動態、沒有 JS 時一直在定位。
 * 05 三步驟的截圖只要框、不要括號角（corners={false}）。
 *
 * @param {{ corners?: boolean, className?: string, children: import('react').ReactNode }} props
 *   corners：要不要括號角（預設要）；className：外面要加的版面樣式；children：框裡的東西；其餘屬性（data-*…）原樣放到 <figure> 上
 */
export default function Frame({ corners = true, className, children, ...rest }) {
    return (
        <figure
            className={[styles.frame, corners && styles.corners, className].filter(Boolean).join(' ')}
            {...(corners ? { 'data-corners': '', 'data-reveal': '' } : {})}
            {...rest}
        >
            {children}
        </figure>
    );
}
