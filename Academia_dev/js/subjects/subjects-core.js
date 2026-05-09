// ═══════════════════════════════════════════════════════════════
// SUBJECTS CORE — Lógica de negocio y gestión de estado
// CRUD de materias y semestres, cálculos, persistencia
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE SEMESTRES
// ═══════════════════════════════════════════════════════════════

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
  document.getElementById('ns-nombre').value    = sem.nombre || '';
  document.getElementById('ns-objetivo').value  = sem.promedioObjetivo || 70;
  document.getElementById('ns-prev-avg').value  = sem.prevAvg  || '';
  document.getElementById('ns-prev-cred').value = sem.prevCred || '';
  const cb = document.getElementById('ns-activar');
  if (cb) { cb.checked = !!sem.activo; cb.disabled = sem.activo; }
  document.querySelector('#modal-semestre .modal-title').textContent = '✏️ Editar Semestre';
  document.getElementById('modal-semestre').classList.add('open');
}

function saveNewSemestre() {
  try {
    // Obtener valores de inputs
    const nombreInput    = document.getElementById('ns-nombre');
    const objetivoInput  = document.getElementById('ns-objetivo');
    const prevAvgInput   = document.getElementById('ns-prev-avg');
    const prevCredInput  = document.getElementById('ns-prev-cred');
    const activarInput   = document.getElementById('ns-activar');

    if (!nombreInput) {
      console.error('[saveNewSemestre] No se encontró el input ns-nombre');
      throw new Error('Formulario de semestre no disponible');
    }

    const nombre    = nombreInput.value.trim();
    const objetivo  = parseFloat(objetivoInput?.value) || 70;
    const prevAvg   = parseFloat(prevAvgInput?.value) || 0;
    const prevCred  = parseFloat(prevCredInput?.value) || 0;
    const activar   = activarInput?.checked ?? true;

    // Validación
    if (!nombre) {
      if (typeof _appNotify === 'function') _appNotify('Ingresa un nombre para el semestre.', 'warning');
      return;
    }

    // Validar rangos numéricos
    const promedioObjetivo = Math.max(0, Math.min(100, objetivo));
    const prevAvgClamped = Math.max(0, Math.min(100, prevAvg));
    const prevCredClamped = Math.max(0, prevCred);

    console.log('[saveNewSemestre] Guardando semestre:', { nombre, promedioObjetivo, prevAvg: prevAvgClamped, prevCred: prevCredClamped, activar, isEdit: !!_editSemId });

    const isEdit = !!_editSemId;
    let targetSem = null;

    if (isEdit) {
      // Modo edición
      targetSem = State.semestres.find(s => s.id === _editSemId);
      if (!targetSem) {
        console.error('[saveNewSemestre] Semestre a editar no encontrado:', _editSemId);
        throw new Error('Semestre no encontrado');
      }

      // Actualizar campos
      targetSem.nombre           = nombre;
      targetSem.promedioObjetivo = promedioObjetivo;
      targetSem.prevAvg          = prevAvgClamped;
      targetSem.prevCred         = prevCredClamped;

      // Si se quiere activar y no está activo
      if (activar && !targetSem.activo) {
        State.semestres.forEach(s => s.activo = false);
        targetSem.activo = true;
        // Actualizar getter _activeSem
        Object.defineProperty(State, '_activeSemCache', { value: targetSem, writable: true });
      }

    } else {
      // Modo creación - Schema completo del semestre
      if (activar) {
        State.semestres.forEach(s => s.activo = false);
      }

      // Crear con schema completo (coincide con _buildDefaultSemester)
      const newSem = {
        id: 'sem_' + Date.now(),
        nombre,
        promedioObjetivo,
        prevAvg: prevAvgClamped,
        prevCred: prevCredClamped,
        activo: activar,
        cerrado: false,
        materias: [],
        grades: {},
        tasks: [],
        events: [],
        topics: [],
        notes: {},
        notesArray: [],
        flashcards: [],
        createdAt: new Date().toISOString()
      };

      State.semestres.push(newSem);
      targetSem = newSem;

      if (activar) {
        Object.defineProperty(State, '_activeSemCache', { value: newSem, writable: true });
      }

      console.log('[saveNewSemestre] Nuevo semestre creado:', newSem.id);
    }

    // Guardar estado inmediatamente
    saveStateNow(['semestres']);

    // Cerrar modal
    if (typeof closeModal === 'function') {
      closeModal('modal-semestre');
    }

    // Disparar eventos de actualización
    const semId = isEdit ? _editSemId : targetSem?.id;

    // Notificar sistema pub/sub
    if (typeof notify === 'function') {
      notify('semesters', {
        type: isEdit ? 'updated' : 'created',
        semester: targetSem,
        id: semId
      });
    }

    // Evento legacy semester:saved
    window.dispatchEvent(new CustomEvent('semester:saved', {
      detail: { id: semId, type: isEdit ? 'updated' : 'created' }
    }));

    // Si se activó o editó un semestre activo
    if (activar && targetSem?.activo) {
      window.dispatchEvent(new CustomEvent('semester:switched', {
        detail: { id: semId, name: nombre }
      }));
    }

    // Forzar refresh de todas las vistas relacionadas
    if (typeof _refreshAllViews === 'function') {
      _refreshAllViews();
    } else {
      // Fallback: refrescar manualmente si la función no está disponible
      if (typeof fillMatSels === 'function') fillMatSels();
      if (typeof renderMaterias === 'function') renderMaterias();
      if (typeof renderGrades === 'function') renderGrades();
      if (typeof renderSemesterBadge === 'function') renderSemesterBadge();
      if (typeof updateBadge === 'function') updateBadge();
    }

    // Resetear flag de edición
    _editSemId = null;

    console.log('[saveNewSemestre] Completado exitosamente');

  } catch (error) {
    console.error('[saveNewSemestre] Error:', error);
    if (typeof _appNotify === 'function') {
      _appNotify('Error al guardar semestre: ' + (error.message || 'Error desconocido'), 'error');
    }
    throw error; // Re-lanzar para que el caller pueda manejar
  }
}

