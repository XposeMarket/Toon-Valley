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

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => {
  const text = message.text();
  if (text.startsWith('[modal-dispatch]')) console.log(`[browser] ${text}`);
  if (message.type() === 'error') errors.push(`console: ${text}`);
});
page.on('crash', () => errors.push('page crash: Chromium renderer process crashed'));
const checkpoint = (label) => console.log(`[modal-popover] ${label}`);
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';
const watchdog = setTimeout(() => {
  console.error('[modal-popover] watchdog: browser interaction stopped responding for 40 seconds');
  process.exit(86);
}, 40000);

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
      closeButton: Boolean(document.querySelector('.life-close,[data-close]')),
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
  try {
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 2500, polling: 50 });
  } catch {
    await page.locator('#game canvas').click({ position: { x: 640, y: 380 } });
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 4000, polling: 50 });
  }
  const state = await diagnostics();
  if (!state.gamePointerLocked) throw new Error(`${label}: real game Pointer Lock was not active ${JSON.stringify(state)}`);
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
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000, polling: 50 });
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

  await page.keyboard.press('e');
  await page.waitForFunction((previous) => window.ToonValleyDeferredInteractionDispatch.scheduleCount() > previous, before.schedules, { timeout: 4000, polling: 50 });
  checkpoint(`${label} scheduled from real E input`);

  // Give the native Pointer Lock exit + deferred action a real browser task turn,
  // then inspect the page's own DOM/state directly. Playwright locator watchers use
  // an injected world that can be throttled while the game surface is intentionally
  // suspended; the main-world state is the runtime players actually experience.
  await wait(850);
  const state = await diagnostics();
  console.log(`[modal-popover] ${label} opened`, state);
  if (!state.dispatcher || state.dispatcher.wrapped < 2 || state.dispatcher.schedules <= before.schedules || state.dispatcher.attempts < 1 || state.dispatcher.dispatches <= before.dispatches || state.dispatcher.lastError || state.dispatcher.lastDrop) {
    throw new Error(`${label}: modal-safe action regression ${JSON.stringify(state)}`);
  }
  if (!state.modalOpen || !state.renderPaused || !state.webglSurfaceHidden || !state.overlay || !state.closeButton || !state.pauseHidden || state.pointerLocked || !state.modalVisible || !state.resumePending || state.suppressedUnlocks < 1) {
    throw new Error(`${label}: modal Pointer Lock/render isolation regression ${JSON.stringify(state)}`);
  }
  checkpoint(`${label} overlay stable and Pointer Lock released`);
}

async function closeCurrentModal(label) {
  checkpoint(`${label} closing`);
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.life-close,[data-close]');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error(`${label}: close button disappeared before handoff`);
  await wait(350);
  const closed = await diagnostics();
  if (closed.overlay || closed.modalOpen || closed.renderPaused || closed.webglSurfaceHidden || closed.pauseHidden) {
    throw new Error(`${label}: modal did not restore game/resume state ${JSON.stringify(closed)}`);
  }
  checkpoint(`${label} closed with resume prompt visible`);
  await page.click('#resume-button');
  await requireGamePointerLock(`${label} resume`);
  checkpoint(`${label} resumed`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000, polling: 50 });
  checkpoint('game globals ready with native Pointer Lock APIs');

  const capabilities = await page.evaluate(() => ({
    nativeModalExit: window.ToonValleyPointerGuard.nativeModalExit,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    suspendsRenderWorkForModal: window.ToonValleyPointerGuard.suspendsRenderWorkForModal,
    preModalRenderSuspension: window.ToonValleyPointerGuard.preModalRenderSuspension,
    removesWebGLSurfaceDuringModal: window.ToonValleyPointerGuard.removesWebGLSurfaceDuringModal,
    singleCoreKeyHandler: window.ToonValleyDeferredInteractionDispatch.singleCoreKeyHandler,
    actionWrapperArchitecture: window.ToonValleyDeferredInteractionDispatch.actionWrapperArchitecture,
    executesAfterKeyboardEvent: window.ToonValleyDeferredInteractionDispatch.executesAfterKeyboardEvent,
    releasesPointerLockBeforeUI: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockBeforeUI,
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    touchModalSafety: window.ToonValleyDeferredInteractionDispatch.touchModalSafety,
    recursionGuard: window.ToonValleyDeferredInteractionDispatch.recursionGuard,
    observableUnlockPolling: window.ToonValleyDeferredInteractionDispatch.observableUnlockPolling,
    pausesRenderWorkForModal: window.ToonValleyDeferredInteractionDispatch.pausesRenderWorkForModal,
    gpuSafePopoverCompositing: window.ToonValleyUILayerFix.gpuSafePopoverCompositing
  }));
  if (!Object.values(capabilities).every(Boolean)) throw new Error(`Missing modal/input capabilities ${JSON.stringify(capabilities)}`);

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true, null, { timeout: 6000, polling: 50 });
  await requireGamePointerLock('initial play');
  checkpoint('real game Pointer Lock state active');

  await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await requireGamePointerLock('furniture precondition');
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
  clearTimeout(watchdog);
  await browser.close();
  server?.kill('SIGTERM');
}
