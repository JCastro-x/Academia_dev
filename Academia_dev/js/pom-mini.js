// Opens PiP automatically when leaving Pomodoro while running.
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

  let _isHookRegistered = false;
  function _hookGoPage() {
    if (_isHookRegistered) return true;
    if (typeof onGoPage !== 'function') return false;
    onGoPage((id) => {
      if (id !== 'pomodoro' && _pomIsRunning()) {
        // Small delay so the destination page finishes rendering first.
        setTimeout(_openPip, 120);
      }
    });
    _isHookRegistered = true;
    return true;
  }

  // ── Visibilitychange: abrir PiP al volver al tab fuera del pomodoro ──
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (_pomIsRunning() && !_pomOnPomodorPage()) {
      setTimeout(_openPip, 150);
    }
  });

  // Retry until navigation hook API becomes available.
  function _tryHooks() {
    if (!_hookGoPage()) setTimeout(_tryHooks, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(_tryHooks, 500));
  } else {
    setTimeout(_tryHooks, 500);
  }

})();
