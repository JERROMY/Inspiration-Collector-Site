# 靈感收集器：產品首頁

這是「靈感收集器」產品首頁的網站：用 Next.js 把內容、資料與素材做成靜態網頁，放在 Cloudflare Pages，網址是 `https://collector.jerromy.com/`（三種語言：`/zh/`、`/en/`、`/ja/`）。

寫給兩種人：要把網站放上線的使用者，和做網站的人。文中的「規格書」是 GPTPlugins 這個 repo 裡的 `homepage/SPEC.md`。

## 放在哪裡、怎麼上線

網站放在 **Cloudflare Pages**（2026-10-07 從原本規劃的 GitHub Pages 改過來）。程式放在一個 GitHub repo，每次推到 `main`（包括你在 GitHub 網頁上改文字檔、存檔），Cloudflare 會自己拉下來、產生網頁、放上線。

為什麼是 Cloudflare：`jerromy.com` 的 DNS 本來就在 Cloudflare，填自訂網域時它會自己加 DNS 紀錄、自己發 HTTPS 憑證，不用另外到網域商設定；repo 也可以是私人的。這個網站是純靜態網頁，用免費方案就夠（靜態網頁的瀏覽不限次數、不收流量費；限制見「Cloudflare Pages 的設定」一節）。

資料夾裡各是什麼：

- `content/`：使用者自己改的文字檔（更新紀錄、公告、社群連結），每支檔開頭有說明。
- `data/`：教學章節的資料。
- `public/`：原樣放上網站的檔案，有宣傳片與預覽圖（`public/media/`）、網頁字型（`public/fonts/`）、轉好的圖片（`public/images/`）和 Cloudflare 讀的回應標頭 `_headers`。
- `strings/`：首頁的字（三種語言，每一條帶斷行標記）與標記的說明，從設計稿複製進來的，不要手改（見「字串表」一節）。
- `lib/`、`scripts/`：讀內容、檢查內容、轉章節、處理素材、切字型、轉圖片、檢查字串表、把帶標記的字轉成元素樹的程式。
- `app/`、`components/`：網站的畫面（Next.js，見「前端」一節）。
- `tests/`、`tests-site/`：自動化測試（`tests-site/` 是網站畫面的，要先 build）。

## 你要自己做的事（照順序）

下面這幾件事要在 GitHub、Cloudflare 和各家後台自己按，程式幫不了。

1. **建一個 GitHub repo。** 在 GitHub 新增一個 repo（公開或私人都可以，名字自己取，例如 `collector-site`），建的時候不要勾選加入 README、`.gitignore` 或授權，留成空的，等一下才把這個資料夾推進去（做法見下面「搬進網站 repo」）。

   為什麼：Cloudflare 從這個 repo 拉程式產生網頁；你也才能在 GitHub 網頁上直接改公告、更新紀錄這些文字檔。

2. **在 Cloudflare 建 Pages 專案、連到這個 repo。** Cloudflare 後台 → Workers & Pages → Create application → Pages 分頁 → Import an existing Git repository，第一次會請你授權 Cloudflare 讀 GitHub（可以只給這一個 repo：GitHub 授權畫面選 Only select repositories）。選好 repo、按 Begin setup 之後：
   - Production branch：`main`
   - Framework preset：選 Next.js (Static HTML Export)，它會帶入 `npx next build` 與 `out`
   - Build command：改成 `npm run build:pages`（多了內容檢查）
   - Build output directory：`out`

   Node 的版本不用填，Cloudflare 會讀 repo 裡的 `.node-version`（22）。按下部署（按鈕名稱以畫面為準），第一次部署完會拿到一個 `<專案名>.pages.dev` 的網址，可以先打開看一次。

   為什麼：`build:pages` 會先檢查內容、再產生網頁（見「內容寫壞了會怎樣」）；產生出來的網站在 `out` 資料夾，Cloudflare 把它放上線。

3. **在專案填自訂網域。** 同一個專案的 Custom domains → Set up a custom domain，填 `collector.jerromy.com`，照畫面確認。Cloudflare 會自己在 `jerromy.com` 加一筆 DNS 紀錄、發 HTTPS 憑證（要等多久官方沒寫，以畫面上的狀態為準）。**不要自己先到 DNS 頁手動加 CNAME**：官方文件寫明那樣網址會打不開（522 錯誤），一定要從這裡加。

   為什麼：網站的每一頁、網站地圖、分享預覽都寫死正式網址 `https://collector.jerromy.com/`；`.pages.dev` 那個網址雖然也打得開，但 `_headers` 叫搜尋引擎不要收錄它，免得變成兩份重複的網站。

   **接著關掉這個子網域的「信箱加密」。** `jerromy.com` 開著 Cloudflare 的 Email Address Obfuscation，它會把網頁裡的 `mailto:` 連結（頁尾「回報問題」、「寄到自己電腦」）改寫成 `/cdn-cgi/l/email-protection#…`，還往頁面插一支解碼腳本。到 `jerromy.com` 這個網域 → Rules → Create rule → Configuration Rule：條件 Hostname equals `collector.jerromy.com`，設定加 Email Obfuscation、維持 Off，按 Deploy。只管這個子網域，部落格照舊。2026-10-07 上線時做過；做完抓一次網頁，`mailto:` 要是原樣。

   為什麼：改寫過的連結要等那支腳本跑完才變回信箱，關掉 JS 的人、部分 App 內瀏覽器、搜尋引擎看到的都是壞連結；規格書也規定不做只靠 JS 才能用的內容。官方文件（https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/ ）建議只對特定網址關掉時用 Configuration Rule。

4. **看一眼 AI 爬蟲的設定。**（2026-10-07 看過：AI Crawl Control → Security 的 Block Crawler 全部關著，沒有擋任何爬蟲；Bot Preference Sync 也關著，不會改我們的 robots.txt。） Cloudflare 後台選 `jerromy.com` 這個網域，找跟 AI 爬蟲有關的設定（在哪一頁、叫什麼名字以後台畫面為準）。官方公告（https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/ ）：2026-09-15 起**新接上** Cloudflare 的網域，放廣告的頁面預設擋訓練用與 agent 類的爬蟲，搜尋類照樣放行。jerromy.com 早就在 Cloudflare、這個網站也沒有廣告，照原文不在範圍內，但兼做搜尋與訓練的爬蟲會受這類設定影響，所以還是看一眼。

   為什麼：這個網站希望被 AI 搜尋找得到（規格書第 10.7 節）；被 Cloudflare 擋掉的話，`robots.txt` 寫允許也沒用。

5. **Google Search Console 與 Bing Webmaster Tools：驗證網域、送網站地圖。** 上線當天，用你自己的帳號在兩家各新增這個網站，驗證網域（照畫面在 Cloudflare 的 DNS 頁加一筆 TXT 記錄），驗證完送出網站地圖 `https://collector.jerromy.com/sitemap.xml`，並對 `/zh/`、`/en/`、`/ja/` 各要求一次收錄。

   為什麼：搜尋引擎不會自己知道有一個新網站。驗證網域之後才看得到被哪些字搜到、點進來幾次；送網站地圖，三個語言頁和它們的語言版本標記才會一次被看到（規格書第 10.9 節）。

6. **商店後台填網站網址。** 到 Chrome 線上應用程式商店的開發人員後台，商店資訊的網站欄位填 `https://collector.jerromy.com/?ref=store`。另有一欄「官方網址」，要等第 5 步在 Search Console 驗證過網域才選得到。兩個欄位在後台叫什麼名字、怎麼填，以後台畫面為準。

   為什麼：商店頁連回網站，搜尋引擎才更認得這是官方網站，也多一條可信的連結；`?ref=store` 讓流量統計分得出是從商店來的（規格書第 10.8 節）。

## 搬進網站 repo（乾淨的第一個提交）

這個資料夾現在放在 GPTPlugins 這個 repo 的 `homepage/site/` 裡。上線時它要變成網站 repo 的**根目錄**：`content/`、`package.json`、`.node-version` 直接在最上層。

做法是把這個資料夾裡**進了 git 的檔**（`git ls-files` 列得出來的）複製到一個新資料夾，做成一個新的 repo 的第一個提交，再推上去。不帶 GPTPlugins 的歷史：開發過程的一百多個提交裡有署名行與內部討論，這個 repo 不需要（2026-10-05 使用者決定）。

搬家做一次就好。搬完之後，網站 repo 會收到你在 GitHub 網頁上改內容的提交；之後 GPTPlugins 這邊改了程式，只把改到的檔複製過去、在網站 repo 提交，不要整份重搬，免得蓋掉網頁上改的內容。章節與素材也一樣，只把產出的檔案帶過去（見下面「章節與素材的程式要留在 GPTPlugins 跑」）。

## 在自己的電腦上預覽

建議用 Node.js 22（Cloudflare 部署用的就是 22，寫在 `.node-version`；mac 與 Windows 都可以）。`package.json` 的 `engines` 寫的是 `>=20.9`（Next.js 的下限），Node 20.9 以上也跑得動，但 Node 20 已經結束維護，不建議。在網站的根目錄（有 `package.json` 的這一層）先跑一次 `npm ci` 把套件裝好，之後：

- `npm run dev`：開發版，改了檔案畫面會自己更新，網址看指令印出來的那一行。
- `npm run build`：產生跟上線一模一樣的 `out/`。

`npm run build` 產生的 `out/` 要用一般的靜態伺服器開：把 `out/` 當成網站的根目錄，例如 `npx serve out`（第一次會下載一次 `serve`，不會寫進 `package.json`），或有裝 Python 的話 `python3 -m http.server --directory out`。

**不要用 VS Code 的 Live Server 開 `out/`。** 它會往每一頁 HTML 裡插進自己的腳本；`out/` 裡本來就有 Next.js 自己放的內嵌腳本，被它插到 JS 字串裡，整段就壞掉了（這個專案踩過）。

## 前端（網站的畫面）

用 Next.js 16（App Router、JavaScript、CSS Modules）產生靜態網頁。套件只有 `next`、`react`、`react-dom` 三個（版本釘死，`package-lock.json` 一起提交）；不用 Tailwind、TypeScript、`next/font`。建議 Node.js 22；Node 20.9 以上也 build 得起來（Next.js 的下限，Node 21.6.2 實際 build 過）。

本機預覽照上一節：`npm run dev` 看開發版（在開發版打不存在的語言網址，例如 `/nope/`，終端機會印紅字：還沒開過任何語言頁時是 `Page "/[lang]/page" is missing param … required with "output: export"`、頁面回 500，開過一次語言頁之後是 `Failed to generate static paths for /[lang]`、頁面回 404。這是開發模式才有的訊息，`npm run build` 不受影響，上線的網站回的是 `404.html`）；`npm run build` 產生 `out/`，再用一般的靜態伺服器把 `out/` 當網站根目錄開（`python3 -m http.server --directory out` 之類），不要用 Live Server。

目錄：

- `next.config.js`：`output: 'export'`（產生 `out/`）、`trailingSlash: true`（網址結尾一律有 `/`）、`images.unoptimized: true`、`experimental.globalNotFound`（404 用，見下面）、`agentRules: false`（Next.js 16.3 起，`npm run dev` 偵測到 AI agent 在跑時會在這一層自己寫出 `AGENTS.md` 與 `CLAUDE.md`；這個網站會搬進公開 repo，不要這兩個檔，所以關掉）。
- `app/[lang]/`：三語頁 `/zh/`、`/en/`、`/ja/`。`layout.js` 用 `generateStaticParams` 只產生這三頁（`dynamicParams = false`），`<html lang>` 照網址寫成 `zh-Hant`、`en`、`ja`；`page.js` 在產生網頁時讀 `content/`。
- `app/(menu)/`：`/` 的三語選單（括號是路由群組，不出現在網址裡）。整頁標 `en`，產品名、說明、三個語言鈕各標自己的 `lang`；有 JS 時 `<head>` 的 `public/pick-lang.js` 在畫面出來之前就跳到語言頁（見下面「搜尋與分享」）。
- `app/global-not-found.js`：產生 `404.html`。這個網站有三個根版面（`/`、三語頁、404 各自寫 `<html>`，才能各有自己的 `lang`），沒有共用的版面可以包 `not-found.js`，所以用 Next.js 的 `global-not-found.js`（Next.js 文件仍標實驗功能，15.4 起；用它是為了讓 404 與 `/` 各自有 `lang`。若之後拿掉，要改成單一的 `app/layout.js` 加 `app/not-found.js`，那時 `<html lang>` 只剩一個值，三語頁的 `lang` 要先想好怎麼標）。整頁標 `en`，中文、日文那兩段各標 `zh-Hant`、`ja`，三段各一個「回首頁」連到自己的語言頁；版型跟 `/` 同一個（`components/Solo`，記號下面多一個 `aria-hidden` 的「404」），路徑一律從根目錄算（Cloudflare Pages 在任何深度找不到的網址都回這一頁）。大小（2026-10-04 量，未壓縮／gzip；改成 Solo 之前 → 之後）：404 的 CSS 144,223／13,782 → 163,397／16,954 位元組（+19 KB／+3.2 KB），HTML 10,997／2,413 → 14,250／3,093；「/」的 CSS +218／+47。404 多出來的是共用的那支 CSS（Solo 用的 `Button` 跟導覽列、頁尾等元件打包在同一支，約 20 KB）：取捨是 404 跟其他頁共用同一支檔（點回首頁時已經在快取裡）、不另寫一份樣式；量過開壓縮的 404 Lighthouse 效能 97。
- `app/styles/nox/`：設計系統的複本（`tokens.color.css`、`tokens.type.css`、`tokens.scale.css`、`base.css`），從 GPTPlugins 的 `clipper/css/` 原樣複製，**不要手改**；設計系統更新時重新複製（`tests-site` 會比對位元組）。
- `app/styles/global.css`：三個根版面都 import 這一支。接上設計系統的複本，再補網站自己的：`[hidden] { display: none !important }`（坑 2）、`.nw { white-space: nowrap }`（`lib/bind-tail.js` 產的字面 class）、只有暗色（`color-scheme: dark`；每個 `<html>` 都寫 `data-theme="dark"`）、中文與日文的系統字型名單、回退字型。
- `components/`：一個元件一個資料夾，`元件.js` 加 `元件.module.css`。`Unreadable`（「這一條讀不到」：四種虛線框）、`FontLinks`（`<head>` 裡接字型的 `<link>` 與預載）、`Seg`（字串表的一條字畫成元素）；導覽列與公告條：`Nav`（01 導覽列與 ☰ 選單）、`Bulletin`（02 公告條）、`SkipLink`（跳到主要內容）；共用的小元件：`Button`（主要、次要按鈕）、`IconButton`（圓形圖示鈕；`ghost` 是沒有框的那種，公告條的 ✕，滑過、按下也不長出框）、`TextLink`（不在句子裡的文字連結；`wrap` 是字會換行的那種，卡片的「看教學 NN」、隱私條款）、`LangSwitch`（語言切換）、`Socials`（社群圖示一排；沒有圖示檔的代號畫成文字膠囊，14 區另外畫寫壞的那一條）、`Icon`（圖示）、`Tag`（不會按的 3px 標籤：已實測、置頂、最新）、`Older`（「看更早的…」的 `<details>`）；各區：`Hero`（03 首屏）、`Where`（04 能用在哪裡）、`How`（05 三步驟）、`Features`（06 能收什麼）、`ForAI`（07 為 AI 做的）、`Privacy`（08 隱私）、`Tutorial`（09 教學影片）、`Devices`（10 支援裝置）、`News`（11 最新公告）、`Changelog`（12 更新紀錄）、`Faq`（13 常見問題）、`Author`（14 作者與社群）、`Final`（15 最後的安裝）、`Footer`（16 頁尾，在 `layout.js` 的 `<main>` 後面）；各區共用：`Band`（05 以下的一區：上下留白、淺的那一層）、`SectionHead`（小標＋大標＋一句說明；14 的名字與簡介也用它）、`Card`（卡片與一整片卡片 `Cards`：06、08 四欄，10 兩欄，11 三欄；自己排卡片內容的 10、11 用 `CardBox` 與 `cardClass`）、`TouchBox`（只有手指時「把網址帶到電腦上」的框，首屏與 15 區共用）、`Frame`（媒體框，可選四個括號角；07 的大綱圖、05 的截圖用，首屏的影片框還是自己畫的）、`DataText`（從資料轉進來的字：章名、摘要照規則斷行，見下面「09」）、`Crop`（只露出原圖的某一塊：後端裁好的圖，檔名、寬高、裁切範圍從 `images.json` 讀，見下面「大綱圖」）、`Hydrated`（React 接手之後通知 `motion.js`，唯一的 client 元件）；`Solo`（「/」三語選單頁與 404 共用的版型：記號、三語大標、三欄說明＋按鈕，照設計稿的 `.solo`）。樣式只用設計系統的語意 token，數字照設計稿 `home.css`。
- `lib/`、`scripts/` 是後端的；前端只在伺服器端元件 import `lib/content.js` 與 `lib/bind-tail.js`。
- `app/site.js`：不翻譯的共用值（正式網址 `SITE_URL`、商店網址、六個錨點、更新紀錄從哪一版開始列 `CHANGELOG_FROM`）。網域只寫在這裡。
- `app/changelog.js`：12 更新紀錄的類型詞清單（`knownKind`）與「這一版列不列」（`listed`，照 `CHANGELOG_FROM`），見下面「10～16」。
- `app/seo.js`、`app/sitemap.js`、`app/robots.js`、`app/[lang]/site.webmanifest/route.js`、`components/StructuredData`：搜尋與分享用的標記，見下面「搜尋與分享」。
- `public/bulletin.js`、`public/nav.js`、`public/motion.js`、`public/hero.js`、`public/typing.js`：瀏覽器裡跑的一般腳本（不是 React），見下面「導覽列與公告條」「首屏與動態」「07 為 AI 做的」。
- `public/icons/`、`public/mark.svg`：圖示與記號，出處見下面「圖示的出處」。
- `app/strings.js`：取字。版型裡的字（標題、按鈕、各區的說明、「這一條讀不到」）一律從 `strings/` 取，程式裡不寫死。

