/* ═══════════════════════════════════════════════════════════════
   ACADEMIA — animations-patch.js
   Incluir en app.html DESPUÉS de ui.js:
   <script src="js/animations-patch.js" defer></script>

   Hace dos cosas:
   1. Mantiene #ov-date-short actualizado (hora | Mié 22 de Abr)
   2. Fuerza reflow entre remove/add .active para que las
      animaciones CSS re-disparen al navegar entre páginas
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. Fecha corta junto al reloj ────────────────────────── */
  var DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  function _updateDateShort() {
    var el = document.getElementById('ov-date-short');
    if (!el) return;
    var d   = new Date();
    var day = DAYS[d.getDay()];
    var num = d.getDate();
    var mon = MONTHS[d.getMonth()];
    el.textContent = day + ' ' + num + ' ' + mon;
  }

  /* Lanzar inmediatamente y luego cada minuto */
  function _initDate() {
    _updateDateShort();
    setInterval(_updateDateShort, 60000);
  }

  /* Esperar a que el DOM esté listo */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDate);
  } else {
    _initDate();
  }


  /* ── 2. Reflow para re-disparar animaciones CSS ───────────── */
  /*
   * goPage() quita .active de todas las páginas y pone .active
   * en la nueva. Como sucede en el mismo frame sincrónico, el
   * browser puede batching y la animación no re-dispara.
   * Parcheamos goPage para insertar un reflow forzado.
   */
  function _patchGoPage() {
    if (typeof goPage !== 'function') return; // todavía no cargó

    var _origGoPage = goPage;

    window.goPage = function (id, el) {
      /* Quitar clase y forzar reflow antes de que el original la vuelva a poner */
      var pages = document.querySelectorAll('.page');
      pages.forEach(function (p) { p.classList.remove('active'); });

      /* Reflow: leer offsetWidth detiene el batching */
      var target = document.getElementById('page-' + id);
      if (target) { void target.offsetWidth; }

      /* Re-animar mano y sol en el overview */
      if (id === 'overview') {
        _replayOverviewAnimations();
      }

      /* Llamar al original (él volverá a quitar .active de todos
         y a poner en el target — el reflow ya garantizó el re-trigger) */
      _origGoPage.apply(this, arguments);
    };
  }

  function _replayOverviewAnimations() {
    ['ov-wave-hand', 'ov-clock-icon'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.animation = 'none';
      void el.offsetWidth;           // flush
      el.style.animation = '';
    });
  }

  /* Intentar parchear ahora; si goPage aún no existe, esperar */
  function _tryPatch() {
    if (typeof goPage === 'function') {
      _patchGoPage();
    } else {
      /* goPage se define después — reintentar al siguiente frame */
      requestAnimationFrame(_tryPatch);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _tryPatch);
  } else {
    _tryPatch();
  }

})();
