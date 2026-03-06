let editTaskId       = null;
let _editSubtasks    = [];
let _editAttachments = [];
let _editComments    = [];

function fmtD(ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}
function dueClass(due) {
  if (!due) return '';
  const d = (new Date(due) - new Date()) / 86400000;
  return d < 0 ? 'urgent' : d <= 1 ? 'urgent' : d <= 3 ? 'soon' : '';
}
function getTypeBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('tarea'))    return 'tb-tarea';
  if (t.includes('parcial'))  return 'tb-parcial';
  if (t.includes('lab'))      return 'tb-lab';
  if (t.includes('proyecto')) return 'tb-proyecto';
  if (t.includes('quiz'))     return 'tb-quiz';
  if (t.includes('taller'))   return 'tb-taller';
  if (t.includes('hoja'))     return 'tb-hoja';
  if (t.includes('final') || t.includes('examen')) return 'tb-examen';
  return 'tb-default';
}
function subtaskProgress(task) {
  if (!task.subtasks || !task.subtasks.length) return null;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total: task.subtasks.length, pct: Math.round(done / task.subtasks.length * 100) };
}
function prioIcon(p)  { return p === 'high' ? '🔴' : p === 'low' ? '🟢' : '🟡'; }
function prioBadge(p) {
  const cls = p === 'high' ? 'pb-high' : p === 'low' ? 'pb-low' : 'pb-med';
  const lbl = p === 'high' ? 'Alta'    : p === 'low' ? 'Baja'   : 'Media';
  return `<span class="priority-badge ${cls}">${prioIcon(p)} ${lbl}</span>`;
}

// ════════════════════════════════════════════════════════
// RENDER TASKS — ORDENAR POR PRIORIDAD CORRECTAMENTE
// ════════════════════════════════════════════════════════
function renderTasks() {
  _schedRender(_renderTasks);
}

function _renderTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;

  // Leer filtros activos
  const searchQ  = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const filterMat    = document.getElementById('tf-mat')?.value    || '';
  const filterPrio   = document.getElementById('tf-prio')?.value   || '';
  const filterStatus = document.getElementById('tf-status')?.value || '';

  // Filtrar tareas
  let filteredTasks = State.tasks.slice().filter(t => {
    if (filterMat    && t.matId    !== filterMat)                          return false;
    if (filterPrio   && t.priority !== filterPrio)                         return false;
    if (filterStatus === 'pending' && t.done)                              return false;
    if (filterStatus === 'done'    && !t.done)                             return false;
    if (searchQ && !t.title.toLowerCase().includes(searchQ))               return false;
    return true;
  });

  // Ordenar: primero NO completadas, por prioridad (high→med→low), luego por fecha
  const sortedTasks = filteredTasks
    .sort((a, b) => {
      // Si uno está completado y otro no, el no completado va primero
      if (a.done !== b.done) return a.done ? 1 : -1;
      
      // Ordenar por prioridad: high (0) > med (1) > low (2)
      const prioPriority = { high: 0, med: 1, low: 2 };
      const prioA = prioPriority[a.priority] || 1;
      const prioB = prioPriority[b.priority] || 1;
      if (prioA !== prioB) return prioA - prioB;
      
      // Si tienen igual prioridad, ordenar por fecha vencimiento
      const dateA = a.due ? new Date(a.due).getTime() : Infinity;
      const dateB = b.due ? new Date(b.due).getTime() : Infinity;
      return dateA - dateB;
    });

  let html = '';
  if (sortedTasks.length === 0) {
    html = `<div style="text-align:center;padding:40px;color:var(--text3);">📋 Sin tareas</div>`;
  } else {
    html = sortedTasks.map(t => {
      const m = getMat(t.matId);
      const prog = subtaskProgress(t);
      const dueStr = t.due ? `<span style="font-size:10px;color:var(--text3);">${fmtD(t.due)}</span>` : '';
      const progBar = prog ? `
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
          <div class="prog-bar" style="flex:1;height:4px;"><div class="prog-fill" style="background:#7c6aff;width:${prog.pct}%;"></div></div>
          <span style="font-size:9px;color:var(--text3);">${prog.done}/${prog.total}</span>
        </div>
      ` : '';

      return `
        <div class="task-item${t.done ? ' done' : ''}" onclick="openTaskDetail('${t.id}')">
          <div class="task-check ${t.done ? 'checked' : ''}" onclick="event.stopPropagation();toggleTask('${t.id}')"></div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-size:13px;font-weight:600;${t.done ? 'text-decoration:line-through;opacity:0.5' : ''}">${t.title}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:10px;color:var(--text3);">
              <span style="background:${m.color || '#7c6aff'}22;color:${m.color || '#7c6aff'};padding:2px 6px;border-radius:4px;">${m.icon || '📚'} ${m.code || m.name || ''}</span>
              <span class="type-badge ${getTypeBadgeClass(t.type)}">${t.type || 'Tarea'}</span>
              ${dueStr}
            </div>
            ${progBar}
          </div>
          ${prioBadge(t.priority)}
        </div>
      `;
    }).join('');
  }
  container.innerHTML = html;
}

