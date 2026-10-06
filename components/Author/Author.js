import { getString, getPlainString } from '../../app/strings.js';
import { imageSet } from '../../app/images.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Button from '../Button/Button.js';
import Icon from '../Icon/Icon.js';
import Socials from '../Socials/Socials.js';
import styles from './Author.module.css';

const BLOG_URL = 'https://jerromy.com';
// 照片畫多寬：手機 96、1024 起 160（設計稿 home.css 的 .author__photo）
const PHOTO_SIZES = '(min-width: 1024px) 160px, 96px';

/**
 * 14 作者與社群（規格書 §5-14）：淺的那一層；照片（黃底插畫不在設計系統的顏色裡、不能重新上色 → 裁成圓、縮小、髮絲線圈住）、
 * Made by、名字（這一區唯一的 h2）、兩段簡介、「到部落格看更多」＋社群一排（content/links.md）。1024 起照片在左。
 * 寫壞的社群連結只在這一區講「這一條讀不到」（☰ 選單與頁尾直接跳過）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja', links: { ok: boolean, entries?: object[] } }} props links：readContent(...).links
 */
export default function Author({ lang, links }) {
    const photo = imageSet('author-jerromy.jpg');
    const largest = photo.files.at(-1);
    return (
        <Band section="author" id="author" raised className={styles.in}>
            <img
                className={styles.photo}
                src={largest.src}
                srcSet={photo.files.map((f) => `${f.src} ${f.width}w`).join(', ')}
                sizes={PHOTO_SIZES}
                alt={getPlainString(lang, 'author.photo.alt')}
                width={largest.width}
                height={largest.height}
                loading="lazy"
                decoding="async"
            />
            <div className={styles.text}>
                <SectionHead lang={lang} prefix="author" id="author-title" title="author.name" titleClassName={styles.name}>
                    <div className={styles.bio}>
                        <p data-id="author.bio.1"><Seg text={getString(lang, 'author.bio.1')} /></p>
                        <p data-id="author.bio.2"><Seg text={getString(lang, 'author.bio.2')} /></p>
                    </div>
                </SectionHead>
                <div className={styles.links}>
                    <Button href={BLOG_URL} variant="secondary" className={styles.blog} data-id="author.blog" data-goatcounter-click="blog-author" data-goatcounter-title={getPlainString(lang, 'author.blog')}>
                        <span><Seg text={getString(lang, 'author.blog')} tail={<Icon name="arrow" />} /></span>
                    </Button>
                    <Socials lang={lang} slot={links} place="author" unreadable />
                </div>
            </div>
        </Band>
    );
}
