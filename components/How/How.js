import { getString, getPlainString } from '../../app/strings.js';
import Seg from '../Seg/Seg.js';
import Band from '../Band/Band.js';
import SectionHead from '../SectionHead/SectionHead.js';
import Frame from '../Frame/Frame.js';
import Crop from '../Crop/Crop.js';
import styles from './How.module.css';

// 第 1、2 張：側邊欄截圖（800 寬的原圖整張，CSS 只裁上下）：檔名、寬度、顯示多寬
const SIDEBAR = [
    { crop: styles.shot1, src: (lang) => `/images/step1-setup-${lang}`, widths: [640, 800], width: 800, height: 1520, sizes: '(min-width: 1280px) 370px, (min-width: 640px) 31vw, 92vw' },
    { crop: styles.shot2, src: (lang) => `/images/step2-saved-${lang}`, widths: [640, 800], width: 800, height: 1520, sizes: '(min-width: 1280px) 370px, (min-width: 640px) 31vw, 92vw' },
];

// 第 3 張：教學片第 13 章 Claude Code 終端機那一格露出的那一塊（原圖 1920×1080 的像素座標；英日的終端機字比較寬）。
// 框貼著終端機視窗（使用者 2026-10-04：框跟圖之間不要那條黑邊）：量過視窗左緣在 x 290、上緣 y 142、下緣 y 786（三語相同），
// 各留 1px：從 (289, 141) 起、高 646；寬照原本的長寬比（中 774:650、英日 798:650，三張框才一樣高），右邊剛好到後端裁好那一塊的右緣
const TERMINAL = { zh: { x: 289, y: 141, width: 769, height: 646 }, en: { x: 289, y: 141, width: 793, height: 646 }, ja: { x: 289, y: 141, width: 793, height: 646 } };

/**
 * 終端機截圖實際畫出來多寬（<img sizes>）：框寬（一欄）× 檔案那一塊的寬 ÷ 露出的寬。
 * 框寬：手機是版心（兩邊各留 16）；640 起三欄（兩邊各留 32、欄間 30）；1024 起欄間 40；版心最寬 1180（1244 起不再變寬）。
 *
 * @param {number} shown 露出的寬（原圖像素）
 * @returns {(fileWidth: number) => string}
 */
const terminalSizes = (shown) => (fileWidth) => {
    const k = fileWidth / shown;
    return [
        `(min-width: 1244px) ${Math.round(((1180 - 80) / 3) * k)}px`,
        `(min-width: 1024px) calc((100vw - 144px) * ${(k / 3).toFixed(4)})`,
        `(min-width: 640px) calc((100vw - 124px) * ${(k / 3).toFixed(4)})`,
        `calc((100vw - 32px) * ${k.toFixed(4)})`,
    ].join(', ');
};

/**
 * 05 三步驟（規格書 §5-05）：小標、大標、一句痛點；01 ── 02 ── 03 一條軌道，每一步是標題、一句、一張截圖（640 起三欄，標題、說明、截圖各自對齊同一條線）。
 * 伺服器端元件。捲進畫面三成時每一步往上浮出（同卡片）。
 *
 * @param {{ lang: 'zh' | 'en' | 'ja' }} props
 */
export default function How({ lang }) {
    const numbers = getPlainString(lang, 'how.step.n').split('／');
    return (
        <Band section="how" id="how">
            <SectionHead lang={lang} prefix="how" id="how-title" lead="how.pain" />
            <ol className={styles.steps}>
                {[1, 2, 3].map((n) => {
                    const side = SIDEBAR[n - 1];
                    return (
                        <li key={n} className={styles.step} data-reveal="">
                            <p className={styles.n} aria-hidden="true"><span>{numbers[n - 1]}</span></p>
                            <h3 className={styles.title} data-id={`how.${n}.title`}><Seg text={getString(lang, `how.${n}.title`)} /></h3>
                            <p className={styles.body} data-id={`how.${n}.body`}><Seg text={getString(lang, `how.${n}.body`)} /></p>
                            <Frame corners={false} className={styles.frame}>
                                {side ? (
                                    <div className={`${styles.crop} ${side.crop}`}>
                                        <img
                                            src={`${side.src(lang)}-${side.widths[1]}.webp`}
                                            srcSet={side.widths.map((w) => `${side.src(lang)}-${w}.webp ${w}w`).join(', ')}
                                            sizes={side.sizes}
                                            alt={getPlainString(lang, `how.${n}.alt`)}
                                            width={side.width}
                                            height={side.height}
                                            loading="lazy"
                                            decoding="async"
                                            fetchPriority="low"
                                        />
                                    </div>
                                ) : (
                                    <Crop
                                        source={`ai-terminal-${lang}.png`}
                                        show={TERMINAL[lang]}
                                        alt={getPlainString(lang, `how.${n}.alt`)}
                                        sizes={terminalSizes(TERMINAL[lang].width)}
                                        className={styles.fade}
                                    />
                                )}
                            </Frame>
                        </li>
                    );
                })}
            </ol>
        </Band>
    );
}
