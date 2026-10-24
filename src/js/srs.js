// ── 間隔重複（SRS）──────────────────────────
// Level → 下次複習間隔（天）
const SRS_INTERVALS = [0, 1, 3, 7, 14, 30];
const SRS_MAX_LEVEL = SRS_INTERVALS.length - 1;

function updateSRS(qId, correct) {
  const p = State.progress;
  if (!p.srs) p.srs = {};
  const entry = p.srs[qId] || { level: 0, nextReview: 0 };

  if (correct) {
    entry.level = Math.min(entry.level + 1, SRS_MAX_LEVEL);
  } else {
    entry.level = Math.max(0, entry.level - 1);
  }

  const days = SRS_INTERVALS[entry.level];
  entry.nextReview = Date.now() + days * 86400000;
  p.srs[qId] = entry;
}

function getSRSQueue(limit = 40) {
  const p = State.progress;
  if (!p.srs) return [];
  const now = Date.now();

  // 到期（含 level 0 還沒複習過的錯題）
  const due = State.allQuestions.filter(q => {
    const e = p.srs[q.id];
    return e && e.nextReview <= now && e.level < SRS_MAX_LEVEL;
  });

  // 依 level 升序（越不熟越優先）
  due.sort((a, b) => (p.srs[a.id]?.level || 0) - (p.srs[b.id]?.level || 0));
  return due.slice(0, limit);
}

function getSRSStats() {
  const p = State.progress;
  if (!p.srs) return { due: 0, learning: 0, mastered: 0 };
  const now = Date.now();
  let due = 0, learning = 0, mastered = 0;
  Object.values(p.srs).forEach(e => {
    if (e.level >= SRS_MAX_LEVEL) mastered++;
    else if (e.nextReview <= now) due++;
    else learning++;
  });
  return { due, learning, mastered };
}

function saveProgress() {
  safeSet('np_progress', JSON.stringify(State.progress));
  safeSet('np_achievements', JSON.stringify(State.achievements));
}
