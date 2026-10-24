/* ─────────────────────────────────────────────
   專科護理師刷題神器 — 主程式
   像素冒險風 RPG 刷題系統
───────────────────────────────────────────── */

'use strict';

// ── 科別分類（兩層架構）────────────────────
const SUBJECT_CATEGORIES = {
  '內科系': ['心臟血管', '呼吸系統', '消化系統', '腎臟泌尿', '神經系統', '內分泌代謝', '感染免疫', '血液腫瘤'],
  '外科系': ['外科周手術', '骨骼肌肉', '重症加護'],
  '專  科': ['婦產科', '精神科', '兒科'],
  '基礎通論': ['評估診斷', '藥理用藥', '護理通論', '法規倫理'],
};

// ── 全域狀態 ────────────────────────────────
const QUESTION_SECONDS = 60;   // 一般練習每題作答時間

const State = {
  allQuestions: [],
  sessionQuestions: [],
  currentIndex: 0,
  userAnswers: [],        // 依題目位置存放：userAnswers[i] = { qId, q, selected, correct, timeUsed }，未作答為空位
  streak: 0,
  maxStreak: 0,
  timerInterval: null,
  timeLeft: QUESTION_SECONDS,
  sessionStart: null,

  mode: null,             // 'year' | 'subject' | 'mixed'
  selectedYears: [],
  selectedExamTypes: [],  // '通論' | '進階內科' | '進階外科'
  selectedTags: [],
  selectedCount: 30,
  explainMode: 'immediate',  // 'immediate' | 'deferred'

  progress: null,         // 從 localStorage 載入
  achievements: {},       // 解鎖的成就
};

// ── 成就定義 ────────────────────────────────
const ACHIEVEMENTS = {
  first_correct:   { icon: '🌱', name: '初心者', desc: '第一題答對' },
  streak_5:        { icon: '🔥', name: '連勝5', desc: '連續答對5題' },
  streak_10:       { icon: '🔥🔥', name: '連勝10', desc: '連續答對10題' },
  streak_20:       { icon: '🔥🔥🔥', name: '連勝20', desc: '連續答對20題' },
  first_time_ace:  { icon: '⭐', name: '一次過', desc: '第一次嘗試就答對' },
  iron_man:        { icon: '💪', name: '鐵人', desc: '單次刷題50題以上' },
  speed_demon:     { icon: '⚡', name: '神速', desc: '10秒內答對' },
  perfect_30:      { icon: '🏆', name: '滿分30', desc: '30題全對' },
  perfect_50:      { icon: '👑', name: '滿分50', desc: '50題全對' },
  comeback:        { icon: '🔄', name: '逆轉勝', desc: '連錯3題後答對5題' },
  subject_80:      { icon: '🎯', name: '科別精通', desc: '某科別正確率≥80%' },
  all_subjects:    { icon: '🎖️', name: '全科征服', desc: '所有科別都答過題' },
};
