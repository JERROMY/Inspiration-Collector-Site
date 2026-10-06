import { getString, getPlainString } from '../../app/strings.js';
import { TUTORIAL_VIDEO_IDS } from '../../app/site.js';
import { loadChapters, clock } from '../../app/chapters.js';
import { chapterName, chapterDesc } from '../../app/data-text.js';
import { imageSet } from '../../app/images.js';
import Seg from '../Seg/Seg.js';
import Icon from '../Icon/Icon.js';
import Button from '../Button/Button.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Frame from '../Frame/Frame.js';
import DataText from '../DataText/DataText.js';
import styles from './Tutorial.module.css';

// YouTube 的影片 ID：11 個字元（英數字、-、_）
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * 那一語的影片 ID：空字串（還沒上 YouTube）或 11 個字元的 ID；其他的（整個網址、打錯）讓產生網頁失敗 —— 不然上線的是一支播不了的影片。
 *
 * @param {'zh' | 'en' | 'ja'} lang
 * @returns {string}
 * @throws {Error} 格式不對（訊息講是哪一語、填了什麼）
 */
function videoIdOf(lang) {
    const id = TUTORIAL_VIDEO_IDS[lang];
    if (id === '' || (typeof id === 'string' && VIDEO_ID.test(id))) return id;
    throw new Error(`app/site.js 的 TUTORIAL_VIDEO_IDS.${lang}（${lang} 的教學影片）格式不對：填的是「${id}」。要填 YouTube 影片網址裡 v= 後面那 11 個字元（英文字母、數字、- 或 _），還沒上 YouTube 就留空字串。`);
}

// 窄的時候（清單在影片下面）一開始列幾章，其餘收在「看全部 16 章」
const FIRST = 5;

// 預覽圖實際畫出來多寬（<img sizes>）：寬（09 的內容 ≥ 960，1024 起）影片占 7／12（兩欄中間 40、版心最寬 1180）；640 起是版心（兩邊各留 32）；手機貼齊兩邊
const POSTER_SIZES = '(min-width: 1244px) 665px, (min-width: 1024px) calc((100vw - 104px) * 0.5833), (min-width: 640px) calc(100vw - 64px), 100vw';

