'use client';

import { useEffect } from 'react';

/**
 * Hydrated —— React 接手（hydrate）之後發一個信號給 public/motion.js：window.__collectorHydrated ＝ true，再發 'collector:hydrated' 事件。
 *
 * 為什麼要等：動態 A 要把大標括號裡的字拆成一字一個 span。在 React 接手之前改 React 畫的字，React 會報錯 #418、整頁重畫
 * （連 <html> 上加的 class 都被洗掉）。這個元件的 effect 在它所在的那一段接手之後才跑，所以放在首屏裡、大標的後面。
 *
 * 收：沒有。給：什麼都不畫。
 */
export default function Hydrated() {
    useEffect(() => {
        window.__collectorHydrated = true;
        window.dispatchEvent(new Event('collector:hydrated'));
    }, []);
    return null;
}
