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
    <div class="pixel-divider" style="margin:16px 0"></div>

    ${renderWeakSummaryForHandout()}

    <div style="font-family:var(--font-pixel);font-size:11px;color:var(--color-error-500);margin:24px 0 16px">
      ── 錯題解析（${wrong.length}題） ──
    </div>

    ${wrong.map((a, i) => renderHandoutQuestion(a, i + 1, 'wrong')).join('')}

    ${wrong.length < total ? `
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--color-success-300);margin:24px 0 16px">
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
    <div style="margin-bottom:20px">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--color-warning-500);margin-bottom:12px">⚠️ 重點複習科別</div>
      ${tagRates.map((item, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-bg-border)">
          <span style="font-family:var(--font-pixel);font-size:14px;color:var(--color-error-500)">${i+1}</span>
          <span style="flex:1">${item.tag}</span>
          <span style="font-family:var(--font-pixel);font-size:11px;color:${item.pct<50?'var(--color-error-500)':'var(--color-warning-500)'}">${item.pct}%</span>
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
          ${q.tags.map(t => `<span class="q-tag" style="font-size:10px">${t}</span>`).join('')}
          ${q.year ? `<span class="q-year" style="font-size:10px">${q.year}年</span>` : ''}
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
