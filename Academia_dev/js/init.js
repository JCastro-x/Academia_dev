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
        console.error('❌ [INIT] Autenticación fallida - auth es null');
        const hasLocalData =
          !!localStorage.getItem('academia_v4_semestres') ||
          !!localStorage.getItem('academia_v3_settings');
        const hasKnownUser = !!localStorage.getItem('_academia_last_user');
        const isOffline = navigator.onLine === false;
        const canUseLocalAccess = hasLocalData && (isOffline || hasKnownUser);

        if (canUseLocalAccess) {
          console.warn('⚠️ Acceso local habilitado: no se pudo validar sesión remota, continuando con datos cacheados');
          const overlay = document.getElementById('auth-check-overlay');
          if (overlay) overlay.remove();
          continueInit(null);
          return;
        }

        redirectToAuthSafely('no-auth');
        return;
      }


      // Si el usuario cambió, limpiar datos del anterior
      const lastUser = localStorage.getItem('_academia_last_user');
      if (lastUser && lastUser !== auth.id) {
        localStorage.removeItem('academia_v4_semestres');
        localStorage.removeItem('academia_v3_settings');
      }
      localStorage.setItem('_academia_last_user', auth.id);

      // Inicializar DB y cargar desde Supabase/Turso
      const db = getAcademiaDB();
      if (db) {
        await db.init(auth.id);
        const dbData = await db.load();

        if (dbData) {

          // Comparar timestamps para evitar sobrescribir cambios locales recientes
          const remoteUpdatedAt = dbData.updatedAt ? Date.parse(dbData.updatedAt) : 0;
          const localModifiedAt = window._localModifiedAt || 0;
          const shouldUseRemote = remoteUpdatedAt > localModifiedAt;

          // Solo sobrescribir si remoto es más reciente Y tiene datos válidos
          if (shouldUseRemote) {
            // 🔥 GUARD: Verificar que datos remotos no estén vacíos/corruptos antes de sobrescribir
            const localSemestres = JSON.parse(localStorage.getItem('academia_v4_semestres') || '[]');
            const hasLocalData = localSemestres && localSemestres.length > 0 && localSemestres.some(s => s.materias && s.materias.length > 0);
            const hasRemoteData = dbData.semestres && dbData.semestres.length > 0 && dbData.semestres.some(s => s.materias && s.materias.length > 0);

            if (!hasRemoteData && hasLocalData) {
              console.warn('⚠️ [INIT] Datos remotos vacíos pero locales tienen datos - PRESERVANDO DATOS LOCALES');
              // No sobrescribir - mantener datos locales
            } else {
              // Turso/Supabase es la fuente de verdad
              if (dbData.semestres && dbData.semestres.length) {
                localStorage.setItem('academia_v4_semestres', JSON.stringify(dbData.semestres));
                State.semestres.length = 0;
                dbData.semestres.forEach(s => State.semestres.push(s));
                // 🔥 FIX: Solo forzar primer semestre como activo si realmente no hay ninguno activo
                // y no estamos sobrescribiendo un semestre activo válido del servidor
                if (!State.semestres.some(s => s.activo)) {
                  console.warn('⚠️ [INIT] No semestre activo found in remote data, forcing first as active');
                  State.semestres[0].activo = true;
                }
                getMat.bust();
              }
            }
            if (dbData.settings && Object.keys(dbData.settings).length) {
              // 🔥 FIX: Asegurar que habits siempre sea un array
              let habitsFixed = false;
              if (dbData.settings.habits && !Array.isArray(dbData.settings.habits)) {
                dbData.settings.habits = [];
                habitsFixed = true;
              }
              
              const mergedSettings = mergePomData(State.settings, dbData.settings);
              localStorage.setItem('academia_v3_settings', JSON.stringify(mergedSettings));
              // Usar deepMerge para preservar propiedades anidadas
              if (typeof window.deepMerge === 'function') {
                Object.assign(State.settings, window.deepMerge(State.settings, mergedSettings));
              } else {
                Object.assign(State.settings, mergedSettings);
              }
              
              // 🔥 FIX: Guardar datos corregidos en base de datos remota para evitar warning futuro
              if (habitsFixed) {
                try {
                  await db.save(State.semestres, State.settings, ['settings']);
                } catch (saveError) {
                  console.error('❌ [INIT] Error guardando datos corregidos:', saveError);
                }
              }
            }
          } else {
            // Local data is more recent, skip sync
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
            // NO cargar snapshots desde Supabase - son muy pesados y causan egress excesivo
            // Los snapshots se generan localmente y no necesitan sincronizarse
            if (pomData.snapshots && typeof pomData.snapshots === 'object') {
            }
          }
        } else {
          // Usuario nuevo — verificar si viene de modo invitado
          const guestSems     = localStorage.getItem('academia_v4_semestres');
          const guestSettings = localStorage.getItem('academia_v3_settings');
          const hadGuestData  = guestSems || guestSettings;

          if (hadGuestData) {
            await db.saveNow(
              guestSems     ? JSON.parse(guestSems)     : [],
              guestSettings ? JSON.parse(guestSettings) : {}
            );
            // Limpiar flag de invitado — ahora tiene cuenta real
            localStorage.removeItem('academia_guest_mode');
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
      const hasKnownUser = !!localStorage.getItem('_academia_last_user');
      const isOffline = navigator.onLine === false;
      const canUseLocalAccess = hasLocalData && (isOffline || hasKnownUser);
      // En caso de error, si es invitado igual dejamos pasar
      if (localStorage.getItem('academia_guest_mode') === '1') {
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();
        continueInit(null);
      } else if (canUseLocalAccess) {
        console.warn('⚠️ Acceso local por fallback de error de auth');
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

  // Inicialización TEMPRANA de fecha en topbar (disponible inmediatamente, no espera partials)
  (function initTopbarDate() {
    const now = new Date();
    const topbarDateEl = document.getElementById('topbar-date');
    if (topbarDateEl) {
      topbarDateEl.textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
    }
  })();

  // Inicialización de fecha/hora en overview se hace dentro de _onPartialsReady()
  // para asegurar que los elementos del DOM existan

  // Nombre del usuario (Google o "Invitado")
  if (auth && auth.name) {
    window._currentUserName = auth.name.split(' ')[0];
  } else {
    window._currentUserName = 'Invitado';
  }

  const ovGreetingEl = document.getElementById('ov-greeting');
  if (ovGreetingEl) ovGreetingEl.textContent = _getGreeting();
  document.documentElement.setAttribute('data-theme', State.settings.theme||'dark');

  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = State.settings.theme==='light' ? '🌙' : '☀️';

  _applyFont(State.settings.font || 'Syne');
  _applyAccentColor(State.settings.accentColor || '#7c6aff');

  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;

  // Data cleanup: Remove null entries from arrays
  if (State.materias && State.materias.some(m => !m)) {
    State.materias = State.materias.filter(m => m);
  }
  State.semestres.forEach(sem => {
    if (sem.materias && sem.materias.some(m => !m)) {
      sem.materias = sem.materias.filter(m => m);
    }
  });

  // Migration: Add apartados to existing subjects
  if (typeof window.migrateSubjectsToApartados === 'function') {
    window.migrateSubjectsToApartados();
  }

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

    // Inicializar fecha y hora (asegurar que elementos existan en DOM)
    const now = new Date();
    const topbarDateEl = document.getElementById('topbar-date');
    const ovDateEl = document.getElementById('ov-date');
    const ovDateShortEl = document.getElementById('ov-date-short');
    if (topbarDateEl) topbarDateEl.textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
    if (ovDateEl) ovDateEl.textContent = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();
    // ov-date-short es el elemento visible en el overview (formato corto: Lun 28 Abr)
    if (ovDateShortEl) {
      const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      ovDateShortEl.textContent = days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()];
    }

    // Inicializar reloj con actualización periódica
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
    // Solo crear el intervalo si no existe ya
    if (!window._ovClockInterval) {
      window._ovClockInterval = setInterval(_updateOvClock, 10000);
    }

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
    renderOverview(); renderMaterias(); updateBadge(); initCal();
    renderSemesterBadge();

    // Initialize Control Center
    if (typeof initControlCenter === 'function') {
      setTimeout(() => initControlCenter(), 100);
    }

    // Restore Zen Mode state if saved
    if (typeof restoreZenModeState === 'function') {
      setTimeout(() => restoreZenModeState(), 100);
    }

    // Navegar a la página inicial configurada (después de un pequeño delay)
    const defaultPage = State.settings.defaultHomePage || 'overview';
    if (defaultPage !== 'overview' && document.getElementById('page-' + defaultPage)) {
      setTimeout(() => {
        const navEl = document.querySelector(`.nav-item[onclick*="${defaultPage}"]`);
        if (typeof goPage === 'function') goPage(defaultPage, navEl);
      }, 100);
    }
    // Pomodoro functions now have guards - safe to call even if partial not loaded
    if (typeof loadPomSettings === 'function') loadPomSettings();
    if (typeof initPomSettingsListeners === 'function') initPomSettingsListeners();
    updatePomDots(); restorePomRunningState();

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

    // Sync al cargar la página (incluye restauración de pestañas)
    window.addEventListener('load', () => {
      setTimeout(() => _syncFromSupabase(true), 1000);
    });

    async function _syncFromSupabase(force = false) {
      const db = getAcademiaDB();
      if (!db || !db._ready) return;
      const now = Date.now();
      if (!force && now - _lastSync < 5000) return;

      // Si hay un guardado local pendiente, nunca hacer pull remoto todavía.
      if (!force && typeof _saveTimer !== 'undefined' && _saveTimer) {
        return;
      }

      const msSinceLocalMod = now - (window._localModifiedAt || 0);
      if (msSinceLocalMod < 30000) {
        return;
      }
      const localModifiedAt = window._localModifiedAt || 0;

      // Preflight inteligente: comparar hashes para evitar descargas innecesarias
      let remoteUpdatedAt = 0;
      let shouldDownload = true;
      
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
          _lastSync = now;
          return;
        }
        
        // Si timestamp indica cambios posibles, verificar con hash
        if (remoteUpdatedAt && remoteUpdatedAt > localModifiedAt) {
          if (typeof window.computeHash === 'function') {
            const localSemHash = await window.computeHash(State.semestres);
            const localSettingsHash = await window.computeHash(State.settings);
            
            // Descargar solo para comparar hashes remotos
            const dbData = await db.load();
            if (!dbData) return;
            
            const remoteSemHash = await window.computeHash(dbData.semestres);
            const remoteSettingsHash = await window.computeHash(dbData.settings);
            
            if (localSemHash === remoteSemHash && localSettingsHash === remoteSettingsHash) {
              _lastSync = now;
              return;
            }
            
            // Continuar con dbData ya cargado
            shouldDownload = false;
          }
        }
      }

      _lastSync = now;
      
      // Si ya descargamos en el preflight, usar dbData existente
      let dbData;
      if (!shouldDownload) {
        // dbData ya fue cargado en el preflight
        dbData = await db.load();
      } else {
        dbData = await db.load();
      }
      
      if (!dbData) return;

      remoteUpdatedAt = dbData.updatedAt ? Date.parse(dbData.updatedAt) : 0;
      if (remoteUpdatedAt) _lastRemoteUpdatedAt = remoteUpdatedAt;
      if (!force && remoteUpdatedAt && remoteUpdatedAt <= localModifiedAt) {
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
        if (Array.isArray(dbData.semestres)) {
          State.semestres.length = 0;
          dbData.semestres.forEach(s => State.semestres.push(s));
          // 🔥 FIX: Solo forzar primer semestre como activo si realmente no hay ninguno activo
          // y no estamos sobrescribiendo un semestre activo válido del servidor
          if (State.semestres.length && !State.semestres.some(s => s.activo)) {
            console.warn('⚠️ [SYNC] No semestre activo found in remote data, forcing first as active');
            State.semestres[0].activo = true;
          } else {
            const activeSem = State.semestres.find(s => s.activo);
          }
          getMat.bust();
        }
        if (dbData.settings && typeof dbData.settings === 'object') {
          // Usar deepMerge para preservar propiedades anidadas
          const mergedSettings = mergePomData(State.settings, dbData.settings);
          if (typeof window.deepMerge === 'function') {
            Object.assign(State.settings, window.deepMerge(State.settings, mergedSettings));
          } else {
            Object.assign(State.settings, mergedSettings);
          }
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
      // Deshabilitado sync al volver a la pestaña para reducir ancho de banda
      // if (document.visibilityState === 'visible') _syncFromSupabase();
    });
    window.addEventListener('pagehide', () => {
      if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
    });
    // Deshabilitado sync al enfocar la ventana para reducir ancho de banda
    // window.addEventListener('focus', () => _syncFromSupabase());

    // Sync periódico cada 6 horas (reducido de 1 hora para ahorrar ancho de banda)
    setInterval(() => {
      const canSync = (Date.now() - (window._localModifiedAt || 0)) > 30000;
      const db = getAcademiaDB();
      if (canSync && db && db._ready) {
        _lastSync = 0;
        _syncFromSupabase();
      }
    }, 21600000); // 6 horas en lugar de 1 hora (ahorro de ancho de banda)
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

  // ═══════════════════════════════════════════════════════════════
  // BACK BUTTON HANDLER (Android/History API)
  // ═══════════════════════════════════════════════════════════════
  let _backButtonExitTs = 0;
  const _EXIT_DOUBLE_TAP_MS = 2000;

  window.addEventListener('popstate', (event) => {
    // 1. Si hay un modal abierto, ciérralo
    const openModals = document.querySelectorAll('.modal-overlay.open, [id^="modal-"].open');
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.remove('open'));
      // Prevent default back navigation
      event.preventDefault?.();
      return;
    }

    // 2. Usar Navigation Stack para regresar jerárquicamente
    if (typeof goBack === 'function') {
      const stackState = typeof getNavStackState === 'function' ? getNavStackState() : null;
      const depth = stackState ? stackState.depth : 0;

      if (depth > 1) {
        // Hay historial en el stack, usar goBack()
        goBack();
        event.preventDefault?.();
        return;
      } else if (depth === 1 && window._currentPageId !== 'overview') {
        // Solo overview en stack pero no estamos en overview, ir a overview
        goPage('overview');
        event.preventDefault?.();
        return;
      }
    }

    // 3. Si ya está en Overview (o stack vacío), implementar "doble clic para salir"
    const now = Date.now();
    if (now - _backButtonExitTs < _EXIT_DOUBLE_TAP_MS) {
      // Segundo tap dentro del tiempo permitido - dejar que la app se cierre
      return;
    }
    // Primer tap - mostrar toast y prevenir cierre
    _backButtonExitTs = now;
    if (typeof showUndoToast === 'function') {
      showUndoToast('Presiona de nuevo para salir', null, 2000);
    } else {
      // Fallback si no existe showUndoToast
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:8px;z-index:99999;font-size:14px;';
      toast.textContent = 'Presiona de nuevo para salir';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
    // Prevent default back navigation
    event.preventDefault?.();
  });

  // Note: beforeunload handler removed to prevent refresh confirmation dialog
})();