// 4-b8 test fixture: shaped like tutorial/agent-en.js, shrunk (not a real run).
// Do not hand-edit.
window.AGENT = {
 "model": "claude-opus-5[1m]",
 "prompt": "Analyse the material in this folder and turn it into an outline. For: a deep-sea puzzle game.",
 "steps": [
  [
   "Bash",
   "ls -la . && find . -type f | head -200"
  ],
  [
   "Read",
   "MATERIAL.md"
  ],
  [
   "Read",
   "index.json"
  ],
  [
   "Write",
   "OUTLINE.md"
  ]
 ],
 "outline": "# Deep-sea puzzle game — reference outline\n\nIt’s “quoted” – with an en dash.\n",
 "reply": "Outline written to `OUTLINE.md`.",
 "say": "All read."
};
