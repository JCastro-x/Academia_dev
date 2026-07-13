// XSS Protection - DOMPurify Helper
function sanitizeHtml(dirty, isRteContent = false) {
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify not loaded, returning unsanitized content');
    return dirty;
  }
  const config = isRteContent ? {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'img', 'blockquote', 'pre', 'code'],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'title', 'style', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'object', 'iframe', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['on*', 'javascript:', 'data:', 'vbscript:'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
  } : {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'style', 'object', 'iframe', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['on*', 'javascript:', 'data:', 'vbscript:'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
  };
  return DOMPurify.sanitize(dirty, config);
}

function handleImportFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = importData(e.target.result);
    if (typeof _appNotify === 'function') _appNotify(result.msg, result.success ? 'ok' : 'error');
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
  if (suma !== 100) { if (typeof _appNotify === 'function') _appNotify(`La suma debe ser exactamente 100 pts (actualmente ${suma}). Ajusta los valores.`, 'warning'); return; }

  // Si estamos editando una clase, NO borrar las zonas ya existentes — solo agregar las nuevas.
  // Si estamos creando, limpiar y empezar de cero
  if (!window._editClassMatId) {
    document.getElementById('zones-builder').innerHTML = '';
    zoneRowCount = 0;
  }

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
  // Guard: verificar que State.materias exista
  if (!State.materias || !Array.isArray(State.materias)) {
    console.warn('[renderHorario] State.materias no está disponible aún');
    return;
  }
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
    [...new Set(m.dias.split(/[,\s]+/))].forEach(d => {
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
      [...new Set(m.dias.split(/[,\s]+/))].forEach(d => {
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
        html += `<td onclick="goPage('materias')" style="cursor:pointer;"><div class="horario-cell" style="border-left-color:${m.color};background:${m.color}18;">
          <div style="font-size:10px;font-weight:800;color:${m.color};">${m.icon||'📚'} ${m.name}</div>
          ${m.catedratico ? `<div style="font-size:9px;color:var(--text3);">👤 ${m.catedratico}</div>` : ''}
          ${m.seccion ? `<div style="font-size:9px;color:var(--text3);">Sec. ${m.seccion}</div>` : ''}
        </div></td>`;
      } else {

        html += `<td onclick="goPage('materias')" style="cursor:pointer;"><div style="display:flex;gap:4px;">`;
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
  if (!container || !container.innerHTML.trim()) { if (typeof _appNotify === 'function') _appNotify('Sin horario para exportar.', 'warning'); return; }
  const win = window.open('','_blank','width=900,height=700');
  const semName = document.querySelector('.sem-val')?.textContent || 'Mi Horario';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Horario</title>
  <style>body{font-family:sans-serif;background:#0a0a0f;color:#e8e8f0;padding:20px;}h2{color:#a892ff;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;}th{background:#18181f;border:1px solid #2a2a38;padding:10px 12px;font-size:11px;color:#9090a8;text-align:center;}
  td{border:1px solid #2a2a38;padding:8px;font-size:11px;min-width:100px;vertical-align:top;background:#111118;}
  .horario-cell{border-radius:7px;padding:6px 8px;font-size:11px;font-weight:700;border-left:3px solid #7c6aff;background:rgba(124,106,255,.12);}
  @media print{body{background:#fff;color:#000;}}</style></head>
  <body><h2>🗓️ ${semName}</h2>${container.innerHTML}
  <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  win.document.close();
}

function renderNotesPage() {
  _notesInHub = true; // siempre empezar en el hub al entrar
  renderNotesProPage();
}

let _examInterval = null, _examRunning = false, _examSecs = 90*60;
let _examNotes = '';
let _examImages = [];
let _examPDFs = [];

// Cargar notas del examen desde localStorage al iniciar
_examNotes = localStorage.getItem('exam_notes') || '';
try {
  _examImages = JSON.parse(localStorage.getItem('exam_images') || '[]');
} catch {
  _examImages = [];
}
try {
  _examPDFs = JSON.parse(localStorage.getItem('exam_pdfs') || '[]');
} catch {
  _examPDFs = [];
}

function openExamMode() {
  fillExamSel();
  examReset();
  updateExamSubjectLabel();
  loadExamNotes();
  document.getElementById('exam-overlay').classList.add('active');
  // Setup paste event for images
  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {
    notesEl.addEventListener('paste', handleExamPaste);
  }
}
function closeExamMode() {
  examStop();
  saveExamNotes();
  document.getElementById('exam-overlay').classList.remove('active');
  // Remove paste event listener
  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {
    notesEl.removeEventListener('paste', handleExamPaste);
  }
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

  // NO cargar notas automáticamente - solo mostrar la etiqueta de materia
  // Las notas del examen son independientes de las notas de la materia
}
function loadExamNotes() {
  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {
    notesEl.value = _examNotes;
    autoResizeTextarea(notesEl);
  }
  renderExamImages();
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 500) + 'px';
}
function saveExamNotes() {
  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {
    _examNotes = notesEl.value;
    // Guardar en localStorage
    localStorage.setItem('exam_notes', _examNotes);
    localStorage.setItem('exam_images', JSON.stringify(_examImages));
    localStorage.setItem('exam_pdfs', JSON.stringify(_examPDFs));
  }
}
function handleExamPaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const imageData = event.target.result;
          _examImages.push(imageData);
          renderExamImages();
          saveExamNotes();
        };
        reader.readAsDataURL(file);
      }
      break;
    } else if (item.type === 'application/pdf') {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const pdfData = event.target.result;
          _examPDFs.push({
            name: file.name || 'PDF',
            data: pdfData
          });
          renderExamImages();
          saveExamNotes();
        };
        reader.readAsDataURL(file);
      }
      break;
    }
  }
}

function handleExamImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const imageData = event.target.result;
    _examImages.push(imageData);
    renderExamImages();
    saveExamNotes();
  };
  reader.readAsDataURL(file);
  input.value = ''; // Reset input
}

function handleExamPDFUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const pdfData = event.target.result;
    _examPDFs.push({
      name: file.name || 'PDF',
      data: pdfData
    });
    renderExamImages();
    saveExamNotes();
  };
  reader.readAsDataURL(file);
  input.value = ''; // Reset input
}
function renderExamImages() {
  const container = document.getElementById('exam-images-container');
  const section = document.getElementById('exam-attachments-section');
  if (!container || !section) return;

  const hasAttachments = _examImages.length > 0 || _examPDFs.length > 0;
  const notesEl = document.getElementById('exam-notes-display');
  const hasNotes = notesEl && notesEl.value.trim().length > 0;

  // Solo mostrar sección si hay adjuntos O hay notas escritas
  if (!hasAttachments && !hasNotes) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  
  let html = '';
  
  // Render images
  html += _examImages.map((img, idx) => `
    <div style="position:relative;">
      <img src="${img}" style="max-width:150px;max-height:150px;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="openExamImagePopup(${idx})">
      <button onclick="removeExamImage(${idx})" style="position:absolute;top:-8px;right:-8px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;font-weight:700;">✕</button>
    </div>
  `).join('');
  
  // Render PDFs
  html += _examPDFs.map((pdf, idx) => `
    <div style="position:relative;">
      <div onclick="openExamPDFPopup(${idx})" style="max-width:150px;padding:20px;border-radius:8px;border:1px solid var(--border);cursor:pointer;background:var(--surface);text-align:center;">
        <div style="font-size:32px;">📄</div>
        <div style="font-size:11px;color:var(--text2);margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pdf.name}</div>
      </div>
      <button onclick="removeExamPDF(${idx})" style="position:absolute;top:-8px;right:-8px;background:var(--red);color:#fff;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;font-weight:700;">✕</button>
    </div>
  `).join('');
  
  container.innerHTML = html;
}
function removeExamImage(idx) {
  _examImages.splice(idx, 1);
  renderExamImages();
  saveExamNotes();
}
function removeExamPDF(idx) {
  _examPDFs.splice(idx, 1);
  renderExamImages();
  saveExamNotes();
}
function openExamPDFPopup(idx) {
  const pdf = _examPDFs[idx];
  if (!pdf) return;
  
  // Usar el modal de PDF existente
  openPDFModal(pdf.data, pdf.name);
}

// Función para abrir PDF en el modal
let _currentPDFDoc = null;
let _currentPDFPage = 1;
let _currentPDFTotalPages = 1;

function openPDFModal(pdfData, pdfName) {
  const modal = document.getElementById('modal-pdf-view');
  const nameEl = document.getElementById('pdf-modal-name');
  const container = document.getElementById('pdf-canvas-container');
  const nav = document.getElementById('pdf-page-nav');
  
  if (!modal || !container) return;
  
  nameEl.textContent = pdfName || 'PDF';
  modal.style.display = 'flex';
  
  // Limpiar contenedor anterior
  container.innerHTML = '';
  
  // Cargar PDF usando PDF.js
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    // Convertir base64 a array buffer
    const base64Data = pdfData.split(',')[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    pdfjsLib.getDocument({ data: bytes }).promise.then(pdf => {
      _currentPDFDoc = pdf;
      _currentPDFTotalPages = pdf.numPages;
      _currentPDFPage = 1;
      
      // Mostrar navegación si hay más de 1 página
      if (pdf.numPages > 1) {
        nav.style.display = 'flex';
        document.getElementById('pdf-page-current').textContent = '1';
        document.getElementById('pdf-page-total').textContent = pdf.numPages;
      } else {
        nav.style.display = 'none';
      }
      
      renderPDFPage(1);
    }).catch(err => {
      console.error('Error cargando PDF:', err);
      container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px;">Error al cargar PDF</div>';
    });
  } else {
    // Fallback: usar iframe
    container.innerHTML = `<iframe src="${pdfData}" style="width:100%;height:100%;border:none;"></iframe>`;
    nav.style.display = 'none';
  }
}

function renderPDFPage(pageNum) {
  if (!_currentPDFDoc) return;
  
  _currentPDFDoc.getPage(pageNum).then(page => {
    const canvas = document.createElement('canvas');
    const container = document.getElementById('pdf-canvas-container');
    container.innerHTML = '';
    container.appendChild(canvas);
    
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    page.render(renderContext);
  });
}

function pdfPrevPage() {
  if (_currentPDFPage > 1) {
    _currentPDFPage--;
    document.getElementById('pdf-page-current').textContent = _currentPDFPage;
    renderPDFPage(_currentPDFPage);
  }
}

function pdfNextPage() {
  if (_currentPDFPage < _currentPDFTotalPages) {
    _currentPDFPage++;
    document.getElementById('pdf-page-current').textContent = _currentPDFPage;
    renderPDFPage(_currentPDFPage);
  }
}

