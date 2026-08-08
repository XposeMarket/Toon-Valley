import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const guard = fs.readFileSync('pointer-capture-guard.js', 'utf8');

const requiredSW = [
  "const CACHE_NAME = 'toon-valley-v33'",
  'async function networkFirst(request)',
  "event.request.mode === 'navigate'",
  "client.postMessage({ type: 'TOON_VALLEY_UPDATE_READY'",
  'Promise.allSettled(CORE.map((url) => cache.add(url)))'
];
for (const snippet of requiredSW) {
  if (!sw.includes(snippet)) throw new Error(`Service-worker freshness invariant missing: ${snippet}`);
}
if (/cached\s*\|\|\s*network/.test(sw)) throw new Error('Release-critical service-worker path regressed to cache-first');
if (sw.includes('client.navigate(client.url)')) throw new Error('Service-worker activation must not navigate a loading client');

const requiredGuard = [
  'explicitResumeAfterModal: true',
  'modalPauseSuppression: true',
  'nativeExitPointerLock: true',
  'showResumeAfterFinalModal'
];
for (const snippet of requiredGuard) {
  if (!guard.includes(snippet)) throw new Error(`Popover input invariant missing: ${snippet}`);
}
if (guard.includes('requestPointerLock')) throw new Error('Popover close path must not request Pointer Lock from the closing dialog event');
if (guard.includes('stopImmediatePropagation')) throw new Error('Pointer-lock events must not be globally suppressed');
if (guard.includes('__toonValleyModalGuarded') || guard.includes('Document?.prototype') && guard.includes('exitPointerLock')) {
  throw new Error('Native Document.exitPointerLock must not be monkey-patched');
}

console.log('Toon Valley service-worker and popover input invariants passed.');
