'use strict';

const CACHE_NAME = 'toon-valley-v33';
const CORE = [
  './', './index.html', './style.css', './life.css', './game.js', './life.js',
  './pointer-capture-guard.js', './ui-layer-fix.js', './world-events.js', './town-activities.js',
  './valley-services.js', './valley-routines.js', './central-plaza.js', './central-plaza-core.js',
  './public-interiors.js', './moonbeam-theater.js', './owned-home.js', './world-polish.js',
  './bluebell-lake.js', './interaction-world-fix.js', './valley-transit.js', './community-garden.js',
  './valley-community-life.js', './living-interiors.js', './navigation-polish.js', './side-quest-overhaul.js',
  './side-quest-routine-bridge.js', './neighborhood-quests.js', './civic-quests.js', './town-service-quests.js',
  './indoor-service-quests.js', './side-quest-ui.js', './interaction-experience.js', './swing-exit-fix.js',
  './npc-building-life.js', './mobile-polish.js', './camera-experience-polish.js', './movement-speed-polish.js',
  './manifest.webmanifest', './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.152.2/three.min.js'
];

async function putIfCacheable(cache, request, response) {
  if (!response || !response.ok) return response;
  try { await cache.put(request, response.clone()); } catch (_) { /* opaque/cross-origin may not be cacheable */ }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    return await putIfCacheable(cache, request, await fetch(request));
  } catch (_) {
    return (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('./index.html') : undefined) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  return putIfCacheable(await caches.open(CACHE_NAME), request, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // One unavailable optional CDN asset must never prevent a hotfix worker from
    // installing and replacing a stale game shell.
    await Promise.allSettled(CORE.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('toon-valley-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'TOON_VALLEY_UPDATE_READY', cache: CACHE_NAME });
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const releaseCritical = event.request.mode === 'navigate' || (sameOrigin && /\.(?:html?|js|css|webmanifest)$/i.test(url.pathname));

  // Navigation and executable release assets always prefer the network so a new
  // deployment cannot be shadowed by yesterday's cached code. Offline play still
  // falls back to the last verified cache. Images/immutable CDN assets stay fast.
  event.respondWith(releaseCritical ? networkFirst(event.request) : cacheFirst(event.request));
});
