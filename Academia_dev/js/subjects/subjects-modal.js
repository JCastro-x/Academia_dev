// ═══════════════════════════════════════════════════════════════
// SUBJECTS MODAL — UI de modales de creación y edición
// Gestión de formularios, zonas, colores, íconos
// ═══════════════════════════════════════════════════════════════

// Variables compartidas para selección de color/ícono (expuestas en window para evitar redeclaración)
window.newColorSel = window.newColorSel || '#7c6aff';
window.newIconSel = window.newIconSel || '📚';
window.zoneRowCount = window.zoneRowCount || 0;

// ═══════════════════════════════════════════════════════════════
// MODAL DE CREAR MATERIA
// ═══════════════════════════════════════════════════════════════

function openAddClassModal() {
  window._editClassMatId = null;
  const titleEl = document.querySelector('#modal-addclass .modal-title');
  const saveBtn = document.querySelector('#modal-addclass .form-actions .btn-primary');
  if (titleEl) titleEl.textContent = '📚 Nueva Clase';
  if (saveBtn) { 
    // 🔥 FIX: Remover onclick directo para evitar duplicación con event delegation
    saveBtn.onclick = null;
    saveBtn.textContent = '💾 Crear Clase';
    saveBtn.setAttribute('data-action', 'save-new-class');
  }

  document.getElementById('nc-name').value    = '';
  document.getElementById('nc-code').value    = '';
  document.getElementById('nc-credits').value = '3 cred';
  document.getElementById('nc-seccion').value     = '';
  document.getElementById('nc-catedratico').value = '';
  document.getElementById('nc-horario').value     = '';
  document.getElementById('nc-haslab').checked    = false;
  document.getElementById('nc-nolab').checked       = true;
  document.getElementById('lab-section').style.display = 'none';

  const ps = document.getElementById('nc-parent');
  if (ps) {
    ps.innerHTML = '<option value="">— No es un lab —</option>';
    State.materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id; o.textContent = `${m.icon||'📚'} ${m.name}`; ps.appendChild(o);
    });
  }

  document.querySelectorAll('#nc-dias-checks input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('zones-builder').innerHTML = '';
  window.zoneRowCount = 0;

  ['lab','tar','par','fin','extra'].forEach(id => {
    const cb = document.getElementById('uz-'+id+'-on'); if (cb) cb.checked = false;
    const ctrl = document.getElementById('uzc-'+id); if (ctrl) ctrl.style.display = 'none';
  });
  updateUsacSuma();

  window.newColorSel = '#7c6aff'; window.newIconSel = '📚';
  document.querySelectorAll('.color-opt').forEach(el => el.classList.toggle('selected', el.dataset.color === window.newColorSel));
  document.querySelectorAll('.icon-opt').forEach(el  => el.classList.toggle('selected', el.dataset.icon  === window.newIconSel));
  document.getElementById('modal-addclass').classList.add('open');
}

function toggleLabSection() {
  document.getElementById('lab-section').style.display = document.getElementById('nc-haslab').checked ? 'block' : 'none';
}

function selectColor(el) {
  window.newColorSel = el.dataset.color;
  document.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectIcon(el) {
  window.newIconSel = el.dataset.icon;
  document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function addZoneRow(labelVal, ptsVal, subsArr, origKey) {
  window.zoneRowCount++;
  const id   = 'zr-' + window.zoneRowCount;
  const subs = subsArr || (labelVal ? [{label: labelVal, pts: ptsVal || 0}] : []);
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const buildSubsHtml = (subsList) => subsList.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}">
      <input type="hidden" class="zone-sub-orig-key" value="${(s.key||'').replace(/"/g,'&quot;')}">
      <input type="text" class="form-input zone-sub-label" placeholder="Apartado (ej: Tarea P1)" value="${(s.label||'').replace(/"/g,'&quot;')}" style="font-size:12px;">
      <input type="number" class="form-input zone-sub-pts" placeholder="Pts" value="${s.pts||''}" min="0" max="200" style="font-size:12px;text-align:center;">
      <button class="btn btn-danger btn-sm" onclick="removeZoneSub('${id}', ${i})" style="padding:3px 6px;">✕</button>
    </div>`).join('');

  const totalPts = subs.reduce((a, s) => a + (parseFloat(s.pts) || 0), 0);

  div.innerHTML = `
    <input type="hidden" class="zone-orig-key" value="${(origKey||'').replace(/"/g,'&quot;')}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input zone-name-inp" data-zone-name="1" placeholder="Nombre de la zona (ej: Exámenes Parciales)" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="font-size:13px;font-weight:600;flex:1;">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;color:var(--text2);">
        <span style="font-size:11px;color:var(--text3);">Total:</span>
        <input type="number" id="${id}-total" class="form-input" min="0" max="999" step="0.5" value="${totalPts.toFixed(1)}" placeholder="0" style="width:70px;font-size:13px;font-weight:700;color:var(--accent2);text-align:center;padding:4px 6px;border:1.5px solid var(--accent2);border-radius:6px;background:var(--surface);" title="Puntos totales de esta zona (editable)">
        <span style="font-size:11px;color:var(--text3);">pts</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs" class="zone-subs-area">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="addZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;

  document.getElementById('zones-builder').appendChild(div);
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
    <input type="number" class="form-input" placeholder="Pts" min="0" max="200" style="font-size:12px;text-align:center;">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:3px 6px;">✕</button>`;
  subsDiv.appendChild(row);
}

