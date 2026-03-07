const CACHE = 'studyspace-v1';
const STATIC = ['/index.html', '/app.html', '/css/style.css',
  '/js/auth.js', '/js/db.js', '/js/app.js',
  '/js/chat.js', '/js/notes.js', '/js/tasks.js', '/js/files.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Network-first: HTML/JS/CSS siempre desde red
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Imagenes: cache-first
  if (/\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  // Todo lo demás: network-first
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
