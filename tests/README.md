# homepage/site 的測試

跑法（在 `homepage/site/`）：

```
npm test                                         整套
npm test -- --test-name-pattern "B1.4"           只跑某一條案例（-- 後面照原樣交給 node --test）
npm test -- --test-name-pattern "修補"            只跑第 1 次修補加的案例
npm test -- --test-name-pattern "二修"            只跑第 2 次修補加的案例
npm test -- --test-name-pattern "三修"            只跑第 3 次修補加的案例
npm test -- --test-name-pattern "四修"            只跑第 4 次修補加的案例
npm test -- --test-name-pattern "五修"            只跑第 5 次修補加的案例
node --test tests/news.test.js                   只跑一支
npm test -- --test-name-pattern "B2"             只跑 4-b2（孤字綁定、教學章節轉換）
SITE_REAL_ROOT=<主資料夾> npm test -- --test-name-pattern "B2.5"   用真的教學片時間表跑（沒設就 skip）
```

`scripts/test.mjs` 自己列 `tests/*.test.js`，不靠 shell 的萬用字元、也不靠 `node --test <目錄>`（理由寫在那支檔頭）。
`helpers.js` 是共用的小工具；`fixtures/content/` 是一份好的 content/ 資料夾；
`fixtures/crlf-bom/` 刻意是 CRLF 行尾＋UTF-8 BOM，同資料夾的 `.gitattributes` 寫 `* -text`，不讓 git 改成 LF（測試另有防呆：檔案被改成 LF 就先紅）。
`fixtures/chapters/` 是兩個假的專案根目錄（4-b2）：`project/` 16 章、`small/` 4 章，各有 `tutorial/chapters.js` 與 `tutorial/preview/timetable-<zh|en|ja>.txt`；`chapters-fixture.js` 是章節測試共用的小工具（不是測試）。

## 介面細則（4-b1：讀更新紀錄、公告、社群連結）

給後端照著實作。沒標記的是測試工程師寫第一版時挑的 13 條（有幾條順手併進派工人員原本介面裡的細節），
標〔修補 N〕的是派工人員 2026-10-02 決定的 9 條；標〔二修〕的是第 2 次修補（派工人員的 2 條決定＋後端提、派工人員接受的細則）；標〔三修〕的是第 3 次修補（檢查員抓到、派工人員決定的）。都經派工人員接受。後面的條目跟前面衝突時照後面的（例如第 41 條改了內文接起來的方式）。
基本介面（函式名稱、回傳的形狀）以派工人員的公開介面為準，這裡只寫細則。

**共通**

1. 欄位要剛好：好紀錄的欄位剛好照介面，不多不少。壞紀錄只有 `ok`、`line`、`raw`、`reason` 四欄；readContent 讀不到的位置只有 `ok`、`reason`。
2. `raw` 是那一行的原文（測試比對時去掉頭尾空白；不准帶 `\r`）。`line` 是原檔行號，1 起算，註解行、空行都算進去。
3. 壞紀錄留在檔案裡原本的位置，不集中到最後。
4. `reason` 是中文，要講到壞的那一欄：日期、版本、標題、類別、https、置頂、「·」、代號、連結、代號重複、註解與 `-->`（看是哪一種壞法）。
   readContent 讀不到的那一區要寫出那支檔的檔名；不是 UTF-8 的還要寫「UTF-8」。
5. 整檔空白（空檔、只有空行、只有註解）：parse 回 `[]`；readContent 那一區是 `{ ok: true, entries: [] }`，不算讀不到（公告本來就可以一則都沒有）。
6. 二進位：合法 UTF-8 但夾著 NUL 位元組的檔，也是 `{ ok: false }`。檔案存在但讀不了（測試用「那個檔名是一個資料夾」模擬）也是 `{ ok: false }`。
7. 整個 content/ 資料夾不存在：七個位置都 `{ ok: false }`，不丟例外。
8. 〔修補 1〕註解沒關起來（有 `<!--` 沒有 `-->`）：回一筆壞紀錄（`line`＝註解開頭那行、`raw`＝那行、`reason` 講「註解沒關起來（缺 -->）」），
   **註解開頭之後的內容照常當一般內容解析**（不吞掉，不能整支靜靜變零筆）。
9. 〔修補 3〕行尾 `\r\n` 與檔案開頭的 UTF-8 BOM 都要正常處理：結果、行號、`raw` 都跟 LF、沒有 BOM 的版本一樣。
   parse 函式直接收到帶 BOM 的字串也一樣；readContent 讀到帶 BOM 的檔也一樣。
10. 〔修補 8〕不在任何區塊底下的雜字（例如第一個「##」之前），每一個非空白、非註解的行各一筆壞紀錄。
11. 〔修補 9〕註解可以出現在檔案任何位置（開頭前有空行、中間、結尾，公告內文中間也可以）：整段去掉、不當內容、不算錯，行號不變。
    註解裡寫的範例（「## …」「- …」「連結：」「置頂」）一律不算。

**更新紀錄（changelog）**

12. 標題「## 版本 · 日期」用「 · 」（空白＋·＋空白）切，〔修補 4〕只能剛好兩段，多一段算壞。版本標題壞掉時，整個區塊算一筆壞紀錄，`line`／`raw` 指標題那一行；底下的「- 」行不另外算。
13. 日期是 YYYY-MM-DD 而且是真的日曆日期（2026-02-29 壞、2028-02-29 好）；版本號只收 x.y.z（每段可以多位數）。
14. kind：取第一個全形「：」或半形「:」之前的字，kind 與 text 都去掉頭尾空白；沒有冒號的整行當 text、kind 是空字串。
    〔修補 7〕冒號後面緊接著 `//` 的不算分隔（`- See https://…` 的 kind 是空字串、text 是整行；`- Fixed: https://…` 的 kind 是 Fixed）。
15. 版本裡不是「- 」開頭的行，只壞那一條 item。〔修補 6〕版本底下一條都沒有也算好的（`items: []`）。

**公告（news）**

16. 標題「## 日期 · 類別 · 標題」〔修補 4〕只切前兩個「 · 」，後面的「 · 」留在標題。類別是自由文字、不能空白；標題不能空白。
17. 沒寫連結：`link` 是 `null`。〔修補 2〕「連結：」與「連結:」（全形、半形冒號）都收，網址只收 https，不是 https 整則壞。
18. 〔修補 2〕三種語言的公告檔都用中文的「連結：」「置頂」。「置頂」前後有空白也算（trim 之後相等）。
19. 〔修補 2〕看起來是連結但寫法不對（以 link、リンク、连结、url 開頭，不分大小寫，後面接冒號）→ 整則壞，`reason` 講「看起來是連結但寫法不對，請寫『連結：https://…』」。
    後面沒接冒號的句子（`Link to the docs…`、`URL 不要貼太長。`）照常是內文。
20. 置頂寫法不對（以「置頂」「置顶」開頭但不等於「置頂」，或整行是 pinned／pin，不分大小寫）→ 整則壞。內文句子中間出現「置頂」不算。
21. 連結或置頂寫壞讓整則壞的時候，`line`／`raw` 指寫壞的那一行，不是標題那一行。
22. id：`n-` 加 date＋title 的 sha256 前 8 碼十六進位；跟順序、行號、內文、連結、置頂、類別都無關（測試不比對確切的值，只量格式與這些性質）。

**社群連結（links）**

23. 一行一個「- 代號 · 網址」；代號只收 `[a-z0-9]+`（大寫、空白、空的都壞），網址只收 https，少了「·」、沒有「- 」開頭都壞。
24. 〔修補 5〕代號重複：先出現的算數，後面重複的那行算壞（`reason` 講「代號重複」）。

**第 2 次修補**

25. 〔二修〕公告日期與標題都相同（id 一定一樣，前端拿 id 當 key 會撞）：先出現的算數，後面重複的那則整則壞，`line`／`raw` 指它的標題行，`reason` 講「日期與標題重複」。
    只跟「好的」比（跟第 33 條代號重複同一個規則）：前一則壞了（例如連結寫壞），後面同日期同標題的那則照常；再下一則同樣的才算重複。
26. 〔二修〕落單的 `-->`（不在註解裡，通常是使用者刪掉了開頭的 `<!--`）：任何檔案裡都是一筆壞紀錄，`line`／`raw` 指那一行，`reason` 講「多出來的 -->（缺開頭的 <!--？）」。
    公告區塊裡的那一行不算進內文，那則照常，壞紀錄放在原位（排在那則後面）。更新紀錄版本中間的那一行算最上層一筆或那版的一條 item 都可以，但只能一筆，那版照常。
27. 〔二修〕公告寫了兩行「連結：」整則壞，`line`／`raw` 指第二行。
28. 〔二修〕更新紀錄「- 修好：」冒號後面是空的、或「- 」後面沒字，那一條 item 壞。
29. 〔二修〕kind 只看第一個冒號：它後面緊接 `//` 就整行沒有 kind（kind 是空字串、text 是「- 」後面整行），不往後找下一個冒號。
30. 〔二修〕社群連結的「 · 」多一段算壞。
31. 〔二修〕年份 0000 算壞（更新紀錄、公告都一樣）。
32. 〔二修〕公告沒有內文算好的（`body` 是空字串）。
33. 〔二修〕代號重複只跟「好的」比：前一條壞了，後面同代號的不算重複。
34. 〔二修〕冒號前有空白也算：「link :」「URL ：」是寫錯的連結（整則壞）；「連結 ：」照常收成連結。
35. 〔二修〕有 NUL 位元組的檔判成二進位（`reason` 寫出檔名就好，不一定講編碼）。
36. 〔二修〕「##」後面要接空白才是標題：公告內文裡的 `###` 是一般內文；更新紀錄版本底下的 `###` 是壞 item。

**第 3 次修補**

37. 〔三修〕標題寫壞不能悄悄併進上一則／上一版：公告區塊或更新紀錄版本底下，去掉開頭的 `#` 與空白之後長得像標題的一行 ——
    公告：以 `YYYY-MM-DD`（或用 `/`、`.` 分隔）開頭，後面緊接著點狀分隔符（`·` U+00B7、`・` U+30FB、`‧` U+2027、`•` U+2022，前後可有空白）；
    更新紀錄：以 `x.y.z` 開頭，後面緊接著點狀分隔符 —— 但不是合法的「## 」標題（`##2026-10-01 · …`、`# …`、`### …`、完全沒寫 `#`），
    就自己開一個新的壞區塊：一筆壞紀錄（`line`／`raw` 指那行標題），它底下的內文、連結、置頂、「- 」條目都屬於它、不另外報錯；上一則／上一版照常。
    `reason` 講「看起來是新的一則公告（一版），標題要寫成『## 』開頭、## 後面空一格」。
    公告內文裡日期開頭、後面沒有點狀分隔符的一般句子（`2026-10-02 起暫停服務。`）仍是內文。
    寫壞的標題出現在檔案最上面（第一個「##」之前）也一樣：自己開壞區塊，底下的內容歸它，不另外各報一筆雜字。
38. 〔三修〕標題的點打錯（合法標題的長相，但分隔符不是 `·` U+00B7，而是 `・` U+30FB、`‧` U+2027、`•` U+2022、`･` U+FF65，或點兩邊是全形空白 U+3000、NBSP U+00A0、Tab）：
    整區塊壞，`reason` 點名實際用的字元，例如「中間的點要用『·』（U+00B7），這一行用的是『・』（U+30FB）」（Tab 講 Tab 或 U+0009 都可以）；
    點的兩邊沒空格要講「點的兩邊各空一格」。
39. 〔三修〕公告內文裡會靜靜變成內文的連結寫法，整則壞，`reason` 講「看起來是連結但寫法不對，請寫『連結：https://…』」：
    ① 整行只有一個網址；② 短標籤（≤ 8 字、不是「連結」）＋冒號＋網址（`網址：https://…`、`链接：…`、`詳情: https://…`、`Docs: https://…`）；
    ③ 以「連結／链接／網址」開頭、後面接空白再接網址（少了冒號）。句子中間夾網址、標籤很長的句子照常是內文。
40. 〔三修〕置頂的變體：去掉空白與 `【】[]（）()「」『』:：!！` 之後，剩下的（不分大小寫）等於置頂、置顶、pin、pinned、ピン留め、ピン止め，
    但整行 trim 後不等於「置頂」→ 整則壞（`reason` 同置頂寫法不對）。
41. 〔三修；**〔派工 4-b9〕作廢**，改成保留換行，見「4-b9」第 1 條〕公告內文多行接成一段：接縫的前一行結尾或下一行開頭是中日文字（漢字、平假名、片假名、全形標點與 CJK 標點）就直接接、不加空白；
    否則加一個半形空白。（取代原本「換行用空白」。）
42. 〔三修〕網址要像真的（links.md 與公告的「連結：」都一樣）：`new URL` 解析得了、https、hostname 裡有「.」、不含「…」「...」與空白。
    照抄註解範例 `https://…` 要壞，`reason` 講「網址看起來是範例或不完整」。
43. 〔三修〕更新紀錄版本號重複：先出現的算數，後面重複的整版壞（`reason` 講「版本重複」），只跟好的比（跟社群連結、公告一致）。
44. 〔三修〕kind 的冒號：兩個數字之間的半形冒號（`10:30`）不算分隔符；`://` 照舊不算。
45. 〔三修〕落單的 `-->`（包含寫在句子裡當箭頭的 `設定 --> 進階`）：`reason` 在「多出來的 -->…」後面加「（如果是箭頭，請寫成 → 或 ->）」。

**第 4 次修補**

46. 〔四修〕「##」後面沒空格一律當寫壞的標題：任何一行（去掉前面的空白）以剛好兩個 `#` 開頭、緊接著不是空白也不是 `#` 的字元
    （`##2026-10-01 注意 第二則`、`##更新 · 標題`、`##1.0.4 2026-09-30`），不管後面長什麼樣，都自己開一個新的壞區塊（跟第 37 條一樣：
    `line`／`raw` 指那行、底下內容歸它、上一則／上一版照常）；公告與更新紀錄都適用，檔案最上面也適用。
    `reason` 講「標題要寫成『## 』開頭、## 後面空一格」。`###` 與單獨一個 `#` 的行照第 37 條。
47. 〔四修〕社群連結的點打錯也要點名字元，跟標題（第 38 條）同一種寫法：用了 U+30FB、U+2022 等別的點，或點的兩邊是 NBSP（U+00A0）、
    全形空白（U+3000）、Tab，`reason` 點名實際用的字元；點的兩邊沒空格要講「點的兩邊各空一格」。

**第 5 次修補**

48. 〔五修〕全形井號「＃」（U+FF03，中文輸入法開著全形時打出來的）：任何一行（去掉前面的空白）以「＃」開頭（一個或多個、後面有沒有空格都算，
    例如 `＃＃ 2026-10-01 · 注意 · 第二則`、`＃＃2026-…`、`＃ 2026-…`、`＃＃ 1.0.4 · 2026-09-30`），一律當寫壞的標題，自己開一個新的壞區塊
    （跟第 37、46 條一樣：`line`／`raw` 指那行、底下內容歸它、上一則／上一版照常；檔案最上面也一樣）；
    `reason` 講「井號要用半形的『#』（這一行用了全形的『＃』）」。測試量的是 reason 裡有「半形」與「＃」。

## 已知限制（沒有測試）

- 第 37 條只認 `YYYY-MM-DD`（`/`、`.` 分隔也算）與 `x.y.z` 開頭的行。下面這些寫壞的標題不會被認成標題，之後真的遇到再加：
  `1.0 · 2026-10-02`（版本號少一段、又沒寫 `##`）、`2026年10月2日 · …`（中文日期）會當一般壞行（更新紀錄）或內文（公告）；
  更新紀錄的 `v1.0.4 · 2026-09-30`（沒有 `#`）會報一條壞 item，它底下的條目掛到上一版。
  （有寫「##」只是後面沒空格的，不管後面長什麼樣，已由第 46 條處理，例如 `##2026年10月2日 · …`、`##1.0 · …`；全形井號由第 48 條處理。）
- 同時犯兩個錯 —— 「##」少了空格（或整個沒寫 `#`）又沒寫點，例如 `# 2026-10-01 注意 第二則`、`#2026-10-01 注意 第二則`、`2026-10-01 注意 第二則` ——
  會當一般內文（公告）或壞行（更新紀錄）併進上一則：跟一般句子分不開。
- 測試檔裡的特殊空白、點與井號（U+3000、U+00A0、U+30FB、U+FF03 等）一律寫成 `\uXXXX` 跳脫，不放看不見或長得很像的字面字元；
  只有 `fixtures/crlf-bom/` 的三支檔開頭刻意帶字面的 BOM。
- 公告內文某一行以全形「＃」開頭（例如 hashtag `＃靈感收集器`）會被當成寫壞的標題（第 48 條），那則公告從那一行起變成壞區塊。這是刻意的：寧可讓使用者看到「這一條讀不到」去改，也不要讓寫壞的標題靜靜併進上一則。要在內文放 hashtag 就別放在行首。

## 給前端的備註（不是測試）

- 公告條挑**日期最新的那則**（同一天取檔案裡較上面那則），不看它在檔案裡的位置；置頂那則可能在任何位置。
- 第一則公告可能是 `ok: false`，要有對應的顯示。規格書要求「最新的寫在最上面」，但使用者寫反時讀取程式不報錯。

---

## 介面細則（4-b2：孤字綁定、教學章節轉換）

公開介面（函式名稱、參數、回傳的形狀）以派工人員 2026-10-02 給的為準；下面的細則是測試工程師寫測試時挑的寫法（標〔挑〕），或把派工人員的介面寫成量得到的條件。
編號另起，跟 4-b1 的不相干。

**孤字綁定 `lib/bind-tail.js` 的 `bindTail(text, lang)`**（`tests/bind-tail.test.js`，B2.1～B2.3）

1. `lang` 只收 `'zh'`、`'ja'`、`'en'`，其他（`undefined`、`'zh-TW'`、`'ZH'`、`'jp'`…）丟 `TypeError`；`text` 不是字串（`null`、數字、陣列、有 `toString` 的物件）也丟 `TypeError`。
2. 輸出一律跳脫五種字元：`&`→`&amp;`、`<`→`&lt;`、`>`→`&gt;`、`"`→`&quot;`、`'`→`&#39;`（〔挑〕單引號用 `&#39;`，不用 `&apos;`、`&#x27;`）。輸出裡不會有別的實體。
3. 中文、日文：「最後一個非空行」的最後三個書寫字位（`Intl.Segmenter` 的 grapheme）包進 `<span class="nw">…</span>`。**先數字、再跳脫**：`請看 <b>` → `請看 <span class="nw">&lt;b&gt;</span>`（實體不會被切開）。
4. 什麼都算一個字：漢字、假名、長音符、全形半形標點、括號、引號、空白、英文字母、數字。所以「…」是一個字、「……」兩個、「...」三個；
   〔挑〕中英混排照樣一個字母一個字母算：`支援 Chrome。` → `支援 Chro<span class="nw">me。</span>`（span 的邊界不會在英文單字中間多出斷行點，所以單字不會被拆開）。
5. 不能切開的：emoji（帶膚色、ZWJ 組合、國旗）、組合用濁點（U+3099）、半形片假名＋半形濁點（U+FF9E）、surrogate pair（例如 U+20BB7）—— 都跟前面合成一個字。
6. 結尾的空白與換行（空白、Tab、`\n`、`\r\n`）不算字，原樣（跳脫後）接在 `</span>` 後面。
7. 多行：只有最後一個非空行（只有空白的行算空行）會被包；前面的行原樣（跳脫後）。**不跨行**：最後一行不足三個字就只包那一行有的字，不從上一行借。
8. 不足三個字整段包；空字串回空字串；〔挑〕只有空白與換行的字串原樣回傳、沒有 span。
9. 英文：只跳脫、不包（內容裡有中文也一樣）。**〔派工 4-b9〕作廢**：英文改成最後兩個字也綁，見「4-b9」第 4～8 條。
10. 輸入裡字面的 `<span class="nw">` 只是普通文字，照樣跳脫、照樣數最後三個字；沒有「冪等」這回事（同一段處理兩次會跳脫兩次）。
11. 每一條測試另外量：拿掉我們加的 span、還原實體之後要跟輸入一模一樣（沒有掉字、多字）；中日文非空白的輸入剛好一組 span，英文零組（〔派工 4-b9〕改：英文非空白的輸入也是一組）。

**時間表 `lib/chapters.js` 的 `parseTimetable(text)`**（`tests/chapters.test.js`，B2.4）

12. 每個非空白行是「時間＋空白＋標題」，回傳 `{ start, title }` 的陣列，開頭與結尾那兩行也在裡面。
    〔挑〕`title` 是時間後面的整段、去掉頭尾空白，**含編號**（`'01 安裝到 Chrome'`）；編號由 `buildChapters` 檢查。
13. 時間：`m:ss`（分鐘可以多位數，秒兩位 00～59）或 `h:mm:ss`（分、秒都兩位 00～59）。`0:7`、`1:60`、`1:2:03`、`1:60:00`、`1.05` 都是壞的。
14. 空白行（含只有空白的行）略過，行號照算（1 起算）；結尾沒換行也可以。
15. 丟 `Error` 的情況：缺時間、時間格式不對、〔挑〕只有時間沒有標題、雜行、〔挑〕時間沒有比上一行晚（倒退或**相同**都算，零秒的章沒有意義）。
    訊息要有「第 N 行」與那一行原文。

**`loadChaptersScript(sourceText)`**

16. 用 `node:vm` 在只有 `{ window: {} }` 的沙箱裡跑，設逾時；沙箱裡沒有 `process`、`require`、`module`、`Buffer`。
    〔檢查員第 1 輪〕把 `window.TUTORIAL_CHAPTERS` 拿出來那一步也在沙箱裡、同樣設逾時（`JSON.stringify` 轉成文字再拿出來）：
    它本身是 getter、是 Proxy、或裡面某一層（`zh.list`）是 getter，取值時無限迴圈，都要 5 秒內丟逾時 Error（`tests/chapters-sandbox.test.js`，每條在子程序裡跑、10 秒沒結束就殺掉算紅）。
    無限迴圈要丟 `Error`，訊息有「逾時」或 `timed out`，〔挑〕整條在 5 秒內結束。
17. 丟 `Error` 的情況與訊息要講到的字：沒有 `window.TUTORIAL_CHAPTERS`（`TUTORIAL_CHAPTERS`）、少一種語言（那個語言）、`list` 不是陣列（`list`）、
    某章的 `name`／`desc` 不是字串（`name`／`desc`）、語法錯誤（只要是 Error）。
18. 回傳的物件可以是沙箱那個 realm 的；測試一律先 JSON 轉一次再比（不然 `deepStrictEqual` 會因為原型不同而紅在不相干的地方）。

**`buildChapters({ chapters, timetables })`**

19. 〔挑〕`timetables` 是 `{ zh, en, ja }` 三份**時間表原文（字串）**，`buildChapters` 自己呼叫 `parseTimetable`（這樣格式壞掉的訊息講得出哪一語言）；`chapters` 是 `loadChaptersScript` 的回傳。
20. 時間表的第一行是開頭、最後一行是結尾，中間的才是章；〔挑〕開頭與結尾那兩行的標題不檢查（各語言寫法不同）。
    〔檢查員第 1 輪〕開頭那一行的時間不是 0:00 要丟 Error，講出語言、第幾行（照原檔算，前面有空行就不是第 1 行）與原文 —— 規格書 09 寫「01 從 0:00 算」，開頭不是 0:00 代表時間表本身不對。
    時間表是 CRLF 行尾或開頭有 BOM，結果與行號都跟 LF 版一樣，訊息裡的原文不帶 `\r`。
21. 每章 `{ id, name, desc, start, end }`，〔挑〕欄位就這個順序（命令寫出的 JSON 要逐字相同）。`id` 是 `'01'`～`'16'`；第 1 章 `start` 是 0；每章 `end` ＝ 下一章 `start`；第 16 章的 `end` 是結尾那一行的時間。
22. 章數一定要 16（chapters.js 的 list 與時間表都是）；不是 16 丟 `Error`，訊息有「16」。
23. 章名比對：時間表標題要以「兩位數編號＋空白」開頭、編號＝章序；去掉編號之後，跟 chapters.js 的 `name` 各自去掉**所有**空白再比（`存一則AI回覆` 對得上 `存一則 AI 回覆`）。
    輸出的 `name`、`desc` 是 chapters.js 的原樣，不是時間表的寫法。英文章名可以數字開頭（`05 2 ways to save images`）。
24. 丟 `Error` 的情況與訊息要講到的（語言寫 `zh`／`en`／`ja` 或 中文／英文／日文都算；章寫「第 N 章」，N 可以補零）：
    chapters.js 某語言少一章（語言）、三語章數不一致（語言）、某語言的時間跟其他語言不同（語言＋第 N 章 ——
    第 5 章起點晚一秒時，第 4 章的終點也跟著變，講第 4 或第 5 章都算）、結尾時間不同（語言）、
    編號對不上或沒寫編號（語言＋第 N 章）、章名對不上（語言＋第 N 章）、少一種語言的時間表（語言）、時間表格式壞掉（語言＋第 N 行＋那一行原文）。

**命令 `scripts/chapters.mjs`**（`tests/chapters-cli.test.js`）

25. `node scripts/chapters.mjs [--root <專案根目錄>] [--out <輸出資料夾>]`；預設 root 是這支檔往上三層（跟從哪個資料夾叫無關），預設 out 是 `homepage/site/data/`。
26. 成功：結束碼 0，寫 `chapters.zh.json`、`chapters.en.json`、`chapters.ja.json`，內容剛好是 `JSON.stringify(該語言 16 章, null, 2) + '\n'`；舊檔覆蓋；
    〔挑〕`--out` 不存在就自己建（含中間的資料夾；預設的 `data/` 一開始也不存在）。
27. 出錯：結束碼 1、stderr 有訊息、**輸出資料夾裡的東西一個都不動**（舊的 `chapters.*.json` 一個位元組都不變、不多出檔；〔挑〕所以也不能「先清掉舊檔再算」）。
28. 缺檔：stderr 講出缺哪個檔（`timetable-en.txt`；〔挑〕chapters.js 要帶路徑 `tutorial/chapters.js`，免得 `lib/chapters.js` 的堆疊混過去）。
29. 結構（`tests/structure-b2.test.js`，B2.6）：只 import `node:` 內建與 `../lib/chapters.js`、不 import `node:vm`、呼叫 `loadChaptersScript` 與 `buildChapters`；
    程式裡沒有 `\d` 的正規表示式、不碰 `TUTORIAL_CHAPTERS`、不自己定義那三個函式；import 之前的檔頭註解寫「重算」「重跑」與 `node … chapters.mjs`。
    兩支 lib 檔頭有 JSDoc（`@param`、`@returns`）、只用 `node:` 與相對路徑；`package.json` 沒有任何 dependencies。

**真的資料（B2.5，`tests/chapters-real.test.js`）**

30. 只有設了 `SITE_REAL_ROOT` 才跑，沒設就 skip（印原因）；〔挑〕設了但那裡沒有 `tutorial/chapters.js` 或三份時間表就紅（路徑打錯不能靜靜略過）。
    量：三語各 16 章、id 01～16、第 1 章從 0 起、第 16 章結束在 529（8:49）、每章 end ＝ 下一章 start、三語時間逐章相同、章名與摘要跟 `tutorial/chapters.js` 逐章相同。
    〔檢查員第 1 輪〕另外比：已提交的 `homepage/site/data/chapters.<zh|en|ja>.json` 跟重算的結果位元組相同；沒有那三個檔就紅，講「請執行 npm run chapters」。
    Windows cmd 要寫 `set "SITE_REAL_ROOT=C:\…\GPTPlugins" && npm test -- --test-name-pattern "B2.5"`（有引號，不然 `&&` 前面的空白會變成值的一部分）。

## 已知限制（4-b2，沒有測試）

- 預設的 `--out`（`homepage/site/data/`）沒量：一跑就會寫進專案。預設的 `--root` 有量（從暫存資料夾叫）。
- 「出錯不寫檔」只量了讀檔與轉換時的錯；寫到一半才失敗（磁碟滿、沒有權限、同名的資料夾擋著）沒量。
- CRLF 與 BOM 的時間表只用假專案的時間表量（內容跟真的同一個形狀）；真的時間表的 CRLF 版與加 BOM 版是檢查員實測過，沒寫成測試。
- 開頭那一行只檢查時間（要是 0:00），開頭與結尾兩行的標題不檢查（刻意的，見第 20 條）。
- `bindTail` 的「結尾的空白」測試只量了半形空白、Tab、`\n`、`\r\n`；結尾的全形空白（U+3000）、NBSP（U+00A0）也留在 span 外面，這是對的（檢查員實測過，沒寫成測試）。
  空白被算進三個字裡的情況（沒量，顯示上無害）：最後一行開頭有空白又不足三個字，或最後三個字中間夾著空白（例如 `tab\t結尾` 的最後三個字是 Tab＋「結尾」）。
