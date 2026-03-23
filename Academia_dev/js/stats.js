
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
