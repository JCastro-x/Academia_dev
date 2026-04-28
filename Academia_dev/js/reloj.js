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
    console.log('🔄 goRelojMode llamado con modo:', mode);
    
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
      console.log('📥 Cargando partial:', modes[mode]);
      loadPartial(modes[mode]).then(() => {
        console.log('✅ Partial cargado:', modes[mode]);
        // Ocultar selector, mostrar modo
        const selector = document.getElementById('page-p-reloj');
        if (selector) selector.classList.remove('active');
        
        const modePage = document.getElementById(`page-${mode}`);
        console.log('🔍 Buscando elemento:', `page-${mode}`, 'encontrado:', !!modePage);
        if (modePage) {
          modePage.style.display = 'block';
          modePage.classList.add('active');
          console.log('✅ Modo mostrado:', mode);
          
          // Inicializar el modo específico con delay mayor para móvil
          const isMobile = window.innerWidth <= 768;
          const delay = isMobile ? 300 : 200;
          
          setTimeout(() => {
            console.log('🔄 Inicializando modo:', mode);
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
    console.log('🔙 Volviendo al selector de Reloj');
    
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
      
      // Cronometro stats
      const chronoData = State.settings?.chronoData;
      const lastEl = document.getElementById('chrono-last');
      if (lastEl && chronoData?.lastSession) {
        lastEl.textContent = chronoData.lastSession;
      }
    } catch(e) { console.warn('Error actualizando stats:', e); }
  };

  console.log('⏱️ Reloj module loaded');

  // Inicializar cuando se carga el partial
  document.addEventListener('partial-loaded', function(e) {
    console.log('📥 Evento partial-loaded:', e.detail);
    if (e.detail && e.detail.name === 'p-reloj') {
      console.log('✅ Partial p-reloj cargado, actualizando stats...');
      setTimeout(() => {
        updateRelojStats();
        console.log('✅ Stats actualizadas');
      }, 150);
    }
  });
})();
