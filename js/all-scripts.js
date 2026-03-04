

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
}
function saveStateNow(keys = ['all']) {
  clearTimeout(_saveTimer); _pendingKeys.clear();
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
}
function savePom() {
  dbSet(DB_KEYS.POM_TODAY, State.pomSessions);
  dbSet(DB_KEYS.POM_DATE, new Date().toDateString());
}

function getActiveSem() { return State._activeSem; }

function switchSemester(id) {
  State.semestres.forEach(s => { s.activo = (s.id === id); });
  saveStateNow(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function createSemester(nombre, promedioObjetivo) {
  State.semestres.forEach(s => s.activo = false);
  const sem = _buildDefaultSemester('sem_' + Date.now(), nombre || 'Nuevo Semestre');
  sem.promedioObjetivo = parseFloat(promedioObjetivo) || 70;
  State.semestres.push(sem);
  saveState(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function closeSemester(id) {
  const s = State.semestres.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`¿Cerrar el semestre "${s.nombre}"? Quedará archivado y no podrás editarlo.`)) return;
  s.cerrado = true;
  s.activo  = false;

  const open = State.semestres.filter(x => !x.cerrado);
  if (open.length) open[open.length - 1].activo = true;
  saveState(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function _refreshAllViews() {
  try {
    fillMatSels(); fillTopicMatSel(); fillPomSel(); fillNotesSel(); fillExamSel();
    renderOverview(); renderMaterias(); renderGrades();
    renderTasks(); renderCalendar(); updateBadge();
    renderSemestresList();
    updateGPADisplay();
  } catch(e) {  }
}

function parseCredits(credStr) {
  if (!credStr) return 0;
  const n = parseFloat(String(credStr).replace(/[^0-9.]/g,''));
  return isNaN(n) ? 0 : n;
}

function calcSemesterGPA(semId) {
  const sem = State.semestres.find(s => s.id === semId) || State._activeSem;
  const min = State.settings.minGrade || 70;
  const roots = sem.materias.filter(m => !m.parentId);

  let weightedSum = 0, totalCred = 0, creditosAprobados = 0;
  const materiaStats = roots.map(m => {
    const cred = parseCredits(m.credits);

    const savedActive = State.semestres.find(s => s.activo);

    const mGrades = sem.grades || {};
    let total = 0, filled = 0;
    if (m.zones) {
      m.zones.forEach(z => {
        if (z.isLabZone) {

          const lab = sem.materias.find(x => x.id === m.linkedLabId);
          if (lab) {
            let labGrade = mGrades[lab.id]?.nota ?? '';
            if (labGrade === '' && lab.zones?.[0]?.subs?.[0])
              labGrade = mGrades[lab.id]?.[lab.zones[0].subs[0].key] ?? '';
            if (labGrade !== '' && labGrade != null) {
              const scale  = m.labScale || 100;
              const maxPts = m.labMaxPts || 10;
              const net    = (Math.min(parseFloat(labGrade)||0, scale) / scale) * maxPts;
              total += Math.min(net, z.maxPts); filled++;
            }
          }
        } else {
          z.subs.forEach(s => {
            const v = mGrades[m.id]?.[s.key] ?? '';
            if (v !== '') { total += Math.min((parseFloat(v)||0)/100 * s.maxPts, s.maxPts); filled++; }
          });
        }
      });
    }
    const maxTotal = (m.zones||[]).reduce((a,z)=>a+z.maxPts,0) || 100;
    const nota     = filled ? total : null;
    const aprobado = nota !== null && nota >= min;
    if (nota !== null) {
      weightedSum     += nota * cred;
      totalCred       += cred;
      if (aprobado) creditosAprobados += cred;
    } else {
      totalCred += cred;
    }
    return { materia: m, nota, cred, maxTotal, aprobado };
  });

  const promedioSemestre = totalCred > 0 ? weightedSum / totalCred : null;
  return { promedioSemestre, totalCreditos: totalCred, creditosAprobados, materiaStats };
}

function calcOverallGPA() {
  const s        = State._activeSem;
  const prevAvg  = parseFloat(s.prevAvg)  || 0;
  const prevCred = parseFloat(s.prevCred) || 0;
  const g        = calcSemesterGPA(s.id);
  const semCred  = g.totalCreditos;
  const semAvg   = g.promedioSemestre;
  const totalCred   = prevCred + semCred;
  const approvedCred= prevCred + g.creditosAprobados;
  const overallAvg  =
    totalCred > 0 && (prevCred > 0 || semAvg !== null)
      ? (prevAvg * prevCred + (semAvg || 0) * semCred) / totalCred
      : semAvg;
  return { overallAvg, totalCred, approvedCred, semAvg, semCred };
}

function exportData() {
  const blob = new Blob([JSON.stringify({
    version: 4, exportedAt: new Date().toISOString(),
    semestres: State.semestres,
    settings:  State.settings,
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'academia-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);

    if (data.semestres && Array.isArray(data.semestres)) {
      State.semestres = data.semestres;
      if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
    } else if (data.materias) {

      const sem = _buildDefaultSemester('sem_legacy', 'Importado');
      sem.activo   = true;
      sem.materias = data.materias;
      sem.grades   = data.grades  || {};
      sem.tasks    = data.tasks   || [];
      sem.events   = data.events  || [];
      sem.topics   = data.topics  || [];
      State.semestres = [sem];
    } else throw new Error('Formato inválido');
    if (data.settings) State.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    saveState(['all']);
    return { ok: true, msg: 'Datos importados correctamente.' };
  } catch(e) { return { ok: false, msg: 'Error al importar: ' + e.message }; }
}

function exportPDF() {
  // Build a clean printable HTML report with only grades + GPA data
  const sem = getActiveSem ? getActiveSem() : (State.semestres?.find(s=>s.activo));
  const semName = sem?.nombre || 'Semestre';
  const mats = State.materias || [];
  const gpa  = calcOverallGPA ? calcOverallGPA() : {};
  const minG = parseFloat(document.getElementById('min-grade')?.value) || (State.settings?.minGrade || 70);

  let rows = '';
  mats.forEach(mat => {
    const t = calcTotal ? calcTotal(mat.id) : null;
    const avg = t ? t.total : null;
    const color = avg !== null ? (avg >= minG ? '#16a34a' : '#dc2626') : '#6b7280';
    const zones = mat.zones || [];
    let zoneRows = '';
    zones.forEach(z => {
      const pts = (State.grades?.[mat.id]?.[z.key] ?? '');
      const net = pts !== '' ? (parseFloat(pts)/100 * z.maxPts).toFixed(2) : '—';
      zoneRows += `<tr><td style="padding:4px 10px;color:#555;font-size:12px;">${z.label}</td><td style="text-align:center;font-size:12px;">${pts !== '' ? pts+'%' : '—'}</td><td style="text-align:center;font-size:12px;">${net !== '—' ? net+' / '+z.maxPts : '—'}</td></tr>`;
    });
    rows += `
      <tr style="background:#f8f8ff;">
        <td style="padding:8px 10px;font-weight:700;font-size:13px;border-left:3px solid ${mat.color||'#7c6aff'};">${mat.nombre}</td>
        <td style="text-align:center;font-weight:700;color:${color};font-size:13px;">${avg !== null ? avg.toFixed(1) : '—'}</td>
        <td style="text-align:center;font-size:12px;color:#555;">${mat.creditos || '—'} cr.</td>
        <td style="font-size:12px;color:#555;">${mat.seccion||''} ${mat.catedratico ? '· '+mat.catedratico : ''}</td>
      </tr>
      ${zoneRows ? `<tr><td colspan="4" style="padding:0 10px 6px 24px;"><table style="width:100%;border-collapse:collapse;">${zoneRows}</table></td></tr>` : ''}`;
  });

  const overallAvg = gpa.overallAvg !== null && gpa.overallAvg !== undefined ? gpa.overallAvg.toFixed(2) : '—';
  const semAvg     = gpa.semAvg     !== null && gpa.semAvg !== undefined     ? gpa.semAvg.toFixed(2)     : (calcSemesterGPA ? calcSemesterGPA(sem?.id)?.promedioSemestre?.toFixed(2) : '—');

  const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte Académico — ${semName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: 'Segoe UI', sans-serif; color:#1a1a2e; background:#fff; padding:32px 40px; }
  h1  { font-size:22px; font-weight:800; color:#1a1a2e; margin-bottom:4px; }
  .sub { font-size:13px; color:#666; margin-bottom:24px; }
  .gpa-row { display:flex; gap:24px; margin-bottom:28px; flex-wrap:wrap; }
  .gpa-box { background:#f5f3ff; border:1px solid #c4b5fd; border-radius:10px; padding:14px 20px; min-width:130px; }
  .gpa-lbl { font-size:10px; color:#7c3aed; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; margin-bottom:4px; }
  .gpa-val { font-size:28px; font-weight:800; color:#4c1d95; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1a1a2e; color:#fff; padding:9px 10px; font-size:11px; letter-spacing:1px; text-align:left; }
  tr + tr { border-top:1px solid #e5e7eb; }
  .footer { margin-top:28px; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { padding:16px 24px; } }
</style>
</head><body>
<h1>📊 Reporte Académico</h1>
<div class="sub">${semName} · Generado el ${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
<div class="gpa-row">
  <div class="gpa-box"><div class="gpa-lbl">Promedio Semestre</div><div class="gpa-val">${semAvg || '—'}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Promedio Global</div><div class="gpa-val">${overallAvg}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Materias</div><div class="gpa-val">${mats.length}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Mínimo aprobatorio</div><div class="gpa-val">${minG}</div></div>
</div>
<table>
  <thead><tr><th>Materia</th><th style="text-align:center;">Promedio</th><th style="text-align:center;">Créditos</th><th>Catedrático / Sección</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Academia Dashboard · academia.app</div>
window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const win = window.open('','_blank','width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback: blob download
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${semName.replace(/\s+/g,'_')}.html`;
    a.click();
  }
}




function pctToNet(pct, maxPts)  { return (parseFloat(pct) || 0) / 100 * maxPts; }
function compColor(v)           { return v >= 80 ? '#4ade80' : v >= 60 ? '#fbbf24' : '#f87171'; }
function barColor(v)            { return v >= 80 ? '#4ade80' : v >= 50 ? '#fbbf24' : '#f87171'; }
function getMat(id) {
  if (!getMat._cache) getMat._cache = Object.create(null);
  if (getMat._cache[id]) return getMat._cache[id];
  const m = State.materias.find(m => m.id === id);
  getMat._cache[id] = m || {};
  return getMat._cache[id];
}
getMat.bust = function() { getMat._cache = Object.create(null); };
function getG(matId, key)       { return State.grades[matId]?.[key] ?? ''; }
function setG(matId, key, val) {
  if (!State.grades[matId]) State.grades[matId] = {};
  const num = val === '' ? '' : Math.min(Math.max(parseFloat(val) || 0, 0), 100);
  State.grades[matId][key] = num;
  saveState(['grades']);
  _updateGradeSummary(matId);
  renderMaterias();
  renderOverview();
}

// Live update % and pts columns in the grade row without full re-render
function _liveUpdateGradeRow(inp) {
  const pctVal = inp.value !== '' ? Math.min(parseFloat(inp.value) || 0, 100) : null;
  const maxPts = parseFloat(inp.dataset.maxpts) || 0;
  const netPts = pctVal !== null ? pctVal / 100 * maxPts : null;
  const row    = inp.closest('.grade-row');
  if (!row) return;
  const color = netPts !== null ? compColor(netPts / maxPts * 100) : '#5a5a72';
  const pctEl = row.querySelector('.grade-pct');
  const netEl = row.querySelector('.grade-net');
  const fill  = row.querySelector('.prog-fill');
  if (pctEl) { pctEl.textContent = pctVal !== null ? pctVal.toFixed(0)+'%' : '—'; pctEl.style.color = color; }
  if (netEl) { netEl.textContent = netPts !== null ? netPts.toFixed(2) : '—'; netEl.style.color = color; }
  if (fill)  { fill.style.background = color; fill.style.width = netPts !== null ? Math.min(netPts/maxPts*100,100)+'%' : '0%'; }
}

function _updateGradeSummary(matId) {
  const mat = getMat(matId);
  if (!mat || !mat.zones) return;
  const minG = parseFloat(document.getElementById('min-grade')?.value) || 70;

  let grandTotal = 0, grandMax = 0, anyFilled = false;

  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { grandTotal += Math.min(ld.netPts, z.maxPts); anyFilled = true; }
      grandMax += z.maxPts;
      return;
    }
    let zTotal = 0, zAny = false;
    z.subs.forEach(s => {
      const v = getG(matId, s.key);
      if (v !== '') { zTotal += Math.min(pctToNet(v, s.maxPts), s.maxPts); zAny = true; anyFilled = true; }
    });
    grandTotal += zTotal;
    grandMax   += z.maxPts;

    const subEl = document.querySelector(`[data-zone-subtotal="${matId}-${z.key}"]`);
    if (subEl && zAny) {
      const c = compColor(z.maxPts ? zTotal/z.maxPts*100 : 0);
      subEl.innerHTML = `<span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">SUBTOTAL</span>
        <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:800;color:${c};">${zTotal.toFixed(2)} / ${z.maxPts} pts</span>`;
    }
  });

  const totEl = document.querySelector(`[data-mat-total="${matId}"]`);
  if (totEl && anyFilled) {
    const sc = compColor(grandMax ? grandTotal/grandMax*100 : 0);
    totEl.style.color = sc;
    totEl.childNodes[0].textContent = grandTotal.toFixed(2);
  }
}

function getLabNetPts(mat) {
  if (!mat.linkedLabId) return null;
  const lab = getMat(mat.linkedLabId);
  if (!lab?.zones) return null;

  let labGrade = getG(lab.id, 'nota');
  if (labGrade === '') {

    if (lab.zones[0]?.subs?.[0]) labGrade = getG(lab.id, lab.zones[0].subs[0].key);
  }
  if (labGrade === '' || labGrade == null) return null;
  const scale     = mat.labScale  || lab.labScale  || 100;
  const maxPts    = mat.labMaxPts || lab.labMaxPts || 10;
  const labPct    = Math.min(parseFloat(labGrade) || 0, scale);
  const netPts    = (labPct / scale) * maxPts;
  return { netPts, labGrade: labPct, labScale: scale, labMaxPts: maxPts };
}

function calcTotal(matId) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let total = 0, filled = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { total += Math.min(ld.netPts, z.maxPts); filled++; }
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') { total += Math.min(pctToNet(v, s.maxPts), s.maxPts); filled++; }
      });
    }
  });
  if (!filled) return null;
  const maxTotal = mat.zones.reduce((a, z) => a + z.maxPts, 0);
  return { total, maxTotal, pct: total / maxTotal * 100 };
}

function calcProjected(matId) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let earned = 0, potential = 0, filledPts = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { earned += ld.netPts; filledPts += z.maxPts; }
      potential += z.maxPts;
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') {
          const net = Math.min(pctToNet(v, s.maxPts), s.maxPts);
          earned += net; filledPts += s.maxPts;
        }
        potential += s.maxPts;
      });
    }
  });
  if (!filledPts) return null;
  const avgRate = earned / filledPts;
  const remaining = potential - filledPts;
  return { projected: earned + avgRate * remaining, maxTotal: potential };
}

function calcMinNeeded(matId, targetPts) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let earned = 0, remainingMax = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) earned += ld.netPts;
      else remainingMax += z.maxPts;
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') earned += Math.min(pctToNet(v, s.maxPts), s.maxPts);
        else remainingMax += s.maxPts;
      });
    }
  });
  if (remainingMax === 0) return null;
  const needed = targetPts - earned;
  return { needed, remainingMax, pct: (needed / remainingMax) * 100 };
}

function renderGrades() { _schedRender(_renderGrades); }
function _renderGrades() {
  // If in index mode (no mat selected), render card grid
  if (!_gradesDetailMatId) {
    _renderGradeCards();
    return;
  }
  // Detail mode: render only selected mat
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const container = _el('grades-container');
  if (!container) return;
  container.innerHTML = '';

  const USAC_ZONA_MIN = 36;
  const USAC_GANADA   = 61;

  const materiasToShow = _gradesDetailMatId
    ? State.materias.filter(m => m.id === _gradesDetailMatId)
    : State.materias;

  materiasToShow.forEach(mat => {
    const t     = calcTotal(mat.id);
    const total = t ? t.total : 0;
    const maxT  = mat.zones.reduce((a, z) => a + z.maxPts, 0);
    const pct   = t ? t.pct : 0;
    const sc    = t ? (total >= min ? '#4ade80' : total >= min * .8 ? '#fbbf24' : '#f87171') : '#5a5a72';
    const sl    = t ? (total >= min ? '✓ Aprobado' : total >= min * .8 ? '⚠ En zona' : '✗ En riesgo') : 'Sin datos';
    const proj  = calcProjected(mat.id);
    const minN  = calcMinNeeded(mat.id, min);

    const isUSAC       = maxT >= 80 && maxT <= 120;
    const zonaMinOk    = t && total >= USAC_ZONA_MIN;
    const isGanada     = t && total >= USAC_GANADA;

    let faltaParaGanar = null;
    if (t && !isGanada && zonaMinOk) {
      const minFinal = calcMinNeeded(mat.id, USAC_GANADA);
      if (minFinal) faltaParaGanar = minFinal;
    }

    const wrap = document.createElement('div');
    wrap.id = 'grades-mat-' + mat.id;
    wrap.className = 'grades-block';
    wrap.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:22px;';
    if (isGanada) wrap.style.borderColor = '#4ade80';

    let parentBadge = '', labBadge = '';
    if (mat.parentId)    parentBadge = `<span class="lab-parent-badge">🔗 Lab de: ${getMat(mat.parentId).name||''}</span>`;
    if (mat.linkedLabId) labBadge    = `<span class="lab-link-badge">🧪 Lab: ${getMat(mat.linkedLabId).name||''}</span>`;

    wrap.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);border-left:4px solid ${isGanada?'#4ade80':mat.color};display:flex;align-items:center;gap:14px;">
        <div style="flex:1;">
          <div style="font-size:17px;font-weight:800;">${mat.icon||'📚'} ${mat.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:2px;">${mat.code} ${parentBadge} ${labBadge}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:9px;">
            <div class="prog-bar" style="flex:1;max-width:220px;">
              <div class="prog-fill" style="background:${isGanada?'#4ade80':mat.color};width:${Math.min(pct,100)}%;"></div>
            </div>
            <span style="font-size:11px;font-family:'Space Mono',monospace;color:${isGanada?'#4ade80':mat.color};">${pct.toFixed(1)}%</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:34px;font-weight:800;color:${isGanada?'#4ade80':sc};">${t ? total.toFixed(2) : '—'}</div>
          <div style="font-size:11px;color:var(--text3);">de ${maxT} pts</div>
          <div style="font-size:12px;font-weight:700;color:${isGanada?'#4ade80':sc};margin-top:3px;">${isGanada?'🏆 GANADA':sl}</div>
        </div>
      </div>`;

    if (t) {
      const milestoneEl = document.createElement('div');
      milestoneEl.style.cssText = 'padding:10px 20px;border-bottom:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;align-items:center;';
      if (isGanada) {
        milestoneEl.innerHTML = `<div class="usac-won">🎉 ¡CLASE GANADA! Tienes ${total.toFixed(2)} pts — aprobaste sin necesidad de examen final.</div>`;
      } else if (zonaMinOk && faltaParaGanar) {
        const faltaN = faltaParaGanar.needed;
        const pctN   = faltaParaGanar.pct;
        const color  = pctN <= 100 ? '#fbbf24' : '#f87171';
        const msg    = pctN <= 100
          ? `Necesitas ${faltaN.toFixed(1)} pts más (${pctN.toFixed(0)}% de lo que queda) para ganar`
          : 'Ya no es posible llegar a 61 pts — estudia para el mínimo';
        milestoneEl.innerHTML = `
          <div class="usac-zona-min-ok">✅ Zona mínima alcanzada (${total.toFixed(1)}/36)</div>
          <div class="usac-falta-examen">🎯 ${msg}</div>`;
      } else if (!zonaMinOk) {
        const faltaZona = USAC_ZONA_MIN - total;
        milestoneEl.innerHTML = `<div class="usac-zona-min-no">⚠️ Faltan ${faltaZona.toFixed(1)} pts para zona mínima (36 pts)</div>`;
      }
      wrap.appendChild(milestoneEl);
    }

    if (proj || minN) {
      const projEl = document.createElement('div');
      projEl.style.cssText = 'display:flex;gap:0;border-bottom:1px solid var(--border);';
      let _ph = '';
      if (proj) {
        const projColor = proj.projected >= min ? '#4ade80' : proj.projected >= min*.8 ? '#fbbf24' : '#f87171';
        _ph += `<div style="flex:1;padding:10px 20px;border-right:1px solid var(--border);">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">📈 NOTA PROYECTADA</div>
          <div style="font-size:20px;font-weight:800;color:${projColor};">${proj.projected.toFixed(2)}<span style="font-size:11px;color:var(--text3);"> / ${proj.maxTotal}</span></div>
        </div>`;
      }
      if (minN && minN.needed > 0) {
        const mnColor = minN.pct <= 100 ? '#fbbf24' : '#f87171';
        const mnMsg   = minN.pct <= 100 ? `Necesitas ${minN.pct.toFixed(0)}% en lo que queda` : 'Ya no es posible alcanzar el mínimo';
        _ph += `<div style="flex:1;padding:10px 20px;">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">⚠️ MÍNIMO NECESARIO</div>
          <div style="font-size:13px;font-weight:700;color:${mnColor};">${mnMsg}</div>
        </div>`;
      } else if (minN && minN.needed <= 0) {
        _ph += `<div style="flex:1;padding:10px 20px;">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">✅ ESTADO</div>
          <div style="font-size:13px;font-weight:700;color:#4ade80;">¡Ya alcanzaste el mínimo para aprobar!</div>
        </div>`;
      }
      projEl.innerHTML = _ph;
      wrap.appendChild(projEl);
    }

    const body = document.createElement('div');
    body.style.cssText = 'display:grid;grid-template-columns:1fr 220px;';

    const zonesDiv = document.createElement('div');
    zonesDiv.style.cssText = 'padding:16px 20px;';

    mat.zones.forEach(z => {
      const zBlock = document.createElement('div');
      zBlock.className = 'zone-block';

      if (z.isLabZone) {
        const ld = getLabNetPts(mat);
        zBlock.innerHTML = `
          <div class="zone-header" style="background:rgba(74,222,128,.05);">
            <span class="zone-title" style="color:#4ade80;">🧪 ${z.label}</span>
            <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);">máx <strong style="color:#4ade80;">${z.maxPts}</strong> pts · auto</span>
          </div>
          <div class="zone-body">${ld
            ? `<div class="linked-info">🔗 Auto del lab — ${ld.labGrade.toFixed(0)}/${ld.labScale} → <strong>${ld.netPts.toFixed(2)}/${ld.labMaxPts} pts</strong></div>`
            : `<div style="font-size:11px;color:var(--text3);padding:10px;background:var(--surface2);border-radius:7px;">🧪 Ingresa la nota en la sección del lab para verla aquí automáticamente.</div>`
          }</div>`;
        zonesDiv.appendChild(zBlock);
        return;
      }

      const subData = z.subs.map(s => {
        const v      = getG(mat.id, s.key);
        const pctVal = v !== '' ? Math.min(parseFloat(v) || 0, 100) : null;
        const netPts = pctVal !== null ? pctToNet(pctVal, s.maxPts) : null;
        return { v, pctVal, netPts, key: s.key, label: s.label, maxPts: s.maxPts };
      });
      const zFilledData = subData.filter(d => d.netPts !== null);
      const zTotal  = zFilledData.reduce((a, d) => a + d.netPts, 0);
      const zFilled = zFilledData.length;
      const zPct    = z.maxPts > 0 ? zTotal / z.maxPts * 100 : 0;
      const zColor  = zFilled ? compColor(zPct) : '#5a5a72';

      const hdr = document.createElement('div');
      hdr.className = 'zone-header';
      hdr.style.background = `rgba(100,100,100,.04)`;
      hdr.innerHTML = `<span class="zone-title" style="color:${z.color};">${z.label}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);">
          máx <strong style="color:${z.color};">${z.maxPts}</strong> pts ·
          obtenido <strong style="color:${zColor};">${zFilled ? zTotal.toFixed(2) : '—'}</strong>
          ${zFilled ? `<span style="color:${zColor};">(${zPct.toFixed(1)}%)</span>` : ''}
        </span>`;
      zBlock.appendChild(hdr);

      const zBody = document.createElement('div');
      zBody.className = 'zone-body';
      zBody.innerHTML = `<div class="input-tip">↓ Ingresa el % que muestra la plataforma (ej: 85 = 85%)</div>`;

      subData.forEach(d => {
        const row = document.createElement('div');
        row.className = 'grade-row';
        const netColor = d.netPts !== null ? compColor(d.netPts / d.maxPts * 100) : '#5a5a72';
        row.setAttribute('data-grade-row', `${mat.id}-${d.key}`);
        row.innerHTML = `
          <div class="grade-label">${d.label} <span style="color:var(--text3);">(/${d.maxPts} pts)</span></div>
          <input type="number" class="grade-input" min="0" max="100" placeholder="%"
            value="${d.v !== '' ? d.v : ''}"
            data-mat="${mat.id}" data-key="${d.key}" data-maxpts="${d.maxPts}"
            oninput="if(parseFloat(this.value)>100){this.value=100;} setG('${mat.id}','${d.key}',this.value); _liveUpdateGradeRow(this);"
            title="Porcentaje 0–100">
          <div class="grade-pct" style="color:${netColor};">${d.pctVal !== null ? d.pctVal.toFixed(0)+'%' : '—'}</div>
          <div class="grade-net" style="color:${netColor};">${d.netPts !== null ? d.netPts.toFixed(2) : '—'}</div>
          <div class="grade-bar">
            <div class="prog-bar"><div class="prog-fill" style="background:${netColor};width:${d.netPts !== null ? Math.min(d.netPts/d.maxPts*100,100) : 0}%;"></div></div>
          </div>`;
        zBody.appendChild(row);
      });

      if (zFilled) {
        const sub = document.createElement('div');
        sub.className = 'zone-subtotal';
        sub.setAttribute('data-zone-subtotal', `${mat.id}-${z.key}`);
        sub.innerHTML = `<span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">SUBTOTAL</span>
          <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:800;color:${zColor};">${zTotal.toFixed(2)} / ${z.maxPts} pts</span>`;
        zBody.appendChild(sub);
      }
      zBlock.appendChild(zBody);
      zonesDiv.appendChild(zBlock);
    });

    body.appendChild(zonesDiv);

    const panel = document.createElement('div');
    panel.style.cssText = 'padding:16px 18px;border-left:1px solid var(--border);background:var(--surface2);';
    let ph = `<div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);letter-spacing:1px;margin-bottom:12px;text-transform:uppercase;">📊 Resumen</div>`;
    mat.zones.forEach(z => {
      let zNet = 0, zAny = false;
      if (z.isLabZone) { const ld = getLabNetPts(mat); if (ld) { zNet = ld.netPts; zAny = true; } }
      else { z.subs.forEach(s => { const v = getG(mat.id, s.key); if (v !== '') { zNet += Math.min(pctToNet(v,s.maxPts),s.maxPts); zAny = true; } }); }
      const zPct2 = z.maxPts > 0 ? zNet / z.maxPts * 100 : 0;
      ph += `<div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:7px;">
        <div style="width:8px;height:8px;border-radius:2px;background:${z.color};flex-shrink:0;"></div>
        <span style="color:var(--text2);flex:1;">${z.label}</span>
        <span style="font-family:'Space Mono',monospace;font-weight:700;color:${zAny ? compColor(zPct2) : '#5a5a72'};">${zAny ? zNet.toFixed(2)+' / '+z.maxPts : '—'}</span>
      </div>`;
    });
    ph += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Total acumulado</div>
      <div style="font-size:28px;font-weight:800;color:${sc};" data-mat-total="${mat.id}">${t ? total.toFixed(2) : '—'}<span style="font-size:12px;color:var(--text3);"> / ${maxT}</span></div>
    </div>
    <div style="margin-top:14px;padding:10px;background:rgba(124,106,255,.06);border:1px solid rgba(124,106,255,.15);border-radius:8px;">
      <div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:1px;margin-bottom:4px;">💡 CÓMO USAR</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6;">Ingresa el <strong style="color:var(--text);">% de la plataforma</strong><br>Ej: <code style="color:var(--accent);background:var(--surface3);padding:1px 4px;border-radius:3px;">85</code> → <strong>85%</strong> → pts netos auto</div>
    </div>`;
    panel.innerHTML = ph;
    body.appendChild(panel);
    wrap.appendChild(body);
    container.appendChild(wrap);
  });
}

function scrollToMat(matId) {
  const el = document.getElementById('grades-mat-' + matId);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}




let editTaskId       = null;
let _editSubtasks    = [];
let _editAttachments = [];
let _editComments    = [];

function fmtD(ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}
function dueClass(due) {
  if (!due) return '';
  const d = (new Date(due) - new Date()) / 86400000;
  return d < 0 ? 'urgent' : d <= 1 ? 'urgent' : d <= 3 ? 'soon' : '';
}
function getTypeBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('tarea'))    return 'tb-tarea';
  if (t.includes('parcial'))  return 'tb-parcial';
  if (t.includes('lab'))      return 'tb-lab';
  if (t.includes('proyecto')) return 'tb-proyecto';
  if (t.includes('quiz'))     return 'tb-quiz';
  if (t.includes('taller'))   return 'tb-taller';
  if (t.includes('hoja'))     return 'tb-hoja';
  if (t.includes('final') || t.includes('examen')) return 'tb-examen';
  return 'tb-default';
}
function subtaskProgress(task) {
  if (!task.subtasks || !task.subtasks.length) return null;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total: task.subtasks.length, pct: Math.round(done / task.subtasks.length * 100) };
}
function prioIcon(p)  { return p === 'high' ? '🔴' : p === 'low' ? '🟢' : '🟡'; }
function prioBadge(p) {
  const cls = p === 'high' ? 'pb-high' : p === 'low' ? 'pb-low' : 'pb-med';
  const lbl = p === 'high' ? 'Alta'    : p === 'low' ? 'Baja'   : 'Media';
  return `<span class="priority-badge ${cls}">${prioIcon(p)} ${lbl}</span>`;
}

function renderSubtasksEditor(list) {
  _editSubtasks = Array.isArray(list) ? list : [];
  const c = document.getElementById('subtasks-editor');
  if (!c) return;
  c.innerHTML = _editSubtasks.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="subtaskEditorToggle(${i})"
        style="accent-color:var(--accent);cursor:pointer;width:15px;height:15px;">
      <input type="text" class="form-input" value="${(s.text||'').replace(/"/g,'&quot;')}"
        oninput="subtaskEditorText(${i},this.value)"
        style="flex:1;padding:5px 8px;font-size:12px;" placeholder="Subtarea...">
      <button class="btn btn-danger btn-sm" onclick="subtaskEditorRemove(${i})" style="padding:3px 8px;">✕</button>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="subtaskEditorAdd()" style="margin-top:4px;font-size:11px;">+ Agregar subtarea</button>`;
}
function subtaskEditorAdd()      { _editSubtasks.push({ text:'', done:false }); renderSubtasksEditor(_editSubtasks); }
function subtaskEditorText(i, v) { if (_editSubtasks[i]) _editSubtasks[i].text = v; }
function subtaskEditorToggle(i)  { if (_editSubtasks[i]) { _editSubtasks[i].done = !_editSubtasks[i].done; renderSubtasksEditor(_editSubtasks); } }
function subtaskEditorRemove(i)  { _editSubtasks.splice(i, 1); renderSubtasksEditor(_editSubtasks); }

