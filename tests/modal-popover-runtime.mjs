import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const dispatchSource = readFileSync(new URL('../interaction-deferred-dispatch.js', import.meta.url), 'utf8');
if (/addEventListener\(\s*['"]key(?:down|up)['"]/.test(dispatchSource) || /stopImmediatePropagation/.test(dispatchSource)) {
  throw new Error('Modal safety must not install a competing keyboard handler or stop core input propagation');
}
if (!/interaction\.action\s*=\s*modalSafeAction/.test(dispatchSource)) {
  throw new Error('Modal safety must wrap interaction actions instead of owning KeyE');
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);

// Use the same deterministic Pointer Lock shim as the established desktop
// navigation smoke test. Synchronous pointerlockchange delivery mirrors the
// observable browser state while keeping Chromium's headless DevTools channel
// responsive; the game dispatcher itself no longer relies on event ordering.
await page.addInitScript(() => {
  try {
    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get() { return this.__tvTestPointerLock || null; }
    });
    Element.prototype.requestPointerLock = function requestPointerLock() {
      document.__tvTestPointerLock = this;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    Document.prototype.exitPointerLock = function exitPointerLock() {
      this.__tvTestPointerLock = null;
      this.dispatchEvent(new Event('pointerlockchange'));
    };
  } catch {}
});

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const checkpoint = (label) => console.log(`[modal-popover] ${label}`);
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';

async function diagnostics() {
  return page.evaluate((selector) => {
    const nearest = window.ToonValley?.state?.nearestInteractable;
    return {
      pointerLocked: Boolean(document.pointerLockElement),
      gamePointerLocked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
      modalOpen: window.ToonValley?.state?.modalOpen,
      overlay: Boolean(document.querySelector(selector)),
      pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
      nearest: nearest?.prompt || null,
      nearestWrapped: Boolean(nearest?.action?.__toonValleyModalSafeWrapper),
      nearestHasOriginal: Boolean(nearest?.action?.__toonValleyOriginalAction),
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
    };
  }, modalSelector);
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
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found in ${area}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
    window.ToonValleyDeferredInteractionDispatch.scan();
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000 });
  await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.scan());
  const state = await diagnostics();
  console.log(`[modal-popover] ${prompt} preflight`, state);
  if (!state.nearestWrapped) throw new Error(`${prompt}: nearest interaction was not modal-safe wrapped ${JSON.stringify(state)}`);
}

async function openCurrentInteraction(label) {
  const before = await page.evaluate(() => ({
    schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
    dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount()
  }));
  const actionDuration = await page.evaluate(() => {
    const interaction = window.ToonValley.state.nearestInteractable;
    if (!interaction?.action) throw new Error('No current interaction action');
    const started = performance.now();
    interaction.action();
    return performance.now() - started;
  });
  if (actionDuration > 50) throw new Error(`${label}: wrapped interaction blocked synchronously for ${actionDuration}ms`);

  const immediate = await diagnostics();
  console.log(`[modal-popover] ${label} immediate`, immediate);
  if (immediate.dispatcher?.schedules <= before.schedules) {
    throw new Error(`${label}: modal wrapper did not schedule deferred dispatch ${JSON.stringify(immediate)}`);
  }

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
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    recursionGuard: window.ToonValleyDeferredInteractionDispatch.recursionGuard,
    observableUnlockPolling: window.ToonValleyDeferredInteractionDispatch.observableUnlockPolling
  }));
  if (!Object.values(capabilities).every(Boolean)) throw new Error(`Missing modal/input capabilities ${JSON.stringify(capabilities)}`);

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('game Pointer Lock state active');

  await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await openCurrentInteraction('furniture catalog');
  checkpoint('furniture catalog popover stable');
  await closeCurrentModal('furniture catalog');

  await moveToInteraction('generalStore', 'Browse counter');
  await requireGamePointerLock('store precondition');
  await openCurrentInteraction('general store counter');
  checkpoint('general store popover stable');
  await closeCurrentModal('general store counter');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { base: remoteURL || 'localhost', capabilities, final: await diagnostics() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
