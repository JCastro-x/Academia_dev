
const _goPageHooks = [];

// ─── Navigation Stack System ───────────────────────────────────────
const _navStack = [];
const _MAX_STACK_SIZE = 20; // Limitar stack para evitar memory leaks

// Niveles de navegación jerárquica
const NAV_LEVELS = {
  ROOT: 0,      // overview, materias, tareas, etc.
  LIST: 1,      // lista de items (notas, flashcards, etc.)
  DETAIL: 2,    // detalle de item individual
  SUB_DETAIL: 3 // sub-detalle (ej. canvas en nota)
};

// Mapeo de páginas a niveles
const PAGE_LEVELS = {
  'overview': NAV_LEVELS.ROOT,
  'materias': NAV_LEVELS.ROOT,
  'tareas': NAV_LEVELS.ROOT,
  'calendario': NAV_LEVELS.ROOT,
  'calificaciones': NAV_LEVELS.ROOT,
  'temas': NAV_LEVELS.ROOT,
  'estadisticas': NAV_LEVELS.ROOT,
  'pomodoro': NAV_LEVELS.ROOT,
  'p-reloj': NAV_LEVELS.ROOT,
  'semestres': NAV_LEVELS.ROOT,
  'horario': NAV_LEVELS.ROOT,
  'notas': NAV_LEVELS.LIST,
  'perfil': NAV_LEVELS.ROOT,
  'general': NAV_LEVELS.ROOT,
  'flashcards': NAV_LEVELS.LIST,
  'p-habits': NAV_LEVELS.ROOT
};

function onGoPage(fn) {
  if (typeof fn !== 'function') return () => {};
  _goPageHooks.push(fn);
  return () => {
    const idx = _goPageHooks.indexOf(fn);
    if (idx >= 0) _goPageHooks.splice(idx, 1);
  };
}

window._currentPageId = 'overview';

// Inicializar Navigation Stack con overview
_pushToStack('overview');

// ─── Control Center Widget Switcher ───────────────────────────────────────
let _currentWidget = 'calendar';
let _zenModeActive = false;

function switchWidget(viewName) {
  // Update button states
  document.querySelectorAll('.view-selector-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
    }
  });

  // Hide all widgets
  document.querySelectorAll('.control-widget').forEach(widget => {
    widget.style.display = 'none';
  });

  // Hide empty state and events list
  const emptyState = document.getElementById('events-empty-state');
  const eventsList = document.getElementById('events-list');
  if (emptyState) emptyState.style.display = 'none';
  if (eventsList) eventsList.style.display = 'none';

  // Show selected widget and render it
  const widgetMap = {
    'calendar': 'widget-calendar',
    'myday': 'widget-myday',
    'habits': 'widget-habits'
  };

  if (widgetMap[viewName]) {
    const widget = document.getElementById(widgetMap[viewName]);
    if (widget) {
      widget.style.display = 'block';
      widget.style.visibility = 'visible';
      widget.style.opacity = '1';
      _currentWidget = viewName;
      // Persist widget selection
      sessionStorage.setItem('controlCenterWidget', viewName);

      // Render the specific widget
      if (viewName === 'calendar' && typeof renderMiniCalendarWidget === 'function') {
        renderMiniCalendarWidget();
      } else if (viewName === 'myday' && typeof renderMyDayWidget === 'function') {
        renderMyDayWidget();
      } else if (viewName === 'habits' && typeof renderHabitsWidget === 'function') {
        renderHabitsWidget();
      }
    } else {
      console.error('Widget element not found for:', widgetMap[viewName]);
    }
  }
}

// Initialize default widget on page load
function initControlCenter() {
  // Check if widgets exist in DOM
  const widgets = document.querySelectorAll('.control-widget');

  // Render widgets with real data
  refreshAllWidgets();

  // Restore saved widget or default to calendar
  const savedWidget = sessionStorage.getItem('controlCenterWidget') || 'calendar';
  switchWidget(savedWidget);
}