function renderAttachmentsEditor(list) {
  _editAttachments = Array.isArray(list) ? list : [];
  const c = document.getElementById('attachments-editor');
  if (!c) return;
  c.innerHTML = _editAttachments.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:7px 10px;background:var(--surface2);border-radius:7px;border:1px solid var(--border);">
      <span style="font-size:18px;">${a.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</span>
      <button class="btn btn-ghost btn-sm" onclick="previewAttachment(${i})" style="font-size:11px;">👁 Ver</button>
      <button class="btn btn-danger btn-sm" onclick="removeAttachment(${i})" style="padding:3px 7px;">✕</button>
    </div>`).join('')
    + `<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-top:4px;font-size:11px;display:inline-flex;align-items:center;gap:5px;">
        📎 Adjuntar archivo
        <input type="file" accept="image/*,.pdf" style="display:none;" onchange="handleAttachmentUpload(this)">
       </label>`;
}
function renderCommentsEditor(list) {
  const c = document.getElementById('comments-editor');
  if (!c) return;
  c.innerHTML = _editComments.map((x, i) => `
    <div style="background:var(--surface2);border-radius:7px;padding:9px 11px;margin-bottom:6px;border-left:2px solid var(--border2);">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${x.date || ''}</span>
        <button class="btn btn-danger btn-sm" onclick="removeComment(${i})" style="padding:2px 6px;font-size:10px;">✕</button>
      </div>
      <textarea class="form-textarea" rows="2" style="font-size:12px;"
        oninput="commentText(${i},this.value)">${(x.text || '').replace(/</g,'&lt;')}</textarea>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="addComment()" style="margin-top:4px;font-size:11px;">💬 Agregar comentario</button>`;
}
function addComment() {
  const now = new Date().toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  _editComments.push({ text:'', date: now });
  renderCommentsEditor(_editComments);
}
function commentText(i, v) { if (_editComments[i]) _editComments[i].text = v; }
function removeComment(i)  { _editComments.splice(i, 1); renderCommentsEditor(_editComments); }

function openTaskModal(id) {
  editTaskId = id || null;
  _editSubtasks = []; _editAttachments = []; _editComments = [];

  fillMatSels();
  const existing = id ? State.tasks.find(t => t.id === id) : null;

  if (existing) {
    document.getElementById('task-modal-title').textContent = '✏️ Editar Tarea';
    document.getElementById('t-title').value = existing.title;
    document.getElementById('t-mat').value   = existing.matId;
    document.getElementById('t-prio').value  = existing.priority;
    document.getElementById('t-date-planned').value = existing.datePlanned || '';
    document.getElementById('t-due').value   = existing.due || '';
    document.getElementById('t-type').value  = existing.type || 'Tarea';
    document.getElementById('t-notes').value = existing.notes || '';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = existing.timeEst || '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = (existing.tags||[]).join(', ');
    _editSubtasks    = JSON.parse(JSON.stringify(existing.subtasks    || []));
    _editAttachments = JSON.parse(JSON.stringify(existing.attachments || []));
    _editComments    = JSON.parse(JSON.stringify(existing.comments    || []));
  } else {
    document.getElementById('task-modal-title').textContent = '✅ Nueva Tarea';
    document.getElementById('t-title').value = '';
    document.getElementById('t-date-planned').value = '';
    document.getElementById('t-due').value   = '';
    document.getElementById('t-notes').value = '';
    document.getElementById('t-prio').value  = 'med';
    document.getElementById('t-type').value  = 'Tarea';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = '';
  }

  document.querySelectorAll('#modal-task .modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  renderSubtasksEditor(_editSubtasks);
  renderAttachmentsEditor(_editAttachments);
  renderCommentsEditor(_editComments);
  document.getElementById('modal-task').classList.add('open');
}

function switchTaskTab(tab, el) {
  document.querySelectorAll('#modal-task .modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('ttab-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'subtasks')    renderSubtasksEditor(_editSubtasks);
  if (tab === 'attachments') renderAttachmentsEditor(_editAttachments);
  if (tab === 'comments')    renderCommentsEditor(_editComments);
}

function saveTask() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) {
    document.getElementById('t-title').style.borderColor = 'var(--red)';
    document.getElementById('t-title').focus();
    return;
  }
  document.getElementById('t-title').style.borderColor = '';

  document.querySelectorAll('#subtasks-editor input[type="text"]').forEach((inp, i) => {
    if (_editSubtasks[i]) _editSubtasks[i].text = inp.value;
  });
  document.querySelectorAll('#comments-editor textarea').forEach((ta, i) => {
    if (_editComments[i]) _editComments[i].text = ta.value;
  });

  const existing = editTaskId ? State.tasks.find(t => t.id === editTaskId) : null;
  const task = {
    id:          editTaskId || Date.now().toString(),
    title,
    matId:       document.getElementById('t-mat').value,
    priority:    document.getElementById('t-prio').value,
    datePlanned: document.getElementById('t-date-planned').value,
    due:         document.getElementById('t-due').value,
    type:        document.getElementById('t-type').value,
    notes:       document.getElementById('t-notes').value,
    timeEst:     parseInt(document.getElementById('t-time-est')?.value) || 0,
    tags:        (document.getElementById('t-tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean),
    kanbanCol:   existing?.kanbanCol || 'todo',
    done:        existing ? existing.done : false,
    createdAt:   existing ? existing.createdAt : Date.now(),
    subtasks:    _editSubtasks.filter(s => s.text.trim()),
    attachments: _editAttachments,
    comments:    _editComments.filter(c => c.text.trim()),
  };

  if (editTaskId) {
    const idx = State.tasks.findIndex(t => t.id === editTaskId);
    if (idx >= 0) State.tasks[idx] = task;
  } else {
    State.tasks.unshift(task);
  }

  saveState(['tasks']);
  closeModal('modal-task');
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();
}

function toggleTask(id) {
  const t = State.tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  t.done = !t.done;
  _uiClick(wasDone ? 'task-undone' : 'task-done');
  if (!wasDone) { _updateStreak(); }
  saveState(['tasks']); renderTasks(); updateBadge(); renderOverview(); renderCalendar();
}
function toggleSubtask(taskId, idx) {
  const t = State.tasks.find(x => x.id === taskId);
  if (!t?.subtasks?.[idx]) return;
  t.subtasks[idx].done = !t.subtasks[idx].done;
  if (t.subtasks.every(s => s.done)) t.done = true;
  saveState(['tasks']); renderTasks(); updateBadge(); renderCalendar();
}
function deleteTask(id) {
  State.tasks = State.tasks.filter(t => t.id !== id);
  saveState(['tasks']); renderTasks(); updateBadge(); renderOverview(); renderCalendar();
}
function toggleDesc(id) {
  const el  = document.getElementById('desc-' + id);
  const btn = document.getElementById('descbtn-' + id);
  if (!el) return;
  const shown = el.style.display !== 'none';
  el.style.display = shown ? 'none' : 'block';
  if (btn) btn.textContent = (shown ? '▸' : '▾') + ' Ver descripción';
}
function updateBadge() {
  const count = State.tasks.filter(t => !t.done).length;
  const b1 = document.getElementById('badge-tasks');
  const b2 = document.getElementById('badge-tasks-m');
  if (b1) b1.textContent = count;
  if (b2) b2.textContent = count;
  // Update hoy badge
  const today = new Date().toISOString().split('T')[0];
  const urgent = State.tasks.filter(t => !t.done && t.due && t.due <= today).length;
  const badge = document.getElementById('badge-hoy');
  if (badge) { badge.style.display = urgent > 0 ? 'inline' : 'none'; badge.textContent = urgent; }
}

function renderTasks() { _schedRender(_renderTasks); }
function _renderTasks() {
  const list = _el('tasks-list');
  if (!list) return;

  const mf = document.getElementById('tf-mat')?.value    || '';
  const sf = document.getElementById('tf-status')?.value || '';
  const pf = document.getElementById('tf-prio')?.value   || '';
  const qf = (document.getElementById('search-input')?.value || '').toLowerCase();

  let filtered = State.tasks.filter(t =>
    (!mf || t.matId === mf) &&
    (!sf || (sf === 'pending' ? !t.done : t.done)) &&
    (!pf || t.priority === pf) &&
    (!qf || t.title.toLowerCase().includes(qf) || (t.notes || '').toLowerCase().includes(qf))
  );

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pd = { high:0, med:1, low:2 };
    return (pd[a.priority] ?? 1) - (pd[b.priority] ?? 1);
  });

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:36px;margin-bottom:10px;">✅</div>
      <div style="font-size:14px;">No hay tareas aquí</div></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const m       = getMat(t.matId);
    const dc      = dueClass(t.due);
    const prog    = subtaskProgress(t);
    const pStripe = t.priority === 'high' ? 'p-high-stripe' : t.priority === 'low' ? 'p-low-stripe' : 'p-med-stripe';
    const tBadge  = getTypeBadgeClass(t.type);
    const highGlowClass = t.priority === 'high' && !t.done ? ' prio-high-glow' : '';

    const subtasksHtml = prog ? `
      <div style="margin-top:7px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <div class="prog-bar" style="flex:1;height:4px;">
            <div class="prog-fill" style="background:${prog.pct===100?'#4ade80':'#7c6aff'};width:${prog.pct}%;"></div>
          </div>
          <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;white-space:nowrap;">${prog.done}/${prog.total}</span>
        </div>
        ${t.subtasks.map((s, i) => `
          <div onclick="toggleSubtask('${t.id}',${i})"
            style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;${s.done?'opacity:.5;':''}">
            <div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;
              border:2px solid ${s.done?'var(--accent)':'var(--border2)'};
              background:${s.done?'var(--accent)':'transparent'};
              display:flex;align-items:center;justify-content:center;">
              ${s.done ? '<span style="font-size:9px;color:#fff;">✓</span>' : ''}
            </div>
            <span style="font-size:12px;${s.done?'text-decoration:line-through;color:var(--text3);':''}">${s.text}</span>
          </div>`).join('')}
      </div>` : '';

    const attachHtml = t.attachments?.length ? `
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
        ${t.attachments.map((a, i) => `
          <button onclick="previewTaskAttachment('${t.id}',${i})"
            class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;">
            ${a.type === 'pdf' ? '📄' : '🖼️'} ${a.name.length > 18 ? a.name.slice(0,16)+'…' : a.name}
          </button>`).join('')}
      </div>` : '';

    const descHtml = t.notes ? `
      <div id="desc-${t.id}" style="display:none;font-size:12px;color:var(--text2);margin-top:6px;padding:8px;background:var(--surface2);border-radius:6px;white-space:pre-wrap;">${t.notes.replace(/</g,'&lt;')}</div>
      <button id="descbtn-${t.id}" onclick="toggleDesc('${t.id}')"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;margin-top:4px;padding:0;">▸ Ver descripción</button>` : '';

    const commBadge = t.comments?.length
      ? `<span style="font-size:11px;color:var(--text3);">💬 ${t.comments.length}</span>` : '';

    return `<div class="task-item${t.done ? ' done' : ''}${highGlowClass}" draggable="true" 
      data-id="${t.id}"
      ondragstart="taskDragStart(event,'${t.id}')"
      ondragover="taskDragOver(event)"
      ondrop="taskDrop(event,'${t.id}')"
      ondragleave="taskDragLeave(event)">
      <div class="task-drag-handle" title="Arrastrar">⠿</div>
      <div class="priority-stripe ${pStripe}"></div>
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
      <div style="flex:1;min-width:0;">
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <span class="task-subject" style="background:${m.color||'#7c6aff'}22;color:${m.color||'#7c6aff'};border:1px solid ${m.color||'#7c6aff'}44;">${m.icon||'📚'} ${m.code||'?'}</span>
          <span class="type-badge ${tBadge}">${t.type || 'Tarea'}</span>
          ${prioBadge(t.priority)}
          ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
          ${t.timeEst ? `<span style="font-size:10px;color:var(--text3);">⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}</span>` : ''}
          ${(t.tags||[]).map(tg=>`<span class="tag-chip">#${tg}</span>`).join('')}
          ${commBadge}
        </div>
        ${subtasksHtml}
        ${attachHtml}
        ${descHtml}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" onclick="openTaskModal('${t.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}




let calY, calM;
function initCal() { const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); }
function calNav(d)  { calM += d; if (calM>11){calM=0;calY++;}else if(calM<0){calM=11;calY--;} renderCalendar(); }

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderCalendar() { _schedRender(_renderCalendar); }
function _renderCalendar() {
  const monthStr = `${calY}-${String(calM+1).padStart(2,'0')}`;
  document.getElementById('cal-month-title').textContent = `${MONTHS[calM]} ${calY}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM+1, 0).getDate();

  const legendEl = _el('cal-legend');
  if (legendEl) {
    legendEl.innerHTML = `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-right:4px;">CLASES:</span>`
      + State.materias.slice(0,8).map(m =>
          `<span class="cal-legend-item" style="--lc:${m.color};">${m.icon||''} ${m.code}</span>`
        ).join('')
      + `<span class="cal-legend-item" style="--lc:#f87171;border-style:dashed;">✅ Tareas</span>`;
  }

  let html = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    .map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i=0; i<first; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const ds   = `${monthStr}-${String(d).padStart(2,'0')}`;
    const cellDate = new Date(calY,calM,d);
    const isT  = cellDate.getTime() === today.getTime();
    const isPast = cellDate.getTime() < today.getTime();
    const de   = State.events.filter(e => e.date === ds);
    const dt   = State.tasks.filter(t => t.due === ds && !t.done);
    const total = de.length + dt.length;

    const eventsHtml = de.slice(0, 2).map(e => {
      const m = getMat(e.matId);
      return `<div class="cal-event" style="background:${m.color||'#7c6aff'}2a;color:${m.color||'#7c6aff'};border-left:2px solid ${m.color||'#7c6aff'};" title="${e.title}">${e.title}</div>`;
    }).join('');

    const tasksHtml = de.length < 2 ? dt.slice(0, 2-de.length).map(t => {
      const pCol = t.priority==='high'?'#f87171':t.priority==='low'?'#4ade80':'#fbbf24';
      return `<div class="cal-event" style="background:${pCol}1a;color:${pCol};border-left:2px dashed ${pCol};" title="✅ ${t.title}">✅ ${t.title}</div>`;
    }).join('') : '';

    const overflow = total > 2 ? `<div style="font-size:9px;color:var(--text3);padding:1px 3px;">+${total-2} más</div>` : '';

    let cellClass = 'cal-cell';
    if (isT) cellClass += ' today';
    else if (isPast) cellClass += ' past';

    html += `<div class="${cellClass}" onclick="calDayClick('${ds}')">
      <div class="cal-num">${d}</div>
      ${eventsHtml}${tasksHtml}${overflow}
    </div>`;
  }
  _el('cal-grid').innerHTML = html;

  const mEvs   = State.events.filter(e => e.date.startsWith(monthStr)).sort((a,b)=>a.date<b.date?-1:1);
  const mTasks = State.tasks.filter(t => t.due?.startsWith(monthStr)).sort((a,b)=>a.due<b.due?-1:1);

  let listHtml = '';
  if (mEvs.length) {
    listHtml += `<div class="section-title">📅 Eventos del mes</div>`;
    listHtml += mEvs.map(e => {
      const m = getMat(e.matId);
      const evDate = new Date(e.date); evDate.setHours(0,0,0,0);
      const dLeft = Math.ceil((evDate - today) / 86400000);
      let cdClass = 'ok', cdText = `${dLeft}d`;
      if (dLeft < 0)      { cdClass='urgent'; cdText=`hace ${-dLeft}d`; }
      else if (dLeft===0) { cdClass='urgent'; cdText='¡HOY!'; }
      else if (dLeft<=3)  { cdClass='urgent'; cdText=`${dLeft} día${dLeft===1?'':'s'}`; }
      else if (dLeft<=7)  { cdClass='warn';   cdText=`${dLeft} días`; }
      else                { cdClass='ok';     cdText=`${dLeft} días`; }
      const countdownBadge = `<span class="ev-countdown-badge ${cdClass}">${cdText}</span>`;
      return `<div class="task-item" style="align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:${m.color||'#7c6aff'};flex-shrink:0;margin-top:0;"></div>
        <div style="flex:1;">
          <div style="font-size:13.5px;font-weight:600;">${e.title}${countdownBadge}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.name||''} · ${fmtD(e.date)}${e.hora?' · '+e.hora:''}${e.desc?' · '+e.desc:''}</div>
        </div>
        <span class="type-badge ${getTypeBadgeClass(e.type)}">${e.type||''}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">🗑️</button>
      </div>`;
    }).join('');
  }
  if (mTasks.length) {
    listHtml += `<div class="section-title" style="margin-top:16px;">✅ Tareas con fecha este mes</div>`;
    listHtml += mTasks.map(t => {
      const m = getMat(t.matId);
      const prog = subtaskProgress(t);
      return `<div class="task-item${t.done?' done':''}">
        <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')"></div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${t.title}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.code||''} · ${fmtD(t.due)} · ${t.type||'Tarea'}</div>
          ${prog ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            <div class="prog-bar" style="width:80px;"><div class="prog-fill" style="background:#7c6aff;width:${prog.pct}%;"></div></div>
            <span style="font-size:10px;color:var(--text3);">${prog.done}/${prog.total}</span>
          </div>` : ''}
        </div>
        ${prioBadge(t.priority)}
      </div>`;
    }).join('');
  }
  if (!mEvs.length && !mTasks.length) {
    listHtml = `<div style="text-align:center;padding:28px;color:var(--text3);">📅 Sin eventos ni tareas este mes</div>`;
  }
  _el('cal-events-list').innerHTML = listHtml;
}

function calDayClick(ds) {

  const list = _el('cal-events-list');
  if (list) list.scrollIntoView({ behavior:'smooth', block:'start' });
}

function openEventModal() {
  fillMatSels();
  ['ev-title','ev-desc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ev-date').value = '';
  document.getElementById('ev-time').value = '';
  document.getElementById('modal-event').classList.add('open');
}
function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) return;
  State.events.push({
    id: Date.now().toString(), title,
    matId: document.getElementById('ev-mat').value,
    type:  document.getElementById('ev-type').value,
    date:  document.getElementById('ev-date').value,
    hora:  document.getElementById('ev-time').value,
    desc:  document.getElementById('ev-desc').value,
  });
  saveState(['events']);
  closeModal('modal-event');
  renderCalendar();
  renderOverview();
}
function deleteEvent(id) {
  State.events = State.events.filter(e => e.id !== id);
  saveState(['events']); renderCalendar(); renderOverview();
}




const HEX_COLORS = [
  '#7c6aff','#60a5fa','#4ade80','#fbbf24','#f472b6','#fb923c','#22d3ee','#a78bfa','#f87171','#34d399',
  '#10b981','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#14b8a6','#6366f1','#ef4444','#84cc16','#06b6d4',
  '#e11d48','#7c3aed'
];
const ICONS      = ['📚','🔬','🧪','📐','💻','📊','✏️','🧮','🌐','⚡','🎓','📋','🔭','🧬','📝',
                    '🏗️','🎯','🔐','🧠','📡','⚗️','🗜️','🔋','🧲','🎨','🛠️','📈','🔢'];
let newColorSel  = '#7c6aff';
let newIconSel   = '📚';
let zoneRowCount = 0;

const PAGE_TITLES = {
  overview:'Resumen', materias:'Materias', tareas:'Tareas',
  calendario:'Calendario', calificaciones:'Calificaciones',
  temas:'Temas del Curso', estadisticas:'Estadísticas', pomodoro:'Pomodoro',
  semestres:'Semestres', horario:'Mi Horario', notas:'Bloc de Notas',
  perfil:'Mi Perfil Académico', general:'General',
  flashcards:'Flashcards'
};

function goPage(id, el) {
  _uiClick('nav');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + id);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (el) el.classList.add('active');
  _el('page-title').textContent = PAGE_TITLES[id] || id;
  closeCompPopup();

  switch(id) {
    case 'overview':       renderOverview(); break;
    case 'materias':       renderMaterias(); break;
    case 'tareas':         fillMatSels(); document.getElementById('tf-mat').value=''; renderTasks(); break;
    case 'calendario':     fillMatSels(); renderCalendar(); break;
    case 'calificaciones': renderGrades(); break;
    case 'temas':          fillMatSels(); fillTopicMatSel(); renderTopics(); break;
    case 'estadisticas':   renderStats(); break;
    case 'pomodoro':       fillPomSel(); renderPomHistory(); renderPomGoal(); break;
    case 'semestres':      renderSemestresList(); break;
    case 'horario':        renderHorario(); break;
    case 'notas':          fillNotesSel(); renderNotesProPage(); break;
    case 'perfil':         renderProfilePage(); break;
    case 'general':        renderGeneralHub(); break;
    case 'flashcards':     renderFlashcards(); break;
  }
}

function fillMatSels() {
  const targets = ['t-mat','ev-mat','tp-mat','tf-mat'];
  targets.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    State.materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon||'📚'} ${m.name}`; el.appendChild(o);
    });
    if (prev) el.value = prev;
  });
  const tf = document.getElementById('tf-mat');
  if (tf) {
    tf.innerHTML = '<option value="">Todas las materias</option>';
    State.materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon||'📚'} ${m.name}`; tf.appendChild(o);
    });

  }
}
function fillTopicMatSel() {
  const sel = document.getElementById('topics-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}
function fillPomSel() {
  const sel = document.getElementById('pom-subject'); if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  // Also fill task selector
  const taskSel = document.getElementById('pom-task-sel');
  if (taskSel) {
    const prev = taskSel.value;
    taskSel.innerHTML = '<option value="">— Sin tarea específica —</option>';
    const pending = State.tasks.filter(t => !t.done);
    pending.forEach(t => {
      const m = getMat(t.matId);
      const o = document.createElement('option'); o.value = t.id;
      o.textContent = `${m.icon||'📚'} ${t.title}${t.due?' · '+fmtD(t.due):''}`;
      taskSel.appendChild(o);
    });
    if (prev) taskSel.value = prev;
  }
}
function fillNotesSel() {
  const sel = document.getElementById('notes-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.filter(m=>!m.parentId).forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}
function fillExamSel() {
  const sel = document.getElementById('exam-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.filter(m=>!m.parentId).forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

function renderOverview() { _schedRender(_renderOverview); }

function renderMaterias() { _schedRender(_renderMaterias); }
function _renderMaterias() {
  const min  = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const grid = _el('materias-grid');
  if (!grid) return;
  const roots = State.materias.filter(m => !m.parentId);
  let html = '';

  roots.forEach(m => {
    const t        = calcTotal(m.id);
    const pts      = t ? t.total.toFixed(1) : '—';
    const maxPts   = m.zones.reduce((a,z) => a+z.maxPts, 0);
    const pct      = t ? t.pct : 0;
    const pend     = State.tasks.filter(x => x.matId===m.id && !x.done).length;
    const sc       = t ? (t.total>=min?'#4ade80':t.total>=min*.8?'#fbbf24':'#f87171') : '#5a5a72';
    const sl       = t ? (t.total>=min?'✓ Aprobado':t.total>=min*.8?'⚠ En zona':'✗ En riesgo') : 'Sin notas';
    const linkedLab= m.linkedLabId ? getMat(m.linkedLabId) : null;
    const labData  = m.linkedLabId ? getLabNetPts(m) : null;

    const zonaMin = 36, zonaGanada = 61;
    const totalPts = t ? t.total : null;
    const isGanada = totalPts !== null && totalPts >= zonaGanada;
    const hasZona  = totalPts !== null && totalPts >= zonaMin;
    const usacBanner = totalPts !== null ? (
      isGanada
        ? `<div style="margin-top:8px;background:rgba(74,222,128,.15);border:2px solid #4ade80;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:800;color:#4ade80;display:flex;align-items:center;gap:6px;">🏆 GANADA — ${totalPts.toFixed(1)} pts ≥ 61</div>`
        : hasZona
          ? `<div class="usac-zona-min-ok" style="margin-top:8px;">✅ Zona mín. alcanzada (${totalPts.toFixed(1)} ≥ 36) — Faltan ${(zonaGanada-totalPts).toFixed(1)} pts para ganar</div>`
          : `<div class="usac-zona-min-no" style="margin-top:8px;">⚠ Sin zona mín. — Faltan ${(zonaMin-totalPts).toFixed(1)} pts para los 36</div>`
    ) : '';

    const cardStyle = isGanada
      ? `--mc:${m.color}; border:2px solid #4ade80; box-shadow:0 0 20px rgba(74,222,128,.2);`
      : `--mc:${m.color};`;

    const catedratico = m.catedratico ? `<div style="font-size:10px;color:var(--text3);">👤 ${m.catedratico}</div>` : '';
    const horarioInfo = (m.dias||m.horario) ? `<div style="font-size:10px;color:var(--text3);">🕐 ${[m.seccion,m.dias,m.horario].filter(Boolean).join(' · ')}</div>` : '';

    html += `<div class="mat-card" style="${cardStyle}">
      <div class="mat-card-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="padding-left:8px;">
            <div style="font-size:15px;font-weight:800;margin-bottom:3px;">${m.icon||'📚'} ${m.name} ${isGanada ? '🏆' : ''}</div>
            <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">${m.code} · ${m.credits}</div>
            ${catedratico}${horarioInfo}
            ${linkedLab ? `<div style="margin-top:5px;"><span class="lab-link-badge">🧪 ${linkedLab.name}</span></div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:800;color:${m.color};">${pts}</div>
            <div style="font-size:10px;color:var(--text3);">/ ${maxPts} pts</div>
          </div>
        </div>
      </div>
      <div class="mat-card-body">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--text3);">Progreso</span>
          <span style="font-size:11px;color:${sc};font-weight:700;">${sl}</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="background:${m.color};width:${Math.min(pct,100)}%;"></div></div>
        ${usacBanner}
        ${labData ? `<div style="margin-top:8px;font-size:11px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:6px;padding:6px 8px;color:#4ade80;">🧪 Lab: ${labData.labGrade.toFixed(0)}/${labData.labScale} → <strong>${labData.netPts.toFixed(2)}/${labData.labMaxPts} pts</strong></div>` : ''}
        <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;">
          ${t ? `<span style="font-size:11px;background:${m.color}1a;color:${m.color};padding:2px 8px;border-radius:4px;font-weight:700;">${pct.toFixed(1)}%</span>` : ''}
          ${pend > 0 ? `<span style="font-size:11px;background:var(--red-dim);color:var(--red);padding:2px 8px;border-radius:4px;font-weight:700;">✅ ${pend}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="goPage('calificaciones',document.querySelector('[onclick*=calificaciones]'));setTimeout(()=>scrollToMat('${m.id}'),200)">🎯 Notas</button>
          <button class="btn btn-ghost btn-sm" onclick="goPage('notas',document.querySelector('[onclick*=notas]'));setTimeout(()=>setNotesMat('${m.id}'),200)">📝</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditClassModal('${m.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass('${m.id}')">🗑️</button>
        </div>
        <!-- Survival Calculator -->
        ${t ? `<div class="survival-widget">
          <div class="sw-title">⚡ Calculadora de Supervivencia</div>
          ${isGanada
            ? `<div style="font-size:12px;color:var(--green);font-weight:700;">🏆 Clase ganada — ya aprobaste</div>`
            : hasZona
              ? `<div class="survival-row"><span style="color:var(--text2);">Puntos actuales:</span><strong style="color:var(--yellow);">${totalPts.toFixed(1)} / 61</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Necesita en examen final:</span><strong style="color:#f87171;">${Math.max(0,(61-totalPts)).toFixed(1)} pts</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Para zona mínima:</span><strong style="color:var(--green);">✓ Alcanzada</strong></div>`
              : `<div class="survival-row"><span style="color:var(--text2);">Puntos actuales:</span><strong style="color:#f87171;">${totalPts.toFixed(1)} / 36</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Faltan para zona mín:</span><strong style="color:#f87171;">${Math.max(0,(36-totalPts)).toFixed(1)} pts</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Faltan para ganar:</span><strong style="color:var(--text3);">${Math.max(0,(61-totalPts)).toFixed(1)} pts</strong></div>`
          }
        </div>` : ''}
        <!-- Fórmulas clave (colapsable) -->
        <div class="formulas-section">
          <div class="formulas-toggle" onclick="toggleFormulas('${m.id}')">
            <span id="formulas-arrow-${m.id}">▶</span> 📐 Fórmulas clave
          </div>
          <div class="formulas-body" id="formulas-body-${m.id}">
            ${[0,1,2,3,4].map(i => {
              const val = (m.formulas && m.formulas[i]) ? m.formulas[i].replace(/"/g,'&quot;') : '';
              return `<input class="formula-inp" placeholder="Fórmula ${i+1}…" value="${val}" onchange="saveFormula('${m.id}',${i},this.value)">`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;

    if (linkedLab) {

      const labColor = m.color;
      const lt   = calcTotal(linkedLab.id);
      const lPts = lt ? lt.total.toFixed(1) : '—';
      html += `<div style="margin-left:16px;margin-top:-8px;margin-bottom:8px;padding-left:14px;border-left:3px solid ${labColor};position:relative;">
        <div style="position:absolute;left:-1px;top:0;width:3px;height:100%;background:linear-gradient(to bottom,${labColor}88,${labColor}22);border-radius:0 0 0 3px;"></div>
        <div class="mat-card" style="--mc:${labColor};border-color:${labColor}33;background:${labColor}0a;">
          <div class="mat-card-header" style="padding:10px 14px 8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:12px;font-weight:800;">${linkedLab.icon||'🧪'} ${linkedLab.name} <span style="font-size:9px;color:${labColor};background:${labColor}22;padding:1px 5px;border-radius:4px;border:1px solid ${labColor}44;font-family:'Space Mono',monospace;">LAB</span></div>
                <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${linkedLab.code} · ${linkedLab.credits}</div>
                ${linkedLab.catedratico ? `<div style="font-size:10px;color:var(--text3);">👤 ${linkedLab.catedratico}</div>` : ''}
                ${linkedLab.dias ? `<div style="font-size:10px;color:var(--text3);">📅 ${linkedLab.dias}${linkedLab.horario?' · '+linkedLab.horario:''}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:18px;font-weight:800;color:${labColor};">${lPts}</div>
                <div style="font-size:9px;color:var(--text3);">/100 pts</div>
              </div>
            </div>
          </div>
          <div class="mat-card-body" style="padding:8px 14px 10px;">
            ${labData ? `<div style="font-size:11px;color:${labColor};font-weight:600;">🧪 ${labData.labGrade.toFixed(0)}/${labData.labScale} en lab = ${labData.netPts.toFixed(2)}/${labData.labMaxPts} pts en ${m.name}</div>` : `<div style="font-size:11px;color:var(--text3);">Ingresa nota en Calificaciones → ${linkedLab.name}</div>`}
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="btn btn-ghost btn-sm" onclick="goPage('calificaciones',document.querySelector('[onclick*=calificaciones]'));setTimeout(()=>scrollToMat('${linkedLab.id}'),200)">🎯 Ingresar nota</button>
              <button class="btn btn-ghost btn-sm" onclick="openEditClassModal('${linkedLab.id}')">✏️ Editar Lab</button>
            </div>
          </div>
        </div>
      </div>`;
    }
  });

  grid.innerHTML = html || `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">
    <div style="font-size:32px;margin-bottom:10px;">📚</div>
    <div>No hay materias aún. <button class="btn btn-primary btn-sm" onclick="openAddClassModal()">+ Agregar primera clase</button></div>
  </div>`;
}

function renderSemesterBadge() { updateGPADisplay(); }

function updateGPADisplay() {
  const sem     = getActiveSem();
  const overall = calcOverallGPA();

  const snEl   = document.getElementById('sidebar-sem-nombre');
  const scEl   = document.getElementById('sidebar-sem-cred');
  const saEl   = document.getElementById('sidebar-sem-avg');
  if (snEl && !snEl.classList.contains('editing')) snEl.textContent = sem.nombre || '—';
  if (scEl) scEl.textContent = '🪙 ' + overall.totalCred + ' cred';
  if (saEl) saEl.textContent = '📈 ' + (overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—');

  const tgEl = document.getElementById('tb-gpa-val');
  const tcEl = document.getElementById('tb-cred-val');
  if (tgEl) tgEl.textContent = overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—';
  if (tcEl) tcEl.textContent = overall.totalCred + ' cred';
}

function startSemEdit() {
  const snEl  = document.getElementById('sidebar-sem-nombre');
  const btnEl = document.getElementById('sem-edit-btn');
  if (!snEl || snEl.classList.contains('editing')) return;
  snEl.classList.add('editing');
  const current = getActiveSem().nombre || '';
  snEl.innerHTML = `<input class="sem-name-input" id="sem-name-inp" value="${current.replace(/"/g,'&quot;')}" maxlength="40" onclick="event.stopPropagation()">`;
  const inp = document.getElementById('sem-name-inp');
  inp.focus(); inp.select();
  const commit = () => {
    const val = inp.value.trim();
    if (val) { getActiveSem().nombre = val; saveState(['semestres']); }
    snEl.classList.remove('editing');
    snEl.textContent = getActiveSem().nombre || '—';
    renderSemestresList();
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key==='Enter') inp.blur(); if (e.key==='Escape') { snEl.classList.remove('editing'); snEl.textContent=current; } });
  if (btnEl) btnEl.style.display = 'none';
  setTimeout(() => { if (btnEl) btnEl.style.display=''; }, 1500);
}

