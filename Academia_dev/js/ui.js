
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

function _renderOverview() {
  const pending = State.tasks.filter(t => !t.done);
  const overall = calcOverallGPA();

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

  const urgentCount = pending.filter(t => t.due && (new Date(t.due)-new Date())/86400000 <= 2 && (new Date(t.due)-new Date())/86400000 >= 0).length;
  const profileSub  = State.settings?.profile?.carrera ? ` · ${State.settings.profile.carrera}` : '';
  const subEl = _el('ov-sub');
  if (subEl) subEl.textContent =
    urgentCount > 0 ? `⚡ ${urgentCount} tarea(s) vencen en menos de 2 días`
    : pending.length > 0 ? `${pending.length} tarea(s) pendiente(s)${profileSub}`
    : `¡Sin pendientes! 🎉${profileSub}`;

  const badge = _el('ov-pending-badge');
  if (badge) badge.textContent = pending.length > 0 ? `${pending.length} sin entregar` : '';

  // ── Agenda Semanal Rodante (7 días desde hoy) ─────────────
  const stripEl = document.getElementById('ov-day-strip');
  if (stripEl) {
    const today = new Date(); today.setHours(0,0,0,0);
    const daysFull   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

    stripEl.innerHTML = '<div class="agenda-strip">' + Array.from({length:7}, (_, i) => {
      const d    = new Date(today); d.setDate(today.getDate() + i);
      const dStr = d.toISOString().slice(0,10);
      const isToday    = i === 0;
      const isSelected = ovFilterDay === dStr;

      const dayTasks  = State.tasks.filter(t => !t.done && t.due === dStr);
      const dayEvents = (State.events || []).filter(e => (e.date || e.start || '').slice(0,10) === dStr);
      const matIds    = [...new Set(dayTasks.map(t => t.matId))];
      const dots      = matIds.slice(0,5).map(mid => {
        const m = getMat(mid);
        return '<div class="agenda-dot" style="background:' + (m.color||'var(--accent)') + ';" title="' + (m.name||'') + '"></div>';
      }).join('');
      const extraDots  = matIds.length > 5 ? '<div class="agenda-dot-more">+' + (matIds.length-5) + '</div>' : '';
      const totalCount = dayTasks.length + dayEvents.length;

      return '<div class="agenda-day-card' + (isToday?' today':'') + (isSelected?' selected':'') + '" onclick="ovSetDayFilter(\'' + dStr + '\')" style="position:relative;" title="' + (isToday?'Hoy · ':'') + d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}) + '">'
        + '<div class="adc-dayname">' + daysFull[d.getDay()] + '</div>'
        + '<div class="adc-daynum">'  + d.getDate() + '</div>'
        + '<div class="adc-month">'   + monthNames[d.getMonth()] + '</div>'
        + '<div class="adc-dots">'    + dots + extraDots + '</div>'
        + (totalCount > 0 ? '<div class="adc-count" style="position:absolute;top:6px;right:6px;min-width:18px;height:18px;background:#f87171;color:#fff;border-radius:9px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.4);">' + totalCount + '</div>' : '')
        + (isToday ? '<div class="adc-today-label">HOY</div>' : '')
        + '</div>';
    }).join('') + '</div>';
  }

  // ── Label de filtro activo ────────────────────────────────
  const filterLbl      = document.getElementById('ov-agenda-filter-label');
  const clearFilterBtn = document.getElementById('ov-clear-filter-btn');
  if (ovFilterDay) {
    const fd = new Date(ovFilterDay + 'T00:00:00');
    if (filterLbl)      filterLbl.textContent       = '📌 ' + fd.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    if (clearFilterBtn) clearFilterBtn.style.display = '';
  } else {
    if (filterLbl)      filterLbl.textContent        = '';
    if (clearFilterBtn) clearFilterBtn.style.display = 'none';
  }

  // ── Panel de Tareas ───────────────────────────────────────
  const tl = _el('ov-tasks-list');
  if (!tl) return;
  const today2 = new Date(); today2.setHours(0,0,0,0);

  let taskPool = ovFilterDay
    ? pending.filter(t => t.due === ovFilterDay || t.datePlanned === ovFilterDay)
    : pending;

  // Eventos ordenados por fecha
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
      ? '<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-size:14px;font-weight:700;">Sin tareas para este día</div><button class="btn btn-ghost btn-sm" style="margin-top:12px;" onclick="ovClearDayFilter()">Ver todas las pendientes</button></div>'
      : '<div style="text-align:center;padding:40px;color:var(--text3);"><div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-size:14px;font-weight:700;">¡Sin tareas pendientes!</div><div style="font-size:12px;margin-top:4px;color:var(--text3);">Siga adelante, Ingeniero 🎓</div></div>';
    return;
  }

  // Fondo + badge con el MISMO color según días restantes
  const _RED    = { bg:'rgba(248,113,113,.22)', border:'#f87171', color:'#fff',    badgeBg:'rgba(248,113,113,.85)', textBg:'#f87171' };
  const _YELLOW = { bg:'rgba(251,191,36,.18)',  border:'#fbbf24', color:'#1a1a1a', badgeBg:'rgba(251,191,36,.88)',  textBg:'#fbbf24' };
  const _GREEN  = { bg:'rgba(74,222,128,.15)',  border:'#4ade80', color:'#fff',    badgeBg:'rgba(74,222,128,.80)',  textBg:'#4ade80' };
  const _NONE   = { bg:'',                      border:'',        color:'var(--text3)', badgeBg:'rgba(255,255,255,.10)', textBg:'transparent' };

  function _palette(dl) {
    if (dl === null) return _NONE;
    if (dl <= 3)     return _RED;
    if (dl <= 6)     return _YELLOW;
    return                  _GREEN;
  }

  function _badgeText(dl) {
    if (dl === null)  return 'Sin fecha';
    if (dl < 0)       return 'Venció hace ' + (-dl) + 'd';
    if (dl === 0)     return 'Vence hoy';
    if (dl === 1)     return 'Falta 1 día';
    return                   'Faltan ' + dl + ' días';
  }

  const sortByDue = arr => [...arr].sort((a,b) => {
    const da = a.due||'9999-12-31', db = b.due||'9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Agrupar por materia
  const grouped    = {};
  const noMatTasks = [];
  taskPool.forEach(t => {
    const m = getMat(t.matId);
    if (!m || !m.id) { noMatTasks.push(t); return; }
    if (!grouped[m.id]) grouped[m.id] = { mat: m, tasks: [] };
    grouped[m.id].tasks.push(t);
  });

  function _taskHtml(t) {
    const m        = getMat(t.matId);
    const dueD     = t.due ? new Date(t.due + 'T00:00:00') : null;
    const daysLeft = dueD  ? Math.ceil((dueD - today2) / 86400000) : null;
    const pal      = _palette(daysLeft);
    const bgStyle  = pal.border
      ? 'background:' + pal.bg + ';border-left:4px solid ' + pal.border + ';'
      : 'border-left:4px solid var(--border2);';
    const badgeStyle = 'display:inline-flex;align-items:center;gap:5px;background:' + pal.badgeBg + ';color:' + pal.color + ';border-radius:10px;font-size:12px;font-weight:800;padding:6px 14px;white-space:nowrap;letter-spacing:.3px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.25);';
    const prog       = subtaskProgress(t);
    const dueTimeStr = t.dueTime ? ' \u00b7 \u23f0 ' + t.dueTime : '';
    const planStr    = t.datePlanned
      ? '<span style="font-size:12px;color:var(--text3);">\ud83d\udccb ' + fmtD(t.datePlanned) + (t.timePlanned?' '+t.timePlanned:'') + '</span>'
      : '';
    const prioClass  = t.priority === 'high'||t.priority === 'alta' ? 'prio-alta'
                     : t.priority === 'low' ||t.priority === 'baja' ? 'prio-baja'
                     : t.priority ? 'prio-media' : 'prio-none';
    const mc   = m ? (m.color||'#7c6aff') : '#7c6aff';
    const type = (t.type||'TAREA').toUpperCase();
    const urgIcon = daysLeft === null ? '\ud83d\udccc' : daysLeft <= 0 ? '\ud83d\udd34' : daysLeft <= 3 ? '\ud83d\udfe0' : daysLeft <= 6 ? '\ud83d\udfe1' : '\ud83d\udfe2';
    return '<div class="mc-task-item ov-task-row ' + prioClass + '" onclick="openTaskDetail(\'' + t.id + '\')" style="cursor:pointer;' + bgStyle + '">'
      + '<div class="mc-task-info" style="flex:1;min-width:0;">'
      + '<div class="mc-task-title" style="font-size:15px;font-weight:700;margin-bottom:7px;line-height:1.3;color:var(--text);">' + t.title + '</div>'
      + '<div class="mc-task-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="background:' + mc + '33;color:' + mc + ';border:1px solid ' + mc + '55;border-radius:7px;padding:3px 10px;font-size:12px;font-weight:800;letter-spacing:.5px;">' + type + '</span>'
      + (t.due ? '<span style="font-family:\'Space Mono\',monospace;font-size:13px;font-weight:600;color:var(--text2);">\ud83d\udcc5 ' + fmtD(t.due) + dueTimeStr + '</span>' : '')
      + planStr
      + (prog ? '<span style="font-size:12px;color:var(--text3);">\ud83d\udcce ' + prog.done + '/' + prog.total + ' sub.</span>' : '')
      + '</div></div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">'
      + '<span style="' + badgeStyle + '">' + urgIcon + ' ' + _badgeText(daysLeft) + '</span>'
      + '</div>'
      + '</div>';
  }

  let html = '';

  // 1. Sin materia
  if (noMatTasks.length) html += sortByDue(noMatTasks).map(_taskHtml).join('');

  // 2. Grupos por materia (estilo Moodle)
  Object.values(grouped).forEach(({ mat, tasks }) => {
    const cnt = tasks.length;
    const mc  = mat.color || 'var(--accent)';
    html += '<div style="padding:10px 16px 6px;display:flex;align-items:center;gap:10px;border-top:1px solid var(--border);border-left:4px solid ' + mc + ';background:rgba(255,255,255,.03);">'
      + '<span style="font-size:16px;line-height:1;">' + (mat.icon||'📚') + '</span>'
      + '<span style="font-size:14px;font-weight:800;color:var(--text);letter-spacing:-.2px;">' + mat.name + '</span>'
      + (mat.code ? '<span style="font-size:10px;font-family:\'Space Mono\',monospace;color:var(--text3);background:var(--surface2);padding:2px 7px;border-radius:5px;">' + mat.code + '</span>' : '')
      + '<span style="font-size:11px;color:var(--text3);margin-left:auto;background:var(--surface2);padding:2px 9px;border-radius:20px;">' + cnt + ' pendiente' + (cnt!==1?'s':'') + '</span>'
      + '</div>';
    html += sortByDue(tasks).map(_taskHtml).join('');
  });

  // 3. Eventos (fondo azul, al final)
  if (allEvents.length) {
    html += '<div style="padding:8px 16px 4px;display:flex;align-items:center;gap:8px;border-top:1px solid var(--border);">'
      + '<span style="font-size:15px;font-weight:800;color:#60a5fa;">📅 Eventos</span>'
      + '<span style="font-size:10px;color:var(--text3);margin-left:auto;">' + allEvents.length + ' próximo' + (allEvents.length!==1?'s':'') + '</span>'
      + '</div>';
    allEvents.forEach(ev => {
      const evMat  = ev.matId ? getMat(ev.matId) : null;
      const evDate = (ev.date||ev.start||'').slice(0,10);
      html += '<div class="mc-task-item" style="cursor:pointer;background:rgba(96,165,250,.13);border-left:3px solid #60a5fa;">'
        + '<div class="mc-task-info">'
        + '<div class="mc-task-title">📅 ' + (ev.title||'Evento') + '</div>'
        + '<div class="mc-task-meta">'
        + (evMat ? '<span style="background:' + (evMat.color||'#60a5fa') + '22;color:' + (evMat.color||'#60a5fa') + ';border:1px solid ' + (evMat.color||'#60a5fa') + '44;border-radius:5px;padding:1px 7px;font-size:10px;font-weight:700;">' + (evMat.code||evMat.name) + '</span>' : '')
        + (evDate ? '<span style="font-family:\'Space Mono\',monospace;">' + fmtD(evDate) + '</span>' : '')
        + (ev.time ? '<span>⏰ ' + ev.time + '</span>' : '')
        + (ev.type ? '<span>' + ev.type + '</span>' : '')
        + '</div></div>'
        + '<span class="urgency-badge" style="background:rgba(96,165,250,.2);color:#60a5fa;border-color:#60a5fa44;">Evento</span>'
        + '</div>';
    });
  }

  tl.innerHTML = html;
}

// ── Inject responsive styles for overview task panel (runs once) ──────────
(function _injectOvTaskStyles() {
  if (document.getElementById('ov-task-responsive-css')) return;
  const s = document.createElement('style');
  s.id = 'ov-task-responsive-css';
  s.textContent = `
    /* Overview task rows — base */
    .ov-task-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      transition: background .15s;
    }
    .ov-task-row:hover { filter: brightness(1.07); }
    .ov-task-row .mc-task-info { flex: 1; min-width: 0; }

    /* Mobile: badge wraps below title */
    @media (max-width: 540px) {
      .ov-task-row {
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px 14px;
      }
      .ov-task-row .mc-task-info {
        width: 100%;
      }
      .ov-task-row > div:last-child {
        width: 100%;
        align-items: flex-start !important;
      }
      .ov-task-row .mc-task-title {
        font-size: 14px !important;
      }
    }
  `;
  document.head.appendChild(s);
})();
