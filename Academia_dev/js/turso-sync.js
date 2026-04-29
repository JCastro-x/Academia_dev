/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * TURSO-SYNC.JS — Sync adapter for Turso (SQLite edge database)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Reemplaza Supabase para datos pesados (semestres, settings)
 * Supabase se usa solo para auth (Google Login)
 * 
 * Datos separados por user_id para multi-tenancy
 */

(function () {
  'use strict';

  let _userId = null;
  let _client = null;
  let _ready = false;
  let _saveTimer = null;

  // Configuración de Turso (debe configurarse en variables de entorno)
  // Convertir libsql:// a https:// para el cliente HTTP
  let TURSO_URL = localStorage.getItem('turso_url') || '';
  if (TURSO_URL.startsWith('libsql://')) {
    TURSO_URL = TURSO_URL.replace('libsql://', 'https://');
  }
  const TURSO_AUTH_TOKEN = localStorage.getItem('turso_auth_token') || '';

  // ── Cliente HTTP para Turso ───────────────────────────────────
  async function _tursoRequest(sql, params = []) {
    if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
      console.warn('⚠️ Turso no configurado: falta turso_url o turso_auth_token en localStorage');
      return { error: 'Turso no configurado' };
    }

    try {
      const response = await fetch(`${TURSO_URL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statements: [{
            q: sql,
            params: params.map(p => ({ type: 'text', value: String(p) }))
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.warn('⚠️ Turso error:', data.error);
        return { error: data.error };
      }

      return { data: data.results?.[0]?.rows || [] };
    } catch (err) {
      console.warn('⚠️ Turso request error:', err.message);
      return { error: err.message };
    }
  }

  // ── Inicializar tabla si no existe ────────────────────────────
  async function _ensureTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT,
        semester_id TEXT,
        data TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, semester_id)
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        settings TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `;
    await _tursoRequest(createTableSQL);
  }

  // ── init(userId) ───────────────────────────────────────────────
  async function init(userId) {
    _userId = userId;
    
    if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
      console.warn('⚠️ Turso-sync: configuración faltante. Setea turso_url y turso_auth_token en localStorage');
      return;
    }

    await _ensureTable();
    _ready = true;
    console.log('✅ Turso-sync listo para usuario:', _userId);
  }

  // ── load(localUpdatedAt?, options?) ────────────────────────────
  async function load(localUpdatedAt, options = {}) {
    if (!_ready) return null;

    const semesterId = options.semesterId || null;

    // Preflight: verificar si remoto es más reciente
    if (localUpdatedAt && typeof localUpdatedAt === 'number') {
      const remoteUpdatedAt = await getRemoteUpdatedAt(semesterId);
      if (remoteUpdatedAt && remoteUpdatedAt <= localUpdatedAt) {
        console.log('⏭️ Turso.load: remoto no más nuevo que local (preflight), omitiendo descarga');
        return null;
      }
    }

    try {
      // Cargar settings globales
      const { data: settingsData, error: settingsError } = await _tursoRequest(
        'SELECT settings, updated_at FROM user_settings WHERE user_id = ?',
        [_userId]
      );

      let settings = {};
      let settingsUpdatedAt = null;

      if (!settingsError && settingsData && settingsData.length > 0) {
        settings = settingsData[0].settings ? JSON.parse(settingsData[0].settings) : {};
        settingsUpdatedAt = settingsData[0].updated_at ? new Date(settingsData[0].updated_at).getTime() : null;
      }

      // Si no se especifica semesterId, cargar todos los semestres
      if (!semesterId) {
        const { data, error } = await _tursoRequest(
          'SELECT semester_id, data, updated_at FROM user_data WHERE user_id = ?',
          [_userId]
        );

        if (error) {
          console.warn('⚠️ Turso.load error:', error);
          return null;
        }

        if (!data || data.length === 0) {
          console.log('📭 Turso.load: sin datos previos (usuario nuevo)');
          return { settings, semestres: [], updatedAt: settingsUpdatedAt };
        }

        // Reconstruir array de semestres desde filas individuales
        let semestres = data.map(row => {
          const semesterData = row.data ? JSON.parse(row.data) : {};
          return {
            ...semesterData,
            _syncUpdatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null
          };
        });

        // Optimizar semestres
        let optimizedSemestres = semestres.map(sem => {
          const optimizedNotes = (sem.notesArray || []).map(note => ({
            ...note,
            content: note.content && note.content.length > 10000 
              ? note.content.substring(0, 10000) + '...[TRUNCADO]' 
              : (note.content || ''),
            canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
          }));
          return { ...sem, notesArray: optimizedNotes };
        });

        const dataSize = JSON.stringify({ semestres: optimizedSemestres, settings }).length;
        console.log(`📥 Turso.load: todos los semestres cargados (${Math.round(dataSize/1024)} KB egress)`);

        return {
          semestres: optimizedSemestres,
          settings,
          updatedAt: settingsUpdatedAt,
        };
      }

      // Cargar solo un semestre específico
      const { data, error } = await _tursoRequest(
        'SELECT data, updated_at FROM user_data WHERE user_id = ? AND semester_id = ?',
        [_userId, semesterId]
      );

      if (error) {
        console.warn('⚠️ Turso.load error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log(`📭 Turso.load: sin datos para semestre ${semesterId}`);
        return { settings, semester: null, updatedAt: settingsUpdatedAt };
      }

      const row = data[0];
      let semester = row.data ? JSON.parse(row.data) : {};

      // Optimizar notas del semestre
      if (semester.notesArray) {
        semester.notesArray = semester.notesArray.map(note => ({
          ...note,
          content: note.content && note.content.length > 10000 
            ? note.content.substring(0, 10000) + '...[TRUNCADO]' 
            : (note.content || ''),
          canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
        }));
      }

      const dataSize = JSON.stringify({ semester, settings }).length;
      console.log(`📥 Turso.load: semestre ${semesterId} cargado (${Math.round(dataSize/1024)} KB egress)`);

      return {
        semester,
        settings,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
      };
    } catch (err) {
      console.warn('⚠️ Turso.load excepción:', err.message);
      return null;
    }
  }

  // ── getRemoteUpdatedAt(semesterId?) ────────────────────────────────
  async function getRemoteUpdatedAt(semesterId = null) {
    if (!_ready) return 0;
    try {
      if (semesterId) {
        const { data, error } = await _tursoRequest(
          'SELECT updated_at FROM user_data WHERE user_id = ? AND semester_id = ?',
          [_userId, semesterId]
        );
        if (error || !data || data.length === 0) return 0;
        const ts = new Date(data[0].updated_at).getTime();
        return Number.isFinite(ts) ? ts : 0;
      } else {
        // Para settings globales
        const { data, error } = await _tursoRequest(
          'SELECT updated_at FROM user_settings WHERE user_id = ?',
          [_userId]
        );
        if (error || !data || data.length === 0) return 0;
        const ts = new Date(data[0].updated_at).getTime();
        return Number.isFinite(ts) ? ts : 0;
      }
    } catch {
      return 0;
    }
  }

  // ── _doSave(semestres, settings, changedFields, semesterId?) ────────────────
  async function _doSave(semestres, settings, changedFields = ['semestres', 'settings'], semesterId = null) {
    if (!_ready) return;
    try {
      // Guardar settings globales si cambiaron
      if (changedFields.includes('settings')) {
        const optimizedSettings = _optimizeSettings(settings);
        const settingsSize = JSON.stringify(optimizedSettings).length;
        console.log(`☁️ Turso.save: guardando settings (${Math.round(settingsSize/1024)} KB)`);
        
        const { error: settingsError } = await _tursoRequest(
          `INSERT INTO user_settings (user_id, settings, updated_at) 
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(user_id) DO UPDATE SET 
             settings = excluded.settings,
             updated_at = datetime('now')`,
          [_userId, JSON.stringify(optimizedSettings)]
        );

        if (settingsError) {
          console.warn('⚠️ Turso.save settings error:', settingsError);
        }
      }

      // Guardar semestres individualmente si cambiaron
      if (changedFields.includes('semestres')) {
        if (semesterId) {
          // Guardar solo un semestre específico
          const semester = (semestres || []).find(s => s.id === semesterId);
          if (semester) {
            const optimizedSemester = _optimizeSemester(semester);
            const dataSize = JSON.stringify(optimizedSemester).length;
            console.log(`☁️ Turso.save: guardando semestre ${semesterId} (${Math.round(dataSize/1024)} KB)`);
            
            const { error } = await _tursoRequest(
              `INSERT INTO user_data (user_id, semester_id, data, updated_at) 
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, semester_id) DO UPDATE SET 
                 data = excluded.data,
                 updated_at = datetime('now')`,
              [_userId, semesterId, JSON.stringify(optimizedSemester)]
            );

            if (error) {
              console.warn('⚠️ Turso.save semester error:', error);
            }
          }
        } else {
          // Guardar todos los semestres
          const totalSize = JSON.stringify(semestres).length;
          console.log(`☁️ Turso.save: guardando todos los semestres (${Math.round(totalSize/1024)} KB)`);
          
          for (const semester of (semestres || [])) {
            const optimizedSemester = _optimizeSemester(semester);
            const { error } = await _tursoRequest(
              `INSERT INTO user_data (user_id, semester_id, data, updated_at) 
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, semester_id) DO UPDATE SET 
                 data = excluded.data,
                 updated_at = datetime('now')`,
              [_userId, semester.id, JSON.stringify(optimizedSemester)]
            );

            if (error) {
              console.warn(`⚠️ Turso.save semester ${semester.id} error:`, error);
            }
          }
        }
      }

      console.log('✅ Turso.save: sincronización completada');
    } catch (err) {
      console.warn('⚠️ Turso.save excepción:', err.message);
    }
  }

  // ── _optimizeSemester(semester) ────────────────────────
  function _optimizeSemester(semester) {
    const optimizedNotes = (semester.notesArray || []).map(note => ({
      ...note,
      content: note.content || '',
      canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
    }));
    return { ...semester, notesArray: optimizedNotes };
  }

  // ── _optimizeSettings(settings) ────────────────────────
  function _optimizeSettings(settings) {
    const optimizedSettings = { ...settings };
    if (optimizedSettings.pomData) {
      const pomSize = JSON.stringify(optimizedSettings.pomData).length;
      const today = new Date().toDateString();
      const history = optimizedSettings.pomData.history || {};
      const recentHistory = {};

      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      Object.keys(history).forEach(date => {
        const dateTs = new Date(date).getTime();
        if (dateTs >= threeDaysAgo || date === today) {
          recentHistory[date] = history[date];
        }
      });

      optimizedSettings.pomData = {
        today: optimizedSettings.pomData.today || [],
        date: today,
        goal: optimizedSettings.pomData.goal || 4,
        history: recentHistory,
        updatedAt: optimizedSettings.pomData.updatedAt
      };
      console.log(`📉 Pomodoro optimizado: ${Math.round(pomSize/1024)} KB → ${Math.round(JSON.stringify(optimizedSettings.pomData).length/1024)} KB`);
    }
    return optimizedSettings;
  }

  // ── _optimizeData(semestres, settings) ────────────────────────
  function _optimizeData(semestres, settings) {
    const optimizedSemestres = (semestres || []).map(sem => _optimizeSemester(sem));
    const optimizedSettings = _optimizeSettings(settings);
    return { semestres: optimizedSemestres, settings: optimizedSettings };
  }

  // ── save(semestres, settings, changedFields, semesterId?) — debounced 10000ms ──
  function save(semestres, settings, changedFields = ['semestres', 'settings'], semesterId = null) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _doSave(semestres, settings, changedFields, semesterId), 10000);
  }

  // ── saveNow(semestres, settings, changedFields, semesterId?) — inmediato ────────
  async function saveNow(semestres, settings, changedFields = ['semestres', 'settings'], semesterId = null) {
    clearTimeout(_saveTimer);
    await _doSave(semestres, settings, changedFields, semesterId);
  }

  // ── Configurar Turso (para llamar desde UI o setup) ───────────────
  function configure(url, authToken) {
    localStorage.setItem('turso_url', url);
    localStorage.setItem('turso_auth_token', authToken);
    console.log('✅ Turso configurado. Recarga la página para aplicar.');
  }

  // ── Limpiar datos del usuario ────────────────────────────────────
  async function clearUserData() {
    if (!_ready) return;
    try {
      const { error } = await _tursoRequest(
        'DELETE FROM user_data WHERE user_id = ?',
        [_userId]
      );
      if (error) {
        console.warn('⚠️ Turso.clearUserData error:', error);
      } else {
        console.log('✅ Turso.clearUserData: datos eliminados');
      }
    } catch (err) {
      console.warn('⚠️ Turso.clearUserData excepción:', err.message);
    }
  }

  const API = {
    init,
    load,
    getRemoteUpdatedAt,
    save,
    saveNow,
    _doSave, // Exponer para que academia-sync.js pueda llamarlo
    configure,
    clearUserData,
    get _ready() { return _ready; },
  };

  // Exponer como TursoDB
  Object.defineProperty(window, 'TursoDB', {
    get() { return API; },
    configurable: true,
  });

  console.log('📦 turso-sync.js cargado (window.TursoDB)');
})();