function toggleSemSwitcher(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('sem-sw-dd');
  if (!dd) return;
  if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }

  const list = document.getElementById('sem-sw-list');
  list.innerHTML = State.semestres.map(s => {
    const g   = calcSemesterGPA(s.id);
    const avg = g.promedioSemestre;
    return `<div class="sem-sw-item ${s.activo ? 'sem-active' : ''}" onclick="switchSemAndClose('${s.id}')">
      <div>
        <div>${s.activo ? '● ' : '○ '}${s.nombre}</div>
        <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${g.totalCreditos} cred · prom ${avg !== null ? avg.toFixed(1) : '—'}</div>
      </div>
      ${s.activo ? '<span style="font-size:9px;color:var(--accent);font-family:\'Space Mono\',monospace;">ACTIVO</span>' : ''}
    </div>`;
  }).join('');
  dd.classList.add('open');
}
function switchSemAndClose(id) {
  switchSemester(id);
  document.getElementById('sem-sw-dd')?.classList.remove('open');
}

function openConfigModal() {
  const sem = getActiveSem();
  document.getElementById('cfg-prev-avg').value   = sem.prevAvg  || '';
  document.getElementById('cfg-prev-cred').value  = sem.prevCred || '';
  document.getElementById('cfg-min-grade').value  = State.settings.minGrade || 70;
  document.getElementById('cfg-sem-target').value = sem.promedioObjetivo || 70;
  _updateConfigPreview();
  document.getElementById('modal-config').classList.add('open');
}
function _updateConfigPreview() {
  const prevAvg  = parseFloat(document.getElementById('cfg-prev-avg')?.value)  || 0;
  const prevCred = parseFloat(document.getElementById('cfg-prev-cred')?.value) || 0;

  const sem = getActiveSem();
  sem.prevAvg  = prevAvg;
  sem.prevCred = prevCred;

  const g        = calcSemesterGPA(sem.id);
  const semAvg   = g.promedioSemestre;
  const semCred  = g.totalCreditos;
  const total    = prevCred + semCred;
  const overall  = total > 0 ? (prevAvg * prevCred + (semAvg||0) * semCred) / total : semAvg;

  const elO = document.getElementById('cfg-prev-overall');
  const elC = document.getElementById('cfg-prev-tcred');
  const elS = document.getElementById('cfg-prev-sem');
  if (elO) elO.textContent = overall !== null ? overall.toFixed(2) : '—';
  if (elC) elC.textContent = total;
  if (elS) elS.textContent = semAvg !== null ? semAvg.toFixed(2) : '—';

  renderOverview();
}
function saveConfigModal() {
  const sem = getActiveSem();
  sem.prevAvg          = parseFloat(document.getElementById('cfg-prev-avg').value)  || 0;
  sem.prevCred         = parseFloat(document.getElementById('cfg-prev-cred').value) || 0;
  sem.promedioObjetivo = parseFloat(document.getElementById('cfg-sem-target').value)|| 70;
  State.settings.minGrade = parseFloat(document.getElementById('cfg-min-grade').value) || 70;
  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;
  saveState(['all']);
  closeModal('modal-config');
  renderOverview(); renderGrades(); updateGPADisplay();
}

// renderSemestresList is defined below (card view version)

let _editSemId = null;

function openSemestreModal() {
  _editSemId = null;
  document.getElementById('ns-nombre').value    = '';
  document.getElementById('ns-objetivo').value  = '70';
  document.getElementById('ns-prev-avg').value  = '';
  document.getElementById('ns-prev-cred').value = '';
  const cb = document.getElementById('ns-activar');
  if (cb) { cb.checked = true; cb.disabled = false; }
  document.querySelector('#modal-semestre .modal-title').textContent = '🗂️ Nuevo Semestre';
  document.getElementById('modal-semestre').classList.add('open');
}

function openSemestreEditModal(id) {
  _editSemId = id;
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  document.getElementById('ns-nombre').value    = sem.nombre;
  document.getElementById('ns-objetivo').value  = sem.promedioObjetivo || 70;
  document.getElementById('ns-prev-avg').value  = sem.prevAvg  || '';
  document.getElementById('ns-prev-cred').value = sem.prevCred || '';
  const cb = document.getElementById('ns-activar');
  if (cb) { cb.checked = sem.activo; cb.disabled = sem.activo; }
  document.querySelector('#modal-semestre .modal-title').textContent = '✏️ Editar Semestre';
  document.getElementById('modal-semestre').classList.add('open');
}

function saveSemestreModal() {
  const nombre   = document.getElementById('ns-nombre').value.trim();
  const objetivo = parseFloat(document.getElementById('ns-objetivo').value) || 70;
  const activar  = document.getElementById('ns-activar')?.checked ?? true;
  const prevAvg  = parseFloat(document.getElementById('ns-prev-avg')?.value)  || 0;
  const prevCred = parseFloat(document.getElementById('ns-prev-cred')?.value) || 0;
  if (!nombre) { alert('Ingresa un nombre para el semestre.'); return; }

  if (_editSemId) {
    const sem = State.semestres.find(s => s.id === _editSemId);
    if (sem) { sem.nombre = nombre; sem.promedioObjetivo = objetivo; sem.prevAvg = prevAvg; sem.prevCred = prevCred; }
    if (activar && !sem?.activo) switchSemester(_editSemId);
  } else {
    if (activar) State.semestres.forEach(s => s.activo = false);
    const sem = _buildDefaultSemester('sem_' + Date.now(), nombre);
    sem.promedioObjetivo = objetivo;
    sem.prevAvg  = prevAvg;
    sem.prevCred = prevCred;
    sem.activo   = activar;
    State.semestres.push(sem);
  }
  saveState(['semestres']);
  closeModal('modal-semestre');
  _refreshAllViews();
  renderSemesterBadge();
}

function deleteSemester(id) {
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  if (sem.activo) { alert('No puedes eliminar el semestre activo.'); return; }
  if (!confirm(`¿Eliminar "${sem.nombre}" y todos sus datos? Esta acción es irreversible.`)) return;
  State.semestres = State.semestres.filter(s => s.id !== id);
  saveState(['semestres']);
  renderSemestresList();
}

function deleteClass(matId) {
  const mat = getMat(matId);
  if (mat.linkedLabId) {
    State.materias = State.materias.filter(m => m.id !== mat.linkedLabId);
    delete State.grades[mat.linkedLabId];
    State.topics = State.topics.filter(t => t.matId !== mat.linkedLabId);
  }
  State.materias = State.materias.filter(m => m.id !== matId);
  delete State.grades[matId];
  State.topics = State.topics.filter(t => t.matId !== matId);
  saveState(['materias','grades','topics']);
  renderMaterias(); renderGrades(); renderOverview(); fillMatSels(); fillTopicMatSel(); fillPomSel();
}

function openAddClassModal() {
  document.getElementById('nc-name').value    = '';
  document.getElementById('nc-code').value    = '';
  document.getElementById('nc-credits').value = '';
  document.getElementById('nc-lab-name').value  = '';
  document.getElementById('nc-lab-code').value  = '';
  document.getElementById('nc-lab-pts').value   = '';
  document.getElementById('nc-lab-scale').value = '100';
  document.getElementById('nc-nolab').checked   = true;
  document.getElementById('lab-section').style.display = 'none';

  ['nc-seccion','nc-catedratico','nc-horario'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  // Clear dias checkboxes
  document.querySelectorAll('#nc-dias-checks input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('nc-dias').value = '';

  const defaults = { lab:{on:false,pts:10,n:2}, tar:{on:false,pts:15,n:3},
                     par:{on:true,pts:75,n:2}, fin:{on:true,pts:25,n:1}, extra:{on:false,pts:5,n:1} };
  Object.entries(defaults).forEach(([id, cfg]) => {
    const cb = document.getElementById('uz-'+id+'-on');
    if (cb) { cb.checked = cfg.on; }
    const pts = document.getElementById('uz-'+id+'-pts');
    if (pts) pts.value = cfg.pts;
    const n = document.getElementById('uz-'+id+'-n');
    if (n) n.value = cfg.n;
    const ctrl = document.getElementById('uzc-'+id);
    if (ctrl) ctrl.style.display = cfg.on ? 'flex' : 'none';
  });
  updateUsacSuma();

  document.getElementById('zones-builder').innerHTML = '';
  zoneRowCount = 0;

  const ps = document.getElementById('nc-parent');
  ps.innerHTML = '<option value="">— No es un lab —</option>';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; ps.appendChild(o);
  });

  newColorSel = '#7c6aff'; newIconSel = '📚';
  document.querySelectorAll('.color-opt').forEach(el => el.classList.toggle('selected', el.dataset.color === newColorSel));
  document.querySelectorAll('.icon-opt').forEach(el  => el.classList.toggle('selected', el.dataset.icon  === newIconSel));
  document.getElementById('modal-addclass').classList.add('open');
}
function toggleLabSection() {
  document.getElementById('lab-section').style.display =
    document.getElementById('nc-haslab').checked ? 'block' : 'none';
}
function selectColor(el) {
  newColorSel = el.dataset.color;
  document.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function selectIcon(el) {
  newIconSel = el.dataset.icon;
  document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function addZoneRow(labelVal, ptsVal, subsArr) {
  zoneRowCount++;
  const id   = 'zr-' + zoneRowCount;
  const subs = subsArr || (labelVal ? [{label: labelVal, pts: ptsVal || 0}] : []);
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const buildSubsHtml = (subsList) => subsList.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}">
      <input type="text" class="form-input zone-sub-label" placeholder="Apartado (ej: Tarea P1)" value="${(s.label||'').replace(/"/g,'&quot;')}" style="font-size:12px;">
      <input type="number" class="form-input zone-sub-pts" placeholder="Pts" value="${s.pts||''}" min="0" max="200" style="font-size:12px;text-align:center;" oninput="updateZoneTotal('${id}')">
      <button class="btn btn-danger btn-sm" onclick="removeZoneSub('${id}', ${i})" style="padding:3px 6px;">✕</button>
    </div>`).join('');

  const totalPts = subs.reduce((a, s) => a + (parseFloat(s.pts) || 0), 0);

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input zone-name-inp" data-zone-name="1" placeholder="Nombre de la zona (ej: Exámenes Parciales)" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="font-size:13px;font-weight:600;flex:1;">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;">
        Total: <strong id="${id}-total" style="color:var(--accent2);margin-left:4px;">${totalPts.toFixed(1)}</strong> pts
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs" class="zone-subs-area">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="addZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;

  document.getElementById('zones-builder').appendChild(div);
}

function updateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value) || 0; });
  totalEl.textContent = total.toFixed(1);
}

function addZoneSub(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  if (!subsDiv) return;
  const idx = subsDiv.querySelectorAll('[id^="' + zoneId + '-sub-"]').length;
  const row = document.createElement('div');
  row.className = 'zone-sub-row';
  row.id = zoneId + '-sub-' + idx;
  row.innerHTML = `
    <input type="text" class="form-input" placeholder="Apartado" style="font-size:12px;">
    <input type="number" class="form-input" placeholder="Pts" min="0" max="200" style="font-size:12px;text-align:center;" oninput="updateZoneTotal('${zoneId}')">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();updateZoneTotal('${zoneId}')" style="padding:3px 6px;">✕</button>`;
  subsDiv.appendChild(row);
}

function removeZoneSub(zoneId, idx) {
  const row = document.getElementById(zoneId + '-sub-' + idx);
  if (row) { row.remove(); updateZoneTotal(zoneId); }
}

function saveNewClass() {
  const name = document.getElementById('nc-name').value.trim();
  const code = document.getElementById('nc-code').value.trim();
  if (!name || !code) { alert('Ingresa nombre y código.'); return; }
  const credits  = document.getElementById('nc-credits').value.trim() || '3 cred';
  const hasLab   = document.getElementById('nc-haslab').checked;
  const parentId = document.getElementById('nc-parent').value || null;

  const zones = [];
  document.getElementById('zones-builder').querySelectorAll('div[id^="zr-"]').forEach(row => {
    const nameInp = row.querySelector('.zone-name-inp');
    const lbl     = nameInp ? nameInp.value.trim() : '';
    if (!lbl) return;
    const key = lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
    const subsRows = row.querySelectorAll('.zone-sub-row');
    const subs = [];
    let totalPts = 0;
    subsRows.forEach((sr, i) => {
      const subLabel = sr.querySelector('.zone-sub-label')?.value.trim() || lbl + ' ' + (i+1);
      const subPts   = parseFloat(sr.querySelector('.zone-sub-pts')?.value) || 0;
      if (subPts > 0) {
        subs.push({ key: key + '_' + (i+1), label: subLabel, maxPts: subPts });
        totalPts += subPts;
      }
    });
    if (totalPts > 0) {
      zones.push({ key, label: lbl, maxPts: totalPts, color: newColorSel, subs });
    }
  });
  if (!zones.length) { alert('Agrega al menos una zona de calificación.\n\nUsa "✅ Generar Zonas" para crear las zonas USAC automáticamente.'); return; }

  const newId  = 'mat_' + Date.now();
  const ncDias = Array.from(document.querySelectorAll('#nc-dias-checks input[type=checkbox]:checked')).map(cb=>cb.value).join(', ');
  const newMat = {
    id:newId, name, code, color:newColorSel, icon:newIconSel, credits, zones,
    seccion:      document.getElementById('nc-seccion')?.value.trim()     || '',
    catedratico:  document.getElementById('nc-catedratico')?.value.trim() || '',
    dias:         ncDias,
    horario:      document.getElementById('nc-horario')?.value.trim()     || '',
  };

  if (parentId) {

    newMat.parentId   = parentId;
    newMat.labScale   = 100;
    newMat.labMaxPts  = 10;

    const parentMat = State.materias.find(m => m.id === parentId);
    if (parentMat) { newMat.color = parentMat.color; }
    newMat.zones      = [{ key:'g', label:'Calificación (/100)', maxPts:100, color:newMat.color, subs:[{key:'nota', label:'Nota General', maxPts:100}] }];

    const pidx = State.materias.findIndex(m => m.id === parentId);
    if (pidx >= 0) {
      State.materias[pidx].linkedLabId = newId;
      State.materias[pidx].labMaxPts   = 10;
      State.materias[pidx].labScale    = 100;
      if (!State.materias[pidx].zones.some(z => z.isLabZone)) {
        State.materias[pidx].zones.push({ key:'lab', label:'Laboratorio (auto)', maxPts:10, color:newMat.color, isLabZone:true,
          subs:[{key:'lab', label:name+' (enlazado)', maxPts:10}] });
      }
    }
  }
  State.materias.push(newMat);

  if (hasLab && !parentId) {
    const labName  = document.getElementById('nc-lab-name').value.trim()  || name + ' Lab';
    const labCode  = document.getElementById('nc-lab-code').value.trim()  || code + '-L';
    const labPts   = parseFloat(document.getElementById('nc-lab-pts').value)   || 10;
    const labScale = parseFloat(document.getElementById('nc-lab-scale').value) || 100;
    const labId    = 'mat_lab_' + Date.now();
    State.materias.push({
      id:labId, name:labName, code:labCode, color:'#4ade80', icon:'🧪', credits:'1 cred',
      parentId:newId, labScale, labMaxPts:labPts,
      zones:[{ key:'g', label:`Calificación (/${labScale})`, maxPts:labScale, color:'#4ade80',
        subs:[{key:'nota', label:'Nota General', maxPts:labScale}] }]
    });
    newMat.linkedLabId = labId;
    newMat.labMaxPts   = labPts;
    newMat.labScale    = labScale;
    newMat.zones.push({ key:'lab', label:'Laboratorio (auto)', maxPts:labPts, color:'#4ade80', isLabZone:true,
      subs:[{key:'lab', label:labName+' (enlazado)', maxPts:labPts}] });
  }

  saveState(['materias']);
  closeModal('modal-addclass');
  fillMatSels(); fillTopicMatSel(); fillPomSel();
  renderMaterias(); renderGrades(); renderOverview();
}

let compTarget = null;
function openTopicModal() {
  fillMatSels();
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value  = '';
  document.getElementById('modal-topic').classList.add('open');
}
function saveTopic() {
  const name = document.getElementById('tp-name').value.trim(); if (!name) return;
  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs = subsRaw ? subsRaw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({name:s,seen:false,comp:0})) : [];
  State.topics.push({ id:Date.now().toString(), matId:document.getElementById('tp-mat').value,
    parcial:document.getElementById('tp-parcial').value, name, seen:false, comp:0, subs });
  saveState(['topics']); closeModal('modal-topic'); renderTopics();
}
function deleteTopic(id)  { State.topics = State.topics.filter(t=>t.id!==id); saveState(['topics']); renderTopics(); }
function toggleTopicSeen(id) {
  const t = State.topics.find(x=>x.id===id); if (!t) return;
  t.seen = !t.seen;
  if (t.seen && t.comp===0) t.comp=100;   // al marcar → 100% si estaba en 0
  if (!t.seen) t.comp=0;                  // al desmarcar → reset comprensión
  saveState(['topics']); renderTopics();
}
function toggleSubSeen(tid,idx) {
  const t = State.topics.find(x=>x.id===tid); if (!t?.subs?.[idx]) return;
  t.subs[idx].seen = !t.subs[idx].seen;
  if (t.subs[idx].seen && t.subs[idx].comp===0) t.subs[idx].comp=100;
  if (!t.subs[idx].seen) t.subs[idx].comp=0; // al desmarcar → reset
  saveState(['topics']); renderTopics();
}
function openCompPopup(e,topicId,subIdx) {
  e.stopPropagation();
  compTarget = { topicId, subIdx: subIdx!=null ? subIdx : null };
  const t   = State.topics.find(x=>x.id===topicId);
  const cur = subIdx!=null ? t.subs[subIdx].comp : t.comp;
  const slider = document.getElementById('comp-slider');
  slider.value = cur;
  document.getElementById('comp-val').textContent = cur+'%';
  slider.oninput = () => { document.getElementById('comp-val').textContent = slider.value+'%'; };
  const popup = document.getElementById('comp-popup');
  popup.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth-200) + 'px';
}
function applyComp() {
  if (!compTarget) return;
  const val = parseInt(document.getElementById('comp-slider').value)||0;
  const t   = State.topics.find(x=>x.id===compTarget.topicId);
  if (t) { if (compTarget.subIdx!=null) t.subs[compTarget.subIdx].comp=val; else t.comp=val; }
  saveState(['topics']); closeCompPopup(); renderTopics();
}
function closeCompPopup() { const p=document.getElementById('comp-popup'); if(p) p.style.display='none'; compTarget=null; }

function renderTopics() {
  const matId = document.getElementById('topics-mat-sel')?.value || '';
  const container = document.getElementById('topics-container');
  if (!container) return;
  if (!matId) { container.innerHTML=''; return; }
  const mat      = getMat(matId);
  const matTopics = State.topics.filter(t=>t.matId===matId);
  const totalT   = matTopics.length, seenT = matTopics.filter(t=>t.seen).length;
  const avgComp  = totalT ? Math.round(matTopics.reduce((a,t)=>a+t.comp,0)/totalT) : 0;
  const needRev  = matTopics.filter(t=>t.comp<70&&t.seen).length;

  let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
    <div class="stat-mini"><div class="stat-mini-lbl">✅ TEMAS VISTOS</div><div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT?seenT/totalT*100:0}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">🧠 COMPRENSIÓN</div><div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">⚠️ REPASO</div><div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div><div style="font-size:11px;color:var(--text3);margin-top:4px;">&lt;70% comprensión</div></div>
  </div>`;

  const parcials = [{v:'1',l:'Parcial 1'},{v:'2',l:'Parcial 2'},{v:'3',l:'Parcial 3'},{v:'final',l:'Final'}];
  let anyFound = false;
  parcials.forEach(p => {
    const pts = matTopics.filter(t=>t.parcial===p.v);
    if (!pts.length) return;
    anyFound = true;
    const pSeen = pts.filter(t=>t.seen).length;
    const pComp = pts.length ? Math.round(pts.reduce((a,t)=>a+t.comp,0)/pts.length) : 0;
    html += `<div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="border-left:3px solid ${mat.color};">
        <span class="card-title" style="padding-left:8px;">📖 ${p.l}</span>
        <div style="display:flex;gap:10px;align-items:center;">
          <span style="font-size:11px;color:var(--text3);">${pSeen}/${pts.length} vistos</span>
          <span style="font-size:11px;font-weight:700;color:${barColor(pComp)};">Comprensión: ${pComp}%</span>
        </div>
      </div>
      <div class="card-body">
        ${pts.map(t => {
          const subsHtml = t.subs.length
            ? `<div style="padding-left:28px;margin-top:4px;border-left:2px solid var(--border);margin-left:10px;">
                ${t.subs.map((s,i)=>`
                  <div class="topic-item" style="padding:6px 0;">
                    <div class="topic-seen-btn ${s.seen?'seen':''}" onclick="toggleSubSeen('${t.id}',${i})"></div>
                    <div style="flex:1;font-size:12px;color:${s.seen?'var(--text2)':'var(--text)'};">${s.name}</div>
                    <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',${i})">
                      <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${s.comp}%;background:${barColor(s.comp)};border-radius:3px;transition:width .3s;"></div></div>
                      <span style="font-size:10px;font-family:'Space Mono',monospace;color:${barColor(s.comp)};width:30px;text-align:right;">${s.comp}%</span>
                    </div>
                  </div>`).join('')}
              </div>` : '';
          return `<div>
            <div class="topic-item">
              <div class="topic-seen-btn ${t.seen?'seen':''}" onclick="toggleTopicSeen('${t.id}')"></div>
              <div style="flex:1;font-size:13.5px;font-weight:600;color:${t.seen?'var(--text2)':'var(--text)'};">${t.name}</div>
              <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',null)">
                <div style="width:90px;height:6px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${t.comp}%;background:${barColor(t.comp)};border-radius:4px;transition:width .3s;"></div></div>
                <span style="font-size:11px;font-family:'Space Mono',monospace;color:${barColor(t.comp)};width:34px;text-align:right;">${t.comp}%</span>
              </div>
              <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="deleteTopic('${t.id}')">✕</button>
            </div>
            ${subsHtml}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  if (!anyFound) html += `<div style="text-align:center;padding:48px;color:var(--text3);">📖 Presiona "+ Agregar Tema" para comenzar</div>`;
  container.innerHTML = html;
}

// ── GENERAL HUB ──────────────────────────────────────────────
function openFromHub(page) {
  const navEl = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
  goPage(page, navEl);
}

function renderGeneralHub() {
  // Calificaciones stat
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const atRisk = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total < min; }).length;
  const passed = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total >= min; }).length;
  const calStat = document.getElementById('hub-stat-cal');
  if (calStat) calStat.textContent = State.materias.length
    ? `${passed} aprobada${passed!==1?'s':''} · ${atRisk} en riesgo`
    : 'Sin materias aún';

  // Flashcards stat
  const fcAll = (() => { try { return JSON.parse(localStorage.getItem('academia_flashcards')||'[]'); } catch { return []; } })();
  const fcStat = document.getElementById('hub-stat-fc');
  if (fcStat) fcStat.textContent = fcAll.length ? `${fcAll.length} tarjeta${fcAll.length!==1?'s':''}` : 'Sin tarjetas aún';

  // Stats stat
  const gpa = calcOverallGPA();
  const statsStat = document.getElementById('hub-stat-stats');
  if (statsStat) statsStat.textContent = gpa.overallAvg !== null ? `Promedio: ${gpa.overallAvg.toFixed(1)} pts` : 'Sin datos aún';

  // Temas stat
  const tc = (State.topics||[]).length;
  const temasStat = document.getElementById('hub-stat-temas');
  if (temasStat) temasStat.textContent = tc ? `${tc} tema${tc!==1?'s':''} registrado${tc!==1?'s':''}` : 'Sin temas aún';
}

// ── GRADES CARD VIEW ─────────────────────────────────────────
let _gradesDetailMatId = null;

function gradesShowIndex() {
  _gradesDetailMatId = null;
  document.getElementById('grades-index-view').style.display = '';
  document.getElementById('grades-detail-view').style.display = 'none';
  _renderGradeCards();
}

function openGradesForMat(matId) {
  _gradesDetailMatId = matId;
  document.getElementById('grades-index-view').style.display = 'none';
  document.getElementById('grades-detail-view').style.display = '';
  const mat = getMat(matId);
  document.getElementById('grades-detail-title').textContent = `${mat.icon||'📚'} ${mat.name}`;
  _renderGrades();
}

function _renderGradeCards() {
  const grid = document.getElementById('grades-cards-grid');
  if (!grid) return;
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const USAC_GANADA = 61;
  grid.innerHTML = State.materias.map(mat => {
    const t = calcTotal(mat.id);
    const total = t ? t.total : 0;
    const maxT = mat.zones.reduce((a,z) => a+z.maxPts, 0);
    const pct = t ? t.pct : 0;
    const isGanada = t && total >= USAC_GANADA;
    const sc = !t ? '#5a5a72' : isGanada ? '#4ade80' : total >= min ? '#4ade80' : total >= min*.8 ? '#fbbf24' : '#f87171';
    const sl = !t ? 'Sin datos' : isGanada ? '🏆 Ganada' : total >= min ? '✓ Aprobado' : total >= min*.8 ? '⚠ En zona' : '✗ En riesgo';
    const border = isGanada ? '#4ade80' : mat.color;
    return `<div class="card" onclick="openGradesForMat('${mat.id}')" style="cursor:pointer;border-left:4px solid ${border};transition:transform .15s,box-shadow .15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.3)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div class="card-body" style="padding:16px 18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;font-weight:800;">${mat.icon||'📚'} ${mat.name}</div>
            <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:2px;">${mat.code||''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:26px;font-weight:800;line-height:1;color:${sc};">${t?total.toFixed(1):'—'}</div>
            <div style="font-size:10px;color:var(--text3);">/ ${maxT} pts</div>
          </div>
        </div>
        <div class="prog-bar" style="margin-bottom:8px;"><div class="prog-fill" style="background:${border};width:${Math.min(pct,100)}%;"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:${sc};">${sl}</span>
          <span style="font-size:10px;color:var(--text3);">${pct.toFixed(1)}%</span>
        </div>
      </div>
    </div>`;
  }).join('') || `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);">📚 Sin materias. Agrega una desde <b>Materias</b>.</div>`;
}

// ── SEMESTRES AS CARDS ────────────────────────────────────────
function renderSemestresList() {
  const container = document.getElementById('semestres-list');
  if (!container) return;
  if (!State.semestres.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">🗂️ Sin semestres. Crea el primero.</div>`;
    return;
  }
  container.innerHTML = State.semestres.map(sem => {
    const gpa = calcSemesterGPA(sem.id);
    const isActive = sem.activo;
    const isClosed = sem.cerrado;
    const avg = gpa.promedioSemestre;
    const obj = sem.promedioObjetivo || 70;
    const avgColor = avg === null ? 'var(--text3)' : avg >= obj ? '#4ade80' : avg >= obj*.8 ? '#fbbf24' : '#f87171';
    const matCount = sem.materias.filter(m => !m.parentId).length;
    const taskDone = (sem.tasks||[]).filter(t => t.done).length;
    const taskCount = (sem.tasks||[]).length;
    const border = isActive ? 'var(--accent)' : isClosed ? 'var(--border)' : 'var(--border)';
    const statusLabel = isClosed ? '🔒 Cerrado' : isActive ? '✅ Activo' : '📁 Archivado';
    const statusColor = isClosed ? 'var(--text3)' : isActive ? 'var(--green)' : 'var(--text2)';
    return `
      <div class="card sem-hub-card" style="border:2px solid ${border};overflow:hidden;">
        <div class="card-body" style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-size:15px;font-weight:800;">🗂️ ${sem.nombre}
                ${isActive ? `<span style="font-size:9px;font-family:'Space Mono',monospace;background:rgba(124,106,255,.2);color:var(--accent2);padding:2px 7px;border-radius:4px;margin-left:6px;vertical-align:middle;">ACTIVO</span>` : ''}
              </div>
              <div style="font-size:11px;color:${statusColor};margin-top:3px;">${statusLabel} · obj: ${obj} pts</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:28px;font-weight:800;color:${avgColor};">${avg !== null ? avg.toFixed(1) : '—'}</div>
              <div style="font-size:10px;color:var(--text3);">promedio</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:var(--surface2);border-radius:10px;padding:10px;">
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--accent2);">${gpa.totalCreditos}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">CRÉDITOS</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--green);">${matCount}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">MATERIAS</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--blue);">${taskDone}/${taskCount}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">TAREAS</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${!isActive && !isClosed ? `<button class="btn btn-primary btn-sm" onclick="switchSemester('${sem.id}');event.stopPropagation()">↩ Activar</button>` : ''}
            ${!isClosed ? `<button class="btn btn-ghost btn-sm" onclick="openSemestreEditModal('${sem.id}');event.stopPropagation()">✏️ Editar</button>` : ''}
            ${!isClosed && !isActive ? `<button class="btn btn-danger btn-sm" onclick="closeSemester('${sem.id}');event.stopPropagation()">🔒 Cerrar</button>` : ''}
            ${State.semestres.length > 1 && !isActive ? `<button class="btn btn-danger btn-sm" onclick="deleteSemester('${sem.id}');event.stopPropagation()">🗑️</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderStats() {

  const ctx1 = document.getElementById('chart-grades');
  if (!ctx1) return;
  const labels  = State.materias.map(m => m.code);
  const data    = State.materias.map(m => { const t = calcTotal(m.id); return t ? parseFloat(t.total.toFixed(1)) : 0; });
  const maxVals = State.materias.map(m => m.zones.reduce((a,z)=>a+z.maxPts,0));
  const colors  = State.materias.map(m => m.color);

  const canvas = ctx1; canvas.width = canvas.offsetWidth || 600; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { left:10, right:10, top:20, bottom:40 };
  const barW = (W - pad.left - pad.right) / (labels.length * 2);
  ctx.clearRect(0,0,W,H);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  ctx.fillStyle = isDark ? '#2a2a38' : '#e5e7eb';
  ctx.strokeStyle = isDark ? '#2a2a38' : '#e5e7eb';

  data.forEach((v,i) => {
    const maxV = maxVals[i] || 100;
    const x = pad.left + i*(barW*2) + barW*0.5;
    const barH = ((v/maxV) * (H - pad.top - pad.bottom));
    const y = H - pad.bottom - barH;
    ctx.fillStyle = colors[i] + 'cc';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, [4,4,0,0]);
    else ctx.rect(x,y,barW,barH);
    ctx.fill();

    ctx.fillStyle = isDark ? '#9090a8' : '#6b7280';
    ctx.font = '10px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW/2, H - 10);

    ctx.fillStyle = colors[i];
    ctx.font = 'bold 11px Syne, sans-serif';
    ctx.fillText(v || '—', x + barW/2, y - 6);
  });

  const ctx2 = document.getElementById('chart-tasks');
  if (!ctx2) return;
  const done    = State.tasks.filter(t=>t.done).length;
  const pending = State.tasks.filter(t=>!t.done).length;
  const total   = done + pending;
  ctx2.width = ctx2.height = 160;
  const c2 = ctx2.getContext('2d');
  c2.clearRect(0,0,160,160);
  if (total > 0) {
    const startAngle = -Math.PI/2;
    const doneAngle  = (done/total) * 2*Math.PI;
    c2.beginPath(); c2.moveTo(80,80);
    c2.arc(80,80,70,startAngle,startAngle+doneAngle); c2.closePath();
    c2.fillStyle = '#4ade80'; c2.fill();
    c2.beginPath(); c2.moveTo(80,80);
    c2.arc(80,80,70,startAngle+doneAngle,startAngle+2*Math.PI); c2.closePath();
    c2.fillStyle = isDark?'#2a2a38':'#e5e7eb'; c2.fill();

    c2.beginPath(); c2.arc(80,80,44,0,2*Math.PI); c2.fillStyle=isDark?'#111118':'#ffffff'; c2.fill();

    c2.fillStyle=isDark?'#e8e8f0':'#111827';
    c2.font='bold 22px Syne,sans-serif'; c2.textAlign='center'; c2.textBaseline='middle';
    c2.fillText(total>0?Math.round(done/total*100)+'%':'0%',80,80);
  }

  const statsEl = document.getElementById('stats-summary');
  if (statsEl) {
    const tots2   = State.materias.map(m=>calcTotal(m.id)).filter(Boolean);
    const gpaData = calcSemesterGPA(getActiveSem().id);
    const avg     = gpaData.promedioSemestre !== null ? gpaData.promedioSemestre.toFixed(1) : '—';
    const highest = tots2.length ? tots2.reduce((a,b)=>b.total>a.total?b:a) : null;
    const atRisk  = State.materias.filter(m=>{ const t=calcTotal(m.id); return t && t.total < State.settings.minGrade*0.8; }).length;
    statsEl.innerHTML = `
      <div class="stat-mini"><div class="stat-mini-lbl">📊 PROM. PONDERADO</div><div class="stat-mini-val" style="color:#7c6aff;">${avg}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">${gpaData.totalCreditos} créditos</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">🏆 MEJOR MATERIA</div><div class="stat-mini-val" style="color:#4ade80;font-size:15px;">${highest ? State.materias.find(m=>calcTotal(m.id)?.total===highest.total)?.name||'—' : '—'}</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">⚠️ EN RIESGO</div><div class="stat-mini-val" style="color:#f87171;">${atRisk}</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">✅ CRED. APROBADOS</div><div class="stat-mini-val" style="color:#60a5fa;">${gpaData.creditosAprobados}/${gpaData.totalCreditos}</div></div>`;
  }
}

function globalSearch(q) {
  if (!q.trim()) { _el('search-results').style.display='none'; return; }
  const ql = q.toLowerCase();
  const results = [];
  State.tasks.forEach(t => {
    if (t.title.toLowerCase().includes(ql) || (t.notes||'').toLowerCase().includes(ql))
      results.push({ type:'task', icon:'✅', label:t.title, sub: getMat(t.matId).name||'', id:t.id });
  });
  State.events.forEach(e => {
    if (e.title.toLowerCase().includes(ql))
      results.push({ type:'event', icon:'📅', label:e.title, sub: getMat(e.matId).name||'', id:e.id });
  });
  State.materias.forEach(m => {
    if (m.name.toLowerCase().includes(ql) || m.code.toLowerCase().includes(ql))
      results.push({ type:'materia', icon:m.icon||'📚', label:m.name, sub:m.code, id:m.id });
  });
  const box = _el('search-results');
  if (!results.length) {
    box.innerHTML = `<div style="padding:12px 14px;color:var(--text3);font-size:13px;">Sin resultados para "${q}"</div>`;
  } else {
    box.innerHTML = results.slice(0,8).map(r => `
      <div class="search-result-item" onclick="searchGoTo('${r.type}','${r.id}')">
        <span style="font-size:16px;">${r.icon}</span>
        <div><div style="font-size:13px;font-weight:600;">${r.label}</div><div style="font-size:11px;color:var(--text3);">${r.sub}</div></div>
      </div>`).join('');
  }
  box.style.display = 'block';
}
function searchGoTo(type, id) {
  _el('search-results').style.display='none';
  document.getElementById('global-search').value = '';
  if (type==='task')    { goPage('tareas',document.querySelector('[onclick*=tareas]')); setTimeout(()=>{ document.getElementById('search-input').value=''; renderTasks(); },200); }
  if (type==='event')   goPage('calendario',document.querySelector('[onclick*=calendario]'));
  if (type==='materia') goPage('materias',document.querySelector('[onclick*=materias]'));
}

let pomI=null, pomR=false, pomB=false, pomSL=0, pomTS=0, pomD=0;

let _pomAudioCtx = null;
function initAudioContext() {
  if (_pomAudioCtx) return _pomAudioCtx;
  try {
    _pomAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_pomAudioCtx.state === 'suspended') _pomAudioCtx.resume();
  } catch(e) { console.warn('AudioContext init failed', e); }
  return _pomAudioCtx;
}

document.addEventListener('click', function _unlockAudio() {
  initAudioContext();
  document.removeEventListener('click', _unlockAudio);
}, { once: true, passive: true });

function _pomAudio() { return initAudioContext(); }
function pomPlayAlarm(isBreak) {
  try {
    const ctx = _pomAudio();
    const _doPlay = () => {
      const now = ctx.currentTime;
      const notes = isBreak ? [523,659,784,1047] : [880,659,523];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = isBreak ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const t = now + i * 0.20;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
        osc.start(t); osc.stop(t + 0.55);
      });
    };
    if (ctx.state === 'suspended') ctx.resume().then(_doPlay).catch(e => console.warn('Alarm resume failed', e));
    else _doPlay();
  } catch(e) { console.warn('Alarm audio failed', e); }
}

