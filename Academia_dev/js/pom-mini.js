// ═══════════════════════════════════════════════════════════════
// POM-MINI.JS — Mini Pomodoro Flotante
// Widget de esquina que aparece automáticamente cuando el timer
// corre y el usuario cambia de página o pestaña.
// No usa window.open() — nunca es bloqueado por el navegador.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Estilos ─────────────────────────────────────────────────
  const CSS = `
    #_pmf {
      position: fixed;
      bottom: 80px; right: 16px;
      z-index: 9998;
      background: var(--surface, #16161f);
      border: 1.5px solid var(--accent, #7c6aff);
      border-radius: 18px;
      padding: 13px 16px 11px;
      box-shadow: 0 8px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(124,106,255,.12);
      min-width: 168px;
      max-width: 210px;
      cursor: grab;
      user-select: none;
      touch-action: none;
      animation: _pmfIn .22s cubic-bezier(.4,0,.2,1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    @keyframes _pmfIn  { from{opacity:0;transform:translateY(14px) scale(.94)} to{opacity:1;transform:none} }
    @keyframes _pmfOut { to  {opacity:0;transform:translateY(8px) scale(.94)} }
    #_pmf._pmfHiding { animation: _pmfOut .18s cubic-bezier(.4,0,.2,1) forwards; }

    #_pmf ._pmMode {
      font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
      font-family: 'Space Mono', monospace;
      color: var(--accent2, #a89cff); margin-bottom: 3px;
    }
    #_pmf ._pmTime {
      font-size: 34px; font-weight: 800;
      font-family: 'Space Mono', monospace;
      letter-spacing: 1px; line-height: 1;
      color: var(--text, #e8e8f0);
    }
    #_pmf ._pmSubj {
      font-size: 10px; color: var(--text3, #5a5a72);
      margin-top: 3px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }
    /* Barra de progreso */
    #_pmf ._pmBar {
      width: 100%; height: 3px;
      background: var(--border, #2a2a38);
      border-radius: 2px; margin-top: 9px; overflow: hidden;
    }
    #_pmf ._pmBarFill {
      height: 100%; border-radius: 2px;
      background: var(--accent, #7c6aff);
      transition: width .8s linear;
    }
    /* Botones */
    #_pmf ._pmRow {
      display: flex; gap: 6px; margin-top: 10px;
    }
    #_pmf ._pmBtn {
      flex: 1; padding: 6px 0; border-radius: 9px;
      border: 1px solid var(--border, #2a2a38);
      background: var(--surface2, #1e1e2a);
      color: var(--text, #e8e8f0); font-size: 12px;
      font-weight: 700; cursor: pointer;
      transition: background .12s, border-color .12s;
      font-family: inherit;
    }
    #_pmf ._pmBtn:hover { border-color: var(--accent, #7c6aff); }
    #_pmf ._pmBtnPrim {
      background: var(--accent, #7c6aff);
      border-color: var(--accent, #7c6aff);
      color: #fff;
    }
    #_pmf ._pmBtnPrim:hover { background: #6a58e8; }
    #_pmf ._pmLink {
      font-size: 9px; color: var(--accent2, #a89cff);
      font-family: 'Space Mono', monospace;
      text-align: center; margin-top: 7px;
      cursor: pointer;
      opacity: .7;
      transition: opacity .12s;
    }
    #_pmf ._pmLink:hover { opacity: 1; }
    /* Móvil: sube más para no tapar la nav */
    @media (max-width: 768px) {
      #_pmf { bottom: 76px; right: 10px; min-width: 152px; }
    }
  `;

  function _injectCSS() {
    if (document.getElementById('_pmfStyle')) return;
    const s = document.createElement('style');
    s.id = '_pmfStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── Helpers para leer el estado del Pomodoro ─────────────────
  // Estas variables se definen en pomodoro.js (ya cargado antes)
  function _pomIsRunning()  { return typeof pomR !== 'undefined' && pomR; }
  function _pomIsBreak()    { return typeof pomB !== 'undefined' && pomB; }
  function _pomEndTimestamp(){ return typeof _pomEndTime !== 'undefined' ? _pomEndTime : 0; }
  function _pomTotalSecs()  { return typeof pomTS !== 'undefined' && pomTS > 0 ? pomTS : 1500; }
  function _pomSubjectName() {
    try {
      const sel = document.getElementById('pom-subject');
      if (!sel) return '—';
      if (typeof getMat === 'function') return getMat(sel.value)?.name || '—';
      return sel.options[sel.selectedIndex]?.text || '—';
    } catch(e) { return '—'; }
  }
  function _pomOnPomodorPage() {
    const p = document.getElementById('page-pomodoro');
    return p && p.classList.contains('active');
  }

  // ── Loop de actualización ─────────────────────────────────────
  let _rafId = null;

  function _startLoop() {
    _stopLoop();
    function tick() {
      _update();
      if (document.getElementById('_pmf')) {
        _rafId = setTimeout(tick, 400);
      }
    }
    tick();
  }
  function _stopLoop() {
    if (_rafId) { clearTimeout(_rafId); _rafId = null; }
  }

  function _update() {
    const el = document.getElementById('_pmf');
    if (!el) return;

    const running   = _pomIsRunning();
    const endTime   = _pomEndTimestamp();
    const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    const total     = _pomTotalSecs();
    const isBreak   = _pomIsBreak();

    // Tiempo
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timeEl = el.querySelector('._pmTime');
    if (timeEl) timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    // Modo + color
    const modeEl = el.querySelector('._pmMode');
    if (modeEl) {
      modeEl.textContent = isBreak ? 'DESCANSO' : 'ENFOQUE';
      modeEl.style.color = isBreak ? '#4ade80' : 'var(--accent2, #a89cff)';
    }

    // Barra
    const fillEl = el.querySelector('._pmBarFill');
    if (fillEl) {
      const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
      fillEl.style.width = pct + '%';
      fillEl.style.background = isBreak ? '#4ade80' : 'var(--accent, #7c6aff)';
    }

    // Botón toggle
    const btnEl = el.querySelector('#_pmBtnToggle');
    if (btnEl) btnEl.textContent = running ? '⏸' : '▶';

    // Materia
    const subjEl = el.querySelector('._pmSubj');
    if (subjEl) subjEl.textContent = _pomSubjectName();

    // Si el timer terminó → ocultar
    if (!running && remaining <= 0) {
      window._pomHideMiniFloat();
    }
  }

  // ── Show / Hide ───────────────────────────────────────────────
  window._pomShowMiniFloat = function () {
    if (_pomOnPomodorPage()) return;           // ya estamos en Pomodoro
    if (!_pomIsRunning()) return;              // timer no corre
    if (document.getElementById('_pmf')) {    // ya existe → solo actualizar
      _update();
      return;
    }

    _injectCSS();

    const el = document.createElement('div');
    el.id = '_pmf';
    el.innerHTML = `
      <div class="_pmMode">ENFOQUE</div>
      <div class="_pmTime">--:--</div>
      <div class="_pmSubj">—</div>
      <div class="_pmBar"><div class="_pmBarFill" style="width:100%"></div></div>
      <div class="_pmRow">
        <button class="_pmBtn _pmBtnPrim" id="_pmBtnToggle" title="Pausar / Reanudar">⏸</button>
        <button class="_pmBtn" onclick="window._pomMiniGoTo()" title="Ir al Pomodoro">↗ Ir</button>
      </div>
      <div class="_pmLink" onclick="window._pomMiniGoTo()">volver al pomodoro</div>
    `;

    // Botón toggle controla el timer directamente
    el.querySelector('#_pmBtnToggle').addEventListener('click', () => {
      if (typeof pomToggle === 'function') pomToggle();
    });

    document.body.appendChild(el);
    _pomMakeDraggable(el);
    _startLoop();
  };

  window._pomHideMiniFloat = function () {
    const el = document.getElementById('_pmf');
    if (!el) return;
    el.classList.add('_pmfHiding');
    setTimeout(() => { el.remove(); }, 200);
    _stopLoop();
  };

  window._pomMiniGoTo = function () {
    const navEl =
      document.querySelector('.nav-item[onclick*="pomodoro"]') ||
      document.querySelector('[onclick*="pomodoro"]');
    if (typeof goPage === 'function') goPage('pomodoro', navEl);
  };

  // ── Draggable ─────────────────────────────────────────────────
  function _pomMakeDraggable(el) {
    let startX, startY, origLeft, origTop;

    function getXY(e) {
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }

    function onStart(e) {
      if (e.target.tagName === 'BUTTON') return; // no arrastrar si clic en botón
      e.preventDefault();
      const pt = getXY(e);
      // Convertir right/bottom a left/top para poder desplazar
      const rect = el.getBoundingClientRect();
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
      el.style.left   = rect.left + 'px';
      el.style.top    = rect.top  + 'px';
      origLeft = rect.left;
      origTop  = rect.top;
      startX   = pt.x;
      startY   = pt.y;
      el.style.cursor = 'grabbing';
      document.addEventListener('mousemove',  onMove);
      document.addEventListener('touchmove',  onMove, { passive: false });
      document.addEventListener('mouseup',    onEnd);
      document.addEventListener('touchend',   onEnd);
    }

    function onMove(e) {
      e.preventDefault();
      const pt  = getXY(e);
      const dx  = pt.x - startX;
      const dy  = pt.y - startY;
      const maxL = window.innerWidth  - el.offsetWidth;
      const maxT = window.innerHeight - el.offsetHeight;
      el.style.left = Math.max(0, Math.min(maxL, origLeft + dx)) + 'px';
      el.style.top  = Math.max(0, Math.min(maxT, origTop  + dy)) + 'px';
    }

    function onEnd() {
      el.style.cursor = 'grab';
      document.removeEventListener('mousemove',  onMove);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('mouseup',    onEnd);
      document.removeEventListener('touchend',   onEnd);
    }

    el.addEventListener('mousedown',  onStart);
    el.addEventListener('touchstart', onStart, { passive: false });
  }

  // ── Hook en goPage (se parchea cuando esté disponible) ───────
  function _hookGoPage() {
    if (typeof goPage !== 'function') return false;
    if (goPage._pmfHooked) return true;

    const _orig = goPage;
    window.goPage = function (id, el) {
      _orig.call(this, id, el);
      if (id === 'pomodoro') {
        window._pomHideMiniFloat();
      } else if (_pomIsRunning()) {
        // Pequeño delay para que el render de la página termine
        setTimeout(window._pomShowMiniFloat, 80);
      }
    };
    window.goPage._pmfHooked = true;
    return true;
  }

  // ── Hook en _pomOnSegmentDone ─────────────────────────────────
  function _hookSegmentDone() {
    if (typeof _pomOnSegmentDone !== 'function') return false;
    if (_pomOnSegmentDone._pmfHooked) return true;
    const _orig = _pomOnSegmentDone;
    window._pomOnSegmentDone = function () {
      _orig.apply(this, arguments);
      window._pomHideMiniFloat();
    };
    window._pomOnSegmentDone._pmfHooked = true;
    return true;
  }

  // ── Intentar hooks (pueden no estar disponibles aún) ─────────
  function _tryHooks() {
    const gpOk  = _hookGoPage();
    const sдOk  = _hookSegmentDone();
    if (!gpOk || !sдOk) {
      // Reintentar hasta que estén cargados
      setTimeout(_tryHooks, 300);
    }
  }

  // ── Visibilitychange: mostrar mini al volver al tab ──────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (_pomIsRunning() && !_pomOnPomodorPage()) {
      setTimeout(window._pomShowMiniFloat, 100);
    }
  });

  // ── Init ──────────────────────────────────────────────────────
  function _init() {
    _injectCSS();
    _tryHooks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    // DOM ya listo — esperar a que los otros scripts terminen
    setTimeout(_init, 500);
  }

})();
