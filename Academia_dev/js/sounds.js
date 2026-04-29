
// ══════════════════════════════════════════════════════════════
// UI SOUND SYSTEM — subtle click/feedback sounds + white noise
// ══════════════════════════════════════════════════════════════
let _uiSoundsEnabled = true;
let _noiseNode = null, _noiseGain = null, _noiseType = null;
let _noiseVol = 0.30;

function toggleUiSounds() {
  _uiSoundsEnabled = !_uiSoundsEnabled;
  const btn = document.getElementById('ui-sound-btn');
  if (btn) btn.textContent = _uiSoundsEnabled ? '🔔' : '🔕';
  // If disabling, play one last click so user hears feedback
  if (!_uiSoundsEnabled) { _uiSoundsEnabled = true; _uiClick('off'); _uiSoundsEnabled = false; }
  localStorage.setItem('academia_ui_sounds', _uiSoundsEnabled ? '1' : '0');
}

// Central UI sound dispatcher
function _uiClick(type) {
  if (!_uiSoundsEnabled) return;
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const variant = (typeof State !== 'undefined' && State.settings?.soundVariant) || 'classic';
    // Volume multiplier per variant
    const vol = variant === 'minimal' ? 0.5 : variant === 'digital' ? 0.6 : 1.0;
    // Oscillator type per variant
    const oType = variant === 'digital' ? 'square' : 'sine';
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'nav') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 480;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+0.08);
          o.start(now); o.stop(now+0.1);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 600;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.setValueAtTime(0.04*vol, now+0.03); g.gain.linearRampToValueAtTime(0, now+0.04);
          o.start(now); o.stop(now+0.05);
        } else {
          // Classic nav: soft warm tap
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(520, now+0.06);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.12);
          o.start(now); o.stop(now+0.15);
        }
      } else if (type === 'click') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(800, now); o.frequency.exponentialRampToValueAtTime(600, now+0.05);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.exponentialRampToValueAtTime(0.001, now+0.06);
          o.start(now); o.stop(now+0.07);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 1200;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.002); g.gain.setValueAtTime(0.04*vol, now+0.04); g.gain.linearRampToValueAtTime(0, now+0.05);
          o.start(now); o.stop(now+0.06);
        } else {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 660;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05*vol, now+0.008); g.gain.exponentialRampToValueAtTime(0.001, now+0.07);
          o.start(now); o.stop(now+0.08);
        }
      } else if (type === 'modal-open') {
        if (variant === 'digital') {
          [[800,0],[1000,0.04],[1200,0.08]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.035*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.06);
            o.start(now+d); o.stop(now+d+0.07);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=520;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.04*vol,now+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
          o.start(now); o.stop(now+0.12);
        } else {
          [[440,0],[554,0.05],[659,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.06*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.15);
            o.start(now+d); o.stop(now+d+0.18);
          });
        }
      } else if (type === 'modal-close') {
        if (variant === 'digital') {
          [[1000,0],[800,0.04]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.03*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.05);
            o.start(now+d); o.stop(now+d+0.06);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=400;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.03*vol,now+0.008); g.gain.exponentialRampToValueAtTime(0.001,now+0.07);
          o.start(now); o.stop(now+0.08);
        } else {
          [[659,0],[554,0.05],[440,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.05*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.12);
            o.start(now+d); o.stop(now+d+0.15);
          });
        }
      } else if (type === 'task-done') {
        // Celebratory ascending ding
        const freqs = variant === 'digital' ? [[800,0],[1000,0.07],[1200,0.14]] : [[523,0],[659,0.09],[784,0.18],[1047,0.29]];
        freqs.forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.14*vol, now+d+0.03); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.35);
          o.start(now+d); o.stop(now+d+0.40);
        });
      } else if (type === 'task-undone') {
        [[523,0],[415,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.07*vol, now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.15);
          o.start(now+d); o.stop(now+d+0.18);
        });
      } else if (type === 'save') {
        [[660,0],[880,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.09*vol, now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.12);
          o.start(now+d); o.stop(now+d+0.14);
        });
      } else if (type === 'delete') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = oType; o.frequency.setValueAtTime(220, now); o.frequency.linearRampToValueAtTime(110, now+0.12);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.18);
        o.start(now); o.stop(now+0.20);
      } else if (type === 'off') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(220, now+0.2);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.25);
        o.start(now); o.stop(now+0.28);
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ── AMBIENT NOISE BUFFERS — seamless loop, no pops ───────────
// 45-second buffers + 1-second equal-power crossfade at loop boundary.
// Equal-power crossfade (cos/sin curve) avoids the amplitude dip
// that linear crossfade causes, making the loop point inaudible.
function _buildNoiseBuffer(ctx, type) {
  const sr      = ctx.sampleRate;
  const bufSize = sr * 45;           // 45-second loop — loop point barely occurs
  const FADE    = Math.floor(sr * 1.0); // 1-second equal-power crossfade
  const buf     = ctx.createBuffer(1, bufSize, sr);
  const data    = buf.getChannelData(0);

  // ── Pink noise helper (1/f noise — warmer than white, less boomy than brown)
  function _pink(state) {
    const w = Math.random() * 2 - 1;
    state[0] = 0.99886*state[0] + w*0.0555179;
    state[1] = 0.99332*state[1] + w*0.0750759;
    state[2] = 0.96900*state[2] + w*0.1538520;
    state[3] = 0.86650*state[3] + w*0.3104856;
    state[4] = 0.55000*state[4] + w*0.5329522;
    state[5] = -0.7616*state[5] - w*0.0168980;
    const pink = state[0]+state[1]+state[2]+state[3]+state[4]+state[5]+state[6]+w*0.5362;
    state[6] = w*0.115926;
    return pink * 0.11;
  }

  if (type === 'white') {
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.85;

  } else if (type === 'pink') {
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) data[i] = _pink(st);

  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      last    = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.8;
    }

  } else if (type === 'rain') {
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) {
      const p    = _pink(st);
      // Full integer cycles over buffer → value at end == value at start
      const sway = 0.70 + 0.30 * Math.sin((i / bufSize) * 2 * Math.PI * 7);
      data[i]    = p * sway * 1.4;
    }

  } else if (type === 'storm') {
    const st = [0,0,0,0,0,0,0];
    let rumble = 0;
    for (let i = 0; i < bufSize; i++) {
      const w   = Math.random() * 2 - 1;
      rumble    = (rumble + 0.012 * w) / 1.012;
      const p   = _pink(st);
      data[i]   = p * 1.6 + rumble * 6;
      if (Math.random() < 0.000008) {
        const rollLen = Math.floor(sr * (1.5 + Math.random() * 2));
        for (let k = 0; k < rollLen && i + k < bufSize - FADE; k++) {
          const env = Math.exp(-k / (rollLen * 0.35)) * Math.sin(k * 0.003);
          data[i + k] += env * (Math.random() * 2 - 1) * 0.6;
        }
      }
    }

  } else if (type === 'fire') {
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      last    = (last + 0.014 * w) / 1.014;
      data[i] = last * 4.5;
    }
    // Smooth breathe — integer cycles
    for (let i = 0; i < bufSize; i++) {
      const breathe = 0.72 + 0.28 * Math.sin((i / bufSize) * 2 * Math.PI * 11);
      data[i] *= breathe;
    }
    // Crackles — keep away from crossfade zone
    for (let i = 0; i < bufSize - FADE - 500; i++) {
      if (Math.random() < 0.00016) {
        const amp = 0.4 + Math.random() * 0.8;
        for (let k = 0; k < 180 && i+k < bufSize - FADE; k++) {
          data[i+k] += Math.sin(k * 1.1) * Math.exp(-k * 0.06) * amp;
        }
      }
    }

  } else if (type === 'forest') {
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) {
      const p    = _pink(st);
      const wind = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 5)
                                      * Math.sin((i / bufSize) * 2 * Math.PI * 17));
      data[i] = p * wind * 1.3;
    }
    for (let i = 0; i < bufSize - FADE - sr; i++) {
      if (Math.random() < 0.000035) {
        const chirpLen  = Math.floor(sr * (0.08 + Math.random() * 0.14));
        const chirpFreq = 1800 + Math.random() * 1800;
        const vibrato   = 8 + Math.random() * 14;
        for (let k = 0; k < chirpLen && i+k < bufSize - FADE; k++) {
          const t   = k / sr;
          const env = Math.exp(-k / (chirpLen * 0.45));
          const f   = chirpFreq + Math.sin(2 * Math.PI * vibrato * t) * 60;
          data[i+k] += Math.sin(2 * Math.PI * f * t) * env * 0.22;
        }
      }
    }

  } else if (type === 'ocean') {
    const st = [0,0,0,0,0,0,0];
    let smooth = 0;
    for (let i = 0; i < bufSize; i++) {
      const p     = _pink(st);
      // Integer cycles → seamless
      const wave1 = 0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 9);
      const wave2 = 0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 23);
      smooth      = smooth * 0.72 + p * 0.28;
      data[i]     = (smooth * 0.5 + p * 0.5) * (wave1 * 0.65 + wave2 * 0.35) * 2.2;
    }
  }

  // ── EQUAL-POWER SEAMLESS LOOP CROSSFADE ───────────────────
  // Equal-power (cos/sin) avoids amplitude dip — makes loop inaudible
  const head = new Float32Array(FADE);
  for (let i = 0; i < FADE; i++) head[i] = data[i];
  for (let i = 0; i < FADE; i++) {
    const alpha   = i / FADE;                   // 0 → 1
    const cosW    = Math.cos(alpha * Math.PI / 2); // 1 → 0
    const sinW    = Math.sin(alpha * Math.PI / 2); // 0 → 1
    data[bufSize - FADE + i] = data[bufSize - FADE + i] * cosW + head[i] * sinW;
  }

  return buf;
}

