# homepage/site 的前端測試（tests-site/）

跟後端的 `tests/` 分開放：這裡要先 `npm run build`，讀 build 出來的 `out/`，比較慢。
案例編號 F1.x、F1b.x 也是測試名稱的開頭，`--test-name-pattern` 用得到。字串表接進網站的那幾條（F1b）在最後一節。

## 跑法（在 `homepage/site/`）

```
npm ci                                                        先裝網站的套件（next、react、react-dom）
npm run test:site                                             先 build、再跑全部（另外 build 六次暫存複本、拍一輪截圖，mac 上約七分鐘＋build 的時間）
node tests-site/run.mjs                                       已經 build 過，只跑測試
node tests-site/run.mjs --test-name-pattern "F1.2"            只跑某一條案例（後面的參數照原樣交給 node --test）
node --test tests-site/html-lang.test.js                      只跑一支
SITE_ALT_NODE=/usr/local/bin/node node tests-site/run.mjs --test-name-pattern "F1.1 Node"   用 Node 20 或 21 另外 build 一次
SITE_PLAYWRIGHT=<…/clipper/node_modules/playwright> node tests-site/run.mjs                 指定 Playwright 在哪
```

**`package.json` 的 scripts：**

```json
"build": "next build",
"test:site": "npm run build && node tests-site/run.mjs"
```

不寫成 `node --test tests-site/*.test.js`：跟 `scripts/test.mjs` 同一個理由，萬用字元在 Windows 的 cmd.exe 不展開、
`node --test <目錄>` 在 Node 22 找不到模組，所以 `run.mjs` 自己列檔案清單（只跑 `*.test.js`）。截圖工具那一支（`shots.test.js`）等其他幾支跑完才單獨跑：同時跑時機器一忙，截圖工具每張 15 秒的上限會逾時（量過）。量時間與版面跳動的 `hero-quality.test.js`（F4.6、F4.8、F4.9）與寬度掃描 `cls-sweep.test.js`（F4.6b，自己同時開六頁）也各自單獨跑：跟其他幾支同時跑，量到的時間會被拖慢，也把別支拖到逾時（量過）。輸出因此分四段，四段都要 `fail 0`。`&&` 在 cmd.exe 也能用。

`npm test`（後端，`tests/`）不 build、不讀這裡；`npm run test:site` 也不跑 `tests/`。兩套都要綠。

## 用到的環境

- **build**：讀專案的 `out/`（`npm run build` 產的）。F1.3 另外 build 一次：把整個網站（含 `node_modules`）複製到系統暫存資料夾、
  `content/` 換成 `fixtures/content-bad/`，在那裡跑 `node node_modules/next/dist/bin/next build`。**專案裡的 `content/`、`out/`、`.next/` 一個都不動**；跑完刪掉暫存。
  為什麼整份複製、連 `node_modules`：Next.js 16 的 Turbopack 不收指到專案外面的 `node_modules` 捷徑（量到「Symlink … points out of the filesystem root」）；
  複製用 `COPYFILE_FICLONE`，mac 的 APFS 上約 2 秒，不支援的檔案系統會退回一般複製（Windows 上可能要幾十秒、暫存多約 340 MB）。
  所以**前端不必為測試加任何環境變數或設定**（不用 `SITE_CONTENT_DIR` 之類）；讀內容只要用 `process.cwd()` 底下的 `content/`。
- **Playwright**（F1.2 亮色系統、F1.5 實際請求與 CLS）：不加進網站的套件。用 GPTPlugins 的 `clipper/node_modules/playwright`（從 `homepage/site/` 往上兩層找），
  或設 `SITE_PLAYWRIGHT=<那個資料夾>`。找不到就 skip 並寫原因。
  **git worktree 的 `clipper/` 沒有 `node_modules`**，要設 `SITE_PLAYWRIGHT=<GPTPlugins>/clipper/node_modules/playwright`（主資料夾那一份）；
  搬進公開 repo 之後也要自己設。瀏覽器用 Playwright 快取裡的 Chromium（`~/Library/Caches/ms-playwright`）。
- **靜態伺服器**：`server.js`，把 `out/` 當網站根目錄（`/zh/` → `zh/index.html`、找不到回 404 狀態碼＋`404.html`），照 Cloudflare Pages 的主要規則（它另外會把 `/x/index.html` 轉到 `/x/`，這裡不轉）。
  量 CLS 時先扣住 `.woff2`，等第一次畫面用回退字型畫出來（兩個畫格）才放。
  原本是固定晚 1 秒＋用 `/Google Sans Flex/` 找字型：回退字型 `Google Sans Flex Fallback`（`local()`，很快就載好）也被算進「已經載好」，整套一起跑時偶爾誤判紅（量到 5 次裡 1 次）；
  改成扣住字型、只認網頁字型本身之後，整套連跑 5 次都穩，拿掉回退字型時英文 390 照樣紅（0.0214）。只收 GET／HEAD，其他方法回 405。

## 為什麼這樣寫

**為什麼 Playwright 的條目不放在 `before()`**：量過 —— 用 `--test-name-pattern` 把整支檔篩掉時，node:test 不等 async 的 `before` 跑完就跑 `after`，
瀏覽器開了沒人關，整個測試卡住不結束。所以改成第一條要用的時候才開（`helpers.js` 的 `browserSession`），F1.3 的另外 build 也是第一次用到才做。

**測試裡的捲動一律用 `behavior: 'instant'`**（`scrollIntoView({ block, behavior: 'instant' })`、`scrollTo({ top, behavior: 'instant' })`，不用 Playwright 的 `scrollIntoViewIfNeeded`）：
網站開了平滑捲動（`html { scroll-behavior: smooth }`），頁面變長之後捲到 07 要四百多毫秒，捲完之前量會量到還沒長出來（量過：中文 1440 關 JS，0、200ms 七行全 0，1000ms 才全部 1）。
量「捲到哪長到哪」的那條（F5.1）本來就一步一步 instant 捲過去再量，不受影響。

**開頁與找東西的上限一律 15 秒**（`page.setDefaultTimeout(15000)`，2026-10-03 從 5 秒放寬）：整套一起跑時機器很忙，5 秒在開頁時就逾時過（`page.goto: Timeout 5000ms exceeded`）。
只會讓「找不到」那種紅晚一點出來，不會放過真的錯。量「多久之內要到」的時間窗（例如動態 A 的 1 秒、已複製的 3.2 秒）另外寫在各條裡，沒有跟著放寬；
動態的每一幀紀錄（`motion.test.js`）從開頁記到 30 秒（原本 8 秒，忙的時候捲到 04 時已經不記了）。

## 案例對應（哪個案例在哪支檔）

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F1.1能 build | `build-output.test.js` | `scripts.build` 跑 `next build`；dependencies 有 next、react、react-dom；有 `package-lock.json` 而且 `packages[""]` 的 dependencies 跟 package.json 一樣（`npm ci` 才裝得起來）；next.config 載入後 `output: 'export'`、`trailingSlash: true`、`images.unoptimized: true`；out/ 有 zh、en、ja 的 index.html、index.html、404.html、_headers（跟 public/_headers 位元組相同），沒有 `out/zh.html`；沒有 Tailwind（設定檔、package.json、CSS 原始檔、build 出來的 `--tw-`） |
| F1.1 | `build-output.test.js` | JavaScript 不用 TypeScript（app/、components/ 沒有 .ts/.tsx、沒有 tsconfig.json）；app/、components/ 在；lib/ 沒有 .jsx、不 import react/next（前端程式不放 lib/） |
| F1.1Node 20／21 | `build-output.test.js` | 設 `SITE_ALT_NODE` 才跑：用那支 node 在暫存複本 build，六個檔都在。2026-10-02 用參考實作在 Node 21.6.2 跑過是綠的 |
| F1.2 | `html-lang.test.js` | 送出來的 HTML：zh `lang="zh-Hant"`、en `en`、ja `ja`、`/` `en`；四頁 `<html data-theme="dark">`。Playwright `colorScheme: 'light'`（關 JS 一次、開 JS 一次）：body（透明就看 html）背景亮度 < 0.1；防呆先確認 `prefers-color-scheme: light` 成立 |
| F1.3 | `content-broken.test.js` | 用 `fixtures/content-bad/` 另外 build：結束碼 0、三語頁都在；每頁 `data-state="unreadable"` 的元素至少有寫壞的地方那麼多（zh ≥ 4、en ≥ 2、ja ≥ 3，數字由 `lib/content.js` 讀同一份 fixture 算）；好的版本號、item（bindTail 後）、公告標題（bindTail 後）、連結 href 都在（更新紀錄只算 `app/site.js` 的 `CHANGELOG_FROM` 那一版以後的，比它舊的 1.0.3 不算要出現；版本比較測試自己算，不借網站的 `listed()`）；reason 不在畫面看得到的字裡；真的 content/ 沒寫壞時真的 out/ 一個 unreadable 都沒有 |
| F1.3 | `content-broken.test.js` | reason 不隨網頁送到瀏覽器：out/ 的 `.html`、`.txt`（RSC 資料）與 `out/_next/` 的 `.js` 都沒有 fixture 的任何一個 reason（比對每個 reason 開頭到第一個會被跳脫的字 `" \ < > &` 為止、最多 24 字；先還原 `\uXXXX`）。把整個 readContent 結果交給 client 元件會紅 |
| F1.4 | `client-bundle.test.js`、`content-broken.test.js` | `out/_next/` 的每支 .js（先還原 `\uXXXX`）沒有 lib/ 九個特徵字串（防呆：特徵要還在 lib/ 的程式裡）；build 出來的 CSS 有選擇器剛好是 `.nw`、`white-space: nowrap`；zh、ja 頁有 `<span class="nw">`；公告標題含 `< & "`：HTML 裡剛好是 `bindTail(標題, 語言)`、沒有 `&amp;lt;` 之類跳脫兩次的字、沒有未跳脫的原文 |
| F1.5靜態 | `fonts-styles.test.js` | out/fonts/ 兩個 woff2＋fonts.css 跟 public/fonts/ 位元組相同、合計 ≤ 153600；out/ 的字型檔剛好是那兩個；用 url() 的 @font-face 都指到它們、都有 unicode-range、不碰中日文；`app/styles/nox/` 每支跟 `clipper/css` 同名檔位元組相同（至少四支：tokens.color、tokens.type、tokens.scale、base）；網站自己的 CSS 宣告值沒有 `#色碼`、`rgb(數字`、`hsl(數字` 等；`[hidden]{display:none!important}`；坑 9 靜態掃描；三語頁與 404 剛好一條 preload GoogleSansFlex-site.woff2（as="font"、crossorigin、從根目錄算），「/」零條（2026-10-04 從「至少一條」收緊：React 19 會把 JSX 畫的預載再提一份，變成兩條；放回 4cadd79 的 FontLinks 紅在「要剛好 1 條，得到 2」，「/」多放一條紅在「要剛好 0 條」）；有 `src: local()`＋`size-adjust` 的 @font-face |
| F1.5 瀏覽器 | `fonts-browser.test.js` | zh、en、ja 實際的字型請求只有 /fonts/ 那兩個、每個最多一次；ja 1440×900 與 en 390×844、字型扣到第一次畫面之後才放，CLS ≤ 0.01（英文 390 是骨架上就分得出有沒有回退字型的那個：有 0.00009、拿掉 0.0211）（防呆：放字型之前字型還沒載好、等完之後已載好） |
| F1.6 | —— | 另外一組（字串表），不在這裡 |
| F1.7 | `../tests/structure-f1.test.js`、`../tests/helpers.js`、`../tests/structure-b2～b6.test.js` | 見 `tests/` 的跑法；白名單 next、react、react-dom，devDependencies 等其他種類沒有或空的；scripts/ 每支只 import `node:` 與相對路徑；lib/ 由原本的 B1.8 守 |
| F1.8 | `js-budget.test.js` | `/zh/` 的 `<script src>` 與 `<link rel="preload" as="script">`／`modulepreload` 指到的 `/_next/` 檔，gzip 後合計 < 300 KB（印在 diagnostic）；README.md 有一段同時寫「/zh/」「JS」「gzip」「數字＋KB」，數字跟量到的差在兩倍內、≤ 300 KB |
| F1.9 | `html-lang.test.js` | out/404.html 與 out/index.html 的 `<html lang>` 是 en、zh-Hant、ja 其中一個，也有 data-theme="dark" |
| F1.9 | `html-lang.test.js` | 404 照 `/` 的寫法，分三步、訊息寫「第 N 步」：① `<html lang="en">`；② `<body>` 裡有元素標 `lang="zh-Hant"`；③ 有元素標 `lang="ja"`。前端若回報 Next.js 做不到，看是哪一步紅 |
| F1.10 | 這份 README、`shots.test.js` | `npm test` 與 `npm run test:site` 都要綠；前端測試讀 build 出來的 HTML，Playwright 不加進網站套件。截圖工具（`clipper/scripts/shots`）用 `--site <out 的絕對路徑> --page "/{lang}/" --widths all` 拍三語 × 十二種寬度：結束碼 0、張數對、`verify.mjs` 通過（含任何一種寬度都不橫捲）。在暫存的 clipper 複本裡拍（不清掉專案的 shots/now/）；找不到有 `@playwright/test` 的 node_modules（`SHOTS_TEST_NODE_MODULES`、這裡的 clipper/node_modules、git 主資料夾的 clipper/node_modules）就 skip，搬進公開 repo 之後沒有 clipper/ 也 skip |

## 介面約定（前端照這個做，測試才量得到）

- 讀內容在伺服器端（server component 或產生網頁時的函式），用 `lib/content.js` 的 `readContent(path.join(process.cwd(), 'content'))` 這類寫法；不要在 client 元件 import `lib/`。
- 寫壞的一條（`ok: false` 的版本、item、公告、連結）與整區讀不到（`ok: false` 的位置）各畫一個元素，帶固定屬性 **`data-state="unreadable"`**；字由字串表決定，測試不綁字。`reason` 不畫在畫面上。
- 使用者寫的字（更新紀錄每一條的 text、公告標題）用 `bindTail(字, 語言)` 的輸出，`dangerouslySetInnerHTML` 原樣放，不再跳脫。版本號照原樣放。社群連結的 `href` 是 `links.md` 的網址原樣。
- 骨架階段 fixture 只有每語 2 版、2 則公告、3 個連結，全部都要畫出來（比「最新兩版／三則」少，不受收合影響）。
- 設計系統的複本放 **`app/styles/nox/`**，檔名跟 `clipper/css` 一樣、位元組相同；網站自己的 CSS 放 `app/`、`components/` 其他地方（CSS Modules 叫 `*.module.css`）。
- 全域 CSS 要有 `[hidden] { display: none !important; }` 與 `.nw { white-space: nowrap; }`（CSS Module 裡寫 `:global(.nw)`）。
- 字型只用 `public/fonts/`（`fonts.css` 怎麼接進來前端定：`<link>` 或 import 都可以，build 出來的 `out/fonts/` 要在）；不用 `next/font`、不加中日文字型。
  三語頁 `<head>` 預載 `/fonts/GoogleSansFlex-site.woff2`（`as="font"`、`crossOrigin`）；回退字型用 `src: local(…)`＋`size-adjust` 的 @font-face。
- `<html>` 的 `lang` 與 `data-theme="dark"` 寫在 layout 的 JSX 裡（送出來的 HTML 就有），不用腳本改。
- README.md 記第一次打開的 JS（見 F1.8）。

## 放回錯誤驗證（2026-10-02，在暫存資料夾的參考實作上做，不交付）

寫測試時前端還沒做：當時 `node tests-site/run.mjs` 每一條紅的原因都是「package.json 沒有 build 指令，所以沒有 out/」「沒有 node_modules/next」或缺前端的檔
（scripts.build、next.config.js、app/、app/styles/nox/、網站自己的 CSS），沒有語法錯誤或找不到模組 —— 紅在該紅的那一步。

參考實作：把 `homepage/site/` 複製到暫存資料夾、真的 `npm install next@16.3.8 react@19.3.0 react-dom@19.3.0`，手寫最小的 app/、components/（三語頁 `[lang]`＋`generateStaticParams`＋`dynamicParams=false`、`/` 與 404 各一個根版面、`experimental.globalNotFound`）。
整套 `npm run test:site` 全綠（skip 兩條：`SITE_ALT_NODE` 沒設、F1.10 那時截圖工具還沒有 `--site`），`SITE_ALT_NODE`＝Node 21.6.2 也綠；後端 `npm test` 在有 dependencies 的 package.json 上全綠。一次放回一種錯：

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| zh 頁 `lang` 寫成 `zh-TW` | F1.2 三語頁與 / 的 `<html lang>` |
| 三語頁拿掉 `data-theme="dark"` | F1.2 data-theme；F1.2 亮色系統關 JS／開 JS 兩條：「BODY 的背景是 rgb(255, 255, 255)（亮度 1.000），要是暗色」 |
| CSS Module 裡寫死 `color: #e0e0e0` | F1.5 色碼：「components/Section.module.css：.title 的 color 寫死了色碼（#e0e0e0）」 |
| client 元件 import `lib/bind-tail.js` | F1.4 瀏覽器端：「out/_next/static/chunks/….js 裡有 lib/bind-tail.js 的『bindTail 的 lang 只收』」 |
| 多接一個中文字型（`/cjk/glow.woff2`，unicode-range U+4E00-9FFF，放進 --font-sans） | F1.5 字型檔只有兩個（@font-face 指到 /cjk/glow.woff2）；F1.5 實際下載 /zh/、/ja/（下載了不該下載的字型） |
| bindTail 的輸出當文字放（React 再跳脫一次） | F1.3 其餘條目照常（找不到 `專題第一次建立有時沒<span class="nw">建起來</span>`）；F1.4 公告標題 |
| 把整個 readContent 結果交給 client 元件（`<Dump content={content} />`，畫面上什麼都沒顯示） | F1.3 reason 不隨網頁送到瀏覽器：「out/en/__next.$d$lang.__PAGE__.txt 裡有 reason『版本底下每一條要以「- 」開頭…』」 |
| 404 日文那段沒標 lang | F1.9：「第 3 步：out/404.html 的 <body> 裡要有一個元素標 lang="ja"」 |
| 404 整頁標 zh-Hant | F1.9 第 1 步 |
| 寫壞的條目靜靜略過（不畫讀不到） | F1.3：「/zh/：寫壞了 4 個地方…只找到 0 個 data-state="unreadable"」 |
| 拿掉 `[hidden]`、`.nw` 放進 CSS Module 沒加 :global | F1.5 [hidden]；F1.4 全域的 .nw |
| 有 nowrap 的 CSS Module 用 `grid-template-columns: auto 1fr` | F1.5 坑 9 |
| 預載字型少了 crossOrigin | F1.5 預載（要有 crossorigin）；F1.5 實際下載 zh、en、ja（同一個字型檔下載了兩次） |
| 兩個回退字型整段拿掉 | F1.5 回退字型同寬；F1.5 CLS /en/ 390（0.0211）。/ja/ 1440 只到 0.0033，骨架上抓不到 |
| 回退字型 `size-adjust: 200%` | F1.5 CLS：「/ja/ 1440 的 CLS 是 0.0263，要 ≤ 0.01」 |
| 回退字型拿掉 size-adjust | F1.5 回退字型同寬（CLS 那條在骨架上量不出來：骨架的字少，size-adjust 100% 與沒寫一樣） |
| 設計系統複本 base.css 多一行註解 | F1.5 設計系統的複本 |
| package.json 加 `tailwindcss` | B2.6、B3.3、B4.2、B5、B6.5、F1.7 白名單六條 |
| devDependencies 加 eslint | F1.7 白名單 |
| lib/links.js 結尾 `import 'react'` | B1.8 lib/ 只用 Node 內建 |
| scripts/test.mjs `import 'next'` | F1.7 scripts/ |

## 已知限制（沒有測試，或量得不完整）

- F1.3 的「讀不到」只量個數「至少」幾個，不量在哪一區（沒有區的標記）；同一則畫兩次（公告條與 11 區）會多算，所以用「至少」。
- F1.3 的 reason 比對每個 reason 的開頭一段；只送出 reason 後半段（例如截斷過）抓不到。
- F1.4 的特徵字串是挑的九個；lib/ 新加的模組被打包到瀏覽器、而它的字串不在清單裡，抓不到。清單在 `client-bundle.test.js` 開頭。
- F1.5 的坑 9 是靜態掃描、以「一支 CSS 檔」為單位：同一支檔有 nowrap 就檢查它所有的 grid-template-columns（可能比實際嚴）；`grid-template`、`grid` 簡寫不看；真的撐不撐破由 F3.9 的十二種寬度 × 三語量（目前量導覽列與公告條）。
- F1.5 的色碼只掃網站自己的 CSS；JS 裡寫死的 style（`style={{ color: '#fff' }}`）不掃。
- F1.5 的 CLS 只量日文 1440 與英文 390、整頁加總；骨架的內容少，日文 1440 那條要等首屏按鈕做好才真的有分量。
- F1.8 只算 HTML 裡列出來的 JS（第一次打開會載的）；之後動態載入的不算。gzip 用 Node 預設等級，跟 Cloudflare Pages 實際送的大小可能差幾 %。
- F1.1 的 `npm ci` 沒有在測試裡跑（要網路）：量的是 `package-lock.json` 跟 package.json 對得上。
- 暫存複本 build 在 Windows 上會慢（一般複製 node_modules），沒量。

## 字串表接進網站（F1b）

`strings/{zh,en,ja}.json` 是設計師的字串表（帶斷行標記，規則在 `strings/README.md`）；`lib/segments.js` 的 `parseSegments` 把一條字轉成元素樹。
這一組量的是網站怎麼用它們。

### 介面約定（前端照這個做）

- **取字函式 `app/strings.js`**：匯出 `getString(lang, id)`（`lang` 是 `'zh' | 'en' | 'ja'`），回 `strings/<lang>.json` 那一條的**原字**（帶標記，交給 `<Seg>`）。
  - 純 Node 載得起來（不用 JSX）；讀 `path.join(process.cwd(), 'strings')`，只在產生網頁時、伺服器端跑；client 元件不 import 它、也不 import `strings/*.json`（要字就從 props 拿）。
  - 取不存在的 id、不認得的語言：丟 `Error`，訊息有那個 id 與語言（`zh`／`en`／`ja` 或 中文／英文／日文）。不回空字串、不回 undefined。
  - **第一次用到時整份先驗過**：三語的 id 要完全一樣、每一條都要 `parseSegments` 得過；不過就丟 `Error`，訊息有 id 與語言。所以字串表寫壞時 build 一定失敗，哪怕那一條還沒有頁面用到。
- **`<Seg>`：`components/Seg/Seg.js`**，預設匯出。props：`text`（字串表的一條原字）、`values`（選填，`{ url, nn, 章名 }`，照 `parseSegments` 的代入值）。
  - 用 `parseSegments(text, values)` 的元素樹 `createElement` 出來（`Fragment` 包著）；字串節點交給 React 跳脫。
  - 純 Node 載得起來：不用 JSX、不 import CSS。不能用 `dangerouslySetInnerHTML`；壞標記照樣丟錯（不吞）。
  - 結尾箭頭圖示、`hero.mobile.text` 的 `<b>`、章名與摘要的規則不在 `<Seg>` 裡（`strings/README.md` 另外寫的那幾節）。
- **標記的樣式寫在全域 CSS**（`app/styles/global.css` 或它 import 的檔；CSS Modules 會把 class 名稱換掉）：`.u`（`display: inline-block; max-width: 100%`）、`.nw`、`.clamp`、`.brk`、`.brk--l`、`.brk--r`、
  `@media (min-width: 320px) { .nw-wide { white-space: nowrap } }`、`@media (max-width: 319px) { .brk-narrow::after { content: "\200B" } }`、`.forai__l1`、`.forai__l2`。
- **使用者寫的內容**（公告標題與內文、更新紀錄每一條）不走 `<Seg>`，照舊走 `bindTail` 的輸出＋`dangerouslySetInnerHTML`。app/、components/ 裡的 `dangerouslySetInnerHTML` 只能放 `bindTail(…)`。
- **骨架的字從字串表取**：三語頁 `root.name`（h1）、`news.title`、`changelog.title`（畫面字）；`author.socials`（社群那一排 `<ul>` 的 `aria-label`）、`social.<代號>`（每一顆圖示鈕的 `aria-label` 與 `title`；定稿的 14 是一排只有圖示的圓鈕，這兩種字不在畫面上）；`/` 的英文 `root.name` 與三語的 `root.pick`（各自標 lang）；
  404 的三語 `404.title`、`404.body`、`404.home` 與 `<title>` 的 `404.meta.title`；「讀不到」的 `state.unreadable`（單條）與 `state.unreadable.section`（公告、更新紀錄整區讀不到）。程式裡不再寫死這些字。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F1b.1 `<Seg>` | `seg.test.js` | 純 Node 載得起來、用 `parseSegments`、自己沒有 `dangerouslySetInnerHTML`；三語每一條帶標記的字（代入值放了 `<script>`、`&`、`"`）用 `react-dom/server` 的 `renderToStaticMarkup` 轉出來，跟照 `strings/README.md` 8 步轉的 HTML 一樣（`tests/b7-fixture.js` 的 `readmeHtml`；`<wbr/>`＝`<wbr>`、`&#x27;`＝`'`）；沒標記的字原樣；代入值被跳脫、裡面的標記不轉；`forai.title` 一個 l1 一個 l2、中日文中間沒東西、英文一個空白；壞標記丟錯；app/、components/ 的 `dangerouslySetInnerHTML` 只放 `bindTail(…)`、不用 `renderToString`；build 出來的 CSS 有標記的樣式 |
| F1b.1、F1b.2 壞的字串表 | `strings-build.test.js` | 在暫存複本改壞 `strings/*.json` 再 build（專案的 `strings/` 不動），四種都要 build 失敗、輸出講出 id 與語言：ja 少了 `news.title`；三語都少了 `news.title`；zh 的 `news.title` 改成「«最新公告」；zh 的 `hero.title` 少一個 `}`（還沒有頁面用到） |
| F1b.2 取字函式 | `strings.test.js` | `getString` 回原字；取不存在的 id、`fr`、空 id 丟錯（訊息有 id 與語言）；`out/_next/` 的 `.js` 沒有字串表的原字（帶標記的每一條、`"<id>":` 這種 JSON 鍵） |
| F1b.2 使用者內容 | `content-broken.test.js` | 寫壞內容的 fixture 多一則標題含 `« { \| ⟨` 的公告（zh、en）：HTML 裡是 `bindTail(標題)` 的輸出（標記字元照原字），不是 `<Seg>` 轉出來的 |
| F1b.3 占位字 | `strings-placeholders.test.js`、`content-broken.test.js` | 三語頁、`/`、404 看得到字串表的字（去掉標記比）；`/` 的每個 `root.pick` 在標了那個 lang 的元素裡；404 的 `<title>`；社群：14 那一排 `<ul aria-label>` 是那一語的 `author.socials`，每一排（14、☰ 選單、頁尾）裡連到 links.md 好連結的 `<a>` 的 `aria-label` 與 `title` 是那一語的 `social.<代號>`，英日頁的 aria-label／title 不准出現跟它不一樣的中文字；「讀不到」分兩條：整區讀不到（公告、更新紀錄整支讀不到或每一條都寫壞，從 readContent 自己算哪一區）那一區剛好一個、字＝`state.unreadable.section`，其他每一個＝`state.unreadable`（三語）；app/、components/ 的程式（去掉註解）沒有剛好等於這些字的引號字串或 JSX 字（「X」太短不量） |

現在（前端還沒接字串表）紅在：缺 `components/Seg/Seg.js`、缺 `app/strings.js`、build 出來的 CSS 少了標記的樣式、壞的字串表四種都 build 成功、程式裡還有寫死的占位字。
「畫面上的字是字串表的字」「讀不到的字」「使用者內容照原字」「client JS 沒有字串表」「`dangerouslySetInnerHTML` 只放 bindTail」這幾條現在就綠：骨架的占位字本來就照字串表抄、也還沒有人把字串表送到瀏覽器，它們守的是接上之後別壞掉。

