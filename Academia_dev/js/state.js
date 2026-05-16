/* ─── DOM Cache: cache frequently-accessed nodes once at startup ─── */
const _DOM = {};
function _el(id) {
  if (_DOM[id]) return _DOM[id];
  const el = document.getElementById(id);
  if (el) _DOM[id] = el; // No cachear null: los partials pueden cargar luego
  return el;
}
function _clearDOMCache() { for (const k in _DOM) delete _DOM[k]; }
function _getAcademiaDB() { return window.AcademiaDB || window.DB; }

// Backwards-compatibility: expose `getAcademiaDB` expected by older files
if (typeof window.getAcademiaDB !== 'function') {
  window.getAcademiaDB = function() { return _getAcademiaDB(); };
}

/* ─── rAF Render Scheduler: batch multiple render() calls into one frame ─── */
const _pending = new Set();
let   _rafId   = null;
function _schedRender(fn) {
  _pending.add(fn);
  if (!_rafId) _rafId = requestAnimationFrame(() => {
    _rafId = null;
    const batch = [..._pending]; _pending.clear();
    batch.forEach(f => f());
  });
}

/* ─── Deep Merge Utility ─────────────────────────────────────────── */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;

  const output = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] instanceof Object && key in target) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }

  return output;
}

/* ─── Pub/Sub System for Reactivity ─────────────────────────────── */
const _subscribers = {
  'semesters': new Set(),
  'materias': new Set(),
  'tasks': new Set(),
  'notes': new Set(),
  'settings': new Set(),
  'calendar': new Set(),
  'grades': new Set(),
};

function subscribe(entityType, callback) {
  if (!_subscribers[entityType]) {
    console.warn(`[PUBSUB] Entity type "${entityType}" not registered`);
    return () => {};
  }
  _subscribers[entityType].add(callback);
  console.log(`[PUBSUB] Subscribed to ${entityType} (total: ${_subscribers[entityType].size})`);
  
  // Return unsubscribe function
  return () => {
    _subscribers[entityType].delete(callback);
    console.log(`[PUBSUB] Unsubscribed from ${entityType}`);
  };
}

function notify(entityType, data) {
  if (!_subscribers[entityType]) {
    console.warn(`[PUBSUB] Entity type "${entityType}" not registered`);
    return;
  }
  console.log(`[PUBSUB] Notifying ${entityType} subscribers (${_subscribers[entityType].size})`);
  _subscribers[entityType].forEach(callback => {
    try {
      callback(data);
    } catch (e) {
      console.error(`[PUBSUB] Error in ${entityType} subscriber:`, e);
    }
  });
}

/* ─── Network Quality Detection ──────────────────────────────────── */
function getNetworkQuality() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'unknown';
  
  const effectiveType = conn.effectiveType;
  const rtt = conn.rtt || 0;
  const downlink = conn.downlink || 0;
  
  console.log(`[NETWORK] Quality: ${effectiveType}, RTT: ${rtt}ms, Downlink: ${downlink}Mbps`);
  
  if (effectiveType === '4g' && rtt < 100) return 'fast';
  if (effectiveType === '4g' && rtt >= 100) return 'medium';
  if (effectiveType === '3g') return 'medium';
  if (effectiveType === '2g' || effectiveType === 'slow-2g') return 'slow';
  return 'unknown';
}

function getDynamicDebounceDelay() {
  const quality = getNetworkQuality();
  switch(quality) {
    case 'fast': return 5000;   // WiFi estable / 4G rápido
    case 'medium': return 10000; // 3G / 4G lento
    case 'slow': return 20000;   // 2G / mala conexión
    default: return 10000;
  }
}