**內容怎麼進畫面：** 三語頁在產生網頁時呼叫 `readContent(path.join(process.cwd(), 'content'))`，把每一區交給那一區的元件。這幾個元件都是伺服器端元件（沒有 `'use client'`），只在 `npm run build` 時跑：讀內容的程式不會被打包送到瀏覽器，`reason`（寫給做網站的人的中文原因）也不會出現在 HTML 或 Next.js 的 `.txt` 資料裡。寫壞的一條、整區讀不到，各畫一個 `data-state="unreadable"` 的元素（字是字串表的 `state.unreadable`；整區讀不到、或每一條都寫壞時是 `state.unreadable.section`，照 `strings/README.md`「這一條讀不到」）。使用者寫的字（公告的標題與內文、更新紀錄每一條）用 `bindTail(字, 語言)` 的輸出原樣放（`dangerouslySetInnerHTML`，它已經跳脫過，不再跳脫一次）。**這幾個元件不要改成 `'use client'`**，不然整包內容（含 `reason`）會跟著送到瀏覽器。

**字串表怎麼接：** 用法一句話 —— 伺服器端元件裡寫 `<Seg text={getString(lang, 'news.title')} />`。

- `getString(lang, id)`（`app/strings.js`）回 `strings/<語言>.json` 那一條的原字（帶標記）。它讀 `process.cwd()` 底下的 `strings/`，只在產生網頁時跑；client 元件不要 import 它，要字就從 props 拿。id 不存在、語言不認得都丟錯（訊息有 id 與語言），不回空字串。
- 第一次取字時整份字串表先驗過：三種語言的 id 要完全一樣、每一條的標記都要轉得過。所以字串表寫壞時 `npm run build` 一定失敗，哪怕那一條還沒有頁面用到；Cloudflare 那邊就是不部署、網站維持上一版。
- `<Seg>`（`components/Seg/Seg.js`）用 `parseSegments` 把原字轉成 React 元素，字交給 React 跳脫，不用 `dangerouslySetInnerHTML`。有代入值的字（`%url%`、`%nn%`、`%章名%`）給 `values`：`<Seg text={…} values={{ url }} />`。
- `<title>` 這類只能放純文字的地方用 `getPlainString(lang, id)`（去掉標記）；社群連結的名稱用 `hasString` 先看字串表有沒有 `social.<代號>`，使用者在 `links.md` 新加的代號字串表還沒有時照代號顯示，不讓整站產生失敗。
- 標記用到的 class（`.u`、`.nw`、`.nw-wide`、`.brk-narrow`、`.clamp`、`.brk`、`.forai__l1`／`l2`，以及章名摘要用的 `.nw-320`、`.nw-360`）寫在 `app/styles/global.css`，規則照設計稿；寫在 CSS Modules 裡 class 名稱會被換掉。
- 使用者自己寫的內容（公告、更新紀錄）不走 `<Seg>`：裡面的 `«` `{` 這些字元是使用者的字，照原字顯示，走 `bindTail`。

**字型怎麼接：** `/fonts/fonts.css`（後端產的，見下面「字型」）用 `<link>` 接，不從 CSS import（import 的話 Next.js 會把字型檔再複製一份到 `_next/`，同一個字型變成兩個網址）；每頁 `<head>` 預載 `GoogleSansFlex-site.woff2`（`crossorigin`，不然會下載兩次）。預載用 `react-dom` 的 `preload()` 放（`components/FontLinks`），不畫 `<link rel="preload">`：畫出來的那個 React 19 會再提一份到 `<head>` 最前面，變成兩條一模一樣的（瀏覽器只下載一次，但 HTML 重複）。

**回退字型（字型還沒下載好時用的字）怎麼定的：** 目標是**字型換上來時每一段字的行數不變、字的位置幾乎不動**：行數一變，底下整頁都被推動（CLS，規格書第 9 節）。

- **等寬字**（`global.css` 的 `"JetBrains Mono Fallback"`）：Courier New 跟 JetBrains Mono 每個字都是 0.6 個字寬，`size-adjust` 100%。
- **內文字**（`app/styles/fallback-fonts.css`，Arial）：一個字一個字對。Google Sans Flex 跟 Arial 的字寬比每個字都不一樣（同樣 16px：f 寬 27%、R 窄 19%、空白窄 19%、逗號窄 14%），而且跟著光學尺寸（等於字級）、字重變；整套字只用一個 `size-adjust` 時，平均對得準，但總有某些寬度剛好卡在換行邊緣（量到英文 428 跳 0.2、中文 354 跳 0.26）。所以：
  - 照「字級×字重」分組，每組一個 font-family（`"Google Sans Flex Fallback 14"`、`16`、`18`、`24`、`32`、`48`、`64`，與給繼承 body、光學尺寸固定 18 的字用的 `"Google Sans Flex Fallback"`）；元件的 `font:` 用對應的 `--font-sans-14`、`-16`…（`global.css`）。
  - 每一組裡，把寬度比相近（最寬最窄差 2% 以內）的字收成一個 `@font-face`：`unicode-range` 是那幾個字，`size-adjust` 是它們的平均比。
  - **`size-adjust` 夾在 85%～120%。** `size-adjust` 放大縮小的是整個字形，不只字寬：照字寬對的話，Arial 的「1」要縮到 66%、「[」「]」要放大到 147%，字型還沒到的那一下（或字型被擋時一直）這幾個字會明顯比旁邊大或小（「text」的 t、「ChatGPT」的 t、引號）。所以超出的字一律夾到 85% 或 120%：字的大小差不多，代價是這幾個字在回退時略寬或略窄（夾掉的字：「1」「…」「·」「:」「;」等偏小的，t、f、r、引號、括號、反斜線等偏大的，每一組不同）。空白看不見，不夾，而且自己一個 `@font-face`。
  - 夾過之後，大多數字換字型前後的寬度仍差 1% 以內；t、引號多的英文會窄一點（量到最多約 2%）。
  - 還剩幾段字在某些寬度卡在換行邊緣，給它們各自一組整組乘上一點點係數的 family（檔尾，`global.css` 的 `--font-sub`、`--font-touch`、`--font-title-32`、`--font-title-48`、`--font-bulletin`、`--font-meta`）：英文的首屏說明（空白另外乘 0.7125）、手機框說明與「用的是電腦？」、手機大標（空白另外乘 1.035）、640～1023 的大標、公告條標題、主要按鈕下面那幾行；中文的首屏說明、大標、公告條標題；日文的首屏說明。係數挑換字型前後每一段字換行位置全部一樣的值。
  - 公告條標題的係數只對得上現在這條公告：英文那條用網頁字型排，344 寬時第一行離換行只差 0.1px、390 寬時差不到 0.1px，回退字型的寬要對到 0.03% 以內兩邊才都不換行（`tests-site` 的 F1.5 量英文 390 ≤ 0.01）；中文那條在 353 寬時，沒調之前公告條從一行變兩行（44 → 49 高），整頁往下推，量到 0.26。**換公告之後要重新量**，不然可能在某個寬度換字型時跳一次。
  - `ascent`／`descent` 是 Google Sans Flex 的 96.6%／28.6% 除以 `size-adjust`，行高不變。
- **怎麼量、怎麼重新產生**：Chromium（Playwright）裡每個字重複 40 次、關掉字距調整，量 Google Sans Flex 與 Arial（粗體對 Arial Bold）的寬度比，夾到 85%～120%，照上面分組產生 CSS；微調的係數用「同一頁擋掉字型與正常載入，比每一個 `data-id` 區塊、公告條標題、導覽列連結的高度與換行位置」，在三語 × 280～480 每 1px（只有手指）、488～1456 每 16px（有滑鼠）、平板 640～1366 每 32px（只有手指）上掃，挑翻掉最少的值。注入新的 `@font-face` 之後要等字型真的換上去（量一次版面、等 `document.fonts.ready`、再等兩格）才量，不然量到的是上一組係數。2026-10-03 在這台 mac 量的；產生用的程式目前不在這個 repo 裡（放在哪裡還沒定）。
- **1px 全掃**（真的量 CLS，量法同 F4.6b）：三語 × 只有手指 280～480 每 1px、有滑鼠 280～700 每 1px、700～1456 每 8px，共 2,148 組。大於 0.02 的：調之前 6 組（中文 353 只有手指 0.2583、有滑鼠 0.2451，公告條標題；英文 652 有滑鼠 0.2579，大標；英文 307、323 只有手指 0.0474、0.0437，手機框說明；英文 290 有滑鼠 0.0259，主要按鈕下面那行）；調之後 2 組，就是英文 307、323 只有手指（見下面「還在邊緣」）。0 到 0.02 之間的只剩英文 334（只有手指 0.0141、有滑鼠 0.0124）、日文 659 有滑鼠 0.0008，與英文 1284 起有滑鼠導覽列連結移 3px（0.00005 以下）。
- **效果**（`tests-site` 的 F4.6、F4.6b：伺服器扣住字型、回退字型畫過兩格才放，不扣有人操作）：常見寬度、掃描（280～480 每 4px、488～1456 每 16px、平板 640～1366 每 32px）、三語、只有手指與有滑鼠全部是 0；迴歸清單只有英文 334 只有手指是 0.0141（首屏說明「and ChatGPT, Claude or Perplexity chats.」用網頁字型排剛好塞滿一行，離換行 0.1px，回退字型要對到 0.03% 以內，跟其他寬度的條件對不起來；行數不變、字移一行）。改之前英文 280 是 0.12、英文 430 只有手指 0.20、中文 354 是 0.26；夾 85%～120% 之前，中文 361、362 只有手指是 0.1156（首屏說明 4 行變 3 行）。
- **還在邊緣**：
  - 英文 307、323 只有手指：0.0474、0.0437（手機框說明，換字型時多一行，下面的按鈕往下移）。修不掉：同一段粗體字「This is a free extension for Chrome on a computer.」在 432 以上（含平板）用網頁字型排剛好 350.0px、塞滿最大寬 350，回退字型不能比它寬；307、323 時前半句「…for Chrome」用網頁字型排比框寬 0.5px，回退字型又不能比框窄。兩邊要的係數相反，選了保住 432 以上與平板（寬度範圍大得多）。
  - 英文 334（只有手指 0.0141、有滑鼠 0.0124）：首屏說明「and ChatGPT, Claude or Perplexity chats.」用網頁字型排離換行 0.1px。
  - 這些餘裕都在 0.5% 以內（英文手機版尤其如此，中文 360 的首屏說明乘 0.995 也會到邊上）。**換機器、換字型版本、改文案，都要在那一台重新量一次**（上面的 1px 全掃）。
- **代價**：`fallback-fonts.css` 423 個 `@font-face`（卡片與三步驟的標題是 18px 粗體，加了 `Fallback 18` 的 600 那一組），全站的 CSS 多約 10.5 KB（gzip 後）。
- **之後要做的**：頁面的字變多（各區做好）、新的字級或字重，要照同樣方式加一組或重掃係數；換字型檔要整份重新產生。手改數字會讓某些寬度開始跳。Windows 的 Arial、Courier New 跟 mac 的同寬，但沒在 Windows 上量過。

**導覽列與公告條：** 版面在 `app/[lang]/layout.js`：跳到主要內容 → 導覽列（`<header>`，釘在最上面）→ 公告條（不釘住，跟著捲走）→ 那一頁的 `<main id="main">`。
`html` 的 `scroll-padding-top` 讓跳到某一區時標題不被導覽列蓋住。

- **☰ 選單**用原生的 popover（`popovertarget`）：沒有 JS 也打得開，Esc、點外面會關。`public/nav.js`（`<head>`、`defer`）跟著換讀屏名字（打開／關閉選單）、點選單裡的連結就收起來；瀏覽器不支援 popover 時，它拿掉 popover 改用 `data-open` 自己開合。選單放在 `<header>` 外面：導覽列的毛玻璃會變成 `position: fixed` 的參考框，不支援 popover 的瀏覽器裡選單會被關在導覽列那一條裡。
- **語言切換**也是 `nav.js`：把目前的錨點帶過去（`/zh/#faq` → `/ja/#faq`）、記住選的語言（`localStorage` 的 `collector-lang`；存不了照樣切）。
- **公告條**：每一則好的公告各畫一條，同一時間只看得到一條。產生網頁時用產生那天的日期挑一條（關掉 JS 時看到的就是它）；`public/bulletin.js` 在 `<head>` 裡同步跑，畫面畫出來之前用看的人的當地日期再挑一次，插一小段樣式只放挑中的那條，所以版面不跳（CLS 0）。規則：發布日已經到了、30 天內（發布日當天是第 0 天）或置頂、沒按過 ✕，取日期最新的一則（同一天取前面那則）。按 ✕ 那條直接拿掉（不做高度動畫），id 記進 `localStorage` 的 `collector-bulletin-dismissed`（存不了就只在這次瀏覽關掉）。挑的規則只寫在 `bulletin.js`：產生網頁時 `components/Bulletin` import 同一支檔來用，它載入後有 `globalThis.collectorBulletin.pick(entries, now, dismissed)`。
- 公告的標題是使用者寫的字：`bindTail(標題, 語言, { tail: 箭頭圖示 })` 的輸出原樣放，箭頭跟最後幾個字一起換行。
- 腳本都是外部檔，HTML 裡沒有自己寫的內嵌腳本（規格書第 3 節）。大小（gzip 後，2026-10-04 量，KB＝1024 位元組）：`bulletin.js` 2.5 KB（2,541）、`nav.js` 1.6 KB（1,600）、`motion.js` 3.5 KB（3,626）、`hero.js` 3.6 KB（3,718）、`tutorial.js` 5.6 KB（5,745）、`typing.js` 2.6 KB（2,711）；「/」另有 `pick-lang.js` 1.0 KB（1,011）。都不算在下面 Next.js 的 JS 裡。

**搜尋與分享（規格書 §10）：** 都在產生網頁時寫進 HTML 或檔案，不靠瀏覽器裡的程式改（帶 `?ref=…` 打開，canonical 照樣是正式網址）。

- **`<head>`**：用 Next.js 的 metadata（`app/seo.js` 的 `langMetadata`、`rootMetadata`，`[lang]/layout.js`、`(menu)/page.js`、`global-not-found.js` 各接一次）。三語頁：`<title>` 與 description 是字串表的 `meta.title`、`meta.desc`；canonical 是 `https://collector.jerromy.com/<語言>/`；四頁（三語頁與 `/`）都放同一組五條 hreflang（`zh-Hant` 與 `zh` → `/zh/`、`en`、`ja`、`x-default` → `/`）；分享卡 `og:*`（圖 `/og/og-<語言>.png`、1200×630、`og.image.alt`；圖檔在圖示與分享卡圖那一段才產）與 `twitter:card` summary_large_image（Next.js 會從 `og:*` 自己補 `twitter:title` 這幾條）。`/`：標題 `root.meta.title`，說明是英、中、日三句 `meta.desc` 用「 / 」接起來；分享卡是三語的標題、英文那一句說明（`og:description`，Next.js 補的 `twitter:description` 也是這句）、英文那張圖（規格書 10.6）；沒有 noindex（它是 x-default）。404：`noindex` 是 Next.js 的 404 自己放的那一條（`global-not-found.js` 不再寫 `robots`，寫了就重複兩條；F2.5、F8.5f 守著）；分享卡只放英文那張圖（`og:image`、`og:image:type`、寬高、`og:image:alt`、`twitter:card`、`twitter:image`、`twitter:image:alt`）—— 說明、`og:title`、`og:url` 規格書沒寫，不放；所以不走 metadata 的 `openGraph`（Next.js 會從 `<title>` 自己補 `og:title` 與 `twitter:title`），在 `global-not-found.js` 的 `<head>` 直接寫那幾條。
- **圖示一套**（五頁都放）：`favicon-32.png`、`favicon-16.png`（跟擴充的 `clipper/icons/icon-32.png`、`icon-16.png` 位元組一樣；16 是畫在 16 格線上的那一組，不是縮的）、`apple-touch-icon.png`（180，不透明底 `#0c0e14`）、manifest（三語頁各用自己的 `/<語言>/site.webmanifest`，`/` 與 404 用英文那份）、`theme-color` `#1b1d24`。**不連 SVG 小圖**：一倍螢幕可能被拿去畫 16px，兩條會糊。PNG 是設計稿 `icons/site/` 的參考檔原樣放進 `public/`（16、32 改用擴充的檔，像素一樣、位元組不同）；記號改了才重產。
  - **`/favicon.ico`**：瀏覽器與爬蟲不看 `<head>` 也會去要它，沒有就是 404。`public/favicon.ico` 是 `npm run favicon`（`scripts/favicon.mjs`，只用 Node 內建模組）把 `favicon-16.png`、`favicon-32.png` 原樣包成 ICO（ICO 容器、裡面是 PNG，不改像素）；換了那兩張 PNG 就重跑、一起提交。`<head>` 不連它（照舊只連 PNG）。`tests-site` 的 favicon.test.js 量。