### 放回錯誤驗證（2026-10-02，在暫存複本寫最小的參考實作：`<Seg>`、`app/strings.js`、換掉占位字、全域 CSS 補樣式；整套全綠後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| `<Seg>` 自己把元素樹拼成 HTML 字串、用 `dangerouslySetInnerHTML` 放 | F1b.1 載入那條（「不能用 dangerouslySetInnerHTML」）、同構、原樣、代入值（「zh mail.self.body：代入值裡的 <script>、<b> 變成了真的標籤」）、forai.title、dangerouslySetInnerHTML 只放 bindTail |
| 取字函式缺 id 回空字串（也不比三語） | F1b.2 取不存在的 id（「要丟 Error，得到 ""」）；壞的字串表 a、b（「build 要失敗，卻成功了」） |
| client 元件 import `strings/zh.json` | F1b.2 字串表只在伺服器端讀（「out/_next/static/chunks/….js 裡有 zh hero.kicker 的原字」） |
| `Unreadable` 改回寫死三語的「讀不到」 | F1b.3 前端程式裡沒有寫死占位字 |
| `<Seg>` 漏掉 `¦`（brk-narrow 不畫） | F1b.1 同構 |
| 公告標題交給 `<Seg>` | F1b.2 使用者內容（「公告標題『標記«不轉»{也}\|照原字⟨顯示⟩』要照原字」） |
| 取字函式只在用到時驗、不整份先驗 | 壞的字串表 d（「build 要失敗，卻成功了」） |
| `.nw-wide` 沒包 `@media (min-width: 320px)` | F1b.1 build 出來的 CSS |
| （2026-10-04，在 4-f8 前端的暫存複本放回）11 整區讀不到時不給 `whole`（字變成 `state.unreadable`） | F1b.3 整區讀不到（「ja news：…字要是 state.unreadable.section」，實際「この項目は読み込めませんでした」） |
| （同上）`Unreadable` 不管單條整區都用 `state.unreadable.section` | F1b.3 單條讀不到（實際「這一區的內容讀不到」）；整區那條照綠 |
| （同上）社群那一排 `<ul>` 的 `aria-label` 三語都用中文的 `author.socials` | F1b.3 社群（「/en/：14…<ul> 要有 aria-label="Social"」） |
| （同上）社群名字三語都用中文的 `social.<代號>` | F1b.3 社群（「/en/ blog：…aria-label 要是…「Blog」」，實際「部落格」） |
| （同上）`IconButton` 的連結拿掉 `title` | F1b.3 社群（「/zh/ blog：圖示鈕的 title…」，實際 undefined） |
| （同上）12 每一版只畫第一條 | F1.3 其餘條目照常（「/en/：…找不到更新紀錄 1.0.4 的「The button that floated up after selecting text」」） |
| （同上）14 社群讀不到的虛線框拿掉上下內距（回到 5b74044） | F8.6 字到框邊 content-many 三語：每個寬度「badSocial：上下內距 0px，設計稿 10.5」 |
| （同上）14 社群讀不到的虛線框改成固定 `height: 44px` | F8.6 字到框邊 content-many 日文：「280 badSocial：字到框的上下內緣最近 1px」「280 badSocial：排 2 行時框高 44px，設計稿排 2 行是 65」 |

### 已知限制

- 同構只比到 `strings/README.md` 標記表那一層；`hero.mobile.text` 的 `<b>`、結尾箭頭圖示、章名與摘要的綁字規則要等用到它們的區塊做出來再量。
- 斷行結構只量了標記轉成的 DOM；首屏逐行量（每一種寬度實際斷在哪）等首屏做出來、截圖工具能拍 out/ 之後再做。
- 占位字的靜態掃描只認「引號裡的字串剛好等於」或「JSX 的字剛好等於」那一條；拼接出來的（`'讀不' + '到'`）、寫在別的檔案格式裡的抓不到。
- 「client JS 沒有字串表」比的是帶標記的原字與 JSON 鍵；只把沒有標記的幾條字搬進 client 元件（例如寫死的「最新公告」）由占位字那條抓，不在這裡。
- 壞的字串表四次 build 在 Windows 上會比較慢（暫存複本是一般複製），沒量。

## 導覽列、☰ 選單、公告條、共用元件（F3）

設計稿的數字取自 `design/homepage/home.css`（第二批）；規則取自規格書第 5 節的 01、02，第 6、7、8 節。

### 介面約定（前端照這個做，測試才找得到）

測試只認讀屏與使用者看得到的東西：角色、名字（字串表的字）、連結的位址。另外幾個約定：

- **導覽列**：頁面上第一個 `<header>`。裡面第一個連結是記號（`img` 或 `svg`＋名稱 `nav.brand`）；一整排的導覽是 `<nav aria-label="nav.label 的字">`，六個連結照 `nav.features`～`nav.faq` 的順序、連到 `#features #tutorial #devices #news #changelog #faq`；
  語言切換是 `role="group"`、`aria-label` 是 `lang.label`；「加到 Chrome」是字為 `nav.cta` 的連結（主要按鈕）。
- **☰**：導覽列裡的 `<button>`，**`aria-controls` 指到選單的 id**；讀屏名字收著時是 `nav.menu.open`、打開時是 `nav.menu.close`；裡面兩個圖示 `data-icon="list"`、`data-icon="close"`，打開時只看得到 close。
- **選單**（`aria-controls` 指到的那個元素）：裡面有一個同樣 `aria-label` 的 `<nav>`（六個連結）、一個語言切換、一排社群圖示 `<ul aria-label="author.socials 的字">`（每個是連結，`aria-label` 是名字、`href` 是 links.md 的網址）。
  點了選單裡的連結要收起；Esc、點外面會關；不支援 popover（`HTMLElement.prototype` 沒有 `showPopover`）時改用自己的開合，照樣能用。
- **圖示**：一律有 `data-icon="<名字>"`（`list`、`close`、`arrow`、社群代號…），mask 畫法、顏色跟字走。
- **語言切換的每一段**：`<a href="/<語言>/" hreflang="zh-Hant|en|ja" aria-label="lang.<語言>.name 的字">lang.<語言>.short 的字</a>`，目前這個語言那段 `aria-current="page"`。
  點了要把目前的錨點帶過去（`/zh/#faq` → `/ja/#faq`），直接一次導航；記住選的語言：`localStorage` 的 **`collector-lang`**（`'zh'|'en'|'ja'`；存不了照樣切）。
- **主要按鈕的括號**畫在按鈕的 `::before`／`::after`：滑過前透明、在外側（位移寫在 `translate` 或 `transform` 都可以），滑過後透明度 1、位移 0。
- **跳到主要內容**：`<a href="#main">nav.skip 的字</a>`，`<main id="main">`。
- **公告條**：每一條是 `role="region"`、`aria-label` 是 `bulletin.label`；裡面「公告」標籤（字是 `bulletin.label`）、標題連結（`href` 結尾是 `#news`，內容是 `bindTail(標題, 語言)` 的輸出、**箭頭圖示 `data-icon="arrow"` 插在最後一個 `</span>` 前**）、✕ 按鈕（`aria-label` 是 `bulletin.close`）。
  同一時間看得到的最多一條；可以每一則公告各畫一條、只讓挑中的那條看得到（關掉 JS 時看得到產生網頁時挑的那條）。
- **挑哪一則**：`public/bulletin.js`，一般的腳本（沒有 import／export），在 `<head>` 裡用 `<script src="/bulletin.js">` 同步載入（沒有 async、defer、type="module"），
  前面先有 `<meta name="collector-bulletin" content='[{"id","date","pinned"}…]'>`（好的公告、照檔案順序）。腳本在畫面畫出來之前決定，不是內嵌腳本。
  同一支檔在 Node 裡 import 也載得起來，載入後有 **`globalThis.collectorBulletin.pick(entries, now, dismissed)`**：
  `entries` 是公告陣列（壞的 `ok: false` 跳過）、`now` 是 `Date`（用它的當地日期）、`dismissed` 是 id 陣列；回傳該顯示的那一則（陣列裡那個物件）或 `null`。
  規則：留下「30 天內（發布日當天＝第 0 天到第 30 天；發布日在看的人當地日期之後的不算，時區晚的人晚一天看到）」與「置頂」的 → 去掉關掉的 → 日期最新的一則（同一天取前面那則）。
  按 ✕：下一幀整條就不在（不做高度動畫），id 記進 `localStorage` 的 **`collector-bulletin-dismissed`**（id 陣列；存不了就只在這次瀏覽關掉，不報錯）。
- **公告條標題的防孤字**：中日文最後三個字、英文最後兩個字包進 `<span class="nw">`，由 `bindTail` 產生；箭頭用 `bindTail` 的選用參數插在最後一個 `</span>` 裡（後端改，見下面「要等後端的兩條」）。
- **字串表沒有名字的社群代號**：用代號當名字（`hasString`）；`npm run content:check` 要有一條警告講到那個代號。
- **樣式**：中文頁的導覽列、選單、`main` 是 `word-break: keep-all`；**公告條標題也是 `keep-all`，另外加 `overflow-wrap: anywhere`**（設計第三批改的；原本是 `normal`），斷點是後端 `bindTail` 在中文詞界插的 `<wbr>`（日文、英文不插）；日文 `auto-phrase`（公告條標題要在 `lang="ja"` 的元素裡）；英文 `normal`；`:root` 的 `--measure` 是 `25em`。網站自己的 CSS 不用 `--mira-*`。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F3.1 斷點 | `nav.test.js`、`shots.test.js`、`layout.test.js` | 有滑鼠：中文 1024、英日 1280 起一整排（六個連結、語言切換、加到 Chrome 看得到，☰ 看不到），1023／1279 與 390 收成 ☰；十二種寬度三語不橫捲（截圖工具的驗收與 F3.9） |
| F3.2 ☰ 選單 | `nav.test.js` | 390 三語：打開時讀屏名字變 `nav.menu.close`、圖示換成 close；點「公告」收起、網址 `#news`、那一區頂端在導覽列下緣之下；Esc 關、點導覽列上空的地方關；拿掉 `showPopover` 這幾個照樣能開關；844×390（只有手指）捲到底最後一個社群圖示整個在畫面裡、點得到 |
| F3.3 只有手指 | `nav.test.js` | isMobile＋hasTouch（防呆先確認 `(hover: none) and (pointer: coarse)`）390 三語：看不到加到 Chrome；記號、名稱、☰ 看得到 |
| F3.4 挑哪一則（純函式） | `bulletin-pick.test.js` | `pick` 的規則；第 0、30 天在、第 31 天不在；在 `America/Los_Angeles` 與 `Asia/Taipei` 各跑一次（子程序設 `TZ`），用 UTC 日期的寫法會在其中一個時區差一天 |
| F3.4 瀏覽器 | `bulletin.test.js` | 用 `fixtures/content-bulletin/` 另外 build；`<head>` 的 meta 與同步外部腳本；固定時鐘（`page.clock.setFixedTime`）與時區：挑最新、關掉換下一則、全關掉不出現、換新 id 又出現、第 30／31 天、洛杉磯的第 30 天；按 ✕ 下一幀不在、沒有動畫、記住 id、重新整理換下一則；localStorage 擋掉照樣能用；字型擋掉時公告條出現與不出現兩種的 CLS 都是 0 |
| F3.5 公告標題 | `bulletin.test.js` | 三語 × 1280、390、320、280：最後一個 `.nw` 是最後三個字（英文兩個字）、最後一個子元素是 `data-icon="arrow"`、後面沒有字；最後一行不只一個字；看不到 reason |
| F3.6 按鈕與觸控 | `controls.test.js` | 三語 × 320、390、1024、1440（選單打開也量）每個看得到的 a、button ≥ 44×44；Tab 走過導覽列每個都有焦點框；主要按鈕括號：滑過前透明在外側、滑過後在定位；沒設減少動態時括號透明度的轉場 ≥ 100ms（在滑），設了減少動態時轉場 ≤ 1ms、滑過之後兩個畫格已經到位、底色已變（原本量「滑過 50ms 時」，機器忙時誤紅過，2026-10-03 改） |
| F3.7 社群圖示一排 | `bulletin.test.js` | 選單裡只有好的三個（寫壞的跳過、沒有「讀不到」）、照檔案順序、mastodon 用代號當名字；content:check 的警告講到 mastodon；14 區是 todo |
| F3.8 語言切換 | `controls.test.js` | 每一段的名字、字、hreflang、aria-current；`/zh/#faq` 點「日」→ `/ja/#faq`、只走一次導航、`collector-lang` 是 `ja`；localStorage 擋掉照樣切 |
| F3.9 通用 | `layout.test.js`、`shots.test.js` | 十二種寬度 × 三語（320、390 另外量只有手指）：不橫捲、導覽列與公告條不重疊、按鈕裡的字不跑出框、選單不橫捲；減少動態時開頁與開選單沒有動畫在跑；關掉 JS 看得到導覽連結與公告條標題；CSS 不用 `--mira-*`；HTML 沒有自己寫的內嵌腳本（只准 JSON-LD 與 Next.js 的 `self.__next_f`）；照設計稿的數字（導覽列 72／64、公告條 60、按鈕與語言切換 44、☰ 44×44、選單連結 52、內容左緣 16／32／130、導覽列釘住、公告條跟著捲走） |
| F3.10 換行與字 | `layout.test.js`、`bulletin.test.js` | 算出來的 `word-break`（中文公告條標題 `keep-all`＋`overflow-wrap: anywhere`、日文在 `lang="ja"` 裡）與 `--measure`；公告條標題的 `<wbr>`：中文有、日文英文沒有（`content/` 真的內容）；導覽列與公告條的字逐字是字串表的；公告標題的防孤字（F3.5） |
| F3.11 公告條照設計稿第三批（2026-10-03 加） | `bulletin-layout.test.js`、`fixtures/design-6511462.json` | 手機（三語 × 280、320、360、375、390、430）：「公告」標籤與 ✕ 上排、標題下排（頂在兩者之下、左緣對齊標籤），整條高與三樣東西的 [x, y, 寬, 高] 跟設計稿差 ≤ 2px，✕ 44×44，標籤與 ✕ 不重疊、✕ 不壓到標題；桌機（三語 × 640、768、1024、1280、1440）：整條高與三樣東西的位置大小跟設計稿差 ≤ 2px（標題不限 25em，768 起一行 61 高）；只有手指 360×780 的日文：手指框主要按鈕的下緣跟設計稿差 ≤ 2px（737）。F3.9 的「至少 60、左緣」不動 |
| F3.12 公告條 ✕ 保持透明框（2026-10-03 加） | `bulletin-layout.test.js` | 三語 × 390：有滑鼠強制 `:hover`、只有手指強制 `:active`（Chrome 開發者協定）時，公告條 ✕ 的框是透明的（沒有框、寬 0 或透明）；同一個寬度的 ☰ 照樣是螢光綠框。設計稿 ba016e9 的 `.iconbtn--ghost:is(:hover, :active…) { border-color: transparent }` |

現在（前端還沒做導覽列與公告條）紅在：找不到 ☰（`aria-controls`）、找不到導覽連結與語言切換、缺 `public/bulletin.js`、`<head>` 沒有 `collector-bulletin`、選單打不開、content:check 沒有警告。
現在就綠的四條（不靠還沒做的東西，守的是做完之後別壞掉）：減少動態沒有動畫、CSS 不用 `--mira-*`、沒有自己寫的內嵌腳本、截圖工具拍 out/。

### 放回錯誤驗證（2026-10-02，在暫存複本寫最小的參考實作：照設計稿的 01、02 與共用元件、`public/bulletin.js`、選單的行為；整套全綠後一次放回一種錯）

參考實作另外做了兩件後端的事才全綠：`bindTail` 的英文綁最後兩個字、可以在最後一個 `</span>` 前插一段 HTML（選用參數）；content:check 對字串表沒有名字的社群代號發警告。

**要等後端的兩條**：這兩件由後端做（`bindTail` 的選用參數與英文綁兩個字、content:check 的警告，連同後端自己的測試一起改），合進來之前，前端即使做完，
F3.5 的英文那條（`.nw` 要是最後兩個字、箭頭在 `.nw` 裡）與 F3.7 的 content:check 那條仍是紅的；其餘不受影響。

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 未來日期也顯示（只看「30 天內」不看「已經發布」） | F3.4 挑：「發布日前一天 23:59：還沒到，不顯示」、「10-15：10-20 還沒到 → 顯示 10-05」、兩個時區的「發布前一天 23:30」；瀏覽器：台北 10-15、洛杉磯當地 10-19 |
| 公告挑選用 UTC 日期 | F3.4 挑：第 0 天（「發布日當天 00:00」）、洛杉磯「第 30 天晚上 20:00 要出現」、台北「第 31 天清晨 05:00 要不出現」；瀏覽器：台北第 31 天 |
| 取檔案最上面那則（不比日期） | F3.4 挑：「要取日期最新的 10-20（不是檔案最上面的 10-05）」；瀏覽器的五條 |
| 挑選改成畫完才做（腳本改成 defer、放到 body） | F3.4 瀏覽器：「<head> 裡要有一支 <script src=…/bulletin.js>」；CLS：「全關掉、不出現：CLS 要是 0，得到 0.0667」 |
| ✕ 收起時做高度動畫 | F3.4 瀏覽器：「按 ✕ 之後下一幀整條要不在…得到 {"height":61,"anims":1}」 |
| 選單連結點了不收起 | F3.2：「點了連結要收起選單」 |
| ☰ 的讀屏名字不跟著換 | F3.2：「打開後 ☰ 的讀屏名字要變成 nav.menu.close「Close menu」」 |
| 英日也在 1024 就排成一整排 | F3.1：「en 1279：收成 ☰ 時要看得到 ☰」、ja 同 |
| 選單的社群一排把寫壞的那條畫成「讀不到」 | F3.7：「選單裡不顯示『讀不到』」 |
| 只有手指時照樣放加到 Chrome | F3.3：「只有手指時不放『Chrome に追加』」 |
| 語言切換不帶錨點 | F3.8：「錨點要跟著帶過去（/ja/#faq）」（兩條） |
| layout 裡加一段內嵌腳本 | F3.9：「自己寫的程式要放外部 .js」 |
| 拿掉 scroll-padding-top | F3.2：「#news 的頂端（-0.5）被導覽列（下緣 65.0）蓋住了」 |
| 公告條手機排法改回一排（標籤、標題、✕ 排一排，2026-10-03） | F3.11 手機三語：「zh 280：標題要在下排」「整條高 82.0，設計稿 106」等；日文 360×780：「主要按鈕的下緣 761.5，設計稿 736.5」 |
| 公告 ✕ 拿掉「滑過、按下保持透明框」那兩條（2026-10-03） | F3.12 三語：「✕ 強制 :hover 時框是 rgb(224, 255, 152)，要透明」「✕ 強制 :active 時框是 rgb(224, 255, 152)」；F4b.4：「公告 ✕：按下時 border 網站 rgb(224, 255, 152)、設計稿 -」 |
| 桌機標題限 25em（2026-10-03） | F3.11 桌機三語：「zh 640：標題 [x,y,寬,高] 網站 92,70.8,350,48.5，設計稿 92,70.8,456,48.5」、✕ 跟著往左 |

### 已知限制

- 「點外面會關」量的是點導覽列上空的地方；選單蓋滿導覽列以下整個畫面，畫面上沒有別的「外面」。
- 不支援 popover 的模擬只拿掉 JS 的方法：Chromium 自己照樣認 `popovertarget` 與 `[popover]` 的樣式，量得到「程式沒有因為少了方法而壞掉」，量不到真的舊瀏覽器長什麼樣子。
- 「跳過去不閃」量的是只走一次導航（中間沒有別的頁）；新頁第一眼是暗色由 F1.2 量。
- 「沒有字壓到別的東西」只量導覽列一排（記號、導覽連結、語言切換、加到 Chrome、☰）與公告條（標籤、標題、✕）的外框有沒有交疊；字的實際筆畫、選單裡的排版沒量。
- 整體留白與文案斷行照 CLAUDE.md：量了換行樣式（word-break、--measure）與照設計稿的幾個數字；「每一行是不是一個語意單位」要人看截圖（截圖工具那條拍出來的圖）。
- 公告條的 CLS 0 是把字型擋掉量的（字型換上來的那一下由 F1.5 管）。
- 14 區與頁尾的社群一排還沒做：寫壞的那條在 14 區顯示「讀不到」、頁尾跳過，是 todo。


## 03 首屏、04 能用在哪裡（含動態 A、B、D）與兩個小修（F4）

**2026-10-03 換成設計稿第四批（3f2310c）**：逐行表 `fixtures/design-lines-03-04.json` 重量（只有大標變了：中文 280、320「把網頁收成 AI／讀得懂的素材庫」，英文 280「Turn the／web into／material your AI／can read」）；
公告條、手指框、連結底線的位置數字搬到 `fixtures/design-6511462.json`（重量過，跟第三批一樣），另外多了手指「按下」的樣子（`press`）與 04 三格離分隔線的距離（`zeros`）。檔名跟著設計稿的 commit（3f2310c 之上的修正 ba016e9：04 三格依字寬分欄、公告 ✕ 滑過與按下保持透明框）。之後 07 的樹在 350fdf4 又改了一次，對照資料用那一版重量（其他區的數字都一樣），檔名跟著換成 `design-607a536.json`；09 在 6511462 又改了一次，同樣重量、檔名換成 `design-6511462.json`（位置那一份的數字一個都沒變）。
「已複製」停的時間從約 2 秒改成 `--dur-breathe`（3.2 秒，第四批定稿）；手指沒有「滑過」，出口連結改量「按下」。宣傳片的暫停鍵與平板、觸控的修正是這一節最後的 F4b。

設計稿第三批（2026-10-03 已 commit、設計審查第三輪「可以交」）：`design/homepage/{zh,en,ja}/index.html`、`home.css`、`動態.md`、`motion.js`、`notes/4-1.md`、`notes/4-2.md`、`notes/4-3.md`。規格書第 5 節的 03、04，第 8、9 節。
03、04 的長相、A、B、D 在第三批沒有變（逐行表核對過）；第三批改到 03 的是英文 `hero.mobile.text`／`hero.mobile.bold`（句點併進粗體）、日文 `hero.mobile.text`、手指框說明的一行最寬（`--measure`），新增 `hero.video.alt` 與 `share.fallback`。

### 介面約定（前端照這個做）

- **兩區**：`<section data-section="hero">`、`<section data-section="where">`。
- **字串表的每一段字畫在帶 `data-id="<字串表的 id>"` 的元素裡**（裡面用 `<Seg>`）：`hero.kicker`、`hero.title`（兩個都在 `<h1>` 裡）、`hero.sub`、`hero.cta`、`hero.watch`、`hero.meta.free`、`hero.meta.os`、
  `hero.meta.devices`、`hero.mobile.text`、`hero.share`、`hero.mail`、`hero.pc`、`hero.video.label`、`hero.video.desc`、`where.label`、`where.chatgpt`…`where.web`、`zeros.cap`、`zeros.server`…`zeros.tracking`。
  `data-id` 的字（去掉標記）要剛好是字串表那一條；畫面的每一行跟設計稿一樣（`fixtures/design-lines-03-04.json`：有滑鼠的十二種寬度，加上只有手指時 320～430 的手指框）。
- **預覽圖的 `alt`** 是 `getPlainString(lang, 'hero.video.alt')`。
- **`<Seg>` 多兩個 props**：
  - `bold`：字串表的另一條原字（`getString(lang, 'hero.mobile.bold')`）。在 `text` 的第一個 `«…»` 裡、緊接著那個 `«` 之後原樣出現的那一段包 `<b>`；找不到（不在那裡、`text` 沒有 `«`）丟 `Error`。
  - `tail`：一個 React 元素（例如箭頭 `<Icon name="arrow" />`），放進最後一個 `{…}`（`.nw`）的裡面、結尾，跟最後一個詞一起換行；`text` 沒有 `{…}` 時放在最後面。
  - 沒給這兩個 props 時，輸出跟原本一樣。
- **按鈕**：首屏「加到 Chrome」（`hero.cta`）`href` 是商店頁；「看教學影片」連到 `#tutorial`；「看支援裝置」連到 `#devices`。
- **只有手指時的分享框**（`(hover: none) and (pointer: coarse)` 才看得到；那時看不到 `hero.cta`）：
  - 說明 `hero.mobile.text`，裡面一個 `<b>`（`<Seg bold>`）；
  - 「分享這個網址」`<button>`（字 `hero.share`）：有 `navigator.share` 就呼叫 `navigator.share({ title: share.title, text: share.text, url: 這一頁 /<語言>/ })`；
    沒有就把網址寫進剪貼簿、浮出 `role="status"` 的「已複製」（`state.copied`），`position: fixed`（不推動版面），停 `--dur-breathe`（3.2 秒）再淡出收掉；
  - 「寄給自己」連結（字 `hero.mail`）：`mailto:?subject=<mail.self.subject>&body=<mail.self.body，%url% 換成 https://collector.jerromy.com/<語言>/?ref=mail>`（收件人空白）；
  - 「用的是電腦？」連結（字 `hero.pc`，`<Seg tail={<Icon name="arrow" />}>`）連到商店頁。
- **分享的退路（F4.1b，設計第三批 `notes/4-3.md`、`home.css` 的 `.touch--noshare`）**：按「分享這個網址」先 `navigator.share()`；沒有這個功能、或丟出 `AbortError` 以外的錯，改用剪貼簿＋「已複製」；
  剪貼簿也不行時，手指框加上 **class `touch--noshare`**（字面的 class 名稱，不能被 CSS Modules 換掉）：分享鈕收起，顯示 `share.fallback` 那一句（`data-id="share.fallback"`）與網址框（**`translate="no"`**，字是 `https://collector.jerromy.com/<語言>/`），焦點移到網址框。
  `AbortError`（使用者自己取消）什麼都不做。**不准用 `prompt()`、`alert()`**（原本的退路是 `prompt()`，設計稿沒有，改成這個）。
  關掉 JS 時不用程式：`share.fallback` 那一句與網址框直接看得到、分享鈕看不到（網址寫在 HTML 裡）。
- **宣傳片**：首屏裡的 `<video>`（`muted`、`loop`、`playsInline`），`src` 是 `/media/hero-<語言>.mp4`；還沒要播之前不要抓（不放 `src`、或 `preload="none"`）。
  預覽圖是首屏裡 `src` 有 `hero-poster` 的 `<img>`（`/images/hero-poster-<語言>-640|1280.webp` 或 `/media/hero-poster-<語言>.webp`），整張 1920:1080 顯示、不水平裁切（圖跟框同寬、同左緣）；燒進去的進度條由框裡最下方一條遮罩（`.crop::after`，高 50/1080、貼底、不擋點擊）蓋住；影片跟預覽圖同一個位置與大小。
  播放鈕是 `aria-label` 為 `hero.video.play` 的 `<button>`。桌機看得到（IntersectionObserver）才播、捲出去就停；只有手指、省流量（`navigator.connection.saveData`）、減少動態時不播，顯示預覽圖＋播放鈕，按了才載入。
  影片說明是 `<details>`，`summary` 的字是 `hero.video.label`，內容是 `hero.video.desc`。桌機 LCP 要是預覽圖。
- **動態 A**：括號裡（`hero.title` 的 `.clamp`）那半句，拆成一字一個帶 **`data-char`** 的元素，每個字的出場時刻從 **`Math.random`** 來（測試覆寫它固定順序）；
  等拉丁字型（`document.fonts.load('600 1em "Google Sans Flex"')`，**失敗也要接住**）最多約 1 秒再開始；括號（`.brk`）一開始就在、不動；減少動態、沒有 JS 時不拆字。
  **拆字要等 React 接手（hydrate）之後**：參考實作量到，在那之前改 React 畫的字，React 會報錯 #418、整頁重畫，`<html>` 上加的 class 也會被洗掉。播完可以把字換回純文字。
- **動態 B**：04 的三個 0 各是一個 **`data-zero`**（會動的那個數字；它的外層把它裁掉，用來量位移）：捲到 04 之前在上面一格，捲到之後依序滾下來停在 0，只播一次，字一直只有「0」。
- **動態 D**：首屏媒體框是 **`data-corners`** 元素，括號角畫在它的 `::after`：捲到之前 `scale` 1.03、透明度 0，捲到之後 1、1，只播一次。減少動態時 A、B、D 一開始就是最後的樣子。動態只動 opacity、transform、顏色，CLS 0；動態 C 不放。
- **F4.0a**：按公告條的 ✕ 之後，焦點移到 `#main`（`tabindex="-1"`，拿到焦點時不畫焦點框）或公告條之後第一個停得到的東西；不能掉到 `BODY`。
- **F4.0b**：給讀屏的屬性（`aria-*`、`title`、`alt`，以及會變成它們的 props，例如 `label`、`data-label-*`）一律用 `getPlainString`。
- **F4.6 版面不跳**：整頁的 CLS（layout-shift 總和）≤ 0.02，量法是字型晚到（第一次畫面用回退字型畫，之後才換上 Google Sans Flex），三語 × 十二種寬度，加上只有手指的 320、360、375、390、412、414、430。
  換字型時任何一段字的行數變了，整頁就會往下推。**只有手指也算**：真的手機開頁時沒有人操作，字型換上來的位移會算進 CLS。
- **F4.6b 任何寬度都不能跳太多**：回退字型不能只對準十二種寬度。常見寬度（十二種加 344、393、402、412、428、440，只有手指與有滑鼠）≤ 0.02；其他寬度（掃描）≤ 0.1（規格書 §9）。
  回退字型與網頁字型的寬度比會隨字級、字重變，一個 size-adjust 蓋不住；做法由前端決定（例如依字級分幾組回退字型），**不能用 `font-display: optional` 或 `block`**（第一次來的人整頁都是回退字型，不符合設計；標題也不能等字型）。
