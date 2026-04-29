// ═══════════════════════════════════════════════════════════════
// FOCUS CORE — Modo Enfoque y sincronización con Pomodoro
// Pantalla de focus inmersivo integrada con timer Pomodoro
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// FOCUS MODE
// ═══════════════════════════════════════════════════════════════
function enterFocusMode() {
  const focusOverlay = document.createElement('div');
  focusOverlay.id = 'focus-mode-overlay';
  focusOverlay.className = 'focus-mode-container';

  // Lee estado real del Pomodoro
  const isRunning = typeof pomR !== 'undefined' && pomR;
  const isBreak = typeof pomB !== 'undefined' && pomB;
  const currentTime = document.getElementById('pom-time')?.textContent || '25:00';
  const mode = isBreak ? 'DESCANSO' : 'ENFOQUE';
  const modeColor = isBreak ? '#4ade80' : 'var(--accent2)';
  const btnLabel = isRunning ? '⏸ Pausar' : '▶ Iniciar';

  // Lee el nombre de la materia activa en Pomodoro
  const pomSubjSel = document.getElementById('pom-subject');
  const subjName = pomSubjSel?.options[pomSubjSel.selectedIndex]?.text || '';

  focusOverlay.innerHTML = `
    <button class="focus-exit-btn" onclick="exitFocusMode()">✕ Salir Focus</button>

    <div style="display:flex;flex-direction:column;align-items:center;gap:32px;">
      <div style="font-size:11px;font-family:'Space Mono',monospace;letter-spacing:3px;color:${modeColor};text-transform:uppercase;" id="focus-mode-label">${mode}</div>
      ${subjName ? `<div style="font-size:14px;color:var(--text2);font-weight:600;">${subjName}</div>` : ''}
      <div class="focus-timer" id="focus-timer">${currentTime}</div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
        <button id="focus-pom-btn"
          onclick="pomToggle(); _focusSyncBtn()"
          style="padding:12px 28px;font-size:15px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;min-width:140px;">
          ${btnLabel}
        </button>
        <button onclick="pomSkip(); _focusSyncBtn()"
          style="padding:12px 20px;font-size:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:10px;font-weight:700;cursor:pointer;">
          ⏭ Saltar
        </button>
        <button onclick="pomReset(); _focusSyncBtn()"
          style="padding:12px 20px;font-size:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:10px;font-weight:700;cursor:pointer;">
          ↻ Reset
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(focusOverlay);
  document.body.style.overflow = 'hidden';

  // Intervalo de SINCRONIZACIÓN — solo lee el estado real, no lo duplica
  window._focusSyncInterval = setInterval(() => {
    const timeEl = document.getElementById('focus-timer');
    const modeEl = document.getElementById('focus-mode-label');
    const btnEl = document.getElementById('focus-pom-btn');
    if (!timeEl) return;

    // Leer tiempo real del Pomodoro principal
    const realTime = document.getElementById('pom-time')?.textContent;
    if (realTime) timeEl.textContent = realTime;

    // Sincronizar modo y color
    const isB = typeof pomB !== 'undefined' && pomB;
    const isR = typeof pomR !== 'undefined' && pomR;
    if (modeEl) {
      modeEl.textContent = isB ? 'DESCANSO' : 'ENFOQUE';
      modeEl.style.color = isB ? '#4ade80' : 'var(--accent2)';
    }
    if (btnEl) {
      btnEl.textContent = isR ? '⏸ Pausar' : '▶ Iniciar';
    }
  }, 500);
  
  window.dispatchEvent(new CustomEvent('focus:entered'));
}

// Sincroniza el botón del focus tras una acción
function _focusSyncBtn() {
  setTimeout(() => {
    const btnEl = document.getElementById('focus-pom-btn');
    if (!btnEl) return;
    const isR = typeof pomR !== 'undefined' && pomR;
    btnEl.textContent = isR ? '⏸ Pausar' : '▶ Iniciar';
  }, 50);
}

function exitFocusMode() {
  // Detener sync
  if (window._focusSyncInterval) {
    clearInterval(window._focusSyncInterval);
    window._focusSyncInterval = null;
  }
  const overlay = document.getElementById('focus-mode-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = 'auto';
  window.dispatchEvent(new CustomEvent('focus:exited'));
}

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.enterFocusMode = enterFocusMode;
window._focusSyncBtn = _focusSyncBtn;
window.exitFocusMode = exitFocusMode;
