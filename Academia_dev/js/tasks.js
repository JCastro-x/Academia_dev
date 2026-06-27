// Protección XSS - Helper de DOMPurify
function sanitizeHtml(dirty, isRteContent = false) {
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify not loaded, returning unsanitized content');
    return dirty;
  }
  const config = isRteContent ? {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'img', 'blockquote', 'pre', 'code'],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'title', 'style', 'class', 'id'],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'object', 'iframe', 'embed', 'form', 'input'],
    FORBID_ATTR: ['on*', 'javascript:', 'data:', 'vbscript:'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
  } : {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'object', 'iframe', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['on*', 'javascript:', 'data:', 'vbscript:'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
  };
  return DOMPurify.sanitize(dirty, config);
}

// Stepper para campos numéricos
function _stepperChange(id, delta, min, max, step) {
  const el  = document.getElementById(id);
  if (!el) return;
  const val = parseFloat(el.value) || (delta > 0 ? min - step : max + step);
  const nv  = Math.min(max, Math.max(min, Math.round((val + delta * step) * 10) / 10));
  el.value  = nv;
}

let editTaskId       = null;
let _editSubtasks    = [];
let _editAttachments = [];
let _editComments    = [];
let _tasksDueTodayBlinkArmed = true;
let _overviewDueTodayBlinkArmed = true;

function armTasksDueTodayBlink() {
  _tasksDueTodayBlinkArmed = true;
}
function armOverviewDueTodayBlink() {
  _overviewDueTodayBlinkArmed = true;
}
function _todayLocalISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function _isTasksPageActive() {
  return document.getElementById('page-tareas')?.classList.contains('active');
}
function _consumeDueTodayBlinkOnRender() {
  if (!_tasksDueTodayBlinkArmed) return false;
  if (!_isTasksPageActive()) return false;
  _tasksDueTodayBlinkArmed = false;
  return true;
}
function _consumeOverviewDueTodayBlinkOnRender() {
  if (!_overviewDueTodayBlinkArmed) return false;
  const isOverviewActive = document.getElementById('page-overview')?.classList.contains('active');
  if (!isOverviewActive) return false;
  _overviewDueTodayBlinkArmed = false;
  return true;
}

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

function renderSubtasksEditor(list) {
  _editSubtasks = Array.isArray(list) ? list : [];
  const c = document.getElementById('subtasks-editor');
  if (!c) return;
  c.innerHTML = _editSubtasks.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="subtaskEditorToggle(${i})"
        style="accent-color:var(--accent);cursor:pointer;width:15px;height:15px;">
      <input type="text" class="form-input" value="${sanitizeHtml((s.text||'')).replace(/"/g,'&quot;')}"
        oninput="subtaskEditorText(${i},this.value)"
        style="flex:1;padding:5px 8px;font-size:13px;" placeholder="Subtarea...">
      <button class="btn btn-danger btn-sm" data-action="subtask-editor-remove" data-index="${i}" style="padding:3px 8px;">✕</button>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" data-action="subtask-editor-add" style="margin-top:4px;font-size:12px;">+ Agregar subtarea</button>`;
}
function subtaskEditorAdd()      { _editSubtasks.push({ text:'', done:false }); renderSubtasksEditor(_editSubtasks); }
function subtaskEditorText(i, v) { if (_editSubtasks[i]) _editSubtasks[i].text = v; }
function subtaskEditorToggle(i)  {
  if (!_editSubtasks[i]) return;
  _editSubtasks[i].done = !_editSubtasks[i].done;
  // If we're editing an existing task, persist the toggle immediately
  if (editTaskId) {
    const t = State.tasks.find(x => x.id === editTaskId);
    if (t) {
      t.subtasks = JSON.parse(JSON.stringify(_editSubtasks));
      if (t.subtasks.length && t.subtasks.every(s => s.done)) t.done = true;
      saveState(['tasks']);
      renderTasks(); updateBadge(); renderOverview(); renderCalendar();
    }
  }
  renderSubtasksEditor(_editSubtasks);
}
function subtaskEditorRemove(i)  { _editSubtasks.splice(i, 1); renderSubtasksEditor(_editSubtasks); }

