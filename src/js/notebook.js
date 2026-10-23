/* ── 筆記本功能 ── */

function loadNotes(){
  try{ return JSON.parse(localStorage.getItem('np_notes'))||{}; }catch(e){ return {}; }
}
function saveNotes(notes){
  safeSet('np_notes', JSON.stringify(notes));
}

function toggleNotePanel(){
  var panel=document.getElementById('note-panel');
  if(!panel) return;
  var show=panel.style.display==='none';
  panel.style.display=show?'block':'none';
  if(show){
    var q=State.sessionQuestions[State.currentIndex];
    if(!q) return;
    var notes=loadNotes();
    var ta=document.getElementById('note-textarea');
    if(ta) ta.value=(notes[q.id]&&notes[q.id].text)||'';
    ta.focus();
  }
}

function saveCurrentNote(){
  var q=State.sessionQuestions[State.currentIndex];
  if(!q) return;
  var ta=document.getElementById('note-textarea');
  var text=(ta&&ta.value||'').trim();
  var notes=loadNotes();

  if(!text){
    delete notes[q.id];
  } else {
    notes[q.id]={
      text: text,
      updatedAt: Date.now(),
      qNum: q.number||q.id,
      year: q.year||'',
      tags: q.tags||[],
      question: (q.question||'').substring(0,80)
    };
  }
  saveNotes(notes);
  toggleNotePanel();
  updateNoteIndicator(q.id);
  showToast(text?'筆記已儲存':'筆記已刪除');
}

function updateNoteIndicator(qid){
  var ind=document.getElementById('note-indicator');
  var btn=document.getElementById('note-toggle-btn');
  if(!ind||!btn) return;
  var notes=loadNotes();
  var has=notes[qid]&&notes[qid].text;
  ind.style.display=has?'inline':'none';
  btn.textContent=has?'📝 編輯筆記':'📝 筆記';
}

function renderNotebook(){
  var list=document.getElementById('notebook-list');
  var empty=document.getElementById('notebook-empty');
  var countEl=document.getElementById('notebook-count');
  if(!list) return;

  var notes=loadNotes();
  var entries=Object.entries(notes);

  // Search filter
  var search=(document.getElementById('notebook-search')||{}).value||'';
  if(search.trim()){
    var kw=search.trim().toLowerCase();
    entries=entries.filter(function(e){
      var n=e[1];
      return (n.text||'').toLowerCase().indexOf(kw)!==-1
        || String(e[0]).indexOf(kw)!==-1
        || (n.question||'').toLowerCase().indexOf(kw)!==-1
        || (n.tags||[]).join(' ').toLowerCase().indexOf(kw)!==-1;
    });
  }

  // Sort
  var sort=(document.getElementById('notebook-sort')||{}).value||'newest';
  if(sort==='newest') entries.sort(function(a,b){return (b[1].updatedAt||0)-(a[1].updatedAt||0);});
  else if(sort==='oldest') entries.sort(function(a,b){return (a[1].updatedAt||0)-(b[1].updatedAt||0);});
  else entries.sort(function(a,b){return Number(a[0])-Number(b[0]);});

  if(countEl) countEl.textContent=entries.length+' 筆筆記';

  if(!entries.length){
    list.innerHTML='';
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';

  var html='';
  entries.forEach(function(pair){
    var qid=pair[0], n=pair[1];
    var dateStr=n.updatedAt?new Date(n.updatedAt).toLocaleDateString('zh-TW',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    var tagHtml=(n.tags||[]).map(function(t){
      return '<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:3px;background:var(--color-bg-overlay);color:var(--color-text-muted);margin-right:4px">'+t+'</span>';
    }).join('');

    html+='<div style="background:var(--gradient-card);box-shadow:var(--pixel-border-dark);border-radius:8px;padding:16px 20px;margin-bottom:12px">';
    html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">';
    html+='<div>';
    html+='<span style="font-family:\'Share Tech Mono\',monospace;font-size:12px;color:var(--color-primary-500)">Q'+qid+'</span>';
    if(n.year) html+=' <span style="font-size:11px;color:var(--color-text-muted)">'+n.year+'年</span>';
    html+='</div>';
    html+='<div style="display:flex;gap:6px;align-items:center">';
    html+='<span style="font-size:11px;color:var(--color-text-muted)">'+dateStr+'</span>';
    html+='<button onclick="deleteNote('+qid+')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--color-text-muted);padding:2px" title="刪除筆記">✕</button>';
    html+='</div></div>';

    if(n.question){
      html+='<div style="font-size:12px;color:var(--color-text-muted);margin-bottom:6px;line-height:1.5">'+n.question+(n.question.length>=80?'...':'')+'</div>';
    }
    if(tagHtml) html+='<div style="margin-bottom:8px">'+tagHtml+'</div>';
    html+='<div class="notebook-note-content" style="font-size:13px;color:var(--color-text-primary);line-height:1.7">'+md(n.text)+'</div>';
    html+='</div>';
  });
  list.innerHTML=html;
}

function deleteNote(qid){
  if(!confirm('確定要刪除 Q'+qid+' 的筆記嗎？')) return;
  var notes=loadNotes();
  delete notes[qid];
  saveNotes(notes);
  renderNotebook();
}