async function deleteSemester(id) {
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  if (sem.activo) { if (typeof _appNotify === 'function') _appNotify('No puedes eliminar el semestre activo. Activa otro primero.', 'warning'); return; }

  const confirmed = await showConfirm(`¿Eliminar el semestre "${sem.nombre}"?\n\nSe perderán ${sem.materias?.length || 0} materias.`, { danger: true });
  if (!confirmed) return;

  // Backup para undo
  const deletedSem = JSON.parse(JSON.stringify(sem));
  const deletedGrades = {};
  const deletedTopics = [];
  sem.materias.forEach(m => {
    if (State.grades[m.id]) deletedGrades[m.id] = JSON.parse(JSON.stringify(State.grades[m.id]));
    State.topics.filter(t => t.matId === m.id).forEach(t => deletedTopics.push(JSON.parse(JSON.stringify(t))));
  });

  State.semestres = State.semestres.filter(s => s.id !== id);
  sem.materias.forEach(m => {
    delete State.grades[m.id];
    if (m.linkedLabId) delete State.grades[m.linkedLabId];
  });
  State.topics = State.topics.filter(t => !sem.materias.some(m => m.id === t.matId));

  saveState(['semestres', 'grades', 'topics']);
  window.dispatchEvent(new CustomEvent('semester:deleted', { detail: { id, name: deletedSem.nombre } }));

  if (typeof showUndoToast === 'function') {
    showUndoToast(`Semestre "${deletedSem.nombre}" eliminado`, () => {
      State.semestres.push(deletedSem);
      Object.assign(State.grades, deletedGrades);
      State.topics = [...State.topics, ...deletedTopics];
      saveState(['semestres', 'grades', 'topics']);
      window.dispatchEvent(new CustomEvent('semester:saved', { detail: { id: deletedSem.id } }));
    });
  }
}

async function closeSemester(id) {
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  const confirmed = await showConfirm(`¿Cerrar el semestre "${sem.nombre}"?\n\nSe archivará y no se podrá editar.`, { danger: true });
  if (!confirmed) return;
  sem.cerrado = true;
  sem.activo  = false;
  if (State._activeSem?.id === id) {
    const next = State.semestres.find(s => !s.cerrado);
    if (next) { next.activo = true; State._activeSem = next; }
    else State._activeSem = null;
  }
  saveState(['semestres']);
  window.dispatchEvent(new CustomEvent('semester:closed', { detail: { id } }));
}

