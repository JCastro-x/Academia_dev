/* ═══════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS  v1.0
   ─ Atajos de teclado para acciones rápidas
   ═══════════════════════════════════════════════════════════ */

const SHORTCUTS = {
  // Navigation
  'Ctrl+KeyK': () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.focus();
  },
  'Meta+KeyK': () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.focus();
  },
  
  // Tasks
  'Ctrl+KeyN': () => {
    if (typeof openTaskModal === 'function') openTaskModal();
  },
  'Meta+KeyN': () => {
    if (typeof openTaskModal === 'function') openTaskModal();
  },
  
  // Save
  'Ctrl+KeyS': (e) => {
    e.preventDefault();
    if (typeof saveStateNow === 'function') saveStateNow();
  },
  'Meta+KeyS': (e) => {
    e.preventDefault();
    if (typeof saveStateNow === 'function') saveStateNow();
  },
  
  // Pages
  'Alt+KeyG': () => goPage('overview'),
  'Alt+KeyM': () => goPage('materias'),
  'Alt+KeyC': () => goPage('calificaciones'),
  'Alt+KeyT': () => goPage('tasks'),
  'Alt+KeyN': () => goPage('notas'),
  'Alt+KeyF': () => goPage('flashcards'),
  'Alt+KeyP': () => goPage('pomodoro'),
  
  // Pomodoro
  'Alt+Space': (e) => {
    e.preventDefault();
    if (typeof pomToggle === 'function') pomToggle();
  },
  'Alt+KeyR': (e) => {
    e.preventDefault();
    if (typeof pomReset === 'function') pomReset();
  },
  'Alt+KeyS': (e) => {
    e.preventDefault();
    if (typeof pomSkip === 'function') pomSkip();
  },
};

// ── Keyboard Event Listener ───────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    // Allow Ctrl+S in inputs for saving
    if (!(e.ctrlKey || e.metaKey) || e.key !== 's') {
      return;
    }
  }
  
  // Build shortcut key
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(e.code);
  
  const shortcut = parts.join('+');
  
  // Execute if exists
  if (SHORTCUTS[shortcut]) {
    SHORTCUTS[shortcut](e);
  }
});

// ── Show Shortcuts Help Modal ───────────────────────────────────────
function showShortcutsHelp() {
  const modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px;">
      <div class="modal-header">
        <span class="modal-title">⌨️ Atajos de Teclado</span>
        <button class="modal-close" onclick="document.getElementById('shortcuts-modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent);">Navegación</div>
            <div class="shortcut-item"><kbd>Ctrl+K</kbd> <span>Buscar</span></div>
            <div class="shortcut-item"><kbd>Alt+G</kbd> <span>Overview</span></div>
            <div class="shortcut-item"><kbd>Alt+M</kbd> <span>Materias</span></div>
            <div class="shortcut-item"><kbd>Alt+C</kbd> <span>Calificaciones</span></div>
            <div class="shortcut-item"><kbd>Alt+T</kbd> <span>Tareas</span></div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent);">Acciones</div>
            <div class="shortcut-item"><kbd>Ctrl+N</kbd> <span>Nueva tarea</span></div>
            <div class="shortcut-item"><kbd>Ctrl+S</kbd> <span>Guardar</span></div>
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent);margin-top:16px;">Pomodoro</div>
            <div class="shortcut-item"><kbd>Alt+Space</kbd> <span>Pausar/Reanudar</span></div>
            <div class="shortcut-item"><kbd>Alt+R</kbd> <span>Reiniciar</span></div>
            <div class="shortcut-item"><kbd>Alt+S</kbd> <span>Saltar</span></div>
          </div>
        </div>
        <div style="margin-top:20px;font-size:12px;color:var(--text3);">
          💡 Tip: En Mac usa <kbd>Cmd</kbd> en lugar de <kbd>Ctrl</kbd>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.classList.add('open');
}

// ── CSS Styles ──────────────────────────────────────────────────────
const shortcutsStyles = `
<style>
.shortcut-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.shortcut-item kbd {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  min-width: 80px;
  text-align: center;
}

.shortcut-item span {
  color: var(--text2);
}
</style>
`;

// Inject styles
if (!document.getElementById('shortcuts-styles')) {
  const styleEl = document.createElement('div');
  styleEl.id = 'shortcuts-styles';
  styleEl.innerHTML = shortcutsStyles;
  document.head.appendChild(styleEl);
}