- **`site.webmanifest`**（`app/[lang]/site.webmanifest/route.js`，產生網頁時寫成檔）：`name` 是 `nav.brand`、`short_name` 是 `manifest.shortName`、`display: browser`（網站不是 App）、四個圖示（192、512 與兩張 maskable）。
- **結構化資料**（`<body>` 最後一段 `<script type="application/ld+json">`，`components/StructuredData`；放 `<body>` 是讓 `<head>` 短一點）：三語頁放軟體（作業系統只寫 Windows、macOS，價格 0、USD，安裝連結是商店頁，不放評分）、作者（部落格當 `url`，其他社群連結當 `sameAs`，從 `content/links.md` 讀）、常見問題七題（字串表 `faq.N.q`、`faq.N.a` 的純文字，不另寫一份）。「/」只放網站名稱（`WebSite`：`url` 是網域根、`name` 是英文名稱、`alternateName` 是中文與日文名稱；Google〈Site names〉要求放在網域首頁、一個網站一個名稱，所以語言頁不放）。影片等宣傳片上 YouTube 再放。內容是 `JSON.stringify(…)` 再把「<」換成 `\u003c`，字裡有 `</script>` 也跳不出去。常見問題的畫面在 13 區（`components/Faq`），問與答用同一份字串表的字，兩邊逐題一樣（`tests-site` 的 F8.2）。
- **`/` 分流**（`public/pick-lang.js`，`/` 的 `<head>` 裡同步執行，不是內嵌）：選過的語言（語言切換存在 localStorage 的 `collector-lang`）優先；沒有、讀不到或不認得，就看瀏覽器語言：`zh` 開頭 → `/zh/`、`ja` 開頭 → `/ja/`、其餘 → `/en/`。`?…` 與 `#…` 帶過去，用 `location.replace`（按上一頁不會被跳回來）。跳轉那一下給 `<html>` 加 `redirecting`，三語選單不畫（底色照樣是暗的，不閃白）。語言頁不載這一支，永遠不跳。關掉 JS 時 `/` 就是三語選單（版面照設計稿的 `.solo`）；`<h1>` 的三個名字之間有一個空白（畫面上照樣一個名字一行，純文字才不黏在一起）。
  - **跳轉要等 CSS 下載完**：`pick-lang.js` 在 `<head>` 裡排在 Next.js 自己的四支 CSS 後面（Next.js 與 React 把樣式表、預載、metadata 排在版面寫的 `<head>` 內容前面，版面改不了這個順序），瀏覽器要等前面的樣式表下載完才執行同步腳本。商店頁連的是 `/?ref=store`，從商店來的人第一次都會走這條；用 Lighthouse（手機）量，「redirects」那項估計多花約 0.9 秒。要排到最前面，得讓「/」不用 Next.js 的樣式（自己產一份 HTML 與 CSS），改動太大，先不做。能做的已經做了：「/」不預載字型、記號的 `<img>` 用 `loading="lazy"`（不然 React 會在 `<head>` 替它放一條預載），跳走之前不先下載這兩樣（原本約 63 KB 的字型與記號）。
  - **跟規格書第 4 節的差異（已知）**：在「/」按三顆語言鈕不會記住選了哪個（語言切換會記）。只有 `pick-lang.js` 載不到（或關掉 JS）時才看得到這三顆鈕。
- **`sitemap.xml`、`robots.txt`**（`app/sitemap.js`、`app/robots.js`）：網站地圖只列三個語言頁，每一頁標五個語言版本，不列 `/`；robots 全部允許（AI 爬蟲也是）、最後一行是網站地圖的網址。

**首屏與動態：** `components/Hero`（03）與 `components/Where`（04），每一段字畫在帶 `data-id`（字串表的 id）的元素裡，長相與斷行照設計稿（三語 × 十二種寬度逐行一樣，`tests-site` 的 F4.4）。

- **04「擴充本身」三格**：每一格至少放得下自己的字＋內距，放得下時三格一樣寬（字不壓分隔線、「accounts」「アカウント」不從中間斷）。設計稿寫 grid 的 `repeat(3, minmax(max-content, 1fr))`；`Where.module.css` 有 `nowrap` 的字，grid 的欄只能寫 `minmax(0, …)`（坑 9），所以寫成 flex：每一格 `min-width: max-content`、基準都是「兩邊內距＋分隔線」（`--zero-pad`），結果跟 grid 一樣。

- **宣傳片**（`public/hero.js`，`defer`）：`<video>` 一開始沒有 `src`（`data-src`），什麼都不抓。桌機（有滑鼠）、沒開省流量、沒設減少動態：`<head>` 的 `motion.js` 在畫第一格之前給 `<html>` 加 `video-auto`，捲到看得到三成才載入、才播（靜音、循環），捲出去就停、捲回來接著播。只有手指、省流量（`navigator.connection.saveData`）、減少動態：不自動播，顯示預覽圖＋大的播放鈕（手機 56、640 以上 72），按了才載入。預覽圖用 `public/images/hero-poster-<語言>-640|1280.webp`（`srcset`，`fetchpriority="high"`，桌機的 LCP 就是它；手機也在版心裡、有框線圓角，括號角在框外 8 —— 2026-10-04 起跟桌機同一個關係，不再貼齊兩邊），整張 1920:1080 顯示、不水平裁切（粒子版左邊的記號括號、右上的頁數、右下的標題都貼近邊）；燒進去的進度條（素材 y 1040～1042）用框裡最下方一條遮罩蓋住（`.crop::after`，高 50/1080、由透明到素材底色 #0c0e14＝`--color-text-inverse`、不擋點擊），影片跟預覽圖同一個位置。
- **宣傳片的鈕**：永遠只有一顆圓鈕（`data-play`），兩個圖示都在裡面，`data-state` 決定長相：`idle` 是大的播放鈕；`loading`、`playing` 是左下角 44×44 的暫停鍵（離框邊 24）；`paused` 是 44×44 的播放鍵。桌機自動播一開頁就是 `loading` 的暫停鍵（`video-auto` 在畫之前就加上，所以不會先閃一下大的播放鈕）。載入中按下去＝不要自動播：拿掉 `src` 再 `load()` 停止載入，記成使用者暫停；瀏覽器擋自動播放（`play()` 被拒）就拿掉 `video-auto`、回到大的播放鈕。使用者按過暫停，捲走再捲回來不會自己播；捲出畫面時的暫停不算使用者暫停。讀屏名字跟著換（`hero.video.play`／`hero.video.pause`）。底色是 `--color-bg-primary` 的 72%（毛玻璃），關掉 JS 時整顆藏起來（預覽圖照樣看得到）。
- **滑鼠移上去與按下去**：所有 `:hover` 都包在 `@media (hover: hover)` 裡（手指點過不會卡在移上去的樣子）；只有手指的裝置在 `@media (hover: none)` 用 `:active` 給「按下去」的樣子（主要、次要、圖示鈕、宣傳片的鈕、語言切換、文字連結、導覽列與選單的連結、影片說明的展開）。
- **只有手指與有滑鼠**：只有手指（`(hover: none) and (pointer: coarse)`）在每一種寬度都只顯示手指框、不顯示按鈕（平板 640 以上也是），所以這段 CSS 寫在 640 那條規則後面，免得被它蓋掉。最窄（319 以下）手指框內距 24 → 16、網址框左右 16 → 12，網址在 280、320 排兩行、360 起一行。中文大標在 359 以下讓 `.clamp` 變成行內，280、320 排成兩行短行。
- **分享框**（只有手指的裝置才看得到）：「分享這個網址」有 `navigator.share` 就用它（使用者自己取消就什麼都不做），沒有、或分享失敗，就把網址寫進剪貼簿、畫面下方浮出「已複製」（`position: fixed`，不推動版面，停 `--dur-breathe`（3.2 秒）後收掉）。「已複製」是一個開頁就在、字是空的 `role="status"` 元素：讀屏只念內容改變、不念剛出現的元素，所以只換字、變看得見，收掉時清空；剪貼簿也不行（App 裡的瀏覽器常這樣），手指框加上字面的 class `touch--noshare`：分享鈕收起，改顯示「長按下面的網址就能複製」（`share.fallback`）與網址框（`translate="no"`），焦點移到網址框。不跳 `prompt()`、`alert()`。關掉 JS 時（`<html>` 沒有 `js` class，`motion.js` 一開頭就加）直接是這個樣子；「寄給自己」是 `mailto:`（網址帶 `?ref=mail`）。分享與寄出的網址用正式網址（`app/site.js` 的 `SITE_URL`），不用看的人當下的網址。
- **動態**（`public/motion.js`，在 `<head>` 同步跑）：沒設減少動態時給 `<html>` 加 `js-motion`，進場前的樣子只在有它的時候套用，所以這支沒載到、或設了減少動態，畫面直接是最後的樣子。動畫本身都在 CSS，時間只用 `--dur-*` token。
  - A：首屏大標括號裡那半句，一字一個 `data-char`，以隨機順序冒出來一次（先螢光綠、再轉白），括號不動。**拆字要等 React 接手之後**：在那之前改 React 畫的字，React 會報錯、整頁重畫；`components/Hydrated` 在接手之後發 `collector:hydrated`，`motion.js` 收到才拆。等拉丁字型最多 `--dur-slow` 的兩倍（載不到也照樣開始），播完把字換回純文字。React 沒在 `--dur-slow` 的兩倍（960ms）內接手（手機慢、程式晚到），就放棄動態、直接把字露出來，之後也不再藏起來重播：括號裡那半句看不見的時間不超過約 1 秒（慢手機模擬量到第一次出字之後 0.74～0.77 秒）。
  - B：04 的三個 0 捲到時依序從上面一格滾下來，只播一次。D：首屏媒體框的括號角捲到時從框外收到框邊，只播一次。兩個都是 `data-reveal` 捲進畫面三成時加 `data-in`。動態 C 不放。
- 關掉公告條之後，焦點移到 `<main id="main">`（`tabindex="-1"`、不畫焦點框），不掉到頁首。
- 首屏預覽圖的替代文字是字串表的 `hero.video.alt`（純文字）。
- 已知限制：Android 通常沒有 Arial、Courier New，`local()` 抓不到，回退字型對不準，那裡字型換上來時還是可能跳。

**07 為 AI 做的**（`components/ForAI`）：小標、兩句大標（字串表的 `↵` 分成灰白兩列）橫跨整個內容寬；底下四點（每一點前面一對小括號夾著一條，畫在 `::before`）與看得懂這個資料夾的 AI 工具（3px 方角的小標籤，`forai.agents` 用「、」或「, 」切開），另一邊是資料夾樹與 AI 交出的大綱圖（1024 起樹在左、字在右，大綱圖壓在樹的右下角；更窄時字在上、樹在下）。伺服器端元件；瀏覽器裡跑的只有「AI 開始打字」的 `public/typing.js`（一般腳本）。

- **資料夾樹**：`[data-tree]`（`role="region"`、`tabindex="0"`、`aria-label` 是 `tree.label`），七行各是一個 `[data-line]`；檔名欄 13 個字寬（最長的 MATERIAL.md 11 個字加 2 個空白），英文最長那一行 46 個等寬字，桌機的框裡放得下。太寬時在自己的框裡左右滑，不撐破頁面；`<pre>` 照內容撐開、至少跟框一樣寬，右邊的內距才算進捲動範圍（捲到最右，字離框內緣約 30）。1024～1279 一欄只有約 440px，樹用整欄寬、左右內距 24；1280 起框占欄寬 84%、內距 30。鍵盤停在樹上（方向鍵可以左右捲）時拿掉右邊的淡出，焦點框才不會被裁掉。
- **樹一行一行長出來**：純 CSS 的捲動時間軸（`view-timeline` 掛在樹外面那一層 `.visual`：樹自己是左右捲的容器，掛在它身上會綁到它自己的捲動），捲到哪長到哪、往回捲收回去，不聽 scroll 事件。減少動態、不支援捲動時間軸的瀏覽器：七行直接都在。
- **可以左右滑的提示**：樹比框寬時右邊 40px 淡出，往右捲淡出跟著縮、捲到底收掉（`animation-timeline: scroll(self inline)`）；跟著手指的捲動改變，不是自己會動的動畫，所以減少動態時照樣有。不支援的瀏覽器沒有淡出，照樣滑得動。
- **樹裡的框線字**（├ └ ─）：兩個網頁字型都沒有這幾個字，回退到 Courier New（`JetBrains Mono Fallback`，一字 0.6 個字寬，跟 JetBrains Mono 同寬，對得齊）。
- **大綱圖**：只露出 OUTLINE.md 那塊的左半、右邊淡出；框的四個括號角捲到時對焦一次（動態 D）。圖永遠在 DOM 裡（讀屏讀它的 `alt`），打字層蓋在它的文字欄上（下一條）。
- **AI 開始打字**（`public/typing.js`，`defer`；gzip 後約 2.6 KB，2,711 位元組，2026-10-04 量；上限 3 KB，`tests-site` 的 F9.3 量）：樹的七行都長出來那一幀（七行透明度到 1、樹在畫面裡）算 0，打字層 `[data-typing]` 淡入蓋住圖的文字欄，400ms 打第一個字、之後每字 30ms、換行 150ms，超過 6 秒等比例縮到剛好 6 秒（三語都會縮）；打完拿掉游標、**淡出露出圖本身**（`data-done`，等 `--dur-slow` 再花 `--dur-slow` 淡掉）：停住的畫面就是靜態圖，跟減少動態、關掉 JS 一樣。捲走再回來不重打。每一幀照「從 0 起經過的時間」補上該出來的字（只往後加，一條 `requestAnimationFrame`），所以切到背景、捲走再回來、改寬度都不會疊計時器。游標 `[data-caret]` 是 `[data-typed]` 裡絕對定位的 2px 螢光綠塊，用 `transform` 移到最後一個字後面（行內元素每打一個字會被推一次，CLS 不是 0）。
  - **字從哪來**：`app/[lang]/typing.json/route.js` 在產生網頁時從 `data/agent.<語言>.json` 的 `outline` 取靜態大綱圖上那幾行（教學片第 13 章報告卡；行號範圍寫在這支 route 裡，照教學片 `fileCard` 的挑法），寫成 `out/<語言>/typing.json`：`text`（要打的字）、`hot`（圖上亮的行，照 `tutorial/13-ai.js` 的 `REPORT.firstHot`）、`wraps`（圖上折成兩列的行在第幾個字前折；行號與第二列開頭的字寫在 route 裡，找不到就產生網頁失敗）。打字層的 `data-src` 指到它。字不放進 HTML（HTML gzip 不算接手資料只多約 50 位元組）。07 快進畫面（下緣往下多看半個畫面高）才抓；減少動態、關掉 JS 不抓，打字層一直看不到，只有圖。
  - **長相**（設計審查 2026-10-04 改過：先前蓋住整張圖，標題列、行號、亮的行都不見）：打字層放在 `Crop` 裡（`children`），只蓋圖上的文字欄 —— 標題列（OUTLINE.md）下緣、行號欄右邊起（原圖 x 347、y 207）到右下角，標題列與行號欄留給圖。不透明的底 `--color-bg-primary`（跟圖的底同色）、`overflow: hidden`、`--font-mono`。一行一個 div（`data-k`：`h1` 白色粗體、字大一點；`h2` 淡一點；`gap` 空行壓成 8；`hot` 螢光綠字＋左邊直條），行與行之間的換行字元是 div 中間的空白、不佔位置；不自動折行（`white-space: pre`，超過的往右裁掉，日期、數字不會被拆開），只有 `wraps` 那幾個字前面折。字級、列高、內距用「原圖的 1 像素在畫面上多寬」（`100cqw ÷ 打字層在原圖上的寬`）換算，照教學片報告卡量的：內文 18.8、列高 32、標題 26／列高 50、`##` 列高 33，第一列上緣 227、字從 x 367 起；打字中第一行字跟圖上差不到 5px（三語 × 390、1440 量過），每一列跟圖上的行號對齊。
  - React 接手（`collector:hydrated`）之前不碰 DOM，同 `motion.js`；07 的元件還是伺服器端元件。