- `bindTail` 在 Node 20.14 遇到「單行 10 萬字」會變慢（約 3 秒；Node 22 是 33 ms，檢查員量的）。只有單行很長才會，實際的公告與更新紀錄碰不到；package.json 的 engines 是 `>=20`，記一筆。
- vm 沙箱不是安全邊界（vm 逃得出去）；chapters.js 是我們自己的檔，沙箱防的是「跑不完」與「意外用到 Node 的東西」。
- 測試檔裡的組合字元、ZWJ 一律寫成 `\uXXXX`／`\u{…}` 跳脫；測試名稱裡的 𠮷、👍 是看得見的字，留著好讀。

## 介面細則（4-b3：素材處理 —— 宣傳片去音軌、預覽圖換 WebP）

公開介面（函式名稱、參數、回傳的形狀、命令的參數與結束碼）以派工人員 2026-10-02 給的為準；下面是把它寫成量得到的條件，
標〔挑〕的是測試工程師寫測試時挑的寫法（派工人員沒講到的細節）。編號另起，跟 4-b1、4-b2 的不相干。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B3"                 只跑 4-b3
npm test -- --test-name-pattern "B3.3 命令"          只跑命令那幾條
node --test tests/media.test.js                      只跑純函式
SITE_REAL_TOOLS=1 FFMPEG=<VideoConverter 帶的 ffmpeg> CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "真工具"
```

檔案：`media.test.js`（`lib/media.js` 的純函式）、`media-run.test.js`（`lib/media-run.js` 的 `runMedia`，用假工具）、
`media-cli.test.js`（`scripts/media.mjs`，真的開子程序）、`media-real.test.js`（真工具，選擇性）、`structure-b3.test.js`（結構）；
`media-fixture.js` 是共用的小工具（不是測試）；`fixtures/fake-tools/` 是假的 `ffmpeg.mjs`、`cwebp.mjs`（node 腳本，壞法用環境變數控制，寫在各自檔頭）
與 `images.js`（用程式組出 PNG／WebP 位元組 —— 專案裡不放二進位檔）。

**注入 runner：測試怎麼不靠後門換掉工具**〔挑〕

1. 流程在 `lib/media-run.js` 的 `runMedia({ root, out, langs, ffmpeg, cwebp, maxVideoMb, run })`；`scripts/media.mjs` 只讀參數、組成 `run`、呼叫它、印結果。
   `run(command, args)` 回傳 `spawnSync(…, { encoding: 'utf8' })` 那個形狀：`{ status, stdout, stderr, error }`（也可以回傳 Promise，runMedia 會 await）。
   命令用的 `run` 就是 `spawnSync(command, args, …)`；開不起來（ENOENT）時 `error` 有值、`status` 是 null。
2. 測試給的 `run` 是 `spawnSync(process.execPath, [command, …args])`，`ffmpeg`／`cwebp` 傳假工具腳本的路徑 ——
   真的子程序、真的結束碼與 stderr，Windows 也跑得動；CLI 裡沒有任何為了測試開的開關。
3. runMedia 叫工具的方式（假工具照這個認）：`ffmpeg -version`、`cwebp -version`（檢查跑得起來）；`ffmpeg -hide_banner -i <檔>`（量資訊，`-i <檔>` 是最後兩個參數）；
   `ffmpeg <ffmpegArgs(輸入, 暫存輸出)>`、`cwebp <cwebpArgs(輸入, 暫存輸出)>`（轉檔，參數**就是**那兩個函式給的，測試逐字比）。

**`lib/media.js`**

4. `parseFfmpegInfo(stderr)` → `{ durationSec, video, hasAudio }`，剛好三欄。`durationSec` 是 時×3600＋分×60＋秒（到小數）。
   `video` 是**第一條**影像串流的 `{ width, height }`：解析度要避開編碼標記（`0x31637661`、`0x001B`）、串流標記（`[0x1]`、`[0x100]`）、括號（`yuv420p(tv, bt709, progressive)`）、`[SAR 1:1 DAR 16:9]`。
   `hasAudio`：有任何一行 `Stream #…: Audio:`。CRLF 行尾結果一樣。
5. 丟 `Error`：沒有 Duration 或 `Duration: N/A`（訊息有「Duration」或「長度」）；沒有影像串流又沒有音軌（訊息有「Video」「影像」或「畫面」）；截斷檔、亂碼檔、空字串（訊息講到其中一個）。
   **只有音軌**的檔不丟，回 `video: null`。
6. `readImageSize(buffer)` → `{ type, width, height }`（欄位就這個順序）。PNG 讀 IHDR（32 位元大端，寬 70000 也要對）；
   WebP：`VP8 ` 寬高各取低 14 位元（上面 2 位元是縮放旗標，要去掉）、`VP8L` 是 簽章 0x2f 之後 32 位元小端的 寬-1（14 位元）、高-1（14 位元）、
   `VP8X` 是畫布 寬-1、高-1 各 24 位元小端（可以超過 16384）。截斷（讀到一半沒有寬高）、JPEG、`RIFF…WAVE`、純文字、空的 → 丟 `Error`，不回傳亂讀的值。
7. `planMedia({ root, out, langs })` → 照 `langs` 的順序，每筆剛好 `{ lang, videoIn, posterIn, videoOut, posterOut }`（`path.join` 組的）。
8. `ffmpegArgs(in, out)`：字串陣列；`-i` 後面是輸入、最後一個是輸出；有 `-an`、`-map 0:v:0`、`-c:v copy`、`-movflags +faststart`、`-y`，
   而且 `-map`、`-c:v`、`-an`、`-movflags` 放在 `-i` 後面（那是輸出的選項）。不准有 `libx264`、`libx265`、`-crf`、`-vf`、`-filter:v`、`-b:v`、`-t`、`-to`、`-ss`。
   路徑有空白也是一個元素；其他元素都沒有空白（不是 shell 字串）。可以多帶別的旗標（例如 `-hide_banner`、`-loglevel error`）。
9. `cwebpArgs(in, out)`：無損 —— 有 `-lossless`、`-z` 後面是 `'9'`、沒有 `-q`；`-o` 後面是輸出、輸入剛好出現一次（可以多帶 `-quiet` 之類無關的旗標）。
   〔派工人員定，檢查員第 2 輪〕有損在暗色放射漸層會出色階斷層，只有無損跟原圖逐像素相同；無損每張約 104～107 KB，約原 PNG 的 30%。
10. `buildMediaJson(results)`〔挑：results 的形狀〕：`results` 是陣列，每筆是 planMedia 的那一筆再加
    `video: { bytes, durationSec, width, height }`、`poster: { bytes, width, height }`（可以多帶別的欄位，例如 `hasAudio`、`type`，輸出不帶）。
    輸出 `{ <lang>: { video: { file, bytes, durationSec, width, height }, poster: { file, bytes, width, height } } }`，語言照 results 的順序、欄位就這個順序；
    `file` 是 `videoOut`／`posterOut` 的檔名（`hero-zh.mp4`、`hero-poster-zh.webp`）。測試用 `JSON.stringify(…, null, 2)` 逐字比。

**`runMedia`（`lib/media-run.js`）**

11. 先查**輸入檔**都在、**再查工具**〔挑：順序〕：缺檔的訊息有那個檔名（`demo-dust-poster-en.png`、`demo-dust-1920x1080-ja.mp4`），而且這時一支工具都還沒開始轉；
    缺檔又 ffmpeg 壞了 → 講缺檔。工具壞了 → 訊息「ffmpeg 跑不起來」／「cwebp 跑不起來」＋原因（`-version` 的 stderr，例如 `Library not loaded`；開不起來時訊息要有「找不到」，不是只有 `ENOENT` 原文 —— 檢查員第 1 輪）。
12. 每個語言：先量來源影片（`ffmpeg -hide_banner -i`）→ 轉檔寫到**系統暫存資料夾裡自己開的資料夾**（`os.tmpdir()`；測試把 TMPDIR／TEMP／TMP 指到自己的空資料夾）
    → 再量一次寫出來的影片 → 驗證：沒有音軌、長度跟來源差 ≤ 0.05 秒（差 0.04 要過；短 0.2、長 0.1 都不過）、解析度相同、檔案 ≤ `maxVideoMb`
    〔派工人員定，檢查員第 1 輪〕**1 MB＝1024×1024 位元組**：上限 1 時 900000、1040000 位元組要過（1040000 用 1000×1000 算會被擋）、1100000 不過。
    海報：轉成 WebP → 驗證是 WebP、寬高跟原 PNG 一樣、比原 PNG 小（嚴格小於）。
13. 出錯的訊息〔挑：要講到的字，都另外要有 `ja` —— 壞法只套在 ja 上〕：還有音軌（「音軌」或 audio）、長度（「長度」「秒」或 duration）、解析度（「解析度」「寬高」「尺寸」或 1280）、
    太大（「上限」＋實際大小 1100000 位元組或 1.05 ＋上限 1 MB 或 1048576 位元組）、ffmpeg 結束碼不是 0（帶它的 stderr，`Conversion failed`）、結束碼 0 卻沒寫出檔（只要出錯）；
    WebP 比 PNG 大（「大」「小」「size」「KB」「位元組」或 bytes）、寬高不同（「寬高」「尺寸」「解析度」或 1919）、不是 WebP（WebP）、cwebp 結束碼不是 0（帶它的 stderr）。
14. **全部語言都通過才搬進 `out`**（`out` 不存在就建，含中間的資料夾）並寫 `media.json`（`JSON.stringify(…, null, 2) + '\n'`；`durationSec` 是**輸出**影片量到的、`bytes` 是輸出檔的大小〔挑〕）。
    任何一步出錯：reject 一個 `Error`、`out` 裡的東西一個位元組都不變也不多出檔（壞的是最後一個語言，前面已經過的也不准先搬）、`root` 不變、暫存資料夾清掉。成功也要清掉暫存。
15. 成功時覆蓋 `out` 裡的舊 `hero-*`、`media.json`。重跑兩次（同一個 `out`、另一個 `out`）位元組相同 —— `media.json` 裡不能有時間戳或絕對路徑。
15a. 〔檢查員第 1 輪〕放進 `out` 才失敗：訊息是中文，有「放進」、`out` 的路徑與白話原因 —— `out` 是檔案（「不是資料夾」）、唯讀資料夾（「沒有寫入權限」；Windows 與 root 跳過）、
    某個目標名字（測試用 `hero-ja.mp4`）是資料夾（「資料夾佔住」）。
    〔檢查員第 2 輪〕唯讀時訊息附的是 `out` 底下寫不進去的**目的地**（copyfile 的 `err.dest`），不是已經清掉的暫存來源檔：要含 `<out>/…`、不能含系統暫存資料夾的路徑。三種都是 `out` 一個位元組都不變、沒有 `.partial`、暫存清掉。
    目標名字是資料夾時要**在開始改名之前**就發現、整個不動（測試另外點名：`hero-zh.mp4`、`hero-en.mp4` 沒被換成新的、`media.json` 還是舊的 —— 不會半新半舊）。

**命令 `scripts/media.mjs`**

16. 用法錯誤（不認得的參數、`--out`／`--ffmpeg`／`--max-video-mb` 缺值）→ 結束碼 2、stderr 有字，在碰工具之前就停（FFMPEG 指到不存在的檔也是 2）、不動 `--out`。
    〔檢查員第 1 輪〕空字串（`--out=`、`--root=`、`--ffmpeg=`、`--cwebp=`；工具路徑不靜靜退回環境變數）與 `--max-video-mb` 不是正的有限數
    （`0`、`--max-video-mb=-1`、`--max-video-mb -1`、`abc`、`--max-video-mb=`、`Infinity`）也是用法錯誤：結束碼 2、stderr 是中文、`--out` 不動、從空的暫存資料夾叫它，跑完 cwd 還是空的。
    「stderr 是中文」量的是**第一行**：要有中文、不能是 Node parseArgs 的英文原文（`Unknown option`、`argument missing`、`ambiguous`、`Unexpected argument`）——
    後面接的「用法：…」永遠是中文，看整段擋不到。不認得的參數、多出來的位置參數、缺值也各量一次。
    runMedia 出錯 → 訊息印 stderr、結束碼 1。
17. 工具路徑：`--ffmpeg` 優先、其次環境變數 `FFMPEG`、都沒有才用 PATH 裡的 `ffmpeg`（`cwebp` 同理：`--cwebp`、`CWEBP`、`cwebp`）。
    〔派工人員定，檢查員第 2 輪〕環境變數 `FFMPEG`／`CWEBP` 是空字串當作沒設（退回 PATH 的 `ffmpeg`／`cwebp`，不能炸出 Node 的 `The argument 'file' cannot be empty`）；
    命令列的 `--ffmpeg=`／`--cwebp=` 空字串仍是用法錯誤（第 16 條）。`CWEBP` 那一半要先有跑得起來的 ffmpeg，放在真工具測試。
    〔挑〕「跑不起來」的訊息要帶試的那個路徑（測試靠它分辨用的是 `--ffmpeg` 還是 `FFMPEG`）；找不到程式時要有「找不到」。
18. 不給 `--root`：專案根目錄是這支檔往上三層（從暫存資料夾叫它來量；那裡 `release/` 的六個原檔都在 → 過了缺檔、停在「ffmpeg 跑不起來」）。
19. 結構（`structure-b3.test.js`）：兩支 lib 檔頭有 JSDoc（`@param`、`@returns`）、只用 `node:` 與相對路徑；`lib/media-run.js` 匯出 `runMedia`。
    `scripts/media.mjs` 只 import `node:` 內建與 `../lib/media-run.js`、呼叫 `runMedia`；不碰 lib/media.js 的六個函式、
    程式裡沒有 `Duration`、`Audio`、`RIFF`、`WEBP`、`IHDR` 這些字（整個字；`CWEBP` 不算）、沒有 `\d`、不用 `rename`／`copyFile`／`mkdtemp`／`rm`／`writeFile`／`cp`。
    檔頭註解（第一個 import 之前）要寫到：`FFMPEG`、`CWEBP`、`ffprobe`、「音軌」、「重新編碼」、`MB`、`git`、`npm run media`。
    `package.json` 的 `scripts.media` 是 `node scripts/media.mjs`；沒有 dependencies、devDependencies。

**真工具（`media-real.test.js`）**

20. 三個環境變數都設了才跑（`SITE_REAL_TOOLS=1`、`FFMPEG`、`CWEBP`），少一個就 skip；都設了但工具跑不起來、或 `release/` 的六個原檔不在 → 紅。
    用真的影片前 2 秒（`-t 2 -c copy`，留著音軌）與真的海報做小專案，命令只靠環境變數拿工具；量的東西同上面 12～15 條，檢查用測試自己的讀法（不靠 lib/media.js）。
    2026-10-02 在使用者的 mac 量過（`<VideoConverter 帶的 ffmpeg>`、Homebrew 的 cwebp 1.6.0）：前 2 秒三支 1.6 秒跑完；長度 63.02 → 63.00；兩次輸出位元組相同。
    大小（MiB＝1024×1024 位元組，MB＝1000×1000 位元組）：去音軌後的影片三支 2,913,698／2,931,037／2,954,775 位元組（各約 2.8 MiB＝2.9 MB）；
    海報 PNG 345,964／346,482／350,435 位元組 → 無損 WebP（`-lossless -z 9`）104,454／104,042／106,680 位元組（各約 102～104 KiB＝104～107 KB，約原 PNG 的 30%），
    `dwebp` 解回來跟原 PNG 用 `magick compare -metric AE` 比是 0；合計 9,114,686 位元組（約 8.7 MiB＝9.1 MB；git 增加量在 15 MB 以內）。
21. 〔檢查員第 2 輪〕逐像素相同另一條：還要 `dwebp`（環境變數 `DWEBP`，沒設用 `CWEBP` 同資料夾的）與 `magick`（`MAGICK`，沒設用 PATH 的）；跑不起來就 skip。
    海報要是無損（`VP8L` 檔頭），`dwebp` 解回 PNG 跟來源 PNG 比，不同的像素數要是 0。

## 已知限制（4-b3，沒有測試）

- 命令（`scripts/media.mjs`）成功那條路只在真工具測試裡量（預設不跑）；預設的 `--out`（`public/media/`）沒量 —— 一跑就寫進專案。
  `CWEBP` 環境變數在命令那層只有真工具測試量得到（要先有跑得起來的 ffmpeg 才走得到 cwebp）。
- 「全部通過才搬」量了驗證失敗與三種放進 `out` 的失敗（是檔案、唯讀、目標名字是資料夾）；磁碟滿沒量。
- 改名是一個一個改的：外部程式佔著目標檔（Windows 的 EPERM／EBUSY）時，改名中途失敗仍可能半新半舊（已改好的是新的、其餘是舊的），重跑即可。沒量。
- `--out` 原本不存在、在放進去時才失敗，會留下一個空資料夾（可接受）。沒量。
- Windows 上 `FFMPEG`／`CWEBP` 要指到 `.exe`：指到 `.cmd`／`.bat` 在 Node 20.12 之後不開 shell 會 `EINVAL`（命令不開 shell）。沒量。
- 「重跑相同」用的是同一台機器、同一支 ffmpeg：ffmpeg 會把自己的版本（`Lavf62.12.102`）寫進 mp4，換一支 ffmpeg 位元組就會不同。
- 〔已定，檢查員第 1 輪〕`--max-video-mb` 的 MB 是 1024×1024 位元組（第 12 條有量）；不是正的有限數（`0`、負數、`abc`、空字串、`Infinity`）是用法錯誤（第 16 條有量）。
- 假工具只認 `-i <檔>` 在最後兩個參數的「量資訊」叫法；runMedia 要是改成別的量法（例如加 `-f null -`），假工具會把它當轉檔。
- 測試檔裡沒有看不見的字元（寫完用程式掃過）；二進位的 PNG／WebP 一律在測試裡用 `fixtures/fake-tools/images.js` 現組，不放進專案。

## 介面細則（4-b4：內容檔初稿與檢查指令 `npm run content:check`）

公開介面（`checkContent(dir)` 的回傳形狀、命令的參數與結束碼、內容檔的說明註解要寫到的事）以派工人員 2026-10-02 給的為準；
下面是把它寫成量得到的條件，標〔挑〕的是測試工程師寫測試時挑的寫法（派工人員沒講到的細節）。編號另起，跟 4-b1～4-b3 的不相干。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B4"                 只跑 4-b4
npm test -- --test-name-pattern "B4.1"               只跑內容檔的說明註解與乾淨
npm test -- --test-name-pattern "B4.2 檢查"          只跑 lib/content-check.js
npm test -- --test-name-pattern "B4.2 命令"          只跑 scripts/content-check.mjs
npm test -- --test-name-pattern "B4.2 內容檔"        只跑真的內容檔讀起來對不對
npm run content:check                                檢查真的 content/（不是測試，是給人跑的）
```

**`npm test` 與 `content:check` 的關係**〔派工人員定，檢查員第 1 輪〕：`content-files.test.js` 裡「真的內容檔沒有要修的」那一條，跟 `npm run content:check` 結束碼 0 是同一件事（都用 `checkContent`）；
所以使用者在 GitHub 上把內容寫壞時，`npm test` 也會紅。**`npm test` 不是上線關卡**：上線只跑網站的 build（寫壞的那一條在網頁上顯示「這一條讀不到」，其他照常）；
`npm test` 與 `content:check` 是給改程式、改內容的人自己檢查用的。順序、公告有幾則、有沒有置頂只是 `content:check` 的警告，兩邊都不會因此失敗。

檔案：`content-files.test.js`（真的 `content/` 七支檔）、`content-check.test.js`（`lib/content-check.js`）、`content-check-cli.test.js`（`scripts/content-check.mjs`，真的開子程序）、
`structure-b4.test.js`（結構）；`content-check-fixture.js` 是共用的小工具（不是測試）；`fixtures/content-check/` 一個情況一個小資料夾，每個都是一份完整的 content/：
`good`、`bad-entry`（1 條壞 item、三語同一位置各 1 則壞公告、1 個壞連結）、`unreadable`（少了 `news.ja.md`）、
`changelog-versions`、`changelog-items`、`changelog-order`、`changelog-dates`、`news-dates`、`news-count`、`news-pinned`（三語不一致，每一條本身都是好的）、
`order-reversed`、`empty-news`、`no-pinned`（只有警告）、`stray-close`（`changelog.zh.md` 有 2 版加一行落單的 `-->`）。

**內容檔 `content/`（`content-files.test.js`）**

1. 七支都在：`changelog.<zh|en|ja>.md`、`news.<zh|en|ja>.md`、`links.md`。
2. 每支檔第一個非空白的東西是 `<!-- … -->`（要關起來），裡面：有中文、〔挑〕沒有簡體才有的字（这们个时么说读显坏样页网语录发后，日文也不用的那幾個）；
   講這支檔做什麼（更新紀錄寫到「更新紀錄」、公告寫到「公告」、links 寫到「社群」）；
   〔挑〕一整行的格式範例：更新紀錄 `## x.y.z · YYYY-MM-DD` 加一條 `- 類型：內容`、公告 `## YYYY-MM-DD · 類別 · 標題`、links `- 代號 · https://…`（點都是 U+00B7）；
   一字不差「通常幾分鐘，最久約 20 分鐘」；寫壞會怎樣 ——〔挑〕要有「這一條讀不到」「其他」「照常」「不會壞」四個詞。
3. 公告檔的註解另外要有：「連結：」（全形冒號）、「置頂」、「三種語言」、「中文」、`·`（U+00B7）與 `・`（U+30FB）兩個字元、「空一格」、「半形」。
4. 乾淨（七支檔整份，含註解）：沒有零寬字、方向控制字元、NBSP、全形空白（U+3000）、軟連字號、BOM（任何位置）、其他控制字元（換行、CR、Tab 以外）；
   沒有 `/Users/`、`\Users\`；沒有長得像電子郵件的字（`x@y.zz`；`https://www.threads.com/@jerromy` 不算）。
5. 範例不算內容：readContent 讀到的條目數 ＝ 拿掉所有 `<!-- … -->` 之後以「## 」（links 是「- 」）開頭的行數，而且說明註解裡確實有那樣一行。
6. readContent 每一個位置 ok、每一版、每一條 item、每一則、每一個連結都是 ok:true。三語都至少一個版本；links 至少一個連結、代號 `[a-z0-9]+`、不重複。
7. 〔檢查員第 1 輪，取代原本的三語一致、由新到舊、公告至少一則三條〕`checkContent(content/)` 的 problems 是空的（含三語一致）。
   公告可以是 0 則；順序與置頂只由 `checkContent` 的警告負責，這支不強制。
8. 〔檢查員第 1 輪〕說明字句：
   - 三支 changelog 的開頭註解：有「日期也要一樣」（或「日期要一樣」）；有一句（用 。！？ 斷句）同時有「那一版」「每一條」「讀不到」（版本標題寫壞時那一版底下的每一條都讀不到）。
   - 有待填的版本範本（某段註解裡有一整行「## x.y.z · 2026-MM-DD」）時：要有一段註解寫到「刪掉」，而且那段註解的內文有「<!--」與「2026-MM-DD」。沒有範本（上架後拿掉了）就 skip。
     `-->` 不量：它寫不進註解裡（一寫註解就在那裡結束，後面變成落單的 `-->`，第 6 條會紅）—— 要講結尾那行只能用文字描述。
   - `news.*.md` 與 `links.md` 整支沒有「規格書」；`links.md` 整支沒有「字串檔」。

**`lib/content-check.js` 的 `checkContent(dir)`（`content-check.test.js`）**

9. 回傳剛好 `{ ok, problems, warnings, summary }`；`ok` ＝ `problems` 是空的（有警告照樣 `ok: true`）。`summary` 只要有（不是 undefined、null），形狀〔挑〕不規定 —— 命令印摘要用。
10. 〔挑〕`problems` 每條剛好 `{ file, line, raw, reason }`、reason 是中文；`warnings` 每條剛好 `{ file, message }`、message 是中文。problems 的順序不規定（測試排過再比）。
11. 壞條目：readContent 讀到的每一筆 ok:false（壞的版本、版本裡壞的 item、壞的公告、壞的連結）各一條，`file` 是檔名、`line`／`raw`／`reason` 跟 readContent 給的一模一樣，不多不少。
12. 整區讀不到：`{ file: 檔名, line: null, raw: null, reason: readContent 的原因 }`（〔挑〕`raw` 也是 null）。
13. 三語不一致：`{ file: 'changelog' 或 'news', line: null, raw: null, reason }`〔挑：line、raw 都是 null〕；reason 點名不一樣的那個語言（`zh`／`en`／`ja` 或 中文／英文／日文）
    與那一版／那一則：〔檢查員第 1 輪〕同一版的日期不同要講到版本號與兩個日期；版本號不同講到兩個版本號其中一個；條數不同講到那個版本號；版本順序不同講到版本號或「順序」；公告日期不同講到其中一個日期或「第 N 則」；則數不同講到「則」；置頂不同講到「置頂」。
    〔挑〕**條數算 items 的長度，含壞的那條**；三語在同一個位置都壞的公告不算不一致 —— 所以 `bad-entry` 只會有檔案那幾條，不會多報三語不一致（測試有量）。
14. 警告：順序不是由新到舊 → 那支檔一條（`file` 是檔名，〔挑〕六支檔各自報）；公告完全空白 → 那支公告檔一條，message 講「空白」（或「空的」「沒有公告」「一則都沒有」「0 則」）；
    沒有任何置頂 → 至少一條 `file` 以 `news` 開頭、message 有「置頂」（一條或三語各一條都可以）。`good` 一條警告都沒有。
15. `dir` 不存在、`dir` 是一個檔 → reject 一個 `Error`，訊息是中文。

**命令 `scripts/content-check.mjs`（`content-check-cli.test.js`）**

16. `node scripts/content-check.mjs [--dir <content 資料夾>]`，不給 `--dir` 讀這支檔往上一層的 `content/`（從暫存資料夾叫也一樣）；`package.json` 的 `content:check` 是 `node scripts/content-check.mjs`。
17. 沒有 problems：結束碼 0；摘要〔挑〕七支檔一支一行，那一行有檔名與數字（更新紀錄幾個版本、公告幾則、links 幾個連結），整段講到「版本」「公告」「連結」。
    有警告照樣 0，輸出有「警告」與每一條 warning 的 message。
18. 有 problems：結束碼 1；〔挑〕每一條印一行：有行號的「`檔名：第 N 行：原因（原文）`」（全形冒號與括號，原文去掉頭尾空白），三語不一致印「`changelog：原因`」／「`news：原因`」。
    〔檢查員第 1 輪〕整支讀不到：要有一行同時有檔名與原因（「檔案不存在」），而且輸出的任何一行都不能把那個檔名說兩遍（不能印「news.ja.md：讀不到 news.ja.md：檔案不存在」）。
18a. 〔檢查員第 1 輪〕摘要的版本數不算落單的 `-->`（那是一筆壞紀錄，不是一個版本）：`stray-close` 的 changelog.zh.md 摘要那一行要有 2、不能有 3。
19. 印在 stdout 或 stderr 都可以（測試兩邊合起來找），只有用法錯誤規定在 stderr。
20. 用法錯誤 → 結束碼 2：不認得的參數、〔挑〕多出來的位置參數、`--dir` 缺值、`--dir=`、`--dir ''`、`--dir` 不存在、〔挑〕`--dir` 是一個檔。
    stderr 第一行要有中文、不能是 Node parseArgs 的英文原文（`Unknown option`、`argument`、`ambiguous`、`missing`、`Unexpected`、`ERR_PARSE_ARGS`）。
21. 每一次都從空的暫存資料夾叫，跑完那裡要還是空的（不留任何檔）。

**結構（`structure-b4.test.js`）**

22. `lib/content-check.js`：第一個 export 之前有 JSDoc、寫了 `@param` 與 `@returns`；匯出 `checkContent`；只 import `node:` 與 `./`；
    〔挑〕import `./content.js` 並呼叫 `readContent`，不自己定義 `parseChangelog`／`parseNews`／`parseLinks`／`toLines`／`readBlocks`。
