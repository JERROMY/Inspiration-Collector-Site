/**
 * fallback-fonts.js —— 回退字型（Google Sans Flex 還沒下載好時先用 Arial 畫的字型）的純函式：分組、寫 @font-face、整份 CSS。純函式：不碰檔案、不碰瀏覽器、不讀時間。
 *
 * 做法：量每個字在 Google Sans Flex 與 Arial 的寬度比（量字寬的是 `npm run fallback-fonts`，在瀏覽器裡量，那一段不在這裡），
 * 照「字級×字重」分組，每一組裡寬度比相近的字（差 2% 以內）收成一個 @font-face：unicode-range 是那幾個字、size-adjust 是它們的平均比。
 * size-adjust 夾在 85%～120%（空白看不見，不夾，自己一個 @font-face），不然「1」要縮到 66%、「[」「]」要放大到 147%，回退的那一下這幾個字會明顯比旁邊大或小。
 * 再照語言微調的幾組（係數乘在基本組上）接在後面。輸入的順序怎麼打亂，輸出都一樣；輸出裡沒有日期與路徑，所以同一台機器重跑位元組相同。
 */

const SPACE = 0x20;
/** 回退字型的 font-family 名字（基本組後面加字級的後綴） */
export const BASE_FAMILY = 'Google Sans Flex Fallback';
const SOURCE_FAMILY = 'Google Sans Flex';
// 字重 → CSS 的字重範圍與 local() 的來源（600 用粗體）
const WEIGHTS = {
    400: { range: '100 449', src: 'local("Arial"), local("ArialMT"), local("Helvetica"), local("Liberation Sans")' },
    500: { range: '450 599', src: 'local("Arial"), local("ArialMT"), local("Helvetica"), local("Liberation Sans")' },
    600: { range: '600 900', src: 'local("Arial Bold"), local("Arial-BoldMT"), local("Helvetica Bold"), local("Helvetica-Bold"), local("Liberation Sans Bold")' },
};
// Google Sans Flex 的 ascent／descent（行距 0）：除以 size-adjust，行高才不變
const ASCENT = 96.6;
const DESCENT = 28.6;
const SIZE_ADJUST_LINE = /size-adjust: ([\d.]+)%; ascent-override: [\d.]+%; descent-override: [\d.]+%;/;

/**
 * 把字照寬度比分組：比例先夾到 [min, max]，由小到大排，跟那一組第一個（最小的）字比，差在 tolerance 以內就收進去，否則開新的一組。
 * 不夾的字（預設只有空白）各自一組，照碼位排在最後。
 *
 * @param {Array<[number, number]>} ratios [碼位, 比例]，比例＝Google Sans Flex 的字寬 ÷ Arial 的字寬；順序不拘
 * @param {{ tolerance?: number, min?: number, max?: number, exempt?: number[] }} [options] tolerance 預設 0.02、夾的範圍預設 0.85～1.2、exempt（不夾、自己一組）預設 [0x20]
 * @returns {Array<{ codes: number[], ratio: number }>} 每組的字（由小到大）與比例（夾過的比例的幾何平均）
 */
export function groupGlyphs(ratios, { tolerance = 0.02, min = 0.85, max = 1.2, exempt = [SPACE] } = {}) {
    const alone = new Set(exempt);
    const clamped = ratios.filter(([code]) => !alone.has(code)).map(([code, ratio]) => [code, Math.min(max, Math.max(min, ratio))]);
    clamped.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const bins = [];
    for (const item of clamped) {
        const last = bins[bins.length - 1];
        if (last && item[1] / last[0][1] <= 1 + tolerance) last.push(item);
        else bins.push([item]);
    }
    const groups = bins.map((bin) => ({
        codes: bin.map(([code]) => code).sort((a, b) => a - b),
        ratio: Math.exp(bin.reduce((sum, [, ratio]) => sum + Math.log(ratio), 0) / bin.length),
    }));
    const lone = ratios.filter(([code]) => alone.has(code)).sort((a, b) => a[0] - b[0]).map(([code, ratio]) => ({ codes: [code], ratio }));
    return [...groups, ...lone];
}

/**
 * @param {number[]} codes 碼位，順序不拘、可以重複
 * @returns {string} unicode-range 的寫法：由小到大、去重複，連續的寫成 U+3A-3B（後半不加 U+），其他 U+2C；大寫十六進位、不補零；「, 」接起來
 */
export function unicodeRange(codes) {
    const sorted = [...new Set(codes)].sort((a, b) => a - b);
    const hex = (code) => code.toString(16).toUpperCase();
    const parts = [];
    for (let i = 0; i < sorted.length; i += 1) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
        parts.push(j > i ? `U+${hex(sorted[i])}-${hex(sorted[j])}` : `U+${hex(sorted[i])}`);
        i = j;
    }
    return parts.join(', ');
}

