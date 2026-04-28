/**
 * Client-side sync adapter for user academic data.
 *
 * Exposes `window.AcademiaDB` as the canonical sync API.
 * Legacy alias `window.DB` is kept for backward compatibility.
 * 
 * Data source strategy:
 * - Supabase: Used only for auth (Google Login)
 * - Turso: Used for heavy data (semestres, settings) - separated by user_id
 * - Fallback: Can use Supabase for data if Turso not configured
 */

(function () {
  'use strict';

  let _userId  = null;
  let _client  = null;
  let _ready   = false;
  let _saveTimer = null;
  let _useTurso = false; // Flag para usar Turso en lugar de Supabase

  // ── Obtener cliente Supabase (del módulo Auth) ──────────────
  function _getClient() {
    if (_client) return _client;
    if (window.Auth && typeof window.Auth.getClient === 'function') {
      _client = window.Auth.getClient();
    }
    return _client;
  }

  // ── Verificar si Turso está configurado ──────────────────────
  function _isTursoConfigured() {
    return !!(localStorage.getItem('turso_url') && localStorage.getItem('turso_auth_token'));
  }

  // ── init(userId) ────────────────────────────────────────────
  async function init(userId) {
    _userId = userId;
    _client = _getClient();
    
    // Detectar si usar Turso
    _useTurso = _isTursoConfigured();
    
    if (_useTurso) {
      // Usar Turso para datos
      if (window.TursoDB && typeof window.TursoDB.init === 'function') {
        await window.TursoDB.init(userId);
        _ready = window.TursoDB._ready;
        console.log('✅ window.DB usando Turso para usuario:', _userId);
      } else {
        console.warn('⚠️ Turso configurado pero turso-sync.js no cargado');
        _useTurso = false; // Fallback a Supabase
      }
    }
    
    // Fallback a Supabase si Turso no está configurado
    if (!_useTurso) {
      if (_client && _userId) {
        _ready = true;
        console.log('✅ window.DB usando Supabase para usuario:', _userId);
      } else {
        console.warn('⚠️ window.DB: cliente Supabase no disponible todavía');
      }
    }
  }

  // load(localUpdatedAt?, options?) -> { semestres, settings, updatedAt } | null
  // Si se proporciona localUpdatedAt, hace preflight check antes de descargar
  // options: { exclude: ['pomData', 'snapshots'] } para cargar solo datos esenciales
  async function load(localUpdatedAt, options = {}) {
    if (!_ready) return null;

    // Delegar a Turso si está configurado
    if (_useTurso && window.TursoDB) {
      return await window.TursoDB.load(localUpdatedAt, options);
    }

    // Fallback a Supabase
    // Preflight: si hay timestamp local, verificar si remoto es más reciente
    if (localUpdatedAt && typeof localUpdatedAt === 'number') {
      const remoteUpdatedAt = await getRemoteUpdatedAt();
      if (remoteUpdatedAt && remoteUpdatedAt <= localUpdatedAt) {
        console.log('⏭️ DB.load: remoto no más nuevo que local (preflight), omitiendo descarga');
        return null;
      }
    }

    try {
      // Select solo columnas necesarias
      let selectColumns = 'semestres, settings, updated_at';

      const { data, error } = await _getClient()
        .from('user_data')
        .select(selectColumns)
        .eq('user_id', _userId)
        .maybeSingle();           // null si no existe, sin error

      if (error) {
        console.warn('⚠️ DB.load error:', error.message);
        return null;
      }
      if (!data) {
        console.log('📭 DB.load: sin datos previos en Supabase (usuario nuevo)');
        return null;
      }

      // Filtrar datos excluidos si se especificaron
      let settings = data.settings || {};
      // Siempre excluir pomData snapshots y history por defecto para reducir ancho de banda
      if (settings.pomData) {
        console.log('📉 Excluyendo pomData (snapshots, history) del sync para reducir egress');
        settings = {
          ...settings,
          pomData: {
            today: settings.pomData.today || [],
            date: settings.pomData.date,
            goal: settings.pomData.goal || 4,
            history: {}, // Siempre vacío - no sync history
            updatedAt: settings.pomData.updatedAt
            // No sync snapshots (son muy pesados)
          }
        };
      }
      if (options.exclude && options.exclude.includes('pomData') && settings.pomData) {
        settings = { ...settings, pomData: null };
      }

      // Optimizar semestres: eliminar contenido de notas muy largas y datos innecesarios
      let optimizedSemestres = (data.semestres || []).map(sem => {
        const optimizedNotes = (sem.notesArray || []).map(note => ({
          ...note,
          // Truncar contenido muy largo para reducir egress
          content: note.content && note.content.length > 10000 
            ? note.content.substring(0, 10000) + '...[TRUNCADO]' 
            : (note.content || ''),
          // Mantener solo referencias IDB para canvas
          canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
        }));
        return { ...sem, notesArray: optimizedNotes };
      });

      // Log egress size
      const dataSize = JSON.stringify({ semestres: optimizedSemestres, settings }).length;
      console.log(`📥 DB.load: datos cargados desde Supabase (${Math.round(dataSize/1024)} KB egress)`);
      return {
        semestres: optimizedSemestres || [],
        settings:  settings,
        updatedAt: data.updated_at || null,
      };
    } catch (err) {
      console.warn('⚠️ DB.load excepción:', err.message);
      return null;
    }
  }

  // getRemoteUpdatedAt() -> number (ms since epoch) | 0
  // Cheap preflight to avoid downloading large JSONB when unchanged.
  async function getRemoteUpdatedAt() {
    if (!_ready) return 0;

    // Delegar a Turso si está configurado
    if (_useTurso && window.TursoDB) {
      return await window.TursoDB.getRemoteUpdatedAt();
    }

    // Fallback a Supabase
    try {
      const { data, error } = await _getClient()
        .from('user_data')
        .select('updated_at')
        .eq('user_id', _userId)
        .maybeSingle();

      if (error || !data || !data.updated_at) return 0;
      const ts = Date.parse(data.updated_at);
      return Number.isFinite(ts) ? ts : 0;
    } catch {
      return 0;
    }
  }

  // ── _doSave(semestres, settings, changedFields) ─────────────────
  async function _doSave(semestres, settings, changedFields = ['semestres', 'settings']) {
    if (!_ready) return;

    // Delegar a Turso si está configurado
    if (_useTurso && window.TursoDB) {
      return await window.TursoDB._doSave(semestres, settings, changedFields);
    }

    // Fallback a Supabase
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

      // Si no hay campos cambiados, no hacer nada
      if (Object.keys(payload).length === 0) {
        console.log('⏭️ DB.save: sin cambios para sincronizar');
        return;
      }

      // Log egress size
      const dataSize = JSON.stringify(payload).length;
      console.log(`☁️ DB.save: subiendo ${Math.round(dataSize/1024)} KB (delta sync: ${changedFields.join(', ')})`);

      const { error } = await _getClient()
        .from('user_data')
        .upsert(
          {
            user_id:    _userId,
            ...payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.warn('⚠️ DB.save error:', error.message);
      } else {
        console.log(`✅ DB.save: datos guardados en Supabase (${Math.round(dataSize/1024)} KB egress)`);
      }
    } catch (err) {
      console.warn('⚠️ DB.save excepción:', err.message);
    }
  }

  // ── _optimizeData(semestres, settings) ────────────────────────
  function _optimizeData(semestres, settings) {
    // Eliminar datos pesados que no necesitan sincronizarse
    const optimizedSemestres = (semestres || []).map(sem => ({
      ...sem,
      // Eliminar datos de IndexedDB que no deben sincronizarse
      notesArray: (sem.notesArray || []).map(note => ({
        ...note,
        // Las imágenes ya están en IndexedDB, no en el estado
        content: note.content || '',
        // No sincronizar canvasData (referencias IDB son suficientes)
        canvasData: note.canvasData?.startsWith('IDB:') ? note.canvasData : undefined
      }))
    }));

    // Eliminar datos de pomodoro de settings - AGRESIVO para reducir ancho de banda
    const optimizedSettings = { ...settings };
    if (optimizedSettings.pomData) {
      const pomSize = JSON.stringify(optimizedSettings.pomData).length;
      // Siempre optimizar pomodoro, no solo si es > 50KB
      const today = new Date().toDateString();
      const history = optimizedSettings.pomData.history || {};
      const recentHistory = {};

      // Solo guardar últimos 3 días de historial (reducido de 7 días)
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
        // NUNCA sincronizar snapshots (son muy pesados)
        updatedAt: optimizedSettings.pomData.updatedAt
      };
      console.log(`📉 Pomodoro optimizado: ${Math.round(pomSize/1024)} KB → ${Math.round(JSON.stringify(optimizedSettings.pomData).length/1024)} KB`);
    }

    return { semestres: optimizedSemestres, settings: optimizedSettings };
  }

  // ── save(semestres, settings, changedFields) — debounced 10000ms ────────────
  function save(semestres, settings, changedFields = ['semestres', 'settings']) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _doSave(semestres, settings, changedFields), 10000);
  }

  // ── saveNow(semestres, settings, changedFields) — inmediato ────────────────
  async function saveNow(semestres, settings, changedFields = ['semestres', 'settings']) {
    clearTimeout(_saveTimer);
    await _doSave(semestres, settings, changedFields);
  }

  const API = {
    init,
    load,
    getRemoteUpdatedAt,
    save,
    saveNow,
    get _ready() { return _ready; },
  };

  // Canonical name for personal data synchronization.
  Object.defineProperty(window, 'AcademiaDB', {
    get() { return API; },
    configurable: true,
  });

  // Backward-compatible alias used by older modules.
  Object.defineProperty(window, 'DB', {
    get() { return API; },
    configurable: true,
  });

  console.log('📦 academia-sync.js cargado (window.AcademiaDB / window.DB)');
})();
