import { bindTail } from '../../lib/bind-tail.js';
import { getString } from '../../app/strings.js';
import { knownKind, listed } from '../../app/changelog.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Tag from '../Tag/Tag.js';
import Older from '../Older/Older.js';
import Unreadable from '../Unreadable/Unreadable.js';
import styles from './Changelog.module.css';

// 攤開幾版；之後的收在「看更早的版本」
const SHOWN = 2;

/**
 * 12 更新紀錄（content/changelog.<語言>.md；規格書 §5-12）：淺的那一層；一版一段，段與段之間一條髮絲線；
 * 手機版本號在上、條目在下，1024 起左版本號（等寬細字讀數）、右條目。照內容檔的順序，最新兩版攤開，第三版起收在「看更早的版本」。
 * 只列 app/site.js 的 CHANGELOG_FROM 那一版以後的（1.0.3 不列，內容檔裡有也不列，收合裡也不放）；最上面那一個好的版本標「最新」。
 * 寫壞的一版：整版一個虛線框；寫壞的一條：那一行一個虛線框，同一版其他條照常；整支讀不到、或每一版都寫壞：整區一個虛線框。
 * 讀得到、但過濾掉不列的版本之後一版都沒有：一句 changelog.empty（樣式同 11 的 news.empty）。
 *
 * 伺服器端元件（產生網頁時跑）：會 import lib/bind-tail.js 與取字的 app/strings.js，也收得到 reason —— 不要改成 'use client'。reason 一律不畫。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', slot: { ok: boolean, entries?: object[] } }} props slot：readContent(...).changelog[lang]
 */
export default function Changelog({ lang, slot }) {
    const versions = slot.ok ? slot.entries.filter((v) => !v.ok || listed(v.version)) : [];
    const whole = !slot.ok || (versions.length > 0 && versions.every((v) => !v.ok));
    const latest = versions.find((v) => v.ok);
    const release = (v, index) => (v.ok ? <Release key={v.version} lang={lang} version={v} latest={v === latest} /> : (
        <article key={`bad-${index}`} className={[styles.rel, styles.relBad].join(' ')} data-version="" data-reveal="">
            <Unreadable lang={lang} variant="section" />
        </article>
    ));
    return (
        <Band section="changelog" id="changelog" raised>
            <SectionHead lang={lang} prefix="changelog" id="changelog-title" lead="changelog.lead" />
            {whole ? <Unreadable lang={lang} variant="section" whole /> : versions.length === 0 ? <p className={styles.empty}><Seg text={getString(lang, 'changelog.empty')} /></p> : (
                <div className={styles.log}>
                    {versions.slice(0, SHOWN).map(release)}
                    {versions.length > SHOWN && (
                        <Older lang={lang} id="changelog.older" className={styles.older}>
                            {versions.slice(SHOWN).map((v, i) => release(v, i + SHOWN))}
                        </Older>
                    )}
                </div>
            )}
        </Band>
    );
}

/**
 * 好的一版：版本號（h3，照原樣放、React 跳脫）、日期、最新；每一條一行 —— 認得的類型詞（app/changelog.js 的 knownKind）畫成左邊的螢光綠標記、
 * 內文是冒號後面那段；不認得的（清單外的短詞、沒有前綴卻有冒號的整句、沒有冒號的）左邊空著，整句（後端給的原句 raw，冒號照使用者寫的）當內文。
 * 使用者寫的字用 bindTail 的輸出原樣放。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', version: { version: string, date: string, items: object[] }, latest: boolean }} props
 */
function Release({ lang, version, latest }) {
    const id = `v${version.version.replace(/[^0-9A-Za-z]+/g, '-')}`;
    return (
        <article className={styles.rel} data-version={version.version} data-reveal="" aria-labelledby={id}>
            <header className={styles.head}>
                <h3 className={styles.v} id={id}>{version.version}</h3>
                <p className={styles.meta}>
                    <time className={styles.date} dateTime={version.date}>{version.date}</time>
                    {latest && <Tag outline data-id="changelog.latest"><Seg text={getString(lang, 'changelog.latest')} /></Tag>}
                </p>
            </header>
            <ul className={styles.items}>
                {version.items.map((item, index) => {
                    if (!item.ok) return <li key={index} className={styles.item} data-item=""><Unreadable lang={lang} variant="inline" /></li>;
                    const kind = knownKind(lang, item.kind);
                    return (
                        <li key={index} className={styles.item} data-item="">
                            {kind && <span className={styles.kind} data-kind="">{item.kind}</span>}
                            <span className={styles.text} data-text="" dangerouslySetInnerHTML={{ __html: bindTail(kind ? item.text : item.raw, lang) }} />
                        </li>
                    );
                })}
            </ul>
        </article>
    );
}
