#!/usr/bin/env python3
"""檢查 data/ 題庫的一致性。有錯誤時以非零狀態結束。

用法：python3 tools/validate.py
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

TAGS = {'消化系統', '藥理用藥', '呼吸系統', '心臟血管', '神經系統', '評估診斷', '血液腫瘤', '感染免疫', '外科周手術',
        '內分泌代謝', '護理通論', '骨骼肌肉', '腎臟泌尿', '重症加護', '法規倫理', '婦產科', '精神科', '兒科'}
EXAM_TYPES = {'通論', '進階內科', '進階外科'}
QUESTIONS_PER_EXAM = 80
OPTION_LINE = re.compile(r'^\(([A-D])\).*?→\s*(✅|❌)', re.M)
FIGURE_REF = re.compile(r'如圖|圖\s*[(（]\s*[一二三四五六七八九十\d]+\s*[)）]')
JUNK = re.compile(r'ˉ|  ')

errors = []


def err(qid, msg):
    errors.append(f'[{qid}] {msg}')


def answer_letters(ans):
    return list('ABCD') if ans == '送分' else ans.split('、')


def main():
    qs = json.loads((DATA / 'questions.json').read_text(encoding='utf-8'))['questions']
    exp = json.loads((DATA / 'explanations.json').read_text(encoding='utf-8'))
    topics = json.loads((DATA / 'topics.json').read_text(encoding='utf-8'))
    by_id = {}
    by_exam = defaultdict(list)

    for q in qs:
        qid = q['id']
        if qid in by_id:
            err(qid, '重複 id')
        by_id[qid] = q
        by_exam[q['source']].append(q['number'])
        if q['exam_type'] not in EXAM_TYPES:
            err(qid, f"未知 exam_type：{q['exam_type']}")
        if sorted(q['options']) != ['A', 'B', 'C', 'D'] or not all(v.strip() for v in q['options'].values()):
            err(qid, '選項不是完整的 A–D')
        letters = answer_letters(q['answer'])
        if not set(letters) <= set(q['options']):
            err(qid, f"答案格式錯誤：{q['answer']}")
        if not q['tags'] or not set(q['tags']) <= TAGS:
            err(qid, f"標籤錯誤：{q['tags']}")
        text = q['question'] + ''.join(q['options'].values())
        if JUNK.search(text):
            err(qid, '題目或選項含排版殘留字元或連續空白')
        if FIGURE_REF.search(q['question']) and not (DATA / 'images' / f'{qid}.jpg').exists():
            err(qid, '題目引用附圖但缺少 data/images 圖檔')

        e = exp.get(str(qid))
        if not e:
            err(qid, '缺少詳解')
            continue
        marks = dict(OPTION_LINE.findall(e))
        if sorted(marks) != ['A', 'B', 'C', 'D']:
            err(qid, '詳解【選項分析】缺少 (A)–(D) 四行 ✅/❌ 標示')
        elif sorted(k for k, v in marks.items() if v == '✅') != sorted(letters):
            err(qid, '詳解 ✅ 與答案不一致')

    for source, numbers in by_exam.items():
        if sorted(numbers) != list(range(1, QUESTIONS_PER_EXAM + 1)):
            missing = sorted(set(range(1, QUESTIONS_PER_EXAM + 1)) - set(numbers))
            extra = sorted(n for n in set(numbers) if numbers.count(n) > 1 or not 1 <= n <= QUESTIONS_PER_EXAM)
            err(source, f'題號不完整，缺 {missing}，重複或超出 {extra}')

    for k in exp:
        if int(k) not in by_id:
            err(k, '詳解對應的題目不存在')

    for tag, subs in topics.items():
        for name, t in subs.items():
            for qid in t['qids']:
                if qid not in by_id:
                    err(qid, f'主題 {tag}/{name} 引用不存在的題目')
                elif tag not in by_id[qid]['tags']:
                    err(qid, f'主題 {tag}/{name} 的科別不在題目標籤中')
            if t['count'] != len(t['qids']):
                err(f'{tag}/{name}', 'count 與 qids 數量不符')

    if errors:
        print('\n'.join(errors))
        sys.exit(f'\n共 {len(errors)} 個問題')
    print(f'題庫檢查通過：{len(qs)} 題')


if __name__ == '__main__':
    main()
