/* ── 進度備份：匯出／匯入全部個人資料 ── */
const BACKUP_KEYS = ['np_progress', 'np_achievements', 'np_notes', 'np_explain_mode', 'np_theme'];
const BACKUP_JSON_KEYS = ['np_progress', 'np_achievements', 'np_notes'];

function downloadJson(obj, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportBackup() {
  const data = {};
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
  downloadJson({ app: 'np-quest', version: 1, exportedAt: new Date().toISOString(), data },
    `np_backup_${new Date().toISOString().slice(0, 10)}.json`);
  showToast(`已匯出進度（累計 ${State.progress.totalAnswered} 題）`);
}

function importBackup(evt) {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    let backup, progress;
    try {
      backup = JSON.parse(e.target.result);
      if (backup?.app !== 'np-quest' || !backup.data || typeof backup.data !== 'object') throw new Error('不是本系統的進度備份檔');
      Object.entries(backup.data).forEach(([k, v]) => {
        if (!BACKUP_KEYS.includes(k) || typeof v !== 'string') throw new Error(`未知的資料：${k}`);
        if (BACKUP_JSON_KEYS.includes(k)) JSON.parse(v);
      });
      progress = backup.data.np_progress ? JSON.parse(backup.data.np_progress) : null;
      if (progress && typeof progress.totalAnswered !== 'number') throw new Error('作答紀錄格式不正確');
    } catch (err) {
      alert(`匯入失敗：${err.message}`);
      return;
    }
    const when = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString('zh-TW') : '未知時間';
    if (!confirm(`備份時間：${when}\n累計作答：${progress ? progress.totalAnswered : 0} 題\n\n匯入會覆蓋這個瀏覽器目前的進度、成就、筆記與設定，確定嗎？`)) return;
    Object.entries(backup.data).forEach(([k, v]) => safeSet(k, v));
    clearSavedSession();
    location.reload();
  };
  reader.readAsText(file);
}

function exportNotes() {
  const notes = loadNotes();
  const count = Object.keys(notes).length;
  if (!count) { showToast('沒有筆記可匯出'); return; }
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `np_notes_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`已匯出 ${count} 筆筆記`);
}

function importNotes(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('格式錯誤');
      const existing = loadNotes();
      let added = 0, updated = 0;
      Object.entries(imported).forEach(([qid, n]) => {
        if (!n || typeof n.text !== 'string' || !n.text) return;
        if (existing[qid]) updated++; else added++;
        existing[qid] = n;
      });
      saveNotes(existing);
      renderNotebook();
      showToast(`匯入完成：新增 ${added} 筆，更新 ${updated} 筆`);
    } catch (err) {
      alert(`匯入失敗：檔案格式不正確\n${err.message}`);
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}