function closePDFModal() {
  const modal = document.getElementById('modal-pdf-view');
  if (modal) modal.style.display = 'none';
  _currentPDFDoc = null;
}
function openExamImagePopup(idx) {
  const img = _examImages[idx];
  if (!img) return;
  
  // Crear modal simple para ver imagen
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <img src="${img}" style="max-width:100%;max-height:100%;object-fit:contain;">
    <button onclick="this.parentElement.remove()" style="position:absolute;top:20px;right:20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px;font-weight:700;">✕ Cerrar</button>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

// NOTES V2 — Folders + Canvas + Big Images + Bug fixes

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
let _notesInHub = true; // true = mostrar grid de carpetas; false = mostrar editor

// RENDER FULL PAGE
function renderNotesProPage() {
  _populateEditorSelects();
  // Always start at hub level unless we're inside a folder
  if (_notesInHub || !_currentFolderId) {
    _notesInHub = true;
    _showNotesHubView();
  } else {
    _showNotesFolderView(_currentFolderId);
  }
}

function _showNotesHub() { _showNotesHubView(); }
function _showNotesEditor() {
  // Legacy compat — now opens the modal approach
  // Do nothing here; modal is opened by selectProNote
}

function _showNotesHubView() {
  const hub    = document.getElementById('notes-hub-view');
  const folView= document.getElementById('notes-folder-view');
  const back   = document.getElementById('notes-back-btn');
  const title  = document.getElementById('notes-page-title');
  if (hub)    hub.style.display    = 'block';
  if (folView) folView.style.display = 'none';
  if (back)   back.style.display   = 'none';
  if (title)  title.textContent    = '📝 Bloc de Notas';
  _renderNotesHub();
}

function _showNotesFolderView(folderId) {
  const hub    = document.getElementById('notes-hub-view');
  const folView= document.getElementById('notes-folder-view');
  const back   = document.getElementById('notes-back-btn');
  const title  = document.getElementById('notes-page-title');
  if (hub)    hub.style.display    = 'none';
  if (folView) folView.style.display = 'block';
  if (back)   back.style.display   = '';
  // Set title
  if (title) {
    if (folderId === null) {
      title.textContent = '📋 Todas las notas';
    } else if (String(folderId).startsWith('mat_')) {
      const matId = folderId.replace('mat_', '');
      const mat   = State.materias.find(m => m.id === matId);
      title.textContent = (mat ? (mat.icon||'📚') + ' ' + mat.name : '📁 Carpeta');
    } else {
      const f = _getFoldersArray().find(f => f.id === folderId);
      title.textContent = f ? (f.icon||'📁') + ' ' + f.name : '📁 Carpeta';
    }
  }
  _renderNotesFolderGrid(folderId);
}

function _renderNotesHub() {
  const grid = document.getElementById('notes-hub-grid');
  if (!grid) return;
  const allNotes = _getNotesArray();
  const folders  = _getFoldersArray();

  const _countBadge = (n) => `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${n} nota${n!==1?'s':''}</span>`;

  //let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;">`;
let html = '<div class="smart-grid">'
  // Todas las notas
  html += _notesHubCard('null', '📋', 'Todas las notas', allNotes.length, 'var(--accent)', null, false, null);

  // Carpetas manuales
  folders.filter(f => !f.parentId).forEach(f => {
    const n = allNotes.filter(x => x.folderId === f.id).length;
    html += _notesHubCard(`'${f.id}'`, f.icon||'📁', sanitizeHtml(f.name), n, f.color||'var(--accent)', null, true, f.id);
  });

  // Materias
  State.materias.filter(m => !m.parentId).forEach(m => {
    const n = allNotes.filter(x => x.matId === m.id || x.folderId === 'mat_' + m.id).length;
    html += _notesHubCard(`'mat_${m.id}'`, m.icon||'📚', sanitizeHtml(m.name), n, m.color||'var(--accent)', m.code||null, false, null);
  });

  html += `</div>`;
  grid.innerHTML = html;
}

function _notesHubCard(folderIdStr, icon, name, count, color, subtitle, isManualFolder, folderId) {
  const actionBtns = isManualFolder ? `
    <div class="hub-card-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;pointer-events:none;transition:opacity .15s;z-index:10;">
      <button onclick="event.stopPropagation();openNewFolderModal('${folderId}')"
        style="background:rgba(0,0,0,.45);border:none;border-radius:6px;color:var(--text2);cursor:pointer;font-size:12px;padding:3px 6px;line-height:1;"
        title="Editar carpeta">✎</button>
      <button onclick="event.stopPropagation();deleteNotesFolder('${folderId}')"
        style="background:rgba(248,113,113,.25);border:none;border-radius:6px;color:#f87171;cursor:pointer;font-size:12px;padding:3px 6px;line-height:1;"
        title="Eliminar carpeta">✕</button>
    </div>` : '';
  return `<div class="card" id="folder-${folderId}" onclick="if(event.target.closest('button'))return;_openNotesFolder(${folderIdStr})"
    style="cursor:pointer;background:var(--surface2);border:1.5px solid var(--border);position:relative;
      border-top:3px solid ${color};border-radius:14px;padding:20px 16px 18px;
      transition:transform .15s,box-shadow .15s,border-color .15s;
      display:flex;flex-direction:column;gap:10px;min-height:120px;"
    onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 10px 28px rgba(0,0,0,.3)';this.style.borderColor='${color}';${isManualFolder?"var _a=this.querySelector('.hub-card-actions');if(_a){_a.style.opacity='1';_a.style.pointerEvents='auto';}":''}"
    onmouseout="if(this.contains(event.relatedTarget))return;this.style.transform='';this.style.boxShadow='';this.style.borderColor='var(--border)';this.style.borderTopColor='${color}';${isManualFolder?"var _a=this.querySelector('.hub-card-actions');if(_a){_a.style.opacity='0';_a.style.pointerEvents='none';}":""}">
    ${actionBtns}
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:28px;line-height:1;flex-shrink:0;">${icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:800;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${sanitizeHtml(name)}</div>
        ${subtitle ? `<div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:1px;">${sanitizeHtml(subtitle)}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:auto;font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">
      📄 ${count} nota${count!==1?'s':''}
    </div>
  </div>`;
}

function _renderNotesFolderGrid(folderId) {
  const grid = document.getElementById('notes-folder-grid');
  if (!grid) return;
  
  let notes = _getNotesArray();
  const folders = _getFoldersArray();

  if (folderId !== null) {
    if (String(folderId).startsWith('mat_')) {
      const matId = folderId.replace('mat_','');
      notes = notes.filter(n => n.matId === matId);
    } else {
      notes = notes.filter(n => n.folderId === folderId);
    }
  }

  // Filter subfolders with matching parentId
  let subfolders = [];
  if (folderId !== null) {
    subfolders = folders.filter(f => f.parentId === folderId);
  }

  const sorted = [...notes].sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

  if (!sorted.length && !subfolders.length) {
    grid.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text3);">
      <div style="font-size:40px;margin-bottom:12px;">📝</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Sin notas aún</div>
      <button class="btn btn-primary btn-sm" onclick="_notesNewNote()">+ Nueva nota</button>
    </div>`;
    return;
  }

  let html = '<div class="smart-grid">';
  
  // Render subfolders first
  subfolders.forEach(f => {
    const n = notes.filter(x => x.folderId === f.id).length;
    html += _notesHubCard(`'${f.id}'`, f.icon||'📁', sanitizeHtml(f.name), n, f.color||'var(--accent)', null, true, f.id);
  });
  
  // Then render notes
  sorted.forEach(note => {
    const mat     = note.matId ? State.materias.find(m => m.id === note.matId) : null;
    const isDraw  = note.type === 'draw';
    const preview = isDraw
      ? null
      : (note.rteContent || note.content || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,120);
    const dateStr = note.updatedAt
      ? new Date(note.updatedAt).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'})
      : '';
    const color   = mat ? mat.color : 'var(--accent2)';
    html += `<div class="card" onclick="selectProNote('${note.id}')"
      style="cursor:pointer;background:var(--surface2);border:1.5px solid var(--border);
        border-radius:14px;padding:16px 14px 14px;
        transition:transform .15s,box-shadow .15s,border-color .15s;
        display:flex;flex-direction:column;gap:8px;min-height:130px;"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.3)';this.style.borderColor='${color}';"
      onmouseout="this.style.transform='';this.style.boxShadow='';this.style.borderColor='var(--border)';">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">
        <div style="font-size:13px;font-weight:800;line-height:1.3;flex:1;min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${isDraw?'🎨 ':''}${sanitizeHtml(note.title)||'Sin título'}</div>
        ${mat?`<div style="width:8px;height:8px;border-radius:50%;background:${mat.color};flex-shrink:0;margin-top:4px;"></div>`:''}
      </div>
      ${isDraw && note.canvasData
        ? `<img src="" data-canvas-key="${note.canvasData.startsWith('IDB:') ? note.canvasData.replace('IDB:', '') : ''}" data-canvas-legacy="${!note.canvasData.startsWith('IDB:') ? note.canvasData : ''}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);" class="lazy-canvas">`
        : preview
          ? `<div style="font-size:11px;color:var(--text3);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${sanitizeHtml(preview)}</div>`
          : `<div style="font-size:11px;color:var(--text3);">Sin contenido</div>`
      }
      <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:5px;">
        ${mat?`<span style="font-size:9px;font-weight:700;color:${mat.color};font-family:'Space Mono',monospace;">${mat.icon||''} ${sanitizeHtml(mat.name)}</span>`:'<span></span>'}
        <span style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">${dateStr}</span>
      </div>
    </div>`;
  });
  html += `</div>`;
  grid.innerHTML = html;

  // Lazy load canvas images con Intersection Observer
  const canvasObserver = new IntersectionObserver((entries) => {
    entries.forEach(async entry => {
      if (entry.isIntersecting) {
        const imgEl = entry.target;
        const canvasKey = imgEl.dataset.canvasKey;
        const legacyData = imgEl.dataset.canvasLegacy;

        if (canvasKey) {
          const data = await idbGetImage(canvasKey);
          if (data) {
            // Asignar data URL directamente al src (no necesita fetch, evita violación CSP)
            imgEl.src = data;
          } else {
            // Fallback visual si la imagen no existe
            imgEl.classList.add('img-error-placeholder');
            imgEl.alt = 'Imagen no disponible';
            imgEl.style.background = 'var(--surface3)';
            imgEl.style.display = 'flex';
            imgEl.style.alignItems = 'center';
            imgEl.style.justifyContent = 'center';
            imgEl.innerHTML = '<span style="font-size:24px;">⚠️</span>';
          }
        } else if (legacyData) {
          imgEl.src = legacyData;
        }

        canvasObserver.unobserve(imgEl);
      }
    });
  }, { rootMargin: '50px' });

  document.querySelectorAll('.lazy-canvas').forEach(img => {
    canvasObserver.observe(img);
  });
}


function _openNotesFolder(folderId) {
  _notesInHub = false;
  _currentFolderId = folderId;
  _currentNoteId = null;
  _populateEditorSelects();
  _showNotesFolderView(folderId);
}

function _notesGoBack() {
  _notesInHub = true;
  _currentFolderId = null;
  _currentNoteId = null;
  _showNotesHubView();
}

function _notesNewNote() {
  if (_notesInHub) { _notesInHub = false; _currentFolderId = null; }
  _populateEditorSelects();
  addNewNote();
  openNoteEditorModal();
}

function _notesNewDrawing() {
  if (_notesInHub) { _notesInHub = false; _currentFolderId = null; }
  _populateEditorSelects();
  addNewDrawingNote();
  openNoteEditorModal();
}

function openNoteEditorModal() {
  const backdrop = document.getElementById('note-editor-backdrop');
  const modal    = document.getElementById('note-editor-modal');
  if (!backdrop || !modal) return;
  backdrop.style.display = 'block';
  modal.style.display    = 'flex';
  requestAnimationFrame(() => {
    modal.style.opacity   = '1';
    modal.style.transform = 'translate(-50%,-50%) scale(1)';
  });
}

function closeNoteEditorModal() {
  const backdrop = document.getElementById('note-editor-backdrop');
  const modal    = document.getElementById('note-editor-modal');
  if (!backdrop || !modal) return;
  modal.style.opacity   = '0';
  modal.style.transform = 'translate(-50%,-50%) scale(.96)';
  
  // Cleanup object URLs para evitar fugas de memoria
  document.querySelectorAll('[data-object-url]').forEach(img => {
    const objectUrl = img.dataset.objectUrl;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      delete img.dataset.objectUrl;
    }
  });
  
  setTimeout(() => {
    modal.style.display    = 'none';
    backdrop.style.display = 'none';
  }, 220);
  // Only refresh data, not re-mount the view
  if (_notesInHub) {
    _renderNotesHub();
  } else {
    _renderNotesFolderGrid(_currentFolderId);
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
  if (_notesInHub) { _renderNotesHub(); return; }
  const container = document.getElementById('notes-folders-list');
  if (!container) return;
  const folders = _getFoldersArray();
  const notes   = _getNotesArray();

  // Count per folder (including notes in subfolders)
  const countAll = notes.length;
  const countFolder = fid => notes.filter(n => n.folderId === fid).length;

  let html = `<div style="padding:5px 6px 3px;">
    <button onclick="_notesInHub=true;renderNotesProPage();" style="width:100%;text-align:left;background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:4px 6px;border-radius:6px;font-family:inherit;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text3)'">← Carpetas</button>
  </div>
  <div class="notes-folder-item ${_currentFolderId===null?'active':''}" onclick="selectFolder(null)">
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
  // Si estamos en el hub, salir al editor
  if (_notesInHub) {
    _notesInHub = false;
    _showNotesEditor();
    _populateEditorSelects();
  }
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
  // Si no se pasa parentId explícito, usar el contexto actual
  _newFolderParentId = parentId !== undefined ? parentId : null;
  _selectedFolderIcon  = '📁';
  _selectedFolderColor = '#6366f1';
  document.getElementById('new-folder-name').value = '';
  
  // Determinar título basado en contexto
  let modalTitle = '📁 Nueva Carpeta';
  if (folderId) {
    modalTitle = '✏️ Editar Carpeta';
  } else if (_newFolderParentId) {
    modalTitle = String(_newFolderParentId).startsWith('mat_') ? '📁 Carpeta en Materia' : '📁 Nueva Subcarpeta';
  } else if (_currentFolderId) {
    modalTitle = String(_currentFolderId).startsWith('mat_') ? '📁 Carpeta en Materia' : '📁 Nueva Subcarpeta';
  }
  
  document.getElementById('new-folder-modal-title').textContent = modalTitle;
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
  
  // Determinar contextType y parentId basado en el contexto actual
  let contextType = 'root';
  let parentId = null;
  
  // Prioridad 1: Si estamos dentro de una carpeta
  if (_currentFolderId && !String(_currentFolderId).startsWith('mat_')) {
    parentId = _currentFolderId;
    contextType = 'subfolder';
  }
  // Prioridad 2: Si estamos dentro de una materia (mat_ prefix)
  else if (_currentFolderId && String(_currentFolderId).startsWith('mat_')) {
    parentId = _currentFolderId;
    contextType = 'subject';
  }
  // Prioridad 3: Si se pasó un parentId explícito (desde openNewFolderModal)
  else if (_newFolderParentId) {
    parentId = _newFolderParentId;
    contextType = String(_newFolderParentId).startsWith('mat_') ? 'subject' : 'subfolder';
  }
  // Default: raíz
  else {
    parentId = null;
    contextType = 'root';
  }
  
  if (_editingFolderId) {
    const f = folders.find(x => x.id === _editingFolderId);
    if (f) { 
      f.name = name; 
      f.icon = _selectedFolderIcon; 
      f.color = _selectedFolderColor;
      f.parentId = parentId;
      f.contextType = contextType;
    }
  } else {
    folders.push({ 
      id: 'folder_' + Date.now(), 
      name, 
      icon: _selectedFolderIcon, 
      color: _selectedFolderColor, 
      parentId, 
      contextType 
    });
  }
  saveState(['all']);
  closeModal('modal-new-folder');
  renderFoldersList();
  if (_notesInHub) { 
    _renderNotesHub(); 
  } else { 
    _renderNotesFolderGrid(_currentFolderId); 
  }
}

async function deleteNotesFolder(folderId) {
  const confirmed = await showConfirm('¿Eliminar esta carpeta de notas?', { danger: true });
  if (!confirmed) return;

  const folders = _getFoldersArray();
  const index = folders.findIndex(f => f.id === folderId);

  if (index !== -1) {
    folders.splice(index, 1);
    saveState(['all']); 
    // Refrescar UI
    if (_notesInHub) _renderNotesHub();
    else renderFoldersList();
    console.log("Carpeta de notas borrada ✅");
  }
};

// ── NOTES LIST ────────────────────────────────────────────────
function renderNotesList() {
  // Always refresh the folder grid when in folder view
  if (_notesInHub) {
    _renderNotesHub();
    return;
  }
  const folView = document.getElementById('notes-folder-view');
  if (folView && folView.style.display !== 'none') {
    _renderNotesFolderGrid(_currentFolderId);
  }
  const container = document.getElementById('notes-list-items');
  if (!container) return;

  let notes = _getNotesArray();
  let html = '<div class="smart-grid">';
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
    container.innerHTML = sanitizeHtml(`<div style="padding:24px;text-align:center;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:8px;">📝</div>
      <div style="font-size:12px;">Sin notas en esta carpeta</div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="openNewNoteMenu()">+ Nueva nota</button>
    </div>`, true);
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
  clearTimeout(_noteAutoSaveTimer);
  _currentNoteId = id;
  _populateEditorSelects();
  _loadNoteInProEditor(id);
  openNoteEditorModal();
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
      if (prev) {
        if (note.canvasData?.startsWith('IDB:')) {
          const key = note.canvasData.replace('IDB:', '');
          idbGetImage(key).then(data => {
            if (data) prev.src = data;
          });
        } else {
          prev.src = note.canvasData || '';
        }
      }
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
        rte.innerHTML = sanitizeHtml(stored, true);
      } else {
        rte.innerHTML = sanitizeHtml(_plaintextToRteHtml(stored), true);
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
  if (tagsDsp) tagsDsp.innerHTML = (note.tags||[]).map(t=>`<span class="tag-chip active">#${sanitizeHtml(t)}</span>`).join('');

  // Render PDF attachments strip
  _renderPDFStrip(note);
}

function _showNotesEmptyState() {
  const emptyState  = document.getElementById('notes-empty-state');
  const titleWrap   = document.getElementById('notes-title-wrap');
  const ta          = _el('notes-main-ta');
  const wc          = document.getElementById('notes-wordcount');
  const drawArea    = document.getElementById('notes-drawing-area');
  const imgStrip    = document.getElementById('notes-images-strip');
  const toolbar     = document.getElementById('notes-toolbar');
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

// Convert plain text to HTML for RTE (converts line breaks to <br> or <p>)
function _plaintextToRteHtml(text) {
  if (!text) return '';
  // Escape HTML entities first
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Convert line breaks to <br>
  return escaped.replace(/\n/g, '<br>');
}

// Handle paste event in RTE to clean HTML or handle images
function _handleRtePaste(e) {
  e.preventDefault();
  const items = e.clipboardData?.items;
  if (!items) return;
  
  // Check for images
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const note = _getNotesArray().find(n => n.id === _currentNoteId);
        if (!note) {
          console.error('❌ [NOTES] Nota no encontrada para imagen:', _currentNoteId);
          return;
        }
        
        if (!note.images) note.images = {};
        const key = 'IMG_' + Date.now();
        
        try {
          // Store in IndexedDB con verificación de atomicidad
          if (typeof idbSetImage === 'function') {
            console.log(`📸 [NOTES] Guardando imagen en nota ${note.id}: ${key}`);
            const saved = await idbSetImage(key, base64);
            
            if (saved) {
              note.images[key] = 'IDB:' + key;
              note.updatedAt = Date.now();
              
              // 🔥 GUARDAR INMEDIATAMENTE para evitar pérdida
              if (typeof saveStateNow === 'function') {
                saveStateNow(['all']);
              } else {
                saveState(['all']);
              }
              
              if (typeof _renderImagesStrip === 'function') {
                _renderImagesStrip(note);
              }
              onNotesInput();
              
              console.log(`✅ [NOTES] Imagen guardada exitosamente: ${key}`);
            } else {
              throw new Error('No se pudo guardar imagen en IndexedDB');
            }
          } else {
            console.warn('⚠️ [NOTES] idbSetImage no disponible, usando localStorage');
            note.images[key] = base64;
            note.updatedAt = Date.now();
            saveState(['all']);
            
            if (typeof _renderImagesStrip === 'function') {
              _renderImagesStrip(note);
            }
            onNotesInput();
          }
        } catch (error) {
          console.error('❌ [NOTES] Error crítico guardando imagen:', error);
          if (typeof _appNotify === 'function') {
            _appNotify('Error al guardar imagen. Intenta de nuevo.', 'error');
          }
        }
      };
      reader.readAsDataURL(file);
      return;
    }
  }
  
  // Handle text paste - get plain text and insert as HTML
  const text = e.clipboardData.getData('text/plain');
  if (text) {
    document.execCommand('insertHTML', false, _plaintextToRteHtml(text));
  }
}

