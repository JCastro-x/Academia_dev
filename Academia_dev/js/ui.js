
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

  console.log(`📚 Stack push: ${pageId} (level: ${PAGE_LEVELS[pageId] || 'ROOT'})`, _navStack.map(s => s.pageId));
}

// ─── Pop from Navigation Stack ───────────────────────────────────────
function _popFromStack() {
  if (_navStack.length === 0) {
    console.warn('⚠️ Stack vacío, no hay donde regresar');
    return null;
  }

  const current = _navStack.pop();
  const previous = _navStack.length > 0 ? _navStack[_navStack.length - 1] : null;

  console.log(`📚 Stack pop: ${current.pageId} → ${previous ? previous.pageId : 'ROOT'}`);

  return previous;
}

// ─── Go Back (Navigation Stack) ───────────────────────────────────────
function goBack() {
  const previous = _popFromStack();

  if (!previous) {
    // Si el stack está vacío, ir a overview
    console.log('📚 Stack vacío, navegando a overview');
    goPage('overview');
    return;
  }

  // Navegar a la página anterior
  goPage(previous.pageId, null, previous.context);
}

// ─── Clear Navigation Stack ───────────────────────────────────────────
function clearNavStack() {
  _navStack.length = 0;
  console.log('📚 Stack limpiado');
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
    case 'pomodoro':       fillPomSel(); renderPomHistory(); renderPomGoal(); break;
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
