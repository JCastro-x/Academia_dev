
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
// All buffers: 12 seconds + 300ms crossfade at loop boundary
// Crossfade technique: end of buffer blends into beginning
// so the Web Audio loop point (sample 0) is always smooth.
function _buildNoiseBuffer(ctx, type) {
  const sr      = ctx.sampleRate;
  const bufSize = sr * 12;           // 12-second loop
  const FADE    = Math.floor(sr * 0.30); // 300ms crossfade zone
  const buf     = ctx.createBuffer(1, bufSize, sr);
  const data    = buf.getChannelData(0);

  // ── Pink noise helper (1/f noise — warmer than white, less boomy than brown)
  function _pink(state) {
    // Paul Kellet's pink noise algorithm
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
    // Pure white noise — flat spectrum
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.85;

  } else if (type === 'pink') {
    // Pink noise — 1/f, more natural, great for focus
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) data[i] = _pink(st);

  } else if (type === 'brown') {
    // Brown/red noise — very low, deep rumble, like distant thunder or HVAC
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w   = Math.random() * 2 - 1;
      last      = (last + 0.02 * w) / 1.02;
      data[i]   = last * 3.8;
    }

  } else if (type === 'rain') {
    // Rain: pink noise base + gentle amplitude sway (period matches buffer length)
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) {
      const p    = _pink(st);
      // Sway period = bufSize → starts & ends at same value
      const sway = 0.70 + 0.30 * Math.sin((i / bufSize) * 2 * Math.PI * 3);
      data[i]    = p * sway * 1.4;
    }

  } else if (type === 'storm') {
    // Thunderstorm: heavy rain + low rumbles
    const st = [0,0,0,0,0,0,0];
    let rumble = 0;
    for (let i = 0; i < bufSize; i++) {
      const w     = Math.random() * 2 - 1;
      rumble      = (rumble + 0.012 * w) / 1.012;
      const pink  = _pink(st);
      // Mix heavy rain (pink) with thunder rumble (brown)
      data[i]     = pink * 1.6 + rumble * 6;
      // Occasional distant thunder roll
      if (Math.random() < 0.00003) {
        const rollLen = Math.floor(sr * (1.5 + Math.random() * 2));
        for (let k = 0; k < rollLen && i + k < bufSize; k++) {
          const env = Math.exp(-k / (rollLen * 0.35)) * Math.sin(k * 0.003);
          data[i + k] += env * (Math.random() * 2 - 1) * 0.6;
        }
      }
    }

  } else if (type === 'fire') {
    // Fire: brown noise base + random crackles, gentle breathing
    let last = 0;
    // Pre-place crackle events so they don't cluster near end
    const crackles = [];
    for (let i = 0; i < bufSize; i++) {
      if (Math.random() < 0.00055) crackles.push(i);
    }
    for (let i = 0; i < bufSize; i++) {
      const w     = Math.random() * 2 - 1;
      last        = (last + 0.014 * w) / 1.014;
      data[i]     = last * 4.5;
    }
    // Smooth breathe: use sin with period = bufSize/3 → multiple full cycles, starts/ends same
    for (let i = 0; i < bufSize; i++) {
      const breathe = 0.72 + 0.28 * Math.sin((i / bufSize) * 2 * Math.PI * 5);
      data[i] *= breathe;
    }
    // Add crackles
    crackles.forEach(ci => {
      if (ci + 300 < bufSize) {
        const amp = 0.4 + Math.random() * 0.8;
        for (let k = 0; k < 180 && ci+k < bufSize; k++) {
          data[ci+k] += Math.sin(k * 1.1) * Math.exp(-k * 0.06) * amp;
        }
      }
    });

  } else if (type === 'cafe') {
    // Coffee shop: warm pink noise murmur, subtle room hum, soft clinks
    // Room modulation uses FULL CYCLES of sin → seamless at loop point
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) {
      const p    = _pink(st) * 0.9;
      // Room swell: 4 full cycles over the buffer → starts & ends at same value (sin(0)=sin(8π)=0)
      const room = 0.55 + 0.45 * Math.sin((i / bufSize) * 2 * Math.PI * 4);
      data[i]    = p * room;
    }
    // Add subtle glass/cup clinks — keep them away from the fade zone
    for (let i = 0; i < bufSize - FADE - sr; i++) {
      if (Math.random() < 0.00006) {
        const freq = 800 + Math.random() * 1200;
        const clinkLen = Math.floor(sr * (0.08 + Math.random() * 0.07));
        for (let k = 0; k < clinkLen && i+k < bufSize; k++) {
          const env = Math.exp(-k / (clinkLen * 0.3));
          data[i+k] += Math.sin(2 * Math.PI * freq * k / sr) * env * 0.18;
        }
      }
    }

  } else if (type === 'forest') {
    // Forest: wind (pink) + bird chirps — wind sways in full cycles
    const st = [0,0,0,0,0,0,0];
    for (let i = 0; i < bufSize; i++) {
      const p    = _pink(st);
      // Wind: 2 full cycles → seamless
      const wind = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 2)
                                      * Math.sin((i / bufSize) * 2 * Math.PI * 7));
      data[i] = p * wind * 1.3;
    }
    // Bird chirps — keep away from crossfade zone
    for (let i = 0; i < bufSize - FADE - sr; i++) {
      if (Math.random() < 0.00012) {
        const chirpLen  = Math.floor(sr * (0.08 + Math.random() * 0.14));
        const chirpFreq = 1800 + Math.random() * 1800;
        const vibrato   = 8 + Math.random() * 14;
        for (let k = 0; k < chirpLen && i+k < bufSize; k++) {
          const t   = k / sr;
          const env = Math.exp(-k / (chirpLen * 0.45));
          const f   = chirpFreq + Math.sin(2 * Math.PI * vibrato * t) * 60;
          data[i+k] += Math.sin(2 * Math.PI * f * t) * env * 0.22;
        }
      }
    }

  } else if (type === 'ocean') {
    // Ocean: layered waves using sin-modulated pink noise — period matches buffer
    const st = [0,0,0,0,0,0,0];
    let smooth = 0;
    for (let i = 0; i < bufSize; i++) {
      const p = _pink(st);
      // Two wave rhythms, both full cycles over buffer → seamless
      const wave1 = 0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 3);   // 3 swells
      const wave2 = 0.5 + 0.5 * Math.sin((i / bufSize) * 2 * Math.PI * 7.1); // 7 splashes
      smooth = smooth * 0.72 + p * 0.28;
      data[i] = (smooth * 0.5 + p * 0.5) * (wave1 * 0.65 + wave2 * 0.35) * 2.2;
    }

  } else if (type === 'lofi') {
    // Lo-Fi: warm vinyl atmosphere — pink noise + subtle drone + occasional crackle
    const st = [0,0,0,0,0,0,0];
    // Build base layer
    for (let i = 0; i < bufSize; i++) {
      const p     = _pink(st);
      // Gentle "room" modulation — full cycles
      const room  = 0.60 + 0.40 * Math.sin((i / bufSize) * 2 * Math.PI * 2);
      data[i]     = p * room * 0.85;
    }
    // Add warm drone tones (bass/mid harmony — Cm-ish for study mood)
    // Frequencies: C2=65Hz, G2=98Hz, Eb3=156Hz, Bb3=233Hz
    const droneFreqs = [65.4, 98.0, 155.6, 233.1];
    const droneAmps  = [0.055, 0.040, 0.028, 0.018];
    droneFreqs.forEach((freq, fi) => {
      // Slow LFO per tone — full cycles to avoid loop click
      const lfoRate = 0.08 + fi * 0.03; // very slow: 0.08–0.17 Hz
      for (let i = 0; i < bufSize; i++) {
        const t   = i / sr;
        const lfo = 0.6 + 0.4 * Math.sin((i / bufSize) * 2 * Math.PI * Math.round(lfoRate * 12));
        data[i]  += Math.sin(2 * Math.PI * freq * t) * droneAmps[fi] * lfo;
      }
    });
    // Vinyl crackle — sparse, away from fade zone
    for (let i = 200; i < bufSize - FADE - 500; i++) {
      if (Math.random() < 0.00012) {
        const amp = 0.05 + Math.random() * 0.12;
        for (let k = 0; k < 60 && i+k < bufSize; k++) {
          data[i+k] += (Math.random() * 2 - 1) * amp * Math.exp(-k * 0.12);
        }
      }
    }
  }

  // ── SEAMLESS LOOP CROSSFADE ────────────────────────────────
  // Blend end of buffer → beginning so loop point is silent
  const head = new Float32Array(FADE);
  for (let i = 0; i < FADE; i++) head[i] = data[i];
  for (let i = 0; i < FADE; i++) {
    const t = i / FADE; // 0→1 (end of buffer fades into start)
    data[bufSize - FADE + i] = data[bufSize - FADE + i] * (1 - t) + head[i] * t;
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
        // Heavy lowpass for storm rumble
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1800; f.Q.value=0.4;
        src.connect(f); connect(f);
      } else if (type === 'fire') {
        // Lowpass for warm crackling
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; f.Q.value=0.45;
        src.connect(f); connect(f);
      } else if (type === 'cafe') {
        // Soft bandpass for muffled room sound
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=700; f.Q.value=0.35;
        const f2 = ctx.createBiquadFilter(); f2.type='highshelf'; f2.frequency.value=4000; f2.gain.value=-8;
        src.connect(f); f.connect(f2); f2.connect(_noiseGain);
      } else if (type === 'forest') {
        // Low-shelf cut (less rumble) + airy highs
        const f = ctx.createBiquadFilter(); f.type='lowshelf'; f.frequency.value=250; f.gain.value=-5;
        src.connect(f); connect(f);
      } else if (type === 'ocean') {
        // Lowpass keeps waves deep and smooth
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1200; f.Q.value=0.5;
        src.connect(f); connect(f);
      } else if (type === 'lofi') {
        // Lo-fi: warm lowpass + slight mid scoop (telephone/vinyl feel)
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=3500; lp.Q.value=0.7;
        const mid = ctx.createBiquadFilter(); mid.type='peaking'; mid.frequency.value=800; mid.gain.value=-3; mid.Q.value=1.5;
        src.connect(lp); lp.connect(mid); mid.connect(_noiseGain);
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
        cafe:'☕ Cafetería', forest:'🌿 Bosque', ocean:'🌊 Océano', lofi:'🎵 Lo-Fi'
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
  ['white','pink','brown','rain','storm','fire','cafe','forest','ocean','lofi'].forEach(t => {
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
}

// ── INTEGRATE UI SOUNDS INTO EXISTING FUNCTIONS ───────────────
// Attach sound to all .btn clicks globally
document.addEventListener('click', e => {
  if (!_uiSoundsEnabled) return;
  const btn = e.target.closest('.btn, .nav-item, .mobile-nav-item, .task-check, .notes-folder-item');
  if (!btn) return;
  // Skip noise buttons (they handle their own sound)
  const skipIds = ['noise-white-btn','noise-pink-btn','noise-brown-btn','noise-rain-btn','noise-storm-btn','noise-fire-btn','noise-cafe-btn','noise-forest-btn','noise-ocean-btn','noise-lofi-btn','ui-sound-btn'];
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
}

function pomWork()  { return (parseInt(document.getElementById('pom-work')?.value)||25)*60; }
function pomBreak() { return (parseInt(document.getElementById('pom-break')?.value)||5)*60; }
function pomReset() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomB=false; pomSL=pomTS=pomWork();
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp();
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

function pomToggle() {
  try { const ctx = _pomAudio(); if (ctx.state === 'suspended') ctx.resume(); } catch(e) {}
  if (pomR) {
    clearInterval(pomI); pomI=null; pomR=false;
    _el('pom-btn').textContent='▶ Reanudar';
    _pomBeep('pause');
    // Notify chrono: pom paused → stop counting work time
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  } else {
    if (pomSL<=0||pomTS===0) pomReset();
    pomR=true; _el('pom-btn').textContent='⏸ Pausar';
    _pomBeep(pomB ? 'break' : 'start');
    // Notify chrono: pom running
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(true, pomB ? 'break' : 'work');
    pomI = setInterval(() => {
      pomSL--; updatePomDisp();
      if (pomSL <= 10 && pomSL > 0) _pomCountdownBeep(pomSL);
      if (pomSL <= 0) {
        clearInterval(pomI); pomI=null; pomR=false;
        pomPlayAlarm(pomB);
        if (!pomB) {
          pomD++;
          const subj = document.getElementById('pom-subject').value;
          const m = getMat(subj);
          State.pomSessions.push({
            subject: m.name||subj||'General',
            time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
            taskId: document.getElementById('pom-task-sel')?.value || '',
            taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
            mins: pomWork() / 60
          });
          _recordPomWeekSession(pomWork() / 60);
          _updateStreak();
          savePom(); renderPomHistory(); renderPomGoal();
          const ovSess = document.getElementById('ov-sessions'); if(ovSess) ovSess.textContent = State.pomSessions.length;
          pomB=true; pomSL=pomTS=pomBreak();
          _pomMusicOnBreak();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
        } else {
          pomB=false; pomSL=pomTS=pomWork();
          _pomMusicOnWork();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
        }
        _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
      }
    }, 1000);
  }
}
function pomSkip() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false;
  if (!pomB) {
    pomD++; pomB=true; pomSL=pomTS=pomBreak(); _pomBeep('break');
    _pomMusicOnBreak();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
  } else {
    pomB=false; pomSL=pomTS=pomWork(); _pomBeep('resume');
    _pomMusicOnWork();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
  }
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
}
function updatePomDisp() {
  const m=Math.floor(pomSL/60), s=pomSL%60;
  document.getElementById('pom-time').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const circ=2*Math.PI*82, prog=pomTS>0?pomSL/pomTS:1;
  const ring=document.getElementById('pom-ring');
  ring.style.strokeDashoffset=circ*(1-prog);
  ring.style.stroke=pomB?'#4ade80':'var(--accent)';
  document.getElementById('pom-mode').textContent=pomB?'DESCANSO':'ENFOQUE';
}
function updatePomDots() {
  const cycles = parseInt(document.getElementById('pom-cycles')?.value) || 4;
  document.getElementById('pom-dots').innerHTML=Array.from({length:cycles},(_,i)=>
    `<div style="width:9px;height:9px;border-radius:50%;background:${i<pomD%cycles?'var(--accent)':'var(--border2)'};"></div>`
  ).join('');
}
function renderPomHistory() {
  const hist = document.getElementById('pom-history'); if (!hist) return;
  const sess = State.pomSessions;
  if (!sess.length) {
    hist.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3);">⏱️ Sin sesiones hoy aún<br><span style="font-size:11px;margin-top:6px;display:block;">¡Inicia tu primera sesión!</span></div>`;
  } else {
    hist.innerHTML = sess.slice().reverse().map((s, i) => {
      const num = sess.length - i;
      const partialBadge = s.partial ? `<span style="font-size:9px;background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:4px;padding:1px 5px;font-family:'Space Mono',monospace;">PARCIAL</span>` : '';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);border-left:3px solid ${s.partial?'#fbbf24':'var(--accent)'};">
        <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);font-weight:700;flex-shrink:0;padding-top:1px;">#${num}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">${s.subject} ${partialBadge}</div>
          ${s.taskTitle && !s.taskTitle.includes('Sin tarea') ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">📋 ${s.taskTitle.replace(/^[^\s]+ /,'').split(' · ')[0].substring(0,40)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${s.time} · ${s.mins||25} min enfocado</div>
        </div>
        <div style="font-size:18px;">${s.partial ? '⏳' : '✅'}</div>
      </div>`;
    }).join('');
  }
  // Update stats
  const totalEl = document.getElementById('pom-stat-total');
  const minsEl  = document.getElementById('pom-stat-mins');
  if (totalEl) totalEl.textContent = sess.length;
  if (minsEl)  minsEl.textContent  = sess.reduce((a,s) => a + (s.mins||25), 0);
  renderPomGoal();
}

function renderPomGoal() {
  const goal = parseInt(document.getElementById('pom-goal')?.value) || 4;
  const done = State.pomSessions.length;
  const pct  = Math.min((done / goal) * 100, 100);
  const doneEl  = document.getElementById('pom-goal-done');
  const barEl   = document.getElementById('pom-goal-bar');
  const labelEl = document.getElementById('pom-goal-label');
  const streakEl = document.getElementById('pom-stat-streak');
  if (doneEl)  doneEl.textContent  = done;
  if (barEl)   barEl.style.width   = pct + '%';
  if (barEl)   barEl.style.background = pct >= 100 ? '#4ade80' : 'var(--accent2)';
  if (labelEl) labelEl.textContent = pct >= 100
    ? `🎉 ¡Meta alcanzada! ${done} sesiones hoy`
    : `${done} de ${goal} sesiones · ${Math.round(pct)}%`;
  // Streak
  if (streakEl) {
    const sd = typeof _getStreakData === 'function' ? _getStreakData() : {count:0};
    streakEl.textContent = `🔥 ${sd.count}`;
  }
  // Week stats
  _renderPomWeekStats();
}

function _getPomWeekHistory() {
  try { return JSON.parse(localStorage.getItem('academia_pom_week') || '[]'); } catch(e) { return []; }
}
function _savePomWeekHistory(arr) {
  try { localStorage.setItem('academia_pom_week', JSON.stringify(arr)); } catch(e) {} 
}
function _recordPomWeekSession(mins) {
  const arr = _getPomWeekHistory();
  const today = new Date().toISOString().slice(0,10);
  arr.push({ date: today, mins: mins || 0 });
  // Keep last 60 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const cutStr = cutoff.toISOString().slice(0,10);
  _savePomWeekHistory(arr.filter(s => s.date >= cutStr));
}
function _renderPomWeekStats() {
  const arr = _getPomWeekHistory();
  const today = new Date();
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6-i));
    return d.toISOString().slice(0,10);
  });
  const weekSessions = arr.filter(s => days.includes(s.date));
  const weekMins = weekSessions.reduce((a,s) => a + (s.mins||0), 0);
  const wsEl = document.getElementById('pom-stat-week-sessions');
  const wmEl = document.getElementById('pom-stat-week-mins');
  if (wsEl) wsEl.textContent = weekSessions.length;
  if (wmEl) wmEl.textContent = weekMins;
  // Mini bar chart
  const barsEl = document.getElementById('pom-week-bars');
  if (barsEl) {
    const maxMins = Math.max(1, ...days.map(d => arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0)));
    const dayNames = ['D','L','M','X','J','V','S'];
    barsEl.innerHTML = days.map(d => {
      const mins = arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0);
      const h = Math.round((mins / maxMins) * 36) || 2;
      const isToday = d === today.toISOString().slice(0,10);
      const dd = new Date(d); const dayIdx = dd.getDay();
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
        <div title="${mins} min" style="width:100%;height:${h}px;background:${isToday?'var(--accent2)':'var(--accent)'};border-radius:3px 3px 0 0;opacity:${mins>0?1:0.2};min-height:2px;"></div>
        <div style="font-size:8px;color:${isToday?'var(--accent2)':'var(--text3)'};font-family:'Space Mono',monospace;">${dayNames[dayIdx]}</div>
      </div>`;
    }).join('');
  }
}

