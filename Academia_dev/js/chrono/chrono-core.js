// ═══════════════════════════════════════════════════════════════
// CHRONO CORE — Lógica de Streaks y Cronómetro Inteligente
// Streak system, cálculos de tiempo, estado del cronómetro
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// STREAK SYSTEM
// ═══════════════════════════════════════════════════════════════
function _getStreakData() {
  return JSON.parse(localStorage.getItem('academia_streak') || '{"count":0,"lastDate":""}');
}

function _saveStreakData(d) { 
  localStorage.setItem('academia_streak', JSON.stringify(d)); 
}

function _updateStreak() {
  const today = new Date().toDateString();
  const sd = _getStreakData();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (sd.lastDate === today) return sd.count;
  if (sd.lastDate === yesterday) { sd.count++; } 
  else if (sd.lastDate !== today) { sd.count = 1; }
  sd.lastDate = today;
  _saveStreakData(sd);
  window.dispatchEvent(new CustomEvent('streak:updated', { detail: { count: sd.count, lastDate: sd.lastDate } }));
  return sd.count;
}

// ═══════════════════════════════════════════════════════════════
// CRONÓMETRO INTELIGENTE — Estado y Lógica
// ═══════════════════════════════════════════════════════════════
window.chronoR = false;         // cronómetro activo (total siempre corre)
window.chronoPhase = 'work';    // 'work' | 'break'
window.chronoPomLive = false;   // true solo cuando pomodoro está corriendo
window.chronoPomLinked = false; // true cuando vinculado al pom
window.chronoWorkSec = 0;
window.chronoBreakSec = 0;
window.chronoTotalSec = 0;      // tiempo real (no para con pausa)
window.chronoI = null;

function _chronoFmt(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function _chronoTickStart() {
  if (window.chronoI) clearInterval(window.chronoI);
  window.chronoI = setInterval(() => {
    if (!window.chronoR) return;
    window.chronoTotalSec++;
    if (window.chronoPomLinked) {
      if (window.chronoPomLive && window.chronoPhase === 'work') window.chronoWorkSec++;
      else if (window.chronoPomLive && window.chronoPhase === 'break') window.chronoBreakSec++;
    } else {
      if (window.chronoPhase === 'work') window.chronoWorkSec++;
      else window.chronoBreakSec++;
    }
    window.dispatchEvent(new CustomEvent('chrono:tick', { 
      detail: { 
        workSec: window.chronoWorkSec, 
        breakSec: window.chronoBreakSec, 
        totalSec: window.chronoTotalSec,
        phase: window.chronoPhase 
      } 
    }));
  }, 1000);
}

// Called from pomToggle when pom starts/pauses
function _chronoNotifyPomState(running, phase) {
  window.chronoPomLive = running;
  window.chronoPomLinked = true;
  if (phase) window.chronoPhase = phase;
  if (running && !window.chronoR) {
    window.chronoR = true;
    const badge = document.getElementById('chrono-mode-badge');
    const btn = document.getElementById('chrono-btn');
    if (badge) badge.textContent = 'POMODORO';
    if (btn) btn.textContent = '⏸ Pausar';
    if (!window.chronoI) _chronoTickStart();
  }
  window.dispatchEvent(new CustomEvent('chrono:pom-sync', { detail: { running, phase } }));
}

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window._getStreakData = _getStreakData;
window._saveStreakData = _saveStreakData;
window._updateStreak = _updateStreak;
window._chronoFmt = _chronoFmt;
window._chronoTickStart = _chronoTickStart;
window._chronoNotifyPomState = _chronoNotifyPomState;