/**
 * 09 教學影片（規格書 §5-09）：小標、大標、一句說明；影片框（預覽圖＋播放鈕）、「在 YouTube 上看」、16 章的清單（章號、章名、起點，摘要收在每一列的開關裡）。
 * 寬的時候（09 的內容 ≥ 960）影片在左、章節在右，清單自己捲；窄的時候影片在上、先列 5 章。
 *
 * 有影片 ID（app/site.js 的 TUTORIAL_VIDEO_IDS）時：按播放鈕、章名、或 06 的「看教學 NN」才由 public/tutorial.js 載入 YouTube 的播放器，
 * 從那一章的起點播、播到那一章的結尾停，蓋上章尾那一層（重播這一段／播下一段；最後一章是從頭再看一次）。
 * 沒有影片 ID（還沒上 YouTube）時：沒有播放鈕與「在 YouTube 上看」，大標換成 tutorial.title.noid，影片框的下一列一句實話（手機在框底下，640 起疊回框的左下角），
 * 每一列就是摘要的開關。
 * 章名、摘要從 data/chapters.<語言>.json 來，斷行照規則（app/data-text.js）。伺服器端元件。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Tutorial({ lang }) {
    const videoId = videoIdOf(lang);
    const chapters = loadChapters(lang);
    const poster = imageSet(`tutorial-poster-${lang}.png`);
    const largest = poster.files[poster.files.length - 1];
    const descToggle = getPlainString(lang, 'tutorial.desc.toggle');
    const [nextBefore, nextAfter = ''] = getPlainString(lang, 'tutorial.next').split('%章名%');

    const row = (c) => {
        const head = (
            <>
                <span className={styles.n}>{c.id}</span>
                <span className={styles.name} id={`ch-${c.id}-name`} data-id={`ch.${c.id}.name`}><DataText nodes={chapterName(lang, c.name)} /></span>
                <span className={styles.t}>{clock(c.start)}</span>
            </>
        );
        const desc = <p className={styles.desc} data-id={`ch.${c.id}.desc`}><DataText nodes={chapterDesc(lang, c.desc)} /></p>;
        if (!videoId) {
            return (
                <li key={c.id} className={styles.ch} id={`ch-${c.id}`}>
                    <details className={styles.more}>
                        <summary className={`${styles.chRow} ${styles.plain}`}>{head}<span className={styles.caret}><Icon name="caret" /></span></summary>
                        {desc}
                    </details>
                </li>
            );
        }
        return (
            <li key={c.id} className={styles.ch} id={`ch-${c.id}`}>
                <button
                    className={styles.chRow}
                    type="button"
                    data-chapter={c.id}
                    data-start={c.start}
                    data-end={c.end}
                    data-name={c.name}
                    data-goatcounter-click={`tutorial-${c.id}`}
                    data-goatcounter-title={c.name}
                >
                    {head}
                </button>
                <details className={styles.more}>
                    <summary className={styles.toggle} aria-label={descToggle} aria-describedby={`ch-${c.id}-name`}><Icon name="caret" /></summary>
                    {desc}
                </details>
            </li>
        );
    };

    return (
        <Band section="tutorial" id="tutorial">
            <SectionHead lang={lang} prefix="tutorial" id="tutorial-title" title={videoId ? 'tutorial.title' : 'tutorial.title.noid'} lead={videoId ? 'tutorial.lead' : 'tutorial.lead.noid'} />
            <div className={styles.box}>
                <div
                    className={videoId ? styles.player : `${styles.player} ${styles.novideo}`}
                    data-tutorial=""
                    {...(videoId ? { 'data-video-id': videoId, 'data-clips': `/media/tutorial/${lang}/`, 'data-video-label': getPlainString(lang, 'tutorial.play'), 'data-now-label': getPlainString(lang, 'tutorial.nowPlaying'), 'data-now-class': styles.now, 'data-fail-class': styles.failed } : {})}
                >
                    <Frame className={styles.screen} data-player="" data-state="idle">
                        <img
                            src={largest.src}
                            srcSet={poster.files.map((f) => `${f.src} ${f.width}w`).join(', ')}
                            sizes={POSTER_SIZES}
                            alt={getPlainString(lang, 'tutorial.poster.alt')}
                            width={largest.width}
                            height={largest.height}
                            loading="lazy"
                            decoding="async"
                        />
                        {videoId && (
                            // 播放器程式載不到時（public/tutorial.js 打開、影片框加 data-fail-class）：一句話（tutorial.apifail），請人改用底下的「在 YouTube 上看」；
                            // 放在播放鈕前面（播放鈕疊在它上面，手機那一層蓋滿整個框時照樣按得到）；role="status"：讀屏念出來，不搶焦點
                            <p className={styles.fail} role="status" data-api-fail="" hidden>
                                <Seg text={getString(lang, 'tutorial.apifail')} />
                            </p>
                        )}
                        {videoId && (
                            <button className={styles.playBtn} type="button" aria-label={getPlainString(lang, 'tutorial.play')} data-play=""><Icon name="play" /></button>
                        )}
                        {videoId && (
                            // 章尾那一層：public/tutorial.js 播到一章的結尾才打開，標題代入這一章的章名、「播下一段」代入下一章的章名
                            <div className={styles.endcard} data-endcard="" hidden>
                                <p className={styles.endTitle} data-id="tutorial.done"><Seg text={getString(lang, 'tutorial.done')} /></p>
                                <div className={styles.actions}>
                                    <Button variant="secondary" className={styles.endBtn} data-id="tutorial.replay" data-end-action="replay">
                                        <Icon name="replay" /><span><Seg text={getString(lang, 'tutorial.replay')} /></span>
                                    </Button>
                                    <Button className={styles.endBtn} data-id="tutorial.next" data-end-action="next">
                                        <span>{nextBefore}<span data-next-name="" />{nextAfter}</span>
                                    </Button>
                                    <Button className={styles.endBtn} data-id="tutorial.again" data-end-action="again">
                                        <span><Seg text={getString(lang, 'tutorial.again')} tail={<Icon name="arrow" />} /></span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Frame>
                    {!videoId && <p className={styles.note} data-id="tutorial.noid.note"><Seg text={getString(lang, 'tutorial.noid.note')} /></p>}
                    {videoId && (
                        <Button href={`https://www.youtube.com/watch?v=${videoId}`} variant="secondary" className={styles.yt} data-id="tutorial.youtube">
                            <Icon name="youtube" /><span><Seg text={getString(lang, 'tutorial.youtube')} /></span>
                        </Button>
                    )}
                    <div className={styles.chapters} data-chapters="">
                        <p className={styles.head}>
                            <span className={styles.headStart}>
                                <span className={styles.label} id="chapters-label" data-id="tutorial.chapters"><Seg text={getString(lang, 'tutorial.chapters')} /></span>
                                <span className={styles.count} data-id="tutorial.count"><Seg text={getString(lang, 'tutorial.count')} /></span>
                            </span>
                            <span className={styles.label} data-id="tutorial.total"><Seg text={getString(lang, 'tutorial.total')} /></span>
                        </p>
                        <div className={styles.scroll} id="chapters-scroll" data-chapters-scroll="">
                            <ol className={styles.list} aria-labelledby="chapters-label">{chapters.slice(0, FIRST).map(row)}</ol>
                            <details className={styles.rest}>
                                <summary className={styles.all}><span data-id="tutorial.showAll"><Seg text={getString(lang, 'tutorial.showAll')} /></span><Icon name="caret" /></summary>
                                <ol className={styles.list} start={FIRST + 1} aria-labelledby="chapters-label">{chapters.slice(FIRST).map(row)}</ol>
                            </details>
                        </div>
                        {/* 寬的時候（清單自己捲）：「還有 N 章 ↓」—— public/tutorial.js 算還沒整列露出來的章數、代進 %nn%，捲到底收掉；按了往下捲一頁 */}
                        <button className={styles.moreHint} type="button" data-chapters-more="" data-template={getPlainString(lang, 'tutorial.moreHint')} aria-controls="chapters-scroll" hidden>
                            <span data-id="tutorial.moreHint" data-more-text="" /><Icon name="caret" />
                        </button>
                    </div>
                </div>
            </div>
        </Band>
    );
}
