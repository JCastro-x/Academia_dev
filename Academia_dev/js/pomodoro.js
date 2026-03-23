
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