// Short beep for UI events
function _pomBeep(type) {
  try {
    const ctx = _pomAudio();
    if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'start') {
        // Two ascending soft tones
        [[440, 0], [550, 0.12]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.22, now+delay+0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.28);
          o.start(now+delay); o.stop(now+delay+0.3);
        });
      } else if (type === 'pause') {
        // One descending soft tone
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now);
        o.frequency.linearRampToValueAtTime(330, now+0.18);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now+0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.22);
        o.start(now); o.stop(now+0.25);
      } else if (type === 'break') {
        // Three soft ascending pleasant tones — "relax"
        [[392,0],[494,0.15],[587,0.30]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.25, now+delay+0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.45);
          o.start(now+delay); o.stop(now+delay+0.5);
        });
      } else if (type === 'resume') {
        // Work resume: short energetic ascending double
        [[523,0],[659,0.10]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.2, now+delay+0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.2);
          o.start(now+delay); o.stop(now+delay+0.22);
        });
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// UI SOUND SYSTEM — subtle click/feedback sounds + white noise
// ══════════════════════════════════════════════════════════════
let _uiSoundsEnabled = true;
let _noiseNode = null, _noiseGain = null, _noiseType = null;
let _noiseVol = 0.30;

function toggleUiSounds() {
  _uiSoundsEnabled = !_uiSoundsEnabled;
  const btn = document.getElementById('ui-sound-btn');
  if (btn) btn.textContent = _uiSoundsEnabled ? '🔔' : '🔕';
  // If disabling, play one last click so user hears feedback
  if (!_uiSoundsEnabled) { _uiSoundsEnabled = true; _uiClick('off'); _uiSoundsEnabled = false; }
  localStorage.setItem('academia_ui_sounds', _uiSoundsEnabled ? '1' : '0');
}

// Central UI sound dispatcher
function _uiClick(type) {
  if (!_uiSoundsEnabled) return;
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const variant = (typeof State !== 'undefined' && State.settings?.soundVariant) || 'classic';
    // Volume multiplier per variant
    const vol = variant === 'minimal' ? 0.5 : variant === 'digital' ? 0.6 : 1.0;
    // Oscillator type per variant
    const oType = variant === 'digital' ? 'square' : 'sine';
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'nav') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 480;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+0.08);
          o.start(now); o.stop(now+0.1);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 600;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.setValueAtTime(0.04*vol, now+0.03); g.gain.linearRampToValueAtTime(0, now+0.04);
          o.start(now); o.stop(now+0.05);
        } else {
          // Classic nav: soft warm tap
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(520, now+0.06);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.12);
          o.start(now); o.stop(now+0.15);
        }
      } else if (type === 'click') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(800, now); o.frequency.exponentialRampToValueAtTime(600, now+0.05);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.exponentialRampToValueAtTime(0.001, now+0.06);
          o.start(now); o.stop(now+0.07);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 1200;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.002); g.gain.setValueAtTime(0.04*vol, now+0.04); g.gain.linearRampToValueAtTime(0, now+0.05);
          o.start(now); o.stop(now+0.06);
        } else {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 660;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05*vol, now+0.008); g.gain.exponentialRampToValueAtTime(0.001, now+0.07);
          o.start(now); o.stop(now+0.08);
        }
      } else if (type === 'modal-open') {
        if (variant === 'digital') {
          [[800,0],[1000,0.04],[1200,0.08]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.035*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.06);
            o.start(now+d); o.stop(now+d+0.07);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=520;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.04*vol,now+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
          o.start(now); o.stop(now+0.12);
        } else {
          [[440,0],[554,0.05],[659,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.06*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.15);
            o.start(now+d); o.stop(now+d+0.18);
          });
        }
      } else if (type === 'modal-close') {
        if (variant === 'digital') {
          [[1000,0],[800,0.04]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.03*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.05);
            o.start(now+d); o.stop(now+d+0.06);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=400;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.03*vol,now+0.008); g.gain.exponentialRampToValueAtTime(0.001,now+0.07);
          o.start(now); o.stop(now+0.08);
        } else {
          [[659,0],[554,0.05],[440,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.05*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.12);
            o.start(now+d); o.stop(now+d+0.15);
          });
        }
      } else if (type === 'task-done') {
        // Celebratory ascending ding
        const freqs = variant === 'digital' ? [[800,0],[1000,0.07],[1200,0.14]] : [[523,0],[659,0.09],[784,0.18],[1047,0.29]];
        freqs.forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.14*vol, now+d+0.03); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.35);
          o.start(now+d); o.stop(now+d+0.40);
        });
      } else if (type === 'task-undone') {
        [[523,0],[415,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.07*vol, now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.15);
          o.start(now+d); o.stop(now+d+0.18);
        });
      } else if (type === 'save') {
        [[660,0],[880,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.09*vol, now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.12);
          o.start(now+d); o.stop(now+d+0.14);
        });
      } else if (type === 'delete') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = oType; o.frequency.setValueAtTime(220, now); o.frequency.linearRampToValueAtTime(110, now+0.12);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.18);
        o.start(now); o.stop(now+0.20);
      } else if (type === 'off') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(220, now+0.2);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.25);
        o.start(now); o.stop(now+0.28);
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ── WHITE / BROWN / RAIN NOISE ────────────────────────────────
function _buildNoiseBuffer(ctx, type) {
  const sr = ctx.sampleRate;
  const bufSize = sr * 3; // 3 sec loop
  const buf = ctx.createBuffer(1, bufSize, sr);
  const data = buf.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i]; data[i] *= 3.5;
    }

  } else if (type === 'rain') {
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      const env = 0.6 + 0.4 * Math.sin(i * 0.0003) * Math.sin(i * 0.00007);
      data[i] = w * env;
    }

  } else if (type === 'fire') {
    // Crackling fire: low rumble + random sharp crackles
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      // Brown base
      data[i] = (last + 0.015 * w) / 1.015;
      last = data[i]; data[i] *= 4;
      // Random crackles
      if (Math.random() < 0.0008) data[i] += (Math.random() - 0.5) * 2.5;
      // Slow breathing envelope
      const breathe = 0.7 + 0.3 * Math.sin(i * 0.00015) * Math.sin(i * 0.00004);
      data[i] *= breathe;
    }

  } else if (type === 'cafe') {
    // Coffee shop: low murmur base + occasional distant clinking
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.01 * w) / 1.01;
      last = data[i]; data[i] *= 2.5;
      // Occasional "clink" sounds
      if (Math.random() < 0.00015) {
        const clinkLen = Math.floor(sr * 0.05);
        for (let k = 0; k < clinkLen && i + k < bufSize; k++) {
          data[i + k] += Math.sin(k * 0.8) * Math.exp(-k * 0.05) * 0.4;
        }
      }
      // Room tone modulation
      const room = 0.5 + 0.5 * Math.abs(Math.sin(i * 0.00002));
      data[i] *= room;
    }

  } else if (type === 'forest') {
    // Forest: wind base + chirping birds
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.018 * w) / 1.018;
      last = data[i]; data[i] *= 1.8;
      // Wind sway
      const wind = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(i * 0.00008) * Math.sin(i * 0.000023));
      data[i] *= wind;
      // Bird chirps
      if (Math.random() < 0.0002) {
        const chirpLen = Math.floor(sr * 0.12);
        const chirpFreq = 2200 + Math.random() * 1400;
        for (let k = 0; k < chirpLen && i + k < bufSize; k++) {
          const t = k / sr;
          const env2 = Math.exp(-k / (chirpLen * 0.4));
          data[i + k] += Math.sin(2 * Math.PI * chirpFreq * t) * env2 * 0.25;
        }
      }
    }

  } else if (type === 'ocean') {
    // Ocean waves: rhythmic swell + splash texture
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      // Wave rhythm ~6s cycle
      const wave = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(i * 0.00011));
      const splash = 0.4 + 0.6 * Math.abs(Math.sin(i * 0.00011));
      data[i] = w * wave * splash * 0.8;
      // Low-freq rumble
      if (i > 0) data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
    }
  }
  return buf;
}

function toggleNoise(type) {
  const ctx = initAudioContext();
  if (!ctx) return;
  if (_noiseType === type && _noiseNode) { _stopNoise(); return; }
  _stopNoise();
  _uiClick('click');

  const _start = () => {
    try {
      const buf = _buildNoiseBuffer(ctx, type);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      _noiseGain = ctx.createGain();
      _noiseGain.gain.value = _noiseVol;

      // Apply type-specific filters
      if (type === 'rain') {
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200; f.Q.value=0.7;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'brown') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'fire') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600; f.Q.value=0.5;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'cafe') {
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=800; f.Q.value=0.4;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'forest') {
        const f = ctx.createBiquadFilter(); f.type='lowshelf'; f.frequency.value=200; f.gain.value=-4;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'ocean') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400;
        src.connect(f); f.connect(_noiseGain);
      } else {
        src.connect(_noiseGain);
      }

      _noiseGain.connect(ctx.destination);
      _noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      _noiseGain.gain.linearRampToValueAtTime(_noiseVol, ctx.currentTime + 0.8);
      src.start();
      _noiseNode = src; _noiseType = type;
      _updateNoiseButtons();

      // Update "now playing" label
      const labels = { white:'Ruido Blanco', brown:'Ruido Café', rain:'Lluvia', fire:'🔥 Fuego', cafe:'☕ Café', forest:'🌿 Bosque', ocean:'🌊 Océano' };
      const np = document.getElementById('sound-now-playing');
      if (np) np.textContent = '▶ ' + (labels[type] || type);
    } catch(e) { console.warn('Noise error', e); }
  };

  if (ctx.state === 'suspended') ctx.resume().then(_start).catch(() => {}); else _start();
}

function _stopNoise() {
  if (_noiseNode) {
    try {
      if (_noiseGain && _pomAudioCtx) {
        _noiseGain.gain.linearRampToValueAtTime(0, _pomAudioCtx.currentTime + 0.4);
        const n = _noiseNode;
        setTimeout(() => { try { n.stop(); } catch(e) {} }, 450);
      } else { _noiseNode.stop(); }
    } catch(e) {}
    _noiseNode = null; _noiseGain = null;
  }
  _noiseType = null;
  _updateNoiseButtons();
  const np = document.getElementById('sound-now-playing');
  if (np) np.textContent = '— Sin sonido —';
}

function _updateNoiseButtons() {
  ['white','brown','rain','fire','cafe','forest','ocean'].forEach(t => {
    const btn  = document.getElementById('noise-' + t + '-btn');
    const icon = document.getElementById('noise-' + t + '-icon');
    if (btn)  btn.classList.toggle('playing', _noiseType === t);
    if (icon) icon.textContent = _noiseType === t ? '⏸' : '▶';
  });
}

function setNoiseVol(v) {
  _noiseVol = parseInt(v) / 100;
  if (_noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.1);
  }
}

// ── INTEGRATE UI SOUNDS INTO EXISTING FUNCTIONS ───────────────
// Attach sound to all .btn clicks globally
document.addEventListener('click', e => {
  if (!_uiSoundsEnabled) return;
  const btn = e.target.closest('.btn, .nav-item, .mobile-nav-item, .task-check, .notes-folder-item');
  if (!btn) return;
  // Skip noise buttons (they handle their own sound)
  const skipIds = ['noise-white-btn','noise-brown-btn','noise-rain-btn','noise-fire-btn','noise-cafe-btn','noise-forest-btn','noise-ocean-btn','ui-sound-btn'];
  if (skipIds.some(id => btn.id === id)) return;
  // Skip pom-btn (has its own sounds)
  if (btn.id === 'pom-btn') return;
  // Determine sound type from context
  const onclick = btn.getAttribute('onclick') || '';
  if (btn.classList.contains('nav-item') || btn.classList.contains('mobile-nav-item')) {
    _uiClick('nav'); return;
  }
  if (btn.classList.contains('task-check')) {
    // Sound played inside toggleTask itself
    return;
  }
  if (onclick.includes('closeModal') || onclick.includes('modal-close') || btn.classList.contains('modal-close')) {
    _uiClick('modal-close'); return;
  }
  if (onclick.match(/open\w*Modal|Modal\w*open|\bopen[A-Z]/i)) {
    _uiClick('modal-open'); return;
  }
  if (onclick.match(/save[A-Z]|Save|create[A-Z]|Create|guardar/i)) {
    _uiClick('save'); return;
  }
  if (onclick.match(/delete[A-Z]|Delete|eliminar|remove/i)) {
    _uiClick('delete'); return;
  }
  _uiClick('click');
}, true); // capture phase

// Init: load ui sounds preference
(function _initUiSoundsPref() {
  const saved = localStorage.getItem('academia_ui_sounds');
  if (saved === '0') { _uiSoundsEnabled = false; const btn = document.getElementById('ui-sound-btn'); if (btn) btn.textContent = '🔕'; }
})();
let _mp3Playing = false;

function loadLocalMusic(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const audio = _el('pom-audio');
  if (!audio) return;

  if (audio._objectURL) URL.revokeObjectURL(audio._objectURL);
  const url = URL.createObjectURL(file);
  audio._objectURL = url;
  audio.src = url;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  _mp3Ready = true;
  _mp3Playing = false;

  const btn = document.getElementById('pom-music-btn');
  if (btn) btn.style.display = 'inline-flex';
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-label').textContent  = file.name.replace(/\.[^.]+$/,'').slice(0,28);
  document.getElementById('pom-music-status').textContent = `📁 ${file.name} · listo`;
}

function togglePomMusic() {
  if (!_mp3Ready) {
    document.getElementById('pom-mp3-input')?.click();
    return;
  }
  _mp3Playing ? _mp3Stop() : _mp3Start();
}
function _mp3Start() {
  const audio = _el('pom-audio');
  if (!audio || !_mp3Ready) return;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  audio.play().catch(e => console.warn('Audio play failed', e));
  _mp3Playing = true;
  document.getElementById('pom-music-btn')?.classList.add('playing');
  document.getElementById('pom-music-icon').textContent   = '⏸';
  document.getElementById('pom-music-status').textContent = '🎵 Reproduciendo en bucle';
}
function _mp3Stop() {
  const audio = _el('pom-audio');
  if (audio) audio.pause();
  _mp3Playing = false;
  document.getElementById('pom-music-btn')?.classList.remove('playing');
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-status').textContent = '⏸ Pausado · presiona ▶ para continuar';
}
function setPomVol(v) {
  const audio = _el('pom-audio');
  if (audio) audio.volume = parseInt(v) / 100;
}

function pomWork()  { return (parseInt(document.getElementById('pom-work')?.value)||25)*60; }
function pomBreak() { return (parseInt(document.getElementById('pom-break')?.value)||5)*60; }
function pomReset() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomB=false; pomSL=pomTS=pomWork();
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp();
}

// ── Countdown beep (5s before switch) ────────────────────────
function _pomCountdownBeep(secsLeft) {
  try {
    const ctx = _pomAudio(); if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      const freq = secsLeft === 1 ? 880 : 600;
      const dur  = secsLeft === 1 ? 0.30 : 0.12;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur + 0.02);
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do); else _do();
  } catch(e) {}
}

// ── Pause/resume music when switching phases ──────────────────
function _pomMusicOnBreak() {
  if (_mp3Playing) { _mp3Stop(); _mp3Playing = '_pom_paused'; }
  if (_noiseType && _noiseNode && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(0, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = true;
  }
}
function _pomMusicOnWork() {
  if (_mp3Playing === '_pom_paused') { _mp3Playing = false; _mp3Start(); }
  if (_noiseNode && _noiseNode._pausedByPom && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = false;
  }
}

function pomToggle() {
  try { const ctx = _pomAudio(); if (ctx.state === 'suspended') ctx.resume(); } catch(e) {}
  if (pomR) {
    clearInterval(pomI); pomI=null; pomR=false;
    _el('pom-btn').textContent='▶ Reanudar';
    _pomBeep('pause');
    // Notify chrono: pom paused → stop counting work time
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  } else {
    if (pomSL<=0||pomTS===0) pomReset();
    pomR=true; _el('pom-btn').textContent='⏸ Pausar';
    _pomBeep(pomB ? 'break' : 'start');
    // Notify chrono: pom running
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(true, pomB ? 'break' : 'work');
    pomI = setInterval(() => {
      pomSL--; updatePomDisp();
      if (pomSL <= 10 && pomSL > 0) _pomCountdownBeep(pomSL);
      if (pomSL <= 0) {
        clearInterval(pomI); pomI=null; pomR=false;
        pomPlayAlarm(pomB);
        if (!pomB) {
          pomD++;
          const subj = document.getElementById('pom-subject').value;
          const m = getMat(subj);
          State.pomSessions.push({
            subject: m.name||subj||'General',
            time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
            taskId: document.getElementById('pom-task-sel')?.value || '',
            taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
            mins: pomWork() / 60
          });
          _recordPomWeekSession(pomWork() / 60);
          _updateStreak();
          savePom(); renderPomHistory(); renderPomGoal();
          const ovSess = document.getElementById('ov-sessions'); if(ovSess) ovSess.textContent = State.pomSessions.length;
          pomB=true; pomSL=pomTS=pomBreak();
          _pomMusicOnBreak();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
        } else {
          pomB=false; pomSL=pomTS=pomWork();
          _pomMusicOnWork();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
        }
        _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
      }
    }, 1000);
  }
}
function pomSkip() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false;
  if (!pomB) {
    pomD++; pomB=true; pomSL=pomTS=pomBreak(); _pomBeep('break');
    _pomMusicOnBreak();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
  } else {
    pomB=false; pomSL=pomTS=pomWork(); _pomBeep('resume');
    _pomMusicOnWork();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
  }
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
}
function updatePomDisp() {
  const m=Math.floor(pomSL/60), s=pomSL%60;
  document.getElementById('pom-time').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const circ=2*Math.PI*82, prog=pomTS>0?pomSL/pomTS:1;
  const ring=document.getElementById('pom-ring');
  ring.style.strokeDashoffset=circ*(1-prog);
  ring.style.stroke=pomB?'#4ade80':'var(--accent)';
  document.getElementById('pom-mode').textContent=pomB?'DESCANSO':'ENFOQUE';
}
function updatePomDots() {
  const cycles = parseInt(document.getElementById('pom-cycles')?.value) || 4;
  document.getElementById('pom-dots').innerHTML=Array.from({length:cycles},(_,i)=>
    `<div style="width:9px;height:9px;border-radius:50%;background:${i<pomD%cycles?'var(--accent)':'var(--border2)'};"></div>`
  ).join('');
}
function renderPomHistory() {
  const hist = document.getElementById('pom-history'); if (!hist) return;
  const sess = State.pomSessions;
  if (!sess.length) {
    hist.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3);">⏱️ Sin sesiones hoy aún<br><span style="font-size:11px;margin-top:6px;display:block;">¡Inicia tu primera sesión!</span></div>`;
  } else {
    hist.innerHTML = sess.slice().reverse().map((s, i) => {
      const num = sess.length - i;
      const partialBadge = s.partial ? `<span style="font-size:9px;background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:4px;padding:1px 5px;font-family:'Space Mono',monospace;">PARCIAL</span>` : '';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);border-left:3px solid ${s.partial?'#fbbf24':'var(--accent)'};">
        <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);font-weight:700;flex-shrink:0;padding-top:1px;">#${num}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">${s.subject} ${partialBadge}</div>
          ${s.taskTitle && !s.taskTitle.includes('Sin tarea') ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">📋 ${s.taskTitle.replace(/^[^\s]+ /,'').split(' · ')[0].substring(0,40)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${s.time} · ${s.mins||25} min enfocado</div>
        </div>
        <div style="font-size:18px;">${s.partial ? '⏳' : '✅'}</div>
      </div>`;
    }).join('');
  }
  // Update stats
  const totalEl = document.getElementById('pom-stat-total');
  const minsEl  = document.getElementById('pom-stat-mins');
  if (totalEl) totalEl.textContent = sess.length;
  if (minsEl)  minsEl.textContent  = sess.reduce((a,s) => a + (s.mins||25), 0);
  renderPomGoal();
}

function renderPomGoal() {
  const goal = parseInt(document.getElementById('pom-goal')?.value) || 4;
  const done = State.pomSessions.length;
  const pct  = Math.min((done / goal) * 100, 100);
  const doneEl  = document.getElementById('pom-goal-done');
  const barEl   = document.getElementById('pom-goal-bar');
  const labelEl = document.getElementById('pom-goal-label');
  const streakEl = document.getElementById('pom-stat-streak');
  if (doneEl)  doneEl.textContent  = done;
  if (barEl)   barEl.style.width   = pct + '%';
  if (barEl)   barEl.style.background = pct >= 100 ? '#4ade80' : 'var(--accent2)';
  if (labelEl) labelEl.textContent = pct >= 100
    ? `🎉 ¡Meta alcanzada! ${done} sesiones hoy`
    : `${done} de ${goal} sesiones · ${Math.round(pct)}%`;
  // Streak
  if (streakEl) {
    const sd = typeof _getStreakData === 'function' ? _getStreakData() : {count:0};
    streakEl.textContent = `🔥 ${sd.count}`;
  }
  // Week stats
  _renderPomWeekStats();
}

function _getPomWeekHistory() {
  try { return JSON.parse(localStorage.getItem('academia_pom_week') || '[]'); } catch(e) { return []; }
}
function _savePomWeekHistory(arr) {
  try { localStorage.setItem('academia_pom_week', JSON.stringify(arr)); } catch(e) {} 
}
function _recordPomWeekSession(mins) {
  const arr = _getPomWeekHistory();
  const today = new Date().toISOString().slice(0,10);
  arr.push({ date: today, mins: mins || 0 });
  // Keep last 60 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const cutStr = cutoff.toISOString().slice(0,10);
  _savePomWeekHistory(arr.filter(s => s.date >= cutStr));
}
function _renderPomWeekStats() {
  const arr = _getPomWeekHistory();
  const today = new Date();
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6-i));
    return d.toISOString().slice(0,10);
  });
  const weekSessions = arr.filter(s => days.includes(s.date));
  const weekMins = weekSessions.reduce((a,s) => a + (s.mins||0), 0);
  const wsEl = document.getElementById('pom-stat-week-sessions');
  const wmEl = document.getElementById('pom-stat-week-mins');
  if (wsEl) wsEl.textContent = weekSessions.length;
  if (wmEl) wmEl.textContent = weekMins;
  // Mini bar chart
  const barsEl = document.getElementById('pom-week-bars');
  if (barsEl) {
    const maxMins = Math.max(1, ...days.map(d => arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0)));
    const dayNames = ['D','L','M','X','J','V','S'];
    barsEl.innerHTML = days.map(d => {
      const mins = arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0);
      const h = Math.round((mins / maxMins) * 36) || 2;
      const isToday = d === today.toISOString().slice(0,10);
      const dd = new Date(d); const dayIdx = dd.getDay();
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
        <div title="${mins} min" style="width:100%;height:${h}px;background:${isToday?'var(--accent2)':'var(--accent)'};border-radius:3px 3px 0 0;opacity:${mins>0?1:0.2};min-height:2px;"></div>
        <div style="font-size:8px;color:${isToday?'var(--accent2)':'var(--text3)'};font-family:'Space Mono',monospace;">${dayNames[dayIdx]}</div>
      </div>`;
    }).join('');
  }
}

function pomSavePartial() {
  const totalWork = pomWork();
  const elapsed = pomB ? totalWork : (totalWork - pomSL);
  if (elapsed < 60) { alert('Debes estudiar al menos 1 minuto para guardar.'); return; }
  const mins = Math.round(elapsed / 60);
  const subj = document.getElementById('pom-subject')?.value;
  const m    = getMat(subj);
  State.pomSessions.push({
    subject: m.name || subj || 'General',
    time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
    taskId: document.getElementById('pom-task-sel')?.value || '',
    taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
    mins, partial: true
  });
  _recordPomWeekSession(mins);
  _updateStreak(); // fix racha
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomReset();
  // Stop chrono if synced
  if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  if (typeof chronoR !== 'undefined' && chronoR) {
    chronoR = false;
    if (chronoI) { clearInterval(chronoI); chronoI=null; }
    const btn = document.getElementById('chrono-btn');
    if (btn) btn.textContent = '▶ Iniciar';
    const badge = document.getElementById('chrono-mode-badge');
    if (badge) badge.textContent = 'GUARDADO';
    if (typeof _chronoUpdateUI !== 'undefined') _chronoUpdateUI();
  }
  savePom(); renderPomHistory(); renderPomGoal();
  alert(`✅ Sesión parcial guardada: ${mins} min de estudio`);
}

function clearPomHistory() {
  if (!confirm('¿Limpiar historial de sesiones de hoy?')) return;
  State.pomSessions = [];
  savePom();
  renderPomHistory();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  State.settings.theme = newTheme;
  saveState(['settings']);
  document.getElementById('theme-btn').textContent = newTheme==='dark' ? '☀️' : '🌙';
}

function _applyFont(fontName) {
  const fontMap = {
    'Syne': "'Syne', sans-serif",
    'Inter': "'Inter', sans-serif",
    'JetBrains Mono': "'JetBrains Mono', monospace",
    'Playfair Display': "'Playfair Display', serif"
  };
  const fontVal = fontMap[fontName] || "'Syne', sans-serif";
  document.documentElement.style.setProperty('--app-font', fontVal);
}

function setFont(fontName) {
  _applyFont(fontName);
  State.settings.font = fontName;
  saveState(['settings']);
}

function _applyAccentColor(hex) {
  // Convert hex to rgb values for the glow effects
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  // Calculate lighter accent2 (lighter version)
  const lr = Math.min(255, r + 40);
  const lg = Math.min(255, g + 40);
  const lb = Math.min(255, b + 40);
  const toHex = n => n.toString(16).padStart(2,'0');
  const accent2 = `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent2', accent2);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},.15)`);
  // Update active nav item border color variable
  document.documentElement.style.setProperty('--btn-primary-glow', `rgba(${r},${g},${b},.35)`);
  // Update light theme accent too
  document.querySelectorAll('.accent-color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === hex);
  });
}

function setAccentColor(hex) {
  _applyAccentColor(hex);
  State.settings.accentColor = hex;
  saveState(['settings']);
}

function setSoundVariant(variant) {
  State.settings.soundVariant = variant;
  saveState(['settings']);
}

function openQuickAdd() { _uiClick('modal-open'); document.getElementById('modal-quickadd').classList.add('open'); }
function closeModal(id) { _uiClick('modal-close'); document.getElementById(id)?.classList.remove('open'); }

