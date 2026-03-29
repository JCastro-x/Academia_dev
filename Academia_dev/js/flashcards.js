/* ═════════════════════════════════════════════════
   FLASHCARDS MODULE
   Usa State.flashcards + saveState() — sincroniza
   con Supabase igual que el resto de la app.
   ════════════════════════════════════════════════ */

// ─── Estado de Flashcards ───
let currentEditingId = null;
let studyCards = [];
let currentStudyIndex = 0;
let isCardFlipped = false;

// ─── Obtener flashcards del State (NO localStorage directo) ───
function getFlashcards() {
  return State.flashcards || [];
}

// ─── Guardar flashcards via State + saveState() ───
function saveFlashcardsToStorage(cards) {
  State.flashcards = cards;
  saveState(['semestres']);
}

// ─── Renderizar página principal de flashcards ───
function renderFlashcards() {
  const cards = getFlashcards();

  // Llenar selector de materias
  const matSel = document.getElementById('fc-filter-mat');
  if (matSel) {
    const currentValue = matSel.value;
    matSel.innerHTML = '<option value="">📚 Todas las materias</option>';
    State.materias.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.icon || '📚'} ${m.name}`;
      matSel.appendChild(opt);
    });
    if (currentValue) matSel.value = currentValue;
  }

  // Mostrar/ocultar empty state
  const isEmpty = cards.length === 0;
  const emptyEl = document.getElementById('fc-empty');
  const listEl  = document.getElementById('fc-list');
  const triggerEl = document.getElementById('fc-study-trigger');

  if (emptyEl)   emptyEl.style.display   = isEmpty ? 'block' : 'none';
  if (listEl)    listEl.style.display    = isEmpty ? 'none'  : 'grid';
  if (triggerEl) triggerEl.style.display = isEmpty ? 'none'  : 'block';

  filterFlashcards();
  updateFlashcardCount(cards.length, cards.length);
}

// ─── Filtrar flashcards por materia ───
function filterFlashcards() {
  const allCards  = getFlashcards();
  const filterMat = document.getElementById('fc-filter-mat')?.value || '';

  const filtered = filterMat
    ? allCards.filter(c => c.matId === filterMat)
    : allCards;

  renderFlashcardsList(filtered);
  updateFlashcardCount(allCards.length, filtered.length);
}

// ─── Actualizar contador ───
function updateFlashcardCount(total, filtered) {
  const totalEl    = document.getElementById('fc-count-total');
  const filteredEl = document.getElementById('fc-count-filtered');
  if (totalEl)    totalEl.textContent    = `${total} tarjeta${total !== 1 ? 's' : ''}`;
  if (filteredEl) filteredEl.textContent = `${filtered} visible${filtered !== 1 ? 's' : ''}`;
}

// ─── Renderizar lista de tarjetas ───
function renderFlashcardsList(cards) {
  const container = document.getElementById('fc-list');
  if (!container) return;

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:40px;">
        <div class="empty-icon">🔍</div>
        <div class="empty-desc">No hay tarjetas con este filtro</div>
      </div>`;
    return;
  }

  container.innerHTML = cards.map(card => {
    const materia = State.materias.find(m => m.id === card.matId);
    const matIcon = materia?.icon || '📚';
    const matName = materia?.name || 'Sin materia';
    const tags    = card.tags || [];

    return `
      <div class="fc-list-item">
        <div class="fc-item-header">
          <div class="fc-item-subject">${matIcon} ${matName}</div>
          <div class="fc-item-actions">
            <button class="btn btn-sm btn-ghost" onclick="editFlashcard('${card.id}')" title="Editar">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="deleteFlashcard('${card.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
        <div class="fc-item-question">${escapeHtml(card.question)}</div>
        <div class="fc-item-answer">${escapeHtml(card.answer)}</div>
        ${tags.length > 0 ? `
          <div class="fc-item-tags">
            ${tags.map(tag => `<span class="fc-tag">#${tag.trim()}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');
}

// ─── Abrir modal para agregar flashcard ───
function openAddFlashcardModal() {
  currentEditingId = null;

  const modal         = document.getElementById('modal-flashcard');
  const title         = document.getElementById('fc-modal-title');
  const matSel        = document.getElementById('fc-mat');
  const questionInput = document.getElementById('fc-question-input');
  const answerInput   = document.getElementById('fc-answer-input');
  const tagsInput     = document.getElementById('fc-tags');
  const saveText      = document.getElementById('fc-save-text');

  if (title)    title.textContent    = 'Nueva Flashcard';
  if (saveText) saveText.textContent = 'Guardar';

  if (matSel) {
    matSel.innerHTML = '<option value="">Selecciona una materia</option>';
    State.materias.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.icon || '📚'} ${m.name}`;
      matSel.appendChild(opt);
    });
  }

  if (questionInput) questionInput.value = '';
  if (answerInput)   answerInput.value   = '';
  if (tagsInput)     tagsInput.value     = '';

  if (modal)         modal.style.display = 'flex';
  if (questionInput) questionInput.focus();

  _uiClick('open');
}

