// ── 成就系統 ────────────────────────────────
function checkAchievements(correct, timeUsed) {
  const p = State.progress;
  const newAch = [];

  const unlock = (key) => {
    if (!State.achievements[key]) {
      State.achievements[key] = { date: new Date().toISOString() };
      newAch.push(key);
      showToast(ACHIEVEMENTS[key].icon + ' 成就解鎖：' + ACHIEVEMENTS[key].name);
    }
  };

  if (correct && p.totalCorrect === 1) unlock('first_correct');
  if (State.streak >= 5) unlock('streak_5');
  if (State.streak >= 10) unlock('streak_10');
  if (State.streak >= 20) unlock('streak_20');
  if (correct && timeUsed <= 10) unlock('speed_demon');

  const q = State.sessionQuestions[State.currentIndex];
  if (correct && p.lastAnswered[q.id]?.count === 1) unlock('first_time_ace');

  const answered = answeredList();
  if (answered.length >= 50) unlock('iron_man');

  // 逆轉勝：最近 8 題為「連錯 3 題後連對 5 題」
  const last8 = answered.slice(-8).map(a => a.correct);
  if (last8.length === 8 && last8.slice(0, 3).every(c => !c) && last8.slice(3).every(Boolean)) unlock('comeback');

  // 所有科別都答過
  const allTags = new Set(State.allQuestions.flatMap(x => x.tags));
  if ([...allTags].every(t => p.byTag[t]?.total > 0)) unlock('all_subjects');

  // 本次全對
  const sessionCorrect = answered.filter(a => a.correct).length;
  const sessionTotal = answered.length;
  if (sessionTotal >= 30 && sessionCorrect === sessionTotal) unlock('perfect_30');
  if (sessionTotal >= 50 && sessionCorrect === sessionTotal) unlock('perfect_50');

  // 科別正確率
  Object.entries(p.byTag).forEach(([tag, v]) => {
    if (v.total >= 10 && v.correct / v.total >= 0.8) unlock('subject_80');
  });

  if (newAch.length > 0) {
    State.newlyUnlocked = (State.newlyUnlocked || []).concat(newAch);
    saveProgress();
  }
}
