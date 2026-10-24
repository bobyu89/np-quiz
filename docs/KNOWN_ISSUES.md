# 已知問題與技術債

> 原始盤點依 commit `278bf3d`；狀態已更新至 commit `fcebac0`（分支 `claude/confident-cray-stta0j`）。程式位置以 `src/index.html` 中的函式名稱標示。
> 嚴重度：🔴 影響正確性或安全　🟠 影響使用體驗　🟡 程式品質／技術債
> 狀態：✅ 已修正　◐ 部分修正　⬜ 未修正

## 總表

| # | 嚴重度 | 類別 | 問題 | 狀態 |
|---|---|---|---|---|
| [1](#bug-1) | 🔴 | 判分 | `送分` 題永遠判為答錯 | ✅ |
| [2](#bug-2) | 🔴 | 作答流程 | 「上一題」回顧後按「下一題」，已答的題目可被重答並重複計分 | ✅ |
| [3](#bug-3) | 🔴 | 安全 | 筆記以 `marked.parse()` 直接插入 DOM，匯入他人的筆記 JSON 可執行任意 script | ✅ |
| [4](#bug-4) | 🟠 | 資料 | 21 筆「考卷說明」被當成考題出題 | ✅ |
| [5](#bug-5) | 🟠 | 樣式 | 使用未定義的 `--clr-*` CSS 變數，弱點科別紅黃綠標色失效 | ✅ |
| [6](#bug-6) | 🟠 | 成就 | 滿分成就提早一題解鎖；鐵人成就第一題就解鎖；3 個成就永遠無法解鎖 | ✅ |
| [7](#bug-7) | 🟠 | 穩定性 | `localStorage` 寫入未處理配額錯誤，滿了之後作答流程會中斷 | ✅ |
| [8](#bug-8) | 🟠 | 資料 | 5 題選項缺漏、約 72 題缺圖、112 進階內科僅 58 筆 | ✅ |
| [9](#bug-9) | 🟡 | 安全 | Claude API Key 以明文存在 `localStorage`，且由瀏覽器直連 API | ✅ |
| [10](#bug-10) | 🟡 | 講義 | 講義只顯示佔位文字，沒有帶入已內嵌的詳解 | ✅ |
| [11](#bug-11) | 🟡 | 邊界 | 0 題就交卷時，講義正確率顯示 `NaN%` | ✅ |
| [12](#bug-12) | 🟡 | 技術債 | dead code、寫死常數、資料管線不在 repo、無自動化測試、程式風格不一 | ✅ |

全部已修正。

---

<a id="bug-1"></a>
## 1. 🔴 `送分` 題永遠判為答錯 — ✅ 已修正

**位置**：`isCorrect()`

原本 `'送分'.includes('A')` 永遠為 false，id `569, 649, 994, 1259` 共 4 題選任何選項都算錯。

**修正**：`isCorrect()` 開頭加上 `if (answer === '送分') return !!selected;`——有作答即給分（逾時、跳過仍算錯）。其餘改為 `answer.split('、').includes(selected)`：多選答案（`C、D`）維持「選中任一即算對」，符合官方更正「C 或 D 均給分」的慣例，也不會因字串包含而誤判。

---

<a id="bug-2"></a>
## 2. 🔴 回顧後前進會重答並重複計分 — ✅ 已修正

**原重現步驟**：答完 Q1、Q2，停在 Q3 → 按兩次「← 上一題」回到 Q1 → 在詳解面板按「下一題 →」→ Q2 以新題目狀態出現，可再作答，`recordAnswer()` 再 push 一筆，`progress` 與 SRS 被重複累計。

**修正**（commit `f7421af`）：

- `State.userAnswers` 改為依題目位置存放：`recordAnswer(q, selected, correct, timeUsed, index = State.currentIndex)` 寫入 `userAnswers[index]`。
- `renderQuestion()` 遇到 `userAnswers[currentIndex]` 已存在時一律進入回顧模式（選項停用、顯示詳解）。
- `skipQuestion()` 改為檢查該位置是否已有紀錄。
- 計算本次成績的地方（`endSession`、`renderRadar`、`generateHandout`、`renderSessionWeak`、`checkAchievements`）改用 `answeredList()` 略過空位；未完成練習的快照保留位置（空位存成 `null`）。

`tests/e2e.mjs` 以原重現步驟驗證。

---

<a id="bug-3"></a>
## 3. 🔴 筆記 Markdown 未消毒（XSS） — ✅ 已修正

marked v15 預設不做 HTML sanitize，而「匯入筆記」會載入他人分享的 JSON 檔，檔案中的 `<img src=x onerror=…>` 會在開啟筆記本時執行。

**修正**（commit `fcebac0`）：

- 內嵌 DOMPurify 3.2.6（緊接在 marked 之後）。
- 新增 `md(text) = DOMPurify.sanitize(marked.parse(text))`，筆記、詳解、延後詳解、講義、考點講義的 Markdown 一律經 `md()` 渲染，不再直接呼叫 `marked.parse()`。
- `importNotes()` 逐筆檢查格式，`text` 不是非空字串的項目直接略過。

> 題幹與選項仍以 `innerHTML` 插入，但來源是 repo 內的自有資料（經 `validate.py` 檢查、PR review）。

---

<a id="bug-4"></a>
## 4. 🟠 「考卷說明」被當成考題 — ✅ 已修正

每份試卷第一筆原是 PDF 的作答說明（「本試卷均為單一選擇題…」）。

**修正**：

- 從 `data/questions.json` 移除，同時移除 113、114 年重複匯入的整份複本（id `1433–1918`，與 `1–486` 完全相同）。其中考卷說明 15 筆（`1, 82, 163, 244, 325, 406, 727, 808, 889, 970, 1051, 1132, 1213, 1294, 1352`），其餘 6 筆位於重複區段內。
- 未重排任何 id；前端 `migrateQuestionIds()` 在載入時把重複區段的作答紀錄、SRS、筆記轉到保留的題目，考卷說明的紀錄直接刪除。
- `validate.py` 檢查每份試卷剛好 80 題、題號 1–80。

---

<a id="bug-5"></a>
## 5. 🟠 未定義的 `--clr-*` CSS 變數 — ✅ 已修正

`renderNewAchievements()`、`renderWeakAnalysis()`、`generateHandout()`、`renderWeakSummaryForHandout()`、`renderHandoutQuestion()` 原本使用未定義的 `--clr-*`，導致累計弱點的紅黃綠標色與講義區段顏色失效。

**修正**：全部替換為現行 token：

| 舊 | 新 |
|---|---|
| `--clr-text-dim` | `--color-text-muted` |
| `--clr-red` | `--color-error-500` |
| `--clr-yellow` | `--color-warning-500` |
| `--clr-green` | `--color-success-300` |
| `--clr-border` | `--color-bg-border` |

---

<a id="bug-6"></a>
## 6. 🟠 成就判定錯誤 — ✅ 已修正

**位置**：`checkAchievements()`（每次 `selectAnswer()` 記錄答案後呼叫）

| 成就 | 原問題 | 修正後條件 |
|---|---|---|
| `perfect_30` / `perfect_50` | 在 `recordAnswer()` 之後又 `+1`，第 29 題全對就解鎖 | 本次已作答（`answeredList()`）≥ 30／50 題且全對 |
| `iron_man` | `sessionQuestions.length >= 50`，答第一題就解鎖 | 本次實際作答 ≥ 50 題 |
| `first_time_ace` | 無解鎖邏輯 | 答對且這是該題第一次作答（`lastAnswered[id].count === 1`） |
| `comeback` | 無解鎖邏輯 | 本次最近 8 題為「連錯 3 題後連對 5 題」 |
| `all_subjects` | 無解鎖邏輯 | 題庫中所有科別標籤在 `progress.byTag` 都至少答過 1 題 |

> 模擬考交卷（`submitExam()`）不呼叫 `checkAchievements()`，作答中不給回饋，因此模擬考不觸發成就。

---

<a id="bug-7"></a>
## 7. 🟠 `localStorage` 配額錯誤未處理 — ✅ 已修正

`setItem` 在空間不足時會丟 `QuotaExceededError`，例外會往上中斷 `selectAnswer()`，畫面卡住。

**修正**：

- 所有寫入改用 `safeSet(key, value)`：try/catch 包住 `localStorage.setItem`，失敗時只以 Toast 提示一次（建議先匯出備份），作答流程照常進行。
- `np_session` 不再序列化整個題目物件（只存 `qId`、`selected`、`correct`、`timeUsed`，還原時依 id 取回），避免附圖（data URI）撐大快照。
- 移除 API 詳解的 HTML 快取 `np_exp_*`（見 #9）。

---

<a id="bug-8"></a>
## 8. 🟠 題庫資料品質 — ✅ 已修正

依衛福部公告試題與標準答案 PDF 全面校正 109–114 年題庫，並新增 115 年：

| 原問題 | 處理 |
|---|---|
| 選項缺漏（id `84`、`165`、`1516`、`1597`、`727`） | `84`、`165` 的選項本身是心電圖，改為「見圖（A）」等並附圖；`727` 為考卷說明已移除；`1516`、`1597` 屬重複區段已移除 |
| 題幹提到「如圖」但沒有圖片 | 自原始 PDF 裁切附圖存於 `data/images/<id>.jpg`，建置時寫入 `q.image`（相對路徑），前端可點擊放大；目前 65 題附圖 |
| 112 年進階內科只有 58 筆 | 補回 23 題（id `2159–2181`），並修正 6 題選項錯位（`1295、1296、1298–1301`）、`1339` 的題幹與選項錯配 |
| 其他 | 111 年內科第 51 題（`1102`）、113 年內科第 37 題（`119`）題號誤標且題幹截斷，已改正；題幹、選項中的頁首頁尾與排版殘留字元已清除；所有答案已與官方標準答案核對 |

`tools/validate.py` 會持續檢查選項完整性、附圖存在、試卷題號完整。

---

<a id="bug-9"></a>
## 9. 🟡 API Key 明文存放、瀏覽器直連 — ✅ 已修正

原本可輸入 Claude API Key（明文存在 `np_api_key`），在沒有本地詳解時以 `anthropic-dangerous-allow-browser` 從前端直連 API。

**修正**：全部題目都已有內嵌詳解，因此移除整個 API 路徑（`getApiKey`、`saveApiKey`、`showApiKeyModal`、`fetchExplanation` 與「設定 Key」按鈕）。`showExplanation()` 直接渲染 `__EXP[id]`，沒有詳解時顯示「此題尚無詳解」。`migrateQuestionIds()` 在載入時刪除舊版留下的 `np_api_key` 與 `np_exp_*`。

---

<a id="bug-10"></a>
## 10. 🟡 講義沒有帶入詳解 — ✅ 已修正

`renderHandoutQuestion()` 原本只顯示固定文字「（此處可使用 med-licensing-exam skill 進一步分析機轉）」。

**修正**：每題在正確答案下方以 `md(__EXP[id])` 帶入詳解（`.handout-exp`），並在 `@media print` 補上詳解文字與標題顏色、隱藏主題切換按鈕。

---

<a id="bug-11"></a>
## 11. 🟡 0 題交卷的邊界情況 — ✅ 已修正

**修正**：`confirmEnd()` 在一題都沒答（一般練習 `answeredList()` 為空；模擬考 `picks` 全空）時詢問是否結束，確認後清除未完成快照並回首頁，不寫入練習紀錄。剩餘題數改以「已作答數」計算。`generateHandout()` 的正確率另加除以 0 防護。

---

<a id="bug-12"></a>
## 12. 🟡 技術債 — ✅ 已修正

| 項目 | 說明 | 狀態 |
|---|---|---|
| 資料管線不在 repo | 已拆分為 `src/index.html` + `data/`，並新增 `tools/build.py`、`tools/validate.py`、`tools/refresh_topics.py` 與 GitHub Actions 驗證 | ✅ |
| 寫死「1918 題」 | 考點頁總題數改為依題庫動態顯示 | ✅ |
| Dead code | 已移除 `renderLibraryOverview` / `showLibraryDetail` / `renderLibraryDetail`、`renderQuickYearBtns` / `quickStart`、`printHandout`、`escapeHtml` | ✅ |
| 寫死常數 | 每題秒數改為 `QUESTION_SECONDS`（模擬考為 `EXAM_MINUTES`） | ✅ |
| `showScreen` 被覆寫 | 已移除 `DOMContentLoaded` 的包裝，進入成就廳／練習紀錄時的渲染併入 `showScreen()` 本身 | ✅ |
| 考點練習的 mode | `startTopicPractice()` 改為 `mode = 'topic'`，練習紀錄顯示「考點」 | ✅ |
| 無前端自動化測試 | 新增 `tests/e2e.mjs`（`npm test`，Playwright + Chromium）與 CI 的 `e2e` job，涵蓋判分、回顧、模擬考、id 轉換、XSS、儲存空間不足、進度備份等 22 項 | ✅ |
| 無法跨裝置 | 新增「進度備份」：匯出／匯入進度、成就、筆記與設定（見 DATA_SCHEMA §2.5） | ✅ |
| 程式風格 | 原始碼依功能拆成 `src/js/`、`src/screens/`、`src/styles/` 約 50 個檔案，建置時合併；全部改為 ES2015+（無 `var`、template literal、箭頭函式）；約 260 處 inline style 抽成 class，只留下動態計算值與 JS 切換顯示的初始 `display:none`。重構前後以 `tests/visual.mjs` 比對 78 個畫面，結果一致 | ✅ |

## 尚未處理

- **inline `onclick`**：仍以 inline `onclick` 呼叫全域函式（重構時刻意保留，避免改變行為）。若日後改成事件委派，可順便把全域函式收進模組。
