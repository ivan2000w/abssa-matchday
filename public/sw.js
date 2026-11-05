const BASE = new URL(self.registration.scope);
const PREFIX = `abssa-${BASE.pathname}-`;
const CACHE = `${PREFIX}__BUILD_ID__`;
const DATA = new URL('data/abssa.json', BASE).href;
const CORE = ['','manifest.webmanifest','icon.svg'].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isData = url.pathname === new URL(DATA).pathname;
    const key = isData ? DATA : event.request;
    try {
      const response = await fetch(event.request);
      if (isData) {
        if (!response.ok) throw new Error('Data unavailable');
        const body = await response.clone().json();
        if (body.sourceStatus !== 'verified' || !Array.isArray(body.matches) || !Array.isArray(body.standings)) throw new Error('Invalid data');
      }
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch {
      const cached = await cache.match(key);
      if (cached && isData) {
        const headers = new Headers(cached.headers); headers.set('x-abssa-offline', '1');
        return new Response(cached.body, {status: cached.status, headers});
      }
      if (cached) return cached;
      if (event.request.mode === 'navigate') return await cache.match(BASE.href) || Response.error();
      return Response.error();
    }
  })());
});
