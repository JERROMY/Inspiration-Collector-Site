import { getString, getPlainString } from '../../app/strings.js';
import { STORE_URL } from '../../app/site.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import Button from '../Button/Button.js';
import TextLink from '../TextLink/TextLink.js';
import Hydrated from '../Hydrated/Hydrated.js';
import TouchBox from '../TouchBox/TouchBox.js';
import styles from './Hero.module.css';

/**
 * Hero —— 03 首屏（規格書第 5 節 03、第 9 節）。桌機：大標橫跨整個內容寬，底下左字右片；手機、平板一欄：字 → 按鈕 → 影片。
 *
 * 每一段字畫在帶 data-id（字串表的 id）的元素裡。會動、要程式的地方交給兩支外部腳本（不寫內嵌腳本）：
 * - public/hero.js：宣傳片（桌機看得到才播、捲出去就停；只有手指、省流量、減少動態時按了才載入）、「分享這個網址」與「已複製」。
 * - public/motion.js：動態 A（括號裡的字隨機冒出來）、D（媒體框的括號角對焦，data-corners＋data-reveal）。
 * 只有手指的裝置看不到「加到 Chrome」那一組，換成「把網址帶到電腦上」的框（components/TouchBox，15 區也用它）。
 *
 * 伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Hero({ lang }) {
    return (
        <>
        <section className={styles.hero} data-section="hero" aria-labelledby="hero-title">
            <div className={`wrap ${styles.in}`}>
                <h1 className={styles.h1} id="hero-title">
                    <span className={styles.kicker} data-id="hero.kicker"><Seg text={getString(lang, 'hero.kicker')} /></span>
                    {/* 兩段之間一個空白：h1 是格線，只有空白的字不佔格、畫面不變；純文字（搜尋結果、複製貼上）才不會黏在一起 */}
                    {' '}
                    <span className={styles.title} data-id="hero.title"><Seg text={getString(lang, 'hero.title')} /></span>
                </h1>
                <div className={styles.body}>
                    <p className={styles.sub} data-id="hero.sub"><Seg text={getString(lang, 'hero.sub')} /></p>
                    <div className={styles.ctas}>
                        <Button href={STORE_URL} size="lg" data-id="hero.cta" data-goatcounter-click="install-hero" data-goatcounter-title={getPlainString(lang, 'hero.cta')}><Seg text={getString(lang, 'hero.cta')} /></Button>
                        <Button href="#tutorial" variant="secondary" size="lg" data-id="hero.watch">
                            <Icon name="play" /><Seg text={getString(lang, 'hero.watch')} />
                        </Button>
                    </div>
                    <div className={styles.meta}>
                        <p data-id="hero.meta.free"><Seg text={getString(lang, 'hero.meta.free')} /></p>
                        <p data-id="hero.meta.os"><Seg text={getString(lang, 'hero.meta.os')} /></p>
                        <TextLink href="#devices" arrow className={styles.devices} data-id="hero.meta.devices">
                            <Seg text={getString(lang, 'hero.meta.devices')} />
                        </TextLink>
                    </div>
                    <TouchBox
                        lang={lang}
                        prefix="hero"
                        lead={<p data-id="hero.mobile.text"><Seg text={getString(lang, 'hero.mobile.text')} bold={getString(lang, 'hero.mobile.bold')} /></p>}
                    />
                </div>
                <figure className={styles.media}>
                    <div className={styles.frame} data-corners="" data-reveal="">
                        <div className={styles.crop}>
                            <img
                                src={`/images/hero-poster-${lang}-1280.webp`}
                                srcSet={`/images/hero-poster-${lang}-640.webp 640w, /images/hero-poster-${lang}-1280.webp 1280w`}
                                sizes="(min-width: 1024px) 690px, 100vw"
                                alt={getPlainString(lang, 'hero.video.alt')}
                                width="1920"
                                height="1080"
                                fetchPriority="high"
                            />
                            <video muted loop playsInline preload="none" data-src={`/media/hero-${lang}.mp4`} aria-hidden="true" />
                        </div>
                        {/* 播放鈕／暫停鍵（同一顆）：data-state 由 public/hero.js 換（idle｜loading｜playing｜paused），讀屏名字跟著換 */}
                        <button
                            className={styles.play}
                            type="button"
                            aria-label={getPlainString(lang, 'hero.video.play')}
                            data-play=""
                            data-state="idle"
                            data-label-play={getPlainString(lang, 'hero.video.play')}
                            data-label-pause={getPlainString(lang, 'hero.video.pause')}
                        >
                            <Icon name="play" />
                            <Icon name="pause" />
                        </button>
                    </div>
                    <figcaption>
                        <details className={styles.vdesc}>
                            <summary>
                                <span data-id="hero.video.label"><Seg text={getString(lang, 'hero.video.label')} /></span>
                                <Icon name="caret" />
                            </summary>
                            <p data-id="hero.video.desc"><Seg text={getString(lang, 'hero.video.desc')} /></p>
                        </details>
                    </figcaption>
                </figure>
            </div>
            <Hydrated />
        </section>
        {/* 「已複製」：role="status" 的元素開頁時就在、字是空的（讀屏只念內容改變，不念剛出現的元素）；hero.js 複製成功時才填字、浮出來。
            整頁一個（首屏與 15 區的分享都用它），放在首屏外面：首屏是 isolation: isolate，放在裡面的話 z-index 只在首屏裡比，後面的 15 區會蓋在它上面 */}
        <p className={styles.toast} role="status" data-toast="" data-copied={getPlainString(lang, 'state.copied')} />
        </>
    );
}