function _getGreeting() {
  const h     = new Date().getHours();
  const name  = State.settings?.profile?.name?.split(' ')[0] || 'Ingeniero';
  const salud = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${salud}, ${name} 👋`;
}

function init() {
  const now = new Date();
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('ov-date').textContent     = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();
  // Start live clock (12hr format, top-right of overview)
  function _updateOvClock() {
    const d = new Date();
    let h = d.getHours(); const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    // Sun/moon/stars icon based on time
    let icon = '☀️'; // default day
    if (h >= 5 && h < 7)   icon = '🌅'; // dawn
    else if (h >= 7 && h < 18)  icon = '☀️'; // day
    else if (h >= 18 && h < 20) icon = '🌆'; // dusk
    else if (h >= 20 || h < 5)  icon = '🌙'; // night
    h = h % 12 || 12;
    const hStr = String(h).padStart(2,'0');
    const mStr = String(m).padStart(2,'0');
    const clk  = document.getElementById('ov-clock');
    const amp  = document.getElementById('ov-clock-ampm');
    const icn  = document.getElementById('ov-clock-icon');
    if (clk) clk.textContent = `${hStr}:${mStr}`;
    if (amp) amp.textContent = ampm;
    if (icn) icn.textContent = icon;
  }
  _updateOvClock();
  setInterval(_updateOvClock, 10000);
  const h = now.getHours();
  document.getElementById('ov-greeting').textContent = _getGreeting();

  document.documentElement.setAttribute('data-theme', State.settings.theme||'dark');
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = State.settings.theme==='light' ? '🌙' : '☀️';

  // Apply saved font
  _applyFont(State.settings.font || 'Syne');
  // Apply saved accent color
  _applyAccentColor(State.settings.accentColor || '#7c6aff');

  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;

  // ── Precargar perfil de FIUSAC (solo si no hay datos guardados) ──────────
  const _fiusacCourses = [
    { name: "TECNICAS DE ESTUDIO E INVESTIGACION", code: "0005", credits: 3, grade: 77.00, semester: "2024-05" },
    { name: "IDIOMA TECNICO 1",                    code: "0006", credits: 3, grade: 0,     semester: "2024-05", obs: "Equivalencia por examen de ubicación" },
    { name: "IDIOMA TECNICO 2",                    code: "0008", credits: 3, grade: 0,     semester: "2024-05", obs: "Equivalencia por examen de ubicación" },
    { name: "AREA SOCIAL HUMANISTICA 1",           code: "0017", credits: 3, grade: 64.00, semester: "2024-05" },
    { name: "DEPORTES 1",                          code: "0039", credits: 2, grade: 83.00, semester: "2024-05" },
    { name: "AREA MATEMATICA BASICA 1",            code: "0101", credits: 9, grade: 75.00, semester: "2024-07" },
    { name: "IDIOMA TECNICO 3",                    code: "0009", credits: 3, grade: 75.00, semester: "2024-11" },
    { name: "AREA SOCIAL HUMANISTICA 2",           code: "0019", credits: 3, grade: 73.00, semester: "2024-11" },
    { name: "DEPORTES 2",                          code: "0040", credits: 2, grade: 81.00, semester: "2024-11" },
    { name: "MATEMATICA PARA COMPUTACION 1",       code: "0960", credits: 5, grade: 68.00, semester: "2024-11" },
    { name: "ETICA PROFESIONAL",                   code: "0001", credits: 2, grade: 68.00, semester: "2025-05" },
    { name: "IDIOMA TECNICO 4",                    code: "0011", credits: 3, grade: 70.00, semester: "2025-05" },
    { name: "FILOSOFIA DE LA CIENCIA",             code: "0018", credits: 1, grade: 65.00, semester: "2025-05" },
    { name: "FISICA BASICA",                       code: "0147", credits: 5, grade: 64.00, semester: "2025-06" },
    { name: "AREA MATEMATICA BASICA 2",            code: "0103", credits: 9, grade: 64.00, semester: "2025-07" },
    { name: "LOGICA DE SISTEMAS",                  code: "0795", credits: 3, grade: 85.00, semester: "2025-11" },
    { name: "MATEMATICA PARA COMPUTACION 2",       code: "0962", credits: 5, grade: 61.00, semester: "2025-11" },
    { name: "LOGICA",                              code: "0010", credits: 1, grade: 63.00, semester: "2025-12" },
    { name: "INTRODUCCION A LA PROGRAMACION Y COMPUTACION 1", code: "0770", credits: 6, grade: 76.00, semester: "2026-01" },
  ];
  // Cursos con "Aprobado" (equivalencias) — grade 0 los tratamos como aprobados sin nota numérica
  // Para el cálculo de promedio, solo usamos los que tienen nota numérica > 0
  const _fiusacProfile = {
    name: "JOSUE ELIU CASTRO SOSA",
    carrera: "Ingeniería en Ciencias y Sistemas",
    registro: "202405110",
    facultad: "Facultad de Ingeniería · USAC",
    totalCredCarrera: 215
  };
  if (!State.settings.profile || !State.settings.profile.name) {
    State.settings.profile = _fiusacProfile;
    State.settings.approvedCourses = _fiusacCourses;
    saveState(['all']);
  }
  // Update greeting with real name
  const firstName = (State.settings.profile?.name || '').split(' ')[0];
  if (firstName) {
    const grEl = document.getElementById('ov-greeting');
    if (grEl) {
      const gHour = new Date().getHours();
      const greet = gHour < 12 ? 'Buenos días' : gHour < 19 ? 'Buenas tardes' : 'Buenas noches';
      grEl.textContent = `${greet}, ${firstName} 👋`;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  fillMatSels(); fillPomSel(); fillTopicMatSel(); fillNotesSel(); fillExamSel();
  renderOverview(); renderMaterias(); updateBadge(); updatePomDots(); pomReset(); initCal();
  renderSemesterBadge();

  ['cfg-prev-avg','cfg-prev-cred'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateConfigPreview);
  });

  document.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-canvas');
    if (modal?.classList.contains('open')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoCanvas(); }
      if (e.key === 'Escape') { closeModal('modal-canvas'); }
    }
  });

  document.addEventListener('click', e => {
    const sr = _el('search-results');
    const sg = document.getElementById('global-search');
    if (sr && sg && !sr.contains(e.target) && e.target !== sg) sr.style.display='none';
    const p  = document.getElementById('comp-popup');
    if (p && p.style.display==='block' && !p.contains(e.target)) closeCompPopup();

    const dd = document.getElementById('sem-sw-dd');
    const sb = document.querySelector('.sidebar-bottom');
    if (dd && dd.classList.contains('open') && sb && !sb.contains(e.target)) dd.classList.remove('open');
  });

  mgEl?.addEventListener('input', () => {
    State.settings.minGrade = parseFloat(mgEl.value)||70;
    saveState(['settings']);
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target===o) o.classList.remove('open'); })
  );
}

document.addEventListener('DOMContentLoaded', init);





function handleImportFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = importData(e.target.result);
    alert(result.msg);
    if (result.ok) {
      fillMatSels(); fillTopicMatSel(); fillPomSel();
      renderOverview(); renderMaterias(); renderGrades(); renderTasks(); renderCalendar(); updateBadge();
    }
  };
  reader.readAsText(file);
  input.value = '';
}

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const statsPage = document.getElementById('page-estadisticas');
    if (statsPage?.classList.contains('active')) renderStats();
  }, 150);
}, { passive: true });

// Flush any pending debounced saves before page unload
window.addEventListener('beforeunload', () => {
  if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
});

function toggleNavSection(sectionId, headerEl) {
  const sec = document.getElementById(sectionId);
  if (!sec) return;
  const arrowId = sectionId + '-arrow';
  const arrowEl = document.getElementById(arrowId);
  const isOpen  = sec.style.display !== 'none';
  sec.style.display = isOpen ? 'none' : 'block';
  if (arrowEl) arrowEl.textContent = isOpen ? '▸' : '▾';
}

function toggleUsacZone(id) {
  const on  = document.getElementById('uz-' + id + '-on')?.checked;
  const ctrl = document.getElementById('uzc-' + id);
  if (ctrl) ctrl.style.display = on ? 'flex' : 'none';
  updateUsacSuma();
}
function updateUsacSuma() {
  const get = id => parseFloat(document.getElementById('uz-'+id+'-pts')?.value) || 0;
  const on  = id => document.getElementById('uz-'+id+'-on')?.checked;
  let suma = 0;
  ['lab','tar','par','fin','extra'].forEach(z => { if (on(z)) suma += get(z); });
  const el   = document.getElementById('usac-suma-val');
  const hint = document.getElementById('usac-suma-hint');
  if (el) { el.textContent = suma; el.style.color = suma === 100 ? '#4ade80' : '#f87171'; }
  if (hint) hint.textContent = suma === 100 ? '✓ Perfecto' : suma < 100 ? `Faltan ${100-suma} pts` : `Sobran ${suma-100} pts`;
}
function applyUsacZones() {
  const on  = id => document.getElementById('uz-'+id+'-on')?.checked;
  const get = id => parseFloat(document.getElementById('uz-'+id+'-pts')?.value) || 0;
  const getN= id => Math.max(1, parseInt(document.getElementById('uz-'+id+'-n')?.value) || 1);
  const suma = ['lab','tar','par','fin','extra'].reduce((a,z) => a + (on(z) ? get(z) : 0), 0);
  if (suma !== 100) { alert(`La suma debe ser exactamente 100 pts (actualmente ${suma}). Ajusta los valores.`); return; }

  document.getElementById('zones-builder').innerHTML = '';
  zoneRowCount = 0;

  if (on('par')) {
    const pts = get('par'), n = getN('par');
    const sub = Array.from({length:n}, (_,i) => ({ label:`${i+1}er Parcial`, pts: parseFloat((pts/n).toFixed(2)) }));

    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Exámenes Parciales', null, sub);
  }
  if (on('tar')) {
    const pts = get('tar'), n = getN('tar');
    const sub = Array.from({length:n}, (_,i) => ({ label:`Tarea ${i+1}`, pts: parseFloat((pts/n).toFixed(2)) }));
    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Tareas', null, sub);
  }
  if (on('lab')) {
    const pts = get('lab'), n = getN('lab');
    const sub = Array.from({length:n}, (_,i) => ({ label:`Taller ${i+1}`, pts: parseFloat((pts/n).toFixed(2)) }));
    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Taller / Laboratorio', null, sub);
  }
  if (on('fin')) {
    addZoneRow('Examen Final', null, [{ label: 'Final / Retrasada', pts: get('fin') }]);
  }
  if (on('extra')) {
    const name = document.getElementById('uz-extra-name')?.value.trim() || 'Zona Extra';
    addZoneRow(name, null, [{ label: name, pts: get('extra') }]);
  }
}

function updateZonaSuma() { updateUsacSuma(); }
function applyZonaPreset() { applyUsacZones(); }

function renderHorario() {
  const allMats = State.materias.filter(m => (m.dias || m.horario || m.catedratico));
  const container = _el('horario-table-container');
  const detail    = _el('horario-detail-list');
  if (!container || !detail) return;

  const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];

  if (!allMats.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">🗓️ Sin horarios definidos. Edita tus materias y agrega Días/Horas.</div>`;
    detail.innerHTML = '';
    return;
  }

  const slotMap = {};
  allMats.forEach(m => {
    if (!m.dias || !m.horario) return;
    const hr = m.horario.trim();
    if (!slotMap[hr]) slotMap[hr] = {};
    m.dias.split(/[,\s]+/).forEach(d => {
      const dk = d.trim().slice(0,3);
      if (!DAYS.includes(dk)) return;
      if (!slotMap[hr][dk]) slotMap[hr][dk] = [];
      slotMap[hr][dk].push(m);
    });
  });

  const noSlot = allMats.filter(m => !m.horario && m.dias);
  if (noSlot.length) {
    if (!slotMap['Sin hora']) slotMap['Sin hora'] = {};
    noSlot.forEach(m => {
      m.dias.split(/[,\s]+/).forEach(d => {
        const dk = d.trim().slice(0,3);
        if (!DAYS.includes(dk)) return;
        if (!slotMap['Sin hora'][dk]) slotMap['Sin hora'][dk] = [];
        slotMap['Sin hora'][dk].push(m);
      });
    });
  }

  const parseSlotTime = (slot) => {
    if (slot === 'Sin hora') return 9999;
    const m = slot.match(/(\d{1,2}):(\d{2})/);
    if (!m) return 9999;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
  };

  const slots = Object.keys(slotMap).sort((a, b) => parseSlotTime(a) - parseSlotTime(b));
  if (!slots.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">🗓️ Sin horarios definidos.</div>`;
    detail.innerHTML = '';
    return;
  }

  let html = `<table class="horario-table"><thead><tr>
    <th style="width:100px;font-size:11px;">⏰ Hora</th>`;
  DAYS.forEach(d => html += `<th style="font-size:12px;letter-spacing:.5px;">${d}</th>`);
  html += `</tr></thead><tbody>`;

  slots.forEach(slot => {
    const dayData = slotMap[slot];

    html += `<tr>
      <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text2);vertical-align:middle;text-align:center;line-height:1.6;background:var(--surface3);">
        ${slot.replace('–','<br><span style="font-size:9px;color:var(--text3);">↓</span><br>').replace('-','<br><span style="font-size:9px;color:var(--text3);">↓</span><br>')}
      </td>`;
    DAYS.forEach(d => {
      const mats = dayData[d] || [];
      if (!mats.length) {
        html += `<td style="background:var(--surface);"></td>`;
      } else if (mats.length === 1) {
        const m = mats[0];
        html += `<td><div class="horario-cell" style="border-left-color:${m.color};background:${m.color}18;">
          <div style="font-size:10px;font-weight:800;color:${m.color};">${m.icon||'📚'} ${m.name}</div>
          ${m.catedratico ? `<div style="font-size:9px;color:var(--text3);">👤 ${m.catedratico}</div>` : ''}
          ${m.seccion ? `<div style="font-size:9px;color:var(--text3);">Sec. ${m.seccion}</div>` : ''}
        </div></td>`;
      } else {

        html += `<td><div style="display:flex;gap:4px;">`;
        mats.forEach(m => {
          html += `<div class="horario-cell" style="flex:1;min-width:0;border-left-color:${m.color};background:${m.color}18;">
            <div style="font-size:9px;font-weight:800;color:${m.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.icon||'📚'} ${m.name}</div>
            ${m.catedratico ? `<div style="font-size:8px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ${m.catedratico}</div>` : ''}
            <div style="font-size:8px;color:var(--yellow);font-family:'Space Mono',monospace;">⚠ TRASLAPE</div>
          </div>`;
        });
        html += `</div></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  const rootsDetail = allMats.filter(m => !m.parentId);
  detail.innerHTML = rootsDetail.length
    ? rootsDetail.map(m => `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="width:14px;height:14px;border-radius:50%;background:${m.color};margin-top:3px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;">${m.icon||'📚'} ${m.name} <span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">${m.code}</span></div>
          ${m.catedratico ? `<div style="font-size:12px;color:var(--text2);">👤 ${m.catedratico}</div>` : ''}
          ${m.seccion ? `<div style="font-size:11px;color:var(--text3);">Sección: ${m.seccion}</div>` : ''}
          ${m.dias ? `<div style="font-size:11px;color:var(--text3);">📅 ${m.dias}</div>` : ''}
          ${m.horario ? `<div style="font-size:11px;color:var(--text3);">🕐 ${m.horario}</div>` : ''}
        </div>
      </div>`).join('')
    : '<div style="color:var(--text3);padding:20px;text-align:center;">Sin materias con horario definido</div>';
}

function exportHorario() {
  const container = document.getElementById('horario-table-container');
  if (!container || !container.innerHTML.trim()) { alert('Sin horario para exportar.'); return; }
  const win = window.open('','_blank','width=900,height=700');
  const semName = document.querySelector('.sem-val')?.textContent || 'Mi Horario';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Horario</title>
  <style>body{font-family:sans-serif;background:#0a0a0f;color:#e8e8f0;padding:20px;}h2{color:#a892ff;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;}th{background:#18181f;border:1px solid #2a2a38;padding:10px 12px;font-size:11px;color:#9090a8;text-align:center;}
  td{border:1px solid #2a2a38;padding:8px;font-size:11px;min-width:100px;vertical-align:top;background:#111118;}
  .horario-cell{border-radius:7px;padding:6px 8px;font-size:11px;font-weight:700;border-left:3px solid #7c6aff;background:rgba(124,106,255,.12);}
  @media print{body{background:#fff;color:#000;}}</style></head>
  <body><h2>🗓️ ${semName}</h2>${container.innerHTML}
  window.onload=()=>{window.print();}<\/script></body></html>`);
  win.document.close();
}

function renderNotesPage() {
  renderNotesProPage();
}

let _examInterval = null, _examRunning = false, _examSecs = 90*60;

function openExamMode() {
  fillExamSel();
  examReset();
  updateExamSubjectLabel();
  document.getElementById('exam-overlay').classList.add('active');
}
function closeExamMode() {
  examStop();
  document.getElementById('exam-overlay').classList.remove('active');
}
function examReset() {
  examStop();
  const min = parseInt(document.getElementById('exam-min-input')?.value) || 90;
  _examSecs = min * 60;
  updateExamDisplay();
  const btn = document.getElementById('exam-toggle-btn');
  if (btn) btn.textContent = '▶ Iniciar';
}
function examStop() {
  if (_examInterval) { clearInterval(_examInterval); _examInterval = null; }
  _examRunning = false;
}
function examToggle() {
  const btn = document.getElementById('exam-toggle-btn');
  if (_examRunning) {
    examStop();
    if (btn) btn.textContent = '▶ Reanudar';
  } else {
    _examRunning = true;
    if (btn) btn.textContent = '⏸ Pausar';
    initAudioContext();
    _examInterval = setInterval(() => {
      _examSecs--;
      updateExamDisplay();
      if (_examSecs <= 0) {
        examStop();
        pomPlayAlarm(false);
        if (btn) btn.textContent = '⏰ Tiempo!';
      }
    }, 1000);
  }
}
function updateExamDisplay() {
  const m = Math.floor(_examSecs / 60), s = _examSecs % 60;
  const el = _el('exam-countdown');
  if (el) {
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.style.color = _examSecs < 300 ? '#f87171' : _examSecs < 900 ? '#fbbf24' : 'var(--accent2)';
  }
}
function updateExamSubjectLabel() {
  const matId = document.getElementById('exam-mat-sel')?.value || '';
  const mat   = matId ? State.materias.find(m => m.id === matId) : null;
  const lbl   = document.getElementById('exam-subject-label');
  if (lbl) lbl.textContent = mat ? `${mat.icon||'📝'} ${mat.name}` : '— Sin materia seleccionada —';

  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {

    let notesText = '';
    if (matId) {
      const notesArr = State._activeSem.notesArray || [];
      const matNotes = notesArr.filter(n => n.matId === matId);
      if (matNotes.length) {
        notesText = matNotes.map(n => `## ${n.title}\n${n.content}`).join('\n\n---\n\n');
      } else {
        notesText = State.notes[matId] || 'Sin notas para esta materia.';
      }
    }
    notesEl.textContent = notesText;
  }
}

// ══════════════════════════════════════════════════════════════
// NOTES V2 — Folders + Canvas + Big Images + Bug fixes
// ══════════════════════════════════════════════════════════════

function _getNotesArray() {
  const sem = State._activeSem;
  if (!sem.notesArray) sem.notesArray = [];
  return sem.notesArray;
}
function _getFoldersArray() {
  const sem = State._activeSem;
  if (!sem.notesFolders) sem.notesFolders = [];
  return sem.notesFolders;
}

let _currentNoteId   = null;
let _currentFolderId = null; // null = "Todas"
let _noteAutoSaveTimer = null;

// ── RENDER FULL PAGE ──────────────────────────────────────────
function renderNotesProPage() {
  _populateEditorSelects();
  renderFoldersList();
  renderNotesList();
  // BUG FIX: always re-load the current note into the editor
  if (_currentNoteId) {
    const stillExists = _getNotesArray().find(n => n.id === _currentNoteId);
    if (stillExists) _loadNoteInProEditor(_currentNoteId);
    else { _currentNoteId = null; _showNotesEmptyState(); }
  }
}

function _populateEditorSelects() {
  // folder selector in editor
  const fSel = document.getElementById('notes-folder-sel-editor');
  if (fSel) {
    const prev = fSel.value;
    fSel.innerHTML = '<option value="">— Sin carpeta —</option>';
    _getFoldersArray().forEach(f => {
      const o = document.createElement('option');
      o.value = f.id; o.textContent = `${f.icon||'📁'} ${f.name}`;
      fSel.appendChild(o);
    });
    // auto-folders for subjects
    State.materias.filter(m => !m.parentId).forEach(m => {
      const o = document.createElement('option');
      o.value = 'mat_' + m.id;
      o.textContent = `${m.icon||'📚'} ${m.name} (materia)`;
      fSel.appendChild(o);
    });
    if (prev) fSel.value = prev;
  }
  // subject selector in editor
  const mSel = document.getElementById('notes-mat-sel-editor');
  if (mSel) {
    const prev = mSel.value;
    mSel.innerHTML = '<option value="">— Sin materia —</option>';
    State.materias.filter(m => !m.parentId).forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = `${m.icon||'📚'} ${m.name}`;
      mSel.appendChild(o);
    });
    if (prev) mSel.value = prev;
  }
}

// ── FOLDERS ───────────────────────────────────────────────────
function renderFoldersList() {
  const container = document.getElementById('notes-folders-list');
  if (!container) return;
  const folders = _getFoldersArray();
  const notes   = _getNotesArray();

  // Count per folder (including notes in subfolders)
  const countAll = notes.length;
  const countFolder = fid => notes.filter(n => n.folderId === fid).length;

  let html = `<div class="notes-folder-item ${_currentFolderId===null?'active':''}" onclick="selectFolder(null)">
    <span class="notes-folder-icon">📋</span>
    <span class="notes-folder-name">Todas las notas</span>
    <span class="notes-folder-count">${countAll}</span>
  </div>`;

  // Render folders recursively
  const renderFolderTree = (parentId, depth) => {
    const indent = depth * 14;
    // Normalize: treat undefined and null as null
    folders.filter(f => (f.parentId == null ? null : f.parentId) === parentId).forEach(f => {
      const cnt = countFolder(f.id);
      html += `<div class="notes-folder-item ${_currentFolderId===f.id?'active':''}" onclick="selectFolder('${f.id}')" style="padding-left:${10+indent}px;position:relative;">
        <span class="notes-folder-icon" style="color:${f.color||'var(--accent)'};">${depth>0?'↳ ':''}${f.icon||'📁'}</span>
        <span class="notes-folder-name">${f.name}</span>
        <span class="notes-folder-count">${cnt}</span>
        <div style="display:flex;gap:2px;opacity:0;position:absolute;right:4px;top:50%;transform:translateY(-50%);" class="folder-action-btns">
          <button onclick="event.stopPropagation();openNewFolderModal(null,'${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Subcarpeta">+</button>
          <button onclick="event.stopPropagation();openNewFolderModal('${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Editar">✎</button>
          <button onclick="event.stopPropagation();deleteFolder('${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Eliminar">✕</button>
        </div>
      </div>`;
      // Render children
      renderFolderTree(f.id, depth + 1);
    });
  };

  renderFolderTree(null, 0);

  // Subject auto-folders (always shown)
  if (State.materias.filter(m => !m.parentId).length > 0) {
    html += `<div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);padding:8px 10px 3px;letter-spacing:1px;text-transform:uppercase;">Materias</div>`;
    State.materias.filter(m => !m.parentId).forEach(m => {
      const cnt = notes.filter(n => n.matId === m.id || n.folderId === 'mat_' + m.id).length;
      const fid = 'mat_' + m.id;
      html += `<div class="notes-folder-item ${_currentFolderId===fid?'active':''}" onclick="selectFolder('${fid}')">
        <span class="notes-folder-icon" style="color:${m.color||'var(--accent)'};">${m.icon||'📚'}</span>
        <span class="notes-folder-name">${m.name}</span>
        <span class="notes-folder-count">${cnt}</span>
      </div>`;
    });
  }

  container.innerHTML = html;

  // Show action btns on hover
  container.querySelectorAll('.notes-folder-item').forEach(el => {
    el.addEventListener('mouseenter', () => { const b = el.querySelector('.folder-action-btns'); if (b) b.style.opacity='1'; });
    el.addEventListener('mouseleave', () => { const b = el.querySelector('.folder-action-btns'); if (b) b.style.opacity='0'; });
  });
}

function selectFolder(folderId) {
  if (_currentNoteId) _autoCommitNote();
  _currentFolderId = folderId;
  renderFoldersList();
  renderNotesList();
  // Update label
  const lbl = document.getElementById('notes-folder-label');
  if (lbl) {
    if (folderId === null) { lbl.textContent = 'TODAS LAS NOTAS'; return; }
    if (String(folderId).startsWith('mat_')) {
      const matId = folderId.replace('mat_','');
      const mat = State.materias.find(m => m.id === matId);
      lbl.textContent = mat ? (mat.name.toUpperCase()) : folderId;
    } else {
      const f = _getFoldersArray().find(f => f.id === folderId);
      lbl.textContent = f ? f.name.toUpperCase() : folderId;
    }
  }
}

// ── FOLDER MODALS ─────────────────────────────────────────────
let _editingFolderId = null;
let _selectedFolderIcon  = '📁';
let _selectedFolderColor = '#6366f1';

let _newFolderParentId = null;

function openNewFolderModal(folderId, parentId) {
  _editingFolderId = folderId || null;
  _newFolderParentId = parentId || null;
  _selectedFolderIcon  = '📁';
  _selectedFolderColor = '#6366f1';
  document.getElementById('new-folder-name').value = '';
  document.getElementById('new-folder-modal-title').textContent = folderId ? '✏️ Editar Carpeta' : (_newFolderParentId ? '📁 Nueva Subcarpeta' : '📁 Nueva Carpeta');
  document.getElementById('save-folder-btn').textContent = folderId ? 'Guardar' : 'Crear carpeta';
  if (folderId) {
    const f = _getFoldersArray().find(x => x.id === folderId);
    if (f) {
      document.getElementById('new-folder-name').value = f.name;
      _selectedFolderIcon  = f.icon  || '📁';
      _selectedFolderColor = f.color || '#6366f1';
      _newFolderParentId = f.parentId || null;
    }
  }
  // reset pickers visual
  document.querySelectorAll('.folder-icon-opt').forEach(el => {
    el.style.borderColor = el.dataset.icon === _selectedFolderIcon ? 'var(--accent)' : 'transparent';
  });
  document.querySelectorAll('.folder-color-opt').forEach(el => {
    el.style.borderColor = el.dataset.fc === _selectedFolderColor ? 'var(--text)' : 'transparent';
  });
  document.getElementById('modal-new-folder').classList.add('open');
  setTimeout(() => document.getElementById('new-folder-name').focus(), 120);
}

function selectFolderIcon(el) {
  _selectedFolderIcon = el.dataset.icon;
  document.querySelectorAll('.folder-icon-opt').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--accent)';
}
function selectFolderColor(el) {
  _selectedFolderColor = el.dataset.fc;
  document.querySelectorAll('.folder-color-opt').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--text)';
}

function saveNewFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) { document.getElementById('new-folder-name').focus(); return; }
  const folders = _getFoldersArray();
  if (_editingFolderId) {
    const f = folders.find(x => x.id === _editingFolderId);
    if (f) { f.name = name; f.icon = _selectedFolderIcon; f.color = _selectedFolderColor; }
  } else {
    folders.push({ id: 'folder_' + Date.now(), name, icon: _selectedFolderIcon, color: _selectedFolderColor, parentId: _newFolderParentId || null });
  }
  saveState(['all']);
  closeModal('modal-new-folder');
  renderFoldersList();
}

function deleteFolder(folderId) {
  if (!confirm('¿Eliminar esta carpeta? Las notas no se borran.')) return;
  const sem = State._activeSem;
  sem.notesFolders = (sem.notesFolders||[]).filter(f => f.id !== folderId);
  // unlink notes
  _getNotesArray().forEach(n => { if (n.folderId === folderId) n.folderId = ''; });
  if (_currentFolderId === folderId) _currentFolderId = null;
  saveState(['all']);
  renderFoldersList();
  renderNotesList();
}

// ── NOTES LIST ────────────────────────────────────────────────
function renderNotesList() {
  const container = document.getElementById('notes-list-items');
  if (!container) return;

  let notes = _getNotesArray();

  // Filter by selected folder
  if (_currentFolderId !== null) {
    if (String(_currentFolderId).startsWith('mat_')) {
      const matId = _currentFolderId.replace('mat_','');
      notes = notes.filter(n => n.matId === matId || n.folderId === _currentFolderId);
    } else {
      notes = notes.filter(n => n.folderId === _currentFolderId);
    }
  }

  // Update label count
  const lbl = document.getElementById('notes-folder-label');
  if (lbl && _currentFolderId === null) lbl.textContent = `TODAS (${notes.length})`;

  if (!notes.length) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:8px;">📝</div>
      <div style="font-size:12px;">Sin notas en esta carpeta</div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="openNewNoteMenu()">+ Nueva nota</button>
    </div>`;
    return;
  }

  const sorted = [...notes].sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
  container.innerHTML = sorted.map(note => {
    const mat = note.matId ? State.materias.find(m => m.id === note.matId) : null;
    const preview = (note.content || '').replace(/\n/g,' ').slice(0,50) || (note.type==='draw' ? '🎨 Dibujo' : 'Sin contenido');
    const dateStr = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '';
    const isActive = note.id === _currentNoteId;
    const typeBadge = note.type === 'draw'
      ? `<span class="nli-type-badge nlt-draw">🎨 dibujo</span>`
      : `<span class="nli-type-badge nlt-text">📄 texto</span>`;
    const imgBadge = (note.images && Object.keys(note.images).length)
      ? `<span style="font-size:9px;color:var(--text3);">🖼 ${Object.keys(note.images).length}</span>` : '';
    return `<div class="notes-list-item ${isActive?'active':''}" onclick="selectProNote('${note.id}')">
      <div class="nli-title">${note.title || 'Sin título'}</div>
      <div class="nli-preview">${preview}</div>
      <div class="nli-meta">
        ${typeBadge}
        ${mat ? `<span style="background:${mat.color}22;color:${mat.color};padding:1px 5px;border-radius:3px;font-weight:700;font-size:9px;">${mat.icon||''} ${mat.name}</span>` : ''}
        ${imgBadge}
        <span style="margin-left:auto;">${dateStr}</span>
      </div>
    </div>`;
  }).join('');
}

// ── SELECT / LOAD NOTE — THE BUG FIX ─────────────────────────
function selectProNote(id) {
  if (_currentNoteId && _currentNoteId !== id) _autoCommitNote();
  _currentNoteId = id;
  // Re-render list first (marks active)
  renderNotesList();
  // THEN load editor — this was the bug: editor wasn't being called after list re-render
  _loadNoteInProEditor(id);
}

function _loadNoteInProEditor(noteId) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note) { _showNotesEmptyState(); return; }

  const emptyState  = document.getElementById('notes-empty-state');
  const titleWrap   = document.getElementById('notes-title-wrap');
  const ta          = _el('notes-main-ta');
  const wc          = document.getElementById('notes-wordcount');
  const toolbar     = document.getElementById('notes-toolbar');
  const drawArea    = document.getElementById('notes-drawing-area');
  const imgStrip    = document.getElementById('notes-images-strip');

  // Always hide empty state
  if (emptyState) emptyState.style.display = 'none';

  if (note.type === 'draw') {
    // ── Drawing note ──
    if (titleWrap) titleWrap.style.display = 'none';
    if (ta)        ta.style.display = 'none';
    if (wc)        wc.style.display = 'none';
    if (imgStrip)  imgStrip.style.display = 'none';
    const rteD = document.getElementById('notes-rte');
    const rteTD = document.getElementById('notes-rte-toolbar');
    if (rteD) rteD.style.display = 'none';
    if (rteTD) rteTD.classList.remove('visible');
    if (drawArea) {
      drawArea.style.display = 'flex';
      const titleLbl = drawArea.querySelector('#canvas-toolbar-inline span');
      if (titleLbl) titleLbl.textContent = note.title || 'Dibujo sin título';
      const prev = document.getElementById('notes-drawing-preview');
      if (prev) prev.src = note.canvasData || '';
    }
    if (toolbar) {
      toolbar.innerHTML = `<span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);">🎨 NOTA DE DIBUJO</span>
        <span id="notes-autosave-indicator" style="font-size:11px;color:var(--text3);">—</span>`;
    }
  } else {
    // ── Text note ──
    if (drawArea) drawArea.style.display = 'none';
    if (titleWrap) { titleWrap.style.display = 'block'; }
    // Hide old textarea, show rich text editor
    if (ta) ta.style.display = 'none';
    const rte = document.getElementById('notes-rte');
    const rteToolbar = document.getElementById('notes-rte-toolbar');
    if (rte) {
      rte.style.display = 'block';
      const stored = note.content || '';
      if (stored && (stored.startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(stored))) {
        rte.innerHTML = stored;
      } else {
        rte.innerHTML = _plaintextToRteHtml(stored);
      }
      if (!rte._pasteHandlerAttached) {
        rte.addEventListener('paste', _handleRtePaste);
        rte._pasteHandlerAttached = true;
      }
    }
    if (rteToolbar) rteToolbar.classList.add('visible');
    if (wc) { wc.style.display = 'block'; _updateWordCount(note.content || ''); }

    if (toolbar) {
      toolbar.innerHTML = `<span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);">⏱️ AUTO-GUARDADO</span>
        <span id="notes-autosave-indicator" style="font-size:11px;color:var(--text3);">—</span>`;
    }

    // Render images strip
    _renderImagesStrip(note);
  }

  // Fill title input
  const titleInp = _el('notes-title-inp');
  if (titleInp) titleInp.value = note.title || '';

  // Fill folder + mat selectors
  const fSel = document.getElementById('notes-folder-sel-editor');
  if (fSel) fSel.value = note.folderId || '';
  const mSel = document.getElementById('notes-mat-sel-editor');
  if (mSel) mSel.value = note.matId || '';

  // Timestamp
  const ts = document.getElementById('notes-timestamp');
  if (ts && note.updatedAt) ts.textContent = 'Editado: ' + new Date(note.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

  // Populate tags field
  const tagsInp = document.getElementById('notes-tags-inp');
  if (tagsInp) tagsInp.value = (note.tags||[]).join(', ');
  const tagsDsp = document.getElementById('notes-tags-display');
  if (tagsDsp) tagsDsp.innerHTML = (note.tags||[]).map(t=>`<span class="tag-chip active">#${t}</span>`).join('');
}

function _showNotesEmptyState() {
  const emptyState = document.getElementById('notes-empty-state');
  const titleWrap  = document.getElementById('notes-title-wrap');
  const ta         = _el('notes-main-ta');
  const wc         = document.getElementById('notes-wordcount');
  const drawArea   = document.getElementById('notes-drawing-area');
  const imgStrip   = document.getElementById('notes-images-strip');
  const toolbar    = document.getElementById('notes-toolbar');
  const rte        = document.getElementById('notes-rte');
  const rteToolbar = document.getElementById('notes-rte-toolbar');
  if (emptyState) emptyState.style.display = 'flex';
  if (titleWrap) titleWrap.style.display = 'none';
  if (ta) ta.style.display = 'none';
  if (rte) rte.style.display = 'none';
  if (rteToolbar) rteToolbar.classList.remove('visible');
  if (wc) wc.style.display = 'none';
  if (drawArea) drawArea.style.display = 'none';
  if (imgStrip) imgStrip.style.display = 'none';
  if (toolbar) toolbar.innerHTML = '<span style="font-size:11px;color:var(--text3);font-family:\'Space Mono\',monospace;">Selecciona o crea una nota</span>';
}

