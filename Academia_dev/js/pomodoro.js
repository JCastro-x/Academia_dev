// ═══════════════════════════════════════════════════════════════
// POMODORO SYNC — BroadcastChannel en tiempo real con el popup
// Canal: 'academia_pomodoro' (mismo que usa pom-popup.html)
// ═══════════════════════════════════════════════════════════════
const pomChannel = (() => {
  try { return new BroadcastChannel('academia_pomodoro'); } catch(e) { return null; }
})();

/** Llamada desde updatePomDisp() en cada tick — envía estado completo al popup */
function _pomUpdateSync(timeText, isBreak) {
  if (!pomChannel) return;
  try {
    const sel = document.getElementById('pom-subject');
    const subject = sel ? (sel.options[sel.selectedIndex]?.text || '—') : '—';
    pomChannel.postMessage({
      type:      'STATE',
      remaining: (typeof pomSL !== 'undefined') ? pomSL : 0,
      total:     (typeof pomTS !== 'undefined' && pomTS > 0) ? pomTS : 1500,
      isBreak:   !!isBreak,
      running:   (typeof pomR !== 'undefined') ? pomR : false,
      endTime:   (typeof _pomEndTime !== 'undefined') ? _pomEndTime : 0,
      subject
    });
  } catch(e) {}
}

// Escuchar comandos del popup via BroadcastChannel
if (pomChannel) {
  pomChannel.onmessage = (e) => {
    const d = e.data || {};
    if (d.type === 'REQUEST') {
      // Popup abrió y pide estado actual — responder inmediatamente
      if (typeof _pomUpdateSync === 'function') _pomUpdateSync('', typeof pomB !== 'undefined' ? pomB : false);
    } else if (d.type === 'CMD') {
      const a = d.action;
      if      (a === 'TOGGLE') { if (typeof pomToggle === 'function') pomToggle(); }
      else if (a === 'SKIP')   { if (typeof pomSkip   === 'function') pomSkip();   }
      else if (a === 'RESET')  { if (typeof pomReset  === 'function') pomReset();  }
      else if (a === 'FOCUS')  window.focus();
    }
  };
}

// Escuchar comandos del PIP via window.opener.postMessage (para compatibilidad con PIP window)
window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'CMD') {
    const a = d.action;
    if      (a === 'TOGGLE') { if (typeof pomToggle === 'function') pomToggle(); }
    else if (a === 'SKIP')   { if (typeof pomSkip   === 'function') pomSkip();   }
    else if (a === 'RESET')  { if (typeof pomReset  === 'function') pomReset();  }
    else if (a === 'FOCUS')  window.focus();
  }
});

// NOTA: Variables pomR, pomB, pomSL, pomTS, pomD, pomI ahora están definidas
// globalmente en window por js/pomodoro/timer-core.js
// Este archivo solo proporciona la sincronización PiP/BroadcastChannel

let _pomAudioCtx = null;
let _pomAlarmOscillators = [];
function initAudioContext() {
  if (_pomAudioCtx) return _pomAudioCtx;
  try {
    _pomAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_pomAudioCtx.state === 'suspended') _pomAudioCtx.resume();
  } catch(e) { console.warn('AudioContext init failed', e); }
  return _pomAudioCtx;
}

function _pomStopAlarm() {
  try {
    _pomAlarmOscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    _pomAlarmOscillators = [];
  } catch(e) {}
}


document.addEventListener('click', function _unlockAudio() {
  initAudioContext();
  document.removeEventListener('click', _unlockAudio);
}, { once: true, passive: true });

let _pomPipWin = null;

function _pomShowFloatingHint(msg) {
  let el = document.getElementById('pom-floating-hint');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pom-floating-hint';
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:88px',
      'transform:translateX(-50%)',
      'z-index:3200',
      'padding:8px 14px',
      'border-radius:10px',
      'background:rgba(16,16,24,.95)',
      'border:1px solid rgba(124,106,255,.35)',
      'color:#e8e8f0',
      'font-size:12px',
      'font-family:Syne,sans-serif',
      'box-shadow:0 6px 20px rgba(0,0,0,.35)',
      'opacity:0',
      'transition:opacity .18s ease'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(_pomShowFloatingHint._t);
  _pomShowFloatingHint._t = setTimeout(() => { if (el) el.style.opacity = '0'; }, 2800);
}

function _openPomFallbackPopup() {
  const popup = window.open('pom-popup.html', 'academia_pom_popup', 'width=320,height=520');
  if (popup) {
    try { popup.focus(); } catch (e) {}
    _pomShowFloatingHint('Modo flotante abierto en una ventana auxiliar.');
    return true;
  }
  _pomShowFloatingHint('No se pudo abrir la ventana flotante (popup bloqueado).');
  return false;
}

