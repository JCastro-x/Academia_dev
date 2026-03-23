
document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════
// MOBILE SIDEBAR — hamburger toggle
// ═══════════════════════════════════════════════════════
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
// Close sidebar when a nav item is clicked on mobile
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
