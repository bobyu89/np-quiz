# 開發指南

## 1. 環境與執行

建置與驗證只需要 Python 3（腳本只用標準函式庫）。端對端測試另需 Node.js 22 與 npm（見 §6）。

```bash
# 直接開檔（題庫已內嵌，file:// 可正常運作）
open index.html

# 或啟動靜態伺服器
python3 -m http.server 8000
```

**檔案分工**

| 路徑 | 說明 |
|---|---|
| `src/index.html` | 網頁模板：程式、樣式、DOM。**改程式改這裡** |
| `data/*.json`、`data/images/` | 題庫、詳解、考點、附圖。**改資料改這裡** |
| `index.html` | 建置產物（約 6.5 MB），不要手動修改；改完 `src/` 或 `data/` 後重新建置並一併 commit |

**編輯注意事項**

- `src/index.html` 仍有幾行超長的內嵌函式庫與字型（Chart.js、marked、DOMPurify、base64 字型），部分編輯器處理會變慢；搜尋程式碼時可用 `grep -n 'pattern' src/index.html | cut -c1-200`。
- 所有互動都用 inline `onclick="fn()"` 呼叫全域函式。**重新命名函式時要同時搜尋 HTML 字串與 JS 模板字串**。
- 主程式使用 `'use strict'`，擴充區（結果分頁、成就廳、紀錄、考點、筆記本）是 ES5 風格（`var`、字串串接），新增程式碼請與所在區塊一致。
- 新程式碼取得本次作答紀錄請用 `answeredList()`：`State.userAnswers` 依題目位置存放，可能有空位。
- Markdown 一律用 `md(text)` 渲染（marked + DOMPurify），不要直接把 `marked.parse()` 的結果放進 `innerHTML`。
- 寫入 `localStorage` 一律用 `safeSet(key, value)`，空間不足時不會中斷流程。

## 2. 更新題庫／詳解／考點

```bash
python3 tools/refresh_topics.py   # 改到題目標籤或 topics 的 qids 時：重算 count/stars/years
python3 tools/validate.py         # 一致性檢查，有問題會列出並以非零狀態結束
python3 tools/build.py            # 產生 index.html
python3 tools/build.py --check    # 只檢查 index.html 是否為最新（CI 使用）
```

GitHub Actions（`.github/workflows/validate.yml`）在 push 到 `main` 與每個 PR 時執行兩個 job：`validate`（`validate.py`、`build.py --check`）與 `e2e`（`npm test`，見 §6）。

`build.py` 的輸出與拆分前的 `index.html` 逐位元組相同（`json.dumps` 預設分隔符與原內嵌格式一致），因此 `index.html` 的變動只來自實際改動的內容。

### 2.1 `validate.py` 檢查項目

| 項目 | 規則 |
|---|---|
| id | 不重複 |
| 試卷完整性 | 每個 `source` 的題號剛好是 1–80 |
| 選項 | 必須是完整的 A–D，且不為空 |
| 答案 | 字母都在選項中；`送分` 視為四個選項皆對 |
| 標籤 | 非空，且都屬於 18 個科別 |
| 文字 | 不含排版殘留字元 `ˉ` 或連續空白 |
| 附圖 | 題幹出現「如圖」「圖（一）」等字樣時，`data/images/<id>.jpg` 必須存在 |
| 詳解 | 每題都有；【選項分析】有 (A)–(D) 四行 ✅/❌，且 ✅ 剛好是 `answer` 的字母 |
| 考點 | `qids` 都存在、考點科別在題目 `tags` 中、`count` 等於 `qids` 數量 |

### 2.2 新增一份試卷的檢查清單

