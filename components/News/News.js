import { bindTail } from '../../lib/bind-tail.js';
import { getString, getPlainString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import { Cards, CardBox, cardClass } from '../Card/Card.js';
import Icon from '../Icon/Icon.js';
import Tag from '../Tag/Tag.js';
import TextLink from '../TextLink/TextLink.js';
import Older from '../Older/Older.js';
import Unreadable from '../Unreadable/Unreadable.js';
import styles from './News.module.css';

// 攤開幾則；之後的收在「看更早的公告」
const SHOWN = 3;

/**
 * 11 最新公告（content/news.<語言>.md；規格書 §5-11）：一則一張卡片，照內容檔的順序；最近三則一排（1024 起三欄、更窄一欄），
 * 第四則起收在「看更早的公告」（<details>）。寫壞的那一則照樣佔它的位置：一張一樣大的虛線卡（「這一條讀不到」，不寫原因）。
 * 一則都沒有：一句 news.empty；整支讀不到、或每一則都寫壞：整區一個虛線框（state.unreadable.section）。
 *
 * 伺服器端元件（產生網頁時跑）：會 import lib/bind-tail.js 與取字的 app/strings.js，也收得到 reason —— 不要改成 'use client'，
 * 不然讀內容的程式與 reason 會跟著送到瀏覽器。reason、raw 一律不畫。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', slot: { ok: boolean, entries?: object[] } }} props slot：readContent(...).news[lang]
 */
export default function News({ lang, slot }) {
    const entries = slot.ok ? slot.entries : [];
    const whole = !slot.ok || (entries.length > 0 && entries.every((e) => !e.ok));
    const card = (entry, index) => (entry.ok ? <Entry key={entry.id} lang={lang} entry={entry} /> : (
        <CardBox key={`bad-${index}`} className={styles.bad} data-entry="" data-state="unreadable">
            <Unreadable lang={lang} marked={false} />
        </CardBox>
    ));
    let body;
    if (whole) body = <Unreadable lang={lang} variant="section" whole />;
    else if (entries.length === 0) body = <p className={styles.empty}><Seg text={getString(lang, 'news.empty')} /></p>;
    else {
        body = (
            <>
                <Cards cols={3}>{entries.slice(0, SHOWN).map(card)}</Cards>
                {entries.length > SHOWN && (
                    <Older lang={lang} id="news.older">
                        <Cards cols={3}>{entries.slice(SHOWN).map((e, i) => card(e, i + SHOWN))}</Cards>
                    </Older>
                )}
            </>
        );
    }
    return (
        <Band section="news" id="news">
            <SectionHead lang={lang} prefix="news" id="news-title" />
            <div className={styles.body}>{body}</div>
        </Band>
    );
}

/**
 * 好的一則：日期、類別（使用者自由寫的字）、置頂的標籤 → 標題（h3）→ 內文（使用者的換行照留）→ 有連結才有「看全文」（整張卡都能按）。
 * 使用者寫的標題與內文用 bindTail 的輸出（已跳脫、綁了最後幾個字、中文插了詞界）原樣放。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', entry: { id: string, date: string, category: string, title: string, body: string, link: string, pinned: boolean } }} props
 */
function Entry({ lang, entry }) {
    const titleId = `news-${entry.id}`;
    return (
        <CardBox linked={Boolean(entry.link)} className={[styles.news, entry.pinned && styles.pinned].filter(Boolean).join(' ')} data-entry="">
            <p className={styles.meta}>
                <time className={styles.date} dateTime={entry.date}>{entry.date}</time>
                <span className={styles.kind}>{entry.category}</span>
                {entry.pinned && <Tag className={styles.pin} data-id="news.pinned"><Icon name="pin" /><Seg text={getString(lang, 'news.pinned')} /></Tag>}
            </p>
            <h3 className={[cardClass.title, styles.title].join(' ')} id={titleId} dangerouslySetInnerHTML={{ __html: bindTail(entry.title, lang) }} />
            {entry.body !== '' && <p className={[cardClass.body, styles.text].join(' ')} data-body="" dangerouslySetInnerHTML={{ __html: bindTail(entry.body, lang) }} />}
            {entry.link && (
                <TextLink href={entry.link} wrap className={[cardClass.more, styles.more].join(' ')} data-id="news.more" aria-describedby={titleId} data-goatcounter-click="blog-news" data-goatcounter-title={getPlainString(lang, 'news.more')}>
                    <Seg text={getString(lang, 'news.more')} tail={<Icon name="arrow" />} />
                </TextLink>
            )}
        </CardBox>
    );
}
