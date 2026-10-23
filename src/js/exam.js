// ── 模擬考 ─────────────────────────────────
const EXAM_MINUTES = 90;   // 正式考試每節 90 分鐘
const EXAM_PAIRS = { '通論': ['進階內科', '進階外科'], '進階內科': ['通論'], '進階外科': ['通論'] };

function pickExamOption(el, key, val) {
  el.parentElement.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  State[key] = val;
}

function examPick(letter) {
  State.exam.picks[State.currentIndex] = letter;
  document.querySelectorAll('.option-btn').forEach(b => b.classList.toggle('picked', b.id === `opt-${letter}`));
  updateExamHud();
  saveSession();
}

// 模擬考與一般練習共用作答頁，依模式切換頂部列
function updateExamHud() {
  const exam = !!State.exam;
  const nav = document.getElementById('exam-nav-btn');
  if (nav) nav.style.display = exam ? '' : 'none';
  setEl('skip-btn', exam ? '下一題 →' : '跳過 →');
  if (exam) {
    const done = State.exam.picks.filter(Boolean).length;
    setEl('progress-text', `第 ${State.currentIndex + 1} 題　已答 ${done} / ${State.sessionQuestions.length}`);
    setStyle('progress-fill', 'width', `${done / State.sessionQuestions.length * 100}%`);
  }
}

function startExamTimer() {
  clearInterval(State.timerInterval);
  const total = EXAM_MINUTES * 60;
  const tick = () => {
    if (!State.exam) { clearInterval(State.timerInterval); return; }
    const left = Math.max(0, Math.round((State.exam.deadline - Date.now()) / 1000));
    const fill = document.getElementById('timer-fill');
    if (fill) {
      fill.style.width = `${left / total * 100}%`;
      fill.classList.toggle('warn', left <= 600 && left > 300);
      fill.classList.toggle('danger', left <= 300);
    }
    setEl('timer-num', `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    if (left <= 0) {
      clearInterval(State.timerInterval);
      alert('時間到，自動交卷');
      submitExam();
    }
  };
  tick();
  State.timerInterval = setInterval(tick, 1000);
}

function openExamPalette() {
  if (!State.exam) return;
  closeExamPalette();
  const picks = State.exam.picks;
  const box = document.createElement('div');
  box.className = 'exam-palette';
  box.innerHTML = `<div class="exam-palette-card">
      <div class="exam-palette-head">已答 ${picks.filter(Boolean).length} / ${picks.length}<button onclick="closeExamPalette()" aria-label="關閉">✕</button></div>
      <div class="exam-palette-grid">${picks.map((p, i) =>
        `<button class="${p ? 'done' : ''}${i === State.currentIndex ? ' current' : ''}" onclick="jumpExamQuestion(${i})">${i + 1}</button>`).join('')}</div>
      <div style="text-align:center;margin-top:14px"><button class="btn btn-danger" onclick="closeExamPalette();confirmEnd()">交卷</button></div>
    </div>`;
  box.addEventListener('click', e => { if (e.target === box) closeExamPalette(); });
  document.body.appendChild(box);
}

function closeExamPalette() { document.querySelector('.exam-palette')?.remove(); }

function jumpExamQuestion(i) {
  closeExamPalette();
  State.currentIndex = i;
  renderQuestion();
  saveSession();
}

function submitExam() {
  clearInterval(State.timerInterval);
  closeExamPalette();
  const ex = State.exam;
  State.exam = null;
  State.userAnswers = [];
  State.streak = 0;
  State.maxStreak = 0;
  State.sessionQuestions.forEach((q, i) => {
    const sel = ex.picks[i];
    // 未作答只計入本次成績（0 分），不寫入長期作答紀錄
    if (sel) recordAnswer(q, sel, isCorrect(sel, q.answer), 0, i);
    else State.userAnswers[i] = { qId: q.id, q, selected: null, correct: false, timeUsed: 0 };
  });
  const score = Math.round(answeredList().filter(a => a.correct).length * 125) / 100;   // 每題 1.25 分
  const p = State.progress;
  p.mockExams = [{ year: ex.year, examType: ex.examType, score, ts: Date.now() }, ...(p.mockExams || [])].slice(0, 30);
  State.lastExam = { year: ex.year, examType: ex.examType, score, blank: ex.picks.filter(x => !x).length };
  State.mode = 'exam';
  endSession();
}

function renderExamVerdict() {
  const el = document.getElementById('exam-verdict');
  if (!el) return;
  const ex = State.mode === 'exam' && State.lastExam;
  el.style.display = ex ? 'block' : 'none';
  if (!ex) return;
  setEl('result-score', `${ex.score} 分`);
  const ok = sc => sc >= 50;
  let html = `<div><strong>${ex.year} 年${ex.examType}</strong>：${ex.score} 分${ex.blank ? `（未作答 ${ex.blank} 題）` : ''}　`
    + (ok(ex.score) ? '✅ 達單科 50 分門檻' : '❌ 未達單科 50 分門檻') + '</div>';
  const pair = (State.progress.mockExams || []).slice(1)
    .find(m => m.year === ex.year && EXAM_PAIRS[ex.examType].includes(m.examType));
  if (pair) {
    const avg = Math.floor((ex.score + pair.score) / 2 * 100) / 100;
    const pass = avg >= 60 && ok(ex.score) && ok(pair.score);
    html += `<div>搭配最近一次 ${pair.year} 年${pair.examType}（${pair.score} 分），兩科平均 ${avg} 分　`
      + (pass ? '🎉 <strong>筆試及格</strong>' : '❌ 未達及格（需平均 60 分且各科 ≥ 50 分）') + '</div>';
  } else {
    html += `<div style="color:var(--color-text-muted)">再考一份 ${ex.year} 年${EXAM_PAIRS[ex.examType].join('或')}，即可判定兩科是否及格（平均 60 分且各科 ≥ 50 分）。</div>`;
  }
  el.innerHTML = html;
}
