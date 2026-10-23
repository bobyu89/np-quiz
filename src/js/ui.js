// ── Toast 通知 ──────────────────────────────
function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── 工具函式 ────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Markdown → 已消毒的 HTML（筆記可能來自他人分享的匯入檔）
function md(text) {
  return DOMPurify.sanitize(marked.parse(text || ''));
}

// 題幹＋附圖。組合題的 ①②③④ 各自換行，較好閱讀。
function questionHtml(q) {
  let text = q.question;
  if ((text.match(/[①-⑩]/g) || []).length >= 2) text = text.replace(/\s*([①-⑩])/g, (m, c, i) => `${i ? '<br>' : ''}${c}`);
  return `${text}${q.image ? `<img class="q-figure" src="${q.image}" alt="題目附圖" title="點擊放大">` : ''}`;
}

// ── 附圖放大 ──
function openFigure(src) {
  const box = document.createElement('div');
  box.className = 'figure-lightbox';
  box.innerHTML = `<img src="${src}" alt="題目附圖"><button aria-label="關閉">✕</button>`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}

// ── 鍵盤作答（桌機）：A–D 或 1–4 選答，Enter／→ 下一題，Esc 關閉放大圖 ──
function handleQuizKeys(e) {
  if (e.key === 'Escape') { document.querySelector('.figure-lightbox')?.remove(); closeExamPalette(); return; }
  if (document.querySelector('.exam-palette')) return;
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (!document.getElementById('screen-quiz')?.classList.contains('active')) return;
  const letter = { a: 'A', b: 'B', c: 'C', d: 'D', 1: 'A', 2: 'B', 3: 'C', 4: 'D' }[e.key.toLowerCase()];
  const btn = letter && document.getElementById(`opt-${letter}`);
  if (btn && !btn.disabled) { e.preventDefault(); selectAnswer(letter); return; }
  if (State.exam) {
    if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); nextQuestion(); saveSession(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevQuestion(); }
    return;
  }
  if ((e.key === 'Enter' || e.key === 'ArrowRight') && document.getElementById('explanation-panel')?.style.display === 'block') {
    e.preventDefault(); hideExplanation(); nextQuestion();
  }
}
