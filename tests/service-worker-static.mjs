import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const guard = fs.readFileSync('pointer-capture-guard.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const life = fs.readFileSync('life.js', 'utf8');
const game = fs.readFileSync('game.js', 'utf8');

const requiredSW = [
  "const CACHE_NAME = 'toon-valley-v35'",
  'async function networkFirst(request)',
  "event.request.mode === 'navigate'",
  'Promise.allSettled(CORE.map((url) => cache.add(url)))',
  'const hadPriorRelease = oldReleaseCaches.length > 0',
  'if (hadPriorRelease)',
  'client.navigate(client.url)'
];
for (const snippet of requiredSW) if (!sw.includes(snippet)) throw new Error(`Service-worker freshness invariant missing: ${snippet}`);
if (/cached\s*\|\|\s*network/.test(sw)) throw new Error('Release-critical service-worker path regressed to cache-first');
if (sw.includes('interaction-input-preflight.js')) throw new Error('Removed KeyE preflight script must not remain in the PWA cache');
if (sw.includes('TOON_VALLEY_UPDATE_READY')) throw new Error('Fresh service-worker activation must not broadcast a reload signal');
const guardIndex = sw.indexOf('if (hadPriorRelease)');
const navigateIndex = sw.indexOf('client.navigate(client.url)');
if (guardIndex < 0 || navigateIndex < guardIndex) throw new Error('Stale-client navigation must be guarded by prior-release detection');

const requiredGuard = [
  'explicitResumeAfterModal: true',
  'modalPauseSuppression: true',
  'nativePointerLockEvents: true',
  'modalExitDeferred',
  'safeExitPointerLock',
  'setTimeout(() =>',
  'revealResumeAfterModal',
  "document.addEventListener('pointerlockchange'",
  'queueMicrotask(hidePause)',
  'new MutationObserver',
  'modalVisible: modalUIVisible',
  'resumePending: () => resumeAfterModal',
  'suppressedModalUnlocks: () => modalUnlocksSuppressed'
];
for (const snippet of requiredGuard) if (!guard.includes(snippet)) throw new Error(`Popover input invariant missing: ${snippet}`);
if (guard.includes('stopImmediatePropagation')) throw new Error('Modal pointer-lock guard must not synchronously cancel pointerlockchange');
if (!guard.includes('documentProto.exitPointerLock = safeExitPointerLock')) throw new Error('Modal Pointer Lock release must be deferred outside active interaction dispatch');

if (index.includes('interaction-input-preflight.js')) throw new Error('Removed KeyE interception must not load in index.html');
if (!index.includes('<script src="life.js"></script><script src="pointer-capture-guard.js"></script><script src="ui-layer-fix.js"></script>')) throw new Error('Pointer guard must load directly after life.js and before UI extensions');

const modalStateIndex = life.indexOf('TV.setModalOpen(true)');
const modalExitIndex = life.indexOf('document.exitPointerLock()', modalStateIndex);
if (modalStateIndex < 0 || modalExitIndex < modalStateIndex) throw new Error('Life modal must mark modalOpen before Pointer Lock release');
if (!game.includes("if (event.code === 'KeyE' && !event.repeat) interact();")) throw new Error('Core desktop E route must remain authoritative');
if (!game.includes('if (nearest.action) nearest.action();')) throw new Error('Core interact() action execution must remain unchanged');

console.log('Toon Valley service-worker v35 and native modal Pointer Lock lifecycle invariants passed.');
