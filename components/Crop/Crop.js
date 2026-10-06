import { imageSet } from '../../app/images.js';
import styles from './Crop.module.css';

/**
 * Crop —— 一張截圖只露出原圖的某一塊（設計稿決定露出哪一塊，用原圖的像素座標寫）。
 * 檔案是後端裁好的那一塊（public/images/images.json 的 crop，各邊多留一點）；這裡照「要露出的那一塊」跟「檔案是哪一塊」差多少往回移、放大。
 * 寬高、檔名、寬度全部從 images.json 讀。框的長寬比照要露出的那一塊（不讓版面跳）。
 *
 * @param {{ source: string, show: { x: number, y: number, width: number, height: number },
 *   wide?: { x: number, y: number, width: number, height: number }, alt: string, sizes: (fileWidth: number) => string, className?: string,
 *   children?: import('react').ReactNode }} props
 *   source：images.json 的鍵；show：要露出的那一塊（原圖像素）；wide：640 起換成這一塊（給了才換）；
 *   sizes：給「檔案那一塊的寬」，回傳 <img sizes>（圖實際畫出來的寬，不是框寬）；className：外面要加的樣式（例如右邊淡出）；
 *   children：疊在圖上、跟露出的那一塊同位置同大小的東西（07 的打字層），放在圖後面
 */
export default function Crop({ source, show, wide, alt, sizes, className, children }) {
    const set = imageSet(source);
    const crop = set.crop ?? { x: 0, y: 0, width: set.width, height: set.height };
    const largest = set.files[set.files.length - 1];
    const vars = (suffix, area) => ({ [`--cx${suffix}`]: area.x, [`--cy${suffix}`]: area.y, [`--cw${suffix}`]: area.width, [`--ch${suffix}`]: area.height });
    const style = { '--sw': crop.width, '--ox': crop.x, '--oy': crop.y, ...vars('-s', show), ...(wide ? vars('-w', wide) : {}) };
    return (
        <div className={[styles.crop, wide && styles.switch, className].filter(Boolean).join(' ')} style={style}>
            <img
                src={largest.src}
                srcSet={set.files.map((f) => `${f.src} ${f.width}w`).join(', ')}
                sizes={sizes(crop.width)}
                alt={alt}
                width={largest.width}
                height={largest.height}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
            />
            {children}
        </div>
    );
}
