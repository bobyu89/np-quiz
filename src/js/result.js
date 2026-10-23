// ── 結果頁 ──────────────────────────────────
function endSession() {
  clearInterval(State.timerInterval);
  clearSavedSession();
  const answers = answeredList();
  const total = answers.length;
  const correct = answers.filter(a => a.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // 計算本次各科別正確率（供趨勢圖用）
  const byTag = {};
  answers.forEach(a => {
    if (!a.q) return;
    (a.q.tags || []).forEach(tag => {
      if (!byTag[tag]) byTag[tag] = { correct: 0, total: 0 };
      byTag[tag].total++;
      if (a.correct) byTag[tag].correct++;
    });
  });
  const tagPct = {};
  Object.entries(byTag).forEach(([t, v]) => {
    tagPct[t] = Math.round((v.correct / v.total) * 100);
  });

  // 儲存 session（含科別細項）
  State.progress.sessions.unshift({
    date: new Date().toLocaleDateString('zh-TW'),
    ts: Date.now(),
    total, correct, pct,
    mode: State.mode,
    duration: Math.round((Date.now() - State.sessionStart) / 1000),
    tagPct,
  });
  if (State.progress.sessions.length > 20) State.progress.sessions.pop();
  saveProgress();

  showScreen('result');
  renderResult(correct, total, pct);
  // 詳解 Tab 的內容永遠準備好，讓使用者隨時可切換查看
  // （deferred 模式：自動切換到詳解 Tab；immediate 模式：留在成績 Tab）
  if (State.explainMode === 'deferred') {
    renderDeferredExplanations();
    const el = document.getElementById('deferred-explanations');
    if (el) el.dataset.rendered = '1';
    // 自動切換到詳解 Tab
    if (typeof switchResultTab === 'function') switchResultTab('explanations');
  }
}

function renderResult(correct, total, pct) {
  // 分數
  setEl('result-score', `${pct}%`);
  setEl('result-detail', `${correct} / ${total} 題答對`);

  // 等級
  const rank = getRank(pct);
  const rankEl = document.getElementById('result-rank');
  if (rankEl) {
    rankEl.textContent = rank.label;
    rankEl.style.background = rank.bg;
    rankEl.style.color = rank.color;
    rankEl.style.border = `2px solid ${rank.border}`;
  }

  // 成就
  renderNewAchievements();

  // 雷達圖
  renderRadar();

  // 弱點分析
  renderSessionWeak();
  renderWeakAnalysis();
  renderExamVerdict();
}

function getRank(pct) {
  if (pct >= 95) return { label: '🏆 傳說護理師', bg: '#2d2000', color: '#ffd700', border: '#ffd700' };
  if (pct >= 85) return { label: '👑 精英醫療師', bg: '#1a0030', color: '#c77dff', border: '#c77dff' };
  if (pct >= 75) return { label: '⭐ 資深專科護', bg: '#001a30', color: '#00e5ff', border: '#00e5ff' };
  if (pct >= 60) return { label: '📚 進修中護師', bg: '#002200', color: '#00ff87', border: '#00ff87' };
  return { label: '🌱 見習護理師', bg: '#1a1a1a', color: '#8892b0', border: '#3a4080' };
}

function renderNewAchievements() {
  const newAch = State.newlyUnlocked || [];
  const container = document.getElementById('achievement-list');
  if (!container) return;

  if (newAch.length === 0) {
    container.innerHTML = '<p class="result-empty">本次無新成就解鎖</p>';
    return;
  }

  container.innerHTML = newAch.map(key => {
    const a = ACHIEVEMENTS[key];
    return `<div class="achievement-badge">
      <span class="badge-icon">${a.icon}</span>
      <div>
        <div class="badge-name">${a.name}</div>
        <div class="result-badge-desc">${a.desc}</div>
      </div>
    </div>`;
  }).join('');
}

function renderRadar() {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;

  // 取本次session的科別表現
  const tagStats = {};
  answeredList().forEach(a => {
    a.q.tags.forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { correct: 0, total: 0 };
      tagStats[tag].total++;
      if (a.correct) tagStats[tag].correct++;
    });
  });

  const labels = Object.keys(tagStats);
  const data = labels.map(t =>
    tagStats[t].total > 0 ? Math.round((tagStats[t].correct / tagStats[t].total) * 100) : 0
  );

  if (labels.length === 0) {
    canvas.style.display = 'none';
    return;
  }

  // 用 Chart.js 繪製
  if (window.radarChartInstance) window.radarChartInstance.destroy();
  window.radarChartInstance = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: '正確率 %',
        data,
        backgroundColor: 'rgba(108,99,255,0.25)',
        borderColor: '#6c63ff',
        borderWidth: 2,
        pointBackgroundColor: '#00e5ff',
        pointBorderColor: '#6c63ff',
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e8eaf6', font: { family: 'Noto Sans TC', size: 12 } } }
      },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: {
            stepSize: 20,
            color: '#8892b0',
            font: { size: 10 },
            backdropColor: 'transparent',
          },
          grid: { color: 'rgba(58,64,128,0.5)' },
          angleLines: { color: 'rgba(58,64,128,0.5)' },
          pointLabels: { color: '#e8eaf6', font: { family: 'Noto Sans TC', size: 11 } },
        }
      }
    }
  });
}

function renderWeakAnalysis() {
  const p = State.progress;
  const weakEl = document.getElementById('weak-list');
  if (!weakEl) return;

  // 計算各科別正確率，找出最弱的
  const tagRates = Object.entries(p.byTag)
    .filter(([, v]) => v.total >= 3)
    .map(([tag, v]) => ({
      tag,
      pct: Math.round((v.correct / v.total) * 100),
      total: v.total,
    }))
    .sort((a, b) => a.pct - b.pct);

  if (tagRates.length === 0) {
    weakEl.innerHTML = '<p class="result-empty">資料不足，請多做幾題</p>';
    return;
  }
  // 正確率 80% 以上不算弱點
  if (tagRates[0].pct >= 80) {
    weakEl.innerHTML = '<p class="result-empty">目前各科累計正確率都在 80% 以上 👍</p>';
    return;
  }

  weakEl.innerHTML = tagRates.filter(t => t.pct < 80).slice(0, 5).map((item, i) => {
    const color = item.pct < 50 ? 'var(--color-error-500)' : item.pct < 70 ? 'var(--color-warning-500)' : 'var(--color-success-300)';
    return `<div class="weak-item">
      <span class="weak-rank">${['①','②','③','④','⑤'][i]}</span>
      <span class="weak-name">${item.tag}</span>
      <span class="weak-pct" style="color:${color}">${item.pct}%</span>
      <span class="result-weak-total">(${item.total}題)</span>
      <button class="btn btn-sm btn-secondary result-weak-btn" onclick="startFocusPractice(${focusArg([item.tag])})">練習</button>
    </div>`;
  }).join('');
}