/* ─── Hash Utility for Preflight Comparison ─────────────────────────── */
async function computeHash(data) {
  if (!data) return '';
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Exponer hash utility globalmente
window.computeHash = computeHash;

const DB_KEYS = {
  SEMESTRES: 'academia_v4_semestres',
  POM_TODAY: 'academia_v3_pom_today',
  POM_DATE:  'academia_v3_pom_date',
  POM_HISTORY: 'academia_v3_pom_history',
  POM_RUNNING: 'academia_v3_pom_running',
  POM_SNAPSHOTS: 'academia_v3_pom_daily_snapshots',
  SETTINGS:  'academia_v3_settings',
};

// ─── IndexedDB for large image data ────────────────────────────
let _idb = null;
const IDB_VERSION = 2; // Incrementado para agregar object store 'deleted_images'
const UNDO_PERIOD_MS = 5000; // 5 segundos para Undo

function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('academia_images', IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Crear object store principal si no existe
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images');
      }
      // Crear object store para soft delete con timestamps
      if (!db.objectStoreNames.contains('deleted_images')) {
        const deletedStore = db.createObjectStore('deleted_images');
        deletedStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}

// ─── Image compression ───────────────────────────────────────────
async function compressImage(dataUrl, maxWidth = 1920, quality = 0.5) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Redimensionar si excede maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Usar JPEG para mejor compresión (a menos que sea PNG con transparencia)
      const isPngWithTransparency = dataUrl.startsWith('data:image/png') && img.width > 0 && img.height > 0;
      const format = isPngWithTransparency ? 'image/png' : 'image/jpeg';
      
      resolve(canvas.toDataURL(format, quality));
    };
    img.onerror = () => resolve(dataUrl); // Fallback: usar original si falla
    img.src = dataUrl;
  });
}

async function idbSetImage(key, dataUrl) {
  if (!key || !dataUrl) {
    console.error('❌ [IDB_MANAGER] Error: Key o dataUrl inválidos');
    return false;
  }

  // Invalidar caché cuando se modifica una imagen
  _imageCache.delete(key);

  try {
    // 🔥 VERIFICAR ESPACIO ANTES DE GUARDAR
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        const usagePercent = (estimate.usage / estimate.quota) * 100;
        console.log(`💾 [IDB_MANAGER] Espacio usado: ${usagePercent.toFixed(1)}% (${(estimate.usage/1024/1024).toFixed(1)}MB / ${(estimate.quota/1024/1024).toFixed(1)}MB)`);
        
        if (usagePercent > 90) {
          console.warn('⚠️ [IDB_MANAGER] Espacio casi lleno, limpiando imágenes no usadas...');
          await cleanupUnusedImages();
        }
        
        if (usagePercent > 95) {
          console.error('❌ [IDB_MANAGER] Espacio insuficiente en IndexedDB');
          if (typeof _appNotify === 'function') {
            _appNotify('Espacio de almacenamiento casi lleno. Elimina imágenes antiguas.', 'warning');
          }
          return false;
        }
      }
    }

    // Comprimir imagen antes de guardar
    const compressed = await compressImage(dataUrl);
    console.log(`📦 [IDB_MANAGER] Guardando imagen: ${key} (${(compressed.length/1024).toFixed(1)}KB)`);
    
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readwrite');
      const store = tx.objectStore('images');
      store.put(compressed, key);
      
      tx.oncomplete = () => {
        console.log(`✅ [IDB_MANAGER] Imagen guardada exitosamente: ${key}`);
        res(true);
      };
      
      tx.onerror = () => {
        console.error(`❌ [IDB_MANAGER] Error guardando imagen ${key}:`, tx.error);
        if (tx.error?.name === 'QuotaExceededError') {
          if (typeof _appNotify === 'function') {
            _appNotify('Error: Espacio insuficiente. Elimina imágenes antiguas.', 'error');
          }
        }
        rej(tx.error);
      };
    });
  } catch(e) {
    console.error(`❌ [IDB_MANAGER] Excepción crítica guardando imagen ${key}:`, e);
    if (typeof _appNotify === 'function') {
      _appNotify('Error al guardar imagen. Intenta de nuevo.', 'error');
    }
    return false;
  }
}
// Placeholder image for missing assets (simple gray square with text)
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzJhMmEzOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTA5MGE4IiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ibW9ub3NwYWNlIj5JbWFnZW4gbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4=';

