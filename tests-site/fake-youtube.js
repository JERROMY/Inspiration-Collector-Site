// 假的 YouTube IFrame Player API（不是測試；09 教學影片的測試用）。測試不連 YouTube：頁面要的 iframe_api 由這裡回一小段腳本，播放器的時間跟著頁面的時鐘走
// （測試用 Playwright 的 page.clock 快轉）。契約寫在 README.md「09 教學影片（F7）」。
//
// installFakeYouTube(context, { preloaded })  在這個 context 上（preloaded 見函式上面的說明）：
//   1. addInitScript：把假的 YT（Player、PlayerState）放在 window.__fakeYT —— 還不是 window.YT，要等網頁自己載入 iframe_api 才換上；
//   2. route：往 YouTube 那幾個網域的請求全部攔下來 ——
//        https://www.youtube.com/iframe_api → 回一段腳本，照真的那一支：第一次執行設 YT.loading = 1、YT.ready（排隊）、再載 WIDGET_API；
//          之後再執行什麼都不做（真的 iframe_api 的防重入：不會再叫 onYouTubeIframeAPIReady）；
//        WIDGET_API → 換上假的 YT.Player、PlayerState，叫 YT.ready 排著的、再叫 window.onYouTubeIframeAPIReady（有的話）；
//        <任何網域>/embed/<ID>（播放器的 iframe）→ 回一頁空白 HTML；
//        其他（縮圖、統計、廣告…）→ 擋掉（abort）。
//      每一個請求都記在回傳的 requests（{ url, host, kind: 'api'｜'widget'｜'embed'｜'other' }），F7.1 用它量「沒按之前沒有任何請求」。
//      要讓某一個晚到或不回，測試在這一層上面再加一層 route（後加的先比對），放行時叫那個 route 的 fallback()。
// 頁面裡看得到的（page.evaluate）：
//   window.__ytLog      [{ fn, ... }]：new（host、videoId、playerVars、iframe 的 src）、loadVideoById／cueVideoById（videoId、start、end）、seekTo、playVideo、pauseVideo、stopVideo、state（換到哪個狀態、當時的秒數）
//   window.__ytPlayers  建過的每一個假播放器（最後一個是現在用的）；player.getCurrentTime()、getPlayerState()、getVideoData().video_id 跟真的一樣叫
//   window.__ytNoReady  測試設成 true 之後建的播放器（iframe 照樣插進去）永遠不叫 onReady、也不自己播（量「播放器建了卻一直沒好」）
export const YT_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|ggpht\.com|youtu\.be|doubleclick\.net|googleads\.g\.doubleclick\.net)$/i;
export const IFRAME_API = 'https://www.youtube.com/iframe_api';
// 真的 iframe_api 會再載一支 www-widgetapi.js（播放器本體）；假的照做，測試才分得開「iframe_api 到了」與「播放器程式好了」
export const WIDGET_API = 'https://www.youtube.com/s/player/fake/www-widgetapi.vflset/www-widgetapi.js';
// 整支教學片的長度（秒）：第 16 章在 529（8:49）結束，後面 14 秒的結尾卡不算一章
export const DURATION = 543;

