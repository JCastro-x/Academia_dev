/**
 * ═══════════════════════════════════════════════════════════════
 * DB.JS — Capa de base de datos Supabase v2
 * Tablas: user_semestres, user_settings, user_history
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

  // ── Timers ────────────────────────────────────────────────────
  let _saveTimer = null;
  let _syncTimer = null;

  // ── Main DB object ────────────────────────────────────────────
  const DB = {

    _userId: null,
    _ready:  false,
    _lastSync:     0,
    _syncThrottle: 10000,

    init(userId) {
      this._userId = userId;
      this._ready  = true;
      console.log('✅ DB initialized for user:', userId);
      this._setupSyncListeners();
    },

    _setupSyncListeners() {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          clearTimeout(_syncTimer);
          _syncTimer = setTimeout(() => {
            console.log('📱 Tab visible - sincronizando...');
            this._syncFromSupabase();
          }, 1500);
        }
      });
      setInterval(() => { this._syncFromSupabase(); }, 60000);
    },

    async _syncFromSupabase() {
      if (!this._ready) return;
      const now = Date.now();
      if (now - this._lastSync < this._syncThrottle) return;
      this._lastSync = now;

      try {
        const dbData = await this.load();
        if (!dbData) return;

        const remSem = dbData.semestres || [];
        const remSet = dbData.settings  || {};

        const semChanged = JSON.stringify(State.semestres || []) !== JSON.stringify(remSem);
        const setChanged = JSON.stringify(State.settings  || {}) !== JSON.stringify(remSet);

        if (semChanged || setChanged) {
          console.log('🔄 Cambios del servidor detectados, actualizando...');
          if (semChanged) {
            State.semestres = remSem;
            try { localStorage.setItem('academia_v4_semestres', JSON.stringify(remSem)); } catch(e) {}
          }
          if (setChanged) {
            Object.assign(State.settings, remSet);
            try { localStorage.setItem('academia_v3_settings', JSON.stringify(remSet)); } catch(e) {}
          }

          const activePage = document.querySelector('.page.active')?.id?.replace('page-','');
          if      (activePage === 'overview')   { typeof renderOverview  === 'function' && renderOverview(); }
          else if (activePage === 'tareas')     { typeof renderTasks     === 'function' && renderTasks(); }
          else if (activePage === 'calendario') { typeof renderCalendar  === 'function' && renderCalendar(); }
          else if (activePage === 'notas')      { typeof renderNotes     === 'function' && renderNotes(); }
          else if (activePage === 'materias')   { typeof renderMaterias  === 'function' && renderMaterias(); }

          _showSync('✓ Sincronizado', 'success');
        }
      } catch (err) {
        console.error('❌ Error en sync:', err);
      }
    },

    async load() {
      if (!this._ready) return null;
      try {
        const client = window.Auth.getClient();

        const [semRes, setRes] = await Promise.all([
          client.from('user_semestres').select('data').eq('user_id', this._userId).single(),
          client.from('user_settings').select('data').eq('user_id', this._userId).single(),
        ]);

        if (semRes.error && semRes.error.code !== 'PGRST116') throw semRes.error;
        if (setRes.error && setRes.error.code !== 'PGRST116') throw setRes.error;

        console.log('✅ Datos cargados desde Supabase');
        return {
          semestres: semRes.data?.data || [],
          settings:  setRes.data?.data || {},
        };
      } catch (err) {
        console.error('❌ Error cargando datos:', err);
        return null;
      }
    },

    save(semestres, settings) {
      if (!this._ready) return;
      clearTimeout(_saveTimer);
      _showSync('Guardando...', 'saving');
      _saveTimer = setTimeout(() => this._doSave(semestres, settings), 800);
    },

    async saveNow(semestres, settings) {
      if (!this._ready) return;
      clearTimeout(_saveTimer);
      await this._doSave(semestres, settings);
    },

    async _doSave(semestres, settings) {
      try {
        const client = window.Auth.getClient();

        const [semRes, setRes] = await Promise.all([
          client.from('user_semestres').upsert({ user_id: this._userId, data: semestres }, { onConflict: 'user_id' }),
          client.from('user_settings').upsert({ user_id: this._userId, data: settings  }, { onConflict: 'user_id' }),
        ]);

        if (semRes.error) throw semRes.error;
        if (setRes.error) throw setRes.error;

        _showSync('✓ Guardado', 'success');
        console.log('✅ Datos guardados en Supabase');

      } catch (err) {
        console.error('❌ Error guardando:', err);
        _showSync('Error al guardar', 'error');
        try {
          localStorage.setItem('academia_v4_semestres', JSON.stringify(semestres));
          localStorage.setItem('academia_v3_settings',  JSON.stringify(settings));
          console.warn('⚠️ Guardado en localStorage como fallback');
        } catch (e) {}
      }
    },

    // ── Historial (deshacer cambios) ───────────────────────────
    async saveHistory(description = 'Cambio manual') {
      if (!this._ready) return;
      try {
        const client = window.Auth.getClient();
        await client.from('user_history').insert({
          user_id:     this._userId,
          snapshot:    { semestres: State.semestres || [], settings: State.settings || {}, savedAt: new Date().toISOString() },
          description,
        });
        console.log('📸 Snapshot guardado en historial');
      } catch (err) {
        console.warn('⚠️ No se pudo guardar historial:', err);
      }
    },

    async getHistory() {
      if (!this._ready) return [];
      try {
        const client = window.Auth.getClient();
        const { data, error } = await client
          .from('user_history')
          .select('id, description, created_at, snapshot')
          .eq('user_id', this._userId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('❌ Error cargando historial:', err);
        return [];
      }
    },

    async restoreFromHistory(historyId) {
      if (!this._ready) return false;
      try {
        const client = window.Auth.getClient();
        const { data, error } = await client
          .from('user_history')
          .select('snapshot')
          .eq('id', historyId)
          .eq('user_id', this._userId)
          .single();
        if (error) throw error;
        if (!data?.snapshot) return false;

        await this.saveHistory('Antes de restaurar');
        await this._doSave(data.snapshot.semestres || [], data.snapshot.settings || {});
        State.semestres = data.snapshot.semestres || [];
        Object.assign(State.settings, data.snapshot.settings || {});
        console.log('✅ Datos restaurados desde historial');
        return true;
      } catch (err) {
        console.error('❌ Error restaurando:', err);
        return false;
      }
    },
  };

  window.DB = DB;
  console.log('📦 DB module loaded - window.DB ready (v2)');

})();
