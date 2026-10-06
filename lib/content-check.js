/**
 * content-check.js —— 檢查整個 content/ 資料夾：讀得到嗎、每一條寫對了嗎、三種語言對得上嗎、順序對嗎。
 *
 * 用 4-b1 的 readContent 讀（不自己解析），再整理成三份清單：
 *   problems  要修的：讀不到的檔、寫壞的每一條（行號、原文、原因照 readContent 給的）、三種語言對不上的地方
 *   warnings  提醒、不算錯：不是由新到舊排、公告一則都沒有、公告沒有任何一則置頂、社群代號在字串表沒有名稱（給了字串表資料夾才查）
 *   summary   每支檔讀到幾筆（給命令印摘要）
 * 三語對照以中文（zh）為準，英文（en）、日文（ja）各跟它比；中文那支讀不到時不比（那支自己已經是一條 problem）。
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { readContent } from './content.js';

const LANGS = ['zh', 'en', 'ja'];
const OTHERS = ['en', 'ja'];
const NAMES = { zh: '中文（zh）', en: '英文（en）', ja: '日文（ja）' };
/** 資料夾本身不能用（不存在、不是資料夾）時，丟出的 Error 帶這個 code，命令拿它判斷是用法錯誤。 */
const DIR_ERROR = 'CONTENT_DIR';
const SOCIAL_SKIPPED = '社群連結的名稱沒有檢查';

/**
 * @typedef {{ file: string, line: number | null, raw: string | null, reason: string }} Problem
 * @typedef {{ file: string, message: string }} Warning
 * @typedef {{ file: string, kind: 'changelog' | 'news' | 'links', count: number | null, bad: number }} FileSummary
 *   count 是讀得到的版本／公告／連結有幾個（寫壞的不算：壞紀錄也可能是落單的 --> 或雜字，不是一個版本）；
 *   整支讀不到是 null。bad 是這支檔有幾條 problem（含版本裡寫壞的條目）。
 */

/**
 * 確認 dir 是一個存在的資料夾；不是就丟中文的 Error（code 是 CONTENT_DIR）。
 *
 * @param {string} dir content/ 資料夾的路徑
 * @returns {Promise<void>}
 */
async function requireFolder(dir) {
    let info;
    try {
        info = await stat(dir);
    } catch (err) {
        const why = err.code === 'ENOENT' ? '找不到這個資料夾' : `讀不到這個資料夾（${err.code ?? err.message}）`;
        throw Object.assign(new Error(`${why}：${dir}`, { cause: err }), { code: DIR_ERROR });
    }
    if (!info.isDirectory()) throw Object.assign(new Error(`這是一個檔案，不是資料夾：${dir}`), { code: DIR_ERROR });
}

/**
 * readContent 讀到的壞東西，一筆一條 problem：整支讀不到、壞的版本、版本裡壞的條目、壞的公告、壞的連結。
 *
 * @param {Awaited<ReturnType<typeof readContent>>} content readContent 的結果
 * @returns {Problem[]} 依檔案、檔案裡的順序排
 */
function fileProblems(content) {
    const found = [];
    const badOne = (file, rec) => found.push({ file, line: rec.line, raw: rec.raw, reason: rec.reason });
    const slot = (file, s, each) => {
        if (!s.ok) found.push({ file, line: null, raw: null, reason: s.reason });
        else s.entries.forEach(each);
    };
    for (const lang of LANGS) {
        const file = `changelog.${lang}.md`;
        slot(file, content.changelog[lang], (version) => {
            if (!version.ok) badOne(file, version);
            else version.items.filter((item) => !item.ok).forEach((item) => badOne(file, item));
        });
    }
    for (const lang of LANGS) {
        const file = `news.${lang}.md`;
        slot(file, content.news[lang], (entry) => { if (!entry.ok) badOne(file, entry); });
    }
    slot('links.md', content.links, (entry) => { if (!entry.ok) badOne('links.md', entry); });
    return found;
}

/**
 * 更新紀錄的三語對照：版本號清單（少了、多了、順序）、同一版的日期、每一版的條數（含寫壞的那條）。只比讀得到的好版本。
 *
 * @param {object} changelog readContent 的 changelog（zh、en、ja 三個位置）
 * @returns {string[]} 對不上的原因，一條一句
 */
