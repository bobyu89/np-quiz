
/* ── 額外功能 ── */

/* 結果頁 Tab 切換 */
function switchResultTab(tab) {
  var isScore = tab === 'score';
  document.getElementById('tab-score').style.display = isScore ? 'block' : 'none';
  document.getElementById('tab-explanations').style.display = isScore ? 'none' : 'block';

  var primary = 'var(--color-primary-500)';
  var muted   = 'var(--color-text-muted)';
  var btnScore = document.getElementById('tab-btn-score');
  var btnExp   = document.getElementById('tab-btn-explanations');
  if (btnScore) {
    btnScore.style.color = isScore ? primary : muted;
    btnScore.style.borderBottomColor = isScore ? primary : 'transparent';
  }
  if (btnExp) {
    btnExp.style.color = isScore ? muted : primary;
    btnExp.style.borderBottomColor = isScore ? 'transparent' : primary;
  }

  // 切換到詳解頁時確保內容已渲染
  if (!isScore) {
    var el = document.getElementById('deferred-explanations');
    if (el && !el.dataset.rendered) {
      renderDeferredExplanations();
      el.dataset.rendered = '1';
    }
  }
}

function confirmEnd(){
  var answered=State.exam?State.exam.picks.filter(Boolean).length:answeredList().length;
  // 一題都沒答：直接結束，不留下 0 題的成績紀錄
  if(answered===0){
    if(!confirm(State.exam?'尚未作答任何題目，要放棄這次模擬考嗎？':'尚未作答任何題目，要結束這次練習嗎？'))return;
    clearInterval(State.timerInterval);clearSavedSession();State.exam=null;
    showScreen('landing');updateLandingStats();return;
  }
  if(State.exam){
    var blank=State.exam.picks.length-answered;
    if(!confirm(blank?'還有 '+blank+' 題未作答（以 0 分計），確定要交卷嗎？':'確定要交卷嗎？'))return;
    submitExam();return;
  }
  var rem=State.sessionQuestions.length-answered;
  if(rem>0&&!confirm('還有 '+rem+' 題未作答，確定要交卷嗎？'))return;
  clearInterval(State.timerInterval);endSession();
}

function renderAllAchievements(){
  var grid=document.getElementById('all-achievements-grid');
  if(!grid)return;
  grid.innerHTML=Object.entries(ACHIEVEMENTS).map(function(pair){
    var key=pair[0],ach=pair[1],unlocked=State.achievements[key];
    return '<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);padding:20px;text-align:center;opacity:'+(unlocked?1:0.4)+'">'
      +'<div style="font-size:32px;margin-bottom:8px">'+ach.icon+'</div>'
      +'<div style="font-family:\'Press Start 2P\',monospace;font-size:9px;color:'+(unlocked?'var(--color-secondary-300)':'var(--color-text-muted)')+'">'+ach.name+'</div>'
      +'<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px">'+ach.desc+'</div>'
      +(unlocked?'<div style="font-size:10px;color:var(--color-success-300);margin-top:8px">已解鎖</div>':'')
      +'</div>';
  }).join('');
}