// ── IMAGES STRIP ──────────────────────────────────────────────
function _renderImagesStrip(note) {
  const strip = document.getElementById('notes-images-strip');
  if (!strip) return;
  const imgs = note.images || {};
  const keys = Object.keys(imgs);
  if (!keys.length) { strip.style.display = 'none'; return; }
  strip.style.display = 'flex';
  const noteId = note.id;
  strip.innerHTML = keys.map(k => `
    <div class="notes-img-thumb" id="thumb-${k}" onclick="openLightbox('${noteId}','${k}')">
      <img src="" alt="img" id="img-${k}" style="max-height:160px;max-width:240px;object-fit:cover;">
      <button class="nit-del" onclick="event.stopPropagation();deleteNoteImage('${noteId}','${k}')">✕</button>
    </div>`).join('');
  // Load images — from IDB if referenced, else direct
  keys.forEach(async k => {
    const val = imgs[k];
    const imgEl = document.getElementById('img-' + k);
    if (!imgEl) return;
    if (val && val.startsWith('IDB:')) {
      const idbKey = val.slice(4);
      const data = await idbGetImage(idbKey);
      if (data) imgEl.src = data;
    } else if (val) {
      imgEl.src = val;
    }
  });
}

function openLightbox(noteId, imgKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note || !note.images || !note.images[imgKey]) return;
  const lb = document.getElementById('notes-lightbox');
  const img = document.getElementById('notes-lightbox-img');
  if (!lb || !img) return;
  const val = note.images[imgKey];
  const _show = (src) => { img.src = src; lb.classList.add('open'); document.body.style.overflow = 'hidden'; };
  if (val && val.startsWith('IDB:')) {
    idbGetImage(val.slice(4)).then(data => { if (data) _show(data); });
  } else {
    _show(val);
  }
}
function closeLightbox() {
  const lb = document.getElementById('notes-lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}
function deleteNoteImage(noteId, imgKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note || !note.images) return;
  const val = note.images[imgKey];
  if (val && val.startsWith('IDB:')) idbDeleteImage(val.slice(4));
  delete note.images[imgKey];
  saveState(['all']);
  _renderImagesStrip(note);
}

// ── ADD NOTES ─────────────────────────────────────────────────
function openNewNoteMenu() { addNewNote(); }

function addNewNote() {
  if (_currentNoteId) _autoCommitNote();
  // Clear any pending autosave to prevent it overwriting the new note
  clearTimeout(_noteAutoSaveTimer);
  const noteId = 'note_' + Date.now();
  const newNote = {
    id: noteId, type: 'text',
    folderId: _currentFolderId && !String(_currentFolderId).startsWith('mat_') ? _currentFolderId : '',
    matId: String(_currentFolderId||'').startsWith('mat_') ? _currentFolderId.replace('mat_','') : (State.materias.find(m => !m.parentId)?.id || ''),
    title: '', content: '', images: {}, updatedAt: Date.now()
  };
  _getNotesArray().push(newNote);
  saveState(['all']);
  _currentNoteId = noteId;
  renderFoldersList();
  renderNotesList();
  _loadNoteInProEditor(noteId);
  setTimeout(() => { const t = _el('notes-title-inp'); if (t) t.focus(); }, 80);
}

function addNewDrawingNote() {
  if (_currentNoteId) _autoCommitNote();
  clearTimeout(_noteAutoSaveTimer);
  const noteId = 'note_' + Date.now();
  const newNote = {
    id: noteId, type: 'draw',
    folderId: _currentFolderId && !String(_currentFolderId).startsWith('mat_') ? _currentFolderId : '',
    matId: '', title: 'Dibujo ' + new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'short'}),
    canvasData: '', updatedAt: Date.now()
  };
  _getNotesArray().push(newNote);
  saveState(['all']);
  _currentNoteId = noteId;
  renderFoldersList();
  renderNotesList();
  _loadNoteInProEditor(noteId);
  // auto-open canvas
  setTimeout(() => openCanvasForNote(), 120);
}

function deleteCurrentNote() {
  if (!_currentNoteId) return;
  if (!confirm('¿Eliminar esta nota?')) return;
  const sem = State._activeSem;
  if (sem.notesArray) sem.notesArray = sem.notesArray.filter(n => n.id !== _currentNoteId);
  _currentNoteId = null;
  saveState(['all']);
  renderFoldersList();
  renderNotesList();
  _showNotesEmptyState();
}

// ── INPUT HANDLERS ────────────────────────────────────────────
function onNotesTitleInput() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.title = _el('notes-title-inp')?.value || '';
  _scheduleAutoSave();
}
function onNoteFolderChange() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.folderId = document.getElementById('notes-folder-sel-editor')?.value || '';
  _scheduleAutoSave();
}
function onNoteMatChange() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.matId = document.getElementById('notes-mat-sel-editor')?.value || '';
  _scheduleAutoSave();
}
function onNotesInput() {
  if (!_currentNoteId) return;
  const rte = document.getElementById('notes-rte');
  _updateWordCount(rte ? (rte.textContent || '') : (_el('notes-main-ta')?.value || ''));
  _scheduleAutoSave();
}

// ── PASTE IMAGES — stores in IndexedDB, shows in strip ────────
function _handleNotesPaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        const base64 = ev.target.result;
        const note   = _getNotesArray().find(n => n.id === _currentNoteId);
        if (!note) return;
        if (!note.images) note.images = {};
        const key = 'IMG_' + Date.now();
        // Store actual image data in IndexedDB, keep only a placeholder in localStorage state
        await idbSetImage(key, base64);
        note.images[key] = 'IDB:' + key; // placeholder reference
        saveState(['all']);
        _renderImagesStrip(note);
        onNotesInput();
      };
      reader.readAsDataURL(file);
      return;
    }
  }
}

// ── AUTO-SAVE ─────────────────────────────────────────────────
function _scheduleAutoSave() {
  const ind = _el('notes-autosave-indicator');
  if (ind) ind.textContent = '✏️ editando...';
  clearTimeout(_noteAutoSaveTimer);
  _noteAutoSaveTimer = setTimeout(() => {
    _autoCommitNote();
    const ind2 = _el('notes-autosave-indicator');
    if (ind2) ind2.textContent = '✅ guardado';
    renderNotesList();
  }, 2000);
}

// ── PDF / IMAGE SCANNER ───────────────────────────────────────
let _scanCancelled = false;

function cancelScan() {
  _scanCancelled = true;
  closeModal('modal-scanner');
}

function _scanSetStatus(msg, pct) {
  const bar = document.getElementById('scanner-progress-bar');
  const st  = document.getElementById('scanner-status');
  if (bar) bar.style.width = pct + '%';
  if (st)  st.textContent  = msg;
}

async function scanDocumentFiles(files) {
  if (!files || !files.length) return;
  if (!_currentNoteId) { alert('Selecciona una nota primero.'); return; }

  _scanCancelled = false;
  openModal('modal-scanner');

  let allText = '';

  for (let fi = 0; fi < files.length; fi++) {
    if (_scanCancelled) break;
    const file = files[fi];
    const fileLabel = file.name || 'archivo';
    document.getElementById('scanner-file-name').textContent = `Archivo ${fi+1}/${files.length}: ${fileLabel}`;

    try {
      if (file.type === 'application/pdf') {
        allText += await _scanPDF(file, fi, files.length);
      } else if (file.type.startsWith('image/')) {
        allText += await _scanImage(file, fi, files.length);
      }
    } catch(e) {
      allText += `\n[Error procesando ${fileLabel}: ${e.message}]\n`;
    }
  }

  if (_scanCancelled) return;
  closeModal('modal-scanner');

  if (!allText.trim()) { alert('No se pudo extraer texto del documento.'); return; }

  // Insert scanned text into current note
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const rte = document.getElementById('notes-rte');
  const scannedHtml = '<hr style="border-color:var(--accent);opacity:.4;"><p><strong>📄 Texto escaneado</strong></p><p>' + allText.trim().replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>') + '</p>';
  if (rte && rte.style.display !== 'none') {
    rte.innerHTML = (rte.innerHTML || '') + scannedHtml;
    note.content = rte.innerHTML;
  } else {
    note.content = (note.content || '') + '\n\n--- 📄 Texto escaneado ---\n\n' + allText.trim();
  }
  note.updatedAt = Date.now();
  saveState(['all']);
  renderNotesList();
  _updateWordCount(rte ? rte.textContent : (note.content || ''));
  alert(`✅ Texto extraído (${allText.trim().split(/\s+/).length} palabras)`);
}

async function _scanPDF(file, fi, total) {
  // Try PDF.js first (works on digital PDFs with selectable text)
  if (typeof pdfjsLib !== 'undefined') {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        if (_scanCancelled) return text;
        _scanSetStatus(`Extrayendo texto — página ${p}/${pdf.numPages}`, Math.round((p/pdf.numPages)*60));
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join(' ') + '\n';
      }
      if (text.trim().length > 50) return text; // Has real text, done
      // Fallback: PDF is scanned — render pages as images then OCR
      _scanSetStatus('PDF escaneado detectado, iniciando OCR...', 62);
      return await _ocrPDFPages(pdf);
    } catch(e) { console.warn('PDF.js error:', e); }
  }
  // Fallback to OCR directly
  return await _scanImage(file, fi, total);
}

async function _ocrPDFPages(pdf) {
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    if (_scanCancelled) return text;
    _scanSetStatus(`OCR página ${p}/${pdf.numPages}...`, 62 + Math.round((p/pdf.numPages)*35));
    const page = await pdf.getPage(p);
    const vp   = page.getViewport({ scale: 2 });
    const cvs  = document.createElement('canvas');
    cvs.width  = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    const pageText = await _tesseractCanvas(cvs);
    text += `\n[Página ${p}]\n` + pageText;
  }
  return text;
}

async function _scanImage(file, fi, total) {
  _scanSetStatus('Iniciando reconocimiento óptico (OCR)...', 10);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
      cvs.getContext('2d').drawImage(img, 0, 0);
      try {
        const text = await _tesseractCanvas(cvs);
        resolve(text);
      } catch(e) { reject(e); }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Error cargando imagen'));
    img.src = URL.createObjectURL(file);
  });
}

async function _tesseractCanvas(cvs) {
  if (typeof Tesseract === 'undefined') throw new Error('Tesseract no disponible');
  const worker = await Tesseract.createWorker('spa+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        _scanSetStatus(`OCR: ${Math.round(m.progress*100)}%...`, 10 + Math.round(m.progress*85));
      }
    }
  });
  const { data: { text } } = await worker.recognize(cvs);
  await worker.terminate();
  return text;
}
// ── END PDF SCANNER ───────────────────────────────────────────

function _autoCommitNote() {
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const titleInp = _el('notes-title-inp');
  const rte = document.getElementById('notes-rte');
  if (titleInp) note.title = titleInp.value;
  if (rte && note.type !== 'draw' && rte.style.display !== 'none') {
    note.content = rte.innerHTML;
  }
  note.updatedAt = Date.now();
  saveState(['all']);
}

function saveCurrentNote() {
  if (!_currentNoteId) return;
  _autoCommitNote();
  const ind = _el('notes-autosave-indicator');
  if (ind) { ind.textContent = '✅ Guardado!'; setTimeout(()=>{ ind.textContent='—'; },2000); }
  renderNotesList();
}

function _updateWordCount(text) {
  const wc = document.getElementById('notes-wordcount');
  if (!wc) return;
  const clean = text.replace(/\[🖼️ IMG_\d+\]/g,'').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  wc.textContent = `${words} palabras · ${text.length} caracteres`;
}

// ══════════════════════════════════════════════════════════════
// CANVAS DRAWING SYSTEM — Full Screen + Image Paste + Shape AI
// ══════════════════════════════════════════════════════════════
let _canvas = null, _ctx = null;
let _drawing = false, _canvasColor = '#e2e8f0', _canvasSize = 2, _canvasEraser = false;
let _undoStack = [];
let _currentTool = 'pen'; // 'pen', 'line', 'rect', 'circle', 'eraser', 'ai'
let _shapeStart = null;
let _shapePreviewData = null; // stored before preview

function expandCurrentNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;

  // Remove any existing overlay
  const old = document.getElementById('note-expand-overlay');
  if (old) old.remove();

  const isCanvas = note.type === 'canvas';
  const overlay  = document.createElement('div');
  overlay.className = 'note-expand-overlay';
  overlay.id = 'note-expand-overlay';

  overlay.innerHTML = `
    <div class="note-expand-toolbar">
      <span class="note-expand-title">${note.title || 'Nota sin título'}</span>
      ${!isCanvas ? `
      <div style="display:flex;gap:3px;align-items:center;">
        <button class="rte-btn" onclick="document.execCommand('bold')" title="Negrita"><b>B</b></button>
        <button class="rte-btn" onclick="document.execCommand('italic')" title="Itálica"><i>I</i></button>
        <button class="rte-btn" onclick="document.execCommand('underline')" title="Subrayado"><u>U</u></button>
        <div class="rte-sep"></div>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h1')" title="H1" style="font-size:10px;font-weight:800;">H1</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h2')" title="H2" style="font-size:10px;font-weight:700;">H2</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h3')" title="H3" style="font-size:10px;">H3</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'p')" title="Párrafo" style="font-size:10px;">P</button>
      </div>
      <span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);" id="exp-wordcount">—</span>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('note-expand-overlay').remove()" title="Cerrar pantalla completa">✕ Cerrar</button>
    </div>
    <div class="note-expand-body" id="exp-body">
      ${isCanvas
        ? `<canvas class="note-expand-canvas" id="exp-canvas"></canvas>`
        : `<div id="exp-rte" contenteditable="true" class="notes-richtext-editor" style="flex:1;height:100%;padding:32px 10%;"></div>`
      }
    </div>
    ${!isCanvas ? `<div class="notes-wordcount" id="exp-bottom" style="padding:6px 10%;"></div>` : ''}
  `;
  document.body.appendChild(overlay);

  if (!isCanvas) {
    const expRte = document.getElementById('exp-rte');
    const wc   = document.getElementById('exp-wordcount');
    const bot  = document.getElementById('exp-bottom');
    const stored = note.content || '';
    expRte.innerHTML = (stored.trim().startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(stored))
      ? stored : _plaintextToRteHtml(stored);
    const sync = () => {
      const mainRte = document.getElementById('notes-rte');
      if (mainRte) { mainRte.innerHTML = expRte.innerHTML; onRteInput(); }
      const words = expRte.textContent.trim() ? expRte.textContent.trim().split(/\s+/).length : 0;
      const chars = expRte.textContent.length;
      const wStr  = `${words} palabras · ${chars} chars`;
      if (wc)  wc.textContent  = wStr;
      if (bot) bot.textContent = wStr;
    };
    expRte.addEventListener('input', sync);
    sync();
    expRte.focus();
  } else {
    // Mirror canvas - just show a static note that canvas is separate
    const body = document.getElementById('exp-body');
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:var(--text3);">
      <div style="font-size:48px;">🎨</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);">${note.title || 'Canvas'}</div>
      <div style="font-size:12px;">El canvas se edita en la ventana principal. Cierra pantalla completa para dibujar.</div>
    </div>`;
  }
}

function openCanvasForNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  const lbl  = document.getElementById('canvas-note-title-lbl');
  if (lbl) lbl.textContent = note?.title || 'Dibujo';

  document.getElementById('modal-canvas').classList.add('open');

  // Init canvas after modal is visible
  requestAnimationFrame(() => {
    _canvas = document.getElementById('notes-canvas');
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight - (document.getElementById('canvas-toolbar-modal')?.offsetHeight || 52);
    _ctx = _canvas.getContext('2d');

    // Dark background
    _ctx.fillStyle = '#1a1f2e';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Load existing drawing
    if (note?.canvasData) {
      const img = new Image();
      img.onload = () => _ctx.drawImage(img, 0, 0);
      img.src = note.canvasData;
    }
    _undoStack = [];
    _shapeStart = null;
    _shapePreviewData = null;
    _initCanvasEvents();
  });
}

function _canvasGetPos(e) {
  const r = _canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

function _drawShape(x0, y0, x1, y1, tool, ctx) {
  ctx.lineWidth   = _canvasSize;
  ctx.strokeStyle = _canvasColor;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (tool === 'line') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  } else if (tool === 'rect') {
    ctx.beginPath(); ctx.strokeRect(x0, y0, x1-x0, y1-y0);
  } else if (tool === 'circle') {
    const rx = Math.abs(x1-x0)/2, ry = Math.abs(y1-y0)/2;
    const cx = x0 + (x1-x0)/2, cy = y0 + (y1-y0)/2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2*Math.PI); ctx.stroke();
  }
}

// AI Shape detection: analyze a stroke and decide if it looks like a line/circle/rect
function _detectShape(points) {
  if (points.length < 5) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (w < 5 && h < 5) return null;

  // Check if endpoints are close (closed shape)
  const first = points[0], last = points[points.length - 1];
  const distEnds = Math.hypot(last.x - first.x, last.y - first.y);
  const perimeter = Math.hypot(w, h) * 2;
  const isClosed = distEnds < perimeter * 0.25 && points.length > 10;

  // Compute "straightness" — how close the stroke is to a line
  const dx = last.x - first.x, dy = last.y - first.y;
  const lineLen = Math.hypot(dx, dy);
  let maxDeviation = 0;
  if (lineLen > 0) {
    points.forEach(p => {
      const t = ((p.x - first.x)*dx + (p.y - first.y)*dy) / (lineLen*lineLen);
      const px = first.x + t*dx, py = first.y + t*dy;
      maxDeviation = Math.max(maxDeviation, Math.hypot(p.x - px, p.y - py));
    });
  }
  const relativeDeviation = lineLen > 0 ? maxDeviation / lineLen : 1;

  if (!isClosed && relativeDeviation < 0.12 && lineLen > 20) return 'line';

  if (isClosed) {
    // Check rectangle-ness: sample corners
    const aspect = w > 0 ? h / w : 1;
    // For circles: measure average distance from center vs std deviation
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const avgR = points.reduce((a, p) => a + Math.hypot(p.x-cx, p.y-cy), 0) / points.length;
    const rStd = Math.sqrt(points.reduce((a, p) => a + Math.pow(Math.hypot(p.x-cx, p.y-cy) - avgR, 2), 0) / points.length);
    const rCV = avgR > 0 ? rStd / avgR : 1;
    if (rCV < 0.15 && avgR > 10) return 'circle';
    if (w > 10 && h > 10) return 'rect';
  }
  return null;
}

let _strokePoints = [];

function _initCanvasEvents() {
  if (!_canvas || _canvas._eventsAttached) return;
  _canvas._eventsAttached = true;

  const startDraw = e => {
    e.preventDefault();
    if (_currentTool === 'text') {
      const p = _canvasGetPos(e);
      _openCanvasTextInput(p.x, p.y);
      return;
    }
    _drawing = true;
    _strokePoints = [];
    _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    if (_undoStack.length > 20) _undoStack.shift();
    const p = _canvasGetPos(e);
    _shapeStart = p;
    _shapePreviewData = null;

    if (_currentTool === 'pen' || _currentTool === 'ai') {
      _ctx.beginPath();
      _ctx.moveTo(p.x, p.y);
      _strokePoints.push(p);
    }
  };

  let _drawRafId = null;
  const draw = e => {
    if (!_drawing) return;
    e.preventDefault();
    const p = _canvasGetPos(e);
    if (_drawRafId) return; // skip frame if already scheduled
    _drawRafId = requestAnimationFrame(() => {
      _drawRafId = null;
      _ctx.lineWidth   = _canvasEraser ? _canvasSize * 4 : _canvasSize;
      _ctx.strokeStyle = _canvasEraser ? '#1a1f2e' : _canvasColor;
      _ctx.lineCap     = 'round'; _ctx.lineJoin = 'round';

      if (_canvasEraser) {
        _ctx.lineTo(p.x, p.y); _ctx.stroke();
      } else if (_currentTool === 'pen' || _currentTool === 'ai') {
        _ctx.lineTo(p.x, p.y); _ctx.stroke();
        _strokePoints.push(p);
      } else {
        // Shape tools: preview
        if (_shapePreviewData) {
          _ctx.putImageData(_shapePreviewData, 0, 0);
        } else {
          _shapePreviewData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
        }
        _drawShape(_shapeStart.x, _shapeStart.y, p.x, p.y, _currentTool, _ctx);
      }
    });
  };

  const stopDraw = () => {
    if (!_drawing) return;
    _drawing = false;
    const p = _strokePoints.length ? _strokePoints[_strokePoints.length-1] : null;

    if (_shapePreviewData && p && _currentTool !== 'pen' && _currentTool !== 'ai') {
      _ctx.putImageData(_shapePreviewData, 0, 0);
      _drawShape(_shapeStart.x, _shapeStart.y, p.x, p.y, _currentTool, _ctx);
      _shapePreviewData = null;
    }

    // AI shape detection
    if (_currentTool === 'ai' && _strokePoints.length >= 5) {
      const detected = _detectShape(_strokePoints);
      if (detected) {
        // Undo the freehand stroke and replace with detected shape
        if (_undoStack.length) _ctx.putImageData(_undoStack[_undoStack.length-1], 0, 0);
        const pts = _strokePoints;
        if (detected === 'line') {
          // Use ACTUAL first and last point — preserves user intent for parallel/perpendicular lines
          _drawShape(pts[0].x, pts[0].y, pts[pts.length-1].x, pts[pts.length-1].y, 'line', _ctx);
        } else {
          // For closed shapes use bounding box
          const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
          _drawShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), detected, _ctx);
        }
        _showShapeIndicator(detected);
      }
    }

    // Text tool: open inline input on click
    if (_currentTool === 'text' && _strokePoints.length <= 2) {
      const p = _shapeStart || (_strokePoints[0] || { x: 50, y: 50 });
      _openCanvasTextInput(p.x, p.y);
    }

    _ctx.beginPath();
    _strokePoints = [];
    _shapeStart = null;
  };

  _canvas.addEventListener('mousedown', startDraw);
  _canvas.addEventListener('mousemove', draw);
  _canvas.addEventListener('mouseup', stopDraw);
  _canvas.addEventListener('mouseleave', stopDraw);
  _canvas.addEventListener('touchstart', startDraw, { passive: false });
  _canvas.addEventListener('touchmove',  draw,      { passive: false });
  _canvas.addEventListener('touchend',   stopDraw);

  // Paste images onto canvas
  document.addEventListener('paste', _handleCanvasPaste);
  // Drag & drop images onto canvas
  _canvas.addEventListener('dragover', e => e.preventDefault());
  _canvas.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const pos = _canvasGetPos(e);
      _pasteImageToCanvas(file, pos.x, pos.y);
    }
  });
}

function _showShapeIndicator(shape) {
  const names = { line: '📏 Línea detectada', circle: '⭕ Círculo detectado', rect: '▭ Rectángulo detectado' };
  const msg = names[shape] || '';
  if (!msg) return;
  let el = document.getElementById('canvas-shape-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'canvas-shape-indicator';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(124,106,255,.9);color:#fff;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;z-index:3000;pointer-events:none;transition:opacity .3s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

function _handleCanvasPaste(e) {
  const modal = document.getElementById('modal-canvas');
  if (!modal?.classList.contains('open')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      _pasteImageToCanvas(item.getAsFile(), _canvas.width/2 - 100, _canvas.height/2 - 100);
      return;
    }
  }
}

function _pasteImageToCanvas(file, x, y) {
  if (!file || !_canvas || !_ctx) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      if (_undoStack.length > 20) _undoStack.shift();
      // Scale image to fit reasonably
      const maxW = Math.min(img.width, _canvas.width * 0.6);
      const scale = maxW / img.width;
      _ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function setCanvasTool(btn, tool) {
  _currentTool = tool;
  _canvasEraser = false;
  document.querySelectorAll('.canvas-tool-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const eb = document.getElementById('canvas-eraser-btn');
  if (eb) eb.classList.remove('active');
  _canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
}

function _openCanvasTextInput(x, y) {
  if (!_canvas) return;
  const r = _canvas.getBoundingClientRect();
  // Remove any existing text input
  const existing = document.getElementById('canvas-text-overlay');
  if (existing) existing.remove();

  const inp = document.createElement('textarea');
  inp.id = 'canvas-text-overlay';
  inp.placeholder = 'Escribe aquí...';
  inp.style.cssText = `
    position:fixed;
    left:${r.left + x}px;
    top:${r.top + y - 4}px;
    min-width:120px; max-width:320px;
    min-height:32px;
    background:rgba(26,31,46,0.92);
    color:${_canvasColor};
    border:2px solid ${_canvasColor};
    border-radius:6px;
    padding:4px 8px;
    font-size:${Math.max(14, _canvasSize * 2.5)}px;
    font-family:'Space Mono',monospace;
    z-index:5000;
    resize:both;
    outline:none;
    line-height:1.4;
    box-shadow:0 4px 20px rgba(0,0,0,.5);
  `;

  document.body.appendChild(inp);
  inp.focus();

  const commit = () => {
    const text = inp.value.trim();
    inp.remove();
    if (!text || !_ctx) return;
    _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    if (_undoStack.length > 20) _undoStack.shift();
    _ctx.font = `${Math.max(14, _canvasSize * 2.5)}px 'Space Mono', monospace`;
    _ctx.fillStyle = _canvasColor;
    _ctx.textBaseline = 'top';
    // Handle multi-line
    const lines = text.split('\n');
    const lineH = Math.max(14, _canvasSize * 2.5) * 1.4;
    lines.forEach((line, i) => _ctx.fillText(line, x, y + i * lineH));
  };

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { inp.remove(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
  });
  inp.addEventListener('blur', commit, { once: true });
}

function setCanvasColor(btn, color) {
  _canvasColor = color; _canvasEraser = false;
  document.querySelectorAll('.canvas-color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const eb = document.getElementById('canvas-eraser-btn');
  if (eb) eb.classList.remove('active');
}
function setCanvasSize(btn, size) {
  _canvasSize = size;
  document.querySelectorAll('.canvas-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function toggleCanvasEraser() {
  _canvasEraser = !_canvasEraser;
  _currentTool = _canvasEraser ? 'eraser' : 'pen';
  const btn = document.getElementById('canvas-eraser-btn');
  if (btn) btn.classList.toggle('active', _canvasEraser);
}
function clearCanvas() {
  if (!_ctx || !_canvas) return;
  if (!confirm('¿Limpiar todo el dibujo?')) return;
  _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
  _ctx.fillStyle = '#1a1f2e';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
}
function undoCanvas() {
  if (!_ctx || !_undoStack.length) return;
  _ctx.putImageData(_undoStack.pop(), 0, 0);
}

function saveCanvasAndClose() {
  if (!_canvas || !_currentNoteId) { closeModal('modal-canvas'); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (note) {
    note.canvasData  = _canvas.toDataURL('image/png');
    note.updatedAt   = Date.now();
    // Only change type to 'draw' if the note was originally created as a drawing note (has no text content)
    // Don't override text notes' type - they can have both text AND canvas
    if (note.type === 'draw' || (!note.content && !note.title)) {
      note.type = 'draw';
    }
    // For text notes with canvas: store canvas but keep as text type
    saveState(['all']);
    // refresh preview
    const prev = document.getElementById('notes-drawing-preview');
    if (prev) prev.src = note.canvasData;
    renderNotesList();
    // If it's a text note, re-render the images strip to show the canvas thumbnail
    if (note.type !== 'draw') {
      _renderImagesStrip(note);
    }
  }
  closeModal('modal-canvas');
  // Cleanup
  document.removeEventListener('paste', _handleCanvasPaste);
  _canvas._eventsAttached = false;
  _canvas = null; _ctx = null;
}

function setNotesMat(matId) {
  if (_currentNoteId) _autoCommitNote();
  const noteId = 'note_' + Date.now();
  const mat = State.materias.find(m => m.id === matId);
  _getNotesArray().push({
    id: noteId, type: 'text',
    matId, folderId: '',
    title: mat ? `Notas — ${mat.name}` : '',
    content: '', images: {},
    updatedAt: Date.now()
  });
  saveState(['all']);
  _currentNoteId   = noteId;
  _currentFolderId = null;
  goPage('notas', document.querySelector('[onclick*="notas"]'));
}

let _ecMatId = null;
let _ecColorSel = '#7c6aff', _ecIconSel = '📚';
let _ecZoneRowCount = 0;

function ecSelectColor(el) {
  _ecColorSel = el.dataset.color;
  document.querySelectorAll('#ec-color-picker .color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function ecSelectIcon(el) {
  _ecIconSel = el.dataset.icon;
  document.querySelectorAll('#ec-icon-picker .icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function openEditClassModal(matId) {
  const mat = State.materias.find(m => m.id === matId);
  if (!mat) return;
  _ecMatId = matId;
  _ecColorSel = mat.color || '#7c6aff';
  _ecIconSel  = mat.icon  || '📚';
  _ecZoneRowCount = 0;

  document.getElementById('ec-name').value       = mat.name || '';
  document.getElementById('ec-code').value       = mat.code || '';
  document.getElementById('ec-credits').value    = mat.credits || '';
  document.getElementById('ec-seccion').value    = mat.seccion || '';
  document.getElementById('ec-catedratico').value= mat.catedratico || '';
  // Set dias checkboxes
  const matDias = (mat.dias || '').split(/[\s,]+/).map(d => d.trim());
  document.querySelectorAll('#ec-dias-checks input[type=checkbox]').forEach(cb => {
    cb.checked = matDias.includes(cb.value);
  });
  document.getElementById('ec-dias').value = mat.dias || '';
  document.getElementById('ec-horario').value    = mat.horario || '';

  document.querySelectorAll('#ec-color-picker .color-opt').forEach(el =>
    el.classList.toggle('selected', el.dataset.color === _ecColorSel));
  document.querySelectorAll('#ec-icon-picker .icon-opt').forEach(el =>
    el.classList.toggle('selected', el.dataset.icon === _ecIconSel));

  const zonesBuilderEl = _el('ec-zones-builder');
  if (zonesBuilderEl) {
    zonesBuilderEl.innerHTML = '';
    (mat.zones || []).filter(z => !z.isLabZone).forEach(z => {
      ecAddZoneRow(z.label, z.maxPts, (z.subs||[]).map(s => ({ label: s.label, pts: s.maxPts })));
    });
  }

  document.getElementById('editclass-title').textContent = `✏️ Editar: ${mat.icon||''} ${mat.name}`;

  const titleEl = document.getElementById('editclass-title');
  if (mat.parentId) {
    const parentMat = State.materias.find(x => x.id === mat.parentId);
    titleEl.innerHTML = `✏️ Editar Lab: ${mat.icon||'🧪'} ${mat.name} <span style="font-size:11px;color:#4ade80;background:rgba(74,222,128,.15);padding:2px 7px;border-radius:4px;border:1px solid rgba(74,222,128,.3);font-family:'Space Mono',monospace;">🔗 ${parentMat?.name||'Clase padre'}</span>`;

    if (parentMat) {
      _ecColorSel = parentMat.color;
      document.querySelectorAll('#ec-color-picker .color-opt').forEach(el =>
        el.classList.toggle('selected', el.dataset.color === _ecColorSel));
    }
  }

  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById('ec-formula-' + i);
    if (inp) inp.value = (mat.formulas && mat.formulas[i]) ? mat.formulas[i] : '';
  }

  document.getElementById('modal-editclass').classList.add('open');
}

function ecAddZoneRow(labelVal, ptsVal, subsArr) {
  _ecZoneRowCount++;
  const id  = 'ec-zr-' + _ecZoneRowCount;
  const subs = subsArr || [];
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const totalPts = subs.reduce((a,s) => a + (parseFloat(s.pts)||0), 0);

  const buildSubsHtml = (subsList) => subsList.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}">
      <input type="text" class="form-input ec-sub-label" placeholder="Apartado" value="${(s.label||'').replace(/"/g,'&quot;')}" style="font-size:12px;">
      <input type="number" class="form-input ec-sub-pts" placeholder="Pts" value="${s.pts||''}" min="0" max="200" style="font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${id}')">
      <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();ecUpdateZoneTotal('${id}')" style="padding:3px 6px;">✕</button>
    </div>`).join('');

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input ec-zone-name" placeholder="Nombre de la zona" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="font-size:13px;font-weight:600;flex:1;">
      <div style="font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;">Total: <strong id="${id}-total" style="color:var(--accent2);">${totalPts.toFixed(1)}</strong> pts</div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs" class="zone-subs-area">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="ecAddZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;

  _el('ec-zones-builder').appendChild(div);
}

function ecAddZoneSub(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  if (!subsDiv) return;
  const idx = subsDiv.children.length;
  const row = document.createElement('div');
  row.className = 'zone-sub-row';
  row.id = zoneId + '-sub-' + idx;
  row.innerHTML = `
    <input type="text" class="form-input ec-sub-label" placeholder="Apartado" style="font-size:12px;">
    <input type="number" class="form-input ec-sub-pts" placeholder="Pts" min="0" max="200" style="font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${zoneId}')">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();ecUpdateZoneTotal('${zoneId}')" style="padding:3px 6px;">✕</button>`;
  subsDiv.appendChild(row);
}

function ecUpdateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value)||0; });
  totalEl.textContent = total.toFixed(1);
}

