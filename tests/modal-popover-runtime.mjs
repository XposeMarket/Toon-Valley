import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const realPointerLock = process.env.REAL_POINTERLOCK === '1';
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const dispatchSource = readFileSync(new URL('../interaction-deferred-dispatch.js', import.meta.url), 'utf8');
const guardSource = readFileSync(new URL('../pointer-capture-guard.js', import.meta.url), 'utf8');
if (!/executesOnKeyup:\s*true/.test(dispatchSource)) throw new Error('Desktop interaction handoff must execute on KeyE keyup');
if (!/preservesPhysicalActionPath:\s*true/.test(dispatchSource)) throw new Error('Physical action path invariant missing');
if (/renderer\.render\s*=/.test(dispatchSource) || /exitPointerLock/.test(dispatchSource.replace(/nativePointerLockRelease/g, ''))) throw new Error('Desktop E dispatcher must not mutate rendering or release Pointer Lock itself');
if (/interaction\.action\s*=/.test(dispatchSource)) throw new Error('Desktop E safety must not replace registered interaction actions');
if (!/!gamePointerLocked\(\)/.test(guardSource)) throw new Error('Modal resume guard must only arm from genuine gameplay Pointer Lock');

const browser = await chromium.launch({
  headless: !realPointerLock,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.stack || e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('crash', () => errors.push('page crash'));
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';

async function snapshot() {
  return page.evaluate((selector) => ({
    locked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
    modalOpen: Boolean(window.ToonValley?.state?.modalOpen),
    overlay: Boolean(document.querySelector(selector)),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    resumePending: Boolean(window.ToonValleyPointerGuard?.resumePending?.()),
    frame: window.ToonValley?.renderer?.info?.render?.frame ?? -1,
    nearestPrompt: window.ToonValley?.state?.nearestInteractable?.prompt || null,
    dispatcher: window.ToonValleyDeferredInteractionDispatch ? {
      arms: window.ToonValleyDeferredInteractionDispatch.interceptionCount(),
      keyups: window.ToonValleyDeferredInteractionDispatch.keyupCount(),
      dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount(),
      modalDispatches: window.ToonValleyDeferredInteractionDispatch.modalDispatchCount(),
      pending: window.ToonValleyDeferredInteractionDispatch.pending(),
      lastPrompt: window.ToonValleyDeferredInteractionDispatch.lastPrompt(),
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError(),
      lastDrop: window.ToonValleyDeferredInteractionDispatch.lastDrop()
    } : null
  }), modalSelector);
}

async function lock(label) {
  if (!realPointerLock) return;
  if (await page.evaluate(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement)) return;
  await page.locator('#game canvas').click({ position: { x: 640, y: 380 }, noWaitAfter: true });
  await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 5000 });
  if (!(await snapshot()).locked) throw new Error(`${label}: Pointer Lock unavailable`);
}

async function move(area, prompt) {
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`Missing interaction ${prompt}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000 });
}

async function openWithE(label) {
  const before = await snapshot();
  if (realPointerLock && !before.locked) throw new Error(`${label}: expected Pointer Lock before E gesture ${JSON.stringify(before)}`);

  await page.keyboard.down('e');
  const armed = await snapshot();
  if (!armed.dispatcher?.pending || armed.dispatcher.arms <= before.dispatcher.arms || armed.dispatcher.dispatches !== before.dispatcher.dispatches) {
    throw new Error(`${label}: keydown did more than arm the interaction ${JSON.stringify({ before, armed })}`);
  }
  if (realPointerLock && !armed.locked) throw new Error(`${label}: keydown released Pointer Lock before dispatch`);

  await page.keyboard.up('e');
  await page.waitForFunction((selector) => window.ToonValley.state.modalOpen && Boolean(document.querySelector(selector)), modalSelector, { timeout: 7000 });
  if (realPointerLock) await page.waitForFunction(() => document.pointerLockElement !== window.ToonValley.renderer.domElement, null, { timeout: 5000 });
  const opened = await snapshot();
  if (!opened.modalOpen || !opened.overlay || !opened.pauseHidden) throw new Error(`${label}: unsafe modal open state ${JSON.stringify(opened)}`);
  if (realPointerLock && (opened.locked || !opened.resumePending)) throw new Error(`${label}: pointer-lock handoff did not arm explicit resume ${JSON.stringify(opened)}`);
  if (!realPointerLock && opened.resumePending) throw new Error(`${label}: unlocked modal incorrectly armed a resume gate ${JSON.stringify(opened)}`);
  if (!opened.dispatcher || opened.dispatcher.pending || opened.dispatcher.keyups <= before.dispatcher.keyups || opened.dispatcher.dispatches <= before.dispatcher.dispatches || opened.dispatcher.modalDispatches <= before.dispatcher.modalDispatches || opened.dispatcher.lastError || opened.dispatcher.lastDrop) {
    throw new Error(`${label}: dispatcher failed ${JSON.stringify(opened.dispatcher)}`);
  }

  const frameA = opened.frame;
  await wait(300);
  const frameB = (await snapshot()).frame;
  if (frameB <= frameA) throw new Error(`${label}: WebGL render loop stalled while modal was open ${frameA}->${frameB}`);
}

async function closeModal(label) {
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.life-close,[data-close],.mb-btn.close');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error(`${label}: close button missing`);
  await page.waitForFunction((selector) => !window.ToonValley.state.modalOpen && !document.querySelector(selector), modalSelector, { timeout: 5000 });
  const closed = await snapshot();
  if (closed.modalOpen || closed.overlay || closed.locked) throw new Error(`${label}: bad close state ${JSON.stringify(closed)}`);

  if (realPointerLock) {
    await page.waitForFunction(() => !document.getElementById('pause-screen').classList.contains('hidden'), null, { timeout: 5000 });
    await page.locator('#resume-button').click({ noWaitAfter: true });
    await lock(`${label} resume`);
    const resumed = await snapshot();
    if (!resumed.pauseHidden || !resumed.locked) throw new Error(`${label}: resume failed ${JSON.stringify(resumed)}`);
  } else if (!closed.pauseHidden || closed.resumePending) {
    throw new Error(`${label}: unlocked modal close invented a pause/resume state ${JSON.stringify(closed)}`);
  }
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  const caps = await page.evaluate(() => ({
    nativeExit: window.ToonValleyPointerGuard.nativeModalExit,
    suppressPause: window.ToonValleyPointerGuard.modalPauseSuppression,
    resume: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    keyup: window.ToonValleyDeferredInteractionDispatch.executesOnKeyup,
    nativeRelease: window.ToonValleyDeferredInteractionDispatch.nativePointerLockRelease,
    preserveActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservePhysical: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    gpuSafe: window.ToonValleyUILayerFix.gpuSafePopoverCompositing
  }));
  if (!Object.values(caps).every(Boolean)) throw new Error(`Missing modal safety capabilities ${JSON.stringify(caps)}`);
  if (await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({ prompt: 'Clear park litter' }))) throw new Error('Physical quest misclassified as modal UI');

  await page.click('#play-button', { noWaitAfter: true });
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await lock('initial');

  await move('furnitureStore', 'Browse furniture catalog');
  await lock('furniture');
  await openWithE('furniture');
  await closeModal('furniture');

  const beforeMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('w'); await wait(450); await page.keyboard.up('w');
  const afterMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) < 0.2) throw new Error(`Gameplay movement did not recover after modal ${JSON.stringify({ beforeMove, afterMove })}`);

  await move('generalStore', 'Browse counter');
  await lock('store');
  await openWithE('store');
  await closeModal('store');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { realPointerLock, caps, final: await snapshot() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
