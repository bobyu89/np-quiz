/* ── 考點分析 ── */

function renderTopicsOverview(){
  setEl('topics-total', State.allQuestions.length.toLocaleString());
  var grid=document.getElementById('topics-overview-grid');
  if(!grid||!window.__TOPICS) return;
  var T=window.__TOPICS;
  var cats=SUBJECT_CATEGORIES;
  var html='';

  Object.entries(cats).forEach(function(pair){
    var catName=pair[0], tags=pair[1];
    html+='<div style="margin-bottom:36px">';
    html+='<div style="font-family:\'Press Start 2P\',monospace;font-size:10px;color:var(--color-secondary-300);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--color-bg-border)">'+catName+'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">';

    tags.forEach(function(tag){
      var topics=T[tag];
      if(!topics) return;
      var sorted=Object.entries(topics).sort(function(a,b){return b[1].count-a[1].count;});
      var totalQ=sorted.reduce(function(s,e){return s+e[1].count;},0);
      var topicCount=sorted.length;
      var top3=sorted.filter(function(e){return e[0]!=='其他';}).slice(0,3);

      html+='<div onclick="showTopicDetail(\''+tag+'\')" style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);border-radius:8px;padding:18px;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity=\'.8\'" onmouseout="this.style.opacity=\'1\'">';
      html+='<div style="font-size:15px;font-weight:700;color:var(--color-text-primary);margin-bottom:10px">'+tag+'</div>';
      html+='<div style="font-size:12px;color:var(--color-text-muted);margin-bottom:10px">'+totalQ+' 題 · '+topicCount+' 個考點</div>';
      top3.forEach(function(e){
        var name=e[0],info=e[1];
        var stars='';for(var i=0;i<5;i++)stars+=i<info.stars?'★':'☆';
        var col=info.stars>=4?'var(--color-error-300)':info.stars>=3?'var(--color-warning-500)':'var(--color-text-muted)';
        html+='<div style="font-size:12px;margin-bottom:4px"><span style="color:'+col+';font-size:11px">'+stars+'</span> '+name+' <span style="color:var(--color-text-muted)">('+info.count+')</span></div>';
      });
      html+='</div>';
    });
    html+='</div></div>';
  });
  grid.innerHTML=html;
}

function showTopicDetail(tag){
  showScreen('topics-detail');
  renderTopicDetail(tag);
}