// ── IMAGES STRIP ──────────────────────────────────────────────
/* ── Adjuntar imágenes desde el botón de la barra ── */
async function attachImagesToNote(files) {
  if (!files || !files.length) return;
  if (!_currentNoteId) { 
    if (typeof _appNotify === 'function') {
      _appNotify('Selecciona o crea una nota primero.', 'warning');
    }
    return;
  }
  
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) {
    console.error('❌ [NOTES] Nota no encontrada:', _currentNoteId);
    if (typeof _appNotify === 'function') {
      _appNotify('Error: Nota no encontrada. Intenta de nuevo.', 'error');
    }
    return;
  }
  
  if (!note.images) note.images = {};

  let loaded = 0;
  let failed = 0;
  let totalImages = 0;
  
  // Filtrar solo archivos de imagen
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  totalImages = imageFiles.length;
  
  if (totalImages === 0) {
    if (typeof _appNotify === 'function') {
      _appNotify('No se encontraron archivos de imagen válidos.', 'warning');
    }
    return;
  }
  
  console.log(`📸 [NOTES] Cargando ${totalImages} imágenes en nota ${note.id}`);

  for (const file of imageFiles) {
    const reader = new FileReader();
    
    reader.onload = async ev => {
      const key = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      
      try {
        console.log(`📦 [NOTES] Guardando imagen: ${key} (${(file.size/1024).toFixed(1)}KB)`);
        
        // Store image in IndexedDB con verificación de atomicidad
        const saved = await idbSetImage(key, ev.target.result);
        
        if (saved) {
          note.images[key] = 'IDB:' + key; // placeholder reference
          note.updatedAt = Date.now();
          loaded++;
          console.log(`✅ [NOTES] Imagen guardada: ${key} (${loaded}/${totalImages})`);
          
          if (loaded === totalImages) {
            // 🔥 GUARDAR INMEDIATAMENTE para evitar pérdida
            if (typeof saveStateNow === 'function') {
              saveStateNow(['all']);
            } else {
              saveState(['all']);
            }
            
            // Get fresh note reference and render
            const freshNote = _getNotesArray().find(n => n.id === _currentNoteId);
            if (freshNote) {
              _renderImagesStrip(freshNote);
              // Force show strip
              const strip = document.getElementById('notes-images-strip');
              if (strip) strip.style.display = 'flex';
              // Scroll to show images
              setTimeout(() => {
                if (strip) strip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 100);
              if (typeof _appNotify === 'function') {
                _appNotify(`${loaded} imagen(es) cargada(s)`, 'ok');
              }
            }
          }
        } else {
          throw new Error('No se pudo guardar imagen en IndexedDB');
        }
      } catch (error) {
          failed++;
          console.error(`❌ [NOTES] Error guardando imagen ${key}:`, error);
          
          if (failed === 1) {
            // Solo mostrar notificación la primera vez
            if (typeof _appNotify === 'function') {
              _appNotify('Error al guardar imagen. Intenta de nuevo.', 'error');
            }
          }
          
          // Verificar si todas fallaron
          if (loaded === 0 && failed === totalImages) {
            console.error('❌ [NOTES] Todas las imágenes fallaron al guardar');
          }
        }
      };
      
      reader.onerror = () => {
        failed++;
        console.error(`❌ [NOTES] Error leyendo archivo: ${file.name}`);
      };
      
      reader.readAsDataURL(file);
  }
}

