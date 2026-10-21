#!/usr/bin/env python3
"""依 data/topics.json 的 qids 重新計算各子主題的 count、stars、years，
並同步 data/topic_intros.json 摘要中「（N星，N題）」之類的數字。

用法：python3 tools/refresh_topics.py
"""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'


def stars(count):
    return 5 if count >= 15 else 4 if count >= 8 else 3 if count >= 4 else 2 if count >= 2 else 1


def main():
    qs = json.loads((DATA / 'questions.json').read_text(encoding='utf-8'))['questions']
    year = {q['id']: q['year'] for q in qs}
    topics = json.loads((DATA / 'topics.json').read_text(encoding='utf-8'))
    intros = json.loads((DATA / 'topic_intros.json').read_text(encoding='utf-8'))

    for tag, subs in topics.items():
        for name, t in subs.items():
            t['qids'] = sorted(set(t['qids']))
            t['count'] = len(t['qids'])
            t['stars'] = stars(t['count'])
            t['years'] = sorted({year[i] for i in t['qids']})
            intro = intros.get(tag, {}).get(name)
            if intro and intro.get('summary'):
                s = re.sub(r'\d+(\s*星)', lambda m: f"{t['stars']}{m.group(1)}", intro['summary'])
                intro['summary'] = re.sub(r'([（(、，])\d+(\s*題)', lambda m: f"{m.group(1)}{t['count']}{m.group(2)}", s)

    (DATA / 'topics.json').write_text(json.dumps(topics, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (DATA / 'topic_intros.json').write_text(json.dumps(intros, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('已更新主題統計')


if __name__ == '__main__':
    main()
