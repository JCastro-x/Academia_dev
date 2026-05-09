// ═══════════════════════════════════════════════════════════════
// TOPICS CORE — Gestión de temas, subtemas y progreso
// ═══════════════════════════════════════════════════════════════

// Navigation state for temas
let _temasNavStack = [];
let _currentTemasMatId = null;
let _currentTemasApartadoId = null;

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN DE TEMAS (3 Niveles)
// ═══════════════════════════════════════════════════════════════

// Initialize temas hub view
function renderTemasHub() {
  const sem = getActiveSem();
  if (!sem) return;
  
  const grid = document.getElementById('temas-hub-grid');
  if (!grid) return;
  
  const materias = State.materias.filter(m => !m.parentId);
  
  // Show "← General" button in hub view
  document.getElementById('temas-back-btn').style.display = 'none';
  document.getElementById('temas-back-general-btn').style.display = 'block';
  
  if (materias.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:32px;margin-bottom:10px;">📖</div>
      <div>No hay materias en este semestre. Agrega materias desde la sección Materias.</div>
    </div>`;
    return;
  }
  
  let html = '';
  materias.forEach(mat => {
    const topicCount = State.topics.filter(t => t.matId === mat.id).length;
    html += `<div class="temas-materia-card" onclick="openTemasMateria('${mat.id}')" style="cursor:pointer;border-left:4px solid ${mat.color};background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px;transition:all 0.2s ease;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);">${mat.icon || '📚'} ${mat.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:4px;">${mat.code || ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:24px;font-weight:800;color:${mat.color};">${topicCount}</div>
          <div style="font-size:10px;color:var(--text3);">temas</div>
        </div>
      </div>
    </div>`;
  });
  
  grid.innerHTML = html;
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
  grid.style.gap = '16px';
}

// Open materia view (show apartados)
function openTemasMateria(matId) {
  const mat = getMat(matId);
  if (!mat) return;
  
  _currentTemasMatId = matId;
  _temasNavStack.push({ level: 'hub' });
  
  // Update UI
  document.getElementById('temas-hub-view').style.display = 'none';
  document.getElementById('temas-materia-view').style.display = 'block';
  document.getElementById('temas-apartado-view').style.display = 'none';
  document.getElementById('temas-back-btn').style.display = 'block';
  document.getElementById('temas-back-general-btn').style.display = 'none';
  document.getElementById('temas-add-apartado-btn').style.display = 'block';
  document.getElementById('temas-add-topic-btn').style.display = 'none';
  document.getElementById('temas-page-title').textContent = `${mat.icon || '📚'} ${mat.name}`;
  
  renderTemasMateria(matId);
}

// Render apartados for a materia
function renderTemasMateria(matId) {
  const mat = getMat(matId);
  if (!mat) return;
  
  const grid = document.getElementById('temas-materia-grid');
  if (!grid) return;
  
  const apartados = mat.apartados || [];
  
  if (apartados.length === 0) {
    grid.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:32px;margin-bottom:10px;">📁</div>
      <div>No hay apartados. Esto no debería pasar - contacta soporte.</div>
    </div>`;
    return;
  }
  
  let html = '';
  apartados.sort((a, b) => (a.orden || 0) - (b.orden || 0)).forEach(ap => {
    const topicCount = State.topics.filter(t => t.matId === matId && (t.apartadoId === ap.id || t.parcial === ap.parcialKey)).length;
    const isManual = ap.tipo === 'manual';
    html += `<div class="temas-apartado-card" onclick="openTemasApartado('${matId}', '${ap.id}')" style="cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;transition:all 0.2s ease;${isManual ? 'border-left:4px solid #7c6aff;' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">${isManual ? '📁' : '📖'} ${ap.nombre}</div>
          ${isManual ? '<div style="font-size:10px;color:var(--accent);margin-top:4px;">Apartado manual</div>' : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:800;color:var(--text2);">${topicCount}</div>
          <div style="font-size:10px;color:var(--text3);">temas</div>
        </div>
      </div>
    </div>`;
  });
  
  grid.innerHTML = html;
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
  grid.style.gap = '14px';
}

// Open apartado view (show topics)
function openTemasApartado(matId, apartadoId) {
  const mat = getMat(matId);
  if (!mat) return;
  
  const apartado = mat.apartados?.find(a => a.id === apartadoId);
  if (!apartado) return;
  
  _currentTemasMatId = matId;
  _currentTemasApartadoId = apartadoId;
  _temasNavStack.push({ level: 'materia', matId });
  
  // Update UI
  document.getElementById('temas-hub-view').style.display = 'none';
  document.getElementById('temas-materia-view').style.display = 'none';
  document.getElementById('temas-apartado-view').style.display = 'block';
  document.getElementById('temas-back-btn').style.display = 'block';
  document.getElementById('temas-add-apartado-btn').style.display = 'none';
  document.getElementById('temas-add-topic-btn').style.display = 'block';
  document.getElementById('temas-page-title').textContent = `${apartado.tipo === 'manual' ? '📁' : '📖'} ${apartado.nombre}`;
  
  renderTemasApartado(matId, apartadoId);
}

// Render topics for an apartado
function renderTemasApartado(matId, apartadoId) {
  const mat = getMat(matId);
  if (!mat) return;
  
  const apartado = mat.apartados?.find(a => a.id === apartadoId);
  if (!apartado) return;
  
  // Filter topics for this apartado
  let matTopics;
  if (apartado.tipo === 'parcial') {
    matTopics = State.topics.filter(t => t.matId === matId && t.parcial === apartado.parcialKey);
  } else {
    matTopics = State.topics.filter(t => t.matId === matId && t.apartadoId === apartadoId);
  }
  
  const container = document.getElementById('topics-container');
  if (!container) return;
  
  const totalT = matTopics.length;
  const seenT = matTopics.filter(t => t.seen).length;
  const avgComp = totalT ? Math.round(matTopics.reduce((a, t) => a + t.comp, 0) / totalT) : 0;
  const needRev = matTopics.filter(t => t.comp < 70 && t.seen).length;
  
  // Stats header
  let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
    <div class="stat-mini"><div class="stat-mini-lbl">✅ TEMAS VISTOS</div><div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT ? seenT / totalT * 100 : 0}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">🧠 COMPRENSIÓN</div><div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">⚠️ REPASO</div><div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div><div style="font-size:11px;color:var(--text3);margin-top:4px;">&lt;70% comprensión</div></div>
  </div>`;
  
  // Topics list
  matTopics.forEach(t => {
    const subsHtml = t.subs.length
      ? `<div style="padding-left:28px;margin-top:4px;border-left:2px solid var(--border);margin-left:10px;">
          ${t.subs.map((s, i) => `
            <div class="topic-item" style="padding:6px 0;">
              <div class="topic-seen-btn ${s.seen ? 'seen' : ''}" onclick="toggleSubSeen('${t.id}',${i})"></div>
              <div style="flex:1;font-size:12px;color:${s.seen ? 'var(--text2)' : 'var(--text)'};">${s.name}</div>
              <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',${i})">
                <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${s.comp}%;background:${barColor(s.comp)};border-radius:3px;transition:width .3s;"></div></div>
                <span style="font-size:10px;font-family:'Space Mono',monospace;color:${barColor(s.comp)};width:30px;text-align:right;">${s.comp}%</span>
              </div>
            </div>`).join('')}
        </div>` : '';
    html += `<div>
      <div class="topic-item">
        <div class="topic-seen-btn ${t.seen ? 'seen' : ''}" onclick="toggleTopicSeen('${t.id}')"></div>
        <div style="flex:1;font-size:13.5px;font-weight:600;color:${t.seen ? 'var(--text2)' : 'var(--text)'};">${t.name}</div>
        <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',null)">
          <div style="width:90px;height:6px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${t.comp}%;background:${barColor(t.comp)};border-radius:4px;transition:width .3s;"></div></div>
          <span style="font-size:11px;font-family:'Space Mono',monospace;color:${barColor(t.comp)};width:34px;text-align:right;">${t.comp}%</span>
        </div>
        <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="deleteTopic('${t.id}')">✕</button>
      </div>
      ${subsHtml}
    </div>`;
  });
  
  if (matTopics.length === 0) {
    html += `<div style="text-align:center;padding:48px;color:var(--text3);">📖 Presiona "+ Agregar Tema" para comenzar</div>`;
  }
  
  container.innerHTML = html;
  
  // Trigger planner render
  if (typeof renderReviewQueue === 'function') renderReviewQueue();
}

// Go back in temas navigation
function temasGoBack() {
  if (_temasNavStack.length === 0) {
    // Go back to hub
    _currentTemasMatId = null;
    _currentTemasApartadoId = null;
    document.getElementById('temas-hub-view').style.display = 'block';
    document.getElementById('temas-materia-view').style.display = 'none';
    document.getElementById('temas-apartado-view').style.display = 'none';
    document.getElementById('temas-back-btn').style.display = 'none';
    document.getElementById('temas-back-general-btn').style.display = 'block';
    document.getElementById('temas-add-apartado-btn').style.display = 'none';
    document.getElementById('temas-add-topic-btn').style.display = 'none';
    document.getElementById('temas-page-title').textContent = '📖 Temas del Curso';
    renderTemasHub();
    return;
  }
  
  const prev = _temasNavStack.pop();
  
  if (prev.level === 'hub') {
    // Back to hub from materia
    _currentTemasMatId = null;
    _currentTemasApartadoId = null;
    document.getElementById('temas-hub-view').style.display = 'block';
    document.getElementById('temas-materia-view').style.display = 'none';
    document.getElementById('temas-apartado-view').style.display = 'none';
    document.getElementById('temas-back-btn').style.display = 'none';
    document.getElementById('temas-back-general-btn').style.display = 'block';
    document.getElementById('temas-add-apartado-btn').style.display = 'none';
    document.getElementById('temas-add-topic-btn').style.display = 'none';
    document.getElementById('temas-page-title').textContent = '📖 Temas del Curso';
    renderTemasHub();
  } else if (prev.level === 'materia') {
    // Back to materia from apartado
    _currentTemasApartadoId = null;
    document.getElementById('temas-hub-view').style.display = 'none';
    document.getElementById('temas-materia-view').style.display = 'block';
    document.getElementById('temas-apartado-view').style.display = 'none';
    document.getElementById('temas-back-btn').style.display = 'block';
    document.getElementById('temas-back-general-btn').style.display = 'none';
    document.getElementById('temas-add-apartado-btn').style.display = 'block';
    document.getElementById('temas-add-topic-btn').style.display = 'none';
    const mat = getMat(prev.matId);
    document.getElementById('temas-page-title').textContent = mat ? `${mat.icon || '📚'} ${mat.name}` : 'Materia';
    renderTemasMateria(prev.matId);
  }
}

let compTarget = null;

// ═══════════════════════════════════════════════════════════════
// CRUD DE TEMAS
// ═══════════════════════════════════════════════════════════════

function openTopicModal() {
  fillMatSels();
  
  // Set up change listener on materia selector to update apartados
  const matSel = document.getElementById('tp-mat');
  if (matSel) {
    matSel.onchange = function() {
      const selectedMatId = this.value;
      if (selectedMatId) {
        fillApartadoSel(selectedMatId);
      } else {
        // Clear apartado selector when no materia selected
        const apartadoSel = document.getElementById('tp-apartado');
        if (apartadoSel) {
          apartadoSel.innerHTML = '<option value="">Selecciona una materia primero</option>';
          apartadoSel.disabled = true;
        }
      }
    };
  }
  
  // Pre-select current materia if in temas view
  if (_currentTemasMatId) {
    if (matSel) matSel.value = _currentTemasMatId;
    fillApartadoSel(_currentTemasMatId);
    // Pre-select current apartado if in apartado view
    if (_currentTemasApartadoId) {
      const apartadoSel = document.getElementById('tp-apartado');
      if (apartadoSel) apartadoSel.value = _currentTemasApartadoId;
    }
  } else {
    // No pre-selected materia, clear apartado selector
    const apartadoSel = document.getElementById('tp-apartado');
    if (apartadoSel) {
      apartadoSel.innerHTML = '<option value="">Selecciona una materia primero</option>';
      apartadoSel.disabled = true;
    }
  }
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value = '';
  document.getElementById('modal-topic').classList.add('open');
}

// Fill apartado selector based on selected materia
function fillApartadoSel(matId) {
  const sel = document.getElementById('tp-apartado');
  if (!sel) return;
  
  if (!matId) {
    matId = document.getElementById('tp-mat')?.value;
  }
  
  if (!matId) {
    sel.innerHTML = '<option value="">Selecciona una materia primero</option>';
    sel.disabled = true;
    return;
  }
  
  const mat = getMat(matId);
  if (!mat || !mat.apartados) {
    sel.innerHTML = '<option value="">Sin apartados</option>';
    sel.disabled = true;
    return;
  }
  
  sel.disabled = false;
  sel.innerHTML = mat.apartados.sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(ap => 
    `<option value="${ap.id}">${ap.nombre}</option>`
  ).join('');
}

// Open apartado modal to create manual section
function openApartadoModal() {
  if (!_currentTemasMatId) {
    if (typeof _appNotify === 'function') _appNotify('Selecciona una materia primero', 'warning');
    return;
  }
  document.getElementById('apartado-name').value = '';
  document.getElementById('modal-apartado').classList.add('open');
}

// Save new manual apartado
function saveApartado() {
  if (!_currentTemasMatId) return;
  
  const nombre = document.getElementById('apartado-name').value.trim();
  if (!nombre) {
    if (typeof _appNotify === 'function') _appNotify('Ingresa un nombre para el apartado', 'warning');
    return;
  }
  
  const mat = getMat(_currentTemasMatId);
  if (!mat) return;
  
  if (!mat.apartados) mat.apartados = [];
  
  const maxOrden = Math.max(...mat.apartados.map(a => a.orden || 0), 0);
  
  mat.apartados.push({
    id: generateUUID(),
    nombre: nombre,
    tipo: 'manual',
    orden: maxOrden + 1
  });
  
  saveState(['materias']);
  closeModal('modal-apartado');
  renderTemasMateria(_currentTemasMatId);
  
  if (typeof _appNotify === 'function') _appNotify('Apartado creado exitosamente', 'ok');
}

function saveTopic() {
  const name = document.getElementById('tp-name').value.trim(); if (!name) return;
  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs = subsRaw ? subsRaw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({name:s,seen:false,comp:0})) : [];
  
  const matId = document.getElementById('tp-mat').value;
  const apartadoId = document.getElementById('tp-apartado')?.value;
  
  if (!matId || !apartadoId) {
    if (typeof _appNotify === 'function') _appNotify('Selecciona materia y apartado', 'warning');
    return;
  }
  
  const mat = getMat(matId);
  const apartado = mat?.apartados?.find(a => a.id === apartadoId);
  
  const newTopic = {
    id: generateUUID(),
    matId: matId,
    apartadoId: apartadoId,
    name, seen: false, comp: 0, subs
  };
  
  // For backward compatibility, also set parcial if it's a parcial apartado
  if (apartado && apartado.tipo === 'parcial') {
    newTopic.parcial = apartado.parcialKey;
  }
  
  State.topics.push(newTopic);
  saveState(['topics']);
  closeModal('modal-topic');
  window.dispatchEvent(new CustomEvent('topic:created', { detail: { name } }));
  
  // Refresh current view if in temas
  if (_currentTemasMatId === matId) {
    if (_currentTemasApartadoId === apartadoId) {
      renderTemasApartado(matId, apartadoId);
    } else {
      renderTemasMateria(matId);
    }
  }
}

async function deleteTopic(id) {
  const topic = State.topics.find(t => t.id === id);
  if (!topic) return;
  const confirmed = await showConfirm(`¿Eliminar el tema "${topic.name}"?`, { danger: true });
  if (!confirmed) return;
  const deletedTopic = { ...topic };
  State.topics = State.topics.filter(t=>t.id!==id);
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:deleted', { detail: { id, name: deletedTopic.name } }));
  if (typeof showUndoToast === 'function') {
    showUndoToast(`Tema "${topic.name}" eliminado`, () => {
      State.topics.push(deletedTopic);
      saveState(['topics']);
      window.dispatchEvent(new CustomEvent('topic:created', { detail: { name: deletedTopic.name } }));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// PROGRESO DE TEMAS
// ═══════════════════════════════════════════════════════════════

function toggleTopicSeen(id) {
  const t = State.topics.find(x=>x.id===id); if (!t) return;
  t.seen = !t.seen;
  if (t.seen && t.comp===0) t.comp=100;
  if (!t.seen) t.comp=0;
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { id, seen: t.seen, comp: t.comp } }));
}

function toggleSubSeen(tid,idx) {
  const t = State.topics.find(x=>x.id===tid); if (!t?.subs?.[idx]) return;
  t.subs[idx].seen = !t.subs[idx].seen;
  if (t.subs[idx].seen && t.subs[idx].comp===0) t.subs[idx].comp=100;
  if (!t.subs[idx].seen) t.subs[idx].comp=0;
  saveState(['topics']);
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { tid, idx, seen: t.subs[idx].seen } }));
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
  saveState(['topics']);
  closeCompPopup();
  window.dispatchEvent(new CustomEvent('topic:progress', { detail: { id: compTarget.topicId, comp: val } }));
}

function closeCompPopup() { const p=document.getElementById('comp-popup'); if(p) p.style.display='none'; compTarget=null; }

// ═══════════════════════════════════════════════════════════════
// RENDERIZADO DE TEMAS
// ═══════════════════════════════════════════════════════════════

if (typeof window.renderTopics !== 'function') {
  window.renderTopics = function() {
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
  };
}

// ═══════════════════════════════════════════════════════════════
// LISTENERS DE CUSTOM EVENTS
// ═══════════════════════════════════════════════════════════════
window.addEventListener('topic:created', () => { 
  if (_currentTemasMatId) {
    if (_currentTemasApartadoId) {
      renderTemasApartado(_currentTemasMatId, _currentTemasApartadoId);
    } else {
      renderTemasMateria(_currentTemasMatId);
    }
  } else {
    renderTemasHub();
  }
});
window.addEventListener('topic:deleted', () => { 
  if (_currentTemasMatId) {
    if (_currentTemasApartadoId) {
      renderTemasApartado(_currentTemasMatId, _currentTemasApartadoId);
    } else {
      renderTemasMateria(_currentTemasMatId);
    }
  } else {
    renderTemasHub();
  }
});
window.addEventListener('topic:progress', () => { 
  if (_currentTemasMatId) {
    if (_currentTemasApartadoId) {
      renderTemasApartado(_currentTemasMatId, _currentTemasApartadoId);
    } else {
      renderTemasMateria(_currentTemasMatId);
    }
  } else {
    renderTemasHub();
  }
  renderGeneralHub(); 
});
window.addEventListener('subject:switched', () => {
  _currentTemasMatId = null;
  _currentTemasApartadoId = null;
  _temasNavStack = [];
  renderTemasHub();
});

// Event delegation for tp-mat change to update tp-apartado selector
document.addEventListener('change', (e) => {
  if (e.target.id === 'tp-mat' && typeof fillApartadoSel === 'function') {
    fillApartadoSel(e.target.value);
  }
});

// Initialize temas hub when temas page is loaded
document.addEventListener('partial-loaded', (e) => {
  if (e.detail && e.detail.name === 'temas') {
    setTimeout(() => {
      renderTemasHub();
    }, 100);
  }
});

// Also render when navigating to temas page
window.addEventListener('page-change', (e) => {
  if (e.detail && e.detail.pageId === 'temas') {
    setTimeout(() => {
      renderTemasHub();
    }, 50);
  }
});

// Also render when subject is created
window.addEventListener('subject:created', () => {
  if (_currentTemasMatId === null) {
    renderTemasHub();
  }
});

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.openTopicModal  = openTopicModal;
window.saveTopic       = saveTopic;
window.deleteTopic     = deleteTopic;
window.toggleTopicSeen = toggleTopicSeen;
window.toggleSubSeen   = toggleSubSeen;
window.openCompPopup   = openCompPopup;
window.applyComp       = applyComp;
window.closeCompPopup  = closeCompPopup;
window.renderTemasHub  = renderTemasHub;
window.openTemasMateria = openTemasMateria;
window.renderTemasMateria = renderTemasMateria;
window.openTemasApartado = openTemasApartado;
window.renderTemasApartado = renderTemasApartado;
window.temasGoBack     = temasGoBack;
window.fillApartadoSel = fillApartadoSel;
window.openApartadoModal = openApartadoModal;
window.saveApartado    = saveApartado;
