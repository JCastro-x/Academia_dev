
// ═══════════════════════════════════════════════════════
// ONBOARDING — Primera vez
// ═══════════════════════════════════════════════════════
const _ONBOARDING_KEY = 'academia_onboarding_v1';

const _ONBOARDING_STEPS = [
  {
    title: '¡Bienvenido a Academia Dev! 🎓',
    desc: 'Tu dashboard académico personal. Te mostramos las funciones principales en menos de 2 minutos.',
    icon: '🎓',
    target: null, // sin highlight, pantalla completa
    position: 'center',
  },
  {
    title: 'Semestres & Materias 📚',
    desc: 'Primero crea tu semestre y agrega tus materias. Todo lo demás (tareas, notas, calificaciones) se organiza por materia.',
    icon: '📚',
    target: 'nav-materias',
    position: 'right',
  },
  {
    title: 'Tareas & Pendientes ✅',
    desc: 'Agrega tareas con fecha límite, prioridad y subtareas. Puedes hacerlas repetitivas (semanal, mensual) y filtrarlas por materia.',
    icon: '✅',
    target: 'nav-tareas',
    position: 'right',
  },
  {
    title: 'Notas 📝',
    desc: 'Toma apuntes con formato rico, adjunta imágenes y PDFs. Puedes escanear documentos y extraer texto automáticamente.',
    icon: '📝',
    target: 'nav-notas',
    position: 'right',
  },
  {
    title: 'Calificaciones 📊',
    desc: 'Registra tus notas por zona (parciales, laboratorios, final) y calcula tu promedio automáticamente.',
    icon: '📊',
    target: 'nav-calificaciones',
    position: 'right',
  },
  {
    title: 'Pomodoro & Cronómetro ⏱',
    desc: 'Estudia con el método Pomodoro (25 min trabajo / 5 min descanso). El cronómetro mide tu tiempo efectivo de estudio.',
    icon: '⏱',
    target: 'nav-pomodoro',
    position: 'right',
  },
  {
    title: 'Sincronización automática ☁️',
    desc: 'Tus datos se guardan en la nube automáticamente. Puedes acceder desde tu PC, celular o cualquier dispositivo.',
    icon: '☁️',
    target: null,
    position: 'center',
  },
  {
    title: '¡Todo listo! 🚀',
    desc: 'Empieza creando tu primer semestre. Si tienes dudas, el botón ❓ en el menú te trae este tutorial de vuelta.',
    icon: '🚀',
    target: null,
    position: 'center',
    isLast: true,
  },
];

let _onbStep = 0;

function _maybeShowOnboarding() {
  const done = localStorage.getItem(_ONBOARDING_KEY);
  if (done) return;
  // Pequeño delay para que la UI cargue
  setTimeout(() => _showOnboardingStep(0), 800);
}

