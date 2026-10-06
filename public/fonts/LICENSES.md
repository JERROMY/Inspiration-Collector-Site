# 網頁字型授權

`public/fonts/` 放兩個網頁字型：Google Sans Flex（內文）與 JetBrains Mono（等寬的小標籤）。**兩個都是瘦身過的修改版**：固定掉用不到的可變軸、只留網站用到的字（做法見 `scripts/fonts.mjs` 檔頭與 README 的「字型」一節）。中日文不放網頁字型，走系統字型（見最後一節）。

兩套都是 SIL Open Font License 1.1（OFL）。授權原文是 2026-10-02 用 curl 從官方 repo 抓的原文（不是摘要）；每一節寫了網址、授權檔放哪裡、有沒有宣告保留字型名稱，以及這樣做是不是符合授權。授權檔跟字型一起放在這個資料夾，連同公開 repo 一起公開。

OFL 的條件（兩套原文的 PERMISSION & CONDITIONS 一節相同），我們這樣做：

1. 不能單獨賣字型：網站免費，字型只是網頁的一部分。
2. 每一份都要附版權聲明與授權：授權檔原文在 `licenses/`；字型檔本身的名稱欄位也留著版權（nameID 0）、授權說明（13）、授權網址（14）。
3. 修改版不能用「保留字型名稱」：兩套都沒有宣告保留字型名稱（見各節），所以瘦身檔沿用原名（設計系統的 `--font-sans`、`--font-mono` 也才接得上）。
4. 不能用作者的名字替修改版背書：網站上沒有這樣寫。
5. 修改版仍然用 OFL 發布：字型檔與授權檔都在這裡，沒有另外加條件。

## Google Sans Flex

- 授權：SIL Open Font License 1.1
- 原文：https://raw.githubusercontent.com/googlefonts/googlesans-flex/main/OFL.txt 、 https://raw.githubusercontent.com/google/fonts/main/ofl/googlesansflex/OFL.txt 、 https://openfontlicense.org/ 、 https://github.com/googlefonts/googlesans-flex
- 公開 repo：可以（OFL 原文：「Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions」；條件是附授權檔、不單獨賣、修改版不用保留字型名稱）
- 授權檔：`licenses/OFL-GoogleSansFlex.txt`
- 保留字型名稱：沒有（依據：官方 repo 的 OFL.txt 第 1 行版權聲明「Copyright 2022 The Google Sans Flex Project Authors (github.com/googlefonts/googlesans-flex)」後面沒有「with Reserved Font Name …」；全文出現 Reserved Font Name 的只有前言、定義與第 3 條，沒有任何一行寫出具體名稱；官方 repo 的 README 有一節 License，原文是「SIL Open Font License, without Reserved Font Names.」；字型檔的版權欄位也沒有；GitHub 與 Google Fonts 的授權欄位都是 OFL 1.1）
- CSS 名稱：`Google Sans Flex`
- 這裡放的檔：`GoogleSansFlex-site.woff2`，修改版：固定掉 wdth（100）、slnt（0）兩個軸，光學尺寸 opsz 留 8～64、字重 wght 留 300～700，只留 U+0020～007E 與網站文字用到的字，格式是 WOFF2。
- 版權聲明不一致：字型檔裡寫「Copyright 2015 The Google Sans Flex Authors (https://github.com/googlefonts/googlesans-flex)」（我們保留它，Google Fonts 的 OFL.txt 寫的也是這句）；官方 repo 的 OFL.txt 寫 2022 與 Project Authors；Google Fonts 的 METADATA.pb 寫 2025。三處授權都是 OFL 1.1、都沒有保留字型名稱，不影響條件；`licenses/` 放的是官方 repo 的那份原文，沒有改。哪個年份才對，以字型作者的說法為準，沒查到。
- 查核（2026-10-02）：「原文」那一列的網址都用 `curl -sSIL` 看過，最後是 200；`licenses/OFL-GoogleSansFlex.txt` 與官方 repo 的原文逐位元組相同（4397 位元組）；官方 repo 的 README（原文：https://raw.githubusercontent.com/googlefonts/googlesans-flex/main/README.md ）License 一節只寫了上面那一句；GitHub API 回傳 `license.spdx_id` 是 `OFL-1.1`。

## JetBrains Mono

- 授權：SIL Open Font License 1.1
- 原文：https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt 、 https://openfontlicense.org/ 、 https://github.com/JetBrains/JetBrainsMono
- 公開 repo：可以（官方 README 的 License 一節：「JetBrains Mono typeface is available under the OFL-1.1 License and can be used free of charge, for both commercial and non-commercial purposes. You do not need to give credit to JetBrains, although we will appreciate it very much if you do.」；OFL 原文的條件同上）
- 授權檔：`licenses/OFL-JetBrainsMono.txt`
- 保留字型名稱：沒有（依據：官方 repo 的 OFL.txt 第 1 行版權聲明「Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)」後面沒有「with Reserved Font Name …」；全文出現 Reserved Font Name 的只有前言、定義與第 3 條，沒有任何一行寫出具體名稱；字型檔的版權欄位也沒有；GitHub 的授權欄位是 OFL 1.1）
- CSS 名稱：`JetBrains Mono`
- 這裡放的檔：`JetBrainsMono-site.woff2`，修改版：只切子集（U+0020～007E 與網站文字用到的字），可變軸不動（字重 100～800），格式是 WOFF2。
- 查核（2026-10-02）：「原文」那一列的網址都用 `curl -sSIL` 看過，最後是 200；`licenses/OFL-JetBrainsMono.txt` 與官方 repo 的原文逐位元組相同（4399 位元組）；GitHub API 回傳 `license.spdx_id` 是 `OFL-1.1`。官方 README 另外寫「The source code is available under Apache 2.0」，指的是字型的原始碼，我們用的是編譯好的字型檔，不涉及。

## Glow Sans TC（不放）

- 公開 repo：不放（原因：中文不放網頁字型，改走系統字型。完整字型缺「教」「告」「清」「真」「・」「↺」這幾個字，連教學影片的「教」都沒有，掉到系統字型就會一個詞兩種字體；改用分片，中文頁要下載 7～14 MB；設計稿一開始排的就是系統中文字型。以上是這個專案 2026-10-02 自己量到與決定的）
- 授權：沒查（不放進來，就不需要附授權檔）
- 授權檔：無
- 中文改走：系統字型，也就是設計系統 `--font-zh` 的回退：PingFang TC（mac）、微軟正黑體 UI（Windows）、Noto Sans TC。日文本來就走系統字型（Hiragino、Yu Gothic、Noto Sans JP）。

## 怎麼驗

不用信上面的結論，自己抓原文對一次（在 `public/fonts/` 裡跑）：

```
curl -sSIL https://raw.githubusercontent.com/googlefonts/googlesans-flex/main/OFL.txt | grep -i "^HTTP"
curl -sS https://raw.githubusercontent.com/googlefonts/googlesans-flex/main/OFL.txt | diff - licenses/OFL-GoogleSansFlex.txt
curl -sS https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt | diff - licenses/OFL-JetBrainsMono.txt
grep -n -i "reserved" licenses/OFL-*.txt
```

第一行會印出每一次轉址的狀態，最後一個要是 `HTTP/2 200`。第二、三行是 `diff`：沒有任何輸出才算過（輸出有東西，就是原文跟我們放的不一樣）。最後一行的 `grep`，每個檔只會有三行（前言、定義、第 3 條）。
