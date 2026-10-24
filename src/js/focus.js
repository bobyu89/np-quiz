// ── 弱點加強：優先出錯過的題，其次沒做過的 ──
function startFocusPractice(tags) {
  const p = State.progress;
  const rank = q => { const la = p.lastAnswered[q.id]; return !la ? 1 : la.correct ? 2 : 0; };
  const pool = State.allQuestions.filter(q => q.tags.some(t => tags.includes(t)));
  shuffle(pool);
  pool.sort((a, b) => rank(a) - rank(b));
  State.mode = 'focus';
  State.selectedTags = tags;
  State.selectedYears = [];
  State.selectedExamTypes = [];
  State.explainMode = localStorage.getItem('np_explain_mode') || 'immediate';
  beginSession(pool.slice(0, 20));
}

const focusArg = tags => `[${tags.map(t => `'${t}'`).join(',')}]`;

function renderSessionWeak() {
  const el = document.getElementById('session-weak');
  if (!el) return;
  const stat = {};
  answeredList().forEach(a => (a.q.tags || []).forEach(t => {
    stat[t] = stat[t] || { correct: 0, total: 0 };
    stat[t].total++;
    if (a.correct) stat[t].correct++;
  }));
  const weak = Object.entries(stat)
    .filter(([, v]) => v.total >= 2 && v.correct < v.total)
    .map(([tag, v]) => ({ tag, ...v, pct: Math.round(v.correct / v.total * 100) }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, 3);
  if (!weak.length) {
    el.innerHTML = '<p class="weak-empty">本次沒有明顯弱點（每科至少 2 題才列入）</p>';
    return;
  }
  const items = weak.map((w, i) => `<div class="weak-item">
      <span class="weak-rank">${'①②③'[i]}</span>
      <span class="weak-name">${w.tag}</span>
      <span class="weak-pct ${w.pct < 50 ? 'is-low' : 'is-mid'}">${w.pct}%</span>
      <span class="weak-count">錯 ${w.total - w.correct} / ${w.total} 題</span>
      <button class="btn btn-sm btn-secondary weak-practice-btn" onclick="startFocusPractice(${focusArg([w.tag])})">練習</button>
    </div>`).join('');
  el.innerHTML = `${items}<div class="weak-all"><button class="btn btn-primary" onclick="startFocusPractice(${focusArg(weak.map(w => w.tag))})">🎯 一鍵練習弱點（20 題）</button></div>`;
}
