// ── 手機滑動切換題目：左滑下一題（作答後）、右滑上一題 ──
let quizTouch = null;
function handleQuizTouchStart(e) {
  if (!document.getElementById('screen-quiz')?.classList.contains('active') || e.touches.length !== 1) { quizTouch = null; return; }
  quizTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), target: e.target };
}
function handleQuizTouchEnd(e) {
  const st = quizTouch;
  quizTouch = null;
  if (!st) return;
  const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - st.t > 800) return;
  if (st.target.closest('textarea, input, table, pre, .figure-lightbox, .exam-palette')) return;
  if (dx > 0) { if (State.currentIndex > 0) prevQuestion(); return; }
  if (State.exam) { nextQuestion(); saveSession(); }
  else if (document.getElementById('explanation-panel')?.style.display === 'block') { hideExplanation(); nextQuestion(); }
}

function setEl(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}