function toggleNoise(type) {
  const ctx = initAudioContext();
  if (!ctx) return;
  if (_noiseType === type && _noiseNode) { _stopNoise(); return; }
  _stopNoise();

  const _start = () => {
    try {
      const buf = _buildNoiseBuffer(ctx, type);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      _noiseGain = ctx.createGain();
      _noiseGain.gain.value = _noiseVol;

      // Apply type-specific filters for color & realism
      const connect = (node) => { node.connect(_noiseGain); };

      if (type === 'white') {
        // Slight high-shelf cut — softens harshness
        const f = ctx.createBiquadFilter(); f.type='highshelf'; f.frequency.value=6000; f.gain.value=-6;
        src.connect(f); connect(f);
      } else if (type === 'pink') {
        // Pink is already warm — gentle low-shelf boost
        const f = ctx.createBiquadFilter(); f.type='lowshelf'; f.frequency.value=300; f.gain.value=2;
        src.connect(f); connect(f);
      } else if (type === 'brown') {
        // Deep lowpass for that heavy, cozy rumble
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500; f.Q.value=0.6;
        src.connect(f); connect(f);
      } else if (type === 'rain') {
        // Bandpass centered on rain frequencies
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1000; f.Q.value=0.5;
        src.connect(f); connect(f);
      } else if (type === 'storm') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1800; f.Q.value=0.4;
        src.connect(f); connect(f);
      } else if (type === 'forest') {
        const f = ctx.createBiquadFilter(); f.type='lowshelf'; f.frequency.value=250; f.gain.value=-5;
        src.connect(f); connect(f);
      } else if (type === 'ocean') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1200; f.Q.value=0.5;
        src.connect(f); connect(f);
      } else {
        src.connect(_noiseGain);
      }

      _noiseGain.connect(ctx.destination);
      // Slow fade-in to avoid pop on start
      _noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      _noiseGain.gain.linearRampToValueAtTime(_noiseVol, ctx.currentTime + 1.2);
      src.start();
      _noiseNode = src; _noiseType = type;
      _updateNoiseButtons();

      // Update "now playing" label
      const labels = {
        white:'Ruido Blanco', pink:'Ruido Rosa', brown:'Ruido Tierra',
        rain:'Lluvia', storm:'⛈ Tormenta', fire:'🔥 Fuego',
        forest:'🌿 Bosque', ocean:'🌊 Océano'
      };
      const np = document.getElementById('sound-now-playing');
      if (np) np.textContent = '▶ ' + (labels[type] || type);
    } catch(e) { console.warn('Noise error', e); }
  };

  if (ctx.state === 'suspended') ctx.resume().then(_start).catch(() => {}); else _start();
}

