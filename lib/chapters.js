/**
 * chapters.js —— 教學章節轉換：把教學片的章名摘要（tutorial/chapters.js）與時間表（timetable-<語言>.txt）
 * 合成網站 09 教學影片區要用的章節資料。
 *
 * 三個函式各做一件事，錯誤一律用 Error 講到哪一語言、哪一章或哪一行，不靜靜產出：
 * - parseTimetable    一份時間表（一行「m:ss 標題」）→ { start（秒）, title }
 * - loadChaptersScript  跑 tutorial/chapters.js（在只有空 window 的 node:vm 沙箱裡）→ window.TUTORIAL_CHAPTERS
 * - buildChapters     章名摘要＋三語時間表 → 三語各 16 章 { id, name, desc, start, end }
 *
 * 時間表的規矩：第一行是「開頭」、最後一行是「結尾」，中間 16 行才是章（標題要寫「01 章名」）。
 * 開頭那幾秒併進第 1 章（第 1 章從 0 起），結尾卡不列成一章（第 16 章結束在結尾那一行的時間）。
 * 讀檔與寫檔是 scripts/chapters.mjs 的事，這裡只收字串。
 */
import vm from 'node:vm';

const LANGS = ['zh', 'en', 'ja'];
const LANG_NAMES = { zh: '中文', en: '英文', ja: '日文' };
const CHAPTER_COUNT = 16;
const SCRIPT_TIMEOUT_MS = 1000;
const SCRIPT_NAME = 'tutorial/chapters.js';
const NUMBERED_TITLE = /^([0-9]{2})\s+(.+)$/;

/**
 * @param {string} lang zh、en 或 ja
 * @returns {string} 寫進錯誤訊息的語言名稱，例如「中文（zh）」
 */
function langLabel(lang) {
    return `${LANG_NAMES[lang]}（${lang}）`;
}

/**
 * @param {number} seconds 秒數
 * @returns {string} m:ss（分鐘可以多位數），寫進錯誤訊息用
 */
