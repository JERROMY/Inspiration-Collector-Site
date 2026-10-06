import Icon from '../Icon/Icon.js';
import styles from './TextLink.module.css';

/**
 * TextLink —— 不在句子裡的文字連結（「看支援裝置 →」這類）：底線、44 高，滑過變螢光綠、箭頭往右推一點。
 * 句子裡的連結不用它（那種照一般的 <a>）。
 *
 * @param {{ href: string, arrow?: boolean, wrap?: boolean, className?: string, children: import('react').ReactNode }} props
 *   arrow：結尾放箭頭（字會換行的連結，箭頭請用 <Seg tail> 放進最後一個詞裡）；
 *   wrap：字會換行的連結（卡片的「看教學 NN」、隱私條款）：一般的文字行＋上下內距湊到 44 高（inline-flex 會把字拆成好幾段、底線斷開）；
 *   其餘屬性（data-*…）原樣放到 <a> 上
 */
export default function TextLink({ href, arrow = false, wrap = false, className, children, ...rest }) {
    return (
        <a className={[styles.link, wrap && styles.wrap, className].filter(Boolean).join(' ')} href={href} {...rest}>
            {children}
            {arrow && <Icon name="arrow" />}
        </a>
    );
}