/**
 * @param {string} text unicode-range 的值，例如 "U+0020-007E, U+00A7"
 * @returns {number[]} 展開的碼位，由小到大
 * @throws {Error} 看不懂的寫法（只認 U+XXXX 與 U+XXXX-YYYY）
 */
export function expandUnicodeRange(text) {
    const codes = [];
    for (const part of text.split(',').map((item) => item.trim()).filter(Boolean)) {
        const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part);
        if (!match) throw new Error(`看不懂的 unicode-range：${part}`);
        const from = parseInt(match[1], 16);
        const to = match[2] ? parseInt(match[2], 16) : from;
        for (let code = from; code <= to; code += 1) codes.push(code);
    }
    return codes.sort((a, b) => a - b);
}

/**
 * 一個 @font-face，寫成一行。
 *
 * @param {{ family: string, weight: 400 | 500 | 600, codes: number[], sizeAdjust: number }} face sizeAdjust 是百分比（85.4 的意思是 85.4%），沒四捨五入的
 * @returns {string} 一行 @font-face：size-adjust 一位小數；ascent-override／descent-override ＝ 96.6／28.6 除以沒四捨五入的 size-adjust，兩位小數；line-gap-override 0%
 * @throws {Error} 字重不是 400、500、600
 */
export function fontFaceRule({ family, weight, codes, sizeAdjust }) {
    const spec = WEIGHTS[weight];
    if (!spec) throw new Error(`字重只認 400、500、600，收到 ${weight}`);
    return `@font-face { font-family: "${family}"; src: ${spec.src}; font-weight: ${spec.range}; unicode-range: ${unicodeRange(codes)}; `
        + `size-adjust: ${sizeAdjust.toFixed(1)}%; ascent-override: ${(ASCENT / sizeAdjust * 100).toFixed(2)}%; descent-override: ${(DESCENT / sizeAdjust * 100).toFixed(2)}%; line-gap-override: 0%; }`;
}

/**
 * 微調組：從基本組裡挑出某一組（family＋字重範圍），整組的 size-adjust 乘上係數，換成新的 family 名。
 *
 * @param {string[]} baseLines 基本組的 @font-face（fontFaceRule 寫的那種一行）
 * @param {{ family: string, from: string, weight: string, k: number, spaceK?: number }} factor
 *   family：新的 family 名；from：來源組的 family；weight：來源組的字重範圍（"100 449"）；k：係數；spaceK：空白那一行另外再乘的係數（預設 1）
 * @returns {string[]} 新的 @font-face，照來源組原本的順序；size-adjust 兩位小數，ascent／descent 跟著算；來源組不存在是空陣列
 */
export function scaleFaces(baseLines, { family, from, weight, k, spaceK = 1 }) {
    return baseLines
        .filter((line) => line.includes(`font-family: "${from}";`) && line.includes(`font-weight: ${weight};`))
        .map((line) => line.replace(`font-family: "${from}";`, `font-family: "${family}";`).replace(SIZE_ADJUST_LINE, (_, old) => {
            const value = Number(old) * k * (line.includes('unicode-range: U+20;') ? spaceK : 1);
            return `size-adjust: ${value.toFixed(2)}%; ascent-override: ${(ASCENT / value * 100).toFixed(2)}%; descent-override: ${(DESCENT / value * 100).toFixed(2)}%;`;
        }));
}

/**
 * @param {number} base 基本組的 @font-face 有幾個
 * @param {number} micro 微調組有幾個
 * @returns {string} 檔頭註解：為什麼這樣做、怎麼重新產生（沒有日期與路徑）
 */
