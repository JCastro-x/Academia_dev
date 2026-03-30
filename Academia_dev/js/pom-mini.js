// ═══════════════════════════════════════════════════════════════
// POM-MINI.JS — Abre automáticamente el PiP popup cuando el
// usuario navega fuera del pomodoro y el timer está corriendo.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function _pomIsRunning()    { return typeof pomR !== 'undefined' && pomR; }
  function _pomOnPomodorPage() {
    const p = document.getElementById('page-pomodoro');
    return p && p.classList.contains('active');
  }

  function _openPip() {
    if (typeof enterFloatingMode === 'function') enterFloatingMode();
  }

  // ── Hook en goPage ───────────────────────────────────────────
  function _hookGoPage() {
    if (typeof goPage !== 'function') return false;
    if (goPage._pmfHooked) return true;

    const _orig = goPage;
    window.goPage = function (id, el) {
      _orig.call(this, id, el);
      if (id !== 'pomodoro' && _pomIsRunning()) {
        // Pequeño delay para que el render de la nueva página termine
        setTimeout(_openPip, 120);
      }
    };
    window.goPage._pmfHooked = true;
    return true;
  }

  // ── Visibilitychange: abrir PiP al volver al tab fuera del pomodoro ──
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (_pomIsRunning() && !_pomOnPomodorPage()) {
      setTimeout(_openPip, 150);
    }
  });

  // ── Intentar hook (puede no estar disponible aún) ────────────
  function _tryHooks() {
    if (!_hookGoPage()) setTimeout(_tryHooks, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_tryHooks, 500));
  } else {
    setTimeout(_tryHooks, 500);
  }

})();
