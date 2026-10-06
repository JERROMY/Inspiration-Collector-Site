import { getString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import { Cards, CardBox, cardClass } from '../Card/Card.js';
import Icon from '../Icon/Icon.js';
import Tag from '../Tag/Tag.js';
import styles from './Devices.module.css';

// 四張卡：能用兩張（✓、桌機版 Chrome、已實測）、不行兩張（✕、為什麼）
// 每張的平台圖示（使用者 2026-10-04）：單色、靠右，多個綁成一組；出處見 README.md「圖示的出處」
const CARDS = [
    { id: 'devices.win', yes: true, icons: ['windows'] },
    { id: 'devices.mac', yes: true, icons: ['apple'] },
    { id: 'devices.mobile', yes: false, icons: ['device-mobile', 'device-tablet'] },
    { id: 'devices.other', yes: false, icons: ['firefox', 'safari'] },
];
// 規格表五列（標題 req.<列>.label、內容 req.<列>）
const ROWS = ['browser', 'ai', 'web', 'lang', 'price'];

/**
 * 10 支援裝置（規格書 §5-10）：淺的那一層；卡片 2×2（能用一排、不行一排）＋規格表，1280 起左卡片、右規格表。
 * ✓／✕ 只有圖示（不包圓框：圓是「會按的」形狀），讀屏念「可以用／不行」（devices.yes／devices.no）。
 * 規格表手機標題在上、內容在下，640 起兩欄（subgrid：標題欄寬照最長的那個）。不寫沒測過的瀏覽器與最低版本號。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Devices({ lang }) {
    return (
        <Band section="devices" id="devices" raised>
            <SectionHead lang={lang} prefix="devices" id="devices-title" lead="devices.lead" />
            <div className={styles.body}>
                <Cards cols={2}>
                    {CARDS.map(({ id, yes, icons }) => (
                        <CardBox key={id}>
                            <div className={styles.top}>
                                <span className={[styles.mark, yes ? styles.yes : styles.no].join(' ')}>
                                    <Icon name={yes ? 'check' : 'close'} />
                                    <span className="sr"><Seg text={getString(lang, yes ? 'devices.yes' : 'devices.no')} /></span>
                                </span>
                                <span className={styles.platforms} aria-hidden="true">
                                    {icons.map((name) => <Icon key={name} name={name} />)}
                                </span>
                            </div>
                            <h3 className={cardClass.title} data-id={id}><Seg text={getString(lang, id)} /></h3>
                            <p className={cardClass.body} data-id={yes ? 'devices.chrome' : `${id}.why`}><Seg text={getString(lang, yes ? 'devices.chrome' : `${id}.why`)} /></p>
                            {yes && <Tag as="p" data-id="devices.tested"><Seg text={getString(lang, 'devices.tested')} /></Tag>}
                        </CardBox>
                    ))}
                </Cards>
                <dl className={styles.req}>
                    {ROWS.map((row) => (
                        <div key={row} className={styles.row}>
                            <dt data-id={`req.${row}.label`}><Seg text={getString(lang, `req.${row}.label`)} /></dt>
                            <dd data-id={`req.${row}`}><Seg text={getString(lang, `req.${row}`)} /></dd>
                        </div>
                    ))}
                </dl>
            </div>
        </Band>
    );
}
