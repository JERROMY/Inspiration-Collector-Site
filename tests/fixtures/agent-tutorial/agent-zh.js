/* 4-b8 測試用：形狀照 tutorial/agent-zh.js 縮小（不是真的跑出來的結果）。
 * 格式：window.AGENT = { … }（這一句在註解裡，不能被當成真的那一行）。
 * 不要手改內容 —— 這裡是 fixture，改了測試要跟著改。 */
window.AGENT = {
 "model": "claude-opus-5[1m]",
 "prompt": "分析這個資料夾的素材，幫我整理成大綱。用途：深海解謎遊戲。",
 "steps": [
  [
   "Bash",
   "ls -la ."
  ],
  [
   "Read",
   "README.md"
  ],
  [
   "Write",
   "OUTLINE.md"
  ]
 ],
 "outline": "# 深海解謎遊戲 — 素材大綱\n\n整理自 `深海解謎遊戲/` 資料夾（2026-09-27）。\n\t縮排用 Tab；全形空白：「\u3000」；不換行空白：「\u00a0」。\n網址 https://example.com/a//b 不是註解，/* 這也不是註解 */ 也不是。\n引號 \"雙\" '單'、反斜線 \\ 與 </script>。\n表情 🐋✨、𠮷、—、…\n",
 "reply": "大綱已寫好：`OUTLINE.md`。\n\n下一步：\n- 配色\n- 地形",
 "say": "讀完了：3 筆素材。"
};