// Caché en memoria para imágenes cargadas de IndexedDB
const _imageCache = new Map();
const MAX_CACHE_SIZE = 50; // Máximo número de imágenes en caché

async function idbGetImage(key) {
  if (!key) {
    console.error('[IDB_MANAGER] Error: Key inválida (null/undefined)');
    return PLACEHOLDER_IMAGE;
  }

  // Verificar caché primero
  if (_imageCache.has(key)) {
    console.log(`[IDB_MANAGER] Asset recuperado del caché: ${key}`);
    return _imageCache.get(key);
  }

  try {
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readonly');
      const req = tx.objectStore('images').get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (!result) {
          console.warn(`[IDB_MANAGER] Asset no encontrado: ${key} - usando placeholder`);
          res(PLACEHOLDER_IMAGE);
        } else {
          console.log(`[IDB_MANAGER] Asset recuperado: ${key} (${(result.length / 1024).toFixed(2)} KB)`);
          // Guardar en caché
          if (_imageCache.size >= MAX_CACHE_SIZE) {
            // Eliminar la entrada más antigua (FIFO)
            const firstKey = _imageCache.keys().next().value;
            _imageCache.delete(firstKey);
          }
          _imageCache.set(key, result);
          res(result);
        }
      };
      req.onerror = () => {
        console.error(`[IDB_MANAGER] Error al recuperar asset ${key}:`, tx.error);
        // Fallback to placeholder on error instead of rejecting
        res(PLACEHOLDER_IMAGE);
      };
    });
  } catch(e) {
    console.error(`[IDB_MANAGER] Excepción al recuperar asset ${key}:`, e);
    // Fallback to placeholder on exception
    return PLACEHOLDER_IMAGE;
  }
}
// Función para limpiar el caché de imágenes
function clearImageCache() {
  console.log('[IDB_MANAGER] Limpiando caché de imágenes');
  _imageCache.clear();
}

// Función para invalidar una imagen específica del caché
function invalidateImageCache(key) {
  if (_imageCache.has(key)) {
    console.log(`[IDB_MANAGER] Invalidando caché de imagen: ${key}`);
    _imageCache.delete(key);
  }
}

async function idbDeleteImage(key) {
  // Invalidar caché cuando se elimina una imagen
  invalidateImageCache(key);

  try {
    const db = await _openIDB();
    return new Promise((res) => {
      const tx = db.transaction(['images', 'deleted_images'], 'readwrite');
      
      // Soft delete: mover imagen a deleted_images con timestamp de expiración
      const imagesStore = tx.objectStore('images');
      const deletedStore = tx.objectStore('deleted_images');
      
      const getRequest = imagesStore.get(key);
      getRequest.onsuccess = () => {
        const imageData = getRequest.result;
        if (imageData) {
          // Guardar en deleted_images con timestamp de expiración
          const expiresAt = Date.now() + UNDO_PERIOD_MS;
          deletedStore.put({
            key: key,
            data: imageData,
            deletedAt: Date.now(),
            expiresAt: expiresAt
          }, key);
          
          // Eliminar del store principal
          imagesStore.delete(key);
        }
      };
      
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch(e) { 
    console.warn('IDB soft delete error', e); 
    return false; 
  }
}

// Restaurar imagen desde deleted_images (para Undo)
async function idbRestoreImage(key) {
  try {
    const db = await _openIDB();
    return new Promise((res) => {
      const tx = db.transaction(['images', 'deleted_images'], 'readwrite');
      const deletedStore = tx.objectStore('deleted_images');
      const imagesStore = tx.objectStore('images');
      
      const getRequest = deletedStore.get(key);
      getRequest.onsuccess = () => {
        const deletedRecord = getRequest.result;
        if (deletedRecord && deletedRecord.expiresAt > Date.now()) {
          // Restaurar al store principal
          imagesStore.put(deletedRecord.data, key);
          // Eliminar de deleted_images
          deletedStore.delete(key);
          res(true);
        } else {
          res(false); // No existe o expiró
        }
      };
      
      tx.oncomplete = () => {};
      tx.onerror = () => res(false);
    });
  } catch(e) { 
    console.warn('IDB restore error', e); 
    return false; 
  }
}

// Limpiar imágenes expiradas de deleted_images (llamar periódicamente)
async function cleanupExpiredDeletedImages() {
  try {
    const db = await _openIDB();
    const now = Date.now();
    
    return new Promise((res) => {
      const tx = db.transaction('deleted_images', 'readwrite');
      const store = tx.objectStore('deleted_images');
      const index = store.index('expiresAt');
      
      // Buscar registros expirados
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      
      let deletedCount = 0;
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`🧹 Limpieza IndexedDB: ${deletedCount} imágenes expiradas eliminadas permanentemente`);
        }
        res(deletedCount);
      };
      tx.onerror = () => res(0);
    });
  } catch(e) { 
    console.warn('Error limpiando imágenes expiradas:', e); 
    return 0; 
  }
}

