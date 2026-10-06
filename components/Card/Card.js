import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import TextLink from '../TextLink/TextLink.js';
import styles from './Card.module.css';

// 卡片裡各段的樣式（標題、一句、底下的連結、圖示），給自己排卡片內容的區（10 支援裝置、11 公告）沿用，不另寫一套
export const cardClass = { title: styles.title, body: styles.body, more: styles.more, icon: styles.icon };

/**
 * Cards —— 一整片卡片。cols 決定欄數（照設計稿 home.css 的 .cards--4／--2／--3）：
 *   4（06、08）：手機一欄、640 起兩欄、1280 起四欄（規格書寫桌機四欄；1024 時一張卡的字一行只剩 7～9 個日文字，照語意斷行排不下，1024～1279 先兩欄）；
 *   2（10）：手機一欄、640 起兩欄；
 *   3（11）：1024 以下一欄（兩欄會剩一張落單）、1024 起三欄；只有兩張時兩欄平分，只有一張時跨兩欄、卡片裡左右排（News 的版面）。
 *
 * @param {{ cols?: 2 | 3 | 4, className?: string, children: import('react').ReactNode }} props children：一張一張的卡（<Card> 或 <CardBox>）
 */
export function Cards({ cols = 4, className, children }) {
    return <ul className={[styles.cards, styles[`cols${cols}`], className].filter(Boolean).join(' ')}>{children}</ul>;
}

/**
 * CardBox —— 一張卡的外框（<li>）：內距 30、髮絲框、8px 圓角、底色讀 --card-bg；捲進畫面三成時往上浮出（data-reveal）。裡面放什麼由呼叫端排。
 *
 * @param {{ linked?: boolean, reveal?: boolean, className?: string, children: import('react').ReactNode }} props
 *   linked：整張可以按（裡面有一個 className 是 cardClass.more 的連結，它的 ::after 蓋滿整張卡）；
 *   reveal：要不要浮出（預設要；寫壞的那一張虛線卡也照樣浮出）；其餘屬性（data-*…）原樣放到 <li> 上
 */
export function CardBox({ linked = false, reveal = true, className, children, ...rest }) {
    return (
        <li className={[styles.card, linked && styles.linked, className].filter(Boolean).join(' ')} {...(reveal ? { 'data-reveal': '' } : {})} {...rest}>
            {children}
        </li>
    );
}

/**
 * Card —— 一張卡＝一個單位：圖示 → 標題（h3）→ 一句 →（給了 more 才有）「看教學 NN」。字從字串表的 <id>.title、<id>.body 取。
 * 有 more 時整張可以按：連結的 ::after 蓋滿整張卡，滑過時框線變亮、連結轉螢光綠、箭頭往右推；鍵盤停在連結時框住整張卡。
 * 捲進畫面三成時往上浮出、淡入（public/motion.js 的 data-reveal）；同一排照欄位晚一點。減少動態、沒有 JS 時直接在。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', id: string, icon: string, more?: { href: string, text: string, chapter?: string } }} props
 *   id：字串表的前綴（features.1）；icon：data-icon 的名字（public/icons/）；more：連結（字已經是那個語言、帶標記）
 */
export default function Card({ lang, id, icon, more }) {
    const titleId = id.replace(/\./g, '-');
    return (
        <CardBox linked={Boolean(more)}>
            <span className={styles.icon}><Icon name={icon} /></span>
            <h3 className={styles.title} id={titleId} data-id={`${id}.title`}><Seg text={getString(lang, `${id}.title`)} /></h3>
            <p className={styles.body} data-id={`${id}.body`}><Seg text={getString(lang, `${id}.body`)} /></p>
            {more && (
                <TextLink href={more.href} wrap className={styles.more} data-id={`${id}.more`} aria-describedby={titleId} {...(more.chapter ? { 'data-chapter': more.chapter } : {})}>
                    <Seg text={more.text} tail={<Icon name="arrow" />} />
                </TextLink>
            )}
        </CardBox>
    );
}
