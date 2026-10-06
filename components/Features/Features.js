import { getString } from '../../app/strings.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Card, { Cards } from '../Card/Card.js';

// 八張卡：圖示、對到教學片哪一章（「看教學 NN」連到 09 區那一章的 #ch-NN）
const ITEMS = [
    ['feat-article', '03'], ['feat-selection', '04'], ['feat-image', '05'], ['feat-reply', '06'],
    ['feat-chat', '07'], ['feat-files', '08'], ['feat-topics', '09'], ['feat-once', '03'],
];

/**
 * 06 能收什麼（規格書 §5-06）：淺的那一層，八張卡，每張帶「看教學 NN」連到 09 區那一章。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function Features({ lang }) {
    const more = getString(lang, 'features.more');
    return (
        <Band section="features" id="features" raised>
            <SectionHead lang={lang} prefix="features" id="features-title" />
            <Cards>
                {ITEMS.map(([icon, nn], i) => (
                    <Card key={i} lang={lang} id={`features.${i + 1}`} icon={icon} more={{ href: `#ch-${nn}`, chapter: nn, text: more.replace('%nn%', nn) }} />
                ))}
            </Cards>
        </Band>
    );
}
