// ── 畫面切換 ────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
  if (name === 'achievements-screen') renderAllAchievements();
  if (name === 'history-screen') renderHistory();
}

function showError(msg) {
  document.body.innerHTML = `
    <div class="error-screen">
      <div class="error-box">
        ⚠️ 錯誤<br><br>
        <span class="error-detail">${msg}</span>
      </div>
    </div>`;
}

// ── Landing Page ─────────────────────────────
function updateLandingStats() {
  const p = State.progress;
  setEl('stat-total-q', State.allQuestions.length.toLocaleString());
  setEl('stat-answered', (p?.totalAnswered || 0).toLocaleString());
  setEl('stat-accuracy', p?.totalAnswered
    ? `${Math.round((p.totalCorrect / p.totalAnswered) * 100)}%`
    : '--');
  setEl('stat-achievements', `${Object.keys(State.achievements).length}/${Object.keys(ACHIEVEMENTS).length}`);
}
