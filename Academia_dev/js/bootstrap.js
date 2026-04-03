
document.addEventListener('DOMContentLoaded', () => {
  init();
  _injectGuestBanner();
});

// ═══════════════════════════════════════════════════════════════
// BANNER MODO INVITADO
// ═══════════════════════════════════════════════════════════════
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

// Redirige al login para que se registre — los datos en localStorage se migran automáticamente
function handleGuestRegister() {
  // NO limpiamos el localStorage — init.js lo migra a Supabase al autenticarse
  // Solo quitamos el flag de invitado para que el auth-page no redirija de vuelta
  localStorage.removeItem('academia_guest_mode');
  window.location.href = 'auth-page.html';
}

// ═══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR — hamburger toggle
// ═══════════════════════════════════════════════════════════════
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  const isOpen  = sidebar.classList.toggle('mobile-open');
  overlay.style.display = isOpen ? 'block' : 'none';
  btn && btn.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  sidebar.classList.remove('mobile-open');
  overlay.style.display = 'none';
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
    if (!confirm('¿Salir del modo invitado? Tus datos guardados en este dispositivo se eliminarán.')) return;
    localStorage.clear();
    window.location.href = 'auth-page.html';
    return;
  }

  if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) return;

  const result = await window.Auth.logoutUser();
  if (result.success) {
    console.log('✅ Sesión cerrada');
    localStorage.clear();
    window.location.href = 'auth-page.html';
  } else {
    alert('Error al cerrar sesión: ' + result.error);
  }
}
