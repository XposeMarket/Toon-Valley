import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);
const stage = (name, data = '') => console.log(`[modal-popover] ${name}`, data);

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
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';
let currentStage = 'boot';
const mark = (name, data = '') => { currentStage = name; stage(name, data); };
const watchdog = setTimeout(() => {
  console.error(`[modal-popover] watchdog at stage "${currentStage}": browser interaction stopped responding for 45 seconds`);
  process.exit(86);
}, 45000);

async function diagnostics() {
  return page.evaluate((selector) => {
    const nearest = window.ToonValley?.state?.nearestInteractable;
    return {
      pointerLocked: Boolean(document.pointerLockElement),
      gamePointerLocked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
      modalOpen: window.ToonValley?.state?.modalOpen,
      renderPaused: window.ToonValley?.state?.pausedByVisibility,
      webglSurfaceHidden: document.getElementById('game')?.style.display === 'none',
      overlay: Boolean(document.querySelector(selector)),
      closeButton: Boolean(document.querySelector('.life-close,[data-close],.mb-btn.close')),
      pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
      nearest: nearest?.prompt || null,
      area: window.ToonValley?.state?.area,
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
    };
  }, modalSelector);
}

async function requireGamePointerLock(label) {
  mark(`${label}: wait pointer lock`);
  try {
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 2500, polling: 50 });
  } catch {
    mark(`${label}: fallback canvas click`);
    await page.locator('#game canvas').click({ position: { x: 640, y: 380 }, timeout: 5000, noWaitAfter: true });
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 4000, polling: 50 });
  }
  const state = await diagnostics();
  if (!state.gamePointerLocked) throw new Error(`${label}: real game Pointer Lock was not active ${JSON.stringify(state)}`);
  mark(`${label}: pointer lock active`);
}

async function moveToInteraction(area, prompt) {
  mark(`${prompt}: move into range`);
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found in ${area}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000, polling: 50 });
  const state = await diagnostics();
  if (!state.nearest || state.nearest !== prompt) throw new Error(`${prompt}: nearest interaction did not settle ${JSON.stringify(state)}`);
  mark(`${prompt}: in range`);
}

async function openCurrentInteraction(label) {
  const before = await page.evaluate(() => ({
    interceptions: window.ToonValleyDeferredInteractionDispatch.interceptionCount(),
    schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
    dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount()
  }));
  mark(`${label}: fire trusted KeyE`, JSON.stringify(before));
  await page.keyboard.down('e');
  mark(`${label}: keydown returned`);
  await page.waitForFunction((previous) => {
    const d = window.ToonValleyDeferredInteractionDispatch;
    return d.interceptionCount() > previous.interceptions && d.scheduleCount() > previous.schedules;
  }, before, { timeout: 4000, polling: 50 });
  mark(`${label}: capture interception scheduled`);
  await page.waitForFunction((selector) => window.ToonValley.state.modalOpen && Boolean(document.querySelector(selector)), modalSelector, { timeout: 6000, polling: 50 });
  mark(`${label}: modal visible`);
  await page.keyboard.up('e');
  const state = await diagnostics();
  if (!state.dispatcher || state.dispatcher.interceptions <= before.interceptions || state.dispatcher.schedules <= before.schedules || state.dispatcher.attempts < 1 || state.dispatcher.dispatches <= before.dispatches || state.dispatcher.lastError || state.dispatcher.lastDrop) {
    throw new Error(`${label}: modal handoff regression ${JSON.stringify(state)}`);
  }
  if (!state.modalOpen || state.renderPaused || state.webglSurfaceHidden || !state.overlay || !state.closeButton || !state.pauseHidden || state.pointerLocked || !state.modalVisible || !state.resumePending || state.suppressedUnlocks < 1) {
    throw new Error(`${label}: modal Pointer Lock/live-render regression ${JSON.stringify(state)}`);
  }
  const frameA = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  await wait(250);
  const frameB = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  if (frameB <= frameA) throw new Error(`${label}: renderer stopped advancing while modal was open (${frameA} -> ${frameB})`);
  mark(`${label}: renderer live in modal`, `${frameA}->${frameB}`);
}