- **F4.7 原始碼**：`app/`、`components/` 的檔與 `public/` 第一層的 .js、.css 裡，看不見的字（私用區 U+E000～F8FF、零寬、BOM、不換行空白）一律寫成 `\uXXXX`，不直接放字元；
  註解與程式不寫內部流程的字眼（設計稿的批次、筆記檔名、角色名稱、段落代號；完整清單在 `source-hygiene.test.js`）。
- **F4.8「已複製」**：開頁時就有一個 `role="status"` 的元素在 DOM 裡，**沒有 `hidden`、`display` 不是 `none`、`visibility` 不是 `hidden`**（看不見用透明度或 visually-hidden），字是空的；
  按了「分享這個網址」（走剪貼簿那條）就是**同一個元素**換成 `state.copied` 的字、變得看得見，停 3.2 秒、淡出之後字清空（元素留著）。讀屏只念內容改變，不念剛出現或剛解除 hidden 的元素。
- **F4.9 字不能等 React**：React 沒接手（JS 晚到、手機慢）時，括號裡（`hero.title` 的 `.clamp`）的字約 1 秒內要露出來：
  開頁 1.5 秒時（Next.js 的 JS 晚 4 秒才到）字完整、自己與外層透明度 1、顏色不是透明、拆出來的 `data-char` 透明度 1；
  慢手機（延遲 150ms、1.6 Mbps、CPU 慢 4 倍）從畫面第一次出字（first-contentful-paint）算起 1.2 秒內有字看得見、最後全部看得見。React 晚到之後不能再把字藏起來重播。
- **F4.10 沒有錯誤**：開頁、動態播完、捲到 04 的整段，沒有頁面錯誤（例如 React #418：接手時 DOM 跟伺服器畫的對不上）、主控台沒有 error。
- **F4.12 04 的字不壓線**：「擴充本身」三格是一個 `<ul>`（裡面有 `data-zero`），每一格一個 `<li>`、分隔線畫在下一格的左框、最後一個子元素是單位那段字。
  每一格至少放得下自己的字與內距（設計稿 ba016e9 的 `repeat(3, minmax(max-content, 1fr))`），字離分隔線 ≥ 14px（設計稿最小 16、640 起 30，留 2px 給捨入）；**單位的字不能從中間斷**（用斷字或 `minmax(0, 1fr)` 硬塞會紅）。
- **F4.11 連結的底線**：連結裡每一個斷行單位（`.u`，行內區塊，底線靠 `text-decoration: inherit` 拿）都要拿得到 `<a>` 的底線 ——
  `<a>` 與 `.u` 中間多包的元素（例如 `<span data-id>`）也要 `text-decoration: inherit`，不然 `.u` 繼承到的是 none。
  手指框的出口連結（裡面有 `data-id="hero.pc"` 的 `<a>`）：每個 `.u` 有底線、按下（`:active`）時底線是螢光綠（`--color-accent-lime-default`）、鍵盤聚焦有焦點框。
  首屏與 04 的每一個 `<a>`，每個字算出來有沒有底線跟設計稿一樣（`fixtures/design-6511462.json` 的 `links`，量法是 `page-helpers.js` 的 `LINK_DECORATION`：往上找有底線的祖先，碰到行內區塊就停）。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F4.0a | `a11y-fixes.test.js` | 三語 1440：Tab 到 ✕、按 Enter → 公告條收起、焦點在 `#main` 或公告條之後第一個、`#main` 不畫焦點框、沒有多出新的動畫、再按 Tab 接著原處往下；localStorage 擋掉也一樣 |
| F4.0b | `a11y-fixes.test.js` | 靜態：`aria-*`、`title`、`alt`、`label`（含 `xxxLabel` props）不直接是 `getString(…)`；真的 build：字串表每一條沒有標記的字包一層 `«…»`（`hero.mobile.bold` 除外）之後，out/ 的 `aria-*`、`title`、`alt`、`data-label*` 與 `<title>` 沒有標記字元 |
| F4.1 `<Seg>` | `seg.test.js` | `bold`：三語 `hero.mobile.text` 跟 README 8 步轉出來、再把 `hero.mobile.bold` 那段包 `<b>` 的 HTML 一樣；`tail`：三語 `hero.pc`、`{…}` 裡還有 span、沒有 `{…}` 三種；`bold` 找不到要丟錯 |
| F4.1b 分享的退路 | `hero.test.js` | 三語：沒有 `navigator.share`、剪貼簿寫不進去 → 按了之後手指框有 `touch--noshare`、分享鈕收起、`share.fallback` 那一句與網址框（`https://collector.jerromy.com/<語言>/`）看得到、焦點在網址框、沒有對話框、沒有「已複製」；zh：share 丟出 NotAllowedError 也一樣、丟出 AbortError 什麼都不做；關掉 JS 三語：網址框與那一句直接看得到、分享鈕看不到 |
| F4.1 按鈕與分享框 | `hero.test.js` | 桌機三語：`hero.cta` 連到商店、點了真的走過去，`#tutorial`、`#devices`；只有手指 390 三語：看不到 `hero.cta`，分享框四樣東西與 mailto 的主旨、內文；有 `navigator.share` 時的 title、text、url；沒有時的剪貼簿、「已複製」（role=status、fixed、main 不動、頁高不變、1 秒與 3 秒在、4 秒收掉） |
| F4.2 預覽圖的替代文字 | `hero.test.js` | 三語：首屏那一張 hero-poster 的 `alt` 剛好是字串表 `hero.video.alt` 的純文字 |
| F4.2 宣傳片 | `hero.test.js` | 桌機 1440×360：進畫面前沒播、沒抓、沒載（readyState 0）；捲到看得到才播、靜音循環、這個語言那支；預覽圖是這個語言那張、框 1920:1080 不水平裁切、底下有蓋進度條的遮罩、影片跟預覽圖同框；捲出去就停。只有手指 390：開頁沒抓沒載，按播放鈕才載入、才播。省流量、減少動態：不播、不抓、看得到預覽圖與播放鈕。LCP 是預覽圖且 ≤ 2.5 秒；`<details>` 用 Enter 開合 |
| F4.3 A、B、D、C | `motion.test.js` | 見那支檔頭：A 的字數、拆字當下全透明、每個字都冒出來、分散在 200～1000ms、不照字的順序、2.5 秒後全部到位、括號透明度 1 且沒有動畫、等字型（扣住 600ms、擋掉）、同種子每個字的 `--k` 一樣、換種子不同（讀 `--k`，不看每一幀的透明度：相鄰兩個字的出場最少只差約 11ms，比一幀短，機器一忙看到的先後會對調）、拆字前後斷行一樣、關 JS 完整；B 依序、只有「0」、只播一次；D 1.03→1、0→1、只播一次；減少動態三者直接是最後的樣子；只動 opacity／transform／顏色、CLS 0；C 不放 |
| F4.4 文案 | `copy-lines.test.js` | 三語 × 十二種寬度，03、04 十七個區塊的每一行跟設計稿逐行表一樣；只有手指時 320～430 手指框的 `hero.mobile.text`、`hero.pc` 也一樣；說明文字（`hero.sub`、`hero.video.desc`，只有手指時另量 `hero.mobile.text`）中日文每行 5～25 字、行首沒有孤標點，英文沒有只有一個字的行 |
| F4.5 通用 | `hero-layout.test.js`（另見 F1.5 色碼、F3.9 內嵌腳本、F4.4 斷行） | 三語 × 十二種寬度（320、390 另外量只有手指）：不橫捲、`data-id` 區塊不重疊、按鈕與連結的字不跑出框、≥ 44×44、1024 起左字右片、一欄時影片在按鈕下面；減少動態沒有動畫；關掉 JS 每個 `data-id` 的字都在 |
| F4.6 CLS（2026-10-03 加，同日改量法） | `hero-quality.test.js`、`page-helpers.js` 的 `measureCls` | 一個語言一條：十二種寬度（有滑鼠，高 900）＋只有手指 320～430 七種（高 844）；這一頁的 .woff2 用 Playwright 攔住（每頁各自扣，可以同時開好幾頁），回退字型畫過兩個畫格才放，等 load、字型、1.2 秒；CLS ≤ 0.02，**不扣 `hadRecentInput`**（原本扣：Playwright 開只有手指時，字型換上來的位移被標成有人操作，只有手指那七組永遠 0）。兩種模式都量的寬度（320、360、375、390、414、430）：手指框之上的東西（`hero.kicker`、`hero.title`、`hero.sub`、公告條）兩種模式的位移要一樣（差 ≤ 1px），只有手指那邊量少了就紅。紅的時候寫語言、寬度、模式、CLS、位移最大的三個元素；每一組的值印成一行 `# CLS …`。防呆：放字型前拉丁字型還沒載好。F1.5 的 0.01、F4.3 的「動態 CLS 0」不動 |
| F4.6b 寬度掃描（2026-10-03 加，同日加密） | `cls-sweep.test.js` | 量法同 F4.6，同時開六頁。三語各三種：常見寬度（十二種＋344、393、402、412、428、440）× 只有手指與有滑鼠 ≤ 0.02；掃描（280～480 每 4px 只有手指、488～1456 每 16px 有滑鼠、平板只有手指 640～1366 每 32px 加 1366）≤ 0.1；迴歸清單（每 4～16px 掃、壞的地方再每 1px 量到會壞的寬度，一個寬度一條：英 428、338、344、366～374、394、418～430、333、334、284、285，英文有滑鼠 290（門檻 0.02：首屏按鈕下面那幾行沒調時只有 0.0259，0.1 守不住）、640、652、700、900、1023（640～1023 的大標餘裕不到 0.5%，652 沒調時 0.2579），中 354、322、488、361、362、353（353 只有手指與有滑鼠都量：公告條標題 44→49 高，0.2583／0.2451），日 306、340、342～346、434～478、440；480 以下量只有手指、以上量有滑鼠，寫成 `[寬度, 'both']` 的兩種都量、`[寬度, 'desktop']` 只量有滑鼠，第三個值是那個寬度自己的門檻；在常見寬度裡的 ≤ 0.02、其餘 ≤ 0.1）。同一組只量一次、幾條共用；每一級印一行 `# F4.6b …`。整支 mac 上約四分鐘以內。原本每 8px／32px，跳過了中文 361、362（0.1156，`hero.sub` 4 行變 3 行） |
| F4.7 原始碼（2026-10-03 加） | `source-hygiene.test.js` | 靜態掃描：看不見的字（列出 檔案:行 與字碼）；內部流程的字眼（列出 檔案:行、字眼、那一行的開頭） |
| F4.8「已複製」（2026-10-03 加） | `hero-quality.test.js` | 三語 390 只有手指：開頁先把所有 `role="status"` 做記號；按了之後寫著 `state.copied` 的是開頁就在的那一個、當時沒有 hidden、display 不是 none、visibility 不是 hidden、字是空的；按了看得見；再 2.8 秒字是空的 |
| F4.9 字不等 React（2026-10-03 加） | `hero-quality.test.js` | 三語 390：`/_next/static/chunks/` 的 .js 晚 4 秒（.css 照常），1.5 秒時括號裡的字完整看得見、5 秒後 React 接手了還是完整、沒有頁面錯誤；慢手機三語 390 只有手指（Chrome 開發者協定調網路與 CPU）：每一幀量，第一個字看得見 ≤ 出字後 1.2 秒，兩個時刻印成一行 `# F4.9 慢手機 …` |
| F4.10 沒有錯誤（2026-10-03 加） | `hero.test.js` | 三語 × 有滑鼠 1440、只有手指 390：開頁、等 2.5 秒、捲到 04、等 2 秒，`pageerror` 與主控台 error 都沒有 |
| F4.11 底線（2026-10-03 加） | `underline.test.js`、`fixtures/design-6511462.json` | 三語 390 只有手指：出口連結每個 `.u` 有底線、按下（強制 `:active`）時螢光綠、Tab 聚焦有焦點框；三語 × 有滑鼠 1440、只有手指 390：首屏與 04 每個連結（照「字去掉空白｜href」對上設計稿，mailto 只比 `mailto:`）每個字有沒有底線跟設計稿一樣、設計稿有的連結網站也要有 |
| F4.12 04 字不壓線（2026-10-03 加） | `where-zeros.test.js`、`fixtures/design-6511462.json` 的 `zeros` | 三語 × 有滑鼠十二種寬度＋只有手指 280、320、360、375、390、430、480、540、640、768、1024、1280，減少動態：三格每一格的字（數字與單位）右緣到下一格的左緣（分隔線）≥ 14px（2026-10-03 從 8 收緊：設計稿三語手機寬都是 16、640 起 30），第三格量到 `<ul>` 右緣（`page-helpers.js` 的 `ZERO_GAPS`）；單位一行；整頁不橫捲。失敗訊息寫語言、寬度、模式、哪一格（單位的字）、距離、設計稿的距離。設計稿的值也當防呆（本身要 ≥ 8、一行） |

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：`<Seg>` 的 bold／tail、首屏與 04、`public/motion.js`、`public/hero.js`、設計稿的 CSS、公告條關掉後移焦點、`getPlainString`；整套跑一次後一次放回一種錯）

參考實作上整套跑過一次，紅的只有下面「發現的問題」的 1、3、4；2026-10-03 換成第三批的字串表與逐行表之後重跑 F4，全綠（原本的「.」單獨一行那條也過了）。

2026-10-03 補 F4.6～F4.11、F3.11：另開一份暫存複本，從前端現在的程式改最小的參考實作 ——
`<Seg>` 的私用區字寫成 `\uE000`／`\uE001`、拿掉註解裡的流程字眼；「已複製」一開始就在、沒有 `hidden`、按了才放字、收掉時清空；
`motion.js` 等 React 的時間從 `--dur-breathe`（3.2 秒）改成 `--dur-slow` 的兩倍（0.96 秒）；手指框出口連結的 `<span data-id>` 加 `text-decoration: inherit`；
公告條照設計稿加手機（< 640）的排法（欄寫成 `minmax(0, 1fr) var(--tap)`，照抄設計稿的 `auto` 會讓 F1.5 坑 9 紅）。
F4.7～F4.11、F3.11 全綠（慢手機量到出字後約 0.75～0.79 秒看得見）。F4.6 沒有在參考實作上做到綠，原因見「發現的問題」7。

F4.6 改量法、加 F4.6b（2026-10-03）：放回錯誤在前端修過一輪的程式上做（暫存複本），F4.6 改量法之後英文 320、430 只有手指在現在的程式上就紅（0.059、0.079，跟另外量的一樣）。

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 括號也做淡入動畫 | F4.3 A：「括號從頭到尾透明度 1（一開始就在定位）」 |
| 字照順序冒（不洗牌） | F4.3 A 三語：「冒出來的順序不能照字的順序，得到 0,1,2,…」；順序從 Math.random 來 |
| 括號透明度的轉場在減少動態時照樣 300ms（`!important` 蓋過全域的減少動態） | F3.6 減少動態：「括號的透明度不做轉場（≤ 1ms），得到 左 300ms、右 300ms」 |
| 括號不做轉場（`transition: none`） | F3.6：「括號是滑進來的（透明度轉場 ≥ 100ms），得到 左 0ms、右 0ms」 |
| 英文 640～1023 大標的回退字型改回沒調（`--font-title-48` 用一般 48 級那組） | F4.6b 迴歸：「en 652 有滑鼠：CLS 0.2579（上限 0.1），位移最大的是首屏內容（60px）、大標」 |
| 英文首屏按鈕下面那幾行的回退字型改回沒調（`--font-meta` 用一般 14 級那組） | F4.6b 迴歸：「en 290 有滑鼠：CLS 0.0259（上限 0.02），位移最大的是影片框、hero.meta.devices、hero.meta.os（22px）」 |
| 出場位置不用 `Math.random`（照字的位置算一個固定值） | F4.3 A 順序：「換一個種子 --k 要不一樣」 |
| A 不等字型 | F4.3 A 字型晚到：「第一個字要等字型載好（字型 642ms、第一個字 208ms）」 |
| `fonts.load` 失敗沒接住（字型擋掉時 A 永遠不開始） | F4.3 A 字型晚到：「字型擋掉：3 秒後每個字都要在」 |
| 減少動態也拆字 | F4.3 減少動態：「減少動態時不拆字（0 個 data-char）」 |
| B 每次進畫面都重播 | F4.3 B：「捲走再捲回來不再播一次」 |
| D 一開始就在定位 | F4.3 D：「捲到之前括號角在框外（scale 1.03）、透明度 0」 |
| 手機也自動播 | F4.2 只有手指：「手機開頁不能自動下載 mp4」 |
| 捲出去不停 | F4.2 桌機：「捲出畫面就要停」 |
| 不管省流量 | F4.2 省流量：「省流量時不能抓 mp4」 |
| 「已複製」放進版面裡 | F4.1 分享：「『已複製』要 position: fixed」 |
| 寄給自己少了 `?ref=mail` | F4.1 只有手指：「內文要有 https://collector.jerromy.com/en/?ref=mail」 |
| 分享框的說明沒包 `<b>` | F4.1 只有手指：「分享框的說明要有一個 <b>」 |
| 關掉公告後焦點沒移 | F4.0a 兩條：「收起之後焦點不能掉到 BODY」 |
| 語言切換的讀屏名字改回 `getString` | F4.0b 靜態與真的 build 兩條 |
| 社群圖示的名字用 `getString`（先算成變數再放進 aria-label、title） | F4.0b 真的 build：「aria-label="«Blog»"」（靜態那條抓不到這種，所以要真的 build 那條） |
| 首屏 1024 起不分左右 | F4.5：「桌機要左字右片」 |
| 預覽圖的 `alt` 寫死成空的（第三批補的那條，2026-10-03） | F4.2：「預覽圖的 alt 要是 hero.video.alt 的純文字」 |
| 分享的退路改成 `prompt()`（前端原本的做法，2026-10-03） | F4.1b 三語：「不能跳 prompt()／alert() 這類對話框」 |
| 公告條中文標題改回 `word-break: normal`（2026-10-03） | F3.10 換行樣式：「zh：公告條標題的 word-break」要 keep-all、得到 normal |
| 日文公告條標題也插 `<wbr>`（2026-10-03） | F3.10 公告條標題的詞界：「ja：公告條標題不能有 <wbr>」 |
| 拆字改成 DOMContentLoaded 就拆（不等 React 接手） | F4.10 三語：「1440 頁面錯誤：Minified React error #418」、「390 只有手指 頁面錯誤：…#418」 |
| 「已複製」改回一開始 `hidden`、字寫在 HTML 裡 | F4.8 三語：「開頁時那個元素不能有 hidden 屬性（讀屏會略過）」 |
| 「已複製」收掉時不清字 | F4.8 三語：「約 2 秒後字要清空（元素還留在 DOM 裡）」（第四批之後這句改成「停 3.2 秒、淡出之後（4 秒時）字要清空」） |
| 04 三格改回 `minmax(0, 1fr)` 平分 | F4.12 英日：「en 280 有滑鼠：第二格「accounts」的字離下一格的分隔線 4.5px（要 ≥ 8，設計稿 16）」「ja 280：-4.3px」「ja 1024：0.9px」（門檻當時是 8） |
| 三格改用 flex 平分（`flex: 1 1 0; min-width: 0`，網站現在是 flex 寫法） | F4.12 英日：「en 280：10.2px（要 ≥ 14）」「ja 280：1.3px」「ja 1024：11.2px」—— 英文 280 與日文 1024 在舊的 8px 門檻下會過 |
| 內距退到 9px | F4.12 英日：「ja 280：第二格「アカウント」9px（要 ≥ 14）」「en 280：11.5px」 |
| 平分之外再讓單位斷字（`word-break: break-all`）硬塞 | F4.12 英日：「en 280 有滑鼠：第二格「accounts」的單位斷成 2 行」「ja 1024：第二格「アカウント」的單位斷成 3 行」 |
| 「已複製」停的時間寫死 2000ms（第四批改成 `--dur-breathe`） | F4.1：「zh：3 秒時「已複製」還在（停 --dur-breathe，3.2 秒）」 |
| `<Seg>` 的私用區字直接寫字元 | F4.7：「components/Seg/Seg.js:7 U+E000」等 4 處 |
| 註解寫「設計第三批」 | F4.7：「public/hero.js:144「設計第三批」」 |
| 等 React 的時間改回 3.2 秒 | F4.9 三語：「1562ms：括號裡的字不能是透明色」；慢手機三語：「第一個字 出字後 2733ms」 |
| 拿掉出口連結 `<span data-id>` 的 `text-decoration: inherit` | F4.11 三語：「每一個 .u 的 textDecorationLine 要是 underline，得到 none、none」；通則三語：「網站 ----------------、設計稿 uuuuuuuuuuuuuuuu」 |
| 出口連結聚焦時 `outline: none` | F4.11 三語：「鍵盤聚焦時要看得到焦點框，得到 {"focused":true,"style":"none","width":3}」 |
| 回退字型的 size-adjust 改回上一版（一般 101.6%、粗體 100.3%） | F4.6 中英：「en 430 有滑鼠：CLS 0.2327」「zh 360 有滑鼠：CLS 0.1074」；F4.6b 常見寬度三語（例如「en 412 只有手指：CLS 0.0484，位移最大的是公告條標題（22px）」）、掃描中英（「en 288 只有手指：CLS 0.1147」）、迴歸 en 394、422、426（現在的程式在 0.1 以下，放回之後超過） |
| 量 CLS 時又扣掉 `hadRecentInput`（量法改回去） | F4.6：只有手指全部變 0，「en 430：span.nw 在 data-id=hero.title 裡 的字 有滑鼠移 40px、只有手指移 0px —— 手指框之上的東西兩種模式要一樣」 |

### 發現的問題（案例或設計稿本身的，沒有自己改）

1. ~~英文只有手指時，430 寬「.」單獨一行~~：第三批已改（英文 `hero.mobile.bold` 改成 `{on a computer.}`，句點併進粗體）。設計稿量過，430 寬那一行是「for Chrome on a computer.」，F4.4 不再因為這個紅。
2. ~~首屏預覽圖的替代文字不在字串表~~：第三批已補 `hero.video.alt`（三語），測試補了一條（預覽圖的 `alt`＝它的純文字）。
3. **F1.5 的坑 9 靜態掃描跟設計稿衝突**：設計稿 `.where__list { grid-template-columns: repeat(2, max-content) }`（裡面的名字 nowrap，360 以下改一欄）。照抄會讓 F1.5 紅；
   建議寫成 `repeat(2, minmax(0, max-content))`（行為一樣，掃描認得），或放寬那條規則。
4. **F1.5 英文 390 的 CLS 會紅（0.0128）**：首屏的字變多之後，回退字型的 `size-adjust` 要照全域樣式註解裡寫的量法重量一次。
5. 案例說「宣傳片的 mp4 與預覽圖用 public/images/（images.json）」：mp4 在 `public/media/`（`media.json`），預覽圖兩邊都有（`images/hero-poster-*-640|1280.webp`、`media/hero-poster-*.webp`）。測試兩種預覽圖都收、mp4 照 `/media/`。
6. 「中日文一行 12～20 字」只當目標、不判：設計稿本身就有 8、9 字的行。判的是 5～25 字與孤標點、跟設計稿逐行一致。
7. **F4.6 紅的那幾組都是「換上網頁字型時某一段字的行數變了」**（2026-10-03 量：同一頁擋掉字型與正常載入，比每個 `data-id` 的高度）：
   中文 360 `hero.sub` 84→112；英文 280 `hero.sub` 128→179、`hero.meta.os` 22→45、`hero.video.desc` 309→331，320 `hero.kicker` 18→36，430 `hero.title` 120→80，640 公告條標題 46→69；日文 414 `hero.kicker` 21→42。
   回退字型的 `size-adjust` 是整頁平均，個別一段字的寬度還是差一點，剛好落在換行邊界的寬度就換行數。
   參考實作試過把字型改成 `font-display: optional`：CLS 全部 0，但第一次開頁大多用不到網頁字型，F3.11 的英文版面（標籤寬、標題位置）就對不上設計稿 —— 只證明量得到綠，不建議這樣修。
8. **設計稿的快照（4fce811、3f2310c）要連 `clipper/fonts/` 一起取出**：設計稿的字型從 `clipper/css/fonts.css` 連到 `clipper/fonts/`，少了它拉丁與等寬字型載不到，「公告」標籤的英文寬差 2px（47 對 44.8）、英文手指框按鈕下緣差 18px。`fixtures/design-6511462.json` 是補上之後重量的，量之前確認兩個字型都載好了。
9. F4.11 的「聚焦時底線轉螢光綠」：設計稿的 `.link` 只有滑過與按下換底線顏色，聚焦時畫的是 base.css 的螢光綠焦點框。測試量的是按下時底線螢光綠（第四批之後只有手指沒有滑過，原本量滑過）、聚焦時有焦點框。

### 已知限制

- `--measure`（說明文字一行最寬約 25 字）在手機寬量不到（手指框本來就比 25em 窄），等 15 區做出來時在平板、桌機寬再量。
- F3.10 的 `<wbr>` 那條用 `content/` 真的內容：要有一則看得到的中文公告、標題裡至少有一個詞界；內容改成很短的標題時這條可能失準，改用測試資料夾。
- 逐行表是用測試同一個量法（`textLines`）直接量設計稿 HTML 得來的；有滑鼠那 612 條跟設計稿 `notes/4-1-lines-all.txt` 逐條一樣。手指框那幾條是頁面上的手指框（`notes/4-3-lines-all.txt` 的 `.states .touch p` 是說明區裡的手機框，寬度跟頁面不同，沒拿來比）。
- 「沒有字壓到別的東西」量的是 `data-id` 區塊的外框（巢狀的不算）；字的實際筆畫、圖片上的字沒量。收著的 `<details>` 裡的字不算（`checkVisibility`）。
- 「看得到才播」量的是 1440×360（影片在第一屏下面）；「手機」是 Playwright 的 isMobile＋hasTouch，不是真的手機（真的 iPhone、Android 由規格書第 14 節人工看）。
- 抓 mp4 用伺服器收到的請求＋影片的 readyState 兩種量：同一個瀏覽器裡別的分頁抓過的影片，請求可能不會再送到伺服器（量過一次漏掉）。
- A 的「隨機」量的是順序不照字的順序、換種子會變；分布均不均勻（每個字落在自己那一格）沒量。
- F4.6、F4.6b 的「字型晚到」是扣住字型檔兩個畫格；真的慢網路下字型更晚到、中間使用者可能已經捲動，那種情況沒量。
- F4.6b 只在 mac 的 Chromium 上量：回退字型是 `local("Arial")`、等寬是 `local("Courier New")`，Windows 也有；**Android 沒有 Arial 與 Courier New，`local()` 抓不到，回退字型整個不生效**（會用 Roboto 與系統的等寬字），那邊跳多少沒量。真的 iPhone 的 Safari 也沒量。
- F4.6b 掃描的步長是 4px（只有手指 280～480）、16px（有滑鼠 488～1456）、32px（平板只有手指），中間的寬度靠迴歸清單補（中文 361、362 就是掃描跳過、另外每 1px 才找到的）；之後量到新的會壞的寬度，加進 `cls-sweep.test.js` 的 `REGRESSION`。
- 「只有手指」是 Playwright 的 isMobile＋hasTouch。它會把字型換上來的位移標成 `hadRecentInput: true`（為什麼沒查），所以 F4.6、F4.6b 一律不扣這個標記；量的時候不操作頁面，不扣也不會多算。
- F4.9 慢手機是 Chrome 開發者協定的模擬（網路延遲與頻寬、CPU 慢 4 倍），不是真的手機；「約 1 秒」量成 1.2 秒（多 0.2 秒寬容），量的是第一個字看得見，全部看得見的時刻只印出來不判（React 及時接手時動態 A 本來就要約 1 秒才播完）。
- F4.10 量的是開頁到捲到 04；之後的區塊、☰ 選單、按按鈕時的錯誤不在這條裡（各區的測試自己量）。
- F4.11 通則只比首屏與 04 的 `<a>`；比的是「有沒有底線」，底線的顏色、粗細、位置只在出口連結量按下時的顏色。
- 動畫只動哪些屬性，量的是每一幀 `document.getAnimations()` 看得到的 CSS 轉場與動畫；用 JS 每一幀直接改 style 的動畫量不到。

## 03 首屏：宣傳片的暫停鍵、平板與觸控（F4b）

設計稿第四批（3f2310c）：`動態.md`「宣傳片的播放與暫停」、`notes/4-4.md` 修正五項與「給前端的事」、`home.css` 的 `.play`／`.play--ctl`、`@media (hover: hover)`、`@media (hover: none)` 的 `:active`。

### 介面約定（前端照這個做）

