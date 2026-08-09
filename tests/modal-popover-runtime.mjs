import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);

// Native Pointer Lock is covered by the desktop browser smoke suite. Xvfb can
// deadlock Chromium's DevTools connection while real Pointer Lock is held, so this
// focused regression supplies the state transition deterministically while driving
// the game's real core KeyE handler with native Playwright keyboard input.
await page.addInitScript(() => {
  let lockedElement = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return lockedElement; }
  });
  Element.prototype.requestPointerLock = function requestPointerLock() {
    lockedElement = this;
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function exitPointerLock() {
    lockedElement = null;
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
  };
});

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const checkpoint = (label) => console.log(`[modal-popover] ${label}`);
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';

async function diagnostics() {
  return page.evaluate((selector) => ({
    pointerLocked: Boolean(document.pointerLockElement),
    gamePointerLocked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
    modalOpen: window.ToonValley?.state?.modalOpen,
    overlay: Boolean(document.querySelector(selector)),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    nearest: window.ToonValley?.state?.nearestInteractable?.prompt || null,
    area: window.ToonValley?.state?.area,
    modalVisible: window.ToonValleyPointerGuard?.modalVisible?.(),
    resumePending: window.ToonValleyPointerGuard?.resumePending?.(),
    suppressedUnlocks: window.ToonValleyPointerGuard?.suppressedModalUnlocks?.(),
    dispatcher: window.ToonValleyDeferredInteractionDispatch ? {
      pending: window.ToonValleyDeferredInteractionDispatch.pending(),
      wrapped: window.ToonValleyDeferredInteractionDispatch.wrappedCount(),
      schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
      attempts: window.ToonValleyDeferredInteractionDispatch.attemptCount(),
      dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount(),
      lastPrompt: window.ToonValleyDeferredInteractionDispatch.lastPrompt(),
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError(),
      lastDrop: window.ToonValleyDeferredInteractionDispatch.lastDrop()
    } : null
  }), modalSelector);
}

async function requireGamePointerLock(label) {
  await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 6000 });
  const state = await diagnostics();
  if (!state.gamePointerLocked) throw new Error(`${label}: game Pointer Lock was not active ${JSON.stringify(state)}`);
}

async function moveToInteraction(area, prompt) {
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    window.ToonValleyDeferredInteractionDispatch.scan();
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found in ${area}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000 });
}

async function openNearestWithE(label) {
  const before = await page.evaluate(() => ({
    schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
    dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount()
  }));
  const started = Date.now();
  await page.keyboard.press('e');
  const eventDuration = Date.now() - started;
  if (eventDuration > 1500) throw new Error(`${label}: core E event stack blocked for ${eventDuration}ms`);

  await page.waitForFunction((previous) => window.ToonValleyDeferredInteractionDispatch.scheduleCount() > previous, before.schedules, { timeout: 4000 });
  await page.waitForFunction((previous) => window.ToonValleyDeferredInteractionDispatch.dispatchCount() > previous, before.dispatches, { timeout: 4000 });
  await page.waitForFunction((selector) => Boolean(document.querySelector(selector)) && window.ToonValley.state.modalOpen === true, modalSelector, { timeout: 4000 });
  await page.waitForFunction(() => !document.pointerLockElement, null, { timeout: 4000 });
  const state = await diagnostics();
  console.log(`[modal-popover] ${label} opened`, state);
  if (!state.dispatcher || state.dispatcher.wrapped < 2 || state.dispatcher.schedules <= before.schedules || state.dispatcher.attempts < 1 || state.dispatcher.dispatches <= before.dispatches || state.dispatcher.lastError || state.dispatcher.lastDrop) {
    throw new Error(`${label}: modal-safe action regression ${JSON.stringify(state)}`);
  }
  if (!state.modalOpen || !state.overlay || !state.pauseHidden || state.pointerLocked || !state.modalVisible || !state.resumePending || state.suppressedUnlocks < 1) {
    throw new Error(`${label}: modal Pointer Lock regression ${JSON.stringify(state)}`);
  }
}

async function closeCurrentModal(label) {
  await page.locator('.life-close,[data-close]').first().click();
  await page.waitForFunction((selector) => !document.querySelector(selector) && window.ToonValley.state.modalOpen === false, modalSelector, { timeout: 6000 });
  await page.waitForFunction(() => !document.getElementById('pause-screen').classList.contains('hidden'), null, { timeout: 6000 });
  await page.click('#resume-button');
  await requireGamePointerLock(`${label} resume`);
  if (!(await page.evaluate(() => document.getElementById('pause-screen').classList.contains('hidden')))) throw new Error(`${label}: pause overlay remained after Resume`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  checkpoint('game globals ready with deterministic Pointer Lock lifecycle');

  const capabilities = await page.evaluate(() => ({
    nativeModalExit: window.ToonValleyPointerGuard.nativeModalExit,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    singleCoreKeyHandler: window.ToonValleyDeferredInteractionDispatch.singleCoreKeyHandler,
    actionWrapperArchitecture: window.ToonValleyDeferredInteractionDispatch.actionWrapperArchitecture,
    executesAfterKeyboardEvent: window.ToonValleyDeferredInteractionDispatch.executesAfterKeyboardEvent,
    releasesPointerLockBeforeUI: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockBeforeUI,
    releasesPointerLockAfterKeyEvent: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockAfterKeyEvent,
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath
  }));
  if (!Object.values(capabilities).every(Boolean)) throw new Error(`Missing modal/input capabilities ${JSON.stringify(capabilities)}`);

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('game Pointer Lock state active');

  await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await openNearestWithE('furniture catalog');
  checkpoint('furniture catalog popover stable');
  await closeCurrentModal('furniture catalog');

  const beforeMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('w'); await wait(450); await page.keyboard.up('w');
  const afterMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) < 0.25) throw new Error(`Gameplay did not resume after popover ${JSON.stringify({ beforeMove, afterMove })}`);
  checkpoint('WASD movement resumed');

  await moveToInteraction('generalStore', 'Browse counter');
  await requireGamePointerLock('store precondition');
  await openNearestWithE('general store counter');
  checkpoint('general store popover stable');
  await closeCurrentModal('general store counter');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { base: remoteURL || 'localhost', capabilities, final: await diagnostics() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
