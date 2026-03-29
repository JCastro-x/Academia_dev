/**
 * loader.js — Academia
 * Carga los HTML partials de forma paralela e inyecta el DOM
 * antes de que el resto de scripts inicialice la app.
 *
 * ⚠️  Requiere servidor HTTP (no funciona con file://)
 *     En local: usa Live Server, Vite, o `npx serve .`
 */

(function () {

  // ── Páginas: van dentro de .content ──────────────────────────
  var PAGE_PARTIALS = [
    'overview',
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
    'pomodoro',
    'flashcards',
  ];

  // ── Overlays/Modales: van directo al <body> ───────────────────
  var BODY_PARTIALS = [
    'modals',
    'overlays',
  ];

  var BASE = 'partials/';

  function fetchPartial(name) {
    return fetch(BASE + name + '.html')
      .then(function (res) {
        if (!res.ok) throw new Error('No se pudo cargar partial: ' + name);
        return res.text();
      });
  }

  function injectAll() {
    var content = document.getElementById('pages-content');

    var allNames   = PAGE_PARTIALS.concat(BODY_PARTIALS);
    var allFetches = allNames.map(fetchPartial);

    Promise.all(allFetches)
      .then(function (htmls) {

        // Quitar spinner de carga
        var spinner = document.getElementById('partials-loading');
        if (spinner) spinner.remove();

        // Inyectar páginas en .content
        PAGE_PARTIALS.forEach(function (name, i) {
          var wrapper = document.createElement('div');
          wrapper.setAttribute('data-partial', name);
          wrapper.innerHTML = htmls[i];
          // Insertar el primer hijo directamente (el div.page)
          while (wrapper.firstChild) {
            content.appendChild(wrapper.firstChild);
          }
        });

        // Inyectar modales/overlays al final del body
        var bodyOffset = PAGE_PARTIALS.length;
        BODY_PARTIALS.forEach(function (name, i) {
          var wrapper = document.createElement('div');
          wrapper.setAttribute('data-partial', name);
          wrapper.innerHTML = htmls[bodyOffset + i];
          while (wrapper.firstChild) {
            document.body.appendChild(wrapper.firstChild);
          }
        });

        // Disparar evento para que bootstrap.js sepa que el DOM está listo
        document.dispatchEvent(new Event('partials-loaded'));
        console.log('✅ Academia — todos los partials cargados');
      })
      .catch(function (err) {
        console.error('❌ Error cargando partials:', err);
        var spinner = document.getElementById('partials-loading');
        if (spinner) {
          spinner.innerHTML =
            '<div style="font-size:20px;">❌</div>' +
            '<div style="font-family:\'Space Mono\',monospace;font-size:11px;color:#f87171;">' +
            'Error cargando la app. ¿Estás usando un servidor HTTP?<br>' +
            '<span style="opacity:.6">' + err.message + '</span>' +
            '</div>';
        }
      });
  }

  // Arrancar tan pronto el DOM base esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAll);
  } else {
    injectAll();
  }

})();