- **宣傳片的鈕只有一顆**：首屏裡的 `<button data-play>`，**`data-state` 是 `idle`｜`loading`｜`playing`｜`paused`**，裡面兩個圖示 `data-icon="play"` 與 `data-icon="pause"` 都在（CSS 照狀態顯示一個）；它在影片框（`data-corners` 那個元素）的左下角，離左緣、下緣各 24。
  - 大小：`idle` 是大的播放鈕（寬 640 以上 72、以下 56）；`loading`、`playing`、`paused` 是 44×44。讀屏名字：`loading`、`playing` 是 `hero.video.pause`，`idle`、`paused` 是 `hero.video.play`（三語，純文字）。
  - **桌機會自動播**（有滑鼠、沒開省流量、沒設減少動態）：`<head>` 的外部 .js 在畫面出來之前給 `<html>` 加 **`video-auto`**，第一次畫就是 44 的暫停鍵（`loading`），不先閃 72；影片 `playing` 之後是 `playing`。
    載入中按下去：停止載入（`video.removeAttribute('src')`＋`load()`）、換成 `paused`，之後不自己播。`play()` 被擋（reject）：回到 `idle`、72（`<html>` 還有 `video-auto` 時也要是 72）。
  - 按暫停：`paused`，捲走再捲回來不自己播；播放中捲出畫面只是系統暫停，捲回來接著播。
  - 只有手指、省流量、減少動態：開頁是 `idle` 的大播放鈕、`<html>` 沒有 `video-auto`；按了才載入、才播。
  - 鍵盤 Enter、空白鍵都能按；聚焦有焦點框；換狀態不推動版面。關掉 JS（`<html>` 沒有 `js`）：整顆不放，預覽圖與影片說明照樣在。
- **只有手指**（`(hover: none) and (pointer: coarse)`）任何寬度都只看得到手指框（`data-touch`），看不到 `hero.cta`、`hero.watch` 與導覽列的「加到 Chrome」；有滑鼠只看得到按鈕。CSS Modules 裡那一段要排在 640 那條後面。
- **網站自己的 CSS 每一條 `:hover` 都包在 `@media (hover: hover)` 裡**（設計稿把公告 ✕ 那條寫成 `.iconbtn--ghost:is(:hover, :active…)` 一條，照抄會讓靜態掃描紅；拆成 `@media (hover: hover)` 裡的 `:hover` 與外面的 `:active` 兩條，樣子一樣）；手指的「按下」用 `@media (hover: none)` 的 `:active`，算出來的樣子跟設計稿同一個元件一樣。
- **分享退路的網址框**（`data-share-urlbox`）：寬 320 以下兩行（`https://`／`collector.jerromy.com/<語言>/`），360 起一行。
- **大標**：中文 360 以下括號那半句跟前面接著排（設計稿 `.clamp` 改 `display: inline`）。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F4b.1 暫停鍵 | `hero-video.test.js` | 三語 1440×900 桌機自動播：第一個畫格 `<html>` 有 `video-auto`、每一幀都是 44（比 44 大的幀數要 0）、`playing`、讀屏名字、左下角 24；按了 `paused`、44、版面不動；捲走捲回來還停著；再按播；系統暫停捲回來接著播。鍵盤：焦點框、Enter 暫停、空白鍵播。載入中按下去（mp4 晚到）：沒有 `src`、`paused`、放行後不播。被擋（`play()` 丟 `NotAllowedError`）：`idle`、72。只有手指 390：`idle`、56，按了 `playing`、44；省流量、減少動態 1440：`idle`、72、沒有 `video-auto`。關掉 JS（1440、只有手指 390）：看不到鈕、預覽圖與影片說明在 |
| F4b.2 平板 | `touch.test.js` | 三語：只有手指 280、320、360、375、390、430、480、540、640、768、1024、1280 只看得到手指框（看不到 `hero.cta`、`hero.watch`、導覽列的加到 Chrome）；有滑鼠十二種寬度只看得到按鈕。15 區同樣量、而且不橫捲（2026-10-03 從 todo 轉成必過） |
| F4b.3 黏住的 hover | `touch.test.js` | 靜態：`app/`、`components/` 的 CSS 去掉註解後，選擇器有 `:hover` 的規則外面要有 `@media (…hover: hover…)`（掃描本身有防呆：分得出裡外）；三語 390 只有手指：點過分享、寄給自己、公告 ✕、☰、播放鈕（點擊本身的效果先擋掉）之後，底色、字色、框線、底線色、括號透明度跟點之前一樣 |
| F4b.4 按下的樣子 | `touch.test.js`、`fixtures/design-6511462.json` 的 `press` | 三語 390 只有手指、減少動態：用 Chrome 開發者協定強制 `:active`，十個元件（分享、寄給自己、☰、公告 ✕、社群第一個、播放鈕、語言切換、用的是電腦？、選單連結、影片說明開關）的底色、字色、框線、底線色、`::before`／`::after` 透明度跟設計稿一樣（框線透明或沒有、沒有底線、沒有 `::before`／`::after` 時記「-」） |
| F4b.5 網址框 | `touch.test.js` | 關掉 JS、三語只有手指：280、320 兩行，360、390 一行 |
| F4b.6 大標短行 | `touch.test.js`（另見 F4.4 逐行表） | 中文 280、320、英文 280 照字面；日文 280、320 照設計稿逐行（已知限制，不要求更好） |

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：一顆鈕的四個狀態與 `hero.js` 的狀態機、`<head>` 加 `video-auto`、只有手指那段搬到 640 之後、`:hover` 全部包進 `@media (hover: hover)` 並各補一條 `:active`、280 寬的內距、中文大標 `.clamp` inline；F4b 全綠、整套只剩 F4.11 按下那條（改量法之後就綠）；之後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| `video-auto` 時 `idle` 不畫成 44 | F4b.1 桌機三語：「從開頁到播放，鈕每一幀都要是 44×44（不先閃大的播放鈕），有 1 幀比 44 大」 |
| 使用者暫停之後捲回來照樣自動播 | F4b.1 桌機三語：「使用者按了暫停，捲走再捲回來不能自己播（paused false、data-state playing）」 |
| 載入中按下去沒拿掉 `src` | F4b.1 載入中：「載入中按下去要停止載入（video 拿掉 src 屬性），得到 src=/media/hero-zh.mp4」 |
| 被擋時沒拿掉 `video-auto` | F4b.1 被擋：「被擋之後是 72×72 的大播放鈕（html 還有 video-auto 也一樣），得到 44×44」 |
| 關掉 JS 時照樣放鈕 | F4b.1 關掉 JS：「zh 1440：關掉 JS 時看不到播放／暫停鈕」 |
| 鈕聚焦時 `outline: none` | F4b.1 鍵盤：「鍵盤聚焦時要看得到焦點框」 |
| 只有手指也加 `video-auto` | F4b.1 只有手指：「data-state 是 idle，得到 playing」 |
| 只有手指那段排回 640 前面 | F4b.2 三語：640、768、1024、1280 只有手指「看得到主要按鈕那一組」 |
| 主要按鈕的 `:hover` 寫在 `@media` 外面 | F4b.3 靜態：「Button.module.css：.primary:hover」；點過之後：三語「分享」黏住（底色螢光綠、括號透明度 1） |
| 拿掉圖示鈕的 `:active` | F4b.4：三語的 ☰、公告 ✕、社群「按下時 background 網站 rgba(0, 0, 0, 0)、設計稿 rgb(59, 61, 71)…」 |
| 拿掉 280 寬的內距 | F4b.5：三語 280「網址框 ["https://","collector.jerromy.com/","zh/"]」 |
| 中文大標 `.clamp` 不改 inline | F4b.6：「zh 280：大標 ["把網頁收成","AI","讀得懂的素材庫"]」 |

### 已知限制

- 「按下」只在 390 只有手指量（設計稿另外量了 1280）；導覽列一整排的連結與語言切換在 390 是選單裡那一份。05、06、09、11～16 還沒做，不量。強制 `:active` 是開發者協定做的，不是真的手指按著。
- 黏住的 hover 只點五個（分享、寄給自己、公告 ✕、☰、播放鈕），點擊本身的效果先擋掉（不然公告收起、選單打開就比不了）；別的元件靠 F4b.3 的靜態掃描。
- 暫停鍵的「影片在播」是 Chromium 播 mp4 量的；真的 iPhone、Android 的自動播規則沒量。自動播被擋是改寫 `play()` 模擬的。
- 「不先閃 72」量的是每一個動畫幀鈕的大小；比一幀還短的閃（同一幀裡改兩次）量不到。
- 設計稿的對照數字（逐行表、位置、按下的樣子）是開設計稿快照量的；設計稿再改要用 `tools/measure-design.mjs` 重量（見下一節）。

## SEO 標記、「/」分流、404、網站地圖、圖示（F2）

規格書 §4、§10.2～§10.7；網站必備「SEO 與語言版本」「圖示一套」；設計稿第四批（ba016e9）的分享卡 `<head>`（`notes/4-4.md`「分享卡：給前端怎麼出圖」）與圖示規格（`icons/site/README.md`「給前端的清單」）。
正式網址一律 `https://collector.jerromy.com/`（`app/site.js` 的 `SITE_URL`，一個地方）；字一律從字串表取（測試用 `app/strings.js` 的 `getPlainString`，跟網站同一份）。

### 介面約定（前端照這個做）

- **四頁（`/zh/`、`/en/`、`/ja/`、`/`）的 `<head>`**：
  - `<link rel="alternate" hreflang>` 剛好五條、四頁一樣：`zh-Hant` 與 `zh` → `https://collector.jerromy.com/zh/`、`en` → `/en/`、`ja` → `/ja/`、`x-default` → `/`（都是絕對網址）。
  - `<link rel="canonical">` 剛好一條，指到自己（`/` 指到 `https://collector.jerromy.com/`），結尾有 `/`，不帶 `?`、`#`；開頁之後程式也不能改它（帶 `?ref=` 開也一樣）。
  - `<title>`：三語頁是 `meta.title`，`/` 是 `root.meta.title`。`<meta name="description">` 剛好一條：三語頁是 `meta.desc`；`/` 是英、中、日三個語言頁的 `meta.desc` 依序用「 / 」（半形斜線、前後各一空白）接起來（規格書 §10.2「三語的一句話各一行」，不照設計稿只放英文）。`/` 不可以有 noindex（它是 hreflang 的 x-default，要能被索引）。
  - 分享卡：`og:type` website、`og:site_name`（`meta.siteName`）、`og:title`、`og:description`、`og:url`（＝canonical）、`og:locale`（zh_TW／en_US／ja_JP）＋另外兩個 `og:locale:alternate`、
    `og:image`（`https://collector.jerromy.com/og/og-<語言>.png`）、`og:image:width` 1200、`og:image:height` 630、`og:image:type` image/png、`og:image:alt`（`og.image.alt`）、`twitter:card` summary_large_image。
    `/` 那一組：`og:title`＝`root.meta.title`、`og:description`（與有放的 `twitter:description`）只用英文那一句（英文的 `meta.desc`；規格書 §10.6「三語的名稱、英文說明」，跟 `<meta name="description">` 的三句不一樣）、`og:url`＝`/`、`og:locale` en_US、`og:image`＝`og-en.png`、`og:image:alt`＝英文的 `og.image.alt`。
- **五頁（四頁加 404）的圖示**：`<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">`、`<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">`、
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`、`<link rel="manifest" href="/<語言>/site.webmanifest">`（`/` 與 404 用 `/en/site.webmanifest`）、`<meta name="theme-color" content="#1b1d24">`。
  **不放 SVG 的 `<link rel="icon">`**（`favicon.svg` 檔可以在，`<head>` 不連）。
- **`/` 的 `<h1>`**：三語名稱之間要有分隔（空白或「·」都可以），純文字與讀屏名字都不能黏成「靈感收集器Inspiration Collector…」。
- **`/` 的 JSON-LD 只有一個 `WebSite`**：`url`＝`https://collector.jerromy.com/`、`name`＝英文的 `meta.siteName`、`alternateName`＝中文與日文的 `meta.siteName`（Google〈Site names〉：放在網域首頁、一個網站一個名稱）。不放軟體與常見問題（在語言頁，不重複）。
- **三語頁的 JSON-LD**（`<script type="application/ld+json">`，可以一段或好幾段、可以用 `@graph`）：`@context` https://schema.org；
  `SoftwareApplication`（name＝`meta.siteName`、description＝`meta.desc`、applicationCategory BrowserApplication、operatingSystem 只有 Windows 與 macOS、offers 一個 Offer 價格 0 有幣別、installUrl＝商店頁、image 是正式網址底下的圖、author 指到作者，可以用 `@id`）；
  `Person`（name＝`author.name`、url＝`content/links.md` 的 blog、url 與 sameAs 合起來包含 links.md 每一個好的連結）；**不放 `WebSite`**（在 `/`）；
  `FAQPage`（七個 Question，name＝`faq.N.q`、acceptedAnswer 的 text＝`faq.N.a`，跟字串表同一份）。不放評分、評論、VideoObject。
- **「/」分流**：`/` 的 `<head>` 裡一支**外部的同步 .js**（沒有 async、defer、type="module"；檔名由前端決定，測試從 `<head>` 的 `script[src]` 找、讀那支檔要有 `collector-lang` 與 `location`），
  在畫面出來之前跳：localStorage 的 `collector-lang`（`zh`／`en`／`ja`）優先，否則瀏覽器語言 zh* → `/zh/`、ja* → `/ja/`、其餘 → `/en/`；query 與 hash 帶過去；只導航一次；
  跳之前「/」的字與圖一個都不畫出來（離開前沒有 first-contentful-paint）。localStorage 擋掉照樣跳。`/zh/`、`/en/`、`/ja/` 永遠不跳。關掉 JS 時 `/` 有三顆連到 `/zh/`、`/en/`、`/ja/` 的連結（字是各語言的 `root.pick`）。
- **404**（`out/404.html`）：`<meta name="robots">` 有 noindex；三語各一段（`lang`＝zh-Hant／en／ja），各一個連到 `/<語言>/`（從根目錄算）的 `404.home`。
- **`public/` 該有的檔**（build 之後在 `out/`）：`sitemap.xml`（三個語言頁、每個 `<url>` 五條 `xhtml:link`、不含 `/`）、`robots.txt`（`User-agent: *`、沒有非空的 Disallow、`Sitemap: https://collector.jerromy.com/sitemap.xml`）、
  `favicon-16.png`、`favicon-32.png`（跟擴充的 `icon-16.png`、`icon-32.png` 位元組一樣）、`apple-touch-icon.png`（180、不透明）、`icon-192.png`、`icon-512.png`（透明角）、`icon-maskable-192.png`、`icon-maskable-512.png`（不透明）、
  `zh/`、`en/`、`ja/` 底下各一份 `site.webmanifest`（name＝`nav.brand`、short_name＝`manifest.shortName`、lang、start_url、scope `/`、display browser、theme_color 與 background_color #1b1d24、四個 icons）。分享卡圖 `og/og-<語言>.png` 在圖示與分享卡圖那一段才放。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F2.1 hreflang、canonical、標題層級 | `seo.test.js`、`root-redirect.test.js` | 四頁的 hreflang 五條、canonical 一條指到自己；每頁一個 `<h1>`、不跳層（送出來的 HTML）；`/` 的 `<h1>` 三語名稱之間有分隔（送出來的純文字與讀屏名字各量一次）；三語頁帶 `?ref=x` 開、React 接手之後 canonical 還是只有一條、不帶 query |
| F2.2 標題、說明、分享卡 | `seo.test.js` | 四頁的 `<title>`、description（中日 ≤ 30 字寬、英文 ≤ 60 字母；`/` 是三語三句）、`/` 沒有 noindex、Open Graph 十一項與 `og:locale:alternate`、`twitter:card`；`og:url`＝canonical。分享卡圖檔、twitter:image、404 的分享卡圖在 F8.5f |
| F2.3 結構化資料 | `seo.test.js`、`structured-data.test.js` | 三語各一條：JSON 讀得起來、沒有「<」、@context、每個節點有 @type；軟體、作者、常見問題七題（跟字串表一致），不放 WebSite、評分、評論、影片（離線檢查，不打網路）。`/` 一條：只有 WebSite、url 網域根、name、alternateName。跳不出 `<script>`：暫存複本把英文 faq.1.q 改成含 `</script><script>…</script>` 再 build 一次，JSON-LD 照樣讀得起來、題目讀回來一字不差、假的 `<script>` 沒有跑出來 |
| F2.4 「/」分流 | `root-redirect.test.js` | 靜態：`<head>` 有外部同步 .js 做分流；瀏覽器語言 zh-HK、zh-CN、zh-TW、zh、ja、ja-JP、fr、en-US（各一條：到哪、只跳一次、「/」沒畫出來）；query 與 hash；選過的語言優先（ja、zh、en；不認得的值照瀏覽器）；localStorage 擋掉；三語頁不跳；關掉 JS 有三顆連結 |
| F2.5 404 | `seo.test.js` | `<meta name="robots">` 剛好一條、有 noindex（2026-10-04 從「有一條就好」收緊：Next.js 的 404 自己會放一條，自己再寫一條就重複；放回兩條紅在「得到 ["noindex","noindex"]」）、三語各剛好一個 `<li lang>`、各剛好一個連到自己語言頁的回首頁、三個連到不同的頁（另見 F1.9 的 lang）。2026-10-04 改：原本抓 body 裡第一個標那個 lang 的元素，404 照設計稿做好之後抓到的是 `<h1>` 裡的大標那一段（裡面沒有連結）；改成只認 `<li>`。放回錯誤：三個都連 `/zh/`、日文那一段少了 lang、英文那一段多一個連結、連結寫成 `../ja/`、拿掉 noindex，各紅在那一步（「拿掉 noindex」要連 build 出來的那一條一起刪：只刪 `global-not-found.js` 的 `robots: { index: false }` 測試照樣綠，因為 Next.js 的 404 自己還會放一條 noindex —— 行為沒變，測試是對的；4-f8b 修正之後 `global-not-found.js` 就不寫這條了） |
| F2.6 網站地圖與 robots | `seo.test.js` | sitemap 三個 `<loc>`、各五條 `xhtml:link`；robots 全部允許、有 Sitemap |
| F2.7 圖示一套 | `seo.test.js` | 五頁 `<head>` 的五樣、不連 SVG；圖檔寬高（PNG 檔頭）、四個角的透明度（開瀏覽器量）、16 與 32 跟擴充一樣；三份 manifest |

**F1b.1 改了一條（2026-10-03）**：原本 `dangerouslySetInnerHTML` 只准放 `bindTail(…)` 的輸出；結構化資料只能這樣放進 `<script type="application/ld+json">`，所以加一個例外：前面是 `application/ld+json`、內容是 `JSON.stringify(…).replace(/</g, '\\u003c')`，連換成的字（轉義寫法 `'\\u003c'`）一起比對 —— 換成「<」本身等於沒跳脫，也要紅。字串表本來沒有「<」，只看真的 out/ 量不出跳脫有沒有用，所以另外有 `structured-data.test.js` 用改過的字串 build 一次量行為。

**加 SEO 標記不能改到畫面**：這一段不新寫版面的測試，整套照跑當保險 —— CLS（F4.6、F4.6b）、逐行對設計稿（F4.4）、十二種寬度的版面（F3.9、F4.5）都要照樣綠。

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：一個放 `<head>` 標記與 JSON-LD 的元件、`/` 的分流 .js、`public/` 的網站地圖、robots、三份 manifest、設計稿參考的圖示 PNG、404 的圖示；F2 全綠之後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| hreflang 少 `zh` 那一條 | F2.1 hreflang：四頁各「hreflang="zh" 要指到 https://collector.jerromy.com/zh/，得到 沒有」 |
| canonical 少結尾斜線 | F2.1 canonical：「zh：canonical 要是 https://collector.jerromy.com/zh/」；F2.2：og:url 跟著不對 |
| 開頁之後程式把 canonical 改成目前網址（帶 `?ref=x`） | F2.1 帶 ?ref=x：「canonical 要是 https://collector.jerromy.com/zh/、只有一條，得到 [\"http://127.0.0.1:…/zh/?ref=x\", …]」 |
| 分流改寫成內嵌腳本 | F2.4 靜態：「「/」的 <head> 要有外部的同步 <script src>…」；F3.9：「自己寫的程式要放外部 .js」 |
| 分流不讀 localStorage | F2.4 選過的語言優先三條：「collector-lang＝ja、瀏覽器語言 fr 要到 /ja/，得到 /en/」 |
| 404 拿掉 noindex（Next.js 的 404 自己會放一條；量的時候把 build 出來的那一條也刪掉） | F2.5：「404 要有 <meta name="robots" content="noindex">，得到 []」 |
| sitemap 多列 `/` | F2.6 sitemap：「<loc> 要剛好是三個語言頁，得到 …、https://collector.jerromy.com/」 |
| `/` 的 description 只剩英文那句 | F2.2 標題與說明：「root：description 要剛好一條「Web clipper … / 給 AI 讀的網頁剪藏… / AI エージェント…」」（og:description 本來就只用英文那句，不跟著紅） |
| `/` 加 noindex | F2.2：「「/」不可以有 noindex，得到 ["noindex"]」 |
| `/` 的 og:description、twitter:description 改回三句 | F2.2 分享卡：「root：og:description 要是「Web clipper for AI agents…」」與 twitter:description 兩處 |
| 語言頁也放 WebSite | F2.3 三語：「語言頁不放 WebSite（網站名稱只放在首頁「/」，一個網站一個名稱）」 |
| `/` 的 WebSite.url 指到 `/en/` | F2.3 「/」：「WebSite.url 要是網域根 https://collector.jerromy.com/，得到 https://collector.jerromy.com/en/」 |
| JSON-LD 的跳脫換成 `.replace(/</g, '<')`（什麼都沒換） | F1b.1：「要放 JSON.stringify(…).replace(/</g, '\\u003c')」；F2.3 跳不出：「字裡的 <script> 跑出來變成真的標籤了」 |
| `/` 的 `<h1>` 三個名字之間不放分隔 | F2.1：「<h1> 的純文字「靈感收集器Inspiration Collectorインスピレーション・コレクター」：…黏在一起」 |
| robots 擋 GPTBot | F2.6 robots：「不能擋任何東西（含 GPTBot、ClaudeBot、PerplexityBot 這類 AI 爬蟲），得到 Disallow: /」 |

### 已知限制

- JSON-LD 是離線檢查我們要的欄位與型別，不是 schema.org 驗證工具與 Google 複合式搜尋結果測試本身；上線前還是要照規格書 §10.5 兩個工具都跑（軟體那一項預期會因為沒有評分被標成不符合特別結果）。
- 「/」沒有畫出來量的是 first-contentful-paint（字與圖）；整片底色有沒有先閃一下沒量。
- 瀏覽器語言用 Playwright 的 `locale`（`navigator.language`）；`navigator.languages` 有好幾個的情況沒量。
- 標題層級量的是送出來的 HTML 裡的 `<h1>`～`<h6>` 順序；13 區等還沒做的區塊做好之後照樣守。
- 分享卡圖檔、圖示的長相（設計審查員逐一看）不在這裡；分享卡實際貼到 FB、Threads、LINE、X 看預覽是上線前的人工檢查。
- 16、32 的小圖跟擴充的 `icon-16.png`、`icon-32.png` 位元組一樣：只有網站旁邊有 `clipper/icons/`（現在這個 repo）時才量；搬進公開 repo、沒有 `clipper/` 時這一項自動不量（不紅也不 skip，只是少比一項）。
- 404 的 noindex：Next.js 的 404 頁本來就會自己放一條 noindex，所以前端拿掉自己寫的那條也不會紅；這條守的是之後換做法（例如自己產 404.html）時別漏掉。

## 07 為 AI 做的與 GoatCounter（F5）

設計稿第四批（ba016e9）的 {zh,en,ja}/index.html 07 那一段、`home.css`「07 為 AI 做的」、`動態.md` 07 那張表；規格書 §5-07、§8、§11。
右邊「AI 開始打字」的動畫是之後另一段；現在那個位置放靜態的大綱圖（設計稿的樣子），這裡只量它不壞版面。

### 介面約定（前端照這個做）

- **07**：`<section data-section="forai" id="for-ai">`。字串表的每一段字畫在 `data-id="<id>"` 的元素裡：`forai.eyebrow`、`forai.title`、四點 `forai.1`～`forai.4`（每一點一個 `<li>`，前面的括號小記號畫在 `<li>` 的 `::before`）、
  `forai.agents`（AI 工具那一排的 `<ul>`，`forai.agents` 用「、」或「, 」切開，一個名字一個 `<li>`，3px 圓角、不換行的小標籤）。
- **資料夾樹**：`[data-tree]`（`role="region"`、`tabindex="0"`、`aria-label`＝`tree.label`），七行各是一個 `[data-line]`，照 tree.* 的字。
  跟著捲動一行一行長出來、往回捲收回去（設計稿用捲動時間軸 `animation-timeline`，不聽 scroll 事件）；減少動態時七行一直是 1；放不下時在自己的框裡左右滑、右邊淡出，捲到最右邊淡出收掉。
- **樹的細節（設計稿 350fdf4，F5.6～F5.8）**：右邊 30 的內距要算進捲動範圍（`<pre>` 照內容撐開、至少跟框一樣寬）—— 捲到最右，最右的字到框的右內緣 ≥ 15；
  鍵盤停在樹上（`:focus-visible`）時拿掉淡出，螢光綠焦點框整圈畫得出來；檔名欄 13 個字寬（MATERIAL.md 11 個字加 2 個空白），說明欄四行對齊；
  框線字（├ └ ─）沒有的時候用跟 JetBrains Mono 同寬的回退字（網站的 `JetBrains Mono Fallback`）；1024～1279 樹用整欄寬、左右內距 24，1280 起 84%、內距 30；
  英文 1024 起、日文 1024 樹放得下（不用捲、右邊不淡出）。測試量排出來的尺寸（`page-helpers.js` 的 `TREE_GEOMETRY`），不綁 class 名稱。
- **大綱圖**：07 裡 `src` 有 `ai-outline` 的 `<img>`：`srcset` 剛好是 `images.json` 裡 `ai-outline-<語言>.png` 那一筆 `sizes` 的檔名與寬度（不寫死尺寸，跟 F6b.2 同一個寫法）、`alt`＝`forai.outline.alt`、寫 `width`／`height`、`loading="lazy"`。
- **排法**：1024 起樹（與大綱圖）在左、四點在右，都在大標下面；更窄時四點在上、樹在下。
- **GoatCounter**：站台代碼放 `app/site.js` 的 `export const GOATCOUNTER_CODE`（空字串＝還沒開帳號，不載入、不送請求；不寫死假代碼）。
  有代碼時三語頁的 `<head>` 放 `<script async src="//gc.zgo.at/count.js" data-goatcounter="https://<代碼>.goatcounter.com/count">`（外部、async）。
  要數的按鈕加 `data-goatcounter-click="<名字>"`，名字照規格書 §11：現在頁面上有的是 `install-nav`（導覽列的加到 Chrome）、`install-hero`（首屏的加到 Chrome，`data-id="hero.cta"`）、
  `install-mobile-hero`（手指框「用的是電腦？」那個連結）、`share-hero`（`data-share`）、`mail-hero`（`data-id="hero.mail"`）、`social-<代號>-menu`（☰ 選單裡的社群圖示，代號照 content/links.md）。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F5.1 資料夾樹 | `forai.test.js` | 三語：結構（section id、role、tabindex、aria-label、七行的字）；1440 與只有手指 390：從樹剛要進畫面捲到樹的頂在畫面 20%，分 16 步量七行的透明度 —— 一開始都透明、最後都是 1、只增不減、中間有一部分出來、照順序出來，捲回去又都透明；減少動態：沒捲與捲到都是 1、沒有在跑的動畫；關掉 JS 捲到中間七行都看得到；280、320、390 只有手指：在框裡滑（280 一定放不下）、右邊淡出、捲到最右邊淡出收掉、整頁不橫捲；程式不聽 scroll 事件（靜態掃描） |
| F5.2 大綱圖與四點 | `forai.test.js`、`fixtures/design-6511462.json` 的 `forai` | 三語：srcset 兩個 webp、alt、寬高、lazy；四點的括號記號（`::before`，寬高跟設計稿一樣）、沒有 checkbox；AI 工具的名字與順序、3px 圓角（跟設計稿一樣）、不換行、字不跑出框；十二種寬度的左右／上下排法 |
| F5.3 GoatCounter | `goatcounter.test.js` | `GOATCOUNTER_CODE` 在而且是空的；代碼空：out/ 沒有 GoatCounter 的 script、開三語頁沒有往 GoatCounter 的請求、沒有頁面錯誤；有代碼（暫存複本換成 collector-test 再 build）：三語各一支 async 的外部 script、data-goatcounter 對；三語：現在有的六種按鈕各剛好一個、放在對的元素上。還沒做的區的名字是 todo（15 區 install-final、install-mobile-final、share-final、mail-final；16 區 install-footer、blog-footer、social-*-footer、report、頁尾那句說明；14 區 blog-author、social-*-author；11 區 blog-news；09 區 tutorial-<章>） |
| F5.4 文案 | `forai.test.js`、`fixtures/design-lines-07.json` | 三語 × 十二種寬度：小標、大標、四點的每一行跟設計稿一樣（`tools/measure-design.mjs` 量的）；四點中日文每行 5～25 字寬、行首沒有孤標點，英文沒有只有一個字的行 |
| F5.6 樹的右內距與排法 | `forai-tree.test.js`、`fixtures/design-6511462.json` 的 `tree` | 三語 × 有滑鼠十二種寬度＋只有手指 280～1280：最右的字到框的右內緣 ≥ 15（能捲的捲到最右再量）；三語 × 有滑鼠十二種寬度：樹寬／欄寬、左內距、說明欄的 x（四行對齊）跟設計稿一樣 |
| F5.7 樹的焦點框 | `forai-tree.test.js` | 三語 × 有滑鼠 390、1440：Tab 停在樹上、`:focus-visible` 成立；截圖量框外 3px 那一圈的上、左、右緣（下緣在 1440 被大綱圖疊住，不量）每邊至少兩點是螢光綠，對再外面的底色對比 ≥ 3:1 |
| F5.8 桌機英日放得下 | `forai-tree.test.js` | 英文 1024、1280、1440、日文 1024：不用捲、右邊 48px 拿掉 mask 前後截圖每個像素差 ≤ 24（沒有淡出；有淡出時差一百以上）；英文 280～430、日文 280～414：能捲、有淡出 |
| F5.5 通用 | `forai.test.js`（另見 F1.5 色碼、F3.9 內嵌腳本） | 三語 × 十二種寬度、減少動態：整頁不橫捲、07 的區塊不重疊、捲到之後沒有在跑的動畫（跟著捲動走的動畫不算：樹右邊的淡出跟著手指，設計稿說減少動態時照樣有）；關掉 JS（390、1440）07 每一段字都在、看得到 |

