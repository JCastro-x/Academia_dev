
// ══ RECORDATORIOS ═══════════════════════════════════════════
async function initNotifications() {
  if (!document.getElementById('reminder-banners')) {
    const w = document.createElement('div');
    w.id = 'reminder-banners';
    w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1200;display:flex;flex-direction:column;pointer-events:none;';
    document.body.appendChild(w);
  }
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(async () => {
      const p = await Notification.requestPermission();
      if (p === 'granted') scheduleTaskReminders();
    }, 3000);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    scheduleTaskReminders();
  }
  renderReminderBanners();
}

function scheduleTaskReminders() {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().split('T')[0];
  const tom   = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const now   = new Date();
  const tasks = State.tasks.filter(t => !t.done);

  const note = (title, body, tag, rn = true) =>
    navigator.serviceWorker.ready.then(r => r.showNotification(title, {
      body, icon: '/assets/icons/icon-192.png', badge: '/assets/icons/icon-32.png',
      tag, renotify: rn, data: { url: '/index.html' },
      actions: [{ action: 'open', title: 'Ver tareas' }]
    })).catch(() => {});

  const pt = tasks.filter(t => t.datePlanned === today && !t.timePlanned);
  const dt = tasks.filter(t => t.due === today && !t.dueTime);
  const ov = tasks.filter(t => t.due && t.due < today);
  const tm = tasks.filter(t => t.due === tom);

  if (pt.length) note('📋 Hoy toca trabajar', `Planificaste: ${pt.map(t=>t.title).join(', ')}`, 'reminder-planned');
  if (dt.length) note('🔴 Entrega hoy', dt.map(t=>t.title).join(', '), 'reminder-due-today');
  if (ov.length) note('⚠️ Tareas vencidas', ov.map(t=>t.title).join(', '), 'reminder-overdue', false);
  if (tm.length) note('📅 Entrega mañana', tm.map(t=>t.title).join(', '), 'reminder-due-tomorrow', false);

  // Recordatorios con hora exacta — planificación
  tasks.filter(t => t.datePlanned === today && t.timePlanned).forEach(t => {
    const [h, m] = t.timePlanned.split(':').map(Number);
    const fire = new Date(); fire.setHours(h, m, 0, 0);
    const dl = fire - now;
    if (dl > 0 && dl < 86400000) {
      const mat = getMat(t.matId);
      setTimeout(() => note(`📋 ${mat.icon||'📚'} ${t.title}`, `${mat.name||'Hora de trabajar'} · ${t.timePlanned}`, `rem-plan-${t.id}`), dl);
    }
  });

  // Recordatorios con hora exacta — entrega
  tasks.filter(t => t.due === today && t.dueTime).forEach(t => {
    const [h, m] = t.dueTime.split(':').map(Number);
    const fire = new Date(); fire.setHours(h, m, 0, 0);
    const dl = fire - now;
    if (dl > 0 && dl < 86400000) {
      const mat = getMat(t.matId);
      setTimeout(() => note(`🔴 ${mat.icon||'📚'} ${t.title}`, `${mat.name||'Vence ahora'} · ${t.dueTime}`, `rem-due-${t.id}`), dl);
    }
  });
}

function renderReminderBanners() {
  const wrap = document.getElementById('reminder-banners');
  if (!wrap) return;

  const today = new Date().toISOString().split('T')[0];
  const active = (typeof State !== 'undefined' ? State.tasks : []).filter(t => !t.done);
  
  const ov = active.filter(t => t.due && t.due < today);
  const dt = active.filter(t => t.due === today);
  const pt = active.filter(t => t.datePlanned === today);

  const banners = [];

  // 🔴 Vencidas: Rojo más sólido
  if (ov.length) banners.push({ 
    c: '#ff8a8a', 
    bg: 'rgba(40, 20, 20, 0.95)', 
    b: '#f87171', 
    icon: '⚠️',
    msg: `${ov.length} vencida${ov.length > 1 ? 's' : ''}: ${ov.map(t => t.title).join(', ')}`, 
    k: 'overdue' 
  });

  // 🟠 Entrega hoy: Naranja/Rojo vibrante
  if (dt.length) banners.push({ 
    c: '#ff8a8a', 
    bg: 'rgba(40, 20, 20, 0.95)', 
    b: 'rgba(248, 113, 113, 0.8)', 
    icon: '🔴',
    msg: `Entrega hoy: ${dt.map(t => t.dueTime ? `${t.title} (${t.dueTime})` : t.title).join(', ')}`, 
    k: 'due-today' 
  });

  // 🟣 Planificadas: Morado sólido
  if (pt.length) banners.push({ 
    c: '#c7c4ff', 
    bg: 'rgba(25, 25, 45, 0.98)', 
    b: '#7c6aff', 
    icon: '📋',
    msg: `Planificaste para hoy: ${pt.map(t => t.timePlanned ? `${t.title} (${t.timePlanned})` : t.title).join(', ')}`, 
    k: 'planned' 
  });

  if (!banners.length) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = banners.map(b => `
    <div id="rb-${b.k}" style="
      pointer-events: all;
      background: ${b.bg};
      border: 1px solid ${b.b};
      border-left: 4px solid ${b.b};
      color: ${b.c};
      padding: 10px 16px;
      margin: 6px 12px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Syne', sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      backdrop-filter: blur(8px);
    ">
      <span style="font-size: 16px;">${b.icon}</span>
      <span style="flex: 1; line-height: 1.4;">${b.msg}</span>
      <button onclick="this.parentElement.remove()" style="
        background: rgba(255,255,255,0.1);
        border: none;
        color: ${b.c};
        cursor: pointer;
        font-size: 16px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.2)'" 
         onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
    </div>
  `).join('');
}
