// ═══════════════════════════════════════════════════════════════
// PLANNER.JS v2 — Planificador Inteligente Dinámico
// Carga DESPUÉS de todos los demás scripts.
// Sobreescribe: openTopicModal, saveTopic, renderTopics
// ═══════════════════════════════════════════════════════════════

const PLANNER = (() => {
  'use strict';

  const MAX_DAILY_MIN  = 4 * 60;
  const NEW_TOPIC_MIN  = 50;
  const REVIEW_MIN     = { normal: 20, hard: 25 };
  const EXAM_BUFFER    = 2;
  const EXAM_WARN_DAYS = 3;

  const todayStr  = () => new Date().toISOString().slice(0, 10);
  const addDays   = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const diffDays  = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const fmtShort  = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' }) : '';
  const fmtMed    = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }) : '';

  // ── Fechas de examen ──────────────────────────────────────────
  function examKey(matId, parcial) { return `${matId}__${parcial}`; }

  function getExamDate(matId, parcial) {
    const sem = State._activeSem;
    if (!sem.examDates) sem.examDates = {};
    return sem.examDates[examKey(matId, parcial)] || null;
  }

  function setExamDate(matId, parcial, date) {
    const sem = State._activeSem;
    if (!sem.examDates) sem.examDates = {};
    if (date) {
      sem.examDates[examKey(matId, parcial)] = date;
    } else {
      delete sem.examDates[examKey(matId, parcial)];
    }
    saveState(['semestres']);
    _checkExamWarnings();
    renderDailyPlan();
    renderReviewQueue();
    renderPlannerTimeline();
  }

  // ── Carga real de un día ──────────────────────────────────────
  function getDayMinutes(dateStr) {
    let total = 0;
    State.tasks.filter(t => !t.done && t.datePlanned === dateStr)
      .forEach(t => { total += t.timeEst || 60; });
    State.tasks.filter(t => !t.done && (t.plannedWorkDates || []).includes(dateStr))
      .forEach(t => { total += Math.round((t.estHoursPerDay || 1) * 60); });
    State.topics.forEach(topic => {
      (topic.reviewSchedule || []).forEach(r => {
        if (r.date === dateStr && !r.done && r.status === 'pending')
          total += r.minutes || REVIEW_MIN[topic.difficulty || 'normal'];
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
    return { mins, pct, color: clr, label: `${(mins/60).toFixed(1)}h / 4h` };
  }

  // ── Encontrar mejor hueco dinámico ────────────────────────────
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
    if (!viable.length) return slots.sort((a,b) => a.load - b.load)[0]?.date || windowStart;
    viable.sort((a, b) => a.load - b.load);
    return viable[0].date;
  }

  // ── Generar repasos dinámicos ─────────────────────────────────
  function generateSmartReviews(topic) {
    const today    = todayStr();
    const examDate = getExamDate(topic.matId, topic.parcial);
    const diff     = topic.difficulty || 'normal';
    const mins     = REVIEW_MIN[diff];
    const reviews  = [];

    const winStart = addDays(today, 2);
    const winEnd   = examDate ? addDays(examDate, -EXAM_BUFFER) : addDays(today, 21);

    const totalDays = diffDays(winStart, winEnd);

    if (totalDays <= 0) {
      reviews.push({ date: addDays(today, 1), done: false, status: 'urgent', minutes: mins, num: 1 });
      return reviews;
    }

    const numReviews = diff === 'hard'
      ? (totalDays >= 10 ? 3 : totalDays >= 5 ? 2 : 1)
      : (totalDays >= 7  ? 2 : 1);

    for (let i = 0; i < numReviews; i++) {
      const segStart = addDays(winStart, Math.floor((totalDays / numReviews) * i));
      const segEnd   = addDays(winStart, Math.floor((totalDays / numReviews) * (i + 1)) - 1);
      const best     = findBestSlot(segStart, segEnd, mins);
      const load     = loadBar(best);
      reviews.push({ date: best, done: false, status: load.pct >= 100 ? 'low-priority' : 'pending', minutes: mins, num: i + 1 });
    }

    return reviews;
  }

  // ── Distribuir fechas de trabajo para una tarea ───────────────
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

  // ── Reagendar repasos sobrecargados ──────────────────────────
  function rescheduleAll() {
    const today = todayStr();
    let changed = false;
    State.topics.forEach(topic => {
      const examDate = getExamDate(topic.matId, topic.parcial);
      (topic.reviewSchedule || []).forEach(review => {
        if (review.done || review.date < today) return;
        const revMins = review.minutes || REVIEW_MIN[topic.difficulty || 'normal'];
        if (getDayMinutes(review.date) > MAX_DAILY_MIN) {
          const maxDate = examDate ? addDays(examDate, -1) : addDays(review.date, 7);
          const newDate = findBestSlot(addDays(review.date, 1), maxDate, revMins);
          if (newDate !== review.date) {
            const old = review.date;
            review.date = newDate;
            review.status = getDayMinutes(newDate) + revMins > MAX_DAILY_MIN ? 'low-priority' : 'pending';
            review.movedFrom = old;
            changed = true;
            _pushNotify('🔁 Repaso movido', `"${topic.name}" movido ${fmtShort(old)} → ${fmtShort(newDate)}`);
          }
        }
      });
    });
    if (changed) saveState(['topics']);
    return changed;
  }

  // ── Plan del día ──────────────────────────────────────────────
  function getDailyPlan(dateStr) {
    const plan = { date: dateStr, newTopics: [], reviews: [], tasks: [], totalMinutes: 0 };

    State.topics.filter(t => t.dateAdded === dateStr).forEach(t => {
      const m = getMat(t.matId);
      const mins = t.estMinutes || NEW_TOPIC_MIN;
      plan.newTopics.push({ id: t.id, name: t.name, parcial: t.parcial,
        matName: m.name||'—', matIcon: m.icon||'📚', matColor: m.color||'var(--accent)', minutes: mins });
      plan.totalMinutes += mins;
    });

    State.topics.forEach(topic => {
      (topic.reviewSchedule || []).forEach((r, idx) => {
        if (r.date !== dateStr || r.done) return;
        const m = getMat(topic.matId);
        plan.reviews.push({ topicId: topic.id, reviewIdx: idx, name: topic.name,
          difficulty: topic.difficulty||'normal', matName: m.name||'—', matIcon: m.icon||'📚',
          matColor: m.color||'var(--accent)', minutes: r.minutes||20, status: r.status, num: r.num||1 });
        if (r.status !== 'low-priority') plan.totalMinutes += (r.minutes||20);
      });
    });

    const seen = new Set();
    State.tasks.filter(t => !t.done && (t.datePlanned === dateStr || (t.plannedWorkDates||[]).includes(dateStr)))
      .forEach(t => {
        if (seen.has(t.id)) return;
        seen.add(t.id);
        const m = getMat(t.matId);
        const mins = t.datePlanned === dateStr ? (t.timeEst||60) : Math.round((t.estHoursPerDay||1)*60);
        plan.tasks.push({ id: t.id, title: t.title, due: t.due, priority: t.priority,
          matName: m.name||'—', matIcon: m.icon||'📚', matColor: m.color||'var(--accent)', minutes: mins });
        plan.totalMinutes += mins;
      });

    return plan;
  }

  // ── Avisos de examen próximo ──────────────────────────────────
  function _checkExamWarnings() {
    const today = todayStr();
    const sem   = State._activeSem;
    if (!sem.examDates) return;
    Object.entries(sem.examDates).forEach(([key, date]) => {
      if (!date) return;
      const days = diffDays(today, date);
      if (days <= 0 || days > EXAM_WARN_DAYS) return;
      const [matId, parcial] = key.split('__');
      const mat = getMat(matId);
      const label = days === 1 ? '¡Mañana!' : `En ${days} días`;
      _plannerToast(`📅 Examen ${mat.icon||'📚'} ${mat.name||matId} — ${label}`, 'warning');
      _pushNotify(`⚠️ Examen próximo: ${mat.name||matId}`, `${label} — Parcial ${parcial}`);
    });
  }

  // ── Acciones de repaso ────────────────────────────────────────
  function markReviewDone(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].done   = true;
    topic.reviewSchedule[reviewIdx].status = 'done';
    saveState(['topics']);
    renderDailyPlan();
    renderReviewQueue();
    renderPlannerTimeline();
    _plannerToast('✅ Repaso completado 🎉', 'ok');
  }

  function markReviewSkip(topicId, reviewIdx) {
    const topic = State.topics.find(t => t.id === topicId);
    if (!topic?.reviewSchedule?.[reviewIdx]) return;
    topic.reviewSchedule[reviewIdx].status = 'skipped';
    saveState(['topics']);
    renderDailyPlan();
    renderReviewQueue();
    renderPlannerTimeline();
  }

  // ── Push notifications ────────────────────────────────────────
  function _pushNotify(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then(sw => {
        sw.showNotification(title, { body, icon: '/assets/icons/icon-192.png',
          badge: '/assets/icons/icon-32.png', tag: 'planner-' + Date.now(), data: { url: '/index.html' } });
      }).catch(() => { try { new Notification(title, { body }); } catch(e) {} });
    }
  }

  // ── Toast visual ──────────────────────────────────────────────
  function _plannerToast(msg, type) {
    let el = document.getElementById('planner-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'planner-toast';
      el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--surface);border-radius:12px;font-size:13px;font-weight:700;z-index:4000;box-shadow:0 4px 24px rgba(0,0,0,.5);max-width:92vw;text-align:center;transition:opacity .3s;display:none;padding:10px 20px;';
      document.body.appendChild(el);
    }
    const colors = { ok: 'var(--accent)', warning: '#fbbf24', error: '#f87171' };
    el.style.border = `2px solid ${colors[type || 'ok']}`;
    el.style.color  = 'var(--text)';
    el.textContent  = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 350);
    }, 3500);
  }

  return {
    todayStr, addDays, diffDays, fmtShort, fmtMed,
    getExamDate, setExamDate,
    getDayMinutes, loadBar,
    findBestSlot, generateSmartReviews, planTaskDates,
    rescheduleAll, getDailyPlan,
    markReviewDone, markReviewSkip,
    _pushNotify, _plannerToast, _checkExamWarnings,
    MAX_DAILY_MIN, NEW_TOPIC_MIN,
  };
})();