// Limpiar imágenes no usadas de IndexedDB
async function cleanupUnusedImages() {
  try {
    const db = await _openIDB();
    const tx = db.transaction('images','readonly');
    const store = tx.objectStore('images');
    const request = store.getAllKeys();
    
    request.onsuccess = async () => {
      const allKeys = request.result;
      const usedKeys = new Set();
      
      // Recolectar claves usadas en notas
      const semestres = State.semestres || [];
      semestres.forEach(sem => {
        const notes = sem.notesArray || [];
        notes.forEach(note => {
          // Check canvasData
          if (note.canvasData?.startsWith('IDB:')) {
            usedKeys.add(note.canvasData.replace('IDB:', ''));
          }
          // Check images
          if (note.images) {
            Object.values(note.images).forEach(val => {
              if (val?.startsWith('IDB:')) {
                usedKeys.add(val.replace('IDB:', ''));
              }
            });
          }
          // Check PDFs
          if (note.pdfAttachments) {
            note.pdfAttachments.forEach(pdf => {
              if (pdf.data?.startsWith('IDB:')) {
                usedKeys.add(pdf.data.replace('IDB:', ''));
              }
            });
          }
        });
      });
      
      // Eliminar claves no usadas
      const unusedKeys = allKeys.filter(key => !usedKeys.has(key));
      if (unusedKeys.length > 0) {
        const deleteTx = db.transaction('images','readwrite');
        const deleteStore = deleteTx.objectStore('images');
        unusedKeys.forEach(key => deleteStore.delete(key));
        console.log(`🧹 Limpieza IndexedDB: ${unusedKeys.length} imágenes no usadas eliminadas`);
      }
    };
  } catch(e) { console.warn('Error limpiando IndexedDB:', e); }
}

// Exponer globalmente para uso manual
window.cleanupUnusedImages = cleanupUnusedImages;
window.cleanupExpiredDeletedImages = cleanupExpiredDeletedImages;
window.clearImageCache = clearImageCache;
window.invalidateImageCache = invalidateImageCache;

// Cleanup periódico de imágenes expiradas (cada 10 minutos)
setInterval(() => {
  cleanupExpiredDeletedImages();
}, 600000); // 10 minutos

// ─── Modal de confirmación personalizado ─────────────────────────
let _confirmCallback = null;