- **後端裁好的圖怎麼接**（`components/Crop`，07 的大綱圖與 05 第 3 張終端機截圖）：後端只把設計稿露出的那一塊（各邊多留一點）轉成 WebP，`public/images/images.json` 那一筆有 `crop`（那一塊在原圖的哪裡）與每個檔的寬高。
  `app/images.js` 讀這一筆，**檔名、寬高、裁切範圍一律從它來**，程式不寫死 1017、781 這類數字；後端重出圖時不用改前端。
  設計稿決定的「要露出哪一塊」（原圖的像素座標）寫在元件裡（`ForAI.js` 的 `OUTLINE`、`How.js` 的 `TERMINAL`），`Crop` 照兩塊的差往回移、放大；`<img>` 的 `width`／`height` 是最大那個檔的寬高（長寬比跟檔案一樣）。
  `sizes` 寫**圖實際畫出來的寬**（框寬 × 檔案那一塊的寬 ÷ 露出的寬，圖比框寬），不是框寬，瀏覽器才挑得對檔；各寬度的框寬怎麼算寫在元件的註解裡，版面改了（版心、欄間）要跟著改。截圖都是 `loading="lazy"`、`decoding="async"`、`fetchpriority="low"`。

**05 三步驟、06 能收什麼、08 隱私、15 最後的安裝**（照設計稿的那幾段）：

- **卡片**（`components/Card`）：一張卡＝圖示 → 標題（h3）→ 一句 →（06 才有）「看教學 NN」。內距 30、卡片之間 16、髮絲框、8px 圓角；底色讀 `--card-bg`（`Band` 的淺層把它換成深的）。手機一欄、640 起兩欄、1280 起四欄（1024 時一張卡的字一行只剩 7～9 個日文字，照設計稿先兩欄）。06 的「看教學 NN」整張卡都能按（連結的 `::after` 蓋滿整張），連到 09 區那一章的 `#ch-NN`（09 做好之前那個錨點還不存在）。捲進畫面三成時往上浮出、同一排照欄位晚一點；減少動態、沒有 JS 時直接在。
- **05**：三步驟各一張截圖（`/images/step1-setup-*`、`step2-saved-*`、`ai-terminal-*`；`ai-terminal` 是後端裁好的那一塊，用 `Crop` 接），裁切的座標照設計稿、中英日各自量的。640 起三欄，標題、說明、截圖各自對齊同一條線（subgrid）。
- **08**：四張卡（沒有伺服器、沒有帳號、沒有追蹤、只碰你挑的資料夾），底下連到 `https://jerromy.com/privacy/`。**網站 08 是隱私條款的第五份拷貝**（另外四處見 GPTPlugins 的 CLAUDE.md「多國語系」）：條款改了，這四張卡講的事要跟著對一次；08 不寫日期。
- **15**：有滑鼠是「加到 Chrome」；只有手指換成跟首屏同一個 `TouchBox`（分享、寄給自己、用的是電腦？，分享的退路也一樣）。`public/hero.js` 的分享接到頁面上每一個手指框；「已複製」整頁一個，放在首屏外面（`Hero` 回傳首屏與提示框兩個並列的元素）：首屏是 `isolation: isolate`，提示框放在裡面的話 `z-index` 只在首屏裡比，後面的 15 區會蓋住它。
- **字串表的 `features.more`**（「看教學 %nn%」）在元件裡代入章號；06 的字不寫「檔名從內容算出來」「來源全部保留」（規格書 §5-06，`tests-site` 守著）。

**09 教學影片**（`components/Tutorial`，`public/tutorial.js`）：

- **影片 ID**：`app/site.js` 的 `TUTORIAL_VIDEO_IDS`（一語一支）。**現在三語都是空字串**（教學片還沒上 YouTube）：09 不放播放鈕與「在 YouTube 上看」，大標換成 `tutorial.title.noid`、說明換成 `tutorial.lead.noid`（不說「點章名就播」），一句 `tutorial.noid.note` 放在影片框外面、框的下一列（手機排在框底下，隔 16、靠左；640 起疊回框的左下角，離框邊 24），每一列章節就是摘要的開關。影片上傳後把 ID 填進去、`npm run build` 就好，不用改別的。**ID 只收空字串或 11 個字元（英數字、`-`、`_`）**，填成整個網址或打錯時產生網頁會失敗，訊息講是哪一語、填了什麼。
- **不按不載入**：開頁時整頁不碰 YouTube（沒有 `<script>`、`<link>`、`<iframe>` 連到那些網域）。按了播放鈕、章名、或 06 的「看教學 NN」，`tutorial.js` 才載入 `https://www.youtube.com/iframe_api`（整頁一次），在影片框裡建播放器：加強隱私模式（`youtube-nocookie.com`）、`rel=0`、`playsinline=1`。
- **播放器程式載不到**（被擋、出錯，或按下去 **8 秒**播放器還沒好 —— 程式沒到、或播放器建了卻一直沒 ready）：影片框回到還沒按的樣子（`idle`、播放鈕放回來、不標任何章、建了一半的播放器拿掉），蓋一句話請人改用底下的「在 YouTube 上看」（字串表的 `tutorial.apifail`，`role="status"`）：640 起在框的左上角（上 16、左 24）；手機整個框蓋一層不透明的底、字放中間，播放鈕縮成 44 放在底下正中間。焦點留在播放鈕；再按會重試。程式在逾時之後才到時不自己播，再按就直接用（已經在載就只等它好，不再載一次 `iframe_api`）。
- **一章一章播**：播放鈕從 0:00（第 01 章）播，章名從那一章的起點播；每 250ms 看一次播到哪，到那一章的結尾停，蓋上章尾那一層（重播這一段／播下一段：下一章的章名；第 16 章停在 8:49、只問從頭再看一次），焦點移到「播下一段」（或「從頭再看一次」），Esc 收掉。真的播起來才標正在播的那一章（按鈕 `aria-current="true"`、章名底下寫「正在播放」；還在載入、或載入失敗時都不標），清單只捲清單（`scrollTop`），把那一列捲到清單頂。播放中自己拖進度到別章：改認時間所在的那一章，播到那一章的結尾才停。Esc 收掉章尾那一層之後，焦點回到那一章的按鈕。影片框的 `data-state` 是 `idle`／`loading`／`playing`／`paused`／`ended`。
- **章尾那一層**是一份，標題裡的 `%章名%` 由 `tutorial.js` 換成這一章的章名；「播下一段」的章名直接用清單那一列已經排好的（同一套斷行），不另外排。它疊在影片框上（`position: absolute`），手機上放不下就往下蓋住清單，不推動版面。
- **章節的字**：`data/chapters.<語言>.json`（後端產的）。章名與摘要沒有手排的斷行標記，照 `strings/README.md`「從資料轉進來的字」的規則在產生網頁時算（`app/data-text.js`，跟設計稿的產生程式同一套：每個單位的尾巴綁「最後 5 個全形字寬」、日文挪完落在助詞再往前併一個詞、中日文不到 5 個字的句子併回前一句；三語 16 章的章名與摘要 HTML 對設計稿逐字比過一樣），`components/DataText` 畫成元素。
- **排法**：照 09 那一塊的寬（container query）。內容 ≥ 960（1024 起）影片在左、章節在右，清單自己捲、上下跟影片框對齊，下緣淡出表示還有（跟著捲動走）；更窄時影片在上、先列 5 章，其餘收在「看全部 16 章」（`<details>`，關掉 JS 也打得開）。手機的影片框貼齊兩邊。
- **錨點**：`#tutorial`、`#ch-01`～`#ch-16`（每一章的 `<li>`）。06 的「看教學 NN」由 `tutorial.js` 接手（停的位置都讓開導覽列）：有影片時捲到影片上緣、從那一章播；沒有影片時，寬的時候捲到影片上緣、清單把那一列捲到清單頂，窄的時候捲到那一列（收在「看全部」裡就先打開），兩種都打開那一列的摘要、網址換成 `#ch-NN`。關掉 JS 時就是原生的錨點。所以 `tutorial.js` 每一頁都載入（有沒有影片都要）。
- **計數**：有影片時每一章的按鈕帶 `data-goatcounter-click="tutorial-NN"`。
- **結構化資料**：現在不放影片（`VideoObject` 要上傳日期，ID 帶不出來；影片上傳後連同日期放哪裡一起定）。
- **上線前要用真的影片 ID 看一次**（桌機 Chrome、iPhone Safari、Android Chrome）：每一章從對的時間開始、播到章尾停、章尾那一層。測試用的是假的播放器，時間是算出來的。
- **用鍵盤按播放鈕**：播放鈕一按就藏起來，焦點原本會掉到 `<body>`（下一個 Tab 從頁首開始）。所以按的當下焦點在播放鈕的話，`tutorial.js` 先把焦點放到影片框（`[data-player]`，`tabindex="-1"`：程式放得上去、Tab 不停），載入中、播起來之後都留在那裡；載不到時放回播放鈕（`tests-site` 的 F7.15）。

**10～16**（照設計稿 5b74044 的 10～16 與狀態一覽；`home.css`「10 支援裝置」與第三批 4-3 那一段；14 社群寫壞的虛線框照 004264c）：都是伺服器端元件，畫在 `data-section`＋`data-id` 的元素上（介面約定見 `tests-site/README.md`「10～16（F8）」）。

- **10 支援裝置**（`components/Devices`）：淺的那一層；四張卡（✓ 兩張、✕ 兩張，讀屏念 `devices.yes`／`devices.no`，`.sr` 在全域 CSS）＋規格表（`<dl>`：640 以下標題在上、內容在下，640 起兩欄 subgrid）；1280 起左卡片、右規格表。
- **11 最新公告**（`components/News`）：一則一張卡，照內容檔的順序；前三則一排（`Cards cols={3}`：1024 起三欄、兩則兩欄、一則跨兩欄＋卡片裡左右排），第四則起收在 `Older`（`news.older`）。標題、內文是 `bindTail` 的輸出（內文 `white-space: pre-line`，使用者的換行照留）；有連結才有「看全文」（整張卡都能按，`blog-news`）；置頂的框線亮一階＋`news.pinned` 標籤。寫壞的一則：一樣大的虛線卡（`<li data-entry data-state="unreadable">`）；一則都沒有：`news.empty`；整支讀不到或每一則都寫壞：整區一個虛線框（`state.unreadable.section`）。
- **12 更新紀錄**（`components/Changelog`）：淺的那一層；一版一段（`[data-version]`），最新兩版攤開，第三版起收在 `Older`（`changelog.older`）；最上面那一個好的版本標 `changelog.latest`。
  - **從 1.0.4 開始列**：下限是 `app/site.js` 的 `CHANGELOG_FROM`（只寫在那裡），`app/changelog.js` 的 `listed()` 照版本號一段一段比；比它舊的好版本（1.0.3）不列，收合裡也不放。理由：使用者 2026-10-02 決定（1.0.3 是第一個公開版本，沒有「改了什麼」可講）；規格書 §5-12 寫的「從 1.0.3 開始」以這裡為準。寫壞的那一版（版本號讀不出來）照樣畫一個虛線框。
  - **類型標記**：只有在 `app/changelog.js` 的 `KINDS`（＝`strings/README.md`「更新紀錄的類型標記」那三行清單，英文不分大小寫）裡的 kind 才畫成左邊的螢光綠標記（`[data-kind]`，字照內容檔寫的），內文是冒號後面那段；其他（清單外的短詞、沒有前綴卻有冒號的整句 —— 後端會把整句切成 kind，例：`content/changelog.zh.md` 的「拿掉選取文字後浮出的按鈕：…」、沒有冒號的）左邊空著，整句用後端給的 `raw`。**加類型詞要三邊一起加**：`strings/README.md`（測試從那裡讀）、設計稿產生程式的 `KINDS`、`app/changelog.js`。
  - 寫壞的一條：那一行一個虛線框（從左邊那一欄開始），同一版其他條照常；整支讀不到或每一版都寫壞：整區一個虛線框。
  - 讀得到、但過濾掉不列的版本之後一版都沒有（例：內容檔只有 1.0.3，或是空檔）：一句 `changelog.empty`，樣式同 11 的 `news.empty`，不畫虛線框（設計稿 1d18ae2，notes/4-4.md 的 A1）。
- **13 常見問題**（`components/Faq`）：七題各一個原生 `<details>`（第一題 `open`，不設 `name`）；題目是 `<summary>` 裡的 h3，答案在同一個 `<details>` 裡（收著也在 HTML 裡）；1024 起標題在左、捲動時停住（sticky）。答案裡的兩個句子連結（`faq.2.a` → `#privacy`、`faq.4.a` → `#devices`）用 `<Seg link>`：在原字裡找 `strings/README.md`「句子裡的連結」那張表的字包成 `<a>`，找不到就讓產生網頁失敗。設計稿提醒：`<summary>` 裡的 h3 在 VoiceOver 上可能被當成按鈕吃掉標題語意，沒用真的螢幕閱讀器試過。
- **14 作者與社群**（`components/Author`）：淺的那一層；照片（`images.json` 的 `author-jerromy.jpg`，手機 96、1024 起 160，`loading="lazy"`）、名字（這一區唯一的 h2）、兩段簡介、「到部落格看更多」（`blog-author`）＋社群一排（`Socials unreadable`：寫壞的那一條只在這裡畫 44 高的虛線框，上下內距 `calc((44 − 框線 2 − 一行) ÷ 2)`，排兩行時框跟著長高）。
- **16 頁尾**（`components/Footer`，`layout.js` 裡 `<main>` 的後面）：記號＋名稱＋一句＋社群（跳過寫壞的）、產品｜幫助兩欄、沒有隸屬關係與 GoatCounter 兩句（`GOATCOUNTER_CODE` 還是空的時候也在）、©、語言切換。回報問題是一封寫好的信，收件人跟擴充「遇到問題」同一個（`components/Footer/Footer.js` 的 `REPORT_TO`），標題 `mail.report.subject`、內文 `mail.report.body`（`%url%` 換成這一頁的正式網址）。中文頁尾跟設計稿一樣不設 `keep-all`（設計稿的 `keep-all` 只到 `main`）。
- **進場**：10、11 的卡片、12 的每一版捲進畫面三成時往上浮出（同 05、06、08；三欄的照欄位晚一點），減少動態、關掉 JS 時直接在。

**數人次（GoatCounter，規格書 §11）**：站台代碼放 `app/site.js` 的 `GOATCOUNTER_CODE`。現在是空字串（還沒開帳號）：網頁不載入、不送任何請求。填了代碼，三語頁的 `<head>` 才放 `<script async src="//gc.zgo.at/count.js" data-goatcounter="https://<代碼>.goatcounter.com/count">`；「/」與 404 不放。要數的按鈕帶 `data-goatcounter-click="<名字>"`，名字照規格書 §11 那張表；現在頁面上有的是導覽列的 `install-nav`、首屏的 `install-hero`、手指框的 `install-mobile-hero`（「用的是電腦？」）、`share-hero`、`mail-hero`，15 區的 `install-final`、`install-mobile-final`、`share-final`、`mail-final`（`TouchBox` 照 `prefix` 取名），與選單、14 區、頁尾的社群圖示 `social-<代號>-menu`／`-author`／`-footer`（`Socials` 給了 `place` 才數）；11 的「看全文」`blog-news`、14 的「到部落格看更多」`blog-author`，頁尾的 `install-footer`（商店）、`report`（回報問題）、`blog-footer`。每顆也帶 `data-goatcounter-title`（字串表的純文字），後台看到的是按鈕上的字，不是 HTML。其他區做好時各自補。

**圖示的出處：**（04 與 10 的品牌標誌是 CC0，但商標權不在 CC0 裡；Simple Icons 從 14 版起拿掉了 OpenAI、從 13 版起拿掉了 Windows 的標誌，原因沒查。用之前要不要看三家的品牌規定，是使用者的決定）從設計稿的 `icons/` 原樣複製（設計稿 2026-10-02 從 unpkg.com 下載，網站不從 CDN 連）。畫法是 CSS 的 mask，顏色跟著字走；`app/styles/global.css` 的「圖示」那一段用 `data-icon` 對到檔案。

