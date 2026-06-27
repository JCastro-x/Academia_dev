// ═══════════════════════════════════════════════════════════════
// POMODORO TIMER CORE — Máquina de estados del temporizador
// Lógica pura, sin manipulación DOM directa (usa CustomEvents)
// ═══════════════════════════════════════════════════════════════

// Estado global del pomodoro (expuesto a window para compatibilidad)
window.pomR = false;    // ¿Está corriendo?
window.pomB = false;    // ¿Está en break?
window.pomSL = 0;     // Segundos restantes
window.pomTS = 0;     // Segundos totales del ciclo actual
window.pomD = 0;      // Ciclos completados hoy
window.pomI = null;   // Interval ID
window._pomEndTime = 0; // Timestamp de fin del timer (para sincronización con popup)
window._pomIsLongBreak = false; // ¿Es descanso largo?
window._pomPausedNoiseType = null; // Tipo de ruido ambiental que estaba sonando antes de pausar

// ═══════════════════════════════════════════════════════════════
// Helpers de cálculo de tiempo
// ═══════════════════════════════════════════════════════════════
function pomWork() {
  return (parseInt(document.getElementById('pom-work')?.value) || 25) * 60;
}

function pomBreak() {
  return (parseInt(document.getElementById('pom-break')?.value) || 5) * 60;
}

function pomLongBreak() {
  return (parseInt(document.getElementById('pom-long-break')?.value) || 15) * 60;
}

// ═══════════════════════════════════════════════════════════════
// Persistencia de configuración de Pomodoro
// ═══════════════════════════════════════════════════════════════
function savePomSettings() {
  try {
    const settings = {
      workMins: parseInt(document.getElementById('pom-work')?.value || '25', 10),
      breakMins: parseInt(document.getElementById('pom-break')?.value || '5', 10),
      longBreakMins: parseInt(document.getElementById('pom-long-break')?.value || '15', 10),
      cyclesGoal: parseInt(document.getElementById('pom-cycles')?.value || '4', 10),
    };
    localStorage.setItem('academia_pom_settings', JSON.stringify(settings));
  } catch(e) {}
}

