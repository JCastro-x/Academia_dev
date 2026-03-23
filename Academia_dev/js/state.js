/* ─── DOM Cache: cache frequently-accessed nodes once at startup ─── */
const _DOM = {};
function _el(id) {
  if (!_DOM[id]) _DOM[id] = document.getElementById(id);
  return _DOM[id];
}
function _clearDOMCache() { for (const k in _DOM) delete _DOM[k]; }

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

const DB_KEYS = {
  SEMESTRES: 'academia_v4_semestres',
  POM_TODAY: 'academia_v3_pom_today',
  POM_DATE:  'academia_v3_pom_date',
  SETTINGS:  'academia_v3_settings',
};

// ─── IndexedDB for large image data ────────────────────────────
let _idb = null;
function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('academia_images', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('images'); };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}
async function idbSetImage(key, dataUrl) {
  try {
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readwrite');
      tx.objectStore('images').put(dataUrl, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  } catch(e) { console.warn('IDB set error', e); return false; }
}
async function idbGetImage(key) {
  try {
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readonly');
      const req = tx.objectStore('images').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch(e) { return null; }
}
async function idbDeleteImage(key) {
  try {
    const db = await _openIDB();
    return new Promise((res) => {
      const tx = db.transaction('images','readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete = () => res(true);
    });
  } catch(e) { return false; }
}

const DEFAULT_MATERIAS = [];

const DEFAULT_SETTINGS = { minGrade: 70, theme: 'dark', semester: '1er Año · 2do Sem', font: 'Syne', soundVariant: 'classic', accentColor: '#7c6aff' };

function dbGet(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function dbSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('Storage error', e); }
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
    materias:  [],
    grades:    {},
    tasks:     [],
    events:    [],
    topics:    [],
    notes:     {},
    notesArray: [],
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

  pomSessions: (() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(DB_KEYS.POM_DATE) !== today) {
      dbSet(DB_KEYS.POM_TODAY, []); dbSet(DB_KEYS.POM_DATE, today); return [];
    }
    return dbGet(DB_KEYS.POM_TODAY, []);
  })(),
  settings: { ...DEFAULT_SETTINGS, ...dbGet(DB_KEYS.SETTINGS, {}) },
};

/* ─── Debounced save: batches rapid saveState calls into one write every 400ms ─── */
let _saveTimer = null;
let _pendingKeys = new Set();
function saveState(keys = ['all']) {
  keys.forEach(k => _pendingKeys.add(k));
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 400);
}
function _flushSave() {
  const keys = [..._pendingKeys]; _pendingKeys.clear(); _saveTimer = null;
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
  // Guardar en Supabase
  if (window.DB && window.DB._ready) {
    window.DB.save(State.semestres, State.settings);
  }
}
function saveStateNow(keys = ['all']) {
  clearTimeout(_saveTimer); _pendingKeys.clear();
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
  // Guardar en Supabase inmediatamente
  if (window.DB && window.DB._ready) {
    window.DB.saveNow(State.semestres, State.settings);
  }
}
function savePom() {
  dbSet(DB_KEYS.POM_TODAY, State.pomSessions);
  dbSet(DB_KEYS.POM_DATE, new Date().toDateString());
}

function getActiveSem() { return State._activeSem; }