| 檔（`public/icons/`） | `data-icon` | 出處 | 授權 |
|---|---|---|---|
| `ui-list.svg`、`ui-close.svg`、`ui-arrow-right.svg`、`ui-play.svg`、`ui-share.svg`、`ui-mail.svg`、`ui-caret-down.svg`、`ui-check.svg`、`blog.svg` | `list`、`close`、`arrow`、`play`、`share`、`mail`、`caret`、`check`、`blog` | Phosphor Icons 2.1.1（`@phosphor-icons/core`） | MIT（`LICENSE-phosphor.txt`） |
| `feat-article.svg`、`feat-selection.svg`、`feat-image.svg`、`feat-reply.svg`、`feat-chat.svg`、`feat-files.svg`、`feat-topics.svg`、`feat-once.svg`、`priv-server.svg`、`priv-account.svg`、`priv-tracking.svg`、`priv-folder.svg` | 同檔名（06、08 的卡片） | Phosphor Icons 2.1.1（light） | MIT（`LICENSE-phosphor.txt`） |
| `ui-replay.svg` | `replay`（09 的「重播這一段」） | Phosphor Icons 2.1.1（light） | MIT（`LICENSE-phosphor.txt`） |
| `ui-push-pin.svg`、`ui-warning-circle.svg` | `pin`（11 的「置頂」）、`warn`（「這一條讀不到」） | Phosphor Icons 2.1.1（light，設計稿 2026-10-02 下載） | MIT（`LICENSE-phosphor.txt`） |
| `facebook.svg`、`instagram.svg`、`x.svg`、`threads.svg`、`youtube.svg` | 社群代號、`youtube`（09 的「在 YouTube 上看」） | Simple Icons 16.33.0 | CC0（`LICENSE-simple-icons.md`） |
| `claude.svg`、`perplexity.svg` | 同檔名（04 能用在哪裡） | Simple Icons 16.33.0（設計師 2026-10-04 抓的，跟 unpkg 的 16.33.0 位元組相同） | CC0（`LICENSE-simple-icons.md`） |
| `openai.svg` | `openai`（04 的 ChatGPT） | Simple Icons 13.21.0（16.33.0 已經沒有這個標誌；跟 unpkg 的 9.21.0～13.21.0 位元組相同） | CC0（`LICENSE-simple-icons.md`）；商標另計，見下面 |
| `where-globe.svg` | `where-globe`（04 的一般網頁） | Phosphor Icons 2.1.1（regular `globe`，跟 unpkg 位元組相同） | MIT（`LICENSE-phosphor.txt`） |
| `apple.svg`、`firefox.svg`（Simple Icons 的 `firefoxbrowser`）、`safari.svg` | 同檔名（10 支援裝置的平台圖示） | Simple Icons 16.33.0 | CC0（`LICENSE-simple-icons.md`） |
| `windows.svg` | `windows`（10 的 Windows） | Simple Icons 12.0.0（13 版起已經沒有這個標誌） | CC0（`LICENSE-simple-icons.md`）；商標另計 |
| `device-mobile.svg`、`device-tablet.svg` | 同檔名（10 的手機、平板，兩個一組） | Phosphor Icons 2.1.1（regular） | MIT（`LICENSE-phosphor.txt`） |

「Simple Icons 的圖是不是各家官方那一版、各家商標規定准不准這樣用」未查證。記號 `public/mark.svg` 是 GPTPlugins 的 `clipper/icons/mark.svg` 原樣複製，換記號時一起換。
`content/links.md` 新加一個社群代號時：圖放進 `public/icons/`、`global.css` 加一行 `[data-icon="代號"]`、`components/Socials/Socials.js` 的 `ICONS` 加上代號，字串表加 `social.代號`；還沒加之前，那個連結畫成代號的第一個字母、名字用代號（`npm run content:check` 會警告）。

**第一次打開 `/zh/` 的 JS：** gzip 之後 169.3 KB（173,377 位元組，7 支，2026-10-03 首屏做好之後，Next.js 16.3.8 與 React 19.3.0 本身佔了幾乎全部；多出來的一支是 `Hydrated`）。量法是 `tests-site` 的 F1.8：`/zh/` 的 HTML 裡 `<script src>` 與預載的 JS，各自 gzip 後加總；上限 300 KB。大改之後照 `npm run test:site` 印出的數字更新這裡。

## 內容寫壞了會怎樣

使用者在 GitHub 網頁上改 `content/` 的文字檔、存檔，Cloudflare 就會重新產生網頁。建置指令是 `npm run build:pages`：先跑 `npm run content:check`，再跑 `npm run build`。

內容寫壞時（哪怕只有一條），`npm run content:check` 會失敗，但**不擋**部署：建置紀錄裡會多一行**警告**（「警告：內容有寫壞的地方…」），後面的產生網頁與部署照常跑。網站上寫壞的那一條會顯示「**這一條讀不到**」，其他條照常（規格書第 7 節）。要看哪裡寫壞：Cloudflare 後台這個專案的 Deployments，點最新那一次，看建置紀錄裡 content:check 的輸出，每個問題一行：哪一支檔、第幾行、什麼原因；照著修好、存檔，Cloudflare 會自動再部署一次。

真正擋部署的是 `npm run build` 失敗（例如寫壞到連網頁都產生不出來）：這一次不會上線，網站**維持上一版**，Deployments 那一頁顯示失敗。

`npm run content:check` 是做網站的人在**提交前**跑的：在網站的根目錄跑，會印出每支檔讀到幾筆和要修的地方。使用者在 GitHub 網頁上改檔，沒有地方先跑它，所以部署時再替他跑一次，寫壞時留下警告提醒（不擋部署）。

**社群代號缺名稱的警告：** `content/links.md` 加了新的代號（例如 `mastodon`），網頁上要有它的名稱，名稱寫在 `strings/` 的三個語言檔裡（`social.mastodon`）。`npm run content:check` 會查：links.md 每一個寫對的代號，`strings/zh.json`、`en.json`、`ja.json` 都要有 `social.<代號>`；缺了就印一條警告，寫到代號與缺的語言檔名。這只是警告：不算錯、結束碼不變、不擋部署，建置紀錄也**不會**因此多出「內容有寫壞的地方」那一行（那一行只在內容寫壞、結束碼是 1 的時候才有），要看 content:check 的輸出。查的資料夾預設是網站的 `strings/`，`--strings <資料夾>` 可以換；`--strings` 指到不存在的資料夾，或某一個語言檔不在、不是 JSON，也只是一條警告（那一部分沒檢查，其他照查），只有 `--strings=` 給空字串才是用法錯誤（結束碼 2）。

`npm test` 不是上線關卡：Cloudflare 只跑 `content:check` 與 `build`，不跑 `npm test`。測試是做網站的人改完程式後在自己電腦上跑的，紅了先修，但不會擋住使用者改文字、上線。

## 使用者寫的內容怎麼交給網頁：公告的換行與孤字綁定

使用者在 `content/` 裡寫的公告、更新紀錄，網頁照他寫的換行顯示，只補一個防孤字的安全網（`strings/README.md`「使用者自己寫的內容」那一節）。

**公告的 `body` 保留使用者的換行。** `lib/news.js` 讀進來的公告內文（`body`）：行與行之間是 `\n`，中間有空白行（段落）是 `\n\n`，連續好幾個空白行壓成一個 `\n\n`；每行去掉頭尾空白（行首的空白也去掉），整段去掉頭尾的空白行，裡面沒有 `\r`（Windows 的換行也一樣）。「連結：」「置頂」那一行、註解、落單的 `-->` 不算內文，也不算空白行：連結夾在兩行中間不會造成分段，只有真的空白行才算。沒有內文是空字串，單行的公告跟以前一樣。內文不轉 Markdown，`**粗體**` 照字顯示。網頁顯示時用 `white-space: pre-line`（換行照樣顯示），或自己照 `\n` 拆成行。

**孤字綁定與詞界 `bindTail(text, lang, { tail })`**（`lib/bind-tail.js`）：把使用者寫的一段話變成安全的 HTML（跳脫 `& < > " '`），並做兩件事：把最後一個非空行的最後幾個字包進 `<span class="nw">…</span>`（不換行），免得最後一行只剩一個字；中文再在詞界插 `<wbr>`，免得瀏覽器把詞從中間拆開（「暫｜時不能用」「修｜正」）。

- **孤字綁定。** 中文、日文綁最後三個字。英文綁最後兩個字：以空白切字，標點、連字號、縮寫的點、撇號、emoji、網址都跟著它（`well-known`、`e.g.`、`https://…` 都是一個字），兩個字之間的空白在 span 裡，前面的空白與結尾的空白、換行在外面。中文頁面裡的英文照中文的規則。多行只綁最後一個非空行，不從上一行借字；只有一個字就只包它。
- **英文有長度上限（`EN_TAIL_MAX_CHARS`，20 個字元，以 Unicode 碼位算）。** 最後兩個字合計（含中間的空白）超過 20，就只綁最後一個字；最後一個字本身超過 20（長網址、長單字），就不綁。原因：綁住的那段不能換行，太長會在手機 280 寬撐出橫向捲軸。不綁時 `tail` 接在最後一個字後面。
- **只對中文插詞界 `<wbr>`；日文不插。** 用 `Intl.Segmenter`（`zh-Hant`，`granularity: 'word'`）切詞，只插在同一行裡「相鄰兩段都是詞」的地方：標點與空白的前後都不插，不連續兩個，不在每一行的頭尾，不在綁住的 span 裡面（詞界剛好在 span 開頭時，`<wbr>` 在 span 前面）。**短引號裡不插**：`「…」`、`『…』`、`“…”` 一對裡面 12 個字以內（不算引號本身）整段不插，13 個以上照插，沒關起來的引號不算。拿掉所有 `<wbr>`，結果跟不插時逐字相同。日文不插：ICU 把日文動詞活用切得太碎（「使｜え｜ませ｜ん」），插了反而把動詞從中間拆開、短行變多；英文本來就能在空白斷行。
- **日文、英文的短引號整個包成 `nw`。** 同一行裡成對的短引號（`「…」`、`『…』`、`“…”`），連引號本身包成 `<span class="nw">「…」</span>`，免得公告與更新紀錄在短引號裡面斷行（「これを｜保存」「Save｜page」）；沒關起來的不包，中文不包（中文靠上一條的「短引號裡不插 `<wbr>`」加 `keep-all`）。**各語言有自己的門檻與 `span` 上限（以 Unicode 碼位算）：日文引號裡 8 個以內才包（不算引號本身），整個 `span`（含引號本身與往前延伸的部分）最多 10 個；英文引號裡 12 個以內才包，整個 `span` 最多 20 個（`EN_TAIL_MAX_CHARS`）。** 日文比較小，是因為日文是全形字：12 字的引號連引號是 14 個全形字，包成不換行之後在窄手機（280 寬）會撐出橫向捲軸（設計稿量到：12 字引號在公告標題超出內容框 65px、整頁橫捲 18px；8 字以下四種容器在 280 寬都是 0）。所以**日文 9 個字以上的引號照舊可能在引號裡斷行，這是為了 280 寬刻意放掉的**。配對是開引號往後找同一行最近的同一種關引號，不跨行；由前到後挑，跟已經挑到的那一對重疊的不挑，所以巢狀只包最外面那一對，外面那一對太長（不算短引號）時，裡面的短引號照包。已經整個在最後幾個字的綁定範圍裡的不重複包；跟綁定範圍部分重疊的，綁定範圍往前延伸到開引號（`ボタン<span class="nw">「これを保存」</span>`），延伸後超過那個語言的 `span` 上限（日文 10、英文 20）就不延伸、那一對也不包（少見）。每個 `span` 都不巢狀、不跨行。
- **樣式要配合。** 中文：放使用者內容的區塊要設 `word-break: keep-all`（只在 `<wbr>`、空白、標點處斷，詞不會被從中間切開），**並加 `overflow-wrap: anywhere`**：`keep-all` 沒有 `overflow-wrap` 兜底時，一長串沒有斷點的中文會橫向捲動；放在 flex 子項裡 `overflow-wrap: break-word` 兜不住，要用 `anywhere`，或在子項加 `min-width: 0`。`keep-all` 時一個詞比一行還長，那一下還是會把詞拆開。日文：靠 `word-break: auto-phrase`（瀏覽器照詞組斷行），**元素要有 `lang="ja"` 才生效**。英文：照一般斷行。
- **`Intl.Segmenter` 的切法跟著 ICU 版本走**，不同版本的 Node 少數詞界可能不一樣；網頁在產生時（Node）算好寫進 HTML，瀏覽器不再算。沒有 `Intl.Segmenter` 的環境載得進這支檔、英文照常，處理中文、日文時丟一個寫到 `Intl.Segmenter` 的中文錯誤（綁最後三個字的字位也要用它）。
- **舊版 Node 的極端情況。** 舊版 Node 的 `Intl.Segmenter` 切很長的一整段字很慢，所以找最後三個字只切最後 64 個 UTF-16 單位（`GRAPHEME_WINDOW`）、詞界一小串一小串地切。極端的例子：一行二十萬字、沒有任何標點與空白，Node 21 中文約 7～8 秒（日文不切詞，不受影響），Node 22 約 0.1 秒；部署用 Node 22，而且實際的內容不會這樣寫。另一個極端：一個字後面接上百個組合符號，只看最後 64 個單位會從組合符號中間開始綁；正常內容不受影響。
- 第三個參數 `tail` 是尾端圖示之類的 HTML 片段，**原樣插在 span 的裡面、結尾**，跟最後幾個字一起換行（箭頭才不會單獨掉到下一行）。它不會被跳脫，所以**只能傳自己寫的固定片段**（例如 `<span class="i i--arrow"></span>`），不能放使用者寫的字；不是字串會丟 `TypeError`，沒給（或是空字串）跟以前一樣。
- 輸出是 HTML 字串，要用 `dangerouslySetInnerHTML` 放；字串表的字（`parseSegments` 轉出來的元素樹）不是這樣放，見「字串表」一節，兩種做法不要混用。

**更新紀錄條目的原句 `raw`。** `lib/changelog.js` 讀進來的每一條好條目是 `{ ok, kind, text, raw }`：`kind` 是冒號前的類型詞（「修好」「新增」…），`text` 是冒號後面的內容，`raw` 是使用者寫的原句，也就是那一行去掉開頭的「-」與頭尾空白（冒號、冒號兩邊的空白都留著，註解已經拿掉；沒有冒號時 `kind` 是空字串、`raw` 跟 `text` 一樣）。網頁認得的類型詞才拿 `kind` 當標籤；遇到不認得的（「雜項」「Misc」…），用 `raw` 把冒號接回去、整句當內文，不要把它的 `kind` 當標籤。壞條目照舊是 `{ ok: false, line, raw, reason }`，它的 `raw` 是原檔那一行（含「- 」），跟好條目的 `raw` 意思不同。

## 章節與素材的程式要留在 GPTPlugins 跑

`scripts/chapters.mjs`（教學章節）與 `scripts/media.mjs`（宣傳片、預覽圖）讀的是網站 repo 外面的東西：教學片的 `tutorial/`（章名與時間表）、宣傳片與預覽圖的 `release/`。它們都在 GPTPlugins 這個 repo 裡，不會跟著搬進公開 repo。所以這兩支要**留在 GPTPlugins 跑**（在 GPTPlugins 的 `homepage/site/` 裡跑 `npm run chapters`、`npm run media`）；搬進網站 repo 之後它們還在，但預設路徑會指到 repo 外面，在那邊跑不起來。

兩支的產出：`scripts/chapters.mjs` 寫 `data/`（三個語言的教學章節資料），`scripts/media.mjs` 寫 `public/media/`（拿掉音軌的宣傳片、預覽圖和 `media.json`；要用到 ffmpeg 與 cwebp，路徑怎麼指看 `scripts/media.mjs` 開頭的說明）。**產出的 `data/` 與 `public/media/` 再帶進網站 repo 提交。** 教學片重算過（章名或時間改了），就要重跑一次 `chapters`。

## 字型

網頁字型只有兩個**瘦身過的拉丁字型**：Google Sans Flex（內文）與 JetBrains Mono（等寬的小標籤）。**中文與日文不放網頁字型，走系統字型**（設計系統 `--font-zh` 的回退：mac 的 PingFang TC、Windows 的微軟正黑體 UI、Noto Sans TC；日文是 Hiragino、Yu Gothic、Noto Sans JP）。字型變數從整頁繼承，所以 `app/styles/global.css` 除了 `:lang(ja)` 那幾段，另有一段 `[lang="zh-Hant"]` 把 `--font-zh`、`--sans-tail`、`--font-mono`、`--font-sans` 換回中文：日文頁語言切換的「中」才是中文字型（設計稿 1d18ae2，notes/4-4.md 的 A4；F10.3 守著）。

`public/fonts/` 整個資料夾約 111 KB：兩個字型檔 63.3 KB 與 30.6 KB（瘦身前是 590.6 KB 與 63.9 KB）、`fonts.css`、`LICENSES.md`（兩套字型的授權查核）與 `licenses/` 裡兩份授權原文。兩個字型檔合計 94.0 KB（93,952 位元組），預算上限是 150 KB，`npm run fonts:budget` 量它。