function _stopNoise() {
  if (_noiseNode) {
    try {
      if (_noiseGain && _pomAudioCtx) {
        _noiseGain.gain.linearRampToValueAtTime(0, _pomAudioCtx.currentTime + 0.4);
        const n = _noiseNode;
        setTimeout(() => { try { n.stop(); } catch(e) {} }, 450);
      } else { _noiseNode.stop(); }
    } catch(e) {}
    _noiseNode = null; _noiseGain = null;
  }
  _noiseType = null;
  _updateNoiseButtons();
  const np = document.getElementById('sound-now-playing');
  if (np) np.textContent = '— Sin sonido —';
}

function _updateNoiseButtons() {
  ['white','pink','brown','rain','storm','fire','forest','ocean'].forEach(t => {
    const btn  = document.getElementById('noise-' + t + '-btn');
    const icon = document.getElementById('noise-' + t + '-icon');
    if (btn)  btn.classList.toggle('playing', _noiseType === t);
    if (icon) icon.textContent = _noiseType === t ? '⏸' : '▶';
  });
}

function setNoiseVol(v) {
  _noiseVol = parseInt(v) / 100;
  if (_noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.1);
  }
  localStorage.setItem('academia_noise_vol', v);
  updateSliderFill(document.getElementById('noise-vol'));
}

