// ═══════════════════════════════════════════════════════════════
// CHRONO UI — Dashboard, Kanban e Interfaz del Cronómetro
// Renderizado de Hoy Page, Kanban board y controles del cronómetro
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// HOY PAGE — Dashboard "¿Qué hago hoy?"
// ═══════════════════════════════════════════════════════════════
function renderHoyPage() {
  const container = document.getElementById('hoy-container');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);

  // Streak
  const streak = typeof _getStreakData === 'function' ? _getStreakData() : { count: 0 };
  const streakHtml = streak.count > 0
    ? `<div class="streak-badge"><span class="streak-fire">🔥</span> ${streak.count} día${streak.count !== 1 ? 's' : ''} de racha</div>` : '';

  // Overdue + today tasks
  const dueTasks = State.tasks.filter(t => !t.done && t.due && t.due <= today);
  const noDateTasks = State.tasks.filter(t => !t.done && !t.due).slice(0, 5);

  // Today events
  const todayEvents = [...(State.events || []), ...State.tasks.filter(t => t.due === today && !t.done)]
    .filter(e => (e.date || e.due) === today);

  // Topics with low comprehension
  const weakTopics = (State.topics || []).filter(t => (t.comprension || 3) <= 2).slice(0, 4);

  // Weekly load for today
  const todayMinutes = State.tasks.filter(t => !t.done && t.due === today && t.timeEst)
    .reduce((s, t) => s + (t.timeEst || 0), 0);

  // Motivational message
  const pending = dueTasks.length + noDateTasks.length;
  const motivations = [
    '¡Excelente! No tienes pendientes urgentes. 🎉',
    '¡Casi todo en orden! Solo un pendiente. 💪',
    `Tienes ${pending} cosas pendientes. ¡Puedes con todo! 🚀`,
    `${pending} pendientes. Empieza con la más pequeña. 🎯`,
    `${pending} pendientes. Divide y conquista. ⚡`
  ];
  const motivIdx = Math.min(pending, motivations.length - 1);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      <div>
        <div style="font-size:10px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:2px;text-transform:uppercase;">${todayStr}</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px;">☀️ ¿Qué hago hoy?</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${streakHtml}
        ${todayMinutes ? `<div style="background:var(--accent-glow);border:1px solid rgba(124,106,255,.3);color:var(--accent2);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;">⏱ ~${todayMinutes >= 60 ? (todayMinutes / 60).toFixed(1) + 'h' : todayMinutes + 'min'} estimados hoy</div>` : ''}
      </div>
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:13px;">
      ${motivations[motivIdx]}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      
      <div class="card">
        <div class="card-header"><span class="card-title">🔥 Pendientes urgentes${dueTasks.length ? ` (${dueTasks.length})` : ''}</span></div>
        <div class="card-body" style="padding:0;">
          ${dueTasks.length ? dueTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">✅ Sin pendientes vencidos</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📅 Eventos de hoy</span></div>
        <div class="card-body" style="padding:0;">
          ${todayEvents.length ? todayEvents.map(e => `
            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px;">
              <div style="font-weight:700;">${e.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${e.type || 'Evento'} ${e.time ? '· ' + e.time : ''}</div>
            </div>`).join('') : '<div class="hoy-empty">📭 Sin eventos hoy</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📋 Sin fecha asignada</span></div>
        <div class="card-body" style="padding:0;">
          ${noDateTasks.length ? noDateTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">Todo organizado ✨</div>'}
        </div>
      </div>

      ${weakTopics.length ? `
      <div class="card">
        <div class="card-header"><span class="card-title">📚 Temas para repasar</span></div>
        <div class="card-body" style="padding:0;">
          ${weakTopics.map(tp => {
            const m = getMat(tp.matId);
            return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);">
              <div style="font-size:12px;font-weight:700;">${tp.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${m.icon || '📚'} ${m.name} · ${'⭐'.repeat(tp.comprension || 1)} comprensión</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

    </div>`;
}

function _hoyTaskHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;">
    <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}');renderHoyPage();" style="margin-top:1px;flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;">${t.title}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">
        ${m.icon || '📚'} ${m.name || '—'} 
        ${t.due ? `· <span class="${dc}" style="font-size:11px;">📅 ${fmtD(t.due)}</span>` : ''}
        ${t.timeEst ? `· ⏱ ${t.timeEst >= 60 ? (t.timeEst / 60) + 'h' : t.timeEst + 'min'}` : ''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// KANBAN BOARD
// ═══════════════════════════════════════════════════════════════
const KANBAN_COLS = [
  { id: 'todo', label: '📋 Por Hacer', color: 'var(--text3)' },
  { id: 'inprogress', label: '⚡ En Progreso', color: 'var(--yellow)' },
  { id: 'done', label: '✅ Completado', color: 'var(--green)' },
];

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  if (typeof fillMatSels === 'function') fillMatSels();

  board.innerHTML = KANBAN_COLS.map(col => {
    const tasks = State.tasks.filter(t => {
      const tCol = t.kanbanCol || (t.done ? 'done' : 'todo');
      return tCol === col.id;
    });
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title" style="color:${col.color};">${col.label}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text3);">${tasks.length}</span>
      </div>
      <div class="kanban-col-body kanban-drop-zone" id="kcol-${col.id}"
        ondragover="kDragOver(event,'${col.id}')"
        ondrop="kDrop(event,'${col.id}')"
        ondragleave="kDragLeave(event)">
        ${tasks.map(t => _kanbanCardHtml(t)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _kanbanCardHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  const tagsHtml = (t.tags || []).map(tg => `<span class="tag-chip">#${tg}</span>`).join('');
  return `<div class="kanban-card" draggable="true" data-id="${t.id}"
    ondragstart="kCardDragStart(event,'${t.id}')" onclick="openTaskModal('${t.id}')">
    <div class="kc-title">${t.title}</div>
    <div class="kc-meta">
      <span style="color:${m.color || 'var(--accent)'};">${m.icon || '📚'} ${m.code || '?'}</span>
      ${prioBadge(t.priority)}
      ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
      ${t.timeEst ? `<span>⏱ ${t.timeEst >= 60 ? (t.timeEst / 60) + 'h' : t.timeEst + 'min'}</span>` : ''}
    </div>
    ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
  </div>`;
}

let _kDragId = null;
function kCardDragStart(e, id) { _kDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function kDragOver(e, colId) { e.preventDefault(); document.getElementById('kcol-' + colId)?.classList.add('over'); }
function kDragLeave(e) { e.currentTarget.classList.remove('over'); }
function kDrop(e, colId) {
  e.preventDefault();
  e.currentTarget.classList.remove('over');
  if (!_kDragId) return;
  const t = State.tasks.find(x => x.id === _kDragId);
  if (t) {
    t.kanbanCol = colId;
    if (colId === 'done') { const wasDone = t.done; t.done = true; if (!wasDone && typeof _uiClick === 'function') _uiClick('task-done'); }
    else if (colId === 'todo') t.done = false;
    saveState(['tasks']); 
    if (typeof updateBadge === 'function') updateBadge(); 
    renderKanban(); 
    if (typeof renderOverview === 'function') renderOverview();
  }
  _kDragId = null;
}

// ═══════════════════════════════════════════════════════════════
// CRONÓMETRO UI — Controles y actualización visual
// ═══════════════════════════════════════════════════════════════
function _chronoUpdateUI() {
  const wEl = document.getElementById('chrono-work');
  const bEl = document.getElementById('chrono-break');
  const tEl = document.getElementById('chrono-total');
  const stEl = document.getElementById('chrono-status');
  const pctEl = document.getElementById('chrono-pct');
  const barEl = document.getElementById('chrono-bar');

  if (wEl) wEl.textContent = typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoWorkSec || 0) : '00:00:00';
  if (bEl) bEl.textContent = typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoBreakSec || 0) : '00:00:00';
  if (tEl) tEl.textContent = typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoTotalSec || 0) : '00:00:00';

  // Status text
  if (stEl) {
    if (!window.chronoR) stEl.textContent = '⏸ Pausado';
    else if (window.chronoPomLive && window.chronoPhase === 'work') stEl.textContent = '📚 Estudiando (con Pomodoro)';
    else if (window.chronoPomLive && window.chronoPhase === 'break') stEl.textContent = '☕ Descanso (Pomodoro)';
    else if (!window.chronoPomLinked && window.chronoPhase === 'work') stEl.textContent = '📚 Modo independiente — estudiando';
    else stEl.textContent = '☕ Descansando — tiempo real sigue corriendo';
  }

  // Efficiency
  const pct = (window.chronoTotalSec || 0) > 0 ? Math.round(((window.chronoWorkSec || 0) / (window.chronoTotalSec || 1)) * 100) : 0;
  if (pctEl) {
    pctEl.textContent = (window.chronoTotalSec || 0) > 0 ? `${pct}%` : '—';
    pctEl.style.color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
}

function _chronoUpdateSwitchBtn() {
  const btn = document.getElementById('chrono-switch-btn');
  if (!btn) return;
  btn.textContent = window.chronoPhase === 'work' ? '☕ Cambiar a descanso' : '📚 Cambiar a estudio';
}

function chronoToggle() {
  const btn = document.getElementById('chrono-btn');
  if (window.chronoR) {
    window.chronoR = false;
    if (btn) btn.textContent = '▶ Continuar';
  } else {
    window.chronoR = true;
    if (typeof pomR !== 'undefined' && pomR) {
      window.chronoPhase = pomB ? 'break' : 'work';
      window.chronoPomLive = !pomB;
      const badge = document.getElementById('chrono-mode-badge');
      if (badge) badge.textContent = 'POMODORO';
    } else {
      window.chronoPomLive = false;
      window.chronoPomLinked = false;
      const badge = document.getElementById('chrono-mode-badge');
      if (badge) badge.textContent = 'INDEPENDIENTE';
    }
    if (btn) btn.textContent = '⏸ Pausar';
    if (!window.chronoI && typeof _chronoTickStart === 'function') _chronoTickStart();
  }
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

function chronoSwitchPhase() {
  window.chronoPhase = window.chronoPhase === 'work' ? 'break' : 'work';
  _chronoUpdateSwitchBtn();
  _chronoUpdateUI();
}

async function chronoReset() {
  if ((window.chronoTotalSec || 0) > 0) {
    const confirmed = await showConfirm('¿Reiniciar el cronómetro? Se perderá el tiempo acumulado.', { danger: true });
    if (!confirmed) return;
  }
  window.chronoR = false; window.chronoPhase = 'work'; window.chronoPomLive = false; window.chronoPomLinked = false;
  window.chronoWorkSec = 0; window.chronoBreakSec = 0; window.chronoTotalSec = 0;
  if (window.chronoI) { clearInterval(window.chronoI); window.chronoI = null; }
  const btn = document.getElementById('chrono-btn');
  const badge = document.getElementById('chrono-mode-badge');
  if (btn) btn.textContent = '▶ Iniciar';
  if (badge) badge.textContent = 'INDEPENDIENTE';
  const summary = document.getElementById('chrono-summary');
  if (summary) summary.style.display = 'none';
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
  window.dispatchEvent(new CustomEvent('chrono:reset'));
}

function chronoSave() {
  if ((window.chronoTotalSec || 0) < 60) {
    if (typeof _appNotify === 'function') _appNotify('Menos de 1 minuto registrado. ¡Estudia un poco más! 😄', 'warning');
    return;
  }
  window.chronoR = false; window.chronoPomLive = false;
  if (window.chronoI) { clearInterval(window.chronoI); window.chronoI = null; }
  const btn = document.getElementById('chrono-btn');
  if (btn) btn.textContent = '▶ Iniciar';

  const workMins = Math.round((window.chronoWorkSec || 0) / 60);
  const breakMins = Math.round((window.chronoBreakSec || 0) / 60);
  const totalMins = Math.round((window.chronoTotalSec || 0) / 60);
  const pct = (window.chronoTotalSec || 0) > 0 ? Math.round(((window.chronoWorkSec || 0) / (window.chronoTotalSec || 1)) * 100) : 0;

  const summary = document.getElementById('chrono-summary');
  const summaryText = document.getElementById('chrono-summary-text');
  if (summary && summaryText) {
    summary.style.display = 'block';
    summaryText.innerHTML = [
      `📚 Efectivo &nbsp;: ${typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoWorkSec || 0) : '00:00:00'} (${workMins} min)`,
      `☕ Descanso &nbsp;: ${typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoBreakSec || 0) : '00:00:00'} (${breakMins} min)`,
      `⏱️ Tiempo real: ${typeof _chronoFmt === 'function' ? _chronoFmt(window.chronoTotalSec || 0) : '00:00:00'} (${totalMins} min)`,
      `📊 Eficiencia &nbsp;: <strong style="color:${pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'}">${pct}%</strong>`,
    ].join('<br>');
  }

  const badge = document.getElementById('chrono-mode-badge');
  if (badge) badge.textContent = 'GUARDADO';
  if (workMins >= 1) { 
    if (typeof _recordPomWeekSession === 'function') _recordPomWeekSession(workMins); 
    if (typeof _updateStreak === 'function') _updateStreak(); 
    if (typeof renderPomGoal === 'function') renderPomGoal(); 
  }
  _chronoUpdateUI();
  if (typeof _appNotify === 'function') _appNotify(`✅ Sesión guardada!\n📚 Efectivo: ${workMins} min\n☕ Descanso: ${breakMins} min\n⏱️ Real: ${totalMins} min\n📊 ${pct}% eficiencia`, 'ok');
  window.dispatchEvent(new CustomEvent('chrono:session-saved', { detail: { workMins, breakMins, pct } }));
}

// ═══════════════════════════════════════════════════════════════
// LISTENERS DE EVENTOS
// ═══════════════════════════════════════════════════════════════
window.addEventListener('chrono:tick', () => { _chronoUpdateUI(); });
window.addEventListener('chrono:pom-sync', () => { _chronoUpdateUI(); _chronoUpdateSwitchBtn(); });

// ═══════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════
window.renderHoyPage = renderHoyPage;
window._hoyTaskHtml = _hoyTaskHtml;
window.renderKanban = renderKanban;
window._kanbanCardHtml = _kanbanCardHtml;
window.kCardDragStart = kCardDragStart;
window.kDragOver = kDragOver;
window.kDragLeave = kDragLeave;
window.kDrop = kDrop;
window._chronoUpdateUI = _chronoUpdateUI;
window._chronoUpdateSwitchBtn = _chronoUpdateSwitchBtn;
window.chronoToggle = chronoToggle;
window.chronoSwitchPhase = chronoSwitchPhase;
window.chronoReset = chronoReset;
window.chronoSave = chronoSave;
