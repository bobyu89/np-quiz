#!/usr/bin/env python3
"""把 src/ 的模板、樣式、程式與 data/ 題庫組成可直接開啟的單一 index.html。

用法：python3 tools/build.py                 # 重新產生 index.html（附圖連到 data/images/）
      python3 tools/build.py --check         # 只檢查 index.html 是否為最新（CI 用）
      python3 tools/build.py --embed-images [輸出檔]   # 附圖內嵌的單一離線檔（預設 np-quiz-offline.html，不進版控）
"""
import base64
import json
import re
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


def questions_payload(embed_images):
    qd = load('questions.json')
    for q in qd['questions']:
        img = DATA / 'images' / f"{q['id']}.jpg"
        if img.exists():
            # 預設連到獨立圖檔，出現有圖的題目時才下載；--embed-images 則內嵌成單一離線檔
            q['image'] = ('data:image/jpeg;base64,' + base64.b64encode(img.read_bytes()).decode()
                          if embed_images else img.relative_to(ROOT).as_posix())
    return {'version': qd['version'], 'total': len(qd['questions']), 'questions': qd['questions']}


INCLUDE = re.compile(r'/\*#include ([\w./-]+)\*/|<!--#include ([\w./-]+)-->')


def expand(text):
    """展開 /*#include 檔案*/ 與 <!--#include 檔案-->；vendor/ 相對於專案根目錄，其餘相對於 src/。"""
    def sub(m):
        name = m.group(1) or m.group(2)
        path = (ROOT if name.startswith('vendor/') else TEMPLATE.parent) / name
        return expand(path.read_text(encoding='utf-8'))
    return INCLUDE.sub(sub, text)


def render(embed_images=False):
    lines = expand(TEMPLATE.read_text(encoding='utf-8')).split('\n')
    for i, line in enumerate(lines):
        if line in SLOTS:
            var, name = SLOTS[line]
            obj = questions_payload(embed_images) if name == 'questions.json' else load(name)
            lines[i] = f'{var}=' + json.dumps(obj, ensure_ascii=False) + ';'
    return '\n'.join(lines)


def main():
    if '--embed-images' in sys.argv:
        out = Path(sys.argv[sys.argv.index('--embed-images') + 1]) if len(sys.argv) > sys.argv.index('--embed-images') + 1 \
            else ROOT / 'np-quiz-offline.html'
        html = render(embed_images=True)
        out.write_text(html, encoding='utf-8')
        print(f'已產生離線版 {out}（{len(html.encode()) / 1e6:.1f} MB，附圖內嵌）')
        return
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