async function closeCurrentModal(label) {
  mark(`${label}: close modal`);
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.life-close,[data-close],.mb-btn.close');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error(`${label}: close button disappeared before handoff`);
  await page.waitForFunction((selector) => !window.ToonValley.state.modalOpen && !document.querySelector(selector), modalSelector, { timeout: 4000, polling: 50 });
  const closed = await diagnostics();
  if (closed.overlay || closed.modalOpen || closed.renderPaused || closed.webglSurfaceHidden || closed.pauseHidden) {
    throw new Error(`${label}: modal did not restore resume state ${JSON.stringify(closed)}`);
  }
  mark(`${label}: pause resume visible`);
  await page.evaluate(() => document.getElementById('resume-button')?.click());
  try {
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 2500, polling: 50 });
  } catch {
    await page.locator('#game canvas').click({ position: { x: 640, y: 380 }, timeout: 5000, noWaitAfter: true });
  }
  await requireGamePointerLock(`${label} resume`);
}

try {
  mark('navigate');
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  mark('wait runtime');
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000, polling: 50 });
  const capabilities = await page.evaluate(() => ({
    nativeModalExit: window.ToonValleyPointerGuard.nativeModalExit,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    keepsRenderWorkDuringModal: window.ToonValleyPointerGuard.keepsRenderWorkDuringModal,
    keepsWebGLSurfaceDuringModal: window.ToonValleyPointerGuard.keepsWebGLSurfaceDuringModal,
    capturePhaseModalKeyGuard: window.ToonValleyDeferredInteractionDispatch.capturePhaseModalKeyGuard,
    interceptsOnlyModalKeyE: window.ToonValleyDeferredInteractionDispatch.interceptsOnlyModalKeyE,
    executesAfterKeyboardEvent: window.ToonValleyDeferredInteractionDispatch.executesAfterKeyboardEvent,
    releasesPointerLockBeforeUI: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockBeforeUI,
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    touchModalSafety: window.ToonValleyDeferredInteractionDispatch.touchModalSafety,
    observableUnlockPolling: window.ToonValleyDeferredInteractionDispatch.observableUnlockPolling,
    eventDrivenUnlockHandoff: window.ToonValleyDeferredInteractionDispatch.eventDrivenUnlockHandoff,
    raceSafeSingleDispatch: window.ToonValleyDeferredInteractionDispatch.raceSafeSingleDispatch,
    keepsRenderWorkDuringDispatch: window.ToonValleyDeferredInteractionDispatch.keepsRenderWorkDuringModal,
    gpuSafePopoverCompositing: window.ToonValleyUILayerFix.gpuSafePopoverCompositing
  }));
  if (!Object.values(capabilities).every(Boolean)) throw new Error(`Missing modal/input capabilities ${JSON.stringify(capabilities)}`);
  mark('runtime capabilities ready');

  await page.click('#play-button', { timeout: 5000, noWaitAfter: true });
  await page.waitForFunction(() => window.ToonValley.state.started === true, null, { timeout: 6000, polling: 50 });
  await requireGamePointerLock('initial play');

  await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await requireGamePointerLock('furniture precondition');
  await openCurrentInteraction('furniture catalog');
  await closeCurrentModal('furniture catalog');

  await moveToInteraction('generalStore', 'Browse counter');
  await requireGamePointerLock('store precondition');
  await openCurrentInteraction('general store counter');
  await closeCurrentModal('general store counter');

  const beforePhysical = await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.interceptionCount());
  await page.evaluate(() => {
    const TV = window.ToonValley;
    const physical = TV.interactables.find((item) => item.prompt === 'Check in at Pine Gate' || item.prompt === 'Stamp trail card at Pine Gate');
    if (physical) {
      TV.state.nearestInteractable = physical;
      physical.action?.();
    }
  });
  const afterPhysical = await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.interceptionCount());
  if (afterPhysical !== beforePhysical) throw new Error('Physical interaction path was intercepted by modal guard');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { base: remoteURL || 'localhost', capabilities, final: await diagnostics() });
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server?.kill('SIGTERM');
}
