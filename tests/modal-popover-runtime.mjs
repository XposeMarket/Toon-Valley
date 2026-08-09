import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const dispatchSource = readFileSync(new URL('../interaction-deferred-dispatch.js', import.meta.url), 'utf8');
if (!/addEventListener\(\s*['"]keydown['"]/.test(dispatchSource) || !/stopImmediatePropagation/.test(dispatchSource)) {
  throw new Error('Modal safety must own capture-phase KeyE for modal interactions');
}
if (!/opensModalUI\(interaction\)/.test(dispatchSource) || !/preservesPhysicalActionPath:\s*true/.test(dispatchSource)) {
  throw new Error('Modal interception must stay limited to modal-opening interactions');
}
if (/interaction\.action\s*=/.test(dispatchSource)) {
  throw new Error('Modal safety must not mutate registered interaction actions');
}
if (/pausedByVisibility\s*=\s*true|style\.display\s*=\s*['"]none['"]/.test(dispatchSource)) {
  throw new Error('Modal dispatch must not freeze the game loop or remove the WebGL surface');
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('crash', () => errors.push('page crash: Chromium renderer process crashed'));

const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild';

async function diagnostics() {
  return page.evaluate((selector) => ({
    pointerLocked: Boolean(document.pointerLockElement),
    gamePointerLocked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
    modalOpen: window.ToonValley?.state?.modalOpen,
    renderPaused: window.ToonValley?.state?.pausedByVisibility,
    overlay: Boolean(document.querySelector(selector)),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    modalVisible: window.ToonValleyPointerGuard?.modalVisible?.(),
    resumePending: window.ToonValleyPointerGuard?.resumePending?.(),
    suppressedUnlocks: window.ToonValleyPointerGuard?.suppressedModalUnlocks?.(),
    dispatcher: window.ToonValleyDeferredInteractionDispatch ? {
      pending: window.ToonValleyDeferredInteractionDispatch.pending(),
      interceptions: window.ToonValleyDeferredInteractionDispatch.interceptionCount(),
      schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
      attempts: window.ToonValleyDeferredInteractionDispatch.attemptCount(),
      dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount(),
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError(),
      lastDrop: window.ToonValleyDeferredInteractionDispatch.lastDrop()
    } : null
  }), modalSelector);
}

async function requirePointerLock(label) {
  try {
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 2500, polling: 50 });
  } catch {
    await page.locator('#game canvas').click({ position: { x: 640, y: 380 }, noWaitAfter: true });
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 4000, polling: 50 });
  }
  const state = await diagnostics();
  if (!state.gamePointerLocked) throw new Error(`${label}: game Pointer Lock not active ${JSON.stringify(state)}`);
}

async function moveTo(area, prompt) {
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000, polling: 50 });
}

async function openModalInteraction(label) {
  const before = await page.evaluate(() => ({
    interceptions: window.ToonValleyDeferredInteractionDispatch.interceptionCount(),
    schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
    dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount()
  }));

  // Playwright's keyboard transport itself can deadlock Chromium while Pointer Lock
  // is active. Dispatch the DOM event inside the real browser instead; Pointer Lock,
  // pointerlockchange, rendering, modal construction, and resume remain fully real.
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      code: 'KeyE', key: 'e', bubbles: true, cancelable: true, repeat: false
    }));
  });

  await page.waitForFunction((previous) => {
    const d = window.ToonValleyDeferredInteractionDispatch;
    return d.interceptionCount() > previous.interceptions && d.scheduleCount() > previous.schedules;
  }, before, { timeout: 4000, polling: 50 });
  await page.waitForFunction((selector) => window.ToonValley.state.modalOpen && Boolean(document.querySelector(selector)), modalSelector, { timeout: 6000, polling: 50 });

  const state = await diagnostics();
  if (!state.dispatcher || state.dispatcher.dispatches <= before.dispatches || state.dispatcher.attempts < 1 || state.dispatcher.lastError || state.dispatcher.lastDrop) {
    throw new Error(`${label}: dispatcher regression ${JSON.stringify(state)}`);
  }
  if (!state.modalOpen || !state.overlay || state.pointerLocked || !state.pauseHidden || !state.modalVisible || !state.resumePending || state.suppressedUnlocks < 1 || state.renderPaused) {
    throw new Error(`${label}: modal lifecycle regression ${JSON.stringify(state)}`);
  }

  const frameA = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  await wait(250);
  const frameB = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  if (frameB <= frameA) throw new Error(`${label}: renderer stopped during modal (${frameA} -> ${frameB})`);

  const closed = await page.evaluate(() => {
    const button = document.querySelector('.life-close,[data-close],.mb-btn.close');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!closed) throw new Error(`${label}: modal close button missing`);
  await page.waitForFunction((selector) => !window.ToonValley.state.modalOpen && !document.querySelector(selector), modalSelector, { timeout: 4000, polling: 50 });

  const afterClose = await diagnostics();
  if (afterClose.modalOpen || afterClose.overlay || afterClose.pauseHidden || afterClose.renderPaused) {
    throw new Error(`${label}: explicit resume state not restored ${JSON.stringify(afterClose)}`);
  }

  await page.locator('#resume-button').click({ noWaitAfter: true });
  await requirePointerLock(`${label} resume`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000, polling: 50 });

  const capabilities = await page.evaluate(() => ({
    nativeModalExit: window.ToonValleyPointerGuard.nativeModalExit,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    keepsRenderWorkDuringModal: window.ToonValleyPointerGuard.keepsRenderWorkDuringModal,
    keepsWebGLSurfaceDuringModal: window.ToonValleyPointerGuard.keepsWebGLSurfaceDuringModal,
    capturePhaseModalKeyGuard: window.ToonValleyDeferredInteractionDispatch.capturePhaseModalKeyGuard,
    interceptsOnlyModalKeyE: window.ToonValleyDeferredInteractionDispatch.interceptsOnlyModalKeyE,
    releasesPointerLockBeforeUI: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockBeforeUI,
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    gpuSafePopoverCompositing: window.ToonValleyUILayerFix.gpuSafePopoverCompositing
  }));
  if (!Object.values(capabilities).every(Boolean)) throw new Error(`Missing modal capabilities ${JSON.stringify(capabilities)}`);

  if (await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({ prompt: 'Clear park litter' }))) {
    throw new Error('Physical quest interaction was classified as modal UI');
  }

  await page.click('#play-button', { noWaitAfter: true });
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requirePointerLock('initial play');

  await moveTo('furnitureStore', 'Browse furniture catalog');
  await requirePointerLock('furniture precondition');
  await openModalInteraction('furniture catalog');

  await moveTo('generalStore', 'Browse counter');
  await requirePointerLock('store precondition');
  await openModalInteraction('general store counter');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { base: remoteURL || 'localhost', final: await diagnostics() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