23. `scripts/content-check.mjs`：只 import `node:` 與 `../lib/content-check.js`、呼叫 `checkContent`；不碰 `readContent` 與三支 parse，不用 `readFile`／`readdir` 自己讀內容。
24. `lib/` 每一支 .js 第一個 export 之前有 JSDoc。`package.json` 沒有 dependencies、devDependencies。
25. 公開 repo 相容：`lib/content-check.js`、`scripts/content-check.mjs`、4-b1 的六支讀內容模組、`tests/helpers.js`、4-b4 的測試與 `content-check-fixture.js`，
    去掉註解之後沒有 `design/`、`release/`、`tutorial/`、`clipper/`、`../..`、`'..', '..'`。

## 已知限制（4-b4，沒有測試）

- 內容的出處（每一條更新紀錄對得到 release notes、1.0.3 從 git 歷史與商店說明整理、公告用規格書 02 區那則、links 只放真的帳號）由檢查員人工查，不寫成自動測試：
  那要讀 `homepage/site/` 外面的 `release/`、`homepage/SPEC.md`，搬進公開 repo 之後就讀不到。B4.3 整條、B4.4 的「只放真的帳號」與「代號對 icons/<代號>.svg 的名字對應清單」都是人工查。
- 「1.0.3 與英日文版標『待使用者確認』」寫在哪裡、怎麼標沒有規定，沒有測試。
- 公開 repo 那一條只掃讀內容那一路；4-b2、4-b3 的章節與素材工具（`lib/chapters.js`、`lib/media*.js`、`scripts/chapters.mjs`、`scripts/media.mjs` 與它們的測試）
  本來就往主資料夾讀 `tutorial/`、`release/`（設計如此：在這台 mac 上轉好再提交），搬進公開 repo 之後要另外處理，不在這一條裡。
- 三語一致只比 en、ja 跟 zh（〔檢查員第 1 輪〕同一版的日期現在有比，第 13 條）。
- 摘要的版本數只量了「落單的 `-->` 不算」；寫壞的版本標題（`##1.0.4 …`）算不算一個版本沒有規定，測試不看。
- 一區讀不到（例如少了 `news.ja.md`）時，那一種內容要不要另外報三語不一致沒有規定，測試不看。公告在某一語言壞、另一語言好（同一位置）怎麼比也沒有規定，fixture 避開了。
- 「繁體中文」只擋了 16 個簡體才有的字；用繁體字寫的大陸用語擋不到。
- 測試與 fixture 裡沒有看不見的字（寫完用程式掃過）；測試程式裡比對用的 U+00B7、U+30FB 一律用 `String.fromCodePoint` 組（`content-files.test.js` 只有檔頭註解寫了一個可見的 U+00B7），fixture 裡的點是可見的 U+00B7。fixture 是 LF、沒有 BOM。

## 介面細則（4-b5：部署設定與給使用者的說明）

