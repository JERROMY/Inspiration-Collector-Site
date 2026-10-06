<!--
這支檔是網站上的「更新紀錄」（英文版）。中文版、日文版是 changelog.zh.md、changelog.ja.md，
三支的版本、順序、每一版的條數要一樣，三種語言同一版的日期要一樣。

格式：一版一段，最新的寫在最上面。下面是範例（版本號與日期是假的，寫在說明裡不會顯示）：

## 1.2.3 · 2026-01-31
- Fixed: 這一版修好了什麼
- New: 這一版多了什麼

標題是「## 版本號 · 上架那天」：## 後面空一格，中間的點是「·」，點的兩邊各空一格，日期寫 YYYY-MM-DD。
底下一行一條，用「- 」開頭（減號後面空一格），「Fixed:」「New:」這類開頭是這一條的類型，冒號後面接內容。

改完存檔，網站通常幾分鐘，最久約 20 分鐘會更新。
寫壞了（例如日期打錯、少了「- 」）：網站上那一條會顯示「這一條讀不到」，其他照常，整個網站不會壞。
版本標題（「## 1.0.5 · 日期」那行）寫壞時，那一版底下的每一條都會跟著讀不到。
-->

## 1.0.5 · 2026-10-02
- Fixed: after ChatGPT's redesign the "Save this" button disappeared and "Save page" could not find the messages
- New: if a site changes its layout again, the collector now tries to find the conversation on its own (ChatGPT, Claude, Perplexity), so it keeps working until the next update
- Fixed: if the folder you collect into is deleted or moved, the collector goes back to the "Choose folder…" screen and says why, instead of looking as if nothing happened

## 1.0.4 · 2026-09-30
- Fixed: thumbnails overlapping in grid view when there are many of them
- Fixed: saving several images or files now ends with "Saved N images / files" instead of just "Saved"
- Fixed: list titles no longer carry link or image syntax (Perplexity replies that open with a citation, ChatGPT image replies)
- Fixed: text cut off or squeezed in the English and Japanese interface (the top label, sources in the list, dialog buttons)
- Japanese interface now uses a Japanese font and breaks lines between phrases
- Removed the button that popped up after selecting text: select, right-click and choose "Save selection to Collector" — selecting text no longer adds a button to the page
