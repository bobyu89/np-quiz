# 開發指南

## 1. 環境與執行

不需要 Node、npm 或任何建置工具。

```bash
# 直接開檔（題庫已內嵌，file:// 可正常運作）
open index.html

# 或啟動靜態伺服器（測試 fetch 備援路徑時需要）
python3 -m http.server 8000
```

**編輯注意事項**

- `index.html` 約 5 MB，第 19、25、2574–2577 行為單行數百 KB～2.3 MB。部分編輯器（或 `git diff`）處理這幾行會很慢，建議：
  - VS Code：關閉 minimap、word wrap；或用 `"editor.maxTokenizationLineLength"` 限制語法高亮
  - 搜尋程式碼時排除資料行：`grep -n 'pattern' index.html | cut -c1-200`
- 所有互動都用 inline `onclick="fn()"` 呼叫全域函式。**重新命名函式時要同時搜尋 HTML 字串與 JS 模板字串**。
- 主程式使用 `'use strict'`，擴充區（第 3861 行後）是 ES5 風格（`var`、字串串接），新增程式碼請與所在區塊一致。

## 2. 更新題庫／詳解／考點

產生題庫、詳解、考點分析的離線管線（程式碼提到的 `generate_explanations.py`、`data/questions-embed.js`）**不在此 repo 中**。在管線補進來之前，可用以下兩支腳本在 JSON 與 `index.html` 之間往返。已驗證：抽出後原封不動回嵌，輸出與原檔 byte-identical。

### 2.1 從 `index.html` 抽出資料

```python
# extract.py — 在 repo 根目錄執行：python3 extract.py
import json, pathlib, re
html = pathlib.Path("index.html").read_text(encoding="utf-8")
out = pathlib.Path("data"); out.mkdir(exist_ok=True)
for name in ["__QD", "__EXP", "__TOPICS", "__TOPIC_INTROS"]:
    m = re.search(rf"^window\.{name}=(.*);\s*$", html, re.M)
    obj = json.loads(m.group(1))
    (out / f"{name.strip('_').lower()}.json").write_text(
        json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
```

產出 `data/qd.json`、`data/exp.json`、`data/topics.json`、`data/topic_intros.json`。

### 2.2 把 JSON 寫回 `index.html`

```python
# embed.py — python3 embed.py
import json, pathlib, re
p = pathlib.Path("index.html")
html = p.read_text(encoding="utf-8")
for name in ["__QD", "__EXP", "__TOPICS", "__TOPIC_INTROS"]:
    obj = json.loads(pathlib.Path(f"data/{name.strip('_').lower()}.json").read_text(encoding="utf-8"))
    line = f"window.{name}=" + json.dumps(obj, ensure_ascii=False) + ";"
    html, n = re.subn(rf"^window\.{name}=.*$", lambda _: line, html, count=1, flags=re.M)
    assert n == 1, name
p.write_text(html, encoding="utf-8")
```

> `json.dumps` 的預設分隔符（`", "`、`": "`）與目前內嵌格式一致，因此 diff 只會出現在實際改動的內容。

### 2.3 新增一份試卷的檢查清單

