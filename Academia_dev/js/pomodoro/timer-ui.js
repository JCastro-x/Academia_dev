// ═══════════════════════════════════════════════════════════════
// POMODORO TIMER UI — Renderizado y manipulación del DOM
// Escucha CustomEvents de timer-core.js para actualizarse
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Actualización de display principal
// ═══════════════════════════════════════════════════════════════
function updatePomDisp() {
  const timeEl = document.getElementById('pom-time');
  const ringEl = document.getElementById('pom-ring');
  const modeEl = document.getElementById('pom-mode');
  if (!timeEl || !ringEl || !modeEl) return;
  
  const m = Math.floor(window.pomSL / 60);
  const s = window.pomSL % 60;
  timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  
  const circ = 2 * Math.PI * 82;
  const prog = window.pomTS > 0 ? window.pomSL / window.pomTS : 1;
  ringEl.style.strokeDashoffset = circ * (1 - prog);
  
  // Color: verde para descanso normal, amarillo para descanso largo, accent para enfoque
  if (window.pomB) {
    ringEl.style.stroke = window._pomIsLongBreak ? '#fbbf24' : '#4ade80';
    modeEl.textContent = window._pomIsLongBreak ? 'DESCANSO LARGO' : 'DESCANSO';
  } else {
    ringEl.style.stroke = 'var(--accent)';
    modeEl.textContent = 'ENFOQUE';
  }
}

function updatePomDots() {
  const dotsEl = document.getElementById('pom-dots');
  if (!dotsEl) return;
  const cycles = parseInt(document.getElementById('pom-cycles')?.value) || 4;
  dotsEl.innerHTML = Array.from({ length: cycles }, (_, i) =>
    `<div style="width:9px;height:9px;border-radius:50%;background:${i < window.pomD % cycles ? 'var(--accent)' : 'var(--border2)'};"></div>`
  ).join('');
}