// 在頁面裡跑（addInitScript 的 [函式, 參數]）：假的 YT 物件，時間用 Date.now()（page.clock 管得到）
function fakeYT(duration) {
    const log = [];
    window.__ytLog = log;
    window.__ytPlayers = [];
    const now = () => Date.now();
    const State = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
    class Player {
        constructor(target, opts = {}) {
            const el = typeof target === 'string' ? document.getElementById(target) : target;
            this.opts = opts;
            this.pv = { ...(opts.playerVars || {}) };
            this.state = State.UNSTARTED;
            this.base = Number(this.pv.start) || 0;
            this.t0 = now();
            this.end = this.pv.end !== undefined ? Number(this.pv.end) : null;
            this.listeners = {};
            let iframe = el;
            if (!el || el.tagName !== 'IFRAME') {
                iframe = document.createElement('iframe');
                const host = (opts.host || 'https://www.youtube.com').replace(/\/+$/, '');
                const q = new URLSearchParams({ enablejsapi: '1' });
                for (const [k, v] of Object.entries(this.pv)) q.set(k, String(v));
                iframe.src = `${host}/embed/${opts.videoId || ''}?${q}`;
                if (opts.width) iframe.width = opts.width;
                if (opts.height) iframe.height = opts.height;
                if (el?.id) iframe.id = el.id;
                iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                if (el) el.replaceWith(iframe);
            }
            this.iframe = iframe;
            const src = new URL(iframe.src, location.href);
            this.videoId = opts.videoId || src.pathname.split('/embed/')[1]?.split(/[/?]/)[0] || null;
            if (!opts.playerVars) for (const [k, v] of src.searchParams) this.pv[k] = v;
            log.push({ fn: 'new', host: opts.host ?? null, videoId: this.videoId, playerVars: this.pv, src: iframe.src });
            window.__ytPlayers.push(this);
            this.tick = setInterval(() => this._check(), 50);
            if (window.__ytNoReady) return;
            setTimeout(() => {
                this._set(State.CUED);
                this._emit('onReady', { target: this });
                if (String(this.pv.autoplay) === '1') this.playVideo();
            }, 0);
        }
        _emit(name, event) {
            this.opts.events?.[name]?.(event);
            for (const fn of this.listeners[name] || []) (typeof fn === 'string' ? window[fn] : fn)?.(event);
        }
        _limit() { return this.end ?? duration; }
        _now() { return this.state === State.PLAYING ? Math.min(this.base + (now() - this.t0) / 1000, this._limit()) : this.base; }
        _set(state) {
            if (this.state === state) return;
            this.state = state;
            log.push({ fn: 'state', state, t: Math.round(this._now() * 100) / 100 });
            this._emit('onStateChange', { target: this, data: state });
        }
        _check() {
            if (this.state === State.PLAYING && this.base + (now() - this.t0) / 1000 >= this._limit()) {
                this.base = this._limit();
                this.t0 = now();
                this._set(State.ENDED);
            }
        }
        _load(args, play) {
            const o = typeof args[0] === 'object' && args[0] !== null ? args[0] : { videoId: args[0], startSeconds: args[1] };
            this.videoId = o.videoId ?? o.mediaContentUrl ?? this.videoId;
            this.base = Number(o.startSeconds) || 0;
            this.end = o.endSeconds !== undefined ? Number(o.endSeconds) : null;
            this.t0 = now();
            log.push({ fn: play ? 'loadVideoById' : 'cueVideoById', videoId: this.videoId, start: this.base, end: this.end });
            this.state = State.UNSTARTED;
            this._set(play ? State.PLAYING : State.CUED);
        }
        loadVideoById(...args) { this._load(args, true); }
        cueVideoById(...args) { this._load(args, false); }
        playVideo() {
            log.push({ fn: 'playVideo', t: this._now() });
            if (this.state === State.ENDED) this.base = this.end ?? 0;
            if (this.state !== State.PLAYING) { this.t0 = now(); this._set(State.PLAYING); }
        }
        pauseVideo() {
            log.push({ fn: 'pauseVideo', t: this._now() });
            this.base = this._now();
            this.t0 = now();
            this._set(State.PAUSED);
        }
        stopVideo() {
            log.push({ fn: 'stopVideo', t: this._now() });
            this.base = this._now();
            this._set(State.CUED);
        }
        // 真的 seekTo：暫停中按了照樣停著；其他狀態（播放中、已結束、剛載入）會開始播
        seekTo(seconds) {
            this.base = Math.max(0, Math.min(Number(seconds), duration));
            this.t0 = now();
            log.push({ fn: 'seekTo', t: this.base });
            if (this.state !== State.PAUSED) this._set(State.PLAYING);
        }
        getCurrentTime() { return this._now(); }
        getPlayerState() { return this.state; }
        getDuration() { return duration; }
        getVideoData() { return { video_id: this.videoId }; }
        getVideoUrl() { return `https://www.youtube.com/watch?v=${this.videoId}`; }
        getIframe() { return this.iframe; }
        addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
        removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn); }
        mute() {}
        unMute() {}
        isMuted() { return false; }
        setVolume() {}
        getVolume() { return 100; }
        destroy() {
            log.push({ fn: 'destroy' });
            clearInterval(this.tick);
            this.iframe?.remove();
        }
    }
    window.__fakeYT = { Player, PlayerState: State, loaded: 1 };
}

// iframe_api 的回應（照真的那一支）：第一次執行才設 YT.loading、載 widgetapi；之後再執行什麼都不做
const API_SCRIPT = `(function () {
    if (!window.YT) window.YT = { loading: 0, loaded: 0 };
    var YT = window.YT;
    if (YT.loading) return;
    YT.loading = 1;
    var queue = [];
    YT.ready = function (f) { if (YT.loaded) f(); else queue.push(f); };
    window.onYTReady = function () { YT.loaded = 1; queue.forEach(function (f) { f(); }); };
    var s = document.createElement('script');
    s.src = ${JSON.stringify(WIDGET_API)};
    s.async = true;
    document.head.appendChild(s);
})();`;

// widgetapi 的回應：換上假的 Player，叫 YT.ready 排著的、再叫網頁的 onYouTubeIframeAPIReady（跟真的一樣是載好之後才叫）
const WIDGET_SCRIPT = `(function () {
    window.YT.Player = window.__fakeYT.Player;
    window.YT.PlayerState = window.__fakeYT.PlayerState;
    if (typeof window.onYTReady === 'function') window.onYTReady();
    if (typeof window.onYouTubeIframeAPIReady === 'function') window.onYouTubeIframeAPIReady();
})();`;

// preloaded：頁面一打開 window.YT 就已經是載好的樣子（YT.Player、PlayerState、loading＝1、loaded＝1），但**沒有 YT.ready** ——
//   模擬別的程式先載好了播放器程式（或瀏覽器擴充、舊版的 iframe_api 留下來的 YT）。量「已經有 YT.Player 就直接用、不再插 iframe_api、也不等 YT.ready」。
export async function installFakeYouTube(context, { preloaded = false } = {}) {
    const requests = [];
    await context.addInitScript(fakeYT, DURATION);
    if (preloaded) await context.addInitScript(() => { window.YT = { loading: 1, loaded: 1, Player: window.__fakeYT.Player, PlayerState: window.__fakeYT.PlayerState }; });
    await context.route((url) => YT_HOSTS.test(url.hostname), async (route) => {
        const url = new URL(route.request().url());
        const hit = { url: url.href, host: url.hostname, kind: 'other' };
        requests.push(hit);
        if (url.hostname === 'www.youtube.com' && url.pathname === '/iframe_api') {
            hit.kind = 'api';
            await route.fulfill({ status: 200, contentType: 'text/javascript', body: API_SCRIPT });
        } else if (url.href === WIDGET_API) {
            hit.kind = 'widget';
            await route.fulfill({ status: 200, contentType: 'text/javascript', body: WIDGET_SCRIPT });
        } else if (url.pathname.startsWith('/embed/')) {
            hit.kind = 'embed';
            await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fake player</title>' });
        } else {
            await route.abort();
        }
    });
    return { requests };
}

// 一章的起點／終點顯示成 m:ss（0:00、8:49）
export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
