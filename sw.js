// 🌸 MONIE — Service Worker (mode hors-ligne / PWA)
// Stratégie : cache-first pour le "shell" de l'app (HTML/CSS/JS/icônes),
// réseau direct pour Supabase (données live jamais mises en cache).
// Bump la version du cache à chaque déploiement pour forcer la mise à jour.
const CACHE = 'monie-v3-117';
// Fichiers locaux (doivent tous être mis en cache)
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './favicon.svg',
  './icon-152.png',
  './icon-167.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
// Librairies CDN (best-effort : un échec ne bloque pas l'install) → offline complet
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS).catch(() => {}); // shell local
    // CDN en best-effort, chacun indépendamment
    await Promise.all(CDN.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Ne jamais mettre en cache les appels backend (Supabase Auth / DB / Storage)
  if (url.hostname.includes('supabase')) return;

  // Code de l'app (HTML/CSS/JS local) = RÉSEAU D'ABORD → les mises à jour s'appliquent tout de suite.
  // Le reste (icônes, CDN) = CACHE D'ABORD → rapide et hors-ligne.
  const isAppCode = url.origin === location.origin && /\.(html|js|css)$|\/$/.test(url.pathname);

  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (isAppCode) {
      // Réseau d'abord, cache en secours (hors-ligne)
      try {
        const res = await fetch(req);
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      } catch (err) {
        return cached || caches.match('./index.html');
      }
    }
    // Cache d'abord pour tout le reste
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    } catch (err) {
      return cached || caches.match('./index.html');
    }
  })());
});
