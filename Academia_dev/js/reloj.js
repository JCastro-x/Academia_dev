/**
 * RELOJ.JS — Funciones de navegación del módulo Reloj
 * 
 * Este archivo contiene las funciones de navegación para el selector de Reloj
 * (Pomodoro, Cronómetro, Temporizador) que deben estar disponibles globalmente.
 */

(function () {
  'use strict';

  // Navegar a modo específico del reloj
  window.goRelojMode = function(mode) {
    
    // Guardar modo actual en state (si está disponible)
    try {
      if (window.State && State.settings) {
        if (!State.settings.relojMode) State.settings.relojMode = {};
        State.settings.relojMode.lastSelected = mode;
      }
    } catch(e) { console.warn('No se pudo guardar modo en State:', e); }
    
    // Cargar el partial correspondiente
    const modes = {
      'pomodoro': 'p-reloj-pomodoro',
      'cronometro': 'p-reloj-crono',
      'temporizador': 'p-reloj-timer'
    };
    
    if (modes[mode]) {
      loadPartial(modes[mode]).then(() => {
        // Ocultar selector, mostrar modo
        const selector = document.getElementById('page-p-reloj');
        if (selector) selector.classList.remove('active');
        
        const modePage = document.getElementById(`page-${mode}`);
        if (modePage) {
          modePage.style.display = 'block';
          modePage.classList.add('active');
          
          // Inicializar el modo específico con delay mayor para móvil
          const isMobile = window.innerWidth <= 768;
          const delay = isMobile ? 300 : 200;
          
          setTimeout(() => {
            if (mode === 'pomodoro') {
              if (typeof fillPomSel === 'function') fillPomSel();
              if (typeof renderPomHistory === 'function') renderPomHistory();
              if (typeof renderPomGoal === 'function') renderPomGoal();
              if (typeof updatePomDots === 'function') updatePomDots();
              if (typeof pomReset === 'function') pomReset();
            } else if (mode === 'cronometro') {
              if (typeof initChronoData === 'function') initChronoData();
              if (typeof updateChronoDisplay === 'function') updateChronoDisplay();
              if (typeof updateChronoButtons === 'function') updateChronoButtons();
              if (typeof renderLaps === 'function') renderLaps();
              if (typeof renderChronoSessions === 'function') renderChronoSessions();
            } else if (mode === 'temporizador') {
              if (typeof initTimerData === 'function') initTimerData();
              if (typeof renderTimerHistory === 'function') renderTimerHistory();
            }
          }, delay);
        } else {
          console.error('❌ No se encontró page-${mode}');
        }
      }).catch(err => {
        console.error('❌ Error cargando partial:', modes[mode], err);
      });
    } else {
      console.error('❌ Modo no reconocido:', mode);
    }
  };

  // Volver al selector desde cualquier modo
  window.backToRelojSelector = function() {
    
    // Ocultar todos los modos
    ['pomodoro', 'cronometro', 'temporizador'].forEach(mode => {
      const page = document.getElementById(`page-${mode}`);
      if (page) {
        page.style.display = 'none';
        page.classList.remove('active');
      }
    });
    
    // Mostrar selector
    const selector = document.getElementById('page-p-reloj');
    if (selector) {
      selector.classList.add('active');
    }
    
    // Actualizar estadísticas
    if (typeof updateRelojStats === 'function') {
      updateRelojStats();
    }
  };

  // Actualizar estadísticas mostradas en el selector
  window.updateRelojStats = function() {
    try {
      if (!window.State) return;

      // Pomodoro stats
      const pomStreak = State.pomSessions?.length || 0;
      const pomGoal = State.settings?.pomDailyGoal || 4;
      const pomStreakEl = document.getElementById('pom-streak-display');
      const pomGoalEl = document.getElementById('pom-goal-display');
      if (pomStreakEl) pomStreakEl.textContent = pomStreak;
      if (pomGoalEl) pomGoalEl.textContent = pomGoal;

      // Renderizar sesiones de Pomodoro en la vista Reloj
      const sessionsContainer = document.getElementById('reloj-pom-sessions');
      if (sessionsContainer) {
        const sessions = State.pomSessions || [];
        if (sessions.length === 0) {
          sessionsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text3); font-size: 13px;">Sin sesiones hoy. ¡Inicia tu primer Pomodoro!</div>';
        } else {
          sessionsContainer.innerHTML = sessions.map((session, idx) => {
            const time = session.time || '00:00';
            const completed = session.completed ? '✅' : '⏹️';
            const task = session.task || 'Sin tarea';
            return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 14px;">${completed}</span>
                <span style="font-size: 13px; color: var(--text);">${task}</span>
              </div>
              <span style="font-size: 12px; font-family: 'Space Mono', monospace; color: var(--accent);">${time}</span>
            </div>`;
          }).join('');
        }
      }

      // Cronometro stats
      const chronoData = State.settings?.chronoData;
      const lastEl = document.getElementById('chrono-last');
      if (lastEl && chronoData?.lastSession) {
        lastEl.textContent = chronoData.lastSession;
      }
    } catch(e) { console.warn('Error actualizando stats:', e); }
  };


  // Inicializar cuando se carga el partial
  document.addEventListener('partial-loaded', function(e) {
    if (e.detail && e.detail.name === 'p-reloj') {
      setTimeout(() => {
        updateRelojStats();
      }, 150);
    }
  });
})();
