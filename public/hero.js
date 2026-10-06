// 03 首屏與 15 最後的安裝：宣傳片、「分享這個網址」與「已複製」（規格書第 5 節 03、15、第 9 節；設計稿 動態.md「稿裡沒辦法做、正式版要寫程式的」）。
//
// 一般的腳本，在 <head> 裡用 <script src="/hero.js" defer> 載入（畫完才跑）。沒有它時：預覽圖照樣在，按播放鈕沒有反應；
// 分享框的「寄給自己」「用的是電腦？」是一般的連結，照樣能用。
//
// 宣傳片（<video data-src>，一開始沒有 src，什麼都不抓）與它的鈕（[data-play]，同一顆：播放鈕／暫停鍵，data-state 照下面換）：
// - 桌機會自動播（<head> 的 motion.js 已經給 <html> 加了 video-auto：有滑鼠、沒開省流量、沒設減少動態）：開頁就是 44 的暫停鍵（loading），
//   影片框捲進畫面三成才載入、才播 → playing。載入中按下去＝不要自動播：停止載入（拿掉 src＋load()）、記成使用者暫停 → paused。
//   play() 被擋（瀏覽器不准自動播）：拿掉 video-auto、回到大的播放鈕（idle），讓人自己按。
// - 2026-10-07 起手機也自動播（使用者決定）；省流量、減少動態：開頁是大的播放鈕（idle），按了才載入、才播 → playing（之後是 44）。
// - 載入畫面（motion.js 的 html.loading）還在時先載不播，等 collector:loaded 才播，首頁出現時影片從第一格開始。
// - 按暫停：paused，記成使用者暫停，捲走再捲回來不自己播；按播放：接著播。
// - 播放中捲出畫面：暫停（不是使用者暫停）；捲回來：使用者沒暫停就接著播。
// 讀屏名字跟著換（data-label-play／data-label-pause），不另加 aria-pressed。
// 「分享這個網址」（[data-share]）：有 navigator.share 就用它；沒有（或丟出使用者取消以外的錯）就把網址寫進剪貼簿，浮出「已複製」（[data-toast]，role="status"）；
// 剪貼簿也不行，就在手指框直接顯示網址（touch--noshare）。不跳 prompt()／alert()。
(function () {
    'use strict';

    var root = document.documentElement;

    // CSS 的時間 token（例如 "240ms"）→ 毫秒
    function token(name, fallback) {
        var value = getComputedStyle(root).getPropertyValue(name).trim();
        var ms = /ms$/.test(value) ? parseFloat(value) : /s$/.test(value) ? parseFloat(value) * 1000 : NaN;
        return isNaN(ms) ? fallback : ms;
    }

    var hero = document.querySelector('[data-section="hero"]');

    // ── 宣傳片 ──
    var video = hero && hero.querySelector('video[data-src]');
    var play = hero && hero.querySelector('[data-play]');

    if (video && play) {
        var auto = root.classList.contains('video-auto');
        var userPaused = false;   // 使用者按了暫停（或載入中按下去）：捲回來不自己播
        var started = false;      // 開始播過（自動或按了）：之後捲進畫面就接著播
        var inView = false;

        var setState = function (state) {
            play.setAttribute('data-state', state);
            var pause = state === 'loading' || state === 'playing';
            play.setAttribute('aria-label', play.getAttribute(pause ? 'data-label-pause' : 'data-label-play'));
        };

        var start = function () {
            started = true;
            if (!video.getAttribute('src')) video.src = video.getAttribute('data-src');
            // 載入畫面還在（public/motion.js）：先載、不播，等它淡出（collector:loaded）才從第一格開始播
            if (!window.__collectorLoaded && root.classList.contains('loading')) {
                document.addEventListener('collector:loaded', function () {
                    if (started && !userPaused && inView) begin();
                }, { once: true });
                return;
            }
            begin();
        };

        var begin = function () {
            var promise = video.play();
            if (promise && promise.catch) {
                promise.catch(function (err) {
                    if (err && err.name === 'AbortError') return;   // 載入中被我們自己停掉（拿掉 src）：不用管
                    // 播不了（瀏覽器擋自動播放、格式不支援）：回到大的播放鈕，讓人自己按
                    root.classList.remove('video-auto');
                    started = false;
                    setState('idle');
                });
            }
        };

        video.addEventListener('playing', function () {
            video.setAttribute('data-playing', '');
            setState('playing');
        });

        play.addEventListener('click', function () {
            var state = play.getAttribute('data-state');
            if (state === 'loading') {
                // 載入中按下去＝不要自動播：停止載入
                userPaused = true;
                started = false;
                video.removeAttribute('src');
                video.load();
                setState('paused');
            } else if (state === 'playing') {
                userPaused = true;
                video.pause();
                setState('paused');
            } else {
                // idle、paused：開始播（「playing」事件來了才換成播放中）
                userPaused = false;
                if (state === 'paused' && !video.getAttribute('src')) setState('loading');
                start();
            }
        });

        if (auto) setState('loading');

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                    if (inView) {
                        if (userPaused) return;
                        if (auto && !started && play.getAttribute('data-state') === 'loading') start();
                        else if (started && video.paused) start();
                    } else if (!video.paused) {
                        video.pause();   // 系統暫停：不是使用者暫停，捲回來接著播
                    }
                });
            }, { threshold: 0.3 }).observe(video.parentElement);
        }
    }

    // ── 分享這個網址／已複製（首屏與 15 區的手指框各一組；「已複製」整頁一個，在首屏） ──
    var toast = document.querySelector('[data-toast]');
    var toastTimer = null;
    // 「已複製」停多久：--dur-breathe（3.2 秒）
    var TOAST_MS = token('--dur-breathe', 3200);

    // 「已複製」：元素開頁時就在、字是空的；這裡填字（讀屏念的是內容改變）、浮出來，--dur-breathe 之後淡出、清空
    function showToast() {
        if (!toast) return;
        clearTimeout(toastTimer);
        var icon = document.createElement('span');
        icon.className = 'i';
        icon.setAttribute('data-icon', 'check');
        icon.setAttribute('aria-hidden', 'true');
        toast.replaceChildren(icon, document.createTextNode(toast.getAttribute('data-copied') || ''));
        // 先畫出「還沒浮出來」的樣子，下一幀才加 data-show（同一幀加的話不會有轉場）
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { toast.setAttribute('data-show', ''); });
        });
        toastTimer = setTimeout(function () {
            toast.removeAttribute('data-show');
            toastTimer = setTimeout(function () { toast.replaceChildren(); }, token('--dur-base', 240));
        }, TOAST_MS);
    }

    // 剪貼簿：先用 Clipboard API；沒有（舊的、App 裡的瀏覽器）就用暫時的文字框＋copy 指令
    function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        return new Promise(function (done, fail) {
            var area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.append(area);
            area.select();
            var ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (err) {
                ok = false;   // 這個瀏覽器不准程式複製：下面照「沒成功」處理
            }
            area.remove();
            if (ok) done();
            else fail(new Error('copy failed'));
        });
    }

    // 一個手指框（[data-touch]）一組：分享鈕、退路的網址框
    function wire(touch) {
        var share = touch.querySelector('[data-share]');
        var urlbox = touch.querySelector('[data-share-urlbox]');
        if (!share) return;

        // 分享選單與剪貼簿都不能用（App 裡的瀏覽器常這樣）：分享鈕收起，改顯示「長按下面的網址就能複製」與網址，焦點移到網址框。
        // touch--noshare 是字面的 class（樣式在 components/TouchBox 的 .module.css 用 :global 寫）
        function showUrl() {
            touch.classList.add('touch--noshare');
            if (urlbox) urlbox.focus();
        }

        function copyOrShow(url) {
            copy(url).then(showToast, showUrl);
        }

        share.addEventListener('click', function () {
            var data = {
                title: share.getAttribute('data-share-title'),
                text: share.getAttribute('data-share-text'),
                url: share.getAttribute('data-share-url'),
            };
            if (typeof navigator.share !== 'function') {
                copyOrShow(data.url);
                return;
            }
            navigator.share(data).catch(function (err) {
                // 使用者自己取消（AbortError）：什麼都不做；其他的錯（例如 NotAllowedError）改用剪貼簿，再不行就顯示網址
                if (err && err.name === 'AbortError') return;
                copyOrShow(data.url);
            });
        });
    }

    document.querySelectorAll('[data-touch]').forEach(wire);
})();