// ── PDF ATTACHMENTS ──────────────────────────────────────────────
/* ── Adjuntar PDF desde el botón de la barra ── */
async function loadPDFIntoNotes(file) {
  if (!file) return;
  if (!_currentNoteId) {
    if (typeof _appNotify === 'function') {
      _appNotify('Selecciona o crea una nota primero.', 'warning');
    }
    return;
  }

  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) {
    console.error('❌ [NOTES] Nota no encontrada:', _currentNoteId);
    if (typeof _appNotify === 'function') {
      _appNotify('Error: Nota no encontrada. Intenta de nuevo.', 'error');
    }
    return;
  }

  // Verificar que sea un PDF
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    if (typeof _appNotify === 'function') {
      _appNotify('El archivo debe ser un PDF.', 'warning');
    }
    return;
  }

  if (!note.pdfs) note.pdfs = {};
  if (!note.attachments) note.attachments = {};
  if (!note.attachments.pdfs) note.attachments.pdfs = {};

  const reader = new FileReader();

  reader.onload = async ev => {
    const key = 'pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    try {
      console.log(`📄 [NOTES] Cargando PDF: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

      // Guardar PDF en IndexedDB
      const saved = await idbSetImage(key, ev.target.result);

      if (saved) {
        note.pdfs[key] = {
          name: file.name,
          size: file.size,
          data: 'IDB:' + key
        };
        note.attachments.pdfs[key] = {
          name: file.name,
          size: file.size,
          data: 'IDB:' + key
        };
        note.updatedAt = Date.now();

        // Guardar estado inmediatamente
        if (typeof saveStateNow === 'function') {
          saveStateNow(['all']);
        } else {
          saveState(['all']);
        }

        // Renderizar PDF strip
        const freshNote = _getNotesArray().find(n => n.id === _currentNoteId);
        if (freshNote) {
          _renderPDFStrip(freshNote);
          // Mostrar strip
          const strip = document.getElementById('notes-pdf-strip');
          if (strip) strip.style.display = 'flex';
          // Scroll para mostrar PDFs
          setTimeout(() => {
            if (strip) strip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);

          if (typeof _appNotify === 'function') {
            _appNotify('PDF cargado correctamente', 'ok');
          }
        }
      } else {
        throw new Error('No se pudo guardar PDF en IndexedDB');
      }
    } catch (error) {
      console.error(`❌ [NOTES] Error guardando PDF:`, error);
      if (typeof _appNotify === 'function') {
        _appNotify('Error al guardar PDF. Intenta de nuevo.', 'error');
      }
    }
  };

  reader.onerror = () => {
    console.error(`❌ [NOTES] Error leyendo archivo: ${file.name}`);
    if (typeof _appNotify === 'function') {
      _appNotify('Error al leer el archivo PDF.', 'error');
    }
  };

  reader.readAsDataURL(file);
}

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
      <img src="" alt="img" id="img-${k}" data-img-key="${k}" loading="lazy" style="max-height:160px;max-width:240px;object-fit:cover;">
      <button class="nit-del" onclick="event.stopPropagation();deleteNoteImage('${noteId}','${k}')">✕</button>
    </div>`).join('');

  // Load images immediately (don't wait for intersection observer)
  keys.forEach(async k => {
    const imgEl = document.getElementById('img-' + k);
    if (!imgEl) return;
    const val = imgs[k];
    if (val && val.startsWith('IDB:')) {
      const idbKey = val.slice(4);
      const data = await idbGetImage(idbKey);
      if (data) {
        // Asignar data URL directamente al src (no necesita fetch, evita violación CSP)
        imgEl.src = data;
      } else {
        // Fallback visual si la imagen no existe
        imgEl.classList.add('img-error-placeholder');
        imgEl.alt = 'Imagen no disponible';
        imgEl.style.background = 'var(--surface3)';
        imgEl.style.display = 'flex';
        imgEl.style.alignItems = 'center';
        imgEl.style.justifyContent = 'center';
        imgEl.innerHTML = '<span style="font-size:24px;">⚠️</span>';
      }
    } else if (val) {
      imgEl.src = val;
    }
  });

  // Lazy load images con Intersection Observer (for scrolling optimization)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async entry => {
      if (entry.isIntersecting) {
        const imgEl = entry.target;
        const k = imgEl.dataset.imgKey;
        if (!k) return;

        const val = imgs[k];
        if (val && val.startsWith('IDB:')) {
          const idbKey = val.slice(4);
          const data = await idbGetImage(idbKey);
          if (data) {
            // Asignar data URL directamente al src (no necesita fetch, evita violación CSP)
            imgEl.src = data;
          } else {
            // Fallback visual si la imagen no existe
            imgEl.classList.add('img-error-placeholder');
            imgEl.alt = 'Imagen no disponible';
            imgEl.style.background = 'var(--surface3)';
            imgEl.style.display = 'flex';
            imgEl.style.alignItems = 'center';
            imgEl.style.justifyContent = 'center';
            imgEl.innerHTML = '<span style="font-size:24px;">⚠️</span>';
          }
        } else if (val) {
          imgEl.src = val;
        }

        observer.unobserve(imgEl);
      }
    });
  }, { rootMargin: '50px' });

  keys.forEach(k => {
    const imgEl = document.getElementById('img-' + k);
    if (imgEl) observer.observe(imgEl);
  });
}

// Render PDF attachments strip
function _renderPDFStrip(note) {
  const strip = document.getElementById('notes-pdf-strip');
  if (!strip) return;
  const pdfs = note.pdfs || note.attachments?.pdfs || {};
  const keys = Object.keys(pdfs);
  if (!keys.length) { strip.style.display = 'none'; return; }
  strip.style.display = 'flex';
  const noteId = note.id;
  strip.innerHTML = keys.map(k => {
    const pdf = pdfs[k];
    const name = pdf.name || pdf.filename || 'PDF';
    const size = pdf.size ? `(${(pdf.size / 1024).toFixed(1)} KB)` : '';
    return `
    <div class="notes-pdf-item" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="openNotePDF('${noteId}','${k}')">
      <span style="font-size:20px;">📄</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sanitizeHtml(name)}</div>
        <div style="font-size:10px;color:var(--text3);">${size}</div>
      </div>
      <button onclick="event.stopPropagation();deleteNotePDF('${noteId}','${k}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:4px;" title="Eliminar PDF">✕</button>
    </div>`;
  }).join('');
}

async function openNotePDF(noteId, pdfKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note) return;

  const pdfs = note.pdfs || note.attachments?.pdfs || {};
  const pdf = pdfs[pdfKey];
  if (!pdf) return;

  let pdfData = pdf.data;
  
  // Si está en IndexedDB, obtener los datos
  if (pdfData && pdfData.startsWith('IDB:')) {
    const idbKey = pdfData.slice(4);
    try {
      pdfData = await idbGetImage(idbKey);
      if (!pdfData) {
        if (typeof _appNotify === 'function') {
          _appNotify('Error: PDF no encontrado en almacenamiento', 'error');
        }
        return;
      }
    } catch (error) {
      console.error('Error obteniendo PDF de IndexedDB:', error);
      if (typeof _appNotify === 'function') {
        _appNotify('Error al cargar PDF', 'error');
      }
      return;
    }
  }

  openPDFModal(pdfData, pdf.name || 'PDF');
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
async function deleteNoteImage(noteId, imgKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note || !note.images) return;

  const confirmed = await showConfirm('¿Eliminar esta imagen?', { danger: true });
  if (!confirmed) return;

  const val = note.images[imgKey];
  const deletedImageData = { imgKey, val, noteId };

  if (val && val.startsWith('IDB:')) idbDeleteImage(val.slice(4));
  delete note.images[imgKey];
  saveState(['all']);
  _renderImagesStrip(note);

  // Show undo toast con restauración de IndexedDB
  if (typeof showUndoToast === 'function') {
    showUndoToast('Imagen eliminada', async () => {
      const note = _getNotesArray().find(n => n.id === noteId);
      if (note && note.images) {
        // Restaurar imagen desde IndexedDB si es referencia IDB
        if (val && val.startsWith('IDB:') && typeof idbRestoreImage === 'function') {
          const restored = await idbRestoreImage(val.slice(4));
          if (!restored) {
            console.warn('⚠️ No se pudo restaurar imagen (expiró o no existe)');
            // Aún así restaurar la referencia para consistencia
          }
        }
        note.images[imgKey] = val;
        saveState(['all']);
        _renderImagesStrip(note);
      }
    });
  }
}

async function deleteNotePDF(noteId, pdfKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note) return;

  const confirmed = await showConfirm('¿Eliminar este PDF?', { danger: true });
  if (!confirmed) return;

  const pdfs = note.pdfs || note.attachments?.pdfs || {};
  const val = pdfs[pdfKey];
  if (!val) return;

  delete pdfs[pdfKey];
  if (note.attachments && note.attachments.pdfs && note.attachments.pdfs[pdfKey]) {
    delete note.attachments.pdfs[pdfKey];
  }
  saveState(['all']);
  _renderPDFStrip(note);

  // Show undo toast
  if (typeof showUndoToast === 'function') {
    showUndoToast('PDF eliminado', () => {
      const note = _getNotesArray().find(n => n.id === noteId);
      if (note) {
        if (!note.pdfs) note.pdfs = {};
        note.pdfs[pdfKey] = val;
        saveState(['all']);
        _renderPDFStrip(note);
      }
    });
  }
}

// ── ADD NOTES ─────────────────────────────────────────────────
function openNewNoteMenu() { _notesNewNote(); }

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
  if (_notesInHub) { _notesInHub=false; _showNotesEditor(); _populateEditorSelects(); renderFoldersList(); renderNotesList(); }
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

async function deleteCurrentNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  const confirmed = await showConfirm('¿Eliminar esta nota?', { danger: true });
  if (!confirmed) return;
  clearTimeout(_noteAutoSaveTimer);
  _noteAutoSaveTimer = null;
  const idToDelete = _currentNoteId;
  const deletedNote = note ? { ...note } : null;
  _currentNoteId = null;
  const sem = State._activeSem;
  if (sem.notesArray) sem.notesArray = sem.notesArray.filter(n => n.id !== idToDelete);
  saveState(['all']);
  // closeNoteEditorModal now handles re-rendering the correct view
  closeNoteEditorModal();

  // Show undo toast
  if (deletedNote && typeof showUndoToast === 'function') {
    showUndoToast(`Nota "${deletedNote.title || 'Sin título'}" eliminada`, () => {
      const sem = State._activeSem;
      if (sem && sem.notesArray) {
        sem.notesArray.push(deletedNote);
        saveState(['all']);
        if (_notesInHub) {
          _renderNotesHub();
        } else {
          _renderNotesFolderGrid(_currentFolderId);
        }
      }
    });
  }
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
        // Store actual image data in IndexedDB con verificación de atomicidad
        const saved = await idbSetImage(key, base64);
        if (saved) {
          note.images[key] = 'IDB:' + key; // placeholder reference
          saveState(['all']);
          _renderImagesStrip(note);
          onNotesInput();
        } else {
          console.error('[NOTES] Error: No se pudo guardar imagen en IndexedDB (drop)');
          if (typeof _appNotify === 'function') {
            _appNotify('Error al guardar imagen. Espacio insuficiente.', 'error');
          }
        }
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
  if (!_currentNoteId) { if (typeof _appNotify === 'function') _appNotify('Selecciona una nota primero.', 'warning'); return; }

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

  if (!allText.trim()) { if (typeof _appNotify === 'function') _appNotify('No se pudo extraer texto del documento.', 'warning'); return; }

  // Insert scanned text into current note
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const rte = document.getElementById('notes-rte');
  const scannedHtml = '<hr style="border-color:var(--accent);opacity:.4;"><p><strong>📄 Texto escaneado</strong></p><p>' + allText.trim().replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>') + '</p>';
  if (rte && rte.style.display !== 'none') {
    rte.innerHTML = sanitizeHtml((rte.innerHTML || '') + scannedHtml, true);
    note.content = rte.innerHTML;
  } else {
    note.content = (note.content || '') + '\n\n--- 📄 Texto escaneado ---\n\n' + allText.trim();
  }
  note.updatedAt = Date.now();
  saveState(['all']);
  renderNotesList();
  _updateWordCount(rte ? rte.textContent : (note.content || ''));
  if (typeof _appNotify === 'function') _appNotify(`✅ Texto extraído (${allText.trim().split(/\s+/).length} palabras)`, 'ok');
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
  if (!_currentNoteId) return; // nota ya eliminada
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return; // nota no encontrada — fue borrada, no guardar
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
let _currentTool = 'pen'; // 'pen', 'line', 'rect', 'circle', 'eraser', 'ai', 'text', 'move'
let _shapeStart = null;
let _shapePreviewData = null;

/* ── Capa de imágenes movibles ── */
let _canvasImageObjects = [];   // [{id, img, x, y, w, h}]
let _dragImg     = null;        // objeto que se está arrastrando
let _dragOffX    = 0, _dragOffY = 0;
let _selectedImg = null;        // objeto seleccionado (handle de resize futuro)
let _canvasOverlay = null;      // div transparente sobre el canvas para handles

function _getOrCreateOverlay() {
  if (_canvasOverlay && _canvasOverlay.parentNode) return _canvasOverlay;
  const wrap = _canvas.parentNode;
  _canvasOverlay = document.createElement('div');
  _canvasOverlay.id = 'canvas-img-overlay';
  _canvasOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
  wrap.style.position = 'relative';
  wrap.appendChild(_canvasOverlay);
  return _canvasOverlay;
}

