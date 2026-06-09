// ══ RECORDATORIOS ════════════════════════════════════════════════════════════
// Lógica:
//  1. Al inicio del día → banner "Tareas de hoy" (una sola vez por día)
//  2. A la hora exacta de planificación de cada tarea
//  3. 1 día antes del vencimiento (una vez por día)
//  4. El momento exacto del vencimiento (si tiene hora) o inicio del día del vencimiento
//
// INFRAESTRUCTURA HÍBRIDA: IndexedDB + Service Worker checks
// - Notificaciones se guardan en IndexedDB para persistencia
// - Service Worker revisa notificaciones pendientes al activarse
// - Listo para migración a Push API en el futuro

const _NOTIF_KEY = 'academia_notif_fired'; // localStorage: { date, firedIds[] }

// ── Helpers ──────────────────────────────────────────────────────────────────
function _today() { return new Date().toISOString().split('T')[0]; }
function _tomorrow() { return new Date(Date.now() + 86400000).toISOString().split('T')[0]; }

/** Devuelve el registro de notifs ya disparadas HOY (se resetea cada día) */
function _getFired() {
  try {
    const raw = JSON.parse(localStorage.getItem(_NOTIF_KEY) || '{}');
    if (raw.date !== _today()) return { date: _today(), ids: [] };
    return raw;
  } catch { return { date: _today(), ids: [] }; }
}

function _markFired(id) {
  const f = _getFired();
  if (!f.ids.includes(id)) { f.ids.push(id); localStorage.setItem(_NOTIF_KEY, JSON.stringify(f)); }
}

function _wasFired(id) { return _getFired().ids.includes(id); }

/** Muestra notificación nativa (via SW) */
function _pushNotif(title, body, tag) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(r => r.showNotification(title, {
    body,
    icon: '/assets/icons/icon-192.png',
    tag,
    renotify: false,
    data: { url: '/index.html' },
    actions: [{ action: 'open', title: 'Ver tareas' }]
  })).catch(() => {});
}

/** Muestra un banner en pantalla (in-app) */
function _showBanner(icon, msg, color, bg, border, key) {
  const wrap = document.getElementById('reminder-banners');
  if (!wrap) return;

  // Evitar duplicado visual
  if (document.getElementById(`rb-${key}`)) return;

  const div = document.createElement('div');
  div.id = `rb-${key}`;
  div.style.cssText = `
    pointer-events:all;
    background:${bg};
    border:1px solid ${border};
    border-left:4px solid ${border};
    color:${color};
    padding:10px 16px;
    margin:6px 12px;
    border-radius:10px;
    font-size:13px;
    font-weight:600;
    font-family:'Syne',sans-serif;
    display:flex;
    align-items:center;
    gap:10px;
    box-shadow:0 4px 15px rgba(0,0,0,0.4);
    backdrop-filter:blur(8px);
    animation: slideDown 0.3s ease;
  `;
  div.innerHTML = `
    <span style="font-size:16px;">${icon}</span>
    <span style="flex:1;line-height:1.4;">${msg}</span>
    <button onclick="this.parentElement.remove()" style="
      background:rgba(255,255,255,0.1);border:none;color:${color};
      cursor:pointer;font-size:16px;width:24px;height:24px;
      display:flex;align-items:center;justify-content:center;
      border-radius:6px;transition:background 0.2s;
    " onmouseover="this.style.background='rgba(255,255,255,0.2)'"
       onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
  `;
  wrap.appendChild(div);
}

// ── Init ─────────────────────────────────────────────────────────────────────
let _notifsScheduled = false; // Guard: solo se ejecuta UNA vez por sesión

async function initNotifications() {
  // Crear contenedor de banners si no existe
  if (!document.getElementById('reminder-banners')) {
    const w = document.createElement('div');
    w.id = 'reminder-banners';
    w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1200;display:flex;flex-direction:column;pointer-events:none;';
    document.body.appendChild(w);
  }

  // Inicializar IndexedDB de notificaciones
  if (typeof NOTIFS_DB !== 'undefined') {
    try {
      await NOTIFS_DB.init();
    } catch (err) {
      console.warn('⚠️ Error inicializando IndexedDB de notificaciones:', err);
    }
  }

  // Pedir permiso si hace falta (de forma elegante)
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permisos de notificación concedidos');
        _runNotifications();
      } else {
        console.warn('⚠️ Permisos de notificación denegados');
      }
    }, 3000);
  } else {
    _runNotifications();
  }
}

