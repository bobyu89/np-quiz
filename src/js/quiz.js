// ── 答題頁 ──────────────────────────────────
function renderQuestion(reviewMode = false) {
  hideExplanation();
  const q = State.sessionQuestions[State.currentIndex];
  if (!q) { endSession(); return; }

  const total = State.sessionQuestions.length;
  const current = State.currentIndex + 1;

  // 進度條
  const pct = ((current - 1) / total) * 100;
  setStyle('progress-fill', 'width', `${pct}%`);
  setEl('progress-text', `${current} / ${total}`);

  // 連勝
  updateStreakDisplay();

  updateExamHud();

  // 題目 meta
  setEl('q-tags', q.tags.map(t => `<span class="q-tag">${t}</span>`).join(''));
  setEl('q-year', q.year ? `<span class="q-year">${q.year}年 ${q.exam_type || ''}</span>` : '');
  setEl('q-num', `Q${current.toString().padStart(3, '0')}`);
  setEl('q-text', questionHtml(q));

  // 上一題按鈕顯示控制
  const prevBtn = document.getElementById('prev-btn');
  if (prevBtn) prevBtn.style.display = State.currentIndex > 0 ? '' : 'none';

  // 筆記面板重置
  const notePanel = document.getElementById('note-panel');
  if (notePanel) notePanel.style.display = 'none';
  if (typeof updateNoteIndicator === 'function') updateNoteIndicator(q.id);

  // 選項
  const optWrap = document.getElementById('options-wrap');
  const letters = ['A', 'B', 'C', 'D'];

  // 已作答的題目一律以回顧模式顯示，避免「上一題 → 下一題」後重答、重複計分
  const prevAnswer = State.userAnswers[State.currentIndex];
  if (prevAnswer) reviewMode = true;

  optWrap.innerHTML = letters
    .filter(l => q.options[l])
    .map(l => `
      <button class="option-btn" id="opt-${l}" onclick="selectAnswer('${l}')">
        <span class="option-label">(${l})</span>
        <span>${q.options[l]}</span>
      </button>`
    ).join('');

  if (State.exam) {
    const pick = State.exam.picks[State.currentIndex];
    if (pick) document.getElementById(`opt-${pick}`)?.classList.add('picked');
    updateExamHud();
    startExamTimer();
  } else if (reviewMode && prevAnswer) {
    // 回顧已答題目：顯示選擇結果，不允許重新作答
    disableOptions();
    if (prevAnswer.selected) {
      document.getElementById(`opt-${prevAnswer.selected}`)?.classList.add(prevAnswer.correct ? 'correct' : 'wrong');
    }
    if (!prevAnswer.correct && q.answer) {
      q.answer.split('、').forEach(l => document.getElementById(`opt-${l}`)?.classList.add('correct'));
    }
    // 顯示詳解
    setTimeout(() => showExplanation(q, prevAnswer.correct), 100);
  } else {
    // 啟動計時器（新題目）
    startTimer();
  }
}

function startTimer() {
  clearInterval(State.timerInterval);
  State.timeLeft = QUESTION_SECONDS;
  updateTimerBar();

  State.timerInterval = setInterval(() => {
    State.timeLeft--;
    updateTimerBar();
    if (State.timeLeft <= 0) {
      clearInterval(State.timerInterval);
      timeUp();
    }
  }, 1000);
}

function updateTimerBar() {
  const fill = document.getElementById('timer-fill');
  const num  = document.getElementById('timer-num');
  if (!fill) return;

  const pct = (State.timeLeft / QUESTION_SECONDS) * 100;
  fill.style.width = `${pct}%`;
  if (num) num.textContent = State.timeLeft;

  fill.classList.remove('warn', 'danger');
  if (State.timeLeft <= 10) fill.classList.add('danger');
  else if (State.timeLeft <= 20) fill.classList.add('warn');
}

function timeUp() {
  // 時間到 = 答錯，顯示正確答案
  const q = State.sessionQuestions[State.currentIndex];
  disableOptions();
  if (q.answer) {
    q.answer.split('、').forEach(l => document.getElementById(`opt-${l}`)?.classList.add('correct'));
  }
  recordAnswer(q, null, false, QUESTION_SECONDS);
  State.streak = 0;
  updateStreakDisplay();

  document.getElementById('screen-quiz').classList.add('flash-wrong');
  setTimeout(() => {
    document.getElementById('screen-quiz').classList.remove('flash-wrong');
    if (State.explainMode === 'deferred') {
      nextQuestion();
    } else {
      showExplanation(q, false);
    }
  }, 500);
}

function selectAnswer(letter) {
  if (State.exam) { examPick(letter); return; }
  clearInterval(State.timerInterval);
  const q = State.sessionQuestions[State.currentIndex];
  const timeUsed = QUESTION_SECONDS - State.timeLeft;

  // 判斷對錯
  const correct = isCorrect(letter, q.answer);
  const answerLetter = letter;

  // 視覺回饋
  disableOptions();
  const selectedBtn = document.getElementById(`opt-${letter}`);
  if (correct) {
    selectedBtn?.classList.add('correct');
    document.getElementById('screen-quiz').classList.add('flash-correct');
    setTimeout(() => document.getElementById('screen-quiz').classList.remove('flash-correct'), 400);
  } else {
    selectedBtn?.classList.add('wrong');
    // 顯示正確答案
    if (q.answer) {
      const correctLetters = q.answer.split('、');
      correctLetters.forEach(l => document.getElementById(`opt-${l}`)?.classList.add('correct'));
    }
    document.getElementById('screen-quiz').classList.add('flash-wrong');
    setTimeout(() => document.getElementById('screen-quiz').classList.remove('flash-wrong'), 400);
  }

  recordAnswer(q, answerLetter, correct, timeUsed);
  updateStreakDisplay();

  // 成就檢查
  checkAchievements(correct, timeUsed);

  if (State.explainMode === 'deferred') {
    // 延後詳解：自動進入下一題
    setTimeout(nextQuestion, correct ? 700 : 1200);
  } else {
    // 即時詳解：顯示詳解面板
    setTimeout(() => showExplanation(q, correct), 400);
  }
}
