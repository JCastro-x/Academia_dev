const mergePomData = (localSettings = {}, remoteSettings = {}) => {
  const localPom = localSettings?.pomData;
  const remotePom = remoteSettings?.pomData;
  if (!localPom && !remotePom) return { ...remoteSettings };
  if (!localPom) return { ...remoteSettings };
  if (!remotePom) return { ...remoteSettings, pomData: localPom };
  const localAt = Number(localPom.updatedAt || 0);
  const remoteAt = Number(remotePom.updatedAt || 0);
  return {
    ...remoteSettings,
    pomData: localAt >= remoteAt ? localPom : remotePom,
  };
};

function init() {
  const getAcademiaDB = () => window.AcademiaDB || window.DB;
  const AUTH_REDIRECT_GUARD_KEY = 'academia_auth_redirect_ts';

  function redirectToAuthSafely(reason = 'unknown') {
    const now = Date.now();
    const lastTs = Number(sessionStorage.getItem(AUTH_REDIRECT_GUARD_KEY) || 0);
    const inLoopWindow = now - lastTs < 8000;

    if (inLoopWindow) {
      console.warn('⚠️ Auth redirect loop evitado:', reason);
      const overlay = document.getElementById('auth-check-overlay');
      if (overlay) {
        overlay.innerHTML = `
          <div style="max-width:420px;text-align:center;padding:0 18px;">
            <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
            <div style="color:#e8e8f0;font-size:14px;font-family:Syne,sans-serif;line-height:1.6;margin-bottom:14px;">
              No se pudo validar la sesión en este intento.<br>
              Evitamos una recarga infinita para que puedas recuperar acceso.
            </div>
            <button id="auth-recover-btn" style="padding:9px 14px;border-radius:8px;border:1px solid #7c6aff;background:#7c6aff;color:#fff;font-family:Syne,sans-serif;font-weight:700;cursor:pointer;">
              Ir al login
            </button>
          </div>
        `;
        const btn = document.getElementById('auth-recover-btn');
        if (btn) btn.addEventListener('click', () => { window.location.href = 'auth-page.html'; }, { once: true });
      }
      return;
    }

    sessionStorage.setItem(AUTH_REDIRECT_GUARD_KEY, String(now));
    window.location.href = 'auth-page.html';
  }

  // ── Detectar modo invitado ────────────────────────────────────
  const isGuest = localStorage.getItem('academia_guest_mode') === '1';

  // Overlay de loading
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'auth-check-overlay';
  loadingOverlay.style.cssText = `
    position:fixed;inset:0;background:#0a0a0f;
    display:flex;align-items:center;justify-content:center;z-index:9999;
  `;
  loadingOverlay.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">${isGuest ? '👀' : '🔐'}</div>
      <div style="color:#e8e8f0;font-size:14px;font-family:Syne,sans-serif;">
        ${isGuest ? 'Cargando modo invitado...' : 'Verificando sesión...'}
      </div>
    </div>
  `;
  document.body.insertBefore(loadingOverlay, document.body.firstChild);

  (async () => {
    let auth = null;
    try {

      // ════════════════════════════════════════════════════════
      // MODO INVITADO — saltar Supabase completamente
      // ════════════════════════════════════════════════════════
      if (isGuest) {
        console.log('👀 Modo invitado activo — usando solo localStorage');

        // Quitar overlay y continuar sin auth
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();

        continueInit(null); // auth = null en modo invitado
        return;
      }

      // ════════════════════════════════════════════════════════
      // MODO NORMAL — verificar autenticación con Supabase
      // ════════════════════════════════════════════════════════
      const hasOAuthCallback = window.location.hash.includes('access_token') ||
                               window.location.search.includes('code=');

      auth = await window.Auth.checkAuth();

      if (!auth && hasOAuthCallback) {
        // Evita race condition del callback OAuth sin depender de un solo timeout fijo
        for (let i = 0; i < 6 && !auth; i++) {
          await new Promise(r => setTimeout(r, 400));
          auth = await window.Auth.checkAuth();
        }
      }

      if (!auth) {
        const hasLocalData =
          !!localStorage.getItem('academia_v4_semestres') ||
          !!localStorage.getItem('academia_v3_settings');
        const isOffline = navigator.onLine === false;

        if (isOffline && hasLocalData) {
          console.warn('⚠️ Modo offline: continuando con datos locales cacheados');
          const overlay = document.getElementById('auth-check-overlay');
          if (overlay) overlay.remove();
          continueInit(null);
          return;
        }

        console.log('❌ NO AUTENTICADO - Redirigiendo a login');
        redirectToAuthSafely('no-auth');
        return;
      }

      console.log('✅ AUTENTICADO:', auth.email);

      // Si el usuario cambió, limpiar datos del anterior
      const lastUser = localStorage.getItem('_academia_last_user');
      if (lastUser && lastUser !== auth.id) {
        console.log('🔄 Usuario diferente, limpiando datos anteriores...');
        localStorage.removeItem('academia_v4_semestres');
        localStorage.removeItem('academia_v3_settings');
      }
      localStorage.setItem('_academia_last_user', auth.id);

      // Inicializar DB y cargar desde Supabase
      const db = getAcademiaDB();
      if (db) {
        db.init(auth.id);
        const dbData = await db.load();
        if (dbData) {
          // Supabase es la fuente de verdad
          if (dbData.semestres && dbData.semestres.length) {
            localStorage.setItem('academia_v4_semestres', JSON.stringify(dbData.semestres));
            State.semestres.length = 0;
            dbData.semestres.forEach(s => State.semestres.push(s));
            if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
            getMat.bust();
          }
          if (dbData.settings && Object.keys(dbData.settings).length) {
            const mergedSettings = mergePomData(State.settings, dbData.settings);
            localStorage.setItem('academia_v3_settings', JSON.stringify(mergedSettings));
            Object.assign(State.settings, mergedSettings);
          }
          if (dbData.settings?.pomData && typeof dbData.settings.pomData === 'object') {
            const pomData = dbData.settings.pomData;
            if (pomData.date === new Date().toDateString() && Array.isArray(pomData.today)) {
              State.pomSessions = pomData.today;
              localStorage.setItem('academia_v3_pom_today', JSON.stringify(pomData.today));
              localStorage.setItem('academia_v3_pom_date', pomData.date);
            }
            if (pomData.history && typeof pomData.history === 'object') {
              State.pomHistory = pomData.history;
              localStorage.setItem('academia_v3_pom_history', JSON.stringify(pomData.history));
            }
            if (pomData.snapshots && typeof pomData.snapshots === 'object') {
              State.pomSnapshots = pomData.snapshots;
              localStorage.setItem('academia_v3_pom_daily_snapshots', JSON.stringify(pomData.snapshots));
            }
          }
          console.log('✅ Datos sincronizados desde Supabase');
        } else {
          // Usuario nuevo — verificar si viene de modo invitado
          const guestSems     = localStorage.getItem('academia_v4_semestres');
          const guestSettings = localStorage.getItem('academia_v3_settings');
          const hadGuestData  = guestSems || guestSettings;

          if (hadGuestData) {
            console.log('📤 Migrando datos de invitado a Supabase...');
            await db.saveNow(
              guestSems     ? JSON.parse(guestSems)     : [],
              guestSettings ? JSON.parse(guestSettings) : {}
            );
            // Limpiar flag de invitado — ahora tiene cuenta real
            localStorage.removeItem('academia_guest_mode');
            console.log('✅ Datos de invitado migrados a la cuenta');
          }
        }
      }

      const overlay = document.getElementById('auth-check-overlay');
      if (overlay) overlay.remove();

      continueInit(auth);

    } catch (err) {
      console.error('❌ Error verificando auth:', err);
      if (auth && auth.id) {
        // Si la sesión ya era válida, no forzar logout por errores de render/UI.
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();
        try {
          continueInit(auth);
        } catch (uiErr) {
          console.error('❌ Error iniciando UI con sesión válida:', uiErr);
        }
        return;
      }
      const hasLocalData =
        !!localStorage.getItem('academia_v4_semestres') ||
        !!localStorage.getItem('academia_v3_settings');
      const isOffline = navigator.onLine === false;
      // En caso de error, si es invitado igual dejamos pasar
      if (localStorage.getItem('academia_guest_mode') === '1') {
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();
        continueInit(null);
      } else if (isOffline && hasLocalData) {
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();
        continueInit(null);
      } else {
        redirectToAuthSafely('auth-error');
      }
    }
  })();
}

function continueInit(auth) {

  const now = new Date();
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('ov-date').textContent     = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();

  function _updateOvClock() {
    const d = new Date();
    let h = d.getHours(); const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    let icon = '☀️';
    if      (h >= 5 && h < 7)   icon = '🌅';
    else if (h >= 7 && h < 18)  icon = '☀️';
    else if (h >= 18 && h < 20) icon = '🌆';
    else if (h >= 20 || h < 5)  icon = '🌙';
    h = h % 12 || 12;
    const hStr = String(h).padStart(2,'0');
    const mStr = String(m).padStart(2,'0');
    const clk  = document.getElementById('ov-clock');
    const amp  = document.getElementById('ov-clock-ampm');
    const icn  = document.getElementById('ov-clock-icon');
    if (clk) clk.textContent = `${hStr}:${mStr}`;
    if (amp) amp.textContent = ampm;
    if (icn) icn.textContent = icon;
  }
  _updateOvClock();
  setInterval(_updateOvClock, 10000);

  // Nombre del usuario (Google o "Invitado")
  if (auth && auth.name) {
    window._currentUserName = auth.name.split(' ')[0];
  } else {
    window._currentUserName = 'Invitado';
  }

  document.getElementById('ov-greeting').textContent = _getGreeting();
  document.documentElement.setAttribute('data-theme', State.settings.theme||'dark');

  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = State.settings.theme==='light' ? '🌙' : '☀️';

  _applyFont(State.settings.font || 'Syne');
  _applyAccentColor(State.settings.accentColor || '#7c6aff');

  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;

  // Perfil
  const isGuest = localStorage.getItem('academia_guest_mode') === '1';
  if (!State.settings.profile || !State.settings.profile.name) {
    const googleName = auth?.name || auth?.email?.split('@')[0] || (isGuest ? 'Invitado' : '');
    State.settings.profile = {
      name: googleName,
      carrera: '', registro: '', facultad: '', totalCredCarrera: 215
    };
    State.settings.approvedCourses = [];
    saveState(['settings']);
  }

  // ── Función que se ejecuta cuando los partials ya están en el DOM ──
  function _onPartialsReady() {
    const firstName = (State.settings.profile?.name || window._currentUserName || '').split(' ')[0];
    const gHour = new Date().getHours();
    const greet = gHour < 12 ? 'Buenos días' : gHour < 19 ? 'Buenas tardes' : 'Buenas noches';

    // Greeting con nombre real
    const grEl = document.getElementById('ov-greeting');
    if (grEl) grEl.textContent = `${greet}, ${firstName || 'estudiante'} ${isGuest ? '👀' : ''}`;

    // Fecha en topbar y overview (los elementos ya existen)
    const now2 = new Date();
    const dateEl = document.getElementById('ov-date');
    if (dateEl) dateEl.textContent = now2.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();

    const minGradeEl = document.getElementById('min-grade');
    if (minGradeEl) {
      minGradeEl.value = State.settings.minGrade;
      minGradeEl.addEventListener('input', () => {
        State.settings.minGrade = parseFloat(minGradeEl.value)||70;
        saveState(['settings']);
      });
    }

    ['cfg-prev-avg','cfg-prev-cred'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _updateConfigPreview);
    });

    fillMatSels(); fillPomSel(); fillTopicMatSel(); fillNotesSel(); fillExamSel();
    renderOverview(); renderMaterias(); updateBadge(); updatePomDots(); pomReset(); restorePomRunningState(); initCal();
    renderSemesterBadge();

    document.querySelectorAll('.modal-overlay').forEach(o =>
      o.addEventListener('click', e => { if (e.target===o) o.classList.remove('open'); })
    );
  }

  // Si los partials ya están → render inmediato; si no → esperar el evento
  if (document.getElementById('page-overview')) {
    _onPartialsReady();
  } else {
    document.addEventListener('partials-loaded', _onPartialsReady, { once: true });
  }

  document.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-canvas');
    if (modal?.classList.contains('open')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoCanvas(); }
      if (e.key === 'Escape') { closeModal('modal-canvas'); }
    }
  });

  document.addEventListener('click', e => {
    const sr = _el('search-results');
    const sg = document.getElementById('global-search');
    if (sr && sg && !sr.contains(e.target) && e.target !== sg) sr.style.display='none';
    const p  = document.getElementById('comp-popup');
    if (p && p.style.display==='block' && !p.contains(e.target)) closeCompPopup();
    const dd = document.getElementById('sem-sw-dd');
    const sb = document.querySelector('.sidebar-bottom');
    if (dd && dd.classList.contains('open') && sb && !sb.contains(e.target)) dd.classList.remove('open');
  });

  // Auto-sync desde Supabase (deshabilitado en modo invitado)
  if (!isGuest && getAcademiaDB()) {
    let _lastSync = Date.now();
    let _lastRemoteUpdatedAt = 0;
    let _lastRemoteCheckAt = 0;

    async function _syncFromSupabase(force = false) {
      const db = getAcademiaDB();
      if (!db || !db._ready) return;
      const now = Date.now();
      if (!force && now - _lastSync < 5000) return;

      // Si hay un guardado local pendiente, nunca hacer pull remoto todavía.
      if (!force && typeof _saveTimer !== 'undefined' && _saveTimer) {
        console.log('⏭️ Sync omitido: guardado local pendiente');
        return;
      }

      const msSinceLocalMod = now - (window._localModifiedAt || 0);
      if (msSinceLocalMod < 30000) {
        console.log('⏭️ Sync omitido: cambios locales recientes (' + Math.round(msSinceLocalMod/1000) + 's)');
        return;
      }
      const localModifiedAt = window._localModifiedAt || 0;

      // Preflight barato: si no hay cambios remotos, evitar descargar JSONB.
      // Fallback: si el método no existe, seguimos con load() como antes.
      let remoteUpdatedAt = 0;
      if (!force && typeof db.getRemoteUpdatedAt === 'function') {
        // Throttle del preflight para evitar martillar en focus/visibility repetidos
        if (now - _lastRemoteCheckAt > 10000) {
          _lastRemoteCheckAt = now;
          remoteUpdatedAt = await db.getRemoteUpdatedAt();
          if (remoteUpdatedAt) _lastRemoteUpdatedAt = remoteUpdatedAt;
        } else {
          remoteUpdatedAt = _lastRemoteUpdatedAt;
        }

        if (remoteUpdatedAt && remoteUpdatedAt <= localModifiedAt) {
          console.log('⏭️ Sync omitido: remoto no más nuevo que local (preflight)');
          _lastSync = now;
          return;
        }
      }

      _lastSync = now;
      const dbData = await db.load();
      if (!dbData) return;

      remoteUpdatedAt = dbData.updatedAt ? Date.parse(dbData.updatedAt) : 0;
      if (remoteUpdatedAt) _lastRemoteUpdatedAt = remoteUpdatedAt;
      if (!force && remoteUpdatedAt && remoteUpdatedAt <= localModifiedAt) {
        console.log('⏭️ Sync omitido: datos locales son mas recientes o iguales al servidor');
        return;
      }

      let changed = false;
      if (Array.isArray(dbData.semestres)) {
        const localJson = localStorage.getItem('academia_v4_semestres');
        const dbJson = JSON.stringify(dbData.semestres);
        if (localJson !== dbJson) { localStorage.setItem('academia_v4_semestres', dbJson); changed = true; }
      }
      if (dbData.settings && typeof dbData.settings === 'object') {
        const mergedSettings = mergePomData(State.settings, dbData.settings);
        const localJson = localStorage.getItem('academia_v3_settings');
        const dbJson = JSON.stringify(mergedSettings);
        if (localJson !== dbJson) { localStorage.setItem('academia_v3_settings', dbJson); changed = true; }
      }
      if (changed) {
        console.log('🔄 Datos actualizados desde Supabase — recargando UI...');
        if (Array.isArray(dbData.semestres)) {
          State.semestres.length = 0;
          dbData.semestres.forEach(s => State.semestres.push(s));
          if (State.semestres.length && !State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
          getMat.bust();
        }
        if (dbData.settings && typeof dbData.settings === 'object') {
          Object.assign(State.settings, mergePomData(State.settings, dbData.settings));
        }
        try {
          renderOverview     && renderOverview();
          renderMaterias     && renderMaterias();
          renderTasks        && renderTasks();
          renderCalendar     && renderCalendar();
          renderGrades       && renderGrades();
          updateGPADisplay   && updateGPADisplay();
          renderSemestresList && renderSemestresList();
          fillMatSels        && fillMatSels();
          const _fcPage = document.getElementById('page-flashcards');
          if (_fcPage && _fcPage.classList.contains('active')) {
            renderFlashcards && renderFlashcards();
          }
        } catch(e) { console.warn('Sync re-render error', e); }
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
      }
      if (document.visibilityState === 'visible') _syncFromSupabase();
    });
    window.addEventListener('pagehide', () => {
      if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
    });
    window.addEventListener('focus', () => _syncFromSupabase());

    setInterval(() => {
      const canSync = (Date.now() - (window._localModifiedAt || 0)) > 30000;
      const db = getAcademiaDB();
      if (canSync && db && db._ready) {
        _lastSync = 0;
        _syncFromSupabase();
      }
    }, 300000); // 5 minutos en lugar de 90s
  }

  _maybeShowOnboarding();
  initNotifications();

} // FIN continueInit()


/* Typewriter greeting effect for #ov-greeting.
   It observes text updates and animates the final greeting string. */

(function () {
  'use strict';

  /**
   * Typewriter en un elemento dado.
   * @param {HTMLElement} el    - Elemento a animar
   * @param {string}      text  - Texto final a escribir
   * @param {number}      speed - ms por carácter (default 38)
   */
  function typewrite(el, text, speed = 38) {
    // Limpiar contenido anterior
    el.textContent = '';
    el.classList.remove('tw-done');

    // Cursor
    const cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    el.appendChild(cursor);

    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        // Insertar el carácter ANTES del cursor
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
      } else {
        clearInterval(interval);
        // Remover cursor después de 2 s
        setTimeout(() => {
          cursor.remove();
          el.classList.add('tw-done');
        }, 2000);
      }
    }, speed);
  }

  /**
   * Observa #ov-greeting y ejecuta el efecto en cuanto
   * el texto cambia a algo no vacío.
   * Funciona tanto si init.js ya corrió como si corre después.
   */
  function watchGreeting() {
    const grEl = document.getElementById('ov-greeting');
    if (!grEl) {
      // El elemento aún no existe en el DOM — reintentar
      setTimeout(watchGreeting, 150);
      return;
    }

    let lastText = '';

    const applyTw = () => {
      const raw = grEl.textContent.trim();
      // Ignorar si ya está vacío o es el mismo texto
      if (!raw || raw === lastText) return;
      lastText = raw;
      typewrite(grEl, raw, 36);
    };

    // Si ya tiene texto al montar
    if (grEl.textContent.trim()) {
      applyTw();
    }

    // Observar cambios futuros (init.js puede setear el texto después)
    const obs = new MutationObserver(() => {
      // Solo re-animar si el contenido cambió y NO hay cursor activo
      if (!grEl.querySelector('.tw-cursor')) {
        applyTw();
      }
    });

    obs.observe(grEl, { childList: true, subtree: true, characterData: true });
  }

  // Arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchGreeting);
  } else {
    watchGreeting();
  }
})();