function switchSemester(id) {
  const target = State.semestres.find(s => s.id === id);
  if (!target || target.cerrado) return;
  State.semestres.forEach(s => s.activo = false);
  target.activo = true;
  State._activeSem = target;
  saveState(['semestres']);
  window.dispatchEvent(new CustomEvent('semester:switched', { detail: { id } }));
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DE MATERIAS
// ═══════════════════════════════════════════════════════════════

async function deleteClass(matId) {
  const mat = getMat(matId);
  if (!mat) return;

  const confirmed = await showConfirm(`¿Eliminar la materia "${mat.name}"?`, { danger: true });
  if (!confirmed) return;

  const deletedData = { mat: { ...mat }, linkedLab: mat.linkedLabId ? getMat(mat.linkedLabId) : null,
    grades: State.grades[matId] ? { [matId]: { ...State.grades[matId] } } : null,
    topics: State.topics.filter(t => t.matId === matId).map(t => ({ ...t })) };

  if (mat.linkedLabId) {
    State.materias = State.materias.filter(m => m.id !== mat.linkedLabId);
    delete State.grades[mat.linkedLabId];
    State.topics = State.topics.filter(t => t.matId !== mat.linkedLabId);
  }
  State.materias = State.materias.filter(m => m.id !== matId);
  delete State.grades[matId];
  State.topics = State.topics.filter(t => t.matId !== matId);
  
  saveState(['materias', 'grades', 'topics']);
  window.dispatchEvent(new CustomEvent('subject:deleted', { detail: { id: matId, name: mat.name } }));

  if (typeof showUndoToast === 'function') {
    showUndoToast(`Materia "${mat.name}" eliminada`, () => {
      const sem = getActiveSem();
      if (!sem) return;
      sem.materias.push(deletedData.mat);
      if (deletedData.linkedLab) sem.materias.push(deletedData.linkedLab);
      if (deletedData.grades) Object.assign(State.grades, deletedData.grades);
      if (deletedData.topics) State.topics = [...State.topics, ...deletedData.topics];
      saveState(['materias', 'grades', 'topics']);
      window.dispatchEvent(new CustomEvent('subject:created', { detail: { id: deletedData.mat.id } }));
    });
  }
}

// Helper function to generate UUID using crypto API
function generateUUID() {
  if (typeof self.crypto !== 'undefined' && self.crypto.randomUUID) {
    return self.crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to generate default apartados (parciales) for a subject
function generateDefaultApartados() {
  const parcials = [
    { key: '1', label: 'Parcial 1' },
    { key: '2', label: 'Parcial 2' },
    { key: '3', label: 'Parcial 3' },
    { key: 'final', label: 'Final' }
  ];
  return parcials.map((p, idx) => ({
    id: generateUUID(),
    nombre: p.label,
    tipo: 'parcial',
    parcialKey: p.key,
    orden: idx
  }));
}

// Migration function: Add apartados to existing subjects that don't have them
function migrateSubjectsToApartados() {
  // First, clean up any null/undefined entries in materias array
  if (State.materias.some(m => !m)) {
    State.materias = State.materias.filter(m => m);
    saveState(['materias']);
    console.log('[MIGRATION] Cleaned up null entries from materias array');
  }
  
  let migrated = false;
  State.materias.forEach(mat => {
    if (!mat.apartados || !Array.isArray(mat.apartados) || mat.apartados.length === 0) {
      mat.apartados = generateDefaultApartados();
      migrated = true;
    }
  });
  if (migrated) {
    saveState(['materias']);
    console.log('[MIGRATION] Migrated subjects to include apartados array');
  }
}

function saveNewClass() {
  const name = document.getElementById('nc-name').value.trim();
  const code = document.getElementById('nc-code').value.trim();
  if (!name || !code) { if (typeof _appNotify === 'function') _appNotify('Ingresa nombre y código.', 'warning'); return; }
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
      if (subPts > 0) { subs.push({ key: key + '_' + (i+1), label: subLabel, maxPts: subPts }); totalPts += subPts; }
    });
    if (totalPts > 0) zones.push({ key, label: lbl, maxPts: totalPts, color: window.newColorSel, subs });
  });
  if (!zones.length) { if (typeof _appNotify === 'function') _appNotify('Agrega al menos una zona de calificación.', 'warning'); return; }

  const newId  = generateUUID();
  const ncDias = Array.from(document.querySelectorAll('#nc-dias-checks input[type=checkbox]:checked')).map(cb=>cb.value).join(', ');
  const newMat = { id:newId, name, code, color:window.newColorSel, icon:window.newIconSel, credits, zones,
    seccion: document.getElementById('nc-seccion')?.value.trim() || '',
    catedratico: document.getElementById('nc-catedratico')?.value.trim() || '',
    dias: ncDias, horario: document.getElementById('nc-horario')?.value.trim() || '',
    apartados: generateDefaultApartados() };

  if (parentId) {
    newMat.parentId = parentId; newMat.labScale = 100; newMat.labMaxPts = 10;
    const parentMat = State.materias.find(m => m.id === parentId);
    if (parentMat) newMat.color = parentMat.color;
    newMat.zones = [{ key:'g', label:'Calificación (/100)', maxPts:100, color:newMat.color, subs:[{key:'nota', label:'Nota General', maxPts:100}] }];
    const pidx = State.materias.findIndex(m => m.id === parentId);
    if (pidx >= 0) {
      State.materias[pidx].linkedLabId = newId; State.materias[pidx].labMaxPts = 10; State.materias[pidx].labScale = 100;
    }
  }
  State.materias.push(newMat);

  if (hasLab && !parentId) {
    const labName  = document.getElementById('nc-lab-name').value.trim() || name + ' Lab';
    const labCode  = document.getElementById('nc-lab-code').value.trim() || code + '-L';
    const labPts   = parseFloat(document.getElementById('nc-lab-pts').value) || 10;
    const labScale = parseFloat(document.getElementById('nc-lab-scale').value) || 100;
    const labId    = 'mat_lab_' + Date.now();
    State.materias.push({ id:labId, name:labName, code:labCode, color:'#4ade80', icon:'🧪', credits:'1 cred',
      parentId:newId, labScale, labMaxPts:labPts,
      zones:[{ key:'g', label:`Calificación (/${labScale})`, maxPts:labScale, color:'#4ade80',
        subs:[{key:'nota', label:'Nota General', maxPts:labScale}] }] });
    newMat.linkedLabId = labId; newMat.labMaxPts = labPts; newMat.labScale = labScale;
  }

  saveState(['materias']);
  closeModal('modal-addclass');
  window.dispatchEvent(new CustomEvent('subject:created', { detail: { id: newId, name, hasLab } }));
}