function showConfirmModal(options) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const messageEl = document.getElementById('confirm-modal-message');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  const cancelBtn = document.getElementById('confirm-modal-cancel');

  titleEl.textContent = options.title || 'Confirmar acción';
  messageEl.textContent = options.message || '';
  confirmBtn.textContent = options.confirmText || 'Confirmar';
  cancelBtn.textContent = options.cancelText || 'Cancelar';

  // Estilo de botón de confirmación
  if (options.danger) {
    confirmBtn.classList.add('danger');
  } else {
    confirmBtn.classList.remove('danger');
  }

  // Mostrar modal
  modal.classList.add('open');

  return new Promise((resolve) => {
    _confirmCallback = resolve;

    cancelBtn.onclick = () => {
      modal.classList.remove('open');
      resolve(false);
      _confirmCallback = null;
    };

    confirmBtn.onclick = () => {
      modal.classList.remove('open');
      resolve(true);
      _confirmCallback = null;
    };
  });
}

// Función asíncrona para confirmaciones (para usar con await)
window.showConfirm = function(message, options = {}) {
  return showConfirmModal({
    title: options.title || 'Confirmar',
    message: message,
    confirmText: options.confirmText || 'Confirmar',
    cancelText: options.cancelText || 'Cancelar',
    danger: options.danger || false
  });
};

const DEFAULT_MATERIAS = [];

const DEFAULT_SETTINGS = { 
  minGrade: 70, 
  theme: 'dark', 
  semester: '1er Año · 2do Sem', 
  font: 'Syne', 
  soundVariant: 'classic', 
  accentColor: '#7c6aff',
  habits: [] // Hábitos globales (independientes del semestre)
};

function dbGet(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
let _storageWarnTimer = null;
function _showStorageWarning(msg) {
  let el = document.getElementById('storage-warning-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'storage-warning-toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:94px;transform:translateX(-50%);z-index:3500;max-width:min(92vw,620px);padding:10px 14px;border-radius:10px;background:rgba(36,10,10,.95);border:1px solid rgba(248,113,113,.45);color:#ffd7d7;font-size:12px;font-family:Syne,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;transition:opacity .18s ease;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(_storageWarnTimer);
  _storageWarnTimer = setTimeout(() => { if (el) el.style.opacity = '0'; }, 4200);
}

function _appNotify(msg, type = 'ok') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:4500;max-width:min(92vw,720px);padding:10px 14px;border-radius:10px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .18s ease;';
    document.body.appendChild(el);
  }
  const colors = { ok: 'var(--accent)', warning: '#fbbf24', error: '#f87171' };
  el.style.border = `2px solid ${colors[type] || colors.ok}`;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { if (el) el.style.opacity = '0'; }, 4200);
}

// Expose a simple global notifier used by sync and other modules
window._appNotify = _appNotify;

// Show quick online/offline status changes
window.addEventListener('online', () => { _appNotify('Conexión restablecida — intentando sincronizar', 'ok'); });
window.addEventListener('offline', () => { _appNotify('Sin conexión — trabajando en modo offline', 'warning'); });

// Compatibility shims for functions expected by older modules
if (typeof window.createFlashcardFromSelection !== 'function') {
  window.createFlashcardFromSelection = function() {
    const sel = window.getSelection ? window.getSelection().toString().trim() : '';
    if (!sel) { if (typeof window._appNotify === 'function') window._appNotify('Selecciona texto para crear la flashcard', 'warning'); return; }
    // Prefer new flashcards API
    if (typeof window.openAddFlashcardModal === 'function') {
      try {
        openAddFlashcardModal();
        setTimeout(() => {
          const q = document.getElementById('fc-question-input') || document.getElementById('fc-front') || document.getElementById('fc-front-input');
          if (q) { q.value = sel; if (typeof q.focus === 'function') q.focus(); }
        }, 60);
        return;
      } catch(e) { /* fallback below */ }
    }
    // Legacy modal fallback
    if (typeof window.openNewFlashcardModal === 'function') {
      openNewFlashcardModal();
      setTimeout(() => { const f = document.getElementById('fc-front'); if (f) f.value = sel; }, 60);
      return;
    }
    if (typeof window._appNotify === 'function') window._appNotify('Función de flashcards no disponible', 'error');
  };
}

