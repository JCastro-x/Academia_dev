/**
 * Client-side sync adapter for user academic data.
 *
 * Exposes `window.AcademiaDB` as the canonical sync API.
 * Legacy alias `window.DB` is kept for backward compatibility.
 * Data source: Supabase table `user_data` keyed by `user_id`.
 */

(function () {
  'use strict';

  let _userId  = null;
  let _client  = null;
  let _ready   = false;
  let _saveTimer = null;

  // ── Obtener cliente Supabase (del módulo Auth) ──────────────
  function _getClient() {
    if (_client) return _client;
    if (window.Auth && typeof window.Auth.getClient === 'function') {
      _client = window.Auth.getClient();
    }
    return _client;
  }

  // ── init(userId) ────────────────────────────────────────────
  function init(userId) {
    _userId = userId;
    _client = _getClient();
    if (_client && _userId) {
      _ready = true;
      console.log('✅ window.DB listo para usuario:', _userId);
    } else {
      console.warn('⚠️ window.DB: cliente Supabase no disponible todavía');
    }
  }

  // load() -> { semestres, settings, updatedAt } | null
  async function load() {
    if (!_ready) return null;
    try {
      const { data, error } = await _getClient()
        .from('user_data')
        .select('semestres, settings, updated_at')
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
      console.log('📥 DB.load: datos cargados desde Supabase');
      return {
        semestres: data.semestres || [],
        settings:  data.settings  || {},
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

  // ── _doSave(semestres, settings) ────────────────────────────
  async function _doSave(semestres, settings) {
    if (!_ready) return;
    try {
      const { error } = await _getClient()
        .from('user_data')
        .upsert(
          {
            user_id:    _userId,
            semestres:  semestres || [],
            settings:   settings  || {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.warn('⚠️ DB.save error:', error.message);
      } else {
        console.log('☁️ DB.save: datos guardados en Supabase');
      }
    } catch (err) {
      console.warn('⚠️ DB.save excepción:', err.message);
    }
  }

  // ── save(semestres, settings) — debounced 1500ms ────────────
  function save(semestres, settings) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _doSave(semestres, settings), 1500);
  }

  // ── saveNow(semestres, settings) — inmediato ────────────────
  async function saveNow(semestres, settings) {
    clearTimeout(_saveTimer);
    await _doSave(semestres, settings);
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