function saveEditClass() {
  const mat = getMat(window._editClassMatId);
  if (!mat) return;
  const name = document.getElementById('ec-name')?.value.trim();
  const code = document.getElementById('ec-code')?.value.trim();
  if (!name || !code) { if (typeof _appNotify === 'function') _appNotify('Ingresa nombre y código.', 'warning'); return; }

  mat.name = name; mat.code = code;
  mat.credits     = document.getElementById('ec-credits')?.value.trim()     || mat.credits;
  mat.catedratico = document.getElementById('ec-catedratico')?.value.trim() || '';
  mat.seccion     = document.getElementById('ec-seccion')?.value.trim()     || '';
  mat.horario     = document.getElementById('ec-horario')?.value.trim()     || '';
  mat.color       = window.newColorSel; mat.icon = window.newIconSel;
  mat.dias = Array.from(document.querySelectorAll('#ec-dias-checks input:checked')).map(cb => cb.value).join(', ');

  const labZones = mat.zones.filter(z => z.isLabZone);
  const newZones = [];
  document.getElementById('ec-zones-builder').querySelectorAll('div[id^="ecz-"]').forEach(row => {
    const lbl = row.querySelector('.ec-zone-name')?.value.trim(); if (!lbl) return;
    const key  = lbl.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const subs = []; let totalPts = 0;
    row.querySelectorAll('.zone-sub-row').forEach((sr, i) => {
      const subLabel = sr.querySelector('.ec-sub-label')?.value.trim() || lbl + ' ' + (i + 1);
      const subPts   = parseFloat(sr.querySelector('.ec-sub-pts')?.value) || 0;
      const existingZone = mat.zones.find(z => z.label === lbl);
      const existingKey  = existingZone?.subs?.[i]?.key || (key + '_' + (i + 1));
      subs.push({ key: existingKey, label: subLabel, maxPts: subPts }); totalPts += subPts;
    });
    const totalInput  = row.querySelector('[id$="-total"]');
    const manualTotal = parseFloat(totalInput?.value);
    if (!isNaN(manualTotal) && manualTotal > 0) totalPts = manualTotal;
    if (totalPts === 0 && subs.length > 0) totalPts = subs.reduce((a, s) => a + (s.maxPts || 0), 0);
    newZones.push({ key, label: lbl, maxPts: totalPts, color: window.newColorSel, subs });
  });

  if (!newZones.length) { if (typeof _appNotify === 'function') _appNotify('Agrega al menos una zona con nombre y puntos.', 'warning'); return; }
  mat.zones = [...newZones, ...labZones];
  getMat.bust(); saveState(['materias']);
  closeModal('modal-editclass');
  window.dispatchEvent(new CustomEvent('subject:updated', { detail: { id: mat.id, name: mat.name } }));
}