// Actualiza el fondo del slider para mostrar progreso
function updateSliderFill(el) {
  if (!el) return;
  const val = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.backgroundSize = val + '% 100%';
}

// Inicializar todos los sliders al cargar y escuchar cambios globales
document.addEventListener('input', e => {
  if (e.target.type === 'range') {
    updateSliderFill(e.target);
  }
});

// También inicializar los sliders existentes al cargar el DOM y al cambiar de página
document.addEventListener('DOMContentLoaded', () => {
  initSliders();
});

// Hook para SPA: actualizar sliders al cambiar de página
if (typeof onGoPage === 'function') {
  onGoPage(() => {
    setTimeout(initSliders, 50);
  });
}

function initSliders() {
  const noiseVol = localStorage.getItem('academia_noise_vol');
  const pomVol = localStorage.getItem('academia_pom_vol');
  
  const noiseSlider = document.getElementById('noise-vol');
  const pomSlider = document.getElementById('pom-vol');
  
  if (noiseSlider && noiseVol !== null) {
    noiseSlider.value = noiseVol;
    _noiseVol = parseInt(noiseVol) / 100;
  }
  if (pomSlider && pomVol !== null) {
    pomSlider.value = pomVol;
  }
  
  document.querySelectorAll('input[type="range"]').forEach(updateSliderFill);
}

// ── INTEGRATE UI SOUNDS INTO EXISTING FUNCTIONS ───────────────
// Attach sound to all .btn clicks globally
document.addEventListener('click', e => {
  if (!_uiSoundsEnabled) return;
  const btn = e.target.closest('.btn, .nav-item, .mobile-nav-item, .task-check, .notes-folder-item');
  if (!btn) return;
  // Skip noise buttons (they handle their own sound)
  const skipIds = ['noise-white-btn','noise-pink-btn','noise-brown-btn','noise-rain-btn','noise-storm-btn','noise-fire-btn','noise-forest-btn','noise-ocean-btn','ui-sound-btn'];
  if (skipIds.some(id => btn.id === id)) return;
  // Skip pom-btn (has its own sounds)
  if (btn.id === 'pom-btn') return;
  // Determine sound type from context
  const onclick = btn.getAttribute('onclick') || '';
  if (btn.classList.contains('nav-item') || btn.classList.contains('mobile-nav-item')) {
    _uiClick('nav'); return;
  }
  if (btn.classList.contains('task-check')) {
    // Sound played inside toggleTask itself
    return;
  }
  if (onclick.includes('closeModal') || onclick.includes('modal-close') || btn.classList.contains('modal-close')) {
    _uiClick('modal-close'); return;
  }
  if (onclick.match(/open\w*Modal|Modal\w*open|\bopen[A-Z]/i)) {
    _uiClick('modal-open'); return;
  }
  if (onclick.match(/save[A-Z]|Save|create[A-Z]|Create|guardar/i)) {
    _uiClick('save'); return;
  }
  if (onclick.match(/delete[A-Z]|Delete|eliminar|remove/i)) {
    _uiClick('delete'); return;
  }
  _uiClick('click');
}, true); // capture phase

// Init: load ui sounds preference
(function _initUiSoundsPref() {
  const saved = localStorage.getItem('academia_ui_sounds');
  if (saved === '0') { _uiSoundsEnabled = false; const btn = document.getElementById('ui-sound-btn'); if (btn) btn.textContent = '🔕'; }
})();
let _mp3Playing = false;

function loadLocalMusic(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const audio = _el('pom-audio');
  if (!audio) return;

  if (audio._objectURL) URL.revokeObjectURL(audio._objectURL);
  const url = URL.createObjectURL(file);
  audio._objectURL = url;
  audio.src = url;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  _mp3Ready = true;
  _mp3Playing = false;

  const btn = document.getElementById('pom-music-btn');
  if (btn) btn.style.display = 'inline-flex';
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-label').textContent  = file.name.replace(/\.[^.]+$/,'').slice(0,28);
  document.getElementById('pom-music-status').textContent = `📁 ${file.name} · listo`;
}

