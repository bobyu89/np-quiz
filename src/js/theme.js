(function(){
  var THEMES = ['', 'theme-forest', 'theme-white', 'theme-nightnurse', 'theme-neon', 'theme-wagashi', 'theme-abyss'];
  function applyTheme(t){
    THEMES.forEach(function(c){ if(c) document.body.classList.remove(c); });
    if(t) document.body.classList.add(t);
    document.querySelectorAll('.theme-btn').forEach(function(b){
      b.classList.toggle('active', b.dataset.theme === t);
    });
    safeSet('np_theme', t);
  }
  window.setTheme = function(t){ applyTheme(t); toggleThemeMenu(false); };
  window.toggleThemeMenu = function(force){
    var menu = document.getElementById('theme-menu');
    var open = force !== undefined ? force : menu.style.display === 'none';
    menu.style.display = open ? 'flex' : 'none';
    document.getElementById('theme-toggle-btn').style.transform = open ? 'rotate(20deg)' : '';
  };
  // 套用儲存的主題
  document.addEventListener('DOMContentLoaded', function(){
    var saved = localStorage.getItem('np_theme') || '';
    applyTheme(saved);
    // 點其他地方關閉選單
    document.addEventListener('click', function(e){
      if(!document.getElementById('theme-switcher').contains(e.target)){
        toggleThemeMenu(false);
      }
    });
  });
})();