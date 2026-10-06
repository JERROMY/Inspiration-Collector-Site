// 「/」依語言分流（規格書第 4 節）。放在「/」的 <head>、同步執行：畫面出來之前就跳，不讓三語選單閃一下。
// - 選過語言（語言切換存在 localStorage 的 collector-lang：zh、en、ja）優先；存不了、讀不到、值不認得，就看瀏覽器語言。
// - 瀏覽器語言 zh 開頭（zh-TW、zh-HK、zh-CN…）→ /zh/；ja 開頭 → /ja/；其餘 → /en/。
// - 網址的 ?… 與 #… 原樣帶過去；用 replace，「/」不留在上一頁裡（按上一頁不會又被跳回來）。
// 關掉 JS 時不會跑：「/」就是三語選單。語言頁（/zh/ 這類）不載這一支，永遠不跳。
(function () {
    var path = location.pathname;
    if (path !== '/' && path !== '/index.html') return;

    var LANGS = { zh: true, en: true, ja: true };
    var pick = null;
    try {
        pick = localStorage.getItem('collector-lang');
    } catch (err) {
        // 瀏覽器擋掉 localStorage（隱私設定）：照瀏覽器語言
    }
    if (!LANGS[pick]) {
        var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
        pick = nav.indexOf('zh') === 0 ? 'zh' : nav.indexOf('ja') === 0 ? 'ja' : 'en';
    }

    // 跳轉要一點時間：這段時間不畫「/」的字與圖（components/Solo/Solo.module.css 認 html.redirecting），只看到暗色的底
    document.documentElement.className += ' redirecting';
    location.replace('/' + pick + '/' + location.search + location.hash);
})();
