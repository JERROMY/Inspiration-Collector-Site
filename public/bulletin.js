// 02 公告條：挑哪一則、按 ✕ 收起（規格書第 5 節 02、第 7 節）。
//
// 一般的腳本（不是模組），在 <head> 裡用 <script src="/bulletin.js"> 同步載入：畫面畫出來之前就決定要不要出現、出現哪一則，
// 版面不會跳。網頁是事先產生的，產生那天的日期會過期，所以「30 天內」要在看的人的瀏覽器裡、用他的當地日期判斷。
// 讀 <head> 的 <meta name="collector-bulletin" content='[{ id, date, pinned }…]'>（components/Bulletin 產生）。
//
// 同一支檔在 Node 裡 import 也載得起來（沒有 document 就不碰畫面）：產生網頁時用同一個 pick 挑沒有 JS 時看到的那條。
//
// localStorage：collector-bulletin-dismissed（按過 ✕、或已經顯示過的 id 陣列）。存不了（隱私模式、被擋掉）就只在這次瀏覽關掉，不報錯。
// 2026-10-07 使用者：有 JS 時公告條浮在導覽列下面（不佔版面，收起來版面不跳）、首頁出現後 8 秒自己淡出、看過一次就不再出現（有新公告才會再出現）。
//   滑鼠停在上面、或鍵盤焦點在裡面時不收；設了減少動態就直接拿掉、不淡出。關掉 JS 時照舊在原位、不會自己消失。
(function () {
    'use strict';

    var KEY = 'collector-bulletin-dismissed';
    var DAYS = 30;
    var DAY_MS = 24 * 60 * 60 * 1000;

    // 'YYYY-MM-DD' 或一個 Date 的當地日期 → 從 1970-01-01 起的第幾天（用 Date.UTC 只是為了算日曆天數，不是用 UTC 的日期）
    function dayNumber(year, month, day) {
        return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
    }

    function dayOf(text) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
        return m ? dayNumber(Number(m[1]), Number(m[2]), Number(m[3])) : null;
    }

    /**
     * 挑該顯示的那一則：寫壞的跳過 → 發布日已經到了（看的人的當地日期）→ 30 天內（發布日當天是第 0 天，到第 30 天）或置頂 →
     * 不是按過 ✕ 的 → 日期最新的一則（同一天取前面那則）。
     *
     * @param {Array<{ ok?: boolean, id: string, date: string, pinned?: boolean }>} entries 公告（照檔案順序）
     * @param {Date} now 看的人的現在時間（用它的當地日期）
     * @param {string[]} dismissed 按過 ✕ 的 id
     * @returns {object | null} entries 裡的那一則，或 null
     */
    function pick(entries, now, dismissed) {
        var today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
        var best = null;
        var bestDay = null;
        for (var i = 0; i < entries.length; i += 1) {
            var entry = entries[i];
            if (!entry || entry.ok === false) continue;
            var day = dayOf(entry.date);
            if (day === null) continue;
            var age = today - day;
            if (age < 0) continue;
            if (age > DAYS && !entry.pinned) continue;
            if (dismissed.indexOf(entry.id) !== -1) continue;
            if (best === null || day > bestDay) {
                best = entry;
                bestDay = day;
            }
        }
        return best;
    }

    globalThis.collectorBulletin = { pick: pick };

    if (typeof document === 'undefined') return;

    function readDismissed() {
        try {
            var list = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (err) {
            return [];   // 存不了或不是 JSON：當作沒關過任何一則
        }
    }

    function remember(id) {
        try {
            var list = readDismissed();
            if (list.indexOf(id) === -1) list.push(id);
            localStorage.setItem(KEY, JSON.stringify(list));
        } catch (err) {
            // 存不了：只在這次瀏覽關掉（規格書第 5 節 02），不報錯
        }
    }

    var meta = document.querySelector('meta[name="collector-bulletin"]');
    if (!meta) return;
    var entries;
    try {
        entries = JSON.parse(meta.getAttribute('content') || '[]');
    } catch (err) {
        return;   // 讀不懂就照產生網頁時挑的那條（不動畫面）
    }
    var picked = pick(entries, new Date(), readDismissed());

    // 畫面畫出來之前插一段樣式：全部藏起來，只放挑中的那條（蓋掉產生網頁時挑的）
    var css = '[data-bulletin]{display:none!important}';
    if (picked) css += '[data-bulletin="' + String(picked.id).replace(/["\\]/g, '\\$&') + '"]{display:block!important}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ✕：下一幀整條就不在（直接拿掉，不做高度動畫），記住 id。
    // 焦點原本在公告條裡（✕ 本身）的話，移到 <main id="main">（tabindex="-1"、不畫焦點框）：
    // 不然焦點掉到 <body>，讀屏會從頭念、再按 Tab 也從頭走
    document.addEventListener('click', function (event) {
        var button = event.target instanceof Element ? event.target.closest('[data-bulletin-close]') : null;
        var bar = button ? button.closest('[data-bulletin]') : null;
        if (!bar) return;
        var id = bar.getAttribute('data-bulletin');
        var hadFocus = bar.contains(document.activeElement);
        bar.remove();
        remember(id);
        var main = document.getElementById('main');
        if (hadFocus && main) main.focus({ preventScroll: true });
    });

    if (!picked) return;
    // 看過一次：下次來就不挑它；比它舊的也一起記成看過（不然下次會改挑次新的那一則，例如已經過時的舊公告）
    var shownDay = dayOf(picked.date);
    entries.forEach(function (entry) {
        if (entry && entry.ok !== false && dayOf(entry.date) !== null && dayOf(entry.date) <= shownDay) remember(entry.id);
    });

    var SHOW_MS = 8000;
    var started = false;
    function autoHide() {
        if (started) return;
        started = true;
        var bar = document.querySelector('[data-bulletin="' + String(picked.id).replace(/["\\]/g, '\\$&') + '"]');
        if (!bar) return;
        var left = SHOW_MS;
        var began = 0;
        var timer = 0;
        var leave = function () {
            var hadFocus = bar.contains(document.activeElement);
            var gone = false;
            var done = function () {
                if (gone) return;
                gone = true;
                bar.remove();
                var main = document.getElementById('main');
                if (hadFocus && main) main.focus({ preventScroll: true });
            };
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
            bar.setAttribute('data-leaving', '');
            bar.addEventListener('transitionend', done, { once: true });
            setTimeout(done, 1000);   // 轉場沒觸發（被別的樣式蓋掉）也照樣拿掉
        };
        var run = function () {
            if (timer) return;
            began = Date.now();
            timer = setTimeout(leave, left);
        };
        var hold = function () {
            if (!timer) return;
            clearTimeout(timer);
            timer = 0;
            left = Math.max(1500, left - (Date.now() - began));   // 移開之後至少再停 1.5 秒
        };
        bar.addEventListener('mouseenter', hold);
        bar.addEventListener('focusin', hold);
        bar.addEventListener('mouseleave', function () { if (!bar.contains(document.activeElement)) run(); });
        bar.addEventListener('focusout', function (event) { if (!bar.contains(event.relatedTarget) && !bar.matches(':hover')) run(); });
        run();
    }

    // 從首頁出現算起（載入畫面淡出：public/motion.js 發 collector:loaded）；載入畫面沒跑（腳本沒到）就 3 秒後照樣開始算
    function whenShown() {
        if (window.__collectorLoaded) return autoHide();
        document.addEventListener('collector:loaded', autoHide, { once: true });
        setTimeout(autoHide, 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenShown, { once: true });
    else whenShown();
})();