function changelogMismatches(changelog) {
    if (!changelog.zh.ok) return [];
    const versions = (slot) => slot.entries.filter((v) => v.ok);
    const base = versions(changelog.zh);
    const reasons = [];
    for (const lang of OTHERS) {
        if (!changelog[lang].ok) continue;
        const other = versions(changelog[lang]);
        const name = NAMES[lang];
        const baseIds = base.map((v) => v.version);
        const otherIds = other.map((v) => v.version);
        const missing = baseIds.filter((id) => !otherIds.includes(id));
        const extra = otherIds.filter((id) => !baseIds.includes(id));
        for (const id of missing) reasons.push(`${name}少了 ${id} 這一版（中文有）`);
        for (const id of extra) reasons.push(`${name}多了 ${id} 這一版（中文沒有）`);
        if (missing.length === 0 && extra.length === 0 && otherIds.join() !== baseIds.join()) {
            reasons.push(`${name}的版本順序跟中文不同：中文是 ${baseIds.join('、')}，${name}是 ${otherIds.join('、')}`);
        }
        for (const version of base) {
            const twin = other.find((v) => v.version === version.version);
            if (twin && twin.date !== version.date) {
                reasons.push(`${name}的 ${version.version} 日期是 ${twin.date}，中文是 ${version.date}（三種語言同一版的日期要一樣）`);
            }
            if (twin && twin.items.length !== version.items.length) {
                reasons.push(`${name}的 ${version.version} 有 ${twin.items.length} 條，中文有 ${version.items.length} 條`);
            }
        }
    }
    return reasons;
}

/**
 * 公告的三語對照：則數（含寫壞的）；則數相同時再逐則比日期與置頂（兩邊都是好的那幾則才比）。
 *
 * @param {object} news readContent 的 news（zh、en、ja 三個位置）
 * @returns {string[]} 對不上的原因，一條一句
 */
function newsMismatches(news) {
    if (!news.zh.ok) return [];
    const base = news.zh.entries;
    const reasons = [];
    for (const lang of OTHERS) {
        if (!news[lang].ok) continue;
        const other = news[lang].entries;
        const name = NAMES[lang];
        if (other.length !== base.length) {
            reasons.push(`${name}有 ${other.length} 則公告，中文有 ${base.length} 則`);
            continue;
        }
        base.forEach((a, index) => {
            const b = other[index];
            if (!a.ok || !b.ok) return;
            const nth = `第 ${index + 1} 則`;
            if (a.date !== b.date) reasons.push(`${name}${nth}的日期是 ${b.date}，中文是 ${a.date}`);
            if (a.pinned !== b.pinned) {
                const has = (pinned) => (pinned ? '有' : '沒有');
                reasons.push(`${name}${nth}${has(b.pinned)}置頂，中文${has(a.pinned)}`);
            }
        });
    }
    return reasons;
}

/**
 * 版本號照數字比：a 比 b 新回傳 true。
 *
 * @param {string} a x.y.z
 * @param {string} b x.y.z
 * @returns {boolean} a 比 b 新
 */
function newer(a, b) {
    const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
}

/**
 * 提醒（不算錯）：不是由新到舊排（每支檔一條）、公告一則都沒有、公告沒有任何一則置頂（每支公告檔一條）。
 *
 * @param {Awaited<ReturnType<typeof readContent>>} content readContent 的結果
 * @returns {Warning[]}
 */
function contentWarnings(content) {
    const warnings = [];
    for (const lang of LANGS) {
        const file = `changelog.${lang}.md`;
        const slot = content.changelog[lang];
        if (!slot.ok) continue;
        const list = slot.entries.filter((v) => v.ok).map((v) => v.version);
        const at = list.findIndex((version, i) => i > 0 && !newer(list[i - 1], version));
        if (at > 0) {
            warnings.push({ file, message: `版本不是由新到舊排：最新的要寫在最上面（${list[at - 1]} 下面是 ${list[at]}）` });
        }
    }
    for (const lang of LANGS) {
        const file = `news.${lang}.md`;
        const slot = content.news[lang];
        if (!slot.ok) continue;
        if (slot.entries.length === 0) {
            warnings.push({ file, message: '一則公告都沒有（0 則）：可以這樣，只是提醒' });
            continue;
        }
        const good = slot.entries.filter((n) => n.ok);
        const at = good.findIndex((n, i) => i > 0 && good[i - 1].date < n.date);
        if (at > 0) {
            warnings.push({ file, message: `公告不是由新到舊排：最新的要寫在最上面（${good[at - 1].date} 下面是 ${good[at].date}）` });
        }
        if (good.length > 0 && !good.some((n) => n.pinned)) {
            warnings.push({ file, message: '沒有任何一則置頂：可以這樣，公告條就只顯示 30 天內的最新一則' });
        }
    }
    return warnings;
}

/**
 * 社群連結的名稱：links.md 每一個好的代號，字串表的三種語言都要有 social.<代號>。缺名稱只是警告（不算錯）。
 * 字串表資料夾不在、某一語的檔不在、不是 JSON：各一條警告（那一部分沒檢查），其他語言照常檢查。
 *
 * @param {Awaited<ReturnType<typeof readContent>>} content readContent 的結果
 * @param {string} stringsDir 字串表資料夾（裡面有 zh.json、en.json、ja.json）
 * @returns {Promise<Warning[]>} 缺名稱的代號一個代號一條（列出缺的語言檔名）；讀不到字串表的警告
 */
