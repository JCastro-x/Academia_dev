/* ═══════════════════════════════════════════════════════════
   FLASHCARDS MODULE  v3.1
   ─ Sin confirm() para evitar race conditions con el sync
   ─ saveStateNow en mutaciones críticas (write inmediato)
   ─ Double-tap delete (mejor UX móvil + sin foco-events)
   ═══════════════════════════════════════════════════════════ */

let _fcEditCardId    = null;
let _fcEditFolderId  = null;
let _fcStudyCards    = [];
let _fcStudyIdx      = 0;
let _fcFlipped       = false;
let _fcMatId         = null;
let _fcFolderIdState = undefined; // undefined=fuera de vista-cards | null=todas | string=carpeta id

/* ── Acceso al semestre activo ── */
function _fcSem() {
  try {
    if (typeof State === 'undefined') return null;
    return State._activeSem
      || (Array.isArray(State.semestres) && State.semestres.find(s => s.activo))
      || (Array.isArray(State.semestres) && State.semestres[0])
      || null;
  } catch(e) { return null; }
}
function fcGetCards() {
  const sem = _fcSem(); if (!sem) return [];
  if (!Array.isArray(sem.flashcards)) sem.flashcards = [];
  return sem.flashcards;
}
function fcSetCards(arr) {
  const sem = _fcSem();
  if (!sem) { console.warn('[FC] No hay semestre activo'); return; }
  sem.flashcards = arr;
  // saveStateNow = escritura inmediata a localStorage → evita race con sync de Supabase
  if (typeof saveStateNow === 'function') saveStateNow(['semestres']);
  else if (typeof saveState === 'function') saveState(['semestres']);
}
function fcGetFolders() {
  const sem = _fcSem(); if (!sem) return [];
  if (!Array.isArray(sem.fcFolders)) sem.fcFolders = [];
  return sem.fcFolders;
}
function fcSetFolders(arr) {
  const sem = _fcSem(); if (!sem) return;
  sem.fcFolders = arr;
  if (typeof saveStateNow === 'function') saveStateNow(['semestres']);
  else if (typeof saveState === 'function') saveState(['semestres']);
}

/* ════════════════ RENDER PRINCIPAL ════════════════ */
function renderFlashcards() {
  _fcFolderIdState = undefined; _fcMatId = null;
  updateFcHeaderStats(); renderFcMateriasGrid(); fcNavTo('materias');
}
window.renderFlashcards = renderFlashcards;

function updateFcHeaderStats() {
  const cards = fcGetCards();
  const dom  = cards.filter(c => (c.status || c.estado) === 'dominada').length;
  const prac = cards.filter(c => (c.status || c.estado) === 'practicando').length;
  const nw   = Math.max(0, cards.length - dom - prac);
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('fc-count-total', cards.length); s('fc-stat-dominadas', dom);
  s('fc-stat-practicando', prac);    s('fc-stat-nuevas', nw);
}
window.updateFcHeaderStats = updateFcHeaderStats;

