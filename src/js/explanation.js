// ── 最後統一詳解 ─────────────────────────────
function renderDeferredExplanations() {
  const el = document.getElementById('deferred-explanations');
  if (!el) return;

  el.style.display = 'block';
  el.innerHTML = `
    <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:var(--color-secondary-300);margin-bottom:16px">
      📖 所有題目詳解
    </div>`;

  State.userAnswers.forEach((ans, i) => {
    const q = ans && ans.q;
    if (!q) return;
    const resultColor = ans.correct ? 'var(--color-success-300)' : 'var(--color-error-300)';
    const resultIcon = ans.correct ? '✅' : '❌';
    const ansText = q.answer
      ? q.answer.split('、').map(l => `(${l}) ${q.options[l] || ''}`).join('　')
      : '（無標準答案）';

    const divId = `def-exp-${i}`;
    const expContent = (window.__EXP && window.__EXP[String(q.id)])
      ? md(window.__EXP[String(q.id)])
      : '<span style="color:var(--color-text-muted)">此題尚無詳解</span>';

    el.innerHTML += `
      <div style="background:var(--gradient-card);border:1px solid var(--color-bg-border);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
          <span style="font-size:16px">${resultIcon}</span>
          <div>
            <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px">Q${(i+1).toString().padStart(3,'0')} · ${(q.tags||[]).join('/')}</div>
            <div style="font-size:13px;color:var(--color-text-primary);line-height:1.6">${questionHtml(q)}</div>
          </div>
        </div>
        <div style="font-size:12px;color:${resultColor};margin-bottom:8px">正確答案：${ansText}</div>
        <div id="${divId}" style="font-size:12px;color:var(--color-text-secondary);line-height:1.8">${expContent}</div>
      </div>`;
  });
}

// ── 詳解系統 ────────────────────────────────
function showExplanation(q, correct) {
  const panel = document.getElementById('explanation-panel');
  if (!panel) { nextQuestion(); return; }

  // 正確答案區
  const answerText = q.answer
    ? q.answer.split('、').map(l => `(${l}) ${q.options[l] || ''}`).join('　')
    : '（本題無標準答案）';

  const resultIcon = correct ? '✅ 答對了！' : '❌ 答錯了！';
  const resultColor = correct ? 'var(--color-success-300)' : 'var(--color-error-300)';

  document.getElementById('explanation-answer-text').innerHTML = `
    <div style="font-family:'Press Start 2P',monospace;font-size:11px;color:${resultColor};margin-bottom:12px">${resultIcon}</div>
    <div style="font-size:13px;color:var(--color-secondary-300);font-weight:600;margin-bottom:4px">正確答案</div>
    <div style="font-size:14px;color:var(--color-text-primary);line-height:1.6">${answerText}</div>
  `;

  // 詳解（全部題目皆有內嵌詳解）
  const exp = window.__EXP && window.__EXP[q.id];
  document.getElementById('explanation-ai-content').innerHTML = `
    <div style="border-top:1px solid var(--color-bg-border);margin-top:14px;padding-top:14px">
      <div style="font-size:12px;color:var(--color-secondary-300);font-weight:600;margin-bottom:8px">🤖 AI 詳解</div>
      <div id="ai-explanation-text" style="font-size:13px;color:var(--color-text-secondary);line-height:1.8">
        ${exp ? md(exp) : '<span style="color:var(--color-text-muted)">此題尚無詳解</span>'}
      </div>
    </div>`;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideExplanation() {
  const panel = document.getElementById('explanation-panel');
  if (panel) panel.style.display = 'none';
}

function isCorrect(selected, answer) {
  if (!answer) return false;
  if (answer === '送分') return !!selected;
  // 多選答案（如「C、D」）為官方更正「任一皆給分」
  return answer.split('、').includes(selected);
}

// 本次已作答的紀錄（略過空位）
function answeredList() {
  return State.userAnswers.filter(Boolean);
}

function recordAnswer(q, selected, correct, timeUsed, index = State.currentIndex) {
  State.userAnswers[index] = {
    qId: q.id,
    q: q,
    selected,
    correct,
    timeUsed,
  };

  if (correct) {
    State.streak++;
    State.maxStreak = Math.max(State.maxStreak, State.streak);
  } else {
    State.streak = 0;
  }

  // 更新長期進度
  const p = State.progress;
  p.totalAnswered++;
  if (correct) p.totalCorrect++;

  // 按標籤
  q.tags.forEach(tag => {
    if (!p.byTag[tag]) p.byTag[tag] = { correct: 0, total: 0 };
    p.byTag[tag].total++;
    if (correct) p.byTag[tag].correct++;
  });

  // 按年份
  if (q.year) {
    if (!p.byYear[q.year]) p.byYear[q.year] = { correct: 0, total: 0 };
    p.byYear[q.year].total++;
    if (correct) p.byYear[q.year].correct++;
  }

  // 首次答對
  if (correct && !p.firstCorrect[q.id]) {
    p.firstCorrect[q.id] = true;
  }

  // 最後答題
  if (!p.lastAnswered[q.id]) p.lastAnswered[q.id] = { correct: false, count: 0 };
  p.lastAnswered[q.id].count++;
  p.lastAnswered[q.id].correct = correct;

  // 更新 SRS 排程
  updateSRS(String(q.id), correct);

  saveProgress();
  saveSession();
}

function updateStreakDisplay() {
  const el = document.getElementById('streak-display');
  if (!el) return;
  if (State.streak >= 10) {
    el.innerHTML = `🔥🔥 ${State.streak} <span class="streak-label">STREAK</span>`;
    el.classList.add('hot');
  } else if (State.streak >= 5) {
    el.innerHTML = `🔥 ${State.streak} <span class="streak-label">STREAK</span>`;
    el.classList.add('hot');
  } else if (State.streak > 0) {
    el.innerHTML = `✦ ${State.streak} <span class="streak-label">STREAK</span>`;
    el.classList.remove('hot');
  } else {
    el.innerHTML = '';
    el.classList.remove('hot');
  }
}

function disableOptions() {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
}

function nextQuestion() {
  if (State.exam && State.currentIndex >= State.sessionQuestions.length - 1) { openExamPalette(); return; }
  State.currentIndex++;
  if (State.currentIndex >= State.sessionQuestions.length) {
    endSession();
  } else {
    renderQuestion();
  }
}

function prevQuestion() {
  if (State.currentIndex <= 0) return;
  if (State.exam) { State.currentIndex--; renderQuestion(); saveSession(); return; }
  clearInterval(State.timerInterval);
  hideExplanation();
  State.currentIndex--;
  renderQuestion(true); // true = review mode (already answered)
}

function skipQuestion() {
  if (State.exam) { nextQuestion(); saveSession(); return; }
  clearInterval(State.timerInterval);
  const q = State.sessionQuestions[State.currentIndex];
  // 只在尚未記錄時才記錄（避免重複計算）
  if (!State.userAnswers[State.currentIndex]) {
    recordAnswer(q, null, false, QUESTION_SECONDS);
    State.streak = 0;
  }
  nextQuestion();
}

function exitToHome() {
  if (!confirm('確定要離開練習嗎？目前進度已自動儲存，下次開啟可繼續。')) return;
  clearInterval(State.timerInterval);
  showScreen('landing');
  updateLandingStats();
}