async function enterFloatingMode() {
  if (!('documentPictureInPicture' in window)) {
    _openPomFallbackPopup();
    return;
  }
  try {
    _pomPipWin = await window.documentPictureInPicture.requestWindow({
      width: 320,
      height: 480
    });
    if (!_pomPipWin) {
      _openPomFallbackPopup();
      return;
    }
    _pomPipWin.document.write(`
      <style>
        body { margin:0; padding:20px; background:#0d0d14; color:#e8e8f0; font-family:'Inter',system-ui,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; }
        #pip-root { display:flex; flex-direction:column; align-items:center; gap:16px; }
        #pip-label { font-size:12px; letter-spacing:2px; color:#a89cff; font-family:'Space Mono',monospace; }
        #pip-ring-wrap { position:relative; width:150px; height:150px; }
        #pip-ring-wrap svg { transform:rotate(-90deg); }
        #pip-ring { transition:stroke-dashoffset 0.5s linear; }
        #pip-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        #pip-time { font-size:36px; font-weight:800; font-family:'Space Mono',monospace; letter-spacing:2px; }
        #pip-mode { font-size:11px; color:#a89cff; font-family:'Space Mono',monospace; letter-spacing:1px; }
        .pip-btns { display:flex; gap:8px; }
        .pip-btn { padding:8px 16px; border-radius:8px; border:1px solid #2a2a38; background:#1e1e2a; color:#e8e8f0; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s; }
        .pip-btn:hover { border-color:#7c6aff; background:#1e1e30; }
      </style>
      <div id="pip-root">
        <div id="pip-label">ENFOQUE</div>
        <div id="pip-ring-wrap">
          <svg viewBox="0 0 150 150">
            <circle cx="75" cy="75" r="65" fill="none" stroke="#1e1e2a" stroke-width="8"></circle>
            <circle id="pip-ring" cx="75" cy="75" r="65" fill="none" stroke="#7c6aff" stroke-width="8" stroke-dasharray="408.4" stroke-dashoffset="0" stroke-linecap="round"></circle>
          </svg>
          <div id="pip-center">
            <div id="pip-time">25:00</div>
            <div id="pip-mode">ENFOQUE</div>
          </div>
        </div>
        <div class="pip-btns">
          <button class="pip-btn" id="pip-reset">↺ Reset</button>
          <button class="pip-btn" id="pip-toggle">▶</button>
          <button class="pip-btn" id="pip-skip">⏭ Skip</button>
        </div>
      </div>
      <script>
        document.getElementById('pip-reset').onclick = () => window.opener.postMessage({type:'CMD',action:'RESET'},'*');
        document.getElementById('pip-toggle').onclick = () => window.opener.postMessage({type:'CMD',action:'TOGGLE'},'*');
        document.getElementById('pip-skip').onclick = () => window.opener.postMessage({type:'CMD',action:'SKIP'},'*');
      </script>
    `);
    _pomPipWin.document.close();
    _pomShowFloatingHint('Modo Picture-in-Picture activado.');
  } catch(e) {
    _openPomFallbackPopup();
  }
}

// Función que app.js llamará en cada tick
function _pomUpdateSync(timeText, isBreak) {
  if (_pomPipWin && !_pomPipWin.closed) {
    const timeEl = _pomPipWin.document.getElementById('pip-time');
    const modeEl = _pomPipWin.document.getElementById('pip-mode');
    const ringEl = _pomPipWin.document.getElementById('pip-ring');
    if (timeEl) timeEl.textContent = timeText;
    if (modeEl) {
      modeEl.textContent = isBreak ? 'DESCANSO' : 'ENFOQUE';
      modeEl.style.color = isBreak ? '#4ade80' : '#a89cff';
    }
    if (ringEl) {
      ringEl.style.stroke = isBreak ? '#4ade80' : '#7c6aff';
    }
  }
}
function _pomAudio() { return initAudioContext(); }
function pomPlayAlarm(isBreak) {
  try {
    const ctx = _pomAudio();
    const _doPlay = () => {
      const now = ctx.currentTime;
      const notes = isBreak ? [523,659,784,1047] : [880,659,523];
      _pomAlarmOscillators = [];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = isBreak ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const t = now + i * 0.20;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
        osc.start(t); osc.stop(t + 0.55);
        _pomAlarmOscillators.push(osc);
      });
    };
    if (ctx.state === 'suspended') ctx.resume().then(_doPlay).catch(e => console.warn('Alarm resume failed', e));
    else _doPlay();
  } catch(e) { console.warn('Alarm audio failed', e); }
}

// Short beep for UI events
function _pomBeep(type) {
  try {
    const ctx = _pomAudio();
    if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'start') {
        // Two ascending soft tones
        [[440, 0], [550, 0.12]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.22, now+delay+0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.28);
          o.start(now+delay); o.stop(now+delay+0.3);
        });
      } else if (type === 'pause') {
        // One descending soft tone
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now);
        o.frequency.linearRampToValueAtTime(330, now+0.18);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now+0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.22);
        o.start(now); o.stop(now+0.25);
      } else if (type === 'break') {
        // Three soft ascending pleasant tones — "relax"
        [[392,0],[494,0.15],[587,0.30]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.25, now+delay+0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.45);
          o.start(now+delay); o.stop(now+delay+0.5);
        });
      } else if (type === 'resume') {
        // Work resume: short energetic ascending double
        [[523,0],[659,0.10]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.2, now+delay+0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.2);
          o.start(now+delay); o.stop(now+delay+0.22);
        });
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
// SW KEEPALIVE — ping al service worker para que no duerma
// en background en móvil mientras el pomodoro corre
// ═══════════════════════════════════════════════════════════════
let _swKeepAliveInterval = null;

function _pomStartSwKeepAlive() {
  if (_swKeepAliveInterval) return;
  _swKeepAliveInterval = setInterval(() => {
    if (!pomR) { _pomStopSwKeepAlive(); return; }
    // Ping al SW para mantenerlo vivo
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'POM_KEEPALIVE',
        endTime: _pomEndTime,
        isBreak: pomB
      });
    }
    // Fallback: fetch silencioso para evitar que el browser suspenda el contexto
    // (solo en desktop, en móvil el SW maneja esto)
  }, 20000); // cada 20 segundos
}

function _pomStopSwKeepAlive() {
  if (_swKeepAliveInterval) {
    clearInterval(_swKeepAliveInterval);
    _swKeepAliveInterval = null;
  }
}
