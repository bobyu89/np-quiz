// ── 主題切換 ────────────────────────────────
const THEMES = ['', 'theme-forest', 'theme-white', 'theme-nightnurse', 'theme-neon', 'theme-wagashi', 'theme-abyss'];

function applyTheme(t) {
  THEMES.forEach(c => { if (c) document.body.classList.remove(c); });
  if (t) document.body.classList.add(t);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === t);
  });
  safeSet('np_theme', t);
}

function setTheme(t) {
  applyTheme(t);
  toggleThemeMenu(false);
}

function toggleThemeMenu(force) {
  const menu = document.getElementById('theme-menu');
  const open = force !== undefined ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  document.getElementById('theme-toggle-btn').classList.toggle('open', open);
}

// 套用儲存的主題
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('np_theme') || '';
  applyTheme(saved);
  // 點其他地方關閉選單
  document.addEventListener('click', e => {
    if (!document.getElementById('theme-switcher').contains(e.target)) {
      toggleThemeMenu(false);
    }
  });
});