**首屏的 CLS 不能退步**：07 在首屏以下，不影響首屏，但 F1.5、F4.6、F4.6b 照樣要綠（整套照跑）。

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：照設計稿的 07 元件（CSS 照抄設計稿那一段）、`app/site.js` 的 GOATCOUNTER_CODE、有代碼才放的 script、六種按鈕的 data-goatcounter-click；F5 全綠、整套照跑之後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 樹改成 IntersectionObserver 一進畫面就照時間播一次（不跟著捲動、不收回去） | F5.1 跟著捲動，三語 × 兩種寬度：「捲回去之後七行要收回去（透明），得到 1.00 1.00 …」；「要一行一行長出來…得到 0,0,0,7,7,…」 |
| 樹不在自己的框裡滑（`overflow-x: visible`、`min-width: max-content`） | F5.1 太寬：「280：樹的 overflow-x 要是 auto 或 scroll」「整頁橫捲 134px」；F5.5 通用：整頁橫捲 |
| 減少動態時樹照樣跟著捲動長出來 | F5.1 減少動態：「沒捲之前七行透明度都是 1，得到 0 0 0 0 0 0 0」 |
| 代碼空的時候照樣放 GoatCounter 的 script | F5.3 代碼空：「en/index.html：{"async":"","src":"//gc.zgo.at/count.js","data-goatcounter":"https://.goatcounter.com/count"}」；開頁時往 gc.zgo.at 送了請求 |
| install-hero 放到「看教學影片」那顆 | F5.3 三語：「install-hero：放錯元素（<a … href="#tutorial" …）」 |
| 大綱圖的 srcset 少 640 那個 | F5.2 大綱圖：「srcset 要有「/images/ai-outline-zh-640.webp 640w」」 |
| `<pre>` 拿掉 `width: max-content` | F5.6 三語：「en 280 有滑鼠（能捲，捲到最右）：最右的字到框的右內緣 -0.4px，要 ≥ 15（設計稿 29.6）」；F5.8 窄：「ja 414：樹要能滑」 |
| 鍵盤焦點時不拿掉淡出的 mask | F5.7：「zh 390 上緣：三點裡只有 0 點看得到螢光綠焦點框」等 18 處 |
| 檔名欄改回 19 個字寬 | F5.6 排法三語：「說明欄的 x 256.8，設計稿 206.4」 |
| 1024～1279 的樹也用 84% 寬 | F5.6 排法：「1024：樹寬／欄寬 0.840，設計稿 1.000」；F5.8：「en 1024：樹要放得下、不用捲（scrollWidth 434 > clientWidth 368）」 |

### 已知限制

- F5.7 的焦點框量的是截圖上框外 3px 那一圈的顏色；下緣在桌機被大綱圖疊住，不量。對比是那一點跟再外面 8px 的底色比。
- F5.8「右邊沒有淡出」量的是拿掉 mask 前後截圖的差：有 mask 但沒淡出時合成會差個位數（量到 6），門檻定 24；淡出時最右邊差一百以上。
- 「一行一行長出來」量的是捲動到幾個位置時的透明度（每步等兩個畫格），比的是設計稿的捲動時間軸那種「捲到哪長到哪」；用 IntersectionObserver 一進畫面就照時間依序播的做法，中間那幾步會全部是 0 或全部是 1，這條會紅。
- 樹右邊的淡出量的是 mask-image 在最左與最右時不一樣，沒量淡出的寬度與長相（設計審查員看）。
- 括號小記號量的是 `::before` 的寬高跟設計稿一樣，裡面畫的是不是括號沒量。
- GoatCounter 有代碼時真的送出去的請求沒量（不打網路）；點按鈕時有沒有送出 click 事件要上線後在 GoatCounter 後台看。
- `social-<代號>-menu` 的「menu」這個位置名稱規格書沒寫（規格書只舉了 footer），是這裡定的。

## 05 三步驟、06 能收什麼、08 隱私、15 最後的安裝（F6）

設計稿 607a536（350fdf4 之上把 08 隱私的措辭限定為「擴充」）的 {zh,en,ja}/index.html 05、06、08、15 那幾段與 `home.css`；規格書 §5-05、5-06、5-08、5-15、§11。對照資料是 `tools/measure-design.mjs` 量的：
`fixtures/design-lines-05-15.json`（逐行）、`fixtures/design-6511462.json` 的 `cards`（05 的步驟、06 與 08 的卡片）與 `cardsTouch`（15 區的手指框）。

### 介面約定（前端照這個做）

- **四區**：`<section data-section="how" id="how">`、`<section data-section="features" id="features">`、`<section data-section="privacy" id="privacy">`、`<section data-section="final" id="install">`；
  DOM 順序是首屏 → 04 → 05 → 06 → 07 → 08 → … → 15。字串表的每一段字畫在 `data-id="<id>"` 的元素裡（how.title、how.pain、how.N.title／body、features.title、features.N.title／body、privacy.title、privacy.lead、privacy.N.title／body、privacy.link、final.title、final.meta、final.cta、final.mobile.lead、final.pc、final.mail）。
- **卡片**：05 的每一步、06 與 08 的每一張卡是一個 `<li>`，裡面有 `<id>.title` 與 `<id>.body`。06 與 08 用同一個卡片元件（內距、圓角、框線、底色一樣）。
  欄數照設計稿：05 640 起三欄、更窄一欄；06、08 1280 起四欄、640 起兩欄、更窄一欄。卡片裡的字到卡片內緣 ≥ 設計內距的一半（設計 30，至少 15）。
- **06 的「看教學 NN」**：`data-id="features.N.more"` 的連結，字是 `features.more` 代入章號，`href="#ch-NN"`、`data-chapter="NN"`，八張依序 03、04、05、06、07、08、09、03。
  06 的字不寫「檔名從內容算出來」、不寫「來源全部保留」（規格書 §5-06）。
- **08**：四張卡（擴充本身沒有伺服器、沒有帳號、擴充本身不追蹤、只碰你挑的資料夾），每一張講的事要在隱私條款（`release/privacy`）裡找得到；`privacy.link` 連到 `https://jerromy.com/privacy/`。
  **主詞要講清楚**：網站本身會用 GoatCounter 數人次、放在 Cloudflare Pages 的伺服器上，所以 08 講「沒有伺服器」「不追蹤」「不會離開這台電腦」的地方，主詞是擴充或你存下的東西
  （`privacy.title` 講你存的東西、`privacy.lead` 講用擴充存下的東西、`privacy.1.title`、`privacy.3.title` 講擴充本身）；08 任何一句講了「沒有追蹤／No tracking／追跡なし」，同一句裡要有擴充。
  **網站 08 是隱私條款的第五份拷貝**：條款改了這裡要跟著改；08 若寫了日期，要跟 `release/privacy` 四份、側邊欄 `_locales` 的 `ui_privacyUpdated` 同一天（測試量那幾處一致）。
- **15**：有滑鼠時是 `final.cta`（連到商店頁）；只有手指時換成 `[data-touch]` 手指框（`final.mobile.lead`、`data-share` 分享鈕、`data-id="final.mail"` 寄給自己、裡面有 `data-id="final.pc"` 的「用的是電腦？」連結、`data-share-urlbox` 網址框），
  分享的行為跟首屏一樣（`navigator.share` → 剪貼簿＋「已複製」→ 都不行時手指框加 `touch--noshare`、焦點移到網址框）。
  計數名字：`install-final`、`install-mobile-final`、`share-final`、`mail-final`（`goatcounter.test.js`，已從 todo 轉成必過）。
  「已複製」不管從首屏還是 15 區按，都要浮在最上層看得見：不能放在 `isolation: isolate` 的區塊裡（z-index 出不去，後面的區會蓋住它）。
  15 區也照 F4b.2：只有手指（280～1280）只看得到手指框、有滑鼠（十二種寬度）只看得到按鈕、不橫捲（`touch.test.js`，已從 todo 轉成必過）。
- 首屏與 04 的元素現在只在那兩區裡找（`page-helpers.js` 的 `heroParts().block`）：15 區的手指框跟首屏是同一組元件，`share.fallback` 這類 id 會出現兩次。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F6.1 卡片排法 | `cards.test.js` | 三語 × 有滑鼠十二種寬度：05、06、08 第一排幾張、張數跟設計稿一樣；06 與 08 的卡片長得一樣 |
| F6.2 看教學 NN | `cards.test.js` | 三語：八張的連結字、`href`、`data-chapter`；06 的字串表與畫出來的字都不寫那兩句（三語各一組比對）。點了跳到 09 那一章、從那一章播：`tutorial.test.js` 的 F7.3 |
| F6.3 08 隱私 | `cards.test.js` | 三語：四張卡講的事（畫面）與隱私條款裡支持它的那句（條款那一語）、隱私條款的連結、08 若有日期跟條款一樣；條款日期各處一致（`release/privacy` 四份、`_locales`）。主詞：`privacy.title`、`privacy.lead`、`privacy.1.title`、`privacy.3.title` 三語各有一組關鍵詞（字串表與畫出來的字都量）；08 的每一條字串逐句掃，講了不追蹤的那一句沒有擴充就紅（只掃字串表）。16 區頁尾那句（網站用 GoatCounter、擴充本身沒有追蹤）是 todo |
| F6.4 15 最後的安裝 | `final.test.js`、`goatcounter.test.js` | 有滑鼠三語：大標、說明、加到 Chrome、看不到手指框；只有手指三語：手指框、mailto、用的是電腦？；分享三種情況（navigator.share、已複製、touch--noshare 與焦點）；四個計數名字放在 15 區對的元素上 |
| F6.4「已複製」看得見（2026-10-03 加） | `final.test.js` | 三語 × 只有手指 390、360、768，首屏與 15 區各按一次分享（走複製網址那條路），分享鈕捲到畫面中間、畫面底部各一次：提示框在畫面裡、透明度 1，提示框中心那一點最上面的元素（`elementFromPoint`，量的那一下暫時打開 pointer-events）是提示框自己 |
| F6.5 文案與通用 | `cards.test.js` | 三語 × 十二種寬度逐行跟設計稿一樣、說明文字斷行規則；06、08 卡片與 15 手指框的字到邊；不橫捲、區塊不重疊、44×44、減少動態沒有在跑的動畫；關掉 JS 字都在；區塊順序、`#features` 在。`#tutorial` 在 `tutorial.test.js` 的 F7.5；`#devices`、`#news`、`#changelog`、`#faq` 是 todo |

首屏以下的區塊不影響首屏的 CLS，但 F1.5、F4.6、F4.6b 照樣要綠；新的字級、字重要加進回退字型那一組（整套照跑）。標題層級不跳由 F2.1 守。

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：四區照設計稿的 HTML 結構與 `home.css`，15 區的分享接上首屏那一套；F6 全綠之後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 06 在 1280 起改成三欄 | F6.1 三語：「1280 features：第一排要 4 張，得到 3」 |
| 章號 03、04 對調 | F6.2：「zh 第 1 張：href 要是 #ch-03，得到 #ch-04」、data-chapter、字都紅 |
| 06 的卡片寫「檔名從內容算出來」 | F6.2：字串表 `features.8.body` 與畫面兩處 |
| 08 少一張卡 | F6.3 三語：「08 要有四張卡」 |
| 08 的字串換回 350fdf4 那一版（沒有限定擴充） | F6.3 主詞三語 × 字串表與畫面：「zh 字串表 privacy.1.title「沒有伺服器」沒講到 /擴充/」「en 畫面 privacy.title「Nothing leaves your computer」沒講到 /what you save/i」等 30 處；F6.3 沒主詞的不追蹤：「zh privacy.3.title：「沒有追蹤」講了不追蹤，但同一句沒講是擴充」，英日 `No tracking`、`追跡なし` 同樣紅；F6.3 四張卡與條款那條照樣綠 |
| 15 的分享鈕沒有計數名字 | F5.3 三語：「share-final：要剛好一個元素，得到 0」 |
| 「已複製」留在首屏的 `<section>` 裡（首屏是 `isolation: isolate`，z-index 只在首屏裡有效） | F6.4 看得見：三語 × 三寬度 × 15 區兩種位置「提示框被蓋住了，中心最上面是 section（在 final 裡）」；首屏自己按的那幾組綠。把提示框放到首屏的 `<section>` 外面就全綠 |
| 06 的卡片內距 4px（字貼框） | F6.5 字到邊三語：「字到卡片內緣最近 4px，要 ≥ 15（設計內距 30 的一半；設計稿 30）」 |

### 已知限制

- 08 的主詞量的是每一語一組關鍵詞（「擴充」「what you save」「拡張機能」這類），不是讀懂句子；措辭再改時這組要跟著改。「沒主詞的不追蹤」逐句掃，句子照句號切（英文照句點加空白），標題沒有句號就整條算一句。
- 08「跟隱私條款一致」量的是每張卡講的那件事在條款裡找得到（每一語各一組關鍵句），不是逐字比對；條款改了措辭時這組關鍵句要跟著改。`release/`、`clipper/` 不在（公開 repo）時那幾項不量。
- 字到邊量的是卡片（框線裡面）與 15 區手指框；05 的步驟沒有框，不量。
- 06「看教學」點了之後跳到那一章（沒有影片）、從那一章播（有影片）：在 09（F7.3、F7.9）量。
- 斷行規則裡「一行 5～25 字寬」跟設計稿同一行的不算（設計稿日文 1024 有兩行 25.5）。

## 09 教學影片（F7）

設計稿 6511462 的 {zh,en,ja}/index.html 09 那一段（頁面上是「有影片、還沒按」）與狀態一覽的 ②～⑥（播放中、一章播完、最後一章、手機、還沒有影片 ID）、`home.css`「09 教學影片」、動態.md 09 那張表、
notes/4-4.md 開頭那一節（09 沒有影片那一態的修正）與第 5⁗ 點、strings/README.md「從資料轉進來的字」；規格書 §5-09、§9、§10.5、§11、§14。章節資料是後端產的 `data/chapters.{zh,en,ja}.json`（`[{ id, name, desc, start, end }]`，16 章，秒）。對照資料：`fixtures/design-lines-09.json`（逐行）、`fixtures/design-6511462.json` 的 `chapters`（章節一列的字到邊）。

### 介面約定（前端照這個做）

- **影片 ID**：`app/site.js` 的 `export const TUTORIAL_VIDEO_IDS = { zh: '', en: '', ja: '' };`（一語一支，寫成這一行）。**空字串＝那一語還沒上 YouTube**，是現在的樣子；不寫死假 ID。
  測試在暫存複本把這一行換成三個不一樣的假 ID（11 個字元）再 build，量「有影片」那一種；換不掉（形狀不一樣）就停在那一步。
- **區塊**：`<section data-section="tutorial" id="tutorial">`，排在 08 隱私之後、15 最後的安裝之前；導覽列「教學影片」、首屏「看教學影片」連到 `#tutorial`。
  標題組：`data-id` 的 `tutorial.eyebrow`、大標 `<h2 data-id="tutorial.title">`（**沒有影片時換成 `data-id="tutorial.title.noid"`** 的字）、說明 `data-id="tutorial.lead"`（**沒有影片時換成 `data-id="tutorial.lead.noid"`** 的字：不說「點章名就從那一章開始播」）。09 裡只有這一個 `<h2>`、沒有 `<h1>`、標題不跳層。
- **影片框**：`[data-player]`，16:9，`data-state` 是 `idle`｜`loading`｜`playing`｜`paused`｜`ended`。裡面：
  - 預覽圖 `<img>`，`src` 有 `tutorial-poster-<語言>`，`srcset` 剛好是 `images.json` 裡 `tutorial-poster-<語言>.png` 那一筆（不裁切，640 與 1280），`alt`＝`tutorial.poster.alt`、寫 16:9 的 `width`／`height`、`loading="lazy"`；
  - 有影片時：播放鈕 `<button data-play aria-label="tutorial.play 的字">`；**關掉 JS 時播放鈕不放**（按了也播不了；同首屏）；
  - 沒有影片時：一句 `data-id="tutorial.noid.note"`，沒有播放鈕；放在影片框外面、`[data-player]` 的下一個兄弟（設計稿 5b74044）：手機（< 640）排在框底下（隔 16、離畫面左邊 16；括號角在框內 12～32），640 起疊在框的左下角（左 24、下 24，括號角在框外）。
    括號角畫在 `data-corners` 那個元素（就是 `[data-player]`）上，顏色是 `--color-accent-lime-default`（測試靠這個顏色在截圖裡找括號角）；
  - 播放器程式（`iframe_api`）載不到（被擋、出錯）或過了逾時還沒好（**逾時 ≤ 10 秒**，秒數由前端定、寫在這裡；建議 8 秒）：`data-state` 回到 `idle`、播放鈕放回來、沒有任何章 `aria-current="true"` 或寫「正在播放」、
    影片框裡出現一句看得到的白話說明（`tutorial.apifail`，`role="status"`；640 起框的左上角上 16、左 24，手機蓋滿整個框、不透明、播放鈕 44 在底下正中間而且按得到；焦點留在播放鈕），「在 YouTube 上看」還在、就在影片框底下（≤ 48px）；沒有未接住的錯誤；之後再按播放鈕會重新載入（不要把失敗的那一次記住）。
    逾時從按下去算到播放器 `onReady`（播放器建了卻一直沒 ready 也算，建了一半的播放器拿掉）；程式在逾時之後才到時不自己播，再按就直接用 —— 已經有 `YT.Player` 就不再載，`YT.loading` 正在載就只等它好（`onYouTubeIframeAPIReady` 串接、`YT.ready` 也接），不再插一次 `iframe_api`（真的那一支有防重入，第二次執行什麼都不做）。
    還在等的時候、或失敗之後按章名，也不能把那一章標成正在播放（等真的播起來才標）；
  - 章尾那一層 `[data-endcard]`：標題 `data-id="tutorial.done"`（`%章名%` 換成這一章的章名）、`<button data-id="tutorial.replay">`、`<button data-id="tutorial.next">`（`%章名%` 換成下一章）；
    第 16 章只有 `<button data-id="tutorial.again">`。`data-id` 放在 `<button>` 本身。蓋上時焦點移到「播下一段」（第 16 章是「從頭再看一次」），Esc 收掉；
    手機放不下時往下蓋住章節清單，**不推動版面**（蓋上前後 09 的高度一樣）。
- **在 YouTube 上看**：`<a data-id="tutorial.youtube">`，只有有影片時才有，連到 `https://www.youtube.com/watch?v=<那一語的 ID>`（或 `https://youtu.be/<ID>`）。
- **章節**：`[data-chapters]` 是章節那一欄（標頭 `tutorial.chapters`、`tutorial.total` ＋清單）。每一章一個 `<li id="ch-NN">`（01～16，依序），裡面 `data-id="ch.NN.name"`（章名）、`data-id="ch.NN.desc"`（摘要，收在那一列的 `<details>` 裡，關掉 JS 也在 HTML）、起點 `m:ss`；
  章名與摘要的字跟 `data/chapters.*.json` 一樣（斷行標記照設計稿，逐行要跟設計稿一樣）。摘要的斷行規則照 strings/README.md「從資料轉進來的字」（6511462 改的兩條：③ 每個單位的尾巴數「5 個全形字寬」、日文挪完落在助詞再往前併一個詞；2. 中日文不到 5 個字的句子併回前一句）。
  - 有影片：那一列是 `<button data-chapter="NN" data-goatcounter-click="tutorial-NN">`（規格書 §11 的 `tutorial-<章>`），右邊另一顆摘要開關（`<summary>`）。正在播的那一章 `aria-current="true"`（整個 09 只有一個），那一列裡出現 `tutorial.nowPlaying` 的字；
  - 沒有影片：那一列是摘要的開關（`<summary>`），沒有 `button[data-chapter]`，也沒有 `tutorial-*` 的計數名字。
  - **桌機（1024 起，09 的內容寬 ≥ 960）**：影片在左、章節在右，`[data-chapters]` 的上下緣跟影片框對齊（±1px），16 章都看得到、清單自己捲（`overflow-y: auto`，捲清單整頁不動），沒有「看全部」。
  - **窄的時候（≤ 768）**：影片在上、章節在下，一開始只看得到 01～05，`data-id="tutorial.showAll"` 在一個 `<summary>`（或 `<button aria-expanded>`）裡，≥ 44×44，Enter／空白鍵打得開、收得起，讀屏讀得到展開／收起；關掉 JS 也打得開。
- **06 的「看教學 NN」**（`href="#ch-NN"`、`data-chapter="NN"`）：程式接管（動態.md 09 表「06 跳到 09 的落點」），停下來的位置都在導覽列底下（`scroll-padding-top`，離導覽列下緣 0～40px）、沒被蓋住：
  - 有影片：落在播放器上緣，從那一章播；
  - 沒有影片、寬的時候（清單在影片右邊）：落在播放器上緣，清單（只捲清單）把那一列捲到清單頂（或清單已捲到底），打開那一列的摘要；
  - 沒有影片、窄的時候：落在那一列本身，打開摘要；那一列收在「看全部」裡就先打開「看全部」；
  - 沒有影片時網址的 `#ch-NN` 照樣要換上（F7.3 量 `location.hash`）；關掉 JS 時就是原生的錨點。
- **正在播的章**：清單只捲清單（`scrollTop`），整頁不動；不用會連整頁一起捲的 `scrollIntoView`。
- **播放中使用者自己拖進度**：時間跑出這一章的範圍時，改認時間所在的那一章（`aria-current`、「正在播放」換過去，播到那一章的結尾才停、章尾那一層講那一章），不是當成原本那一章播完了。
- **Esc 收掉章尾那一層之後**：焦點回到影片框（或框裡看得到的元素）或正在播的那一章的按鈕，不是 `<body>`。
- **影片 ID 的格式**：`TUTORIAL_VIDEO_IDS` 的值只准空字串或 `/^[A-Za-z0-9_-]{11}$/`；其他值讓產生網頁（`next build`）失敗，訊息有一行同時講到「格式」（或 format）與是哪一語（語言代碼或那個值）。
- **播放器怎麼載入**：還沒按之前，整頁沒有任何往 YouTube 網域（`youtube.com`、`youtube-nocookie.com`、`ytimg.com`、`googlevideo.com`…）的請求，HTML 裡也沒有連到那些網域的 `<script>`、`<link>`（含 preconnect）、`<iframe>`；滑過播放鈕也一樣。
  按了播放鈕、章名、或 06 的「看教學 NN」才動態載入 `https://www.youtube.com/iframe_api`（YouTube IFrame Player API；整頁只載一次），用 `new YT.Player(...)` 建播放器：
  iframe 在 `https://www.youtube-nocookie.com/embed/<那一語的 ID>`（`host: 'https://www.youtube-nocookie.com'`，或自己放 iframe 再交給 `YT.Player`），參數 `rel=0`、`playsinline=1`（`enablejsapi=1`）。
  按播放鈕從 0:00（第 01 章）播；按章名從那一章的 `start` 播（`seekTo`、`loadVideoById({ startSeconds })` 都可以），播到 `end` 停（每 250ms 左右看一次 `getCurrentTime()`，或用 `endSeconds`），蓋上章尾那一層。
  「重播這一段」回到這一章的 `start`、「播下一段」從下一章的 `start`、「從頭再看一次」從 0:00。換語言（另一頁）播那一語的 ID。
- **結構化資料**：**現在不放 `VideoObject`**（兩種 build 都不放）。規格書 §10.5 的影片要「上傳日期」，Google 的影片標記少了它會報錯，而 ID 本身帶不出上傳日期；要加的時候連同上傳日期放哪裡一起定（todo）。

### 假的 YouTube 播放器（`fake-youtube.js`）的契約

測試**不連 YouTube**。`installFakeYouTube(context)`：

- 頁面載入前（`addInitScript`）把假的 `YT`（`Player`、`PlayerState`）放在 `window.__fakeYT` —— 還不是 `window.YT`，所以網頁要自己去載 `iframe_api`，才量得到「按了才載入」。
- 用 `context.route` 攔下所有往 YouTube 網域的請求：`https://www.youtube.com/iframe_api` 照真的那一支回一小段腳本 —— 第一次執行設 `YT.loading = 1`、`YT.ready`（排隊）、再載播放器本體 `WIDGET_API`（`…/www-widgetapi.js`）；之後再執行什麼都不做（防重入，不會再叫 `onYouTubeIframeAPIReady`）。
  `WIDGET_API` 換上假的 `YT.Player`、`PlayerState`，叫 `YT.ready` 排著的、再叫 `onYouTubeIframeAPIReady`。
  `/embed/<ID>`（播放器的 iframe）回一頁空白；其他（縮圖、統計…）擋掉。每一個請求都記下來（`api`｜`widget`｜`embed`｜`other`）。
- `new YT.Player(元素或 id, { host, videoId, playerVars, events })`：跟真的一樣把元素換成 iframe（`<host>/embed/<videoId>?enablejsapi=1&<playerVars>`）；給的就是 iframe 時照用、從它的網址讀 ID 與參數。之後 `onReady`，`playerVars.autoplay=1` 就開始播；測試把 `window.__ytNoReady` 設成 `true` 之後建的播放器永遠不 `onReady`、不自己播。
- 時間跟著頁面的 `Date.now()` 走（測試用 `page.clock` 快轉）：播放中＝起點＋經過的秒數；`playerVars.start`／`end`、`loadVideoById({ startSeconds, endSeconds })` 照真的算，到 `end`（或整支 543 秒）變成「已結束」。
- 有的方法：`loadVideoById`、`cueVideoById`、`seekTo`（暫停中照樣停著，其他狀態會開始播，跟真的一樣）、`playVideo`、`pauseVideo`、`stopVideo`、`getCurrentTime`、`getPlayerState`、`getDuration`、`getVideoData`、`getVideoUrl`、`getIframe`、`addEventListener`、`destroy`、`mute` 一類（不做事）。
  狀態變了照真的發 `onStateChange`。頁面上看得到 `window.__ytLog`（每一次呼叫）與 `window.__ytPlayers`（建過的播放器）。
- 前端用到上面以外的方法，測試會丟「不是函式」—— 要用的話先講，加進假的那一份。
- 量「播放器程式載不到」（F7.10）時，測試在假的那一層上面再加一層 route 把 `iframe_api` 擋掉（`abort`）或一直不回，重試之前拿掉；一直不回的那幾個在重試之前讓它失敗（瀏覽器可能把同一個網址併進還沒回的請求）。
  量「晚到」時同樣加一層攔住 `iframe_api`（或 `WIDGET_API`），過了逾時才叫那個 route 的 `fallback()` 交回假的那一層。
