import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const guard = fs.readFileSync('pointer-capture-guard.js', 'utf8');

const requiredSW = [
  "const CACHE_NAME = 'toon-valley-v33'",
  'async function networkFirst(request)',
  "event.request.mode === 'navigate'",
  'Promise.allSettled(CORE.map((url) => cache.add(url)))',
  'const hadPriorRelease = oldReleaseCaches.length > 0',
  'if (hadPriorRelease)',
  'client.navigate(client.url)'
];
for (const snippet of requiredSW) {
  if (!sw.includes(snippet)) throw new Error(`Service-worker freshness invariant missing: ${snippet}`);
}
if (/cached\s*\|\|\s*network/.test(sw)) throw new Error('Release-critical service-worker path regressed to cache-first');
if (sw.includes('TOON_VALLEY_UPDATE_READY')) throw new Error('Fresh service-worker activation must not broadcast a reload signal');
const guardIndex = sw.indexOf('if (hadPriorRelease)');
const navigateIndex = sw.indexOf('client.navigate(client.url)');
if (guardIndex < 0 || navigateIndex < guardIndex) throw new Error('Stale-client navigation must be guarded by prior-release detection');

const requiredGuard = [
  'explicitResumeAfterModal: true',
  'modalPauseSuppression: true',
  'modalInteractionPreflight: true',
  'preflightModalInteraction',
  'pendingInteraction',
  'runPendingInteraction',
  "event.code !== 'KeyE'",
  '/^Talk to /',
  'modalExitDeferred',
  '__toonValleyDeferredModalExit',
  'showResumeAfterFinalModal'
];
for (const snippet of requiredGuard) {
  if (!guard.includes(snippet)) throw new Error(`Popover input invariant missing: ${snippet}`);
}
if (guard.includes('requestPointerLock')) throw new Error('Popover close path must not request Pointer Lock from the closing dialog event');
if (guard.includes('stopImmediatePropagation')) throw new Error('Popover guard must not globally suppress other input listeners');
if (!guard.includes("if (window.ToonValley?.state?.modalOpen)")) throw new Error('Fallback deferred Pointer Lock exit must be scoped to active modal UI');
if (!guard.includes("window.addEventListener('keydown', preflightModalInteraction, true)")) throw new Error('Modal E preflight must run before the core document interaction handler');

console.log('Toon Valley service-worker stale-upgrade and popover preflight invariants passed.');
