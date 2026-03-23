
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

    const zonaMin = State.settings?.zonaMin || 36, zonaGanada = State.settings?.zonaGanada || 61;
    const totalPts = t ? t.total : null;
    const isGanada = totalPts !== null && totalPts >= zonaGanada;
    const hasZona  = totalPts !== null && totalPts >= zonaMin;
    const usacBanner = totalPts !== null ? (
      isGanada
        ? `<div style="margin-top:8px;background:rgba(74,222,128,.15);border:2px solid #4ade80;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:800;color:#4ade80;display:flex;align-items:center;gap:6px;">🏆 GANADA — ${totalPts.toFixed(1)} pts ≥ 61</div>`
        : hasZona
          ? `<div class="usac-zona-min-ok" style="margin-top:8px;">✅ Zona mín. alcanzada (${totalPts.toFixed(1)} ≥ ${zonaMin}) — Faltan ${(zonaGanada-totalPts).toFixed(1)} pts para ganar</div>`
          : `<div class="usac-zona-min-no" style="margin-top:8px;">⚠ Sin zona mín. — Faltan ${(zonaMin-totalPts).toFixed(1)} pts</div>`
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
  if (!zones.length) { alert('Agrega al menos una zona de calificación.\n\nUsa "✅ Generar Zonas" para crear las zonas de calificación.'); return; }

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
