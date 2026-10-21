# 已知問題與技術債

> 原始盤點依 commit `278bf3d`；狀態已更新至 commit `f7421af`（分支 `claude/confident-cray-stta0j`）。程式位置以 `src/index.html` 中的函式名稱標示。
> 嚴重度：🔴 影響正確性或安全　🟠 影響使用體驗　🟡 程式品質／技術債
> 狀態：✅ 已修正　◐ 部分修正　⬜ 未修正

## 總表

| # | 嚴重度 | 類別 | 問題 | 狀態 |
|---|---|---|---|---|
| [1](#bug-1) | 🔴 | 判分 | `送分` 題永遠判為答錯 | ✅ |
| [2](#bug-2) | 🔴 | 作答流程 | 「上一題」回顧後按「下一題」，已答的題目可被重答並重複計分 | ✅ |
| [3](#bug-3) | 🔴 | 安全 | 筆記以 `marked.parse()` 直接插入 DOM，匯入他人的筆記 JSON 可執行任意 script | ⬜ |
| [4](#bug-4) | 🟠 | 資料 | 21 筆「考卷說明」被當成考題出題 | ✅ |
| [5](#bug-5) | 🟠 | 樣式 | 13 行使用未定義的 `--clr-*` CSS 變數，弱點科別紅黃綠標色失效 | ⬜ |
| [6](#bug-6) | 🟠 | 成就 | 滿分成就提早一題解鎖；鐵人成就第一題就解鎖；3 個成就永遠無法解鎖 | ◐ |
| [7](#bug-7) | 🟠 | 穩定性 | `localStorage` 寫入未處理配額錯誤，滿了之後作答流程會中斷 | ◐ |
| [8](#bug-8) | 🟠 | 資料 | 5 題選項缺漏、約 72 題缺圖、112 進階內科僅 58 筆 | ✅ |
| [9](#bug-9) | 🟡 | 安全 | Claude API Key 以明文存在 `localStorage`，且由瀏覽器直連 API | ⬜ |
| [10](#bug-10) | 🟡 | 講義 | 講義只顯示佔位文字，沒有帶入已內嵌的詳解 | ⬜ |
| [11](#bug-11) | 🟡 | 邊界 | 0 題就交卷時，講義正確率顯示 `NaN%` | ⬜ |
| [12](#bug-12) | 🟡 | 技術債 | dead code、寫死常數、資料管線不在 repo | ◐ |

---

<a id="bug-1"></a>
## 1. 🔴 `送分` 題永遠判為答錯 — ✅ 已修正

**位置**：`isCorrect()`

原本 `'送分'.includes('A')` 永遠為 false，id `569, 649, 994, 1259` 共 4 題選任何選項都算錯。

**修正**：`isCorrect()` 開頭加上 `if (answer === '送分') return !!selected;`——有作答即給分（逾時、跳過仍算錯）。多選答案（`C、D`）維持「選中任一即算對」，符合官方更正「C 或 D 均給分」的慣例。

---

<a id="bug-2"></a>
## 2. 🔴 回顧後前進會重答並重複計分 — ✅ 已修正

**原重現步驟**：答完 Q1、Q2，停在 Q3 → 按兩次「← 上一題」回到 Q1 → 在詳解面板按「下一題 →」→ Q2 以新題目狀態出現，可再作答，`recordAnswer()` 再 push 一筆，`progress` 與 SRS 被重複累計。

**修正**（commit `f7421af`）：

- `State.userAnswers` 改為依題目位置存放：`recordAnswer(q, selected, correct, timeUsed, index = State.currentIndex)` 寫入 `userAnswers[index]`。
- `renderQuestion()` 遇到 `userAnswers[currentIndex]` 已存在時一律進入回顧模式（選項停用、顯示詳解）。
- `skipQuestion()` 改為檢查該位置是否已有紀錄。
- 計算本次成績的地方（`endSession`、`renderRadar`、`generateHandout`、`renderSessionWeak`、`checkAchievements`）改用 `answeredList()` 略過空位；未完成練習的快照保留位置（空位存成 `null`）。

---

<a id="bug-3"></a>
## 3. 🔴 筆記 Markdown 未消毒（XSS） — ⬜ 未修正

**位置**：`renderNotebook()`（`marked.parse(n.text)` → `innerHTML`）、`importNotes()`

marked v15 預設**不做 HTML sanitize**。筆記本身是使用者自己寫的，風險有限；但「匯入筆記」這個功能讓使用者會去載入**同學分享的 JSON 檔**。檔案中只要有：

```json
{ "1": { "text": "<img src=x onerror=\"alert(localStorage.np_api_key)\">" } }
```

開啟筆記本就會執行，可以讀取同 origin 的所有 `localStorage`（包含 API Key、全部進度）。

**建議修法**：引入 DOMPurify（~20 KB，可同樣內嵌），所有 `marked.parse()` 輸出都經過 `DOMPurify.sanitize()`。

```js
function md(s) { return DOMPurify.sanitize(marked.parse(s)); }
```

> 題幹、選項、`__EXP`、`__TOPIC_INTROS` 也是用 `innerHTML`，但來源是 repo 內的自有資料（經 `validate.py` 檢查、PR review），信任等級不同，可列為次要。

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
## 5. 🟠 未定義的 `--clr-*` CSS 變數 — ⬜ 未修正

**位置**：`renderNewAchievements()`、`renderWeakAnalysis()`、`generateHandout()`、`renderWeakSummaryForHandout()`、`renderHandoutQuestion()` 共 13 行，使用 `--clr-text-dim`、`--clr-red`、`--clr-yellow`、`--clr-green`、`--clr-border`。整份 CSS 只定義了 `--color-*`。

**影響**：

- 結果頁「累計弱點科別」依正確率標示紅／黃／綠的設計失效（`color` 無效值 → 繼承父層）
- 講義的錯題／答對區段標題、邊框沒有顏色

> 新增的「本次弱點」（`renderSessionWeak()`）已使用 `--color-*`，不受影響。

**建議修法**：全部替換為現行 token：

| 舊 | 新 |
|---|---|
| `--clr-text-dim` | `--color-text-muted` |
| `--clr-red` | `--color-error-500` |
| `--clr-yellow` | `--color-warning-500` |
| `--clr-green` | `--color-success-300` |
| `--clr-border` | `--color-bg-border` |

---

<a id="bug-6"></a>
## 6. 🟠 成就判定錯誤 — ◐ 部分修正

**位置**：`checkAchievements()`

| 成就 | 問題 | 狀態 |
|---|---|---|
| `perfect_30` / `perfect_50` | 原本在 `recordAnswer()` 之後又 `+1`，第 29 題全對就解鎖 | ✅ 已改用 `answeredList()` 計算，不再多算一題 |
| `perfect_30` / `perfect_50` | 仍未檢查本次練習是否真的是 30／50 題（只看目前已答題數） | ⬜ |
| `iron_man` | 條件是 `sessionQuestions.length >= 50`，開始一場 50 題練習、答第一題就解鎖，而非「刷完 50 題」 | ⬜ |
| `first_time_ace`、`comeback`、`all_subjects` | 有定義、成就廳會顯示，但沒有任何解鎖邏輯 | ⬜ |

**建議修法**：`iron_man`、`perfect_*` 移到 `endSession()` 判斷；補上另外三個成就的條件（例如 `all_subjects`：`Object.keys(p.byTag).length === 18`）。模擬考交卷不會呼叫 `checkAchievements()`，新增條件時請一併考慮。

---

<a id="bug-7"></a>
## 7. 🟠 `localStorage` 配額錯誤未處理 — ◐ 部分修正

**位置**：`saveProgress()`、`saveSession()`、`saveNotes()`、`fetchExplanation()` 快取

`setItem` 在空間不足時會丟 `QuotaExceededError`。由於 `recordAnswer()` 最後呼叫 `saveProgress()`，例外會往上中斷 `selectAnswer()`：不會檢查成就，也不會顯示詳解或跳下一題，畫面卡住。

**已改善**：`np_session` 不再序列化整個題目物件（只存 `qId`、`selected`、`correct`、`timeUsed`，還原時依 id 取回），快照大幅縮小。這點在題目加入附圖（data URI）後尤其重要。

**仍待處理**：所有 `setItem` 仍沒有 try/catch。建議包一層 `safeSet(key, value)`，失敗時 `showToast('儲存空間不足…')` 並繼續流程。

---

<a id="bug-8"></a>
## 8. 🟠 題庫資料品質 — ✅ 已修正

依衛福部公告試題與標準答案 PDF 全面校正 109–114 年題庫，並新增 115 年：

| 原問題 | 處理 |
|---|---|
| 選項缺漏（id `84`、`165`、`1516`、`1597`、`727`） | `84`、`165` 的選項本身是心電圖，改為「見圖（A）」等並附圖；`727` 為考卷說明已移除；`1516`、`1597` 屬重複區段已移除 |
| 題幹提到「如圖」但沒有圖片 | 自原始 PDF 裁切附圖存於 `data/images/<id>.jpg`，建置時以 data URI 內嵌為 `q.image`，前端可點擊放大；目前 65 題附圖 |
| 112 年進階內科只有 58 筆 | 補回 23 題（id `2159–2181`），並修正 6 題選項錯位（`1295、1296、1298–1301`）、`1339` 的題幹與選項錯配 |
| 其他 | 111 年內科第 51 題（`1102`）、113 年內科第 37 題（`119`）題號誤標且題幹截斷，已改正；題幹、選項中的頁首頁尾與排版殘留字元已清除；所有答案已與官方標準答案核對 |

`tools/validate.py` 會持續檢查選項完整性、附圖存在、試卷題號完整。

---

<a id="bug-9"></a>
## 9. 🟡 API Key 明文存放、瀏覽器直連 — ⬜ 未修正

**位置**：`saveApiKey()`、`fetchExplanation()`

- Key 以明文存在 `np_api_key`，任何同 origin 的 script（例如 #3 的 XSS）都能讀取
- 使用 `anthropic-dangerous-allow-browser: true` 從前端直連 API
- 程式寫死 model `claude-haiku-4-5-20251001`

由於 `__EXP` 已涵蓋全部題目，API 路徑目前不會被觸發。**建議**：直接移除 API Key 功能與相關 UI（「設定 Key」按鈕只在沒有本地詳解時出現，目前也不會顯示）；若未來要即時生成，改走自己的後端 proxy，不要讓使用者在前端輸入 Key。

---

<a id="bug-10"></a>
## 10. 🟡 講義沒有帶入詳解 — ⬜ 未修正

**位置**：`renderHandoutQuestion()`

每題分析區只顯示固定文字「（此處可使用 med-licensing-exam skill 進一步分析機轉）」，對使用者沒有意義。**建議**：改為顯示 `marked.parse(window.__EXP[q.id])`，並確認 `@media print` 下的樣式。

---

<a id="bug-11"></a>
## 11. 🟡 0 題交卷的邊界情況 — ⬜ 未修正

一般練習一題都沒答就按「交卷」：結果頁顯示 0%，練習紀錄新增一筆 `total: 0`，按「生成講義」時 `correct.length / total` 為 `NaN`。**建議**：`confirmEnd()` 在 `answeredList().length === 0` 時直接回首頁，不寫入 session。（模擬考不受影響：交卷時 80 題都會列入，未作答以 0 分計。）

---

<a id="bug-12"></a>
## 12. 🟡 技術債 — ◐ 部分修正

| 項目 | 說明 | 狀態 |
|---|---|---|
| 資料管線不在 repo | 已拆分為 `src/index.html` + `data/`，並新增 `tools/build.py`、`tools/validate.py`、`tools/refresh_topics.py` 與 GitHub Actions 驗證 | ✅ |
| 寫死「1918 題」 | 考點頁總題數改為依題庫動態顯示 | ✅ |
| Dead code | `renderLibraryOverview` / `showLibraryDetail` / `renderLibraryDetail`（對應的 `screen-library*` DOM 不存在）、`renderQuickYearBtns` / `quickStart`（`#quick-year-btns` 不存在）、`printHandout`、`escapeHtml`（未使用） | ⬜ |
| 寫死常數 | 每題 60 秒散落多處（模擬考時間已抽成 `EXAM_MINUTES`） | ⬜ |
| 程式風格 | 主程式為 ES2015+，擴充區為 ES5 字串串接；大量 inline style 與 inline `onclick` | ⬜ |
| `showScreen` 被覆寫 | 擴充區在 `DOMContentLoaded` 時重新指派全域 `showScreen`，依賴 script 載入順序 | ⬜ |
| 考點練習的 mode | `startTopicPractice()` 把 `mode` 設為 `mixed`，練習紀錄無法區分是否為考點練習（弱點加強已使用獨立的 `focus`） | ⬜ |
| 無前端自動化測試 | 資料面已有 `validate.py`；建議為 `isCorrect`、`updateSRS`、`getSRSQueue`、`startSession` 篩選邏輯寫單元測試（需先把邏輯抽成可 import 的模組） | ⬜ |
| 無法跨裝置 | 進度只存在單一瀏覽器；可考慮新增「進度匯出／匯入」（沿用筆記匯出格式） | ⬜ |

## 建議處理順序

1. **#5**：純替換，幾行修改、風險低
2. **#3**：引入 DOMPurify
3. **#11**、**#7**：`confirmEnd()` 防呆、`safeSet()` 包裝
4. **#6**：成就條件移到 `endSession()` 並補齊
5. **#10**、**#9**、**#12**：依需求排程
