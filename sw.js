'use strict';
const CACHE_NAME = 'toon-valley-v36';
// Keep a release inventory for static audits and future offline tooling, but do
// not synchronously pre-cache it. Production can serve an immutable SHA-pinned
// shell whose game assets are external, so cache.addAll(KNOWN_ASSETS) would make
// service-worker installation fail when shell-local copies are intentionally absent.
const KNOWN_ASSETS = ['./','./index.html','./style.css','./life.css','./game.js','./life.js','./pointer-capture-guard.js','./interaction-deferred-dispatch.js','./ui-layer-fix.js','./world-events.js','./town-activities.js','./valley-services.js','./valley-routines.js','./central-plaza.js','./central-plaza-core.js','./public-interiors.js','./moonbeam-theater.js','./owned-home.js','./world-polish.js','./bluebell-lake.js','./interaction-world-fix.js','./valley-transit.js','./community-garden.js','./community-state-safety.js','./valley-community-life.js','./community-objectives.js','./mountain-trail-life.js','./living-interiors.js','./navigation-polish.js','./side-quest-overhaul.js','./side-quest-routine-bridge.js','./neighborhood-quests.js','./civic-quests.js','./town-service-quests.js','./indoor-service-quests.js','./side-quest-ui.js','./community-service-routes.js','./interaction-experience.js','./swing-exit-fix.js','./npc-building-life.js','./mobile-polish.js','./camera-experience-polish.js','./movement-speed-polish.js','./manifest.webmanifest','./icon.svg','https://cdnjs.cloudflare.com/ajax/libs/three.js/0.152.2/three.min.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestURL = new URL(event.request.url);
  const sameOrigin = requestURL.origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response?.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response?.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
