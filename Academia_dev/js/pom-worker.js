// ═══════════════════════════════════════════════════════════════
// pom-worker.js — Timer en Web Worker (no se throttlea en background)
// Usa timestamps absolutos — inmune a throttling del interval
// ═══════════════════════════════════════════════════════════════

let _interval  = null;
let _endTime   = 0;
let _lastTick  = 0;

self.onmessage = function(e) {
  const { type, endTime } = e.data;

  if (type === 'START') {
    _endTime  = endTime;
    _lastTick = Date.now();

    if (_interval) clearInterval(_interval);

    _interval = setInterval(() => {
      const now       = Date.now();
      const remaining = Math.round((_endTime - now) / 1000);

      // Detectar si el interval fue throttleado (lag > 3s entre ticks)
      const lag = now - _lastTick;
      if (lag > 3000) {
        self.postMessage({ type: 'LAG_DETECTED', lag });
      }
      _lastTick = now;

      // Siempre enviar el tiempo real calculado desde el timestamp absoluto
      self.postMessage({ type: 'TICK', remaining: Math.max(0, remaining) });

      if (remaining <= 0) {
        clearInterval(_interval);
        _interval = null;
        self.postMessage({ type: 'DONE' });
      }
    }, 500);
  }

  else if (type === 'PAUSE') {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  else if (type === 'STOP') {
    if (_interval) { clearInterval(_interval); _interval = null; }
    _endTime  = 0;
    _lastTick = 0;
  }

  else if (type === 'PING') {
    // Health check — el main thread verifica que el worker siga vivo
    const remaining = _endTime > 0
      ? Math.round((_endTime - Date.now()) / 1000)
      : -1;
    self.postMessage({ type: 'PONG', remaining });
  }
};
