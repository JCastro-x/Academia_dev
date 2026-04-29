// ═══════════════════════════════════════════════════════════════
// FLASHCARDS CORE — Lógica SRS y Persistencia
// Algoritmo de repetición espaciada y estado de estudio
// ═══════════════════════════════════════════════════════════════

// Estado del modo estudio
window._studyDeck = [];
window._studyIdx = 0;
window._studyFlipped = false;

// ═══════════════════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════════════════
function _getFlashcards() {
  return JSON.parse(localStorage.getItem('academia_flashcards') || '[]');
}

function _saveFlashcards(arr) { 
  localStorage.setItem('academia_flashcards', JSON.stringify(arr)); 
}

// ═══════════════════════════════════════════════════════════════
// ALGORITMO SRS (SPACED REPETITION)
// ═══════════════════════════════════════════════════════════════
function _rateCard(score) {
  // score: 2=easy, 1=medium, 0=hard
  const c = window._studyDeck[window._studyIdx];
  if (!c) return;
  
  const cards = _getFlashcards();
  const idx = cards.findIndex(x => x.id === c.id);
  if (idx >= 0) {
    const card = cards[idx];
    // Update score
    card.score = Math.max(0, Math.min(2, (card.score || 0) + (score === 2 ? 1 : score === 1 ? 0 : -1)));
    card.lastStudied = Date.now();
    
    // Spaced repetition: calculate nextReview
    const now = Date.now();
    let intervalDays;
    if (score === 2) {
      const prev = card.intervalDays || 1;
      intervalDays = Math.round(prev * 2.5);
    } else if (score === 1) {
      intervalDays = card.intervalDays || 1;
    } else {
      intervalDays = 1;
    }
    intervalDays = Math.max(1, Math.min(intervalDays, 90));
    card.intervalDays = intervalDays;
    card.nextReview = now + intervalDays * 86400000;
    _saveFlashcards(cards);
    
    window.dispatchEvent(new CustomEvent('flashcard:reviewed', { 
      detail: { 
        id: card.id, 
        score, 
        nextReview: card.nextReview,
        intervalDays 
      } 
    }));
  }
  
  window._studyIdx++;
  if (typeof _uiClick === 'function') {
    if (score === 2) _uiClick('save'); 
    else _uiClick('click');
  }
}

// Calcular estadísticas del deck
function _calculateDeckStats() {
  const cards = _getFlashcards();
  const now = Date.now();
  return {
    total: cards.length,
    mastered: cards.filter(c => c.score >= 2).length,
    practicing: cards.filter(c => c.score === 1).length,
    new: cards.filter(c => !c.score).length,
    overdue: cards.filter(c => c.nextReview && c.nextReview <= now).length,
    forReviewToday: cards.filter(c => c.nextReview && c.nextReview <= now + 86400000).length
  };
}

// Obtener próxima tarjeta a estudiar según prioridad SRS
function _getNextStudyCard() {
  const cards = _getFlashcards();
  if (!cards.length) return null;
  
  const now = Date.now();
  const sorted = [...cards].sort((a, b) => {
    const aOverdue = a.nextReview && a.nextReview <= now ? 0 : 1;
    const bOverdue = b.nextReview && b.nextReview <= now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (a.score || 0) - (b.score || 0);
  });
  
  return sorted[0];
}

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window._getFlashcards = _getFlashcards;
window._saveFlashcards = _saveFlashcards;
window._rateCard = _rateCard;
window._calculateDeckStats = _calculateDeckStats;
window._getNextStudyCard = _getNextStudyCard;
