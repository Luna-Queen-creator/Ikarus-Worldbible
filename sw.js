// Archive service worker: keeps the whole app available offline.
// When you upload a new version of the app, change VERSION so phones fetch the new files.
const VERSION = 'archive-v1';
const FONT_CACHE = 'archive-fonts';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/db.js',
  './js/editor.js',
  './js/model.js',
  './js/ui.js',
  './js/views/backup.js',
  './js/views/edit.js',
  './js/views/entry.js',
  './js/views/factions.js',
  './js/views/lists.js',
  './js/views/map.js',
  './js/views/parts.js',
  './js/views/search.js',
  './js/views/settings.js',
  './js/views/versus.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(fromShell(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fromFonts(req));
  }
});

async function fromShell(req) {
  const cache = await caches.open(VERSION);
  const isPage = req.mode === 'navigate';
  const hit = await cache.match(isPage ? './index.html' : req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && !isPage) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const shell = isPage ? await cache.match('./index.html') : null;
    if (shell) return shell;
    throw err;
  }
}

async function fromFonts(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Offline before the fonts were ever saved: the app falls back to system fonts.
    const isCss = req.url.includes('fonts.googleapis.com');
    return new Response('', { status: isCss ? 200 : 503, headers: { 'Content-Type': isCss ? 'text/css' : 'text/plain' } });
  }
}
