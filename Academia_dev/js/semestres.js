
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
<div class="footer">Academia · academia.app</div>
<script>window.onload=()=>{window.print();}<\/script>
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