// ── Core ─────────────────────────────────────────────────────────────────────
function _runNotifications() {
  if (_notifsScheduled) return;   // ← guard principal anti-duplicado
  _notifsScheduled = true;

  _showDailyBanner();             // 1. Banner resumen del día
  _scheduleTimed();               // 2 & 3 & 4. Timers por hora exacta
  _checkPendingNotifications();  // 5. Revisar notificaciones pendientes en IndexedDB
}

// ── Check de notificaciones pendientes (cuando la app se abre) ─────────
async function _checkPendingNotifications() {
  if (typeof NOTIFS_DB === 'undefined') return;

  try {
    const pending = await NOTIFS_DB.getPending();
    if (pending.length === 0) return;

    console.log(`🔔 ${pending.length} notificaciones pendientes encontradas`);

    for (const notif of pending) {
      _pushNotif(notif.title, notif.body, notif.id);
      await NOTIFS_DB.markAsFired(notif.id);
    }
  } catch (err) {
    console.warn('⚠️ Error revisando notificaciones pendientes:', err);
  }
}

// 1. BANNER DE INICIO DEL DÍA ─────────────────────────────────────────────
function _showDailyBanner() {
  const today   = _today();
  const tasks   = (typeof State !== 'undefined' ? State.tasks : []).filter(t => !t.done);

  // Tareas relevantes para hoy
  const dueToday      = tasks.filter(t => t.due === today);
  const plannedToday  = tasks.filter(t => t.datePlanned === today);
  const overdue       = tasks.filter(t => t.due && t.due < today);

  // ── Banner vencidas (solo si hay, solo una vez al día) ──
  if (overdue.length && !_wasFired('daily-overdue')) {
    const names = overdue.map(t => t.title).join(', ');
    _showBanner('⚠️', `${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}: ${names}`,
      '#ff8a8a', 'rgba(40,20,20,0.95)', '#f87171', 'overdue');
    _pushNotif('⚠️ Tareas vencidas', names, 'daily-overdue');
    _markFired('daily-overdue');
  }

  // ── Banner entrega hoy ──
  if (dueToday.length && !_wasFired('daily-due-today')) {
    const names = dueToday.map(t => t.dueTime ? `${t.title} (${t.dueTime})` : t.title).join(', ');
    _showBanner('🔴', `Entrega hoy: ${names}`,
      '#ff8a8a', 'rgba(40,20,20,0.95)', 'rgba(248,113,113,0.8)', 'due-today');
    _pushNotif('🔴 Entrega hoy', names, 'daily-due-today');
    _markFired('daily-due-today');
  }

  // ── Banner planificadas hoy ──
  if (plannedToday.length && !_wasFired('daily-planned')) {
    const names = plannedToday.map(t => t.timePlanned ? `${t.title} (${t.timePlanned})` : t.title).join(', ');
    _showBanner('📋', `Tareas de hoy: ${names}`,
      '#c7c4ff', 'rgba(25,25,45,0.98)', '#7c6aff', 'planned');
    _pushNotif('📋 Tareas de hoy', names, 'daily-planned');
    _markFired('daily-planned');
  }
}