// ═══════════════════════════════════════════════════════════════
// PLANNER UI
// ═══════════════════════════════════════════════════════════════

function renderPlannerTimeline() {
  const container = document.getElementById('planner-timeline');
  if (!container) return;

  const today     = PLANNER.todayStr();
  const days      = Array.from({ length: 14 }, (_, i) => PLANNER.addDays(today, i));
  const examDates = State._activeSem.examDates || {};

  const html = `
    <div class="ptl-wrap">
      ${days.map(d => {
        const lb      = PLANNER.loadBar(d);
        const isToday = d === today;
        const dayNum  = new Date(d + 'T00:00:00').getDate();
        const dayName = new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday:'short' }).slice(0,2);
        const examsToday = Object.entries(examDates).filter(([,date]) => date === d)
          .map(([key]) => getMat(key.split('__')[0]));
        const reviewsToday = State.topics.reduce((acc, t) =>
          acc + (t.reviewSchedule||[]).filter(r => r.date===d && !r.done).length, 0);
        const tasksToday = State.tasks.filter(t => !t.done && (t.datePlanned===d||(t.plannedWorkDates||[]).includes(d))).length;

        return `
          <div class="ptl-day ${isToday?'ptl-today':''}" title="${PLANNER.fmtMed(d)} · ${lb.label}">
            <div class="ptl-exams">
              ${examsToday.map(m=>`<span title="Examen ${m.name||''}" style="font-size:10px;">📝</span>`).join('')}
            </div>
            <div class="ptl-bar-wrap">
              <div class="ptl-bar" style="height:${lb.pct}%;background:${lb.color};"></div>
            </div>
            <div class="ptl-indicators">
              ${reviewsToday>0?`<span title="${reviewsToday} repaso(s)" style="font-size:9px;">🔁</span>`:''}
              ${tasksToday>0?`<span title="${tasksToday} tarea(s)" style="font-size:9px;">✅</span>`:''}
            </div>
            <div class="ptl-load-txt" style="color:${lb.color};">${lb.pct>=8?lb.pct+'%':''}</div>
            <div class="ptl-daynum" style="${isToday?'color:var(--accent2);font-weight:800;':''}">${dayNum}</div>
            <div class="ptl-dayname" style="${isToday?'color:var(--accent2);':''}">${dayName}</div>
          </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:12px;margin-top:7px;padding:0 2px;flex-wrap:wrap;">
      ${[['#4ade80','Libre'],['#60a5fa','Moderado'],['#fbbf24','Ocupado'],['#f87171','Lleno']].map(([c,l])=>
        `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:2px;background:${c};display:inline-block;"></span>${l}</span>`
      ).join('')}
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">📝=examen 🔁=repaso ✅=tarea</span>
    </div>`;

  container.innerHTML = html;
}

function renderDailyPlan(dateStr) {
  const target    = dateStr || PLANNER.todayStr();
  const container = document.getElementById('planner-daily-plan');
  if (!container) return;

  const plan  = PLANNER.getDailyPlan(target);
  const lb    = PLANNER.loadBar(target);
  const empty = !plan.newTopics.length && !plan.reviews.length && !plan.tasks.length;

  if (empty) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);"><div style="font-size:28px;margin-bottom:6px;">🎉</div><div style="font-size:13px;font-weight:700;color:var(--text2);">Sin pendientes hoy</div></div>`;
    return;
  }

  let html = `
    <div style="padding:10px 14px 6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">CARGA DEL DÍA</span>
        <span style="font-size:12px;font-weight:800;color:${lb.color};font-family:'Space Mono',monospace;">${lb.label}${lb.pct>=100?' ⚠️':''}</span>
      </div>
      <div class="prog-bar" style="height:6px;"><div class="prog-fill" style="background:${lb.color};width:${lb.pct}%;border-radius:3px;"></div></div>
      ${lb.pct>=100?`<div style="font-size:10px;color:#f87171;margin-top:3px;font-family:'Space Mono',monospace;">⚠ Día lleno — el algoritmo priorizará reprogramar</div>`:''}
    </div>`;

  if (plan.newTopics.length) {
    html += `<div class="planner-section-title">📖 Tema nuevo</div>`;
    html += plan.newTopics.map(t=>`
      <div class="planner-item">
        <div class="planner-dot" style="background:${t.matColor};"></div>
        <div class="planner-body"><div class="planner-name">${t.matIcon} ${t.name}</div><div class="planner-meta">${t.matName} · P${t.parcial}</div></div>
        <span class="planner-mins">${t.minutes} min</span>
      </div>`).join('');
  }

  if (plan.reviews.length) {
    html += `<div class="planner-section-title">🔁 Repasos (${plan.reviews.length})</div>`;
    html += plan.reviews.map(r=>`
      <div class="planner-item${r.status==='low-priority'?' planner-lowprio':''}">
        <div class="planner-dot" style="background:${r.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name">${r.matIcon} ${r.name} <span class="planner-tag-num">#${r.num}</span>${r.difficulty==='hard'?'<span class="planner-tag-hard">difícil</span>':''}${r.status==='low-priority'?'<span class="planner-tag-skip">↓ prioridad</span>':''}</div>
          <div class="planner-meta">${r.matName} · ${r.minutes} min</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn btn-ghost btn-sm planner-btn-done" onclick="PLANNER.markReviewDone('${r.topicId}',${r.reviewIdx})" title="Hecho" style="padding:4px 8px;">✅</button>
          <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewSkip('${r.topicId}',${r.reviewIdx})" title="Omitir" style="padding:4px 7px;">⏭</button>
        </div>
      </div>`).join('');
  }

  if (plan.tasks.length) {
    html += `<div class="planner-section-title">✅ Tareas del día</div>`;
    html += plan.tasks.map(t=>{
      const dStr = t.due ? `· 📅 ${new Date(t.due+'T00:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}` : '';
      const pc   = t.priority==='high'?'#f87171':t.priority==='low'?'#4ade80':'#fbbf24';
      return `<div class="planner-item" onclick="openTaskDetail('${t.id}')" style="cursor:pointer;">
        <div class="planner-dot" style="background:${t.matColor};"></div>
        <div class="planner-body"><div class="planner-name">${t.matIcon} ${t.title}</div><div class="planner-meta">${t.matName} ${dStr}</div></div>
        <span class="planner-mins" style="color:${pc};">${t.minutes} min</span>
      </div>`;
    }).join('');
  }

  container.innerHTML = html;
}