function togglePomMusic() {
  if (!_mp3Ready) {
    document.getElementById('pom-mp3-input')?.click();
    return;
  }
  _mp3Playing ? _mp3Stop() : _mp3Start();
}
function _mp3Start() {
  const audio = _el('pom-audio');
  if (!audio || !_mp3Ready) return;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  audio.play().catch(e => console.warn('Audio play failed', e));
  _mp3Playing = true;
  document.getElementById('pom-music-btn')?.classList.add('playing');
  document.getElementById('pom-music-icon').textContent   = '⏸';
  document.getElementById('pom-music-status').textContent = '🎵 Reproduciendo en bucle';
}
function _mp3Stop() {
  const audio = _el('pom-audio');
  if (audio) audio.pause();
  _mp3Playing = false;
  document.getElementById('pom-music-btn')?.classList.remove('playing');
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-status').textContent = '⏸ Pausado · presiona ▶ para continuar';
}
function setPomVol(v) {
  const audio = _el('pom-audio');
  if (audio) audio.volume = parseInt(v) / 100;
  localStorage.setItem('academia_pom_vol', v);
  updateSliderFill(document.getElementById('pom-vol'));
}

// ═══════════════════════════════════════════════════════════════
// POMODORO FUNCTIONS — MIGRADAS A js/pomodoro/
// timer-core.js: pomWork, pomBreak, pomReset, pomToggle, pomSkip, pomSavePartial
// timer-ui.js: updatePomDisp, updatePomDots, renderPomHistory, renderPomGoal
//
// Las siguientes funciones se mantienen aquí por ser parte del sistema de audio:
// _pomMusicOnBreak, _pomMusicOnWork, _pomCountdownBeep, pomPlayAlarm
// ═══════════════════════════════════════════════════════════════

// ── Pause/resume music when switching phases ──────────────────
function _pomMusicOnBreak() {
  if (_mp3Playing) { _mp3Stop(); _mp3Playing = '_pom_paused'; }
  if (_noiseType && _noiseNode && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(0, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = true;
  }
}
function _pomMusicOnWork() {
  if (_mp3Playing === '_pom_paused') { _mp3Playing = false; _mp3Start(); }
  if (_noiseNode && _noiseNode._pausedByPom && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = false;
  }
}

// ── Countdown beep (5s before switch) ────────────────────────
function _pomCountdownBeep(secsLeft) {
  try {
    const ctx = _pomAudio(); if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      const freq = secsLeft === 1 ? 880 : 600;
      const dur  = secsLeft === 1 ? 0.30 : 0.12;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur + 0.02);
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do); else _do();
  } catch(e) {}
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  State.settings.theme = newTheme;
  saveState(['settings']);
  document.getElementById('theme-btn').textContent = newTheme==='dark' ? '☀️' : '🌙';
}

function _applyFont(fontName) {
  const fontMap = {
    'Syne': "'Syne', sans-serif",
    'Inter': "'Inter', sans-serif",
    'JetBrains Mono': "'JetBrains Mono', monospace",
    'Playfair Display': "'Playfair Display', serif"
  };
  const fontVal = fontMap[fontName] || "'Syne', sans-serif";
  document.documentElement.style.setProperty('--app-font', fontVal);
}

function setFont(fontName) {
  _applyFont(fontName);
  State.settings.font = fontName;
  saveState(['settings']);
}

function _applyAccentColor(hex) {
  // Convert hex to rgb values for the glow effects
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  // Calculate lighter accent2 (lighter version)
  const lr = Math.min(255, r + 40);
  const lg = Math.min(255, g + 40);
  const lb = Math.min(255, b + 40);
  const toHex = n => n.toString(16).padStart(2,'0');
  const accent2 = `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent2', accent2);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},.15)`);
  // Update active nav item border color variable
  document.documentElement.style.setProperty('--btn-primary-glow', `rgba(${r},${g},${b},.35)`);
  // Update light theme accent too
  document.querySelectorAll('.accent-color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === hex);
  });
}

function setAccentColor(hex) {
  _applyAccentColor(hex);
  State.settings.accentColor = hex;
  saveState(['settings']);
}

function setSoundVariant(variant) {
  State.settings.soundVariant = variant;
  saveState(['settings']);
}

function openQuickAdd() { _uiClick('modal-open'); document.getElementById('modal-quickadd').classList.add('open'); }
function openModal(id) { _uiClick('modal-open'); document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { _uiClick('modal-close'); document.getElementById(id)?.classList.remove('open'); }
window.openModal = openModal;
window.closeModal = closeModal;

function _getGreeting() {
  const h = new Date().getHours();
  // Obtener nombre del usuario autenticado (Google) o fallback
  const userName = window._currentUserName || State.settings?.profile?.name?.split(' ')[0] || 'Ingeniero';
  const salud = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${salud}, ${userName} `;
}