function renderSubtasksEditor(list) {
  _editSubtasks = Array.isArray(list) ? list : [];
  const c = document.getElementById('subtasks-editor');
  if (!c) return;
  c.innerHTML = _editSubtasks.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="subtaskEditorToggle(${i})"
        style="accent-color:var(--accent);cursor:pointer;width:15px;height:15px;">
      <input type="text" class="form-input" value="${(s.text||'').replace(/"/g,'&quot;')}"
        oninput="subtaskEditorText(${i},this.value)"
        style="flex:1;padding:5px 8px;font-size:12px;" placeholder="Subtarea...">
      <button class="btn btn-danger btn-sm" onclick="subtaskEditorRemove(${i})" style="padding:3px 8px;">✕</button>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="subtaskEditorAdd()" style="margin-top:4px;font-size:11px;">+ Agregar subtarea</button>`;
}
function subtaskEditorAdd()      { _editSubtasks.push({ text:'', done:false }); renderSubtasksEditor(_editSubtasks); }
function subtaskEditorText(i, v) { if (_editSubtasks[i]) _editSubtasks[i].text = v; }
function subtaskEditorToggle(i)  { if (_editSubtasks[i]) { _editSubtasks[i].done = !_editSubtasks[i].done; renderSubtasksEditor(_editSubtasks); } }
function subtaskEditorRemove(i)  { _editSubtasks.splice(i, 1); renderSubtasksEditor(_editSubtasks); }

function renderAttachmentsEditor(list) {
  _editAttachments = Array.isArray(list) ? list : [];
  const c = document.getElementById('attachments-editor');
  if (!c) return;
  c.innerHTML = _editAttachments.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:7px 10px;background:var(--surface2);border-radius:7px;border:1px solid var(--border);">
      <span style="font-size:18px;">${a.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</span>
      <button class="btn btn-ghost btn-sm" onclick="previewAttachment(${i})" style="font-size:11px;">👁 Ver</button>
      <button class="btn btn-danger btn-sm" onclick="removeAttachment(${i})" style="padding:3px 7px;">✕</button>
    </div>`).join('')
    + `<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-top:4px;font-size:11px;display:inline-flex;align-items:center;gap:5px;">
        📎 Adjuntar archivo
        <input type="file" accept="image/*,.pdf" style="display:none;" onchange="handleAttachmentUpload(this)">
       </label>`;
}
function renderCommentsEditor(list) {
  const c = document.getElementById('comments-editor');
  if (!c) return;
  c.innerHTML = _editComments.map((x, i) => `
    <div style="background:var(--surface2);border-radius:7px;padding:9px 11px;margin-bottom:6px;border-left:2px solid var(--border2);">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${x.date || ''}</span>
        <button class="btn btn-danger btn-sm" onclick="removeComment(${i})" style="padding:2px 6px;font-size:10px;">✕</button>
      </div>
      <textarea class="form-textarea" rows="2" style="font-size:12px;"
        oninput="commentText(${i},this.value)">${(x.text || '').replace(/</g,'&lt;')}</textarea>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="addComment()" style="margin-top:4px;font-size:11px;">💬 Agregar comentario</button>`;
}
function addComment() {
  const now = new Date().toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  _editComments.push({ text:'', date: now });
  renderCommentsEditor(_editComments);
}
function commentText(i, v) { if (_editComments[i]) _editComments[i].text = v; }
function removeComment(i)  { _editComments.splice(i, 1); renderCommentsEditor(_editComments); }

function openTaskModal(id) {
  editTaskId = id || null;
  _editSubtasks = []; _editAttachments = []; _editComments = [];

  fillMatSels();
  const existing = id ? State.tasks.find(t => t.id === id) : null;

  if (existing) {
    document.getElementById('task-modal-title').textContent = '✏️ Editar Tarea';
    document.getElementById('t-title').value = existing.title;
    document.getElementById('t-mat').value   = existing.matId;
    document.getElementById('t-prio').value  = existing.priority;
    document.getElementById('t-date-planned').value = existing.datePlanned || '';
    document.getElementById('t-due').value   = existing.due || '';
    document.getElementById('t-type').value  = existing.type || 'Tarea';
    document.getElementById('t-notes').value = existing.notes || '';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = existing.timeEst || '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = (existing.tags||[]).join(', ');
    _editSubtasks    = JSON.parse(JSON.stringify(existing.subtasks    || []));
    _editAttachments = JSON.parse(JSON.stringify(existing.attachments || []));
    _editComments    = JSON.parse(JSON.stringify(existing.comments    || []));
  } else {
    document.getElementById('task-modal-title').textContent = '✅ Nueva Tarea';
    document.getElementById('t-title').value = '';
    document.getElementById('t-date-planned').value = '';
    document.getElementById('t-due').value   = '';
    document.getElementById('t-notes').value = '';
    document.getElementById('t-prio').value  = 'med';
    document.getElementById('t-type').value  = 'Tarea';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = '';
  }

  renderSubtasksEditor(_editSubtasks);
  renderAttachmentsEditor(_editAttachments);
  renderCommentsEditor(_editComments);
  document.getElementById('modal-task').classList.add('open');
}

function saveTask() {
  const title    = document.getElementById('t-title').value.trim();
  const matId    = document.getElementById('t-mat').value;
  const priority = document.getElementById('t-prio').value;
  const due      = document.getElementById('t-due').value;
  const type     = document.getElementById('t-type').value;
  const notes    = document.getElementById('t-notes').value;
  const timeEst  = document.getElementById('t-time-est')?.value || '';
  const tags     = document.getElementById('t-tags')?.value ? document.getElementById('t-tags').value.split(',').map(t => t.trim()) : [];

  if (!title || !matId) {
    alert('Título y materia son obligatorios');
    return;
  }

  if (editTaskId) {
    const t = State.tasks.find(x => x.id === editTaskId);
    if (t) {
      t.title      = title;
      t.matId      = matId;
      t.priority   = priority;
      t.due        = due;
      t.type       = type;
      t.notes      = notes;
      t.timeEst    = timeEst ? parseInt(timeEst) : 0;
      t.tags       = tags;
      t.subtasks   = _editSubtasks;
      t.attachments= _editAttachments;
      t.comments   = _editComments;
    }
  } else {
    State.tasks.push({
      id:           Date.now().toString(),
      title:        title,
      matId:        matId,
      priority:     priority,
      due:          due,
      type:         type,
      notes:        notes,
      done:         false,
      timeEst:      timeEst ? parseInt(timeEst) : 0,
      tags:         tags,
      subtasks:     _editSubtasks,
      attachments:  _editAttachments,
      comments:     _editComments,
      datePlanned:  document.getElementById('t-date-planned')?.value || '',
    });
  }

  saveState(['tasks']);
  closeModal('modal-task');
  renderTasks();
  renderOverview();
}

function toggleTask(id) {
  const t = State.tasks.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
    saveState(['tasks']);
    renderTasks();
    updateBadge();
    renderOverview();
  }
}

