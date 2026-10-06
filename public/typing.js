// 07「AI 開始打字」（時間與長相見 tests-site/README.md「07 右邊 AI 開始打字（F9）」、網站 README「07 為 AI 做的」）。
// 樹的七行都長出來那一幀算 0：打字層淡入、蓋住大綱圖的文字欄，400ms 打第一個字，之後每字 30ms、換行 150ms，
// 超過 6 秒等比例縮到剛好 6 秒；打完拿掉游標、淡出露出圖本身。捲走再回來不重打。
// 字在 data-src（/<語言>/typing.json：text、hot＝亮的行、wraps＝在第幾個字前折行），07 快進畫面才抓。減少動態、沒有 JS：不抓，只有圖。
// 每一幀照經過的時間補上該出來的字（只往後加），切到背景、捲走、改寬度都不疊計時器。一行一個 div，換行字元放在 div 之間。
// 游標用 transform 移（行內元素每打一個字被推一次，版面會跳）。React 接手（collector:hydrated）之前不碰 DOM。
(function () {
    'use strict';

    if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window) || !window.fetch || !window.requestAnimationFrame) return;

    var layer = document.querySelector('[data-typing]');
    var typed = layer && layer.querySelector('[data-typed]');
    var section = layer && layer.closest('[data-section]');
    var lines = section ? section.querySelectorAll('[data-tree] [data-line]') : [];
    if (!typed || !lines.length) return;

    var text = null;
    var times = null;
    var rows = [];
    var hot = [];
    var wraps = [];
    var hydrated = !!window.__collectorHydrated;
    var near = false;
    var t0 = null;
    var shown = 0;
    var row = -1;
    var line = null;
    var node = null;
    var caret = null;
    var loop = 0;

    if (!hydrated) addEventListener('collector:hydrated', function () { hydrated = true; wake(); }, { once: true });

    function plan(chars) {
        var gaps = chars.map(function (c, i) { return i === 0 ? 0 : c === '\n' ? 150 : 30; });
        var total = gaps.reduce(function (a, b) { return a + b; }, 0);
        var scale = Math.min(1, 6000 / total);
        var t = 400;
        return gaps.map(function (gap) { t += gap * scale; return t; });
    }

    // 樹的七行都長出來了、而且樹在畫面裡（不支援捲動時間軸的瀏覽器七行一直都在，就看樹進畫面了沒）
    function grown() {
        var box = lines[0].parentNode.getBoundingClientRect();
        if (box.top >= innerHeight || box.bottom <= 0) return false;
        for (var i = 0; i < lines.length; i += 1) {
            if (parseFloat(getComputedStyle(lines[i]).opacity) < 0.99) return false;
        }
        return true;
    }

    // 下一行：標題（# ／ ##）、空行、亮的行各有自己的樣子（CSS 的 data-k）
    function next() {
        row += 1;
        var s = rows[row];
        line = document.createElement('div');
        var k = !s ? 'gap' : hot.indexOf(row) !== -1 ? 'hot' : /^# /.test(s) ? 'h1' : /^## /.test(s) ? 'h2' : '';
        if (k) line.setAttribute('data-k', k);
        node = document.createTextNode('');
        line.append(node);
        typed.append(line);
    }

    function type(i) {
        var c = text[i];
        if (c === '\n') {
            typed.append('\n');
            next();
        } else {
            if (wraps.indexOf(i) !== -1) {
                node = document.createTextNode('');
                line.append(document.createElement('br'), node);
            }
            node.appendData(c);
        }
    }

    // 游標移到最後一個字後面；這一列還沒有字時放在列首
    function place() {
        var origin = typed.getBoundingClientRect();
        var h = caret.offsetHeight;
        var x;
        var y;
        var len = node.data.length;
        if (len) {
            var range = document.createRange();
            range.setStart(node, len - 1);
            range.setEnd(node, len);
            var rects = range.getClientRects();
            var g = rects[rects.length - 1];
            if (!g) return;
            x = g.right - origin.left;
            y = g.top - origin.top + (g.height - h) / 2;
        } else {
            var box = line.getBoundingClientRect();
            var lh = parseFloat(getComputedStyle(line).lineHeight) || box.height;
            x = box.left - origin.left;
            y = box.bottom - origin.top - (lh + h) / 2;
        }
        caret.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }

    function frame() {
        loop = 0;
        var now = performance.now();
        if (t0 === null) {
            if (!near || !hydrated || !times) return;
            if (!grown()) { loop = requestAnimationFrame(frame); return; }
            t0 = now;
            caret = document.createElement('span');
            caret.setAttribute('data-caret', '');
            typed.append(caret);
            next();
            layer.setAttribute('data-on', '');
        }
        var elapsed = now - t0;
        while (shown < text.length && times[shown] <= elapsed) {
            type(shown);
            shown += 1;
        }
        if (shown >= text.length) {
            caret.remove();
            layer.setAttribute('data-done', '');
            watcher.disconnect();
            return;
        }
        if (shown) place();
        loop = requestAnimationFrame(frame);
    }

    function wake() {
        if (!loop && times && (t0 === null || shown < text.length)) loop = requestAnimationFrame(frame);
    }

    var watcher = new IntersectionObserver(function (entries) {
        near = entries[entries.length - 1].isIntersecting;
        if (near && text === null) {
            text = [];
            fetch(layer.getAttribute('data-src'))
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (data) {
                    if (!data || typeof data.text !== 'string' || !data.text) { watcher.disconnect(); return; }
                    text = Array.from(data.text);
                    rows = data.text.split('\n');
                    hot = data.hot || [];
                    wraps = data.wraps || [];
                    times = plan(text);
                    wake();
                })
                .catch(function () { watcher.disconnect(); });
            return;
        }
        if (near) wake();
    }, { rootMargin: '0px 0px 50% 0px' });
    watcher.observe(section);
})();
