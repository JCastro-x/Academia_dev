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

let pomI=null, pomR=false, pomB=false, pomSL=0, pomTS=0, pomD=0;

let _pomAudioCtx = null;
function initAudioContext() {
  if (_pomAudioCtx) return _pomAudioCtx;
  try {
    _pomAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_pomAudioCtx.state === 'suspended') _pomAudioCtx.resume();
  } catch(e) { console.warn('AudioContext init failed', e); }
  return _pomAudioCtx;
}


document.addEventListener('click', function _unlockAudio() {
  initAudioContext();
  document.removeEventListener('click', _unlockAudio);
}, { once: true, passive: true });

let _pomPipWin = null;
async function enterFloatingMode() {
  if (!('documentPictureInPicture' in window)) {
    alert("Tu navegador no soporta ventanas flotantes reales. ¡Prueba en Chrome!");
    return;
  }

  // Si ya hay una abierta, solo enfocarla
  if (_pomPipWin && !_pomPipWin.closed) {
    _pomPipWin.focus();
    return;
  }

  _pomPipWin = await window.documentPictureInPicture.requestWindow({
    width: 280,
    height: 240,
  });

  const doc = _pomPipWin.document;

  doc.body.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #0a0a0f; font-family: 'Space Mono', monospace, sans-serif; }
      #pip-root {
        height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; user-select: none; color: white; gap: 10px;
      }
      #pip-label { font-size: 10px; letter-spacing: 2.5px; color: #a89cff; }
      #pip-ring-wrap { position: relative; width: 150px; height: 150px; }
      #pip-ring-wrap svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
      #pip-center {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
      }
      #pip-time { font-size: 32px; font-weight: 800; letter-spacing: 2px; color: #e8e8f0; }
      #pip-mode { font-size: 9px; letter-spacing: 1.5px; color: #a89cff; margin-top: 3px; }
      .pip-btns { display: flex; gap: 8px; }
      .pip-btn {
        padding: 8px 14px; border-radius: 10px;
        border: 1px solid #2a2a38; background: #1e1e2a;
        color: #e8e8f0; font-size: 13px; font-weight: 700;
        cursor: pointer; font-family: inherit;
        transition: background .12s, border-color .12s;
      }
      .pip-btn:hover { border-color: #7c6aff; background: #2a2a40; }
      #pip-toggle { padding: 8px 22px; border: none; background: #7c6aff; color: #fff; }
      #pip-toggle:hover { background: #6a58e8; }
    </style>
    <div id="pip-root">
      <div id="pip-label">ENFOQUE</div>
      <div id="pip-ring-wrap">
        <svg viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="65" fill="none" stroke="#1e1e2a" stroke-width="8"/>
          <circle id="pip-ring" cx="75" cy="75" r="65" fill="none" stroke="#7c6aff" stroke-width="8"
            stroke-dasharray="408.4" stroke-dashoffset="0" stroke-linecap="round"/>
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
  `;

  // Botones: llaman directamente a funciones del contexto principal
  // documentPictureInPicture comparte el mismo JS realm
  doc.getElementById('pip-toggle').addEventListener('click', () => {
    if (typeof pomToggle === 'function') pomToggle();
  });
  doc.getElementById('pip-skip').addEventListener('click', () => {
    if (typeof pomSkip === 'function') pomSkip();
  });
  doc.getElementById('pip-reset').addEventListener('click', () => {
    if (typeof pomReset === 'function') pomReset();
  });

  // Loop que lee variables del contexto principal directamente (sin mensajes)
  let _pipLoop = setInterval(() => {
    if (!_pomPipWin || _pomPipWin.closed) { clearInterval(_pipLoop); return; }

    const running   = typeof pomR !== 'undefined' ? pomR : false;
    const isBreak   = typeof pomB !== 'undefined' ? pomB : false;
    const endTime   = typeof _pomEndTime !== 'undefined' ? _pomEndTime : 0;
    const total     = typeof pomTS !== 'undefined' && pomTS > 0 ? pomTS : 1500;
    const paused_sl = typeof pomSL !== 'undefined' ? pomSL : 0;

    // Tiempo: si corre → calcular desde endTime; si pausado → usar pomSL
    const remaining = (running && endTime > 0)
      ? Math.max(0, Math.round((endTime - Date.now()) / 1000))
      : paused_sl;

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timeStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    const modeText  = isBreak ? 'DESCANSO' : 'ENFOQUE';
    const modeColor = isBreak ? '#4ade80'  : '#a89cff';
    const ringColor = isBreak ? '#4ade80'  : '#7c6aff';
    const pct       = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 1;
    const offset    = 408.4 * (1 - pct);

    const timeEl   = doc.getElementById('pip-time');
    const labelEl  = doc.getElementById('pip-label');
    const modeEl   = doc.getElementById('pip-mode');
    const ringEl   = doc.getElementById('pip-ring');
    const toggleEl = doc.getElementById('pip-toggle');

    if (timeEl)   timeEl.textContent = timeStr;
    if (labelEl)  { labelEl.textContent = modeText; labelEl.style.color = modeColor; }
    if (modeEl)   { modeEl.textContent  = modeText; modeEl.style.color  = modeColor; }
    if (ringEl)   { ringEl.style.stroke = ringColor; ringEl.style.strokeDashoffset = offset; }
    if (toggleEl) toggleEl.textContent = running ? '⏸' : '▶';

  }, 500);

  _pomPipWin.addEventListener('pagehide', () => {
    clearInterval(_pipLoop);
    _pomPipWin = null;
  });
}

// Función que app.js llamará en cada tick
/*function _pomUpdateSync(timeText, isBreak) {
  if (_pomPipWin && !_pomPipWin.closed) {
    const timeEl = _pomPipWin.document.getElementById('pip-time');
    const modeEl = _pomPipWin.document.getElementById('pip-mode');
    if (timeEl) timeEl.textContent = timeText;
    if (modeEl) {
      modeEl.textContent = isBreak ? 'DESCANSO' : 'ENFOQUE';
      modeEl.style.color = isBreak ? '#4ade80' : '#a89cff';
    }
  }
}*/
function _pomAudio() { return initAudioContext(); }
function pomPlayAlarm(isBreak) {
  try {
    const ctx = _pomAudio();
    const _doPlay = () => {
      const now = ctx.currentTime;
      const notes = isBreak ? [523,659,784,1047] : [880,659,523];
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
