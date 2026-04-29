// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS-DB.JS — IndexedDB para notificaciones programadas
// ═══════════════════════════════════════════════════════════════
// Infraestructura lista para migración a Push API en el futuro

const NOTIFS_DB = (() => {
  'use strict';

  const DB_NAME = 'AcademiaNotifications';
  const DB_VERSION = 1;
  const STORE_NAME = 'scheduled_notifications';
  let _db = null;

  // ── Inicializar IndexedDB ─────────────────────────────────────
  async function init() {
    if (_db) return _db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        _db = request.result;
        resolve(_db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('scheduledFor', 'scheduledFor', { unique: false });
          store.createIndex('taskId', 'taskId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  // ── Guardar notificación programada ───────────────────────────
  async function schedule(notification) {
    await init();
    
    const notif = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId: notification.taskId || null,
      type: notification.type || 'task', // 'task', 'subtask', 'exam', 'daily'
      title: notification.title,
      body: notification.body,
      scheduledFor: notification.scheduledFor, // ISO timestamp
      fired: false,
      createdAt: new Date().toISOString(),
      // Campos para futura migración a Push API
      pushReady: false,
      pushEndpoint: null,
    };

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(notif);

      request.onsuccess = () => resolve(notif);
      request.onerror = () => reject(request.error);
    });
  }

  // ── Obtener notificaciones pendientes (no disparadas) ─────────
  async function getPending() {
    await init();

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('scheduledFor');
      const request = index.openCursor(null, 'next');

      const results = [];
      const now = new Date().toISOString();

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const notif = cursor.value;
          if (!notif.fired && notif.scheduledFor <= now) {
            results.push(notif);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ── Marcar notificación como disparada ────────────────────────
  async function markAsFired(id) {
    await init();

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const notif = request.result;
        if (notif) {
          notif.fired = true;
          notif.firedAt = new Date().toISOString();
          const updateRequest = store.put(notif);
          updateRequest.onsuccess = () => resolve(notif);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ── Limpiar notificaciones viejas (más de 7 días) ───────────
  async function cleanup() {
    await init();

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let deletedCount = 0;

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const notif = cursor.value;
          if (notif.fired && notif.firedAt < sevenDaysAgo) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ── Eliminar notificaciones de una tarea específica ───────────
  async function deleteByTaskId(taskId) {
    await init();

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('taskId');
      const request = index.openCursor(IDBKeyRange.only(taskId));

      let deletedCount = 0;

      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ── Obtener todas las notificaciones (para debug) ─────────────
  async function getAll() {
    await init();

    return new Promise((resolve, reject) => {
      const tx = _db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    init,
    schedule,
    getPending,
    markAsFired,
    cleanup,
    deleteByTaskId,
    getAll,
  };
})();
