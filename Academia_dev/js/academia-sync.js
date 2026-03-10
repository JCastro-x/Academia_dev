/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ACADEMIA-SYNC.JS — window.DB para sincronización de datos
 *
 * Requerido por app.js:  window.DB.init / load / save / saveNow / _ready
 *
 * TABLA SUPABASE necesaria (ejecutar en SQL Editor una sola vez):
 * ─────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS user_data (
 *   user_id   TEXT PRIMARY KEY,
 *   semestres JSONB DEFAULT '[]',
 *   settings  JSONB DEFAULT '{}',
 *   updated_at TIMESTAMPTZ DEFAULT now()
 * );
 * ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Solo el dueño puede leer/escribir"
 *   ON user_data FOR ALL
 *   USING (auth.uid()::text = user_id)
 *   WITH CHECK (auth.uid()::text = user_id);
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  // ── load() → { semestres, settings } | null ─────────────────
  async function load() {
    if (!_ready) return null;
    try {
      const { data, error } = await _getClient()
        .from('user_data')
        .select('semestres, settings')
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
      };
    } catch (err) {
      console.warn('⚠️ DB.load excepción:', err.message);
      return null;
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

  // ── Export ───────────────────────────────────────────────────
  Object.defineProperty(window, 'DB', {
    get() {
      return {
        init,
        load,
        save,
        saveNow,
        get _ready() { return _ready; },
      };
    },
    configurable: true,
  });

  console.log('📦 academia-sync.js cargado (window.DB disponible)');
})();
