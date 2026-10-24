# 資料結構（Data Schema）

本專案有兩類資料：

1. **題庫資料**：原始檔在 `data/`，由 `tools/build.py` 嵌入 `index.html`，成為四個 `window.__*` 全域變數（各佔一行）。
2. **使用者資料**：瀏覽器 `localStorage`，鍵名皆以 `np_` 開頭。

---

## 1. 題庫資料

| 原始檔 | 建置後變數 | 大小 | 筆數 |
|---|---|---|---|
| `data/questions.json` | `window.__QD` | ~1.0 MB | 1,680 題（65 題附圖，圖檔另存 `data/images/`，~1.6 MB） |
| `data/explanations.json` | `window.__EXP` | ~2.0 MB | 1,680 筆詳解 |
| `data/topics.json` | `window.__TOPICS` | ~0.2 MB | 18 科 / 379 考點 |
| `data/topic_intros.json` | `window.__TOPIC_INTROS` | ~0.9 MB | 18 科 / 379 考點講義 |

> 格式：`questions.json` 與 `explanations.json` 一行一筆，方便看 diff；`topics.json`、`topic_intros.json` 為縮排 JSON。建置時以 `json.dumps(obj, ensure_ascii=False)` 輸出成 `window.__XX=...;`。修改流程見 [DEVELOPMENT.md](DEVELOPMENT.md#2-更新題庫詳解考點)。

### 1.1 `window.__QD` — 題庫

```jsonc
{
  "version": "1.0",
  "total": 1680,          // 建置時依題數計算，原始檔不存
  "questions": [Question, ...]
}
```

**`Question`**

| 欄位 | 型別 | 範例 | 說明 |
|---|---|---|---|
| `id` | `int` | `101` | 全域唯一主鍵（2–2181，不連續）。**所有其他資料集與 localStorage 都以此為 key**，不可重用或重排 |
| `number` | `int` | `19` | 原試卷中的題號（1–80） |
| `question` | `string` | `"中年男性心悸入急診…"` | 題幹（純文字，經 `questionHtml()` 以 `innerHTML` 插入） |
| `options` | `{A,B,C,D: string}` | | 全部題目皆為 A–D 四選項；選項本身是圖片時文字為 `"見圖（A）"` |
| `answer` | `string` | `"D"`、`"C、D"`、`"送分"` | 單選字母；多選以全形頓號 `、` 分隔（選任一即給分）；或 `"送分"`（有作答即給分） |
| `tags` | `string[]` | `["心臟血管","藥理用藥"]` | 1–10 個科別標籤，必須是 `SUBJECT_CATEGORIES` 中的 18 個值之一 |
| `year` | `int` | `113` | 民國年（109–115） |
| `exam_type` | `string` | `"進階內科"` | `通論` / `進階內科` / `進階外科` |
| `source` | `string` | `"【公告試題】113年度進階專科護理_內科.pdf"` | 原始 PDF 檔名 |
| `image` | `string?` | `"data/images/2038.jpg"` | **只存在於建置後的 `__QD`**：`data/images/<id>.jpg` 存在時由 `build.py` 加入；預設為相對路徑，`--embed-images` 時為 `data:image/jpeg;base64,...` |

**題庫分布**：109–115 年 × 通論／進階內科／進階外科，共 21 份試卷，每份 80 題，合計 1,680 題。

- 題目文字與答案皆依衛福部公告試題與標準答案校正（109–114 年已逐題核對答案）。
- `answer` 分布：單選 1,662、多選 14、`送分` 4（id `569, 649, 994, 1259`）。
- 已移除的 id：`1433–1918`（113、114 年重複匯入的第二份，與 `1–486` 相同）、`1, 82, 163, 244, 325, 406, 727, 808, 889, 970, 1051, 1132, 1213, 1294, 1352`（誤收的考卷說明）。前端 `migrateQuestionIds()` 會把舊紀錄轉到保留的題目，**新題目不可使用這些 id**。

**18 個科別標籤**（`SUBJECT_CATEGORIES`，位於 `src/index.html`）

| 類別 | 細科（題數，一題可多標籤） |
|---|---|
| 內科系 | 心臟血管 368、呼吸系統 357、消化系統 466、腎臟泌尿 182、神經系統 332、內分泌代謝 286、感染免疫 332、血液腫瘤 328 |
| 外科系 | 外科周手術 311、骨骼肌肉 181、重症加護 163 |
| 專&nbsp;&nbsp;科 | 婦產科 117、精神科 97、兒科 69 |
| 基礎通論 | 評估診斷 390、藥理用藥 399、護理通論 217、法規倫理 135 |

> 注意：類別名稱 `'專  科'` 中間是**兩個半形空白**，程式以此字串為 key。

### 1.2 `window.__EXP` — 詳解

```jsonc
{ "<id 字串>": "<Markdown 字串>", ... }
```

- key 為 `String(question.id)`，依 id 排序；JS 物件以數字存取亦可（`__EXP[101]`）。
- 前端以 `md()`（`marked.parse()` 後經 DOMPurify 消毒）轉 HTML，marked 設定 `breaks: true`（單一換行即換行）。
- 標準章節（`###` 標題）：

| 章節 | 出現次數 | 用途 |
|---|---|---|
| `【病例摘要】` | 493 | 情境題才有 |
| `【核心考點】` | 1,680 | 一句話考點 |
| `【解析推理】` | 1,679 | 推理過程 |
| `【選項分析】` | 1,680 | `(A) → ❌ …` / `(C) 選項摘要 → ✅ …` |
| `【高頻連結】` | 1,680 | 相關延伸考點 |
| `【記憶筆記】` | 1,680 | 口訣、陷阱 |

（另有 1 筆誤寫為 `【解析推點】`。）

**【選項分析】慣例**：四行 `(A)`–`(D)`，**✅ 只標在本題應選的選項**（「何者錯誤／不是／最不適當」這類否定型題目也一樣），其餘標 ❌；送分題四個都標 ✅。箭頭前可附選項摘要。`tools/validate.py` 會檢查 ✅ 與 `answer` 一致。

### 1.3 `window.__TOPICS` — 考點統計

```jsonc
{
  "<科別 tag>": {
    "<考點名稱>": {
      "stars": 5,               // 1–5，由 refresh_topics.py 依 count 計算
      "count": 32,              // = qids.length
      "qids": [47, 72, ...],    // 對應 Question.id（int），已排序
      "years": [109, ..., 115], // 由 qids 對應題目的年度計算
      "samples": ["…", ...]     // 常見考法（短句）
    }
  }
}
```

- 考點的科別必須出現在每個 `qid` 題目的 `tags` 中（validate.py 檢查）。
- 名稱為 `其他` 的考點不顯示「練習這個考點」按鈕。
- 同一題可出現在多個考點中，因此科別總數 ≠ 題數（UI 標示「含重複標記」）。

### 1.4 `window.__TOPIC_INTROS` — 考點講義

與 `__TOPICS` 同樣的兩層 key（科別 → 考點名稱），379 筆全有。`summary` 中的「（N星，N題）」等數字由 `refresh_topics.py` 同步。

| 欄位 | 型別 | 渲染方式 |
|---|---|---|
| `summary` | `string` | 純文字（innerHTML） |
| `definition` | `string` | 純文字，「📖 定義與機轉」 |
| `keyPoints` | `string[]` | 條列，「🎯 重點整理」 |
| `comparison` | `string \| null` | **Markdown 表格**，`md()`（marked + DOMPurify），「⚖️ 比較對照」 |
| `criteria` | `string \| null` | Markdown，`md()`，「📋 診斷標準／數值」 |
| `mustKnow` | `string[]` | 條列，「🔴 必背重點」 |
| `traps` | `string[]` | 條列，「⚠️ 常考陷阱」 |
| `mnemonics` | `string[]` | 條列，「💡 記憶口訣」 |

---

## 2. localStorage

| Key | 內容 | 寫入時機 | 讀取位置 |
|---|---|---|---|
| `np_progress` | `Progress`（JSON） | 每次作答、結束練習、模擬考交卷 | `loadProgress()` |
| `np_achievements` | `{ [key]: { date: ISOString } }` | 同上 | `loadProgress()` |
| `np_session` | `SessionSnapshot`（JSON） | 每次作答；模擬考每次選答、切題 | `loadSavedSession()`；`endSession()` 清除 |
| `np_notes` | `{ [qid]: Note }` | 儲存／刪除／匯入筆記 | `loadNotes()` |
| `np_explain_mode` | `'immediate' \| 'deferred'` | 切換詳解時機 | `initModeScreen()` |
| `np_theme` | `'' \| 'theme-forest' \| 'theme-white' \| 'theme-nightnurse' \| 'theme-neon' \| 'theme-wagashi' \| 'theme-abyss'` | 切換主題 | 主題 IIFE |

所有寫入都經 `safeSet(key, value)`（try/catch，空間不足時只提示一次）。舊版的 `np_api_key`（明文 API Key）與 `np_exp_{id}`（API 詳解快取）已停用，`migrateQuestionIds()` 載入時會刪除。

`np_progress`、`np_achievements`、`np_notes`、`np_explain_mode`、`np_theme` 可透過「進度備份」匯出／匯入（§2.5）；`np_session` 不在備份範圍內。

### 2.1 `Progress`

```jsonc
{
  "totalAnswered": 0,
  "totalCorrect": 0,
  "byTag":  { "心臟血管": { "correct": 0, "total": 0 } },
  "byYear": { "113":      { "correct": 0, "total": 0 } },
  "firstCorrect": { "101": true },                     // 曾答對過的題
  "lastAnswered": { "101": { "correct": false, "count": 3 } }, // 最近一次結果 + 累計作答次數
  "srs":    { "101": { "level": 0, "nextReview": 1761000000000 } }, // level 0–5
  "sessions": [Session, ...],                          // 最新在前，最多 20 筆
  "mockExams": [MockExam, ...]                         // 模擬考成績，最新在前，最多 30 筆（交卷後才出現此欄位）
}
```

**`Session`**

```jsonc
{
  "date": "2026/10/21",   // toLocaleDateString('zh-TW')
  "ts": 1761000000000,
  "total": 30, "correct": 24, "pct": 80,
  "mode": "mixed",        // 另有 "year"、"subject"、"weak"、"srs"、"exam"（模擬考）、"focus"（弱點加強）、"topic"（考點練習）
  "duration": 1520,       // 秒
  "tagPct": { "心臟血管": 75, ... }  // 本次各科正確率
}
```

**`MockExam`**

```jsonc
{ "year": 114, "examType": "通論", "score": 61.25, "ts": 1761000000000 }   // score = 答對數 × 1.25
```

- 「錯題模式」的依據是 `lastAnswered[id].correct === false`。
- 「累計弱點科別」來自 `byTag`，僅計 `total ≥ 3` 且正確率 < 80% 的科別。
- 「練習紀錄」趨勢圖取 `sessions` 最近 10 筆。
- 模擬考未作答的題目不寫入 `byTag`、`lastAnswered`、`srs` 等長期紀錄。
- 載入時 `migrateQuestionIds()` 會改寫 `srs`、`firstCorrect`、`lastAnswered` 中已移除的 id（見 §1.1）。

### 2.2 `SessionSnapshot`（未完成練習）

```jsonc
{
  "sessionQuestions": [101, 47, ...],  // 只存 id
  "currentIndex": 5,
  "userAnswers": [                     // 依題目位置存放，未作答為 null；不含題目內容，還原時依 qId 取回
    { "qId": 101, "selected": "D", "correct": true, "timeUsed": 12 },
    null
  ],
  "exam": null,                        // 模擬考進行中時為 { "year": 114, "examType": "通論", "deadline": 1761005400000, "picks": ["A", null, ...] }
  "streak": 2, "maxStreak": 4,
  "mode": "mixed",
  "selectedYears": [], "selectedExamTypes": [], "selectedTags": [],
  "selectedCount": 30,
  "explainMode": "immediate",
  "sessionStart": 1761000000000
}
```

> 舊版快照的 `userAnswers[].q` 會連同題目物件一起存，現已移除（當時附圖以 data URI 內嵌，存進快照可能超出配額）。還原時仍相容舊格式。

### 2.3 `Note`（筆記；也是匯出／匯入 JSON 的格式）

```jsonc
{
  "101": {
    "text": "**重點**：PSVT 不穩定 → 同步整流",   // Markdown
    "updatedAt": 1761000000000,
    "qNum": 19,                // 原卷題號
    "year": 113,
    "tags": ["心臟血管"],
    "question": "中年男性心悸入急診…"  // 題幹前 80 字
  }
}
```

- 匯出檔名：`np_notes_YYYY-MM-DD.json`。
- 匯入：以 qid 合併，同 key 直接覆蓋；`text` 不是非空字串的項目略過。
- 顯示時經 `md()`（marked + DOMPurify）消毒，匯入他人檔案中的 HTML／script 不會執行。

### 2.4 容量估算

`localStorage` 每個 origin 約 5 MB（依瀏覽器）。主要成長來源：

- `np_progress.srs` / `lastAnswered` / `firstCorrect`：每題約 60–80 bytes，全題庫答過 ≈ 130 KB
- `np_session`：只存 id 與作答結果，「全部」模式下約數十 KB
- `np_notes`：視使用者而定

寫入失敗（`QuotaExceededError`）時 `safeSet()` 以 Toast 提示一次並繼續作答，建議先匯出備份。

### 2.5 進度備份檔

由練習紀錄頁（或首頁「💾 進度備份」）的「匯出進度」產生，檔名 `np_backup_YYYY-MM-DD.json`：

```jsonc
{
  "app": "np-quest",                 // 匯入時必須相符
  "version": 1,
  "exportedAt": "2026-10-21T03:30:00.000Z",
  "data": {                          // 值為 localStorage 中的原始字串
    "np_progress": "{\"totalAnswered\":120, ...}",
    "np_achievements": "{...}",
    "np_notes": "{...}",
    "np_explain_mode": "immediate",
    "np_theme": "theme-neon"
  }
}
```

- `data` 只會包含 `BACKUP_KEYS` 中目前有值的鍵。
- 匯入驗證：`app === 'np-quest'`；每個鍵都在 `BACKUP_KEYS` 內且值為字串；`np_progress`、`np_achievements`、`np_notes` 可解析為 JSON；`np_progress.totalAnswered` 為數字。不符即拒絕，不改動現有資料。
- 通過後顯示備份時間與累計題數，確認後覆蓋檔案中有的鍵（沒有的鍵維持原狀）、清除 `np_session` 並重新載入；舊備份中已移除的題目 id 由 `migrateQuestionIds()` 轉換。
