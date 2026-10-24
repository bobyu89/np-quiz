// ── 初始化 ──────────────────────────────────
async function init() {
  // 詳解的【選項分析】一行一個選項，單一換行也要保留
  marked.use({ breaks: true });
  document.addEventListener('keydown', handleQuizKeys);
  document.addEventListener('touchstart', handleQuizTouchStart, { passive: true });
  document.addEventListener('touchend', handleQuizTouchEnd, { passive: true });
  document.addEventListener('click', e => { if (e.target.classList?.contains('q-figure')) openFigure(e.target.src); });
  loadProgress();
  await loadQuestions();
  updateLandingStats();

  // 檢查是否有未完成的 session
  const saved = loadSavedSession();
  if (saved) {
    const resume = confirm(`發現上次未完成的練習！\n進度：${saved.currentIndex + 1} / ${saved.sessionQuestions.length} 題\n\n要繼續嗎？`);
    if (resume) {
      restoreSession(saved);
      return;
    } else {
      clearSavedSession();
    }
  }
  showScreen('landing');
}

// localStorage 寫滿或被停用時不中斷作答流程，只提示一次
let storageWarned = false;
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (!storageWarned) {
      storageWarned = true;
      if (typeof showToast === 'function') showToast('⚠️ 瀏覽器儲存空間不足，進度可能無法保存，建議先匯出備份');
    }
    return false;
  }
}

function saveSession() {
  if (!State.sessionQuestions.length) return;
  const snap = {
    sessionQuestions: State.sessionQuestions.map(q => q.id),
    currentIndex: State.currentIndex,
    userAnswers: Array.from(State.userAnswers, a => a ? { qId: a.qId, selected: a.selected, correct: a.correct, timeUsed: a.timeUsed } : null),
    exam: State.exam,
    streak: State.streak,
    maxStreak: State.maxStreak,
    mode: State.mode,
    selectedYears: State.selectedYears,
    selectedExamTypes: State.selectedExamTypes,
    selectedTags: State.selectedTags,
    selectedCount: State.selectedCount,
    explainMode: State.explainMode,
    sessionStart: State.sessionStart,
  };
  safeSet('np_session', JSON.stringify(snap));
}

function loadSavedSession() {
  try {
    const raw = localStorage.getItem('np_session');
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // 確認題目都還存在
    if (!snap.sessionQuestions || !snap.sessionQuestions.length) return null;
    return snap;
  } catch { return null; }
}

function clearSavedSession() {
  localStorage.removeItem('np_session');
}

function restoreSession(snap) {
  const idMap = new Map(State.allQuestions.map(q => [q.id, q]));
  const questions = snap.sessionQuestions.map(id => idMap.get(id)).filter(Boolean);
  if (!questions.length) { showScreen('landing'); return; }

  State.sessionQuestions = questions;
  State.currentIndex = Math.min(snap.currentIndex, questions.length - 1);
  State.userAnswers = (snap.userAnswers || []).map(a => a && idMap.has(a.qId) ? { ...a, q: idMap.get(a.qId) } : undefined);
  State.exam = snap.exam || null;
  State.streak = snap.streak || 0;
  State.maxStreak = snap.maxStreak || 0;
  State.mode = snap.mode;
  State.selectedYears = snap.selectedYears || [];
  State.selectedExamTypes = snap.selectedExamTypes || [];
  State.selectedTags = snap.selectedTags || [];
  State.selectedCount = snap.selectedCount || 30;
  State.explainMode = snap.explainMode || 'immediate';
  State.sessionStart = snap.sessionStart || Date.now();

  showScreen('quiz');
  renderQuestion();
}

async function loadQuestions() {
  // 優先用嵌入資料（直接開 HTML 也能用，不需要伺服器）
  if (window.__QD && window.__QD.questions) {
    State.allQuestions = window.__QD.questions;
    console.log(`嵌入資料載入：${State.allQuestions.length} 題`);
    return;
  }
  // 備用：透過伺服器 fetch
  try {
    const res = await fetch('./data/questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    State.allQuestions = data.questions || [];
    console.log(`Fetch 載入：${State.allQuestions.length} 題`);
  } catch (e) {
    console.error('無法載入題庫', e);
    showError('無法載入題庫！<br>請確認 data/questions-embed.js 存在');
  }
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('np_progress');
    State.progress = saved ? JSON.parse(saved) : initProgress();
    const ach = localStorage.getItem('np_achievements');
    State.achievements = ach ? JSON.parse(ach) : {};
  } catch {
    State.progress = initProgress();
    State.achievements = {};
  }
  migrateQuestionIds();
}

// 題庫整理後已移除的題目 id：113、114 年曾重複匯入（1433–1918 與 1–486 相同），
// 以及誤收的考卷說明。舊作答紀錄與筆記改掛到保留的題目上；新題目不可再使用這些 id。
function removedQuestionId(id) {
  if (id >= 1433 && id <= 1918) return id - 1432;
  if ([1, 82, 163, 244, 325, 406, 727, 808, 889, 970, 1051, 1132, 1213, 1294, 1352].includes(id)) return null;
  return id;
}

function migrateQuestionIds() {
  // 舊版的 API Key 功能已移除，順手清掉明文 Key 與快取
  Object.keys(localStorage).filter(k => k === 'np_api_key' || k.startsWith('np_exp_')).forEach(k => localStorage.removeItem(k));
  const remap = (obj) => {
    let changed = false;
    Object.keys(obj || {}).forEach(k => {
      const to = removedQuestionId(Number(k));
      if (to === Number(k)) return;
      if (to !== null && !(to in obj)) obj[to] = obj[k];
      delete obj[k];
      changed = true;
    });
    return changed;
  };
  const p = State.progress;
  if ([p.srs, p.firstCorrect, p.lastAnswered].map(remap).some(Boolean)) saveProgress();
  const notes = loadNotes();
  if (remap(notes)) saveNotes(notes);
}

function initProgress() {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    byTag: {},
    byYear: {},
    firstCorrect: {},
    sessions: [],       // 最近20次練習紀錄（含科別細項）
    lastAnswered: {},
    srs: {},            // { qId: { level:0-5, nextReview: timestamp } }
  };
}