**中文頁、日文頁、英文頁下載的字型一樣多：兩個字型都會下載，合計約 94 KB。** `fonts.css` 的 `unicode-range` 只含拉丁字元，中文、日文的字本身不會觸發下載；但頁面上一定有英文、數字與空格，Google Sans Flex 就會下載，頁面裡的等寬小標籤（版本號、檔名一類）也在中文頁與日文頁，所以 JetBrains Mono 也會。規格書第 9 節的「中文頁第一次打開，字型不超過 400 KB」，94 KB 綽綽有餘（那一條原本是為 Glow Sans TC 分片訂的）。

為什麼中文不放網頁字型：設計系統的 Glow Sans TC 完整字型缺「教」「告」「清」「真」「・」「↺」（教學影片的「教」就缺，混用系統字型會一個詞兩種字體）；改用分片，中文頁要下載 7～14 MB；設計稿一開始排的就是系統中文字型。這一節的數字是這個專案 2026-10-02 自己量的，Glow Sans TC 一個檔都沒放進來（`LICENSES.md` 有一節寫不放與原因）。

兩個字型怎麼瘦的（`npm run fonts`，用 python 的 fontTools）：

- Google Sans Flex（63,336 位元組，108 個字）：固定掉 wdth（100）與 slnt（0）兩個軸，**光學尺寸 opsz 留 8～64**，字重 wght 留 300～700，再只留 U+0020～007E 與文字檔裡出現的非中日文字，WOFF2 格式。fvar 只剩 opsz（8～64，預設 18）與 wght（300～700）兩個軸。
- **opsz 為什麼不固定成 18**：設計稿幾乎每個元素都用 `font:` 簡寫，簡寫會把 `font-variation-settings` 重設成 normal，瀏覽器就走 `font-optical-sizing: auto`，實際的 opsz 等於字級（64px 的大標用 64、14px 的導覽用 14）。固定成 18 試過：英文大標變寬 27 px（773.1 → 800.3）、導覽列變窄 14 px、說明文字從 4 行變 3 行、整頁高度少 59 px，第一批量過的換行會失效。留範圍 8～64 之後，這些都跟原本一樣（量法與數字在下面）。頁面用到的字級是 14～64 px（量過），在範圍裡。
- 設計系統 `base.css` 的 `font-variation-settings`（opsz、wdth、GRAD、ROND）：wdth、GRAD、ROND 在這個檔裡沒有那些軸，設定會被忽略、不報錯；opsz 軸還在，所以 `"opsz" 18` 在沒被 `font:` 簡寫重設的地方照樣有效。不要用 `font-stretch`、斜體（`oblique`），這個檔沒有那些軸。
- JetBrains Mono（30,616 位元組，113 個字）：**只切子集，沒有動可變軸**（字重還是 100～800）。量過三種做法（這三個數字是加入字串表的字之前量的，現在只切子集是 30.6 KB）：原樣複製 63.9 KB、只切子集 30.4 KB、切子集再把字重限縮到 300～700 是 28.3 KB。切子集省一半，所以不原樣複製；再限縮字重只多省 2 KB，卻讓設計系統 `.t-readout` 用的 200 這種細字重失效，不值得。
- 留下的字型功能（`--layout-features` 要的是 kern、liga、ccmp、locl、mark、mkmk、calt、case、tnum、lnum，原檔有的才會留下）：Google Sans Flex 留下 kern、liga、calt、locl、tnum、lnum；JetBrains Mono 原檔本來就沒有 kern 與 liga，留下 calt、case、ccmp、locl。兩個檔都保留版權與授權說明（OFL 要求每一份附著）。

怎麼驗過（2026-10-02，這台 mac 的 Chromium，Playwright；下面的量測是在字型加入字串表的字之前做的；加進來的只有 `«` `»` `¦` `⁅` `⁆` 五個標記字元的字形，頁面上不會用到）：

- **字形**：瘦身後的字形跟原檔在同一組 opsz、字重下的輪廓相同。比對 3,120 組（opsz 8、14、18、32、48、64 各 5 個字重 × 104 個字形），最大差 2.67 個字型單位（字型是 2000 單位寬，約 0.13% 個字寬）。JetBrains Mono 535 組完全相同。
- **整頁對照**：把設計稿頁面（`design/homepage/{en,zh,ja}/index.html`）載入的 `clipper/css/fonts.css` 換成這個網站的 `fonts.css`、字型換成 `public/fonts/` 的檔，跟原本載入設計系統字型的同一頁比；視窗寬 1440 與 390 各量一次，兩邊的頁面都沒有載入失敗。

| 頁面 | 寬 | 首屏大標（`.hero__title .clamp` 的寬，px） | `.hero__sub`（高 px／行數） | 導覽列文字寬 px | 整頁高 px |
|---|---|---|---|---|---|
| en | 1440 | 773.1 → 773.3 | 102.4／4 → 102.4／4 | 468.9 → 468.9 | 16824 → 16824 |
| zh | 1440 | 576.1 → 576.1 | 84／3 → 84／3 | 412 → 412 | 16503 → 16503 |
| ja | 1440 | 896.1 → 896.1 | 84／3 → 84／3 | 466 → 466 | 16944 → 16944 |
| en | 390 | 358 → 358 | 102.4／4 → 102.4／4 | （手機版收進選單） | 28374 → 28374 |
| zh | 390 | 288.9 → 288.9 | 84／3 → 84／3 | （手機版收進選單） | 27510 → 27510 |
| ja | 390 | 307.5 → 307.5 | 84／3 → 84／3 | （手機版收進選單） | 28744 → 28744 |

每格是「原本 → 換成這個網站的字型」。唯一不同的是英文大標寬 0.2 px（瘦身時字寬四捨五入成整數的誤差），行數、高度、整頁高度都一樣。同樣的量法拿 opsz 固定成 18 的版本量，就會看到上面說的差異（英文大標 773.1 → 800.3、`.hero__sub` 4 行 → 3 行、導覽 468.9 → 454.8、整頁 16824 → 16765），所以這個量法抓得到問題。

`fonts.css` 剛好兩個 `@font-face`，`font-display: swap`，`unicode-range` 是各自字型檔的 cmap。前端用 `<link rel="stylesheet" href="/fonts/fonts.css">` 引入，網址是從網站根目錄算的（`/fonts/…`），內文字型值得用 `<link rel="preload" as="font" type="font/woff2" crossorigin>` 預載。

**產出為什麼進 git：** 部署時 Cloudflare 只裝套件、跑 `npm run build:pages`，不需要 python。字型是在你自己的電腦上瘦好、連同 `fonts.css` 與授權檔一起提交的。

**什麼時候要重跑 `npm run fonts`：** 在 `content/` 或文案裡寫了字型裡還沒有的新字（`npm run fonts:budget` 會告訴你）、或換了字型來源。缺的是字母或數字，`fonts:budget` 失敗（結束碼 1）；缺的是符號或標點（例如 ☰ ✕ ↺ ─ ├ ✓），只警告，那個字會用系統字型顯示，不會壞，目前文案（`copy.md` 與 `content/`）裡有 6 個這樣的符號（`↺ ─ ├ ☰ ✓ ✕`），加上字串表的標記，缺字警告現在共 11 個（見下一段）。重跑只會動這次產的兩個字型與 `fonts.css`，以及原本的 `fonts.css` 引用過、這次不用的舊字型；`--out` 裡別的 `.woff2` 不會被刪。

**字串表的字也要收進來：** `fonts` 與 `fonts:budget` 的 `--text` 除了 `copy.md` 與 `content/` 底下的檔，還要加上 `strings/zh.json`、`strings/en.json`、`strings/ja.json`（一個檔一個 `--text`，兩邊給的要一樣；下面「怎麼跑」的指令都已經寫進去）。這三個檔是帶標記的（見 `strings/README.md` 與下面的「字串表」一節），標記字元 `«»¦⁅⁆⟦⟧⟨⟩↵` 只是版面標記，**不會顯示在頁面上**，但 `--text` 是整份收字，這些字元也被當成文字：字型裡有的（`«` `»` `¦` 兩個字型都有，`⁅` `⁆` 只有 JetBrains Mono 有）會白白多留幾個字形（兩個字型合計多了 1,784 位元組，92,168 → 93,952，預算 150 KB 用掉 61%），沒有的（`⟦` `⟧` `⟨` `⟩` `↵`）出現在缺字警告裡。**這只是警告，結束碼還是 0（量過）：看到警告裡這五個標記字元，不用理它。**目前缺字警告共 11 個符號：標記 5 個（`↵ ⟦ ⟧ ⟨ ⟩`）加上文案與內容裡真的會顯示的 6 個（`↺ ─ ├ ☰ ✓ ✕`）；文案或字串表改了，這個數字會跟著變，以 `npm run fonts:budget` 印出來的為準。

**一次性設定（要有 python 3，裝 fontTools 與 brotli）：** 建一個專用的 venv，裝完用環境變數 `PYTHON` 指過去。

```
python3 -m venv ~/collector-fonts-venv
~/collector-fonts-venv/bin/pip install fonttools brotli
```

Windows cmd（`PYTHON` 要指到 `python.exe`；`%USERPROFILE%` 只有 cmd 認得，PowerShell 要用下一段的 `$env:USERPROFILE`）：

```
py -m venv %USERPROFILE%\collector-fonts-venv
%USERPROFILE%\collector-fonts-venv\Scripts\pip install fonttools brotli
```

Windows PowerShell：

```
py -m venv $env:USERPROFILE\collector-fonts-venv
& "$env:USERPROFILE\collector-fonts-venv\Scripts\python.exe" -m pip install fonttools brotli
```

**怎麼跑（在 GPTPlugins 的 `homepage/site/` 裡）。** `--from` 是放著 `GoogleSansFlex-lite-latin.woff2` 與 `JetBrainsMono-latin.woff2` 的資料夾，這裡用擴充的 `clipper/fonts`；一個 `--text` 只給一個檔，所以 `content/` 底下的檔要一個一個寫。下面的 `<GPTPlugins>` 換成你的 GPTPlugins 資料夾路徑。

bash 或 zsh（用迴圈收 `content/` 底下的檔）：

```
args=(); for f in content/*.md; do args+=(--text "$f"); done
PYTHON=~/collector-fonts-venv/bin/python npm run fonts -- --from <GPTPlugins>/clipper/fonts --text <GPTPlugins>/design/homepage/copy.md "${args[@]}" --text strings/zh.json --text strings/en.json --text strings/ja.json
npm run fonts:budget -- --text <GPTPlugins>/design/homepage/copy.md "${args[@]}" --text strings/zh.json --text strings/en.json --text strings/ja.json
```

Windows PowerShell（用 `Get-ChildItem` 收，`@texts` 會展開成好幾個參數；直接叫 `node scripts/….mjs`，不走 `npm run`，原因在這一節最後）：

```
$env:PYTHON = "$env:USERPROFILE\collector-fonts-venv\Scripts\python.exe"
$texts = Get-ChildItem content\*.md | ForEach-Object { '--text'; $_.FullName }
node scripts/fonts.mjs --from <GPTPlugins>\clipper\fonts --text <GPTPlugins>\design\homepage\copy.md @texts --text strings\zh.json --text strings\en.json --text strings\ja.json
node scripts/fonts-budget.mjs --text <GPTPlugins>\design\homepage\copy.md @texts --text strings\zh.json --text strings\en.json --text strings\ja.json
```

