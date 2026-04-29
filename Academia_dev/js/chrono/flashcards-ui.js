// ═══════════════════════════════════════════════════════════════
// FLASHCARDS UI — CRUD y Modo Estudio
// Renderizado de flashcards, modales y controles de estudio
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// RENDERIZADO PRINCIPAL
// ═══════════════════════════════════════════════════════════════
function renderFlashcards() {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  const cards = typeof _getFlashcards === 'function' ? _getFlashcards() : [];

  // Fill mat select
  const fcMat = document.getElementById('fc-mat');
  if (fcMat && !fcMat.children.length) {
    fcMat.innerHTML = '<option value="">— General —</option>';
    State.materias.forEach(m => { 
      const o = document.createElement('option'); 
      o.value = m.id; 
      o.textContent = `${m.icon || '📚'} ${m.name}`; 
      fcMat.appendChild(o); 
    });
  }

  if (!cards.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <div style="font-size:48px;margin-bottom:12px;">🃏</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Sin flashcards aún</div>
      <div style="font-size:12px;margin-bottom:16px;">Crea tarjetas para estudiar o selecciona texto en una nota</div>
      <button class="btn btn-primary" onclick="openNewFlashcardModal()">+ Primera flashcard</button>
    </div>`;
    return;
  }

  // Group by mat
  const byMat = {};
  cards.forEach(c => { const k = c.matId || 'general'; if (!byMat[k]) byMat[k] = []; byMat[k].push(c); });

  const now = Date.now();
  let html = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
    <span style="font-size:12px;color:var(--text3);">${cards.length} tarjetas totales · </span>
    <span style="font-size:12px;color:var(--green);">${cards.filter(c => c.score >= 2).length} dominadas</span>
    <span style="font-size:12px;color:var(--yellow);">· ${cards.filter(c => c.score === 1).length} practicando</span>
    <span style="font-size:12px;color:var(--red);">· ${cards.filter(c => !c.score).length} nuevas</span>
    ${cards.filter(c => c.nextReview && c.nextReview <= now).length > 0 ? `<span style="font-size:12px;color:#f97316;font-weight:700;">· ⏰ ${cards.filter(c => c.nextReview && c.nextReview <= now).length} para revisar hoy</span>` : ''}
  </div>`;

  Object.entries(byMat).forEach(([matId, mCards]) => {
    const m = matId === 'general' ? { name: 'General', icon: '📋' } : getMat(matId);
    html += `<div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">${m.icon || '📚'} ${m.name}</div>
      <div class="fc-grid">
        ${mCards.map(c => {
          const isOverdue = c.nextReview && c.nextReview <= now;
          const daysUntil = c.nextReview ? Math.ceil((c.nextReview - now) / 86400000) : null;
          const reviewBadge = c.nextReview
            ? `<div style="font-size:9px;font-family:'Space Mono',monospace;margin-top:5px;color:${isOverdue ? '#f87171' : daysUntil <= 1 ? '#fbbf24' : 'var(--text3)'};">⏰ ${isOverdue ? '¡Revisar hoy!' : daysUntil === 0 ? 'Revisar hoy' : 'Revisar en ' + daysUntil + 'd'}</div>`
            : '';
          return `<div class="fc-card" onclick="openNewFlashcardModal('${c.id}')">
          <div class="fc-front">${c.front}</div>
          <div class="fc-back-preview">${(c.back || '').slice(0, 60)}${c.back?.length > 60 ? '…' : ''}</div>
          ${(c.tags || []).map(t => `<span class="fc-tag">#${t}</span>`).join('')}
          <div class="fc-score-bar"><div class="fc-score-fill" style="width:${(c.score || 0) * 50}%;background:${c.score >= 2 ? 'var(--green)' : c.score === 1 ? 'var(--yellow)' : 'var(--red)'};"></div></div>
          ${reviewBadge}
        </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// MODALES DE FLASHCARDS
// ═══════════════════════════════════════════════════════════════
function openNewFlashcardModal(editId) {
  const cards = typeof _getFlashcards === 'function' ? _getFlashcards() : [];
  const c = editId ? cards.find(x => x.id === editId) : null;
  document.getElementById('fc-edit-id').value = editId || '';
  document.getElementById('fc-modal-title').textContent = editId ? '✏️ Editar Flashcard' : '🃏 Nueva Flashcard';
  document.getElementById('fc-front').value = c?.front || '';
  document.getElementById('fc-back').value = c?.back || '';
  document.getElementById('fc-tags').value = (c?.tags || []).join(', ');
  
  const fcMat = document.getElementById('fc-mat');
  if (fcMat) {
    if (!fcMat.children.length) {
      fcMat.innerHTML = '<option value="">— General —</option>';
      State.materias.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = `${m.icon || '📚'} ${m.name}`; fcMat.appendChild(o); });
    }
    fcMat.value = c?.matId || '';
  }
  
  if (typeof _uiClick === 'function') _uiClick('modal-open');
  document.getElementById('modal-flashcard').classList.add('open');
}

function saveFlashcard() {
  const front = document.getElementById('fc-front').value.trim();
  const back = document.getElementById('fc-back').value.trim();
  if (!front) { document.getElementById('fc-front').style.borderColor = 'var(--red)'; return; }
  document.getElementById('fc-front').style.borderColor = '';
  const cards = typeof _getFlashcards === 'function' ? _getFlashcards() : [];
  const editId = document.getElementById('fc-edit-id').value;
  const tags = (document.getElementById('fc-tags').value || '').split(',').map(t => t.trim()).filter(Boolean);
  const matId = document.getElementById('fc-mat')?.value || '';
  if (editId) {
    const idx = cards.findIndex(c => c.id === editId);
    if (idx >= 0) { cards[idx] = { ...cards[idx], front, back, tags, matId }; }
  } else {
    cards.push({ id: 'fc_' + Date.now(), front, back, tags, matId, score: 0, createdAt: Date.now() });
  }
  if (typeof _saveFlashcards === 'function') _saveFlashcards(cards);
  closeModal('modal-flashcard');
  renderFlashcards();
  if (typeof _uiClick === 'function') _uiClick('save');
  
  window.dispatchEvent(new CustomEvent('flashcard:created', { detail: { id: editId || cards[cards.length - 1]?.id } }));
}

async function deleteFlashcard(id) {
  const cards = typeof _getFlashcards === 'function' ? _getFlashcards() : [];
  const card = cards.find(c => c.id === id);
  if (!card) return;

  const confirmed = await showConfirm(`¿Eliminar la flashcard?`, { danger: true });
  if (!confirmed) return;

  const deletedCard = { ...card };
  const filtered = cards.filter(c => c.id !== id);
  if (typeof _saveFlashcards === 'function') _saveFlashcards(filtered);
  renderFlashcards();

  if (typeof showUndoToast === 'function') {
    showUndoToast(`Flashcard eliminada`, () => {
      const current = typeof _getFlashcards === 'function' ? _getFlashcards() : [];
      current.push(deletedCard);
      if (typeof _saveFlashcards === 'function') _saveFlashcards(current);
      renderFlashcards();
    });
  }
  
  window.dispatchEvent(new CustomEvent('flashcard:deleted', { detail: { id } }));
}

function createFlashcardFromSelection() {
  const sel = window.getSelection()?.toString().trim();
  if (!sel) { if (typeof _appNotify === 'function') _appNotify('Selecciona texto en la nota primero', 'warning'); return; }
  openNewFlashcardModal();
  setTimeout(() => { document.getElementById('fc-front').value = sel; }, 50);
}

// ═══════════════════════════════════════════════════════════════
// MODO ESTUDIO
// ═══════════════════════════════════════════════════════════════
function startFlashcardStudy() {
  const cards = typeof _getFlashcards === 'function' ? _getFlashcards() : [];
  if (!cards.length) { if (typeof _appNotify === 'function') _appNotify('No tienes flashcards aún. ¡Crea algunas primero!', 'warning'); return; }
  
  const now = Date.now();
  window._studyDeck = [...cards].sort((a, b) => {
    const aOverdue = a.nextReview && a.nextReview <= now ? 0 : 1;
    const bOverdue = b.nextReview && b.nextReview <= now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (a.score || 0) - (b.score || 0);
  });
  window._studyIdx = 0;
  window._studyFlipped = false;
  
  if (typeof _uiClick === 'function') _uiClick('modal-open');
  document.getElementById('modal-fc-study').classList.add('open');
  _renderStudyCard();
}

function _renderStudyCard() {
  if (window._studyIdx >= window._studyDeck.length) {
    document.getElementById('fc-study-text').textContent = '¡Terminaste el mazo! 🎉';
    document.getElementById('fc-study-side').textContent = 'COMPLETADO';
    document.getElementById('fc-study-actions').style.display = 'none';
    document.getElementById('fc-study-flip-hint').textContent = 'Cierra para terminar';
    document.getElementById('fc-study-progress').textContent = `${window._studyDeck.length} / ${window._studyDeck.length}`;
    if (typeof _uiClick === 'function') _uiClick('task-done');
    return;
  }
  
  const c = window._studyDeck[window._studyIdx];
  window._studyFlipped = false;
  document.getElementById('fc-study-progress').textContent = `${window._studyIdx + 1} / ${window._studyDeck.length}`;
  const m = c.matId ? getMat(c.matId) : { name: 'General', icon: '📋' };
  document.getElementById('fc-study-mat').textContent = `${m.icon || '📚'} ${m.name}`;
  document.getElementById('fc-study-side').textContent = 'PREGUNTA';
  document.getElementById('fc-study-text').textContent = c.front;
  document.getElementById('fc-study-actions').style.display = 'none';
  document.getElementById('fc-study-flip-hint').style.display = 'block';
  document.getElementById('fc-card-wrap').style.borderColor = 'var(--border2)';
  const nrEl = document.getElementById('fc-study-next-review');
  if (nrEl) nrEl.style.display = 'none';
}

function flipStudyCard() {
  if (window._studyIdx >= window._studyDeck.length) return;
  if (window._studyFlipped) return;
  window._studyFlipped = true;
  
  const c = window._studyDeck[window._studyIdx];
  const wrap = document.getElementById('fc-card-wrap');
  wrap.style.animation = 'fc-flip .3s ease';
  
  setTimeout(() => {
    wrap.style.animation = '';
    document.getElementById('fc-study-side').textContent = 'RESPUESTA';
    document.getElementById('fc-study-text').textContent = c.back || '(sin respuesta)';
    document.getElementById('fc-study-actions').style.display = 'flex';
    document.getElementById('fc-study-flip-hint').style.display = 'none';
    wrap.style.borderColor = 'var(--accent)';
    
    const nrEl = document.getElementById('fc-study-next-review');
    if (nrEl) {
      const intervalDays = c.intervalDays || 1;
      nrEl.style.display = 'block';
      nrEl.textContent = `Intervalo actual: ${intervalDays} día${intervalDays !== 1 ? 's' : ''}${c.nextReview ? ' · Próx. repaso: ' + new Date(c.nextReview).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}`;
    }
  }, 150);
}

function fcRate(score) {
  if (typeof _rateCard === 'function') _rateCard(score);
  _renderStudyCard();
}

function closeStudyModal() {
  const modal = document.getElementById('modal-fc-study');
  if (modal) modal.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.renderFlashcards = renderFlashcards;
window.openNewFlashcardModal = openNewFlashcardModal;
window.saveFlashcard = saveFlashcard;
window.deleteFlashcard = deleteFlashcard;
window.createFlashcardFromSelection = createFlashcardFromSelection;
window.startFlashcardStudy = startFlashcardStudy;
window._renderStudyCard = _renderStudyCard;
window.flipStudyCard = flipStudyCard;
window.fcRate = fcRate;
window.closeStudyModal = closeStudyModal;
