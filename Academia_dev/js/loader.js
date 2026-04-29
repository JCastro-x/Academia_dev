/**
 * loader.js — Academia
 * Carga los HTML partials con lazy loading para reducir egress.
 * - Critical partials (overview, modals, overlays) cargan al inicio
 * - Other pages cargan on-demand cuando el usuario navega
 *
 * ⚠️  Requiere servidor HTTP (no funciona con file://)
 *     En local: usa Live Server, Vite, o `npx serve .`
 */

(function () {

  // ── Critical partials: cargan al inicio ────────────────────────
  var CRITICAL_PARTIALS = [
    'overview',  // Página principal
    'modals',    // Modales necesarios
    'overlays'   // Overlays necesarios
  ];

  // ── Lazy-load partials: cargan on-demand ───────────────────────
  var LAZY_PARTIALS = [
    'semestres',
    'perfil',
    'materias',
    'tareas',
    'general',
    'calendario',
    'calificaciones',
    'temas',
    'estadisticas',
    'horario',
    'notas',
    'p-reloj',
    'p-reloj-pomodoro',
    'p-reloj-crono',
    'p-reloj-timer',
    'flashcards',
    'p-habits',
  ];

  var BASE = 'partials/';
  var loadedPartials = new Set();

  function fetchPartial(name) {
    return fetch(BASE + name + '.html')
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar partial: ' + name);
        return res.text();
      });
  }

  function injectPartial(name, html, isBody = false) {
    var target = isBody ? document.body : document.getElementById('pages-content');
    var wrapper = document.createElement('div');
    wrapper.setAttribute('data-partial', name);
    wrapper.innerHTML = html;
    while (wrapper.firstChild) {
      target.appendChild(wrapper.firstChild);
    }
    loadedPartials.add(name);
  }

  // Crear HTML del spinner de 4 puntitos
  function createSpinnerHTML(label) {
    return '<div class="spinner-container">' +
      '<div class="spinner-dot"></div>' +
      '<div class="spinner-dot"></div>' +
      '<div class="spinner-dot"></div>' +
      '<div class="spinner-dot"></div>' +
    '</div>' +
    (label ? '<div class="spinner-label">' + label + '</div>' : '');
  }

  function loadCriticalPartials() {
    var content = document.getElementById('pages-content');
    var allFetches = CRITICAL_PARTIALS.map(fetchPartial);

    // Actualizar spinner con nuevo diseño
    var spinner = document.getElementById('partials-loading');
    if (spinner) {
      spinner.innerHTML = createSpinnerHTML('Cargando aplicación...');
      spinner.className = 'global-spinner';
    }

    Promise.all(allFetches)
      .then(function (htmls) {
        // Quitar spinner de carga
        if (spinner) spinner.remove();

        // Inyectar overview en .content
        injectPartial('overview', htmls[0]);

        // Inyectar modales y overlays al body
        injectPartial('modals', htmls[1], true);
        injectPartial('overlays', htmls[2], true);

        // Disparar evento para que bootstrap.js sepa que el DOM está listo
        document.dispatchEvent(new Event('partials-loaded'));
      })
      .catch(function (err) {
        console.error('❌ Error cargando partials críticos:', err);
        if (spinner) {
          spinner.innerHTML =
            '<div style="font-size:32px;margin-bottom:8px;">❌</div>' +
            '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:#f87171;text-align:center;">' +
            'Error cargando la app.<br>¿Estás usando un servidor HTTP?<br>' +
            '<span style="opacity:.6">' + err.message + '</span>' +
            '</div>';
        }
      });
  }

  // Función pública para cargar partials on-demand
  window.loadPartial = function(name) {
    if (loadedPartials.has(name)) {
      return Promise.resolve();
    }
    if (!LAZY_PARTIALS.includes(name) && !CRITICAL_PARTIALS.includes(name)) {
      console.warn('⚠️ Partial no reconocido:', name);
      return Promise.reject(new Error('Partial no reconocido'));
    }

    return fetchPartial(name).then(function(html) {
      injectPartial(name, html, name === 'modals' || name === 'overlays');
      // Disparar evento para que la página se inicialice
      document.dispatchEvent(new CustomEvent('partial-loaded', { detail: { name: name } }));
    });
  };

  // Arrancar tan pronto el DOM base esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCriticalPartials);
  } else {
    loadCriticalPartials();
  }

})();
