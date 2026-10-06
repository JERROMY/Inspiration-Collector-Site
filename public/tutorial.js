// 09 教學影片：YouTube 播放器、章節、06 的「看教學 NN」跳過來的落點（規格書 §5-09；設計稿 動態.md 09）。
//
// 一般的腳本，<head> 裡 <script src="/tutorial.js" defer>。沒有它時（關掉 JS）：章節清單照樣在（每一列的摘要打得開），
// 播放鈕不顯示（CSS 的 html:not(.js)），06 的「看教學 NN」是原生的錨點 #ch-NN。
//
// 有影片 ID（[data-tutorial] 有 data-video-id）時：
// - 還沒按之前整頁不碰 YouTube：按了播放鈕、章名、或 06 的「看教學 NN」，才載入 https://www.youtube.com/iframe_api（整頁一次），
//   在影片框裡建播放器（加強隱私模式 youtube-nocookie.com，rel=0、playsinline=1）。
// - 播放器程式載不到（被擋、出錯），或按下去 8 秒（LOAD_TIMEOUT_MS）播放器還沒好（程式沒到、或播放器建了卻一直沒 ready）：
//   影片框回到還沒按的樣子（idle、播放鈕放回來、不標任何章、建了一半的播放器拿掉），框加上失敗的樣式（data-fail-class）、
//   一句話（role="status"）請人改用底下的「在 YouTube 上看」；焦點掉了就放回播放鈕；再按會重試。
//   程式在逾時之後才到，不自己播；再按就直接用（YT.Player 已經在、或 YT.loading 正在載就只等它好，不再插一次 —— iframe_api 第二次執行什麼都不做）。
// - 播放鈕從 0:00（第 01 章）播；章名從那一章的起點播。每 250ms 看一次播到哪：真的播起來才標正在播的那一章（aria-current、「正在播放」），
//   清單只捲清單、把那一列捲到清單頂；時間跑出這一章的範圍（自己拖進度）就改認時間所在的那一章；到那一章的結尾就停，蓋上章尾那一層 ——
//   標題是這一章的章名；「重播這一段」「播下一段：下一章的章名」（最後一章只有「從頭再看一次」），焦點移到「播下一段」（或「從頭再看一次」），
//   Esc 收掉、焦點回到那一章的按鈕（窄的時候那一章收在「看全部」裡，標它的時候先打開）。
// 影片框的 data-state：idle（還沒按）→ loading（載入播放器）→ playing／paused → ended（一章播完、蓋著章尾那一層）。
//
// 06 的「看教學 NN」：有影片就捲到影片、從那一章播；沒有影片時，寬的時候（清單在影片右邊、自己捲）捲到影片、清單把那一列捲到清單頂，
// 窄的時候捲到那一列（收在「看全部」裡就先打開）；兩種都打開那一列的摘要，網址換成 #ch-NN。停的位置讓開導覽列（scroll-padding-top）。
(function () {
    'use strict';

    var LOAD_TIMEOUT_MS = 8000;

    var section = document.querySelector('[data-section="tutorial"]');
    var box = section && section.querySelector('[data-tutorial]');
    if (!box) return;

    var screen = box.querySelector('[data-player]');
    var listBox = box.querySelector('[data-chapters-scroll]');
    var videoId = box.getAttribute('data-video-id');

    // 清單把那一列捲到清單頂（只捲清單，整頁不動）；清單沒在捲（窄的時候）就不動
    function listToTop(li) {
        if (listBox.scrollHeight <= listBox.clientHeight) return;
        listBox.scrollTop += li.getBoundingClientRect().top - listBox.getBoundingClientRect().top;
    }

    // 寬的時候（清單自己捲）：清單高度切在某一章的一半（影片框夠高時是第 7 章：TARGET），下面還有幾章寫在「還有 N 章 ↓」，捲到底收掉（使用者 2026-10-04）。
    // 量法：先拿掉上一次的高度（data-fit）讓清單照影片框撐開，量得到的高度裡，第 7 章的一半放得下就切在那裡；放不下就切在最後一章放得下一半的那一列。
    // 「還有 N 章」的 N：還沒整列露出來的章數。窄的時候（清單沒在捲）都不做。
    var TARGET = 7;
    var chaptersBox = box.querySelector('[data-chapters]');
    var moreHint = box.querySelector('[data-chapters-more]');
    var moreText = moreHint && moreHint.querySelector('[data-more-text]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function rowsOf() {
        return listBox.querySelectorAll('li[id^="ch-"]');
    }

    // 還在清單下緣以下、沒整列露出來的章數。什麼時候重算：IntersectionObserver（root 是清單）有列進出時 —— 不聽 scroll 事件
    var watcher = null;

    function updateHint() {
        if (!moreHint) return;
        if (!chaptersBox.hasAttribute('data-fit')) {
            moreHint.hidden = true;
            return;
        }
        var bottom = listBox.getBoundingClientRect().top + listBox.clientHeight;
        var left = 0;
        Array.prototype.forEach.call(rowsOf(), function (li) {
            if (li.getBoundingClientRect().bottom > bottom + 1) left += 1;
        });
        moreHint.hidden = left === 0;
        if (left) moreText.textContent = moreHint.getAttribute('data-template').replace('%nn%', String(left));
    }

    function watchRows() {
        if (watcher) watcher.disconnect();
        updateHint();
        if (!('IntersectionObserver' in window)) return;
        watcher = new IntersectionObserver(updateHint, { root: listBox, threshold: [0, 0.99] });
        Array.prototype.forEach.call(rowsOf(), function (li) {
            watcher.observe(li);
        });
    }

    function fitList() {
        chaptersBox.removeAttribute('data-fit');
        chaptersBox.style.removeProperty('--list-h');
        if (getComputedStyle(listBox).overflowY !== 'auto' || listBox.scrollHeight <= listBox.clientHeight + 1) {
            updateHint();
            return;
        }
        // 提示疊在清單下緣、靠右（同影片框上的播放鈕：疊在半露的那一列與淡出上）
        var top = listBox.getBoundingClientRect().top - listBox.scrollTop;
        var avail = listBox.clientHeight;
        var rows = rowsOf();
        var cut = 0;
        for (var i = 0; i < rows.length; i += 1) {
            var r = rows[i].getBoundingClientRect();
            var mid = r.top - top + r.height / 2;
            if (mid > avail) break;
            cut = mid;
            if (i + 1 === TARGET) break;
        }
        if (!cut) {
            updateHint();
            return;
        }
        chaptersBox.style.setProperty('--list-h', cut + 'px');
        chaptersBox.style.setProperty('--hint-y', (listBox.getBoundingClientRect().top - chaptersBox.getBoundingClientRect().top + cut) + 'px');
        chaptersBox.setAttribute('data-fit', '');
        watchRows();
    }

    if (moreHint) {
        moreHint.addEventListener('click', function () {
            listBox.scrollBy({ top: listBox.clientHeight * 0.8, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        });
        // 改屬性、改字要等 React 接手之後（components/Hydrated 發的 collector:hydrated）：在那之前改，React 會報錯 #418、整頁重畫，改的全被洗掉
        var start = function () {
            window.addEventListener('resize', fitList);
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitList);
            fitList();
        };
        if (window.__collectorHydrated) start();
        else window.addEventListener('collector:hydrated', start, { once: true });
    }

    var player = null;    // YT.Player（建好之後）
    var play = null;      // 有影片時：從第 index 章播

    if (videoId) {
        var playButton = screen.querySelector('[data-play]');
        var failNote = screen.querySelector('[data-api-fail]');
        var endcard = screen.querySelector('[data-endcard]');
        var title = endcard.querySelector('[data-id="tutorial.done"]');
        var titleTemplate = title.cloneNode(true);
        var actions = {
            replay: endcard.querySelector('[data-end-action="replay"]'),
            next: endcard.querySelector('[data-end-action="next"]'),
            again: endcard.querySelector('[data-end-action="again"]'),
        };
        var nextName = actions.next.querySelector('[data-next-name]');
        var nowLabel = box.getAttribute('data-now-label');
        var nowClass = box.getAttribute('data-now-class');
        var failClass = box.getAttribute('data-fail-class');
        var chapters = Array.prototype.map.call(box.querySelectorAll('button[data-chapter]'), function (button) {
            return {
                id: button.getAttribute('data-chapter'),
                start: Number(button.getAttribute('data-start')),
                end: Number(button.getAttribute('data-end')),
                name: button.getAttribute('data-name'),
                button: button,
            };
        });

        var current = -1;     // 要播（或正在播）的那一章
        var marked = -1;      // 已經標成「正在播放」的那一章
        var expect = null;    // 剛叫播放器跳到哪一章：時間還沒到那一章之前，不拿舊的時間改認章
        var expectAt = 0;
        var timer = null;
        var waiting = null;   // 這一次按下去、還在等播放器好的那一次（好了、或放棄之後清掉：晚到的回應不再動影片框）

        var setState = function (state) {
            screen.setAttribute('data-state', state);
        };

        // 等 YouTube 的播放器程式（YT.Player）能用：已經有了就直接往下；已經在載（YT.loading）就不再插腳本、只等它好 ——
        // 兩條都接：onYouTubeIframeAPIReady 串在原本那一個後面（不蓋掉），YT.ready 也排一個
        var waitApi = function () {
            return new Promise(function (done, fail) {
                var yt = window.YT;
                if (yt && typeof yt.Player === 'function') {
                    done();
                    return;
                }
                var before = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = function () {
                    if (typeof before === 'function') before();
                    done();
                };
                if (yt && yt.loading) {
                    if (typeof yt.ready === 'function') yt.ready(done);
                    return;
                }
                var script = document.createElement('script');
                script.onerror = function () {
                    script.remove();
                    fail(new Error('load'));
                };
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                document.head.appendChild(script);
            });
        };

        // 標出正在播的那一章（-1：都不標）
        var mark = function (index) {
            if (index === marked) return;
            marked = index;
            chapters.forEach(function (ch, i) {
                var name = ch.button.querySelector('[data-id$=".name"]');
                var now = name.querySelector('[data-now]');
                if (i === index) {
                    ch.button.setAttribute('aria-current', 'true');
                    if (!now) {
                        now = document.createElement('span');
                        now.className = nowClass;
                        now.setAttribute('data-now', '');
                        now.textContent = nowLabel;
                        name.appendChild(now);
                    }
                } else {
                    ch.button.removeAttribute('aria-current');
                    if (now) now.remove();
                }
            });
            if (index >= 0) {
                var li = chapters[index].button.closest('li');
                // 窄的時候這一章收在「看全部」裡：先打開（看不到的按鈕拿不到焦點，Esc 之後焦點會掉到 <body>）
                var rest = li.parentElement.closest('details');
                if (rest && !rest.open) rest.open = true;
                listToTop(li);
            }
        };

        var onKey = function (event) {
            if (event.key === 'Escape') hideEnd(true);
        };

        // 把字裡的 %章名% 換成這一章的章名（只換字，不碰標記畫出來的結構）
        var fill = function (node, name) {
            if (node.nodeType === 3) {
                node.nodeValue = node.nodeValue.split('%章名%').join(name);
                return;
            }
            Array.prototype.forEach.call(node.childNodes, function (child) { fill(child, name); });
        };

        var showEnd = function () {
            var ch = chapters[current];
            var next = chapters[current + 1];
            var fresh = titleTemplate.cloneNode(true);
            fill(fresh, ch.name);
            title.replaceChildren.apply(title, Array.prototype.slice.call(fresh.childNodes));
            actions.replay.hidden = !next;
            actions.next.hidden = !next;
            actions.again.hidden = Boolean(next);
            if (next) {
                // 「播下一段」的章名照清單那一列一樣斷行（同一套規則畫的），箭頭跟最後一個詞一起換行
                var parts = Array.prototype.filter.call(next.button.querySelector('[data-id$=".name"]').childNodes, function (n) {
                    return !(n.nodeType === 1 && n.hasAttribute('data-now'));
                }).map(function (n) { return n.cloneNode(true); });
                var arrow = document.createElement('span');
                arrow.className = 'i';
                arrow.setAttribute('data-icon', 'arrow');
                arrow.setAttribute('aria-hidden', 'true');
                var last = parts[parts.length - 1];
                if (last && last.nodeType === 1) last.appendChild(arrow);
                else parts.push(arrow);
                nextName.replaceChildren.apply(nextName, parts);
            }
            endcard.hidden = false;
            setState('ended');
            (next ? actions.next : actions.again).focus({ preventScroll: true });
            document.addEventListener('keydown', onKey);
        };

        // focus：Esc 收掉時焦點回到那一章的按鈕（不掉到 <body>）
        var hideEnd = function (focus) {
            if (endcard.hidden) return;
            endcard.hidden = true;
            document.removeEventListener('keydown', onKey);
            if (screen.getAttribute('data-state') === 'ended') setState('paused');
            if (focus && current >= 0) chapters[current].button.focus({ preventScroll: true });
        };

        var chapterAt = function (t) {
            for (var i = 0; i < chapters.length; i += 1) if (t >= chapters[i].start && t < chapters[i].end) return i;
            return -1;
        };

        // 看一次播到哪：真的在播才標章；時間跑出這一章（自己拖進度）就改認那一章；到結尾就停、蓋上章尾那一層
        var check = function () {
            if (!player || current < 0 || typeof player.getCurrentTime !== 'function') return;
            if (player.getPlayerState() !== 1) return;
            var t = player.getCurrentTime();
            if (expect !== null) {
                var want = chapters[expect];
                if (t >= want.start - 1 && t < want.end) expect = null;
                else if (Date.now() - expectAt < 3000) return;
                else expect = null;
            }
            var ch = chapters[current];
            if (t < ch.start - 1 || t > ch.end + 0.75) {
                var at = chapterAt(t);
                if (at >= 0) {
                    current = at;
                    ch = chapters[at];
                }
            }
            mark(current);
            if (t >= ch.end - 0.25) {
                player.pauseVideo();
                showEnd();
            }
        };

        var watch = function () {
            if (!timer) timer = setInterval(check, 250);
        };

        // 播放器程式載不到：回到還沒按的樣子，框裡一句話指向底下的「在 YouTube 上看」（role="status"，讀屏會念，不搶焦點）；
        // 按播放鈕的那一刻它藏起來了，焦點在影片框（play() 放的）或掉到 <body> 的話放回播放鈕（焦點已經在別的地方就不動）
        var failed = function () {
            mark(-1);
            current = -1;
            setState('idle');
            if (failClass) screen.classList.add(failClass);
            if (failNote) failNote.hidden = false;
            if (playButton) {
                playButton.hidden = false;
                var at = document.activeElement;
                if (!at || at === document.body || at === screen) playButton.focus({ preventScroll: true });
            }
        };

        var onStateChange = function (event) {
            var state = event.data;
            if (state === 1) {
                setState('playing');
                watch();
                check();
            } else if (state === 2 && endcard.hidden) {
                setState('paused');
            } else if (state === 0 && current >= 0 && endcard.hidden) {
                showEnd();
            }
        };

        play = function (index) {
            hideEnd(false);
            current = index;
            expect = index;
            expectAt = Date.now();
            if (failNote) failNote.hidden = true;
            if (failClass) screen.classList.remove(failClass);
            var start = chapters[index].start;
            if (player && !waiting) {
                player.seekTo(start, true);
                player.playVideo();
                check();
                return;
            }
            mark(-1);   // 真的播起來才標
            if (playButton) {
                // 用鍵盤按的：播放鈕一藏起來焦點就會掉到 <body>（下一個 Tab 從頁首開始）。先把焦點放到影片框（tabindex="-1"：程式放得上去、Tab 不停），
                // 載入中、播起來之後都在那裡；載不到時 failed() 放回播放鈕
                if (document.activeElement === playButton) {
                    screen.tabIndex = -1;
                    screen.focus({ preventScroll: true });
                }
                playButton.hidden = true;
            }
            if (screen.getAttribute('data-state') === 'loading') return;   // 播放器還在載入：好了之後從 current 那一章播
            setState('loading');
            var attempt = {};
            var holder = null;
            var limit = 0;
            // 這一次放棄（載不到、逾時）：建了一半的播放器拿掉，回到還沒按的樣子，再按會重試
            var giveUp = function () {
                if (waiting !== attempt) return;
                waiting = null;
                clearTimeout(limit);
                var made = player;
                player = null;
                if (made && typeof made.destroy === 'function') made.destroy();
                if (holder) holder.remove();
                failed();
            };
            waiting = attempt;
            limit = setTimeout(giveUp, LOAD_TIMEOUT_MS);   // 從按下去算到播放器 ready
            waitApi().then(function () {
                if (waiting !== attempt) return;   // 逾時之後才到：不自己播
                holder = document.createElement('div');
                screen.appendChild(holder);
                player = new window.YT.Player(holder, {
                    host: 'https://www.youtube-nocookie.com',
                    videoId: videoId,
                    playerVars: { rel: 0, playsinline: 1, start: start, autoplay: 1 },
                    events: {
                        onReady: function (event) {
                            if (waiting !== attempt) return;
                            waiting = null;
                            clearTimeout(limit);
                            var at = chapters[current].start;
                            if (Math.abs(event.target.getCurrentTime() - at) > 1) event.target.seekTo(at, true);
                            event.target.playVideo();
                        },
                        onStateChange: onStateChange,
                    },
                });
            }).catch(giveUp);
        };

        if (playButton) playButton.addEventListener('click', function () { play(0); });
        chapters.forEach(function (ch, i) {
            ch.button.addEventListener('click', function () { play(i); });
        });
        actions.replay.addEventListener('click', function () { play(current); });
        actions.next.addEventListener('click', function () { play(current + 1); });
        actions.again.addEventListener('click', function () { play(0); });
    }

    // 06 的「看教學 NN」跳到 09
    document.querySelectorAll('[data-section="features"] a[data-chapter]').forEach(function (link) {
        link.addEventListener('click', function (event) {
            var id = link.getAttribute('data-chapter');
            var li = document.getElementById('ch-' + id);
            if (!li) return;
            event.preventDefault();
            history.pushState(null, '', '#ch-' + id);
            if (play) {
                screen.scrollIntoView({ block: 'start' });
                play(Number(id) - 1);
                return;
            }
            var more = li.querySelector('details');
            if (more) more.open = true;
            if (getComputedStyle(listBox).overflowY === 'auto') {
                // 寬的時候：落在影片上緣，清單把那一列捲到清單頂
                screen.scrollIntoView({ block: 'start' });
                listToTop(li);
            } else {
                // 窄的時候：落在那一列本身（收在「看全部」裡就先打開）
                var rest = li.parentElement.closest('details');
                if (rest) rest.open = true;
                li.scrollIntoView({ block: 'start' });
            }
        });
    });
})();
