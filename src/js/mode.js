// ── 模式選擇頁 ──────────────────────────────
function initModeScreen() {
  // 年份選項
  const years = [...new Set(State.allQuestions.map(q => q.year).filter(Boolean))].sort();
  const yearWrap = document.getElementById('year-tag-grid');
  if (yearWrap) {
    yearWrap.innerHTML = years.map(y =>
      `<button class="tag-btn" data-year="${y}" onclick="toggleYear(this, ${y})">${y}年</button>`
    ).join('');
  }

  // 考試類型選項
  const examTypes = [...new Set(State.allQuestions.map(q => q.exam_type).filter(Boolean))].sort();
  const etWrap = document.getElementById('exam-type-grid');
  if (etWrap) {
    etWrap.innerHTML = examTypes.map(et =>
      `<button class="tag-btn" data-examtype="${et}" onclick="toggleExamType(this,'${et}')">${et}</button>`
    ).join('');
  }

  // 模擬考：年度、科目各單選，預設最新年度的通論
  State.examYear = years[years.length - 1];
  State.examType = '通論';
  setEl('exam-year-grid', years.slice().reverse().map(y =>
    `<button class="tag-btn${y === State.examYear ? ' selected' : ''}" onclick="pickExamOption(this,'examYear',${y})">${y}年</button>`).join(''));
  setEl('exam-subject-grid', ['通論', '進階內科', '進階外科'].map(t =>
    `<button class="tag-btn${t === State.examType ? ' selected' : ''}" onclick="pickExamOption(this,'examType','${t}')">${t}</button>`).join(''));

  // 科別第一層：類別按鈕
  renderCategoryBtns();

  State.selectedYears = [];
  State.selectedExamTypes = [];
  State.selectedTags = [];
  State.mode = 'mixed';
  State.selectedCount = 30;
  State.explainMode = localStorage.getItem('np_explain_mode') || 'immediate';

  // 重置選擇
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.mode-card[data-mode="mixed"]')?.classList.add('selected');
  document.querySelectorAll('.count-btn').forEach(c => c.classList.remove('selected'));
  document.querySelector('.count-btn[data-count="30"]')?.classList.add('selected');

  // 詳解模式按鈕狀態
  syncExplainBtns();
  updateModeUI();
}

function renderCategoryBtns() {
  const wrap = document.getElementById('category-btn-grid');
  if (!wrap) return;
  wrap.innerHTML = Object.keys(SUBJECT_CATEGORIES).map(cat =>
    `<button class="tag-btn" data-cat="${cat}" onclick="selectCategory(this,'${cat}')">${cat}</button>`
  ).join('');
  // 清空子科
  const subWrap = document.getElementById('subject-tag-grid');
  if (subWrap) subWrap.innerHTML = '<span style="color:var(--color-text-muted);font-size:12px">← 先選左側類別</span>';
}

function selectCategory(el, cat) {
  document.querySelectorAll('#category-btn-grid .tag-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  // 渲染子科
  const subWrap = document.getElementById('subject-tag-grid');
  if (!subWrap) return;
  const subs = SUBJECT_CATEGORIES[cat] || [];
  subWrap.innerHTML = subs.map(t =>
    `<button class="tag-btn${State.selectedTags.includes(t) ? ' selected' : ''}" data-tag="${t}" onclick="toggleTag(this,'${t}')">${t}</button>`
  ).join('');
}

function syncExplainBtns() {
  document.querySelectorAll('.explain-mode-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.mode === State.explainMode);
  });
}

function setExplainMode(mode) {
  State.explainMode = mode;
  safeSet('np_explain_mode', mode);
  syncExplainBtns();
}

function selectMode(el, mode) {
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  State.mode = mode;
  updateModeUI();
}