function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  State.tasks = State.tasks.filter(x => x.id !== id);
  saveState(['tasks']);
  renderTasks();
  updateBadge();
  renderOverview();
}

function toggleSubtask(taskId, subtaskIdx) {
  const t = State.tasks.find(x => x.id === taskId);
  if (t && t.subtasks && t.subtasks[subtaskIdx]) {
    t.subtasks[subtaskIdx].done = !t.subtasks[subtaskIdx].done;
    saveState(['tasks']);
    renderTasks();
    renderOverview();
  }
}

function handleAttachmentUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const isImage = file.type.startsWith('image/');
    _editAttachments.push({
      name:  file.name,
      type:  isImage ? 'image' : 'pdf',
      size:  file.size,
      date:  new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      data:  e.target.result,
    });
    renderAttachmentsEditor(_editAttachments);
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function previewAttachment(idx) {
  if (_editAttachments[idx]) _openAttachmentPreview(_editAttachments[idx]);
}

function removeAttachment(idx) {
  _editAttachments.splice(idx, 1);
  renderAttachmentsEditor(_editAttachments);
}

function previewTaskAttachment(taskId, idx) {
  const t = State.tasks.find(x => x.id === taskId);
  if (t && t.attachments && t.attachments[idx]) {
    _openAttachmentPreview(t.attachments[idx]);
  }
}