if (typeof window._getGreeting !== 'function') {
  window._getGreeting = function() {
    const h = new Date().getHours();
    const userName = window._currentUserName || (typeof State !== 'undefined' && State.settings?.profile?.name ? State.settings.profile.name.split(' ')[0] : null) || 'Usuario';
    const salud = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${salud}, ${userName} `;
  };
}

if (typeof window._uiClick !== 'function') {
  window._uiClick = function(type) {
    try {
      // No-op safe shim: if sounds.js loads later it will overwrite this
      if (type === 'nav') return;
      return;
    } catch (e) {}
  };
}
function dbSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) {
    const isQuota = e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014;
    console.warn('Storage error', e);
    if (isQuota) {
      _showStorageWarning('No se pudo guardar: almacenamiento lleno. Elimina notas/imagenes pesadas o exporta respaldo.');
    } else {
      _showStorageWarning('No se pudo guardar localmente. Revisa permisos de almacenamiento del navegador.');
    }
  }
}

(function _stripDemoCourses() {
  const DEMO_IDS = new Set(['mat1','mat2','mat3','mat4','mat5','mat6']);
  const MIGRATION_KEY = 'academia_v84_demo_stripped';
  if (localStorage.getItem(MIGRATION_KEY)) return;
  try {
    const raw = localStorage.getItem('academia_v4_semestres');
    if (!raw) { localStorage.setItem(MIGRATION_KEY,'1'); return; }
    const sems = JSON.parse(raw);
    let changed = false;
    sems.forEach(s => {
      const before = (s.materias||[]).length;
      s.materias = (s.materias||[]).filter(m => !DEMO_IDS.has(m.id));

      if (s.grades) DEMO_IDS.forEach(id => { delete s.grades[id]; });
      if (s.tasks)  s.tasks = s.tasks.filter(t => !DEMO_IDS.has(t.matId));
      if ((s.materias||[]).length !== before) changed = true;
    });
    if (changed) localStorage.setItem('academia_v4_semestres', JSON.stringify(sems));
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch(e) { console.warn('Demo strip failed', e); }
})();

function _buildDefaultSemester(id, nombre) {
  return {
    id,
    nombre,
    activo: true,
    cerrado: false,
    promedioObjetivo: 70,
    prevAvg:  0,
    prevCred: 0,
    materias:   [],
    grades:     {},
    tasks:      [],
    events:     [],
    topics:     [],
    notes:      {},
    notesArray: [],
    flashcards: [],   // ← agregado
  };
}

function _migrateLegacyData() {

  const oldMats = dbGet('academia_v3_materias', null);
  const sem = _buildDefaultSemester('sem_' + Date.now(), '1er Año · 2do Sem');
  sem.materias = oldMats || DEFAULT_MATERIAS;
  sem.grades   = dbGet('academia_v3_grades',  {});
  sem.tasks    = dbGet('academia_v3_tasks',   []);
  sem.events   = dbGet('academia_v3_events',  []);
  sem.topics   = dbGet('academia_v3_topics',  []);
  return [sem];
}

let _rawSemestres = dbGet(DB_KEYS.SEMESTRES, null);
if (!_rawSemestres || !Array.isArray(_rawSemestres) || !_rawSemestres.length) {
  _rawSemestres = _migrateLegacyData();
  dbSet(DB_KEYS.SEMESTRES, _rawSemestres);
}

if (!_rawSemestres.some(s => s.activo)) _rawSemestres[0].activo = true;

const State = {

  semestres: _rawSemestres,

  get _activeSem() {
    return this.semestres.find(s => s.activo) || this.semestres[0];
  },

  get materias()    { return this._activeSem.materias;           },
  set materias(v)   { this._activeSem.materias = v;              },
  get grades()      { return this._activeSem.grades;             },
  set grades(v)     { this._activeSem.grades   = v;              },
  get tasks()       { return this._activeSem.tasks;              },
  set tasks(v)      { this._activeSem.tasks    = v;              },
  get events()      { return this._activeSem.events;             },
  set events(v)     { this._activeSem.events   = v;              },
  get topics()      { return this._activeSem.topics;             },
  set topics(v)     { this._activeSem.topics   = v;              },
  get notes()       { return this._activeSem.notes  || (this._activeSem.notes = {}); },
  set notes(v)      { this._activeSem.notes    = v;              },
  get notesArray()  { return this._activeSem.notesArray || (this._activeSem.notesArray = []); },
  set notesArray(v) { this._activeSem.notesArray = v;            },
  get flashcards()  { return this._activeSem.flashcards || (this._activeSem.flashcards = []); },
  set flashcards(v) { this._activeSem.flashcards = v;            },

  pomSessions: (() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(DB_KEYS.POM_DATE) !== today) {
      dbSet(DB_KEYS.POM_TODAY, []); dbSet(DB_KEYS.POM_DATE, today); return [];
    }
    return dbGet(DB_KEYS.POM_TODAY, []);
  })(),
  pomHistory: dbGet(DB_KEYS.POM_HISTORY, {}),
  pomSnapshots: dbGet(DB_KEYS.POM_SNAPSHOTS, {}),
  settings: { ...DEFAULT_SETTINGS, ...dbGet(DB_KEYS.SETTINGS, {}) },
};

if ((!State.pomSessions || !State.pomSessions.length) && State.settings?.pomData?.date === new Date().toDateString()) {
  State.pomSessions = Array.isArray(State.settings.pomData.today) ? State.settings.pomData.today : [];
}
if ((!State.pomHistory || !Object.keys(State.pomHistory).length) && State.settings?.pomData?.history) {
  State.pomHistory = State.settings.pomData.history;
}
if ((!State.pomSnapshots || !Object.keys(State.pomSnapshots).length) && State.settings?.pomData?.snapshots) {
  State.pomSnapshots = State.settings.pomData.snapshots;
}

if (!State.settings.pomDailyGoal || Number.isNaN(Number(State.settings.pomDailyGoal))) {
  State.settings.pomDailyGoal = 4;
}

/* ─── Debounced save: batches rapid saveState calls into one write every 400ms ─── */
let _saveTimer = null;
let _pendingKeys = new Set();
// Delta sync: rastrear campos específicos que cambiaron
let _changedFields = new Set();

// Guard para evitar que el sync de Supabase sobreescriba cambios locales recientes
window._localModifiedAt = 0;

// Exponer utilidades globalmente para uso en otros módulos
window.deepMerge = deepMerge;
window.subscribe = subscribe;
window.notify = notify;
window.getNetworkQuality = getNetworkQuality;
window.getDynamicDebounceDelay = getDynamicDebounceDelay;

function saveState(keys = ['all']) {
  // 🔥 VALIDACIÓN CRÍTICA antes de guardar
  if (!State || !State.semestres || !Array.isArray(State.semestres)) {
    console.error('❌ Estado inválido en saveState - State o semestres corrupto');
    if (typeof _appNotify === 'function') {
      _appNotify('Error crítico: Estado corrupto. Recarga la página.', 'error');
    }
    return;
  }
  
  // Validar semestre activo
  const activeSem = State._activeSem;
  if (!activeSem || !activeSem.id) {
    console.error('❌ Semestre activo inválido en saveState');
    // Intentar recuperar semestre activo
    const validSem = State.semestres.find(s => s && s.id && s.activo);
    if (validSem) {
      State._activeSem = validSem;
      console.log('✅ Semestre activo recuperado:', validSem.id);
    } else {
      console.error('❌ No se pudo recuperar semestre activo');
      return;
    }
  }
  
  window._localModifiedAt = Date.now(); // marcar modificación local
  keys.forEach(k => {
    _pendingKeys.add(k);
    // Mapear keys a campos específicos para delta sync
    if (k === 'all') {
      _changedFields.add('semestres');
      _changedFields.add('settings');
    } else if (k === 'semestres') {
      _changedFields.add('semestres');
    } else if (k === 'settings') {
      _changedFields.add('settings');
    } else if (k === 'materias' || k === 'grades' || k === 'topics') {
      _changedFields.add('semestres');
    } else if (k === 'tasks') {
      _changedFields.add('semestres');
    } else if (k === 'events') {
      _changedFields.add('semestres'); // 🔥 FIX: events está en el semestre, no en settings
    }
  });
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 3000);
}
function _flushSave() {
  const keys = [..._pendingKeys]; _pendingKeys.clear(); _saveTimer = null;
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
  // Guardar en Supabase con delta sync
  const db = _getAcademiaDB();
  if (db && db._ready) {
    const changedFields = [..._changedFields];
    _changedFields.clear();
    db.save(State.semestres, State.settings, changedFields);
  }
}
function saveStateNow(keys = ['all']) {
  window._localModifiedAt = Date.now(); // marcar modificación local
  clearTimeout(_saveTimer); _pendingKeys.clear();
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
  // Guardar en Supabase inmediatamente con delta sync
  const db = _getAcademiaDB();
  if (db && db._ready) {
    // Mapeo correcto de keys a changedFields para sync
    const changedFields = keys.includes('all') ? ['semestres', 'settings'] :
                          keys.includes('semestres') ? ['semestres'] :
                          keys.includes('settings') ? ['settings'] :
                          keys.includes('tasks') ? ['semestres'] :
                          keys.includes('events') ? ['semestres'] : // 🔥 FIX: events está en el semestre
                          keys.includes('materias') ? ['semestres'] :
                          keys.includes('grades') ? ['semestres'] :
                          keys.includes('topics') ? ['semestres'] : [];
    db.saveNow(State.semestres, State.settings, changedFields);
  }
}
function savePom() {
  dbSet(DB_KEYS.POM_TODAY, State.pomSessions);
  dbSet(DB_KEYS.POM_DATE, new Date().toDateString());
  dbSet(DB_KEYS.POM_HISTORY, State.pomHistory || {});
  dbSet(DB_KEYS.POM_SNAPSHOTS, State.pomSnapshots || {});
  State.settings.pomData = {
    today: State.pomSessions,
    date: new Date().toDateString(),
    history: State.pomHistory || {},
    snapshots: State.pomSnapshots || {},
    goal: Number(State.settings.pomDailyGoal) || 4,
    updatedAt: Date.now(),
  };
  saveState(['settings']);
}

function savePomRunning(payload) {
  if (!payload) {
    localStorage.removeItem(DB_KEYS.POM_RUNNING);
    return;
  }
  dbSet(DB_KEYS.POM_RUNNING, payload);
}

function loadPomRunning() {
  return dbGet(DB_KEYS.POM_RUNNING, null);
}

function getActiveSem() { return State._activeSem; }
// ─── Migración única: mueve flashcards de la key vieja a State.flashcards ───
(function _migrateFlashcards() {
  const MIGRATION_KEY = 'academia_fc_migrated_v1';
  if (localStorage.getItem(MIGRATION_KEY)) return; // ya se hizo
 
  try {
    const old = localStorage.getItem('academia_flashcards');
    if (old) {
      const oldCards = JSON.parse(old);
      if (Array.isArray(oldCards) && oldCards.length > 0) {
        // Fusionar con las que ya estén en State (por si acaso)
        const existing = State.flashcards || [];
        const existingIds = new Set(existing.map(c => c.id));
        const toAdd = oldCards.filter(c => !existingIds.has(c.id));
        State.flashcards = [...existing, ...toAdd];
        dbSet(DB_KEYS.SEMESTRES, State.semestres);
        console.log(`✅ Migradas ${toAdd.length} flashcards al State`);
      }
    }
  } catch (e) {
    console.warn('Error en migración de flashcards:', e);
  }
 
  localStorage.setItem(MIGRATION_KEY, '1');
})();