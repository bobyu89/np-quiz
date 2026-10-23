#!/usr/bin/env python3
"""從衛福部公告的試題與標準答案 PDF 匯入新年度試卷。

流程：
  python3 tools/import_exam.py fetch <公告頁網址>   下載試題、標準答案、疑義說明 PDF 到 exam_work/<年度>/
  python3 tools/import_exam.py import <年度>        解析題目、核對答案、裁切附圖，寫入 data/，並產生待補清單
  （依 docs/EXPLANATION_GUIDE.md 補詳解，存成 exam_work/<年度>/done*.json）
  python3 tools/import_exam.py apply <年度>         合併詳解、標籤、考點，重算考點統計並驗證
  python3 tools/import_exam.py verify <年度>        以官方 PDF 核對既有題目的答案與文字（疑義更正後使用）

公告頁網址範例：https://dep.mohw.gov.tw/DONAHC/cp-1044-87727-104.html
（專科護理師甄審列表：https://dep.mohw.gov.tw/DONAHC/lp-1044-104.html）

需要：curl、poppler-utils（pdftotext、pdftoppm）、ImageMagick（convert）。
"""
import argparse
import difflib
import glob
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
WORK = ROOT / 'exam_work'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import refresh_topics  # noqa: E402
import validate  # noqa: E402

QUESTIONS_PER_EXAM = 80
EXAMS = {'tl': '通論', 'med': '進階內科', 'surg': '進階外科'}
FIGURE_REF = re.compile(r'如圖|附圖|圖\s*[(（]\s*[一二三四五六七八九十\d]+\s*[)）]|下圖|圖示|心電圖如|X\s*光如')
CAPTION = re.compile(r'\s*(甲\s*乙\s*)?圖\s*[(（]\s*.\s*[)）]\s*$')
IMAGE_WIDTH = 760
DPI = 150

# 頁首頁尾：科別、科目、頁碼、浮水印、【以下空白】
_KE = r'(?:內科|外科|兒科|精神科|婦產科|家庭科|麻醉科|一般內科組|一般外科組)'
HEADER = (r'共\s*\d+\s*頁|第\s*\d+\s*頁(?:\s*[，,]?\s*共\s*\d+\s*頁)?|【以下空白】|公告試題|試題公告|僅供參考|'
          r'(?:' + _KE + r'(?:、' + _KE + r')*\s+)?(?:專科護理通論|進階專科護理)(?:\s*\(共同\))?|'
          + _KE + r'(?:、' + _KE + r')*|\d+\s*/\s*\d+')


def die(msg):
    sys.exit(f'錯誤：{msg}')


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def need_tools(*names):
    missing = [n for n in names if not shutil.which(n)]
    if missing:
        die('找不到 ' + '、'.join(missing) + '（請安裝 curl、poppler-utils、ImageMagick）')


# ── 資料檔讀寫（維持 build.py 拆分時的格式） ──

