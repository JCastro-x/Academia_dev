// ═══════════════════════════════════════════════════════════════
// SUBJECTS UI — Renderizado de materias, semestres y hub
// Escucha CustomEvents de subjects-core.js para actualizarse
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// RENDERIZADO DE MATERIAS
// ═══════════════════════════════════════════════════════════════

function renderMaterias() {
  const grid = _el('materias-grid');
  if (grid && !grid.dataset.loaded) {
    showSkeleton(grid, 'grid', 4);
    grid.dataset.loaded = 'true';
    setTimeout(() => _schedRender(_renderMaterias), 300);
  } else {
    _schedRender(_renderMaterias);
  }
}

function _renderMaterias() {
  const min  = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const grid = _el('materias-grid');
  if (!grid) return;
  grid.classList.remove('skeleton-loading');
  // 🔥 Guard: verificar que State.materias exista
  if (!State.materias || !Array.isArray(State.materias)) {
    console.warn('[_renderMaterias] State.materias no está disponible aún');
    return;
  }
  const roots = State.materias.filter(m => m && !m.parentId);
  let html = '';

  roots.forEach(m => {
    if (!m) return;
    const t        = calcTotal(m.id);
    const pts      = t ? t.total.toFixed(1) : '—';
    const maxPts   = (m.zones || []).reduce((a,z) => a+(z.maxPts||0), 0);
    const pct      = t ? t.pct : 0;
    const pend     = State.tasks.filter(x => x.matId===m.id && !x.done).length;
    
    // 🔥 FIX: Usar umbrales USAC (36 zona mínima, 61 ganada) en lugar de min configurado
    const zonaMin = 36, zonaGanada = 61;
    const totalPts = t ? t.total : null;
    const isGanada = totalPts !== null && totalPts >= zonaGanada;
    const hasZona  = totalPts !== null && totalPts >= zonaMin;
    const sc       = t ? (isGanada?'#22c55e':hasZona?'#fbbf24':'#ef4444') : '#5a5a72';
    const sl       = t ? (isGanada?'🏆 GANADA':hasZona?'⚠ En zona':'✗ En riesgo') : 'Sin datos';
    
    const linkedLab= m.linkedLabId ? getMat(m.linkedLabId) : null;
    const labData  = m.linkedLabId ? getLabNetPts(m) : null;
    const usacBanner = totalPts !== null ? (
      isGanada
        ? `<div style="margin-top:8px;background:${m.color}22;border:2px solid ${m.color};border-radius:8px;padding:7px 10px;font-size:11px;font-weight:800;color:${m.color};display:flex;align-items:center;gap:6px;">🏆 GANADA — ${totalPts.toFixed(1)} pts ≥ 61</div>`
        : hasZona
          ? `<div class="usac-zona-min-ok" style="margin-top:8px;">✅ Zona mín. alcanzada (${totalPts.toFixed(1)} ≥ ${zonaMin}) — Faltan ${(zonaGanada-totalPts).toFixed(1)} pts para ganar</div>`
          : `<div class="usac-zona-min-no" style="margin-top:8px;">⚠ Sin zona mín. — Faltan ${(zonaMin-totalPts).toFixed(1)} pts</div>`
    ) : '';

    const cardStyle = isGanada
      ? `--mc:${m.color}; border:2px solid ${m.color}; box-shadow:0 0 20px ${m.color}33;`
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
        ${labData ? `<div style="margin-top:8px;font-size:11px;background:${m.color}15;border:1px solid ${m.color}33;border-radius:6px;padding:6px 8px;color:${m.color};">🧪 Lab: ${labData.labGrade.toFixed(0)}/${labData.labScale} → <strong>${labData.netPts.toFixed(2)}/${labData.labMaxPts} pts</strong></div>` : ''}
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

// ═══════════════════════════════════════════════════════════════
// GPA Y SEMESTRE
// ═══════════════════════════════════════════════════════════════

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
    window.dispatchEvent(new CustomEvent('semester:saved', { detail: { id: getActiveSem().id } }));
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

// ═══════════════════════════════════════════════════════════════
// SEMESTRES COMO CARDS
// ═══════════════════════════════════════════════════════════════

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
    // 🔥 Guard: verificar que sem.materias exista
    const matCount = (sem.materias || []).filter(m => !m.parentId).length;
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
            <div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--accent2);">${gpa.totalCreditos}</div><div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">CRÉDITOS</div></div>
            <div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--green);">${matCount}</div><div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">MATERIAS</div></div>
            <div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--blue);">${taskDone}/${taskCount}</div><div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">TAREAS</div></div>
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

// ═══════════════════════════════════════════════════════════════
// GRADES CARD VIEW
// ═══════════════════════════════════════════════════════════════

