#!/usr/bin/env python3
"""把 src/index.html 模板與 data/ 題庫組成可直接開啟的單一 index.html。

用法：python3 tools/build.py          # 重新產生 index.html
      python3 tools/build.py --check  # 只檢查 index.html 是否為最新（CI 用）
"""
import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
TEMPLATE = ROOT / 'src' / 'index.html'
OUT = ROOT / 'index.html'

# 模板中的佔位行 → (全域變數, 資料檔)
SLOTS = {
    '/*@QD*/': ('window.__QD', 'questions.json'),
    '/*@EXP*/': ('window.__EXP', 'explanations.json'),
    '/*@TOPICS*/': ('window.__TOPICS', 'topics.json'),
    '/*@TOPIC_INTROS*/': ('window.__TOPIC_INTROS', 'topic_intros.json'),
}


def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))


def questions_payload():
    qd = load('questions.json')
    for q in qd['questions']:
        img = DATA / 'images' / f"{q['id']}.jpg"
        if img.exists():
            q['image'] = 'data:image/jpeg;base64,' + base64.b64encode(img.read_bytes()).decode()
    return {'version': qd['version'], 'total': len(qd['questions']), 'questions': qd['questions']}


def render():
    lines = TEMPLATE.read_text(encoding='utf-8').split('\n')
    for i, line in enumerate(lines):
        if line in SLOTS:
            var, name = SLOTS[line]
            obj = questions_payload() if name == 'questions.json' else load(name)
            lines[i] = f'{var}=' + json.dumps(obj, ensure_ascii=False) + ';'
    return '\n'.join(lines)


def main():
    html = render()
    if '--check' in sys.argv:
        if OUT.read_text(encoding='utf-8') != html:
            sys.exit('index.html 不是最新版，請執行 python3 tools/build.py')
        print('index.html 為最新版')
        return
    OUT.write_text(html, encoding='utf-8')
    print(f'已產生 {OUT.name}（{len(html.encode()) / 1e6:.1f} MB）')


if __name__ == '__main__':
    main()
