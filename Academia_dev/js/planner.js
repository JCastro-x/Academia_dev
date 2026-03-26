// ═══════════════════════════════════════════════════════════════
// PLANNER.JS v3 — Planificador Inteligente
// ═══════════════════════════════════════════════════════════════

const PLANNER = (() => {
  'use strict';

  const MAX_DAILY_MIN  = 4 * 60;
  const NEW_TOPIC_MIN  = 50;
  const EXAM_BUFFER    = 2;
  const EXAM_WARN_DAYS = 3;
  // minutos de repaso según dificultad del subtema
  const REVIEW_MINS = { easy: 15, normal: 20, hard: 40 };

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const addDays  = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const fmtShort = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' }) : '';
  const fmtMed   = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }) : '';

  // ── Fechas de examen ──────────────────────────────────────────
  const examKey = (matId, parcial) => `${matId}__${parcial}`;

  function getExamDate(matId, parcial) {
    const sem = State._activeSem;
    if (!sem.examDates) sem.examDates = {};
    return sem.examDates[examKey(matId, parcial)] || null;
  }

  function setExamDate(matId, parcial, date) {
    const sem = State._activeSem;
    if (!sem.examDates) sem.examDates = {};
    if (date) sem.examDates[examKey(matId, parcial)] = date;
    else delete sem.examDates[examKey(matId, parcial)];
    saveState(['semestres']);
    _checkExamWarnings();
    _refreshAll();
  }

  // ── Carga real de un día ──────────────────────────────────────
  function getDayMinutes(dateStr) {
    let total = 0;
    // Evitar doble conteo: si una tarea tiene datePlanned Y plannedWorkDates,
    // priorizar datePlanned (timeEst) y no contarla de nuevo por plannedWorkDates
    State.tasks.filter(t => !t.done && t.datePlanned === dateStr)
      .forEach(t => { total += t.timeEst || 60; });
    State.tasks.filter(t => !t.done && t.datePlanned !== dateStr && (t.plannedWorkDates || []).includes(dateStr))
      .forEach(t => { total += Math.round((t.estHoursPerDay || 1) * 60); });
    State.topics.forEach(topic => {
      (topic.reviewSchedule || []).forEach(r => {
        if (r.date === dateStr && !r.done && r.status === 'pending')
          total += r.minutes || REVIEW_MINS[topic.difficulty || 'normal'];
      });
    });
    State.topics.filter(t => t.dateAdded === dateStr)
      .forEach(t => { total += t.estMinutes || NEW_TOPIC_MIN; });
    return total;
  }

  function loadBar(dateStr) {
    const mins = getDayMinutes(dateStr);
    const pct  = Math.min(100, Math.round(mins / MAX_DAILY_MIN * 100));
    const clr  = pct >= 100 ? '#f87171' : pct >= 75 ? '#fbbf24' : pct >= 40 ? '#60a5fa' : '#4ade80';
    return { mins, pct, color: clr, label: `${(mins / 60).toFixed(1)}h / 4h` };
  }

  // ── Encontrar mejor hueco ─────────────────────────────────────
  function findBestSlot(windowStart, windowEnd, durationMin) {
    const today   = todayStr();
    const slots   = [];
    let   current = windowStart < today ? today : windowStart;
    if (windowEnd < current) return current;
    while (current <= windowEnd) {
      const load = getDayMinutes(current);
      slots.push({ date: current, load, available: MAX_DAILY_MIN - load });
      current = addDays(current, 1);
    }
    const viable = slots.filter(s => s.available >= durationMin);
    if (!viable.length) return slots.sort((a, b) => a.load - b.load)[0]?.date || windowStart;
    viable.sort((a, b) => a.load - b.load);
    return viable[0].date;
  }

  function getReviewMins(topic) {
    return REVIEW_MINS[topic.difficulty || 'normal'];
  }

  // ── Algoritmo: R1 hoy+1..hoy+3; R2/R3 en bloques ─────────────
  function generateSmartReviews(topic) {
    const today    = todayStr();
    const examDate = getExamDate(topic.matId, topic.parcial);
    const mins     = getReviewMins(topic);
    const reviews  = [];

    // R1 — primer hueco entre mañana y hoy+3
    const r1Date = findBestSlot(addDays(today, 1), addDays(today, 3), mins);
    const lb1 = loadBar(r1Date);
    reviews.push({ date: r1Date, done: false, status: lb1.pct >= 100 ? 'low-priority' : 'pending', minutes: mins, num: 1 });

    // Ventana restante para R2/R3
    const winStart  = addDays(r1Date, 1);
    const winEnd    = examDate ? addDays(examDate, -EXAM_BUFFER) : addDays(today, 21);
    const remaining = diffDays(winStart, winEnd);
    if (remaining <= 0) return reviews;

    const numExtra = topic.difficulty === 'hard' ? 2 : 1;
    for (let i = 0; i < numExtra; i++) {
      const segStart = addDays(winStart, Math.floor((remaining / numExtra) * i));
      const segEnd   = addDays(winStart, Math.floor((remaining / numExtra) * (i + 1)) - 1);
      const best     = findBestSlot(segStart, segEnd, mins);
      const lb       = loadBar(best);
      reviews.push({ date: best, done: false, status: lb.pct >= 100 ? 'low-priority' : 'pending', minutes: mins, num: i + 2 });
    }
    return reviews;
  }

  // ── Distribuir fechas de trabajo de tarea ─────────────────────
  function planTaskDates(task) {
    if (!task.due || !task.estDays || !task.estHoursPerDay) return [];
    const minsPerDay = Math.round(task.estHoursPerDay * 60);
    const today      = todayStr();
    const dates      = [];
    for (let i = 0; i < task.estDays; i++) {
      const ideal = addDays(task.due, -(1 + i));
      if (ideal < today) break;
      const rangeStart = addDays(ideal, -2) < today ? today : addDays(ideal, -2);
      const best = findBestSlot(rangeStart, addDays(ideal, 2), minsPerDay);
      if (best >= today) dates.push(best);
    }
    return [...new Set(dates)].sort();
  }

  // ── Algoritmo de Supervivencia ────────────────────────────────
  // Recolecta repasos vencidos y sobrecargados, los ordena por
  // examen más próximo (prioridad de asiento) y distribuye desde mañana.
  function rescheduleAll() {
    const today    = todayStr();
    const tomorrow = addDays(today, 1);
    const moved    = [];
    const stuck    = [];

    const pending = [];
    State.topics.forEach(topic => {
      const examDate = getExamDate(topic.matId, topic.parcial);
      (topic.reviewSchedule || []).forEach((review, idx) => {
        if (review.done || review.status === 'skipped') return;
        const isPast     = review.date < today;
        const overloaded = getDayMinutes(review.date) > MAX_DAILY_MIN;
        if (!isPast && !overloaded) return;
        const daysToExam = examDate ? diffDays(today, examDate) : 999;
        pending.push({ topic, review, idx, examDate, daysToExam });
      });
    });

    // Prioridad: examen más cercano primero
    pending.sort((a, b) => a.daysToExam - b.daysToExam);

    pending.forEach(({ topic, review, examDate }) => {
      const revMins = review.minutes || getReviewMins(topic);
      const maxDate = examDate ? addDays(examDate, -1) : addDays(today, 14);
      let placed    = false;
      let candidate = tomorrow;
      while (candidate <= maxDate) {
        if (getDayMinutes(candidate) + revMins <= MAX_DAILY_MIN) {
          const old        = review.date;
          review.date      = candidate;
          review.status    = 'pending';
          review.movedFrom = old;
          moved.push({ topic: topic.name, from: old, to: candidate });
          placed = true;
          break;
        }
        candidate = addDays(candidate, 1);
      }
      if (!placed) {
        review.status = 'low-priority';
        stuck.push(topic.name);
      }
    });

    const changed = moved.length > 0 || stuck.length > 0;
    if (changed) saveState(['topics']);
    console.log(`[PLANNER] Reagendado: ${moved.length} movidos, ${stuck.length} sin espacio`, { moved, stuck });
    return { moved, stuck };
  }

  // ── Plan del día ──────────────────────────────────────────────
  function getDailyPlan(dateStr) {
    const plan = {
      date: dateStr,
      newTopics: [], reviews: [], tasks: [],
      totalMinutes: 0,
      overdueMinutes: 0,
      hasOverflow: false,
    };
    const today = todayStr();

    // ── Temas nuevos: sólo si dateAdded === dateStr
    //    Y no tienen repasos ya generados (si los tienen = ya fueron procesados,
    //    sus repasos aparecerán en sus fechas correspondientes)
    State.topics.filter(t => {
      if (t.dateAdded !== dateStr) return false;
      const hasReviews = (t.reviewSchedule || []).length > 0;
      return !hasReviews;
    }).forEach(t => {
      const m    = getMat(t.matId);
      const mins = t.estMinutes || NEW_TOPIC_MIN;
      plan.newTopics.push({ id: t.id, name: t.name, parcial: t.parcial,
        matName: m.name || '—', matIcon: m.icon || '📚',
        matColor: m.color || 'var(--accent)', minutes: mins });
      plan.totalMinutes += mins;
    });

    // ── Repasos: sólo si r.date === dateStr (nunca futuros) ──────
    State.topics.forEach(topic => {
      (topic.reviewSchedule || []).forEach((r, idx) => {
        if (r.done || r.date !== dateStr) return;
        const m = getMat(topic.matId);
        plan.reviews.push({ topicId: topic.id, reviewIdx: idx, name: topic.name,
          difficulty: topic.difficulty || 'normal', matName: m.name || '—',
          matIcon: m.icon || '📚', matColor: m.color || 'var(--accent)',
          minutes: r.minutes || 20, status: r.status, num: r.num || 1 });
        if (r.status !== 'low-priority') plan.totalMinutes += (r.minutes || 20);
      });
    });

    // ── Tareas:
    //    a) datePlanned === dateStr
    //    b) plannedWorkDates incluye dateStr
    //    c) Si dateStr === today: tareas con due <= today (atrasadas) ──
    const seen = new Set();
    State.tasks
      .filter(t => {
        if (t.done) return false;
        if (t.datePlanned === dateStr) return true;
        if ((t.plannedWorkDates || []).includes(dateStr)) return true;
        if (dateStr === today && t.due && t.due < today) return true;
        return false;
      })
      .forEach(t => {
        if (seen.has(t.id)) return;
        seen.add(t.id);
        const m         = getMat(t.matId);
        // Si tiene datePlanned para este día, usar timeEst; si solo está en plannedWorkDates, usar estHoursPerDay
        const mins      = t.datePlanned === dateStr
          ? (t.timeEst || 60)
          : Math.round((t.estHoursPerDay || 1) * 60);
        const isOverdue = !!(t.due && t.due < today && dateStr === today);
        plan.tasks.push({ id: t.id, title: t.title, due: t.due, priority: t.priority,
          matName: m.name || '—', matIcon: m.icon || '📚',
          matColor: m.color || 'var(--accent)', minutes: mins, isOverdue });
        plan.totalMinutes += mins;
        if (isOverdue) plan.overdueMinutes += mins;
      });

    // Urgentes primero, luego por prioridad
    plan.tasks.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const p = { high: 0, med: 1, low: 2 };
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
    });

    plan.hasOverflow = plan.totalMinutes > MAX_DAILY_MIN;
    return plan;
  }

  // ── Avisos de examen ──────────────────────────────────────────
  function _checkExamWarnings() {
    const today = todayStr();
    const sem   = State._activeSem;
    if (!sem.examDates) return;
    Object.entries(sem.examDates).forEach(([key, date]) => {
      if (!date) return;
      const days = diffDays(today, date);
      if (days <= 0 || days > EXAM_WARN_DAYS) return;
      const [matId, parcial] = key.split('__');
      const mat   = getMat(matId);
      const label = days === 1 ? '!Manana!' : `En ${days} dias`;
      _plannerToast(`Examen ${mat.icon || ''} ${mat.name || matId} - ${label}`, 'warning');
      _pushNotify(`Examen proximo: ${mat.name || matId}`, `${label} - Parcial ${parcial}`);
    });
  }

  // ── Acciones ──────────────────────────────────────────────────
  function markReviewDone(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].done   = true;
    topic.reviewSchedule[reviewIdx].status = 'done';
    saveState(['topics']);
    _refreshAll();
    _plannerToast('Repaso completado!', 'ok');
  }

  function markReviewSkip(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].status = 'skipped';
    saveState(['topics']);
    _refreshAll();
  }

  function _refreshAll() {
    renderDailyPlan();
    renderReviewQueue();
    renderPlannerTimeline();
  }

  function _pushNotify(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker?.ready
        .then(sw => sw.showNotification(title, { body,
          icon: '/assets/icons/icon-192.png',
          badge: '/assets/icons/icon-32.png',
          tag: 'planner-' + Date.now(), data: { url: '/index.html' } }))
        .catch(() => { try { new Notification(title, { body }); } catch(e) {} });
    }
  }

  function _plannerToast(msg, type) {
    let el = document.getElementById('planner-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'planner-toast';
      el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);' +
        'background:var(--surface);border-radius:12px;font-size:13px;font-weight:700;z-index:4000;' +
        'box-shadow:0 4px 24px rgba(0,0,0,.5);max-width:92vw;text-align:center;' +
        'transition:opacity .3s;display:none;padding:10px 20px;';
      document.body.appendChild(el);
    }
    const colors = { ok: 'var(--accent)', warning: '#fbbf24', error: '#f87171' };
    el.style.border  = `2px solid ${colors[type || 'ok']}`;
    el.style.color   = 'var(--text)';
    el.textContent   = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 350);
    }, 4000);
  }

  return {
    todayStr, addDays, diffDays, fmtShort, fmtMed,
    getExamDate, setExamDate, getReviewMins,
    getDayMinutes, loadBar, findBestSlot,
    generateSmartReviews, planTaskDates,
    rescheduleAll, getDailyPlan,
    markReviewDone, markReviewSkip,
    _refreshAll, _pushNotify, _plannerToast, _checkExamWarnings,
    MAX_DAILY_MIN, NEW_TOPIC_MIN, REVIEW_MINS,
  };
})();