function removeZoneSub(zoneId, idx) {
  const row = document.getElementById(zoneId + '-sub-' + idx);
  if (row) { row.remove(); updateZoneTotal(zoneId); }
}

function updateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value) || 0; });
  totalEl.value = total.toFixed(1);
}

// ═══════════════════════════════════════════════════════════════
// USAC ZONES HELPERS
// ═══════════════════════════════════════════════════════════════

function updateUsacSuma() {
  let total = 0;
  ['lab','tar','par','fin','extra'].forEach(id => {
    if (document.getElementById('uz-'+id+'-on')?.checked) total += parseFloat(document.getElementById('uz-'+id+'-pts')?.value) || 0;
  });
  const el = document.getElementById('uz-total'); if (el) el.textContent = total.toFixed(0);
}

function toggleUsacZone(zone) {
  const on = document.getElementById('uz-'+zone+'-on')?.checked;
  document.getElementById('uzc-'+zone).style.display = on ? 'flex' : 'none';
  updateUsacSuma();
}

function applyUsacZones() {
  const presets = {
    lab:   { label: 'Laboratorios', pts: 20, subs: [{l:'Lab 1',p:5},{l:'Lab 2',p:5},{l:'Lab 3',p:5},{l:'Lab 4',p:5}] },
    tar:   { label: 'Tareas', pts: 20, subs: [{l:'Tarea 1',p:4},{l:'Tarea 2',p:4},{l:'Tarea 3',p:4},{l:'Tarea 4',p:4},{l:'Tarea 5',p:4}] },
    par:   { label: 'Parciales', pts: 30, subs: [{l:'Primer parcial',p:15},{l:'Segundo parcial',p:15}] },
    fin:   { label: 'Final', pts: 30, subs: [{l:'Examen final',p:30}] },
    extra: { label: 'Actividades', pts: 10, subs: [{l:'Actividad 1',p:5},{l:'Actividad 2',p:5}] }
  };
  let added = false;
  ['lab','tar','par','fin','extra'].forEach(key => {
    if (!document.getElementById('uz-'+key+'-on')?.checked) return;
    const p = presets[key];
    const subArr = p.subs.map(s => ({ label: s.l, pts: s.p }));
    addZoneRow(p.label, p.pts, subArr, '');
    added = true;
  });
  if (!added) { if (typeof _appNotify === 'function') _appNotify('Selecciona al menos una zona para aplicar.', 'warning'); return; }
}

// ═══════════════════════════════════════════════════════════════
// MODAL DE EDITAR MATERIA
// ═══════════════════════════════════════════════════════════════