function _renderGradeCards() {
  const grid = document.getElementById('grades-cards-grid');
  if (!grid) return;
  const USAC_ZONA_MIN = 36, USAC_GANADA = 61;
  grid.innerHTML = State.materias.filter(m => m).map(mat => {
    if (!mat) return '';
    const t = calcTotal(mat.id);
    const total = t ? t.total : 0;
    const maxT = (mat.zones || []).reduce((a,z) => a+(z.maxPts||0), 0);
    const pct = t ? t.pct : 0;
    // 🔥 FIX: Usar umbrales USAC (36 zona mínima, 61 ganada) en lugar de min configurado
    const isGanada = t && total >= USAC_GANADA;
    const zonaMinOk = t && total >= USAC_ZONA_MIN;
    const sc = !t ? '#5a5a72' : isGanada ? '#22c55e' : zonaMinOk ? '#fbbf24' : '#ef4444';
    const sl = !t ? 'Sin datos' : isGanada ? '🏆 GANADA' : zonaMinOk ? '⚠ En zona' : '✗ En riesgo';
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

// ═══════════════════════════════════════════════════════════════
// GENERAL HUB
// ═══════════════════════════════════════════════════════════════

function renderGeneralHub() {
  // 🔥 Guard: verificar que State.materias exista
  if (!State.materias || !Array.isArray(State.materias)) {
    console.warn('[renderGeneralHub] State.materias no está disponible aún');
    return;
  }
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const atRisk = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total < min; }).length;
  const passed = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total >= min; }).length;
  const calStat = document.getElementById('hub-stat-cal');
  if (calStat) calStat.textContent = State.materias.length ? `${passed} aprobada${passed!==1?'s':''} · ${atRisk} en riesgo` : 'Sin materias aún';
  const fcAll = State.flashcards || [];
  const fcStat = document.getElementById('hub-stat-fc');
  if (fcStat) fcStat.textContent = fcAll.length ? `${fcAll.length} tarjeta${fcAll.length!==1?'s':''}` : 'Sin tarjetas aún';
  const gpa = calcOverallGPA();
  const statsStat = document.getElementById('hub-stat-stats');
  if (statsStat) statsStat.textContent = gpa.overallAvg !== null ? `Promedio: ${gpa.overallAvg.toFixed(1)} pts` : 'Sin datos aún';
  const tc = (State.topics||[]).length;
  const temasStat = document.getElementById('hub-stat-temas');
  if (temasStat) temasStat.textContent = tc ? `${tc} tema${tc!==1?'s':''} registrado${tc!==1?'s':''}` : 'Sin temas aún';
}

// Navegación desde el hub general
function openFromHub(page) {
  const navEl = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
  if (typeof goPage === 'function') goPage(page, navEl);
}

// ═══════════════════════════════════════════════════════════════
// LISTENERS DE CUSTOM EVENTS
// ═══════════════════════════════════════════════════════════════
window.addEventListener('subject:created', () => { renderMaterias(); renderSemestresList(); renderGeneralHub(); });
window.addEventListener('subject:deleted', () => { renderMaterias(); renderSemestresList(); renderGeneralHub(); });
window.addEventListener('subject:updated', () => { renderMaterias(); renderSemestresList(); renderGeneralHub(); });
window.addEventListener('semester:saved', () => { renderSemestresList(); updateGPADisplay(); renderGeneralHub(); });
window.addEventListener('semester:deleted', () => { renderSemestresList(); updateGPADisplay(); renderGeneralHub(); });
window.addEventListener('semester:switched', () => { renderMaterias(); renderSemestresList(); updateGPADisplay(); renderGeneralHub(); fillMatSels(); fillTopicMatSel(); fillPomSel(); });
window.addEventListener('semester:closed', () => { renderSemestresList(); updateGPADisplay(); });
window.addEventListener('config:saved', () => { updateGPADisplay(); renderMaterias(); renderGeneralHub(); });
window.addEventListener('grades:updated', () => { renderMaterias(); updateGPADisplay(); renderGeneralHub(); });

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.renderMaterias      = renderMaterias;
window._renderMaterias     = _renderMaterias;
window.renderSemesterBadge = renderSemesterBadge;
window.updateGPADisplay    = updateGPADisplay;
window.startSemEdit        = startSemEdit;
window.toggleSemSwitcher   = toggleSemSwitcher;
window.switchSemAndClose   = switchSemAndClose;
window.renderGeneralHub    = renderGeneralHub;
window.renderSemestresList = renderSemestresList;
window._renderGradeCards   = _renderGradeCards;
window.openFromHub         = openFromHub;

// ── Pub/Sub Subscription for Reactivity ───────────────────────────────
// Suscribirse a cambios en materias para re-renderizado granular
if (typeof window.subscribe === 'function') {
  const unsubscribeMaterias = window.subscribe('materias', (data) => {
    console.log('[MATERIAS] Received update notification:', data);
    if (data.type === 'update' && data.materia) {
      // Actualizar solo la materia específica en el DOM si existe
      const matEl = document.getElementById(`materia-${data.materia.id}`);
      if (matEl) {
        // Re-renderizar solo esta materia
        const materias = State.materias;
        const updatedMat = materias.find(m => m.id === data.materia.id);
        if (updatedMat) {
          // Actualizar contenido del DOM sin reconstruir todo
          const nameEl = matEl.querySelector('.materia-name');
          if (nameEl) nameEl.textContent = updatedMat.name;
          const colorEl = matEl.querySelector('.materia-color-dot');
          if (colorEl) colorEl.style.background = updatedMat.color;
        }
      } else {
        // Si no existe el elemento, re-renderizar la lista completa
        renderMaterias();
      }
    } else if (data.type === 'delete' && data.materiaId) {
      // Eliminar materia del DOM
      const matEl = document.getElementById(`materia-${data.materiaId}`);
      if (matEl) matEl.remove();
    } else {
      // Para otros cambios, re-renderizar la lista completa
      renderMaterias();
    }
  });
}