function _showOnboardingStep(step) {
  _onbStep = step;
  const s = _ONBOARDING_STEPS[step];
  if (!s) { _finishOnboarding(); return; }

  // Crear o reusar overlay
  let overlay = document.getElementById('onboarding-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    document.body.appendChild(overlay);
  }

  const isLast  = step === _ONBOARDING_STEPS.length - 1;
  const isFirst = step === 0;
  const progress = Math.round(((step + 1) / _ONBOARDING_STEPS.length) * 100);

  // Highlight del target
  let targetRect = null;
  if (s.target) {
    const el = document.getElementById(s.target) ||
               document.querySelector(`[data-page="${s.target.replace('nav-','')}"]`);
    if (el) {
      targetRect = el.getBoundingClientRect();
      el.style.position = 'relative';
      el.style.zIndex   = '10001';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 0 0 3px #7c6aff, 0 0 0 6px rgba(124,106,255,0.3)';
      el._onbHighlight = true;
    }
  }

  overlay.innerHTML = `
    <div id="onb-backdrop" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.75);
      backdrop-filter:blur(2px);z-index:10000;
    "></div>
    <div id="onb-card" style="
      position:fixed;z-index:10002;
      background:var(--surface,#111118);
      border:1px solid var(--border,#2a2a38);
      border-radius:16px;
      padding:28px;
      width:min(340px,90vw);
      box-shadow:0 24px 64px rgba(0,0,0,0.6);
      animation: onbSlide 0.3s ease-out;
      ${s.position === 'center' ? 'top:50%;left:50%;transform:translate(-50%,-50%);' : 'top:50%;left:50%;transform:translate(-50%,-50%);'}
    ">
      <!-- Progreso -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="font-size:10px;color:var(--text3,#5a5a72);font-family:'Space Mono',monospace;">
          PASO ${step + 1} DE ${_ONBOARDING_STEPS.length}
        </div>
        <button onclick="_skipOnboarding()" style="
          background:none;border:none;color:var(--text3,#5a5a72);
          cursor:pointer;font-size:11px;padding:2px 6px;border-radius:4px;
        ">Saltar ✕</button>
      </div>

      <!-- Barra de progreso -->
      <div style="height:3px;background:var(--border,#2a2a38);border-radius:2px;margin-bottom:22px;">
        <div style="height:100%;width:${progress}%;background:var(--accent,#7c6aff);border-radius:2px;transition:width 0.3s;"></div>
      </div>

      <!-- Icono -->
      <div style="font-size:40px;text-align:center;margin-bottom:14px;">${s.icon}</div>

      <!-- Título -->
      <div style="font-size:16px;font-weight:800;text-align:center;margin-bottom:10px;color:var(--text,#e8e8f0);">
        ${s.title}
      </div>

      <!-- Descripción -->
      <div style="font-size:13px;color:var(--text2,#9090a8);text-align:center;line-height:1.6;margin-bottom:24px;">
        ${s.desc}
      </div>

      <!-- Botones -->
      <div style="display:flex;gap:10px;">
        ${!isFirst ? `<button onclick="_onbPrev()" style="
          flex:1;padding:10px;background:var(--surface2,#18181f);
          border:1px solid var(--border,#2a2a38);border-radius:8px;
          color:var(--text2,#9090a8);cursor:pointer;font-size:13px;font-weight:600;
        ">← Anterior</button>` : ''}
        <button onclick="${isLast ? '_finishOnboarding()' : '_onbNext()'}" style="
          flex:2;padding:10px;
          background:linear-gradient(135deg,#a78bfa,#7c6aff);
          border:none;border-radius:8px;
          color:white;cursor:pointer;font-size:13px;font-weight:700;
        ">${isLast ? '🚀 ¡Empezar!' : 'Siguiente →'}</button>
      </div>
    </div>

    <style>
      @keyframes onbSlide {
        from { opacity:0; transform:translate(-50%,-45%); }
        to   { opacity:1; transform:translate(-50%,-50%); }
      }
    </style>
  `;
  overlay.style.display = 'block';
}

function _onbNext() {
  _clearOnbHighlights();
  _showOnboardingStep(_onbStep + 1);
}

function _onbPrev() {
  _clearOnbHighlights();
  _showOnboardingStep(_onbStep - 1);
}

function _skipOnboarding() {
  if (confirm('¿Saltar el tutorial? Puedes verlo de nuevo desde el menú ❓')) {
    _finishOnboarding();
  }
}

function _finishOnboarding() {
  _clearOnbHighlights();
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) overlay.remove();
  localStorage.setItem(_ONBOARDING_KEY, '1');
}

function _clearOnbHighlights() {
  document.querySelectorAll('[data-onb-highlight]').forEach(el => {
    el.style.zIndex   = '';
    el.style.boxShadow = '';
  });
  // Limpiar todos los elementos que tengan el highlight
  _ONBOARDING_STEPS.forEach(s => {
    if (!s.target) return;
    const el = document.getElementById(s.target) ||
               document.querySelector(`[data-page="${s.target.replace('nav-','')}"]`);
    if (el && el._onbHighlight) {
      el.style.zIndex    = '';
      el.style.boxShadow = '';
      el._onbHighlight   = false;
    }
  });
}

// Relanzar tutorial desde el menú
function showTutorial() {
  localStorage.removeItem(_ONBOARDING_KEY);
  _showOnboardingStep(0);
}

