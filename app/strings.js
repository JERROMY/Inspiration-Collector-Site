// 取字：網站版型裡的字從 strings/<語言>.json（字串表，npm run strings 從設計稿複製進來）取。
// 只在產生網頁時、伺服器端跑（讀檔用 node:fs）；client 元件不要 import 這一支，要字就從 props 拿。
// 不用 JSX：純 Node 也載得起來。
import fs from 'node:fs';
import path from 'node:path';
import { parseSegments } from '../lib/segments.js';

const LANGS = ['zh', 'en', 'ja'];

// 第一次用到時讀進來、整份驗過；之後都用這一份
let table = null;

/**
 * 讀三種語言的字串表，整份驗過：三語的 id 一樣、每一條都是字串、標記都轉得過。
 * 驗不過就丟錯 —— 字串表寫壞時產生網頁一定失敗，哪怕那一條還沒有頁面用到。
 *
 * @returns {Record<'zh' | 'en' | 'ja', Record<string, string>>}
 * @throws {Error} 讀不到、不是 JSON、三語的 id 對不上、某一條標記寫錯（訊息有 id 與語言）
 */
function load() {
    const dir = path.join(process.cwd(), 'strings');
    const data = {};
    for (const lang of LANGS) {
        const file = path.join(dir, `${lang}.json`);
        try {
            data[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）讀不到或不是 JSON：${err.message}`);
        }
    }
    for (const lang of LANGS) {
        for (const id of Object.keys(data.zh)) {
            if (!Object.hasOwn(data[lang], id)) throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）少了 id「${id}」：三種語言的 id 要完全一樣`);
        }
        for (const id of Object.keys(data[lang])) {
            if (!Object.hasOwn(data.zh, id)) throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）多了 id「${id}」：zh 沒有這一條，三種語言的 id 要完全一樣`);
        }
        for (const [id, text] of Object.entries(data[lang])) {
            if (typeof text !== 'string') throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）的 id「${id}」不是字串`);
            try {
                parseSegments(text);
            } catch (err) {
                throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）的 id「${id}」標記寫錯：${err.message}`);
            }
        }
    }
    return data;
}

/**
 * 字串表裡的一條原字（帶標記，交給 components/Seg 畫）。
 *
 * @param {'zh' | 'en' | 'ja'} lang 語言
 * @param {string} id 字串表的 id（例如 'news.title'）
 * @returns {string} 原字
 * @throws {Error} 語言不認得、id 不存在（訊息有 id 與語言），或字串表整份驗不過
 */
export function getString(lang, id) {
    if (!LANGS.includes(lang)) throw new Error(`getString 的語言只收 zh、en、ja，收到「${lang}」（id「${id}」）`);
    table ??= load();
    if (!Object.hasOwn(table[lang], id)) throw new Error(`字串表 strings/${lang}.json（語言 ${lang}）沒有 id「${id}」`);
    return table[lang][id];
}

/**
 * 字串表有沒有這一條。給 id 由使用者的內容決定的地方用（例如社群連結的代號 social.<代號>：使用者新加了代號、字串表還沒有名稱時，不該讓整站產生失敗）。
 *
 * @param {'zh' | 'en' | 'ja'} lang 語言
 * @param {string} id 字串表的 id
 * @returns {boolean}
 * @throws {Error} 語言不認得，或字串表整份驗不過
 */
export function hasString(lang, id) {
    if (!LANGS.includes(lang)) throw new Error(`hasString 的語言只收 zh、en、ja，收到「${lang}」（id「${id}」）`);
    table ??= load();
    return Object.hasOwn(table[lang], id);
}

/**
 * 字串表裡的一條字去掉標記（給 <title> 這類只能放純文字的地方）。
 *
 * @param {'zh' | 'en' | 'ja'} lang 語言
 * @param {string} id 字串表的 id
 * @returns {string} 純文字
 */
export function getPlainString(lang, id) {
    const flatten = (nodes) => nodes.map((node) => (typeof node === 'string' ? node : flatten(node.children))).join('');
    return flatten(parseSegments(getString(lang, id)));
}
