import { getString, getPlainString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Frame from '../Frame/Frame.js';
import Crop from '../Crop/Crop.js';
import styles from './ForAI.module.css';

// 大綱圖露出的那一塊（原圖 1920×1080 的像素座標，設計稿）：只留 OUTLINE.md 那塊的左半，字才看得清楚；640 起寬一點
const OUTLINE = { x: 300, y: 143, width: 640, height: 540 };
const OUTLINE_WIDE = { x: 300, y: 143, width: 1010, height: 560 };

/**
 * 大綱圖實際畫出來多寬（<img sizes>）：框寬 × 檔案那一塊的寬 ÷ 露出的寬。框寬：手機是版心（兩邊各留 16）；640 起版心（兩邊各留 32）；
 * 1024 起是左欄的 84%（兩欄中間隔 80、版心最寬 1180，1244 起不再變寬）。
 *
 * @param {number} fileWidth 檔案那一塊的寬（原圖像素，images.json 的 crop.width）
 */
function outlineSizes(fileWidth) {
    const k = (shown) => (fileWidth / shown).toFixed(4);
    return [
        `(min-width: 1244px) ${Math.round(((1180 - 80) / 2) * 0.84 * (fileWidth / OUTLINE_WIDE.width))}px`,
        `(min-width: 1024px) calc((100vw - 144px) * ${(0.42 * fileWidth / OUTLINE_WIDE.width).toFixed(4)})`,
        `(min-width: 640px) calc((100vw - 64px) * ${k(OUTLINE_WIDE.width)})`,
        `calc((100vw - 32px) * ${k(OUTLINE.width)})`,
    ].join(', ');
}

// 資料夾樹的說明欄：檔名欄 13 個字寬（最長的 MATERIAL.md 11 個字＋2 個空白，同設計稿），英文最長那一行 46 個等寬字，桌機的框裡放得下
const pad = (name) => name.padEnd(13);

/**
 * 07 為 AI 做的（規格書 §5-07）：小標與兩句大標橫跨整個內容寬；底下一邊是四點與 AI 工具，一邊是資料夾樹與 AI 交出的大綱圖
 * （1024 起樹在左、字在右；更窄時字在上、樹在下）。伺服器端元件，沒有送到瀏覽器的程式。
 * 資料夾樹跟著捲動一行一行長出來是純 CSS（捲動時間軸）；樹長完之後，public/typing.js 在大綱圖上蓋一層打字層，把圖上那段字逐字打出來
 * （減少動態、關掉 JS 時只有圖）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function ForAI({ lang }) {
    const say = (id) => getPlainString(lang, id);
    const agents = say('forai.agents').split(/、|,\s*/).map((s) => s.trim()).filter(Boolean);
    const lines = [
        [styles.root, say('tree.root')],
        ['', <>└── <b>{say('tree.topic')}</b></>],
        ['', <>{'    ├── '}<em>{pad('MATERIAL.md')}</em><i>{say('tree.material')}</i></>],
        ['', <>{`    ├── ${pad('README.md')}`}<i>{say('tree.readme')}</i></>],
        ['', <>{`    ├── ${pad('index.json')}`}<i>{say('tree.index')}</i></>],
        ['', <>{`    ├── ${pad('assets/')}`}<i>{say('tree.assets')}</i></>],
        ['', `    └── ${say('tree.file')}`],
    ];
    return (
        <section className={styles.forai} data-section="forai" id="for-ai" aria-labelledby="forai-title">
            <div className={`wrap ${styles.in}`}>
                <header className={styles.head}>
                    <p className={styles.eyebrow} data-id="forai.eyebrow"><Seg text={getString(lang, 'forai.eyebrow')} /></p>
                    <h2 className={styles.title} id="forai-title" data-id="forai.title"><Seg text={getString(lang, 'forai.title')} /></h2>
                </header>
                <div className={styles.text}>
                    <ul className={styles.points}>
                        {[1, 2, 3, 4].map((n) => (
                            <li key={n} data-id={`forai.${n}`}><Seg text={getString(lang, `forai.${n}`)} /></li>
                        ))}
                    </ul>
                    <ul className={styles.agents} data-id="forai.agents">
                        {agents.map((name) => <li key={name} className={styles.tag}>{name}</li>)}
                    </ul>
                </div>
                <div className={styles.visual}>
                    <div className={styles.tree} tabIndex={0} role="region" aria-label={say('tree.label')} data-tree="">
                        <pre className={styles.pre}>
                            {lines.map(([kind, content], i) => (
                                <span key={i} className={[styles.ln, kind].filter(Boolean).join(' ')} data-line="">{content}</span>
                            ))}
                        </pre>
                    </div>
                    <Frame className={styles.shot}>
                        <Crop
                            source={`ai-outline-${lang}.png`}
                            show={OUTLINE}
                            wide={OUTLINE_WIDE}
                            alt={say('forai.outline.alt')}
                            sizes={outlineSizes}
                            className={styles.fade}
                        >
                            {/* AI 開始打字（public/typing.js）：蓋在圖上的打字層。讀屏只讀圖的 alt；字在 /<語言>/typing.json，不放進 HTML */}
                            <div className={styles.typing} aria-hidden="true" data-typing="" data-src={`/${lang}/typing.json`}>
                                <div className={styles.typed} data-typed="" />
                            </div>
                        </Crop>
                    </Frame>
                </div>
            </div>
        </section>
    );
}
