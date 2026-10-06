import { Fragment } from 'react';
import { getString } from '../../app/strings.js';
import { HTML_LANG } from '../../app/seo.js';
import Seg from '../Seg/Seg.js';
import Button from '../Button/Button.js';
import Icon from '../Icon/Icon.js';
import styles from './Solo.module.css';

// 三個語言頁，照這個順序並列（規格書第 4 節）
const LANGS = ['zh', 'en', 'ja'];

/**
 * Solo —— 「/」三語選單頁與 404 共用的版型（設計稿 home.css 的 .solo）：記號 →（404）等寬讀數 → 三語大標 → 三欄各一句說明＋一顆連到自己語言頁的按鈕。
 * 整頁是英文（<html lang="en">，由版面寫）；大標三段、每一欄各標自己的 lang，字用自己那一語的字串表。
 * 路徑一律從根目錄算：404 在任何深度的網址都會出現（Cloudflare Pages）。
 *
 * @param {{ ids: { title: string, lead: string, btn: string }, code?: string, lazyMark?: boolean }} props
 *   ids：大標、說明、按鈕的字串表 id；code：記號下面的等寬讀數（404 的「404」，讀屏跳過 —— 大標已經講了）；
 *   lazyMark：記號用 loading="lazy"（「/」有 JS 時一開頁就跳走，不要讓 React 在 <head> 替它放預載）
 */
export default function Solo({ ids, code, lazyMark = false }) {
    return (
        <main className={styles.solo}>
            <div className={`wrap ${styles.in}`}>
                <header className={styles.head}>
                    <img className={styles.mark} src="/mark.svg" alt="" width="128" height="128" {...(lazyMark ? { loading: 'lazy' } : {})} />
                    {code && <p className={styles.code} aria-hidden="true">{code}</p>}
                    <h1 className={styles.title}>
                        {/* 段與段之間放一個空白：畫面上照樣一段一行（格線忽略只有空白的字），純文字（搜尋引擎、複製貼上）才不會黏在一起 */}
                        {LANGS.map((lang, i) => (
                            <Fragment key={lang}>
                                {i > 0 && ' '}
                                <span lang={HTML_LANG[lang]}><Seg text={getString(lang, ids.title)} /></span>
                            </Fragment>
                        ))}
                    </h1>
                </header>
                <ul className={styles.picks}>
                    {LANGS.map((lang) => (
                        <li key={lang} className={styles.pick} lang={HTML_LANG[lang]}>
                            <p><Seg text={getString(lang, ids.lead)} /></p>
                            <Button href={`/${lang}/`} variant="secondary" size="lg" className={styles.btn} lang={HTML_LANG[lang]} hrefLang={HTML_LANG[lang]}>
                                <span><Seg text={getString(lang, ids.btn)} /></span>
                                <Icon name="arrow" />
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    );
}