1. 從衛福部「專科護理師甄審」公告取得【公告試題】與【標準答案】PDF（`pdftotext -layout` 可直接抽出文字；注意排除頁首頁尾、`\f` 換頁符號與封面注意事項的 1.–7. 編號）。
2. `data/questions.json`：新題 `id` 從目前最大值 +1 接續（**不可重用、重排既有 id，也不可使用已移除的 id 1433–1918**，否則使用者的進度、SRS、筆記會對到錯題）。
3. `year` 用民國年整數；`exam_type` 只能是 `通論`／`進階內科`／`進階外科`（新增類型前端會自動出現在篩選中；模擬考的科目按鈕與 `EXAM_PAIRS` 需另外修改）。
4. `tags` 只能用 18 個既有科別；若要新增科別，必須同步修改 `SUBJECT_CATEGORIES` 與 `tools/validate.py` 的 `TAGS`。
5. `answer`：單選 `"A"`；多選 `"A、C"`（**全形頓號**）；送分 `"送分"`。請以【標準答案】與【疑義試題答案說明】為準。
6. 有附圖的題目：裁切後存成 `data/images/<id>.jpg`（建議寬度 ≤ 760 px、JPEG 品質約 72）。選項本身是圖時，選項文字填 `"見圖（A）"` 等。
7. `data/explanations.json`：每個新 id 都要有一筆，沿用 `### 【核心考點】` 等六段格式與 ✅ 慣例（見 [DATA_SCHEMA.md](DATA_SCHEMA.md#12-window__exp--詳解)）。
8. `data/topics.json`：把新 id 加進對應考點的 `qids`；新增考點時 `topic_intros.json` 必須有相同的 key。
9. 依序執行 `refresh_topics.py` → `validate.py` → `build.py`，再跑 `npm test` 與 [§6.2 手動測試](#62-手動測試清單)。

## 3. 常見修改

### 3.1 新增主題配色

1. 在 `src/index.html` 主 `<style>` 末端（`THEME: 深海靜謐` 之後）新增 `body.theme-xxx { ... }`，覆寫 `:root` 的 Design Tokens（`--color-primary-*`、`--color-bg-*`、`--color-text-*`、`--pixel-border-*` 等）。最簡版本只需覆寫變數，參考 `theme-nightnurse`（約 30 行）；完整版本可另外覆寫元件，參考 `theme-forest`。
2. 在 `#theme-menu` 加一顆 `<button onclick="setTheme('theme-xxx')" class="theme-btn" data-theme="theme-xxx">`。
3. 在主題 IIFE 的 `THEMES` 陣列加上 `'theme-xxx'`（否則切換時舊 class 不會被移除）。

### 3.2 新增成就

1. `ACHIEVEMENTS` 新增 `key: { icon, name, desc }`。
2. 在 `checkAchievements()` 中加入解鎖條件 `unlock('key')`。成就廳與首頁計數會自動更新。

> `checkAchievements()` 在一般練習每題作答後呼叫，此時本題已寫入 `userAnswers`（用 `answeredList()` 計算，不要再 +1）；模擬考交卷不會呼叫。各成就的現行條件見 KNOWN_ISSUES #6。

### 3.3 調整計時、SRS 間隔、題數

| 參數 | 位置 |
|---|---|
| 每題秒數 | `QUESTION_SECONDS`（目前 60）；另需同步 HUD 初始顯示 `<span id="timer-num">60</span>` |
| 模擬考時間 | `EXAM_MINUTES`（目前 90 分鐘，同正式考試每節時間） |
| 模擬考及格判定 | `renderExamVerdict()`（單科 ≥ 50、兩科平均 ≥ 60）、`EXAM_PAIRS` |
| SRS 間隔 | `SRS_INTERVALS` |
| 題數選項 | `screen-mode` 中的 `.count-btn`（30/40/50/全部） |
| 弱點加強題數 | `startFocusPractice()` 中的 `slice(0, 20)` |
| 等級門檻 | `getRank()` |
| 紀錄保留筆數 | `endSession()` 中 `sessions.length > 20`；`submitExam()` 中 `mockExams` 保留 30 筆 |

### 3.4 Design Tokens

定義在 `src/index.html` 的 `:root`，主要分組：

| 前綴 | 用途 |
|---|---|
| `--color-primary-*` | 主色（電光藍） |
| `--color-secondary-*` | 強調色（成就金） |
| `--color-bg-*` | 背景層級：void → base → surface → elevated → overlay → border |
| `--color-text-*` | primary / secondary / muted |
| `--color-success-*` / `--color-error-*` / `--color-warning-*` | 語意色 |
| `--color-hp-*` / `--color-fire-*` | 計時條、連勝火焰 |
| `--gradient-*` | 卡片、成功／失敗、金色漸層 |
| `--pixel-border-*` | 以 8 方向 `box-shadow` 模擬像素邊框 |
| `--font-pixel` / `--font-body` / `--font-mono` | Press Start 2P / Noto Sans TC / Share Tech Mono |

新程式碼請用 `--color-*`（舊的未定義 `--clr-*` 已全部替換掉）。

## 4. 外部依賴

| 套件 | 版本 | 授權 | 嵌入位置 | 用途 |
|---|---|---|---|---|
| Chart.js | 4.4.0 | MIT | `src/index.html` `<head>` | 雷達圖、趨勢折線圖 |
| marked | 15.0.7 | MIT | 同上 | 詳解、筆記、考點表格的 Markdown 渲染（`breaks: true`） |
| DOMPurify | 3.2.6 | Apache-2.0 / MPL-2.0 | 同上（緊接 marked 之後） | 消毒 marked 輸出（`md()`），防止匯入筆記的 XSS |
| Press Start 2P | — | OFL | 主 `<style>` 開頭（base64） | 像素字型（僅拉丁字元） |
| Share Tech Mono | — | OFL | 同上 | 等寬字型 |
| Noto Sans TC | — | OFL | **未內嵌**，依賴系統字型（fallback `PingFang TC`） | 中文內文 |

升級函式庫：以新版的 UMD 壓縮檔取代對應 `<script>` 區塊即可（移除結尾的 `sourceMappingURL` 註解）。marked 升級需確認 `marked.parse()` 仍為同步 API、`marked.use()` 仍可用；DOMPurify 升級需確認全域 `DOMPurify.sanitize()` 仍存在。

開發用依賴（不會進入 `index.html`）：`playwright` 1.56.1（`package.json` 的 devDependency，僅供端對端測試）。

**網路連線**：沒有任何外部請求（舊版的 Claude API 詳解已移除），完全離線可用。

## 5. 部署

產物是純靜態單檔：

- **GitHub Pages**：目前由 `main` 分支根目錄的 `index.html` 發布（`pages-build-deployment`）。合併到 `main` 前，CI 會確認 `index.html` 已重新建置。
- **其他**：把 `index.html` 複製到 Netlify / Vercel / S3 / Nginx，無需任何 rewrite 規則。

建議伺服器開啟 gzip/brotli：內容大多是 JSON 與中文文字，壓縮後傳輸量會明顯下降（附圖為 JPEG，壓縮幅度有限）。

**資料遷移**：使用者資料綁定 origin（網域 + 協定 + port）。更換網域、或從 `file://` 改成 `https://`，使用者會看到全新的空進度；請引導使用者先用「💾 進度備份」匯出，再到新網址匯入（格式見 DATA_SCHEMA §2.5）。

## 6. 測試

### 6.1 端對端測試

```bash
npm ci                              # 安裝 playwright（devDependency）
npx playwright install chromium     # 第一次需要下載瀏覽器
python3 tools/build.py              # 測試的是建置後的 index.html
npm test                            # node tests/e2e.mjs
```

可用環境變數 `CHROME_PATH` 指定既有的 Chromium 執行檔（不另外下載）。`tests/e2e.mjs` 以 `file://` 開啟 `index.html`，涵蓋：

- 題庫 21 份試卷各 80 題；`isCorrect` 的送分與多選判定
- 回顧上一題後前進不能重答、不重複計分；附圖放大與 Esc 關閉；0 題交卷
- 模擬考：作答不顯示對錯、左滑前進、重新整理後接續、題號面板跳題、交卷計分、兩科平均判定、一鍵練習弱點
- 已移除題目 id 的進度與筆記轉換、清除舊版 API Key、筆記 Markdown 消毒（XSS）、儲存空間不足時不中斷作答
- 進度備份匯出後在乾淨的瀏覽器匯入、拒絕非本系統的備份檔
- 各情境無 JS 錯誤

### 6.2 手動測試清單

自動化測試沒有涵蓋的部分，修改相關功能後請走過：

- [ ] 首頁統計正確顯示題庫數、累計答題、正確率、成就數
- [ ] 五種練習模式各開一次；篩選條件為空時不報錯；無題目時出現提示
- [ ] 答對／答錯／超時／跳過：顏色回饋、streak、詳解面板正確；詳解【選項分析】一行一個選項
- [ ] 延後詳解模式：結束後自動切到「詳解查閱」分頁
- [ ] 一般練習作答中重新整理頁面 → 出現續做提示並回到正確題號
- [ ] 結果頁雷達圖、累計弱點紅黃綠標色、講義（含詳解）與列印預覽
- [ ] 考點總覽 → 科別 → 展開講義（含 Markdown 表格）→ 練習這個考點（練習紀錄顯示「考點」）
- [ ] 筆記新增／編輯／刪除、搜尋、排序、匯出、匯入
- [ ] 7 種主題切換並重新整理後保留
- [ ] 手機寬度（≤480px）版面無水平捲動；實機左右滑動切題手感
