
function globalSearch(q) {
  if (!q.trim()) { _el('search-results').style.display='none'; return; }
  const ql = q.toLowerCase();
  const results = [];
  State.tasks.forEach(t => {
    if (t.title.toLowerCase().includes(ql) || (t.notes||'').toLowerCase().includes(ql))
      results.push({ type:'task', icon:'✅', label:t.title, sub: getMat(t.matId).name||'', id:t.id });
  });
  State.events.forEach(e => {
    if (e.title.toLowerCase().includes(ql))
      results.push({ type:'event', icon:'📅', label:e.title, sub: getMat(e.matId).name||'', id:e.id });
  });
  State.materias.forEach(m => {
    if (m.name.toLowerCase().includes(ql) || m.code.toLowerCase().includes(ql))
      results.push({ type:'materia', icon:m.icon||'📚', label:m.name, sub:m.code, id:m.id });
  });
  const box = _el('search-results');
  if (!results.length) {
    box.innerHTML = `<div style="padding:12px 14px;color:var(--text3);font-size:13px;">Sin resultados para "${q}"</div>`;
  } else {
    box.innerHTML = results.slice(0,8).map(r => `
      <div class="search-result-item" onclick="searchGoTo('${r.type}','${r.id}')">
        <span style="font-size:16px;">${r.icon}</span>
        <div><div style="font-size:13px;font-weight:600;">${r.label}</div><div style="font-size:11px;color:var(--text3);">${r.sub}</div></div>
      </div>`).join('');
  }
  box.style.display = 'block';
}
function searchGoTo(type, id) {
  _el('search-results').style.display='none';
  document.getElementById('global-search').value = '';
  if (type==='task')    { goPage('tareas',document.querySelector('[onclick*=tareas]')); setTimeout(()=>{ document.getElementById('search-input').value=''; renderTasks(); },200); }
  if (type==='event')   goPage('calendario',document.querySelector('[onclick*=calendario]'));
  if (type==='materia') goPage('materias',document.querySelector('[onclick*=materias]'));
}