function renderAttachmentsEditor(list) {
  _editAttachments = Array.isArray(list) ? list : [];
  const c = document.getElementById('attachments-editor');
  if (!c) return;
  c.innerHTML = _editAttachments.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:7px 10px;background:var(--surface2);border-radius:7px;border:1px solid var(--border);">
      <span style="font-size:18px;">${a.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitizeHtml(a.name)}</span>
      <button class="btn btn-ghost btn-sm" data-action="preview-attachment" data-index="${i}" style="font-size:12px;">👁 Ver</button>
      <button class="btn btn-danger btn-sm" data-action="remove-attachment" data-index="${i}" style="padding:3px 7px;">✕</button>
    </div>`).join('')
    + `<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-top:4px;font-size:12px;display:inline-flex;align-items:center;gap:5px;">
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
        <span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">${sanitizeHtml(x.date || '')}</span>
        <button class="btn btn-danger btn-sm" data-action="remove-comment" data-index="${i}" style="padding:2px 6px;font-size:11px;">✕</button>
      </div>
      <textarea class="form-textarea" rows="2" style="font-size:13px;"
        oninput="commentText(${i},this.value)">${sanitizeHtml(x.text || '').replace(/</g,'&lt;')}</textarea>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" data-action="add-comment" style="margin-top:4px;font-size:12px;">💬 Agregar comentario</button>`;
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
    if (document.getElementById('t-est-days')) document.getElementById('t-est-days').value = existing.estDays || '';
    if (document.getElementById('t-est-hrs'))  document.getElementById('t-est-hrs').value  = existing.estHoursPerDay || '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = (existing.tags||[]).join(', ');
    if (document.getElementById('t-repeat'))       document.getElementById('t-repeat').value       = existing.repeat      || 'none';
    if (document.getElementById('t-repeat-until')) document.getElementById('t-repeat-until').value = existing.repeatUntil || '';
    if (document.getElementById('t-repeat-count')) document.getElementById('t-repeat-count').value = existing.repeatCount || '';
    _toggleRepeatFields();
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
    if (document.getElementById('t-est-days')) document.getElementById('t-est-days').value = '';
    if (document.getElementById('t-est-hrs'))  document.getElementById('t-est-hrs').value  = '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = '';
    if (document.getElementById('t-repeat'))       document.getElementById('t-repeat').value       = 'none';
    if (document.getElementById('t-repeat-until')) document.getElementById('t-repeat-until').value = '';
    if (document.getElementById('t-repeat-count')) document.getElementById('t-repeat-count').value = '';
    _toggleRepeatFields();
  }

  document.querySelectorAll('#modal-task .modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  renderSubtasksEditor(_editSubtasks);
  renderAttachmentsEditor(_editAttachments);
  renderCommentsEditor(_editComments);
  document.getElementById('modal-task').classList.add('open');
}

function switchTaskTab(tab, el) {
  document.querySelectorAll('#modal-task .modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('ttab-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'subtasks')    renderSubtasksEditor(_editSubtasks);
  if (tab === 'attachments') renderAttachmentsEditor(_editAttachments);
  if (tab === 'comments')    renderCommentsEditor(_editComments);
}