function pomSavePartial() {
  const totalWork = pomWork();
  const elapsed = pomB ? totalWork : (totalWork - pomSL);
  if (elapsed < 60) { alert('Debes estudiar al menos 1 minuto para guardar.'); return; }
  const mins = Math.round(elapsed / 60);
  const subj = document.getElementById('pom-subject')?.value;
  const m    = getMat(subj);
  State.pomSessions.push({
    subject: m.name || subj || 'General',
    time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
    taskId: document.getElementById('pom-task-sel')?.value || '',
    taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
    mins, partial: true
  });
  _recordPomWeekSession(mins);
  _updateStreak(); // fix racha
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomReset();
  // Stop chrono if synced
  if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  if (typeof chronoR !== 'undefined' && chronoR) {
    chronoR = false;
    if (chronoI) { clearInterval(chronoI); chronoI=null; }
    const btn = document.getElementById('chrono-btn');
    if (btn) btn.textContent = '▶ Iniciar';
    const badge = document.getElementById('chrono-mode-badge');
    if (badge) badge.textContent = 'GUARDADO';
    if (typeof _chronoUpdateUI !== 'undefined') _chronoUpdateUI();
  }
  savePom(); renderPomHistory(); renderPomGoal();
  alert(`✅ Sesión parcial guardada: ${mins} min de estudio`);
}

function clearPomHistory() {
  if (!confirm('¿Limpiar historial de sesiones de hoy?')) return;
  State.pomSessions = [];
  savePom();
  renderPomHistory();
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
function closeModal(id) { _uiClick('modal-close'); document.getElementById(id)?.classList.remove('open'); }

function _getGreeting() {
  const h = new Date().getHours();
  // Obtener nombre del usuario autenticado (Google) o fallback
  const userName = window._currentUserName || State.settings?.profile?.name?.split(' ')[0] || 'Ingeniero';
  const salud = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${salud}, ${userName} `;
}
