import { getString, getPlainString } from '../../app/strings.js';
import { STORE_URL, SECTIONS } from '../../app/site.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import Button from '../Button/Button.js';
import IconButton from '../IconButton/IconButton.js';
import LangSwitch from '../LangSwitch/LangSwitch.js';
import Socials from '../Socials/Socials.js';
import styles from './Nav.module.css';

const MENU_ID = 'menu';

/**
 * Nav —— 01 導覽列與 ☰ 選單（規格書第 5 節 01）。
 *
 * 一整排：記號＋名稱｜六個連結｜語言切換｜加到 Chrome。中文 1024 起、英文日文 1280 起一整排，窄的時候收成 ☰。
 * 只有手指的裝置不放「加到 Chrome」（手機裝不了）。
 * ☰ 選單用原生的 popover（沒有 JS 也打得開；Esc、點外面會關）；讀屏名字跟著換、點連結收起、不支援 popover 時改用自己的開合，
 * 是 public/nav.js 做的（認 data-menu-button、data-menu）。選單放在 <header> 外面：導覽列的毛玻璃（backdrop-filter）
 * 會變成 position: fixed 的參考框，不支援 popover 的瀏覽器裡選單會被關在導覽列那一條裡。
 *
 * 伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', links: { ok: boolean, entries?: object[] } }} props links：readContent(...).links（選單的社群一排）
 */
export default function Nav({ lang, links }) {
    const label = getPlainString(lang, 'nav.label');
    const sectionLinks = SECTIONS.map(({ id, hash }) => (
        <a key={hash} href={hash}><Seg text={getString(lang, id)} /></a>
    ));
    return (
        <>
            <header className={[styles.nav, styles[lang]].join(' ')} id="top">
                <div className={styles.inner}>
                    <a className={styles.brand} href="#top">
                        <img className={styles.mark} src="/mark.svg" alt="" width="128" height="128" />
                        <span className={styles.name}><Seg text={getString(lang, 'nav.brand')} /></span>
                    </a>
                    <nav className={styles.links} aria-label={label}>{sectionLinks}</nav>
                    <div className={styles.barLang}><LangSwitch lang={lang} /></div>
                    <Button href={STORE_URL} className={styles.cta} data-goatcounter-click="install-nav" data-goatcounter-title={getPlainString(lang, 'nav.cta')}><Seg text={getString(lang, 'nav.cta')} /></Button>
                    <IconButton
                        className={styles.menuButton}
                        label={getPlainString(lang, 'nav.menu.open')}
                        aria-controls={MENU_ID}
                        aria-expanded="false"
                        popoverTarget={MENU_ID}
                        data-menu-button=""
                        data-label-close={getPlainString(lang, 'nav.menu.close')}
                    >
                        <span className={styles.iconList}><Icon name="list" /></span>
                        <span className={styles.iconClose}><Icon name="close" /></span>
                    </IconButton>
                </div>
            </header>
            <div className={[styles.menu, styles[lang]].join(' ')} id={MENU_ID} popover="auto" data-menu="">
                <nav className={styles.menuLinks} aria-label={label}>{sectionLinks}</nav>
                <LangSwitch lang={lang} />
                <Socials lang={lang} slot={links} place="menu" />
            </div>
        </>
    );
}