1. `qd.json`：新題 `id` 從目前最大值 +1 接續（**不可重用或重排既有 id**，否則使用者的進度、SRS、筆記會對到錯題）；更新 `total`。
2. `year` 用民國年整數；`exam_type` 只能是 `通論`／`進階內科`／`進階外科`（新增類型前端會自動出現在篩選中）。
3. `tags` 只能用 18 個既有科別；若要新增科別，必須同步修改 `SUBJECT_CATEGORIES`（`index.html:2588`），否則該科在科別選單與考點總覽中不會出現。
4. `answer`：單選 `"A"`；多選 `"A、C"`（**全形頓號**）；送分 `"送分"`。
5. `exp.json`：每個新 id 都要有一筆，沿用 `### 【核心考點】` 等六段格式。
6. `topics.json` / `topic_intros.json`：重新計算 `count`、`stars`、`qids`、`years`；新增考點時兩個檔案的 key 必須一致。
7. 首頁說明文字「根據 1918 題歷屆考題」（`index.html` 中 `screen-topics` 區塊）是寫死的，記得一起改。
8. 執行 2.2 回嵌，並跑 [§6 手動測試](#6-手動測試清單)。

### 2.4 資料驗證腳本（建議在回嵌前執行）

```python
import json
qd = json.load(open("data/qd.json"))["questions"]
exp = json.load(open("data/exp.json"))
topics = json.load(open("data/topics.json"))
intros = json.load(open("data/topic_intros.json"))
TAGS = {"心臟血管","呼吸系統","消化系統","腎臟泌尿","神經系統","內分泌代謝","感染免疫","血液腫瘤",
        "外科周手術","骨骼肌肉","重症加護","婦產科","精神科","兒科","評估診斷","藥理用藥","護理通論","法規倫理"}
ids = [q["id"] for q in qd]
assert len(ids) == len(set(ids)), "id 重複"
for q in qd:
    assert set(q["tags"]) <= TAGS, (q["id"], q["tags"])
    assert q["exam_type"] in {"通論", "進階內科", "進階外科"}, q["id"]
    if q["answer"] != "送分":
        assert all(a in q["options"] for a in q["answer"].split("、")), (q["id"], q["answer"])
    assert str(q["id"]) in exp, f"缺詳解 {q['id']}"
idset = set(ids)
for tag, ts in topics.items():
    for name, t in ts.items():
        assert set(t["qids"]) <= idset, (tag, name)
        assert name in intros.get(tag, {}), f"缺講義 {tag}/{name}"
print("OK")
```

## 3. 常見修改

### 3.1 新增主題配色

1. 在主 `<style>` 末端（`THEME: 深海靜謐` 之後）新增 `body.theme-xxx { ... }`，覆寫 `:root` 的 Design Tokens（`--color-primary-*`、`--color-bg-*`、`--color-text-*`、`--pixel-border-*` 等）。最簡版本只需覆寫變數，參考 `theme-nightnurse`（約 30 行）；完整版本可另外覆寫元件，參考 `theme-forest`。
2. 在 `#theme-menu` 加一顆 `<button onclick="setTheme('theme-xxx')" class="theme-btn" data-theme="theme-xxx">`。
3. 在主題 IIFE 的 `THEMES` 陣列加上 `'theme-xxx'`（否則切換時舊 class 不會被移除）。

### 3.2 新增成就

1. `ACHIEVEMENTS`（`index.html:2619`）新增 `key: { icon, name, desc }`。
2. 在 `checkAchievements()`（`:3683`）中加入解鎖條件 `unlock('key')`。成就廳與首頁計數會自動更新。

> 目前 `first_time_ace`、`comeback`、`all_subjects` 已定義但沒有解鎖邏輯。

### 3.3 調整計時、SRS 間隔、題數

| 參數 | 位置 |
|---|---|
| 每題秒數 `60` | `State.timeLeft` 初值、`startTimer()`、`updateTimerBar()`、`selectAnswer()`、`timeUp()`、`skipQuestion()` 與 HUD `<span id="timer-num">60</span>` 多處寫死；建議先抽成常數 |
| SRS 間隔 | `SRS_INTERVALS`（`:2761`） |
| 題數選項 | `screen-mode` 中的 `.count-btn`（30/40/50/全部） |
| 等級門檻 | `getRank()`（`:3557`） |
| 紀錄保留筆數 | `endSession()` 中 `sessions.length > 20` |

### 3.4 Design Tokens

定義在 `:root`（`index.html:100` 起），主要分組：

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

新程式碼請用 `--color-*`，**不要用 `--clr-*`**（未定義，見 KNOWN_ISSUES）。

## 4. 外部依賴

| 套件 | 版本 | 授權 | 嵌入位置 | 用途 |
|---|---|---|---|---|
| Chart.js | 4.4.0 | MIT | 第 7–27 行 | 雷達圖、趨勢折線圖 |
| marked | 15.0.7 | MIT | 第 28–34 行 | 詳解、筆記、考點表格的 Markdown 渲染 |
| Press Start 2P | — | OFL | 第 36–94 行（base64） | 像素字型（僅拉丁字元） |
| Share Tech Mono | — | OFL | 同上 | 等寬字型 |
| Noto Sans TC | — | OFL | **未內嵌**，依賴系統字型（fallback `PingFang TC`） | 中文內文 |

升級函式庫：以新版的 UMD 壓縮檔取代對應 `<script>` 區塊即可。marked 升級需確認 `marked.parse()` 仍為同步 API。

**網路連線**：唯一的外部請求是使用者自行設定 API Key 後呼叫 `https://api.anthropic.com/v1/messages`。目前內嵌詳解已涵蓋全部題目，因此實務上完全離線。

## 5. 部署

純靜態單檔，複製 `index.html` 到任一靜態主機即可：

- **GitHub Pages**：Settings → Pages → Deploy from branch → `main` / root。repo 目前沒有 CI workflow。
- **其他**：Netlify / Vercel / S3 / Nginx，無需任何 rewrite 規則。

建議伺服器開啟 gzip/brotli：內容大多是 JSON 與中文文字，壓縮後傳輸量會明顯下降。

**資料遷移**：使用者資料綁定 origin（網域 + 協定 + port）。更換網域、或從 `file://` 改成 `https://`，使用者會看到全新的空進度；目前只有筆記能匯出／匯入。

## 6. 手動測試清單

專案沒有自動化測試。每次修改後至少走過：

- [ ] 首頁統計正確顯示題庫數、累計答題、正確率、成就數
- [ ] 五種模式各開一次練習；篩選條件為空時不報錯；無題目時出現提示
- [ ] 答對／答錯／超時／跳過：顏色回饋、streak、詳解面板正確
- [ ] 多選答案題（例如 `answer: "C、D"`）與 `送分` 題的判分
- [ ] 延後詳解模式：結束後自動切到「詳解查閱」分頁
- [ ] 作答中重新整理頁面 → 出現續做提示並回到正確題號
- [ ] 結果頁雷達圖、弱點科別、講義生成與列印預覽
- [ ] 考點總覽 → 科別 → 展開講義（含 Markdown 表格）→ 練習這個考點
- [ ] 筆記新增／編輯／刪除、搜尋、排序、匯出、匯入
- [ ] 7 種主題切換並重新整理後保留
- [ ] 手機寬度（≤480px）版面無水平捲動
- [ ] DevTools Console 無錯誤