async function socialWarnings(content, stringsDir) {
    if (!content.links.ok) return [];
    const warn = (message) => ({ file: 'links.md', message });
    try {
        const info = await stat(stringsDir);
        if (!info.isDirectory()) return [warn(`字串表 ${stringsDir} 是一個檔案，不是資料夾，${SOCIAL_SKIPPED}`)];
    } catch (err) {
        return [warn(`${err.code === 'ENOENT' ? '找不到字串表資料夾' : `讀不到字串表資料夾（${err.code ?? err.message}）`}：${stringsDir}，${SOCIAL_SKIPPED}`)];
    }
    const warnings = [];
    const tables = {};
    for (const lang of LANGS) {
        const name = `${lang}.json`;
        try {
            const table = JSON.parse(await readFile(path.join(stringsDir, name), 'utf8'));
            if (Object.prototype.toString.call(table) === '[object Object]') tables[lang] = table;
            else warnings.push(warn(`字串表的 ${name} 最外層要是物件（id → 字串）：${NAMES[lang]}的社群名稱沒有檢查`));
        } catch (err) {
            const why = err.code === 'ENOENT' ? '找不到' : err instanceof SyntaxError ? '不是 JSON' : `讀不了（${err.code ?? err.message}）`;
            warnings.push(warn(`字串表的 ${name} ${why}：${NAMES[lang]}的社群名稱沒有檢查`));
        }
    }
    const has = (lang, id) => typeof tables[lang][id] === 'string' && tables[lang][id].trim() !== '';
    for (const { code } of content.links.entries.filter((entry) => entry.ok)) {
        const id = `social.${code}`;
        const lacks = Object.keys(tables).filter((lang) => !has(lang, id)).map((lang) => `${lang}.json`);
        if (lacks.length > 0) warnings.push(warn(`代號 ${code} 在字串表沒有 ${id}（缺 ${lacks.join('、')}）：請告訴做網站的人加上各語言的名稱`));
    }
    return warnings;
}

/**
 * 每支檔讀到幾筆、有幾條 problem。
 *
 * @param {Awaited<ReturnType<typeof readContent>>} content readContent 的結果
 * @param {Problem[]} problems 檔案的 problems（算每支檔有幾條）
 * @returns {FileSummary[]} 七支檔，順序固定
 */
function summarize(content, problems) {
    const row = (file, kind, slot) => ({
        file,
        kind,
        count: slot.ok ? slot.entries.filter((entry) => entry.ok).length : null,
        bad: problems.filter((p) => p.file === file).length,
    });
    return [
        ...LANGS.map((lang) => row(`changelog.${lang}.md`, 'changelog', content.changelog[lang])),
        ...LANGS.map((lang) => row(`news.${lang}.md`, 'news', content.news[lang])),
        row('links.md', 'links', content.links),
    ];
}

/**
 * 檢查一個 content/ 資料夾。
 *
 * @param {string} dir content/ 資料夾的路徑
 * @param {{ strings?: string }} [options] strings：字串表資料夾（有 zh.json、en.json、ja.json）。給了，就多查 links.md 的代號在字串表有沒有 social.<代號>
 *   （缺了是警告）；沒給就不做這項
 * @returns {Promise<{ ok: boolean, problems: Problem[], warnings: Warning[], summary: FileSummary[] }>}
 *   ok ＝ 沒有 problems（有 warnings 照樣是 true）。
 *   problems 每條 { file, line, raw, reason }：寫壞的條目 file 是檔名、line／raw／reason 照 readContent；
 *   整支讀不到 line、raw 是 null；三語對不上 file 是 'changelog' 或 'news'、line、raw 是 null。
 *   warnings 每條 { file, message }。
 * @throws {Error} dir 不存在或不是資料夾（訊息是中文，err.code 是 'CONTENT_DIR'）
 */
export async function checkContent(dir, { strings } = {}) {
    await requireFolder(dir);
    const content = await readContent(dir);
    const found = fileProblems(content);
    const cross = [
        ...changelogMismatches(content.changelog).map((reason) => ({ file: 'changelog', line: null, raw: null, reason })),
        ...newsMismatches(content.news).map((reason) => ({ file: 'news', line: null, raw: null, reason })),
    ];
    const problems = [...found, ...cross];
    return {
        ok: problems.length === 0,
        problems,
        warnings: [...contentWarnings(content), ...(strings === undefined ? [] : await socialWarnings(content, strings))],
        summary: summarize(content, found),
    };
}