function openEditClassModal(matId) {
  window._editClassMatId = matId;
  const mat = getMat(matId);
  if (!mat) return;

  const titleEl = document.querySelector('#modal-addclass .modal-title');
  const saveBtn = document.querySelector('#modal-addclass .form-actions .btn-primary');
  if (titleEl) titleEl.textContent = `: ${mat.name}`;
  if (saveBtn) { 
    // 🔥 FIX: Remover onclick directo para evitar duplicación con event delegation
    saveBtn.onclick = null;
    saveBtn.textContent = ' Guardar Cambios';
    saveBtn.setAttribute('data-action', 'save-edit-class');
  }

  document.getElementById('nc-name').value    = mat.name    || '';
  document.getElementById('nc-code').value    = mat.code    || '';
  document.getElementById('nc-credits').value = mat.credits || '';
  document.getElementById('nc-nolab').checked = true;
  document.getElementById('lab-section').style.display = 'none';

  const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  sv('nc-seccion', mat.seccion); sv('nc-catedratico', mat.catedratico); sv('nc-horario', mat.horario);

  document.querySelectorAll('#nc-dias-checks input[type=checkbox]').forEach(cb => { cb.checked = (mat.dias || '').includes(cb.value); });

  window.newColorSel = mat.color || '#7c6aff'; window.newIconSel = mat.icon || '📚';
  document.querySelectorAll('#modal-addclass .color-opt').forEach(el => el.classList.toggle('selected', el.dataset.color === window.newColorSel));
  document.querySelectorAll('#modal-addclass .icon-opt').forEach(el => el.classList.toggle('selected', el.dataset.icon === window.newIconSel));

  ['lab','tar','par','fin','extra'].forEach(id => {
    const cb = document.getElementById('uz-'+id+'-on'); if (cb) cb.checked = false;
    const ctrl = document.getElementById('uzc-'+id); if (ctrl) ctrl.style.display = 'none';
  });
  updateUsacSuma();

  document.getElementById('zones-builder').innerHTML = '';
  window.zoneRowCount = 0;
  mat.zones.filter(z => !z.isLabZone).forEach(z => {
    addZoneRow(z.label, z.maxPts, z.subs.map(s => ({ label: s.label, pts: s.maxPts, key: s.key })), z.key);
  });

  const ps = document.getElementById('nc-parent');
  ps.innerHTML = '<option value="">— No es un lab —</option>';
  State.materias.forEach(m => { if (m.id === matId) return; const o = document.createElement('option'); o.value = m.id; o.textContent = `${m.icon||''} ${m.name}`; ps.appendChild(o); });
  if (mat.parentId) ps.value = mat.parentId;

  document.getElementById('modal-addclass').classList.add('open');
}

