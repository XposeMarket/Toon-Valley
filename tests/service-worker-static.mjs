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
  'modalExitDeferred',
  '__toonValleyModalExitGuard',
  'preflightUIInteraction',
  'interactionOpensModal',
  "event.code !== 'KeyE'",
  'interactionPreflight = true',
  'nativeExitPointerLock?.call(document)',
  'const action = item.action',
  'releaseModalPointerLock',
  'releaseQueued',
  'setTimeout(() =>',
  'revealResumeAfterModal',
  "document.addEventListener('pointerlockchange'",
  'event.stopImmediatePropagation()',
  'new MutationObserver',
  'modalVisible: modalUIVisible',
  'resumePending: () => resumeAfterModal',
  'preflightActive: () => interactionPreflight'
];
for (const snippet of requiredGuard) {
  if (!guard.includes(snippet)) throw new Error(`Popover input invariant missing: ${snippet}`);
}
if (guard.includes('pendingInteraction') || guard.includes('requestPointerLock')) {
  throw new Error('Popover guard must not replay queued physical interactions or reacquire Pointer Lock from dialog-close events');
}
if (guard.includes('__toonValleyDeferredModalExit') || guard.includes('modalExitTimer')) {
  throw new Error('Popover Pointer Lock release must use the shared deferred release queue, not a duplicate legacy timer path');
}
if (!guard.includes("/^Talk to /.test(prompt)")) throw new Error('NPC talk popovers must be classified for safe Pointer Lock preflight');
if (!guard.includes('if (!interactionOpensModal(item)) return false')) throw new Error('Physical interactions must bypass modal preflight');
if (!guard.includes('if (interactionPreflight || TV.state.modalOpen || modalUIVisible())')) throw new Error('Pause suppression must include the pre-modal Pointer Lock release window');
if (!guard.includes("if (window.ToonValley?.state?.modalOpen)")) throw new Error('Programmatic modal Pointer Lock exit must remain scoped to active modal UI');
if (!guard.includes('nativeExitPointerLock?.call(doc)')) throw new Error('Deferred programmatic modal release must execute the captured native exit');
if (!guard.includes('return nativeExitPointerLock.call(this)')) throw new Error('Ordinary non-modal Pointer Lock exits must remain native and synchronous');

console.log('Toon Valley service-worker stale-upgrade and shared modal lifecycle invariants passed.');
