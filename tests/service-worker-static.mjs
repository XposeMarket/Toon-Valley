import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const guard = fs.readFileSync('pointer-capture-guard.js', 'utf8');
const preflight = fs.readFileSync('interaction-input-preflight.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const life = fs.readFileSync('life.js', 'utf8');
const game = fs.readFileSync('game.js', 'utf8');

const requiredSW = [
  "const CACHE_NAME = 'toon-valley-v34'",
  "'./interaction-input-preflight.js'",
  'async function networkFirst(request)',
  "event.request.mode === 'navigate'",
  'Promise.allSettled(CORE.map((url) => cache.add(url)))',
  'const hadPriorRelease = oldReleaseCaches.length > 0',
  'if (hadPriorRelease)',
  'client.navigate(client.url)'
];
for (const snippet of requiredSW) if (!sw.includes(snippet)) throw new Error(`Service-worker freshness invariant missing: ${snippet}`);
if (/cached\s*\|\|\s*network/.test(sw)) throw new Error('Release-critical service-worker path regressed to cache-first');
if (sw.includes('TOON_VALLEY_UPDATE_READY')) throw new Error('Fresh service-worker activation must not broadcast a reload signal');
const guardIndex = sw.indexOf('if (hadPriorRelease)');
const navigateIndex = sw.indexOf('client.navigate(client.url)');
if (guardIndex < 0 || navigateIndex < guardIndex) throw new Error('Stale-client navigation must be guarded by prior-release detection');

const requiredGuard = [
  'explicitResumeAfterModal: true',
  'modalPauseSuppression: true',
  'nativeModalLifecycle: true',
  'modalUnlocksSuppressed',
  'revealResumeAfterModal',
  "document.addEventListener('pointerlockchange'",
  'queueMicrotask(hidePause)',
  'new MutationObserver',
  'modalVisible: modalUIVisible',
  'armResumeAfterModal',
  'resumePending: () => resumeAfterModal',
  'suppressedModalUnlocks: () => modalUnlocksSuppressed'
];
for (const snippet of requiredGuard) if (!guard.includes(snippet)) throw new Error(`Popover input invariant missing: ${snippet}`);
if (guard.includes('stopImmediatePropagation')) throw new Error('Modal pointer-lock guard must not synchronously cancel pointerlockchange');
if (guard.includes('Document.prototype.exitPointerLock')) throw new Error('Popover guard must not monkey-patch Pointer Lock APIs');

const requiredPreflight = [
  "event.code !== 'KeyE'",
  'event.stopImmediatePropagation()',
  'document.exitPointerLock',
  'interaction.action?.()',
  'setTimeout(relockPhysicalInteraction, 0)',
  'armResumeAfterModal',
  'physicalRelockCount',
  'uiOpenCount'
];
for (const snippet of requiredPreflight) if (!preflight.includes(snippet)) throw new Error(`Desktop interaction preflight invariant missing: ${snippet}`);
if (!index.includes('<script src="pointer-capture-guard.js"></script><script src="interaction-input-preflight.js"></script><script src="ui-layer-fix.js"></script>')) throw new Error('Interaction preflight must load immediately after the pointer guard');

const modalStateIndex = life.indexOf('TV.setModalOpen(true)');
const modalExitIndex = life.indexOf('document.exitPointerLock()', modalStateIndex);
if (modalStateIndex < 0 || modalExitIndex < modalStateIndex) throw new Error('Life modal must mark modalOpen before its fallback Pointer Lock release');
if (!game.includes("if (event.code === 'KeyE' && !event.repeat) interact();")) throw new Error('Core desktop E route must remain available behind the capture-phase preflight');
if (!game.includes('if (nearest.action) nearest.action();')) throw new Error('Core interact() action execution must remain unchanged behind the capture-phase preflight');

console.log('Toon Valley service-worker v34, desktop interaction preflight, and non-blocking modal lifecycle invariants passed.');
