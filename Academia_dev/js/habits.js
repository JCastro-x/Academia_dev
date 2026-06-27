// HABITS.JS — Módulo de Hábitos para Academia
// Los hábitos son GLOBALES (no dependen del semestre)
// Se almacenan en State.settings.habits
// Estructura de un hábito:
// {
//   id: string,
//   nombre: string,
//   frecuencia: 'diaria' | 'semanal' | 'personalizada',
//   diasSemana: number[], // [0,1,2,3,4,5,6] donde 0=Dom, 1=Lun, ..., 6=Sab
//   rachaActual: number,
//   ultimaCompletada: string | null, // fecha ISO YYYY-MM-DD
//   emoji: string,
//   color: string, // hex color
//   historial: { [fecha: string]: boolean } // registro de días
// }

(function () {
  'use strict';

  // Inicializar habits si no existe o no es un array
  function initHabits() {
    if (!Array.isArray(State.settings.habits)) {
      console.warn('[HABITS] State.settings.habits no es un array, reinicializando');
      State.settings.habits = [];
    }
  }

  // Generar ID único
  function generateHabitId() {
    return 'hab_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // Obtener día de la semana (0=Dom, 1=Lun, ..., 6=Sab)
  function getDayOfWeek(date) {
    return date.getDay();
  }

  // Formatear fecha a YYYY-MM-DD
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Parsear fecha YYYY-MM-DD
  function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Verificar si una fecha es hoy
  function isToday(dateStr) {
    return dateStr === formatDate(new Date());
  }

  // Verificar si un día es parte del hábito
  function isHabitDay(habit, date) {
    const dayOfWeek = getDayOfWeek(date);
    return habit.diasSemana.includes(dayOfWeek);
  }

  // Calcular racha actual
  function calculateStreak(habit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);
    let streak = 0;
    let currentDate = new Date(today);

    // Si hoy es día del hábito y ya está completado, contar hoy
    if (isHabitDay(habit, today) && habit.historial[todayStr]) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // Si hoy no es día del hábito o no está completado, empezar desde ayer
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Contar hacia atrás hasta encontrar un día no completado
    let iterations = 0;
    while (iterations < 365) {
      const dateStr = formatDate(currentDate);
      
      // Si es día del hábito y está completado
      if (isHabitDay(habit, currentDate)) {
        if (habit.historial[dateStr]) {
          streak++;
        } else {
          break; // Se rompió la racha
        }
      }
      
      // Ir al día anterior
      currentDate.setDate(currentDate.getDate() - 1);
      iterations++;
    }

    return streak;
  }

  // Refrescar todas las rachas (llamar al cargar la página)
  function refreshAllStreaks() {
    initHabits();
    let updated = false;

    // Safety check: asegurar que habits es un array
    if (!Array.isArray(State.settings.habits)) {
      console.warn('[HABITS] State.settings.habits no es un array, inicializando como array vacío');
      State.settings.habits = [];
      return;
    }

    State.settings.habits.forEach(habit => {
      const newStreak = calculateStreak(habit);
      if (habit.rachaActual !== newStreak) {
        habit.rachaActual = newStreak;
        updated = true;
      }
    });

    if (updated) {
      saveHabits();
      console.log('🔄 Rachas actualizadas');
    }
  }

  // Crear nuevo hábito
  function createHabit(data) {
    initHabits();
    
    const habit = {
      id: generateHabitId(),
      nombre: data.nombre || 'Nuevo Hábito',
      frecuencia: data.frecuencia || 'diaria',
      diasSemana: data.diasSemana || [1, 2, 3, 4, 5], // Lun-Vie por defecto
      rachaActual: 0,
      ultimaCompletada: null,
      emoji: data.emoji || '✅',
      color: data.color || '#4ade80',
      historial: {}
    };

    State.settings.habits.push(habit);
    saveHabits();
    return habit;
  }

  // Actualizar hábito
  function updateHabit(id, updates) {
    initHabits();
    const habit = State.settings.habits.find(h => h.id === id);
    if (!habit) return null;

    Object.assign(habit, updates);
    saveHabits();
    return habit;
  }

  // Eliminar hábito
  function deleteHabit(id) {
    initHabits();
    const index = State.settings.habits.findIndex(h => h.id === id);
    if (index > -1) {
      State.settings.habits.splice(index, 1);
      saveHabits();
      return true;
    }
    return false;
  }

  // Completar/descompletar hábito para una fecha (3 estados: verde -> rojo -> gris)
  function toggleHabitCompletion(id, dateStr = formatDate(new Date())) {
    initHabits();
    const habit = State.settings.habits.find(h => h.id === id);
    if (!habit) return null;

    // Verificar que no sea una fecha futura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = parseDate(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate > today) {
      _appNotify('No puedes marcar días futuros', 'warning');
      return null;
    }

    // Toggle 3 estados: completed (verde) -> missed (rojo) -> none (gris)
    const currentValue = habit.historial[dateStr];
    
    if (currentValue === true) {
      // Verde -> Rojo (marcar como incompleto)
      habit.historial[dateStr] = false;
    } else if (currentValue === false) {
      // Rojo -> Gris (eliminar del historial)
      delete habit.historial[dateStr];
    } else {
      // Gris -> Verde (marcar como completado)
      habit.historial[dateStr] = true;
    }

    // Actualizar última completada
    const todayStr = formatDate(new Date());
    if (dateStr === todayStr || (habit.ultimaCompletada && dateStr > habit.ultimaCompletada)) {
      habit.ultimaCompletada = habit.historial[dateStr] === true ? dateStr : null;
    }

    // Recalcular racha
    habit.rachaActual = calculateStreak(habit);

    saveHabits();
    return habit;
  }

  // Guardar hábitos
  function saveHabits() {
    try {
      console.log('💾 [HABITS] Saving habits to State and Turso:', {
        habitsCount: State.settings.habits?.length || 0,
        habitsSample: State.settings.habits?.slice(0, 2) || []
      });
      console.table('💾 [HABITS] Current habits:', State.settings.habits || []);
      saveStateNow(['settings']);
    } catch (e) {
      console.error('❌ [HABITS] Error guardando hábitos:', e);
    }
  }

  // Obtener estado de un día específico
  function getDayStatus(habit, date) {
    const dateStr = formatDate(date);
    const isHabitDayFlag = isHabitDay(habit, date);
    const value = habit.historial[dateStr];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const isPast = checkDate < today;
    const isToday = dateStr === formatDate(new Date());

    if (value === true) {
      return 'completed'; // Completado (verde)
    }
    
    if (value === false) {
      return 'missed'; // Marcado como incompleto (rojo)
    }
    
    if (isPast && isHabitDayFlag) {
      return 'missed'; // No completado en día pasado que es día del hábito (rojo)
    }
    
    if (!isHabitDayFlag) {
      return 'none'; // No es día del hábito (gris, no cliclable)
    }
    
    return 'pending'; // Pendiente (gris/claro, cliclable)
  }

  // Obtener 7 días con el día actual centrado
  function getWeekDays() {
    const days = [];
    const today = new Date();
    
    // Mostrar 3 días antes, hoy, y 3 días después (7 días total)
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    
    return days;
  }

  // Renderizar vista de hábitos
  function renderHabits() {
    initHabits();
    const container = document.getElementById('habits-container');
    if (!container) return;

    const weekDays = getWeekDays();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

    // Safety check: ensure habits is an array
    if (!Array.isArray(State.settings.habits)) {
      console.warn('[HABITS] State.settings.habits is not an array, initializing as empty array');
      State.settings.habits = [];
    }

    if (State.settings.habits.length === 0) {
      container.innerHTML = `
        <div class="habits-empty">
          <div class="habits-empty-icon">🌱</div>
          <div class="habits-empty-text">No tienes hábitos aún</div>
          <div class="habits-empty-sub">Crea tu primer hábito para empezar a construir rachas</div>
          <button class="btn btn-primary" onclick="openAddHabitModal()">➕ Crear Hábito</button>
        </div>
      `;
      return;
    }

    let html = `
      <div class="habits-header">
        <h2>🌱 Mis Hábitos</h2>
        <button class="btn btn-primary btn-sm" onclick="openAddHabitModal()">➕ Nuevo</button>
      </div>
      <div class="habits-list">
    `;

    State.settings.habits.forEach(habit => {
      const weekHtml = weekDays.map((date, idx) => {
        const status = getDayStatus(habit, date);
        const dateStr = formatDate(date);
        const isToday = isTodayCheck(dateStr);
        
        let statusClass = '';
        let statusIcon = '';
        
        switch (status) {
          case 'completed':
            statusClass = 'day-completed';
            statusIcon = '✓';
            break;
          case 'missed':
            statusClass = 'day-missed';
            statusIcon = '✕';
            break;
          case 'none':
            statusClass = 'day-none';
            statusIcon = '';
            break;
          default:
            statusClass = 'day-pending';
            statusIcon = '';
        }

        if (isToday) statusClass += ' day-today';

        return `
          <div class="habit-day ${statusClass}" 
               onclick="toggleHabitDay('${habit.id}', '${dateStr}')"
               title="${dayNames[getDayOfWeek(date)]} ${date.getDate()}">
            <div class="day-name">${dayNames[getDayOfWeek(date)]}</div>
            <div class="day-marker">${statusIcon}</div>
          </div>
        `;
      }).join('');

      html += `
        <div class="habit-card" style="border-left-color: ${habit.color}">
          <div class="habit-info">
            <div class="habit-emoji">${habit.emoji}</div>
            <div class="habit-details">
              <div class="habit-name">${habit.nombre}</div>
              <div class="habit-streak">
                <span class="streak-fire">🔥</span>
                <span class="streak-count">${habit.rachaActual}</span>
                <span class="streak-label">días de racha</span>
              </div>
            </div>
            <div class="habit-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); editHabit('${habit.id}')" title="Editar">✏️</button>
              <button class="btn-icon" onclick="event.stopPropagation(); deleteHabitConfirm('${habit.id}')" title="Eliminar">🗑️</button>
            </div>
          </div>
          <div class="habit-week">
            ${weekHtml}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // Verificar si es hoy
  function isTodayCheck(dateStr) {
    return dateStr === formatDate(new Date());
  }

  // Abrir modal para agregar hábito
  function openAddHabitModal() {
    const modal = document.getElementById('modal-add-habit');
    if (modal) {
      modal.classList.add('open');
      // Reset form
      const form = document.getElementById('habit-form');
      if (form) form.reset();
      
      // Reset modo edición
      const editIdInput = document.getElementById('habit-edit-id');
      const modalTitle = document.getElementById('habit-modal-title');
      const saveBtn = document.getElementById('habit-save-btn');
      
      if (editIdInput) editIdInput.value = '';
      if (modalTitle) modalTitle.textContent = '🌱 Nuevo Hábito';
      if (saveBtn) saveBtn.textContent = 'Guardar';
    }
  }

  // Cerrar modal
  function closeAddHabitModal() {
    const modal = document.getElementById('modal-add-habit');
    if (modal) modal.classList.remove('open');
  }

  // Guardar hábito desde formulario
  function saveHabitFromForm() {
    const nombre = document.getElementById('habit-nombre')?.value?.trim();
    const emoji = document.getElementById('habit-emoji')?.value || '✅';
    const color = document.getElementById('habit-color')?.value || '#4ade80';
    const editId = document.getElementById('habit-edit-id')?.value;
    
    // Obtener días seleccionados
    const diasSemana = [];
    document.querySelectorAll('.habit-day-checkbox:checked').forEach(cb => {
      diasSemana.push(parseInt(cb.value));
    });

    if (!nombre) {
      _appNotify('Ingresa un nombre para el hábito', 'warning');
      return;
    }

    if (diasSemana.length === 0) {
      _appNotify('Selecciona al menos un día de la semana', 'warning');
      return;
    }

    if (editId) {
      // Modo edición
      updateHabit(editId, { nombre, emoji, color, diasSemana });
      closeAddHabitModal();
      renderHabits();
      if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
      _appNotify('Hábito actualizado', 'ok');
    } else {
      // Modo creación
      createHabit({
        nombre,
        emoji,
        color,
        diasSemana,
        frecuencia: 'personalizada'
      });
      closeAddHabitModal();
      renderHabits();
      if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
      _appNotify('Hábito creado exitosamente', 'ok');
    }
  }

  // Toggle día de hábito
  function toggleHabitDay(habitId, dateStr) {
    const habit = toggleHabitCompletion(habitId, dateStr);
    if (habit) {
      renderHabits();
      if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
      if (isTodayCheck(dateStr)) {
        const value = habit.historial[dateStr];
        if (value === true) {
          _appNotify('¡Hábito completado! 🔥', 'ok');
        } else if (value === false) {
          _appNotify('Hábito marcado como incompleto', 'warning');
        } else {
          _appNotify('Hábito desmarcado', 'ok');
        }
      }
    }
  }

  // Confirmar eliminación
  function deleteHabitConfirm(id) {
    showConfirm('¿Eliminar este hábito? Se perderá todo el historial.', { danger: true })
      .then(confirmed => {
        if (confirmed) {
          deleteHabit(id);
          renderHabits();
          if (typeof refreshAllWidgets === 'function') refreshAllWidgets();
          _appNotify('Hábito eliminado', 'ok');
        }
      });
  }

  // Editar hábito (abrir modal con datos)
  function editHabit(id) {
    initHabits();
    const habit = State.settings.habits.find(h => h.id === id);
    if (!habit) return;

    // Llenar formulario de edición
    const nombreInput = document.getElementById('habit-nombre');
    const emojiInput = document.getElementById('habit-emoji');
    const colorInput = document.getElementById('habit-color');
    const editIdInput = document.getElementById('habit-edit-id');
    const modalTitle = document.getElementById('habit-modal-title');
    const saveBtn = document.getElementById('habit-save-btn');

    if (nombreInput) nombreInput.value = habit.nombre;
    if (emojiInput) emojiInput.value = habit.emoji;
    if (colorInput) colorInput.value = habit.color;
    if (editIdInput) editIdInput.value = id;
    if (modalTitle) modalTitle.textContent = '✏️ Editar Hábito';
    if (saveBtn) saveBtn.textContent = 'Actualizar';

    // Marcar días
    document.querySelectorAll('.habit-day-checkbox').forEach(cb => {
      cb.checked = habit.diasSemana.includes(parseInt(cb.value));
    });

    // Abrir modal
    const modal = document.getElementById('modal-add-habit');
    if (modal) modal.classList.add('open');
  }


  // Inicializar cuando se carga la página
  document.addEventListener('partials-loaded', () => {
    initHabits();
    // Refrescar rachas al cargar (para actualizar conforme pasan los días)
    refreshAllStreaks();
    // Si estamos en la página de hábitos, renderizar
    if (document.getElementById('page-p-habits')?.classList.contains('active')) {
      renderHabits();
    }
  });

  // Exponer funciones globales
  window.Habits = {
    create: createHabit,
    update: updateHabit,
    delete: deleteHabit,
    toggle: toggleHabitCompletion,
    render: renderHabits,
    calculateStreak,
    getDayStatus,
    formatDate,
    isHabitDay
  };

  window.openAddHabitModal = openAddHabitModal;
  window.closeAddHabitModal = closeAddHabitModal;
  window.saveHabitFromForm = saveHabitFromForm;
  window.toggleHabitDay = toggleHabitDay;
  window.deleteHabitConfirm = deleteHabitConfirm;
  window.editHabit = editHabit;

  })();