**2026-10-07 部署從 GitHub Pages 改成 Cloudflare Pages（使用者決定）。** 原本的 `.github/workflows/pages.yml`、`public/CNAME` 與守著它們的
`deploy-workflow.test.js`、`deploy-cname.test.js`、`workflow-yaml.js`、`workflow-yaml.test.js` 一起拿掉了（歷史在 git 裡）。
現在要交的檔：`public/_headers`、`.node-version`、`package.json` 的 `build:pages`、`.gitignore`、`.gitattributes`、`README.md`。
搬進網站 repo 之後都在根目錄，所以測試只讀 `homepage/site/` 裡面。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B5"                 只跑 4-b5
npm test -- --test-name-pattern "B5.1|B5.2"          只跑 Cloudflare 的部署設定
npm test -- --test-name-pattern "B5.3"               只跑 README.md
npm test -- --test-name-pattern "B5.4"               只跑 .gitignore
```

檔案：`deploy-cloudflare.test.js`（B5.1、B5.2）、`deploy-readme.test.js`（B5.3）、`deploy-gitignore.test.js`（B5.4）、`structure-b5.test.js`（結構）；
`deploy-files.js` 是共用的小工具（不是測試）。

**B5.1、B5.2 部署設定（`deploy-cloudflare.test.js`）**：量什麼寫在那支檔的檔頭 —— 沒有 GitHub Pages 的部署設定；`.node-version` 是 22；
`build:pages` 是「content:check || 警告 && build」；`_headers` 讓 `*.pages.dev` 與預覽網址 noindex、只有 `/_next/static/*` 長快取、在官方上限內；
`.gitattributes` 有 `* text=auto eol=lf`；README 有一節講 Cloudflare 的設定。

**B5.3 `README.md`（`deploy-readme.test.js`）**

17. 〔挑〕有一個標題（`#` 開頭的行）寫到「自己做」；那一節用編號清單（`1. `、`2. ` 或 `1) `）寫，一項是編號那行加上底下接著的行。
    五件事照順序往後找（2026-10-07 改成 Cloudflare）：建 repo → Cloudflare 建 Pages 專案 → 在專案填自訂網域 → Search Console 與 Bing → 商店；一項只算一件。各自要有的字：
    建 repo＝`repo` 加「建／新增／開一個」；Cloudflare 專案＝`Cloudflare`、`Pages`、`npm run build:pages`、`` `out` ``；填自訂網域＝「自訂網域」或 `Custom domains`、`collector.jerromy.com`；
    搜尋＝`Search Console`、`Bing`、「網站地圖」或 `sitemap`；商店＝「商店」加「網址」。
    少了報「少了」，順序錯報「順序不對」。〔挑〕每一件那一項都要有「為什麼」三個字。
    （GitHub 時代的 17a「驗證網域」與 18「git subtree 搬家」拿掉了：Cloudflare 不需要先驗證網域；網站 repo 用乾淨的第一個提交，不帶歷史。）
19. 本機預覽：有 `npm run dev`、`npm run build`；有一段同時寫到「靜態伺服器」與 `out/`。
20. 有一段同時寫到 `Live Server`、「不要」或「別」、「插」（原因：它會往 HTML 插自己的腳本）。
21. 〔派工 2026-10-02，取代原本的「content:check 失敗、網站維持上一版」；檢查員第 1 輪收緊〕標題含「內容寫壞」的那一節裡（空行切段），
    有一段同時寫到 `content:check`、「警告」、「不擋」、「這一條讀不到」（內容寫壞不擋部署，建置紀錄留下警告，網頁上顯示「這一條讀不到」）；
    同一節裡有一段同時寫到 `npm run build`、「失敗」、「上一版」（build 失敗才擋部署、網站維持上一版）。
    要同一段：只看「那一節有沒有這四個詞」的話，把「但**不擋**部署」改成「但會擋部署」還是綠的（同一節別段還有「（不擋部署）」），所以收成同一段。
22. 〔挑〕有一段同時寫到 `npm test`、「上線」與「不是／不會／不跑／不擋」其中一個；有一段同時寫到 `content:check`、「提交」或 `commit`、「前」。
23. 〔挑〕有一節（標題切節）同時寫到 `scripts/chapters.mjs`、`scripts/media.mjs`、`GPTPlugins`、`data/`、`public/media/`。
24. 乾淨：有中文、沒有那 16 個簡體才有的字（跟 4-b4 同一份）；沒有 `/Users/`、`\Users\`、`jerromylee`（不分大小寫）；
    沒有電子郵件（〔挑〕`git@github.com:` 這種 ssh 網址先拿掉再找）；沒有看不見的字（跟 4-b4 同一份清單，加上 CR）。

**B5.4 `.gitignore`（`deploy-gitignore.test.js`；派工 2026-10-02 補記進目標檔，案例是「.gitignore 與換行」）**

25. 用真的 git 判斷：把 `.gitignore` 單獨放進一個空的暫存 git repo（`core.excludesFile` 指到空檔，這台電腦的全域忽略不算），`git check-ignore --no-index` 問：
    要擋 `node_modules/…`、`out/…`、`.next/…`；不准擋 `content/`、`data/`、`public/` 底下**現在有的每一個檔**，
    〔挑〕也不准擋 `package.json`、`package-lock.json`（`npm ci` 要它）、`.node-version`、`.gitattributes`、`README.md`、`public/_headers`、`lib/`、`scripts/`、`tests/` 的代表檔。叫不起 git 就 skip。

**結構（`structure-b5.test.js`）**

26. `package.json` 沒有 `dependencies`、`devDependencies`。
27. 這一段新加的測試與小工具第一行是 `//` 說明、檔頭寫到 `4-b5` 或 `B5`。
28. 這一段新加的測試與小工具去掉註解之後沒有 `design/`、`release/`、`tutorial/`、`clipper/`、`../..`、`'..', '..'`（跟 4-b4 同一個掃法）。

## 已知限制（4-b5，沒有測試）

- 〔檢查員第 1 輪〕`structure-b2`～`structure-b5` 都寫死「`package.json` 不准有 `dependencies`」：前端加 Next.js 時這幾條會一起紅，**4-f 開始時要先處理**（現在不改）。〔4-f1 已處理：改成白名單，見最後一節「4-f1 的 F1.7」〕
- 部署設定只量檔案寫得對不對，不真的在 Cloudflare 上部署（第一次部署時看建置紀錄）；`_headers` 有沒有真的生效要上線後用 `curl -I` 看。
- `.gitattributes` 只量有那一行，不是真的在 Windows 上 checkout 一次。
- README 的量法是找字，量得到「有寫」，量不到「寫得對、看得懂」—— 每一步的「為什麼」講得通不通、指令跑不跑得動，由檢查員人工看。
- 規格書第 15 節的「教學片上 YouTube」與商店網址的 `/?ref=store` 不在這一段（派工人員 2026-10-02 定），測試不量。
- 測試與小工具裡沒有看不見的字（寫完用程式掃過）。

## 介面細則（4-b6：字型授權、拉丁字型瘦身、字型預算、圖片轉 WebP）

測試案例是派工人員 2026-10-02 給的（下面標〔派工〕）；參數、輸出格式與細節是測試工程師在測試裡定的（標〔測試工程師〕），後端照這一節實作。
編號另起，跟 4-b1～4-b5 的不相干。測試全部用暫存資料夾裡的假資料（假 python、現組的 WOFF2／PNG／JPEG），不讀設計系統、clipper 與 design/ 的真檔。

**〔派工 2026-10-02，第三版〕中文不放網頁字型**：走設計系統 `--font-zh` 的系統回退（PingFang TC／微軟正黑體 UI／Noto Sans TC），Glow Sans TC 一個檔都不放進 `public/fonts/`
（完整字型缺 教、告、清、真、・、↺ ——「教學影片」的「教」就缺，混用會一個詞兩種字體；分片做法中文頁要 7～14 MB；第一批設計稿與設計審查也是用系統中文字型量的）。
網頁字型只剩兩個**瘦身過的拉丁字型**：Google Sans Flex 用 fontTools 固定用不到的軸、只留用得到的字（約 27 KB）；JetBrains Mono 只留拉丁或原樣複製（後端量過決定）。
第一版（設計系統的分片）與第二版（Glow Sans TC 子集、`fonts:subset`）的測試都已移除。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B6"                 只跑 4-b6
npm test -- --test-name-pattern "B6.1"               只跑 LICENSES.md
npm test -- --test-name-pattern "B6.2 字型命令"       只跑 scripts/fonts.mjs（假的 python；Windows 上 skip）
npm test -- --test-name-pattern "B6.2 public/fonts"  只跑提交進來的 public/fonts/ 與 README 的大小
npm test -- --test-name-pattern "B6.3 收字"           只跑 lib/font-text.js
npm test -- --test-name-pattern "B6.3 cmap"          只跑 lib/woff2-cmap.js
npm test -- --test-name-pattern "B6.3 預算命令"       只跑 scripts/fonts-budget.mjs
npm test -- --test-name-pattern "B6.4"               只跑 scripts/images.mjs（要 cwebp 的那幾條找不到 cwebp 就 skip）
npm test -- --test-name-pattern "B6.5"               只跑結構與「不寫到別的地方」
PYTHON=<有 fonttools 與 brotli 的 python> npm test -- --test-name-pattern "真的 fonttools"   用真的工具跑一次（沒有就 skip）
SITE_COPY_MD=<copy.md 的路徑> npm test -- --test-name-pattern "B6.3 真的文案"     用提交進來的字型量真的文案（沒設就 skip）
CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "B6.4"            指定 cwebp（沒設就用 PATH 的 cwebp）
```

檔案：`fonts-files.test.js`（B6.1、提交進來的 public/fonts/）、`fonts-cli.test.js`（`scripts/fonts.mjs`，假 python）、`fonts-real.test.js`（真的 fonttools，選擇性）、
`font-text.test.js`（`lib/font-text.js`）、`woff2-cmap.test.js`（`lib/woff2-cmap.js`）、`font-budget-cli.test.js`（`scripts/fonts-budget.mjs`）、`images-cli.test.js`（B6.4）、`structure-b6.test.js`（B6.5 結構）。
小工具（不是測試）：`b6-fixture.js`（共用）、`b6-font-fixture.js`（現組 WOFF2、假字型來源、裝假 python、找真的 python、中日文的碼位範圍）、
`fixtures/fake-tools/python.mjs`（假的 python，行為寫在檔頭）、`fixtures/fake-tools/pixels.js`（現組真的解得開的 PNG 與 JPEG）。

**共通**〔測試工程師〕

1. 三支命令的結束碼：0 成功、1 做不完（缺來源、缺工具、超過、有中日文字型、有缺字、有壞檔…）、2 用法錯誤。
2. 用法錯誤（沒給必填的參數、缺值、`--x=` 空字串、不認得的參數、多出來的位置參數，以及 `--from`／`--fonts` 這類**資料夾參數**不存在或不是資料夾）：
   結束碼 2；stderr **第一行**是中文、不能是 Node parseArgs 的英文原文（`Unknown option`、`argument`、`missing`、`Unexpected`、`ERR_PARSE_ARGS`…）；不叫外部工具；不寫任何檔；從空的暫存資料夾叫，跑完那裡還是空的。
   〔派工〕**輸入檔**（`--text` 的文字檔、來源資料夾裡的字型檔）不存在、是資料夾、空的 → 結束碼 1、講出是哪個檔。
3. `--from`、`--text` 必填、沒有預設（來源都在網站 repo 外面）；`--out`、`--fonts` 有預設，從這支檔的位置算（`scripts/../public/fonts`、`scripts/../public/images`），跟從哪裡叫無關。
4. 路徑有空白、有中文都要過（測試的來源、工具、輸出都放在「字型 原檔」「工具 資料夾」「輸出 資料夾」這類資料夾裡）。
5. 〔測試工程師〕「中日文」的定義（`lib/font-text.js` 的 `isCjk`，跟 `b6-font-fixture.js` 的 `CJK` 同一份）：U+2E80～2FFF、U+3000～303F（CJK 標點：、。「」）、U+3040～30FF（假名，含「・」U+30FB）、
   U+3100～312F（注音）、U+3190～31FF、U+3200～33FF、U+3400～4DBF、U+4E00～9FFF、U+F900～FAFF、U+FE30～FE4F、U+FF00～FFEF（全形與半形：，：（）！）、U+20000～3FFFF。
   不算中日文、要進拉丁字型的：「·」U+00B7、「—」U+2014、「…」U+2026、彎引號、「→」U+2192、「↺」U+21BA、€、é……；韓文、emoji 也不算中日文（目前用不到）。

**B6.1 字型授權 `public/fonts/LICENSES.md`（`fonts-files.test.js`）**

6. 〔派工〕Google Sans Flex、JetBrains Mono 各一節（標題 `## <字型名稱>`，後面可以加字），每節剛好各一行（全形「：」或半形「:」都可以）：
   ```
   - 授權：SIL Open Font License 1.1
   - 原文：https://…                  （一個以上；寫成 [文字](https://…) 也可以）
   - 公開 repo：可以（…）              （「可以」或「不放」開頭；「不放」後面寫原因，至少 4 個中文字）
   - 授權檔：`licenses/OFL-GoogleSansFlex.txt`   （能放：一個以上，用 ` ` 包、相對於 public/fonts/；不放：寫「無」）
   - 保留字型名稱：沒有（依據：…）     （「有」或「沒有」開頭，後面寫依據 —— OFL 的 Reserved Font Name 有沒有宣告，看授權原文）
   - CSS 名稱：…                       （瘦身檔在 fonts.css 用的 font-family；可以用 ` `、" "、「」包）
   ```
   〔測試工程師〕「有」保留字型名稱的話瘦身檔是修改版、要改名：CSS 名稱裡不能有 `Google Sans`／`JetBrains Mono`（不分大小寫）。
   授權檔：在 `public/fonts/` 底下、存在、是檔、去掉空白之後不是空的（〔派工〕授權檔原文放 public/fonts/ 旁邊）。不放的那一套：授權檔「無」，`public/fonts/` 沒有它的瘦身檔。
7. 〔派工〕另外一節標題含「Glow Sans TC」：`- 公開 repo：不放（原因）`、`- 授權檔：無`；〔測試工程師〕那一節要寫到完整字型缺 教、告、清、真，與中文改走「系統」字型（7～14 MB、設計稿用系統字型量的這兩點後端可以寫，測試不量）。
7a. 〔派工 2026-10-02〕`public/` 會原樣放上網站：`public/` 底下的文字檔（`.md`、`.css`、`.json`、`.txt`，含 LICENSES.md）不能有開發流程的內部字眼 ——「派工」「後端」「測試工程師」「檢查員」。
8. 〔派工〕網址打不打得開、保留字型名稱的依據對不對，不在單元測試裡量（沒網路也要綠）：**由檢查員用 curl 驗**（`curl -sSIL <網址>` 看最後是 200，再抓原文對授權名稱與 Reserved Font Name）。

**B6.2 拉丁字型瘦身：`scripts/fonts.mjs`（`fonts-cli.test.js` 用假 python、`fonts-real.test.js` 用真的 fonttools）**

9. 〔派工〕`node scripts/fonts.mjs --from <來源資料夾> --text <檔> [--text <檔>…] [--out <資料夾，預設 public/fonts>]`
   （`npm run fonts -- --from ~/Desktop/GPTPlugins/clipper/fonts --text <copy.md> --text content/news.zh.md …`；來源也可以是 `design_system_nox/web/fonts`）。
   來源資料夾裡要有 `GoogleSansFlex-lite-latin.woff2` 與 `JetBrainsMono-latin.woff2`。〔測試工程師〕`--text` 必填（派工的失敗清單有「文字檔缺」）。
10. 〔測試工程師〕收字：每個 `--text` **整份**（拉丁字型三種語言的頁面都會用到，所以 copy.md 不只取 zh 欄、en 欄的彎引號也要收），用 `charsOf` 取字、去掉 `isCjk` 的，再加上 U+0020～007E 全部。
    要多收常用標點可以，測試只量「至少有」與「沒有中日文」。交給工具的字跟輸入放在哪裡、`--text` 的順序無關。
11. 〔派工 2026-10-02 改〕Google Sans Flex：`python -m fontTools.varLib.instancer <來源> opsz=8:64 wdth=100 slnt=0 wght=300:700 -o <暫存>` —— **opsz 不固定、留 8～64**，wdth、slnt 固定，wght 留 300～700。
    為什麼 opsz 不能固定成 18：設計系統 base.css 只在 body 設 `font-variation-settings: "opsz" 18`，但設計稿 home.css 幾乎每個元素都用 `font:` 簡寫，簡寫會把 font-variation-settings 重設成 normal，
    瀏覽器改走 `font-optical-sizing: auto`，opsz 就是字級（64px 的大標是 64、14px 的導覽是 14）。固定 18 的話，檢查員量到英文大標變寬（628→647px）、導覽列窄 19px、`.hero__sub` 從 4 行變 3 行，
    第一批設計稿量過的換行會失效；留 8～64 之後重拍英文頁跟原本一致，`GoogleSansFlex-site.woff2` 61,840 位元組（兩檔合計約 92 KB，仍在 150 KB 內）。
    再 `python -m fontTools.subset <暫存> --unicodes=…（或 --text-file=、--text=） --flavor=woff2 --output-file=<暫存>`（`--layout-features=…` 由後端定）→ `<out>/GoogleSansFlex-site.woff2`。
    要驗的：是 WOFF2、fvar 的軸**剛好**是 opsz（8～64）與 wght（300～700）—— 把 opsz 固定成單值、或多留 wdth 軸都要紅；有 ASCII 全部與文字檔裡的非中日文字、沒有任何中日文字。
    fonts.css 的 `font-weight: 300 700` 維持；〔測試工程師〕@font-face 不能用 `font-variation-settings` 把 opsz 釘死（@font-face 沒有 opsz 範圍的描述，也不用加 font-optical-sizing：它是屬性、預設就是 auto）。
12. 〔派工〕JetBrains Mono：只留拉丁或原樣複製，由後端量過決定並寫下理由 → `<out>/JetBrainsMono-site.woff2`；〔測試工程師〕兩種都要過：是 WOFF2、有 ASCII 全部、沒有中日文字。
13. fonts.css（`<out>/fonts.css`）：〔派工〕**剛好兩個** `@font-face`（一個瘦身檔一個）、`font-display: swap`、有 `unicode-range`（〔測試工程師〕要含 U+0020～007E 全部、不能碰到第 5 條的任何一段；沒寫 unicode-range 等於全部的字，中文頁也會去下載）、
    **沒有任何中日文字型的 @font-face**；〔測試工程師〕`src: url("<檔名>") format("woff2")`（`/fonts/<檔名>` 也可以）；Google Sans Flex 那個 `font-weight: 300 700`；`font-family` 不綁（提交進來的要等於 LICENSES.md 的 CSS 名稱，見第 22 條）。
    沒有絕對路徑、來源路徑、`../`、時間。
14. 〔派工〕python：〔測試工程師〕環境變數 `PYTHON`（空字串當作沒設），沒設用 PATH 的 `python3`；用 `-m fontTools.varLib.instancer` 與 `-m fontTools.subset`（不放 scripts/ 下的 python 小腳本 —— 假 python 才好做，也少一支要維護的檔）。
    要能 import `fontTools` 與 `brotli`（怎麼確認由後端定，例如 `python -c "import fontTools, brotli"`）。
15. 〔測試工程師〕冪等：同一個 `--out` 重跑位元組相同；換來源與文字檔的位置、換 `--text` 的順序，三個輸出位元組相同。
16. 〔派工 2026-10-02 改〕`--out` 裡只管這支命令產出的兩個瘦身檔與 `fonts.css`：`LICENSES.md`、授權檔（例如 `licenses/`）、**不是這兩個檔名的 `.woff2`**
    （測試放了舊做法的 `GlowSansTC-Book.3.woff2`、原樣的 `GoogleSansFlex-lite-latin.woff2`、`other-name.woff2`）都不能刪、不能改。`--out` 不存在就建。
    （提交進來的 public/fonts/ 仍然只能有兩個瘦身檔，第 22 條；舊檔要人手拿掉。）
17. 〔派工〕失敗 → 結束碼 1、講清楚缺什麼、`--out` 不留半成品：〔測試工程師〕量的情況與要講到的字 ——
    來源缺 `GoogleSansFlex-lite-latin.woff2`／`JetBrainsMono-latin.woff2`（那個檔名）、文字檔不存在／空的／只有空白（那個檔名）、
    `PYTHON` 指到不存在的檔（「python 跑不起來」＋那個路徑＋「找不到」）、`PYTHON` 空字串而 PATH 裡沒有 python3（同上，不能是 Node 的英文錯誤）、
    python 缺 brotli（`brotli`）、缺 fontTools（`fontTools`）、instancer 失敗、subset 失敗（帶出工具的 stderr，測試是 `ERR-FAKE-42`）、subset 結束碼 0 卻沒寫出檔或寫出 0 位元組（`GoogleSansFlex`）。
    **先查輸入、再查工具**（來源檔不在而且 python 也找不到 → 講來源檔）。每一種都是 `--out` 與它的上一層一個位元組都不變（**全部做好才放進去**）、系統暫存資料夾清乾淨；
    `--out` 原本不存在、做到一半失敗 → 之後還是不存在（或是空的）。

**B6.3 預算（`font-text.test.js`、`woff2-cmap.test.js` 量純函式，`font-budget-cli.test.js` 量命令，`fonts-files.test.js` 量提交進來的檔）**

18. 〔測試工程師〕`lib/font-text.js`：`charsOf(text)` —— 出現過的字，以碼位算（𠮷 是一個字）、不重複、照碼位由小到大，回傳字串陣列；空白（`/\s/u`，含全形空白、BOM）不算；不是字串 → `TypeError`。
    `isCjk(ch)` —— 第 5 條；`ch` 不是剛好一個碼位的字串 → `TypeError`。兩支命令都用它們（收字的規則只寫一次）。
19. 〔派工〕缺字要讀子集的 cmap 才準：〔測試工程師〕**在 Node 裡讀**（不叫 python），`fonts:budget` 與 `npm test` 在沒有 python 的電腦也能跑。`lib/woff2-cmap.js` 的 `woff2CodePoints(buffer)`：
    - 回傳有對應字形的碼位（數字陣列，不重複、由小到大）。用 `node:zlib` 的 brotli 解壓，照表目錄算 cmap 的位置：UIntBase128；`glyf`、`loca` 的 transform version 0 與 `hmtx` 的 version 1 是轉換過的，壓縮資料裡的長度是 transformLength。
    - cmap 讀 platform 0 的、platform 3 encoding 1 與 10 的子表，format 4 與 12（其他略過），全部合起來；對到 glyph 0 的不算。
    - 檔尾有 private data 也照讀；一個字都沒有 → 空陣列。不是 WOFF2（`wOFF`、`OTTO`、純文字、空的）、截斷、brotli 解不開、沒有 cmap → `Error`。
    測試用程式現組 WOFF2（`b6-font-fixture.js` 的 `woff2Font`，前面有轉換過的 glyf、loca；fontTools 讀得懂它），真的 fonttools 產出另外對一次（第 26 條）。
20. 〔派工〕`node scripts/fonts-budget.mjs --text <檔> [--text <檔>…] [--fonts <字型資料夾，預設 public/fonts>]`（`npm run fonts:budget -- --text <copy.md> --text content/news.zh.md …`）：
    - 〔派工〕預算：`<字型資料夾>` 底下**所有** `.woff2` 合計 ≤ **153600** 位元組（150 KB，1 KB＝1024 位元組；剛好等於算過）。
    - 〔派工〕中文頁網頁字型下載量 0：每個 `.woff2` 的 cmap 都沒有中日文字（有的話講出檔名與「中日文」）；`fonts.css` 每個 `@font-face` 都有 `unicode-range`、而且不碰中日文（講「中日文」或「unicode-range」）。
    - 〔派工 2026-10-02〕缺字：`--text` 檔裡的非中日文字（整份、空白不算），跟 **`<字型資料夾>` 裡所有 `.woff2` 的 cmap 聯集**比（字型堆疊裡兩套都有，等寬標籤與資料夾樹會用 Mono；
      只在 JetBrains Mono 有的 → U+2192、Ω 不算缺）。聯集裡還找不到的分兩類：
      **字母與數字**（Unicode 類別 L*、N*，含帶重音的拉丁字母，例如 ñ、Ω、½）→ 列出字與 `U+XXXX`（大寫十六進位、至少 4 位）、結束碼 1；
      **符號、標點與其他**（S*、P*、M* 等，例如 ☰ ✕ ↺ ▶ ─ ├ € §、組合記號 U+0301）→ 只印「警告」、講這些會用「系統字型」顯示、列出字與 `U+XXXX`，**結束碼不因此變 1**。
      中日文字照舊不算缺字（走系統字型）。
    - stdout：每個 `.woff2` 一行（檔名＋位元組）；一行 `合計：<N> 位元組…`（N 是整數、不加千分位）。
    - 結束碼：0 ＝ 都過（只有符號警告也是 0）；1 ＝ 超過（「超過」）、有中日文字型、缺字母或數字、`fonts.css` 不在、`GoogleSansFlex-site.woff2` 不在或讀不了、文字檔不在／是資料夾／空的／只有空白（講出檔名）；
      2 ＝ 用法錯誤（含 `--fonts` 不存在）。只讀不寫、不叫 python。
21. 〔派工 2026-10-02〕真的 copy.md 的那一條要設 `SITE_COPY_MD` 才跑（copy.md 在網站 repo 外面），量 copy.md ＋ content/*.md：結束碼 0；
    copy.md 用到的 → ↓ ↺ ─ ├ ▶ ☰ ✕ 裡，提交進來的瘦身檔聯集找不到的（測試用 `lib/woff2-cmap.js` 讀出來比），每個都要以 `U+XXXX` 出現在輸出、而且有「警告」。

**B6.2 提交進來的 `public/fonts/`（`fonts-files.test.js`；fvar 在 `fonts-real.test.js`）**

22. `.woff2` 剛好是 `GoogleSansFlex-site.woff2` 與 `JetBrainsMono-site.woff2`（沒有 Glow Sans TC、沒有原樣的拉丁字型）；每個的 cmap 有 ASCII 全部、沒有中日文字。
    fonts.css 剛好兩個 `@font-face`：`font-family` ＝ LICENSES.md 那一套的 CSS 名稱、各指一個瘦身檔、swap、unicode-range 含 ASCII 不碰中日文、Google Sans Flex 是 `300 700`。
    所有 `.woff2` 合計 ≤ 153600。`content/*.md` 的字母數字都在瘦身檔的聯集裡（`fonts:budget --text content/*.md` 結束碼 0；使用者在 content/ 寫了瘦身檔沒有的字母會紅 —— 提醒重跑 `npm run fonts`；符號只警告）。
    〔派工 2026-10-02〕`GoogleSansFlex-site.woff2` < 71680 位元組（70 KB）；@font-face 沒有用 font-variation-settings 釘 opsz。
    （有 python 時）`GoogleSansFlex-site.woff2` 的 fvar 軸剛好是 opsz 8～64 與 wght 300～700。
23. 〔派工〕整個 `public/fonts` 的大小寫進 README：〔測試工程師〕`homepage/site/README.md` 有一段（空行切段）寫到 `public/fonts` 與一個「數字＋KB／MB／KiB／MiB」，
    跟 `public/fonts/` 整個資料夾（含 LICENSES.md 與授權檔）實際的位元組差 5% 以內（KB、MB 用 1000 或 1024 算都可以）。手寫或命令寫都可以。

**真的 fonttools（`fonts-real.test.js`）**

24. 〔派工〕只在有 python＋fonttools＋brotli 時跑（環境變數 `PYTHON`，沒設用 PATH 的 `python3`；`import fontTools, brotli` 失敗就 skip 並寫原因）。
25. 不讀設計系統與 clipper 的字型：用那個 python 的 `fontTools.fontBuilder` 現做兩個很小的可變字型（Google Sans Flex 假的有 opsz、wdth、slnt、wght 四個軸與「你」；JetBrains Mono 假的只有 wght），存成 WOFF2。
26. 量：`npm run fonts` 只靠 `PYTHON` 拿工具、結束碼 0；fontTools 讀回來：兩個都是 WOFF2、Google Sans Flex 的 fvar 軸剛好是 opsz 8～64 與 wght 300～700、有 ASCII 與文字檔裡的 é … →、沒有「你」；
    JetBrains Mono 有 ASCII、沒有中日文字；`lib/woff2-cmap.js` 讀這兩個真的輸出跟 fontTools 一樣；`fonts:budget` 結束碼 0，文字檔多一個符號 ↺ → 還是 0、警告 U+21BA，
    再多一個字母 ñ → 1、列出 U+00F1。
    另一條：提交進來的 `public/fonts/GoogleSansFlex-site.woff2` 的 fvar 軸剛好是 opsz 8～64 與 wght 300～700（不在就紅）。

**B6.4 圖片轉 WebP（`images-cli.test.js`）**

27. 〔測試工程師〕`node scripts/images.mjs --from <素材資料夾> [--out <資料夾，預設 public/images>]`（`npm run images -- --from <資料夾>`）。
    〔派工〕cwebp 的路徑用環境變數 `CWEBP`；〔測試工程師〕空字串當作沒設，沒設就用 PATH 的 `cwebp`（跟 4-b3 一樣）。
28. 〔測試工程師〕來源：`--from` 那一層（不往下找）副檔名 `.png`、`.jpg`、`.jpeg`（大小寫都算）的檔；其他（`.svg`、`.txt`、`.` 開頭的檔）略過、不算壞。
    **mark.svg 不轉**（向量圖轉成 WebP 只會變糊變大；圖示另外處理）。
29. 〔派工〕每張出寬 640 與 1280 兩個尺寸、原圖不夠寬就只出原寬、不放大。〔測試工程師〕寫成量得到的：目標寬度 ＝ `[640, 1280]` 每個取 `min(那個寬, 原寬)` 再去掉重複 ——
    1920 → 640、1280；1280 → 640、1280；1000 → 640、1000；300 → 300。檔名 `<來源檔名去掉副檔名>-<寬>.webp`（`步驟 一.png` → `步驟 一-640.webp`）。
    〔派工〕寬高比跟原圖一樣（高 ＝ 原高 × 寬 ÷ 原寬，誤差 1px）。
30. 〔派工〕images.json（檔名、寬高、位元組）：〔測試工程師〕`JSON.stringify(物件, null, 2) + '\n'`；鍵是來源檔名（含副檔名），照 JavaScript 預設的 `sort()`（UTF-16 碼的順序，不是 `localeCompare`）；
    值剛好 `{ width, height, sizes }`（原圖的寬高，照這個順序）；`sizes` 照寬度由小到大，每筆剛好 `{ file, width, height, bytes }`（輸出檔的實際寬高與位元組）。`--out` 裡的 `.webp` 剛好是 images.json 列的那些（加上原本就在、不是這批圖產生的）。
31. 〔派工〕寬的圖縮成 640 要比原圖小 50% 以上（測試量 1920、2000、1280 寬的假 PNG 與假 JPEG）。
    〔派工 2026-10-02〕規則維持，但真的素材不是每張都到得了：800 寬的那幾張（step2-saved）縮成 640 只小 46%～49.6%（檢查員量的）—— 原圖只比 640 寬一點，像素只少 36%；測試只量 1280 寬以上的。
    〔測試工程師，2026-10-02 加速〕測試圖的寬度照規則需要的寬度（1920、2000、1280、1000、800、700、660、300），**高度壓到 20～30**（直式那張 JPEG 660×1100 留著量直的比例）：
    後端的無損是 `-z 9`，每次叫 cwebp 至少 0.3～0.4 秒，時間跟像素數與呼叫次數走。「重跑不重算」「換一張」兩條改用一小組（wide.png、photo.jpg、small.png、mid.png），
    每一種寬度規則在「成功」那條量；「不寫到別的地方」那條用一張 300 寬的小圖。圖片這支從約 99 秒降到約 14 秒、整套從約 98 秒降到約 15 秒（2026-10-02 這台 mac 量的）。
32. 〔派工〕重跑不重算：〔測試工程師〕用修改時間判斷 —— 來源沒變時重跑，每個 `.webp` 的修改時間不變、images.json 位元組相同、結束碼 0。
    來源換了一張（新的檔、新的寬高）只重算那一張；來源拿掉一張，它的 `.webp` 與 images.json 那一筆都拿掉；`--out` 裡不是 `.webp`／images.json 的檔不動；
    〔派工 2026-10-02〕**不是這批圖產生的 `.webp`**（檔名不是「<來源名>-<寬>.webp」，測試放 `other-name.webp`）也不能刪、不能改 —— 第一次跑、拿掉一張來源再跑都一樣。怎麼判斷「沒變」由後端定（修改時間、內容雜湊都可以），測試只看結果。
33. 〔派工〕壞檔或讀不了的圖只壞那一張、結尾列出、其餘照做、結束碼非 0。〔測試工程師〕結束碼 1；好的照樣寫進 images.json；壞的沒有任何輸出；
    stderr **最後幾行**一張一行，每行有那個檔名與中文原因（原因裡的換行要拿掉 —— cwebp 的錯誤訊息有好幾行）。測試的壞法：純文字的 `.png`、只剩前 40 位元組的 PNG、假的 JPEG 檔頭、空檔、`chmod 000` 的 PNG（Windows 與 root 跳過這一個）。
34. 〔測試工程師〕先看來源有沒有圖、再查 cwebp（跟 4-b3 先查輸入檔再查工具一樣）：一張圖都沒有（空資料夾、只有 `.svg` 與 `.txt`）→ 結束碼 1、stderr 有「沒有」、`--out` 不動
    （有「來源拿掉就刪 .webp」的規則，路徑給錯不能把 `public/images` 清空）。cwebp 跑不起來 → 結束碼 1、stderr「cwebp 跑不起來」＋試的路徑＋「找不到」、`--out` 不動。
35. 〔派工〕介面截圖用無損、照片可用有損，由後端量過再定、寫下理由；測試不鎖品質數字。〔測試工程師〕`homepage/site/README.md` 要有一段同時寫到 `npm run images`（或 `scripts/images.mjs`）、「無損」「有損」，以及照「副檔名」或「檔名」判斷用哪一種；`scripts/images.mjs` 的檔頭註解也寫到「無損」「有損」。

**B6.5 邊界與結構（`structure-b6.test.js`，與命令測試裡的「homepage/site/ 底下一個檔都不動」）**

36. 〔派工〕package.json 仍沒有 dependencies（也沒有 devDependencies）；〔測試工程師〕`scripts.fonts` ＝ `node scripts/fonts.mjs`、`scripts["fonts:budget"]` ＝ `node scripts/fonts-budget.mjs`、
    `scripts.images` ＝ `node scripts/images.mjs`；**沒有** `scripts["fonts:subset"]`（第二版作廢）。
37. 〔測試工程師〕`lib/font-text.js`（匯出 `charsOf`、`isCjk`）、`lib/woff2-cmap.js`（匯出 `woff2CodePoints`）：檔頭 JSDoc 寫 `@param`、`@returns`，只 import `node:` 與 `./`（跟既有的 lib 結構測試一致）。
    三支命令只 import `node:` 與 `../lib/<檔>.js`；`fonts.mjs` 用 `charsOf`、`isCjk`，`fonts-budget.mjs` 用 `charsOf`、`isCjk`、`woff2CodePoints`，都不自己定義。
38. 〔派工〕腳本只寫 public/、scripts/ 與 README，不改 design/、不碰 ~/Desktop/ArticleCreator。〔測試工程師〕量法：三支命令與兩支 lib 去掉註解之後沒有寫死的外部路徑
    （`design/`、`release/`、`tutorial/`、`clipper/`、`ArticleCreator`、`design_system_nox`、`/Users/`、`homebrew`、`venv`、`scratchpad`、`../..`）；給了 `--out` 跑完一次，`homepage/site/` 底下每個檔的大小與修改時間都不變（fonts、images 各量一次）。
39. 〔測試工程師〕三支命令的檔頭註解（第一個 import 之前）寫到：fonts.mjs ——`npm run fonts`、`--from`、`--text`、`PYTHON`、`fontTools`、`instancer`；
    fonts-budget.mjs ——`npm run fonts:budget`、`--text`、`150`；images.mjs ——`npm run images`、`--from`、`CWEBP`、「無損」「有損」。
40. 這一段新加的測試與小工具：第一行是 `//` 說明、檔頭寫到 4-b6 或 B6、去掉註解之後不往 `homepage/site/` 外面讀（假的 python 引用 `tests/b6-font-fixture.js` 不算）。

**放回錯誤驗證**（2026-10-02，測試工程師在暫存資料夾的複本裡寫了一份參考實作 —— 用真的 python＋fonttools 時整套全綠 —— 一次放回一種錯。前兩版字型相關的紀錄作廢，下面字型的是第三版重做的）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 預算的上限放寬成兩倍（超過不報） | B6.3 預算命令 153601：「超過要是結束碼 1，得到 0」；「多一個 .woff2 也算」那條也紅 |
| opsz 固定成單值 18（檢查員抓到的那個錯）〔2026-10-02 在後端實作的複本上做〕 | B6.2 字型命令：「可變軸要剛好是 opsz 8:64 與 wght 300:700…，得到 {"wght":"300:700"}」；真的 fonttools：「得到 [["wght",300,700]]」 |
| 多留 wdth 軸（wdth=75:100）〔同上〕 | B6.2 字型命令：「得到 {"opsz":"8:64","wdth":"75:100","wght":"300:700"}」；真的 fonttools：「得到 [opsz, wdth, wght]」 |
| 字型刪掉 --out 裡所有不是這次產出的 .woff2〔同上〕 | B6.2 字型命令「成功」：不是這支命令產出的 .woff2 要原封不動 |
| 圖片刪掉 --out 裡所有不在這批的 .webp〔同上〕 | B6.4「不是這批圖產生的 .webp 不刪」：讀 other-name.webp 時 ENOENT（被刪了） |
| LICENSES.md 寫了「派工人員」〔同上〕 | B6.1「沒有內部字眼」：「public/fonts/LICENSES.md：『派工』」 |
| fonts.css 多一個中日文 @font-face（Glow Sans TC，U+4E00-9FFF） | B6.2 字型命令 fonts.css：「要剛好兩個 @font-face（沒有中日文），得到 3」 |
| 子集沒去掉中日文字 | B6.2 字型命令「Google Sans Flex 的字」：「不能有中日文字」 |
| 失敗時留半成品（先寫 fonts.css 再叫工具） | B6.2 字型命令：instancer、subset 失敗、沒寫出、0 位元組、--out 原本不存在：「--out 一個位元組都不變 —— 不留半成品」 |
| 預算只算 fonts.css 用到的兩個檔 | B6.3 預算命令「多一個沒寫進 fonts.css 的檔也算」「資料夾裡有中日文字型」：「結束碼要是 1，得到 0」 |
| 預算不看中日文字型 | B6.3 預算命令「資料夾裡有中日文字型」：「結束碼要是 1，得到 0」 |
| 符號也擋（缺符號也結束碼 1） | B6.3 預算命令「缺的只有符號與標點 → 只警告」、真的文案（SITE_COPY_MD）、真的 fonttools：結束碼要是 0 |
| 字母不擋（缺字母數字只警告） | B6.3 預算命令「缺字母與數字」「缺字母也缺符號」「--text 給好幾個」、真的 fonttools：結束碼要是 1 |
| 缺字只量 Google Sans Flex（不用聯集） | B6.3 預算命令「→ 只在 JetBrains Mono 有」「Ω 放進 Mono」：不該列、結束碼要是 0 |
| 縮圖的高多 2px（寬高比錯；縮的那幾張才錯，避開後端自己的寬高檢查）〔2026-10-02 縮小測試圖後，在後端實作的複本上重做〕 | B6.4 成功、換一張、壞檔：「wide-640.webp：寬高比要跟原圖一樣（高應該約 10.00，得到 12）」 |
| 圖片每次都重算（沿用舊檔的判斷一律回「不能沿用」）〔同上，重做〕 | B6.4 重跑不重算：「來源沒變：.webp 一個都不重寫（修改時間不變）」；換一張：「photo-1280.webp：來源沒變，不該重寫」 |
| 壞檔拖垮其他張（一張壞就整批丟錯）〔同上，重做〕 | B6.4 壞檔：「--out 裡要有 images.json」（好的那張也沒做） |

另外兩件後端要注意的事（參考實作踩過）：`process.exit()` 寫在 `try` 裡，`finally` 的清暫存不會跑（「系統暫存資料夾要清乾淨」會紅）；cwebp 的錯誤訊息有好幾行，壞檔清單一張一行要先把換行拿掉。

**量到的事**（用參考實作與真的工具跑真的資料，給派工人員；不是測試）

- `npm run fonts -- --from clipper/fonts --text copy.md --text content/*.md`（真的 fonttools，約 2.7 秒）：opsz 固定 18 的時候 `GoogleSansFlex-site.woff2` 26,324 位元組（fvar 只剩 wght 300～700，105 個字）；
  〔派工 2026-10-02〕改成 opsz 留 8～64 之後是 61,840 位元組（檢查員量的，兩檔合計約 92 KB）。當時的另一檔：
  `JetBrainsMono-site.woff2` 30,264 位元組（照收字規則切子集、wght 100～800，108 個字）；合計 56,588 位元組（上限 153,600 的 37%）、public/fonts/ 整個約 67 KB —— 這兩個數字都是 opsz 固定 18 時量的。
- copy.md 有 8 個非中日文字 Google Sans Flex 本來就沒有：→ ↓ ↺ ─ ├ ▶ ☰ ✕。照派工 2026-10-02 的規則（兩套的聯集、符號只警告）重量：
  → ↓ ▶ 在 JetBrains Mono 裡有；聯集還缺 ↺ U+21BA、─ U+2500、├ U+251C、☰ U+2630、✕ U+2715，只印警告，`fonts:budget --text copy.md --text content/*.md` 結束碼 0，`SITE_COPY_MD` 那條是綠的。

## 已知限制（4-b6，沒有測試）

- 預設的 `--out`（`public/fonts`、`public/images`）沒量（一跑就寫進專案）；`fonts:budget` 的預設 `--fonts` 有量（從暫存資料夾叫）。
- 瘦身檔只含跑的那一刻文字檔裡的非中日文字（加 ASCII）：使用者之後在 content/ 寫了子集沒有的符號，那個字用系統字型顯示（不壞），要重跑 `npm run fonts` 再提交；提醒靠 `fonts:budget` 與第 22 條。
- 缺字量的是兩套的聯集：一個字只在 JetBrains Mono 有、卻出現在內文（Google Sans Flex）裡，會用 Mono 或系統字型補，測試不分開量。
- 字母與數字、符號的分法照 Unicode 類別（`\p{L}`、`\p{N}`）；Z*（空白類）多半已被當成空白略過，其餘 C*（例如零寬空白 U+200B）算「其他」，只警告。
- fvar 只在有 python 時量得到（`fonts-real.test.js`）；沒有 python 的電腦只量到「假 python 被叫的方式」。
- 「重跑位元組相同」只用假 python 量；真的 fonttools 換版本，輸出位元組可能不同。
- 假 python 是開頭 `#!` 的腳本，Windows 不能直接執行，`fonts-cli.test.js` 在 Windows 上整支 skip；Windows 上 `PYTHON` 要指到 `python.exe`（指到 `.cmd`／`.bat` 在不開 shell 時會 `EINVAL`，跟 4-b3 一樣），沒量。
- `woff2CodePoints` 只讀 cmap 的 format 4 與 12；format 14（異體字選擇器）、format 6、10、13 略過。
- 同一張圖有兩個副檔名（`a.png` 與 `a.jpg`）會撞到同一個輸出檔名，沒量、沒規定。
- 寫到一半才失敗（磁碟滿、沒有寫入權限、`--out` 是檔）沒量：字型那支量的是「先檢查完、全部做好才動 `--out`」，圖片那支是一張一張做的（壞一張不影響別張）。
- 「重跑不重算」（圖片）用修改時間量：換一台電腦 checkout 之後，修改時間會變，整批重算一次是可以的。
- 要 cwebp 的那幾條在沒有 cwebp 的電腦上 skip（寫明原因）；不用 cwebp 的照跑。`chmod 000` 那一張在 Windows 與 root 下跳過。
- 原文網址打不打得開、保留字型名稱的依據對不對，由檢查員人工查（第 8 條）。
- 測試與小工具裡沒有看不見的字（寫完用程式掃過；全形空白、BOM 一律寫成 `\uXXXX`）；𠮷、👍、中文檔名是看得見的字，留著好讀。

## 介面細則（4-b7：字串表 `npm run strings` 與標記解析 `parseSegments`）

測試案例是派工人員 2026-10-02 給的（B7.1～B7.4，下面標〔派工〕）；函式與命令的介面、細節是測試工程師在測試裡定的（標〔測試工程師〕），後端照這一節實作。
編號另起，跟 4-b1～4-b6 的不相干。標記的定義、巢狀規則、轉換順序照設計師的字串表說明（設計師那邊是 `design/homepage/strings/README.md`；網站裡是 `npm run strings` 一起帶進來的複本 `strings/README.md`）。
測試用的資料是 `b7-fixture.js` 組的（真的字串表挑出來的 10 個 id，含每一種標記），只有「真的資料」那條用環境變數指到設計師的資料夾。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B7"                  只跑 4-b7
npm test -- --test-name-pattern "B7.2"                只跑 parseSegments
npm test -- --test-name-pattern "B7.1|B7.3"           只跑命令（含提交進來的 strings/）
npm test -- --test-name-pattern "B7.4"                只跑結構與「不寫到別的地方」
SITE_STRINGS_DIR=<design/homepage/strings> SITE_COPY_MD=<design/homepage/copy.md> npm test -- --test-name-pattern "B7.1"   用設計師真的字串表（沒設就 skip）
```

檔案：`segments.test.js`（B7.2，`lib/segments.js`）、`strings-cli.test.js`（B7.1、B7.3、B7.4 的「不寫到別的地方」，真的開子程序、在暫存資料夾真的寫檔）、
`strings-files.test.js`（提交進來的 `strings/`）、`strings-real.test.js`（真的資料，選擇性）、`structure-b7.test.js`（B7.4 結構）；
`b7-fixture.js` 是共用的小工具（不是測試）：測試自己的序列化器 `toHtml`、照設計師 README 8 步轉的 `readmeHtml`、元素樹形狀檢查 `checkTree`、好的字串表與 copy.md。

**`parseSegments(text, values?)`（`lib/segments.js`）**〔測試工程師〕

1. `lib/segments.js` 匯出 `parseSegments`；檔頭 JSDoc 寫 `@param`、`@returns`；**一個 import 都沒有**、不用 `require`／`process`／`Buffer` —— 前端的 React 元件也要用，瀏覽器裡沒有 `node:` 模組。
2. 回傳元素樹（陣列，不產 HTML 字串）。節點是**非空字串**，或剛好 `{ type, props, children }` 三欄的一般物件；`props` 用 React 的屬性名，前端可以直接 `createElement(type, props, ...children)`：

   | 標記 | 節點 |
   |---|---|
   | `«…»` | `{ type: 'span', props: { className: 'u' }, children }` |
   | `{…}` | `{ type: 'span', props: { className: 'nw' }, children }` |
   | `\|` | `{ type: 'wbr', props: {}, children: [] }` |
   | `⟨…⟩` | `{ type: 'span', props: { className: 'clamp' }, children }` |
   | `⟦`／`⟧` | `{ type: 'span', props: { className: 'brk brk--l'`／`'brk brk--r', 'aria-hidden': 'true' }, children: [] }`（`'aria-hidden'` 是字串 `'true'`） |
   | `⁅…⁆` | `{ type: 'span', props: { className: 'nw-wide' }, children }` |
   | `¦` | `{ type: 'span', props: { className: 'brk-narrow' }, children: [] }` |
   | `↵` | 整句變成 `[l1, 空白?, l2]`：`l1`＝`{ type: 'span', props: { className: 'forai__l1' }, children: 前半句 }`、`l2` 同理 `forai__l2`；**↵ 前面緊接著的空白**（英文）拿出來放在兩個 span 之間，沒有空白（中文、日文）就是 `[l1, l2]` |

3. 字串節點是原字（沒有跳脫，React 會跳脫）：`a<b>c</b> & d` 回 `['a<b>c</b> & d']`。相鄰的字併成一個字串，沒有空字串節點；`''` 回 `[]`；沒有標記的字回 `[text]`。
4. 代入值只認 `%url%`、`%nn%`、`%章名%`（大小寫要對）。
   - 沒給 `values`：原樣留在字裡（`'看教學 %nn%'`）—— 命令驗證時這樣叫。
   - 給了 `values`：字裡每一個代入值都要有字串值，沒有就丟 Error（`err.index` 指那個 `%`，訊息寫出 `%nn%`）；換成字、跟旁邊的字併成一段。
     **最後才換**（設計師 README 第 8 步）：值裡的標記字元、HTML、`%…%` 都是普通的字，不轉、不再換一次；值是 `''` 就不留節點。多給的鍵不管。
   - `values` 不是一般物件（`null`、陣列、字串、數字）→ `TypeError`；`url`／`nn`／`章名` 有給但不是字串（數字、`null`、陣列、有 `toString` 的物件）→ `TypeError`。
5. `text` 不是字串 → `TypeError`。
6. 回傳一般物件：JSON 來回一模一樣；每次呼叫各給一份（改了上一次的結果不影響下一次）。
7. **同構**：測試的 `toHtml(樹)`（文字跳脫 `& < > "`、`class` 先寫、`wbr` 不寫結束標籤）要等於照設計師 README「轉換順序」8 步做字串取代的結果（先把字與代入值跳脫）。
   README 的例子（日文 `privacy.lead`）與中文首屏大標另外逐字比對 HTML。
8. **寫錯的標記丟 `Error`**（不是 `TypeError`、`RangeError`）：`err.index` 是出錯那個字在字串裡的索引（JS 的 UTF-16 索引）；訊息寫出那個字（代入值寫整個 `%nn%`）與「第 N 字」（N 以字算、1 起算 —— 前面有 𠮷、emoji 時跟索引不同）。

   | 寫錯的樣子 | 指哪個字 |
   |---|---|
   | 開了沒關（`«甲`、`{甲`、`⟨甲`、`⁅甲`） | 沒關的那個開頭 |
   | 多出來的結尾（`甲»`、`甲}`、`甲⟩`、`甲⁆`） | 那個結尾 |
   | 交錯（`«{甲»}`） | 對不上的 `»`，或沒關的 `{`，兩種都算 |
   | `{…}` 裡有 `{` | 裡面那個 `{` |
   | `{…}` 裡有 `«` | 那個 `«` |
   | `«…»` 第四層（最多三層，數的是 `«` 的層數） | 第四個 `«` |
   | `↵` 在任何成對標記裡；一句兩個 `↵` | 那個 `↵`；第二個 `↵` |
   | `¦` 不在 `⁅…⁆` 裡（外面任何一層有 `⁅` 就算在裡面） | 那個 `¦` |
   | `%` 後面不是 `url%`、`nn%`、`章名%`（`100%`、`%url`、`%foo%`、`%URL%`、`%%`） | 那個 `%` |
   | 給了 `values` 卻少了要的那個 | 那個代入值開頭的 `%` |

   `↵` 後半句的錯，位置照整句算。巢狀規則**只擋上面這幾種**（設計師 README 寫「不會」的與成對）；README 沒提到的組合不擋 —— 真的資料用到的 `⟨…⟩` 裡有 `{…}`、`⁅…⁆`、`|`、`⟦` `⟧`，最外層也有 `|`，這些都要過。
9. 很長的字：兩萬個單位（約二十萬字）2 秒內轉完、結果同構；很深的巢狀（兩萬層 `⟨`）不能撐爆堆疊（回樹或丟帶 `index` 的 Error 都可以，不能是 `RangeError`）—— 用自己的堆疊、不要遞迴。

**命令 `scripts/strings.mjs`**

10. 〔派工〕`npm run strings -- --from <design/homepage/strings 資料夾> [--copy <copy.md>] [--out <資料夾>]`。
    〔測試工程師〕`--from` 必填、沒有預設（來源在網站 repo 外面）；`--out` 預設是這支檔往上一層的 `strings/`（`homepage/site/strings/`，跟從哪裡叫無關）；`--copy` 可給可不給。
    `package.json` 的 `scripts.strings` ＝ `node scripts/strings.mjs`。
11. 〔測試工程師〕讀 `<from>/zh.json`、`en.json`、`ja.json` 與 **`README.md`**（設計師的字串表說明，跟著一起放進 `--out`，網站裡就有一份跟資料同版的說明，不會指到 repo 外面）。
    成功：結束碼 0；`--out` 裡的 `zh.json`、`en.json`、`ja.json`、`README.md` 跟來源**位元組相同**（原樣複製，不重新排版）；`--out` 不存在就建（含中間的資料夾）；
    舊的這四個檔換成新的，`--out` 裡別的檔不動；不留暫存檔。重跑（同一個 `--out`、另一個 `--out`、從別的資料夾叫）位元組相同；叫它的資料夾不多出檔。
12. 結束碼：0 成功、1 輸入或驗證不過、2 用法錯誤。〔測試工程師〕用法錯誤 ＝ 沒給 `--from`、`--from=`／`--out=`／`--copy=` 空字串、`--from` 缺值、不認得的參數、多出來的位置參數、`--from` 不存在或不是資料夾：
    結束碼 2、stderr 第一行是中文（不是 Node parseArgs 的英文）、不建 `--out`、叫它的資料夾還是空的（跟 4-b6 一樣，用 `b6-fixture.js` 的 `usageError` 量）。
13. 〔派工〕驗證不過 → 結束碼 1，講出哪個檔、哪一條：〔測試工程師〕stderr 第一行是中文、沒有堆疊（不丟難懂的例外）；**每一個問題一行**，那一行要同時寫到 id 與語言（`zh`／`zh.json`／中文都算）。
    - 語言檔：不在、是資料夾、空檔、只有空白、不是 JSON（那一行要有「JSON」）、不是物件（陣列、`null`、字串）→ 那一行寫出檔名（`en.json`）。
    - 缺 `README.md` → 寫出 `README.md`。
    - 值不是字串（數字、`null`、物件、陣列）→ 語言＋id。
    - 標記寫錯（`parseSegments` 丟的 Error）→ 語言＋id＋「第 N 字」（第 8 條）。
    - 三語 id 不一致：每一個缺的、多的 id 各一行，寫出 id 與**缺它（或多它）的那個語言**。
    - `--copy`：檔不在、是資料夾、裡面沒有文案表 → 寫出那個檔名；copy.md 有而字串表沒有的 id（任何一個語言缺都算）→ 每一個各一行，stderr 要講到 `copy.md`。
    - **一次列出全部**：測試量了三語各一條標記錯、四條值不是字串、缺與多兩個方向、copy.md 缺兩個 id，都要在同一次的 stderr 裡。
14. 〔測試工程師〕copy.md 的 id ＝ 表頭剛好是 `| id | zh | en | ja | 來源 | 確認 |` 的表（文案表）裡，每一列的第一格（去掉頭尾空白；分隔列 `|---|` 不算；表格到第一個不是 `|` 開頭的行為止）。
    其他表不算：真的 copy.md 有一張版本表（第一格 `1.0.5`）與一張字數表（表頭 `| id | zh | en | ja | 為什麼要注意 |`，id 用 `` ` `` 包著）；fixture 兩種都放了，字數表裡有一個字串表沒有的 id。
    這個讀法在真的 copy.md 讀到 289 個 id，跟三個 JSON 剛好相同。只查「copy.md 有、字串表沒有」；字串表有、copy.md 沒有的不報（派工只要求這個方向）。
15. 〔派工〕成功才寫入、不留半成品：〔測試工程師〕任何一種失敗，`--out` 一個位元組都不變（原本不存在就還是不存在）；
    `--out` 裡這四個名字之一是資料夾 → **在寫任何檔之前就發現**（其他三個還是舊的），結束碼 1、寫出那個名字；`--out` 是一個檔 → 結束碼不是 0、那個檔不變、stderr 第一行是中文。
16. 〔派工〕不改 design/：跑完（成功或失敗）`--from` 一個位元組都不變；給了 `--out`，`homepage/site/` 底下每個檔的大小與修改時間都不變。
17. 邊界〔測試工程師〕：空字串的值可以（`parseSegments('')` 是 `[]`）；二十萬字的值、𠮷、emoji、ZWJ 都可以；資料夾名有空白與中文（「字串 來源」「輸出 資料夾」「文案 表」）。

**提交進來的 `strings/`（`strings-files.test.js`）**

18. 〔測試工程師〕`homepage/site/strings/` 剛好 `zh.json`、`en.json`、`ja.json`、`README.md`（後端用設計師真的資料跑 `npm run strings` 產出再提交）；三語 id 相同、值都是字串、README 寫到 `«`；
    每一條（有給、沒給代入值各一次）轉得過 `parseSegments`、跟 README 的轉換同構。設了 `SITE_STRINGS_DIR` 另外比：四個檔跟設計師的位元組相同（不同就是設計師改過，要重跑 `npm run strings`）。

**真的資料（`strings-real.test.js`）**

19. 〔測試工程師〕只有設了 `SITE_STRINGS_DIR` 才跑（`SITE_COPY_MD` 可選，跟 4-b6 同一個變數）；設了但那裡缺四個檔之一、或 `SITE_COPY_MD` 指到不存在的檔 → 紅（路徑打錯不能靜靜略過）。
    量：命令結束碼 0、四個檔原樣寫出、設計師的資料夾不變、三語每一條同構；有 copy.md 時 copy.md 文案表的每個 id 都在三語裡（測試自己讀 copy.md）。

**結構（`structure-b7.test.js`，B7.4）**

20. 〔派工〕package.json 仍沒有 dependencies（也沒有 devDependencies）。〔測試工程師〕`lib/segments.js` 見第 1 條；`scripts/strings.mjs` 只 import `node:` 內建與 `../lib/<檔>.js`、import `../lib/segments.js` 並用 `parseSegments`、不自己定義；
    兩支去掉註解之後沒有寫死的外部路徑（`design/`、`release/`、`tutorial/`、`clipper/`、`ArticleCreator`、`design_system_nox`、`/Users/`、`scratchpad`、`GPTPlugins`、`../..`、`'..', '..'`）；
    `scripts/strings.mjs` 的檔頭註解（第一個 import 之前）寫到 `npm run strings`、`--from`、`--copy`、`--out`、`strings/`。
    這一段新加的測試與小工具第一行是 `//` 說明、檔頭寫到 4-b7 或 B7、去掉註解之後不往 `homepage/site/` 外面讀。

**放回錯誤驗證**（2026-10-02，測試工程師在暫存資料夾的複本裡寫了一份參考實作 —— 整套全綠、設了真的資料也全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| `{` 裡有 `{` 沒報 | B7.2 巢狀違規：「{ 裡有 {：「{甲{乙}丙}」要丟 Error，結果沒丟」；B7.1 標記寫錯（zh hero.meta.os 那一行沒出現） |
| `«` 不限層數 | B7.2 巢狀違規：「«…» 第四層 … 要丟 Error，結果沒丟」 |
| 三語 id 不一致沒報 | B7.1 id 不一致兩條：「結束碼要是 1，得到 0」 |
| 冪等被破壞（README.md 後面加產生時間） | B7.1 成功、舊檔換新、冪等、邊界：「README.md 要跟來源位元組相同」 |
| 失敗時留半成品（驗證之前先寫 zh.json） | B7.1、B7.3 每一條出錯的：「--out 一個位元組都不變（不留半成品）」 |
| `--out` 裡同名的資料夾寫到一半才發現 | B7.1 不留半成品：「zh.json、en.json、README.md 不能先換成新的」 |
| `↵` 前的空白留在 l1 裡 | B7.2 ↵ 兩行大標：「英文 forai.title：元素樹不對」；10 個 id 同構；提交進來的 strings/ 同構 |
| 代入值先換再解析（值裡的標記被轉） | B7.2 代入值最後才換：「第 15 字「↵」：只能在最外層」（值裡的 ↵ 被當成標記） |
| `err.index` 用字數不用字串索引 | B7.2 位置以字算：「emoji 後面的 « 沒關：err.index 要是 2，得到 1」 |
| 沒關的開頭報在字串結尾 | B7.2 不成對、字面的 %、位置以字算、↵ 後半段；B7.1 標記寫錯 |
| 單獨的 `%` 當字（不檢查） | B7.2 字面的標記字元：「單獨的 %：「成長 100%」要丟 Error」；B7.3 字面的標記字元 |
| 很深的巢狀用遞迴撐爆堆疊 | B7.2 很深的巢狀：「不能撐爆堆疊：Maximum call stack size exceeded」 |
| copy.md 表頭只看前四格（字數表也算） | B7.1 成功等：「copy.md 有、字串表沒有：`not.in.strings`」 |
| README.md 沒跟著寫出 | B7.1 成功：「--out 裡剛好 zh.json、en.json、ja.json、README.md」 |

**量到的事**（用參考實作跑設計師 2026-10-02 的真資料，給派工人員；不是測試）

- 三語各 289 個 id、一致；copy.md 照第 14 條讀到 289 個 id、一個不缺；每一條都轉得過、跟 README 的轉換同構（有給、沒給代入值）。
- 用到的標記：`«` 496、`{` 320、`|` 116、`⟨` `⟦` `⟧` `⟩` 各 6、`⁅` `¦` `⁆` 各 2、`↵` 3（三語的 `forai.title`）；代入值 `%url%` 6、`%章名%` 6、`%nn%` 3。
  `«` 最深三層的只有日文 `req.lang`；最外層的 `|` 有中文 `hero.mobile.bold`、`where.label`。

## 已知限制（4-b7，沒有測試）

- JSON 的重複鍵（同一個 id 寫兩次）偵測不到：`JSON.parse` 默默取後面那個。派工說偵測不到就不硬測。
- 語言檔是 CRLF 或開頭有 BOM 沒量（設計師的 build.mjs 寫的是 LF、沒有 BOM；原樣複製也不會改它）。帶 BOM 的話 `JSON.parse` 會失敗、報「不是 JSON」。
- 不比對字的內容：拿掉標記之後跟 copy.md 一字不差，是設計師的 build.mjs 每次產生時核對的（README「格式」第 2 點），命令只比 id。
- `parseSegments` 只做 README「標記」那張表；README 另外幾節由前端照 id 處理，不在這裡：`hero.mobile.text` 開頭包 `<b>`、`hero.pc` 等幾句結尾的箭頭圖示、
  章名與摘要（從資料轉進來的字，`bindRanges` 那套規則）、使用者自己寫的內容（`lib/bind-tail.js`）。
- 巢狀規則只擋第 8 條那幾種；README 沒提到的組合（`⟨` 套 `⟨`、`{…}` 裡有 `⁅`…）不擋也不報。
- 寫到一半才失敗（磁碟滿、沒有寫入權限）沒量；`--out` 是唯讀資料夾沒量。預設的 `--out`（`homepage/site/strings/`）沒量 —— 一跑就寫進專案。
- 「一次列出全部」沒量好幾個語言檔同時壞掉（例如 zh.json 不是 JSON、en.json 也是空檔）。
- `strings/README.md` 是設計師說明的原樣複本，裡面寫的 `design/homepage/…` 路徑（`build.mjs`、`copy.md`、`{zh,en,ja}/index.html`、`home.css`）在網站 repo 裡沒有；它不在 `public/`、不會放上網站，但會跟著網站 repo 公開。沒有測試擋。
- 已處理（2026-10-02 與前端合併時）：`structure-b7.test.js` 的「沒有任何套件」原本用 `assert.equal(pkg.dependencies, undefined)`、`assert.equal(pkg.devDependencies, undefined)` 寫死，前端加了 next、react、react-dom 之後會變紅；已改成跟 `structure-b2`～`b6` 一樣叫 `helpers.js` 的 `assertPackageWhitelist`（見最後「4-f1 的 F1.7」那一節）。
- 測試檔裡的 ZWJ、組合濁點一律寫成 `\uXXXX` 跳脫（寫完用程式掃過）；𠮷、👍🏽、😀 是看得見的字，留著好讀。

## 介面細則（4-b9：公告保留換行、英文孤字綁定）

測試案例是派工人員 2026-10-02 給的（B9.1～B9.3，之後加了 B9.4、B9.5；下面標〔派工〕）；細節是測試工程師在測試裡定的（標〔測試工程師〕），後端照這一節實作。編號另起。
理由〔派工〕：使用者自己寫的內容（公告、更新紀錄）要照寫的人的換行顯示，只補防孤字的安全網（字串表說明 `strings/README.md`「使用者自己寫的內容」）；
原本 `lib/news.js` 把內文多行接成一段（4-b1 第 41 條），`lib/bind-tail.js` 英文不綁（4-b2 第 9 條），兩條都跟那一節不一致，以字串表說明為準。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B9"                  只跑 4-b9 新加的
npm test -- --test-name-pattern "B9.1|三修F"          公告換行（含改過的舊條目）
npm test -- --test-name-pattern "B9.2|B2.2|B2.3"      英文綁字（含改過的舊條目）
```

檔案：`news-lines.test.js`（B9.1）、`bind-tail-en.test.js`（B9.2）、`structure-b9.test.js`（B9.3）、`bind-tail-icon.test.js`（B9.4）、`content-check-social.test.js`（B9.5）；
`fixtures/news-lines/news.<zh|en|ja>.md` 是三語各一支多行內文的公告檔（段落、連續三個空白行、標題下與結尾的空白行、連結夾在兩行中間、置頂夾在兩段中間、一則寫壞的標題）。
**改過的舊條目**〔派工 4-b9〕：`news.test.js` 六條（B1.2 公告讀得出來、修補9 註解在內文中間、二修2 落單的 -->、二修細則 ###、三修F、三修H）的 body 從「接成一段」改成用 `\n` 接；
`bind-tail.test.js` 的 `checkSafe`（英文也是一組 span）、B2.2 英文、B2.3 `<script>` 的英文那一句改成英文綁最後兩個字。

**公告內文 `parseNews` 的 body（B9.1）**

1. 〔派工〕好的公告的 `body` 保留使用者的換行：內文的行與行之間是 `\n`；中間有空白行（段落）是 `\n\n`，連續好幾個空白行壓成一個 `\n\n`；每行去掉頭尾空白；整段去掉頭尾的空白行；不再接成一行。
   〔測試工程師〕細節：
   - 「空白行」＝原檔裡只有空白的行（空白、Tab、全形空白也算）。每行去掉的是**頭尾**的空白（沿用既有讀法：行首的空白也去掉）。
   - 「連結：」「置頂」那一行、註解（`<!-- … -->`，含跨好幾行的）那幾行、落單的 `-->` 那一行：不算內文，**也不算空白行** —— 前後兩行之間是 `\n` 還是 `\n\n`，只看中間有沒有真的空白行
     （連結夾在兩行中間沒有空白行 → `\n`；置頂前後都有空白行 → `\n\n`）。
   - body 裡沒有 `\r`（CRLF＋BOM 的檔結果跟 LF 一樣）；沒有三個以上連續的 `\n`；頭尾不是 `\n`。
   - 只有空白行、連結、置頂，沒有字 → `''`。單行內文照舊是那一行。
2. 〔派工〕不變的：欄位剛好 `ok, id, date, category, title, body, link, pinned`；壞紀錄 `{ ok: false, line, raw, reason }` 與哪些寫法算壞都不變（好幾段的公告裡連結、置頂寫壞照舊整則壞、指寫壞的那一行）；
   id 只看日期與標題（同一則的內文排成一行、好幾行、好幾段，id 一樣）。`readContent` 讀到的跟 `parseNews` 一樣。
3. 〔測試工程師〕前端把 body 交給 `bindTail(body, lang)`（樣式用 `white-space: pre-line`）：換行數不變、剛好一組 span、在最後一行的結尾。

**`bindTail(text, 'en')`（B9.2）**

4. 〔派工〕英文：最後一個非空行的最後兩個字包進 `<span class="nw">…</span>`。「字」＝以空白（JS 的 `\s`：空白、Tab…）切開的一段，標點、連字號、縮寫的點、撇號、emoji、網址都跟著它，
   所以 `well-known`、`e.g.`、`It’s`、`👍🏽`、`https://…?a=1&b=2` 都是一個字、不會從中間拆；只有標點的那一段（`—`、`!`）自己也是一個字。
5. 兩字之間的空白（一個或好幾個、Tab）在 span 裡；兩字之前的空白、結尾的空白與換行在 span 外。只有一個字就整個包；最後一行只有一個字就只包它，**不從上一行借**。
6. 多行：前面的行原樣（跳脫後），`\n`、`\r\n`、空白行都原樣保留。
7. 跳脫跟中日文一樣（先切字、再跳脫）：`& < > " '` → `&amp; &lt; &gt; &quot; &#39;`；輸入裡字面的 `&amp;` 是字，跳脫一次變 `&amp;amp;`；字面的 `<span class="nw">` 也是字。
8. 空字串回空字串；只有空白與換行的原樣回、沒有 span；`...`、`! ?`、`<`、`&` 這類只有標點的整段包。不丟例外。二十萬字的一行 2 秒內。
   中文、日文照舊（最後三個字位）；中文頁面裡的英文照中文的規則（`Save the page.` 在 zh 是 `Save the pa<span class="nw">ge.</span>`）。
   `lib/bind-tail.js` 的檔頭不能再寫「英文不綁」、要寫到英文最後兩個字；`strings/README.md`「使用者自己寫的內容」那一節照舊寫「中文、日文：最後三個字」「英文：最後兩個字包進 `<span class="nw">`」。

**尾端圖示 `bindTail(text, lang, { tail })`（B9.4）**

10. 〔派工〕`tail` 是呼叫端給的已安全的 HTML 片段（例如 `<span class="i i--arrow"></span>`、`<svg …>`），插在綁住那段 span 的**裡面、結尾**（`…最後幾個字` + tail + `</span>`），跟最後幾個字一起換行；
    **原樣放、不跳脫** —— 呼叫端負責安全，只能傳自己寫的固定片段，不能放使用者寫的字（`lib/bind-tail.js` 的 JSDoc 要寫到 tail、「原樣」或「不跳脫」、「固定」）。
11. 〔派工〕沒給 tail 時行為完全一樣。〔測試工程師〕不給第三個參數、`undefined`、`{}`、`{ tail: undefined }`、`{ tail: '' }` 都算沒給；tail 不是字串（數字、`null`、陣列、物件）→ `TypeError`。
12. 〔測試工程師〕結尾的空白與換行照舊在 span 外面（tail 在 `</span>` 前、空白在後）；多行只放最後一行的尾巴；三語、只有一個字、很短都量。
    文字是空的或只有空白（沒有可以綁的字）：不丟例外、tail 出現剛好一次（放在哪裡沒規定；參考實作接在最後面、不包 span）。
    每一條另外量：tail 原樣出現剛好一次，拿掉 tail 之後跟沒給 tail 的結果一模一樣。

**社群代號缺名稱的警告（B9.5，`lib/content-check.js`、`scripts/content-check.mjs`）**

13. 〔測試工程師〕`checkContent(dir, { strings })`：`strings` 是字串表資料夾（裡面 `zh.json`、`en.json`、`ja.json`）。**沒給就不做這項檢查**（跟以前一樣，4-b4 的測試不受影響）。
14. 〔派工〕links.md 每一個好的代號，三語的字串表都要有 `social.<代號>`；缺的 → `warnings` 有 `{ file: 'links.md', message }`，message 寫到代號、`social.<代號>` 與缺的語言的檔名（`zh.json`／`en.json`／`ja.json`）。
    〔測試工程師〕一個代號一條（列出缺的語言）或一個代號一語一條都可以；三語都有的代號不警告；寫壞的連結（代號不合法）照舊是 problem，不另外警告名稱。
    **不算錯**：`ok`、`problems` 不受影響，命令的結束碼照舊（沒有要修的 0、有要修的 1）。
15. 〔派工〕找不到字串表資料夾：講清楚、不丟例外。〔測試工程師〕剛好一條警告，寫到「找不到」與那個資料夾（路徑或 strings）；某一語的檔不在或不是 JSON → 一條警告寫到那支檔名（不是 `social.` 那種），其他語言照常檢查。
16. 〔測試工程師〕命令：`--strings <資料夾>`，沒給就用網站的 `strings/`（`scripts/../strings`，跟從哪裡叫無關）；`--strings=` 空字串是用法錯誤（結束碼 2、stderr 第一行中文）；
    `--strings` 指到不存在的資料夾 → 警告（「找不到」）、結束碼 0（不擋部署，所以不當用法錯誤）。輸出的警告那一行寫到 `links.md` 與 `social.<代號>`。
    測試用暫存資料夾組 content/（`fixtures/content-check/good/` 的複本）與 strings/（測試自己寫的小 JSON），跑完 `homepage/site/` 底下一個檔都不變。
    「不給 --strings」那條用一個網站字串表一定沒有的代號（`zzqtestcode`）量，並確認 `social.blog` 不被警告。

**結構（B9.3）**

9. 〔派工〕`package.json` 仍沒有 dependencies、devDependencies（後端分支照原本規則）—— 與前端合併後以「4-f1 的 F1.7」那一節為準，改成套件只在白名單。〔測試工程師〕新加的三支測試第一行寫到 4-b9 或 B9、不往 `homepage/site/` 外面讀；三支 fixture 第一行的註解寫到 4-b9。
   「只改 `lib/news.js`、`lib/bind-tail.js` 與對應 README」沒有寫成測試，由檢查員看 diff。

**放回錯誤驗證**（2026-10-02，測試工程師在暫存複本寫了最小參考實作 —— 整套全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 公告內文又接成一行（joinSentences） | B9.1 三語、readContent、行頭尾空白、不再接成一行；news.test.js 改過的六條：「zh 第 1 筆（1.0.5 上架了）」body 不同 |
| 英文不綁（只跳脫） | B9.2 十條以上、B2.2 英文、B2.3 `<script>`：「一般句子：bindTail("Save the page.", 'en')」 |
| 連續空白行沒壓成一個 | B9.1 三語、readContent、只有空白的行：第 1 筆 body 不同 |
| 空白行也只給 `\n`（段落不分） | B9.1 三語、readContent、只有空白的行、不再接成一行 |
| 行尾空白沒去掉 | B9.1 每行去掉頭尾空白 |
| 註解、連結那幾行也算空白行 | B9.1 三語「第 3 筆（連結夾在中間）」；修補9、二修2、三修H |
| 英文只綁最後一個字 | B9.2 一般句子、結尾空白、字的定義、網址、跳脫、多行 |
| 英文跨行借字 | B9.2 多行：「最後一行只有一個字：bindTail("A long first line.\nOK", 'en')」 |
| tail 放到 span 外面 | B9.4 三語、很短、多行、不跳脫五條：「一般句子：bindTail("請按存這頁。", 'zh', { tail: … })」 |
| tail 被跳脫 | B9.4 同上五條 |
| 社群代號不檢查（不警告） | B9.5 缺名稱、只缺某一語、某一語的檔壞了、命令三條：「The input did not match /警告/」 |
| 只檢查中文字串表 | B9.5 三語都缺：「mastodon：要講到缺 en.json」；只缺某一語 |
| 缺名稱算成要修的（擋部署） | B9.5：「警告不算錯：ok 還是 true」；命令：結束碼要是 0 |
| 字串表資料夾不在就丟例外 | B9.5 資料夾不在、命令 --strings 不存在：「結束碼要是 0，得到 1」 |

## 已知限制（4-b9，沒有測試）

- 更新紀錄（`lib/changelog.js`）沒動：一條 item 是一行（「- 」開頭），沒有多行的問題；它的英文孤字綁定在前端呼叫 `bindTail` 時自動跟著改。
- 箭頭圖示由呼叫端用 `tail` 傳進來（B9.4）；`bindTail` 不檢查 tail 的內容，安全靠「只傳自己寫的固定片段」這條約定。
- 「字」只認空白切：日文、中文混在英文頁裡不另外處理（整段照空白切）；不換行空白 NBSP（U+00A0）也算空白（JS 的 `\s`），沒量。
- 〔派工 4-b9 定〕一則公告中間只有註解的行（`<!-- … -->` 單獨一行）不算空白行、不造成分段；註解**裡面**夾著空白行時（跨好幾行的註解）不處理（沒量、沒規定）。
- 〔派工 4-b9 定〕行首的空白跟著去掉（沿用既有讀法）。
- 內文本身的 Markdown（`**粗體**`、清單）不轉，照字顯示（跟以前一樣）。
- `content/news.*.md` 檔頭說明寫「內文一兩句」，沒提到換行會照樣顯示；派工人員之後另外補一句（內容檔不在這段能改的檔裡）。
- B9.5 只比代號在不在字串表；字串表有、links.md 沒有的 `social.*`（多出來的名稱）不警告。圖示檔（`icons/<代號>.svg`）在不在不查。
- 測試檔裡的 BOM、全形空白、ZWJ 一律寫成 `\uXXXX` 跳脫（寫完用程式掃過）；👍🏽 是看得見的字。
- 已處理（2026-10-02 與前端合併時）：`structure-b9.test.js` 的「沒有任何套件」原本用 `assert.equal(pkg.dependencies, undefined)`、`assert.equal(pkg.devDependencies, undefined)` 寫死，前端加了 next、react、react-dom 之後會變紅；已改成跟 `structure-b2`～`b7` 一樣叫 `helpers.js` 的 `assertPackageWhitelist`（見下一節「4-f1 的 F1.7」）。

## 介面細則（4-b10：中文詞界 `<wbr>`、更新紀錄原句 `raw`、英文綁字上限）

測試案例是派工人員 2026-10-02 給的（B10.1～B10.4，下面標〔派工〕）；細節是測試工程師在測試裡定的（標〔測試工程師〕），後端照這一節實作。編號另起。
理由〔派工〕：中文、日文使用者自己寫的內容（公告、更新紀錄）在一般寬度會把詞拆開（「暫｜時不能用」「修｜正」「不｜再」）。產生網頁時用 `Intl.Segmenter` 在詞界插 `<wbr>`，
**前端對中文使用者內容的區塊另設 `word-break: keep-all`**（只在 `<wbr>`、空白、標點處斷），並加 `overflow-wrap: anywhere`（放在 flex 子項裡 `break-word` 兜不住，要用 `anywhere` 或子項加 `min-width: 0`）。
〔派工 4-b10 改〕**只對中文（zh）插，日文不插**：檢查員用真的日文內容在 Chromium 窄寬度比過，日文插了反而把動詞活用切碎、把 `auto-phrase` 擋下的位置又打開
（「一時的に使え｜ません」「影響ありま｜せん」；一行只剩 2 字以下的短行，插：13／8／14／11／12，不插：4／0／5／2／1）；中文插是確實改善（詞被拆開 0 次，不插 1～4 次，語料加大 24～55 次）。
日文靠 CSS 的 `word-break: auto-phrase`（元素要有 `lang="ja"` 才生效）。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B10"                 只跑 4-b10 新加的
npm test -- --test-name-pattern "B10.1|B2\.|B9\."     詞界與改過的舊條目
```

檔案：`bind-tail-wbr.test.js`（B10.1）、`changelog-raw.test.js`（B10.2）、`structure-b10.test.js`（B10.3）、`bind-tail-cap.test.js`（B10.4）。
**改過的舊條目**〔派工 4-b10〕：
- `bind-tail.test.js` 的 `expectBind`、`bind-tail-icon.test.js` 的 `withTail`、`bind-tail-en.test.js` 的「中文、日文照舊」：**中文**比之前先拿掉 `<wbr>`（期待值是「不插詞界時的輸出」，正好就是 B10.1「拿掉 `<wbr>` 後逐字相同」）；
  日文、英文照原樣比 —— 日文要是插了 `<wbr>`，這幾支的日文條目會紅。
- `changelog.test.js` 的 `parse()`：先確認每一條好的條目都有字串的 `raw`，再把它拿掉，其他期待值不用改（`raw` 的內容由 `changelog-raw.test.js` 量）。
- 英文上限（B10.4）改到的：`bind-tail-en.test.js` 的 `state-of-the-art tool`（21 個字元 → 只綁 `tool`）、長網址（不綁）、字面的 nw 標記（21 → 只綁 `y`）、二十萬字的單字（不綁），
  `checkSafe` 改成「最後一個字超過 20 個字元是 0 組 span」；`bind-tail.test.js` 的 `<script>alert(1)</script>`（25 個字元，不綁）。

**中文詞界 `<wbr>`（B10.1，`bindTail(text, 'zh', …)`；日文不插）**

1. 〔派工〕中文用 `new Intl.Segmenter('zh-Hant', { granularity: 'word' })` 切詞，在詞界插 `<wbr>`。
   〔派工 4-b10 改〕**日文（ja）不插**：輸出沒有 `<wbr>`，跟 4-b9 版逐字相同（最後三字綁住、`tail`、跳脫、多行；`bind-tail-wbr.test.js` 的 `JA` 與「日文不插」那一條）。英文也不插。
   〔測試工程師〕插的條件：**同一行裡相鄰的兩段都是詞（`isWordLike`）**。所以：標點、空白的前後都不插（句號、逗號、頓號、括號、引號、冒號…）；不連續兩個；不在字串與每一行的開頭、結尾；
   不在綁住的 `<span class="nw">` 裡面 —— 詞界剛好在 span 開頭那一處要插，`<wbr>` 在 span 前面（`暫時<wbr><span class="nw">不能用</span>`）。英文不插。
   〔派工 4-b10 定〕**短引號裡不插**：同一行裡 `「…」`、`『…』`、`“…”`（開引號往後找最近的同一種關引號）裡面 **12 個字以內**（以碼位算，不算引號本身）整段不插；
   13 個字以上照詞界插；引號外面照插；沒關起來的引號不算。例：`「存這則」「存這頁」暫時<wbr><span class="nw">不能用</span>`。
2. 〔派工 4-b10 定〕期待值**不寫死某一版 ICU 的切法**：測試用同一個環境的 `Intl.Segmenter` 切詞、套上面的規則推出期待的輸出（`bind-tail-wbr.test.js` 的 `expected()`），整批句子逐字比。
   另外寫死幾條具體字例（`STABLE`），只挑 2026-10-02 用 Node 21.6.2（ICU 74.1）與 Node 22.17.0（ICU 77.1）各跑一次、切法一模一樣的句子；
   換了 ICU 切法變了，那幾條先紅在「測試自己的防呆」那一步（講明是切法不同），不會被誤認成程式壞了。
3. 拿掉所有 `<wbr>` 之後，跟不插詞界時（4-b2 的規則：最後三個字位、跳脫）逐字相同；最後三字綁住、`tail`（4-b9 第 10～12 條）都不變。
4. 跳脫照舊、只跳一次（`&amp;` 不會變 `&amp;amp;`），`<wbr>` 不會插進實體中間（先切、再跳脫）。
5. 多行：每一行各自切，`\n`、`\r\n`、空白行原樣；`<wbr>` 不貼著換行。
6. 二十萬字（單行、多行各一次）2 秒內。〔測試工程師〕給後端的提醒（量到的，不是測試）：舊版 Node 的 `Intl.Segmenter` 切一整段很長的字是二次方的時間 ——
   Node 21.6 切二十萬字 grapheme 約 11 秒、word 約 7 秒，切成一句一句只要 0.1～0.3 秒；Node 22 一整段也只要 0.07 秒。所以要在 Windows 那台（Node 20）也過，
   找最後三個字位只切最後一小段（參考實作切最後 64 個 UTF-16 單位），詞界照「不含標點與空白的一串」分開切（標點、空白前後本來就不插，分開切結果一樣）。
   參考實作這樣寫在 Node 21 與 22 都 2 秒內；一整行二十萬字都沒有標點與空白的情況在舊版 Node 還是會慢（沒量）。
7. 〔測試工程師〕沒有 `Intl.Segmenter` 的環境（測試在子程序裡把 `Intl.Segmenter` 設成 `undefined` 再載入）：**載得進來**（不在載入時建 Segmenter）、英文照常、
   中日文丟 Error，訊息是中文、寫到 `Intl.Segmenter`（不是 `is not a constructor` 這種原始錯誤）—— 日文不插詞界，但找最後三個字位還是要 Segmenter。
8. 〔測試工程師〕`lib/bind-tail.js` 的 JSDoc 寫到 `<wbr>`、`Intl.Segmenter`、`keep-all`；〔派工 4-b10 定〕網站的 `README.md`「公告的換行與孤字綁定」那一節（## 標題寫到「孤字綁定」，給前端看）要寫到：「只對中文」「日文不插」「auto-phrase」「lang」、`keep-all`、`Intl.Segmenter`、`overflow-wrap`。

**更新紀錄原句 `raw`（B10.2，`lib/changelog.js`）**

9. 〔派工〕好的條目剛好 `{ ok: true, kind, text, raw }`：`raw` ＝ 那一行去掉開頭的「-」與頭尾空白（冒號、冒號兩邊的空白、kind 都留著；註解照舊拿掉）。
   例：`- 拿掉：選取文字後浮出的按鈕` → `raw: '拿掉：選取文字後浮出的按鈕'`；`- 修好` → `kind: '', text: '修好', raw: '修好'`；`- Fixed : spaced colon` → `raw: 'Fixed : spaced colon'`。
   前端在 `kind` 不是已知的類型詞時（「拿掉」「Removed」…），用 `raw` 把冒號接回去、整句當內文。
10. 其他欄位與壞紀錄照舊。**名字撞到的地方**：壞紀錄本來就有 `raw`（原檔那一行，含「- 」），好條目的 `raw` 是去掉「- 」的原句，兩者意思不同。
    CRLF＋BOM 一樣；三語各一組；走 `readContent` 那條路，每一條好條目的 `raw` 都是內容檔裡那一行去掉「- 」。`lib/changelog.js` 的 JSDoc 寫到 `raw`。

**英文最後兩個字的上限（B10.4）**

11. 〔測試工程師〕常數 `const EN_TAIL_MAX_CHARS = 20;`（`lib/bind-tail.js`，JSDoc 寫到它與 20）。字元以 **Unicode 碼位**算（`👍🏽` 是 2 個）。
    最後兩個字（含中間的空白）合計 ≤ 20 → 照舊兩個字一起包；> 20 → 只包最後一個字；最後一個字本身 > 20 → **不包**（沒有 span）。邊界量 20／21。只看最後一個非空行。
    不包時 `tail` 接在最後一個字後面、結尾空白前面（不包 span）。中文、日文不受影響。

**結構（B10.3）**

12. 〔派工〕`package.json` 的套件只在白名單（原本寫「沒有 dependencies、devDependencies」，前端加了 next、react、react-dom 之後改用 `helpers.js` 的 `assertPackageWhitelist`，跟 4-b7、4-b9 同一種改法）。新加的測試第一行寫到 4-b10 或 B10、不往 `homepage/site/` 外面讀。
    「只改 `lib/bind-tail.js`、`lib/changelog.js` 與 README」沒有寫成測試，由檢查員看 diff。

**放回錯誤驗證**（2026-10-02，測試工程師在暫存複本寫了最小參考實作 —— 整套全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| `<wbr>` 插在標點、空白前（只看前一段是詞） | B10.1 確切位置：「空白前後不插：bindTail("修正跟 1.0.5 一起出", 'zh')」；性質、多行、跳脫、tail |
| `<wbr>` 插進 nw 裡面 | B10.1 確切位置、性質；B9.2、B9.4 中文 |
| 詞界那幾段不跳脫 | B10.1 性質：「拿掉 <wbr> 之後要跟不插詞界時一模一樣」；跳脫只一次；B2.3 |
| 短引號不排除（引號裡也插） | B10.1 期待值、寫死的字例：「bindTail("ChatGPT 改版：「存這則」「存這頁」暫時不能用", 'zh')」；短引號 |
| 短引號上限差一（13 字也不插） | B10.1 期待值、短引號：「bindTail("請先「到擴充功能頁面重新整理一次」再試", 'zh')」 |
| 短引號連引號本身一起算 | B10.1 期待值、短引號：「bindTail("請「擴充功能頁面重新整理一次」再試", 'zh')」 |
| 日文也插（日文用 ja 的 Segmenter 切） | B10.1 日文不插、期待值；B2.2 日文、B2.3 多行、B9.2 中文日文照舊、B9.4 日文（2026-10-02 在後端實作的複本上做） |
| 網站 README 拿掉「auto-phrase」或「overflow-wrap」 | B10.3 網站 README：「README.md 那一節要寫到「auto-phrase」」 |
| 完全不插 `<wbr>` | B10.1 確切位置：「bindTail("暫時不能用", 'zh')」；性質的防呆、多行、tail、很長的字 |
| 載入時就建 Segmenter | B10.1 沒有 Intl.Segmenter：「沒有 Intl.Segmenter 也要載得進來…得到：Intl.Segmenter is not a constructor」 |
| 好條目沒有 `raw` | B10.2 五條；changelog.test.js 的 parse()：「好的條目剛好 ok、kind、text、raw」 |
| `raw` 留著「- 」 | B10.2 五條 |
| 英文沒有長度上限 | B10.4：「21：只包最後一個字：bindTail("Then aaaaaaaaaa bbbbbbbbbb", 'en')」 |
| 上限差一（≥ 20 就不綁） | B10.4：「剛好 20（含中間的空白）」；最後一個字 20；碼位 |

## 已知限制（4-b10，沒有測試）

- Segmenter 的切法跟著 ICU 版本走：整批比對用同一個環境推的期待值，不受影響；寫死的字例只在 ICU 74.1 與 77.1 比過，Windows 那台的 Node 20.14（ICU 更舊）沒跑過。
- 「確切位置」的期待值是測試照同樣的規則推的（`expected()`），所以規則本身寫錯會兩邊一起錯；寫死的字例與短引號那幾條是另外一道。
- 短引號只認同一行裡、同一種引號的一對；巢狀的「『』」各自算；`"…"`（直引號）不算引號。
- 中文頁面裡的英文單字之間不插（空白本來就能斷）；英文頁面整段不插。
- 前端的 `word-break: keep-all`、`overflow-wrap: anywhere`、日文的 `auto-phrase` 與 `lang="ja"` 不在這裡量（後端只產 HTML）；`keep-all` 時一個詞比一行還長由 `overflow-wrap` 兜底，那一下會把詞拆開。
- 舊版 Node 的極端情況（檢查員量的）：一行二十萬字、**沒有標點也沒有空白**，Node 21 中文 7.8 秒、日文 4.6 秒；Node 22 約 0.1 秒（部署用 Node 22）。測試的二十萬字有標點，量不到這種。
- `GRAPHEME_WINDOW = 64`（找最後三個字位只切最後 64 個 UTF-16 單位）：極端的組合字（一個字後面接 100 個組合符號）會被切開。只記一筆，沒有測試。
- `EN_TAIL_MAX_CHARS` 是以碼位算，不是以畫面寬度算（`W` 與 `i` 一樣算 1）；280 寬實際會不會撐出橫捲由設計審查量。
- 測試檔裡的 ZWJ、全形空白、BOM 一律寫成 `\uXXXX` 跳脫；👍🏽 是看得見的字。

## 介面細則（4-b11：日文、英文的短引號不在引號裡斷行）

測試案例是派工人員 2026-10-03 給的（B11.1～B11.4，下面標〔派工〕）；細節是測試工程師在測試裡定的（標〔測試工程師〕），後端照這一節實作。編號另起。
理由〔派工〕：設計審查第三輪量到，日文、英文的公告與更新紀錄會在短引號裡斷行（「「これを／保存」」「「ページを／保存」」「“Save／page”」）。4-b10 之後日文、英文只靠 `auto-phrase` 與空白斷行，
引號裡照樣會斷；中文已經用「短引號裡不插 `<wbr>`」加 `keep-all` 守住，日文、英文也要同樣的保證。
**不做**〔派工〕：數字＋量詞（「N 枚」）、產品名的綁定，中文行為的任何改動。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B11"                 只跑 4-b11
npm test -- --test-name-pattern "B11.1|B11.2"         只跑 bindTail 的短引號
```

檔案：`bind-tail-quote.test.js`（B11.1、B11.2）、`structure-b11.test.js`（B11.3、B11.4）。

**日文、英文的短引號（B11.1，`bindTail(text, 'ja'|'en', …)`）**

1. 〔派工〕同一行裡成對的短引號 —— `「…」`、`『…』`、`“…”` —— 連引號本身整個包成 `<span class="nw">「…」</span>`；沒關起來的不包。
   **各語言自己的門檻與上限**〔派工 4-b11 改，檢查員量的〕：
   - **日文：引號裡 8 個碼位以內才包**（不算引號本身），9 個以上不包；**整個 nw span 最多 10 個碼位**（含引號本身與往前延伸的部分）。
   - **英文：引號裡 12 個碼位以內才包**，13 個以上不包；整個 nw span 最多 20 個碼位（`EN_TAIL_MAX_CHARS`，4-b10）。
   - 中文：不包（完全不變）。
   為什麼日文比較小：日文 12 字的引號連引號是 14 個全形字，18px 的標題約 250px 寬，包成不換行之後在窄手機 280 寬會撐破版面 ——
   檢查員在設計稿上量到：12 字引號放在公告標題（`.news__title`）、280 寬，超出內容框 65px、整頁橫向捲動 18px；放在更新紀錄（`.item__text`）、280 寬，整頁橫向捲動 3px；
   8 字以下，四種容器在 280 寬都是 0。英文的 20 碼位上限本來就是為了 280 寬不撐出橫捲（4-b10）。
   〔測試工程師〕配對跟 4-b10 中文的短引號一樣：開引號往後找**同一行**最近的同一種關引號（關引號在前、開引號在後不算一對；不跨行配對）。
2. 〔測試工程師〕巢狀與重疊：由前到後挑，跟已經挑到的那一對重疊的就不挑 —— 所以巢狀只包最外面那一對（`「『保存』を押す」` 整個一個 span，裡面的『』不另外包）；
   外面那一對太長（不是短引號）時，裡面的短引號照包。span 不巢狀。
3. 〔派工〕已經在最後幾個字的綁定範圍裡的不重複包。〔測試工程師〕細節：
   - 整對都在綁定範圍裡（`ボタン「A」`、`Click “Save page”`）→ 只有綁定那一個 span。
   - 部分重疊（綁定範圍從引號中間開始，例：日文 `ボタン「これを保存」` 的最後三字是「保存」」）→ **綁定範圍往前延伸到開引號**（`ボタン<span class="nw">「これを保存」</span>`）。
   - 延伸後超過那個語言的上限（日文 10、英文 20 個碼位）→ 不延伸，綁定範圍照原本的規則，那一對也不包。
     日文：`押す「あいうえおか」です` 延伸後剛好 10 → `押す<span class="nw">「あいうえおか」です</span>`；`押す「あいうえおかき」です` 延伸後 11 → `押す「あいうえおかき<span class="nw">」です</span>`。
     英文：`Open “abcde <span class="nw">fghijk” zzzzzz</span>`（延伸後 21；少見，見已知限制）。
   - 英文最後一個字超過 20 不綁時（4-b10），前面的短引號照包。
4. 拿掉 span、還原跳脫之後跟輸入逐字相同。〔派工〕**中文不變**：不包短引號、照舊插 `<wbr>`、引號跟最後三字重疊也不延伸。

**不誤傷（B11.2）**

5. 〔派工〕引號裡有 `& < > " '` 照樣跳脫（包在 span 裡）；`tail` 照舊在最後那個 span 的裡面、結尾（延伸過的也一樣）；換行原樣、span 不跨行、前面幾行的短引號照包；
   空字串、只有空白、一整行只有一對引號、巢狀、同一種引號連開兩次（`「a「b」c」`、`「「「」」」`、`”“`）都不丟例外。
6. 〔派工〕各語言的 span 上限不被破壞：〔測試工程師〕日文輸出裡每一個 span 的字（還原跳脫、不算 tail）都在 10 個碼位以內、英文在 20 個以內
   （所有 B11 的日文、英文案例都量；另外一條專門量日文：8／9 字的引號、延伸 10／11、巢狀、外面那對太長）。
7. 〔派工〕二十萬字 2 秒內（Node 22）：日文、英文各一段，加一段十萬個「「」接十萬個「」」（配對最壞的情況）。

**文件（B11.3）**

8. 〔派工〕不認得的類型詞的舉例：`lib/changelog.js` 檔頭與網站 `README.md` 講 `raw` 的那一段，講「不認得／不是已知」的那幾句要舉真的不認得的詞。
   〔測試工程師〕那幾句要寫到「雜項」「Misc」，不能出現「拿掉」「Removed」（那兩個在已知類型詞清單裡）。
   已知類型詞清單以設計稿 `strings/README.md`「更新紀錄的類型標記」為準：中文 12 個（修好、修正、新增、改善、改進、調整、變更、拿掉、移除、更新、安全性、效能）、
   英文 10 個（Fixed、Fix、New、Added、Improved、Changed、Removed、Updated、Security、Performance）；測試把清單抄在 `KNOWN`，量個數。
   網站的 `strings/README.md` 有那一節時（下次 `npm run strings` 帶進來之後），另外比對清單裡每個詞都在。
9. 〔派工〕`lib/bind-tail.js` 檔頭與網站 `README.md`「孤字綁定」那一節補日文、英文短引號的規則。〔測試工程師〕要有一句同時寫到「短引號」「日文」「英文」與 `nw`。

**結構（B11.4）**

10. 〔派工〕`npm test` 全綠；`package.json` 的套件只在白名單。〔測試工程師〕`helpers.js` 有 `assertPackageWhitelist`（前端分支合併之後）就用它，沒有（後端分支）就是不准有 dependencies、devDependencies。
    新加的測試第一行寫到 4-b11 或 B11、不往 `homepage/site/` 外面讀。

**改過的舊條目**〔派工 4-b11〕：日文、英文包了短引號是這次決定要改的行為，下面這幾條原本把「日文、英文只有最後那一個 span」或「日文輸出等於 4-b9 版」寫死了，
期待值改成新行為的**確切輸出**（不是拿掉短引號的 span 再比），其他斷言沒動：

| 檔、條 | 改了什麼 | 為什麼 |
|---|---|---|
| `bind-tail.test.js` B2.2 日文「引號後面」（`「保存」を押す`） | 期待值改成 `<span class="nw">「保存」</span><span class="nw">を押す</span>`；`expectBind`／`checkSafe` 多一個選填的 span 組數，只有這一條給 2 | 〔派工 4-b11〕短引號連引號包成 nw |
| `bind-tail-icon.test.js` B9.4「svg 片段」（`“Save this” is back after the ChatGPT redesign`） | 期待值的 `“Save this”` 包成 nw | 〔派工 4-b11〕英文短引號 |
| `bind-tail-wbr.test.js` `JA` 的公告條標題 | 期待值的 `「これを保存」「ページを保存」` 各包一個 nw | 〔派工 4-b11〕日文短引號 |
| `bind-tail-wbr.test.js` 的 `expected()`、B10.1 期待值的防呆、B10.1 性質、B10.1 日文不插 | 日文的「不插詞界時的輸出」從 `plain()` 改成新的 `base()`：`plain()` 再加上短引號的 nw（規則同第 1～3 條：日文 8 個碼位、延伸上限 10；中文照舊是 `plain()`） | 〔派工 4-b11〕日文的基準輸出變了 |
| `news-lines.test.js` B9.1「交給 bindTail」 | 日文內文的 span 組數從 1 改成 3（「これを保存」「更新」兩對短引號＋最後三字），中文、英文照舊 1 | 〔派工 4-b11〕日文短引號 |

這幾條在後端照 4-b11 實作之前也是紅的（2026-10-03 在工作資料夾跑：B11 新加的 13 條加這 6 條，共 19 條紅）；參考實作上整套全綠。

〔派工 4-b11〕後端分支的 `strings/README.md` 是舊版、沒有類型詞清單 —— 這是對的，**不要同步**（字串表與設計稿由前端分支負責，兩邊同時改會讓兩個 MR 衝突）；
B11.3 的清單比對那條照現在的設計：沒有清單那一節就只量文件，有就逐詞比對。

**放回錯誤驗證**（2026-10-03，測試工程師在暫存複本寫了參考實作 —— 新加的全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 日文、英文不包短引號 | B11.1 四條、B11.2 跳脫、tail、換行、巢狀、上限：「兩對短引號各包一個：bindTail("ChatGPT のデザイン変更で…", 'ja')」 |
| 上限差一（13 碼位也包，2026-10-03 第一版規則時做的） | B11.1 12／13 |
| 連引號本身一起算 | B11.1：「『』8 個碼位」 |
| 日文也用 12 的門檻（〔派工 4-b11 改〕之後） | B11.1：「日文 9：不包」；B11.2 日文 span 上限：「得到「『あいうえおかきくけ』」」；二十萬字（span 超過 10） |
| 日文延伸不看 10 的上限 | B11.1 日文延伸上限：「延伸後 11：不延伸、那一對也不包：bindTail("押す「あいうえおかき」です", 'ja')」；B11.2 日文 span 上限 |
| 日文延伸上限差一（10 就不延伸） | B11.1 日文延伸上限：「延伸後剛好 10：延伸」；B11.2 跳脫（「<b>&保存」です 剛好 10） |
| 跟綁定範圍重疊也照包（不延伸） | B11.1 不重複包：「一整行只有一對引號」；B11.2 跳脫、tail |
| 英文延伸不看 20 上限 | B11.1：「延伸後 21 個碼位超過上限」；B11.2 上限 |
| 引號跨行配對 | B11.2 換行：「開引號與關引號在不同行：不算一對」 |
| 引號裡不跳脫 | B11.2 跳脫：「日文：引號裡五種字元」 |
| 中文也包短引號 | B11.1 中文不變 |
| 巢狀也各自包 | B11.2 巢狀：「只包最外面那一對」；二十萬字（span 巢狀） |
| changelog.js 檔頭又拿「拿掉」當例子 | B11.3 changelog.js 檔頭 |
| README 拿掉日文英文短引號那句 | B11.3 README「孤字綁定」 |

## 已知限制（4-b11，沒有測試）

- 延伸後超過上限（日文 10、英文 20）時那一對不包，引號裡還是可能斷（日文：引號在最後、後面只接一兩個字才會遇到；英文：短引號 12 碼位左右、後面再接一個長字）。
- 日文 9 個碼位以上的引號照舊可能在引號裡斷（`auto-phrase` 決定）；這是為了 280 寬不撐破版面刻意放掉的。
- 只認 `「」『』“”`；`"…"`（直引號）、`'…'`、`‘…’`、`（…）`、`【…】` 不算。
- 數字＋量詞（「N 枚」）、產品名不綁（〔派工〕不做）。
- 寬度是檢查員在設計稿量的（上面第 1 條的數字），後端測試只量碼位數，不量畫面寬度；日文 10 個碼位裡有半形英數字時實際更窄。

## 介面細則（4-b8：07 區「AI 開始打字」的資料轉換 `npm run agent-data`）

測試案例是派工人員 2026-10-03 給的（B8.1 轉換、B8.2 邊界，下面標〔派工〕）；B8.3（來源當資料讀、不執行）是派工人員要測試工程師定成介面的。
命令的參數、輸出格式、錯誤碼、讀法是測試工程師定的（標〔測試工程師〕），後端照這一節實作。編號另起，跟 4-b7、4-b9～4-b11 的不相干。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B8"                       只跑 4-b8
SITE_REAL_TUTORIAL=<tutorial 資料夾> npm test -- --test-name-pattern "B8.1 真的資料"   用真的 agent-*.js 跑（沒設就 skip）
```

檔案：`agent-data-cli.test.js`（命令：B8.1、B8.2、B8.3、B8.4）、`agent-parse.test.js`（`lib/agent.js`）、`agent-real.test.js`（提交進來的 `data/agent.*.json`、真的資料）、`structure-b8.test.js`（結構）；
`agent-fixture.js` 是共用的小工具（不是測試）；`fixtures/agent-tutorial/agent-{zh,en,ja}.js` 是形狀照真的來源縮小的 fixture（註解＋`window.AGENT = { JSON };`，
zh 那支的 outline 夾著換行、Tab、全形空白、不換行空白、emoji、𠮷、引號、反斜線、`</script>`、字串裡的 `//` 與 `/* */`，註解裡寫著 `window.AGENT = { … }`）。

**來源**（2026-10-03 看過真的檔）：`tutorial/agent-{zh,en,ja}.js` 是瀏覽器全域指派，不是模組 —— 開頭一段註解，然後 `window.AGENT = { … };`，等號右邊是合法的 JSON。
欄位剛好六個：`model`、`prompt`、`steps`（`[[工具, 參數], …]`，zh 11 步、en 與 ja 各 10 步）、`outline`、`reply`、`say`，都是非空字串（steps 每一步是兩個非空字串）。

**`lib/agent.js` 的 `parseAgentSource(text)`**〔測試工程師〕

1. 把來源**當資料讀、不執行**（B8.3）：開頭只能有空白與註解（`/* … */`、`// …`），接著 `window.AGENT =`，等號右邊用 `JSON.parse` 讀，後面只能有分號、空白與註解。
   不准用 `eval`、`Function`、`node:vm`、動態 `import()`、`require`（`structure-b8.test.js` 掃 `lib/agent.js` 與 `scripts/agent-data.mjs`）。
   測試自己讀來源時才用 `vm` 空沙盒（`agent-fixture.js` 的 `oracle()`，只讀可信的 fixture 與真的來源），兩邊讀法不同，互相對照。