// ═══════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════

function renderPlannerTimeline() {
  const container = document.getElementById('planner-timeline');
  if (!container) return;
  const today     = PLANNER.todayStr();
  const days      = Array.from({ length: 14 }, (_, i) => PLANNER.addDays(today, i));
  const examDates = State._activeSem.examDates || {};

  container.innerHTML = `
    <div class="ptl-wrap">
      ${days.map(d => {
        const lb      = PLANNER.loadBar(d);
        const isToday = d === today;
        const dayNum  = new Date(d + 'T00:00:00').getDate();
        const dayName = new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short' }).slice(0, 2);
        const hasExam = Object.values(examDates).includes(d);
        const revN    = State.topics.reduce((a, t) => a + (t.reviewSchedule||[]).filter(r=>r.date===d&&!r.done).length, 0);
        const taskN   = State.tasks.filter(t => !t.done && (t.datePlanned===d||(t.plannedWorkDates||[]).includes(d))).length;
        return `<div class="ptl-day${isToday?' ptl-today':''}" title="${PLANNER.fmtMed(d)} - ${lb.label}">
          <div class="ptl-exams">${hasExam ? '📝' : ''}</div>
          <div class="ptl-bar-wrap"><div class="ptl-bar" style="height:${lb.pct}%;background:${lb.color};"></div></div>
          <div class="ptl-indicators">
            ${revN  > 0 ? `<span style="font-size:9px;" title="${revN} repaso(s)">🔁</span>` : ''}
            ${taskN > 0 ? `<span style="font-size:9px;" title="${taskN} tarea(s)">✅</span>` : ''}
          </div>
          <div class="ptl-load-txt" style="color:${lb.color};">${lb.pct>=8?lb.pct+'%':''}</div>
          <div class="ptl-daynum" style="${isToday?'color:var(--accent2);font-weight:800;':''}">${dayNum}</div>
          <div class="ptl-dayname" style="${isToday?'color:var(--accent2);':''}">${dayName}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:7px;flex-wrap:wrap;">
      ${[['#4ade80','Libre'],['#60a5fa','Moderado'],['#fbbf24','Ocupado'],['#f87171','Lleno']].map(([c,l]) =>
        `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:2px;background:${c};display:inline-block;"></span>${l}</span>`
      ).join('')}
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">📝=examen 🔁=repaso ✅=tarea</span>
    </div>`;
}

// ── Plan del Día — reactivo al día seleccionado ───────────────
let _plannerActiveDate = null;
// Track qué secciones están abiertas (persistir entre re-renders)
const _pdSectOpen = { tasks: true, reviews: true, topics: true };

function renderDailyPlan(dateStr) {
  // Siempre usar hoy como default; nunca mostrar fecha equivocada
  const today     = PLANNER.todayStr();
  const target    = dateStr || _plannerActiveDate || today;
  if (dateStr) _plannerActiveDate = dateStr;       // guardar el día activo
  else if (!_plannerActiveDate) _plannerActiveDate = today;

  const container = document.getElementById('planner-daily-plan');
  if (!container) return;

  const plan      = PLANNER.getDailyPlan(target);
  const lb        = PLANNER.loadBar(target);
  const isToday   = target === today;
  const dateLabel = isToday ? 'Hoy' : PLANNER.fmtShort(target);
  const empty     = !plan.newTopics.length && !plan.reviews.length && !plan.tasks.length;

  if (empty) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:6px;">🎉</div>
      <div style="font-size:13px;font-weight:700;color:var(--text2);">${dateLabel} sin pendientes</div>
    </div>`;
    return;
  }

  // ── Encabezado con barra ─────────────────────────────────────
  let html = `<div style="padding:10px 14px 6px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
      <span style="font-size:11px;color:var(--text2);font-weight:700;">${dateLabel}</span>
      <span style="font-size:12px;font-weight:800;color:${lb.color};font-family:'Space Mono',monospace;">${lb.label}${lb.pct>=100?' ⚠️':''}</span>
    </div>
    <div class="prog-bar" style="height:6px;">
      <div class="prog-fill" style="background:${lb.color};width:${Math.min(lb.pct,100)}%;border-radius:3px;transition:width .4s;"></div>
    </div>`;

  if (plan.hasOverflow) {
    const overH = ((plan.totalMinutes - PLANNER.MAX_DAILY_MIN) / 60).toFixed(1);
    const msg = plan.overdueMinutes > 0
      ? `⚠️ +${overH}h de tareas atrasadas · Usa <strong>Reagendar</strong> para mover repasos`
      : `⚠️ +${overH}h extra hoy · Usa <strong>Reagendar</strong> para redistribuir`;
    html += `<div style="margin-top:6px;padding:6px 10px;background:rgba(248,113,113,.1);
      border:1px solid rgba(248,113,113,.3);border-radius:7px;font-size:11px;
      color:#f87171;font-family:'Space Mono',monospace;line-height:1.5;">${msg}</div>`;
  }
  html += `</div>`;

  // ── Helper: cabecera de sección DESPLEGABLE ──────────────────
  const _secHdr = (id, icon, label, mins, open) => {
    const chev = open ? '▾' : '▸';
    return `<div class="planner-section-title planner-sec-toggle"
      style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;"
      onclick="_pdToggleSec('${id}')">
      <span style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;color:var(--text3);transition:transform .2s;" id="pdchev-${id}">${chev}</span>
        ${icon} ${label}
      </span>
      <span style="color:var(--accent2);font-size:9px;">${(mins/60).toFixed(1)}h</span>
    </div>`;
  };

  // ── Formato de fecha resaltado ───────────────────────────────
  const _fmtDueDate = (due, isOverdue) => {
    if (!due) return '';
    const d    = new Date(due + 'T00:00:00');
    const lbl  = d.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
    const diff = Math.round((d - new Date(today + 'T00:00:00')) / 86400000);
    let color, badge = '';
    if (isOverdue || diff < 0) {
      color = '#f87171'; badge = ' 🔴';
    } else if (diff === 0) {
      color = '#f87171'; badge = ' · HOY';
    } else if (diff === 1) {
      color = '#fbbf24'; badge = ' · mañana';
    } else if (diff <= 3) {
      color = '#fbbf24'; badge = ` · en ${diff}d`;
    } else {
      color = 'var(--text3)'; badge = '';
    }
    return `· <span style="color:${color};font-weight:700;font-family:'Space Mono',monospace;font-size:10px;">📅 ${lbl}${badge}</span>`;
  };

  // ── 1. Tareas ────────────────────────────────────────────────
  if (plan.tasks.length) {
    const taskMins = plan.tasks.reduce((s, t) => s + t.minutes, 0);
    const open = _pdSectOpen.tasks;
    html += _secHdr('tasks', '✅', `Tareas (${plan.tasks.length})`, taskMins, open);
    html += `<div id="pdsect-tasks" style="display:${open?'block':'none'};">`;
    html += plan.tasks.map(t => {
      const pc = t.priority==='high'?'#f87171':t.priority==='low'?'#4ade80':'#fbbf24';
      return `<div class="planner-item" onclick="openTaskDetail('${t.id}')" style="cursor:pointer;">
        <div class="planner-dot" style="background:${t.matColor};${t.isOverdue?'box-shadow:0 0 6px #f87171;':''}"></div>
        <div class="planner-body">
          <div class="planner-name">${t.matIcon} ${t.title}</div>
          <div class="planner-meta">${t.matName} ${_fmtDueDate(t.due, t.isOverdue)}</div>
        </div>
        <span class="planner-mins" style="color:${pc};">${t.minutes} min</span>
      </div>`;
    }).join('');
    html += `</div>`;
  }

  // ── 2. Repasos (solo los del día, sin low-priority en lista principal) ───
  if (plan.reviews.length) {
    const pendRevs  = plan.reviews.filter(r => r.status !== 'low-priority');
    const lowRevs   = plan.reviews.filter(r => r.status === 'low-priority');
    const revMins   = pendRevs.reduce((s, r) => s + r.minutes, 0);
    const totalLbl  = pendRevs.length + (lowRevs.length ? ` +${lowRevs.length}↓` : '');
    const open = _pdSectOpen.reviews;
    html += _secHdr('reviews', '🔁', `Repasos (${totalLbl})`, revMins, open);
    html += `<div id="pdsect-reviews" style="display:${open?'block':'none'};">`;
    html += pendRevs.map(r =>
      `<div class="planner-item">
        <div class="planner-dot" style="background:${r.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name">${r.matIcon} ${r.name}
            <span class="planner-tag-num">#${r.num}</span>
            ${r.difficulty==='hard'?'<span class="planner-tag-hard">difícil</span>':''}
          </div>
          <div class="planner-meta">${r.matName} · <span style="font-family:'Space Mono',monospace;font-size:10px;">${r.minutes} min</span></div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn btn-ghost btn-sm planner-btn-done"
            onclick="PLANNER.markReviewDone('${r.topicId}',${r.reviewIdx})"
            style="padding:4px 8px;">✅</button>
          <button class="btn btn-ghost btn-sm"
            onclick="PLANNER.markReviewSkip('${r.topicId}',${r.reviewIdx})"
            style="padding:4px 7px;">⏭</button>
        </div>
      </div>`
    ).join('');
    if (lowRevs.length) {
      html += `<div style="padding:5px 14px 7px;font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;border-top:1px solid var(--border);">
        ↓ ${lowRevs.length} repaso(s) de baja prioridad — usa Reagendar para redistribuir
      </div>`;
    }
    html += `</div>`;
  }

  // ── 3. Temas nuevos (sin repasos aún) ───────────────────────
  if (plan.newTopics.length) {
    const topicMins = plan.newTopics.reduce((s, t) => s + t.minutes, 0);
    const open = _pdSectOpen.topics;
    html += _secHdr('topics', '📖', `Tema nuevo (${plan.newTopics.length})`, topicMins, open);
    html += `<div id="pdsect-topics" style="display:${open?'block':'none'};">`;
    html += plan.newTopics.map(t =>
      `<div class="planner-item">
        <div class="planner-dot" style="background:${t.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name">${t.matIcon} ${t.name}</div>
          <div class="planner-meta">${t.matName} · P${t.parcial}</div>
        </div>
        <span class="planner-mins">${t.minutes} min</span>
      </div>`
    ).join('');
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ── Toggle de sección en Plan del Día ────────────────────────
function _pdToggleSec(id) {
  const body = document.getElementById('pdsect-' + id);
  const chev = document.getElementById('pdchev-' + id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chev) chev.textContent = open ? '▸' : '▾';
  _pdSectOpen[id] = !open;
}


// ── Cola de Repasos agrupada por Urgencia ─────────────────────
function renderReviewQueue() {
  const container = document.getElementById('planner-review-queue');
  if (!container) return;
  const today    = PLANNER.todayStr();
  const tomorrow = PLANNER.addDays(today, 1);
  const items    = [];

  State.topics.forEach(topic => {
    (topic.reviewSchedule || []).forEach((r, idx) => {
      if (r.done || r.status === 'skipped') return;
      const m = getMat(topic.matId);
      items.push({ topicId: topic.id, reviewIdx: idx, name: topic.name,
        difficulty: topic.difficulty || 'normal',
        matName: m.name||'—', matIcon: m.icon||'📚', matColor: m.color||'var(--accent)',
        date: r.date, status: r.status, minutes: r.minutes||20,
        parcial: topic.parcial, num: r.num||1, movedFrom: r.movedFrom||null });
    });
  });

  items.sort((a, b) => a.date < b.date ? -1 : 1);

  if (!items.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Sin repasos pendientes</div>`;
    return;
  }

  const groups = {
    overdue:  { label: '⚠️ Atrasados',   color: '#f87171', items: [] },
    today:    { label: '📍 Hoy',          color: 'var(--accent2)', items: [] },
    tomorrow: { label: '📅 Mañana',       color: '#fbbf24', items: [] },
    soon:     { label: '🕐 Esta semana',  color: 'var(--text2)', items: [] },
    later:    { label: '🗓️ Más adelante', color: 'var(--text3)', items: [] },
  };

  items.forEach(item => {
    if (item.date < today) groups.overdue.items.push(item);
    else if (item.date === today) groups.today.items.push(item);
    else if (item.date === tomorrow) groups.tomorrow.items.push(item);
    else if (PLANNER.diffDays(today, item.date) <= 7) groups.soon.items.push(item);
    else groups.later.items.push(item);
  });

  let html = '';
  let _grpIdx = 0;
  Object.values(groups).forEach(group => {
    if (!group.items.length) return;
    const gid = 'prq-g-' + _grpIdx++;
    html += `<div class="prq-group">
      <div class="prq-group-header" style="cursor:pointer;user-select:none;" onclick="_togglePrqGroup('${gid}',this)">
        <span style="font-size:11px;font-weight:800;color:${group.color};font-family:'Space Mono',monospace;">${group.label}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${group.items.length} repaso(s)</span>
          <span style="font-size:10px;color:var(--text3);">▾</span>
        </div>
      </div>
      <div id="${gid}">`;

    const byDate = {};
    group.items.forEach(i => { if (!byDate[i.date]) byDate[i.date]=[]; byDate[i.date].push(i); });

    Object.keys(byDate).sort().forEach(date => {
      const dlb  = PLANNER.loadBar(date);
      const isT  = date === today;
      const isTm = date === tomorrow;
      const diff = PLANNER.diffDays(today, date);
      // Color de la etiqueta de fecha según urgencia
      const dateLabelColor = date < today ? '#f87171'
        : isT  ? '#f87171'
        : isTm ? '#fbbf24'
        : diff <= 3 ? '#fbbf24'
        : 'var(--text3)';
      const dateLabelText = date < today
        ? `⚠ ${PLANNER.fmtShort(date)}`
        : isT  ? '📍 Hoy'
        : isTm ? '📅 Mañana'
        : PLANNER.fmtShort(date);

      html += `<div class="prq-date-row" style="background:${isT?'rgba(248,113,113,.06)':isTm?'rgba(251,191,36,.05)':'transparent'};border-radius:6px;margin:2px 0;">
        <span style="font-size:11px;font-weight:800;color:${dateLabelColor};font-family:'Space Mono',monospace;letter-spacing:.5px;">${dateLabelText}</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <div class="prog-bar" style="width:36px;height:3px;"><div class="prog-fill" style="background:${dlb.color};width:${dlb.pct}%;"></div></div>
          <span style="font-size:9px;color:${dlb.color};font-family:'Space Mono',monospace;">${dlb.label}</span>
        </div>
      </div>`;

      byDate[date].forEach(item => {
        html += `<div class="planner-item${item.status==='low-priority'?' planner-lowprio':''}">
          <div style="width:6px;height:6px;border-radius:50%;background:${item.matColor};flex-shrink:0;margin-left:8px;"></div>
          <div class="planner-body">
            <div class="planner-name" style="font-size:12px;">${item.matIcon} ${item.name}
              <span class="planner-tag-num">#${item.num}</span>
              <span style="font-size:9px;color:var(--text3);">P${item.parcial}</span>
              ${item.difficulty==='hard'?'<span class="planner-tag-hard">difícil</span>':''}
              ${item.movedFrom?`<span class="planner-tag-moved" title="Movido de ${PLANNER.fmtShort(item.movedFrom)}">↪</span>`:''}
              ${item.status==='low-priority'?'<span class="planner-tag-skip">↓</span>':''}
            </div>
            <div class="planner-meta">${item.matName} · ${item.minutes} min</div>
          </div>
          <div style="display:flex;gap:3px;flex-shrink:0;">
            <button class="btn btn-ghost btn-sm planner-btn-done" onclick="PLANNER.markReviewDone('${item.topicId}',${item.reviewIdx})" style="padding:3px 7px;font-size:11px;">✅</button>
            <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewSkip('${item.topicId}',${item.reviewIdx})" style="padding:3px 7px;font-size:11px;">⏭</button>
          </div>
        </div>`;
      });
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// Botón Reagendar con estado de carga
// ═══════════════════════════════════════════════════════════════

function plannerRescheduleUI() {
  const btn = document.getElementById('planner-reschedule-btn');
  if (btn) { btn.textContent = '⏳ Reagendando...'; btn.disabled = true; }

  setTimeout(() => {
    const { moved, stuck } = PLANNER.rescheduleAll();
    PLANNER._checkExamWarnings();
    PLANNER._refreshAll();
    if (btn) { btn.textContent = '↻ Reagendar'; btn.disabled = false; }

    if (!moved.length && !stuck.length) {
      PLANNER._plannerToast('Todo en orden - nada que mover', 'ok');
      return;
    }

    let msg = '';
    if (moved.length) msg += `↪ ${moved.length} repaso(s) movidos`;
    if (stuck.length) msg += `${msg?' · ':''}⚠️ ${stuck.length} sin espacio`;
    PLANNER._plannerToast(msg, stuck.length ? 'warning' : 'ok');

    if (stuck.length) {
      PLANNER._pushNotify('Repasos sin espacio',
        `${stuck.length} repaso(s) no pudieron agendarse. Considera aumentar el limite excepcional o revisar examen.`);
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════
// OVERRIDES
// ═══════════════════════════════════════════════════════════════

function openTopicModal() {
  fillMatSels();
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value = '';
  if (document.getElementById('tp-difficulty'))  document.getElementById('tp-difficulty').value  = 'normal';
  if (document.getElementById('tp-date-added'))  document.getElementById('tp-date-added').value  = PLANNER.todayStr();
  if (document.getElementById('tp-est-minutes')) document.getElementById('tp-est-minutes').value = '50';
  _updateExamDateSelector();
  document.getElementById('modal-topic').classList.add('open');
}

function _updateExamDateSelector() {
  const matId   = document.getElementById('tp-mat')?.value;
  const parcial = document.getElementById('tp-parcial')?.value;
  const el      = document.getElementById('tp-exam-date');
  if (!el || !matId || !parcial) return;
  el.value = PLANNER.getExamDate(matId, parcial) || '';
}

function saveTopic() {
  const name = document.getElementById('tp-name').value.trim();
  if (!name) { document.getElementById('tp-name').style.borderColor = 'var(--red)'; return; }
  document.getElementById('tp-name').style.borderColor = '';

  const subsRaw    = document.getElementById('tp-subs').value.trim();
  const difficulty = document.getElementById('tp-difficulty')?.value || 'normal';
  const subs = subsRaw
    ? subsRaw.split('\n').map(s => s.trim()).filter(Boolean)
              .map(s => ({ name: s, seen: false, comp: 0, done: false, difficulty }))
    : [];

  const matId      = document.getElementById('tp-mat').value;
  const parcial    = document.getElementById('tp-parcial').value;
  const dateAdded  = document.getElementById('tp-date-added')?.value  || PLANNER.todayStr();
  const estMinutes = parseInt(document.getElementById('tp-est-minutes')?.value) || 50;

  const examInput = document.getElementById('tp-exam-date');
  if (examInput?.value) PLANNER.setExamDate(matId, parcial, examInput.value);

  const topic = { id: Date.now().toString(), matId, parcial, name,
    seen: false, comp: 0, subs, difficulty, dateAdded, estMinutes, reviewSchedule: [] };

  if (!subs.length) {
    topic.reviewSchedule = PLANNER.generateSmartReviews(topic);
    const next = topic.reviewSchedule.find(r => r.status === 'pending');
    PLANNER._plannerToast(next
      ? `Guardado - proximo repaso ${PLANNER.fmtShort(next.date)}`
      : 'Tema guardado');
  } else {
    PLANNER._plannerToast('Guardado - marca subtemas para activar repasos');
  }

  State.topics.push(topic);
  saveState(['topics']);
  closeModal('modal-topic');
  renderTopics();
  PLANNER._refreshAll();
  PLANNER._checkExamWarnings();
}

// ── Toggle subtema — mantiene acordeón abierto ────────────────
function togglePlannerSubtopic(topicId, subIdx) {
  const topic = State.topics.find(t => t.id === topicId);
  if (!topic?.subs?.[subIdx]) return;

  topic.subs[subIdx].done = !topic.subs[subIdx].done;
  topic.subs[subIdx].seen = topic.subs[subIdx].done;
  if (topic.subs[subIdx].done) topic.subs[subIdx].comp = 100;

  const anyDone    = topic.subs.some(s => s.done);
  const hasReviews = (topic.reviewSchedule || []).length > 0;

  if (anyDone && !hasReviews) {
    topic.reviewSchedule = PLANNER.generateSmartReviews(topic);
    const next = topic.reviewSchedule.find(r => r.status === 'pending');
    if (next) {
      PLANNER._plannerToast(`Repasos agendados - proximo ${PLANNER.fmtShort(next.date)}`);
      PLANNER._pushNotify(`Repasos: ${topic.name}`, `Proximo repaso el ${PLANNER.fmtShort(next.date)}`);
    }
  }

  saveState(['topics']);

  // Re-renderizar solo este item, preservando estado del acordeón
  const mat    = getMat(topic.matId);
  const itemEl = document.getElementById('topic-item-' + topicId);
  if (itemEl) {
    const wasOpen = document.getElementById('tbody-' + topicId)?.style.display !== 'none';
    const temp = document.createElement('div');
    temp.innerHTML = _renderTopicItem(topic, mat);
    itemEl.replaceWith(temp.firstElementChild);
    if (wasOpen) {
      const newBody = document.getElementById('tbody-' + topicId);
      const newChev = document.getElementById('chev-' + topicId);
      if (newBody) newBody.style.display = 'block';
      if (newChev) newChev.style.transform = 'rotate(90deg)';
    }
  }

  PLANNER._refreshAll();
}

function setPlannerSubDifficulty(topicId, subIdx, difficulty) {
  const topic = State.topics.find(t => t.id === topicId);
  if (!topic?.subs?.[subIdx]) return;
  topic.subs[subIdx].difficulty = difficulty;
  saveState(['topics']);
  const mat    = getMat(topic.matId);
  const itemEl = document.getElementById('topic-item-' + topicId);
  if (itemEl) {
    const wasOpen = document.getElementById('tbody-' + topicId)?.style.display !== 'none';
    const temp = document.createElement('div');
    temp.innerHTML = _renderTopicItem(topic, mat);
    itemEl.replaceWith(temp.firstElementChild);
    if (wasOpen) {
      const b = document.getElementById('tbody-' + topicId);
      const c = document.getElementById('chev-' + topicId);
      if (b) b.style.display = 'block';
      if (c) c.style.transform = 'rotate(90deg)';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// renderTopics — tarjetas de materias + vista detallada
// ═══════════════════════════════════════════════════════════════

function renderTopics() {
  const matId     = document.getElementById('topics-mat-sel')?.value || '';
  const container = document.getElementById('topics-container');
  if (!container) return;
  if (!matId) { _renderTopicsAllMats(container); return; }
  _renderTopicsForMat(container, matId);
}

function _renderTopicsAllMats(container) {
  const today = PLANNER.todayStr();
  if (!State.materias.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">Agrega materias primero</div>`;
    return;
  }
  const mats = State.materias.filter(m => !m.parentId);
  if (!mats.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">Sin temas registrados</div>`;
    return;
  }
  const cards = mats.map(mat => {
    const matTopics = State.topics.filter(t => t.matId === mat.id);
    const total   = matTopics.length;
    const done    = matTopics.filter(t => t.subs?.every(s=>s.done) || (t.seen && !t.subs?.length)).length;
    const pending = matTopics.filter(t => (t.reviewSchedule||[]).some(r=>!r.done&&r.date<=today)).length;
    const pct = total ? Math.round(done/total*100) : 0;
    const clr = pct>=70?'#4ade80':pct>=30?'#fbbf24':total?'#f87171':'var(--text3)';
    return `<div onclick="document.getElementById('topics-mat-sel').value='${mat.id}';renderTopics();"
      style="cursor:pointer;background:var(--surface);border:1px solid var(--border);border-top:3px solid ${mat.color};
        border-radius:var(--radius);padding:16px 14px;display:flex;flex-direction:column;gap:10px;
        transition:border-color .15s,background .15s;min-width:0;"
      onmouseover="this.style.background='var(--surface2)'"
      onmouseout="this.style.background='var(--surface)'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
          <span style="font-size:24px;flex-shrink:0;">${mat.icon||'📚'}</span>
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${mat.name}</div>
            <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:1px;">${mat.code}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:22px;font-weight:800;color:${clr};line-height:1;">${pct}%</div>
          <div style="font-size:9px;color:var(--text3);margin-top:1px;">preparado</div>
        </div>
      </div>
      <div>
        <div class="prog-bar" style="height:5px;margin-bottom:6px;"><div class="prog-fill" style="background:${clr};width:${pct}%;transition:width .4s;"></div></div>
        <div style="display:flex;gap:10px;font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;flex-wrap:wrap;">
          <span>📖 ${total} temas</span>
          ${pending>0?`<span style="color:#fbbf24;">🔁 ${pending} atrasados</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">${cards}</div>`;
}

function _renderTopicsForMat(container, matId) {
  const mat       = getMat(matId);
  const matTopics = State.topics.filter(t => t.matId === matId);
  const totalT    = matTopics.length;
  const seenT     = matTopics.filter(t => t.seen || t.subs?.some(s=>s.done)).length;
  const avgComp   = totalT ? Math.round(matTopics.reduce((a,t)=>a+t.comp,0)/totalT) : 0;
  const needRev   = matTopics.filter(t => t.comp<70 && (t.seen||t.subs?.some(s=>s.done))).length;
  const sem       = State._activeSem;
  const examDates = sem.examDates || {};
  const today     = PLANNER.todayStr();
  const parciales = ['1','2','3','final'];

  let html = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('topics-mat-sel').value='';renderTopics();">← Todas</button>
      <span style="font-size:15px;font-weight:800;">${mat.icon||'📚'} ${mat.name}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
      <div class="stat-mini"><div class="stat-mini-lbl">VISTOS</div>
        <div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div>
        <div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT?seenT/totalT*100:0}%;"></div></div>
      </div>
      <div class="stat-mini"><div class="stat-mini-lbl">COMP.</div>
        <div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div>
        <div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div>
      </div>
      <div class="stat-mini"><div class="stat-mini-lbl">REPASO</div>
        <div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:4px;">&lt;70%</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><span class="card-title" style="font-size:12px;">📝 Fechas de Examen</span></div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:10px 14px;">
        ${parciales.map(p => {
          const key  = `${matId}__${p}`;
          const date = examDates[key] || '';
          const days = date ? PLANNER.diffDays(today, date) : null;
          const urg  = days!==null&&days<=3?'#f87171':days!==null&&days<=7?'#fbbf24':'var(--text3)';
          return `<div>
            <label style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">${p==='final'?'FINAL':'PARCIAL '+p}</label>
            <div style="display:flex;gap:5px;align-items:center;margin-top:3px;">
              <input type="date" class="form-input" style="font-size:13px;flex:1;padding:5px 8px;"
                value="${date}" onchange="PLANNER.setExamDate('${matId}','${p}',this.value)">
              ${days!==null&&days>=0?`<span style="font-size:10px;font-weight:800;color:${urg};white-space:nowrap;">${days===0?'¡HOY!':days+'d'}</span>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const parts = [{v:'1',l:'Parcial 1'},{v:'2',l:'Parcial 2'},{v:'3',l:'Parcial 3'},{v:'final',l:'Final'}];
  let any = false;

  parts.forEach(p => {
    const pts = matTopics.filter(t => t.parcial === p.v);
    if (!pts.length) return;
    any = true;

    const allSubs   = pts.flatMap(t => t.subs || []);
    const doneSubs  = allSubs.filter(s => s.done).length;
    const totalSubs = allSubs.length;
    const confPct   = totalSubs > 0
      ? Math.round(doneSubs/totalSubs*100)
      : Math.round(pts.filter(t=>t.seen).length/pts.length*100);
    const confColor = confPct>=70?'#4ade80':confPct>=30?'#fbbf24':'#f87171';
    const confLabel = confPct>=70?'Buena preparacion':confPct>=30?'En progreso':'Poco preparado';

    const examDate   = PLANNER.getExamDate(matId, p.v);
    const daysToExam = examDate ? PLANNER.diffDays(today, examDate) : null;
    const examBadge  = daysToExam!==null
      ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;
          background:${daysToExam<=3?'rgba(248,113,113,.2)':daysToExam<=7?'rgba(251,191,36,.2)':'var(--surface2)'};
          color:${daysToExam<=3?'#f87171':daysToExam<=7?'#fbbf24':'var(--text3)'};">
          📝 ${daysToExam===0?'Hoy!':daysToExam<0?'Pasado':'En '+daysToExam+'d'}
        </span>` : '';

    html += `<div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="border-left:3px solid ${mat.color};flex-direction:column;align-items:stretch;padding:12px 16px 8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span class="card-title">📖 ${p.l}</span>
          <div style="display:flex;gap:8px;align-items:center;">${examBadge}
            <span style="font-size:11px;color:var(--text3);">${pts.filter(t=>t.subs?.some(s=>s.done)||t.seen).length}/${pts.length}</span>
          </div>
        </div>
        <div style="margin-top:7px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">PREPARACION</span>
            <span style="font-size:9px;font-weight:800;color:${confColor};font-family:'Space Mono',monospace;">${Math.round(confPct)}% - ${confLabel}</span>
          </div>
          <div class="prog-bar" style="height:4px;"><div class="prog-fill" style="background:${confColor};width:${confPct}%;border-radius:2px;transition:width .5s;"></div></div>
        </div>
      </div>
      <div class="card-body" style="padding:0;">${pts.map(t => _renderTopicItem(t, mat)).join('')}</div>
    </div>`;
  });

  if (!any) html += `<div style="text-align:center;padding:48px;color:var(--text3);">Presiona "+ Agregar Tema" para comenzar</div>`;
  container.innerHTML = html;
}

function _renderTopicItem(t, mat) {
  const today      = PLANNER.todayStr();
  const hasSubs    = t.subs && t.subs.length > 0;
  const anyDone    = t.subs?.some(s => s.done);
  const allDone    = hasSubs && t.subs.every(s => s.done);
  const hasReviews = (t.reviewSchedule || []).length > 0;
  const nextReview = hasReviews ? t.reviewSchedule.find(r => !r.done && r.status === 'pending') : null;
  const doneSubs   = t.subs?.filter(s => s.done).length || 0;
  const totalSubs  = t.subs?.length || 0;
  const pendRevs   = (t.reviewSchedule || []).filter(r => !r.done && r.status !== 'skipped');
  const doneRevs   = (t.reviewSchedule || []).filter(r => r.done).length;
  const dotColor   = allDone ? '#4ade80' : anyDone ? '#fbbf24' : mat.color;
  const subPct     = totalSubs > 0 ? Math.round(doneSubs/totalSubs*100) : (t.seen ? 100 : 0);
  const subClr     = subPct>=70?'#4ade80':subPct>=30?'#fbbf24':'var(--border)';

  return `<div class="planner-topic-item" id="topic-item-${t.id}">
    <div class="planner-topic-header" onclick="togglePlannerTopic('${t.id}')">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;box-shadow:0 0 5px ${dotColor}44;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.name}</div>
          <div style="display:flex;gap:7px;align-items:center;margin-top:3px;flex-wrap:wrap;">
            ${hasSubs ? `<div style="display:flex;align-items:center;gap:4px;">
              <div class="prog-bar" style="width:36px;height:3px;"><div class="prog-fill" style="background:${subClr};width:${subPct}%;"></div></div>
              <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${doneSubs}/${totalSubs}</span>
            </div>` : ''}
            ${nextReview ? `<span style="font-size:10px;color:var(--accent2);font-family:'Space Mono',monospace;">🔁 ${nextReview.date===today?'hoy':PLANNER.fmtShort(nextReview.date)}</span>` : ''}
            ${t.difficulty==='hard' ? `<span class="planner-tag-hard">dificil</span>` : ''}
            ${!hasReviews&&!hasSubs ? `<span style="font-size:10px;color:var(--text3);">toca subtema para repasos</span>` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
        ${doneRevs>0?`<span style="font-size:10px;color:#4ade80;font-family:'Space Mono',monospace;">✅${doneRevs}</span>`:''}
        ${pendRevs.length>0?`<span style="font-size:10px;color:var(--accent2);font-family:'Space Mono',monospace;">🔁${pendRevs.length}</span>`:''}
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteTopic('${t.id}')" style="padding:3px 7px;font-size:11px;">✕</button>
        <span id="chev-${t.id}" style="font-size:11px;color:var(--text3);transition:transform .2s;display:inline-block;">▶</span>
      </div>
    </div>

    <div class="planner-topic-body" id="tbody-${t.id}" style="display:none;">
      ${hasSubs ? `<div style="padding:8px 14px 6px;">
        <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:8px;">SUBTEMAS</div>
        <div style="padding-left:10px;border-left:2px solid var(--border2);">
          ${t.subs.map((s,i) => {
            const diff   = s.difficulty || t.difficulty || 'normal';
            const dColor = diff==='easy'?'#4ade80':diff==='hard'?'#f87171':'#fbbf24';
            const revMin = PLANNER.REVIEW_MINS[diff];
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);position:relative;" id="sub-${t.id}-${i}">
              <div style="position:absolute;left:-10px;top:14px;width:8px;height:1px;background:var(--border2);"></div>
              <div onclick="togglePlannerSubtopic('${t.id}',${i})"
                style="width:18px;height:18px;border-radius:5px;flex-shrink:0;margin-top:1px;cursor:pointer;
                  border:2px solid ${s.done?'#4ade80':'var(--border2)'};background:${s.done?'#4ade80':'transparent'};
                  display:flex;align-items:center;justify-content:center;transition:all .15s;">
                ${s.done?'<span style="font-size:11px;color:#111;font-weight:800;">✓</span>':''}
              </div>
              <div style="flex:1;min-width:0;">
                <div onclick="togglePlannerSubtopic('${t.id}',${i})" style="font-size:12px;cursor:pointer;${s.done?'text-decoration:line-through;color:var(--text3);':''}">${s.name}</div>
                <div style="display:flex;gap:4px;margin-top:4px;align-items:center;flex-wrap:wrap;">
                  ${['easy','normal','hard'].map(d => {
                    const dc = d==='easy'?'#4ade80':d==='hard'?'#f87171':'#fbbf24';
                    const dl = d==='easy'?'fácil':d==='hard'?'difícil':'normal';
                    const active = diff===d;
                    return `<button onclick="event.stopPropagation();setPlannerSubDifficulty('${t.id}',${i},'${d}')"
                      style="font-size:8px;padding:1px 6px;border-radius:4px;cursor:pointer;font-family:'Space Mono',monospace;
                        background:${active?dc+'22':'transparent'};color:${active?dc:'var(--text3)'};
                        border:1px solid ${active?dc:'var(--border)'};font-weight:${active?800:400};transition:all .12s;">${dl}</button>`;
                  }).join('')}
                  <span style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">${revMin}min repaso</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : `<div style="padding:8px 14px 6px;font-size:11px;color:var(--text3);">Sin subtemas · repasos generados al crear</div>`}

      ${pendRevs.length>0 ? `<div style="padding:8px 14px;border-top:1px solid var(--border);">
        <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">REPASOS AGENDADOS</div>
        ${pendRevs.map(r => {
          const lb  = PLANNER.loadBar(r.date);
          const isT = r.date === today;
          return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;">
            <span class="planner-tag-num">#${r.num}</span>
            <span style="font-family:'Space Mono',monospace;color:${isT?'var(--accent2)':'var(--text2)'};font-weight:${isT?800:400};min-width:66px;">${isT?'HOY':PLANNER.fmtShort(r.date)}</span>
            <div class="prog-bar" style="width:30px;height:3px;flex-shrink:0;"><div class="prog-fill" style="background:${lb.color};width:${lb.pct}%;"></div></div>
            <span style="color:${lb.color};font-size:9px;flex:1;">${lb.label}</span>
            <span style="color:var(--text3);font-size:10px;">${r.minutes}min</span>
            ${r.status==='low-priority'?'<span class="planner-tag-skip">↓</span>':''}
          </div>`;
        }).join('')}
      </div>` : hasSubs ? `<div style="padding:6px 14px 8px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">Marca un subtema para activar repasos</div>` : ''}
    </div>
  </div>`;
}

function togglePlannerTopic(id) {
  const body = document.getElementById('tbody-' + id);
  const chev = document.getElementById('chev-' + id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
}

function _plannerApplyTaskDates(task) {
  if (!task.estDays || !task.estHoursPerDay || !task.due) return;
  task.plannedWorkDates = PLANNER.planTaskDates(task);
}

// ── Sincronizar Plan del Día con filtro de agenda ─────────────
let _origOvSetDayFilter = null;
(function _hookAgendaFilter() {
  // Se ejecuta después de que notes.js carga ovSetDayFilter
  const _hook = () => {
    if (typeof ovSetDayFilter === 'function' && !ovSetDayFilter._plannerHooked) {
      const orig = ovSetDayFilter;
      window.ovSetDayFilter = function(dateStr) {
        orig(dateStr);
        _plannerActiveDate = (typeof ovFilterDay !== 'undefined' && ovFilterDay) ? ovFilterDay : dateStr;
        renderDailyPlan(_plannerActiveDate);
      };
      window.ovSetDayFilter._plannerHooked = true;
    }
  };
  setTimeout(_hook, 900);
})();

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof State === 'undefined') return;
    PLANNER.rescheduleAll();
    PLANNER._checkExamWarnings();
    PLANNER._refreshAll();
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 4000);
    }
  }, 800);
});