function clock(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * 時間表那一行最前面的時間：m:ss（分鐘可以多位數）或 h:mm:ss；秒與 h:mm:ss 的分都要兩位數、00 到 59。
 *
 * @param {string} token 時間的字
 * @returns {number | null} 秒數；格式不對是 null
 */
function toSeconds(token) {
    const parts = token.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    const [head, ...rest] = parts;
    if (!/^[0-9]+$/.test(head)) return null;
    if (!rest.every((part) => /^[0-9]{2}$/.test(part) && Number(part) < 60)) return null;
    return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/**
 * 讀一份時間表。空白行略過（行號照算）；開頭與結尾那兩行也在回傳裡。
 *
 * @param {string} text timetable-<語言>.txt 的內容；一行「時間 標題」，時間見 toSeconds
 * @returns {{ start: number, title: string }[]} 依檔案順序；title 是時間後面的整段（去頭尾空白，含編號，例如 '01 安裝到 Chrome'）
 * @throws {TypeError} text 不是字串
 * @throws {Error} 某一行缺時間、時間格式不對、只有時間沒有標題、時間沒有比上一行晚（倒退或相同）；訊息有「第 N 行」與那一行原文
 */
export function parseTimetable(text) {
    if (typeof text !== 'string') throw new TypeError(`parseTimetable 只收字串，收到 ${typeof text}`);
    const rows = [];
    text.split('\n').forEach((source, index) => {
        const raw = source.trim();
        if (raw === '') return;
        const fail = (why) => new Error(`第 ${index + 1} 行有問題：${why}（原文：「${raw}」）`);
        const space = raw.search(/\s/);
        const start = toSeconds(space < 0 ? raw : raw.slice(0, space));
        const title = space < 0 ? '' : raw.slice(space).trim();
        if (start === null) throw fail('開頭要是時間，寫成 m:ss 或 h:mm:ss（秒要兩位數）');
        if (title === '') throw fail('時間後面沒有標題');
        const previous = rows[rows.length - 1];
        if (previous && start <= previous.start) throw fail(`時間沒有比上一行（${clock(previous.start)}）晚`);
        rows.push({ start, title });
    });
    return rows;
}

/**
 * 檢查 TUTORIAL_CHAPTERS 的形狀：三種語言各有 list 陣列，每一章的 name、desc 是字串。
 *
 * @param {object} chapters window.TUTORIAL_CHAPTERS
 * @returns {void}
 * @throws {Error} 形狀不對，訊息講到壞在哪裡（語言、list、name、desc）
 */
function checkShape(chapters) {
    if (chapters === null || typeof chapters !== 'object') throw new Error(`${SCRIPT_NAME} 沒有設定 window.TUTORIAL_CHAPTERS（或它不是物件）`);
    for (const lang of LANGS) {
        const entry = chapters[lang];
        if (entry === null || typeof entry !== 'object') throw new Error(`TUTORIAL_CHAPTERS 少了${langLabel(lang)}這一種語言`);
        if (!Array.isArray(entry.list)) throw new Error(`TUTORIAL_CHAPTERS.${lang}.list 不是陣列（${langLabel(lang)}）`);
        entry.list.forEach((item, index) => {
            for (const field of ['name', 'desc']) {
                if (typeof item?.[field] !== 'string') {
                    throw new Error(`${langLabel(lang)}第 ${index + 1} 章的 ${field} 不是字串（TUTORIAL_CHAPTERS.${lang}.list）`);
                }
            }
        });
    }
}

/**
 * 在沙箱裡跑一段程式，同樣的逾時；出錯或逾時都變成講得出原因的 Error。
 *
 * @param {string} code 要跑的程式
 * @param {object} context vm.createContext 做出來的沙箱
 * @param {string} what 這一步在做什麼（寫進錯誤訊息，例如「跑不起來」）
 * @returns {unknown} 程式最後一個運算式的值
 * @throws {Error} 語法錯誤、執行出錯或逾時
 */
function runInSandbox(code, context, what) {
    try {
        return vm.runInContext(code, context, { timeout: SCRIPT_TIMEOUT_MS, filename: SCRIPT_NAME });
    } catch (err) {
        const timedOut = err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
        const why = timedOut ? `逾時，超過 ${SCRIPT_TIMEOUT_MS} 毫秒還沒跑完（timed out）` : (err?.message ?? String(err));
        throw new Error(`${SCRIPT_NAME} ${what}：${why}`, { cause: err });
    }
}

/**
 * 跑 tutorial/chapters.js，拿到 window.TUTORIAL_CHAPTERS。
 * 在 node:vm 沙箱裡跑，沙箱裡只有一個空的 window（沒有 process、require、module、Buffer），並設逾時；
 * 沙箱防的是「跑不完」與「意外用到 Node 的東西」，不是安全邊界（那份檔是我們自己的）。
 * 拿 TUTORIAL_CHAPTERS 也在沙箱裡做（JSON.stringify，同樣設逾時）：放在 getter 或 Proxy 裡的無窮迴圈一樣會逾時，
 * 回傳的是外面 JSON.parse 出來的一般物件，不是沙箱裡的東西。
 *
 * @param {string} sourceText tutorial/chapters.js 的內容
 * @returns {object} window.TUTORIAL_CHAPTERS 的內容（一般物件；函式、undefined 這類 JSON 帶不走的東西不在裡面）
 * @throws {TypeError} sourceText 不是字串
 * @throws {Error} 語法錯誤、執行出錯、逾時，或沒有 TUTORIAL_CHAPTERS、轉不成 JSON、少一種語言、list 不是陣列、某章的 name 或 desc 不是字串
 */
export function loadChaptersScript(sourceText) {
    if (typeof sourceText !== 'string') throw new TypeError(`loadChaptersScript 只收字串，收到 ${typeof sourceText}`);
    // afterEvaluate：Promise 的後續工作也算在逾時裡，不會跑到沙箱外面才卡住
    const context = vm.createContext({ window: {} }, { microtaskMode: 'afterEvaluate' });
    runInSandbox(sourceText, context, '跑不起來');
    const json = runInSandbox('JSON.stringify(window.TUTORIAL_CHAPTERS)', context, '讀 window.TUTORIAL_CHAPTERS 時出錯（getter 丟錯、跑不完，或轉不成 JSON）');
    if (typeof json !== 'string') throw new Error(`${SCRIPT_NAME} 沒有設定 window.TUTORIAL_CHAPTERS（或它是函式、undefined 這類轉不成 JSON 的東西）`);
    const chapters = JSON.parse(json);
    checkShape(chapters);
    return chapters;
}

/**
 * 一個語言：檢查章數與時間表，合成 16 章。
 *
 * @param {string} lang zh、en 或 ja
 * @param {{ name: string, desc: string }[]} list tutorial/chapters.js 這個語言的 list
 * @param {string | undefined} timetable 這個語言的時間表原文
 * @returns {{ id: string, name: string, desc: string, start: number, end: number }[]} 16 章
 * @throws {Error} 少時間表、章數不是 16、時間表格式壞掉、編號或章名對不上；訊息講到語言與第 N 章或第 N 行
 */
function buildLang(lang, list, timetable) {
    const label = langLabel(lang);
    if (list.length !== CHAPTER_COUNT) throw new Error(`${label}：${SCRIPT_NAME} 有 ${list.length} 章，要剛好 ${CHAPTER_COUNT} 章`);
    if (typeof timetable !== 'string') throw new Error(`${label}：缺時間表（timetable-${lang}.txt）`);
    let rows;
    try {
        rows = parseTimetable(timetable);
    } catch (err) {
        throw new Error(`${label}時間表：${err.message}`, { cause: err });
    }
    if (rows.length > 0 && rows[0].start !== 0) {
        const first = timetable.split('\n').map((source, index) => ({ number: index + 1, raw: source.trim() })).find((row) => row.raw !== '');
        throw new Error(`${label}時間表第 ${first.number} 行（開頭）：時間要是 0:00，寫成 ${clock(rows[0].start)}（原文：「${first.raw}」）`);
    }
    if (rows.length !== CHAPTER_COUNT + 2) {
        throw new Error(`${label}時間表有 ${rows.length} 行，要剛好 ${CHAPTER_COUNT + 2} 行（開頭＋${CHAPTER_COUNT} 章＋結尾）`);
    }
    return list.map((item, index) => {
        const id = String(index + 1).padStart(2, '0');
        const where = `${label}時間表第 ${index + 1} 章`;
        const title = rows[index + 1].title;
        const numbered = NUMBERED_TITLE.exec(title);
        if (!numbered) throw new Error(`${where}：標題沒有寫編號，要寫成「${id} 章名」（原文：「${title}」）`);
        if (numbered[1] !== id) throw new Error(`${where}：編號寫成 ${numbered[1]}，要是 ${id}（原文：「${title}」）`);
        const bare = (text) => text.replace(/\s+/g, '');
        if (bare(numbered[2]) !== bare(item.name)) {
            throw new Error(`${where}：章名對不上 ${SCRIPT_NAME}（時間表寫「${numbered[2]}」，章名是「${item.name}」）`);
        }
        const start = index === 0 ? 0 : rows[index + 1].start;
        return { id, name: item.name, desc: item.desc, start, end: rows[index + 2].start };
    });
}

/**
 * 合成三個語言各 16 章的資料。以中文的時間為準，其他語言的每一章起訖都要跟它一樣。
 *
 * @param {object} input
 * @param {object} input.chapters loadChaptersScript 的回傳（三種語言各有 list）
 * @param {{ zh: string, en: string, ja: string }} input.timetables 三份時間表的原文（字串）
 * @returns {{ zh: object[], en: object[], ja: object[] }} 每個語言 16 章 { id, name, desc, start（秒）, end（秒）}，欄位依這個順序；
 *   id 是 '01' 到 '16'；name、desc 是 tutorial/chapters.js 的原樣；每章 end ＝ 下一章 start
 * @throws {Error} 章數不是 16、少時間表、時間表格式壞掉、編號或章名對不上、三語時間不同；訊息講到語言與第 N 章或第 N 行
 */
export function buildChapters({ chapters, timetables }) {
    checkShape(chapters);
    const built = Object.fromEntries(LANGS.map((lang) => [lang, buildLang(lang, chapters[lang].list, timetables?.[lang])]));
    for (const lang of LANGS.slice(1)) {
        built[lang].forEach((chapter, index) => {
            const base = built.zh[index];
            if (chapter.start === base.start && chapter.end === base.end) return;
            throw new Error(`${langLabel(lang)}第 ${index + 1} 章的時間（${clock(chapter.start)}–${clock(chapter.end)}）`
                + `跟${langLabel('zh')}（${clock(base.start)}–${clock(base.end)}）不同；三種語言的時間要逐章相同`);
        });
    }
    return built;
}
