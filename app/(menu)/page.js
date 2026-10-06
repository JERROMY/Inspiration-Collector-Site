import { rootMetadata } from '../seo.js';
import Solo from '../../components/Solo/Solo.js';

// 三語的標題、三語的一句話、canonical 指到 /、語言版本、分享卡、圖示（app/seo.js；規格書 §10）
export const metadata = rootMetadata();

/**
 * / 的三語選單：有 JS 時 <head> 的 pick-lang.js 在畫面出來之前就跳到語言頁；關掉 JS 的人與不執行 JS 的爬蟲看到的就是這一頁。
 * 整頁是英文（<html lang="en">）；產品名、說明、語言鈕各標自己的 lang（版型在 components/Solo，跟 404 同一套）。
 */
export default function MenuPage() {
    return <Solo ids={{ title: 'root.name', lead: 'root.lead', btn: 'root.pick' }} lazyMark />;
}