function _redrawCanvasImageHandles() {
  const ov = _getOrCreateOverlay();
  ov.innerHTML = '';
  if (_currentTool !== 'move') return;
  _canvasImageObjects.forEach(obj => {
    const r   = _canvas.getBoundingClientRect();
    const scaleX = _canvas.offsetWidth  / _canvas.width;
    const scaleY = _canvas.offsetHeight / _canvas.height;
    // selection border
    const sel = document.createElement('div');
    sel.style.cssText = `
      position:absolute;
      left:${obj.x * scaleX}px; top:${obj.y * scaleY}px;
      width:${obj.w * scaleX}px; height:${obj.h * scaleY}px;
      border:2px dashed var(--accent);
      border-radius:3px;
      box-sizing:border-box;
      pointer-events:none;
    `;
    // delete handle
    const del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText = `
      position:absolute; top:-11px; right:-11px;
      width:20px; height:20px; border-radius:50%;
      background:var(--red); color:#fff; border:none; cursor:pointer;
      font-size:10px; font-weight:700; line-height:1;
      pointer-events:all; z-index:3;
    `;
    del.onclick = (e) => {
      e.stopPropagation();
      _canvasImageObjects = _canvasImageObjects.filter(o => o.id !== obj.id);
      _flattenImagesToCanvas();
      _redrawCanvasImageHandles();
    };
    sel.appendChild(del);
    ov.appendChild(sel);
  });
}

function _flattenImagesToCanvas() {
  /* Redraw base canvas then stamp all image objects on top */
  if (!_ctx || !_canvas) return;
  /* We don't keep a separate base layer — images are already composited.
     Instead, re-draw from _undoStack base + all image objects. */
  _canvasImageObjects.forEach(obj => {
    _ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
  });
}

function _addImageObjectToCanvas(file, x, y) {
  if (!file || !_canvas || !_ctx) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const img = new Image();
    img.onload = () => {
      /* Save undo snapshot before adding */
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      if (_undoStack.length > 20) _undoStack.shift();
      const maxW = Math.min(img.width, _canvas.width * 0.55);
      const scale = maxW / img.width;
      const w = img.width  * scale;
      const h = img.height * scale;

      const obj = { id: Date.now() + '_' + Math.random().toString(36).slice(2,5), img, x, y, w, h };
      _canvasImageObjects.push(obj);
      _ctx.drawImage(img, x, y, w, h);
      /* Auto-switch to move tool so user can reposition immediately */
      const moveBtn = document.getElementById('tool-move-btn');
      if (moveBtn) setCanvasTool(moveBtn, 'move');
      _redrawCanvasImageHandles();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
} // stored before preview

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
    const p = _canvasGetPos(e);

    /* ── MOVE TOOL: check if click is on an image object ── */
    if (_currentTool === 'move') {
      // Hit-test in reverse order (topmost first)
      for (let i = _canvasImageObjects.length - 1; i >= 0; i--) {
        const obj = _canvasImageObjects[i];
        if (p.x >= obj.x && p.x <= obj.x + obj.w &&
            p.y >= obj.y && p.y <= obj.y + obj.h) {
          _dragImg  = obj;
          _dragOffX = p.x - obj.x;
          _dragOffY = p.y - obj.y;
          _canvas.style.cursor = 'grabbing';
          return;
        }
      }
      return; // clicked on empty area in move mode
    }

    if (_currentTool === 'text') {
      _openCanvasTextInput(p.x, p.y);
      return;
    }
    _drawing = true;
    _strokePoints = [];
    _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    if (_undoStack.length > 20) _undoStack.shift();
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
    e.preventDefault();
    const p = _canvasGetPos(e);

    /* ── MOVE TOOL: drag image object ── */
    if (_currentTool === 'move' && _dragImg) {
      if (_drawRafId) return;
      _drawRafId = requestAnimationFrame(() => {
        _drawRafId = null;
        /* Restore canvas to last undo snapshot, then redraw all image objects */
        if (_undoStack.length) {
          _ctx.putImageData(_undoStack[_undoStack.length - 1], 0, 0);
        }
        _dragImg.x = p.x - _dragOffX;
        _dragImg.y = p.y - _dragOffY;
        /* Draw all image objects */
        _canvasImageObjects.forEach(obj => {
          _ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
        });
        _redrawCanvasImageHandles();
      });
      return;
    }

    if (!_drawing) return;
    if (_drawRafId) return;
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
    /* ── MOVE TOOL: drop image ── */
    if (_currentTool === 'move' && _dragImg) {
      /* Commit position: take new undo snapshot */
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      if (_undoStack.length > 20) _undoStack.shift();
      _dragImg = null;
      _canvas.style.cursor = 'grab';
      _redrawCanvasImageHandles();
      return;
    }

    if (!_drawing) return;
    _drawing = false;
    const p = _strokePoints.length ? _strokePoints[_strokePoints.length-1] : null;

    if (_shapePreviewData && p && _currentTool !== 'pen' && _currentTool !== 'ai') {
      _ctx.putImageData(_shapePreviewData, 0, 0);
      _drawShape(_shapeStart.x, _shapeStart.y, p.x, p.y, _currentTool, _ctx);
      _shapePreviewData = null;
    }

    if (_currentTool === 'ai' && _strokePoints.length >= 5) {
      const detected = _detectShape(_strokePoints);
      if (detected) {
        if (_undoStack.length) _ctx.putImageData(_undoStack[_undoStack.length-1], 0, 0);
        const pts = _strokePoints;
        if (detected === 'line') {
          _drawShape(pts[0].x, pts[0].y, pts[pts.length-1].x, pts[pts.length-1].y, 'line', _ctx);
        } else {
          const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
          _drawShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), detected, _ctx);
        }
        _showShapeIndicator(detected);
      }
    }

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

  document.addEventListener('paste', _handleCanvasPaste);
  _canvas.addEventListener('dragover', e => e.preventDefault());
  _canvas.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const pos = _canvasGetPos(e);
      _addImageObjectToCanvas(file, pos.x, pos.y);
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
  _addImageObjectToCanvas(file, x, y);
}

