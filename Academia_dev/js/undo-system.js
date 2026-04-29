/* ═══════════════════════════════════════════════════════════
   UNDO SYSTEM  v1.0
   ─ Sistema de undo para acciones destructivas
   ═══════════════════════════════════════════════════════════ */

const _undoSystemStack = [];
const _undoSystemTimeouts = {};

// ── Show Undo Toast ───────────────────────────────────────────────
function showUndoToast(message, undoCallback, duration = 5000) {
  // Remove existing toast if any
  const existing = document.getElementById('undo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'undo-toast';
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <span class="undo-message">${message}</span>
    <button class="undo-btn" id="undo-action-btn">Deshacer</button>
  `;

  document.body.appendChild(toast);

  // Auto-hide after duration
  const timeoutId = setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);

  // Undo button click
  document.getElementById('undo-action-btn').onclick = () => {
    clearTimeout(timeoutId);
    undoCallback();
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  };
}

// ── Undo Actions ───────────────────────────────────────────────────
function undoDeleteClass(matId, deletedData) {
  const sem = getActiveSem();
  if (!sem) return;

  sem.materias.push(deletedData.mat);
  if (deletedData.linkedLab) {
    sem.materias.push(deletedData.linkedLab);
  }
  if (deletedData.grades) {
    Object.assign(State.grades, deletedData.grades);
  }
  if (deletedData.topics) {
    State.topics = [...State.topics, ...deletedData.topics];
  }

  saveState(['materias', 'grades', 'topics']);
  renderMaterias();
  renderOverview();
  renderTasks();
  renderCalendar();
  updateGPADisplay();
}

function undoDeleteTask(taskId, deletedTask) {
  State.tasks.push(deletedTask);
  saveState(['tasks']);
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();
}

function undoDeleteFlashcard(cardId, deletedCard) {
  const cards = fcGetCards();
  cards.push(deletedCard);
  fcSetCards(cards);
  _fcRefresh();
  updateFcHeaderStats();
}

// ── Modified Delete Functions with Undo ───────────────────────────
// These override the original delete functions

// Override deleteClass in materias.js
const originalDeleteClass = typeof deleteClass !== 'undefined' ? deleteClass : null;

function deleteClassWithUndo(matId) {
  const mat = getMat(matId);
  if (!mat) return;

  // Store data for undo
  const deletedData = {
    mat: { ...mat },
    linkedLab: mat.linkedLabId ? getMat(mat.linkedLabId) : null,
    grades: State.grades[matId] ? { [matId]: State.grades[matId] } : null,
    topics: State.topics.filter(t => t.matId === matId)
  };

  // Perform delete
  const sem = getActiveSem();
  sem.materias = sem.materias.filter(m => m.id !== matId);
  
  if (mat.linkedLabId) {
    sem.materias = sem.materias.filter(m => m.id !== mat.linkedLabId);
    delete State.grades[mat.linkedLabId];
    State.topics = State.topics.filter(t => t.matId !== mat.linkedLabId);
  }
  delete State.grades[matId];
  State.topics = State.topics.filter(t => t.matId !== matId);

  saveState(['materias', 'grades', 'topics']);
  renderMaterias();
  renderOverview();
  renderTasks();
  renderCalendar();
  updateGPADisplay();

  // Show undo toast
  showUndoToast(`Materia "${mat.name}" eliminada`, () => undoDeleteClass(matId, deletedData));
}

// Override deleteTask in tasks.js
const originalDeleteTask = typeof deleteTask !== 'undefined' ? deleteTask : null;

function deleteTaskWithUndo(id) {
  const task = State.tasks.find(t => t.id === id);
  if (!task) return;

  const deletedTask = { ...task };
  
  State.tasks = State.tasks.filter(t => t.id !== id);
  saveState(['tasks']);
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();

  showUndoToast(`Tarea "${task.title}" eliminada`, () => undoDeleteTask(id, deletedTask));
}

// Override deleteFlashcard in flashcards.js
const originalDeleteFlashcard = typeof deleteFlashcard !== 'undefined' ? deleteFlashcard : null;

function deleteFlashcardWithUndo(cardId, btn) {
  const card = fcGetCards().find(c => c.id === cardId);
  if (!card) return;

  const deletedCard = { ...card };

  if (!btn || btn.dataset.confirming === '1') {
    if (btn) { clearTimeout(btn._fcTimer); btn.dataset.confirming = ''; }
    fcSetCards(fcGetCards().filter(c => c.id !== cardId));
    _fcRefresh();
    updateFcHeaderStats();

    showUndoToast(`Flashcard eliminada`, () => undoDeleteFlashcard(cardId, deletedCard));
  }
}

// ── CSS Styles ──────────────────────────────────────────────────────
const undoStyles = `
<style>
.undo-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #1a1f2e 0%, #111118 100%);
  border: 2px solid #7c6aff;
  border-radius: 16px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 0 0 4px rgba(124,106,255,0.3), 
              0 0 20px rgba(124,106,255,0.5),
              0 0 40px rgba(124,106,255,0.3);
  z-index: 9999;
  animation: undoSlideUp 0.4s cubic-bezier(0.16,1,0.3,1), undoPulse 2s infinite;
  min-width: 400px;
}

.undo-toast.hiding {
  animation: undoSlideDown 0.3s ease-in forwards;
}

@keyframes undoSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.9); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes undoSlideDown {
  from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  to   { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.9); }
}

@keyframes undoPulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(124,106,255,0.3), 
                0 0 20px rgba(124,106,255,0.5),
                0 0 40px rgba(124,106,255,0.3);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(124,106,255,0.6), 
                0 0 30px rgba(124,106,255,0.8),
                0 0 60px rgba(124,106,255,0.5);
  }
}

.undo-message {
  color: #e8e8f0;
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}

.undo-btn {
  background: linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(124,106,255,0.4);
  white-space: nowrap;
}

.undo-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124,106,255,0.6);
  background: linear-gradient(135deg, #b794f6 0%, #8b7aff 100%);
}

.undo-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(124,106,255,0.4);
}
</style>
`;

// Inject styles
if (!document.getElementById('undo-styles')) {
  const styleEl = document.createElement('div');
  styleEl.id = 'undo-styles';
  styleEl.innerHTML = undoStyles;
  document.head.appendChild(styleEl);
}