function updateModeUI() {
  const show = id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

  hide('year-section'); hide('exam-type-section'); hide('subject-section'); hide('srs-section'); hide('exam-section');
  const adv = document.getElementById('advanced-settings');
  if (adv) adv.style.display = State.mode === 'exam' ? 'none' : '';
  if (State.mode === 'exam') show('exam-section');
  if (State.mode === 'mixed' || State.mode === 'year') {
    show('year-section');
    show('exam-type-section');
  }
  if (State.mode === 'mixed' || State.mode === 'subject') show('subject-section');
  if (State.mode === 'srs') {
    show('srs-section');
    // 顯示 SRS 當前狀態
    const mini = document.getElementById('srs-status-mini');
    if (mini) {
      const s = getSRSStats();
      const col = s.due > 0 ? 'var(--color-error-300)' : 'var(--color-success-300)';
      mini.innerHTML = `
        <span style="font-size:13px;color:${col}">📋 今日待複習：<strong>${s.due}</strong> 題</span>
        <span style="font-size:13px;color:var(--color-text-muted)">⏳ 學習中：${s.learning} 題</span>
        <span style="font-size:13px;color:var(--color-success-300)">✅ 已掌握：${s.mastered} 題</span>`;
    }
  }
}

function toggleYear(el, year) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!State.selectedYears.includes(year)) State.selectedYears.push(year);
  } else {
    State.selectedYears = State.selectedYears.filter(y => y !== year);
  }
}

function toggleTag(el, tag) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!State.selectedTags.includes(tag)) State.selectedTags.push(tag);
  } else {
    State.selectedTags = State.selectedTags.filter(t => t !== tag);
  }
}

function toggleExamType(el, et) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!State.selectedExamTypes.includes(et)) State.selectedExamTypes.push(et);
  } else {
    State.selectedExamTypes = State.selectedExamTypes.filter(t => t !== et);
  }
}

function selectCount(el, count) {
  document.querySelectorAll('.count-btn').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  State.selectedCount = count === 'all' ? 9999 : parseInt(count);
}

function startSession() {
  let pool;

  if (State.mode === 'exam') {
    pool = State.allQuestions.filter(q => q.year === State.examYear && q.exam_type === State.examType)
      .sort((a, b) => a.number - b.number);
    if (!pool.length) { alert('找不到這份考卷'); return; }
    State.exam = { year: State.examYear, examType: State.examType, deadline: Date.now() + EXAM_MINUTES * 60000, picks: pool.map(() => null) };
    beginSession(pool);
    return;
  }

  // SRS 智慧複習模式
  if (State.mode === 'srs') {
    const cnt = State.selectedCount >= 9999 ? 40 : Number(State.selectedCount);
    pool = getSRSQueue(cnt);
    if (pool.length === 0) {
      alert('目前沒有需要複習的題目！\n所有題目都還在排程中，請稍後再來 🎉');
      return;
    }
  } else {
    pool = [...State.allQuestions];
    if (State.mode === 'mixed') {
      if (State.selectedYears.length > 0)
        pool = pool.filter(q => State.selectedYears.includes(q.year));
      if (State.selectedExamTypes.length > 0)
        pool = pool.filter(q => State.selectedExamTypes.includes(q.exam_type));
      if (State.selectedTags.length > 0)
        pool = pool.filter(q => q.tags.some(t => State.selectedTags.includes(t)));
    } else if (State.mode === 'year') {
      if (State.selectedYears.length > 0)
        pool = pool.filter(q => State.selectedYears.includes(q.year));
      if (State.selectedExamTypes.length > 0)
        pool = pool.filter(q => State.selectedExamTypes.includes(q.exam_type));
    } else if (State.mode === 'subject' && State.selectedTags.length > 0) {
      pool = pool.filter(q => q.tags.some(t => State.selectedTags.includes(t)));
    } else if (State.mode === 'weak') {
      const p = State.progress;
      pool = pool.filter(q => p.lastAnswered[q.id] && !p.lastAnswered[q.id].correct);
    }
    if (pool.length === 0) {
      alert('沒有符合條件的題目，請調整篩選條件');
      return;
    }
    shuffle(pool);
    const cnt = State.selectedCount >= 9999 ? pool.length : Number(State.selectedCount);
    pool = pool.slice(0, Math.min(cnt, pool.length));
  }
  beginSession(pool);
}

function beginSession(pool) {
  if (State.mode !== 'exam') State.exam = null;
  State.sessionQuestions = pool;
  State.currentIndex = 0;
  State.userAnswers = [];
  State.streak = 0;
  State.maxStreak = 0;
  State.sessionStart = Date.now();

  showScreen('quiz');
  renderQuestion();
}