function saveEditClass() {
  if (!_ecMatId) return;
  const mat = State.materias.find(m => m.id === _ecMatId);
  if (!mat) return;

  const name = document.getElementById('ec-name').value.trim();
  const code = document.getElementById('ec-code').value.trim();
  if (!name || !code) { alert('Nombre y código son requeridos.'); return; }

  mat.name        = name;
  mat.code        = code;
  const credVal   = document.getElementById('ec-credits').value.trim();
  if (credVal) mat.credits = credVal;
  mat.color       = _ecColorSel;
  mat.icon        = _ecIconSel;

  if (mat.linkedLabId) {
    const labMat = State.materias.find(x => x.id === mat.linkedLabId);
    if (labMat) { labMat.color = _ecColorSel; }
  }
  const secVal    = document.getElementById('ec-seccion').value.trim();
  if (secVal !== undefined) mat.seccion = secVal;
  const catVal    = document.getElementById('ec-catedratico').value.trim();
  if (catVal !== undefined) mat.catedratico = catVal;
  const diasVal = Array.from(document.querySelectorAll('#ec-dias-checks input[type=checkbox]:checked')).map(cb=>cb.value).join(', ');
  mat.dias = diasVal;
  const horVal    = document.getElementById('ec-horario').value.trim();
  if (horVal !== undefined) mat.horario = horVal;

  const zonesBuilderEl = _el('ec-zones-builder');
  if (zonesBuilderEl) {
    const labZones = (mat.zones || []).filter(z => z.isLabZone);
    const newZones = [];
    zonesBuilderEl.querySelectorAll('div[id^="ec-zr-"]').forEach(row => {
      const lbl = row.querySelector('.ec-zone-name')?.value.trim() || '';
      if (!lbl) return;
      const key      = lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
      const subsRows = row.querySelectorAll('.zone-sub-row');
      const subs = []; let totalPts = 0;
      subsRows.forEach((sr, i) => {
        const subLabel = sr.querySelector('.ec-sub-label')?.value.trim() || (lbl + ' ' + (i+1));
        const subPts   = parseFloat(sr.querySelector('.ec-sub-pts')?.value) || 0;
        if (subPts > 0) {

          const existSub = (mat.zones||[]).flatMap(z=>z.subs||[]).find(s=>s.key===key+'_'+(i+1));
          subs.push({ key: key+'_'+(i+1), label: subLabel, maxPts: subPts,
            ...(existSub ? { _prev: existSub } : {}) });
          totalPts += subPts;
        }
      });
      if (subs.length && totalPts > 0) {
        const existZone = (mat.zones||[]).find(z=>z.key===key);
        newZones.push({ ...(existZone||{}), key, label: lbl, maxPts: totalPts, color: _ecColorSel, subs });
      }
    });
    if (newZones.length > 0) mat.zones = [...newZones, ...labZones];
  }

  mat.formulas = [];
  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById('ec-formula-' + i);
    mat.formulas.push(inp ? inp.value.trim() : '');
  }

  saveState(['materias']);
  closeModal('modal-editclass');
  renderMaterias(); renderGrades(); renderHorario();
  fillMatSels(); fillTopicMatSel(); fillPomSel(); fillNotesSel(); fillExamSel();
}

function renderNotebookPage() { renderNotesProPage(); }
function selectNoteMat(matId) { setNotesMat(matId); }
function handleNoteFile(matId, input) {  }

function toggleFormulas(matId) {
  const body  = document.getElementById('formulas-body-' + matId);
  const arrow = document.getElementById('formulas-arrow-' + matId);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
}

function saveFormula(matId, index, value) {
  const mat = State.materias.find(m => m.id === matId);
  if (!mat) return;
  if (!mat.formulas) mat.formulas = ['','','','',''];
  mat.formulas[index] = value;
  saveState(['materias']);
}

// ══════════════════════════════════════════════════
// CARGA DE TAREAS — WEEK NAVIGATION
// ══════════════════════════════════════════════════
let _weekOffset = 0;

function changeWeekOffset(delta, e) {
  if (e) e.stopPropagation();
  if (delta === 0) { _weekOffset = 0; }
  else { _weekOffset += delta; }
  renderOverview();
}

function toggleLoadPanel() {
  const body = document.getElementById('load-panel-body');
  const icon = document.getElementById('load-panel-toggle');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.textContent = isOpen ? '▶' : '▼';
}

// Patch renderOverview to use _weekOffset
const _origRenderOverview = _renderOverview;
function _renderOverview() {
  const pending = State.tasks.filter(t => !t.done);
  const overall = calcOverallGPA();

  const ovMatsEl = _el('ov-mats');
  if (ovMatsEl) ovMatsEl.textContent = State.materias.filter(m=>!m.parentId).length;
  const avgEl  = _el('ov-avg');
  const credEl = _el('ov-cred');
  if (avgEl)  avgEl.textContent  = overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—';
  if (credEl) credEl.textContent = overall.totalCred  || '0';
  const legacyPend = document.getElementById('ov-pending');
  if (legacyPend) legacyPend.textContent = pending.length;

  updateGPADisplay();

  const urgentCount = pending.filter(t => t.due && (new Date(t.due)-new Date())/86400000 <= 2 && (new Date(t.due)-new Date())/86400000 >= 0).length;
  const profileSub  = State.settings?.profile?.carrera ? ` · ${State.settings.profile.carrera}` : '';
  _el('ov-sub').textContent =
    urgentCount > 0 ? `⚡ ${urgentCount} tarea(s) vencen en menos de 2 días`
    : pending.length > 0 ? `${pending.length} tarea(s) pendiente(s)${profileSub}`
    : `¡Sin pendientes! 🎉${profileSub}`;

  const badge = _el('ov-pending-badge');
  if (badge) badge.textContent = pending.length > 0 ? `${pending.length} sin entregar` : '';

  const loadBarsEl   = _el('ov-load-bars');
  const weekRangeEl  = _el('ov-week-range');
  if (loadBarsEl) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dow   = today.getDay();
    const baseMonday = new Date(today);
    baseMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const monday = new Date(baseMonday);
    monday.setDate(baseMonday.getDate() + _weekOffset * 7);
    const days   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const counts = days.map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0,10);
      return State.tasks.filter(t => t.due === dStr && !t.done).length;
    });
    const maxCnt = Math.max(...counts, 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    if (weekRangeEl) {
      const isCurrentWeek = _weekOffset === 0;
      const label = isCurrentWeek ? 'Semana actual · ' : (_weekOffset < 0 ? `Hace ${-_weekOffset} sem · ` : `En ${_weekOffset} sem · `);
      weekRangeEl.textContent = label + `${monday.getDate()}–${sunday.getDate()} ${sunday.toLocaleDateString('es-ES',{month:'short'})}`;
    }
    loadBarsEl.innerHTML = days.map((lbl, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const isToday = d.getTime() === today.getTime();
      const cnt = counts[i];
      const barH = cnt > 0 ? Math.max(8, Math.round((cnt/maxCnt)*44)) : 3;
      const clr  = cnt === 0 ? 'var(--border2)' : cnt >= 3 ? '#f87171' : cnt >= 2 ? '#fbbf24' : '#4ade80';
      return `<div class="load-bar-col">
        <div class="load-bar-cnt" style="color:${cnt>0?clr:'transparent'}">${cnt>0?cnt:''}</div>
        <div class="load-bar-inner" style="height:${barH}px;background:${clr};${isToday?'box-shadow:0 0 8px '+clr+'80;':''};"></div>
        <div class="load-bar-lbl" style="font-weight:${isToday?700:400};color:${isToday?'var(--accent2)':'var(--text3)'}">${lbl}</div>
      </div>`;
    }).join('');
  }

  const tl = _el('ov-tasks-list');
  const today2 = new Date(); today2.setHours(0,0,0,0);
  const sorted = [...pending].sort((a,b) => {
    const da = a.due || '9999-12-31', db = b.due || '9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  tl.innerHTML = sorted.length ? sorted.map(t => {
    const m = getMat(t.matId);
    const dueD = t.due ? new Date(t.due) : null;
    const daysLeft = dueD ? Math.ceil((dueD - today2) / 86400000) : null;
    let bClass, bText;
    if (daysLeft === null)         { bClass='ub-none';    bText='Sin fecha'; }
    else if (daysLeft < 0)         { bClass='ub-overdue'; bText=`Venció hace ${-daysLeft}d`; }
    else if (daysLeft === 0)       { bClass='ub-critical';bText='Vence hoy'; }
    else if (daysLeft < 2)         { bClass='ub-critical';bText=`Faltan ${daysLeft} día`; }
    else if (daysLeft < 5)         { bClass='ub-warning'; bText=`Faltan ${daysLeft} días`; }
    else                           { bClass='ub-ok';      bText=`Faltan ${daysLeft} días`; }
    const prog = subtaskProgress(t);
    const prioClass = t.priority === 'high' || t.priority === 'alta' ? 'prio-alta'
                    : t.priority === 'low'  || t.priority === 'baja' ? 'prio-baja'
                    : t.priority ? 'prio-media' : 'prio-none';
    return `<div class="mc-task-item ${prioClass}">
      <div class="mc-task-info">
        <div class="mc-task-title">${t.title}</div>
        <div class="mc-task-meta">
          <span>${m.icon||'📚'} ${m.code||m.name||'—'}</span>
          <span>${t.type||'Tarea'}</span>
          ${t.due?`<span style="font-family:'Space Mono',monospace;">${fmtD(t.due)}</span>`:''}
          ${prog?`<span>${prog.done}/${prog.total} sub.</span>`:''}
        </div>
      </div>
      <span class="urgency-badge ${bClass}">${bText}</span>
    </div>`;
  }).join('')
  : `<div style="text-align:center;padding:40px;color:var(--text3);">
      <div style="font-size:36px;margin-bottom:8px;">✅</div>
      <div style="font-size:14px;font-weight:700;">¡Sin tareas pendientes!</div>
      <div style="font-size:12px;margin-top:4px;color:var(--text3);">Siga adelante, Ingeniero 🎓</div>
    </div>`;

  // ── "Esta semana" timeline ──────────────────────────────────
  const tlEl = _el('ov-timeline');
  if (tlEl) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const daysFull = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    // Show today + next 6 days (7 days total)
    const days = Array.from({length:7}, (_,i) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      return d;
    });
    tlEl.innerHTML = `<div class="timeline-wrap">` + days.map(d => {
      const dStr = d.toISOString().slice(0,10);
      const isToday = d.getTime() === today.getTime();
      const tasks = State.tasks.filter(t => !t.done && t.due === dStr);
      const events = State.events.filter(e => e.date === dStr);
      const hasItems = tasks.length > 0 || events.length > 0;
      const dotClass = isToday ? 'today' : !hasItems ? 'empty' : '';
      const dateNum = d.getDate();
      const monthShort = d.toLocaleDateString('es-ES',{month:'short'});
      const items = [
        ...events.map(e => {
          const m = getMat(e.matId);
          return `<div class="tl-item event"><span class="tl-item-icon">📅</span><div class="tl-item-text"><div class="tl-item-title">${e.title}</div><div class="tl-item-meta">${m.icon||''} ${m.name||'Evento'}${e.hora?' · '+e.hora:''}</div></div></div>`;
        }),
        ...tasks.map(t => {
          const m = getMat(t.matId);
          const prioColors = {alta:'#f87171',media:'#fbbf24',baja:'#4ade80'};
          const borderClr = prioColors[t.priority] || 'var(--accent)';
          return `<div class="tl-item" style="border-left-color:${borderClr}"><span class="tl-item-icon">✅</span><div class="tl-item-text"><div class="tl-item-title">${t.title}</div><div class="tl-item-meta">${m.icon||''} ${m.name||'—'} · ${t.type||'Tarea'}</div></div></div>`;
        })
      ].join('');
      return `<div class="tl-day">
        <div class="tl-day-label">
          <div class="tl-day-date" style="${isToday?'color:var(--accent2);':'color:var(--text2);'}font-weight:800;">${dateNum} ${monthShort}</div>
          <div class="tl-day-name" style="${isToday?'color:var(--accent2);font-weight:800;':''}font-size:10px;letter-spacing:.5px;">${daysFull[d.getDay()]}</div>
        </div>
        <div class="tl-line"><div class="tl-dot ${dotClass}"></div></div>
        <div class="tl-items">
          ${hasItems ? items : `<div class="tl-empty-day">${isToday?'Sin pendientes hoy':'—'}</div>`}
        </div>
      </div>`;
    }).join('') + `</div>`;
  }
}


// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
let _sidebarCollapsed = false;

function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sidebar = document.querySelector('.sidebar');
  const main    = document.querySelector('.main');
  const btn     = document.getElementById('sidebar-toggle-btn');
  if (_sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    main.style.marginLeft = '0';
    btn.classList.add('is-collapsed');
    btn.textContent = '›';
    btn.title = 'Mostrar menú';
  } else {
    sidebar.classList.remove('collapsed');
    main.style.marginLeft = 'var(--sidebar-w)';
    btn.classList.remove('is-collapsed');
    btn.textContent = '‹';
    btn.title = 'Ocultar menú';
  }
}


function _getProfile() {
  if (!State.settings.profile) State.settings.profile = {};
  return State.settings.profile;
}

function _getApprovedCourses() {
  if (!State.settings.approvedCourses) State.settings.approvedCourses = [];
  return State.settings.approvedCourses;
}

function renderProfilePage() {
  const p = _getProfile();
  const nameEl = document.getElementById('profile-name');
  const carEl  = document.getElementById('profile-carrera');
  const regEl  = document.getElementById('profile-registro');
  const facEl  = document.getElementById('profile-facultad');
  const totEl  = document.getElementById('profile-total-cred');
  if (nameEl) nameEl.value = p.name || '';
  if (carEl)  carEl.value  = p.carrera || '';
  if (regEl)  regEl.value  = p.registro || '';
  if (facEl)  facEl.value  = p.facultad || '';
  if (totEl)  totEl.value  = p.totalCredCarrera || '';

  // Sync personalization selects
  const fontSel  = document.getElementById('cfg-font-select');
  const soundSel = document.getElementById('cfg-sound-select');
  if (fontSel)  fontSel.value  = State.settings.font || 'Syne';
  if (soundSel) soundSel.value = State.settings.soundVariant || 'classic';
  // Sync accent color picker
  const accent = State.settings.accentColor || '#7c6aff';
  document.querySelectorAll('.accent-color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === accent);
  });

  recalcProfile();
  renderApprovedCourses();
}

function saveProfile() {
  const p = _getProfile();
  p.name     = document.getElementById('profile-name')?.value.trim() || '';
  p.carrera  = document.getElementById('profile-carrera')?.value.trim() || '';
  p.registro = document.getElementById('profile-registro')?.value.trim() || '';
  p.facultad = document.getElementById('profile-facultad')?.value.trim() || '';
  p.totalCredCarrera = parseInt(document.getElementById('profile-total-cred')?.value) || 0;
  saveState(['all']);
  recalcProfile();
  // Update greeting in overview
  if (p.name) {
    const grEl = _el('ov-greeting');
    if (grEl && grEl.textContent) {
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
      grEl.textContent = `${g}, ${p.name.split(' ')[0]} 👋`;
    }
  }
  alert('✅ Perfil guardado correctamente');
}

function recalcProfile() {
  const courses = _getApprovedCourses();
  const totalCred = courses.reduce((a,c) => a + (parseFloat(c.credits)||0), 0);
  const totalCourses = courses.length;
  let weightedAvg = null;
  if (courses.length > 0) {
    const weighted = courses.reduce((a,c) => a + (parseFloat(c.grade)||0) * (parseFloat(c.credits)||0), 0);
    weightedAvg = totalCred > 0 ? weighted / totalCred : null;
  }
  const avgEl  = document.getElementById('profile-display-avg');
  const credEl = document.getElementById('profile-display-cred');
  const crsEl  = document.getElementById('profile-display-courses');
  const pctEl  = document.getElementById('profile-career-pct');
  const barEl  = document.getElementById('profile-career-bar');

  if (avgEl)  avgEl.textContent  = weightedAvg !== null ? weightedAvg.toFixed(2) : '—';
  if (credEl) credEl.textContent = totalCred;
  if (crsEl)  crsEl.textContent  = totalCourses;

  const p = _getProfile();
  const totalCarrera = parseInt(document.getElementById('profile-total-cred')?.value) || p.totalCredCarrera || 0;
  const pct = totalCarrera > 0 ? Math.min(100, (totalCred / totalCarrera * 100)).toFixed(1) : 0;
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  // Also update sidebar with profile name if present
  const nm = _el('sidebar-sem-nombre');
  // don't overwrite semester name
}

