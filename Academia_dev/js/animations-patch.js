/* ═══════════════════════════════════════════════════════════════
   ACADEMIA — animations-patch.js  v2
   Incluir en app.html DESPUÉS de todos los demás scripts:
   <script src="js/animations-patch.js" defer></script>
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  /* ── Calcula la fecha corta ─────────────────────────────────── */
  function _dateText() {
    var d = new Date();
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  /* ── Escribe la fecha en el elemento ────────────────────────── */
  function _setDate() {
    var el = document.getElementById('ov-date-short');
    if (!el) return;
    var val = _dateText();
    if (el.textContent !== val) el.textContent = val;
  }

  /* ── MutationObserver: re-escribe si _renderOverview pisa el texto ── */
  var _obs = null;
  function _watchDate() {
    var el = document.getElementById('ov-date-short');
    if (!el) return;
    if (_obs) _obs.disconnect();
    _obs = new MutationObserver(function () {
      var el2 = document.getElementById('ov-date-short');
      if (!el2) return;
      var val = _dateText();
      if (el2.textContent !== val) el2.textContent = val;
    });
    _obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ── Re-inicia el observer si el DOM cambia radicalmente ────── */
  var _pageObs = null;
  function _watchPage() {
    var page = document.getElementById('page-overview');
    if (!page) return;
    if (_pageObs) _pageObs.disconnect();
    _pageObs = new MutationObserver(function () {
      _setDate();
      _watchDate();
    });
    _pageObs.observe(page, { childList: true, subtree: false });
  }

  /* ── Resetea animaciones de la mano y el sol ─────────────────── */
  function _replayOverviewAnims() {
    ['ov-wave-hand', 'ov-clock-icon'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }

  /* ── Parchea goPage para forzar reflow entre páginas ─────────── */
  function _patchGoPage() {
    if (typeof goPage !== 'function') {
      requestAnimationFrame(_patchGoPage);
      return;
    }
    var _orig = goPage;
    window.goPage = function (id, el) {
      /* Quitar activas y forzar reflow antes de que el original las ponga */
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.remove('active');
      });
      var target = document.getElementById('page-' + id);
      if (target) void target.offsetWidth;

      if (id === 'overview') {
        /* Pequeño delay para que el DOM se estabilice antes de animar */
        setTimeout(_replayOverviewAnims, 40);
        setTimeout(function () { _setDate(); _watchDate(); }, 60);
      }

      _orig.apply(this, arguments);
    };
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function _init() {
    _setDate();
    _watchDate();
    _watchPage();
    setInterval(_setDate, 60000);
    _patchGoPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
