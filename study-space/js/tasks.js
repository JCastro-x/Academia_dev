// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — tasks.js
// ═══════════════════════════════════════════════════════════════

let _tasks = [];

async function _loadTasks() {
  _tasks = await SS.DB.getTasks(_activeGroup.id);
  _renderTasks();
  const pending = _tasks.filter(t => !t.done).length;
  const badge   = document.getElementById('badge-tasks');
  badge.textContent  = pending;
  badge.style.display = pending > 0 ? '' : 'none';
}

function _renderTasks() {
  const list = document.getElementById('tasks-list');
  if (!_tasks.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Sin tareas</div><div class="empty-state-desc">Crea la primera tarea del grupo</div></div>`;
    return;
  }
  const pending = _tasks.filter(t => !t.done);
  const done    = _tasks.filter(t => t.done);
  list.innerHTML = [...pending, ...done].map(t => {
    const prioTag  = t.priority === 'high' ? 'tag-prio-high' : t.priority === 'med' ? 'tag-prio-med' : 'tag-prio-low';
    const prioLbl  = t.priority === 'high' ? '🔴 Alta' : t.priority === 'med' ? '🟡 Media' : '🟢 Baja';
    const isUrgent = t.due && new Date(t.due) < new Date();
    return `
      <div class="task-item ${t.done ? 'done' : ''}" id="task-${t.id}">
        <div class="task-check ${t.done ? 'checked' : ''}" onclick="_toggleTask('${t.id}')"></div>
        <div class="task-body">
          <div class="task-title">${_escHtml(t.title)}</div>
          <div class="task-meta">
            <span class="task-tag ${prioTag}">${prioLbl}</span>
            ${t.due ? `<span class="task-tag tag-due ${isUrgent ? 'urgent' : ''}">📅 ${t.due}</span>` : ''}
            ${t.assigned?.username ? `<span class="task-tag tag-assigned">👤 ${_escHtml(t.assigned.username)}</span>` : ''}
            ${t.creator?.username  ? `<span style="font-size:10px;color:var(--text3);">por ${_escHtml(t.creator.username)}</span>` : ''}
          </div>
          ${t.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:5px;">${_escHtml(t.notes)}</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn btn-xs btn-danger" onclick="_deleteTask('${t.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

async function _toggleTask(taskId) {
  const task = _tasks.find(t => t.id === taskId);
  if (!task) return;
  task.done = !task.done;
  _renderTasks();
  try {
    await SS.DB.updateTask(taskId, { done: task.done });
  } catch(e) {
    task.done = !task.done;
    _renderTasks();
  }
}

async function _deleteTask(taskId) {
  if (!confirm('¿Borrar esta tarea?')) return;
  await SS.DB.deleteTask(taskId);
  _tasks = _tasks.filter(t => t.id !== taskId);
  _renderTasks();
}

function _onTaskChange(payload) {
  const { eventType, new: newTask, old } = payload;
  if      (eventType === 'INSERT') { if (!_tasks.find(t => t.id === newTask.id)) _tasks.push(newTask); }
  else if (eventType === 'UPDATE') { const i = _tasks.findIndex(t => t.id === newTask.id); if (i !== -1) _tasks[i] = { ..._tasks[i], ...newTask }; }
  else if (eventType === 'DELETE') { _tasks = _tasks.filter(t => t.id !== old.id); }
  _renderTasks();
}

function openCreateTask() {
  if (!_activeGroup) return;
  document.getElementById('task-title').value    = '';
  document.getElementById('task-notes').value    = '';
  document.getElementById('task-priority').value = 'med';
  document.getElementById('task-due').value      = '';
  const sel = document.getElementById('task-assigned');
  sel.innerHTML = '<option value="">Sin asignar</option>' +
    _members.map(m => `<option value="${m.id}">${_escHtml(m.username || 'Usuario')}</option>`).join('');
  openModal('modal-create-task');
}

async function confirmCreateTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('Ingresa un título', 'error'); return; }
  const task = {
    title,
    notes:       document.getElementById('task-notes').value.trim() || null,
    priority:    document.getElementById('task-priority').value,
    due:         document.getElementById('task-due').value || null,
    assigned_to: document.getElementById('task-assigned').value || null,
  };
  try {
    const created = await SS.DB.createTask(_activeGroup.id, _user.id, task);
    _tasks.unshift(created);
    _renderTasks();
    closeModal('modal-create-task');
    showToast('Tarea creada', 'success');
  } catch(e) {
    showToast('Error creando la tarea', 'error');
  }
}