function loadPomSettings() {
  try {
    const raw = localStorage.getItem('academia_pom_settings');
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (document.getElementById('pom-work') && settings.workMins) {
      document.getElementById('pom-work').value = settings.workMins;
    }
    if (document.getElementById('pom-break') && settings.breakMins) {
      document.getElementById('pom-break').value = settings.breakMins;
    }
    if (document.getElementById('pom-long-break') && settings.longBreakMins) {
      document.getElementById('pom-long-break').value = settings.longBreakMins;
    }
    if (document.getElementById('pom-cycles') && settings.cyclesGoal) {
      document.getElementById('pom-cycles').value = settings.cyclesGoal;
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// Gestión de estado persistente
// ═══════════════════════════════════════════════════════════════
function _pomTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function _ensurePomStateContainers() {
  if (!State.pomHistory || typeof State.pomHistory !== 'object') State.pomHistory = {};
  if (!State.pomSnapshots || typeof State.pomSnapshots !== 'object') State.pomSnapshots = {};
}

function _appendPomSession(session) {
  _ensurePomStateContainers();
  const dayKey = _pomTodayKey();
  const entry = { ...session, date: dayKey };
  State.pomSessions.push(entry);
  if (!Array.isArray(State.pomHistory[dayKey])) State.pomHistory[dayKey] = [];
  State.pomHistory[dayKey].push(entry);
  savePom();
  
  // Notificar a la UI que se guardó una sesión
  window.dispatchEvent(new CustomEvent('pomodoro:session-saved', { detail: entry }));
}

function _savePomRunningState() {
  if (!window.pomR) {
    savePomRunning(null);
    window._pomEndTime = 0;
    return;
  }
  // Calcular endTime basado en el tiempo restante actual
  window._pomEndTime = Date.now() + (window.pomSL * 1000);
  savePomRunning({
    running: !!window.pomR,
    isBreak: !!window.pomB,
    remaining: window.pomSL,
    total: window.pomTS,
    cyclesDone: window.pomD,
    workMins: parseInt(document.getElementById('pom-work')?.value || '25', 10),
    breakMins: parseInt(document.getElementById('pom-break')?.value || '5', 10),
    cyclesGoal: parseInt(document.getElementById('pom-cycles')?.value || '4', 10),
    subjectId: document.getElementById('pom-subject')?.value || '',
    taskId: document.getElementById('pom-task-sel')?.value || '',
    savedAt: Date.now(),
    endTime: window._pomEndTime,
  });
}

function _capturePomSnapshotIfGoalReached(goal, done) {
  if (!goal || done < goal) return;
  _ensurePomStateContainers();
  const dayKey = _pomTodayKey();
  if (State.pomSnapshots[dayKey]) return;
  const mins = (State.pomHistory[dayKey] || []).reduce((acc, s) => acc + (s.mins || 0), 0);
  State.pomSnapshots[dayKey] = {
    date: dayKey,
    goal,
    sessions: done,
    mins,
    achievedAt: new Date().toISOString(),
  };
  savePom();
  window.dispatchEvent(new CustomEvent('pomodoro:goal-reached', { detail: State.pomSnapshots[dayKey] }));
}

// ═══════════════════════════════════════════════════════════════
// Historial semanal
// ═══════════════════════════════════════════════════════════════
function _getPomWeekHistory() {
  try { return JSON.parse(localStorage.getItem('academia_pom_week') || '[]'); } catch(e) { return []; }
}

function _savePomWeekHistory(arr) {
  try { localStorage.setItem('academia_pom_week', JSON.stringify(arr)); } catch(e) {} 
}

function _recordPomWeekSession(mins) {
  const arr = _getPomWeekHistory();
  const today = new Date().toISOString().slice(0, 10);
  arr.push({ date: today, mins: mins || 0 });
  // Keep last 60 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const cutStr = cutoff.toISOString().slice(0, 10);
  _savePomWeekHistory(arr.filter(s => s.date >= cutStr));
}

// ═══════════════════════════════════════════════════════════════
// Restaurar estado guardado
// ═══════════════════════════════════════════════════════════════
function restorePomRunningState() {
  const saved = loadPomRunning();
  if (!saved || !saved.running) return;
  const ageMs = Date.now() - (saved.savedAt || 0);
  if (ageMs > (1000 * 60 * 60 * 6)) {
    savePomRunning(null);
    return;
  }
  // Solo restaurar si el partial de pomodoro está cargado
  if (!document.getElementById('pom-work')) return;
  if (saved.workMins) document.getElementById('pom-work').value = saved.workMins;
  if (saved.breakMins) document.getElementById('pom-break').value = saved.breakMins;
  if (saved.cyclesGoal) document.getElementById('pom-cycles').value = saved.cyclesGoal;
  if (document.getElementById('pom-subject')) document.getElementById('pom-subject').value = saved.subjectId || '';
  if (document.getElementById('pom-task-sel')) document.getElementById('pom-task-sel').value = saved.taskId || '';
  window.pomB = !!saved.isBreak;
  window.pomR = !!saved.running;
  window.pomD = Number(saved.cyclesDone) || 0;
  window.pomTS = Number(saved.total) || (window.pomB ? pomBreak() : pomWork());
  window.pomSL = Number(saved.remaining) || window.pomTS;
  window._pomEndTime = Number(saved.endTime) || (Date.now() + (window.pomSL * 1000));
  
  if (window.pomSL <= 0) {
    window.pomR = false;
    savePomRunning(null);
    return;
  }
  
  // Notificar a UI para actualizar botón
  window.dispatchEvent(new CustomEvent('pomodoro:restored', { detail: { running: true } }));
  
  // Limpiar cualquier intervalo existente antes de crear uno nuevo
  if (window.pomI) {
    clearInterval(window.pomI);
    window.pomI = null;
  }
  
  // Reanudar intervalo
  window.pomI = setInterval(() => {
    window.pomSL--;
    _savePomRunningState();
    window.dispatchEvent(new CustomEvent('pomodoro:tick', { detail: { remaining: window.pomSL, total: window.pomTS, isBreak: window.pomB } }));
    if (window.pomSL <= 10 && window.pomSL > 0) _pomCountdownBeep(window.pomSL);
    if (window.pomSL <= 0) {
      clearInterval(window.pomI); window.pomI = null; window.pomR = false;
      savePomRunning(null);
      pomPlayAlarm(window.pomB);
      if (!window.pomB) {
        window.pomD++;
        const subj = document.getElementById('pom-subject').value;
        const m = getMat(subj);
        _appendPomSession({
          subject: m.name || subj || 'General',
          time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
          taskId: document.getElementById('pom-task-sel')?.value || '',
          taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
          mins: pomWork() / 60
        });
        _recordPomWeekSession(pomWork() / 60);
        _updateStreak();
        window.dispatchEvent(new CustomEvent('pomodoro:finish', { detail: { phase: 'work' } }));
        window.pomB = true; window.pomSL = window.pomTS = pomBreak();
      } else {
        window.pomB = false; window.pomSL = window.pomTS = pomWork();
        window.dispatchEvent(new CustomEvent('pomodoro:finish', { detail: { phase: 'break' } }));
      }
    }
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════
// Control principal del timer
// ═══════════════════════════════════════════════════════════════
function pomReset() {
  if (window.pomI) { clearInterval(window.pomI); window.pomI = null; }
  window.pomR = false; window.pomB = false; window._pomIsLongBreak = false; window.pomSL = window.pomTS = pomWork();
  savePomRunning(null);
  window.dispatchEvent(new CustomEvent('pomodoro:reset'));
}

function pomToggle() {
  try { const ctx = _pomAudio(); if (ctx.state === 'suspended') ctx.resume(); } catch(e) {}
  if (window.pomR) {
    // Pausar
    clearInterval(window.pomI); window.pomI = null; window.pomR = false;
    _savePomRunningState();
    _pomBeep('pause');
    // Detener alarma si está sonando
    _pomStopAlarm();
    // Guardar y detener ruido ambiente si está sonando
    if (typeof window._noiseType !== 'undefined' && window._noiseType) {
      window._pomPausedNoiseType = window._noiseType;
      if (typeof window._stopNoise === 'function') window._stopNoise();
    }
    // Notify chrono: pom paused
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
    window.dispatchEvent(new CustomEvent('pomodoro:pause'));
  } else {
    // Iniciar
    // 🔥 FIX: Si el timer está en 0, iniciar la siguiente fase automáticamente en lugar de resetear
    if (window.pomSL <= 0 || window.pomTS === 0) {
      if (!window.pomB) {
        // Terminó trabajo → iniciar descanso
        window.pomD++;
        window._pomIsLongBreak = (window.pomD % 4 === 0);
        window.pomB = true; window.pomSL = window.pomTS = window._pomIsLongBreak ? pomLongBreak() : pomBreak();
        _pomBeep('break');
        _pomMusicOnBreak();
        if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
        window.dispatchEvent(new CustomEvent('pomodoro:phase-change', { detail: { phase: 'break', auto: true, isLongBreak: window._pomIsLongBreak } }));
      } else {
        // Terminó descanso → iniciar trabajo
        window.pomB = false; window._pomIsLongBreak = false; window.pomSL = window.pomTS = pomWork();
        _pomBeep('resume');
        _pomMusicOnWork();
        if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
        window.dispatchEvent(new CustomEvent('pomodoro:phase-change', { detail: { phase: 'work', auto: true } }));
      }
    }
    window.pomR = true;
    _savePomRunningState();
    _pomBeep(window.pomB ? 'break' : 'start');
    // Reanudar ruido ambiente si estaba sonando antes de pausar
    if (window._pomPausedNoiseType && typeof toggleNoise === 'function') {
      toggleNoise(window._pomPausedNoiseType);
      window._pomPausedNoiseType = null;
    }
    // Notify chrono: pom running
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(true, window.pomB ? 'break' : 'work');
    window.dispatchEvent(new CustomEvent('pomodoro:start', { detail: { isBreak: window.pomB, isLongBreak: window._pomIsLongBreak } }));
    
    window.pomI = setInterval(() => {
      window.pomSL--;
      _savePomRunningState();
      window.dispatchEvent(new CustomEvent('pomodoro:tick', { detail: { remaining: window.pomSL, total: window.pomTS, isBreak: window.pomB, isLongBreak: window._pomIsLongBreak } }));
      if (window.pomSL <= 10 && window.pomSL > 0) _pomCountdownBeep(window.pomSL);
      if (window.pomSL <= 0) {
        clearInterval(window.pomI); window.pomI = null; window.pomR = false;
        savePomRunning(null);
        pomPlayAlarm(window.pomB);
        if (!window.pomB) {
          // Terminó trabajo → inicia descanso
          window.pomD++;
          const subj = document.getElementById('pom-subject').value;
          const m = getMat(subj);
          _appendPomSession({
            subject: m.name || subj || 'General',
            time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
            taskId: document.getElementById('pom-task-sel')?.value || '',
            taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
            mins: pomWork() / 60
          });
          _recordPomWeekSession(pomWork() / 60);
          _updateStreak();
          window.dispatchEvent(new CustomEvent('pomodoro:finish', { detail: { phase: 'work', sessions: window.pomD } }));
          // Después de cada 4 ciclos, usar descanso largo
          window._pomIsLongBreak = (window.pomD % 4 === 0);
          window.pomB = true; window.pomSL = window.pomTS = window._pomIsLongBreak ? pomLongBreak() : pomBreak();
          _pomMusicOnBreak();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
        } else {
          // Terminó descanso → inicia trabajo
          window.pomB = false; window._pomIsLongBreak = false; window.pomSL = window.pomTS = pomWork();
          _pomMusicOnWork();
          window.dispatchEvent(new CustomEvent('pomodoro:finish', { detail: { phase: 'break' } }));
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
        }
      }
    }, 1000);
  }
}

function pomSkip() {
  if (window.pomI) { clearInterval(window.pomI); window.pomI = null; }
  window.pomR = false;
  _pomStopAlarm();
  // Detener ruido ambiente si está sonando
  if (typeof window._stopNoise === 'function') window._stopNoise();
  savePomRunning(null);
  if (!window.pomB) {
    window.pomD++;
    // Después de cada 4 ciclos, usar descanso largo
    window._pomIsLongBreak = (window.pomD % 4 === 0);
    window.pomB = true; window.pomSL = window.pomTS = window._pomIsLongBreak ? pomLongBreak() : pomBreak(); _pomBeep('break');
    _pomMusicOnBreak();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
    window.dispatchEvent(new CustomEvent('pomodoro:phase-change', { detail: { phase: 'break', skipped: true, isLongBreak: window._pomIsLongBreak } }));
  } else {
    window.pomB = false; window._pomIsLongBreak = false; window.pomSL = window.pomTS = pomWork(); _pomBeep('resume');
    _pomMusicOnWork();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
    window.dispatchEvent(new CustomEvent('pomodoro:phase-change', { detail: { phase: 'work', skipped: true } }));
  }
}

// ═══════════════════════════════════════════════════════════════
// Guardado parcial (antes de terminar)
// ═══════════════════════════════════════════════════════════════
function pomSavePartial() {
  const saved = _savePomPartialInternal({ silent: false });
  if (!saved) return;
  if (typeof _appNotify === 'function') _appNotify(`✅ Sesión parcial guardada: ${saved} min de estudio`, 'ok');
}

function _savePomPartialInternal({ silent = false } = {}) {
  const totalWork = pomWork();
  const totalBreak = pomBreak();
  
  // Calcular tiempo acumulado: ciclos completados + tiempo actual
  // pomD es el número de ciclos COMPLETADOS (puntos llenos)
  const completedCyclesSec = window.pomD * totalWork;
  const currentElapsed = window.pomB ? (totalBreak - window.pomSL) : (totalWork - window.pomSL);
  const totalElapsedSec = completedCyclesSec + currentElapsed;
  
  if (totalElapsedSec < 60) {
    if (!silent && typeof _appNotify === 'function') _appNotify('Menos de 1 minuto transcurrido. No se guardará.', 'warning');
    return null;
  }
  
  const mins = Math.round(totalElapsedSec / 60);
  const subj = document.getElementById('pom-subject')?.value || '';
  const m = getMat(subj);
  _appendPomSession({
    subject: m.name || subj || 'General',
    time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    taskId: document.getElementById('pom-task-sel')?.value || '',
    taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
    mins: mins,
    partial: true
  });
  _recordPomWeekSession(mins);
  _updateStreak();
  window.dispatchEvent(new CustomEvent('pomodoro:partial-saved', { detail: { mins } }));
  return mins;
}

// ═══════════════════════════════════════════════════════════════
// Exponer funciones al window para compatibilidad
// ═══════════════════════════════════════════════════════════════
window.pomWork = pomWork;
window.pomBreak = pomBreak;
window.pomLongBreak = pomLongBreak;
window.pomReset = pomReset;
window.pomToggle = pomToggle;
window.pomSkip = pomSkip;
window.pomSavePartial = pomSavePartial;
window.restorePomRunningState = restorePomRunningState;
window.savePomSettings = savePomSettings;
window.loadPomSettings = loadPomSettings;
window._savePomPartialInternal = _savePomPartialInternal;
window._recordPomWeekSession = _recordPomWeekSession;
window._getPomWeekHistory = _getPomWeekHistory;
window._savePomWeekHistory = _savePomWeekHistory;
window._pomTodayKey = _pomTodayKey;
window._ensurePomStateContainers = _ensurePomStateContainers;
window._appendPomSession = _appendPomSession;
window._capturePomSnapshotIfGoalReached = _capturePomSnapshotIfGoalReached;

// ═══════════════════════════════════════════════════════════════
// Persistencia automática (antes de cerrar/pausar)
// ═══════════════════════════════════════════════════════════════
window.addEventListener('beforeunload', () => {
  if (window.pomR) _savePomPartialInternal({ silent: true });
  if (window.pomR) _savePomRunningState();
});

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && window.pomR) {
    _savePomRunningState();
  }
});
