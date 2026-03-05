/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MOBILE IMPROVEMENTS PARA ACADEMIA DEV
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Este archivo contiene mejoras JavaScript para mobile:
 * 1. Sidebar drawer behavior (cerrar al navegar)
 * 2. Mobile keyboard handling (visualViewport)
 * 3. Bottom navigation setup
 * 4. Touch event improvements
 * 
 * Agregar estas funciones a app.js DESPUÉS de initApp()
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ════════════════════════════════════════════════════════════════
// 1. SIDEBAR DRAWER BEHAVIOR (Mobile)
// ════════════════════════════════════════════════════════════════

/**
 * Inicializar el drawer del sidebar en mobile
 * Llamar en initApp() o en el load del DOM
 */
function initSidebarDrawer() {
  const isMobile = window.innerWidth < 768;
  if (!isMobile) return;

  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay') || createSidebarOverlay();
  const navItems = document.querySelectorAll('.nav-item');

  // Toggle sidebar al hacer click en hamburguesa
  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebarDrawer();
    });
  }

  // Cerrar al hacer click en overlay
  overlay.addEventListener('click', closeSidebarDrawer);

  // Cerrar al navegar (click en nav item)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Pequeño delay para que la navegación se complete
      setTimeout(closeSidebarDrawer, 100);
    });
  });

  // Cerrar al hacer resize (si pasa de mobile a desktop)
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      closeSidebarDrawer();
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    }
  });

  // Cerrar al presionar ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebarDrawer();
    }
  });
}

/**
 * Crear el overlay del sidebar si no existe
 */
function createSidebarOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Toggle sidebar drawer abierto/cerrado
 */
function toggleSidebarDrawer() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  const isOpen = sidebar?.classList.contains('open');
  
  if (isOpen) {
    closeSidebarDrawer();
  } else {
    openSidebarDrawer();
  }
}

/**
 * Abrir sidebar drawer
 */
function openSidebarDrawer() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar) {
    sidebar.classList.add('open');
  }
  if (overlay) {
    overlay.classList.add('visible');
  }
  
  // Prevenir scroll del body
  document.body.style.overflow = 'hidden';
}

/**
 * Cerrar sidebar drawer
 */
function closeSidebarDrawer() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (overlay) {
    overlay.classList.remove('visible');
  }
  
  // Restaurar scroll
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════════════════════
// 2. MOBILE KEYBOARD HANDLING (Visual Viewport)
// ════════════════════════════════════════════════════════════════

/**
 * Manejar keyboard en mobile (prevenir que oculte inputs)
 * Usar visualViewport para detectar cuando el teclado se abre
 */
function initMobileKeyboardHandling() {
  // Solo en navegadores que soportan visualViewport
  if (!window.visualViewport) return;

  let keyboardVisible = false;
  const tolerance = 0.1; // 10% de diferencia

  window.visualViewport.addEventListener('resize', () => {
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const ratio = viewportHeight / windowHeight;

    const isKeyboardOpen = ratio < (1 - tolerance);

    if (isKeyboardOpen && !keyboardVisible) {
      // Keyboard abierto
      keyboardVisible = true;
      onKeyboardOpen();
    } else if (!isKeyboardOpen && keyboardVisible) {
      // Keyboard cerrado
      keyboardVisible = false;
      onKeyboardClose();
    }
  });
}

/**
 * Callback cuando teclado se abre
 */
function onKeyboardOpen() {
  document.body.classList.add('keyboard-open');
  
  // Scroll al input activo si existe
  const activeInput = document.activeElement;
  if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      activeInput.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 200);
  }
  
  // Cerrar sidebar si estaba abierto
  const sidebar = document.getElementById('sidebar');
  if (sidebar?.classList.contains('open')) {
    closeSidebarDrawer();
  }
}

/**
 * Callback cuando teclado se cierra
 */
function onKeyboardClose() {
  document.body.classList.remove('keyboard-open');
}

// ════════════════════════════════════════════════════════════════
// 3. BOTTOM NAVIGATION (Mobile)
// ════════════════════════════════════════════════════════════════

/**
 * Crear bottom navigation en mobile
 * Llamar en initApp() si window.innerWidth < 768
 */
function initBottomNavigation() {
  const isMobile = window.innerWidth < 768;
  if (!isMobile) return;

  // Crear el HTML de bottom nav
  const bottomNav = document.createElement('nav');
  bottomNav.id = 'bottom-nav';
  bottomNav.className = 'bottom-nav';
  
  const pages = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'tasks', icon: '✅', label: 'Tasks' },
    { id: 'chrono', icon: '⏱️', label: 'Pomodoro' },
    { id: 'notes', icon: '📝', label: 'Notes' }
  ];

  bottomNav.innerHTML = pages.map(page => `
    <button class="bottom-nav-item" data-page="${page.id}" title="${page.label}">
      <span class="icon">${page.icon}</span>
      <span class="label">${page.label}</span>
    </button>
  `).join('');

  // Agregar al final del body
  document.body.appendChild(bottomNav);

  // Event listeners
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.dataset.page;
      
      // Actualizar active state
      document.querySelectorAll('.bottom-nav-item').forEach(i => {
        i.classList.remove('active');
      });
      item.classList.add('active');
      
      // Navegar a página
      goToPage(pageId);
      closeSidebarDrawer();
    });
  });

  // Actualizar active cuando se cambia de página manualmente
  window.updateBottomNav = function(pageId) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === pageId) {
        item.classList.add('active');
      }
    });
  };
}

// ════════════════════════════════════════════════════════════════
// 4. VIEWPORT META TAGS (Si no existen)
// ════════════════════════════════════════════════════════════════