def load_json(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def save_questions(qd):
    body = ',\n'.join(json.dumps(q, ensure_ascii=False) for q in qd['questions'])
    (DATA / 'questions.json').write_text('{"version": %s, "questions": [\n%s\n]}\n' % (json.dumps(qd['version']), body),
                                         encoding='utf-8')


def save_explanations(exp):
    items = sorted(exp.items(), key=lambda kv: int(kv[0]))
    (DATA / 'explanations.json').write_text(
        '{\n' + ',\n'.join(f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in items) + '\n}\n',
        encoding='utf-8')


def save_topics(topics):
    (DATA / 'topics.json').write_text(json.dumps(topics, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


# ── 下載 ──

def classify(title):
    """依附件標題判斷是哪一份試卷；不需要的科別回傳 None。"""
    if '麻醉' in title:
        return None
    if '專科護理通論' in title:
        return 'tl'
    if '進階專科護理' in title:
        if re.search(r'_內科|一般內科組', title):
            return 'med'
        if re.search(r'_外科|一般外科組', title):
            return 'surg'
    return None


def cmd_fetch(args):
    need_tools('curl')
    page = run('curl', '-sSL', '-A', 'Mozilla/5.0', args.url)
    links = [(m.group(1), html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip())
             for m in re.finditer(r'<a[^>]+href="([^"]*dl-[^"]*)"[^>]*>(.*?)</a>', page, re.S)]
    if not links:
        die('公告頁中找不到附件連結，請確認網址是「試題、標準答案及試題疑義說明」的公告頁')
    # 109–111 年的標題沒有「年」字，例如「【試題】110專科護理通論.pdf」
    years = {int(m.group(1)) for _, t in links if classify(t)
             for m in [re.search(r'(?<!\d)(1\d{2})(?=\s*年|專科|進階)', t)] if m}
    if len(years) != 1:
        die(f'無法判斷年度（附件標題中出現 {sorted(years)}）')
    year = years.pop()
    out = WORK / str(year)
    out.mkdir(parents=True, exist_ok=True)

    manifest, objections = {}, []
    for url, title in links:
        if '疑義' in title:
            objections.append(title)
            if classify(title.replace('-', '_')):
                run('curl', '-sSL', '-A', 'Mozilla/5.0', '-o', str(out / f'objection_{len(objections)}.pdf'), url)
            continue
        key = classify(title)
        kind = 'q' if re.search(r'【(公告)?試題】', title) else 'a' if '【標準答案】' in title else None
        if not key or not kind:
            continue
        run('curl', '-sSL', '-A', 'Mozilla/5.0', '-o', str(out / f'{kind}_{key}.pdf'), url)
        entry = manifest.setdefault(key, {'exam_type': EXAMS[key]})
        entry['source' if kind == 'q' else 'answer_source'] = title
    missing = [f'{EXAMS[k]}{"試題" if f == "source" else "標準答案"}'
               for k in EXAMS for f in ('source', 'answer_source') if f not in manifest.get(k, {})]
    if missing:
        die('公告中缺少：' + '、'.join(missing))
    (out / 'manifest.json').write_text(json.dumps({'year': year, 'url': args.url, 'exams': manifest,
                                                   'objections': objections}, ensure_ascii=False, indent=1),
                                       encoding='utf-8')
    print(f'已下載 {year} 年度試卷到 {out.relative_to(ROOT)}/')
    for k, e in manifest.items():
        print(f'  {e["exam_type"]}：{e["source"]}')
    if objections:
        print('疑義說明（請確認標準答案 PDF 是否已反映更正）：')
        for t in objections:
            print('  ' + t)


# ── PDF 解析 ──

def _answer_value(v):
    v = re.sub(r'[\s、,]', '', v)
    return v if v == '送分' else '、'.join(v)


def parse_answers(pdf):
    """標準答案表：題號與答案同列（110 年起），或題號一列、答案一列（109 年）。"""
    text = run('pdftotext', '-layout', str(pdf), '-')
    pattern = r'[A-D](?:\s*[、,]\s*[A-D])+|[A-D]{1,4}|送分'
    out = {}
    lines = [ln for ln in text.split('\n') if ln.strip()]
    for a, b in zip(lines, lines[1:]):
        nums = a.split()
        if len(nums) >= 5 and all(x.isdigit() for x in nums):
            vals = re.findall(pattern, b)
            if len(vals) == len(nums):
                out.update({int(n): _answer_value(v) for n, v in zip(nums, vals)})
    if len(out) < QUESTIONS_PER_EXAM:
        for n, v in re.findall(r'(?<![\d.])(\d{1,2})\s+(' + pattern + r')(?=\s|$)', text):
            out.setdefault(int(n), _answer_value(v))
    return out


def _join(s):
    """合併斷行：中文直接相連，英數之間補空格。"""
    out = ''
    for x in (ln.strip() for ln in s.split('\n')):
        if not x:
            continue
        if out and re.match(r'[A-Za-z0-9(]', x) and re.search(r'[A-Za-z0-9,.)]$', out):
            out += ' '
        out += x
    return CAPTION.sub('', re.sub(r'  +', ' ', out).strip())


def _split_questions(text):
    parts = re.split(r'^(\d{1,2})\s*[.、．]\s*', text, flags=re.M)
    chunks, expect = [], 1
    for i in range(1, len(parts), 2):
        n, body = int(parts[i]), parts[i + 1]
        if n == expect:
            chunks.append([n, body])
            expect += 1
        elif chunks:                       # 題幹中的編號（如「3. 」）併回上一題
            chunks[-1][1] += f'\n{n}. ' + body
    out = {}
    for n, body in chunks:
        pieces = re.split(r'\(\s*([A-D])\s*\)\s*', body.split('【以下空白】')[0])
        opts = {}
        for k in range(1, len(pieces), 2):
            opts[pieces[k]] = opts.get(pieces[k], '') + pieces[k + 1]
        out[n] = {'question': _join(pieces[0]), 'options': {k: _join(v) for k, v in sorted(opts.items())}}
    return out


def parse_questions(pdf):
    text = run('pdftotext', '-layout', str(pdf), '-').replace('\f', '\n')
    lines = []
    for ln in text.split('\n'):
        ln = re.sub(r'(?:^|(?<=\s\s))(?:' + HEADER + r')(?=\s\s|\s*$)', ' ', ln).replace('ˉ', '').strip()
        if ln and ln != '•':
            lines.append(ln)
    text = '\n'.join(lines)
    # 封面注意事項也有 1.–7. 編號：取能連續切出最多題的起點（同數量取較後者）
    best = {}
    for m in re.finditer(r'^1\s*[.、．]\s*\S', text, re.M):
        cand = _split_questions(text[m.start():])
        if len(cand) >= len(best):
            best = cand
    return best


# ── 附圖裁切 ──

def _bbox_lines(pdf):
    xml = run('pdftotext', '-bbox-layout', str(pdf), '-')
    lines = []
    for pi, (w, h, body) in enumerate(re.findall(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', xml, re.S)):
        for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', body, re.S):
            t = ''.join(re.findall(r'>([^<]*)</word>', m.group(5))).replace('ˉ', '')
            if t.strip():
                header = bool(re.fullmatch(r'(?:' + HEADER + r'|[，, ]|入場證號碼.*)+', t))
                lines.append(dict(p=pi + 1, y0=float(m.group(2)), y1=float(m.group(4)), t=t, header=header,
                                  W=float(w), H=float(h)))
    lines.sort(key=lambda ln: (ln['p'], ln['y0']))
    return lines


def _find_start(lines, n, stem):
    key = re.sub(r'[\s()（）]', '', stem)[:4]
    for i, ln in enumerate(lines):
        m = re.match(rf'^{n}\s*[.、．](.*)', ln['t'])
        if m and key in re.sub(r'[\s()（）]', '', m.group(1) + ''.join(x['t'] for x in lines[i + 1:i + 2])):
            return i
    raise LookupError(n)


def figure_regions(lines, n, stem, next_stem):
    """回傳要裁切的 (頁, y0, y1) 清單。

    題幹與 (A) 之間有明顯空白時只裁那塊圖；圖在選項旁或選項本身是圖時，裁題幹結束到下一題開始。
    """
    s = _find_start(lines, n, stem)
    try:
        e = _find_start(lines, n + 1, next_stem)
    except LookupError:
        e = len(lines)
    body = [ln for ln in lines[s:e] if not ln['header']]
    ia = next((i for i, ln in enumerate(body) if ln['t'].lstrip().startswith('(A)')), None)
    seq = (body[:ia] if ia else body) + ([body[ia]] if ia is not None else [])
    best = None
    for a, b in zip(seq, seq[1:]):
        if a['p'] == b['p']:
            gaps = [(b['y0'] - a['y1'], a['p'], a['y1'], b['y0'])]
        else:                              # 跨頁：圖可能在上一頁底部或下一頁頂部
            gaps = [(a['H'] - 60 - a['y1'], a['p'], a['y1'], a['H'] - 60), (b['y0'] - 70, b['p'], 70, b['y0'])]
        for g in gaps:
            if best is None or g[0] > best[0]:
                best = g
    if ia is not None and best and best[0] > 40:
        _, p, y0, y1 = best
        captions = [ln['y1'] for ln in body if ln['p'] == p and y0 < ln['y0'] < y1 + 25 and re.match(r'^\s*[甲乙]?\s*圖', ln['t'])]
        return [(p, y0 + 1, max([y1] + captions) + 2)]
    stem_end = max(i for i, ln in enumerate(body)
                   if i < (ia if ia is not None else len(body)) and not re.match(r'^\s*[甲乙]?\s*圖', ln['t']))
    first, end = body[stem_end], (lines[e] if e < len(lines) else None)
    regions = []
    for p in range(first['p'], (end['p'] if end else first['p']) + 1):
        y0 = first['y1'] + 1 if p == first['p'] else 60
        y1 = end['y0'] - 2 if end and p == end['p'] else max(
            [ln['y1'] for ln in lines if ln['p'] == p and not ln['header']] + [y0 + 1]) + 2
        if y1 - y0 > 15:
            regions.append((p, y0, y1))
    return regions


def render_figure(pdf, regions, width, out_jpg):
    sc = DPI / 72
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for k, (p, y0, y1) in enumerate(regions):
            base = f'{tmp}/part{k}'
            run('pdftoppm', '-f', str(p), '-l', str(p), '-r', str(DPI), '-x', str(int(30 * sc)), '-y', str(int(y0 * sc)),
                '-W', str(int((width - 60) * sc)), '-H', str(int((y1 - y0) * sc)), '-png', '-singlefile', str(pdf), base)
            parts.append(base + '.png')
        run('convert', *parts, '-append', '-trim', '+repage', '-bordercolor', 'white', '-border', '8',
            '-resize', f'{IMAGE_WIDTH}x>', '-quality', '72', '-strip', str(out_jpg))


# ── 匯入 ──

def load_exam(year):
    work = WORK / str(year)
    mf = work / 'manifest.json'
    if not mf.exists():
        die(f'找不到 {mf.relative_to(ROOT)}，請先執行 fetch')
    manifest = json.loads(mf.read_text(encoding='utf-8'))
    exams = {}
    for key, info in manifest['exams'].items():
        qs, ans = parse_questions(work / f'q_{key}.pdf'), parse_answers(work / f'a_{key}.pdf')
        want = list(range(1, QUESTIONS_PER_EXAM + 1))
        if sorted(qs) != want:
            die(f'{info["exam_type"]}試題解析結果缺題號 {sorted(set(want) - set(qs))}')
        if sorted(ans) != want:
            die(f'{info["exam_type"]}標準答案缺題號 {sorted(set(want) - set(ans))}')
        exams[key] = {**info, 'questions': qs, 'answers': ans, 'pdf': work / f'q_{key}.pdf'}
    return manifest, exams


def needs_figure(q):
    return bool(FIGURE_REF.search(q['question'])) or any(not q['options'].get(l) for l in 'ABCD')


def same_question(a, b):
    norm = lambda q: re.sub(r'\s', '', q['question'] + ''.join(q['options'].get(l, '') for l in 'ABCD'))
    return norm(a) == norm(b)


def cmd_import(args):
    need_tools('pdftotext', 'pdftoppm', 'convert')
    year = args.year
    manifest, exams = load_exam(year)
    qd = load_json('questions.json')
    have = {(q['year'], q['exam_type']) for q in qd['questions']}
    dup = [e['exam_type'] for e in exams.values() if (year, e['exam_type']) in have]
    if dup:
        die(f'{year} 年 {"、".join(dup)} 已在題庫中；如需核對請用 verify')

    next_id = max(q['id'] for q in qd['questions']) + 1
    new, todo, figures = [], [], 0
    by_key = {}
    for key in EXAMS:
        e = exams[key]
        for n in range(1, QUESTIONS_PER_EXAM + 1):
            p = e['questions'][n]
            q = {'number': n, 'question': p['question'],
                 'options': {l: p['options'].get(l, '').strip() or f'見圖（{l}）' for l in 'ABCD'},
                 'answer': e['answers'][n], 'tags': [], 'id': next_id, 'year': year,
                 'exam_type': e['exam_type'], 'source': e['source']}
            if needs_figure(p):
                lines = _bbox_lines(e['pdf']) if 'lines' not in e else e['lines']
                e['lines'] = lines
                nxt = e['questions'].get(n + 1, {'question': ''})['question']
                render_figure(e['pdf'], figure_regions(lines, n, p['question'], nxt), lines[0]['W'],
                              DATA / 'images' / f'{next_id}.jpg')
                figures += 1
            new.append(q)
            by_key[(key, n)] = q
            next_id += 1

    # 內外科共同題：外科沿用內科的標籤與詳解
    for n in range(1, QUESTIONS_PER_EXAM + 1):
        if same_question(by_key[('med', n)], by_key[('surg', n)]):
            by_key[('surg', n)]['_shared_with'] = by_key[('med', n)]['id']
    for q in new:
        if '_shared_with' in q:
            continue
        item = {k: q[k] for k in ('id', 'exam_type', 'number', 'question', 'options', 'answer')}
        img = DATA / 'images' / f'{q["id"]}.jpg'
        if img.exists():
            item['image_file'] = str(img.relative_to(ROOT))
        todo.append(item)
    shared = {str(q['id']): q.pop('_shared_with') for q in new if '_shared_with' in q}

    qd['questions'].extend(new)
    save_questions(qd)
    work = WORK / str(year)
    (work / 'todo.json').write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding='utf-8')
    (work / 'shared.json').write_text(json.dumps(shared, indent=1), encoding='utf-8')
    print(f'已匯入 {year} 年度 {len(new)} 題（id {new[0]["id"]}–{new[-1]["id"]}），附圖 {figures} 張，'
          f'內外科共同題 {len(shared)} 題')
    print(f'請檢查 data/images/ 的新附圖，並依 docs/EXPLANATION_GUIDE.md 為 {(work / "todo.json").relative_to(ROOT)} '
          f'的 {len(todo)} 題補上詳解，存成 {work.relative_to(ROOT)}/done*.json 後執行：')
    print(f'  python3 tools/import_exam.py apply {year}')


# ── 合併詳解 ──

def cmd_apply(args):
    work = WORK / str(args.year)
    files = sorted(glob.glob(str(work / 'done*.json')))
    if not files:
        die(f'找不到 {work.relative_to(ROOT)}/done*.json')
    done = {}
    for f in files:
        done.update({int(k): v for k, v in json.loads(Path(f).read_text(encoding='utf-8')).items()})
    shared = {int(k): v for k, v in json.loads((work / 'shared.json').read_text(encoding='utf-8')).items()} \
        if (work / 'shared.json').exists() else {}
    for qid, src in shared.items():
        if src in done:
            done.setdefault(qid, done[src])

    qd, exp, topics = load_json('questions.json'), load_json('explanations.json'), load_json('topics.json')
    targets = [q for q in qd['questions'] if q['year'] == args.year]
    missing = [q['id'] for q in targets if q['id'] not in done and str(q['id']) not in exp]
    if missing:
        die(f'尚有 {len(missing)} 題沒有詳解：{missing[:20]}{"…" if len(missing) > 20 else ""}')
    errors = []
    for q in targets:
        m = done.get(q['id'])
        if not m:
            continue
        tags, tmap = m.get('tags', []), m.get('topics', {})
        if not tags or not set(tags) <= validate.TAGS or set(tmap) != set(tags):
            errors.append(f'{q["id"]}：tags 或 topics 不符規範')
            continue
        bad = [f'{t}/{s}' for t, s in tmap.items() if s not in topics[t]]
        if bad:
            errors.append(f'{q["id"]}：考點不存在 {bad}')
            continue
        for sub in topics.values():          # 重新套用時先移除舊的考點對應
            for t in sub.values():
                if q['id'] in t['qids']:
                    t['qids'].remove(q['id'])
        q['tags'] = tags
        for t, s in tmap.items():
            topics[t][s]['qids'].append(q['id'])
        exp[str(q['id'])] = m['explanation']
    if errors:
        die('\n' + '\n'.join(errors))
    save_questions(qd)
    save_explanations(exp)
    save_topics(topics)
    refresh_topics.main()
    validate.main()
    print('完成。接著執行 python3 tools/build.py，並一併 commit data/ 與 index.html')


# ── 核對既有題目 ──

def cmd_verify(args):
    need_tools('pdftotext')
    _, exams = load_exam(args.year)
    qs = load_json('questions.json')['questions']
    norm = lambda s: re.sub(r'[\s()（）,，.。、:：;；\-]', '', s)
    problems = 0
    for key, e in exams.items():
        db = {q['number']: q for q in qs if q['year'] == args.year and q['exam_type'] == e['exam_type']}
        if not db:
            print(f'{e["exam_type"]}：題庫中沒有此試卷')
            continue
        for n in range(1, QUESTIONS_PER_EXAM + 1):
            q, p = db.get(n), e['questions'][n]
            if not q:
                print(f'{e["exam_type"]} 第 {n} 題：題庫缺題')
                problems += 1
                continue
            if q['answer'] != e['answers'][n]:
                print(f'{e["exam_type"]} 第 {n} 題（id {q["id"]}）：答案 {q["answer"]} → 官方 {e["answers"][n]}')
                problems += 1
            text = lambda x: norm(x['question'] + ''.join(x['options'].get(l, '') for l in 'ABCD'))
            ratio = difflib.SequenceMatcher(None, text(q), text(p)).ratio()
            if ratio < args.threshold and not needs_figure(p):
                print(f'{e["exam_type"]} 第 {n} 題（id {q["id"]}）：文字相似度 {ratio:.2f}')
                problems += 1
    print(f'核對完成，{problems} 個差異' if problems else '核對完成：答案與文字皆與官方 PDF 一致')
    sys.exit(1 if problems else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('fetch', help='下載公告頁中的試題與標準答案 PDF')
    p.add_argument('url')
    p.set_defaults(func=cmd_fetch)
    p = sub.add_parser('import', help='解析並寫入新年度試卷')
    p.add_argument('year', type=int)
    p.set_defaults(func=cmd_import)
    p = sub.add_parser('apply', help='合併補好的詳解、標籤與考點')
    p.add_argument('year', type=int)
    p.set_defaults(func=cmd_apply)
    p = sub.add_parser('verify', help='以官方 PDF 核對既有題目')
    p.add_argument('year', type=int)
    p.add_argument('--threshold', type=float, default=0.9, help='文字相似度低於此值時列出（預設 0.9）')
    p.set_defaults(func=cmd_verify)
    args = ap.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
