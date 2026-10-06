/* 4-b8 テスト用：tutorial/agent-ja.js の形を小さくしたもの（本物の実行結果ではありません）。 */
window.AGENT = {
 "model": "claude-opus-5[1m]",
 "prompt": "このフォルダの素材を分析し、アウトラインにまとめてください。",
 "steps": [
  [
   "Bash",
   "ls -la ."
  ],
  [
   "Write",
   "OUTLINE.md"
  ]
 ],
 "outline": "# 深海パズルゲーム 素材アウトライン\n\n※凡例：〔素〕＝素材\n",
 "reply": "分析結果を `OUTLINE.md` にまとめました。",
 "say": "5件すべて読みました。"
};
