// ═══════════════════════════════════════════════════════════════
// MOBILE MORE — Bottom sheet con acceso a todas las secciones
// ═══════════════════════════════════════════════════════════════

// Todas las páginas disponibles en el sheet
const _MOBILE_MORE_ITEMS = [
  // ── Gestión ──────────────────────────────────────────────────
  { icon: '📅', label: 'Agenda',      page: 'calendario'    },
  { icon: '🗓️', label: 'Horario',     page: 'horario'       },
  { icon: '📚', label: 'Materias',    page: 'materias'      },
  // ── Herramientas ─────────────────────────────────────────────
  { icon: '⏱️', label: 'Pomodoro',    page: 'pomodoro'      },
  { icon: '📝', label: 'Notas',       page: 'notas'         },
  // ── General ──────────────────────────────────────────────────
  { icon: '🎯', label: 'Calific.',    page: 'calificaciones'},
  { icon: '🃏', label: 'Flashcards',  page: 'flashcards'    },
  { icon: '📖', label: 'Temas',       page: 'temas'         },
  { icon: '📊', label: 'Estadíst.',   page: 'estadisticas'  },
  { icon: '🧰', label: 'General',     page: 'general'       },
  // ── Config ───────────────────────────────────────────────────
  { icon: '🗂️', label: 'Semestres',   page: 'semestres'     },
  { icon: '👤', label: 'Perfil',      page: 'perfil'        },
];

let _moreSheetOpen = false;

function openMobileMore(triggerEl) {
  if (_moreSheetOpen) { closeMobileMore(); return; }
  _moreSheetOpen = true;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'mobile-more-backdrop';
  backdrop.className = 'mobile-more-backdrop';
  backdrop.onclick = closeMobileMore;
  document.body.appendChild(backdrop);

  // Sheet
  const sheet = document.createElement('div');
  sheet.id = 'mobile-more-sheet';
  sheet.className = 'mobile-more-sheet';

  // Drag handle
  sheet.innerHTML = `
    <div style="width:36px;height:4px;border-radius:2px;background:var(--border2);margin:0 auto 14px;"></div>
    <div class="mobile-more-title">Más secciones</div>
    <div class="mobile-more-grid">
      ${_MOBILE_MORE_ITEMS.map(item => `
        <div class="mobile-more-item" onclick="closeMobileMore();_moreNav('${item.page}')">
          <div class="mmi-icon">${item.icon}</div>
          <div>${item.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(sheet);

  // Swipe-down to close
  _initSheetSwipe(sheet);
}

function closeMobileMore() {
  _moreSheetOpen = false;
  const sheet   = document.getElementById('mobile-more-sheet');
  const backdrop = document.getElementById('mobile-more-backdrop');

  if (sheet) {
    sheet.style.animation = 'sheetSlideDown .2s cubic-bezier(.4,0,.2,1) forwards';
    setTimeout(() => sheet.remove(), 200);
  }
  if (backdrop) {
    backdrop.style.opacity = '0';
    backdrop.style.transition = 'opacity .2s';
    setTimeout(() => backdrop.remove(), 200);
  }
}

// Navega a la página y actualiza el nav activo
function _moreNav(page) {
  // Quitar activo del nav bottom para que no quede resaltado
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

  const navSel = document.querySelector(`.nav-item[onclick*="${page}"]`);
  goPage(page, navSel);
}

// Swipe hacia abajo para cerrar
function _initSheetSwipe(el) {
  let startY = 0;
  el.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy > 60) closeMobileMore();
  }, { passive: true });
}

// Inyectar animación de cierre si no existe
(function _addCloseAnim() {
  if (document.getElementById('_more-sheet-style')) return;
  const s = document.createElement('style');
  s.id = '_more-sheet-style';
  s.textContent = `
    @keyframes sheetSlideDown {
      from { transform: translateY(0);    opacity: 1; }
      to   { transform: translateY(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(s);
})();