// ═══════════════════════════════════════════════════════════════
// HELPERS: stepper + toggle campos de repetición
// ═══════════════════════════════════════════════════════════════

// Si _stepperChange no está definida en app.js, la definimos aquí
if (typeof _stepperChange === 'undefined') {
  window._stepperChange = function(id, delta, min, max, step) {
    const el = document.getElementById(id);
    if (!el) return;
    let val = parseFloat(el.value) || min;
    val = Math.round((val + delta) / step) * step;
    val = Math.max(min, Math.min(max, val));
    el.value = val;
    el.dispatchEvent(new Event('input'));
  };
}

// Mostrar/ocultar campos de repetición Y planificación distribuida
function _toggleRepeatFields() {
  const val        = document.getElementById('t-repeat')?.value || 'none';
  const isRepeat   = val !== 'none';
  const repeatWrap = document.getElementById('t-repeat-until-wrap');
  const distWrap   = document.getElementById('t-distributed-wrap');
  if (repeatWrap) repeatWrap.style.display = isRepeat ? 'block' : 'none';
  if (distWrap)   distWrap.style.display   = isRepeat ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE — Cola de repasos (sección completa y grupos)
// ═══════════════════════════════════════════════════════════════

// Toggle toda la sección de Repasos Pendientes
function _toggleReviewQueue(headerEl) {
  const queue = document.getElementById('planner-review-queue');
  const chev  = document.getElementById('review-queue-chevron');
  if (!queue) return;
  const isOpen = queue.style.display !== 'none';
  queue.style.display = isOpen ? 'none' : '';
  if (chev) chev.textContent = isOpen ? '▸ expandir' : '▾ ocultar';
}

// Toggle un grupo individual dentro de la cola (Mañana / Esta semana / etc.)
function _togglePrqGroup(id, headerEl) {
  const body = document.getElementById(id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  // Actualizar el chevron dentro del header
  const chev = headerEl?.querySelector('span:last-child');
  if (chev) chev.textContent = isOpen ? '▸' : '▾';
}