// 2, 3, 4. TIMERS CON HORA EXACTA ─────────────────────────────────────────
function _scheduleTimed() {
  const today    = _today();
  const tomorrow = _tomorrow();
  const now      = new Date();
  const tasks    = (typeof State !== 'undefined' ? State.tasks : []).filter(t => !t.done);

  // Helper: ms hasta HH:MM hoy
  const msUntil = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    return target - now;
  };

  // Helper: programa un timer solo si no fue disparado ya hoy
  const fireAt = (ms, id, fn) => {
    if (ms <= 0 || ms > 86400000) return;   // fuera del rango del día
    if (_wasFired(id)) return;               // ya disparado hoy
    setTimeout(() => { if (!_wasFired(id)) { fn(); _markFired(id); } }, ms);
  };

  tasks.forEach(t => {
    const mat = getMat ? getMat(t.matId) : {};

    // ── Hora de planificación ──────────────────────────────────────────────
    if (t.datePlanned === today && t.timePlanned) {
      const ms  = msUntil(t.timePlanned);
      const id  = `plan-${t.id}`;
      
      // Guardar en IndexedDB para persistencia
      if (typeof NOTIFS_DB !== 'undefined' && ms > 0) {
        const scheduledFor = new Date(Date.now() + ms).toISOString();
        NOTIFS_DB.schedule({
          taskId: t.id,
          type: 'task_planned',
          title: `📋 ${t.title}`,
          body: `${mat.name || 'Hora de trabajar'} · ${t.timePlanned}`,
          scheduledFor: scheduledFor,
        }).catch(err => console.warn('⚠️ Error guardando notificación en IndexedDB:', err));
      }

      fireAt(ms, id, () => {
        const body = `${mat.name || 'Hora de trabajar'} · ${t.timePlanned}`;
        _showBanner(`${mat.icon || '📚'}`, `${t.title} — ${body}`,
          '#c7c4ff', 'rgba(25,25,45,0.98)', '#7c6aff', id);
        _pushNotif(`📋 ${t.title}`, body, id);
      });
    }

    // ── 1 día antes del vencimiento ───────────────────────────────────────
    if (t.due === tomorrow && !_wasFired(`pre-${t.id}`)) {
      const id = `pre-${t.id}`;
      
      // Guardar en IndexedDB (programado para mañana a las 9:00 AM)
      if (typeof NOTIFS_DB !== 'undefined') {
        const tomorrow9AM = new Date(tomorrow + 'T09:00:00').toISOString();
        NOTIFS_DB.schedule({
          taskId: t.id,
          type: 'task_due_soon',
          title: '📅 Vence mañana',
          body: t.title,
          scheduledFor: tomorrow9AM,
        }).catch(err => console.warn('⚠️ Error guardando notificación en IndexedDB:', err));
      }

      fireAt(60000, id, () => {
        _showBanner('📅', `Vence mañana: ${t.title}`,
          '#fcd34d', 'rgba(30,25,10,0.95)', '#f59e0b', id);
        _pushNotif('📅 Vence mañana', t.title, id);
      });
    }

    // ── Momento exacto de vencimiento ─────────────────────────────────────
    if (t.due === today && t.dueTime) {
      const ms = msUntil(t.dueTime);
      const id = `due-${t.id}`;
      
      // Guardar en IndexedDB
      if (typeof NOTIFS_DB !== 'undefined' && ms > 0) {
        const scheduledFor = new Date(Date.now() + ms).toISOString();
        NOTIFS_DB.schedule({
          taskId: t.id,
          type: 'task_due_now',
          title: `🔴 ¡Vence ahora! ${t.title}`,
          body: `${mat.name || 'Vence ahora'} · ${t.dueTime}`,
          scheduledFor: scheduledFor,
        }).catch(err => console.warn('⚠️ Error guardando notificación en IndexedDB:', err));
      }

      fireAt(ms, id, () => {
        const body = `${mat.name || 'Vence ahora'} · ${t.dueTime}`;
        _showBanner('🔴', `¡Vence ahora! ${t.title} — ${body}`,
          '#ff8a8a', 'rgba(40,20,20,0.95)', '#f87171', id);
        _pushNotif(`🔴 ¡Vence ahora! ${t.title}`, body, id);
      });
    }
  });
}

// ── TEST NOTIFICATION (para pruebas de persistencia) ─────────────────────
window.testNotification = async function() {
  console.log('🧪 Iniciando prueba de notificación (5 segundos)...');

  // Verificar permisos
  if (!('Notification' in window)) {
    console.error('❌ Este navegador no soporta notificaciones');
    alert('❌ Este navegador no soporta notificaciones');
    return;
  }

  if (Notification.permission === 'denied') {
    console.error('❌ Permisos de notificación denegados');
    alert('❌ Permisos de notificación denegados. Actívalos en configuración del navegador.');
    return;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.error('❌ Permisos no concedidos');
      alert('❌ Permisos no concedidos');
      return;
    }
  }

  // Programar notificación de prueba en 5 segundos
  const scheduledFor = new Date(Date.now() + 5000).toISOString();
  const testId = `test_${Date.now()}`;

  // Guardar en IndexedDB
  if (typeof NOTIFS_DB !== 'undefined') {
    try {
      await NOTIFS_DB.schedule({
        id: testId,
        type: 'test',
        title: '🧪 Notificación de Prueba',
        body: 'Si ves esto, el sistema de notificaciones persistente funciona correctamente. Puedes cerrar la app y esperar 5 segundos.',
        scheduledFor: scheduledFor,
      });
      console.log('✅ Notificación de prueba guardada en IndexedDB');
      console.log(`⏰ Se disparará en 5 segundos (${new Date(Date.now() + 5000).toLocaleTimeString()})`);
      console.log('💡 CIERRA LA APP AHORA para probar persistencia');
      alert('✅ Notificación programada en 5 segundos.\n\nCIERRA LA APP AHORA para probar que llega aunque la pestaña esté cerrada.');
    } catch (err) {
      console.error('❌ Error guardando notificación de prueba:', err);
      alert('❌ Error guardando notificación de prueba: ' + err.message);
    }
  } else {
    console.error('❌ NOTIFS_DB no disponible');
    alert('❌ Módulo de notificaciones no disponible');
  }
};