function saveEditClassFromCreate() {
  const mat = getMat(window._editClassMatId);
  if (!mat) return;
  const name = document.getElementById('nc-name').value.trim();
  const code = document.getElementById('nc-code').value.trim();
  if (!name || !code) { if (typeof _appNotify === 'function') _appNotify('Ingresa nombre y código.', 'warning'); return; }

  mat.name = name; mat.code = code;
  mat.credits     = document.getElementById('nc-credits').value.trim()     || mat.credits;
  mat.catedratico = document.getElementById('nc-catedratico')?.value.trim() || '';
  mat.seccion     = document.getElementById('nc-seccion')?.value.trim()     || '';
  mat.horario     = document.getElementById('nc-horario')?.value.trim()     || '';
  mat.color       = window.newColorSel; mat.icon = window.newIconSel;
  mat.dias = Array.from(document.querySelectorAll('#nc-dias-checks input:checked')).map(cb => cb.value).join(', ');

  const labZones = mat.zones.filter(z => z.isLabZone);
  const newZones = [];
  document.getElementById('zones-builder').querySelectorAll(':scope > div[id^="zr-"]').forEach(row => {
    const lbl = row.querySelector('.zone-name-inp')?.value.trim(); if (!lbl) return;
    const origKey = row.querySelector('.zone-orig-key')?.value || '';
    const key     = origKey || lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
    const subs = []; let totalPts = 0;
    row.querySelectorAll('.zone-sub-row').forEach((sr, i) => {
      const subLabel   = sr.querySelector('.zone-sub-label')?.value.trim() || lbl + ' ' + (i + 1);
      const subPts     = parseFloat(sr.querySelector('.zone-sub-pts')?.value) || 0;
      const origSubKey = sr.querySelector('.zone-sub-orig-key')?.value || '';
      const subKey     = origSubKey || (key + '_' + (i + 1));
      subs.push({ key: subKey, label: subLabel, maxPts: subPts }); totalPts += subPts;
    });
    const totalInput = row.querySelector('input[id$="-total"]');
    const manualTotal = totalInput ? parseFloat(totalInput.value) || 0 : 0;
    totalPts = manualTotal > 0 ? manualTotal : totalPts;
    if (totalPts === 0 && subs.length === 0) return;
    if (totalPts === 0 && subs.length > 0) totalPts = subs.reduce((a, s) => a + (s.maxPts || 0), 0);
    newZones.push({ key, label: lbl, maxPts: totalPts, color: window.newColorSel, subs });
  });

  if (!newZones.length) { if (typeof _appNotify === 'function') _appNotify('Agrega al least una zona de calificación.', 'warning'); return; }
  mat.zones = [...newZones, ...labZones];
  getMat.bust(); saveState(['materias']);
  closeModal('modal-addclass');
  window._editClassMatId = null;
  const titleEl = document.querySelector('#modal-addclass .modal-title');
  if (titleEl) titleEl.textContent = '📚 Nueva Clase';
  window.dispatchEvent(new CustomEvent('subject:updated', { detail: { id: mat.id, name: mat.name } }));
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════

function openConfigModal() {
  const sem = getActiveSem();
  document.getElementById('cfg-prev-avg').value   = sem.prevAvg  || '';
  document.getElementById('cfg-prev-cred').value  = sem.prevCred || '';
  document.getElementById('cfg-min-grade').value  = State.settings.minGrade || 70;
  document.getElementById('cfg-sem-target').value = sem.promedioObjetivo || 70;
  const savedApiKey = localStorage.getItem('gemini_api_key') || '';
  document.getElementById('cfg-api-key').value = savedApiKey;
  _updateConfigPreview();
  document.getElementById('modal-config').classList.add('open');
  const versionClick = document.getElementById('cfg-version-click');
  if (versionClick) {
    versionClick.onclick = () => {
      const apiSection = document.getElementById('cfg-api-section');
      apiSection.style.display = apiSection.style.display === 'none' ? 'block' : 'none';
    };
  }
}

function _updateConfigPreview() {
  const prevAvg  = parseFloat(document.getElementById('cfg-prev-avg')?.value)  || 0;
  const prevCred = parseFloat(document.getElementById('cfg-prev-cred')?.value) || 0;
  const sem = getActiveSem();
  sem.prevAvg  = prevAvg; sem.prevCred = prevCred;
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
}

function saveConfigModal() {
  const sem = getActiveSem();
  sem.prevAvg          = parseFloat(document.getElementById('cfg-prev-avg').value)  || 0;
  sem.prevCred         = parseFloat(document.getElementById('cfg-prev-cred').value) || 0;
  sem.promedioObjetivo = parseFloat(document.getElementById('cfg-sem-target').value)|| 70;
  State.settings.minGrade = parseFloat(document.getElementById('cfg-min-grade').value) || 70;
  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;
  const apiKey = document.getElementById('cfg-api-key').value.trim();
  if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
  saveState(['all']);
  closeModal('modal-config');
  window.dispatchEvent(new CustomEvent('config:saved'));
}

// ═══════════════════════════════════════════════════════════════
// GRADES CARD VIEW (usado por calificaciones.js)
// ═══════════════════════════════════════════════════════════════

let _gradesDetailMatId = null;

function gradesShowIndex() {
  _gradesDetailMatId = null;
  document.getElementById('grades-index-view').style.display = '';
  document.getElementById('grades-detail-view').style.display = 'none';
  if (typeof _renderGradeCards === 'function') _renderGradeCards();
}

function openGradesForMat(matId) {
  _gradesDetailMatId = matId;
  document.getElementById('grades-index-view').style.display = 'none';
  document.getElementById('grades-detail-view').style.display = '';
  const mat = getMat(matId);
  if (mat) {
    document.getElementById('grades-detail-title').textContent = `${mat.icon||'📚'} ${mat.name}`;
  }
  if (typeof _renderGrades === 'function') _renderGrades();
}

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.saveNewSemestre      = saveNewSemestre;
window.openSemestreModal    = openSemestreModal;
window.openSemestreEditModal= openSemestreEditModal;
window.deleteSemester       = deleteSemester;
window.closeSemester        = closeSemester;
window.switchSemester       = switchSemester;
window.deleteClass          = deleteClass;
window.saveNewClass         = saveNewClass;
window.saveEditClass        = saveEditClass;
window.saveEditClassFromCreate = saveEditClassFromCreate;
window.openConfigModal      = openConfigModal;
window._updateConfigPreview = _updateConfigPreview;
window.saveConfigModal      = saveConfigModal;
window._gradesDetailMatId   = _gradesDetailMatId;
window.gradesShowIndex      = gradesShowIndex;
window.openGradesForMat     = openGradesForMat;
window.generateUUID         = generateUUID;
window.generateDefaultApartados = generateDefaultApartados;
window.migrateSubjectsToApartados = migrateSubjectsToApartados;
