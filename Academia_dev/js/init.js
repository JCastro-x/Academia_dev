
function init() {
  // ════════════════════════════════════════════════════════
  // VERIFICACIÓN DE AUTENTICACIÓN — BLOQUEAR SI NO ESTÁ AUTENTICADO
  // ════════════════════════════════════════════════════════
  
  // Crear overlay de loading mientras se verifica
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'auth-check-overlay';
  loadingOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: #0a0a0f;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  loadingOverlay.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
      <div style="color: #e8e8f0; font-size: 14px; font-family: Syne, sans-serif;">Verificando sesión...</div>
    </div>
  `;
  document.body.insertBefore(loadingOverlay, document.body.firstChild);

  // Verificar auth ANTES de hacer nada
  (async () => {
    try {
      // Si hay callback de OAuth en la URL, dar tiempo a Supabase para procesarlo
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
        return; // STOP aquí, no continuar
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
          // Sobrescribir localStorage con datos de Supabase (fuente de verdad)
          if (dbData.semestres && dbData.semestres.length) {
            localStorage.setItem('academia_v4_semestres', JSON.stringify(dbData.semestres));
            // FIX: también actualizar State en memoria (fue cargado ANTES de este fetch)
            State.semestres.length = 0;
            dbData.semestres.forEach(s => State.semestres.push(s));
            if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
            getMat.bust();
          }
          if (dbData.settings && Object.keys(dbData.settings).length) {
            localStorage.setItem('academia_v3_settings', JSON.stringify(dbData.settings));
            // FIX: también actualizar State.settings en memoria
            Object.assign(State.settings, dbData.settings);
          }
          console.log('✅ Datos sincronizados desde Supabase');
        } else {
          // Usuario nuevo — migrar localStorage a Supabase
          const localSems = localStorage.getItem('academia_v4_semestres');
          const localSettings = localStorage.getItem('academia_v3_settings');
          if (localSems || localSettings) {
            console.log('📤 Migrando datos locales a Supabase...');
            await window.DB.saveNow(
              localSems ? JSON.parse(localSems) : [],
              localSettings ? JSON.parse(localSettings) : {}
            );
          }
        }
      }

      // Quitar overlay de loading
      const overlay = document.getElementById('auth-check-overlay');
      if (overlay) overlay.remove();
      
      // CONTINUAR CON INIT NORMAL
      continueInit(auth);
      
    } catch (err) {
      console.error('❌ Error verificando auth:', err);
      window.location.href = 'auth-page.html';
    }
  })();
}

function continueInit(auth) {
  // ════════════════════════════════════════════════════════
  // INIT NORMAL (solo si está autenticado)
  // ════════════════════════════════════════════════════════
  
  const now = new Date();
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('ov-date').textContent     = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();
  // Start live clock (12hr format, top-right of overview)
  function _updateOvClock() {
    const d = new Date();
    let h = d.getHours(); const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    // Sun/moon/stars icon based on time
    let icon = '☀️'; // default day
    if (h >= 5 && h < 7)   icon = '🌅'; // dawn
    else if (h >= 7 && h < 18)  icon = '☀️'; // day
    else if (h >= 18 && h < 20) icon = '🌆'; // dusk
    else if (h >= 20 || h < 5)  icon = '🌙'; // night
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
  const h = now.getHours();
  
  // Obtener nombre real del usuario autenticado (Google)
  if (auth && auth.name) {
    window._currentUserName = auth.name.split(' ')[0]; // Primer nombre
  }

  
  document.getElementById('ov-greeting').textContent = _getGreeting();

  document.documentElement.setAttribute('data-theme', State.settings.theme||'dark');
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = State.settings.theme==='light' ? '🌙' : '☀️';

  // Apply saved font
  _applyFont(State.settings.font || 'Syne');
  // Apply saved accent color
  _applyAccentColor(State.settings.accentColor || '#7c6aff');

  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;

  // ── Perfil: usar datos del usuario de Google ──────────────────
  if (!State.settings.profile || !State.settings.profile.name) {
    const googleName = auth?.name || auth?.email?.split('@')[0] || '';
    State.settings.profile = {
      name: googleName,
      carrera: '',
      registro: '',
      facultad: '',
      totalCredCarrera: 215
    };
    State.settings.approvedCourses = [];
    saveState(['settings']);
  }
  // Update greeting with real name
  const firstName = (State.settings.profile?.name || '').split(' ')[0];
  if (firstName) {
    const grEl = document.getElementById('ov-greeting');
    if (grEl) {
      const gHour = new Date().getHours();
      const greet = gHour < 12 ? 'Buenos días' : gHour < 19 ? 'Buenas tardes' : 'Buenas noches';
      grEl.textContent = `${greet}, ${firstName} 👋`;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  fillMatSels(); fillPomSel(); fillTopicMatSel(); fillNotesSel(); fillExamSel();
  renderOverview(); renderMaterias(); updateBadge(); updatePomDots(); pomReset(); initCal();
  renderSemesterBadge();

  ['cfg-prev-avg','cfg-prev-cred'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateConfigPreview);
  });

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

  mgEl?.addEventListener('input', () => {
    State.settings.minGrade = parseFloat(mgEl.value)||70;
    saveState(['settings']);
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target===o) o.classList.remove('open'); })
  );

  // ── Auto-sync cuando el usuario vuelve a la pestaña o app ──────
  let _lastSync = Date.now();
  async function _syncFromSupabase() {
    if (!window.DB || !window.DB._ready) return;
    const now = Date.now();
    if (now - _lastSync < 5000) return; // no sync si fue hace menos de 5s
    _lastSync = now;
    const dbData = await window.DB.load();
    if (!dbData) return;
    let changed = false;
    if (dbData.semestres && dbData.semestres.length) {
      const localJson = localStorage.getItem('academia_v4_semestres');
      const dbJson = JSON.stringify(dbData.semestres);
      if (localJson !== dbJson) {
        localStorage.setItem('academia_v4_semestres', dbJson);
        changed = true;
      }
    }
    if (dbData.settings && Object.keys(dbData.settings).length) {
      const localJson = localStorage.getItem('academia_v3_settings');
      const dbJson = JSON.stringify(dbData.settings);
      if (localJson !== dbJson) {
        localStorage.setItem('academia_v3_settings', dbJson);
        changed = true;
      }
    }
    if (changed) {
      console.log('🔄 Datos actualizados desde Supabase — recargando UI...');
      // FIX: actualizar State directo desde dbData (no re-parsear localStorage)
      if (dbData.semestres && dbData.semestres.length) {
        State.semestres.length = 0;
        dbData.semestres.forEach(s => State.semestres.push(s));
        if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
        getMat.bust();
      }
      if (dbData.settings && Object.keys(dbData.settings).length) {
        Object.assign(State.settings, dbData.settings);
      }
      // FIX: re-renderizar TODO (antes faltaban materias, grades, GPA)
      try {
        renderOverview     && renderOverview();
        renderMaterias     && renderMaterias();
        renderTasks        && renderTasks();
        renderCalendar     && renderCalendar();
        renderGrades       && renderGrades();
        updateGPADisplay   && updateGPADisplay();
        renderSemestresList && renderSemestresList();
        fillMatSels        && fillMatSels();
      } catch(e) { console.warn('Sync re-render error', e); }
    }
  }

  // Sync al volver al tab/app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // FIX: flush save pendiente ANTES de que la página se oculte/cierre
      if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
    }
    if (document.visibilityState === 'visible') _syncFromSupabase();
  });
  window.addEventListener('pagehide', () => {
    // Último recurso: flush sincrónico antes de cerrar
    if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
  });
  window.addEventListener('focus', () => _syncFromSupabase());

  // Mostrar onboarding si es primera vez
  _maybeShowOnboarding();

  // Inicializar recordatorios / banners
  initNotifications();

} // FIN continueInit()
