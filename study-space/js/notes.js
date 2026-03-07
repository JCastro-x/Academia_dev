// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — notes.js
// ═══════════════════════════════════════════════════════════════

let _notes        = [];
let _activeNoteId = null;
let _noteTimer    = null;

async function _loadNotes() {
  _notes = await SS.DB.getNotes(_activeGroup.id);
  _renderNoteList();
  if (_notes.length > 0 && !_activeNoteId) {
    _openNote(_notes[0]);
  } else if (_notes.length === 0) {
    document.getElementById('note-editor').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);flex-direction:column;gap:10px;">
        <span style="font-size:36px;">📝</span>
        <span style="font-size:13px;">Crea la primera nota del grupo</span>
      </div>`;
  }
}

function _renderNoteList() {
  const list = document.getElementById('note-list');
  if (!_notes.length) {
    list.innerHTML = `<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon" style="font-size:24px;">📝</div><div class="empty-state-desc" style="font-size:11px;">Sin notas todavía</div></div>`;
    return;
  }
  list.innerHTML = _notes.map(n => `
    <div class="note-list-item ${n.id === _activeNoteId ? 'active' : ''}" onclick="_openNote(${JSON.stringify(n).replace(/"/g,"'")})">
      <div class="note-list-item-title">${_escHtml(n.title || 'Sin título')}</div>
      <div class="note-list-item-meta">${_timeAgo(n.updated_at)}</div>
    </div>
  `).join('');
}

function _openNote(note) {
  _activeNoteId = note.id;
  _renderNoteList();
  const editor = document.getElementById('note-editor');
  editor.innerHTML = `
    <div class="note-editor-header">
      <input class="note-title-input" id="note-title" value="${_escAttr(note.title || '')}"
             placeholder="Título de la nota"
             onblur="_saveNoteTitle()"
             onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('note-body').focus();}">
      <button class="btn btn-danger btn-xs" onclick="_deleteNote('${note.id}')">🗑️</button>
      <button class="btn btn-ghost btn-xs" onclick="switchPage('history')">🕐 Historial</button>
    </div>
    <div class="note-toolbar">
      <button class="toolbar-btn" onclick="document.execCommand('bold')" title="Negrita"><b>B</b></button>
      <button class="toolbar-btn" onclick="document.execCommand('italic')" title="Cursiva"><i>I</i></button>
      <button class="toolbar-btn" onclick="document.execCommand('underline')" title="Subrayado"><u>U</u></button>
      <button class="toolbar-btn" onclick="document.execCommand('insertUnorderedList')" title="Lista">• Lista</button>
      <button class="toolbar-btn" onclick="document.execCommand('insertOrderedList')" title="Numerada">1. Num</button>
      <button class="toolbar-btn" onclick="document.execCommand('formatBlock',false,'h2')" title="Título">H2</button>
      <button class="toolbar-btn" onclick="document.execCommand('removeFormat')" title="Limpiar">✕ fmt</button>
    </div>
    <div class="note-content" id="note-body" contenteditable="true"
         oninput="_onNoteInput()">${note.content || ''}</div>
    <div class="note-footer">
      <span id="note-status">💾 Guardado</span>
      <span id="note-edit-info">${note.updated_by ? 'Editado por ' + (note.social_profiles?.username || 'alguien') : ''}</span>
    </div>
  `;
}

function _onNoteInput() {
  document.getElementById('note-status').textContent = '⏳ Guardando...';
  clearTimeout(_noteTimer);
  _noteTimer = setTimeout(_saveNoteContent, 1500);
}

async function _saveNoteContent() {
  if (!_activeNoteId) return;
  const body = document.getElementById('note-body');
  if (!body) return;
  const content = body.innerHTML;
  const note    = _notes.find(n => n.id === _activeNoteId);
  if (!note) return;
  try {
    await SS.DB.saveNoteHistory(_activeNoteId, _activeGroup.id, _user.id, note.content || '', 'Editó el contenido');
    const updated = await SS.DB.updateNote(_activeNoteId, { content }, _user.id);
    note.content    = content;
    note.updated_at = updated.updated_at;
    const statusEl = document.getElementById('note-status');
    if (statusEl) statusEl.textContent = '✅ Guardado';
  } catch(e) {
    const statusEl = document.getElementById('note-status');
    if (statusEl) statusEl.textContent = '❌ Error al guardar';
  }
}

