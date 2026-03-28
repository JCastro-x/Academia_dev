// ═══════════════════════════════════════════════════════════════
// pom-worker.js — Timer en Web Worker (no se throttlea en background)
// El browser no limita setInterval dentro de Workers.
// ═══════════════════════════════════════════════════════════════

let _interval = null;
let _endTime  = 0;

self.onmessage = function(e) {
  const { type, endTime } = e.data;

  if (type === 'START') {
    _endTime = endTime;
    if (_interval) clearInterval(_interval);
    _interval = setInterval(() => {
      const remaining = Math.round((_endTime - Date.now()) / 1000);
      self.postMessage({ type: 'TICK', remaining: Math.max(0, remaining) });
      if (remaining <= 0) {
        clearInterval(_interval);
        _interval = null;
        self.postMessage({ type: 'DONE' });
      }
    }, 500); // 500ms para mayor precisión, sin costo extra en worker
  }

  else if (type === 'PAUSE') {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  else if (type === 'STOP') {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }
};
