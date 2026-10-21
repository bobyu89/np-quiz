# 資料結構（Data Schema）

本專案有兩類資料：

1. **內嵌唯讀資料**：`index.html` 第 2574–2577 行，四個 `window.__*` 全域變數，各佔一行（單行 0.17–2.3 MB）。
2. **使用者資料**：瀏覽器 `localStorage`，鍵名皆以 `np_` 開頭。

---

## 1. 內嵌資料

| 行號 | 變數 | 大小 | 筆數 |
|---|---|---|---|
| 2574 | `window.__QD` | ~1.16 MB | 1,918 題 |
| 2575 | `window.__EXP` | ~2.29 MB | 1,918 筆詳解 |
| 2576 | `window.__TOPICS` | ~0.17 MB | 18 科 / 379 考點 |
| 2577 | `window.__TOPIC_INTROS` | ~0.87 MB | 18 科 / 379 考點講義 |

> 讀取方式：每行格式為 `window.__XX={...JSON...};`，去掉前綴與結尾分號即為合法 JSON，抽取腳本見 [DEVELOPMENT.md](DEVELOPMENT.md#21-從-indexhtml-抽出資料)。

### 1.1 `window.__QD` — 題庫

```jsonc
{
  "version": "1.0",
  "total": 1918,
  "questions": [Question, ...]
}
```

**`Question`**

| 欄位 | 型別 | 範例 | 說明 |
|---|---|---|---|
| `id` | `int` | `101` | 全域唯一主鍵，1–1918 連續。**所有其他資料集與 localStorage 都以此為 key** |
| `number` | `int` | `19` | 原試卷中的題號 |
| `question` | `string` | `"中年男性心悸入急診…"` | 題幹（純文字，以 `innerHTML` 插入） |
| `options` | `{A?,B?,C?,D?: string}` | | 1,913 題為 A–D 四選項；5 題因 PDF 解析缺項 |
| `answer` | `string` | `"D"`、`"C、D"`、`"送分"` | 單選字母；多選以全形頓號 `、` 分隔；或 `"送分"` |
| `tags` | `string[]` | `["心臟血管","藥理用藥"]` | 1–10 個科別標籤，必須是 `SUBJECT_CATEGORIES` 中的 18 個值之一 |
| `year` | `int` | `113` | 民國年（109–114） |
| `exam_type` | `string` | `"進階內科"` | `通論` / `進階內科` / `進階外科` |
| `source` | `string` | `"【公告試題】113年度進階專科護理_內科.pdf"` | 原始 PDF 檔名 |

**題庫分布**

| 年度 | 通論 | 進階內科 | 進階外科 | 小計 |
|---|---|---|---|---|
| 109 | 80 | 80 | 80 | 240 |
| 110 | 81 | 81 | 81 | 243 |
| 111 | 81 | 81 | 81 | 243 |
| 112 | 81 | 58 | 81 | 220 |
| 113 | 162 | 162 | 162 | 486 |
| 114 | 162 | 162 | 162 | 486 |

- 每份試卷第一筆通常是「考卷說明」（非考題）。共 21 筆，id：`1, 82, 163, 244, 325, 406, 727, 808, 889, 970, 1051, 1132, 1213, 1294, 1352, 1433, 1514, 1595, 1676, 1757, 1838`。其 `__EXP` 內容為 `（本題為考卷說明，非考試題目）`。
- `answer` 分布：單選 1,893、多選 21、`送分` 4。
- 約 72 題題幹提到「如圖」，但題庫**不含圖片**。

**18 個科別標籤**（`SUBJECT_CATEGORIES`, `index.html:2588`）

| 類別 | 細科（題數，一題可多標籤） |
|---|---|
| 內科系 | 心臟血管 442、呼吸系統 450、消化系統 572、腎臟泌尿 208、神經系統 430、內分泌代謝 336、感染免疫 394、血液腫瘤 404 |
| 外科系 | 外科周手術 341、骨骼肌肉 224、重症加護 178 |
| 專&nbsp;&nbsp;科 | 婦產科 148、精神科 124、兒科 86 |
| 基礎通論 | 評估診斷 419、藥理用藥 469、護理通論 261、法規倫理 164 |

> 注意：類別名稱 `'專  科'` 中間是**兩個半形空白**，程式以此字串為 key。

### 1.2 `window.__EXP` — 詳解

```jsonc
{ "<id 字串>": "<Markdown 字串>", ... }
```

- key 為 `String(question.id)`；JS 物件以數字存取亦可（`__EXP[101]`）。
- 前端以 `marked.parse()` 轉 HTML。
- 標準章節（`###` 標題）：

| 章節 | 出現次數 | 用途 |
|---|---|---|
| `【病例摘要】` | 656 | 情境題才有 |
| `【核心考點】` | 1,897 | 一句話考點 |
| `【解析推理】` | 1,896 | 推理過程 |
| `【選項分析】` | 1,899 | `(A) → ❌ …` / `(C) → ✅ …` |
| `【高頻連結】` | 1,897 | 相關延伸考點 |
| `【記憶筆記】` | 1,897 | 口訣、陷阱 |

（另有 1 筆誤寫為 `【解析推點】`。）

### 1.3 `window.__TOPICS` — 考點統計

```jsonc
{
  "<科別 tag>": {
    "<考點名稱>": {
      "stars": 5,               // 1–5
      "count": 32,              // 命中題數
      "qids": [47, 72, ...],    // 對應 Question.id（int）
      "years": [109, ..., 114], // 出現過的年度
      "samples": ["…", ...]     // 常見考法（短句）
    }
  }
}
```

- 名稱為 `其他` 的考點不顯示「練習這個考點」按鈕。
- 同一題可出現在多個考點中，因此科別總數 ≠ 題數（UI 標示「含重複標記」）。

### 1.4 `window.__TOPIC_INTROS` — 考點講義

與 `__TOPICS` 同樣的兩層 key（科別 → 考點名稱），379 筆全有。

| 欄位 | 型別 | 渲染方式 |
|---|---|---|
| `summary` | `string` | 純文字（innerHTML） |
| `definition` | `string` | 純文字，「📖 定義與機轉」 |
| `keyPoints` | `string[]` | 條列，「🎯 重點整理」 |
| `comparison` | `string \| null` | **Markdown 表格**，`marked.parse()`，「⚖️ 比較對照」 |
| `criteria` | `string \| null` | Markdown，「📋 診斷標準／數值」 |
| `mustKnow` | `string[]` | 條列，「🔴 必背重點」 |
| `traps` | `string[]` | 條列，「⚠️ 常考陷阱」 |
| `mnemonics` | `string[]` | 條列，「💡 記憶口訣」 |

---

## 2. localStorage

| Key | 內容 | 寫入時機 | 讀取位置 |
|---|---|---|---|
| `np_progress` | `Progress`（JSON） | 每次作答、結束練習 | `loadProgress()` |
| `np_achievements` | `{ [key]: { date: ISOString } }` | 同上 | `loadProgress()` |
| `np_session` | `SessionSnapshot`（JSON） | 每次作答 | `loadSavedSession()`；`endSession()` 清除 |
| `np_notes` | `{ [qid]: Note }` | 儲存／刪除／匯入筆記 | `loadNotes()` |
| `np_explain_mode` | `'immediate' \| 'deferred'` | 切換詳解時機 | `initModeScreen()` |
| `np_theme` | `'' \| 'theme-forest' \| 'theme-white' \| 'theme-nightnurse' \| 'theme-neon' \| 'theme-wagashi' \| 'theme-abyss'` | 切換主題 | 主題 IIFE |
| `np_api_key` | Claude API Key（**明文**） | 使用者設定 | `getApiKey()` |
| `np_exp_{id}` | API 詳解的 HTML 快取 | API 回應後 | `fetchExplanation()` |

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
  "sessions": [Session, ...]                           // 最新在前，最多 20 筆
}
```

**`Session`**

```jsonc
{
  "date": "2026/10/21",   // toLocaleDateString('zh-TW')
  "ts": 1761000000000,
  "total": 30, "correct": 24, "pct": 80,
  "mode": "mixed",
  "duration": 1520,       // 秒
  "tagPct": { "心臟血管": 75, ... }  // 本次各科正確率
}
```

- 「錯題模式」的依據是 `lastAnswered[id].correct === false`。
- 「累計弱點科別」來自 `byTag`，僅計 `total ≥ 3` 的科別。
- 「練習紀錄」趨勢圖取 `sessions` 最近 10 筆。

### 2.2 `SessionSnapshot`（未完成練習）

```jsonc
{
  "sessionQuestions": [101, 47, ...],  // 只存 id
  "currentIndex": 5,
  "userAnswers": [ { "qId": 101, "q": { ...完整 Question... }, "selected": "D", "correct": true, "timeUsed": 12 } ],
  "streak": 2, "maxStreak": 4,
  "mode": "mixed",
  "selectedYears": [], "selectedExamTypes": [], "selectedTags": [],
  "selectedCount": 30,
  "explainMode": "immediate",
  "sessionStart": 1761000000000
}
```

> `userAnswers[].q` 會把整個題目物件一起序列化，「全部」模式下快照會明顯變大。

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
- 匯入：以 qid 合併，同 key 直接覆蓋；`text` 為空的項目略過。

### 2.4 容量估算

`localStorage` 每個 origin 約 5 MB（依瀏覽器）。主要成長來源：

- `np_progress.srs` / `lastAnswered` / `firstCorrect`：每題約 60–80 bytes，全題庫答過 ≈ 150 KB
- `np_session`：「全部」模式下最多含 1,918 份題目物件 ≈ 1 MB
- `np_notes`：視使用者而定

目前所有 `setItem` 都沒有處理 `QuotaExceededError`，見 [KNOWN_ISSUES.md](KNOWN_ISSUES.md)。