function headerComment(base, micro) {
    return `/* 回退字型：${SOURCE_FAMILY}（網頁字型）還沒下載好時，英數字先用 Arial（mac、Windows 都有；Helvetica、Liberation Sans 與它同寬）畫。
   目標是字型換上來時每一段字的行數不變、字的位置幾乎不動 —— 行數一變，底下整頁都被推動（CLS）。

   為什麼一個字一個字對：${SOURCE_FAMILY} 跟 Arial 的字寬比，每個字都不一樣，而且跟著光學尺寸（＝字級）、字重變。
   整套字只用一個 size-adjust 的話，平均對得準，但每一段字的字母組成不同，總有某些寬度剛好卡在換行邊緣，多一行或少一行。
   所以照「字級×字重」分組（每一組一個 font-family），每一組再把寬度比相近的字（最寬最窄差 2% 以內）收成一個 @font-face：
   unicode-range 是那幾個字、size-adjust 是它們的平均比。

   size-adjust 夾在 85%～120%：它放大縮小的是整個字形，照字寬對的話「1」要縮到 66%、「[」「]」要放大到 147%，
   回退的那一下這幾個字會明顯比旁邊大或小。超出的字夾到邊上，換來字的大小差不多，代價是這幾個字回退時略寬或略窄。
   空白看不見，不夾，而且自己一個 @font-face（微調組可以單獨調它的寬）。

   怎麼量：Chromium 裡每個字重複 40 次、關掉字距調整（font-kerning: none），量 ${SOURCE_FAMILY} 與 Arial（粗體對 Arial Bold）的寬度比；
   光學尺寸照那一組的用法（opsz 是數字就固定，"auto" 就跟字級走）。
   ascent／descent ＝ ${SOURCE_FAMILY} 的 ${ASCENT}%／${DESCENT}%（行距 0）除以 size-adjust，行高不變。
   這一份：照字級×字重 ${base} 個，加上檔尾照語言微調的幾段字 ${micro} 個，共 ${base + micro} 個 @font-face。

   重新產生：npm run fallback-fonts（步驟、何時要重跑、量的是這台機器的 Arial 所以不同機器的結果可能不同，見 README.md 的 fallback-fonts 一節）。
   手改數字會讓某些寬度開始跳。 */`;
}

const MICRO_COMMENT = `/* 照語言微調的那幾段字（同一組的每一個字乘上同一個係數，空白可以另外乘）：有些段落的某些寬度剛好卡在換行邊緣。
   係數在 scripts/fallback-fonts.config.json 的 factors；用 npm run fallback-sweep 掃，挑「換字型前後每一段字的行數都一樣」的值。 */`;

/**
 * 整份回退字型 CSS：開頭說明，基本組（照 roles 的順序、每組照列的字重），再接微調組（照 factors 的順序）。
 *
 * @param {object} input
 * @param {Array<{ suffix: string, weights: Array<400 | 500 | 600> }>} input.roles 字級×字重：family 是 "Google Sans Flex Fallback" 加 suffix
 * @param {Array<{ family: string, from: string, weight: string, k: number, spaceK?: number }>} input.factors 微調係數（見 scaleFaces）
 * @param {Array<{ family: string, weight: number, ratios: Array<[number, number]> }>} input.measurements 每一組（family＋字重）量到的 [碼位, 寬度比]；順序不拘
 * @returns {string} CSS，換行結尾；measurements 與 ratios 的順序打亂，結果位元組相同
 * @throws {Error} 少了某一組的量測、或係數指到不存在的組（訊息講出是哪一組）
 */
export function renderFallbackCss({ roles, factors, measurements }) {
    const base = [];
    for (const { suffix, weights } of roles) {
        const family = `${BASE_FAMILY}${suffix}`;
        for (const weight of weights) {
            const measured = measurements.find((item) => item.family === family && item.weight === weight);
            if (!measured) throw new Error(`少了「${family}」字重 ${weight} 的量測`);
            for (const group of groupGlyphs(measured.ratios)) base.push(fontFaceRule({ family, weight, codes: group.codes, sizeAdjust: group.ratio * 100 }));
        }
    }
    const micro = [];
    for (const factor of factors) {
        const lines = scaleFaces(base, factor);
        if (lines.length === 0) throw new Error(`係數「${factor.family}」指到不存在的組：「${factor.from}」字重 ${factor.weight}`);
        micro.push(...lines);
    }
    return `${headerComment(base.length, micro.length)}\n\n${base.join('\n')}\n\n${MICRO_COMMENT}\n${micro.join('\n')}\n`;
}

/**
 * @param {string} css fonts.css 的內容
 * @returns {number[]} "Google Sans Flex" 那一個 @font-face 的 unicode-range 展開成碼位，由小到大（網頁字型負責的字，也就是回退字型要收的字）
 * @throws {Error} 沒有 "Google Sans Flex" 的 @font-face、或它沒有 unicode-range
 */
export function charsFromFontsCss(css) {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
        const family = /font-family\s*:\s*([^;]+);/.exec(match[1])?.[1].trim().replace(/^["']|["']$/g, '');
        if (family !== SOURCE_FAMILY) continue;
        const range = /unicode-range\s*:\s*([^;]+);/.exec(match[1])?.[1];
        if (!range) throw new Error(`fonts.css 裡「${SOURCE_FAMILY}」的 @font-face 沒有 unicode-range`);
        return expandUnicodeRange(range);
    }
    throw new Error(`fonts.css 裡找不到「${SOURCE_FAMILY}」的 @font-face`);
}