2. 回傳 `{ model, prompt, steps, outline, reply, say }`，**欄位就這個順序**；值跟來源一模一樣；每次給新的物件。
3. 丟 `Error`（不是 `TypeError`，訊息是中文）：找不到 `window.AGENT`（講「window.AGENT」）、等號右邊不是 JSON（講「JSON」）、不是物件、缺欄位或多一個欄位（講那個欄位名，多欄位當作來源改版）、
   型別錯或空字串（講欄位名）、steps 不是陣列或是空的（講「steps」）、某一步不是兩個非空字串（講「steps」與「第 N 步」，N 從 1 算）。`text` 不是字串丟 `TypeError`。

**命令 `scripts/agent-data.mjs`**

4. 〔派工〕`npm run agent-data -- --from <tutorial 資料夾>`；〔測試工程師〕另外可以給 `--out <資料夾>`（預設是這支檔往上一層的 `data/`，也就是 `homepage/site/data/`）。`--from` 必填、沒有預設。
   `package.json` 的 `scripts["agent-data"]` ＝ `node scripts/agent-data.mjs`。
5. 〔派工〕讀 `<from>/agent-zh.js`、`agent-en.js`、`agent-ja.js`，寫 `<out>/agent.zh.json`、`agent.en.json`、`agent.ja.json`。
   〔測試工程師〕每個檔剛好是 `JSON.stringify({ model, prompt, steps, outline, reply, say }, null, 2) + '\n'`（兩格縮排、換行結尾、欄位照這個順序）；字不改（換行、Tab、全形空白、不換行空白、emoji…）。
   `--out` 不存在就建；舊的三個檔換新，`--out` 裡別的檔（`chapters.*.json`）不動、不留暫存檔；重跑（同一個 `--out`、另一個 `--out`、從別的資料夾叫）位元組相同。
