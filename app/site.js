// 網站各處共用、不翻譯的值。

// 網站的正式網址（結尾有 /；分享、寄給自己用這個，不用看的人當下的網址）
export const SITE_URL = 'https://collector.jerromy.com/';

// GoatCounter（數人次，規格書 §11）的站台代碼：https://<代碼>.goatcounter.com。空字串＝還沒開帳號，網頁不載入它、不送任何請求
export const GOATCOUNTER_CODE = '';

// 教學影片在 YouTube 上的 ID（一語一支）。空字串＝那一語還沒上 YouTube：09 不放播放鈕與「在 YouTube 上看」，大標換成 tutorial.title.noid，章節只能看摘要
export const TUTORIAL_VIDEO_IDS = { zh: '5phNHGmGRgc', en: '', ja: '' };

// 12 更新紀錄從這一版開始列（含這一版）：比它舊的版本，內容檔裡就算有、網站也不列（收合裡也不放）。
// 使用者 2026-10-02 決定不列 1.0.3（1.0.3 是第一個公開版本，沒有「改了什麼」可講）；規格書 §5-12 原本寫「從 1.0.3 開始」，以這裡為準。
// 只寫在這裡：components/Changelog 用 app/changelog.js 的 listed() 篩，不在別處另寫版本號
export const CHANGELOG_FROM = '1.0.4';

// Chrome 線上應用程式商店的網址（PUBLISH.md 開頭的擴充 ID）
export const STORE_URL = 'https://chromewebstore.google.com/detail/fmggdnlabihonmakkgcdenfmcmebmmol';

// 頁面上各區的錨點（導覽列與 ☰ 選單的六個連結，照這個順序）
export const SECTIONS = [
    { id: 'nav.features', hash: '#features' },
    { id: 'nav.tutorial', hash: '#tutorial' },
    { id: 'nav.devices', hash: '#devices' },
    { id: 'nav.news', hash: '#news' },
    { id: 'nav.changelog', hash: '#changelog' },
    { id: 'nav.faq', hash: '#faq' },
];
