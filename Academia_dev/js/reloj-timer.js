/**
 * RELOJ-TIMER.JS — Funciones del Temporizador
 * 
 * Este archivo contiene las funciones del temporizador que deben estar disponibles globalmente.
 */

(function () {
  'use strict';

  // Variables del temporizador
  var timerRunning = false;
  var timerTotalMs = 0;
  var timerRemainingMs = 0;
  var timerInterval = null;
  var timerEndTime = null;

  // Inicializar datos del temporizador
  window.initTimerData = function() {
    if (!State.settings.timerData) {
      State.settings.timerData = {
        history: [],
        lastDuration: null
      };
    }
  };

  // Formatear tiempo
  function formatTimerTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Actualizar display
  function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (display) {
      display.textContent = formatTimerTime(timerRemainingMs);
    }
  }

  // Actualizar progreso
  function updateTimerProgress() {
    const progress = document.getElementById('timer-progress');
    if (progress && timerTotalMs > 0) {
      const pct = ((timerTotalMs - timerRemainingMs) / timerTotalMs) * 100;
      progress.style.width = pct + '%';
    }
  }

  // Actualizar botones
  function updateTimerButtons() {
    const pauseBtn = document.getElementById('timer-pause-btn');
    const resumeBtn = document.getElementById('timer-resume-btn');
    const cancelBtn = document.getElementById('timer-cancel-btn');

    if (pauseBtn) {
      pauseBtn.style.display = timerRunning ? 'inline-block' : 'none';
    }
    if (resumeBtn) {
      resumeBtn.style.display = !timerRunning && timerRemainingMs > 0 ? 'inline-block' : 'none';
    }
    if (cancelBtn) {
      cancelBtn.disabled = timerRemainingMs === 0;
    }
  }

  // Iniciar temporizador
  window.startTimer = function() {
    const hours = parseInt(document.getElementById('timer-hours').value) || 0;
    const minutes = parseInt(document.getElementById('timer-minutes').value) || 0;
    const seconds = parseInt(document.getElementById('timer-seconds').value) || 0;
    
    const totalMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
    
    if (totalMs <= 0) {
      _appNotify('Ingresa un tiempo válido', 'warning');
      return;
    }
    
    initTimerData();
    timerTotalMs = totalMs;
    timerRemainingMs = totalMs;
    timerRunning = true;
    timerEndTime = Date.now() + totalMs;
    
    // Guardar última duración
    State.settings.timerData.lastDuration = { hours, minutes, seconds };
    saveState(['settings']);
    
    // Cambiar vistas
    document.getElementById('timer-config').style.display = 'none';
    document.getElementById('timer-running').style.display = 'block';
    document.getElementById('timer-running').classList.remove('alarm');
    
    updateTimerDisplay();
    updateTimerProgress();
    updateTimerButtons();
    
    // Iniciar intervalo
    timerInterval = setInterval(() => {
      timerRemainingMs = timerEndTime - Date.now();
      
      if (timerRemainingMs <= 0) {
        timerRemainingMs = 0;
        timerFinished();
      }
      
      updateTimerDisplay();
      updateTimerProgress();
    }, 100);
  };

  // Temporizador terminado
  function timerFinished() {
    clearInterval(timerInterval);
    timerRunning = false;
    
    // Efecto visual de parpadeo en pantalla
    const flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 100, 100, 0.3);
      z-index: 9999;
      pointer-events: none;
      animation: flashAnimation 0.5s ease-in-out 6;
    `;
    
    // Agregar keyframes de animación si no existen
    if (!document.getElementById('timer-flash-styles')) {
      const style = document.createElement('style');
      style.id = 'timer-flash-styles';
      style.textContent = `
        @keyframes flashAnimation {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(flashOverlay);
    
    // Eliminar overlay después de 3 segundos
    setTimeout(() => {
      flashOverlay.remove();
    }, 3000);
    
    // Efecto visual en el timer
    document.getElementById('timer-running').classList.add('alarm');
    
    // Sonar alarma (si hay sonidos habilitados)
    if (typeof playAlarm === 'function') {
      playAlarm();
    }
    
    // Intentar reproducir sonido con Web Audio API como fallback
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      
      // Sonar 3 veces
      let count = 0;
      const beepInterval = setInterval(() => {
        count++;
        if (count >= 3) {
          clearInterval(beepInterval);
          oscillator.stop();
          audioContext.close();
        } else {
          oscillator.frequency.value = count % 2 === 0 ? 800 : 600;
        }
      }, 500);
    } catch (e) {
      console.warn('Web Audio API no disponible:', e);
    }
    
    // Guardar en historial
    const historyItem = {
      date: new Date().toISOString(),
      duration: formatTimerTime(timerTotalMs),
      completed: true
    };
    
    State.settings.timerData.history.unshift(historyItem);
    if (State.settings.timerData.history.length > 20) {
      State.settings.timerData.history = State.settings.timerData.history.slice(0, 20);
    }
    saveState(['settings']);
    renderTimerHistory();
    
    // Notificación
    _appNotify('¡Temporizador completado!', 'ok');
    
    // Auto-reset después de 3 segundos
    setTimeout(() => {
      resetTimer();
    }, 3000);
  }

  // Pausar
  window.pauseTimer = function() {
    if (timerRunning) {
      timerRunning = false;
      clearInterval(timerInterval);
      timerInterval = null;
      updateTimerButtons();
      const status = document.getElementById('timer-status');
      if (status) status.textContent = 'Pausado';
    }
  };

  // Reanudar
  window.resumeTimer = function() {
    if (!timerRunning && timerRemainingMs > 0) {
      timerRunning = true;
      timerEndTime = Date.now() + timerRemainingMs;
      
      timerInterval = setInterval(() => {
        timerRemainingMs = timerEndTime - Date.now();
        
        if (timerRemainingMs <= 0) {
          timerRemainingMs = 0;
          timerFinished();
        }
        
        updateTimerDisplay();
        updateTimerProgress();
      }, 100);
      
      updateTimerButtons();
      const status = document.getElementById('timer-status');
      if (status) status.textContent = 'Corriendo';
    }
  };

  // Cancelar/Reiniciar
  window.resetTimer = function() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerInterval = null;
    timerRemainingMs = 0;
    timerTotalMs = 0;
    
    document.getElementById('timer-config').style.display = 'block';
    document.getElementById('timer-running').style.display = 'none';
    document.getElementById('timer-running').classList.remove('alarm');
    
    updateTimerButtons();
  };

  // Presets
  window.setTimerPreset = function(minutes) {
    const hoursInput = document.getElementById('timer-hours');
    const minutesInput = document.getElementById('timer-minutes');
    const secondsInput = document.getElementById('timer-seconds');
    
    if (hoursInput) hoursInput.value = 0;
    if (minutesInput) minutesInput.value = minutes;
    if (secondsInput) secondsInput.value = 0;
    
    // Visual feedback
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.style.background = '';
      btn.style.color = '';
    });
    if (event && event.target) {
      event.target.style.background = 'var(--accent)';
      event.target.style.color = 'white';
    }
  };

  // Agregar tiempo
  window.addTimerTime = function(minutes) {
    if (timerRunning) {
      timerEndTime += minutes * 60 * 1000;
      timerTotalMs += minutes * 60 * 1000;
      timerRemainingMs = timerEndTime - Date.now();
      _appNotify(`+${minutes} minutos agregados`, 'ok');
    }
  };

  // Renderizar historial
  window.renderTimerHistory = function() {
    initTimerData();
    const container = document.getElementById('timer-history-list');
    if (!container) return;
    
    const history = State.settings.timerData.history.slice(0, 10);
    
    if (history.length === 0) {
      container.innerHTML = '<div class="history-empty">Sin temporizadores completados</div>';
      return;
    }
    
    container.innerHTML = history.map(item => {
      const date = new Date(item.date);
      const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
      const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="history-item">
          <span class="history-date">${dateStr} ${timeStr}</span>
          <span class="history-duration">${item.duration}</span>
        </div>
      `;
    }).join('');
  };

  console.log('⏱️ Temporizador module loaded');

  // Inicializar cuando se carga el partial
  document.addEventListener('partial-loaded', function(e) {
    if (e.detail && e.detail.name === 'p-reloj-timer') {
      console.log('✅ Partial p-reloj-timer cargado, inicializando...');
      setTimeout(() => {
        initTimerData();
        renderTimerHistory();

        // Cargar última duración si existe
        if (State.settings.timerData?.lastDuration) {
          const { hours, minutes, seconds } = State.settings.timerData.lastDuration;
          const hoursInput = document.getElementById('timer-hours');
          const minutesInput = document.getElementById('timer-minutes');
          const secondsInput = document.getElementById('timer-seconds');
          if (hoursInput) hoursInput.value = hours || 0;
          if (minutesInput) minutesInput.value = minutes || 0;
          if (secondsInput) secondsInput.value = seconds || 0;
        }
        console.log('✅ Temporizador inicializado');
      }, 150);
    }
  });
})();