Windows cmd（沒有好用的迴圈可以收成一串參數，直接把每個檔寫出來；`content\` 底下多了或少了檔，這串要跟著改）：

```
set "PYTHON=%USERPROFILE%\collector-fonts-venv\Scripts\python.exe"
npm run fonts -- --from <GPTPlugins>\clipper\fonts --text <GPTPlugins>\design\homepage\copy.md --text content\changelog.en.md --text content\changelog.ja.md --text content\changelog.zh.md --text content\links.md --text content\news.en.md --text content\news.ja.md --text content\news.zh.md --text strings\zh.json --text strings\en.json --text strings\ja.json
npm run fonts:budget -- --text <GPTPlugins>\design\homepage\copy.md --text content\changelog.en.md --text content\changelog.ja.md --text content\changelog.zh.md --text content\links.md --text content\news.en.md --text content\news.ja.md --text content\news.zh.md --text strings\zh.json --text strings\en.json --text strings\ja.json
```

Windows 這兩段 PowerShell 與 cmd 的寫法這台 mac 沒有實際跑過（mac 上只驗過 bash／zsh 那一段）；命令本身要的是路徑，不是 shell，所以 Windows 上出問題，先看是不是路徑或引號的寫法。**PowerShell 為什麼不寫 `npm run fonts -- …`：** PowerShell 可能把 `--` 吃掉（沒實機驗），npm 就會把後面的 `--from` 當成自己的參數、不交給命令；直接叫 `node scripts/fonts.mjs …` 就沒有這個問題（用 `npm.cmd run fonts -- …` 也許可以，沒驗）。cmd 照 `npm run … -- …` 寫沒有這個問題。下面「圖片」與「字串表」兩節的 PowerShell 一樣這樣寫。重跑的輸出位元組相同（沒有路徑、沒有時間），換版本的 fontTools 才可能不同；跑完用 `git status` 看哪些檔變了、一起提交。

**授權：** 兩套都是 SIL Open Font License 1.1，都沒有宣告保留字型名稱，所以瘦身檔（修改版）可以沿用原名；原文、網址、查核過程在 `public/fonts/LICENSES.md`，授權原文放在 `public/fonts/licenses/`，公開 repo 可以放。

## 圖片

`npm run images` 把素材資料夾裡的 PNG、JPEG 轉成 WebP，放進 `public/images/`，並寫一份 `images.json`（每張原圖的寬高，與每個輸出檔的檔名、寬高、位元組，給前端寫 `width`、`height` 與 `srcset`）。**無損或有損照副檔名判斷：`.png` 用無損、`.jpg` 與 `.jpeg` 用有損。** 介面截圖是 PNG，字的邊緣與暗色漸層用有損會有雜訊與色階斷層；照片是 JPEG，來源本來就是有損的，轉無損反而變大。

每張出兩個寬度：640 與 1280（設定檔可以替某幾張圖指定裁切與別的寬度，見下面），原圖不夠寬就出原寬、不放大（1920 寬出 640、1280；800 寬出 640、800）；檔名是「來源檔名去掉副檔名-寬度.webp」，所以來源檔名最好用英文、數字與 `-`，有空白或中文的檔名放進網址要編碼。`mark.svg` 這類向量圖不轉。一張壞了（讀不了、不是圖）只壞那一張：其餘照做，最後在 stderr 列出壞的與原因，結束碼 1。重跑時只會刪檔名是「名字-寬度.webp」的舊輸出，`--out` 裡別的檔（包括別的 `.webp`）不會被刪。

量過的數字（2026-10-02，這台 mac，cwebp 1.6.0；`design/homepage/assets` 的 16 張圖，原檔合計 4.40 MB，轉完 32 個 .webp 合計 1.92 MB，另有 `images.json` 5.6 KB）：

| 做法 | 量到的 | 選了嗎 |
|---|---|---|
| PNG，無損 `-z 9` | 1920 寬的預覽圖縮成 640：19.9～22.2 KB（原 PNG 約 340 KB）；1280：69～75 KB；ai-outline 的 1280 是 151～167 KB | 選 |
| PNG，無損 `-z 6`（預設） | 同樣的圖大 0%～80%（例如預覽圖 640 是 36 KB、`-z 9` 是 20 KB），但快約 8 倍 | 沒選：只在新圖進來時跑一次，慢一點不要緊，小才是目標 |
| PNG，有損 q90 | 是無損的 1/4～2/3（ai-outline 640：22 KB 對 51 KB） | 沒選：字的邊緣與暗色漸層會出現雜訊與色階斷層（4-b3 的預覽圖也試過，一樣） |
| JPEG（作者照片），有損 q85 | 640：10.8 KB，1280：25.8 KB（原檔 89 KB）；PSNR 46.8 dB（45 dB 以上肉眼分不出差別） | 選 |
| JPEG，無損 | 640：117.5 KB，1280：290 KB，是原檔的 3.3 倍 | 沒選 |

重跑不重算：輸出已經在、修改時間不比來源舊、寬高對得上就沿用；來源換了才重算那一張，來源拿掉的它的 `.webp` 與 `images.json` 那一筆也拿掉。改了轉檔設定之後想整批重做，就刪掉 `public/images/` 裡的 `.webp` 再跑。整批第一次約 30 秒（`-z 9` 慢，加了多執行緒 `-mt`，輸出的位元組跟不加相同）。轉出來的圖不帶中繼資料（色彩描述檔也不帶），來源要是 sRGB（現在的 16 張都是）。

三件前端要知道的事：

- **800 寬的步驟截圖，640 版比 800 版還大。** 縮小之後文字的邊緣不再是整齊的像素，無損壓不動：`step1-setup-*` 的 640 版是 800 版的 1.3～1.5 倍，`step2-saved-*` 是 1.06～1.16 倍。用 `srcset` 的話，這兩組圖直接用 800 那張就好，不要放 640。
- **這兩組 640 版比原 PNG 小的比例，達不到「縮成 640 要比原圖小 50% 以上」。** `step1-setup-*` 小 52.5～54.7%，`step2-saved-*` 只小 46.4～48.0%。這條 50% 的規則（測試量的是 1920、2000、1280 寬的圖）維持不變：800 寬的原圖本來就是整齊的介面像素，已經很小，縮小反而讓無損更難壓；其他 1920 寬的圖縮成 640 都小 90% 以上。
- **`hero-poster-*` 跟 `public/media/hero-poster-*.webp` 是同一張圖**（2026-10-04 換成粒子版：直接用 cwebp 從 `release/demo-dust-poster-<語言>.png`——`public/media/` 那張的原檔——轉，跟 `npm run images` 同樣的參數 `-mt -lossless -z 9 -resize 640 360`／`-resize 1280 720`；`images.json` 那三筆寬高不變〔原圖 1920×1080，640×360、1280×720〕，只更新位元組）（那邊是 1920 寬、每張約 105 KB）。這裡多了 640（約 20 KB）與 1280（約 69 KB）兩種尺寸，手機首屏可以用小的；要用哪邊，前端決定。

**裁切與寬度設定：`scripts/images.config.json`。** 網頁只顯示一張圖的一塊（再放大）時，瀏覽器卻要下載整張圖，看不到的部分也在裡面。所以可以替某幾張圖指定**裁切**：先裁出看得到的那一塊，再縮成幾個寬度。設定檔是一個物件，鍵是來源檔名（含副檔名），值是 `{ crop, widths }`（兩個都可以省）：

```
{
  "ai-outline-zh.png": { "crop": { "x": 297, "y": 140, "width": 1017, "height": 566 }, "widths": [640, 1280, 1920] }
}
```

- **`crop`** 是裁切框，**以原圖像素算**：`x`、`y` 是框的左上角，`width`、`height` 是框的寬高，都是整數，`x`、`y` 不能是負的，寬高要大於 0，整個框不能超出原圖。裁完之後，圖的長寬比就是 `crop.width : crop.height`。
- **`widths`** 是想要的輸出寬度；**每個跟「框寬（沒有 `crop` 就是原圖寬）」取小的，不放大、不重複**。框寬 1017、`widths` 寫 `[640, 1280, 1920]`，出來是 640 與 1017 兩張，不會硬放大到 1280、1920；框寬 1960 的圖才會出 640、1280、1920 三張。要更清楚，得用更高解析度的素材。沒寫 `widths` 就是 640、1280。高照框的比例四捨五入。沒寫的圖照舊（不裁切，640、1280）。
- **輸出的檔名**照舊（`<來源檔名去掉副檔名>-<寬>.webp`，例如 `ai-outline-zh-1017.webp`）。`images.json` 有裁切的那一筆是 `{ width, height, crop, sizes }`：`width`、`height` 還是**原圖**的，`crop` 照設定檔，每個尺寸的寬高在 `sizes`；沒裁切的圖格式不變，沒有 `crop`。
- 現在的設定：07 的三語大綱圖和 05 第 3 張的三語終端機截圖。**框的數字只在這個設定檔裡**，程式裡沒有。
- **框怎麼算（不要照設計稿 CSS 變數上寫的數字抄）：** 框是「所有寬度、所有版面（手機、桌機，有滑鼠與只有手指）實際露出的矩形」的聯集，往外取整，再四邊各加 2 個原圖像素。CSS 變數寫的框只是起點：版面有小數像素，實際露出的矩形會比 CSS 寫的框多出一點點（最多約 1.5 原圖像素）。照 CSS 的數字抄（大綱圖 300、143、1010、560 那組），邊緣就會露出被裁掉的一條，這個問題已經修過一次，不要帶回來。
- **設計稿的裁切或版面改了，框要重量：** 用 `tests/fixtures/images-crop/measure-visible.mjs`（檔頭有用法，要 Playwright，`SITE_PLAYWRIGHT` 指到它的資料夾）量各寬度實際露出的矩形，算出新的框，改 `images.config.json`，再重跑 `npm run images`。量的時候**只能捲整頁**（`window.scrollTo`），再把圖往上每一層的 `scrollTop`、`scrollLeft` 歸零；不要用 `scrollIntoView`：它會連 `overflow: hidden` 的框一起捲，量到的是使用者看不到的位置。
- **設定寫錯，在碰任何圖之前就停**（結束碼 1，`public/images/` 一個位元組都不動），並講出是哪張圖：設定檔不是 JSON、框缺欄位或不是整數、框超出原圖、`widths` 是空的或有不是正整數的。用 `--config <設定檔>` 指定了別的設定檔時，裡面有、`--from` 裡沒有的圖也算錯；用預設的設定檔時，這種圖只在 stderr 印一行「警告」、照常轉（所以拿別的素材資料夾跑也不會失敗）。`--config=` 給空字串是用法錯誤（結束碼 2）。
- **什麼時候要重跑：** 換了素材圖、改了 `images.config.json`（框、`widths`）、設計稿改了裁切或版面（框要重量，見上一條）。框只換了位置、寬高沒變也會重算（命令會看上次寫的 `images.json` 裡的框），不會把舊檔留著。重跑後把 `public/images/` 一起提交。前端的 `srcset`、`sizes` 與裁切的 CSS 要照裁過的圖寫（長寬比是 `crop.width : crop.height`）。

在 GPTPlugins 的 `homepage/site/` 裡跑（需要 cwebp：mac 用 `brew install webp`，Windows 去 Google 的 libwebp 下載頁拿 `cwebp.exe`；`CWEBP` 沒設就用 PATH 裡的 `cwebp`）。下面的 `<GPTPlugins>` 換成你的 GPTPlugins 資料夾路徑。

bash 或 zsh：

```
CWEBP=/opt/homebrew/bin/cwebp npm run images -- --from <GPTPlugins>/design/homepage/assets
```

Windows PowerShell（直接叫 `node scripts/images.mjs`，不走 `npm run`，原因見上面「字型」那一節最後）：

```
$env:CWEBP = "C:\path\to\cwebp.exe"
node scripts/images.mjs --from <GPTPlugins>\design\homepage\assets
```

Windows cmd（`CWEBP` 要指到 `.exe`，指到 `.cmd` 或 `.bat` 在 Node 20.12 之後不開 shell 會是 EINVAL）：

```
set "CWEBP=C:\path\to\cwebp.exe"
npm run images -- --from <GPTPlugins>\design\homepage\assets
```

跟字型一樣，產出（`public/images/`）進 git，部署時 Cloudflare 不需要 cwebp。新增或換了素材圖，就重跑這一行、把 `public/images/` 一起提交。Windows 的兩段這台 mac 沒有實際跑過。

## 分享卡：`og`

把網址貼到 Facebook、Threads、LINE、X 時跳出來的預覽圖，一個語言一張：`public/og/og-zh.png`、`og-en.png`、`og-ja.png`，1200×630、各約 140～160 KB。**「/」（分流頁）不另做圖，`og:image` 用 `og-en.png`**（規格書第 10.6 節）。三張 PNG 進 git：部署時不產圖（產圖要瀏覽器與這台 mac 的環境）。

**怎麼產**（在 `homepage/site/`）：

```
SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm run og -- --root <專案根目錄> [--out <資料夾>] [--check]
```

- `--root` 是專案根目錄（GPTPlugins），不是 og 資料夾：設計師的版面在 `<根目錄>/design/homepage/og/{zh,en,ja}/index.html`，稿裡的 CSS 是從根目錄往上四層連的，所以程式從根目錄開本機伺服器再拍（不能用 `file://` 開）。
- `--out` 預設 `public/og`，不存在會建；只新增或改寫那三張，裡面別的檔不動。Playwright 照舊不進 `package.json`（用法同上一節，`--playwright` 或 `SITE_PLAYWRIGHT`）。
- **拍之前每一張都要過關**：沒有 console 錯誤、頁面例外與載不到的檔；字型都載到；字沒有撐破版面（`scrollWidth` ≤ 1200、`scrollHeight` ≤ 630，哪一邊超出會講）；畫字用到的字型都在那個元素 `font-family` 寫的家族裡（指定的字型這台沒有、掉到回退字型會失敗）；每張 ≤ 300 KB。**任何一張沒過，三張都不寫**（舊的圖留著，不產半套）。每一張會印一行「`og-<語言> 字型：…`」，是實際畫字用到的字型。
- **`--check`**：照樣開瀏覽器拍、照樣檢查，但不寫檔；拍出來的跟 `--out` 裡的三張逐位元組比，都相同結束碼 0，有不同或不在是 1（講是哪幾張）。

**什麼時候要重產：** 設計稿、字串表裡的名稱／大標／一行（`nav.brand`、`hero.title`、`og.card.line`）或記號改了。**換了 Chromium 版本、系統字型，或換一台電腦，輸出就會不同**（同一台機器、同一份來源跑兩次是逐位元組相同的）；這時 `--check` 會紅，不是壞了，重跑 `npm run og` 再提交。一律在 mac 上產：Windows 與 Linux 沒有指定的中日文字型，命令會失敗。平台會記住舊圖，圖換了想讓它重抓，要換檔名（例如 `og-zh-2.png`）或到 Facebook 的分享偵錯工具重抓。

**字型與來源：**

| 語言 | 字型家族（`design/homepage/og.css` 寫死） | 這台實際畫字 |
|---|---|---|
| 中 | Google Sans Flex、Noto Sans TC | Google Sans Flex、Noto Sans TC |
| 英 | Google Sans Flex | Google Sans Flex |
| 日 | Google Sans Flex、Noto Sans JP | Google Sans Flex、Noto Sans JP |

- 拉丁字載的是 `clipper/fonts/GoogleSansFlex-lite-latin.woff2`（擴充那份，設計稿連的 `clipper/css/fonts.css` 指向它）。設計稿的說明（`notes/4-4.md`）寫「網站同一份」，其實不是同一個檔（網站的是 `public/fonts/GoogleSansFlex-site.woff2`，照字串表瘦身過），**但字形相同**，所以拍出來的圖沒有差別。
- 中文是 Noto Sans TC、日文是 Noto Sans JP：設計稿旁邊的 `design/homepage/assets/fonts/noto-sans-{tc,jp}-og.woff`，只切了分享卡用到的字（保留字重軸；字型檔內的名稱改成 `Noto Sans TC`／`Noto Sans JP`，不然 Chrome 回報的是可變字型預設那一格的「Thin」）。**分享卡的字改了要重切**，切法寫在 `design/homepage/og.css` 開頭的註解；沒重切的話新字掉到回退字型，命令會失敗。

**授權：**

- **Google Sans Flex：** 網頁字型版在 `public/fonts/LICENSES.md` 已核對是 OFL 1.1（檢查員拿官方原文逐位元組核對過；官方 README 寫「SIL Open Font License, without Reserved Font Names」）。OFL 官方 FAQ 說明：用字型畫成圖片，圖不受字型授權限制。
- **Noto Sans TC、Noto Sans JP：** SIL OFL 1.1（Google Fonts 的 google/fonts repo，`ofl/notosanstc`、`ofl/notosansjp` 的 OFL.txt）。2026-10-05 使用者決定從 PingFang TC／Hiragino Sans（Apple 系統字型，畫進公開圖片合不合授權沒查證）換過來。

## 字串表

首頁的字（三種語言）寫在設計稿的字串表裡，每一條字帶斷行標記：哪裡可以換行、哪幾個字不拆開、哪半句夾螢光綠括號。`strings/` 放的是網站用的那一份：`zh.json`、`en.json`、`ja.json`（id → 字串）與 `README.md`（標記的說明）。**這四個檔是 `npm run strings` 從設計稿複製進來的，不要手改**；要改字或斷行，改設計稿那邊、重新產生字串表，再重跑這個命令，把 `strings/` 一起提交。

`npm run strings` 做的事：

- `--from` 是設計稿的字串表資料夾（要有 `zh.json`、`en.json`、`ja.json` 與 `README.md`），沒有預設值：它在網站的 repo 外面。`--copy` 是文案表 `copy.md`，可以不給。`--out` 預設是 `strings/`。
- 先檢查：三個 JSON 都是 id → 字串的物件；每一條字的標記都轉得過（寫錯會講出是哪個語言、哪個 id、第幾個字）；三種語言的 id 完全相同；有給 `--copy` 的話，文案表（`copy.md` 裡表頭是 `| id | zh | en | ja | 來源 | 確認 |` 的那張，版本表與字數表不算）的每個 id 都在字串表裡。
- 一次列出所有問題，每個問題一行，結束碼 1，`--out` 一個位元組都不動（連 `--out` 裡同名的是資料夾，也是寫任何檔之前就發現）。例：

```
strings.mjs 失敗：字串表有 2 個問題要修（<網站>/strings 沒有動）：
  ja.json 的 privacy.lead：第 1 字「«」沒有關起來（少了配對的「»」）
  en.json 缺 privacy.lead（zh.json、ja.json 有）
```

- 全部沒問題才寫：四個檔原樣複製（位元組相同，不重新排版），`--out` 裡別的檔不動，重跑的結果相同。結束碼 0 成功、1 輸入或驗證不過、2 用法錯誤（沒給 `--from`、不認得的參數、路徑是空的、`--from` 不是資料夾）。
- 不比對字的內容：拿掉標記之後跟 `copy.md` 一字不差，是設計稿產生字串表時核對的，這個命令只比 id。

為什麼把 `README.md` 也複製進來：標記的意思（每個符號轉成什麼、巢狀規則、轉換順序）寫在這份說明裡。放進網站的 repo，資料與說明就是同一版，搬進公開 repo 之後也不必去 repo 外面找；設計稿那邊改了標記的定義，重跑一次就跟著更新。注意它是原樣的複本，裡面寫的 `design/homepage/…` 路徑指的是 GPTPlugins 的設計稿資料夾，在網站的 repo 裡沒有。

跟 `chapters`、`media` 一樣，這個命令讀的是 repo 外面的設計稿，要**留在 GPTPlugins 跑**（在 GPTPlugins 的 `homepage/site/` 裡）。下面的 `<GPTPlugins>` 換成你的 GPTPlugins 資料夾路徑；不需要 python 或 cwebp。

bash 或 zsh：

```
npm run strings -- --from <GPTPlugins>/design/homepage/strings --copy <GPTPlugins>/design/homepage/copy.md
```

Windows PowerShell（直接叫 `node scripts/strings.mjs`，原因見「字型」那一節最後）：

```
node scripts/strings.mjs --from <GPTPlugins>\design\homepage\strings --copy <GPTPlugins>\design\homepage\copy.md
```

Windows cmd：

```
npm run strings -- --from <GPTPlugins>\design\homepage\strings --copy <GPTPlugins>\design\homepage\copy.md
```

Windows 的兩段這台 mac 沒有實際跑過。字串表改了，字型要跟著重跑（`strings/` 裡的字也要收進字型，見「字型」那一節）。

**元件怎麼用 `parseSegments`**（`lib/segments.js`）：它把字串表裡的一條字轉成元素樹，不產 HTML 字串，也就不需要 `dangerouslySetInnerHTML`。它沒有任何 import、不碰檔案，所以瀏覽器裡的元件與產生網頁時的 Node 都能直接用。

```js
import { createElement } from 'react';
import { parseSegments } from '../lib/segments.js';

// 元素樹 → React 元素：節點是字串，或 { type, props, children }
function toElements(nodes) {
    return nodes.map((node, i) => (typeof node === 'string'
        ? node
        : createElement(node.type, { ...node.props, key: i }, ...toElements(node.children))));
}

toElements(parseSegments(strings.zh['hero.title']));
toElements(parseSegments(strings.zh['features.more'], { nn: '05' })); // 代入值
```

- 回傳的是陣列。節點是非空字串（原字），或剛好 `type`、`props`、`children` 三欄的物件：`type` 只有 `span` 與 `wbr`，`props` 用 React 的屬性名，`className` 是設計稿 CSS 裡的 class（`u`、`nw`、`clamp`、`nw-wide`、`brk-narrow`、`brk brk--l`、`brk brk--r`、`forai__l1`、`forai__l2`）。相鄰的字併成一段，沒有空字串的節點，空字串回 `[]`。
- **字串節點沒有跳脫：不要拼成 HTML、不要放進 `dangerouslySetInnerHTML`；用 React 元素樹放，React 會跳脫。** 使用者自己寫的內容（公告、更新紀錄，`lib/bind-tail.js` 的輸出）走的是另一條路，兩種做法不要混用。
- 代入值是字裡的 `%url%`、`%nn%`、`%章名%`（大小寫要對），第二個參數給 `{ url, nn, 章名 }`。沒給第二個參數：原樣留在字裡。給了：字裡用到的每一個都要有字串值，缺了就丟 Error；最後才換，所以值裡的標記字元、HTML、`%…%` 都只是普通的字，值是空字串就不留節點。
- 標記寫錯丟 `Error`（`err.index` 是出錯的字在字串裡的位置，訊息寫「第 N 字」）；`text` 不是字串、`values` 不是物件、代入值不是字串丟 `TypeError`。
- 它只做 `strings/README.md`「標記」那張表。說明裡另外寫的由元件照 id 處理，不在這裡：`hero.mobile.text` 開頭那一段包 `<b>`、幾句結尾的箭頭圖示、章名與摘要（從教學章節資料轉進來的字）、使用者自己寫的公告與更新紀錄的防孤字。