// ─── Zen Mode Toggle ─────────────────────────────────────────────────────
function toggleZenMode() {
  _zenModeActive = !_zenModeActive;
  const grid = document.querySelector('.overview-two-column-grid');
  const zenBtn = document.getElementById('zen-mode-toggle-btn');

  if (_zenModeActive) {
    // Activate Zen Mode (hide panel)
    grid.classList.add('zen-mode');
    zenBtn.textContent = '👁️ Mostrar';
    zenBtn.style.background = 'var(--surface2)';
    zenBtn.style.borderColor = 'var(--border)';
    zenBtn.style.color = 'var(--text)';
    sessionStorage.setItem('zenMode', 'true');
  } else {
    // Deactivate Zen Mode (show panel)
    grid.classList.remove('zen-mode');
    zenBtn.textContent = '✕ Ocultar';
    zenBtn.style.background = '';
    zenBtn.style.borderColor = '';
    zenBtn.style.color = '';
    sessionStorage.setItem('zenMode', 'false');
  }
}

// Restore Zen Mode state on page load
function restoreZenModeState() {
  const savedZenMode = sessionStorage.getItem('zenMode');
  if (savedZenMode === 'true') {
    _zenModeActive = true;
    const grid = document.querySelector('.overview-two-column-grid');
    const zenBtn = document.getElementById('zen-mode-toggle-btn');
    if (grid) grid.classList.add('zen-mode');
    if (zenBtn) {
      zenBtn.textContent = '👁️ Mostrar';
      zenBtn.style.background = 'var(--surface2)';
      zenBtn.style.borderColor = 'var(--border)';
      zenBtn.style.color = 'var(--text)';
    }
  }
}

// ─── Widget Rendering Functions ─────────────────────────────────────────────