function ecSelectColor(el) {
  window.newColorSel = el.dataset.color;
  document.querySelectorAll('#modal-editclass .color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function ecSelectIcon(el) {
  window.newIconSel = el.dataset.icon;
  document.querySelectorAll('#modal-editclass .icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function _addEditZoneRow(labelVal, subsArr, zoneMaxPts) {
  window.zoneRowCount++;
  const id   = 'ecz-' + window.zoneRowCount;
  const subs = subsArr || [];
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const buildSubsHtml = (list) => list.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="text" class="form-input ec-sub-label" placeholder="Nombre del apartado" value="${(s.label||'').replace(/"/g,'&quot;')}" style="flex:1;font-size:12px;">
      <input type="number" class="form-input ec-sub-pts" placeholder="Pts" value="${s.maxPts != null ? s.maxPts : ''}" min="0" max="999" step="0.5" style="width:70px;font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${id}')">
      <button class="btn btn-danger btn-sm" onclick="this.closest('.zone-sub-row').remove();ecUpdateZoneTotal('${id}')" style="padding:3px 7px;flex-shrink:0;">✕</button>
    </div>`).join('');

  const subsSum  = subs.reduce((a, s) => a + (parseFloat(s.maxPts) || 0), 0);
  const totalPts = (zoneMaxPts != null && zoneMaxPts > 0) ? zoneMaxPts : subsSum;
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input ec-zone-name" placeholder="Nombre de la zona" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="flex:1;font-size:13px;font-weight:600;">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;color:var(--text2);">
        <span style="font-size:11px;color:var(--text3);">Total:</span>
        <input type="number" id="${id}-total" class="form-input" min="0" max="999" step="0.5" value="${totalPts.toFixed(1)}" style="width:70px;font-size:13px;font-weight:700;color:var(--accent2);text-align:center;padding:4px 6px;border:1.5px solid var(--accent2);border-radius:6px;background:var(--surface);" title="Puntos totales de esta zona (editable)">
        <span style="font-size:11px;color:var(--text3);">pts</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="ecAddZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;
  document.getElementById('ec-zones-builder').appendChild(div);
}

function ecAddZoneRow() {
  window.zoneRowCount++;
  const id  = 'ecz-' + window.zoneRowCount;
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input ec-zone-name" placeholder="Nombre de la zona" style="flex:1;font-size:13px;font-weight:600;">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;color:var(--text2);">
        <span style="font-size:11px;color:var(--text3);">Total:</span>
        <input type="number" id="${id}-total" class="form-input" min="0" max="999" step="0.5" value="" placeholder="0" style="width:70px;font-size:13px;font-weight:700;color:var(--accent2);text-align:center;padding:4px 6px;border:1.5px solid var(--accent2);border-radius:6px;background:var(--surface);" title="Puntos totales de esta zona (editable)">
        <span style="font-size:11px;color:var(--text3);">pts</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs"></div>
    <button class="btn btn-ghost btn-sm" onclick="ecAddZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;
  document.getElementById('ec-zones-builder').appendChild(div);
  ecAddZoneSub(id);
}

function ecAddZoneSub(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  if (!subsDiv) return;
  const idx = subsDiv.querySelectorAll('.zone-sub-row').length;
  const row = document.createElement('div');
  row.className = 'zone-sub-row';
  row.id = zoneId + '-sub-' + idx;
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
  row.innerHTML = `
    <input type="text" class="form-input ec-sub-label" placeholder="Nombre del apartado" style="flex:1;font-size:12px;">
    <input type="number" class="form-input ec-sub-pts" placeholder="Pts" min="0" max="999" step="0.5" style="width:70px;font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${zoneId}')">
    <button class="btn btn-danger btn-sm" onclick="this.closest('.zone-sub-row').remove();ecUpdateZoneTotal('${zoneId}')" style="padding:3px 7px;">✕</button>`;
  subsDiv.appendChild(row);
}

function ecUpdateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('.ec-sub-pts').forEach(inp => { total += parseFloat(inp.value) || 0; });
  totalEl.value = total.toFixed(1);
}

// ═══════════════════════════════════════════════════════════════
// EVENT DELEGATION
// ═══════════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const actionType = action.dataset.action;

  if (actionType === 'close-modal') {
    const target = action.dataset.target;
    if (target && typeof closeModal === 'function') closeModal(target);
  }
  if (actionType === 'select-icon') { if (typeof selectIcon === 'function') selectIcon(action); }
  if (actionType === 'select-color') { if (typeof selectColor === 'function') selectColor(action); }
  if (actionType === 'save-new-class') { if (typeof saveNewClass === 'function') saveNewClass(); }
  if (actionType === 'apply-usac-zones') { if (typeof applyUsacZones === 'function') applyUsacZones(); }
  if (actionType === 'add-zone-row') { if (typeof addZoneRow === 'function') addZoneRow(); }
  if (actionType === 'ec-select-icon') { if (typeof ecSelectIcon === 'function') ecSelectIcon(action); }
  if (actionType === 'ec-select-color') { if (typeof ecSelectColor === 'function') ecSelectColor(action); }
  if (actionType === 'save-edit-class') { if (typeof saveEditClass === 'function') saveEditClass(); }
  if (actionType === 'ec-add-zone-row') { if (typeof ecAddZoneRow === 'function') ecAddZoneRow(); }
});

document.addEventListener('change', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const actionType = action.dataset.action;
  if (actionType === 'toggle-lab-section') { if (typeof toggleLabSection === 'function') toggleLabSection(); }
  if (actionType === 'toggle-usac-zone') {
    const zone = action.dataset.zone;
    if (zone && typeof toggleUsacZone === 'function') toggleUsacZone(zone);
  }
});

document.addEventListener('input', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'update-usac-suma') { if (typeof updateUsacSuma === 'function') updateUsacSuma(); }
});

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.openAddClassModal   = openAddClassModal;
window.openEditClassModal  = openEditClassModal;
window.toggleLabSection    = toggleLabSection;
window.selectColor         = selectColor;
window.selectIcon          = selectIcon;
window.addZoneRow          = addZoneRow;
window.addZoneSub          = addZoneSub;
window.removeZoneSub       = removeZoneSub;
window.updateZoneTotal     = updateZoneTotal;
window.updateUsacSuma      = updateUsacSuma;
window.toggleUsacZone      = toggleUsacZone;
window.applyUsacZones      = applyUsacZones;
window.ecSelectColor       = ecSelectColor;
window.ecSelectIcon        = ecSelectIcon;
window.ecAddZoneRow        = ecAddZoneRow;
window.ecAddZoneSub        = ecAddZoneSub;
window.ecUpdateZoneTotal   = ecUpdateZoneTotal;
