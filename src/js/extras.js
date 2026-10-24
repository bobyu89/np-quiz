// ── 額外功能 ──

// ── 結果頁 Tab 切換 ──
function switchResultTab(tab) {
  const isScore = tab === 'score';
  document.getElementById('tab-score').style.display = isScore ? 'block' : 'none';
  document.getElementById('tab-explanations').style.display = isScore ? 'none' : 'block';

  const btnScore = document.getElementById('tab-btn-score');
  const btnExp = document.getElementById('tab-btn-explanations');
  if (btnScore) btnScore.classList.toggle('active', isScore);
  if (btnExp) btnExp.classList.toggle('active', !isScore);

  // 切換到詳解頁時確保內容已渲染
  if (!isScore) {
    const el = document.getElementById('deferred-explanations');
    if (el && !el.dataset.rendered) {
      renderDeferredExplanations();
      el.dataset.rendered = '1';
    }
  }
}

function confirmEnd() {
  const answered = State.exam ? State.exam.picks.filter(Boolean).length : answeredList().length;
  // 一題都沒答：直接結束，不留下 0 題的成績紀錄
  if (answered === 0) {
    if (!confirm(State.exam ? '尚未作答任何題目，要放棄這次模擬考嗎？' : '尚未作答任何題目，要結束這次練習嗎？')) return;
    clearInterval(State.timerInterval);
    clearSavedSession();
    State.exam = null;
    showScreen('landing');
    updateLandingStats();
    return;
  }
  if (State.exam) {
    const blank = State.exam.picks.length - answered;
    if (!confirm(blank ? `還有 ${blank} 題未作答（以 0 分計），確定要交卷嗎？` : '確定要交卷嗎？')) return;
    submitExam();
    return;
  }
  const rem = State.sessionQuestions.length - answered;
  if (rem > 0 && !confirm(`還有 ${rem} 題未作答，確定要交卷嗎？`)) return;
  clearInterval(State.timerInterval);
  endSession();
}

function renderAllAchievements() {
  const grid = document.getElementById('all-achievements-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(ACHIEVEMENTS).map(([key, ach]) => {
    const unlocked = State.achievements[key];
    return `<div class="achievements-card${unlocked ? '' : ' locked'}">
      <div class="achievements-icon">${ach.icon}</div>
      <div class="achievements-name">${ach.name}</div>
      <div class="achievements-desc">${ach.desc}</div>
      ${unlocked ? '<div class="achievements-unlocked">已解鎖</div>' : ''}
    </div>`;
  }).join('');
}

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  const sessions = (State.progress && State.progress.sessions) || [];
  if (!sessions.length) {
    el.innerHTML = '<p class="history-empty">尚無練習紀錄</p>';
    return;
  }

  // ── 趨勢折線圖 ──
  renderTrendChart(sessions);

  // ── SRS 狀態卡 ──
  const srs = getSRSStats();
  const srsCards = [
    ['due', srs.due, '待複習'],
    ['learning', srs.learning, '學習中'],
    ['mastered', srs.mastered, '已掌握'],
  ];
  const srsHtml = `<div class="history-srs">
    ${srsCards.map(([kind, num, label]) => `<div class="history-srs-card">
      <div class="history-srs-num history-srs-${kind}">${num}</div>
      <div class="history-srs-label">${label}</div>
    </div>`).join('')}
  </div>`;

  // ── 歷次列表 ──
  const modeLabels = { mixed: '混合', year: '年份', subject: '科別', srs: '智慧複習', weak: '錯題', exam: '模擬考', focus: '弱點加強', topic: '考點' };
  const listHtml = sessions.map((s, i) => {
    const col = s.pct >= 75 ? 'var(--color-success-300)' : s.pct >= 60 ? 'var(--color-warning-500)' : 'var(--color-error-500)';
    const modeLabel = modeLabels[s.mode] || s.mode || '';
    const sec = `0${s.duration % 60}`.slice(-2);
    const durMin = s.duration ? `${Math.floor(s.duration / 60)}m${sec}s` : '';
    return `<div class="history-item">
      <span class="history-item-no">#${sessions.length - i}</span>
      <span class="history-item-date">${s.date}</span>
      <span class="history-item-pct" style="color:${col}">${s.pct}%</span>
      <span class="history-item-count">${s.correct}/${s.total} 題</span>
      ${modeLabel ? `<span class="history-item-mode">${modeLabel}</span>` : ''}
      ${durMin ? `<span class="history-item-dur">⏱ ${durMin}</span>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = srsHtml + listHtml;
}

function renderTrendChart(sessions) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas || !window.Chart) return;

  // 最近10次，由舊到新
  const data = [...sessions].reverse().slice(-10);
  const labels = data.map(s => s.date);
  const overall = data.map(s => s.pct);

  // 找最多出現的3個科別
  const tagCount = {};
  data.forEach(s => {
    if (s.tagPct) Object.keys(s.tagPct).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
  });
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

  const tagColors = ['#f59f00', '#22c55e', '#a78bfa'];
  const datasets = [{
    label: '整體',
    data: overall,
    borderColor: '#0a5aff',
    backgroundColor: 'rgba(10,90,255,0.1)',
    tension: 0.3,
    fill: true,
    pointRadius: 4,
    borderWidth: 2,
  }];
  topTags.forEach((tag, i) => {
    datasets.push({
      label: tag,
      data: data.map(s => (s.tagPct && s.tagPct[tag] != null ? s.tagPct[tag] : null)),
      borderColor: tagColors[i],
      backgroundColor: 'transparent',
      tension: 0.3,
      fill: false,
      pointRadius: 3,
      borderWidth: 1.5,
      borderDash: [4, 3],
    });
  });

  // 銷毀舊圖表
  if (window._trendChart) window._trendChart.destroy();
  window._trendChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'var(--color-text-secondary)', font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
      },
      scales: {
        x: { ticks: { color: 'var(--color-text-muted)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: {
          min: 0,
          max: 100,
          ticks: { color: 'var(--color-text-muted)', font: { size: 10 }, callback: v => `${v}%` },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
    },
  });
}
