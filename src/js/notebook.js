// ── 筆記本功能 ──

function loadNotes() {
  try { return JSON.parse(localStorage.getItem('np_notes')) || {}; } catch (e) { return {}; }
}
function saveNotes(notes) {
  safeSet('np_notes', JSON.stringify(notes));
}

function toggleNotePanel() {
  const panel = document.getElementById('note-panel');
  if (!panel) return;
  const show = panel.style.display === 'none';
  panel.style.display = show ? 'block' : 'none';
  if (show) {
    const q = State.sessionQuestions[State.currentIndex];
    if (!q) return;
    const notes = loadNotes();
    const ta = document.getElementById('note-textarea');
    if (ta) ta.value = (notes[q.id] && notes[q.id].text) || '';
    ta.focus();
  }
}

function saveCurrentNote() {
  const q = State.sessionQuestions[State.currentIndex];
  if (!q) return;
  const ta = document.getElementById('note-textarea');
  const text = (ta && ta.value || '').trim();
  const notes = loadNotes();

  if (!text) {
    delete notes[q.id];
  } else {
    notes[q.id] = {
      text,
      updatedAt: Date.now(),
      qNum: q.number || q.id,
      year: q.year || '',
      tags: q.tags || [],
      question: (q.question || '').substring(0, 80)
    };
  }
  saveNotes(notes);
  toggleNotePanel();
  updateNoteIndicator(q.id);
  showToast(text ? '筆記已儲存' : '筆記已刪除');
}

function updateNoteIndicator(qid) {
  const ind = document.getElementById('note-indicator');
  const btn = document.getElementById('note-toggle-btn');
  if (!ind || !btn) return;
  const notes = loadNotes();
  const has = notes[qid] && notes[qid].text;
  ind.style.display = has ? 'inline' : 'none';
  btn.textContent = has ? '📝 編輯筆記' : '📝 筆記';
}

function renderNotebook() {
  const list = document.getElementById('notebook-list');
  const empty = document.getElementById('notebook-empty');
  const countEl = document.getElementById('notebook-count');
  if (!list) return;

  const notes = loadNotes();
  let entries = Object.entries(notes);

  // 搜尋篩選
  const search = (document.getElementById('notebook-search') || {}).value || '';
  if (search.trim()) {
    const kw = search.trim().toLowerCase();
    entries = entries.filter(([qid, n]) => (n.text || '').toLowerCase().indexOf(kw) !== -1
      || String(qid).indexOf(kw) !== -1
      || (n.question || '').toLowerCase().indexOf(kw) !== -1
      || (n.tags || []).join(' ').toLowerCase().indexOf(kw) !== -1);
  }

  // 排序
  const sort = (document.getElementById('notebook-sort') || {}).value || 'newest';
  if (sort === 'newest') entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  else if (sort === 'oldest') entries.sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));
  else entries.sort((a, b) => Number(a[0]) - Number(b[0]));

  if (countEl) countEl.textContent = `${entries.length} 筆筆記`;

  if (!entries.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = entries.map(([qid, n]) => {
    const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const tagHtml = (n.tags || []).map(t => `<span class="nb-tag">${t}</span>`).join('');
    const yearHtml = n.year ? ` <span class="nb-card-sub">${n.year}年</span>` : '';

    return `<div class="nb-card">
      <div class="nb-card-head">
        <div><span class="nb-card-qid">Q${qid}</span>${yearHtml}</div>
        <div class="nb-card-meta">
          <span class="nb-card-sub">${dateStr}</span>
          <button class="nb-card-del" onclick="deleteNote(${qid})" title="刪除筆記">✕</button>
        </div>
      </div>
      ${n.question ? `<div class="nb-card-question">${n.question}${n.question.length >= 80 ? '...' : ''}</div>` : ''}
      ${tagHtml ? `<div class="nb-card-tags">${tagHtml}</div>` : ''}
      <div class="notebook-note-content">${md(n.text)}</div>
    </div>`;
  }).join('');
}

function deleteNote(qid) {
  if (!confirm(`確定要刪除 Q${qid} 的筆記嗎？`)) return;
  const notes = loadNotes();
  delete notes[qid];
  saveNotes(notes);
  renderNotebook();
}
