// Service worker of the UNSA PWA. The placeholders below are replaced at build time by
// src/integrations/pwa.mjs (version, base path and list of files to precache).
const VERSION = '__VERSION__';
const BASE = '__BASE__';
const PRECACHE = /*__PRECACHE__*/ [];

const STATIC_CACHE = `unsa-static-${VERSION}`;
const PREFS_CACHE = 'unsa-prefs';
const OFFLINE_PAGE = `${BASE}hors-ligne/`;
const ORIGIN = self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('unsa-static-') && n !== STATIC_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never intercept other origins (Apps Script API, Firebase) nor anything outside the site.
  if (url.origin !== ORIGIN || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request, url));
  } else if (url.pathname.startsWith(`${BASE}_astro/`)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function navigate(request, url) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch {
    const withSlash = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(withSlash)) ||
      (await cache.match(OFFLINE_PAGE)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit || (await refresh) || Response.error();
}

// Push: the payload is ignored on purpose. The notification text is always generic so that
// nothing about the documents (or the person) appears on a lock screen.
self.addEventListener('push', (event) => {
  event.waitUntil(showGenericNotification());
});

async function isDiscreet() {
  try {
    const cache = await caches.open(PREFS_CACHE);
    const response = await cache.match(`${BASE}__prefs`);
    const prefs = response ? await response.json() : {};
    return prefs.discreet === true;
  } catch {
    return false;
  }
}

async function showGenericNotification() {
  const discreet = await isDiscreet();
  const options = {
    body: discreet ? 'Ouvrez l’application pour le consulter.' : 'Nouveau contenu disponible.',
    tag: 'unsa-new-content',
    lang: 'fr',
    data: { url: `${BASE}documents/` },
  };
  if (!discreet) options.icon = `${BASE}img/icon-192.png`;
  await self.registration.showNotification(discreet ? 'Nouveau contenu' : 'UNSA', options);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || BASE, ORIGIN).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(`${ORIGIN}${BASE}`) && 'focus' in client) {
          const focused = await client.focus();
          if ('navigate' in focused) await focused.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
