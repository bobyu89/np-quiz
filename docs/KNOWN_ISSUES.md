# 已知問題與技術債

> 依 commit `278bf3d` 的程式碼閱讀與資料分析整理，**尚未修正**。行號為 `index.html`。
> 嚴重度：🔴 影響正確性或安全　🟠 影響使用體驗　🟡 程式品質／技術債

## 總表

| # | 嚴重度 | 類別 | 問題 |
|---|---|---|---|
| [1](#bug-1) | 🔴 | 判分 | `送分` 題永遠判為答錯 |
| [2](#bug-2) | 🔴 | 作答流程 | 「上一題」回顧後按「下一題」，已答的題目可被重答並重複計分 |
| [3](#bug-3) | 🔴 | 安全 | 筆記以 `marked.parse()` 直接插入 DOM，匯入他人的筆記 JSON 可執行任意 script |
| [4](#bug-4) | 🟠 | 資料 | 21 筆「考卷說明」被當成考題出題 |
| [5](#bug-5) | 🟠 | 樣式 | 12 行使用未定義的 `--clr-*` CSS 變數，弱點科別紅黃綠標色失效 |
| [6](#bug-6) | 🟠 | 成就 | 滿分成就提早一題解鎖；鐵人成就第一題就解鎖；3 個成就永遠無法解鎖 |
| [7](#bug-7) | 🟠 | 穩定性 | `localStorage` 寫入未處理配額錯誤，滿了之後作答流程會中斷 |
| [8](#bug-8) | 🟠 | 資料 | 5 題選項缺漏、約 72 題缺圖、112 進階內科僅 58 筆 |
| [9](#bug-9) | 🟡 | 安全 | Claude API Key 以明文存在 `localStorage`，且由瀏覽器直連 API |
| [10](#bug-10) | 🟡 | 講義 | 講義只顯示佔位文字，沒有帶入已內嵌的詳解 |
| [11](#bug-11) | 🟡 | 邊界 | 0 題就交卷時，講義正確率顯示 `NaN%` |
| [12](#bug-12) | 🟡 | 技術債 | dead code、寫死常數、資料管線不在 repo |

---

<a id="bug-1"></a>
## 1. 🔴 `送分` 題永遠判為答錯

**位置**：`isCorrect()`，`index.html:3366`

```js
const ans = answer.split('、').sort().join('');   // '送分'
return selected === ans || ans.includes(selected); // 'A' 永遠不符
```

**影響**：id `569, 649, 994, 1259` 共 4 題。使用者選任何選項都算錯，並被排入錯題與 SRS 低熟練度。

**建議修法**：

```js
function isCorrect(selected, answer) {
  if (!answer) return false;
  if (answer === '送分') return true;
  return answer.split('、').includes(selected);
}
```

> 多選答案（例如 `C、D`，共 21 題）目前「選中任一即算對」，符合考選部更正答案「C 或 D 均給分」的慣例，屬預期行為。上面的寫法保留這個語意，只是用 `includes` 取代字串比對，避免之後出現 `AB` 這類答案時誤判。

---

<a id="bug-2"></a>
## 2. 🔴 回顧後前進會重答並重複計分

**位置**：`prevQuestion()` `:3456`、`nextQuestion()` `:3447`、`renderQuestion()` `:3039`

**重現步驟**：

1. 答完 Q1、Q2，停在 Q3
2. 按兩次「← 上一題」回到 Q1（回顧模式，正常）
3. 在詳解面板按「下一題 →」→ `nextQuestion()` 呼叫 `renderQuestion()`（沒帶 `reviewMode`）
4. Q2 以「新題目」狀態出現，計時器重新開始，可以再作答

**影響**：

- `recordAnswer()` 再 push 一筆，`userAnswers` 與 `currentIndex` 對不上，結果頁題數超過實際題數
- `progress.totalAnswered`、`byTag`、`lastAnswered.count`、SRS 都被重複累計
- `skipQuestion()` 的去重邏輯（`indexOf(a) === currentIndex`）也依賴兩者對齊，會連帶失效

**建議修法**：`userAnswers` 改成以題目索引存放（`State.userAnswers[State.currentIndex] = {...}`），`renderQuestion()` 改成自行判斷：

```js
const prevAnswer = State.userAnswers[State.currentIndex];
const reviewMode = !!prevAnswer;
```

同時要調整所有用 `filter/length` 計算本次成績的地方，忽略空位。

---

<a id="bug-3"></a>
## 3. 🔴 筆記 Markdown 未消毒（XSS）

**位置**：`renderNotebook()` `:4389`（`marked.parse(n.text)` → `innerHTML`）、`importNotes()` `:4482`

marked v15 預設**不做 HTML sanitize**。筆記本身是使用者自己寫的，風險有限；但「匯入筆記」這個功能讓使用者會去載入**同學分享的 JSON 檔**。檔案中只要有：

```json
{ "1": { "text": "<img src=x onerror=\"alert(localStorage.np_api_key)\">" } }
```

開啟筆記本就會執行，可以讀取同 origin 的所有 `localStorage`（包含 API Key、全部進度）。

**建議修法**：引入 DOMPurify（~20 KB，可同樣內嵌），所有 `marked.parse()` 輸出都經過 `DOMPurify.sanitize()`。

```js
function md(s) { return DOMPurify.sanitize(marked.parse(s)); }
```

> 題幹、選項、`__EXP`、`__TOPIC_INTROS` 也是用 `innerHTML`，但來源是內嵌的自有資料，信任等級不同，可列為次要。

---

<a id="bug-4"></a>
## 4. 🟠 「考卷說明」被當成考題

**資料**：每份試卷第一筆是 PDF 的作答說明（例如 id 1：「本試卷均為單一選擇題，每題都有」，選項是殘缺文字），共 21 筆：
`1, 82, 163, 244, 325, 406, 727, 808, 889, 970, 1051, 1132, 1213, 1294, 1352, 1433, 1514, 1595, 1676, 1757, 1838`

**影響**：會出現在年份／混合模式中，首頁「題庫總題數」顯示 1,918 而非 1,897。

**建議修法**（擇一）：

- 資料端：從 `__QD` 移除，或加上 `"is_instruction": true`
- 前端：`loadQuestions()` 載入時過濾 `__EXP[id]` 以 `（本題為考卷說明` 開頭的題目

**注意**：不要重排 id。移除題目時保留其他 id 不變，以免使用者既有進度對錯題。

> 其中 id `727` 同時是缺選項的題目之一（見 #8），應一併確認。

---

<a id="bug-5"></a>
## 5. 🟠 未定義的 `--clr-*` CSS 變數

**位置**：`renderNewAchievements()`、`renderWeakAnalysis()`、`generateHandout()`、`renderWeakSummaryForHandout()`、`renderHandoutQuestion()` 共 12 行（`index.html:3571–3808`），使用 `--clr-text-dim`、`--clr-red`、`--clr-yellow`、`--clr-green`、`--clr-border`。整份 CSS 只定義了 `--color-*`。

**影響**：

- 結果頁「弱點科別」依正確率標示紅／黃／綠的設計完全失效（`color` 無效值 → 繼承父層）
- 講義的錯題／答對區段標題、邊框沒有顏色

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
## 6. 🟠 成就判定錯誤

**位置**：`checkAchievements()`，`index.html:3683`

| 成就 | 問題 |
|---|---|
| `perfect_30` / `perfect_50` | `selectAnswer()` 先 `recordAnswer()` 再 `checkAchievements()`，此時 `userAnswers` **已含本題**，程式又 `+1`，所以第 29 題全對就解鎖 `perfect_30`；也沒檢查本次練習是否真的是 30／50 題 |
| `iron_man` | 條件是 `sessionQuestions.length >= 50`，開始一場 50 題練習、答第一題就解鎖，而非「刷完 50 題」 |
| `first_time_ace`、`comeback`、`all_subjects` | 有定義、成就廳會顯示，但沒有任何解鎖邏輯 |

**建議修法**：移除 `+ (correct ? 1 : 0)` 與 `+ 1`；`iron_man`、`perfect_*` 移到 `endSession()` 判斷；補上另外三個成就的條件（例如 `all_subjects`：`Object.keys(p.byTag).length === 18`）。

---

<a id="bug-7"></a>
## 7. 🟠 `localStorage` 配額錯誤未處理

**位置**：`saveProgress()` `:2809`、`saveSession()` `:2658`、`saveNotes()` `:4335`、`fetchExplanation()` 快取

`setItem` 在空間不足時會丟 `QuotaExceededError`。由於 `recordAnswer()` 最後呼叫 `saveProgress()`，例外會往上中斷 `selectAnswer()`：不會檢查成就，也不會顯示詳解或跳下一題，畫面卡住。

**建議修法**：包一層 `safeSet(key, value)`，失敗時 `showToast('儲存空間不足…')` 並繼續流程；`np_session` 可改為只存 `qId` 不存整個 `q` 物件，縮小快照（見 DATA_SCHEMA §2.2）。

---

<a id="bug-8"></a>
## 8. 🟠 題庫資料品質

| 問題 | 題目 |
|---|---|
| 選項缺漏（PDF 解析時 B／D 遺失） | id `84`、`165`、`1516`、`1597`（只有 A、C）；`727`（A、C、D） |
| 題幹提到「如圖」但沒有圖片 | 約 72 題，例如 id `101`「心電圖如圖（四）」 |
| 112 年進階內科只有 58 筆（其他試卷皆 80–81 筆） | 可能是原始 PDF 解析不完整 |

**建議**：補回原卷內容；圖片題可新增 `image` 欄位（base64 或相對路徑），並在 `renderQuestion()` 中渲染。

---

<a id="bug-9"></a>
## 9. 🟡 API Key 明文存放、瀏覽器直連

**位置**：`saveApiKey()` `:3242`、`fetchExplanation()` `:3299`

- Key 以明文存在 `np_api_key`，任何同 origin 的 script（例如 #3 的 XSS）都能讀取
- 使用 `anthropic-dangerous-allow-browser: true` 從前端直連 API
- 程式寫死 model `claude-haiku-4-5-20251001`

由於 `__EXP` 已涵蓋全部 1,918 題，API 路徑目前不會被觸發。**建議**：直接移除 API Key 功能與相關 UI（「設定 Key」按鈕只在沒有本地詳解時出現，目前也不會顯示）；若未來要即時生成，改走自己的後端 proxy，不要讓使用者在前端輸入 Key。

---

<a id="bug-10"></a>
## 10. 🟡 講義沒有帶入詳解

**位置**：`renderHandoutQuestion()` `:3781`

每題分析區只顯示固定文字「（此處可使用 med-licensing-exam skill 進一步分析機轉）」，對使用者沒有意義。**建議**：改為顯示 `marked.parse(window.__EXP[q.id])`，並確認 `@media print` 下的樣式。

---

<a id="bug-11"></a>
## 11. 🟡 0 題交卷的邊界情況

一題都沒答就按「交卷」：結果頁顯示 0%，練習紀錄新增一筆 `total: 0`，按「生成講義」時 `correct.length / total` 為 `NaN`。**建議**：`confirmEnd()` 在 `userAnswers.length === 0` 時直接回首頁，不寫入 session。

---

<a id="bug-12"></a>
## 12. 🟡 技術債

| 項目 | 說明 |
|---|---|
| Dead code | `renderLibraryOverview` / `showLibraryDetail` / `renderLibraryDetail`（對應的 `screen-library*` DOM 不存在）、`renderQuickYearBtns` / `quickStart`（`#quick-year-btns` 不存在）、`printHandout`、`escapeHtml`（未使用） |
| 寫死常數 | 每題 60 秒散落多處；「1918 題」寫死在考點頁說明 |
| 程式風格 | 主程式為 ES2015+，擴充區為 ES5 字串串接；大量 inline style 與 inline `onclick` |
| `showScreen` 被覆寫 | 擴充區在 `DOMContentLoaded` 時重新指派全域 `showScreen`，依賴 script 載入順序 |
| 考點練習的 mode | `startTopicPractice()` 把 `mode` 設為 `mixed`，練習紀錄無法區分是否為考點練習 |
| 資料管線不在 repo | 程式提及的 `generate_explanations.py`、`data/questions.json`、`data/questions-embed.js` 都不存在；題庫、詳解、考點分析目前只能從 `index.html` 反向抽取（見 DEVELOPMENT §2） |
| 無自動化測試 | 建議至少為 `isCorrect`、`updateSRS`、`getSRSQueue`、`startSession` 篩選邏輯寫單元測試（需先把邏輯抽成可 import 的模組） |
| 無法跨裝置 | 進度只存在單一瀏覽器；可考慮新增「進度匯出／匯入」（沿用筆記匯出格式） |

## 建議處理順序

1. **#1、#5**：各為幾行修改，風險低、效益直接
2. **#3**：引入 DOMPurify
3. **#2**：牽涉 `userAnswers` 資料結構，需完整回歸測試
4. **#4、#8**：資料修正，搭配 DEVELOPMENT §2.4 驗證腳本
5. 其餘依需求排程
