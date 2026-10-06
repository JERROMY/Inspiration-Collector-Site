// 01 導覽列：☰ 選單的讀屏名字與開合、語言切換（規格書第 4 節、第 5 節 01）。
//
// 一般的腳本，在 <head> 裡用 <script src="/nav.js" defer> 載入（畫完才跑，不擋畫面）。沒有它時：
// ☰ 照樣用原生的 popover 打得開（Esc、點外面會關），語言切換就是一般的連結。
//
// ☰（data-menu-button，aria-controls 指到選單）：
// - 支援 popover：開合交給瀏覽器（popovertarget）；這裡跟著換讀屏名字與 aria-expanded，點了選單裡的連結就收起來。
// - 不支援 popover：拿掉 popovertarget 與 popover，改用 data-open 自己開合，Esc、點外面、點連結都會關。
// 語言切換（a[data-lang]）：把目前的錨點帶過去（/zh/#faq → /ja/#faq，直接一次導航），
// 記住選的語言（localStorage 的 collector-lang；存不了照樣切）。
(function () {
    'use strict';

    var LANG_KEY = 'collector-lang';

    var button = document.querySelector('[data-menu-button]');
    var menu = button ? document.getElementById(button.getAttribute('aria-controls')) : null;

    if (button && menu) {
        var openLabel = button.getAttribute('aria-label');
        var closeLabel = button.getAttribute('data-label-close') || openLabel;
        var close;

        var show = function (open) {
            button.setAttribute('aria-label', open ? closeLabel : openLabel);
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        if (typeof menu.showPopover === 'function') {
            // beforetoggle 在狀態換掉之前同步發生：按下去的那一刻讀屏名字就對了
            menu.addEventListener('beforetoggle', function (event) {
                show(event.newState === 'open');
            });
            close = function () {
                if (menu.matches(':popover-open')) menu.hidePopover();
            };
        } else {
            button.removeAttribute('popovertarget');
            menu.removeAttribute('popover');
            var isOpen = false;
            var set = function (open) {
                isOpen = open;
                if (open) menu.setAttribute('data-open', '');
                else menu.removeAttribute('data-open');
                show(open);
            };
            button.addEventListener('click', function () {
                set(!isOpen);
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && isOpen) {
                    set(false);
                    button.focus();
                }
            });
            document.addEventListener('click', function (event) {
                if (isOpen && !menu.contains(event.target) && !button.contains(event.target)) set(false);
            });
            close = function () {
                set(false);
            };
        }

        // 點了選單裡的連結就收起來（連結照常跳到那一區）
        menu.addEventListener('click', function (event) {
            if (event.target instanceof Element && event.target.closest('a')) close();
        });
    }

    document.addEventListener('click', function (event) {
        var link = event.target instanceof Element ? event.target.closest('a[data-lang]') : null;
        if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        try {
            localStorage.setItem(LANG_KEY, link.getAttribute('data-lang'));
        } catch (err) {
            // 存不了（隱私模式、被擋掉）：照樣切，只是下次打開 / 不會照選過的跳
        }
        if (location.hash) {
            event.preventDefault();
            location.assign(link.getAttribute('href') + location.hash);
        }
    });
})();
