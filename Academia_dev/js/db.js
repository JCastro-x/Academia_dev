/**
 * ═══════════════════════════════════════════════════════════════
 * DB.JS — Capa de base de datos Supabase
 * Reemplaza localStorage con Supabase para datos persistentes
 * ═══════════════════════════════════════════════════════════════
 */

(function () {

  // ── Sync status UI ────────────────────────────────────────────
  function _showSync(msg, type = 'info') {
    let el = document.getElementById('db-sync-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'db-sync-indicator';
      el.style.cssText = `
        position:fixed;bottom:16px;right:16px;z-index:9999;
        padding:6px 12px;border-radius:8px;font-size:11px;
        font-family:'Space Mono',monospace;letter-spacing:0.5px;
        transition:opacity 0.4s;pointer-events:none;
      `;
      document.body.appendChild(el);
    }
    const colors = {
      info:    'background:#1a1a2e;color:#7c6aff;border:1px solid #7c6aff44',
      success: 'background:#0a2e1a;color:#4ade80;border:1px solid #4ade8044',
      error:   'background:#2e0a0a;color:#f87171;border:1px solid #f8717144',
      saving:  'background:#2e2a0a;color:#fbbf24;border:1px solid #fbbf2444',
    };
    el.style.cssText += ';' + colors[type];
    el.textContent = msg;
    el.style.opacity = '1';
    if (type !== 'saving') {
      setTimeout(() => { el.style.opacity = '0'; }, 2500);
    }
  }

  // ── Save timer (debounce) ─────────────────────────────────────
  let _saveTimer = null;

  // ── Main DB object ────────────────────────────────────────────
  const DB = {

    _userId: null,
    _ready: false,

    // ── Inicializar con el usuario autenticado ─────────────────
    init(userId) {
      this._userId = userId;
      this._ready = true;
      console.log('✅ DB initialized for user:', userId);
    },

    // ── Cargar datos del usuario desde Supabase ────────────────
    async load() {
      if (!this._ready) return null;

      try {
        const client = window.Auth.getClient();
        const { data, error } = await client
          .from('user_data')
          .select('semestres, settings')
          .eq('user_id', this._userId)
          .single();

        if (error && error.code === 'PGRST116') {
          // No existe aún — primera vez del usuario
          console.log('📦 Usuario nuevo, sin datos en DB');
          return null;
        }

        if (error) throw error;

        console.log('✅ Datos cargados desde Supabase');
        return data;

      } catch (err) {
        console.error('❌ Error cargando datos:', err);
        return null;
      }
    },

    // ── Guardar datos (debounced 800ms) ────────────────────────
    save(semestres, settings) {
      if (!this._ready) return;
      clearTimeout(_saveTimer);
      _showSync('Guardando...', 'saving');
      _saveTimer = setTimeout(() => this._doSave(semestres, settings), 800);
    },

    // ── Guardar inmediatamente ─────────────────────────────────
    async saveNow(semestres, settings) {
      if (!this._ready) return;
      clearTimeout(_saveTimer);
      await this._doSave(semestres, settings);
    },

    // ── Lógica real de guardado ────────────────────────────────
    async _doSave(semestres, settings) {
      try {
        const client = window.Auth.getClient();
        const { error } = await client
          .from('user_data')
          .upsert({
            user_id:   this._userId,
            semestres: semestres,
            settings:  settings,
          }, { onConflict: 'user_id' });

        if (error) throw error;

        _showSync('✓ Guardado', 'success');
        console.log('✅ Datos guardados en Supabase');

      } catch (err) {
        console.error('❌ Error guardando:', err);
        _showSync('Error al guardar', 'error');

        // Fallback a localStorage si falla Supabase
        try {
          localStorage.setItem('academia_v4_semestres', JSON.stringify(semestres));
          localStorage.setItem('academia_v3_settings', JSON.stringify(settings));
          console.warn('⚠️ Guardado en localStorage como fallback');
        } catch (e) {}
      }
    },
  };

  window.DB = DB;
  console.log('📦 DB module loaded - window.DB ready');

})();
