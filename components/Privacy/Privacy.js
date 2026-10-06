import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Card, { Cards } from '../Card/Card.js';
import Icon from '../Icon/Icon.js';
import TextLink from '../TextLink/TextLink.js';
import styles from './Privacy.module.css';

// 隱私條款的網址（商店表單填的也是這一頁）。網站 08 是隱私條款的第五份拷貝：條款改了，這四張卡講的事要跟著對一次
const PRIVACY_URL = 'https://jerromy.com/privacy/';

const ITEMS = ['priv-server', 'priv-account', 'priv-tracking', 'priv-folder'];

/**
 * 08 隱私（規格書 §5-08）：淺的那一層，四張卡（沒有伺服器、沒有帳號、沒有追蹤、只碰你挑的資料夾），底下連到完整的隱私條款。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Privacy({ lang }) {
    return (
        <Band section="privacy" id="privacy" raised>
            <SectionHead lang={lang} prefix="privacy" id="privacy-title" lead="privacy.lead" />
            <div className={styles.body}>
                <Cards>
                    {ITEMS.map((icon, i) => <Card key={icon} lang={lang} id={`privacy.${i + 1}`} icon={icon} />)}
                </Cards>
                <p>
                    <TextLink href={PRIVACY_URL} wrap data-id="privacy.link">
                        <Seg text={getString(lang, 'privacy.link')} tail={<Icon name="arrow" />} />
                    </TextLink>
                </p>
            </div>
        </Band>
    );
}