6. 結束碼：0 成功、1 來源或驗證問題、2 用法錯誤（照 4-b7 `strings.mjs` 的慣例）。
   - 用法錯誤：沒給 `--from`、`--from=`／`--out=` 空字串、`--from` 缺值、不認得的參數、多出來的位置參數、`--from` 不存在或不是資料夾 → 結束碼 2、stderr 第一行中文（不是 Node 的英文）、不建 `--out`、叫它的資料夾還是空的。
   - 來源問題：缺某一語的檔、是資料夾、空的、只有註解，以及第 3 條的每一種 → 結束碼 1、stderr 第一行中文、寫出那支檔名（`agent-ja.js`）與原因、沒有堆疊。
7. 〔派工〕不寫半套：任何一種失敗，`--out` 一個位元組都不動（原本不存在就還是不存在、舊檔維持原樣）；`--out` 裡 `agent.ja.json` 的位置是資料夾 → 在寫任何檔之前就發現（結束碼 1、寫出那個名字）。
8. 〔派工〕來源裡塞程式不會被執行（B8.3）：`process.exit(0)`、`require('fs')` 寫檔、`while (true) {}`、改 `globalThis.JSON`、等號右邊是函式呼叫、`window.AGENT` 後面還有程式、JSON 裡塞函式呼叫
   → 結束碼 1、**5 秒內**、stderr 寫出 `agent-zh.js` 與原因（講到 window.AGENT、JSON 或「資料」）、不建 `--out`、來源想寫的檔也不存在。
9. 〔派工〕不改 `tutorial/`：跑完 `--from` 一個位元組都不變（真的資料那條另外比每個檔的 sha256）；給了 `--out`，`homepage/site/` 底下每個檔的大小與修改時間都不變。

**提交進來的 `data/agent.*.json` 與真的資料**

10. 〔測試工程師〕`homepage/site/data/agent.{zh,en,ja}.json` 要提交（後端用真的 tutorial 資料夾跑 `npm run agent-data` 產出）：三個都在、欄位照順序、型別對、格式就是第 5 條那樣。
11. 設了 `SITE_REAL_TUTORIAL` 才跑真的資料（沒設就 skip 並寫原因，跟 4-b2、4-b6 一樣；設了但那裡缺三支 agent-*.js 之一 → 紅）：
    命令結束碼 0、三個輸出跟測試用 vm 沙盒讀的來源逐筆相同、`tutorial/` 每個檔的雜湊不變、提交進來的 `data/agent.*.json` 跟重算的位元組相同（不同就要重跑 `npm run agent-data`）。

**結構（B8.2）**

12. 〔派工〕`package.json` 的套件只在白名單（`helpers.js` 有 `assertPackageWhitelist` 就用它；後端分支沒有，就是不准有 dependencies、devDependencies）。
13. 〔測試工程師〕`lib/agent.js`：第一個 export 之前有 JSDoc（`@param`、`@returns`）、匯出 `parseAgentSource`、只 import `node:` 與 `./`。
    `scripts/agent-data.mjs`：只 import `node:` 與 `../lib/<檔>.js`、用 `parseAgentSource`、不自己定義；兩支都沒有寫死的外部路徑（`tutorial/`、`design/`、`/Users/`、`GPTPlugins`、`../..`…）；
    命令的檔頭註解寫到 `npm run agent-data`、`--from`、`--out`、`agent-{zh,en,ja}.js`、`data/`、重跑。
14. 〔派工〕網站 `README.md` 有一節（`## ` 標題寫到 `agent-data`）：寫到 `npm run agent-data`、`--from`、`agent-{zh,en,ja}.js`、`data/agent.`、教學片、重跑（教學片重算後要重跑）；
    那一節沒有開發流程的字眼（派工、後端、測試工程師、檢查員、目標檔、4-b8、B8）。