// ─── Editar flashcard existente ───
function editFlashcard(cardId) {
  const cards = getFlashcards();
  const card  = cards.find(c => c.id === cardId);
  if (!card) return;

  currentEditingId = cardId;

  const modal         = document.getElementById('modal-flashcard');
  const title         = document.getElementById('fc-modal-title');
  const matSel        = document.getElementById('fc-mat');
  const questionInput = document.getElementById('fc-question-input');
  const answerInput   = document.getElementById('fc-answer-input');
  const tagsInput     = document.getElementById('fc-tags');
  const saveText      = document.getElementById('fc-save-text');

  if (title)    title.textContent    = 'Editar Flashcard';
  if (saveText) saveText.textContent = 'Actualizar';

  if (matSel) {
    matSel.innerHTML = '<option value="">Selecciona una materia</option>';
    State.materias.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.icon || '📚'} ${m.name}`;
      matSel.appendChild(opt);
    });
    matSel.value = card.matId || '';
  }

  if (questionInput) questionInput.value = card.question || '';
  if (answerInput)   answerInput.value   = card.answer   || '';
  if (tagsInput)     tagsInput.value     = (card.tags || []).join(', ');

  if (modal)         modal.style.display = 'flex';
  if (questionInput) questionInput.focus();

  _uiClick('open');
}

// ─── Guardar flashcard (crear o actualizar) ───
function saveFlashcard() {
  const matId    = document.getElementById('fc-mat')?.value           || '';
  const question = document.getElementById('fc-question-input')?.value.trim() || '';
  const answer   = document.getElementById('fc-answer-input')?.value.trim()   || '';
  const tagsRaw  = document.getElementById('fc-tags')?.value          || '';

  if (!question) { alert('Por favor escribe una pregunta'); return; }
  if (!answer)   { alert('Por favor escribe una respuesta'); return; }

  const tags  = tagsRaw.split(',').map(t => t.trim()).filter(t => t);
  const cards = getFlashcards();

  if (currentEditingId) {
    const idx = cards.findIndex(c => c.id === currentEditingId);
    if (idx !== -1) {
      cards[idx] = { ...cards[idx], matId, question, answer, tags, updatedAt: Date.now() };
    }
  } else {
    cards.push({
      id: 'fc_' + Date.now(),
      matId, question, answer, tags,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  saveFlashcardsToStorage(cards);
  closeFlashcardModal();
  renderFlashcards();
  _uiClick('success');
}

// ─── Eliminar flashcard ───
function deleteFlashcard(cardId) {
  if (!confirm('¿Eliminar esta flashcard?')) return;
  const cards    = getFlashcards();
  const filtered = cards.filter(c => c.id !== cardId);
  saveFlashcardsToStorage(filtered);
  renderFlashcards();
  _uiClick('delete');
}

// ─── Cerrar modal ───
function closeFlashcardModal() {
  const modal = document.getElementById('modal-flashcard');
  if (modal) modal.style.display = 'none';
  currentEditingId = null;
}

// ─── Entrar al modo de estudio ───
function enterStudyMode() {
  const filterMat = document.getElementById('fc-filter-mat')?.value || '';
  const allCards  = getFlashcards();

  studyCards = filterMat
    ? allCards.filter(c => c.matId === filterMat)
    : [...allCards];

  if (studyCards.length === 0) { alert('No hay tarjetas para estudiar'); return; }

  currentStudyIndex = 0;
  isCardFlipped     = false;

  document.getElementById('fc-list-mode').style.display  = 'none';
  document.getElementById('fc-study-mode').style.display = 'block';

  renderStudyCard();
  _uiClick('enter-study');
}

// ─── Salir del modo de estudio ───
function exitStudyMode() {
  document.getElementById('fc-list-mode').style.display  = 'block';
  document.getElementById('fc-study-mode').style.display = 'none';
  studyCards        = [];
  currentStudyIndex = 0;
  isCardFlipped     = false;
}

// ─── Renderizar tarjeta actual en modo estudio ───
function renderStudyCard() {
  if (studyCards.length === 0) return;

  const card    = studyCards[currentStudyIndex];
  const materia = State.materias.find(m => m.id === card.matId);

  const progressEl = document.getElementById('fc-study-progress');
  if (progressEl) progressEl.textContent = `Tarjeta ${currentStudyIndex + 1} de ${studyCards.length}`;

  const subjectEl = document.getElementById('fc-study-subject');
  if (subjectEl) subjectEl.textContent = materia ? `${materia.icon} ${materia.name}` : '';

  const barEl = document.getElementById('fc-study-bar');
  if (barEl) barEl.style.width = ((currentStudyIndex + 1) / studyCards.length * 100) + '%';

  const questionEl = document.getElementById('fc-question');
  const answerEl   = document.getElementById('fc-answer');
  if (questionEl) questionEl.textContent = card.question;
  if (answerEl)   answerEl.textContent   = card.answer;

  const cardEl = document.getElementById('fc-card');
  if (cardEl) cardEl.classList.remove('flipped');
  isCardFlipped = false;

  const prevBtn = document.getElementById('fc-prev-btn');
  const nextBtn = document.getElementById('fc-next-btn');
  if (prevBtn) prevBtn.disabled = currentStudyIndex === 0;
  if (nextBtn) nextBtn.disabled = currentStudyIndex === studyCards.length - 1;
}

// ─── Voltear tarjeta ───
function flipCard() {
  const cardEl = document.getElementById('fc-card');
  if (!cardEl) return;
  isCardFlipped = !isCardFlipped;
  cardEl.classList.toggle('flipped', isCardFlipped);
  _uiClick('flip');
}

// ─── Navegación ───
function prevCard() {
  if (currentStudyIndex > 0) { currentStudyIndex--; renderStudyCard(); _uiClick('nav'); }
}
function nextCard() {
  if (currentStudyIndex < studyCards.length - 1) { currentStudyIndex++; renderStudyCard(); _uiClick('nav'); }
}

// ─── Mezclar tarjetas ───
function shuffleStudyCards() {
  for (let i = studyCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studyCards[i], studyCards[j]] = [studyCards[j], studyCards[i]];
  }
  currentStudyIndex = 0;
  renderStudyCard();
  _uiClick('shuffle');
}

// ─── Escape HTML ───
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Teclado en modo estudio ───
document.addEventListener('keydown', e => {
  const studyMode = document.getElementById('fc-study-mode');
  if (!studyMode || studyMode.style.display === 'none') return;
  switch (e.key) {
    case 'ArrowLeft':  prevCard();      e.preventDefault(); break;
    case 'ArrowRight': nextCard();      e.preventDefault(); break;
    case ' ':
    case 'Enter':      flipCard();      e.preventDefault(); break;
    case 'Escape':     exitStudyMode(); e.preventDefault(); break;
  }
});
