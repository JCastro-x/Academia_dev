
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
  if (ov.length) banners.push({ c:'#f87171', bg:'rgba(248,113,113,.12)', b:'rgba(248,113,113,.4)', icon:'⚠️',
    msg:`${ov.length} vencida${ov.length>1?'s':''}: ${ov.map(t=>t.title).join(', ')}`, k:'overdue' });
  if (dt.length) banners.push({ c:'#f87171', bg:'rgba(248,113,113,.10)', b:'rgba(248,113,113,.3)', icon:'🔴',
    msg:`Entrega hoy: ${dt.map(t=>t.dueTime?`${t.title} (${t.dueTime})`:t.title).join(', ')}`, k:'due-today' });
  if (pt.length) banners.push({ c:'#9d97ff', bg:'rgba(108,99,255,.10)', b:'rgba(108,99,255,.35)', icon:'📋',
    msg:`Planificaste para hoy: ${pt.map(t=>t.timePlanned?`${t.title} (${t.timePlanned})`:t.title).join(', ')}`, k:'planned' });
  if (!banners.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = banners.map(b =>
    `<div id="rb-${b.k}" style="pointer-events:all;background:${b.bg};border-bottom:2px solid ${b.b};color:${b.c};padding:7px 16px;font-size:12px;font-family:'Space Mono',monospace;display:flex;align-items:center;gap:8px;">
      <span>${b.icon}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.msg}</span>
      <button onclick="document.getElementById('rb-${b.k}').remove()" style="background:none;border:none;color:${b.c};cursor:pointer;font-size:14px;opacity:.7;padding:0 4px;flex-shrink:0;">✕</button>
    </div>`
  ).join('');
}