**放回錯誤驗證**（2026-10-03，測試工程師在暫存複本寫了參考實作 —— 設了真的資料整套全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 欄位對調（outline 與 reply 的值） | B8.1 成功：「agent.zh.json 要剛好是 JSON.stringify(…)」；字不改、解析、真的資料 |
| steps 少一步 | B8.1 成功、解析、真的資料：同上 |
| 輸出多一個欄位（`lang`） | B8.1 成功、真的資料：同上 |
| 用 `new Function` 執行來源 | B8.2 JSON 壞掉：「JSON 多一個逗號：結束碼要是 1，得到 0」；欄位、steps、B8.3 塞程式、解析、B8.3 結構 |
| 改 `tutorial/`（在 `--from` 留一個檔） | B8.1 成功：「--from 一個位元組都不變（不改 tutorial/）」；真的資料（雜湊） |
| 寫半套（驗證 en 之前先寫 zh） | B8.2 缺檔、JSON、欄位、steps、不寫半套：「缺 agent-ja.js：--out 一個位元組都不動」 |

**檢查員第 1 輪補的**（`agent-data-edge.test.js`；2026-10-03）

15. 〔派工〕**特殊換行後面藏的程式**：JavaScript 的行註解遇到 `\r`、U+2028、U+2029 也會結束，這三種字後面的字在瀏覽器裡是程式（檢查員用 vm 驗過）。
    第 1 條「開頭、後面只能有空白與註解」的「註解」照 JavaScript 的規則算：行註解到這四種換行（`\n`、`\r`、U+2028、U+2029）為止。
    三種換行 × 兩個位置（資料後面 `window.AGENT = {…};\n// c<換行>require('fs')…`、來源開頭 `// c<換行>process.exit(1)\nwindow.AGENT = …`）
    → 結束碼 1、stderr 第一行中文、講出 `agent-zh.js`、`--out` 一個位元組都不動、來源想寫的檔不存在。
    〔測試工程師〕不誤傷：整份 CRLF 行尾的來源（行註解以 `\r\n` 結束，後面是空白）照常轉，結果跟 LF 版位元組相同。測試檔裡的 U+2028、U+2029 寫成 `\u2028`、`\u2029`。
16. 〔派工〕**系統暫存資料夾寫不進去**（`TMPDIR` 指到唯讀資料夾或不存在的資料夾）：結束碼 1、stderr 講「系統暫存資料夾」「寫不進去」（可以附錯誤碼）、沒有堆疊、`--out` 不動。
    唯讀那一種在 Windows 與 root 下跳過。
17. 〔派工〕**來源太大或結構異常**：不能把「Maximum call stack size exceeded」這種原文印給人看。〔測試工程師〕觸發：開頭八百萬行行註解（約 40 MB）、結尾兩千萬個分號
    （2026-10-03 在這台量到：三百萬行、一千萬個就會撐爆正規表示式的堆疊，一百五十萬行、五百萬個不會；用兩倍的量求穩）。
    失敗的話結束碼 1、stderr 講「來源太大」或「結構異常」、沒有堆疊、`--out` 不動；實作改成不會撐爆、照常轉出來也算過（那就要轉得對）。5 秒內。
    （JSON 讀不了時括號裡附 `JSON.parse` 的英文原文可以接受，不在這條。）

| 放回的錯（檢查員第 1 輪） | 紅在哪一條、哪一步 |
|---|---|
| 行註解只認 `\n`（`[^\n]*`） | 第 15 條兩條：「資料後面 \r：結束碼要是 1，得到 0」「來源開頭 \r：結束碼要是 1，得到 0」 |
| 行註解認 `\n` 與 `\r`、漏了 U+2028、U+2029 | 第 15 條兩條（U+2028 那一個） |
| 暫存資料夾的錯誤照原文丟出 | 第 16 條：「要講「系統暫存資料夾」「寫不進去」，得到：…ENOENT…mkdtemp…」 |
| 撐爆堆疊的錯誤照原文印 | 第 17 條：「八百萬行行註解：不能把 JavaScript 的原文印給人看」 |

## 已知限制（4-b8，沒有測試）

- 預設的 `--out`（`homepage/site/data/`）沒量：一跑就寫進專案。
- 寫到一半才失敗（磁碟滿、沒有寫入權限）沒量；量的是「先全部讀完驗證、`--out` 裡同名的資料夾先發現，再寫」。
- 三支來源都壞時一次全部列出（stderr 第一行「來源有 N 個問題要修」，之後一個問題一行）；測試只量了一支壞的情況，沒量好幾支一起壞時每一支都列出。
- 來源的 JSON 裡有重複的鍵：`JSON.parse` 取後面那個，偵測不到。
- 撐爆堆疊的門檻跟著 Node 的堆疊大小走（第 17 條用兩倍的量求穩）；在堆疊比較大的環境，八百萬行可能不會撐爆，那時測試看的是「照常轉出來要轉得對」。
- 「不能執行」只量了行為（塞進去的程式沒有發生）與原始碼裡沒有 `eval`／`Function`／`vm`／`import()`／`require`；用別的方法執行（例如另開子程序跑來源）掃不到。

## 介面細則（4-b12：回退字型的產生器 `npm run fallback-fonts` 與係數掃描 `npm run fallback-sweep`）

測試案例是派工人員 2026-10-03 給的（B12.1 產生器、B12.2 係數掃描、B12.3 文件與靜態檢查、邊界，下面標〔派工〕）；介面細節是測試工程師定的（標〔測試工程師〕），後端照這一節實作。編號另起。
背景：前端的 `app/styles/fallback-fonts.css`（字型換上來前後版面不跳的回退字型）原本是用暫存資料夾裡的幾支程式產的，這一段把它們收進網站：
量字寬、分組、產 CSS 的那一支，與掃「微調係數」的那一支。凍結的參考輸出是 `tests/fixtures/fallback-fonts/golden.css`
（前端 2026-10-03 的 `app/styles/fallback-fonts.css` 原樣複製：基本組 231 個、微調組 193 個，共 424 個 `@font-face`）。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B12"                         只跑 4-b12（要瀏覽器的那幾條沒設 SITE_PLAYWRIGHT 會 skip）
SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "B12"   連要瀏覽器的一起跑
```

檔案：`fallback-fonts-lib.test.js`（純函式，必過）、`fallback-check.test.js`（靜態檢查，必過）、`fallback-fonts-cli.test.js`（產生器的命令）、`fallback-sweep.test.js`（係數掃描）、
`structure-b12.test.js`（結構）；`fallback-fixture.js` 是共用的小工具（不是測試），裡面有設定檔該有的 `ROLES`、`FACTORS` 與靜態檢查的例外清單 `MICRO_ALLOWANCE`。
**兩層**〔派工〕：不需要瀏覽器的（分組、夾、`unicode-range`、一行的寫法、微調組、整份 CSS、命令的錯誤處理）必過；要瀏覽器的設了 `SITE_PLAYWRIGHT` 才跑，沒設就 skip 並寫原因（跟 4-b6 一樣）。

**純函式 `lib/fallback-fonts.js`**〔測試工程師〕（不 import 任何東西以外的 `node:`／`./`，不碰瀏覽器）

1. `groupGlyphs(ratios, { tolerance = 0.02, min = 0.85, max = 1.2, exempt = [0x20] })`：`ratios` 是 `[[碼位, 比例], …]`（比例 ＝ Google Sans Flex 的字寬 ÷ Arial 的字寬）。
   不在 `exempt` 的比例先夾到 `[min, max]`；照比例由小到大排（一樣大照碼位）；**跟那一組第一個（最小的）字比**，`比例 ÷ 第一個 ≤ 1 + tolerance` 就收進去，否則開新的一組；
   `exempt` 的字（空白）各自一組、照碼位排在最後、不夾。每組 `{ codes（由小到大）, ratio（夾過的比例的幾何平均） }`。輸入順序打亂結果一樣。
2. `unicodeRange(codes)`：去重複、由小到大；連續的寫成 `U+3A-3B`（後半不加 `U+`），其他 `U+2C`；大寫十六進位、不補零；「, 」接起來。
3. `fontFaceRule({ family, weight, codes, sizeAdjust })`：一行，格式跟 golden.css 一樣 —— 字重 400／500／600 → `100 449`／`450 599`／`600 900`，600 的 `src` 是 Arial Bold 那一串；
   `size-adjust` 一位小數；`ascent-override`／`descent-override` ＝ 96.6／28.6 除以**沒四捨五入的** `sizeAdjust` 再乘 100，兩位小數；`line-gap-override: 0%`。
4. `scaleFaces(baseLines, { family, from, weight, k, spaceK = 1 })`：微調組。從基本組裡 family 是 `from`、字重是 `weight` 的那幾行（照原順序），換成 `family`，
   `size-adjust` ＝ 那一行寫的（一位小數的）值 × `k`（空白那一行再 × `spaceK`），兩位小數，ascent／descent 跟著它算。**golden.css 的基本組照 12 條係數乘出來，跟它的 193 行微調組逐字相同**（測試量了）。
   來源組不存在回空陣列（整份 CSS 那一層報錯）。
5. `renderFallbackCss({ roles, factors, measurements })`：整份 CSS。開頭一段註解（寫到 `npm run fallback-fonts`，**沒有日期與本機路徑**），
   基本組照 `roles` 的順序、每組照列的字重（`measurements` 是 `[{ family, weight, ratios }]`，family ＝ `"Google Sans Flex Fallback" + suffix`），每組 `groupGlyphs` → `fontFaceRule`；
   再照 `factors` 的順序接微調組（`scaleFaces`）；換行結尾。`measurements` 與 `ratios` 的順序打亂、重跑，位元組相同。少一組量測、係數指到不存在的組 → 丟 Error，講出是哪一組。
6. `charsFromFontsCss(css)`：`fonts.css` 裡 `"Google Sans Flex"` 那一個 `@font-face` 的 `unicode-range` 展開成碼位（由小到大）；沒有那個 `@font-face` 丟 Error。
   〔測試工程師〕**要收的字就是這些**（網頁字型負責的字；它本身是 4-b6 從三語文案收出來的），現在是 U+0020～007E 加 A6、A7、A9、AB、B7、BB、D7、2013、2014、2019、201C、201D、2026。

**設定檔 `scripts/fallback-fonts.config.json`**〔測試工程師〕：`{ "roles": [...], "factors": [...] }`，內容就是產生 golden.css 那一次的 ——
`roles` 每筆 `{ suffix, size, opsz（數字或 "auto"）, weights }`，8 組（`''` 14px opsz 18、`' 14'`、`' 16'`、`' 18'`、`' 24'`、`' 32'`、`' 48'`、`' 64'`，字重照 golden.css）；
`factors` 每筆 `{ family, from, weight, k, spaceK? }`，12 條（照 golden.css 檔尾的微調組）。測試逐筆比對（`fallback-fixture.js` 的 `ROLES`、`FACTORS`）。

**命令 `scripts/fallback-fonts.mjs`**（`npm run fallback-fonts`）

7. 〔測試工程師〕`npm run fallback-fonts -- [--fonts <字型資料夾>] [--config <設定檔>] [--out <輸出檔>] [--playwright <Playwright 套件的資料夾>]`。
   預設：`--fonts` ＝ `public/fonts/`（要有 `GoogleSansFlex-site.woff2` 與 `fonts.css`）、`--config` ＝ `scripts/fallback-fonts.config.json`、`--out` ＝ `app/styles/fallback-fonts.css`。
   **預設的 `--out` 在後端分支裡不存在**（`app/` 是前端合併之後才有）：這時結束碼 1、講到 `app/styles` 與要用 `--out`、**不建 `app/`**；`--out` 的資料夾不存在一律結束碼 1（不幫忙建）。
8. 〔派工〕量要用瀏覽器：**Playwright 不進 package.json**，從 `--playwright <資料夾>` 或環境變數 `SITE_PLAYWRIGHT`（跟網站測試同一個名字）給，用 `createRequire` 從那個路徑載入；
   兩個都沒有、或那個資料夾不是 Playwright（沒有 `package.json`）→ 結束碼 1、中文、講到 `SITE_PLAYWRIGHT`（指錯的話講「找不到 Playwright」與那個路徑）；瀏覽器開不起來 → 結束碼 1、講到「瀏覽器」。
   **先查輸入、再找 Playwright**（輸入缺檔又沒有 Playwright → 講缺的檔）。
9. 量法（跟 golden.css 檔頭寫的一樣）：Chromium 裡每個字重複 40 次、`font-kerning: none`，量 Google Sans Flex（用 `--fonts` 的 woff2）與 Arial（600 對 Arial Bold）的寬度比；
   光學尺寸照 `roles` 的 `opsz`（數字＝固定、`"auto"`＝跟字級走）。結果交給 `renderFallbackCss`。
10. 結束碼：0 成功、1 做不完（設定檔不在／不是 JSON／`roles` 空的、字型資料夾缺檔、`--out` 的資料夾不在、找不到 Playwright、瀏覽器開不起來）、2 用法錯誤（不認得的參數、多出來的字、空字串、`--fonts` 不是資料夾）。
    任何失敗 `--out` 一個位元組都不動（先寫暫存檔、成功才換上）；stderr 第一行中文、沒有堆疊；給了 `--out`，`homepage/site/` 底下一個檔都不動。
11. 〔派工〕**冪等只保證同一台機器**：量的是這台的 Arial，不同機器（Arial 版本、作業系統）不保證位元組相同 —— 測試只量「同一台重跑兩次相同」，**不比對 golden.css 的位元組**，README 要寫明。
    要瀏覽器的那條另外量：過靜態檢查；基本組照 roles×字重（15 組、照順序）；每組剛好收齊 `fonts.css` 的字各一次、空白自己一個排最後；微調組＝測試自己照係數乘出來的；`homepage/site/` 不動。

**係數掃描 `scripts/fallback-sweep.mjs`**（`npm run fallback-sweep`）與 `lib/fallback-sweep.js`

12. 〔測試工程師〕`compareBlocks(want, got)`：兩次量到的 `{ data-id: 高度 }`，高度不同、或第二次量不到的 id，照 id 排序回傳；第二次多出來的不算。
    `parseKRange("起:迄:間隔")` → 係數陣列（四捨五入到小數 4 位，含迄）；格式錯、迄小於起、間隔 ≤ 0 丟 Error。
13. 〔測試工程師〕`npm run fallback-sweep -- --site <已產生的網站資料夾> [--langs zh,en,ja] [--widths 280,390,…] [--css <fallback-fonts.css> --scan "<family>|<字重範圍>" --k <起:迄:間隔>] [--playwright <資料夾>]`。
    在本機開一個靜態伺服器給 `--site`；每個語言×寬度開兩次頁面：一次正常載入、一次擋掉 `*.woff2`（回退字型）；量每個看得到的 `[data-id]` 的高度（四捨五入；同一個 id 第二個起加 `#2`…）。
    - 檢查（沒給 `--scan`）：每一組一行 `一致 <語言> <寬度>px` 或 `不一致 <語言> <寬度>px：<id>、<id>`，最後一行 `共 N 組：一致 A、不一致 B`；有不一致結束碼 1，全部一致 0。
    - 掃描（`--scan` 要跟 `--css`、`--k` 一起給）：把 `--css` 裡那一組（family＋字重）整組乘上每一個係數（`scaleFaces`）注入擋掉字型的那一頁，每個係數一行
      `k=<係數，小數 4 位> 不一致 <N> 組`，有不一致時接「：<語言> <寬度>px <id>、…；…」；結束碼 0。
    - 用法錯誤（沒給 `--site`、`--site` 不是資料夾、`--widths` 不是正整數、`--langs` 不是 zh／en／ja、`--scan` 少了 `--css` 或 `--k`、`--k` 寫錯、不認得的參數）→ 結束碼 2；找不到 Playwright → 結束碼 1（同第 8 條）。
    - 要瀏覽器的測試在暫存資料夾組一個小網站（三語各一頁、`short`／`long` 兩個區塊、字型用 `public/fonts` 的複本、回退字型 size-adjust 由測試給：100% 對得上、300% 對不上），不用真的網站。

**靜態檢查（B12.3，`fallback-check.test.js`）**

14. 〔派工〕除了空白（`unicode-range` 只有 `U+20`），每個 `size-adjust` 都要在 **85%～120%**；golden.css 要過，手改一個成 130%（或 80%）要被抓到。
    〔測試工程師〕**微調組的明確容許值**（`fallback-fixture.js` 的 `MICRO_ALLOWANCE`）：基本組夾在 85%～120% 再整組乘 k，所以容許 `[85×k, 120×k]`（到 0.01、兩邊各放 0.01）——
    sub en（100 449）87.23～123.18、sub ja 85.63～120.91、sub zh 85.62～120.90、touch en 100 449：86.16～121.67、touch en 450 599：85.84～121.21、touch en 600 900：84.78～119.71、
    title en 84.44～119.23、title zh 83.71～118.21、bulletin en 85.69～120.99、bulletin zh 85.84～121.21、title48 en 84.89～119.87、meta en 85.20～120.31（family 都是 `"Google Sans Flex Fallback <組> <語言>"`）。
    golden.css 實際最低 84.12%（title zh）、最高 123.17%（sub en）。不是基本組、也不在清單裡的 family → 抓到。係數改了，這張表要跟著改（測試會先紅）。
    網站有 `app/styles/fallback-fonts.css`（前端合併之後）時它也要過；後端分支沒有就 skip。

**結構與文件**

15. 〔派工〕`package.json`：`scripts["fallback-fonts"]` ＝ `node scripts/fallback-fonts.mjs`、`scripts["fallback-sweep"]` ＝ `node scripts/fallback-sweep.mjs`；套件只在白名單；**Playwright 不在任何 dependencies 裡**。
16. 〔派工〕`lib/` 只 import `node:` 與 `./`；`scripts/` 的靜態 import 只准 `node:` 與 `../lib/<檔>.js` —— **例外**：Playwright 用 `createRequire` 從 `--playwright`／`SITE_PLAYWRIGHT` 給的路徑載入
    （檔裡要寫到 `SITE_PLAYWRIGHT` 與 `--playwright`；不准直接載入套件名 `playwright`、不准寫死 `node_modules`、`clipper/`、`/Users/`、`GPTPlugins` 這類本機路徑）。檔頭註解寫到 `npm run …` 與 `SITE_PLAYWRIGHT`。
17. 〔派工〕網站 `README.md` 有一節（`## ` 標題寫到 `fallback-fonts`）：`npm run fallback-fonts`、`npm run fallback-sweep`、`SITE_PLAYWRIGHT`、`--out`、
    什麼時候要重跑（字型換了、字級或字重新增、頁面文案大改、換機器）、量的是這台的 Arial、**不同機器不保證位元組相同**、85%～120%；沒有開發流程的字眼。
    〔派工〕跟前端 README「回退字型」那一節一致：這一條沒有寫成測試（前端那份在別的分支），由檢查員對照。

**放回錯誤驗證**（2026-10-03，測試工程師在暫存複本寫了參考實作 —— 設了 SITE_PLAYWRIGHT 全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 分組門檻 2% → 10% | B12.1 groupGlyphs 兩條：「一般的一組：組數，得到 [… [97,98,99,102] …]」 |
| 夾範圍拿掉 | B12.1 groupGlyphs 兩條；B12.1 命令（要瀏覽器）：「過靜態檢查」 |
| 輸出順序不固定（照量測的順序，不照 roles） | B12.1 renderFallbackCss 冪等：「輸入的順序打亂，結果一樣」；少一組量測 |
| 寫死本機路徑（Playwright 找不到時退回 clipper 的那一份） | B12.1 命令：「沒給 --playwright、沒設 SITE_PLAYWRIGHT：結束碼要是 1，得到 0」；B12 結構：寫死的本機路徑 |
| 寫半套（量之前先寫 --out） | B12.1 命令（要瀏覽器）瀏覽器開不起來：「--out 一個位元組都不動」 |
| 掃描比對不看高度 | B12.2 compareBlocks；B12.2 命令（要瀏覽器）檢查與掃描兩條 |

**檢查員第 1 輪補的**（2026-10-03）

18. 〔派工〕**本機伺服器不能被壞請求弄掛**（`static-site.test.js`，`lib/static-site.js` 的 `serveSite`）：伺服器開在子程序裡，送
    `/%00`、`/%00.html`、`/a%00b`、`/sub/%00/`、`/%2e%2e%2f`、`/%2e%2e%2foutside.txt`（`..` 編碼）、`/%E0%A4%A`（壞掉的編碼）→ 每一個回 404 或 400、讀不到外面的檔；
    每一個之後再送 `/a.txt` 要回 200；伺服器程序一直活著、stderr 是空的（沒有未捕捉的例外與堆疊）。正常的 `/a.txt`、`/sub/`（送 `sub/index.html`）回 200。
19. 〔派工〕**符號連結穿越**：網站資料夾裡指到外面檔案的 `link.txt`、指到外面資料夾的 `linkdir/` → `/link.txt`、`/linkdir/secret.txt` 回 404、讀不到外面的字。Windows 上 skip。
20. 〔派工〕**直接量 `lib/fallback-check.js` 的 `checkFallbackCss(css, { roles, factors })`**（`fallback-check.test.js` 最後一條）：設定照 `ROLES`、`FACTORS`，
    golden.css、基本組手改成 130%、80%、`sub en` 超出微調組容許值、不認得的 family → 0／1／1／1／1 個問題，問題是中文、講到那個數字或 family。
    （上面幾條用的是測試自己寫的 `checkSizeAdjust`，當作對照；命令靠 lib 那支決定沒過就不寫輸出檔，所以要直接量它。）
    **這一條現在是綠的**（lib 是對的），所以不是「先紅」，是靠放回錯誤證明它守得住（見下表）。
21. 〔派工〕**系統暫存資料夾寫不進去時講原因**（`fallback-fonts-cli.test.js`，要瀏覽器）：`TMPDIR` 指到唯讀資料夾，Playwright 開瀏覽器時要在暫存資料夾開資料夾而失敗 →
    結束碼 1、訊息要講到「暫存資料夾」（不能只說「瀏覽器開不起來…可能是還沒裝瀏覽器」）、`--out` 不動。Windows 與 root skip。
22. 〔派工〕**README 不寫沒量過的數字**（`structure-b12.test.js`）：網站 `README.md` 回退字型那一節，講到「機器」的句子如果寫了百分比數字（`1%` 之類），
    同一句要寫明「未量」或「沒量」。〔測試工程師〕只看講機器的句子：85%～120%、2% 這些設計值不受影響，免得寫得太脆。

| 放回的錯（檢查員第 1 輪；在參考實作的複本上做，`%00` 那一條就是現在專案上的寫法） | 紅在哪一條、哪一步 |
|---|---|
| `lib/fallback-check.js` 的 `HIGH` 改 140 | 第 20 條：「基本組手改成 130%：要有 1 個問題，得到 0」 |
| `checkFallbackCss` 一律 `return []` | 第 20 條：同上 |
| 容許表算錯（沒乘 k） | 第 20 條：「golden.css：要有 0 個問題，得到 11」 |
| `fileFor` 的 `statSync` 沒包（現在的寫法） | 第 18 條：「/%00：要回 404 或 400，得到 ECONNRESET；伺服器 stderr：node:internal/errors…」 |
| 不看符號連結的真實路徑（現在的寫法） | 第 19 條：「/link.txt：不能讀到資料夾外面的檔（得到 200：資料夾外面的祕密）」 |
| 瀏覽器開不起來一律講「可能是還沒裝瀏覽器」（現在的寫法） | 第 21 條：「訊息要指出暫存資料夾…得到：…EACCES: permission denied, mkdtemp…可能是還沒裝瀏覽器」 |
| README 寫「數字會有 1% 左右的差」（現在的寫法） | 第 22 條：「講不同機器的句子寫了百分比，要寫明是「未量」」 |

**量到的事**（給派工人員；不是測試）：參考實作在這台 mac 產一次約 0.5 秒（Chromium、15 組×118 字）。跟 golden.css 比，每個字的 size-adjust 有 2541 個相同、294 個不同（最多差 1.2%）——
要收的字現在多了 ¦ « »（`fonts.css` 4-b6 之後加的，golden.css 那時沒有），分組跟著變；所以重產的檔不會跟 golden.css 位元組相同，這是預期的。

## 已知限制（4-b12，沒有測試）

- 要瀏覽器的那幾條只在設了 `SITE_PLAYWRIGHT` 的機器上跑；Windows 上沒跑過（Arial 不同，結果會不同，本來就不保證）。
- 係數掃描只量 `[data-id]` 的高度（行數變了高度就變）；行數不變、字左右移的那種不量。真的 CLS 1px 全掃（前端的 `clssweep`）沒有收進來，前端 `tests-site` 有自己的 CLS 測試。
- 掃描不分「只有手指／有滑鼠」（前端掃的時候兩種都掃）；預設寬度清單沒量。
- 預設的 `--out`（`app/styles/fallback-fonts.css`）在前端合併之後會寫進專案，那時這條測試 skip（不量）。
- 微調組的容許值是照現在的 12 條係數算的數字；係數改了要跟著改表（測試會先紅，提醒改）。

## 介面細則（4-b13：07 大綱圖只留看得到的那一塊 —— `npm run images` 的裁切設定）

測試案例是派工人員 2026-10-03 給的（B13.1 大綱圖重裁、B13.2 邊界與文件，下面標〔派工〕）；介面細節是測試工程師定的（標〔測試工程師〕），後端照這一節實作。編號另起。
背景：07 區的大綱圖原圖 1920×1080，網頁只顯示左邊一塊再放大（設計稿 `home.css` 的 `.crop--outline`），瀏覽器在任何寬度都下載整張縮成 1280 的那張，看不到的右半也在裡面。

跑法（在 `homepage/site/`）：

```
npm test -- --test-name-pattern "B13"                                    只跑 4-b13（要 cwebp 的找不到就 skip、量像素的另外要 dwebp）
SITE_ASSETS=<設計稿的 assets 資料夾> CWEBP=/opt/homebrew/bin/cwebp npm test -- --test-name-pattern "B13.1 真的素材"   真的素材（約一分半）
```

檔案：`images-crop.test.js`（fixture，B13.1）、`images-crop-real.test.js`（提交進來的設定與輸出、真的素材）、`structure-b13.test.js`（B13.2）；
`images-crop-fixture.js` 是共用的小工具（不是測試）：現組一張每個像素都算得出來的 PNG（`pixelAt(x, y)`，x、y 對調顏色就不同）、用 `dwebp -pam` 把 WebP 解回像素。

**裁切框怎麼定的（〔派工 2026-10-03 改〕照量到的露出矩形，不照 CSS 變數）**：
- 前端測試工程師提醒「CSS 變數的數字不一定等於實際看到的矩形」，派工人員要求重量。測試工程師用 Playwright 開 **設計稿 350fdf4** 與 **換圖之前的網站（前端 c5b3787，build 出來的 `out/`）**，
  三語 × 有滑鼠十二種寬度（280～1440）＋只有手指十二種寬度（280～1280），量大綱圖與 05 第 3 張終端機截圖在框裡**實際露出的矩形**，換算回原圖 1920×1080 的像素。
  表在 `tests/fixtures/images-crop/visible-rects.json`（288 筆），量的程式是同一個資料夾的 `measure-visible.mjs`（用法寫在它的檔頭）。兩個版本量到的逐筆相同（差 0）。
- 量到的：**露出的位置就是 CSS 變數寫的**（大綱圖 (300, 143)，手機 640×540、640 寬起 1010×560；終端機 (280, 140) 起 774×650、英日 798×650），
  只是寬高因為版面的小數像素會多出一點點：大綱圖右邊最多多 1.10、下面 0.48；終端機右邊 1.17～1.19、下面 1.12～1.42；左上差 0.04～0.07（原圖像素）。
  舊框（照 CSS 變數）因此有 282／288 筆露出的矩形**超出框一點點**（不到 1.5 原圖像素）。
- 〔測試工程師〕**「y 約 259～271、214～216」是量法的錯**：用 `scrollIntoView` 把圖捲到畫面中間時，瀏覽器會連 `overflow: hidden` 的框一起捲（1440 寬時框被捲了 53px），
  量到的是使用者永遠看不到的位置（框沒有捲軸、使用者捲不動它）。只捲整頁、把框的捲動歸零之後，量到的 y 就是 143、140。測試工程師第一次量也踩到，量法已改；
  前端的 F6b 測試如果也用 `scrollIntoView` 量框裡的圖，會量到同樣的錯位置（要轉告前端）。