- 量「自己拖進度」（F7.11）時，測試直接叫假播放器的 `seekTo`（網頁不會知道，只看得到 `getCurrentTime()` 變了）。
- `installFakeYouTube(context, { preloaded: true })`：頁面一打開 `window.YT` 就是載好的樣子（`Player`、`PlayerState`、`loading: 1`、`loaded: 1`），**沒有 `YT.ready`** —— 別的程式先載好了播放器程式。量「已經有 `YT.Player` 就直接用」（F7.10）：拿掉那段的話網頁會插 `iframe_api`（假的那一支看到 `YT.loading` 是 1 什麼都不做）或只等一個不會來的 `YT.ready`，播不起來。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F7.0 設定 | `tutorial.test.js` | `TUTORIAL_VIDEO_IDS` 在 `app/site.js`、三語是空字串、寫成換得掉的那一行 |
| F7.1 不按不載入 | `tutorial.test.js` | 兩種 build × 三語 × 有滑鼠 1440、只有手指 390：整頁捲過一遍、捲到 09（有滑鼠再滑過播放鈕）沒有往 YouTube 的請求、沒有 iframe、沒有頁面錯誤；預覽圖看得到；有影片才有播放鈕（aria-label 對）。送出來的 HTML 沒有往 YouTube 的 `<script>`、`<link>`、`<iframe>`；預覽圖 srcset 照 images.json、alt、寬高、lazy。有影片時按播放鈕：剛好一個 `iframe_api` 請求、一個 iframe 在影片框裡、`youtube-nocookie.com/embed/<這一語的 ID>`、`rel=0`、`playsinline=1`、從 0:00 播、標第 01 章 |
| F7.2 章節 | `tutorial.test.js` | 有影片、三語 × 1440：16 章逐一按 —— 從 `start` 播（±1.5 秒）、這一語的 ID、只標這一章（aria-current＋「正在播放」）；快轉到 `end` 前 1.5 秒還在播、沒蓋；再 2.5 秒：停在 `end` ±1 秒、蓋上章尾那一層（標題、重播、播下一段：下一章的章名；第 16 章停在 8:49、只有從頭再看一次）、焦點在那顆鈕。另外三語：重播、播下一段、Esc、從頭再看一次；中文 → 英文 → 日文（語言切換）各播那一語的 ID |
| F7.3 沒有影片 ID | `tutorial.test.js` | 三語 × 1440、390：沒有播放鈕與「在 YouTube 上看」、大標是 `tutorial.title.noid`、封面那一句、沒有 `button[data-chapter]`；16 章依序、章名與摘要跟資料一樣、寫起點；每一列點了摘要看得到；沒有往 YouTube 的請求、沒有頁面錯誤。06 的八個「看教學 NN」（1440、390）跳到 `#ch-NN` 而且那一章看得到、在畫面裡。有影片：大標 `tutorial.title`、「在 YouTube 上看」連到這一語的影片、16 顆 `button[data-chapter]`、06「看教學 05」從第 05 章播、影片框在畫面裡 |
| F7.4 清單排法 | `tutorial.test.js` | 兩種 build × 三語：1024、1280、1440 影片在左、章節上下緣對齊影片框、清單捲得動（捲到底看得到第 16 章、整頁不動）、16 章看得到、沒有「看全部」；280～768 影片在上、只看得到 5 章、「看全部」≥ 44×44 是 `<summary>`／`<button>`、讀屏 expanded false → Enter → 16 章、true → 空白鍵 → 5 章；關掉 JS（390、1440）16 章章名與摘要都在、390 點「看全部」16 章 |
| F7.5 通用 | `tutorial.test.js` | 逐行：有影片 × 十二種寬度跟 `design-lines-09.json` 一樣（`<details>` 全打開）、說明文字的斷行規則；沒有影片：大標、封面那一句、章名、摘要照斷行規則（整段 ≥ 10 字寬時中日文不到 5 字的行、說明超過 25 字、行首標點；英文一個字一行；跟設計稿同一行的不算）。字到邊：章節每一列字到列左緣 ≥ 設計內距的一半、不壓到右邊的摘要開關（≥ 設計稿的距離與 4 取小、減 0.5）、不超出清單；封面那一句離影片框 ≥ 8px。通用（兩種 build × 三語 × 十二種寬度，收著與全打開）：不橫捲、09 的 data-id 區塊不重疊、控件 ≥ 44×44、控件裡的字沒跑出框、減少動態沒有在跑的動畫。章尾那一層（三語 × 十二種寬度，下一章章名最長的那一章）：鈕 ≥ 44、字不跑出鈕、離影片框 ≥ 8px、不出畫面、不橫捲、蓋上前後 09 一樣高。關掉 JS 字都在、沒有播放鈕。SEO：一個 h2、不跳層、沒有 h1、`id="tutorial"`、16 章章名與摘要在 HTML、沒有 VideoObject。GoatCounter：`tutorial-NN` 剛好在那一章的鈕上。錨點：`#tutorial`、`#ch-01`～`#ch-16`、區塊順序 |
| F7.6 沒有影片時的說明句 | `tutorial.test.js` | 字串表三語：`tutorial.lead.noid` 有字、沒有「點章名就從那一章開始播／Click a chapter to start there.／章名をクリックすると、その章から再生します。」（防呆：那一句在 `tutorial.lead` 裡）。沒有影片 × 三語 × 有滑鼠 1440、只有手指 390、關掉 JS 1440：說明是看得到的 `data-id="tutorial.lead.noid"`、字對、沒有 `tutorial.lead`、09 畫出來的字裡沒有那一句；有影片 × 三語 1440：說明是 `tutorial.lead`、沒有 `tutorial.lead.noid`。F7.5 沒有影片的斷行規則與關掉 JS 兩條也改量 `tutorial.lead.noid` |
| F7.7 手機封面句的位置 | `tutorial.test.js` | 沒有影片 × 三語 × 280、320、360、375、390、430、480、540、639（只有手指、有滑鼠各一次）與 640、768、1024、1280、1440（有滑鼠）：影片框捲到畫面中間，把預覽圖與那一句暫時藏起來拍影片框四周，螢光綠的像素在左下四分之一的外框＝括號角那一塊（防呆：≥ 10×10）；那一句的框（`getBoundingClientRect`）跟它重疊 0 |
| F7.8 章節摘要的斷行規則 | `tutorial.test.js`、`fixtures/design-lines-09.json` | 逐行跟設計稿一樣在 F7.5（逐行表用 6511462 重量）。沒有影片 × 三語 × 十二種寬度、16 章摘要全打開：中日文每一行估寬（全形 1、拉丁字母與數字 0.55、其他半形字 0.3；標點與空白不算）≥ 5，除了設計稿自己放不下的 5 處（中文 280、320 的第 04 章「一段一筆。」、280 的第 08 章「xlsx、py、md」、第 15 章「「頁面功能」」、第 16 章「（當場檢查）、」）；一行估寬（標點也算）≤ 25；日文第二行起的行首不是 Segmenter 單獨切出來的助詞（をにがはでとのもへや）；英文沒有一個字一行；三語每個字都在摘要的框與清單看得見的範圍裡 |
| F7.9 06 跳到 09 的落點 | `tutorial.test.js` | 三語 × 只有手指 390、有滑鼠 1024、1440 × 03、07、09（06 的第 1、5、7 張）：先只捲整頁把連結放到畫面中間再點，等整頁與清單都停下來。沒有影片：寬的時候播放器上緣不被蓋住（`elementFromPoint` 在上緣下 2px 拿到的是播放器裡的東西）、離導覽列下緣 0～40px，那一列離清單上緣 ≤ 24px（或清單已捲到底）；窄的時候那一列上緣一樣量；兩種都要看得到那一章的摘要。有影片：從那一章播、播放器上緣同上、寬的時候那一列在清單裡看得到。有影片 × 三語 1440：按清單裡第 07、09、03 章（那一顆在清單捲動範圍外時先只捲清單），整頁 `scrollY` 不變、那一列在清單裡看得到。關掉 JS（兩種 build × 三語 × 390、1440）：`href` 是 `#ch-NN`，點了 `location.hash` 換上、那一章在畫面裡 |
| F7.10 播放器程式載不到 | `tutorial.test.js` | 有影片 × 三語 × 1440，裝 `page.clock`：`iframe_api` 擋掉、一直不回各一次。按播放鈕（一直不回那次，等的時候再按第 04 章）→ 快轉 10 秒：`data-state` 是 `idle`、播放鈕看得到、沒有 `aria-current`、沒有章寫「正在播放」、影片框裡有看得到的字、「在 YouTube 上看」看得到而且在影片框底下 0～48px、沒蓋章尾那一層；失敗之後（還是載不到）按第 04 章 → 快轉 10 秒，同上；網路好了再按播放鈕要播起來（`data-state` playing）；沒有頁面錯誤（主控台裡 YouTube 網域的載入錯誤不算）。說明那一句的字串 id（`tutorial.apifail`）與三語的字在 F7.14 量。晚到（三語 × 1440）：攔住第一個 `iframe_api`，快轉 10 秒（失敗態同上）再放行 → 不自己建播放器、停在 idle，**先確認播放鈕看得到（看不到就紅在「沒辦法再按」）**，再按播放鈕要播、`iframe_api` 只載一次；攔住 `WIDGET_API`（停在 `YT.loading`）→ 失敗之後先確認播放鈕看得到再按、再放行 → 要播、`iframe_api` 只載一次；兩種都只有一個 iframe。建了沒 ready（三語 × 1440，`__ytNoReady`）：快轉 10 秒失敗態同上、影片框裡沒有留下 iframe、播放鈕中心 `elementFromPoint` 打得到；正常之後再按要播、只有一個 iframe。**已經有 `YT.Player`、沒有 `YT.ready`**（三語 × 1440，假 YT 的 `preloaded`：一開頁 `YT` 就是 `{ loading: 1, loaded: 1, Player, PlayerState }`）：按播放鈕要播起來、`iframe_api` 一次都不載、只有一個 iframe |
| F7.11 播放中自己拖進度 | `tutorial.test.js` | 有影片 × 三語 × 1440：第 03 章播 2 秒後拖到第 10 章裡（起點＋5 秒）→ 1 秒後還在播、沒蓋章尾那一層、只標第 10 章；第 10 章結尾前 1.5 秒還在播、過了結尾停在 ±1 秒、章尾那一層講第 10 章的章名。第 05 章拖回第 02 章裡，一樣量（要停在第 02 章的結尾，不是第 05 章的） |
| F7.12 Esc 之後的焦點 | `tutorial.test.js` | 有影片 × 三語 × 1440：第 03 章播完、按 Esc：章尾那一層收掉，`document.activeElement` 不是 `<body>`，是影片框裡看得到的元素或第 03 章的 `button[data-chapter]`。只有手指 390（三語）：第 05 章播完、焦點在「播下一段」按 Enter → 第 06 章（收在「看全部」裡）從起點播、影片框上緣沒移（±1）→ 播完按 Esc：焦點是第 06 章看得到的 `button[data-chapter]`（或影片框裡看得到的元素） |
| F7.13 影片 ID 的格式 | `tutorial.test.js` | 暫存複本各 build 一次：zh 填整個網址、en 填 7 個字、ja 填 11 個字但含空白（另外兩語填合格的假 ID）→ build 失敗，輸出有一行同時有「格式」或 format 與那一語的代碼或那個值。三語合格的假 ID（有影片那一份）與三語空字串（現在的 out/）都 build 得過 |
| F7.14 兩句的版位 | `tutorial.test.js` | 載入失敗（有影片 × 三語 × 只有手指 280、320、390，有滑鼠 640、1024、1440；`iframe_api` 擋掉，用鍵盤在播放鈕上按 Enter）：`[data-api-fail]` 是 `role="status"`、字是 `tutorial.apifail`、字在影片框裡、播放鈕中心 `elementFromPoint` 打得到、播放鈕 ≥ 44×44、焦點在播放鈕；手機那一層離框四邊 0（±1）、底色不透明、字離播放鈕 ≥ 8；640 起那一句離框上 16、左 24（±1）、框離播放鈕 ≥ 8。沒有影片（三語 × 只有手指 280、390，有滑鼠 640、1024、1440）：那一句不在 `[data-player]` 裡；手機離影片框下緣 16、離畫面左邊 16（±1）、離右邊 ≥ 15；640 起離框左 24、下 24（±1）、在框裡 |
| F7.15 鍵盤按播放鈕之後的焦點 | `tutorial.test.js`、`page-helpers.js` 的 `FOCUS_BEFORE` | 有影片 × 三語 × 1440：焦點放在 09 前面最後一個 Tab 停得到的東西，按 Tab 走到播放鈕、按 Enter —— 剛按下（播放鈕藏起來、載入中）與開始播放之後，`document.activeElement` 不是 `<body>`／`<html>`、看得到、在 `[data-player]` 裡（含播放器的 iframe）。`iframe_api` 擋掉那一次：快轉 10 秒之後焦點在播放鈕；網路好了再按 Enter，剛按下與播起來之後同上 |

### 放回錯誤驗證（2026-10-03，在暫存複本寫最小的參考實作：09 照設計稿的 HTML 結構與 `home.css` 那一段、章名與摘要的斷行標記照設計稿、一支載入 `iframe_api` 的 `.js`；F7 全綠、整套照跑之後一次放回一種錯）

參考實作整套跑過：F7 全綠；CLS（F1.5、F4.6、F4.6b）、SEO（F2）照樣綠。紅的幾條是參考實作偷懶的地方（讀屏屬性直接用 `getString`、章名用 `dangerouslySetInnerHTML`、照抄的 CSS 少了 `minmax(0, …)`、註解有流程字眼），前端照原本的規則做就不會有。

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 頁面一打開就載入 YouTube | F7.1 不按不載入（有影片）：「zh 有滑鼠 1440：沒按播放就有 2 個往 YouTube 的請求（…/iframe_api、…/www-widgetapi.js）」三語 × 兩種寬度 |
| 章節起點多 5 秒 | F7.2 章節：「第 01 章從 0:00 開始播（8 秒內沒等到；最後：t 12.9）」16 章都紅 |
| 播到 end 不停 | F7.2 章節：「第 01 章：過了 end（0:35）還在播（36.1 秒）」「播完沒有蓋上章尾那一層」 |
| 最後一章不問從頭看 | F7.2 章節（ja）：「第 16 章：要問「最初から見る」，得到 null」「焦點要在「從頭再看一次」」，前 15 章照樣綠 |
| 沒有影片 ID 時仍放播放鈕 | F7.1 不按不載入（沒有影片）：「沒有影片 ID 時不能有播放鈕（得到 1 顆）」；F7.3：同一句 |
| 第 06～16 章沒有 `id="ch-NN"` | F7.3 06 的「看教學 NN」：「跳到 #ch-06 而且那一章在畫面裡（沒有 #ch-06）」（03～05 照樣綠）；F7.5 錨點：「這幾個錨點不是 09 裡那一章的 <li>：ch-06…ch-16」 |
| 清單只有 15 章 | F7.3：「章節要依序 ch-01～ch-16，得到 …ch-15」；F7.4 關掉 JS：「沒有 li#ch-16」 |
| 手機沒有「看全部」（16 章全攤開） | F7.4 手機與平板：「一開始只看得到前 5 章，得到 ch-01,…,ch-16」「要有看得到的「看全部 16 章」」 |
| 章節一列左內距 4px（字貼框） | F7.5 字到邊：「章節的字到那一列左緣最近 9.4px，要 ≥ 10（設計內距 20 的一半；設計稿 25.4）」 |
| 章節一列右內距 8px（起點壓到摘要開關） | F7.5 字到邊：「章名或起點離右邊的摘要開關只剩 -36px」 |
| iframe 用 youtube.com（不是加強隱私模式） | F7.1 按了播放鈕才載入：「iframe 要在 youtube-nocookie.com（加強隱私模式），得到 www.youtube.com」 |
| 章尾那一層不是蓋上去的（推動版面） | F7.5 章尾那一層：「章尾那一層推動了版面（播放中 09 高 1266.5 → 蓋上之後 1462.5）」 |
| 關掉 JS 時播放鈕還在 | F7.5 關掉 JS：「關掉 JS 時不能有播放鈕（按了也播不了；動態.md 09）」（參考實作第一版就是這樣，補了 `html:not(.js)` 才綠） |

**F7.6～F7.13（2026-10-04）**：在暫存複本照設計稿 6511462 寫最小的參考實作 —— `app/data-text.js` 照設計稿 `build.mjs` 的 `backWidth`、`short2` 改兩條規則；沒有影片時說明用 `tutorial.lead.noid`；手機封面句 `bottom: var(--space-40)`；
`tutorial.js` 兩種 build 都載入，沒有影片時接管 06 的連結（打開「看全部」與那一列的摘要、`pushState` 換上 `#ch-NN`、寬的時候先捲清單、整頁捲到 `scroll-padding-top` 底下），有影片時整頁捲到播放器上緣；
`loadApi()` 接 `onerror`、8 秒逾時、失敗時清掉標記放回播放鈕並放一句話；播放中時間跑出這一章就改認那一章；Esc 之後焦點回到那一章的按鈕；`Tutorial.js` 在產生網頁時檢查 ID 格式、不合格就丟錯。
F7.3～F7.13 全綠（F7.5 逐行用重量過的 `design-lines-09.json`）；之後一次放回一種錯：

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 沒有影片時說明寫回 `tutorial.lead` | F7.6 畫出來的說明句：「說明要是 data-id="tutorial.lead.noid"，找不到」「沒有影片時不能用 tutorial.lead」「09 畫出來的字裡有「點章名就從那一章開始播」」三語 × 三種開法；F7.5 沒有影片的斷行規則與關掉 JS：「tutorial.lead.noid 找不到／不在」 |
| 手機封面句寫回 `bottom: var(--space-16)`（離框左 16、下 17） | F7.7：「zh 只有手指 280：封面那一句的框壓到左下角的括號角 16×16.3（那一句離框左 16、下 17；括號角離框左 12～32、下 13.3～33.3）」三語 × 280～639 兩種模式都紅、640 起綠 |
| 尾巴規則改回「最後 5 個字」 | F7.5 有影片（zh）：「280 ch.08.desc：網站 [… "xlsx、py、md 原檔存進","assets/；" …]，設計稿 [… "xlsx、py、md","原檔存進 assets/；" …]」；F7.8（zh）：「280 ch.08.desc：一行估寬 3.60 全形字寬（要 ≥ 5）「assets/；」」（430 也紅）。日文、英文照樣綠，見「已知限制」 |
| 落點不打開那一列的摘要 | F7.9 沒有影片：「zh 只有手指 390「看教學 03」：停下來之後第 03 章的摘要要打開（看得到 ch.03.desc）」三語 × 三寬 × 三章 |
| 落點不讓開導覽列（整頁捲到元素上緣對齊畫面頂） | F7.9 沒有影片：「窄的時候要落在那一列，那一列的上緣被蓋住（那一點是 div（導覽列）；那一列上緣 -0.4、導覽列下緣 65）」；F7.9 有影片：「要落在播放器上緣，播放器上緣被蓋住（那一點是 div（導覽列）…）」 |
| 寬的時候清單不捲到那一列 | F7.9 沒有影片：「en 有滑鼠 1024「看教學 07」：清單要把那一列捲到清單頂（那一列離清單上緣 312px）」 |
| 正在播的章改用 `scrollIntoView({ block: 'start' })` | F7.9 按清單裡的章名：「zh 1440 第 07 章：按章名之後整頁捲了 229px（只能捲清單）」 |
| 載不到時不清掉「正在播放」的標記 | F7.10：「被擋，按了播放之後 10 秒：不能有章被標 aria-current="true"（得到 ch-01）」「不能有章寫「正在播放」」 |
| 原本的 `loadApi()`（沒有 `onerror`、沒有逾時；d8f6c73） | F7.10：「影片框的 data-state 要回到 idle，得到 loading」「播放鈕要放回來」「影片框裡要有一句白話說明」「沒辦法重試（播放鈕看不到）」兩種模式三語 |
| 時間跑出這一章時不改認 | F7.11：「第 03 章拖到第 10 章：拖過去之後要繼續播（狀態 2、284.2 秒）」「不能蓋上章尾那一層（「「存整個網頁」看完了」）」；「第 05 章拖到第 02 章：正在播的要改標第 02 章」「過了第 02 章的結尾（1:01）還在播（62.1 秒）」 |
| Esc 之後不移焦點 | F7.12：「Esc 之後焦點要在影片框（或框裡看得到的元素）或第 03 章的按鈕，現在在 body」 |
| 檢查 ID 格式，但訊息沒講是哪一語 | F7.13 三條：「build 失敗的訊息要有一行同時講到格式（「格式」或 format）與是哪一語」；不檢查格式（d8f6c73）：「zh 的影片 ID 是「https://youtu.be/TstZh000001」（整個網址），build 卻成功了」 |

### 已知限制

- **測試用的是假的 YouTube 播放器，沒有真的連過 YouTube。** 真的播放器有緩衝、廣告、地區限制、iPhone Safari 的全螢幕與自動播放規則，真的 `seekTo`／`endSeconds` 的時間也不會剛好落在整數秒。
  **上線前要用真的影片 ID 在真的瀏覽器看一次**（桌機 Chrome、iPhone Safari、Android Chrome 各一）：每一章按下去從對的時間開始、播到章尾停、章尾那一層、從頭再看一次；`rel=0` 現在只限制「播完推薦同一個頻道」，不是不推薦。
- 時間是 `page.clock` 快轉的，`getCurrentTime()` 是算出來的；「停在 end ±1 秒」量的是程式的判斷，不是影片畫面停在哪一格。
- 06 跳到收在「看全部」裡的那一章，在 Chromium 上是瀏覽器自己把 `<details>` 打開（跳到錨點時會展開）；Safari、Firefox 沒量。
- 「讀屏讀得到展開／收起」量的是 Chrome 的無障礙樹（`<summary>` 與 `aria-expanded` 都算），沒有用真的讀屏軟體。
- 逐行只比「有影片」那一種（設計稿頁面上是那一種）；沒有影片時章節那一列右邊少一顆開關、多一個小箭頭，寬度差幾 px，只照斷行規則量。整段不到 10 字寬的（短的章名、日文「16 章の使い方ガイド」）怎麼斷都會有一行不到 5 字，不量短行。
- 章尾那一層的版面只量「下一章章名最長」的那一章；手機上章尾那一層會蓋住清單，量的是不推動版面、不出畫面，沒量蓋住之後清單還按不按得到（設計就是蓋住）。
- 章節逐一按只在 1440 量（16 章 × 三語）；手機上按章名的路徑在「章尾那一層」那條量（三語 × 十二種寬度各按一章）。
- F7.8 的規則與 F7.5 的逐行都是量排出來的行：6511462 改的兩條規則讓日文 8 章的摘要 HTML 變了，但在十二種寬度排出來的行跟改之前一樣，所以**日文那一半（數字寬、助詞再往前併）放回舊規則量不出來**（中文 04、08 量得出來）。要守住就得另外比摘要的 HTML（網站 `app/data-text.js` 的 `toHtml` 對設計稿的 `.ch__desc`），這次沒寫。
- F7.8 的英文只量「一個字一行」與不超出框：估寬 < 5、> 25 是中日文的規則，設計稿英文本身就有二十多行估寬 < 5（例如「in Chrome.」4.7）、十幾行 > 25。
- F7.8 的 5 處例外綁語言、寬度、章、那一行的字；網站之後在那幾處排得比設計稿好（例外沒出現）不算錯。
- F7.9 的「清單捲到清單頂」容許那一列離清單上緣 ≤ 24px（清單可能有上內距）；有影片時只量「那一列在清單裡看得到」，沒有量捲到頂（動態.md 那一列寫照前端原本的做法：看不到才捲）。
  正在播的章改用 `scrollIntoView({ block: 'nearest' })` 量不出來：清單在畫面裡的時候它只捲清單（試過，綠）；要清單一部分在畫面外才會連整頁捲，這條沒有量那種情況。
- F7.9 量的是減少動態（捲動是瞬間的）；一般動態時是平滑捲動，停下來的位置一樣，沒另外量。
- F7.7 的括號角是在截圖裡找 `--color-accent-lime-default` 的像素（顏色差 ≤ 60）；預覽圖與那一句先藏起來再拍。括號角之後換顏色或改成不是實心的線，要跟著改。
- F7.10 的「說明那一句」只量影片框裡有看得到的字、「在 YouTube 上看」就在影片框底下；字串 id（`tutorial.apifail`）與字在 F7.14 量。逾時的上限 10 秒是測試定的，前端定的是 8 秒（`homepage/site/README.md`「09」）。
- F7.15 的「合理的地方」量的是不在 `<body>`、看得到、在影片框裡；焦點放進播放器的 iframe 也算。鍵盤的起點用 `FOCUS_BEFORE` 放（headless Chromium 裡點一下不會拿到焦點的字，Tab 不會從那裡開始 —— 量過，會從首屏開始）。

## 圖片改吃裁切版（F6b）

**前提**：07 的大綱圖與 05 第 3 張終端機截圖，改用後端裁好的 WebP（`public/images/images.json` 裡有 `crop` 的那幾筆）。
大綱圖三語各 `ai-outline-<語言>-640.webp` 與裁切寬那一張、終端機截圖三語各 `ai-terminal-<語言>-640.webp` 與裁切寬那一張；原本的 `-1280.webp` 已刪。
檔名、寬高與裁切範圍**一律從 `images.json` 讀**，測試不寫死：裁切範圍是設計稿 CSS 實際露出的那一塊、各邊多留一點，後端重出圖時數字會變。
`images.json` 有裁切的那一筆是 `{ width, height（原圖）, crop {x,y,width,height}, sizes [{ file, width, height, bytes }] }`。前端的程式改之前，這兩張圖會 404。

### 介面約定（前端照這個做）

- 兩張圖的 `src` 與 `srcset` 只用 `images.json` 那一筆 `sizes` 的檔，`srcset` 的 `w` 是那個檔的寬；`width`／`height` 屬性的長寬比跟檔案一樣。
- `sizes` 寫圖**實際畫出來的寬**（不是框寬；圖比框寬時照比例放大），在每一個寬度跟實際畫的寬差 ≤ 10%，瀏覽器才挑得對檔。
- CSS 不再在整張原圖上偏移（圖本身就是那一塊；裁切範圍各邊多留的那一點，照 `images.json` 的 `crop` 跟原本露出的位置差多少往回移）；看得到的內容、框的位置大小、圓角、括號角跟換圖之前一樣，05 與 07 的高度不變。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F6b.1 圖檔都在 | `images-crop.test.js` | 三語頁的 HTML 引用的每一個 `/images/*.webp`（src、srcset、preload）在 `out/images/` 與 `public/images/`；開三語頁 1440 與 390、捲到 05 與 07，`/images/` 的請求全部 200，而且兩張圖都抓了 |
| F6b.2 srcset 對得上 | `images-crop.test.js` | 兩張圖的 srcset 剛好是 images.json 那一筆的檔名與寬度；src 是其中一個；沒有 `-1280.webp` |
| F6b.3 sizes 與挑檔 | `images-crop.test.js` | 三語 × 280、390、640、768、1024、1440 × 倍率 1、2、3：sizes 在那個寬度算出來的值（第一個成立的 media 那一項，用暫時的元素量長度）跟圖實際畫的寬差 ≤ 10%；`currentSrc` 是「寬 ≥ 畫的寬 × 倍率」裡最小的，沒有夠大的就是最大的 |
| F6b.4 畫面不變 | `images-crop.test.js` | 跟換圖之前（c5b3787，暫存資料夾現場取出、build）比，三語 × 390、1024、1440：兩張圖的框位置、大小（差 ≤ 0.5px）、圓角、括號角一樣；框的截圖平均差 ≤ 10 階。量之前只捲整頁（`window.scrollTo`），並把圖外面每一層框自己的捲動歸零 —— 不用 `scrollIntoView`，見「已知限制」。c5b3787 不在時 skip；可以用 `F6B_BEFORE_SITE` 指到有那個 commit 的網站資料夾 |
| F6b.5 版面不變 | `images-crop.test.js` | 同上那一版，三語 × 280、390、640、1024、1440：05 與 07 的高度差 ≤ 1px；1440 時兩張圖的 width／height 長寬比跟檔案一樣（差 ≤ 1%）。CLS、逐行等由原本的測試守 |

### 放回錯誤驗證（2026-10-03，在暫存複本照裁切版改：兩張圖的 src、srcset、width／height、sizes 照實際畫的寬寫，CSS 的偏移拿掉；F6b.1～5 全綠）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 大綱圖的 srcset 還寫 `-1280` | F6b.1：「/images/ai-outline-zh-1280.webp 不在 out/」；F6b.2：「還在用 -1280.webp」 |
| 大綱圖的 sizes 寫成框寬 | F6b.3：「280 1x outline：sizes 算出來 248px，圖實際畫 388px」「280 2x：要挑 ai-outline-zh-<裁切寬>.webp，挑了 …-640.webp」 |
| 大綱圖少 `height` | F6b.5：「zh outline：要寫 width 與 height」 |
| 終端機截圖的 CSS 還照整張原圖偏移（顯示錯位） | F6b.4：「zh 390 terminal：框裡的畫面平均差 24.5 階（要 ≤ 10）」（三語 × 三寬都紅，24～25 階）；F6b.5 綠（高度不變） |
| 大綱圖的 CSS 還照整張原圖偏移 | F6b.4：「zh 390 outline：框裡的畫面平均差 28.5 階」（27～29 階）；F6b.5 綠 |

### 已知限制

- **量圖的位置與拍框不用 `scrollIntoView`**：它不只捲整頁，連圖外面 `overflow: hidden` 的框也一起捲（量過：1440 寬捲到畫面中間時，07 的裁切框被捲了 53px；280～1440 捲到中間或底部，05、07 的框被捲 8～262px），
  使用者捲不動那個框，量到、拍到的是使用者永遠看不到的位置。F6b 一律用 `window.scrollTo`（instant）只捲整頁，再把圖外面每一層框的 `scrollTop`／`scrollLeft` 歸零。
  其他測試的 `scrollIntoView` 逐一查過（三語 × 280～1440 × 有沒有觸控，捲到上、中、下）：捲的是區塊、樹、首屏的框、按鈕，都沒有捲到任何一層框；只有捲「圖」時會。新寫的測試要捲圖或框裡的東西，照 F6b 的做法。