/* ════════════════ VISTA 1 — MATERIAS ════════════════ */
function renderFcMateriasGrid() {
  const grid    = document.getElementById('fc-materias-grid');
  const emptyEl = document.getElementById('fc-global-empty');
  const noMatEl = document.getElementById('fc-no-materias');
  if (!grid) return;
  const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
  const cards    = fcGetCards();
  const folders  = fcGetFolders();
  grid.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'none';
  if (noMatEl) noMatEl.style.display = 'none';
  if (!materias.length) { if (noMatEl) noMatEl.style.display = 'block'; return; }
  grid.innerHTML = materias.map(mat => {
    const mc = cards.filter(c => c.matId === mat.id);
    const mf = folders.filter(f => f.matId === mat.id);
    const cs = mat.color ? `--mat-color:${mat.color};` : '';
    return `
      <div class="fc-mat-card" style="${cs}" onclick="fcOpenMateria('${mat.id}')">
        <div class="fc-mat-icon">${mat.icon || '📚'}</div>
        <div class="fc-mat-name">${_fcEsc(mat.name)}</div>
        <div class="fc-mat-meta">
          <span class="fc-mat-chip fc-mat-chip-cards">${mc.length} tarjeta${mc.length !== 1 ? 's' : ''}</span>
          ${mf.length > 0 ? `<span class="fc-mat-chip fc-mat-chip-folders">${mf.length} carpeta${mf.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>`;
  }).join('');
  if (!cards.length && emptyEl) emptyEl.style.display = 'block';
}

/* ════════════════ VISTA 2 — CARPETAS ════════════════ */
function fcOpenMateria(matId) {
  _fcMatId = matId; _fcFolderIdState = undefined;
  const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
  const mat = materias.find(m => m.id === matId); if (!mat) return;
  const g = id => document.getElementById(id);
  if (g('fc-folder-mat-icon')) g('fc-folder-mat-icon').textContent = mat.icon || '📚';
  if (g('fc-folder-mat-name')) g('fc-folder-mat-name').textContent = mat.name;
  const allCards = fcGetCards().filter(c => c.matId === matId);
  const folders  = fcGetFolders().filter(f => f.matId === matId);
  const statsRow = g('fc-folder-stats-row');
  if (statsRow) statsRow.innerHTML = `
    <span class="fc-stat-total">${allCards.length} tarjeta${allCards.length !== 1 ? 's' : ''}</span>
    <span class="fc-stat-sep">·</span>
    <span style="color:#fbbf24;font-family:'Space Mono',monospace;font-size:12px;font-weight:600;">${folders.length} carpeta${folders.length !== 1 ? 's' : ''}</span>`;
  const allCard = g('fc-folder-all-card');
  if (allCard) allCard.innerHTML = `
    <span style="font-size:24px;">📋</span>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:800;color:var(--text);">Todas las tarjetas</div>
      <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:2px;">${allCards.length} tarjeta${allCards.length !== 1 ? 's' : ''} · sin filtro de carpeta</div>
    </div>
    <span style="color:var(--accent2);font-size:20px;">›</span>`;
  renderFoldersGrid(matId);
  fcNavTo('folders');
}

function renderFoldersGrid(matId) {
  const grid = document.getElementById('fc-folders-grid'); if (!grid) return;
  const folders = fcGetFolders().filter(f => f.matId === matId);
  const cards   = fcGetCards();
  const newBtn  = `
    <div class="fc-folder-card" style="border-style:dashed;align-items:center;justify-content:center;flex-direction:column;gap:8px;min-height:120px;display:flex;" onclick="openCreateFolderModal()">
      <span style="font-size:26px;">📁</span>
      <span style="font-size:12px;color:var(--text3);font-weight:700;">Nueva carpeta</span>
    </div>`;
  if (!folders.length) { grid.innerHTML = newBtn; return; }
  grid.innerHTML = folders.map(f => {
    const cnt = cards.filter(c => c.folderId === f.id).length;
    return `
      <div class="fc-folder-card" onclick="fcOpenFolder('${f.id}')">
        <div class="fc-folder-card-top">
          <span class="fc-folder-card-icon">${f.icon || '📁'}</span>
          <div class="fc-folder-card-actions">
            <button class="fc-act-btn" onclick="event.stopPropagation();editFolder('${f.id}')">✏️</button>
            <button class="fc-act-btn fc-del-btn" onclick="event.stopPropagation();deleteFolder('${f.id}',this)">🗑️</button>
          </div>
        </div>
        <div class="fc-folder-card-name">${_fcEsc(f.name)}</div>
        <div class="fc-folder-card-count"><span>${cnt}</span> tarjeta${cnt !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('') + newBtn;
}

/* ════════════════ VISTA 3 — TARJETAS ════════════════ */
function fcOpenFolder(folderId) {
  _fcFolderIdState = folderId;
  const cards   = fcGetCards();
  const folders = fcGetFolders();
  const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
  const mat = materias.find(m => m.id === _fcMatId);
  let filtered, folderIcon, folderName;
  if (folderId === null) {
    filtered = cards.filter(c => c.matId === _fcMatId);
    folderIcon = mat?.icon || '📋'; folderName = 'Todas las tarjetas';
  } else {
    const folder = folders.find(f => f.id === folderId);
    filtered = cards.filter(c => c.folderId === folderId);
    folderIcon = folder?.icon || '📁'; folderName = folder?.name || 'Carpeta';
  }
  const g = id => document.getElementById(id);
  if (g('fc-cards-folder-icon')) g('fc-cards-folder-icon').textContent = folderIcon;
  if (g('fc-cards-folder-name')) g('fc-cards-folder-name').textContent = folderName;
  if (g('fc-cards-back-btn'))    g('fc-cards-back-btn').textContent    = `← ${mat?.name || 'Carpetas'}`;
  const statsRow = g('fc-cards-stats-row');
  if (statsRow) statsRow.innerHTML = `<span class="fc-stat-total">${filtered.length} tarjeta${filtered.length !== 1 ? 's' : ''}</span>`;
  const studyBtn  = g('fc-study-btn-header');
  const triggerEl = g('fc-study-trigger');
  const emptyEl   = g('fc-cards-empty');
  const listEl    = g('fc-list');
  if (studyBtn)  studyBtn.style.display  = filtered.length > 0 ? 'inline-flex' : 'none';
  if (triggerEl) triggerEl.style.display = filtered.length > 0 ? 'block' : 'none';
  if (emptyEl)   emptyEl.style.display   = filtered.length === 0 ? 'block' : 'none';
  if (listEl)    listEl.style.display    = filtered.length === 0 ? 'none'  : 'grid';
  _renderCardsList(filtered);
  fcNavTo('cards');
}

function _renderCardsList(cards) {
  const container = document.getElementById('fc-list'); if (!container) return;
  if (!cards.length) { container.innerHTML = ''; return; }
  const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
  container.innerHTML = cards.map(card => {
    const mat    = materias.find(m => m.id === card.matId);
    const folder = fcGetFolders().find(f => f.id === card.folderId);
    const tags   = card.tags || [];
    return `
      <div class="fc-list-item">
        <div class="fc-item-header">
          <div class="fc-item-chips">
            <span class="fc-item-subject">${mat?.icon || '📚'} ${_fcEsc(mat?.name || 'Sin materia')}</span>
            ${folder ? `<span class="fc-item-folder-chip">${folder.icon || '📁'} ${_fcEsc(folder.name)}</span>` : ''}
          </div>
          <div class="fc-item-actions">
            <button class="fc-act-btn" onclick="editFlashcard('${card.id}')">✏️</button>
            <button class="fc-act-btn fc-del-btn" onclick="deleteFlashcard('${card.id}',this)" title="Toca dos veces para eliminar">🗑️</button>
          </div>
        </div>
        <div class="fc-item-question">${_fcEsc(card.question)}</div>
        <div class="fc-item-answer">${_fcEsc(card.answer)}</div>
        ${tags.length ? `<div class="fc-item-tags">${tags.map(t=>`<span class="fc-tag">#${_fcEsc(t.trim())}</span>`).join('')}</div>` : ''}
      </div>`;
  }).join('');
}

/* ════════════════ NAVEGACIÓN ════════════════ */
function fcNavTo(view) {
  ['fc-view-materias','fc-view-folders','fc-view-cards'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const keys = { materias:'fc-view-materias', folders:'fc-view-folders', cards:'fc-view-cards' };
  const el = document.getElementById(keys[view]); if (el) el.style.display = 'block';
}
function fcNavBack(to) {
  if (to === 'materias') {
    _fcMatId = null; _fcFolderIdState = undefined;
    renderFcMateriasGrid(); updateFcHeaderStats(); fcNavTo('materias');
  } else if (to === 'folders' && _fcMatId) {
    exitStudyMode(); _fcFolderIdState = undefined; fcOpenMateria(_fcMatId);
  }
}

/* ════════════════ MODAL FLASHCARD ════════════════ */
function openAddFlashcardModal() {
  _fcEditCardId = null; _fillFcModal(null);
  document.getElementById('modal-flashcard')?.classList.add('open');
  setTimeout(() => document.getElementById('fc-question-input')?.focus(), 80);
  if (typeof _uiClick === 'function') _uiClick('open');
}
function editFlashcard(cardId) {
  const card = fcGetCards().find(c => c.id === cardId); if (!card) return;
  _fcEditCardId = cardId; _fillFcModal(card);
  document.getElementById('modal-flashcard')?.classList.add('open');
  if (typeof _uiClick === 'function') _uiClick('open');
}
function _fillFcModal(card) {
  const g = id => document.getElementById(id);
  if (g('fc-modal-title')) g('fc-modal-title').textContent = card ? 'Editar Flashcard' : 'Nueva Flashcard';
  if (g('fc-save-text'))   g('fc-save-text').textContent   = card ? 'Actualizar'       : 'Guardar';
  const matSel = g('fc-mat');
  if (matSel) {
    matSel.innerHTML = '<option value="">— Selecciona una materia —</option>';
    const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
    materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon || '📚'} ${m.name}`; matSel.appendChild(o);
    });
    matSel.value = card?.matId || _fcMatId || '';
  }
  const preselFolder = card?.folderId || (_fcFolderIdState != null && _fcFolderIdState !== undefined ? _fcFolderIdState : '') || '';
  _fillFolderSel(card?.matId || _fcMatId || '', preselFolder);
  if (g('fc-question-input')) g('fc-question-input').value = card?.question || '';
  if (g('fc-answer-input'))   g('fc-answer-input').value   = card?.answer   || '';
  if (g('fc-tags'))           g('fc-tags').value           = (card?.tags || []).join(', ');
}
function fcUpdateFolderSelect() {
  _fillFolderSel(document.getElementById('fc-mat')?.value || '', '');
}
function _fillFolderSel(matId, selectedId) {
  const sel = document.getElementById('fc-folder-sel'); if (!sel) return;
  sel.innerHTML = '<option value="">Sin carpeta (general)</option>';
  fcGetFolders().filter(f => f.matId === matId).forEach(f => {
    const o = document.createElement('option'); o.value = f.id;
    o.textContent = `${f.icon || '📁'} ${f.name}`; sel.appendChild(o);
  });
  if (selectedId) sel.value = selectedId;
}
function saveFlashcard() {
  const gv = id => (document.getElementById(id)?.value || '').trim();
  const matId    = gv('fc-mat');
  const folderId = gv('fc-folder-sel') || null;
  const question = gv('fc-question-input');
  const answer   = gv('fc-answer-input');
  const tags     = gv('fc-tags').split(',').map(t => t.trim()).filter(Boolean);
  if (!matId)    { alert('Selecciona una materia'); document.getElementById('fc-mat')?.focus(); return; }
  if (!question) { alert('Escribe una pregunta'); document.getElementById('fc-question-input')?.focus(); return; }
  if (!answer)   { alert('Escribe una respuesta'); document.getElementById('fc-answer-input')?.focus(); return; }
  const cards = fcGetCards();
  if (_fcEditCardId) {
    const idx = cards.findIndex(c => c.id === _fcEditCardId);
    if (idx !== -1) cards[idx] = { ...cards[idx], matId, folderId: folderId || null, question, answer, tags, updatedAt: Date.now() };
  } else {
    cards.push({ id: 'fc_' + Date.now(), matId, folderId: folderId || null, question, answer, tags, status: 'nueva', createdAt: Date.now(), updatedAt: Date.now() });
  }
  fcSetCards(cards); // saveStateNow dentro
  closeFlashcardModal(); _fcRefresh(); updateFcHeaderStats();
  if (typeof _uiClick === 'function') _uiClick('success');
}
function closeFlashcardModal() {
  document.getElementById('modal-flashcard')?.classList.remove('open'); _fcEditCardId = null;
}

/* ── Double-tap delete — sin confirm() (evita focus events que disparan sync) ── */
function deleteFlashcard(cardId, btn) {
  if (!btn || btn.dataset.confirming === '1') {
    // Sin botón O segunda pulsación → borrar
    if (btn) { clearTimeout(btn._fcTimer); btn.dataset.confirming = ''; }
    fcSetCards(fcGetCards().filter(c => c.id !== cardId));
    _fcRefresh(); updateFcHeaderStats();
    if (typeof _uiClick === 'function') _uiClick('delete');
    return;
  }
  // Primera pulsación — mostrar confirmación
  btn.dataset.confirming = '1';
  const orig = btn.innerHTML;
  btn.innerHTML = '¿Seguro?';
  btn.style.cssText = 'background:rgba(248,113,113,.25);color:#f87171;border-color:rgba(248,113,113,.5);width:auto;padding:0 8px;font-size:11px;font-weight:700;border-radius:6px;';
  btn._fcTimer = setTimeout(() => {
    btn.dataset.confirming = ''; btn.innerHTML = orig; btn.style.cssText = '';
  }, 2500);
}

function deleteFolder(folderId, btn) {
  if (!btn || btn.dataset.confirming === '1') {
    if (btn) { clearTimeout(btn._fcTimer); btn.dataset.confirming = ''; }
    fcSetCards(fcGetCards().map(c => c.folderId === folderId ? { ...c, folderId: null } : c));
    fcSetFolders(fcGetFolders().filter(f => f.id !== folderId));
    if (_fcMatId) fcOpenMateria(_fcMatId);
    updateFcHeaderStats();
    if (typeof _uiClick === 'function') _uiClick('delete');
    return;
  }
  btn.dataset.confirming = '1';
  const orig = btn.innerHTML;
  btn.innerHTML = '¿Seguro?';
  btn.style.cssText = 'background:rgba(248,113,113,.25);color:#f87171;border-color:rgba(248,113,113,.5);width:auto;padding:0 8px;font-size:11px;font-weight:700;border-radius:6px;';
  btn._fcTimer = setTimeout(() => {
    btn.dataset.confirming = ''; btn.innerHTML = orig; btn.style.cssText = '';
  }, 2500);
}

function _fcRefresh() {
  const v3 = document.getElementById('fc-view-cards');
  const v2 = document.getElementById('fc-view-folders');
  if (v3 && v3.style.display !== 'none' && _fcFolderIdState !== undefined) fcOpenFolder(_fcFolderIdState);
  else if (v2 && v2.style.display !== 'none' && _fcMatId) fcOpenMateria(_fcMatId);
  else renderFcMateriasGrid();
}

/* ════════════════ MODAL CARPETA ════════════════ */
function openCreateFolderModal() {
  _fcEditFolderId = null;
  const g = id => document.getElementById(id);
  if (g('fc-folder-modal-title')) g('fc-folder-modal-title').textContent = 'Nueva Carpeta';
  if (g('fc-folder-save-text'))   g('fc-folder-save-text').textContent   = 'Crear Carpeta';
  if (g('fc-folder-name-input'))  g('fc-folder-name-input').value        = '';
  _resetIconPicker('📁');
  document.getElementById('modal-folder')?.classList.add('open');
  setTimeout(() => document.getElementById('fc-folder-name-input')?.focus(), 80);
}
function editFolder(folderId) {
  const folder = fcGetFolders().find(f => f.id === folderId); if (!folder) return;
  _fcEditFolderId = folderId;
  const g = id => document.getElementById(id);
  if (g('fc-folder-modal-title')) g('fc-folder-modal-title').textContent = 'Editar Carpeta';
  if (g('fc-folder-save-text'))   g('fc-folder-save-text').textContent   = 'Guardar';
  if (g('fc-folder-name-input'))  g('fc-folder-name-input').value        = folder.name || '';
  _resetIconPicker(folder.icon || '📁');
  document.getElementById('modal-folder')?.classList.add('open');
}
function _resetIconPicker(icon) {
  document.querySelectorAll('.fc-icon-opt').forEach(el => el.classList.toggle('selected', el.dataset.icon === icon));
}
function saveFolder() {
  const name = (document.getElementById('fc-folder-name-input')?.value || '').trim();
  if (!name) { alert('Escribe un nombre para la carpeta'); return; }
  const icon    = document.querySelector('.fc-icon-opt.selected')?.dataset.icon || '📁';
  const folders = fcGetFolders();
  if (_fcEditFolderId) {
    const idx = folders.findIndex(f => f.id === _fcEditFolderId);
    if (idx !== -1) folders[idx] = { ...folders[idx], name, icon, updatedAt: Date.now() };
  } else {
    folders.push({ id: 'folder_' + Date.now(), matId: _fcMatId, name, icon, createdAt: Date.now() });
  }
  fcSetFolders(folders); // saveStateNow dentro
  closeFolderModal();
  if (_fcMatId) fcOpenMateria(_fcMatId);
  if (typeof _uiClick === 'function') _uiClick('success');
}
function closeFolderModal() {
  document.getElementById('modal-folder')?.classList.remove('open'); _fcEditFolderId = null;
}
document.addEventListener('click', e => {
  const opt = e.target.closest('.fc-icon-opt'); if (!opt) return;
  document.querySelectorAll('.fc-icon-opt').forEach(el => el.classList.remove('selected'));
  opt.classList.add('selected');
});

/* ════════════════ MODO ESTUDIO ════════════════ */
function enterStudyMode() {
  const cards = fcGetCards();
  const pool  = _fcFolderIdState === null  ? cards.filter(c => c.matId === _fcMatId)
              : _fcFolderIdState           ? cards.filter(c => c.folderId === _fcFolderIdState)
              : [...cards];
  if (!pool.length) { alert('No hay tarjetas para estudiar'); return; }
  _fcStudyCards = [...pool]; _fcStudyIdx = 0; _fcFlipped = false;
  document.getElementById('fc-list-mode').style.display  = 'none';
  document.getElementById('fc-study-mode').style.display = 'block';
  _renderStudyCard();
  if (typeof _uiClick === 'function') _uiClick('enter-study');
}
function exitStudyMode() {
  const sm = document.getElementById('fc-study-mode');
  const lm = document.getElementById('fc-list-mode');
  if (sm) sm.style.display = 'none';
  if (lm) lm.style.display = 'block';
  _fcStudyCards = []; _fcStudyIdx = 0; _fcFlipped = false;
  ['fc-rating-row','fc-next-info'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}
function _renderStudyCard() {
  if (!_fcStudyCards.length) return;
  const card = _fcStudyCards[_fcStudyIdx];
  const materias = (typeof State !== 'undefined' && Array.isArray(State.materias)) ? State.materias : [];
  const mat = materias.find(m => m.id === card.matId);
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('fc-study-progress', `Tarjeta ${_fcStudyIdx + 1} de ${_fcStudyCards.length}`);
  s('fc-study-subject',  mat ? `${mat.icon || ''} ${mat.name}` : '');
  const bar = document.getElementById('fc-study-bar');
  if (bar) bar.style.width = ((_fcStudyIdx + 1) / _fcStudyCards.length * 100) + '%';
  s('fc-question', card.question); s('fc-answer', card.answer);
  const cardEl = document.getElementById('fc-card');
  if (cardEl) cardEl.classList.remove('flipped');
  _fcFlipped = false;
  ['fc-rating-row','fc-next-info'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const p = document.getElementById('fc-prev-btn');
  const n = document.getElementById('fc-next-btn');
  if (p) p.disabled = _fcStudyIdx === 0;
  if (n) n.disabled = _fcStudyIdx === _fcStudyCards.length - 1;
}
function flipCard() {
  const c = document.getElementById('fc-card'); if (!c) return;
  _fcFlipped = !_fcFlipped; c.classList.toggle('flipped', _fcFlipped);
  const rr = document.getElementById('fc-rating-row');
  if (rr) rr.style.display = _fcFlipped ? 'flex' : 'none';
  if (typeof _uiClick === 'function') _uiClick('flip');
}
function rateCard(rating) {
  const card = _fcStudyCards[_fcStudyIdx]; if (!card) return;
  const statusMap = { dificil:'practicando', media:'practicando', facil:'dominada' };
  const cards = fcGetCards();
  const idx = cards.findIndex(c => c.id === card.id);
  if (idx !== -1) cards[idx] = { ...cards[idx], status: statusMap[rating] || 'practicando', lastReview: Date.now() };
  fcSetCards(cards);
  const ni = document.getElementById('fc-next-info');
  const msgs = { dificil:'Sigue practicando 💪', media:'Casi lo tienes 😊', facil:'¡Dominada! ✅' };
  if (ni) { ni.textContent = msgs[rating]; ni.style.display = 'block'; }
  setTimeout(() => {
    if (_fcStudyIdx < _fcStudyCards.length - 1) { _fcStudyIdx++; _renderStudyCard(); updateFcHeaderStats(); }
    else { exitStudyMode(); updateFcHeaderStats(); alert(`¡Sesión completada! Repasaste ${_fcStudyCards.length} tarjeta${_fcStudyCards.length !== 1 ? 's' : ''} 🎉`); }
  }, 800);
}
function prevCard() { if (_fcStudyIdx > 0) { _fcStudyIdx--; _renderStudyCard(); } }
function nextCard() { if (_fcStudyIdx < _fcStudyCards.length - 1) { _fcStudyIdx++; _renderStudyCard(); } }
function shuffleStudyCards() {
  for (let i = _fcStudyCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [_fcStudyCards[i], _fcStudyCards[j]] = [_fcStudyCards[j], _fcStudyCards[i]];
  }
  _fcStudyIdx = 0; _renderStudyCard();
}
document.addEventListener('keydown', e => {
  const sm = document.getElementById('fc-study-mode');
  if (!sm || sm.style.display === 'none') return;
  if (e.key === 'ArrowLeft')              { prevCard();      e.preventDefault(); }
  if (e.key === 'ArrowRight')             { nextCard();      e.preventDefault(); }
  if (e.key === ' ' || e.key === 'Enter') { flipCard();      e.preventDefault(); }
  if (e.key === 'Escape')                 { exitStudyMode(); e.preventDefault(); }
  if (e.key === '1' && _fcFlipped)        { rateCard('dificil'); e.preventDefault(); }
  if (e.key === '2' && _fcFlipped)        { rateCard('media');   e.preventDefault(); }
  if (e.key === '3' && _fcFlipped)        { rateCard('facil');   e.preventDefault(); }
});

function _fcEsc(t) { const d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