- **新框 ＝ 所有寬度、所有版面露出矩形的聯集，四邊各多留 2 原圖像素**（往下取整、往上取整後再加減 2，不超出原圖）：
  **大綱圖 `{ x: 297, y: 140, width: 1017, height: 566 }`**、**終端機中文 `{ x: 277, y: 137, width: 781, height: 657 }`、英日 `{ x: 277, y: 137, width: 805, height: 657 }`**。
  跟舊框比：左、上各多 3，右各多 4（大綱圖寬 1010 → 1017；終端機 774 → 781、798 → 805），下各多 3～4（560 → 566、650 → 657）。

（以下是第一版的理由，框的數字以上面為準）〔測試工程師，讀設計稿與前端 CSS〕：設計稿 `home.css` 的 `.crop--outline` 是手機 `--cx 300; --cy 143; --cw 640; --ch 540`、640 寬起 `--cw 1010; --ch 560`
（前端 `components/ForAI/ForAI.module.css` 一樣；圖照 `1920 / --cw` 倍放大、左上角對到 (300, 143)）。一張圖要給兩種版面用，所以取兩個框的聯集：
**`{ x: 300, y: 143, width: 1010, height: 560 }`**（手機那塊 300～940 × 143～683 在裡面）。裁好之後前端的手機版只要從這張圖的左上角再取 640×540（以原圖像素算）。

〔派工 2026-10-03 加〕**05 第 3 張（叫 AI 分析那個資料夾）的終端機截圖 `ai-terminal-{zh,en,ja}.png` 也照樣裁**（前端 05 要用；設計稿 `build.mjs` 第 1207 行、`notes/4-2.md`「給前端的事」寫「ai-terminal 裁切轉 WebP」）。
它的框照設計稿 `home.css` 的 `.crop--step3`：`--cx 280; --cy 140; --cw 774; --ch 650`，英日 `--cw 798` —— 05 三張要同一比例（`notes/4-2.md`：中 800:672、英日 800:652；774:650 與 798:650 就是這兩個比例），
所以 **中文 `{ x: 280, y: 140, width: 774, height: 650 }`、英日 `{ x: 280, y: 140, width: 798, height: 650 }`**。這一塊在每一種寬度都一樣（沒有手機另一組），不用取聯集。

**設定檔**〔測試工程師〕`scripts/images.config.json`：一個物件，鍵是來源檔名（含副檔名），值是 `{ crop?: { x, y, width, height }, widths?: [ … ] }`。
現在剛好六張（測試逐筆比對）：三語大綱圖 `{ "crop": { "x": 297, "y": 140, "width": 1017, "height": 566 }, "widths": [640, 1280, 1920] }`、
三語終端機截圖 `{ "crop": { "x": 277, "y": 137, "width": 781（英日 805）, "height": 657 }, "widths": [640, 1280, 1920] }`。沒寫的圖照舊（640／1280）。
〔派工 2026-10-03 定〕寬度維持「widths 每個跟框寬取小、不放大」：大綱圖出 **640＋1017**、終端機出 **640＋781（英日 805）**，不硬放大到 1280／1920
（看得到的那一塊在原圖上就只有這麼寬；要更清楚得用更高解析度的素材，那是設計素材的事）。1920 的規則用 fixture 的寬圖（框 1960）驗。

1. 命令：`npm run images -- --from <素材資料夾> [--out <資料夾>] [--config <設定檔>]`。`--config` 預設 `scripts/images.config.json`；`--config=` 空字串是用法錯誤（結束碼 2）；
   指到不存在的檔、讀不了 → 結束碼 1、講出那個檔。
2. 〔派工〕裁切框從設定檔讀，**不寫死在程式裡**（`lib/images.js`、`lib/images-run.js`、`scripts/images.mjs` 裡沒有 1010、143、ai-outline）。
3. 有裁切框的圖：先照框裁（以原圖像素），再縮。輸出寬度 ＝ `widths`（沒寫就 640、1280）**每個取「它」與框寬之中小的那個，不放大、不重複**；高 ＝ 框高 × 寬 ÷ 框寬，四捨五入。
   檔名照舊 `<來源檔名去掉副檔名>-<寬>.webp`（大綱圖還是 `ai-outline-<語言>-<寬>.webp`，內容變成裁過的）。無損、有損照副檔名（跟原本一樣）。
4. `images.json`：有裁切的那一筆是 `{ width, height, crop: { x, y, width, height }, sizes }`（照這個順序；`width`、`height` 是原圖的、`crop` 照設定檔、`sizes` 是裁過的每個輸出）；
   **沒有裁切的照舊** `{ width, height, sizes }`（4-b6 第 30 條不變）。前端寫 `srcset`／`sizes` 要的：每個尺寸的寬高在 `sizes`、裁切後的長寬比 ＝ `crop.width : crop.height`。
5. 設定錯了一律**在碰任何圖之前**擋下、結束碼 1、stderr 第一行中文、講出那張圖（與欄位或框）、`--out` 一個位元組都不動、`--from` 不變：
   設定檔不是 JSON（講「JSON」）、不是物件、框缺欄位、不是整數、x／y 是負數、寬高是 0 或負數、框超出原圖（講原圖的寬高）、`widths` 是空的或有不是正整數的、
   `--config` 給的設定檔有一張 `--from` 裡沒有的圖（講那張圖）。
   〔測試工程師〕**用預設的設定檔**（沒給 `--config`）時，`--from` 裡沒有的圖只印一行「警告」、照常轉、結束碼不因此變 1 —— 不然 4-b6 的圖片測試（用別的素材資料夾）會全部失敗。
6. 冪等：重跑位元組相同、不重寫（修改時間不變）；拿掉輸出再跑位元組相同。〔測試工程師〕**改了框（寬高一樣、只換位置）重跑要重算**，不能因為寬高對得上就沿用舊的檔（原本「沿用」只看修改時間與寬高）。
7. 幾何（要 dwebp）：框寬比最小的寬度還窄時，輸出就是框的原寸、無損 —— 解開來跟手切原圖同一個框的像素逐一相同。
8. 給了 `--out` 跑完，`homepage/site/` 底下每個檔都不動；原檔一個位元組都不變。

**提交進來的與真的素材**

9. 〔派工〕產出要提交：`public/images/` 的大綱圖與終端機截圖、`images.json` 那六筆是 `{ width: 1920, height: 1080, crop, sizes }`、`sizes` 照第 3 條、每個檔在而且位元組跟 `images.json` 寫的一樣。
10. 設了 `SITE_ASSETS`（真的素材資料夾）＋找得到 cwebp 才跑：用 `scripts/images.config.json` 整批跑一次 → 提交進來的 `public/images/` 的 `.webp` 與 `images.json`
    **剛好是重跑產出的那些**（不多不少；多了終端機截圖三語的輸出是預期的）、每個檔位元組相同；不裁切（空的設定檔）再跑一次 → 六張**裁切後最大那張比不裁切的 1280 小**
    （大綱圖原本瀏覽器下載的就是那張 1280）。〔派工 2026-10-03 定〕**不比 640**（見下面量到的事）。設了但那裡缺六張之一 → 紅。

11. 〔派工 2026-10-03 加〕**露出的矩形都在裁切框內**：`visible-rects.json` 的每一筆（兩個版本 × 三語 × 24 種寬度 × 兩張圖）完全在提交進來的
    `scripts/images.config.json` 的框裡（容許 0 像素）。另一條防呆：用表算「聯集＋四邊 2 像素」要剛好等於測試裡的框（表或框只改一邊就先紅）。
    **重量**：設計稿或前端的裁切 CSS 改了，用 `measure-visible.mjs` 重量、換掉 `visible-rects.json`，再照它改設定檔與測試的框。

**結構（B13.2）**：`package.json` 的 `images` 照舊、套件只在白名單；`lib/` 只 import `node:` 與 `./`、命令只 import `node:` 與 `../lib/`；命令檔頭寫到 `--config`、`images.config.json`、裁切；
網站 `README.md` 的「## 圖片」那一節寫到 裁切、`images.config.json`、`--config`、`crop`、`1920`、重跑，沒有開發流程的字眼。

**放回錯誤驗證**（2026-10-03，測試工程師在暫存複本寫了參考實作 —— 設了 SITE_ASSETS 與 CWEBP 全綠 —— 一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 框的 x 與 y 對調 | B13.1 裁切（wide.png 對調後超出原圖：「結束碼要是 0，得到 1」）、幾何、冪等、不動專案 |
| 裁切框忽略（不給 cwebp `-crop`） | 同上四條（輸出寬高對不上，那張轉不成） |
| 輸出尺寸少 1920 | B13.1 裁切：「框 1960×20 → 640×7、1280×13、1920×20」；冪等 |
| 改了框照樣沿用舊的（不冪等） | B13.1 冪等：「框換了位置（寬高一樣）：pattern-120.webp 要重算，不能沿用舊的」 |
| 框改回舊值（照 CSS 變數：300,143,1010×560；280,140,774／798×650） | B13.1 露出的矩形都在裁切框內：「共 282 筆超出」；設定檔逐筆比對、images.json 比對 |
| 框超出原圖不先擋（壞的那張略過、其他照寫） | B13.1 設定檔壞掉：「框超出原圖的右邊：stderr 要講到 /300/」（--out 也被寫了） |

（終端機截圖加進來之後，參考實作用真的素材重跑：B13 的 14 條全綠，約兩分鐘。）

**量到的事**（參考實作、真的素材、這台 mac、cwebp 1.6.0；給派工人員，不是測試）：
- （第一版框）裁切框寬 1010，照「不放大」三語大綱圖出 **640 與 1010 兩張**（沒有 1280、1920）；終端機截圖出 640 與 774（英日 798）。
  終端機截圖：640 是 160,366（zh）／153,024（en）／152,072（ja），774／798 是 175,208／172,222／172,392 位元組。
- **新框**（重產，參考實作）：大綱圖 1017 寬 102,096（en）／107,900（ja）／135,606（zh），640 寬 90,942／90,310／109,108；
  終端機 805／781 寬 172,046（en）／172,646（ja）／175,290（zh），640 寬 151,736／151,250／159,128 位元組。
  大綱圖對不裁切的 1280（151,132／151,832／166,570）是 68%／71%／81%；終端機沒有提交過不裁切版，對不裁切重跑的 1280 也比較小（測試量了）。
- 位元組：裁切後的 1010 是 101,028（en）／107,524（ja）／134,356（zh），原本瀏覽器下載的不裁切 1280 是 151,132／151,832／166,570（小 19%～33%，而且看得到的那一塊從 673 像素寬變成 1010 像素寬）。
  **裁切後的 640 反而比原本的 640 大**（91,918／92,066／110,432 對 47,962／47,162／51,404）：把 1010 寬的字縮成 640，字比較密，無損壓起來比較大；原本的 640 瀏覽器從來不用。
- 設計稿素材資料夾的 `ai-terminal-{zh,en,ja}.png` 原本沒轉進 `public/images/`；這一段起照 `.crop--step3` 裁好轉進去（前端 05 要用）。

## 已知限制（4-b13，沒有測試）

- 有損的圖（`.jpg`）裁切沒有用 fixture 量幾何（只量了無損的 PNG）；有損的像素本來就不會逐一相同。
- 縮過的那幾張只量寬高，沒有量像素（重新取樣不會逐一相同）。
- 裁切框的座標是照設計稿 `home.css` 抄的；設計稿改了框，要人手改 `scripts/images.config.json` 再重跑（沒有測試對照設計稿，設計稿在網站 repo 外面）。
- 前端的 `srcset`／`sizes` 與裁切 CSS 還是照不裁切的圖寫的，要跟著改（前端的事，這一段不量）。

## 4-f1 的 F1.7：套件白名單（前端加 Next.js 之後）

派工人員 2026-10-02 的案例：`structure-b2`～`b7`、`b9` 原本寫死「package.json 不准有 dependencies／devDependencies」（上面 4-b2～4-b7、4-b9 各節寫的「沒有任何套件」以這一節為準）。改成：

- `helpers.js` 的 `assertPackageWhitelist(pkg)`：`dependencies` 只准 `next`、`react`、`react-dom`（可以少、可以沒有）；`devDependencies`、`optionalDependencies`、`peerDependencies`、`bundleDependencies` 沒有或空的。
  `structure-b2`～`b7`、`b9` 的那一條與 `structure-f1.test.js` 都叫它。前端要加別的套件（例如動畫套件 GSAP、Motion），先跟派工人員講、再加進白名單。
- 「後端程式不用 npm 套件」改由 import 檢查守：`lib/` 每一支由 `structure.test.js` 的 B1.8（只准 `node:` 與相對路徑）守；`scripts/` 每一支由 `structure-f1.test.js` 守（同一條規則、不用 require）。
- `structure-f1.test.js` 另有一條防呆：白名單外的套件、devDependencies 有東西，`assertPackageWhitelist` 都要丟。

跑法：`npm test -- --test-name-pattern "F1.7|白名單"`。

放回錯誤驗證（2026-10-02，在暫存資料夾的複本上，package.json 已有 next、react、react-dom）：加 `tailwindcss` → B2.6、B3.3、B4.2、B5、B6.5、F1.7 六條紅；
devDependencies 加 eslint → F1.7 紅；`lib/links.js` 結尾 `import 'react'` → B1.8 紅；`scripts/test.mjs` 加 `import 'next'` → F1.7 scripts 那條紅。

前端的測試（要先 build）在 `../tests-site/`，跑法與介面見那裡的 README.md；`npm test` 不跑它們。

---

## 介面細則（4-b14：分享卡圖 `npm run og`、圖示驗收）

測試：`og-cli.test.js`（命令，假的設計稿）、`og-files.test.js`（提交進來的檔、package.json、README）、`og-real.test.js`（真的設計稿）、`icons-files.test.js`（圖示）；共用的小工具在 `og-fixture.js`（自己讀 PNG，不靠被測的程式）。
派工人員的案例是 F8.5a～F8.5e；標〔挑〕的是測試工程師挑的寫法。

**幾張、檔名（照設計稿 `design/homepage/notes/4-4.md`「分享卡：給前端怎麼出圖」第 4、5 條與 SPEC §10.6）**

1. 剛好三張：`public/og/og-zh.png`、`og-en.png`、`og-ja.png`。**「/」不另做圖**：它的 `og:image` 用 `og-en.png`（SPEC §10.6「預覽圖用英文那張」、notes/4-4.md「「/」不另做圖」、前端 `tests-site/seo.test.js` 也是這樣量）。
   `public/og/` 裡只放這三張（不能有 `og-root.png`）。平台會記住舊圖，圖換了要換檔名時（例如 `og-zh-2.png`），測試的檔名要跟著改。
2. 來源：`<--root>/design/homepage/og/{zh,en,ja}/index.html`（設計師的分享卡版面，`build.mjs` 產生），連的 CSS 在 `<--root>/clipper/css/`、`design/_shared/`、`design/homepage/`。
   〔挑〕`--root` 給專案根目錄（不是 og 資料夾）：稿裡的連結是從專案根目錄算的（往上四層），要從根目錄開本機伺服器（`design/README.md`：不能用 `file://` 開）。

**指令〔挑〕**

```
npm run og -- --root <專案根目錄> [--out <資料夾>] [--check] [--playwright <Playwright 套件的資料夾>]
```

3. `package.json` 的 `scripts.og` 是 `"node scripts/og.mjs"`；Playwright 照舊不進 package.json，用 `--playwright` 或環境變數 `SITE_PLAYWRIGHT`（同 `fallback-fonts`）。
4. `--out` 預設 `public/og`（從網站資料夾算，從哪裡叫都一樣）；不存在就建。只新增或改寫那三張，`--out` 裡別的檔、子資料夾與上一層一個位元組都不動。
5. 用法錯誤 → 結束碼 2、stderr 第一行是中文：沒給 `--root`、`--root` 不存在或是檔、`--root=`／`--out=` 空字串、`--out` 是檔、不認得的參數、多出沒有 `--` 的字。叫它的資料夾不多任何檔。
6. 找不到 Playwright → 結束碼 1、中文、講到 `SITE_PLAYWRIGHT`。
7. 成功 → 結束碼 0。輸出前，每一張印一行「`og-<語言> 字型：A、B`」（實際畫字用到的字型家族，用「、」隔開，順序不拘）。

**失敗就不產（F8.5b、F8.5e）**

8. 來源缺（某個語言的 `index.html` 不在）→ 結束碼 1，stderr 講 `og-<語言>` 與缺的那個路徑。**〔挑〕在開瀏覽器之前就停**：沒設 Playwright 時報的也是缺來源，不是找不到 Playwright。
9. 頁面有任何一種錯 → 結束碼 1，stderr 講是哪一張（`og-<語言>`）與哪裡錯：
   - 有檔載不到（console 的載入失敗，例如連了不存在的 CSS）：講到那個檔名；
   - 頁面丟例外（`pageerror`）：講到例外的訊息；
   - 字型沒載到（`@font-face` 的檔載不到）：講到「字型」與家族名（`Google Sans Flex`）；
   - **指定的字型這台沒有**：畫字用到的字型家族（Chrome DevTools Protocol 的 `CSS.getPlatformFontsForNode`）不在那個元素 `font-family` 寫的家族裡 ——
     也就是掉到了瀏覽器自己挑的回退字型（例如英文堆疊寫 `"Nope Sans 404", sans-serif`，實際畫字的是 Helvetica）。講到「字型」。
   - **字撐破版面**（設計稿 notes/4-4.md 第 3 條的拍前自我檢查；派工人員 2026-10-04 補的案例）：`document.documentElement.scrollWidth` 大於 1200 或 `scrollHeight` 大於 630。
     講是哪一張與超出的那一邊（寬超出講到 1200、高超出講到 630），沒撐破的另外兩張不列成錯。三語各驗一次：中文大標重複六次（往下超出）、英文大標接一個不能斷的長字、日文那一行不換行（往右超出）。
10. 〔挑〕**失敗時一張都不寫**：三張都檢查過、拍好，全部沒問題才寫；任何一張失敗，`--out` 與上一層一個位元組都不動（舊的圖留著，不產半套）。

**可重複、`--check`（F8.5c）**

11. 同一份來源、同一台機器跑兩次，三張逐位元組相同（寫到另一個 `--out`、或同一個 `--out` 重跑都一樣）。
    PNG 會不會每次不同：Chromium 的截圖是同一組像素就編出同一串位元組（參考實作量過：三張都相同）；**會不同的是換了 Chromium 版本、換了系統字型或換一台電腦** ——
    所以 `og-real.test.js` 拿重產的跟提交進來的比，遇到這種情況會紅：重跑 `npm run og` 再提交。不要在 PNG 裡放時間之類每次不同的資料。
12. 〔挑〕`--check`：檢查、拍照照做（也照樣印字型），**不寫任何檔**；拍出來的跟 `--out` 裡的三張逐位元組比：都相同 → 結束碼 0；有不同或不在 → 結束碼 1，講哪幾張（相同的不列）。來源壞了照第 8～9 條。

**檔案大小、不是空白（F8.5a）**

13. 每張 ≤ 300 KB（307,200 位元組）。理由：設計師量到約 130～150 KB（參考實作拍真的稿：zh 143,456、en 145,386、ja 162,444 位元組），上限給兩倍左右留給字變多；
    超過多半是拍錯了（例如兩倍螢幕拍成 2400×1260，或拍到照片類的底）。各平台的上限都比這大很多（Facebook 8 MB），這條不是平台的規定。
14. 不是空白圖：至少 16 種顏色，而且跟左上角顏色不同的像素至少 2%；三張兩兩比，不同的像素至少 0.5%（三語不是同一張）。〔挑〕門檻是寬鬆的：真的稿三張之間差很多，只用來擋「同一張圖複製三份」「整片底色」。

**字型與授權（F8.5e）**

15. 真的稿（`og.css` 寫死的家族，設計審查後改的）：中 `"Google Sans Flex", "PingFang TC", sans-serif`、英 `"Google Sans Flex", sans-serif`、日 `"Google Sans Flex", "Hiragino Sans", sans-serif`。
    參考實作在這台 mac 拍真的稿印出：中 Google Sans Flex＋PingFang TC、英 Google Sans Flex、日 Google Sans Flex＋Hiragino Sans（`og-real.test.js` 量這個）。
16. 網站 `README.md` 要有一節標題寫著「分享卡」，寫到：`npm run og`、`--root`、`--check`、`public/og`、用到的三個字型家族與來源、授權、「/」用 `og-en.png`。授權本身測試判斷不了（見下面「已知限制」）。

**圖示（F8.5d，回歸）**

17. `public/` 的七張 PNG：`favicon-16`（16）、`favicon-32`（32）、`apple-touch-icon`（180）、`icon-192`、`icon-512`、`icon-maskable-192`、`icon-maskable-512`，寬高看檔頭也看解出來的像素。
18. 四個角：透明的 `favicon-16`、`favicon-32`、`icon-192`、`icon-512` alpha 0；不透明的 `apple-touch-icon` 與兩張 maskable alpha 255（存成沒有 alpha 的 RGB 也算 255）。
    設計稿 `icons/site/README.md` 寫「透明的五張」是把 `favicon.svg` 算進去了，PNG 透明的是四張。
19. `favicon-16`、`favicon-32` 跟擴充的 `clipper/icons/icon-16.png`、`icon-32.png` 逐像素相同（解出來的 RGBA 一個通道都不差）；找不到擴充的圖（搬進公開 repo 之後）skip 那一條。
20. **這個分支沒有圖示**：圖示是前端 4-f2 放進 `public/` 的，後端分支還沒合併前端（沒有 `app/`）時三條 skip 並寫原因。前端合併之後（有 `app/`）一律量 `public/`，圖示不見就紅。
    要在後端分支先量，用 `SITE_ICONS_DIR` 指到放圖示的資料夾（例如前端工作資料夾的 `public/`）。

**檢查員第 1 輪補的：拍照時開的本機伺服器**（`og-serve.test.js`；2026-10-04，檢查員查 ef57ef2）

21. 〔派工〕`lib/og-run.js` 的 `shootAll` 開的本機伺服器，**只准用 `lib/static-site.js` 的 `serveSite(root)`**（4-b12 已經防好的那一支），不自己開：
    `lib/og-run.js` 要 `import { serveSite } from './static-site.js'` 並呼叫它，不准 import `node:http`、不准出現 `createServer`（結構測試）。
22. 〔派工〕量法：子程序跑 `tests/fixtures/og-serve/probe.mjs`，交給 `shootAll` 一個假的瀏覽器 —— 它叫 `page.goto(<伺服器網址>/design/…)` 的那一刻伺服器開著，
    假的 `goto` 就照原樣（不正規化）送請求，每一個之後再送一次 `/a.txt`；不需要 Playwright。一種一條：
    - 符號連結：根目錄裡 `sub/link.txt` 指到外面的檔、`linkdir/` 指到外面的資料夾 → 404、讀不到外面的字（Windows skip）；
    - `/sub/a.txt%00.png`（空字元）→ 404；`/%E0%A4%A`（編碼壞掉）→ 400；之後 `/a.txt` 照常 200、程序沒掛、stderr 沒有堆疊；
    - 防回歸：`/../outside.txt`、`/..%2foutside.txt`、`/%2e%2e/outside.txt`（＋`%2e%2e%2f`）→ 404；只聽 127.0.0.1：網址是 `http://127.0.0.1:埠`，從 `::1` 與這台的區域網路 IPv4 連同一個埠連不上。
    `/../` 與 `/%2e%2e/` 會被 `new URL` 先正規化掉，所以要拿掉「解析網址」這一層才紅（見下表）；它們守的是「伺服器改成直接用 `req.url`」這種退步。

**跑法**

```
npm test -- --test-name-pattern "F8.5"                                   不開瀏覽器的那幾條
SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm test -- --test-name-pattern "F8.5"
SITE_OG_ROOT=<有 design/homepage/og/ 的專案根目錄> SITE_PLAYWRIGHT=… npm test -- --test-name-pattern "F8.5 真的"
SITE_ICONS_DIR=<放圖示的資料夾> npm test -- --test-name-pattern "F8.5d"
```

**放回的錯（參考實作，暫存複本；給派工人員看測試抓得到什麼）**

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 不檢查字型（`@font-face` 失敗、用到沒指定的字型都不管） | F8.5b 字型檔載不到：「要講是字型的問題」；F8.5e 指定的字型這台沒有：「結束碼要是 1，得到 0」 |
| 不做拍前自我檢查（字撐破版面照拍） | F8.5b 字撐破版面三條（中、英、日）：「結束碼要是 1，得到 0」 |
| 不管 console、頁面錯誤、載入失敗 | F8.5b console 有錯、頁面丟例外：「結束碼要是 1，得到 0」 |
| 拍好一張寫一張（不是全部沒問題才寫） | F8.5b console 有錯、頁面丟例外、F8.5e 指定的字型：「失敗時 --out 與上一層一個位元組都不動」 |
| 兩倍螢幕（`deviceScaleFactor: 2`） | F8.5a 出圖：「og-zh.png：PNG 檔頭的寬高要是 1200×630」；真的稿兩條 |
| 三張都寫英文那張 | F8.5a 出圖：「og-zh.png 與 og-en.png 要是不同的圖…得到 0.000%」；--check；真的稿 |
| `--check` 順手把圖改好 | F8.5c --check：「--check 對不上：照樣一個位元組都不動」 |
| 先載 Playwright 再查來源 | F8.5b 來源缺一張：「要講是哪一張（og-ja）」（報的是找不到 Playwright） |
| 多產一張 `og-root.png` | F8.5a 出圖：「只能新增或改寫三張 og-<語言>.png，得到變動的：…og/og-root.png…」 |
| 拍成整片底色 | F8.5a 出圖：「og-zh.png：不能是空白圖 —— 只有 1 種顏色」；真的稿 |
| PNG 裡塞每次不同的資料 | F8.5c 可重複：「og-zh.png：兩次產出要逐位元組相同」；--check；真的稿兩條 |
| favicon-32 存成不透明 | F8.5d 四個角、逐像素相同（不同的通道值 84 個） |
| apple-touch-icon 左上角 alpha 0 | F8.5d 四個角 |
| favicon-16 改一個像素的一個通道 | F8.5d 逐像素相同：「不同的通道值 1 個」 |
| favicon-16 從大圖縮出來 | F8.5d 逐像素相同：「不同的通道值 739 個」 |
| icon-512 存成 256 | F8.5d 寬高：「icon-512.png：PNG 檔頭要是 512×512」 |
| 少一張 icon-maskable-192 | F8.5d 寬高：「缺 …/icon-maskable-192.png」 |
| 有 `app/` 但 `public/` 沒有圖示 | F8.5d 三條都紅（不 skip） |
| 拍照的伺服器自己寫、沒用 `serveSite`（ef57ef2 的 `lib/og-run.js`） | F8.5 伺服器：符號連結「/sub/link.txt：不能送出根目錄外面的檔（得到 200：…）」；%00 與編碼壞掉「伺服器要還活著把請求量完：探針的程序結束碼 1」；結構「要 import { serveSite } from './static-site.js'」 |
| `serveSite` 拿掉「寫出來就跳出資料夾」與「真實路徑在資料夾裡」兩層 | 符號連結；`/..%2f`；`/%2e%2e%2f` |
| 再把 `new URL(...).pathname` 換成直接用 `req.url` | 加上 `/../outside.txt`、`/%2e%2e/outside.txt` |
| `serveSite` 聽 `0.0.0.0` | 只聽 127.0.0.1：區域網路的位址連得上 |

## 已知限制（4-b14，沒有測試）

- **字型授權測試判斷不了**：Apple 的系統字型（PingFang TC、Hiragino Sans）畫進公開的圖片可不可以、Google Sans Flex 的授權，都是未查證（設計稿 notes/4-4.md 也這樣寫）；測試只量「實際用了哪些家族」與「指定的有沒有載到」。
- 圖上的字是不是那個語言的字串（`nav.brand`、`hero.title`、`og.card.line`）沒有用 OCR 量：靠「三張彼此不同」「來源頁沒有錯、字型都載到」與真的稿重產跟提交的逐位元組相同。設計稿的字寫錯，測試抓不到。
- 只在 mac 上量過；Windows、Linux 的系統字型不同，第 9 條「指定的字型這台沒有」會讓命令失敗（這是刻意的：分享卡一律在 mac 上產）。
- 真的稿那兩條要 `SITE_OG_ROOT`：設計稿現在只在設計師的工作資料夾（`claude/home-4`），主資料夾還沒有 `design/homepage/og/`。