- F6b.4 是只守這一次換圖的對照（跟一個固定的舊版本比）；07、05 的長相之後改了就拿掉。
- 截圖比的是平均差，沒有逐點找錯位；框的位置、大小、圓角、括號角是另外量的。

## 10 支援裝置、11 公告、12 更新紀錄、13 常見問題、14 作者與社群、16 頁尾（F8）

設計稿 5b74044 的 {zh,en,ja}/index.html 10～16 那幾段與狀態一覽（11 滿的時候、有一則寫壞、一則都沒有；12 兩版以上、有一條寫壞；14 一條寫壞）、`home.css`「10 支援裝置」與第三批（4-3）那一段；
`strings/README.md`「使用者自己寫的內容」「公告」「更新紀錄的類型標記」「這一條讀不到」「社群連結」「句子裡的連結」；規格書 §5-10～16、§7、§10.4、§10.5、§11、§12、§14。
對照資料用 `tools/measure-design.mjs --only f8` 量設計稿：`fixtures/design-lines-10-16.json`（版型裡的字逐行，13 全打開）、`fixtures/design-f8-1d18ae2.json`（`boxes`：每一段字離那一區左上角的 [x, y, 寬, 高]；`gaps`：框裡的字到框內緣，左右與上下分開，外加框高 `height`）。004264c 是 5b74044 之上只改 14 社群「讀不到」虛線框上下內距的那一版；現在的是 1d18ae2（4-f10 前的設計小項，見「重新產生設計稿的對照資料」）。
寫壞的內容與內容多的情況另外 build 兩份暫存複本（`buildCopy`，專案裡的 `content/`、`out/` 不動，**前端不必加任何環境變數**）：
`tests/fixtures/content-check/bad-entry`（後端的 fixture）與 `fixtures/content-many`（這次加的：五則公告、第二則日期寫壞；五個好的版本＋一個標題寫壞的、1.0.6 有一條寫壞、最後是 1.0.3；類型詞有清單裡的、清單外的短詞、沒有前綴的整句、沒有冒號的；標題與條目故意寫長；社群多一個沒有圖示的 ghost、一行寫壞的 —— 內容比畫面多、按鈕最多的那一種）。

### 介面約定（前端照這個做）

- **六區**：`<section data-section="devices" id="devices">`、`news`／`#news`、`changelog`／`#changelog`、`faq`／`#faq`、`author`／`#author`，DOM 順序 09 → 10 → 11 → 12 → 13 → 14 → 15；頁尾是 `<main>` 後面的 `<footer data-section="footer">`。
- **版型裡的字**畫在 `data-id="<字串表的 id>"` 的元素上，元素對到設計稿的那一個（量位置用）：小標 `<p>`、大標 `<h2>`、說明 `<p>`；10 的卡片標題、說明、「已實測」標籤（`devices.chrome`、`devices.tested` 各出現兩次）、規格表的 `req.<列>.label`（標題）與 `req.<列>`（內容）；
  13 的題目在 `<h3 data-id="faq.N.q">`、答案 `<p data-id="faq.N.a">`；14 的 `author.eyebrow`、`author.name`（`<h2>`，14 唯一的 h2）、`author.bio.1`／`2`、`<a data-id="author.blog">`；16 的 `foot.brand`、`foot.line`、`foot.product`、`foot.help`、七個 `<a data-id="foot.*">`、`foot.affiliation`、`foot.analytics`、`foot.copyright`。連結、按鈕、`<summary>` 的 `data-id` 放在它本身。
- **10**：四張卡各是一個 `<li>`（Windows、Mac 能用，手機平板、Firefox Safari 不行；「可以用／不行」至少給讀屏，字串表 `devices.yes`／`devices.no`）。規格表 640 以下標題在上、內容在下（左緣對齊），640 起兩欄（同一列，內容那一欄左緣對齊）；不橫捲。
- **11**：每一則（好的、寫壞的）一個 `<li data-entry>`，照內容檔的順序；寫壞的 `<li data-entry data-state="unreadable">`（虛線卡，字＝`state.unreadable`，不寫原因）。好的：`<time datetime>`、類別、標題 `<h3>`、內文 `[data-body]`（使用者的換行照留）、有連結時 `<a data-id="news.more" href＝那個網址 data-goatcounter-click="blog-news">`、置頂的 `data-id="news.pinned"`。
  前三則在外面，第四則起收在 11 裡的一個 `<details>`，`<summary data-id="news.older">`，預設收著。
- **12**：每一版一個 `[data-version]`（好的：值是版本號；標題寫壞的：值是空字串，它或它裡面是 `data-state="unreadable"`）；版本號在 `<h3>`、日期 `<time datetime>`；最上面那一個好的版本有 `data-id="changelog.latest"`（整區只有一個）。
  每一條一個 `<li data-item>`：類型標記 `[data-kind]`、內文 `[data-text]`；寫壞的一條，它或它裡面是 `data-state="unreadable"`。前兩版在外面，第三版起收在 12 裡的一個 `<details>`，`<summary data-id="changelog.older">`，預設收著。**不列 1.0.3**（見「要派工人員決定的」）。
- **類型標記**：只有 `strings/README.md`「更新紀錄的類型標記」那三行清單裡的詞（英文不分大小寫）才畫成 `[data-kind]`（螢光綠，`--color-accent-lime-text`），字照內容檔寫的、內文是冒號後面那段；
  其他（清單外的短詞、沒有前綴卻有冒號的整句、沒有冒號的）不畫 `[data-kind]`（或畫成空的），`[data-text]` 是後端給的原句 `raw`。測試從 `strings/README.md` 讀清單，網站照同一份（加詞兩邊一起加）。
- **13**：每一題一個 `<details>`，`<summary>` 裡是題目，答案在同一個 `<details>` 裡；第一題 `open`；答案和 `<details>` 之間不放 `hidden`、`aria-hidden`。答案裡的句子連結：`faq.2.a` → `#privacy`、`faq.4.a` → `#devices`。
  JSON-LD 的 `FAQPage`（`mainEntity` 七題）的問與答跟頁面上的字逐題一樣（空白壓成一個比）。
- **14、16 的社群**：`<ul aria-label＝author.socials>`，照 `content/links.md` 寫對的那幾行的順序，每個 `<a href＝網址 aria-label＝social.<代號>（字串表沒有就用代號）>`、≥ 44×44、`data-goatcounter-click="social-<代號>-author"`／`"social-<代號>-footer"`；寫壞的那一行只在 14 畫 `data-state="unreadable"`，16 與 ☰ 選單直接跳過。
- **14**：照片一張 `<img alt＝author.photo.alt width height>`；`author.blog` 連到 `https://jerromy.com`、`blog-author`。
- **16**：`foot.store` → 商店頁（`install-footer`）、`foot.tutorial` → `#tutorial`、`foot.changelog` → `#changelog`、`foot.privacy` → `https://jerromy.com/privacy/`、`foot.faq` → `#faq`、`foot.blog` → `https://jerromy.com`（`blog-footer`）、
  `foot.report` → `mailto:npc10091983@gmail.com?subject=<mail.report.subject>&body=<mail.report.body，%url% 換成 https://collector.jerromy.com/<語言>/>`（`report`）；語言切換（`role="group"`、`aria-label＝lang.label`，三個連結，自己那一語 `aria-current="page"`）。
  `foot.affiliation`、`foot.analytics` 兩句一定要在 —— `GOATCOUNTER_CODE` 還是空的時候也在（規格書 §16、上線前清單）。

### 案例對應

| 案例 | 檔 | 量什麼 |
|---|---|---|
| F8.1 寫壞的內容 | `f8-content.test.js` | bad-entry × 三語 × 關掉 JS 1440：11 每一則照 `readContent` 的順序（寫壞的那一則是 `data-state="unreadable"`、字＝`state.unreadable`），好的標題、日期、看全文（`blog-news`）、置頂；12 每一版每一條，寫壞的那一條畫讀不到、其他照常；14 寫壞的連結一個讀不到、16 與 ☰ 選單沒有 |
| F8.1 不列 1.0.3 | `f8-content.test.js` | bad-entry、content-many（防呆：內容檔裡有 1.0.3）× 三語：沒有 `[data-version="1.0.3"]`、12 裡沒有「1.0.3」這幾個字；1.0.4 有 |
| F8.1 公告三則與收合 | `f8-content.test.js` | content-many × 三語 × 有滑鼠 1440、只有手指 390：五則 `li[data-entry]`、前三則在外面、第四五則在 `<summary data-id="news.older">` 那個 `<details>` 裡、預設收著看不到；第二則是讀不到；看全文、置頂；第一則內文照使用者的換行（`innerText`）；焦點放到「看更早的公告」按 Enter 打開（第四五則看得到）、再按收起 |
| F8.1 更新紀錄兩版與收合 | `f8-content.test.js` | content-many × 三語 × 1440、390：前兩版 1.0.7、1.0.6 在外面，寫壞的那一版、1.0.5、1.0.4 在 `<summary data-id="changelog.older">` 裡、預設收著；「最新」只標在 1.0.7；1.0.6 第二條讀不到；空白鍵打開之後每一版看得到 |
| F8.1 關掉 JS 打得開 | `f8-content.test.js` | content-many × 三語 × 390：點兩個「看更早的」都打得開，第四五則公告看得到 |
| F8.1 社群 | `f8-content.test.js` | content-many × 三語：14、16 都放 ghost（沒有圖示、字串表沒有名字 → 名字用代號）；寫壞的那一行 14 一個讀不到、16 沒有 |
| F8.2 常見問題 | `f8-sections.test.js` | 三語 × 有滑鼠 1440、390：七題的題目在 `<summary>`、答案在同一個 `<details>`；預設只有第一題打開；焦點放在 13 前面最後一個 Tab 停得到的東西（`FOCUS_BEFORE`），Tab 走到每一題（`:focus-visible` 而且有外框或陰影），單數題 Enter、雙數題空白鍵打開再收起（第一題先收再開）；不橫捲、沒有頁面錯誤 |
| F8.2 結構化資料 | `f8-sections.test.js` | 三語：out/ 的 JSON-LD 剛好一個 `FAQPage`、七題，問與答跟關掉 JS 時頁面上 `faq.N.q`／`faq.N.a` 的字逐題一樣 |
| F8.2 收起來的答案 | `f8-sections.test.js` | 三語：送出來的 HTML 有七個答案的字；390、1440 關掉 JS：答案外面沒有 `hidden`／`aria-hidden`，點題目答案看得到；句子連結 `#privacy`、`#devices` |
| F8.3 頁尾 | `f8-sections.test.js` | `GOATCOUNTER_CODE` 是空的（防呆）時送出來的頁尾有 `foot.affiliation`、`foot.analytics`；三語 × 390、1440 關掉 JS：頁尾在 `<main>` 後面、四句的字與看得到、`foot.analytics` 同時講 GoatCounter 與擴充、六個連結的 href／字／計數名字、回報問題的收件人、標題、內文（%url% 代入）與 `report`、社群照 links.md（`social-<代號>-footer`、≥ 44）、語言切換 |
| F8.3 作者與社群 | `f8-sections.test.js` | 三語 × 390、1440 關掉 JS：`id="author"`、一張照片（替代文字、寬高）、五段字、部落格連結與 `blog-author`、唯一的 h2 是名字、社群（`social-<代號>-author`） |
| F8.4 支援裝置 | `f8-sections.test.js` | 三語 × 有滑鼠十二種寬度：規格表五列 640 以下標題在上、內容在下、左緣對齊；640 起內容在標題右邊、同一列、內容左緣對齊；規格表自己與整頁都不橫捲。三語關掉 JS：四張卡與「可以用／不行」、十四段字跟字串表一樣；不寫 Linux、Chromebook、Edge、Brave、114 |
| F8.6 文案 | `f8-sections.test.js`、`fixtures/design-lines-10-16.json` | 三語 × 有滑鼠十二種寬度（13 全打開）：版型裡的每一段字逐行跟設計稿一樣；說明文字中日文每行 5～25 字寬、行首沒有孤標點、斷行不在詞的中間（`Intl.Segmenter`），英文沒有一個字一行（跟設計稿同一行、同一處斷行的不算） |
| F8.6 版面照設計稿 | `f8-sections.test.js`、`fixtures/design-f8-1d18ae2.json` 的 `boxes` | 三語 × 有滑鼠十二種寬度：每一段字（與 14 的照片）離那一區外框左上角的 x、y、寬、高跟設計稿差 ≤ 1px（13 收著的 2～7 題答案不量） |
| F8.6 字到框邊 | `f8-sections.test.js`、`f8-content.test.js`、`fixtures/design-f8-1d18ae2.json` 的 `gaps` | 三語 × 有滑鼠十二種寬度：10 的卡片、11 的公告卡、三種標籤、到部落格看更多（現在的內容）；「看更早的」按鈕與四種讀不到的虛線框（content-many，收合全打開）—— 字到框內緣左右、上下各 ≥ 設計稿那一邊的內距 − 1（內距寫 0 的那一邊用設計稿量到的距離 − 1）；14 社群讀不到的虛線框另外比框高與上下內距（10.5），跟設計稿差 ≤ 1px（英文 280、日文 280／320 排兩行是 65 高，其他 44） |
| F8.6 通用 | `f8-sections.test.js`、`f8-content.test.js` | 現在的內容、content-many（收合與 13 全打開）、bad-entry × 三語 × 十二種寬度、減少動態：每一區捲到之後 —— 字壓到別的東西（`data-id` 與使用者內容的區塊）、控件 < 44×44（句子連結不算）、控件裡的字跑出框、在跑的動畫；整頁橫捲 |
| F8.6 關掉 JS、順序、錨點 | `f8-sections.test.js` | 三語 × 390、1440 關掉 JS：版型裡的每一段字都在、看得到（收著的答案只量在）；tutorial → devices → news → changelog → faq → author → final → footer；`#devices`、`#news`、`#changelog`、`#faq`、`#author` 是那一區；導覽列連到前四個 |
| F8.6 使用者的字最後一行 | `f8-sections.test.js`、`f8-content.test.js` | 中文、日文 × 十二種寬度（現在的內容、content-many）：公告標題、內文、更新紀錄每一條的最後一行，不算標點至少兩個字 |
| F8.7 類型標記 | `f8-content.test.js` | 清單（`strings/README.md`）三語都讀得到、每個詞夠短；防呆：現在的內容三語都有已知類型與「沒有前綴卻有冒號」的整句。現在的內容、bad-entry、content-many × 三語：每一條跟 `lib/changelog.js` 讀到的比 —— 已知類型畫 `[data-kind]`（字照寫、螢光綠）、內文是 text；其他沒有 `[data-kind]`、內文是 raw |

CSS 沒有寫死色碼（F1.5）、HTML 沒有自己寫的內嵌腳本（F3.9）掃的是全站，這幾區跟著被量，不另外寫。

### 放回錯誤驗證（2026-10-04，參考輸出不是 Next.js：在暫存複本把 `next build` 換成一支產生程式，拿設計稿 5b74044 的三語頁照上面的介面加 `data-section`、`data-id`，11、12、14、16 照 content/ 重畫、JSON-LD 照字串表；F8 全綠（72 條）之後一次放回一種錯）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 寫壞的那一則公告靜靜略過 | F8.1 寫壞的內容三語：「11：要 3 則（寫壞的照樣佔它的位置），得到 2」；F8.1 公告三則：「要 5 則 <li data-entry>…得到 4」；F8.6 字到框邊（content-many）：「badCard：找不到」 |
| 公告不收合（五則全攤開） | F8.1 公告三則三語：「前三則在外面、第四則起收在「看更早的公告」裡，得到 外外外外外」；關掉 JS：「找不到 news.older 的 <summary>」 |
| 1.0.3 照列 | F8.1 不列 1.0.3 兩條：「zh：不列 1.0.3（收合裡也不放）」 |
| 後端的 kind 整句當類型標記 | F8.7 現在的內容三語：「1.0.4 第 6 條…「拿掉選取文字後浮出的按鈕」不在類型詞清單裡，不能畫成類型標記」；content-many：「Misc」；長的 nowrap 標記另外撐破版面（F8.4、F8.6 通用：整頁橫捲） |
| 不認得的類型只畫冒號後面那段 | F8.7：「整句（原句，冒號照使用者寫的）當內文「…」，得到「選起來之後…」」三語 × 兩份內容 |
| 13 第一題預設收著 | F8.2 三語：「預設要只有第一題打開，得到 關關關關關關關」；F8.6 版面：「280 faq.2.q：網站 y 347，設計稿 405」 |
| JSON-LD 第 3 題的答案跟頁面不一樣 | F8.2 結構化資料三語：「第 3 題的答：頁面「…」，JSON-LD「閒置一陣子」」 |
| 回報問題寄到別的信箱 | F8.3 頁尾三語：「收件人要是 npc10091983@gmail.com…，得到 someone@gmail.com」 |
| 頁尾少了 GoatCounter 那一句 | F8.3 代碼空那條：「頁尾送出來的 HTML 裡要有 foot.analytics」；F8.3 頁尾、F8.6 文案、版面、關掉 JS 都紅 |
| 規格表在手機也排成兩欄 | F8.4 三語：「280 browser：手機要標題在上、內容在下」；F8.6 版面與文案 |
| 10 的卡片內距 4px | F8.6 字到框邊三語（devicesCard）、F8.6 版面：「280 devices.win：網站 x 21，設計稿 47」、文案（卡片變寬，換行跟著變） |
| 「看更早的」左右內距 4px | F8.6 字到框邊（content-many）三語：「older：字到框的左右內緣最近 4px，要 ≥ 23」 |
| 日文公告標題不換行（nowrap） | F8.6 內容比畫面多（ja）：「280：整頁橫捲 799px」；F8.6 字到框邊（ja newsCard）、F8.2、F8.4、F8.6 通用（ja）都紅 |
| 寫壞的連結在 16 也畫讀不到 | F8.1 寫壞的內容三語：「16：寫壞的連結直接跳過」；F8.1 社群三語 |
| 13 答案下方的留白從 24 改成 8 | F8.6 版面三語：「280 faq.2.q：網站 y 383，設計稿 405」 |
| 使用者的字不做孤字綁定（不用 bindTail） | F8.6 內容比畫面多（zh）：「320：最後一行只剩一個字「了。」」「360：…「面）」」；現在的 content/ 在十二種寬度剛好沒有孤字，那一條照樣綠 |

**參考輸出就是設計稿本身**，所以這一輪驗的是「量法對、紅在對的地方」，沒有驗「用 Next.js 的元件做得到 ≤ 1px」；前端照設計稿 `home.css` 的數字與結構做，F6、F7 的經驗是做得到。

### 已知限制

- 「版面照設計稿」量的是每一段字的外框（`data-id` 那個元素）離那一區左上角的位置與大小；同一個外框裡的字怎麼排由逐行那一條量。照片、社群圖示、虛線框的位置沒有逐一比（社群量 ≥ 44、字到框邊）。
- 11、12 的版面跟設計稿比只比標題那幾段：使用者的內容會改，卡片與條目的位置不跟設計稿比，改量字到框邊、通用、最後一行。
- 「字到框邊」量的是看得到的字的外框（含行高的上下空間）到框線內緣。
- 拆詞量的是斷行位置在不在 Node 的 `Intl.Segmenter` 詞界上；Segmenter 本身會切錯（例如「素材｜庫」），跟設計稿同一處斷行的不算。
- 13 的鍵盤起點用 `FOCUS_BEFORE` 放（理由同 F7.15）；之後的每一步都是按鍵。
- 「收起來的答案在 HTML 裡」照規格書 §10.4、§13、§14 定；Google 對結構化資料的問答要在頁面上看得到、與收合式答案的說法沒有抓原文核對（未查證）。
- 最後一行的規則只量中文、日文（英文的孤字規則是 bindTail 的兩個字，沒有寫進案例）。

### 發現的問題（設計稿或案例本身的，沒有自己改）

- 設計稿狀態一覽裡「14 一條寫壞」的虛線框（`.bad--social`，44 高、上下內距 0）：英文 280、日文 280、320 的字排成兩行，字離虛線上下只剩 1px（其他寬度 11.5）。測試照設計稿量到的（≥ 0）放行，要不要改由設計師定。
- 派工的案例寫十二種寬度含 480、沒有 430；規格書 §14 與既有測試（`page-helpers.js` 的 `WIDTHS`）是 430、沒有 480。這裡照規格書（430）。

## 「/」與 404 的外觀、分享卡圖與圖示 <head>（F8.5f、F8.6b）

設計稿 90de030 的 `design/homepage/root/index.html`、`404/index.html`（`home.css` 的 `.solo`、`notes/4-3.md`「/」「404」「給前端的事」）、`copy.md`「`/` 三語選單頁」「404 找不到的頁面」、`icons/site/README.md`；規格書 §4、§10.2、§10.6、§10.7、§12、§14。
對照資料 `fixtures/design-solo-90de030.json` 用 `tools/measure-design.mjs --only solo` 量設計稿產生（約 10 秒）。測試在 `solo.test.js`。

**兩頁用哪一種語言**（依據：規格書 §4「這一頁整頁標成英文，中文、日文那兩行各自標自己的語言」、§10.6「`/` 的分享預覽：三語的名稱、英文說明、英文那張圖」、§10.7「三種語言各一個回首頁」；`notes/4-3.md`「整頁 `lang="en"`、三段各標語言」）：
一頁三語並列、`<html lang="en">`；每一段字用它自己那一語的字串表 —— 「/」是 `root.name`、`root.lead`、`root.pick`，404 是 `404.title`、`404.body`、`404.home`。
`<title>`：「/」＝`root.meta.title`（F2.2），404＝`404.meta.title`（三語同一句）。分享卡圖：「/」與 404 都用 `og-en.png`、`og:image:alt` 用英文（404 沒寫在規格書，照「/」）。manifest：兩頁都用 `/en/site.webmanifest`。
404 的 `noindex`：規格書沒寫、設計稿加了（notes 說前端決定）；測試照設計稿要有（F2.5 原本就要）。

### 介面約定（前端照這個做）

- **兩頁同一個結構**（照設計稿；測試不靠 class 名稱，用這組選擇器在設計稿與網站上找同一塊，`page-helpers.js` 的 `soloItems`）：
  `<main>` 裡一個 `<header>`：記號 `<img alt="">`；404 多一個 `aria-hidden="true"` 的「404」；`<h1>` 裡三段依序標 `lang="zh-Hant"`、`en`、`ja`。
  一個 `<ul>`，依序每一語一個 `<li lang>`：一段說明 `<p>`、一顆連到 `/<語言>/`（從根目錄算）的 `<a>`（次要大按鈕）。
- **404 的資產一律從根目錄算**（`/…css`、`/mark.svg`、`/fonts/…`、圖示、manifest、三顆連結）：Cloudflare Pages 在任何深度的網址都回這一頁（`notes/4-3.md`「給前端的事」）。
- **404 的 `<head>`**：分享卡圖（`og:image`、`twitter:image`＝`https://collector.jerromy.com/og/og-en.png`、寬高、英文的 `og:image:alt`）與圖示一組，跟「/」一樣。

### 案例對應

| 案例 | 量什麼 |
|---|---|
| F8.5f 分享卡圖 | 五頁（三語頁、「/」、404）：`og:image`、`twitter:image` 各一條、一樣、是絕對網址 `…/og/og-<語言>.png`（「/」與 404 是 en）；`og:image:width／height` 1200／630；`og:image:alt`＝那一語的 `og.image.alt`（有 `twitter:image:alt` 要一樣）；`out/og/` 三張在、PNG 檔頭 1200×630 |
| F8.5f 圖示一組 | 五頁：favicon-32、favicon-16、apple-touch-icon、manifest 各一條、href 開頭剛好一個 `/`、指到 `out/` 裡在的檔；theme-color 一條 #1b1d24、跟那頁 manifest 的 `theme_color` 同值；manifest 的 `name`＝那一語的 `nav.brand`、`lang` 對、圖示從根目錄算；三份 manifest 的 name 各不同 |
| F8.5f 404 | `<title>`＝`404.meta.title`（防呆：三語同一句）；`<meta name="robots">` 剛好一條、有 noindex（兩條也紅） |
| F8.6b 寬度清單 | `WIDTHS` 是規格書 §14 的十二種（含日文會壞的 320、1024）；對照資料每種寬度都有 |
| F8.6b 版面 | 兩頁 × 十二種寬度（高 900、減少動態；「/」關掉 JS 開 —— 有 JS 會跳走；404 開著 JS 從 `/zh/a/b/c/d/` 開）：每一塊（記號、404、大標三段、說明三段、按鈕三顆）離 `<main>` 左上角 ≤ 1px；每一行的字跟設計稿一樣 |
| F8.6b 字到框邊 | 三顆按鈕：字形框（`EDGE_GAPS`）≥ 設計稿的內距（上下內距寫 0，用設計稿量到的距離）− 1；行盒（`LINEBOX_GAPS`：字形框中線 ± 行高的一半）≥ 設計稿量到的 − 1 |
| F8.6b 通用 | 十二種寬度：不橫捲、各塊不重疊、按鈕 ≥ 44×44、按鈕裡的字沒跑出框；每顆按鈕滑過、焦點之後（減少動態）沒有在跑的動畫；沒有頁面錯誤 |
| F8.6b 文案 | 每一段字跟那一語的字串表一樣；說明文字中日文每行 5～25 字寬、行首沒有孤標點，英文沒有一個字一行（跟設計稿同一行的不算） |
| F8.6b 結構 | 關掉 JS 390：一個 `<main>`、一個 `<h1>`、`<html lang="en">`、`<h1>` 與 `<li>` 依序標三語、每語一個 `<p>` 一顆 `/<語言>/`、記號 `alt=""`、404 的「404」aria-hidden |
| F8.6b 對比 | 390、1440：每一段字對 `background-color` 疊出來的底 ≥ 設計稿 − 0.05 而且 ≥ 4.5（`CONTRAST`，canvas 轉色） |
| F8.6b 404 深路徑 | `/zh/a/b/c/d/`（1440、390）與 200 個 a 的網址（280、320、1440）：伺服器回 404（防呆）、每支 CSS 載到、Google Sans Flex 與 JetBrains Mono 載到、記號載到、圖示與 manifest 從那個網址 fetch 是 200、沒有 4xx 的請求；不橫捲、沒有字超出畫面 |
| F8.6b 「/」關掉 JS | 三顆點下去到 `/zh/`、`/en/`、`/ja/` |
| F8.6b 鍵盤 | 「/」關掉 JS、404 開著 JS，390、1440：從頁首 Tab 三次依序停在中、英、日，`:focus-visible` 而且外框或陰影看得到；390 時在日文那顆按 Enter 到 `/ja/` |

不重寫、只確認沒壞的：分流（F2.4）、「/」的 `<h1>` 不黏字（F2.1）、兩頁的 `<html lang>`（F1.2、F1.9）、HTML 沒有自己寫的內嵌腳本（F3.9）、CSS 只用語意 token 不寫死色碼（F1.5、F3.9 的 `--mira-*`）—— 都掃全站。

### 寫的時候哪幾條是紅的（2026-10-04，工作樹 c32e3ec build 出來的 out/）

| 案例 | 紅在哪 | 為什麼 |
|---|---|---|
| F8.5f 分享卡圖 | 「404：og:image 要剛好一條 …og-en.png，得到 []」與 twitter:image、寬高、替代文字 | 404 還沒放分享卡（還沒做） |
| F8.6b 404 的版面、字到框邊、文案、結構、對比 | 「找不到（main h1 [lang="zh-Hant"]）」這一類 | 404 還是占位的長相（還沒做） |
| F8.6b 404 深路徑 | 「<main> 裡沒有記號」 | 同上（還沒做）；CSS、字型、圖示在深路徑都載得到 |
| F8.6b root 的版面 | 「640 title.zh：網站寬 478.7，設計稿 480」，640～1440 | 對 004264c 量時是紅的：設計稿的問題（見「發現的問題」）；設計稿 90de030 修好、重量之後綠（照樣 ≤ 1px） |

其餘（「/」的字到框邊、通用、文案、結構、對比、鍵盤、關掉 JS 點連結；404 的通用與鍵盤；圖示一組；404 的 title 與 noindex）寫的時候就是綠的：「/」已經照設計稿做好，404 占位的三顆連結從根目錄算、看得到焦點。這幾條靠下面的放回錯誤確認會紅。