function renderTopicDetail(tag){
  var titleEl=document.getElementById('topics-detail-title');
  var statsEl=document.getElementById('topics-detail-stats');
  var container=document.getElementById('topics-detail-container');
  if(!container||!window.__TOPICS) return;
  if(titleEl) titleEl.textContent='🔥 '+tag;

  var topics=window.__TOPICS[tag];
  if(!topics){container.innerHTML='<p>無資料</p>';return;}

  var sorted=Object.entries(topics).sort(function(a,b){return b[1].count-a[1].count;});
  var totalQ=sorted.reduce(function(s,e){return s+e[1].count;},0);

  if(statsEl){
    statsEl.innerHTML='<span style="color:var(--color-text-muted)">共 '+totalQ+' 題（含重複標記）· '+sorted.length+' 個考點主題</span>';
  }

  var html='';
  sorted.forEach(function(pair){
    var name=pair[0], info=pair[1];
    var stars='';for(var i=0;i<5;i++)stars+=i<info.stars?'<span style="color:var(--color-warning-500)">★</span>':'<span style="color:var(--color-bg-border)">☆</span>';
    var starBg=info.stars>=5?'var(--color-error-300)':info.stars>=4?'var(--color-warning-500)':info.stars>=3?'var(--color-primary-500)':'var(--color-text-muted)';
    var yearTags=(info.years||[]).map(function(y){return '<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;background:var(--color-bg-overlay);color:var(--color-text-muted);margin-right:4px">'+y+'</span>';}).join('');

    html+='<details style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);border-radius:8px;margin-bottom:12px;overflow:hidden">';
    html+='<summary style="padding:16px 20px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:14px;flex-wrap:wrap;outline:none">';
    html+='<div style="font-size:14px;letter-spacing:1px">'+stars+'</div>';
    html+='<div style="flex:1;min-width:150px">';
    html+='<div style="font-size:15px;font-weight:700;color:var(--color-text-primary)">'+name+'</div>';
    html+='<div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">'+info.count+' 題　'+yearTags+'</div>';
    html+='</div>';
    html+='<div style="font-size:20px;font-weight:700;color:'+starBg+'">'+info.count+'</div>';
    html+='</summary>';

    // Expanded content: intro + samples + practice button
    html+='<div style="padding:4px 20px 16px;border-top:1px solid var(--color-bg-border)">';

    // Topic intro from __TOPIC_INTROS
    var intros=window.__TOPIC_INTROS&&window.__TOPIC_INTROS[tag];
    var intro=intros&&intros[name];
    if(intro){
      // Summary
      if(intro.summary){
        html+='<div style="font-size:14px;color:var(--color-text-primary);line-height:1.7;margin:12px 0;padding:12px 16px;background:var(--color-bg-overlay);border-radius:8px;border-left:3px solid var(--color-primary-500)">'+intro.summary+'</div>';
      }
      // Definition
      if(intro.definition){
        html+='<div style="margin:12px 0"><div style="font-size:12px;font-weight:700;color:var(--color-secondary-300);margin-bottom:6px">📖 定義與機轉</div>';
        html+='<div style="font-size:13px;color:var(--color-text-secondary);line-height:1.7">'+intro.definition+'</div></div>';
      }
      // Key Points
      if(intro.keyPoints&&intro.keyPoints.length){
        html+='<div style="margin:12px 0"><div style="font-size:12px;font-weight:700;color:var(--color-secondary-300);margin-bottom:6px">🎯 重點整理</div>';
        intro.keyPoints.forEach(function(p){
          html+='<div style="font-size:13px;color:var(--color-text-secondary);padding:4px 0;line-height:1.6">• '+p+'</div>';
        });
        html+='</div>';
      }
      // Comparison table
      if(intro.comparison){
        html+='<div style="margin:12px 0"><div style="font-size:12px;font-weight:700;color:var(--color-secondary-300);margin-bottom:6px">⚖️ 比較對照</div>';
        html+='<div class="topic-comparison" style="font-size:13px;overflow-x:auto">'+md(intro.comparison)+'</div></div>';
      }
      // Criteria
      if(intro.criteria){
        html+='<div style="margin:12px 0"><div style="font-size:12px;font-weight:700;color:var(--color-secondary-300);margin-bottom:6px">📋 診斷標準／數值</div>';
        html+='<div class="topic-comparison" style="font-size:13px;overflow-x:auto">'+md(intro.criteria)+'</div></div>';
      }
      // Must Know
      if(intro.mustKnow&&intro.mustKnow.length){
        html+='<div style="margin:12px 0;padding:12px 16px;background:rgba(239,68,68,0.08);border-radius:8px;border-left:3px solid var(--color-error-300)"><div style="font-size:12px;font-weight:700;color:var(--color-error-300);margin-bottom:6px">🔴 必背重點</div>';
        intro.mustKnow.forEach(function(p){
          html+='<div style="font-size:13px;color:var(--color-text-primary);padding:3px 0;line-height:1.6">• '+p+'</div>';
        });
        html+='</div>';
      }
      // Traps
      if(intro.traps&&intro.traps.length){
        html+='<div style="margin:12px 0;padding:12px 16px;background:rgba(245,158,11,0.08);border-radius:8px;border-left:3px solid var(--color-warning-500)"><div style="font-size:12px;font-weight:700;color:var(--color-warning-500);margin-bottom:6px">⚠️ 常考陷阱</div>';
        intro.traps.forEach(function(p){
          html+='<div style="font-size:13px;color:var(--color-text-primary);padding:3px 0;line-height:1.6">• '+p+'</div>';
        });
        html+='</div>';
      }
      // Mnemonics
      if(intro.mnemonics&&intro.mnemonics.length){
        html+='<div style="margin:12px 0;padding:12px 16px;background:rgba(99,102,241,0.08);border-radius:8px;border-left:3px solid var(--color-primary-500)"><div style="font-size:12px;font-weight:700;color:var(--color-primary-500);margin-bottom:6px">💡 記憶口訣</div>';
        intro.mnemonics.forEach(function(p){
          html+='<div style="font-size:13px;color:var(--color-text-primary);padding:3px 0;line-height:1.6">• '+p+'</div>';
        });
        html+='</div>';
      }

      html+='<hr style="border:none;border-top:1px solid var(--color-bg-border);margin:16px 0">';
    }

    // Sample exam patterns
    if(info.samples&&info.samples.length){
      html+='<div style="font-size:12px;color:var(--color-text-muted);margin:10px 0 6px">常見考法：</div>';
      info.samples.forEach(function(s){
        html+='<div style="font-size:13px;color:var(--color-text-secondary);padding:3px 0;line-height:1.5">• '+s+'</div>';
      });
    }
    // Quick practice button
    if(info.qids&&info.qids.length&&name!=='其他'){
      html+='<div style="margin-top:12px"><button class="btn btn-sm btn-primary" onclick="startTopicPractice(\''+tag+'\',\''+name.replace(/'/g,"\\'")+'\')">⚔️ 練習這個考點 ('+info.qids.length+'題)</button></div>';
    }
    html+='</div></details>';
  });

  container.innerHTML=html;
}

function startTopicPractice(tag, topicName){
  var topics=window.__TOPICS&&window.__TOPICS[tag];
  if(!topics||!topics[topicName]) return;
  var qids=topics[topicName].qids;
  var idMap=new Map(State.allQuestions.map(function(q){return [q.id,q];}));
  var pool=qids.map(function(id){return idMap.get(id);}).filter(Boolean);
  if(!pool.length){alert('找不到對應題目');return;}
  shuffle(pool);
  State.mode='topic';
  State.selectedCount=pool.length;
  State.exam=null;
  State.sessionQuestions=pool;
  State.currentIndex=0;
  State.userAnswers=[];
  State.streak=0;
  State.maxStreak=0;
  State.sessionStart=Date.now();
  clearInterval(State.timerInterval);
  showScreen('quiz');
  renderQuestion();
}