function renderReviewQueue() {
  const container = document.getElementById('planner-review-queue');
  if (!container) return;
  const today = PLANNER.todayStr();
  const items = [];

  State.topics.forEach(topic => {
    (topic.reviewSchedule||[]).forEach((r,idx) => {
      if (r.done || r.status==='skipped') return;
      const m = getMat(topic.matId);
      items.push({ topicId:topic.id, reviewIdx:idx, name:topic.name, difficulty:topic.difficulty||'normal',
        matName:m.name||'—', matIcon:m.icon||'📚', matColor:m.color||'var(--accent)',
        date:r.date, status:r.status, minutes:r.minutes||20, overdue:r.date<today, isToday:r.date===today,
        parcial:topic.parcial, num:r.num||1, movedFrom:r.movedFrom||null });
    });
  });

  items.sort((a,b) => a.date<b.date?-1:1);

  if (!items.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">✨ Sin repasos pendientes</div>`;
    return;
  }

  const grouped = {};
  items.forEach(i => { if (!grouped[i.date]) grouped[i.date]=[]; grouped[i.date].push(i); });

  let html = '';
  Object.keys(grouped).sort().forEach(date => {
    const isToday = date===today, isPast = date<today;
    const lb = PLANNER.loadBar(date);
    const label = isToday ? '📍 Hoy' : isPast ? `⚠️ ${PLANNER.fmtShort(date)}` : PLANNER.fmtShort(date);
    const hColor = isPast ? '#f87171' : isToday ? 'var(--accent2)' : 'var(--text2)';

    html += `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 14px 4px;border-bottom:1px solid var(--border);">
        <span style="font-size:11px;font-weight:800;color:${hColor};font-family:'Space Mono',monospace;">${label}</span>
        <div style="display:flex;align-items:center;gap:5px;">
          <div class="prog-bar" style="width:44px;height:4px;"><div class="prog-fill" style="background:${lb.color};width:${lb.pct}%;"></div></div>
          <span style="font-size:10px;color:${lb.color};font-family:'Space Mono',monospace;">${lb.label}</span>
        </div>
      </div>`;

    grouped[date].forEach(item => {
      html += `<div class="planner-item${item.status==='low-priority'?' planner-lowprio':''}">
        <div class="planner-dot" style="background:${item.matColor};"></div>
        <div class="planner-body">
          <div class="planner-name" style="font-size:12px;">${item.matIcon} ${item.name}
            <span class="planner-tag-num">#${item.num}</span>
            <span style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">P${item.parcial}</span>
            ${item.difficulty==='hard'?'<span class="planner-tag-hard">difícil</span>':''}
            ${item.movedFrom?`<span class="planner-tag-moved" title="Movido de ${PLANNER.fmtShort(item.movedFrom)}">↪</span>`:''}
            ${item.status==='low-priority'?'<span class="planner-tag-skip">↓</span>':''}
          </div>
          <div class="planner-meta">${item.matName} · ${item.minutes} min</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button class="btn btn-ghost btn-sm planner-btn-done" onclick="PLANNER.markReviewDone('${item.topicId}',${item.reviewIdx})" style="padding:3px 7px;">✅</button>
          <button class="btn btn-ghost btn-sm" onclick="PLANNER.markReviewSkip('${item.topicId}',${item.reviewIdx})" style="padding:3px 7px;">⏭</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// OVERRIDES: openTopicModal / saveTopic / renderTopics
// ═══════════════════════════════════════════════════════════════

function openTopicModal() {
  fillMatSels();
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value = '';
  if (document.getElementById('tp-difficulty'))   document.getElementById('tp-difficulty').value   = 'normal';
  if (document.getElementById('tp-date-added'))   document.getElementById('tp-date-added').value   = PLANNER.todayStr();
  if (document.getElementById('tp-est-minutes'))  document.getElementById('tp-est-minutes').value  = '50';
  _updateExamDateSelector();
  document.getElementById('modal-topic').classList.add('open');
}

function saveTopic() {
  const name = document.getElementById('tp-name').value.trim();
  if (!name) { document.getElementById('tp-name').style.borderColor='var(--red)'; return; }
  document.getElementById('tp-name').style.borderColor = '';

  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs    = subsRaw
    ? subsRaw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({name:s,seen:false,comp:0,done:false}))
    : [];

  const matId      = document.getElementById('tp-mat').value;
  const parcial    = document.getElementById('tp-parcial').value;
  const difficulty = document.getElementById('tp-difficulty')?.value    || 'normal';
  const dateAdded  = document.getElementById('tp-date-added')?.value    || PLANNER.todayStr();
  const estMinutes = parseInt(document.getElementById('tp-est-minutes')?.value) || 50;

  const examInput = document.getElementById('tp-exam-date');
  if (examInput?.value) PLANNER.setExamDate(matId, parcial, examInput.value);

  const topic = { id: Date.now().toString(), matId, parcial, name, seen:false, comp:0, subs, difficulty, dateAdded, estMinutes, reviewSchedule:[] };

  if (!subs.length) {
    topic.reviewSchedule = PLANNER.generateSmartReviews(topic);
    const next = topic.reviewSchedule.find(r => r.status==='pending');
    if (next) PLANNER._plannerToast(`✅ Guardado · próximo repaso ${PLANNER.fmtShort(next.date)}`);
    else PLANNER._plannerToast('✅ Tema guardado');
  } else {
    PLANNER._plannerToast('✅ Guardado · marca subtemas para activar repasos');
  }

  State.topics.push(topic);
  saveState(['topics']);
  closeModal('modal-topic');
  renderTopics();
  renderDailyPlan();
  renderReviewQueue();
  renderPlannerTimeline();
  PLANNER._checkExamWarnings();
}

function _updateExamDateSelector() {
  const matId   = document.getElementById('tp-mat')?.value;
  const parcial = document.getElementById('tp-parcial')?.value;
  const el      = document.getElementById('tp-exam-date');
  if (!el || !matId || !parcial) return;
  el.value = PLANNER.getExamDate(matId, parcial) || '';
}

function togglePlannerSubtopic(topicId, subIdx) {
  const topic = State.topics.find(t => t.id === topicId);
  if (!topic?.subs?.[subIdx]) return;

  topic.subs[subIdx].done = !topic.subs[subIdx].done;
  topic.subs[subIdx].seen = topic.subs[subIdx].done;
  if (topic.subs[subIdx].done) topic.subs[subIdx].comp = 100;

  const anyDone   = topic.subs.some(s => s.done);
  const hasReviews = (topic.reviewSchedule||[]).length > 0;

  if (anyDone && !hasReviews) {
    topic.reviewSchedule = PLANNER.generateSmartReviews(topic);
    const next = topic.reviewSchedule.find(r => r.status==='pending');
    if (next) {
      PLANNER._plannerToast(`🔁 Repasos agendados · próximo ${PLANNER.fmtShort(next.date)}`);
      PLANNER._pushNotify(`🔁 Repasos: ${topic.name}`, `Próximo repaso el ${PLANNER.fmtShort(next.date)}`);
    }
  }

  saveState(['topics']);
  renderTopics();
  renderDailyPlan();
  renderReviewQueue();
  renderPlannerTimeline();
}

function renderTopics() {
  const matId     = document.getElementById('topics-mat-sel')?.value || '';
  const container = document.getElementById('topics-container');
  if (!container) return;
  if (!matId) { container.innerHTML = ''; return; }

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
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
      <div class="stat-mini"><div class="stat-mini-lbl">✅ VISTOS</div>
        <div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div>
        <div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT?seenT/totalT*100:0}%;"></div></div>
      </div>
      <div class="stat-mini"><div class="stat-mini-lbl">🧠 COMPRENSIÓN</div>
        <div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div>
        <div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div>
      </div>
      <div class="stat-mini"><div class="stat-mini-lbl">⚠️ REPASO</div>
        <div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">&lt;70% comp.</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><span class="card-title" style="font-size:12px;">📝 Fechas de Examen</span></div>
      <div class="card-body" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:10px 14px;">
        ${parciales.map(p => {
          const key  = `${matId}__${p}`;
          const date = examDates[key] || '';
          const days = date ? PLANNER.diffDays(today, date) : null;
          const urg  = days!==null && days<=3 ? '#f87171' : days!==null && days<=7 ? '#fbbf24' : 'var(--text3)';
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
    const examDate   = PLANNER.getExamDate(matId, p.v);
    const daysToExam = examDate ? PLANNER.diffDays(today, examDate) : null;
    const examBadge  = daysToExam!==null
      ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;background:${daysToExam<=3?'rgba(248,113,113,.2)':daysToExam<=7?'rgba(251,191,36,.2)':'var(--surface2)'};color:${daysToExam<=3?'#f87171':daysToExam<=7?'#fbbf24':'var(--text3)'};">
          📝 ${daysToExam===0?'¡Hoy!':daysToExam<0?'Pasado':`En ${daysToExam}d`}
        </span>` : '';

    html += `<div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="border-left:3px solid ${mat.color};">
        <span class="card-title" style="padding-left:8px;">📖 ${p.l}</span>
        <div style="display:flex;gap:8px;align-items:center;">${examBadge}
          <span style="font-size:11px;color:var(--text3);">${pts.filter(t=>t.subs?.some(s=>s.done)||t.seen).length}/${pts.length}</span>
        </div>
      </div>
      <div class="card-body" style="padding:0;">${pts.map(t=>_renderTopicItem(t,mat)).join('')}</div>
    </div>`;
  });

  if (!any) html += `<div style="text-align:center;padding:48px;color:var(--text3);">📖 Presiona "+ Agregar Tema" para comenzar</div>`;
  container.innerHTML = html;
}

function _renderTopicItem(t, mat) {
  const today      = PLANNER.todayStr();
  const hasSubs    = t.subs && t.subs.length > 0;
  const anyDone    = t.subs?.some(s => s.done);
  const allDone    = hasSubs && t.subs.every(s => s.done);
  const hasReviews = (t.reviewSchedule||[]).length > 0;
  const nextReview = hasReviews ? t.reviewSchedule.find(r => !r.done && r.status==='pending') : null;
  const doneSubs   = t.subs?.filter(s=>s.done).length || 0;
  const totalSubs  = t.subs?.length || 0;
  const pendRevs   = (t.reviewSchedule||[]).filter(r=>!r.done&&r.status!=='skipped');
  const doneRevs   = (t.reviewSchedule||[]).filter(r=>r.done).length;
  const dotColor   = allDone ? '#4ade80' : anyDone ? '#fbbf24' : mat.color;

  return `<div class="planner-topic-item" id="topic-item-${t.id}">
    <div class="planner-topic-header" onclick="togglePlannerTopic('${t.id}')">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.name}</div>
          <div style="display:flex;gap:7px;align-items:center;margin-top:2px;flex-wrap:wrap;">
            ${hasSubs ? `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${doneSubs}/${totalSubs} sub.</span>` : ''}
            ${nextReview ? `<span style="font-size:10px;color:var(--accent2);font-family:'Space Mono',monospace;">🔁 ${nextReview.date===today?'hoy':PLANNER.fmtShort(nextReview.date)}</span>` : ''}
            ${!hasReviews && !hasSubs ? `<span style="font-size:10px;color:var(--text3);">sin repasos</span>` : ''}
            ${t.difficulty==='hard' ? `<span class="planner-tag-hard">difícil</span>` : ''}
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
      ${hasSubs ? `<div style="padding:8px 14px 4px;">
          <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">SUBTEMAS — marca cuando lo ves en clase</div>
          ${t.subs.map((s,i)=>`
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="togglePlannerSubtopic('${t.id}',${i})">
              <div style="width:18px;height:18px;border-radius:5px;flex-shrink:0;border:2px solid ${s.done?'#4ade80':'var(--border2)'};background:${s.done?'#4ade80':'transparent'};display:flex;align-items:center;justify-content:center;">
                ${s.done?'<span style="font-size:11px;color:#111;">✓</span>':''}
              </div>
              <span style="font-size:12px;flex:1;${s.done?'text-decoration:line-through;color:var(--text3);':''}">${s.name}</span>
            </div>`).join('')}
        </div>` : `<div style="padding:8px 14px 4px;font-size:11px;color:var(--text3);">Sin subtemas · repasos se generaron al crear el tema</div>`}

      ${pendRevs.length>0 ? `<div style="padding:8px 14px;border-top:1px solid var(--border);">
          <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">REPASOS AGENDADOS</div>
          ${pendRevs.map(r=>{
            const lb = PLANNER.loadBar(r.date);
            const isT = r.date===today;
            return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;">
              <span style="font-family:'Space Mono',monospace;color:${isT?'var(--accent2)':'var(--text2)'};font-weight:${isT?800:400};min-width:70px;">${isT?'HOY':PLANNER.fmtShort(r.date)}</span>
              <div class="prog-bar" style="width:36px;height:4px;flex-shrink:0;"><div class="prog-fill" style="background:${lb.color};width:${lb.pct}%;"></div></div>
              <span style="color:${lb.color};font-size:10px;flex:1;">${lb.label}</span>
              <span style="color:var(--text3);">${r.minutes}min</span>
              ${r.status==='low-priority'?'<span class="planner-tag-skip">↓</span>':''}
            </div>`;
          }).join('')}
        </div>` : hasSubs ? `<div style="padding:6px 14px 8px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">↑ Marca un subtema para activar repasos</div>` : ''}
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

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof State === 'undefined') return;
    PLANNER.rescheduleAll();
    PLANNER._checkExamWarnings();
    renderDailyPlan();
    renderReviewQueue();
    renderPlannerTimeline();
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 4000);
    }
  }, 700);
});
