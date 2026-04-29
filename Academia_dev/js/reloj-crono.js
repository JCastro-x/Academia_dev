/**
 * RELOJ-CRONO.JS — Funciones del Cronómetro
 * 
 * Este archivo contiene las funciones del cronómetro que deben estar disponibles globalmente.
 */

(function () {
  'use strict';

  // Variables del cronómetro
  var chronoRunning = false;
  var chronoElapsed = 0;
  var chronoInterval = null;
  var chronoLaps = [];
  var chronoStartTime = null;

  // Inicializar datos del cronómetro
  window.initChronoData = function() {
    if (!State.settings.chronoData) {
      State.settings.chronoData = {
        sessions: [],
        lastSession: null
      };
    }
  };

  // Formatear tiempo
  function formatChronoTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }

  // Actualizar display
  function updateChronoDisplay() {
    const display = document.getElementById('chrono-display');
    if (display) {
      display.textContent = formatChronoTime(chronoElapsed);
    }
  }

  // Actualizar botones
  function updateChronoButtons() {
    const startBtn = document.getElementById('chrono-start-btn');
    const pauseBtn = document.getElementById('chrono-pause-btn');
    const stopBtn = document.getElementById('chrono-stop-btn');
    const resetBtn = document.getElementById('chrono-reset-btn');
    const lapBtn = document.getElementById('chrono-lap-btn');

    if (startBtn) {
      startBtn.style.display = chronoRunning ? 'none' : 'inline-block';
    }
    if (pauseBtn) {
      pauseBtn.style.display = chronoRunning ? 'inline-block' : 'none';
    }
    if (stopBtn) {
      stopBtn.disabled = !chronoRunning && chronoElapsed === 0;
    }
    if (resetBtn) {
      resetBtn.disabled = chronoElapsed === 0;
    }
    if (lapBtn) {
      lapBtn.disabled = !chronoRunning && chronoElapsed === 0;
    }
  }

  // Iniciar cronómetro
  window.startChrono = function() {
    if (chronoRunning) return;
    
    chronoRunning = true;
    chronoStartTime = Date.now() - chronoElapsed;
    
    chronoInterval = setInterval(() => {
      chronoElapsed = Date.now() - chronoStartTime;
      updateChronoDisplay();
    }, 10);
    
    updateChronoButtons();
  };

  // Pausar cronómetro
  window.pauseChrono = function() {
    if (!chronoRunning) return;
    
    chronoRunning = false;
    clearInterval(chronoInterval);
    chronoInterval = null;
    
    updateChronoButtons();
  };

  // Detener cronómetro
  window.stopChrono = function() {
    pauseChrono();
    
    if (chronoElapsed > 0) {
      // Guardar sesión
      const session = {
        date: new Date().toISOString(),
        duration: chronoElapsed,
        formatted: formatChronoTime(chronoElapsed),
        laps: chronoLaps.length
      };
      
      initChronoData();
      State.settings.chronoData.sessions.unshift(session);
      if (State.settings.chronoData.sessions.length > 20) {
        State.settings.chronoData.sessions = State.settings.chronoData.sessions.slice(0, 20);
      }
      State.settings.chronoData.lastSession = formatChronoTime(chronoElapsed);
      saveState(['settings']);
      
      renderChronoSessions();
      _appNotify('Sesión guardada: ' + formatChronoTime(chronoElapsed), 'ok');
    }
  };

  // Reiniciar cronómetro
  window.resetChrono = function() {
    pauseChrono();
    chronoElapsed = 0;
    chronoLaps = [];
    updateChronoDisplay();
    renderLaps();
    updateChronoButtons();
  };

  // Agregar vuelta
  window.addLap = function() {
    if (chronoRunning || chronoElapsed > 0) {
      const lapTime = chronoElapsed;
      const lap = {
        number: chronoLaps.length + 1,
        time: lapTime,
        formatted: formatChronoTime(lapTime)
      };
      chronoLaps.push(lap);
      renderLaps();
    }
  };

  // Renderizar vueltas
  window.renderLaps = function() {
    const container = document.getElementById('chrono-laps');
    if (!container) return;
    
    if (chronoLaps.length === 0) {
      container.innerHTML = '<div class="laps-empty">Sin vueltas registradas</div>';
      return;
    }
    
    container.innerHTML = chronoLaps.map(lap => `
      <div class="lap-item">
        <span class="lap-number">Vuelta ${lap.number}</span>
        <span class="lap-time">${lap.formatted}</span>
      </div>
    `).join('');
  };

  // Renderizar sesiones
  window.renderChronoSessions = function() {
    initChronoData();
    const container = document.getElementById('chrono-sessions');
    if (!container) return;
    
    const sessions = State.settings.chronoData.sessions.slice(0, 10);
    
    if (sessions.length === 0) {
      container.innerHTML = '<div class="sessions-empty">Sin sesiones registradas</div>';
      return;
    }
    
    container.innerHTML = sessions.map(session => `
      <div class="session-item">
        <span class="session-time">${session.formatted}</span>
        <span class="session-date">${new Date(session.date).toLocaleDateString('es-ES')}</span>
        ${session.laps > 0 ? `<span class="session-laps">${session.laps} vueltas</span>` : ''}
      </div>
    `).join('');
  };


  // Inicializar cuando se carga el partial
  document.addEventListener('partial-loaded', function(e) {
    if (e.detail && e.detail.name === 'p-reloj-crono') {
      setTimeout(() => {
        initChronoData();
        updateChronoDisplay();
        updateChronoButtons();
        renderLaps();
        renderChronoSessions();
      }, 150);
    }
  });
})();