async function _saveNoteTitle() {
  if (!_activeNoteId) return;
  const title = document.getElementById('note-title')?.value.trim() || 'Sin título';
  const note  = _notes.find(n => n.id === _activeNoteId);
  if (!note || note.title === title) return;
  await SS.DB.updateNote(_activeNoteId, { title }, _user.id);
  note.title = title;
  _renderNoteList();
}

async function createNote() {
  if (!_activeGroup) return;
  const note = await SS.DB.createNote(_activeGroup.id, _user.id);
  _notes.unshift(note);
  _renderNoteList();
  _openNote(note);
  showToast('Nota creada', 'success');
}

async function _deleteNote(noteId) {
  if (!confirm('¿Borrar esta nota permanentemente?')) return;
  await SS.DB.deleteNote(noteId);
  _notes = _notes.filter(n => n.id !== noteId);
  if (_activeNoteId === noteId) {
    _activeNoteId = null;
    document.getElementById('note-editor').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);flex-direction:column;gap:10px;">
        <span style="font-size:36px;">📝</span><span style="font-size:13px;">Selecciona o crea una nota</span>
      </div>`;
  }
  _renderNoteList();
  showToast('Nota borrada', 'info');
}

function _onNoteChange(payload) {
  const { eventType, new: newNote, old } = payload;
  if (eventType === 'INSERT') {
    if (!_notes.find(n => n.id === newNote.id)) { _notes.unshift(newNote); _renderNoteList(); }
  } else if (eventType === 'UPDATE') {
    const idx = _notes.findIndex(n => n.id === newNote.id);
    if (idx !== -1) _notes[idx] = { ..._notes[idx], ...newNote };
    if (newNote.id === _activeNoteId && newNote.updated_by !== _user.id) {
      const body = document.getElementById('note-body');
      if (body && document.activeElement !== body) {
        body.innerHTML = newNote.content || '';
        const statusEl = document.getElementById('note-status');
        if (statusEl) statusEl.textContent = '🔄 Actualizado por otro usuario';
      }
    }
    _renderNoteList();
  } else if (eventType === 'DELETE') {
    _notes = _notes.filter(n => n.id !== old.id);
    if (_activeNoteId === old.id) {
      _activeNoteId = null;
      document.getElementById('note-editor').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);flex-direction:column;gap:10px;"><span style="font-size:36px;">📝</span><span>Esta nota fue borrada</span></div>`;
    }
    _renderNoteList();
  }
}

async function _loadHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="empty-state"><div class="spinner spinner-lg"></div></div>';
  try {
    const history = await SS.DB.getAllGroupHistory(_activeGroup.id);
    if (!history.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🕐</div><div class="empty-state-title">Sin historial</div><div class="empty-state-desc">Los cambios en notas aparecerán aquí</div></div>`;
      return;
    }
    list.innerHTML = history.map(h => `
      <div class="history-item">
        <div class="history-dot"></div>
        <div class="history-body">
          <div class="history-title">
            📝 ${_escHtml(h.social_notes?.title || 'Nota')}
            <span style="font-size:11px;font-weight:400;color:var(--text3);"> — ${_escHtml(h.description || 'Editado')}</span>
          </div>
          <div class="history-meta">
            <span>👤 ${_escHtml(h.social_profiles?.username || 'alguien')}</span>
            <span>${_timeAgo(h.created_at)}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="btn btn-xs btn-ghost" onclick="_restoreSnapshot('${h.id}','${h.note_id}',this)" title="Restaurar esta versión">↩️</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-title">Error cargando historial</div></div>';
  }
}

async function _restoreSnapshot(historyId, noteId, btn) {
  if (!confirm('¿Restaurar esta versión de la nota? Se sobreescribirá el contenido actual.')) return;
  const { data: h } = await SS.client.from('social_note_history').select('snapshot').eq('id', historyId).single();
  if (!h) return;
  await SS.DB.updateNote(noteId, { content: h.snapshot }, _user.id);
  const note = _notes.find(n => n.id === noteId);
  if (note) note.content = h.snapshot;
  if (_activeNoteId === noteId) {
    const body = document.getElementById('note-body');
    if (body) body.innerHTML = h.snapshot;
  }
  showToast('Versión restaurada ✓', 'success');
}