function renderHistory(){
  var el=document.getElementById('history-list');
  if(!el)return;
  var sessions=(State.progress&&State.progress.sessions)||[];
  if(!sessions.length){el.innerHTML='<p style="color:var(--color-text-muted)">尚無練習紀錄</p>';return;}

  // ── 趨勢折線圖 ──
  renderTrendChart(sessions);

  // ── SRS 狀態卡 ──
  var srs=getSRSStats();
  var srsHtml='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">'
    +'<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);padding:16px 20px;flex:1;min-width:120px;text-align:center">'
    +'<div style="font-size:24px;font-weight:700;color:var(--color-error-300)">'+srs.due+'</div>'
    +'<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">待複習</div></div>'
    +'<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);padding:16px 20px;flex:1;min-width:120px;text-align:center">'
    +'<div style="font-size:24px;font-weight:700;color:var(--color-warning-500)">'+srs.learning+'</div>'
    +'<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">學習中</div></div>'
    +'<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);padding:16px 20px;flex:1;min-width:120px;text-align:center">'
    +'<div style="font-size:24px;font-weight:700;color:var(--color-success-300)">'+srs.mastered+'</div>'
    +'<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">已掌握</div></div>'
    +'</div>';

  // ── 歷次列表 ──
  var listHtml=sessions.map(function(s,i){
    var col=s.pct>=75?'var(--color-success-300)':s.pct>=60?'var(--color-warning-500)':'var(--color-error-500)';
    var modeLabel={'mixed':'混合','year':'年份','subject':'科別','srs':'智慧複習','weak':'錯題','exam':'模擬考','focus':'弱點加強','topic':'考點'}[s.mode]||s.mode||'';
    var durMin=s.duration?Math.floor(s.duration/60)+'m'+('0'+s.duration%60).slice(-2)+'s':'';
    return '<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);padding:14px 20px;margin-bottom:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      +'<span style="font-family:\'Press Start 2P\',monospace;font-size:11px;color:var(--color-secondary-300)">#'+(sessions.length-i)+'</span>'
      +'<span style="font-size:13px;color:var(--color-text-muted)">'+s.date+'</span>'
      +'<span style="font-size:16px;font-weight:700;color:'+col+'">'+s.pct+'%</span>'
      +'<span style="font-size:13px">'+s.correct+'/'+s.total+' 題</span>'
      +(modeLabel?'<span style="font-size:11px;color:var(--color-text-muted);background:var(--color-bg-overlay);padding:2px 8px;border-radius:4px">'+modeLabel+'</span>':'')
      +(durMin?'<span style="font-size:11px;color:var(--color-text-muted)">⏱ '+durMin+'</span>':'')
      +'</div>';
  }).join('');

  el.innerHTML=srsHtml+listHtml;
}

function renderTrendChart(sessions){
  var canvas=document.getElementById('trend-chart');
  if(!canvas||!window.Chart)return;

  // 最近10次，由舊到新
  var data=[...sessions].reverse().slice(-10);
  var labels=data.map(function(s){return s.date;});
  var overall=data.map(function(s){return s.pct;});

  // 找最多出現的3個科別
  var tagCount={};
  data.forEach(function(s){
    if(s.tagPct) Object.keys(s.tagPct).forEach(function(t){ tagCount[t]=(tagCount[t]||0)+1; });
  });
  var topTags=Object.entries(tagCount).sort(function(a,b){return b[1]-a[1];}).slice(0,3).map(function(e){return e[0];});

  var tagColors=['#f59f00','#22c55e','#a78bfa'];
  var datasets=[{
    label:'整體',
    data:overall,
    borderColor:'#0a5aff',
    backgroundColor:'rgba(10,90,255,0.1)',
    tension:0.3,
    fill:true,
    pointRadius:4,
    borderWidth:2,
  }];
  topTags.forEach(function(tag,i){
    datasets.push({
      label:tag,
      data:data.map(function(s){return s.tagPct&&s.tagPct[tag]!=null?s.tagPct[tag]:null;}),
      borderColor:tagColors[i],
      backgroundColor:'transparent',
      tension:0.3,
      fill:false,
      pointRadius:3,
      borderWidth:1.5,
      borderDash:[4,3],
    });
  });

  // 銷毀舊圖表
  if(window._trendChart) window._trendChart.destroy();
  window._trendChart=new Chart(canvas,{
    type:'line',
    data:{labels:labels,datasets:datasets},
    options:{
      responsive:true,
      plugins:{
        legend:{labels:{color:'var(--color-text-secondary)',font:{size:11}}},
        tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y+'%';}}},
      },
      scales:{
        x:{ticks:{color:'var(--color-text-muted)',font:{size:10}},grid:{color:'rgba(255,255,255,0.05)'}},
        y:{min:0,max:100,ticks:{color:'var(--color-text-muted)',font:{size:10},callback:function(v){return v+'%';}},
           grid:{color:'rgba(255,255,255,0.05)'}},
      },
    },
  });
}
