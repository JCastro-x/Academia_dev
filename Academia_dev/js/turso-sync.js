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
        user_id TEXT PRIMARY KEY,
        semestres TEXT,
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

    // Preflight: verificar si remoto es más reciente
    if (localUpdatedAt && typeof localUpdatedAt === 'number') {
      const remoteUpdatedAt = await getRemoteUpdatedAt();
      if (remoteUpdatedAt && remoteUpdatedAt <= localUpdatedAt) {
        console.log('⏭️ Turso.load: remoto no más nuevo que local (preflight), omitiendo descarga');
        return null;
      }
    }

    try {
      const { data, error } = await _tursoRequest(
        'SELECT semestres, settings, updated_at FROM user_data WHERE user_id = ?',
        [_userId]
      );

      if (error) {
        console.warn('⚠️ Turso.load error:', error);
        return null;
      }

      if (!data || data.length === 0) {
        console.log('📭 Turso.load: sin datos previos (usuario nuevo)');
        return null;
      }

      const row = data[0];
      
      // Parsear JSON desde TEXT
      let semestres = row.semestres ? JSON.parse(row.semestres) : [];
      let settings = row.settings ? JSON.parse(row.settings) : {};

      // Aplicar las mismas optimizaciones que academia-sync.js
      if (settings.pomData) {
        console.log('📉 Excluyendo pomData (snapshots, history) del sync para reducir egress');
        settings = {
          ...settings,
          pomData: {
            today: settings.pomData.today || [],
            date: settings.pomData.date,
            goal: settings.pomData.goal || 4,
            history: {},
            updatedAt: settings.pomData.updatedAt
          }
        };
      }

      if (options.exclude && options.exclude.includes('pomData') && settings.pomData) {
        settings = { ...settings, pomData: null };
      }

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
      console.log(`📥 Turso.load: datos cargados (${Math.round(dataSize/1024)} KB egress)`);

      return {
        semestres: optimizedSemestres,
        settings,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
      };
    } catch (err) {
      console.warn('⚠️ Turso.load excepción:', err.message);
      return null;
    }
  }

  // ── getRemoteUpdatedAt() ────────────────────────────────────────
  async function getRemoteUpdatedAt() {
    if (!_ready) return 0;
    try {
      const { data, error } = await _tursoRequest(
        'SELECT updated_at FROM user_data WHERE user_id = ?',
        [_userId]
      );

      if (error || !data || data.length === 0) return 0;
      const ts = new Date(data[0].updated_at).getTime();
      return Number.isFinite(ts) ? ts : 0;
    } catch {
      return 0;
    }
  }

  // ── _doSave(semestres, settings, changedFields) ────────────────
  async function _doSave(semestres, settings, changedFields = ['semestres', 'settings']) {
    if (!_ready) return;
    try {
      // Delta sync: construir payload solo con campos cambiados
      let payload = {};
      let dataToSend = _optimizeData(semestres, settings);

      if (changedFields.includes('semestres')) {
        payload.semestres = dataToSend.semestres || [];
      }
      if (changedFields.includes('settings')) {
        payload.settings = dataToSend.settings || {};
      }

      if (Object.keys(payload).length === 0) {
        console.log('⏭️ Turso.save: sin cambios para sincronizar');
        return;
      }

      const dataSize = JSON.stringify(payload).length;
      console.log(`☁️ Turso.save: subiendo ${Math.round(dataSize/1024)} KB (delta sync: ${changedFields.join(', ')})`);

      // UPSERT en SQLite
      const { error } = await _tursoRequest(
        `INSERT INTO user_data (user_id, semestres, settings, updated_at) 
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET 
           semestres = excluded.semestres,
           settings = excluded.settings,
           updated_at = datetime('now')`,
        [
          _userId,
          JSON.stringify(payload.semestres || []),
          JSON.stringify(payload.settings || {})
        ]
      );

      if (error) {
        console.warn('⚠️ Turso.save error:', error);
      } else {
        console.log(`✅ Turso.save: datos guardados (${Math.round(dataSize/1024)} KB egress)`);
      }
    } catch (err) {
      console.warn('⚠️ Turso.save excepción:', err.message);
    }
  }

  // ── _optimizeData(semestres, settings) ────────────────────────
  function _optimizeData(semestres, settings) {
    const optimizedSemestres = (semestres || []).map(sem => ({
      ...sem,
      notesArray: (sem.notesArray || []).map(note => ({
        ...note,
        content: note.content || '',
        canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
      }))
    }));

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

    return { semestres: optimizedSemestres, settings: optimizedSettings };
  }

  // ── save(semestres, settings, changedFields) — debounced 10000ms ──
  function save(semestres, settings, changedFields = ['semestres', 'settings']) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _doSave(semestres, settings, changedFields), 10000);
  }

  // ── saveNow(semestres, settings, changedFields) — inmediato ────────
  async function saveNow(semestres, settings, changedFields = ['semestres', 'settings']) {
    clearTimeout(_saveTimer);
    await _doSave(semestres, settings, changedFields);
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