function saveTask() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) {
    document.getElementById('t-title').style.borderColor = 'var(--red)';
    document.getElementById('t-title').focus();
    return;
  }
  document.getElementById('t-title').style.borderColor = '';

  document.querySelectorAll('#subtasks-editor input[type="text"]').forEach((inp, i) => {
    if (_editSubtasks[i]) _editSubtasks[i].text = inp.value;
  });
  document.querySelectorAll('#comments-editor textarea').forEach((ta, i) => {
    if (_editComments[i]) _editComments[i].text = ta.value;
  });

  const existing = editTaskId ? State.tasks.find(t => t.id === editTaskId) : null;
  const task = {
    id:          editTaskId || Date.now().toString(),
    title,
    matId:       document.getElementById('t-mat').value,
    priority:    document.getElementById('t-prio').value,
    datePlanned: document.getElementById('t-date-planned').value,
    due:         document.getElementById('t-due').value,
    type:        document.getElementById('t-type').value,
    notes:       document.getElementById('t-notes').value,
    timeEst:     parseInt(document.getElementById('t-time-est')?.value) || 0,
    tags:        (document.getElementById('t-tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean),
    kanbanCol:   existing?.kanbanCol || 'todo',
    done:        existing ? existing.done : false,
    createdAt:   existing ? existing.createdAt : Date.now(),
    subtasks:    _editSubtasks.filter(s => s.text.trim()),
    attachments: _editAttachments,
    comments:    _editComments.filter(c => c.text.trim()),
    // Repetición
    repeat:      document.getElementById('t-repeat')?.value || 'none',
    repeatUntil: document.getElementById('t-repeat-until')?.value || '',
    repeatCount: parseInt(document.getElementById('t-repeat-count')?.value) || 0,
    repeatDone:  existing ? (existing.repeatDone || 0) : 0,
    estDays:        parseInt(document.getElementById('t-est-days')?.value)  || 0,
    estHoursPerDay: parseFloat(document.getElementById('t-est-hrs')?.value) || 0,
  };

  // Si tiene repetición y se está creando, generar las instancias
  if (!editTaskId && task.repeat !== 'none') {
    _generateRepeatTasks(task);
    saveState(['tasks']); closeModal('modal-task');
    renderTasks(); updateBadge(); renderOverview(); renderCalendar();
    return;
  }

  const activeSem = State.semestres.find(s => s.activo) || State.semestres[0];
  if (!activeSem) return;

  if (editTaskId) {
    const idx = (activeSem.tasks || []).findIndex(t => t.id === editTaskId);
    if (idx >= 0) activeSem.tasks[idx] = task;
  } else {
    if (!activeSem.tasks) activeSem.tasks = [];
    activeSem.tasks.unshift(task);
  }

  if (typeof _plannerApplyTaskDates === 'function') _plannerApplyTaskDates(task);

  saveState(['tasks']);
  closeModal('modal-task');
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();
  if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
}

function toggleTask(id) {
  const t = State.tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  t.done = !t.done;

  // Animación visual al completar (0.8s para coincidir con CSS)
  if (!wasDone && t.done) {
    // Encontrar el elemento DOM y aplicar clase de animación
    const taskEl = document.querySelector(`.task-item[data-id="${id}"]`);
    if (taskEl) {
      taskEl.style.animation = 'taskComplete 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
      taskEl.classList.add('done');
      // Efecto de celebración sutil
      _showTaskCompleteEffect(taskEl);
    }
    // Eliminar notificaciones pendientes para esta tarea
    if (typeof NOTIFS_DB !== 'undefined') {
      NOTIFS_DB.deleteByTaskId(id).catch(err => console.warn('Error cancelando notificaciones:', err));
    }
  }

  _uiClick(wasDone ? 'task-undone' : 'task-done');
  if (!wasDone) { _updateStreak(); }

  // Guardar inmediatamente y esperar a que complete antes de actualizar UI
  saveStateNow(['tasks']).then(() => {
    renderTasks();
    updateBadge();
    renderOverview();
    renderCalendar();
    if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
  }).catch(err => {
    console.error('Error guardando tarea:', err);
    // Aún actualizar UI localmente aunque falle el sync
    renderTasks();
    updateBadge();
    renderOverview();
    renderCalendar();
    if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
  });
}

// Efecto visual de celebración al completar tarea
function _showTaskCompleteEffect(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Crear partículas de celebración
  for (let i = 0; i < 6; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position:fixed;
      left:${centerX}px;
      top:${centerY}px;
      width:8px;
      height:8px;
      background:linear-gradient(135deg, #a78bfa, #7c6aff);
      border-radius:50%;
      pointer-events:none;
      z-index:10000;
      box-shadow:0 0 10px rgba(124,106,255,0.6);
    `;
    document.body.appendChild(particle);

    // Animación de explosión
    const angle = (i / 6) * Math.PI * 2;
    const velocity = 60 + Math.random() * 40;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    particle.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => particle.remove();
  }
}
function toggleSubtask(taskId, idx) {
  const t = State.tasks.find(x => x.id === taskId);
  if (!t?.subtasks?.[idx]) return;
  const wasDone = !!t.done;
  const wasSubtaskDone = t.subtasks[idx].done;
  t.subtasks[idx].done = !t.subtasks[idx].done;
  t.done = t.subtasks.length > 0 && t.subtasks.every(s => s.done);

  // Buscar el elemento de la subtarea para animación visual
  const subtaskRow = document.querySelector(`[data-action="toggle-subtask"][data-id="${taskId}"][data-index="${idx}"]`);
  if (subtaskRow) {
    const checkBox = subtaskRow.querySelector('.subtask-check, [data-subtask-box]');
    const checkSpan = subtaskRow.querySelector('[data-subtask-check] span, .subtask-check span');

    if (t.subtasks[idx].done) {
      // Marcar como completado
      subtaskRow.classList.add('done');
      subtaskRow.style.animation = 'subtaskComplete 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      if (checkBox) {
        checkBox.classList.add('done');
        checkBox.style.background = 'linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%)';
        checkBox.style.borderColor = 'var(--accent)';
        checkBox.style.boxShadow = '0 2px 6px rgba(124,106,255,0.4)';
      }
      if (checkSpan) {
        checkSpan.style.transform = 'scale(1)';
        checkSpan.style.opacity = '1';
      }
      // Efecto de celebración sutil
      _showSubtaskCompleteEffect(subtaskRow);
    } else {
      // Desmarcar, limpiar estilos de completado
      subtaskRow.classList.remove('done');
      subtaskRow.style.animation = '';
      if (checkBox) {
        checkBox.classList.remove('done');
        checkBox.style.background = 'transparent';
        checkBox.style.borderColor = 'var(--border2)';
        checkBox.style.boxShadow = 'none';
      }
      if (checkSpan) {
        checkSpan.style.transform = 'scale(0)';
        checkSpan.style.opacity = '0';
      }
    }
  }

  const needsFullRender = _needsFullTaskRenderOnSubtaskToggle(wasDone, t.done);
  
  // Guardar inmediatamente y esperar a que complete antes de actualizar UI
  saveStateNow(['tasks']).then(() => {
    if (needsFullRender) {
      renderTasks();
    } else {
      _updateSingleTaskProgressUI(taskId);
    }
    updateBadge();
    renderOverview();
    renderCalendar();
  }).catch(err => {
    console.error('Error guardando subtarea:', err);
    // Aún actualizar UI localmente aunque falle el sync
    if (needsFullRender) {
      renderTasks();
    } else {
      _updateSingleTaskProgressUI(taskId);
    }
    updateBadge();
    renderOverview();
    renderCalendar();
  });
}

// Efecto visual de celebración al completar subtarea
function _showSubtaskCompleteEffect(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Crear partículas de celebración (más pequeñas que las de tarea principal)
  for (let i = 0; i < 4; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position:fixed;
      left:${centerX}px;
      top:${centerY}px;
      width:6px;
      height:6px;
      background:linear-gradient(135deg, #4ade80, #7c6aff);
      border-radius:50%;
      pointer-events:none;
      z-index:10000;
      box-shadow:0 0 8px rgba(124,106,255,0.5);
    `;
    document.body.appendChild(particle);

    const angle = (i / 4) * Math.PI * 2;
    const velocity = 30 + Math.random() * 20;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    particle.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
    ], {
      duration: 500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => particle.remove();
  }
}
function _needsFullTaskRenderOnSubtaskToggle(wasDone, isDoneNow) {
  const sf = document.getElementById('tf-status')?.value || '';
  if (!sf) return false;
  if (sf === 'pending' && isDoneNow) return true;
  if (sf === 'done' && !isDoneNow) return true;
  return false;
}
function _updateSingleTaskProgressUI(taskId) {
  const t = State.tasks.find(x => x.id === taskId);
  const card = document.querySelector(`.task-item[data-id="${taskId}"]`);
  if (!t || !card) return;

  card.classList.toggle('done', !!t.done);
  const taskCheck = card.querySelector('.task-check');
  if (taskCheck) taskCheck.classList.toggle('checked', !!t.done);

  const prog = subtaskProgress(t);
  const progFill = card.querySelector('[data-subtask-progress-fill]');
  const progText = card.querySelector('[data-subtask-progress-text]');
  if (progFill) {
    progFill.style.width = `${prog ? prog.pct : 0}%`;
    progFill.style.background = prog && prog.pct === 100 ? '#4ade80' : '#7c6aff';
  }
  if (progText) {
    progText.textContent = prog ? `${prog.done}/${prog.total}` : '0/0';
  }

  (t.subtasks || []).forEach((s, i) => {
    const row = card.querySelector(`[data-subtask-row="${i}"]`);
    const box = card.querySelector(`[data-subtask-box="${i}"]`);
    const check = card.querySelector(`[data-subtask-check="${i}"]`);
    const txt = card.querySelector(`[data-subtask-text="${i}"]`);
    if (row) row.style.opacity = s.done ? '.5' : '';
    if (box) {
      box.style.borderColor = s.done ? 'var(--accent)' : 'var(--border2)';
      box.style.background = s.done ? 'linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%)' : 'transparent';
      box.style.boxShadow = s.done ? '0 2px 6px rgba(124,106,255,0.4)' : 'none';
    }
    if (check) {
      check.innerHTML = s.done ? '<span style="font-size:11px;color:#fff;font-weight:700;">✓</span>' : '';
      check.style.transform = s.done ? 'scale(1)' : 'scale(0)';
      check.style.opacity = s.done ? '1' : '0';
    }
    if (txt) {
      txt.style.textDecoration = s.done ? 'line-through' : '';
      txt.style.color = s.done ? 'var(--text3)' : '';
    }
  });
}
async function deleteTask(id) {
  const task = State.tasks.find(t => t.id === id);
  if (!task) return;

  const confirmed = await showConfirm(`¿Eliminar la tarea "${task.title}"?`, { danger: true });
  if (!confirmed) return;

  const deletedTask = { ...task };
  
  State.tasks = State.tasks.filter(t => t.id !== id);
  saveState(['tasks']);
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();
  if (typeof refreshAllWidgets === 'function') refreshAllWidgets();

  // Mostrar toast de deshacer
  if (typeof showUndoToast === 'function') {
    showUndoToast(`Tarea "${task.title}" eliminada`, () => {
      State.tasks.push(deletedTask);
      saveState(['tasks']);
      renderTasks();
      updateBadge();
      renderOverview();
      renderCalendar();
      if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
    });
  }
}
// Tareas repetitivas
function _generateRepeatTasks(baseTask) {
  const repeat = baseTask.repeat;
  const until  = baseTask.repeatUntil;
  const count  = baseTask.repeatCount;

  if (repeat === 'none') {
    State.tasks.unshift({ ...baseTask, repeat: 'none' });
    return;
  }

  const dueDate = baseTask.due ? new Date(baseTask.due + 'T12:00:00') : new Date();
  const tasks   = [];
  let   current = new Date(dueDate);
  let   i       = 0;
  const maxIter = 365; // límite de seguridad

  while (i < maxIter) {
    // Condición de parada
    if (count > 0 && tasks.length >= count) break;
    if (until && current > new Date(until + 'T23:59:59')) break;
    if (!count && !until) { // sin límite definido: solo 1 instancia
      tasks.push({ ...baseTask, id: Date.now().toString() + '_' + i, due: _dateFmt(current), repeatDone: i });
      break;
    }

    tasks.push({
      ...baseTask,
      id:         Date.now().toString() + '_' + i,
      due:        _dateFmt(current),
      repeatDone: i,
      done:       false,
    });

    // Avanzar fecha según tipo de repetición
    const next = new Date(current);
    if      (repeat === 'daily')   next.setDate(next.getDate() + 1);
    else if (repeat === 'weekly')  next.setDate(next.getDate() + 7);
    else if (repeat === 'biweekly')next.setDate(next.getDate() + 14);
    else if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);
    current = next;
    i++;
  }

  // Agregar en orden cronológico al inicio
  tasks.reverse().forEach(t => State.tasks.unshift(t));
}

function _dateFmt(d) {
  return d.toISOString().split('T')[0];
}

// Borrar tareas completadas (bulk)
async function deleteCompletedTasks() {
  const count = State.tasks.filter(t => t.done).length;
  if (!count) { if (typeof _appNotify === 'function') _appNotify('No hay tareas completadas.', 'warning'); return; }
  const confirmed = await showConfirm(`¿Eliminar ${count} tarea${count > 1 ? 's' : ''} completada${count > 1 ? 's' : ''}?`, { danger: true });
  if (!confirmed) return;
  State.tasks = State.tasks.filter(t => !t.done);
  saveState(['tasks']); renderTasks(); updateBadge(); renderOverview(); renderCalendar();
}

function toggleDesc(id) {
  const el  = document.getElementById('desc-' + id);
  const btn = document.getElementById('descbtn-' + id);
  if (!el) return;
  const shown = el.style.display !== 'none';
  el.style.display = shown ? 'none' : 'block';
  if (btn) btn.textContent = (shown ? '▸' : '▾') + ' Ver descripción';
}
function updateBadge() {
  const count = State.tasks.filter(t => !t.done).length;
  const b1 = document.getElementById('badge-tasks');
  const b2 = document.getElementById('badge-tasks-m');
  if (b1) b1.textContent = count;
  if (b2) b2.textContent = count;
  // Actualizar badge hoy
  const today = new Date().toISOString().split('T')[0];
  const urgent = State.tasks.filter(t => !t.done && t.due && t.due <= today).length;
  const badge = document.getElementById('badge-hoy');
  if (badge) { badge.style.display = urgent > 0 ? 'inline' : 'none'; badge.textContent = urgent; }
}

function renderTasks() { 
  const list = _el('tasks-list');
  if (list && !list.dataset.loaded) {
    showSkeleton(list, 'list', 3);
    list.dataset.loaded = 'true';
    setTimeout(() => _schedRender(_renderTasks), 300);
  } else {
    _schedRender(_renderTasks);
  }
}
function _renderTasks() {
  const list = _el('tasks-list');
  if (!list) return;
  list.classList.remove('skeleton-loading');
  const blinkDueTodayNow = _consumeDueTodayBlinkOnRender();
  const todayIso = _todayLocalISO();

  const mf = document.getElementById('tf-mat')?.value    || '';
  const sf = document.getElementById('tf-status')?.value || '';
  const pf = document.getElementById('tf-prio')?.value   || '';
  const qf = (document.getElementById('search-input')?.value || '').toLowerCase();

  let filtered = State.tasks.filter(t =>
    (!mf || t.matId === mf) &&
    (!sf || (sf === 'pending' ? !t.done : t.done)) &&
    (!pf || t.priority === pf) &&
    (!qf || t.title.toLowerCase().includes(qf) || (t.notes || '').toLowerCase().includes(qf))
  );

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pd = { high:0, med:1, low:2 };
    return (pd[a.priority] ?? 1) - (pd[b.priority] ?? 1);
  });

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:36px;margin-bottom:10px;">✅</div>
      <div style="font-size:14px;">No hay tareas aquí</div></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const m       = getMat(t.matId);
    const dc      = dueClass(t.due);
    const prog    = subtaskProgress(t);
    const pStripe = t.priority === 'high' ? 'p-high-stripe' : t.priority === 'low' ? 'p-low-stripe' : 'p-med-stripe';
    const tBadge  = getTypeBadgeClass(t.type);
    const highGlowClass = t.priority === 'high' && !t.done ? ' prio-high-glow' : '';
    const isDueToday = !t.done && !!t.due && t.due === todayIso;
    const dueTodayBlinkClass = blinkDueTodayNow && isDueToday ? ' due-today-blink' : '';
    const blinkRgb = t.priority === 'high' ? '248,113,113' : t.priority === 'low' ? '74,222,128' : '251,191,36';
    const dueTodayBlinkStyle = blinkDueTodayNow && isDueToday ? ` style="--due-today-blink-rgb:${blinkRgb};"` : '';

    const subtasksHtml = prog ? `
      <div style="margin-top:7px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <div class="prog-bar" style="flex:1;height:4px;">
            <div class="prog-fill" data-subtask-progress-fill style="background:${prog.pct===100?'#4ade80':'#7c6aff'};width:${prog.pct}%;"></div>
          </div>
          <span data-subtask-progress-text style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;white-space:nowrap;">${prog.done}/${prog.total}</span>
        </div>
        ${t.subtasks.map((s, i) => `
          <div class="subtask-row${s.done ? ' done' : ''}" data-action="toggle-subtask" data-id="${t.id}" data-index="${i}"
            data-subtask-row="${i}"
            style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;margin:2px 0;">
            <div class="subtask-check${s.done ? ' done' : ''}" data-subtask-box="${i}"
              style="width:18px;height:18px;border-radius:5px;flex-shrink:0;
              border:2px solid ${s.done?'var(--accent)':'var(--border2)'};
              background:${s.done?'linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%)':'transparent'};
              display:flex;align-items:center;justify-content:center;
              box-shadow:${s.done?'0 2px 6px rgba(124,106,255,0.4)':'none'};">
              <span data-subtask-check="${i}" style="transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);${s.done ? 'transform:scale(1);opacity:1;' : 'transform:scale(0);opacity:0;'}">${s.done ? '<span style="font-size:11px;color:#fff;font-weight:700;">✓</span>' : ''}</span>
            </div>
            <span data-subtask-text="${i}" style="font-size:13px;transition:all 0.3s ease;${s.done?'text-decoration:line-through;color:var(--text3);':'color:var(--text);'}">${sanitizeHtml(s.text)}</span>
          </div>`).join('')}
      </div>` : '';

    const attachHtml = t.attachments?.length ? `
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
        ${t.attachments.map((a, i) => `
          <button data-action="preview-task-attachment" data-id="${t.id}" data-index="${i}"
            class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 7px;">
            ${a.type === 'pdf' ? '📄' : '🖼️'} ${sanitizeHtml(a.name.length > 18 ? a.name.slice(0,16)+'…' : a.name)}
          </button>`).join('')}
      </div>` : '';

    const descHtml = t.notes ? `
      <div id="desc-${t.id}" style="display:none;font-size:13px;color:var(--text2);margin-top:6px;padding:8px;background:var(--surface2);border-radius:6px;white-space:pre-wrap;">${t.notes.replace(/</g,'&lt;')}</div>
      <button id="descbtn-${t.id}" data-action="toggle-desc" data-id="${t.id}"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;margin-top:4px;padding:0;">▸ Ver descripción</button>` : '';

    const commBadge = t.comments?.length
      ? `<span style="font-size:12px;color:var(--text3);">💬 ${t.comments.length}</span>` : '';

    return `<div class="task-item${t.done ? ' done' : ''}${highGlowClass}${dueTodayBlinkClass}" draggable="true" 
      data-id="${t.id}"
      ${dueTodayBlinkStyle}
      ondragstart="taskDragStart(event,'${t.id}')"
      ondragover="taskDragOver(event)"
      ondrop="taskDrop(event,'${t.id}')"
      ondragleave="taskDragLeave(event)">
      <div class="task-drag-handle" title="Arrastrar">⠿</div>
      <div class="priority-stripe ${pStripe}"></div>
      <div class="task-check ${t.done ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}"></div>
      <div style="flex:1;min-width:0;">
        <div class="task-title">${sanitizeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="task-subject" style="background:${m.color||'#7c6aff'}22;color:${m.color||'#7c6aff'};border:1px solid ${m.color||'#7c6aff'}44;">${m.icon||'📚'} ${sanitizeHtml(m.code||'?')}</span>
          <span class="type-badge ${tBadge}">${sanitizeHtml(t.type || 'Tarea')}</span>
          ${prioBadge(t.priority)}
          ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
          ${t.timeEst ? `<span style="font-size:11px;color:var(--text3);">⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}</span>` : ''}
          ${(t.tags||[]).map(tg=>`<span class="tag-chip">#${sanitizeHtml(tg)}</span>`).join('')}
          ${commBadge}
        </div>
        ${subtasksHtml}
        ${attachHtml}
        ${descHtml}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" data-action="view-task" data-id="${t.id}" title="Ver detalles">👁</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-task" data-id="${t.id}" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm" data-action="delete-task" data-id="${t.id}">🗑️</button>
      </div>
    </div>`;
  }).join('');

  // Remover clase blink después de que complete la animación
  setTimeout(() => {
    document.querySelectorAll('.due-today-blink').forEach(el => {
      el.classList.remove('due-today-blink');
    });
  }, 3450); // 1.15s * 3 iterations = 3.45s
}

// Carga de adjuntos
function handleAttachmentUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { if (typeof _appNotify === 'function') _appNotify('Máximo 5MB por archivo.', 'error'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    _editAttachments.push({
      name: file.name,
      type: file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('image/') ? 'image' : 'file',
      size: file.size,
      data: e.target.result,
      date: new Date().toLocaleDateString('es-ES')
    });
    renderAttachmentsEditor(_editAttachments);
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function removeAttachment(i) {
  _editAttachments.splice(i, 1);
  renderAttachmentsEditor(_editAttachments);
}
function previewAttachment(i) {
  const a = _editAttachments[i];
  if (a) _openAttachmentPreview(a);
}
function previewTaskAttachment(taskId, i) {
  const t = State.tasks.find(x => x.id === taskId);
  if (t?.attachments?.[i]) _openAttachmentPreview(t.attachments[i]);
}
function _openAttachmentPreview(a) {
  if (!a?.data) { if (typeof _appNotify === 'function') _appNotify('Sin datos para previsualizar.', 'warning'); return; }
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

// Vista de detalle de tarea
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
    '<span style="font-size:12px;color:var(--text3);font-family:Space Mono,monospace;">' + (prog?prog.done:0) + '/' + (prog?prog.total:0) + '</span>' +
    '</div>' +
    t.subtasks.map(function(s,i) {
      return '<div class="subtask-row' + (s.done?' done':'') + '" data-action="toggle-subtask" data-id="' + t.id + '" data-index="' + i + '" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;margin:2px 0;border-radius:6px;transition:all 0.3s ease;">' +
        '<div class="subtask-check' + (s.done?' done':'') + '" style="width:20px;height:20px;border-radius:5px;flex-shrink:0;border:2px solid ' + (s.done?'var(--accent)':'var(--border2)') + ';background:' + (s.done?'linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%)':'transparent') + ';display:flex;align-items:center;justify-content:center;box-shadow:' + (s.done?'0 2px 6px rgba(124,106,255,0.4)':'none') + ';transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">' +
        '<span style="font-size:11px;color:#fff;font-weight:700;transition:all 0.3s ease;' + (s.done?'transform:scale(1);opacity:1;':'transform:scale(0);opacity:0;') + '">✓</span>' +
        '</div><span style="font-size:13px;transition:all 0.3s ease;' + (s.done?'text-decoration:line-through;color:var(--text3);':'color:var(--text);') + '">' + s.text + '</span></div>';
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
        '<button class="btn btn-ghost btn-sm" data-action="preview-task-attachment" data-id="' + t.id + '" data-index="' + i + '" style="font-size:11px;">👁 Ver</button>' +
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
    '<button class="btn btn-primary btn-sm" style="margin-top:12px;" data-action="edit-task" data-id="' + t.id + '" data-close-detail="true">✏️ Agregar detalles</button></div>' : '';

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
    '<button class="btn btn-ghost btn-sm" data-action="edit-task" data-id="' + t.id + '" data-close-detail="true" title="Editar">✏️</button>' +
    '<button class="btn btn-ghost btn-sm" data-action="close-task-detail" style="font-size:16px;padding:4px 8px;">✕</button>' +
    '</div></div>' +
    '<div style="overflow-y:auto;padding:16px 20px;flex:1;">' + subtasksHtml + notesHtml + attachHtml + commentsHtml + emptyHtml + '</div>' +
    '<div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2);">' +
    '<span style="font-size:11px;color:var(--text3);">' + attachCount + commCount + '</span>' +
    '<button class="btn btn-primary btn-sm" data-action="toggle-task" data-id="' + t.id + '" data-close-detail="true">' + (t.done?'↩ Marcar pendiente':'✅ Marcar completada') + '</button>' +
    '</div></div>';

  if (!document.getElementById('task-detail-styles')) {
    const s = document.createElement('style');
    s.id = 'task-detail-styles';
    s.textContent = '.detail-section{margin-bottom:18px;}.detail-section-title{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:Space Mono,monospace;}';
    document.head.appendChild(s);
  }
  modal.style.display = 'flex';
}

// Mostrar/ocultar campos según tipo de repetición
function _toggleRepeatFields() {
  const val     = document.getElementById('t-repeat')?.value || 'none';
  const untilEl = document.getElementById('t-repeat-until-wrap');
  const distEl  = document.getElementById('t-distributed-wrap');
  const show    = val !== 'none';
  if (untilEl) untilEl.style.display = show ? '' : 'none';
  if (distEl)  distEl.style.display  = show ? '' : 'none';
}

function closeTaskDetail() {
  const m = document.getElementById('modal-task-detail');
  if (m) m.style.display = 'none';
}

// Delegación de eventos del modal de tareas (reemplaza handlers inline)
// Nota: Colocado en scope de módulo (no DOMContentLoaded) porque los partials
// se cargan dinámicamente via fetch(). La delegación de eventos en document
// capturará clicks en elementos inyectados dinámicamente via bubbling.

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  // Cerrar modal
  if (actionType === 'close-modal') {
    const target = action.dataset.target;
    if (target && typeof closeModal === 'function') closeModal(target);
  }

  // Cambiar pestaña de tarea
  if (actionType === 'switch-task-tab') {
    const tab = action.dataset.tab;
    if (tab && typeof switchTaskTab === 'function') switchTaskTab(tab, action);
  }

  // Cambio de stepper
  if (actionType === 'stepper-change') {
    const id = action.dataset.id;
    const delta = parseFloat(action.dataset.delta);
    const min = parseFloat(action.dataset.min);
    const max = parseFloat(action.dataset.max);
    const step = parseFloat(action.dataset.step);
    if (id && typeof _stepperChange === 'function') _stepperChange(id, delta, min, max, step);
  }

  // Guardar tarea
  if (actionType === 'save-task') {
    if (typeof saveTask === 'function') saveTask();
  }

  // Editar tarea
  if (actionType === 'edit-task') {
    const id = action.dataset.id;
    const closeDetail = action.dataset.closeDetail;
    if (closeDetail && typeof closeTaskDetail === 'function') closeTaskDetail();
    if (id && typeof openTaskModal === 'function') openTaskModal(id);
  }

  // Eliminar tarea
  if (actionType === 'delete-task') {
    const id = action.dataset.id;
    if (id && typeof deleteTask === 'function') deleteTask(id);
  }

  // Ver tarea (abrir detalle)
  if (actionType === 'view-task') {
    const id = action.dataset.id;
    if (id && typeof openTaskDetail === 'function') openTaskDetail(id);
  }

  // Alternar tarea
  if (actionType === 'toggle-task') {
    const id = action.dataset.id;
    const closeDetail = action.dataset.closeDetail;
    if (id && typeof toggleTask === 'function') toggleTask(id);
    if (closeDetail && typeof closeTaskDetail === 'function') closeTaskDetail();
  }

  // Alternar subtarea
  if (actionType === 'toggle-subtask') {
    const id = action.dataset.id;
    const index = action.dataset.index;
    if (id && typeof toggleSubtask === 'function') toggleSubtask(id, parseInt(index));
  }

  // Previsualizar adjunto de tarea
  if (actionType === 'preview-task-attachment') {
    const id = action.dataset.id;
    const index = action.dataset.index;
    if (id && typeof previewTaskAttachment === 'function') previewTaskAttachment(id, parseInt(index));
  }

  // Cerrar detalle de tarea
  if (actionType === 'close-task-detail') {
    if (typeof closeTaskDetail === 'function') closeTaskDetail();
  }

  // Alternar descripción
  if (actionType === 'toggle-desc') {
    const id = action.dataset.id;
    if (id && typeof toggleDesc === 'function') toggleDesc(id);
  }

  // Agregar subtarea en editor
  if (actionType === 'subtask-editor-add') {
    if (typeof subtaskEditorAdd === 'function') subtaskEditorAdd();
  }

  // Eliminar subtarea en editor
  if (actionType === 'subtask-editor-remove') {
    const index = action.dataset.index;
    if (typeof subtaskEditorRemove === 'function') subtaskEditorRemove(parseInt(index));
  }

  // Previsualizar adjunto
  if (actionType === 'preview-attachment') {
    const index = action.dataset.index;
    if (typeof previewAttachment === 'function') previewAttachment(parseInt(index));
  }

  // Eliminar adjunto
  if (actionType === 'remove-attachment') {
    const index = action.dataset.index;
    if (typeof removeAttachment === 'function') removeAttachment(parseInt(index));
  }

  // Agregar comentario
  if (actionType === 'add-comment') {
    if (typeof addComment === 'function') addComment();
  }

  // Eliminar comentario
  if (actionType === 'remove-comment') {
    const index = action.dataset.index;
    if (typeof removeComment === 'function') removeComment(parseInt(index));
  }
});

// Manejar eventos de cambio vía delegación (para elementos select)
document.addEventListener('change', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  // Alternar campos de repetición
  if (actionType === 'toggle-repeat-fields') {
    if (typeof _toggleRepeatFields === 'function') _toggleRepeatFields();
  }
});

// Listener específico para checkboxes de tareas (fix Android/draggable)
function _handleTaskCheckClick(e) {
  // Buscar específicamente el .task-check que fue clickeado
  const checkEl = e.target.closest('.task-check');
  if (!checkEl) return;

  // Ignorar si está dentro del modal de detalle de tarea
  const detailModal = checkEl.closest('#modal-task-detail');
  if (detailModal) return;

  // Extraer el data-id de la tarea padre
  const taskItem = checkEl.closest('.task-item');
  const taskId = taskItem?.dataset?.id || checkEl.dataset?.id;

  if (taskId && typeof toggleTask === 'function') {
    e.stopPropagation(); // Prevenir que el draggable interfiera
    e.preventDefault();  // Prevenir comportamiento por defecto
    toggleTask(taskId);
  }
}

// Listener en fase de captura para clics normales
document.addEventListener('click', _handleTaskCheckClick, true);

// Listener para eventos táctiles en Android (touchstart es más rápido que click)
document.addEventListener('touchstart', (e) => {
  const checkEl = e.target.closest('.task-check');
  if (!checkEl) return;

  const taskItem = checkEl.closest('.task-item');
  const taskId = taskItem?.dataset?.id || checkEl.dataset?.id;

  if (taskId && typeof toggleTask === 'function') {
    e.stopPropagation();
    // No prevenimos default en touchstart para no bloquear el scroll
    toggleTask(taskId);
  }
}, { capture: true, passive: false });

// Listener específico para subtareas (fix Android)
let _lastTouchSubtask = null;
let _lastTouchTime = 0;

function _handleSubtaskClick(e) {
  // Prevenir doble toggle en móvil (touchstart + click)
  const now = Date.now();
  if (now - _lastTouchTime < 300) {
    _lastTouchTime = 0;
    return;
  }

  // Buscar específicamente el .subtask-check o el contenedor de subtarea
  const subtaskRow = e.target.closest('[data-action="toggle-subtask"]');
  if (!subtaskRow) return;

  const taskId = subtaskRow.dataset?.id;
  const index = subtaskRow.dataset?.index;

  if (taskId && index !== undefined && typeof toggleSubtask === 'function') {
    e.stopPropagation();
    e.preventDefault();
    toggleSubtask(taskId, parseInt(index));
  }
}

// Listener en fase de captura para subtareas
document.addEventListener('click', _handleSubtaskClick, true);

// Listener táctil para subtareas
document.addEventListener('touchstart', (e) => {
  const subtaskRow = e.target.closest('[data-action="toggle-subtask"]');
  if (!subtaskRow) return;

  // Ignorar si está dentro del modal de detalle de tarea
  const detailModal = subtaskRow.closest('#modal-task-detail');
  if (detailModal) return;

  const taskId = subtaskRow.dataset?.id;
  const index = subtaskRow.dataset?.index;

  if (taskId && index !== undefined && typeof toggleSubtask === 'function') {
    e.stopPropagation();
    _lastTouchTime = Date.now();
    toggleSubtask(taskId, parseInt(index));
  }
}, { capture: true, passive: false });

// Exposición global de funciones críticas
window.toggleTask = toggleTask;

// Suscripción Pub/Sub para reactividad
// Suscribirse a cambios en tareas para re-renderizado granular
if (typeof window.subscribe === 'function') {
  const unsubscribeTasks = window.subscribe('tasks', (data) => {
    console.log('[TASKS] Received update notification:', data);
    if (data.type === 'update' && data.task) {
      // Actualizar solo la tarea específica en el DOM si existe
      const taskEl = document.getElementById(`task-${data.task.id}`);
      if (taskEl) {
        // Re-renderizar solo esta tarea
        const tasks = State.tasks;
        const updatedTask = tasks.find(t => t.id === data.task.id);
        if (updatedTask) {
          // Actualizar contenido del DOM sin reconstruir todo
          const titleEl = taskEl.querySelector('.task-title');
          if (titleEl) titleEl.textContent = updatedTask.title;
          const dueEl = taskEl.querySelector('.task-due');
          if (dueEl) dueEl.textContent = updatedTask.due || '';
          // Actualizar estado de completado
          if (updatedTask.done) {
            taskEl.classList.add('done');
          } else {
            taskEl.classList.remove('done');
          }
        }
      } else {
        // Si no existe el elemento, re-renderizar la lista completa
        renderTasks();
      }
    } else if (data.type === 'delete' && data.taskId) {
      // Eliminar tarea del DOM
      const taskEl = document.getElementById(`task-${data.taskId}`);
      if (taskEl) taskEl.remove();
    } else {
      // Para otros cambios, re-renderizar la lista completa
      renderTasks();
    }
  });
}

window.toggleSubtask = toggleSubtask;
