
document.addEventListener('DOMContentLoaded', () => {
  init();
  _injectGuestBanner();
  _injectOfflineBanner();
});

// Banner modo invitado
function _injectGuestBanner() {
  if (localStorage.getItem('academia_guest_mode') !== '1') return;

  const banner = document.createElement('div');
  banner.id = 'guest-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 1100;
    background: rgba(10,10,15,.96);
    border-top: 1px solid rgba(251,191,36,.35);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    backdrop-filter: blur(8px);
  `;
  banner.innerHTML = `
    <span style="font-size:15px;">👀</span>
    <span style="font-size:12px;color:#fbbf24;font-weight:600;flex:1;min-width:200px;">
      Modo invitado — tus datos se guardan solo en este dispositivo, sin sincronización.
    </span>
    <button onclick="handleGuestRegister()" style="
      padding:7px 16px;background:linear-gradient(135deg,#a78bfa,#7c6aff);
      color:#fff;border:none;border-radius:7px;font-family:'Syne',sans-serif;
      font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;
      transition:opacity .15s;
    " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      🔐 Crear cuenta y guardar datos
    </button>
    <button onclick="document.getElementById('guest-banner').style.display='none'" style="
      padding:7px 10px;background:transparent;color:#9090a8;
      border:1px solid #2a2a38;border-radius:7px;font-size:12px;
      cursor:pointer;font-family:'Syne',sans-serif;white-space:nowrap;
    ">
      Cerrar
    </button>
  `;

  // En mobile sube el nav bottom para que no tape el banner
  document.body.appendChild(banner);
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav) mobileNav.style.bottom = '52px';
}

// Redirige al login para que se registre, los datos en localStorage se migran automáticamente
function handleGuestRegister() {
  // NO limpiamos el localStorage, init.js lo migra a Supabase al autenticarse
  // Solo quitamos el flag de invitado para que el auth-page no redirija de vuelta
  localStorage.removeItem('academia_guest_mode');
  window.location.href = 'auth-page.html';
}

// Banner modo offline
function _injectOfflineBanner() {
  if (localStorage.getItem('academia_offline_mode') !== '1') return;

  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 1100;
    background: rgba(10,10,15,.96);
    border-top: 1px solid rgba(248,113,113,.35);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    backdrop-filter: blur(8px);
  `;
  banner.innerHTML = `
    <span style="font-size:15px;">📴</span>
    <span style="font-size:12px;color:#f87171;font-weight:600;flex:1;min-width:200px;">
      Modo offline — usando datos cacheados. Los cambios se sincronizarán cuando tengas conexión.
    </span>
    <button onclick="window.location.reload()" style="
      padding:7px 16px;background:linear-gradient(135deg,#a78bfa,#7c6aff);
      color:#fff;border:none;border-radius:7px;font-family:'Syne',sans-serif;
      font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;
      transition:opacity .15s;
    " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      🔄 Reintentar conexión
    </button>
    <button onclick="document.getElementById('offline-banner').style.display='none'" style="
      padding:7px 10px;background:transparent;color:#9090a8;
      border:1px solid #2a2a38;border-radius:7px;font-size:12px;
      cursor:pointer;font-family:'Syne',sans-serif;white-space:nowrap;
    ">
      Cerrar
    </button>
  `;

  // En mobile sube el nav bottom para que no tape el banner
  document.body.appendChild(banner);
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileNav) mobileNav.style.bottom = '52px';
  
  // Auto-eliminar modo offline cuando se restaura la conexión
  window.addEventListener('online', () => {
    localStorage.removeItem('academia_offline_mode');
    const b = document.getElementById('offline-banner');
    if (b) b.remove();
    if (mobileNav) mobileNav.style.bottom = '';
    window.location.reload();
  });
}

// Sidebar móvil - toggle hamburguesa
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  const isOpen  = sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('visible', isOpen);
  btn && btn.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('visible');
  btn && btn.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeMobileSidebar();
    });
  });
});

// ════════════════════════════════════════════════════════════
// LOGOUT HANDLER
// ════════════════════════════════════════════════════════════
async function handleLogout() {
  const isGuest = localStorage.getItem('academia_guest_mode') === '1';

  if (isGuest) {
    const confirmed = await showConfirm('¿Salir del modo invitado? Tus datos guardados en este dispositivo se eliminarán.', { danger: true });
    if (!confirmed) return;
    if (window.Auth?.clearAcademiaStorage) window.Auth.clearAcademiaStorage();
    window.location.href = 'auth-page.html';
    return;
  }

  const confirmed = await showConfirm('¿Estás seguro de que quieres cerrar sesión?');
  if (!confirmed) return;

  const result = await window.Auth.logoutUser();
  if (result.success) {
    if (window.Auth?.clearAcademiaStorage) window.Auth.clearAcademiaStorage();
    window.location.href = 'auth-page.html';
  } else {
    if (typeof _appNotify === 'function') _appNotify('Error al cerrar sesión: ' + result.error, 'error');
  }
}

// Delegación de eventos del modal de configuración (reemplaza handlers inline)
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]');
  if (!action) return;

  const actionType = action.dataset.action;

  // Cerrar modal
  if (actionType === 'close-modal') {
    const target = action.dataset.target;
    if (target && typeof closeModal === 'function') closeModal(target);
  }

  // Modal de configuración - exportar datos
  if (actionType === 'export-data') {
    if (typeof exportData === 'function') exportData();
  }

  // Modal de configuración - exportar PDF
  if (actionType === 'export-pdf') {
    if (typeof exportPDF === 'function') exportPDF();
  }

  // Modal de configuración - guardar configuración
  if (actionType === 'save-config-modal') {
    if (typeof saveConfigModal === 'function') saveConfigModal();
  }

  // Modal de configuración - manejar logout
  if (actionType === 'handle-logout') {
    if (typeof handleLogout === 'function') handleLogout();
  }
});