function renderApprovedCourses() {
  const container = document.getElementById('approved-courses-list');
  if (!container) return;
  const courses = _getApprovedCourses();
  if (!courses.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:8px;">🎓</div>
      <div style="font-size:13px;">Agrega los cursos que ya aprobaste</div>
      <div style="font-size:11px;margin-top:4px;color:var(--text3);">El promedio y créditos se calcularán automáticamente</div>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 80px 70px 90px 110px 36px 36px;gap:8px;align-items:center;padding:6px 0;border-bottom:2px solid var(--border);margin-bottom:4px;">
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">CURSO</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">CÓDIGO</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">CRED</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">NOTA</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">SEMESTRE</span>
      <span></span><span></span>
    </div>
    ${courses.map((c,i) => {
      const g = parseFloat(c.grade)||0;
      const col = g >= 61 ? '#4ade80' : g >= 50 ? '#fbbf24' : '#f87171';
      return `<div style="display:grid;grid-template-columns:1fr 80px 70px 90px 110px 36px 36px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;font-weight:600;">${c.name}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);text-align:center;">${c.code||'—'}</span>
        <span style="font-size:12px;font-family:'Space Mono',monospace;color:var(--accent2);text-align:center;font-weight:700;">${c.credits||0}</span>
        <span style="font-size:13px;font-weight:800;color:${col};text-align:center;">${g.toFixed(1)}</span>
        <span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">${c.semester||'—'}</span>
        <button class="btn btn-ghost btn-sm" onclick="editApprovedCourse(${i})" style="padding:3px 6px;" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteApprovedCourse(${i})" style="padding:3px 6px;">✕</button>
      </div>`;
    }).join('')}`;
}

function openAddApprovedCourse() {
  document.getElementById('ac-modal-title').textContent = '✅ Agregar Curso Aprobado';
  document.getElementById('ac-edit-idx').value = '';
  document.getElementById('ac-name').value    = '';
  document.getElementById('ac-code').value    = '';
  document.getElementById('ac-credits').value = '';
  document.getElementById('ac-grade').value   = '';
  document.getElementById('ac-semester').value = '';
  document.getElementById('modal-approved-course').classList.add('open');
}

function editApprovedCourse(idx) {
  const courses = _getApprovedCourses();
  const c = courses[idx];
  if (!c) return;
  document.getElementById('ac-modal-title').textContent = '✏️ Editar Curso Aprobado';
  document.getElementById('ac-edit-idx').value = idx;
  document.getElementById('ac-name').value     = c.name || '';
  document.getElementById('ac-code').value     = c.code || '';
  document.getElementById('ac-credits').value  = c.credits || '';
  document.getElementById('ac-grade').value    = c.grade || '';
  document.getElementById('ac-semester').value = c.semester || '';
  document.getElementById('modal-approved-course').classList.add('open');
}

function saveApprovedCourse() {
  const name = document.getElementById('ac-name')?.value.trim();
  if (!name) { alert('El nombre del curso es obligatorio'); return; }
  const data = {
    name,
    code:     document.getElementById('ac-code')?.value.trim()    || '',
    credits:  parseFloat(document.getElementById('ac-credits')?.value) || 0,
    grade:    parseFloat(document.getElementById('ac-grade')?.value)   || 0,
    semester: document.getElementById('ac-semester')?.value.trim() || '',
  };
  const editIdx = document.getElementById('ac-edit-idx')?.value;
  const courses = _getApprovedCourses();
  if (editIdx !== '' && editIdx !== undefined && courses[parseInt(editIdx)]) {
    Object.assign(courses[parseInt(editIdx)], data);
  } else {
    courses.push(data);
  }
  saveState(['all']);
  closeModal('modal-approved-course');
  recalcProfile();
  renderApprovedCourses();
}

function deleteApprovedCourse(idx) {
  if (!confirm('¿Eliminar este curso?')) return;
  _getApprovedCourses().splice(idx, 1);
  saveState(['all']);
  recalcProfile();
  renderApprovedCourses();
}



<!-- ══════════════════════════════════════════════════════════
     NEW FEATURES: Hoy, Kanban, Flashcards, Streak, Tags, 
                   Drag&Drop, NoteSearch, Export, Templates
══════════════════════════════════════════════════════════════ -->


// ── STREAK SYSTEM ────────────────────────────────────────────
function _getStreakData() {
  return JSON.parse(localStorage.getItem('academia_streak') || '{"count":0,"lastDate":""}');
}
function _saveStreakData(d) { localStorage.setItem('academia_streak', JSON.stringify(d)); }
function _updateStreak() {
  const today = new Date().toDateString();
  const sd = _getStreakData();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (sd.lastDate === today) return sd.count; // already counted today
  if (sd.lastDate === yesterday) { sd.count++; } 
  else if (sd.lastDate !== today) { sd.count = 1; } // reset or first
  sd.lastDate = today;
  _saveStreakData(sd);
  return sd.count;
}

// Streak is updated inside toggleTask directly

// ── ¿QUÉ HAGO HOY? PAGE ──────────────────────────────────────
function renderHoyPage() {
  const container = document.getElementById('hoy-container');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  const todayD = new Date(); todayD.setHours(0,0,0,0);

  // Streak
  const streak = _getStreakData();
  const streakHtml = streak.count > 0
    ? `<div class="streak-badge"><span class="streak-fire">🔥</span> ${streak.count} día${streak.count!==1?'s':''} de racha</div>` : '';

  // Overdue + today tasks
  const dueTasks = State.tasks.filter(t => !t.done && t.due && t.due <= today);
  const noDateTasks = State.tasks.filter(t => !t.done && !t.due).slice(0, 5);

  // Today events
  const todayEvents = [...(State.events||[]), ...State.tasks.filter(t=>t.due===today && !t.done)]
    .filter(e => (e.date||e.due) === today);

  // Topics with low comprehension
  const weakTopics = (State.topics||[]).filter(t => (t.comprension||3) <= 2).slice(0, 4);

  // Weekly load for today
  const todayMinutes = State.tasks.filter(t => !t.done && t.due === today && t.timeEst)
    .reduce((s,t) => s + (t.timeEst||0), 0);

  // Motivational message based on pending count
  const pending = dueTasks.length + noDateTasks.length;
  const motivations = [
    '¡Excelente! No tienes pendientes urgentes. 🎉',
    '¡Casi todo en orden! Solo un pendiente. 💪',
    `Tienes ${pending} cosas pendientes. ¡Puedes con todo! 🚀`,
    `${pending} pendientes. Empieza con la más pequeña. 🎯`,
    `${pending} pendientes. Divide y conquista. ⚡`
  ];
  const motivIdx = Math.min(pending, motivations.length - 1);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      <div>
        <div style="font-size:10px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:2px;text-transform:uppercase;">${todayStr}</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px;">☀️ ¿Qué hago hoy?</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${streakHtml}
        ${todayMinutes ? `<div style="background:var(--accent-glow);border:1px solid rgba(124,106,255,.3);color:var(--accent2);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;">⏱ ~${todayMinutes>=60?(todayMinutes/60).toFixed(1)+'h':todayMinutes+'min'} estimados hoy</div>` : ''}
      </div>
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:13px;">
      ${motivations[motivIdx]}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      
      <div class="card">
        <div class="card-header"><span class="card-title">🔥 Pendientes urgentes${dueTasks.length ? ` (${dueTasks.length})` : ''}</span></div>
        <div class="card-body" style="padding:0;">
          ${dueTasks.length ? dueTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">✅ Sin pendientes vencidos</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📅 Eventos de hoy</span></div>
        <div class="card-body" style="padding:0;">
          ${todayEvents.length ? todayEvents.map(e => `
            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px;">
              <div style="font-weight:700;">${e.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${e.type||'Evento'} ${e.time ? '· '+e.time : ''}</div>
            </div>`).join('') : '<div class="hoy-empty">📭 Sin eventos hoy</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📋 Sin fecha asignada</span></div>
        <div class="card-body" style="padding:0;">
          ${noDateTasks.length ? noDateTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">Todo organizado ✨</div>'}
        </div>
      </div>

      ${weakTopics.length ? `
      <div class="card">
        <div class="card-header"><span class="card-title">📚 Temas para repasar</span></div>
        <div class="card-body" style="padding:0;">
          ${weakTopics.map(tp => {
            const m = getMat(tp.matId);
            return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);">
              <div style="font-size:12px;font-weight:700;">${tp.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${m.icon||'📚'} ${m.name} · ${'⭐'.repeat(tp.comprension||1)} comprensión</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

    </div>`;
}

function _hoyTaskHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;">
    <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}');renderHoyPage();" style="margin-top:1px;flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;">${t.title}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">
        ${m.icon||'📚'} ${m.name||'—'} 
        ${t.due ? `· <span class="${dc}" style="font-size:11px;">📅 ${fmtD(t.due)}</span>` : ''}
        ${t.timeEst ? `· ⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}` : ''}
      </div>
    </div>
  </div>`;
}

// ── KANBAN ────────────────────────────────────────────────────
const KANBAN_COLS = [
  { id:'todo',       label:'📋 Por Hacer',    color:'var(--text3)' },
  { id:'inprogress', label:'⚡ En Progreso',   color:'var(--yellow)' },
  { id:'done',       label:'✅ Completado',   color:'var(--green)' },
];

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  fillMatSels();

  board.innerHTML = KANBAN_COLS.map(col => {
    const tasks = State.tasks.filter(t => {
      const tCol = t.kanbanCol || (t.done ? 'done' : 'todo');
      return tCol === col.id;
    });
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title" style="color:${col.color};">${col.label}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text3);">${tasks.length}</span>
      </div>
      <div class="kanban-col-body kanban-drop-zone" id="kcol-${col.id}"
        ondragover="kDragOver(event,'${col.id}')"
        ondrop="kDrop(event,'${col.id}')"
        ondragleave="kDragLeave(event)">
        ${tasks.map(t => _kanbanCardHtml(t)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _kanbanCardHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  const tagsHtml = (t.tags||[]).map(tg=>`<span class="tag-chip">#${tg}</span>`).join('');
  return `<div class="kanban-card" draggable="true" data-id="${t.id}"
    ondragstart="kCardDragStart(event,'${t.id}')" onclick="openTaskModal('${t.id}')">
    <div class="kc-title">${t.title}</div>
    <div class="kc-meta">
      <span style="color:${m.color||'var(--accent)'};">${m.icon||'📚'} ${m.code||'?'}</span>
      ${prioBadge(t.priority)}
      ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
      ${t.timeEst ? `<span>⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}</span>` : ''}
    </div>
    ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
  </div>`;
}

let _kDragId = null;
function kCardDragStart(e, id) { _kDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function kDragOver(e, colId) { e.preventDefault(); document.getElementById('kcol-'+colId)?.classList.add('over'); }
function kDragLeave(e) { e.currentTarget.classList.remove('over'); }
function kDrop(e, colId) {
  e.preventDefault();
  e.currentTarget.classList.remove('over');
  if (!_kDragId) return;
  const t = State.tasks.find(x => x.id === _kDragId);
  if (t) {
    t.kanbanCol = colId;
    if (colId === 'done') { const wasDone = t.done; t.done = true; if (!wasDone) _uiClick('task-done'); }
    else if (colId === 'todo') t.done = false;
    saveState(['tasks']); updateBadge(); renderKanban(); renderOverview();
  }
  _kDragId = null;
}

// ── TASK DRAG & DROP (list reorder) ──────────────────────────
let _taskDragId = null;
function taskDragStart(e, id) { _taskDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function taskDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function taskDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function taskDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_taskDragId || _taskDragId === targetId) return;
  const tasks = State.tasks;
  const fromIdx = tasks.findIndex(t => t.id === _taskDragId);
  const toIdx   = tasks.findIndex(t => t.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = tasks.splice(fromIdx, 1);
  tasks.splice(toIdx, 0, moved);
  saveState(['tasks']); renderTasks();
  _taskDragId = null;
}

// ── FLASHCARDS ───────────────────────────────────────────────
function _getFlashcards() {
  return JSON.parse(localStorage.getItem('academia_flashcards') || '[]');
}
function _saveFlashcards(arr) { localStorage.setItem('academia_flashcards', JSON.stringify(arr)); }

function renderFlashcards() {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  const cards = _getFlashcards();

  // Fill mat select
  const fcMat = document.getElementById('fc-mat');
  if (fcMat && !fcMat.children.length) {
    fcMat.innerHTML = '<option value="">— General —</option>';
    State.materias.forEach(m => { const o = document.createElement('option'); o.value=m.id; o.textContent=`${m.icon||'📚'} ${m.name}`; fcMat.appendChild(o); });
  }

  if (!cards.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <div style="font-size:48px;margin-bottom:12px;">🃏</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Sin flashcards aún</div>
      <div style="font-size:12px;margin-bottom:16px;">Crea tarjetas para estudiar o selecciona texto en una nota</div>
      <button class="btn btn-primary" onclick="openNewFlashcardModal()">+ Primera flashcard</button>
    </div>`;
    return;
  }

  // Group by mat
  const byMat = {};
  cards.forEach(c => { const k = c.matId||'general'; if (!byMat[k]) byMat[k] = []; byMat[k].push(c); });

  let html = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
    <span style="font-size:12px;color:var(--text3);">${cards.length} tarjetas totales · </span>
    <span style="font-size:12px;color:var(--green);">${cards.filter(c=>c.score>=2).length} dominadas</span>
    <span style="font-size:12px;color:var(--yellow);">· ${cards.filter(c=>c.score===1).length} practicando</span>
    <span style="font-size:12px;color:var(--red);">· ${cards.filter(c=>!c.score).length} nuevas</span>
    ${cards.filter(c=>c.nextReview && c.nextReview<=Date.now()).length > 0 ? `<span style="font-size:12px;color:#f97316;font-weight:700;">· ⏰ ${cards.filter(c=>c.nextReview && c.nextReview<=Date.now()).length} para revisar hoy</span>` : ''}
  </div>`;

  Object.entries(byMat).forEach(([matId, mCards]) => {
    const m = matId === 'general' ? { name:'General', icon:'📋' } : getMat(matId);
    html += `<div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">${m.icon||'📚'} ${m.name}</div>
      <div class="fc-grid">
        ${mCards.map(c => {
          const isOverdue = c.nextReview && c.nextReview <= Date.now();
          const daysUntil = c.nextReview ? Math.ceil((c.nextReview - Date.now()) / 86400000) : null;
          const reviewBadge = c.nextReview
            ? `<div style="font-size:9px;font-family:'Space Mono',monospace;margin-top:5px;color:${isOverdue?'#f87171':daysUntil<=1?'#fbbf24':'var(--text3)'};">⏰ ${isOverdue?'¡Revisar hoy!':daysUntil===0?'Revisar hoy':'Revisar en '+daysUntil+'d'}</div>`
            : '';
          return `<div class="fc-card" onclick="openNewFlashcardModal('${c.id}')">
          <div class="fc-front">${c.front}</div>
          <div class="fc-back-preview">${(c.back||'').slice(0,60)}${c.back?.length>60?'…':''}</div>
          ${(c.tags||[]).map(t=>`<span class="fc-tag">#${t}</span>`).join('')}
          <div class="fc-score-bar"><div class="fc-score-fill" style="width:${(c.score||0)*50}%;background:${c.score>=2?'var(--green)':c.score===1?'var(--yellow)':'var(--red)'}"></div></div>
          ${reviewBadge}
        </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function openNewFlashcardModal(editId) {
  const cards = _getFlashcards();
  const c = editId ? cards.find(x => x.id === editId) : null;
  document.getElementById('fc-edit-id').value = editId || '';
  document.getElementById('fc-modal-title').textContent = editId ? '✏️ Editar Flashcard' : '🃏 Nueva Flashcard';
  document.getElementById('fc-front').value = c?.front || '';
  document.getElementById('fc-back').value  = c?.back  || '';
  document.getElementById('fc-tags').value  = (c?.tags||[]).join(', ');
  // Fill mat select
  const fcMat = document.getElementById('fc-mat');
  if (fcMat) {
    if (!fcMat.children.length) {
      fcMat.innerHTML = '<option value="">— General —</option>';
      State.materias.forEach(m => { const o = document.createElement('option'); o.value=m.id; o.textContent=`${m.icon||'📚'} ${m.name}`; fcMat.appendChild(o); });
    }
    fcMat.value = c?.matId || '';
  }
  _uiClick('modal-open');
  document.getElementById('modal-flashcard').classList.add('open');
}

function saveFlashcard() {
  const front = document.getElementById('fc-front').value.trim();
  const back  = document.getElementById('fc-back').value.trim();
  if (!front) { document.getElementById('fc-front').style.borderColor='var(--red)'; return; }
  document.getElementById('fc-front').style.borderColor = '';
  const cards = _getFlashcards();
  const editId = document.getElementById('fc-edit-id').value;
  const tags = (document.getElementById('fc-tags').value||'').split(',').map(t=>t.trim()).filter(Boolean);
  const matId = document.getElementById('fc-mat').value;
  if (editId) {
    const idx = cards.findIndex(c => c.id === editId);
    if (idx>=0) { cards[idx] = { ...cards[idx], front, back, tags, matId }; }
  } else {
    cards.push({ id: 'fc_'+Date.now(), front, back, tags, matId, score:0, createdAt:Date.now() });
  }
  _saveFlashcards(cards);
  closeModal('modal-flashcard');
  renderFlashcards();
  _uiClick('save');
}

function deleteFlashcard(id) {
  const cards = _getFlashcards().filter(c => c.id !== id);
  _saveFlashcards(cards);
  renderFlashcards();
}

// Create flashcard from selected note text
function createFlashcardFromSelection() {
  const sel = window.getSelection()?.toString().trim();
  if (!sel) { alert('Selecciona texto en la nota primero'); return; }
  openNewFlashcardModal();
  setTimeout(() => { document.getElementById('fc-front').value = sel; }, 50);
}

// ── FLASHCARD STUDY MODE ──────────────────────────────────────
let _studyDeck = [], _studyIdx = 0, _studyFlipped = false;

function startFlashcardStudy() {
  const cards = _getFlashcards();
  if (!cards.length) { alert('No tienes flashcards aún. ¡Crea algunas primero!'); return; }
  // Prioritize: overdue first, then unseen/low-score
  const now = Date.now();
  _studyDeck = [...cards].sort((a,b) => {
    const aOverdue = a.nextReview && a.nextReview <= now ? 0 : 1;
    const bOverdue = b.nextReview && b.nextReview <= now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (a.score||0) - (b.score||0);
  });
  _studyIdx = 0;
  _studyFlipped = false;
  _uiClick('modal-open');
  document.getElementById('modal-fc-study').classList.add('open');
  _renderStudyCard();
}

function _renderStudyCard() {
  if (_studyIdx >= _studyDeck.length) {
    // Done!
    document.getElementById('fc-study-text').textContent = '¡Terminaste el mazo! 🎉';
    document.getElementById('fc-study-side').textContent = 'COMPLETADO';
    document.getElementById('fc-study-actions').style.display = 'none';
    document.getElementById('fc-study-flip-hint').textContent = 'Cierra para terminar';
    document.getElementById('fc-study-progress').textContent = `${_studyDeck.length} / ${_studyDeck.length}`;
    _uiClick('task-done');
    return;
  }
  const c = _studyDeck[_studyIdx];
  _studyFlipped = false;
  document.getElementById('fc-study-progress').textContent = `${_studyIdx+1} / ${_studyDeck.length}`;
  const m = c.matId ? getMat(c.matId) : { name:'General', icon:'📋' };
  document.getElementById('fc-study-mat').textContent = `${m.icon||'📚'} ${m.name}`;
  document.getElementById('fc-study-side').textContent = 'PREGUNTA';
  document.getElementById('fc-study-text').textContent = c.front;
  document.getElementById('fc-study-actions').style.display = 'none';
  document.getElementById('fc-study-flip-hint').style.display = 'block';
  document.getElementById('fc-card-wrap').style.borderColor = 'var(--border2)';
  const nrEl = document.getElementById('fc-study-next-review');
  if (nrEl) nrEl.style.display = 'none';
}

function flipStudyCard() {
  if (_studyIdx >= _studyDeck.length) return;
  if (_studyFlipped) return;
  _studyFlipped = true;
  const c = _studyDeck[_studyIdx];
  const wrap = document.getElementById('fc-card-wrap');
  wrap.style.animation = 'fc-flip .3s ease';
  setTimeout(() => {
    wrap.style.animation = '';
    document.getElementById('fc-study-side').textContent = 'RESPUESTA';
    document.getElementById('fc-study-text').textContent = c.back || '(sin respuesta)';
    document.getElementById('fc-study-actions').style.display = 'flex';
    document.getElementById('fc-study-flip-hint').style.display = 'none';
    wrap.style.borderColor = 'var(--accent)';
    // Show current interval info
    const nrEl = document.getElementById('fc-study-next-review');
    if (nrEl) {
      const intervalDays = c.intervalDays || 1;
      nrEl.style.display = 'block';
      nrEl.textContent = `Intervalo actual: ${intervalDays} día${intervalDays!==1?'s':''}${c.nextReview ? ' · Próx. repaso: ' + new Date(c.nextReview).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''}`;
    }
  }, 150);
}

function fcRate(score) {
  // score: 2=easy, 1=medium, 0=hard
  const c = _studyDeck[_studyIdx];
  const cards = _getFlashcards();
  const idx = cards.findIndex(x => x.id === c.id);
  if (idx >= 0) {
    const card = cards[idx];
    // Update score
    card.score = Math.max(0, Math.min(2, (card.score||0) + (score===2?1 : score===1?0 : -1)));
    card.lastStudied = Date.now();
    // Spaced repetition: calculate nextReview
    const now = Date.now();
    let intervalDays;
    if (score === 2) {        // Fácil
      const prev = card.intervalDays || 1;
      intervalDays = Math.round(prev * 2.5);
    } else if (score === 1) { // Media
      intervalDays = card.intervalDays || 1;
    } else {                  // Difícil
      intervalDays = 1;
    }
    intervalDays = Math.max(1, Math.min(intervalDays, 90));
    card.intervalDays = intervalDays;
    card.nextReview   = now + intervalDays * 86400000;
    _saveFlashcards(cards);
  }
  _studyIdx++;
  if (score === 2) _uiClick('save'); else _uiClick('click');
  _renderStudyCard();
}

// ── NOTES SEARCH ─────────────────────────────────────────────
function openModal(id) {
  _uiClick('modal-open');
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    // Auto-focus search input if present
    setTimeout(() => { el.querySelector('input[autofocus], input[type="text"]')?.focus(); }, 80);
  }
}

function renderNotesSearchResults() {
  const q = (document.getElementById('notes-search-inp')?.value || '').toLowerCase().trim();
  const container = document.getElementById('notes-search-results');
  if (!container) return;
  if (!q) { container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Escribe para buscar...</div>'; return; }

  const notes = _getNotesArray();
  const results = notes.filter(n =>
    (n.title||'').toLowerCase().includes(q) ||
    (n.content||'').toLowerCase().includes(q) ||
    (n.tags||[]).some(t => t.toLowerCase().includes(q))
  );

  if (!results.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Sin resultados para "${q}"</div>`;
    return;
  }

  container.innerHTML = results.map(n => {
    const mat = n.matId ? State.materias.find(m => m.id === n.matId) : null;
    // Highlight matching text in content
    const content = (n.content||'').replace(/\n/g,' ');
    const qIdx = content.toLowerCase().indexOf(q);
    const snippet = qIdx >= 0
      ? '…' + content.slice(Math.max(0,qIdx-30), qIdx+80) + '…'
      : content.slice(0, 80);
    const highlighted = snippet.replace(new RegExp(q,'gi'), m => `<mark style="background:rgba(124,106,255,.3);color:var(--accent2);border-radius:2px;">${m}</mark>`);
    return `<div onclick="closeModal('modal-notes-search');goPage('notas',document.querySelector('[onclick*=notas]'));setTimeout(()=>selectProNote('${n.id}'),300);"
      style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${(n.title||'Sin título').replace(new RegExp(q,'gi'), m=>`<mark style="background:rgba(124,106,255,.3);color:var(--accent2);">${m}</mark>`)}</div>
      <div style="font-size:11px;color:var(--text3);">${highlighted}</div>
      ${mat ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">${mat.icon||'📚'} ${mat.name}</div>` : ''}
    </div>`;
  }).join('');
}

// ── NOTE TAGS ─────────────────────────────────────────────────
function onNoteTagsInput() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.tags = (document.getElementById('notes-tags-inp')?.value || '').split(',').map(t=>t.trim()).filter(Boolean);
  _renderTagsDisplay(note.tags);
  _scheduleAutoSave();
}
function _renderTagsDisplay(tags) {
  const d = document.getElementById('notes-tags-display');
  if (d) d.innerHTML = tags.map(t=>`<span class="tag-chip active">#${t}</span>`).join('');
}

// Tags are now populated directly in _loadNoteInProEditor above

// ── RICH TEXT EDITOR (RTE) ────────────────────────────────────

function onRteInput() {
  if (!_currentNoteId) return;
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (note) note.content = rte.innerHTML;
  _updateWordCount(rte.textContent || '');
  _scheduleAutoSave();
}

function onRteKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
  }
  setTimeout(rteUpdateToolbarState, 10);
}

function rteExec(cmd, val) {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  rte.focus();
  document.execCommand(cmd, false, val || null);
  rteUpdateToolbarState();
  onRteInput();
}

function rteApplyHeading(tag) {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  rte.focus();
  document.execCommand('formatBlock', false, tag);
  rteUpdateToolbarState();
  onRteInput();
  setTimeout(() => { const s = document.getElementById('rte-heading'); if(s) s.value = 'p'; }, 50);
}

function rteUpdateToolbarState() {
  const cmds = ['bold','italic','underline','strikeThrough'];
  const ids  = ['rte-bold','rte-italic','rte-underline','rte-strikethrough'];
  cmds.forEach((cmd, i) => {
    const btn = document.getElementById(ids[i]);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

function rteCopyFormatted() {
  const rte = document.getElementById('notes-rte');
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!rte || !note) return;
  const styledHtml = `<h2 style="font-family:Georgia,serif;">${note.title||'Nota'}</h2>` + rte.innerHTML;
  try {
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const blobPlain = new Blob([rte.textContent], { type: 'text/plain' });
    const data = new ClipboardItem({ 'text/html': blob, 'text/plain': blobPlain });
    navigator.clipboard.write([data]).then(() => {
      const ind = document.getElementById('notes-autosave-indicator');
      if (ind) { ind.textContent = '📋 Copiado con formato!'; setTimeout(()=>{ ind.textContent='—'; },2500); }
    }).catch(() => {
      const range = document.createRange();
      range.selectNodeContents(rte);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
    });
  } catch(e) {
    const range = document.createRange();
    range.selectNodeContents(rte);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('copy'); sel.removeAllRanges();
  }
}

function rteCopyPlain() {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  navigator.clipboard.writeText(rte.textContent || '').then(() => {
    const ind = document.getElementById('notes-autosave-indicator');
    if (ind) { ind.textContent = '📄 Texto copiado!'; setTimeout(()=>{ ind.textContent='—'; },2000); }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = rte.textContent || '';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  });
}

function _handleRtePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file && _currentNoteId) {
        const note = _getNotesArray().find(n => n.id === _currentNoteId);
        if (note) {
          const key = 'img_' + Date.now();
          const reader = new FileReader();
          reader.onload = async ev => {
            try {
              const idbKey = 'note_img_' + Date.now();
              await idbSaveImage(idbKey, ev.target.result);
              if (!note.images) note.images = {};
              note.images[key] = 'IDB:' + idbKey;
            } catch {
              if (!note.images) note.images = {};
              note.images[key] = ev.target.result;
            }
            saveState(['all']); _renderImagesStrip(note);
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }
  }
}

function _plaintextToRteHtml(text) {
  if (!text) return '';
  if (text.trim().startsWith('<')) return text;
  const lines = text.split('\n');
  let html = '';
  let inCodeBlock = false, codeBuffer = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCodeBlock) { html += `<pre><code>${_rteEsc(codeBuffer.trim())}</code></pre>`; codeBuffer=''; inCodeBlock=false; }
      else { inCodeBlock=true; }
      continue;
    }
    if (inCodeBlock) { codeBuffer+=line+'\n'; continue; }
    if (/^# /.test(line))   { html+=`<h1>${_rteEsc(line.slice(2))}</h1>`; continue; }
    if (/^## /.test(line))  { html+=`<h2>${_rteEsc(line.slice(3))}</h2>`; continue; }
    if (/^### /.test(line)) { html+=`<h3>${_rteEsc(line.slice(4))}</h3>`; continue; }
    if (/^[-*] /.test(line)){ html+=`<ul><li>${_rteEsc(line.slice(2))}</li></ul>`; continue; }
    if (/^\d+\. /.test(line)){html+=`<ol><li>${_rteEsc(line.replace(/^\d+\. /,''))}</li></ol>`; continue; }
    if (/^> /.test(line))   { html+=`<blockquote>${_rteEsc(line.slice(2))}</blockquote>`; continue; }
    if (!line.trim())       { html+='<p><br></p>'; continue; }
    if (/^[=\-]{3,}$/.test(line)){ html+='<hr>'; continue; }
    html+=`<p>${_rteEscInline(line)}</p>`;
  }
  return html || '<p></p>';
}
function _rteEsc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _rteEscInline(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
}

// ── END RICH TEXT EDITOR ──────────────────────────────────────


// ── EXPORT NOTE ───────────────────────────────────────────────
function exportCurrentNote() {
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const title = note.title || 'nota';
  const content = note.content || '';
  const isHtml = content.trim().startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(content);
  if (isHtml) {
    const htmlDoc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${note.title||'Nota'}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 30px;line-height:1.8;color:#1a1a2e;}h1{font-size:26px;border-bottom:2px solid #7c6aff;padding-bottom:8px;}h2{font-size:20px;margin-top:28px;}h3{font-size:16px;color:#7c6aff;}blockquote{border-left:3px solid #7c6aff;padding:8px 16px;margin:12px 0;color:#555;background:#f5f3ff;border-radius:0 6px 6px 0;}code{font-family:monospace;background:#f0f0f0;padding:2px 6px;border-radius:4px;}ul,ol{padding-left:28px;}</style>
</head><body><h1>${note.title||'Sin título'}</h1><p style="color:#888;font-size:13px;margin-bottom:24px;">Exportado el ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>${content}</body></html>`;
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_').slice(0,50)}.html`;
    a.click(); URL.revokeObjectURL(url);
  } else {
    const text = `${note.title||'Sin título'}\n${'='.repeat(40)}\n\n${content}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_').slice(0,50)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
  _uiClick('save');
}

// ── NOTE TEMPLATES ────────────────────────────────────────────
const NOTE_TEMPLATES = {
  clase: `# Clase — [Tema]
Fecha: ${new Date().toLocaleDateString('es-ES')}
Materia: 

## Objetivos
- 

## Conceptos clave
- 

## Ejemplos
- 

## Dudas / Preguntas
- 

## Tarea para próxima clase
- `,
  parcial: `# Repaso Parcial — [Materia]
Fecha del parcial: 

## Temas que entran
1. 
2. 
3. 

## Fórmulas importantes
\`\`\`

\`\`\`

## Conceptos clave
- 

## Lo que debo repasar más
- [ ] 
- [ ] 

## Notas del profe
- `,
  laboratorio: `# Laboratorio — [Número y Nombre]
Fecha: ${new Date().toLocaleDateString('es-ES')}
Materia: 
Integrantes: 

## Objetivos
1. 

## Materiales
- 

## Procedimiento
1. 

## Resultados / Datos
| Medición | Valor | Unidad |
|----------|-------|--------|
|          |       |        |

## Análisis y conclusiones
- 

## Preguntas del informe
1. `,
};

function openNoteTemplateMenu() {
  const menu = `<div style="position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;" onclick="this.remove()">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;min-width:280px;box-shadow:var(--shadow);" onclick="event.stopPropagation()">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;">📋 Elegir plantilla</div>
      ${Object.entries({clase:'🎓 Apuntes de clase',parcial:'📝 Repaso para parcial',laboratorio:'🔬 Informe de laboratorio'})
        .map(([k,v]) => `<button class="btn btn-ghost" style="width:100%;text-align:left;margin-bottom:6px;" onclick="applyNoteTemplate('${k}');this.closest('[style*=fixed]').remove();">${v}</button>`).join('')}
      <button class="btn btn-ghost" style="width:100%;text-align:left;color:var(--text3);" onclick="this.closest('[style*=fixed]').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', menu);
}

function applyNoteTemplate(key) {
  if (!_currentNoteId) { addNewNote(); setTimeout(()=>applyNoteTemplate(key), 200); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const plainText = NOTE_TEMPLATES[key] || '';
  const htmlContent = _plaintextToRteHtml(plainText);
  note.content = htmlContent;
  const rte = document.getElementById('notes-rte');
  if (rte) rte.innerHTML = htmlContent;
  saveState(['all']);
  _uiClick('save');
}

// Template button is rendered via applyNoteTemplate() called from HTML


// Streak is now updated directly inside toggleTask above


// Hoy badge update is handled inside updateBadge() directly

// Hoy badge is now updated directly inside updateBadge above

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  updateBadge(); // also updates hoy badge
  // Add "Flashcard" button to note editor toolbar when note is selected
});

// Add "🃏 Flashcard" and "📋 Plantilla" buttons to notes title toolbar
// Use MutationObserver instead of setInterval to avoid polling
(function _patchNotesToolbar() {
  function _tryInject() {
    const wrap = document.getElementById('notes-title-wrap');
    if (!wrap) return false;
    const row = wrap.querySelector('div[style*="display:flex"]');
    if (row && !row.querySelector('#btn-fc-from-note')) {
      const fcBtn = document.createElement('button');
      fcBtn.id = 'btn-fc-from-note';
      fcBtn.className = 'btn btn-ghost btn-sm';
      fcBtn.title = 'Crear flashcard del texto seleccionado';
      fcBtn.textContent = '🃏';
      fcBtn.onclick = createFlashcardFromSelection;
      const tplBtn = document.createElement('button');
      tplBtn.className = 'btn btn-ghost btn-sm';
      tplBtn.title = 'Aplicar plantilla';
      tplBtn.textContent = '📋';
      tplBtn.onclick = openNoteTemplateMenu;
      const canvasBtn = row.querySelector('[title*="canvas"]');
      if (canvasBtn) { row.insertBefore(tplBtn, canvasBtn); row.insertBefore(fcBtn, canvasBtn); }
      else { row.appendChild(fcBtn); row.appendChild(tplBtn); }
    }
    return true;
  }
  if (!_tryInject()) {
    const obs = new MutationObserver(() => { if (_tryInject()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();

// ══════════════════════════════════════════════════════════════
// CRONÓMETRO INTELIGENTE — 3 contadores
//   chronoWorkSec  = solo cuenta cuando el pomodoro está corriendo
//   chronoBreakSec = cuenta en fase descanso (pom corriendo o manual)
//   chronoTotalSec = siempre cuenta desde que se inicia (tiempo real)
// ══════════════════════════════════════════════════════════════
var chronoR        = false;    // cronómetro activo (total siempre corre)
var chronoPhase    = 'work';   // 'work' | 'break'
var chronoPomLive  = false;    // true solo cuando pomodoro está running
var chronoWorkSec  = 0;
var chronoBreakSec = 0;
var chronoTotalSec = 0;        // tiempo real (no para con pausa del pom)
var chronoI        = null;

function _chronoFmt(s) {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function _chronoTickStart() {
  if (chronoI) clearInterval(chronoI);
  chronoI = setInterval(() => {
    if (!chronoR) return;
    // Total siempre corre
    chronoTotalSec++;
    // Trabajo: solo si pom está vivo Y fase es trabajo
    if (chronoPomLive && chronoPhase === 'work') chronoWorkSec++;
    // Descanso: si fase es descanso (independiente de pausa)
    else if (chronoPhase === 'break') chronoBreakSec++;
    // Si es independiente (sin pom): ambos work/break cuentan normalmente
    else if (!chronoPomLive && chronoPhase === 'work') chronoWorkSec++;
    _chronoUpdateUI();
  }, 1000);
}

function _chronoUpdateUI() {
  const wEl  = document.getElementById('chrono-work');
  const bEl  = document.getElementById('chrono-break');
  const tEl  = document.getElementById('chrono-total');
  const stEl = document.getElementById('chrono-status');
  const pctEl= document.getElementById('chrono-pct');
  const barEl= document.getElementById('chrono-bar');
  const wBlk = document.getElementById('chrono-work-block');
  const bBlk = document.getElementById('chrono-break-block');
  const tBlk = document.getElementById('chrono-total-block');

  if (wEl) wEl.textContent = _chronoFmt(chronoWorkSec);
  if (bEl) bEl.textContent = _chronoFmt(chronoBreakSec);
  if (tEl) tEl.textContent = _chronoFmt(chronoTotalSec);

  // Highlight: work pulses when pom is live+work, break when in break
  const workActive  = chronoR && chronoPomLive && chronoPhase === 'work';
  const workIndep   = chronoR && !chronoPomLive && chronoPhase === 'work';
  const breakActive = chronoR && chronoPhase === 'break';
  if (wBlk) {
    wBlk.style.opacity     = (workActive || workIndep) ? '1' : '0.45';
    wBlk.style.borderColor = (workActive || workIndep) ? 'rgba(74,222,128,.6)' : 'rgba(74,222,128,.2)';
    wBlk.style.boxShadow   = (workActive || workIndep) ? '0 0 20px rgba(74,222,128,.15)' : 'none';
  }
  if (bBlk) {
    bBlk.style.opacity     = breakActive ? '1' : '0.45';
    bBlk.style.borderColor = breakActive ? 'rgba(96,165,250,.6)' : 'rgba(96,165,250,.2)';
    bBlk.style.boxShadow   = breakActive ? '0 0 20px rgba(96,165,250,.15)' : 'none';
  }
  if (tBlk) {
    tBlk.style.opacity = chronoR ? '1' : '0.6';
  }

  // Status
  if (stEl) {
    if (!chronoR && chronoTotalSec === 0) stEl.textContent = '⏹ Detenido — presiona Iniciar';
    else if (!chronoR) stEl.textContent = '⏸ Pausado (tiempo real también detenido)';
    else if (chronoPomLive && chronoPhase === 'work')  stEl.textContent = '📚 Pomodoro corriendo — tiempo efectivo acumulando';
    else if (!chronoPomLive && chronoPhase === 'work') stEl.textContent = '📚 Modo independiente — estudiando';
    else stEl.textContent = '☕ Descansando — tiempo real sigue corriendo';
  }

  // Efficiency: work / total
  const pct = chronoTotalSec > 0 ? Math.round((chronoWorkSec / chronoTotalSec) * 100) : 0;
  if (pctEl) {
    pctEl.textContent = chronoTotalSec > 0 ? `${pct}%` : '—';
    pctEl.style.color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
}

function _chronoUpdateSwitchBtn() {
  const btn = document.getElementById('chrono-switch-btn');
  if (!btn) return;
  btn.textContent = chronoPhase === 'work' ? '☕ Cambiar a descanso' : '📚 Cambiar a estudio';
}

function chronoToggle() {
  const btn = document.getElementById('chrono-btn');
  if (chronoR) {
    chronoR = false;
    if (btn) btn.textContent = '▶ Continuar';
  } else {
    chronoR = true;
    // Sync phase with pom if running
    if (typeof pomR !== 'undefined' && pomR) {
      chronoPhase   = pomB ? 'break' : 'work';
      chronoPomLive = !pomB; // pomR is true means pom interval is running
      document.getElementById('chrono-mode-badge').textContent = 'POMODORO';
    } else {
      chronoPomLive = false;
      document.getElementById('chrono-mode-badge').textContent = 'INDEPENDIENTE';
    }
    if (btn) btn.textContent = '⏸ Pausar';
    if (!chronoI) _chronoTickStart();
  }
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

// Called from pomToggle when pom starts/pauses
function _chronoNotifyPomState(running, phase) {
  chronoPomLive = running;
  if (phase) chronoPhase = phase;
  if (running && !chronoR) {
    // Auto-start chrono when pom starts
    chronoR = true;
    document.getElementById('chrono-mode-badge').textContent = 'POMODORO';
    document.getElementById('chrono-btn').textContent = '⏸ Pausar';
    if (!chronoI) _chronoTickStart();
  }
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

function chronoSwitchPhase() {
  chronoPhase = chronoPhase === 'work' ? 'break' : 'work';
  _chronoUpdateSwitchBtn();
  _chronoUpdateUI();
}

function chronoReset() {
  if (chronoTotalSec > 0) {
    if (!confirm('¿Reiniciar el cronómetro? Se perderá el tiempo acumulado.')) return;
  }
  chronoR = false; chronoPhase = 'work'; chronoPomLive = false;
  chronoWorkSec = 0; chronoBreakSec = 0; chronoTotalSec = 0;
  if (chronoI) { clearInterval(chronoI); chronoI = null; }
  const btn   = document.getElementById('chrono-btn');
  const badge = document.getElementById('chrono-mode-badge');
  if (btn)   btn.textContent   = '▶ Iniciar';
  if (badge) badge.textContent = 'INDEPENDIENTE';
  document.getElementById('chrono-summary').style.display = 'none';
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

function chronoSave() {
  if (chronoTotalSec < 60) {
    alert('Menos de 1 minuto registrado. ¡Estudia un poco más! 😄'); return;
  }
  chronoR = false; chronoPomLive = false;
  if (chronoI) { clearInterval(chronoI); chronoI = null; }
  const btn = document.getElementById('chrono-btn');
  if (btn) btn.textContent = '▶ Iniciar';

  const workMins  = Math.round(chronoWorkSec  / 60);
  const breakMins = Math.round(chronoBreakSec / 60);
  const totalMins = Math.round(chronoTotalSec / 60);
  const pct       = chronoTotalSec > 0 ? Math.round((chronoWorkSec / chronoTotalSec) * 100) : 0;

  const summary     = document.getElementById('chrono-summary');
  const summaryText = document.getElementById('chrono-summary-text');
  if (summary && summaryText) {
    summary.style.display = 'block';
    summaryText.innerHTML = [
      `📚 Efectivo &nbsp;: ${_chronoFmt(chronoWorkSec)} (${workMins} min)`,
      `☕ Descanso &nbsp;: ${_chronoFmt(chronoBreakSec)} (${breakMins} min)`,
      `⏱️ Tiempo real: ${_chronoFmt(chronoTotalSec)} (${totalMins} min)`,
      `📊 Eficiencia &nbsp;: <strong style="color:${pct>=70?'var(--green)':pct>=50?'var(--yellow)':'var(--red)'}">${pct}%</strong>`,
    ].join('<br>');
  }

  document.getElementById('chrono-mode-badge').textContent = 'GUARDADO';
  if (workMins >= 1) { _recordPomWeekSession(workMins); _updateStreak(); renderPomGoal(); }
  _chronoUpdateUI();
  alert(`✅ Sesión guardada!\n📚 Efectivo: ${workMins} min\n☕ Descanso: ${breakMins} min\n⏱️ Real: ${totalMins} min\n📊 ${pct}% eficiencia`);
}

// ═══ QUIZZIZ PDF HANDLER ═══
document.addEventListener('DOMContentLoaded', function() {
  const pdfUploadInput = document.getElementById('quizziz-pdf-upload');
  if (pdfUploadInput) {
    pdfUploadInput.addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const reader = new FileReader();
        reader.onload = async function(event) {
          const pdf = await pdfjsLib.getDocument(event.target.result).promise;
          let pdfText = '';
          
          for (let i = 0; i < pdf.numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const textContent = await page.getTextContent();
            pdfText += textContent.items.map(item => item.str).join(' ') + '\n';
          }
          
          // Mostrar preview
          const preview = document.getElementById('quizziz-preview');
          const fileInfo = document.getElementById('quizziz-file-info');
          const generateBtn = document.getElementById('quizziz-generate-btn');
          const uploadText = document.getElementById('quizziz-upload-text');
          
          preview.classList.add('visible');
          fileInfo.innerHTML = `📄 ${file.name}<br>📄 ${pdf.numPages} páginas cargadas`;
          generateBtn.style.display = 'flex';
          uploadText.textContent = '✓ PDF cargado correctamente';
          
          // Guardar el texto en memoria
          window.quizzizPdfText = pdfText;
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        alert('❌ Error al procesar PDF: ' + err.message);
      }
    });
  }
  
  // Setup label click
  const uploadLabel = document.getElementById('quizziz-upload-label');
  if (uploadLabel) {
    uploadLabel.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('quizziz-pdf-upload').click();
    });
  }
});

// Función para generar quiz desde PDF
function generateQuizzizFromPDF() {
  if (!window.quizzizPdfText) {
    alert('Por favor carga un PDF primero');
    return;
  }
  
  // Extraer oraciones y crear preguntas simples
  const sentences = window.quizzizPdfText.match(/[^.!?]+[.!?]+/g) || [];
  const questions = sentences.slice(0, 10).map((sent, idx) => ({
    id: idx,
    text: `¿Cuál es el concepto principal en: "${sent.trim().substring(0, 60)}..."?`,
    type: 'open'
  }));
  
  // Mostrar resultado
  const previewEl = document.getElementById('quizziz-preview');
  const fileInfoEl = document.getElementById('quizziz-file-info');
  
  previewEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="color:var(--green);font-weight:700;">✓ ${questions.length} preguntas generadas</span>
    </div>
    <div style="font-size:11px;color:var(--text3);">Las preguntas se generaron localmente desde el PDF. Puedes copiarlas o imprimirlas.</div>
  `;
  
  // Log para debug
  console.log('✓ Quiz generado:', questions);
  alert(`✅ ${questions.length} preguntas generadas localmente desde el PDF`);
}

// ═══ FOCUS MODE ═══
function enterFocusMode() {
  // Crear overlay focus mode
  const focusOverlay = document.createElement('div');
  focusOverlay.id = 'focus-mode-overlay';
  focusOverlay.className = 'focus-mode-container';
  
  // Obtener tiempo actual del pomodoro
  const pomTimeEl = document.getElementById('pom-time');
  const currentTime = pomTimeEl ? pomTimeEl.textContent : '25:00';
  
  focusOverlay.innerHTML = `
    <button class="focus-exit-btn" onclick="exitFocusMode()">✕ Salir Focus</button>
    
    <div style="display:flex;flex-direction:column;align-items:center;gap:40px;">
      <div class="focus-timer" id="focus-timer">${currentTime}</div>
      
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
        <button onclick="focusTogglePom()" style="padding:12px 24px;font-size:14px;background:var(--accent);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;transition:all .2s;" id="focus-pom-btn">▶ Iniciar</button>
        <button onclick="focusResetPom()" style="padding:12px 24px;font-size:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-weight:700;cursor:pointer;transition:all .2s;">↻ Reiniciar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(focusOverlay);
  document.body.style.overflow = 'hidden';
  
  // Variables de control
  let focusTime = 25 * 60; // 25 minutos en segundos
  let focusRunning = false;
  let focusInterval = null;
  
  // Sincronizar con el pomodoro real si está corriendo
  if (document.getElementById('pom-btn')) {
    const pomBtn = document.getElementById('pom-btn');
    if (pomBtn.textContent.includes('Pausar')) {
      focusRunning = true;
    }
  }
  
  // Función para actualizar display
  function updateFocusDisplay() {
    const mins = Math.floor(focusTime / 60);
    const secs = focusTime % 60;
    const timerEl = document.getElementById('focus-timer');
    if (timerEl) {
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }
  
  // Funciones globales para focus
  window.focusTogglePom = function() {
    const btn = document.getElementById('focus-pom-btn');
    if (focusRunning) {
      focusRunning = false;
      clearInterval(focusInterval);
      btn.textContent = '▶ Reanudar';
    } else {
      focusRunning = true;
      btn.textContent = '⏸ Pausar';
      focusInterval = setInterval(() => {
        focusTime--;
        updateFocusDisplay();
        if (focusTime <= 0) {
          focusTime = 25 * 60;
          focusRunning = false;
          clearInterval(focusInterval);
          btn.textContent = '▶ Iniciar';
          alert('🎉 ¡Sesión de enfoque completada!');
        }
      }, 1000);
    }
  };
  
  window.focusResetPom = function() {
    focusRunning = false;
    clearInterval(focusInterval);
    focusTime = 25 * 60;
    updateFocusDisplay();
    document.getElementById('focus-pom-btn').textContent = '▶ Iniciar';
  };
}

function exitFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.body.style.overflow = 'auto';
}

document.addEventListener('DOMContentLoaded', () => { _chronoUpdateUI(); _chronoUpdateSwitchBtn(); });


