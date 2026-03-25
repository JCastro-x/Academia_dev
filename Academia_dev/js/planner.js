// ═══════════════════════════════════════════════════════════════
// PLANNER.JS — Planificador Inteligente de Estudio
// Extiende el sistema de Temas y Tareas existente.
// Carga después de app.js/materias.js para sobreescribir
// openTopicModal() y saveTopic().
// ═══════════════════════════════════════════════════════════════

const PLANNER = (() => {
  'use strict';

  // ── Configuración ────────────────────────────────────────────
  const MAX_DAILY_MIN    = 4 * 60;   // 240 min = 4 h
  const MAX_RESCHEDULE   = 3;        // días máx para reubicar un repaso
  const NEW_TOPIC_MIN    = 50;       // minutos para estudiar un tema nuevo

  // Intervalos de repaso en días desde dateAdded
  const REVIEW_DAYS = {
    normal: [2, 6],
    hard:   [2, 5, 10]
  };
  // Minutos por sesión de repaso
  const REVIEW_MIN = {
    normal: 20,
    hard:   25
  };

  // ── Helpers de fecha ─────────────────────────────────────────
  function addDays(str, n) {
    const d = new Date(str + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function fmtShort(str) {
    if (!str) return '';
    return new Date(str + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  // ── Carga real del día ────────────────────────────────────────
  // Suma: tareas planificadas + sesiones de trabajo distribuidas
  //       + repasos pendientes + tema nuevo si es hoy
  function getDayMinutes(dateStr) {
    let total = 0;

    // Tareas con datePlanned en este día
    State.tasks
      .filter(t => !t.done && t.datePlanned === dateStr)
      .forEach(t => { total += t.timeEst || 60; });

    // Sesiones de trabajo distribuidas (plannedWorkDates)
    State.tasks
      .filter(t => !t.done && (t.plannedWorkDates || []).includes(dateStr))
      .forEach(t => { total += Math.round((t.estHoursPerDay || 1) * 60); });

    // Repasos pendientes para este día
    State.topics.forEach(topic => {
      (topic.reviewSchedule || [])
        .filter(r => r.date === dateStr && !r.done && r.status === 'pending')
        .forEach(r => { total += r.minutes || REVIEW_MIN[topic.difficulty || 'normal']; });
    });

    // Estudio inicial del tema si dateAdded === este día
    State.topics
      .filter(t => t.dateAdded === dateStr)
      .forEach(t => { total += t.estMinutes || NEW_TOPIC_MIN; });

    return total;
  }

  // ── Generar calendario de repasos para un tema ────────────────
  function generateReviews(topic) {
    const base    = topic.dateAdded || todayStr();
    const diff    = topic.difficulty || 'normal';
    const offsets = REVIEW_DAYS[diff];
    const mins    = REVIEW_MIN[diff];

    return offsets.map(offset => {
      let targetDate = addDays(base, offset);
      let status     = 'pending';

      // Buscar día con espacio (hasta MAX_RESCHEDULE días después)
      let placed = false;
      for (let shift = 0; shift <= MAX_RESCHEDULE; shift++) {
        const candidate = addDays(base, offset + shift);
        if (getDayMinutes(candidate) + mins <= MAX_DAILY_MIN) {
          targetDate = candidate;
          placed     = true;
          break;
        }
      }
      if (!placed) status = 'low-priority';

      return { date: targetDate, done: false, status, minutes: mins };
    });
  }

  // ── Distribuir fechas de trabajo para una tarea ───────────────
  function planTaskDates(task) {
    if (!task.due) return [];
    const estDays    = Math.max(1, parseInt(task.estDays)        || 1);
    const hrsPerDay  = Math.max(0.5, parseFloat(task.estHoursPerDay) || 1);
    const minsPerDay = Math.round(hrsPerDay * 60);
    const today      = todayStr();

    // Trabajar hacia atrás desde due-1 (buffer de 1 día antes del deadline)
    const dates = [];
    for (let i = 0; i < estDays; i++) {
      const idealDate = addDays(task.due, -(1 + i));
      if (idealDate < today) break; // no planificar en el pasado

      // Buscar día con espacio (hacia atrás hasta 7 días)
      let placed = false;
      for (let back = 0; back <= 7; back++) {
        const candidate = addDays(idealDate, -back);
        if (candidate < today) break;
        if (getDayMinutes(candidate) + minsPerDay <= MAX_DAILY_MIN) {
          dates.push(candidate);
          placed = true;
          break;
        }
      }
      // Si no hubo espacio, forzar el día ideal de todas formas
      if (!placed && idealDate >= today) dates.push(idealDate);
    }

    return [...new Set(dates)].sort();
  }

  // ── Reagendar repasos sobrecargados ──────────────────────────
  function rescheduleAll() {
    let changed = false;
    const today = todayStr();

    State.topics.forEach(topic => {
      if (!topic.reviewSchedule?.length) return;
      topic.reviewSchedule.forEach(review => {
        if (review.done || review.date < today) return;
        const revMin = review.minutes || REVIEW_MIN[topic.difficulty || 'normal'];

        if (getDayMinutes(review.date) > MAX_DAILY_MIN) {
          let moved = false;
          for (let d = 1; d <= MAX_RESCHEDULE; d++) {
            const candidate = addDays(review.date, d);
            if (getDayMinutes(candidate) + revMin <= MAX_DAILY_MIN) {
              review.date   = candidate;
              review.status = 'pending';
              moved         = true;
              changed       = true;
              break;
            }
          }
          if (!moved && review.status !== 'done') {
            review.status = 'low-priority';
            changed       = true;
          }
        }
      });
    });

    if (changed) saveState(['topics']);
    return changed;
  }

  // ── Armar el plan del día ─────────────────────────────────────
  function getDailyPlan(dateStr) {
    const plan = {
      date:         dateStr,
      newTopics:    [],
      reviews:      [],
      tasks:        [],
      totalMinutes: 0,
      overloaded:   false,
    };

    // Temas nuevos
    State.topics
      .filter(t => t.dateAdded === dateStr)
      .forEach(t => {
        const m    = getMat(t.matId);
        const mins = t.estMinutes || NEW_TOPIC_MIN;
        plan.newTopics.push({
          id: t.id, name: t.name, parcial: t.parcial,
          matName:  m.name  || '—',
          matIcon:  m.icon  || '📚',
          matColor: m.color || 'var(--accent)',
          minutes: mins,
        });
        plan.totalMinutes += mins;
      });

    // Repasos
    State.topics.forEach(topic => {
      (topic.reviewSchedule || []).forEach((r, idx) => {
        if (r.date !== dateStr || r.done) return;
        const m = getMat(topic.matId);
        plan.reviews.push({
          topicId:    topic.id,
          reviewIdx:  idx,
          name:       topic.name,
          difficulty: topic.difficulty || 'normal',
          matName:    m.name  || '—',
          matIcon:    m.icon  || '📚',
          matColor:   m.color || 'var(--accent)',
          minutes:    r.minutes || 20,
          status:     r.status,
        });
        if (r.status !== 'low-priority') plan.totalMinutes += (r.minutes || 20);
      });
    });

    // Tareas (sin duplicar si aparece en ambos campos)
    const seenIds = new Set();
    State.tasks
      .filter(t => !t.done && (
        t.datePlanned === dateStr ||
        (t.plannedWorkDates || []).includes(dateStr)
      ))
      .forEach(t => {
        if (seenIds.has(t.id)) return;
        seenIds.add(t.id);
        const m    = getMat(t.matId);
        const mins = t.datePlanned === dateStr
          ? (t.timeEst || 60)
          : Math.round((t.estHoursPerDay || 1) * 60);
        plan.tasks.push({
          id:       t.id,
          title:    t.title,
          due:      t.due,
          priority: t.priority,
          matName:  m.name  || '—',
          matIcon:  m.icon  || '📚',
          matColor: m.color || 'var(--accent)',
          minutes:  mins,
        });
        plan.totalMinutes += mins;
      });

    plan.overloaded = plan.totalMinutes > MAX_DAILY_MIN;
    return plan;
  }

  // ── Marcar repaso como hecho / omitido ───────────────────────
  function markReviewDone(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].done   = true;
    topic.reviewSchedule[reviewIdx].status = 'done';
    saveState(['topics']);
    renderDailyPlan();
    renderReviewQueue();
  }

  function markReviewSkip(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].status = 'skipped';
    saveState(['topics']);
    renderDailyPlan();
    renderReviewQueue();
  }

  // Public API
  return {
    generateReviews,
    planTaskDates,
    rescheduleAll,
    getDailyPlan,
    getDayMinutes,
    markReviewDone,
    markReviewSkip,
    addDays,
    todayStr,
    fmtShort,
    MAX_DAILY_MIN,
    NEW_TOPIC_MIN,
  };
})();

// ═══════════════════════════════════════════════════════════════
// PLANNER UI — Renderizado del Plan del Día y Cola de Repasos
// ═══════════════════════════════════════════════════════════════

function renderDailyPlan(dateStr) {
  const target    = dateStr || PLANNER.todayStr();
  const container = document.getElementById('planner-daily-plan');
  if (!container) return;

  const plan     = PLANNER.getDailyPlan(target);
  const total    = plan.totalMinutes;
  const pct      = Math.min(100, Math.round(total / PLANNER.MAX_DAILY_MIN * 100));
  const barColor = pct >= 100 ? '#f87171' : pct >= 80 ? '#fbbf24' : '#4ade80';
  const totalH   = (total / 60).toFixed(1);
  const isEmpty  = !plan.newTopics.length && !plan.reviews.length && !plan.tasks.length;

  if (isEmpty) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:var(--text3);">
        <div style="font-size:32px;margin-bottom:8px;">🎉</div>
        <div style="font-size:14px;font-weight:700;color:var(--text2);">Día sin pendientes</div>
        <div style="font-size:11px;margin-top:4px;">No hay repasos ni tareas para hoy</div>
      </div>`;
    return;
  }

  let html = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">CARGA DEL DÍA</span>
        <span style="font-size:12px;font-weight:800;color:${barColor};font-family:'Space Mono',monospace;">
          ${totalH}h / 4h${plan.overloaded ? ' ⚠️' : ''}
        </span>
      </div>
      <div class="prog-bar" style="height:7px;">
        <div class="prog-fill" style="background:${barColor};width:${pct}%;border-radius:4px;"></div>
      </div>
      ${plan.overloaded ? `<div style="font-size:10px;color:#f87171;margin-top:4px;font-family:'Space Mono',monospace;">Día sobrecargado — considera mover algo</div>` : ''}
    </div>`;

  // Temas nuevos
  if (plan.newTopics.length) {
    html += `<div class="planner-section-title">📖 Tema nuevo (${plan.newTopics.length})</div>`;
    html += plan.newTopics.map(t => `
      <div class="planner-item">
        <div class="planner-dot" style="background:${t.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name">${t.matIcon} ${t.name}</div>
          <div class="planner-meta">${t.matName} · Parcial ${t.parcial}</div>
        </div>
        <span class="planner-mins">${t.minutes} min</span>
      </div>`).join('');
  }

  // Repasos
  if (plan.reviews.length) {
    html += `<div class="planner-section-title">🔁 Repasos (${plan.reviews.length})</div>`;
    html += plan.reviews.map(r => `
      <div class="planner-item${r.status === 'low-priority' ? ' planner-lowprio' : ''}">
        <div class="planner-dot" style="background:${r.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name">
            ${r.matIcon} ${r.name}
            ${r.difficulty === 'hard' ? '<span class="planner-tag-hard">difícil</span>' : ''}
            ${r.status === 'low-priority' ? '<span class="planner-tag-skip">↓ prioridad</span>' : ''}
          </div>
          <div class="planner-meta">${r.matName} · ${r.minutes} min</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewDone('${r.topicId}',${r.reviewIdx})" title="Repasado" style="padding:4px 7px;">✅</button>
          <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewSkip('${r.topicId}',${r.reviewIdx})" title="Omitir" style="padding:4px 7px;">⏭</button>
        </div>
      </div>`).join('');
  }

  // Tareas
  if (plan.tasks.length) {
    html += `<div class="planner-section-title">✅ Tareas (${plan.tasks.length})</div>`;
    html += plan.tasks.map(t => {
      const dueStr    = t.due ? `· 📅 ${new Date(t.due + 'T00:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short'})}` : '';
      const prioColor = t.priority === 'high' ? '#f87171' : t.priority === 'low' ? '#4ade80' : '#fbbf24';
      return `
        <div class="planner-item" onclick="openTaskDetail('${t.id}')" style="cursor:pointer;">
          <div class="planner-dot" style="background:${t.matColor};"></div>
          <div class="planner-body">
            <div class="planner-name">${t.matIcon} ${t.title}</div>
            <div class="planner-meta">${t.matName} ${dueStr}</div>
          </div>
          <span class="planner-mins" style="color:${prioColor};">${t.minutes} min</span>
        </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

// ── Cola de repasos (sección en página de Temas) ─────────────
function renderReviewQueue() {
  const container = document.getElementById('planner-review-queue');
  if (!container) return;

  const today = PLANNER.todayStr();

  // Recopilar todos los repasos activos (no hechos, no omitidos)
  const items = [];
  State.topics.forEach(topic => {
    // Solo parciales activos — comparar con el parcial más reciente usado
    (topic.reviewSchedule || []).forEach((r, idx) => {
      if (r.done || r.status === 'skipped') return;
      const m = getMat(topic.matId);
      items.push({
        topicId:    topic.id,
        reviewIdx:  idx,
        name:       topic.name,
        difficulty: topic.difficulty || 'normal',
        matName:    m.name  || '—',
        matIcon:    m.icon  || '📚',
        matColor:   m.color || 'var(--accent)',
        date:       r.date,
        status:     r.status,
        minutes:    r.minutes || 20,
        overdue:    r.date < today,
        isToday:    r.date === today,
        parcial:    topic.parcial,
      });
    });
  });

  items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  if (!items.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text3);">
        <div style="font-size:24px;margin-bottom:6px;">✨</div>
        <div style="font-size:12px;">Sin repasos pendientes</div>
      </div>`;
    return;
  }

  // Agrupar por fecha
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  });

  let html = '';
  Object.keys(grouped).sort().forEach(date => {
    const isToday = date === today;
    const isPast  = date < today;
    const label   = isToday ? '📍 Hoy'
      : isPast   ? `⚠️ Atrasado · ${PLANNER.fmtShort(date)}`
      : PLANNER.fmtShort(date);
    const hdrColor = isPast ? '#f87171' : isToday ? 'var(--accent2)' : 'var(--text2)';
    const dayMins  = PLANNER.getDayMinutes(date);
    const loadPct  = Math.min(100, Math.round(dayMins / PLANNER.MAX_DAILY_MIN * 100));
    const loadClr  = loadPct >= 100 ? '#f87171' : loadPct >= 80 ? '#fbbf24' : '#4ade80';

    html += `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:0 2px;">
          <span style="font-size:11px;font-weight:800;color:${hdrColor};font-family:'Space Mono',monospace;">${label}</span>
          <span style="font-size:10px;color:${loadClr};font-family:'Space Mono',monospace;">${(dayMins/60).toFixed(1)}h / 4h</span>
        </div>`;

    grouped[date].forEach(item => {
      html += `
        <div class="planner-item${item.status === 'low-priority' ? ' planner-lowprio' : ''}" style="margin-bottom:5px;">
          <div class="planner-dot" style="background:${item.matColor};"></div>
          <div class="planner-body">
            <div class="planner-name" style="font-size:12px;">
              ${item.matIcon} ${item.name}
              <span style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">P${item.parcial}</span>
              ${item.difficulty === 'hard' ? '<span class="planner-tag-hard">difícil</span>' : ''}
              ${item.status === 'low-priority' ? '<span class="planner-tag-skip">↓</span>' : ''}
            </div>
            <div class="planner-meta">${item.matName} · ${item.minutes} min</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewDone('${item.topicId}',${item.reviewIdx})" title="Repasado" style="padding:3px 7px;font-size:11px;">✅</button>
            <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewSkip('${item.topicId}',${item.reviewIdx})" title="Omitir" style="padding:3px 7px;font-size:11px;">⏭</button>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// OVERRIDE: openTopicModal y saveTopic
// Estas funciones reemplazan las de app.js/materias.js
// porque planner.js carga después.
// ═══════════════════════════════════════════════════════════════

function openTopicModal() {
  fillMatSels();
  const today = PLANNER.todayStr();
  document.getElementById('tp-name').value              = '';
  document.getElementById('tp-subs').value              = '';
  if (document.getElementById('tp-difficulty'))
    document.getElementById('tp-difficulty').value      = 'normal';
  if (document.getElementById('tp-date-added'))
    document.getElementById('tp-date-added').value      = today;
  if (document.getElementById('tp-est-minutes'))
    document.getElementById('tp-est-minutes').value     = '50';
  document.getElementById('modal-topic').classList.add('open');
}

function saveTopic() {
  const name = document.getElementById('tp-name').value.trim();
  if (!name) return;

  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs    = subsRaw
    ? subsRaw.split('\n').map(s => s.trim()).filter(Boolean)
              .map(s => ({ name: s, seen: false, comp: 0 }))
    : [];

  const difficulty = document.getElementById('tp-difficulty')?.value     || 'normal';
  const dateAdded  = document.getElementById('tp-date-added')?.value     || PLANNER.todayStr();
  const estMinutes = parseInt(document.getElementById('tp-est-minutes')?.value) || 50;

  const topic = {
    id:             Date.now().toString(),
    matId:          document.getElementById('tp-mat').value,
    parcial:        document.getElementById('tp-parcial').value,
    name,
    seen:           false,
    comp:           0,
    subs,
    // Campos nuevos
    difficulty,
    dateAdded,
    estMinutes,
    reviewSchedule: [],
  };

  // Generar calendario de repasos
  topic.reviewSchedule = PLANNER.generateReviews(topic);

  State.topics.push(topic);
  saveState(['topics']);
  closeModal('modal-topic');
  renderTopics();
  renderDailyPlan();
  renderReviewQueue();

  // Toast con próximo repaso
  const next = topic.reviewSchedule.find(r => r.status === 'pending');
  if (next) {
    const lbl = next.date === PLANNER.todayStr() ? 'hoy' : PLANNER.fmtShort(next.date);
    _plannerToast(`✅ Tema guardado · Próximo repaso: ${lbl}`);
  }
}

// ── Distribuir fechas al guardar una tarea con estDays ────────
function _plannerApplyTaskDates(task) {
  if (!task.estDays || !task.estHoursPerDay || !task.due) return;
  task.plannedWorkDates = PLANNER.planTaskDates(task);
}

// ── Toast ──────────────────────────────────────────────────────
function _plannerToast(msg) {
  let el = document.getElementById('planner-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'planner-toast';
    el.style.cssText = [
      'position:fixed', 'bottom:90px', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--surface)', 'border:1px solid var(--accent)',
      'color:var(--text)', 'padding:10px 20px', 'border-radius:10px',
      'font-size:13px', 'font-weight:700', 'z-index:3000',
      'box-shadow:0 4px 20px rgba(0,0,0,.4)',
      'max-width:90vw', 'text-align:center',
      'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent  = msg;
  el.style.opacity = '1';
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 300);
  }, 3000);
}

// ── Inicializar al cargar ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof State === 'undefined') return;
    PLANNER.rescheduleAll();
    renderDailyPlan();
    renderReviewQueue();
  }, 600);
});