### 放回錯誤驗證（2026-10-04，在暫存複本寫最小的參考實作：404 照「/」的元件與 CSS Module 做、加「404」與分享卡；整支全綠之後，一次放回一種錯 —— 多數直接改複本 build 出來的 out/，「說明用錯語言」改原始碼重 build）

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 404 拿掉分享卡 | F8.5f 分享卡圖：「404：og:image 要剛好一條 https://collector.jerromy.com/og/og-en.png，得到 []」 |
| 404 的 manifest 寫成相對路徑 `en/site.webmanifest` | F8.5f 圖示：「manifest 的 href 要從根目錄算」；深路徑：「/zh/a/b/c/d/ 1440：en/site.webmanifest 從這個網址開是 404」 |
| 404 的 theme-color 改 #000000 | F8.5f 圖示：「404：theme-color 要剛好一條 #1b1d24」 |
| 404 的記號寫成相對路徑 | 深路徑：「圖 mark.svg 沒載到」 |
| 404 的 CSS 寫成相對路徑 | 深路徑：「有載不到的東西 404 /zh/a/b/c/d/_next/…css」；版面、對比、通用 |
| 404 按鈕左右內距 4px | 字到框邊：「字形到框的左右內緣最近 4px，要 ≥ 29」；版面：「btn.zh 寬 84，設計稿 136」 |
| 404 說明不換行（nowrap） | 通用：「280：整頁橫捲 127px」；文案：「lead.ja 一行 27.5 字寬」；深路徑：「390：整頁橫捲 17px」；版面 |
| 404 的「404」沒有 aria-hidden | 結構：「<header> 裡一個 aria-hidden 的「404」」；版面、對比：「code：找不到」 |
| 「/」的焦點外框拿掉 | 鍵盤：「390 zh：焦點外框看不到（:focus-visible true、外框或陰影 false）」 |
| 「/」說明的字色淡到 55% | 對比：「390 lead.zh：對比 3.37，設計稿 7.96（至少 4.5）」 |
| 「/」說明拿掉 max-width | 版面：「390 lead.zh：寬 358，設計稿 350」；文案：「430 lead.zh：一行 26.5 字寬」 |
| 「/」中文說明在「不上傳。」前面硬換行 | 文案：「280 lead.zh：一行 4 字寬（要 5～25，少於 5 字要併回上一行）「不上傳。」」；版面 |
| 404 按鈕加一個減少動態也停不下來的動畫（`!important`） | 通用（在跑的動畫）；版面（轉到一半的字換行了） |
| 404 三顆連結寫成 `../zh/` | 結構：「一顆連到 /zh/（從根目錄算）的連結，得到 ["../zh/"]」；鍵盤 |
| 404 的說明三語都用英文（改原始碼重 build） | 文案：「lead.zh：字要是字串表 zh 的 404.body…」；版面 |
| 大標日文那一段改回中文字型（PingFang TC），「/」與 404 各一次（對 90de030 的對照資料） | 版面：「640 title.zh：網站寬 480，設計稿 478.7」；404：「1024 title.zh：網站寬 528，設計稿 526.6」 |

順帶：量對比的 `CONTRAST` 第一版把 canvas 讀回的顏色又除了一次透明度（`getImageData` 本來就沒有預乘），半透明的字色反而算得更亮 —— 「字色淡到 55%」那一條一開始沒紅才抓到；修好之後重量設計稿（當時是 004264c），數字一樣（設計稿的字色都不透明）。

### 發現的問題（設計稿本身的，沒有自己改）

- **設計稿 004264c「/」與 404 的大標日文那一段是用中文字型畫的**：`.solo [lang="ja"]` 只換了 `--font-sans` 變數，而字型是在 `.solo__title`（`<h1>`）上算好再繼承給 `<span lang="ja">`，所以那一段實際是 PingFang TC（量過 computed font-family）。
  網站用日文字型是對的。設計師在 90de030 修好（`home.css` 加 `.solo [lang] { font-family: var(--font-sans); }`），重量之後只有大標三段的寬變了（「/」640～768：480 → 478.7、1024 起 720 → 718.1；404 320～1440 也小一點，1024 起 528 → 526.6），跟網站一模一樣；其他位置、行、內距、對比都沒變。
  先前為這件事在版面那條加的「大標寬放寬 2px」例外已經拿掉，全部回到 ≤ 1px。

### 已知限制

- 對比只算 `background-color` 疊出來的底，不算 `.solo::before` 的光暈（7% 螢光綠的漸層）與圖。
- 「字壓字」量的是記號、404、大標三段、說明三段、按鈕三顆這幾塊的外框有沒有重疊。
- 404 的 HTTP 狀態碼不測（靜態站由主機決定）；測試伺服器回 404 只是防呆，確認量到的是 404 頁。
- 長網址那條：404 頁本身不顯示網址，量的是網址再長頁面也不會被撐開。
- 「/」只在關掉 JS 時量長相（有 JS 的人在畫面出來之前就跳走，F2.4 量）。

## 07 右邊「AI 開始打字」（F9）

依據：設計稿 90de030 的 `動態.md`「07 為 AI 做的」最後一列、規格書 §8、§9、§12、§14，與派工人員 2026-10-04 的決定（打哪一段、速度與停頓、游標、框裡的長相、HTML 不變大、測哪些組合）。
測試在 `typing.test.js`（在 `run.mjs` 單獨一段跑：它量 Long Task 與 layout-shift；整支約 75 秒）。對照資料：
- `fixtures/typing-f9.json`：`excerpt`＝要打的字、`lines`＝那幾行在原檔的行號、`ranges`、`htmlGzip`＝f8b（c046013）的 HTML 大小。
- `fixtures/design-f9-90de030.json`：框的位置（`frame`）、框露出原圖的哪一塊（`show`）、靜態大綱圖上第一行字的左緣、上緣、下緣（`imageText`，原圖像素）。用 `tools/measure-design.mjs --only f9` 產生。

**要打的是靜態大綱圖上那一段，不是 outline 的前 12 行**（核對過：圖是教學片第 13 章報告卡的一格，節錄的是 `tutorial/13-ai.js` 的 `REPORT.first`）。
做法照 `tutorial/engine.js` 的 `fileCard`：在範圍裡的行照原檔順序（`<!--` 開頭的不算、空行照留）、最多 12 行有字的，行與行之間 `\n`。
結果：中文第 1～4、22～30 行（有字的 9 行，476 字）；英文第 1、11～13、135、137、139～142 行（有字的 10 行，883 字）；日文第 1、4、37～44 行（有字的 9 行，369 字）。
教學片重算、`data/agent.*.json` 重轉時，`fixtures/typing-f9.json` 跟著重新產生（測試有一條防呆：fixture 的字要跟 json 的那幾行一樣）。

### 介面約定（前端照這個做）

- **框**：07 裡唯一的 `[data-corners]`。靜態大綱圖（`img[src*="ai-outline"]`，`alt`＝`forai.outline.alt`）永遠在裡面，讀屏只讀它的 alt。
- **`[data-typing]`**：框裡、蓋在圖上的打字層 —— 蓋圖上的**文字欄**：圖的那一塊（`img` 的外層）裡，從原圖 x 347、y 207（行號欄右邊、OUTLINE.md 標題列下緣）到右下角（±1px；設計審查 2026-10-04：標題列與行號欄留給圖）、不透明的底、`overflow: hidden`（超過的裁掉、不捲動，`scrollTop`、`scrollLeft` 一直是 0）、
  `aria-hidden="true"`、自己與祖先都不在 live region 裡。帶 **`data-src="/<語言>/typing.json"`**。減少動態、關掉 JS 時看不到。
- **字從哪來**：build 時產生 `out/<語言>/typing.json`，內容 `{ "text": "<要打的字>" }`（例如 `app/[lang]/typing.json/route.js`，跟 `site.webmanifest` 同一種做法；範圍寫在網站程式裡，數字見上面）。
  **字不放進 HTML**（不用 `data-*`、不用 `<script type="application/json">`）：參考實作量過，放進 `data-*` 時英文頁畫面那一段的 HTML gzip 就多 578 位元組（Next.js 接手用的資料裡還會再一份），超過上限。
- **`[data-typed]`**：`[data-typing]` 裡面，`textContent`＝已經打出來的字（要打的那一段的開頭），送出來的 HTML 裡是空的。只往後加，不改、不清掉重打。
- **游標 `[data-caret]`**：`[data-typed]` 裡的一個元素（沒有字）。2px 寬、一個字高（字級的 0.75～1.6 倍）、`--color-accent-lime-default` 的實心塊，沒有動畫、透明度 1（不閃）；
  打字中在最後一個字後面（最後一個字剛好在行尾時可以在下一行行首），打完拿掉，**打字層淡出、露出圖本身**（停住的畫面＝靜態圖；設計審查 2026-10-04）。**要用 transform 移**：參考實作第一版用行內的 `inline-block`，每加一個字它就被推一次，layout-shift 不是 0。
- **時間**：樹的七行都長出來那一幀算 0；第一個字 400ms；之後每個字 30ms、**換行那一步** 150ms；第一個字到最後一個字照這樣算超過 6 秒時，所有間隔等比例縮到剛好 6 秒（三語都超過：中文 15.7 秒、英文 27.5 秒、日文 12.1 秒，都縮成 6 秒）。打完停住；捲走再回來不重打。
- **長相**：字用 `--font-mono`（中日文的回退跟著 token）；長行不自動折、往右裁掉（照圖；圖上折成兩列的那幾行照圖折），打字層不捲動；字級、內距、行高照圖 —— 打字中第一行字的左緣、上緣、下緣跟圖上的差 ≤ 6px（`imageText` 照「圖的那一塊」的寬換算成畫面上的 px）。不加行號與檔名列。中日文一行 12～20 字的斷行規則不套用到這一段（它是資料）。
- **程式**：`public/typing.js`，三語頁 `<script src="/typing.js" defer>`，「/」與 404 不載；gzip ≤ 3 KB；React 接手（`collector:hydrated`）之前不碰 React 畫的 DOM；減少動態、關掉 JS 不抓 `typing.json`；07 的元件維持伺服器端元件。

### JS 預算

`typing.js` **gzip 後 ≤ 3 KB**（測試判；網站 README.md 要記它的大小，跟 F1.8 同一種寫法）。參考實作 1.3 KB（等 React 接手、抓 typing.json、IntersectionObserver＋requestAnimationFrame、算時間、移游標）；
首屏的 `hero.js`、`motion.js` 各約 3.4 KB，07 這支不該比它們大。

### HTML 大小

`out/<語言>/index.html` 拿掉 `<script>self.__next_f.push(…)</script>`（Next.js 給 React 接手用的資料）之後 gzip，不比 f8b 大 512 位元組以上。為什麼不比整份：
那幾段資料的切法會隨內容變，參考實作只改游標那一行 CSS，英文頁整份 gzip 就從 +104 變 +514（多出來的標記約 200 位元組）；拿掉之後穩定（三語 +42～+47）。整份的數字照樣印在 `# F9` 那一行。

### 案例對應

| 案例 | 組合 | 量什麼 |
|---|---|---|
| F9.1 結構 | 三語，關掉 JS | 框一個、圖在框裡（alt、看得到）、`[data-typing]` 一個（在框裡、`aria-hidden`、不在 live region、`data-src`、看不到）、`[data-typed]` 一個而且空的、沒有 `[data-outline]` |
| F9.1 typing.json | 三語，靜態 | `out/<語言>/typing.json` 的 `text`＝`excerpt`；防呆：`excerpt` 跟 `data/agent.*.json` 那幾行一樣 |
| F9.1 HTML 大小 | 三語，靜態 | 見上面 |
| F9.1 時間、游標、打完的樣子 | 中 390 只有手指、英 1440、日 320；`page.clock` | 07 進畫面、樹還沒長完時停 1 秒一個字都沒有；捲到樹長完，第一個字、每一個換行、最後一個字出來的時刻跟上面的公式差 ≤ 50ms；只往後加、每一步都是那一段的開頭、最後剛好是那一段；每一幀量游標；打完沒有游標；**打字中**（樹長完後 2 秒）：框照設計稿、打字層＝圖的文字欄、07 與整頁高度不變、`--font-mono`、不透明、`overflow: hidden`、`scrollTop`／`scrollLeft` 0、第一行字跟圖差 ≤ 6px、字不畫到打字層外；**打完**：打字層淡出看不到、圖看得到；捲走再回來字不變 |
| F9.2 減少動態、關掉 JS | 中 390、英 1440、日 320 | 圖看得到也載好、打字層看不到、`[data-typed]` 空、框裡沒有在跑的動畫、沒抓 `typing.json`、沒有錯誤 |
| F9.2 離開再回來、切到背景 | 英 1440；`page.clock` | 打 1.5 秒後，假時鐘停著來回五次、`visibilitychange` 切三次，再走 6 秒：時刻照公式、只往後加、最後剛好那一段 |
| F9.2 換語言 | 中 1440 → 按導覽列的 EN | 英文頁打的是英文那段開頭、抓 `/en/typing.json`、不抓 `/zh/typing.json` |
| F9.2 改寬度 | 日 1440 → 320 → 1024 → 1440；`page.clock` | 每次：框照設計稿、打字層＝圖的文字欄、不橫捲；最後照樣打完那一段 |
| F9.3 通用 | 三語 × 十二種寬度（同時開四頁）；`page.clock` 走 1.5 秒 | 在打字、layout-shift 0、框裡的動畫只動 opacity／transform、框照設計稿、打字層＝圖的文字欄、07 與整頁高度不變、字不畫到打字層外、框不壓 07 的字、不橫捲、沒有錯誤 |
| F9.3 長工作 | 中 390 只有手指 CPU 慢 4 倍、英 1440 | 捲到 07 起 4 秒內沒有 > 50ms 的 Long Task |
| F9.3 JS 與原始碼 | 靜態 | 三語頁載入 `/typing.js`（defer）、「/」與 404 不載；gzip ≤ 3 KB、不含要打的字、不寫死色碼；README.md 記了大小；`components/ForAI` 沒有 `'use client'` |

CSS 沒有寫死色碼（F1.5）、HTML 沒有自己寫的內嵌腳本（F3.9）掃全站，這一段跟著被量。

### 寫的時候哪幾條是紅的（2026-10-04，工作樹 c046013 build 出來的 out/）

紅在「還沒做」：07 裡沒有打字層與 `data-src`（結構、時間、改寬度、通用、離開再回來、換語言、長工作都停在找不到或沒開始打）、沒有 `out/<語言>/typing.json`、沒有 `public/typing.js`、README 沒寫。
已經是綠的：HTML 大小（還沒加東西）、減少動態與關掉 JS（現在只有圖）、07 的元件是伺服器端元件。

### 放回錯誤驗證（2026-10-04，在暫存複本寫最小的參考實作；全綠之後一次放回一種錯）

參考實作：`ForAI` 在框裡加 `<div data-typing data-src aria-hidden="true"><div data-typed></div></div>`（`position: absolute; inset: 0`、`--color-bg-overlay`、`overflow: hidden`、`container-type: inline-size`，只有 `html.js-motion` 時顯示；
字級、內距、行高用 `100cqw ÷ 640`（640 起 ÷ 1010）乘圖上的像素）；`app/[lang]/typing.json/route.js`；`public/typing.js`（等 React 接手 → 抓 typing.json → 07 進畫面才跑 requestAnimationFrame → 樹七行都是 1 記下 0 → 照公式加字、游標用 transform 跟著 → 打完拿掉游標）。整支全綠，約 75 秒。
程式的錯多半直接改複本 build 出來的 `out/typing.js` 與 `out/` 的 HTML（不重 build）。

| 放回的錯 | 紅在哪一條、哪一步 |
|---|---|
| 不等樹長完，07 一進畫面就打 | F9.1 時間：「第一個字：要在樹長完之後 400ms（±50）出來，得到 -592ms」等（加了「07 進畫面、樹還沒長完時停 1 秒」那一步才抓到：原本一次捲到樹長完的位置，07 進畫面與樹長完是同一刻） |
| 開始打的那一幀卡 80ms | F9.3 長工作：「捲到 07、開始打之後有 1 個 > 50ms 的 Long Task（81ms）」 |
| 減少動態也打（不看 `js-motion`） | F9.2 減少動態：「不能打字，[data-typed] 有 108 個字」「減少動態時不用抓 typing.json」 |
| 打出來的字跟 json 不一樣（「、」換成「，」） | F9.1 時間（zh）：「打出來的字要是要打的那一段的開頭，第 111 個字不一樣」「打完要剛好是那一段（字數一樣、字不一樣）」 |
| 不加速（照 30／150ms 打完，日文 12 秒） | F9.1 時間（ja）：「第 1 個換行：要在樹長完之後 742ms 出來，得到 1120ms」等 |
| 游標一閃一閃（透明度動畫） | F9.1 時間（ja）：「游標的透明度要是 1（不閃）」 |
| 回到 07 就從頭重打 | F9.2 離開再回來：「第 4 個換行：要在 1701ms 出來，得到 3232ms」等 |
| 打字層加 `aria-live="polite"` | F9.1 結構：「打字層不能在 live region 裡…：div aria-live=polite」 |
| 要打的字放進 HTML（`data-text`） | F9.1 HTML 大小：「en：gzip 後 15743 位元組，比 f8b 的 15165 大 578（上限 512）」 |
| 游標用行內的 `inline-block`（參考實作第一版） | F9.3 通用三語：「layout-shift 0.0002（SPAN）」 |

（前一版、打完整大綱時另外放回過的：不等 React 接手、計時器疊起來、一次打一整行、打字畫面越打越高、`overflow: visible`、動畫改 `width`、寫死寬 462px、typing.js 放字或寫死顏色 —— 當時各紅在對的地方；這一版還在的條目照樣量得到。）

### 已知限制

- 時間用 `page.clock`（假時鐘）量，容許 ±50ms（一幀 16ms，偵測樹長完可能晚一幀）。真的時間只用在長工作與換語言。
- 「切到背景」是改 `document.visibilityState` 再發 `visibilitychange`：headless 的 Chromium 換分頁不會變 hidden（量過）；真的背景分頁裡 requestAnimationFrame 會停，那種情況下打字要不要暫停、回來要不要補，沒有規定、沒量。
- 「跟圖一樣」只量第一行字的左緣、上緣、下緣（≤ 6px）；字級、行高、之後幾行的換行位置沒有逐一比（圖上的長行是在 1456px 寬的卡片裡換行的，打字層照框寬換，本來就不一樣）。圖上字的位置是用亮度 > 110 的點量的。
- 打完的樣子、游標只在三個代表組合量；十二種寬度量的是打到一半（1.5 秒）的版面。
- 「不閃」量的是游標的透明度與動畫；用 JS 每一幀改 `visibility` 這類寫法會被「剛好一個看得到的游標」那一條抓到。
## F10 前的三個設計小項（F10.1～F10.3，`f10-small.test.js`）

照設計稿 1d18ae2（`notes/4-4.md` 的 A1、A3、A4）。跑法：`node tests-site/run.mjs --test-name-pattern "F10\\."`；
設了 `SITE_COPY_MD=<design/homepage/copy.md>`、`SITE_STRINGS_DIR=<design/homepage/strings>` 會多跟設計稿的檔比（沒設只比測試裡寫死的 1d18ae2 的值）。

| 案例 | 量什麼 |
|---|---|
| F10.1 字串表 | 三語各 304 個 id；`changelog.empty` 是「目前沒有更新紀錄。／No release notes yet.／現在、更新履歴はありません。」；設了 `SITE_COPY_MD` 時 copy.md 文案表的每個 id 都在 |
| F10.1 12 空狀態 | 另外 build 兩份暫存複本（`buildCopy` 的 `prepare`，content/ 照真的，只換檔）：三語 changelog「只有 1.0.3」與「空檔」，兩份的 news 都換成空檔（好在同一頁比 `news.empty`）。三語 × 關 JS 1440、開 JS 390：12 區剛好一句 `changelog.empty`、看得到；字型、字級、字重、行高、顏色、字距跟 11 的 `news.empty` 一樣；沒有 `[data-version]`、沒有 `data-state="unreadable"`。整支讀不到、每一版都寫壞的整區虛線框照舊由 F1b.3 守 |
| F10.2 字串 | `strings/ja.json` 的 `faq.7.a` 跟 1d18ae2 一字不差（設了 `SITE_STRINGS_DIR` 也跟那份比） |
| F10.2 斷行 | 日文 1440、1024、768、640，13 第七題的答案畫出來每一行：字寬（`page-helpers.js` 的 `width()`：中日文 1、拉丁 0.5）≤ 25，實際寬（字的左緣到右緣 ÷ 字級）≤ 25.05em |
| F10.3 字型 | mac 才跑。三語頁：1440 量導覽列與頁尾、390 打開 ☰ 量選單，共 9 顆；CDP `CSS.getPlatformFontsForNode` 取畫最多字的那個字型：`lang="zh-Hant"` 是 PingFang TC、`lang="ja"` 是 Hiragino Sans、`lang="en"` 是 JetBrains Mono；每一顆 44×44（設計稿 1d18ae2 量到的，差 ≤ 1px） |

**寫的時候哪幾條是紅的**（2026-10-04，工作樹 c046013 build 出來的 out/）：F10.1 全紅（字串表 303、12 找到 0 句）、F10.2 兩條紅（字串不同；四種寬度第二行「（「困ったときは」）を押すと、その場で各所を点検し、」26 字寬）、F10.3 只有日文頁紅（三排的「中」都是 Hiragino Sans）；中文、英文頁本來就對。

**放回錯誤驗證**（同日，在暫存複本照設計師的修法改：`npm run strings` 同步 1d18ae2 的字串表、`Changelog.js` 在過濾後沒有版本時畫 `<p className={styles.empty}>`＋樣式同 News 的 `.empty`、`global.css` 加 `[lang="zh-Hant"]` 那段；全綠之後一次放回一種）：

| 放回的錯 | 紅在 |
|---|---|
| 拿掉 `global.css` 的 `[lang="zh-Hant"]` | F10.3 ja：「導覽列／頁尾／☰ 選單 lang="zh-Hant"「中」：字型是 Hiragino Sans，要是 PingFang TC」 |
| `Changelog.js` 改回去（沒有版本時什麼都不畫） | F10.1 六條：「12 要剛好一句『…』，找到 0 句」 |
| `strings/ja.json` 只有 `faq.7.a` 改回修前 | F10.2 兩條（字串不同；四種寬度 26 字寬） |

**已知限制**：F10.2 的「26」是照字算的（`width()`）；實際寬修前是 24.97em（括號擠在一起，塞得進 25em），所以只量實際寬抓不到這一行 —— 兩種都量。F10.3 的字型名是 mac 的系統字型，Windows skip。

## 重新產生設計稿的對照資料（`tools/`）

`fixtures/design-lines-03-04.json`（逐行表）與 `fixtures/design-6511462.json`（公告條位置、手指框按鈕下緣、連結底線、按下的樣子）是直接量設計稿得來的。
設計稿改版時用 `tools/measure-design.mjs` 重新產生；**它不是測試**，`run.mjs` 不會跑它（只跑這一層的 `*.test.js`）。

**設計稿不在這個 repo 裡**，要從別的地方取得一份（某個 commit 的 checkout 或快照）。要的是那份的根目錄：三語頁面在 `<根目錄>/<頁面資料夾>/{zh,en,ja}/index.html`，
頁面用相對路徑連到同一個根目錄底下的 CSS 與字型，所以整個根目錄都要在。字型沒載到量出來的寬度會差幾 px，程式量之前會檢查，沒載到就停。

```
node tests-site/tools/measure-design.mjs --root <設計稿根目錄> --commit <設計稿的 commit> [--page <頁面資料夾，預設 design/homepage>] [--lines <檔>] [--positions <檔>]
```

- 在網站資料夾（`tests-site` 的上一層）跑；Playwright 的找法跟測試一樣（`SITE_PLAYWRIGHT`）。
- 預設輸出：逐行表寫進 `fixtures/design-lines-03-04.json`，位置與樣子寫進 `fixtures/design-<commit>.json`；每一份的 `source` 記著 commit 與日期。
- 測試照檔名讀位置那一份（`bulletin-layout.test.js`、`underline.test.js`、`touch.test.js`、`where-zeros.test.js`、`forai.test.js`、`forai-tree.test.js`、`cards.test.js`、`tutorial.test.js`），換了 commit 要一起改那幾支裡的檔名。
- 10～16 另外跑 `--only f8`（其他幾份不動）：寫 `fixtures/design-lines-10-16.json` 與 `fixtures/design-f8-<commit>.json`（`f8-sections.test.js`、`f8-content.test.js` 照檔名讀）。設計稿的 class 對到哪個 id 寫在那支檔的 `F8_DESIGN`、`F8_GAPS`；量法跟測試同一套（`page-helpers.js` 的 `BOXES`、`EDGE_GAPS`、`textLines`）。2026-10-04 先用 5b74044 量、同日再用 004264c 重量（`EDGE_GAPS` 多量一個框高 `height`）：逐行表與 `boxes` 數字完全一樣（逐行表只換了 `source`），`gaps` 只有 `badSocial` 變了 —— 三語十二種寬度 `padY` 0 → 10.5；英文 280、日文 280／320 排兩行，`gapY` 1 → 11.5、框高 65（其他 44）。檔名照慣例換成 `design-f8-004264c.json`（讀它的兩支一起改），舊的刪掉；約 15 秒。
  2026-10-04 再用 1d18ae2（4-f10 前：日文 faq.7.a 的斷行、12 更新紀錄的空狀態）重量：逐行表只有日文 `faq.7.a` 在 640、768、1024、1280、1440 變了（第二行「（「困ったときは」）を押すと、その場で各所を点検し、」拆成「（「困ったときは」）を押すと、」＋「その場で各所を点検し、どこが悪いか、」，七行一樣），其他每一行都一樣；`boxes` 與 `gaps` 的數字完全一樣，只有 `gaps.<語言>.<寬度>.badSection.count`（設計稿裡量到幾個那種虛線框）2 → 3（狀態一覽多了「12 一版都沒有／整支讀不到」那一格；測試不讀 `count`）。檔名換成 `design-f8-1d18ae2.json`（f8-sections、f8-content 一起改），004264c 那份刪掉。設計稿快照：`git archive 1d18ae2 design clipper/css clipper/fonts`。
- 07 右邊打字的框另外跑 `--only f9`（其他幾份不動）：寫 `fixtures/design-f9-<commit>.json`（`typing.test.js` 照檔名讀）：`frame`＝放大綱圖的框（`.forai__shot`）離 07 左上角的 [x, y, 寬, 高]、`section`＝07 的寬高（三語 × 十二種寬度、有滑鼠、高 900）、`show`＝框露出原圖的哪一塊、`imageText`＝`assets/ai-outline-<語言>.png` 上第一行字的左緣、上緣、下緣（亮度 > 110 的點，原圖像素）。2026-10-04 用 90de030 量（約 15 秒）；當時網站的框在十二種寬度都跟它一樣。
- 「/」與 404 另外跑 `--only solo`（其他幾份不動，設計稿的頁面是 `<--page>/root/`、`<--page>/404/`）：寫 `fixtures/design-solo-<commit>.json`（`solo.test.js` 照檔名讀）。2026-10-04 先用 004264c 量，同日設計稿修了大標日文字型，改用 90de030 重量（只有大標三段的寬變了），舊的那份刪掉。
- 09 教學影片另外寫一份 `fixtures/design-lines-09.json`（設計稿頁面上的 09 是「有影片」的樣子；量之前 09 裡每一個 `<details>` 都打開），位置那一份多一個 `chapters`（章節每一列的字到邊，`page-helpers.js` 的 `CHAPTER_GEOMETRY`）。加這兩樣時用 607a536 整個重跑一次，其他幾份的數字一個都沒變。
- 量法跟測試同一套（`page-helpers.js` 的 `textLines`、`LINK_DECORATION`、`pressStyles`）。設計稿的 class 對到哪個字串表 id、哪個元件，寫在那支檔的 `LINES_MAP`、`TOUCH_MAP`、`PRESS`；設計稿改了 class 名稱要跟著改。
- 2026-10-03 用 commit 3f2310c 的快照跑過一次，產出跟當時 `fixtures/` 裡的兩份除了 `source` 那一句以外完全一樣；同一天再用 ba016e9 產生現在的兩份（多了 `zeros`；公告 ✕ 按下時的框改成透明，其餘數字不變）。
- 之後用 350fdf4（07 的樹）、607a536（08 的措辭限定為擴充）各重量一次，現在的是 607a536：跟 350fdf4 比，只有 `design-lines-05-15.json` 裡 `privacy.title`、`privacy.lead`、`privacy.1.title`、`privacy.3.title` 的逐行變了，
  03、04、07 的逐行與位置那一份（公告條、手指框、底線、按下、04 三格、07、卡片排法）數字完全一樣。位置那一份量的都是相對位置（公告條在 08 之上；卡片、樹、04 三格量的是框裡面的距離），08 變高、下面整段往下移不影響。
- 再用 6511462（09 沒有影片那一態的說明與封面句、章節摘要的斷行規則）重量一次，現在的是 6511462：跟 607a536 比，只有 `design-lines-09.json` 裡中文 `ch.04.desc`、`ch.08.desc` 的逐行變了（設計稿改了中文 04、08、12 與日文 8 章的摘要 HTML，在十二種寬度排出來的行只有中文那兩章不一樣）；
  位置那一份除了 `source` 一個數字都沒變，檔名照慣例換成 `design-6511462.json`（讀它的八支一起改）；03-04、05-15、07 的逐行表數字一樣，沒有覆寫（`source` 還寫 607a536）。

