// ── 考點分析 ──

function renderTopicsOverview() {
  setEl('topics-total', State.allQuestions.length.toLocaleString());
  const grid = document.getElementById('topics-overview-grid');
  if (!grid || !window.__TOPICS) return;
  const T = window.__TOPICS;

  grid.innerHTML = Object.entries(SUBJECT_CATEGORIES).map(([catName, tags]) => {
    const cards = tags.map(tag => {
      const topics = T[tag];
      if (!topics) return '';
      const sorted = Object.entries(topics).sort((a, b) => b[1].count - a[1].count);
      const totalQ = sorted.reduce((s, e) => s + e[1].count, 0);
      const top3 = sorted.filter(([name]) => name !== '其他').slice(0, 3);

      const lines = top3.map(([name, info]) => {
        const stars = Array.from({ length: 5 }, (_, i) => (i < info.stars ? '★' : '☆')).join('');
        const col = info.stars >= 4 ? 'var(--color-error-300)' : info.stars >= 3 ? 'var(--color-warning-500)' : 'var(--color-text-muted)';
        return `<div class="topic-card-line"><span class="topic-card-stars" style="color:${col}">${stars}</span> ${name} <span class="topic-muted">(${info.count})</span></div>`;
      }).join('');

      return `<div class="topic-card" onclick="showTopicDetail('${tag}')">
        <div class="topic-card-name">${tag}</div>
        <div class="topic-card-meta">${totalQ} 題 · ${sorted.length} 個考點</div>
        ${lines}
      </div>`;
    }).join('');

    return `<div class="topic-cat">
      <div class="topic-cat-title">${catName}</div>
      <div class="topic-grid">${cards}</div>
    </div>`;
  }).join('');
}

function showTopicDetail(tag) {
  showScreen('topics-detail');
  renderTopicDetail(tag);
}

function renderTopicDetail(tag) {
  const titleEl = document.getElementById('topics-detail-title');
  const statsEl = document.getElementById('topics-detail-stats');
  const container = document.getElementById('topics-detail-container');
  if (!container || !window.__TOPICS) return;
  if (titleEl) titleEl.textContent = `🔥 ${tag}`;

  const topics = window.__TOPICS[tag];
  if (!topics) { container.innerHTML = '<p>無資料</p>'; return; }

  const sorted = Object.entries(topics).sort((a, b) => b[1].count - a[1].count);
  const totalQ = sorted.reduce((s, e) => s + e[1].count, 0);

  if (statsEl) {
    statsEl.innerHTML = `<span class="topic-muted">共 ${totalQ} 題（含重複標記）· ${sorted.length} 個考點主題</span>`;
  }

  const section = (title, body) => `<div class="topic-section"><div class="topic-section-title">${title}</div>${body}</div>`;
  const callout = (type, title, items) => `<div class="topic-callout topic-callout-${type}"><div class="topic-callout-title">${title}</div>${
    items.map(p => `<div class="topic-callout-point">• ${p}</div>`).join('')
  }</div>`;

  container.innerHTML = sorted.map(([name, info]) => {
    const stars = Array.from({ length: 5 }, (_, i) => (i < info.stars
      ? '<span class="topic-star-on">★</span>'
      : '<span class="topic-star-off">☆</span>')).join('');
    const starBg = info.stars >= 5 ? 'var(--color-error-300)' : info.stars >= 4 ? 'var(--color-warning-500)' : info.stars >= 3 ? 'var(--color-primary-500)' : 'var(--color-text-muted)';
    const yearTags = (info.years || []).map(y => `<span class="topic-year">${y}</span>`).join('');

    // 展開內容：考點簡介、常見考法、練習按鈕
    let body = '';

    // 考點簡介（__TOPIC_INTROS）
    const intros = window.__TOPIC_INTROS && window.__TOPIC_INTROS[tag];
    const intro = intros && intros[name];
    if (intro) {
      if (intro.summary) {
        body += `<div class="topic-intro-summary">${intro.summary}</div>`;
      }
      if (intro.definition) {
        body += section('📖 定義與機轉', `<div class="topic-section-text">${intro.definition}</div>`);
      }
      if (intro.keyPoints && intro.keyPoints.length) {
        body += section('🎯 重點整理', intro.keyPoints.map(p => `<div class="topic-point">• ${p}</div>`).join(''));
      }
      if (intro.comparison) {
        body += section('⚖️ 比較對照', `<div class="topic-comparison">${md(intro.comparison)}</div>`);
      }
      if (intro.criteria) {
        body += section('📋 診斷標準／數值', `<div class="topic-comparison">${md(intro.criteria)}</div>`);
      }
      if (intro.mustKnow && intro.mustKnow.length) {
        body += callout('must', '🔴 必背重點', intro.mustKnow);
      }
      if (intro.traps && intro.traps.length) {
        body += callout('trap', '⚠️ 常考陷阱', intro.traps);
      }
      if (intro.mnemonics && intro.mnemonics.length) {
        body += callout('mnemonic', '💡 記憶口訣', intro.mnemonics);
      }
      body += '<hr class="topic-divider">';
    }

    // 常見考法
    if (info.samples && info.samples.length) {
      body += '<div class="topic-samples-label">常見考法：</div>';
      body += info.samples.map(s => `<div class="topic-sample">• ${s}</div>`).join('');
    }
    // 快速練習
    if (info.qids && info.qids.length && name !== '其他') {
      body += `<div class="topic-practice"><button class="btn btn-sm btn-primary" onclick="startTopicPractice('${tag}','${name.replace(/'/g, "\\'")}')">⚔️ 練習這個考點 (${info.qids.length}題)</button></div>`;
    }

    return `<details class="topic-item">
      <summary class="topic-item-summary">
        <div class="topic-item-stars">${stars}</div>
        <div class="topic-item-main">
          <div class="topic-item-name">${name}</div>
          <div class="topic-item-meta">${info.count} 題　${yearTags}</div>
        </div>
        <div class="topic-item-count" style="color:${starBg}">${info.count}</div>
      </summary>
      <div class="topic-item-body">${body}</div>
    </details>`;
  }).join('');
}

function startTopicPractice(tag, topicName) {
  const topics = window.__TOPICS && window.__TOPICS[tag];
  if (!topics || !topics[topicName]) return;
  const qids = topics[topicName].qids;
  const idMap = new Map(State.allQuestions.map(q => [q.id, q]));
  const pool = qids.map(id => idMap.get(id)).filter(Boolean);
  if (!pool.length) { alert('找不到對應題目'); return; }
  shuffle(pool);
  State.mode = 'topic';
  State.selectedCount = pool.length;
  State.exam = null;
  State.sessionQuestions = pool;
  State.currentIndex = 0;
  State.userAnswers = [];
  State.streak = 0;
  State.maxStreak = 0;
  State.sessionStart = Date.now();
  clearInterval(State.timerInterval);
  showScreen('quiz');
  renderQuestion();
}