// Inicializar listeners para guardar configuración y actualizar dots
function initPomSettingsListeners() {
  const workInput = document.getElementById('pom-work');
  const breakInput = document.getElementById('pom-break');
  const longBreakInput = document.getElementById('pom-long-break');
  const cyclesInput = document.getElementById('pom-cycles');

  if (workInput) {
    workInput.addEventListener('change', () => {
      if (typeof savePomSettings === 'function') savePomSettings();
    });
  }
  if (breakInput) {
    breakInput.addEventListener('change', () => {
      if (typeof savePomSettings === 'function') savePomSettings();
    });
  }
  if (longBreakInput) {
    longBreakInput.addEventListener('change', () => {
      if (typeof savePomSettings === 'function') savePomSettings();
    });
  }
  if (cyclesInput) {
    cyclesInput.addEventListener('change', () => {
      if (typeof savePomSettings === 'function') savePomSettings();
      updatePomDots();
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Renderizado de historial
// ═══════════════════════════════════════════════════════════════
function renderPomHistory() {
  const hist = document.getElementById('pom-history');
  if (!hist) return;
  
  _ensurePomStateContainers();
  const todayKey = _pomTodayKey();
  if (!Array.isArray(State.pomHistory[todayKey])) {
    State.pomHistory[todayKey] = Array.isArray(State.pomSessions) ? [...State.pomSessions] : [];
  }
  const days = Object.keys(State.pomHistory).sort((a, b) => b.localeCompare(a)).slice(0, 14);
  const todaySessions = State.pomHistory[todayKey] || [];
  State.pomSessions = [...todaySessions];
  
  if (!days.length) {
    hist.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3);">⏱️ Sin sesiones registradas aún<br><span style="font-size:11px;margin-top:6px;display:block;">¡Inicia tu primera sesión!</span></div>`;
  } else {
    hist.innerHTML = days.map((dayKey) => {
      const daySessions = (State.pomHistory[dayKey] || []).slice().reverse();
      const dayTotalMins = daySessions.reduce((acc, s) => acc + (s.mins || 0), 0);
      const dayHeader = `<div style="position:sticky;top:0;z-index:1;background:var(--surface);padding:8px 14px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--accent2);font-family:'Space Mono',monospace;font-weight:700;">${_pomDateLabel(dayKey)}${dayKey === todayKey ? ' · HOY' : ''}</span>
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${daySessions.length} sesiones · ${dayTotalMins} min</span>
      </div>`;
      const dayRows = daySessions.map((s, i) => {
        const partialBadge = s.partial ? `<span style="font-size:9px;background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:4px;padding:1px 5px;font-family:'Space Mono',monospace;">PARCIAL</span>` : '';
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);border-left:3px solid ${s.partial ? '#fbbf24' : 'var(--accent)'};">
          <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);font-weight:700;flex-shrink:0;padding-top:1px;">#${daySessions.length - i}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">${s.subject} ${partialBadge}</div>
            ${s.taskTitle && !s.taskTitle.includes('Sin tarea') ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">📋 ${s.taskTitle.replace(/^[^\s]+ /, '').split(' · ')[0].substring(0, 40)}</div>` : ''}
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${s.time} · ${s.mins || 25} min enfocado</div>
          </div>
          <div style="font-size:18px;">${s.partial ? '⏳' : '✅'}</div>
        </div>`;
      }).join('');
      return `${dayHeader}${dayRows}`;
    }).join('');
  }
  // Update stats
  const totalEl = document.getElementById('pom-stat-total');
  const minsEl = document.getElementById('pom-stat-mins');
  if (totalEl) totalEl.textContent = todaySessions.length;
  if (minsEl) minsEl.textContent = todaySessions.reduce((a, s) => a + (s.mins || 25), 0);
  renderPomGoal();
}

// ═══════════════════════════════════════════════════════════════
// Meta diaria y progreso
// ═══════════════════════════════════════════════════════════════
function renderPomGoal() {
  const goalInput = document.getElementById('pom-goal');
  if (goalInput && !goalInput.dataset.bound) {
    goalInput.dataset.bound = '1';
    goalInput.value = String(Number(State.settings?.pomDailyGoal) || Number(goalInput.value) || 4);
    goalInput.addEventListener('input', () => {
      State.settings.pomDailyGoal = parseInt(goalInput.value || '4', 10) || 4;
      saveState(['settings']);
    });
  }
  const goal = parseInt(goalInput?.value || State.settings?.pomDailyGoal || 4, 10) || 4;
  State.settings.pomDailyGoal = goal;
  const done = State.pomSessions.length;
  const pct = Math.min((done / goal) * 100, 100);
  const doneEl = document.getElementById('pom-goal-done');
  const barEl = document.getElementById('pom-goal-bar');
  const labelEl = document.getElementById('pom-goal-label');
  const streakEl = document.getElementById('pom-stat-streak');
  
  if (doneEl) doneEl.textContent = done;
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 100 ? '#4ade80' : 'var(--accent2)';
  }
  if (labelEl) {
    labelEl.textContent = pct >= 100
      ? `🎉 ¡Meta alcanzada! ${done} sesiones hoy`
      : `${done} de ${goal} sesiones · ${Math.round(pct)}%`;
  }
  _capturePomSnapshotIfGoalReached(goal, done);
  // Streak
  if (streakEl) {
    const sd = typeof _getStreakData === 'function' ? _getStreakData() : { count: 0 };
    streakEl.textContent = `🔥 ${sd.count}`;
  }
  // Week stats
  _renderPomWeekStats();
}

// ═══════════════════════════════════════════════════════════════
// Estadísticas semanales
// ═══════════════════════════════════════════════════════════════
function _renderPomWeekStats() {
  const arr = _getPomWeekHistory();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const weekSessions = arr.filter(s => days.includes(s.date));
  const weekMins = weekSessions.reduce((a, s) => a + (s.mins || 0), 0);
  const wsEl = document.getElementById('pom-stat-week-sessions');
  const wmEl = document.getElementById('pom-stat-week-mins');
  if (wsEl) wsEl.textContent = weekSessions.length;
  if (wmEl) wmEl.textContent = weekMins;
  // Mini bar chart
  const barsEl = document.getElementById('pom-week-bars');
  if (barsEl) {
    const maxMins = Math.max(1, ...days.map(d => arr.filter(s => s.date === d).reduce((a, s) => a + (s.mins || 0), 0)));
    const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    barsEl.innerHTML = days.map(d => {
      const mins = arr.filter(s => s.date === d).reduce((a, s) => a + (s.mins || 0), 0);
      const h = Math.round((mins / maxMins) * 36) || 2;
      const isToday = d === today.toISOString().slice(0, 10);
      const dd = new Date(d); const dayIdx = dd.getDay();
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
        <div title="${mins} min" style="width:100%;height:${h}px;background:${isToday ? 'var(--accent2)' : 'var(--accent)'};border-radius:3px 3px 0 0;opacity:${mins > 0 ? 1 : 0.2};min-height:2px;"></div>
        <div style="font-size:8px;color:${isToday ? 'var(--accent2)' : 'var(--text3)'};font-family:'Space Mono',monospace;">${dayNames[dayIdx]}</div>
      </div>`;
    }).join('');
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper de formato de fecha
// ═══════════════════════════════════════════════════════════════
function _pomDateLabel(isoDate) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  } catch (e) {
    return isoDate;
  }
}

// ═══════════════════════════════════════════════════════════════
// Listeners de CustomEvents para auto-actualizar UI
// ═══════════════════════════════════════════════════════════════
window.addEventListener('pomodoro:tick', () => {
  updatePomDisp();
});

window.addEventListener('pomodoro:start', (e) => {
  updatePomDisp();
  updatePomDots();
  const btn = document.getElementById('pom-btn');
  if (btn) btn.textContent = '⏸ Pausar';
});

window.addEventListener('pomodoro:pause', () => {
  const btn = document.getElementById('pom-btn');
  if (btn) btn.textContent = '▶ Reanudar';
});

window.addEventListener('pomodoro:reset', () => {
  updatePomDisp();
  updatePomDots();
  const btn = document.getElementById('pom-btn');
  if (btn) btn.textContent = '▶ Iniciar';
});

window.addEventListener('pomodoro:finish', (e) => {
  updatePomDisp();
  updatePomDots();
  const btn = document.getElementById('pom-btn');
  if (btn) btn.textContent = '▶ Iniciar';
  renderPomHistory();
});

window.addEventListener('pomodoro:phase-change', (e) => {
  updatePomDisp();
});

window.addEventListener('pomodoro:restored', () => {
  updatePomDisp();
  updatePomDots();
  renderPomHistory();
});

window.addEventListener('pomodoro:session-saved', () => {
  renderPomHistory();
});

// ═══════════════════════════════════════════════════════════════
// Exponer funciones al window
// ═══════════════════════════════════════════════════════════════
window.updatePomDisp = updatePomDisp;
window.updatePomDots = updatePomDots;
window.renderPomHistory = renderPomHistory;
window.renderPomGoal = renderPomGoal;
window._renderPomWeekStats = _renderPomWeekStats;
window._pomDateLabel = _pomDateLabel;
window.initPomSettingsListeners = initPomSettingsListeners;
