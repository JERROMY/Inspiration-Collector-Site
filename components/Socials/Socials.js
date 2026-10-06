import { getPlainString, hasString } from '../../app/strings.js';
import Icon from '../Icon/Icon.js';
import IconButton from '../IconButton/IconButton.js';
import Unreadable from '../Unreadable/Unreadable.js';
import styles from './Socials.module.css';

// 有圖示檔的代號（public/icons/<代號>.svg，global.css 的 [data-icon]）。新代號還沒有圖時畫成文字膠囊
const ICONS = new Set(['blog', 'facebook', 'instagram', 'x', 'threads']);

/**
 * Socials —— 社群圖示一排（content/links.md）：圓形 44×44、只有圖（規格書第 6 節）。
 * 伺服器端元件。名字（讀屏的 aria-label 與 title，用去掉標記的純文字）是字串表的 social.<代號>；字串表還沒有的新代號用代號當名字。
 * 代號沒有圖示檔時畫成文字膠囊（一樣 44 高、等寬字，字就是名字；設計稿的 .iconbtn--text）。
 * 寫壞的那一條：unreadable 時在它的位置畫一個 44 高的虛線框（只有 14 作者與社群那一區），不然跳過（☰ 選單、頁尾）；
 * 整支讀不到：unreadable 時畫一個虛線框，不然不畫。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', slot: { ok: boolean, entries?: object[] }, place?: string, unreadable?: boolean, className?: string }} props
 *   slot：readContent(...).links（只讀 ok、code、url，reason 不碰）；
 *   place：在哪裡（menu、author、footer…），給了才數點擊（GoatCounter 的名字 social-<代號>-<place>，規格書 §11）；
 *   unreadable：寫壞的要不要講出來（規格書 §7：只在 14 講）
 */
export default function Socials({ lang, slot, place, unreadable = false, className }) {
    if (!slot.ok && !unreadable) return null;
    const label = getPlainString(lang, 'author.socials');
    const bad = (key) => <li key={key}><Unreadable lang={lang} variant="social" /></li>;
    return (
        <ul className={[styles.socials, className].filter(Boolean).join(' ')} aria-label={label}>
            {!slot.ok ? bad('bad') : slot.entries.map((link, index) => {
                if (!link.ok) return unreadable ? bad(`bad-${index}`) : null;
                const name = hasString(lang, `social.${link.code}`) ? getPlainString(lang, `social.${link.code}`) : link.code;
                const icon = ICONS.has(link.code);
                return (
                    <li key={link.code}>
                        <IconButton href={link.url} label={name} className={icon ? undefined : styles.text} data-goatcounter-click={place ? `social-${link.code}-${place}` : undefined} data-goatcounter-title={place ? name : undefined}>
                            {icon ? <Icon name={link.code} /> : name}
                        </IconButton>
                    </li>
                );
            })}
        </ul>
    );
}
