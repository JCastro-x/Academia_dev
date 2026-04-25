let calY, calM;
function initCal() { const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); }
function calNav(d)  { calM += d; if (calM>11){calM=0;calY++;}else if(calM<0){calM=11;calY--;} renderCalendar(); }

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderCalendar() { _schedRender(_renderCalendar); }
function _renderCalendar() {
  const monthStr = `${calY}-${String(calM+1).padStart(2,'0')}`;
  document.getElementById('cal-month-title').textContent = `${MONTHS[calM]} ${calY}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM+1, 0).getDate();

  const legendEl = _el('cal-legend');
  if (legendEl) {
    legendEl.innerHTML = `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-right:4px;">CLASES:</span>`
      + State.materias.slice(0,8).map(m =>
          `<span class="cal-legend-item" style="--lc:${m.color};">${m.icon||''} ${m.code}</span>`
        ).join('')
      + `<span class="cal-legend-item" style="--lc:#f87171;">✅ Tareas</span>`;
  }

  let html = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    .map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i=0; i<first; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const ds   = `${monthStr}-${String(d).padStart(2,'0')}`;
    const cellDate = new Date(calY,calM,d);
    const isT  = cellDate.getTime() === today.getTime();
    const isPast = cellDate.getTime() < today.getTime();
    const de   = State.events.filter(e => e.date === ds);
    const dt   = State.tasks.filter(t => t.due === ds && !t.done);
    const total = de.length + dt.length;

    const eventsHtml = de.slice(0, 2).map(e => {
      const m = getMat(e.matId);
      return `<div class="cal-event" style="background:${m.color||'#7c6aff'}2a;color:${m.color||'#7c6aff'};border-left:2px solid ${m.color||'#7c6aff'};" title="${e.title}">${e.title}</div>`;
    }).join('');

    const tasksHtml = de.length < 2 ? dt.slice(0, 2-de.length).map(t => {
      const pCol = t.priority==='high'?'#f87171':t.priority==='low'?'#4ade80':'#fbbf24';
      return `<div class="cal-event" style="background:${pCol}1a;color:${pCol};border-left:2px dashed ${pCol};" title="✅ ${t.title}">✅ ${t.title}</div>`;
    }).join('') : '';

    const overflow = total > 2 ? `<div style="font-size:9px;color:var(--text3);padding:1px 3px;">+${total-2} más</div>` : '';

    let cellClass = 'cal-cell';
    if (isT) cellClass += ' today';
    else if (isPast) cellClass += ' past';

    html += `<div class="${cellClass}" onclick="calDayClick('${ds}')">
      <div class="cal-num">${d}</div>
      ${eventsHtml}${tasksHtml}${overflow}
    </div>`;
  }
  _el('cal-grid').innerHTML = html;

  const mEvs   = State.events.filter(e => e.date.startsWith(monthStr)).sort((a,b)=>a.date<b.date?-1:1);
  const mTasks = State.tasks.filter(t => t.due?.startsWith(monthStr)).sort((a,b)=>a.due<b.due?-1:1);

  let listHtml = '';
  if (mEvs.length) {
    listHtml += `<div class="section-title">📅 Eventos del mes</div>`;
    listHtml += mEvs.map(e => {
      const m = getMat(e.matId);
      // Parsear fecha en zona horaria local (evitar problema UTC)
      const [year, month, day] = e.date.split('-').map(Number);
      const evDate = new Date(year, month - 1, day);
      evDate.setHours(0,0,0,0);
      const dLeft = Math.ceil((evDate - today) / 86400000);
      let cdClass = 'ok', cdText = `${dLeft}d`;
      if (dLeft < 0)      { cdClass='urgent'; cdText=`hace ${-dLeft}d`; }
      else if (dLeft===0) { cdClass='urgent'; cdText='¡HOY!'; }
      else if (dLeft<=3)  { cdClass='urgent'; cdText=`${dLeft} día${dLeft===1?'':'s'}`; }
      else if (dLeft<=7)  { cdClass='warn';   cdText=`${dLeft} días`; }
      else                { cdClass='ok';     cdText=`${dLeft} días`; }
      const countdownBadge = `<span class="ev-countdown-badge ${cdClass}">${cdText}</span>`;
      return `<div class="task-item" style="align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:${m.color||'#7c6aff'};flex-shrink:0;margin-top:0;"></div>
        <div style="flex:1;">
          <div style="font-size:13.5px;font-weight:600;">${e.title}${countdownBadge}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.name||''} · ${fmtD(e.date)}${e.hora?' · '+e.hora:''}${e.horaEnd?' - '+e.horaEnd:''}${e.desc?' · '+e.desc:''}</div>
        </div>
        <span class="type-badge ${getTypeBadgeClass(e.type)}">${e.type||''}</span>
        <button class="btn btn-ghost btn-sm" onclick="editEvent('${e.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">🗑️</button>
      </div>`;
    }).join('');
  }
  if (mTasks.length) {
    listHtml += `<div class="section-title" style="margin-top:16px;">✅ Tareas con fecha este mes</div>`;
    listHtml += mTasks.map(t => {
      const m = getMat(t.matId);
      const prog = subtaskProgress(t);
      return `<div class="task-item${t.done?' done':''}">
        <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')"></div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${t.title}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.code||''} · ${fmtD(t.due)} · ${t.type||'Tarea'}</div>
          ${prog ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            <div class="prog-bar" style="width:80px;"><div class="prog-fill" style="background:#7c6aff;width:${prog.pct}%;"></div></div>
            <span style="font-size:10px;color:var(--text3);">${prog.done}/${prog.total}</span>
          </div>` : ''}
        </div>
        ${prioBadge(t.priority)}
      </div>`;
    }).join('');
  }
  if (!mEvs.length && !mTasks.length) {
    listHtml = `<div style="text-align:center;padding:28px;color:var(--text3);">📅 Sin eventos ni tareas este mes</div>`;
  }
  _el('cal-events-list').innerHTML = listHtml;
}

function calDayClick(ds) {
  const dayEvents = State.events.filter(e => e.date === ds);
  const dayTasks = State.tasks.filter(t => t.due === ds && !t.done);
  
  // Si hay eventos o tareas, abrir modal con ellos
  if (dayEvents.length > 0 || dayTasks.length > 0) {
    openDayEventsModal(ds, dayEvents, dayTasks);
  } else {
    // Si no hay eventos, abrir modal para crear uno con la fecha preseleccionada
    openEventModal();
    document.getElementById('ev-date').value = ds;
  }
}

function openDayEventsModal(date, events, tasks) {
  const modal = document.getElementById('modal-day-events');
  if (!modal) {
    // Crear modal si no existe
    const modalHtml = `
      <div class="modal-overlay" id="modal-day-events">
        <div class="modal" style="max-width:800px;">
          <div class="modal-close" onclick="closeModal('modal-day-events')">✕</div>
          <div class="modal-title">📅 Eventos del ${date}</div>
          <div id="day-events-list" style="max-height:600px;overflow-y:auto;margin-bottom:16px;"></div>
          <div class="form-actions">
            <button class="btn btn-primary" onclick="openEventModal();document.getElementById('ev-date').value='${date}';closeModal('modal-day-events');">+ Nuevo Evento</button>
            <button class="btn btn-ghost" onclick="closeModal('modal-day-events')">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  
  // Renderizar eventos del día
  const listEl = document.getElementById('day-events-list');
  if (listEl) {
    let html = '';
    
    // Separar eventos con hora y sin hora
    const eventsWithTime = events.filter(e => e.hora);
    const eventsWithoutTime = events.filter(e => !e.hora);
    
    // Calcular rango de horas dinámico
    let startHour = 0;
    let endHour = 24;
    
    if (eventsWithTime.length === 1) {
      // Si hay un solo evento, mostrar 2 horas antes y 2 horas después
      const [evStartHour] = eventsWithTime[0].hora.split(':').map(Number);
      const [evEndHour] = (eventsWithTime[0].horaEnd || eventsWithTime[0].hora).split(':').map(Number);
      startHour = Math.max(0, evStartHour - 2);
      endHour = Math.min(24, evEndHour + 2);
    }
    
    // Línea de tiempo - mostrar solo si hay eventos con hora
    if (eventsWithTime.length > 0) {
      html += '<div style="font-size:11px;color:var(--text3);font-family:\'Space Mono\',monospace;margin-bottom:12px;">HORARIO DEL DÍA</div>';
      html += '<div style="display:flex;gap:16px;background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:16px;">';
      
      // Columna de horas (izquierda)
      html += '<div style="flex:0 0 60px;position:relative;border-right:2px solid var(--border);padding-right:12px;">';
      for (let hour = startHour; hour < endHour; hour++) {
        html += `<div style="height:60px;display:flex;align-items:center;justify-content:flex-end;font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;padding-right:8px;">${String(hour).padStart(2,'0')}:00</div>`;
        html += `<div style="height:1px;background:var(--border);margin-left:-20px;margin-right:-12px;"></div>`;
      }
      html += '</div>';
      
      // Calcular altura total y offset
      const totalHours = endHour - startHour;
      const totalHeight = totalHours * 60;
      const offsetMinutes = startHour * 60;
      
      // Columna de eventos (derecha)
      html += `<div style="flex:1;position:relative;height:${totalHeight}px;">`;
      
      // Líneas horizontales cada hora
      for (let hour = startHour; hour < endHour; hour++) {
        const top = (hour - startHour) * 60;
        html += `<div style="position:absolute;top:${top}px;left:0;right:0;height:1px;background:var(--border);opacity:0.3;"></div>`;
      }
      
      // Renderizar eventos en la línea de tiempo
      eventsWithTime.forEach(e => {
        const m = getMat(e.matId);
        const [eStartHour, eStartMin] = e.hora.split(':').map(Number);
        const [eEndHour, eEndMin] = (e.horaEnd || e.hora).split(':').map(Number);
        
        const startMinutes = eStartHour * 60 + eStartMin;
        const endMinutes = eEndHour * 60 + eEndMin;
        const duration = Math.max(endMinutes - startMinutes, 30); // Mínimo 30 minutos
        
        const top = startMinutes - offsetMinutes;
        const height = duration;
        
        html += `
          <div style="position:absolute;top:${top}px;left:8px;right:8px;height:${height}px;background:${m.color||'#7c6aff'}22;border-left:4px solid ${m.color||'#7c6aff'};border-radius:6px;padding:8px 10px;cursor:pointer;overflow:hidden;" onclick="editEvent('${e.id}')">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.title}</div>
            <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${e.hora}${e.horaEnd ? ' - '+e.horaEnd : ''}</div>
            <div style="font-size:10px;color:var(--text3);">${m.icon||''} ${m.code||m.name||''}</div>
          </div>
        `;
      });
      
      // Mensaje si no hay eventos con hora pero hay eventos sin hora
      if (eventsWithTime.length === 0 && eventsWithoutTime.length > 0) {
        html += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:var(--text3);">Los eventos no tienen hora específica</div>`;
      }
      
      html += '</div></div>';
    }
    
    // Eventos sin hora - mostrar lista
    if (eventsWithoutTime.length > 0) {
      html += '<div style="font-size:11px;color:var(--text3);font-family:\'Space Mono\',monospace;margin-bottom:8px;">EVENTOS SIN HORA</div>';
      eventsWithoutTime.forEach(e => {
        const m = getMat(e.matId);
        html += `
          <div class="task-item" style="align-items:center;">
            <div style="width:9px;height:9px;border-radius:50%;background:${m.color||'#7c6aff'};flex-shrink:0;margin-top:0;"></div>
            <div style="flex:1;">
              <div style="font-size:13.5px;font-weight:600;">${e.title}</div>
              <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.name||''} · ${e.type||''}${e.desc?' · '+e.desc:''}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="editEvent('${e.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}');closeModal('modal-day-events');">🗑️</button>
          </div>
        `;
      });
    }
    
    // Tareas
    if (tasks.length > 0) {
      html += '<div style="font-size:11px;color:var(--text3);font-family:\'Space Mono\',monospace;margin:16px 0 8px;">TAREAS</div>';
      tasks.forEach(t => {
        const m = getMat(t.matId);
        html += `
          <div class="task-item" style="align-items:center;">
            <div class="task-check" onclick="toggleTask('${t.id}');closeModal('modal-day-events');"></div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">${t.title}</div>
              <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.code||''} · ${t.type||'Tarea'}</div>
            </div>
          </div>
        `;
      });
    }
    
    if (!events.length && !tasks.length) {
      html = '<div style="text-align:center;padding:20px;color:var(--text3);">Sin eventos ni tareas</div>';
    }
    
    listEl.innerHTML = html;
  }
  
  document.getElementById('modal-day-events').classList.add('open');
}

function editEvent(id) {
  const event = State.events.find(e => e.id === id);
  if (!event) return;
  
  closeModal('modal-day-events');
  
  // Llenar el modal de evento con los datos del evento
  fillMatSels();
  document.getElementById('ev-title').value = event.title;
  document.getElementById('ev-mat').value = event.matId;
  document.getElementById('ev-type').value = event.type || 'Parcial';
  document.getElementById('ev-date').value = event.date;
  document.getElementById('ev-time').value = event.hora || '';
  document.getElementById('ev-time-end').value = event.horaEnd || '';
  document.getElementById('ev-desc').value = event.desc || '';
  
  // Guardar el ID del evento que se está editando
  document.getElementById('modal-event').dataset.editingId = id;
  
  // Cambiar el título del modal
  document.querySelector('#modal-event .modal-title').textContent = '✏️ Editar Evento';
  
  document.getElementById('modal-event').classList.add('open');
}

function openEventModal() {
  fillMatSels();
  ['ev-title','ev-desc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ev-date').value = '';
  document.getElementById('ev-time').value = '';
  document.getElementById('ev-time-end').value = '';
  
  // Limpiar el ID de edición y restaurar el título
  delete document.getElementById('modal-event').dataset.editingId;
  document.querySelector('#modal-event .modal-title').textContent = '📅 Nuevo Evento / Parcial';
  
  document.getElementById('modal-event').classList.add('open');
}
function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) return;
  
  const editingId = document.getElementById('modal-event').dataset.editingId;
  
  if (editingId) {
    // Modo edición: actualizar evento existente
    const eventIndex = State.events.findIndex(e => e.id === editingId);
    if (eventIndex !== -1) {
      State.events[eventIndex] = {
        ...State.events[eventIndex],
        title,
        matId: document.getElementById('ev-mat').value,
        type:  document.getElementById('ev-type').value,
        date:  document.getElementById('ev-date').value,
        hora:  document.getElementById('ev-time').value,
        horaEnd: document.getElementById('ev-time-end').value,
        desc:  document.getElementById('ev-desc').value,
      };
    }
  } else {
    // Modo creación: agregar nuevo evento
    State.events.push({
      id: Date.now().toString(), title,
      matId: document.getElementById('ev-mat').value,
      type:  document.getElementById('ev-type').value,
      date:  document.getElementById('ev-date').value,
      hora:  document.getElementById('ev-time').value,
      horaEnd: document.getElementById('ev-time-end').value,
      desc:  document.getElementById('ev-desc').value,
    });
  }
  
  saveState(['events']);
  closeModal('modal-event');
  renderCalendar();
  renderOverview();
}
function deleteEvent(id) {
  State.events = State.events.filter(e => e.id !== id);
  saveState(['events']); renderCalendar(); renderOverview();
}
