// ── 講義生成 ────────────────────────────────
function generateHandout() {
  showScreen('handout');

  const wrong = answeredList().filter(a => !a.correct);
  const correct = answeredList().filter(a => a.correct);
  const total = answeredList().length;
  const pct = total ? Math.round((correct.length / total) * 100) : 0;

  const handout = document.getElementById('handout-content');
  if (!handout) return;

  handout.innerHTML = `
    <div class="handout-title">📋 個人化學習講義</div>
    <div class="handout-meta">
      生成時間：${new Date().toLocaleString('zh-TW')} ｜
      本次成績：${correct.length}/${total}（${pct}%）｜
      錯題數：${wrong.length}
    </div>
    <div class="pixel-divider handout-divider"></div>

    ${renderWeakSummaryForHandout()}

    <div class="handout-section-title handout-section-wrong">
      ── 錯題解析（${wrong.length}題） ──
    </div>

    ${wrong.map((a, i) => renderHandoutQuestion(a, i + 1, 'wrong')).join('')}

    ${wrong.length < total ? `
      <div class="handout-section-title handout-section-correct">
        ── 答對題目（供複習） ──
      </div>
      ${correct.slice(0, 10).map((a, i) => renderHandoutQuestion(a, i + 1, 'correct')).join('')}
    ` : ''}
  `;
}

function renderWeakSummaryForHandout() {
  const p = State.progress;
  const tagRates = Object.entries(p.byTag)
    .filter(([, v]) => v.total >= 3)
    .map(([tag, v]) => ({ tag, pct: Math.round((v.correct / v.total) * 100), total: v.total }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  if (tagRates.length === 0) return '';

  return `
    <div class="handout-weak">
      <div class="handout-weak-title">⚠️ 重點複習科別</div>
      ${tagRates.map((item, i) => `
        <div class="handout-weak-item">
          <span class="handout-weak-rank">${i + 1}</span>
          <span class="handout-weak-name">${item.tag}</span>
          <span class="handout-weak-pct${item.pct < 50 ? ' low' : ''}">${item.pct}%</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHandoutQuestion(answer, index, type) {
  const q = answer.q;
  const letters = ['A', 'B', 'C', 'D'];
  const correctLetters = q.answer ? q.answer.split('、') : [];

  return `
    <div class="handout-q">
      <div class="handout-q-header">
        <span class="handout-q-num">${type === 'wrong' ? '✗' : '✓'} Q${index}</span>
        <div class="handout-q-tags">
          ${q.tags.map(t => `<span class="q-tag">${t}</span>`).join('')}
          ${q.year ? `<span class="q-year">${q.year}年</span>` : ''}
        </div>
      </div>
      <div class="handout-q-text">${questionHtml(q)}</div>
      <div class="handout-options">
        ${letters.filter(l => q.options[l]).map(l => `
          <div class="handout-option ${correctLetters.includes(l) ? 'correct' : ''} ${answer.selected === l && !correctLetters.includes(l) ? 'my-wrong' : ''}">
            (${l}) ${q.options[l]}
            ${correctLetters.includes(l) ? ' ✓' : ''}
            ${answer.selected === l && !correctLetters.includes(l) ? ' ← 你的答案' : ''}
          </div>
        `).join('')}
      </div>
      ${q.answer ? `
        <div class="handout-analysis">
          <div class="handout-analysis-title">正確答案：${q.answer}</div>
          ${window.__EXP && window.__EXP[q.id] ? `<div class="handout-exp">${md(window.__EXP[q.id])}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}