function _openAttachmentPreview(a) {
  if (!a?.data) { alert('Sin datos para previsualizar.'); return; }
  if (a.type === 'image') {
    const w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>' + a.name + '</title><style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head><body><img src="' + a.data + '" alt="' + a.name + '"></body></html>');
  } else if (a.type === 'pdf') {
    const w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>' + a.name + '</title><style>body{margin:0;}</style></head><body><iframe src="' + a.data + '" style="width:100vw;height:100vh;border:none;"></iframe></body></html>');
  } else {
    const link = document.createElement('a');
    link.href = a.data; link.download = a.name; link.click();
  }
}

// ═══════════════════════════════════════════════════════
// TASK DETAIL VIEW
// ═══════════════════════════════════════════════════════
function openTaskDetail(id) {
  const t = State.tasks.find(x => x.id === id);
  if (!t) return;
  const m = getMat(t.matId);
  const prog = subtaskProgress(t);

  const subtasksHtml = t.subtasks && t.subtasks.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📋 Subtareas</div>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
    '<div class="prog-bar" style="flex:1;height:6px;"><div class="prog-fill" style="background:' + (prog && prog.pct===100?'#4ade80':'#7c6aff') + ';width:' + (prog?prog.pct:0) + '%;"></div></div>' +
    '<span style="font-size:11px;color:var(--text3);font-family:Space Mono,monospace;">' + (prog?prog.done:0) + '/' + (prog?prog.total:0) + '</span>' +
    '</div>' +
    t.subtasks.map(function(s,i) {
      return '<div onclick="toggleSubtask(\'' + t.id + '\',' + i + ');openTaskDetail(\'' + t.id + '\')" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer;' + (s.done?'opacity:.5':'') + '">' +
        '<div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;border:2px solid ' + (s.done?'var(--accent)':'var(--border2)') + ';background:' + (s.done?'var(--accent)':'transparent') + ';display:flex;align-items:center;justify-content:center;">' +
        (s.done?'<span style="font-size:10px;color:#fff;">✓</span>':'') +
        '</div><span style="font-size:13px;' + (s.done?'text-decoration:line-through;color:var(--text3);':'') + '">' + s.text + '</span></div>';
    }).join('') +
    '</div>'
  ) : '';

  const attachHtml = t.attachments && t.attachments.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📎 Archivos adjuntos</div>' +
    t.attachments.map(function(a,i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">' +
        '<span style="font-size:20px;">' + (a.type==='pdf'?'📄':a.type==='image'?'🖼️':'📎') + '</span>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + a.name + '</div>' +
        '<div style="font-size:10px;color:var(--text3);">' + (a.date||'') + ' · ' + (a.size?Math.round(a.size/1024)+'KB':'') + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="previewTaskAttachment(\'' + t.id + '\',' + i + ')" style="font-size:11px;">👁 Ver</button>' +
        '</div>';
    }).join('') +
    '</div>'
  ) : '';

  const commentsHtml = t.comments && t.comments.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">💬 Comentarios</div>' +
    t.comments.map(function(c) {
      return '<div style="background:var(--surface2);border-radius:7px;padding:9px 11px;margin-bottom:6px;border-left:3px solid var(--accent);">' +
        '<div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-family:Space Mono,monospace;">' + (c.date||'') + '</div>' +
        '<div style="font-size:13px;white-space:pre-wrap;">' + (c.text||'').replace(/</g,'&lt;') + '</div></div>';
    }).join('') +
    '</div>'
  ) : '';

  const notesHtml = t.notes ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📝 Descripción</div>' +
    '<div style="font-size:13px;color:var(--text2);white-space:pre-wrap;padding:10px;background:var(--surface2);border-radius:8px;">' + t.notes.replace(/</g,'&lt;') + '</div>' +
    '</div>'
  ) : '';

  const emptyHtml = (!subtasksHtml && !notesHtml && !attachHtml && !commentsHtml) ?
    '<div style="text-align:center;padding:32px;color:var(--text3);"><div style="font-size:32px;margin-bottom:8px;">📋</div><div>Sin detalles adicionales</div>' +
    '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="closeTaskDetail();openTaskModal(\'' + t.id + '\')">✏️ Agregar detalles</button></div>' : '';

  let modal = document.getElementById('modal-task-detail');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-task-detail';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    modal.onclick = function(e) { if(e.target===modal) closeTaskDetail(); };
    document.body.appendChild(modal);
  }

  const prio = prioBadge(t.priority);
  const typeBadge = getTypeBadgeClass(t.type);
  const dueStr = t.due ? '<span style="font-size:11px;color:var(--text3);">📅 ' + fmtD(t.due) + '</span>' : '';
  const timeStr = t.timeEst ? '<span style="font-size:11px;color:var(--text3);">⏱ ' + (t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min') + '</span>' : '';
  const titleStr = t.done ? '<s style="opacity:.5">' + t.title + '</s>' : t.title;
  const attachCount = t.attachments && t.attachments.length ? '📎 ' + t.attachments.length + ' archivo' + (t.attachments.length>1?'s':'') : '';
  const commCount = t.comments && t.comments.length ? ' · 💬 ' + t.comments.length : '';

  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--surface2);">' +
    '<div style="flex:1;min-width:0;">' +
    '<div style="font-size:16px;font-weight:800;margin-bottom:6px;">' + titleStr + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
    '<span style="background:' + (m.color||'#7c6aff') + '22;color:' + (m.color||'#7c6aff') + ';border:1px solid ' + (m.color||'#7c6aff') + '44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">' + (m.icon||'📚') + ' ' + (m.name||'—') + '</span>' +
    '<span class="type-badge ' + typeBadge + '">' + (t.type||'Tarea') + '</span>' +
    prio + dueStr + timeStr +
    '</div></div>' +
    '<div style="display:flex;gap:6px;flex-shrink:0;">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeTaskDetail();openTaskModal(\'' + t.id + '\')" title="Editar">✏️</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="closeTaskDetail()" style="font-size:16px;padding:4px 8px;">✕</button>' +
    '</div></div>' +
    '<div style="overflow-y:auto;padding:16px 20px;flex:1;">' + subtasksHtml + notesHtml + attachHtml + commentsHtml + emptyHtml + '</div>' +
    '<div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2);">' +
    '<span style="font-size:11px;color:var(--text3);">' + attachCount + commCount + '</span>' +
    '<button class="btn btn-primary btn-sm" onclick="toggleTask(\'' + t.id + '\');closeTaskDetail()">' + (t.done?'↩ Marcar pendiente':'✅ Marcar completada') + '</button>' +
    '</div></div>';

  if (!document.getElementById('task-detail-styles')) {
    const s = document.createElement('style');
    s.id = 'task-detail-styles';
    s.textContent = '.detail-section{margin-bottom:18px;}.detail-section-title{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:Space Mono,monospace;}';
    document.head.appendChild(s);
  }
  modal.style.display = 'flex';
}

function closeTaskDetail() {
  const m = document.getElementById('modal-task-detail');
  if (m) m.style.display = 'none';
}