## 「AI 開始打字」的資料：`agent-data`

教學片裡那一段 AI 的對話：問題（`prompt`）、AI 一步一步呼叫的工具（`steps`）、它整理出來的大綱（`outline`）、最後的回覆（`reply`）和一句說明（`say`）。首頁第 07 區的「AI 開始打字」**只用 `outline` 的一段節錄**（靜態大綱圖上那幾行，`app/[lang]/typing.json/route.js` 取，見上面「07 為 AI 做的」）；其他欄位照樣轉出來，網站目前沒用到。這些字在教學片的資料夾裡，三種語言各一支：`tutorial/agent-{zh,en,ja}.js`。`npm run agent-data` 把它們轉成網站用的 `data/agent.{zh,en,ja}.json`。

- **怎麼跑**（在 GPTPlugins 的 `homepage/site/` 裡；跟 `chapters`、`media`、`strings` 一樣，讀的是 repo 外面的檔，要留在 GPTPlugins 跑）。下面的 `<GPTPlugins>` 換成你的 GPTPlugins 資料夾路徑；不需要 python 或 cwebp。`--from` 是教學片的資料夾，沒有預設值；`--out` 預設是 `data/`，不存在會自己建。
- **什麼時候要重跑：教學片重算過、或 `agent-*.js` 改了，就要重跑**，再把 `data/agent.*.json` 一起提交。

bash 或 zsh：

```
npm run agent-data -- --from <GPTPlugins>/tutorial
```

Windows PowerShell（直接叫 `node scripts/agent-data.mjs`，原因見「字型」那一節最後）：

```
node scripts/agent-data.mjs --from <GPTPlugins>\tutorial
```

Windows cmd：

```
npm run agent-data -- --from <GPTPlugins>\tutorial
```

Windows 的兩段這台 mac 沒有實際跑過。

- **輸出的格式。** 每個語言一個檔：`data/agent.zh.json`、`data/agent.en.json`、`data/agent.ja.json`，內容剛好是 `JSON.stringify({ model, prompt, steps, outline, reply, say }, null, 2)` 加一個換行（兩格縮排，欄位照這個順序）。`steps` 是 `[[工具, 參數], …]`，中文 11 步、英文與日文各 10 步。字一個都不改（換行、Tab、全形空白、emoji、引號、反斜線都原樣）。`--out` 裡別的檔（`chapters.*.json`）不動，重跑的結果相同。
- **先檢查、全部沒問題才寫。** 六個欄位都要有，多一個也算壞（當作教學片的來源改版了，要先看過再收）；字串不能是空的；`steps` 是非空陣列，每一步是兩個有字的字串。三個語言有任何一個不對，三個檔都不寫（`--out` 一個位元組都不動），並一次列出所有問題，每個問題一行，寫到來源檔名與原因。
- **結束碼。** 0 成功；1 來源有問題（缺檔、是資料夾、空的、欄位或步驟不對）、系統暫存資料夾寫不進去（命令先寫進那裡，再一次放進 `--out`）或放不進 `--out`；2 用法錯誤（沒給 `--from`、不認得的參數、路徑是空的、`--from` 不是資料夾）。
- **為什麼不執行來源。** `agent-*.js` 是瀏覽器的全域指派（開頭一段註解，接著 `window.AGENT = { … };`），表面上是一支 JavaScript。如果把它當程式跑，來源裡被塞進去的任何東西（寫檔、刪檔、無窮迴圈）都會在這台電腦上執行。所以這個命令只把它當資料讀：開頭只能有註解，接著 `window.AGENT =`，等號右邊用 `JSON.parse` 讀，後面只能有分號與註解；其他東西（函式呼叫、別的程式、不是 JSON 的寫法）一律當作壞掉、報錯，不會執行。行註解跟 JavaScript 一樣，遇到 `\n`、`\r`、U+2028、U+2029 就結束：這幾種換行後面的字在瀏覽器裡是程式，所以不會被當成註解收下；Windows 的 CRLF 行尾照常可以。來源再大（幾百萬行註解、幾千萬個分號）也是一個字一個字掃，不會撐爆。程式裡沒有 `eval`、`Function`、`node:vm`、動態 `import()`、`require`。

## 回退字型：`fallback-fonts` 與 `fallback-sweep`

網頁字型（Google Sans Flex）還沒下載好時，英數字先用電腦裡的 Arial 畫；字型換上來時，如果每一段字的行數變了，底下整頁都會被推動（版面跳一下，CLS）。**回退字型**就是讓 Arial 畫出來的字，寬度跟網頁字型一個字一個字對齊，字型換上來前後行數不變、字的位置幾乎不動。這個網站的回退字型是一個 CSS 檔（預設放在 `app/styles/fallback-fonts.css`），裡面有幾百個 `@font-face`；它不是手寫的，是 `npm run fallback-fonts` 量出來的。`npm run fallback-sweep` 是另一支：開瀏覽器，比字型載好與字型擋掉兩種樣子下每個區塊的高度，用來檢查、或挑微調的係數。

**要先準備：Playwright 與瀏覽器。** 量字寬要開 Chromium，用的是 Playwright。**Playwright 不裝進這個網站**（不在 `package.json` 裡）：用 `--playwright <資料夾>` 或環境變數 `SITE_PLAYWRIGHT` 指到 Playwright 套件的資料夾（例如別的專案 `node_modules` 裡的 `playwright`），程式再從那個路徑載入。兩個都沒給、或指到的資料夾不是 Playwright，會印一句「找不到 Playwright」並結束（結束碼 1）；瀏覽器沒裝好會印「瀏覽器開不起來」。

- **怎麼跑**（在 `homepage/site/` 裡）。`--fonts` 是網頁字型的資料夾（要有 `GoogleSansFlex-site.woff2` 與 `fonts.css`），預設 `public/fonts/`；`--config` 是設定檔，預設 `scripts/fallback-fonts.config.json`；`--out` 是輸出檔，預設 `app/styles/fallback-fonts.css`。**`--out` 的資料夾要已經存在**（不幫忙建）；網站還沒有 `app/` 的時候，預設的位置不存在，會印錯誤並結束，請改用 `--out` 指定輸出檔。
- **要收哪些字：** `fonts.css` 裡 `"Google Sans Flex"` 那個 `@font-face` 的 `unicode-range`（也就是網頁字型負責的字，它是 `npm run fonts` 從文案收出來的）。所以先跑 `npm run fonts`（字型與文案都處理好），再跑 `npm run fallback-fonts`。

bash 或 zsh：

```
SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm run fallback-fonts -- --out app/styles/fallback-fonts.css
```

Windows PowerShell（直接叫 `node scripts/fallback-fonts.mjs`，原因見「字型」那一節最後）：

```
$env:SITE_PLAYWRIGHT = "<Playwright 套件的資料夾>"
node scripts/fallback-fonts.mjs --out app\styles\fallback-fonts.css
```

Windows cmd：

```
set "SITE_PLAYWRIGHT=<Playwright 套件的資料夾>"
npm run fallback-fonts -- --out app\styles\fallback-fonts.css
```

Windows 的兩段這台 mac 沒有實際跑過。

- **什麼時候要重跑：**
  - 網頁**字型**換了（`GoogleSansFlex-site.woff2` 重切、換版本），要整份重新產生；
  - **字級**或**字重**新增（頁面用到新的字級×字重，在設定檔的 `roles` 加一組，再重跑；手改輸出檔的數字會讓某些寬度開始跳）；
  - 頁面**文案**大改（`fonts.css` 的字變了，`npm run fonts` 重跑之後這裡也要重跑；文案的行數變了，微調係數也可能要重掃，見下面）；
  - **換機器**（見下一條）。
  重跑後把輸出檔一起提交。
- **機器相依：** 量的是這台機器裝的 Arial（mac、Windows 的 Arial 版本不同，Linux 通常沒有 Arial、用同寬的 Liberation Sans）。**同一台機器重跑，輸出位元組相同；不同機器（Arial 版本、作業系統不同）不保證位元組相同**，差多少沒量過（未量）。所以換機器產生之後，要在那一台重新掃一次係數（下面的 `fallback-sweep`）。Android 通常沒有 Arial，`local()` 抓不到，回退字型對不準，那裡字型換上來時還是可能跳。
- **設定檔 `scripts/fallback-fonts.config.json`：** `{ roles, factors }`。`roles` 是字級×字重，每筆 `{ suffix, size, opsz, weights }`：`suffix` 接在 `"Google Sans Flex Fallback"` 後面成為 font-family 名字（`""` 是給繼承 body 的字、光學尺寸固定 18；` 14`、` 16`…是各字級）；`size` 是字級 px；`opsz` 是光學尺寸，數字就固定、`"auto"` 就跟字級走；`weights` 是 400、500、600 的陣列（對應 `100 449`、`450 599`、`600 900`，600 用 Arial Bold）。`factors` 是微調組，每筆 `{ family, from, weight, k, spaceK? }`：把 `from` 那一組（字重範圍 `weight`）整組的 `size-adjust` 乘上 `k`（空白那一行再乘 `spaceK`），換成新的 font-family `family`。
- **輸出的格式：** 檔頭一段說明怎麼產生的註解（沒有日期與路徑，所以重跑才會位元組相同）；基本組照 `roles` 的順序、每組照列的字重，每個 `@font-face` 一行；再接微調組照 `factors` 的順序。每個字重複 40 次、關掉字距調整，量網頁字型與 Arial 的寬度比；一組裡寬度比相近（最寬最窄差 2% 以內）的字收成一個 `@font-face`；`size-adjust` 一位小數，`ascent-override`／`descent-override` 是 96.6%／28.6% 除以 `size-adjust`（兩位小數），`line-gap-override` 是 0%；空白自己一個 `@font-face`、排最後。
- **`size-adjust` 夾在 85%～120%。** 它放大縮小的是整個字形，不只字寬：照字寬對的話，Arial 的「1」要縮到 66%、「[」「]」要放大到 147%，回退的那一下這幾個字會明顯比旁邊大或小。所以超出的字一律夾到 85% 或 120%，代價是這幾個字在回退時略寬或略窄。空白看不見，不夾。
- **靜態檢查：** 產生之後，命令自己檢查：除了空白，每個 `size-adjust` 都要在 85%～120%；微調組是基本組整組乘上 `k`，所以容許範圍是 `[85×k, 120×k]`（四捨五入到 0.01，兩邊各放寬 0.01）；不認得的 font-family 也算錯。沒過就不寫輸出檔。
- **結束碼：** 0 成功；1 做不完（設定檔不在或不是 JSON、`roles` 是空的、字型資料夾缺檔、`--out` 的資料夾不在、找不到 Playwright、瀏覽器開不起來、靜態檢查沒過）；2 用法錯誤（不認得的參數、缺值、路徑是空的、`--fonts` 不是資料夾）。任何失敗，輸出檔一個位元組都不動（成功才換上），問題第一行是中文。

**`fallback-sweep`：檢查與掃係數。** 網站先產生好（Next.js 的 `out/`），再：

```
SITE_PLAYWRIGHT=<Playwright 套件的資料夾> npm run fallback-sweep -- --site out
```

- 在本機開一個靜態伺服器送 `--site`；每個「語言 × 寬度」（`--langs` 預設 `zh,en,ja`，`--widths` 預設 280、320、360、375、390、414、430、640、768、1024、1280、1440）開兩次頁面：一次正常載入、一次把 `*.woff2` 擋掉（只剩回退字型），量每個看得到的 `[data-id]` 區塊的高度（四捨五入）。
- **檢查**（沒給 `--scan`）：每一組一行，`一致 en 360px` 或 `不一致 en 360px：<id>、<id>`（列出高度不同的區塊），最後一行 `共 N 組：一致 A、不一致 B`。有不一致結束碼 1，全部一致 0。高度不同通常是行數變了，換字型時它下面的東西會被推動。
- **掃係數**：給 `--css <回退字型 CSS>`、`--scan "<font-family>|<字重範圍>"`（例如 `"Google Sans Flex Fallback 16|100 449"`）、`--k <起:迄:間隔>`（例如 `0.98:1.02:0.01`），三個要一起給。程式把那一組整組乘上每一個係數、注入擋掉字型的那一頁，每個係數一行 `k=1.0264 不一致 N 組`，有不一致時接 `：<語言> <寬度>px <id>、…；…`。挑「不一致 0 組」的係數，寫進設定檔的 `factors` 再重跑 `fallback-fonts`。掃描的結束碼是 0。
- 這一支只量 `[data-id]` 區塊的高度：行數不變、字只是左右移動的那種不量；也不分「只有手指」與「有滑鼠」的裝置。要真的量版面跳動（CLS）的話，用網站自己的版面測試。
- **看不到公告條**：公告條是 `bulletin.js` 在瀏覽器裡畫的，沒有 `data-id`，這一支量不到它。公告條標題的微調係數（`bulletin en`、`bulletin zh` 那幾組）要用網站的版面抖動測試（`tests-site` 的 F1.5、F4.6）量，不能用這支掃描重掃；換了公告也一樣要用那邊重新量。
- 結束碼：1 也包括 `--css` 讀不到、找不到 Playwright、瀏覽器開不起來；2 是用法錯誤（沒給 `--site`、`--site` 不是資料夾、`--widths` 不是正整數、`--langs` 不是 zh／en／ja、`--scan` 少了 `--css` 或 `--k`、`--k` 寫錯、不認得的參數）。

## Cloudflare Pages 的設定

2026-10-07 從 GitHub Pages 改成 Cloudflare Pages（使用者決定；原本的 `.github/workflows/pages.yml` 與 `public/CNAME` 拿掉了）。下面照 Cloudflare 官方文件的原文核對過（2026-10-07 抓的 .md 原文，不是摘要）。

- **建置**：專案的 Build command 填 `npm run build:pages`、Build output directory 填 `out`。官方的 Next.js 靜態網站指南（https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/ ）寫的是 `npx next build` 與 `out`；我們多了內容檢查，所以包成 `build:pages`。
- **Node 版本**：`.node-version` 寫 `22`。官方 build image 文件（https://developers.cloudflare.com/pages/configuration/build-image/ ）：Node 版本可以用環境變數 `NODE_VERSION` 或 repo 裡的 `.nvmrc`、`.node-version` 指定，**不會**讀 `package.json` 的 `engines`。放在 repo 裡，後台就不用多填一項。
- **`_headers`**（`public/_headers`，產生網頁時原樣放進 `out/`）：官方文件（https://developers.cloudflare.com/pages/configuration/headers/ ）的寫法。兩件事：
  - `https://:project.pages.dev/*` 與 `https://:version.:project.pages.dev/*` 加 `X-Robots-Tag: noindex`：`.pages.dev` 的網址與每次部署的預覽網址都打得開、內容一樣，不讓搜尋引擎收錄成重複的網站（官方範例就是這兩條）。預覽網址 Cloudflare 本來就會送 noindex（preview-deployments 文件），第二條是保險；真正要的是第一條（正式部署的 `.pages.dev`）。每一頁也有 canonical 指到 `https://collector.jerromy.com/`。
  - `/_next/static/*` 一年 `immutable`：Next.js 產生的 JS、CSS 檔名帶內容雜湊，可以放心長快取。HTML、字型、圖片、影片檔名不變，照 Cloudflare 預設。
  - 官方上限：最多 100 條規則、每行 2000 字。
- **404**：官方文件（https://developers.cloudflare.com/pages/configuration/serving-pages/ ）：找不到檔案時，從那個網址所在的資料夾往上找最近的 `404.html`，最後是 `/404.html`。我們只有最上層那一份，所以任何深度的網址都回它（404 頁的資源路徑一律從根目錄算，就是為了這個）。有最上層的 `404.html`，Cloudflare 也就不會把網站當成單頁應用（那種情況會把所有網址都回首頁）。
- **網址**：`/about.html` 會轉到 `/about`、`/about/index.html` 轉到 `/about/`（同一份文件）。我們的網址一律是資料夾形式（`trailingSlash: true`），對得上。
- **免費方案的限制**（https://developers.cloudflare.com/pages/platform/limits/ ）：每月 500 次建置、同時只跑 1 次、每個網站 2 萬個檔、單檔 25 MiB。這個網站產生出來約 170 個檔、最大的檔是 3.6 MB 的宣傳片。靜態網頁的瀏覽免費、不限次數（Workers 價目頁原文：「Requests to static assets are free and unlimited」）；每月 5 美金的 Workers Paid 方案是給伺服器上跑的程式用的，這個網站用不到。
- **還沒在真的 Cloudflare 上跑過**：第一次部署時看建置紀錄有沒有警告或失敗，上線後用正式網址量一次 Lighthouse。