function setCanvasTool(btn, tool) {
  _currentTool = tool;
  _canvasEraser = false;
  document.querySelectorAll('.canvas-tool-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const eb = document.getElementById('canvas-eraser-btn');
  if (eb) eb.classList.remove('active');
  if (tool === 'move') {
    _canvas.style.cursor = 'grab';
    _redrawCanvasImageHandles();
  } else {
    _canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
    /* Hide handles when not in move mode */
    const ov = document.getElementById('canvas-img-overlay');
    if (ov) ov.innerHTML = '';
  }
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
async function clearCanvas() {
  if (!_ctx || !_canvas) return;
  const confirmed = await showConfirm('¿Limpiar todo el dibujo?', { danger: true });
  if (!confirmed) return;
  _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
  _ctx.fillStyle = '#1a1f2e';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
}
function undoCanvas() {
  if (!_ctx || !_undoStack.length) return;
  _ctx.putImageData(_undoStack.pop(), 0, 0);
}

async function openCanvasForNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;

  // Reset canvas state
  _canvasImageObjects = [];
  _undoStack = [];
  _currentTool = 'pen';
  _canvasEraser = false;

  // Open the modal
  openModal('modal-canvas');

  // Initialize canvas after modal is visible
  setTimeout(() => {
    _canvas = document.getElementById('notes-canvas');
    if (!_canvas) return;

    // Set canvas size to match display size
    const rect = _canvas.parentNode.getBoundingClientRect();
    _canvas.width = rect.width - 40;  // padding
    _canvas.height = rect.height - 100; // toolbar space

    _ctx = _canvas.getContext('2d');

    // Fill with dark background
    _ctx.fillStyle = '#1a1f2e';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Set default styles
    _ctx.lineCap = 'round';
    _ctx.lineJoin = 'round';
    _ctx.lineWidth = _canvasSize;
    _ctx.strokeStyle = _canvasColor;

    // Load existing canvas data if available
    if (note.canvasData) {
      const img = new Image();
      img.onload = () => {
        _ctx.drawImage(img, 0, 0);
        // Save initial state to undo stack
        _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      };
      if (note.canvasData.startsWith('IDB:')) {
        idbGetImage(note.canvasData.replace('IDB:', '')).then(data => {
          if (data) img.src = data;
        });
      } else {
        img.src = note.canvasData;
      }
    } else {
      // Save initial blank state
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    }

    // Initialize events
    _initCanvasEvents();

    // Update title in toolbar
    const titleLbl = document.getElementById('canvas-note-title-lbl');
    if (titleLbl) titleLbl.textContent = note.title || 'Dibujo';
  }, 100);
}

async function saveCanvasAndClose() {
  if (!_canvas || !_currentNoteId) { closeModal('modal-canvas'); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (note) {
    const base64 = _canvas.toDataURL('image/png');
    const canvasKey = 'canvas_' + note.id;
    console.log('💾 [NOTES] Saving canvas to IndexedDB:', { noteId: note.id, canvasKey });
    const saved = await idbSetImage(canvasKey, base64);
    if (saved) {
      console.log('✅ [NOTES] Canvas saved to IndexedDB, saving to State');
      note.canvasData = 'IDB:' + canvasKey; // placeholder reference
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
      if (prev) prev.src = base64;
      renderNotesList();
      // If it's a text note, re-render the images strip to show the canvas thumbnail
    } else {
      console.error('[NOTES] Error: No se pudo guardar canvas en IndexedDB');
      if (typeof _appNotify === 'function') {
        _appNotify('Error al guardar dibujo. Espacio insuficiente.', 'error');
      }
    }
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
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;color:var(--text2);">
        <span style="font-size:11px;color:var(--text3);">Total:</span>
        <input type="number" id="${id}-total" class="form-input" min="0" max="999" step="0.5"
               value="${totalPts.toFixed(1)}" placeholder="0"
               style="width:70px;font-size:13px;font-weight:700;color:var(--accent2);text-align:center;padding:4px 6px;border:1.5px solid var(--accent2);border-radius:6px;background:var(--surface);"
               title="Puntos totales de esta zona (editable)">
        <span style="font-size:11px;color:var(--text3);">pts</span>
      </div>
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
  totalEl.value = total.toFixed(1);
}

function saveEditClass() {
  if (!_ecMatId) return;
  const mat = State.materias.find(m => m.id === _ecMatId);
  if (!mat) return;

  const name = document.getElementById('ec-name').value.trim();
  const code = document.getElementById('ec-code').value.trim();
  if (!name || !code) { if (typeof _appNotify === 'function') _appNotify('Nombre y código son requeridos.', 'warning'); return; }

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
      // 🔥 FIX: Leer el total del input editable directamente y respetarlo
      const totalInput = row.querySelector('input[id$="-total"]');
      const manualTotal = totalInput ? parseFloat(totalInput.value) || 0 : 0;
      // 🔥 FIX: Si el usuario editó el manual total, usarlo siempre (no solo si > 0)
      if (manualTotal > 0) {
        const subsWithPts = subs.filter(s => s.maxPts > 0);
        const currentSubTotal = subs.reduce((a, s) => a + (s.maxPts || 0), 0);
        
        // Solo redistribuir si NO hay apartados con puntos o el total cambió significativamente
        if (subsWithPts.length === 0 || Math.abs(manualTotal - currentSubTotal) > 0.01) {
          // Distribuir puntos entre los apartados
          if (subs.length > 0) {
            const ptsPerSub = manualTotal / subs.length;
            subs.forEach((s, i) => {
              s.maxPts = parseFloat(ptsPerSub.toFixed(2));
              if (i === subs.length - 1) {
                const distributedTotal = subs.reduce((a, sub) => a + sub.maxPts, 0);
                s.maxPts = parseFloat((s.maxPts + (manualTotal - distributedTotal)).toFixed(2));
              }
            });
          }
          totalPts = manualTotal;
        } else {
          // Respetar los valores individuales de los apartados
          totalPts = currentSubTotal;
        }
      }
      if (totalPts > 0) {
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

function renderNotebookPage() { if (!_notesInHub) renderNotesProPage(); }
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
// AGENDA SEMANAL RODANTE — 7 días desde hoy
// ══════════════════════════════════════════════════
let _weekOffset   = 0;  // kept for legacy compat
let ovFilterDay   = null; // null = sin filtro, 'YYYY-MM-DD' = filtrado
let ovShowEvents  = localStorage.getItem('academia_ov_show_events') !== 'false'; // true = mostrar eventos, false = solo tareas

function changeWeekOffset(delta, e) {
  if (e) e.stopPropagation();
  if (delta === 0) { _weekOffset = 0; }
  else { _weekOffset += delta; }
  renderOverview();
}

function toggleLoadPanel() {
  // legacy — ya no hace nada visible pero se mantiene para no romper onclick existentes
}

function ovSetDayFilter(dateStr) {
  ovFilterDay = ovFilterDay === dateStr ? null : dateStr;
  renderOverview();
}

function openAgendaDayModal(dateStr) {
  if (typeof calDayClick === 'function') {
    calDayClick(dateStr);
  }
}

function ovClearDayFilter() {
  ovFilterDay = null;
  renderOverview();
}

function toggleEventsInTasks(show) {
  ovShowEvents = show;
  localStorage.setItem('academia_ov_show_events', show ? 'true' : 'false');
  renderOverview();
}

// Inicializar checkbox con el estado guardado
function initEventsCheckbox() {
  const checkbox = document.getElementById('ov-show-events');
  if (checkbox) {
    checkbox.checked = ovShowEvents;
  }
}

// Listener para actualizar overview cuando cambian preferencias
window.addEventListener('render:overview', () => {
  if (typeof renderOverview === 'function') renderOverview();
});

// Patch renderOverview con la nueva implementación
const _origRenderOverview = _renderOverview;
function _renderOverview() {
  const pending = State.tasks.filter(t => !t.done);
  const overall = calcOverallGPA();

  // Inicializar checkbox de eventos
  initEventsCheckbox();

  // ── Stats legacy ──────────────────────────────────────────
  const ovMatsEl = _el('ov-mats');
  if (ovMatsEl) ovMatsEl.textContent = State.materias.filter(m=>!m.parentId).length;
  const avgEl  = _el('ov-avg');
  const credEl = _el('ov-cred');
  if (avgEl)  avgEl.textContent  = overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—';
  if (credEl) credEl.textContent = overall.totalCred  || '0';
  const legacyPend = document.getElementById('ov-pending');
  if (legacyPend) legacyPend.textContent = pending.length;

  updateGPADisplay();

  const urgentCount = pending.filter(t => t.due && (new Date(t.due)-new Date())/86400000 < 3 && (new Date(t.due)-new Date())/86400000 >= 0).length;
  const profileSub  = State.settings?.profile?.carrera ? ` · ${State.settings.profile.carrera}` : '';
  const subEl = _el('ov-sub');
  if (subEl) subEl.textContent =
    urgentCount > 0 ? `⚡ ${urgentCount} tarea(s) vencen en menos de 2 días`
    : pending.length > 0 ? `${pending.length} tarea(s) pendiente(s)${profileSub}`
    : `¡Sin pendientes! 🎉${profileSub}`;

  const badge = _el('ov-pending-badge');
  if (badge) badge.textContent = pending.length > 0 ? `${pending.length} sin entregar` : '';

  // ── Agenda Semanal Rodante (7 días desde hoy) ─────────────
  // Respetar preferencia showWeeklyBar
  const agendaCard = document.getElementById('agenda-card');
  const showWeeklyBar = State.settings.showWeeklyBar !== false; // Default true
  if (agendaCard) {
    agendaCard.style.display = showWeeklyBar ? '' : 'none';
  }

  const stripEl = document.getElementById('ov-day-strip');
  if (stripEl && showWeeklyBar) {
    const today = new Date(); today.setHours(0,0,0,0);
    const daysFull = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

    stripEl.innerHTML = `<div class="agenda-strip">` + Array.from({length:7}, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dStr = d.toISOString().slice(0,10);
      const isToday    = i === 0;
      const isSelected = ovFilterDay === dStr;

      const dayTasks  = State.tasks.filter(t => !t.done && t.due === dStr);
      const dayEvents = (State.events || []).filter(e => (e.date || e.start || '').slice(0,10) === dStr);
      const matIds    = [...new Set(dayTasks.map(t => t.matId))];
      const dots = matIds.slice(0,5).map(mid => {
        const m = getMat(mid);
        return `<div class="agenda-dot" style="background:${m.color||'var(--accent)'};" title="${m.name||''}"></div>`;
      }).join('');
      const extraDots  = matIds.length > 5 ? `<div class="agenda-dot-more">+${matIds.length-5}</div>` : '';
      const totalCount = dayTasks.length + dayEvents.length;
      const isSunday = d.getDay() === 0;
      const isSaturday = d.getDay() === 6;

      return `<div class="agenda-day-card${isToday?' today':''}${isSelected?' selected':''}${isSunday?' sunday':''}${isSaturday?' sunday':''}" onclick="openAgendaDayModal('${dStr}')" title="${isToday?'Hoy · ':''} ${d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}">
        <div class="adc-dayname">${daysFull[d.getDay()]}</div>
        <div class="adc-daynum">${d.getDate()}</div>
        <div class="adc-month">${monthNames[d.getMonth()]}</div>
        <div class="adc-dots">${dots}${extraDots}</div>
        ${totalCount > 0 ? `<div class="adc-count">${totalCount}</div>` : '<div class="adc-count" style="opacity:0;">0</div>'}
        ${isToday ? '<div class="adc-today-label">HOY</div>' : ''}
      </div>`;
    }).join('') + `</div>`;
  }

  // ── Label de filtro activo ────────────────────────────────
  const filterLbl      = document.getElementById('ov-agenda-filter-label');
  const clearFilterBtn = document.getElementById('ov-clear-filter-btn');
  if (ovFilterDay) {
    const fd = new Date(ovFilterDay + 'T00:00:00');
    if (filterLbl)    filterLbl.textContent  = `📌 ${fd.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}`;
    if (clearFilterBtn) clearFilterBtn.style.display = '';
  } else {
    if (filterLbl)    filterLbl.textContent  = '';
    if (clearFilterBtn) clearFilterBtn.style.display = 'none';
  }

  // ── Panel de Tareas ───────────────────────────────────────
  const tl = _el('ov-tasks-list');
  if (!tl) return;
  const today2 = new Date(); today2.setHours(0,0,0,0);

  let taskPool = ovFilterDay
    ? pending.filter(t => t.due === ovFilterDay || t.datePlanned === ovFilterDay)
    : pending;

  // Eventos del calendario ordenados por fecha
  const allEvents = (State.events || []).filter(e => {
    const eDate = (e.date || e.start || '').slice(0,10);
    if (!eDate) return false;
    if (ovFilterDay) return eDate === ovFilterDay;
    return eDate >= today2.toISOString().slice(0,10);
  }).sort((a,b) => {
    const da = (a.date||a.start||'').slice(0,10), db = (b.date||b.start||'').slice(0,10);
    return da < db ? -1 : da > db ? 1 : 0;
  });

  if (!taskPool.length && !allEvents.length) {
    tl.innerHTML = ovFilterDay
      ? `<div style="text-align:center;padding:40px;color:var(--text3);">
          <div style="font-size:36px;margin-bottom:8px;">✅</div>
          <div style="font-size:14px;font-weight:700;">Sin tareas para este día</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="ovClearDayFilter()">Ver todas las pendientes</button>
        </div>`
      : `<div style="text-align:center;padding:40px;color:var(--text3);">
          <div style="font-size:36px;margin-bottom:8px;">✅</div>
          <div style="font-size:14px;font-weight:700;">¡Sin tareas pendientes!</div>
          <div style="font-size:12px;margin-top:4px;color:var(--text3);">Siga adelante, Ingeniero 🎓</div>
        </div>`;
    return;
  }

  // ── Paleta: rojo <3d (0,1,2), amarillo 3-5d, verde ≥6d ──
  function _pal(daysLeft) {
    if (daysLeft === null) return { bg:'', border:'', badgeBg:'rgba(150,150,150,.25)', badgeColor:'var(--text2)', icon:'—' };
    if (daysLeft < 0)      return { bg:'rgba(248,113,113,.20)', border:'#f87171', badgeBg:'rgba(210,40,40,.85)',   badgeColor:'#fff',  icon:'❗' };
    if (daysLeft === 0)    return { bg:'rgba(248,113,113,.20)', border:'#f87171', badgeBg:'rgba(210,40,40,.85)',   badgeColor:'#fff',  icon:'🔴' };
    if (daysLeft < 3)      return { bg:'rgba(248,113,113,.16)', border:'#f87171', badgeBg:'rgba(248,113,113,.82)', badgeColor:'#111',  icon:'🟠' };
    if (daysLeft <= 5)     return { bg:'rgba(251,191,36,.14)',  border:'#fbbf24', badgeBg:'rgba(251,191,36,.90)',  badgeColor:'#111',  icon:'🟡' };
    return                        { bg:'rgba(74,222,128,.12)',  border:'#4ade80', badgeBg:'rgba(40,180,90,.82)',   badgeColor:'#111',  icon:'🟢' };
  }

  function _badgeText(dl) {
    if (dl === null)  return 'Sin fecha';
    if (dl < 0)       return `Venció hace ${-dl}d`;
    if (dl === 0)     return 'Vence hoy';
    if (dl === 1)     return 'Falta 1 día';
    return                   `Faltan ${dl} días`;
  }

  // Fecha legible: "mié. 22 abr."
  const _DAYS   = ['dom','lun','mar','mié','jue','vie','sáb'];
  const _MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function _fmtReadable(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${_DAYS[d.getDay()]}. ${d.getDate()} ${_MONTHS[d.getMonth()]}.`;
  }

  const sortByDue = arr => [...arr].sort((a,b) => {
    const da = a.due||'9999-12-31', db = b.due||'9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Agrupar tareas por materia
  const grouped    = {};
  const noMatTasks = [];
  taskPool.forEach(t => {
    const m = getMat(t.matId);
    if (!m || !m.id) { noMatTasks.push(t); return; }
    if (!grouped[m.id]) grouped[m.id] = { mat: m, tasks: [] };
    grouped[m.id].tasks.push(t);
  });

  // Ordenar grupos por su tarea más próxima a vencer
  const sortedGroups = Object.values(grouped).sort((a, b) => {
    const minA = a.tasks.reduce((m, t) => t.due && t.due < m ? t.due : m, '9999-12-31');
    const minB = b.tasks.reduce((m, t) => t.due && t.due < m ? t.due : m, '9999-12-31');
    return minA < minB ? -1 : minA > minB ? 1 : 0;
  });

  // Inyectar CSS responsive una sola vez
  if (!document.getElementById('ov-task-css')) {
    const s = document.createElement('style'); s.id = 'ov-task-css';
    s.textContent = `
      .ov-task-row {
        display: flex; align-items: flex-start; gap: 12px;
        padding: 11px 16px; transition: filter .15s;
      }
      .ov-task-row:hover { filter: brightness(1.07); }
      .ov-task-row.ov-due-today-blink {
        position: relative;
        z-index: 1;
        transform-origin: center;
        animation: dueTodayBlink 1.15s ease-in-out 3 !important;
      }
      .ov-task-row.ov-due-today-blink::before {
        content: '';
        position: absolute;
        inset: -6px -8px;
        border-radius: 12px;
        pointer-events: none;
        background: radial-gradient(
          circle at 50% 50%,
          rgba(var(--due-today-blink-rgb,251,146,60), .22) 0%,
          rgba(var(--due-today-blink-rgb,251,146,60), .10) 45%,
          rgba(var(--due-today-blink-rgb,251,146,60), 0) 75%
        );
        animation: dueTodayFlameAura 1.15s ease-in-out 3 !important;
      }
      .ov-task-row .mc-task-info { flex: 1; min-width: 0; }
      /* Checkbox de tarea */
      .ov-task-checkbox {
        position: relative;
        flex-shrink: 0;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .ov-task-checkbox:hover {
        transform: scale(1.15);
        box-shadow: 0 0 12px rgba(124,106,255,0.3);
      }
      .ov-task-checkbox:active {
        transform: scale(0.9);
      }
      .ov-task-checkbox.checked {
        animation: ovCheckBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .ov-task-checkbox span {
        pointer-events: none;
        user-select: none;
      }
      /* Animación de check */
      @keyframes ovCheckBounce {
        0% { transform: scale(0.8); }
        40% { transform: scale(1.2); }
        70% { transform: scale(0.95); }
        100% { transform: scale(1); }
      }
      .ov-badge {
        display: inline-flex; align-items: center; gap: 5px;
        border-radius: 8px; font-size: 12px; font-weight: 700;
        padding: 5px 12px; white-space: nowrap; flex-shrink: 0;
        box-shadow: 0 1px 6px rgba(0,0,0,.22); letter-spacing: .1px;
      }
      .ov-badge-wrap {
        flex-shrink: 0; display: flex; flex-direction: column;
        align-items: flex-end; gap: 4px; min-width: 120px;
      }
      .ov-mat-header {
        padding: 10px 16px 8px; display: flex; align-items: center; gap: 8px;
        border-top: 2px solid var(--border);
        margin-top: 6px;
        background: #00000091; /* materias header distinct background */
        color: var(--text);
      }
      .ov-mat-chip {
        background: #00000080 !important;
        color: #fff !important;
        border-radius: 5px;
        padding: 2px 8px;
        font-size: 11px; font-weight: 700;
      }
      .ov-mat-header:first-child { border-top: none; margin-top: 0; }
      .ov-prog-bar-wrap {
        width: 100%; height: 5px; background: rgba(255,255,255,.10);
        border-radius: 3px; margin-top: 6px; overflow: hidden;
      }
      .ov-prog-bar-fill {
        height: 100%; border-radius: 3px; transition: width .4s ease;
      }
      @media (max-width: 600px) {
        .ov-task-row { flex-wrap: wrap; gap: 6px; padding: 10px 12px; }
        .ov-task-row .mc-task-info { width: 100%; }
        .ov-badge-wrap { width: 100%; flex-direction: row; align-items: center; justify-content: space-between; min-width: 0; }
        .ov-badge { font-size: 11px; padding: 4px 10px; }
        .ov-mat-header { padding: 8px 12px 5px; flex-wrap: wrap; gap: 5px; }
      }
      @media (max-width: 400px) {
        .ov-task-row { padding: 9px 10px; }
        .ov-badge { font-size: 10px; }
      }
    `;
    document.head.appendChild(s);
  }

  // Colores por tipo de tarea (independientes de prioridad y de la materia)
  const _typeColorMap = {
    'tarea':          { bg:'rgba(34,211,238,.15)',  border:'#22d3ee', text:'#22d3ee'  },
    'parcial':        { bg:'rgba(251,146,60,.18)',  border:'#fb923c', text:'#fb923c'  },
    'proyecto':       { bg:'rgba(167,139,250,.18)', border:'#a78bfa', text:'#a78bfa'  },
    'examen':         { bg:'rgba(244,114,182,.18)', border:'#f472b6', text:'#f472b6'  },
    'examen final':   { bg:'rgba(244,114,182,.22)', border:'#f472b6', text:'#f472b6'  },
    'lab':            { bg:'rgba(74,222,128,.15)',  border:'#4ade80', text:'#4ade80'  },
    'quiz':           { bg:'rgba(251,191,36,.15)',  border:'#fbbf24', text:'#e9a800'  },
    'taller':         { bg:'rgba(20,184,166,.15)',  border:'#2dd4bf', text:'#2dd4bf'  },
    'hoja de trabajo':{ bg:'rgba(99,102,241,.15)',  border:'#818cf8', text:'#818cf8'  },
    'practica':       { bg:'rgba(99,102,241,.15)',  border:'#818cf8', text:'#818cf8'  },
    'práctica':       { bg:'rgba(99,102,241,.15)',  border:'#818cf8', text:'#818cf8'  },
    'trabajo':        { bg:'rgba(20,184,166,.15)',  border:'#2dd4bf', text:'#2dd4bf'  },
    'informe':        { bg:'rgba(16,185,129,.15)',  border:'#34d399', text:'#34d399'  },
  };
  function _typeStyle(type, fallbackColor) {
    const key = (type||'tarea').toLowerCase().trim();
    return _typeColorMap[key] || { bg: fallbackColor+'22', border: fallbackColor+'88', text: fallbackColor };
  }

  const blinkDueTodayNow = typeof _consumeOverviewDueTodayBlinkOnRender === 'function'
    ? _consumeOverviewDueTodayBlinkOnRender()
    : false;
  const todayIso = typeof _todayLocalISO === 'function'
    ? _todayLocalISO()
    : new Date().toISOString().slice(0, 10);

  function _taskHtml(t) {
    const m        = getMat(t.matId);
    const dueD     = t.due ? new Date(t.due + 'T00:00:00') : null;
    const daysLeft = dueD  ? Math.ceil((dueD - today2) / 86400000) : null;
    const pal      = _pal(daysLeft);
    // Fondo neutro fijo — solo el borde izquierdo lleva el color de urgencia
    const borderColor = pal.border || 'var(--border2)';
    const bgStyle  = `background:var(--surface2,rgba(255,255,255,.04));`;
    const prog       = subtaskProgress(t);
    const dueTimeStr = t.dueTime ? ` · ⏰ ${t.dueTime}` : '';
    const planStr    = t.datePlanned
      ? `<span style="font-size:11px;color:var(--text3);">📋 ${_fmtReadable(t.datePlanned)}${t.timePlanned?' '+t.timePlanned:''}</span>`
      : '';
    const prioClass  = t.priority === 'high'||t.priority === 'alta' ? 'prio-alta'
                     : t.priority === 'low' ||t.priority === 'baja' ? 'prio-baja'
                     : t.priority ? 'prio-media' : 'prio-none';
    const mc   = m ? (m.color||'#7c6aff') : '#7c6aff';
    const type = (t.type||'Tarea');
    const tc   = _typeStyle(type, mc);
    const isDueToday = !t.done && !!t.due && t.due === todayIso;
    const dueTodayBlinkClass = blinkDueTodayNow && isDueToday ? ' ov-due-today-blink' : '';
    const blinkRgb = t.priority === 'high' ? '248,113,113' : t.priority === 'low' ? '74,222,128' : '251,191,36';
    const dueTodayBlinkStyle = blinkDueTodayNow && isDueToday ? `--due-today-blink-rgb:${blinkRgb};` : '';
    // Barra de progreso de subtareas
    const progBar = prog && prog.total > 0 ? (() => {
      const pct  = Math.round((prog.done / prog.total) * 100);
      const barC = pct >= 100 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171';
      return `<div class="ov-prog-bar-wrap">
        <div class="ov-prog-bar-fill" style="width:${pct}%;background:${barC};"></div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:3px;">
        📎 ${prog.done}/${prog.total} subtareas · ${pct}%
      </div>`;
    })() : '';
    // Fecha de entrega grande apilada encima del badge (lado derecho)
    const dueDateBig = t.due
      ? `<div style="font-size:12px;font-weight:700;color:var(--text2);text-align:right;margin-bottom:4px;white-space:nowrap;line-height:1.2;">📅 ${_fmtReadable(t.due)}${dueTimeStr}</div>`
      : '';
    return `<div class="mc-task-item ov-task-row ${prioClass}${dueTodayBlinkClass}" style="cursor:pointer;${bgStyle}${dueTodayBlinkStyle}">
      <!-- Checkbox para completar tarea (stopPropagation para no abrir detalle) -->
      <div class="ov-task-checkbox ${t.done ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTask('${t.id}');" style="
        width:24px;height:24px;border-radius:8px;border:2px solid ${borderColor};
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
        cursor:pointer;transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        background:${t.done ? 'linear-gradient(135deg, #a78bfa 0%, #7c6aff 100%)' : 'transparent'};
        border-color:${t.done ? 'var(--accent)' : borderColor};
        box-shadow:${t.done ? '0 2px 8px rgba(124,106,255,0.4)' : 'none'};
      ">
        <span style="font-size:14px;color:#fff;font-weight:800;opacity:${t.done ? 1 : 0};transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);transform:${t.done ? 'scale(1)' : 'scale(0)'};">✓</span>
      </div>
      <div class="mc-task-info" onclick="openTaskDetail('${t.id}')" style="flex:1;min-width:0;">
        <div class="mc-task-title" style="font-size:13px;font-weight:600;margin-bottom:5px;line-height:1.35;color:var(--text);">${t.title}</div>
        <div class="mc-task-meta" style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          <span class="ov-mat-chip" style="color:${tc.text};border:1px solid ${tc.border};padding:2px 8px;font-size:11px;font-weight:700;border-radius:5px;">${type}</span>
          ${planStr}
        </div>
        ${progBar}
      </div>
      <div class="ov-badge-wrap" onclick="openTaskDetail('${t.id}')" style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        ${dueDateBig}
        <span class="ov-badge" style="background:${pal.badgeBg};color:${pal.badgeColor};">${pal.icon} ${_badgeText(daysLeft)}</span>
      </div>
    </div>`;
  }

  let html = '';

  // 1. EVENTOS primero — ordenados por fecha más próxima (mayor urgencia arriba)
  // Solo mostrar si el checkbox está seleccionado
  if (allEvents.length && ovShowEvents) {
    const sortedEvs = [...allEvents].sort((a,b) => {
      const da = (a.date||a.start||'').slice(0,10);
      const db = (b.date||b.start||'').slice(0,10);
      return da < db ? -1 : da > db ? 1 : 0;
    });
    html += `<div class="ov-mat-header" style="border-left:4px solid #60a5fa;background:rgba(96,165,250,.08);">
      <span style="font-size:15px;">📅</span>
      <span style="font-size:14px;font-weight:800;color:var(--text);letter-spacing:-.2px;">Eventos</span>
      <span style="font-size:10px;color:var(--text3);margin-left:auto;background:rgba(96,165,250,.15);padding:2px 8px;border-radius:10px;">${sortedEvs.length} próximo${sortedEvs.length!==1?'s':''}</span>
    </div>`;
    sortedEvs.forEach(ev => {
      const evMat    = ev.matId ? getMat(ev.matId) : null;
      const evDate   = (ev.date||ev.start||'').slice(0,10);
      const evDueD   = evDate ? new Date(evDate + 'T00:00:00') : null;
      const evDLeft  = evDueD ? Math.ceil((evDueD - today2) / 86400000) : null;
      // Eventos siempre con fondo azul independientemente de los días que faltan
      const evBgStyle = 'background:rgba(96,165,250,.10);border-left:3px solid #60a5fa;';
      const badgeBg   = 'rgba(59,130,246,.85)';
      const badgeColor = '#fff';
      const evIcon    = evDLeft !== null && evDLeft < 0 ? '❗' : evDLeft === 0 ? '🔴' : '📅';
      const evDateBig = evDate
        ? `<div style="font-size:12px;font-weight:700;color:#93c5fd;text-align:right;margin-bottom:4px;white-space:nowrap;line-height:1.2;">📅 ${_fmtReadable(evDate)}${ev.time?' · ⏰ '+ev.time:''}</div>`
        : '';
      html += `<div class="mc-task-item ov-task-row" style="cursor:default;${evBgStyle}">
        <div class="mc-task-info">
          <div class="mc-task-title" style="font-size:13px;font-weight:600;margin-bottom:5px;line-height:1.35;color:var(--text);">📅 ${ev.title||'Evento'}</div>
          <div class="mc-task-meta" style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
            ${evMat?`<span class="ov-mat-chip" style="color:${evMat.color||'#60a5fa'};border:1px solid ${evMat.color||'#60a5fa'}55;">${evMat.code||evMat.name}</span>`:''}
            ${ev.type?`<span style="font-size:11px;color:#93c5fd;">${ev.type}</span>`:''}
          </div>
        </div>
        <div class="ov-badge-wrap" style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          ${evDateBig}
          <span class="ov-badge" style="background:${badgeBg};color:${badgeColor};">${evIcon} ${evDLeft!==null?_badgeText(evDLeft):'Evento'}</span>
        </div>
      </div>`;
    });
  }

  // 2. Tareas sin materia (ordenadas por fecha)
  if (noMatTasks.length) {
    html += sortByDue(noMatTasks).map(_taskHtml).join('');
  }

  // 3. Grupos de tareas ordenados por fecha de vencimiento más próxima
  sortedGroups.forEach(({ mat, tasks }) => {
    const cnt = tasks.length;
    const mc  = mat.color || 'var(--accent)';
    html += `<div class="ov-mat-header" style="background:#000;">
      <span style="font-size:15px;line-height:1;">${mat.icon||'📚'}</span>
      <span style="font-size:14px;font-weight:800;color:var(--text);letter-spacing:-.2px;">${mat.name}</span>
      ${mat.code?`<span style="font-size:10px;color:var(--text3);background:var(--surface2);padding:1px 7px;border-radius:4px;font-family:'Space Mono',monospace;">${mat.code}</span>`:''}
      <span style="font-size:10px;color:var(--text3);margin-left:auto;background:${mc}22;padding:2px 8px;border-radius:10px;">${cnt} pendiente${cnt!==1?'s':''}</span>
    </div>`;
    html += sortByDue(tasks).map(_taskHtml).join('');
  });

  tl.innerHTML = html;

  // Remove blink class after animation completes
  setTimeout(() => {
    document.querySelectorAll('.ov-due-today-blink').forEach(el => {
      el.classList.remove('ov-due-today-blink');
    });
  }, 3450); // 1.15s * 3 iterations = 3.45s
}

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
  if (!State.settings.approvedCourses || !Array.isArray(State.settings.approvedCourses)) {
    State.settings.approvedCourses = [];
  }
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
  // Inject "Sistema" option first time if not present
  if (fontSel && !fontSel.querySelector('option[value="Sistema"]')) {
    const opt = document.createElement('option');
    opt.value = 'Sistema'; opt.textContent = 'Sistema (fuente del dispositivo)';
    fontSel.insertBefore(opt, fontSel.firstChild);
  }
  if (fontSel)  fontSel.value  = State.settings.font || 'Sistema';
  if (soundSel) soundSel.value = State.settings.soundVariant || 'classic';
  // Sync new UI preferences
  const weeklyCheck = document.getElementById('cfg-show-weekly');
  const homeSel = document.getElementById('cfg-default-home');
  if (weeklyCheck) weeklyCheck.checked = State.settings.showWeeklyBar !== false; // Default true
  if (homeSel) homeSel.value = State.settings.defaultHomePage || 'overview';
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
      grEl.textContent = `${g}, ${p.name.split(' ')[0]} `;
    }
  }
  if (typeof _appNotify === 'function') _appNotify('✅ Perfil guardado correctamente', 'ok');
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
  if (!name) { if (typeof _appNotify === 'function') _appNotify('El nombre del curso es obligatorio', 'warning'); return; }
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

async function deleteApprovedCourse(idx) {
  const confirmed = await showConfirm('¿Eliminar este curso?', { danger: true });
  if (!confirmed) return;
  _getApprovedCourses().splice(idx, 1);
  saveState(['all']);
  recalcProfile();
  renderApprovedCourses();
}

// ══════════════════════════════════════════════════════════════
// GLOBAL EVENT DELEGATION FOR NOTES MODULE
// Replaces all inline onclick handlers from partials/notas.html
// ══════════════════════════════════════════════════════════════
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  // ═══════════════════════════════════════════════════════════════
  // NOTES MODULE EVENT DELEGATION
  // ═══════════════════════════════════════════════════════════════

  // Top bar actions
  if (actionType === 'notes-go-back') {
    if (typeof _notesGoBack === 'function') _notesGoBack();
    return;
  }
  if (actionType === 'notes-new-note') {
    if (typeof _notesNewNote === 'function') _notesNewNote();
    return;
  }
  if (actionType === 'notes-new-drawing') {
    if (typeof _notesNewDrawing === 'function') _notesNewDrawing();
    return;
  }
  if (actionType === 'open-new-folder-modal') {
    if (typeof openNewFolderModal === 'function') openNewFolderModal(null, _currentFolderId);
    return;
  }

  // Note editor actions
  if (actionType === 'close-note-editor') {
    if (typeof closeNoteEditorModal === 'function') closeNoteEditorModal();
    return;
  }
  if (actionType === 'expand-current-note') {
    if (typeof expandCurrentNote === 'function') expandCurrentNote();
    return;
  }
  if (actionType === 'export-current-note') {
    if (typeof exportCurrentNote === 'function') exportCurrentNote();
    return;
  }
  if (actionType === 'delete-current-note') {
    if (typeof deleteCurrentNote === 'function') deleteCurrentNote();
    return;
  }
  if (actionType === 'open-canvas') {
    if (typeof openCanvasForNote === 'function') openCanvasForNote();
    return;
  }

  // RTE (Rich Text Editor) actions
  if (actionType === 'rte-exec') {
    const cmd = action.dataset.command;
    const val = action.dataset.value || null;
    if (typeof rteExec === 'function') rteExec(cmd, val);
    return;
  }
  if (actionType === 'rte-copy-formatted') {
    if (typeof rteCopyFormatted === 'function') rteCopyFormatted();
    return;
  }
  if (actionType === 'rte-copy-plain') {
    if (typeof rteCopyPlain === 'function') rteCopyPlain();
    return;
  }

  // Canvas actions
  if (actionType === 'set-canvas-color') {
    const color = action.dataset.color;
    if (typeof setCanvasColor === 'function') setCanvasColor(action, color);
    return;
  }
  if (actionType === 'set-canvas-size') {
    const size = parseInt(action.dataset.size);
    if (typeof setCanvasSize === 'function') setCanvasSize(action, size);
    return;
  }
  if (actionType === 'set-canvas-tool') {
    const tool = action.dataset.tool;
    if (typeof setCanvasTool === 'function') setCanvasTool(action, tool);
    return;
  }
  if (actionType === 'toggle-canvas-eraser') {
    if (typeof toggleCanvasEraser === 'function') toggleCanvasEraser();
    return;
  }
  if (actionType === 'undo-canvas') {
    if (typeof undoCanvas === 'function') undoCanvas();
    return;
  }
  if (actionType === 'clear-canvas') {
    if (typeof clearCanvas === 'function') clearCanvas();
    return;
  }
  if (actionType === 'save-canvas-and-close') {
    if (typeof saveCanvasAndClose === 'function') saveCanvasAndClose();
    return;
  }

  // Folder modal actions
  if (actionType === 'select-folder-icon') {
    if (typeof selectFolderIcon === 'function') selectFolderIcon(action);
    return;
  }
  if (actionType === 'select-folder-color') {
    if (typeof selectFolderColor === 'function') selectFolderColor(action);
    return;
  }
  if (actionType === 'save-new-folder') {
    if (typeof saveNewFolder === 'function') saveNewFolder();
    return;
  }

  // Lightbox
  if (actionType === 'close-lightbox') {
    if (typeof closeLightbox === 'function') closeLightbox();
    return;
  }

  // Scanner
  if (actionType === 'cancel-scan') {
    if (typeof cancelScan === 'function') cancelScan();
    return;
  }

  // Generic modal close
  if (actionType === 'close-modal') {
    const target = action.dataset.target;
    if (target && typeof closeModal === 'function') closeModal(target);
    return;
  }

  // Generic modal open
  if (actionType === 'open-modal') {
    const target = action.dataset.target;
    if (target && typeof openModal === 'function') openModal(target);
    return;
  }

  // Notes search - render results
  if (actionType === 'render-notes-search-results') {
    if (typeof renderNotesSearchResults === 'function') renderNotesSearchResults();
    return;
  }
});

// Handle input/change events for file inputs and RTE
document.addEventListener('change', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  // File inputs
  if (actionType === 'handle-import-file') {
    if (typeof handleImportFile === 'function') handleImportFile(action);
    return;
  }
  if (actionType === 'scan-document') {
    if (typeof scanDocumentFiles === 'function') scanDocumentFiles(action.files);
    action.value = '';
    return;
  }
  if (actionType === 'attach-images') {
    if (typeof attachImagesToNote === 'function') attachImagesToNote(action.files);
    action.value = '';
    return;
  }
  if (actionType === 'load-pdf') {
    if (typeof loadPDFIntoNotes === 'function' && action.files[0]) loadPDFIntoNotes(action.files[0]);
    action.value = '';
    return;
  }
  if (actionType === 'paste-image-canvas') {
    if (typeof _pasteImageToCanvas === 'function' && action.files[0]) _pasteImageToCanvas(action.files[0], 50, 50);
    action.value = '';
    return;
  }

  // Selects
  if (actionType === 'render-notes-page') {
    if (typeof renderNotesPage === 'function') renderNotesPage();
    return;
  }
  if (actionType === 'note-folder-change') {
    if (typeof onNoteFolderChange === 'function') onNoteFolderChange();
    return;
  }
  if (actionType === 'note-mat-change') {
    if (typeof onNoteMatChange === 'function') onNoteMatChange();
    return;
  }
  if (actionType === 'rte-apply-heading') {
    if (typeof rteApplyHeading === 'function') rteApplyHeading(action.value);
    return;
  }
  if (actionType === 'pom-settings-change') {
    if (typeof pomReset === 'function') pomReset();
    return;
  }
  if (actionType === 'load-local-music') {
    if (typeof loadLocalMusic === 'function') loadLocalMusic(action);
    return;
  }
});

// Handle input events
document.addEventListener('input', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  if (actionType === 'notes-title-input') {
    if (typeof onNotesTitleInput === 'function') onNotesTitleInput();
    return;
  }
  if (actionType === 'note-tags-input') {
    if (typeof onNoteTagsInput === 'function') onNoteTagsInput();
    return;
  }
  if (actionType === 'rte-input') {
    if (typeof onRteInput === 'function') onRteInput();
    return;
  }
  if (actionType === 'notes-input') {
    if (typeof onNotesInput === 'function') onNotesInput();
    return;
  }
  if (actionType === 'render-pom-goal') {
    if (typeof renderPomGoal === 'function') renderPomGoal();
    return;
  }
  if (actionType === 'set-noise-vol') {
    if (typeof setNoiseVol === 'function') setNoiseVol(action.value);
    return;
  }
  if (actionType === 'set-pom-vol') {
    if (typeof setPomVol === 'function') setPomVol(action.value);
    return;
  }
});

// Handle keydown events
document.addEventListener('keydown', (e) => {
  const action = e.target.closest('[data-keydown-action]');
  if (!action) return;

  const actionType = action.dataset.keydownAction;

  if (actionType === 'rte-keydown') {
    if (typeof onRteKeydown === 'function') onRteKeydown(e);
    return;
  }
});

// Handle mouseup/keyup for toolbar updates
document.addEventListener('mouseup', (e) => {
  const action = e.target.closest('[data-mouseup-action]');
  if (!action) return;

  if (action.dataset.mouseupAction === 'rte-update-toolbar') {
    if (typeof rteUpdateToolbarState === 'function') rteUpdateToolbarState();
  }
});

document.addEventListener('keyup', (e) => {
  const action = e.target.closest('[data-keyup-action]');
  if (!action) return;

  if (action.dataset.keyupAction === 'rte-update-toolbar') {
    if (typeof rteUpdateToolbarState === 'function') rteUpdateToolbarState();
  }
});

// ── Notes grid refresh hook — moved inline into renderNotesList to avoid hoisting loop ──

// ── Pub/Sub Subscription for Reactivity ───────────────────────────────
// Suscribirse a cambios en notas para re-renderizado granular
if (typeof window.subscribe === 'function') {
  const unsubscribeNotes = window.subscribe('notes', (data) => {
    console.log('[NOTES] Received update notification:', data);
    if (data.type === 'update' && data.note) {
      // Actualizar solo la nota específica en el DOM si existe
      const noteEl = document.getElementById(`note-card-${data.note.id}`);
      if (noteEl) {
        // Re-renderizar solo esta nota
        const notes = _getNotesArray();
        const updatedNote = notes.find(n => n.id === data.note.id);
        if (updatedNote) {
          // Actualizar contenido del DOM sin reconstruir todo
          const titleEl = noteEl.querySelector('.note-title');
          if (titleEl) titleEl.textContent = updatedNote.title || 'Sin título';
          const previewEl = noteEl.querySelector('.note-preview');
          if (previewEl) {
            const preview = (updatedNote.content || '').replace(/\n/g,' ').slice(0,50) || 'Sin contenido';
            previewEl.textContent = preview;
          }
        }
      } else {
        // Si no existe el elemento, re-renderizar la lista completa
        renderNotesList();
      }
    } else if (data.type === 'delete' && data.noteId) {
      // Eliminar nota del DOM
      const noteEl = document.getElementById(`note-card-${data.noteId}`);
      if (noteEl) noteEl.remove();
    } else {
      // Para otros cambios, re-renderizar la lista completa
      renderNotesList();
    }
  });
}
