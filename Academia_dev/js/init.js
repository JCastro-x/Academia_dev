
function init() {

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

      let auth = await window.Auth.checkAuth();

      if (!auth && hasOAuthCallback) {
        await new Promise(r => setTimeout(r, 1500));
        auth = await window.Auth.checkAuth();
      }

      if (!auth) {
        console.log('❌ NO AUTENTICADO - Redirigiendo a login');
        window.location.href = 'auth-page.html';
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
      if (window.DB) {
        window.DB.init(auth.id);
        const dbData = await window.DB.load();
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
            localStorage.setItem('academia_v3_settings', JSON.stringify(dbData.settings));
            Object.assign(State.settings, dbData.settings);
          }
          console.log('✅ Datos sincronizados desde Supabase');
        } else {
          // Usuario nuevo — verificar si viene de modo invitado
          const guestSems     = localStorage.getItem('academia_v4_semestres');
          const guestSettings = localStorage.getItem('academia_v3_settings');
          const hadGuestData  = guestSems || guestSettings;

          if (hadGuestData) {
            console.log('📤 Migrando datos de invitado a Supabase...');
            await window.DB.saveNow(
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
      // En caso de error, si es invitado igual dejamos pasar
      if (localStorage.getItem('academia_guest_mode') === '1') {
        const overlay = document.getElementById('auth-check-overlay');
        if (overlay) overlay.remove();
        continueInit(null);
      } else {
        window.location.href = 'auth-page.html';
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
    if (grEl) grEl.textContent = `${greet}, ${firstName || 'estudiante'} ${isGuest ? '👀' : '👋'}`;

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
    renderOverview(); renderMaterias(); updateBadge(); updatePomDots(); pomReset(); initCal();
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

  // ── Auto-sync — solo si NO es invitado ────────────────────────
  if (!isGuest && window.DB) {
    let _lastSync = Date.now();

    async function _syncFromSupabase(force = false) {
      if (!window.DB || !window.DB._ready) return;
      const now = Date.now();
      if (!force && now - _lastSync < 5000) return;
      const msSinceLocalMod = now - (window._localModifiedAt || 0);
      if (msSinceLocalMod < 30000) {
        console.log('⏭️ Sync omitido: cambios locales recientes (' + Math.round(msSinceLocalMod/1000) + 's)');
        return;
      }
      _lastSync = now;
      const dbData = await window.DB.load();
      if (!dbData) return;
      let changed = false;
      if (dbData.semestres && dbData.semestres.length) {
        const localJson = localStorage.getItem('academia_v4_semestres');
        const dbJson = JSON.stringify(dbData.semestres);
        if (localJson !== dbJson) { localStorage.setItem('academia_v4_semestres', dbJson); changed = true; }
      }
      if (dbData.settings && Object.keys(dbData.settings).length) {
        const localJson = localStorage.getItem('academia_v3_settings');
        const dbJson = JSON.stringify(dbData.settings);
        if (localJson !== dbJson) { localStorage.setItem('academia_v3_settings', dbJson); changed = true; }
      }
      if (changed) {
        console.log('🔄 Datos actualizados desde Supabase — recargando UI...');
        if (dbData.semestres && dbData.semestres.length) {
          State.semestres.length = 0;
          dbData.semestres.forEach(s => State.semestres.push(s));
          if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
          getMat.bust();
        }
        if (dbData.settings && Object.keys(dbData.settings).length) {
          Object.assign(State.settings, dbData.settings);
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
      if (canSync && window.DB && window.DB._ready) {
        _lastSync = 0;
        _syncFromSupabase();
      }
    }, 90000);
  }

  _maybeShowOnboarding();
  initNotifications();

} // FIN continueInit()
