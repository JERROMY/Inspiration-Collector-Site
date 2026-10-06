/* 測試用的假資料：只有 4 章（結構跟 project/ 那份一樣）。用來量「章數不是 16 要報錯」。 */
window.TUTORIAL_CHAPTERS = {
    clips: ['00-intro', '01-fake', '02-fake', '03-fake', '04-fake', '99-end'],
    zh: {
        intro: { name: '開頭', desc: '開頭的說明' },
        end: { name: '結尾', desc: '結尾的說明' },
        list: [
            { name: '裝起來', line: '假的一句 01。',
              desc: '假的摘要 01：按「存這頁」，\'單引號\' 與 "雙引號" 都留著。' },
            { name: '打開側欄', line: '假的一句 02。',
              desc: '假的摘要 02：按「存這頁」，\'單引號\' 與 "雙引號" 都留著。' },
            { name: '存網頁', line: '假的一句 03。',
              desc: '假的摘要 03：按「存這頁」，\'單引號\' 與 "雙引號" 都留著。' },
            { name: '存文字', line: '假的一句 04。',
              desc: '假的摘要 04：按「存這頁」，\'單引號\' 與 "雙引號" 都留著。' },
        ],
    },
    en: {
        intro: { name: 'Opening', desc: 'Opening的說明' },
        end: { name: 'Ending', desc: 'Ending的說明' },
        list: [
            { name: 'Install', line: 'Fake line 01.',
              desc: 'Fake summary 01: click “Save page” — it\'s fine.' },
            { name: 'Open the panel', line: 'Fake line 02.',
              desc: 'Fake summary 02: click “Save page” — it\'s fine.' },
            { name: 'Save a page', line: 'Fake line 03.',
              desc: 'Fake summary 03: click “Save page” — it\'s fine.' },
            { name: 'Save text', line: 'Fake line 04.',
              desc: 'Fake summary 04: click “Save page” — it\'s fine.' },
        ],
    },
    ja: {
        intro: { name: 'オープニング', desc: 'オープニング的說明' },
        end: { name: 'エンディング', desc: 'エンディング的說明' },
        list: [
            { name: 'インストール', line: '仮の一文 01。',
              desc: '仮の要約 01：「ページを保存」を押します。' },
            { name: 'パネルを開く', line: '仮の一文 02。',
              desc: '仮の要約 02：「ページを保存」を押します。' },
            { name: 'ページ保存', line: '仮の一文 03。',
              desc: '仮の要約 03：「ページを保存」を押します。' },
            { name: '文章保存', line: '仮の一文 04。',
              desc: '仮の要約 04：「ページを保存」を押します。' },
        ],
    },
};
