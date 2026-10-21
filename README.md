# 專科護理師冒險記 ⚔️（NP Quest）

台灣專科護理師（NP）甄審筆試刷題系統。像素 RPG 風格、單一 HTML 檔、零後端，直接用瀏覽器開啟即可使用。

| 項目 | 內容 |
|---|---|
| 題庫 | 109–115 年度歷屆試題，共 1,680 題（21 份試卷 × 80 題，答案皆已與衛福部標準答案核對） |
| 考試類型 | 通論、進階內科、進階外科 |
| 科別 | 18 個細科，分 4 大類（內科系／外科系／專科／基礎通論） |
| 詳解 | 每題一份預先生成的 Markdown 詳解（內嵌） |
| 附圖 | 65 題 ECG、X 光、CT、MRI 等附圖（內嵌，可點擊放大） |
| 考點分析 | 18 科 × 379 個考點主題，含星等、題目對應、主題講義 |
| 技術 | Vanilla JS（無框架）、Chart.js 4.4.0、marked 15.0.7；Python 建置腳本只用標準函式庫 |
| 儲存 | 全部存在瀏覽器 `localStorage`，無伺服器、無帳號 |

## 快速開始

```bash
# 方法 1：直接開檔（file:// 即可運作，題庫已內嵌）
open index.html

# 方法 2：本機靜態伺服器
python3 -m http.server 8000   # 開 http://localhost:8000
```

部署：GitHub Pages 直接發布 `main` 分支的 `index.html`。`index.html` 是建置產物，但會一併 commit，所以部署本身不需要建置步驟。

## 功能一覽

- **刷題系統**：混合／年份／科別／錯題／智慧複習（SRS）五種練習模式；每題 60 秒計時；即時或延後詳解
- **模擬考**：選年度與科目，依原卷 80 題、90 分鐘作答，交卷後計分並依「兩科平均 60 分且各科 ≥ 50 分」判定及格
- **重點考點**：依考點出題次數給星等（★1–★5），展開可看主題講義與「練習這個考點」
- **成績與分析**：本次分數、等級、本次弱點（可一鍵練習）、科別雷達圖、累計弱點科別、近 10 次正確率趨勢
- **操作**：桌機鍵盤作答（A–D／1–4、Enter）、手機左右滑動切換題目、附圖點擊放大
- **個人化講義**：錯題整理，可列印／存 PDF
- **筆記本**：每題 Markdown 筆記，支援搜尋、排序、JSON 匯出／匯入
- **成就系統**、**7 種主題配色**、**未完成練習（含模擬考）自動續做**

## 目錄

| 路徑 | 內容 |
|---|---|
| `src/index.html` | 網頁模板（程式、樣式），題庫位置以 `/*@QD*/` 等佔位行標記 |
| `data/questions.json` | 題目（一行一題）：題號、題幹、選項、答案、標籤、年度、科目、出處 |
| `data/explanations.json` | 詳解，以題目 id 為鍵 |
| `data/topics.json` | 各科別的子主題與對應題目 id（`qids`） |
| `data/topic_intros.json` | 子主題介紹文字 |
| `data/images/<id>.jpg` | 題目附圖，建置時內嵌為 data URI |
| `tools/build.py` | 組出 `index.html`（`--check` 只檢查是否為最新） |
| `tools/validate.py` | 題庫一致性檢查 |
| `tools/refresh_topics.py` | 依 `qids` 重算考點的題數、星等、年份 |

## 修改流程

1. 編輯 `src/` 或 `data/`（不要直接改 `index.html`）
2. 改到題目或考點時執行 `python3 tools/refresh_topics.py`
3. `python3 tools/validate.py`
4. `python3 tools/build.py`
5. 一併 commit `data/`、`src/` 與 `index.html`

每次 push 與 PR 都會由 GitHub Actions（`.github/workflows/validate.yml`）執行驗證，並檢查 `index.html` 是否已重新建置。

## 詳解格式

```
### 【核心考點】
### 【解析推理】
### 【選項分析】
(A) → ✅ 理由          ← ✅ 只標在本題應選的選項（否定型題目也一樣；送分題四個都標）
(B) 選項摘要 → ❌ 理由   ← 箭頭前可附選項摘要
### 【高頻連結】
### 【記憶筆記】
```

## 技術文件

| 文件 | 給誰看 / 內容 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系統架構、畫面流程、核心演算法、函式索引 |
| [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) | 題庫資料集的 schema、`localStorage` 鍵值與結構 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 開發流程、更新題庫／詳解、新增主題、外部依賴、部署 |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | 已知 bug、技術債、資料品質問題與建議修法 |