// Render My Day Widget with real data
function renderMyDayWidget() {
  const container = document.getElementById('myday-widget-content');
  if (!container) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get today's tasks and events
  const todayTasks = State.tasks.filter(t => t.due === todayStr && !t.done);
  const todayEvents = State.events.filter(e => e.date === todayStr);

  // Combine and sort chronologically
  const allItems = [];

  todayTasks.forEach(t => {
    const mat = getMat(t.matId);
    allItems.push({
      type: 'task',
      time: t.due ? '00:00' : '',
      title: t.title,
      meta: mat ? `${mat.icon || ''} ${mat.code || mat.name || ''}` : 'Sin materia',
      priority: t.priority
    });
  });

  todayEvents.forEach(e => {
    const mat = getMat(e.matId);
    allItems.push({
      type: 'event',
      time: e.hora || '',
      title: e.title,
      meta: mat ? `${mat.icon || ''} ${mat.code || mat.name || ''}` : 'Sin materia'
    });
  });

  // Sort by time (items without time go to end)
  allItems.sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  if (allItems.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text3);">
        <div style="font-size:48px;margin-bottom:12px;">🌴</div>
        <div style="font-size:14px;">Día libre</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="myday-timeline">
      ${allItems.map(item => `
        <div class="myday-item">
          <div class="myday-time">${item.time || '--:--'}</div>
          <div class="myday-content">
            <div class="myday-title">${item.title}</div>
            <div class="myday-meta">${item.meta}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Render Habits Widget with real data
function renderHabitsWidget() {
  const container = document.getElementById('habits-widget-content');
  if (!container) return;

  const habits = Array.isArray(State.settings?.habits) ? State.settings.habits : [];

  if (habits.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text3);">
        <div style="font-size:48px;margin-bottom:12px;">🌱</div>
        <div style="font-size:14px;">Sin hábitos</div>
      </div>
    `;
    return;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="habits-list">
      ${habits.map(habit => {
        const isCompleted = habit.historial?.[todayStr] === true;
        return `
          <div class="habit-item">
            <div class="habit-checkbox">
              <input type="checkbox" id="habit-widget-${habit.id}" ${isCompleted ? 'checked' : ''} onchange="toggleHabitFromWidget('${habit.id}')">
              <label for="habit-widget-${habit.id}"></label>
            </div>
            <div class="habit-info">
              <div class="habit-name">${habit.emoji || '✅'} ${habit.nombre}</div>
              <div class="habit-streak">🔥 ${habit.rachaActual || 0} días</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Toggle habit from widget checkbox
function toggleHabitFromWidget(habitId) {
  const habit = State.settings.habits?.find(h => h.id === habitId);
  if (!habit) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Toggle completion
  if (habit.historial?.[todayStr] === true) {
    habit.historial[todayStr] = false;
  } else {
    habit.historial[todayStr] = true;
  }

  // Recalculate streak
  if (typeof Habits?.calculateStreak === 'function') {
    habit.rachaActual = Habits.calculateStreak(habit);
  }

  saveState(['settings']);
  renderHabitsWidget();
}

// Render Mini Calendar Widget dynamically
function renderMiniCalendarWidget() {
  const container = document.getElementById('calendar-widget-content');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayNames = ['D','L','M','M','J','V','S'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get days with events/tasks
  const daysWithEvents = new Set();
  State.events.forEach(e => {
    const eventDate = new Date(e.date);
    if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
      daysWithEvents.add(eventDate.getDate());
    }
  });
  State.tasks.forEach(t => {
    if (t.due) {
      const taskDate = new Date(t.due);
      if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
        daysWithEvents.add(taskDate.getDate());
      }
    }
  });

  let html = `
    <div class="mini-calendar">
      <div class="calendar-header">
        <span class="calendar-month">${monthNames[month]} ${year}</span>
      </div>
      <div class="calendar-grid">
  `;

  // Day names
  dayNames.forEach(day => {
    html += `<div class="calendar-day-name">${day}</div>`;
  });

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day" style="visibility:hidden;"></div>`;
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today;
    const hasEvent = daysWithEvents.has(d);
    html += `
      <div class="calendar-day ${isToday ? 'calendar-today' : ''}">
        ${d}
        ${hasEvent ? '<div style="width:4px;height:4px;background:var(--accent);border-radius:50%;margin:2px auto 0;"></div>' : ''}
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Refresh all widgets
function refreshAllWidgets() {
  renderMyDayWidget();
  renderHabitsWidget();
  renderMiniCalendarWidget();
}

// Expose functions globally
window.switchWidget = switchWidget;
window.toggleZenMode = toggleZenMode;
window.restoreZenModeState = restoreZenModeState;
window.initControlCenter = initControlCenter;
window.refreshAllWidgets = refreshAllWidgets;
window.toggleHabitFromWidget = toggleHabitFromWidget;

// ─── Push to Navigation Stack ───────────────────────────────────────
function _pushToStack(pageId, context = null) {
  // No duplicar si es la misma página
  if (_navStack.length > 0 && _navStack[_navStack.length - 1].pageId === pageId) {
    return;
  }

  // Limitar tamaño del stack
  if (_navStack.length >= _MAX_STACK_SIZE) {
    _navStack.shift(); // Eliminar el más antiguo
  }

  _navStack.push({
    pageId,
    level: PAGE_LEVELS[pageId] || NAV_LEVELS.ROOT,
    context, // Datos contextuales (ej: noteId, taskId)
    timestamp: Date.now()
  });
}

// ─── Pop from Navigation Stack ───────────────────────────────────────
function _popFromStack() {
  if (_navStack.length === 0) {
    console.warn('⚠️ Stack vacío, no hay donde regresar');
    return null;
  }

  const current = _navStack.pop();
  const previous = _navStack.length > 0 ? _navStack[_navStack.length - 1] : null;

  return previous;
}

// ─── Go Back (Navigation Stack) ───────────────────────────────────────
function goBack() {
  const previous = _popFromStack();

  if (!previous) {
    // Si el stack está vacío, ir a overview
    goPage('overview');
    return;
  }

  // Navegar a la página anterior
  goPage(previous.pageId, null, previous.context);
}

// ─── Clear Navigation Stack ───────────────────────────────────────────
function clearNavStack() {
  _navStack.length = 0;
}

// ─── Get Current Stack State ─────────────────────────────────────────
function getNavStackState() {
  return {
    current: _navStack[_navStack.length - 1] || null,
    previous: _navStack.length > 1 ? _navStack[_navStack.length - 2] : null,
    depth: _navStack.length,
    stack: [..._navStack]
  };
}

// Exponer funciones globalmente
window.goBack = goBack;
window.clearNavStack = clearNavStack;
window.getNavStackState = getNavStackState;

async function goPage(id, el, context = null) {
  _uiClick('nav');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Push al Navigation Stack si es una navegación nueva
  if (window._currentPageId !== id) {
    _pushToStack(id, context);
    history.pushState({ page: id, type: 'page' }, '', `#${id}`);
    window._currentPageId = id;
  }
  
  // Ocultar sub-partials de Reloj (pomodoro, cronometro, temporizador) al navegar
  ['pomodoro', 'cronometro', 'temporizador'].forEach(mode => {
    const page = document.getElementById(`page-${mode}`);
    if (page) {
      page.style.display = 'none';
      page.classList.remove('active');
    }
  });
  
  // Limpiar el buscador global al navegar
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.value = '';
    globalSearch.setAttribute('readonly', 'true');
  }
  const searchResults = _el('search-results');
  if (searchResults) searchResults.style.display = 'none';
  
  // Lazy load partial if not already loaded
  const pageEl = document.getElementById('page-' + id);
  if (!pageEl) {
    // Try to load the partial on-demand
    if (typeof window.loadPartial === 'function') {
      try {
        await window.loadPartial(id);
        // After loading, get the element again
        const newPageEl = document.getElementById('page-' + id);
        if (!newPageEl) {
          console.error('❌ Partial cargado pero elemento no encontrado:', id);
          return;
        }
      } catch (err) {
        console.error('❌ Error cargando partial:', id, err);
        return;
      }
    } else {
      console.error('❌ loadPartial no disponible');
      return;
    }
  }
  
  const finalPageEl = document.getElementById('page-' + id);
  finalPageEl.classList.add('active');
  if (el) el.classList.add('active');
  _el('page-title').textContent = PAGE_TITLES[id] || id;
  closeCompPopup();

  switch(id) {
    case 'overview':
      if (typeof armOverviewDueTodayBlink === 'function') armOverviewDueTodayBlink();
      renderOverview();
      break;
    case 'materias':       renderMaterias(); break;
    case 'tareas':
      fillMatSels();
      document.getElementById('tf-mat').value = '';
      if (typeof armTasksDueTodayBlink === 'function') armTasksDueTodayBlink();
      renderTasks();
      break;
    case 'calendario':     fillMatSels(); renderCalendar(); break;
    case 'calificaciones': renderGrades(); break;
    case 'temas':          fillMatSels(); fillTopicMatSel(); renderTopics(); break;
    case 'estadisticas':   renderStats(); break;
    case 'pomodoro':       fillPomSel(); renderPomHistory(); renderPomGoal(); setTimeout(() => { if (typeof restorePomRunningState === 'function') restorePomRunningState(); }, 100); break;
    case 'p-reloj':
      // Inicializar estadísticas del selector de reloj
      setTimeout(() => {
        if (typeof updateRelojStats === 'function') updateRelojStats();
      }, 100);
      break;
    case 'semestres':      renderSemestresList(); break;
    case 'horario':        renderHorario(); break;
    case 'notas':          fillNotesSel(); renderNotesProPage(); break;
    case 'perfil':         renderProfilePage(); break;
    case 'general':        renderGeneralHub(); break;
    case 'flashcards':     renderFlashcards(); break;
    case 'p-habits':
      if (typeof Habits !== 'undefined' && Habits.render) {
        setTimeout(() => Habits.render(), 100);
      }
      break;
  }

  // Post-navigation hooks for modules that need page-change side effects.
  _goPageHooks.forEach(fn => {
    try { fn(id, el, pageEl); }
    catch (err) { console.warn('goPage hook error', err); }
  });
}

function fillMatSels() {
  const targets = ['t-mat','ev-mat','tp-mat'];
  // Filter out null/undefined materias and those with undefined ids
  const validMaterias = State.materias.filter(m => m && m.id && m.id !== 'undefined');
  targets.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const prev = el.value;
    el.innerHTML = '<option value="">Selecciona una materia</option>';
    validMaterias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon||'📚'} ${m.name}`; el.appendChild(o);
    });
    // Only restore previous value if it exists and is valid
    if (prev && prev !== '' && validMaterias.some(m => m.id === prev)) {
      el.value = prev;
    }
  });
  const tf = document.getElementById('tf-mat');
  if (tf) {
    tf.innerHTML = '<option value="">Todas las materias</option>';
    validMaterias.forEach(m => {
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

function renderOverview() { 
  // Verificar si _renderOverview existe (se define en notes.js)
  if (typeof _renderOverview === 'function') {
    _schedRender(_renderOverview);
  }
}
