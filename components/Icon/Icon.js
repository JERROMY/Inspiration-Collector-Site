/**
 * Icon —— 一個圖示（mask 畫，顏色跟著字走；樣式在 app/styles/global.css 的「圖示」那一段，圖示檔在 public/icons/）。
 *
 * 收：name（data-icon 的名字：list、close、arrow、社群代號…）。給：一個空的 <span>，讀屏跳過（旁邊的字或按鈕的 aria-label 才是名字）。
 *
 * @param {{ name: string }} props
 */
export default function Icon({ name }) {
    return <span className="i" data-icon={name} aria-hidden="true" />;
}

/**
 * 同一個圖示的 HTML 字串：給 lib/bind-tail.js 的 tail（使用者寫的公告標題是 HTML 字串，箭頭要插在裡面）。
 * name 是程式裡寫死的名字，不是使用者的字，所以不用跳脫。
 *
 * @param {string} name data-icon 的名字
 * @returns {string} 跟 <Icon> 一樣的 HTML
 */
export function iconHtml(name) {
    return `<span class="i" data-icon="${name}" aria-hidden="true"></span>`;
}
