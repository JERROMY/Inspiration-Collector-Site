/**
 * strings-check.js —— 檢查設計師的字串表：值是不是字串、每一條的標記轉不轉得過、三語的 id 對不對得上、copy.md 的 id 在不在。純函式，不讀檔。
 *
 * 一次把所有問題列出來（每個問題一行，同一行寫到語言檔與 id），不是遇到第一個就停：設計師改一次就能看到全部要修的地方。
 * 標記怎麼轉由呼叫端傳進來的 parse 決定（`npm run strings` 傳的是 lib/segments.js 的 parseSegments），這裡只負責「它丟的錯是哪個語言的哪個 id」。
 */

/**
 * @param {unknown} value 任何值
 * @returns {string} 白話的型別名（寫進訊息）：null、陣列、字串、數字、布林值、物件
 */
export function describeType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '陣列';
    return { string: '字串', number: '數字', boolean: '布林值', object: '物件' }[typeof value] ?? typeof value;
}

/**
 * @param {Record<string, Record<string, unknown>>} loaded 讀得到的語言 → id → 值
 * @returns {string[]} 三語 id 對不上的地方，每個 id 每個語言一行：多數有的、少數沒有，就是「缺」；只有一個語言有的，就是「多了」
 */
function checkIds(loaded) {
    const langs = Object.keys(loaded);
    if (langs.length < 2) return [];
    const problems = [];
    for (const id of new Set(langs.flatMap((lang) => Object.keys(loaded[lang])))) {
        const has = langs.filter((lang) => Object.hasOwn(loaded[lang], id));
        if (has.length === langs.length) continue;
        const lacks = langs.filter((lang) => !has.includes(lang));
        const names = (list) => list.map((lang) => `${lang}.json`).join('、');
        if (has.length * 2 < langs.length) problems.push(`${names(has)} 多了 ${id}（${names(lacks)} 都沒有）`);
        else problems.push(...lacks.map((lang) => `${lang}.json 缺 ${id}（${names(has)} 有）`));
    }
    return problems;
}

/**
 * @param {object} input
 * @param {Record<string, Record<string, unknown> | null>} input.tables 語言 → id → 值；讀不了的語言是 null（原因已經在讀檔時講過，這裡略過）
 * @param {string[] | null} input.copyIds copy.md 文案表的 id；沒給 --copy 是 null（不查）
 * @param {(text: string) => unknown} input.parse 轉一條字，標記寫錯要丟 Error（訊息講出是第幾個字）
 * @returns {string[]} 要修的地方，每個問題一行（空陣列就是全部沒問題）：
 *   值不是字串、標記寫錯、三語 id 不一致（缺的、多的各一行）、copy.md 有而字串表沒有的 id（每個 id 一行，講出缺哪幾個語言）
 */
export function checkStrings({ tables, copyIds, parse }) {
    const problems = [];
    const loaded = Object.fromEntries(Object.entries(tables).filter(([, table]) => table !== null));
    for (const [lang, table] of Object.entries(loaded)) {
        for (const [id, value] of Object.entries(table)) {
            if (typeof value !== 'string') {
                problems.push(`${lang}.json 的 ${id}：值要是字串，得到 ${describeType(value)}`);
                continue;
            }
            try {
                parse(value);
            } catch (err) {
                problems.push(`${lang}.json 的 ${id}：${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
    problems.push(...checkIds(loaded));
    for (const id of copyIds ?? []) {
        const lacks = Object.keys(loaded).filter((lang) => !Object.hasOwn(loaded[lang], id));
        if (lacks.length > 0) problems.push(`copy.md 有 ${id}，字串表的 ${lacks.map((lang) => `${lang}.json`).join('、')} 沒有`);
    }
    return problems;
}
