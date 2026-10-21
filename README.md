# 專科護理師冒險記 ⚔️

專科護理師甄審筆試刷題網頁。`index.html` 是可以直接開啟的單一檔案（不需要伺服器），由 `src/` 模板加上 `data/` 題庫建置而成。

## 目錄

| 路徑 | 內容 |
|---|---|
| `src/index.html` | 網頁模板（程式、樣式），題庫位置以 `/*@QD*/` 等佔位行標記 |
| `data/questions.json` | 題目（一行一題）：題號、題幹、選項、答案、標籤、年度、科目、出處 |
| `data/explanations.json` | 詳解，以題目 id 為鍵 |
| `data/topics.json` | 各科別的子主題與對應題目 id（`qids`） |
| `data/topic_intros.json` | 子主題介紹文字 |
| `data/images/<id>.jpg` | 題目附圖（ECG、X 光等），建置時內嵌為 data URI |
| `tools/build.py` | 組出 `index.html` |
| `tools/validate.py` | 題庫一致性檢查 |

## 修改流程

1. 編輯 `src/` 或 `data/`（不要直接改 `index.html`）
2. `python3 tools/validate.py`
3. `python3 tools/build.py`
4. 一併 commit `data/`、`src/` 與 `index.html`

## 詳解格式

```
### 【核心考點】
### 【解析推理】
### 【選項分析】
(A) → ✅ 理由      ← ✅ 只標在本題應選的選項（否定型題目也一樣）
(B) → ❌ 理由
### 【高頻連結】
### 【記憶筆記】
```
