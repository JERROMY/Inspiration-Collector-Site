// 首屏與 04 的動態（設計稿 動態.md 的 A、B、D；C 不放）。動畫本身全在 CSS（components/Hero、components/Where 的 .module.css），
// 這支只加開關與拆字，時間都從 CSS 的 token 讀（--dur-*），不在這裡寫死。
//
// 一般的腳本，在 <head> 裡同步載入（很小）：畫面畫出來之前先給 <html> 加 js（有 JS），再決定要不要加 js-motion ——
// 進場前的樣子（字透明、0 在上面一格、括號角在框外）只在有這個 class 時才套用，所以這支沒載到、或設了減少動態，畫面直接是最後的樣子。
//
// A：首屏大標括號裡那半句（[data-id="hero.title"] .clamp），每個字（空白除外）包成 <span data-char>，各帶 0～1 的出場位置 --k；
//    順序只從 Math.random 來（洗牌、每個字落在自己那一格再隨機偏一點）。只包字：.nw、<wbr>、括號、空白原樣留著，換行跟沒拆之前一樣。
//    拆字要等 React 接手之後（components/Hydrated 發的 collector:hydrated）：在那之前改 React 畫的字，React 會報錯、整頁重畫。
//    等拉丁字型（document.fonts.load，最多 --dur-slow 的兩倍，失敗也照樣開始）、「還沒冒出來」的樣子畫過兩幀之後才開始（motion-a）。
//    播完把字換回純文字（讀屏、複製貼上比較乾淨）。React 沒在 --dur-slow 的兩倍（約 1 秒）內接手（手機慢、程式晚到），
//    就放棄 A、直接把字露出來：括號裡那半句看不見的時間不超過約 1 秒，React 晚到之後也不再藏起來重播。
// B、D：標了 data-reveal 的元素捲進畫面三成時加 data-in，只加一次（04 的 0 歸零、首屏媒體框的括號角對焦）。
(function () {
    'use strict';

    // 有 JS：給 <html> 加 js（不管減少動態）。關掉 JS 時沒有這個 class，CSS 直接換成不用程式的樣子（例如手指框直接顯示網址、不放播放鈕）
    document.documentElement.classList.add('js');

    // 載入畫面（2026-10-07 使用者決定加；量過效能：加之前後英文頁 Lighthouse 都約 83，沒有變差）：有 JS 才出現（關掉 JS 的人與爬蟲直接看到內容）。
    // 等三樣：HTML 讀完、網頁字型好了、首屏宣傳片準備好能順順播完（會自動播的時候才等；canplaythrough）。
    // 上限從開頁算：不等影片 1 秒、等影片 2 秒（2026-10-07 使用者選）；到了就先出首頁，影片在背景載完再播。
    // 淡出的那一刻發 collector:loaded（public/hero.js 等它才開始播，影片從第一格接著首頁出現）；設了減少動態就直接拿掉、不淡出。畫面在 app/styles/global.css 的 html.loading。
    (function () {
        var html = document.documentElement;
        var t0 = Date.now();
        var done = false;
        html.classList.add('loading');
        function out() {
            if (done) return;
            done = true;
            window.__collectorLoaded = true;
            document.dispatchEvent(new Event('collector:loaded'));
            if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                html.classList.remove('loading');
                return;
            }
            html.classList.add('loading-out');
            setTimeout(function () { html.classList.remove('loading', 'loading-out'); }, 400);
        }
        var cap = setTimeout(out, 1000);
        var dom = new Promise(function (ok) {
            if (document.readyState !== 'loading') ok();
            else document.addEventListener('DOMContentLoaded', ok, { once: true });
        });
        var font = new Promise(function (ok) {
            try {
                document.fonts.load('600 1em "Google Sans Flex"').then(ok, ok);
            } catch (err) {
                ok();
            }
        });
        // 影片：HTML 讀完才找得到 <video>；會自動播（video-auto，下面才決定、那時已經加好了）才先下載
        var film = dom.then(function () {
            var video = document.querySelector('[data-section="hero"] video[data-src]');
            if (!video || !html.classList.contains('video-auto')) return;
            clearTimeout(cap);
            cap = setTimeout(out, Math.max(0, 2000 - (Date.now() - t0)));
            return new Promise(function (ok) {
                if (video.readyState >= 4) return ok();
                video.addEventListener('canplaythrough', ok, { once: true });
                video.addEventListener('error', ok, { once: true });
                video.preload = 'auto';
                if (!video.getAttribute('src')) video.src = video.getAttribute('data-src');
            });
        });
        Promise.all([dom, font, film]).then(out);
    })();

    // 首屏宣傳片會不會自動播（沒開省流量、沒設減少動態；2026-10-07 使用者決定手機也自動播，原本只有有滑鼠的才播）：畫面出來之前決定，給 <html> 加 video-auto，
    // 播放鈕第一次畫就是 44 的暫停鍵（不先閃大的播放鈕）。之後的狀態由 public/hero.js 管（自動播被擋時它會拿掉這個 class）
    if (window.matchMedia
        && !(navigator.connection && navigator.connection.saveData)
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && 'IntersectionObserver' in window) {
        document.documentElement.classList.add('video-auto');
    }

    if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var root = document.documentElement;
    root.classList.add('js-motion');

    // CSS 的時間 token（例如 "480ms"）→ 毫秒；讀不到用 fallback
    function token(name, fallback) {
        var value = getComputedStyle(root).getPropertyValue(name).trim();
        var ms = /ms$/.test(value) ? parseFloat(value) : /s$/.test(value) ? parseFloat(value) * 1000 : NaN;
        return isNaN(ms) ? fallback : ms;
    }

    var slow = token('--dur-slow', 480);

    // 拉丁字型：等它載好，最多 --dur-slow 的兩倍（等的時候括號裡那半句看不見，等太久首屏大標會缺半句）；載不到也照樣開始
    var fontReady = new Promise(function (done) {
        setTimeout(done, slow * 2);
        try {
            document.fonts.load('600 1em "Google Sans Flex"').then(done, done);
        } catch (err) {
            done();   // 沒有 document.fonts：不等
        }
    });

    var hydrated = new Promise(function (done) {
        if (window.__collectorHydrated) done();
        else addEventListener('collector:hydrated', done, { once: true });
    });

    // React 沒在 --dur-slow 的兩倍（約 1 秒，跟等字型的上限同一個）內接手：放棄 A，把字露出來（不拆、不動）
    var gaveUp = false;
    var giveUp = setTimeout(function () {
        gaveUp = true;
        root.classList.add('chars-split');
    }, slow * 2);

    // 每個字的出場位置（0～1）：洗牌，每個字落在自己那 1/n 格裡再隨機偏最多 80%
    function scatter(n) {
        var order = [];
        for (var i = 0; i < n; i += 1) order.push(i);
        for (var j = n - 1; j > 0; j -= 1) {
            var r = Math.floor(Math.random() * (j + 1));
            var tmp = order[j];
            order[j] = order[r];
            order[r] = tmp;
        }
        var k = new Array(n);
        order.forEach(function (slot, at) { k[slot] = (at + Math.random() * 0.8) / n; });
        return k;
    }

    function split(clamp) {
        var nodes = [];
        var walk = document.createTreeWalker(clamp, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) nodes.push(walk.currentNode);
        var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
        var graphemes = function (text) {
            return segmenter ? Array.from(segmenter.segment(text), function (s) { return s.segment; }) : Array.from(text);
        };
        var total = nodes.reduce(function (n, node) { return n + graphemes(node.data).filter(function (ch) { return ch.trim(); }).length; }, 0);
        var k = scatter(total);
        var at = 0;
        var chars = [];
        nodes.forEach(function (node) {
            var frag = document.createDocumentFragment();
            graphemes(node.data).forEach(function (ch) {
                if (!ch.trim()) {
                    frag.append(ch);
                    return;
                }
                var span = document.createElement('span');
                span.setAttribute('data-char', '');
                span.style.setProperty('--k', k[at].toFixed(3));
                at += 1;
                span.textContent = ch;
                chars.push(span);
                frag.append(span);
            });
            node.replaceWith(frag);
        });
        return chars;
    }

    // 播完：把字換回純文字（每個字的顏色轉場都結束了才換）
    function restore(clamp, chars) {
        var left = chars.length;
        clamp.addEventListener('transitionend', function done(event) {
            if (!event.target.hasAttribute || !event.target.hasAttribute('data-char') || event.propertyName !== 'color') return;
            left -= 1;
            if (left > 0) return;
            clamp.removeEventListener('transitionend', done);
            chars.forEach(function (span) { span.replaceWith(span.textContent); });
            clamp.normalize();
        });
    }

    hydrated.then(function () {
        if (gaveUp) return;
        clearTimeout(giveUp);
        var clamp = document.querySelector('[data-section="hero"] [data-id="hero.title"] .clamp');
        var chars = [];
        try {
            if (clamp) chars = split(clamp);
        } finally {
            root.classList.add('chars-split');   // 拆壞了也照樣露出來
        }
        if (!chars.length) return;
        restore(clamp, chars);
        // 等字型、而且「還沒冒出來」的樣子至少畫過一次（兩個動畫幀）才開始 —— 同一幀裡加的話瀏覽器直接畫最後的樣子
        fontReady.then(function () {
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { root.classList.add('motion-a'); });
            });
        });
    });

    // B、D：捲進畫面三成時加 data-in，只加一次
    function reveal() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('[data-reveal]').forEach(function (el) { el.setAttribute('data-in', ''); });
            return;
        }
        var seen = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.setAttribute('data-in', '');
                seen.unobserve(entry.target);
            });
        }, { threshold: 0.3 });
        document.querySelectorAll('[data-reveal]').forEach(function (el) { seen.observe(el); });
    }

    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', reveal);
    else reveal();
})();
