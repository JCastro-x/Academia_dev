/**
 * Sistema de Backup Automático Local
 * Previene pérdida de datos creando backups periódicos en localStorage
 */

(function () {
  'use strict';

  const BACKUP_KEY_PREFIX = 'academia_backup_';
  const MAX_BACKUPS = 5; // Mantener los últimos 5 backups
  const BACKUP_INTERVAL = 30 * 60 * 1000; // 30 minutos entre backups automáticos

  let _backupTimer = null;
  let _isBackupInProgress = false;

  // ── Crear backup del estado actual ───────────────────────────────
  function createBackup(reason = 'manual') {
    if (_isBackupInProgress) {
      console.warn('⚠️ [BACKUP] Ya hay un backup en progreso, skipping...');
      return null;
    }

    _isBackupInProgress = true;

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        reason: reason,
        semestres: null,
        settings: null,
        pomData: null
      };

      // Guardar semestres
      if (typeof State !== 'undefined' && State.semestres) {
        backup.semestres = JSON.parse(JSON.stringify(State.semestres));
      }

      // Guardar settings
      if (typeof State !== 'undefined' && State.settings) {
        backup.settings = JSON.parse(JSON.stringify(State.settings));
      }

      // Guardar datos de pomodoro
      if (typeof State !== 'undefined' && State.pomSessions) {
        backup.pomData = {
          sessions: State.pomSessions,
          history: State.pomHistory,
          date: new Date().toDateString()
        };
      }

      // Guardar backup en localStorage
      const backupKey = BACKUP_KEY_PREFIX + Date.now();
      const backupString = JSON.stringify(backup);
      localStorage.setItem(backupKey, backupString);

      // Limpiar backups antiguos
      cleanupOldBackups();

      console.log(`✅ [BACKUP] Backup creado: ${reason} (${backupString.length} bytes)`);
      console.log(`📦 [BACKUP] Key: ${backupKey}`);

      return backupKey;
    } catch (e) {
      console.error('❌ [BACKUP] Error creando backup:', e);
      return null;
    } finally {
      _isBackupInProgress = false;
    }
  }

  // ── Limpiar backups antiguos (mantener solo los más recientes) ───────
  function cleanupOldBackups() {
    try {
      const allKeys = Object.keys(localStorage);
      const backupKeys = allKeys
        .filter(k => k.startsWith(BACKUP_KEY_PREFIX))
        .sort((a, b) => {
          const timestampA = parseInt(a.replace(BACKUP_KEY_PREFIX, ''));
          const timestampB = parseInt(b.replace(BACKUP_KEY_PREFIX, ''));
          return timestampB - timestampA; // Ordenar descendente (más reciente primero)
        });

      // Eliminar backups excedentes
      if (backupKeys.length > MAX_BACKUPS) {
        const keysToDelete = backupKeys.slice(MAX_BACKUPS);
        keysToDelete.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ [BACKUP] Backup antiguo eliminado: ${key}`);
        });
      }

      console.log(`📊 [BACKUP] Backups actuales: ${backupKeys.length}/${MAX_BACKUPS}`);
    } catch (e) {
      console.error('❌ [BACKUP] Error limpiando backups:', e);
    }
  }

  // ── Listar todos los backups disponibles ───────────────────────────
  function listBackups() {
    try {
      const allKeys = Object.keys(localStorage);
      const backupKeys = allKeys
        .filter(k => k.startsWith(BACKUP_KEY_PREFIX))
        .sort((a, b) => {
          const timestampA = parseInt(a.replace(BACKUP_KEY_PREFIX, ''));
          const timestampB = parseInt(b.replace(BACKUP_KEY_PREFIX, ''));
          return timestampB - timestampA;
        });

      const backups = backupKeys.map(key => {
        try {
          const backup = JSON.parse(localStorage.getItem(key));
          return {
            key: key,
            timestamp: backup.timestamp,
            reason: backup.reason,
            size: localStorage.getItem(key).length,
            hasSemestres: !!backup.semestres,
            hasSettings: !!backup.settings
          };
        } catch (e) {
          return {
            key: key,
            error: 'Failed to parse'
          };
        }
      });

      return backups;
    } catch (e) {
      console.error('❌ [BACKUP] Error listando backups:', e);
      return [];
    }
  }

  // ── Restaurar desde un backup específico ───────────────────────────
  function restoreBackup(backupKey) {
    try {
      const backupString = localStorage.getItem(backupKey);
      if (!backupString) {
        console.error('❌ [BACKUP] Backup no encontrado:', backupKey);
        return false;
      }

      const backup = JSON.parse(backupString);

      // Crear backup de emergencia antes de restaurar
      createBackup('pre-restore-emergency');

      // Restaurar semestres
      if (backup.semestres && Array.isArray(backup.semestres)) {
        localStorage.setItem('academia_v4_semestres', JSON.stringify(backup.semestres));
        if (typeof State !== 'undefined') {
          State.semestres.length = 0;
          backup.semestres.forEach(s => State.semestres.push(s));
        }
        console.log('✅ [BACKUP] Semestres restaurados');
      }

      // Restaurar settings
      if (backup.settings && typeof backup.settings === 'object') {
        localStorage.setItem('academia_v3_settings', JSON.stringify(backup.settings));
        if (typeof State !== 'undefined') {
          Object.assign(State.settings, backup.settings);
        }
        console.log('✅ [BACKUP] Settings restaurados');
      }

      // Restaurar datos de pomodoro
      if (backup.pomData) {
        if (backup.pomData.sessions) {
          State.pomSessions = backup.pomData.sessions;
          localStorage.setItem('academia_v3_pom_today', JSON.stringify(backup.pomData.sessions));
        }
        if (backup.pomData.history) {
          State.pomHistory = backup.pomData.history;
          localStorage.setItem('academia_v3_pom_history', JSON.stringify(backup.pomData.history));
        }
        console.log('✅ [BACKUP] Datos de pomodoro restaurados');
      }

      console.log(`✅ [BACKUP] Restauración completada desde: ${backup.timestamp}`);
      return true;
    } catch (e) {
      console.error('❌ [BACKUP] Error restaurando backup:', e);
      return false;
    }
  }

  // ── Iniciar backups automáticos ───────────────────────────────────
  function startAutoBackup() {
    if (_backupTimer) {
      clearInterval(_backupTimer);
    }

    // Crear backup inicial
    createBackup('initial');

    // Configurar backups periódicos
    _backupTimer = setInterval(() => {
      createBackup('auto');
    }, BACKUP_INTERVAL);

    console.log('🔄 [BACKUP] Backups automáticos iniciados (cada 30 minutos)');
  }

  // ── Detener backups automáticos ───────────────────────────────────
  function stopAutoBackup() {
    if (_backupTimer) {
      clearInterval(_backupTimer);
      _backupTimer = null;
      console.log('⏸️ [BACKUP] Backups automáticos detenidos');
    }
  }

  // ── Crear backup antes de operaciones críticas ─────────────────────
  function backupBeforeCriticalOperation(operationName) {
    return createBackup(`pre-${operationName}`);
  }

  // ── Exportar backup como JSON descargable ─────────────────────────
  function exportBackup() {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        semestres: typeof State !== 'undefined' ? State.semestres : null,
        settings: typeof State !== 'undefined' ? State.settings : null,
        pomData: typeof State !== 'undefined' ? {
          sessions: State.pomSessions,
          history: State.pomHistory
        } : null
      };

      const backupString = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `academia_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('📤 [BACKUP] Backup exportado como archivo JSON');
    } catch (e) {
      console.error('❌ [BACKUP] Error exportando backup:', e);
    }
  }

  // ── API pública ───────────────────────────────────────────────────
  const API = {
    createBackup,
    restoreBackup,
    listBackups,
    startAutoBackup,
    stopAutoBackup,
    backupBeforeCriticalOperation,
    exportBackup
  };

  // Exponer globalmente
  window.BackupSystem = API;

  // Iniciar automáticamente cuando la aplicación esté lista
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => startAutoBackup(), 5000);
    });
  } else {
    setTimeout(() => startAutoBackup(), 5000);
  }

  console.log('🛡️ [BACKUP] Sistema de backup inicializado');

})();