/**
 * Asegurar que existen los meta tags de viewport modernos
 * Llamar al inicio de initApp()
 */
function ensureViewportMetaTags() {
  const head = document.head;
  
  // Buscar si ya existe viewport
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes';
    head.appendChild(viewportMeta);
  }
  
  // Meta tags adicionales
  const metaTags = [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Academia' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'theme-color', content: '#7c6aff' }
  ];
  
  metaTags.forEach(tag => {
    if (!document.querySelector(`meta[name="${tag.name}"]`)) {
      const meta = document.createElement('meta');
      meta.name = tag.name;
      meta.content = tag.content;
      head.appendChild(meta);
    }
  });
}

// ════════════════════════════════════════════════════════════════
// 5. DETECCIÓN DE PLATAFORMA
// ════════════════════════════════════════════════════════════════

/**
 * Detectar si es mobile, tablet, desktop
 */
function getDeviceType() {
  const width = window.innerWidth;
  
  if (width < 480) return 'mobile-small';
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1400) return 'desktop';
  return 'desktop-large';
}

/**
 * Verificar si es mobile
 */
function isMobileDevice() {
  return window.innerWidth < 768;
}

/**
 * Verificar si es tablet
 */
function isTabletDevice() {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

/**
 * Verificar si es desktop
 */
function isDesktopDevice() {
  return window.innerWidth >= 1024;
}

// ════════════════════════════════════════════════════════════════
// 6. TOUCH IMPROVEMENTS
// ════════════════════════════════════════════════════════════════

/**
 * Mejorar feedback táctil
 */
function initTouchFeedback() {
  // Agregar clase 'active' durante touch
  document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'A' || 
        e.target.classList.contains('clickable')) {
      e.target.classList.add('touch-active');
    }
  }, false);

  document.addEventListener('touchend', function(e) {
    if (e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'A' || 
        e.target.classList.contains('clickable')) {
      e.target.classList.remove('touch-active');
    }
  }, false);
}

// ════════════════════════════════════════════════════════════════
// 7. SCROLL SMOOTH
// ════════════════════════════════════════════════════════════════

/**
 * Mejorar scroll en iOS
 */
function enableSmoothScroll() {
  const scrollableElements = document.querySelectorAll(
    '.content, .modal-box, .table-wrap, .notes-pro-sidebar'
  );

  scrollableElements.forEach(el => {
    el.style.webkitOverflowScrolling = 'touch';
  });
}

// ════════════════════════════════════════════════════════════════
// 8. ORIENTACIÓN CHANGE
// ════════════════════════════════════════════════════════════════

/**
 * Manejar cambios de orientación
 */
function initOrientationHandler() {
  window.addEventListener('orientationchange', () => {
    // Pequeño delay para que complete la rotación
    setTimeout(() => {
      // Cerrar modales y drawers
      closeSidebarDrawer();
      document.querySelectorAll('.modal.open').forEach(modal => {
        modal.classList.remove('open');
      });
      
      // Re-ajustar layout si es necesario
      if (window.innerWidth >= 768) {
        closeSidebarDrawer();
      }
      
      // Trigger resize si es necesario
      window.dispatchEvent(new Event('resize'));
    }, 200);
  });
}

// ════════════════════════════════════════════════════════════════
// 9. INICIALIZAR TODO EN initApp()
// ════════════════════════════════════════════════════════════════

/**
 * Llamar esta función desde initApp() para activar todas las mejoras mobile
 */
function initMobileImprovements() {
  // Meta tags
  ensureViewportMetaTags();
  
  // Keyboard handling
  initMobileKeyboardHandling();
  
  // Sidebar drawer
  initSidebarDrawer();
  
  // Touch feedback
  initTouchFeedback();
  
  // Smooth scroll iOS
  enableSmoothScroll();
  
  // Orientación
  initOrientationHandler();
  
  // Bottom nav (solo en mobile)
  if (isMobileDevice()) {
    initBottomNavigation();
  }
  
  // Log para debug
  console.log('✅ Mobile improvements initialized', {
    deviceType: getDeviceType(),
    width: window.innerWidth,
    height: window.innerHeight
  });
}

// ════════════════════════════════════════════════════════════════
// 10. HELPER: Closable modals en mobile
// ════════════════════════════════════════════════════════════════

/**
 * Mejorar closeModal() para mobile
 * Reemplazar la función existente closeModal() en app.js con:
 */
function closeModalEnhanced(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    
    // En mobile, tambien cerrar sidebar
    if (isMobileDevice()) {
      closeSidebarDrawer();
    }
  }
}

// ════════════════════════════════════════════════════════════════
// NOTAS DE IMPLEMENTACIÓN:
// ════════════════════════════════════════════════════════════════
/*
  1. Agregar initMobileImprovements() en initApp() DESPUÉS de todas
     las inicializaciones principales. Ejemplo:
     
     function initApp() {
       loadState();
       initCalendar();
       renderOverview();
       // ... otros inits ...
       initMobileImprovements();  // <-- AQUÍ
     }

  2. Asegurar que el HTML tenga estos elementos:
     - <div id="sidebar-overlay"></div>  (agregar si no existe)
     - <button id="hamburger">...</button> (ya debe existir)
     - <div id="sidebar">...</div> (ya existe)

  3. Probar en:
     - Chrome DevTools (Toggle Device Toolbar: Cmd+Shift+M)
     - iPhone real si es posible
     - Android real si es posible

  4. Si algo no funciona:
     - Verificar console.log() para debug
     - Revisar que no hay conflictos con otras funciones
     - Usar updateBottomNav(pageId) cuando cambies de página

  ════════════════════════════════════════════════════════════════
*/
