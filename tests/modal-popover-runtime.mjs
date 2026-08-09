import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const headed = process.env.HEADED === '1';
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const browser = await chromium.launch({ headless: !headed, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const checkpoint = (label) => console.log(`[modal-popover] ${label}`);

async function diagnostics() {
  return page.evaluate(() => ({
    pointerLocked: Boolean(document.pointerLockElement),
    gamePointerLocked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
    modalOpen: window.ToonValley?.state?.modalOpen,
    overlay: Boolean(document.querySelector('.life-overlay')),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    nearest: window.ToonValley?.state?.nearestInteractable?.prompt || null,
    area: window.ToonValley?.state?.area,
    modalVisible: window.ToonValleyPointerGuard?.modalVisible?.(),
    resumePending: window.ToonValleyPointerGuard?.resumePending?.(),
    suppressedUnlocks: window.ToonValleyPointerGuard?.suppressedModalUnlocks?.(),
    dispatcher: window.ToonValleyDeferredInteractionDispatch ? {
      pending: window.ToonValleyDeferredInteractionDispatch.pending(),
      arms: window.ToonValleyDeferredInteractionDispatch.armCount(),
      keyups: window.ToonValleyDeferredInteractionDispatch.keyupCount(),
      attempts: window.ToonValleyDeferredInteractionDispatch.attemptCount(),
      dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount(),
      blurs: window.ToonValleyDeferredInteractionDispatch.blurCount(),
      lastPrompt: window.ToonValleyDeferredInteractionDispatch.lastPrompt(),
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError(),
      lastDrop: window.ToonValleyDeferredInteractionDispatch.lastDrop()
    } : null
  }));
}

async function requireGamePointerLock(label) {
  await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 6000 });
  const state = await diagnostics();
  if (!state.gamePointerLocked) throw new Error(`${label}: game Pointer Lock was not active ${JSON.stringify(state)}`);
}

async function dispatchKeyboardGesture(code, key = '') {
  // Playwright's native keyboard command can deadlock at the protocol layer while
  // Chromium holds Pointer Lock under Xvfb. Dispatching DOM key events is safe here
  // because the game now defers Pointer Lock release into a later task, after the
  // complete key event stack returns. The browser Pointer Lock transition itself
  // remains real and is what this test validates.
  await page.evaluate(({ code, key }) => {
    const options = { code, key: key || code, bubbles: true, cancelable: true, repeat: false };
    document.dispatchEvent(new KeyboardEvent('keydown', options));
    document.dispatchEvent(new KeyboardEvent('keyup', options));
  }, { code, key });
}

async function moveToInteraction(area, prompt) {
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found in ${area}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000 });
}

async function openNearestWithE(label) {
  const before = await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.dispatchCount());
  const started = Date.now();
  await dispatchKeyboardGesture('KeyE', 'e');
  const eventDuration = Date.now() - started;
  if (eventDuration > 1500) throw new Error(`${label}: E event stack blocked for ${eventDuration}ms`);

  try {
    await page.waitForFunction((previous) => window.ToonValleyDeferredInteractionDispatch.dispatchCount() > previous, before, { timeout: 3000 });
  } catch (error) {
    const state = await diagnostics();
    console.log(`[modal-popover] ${label} deferred dispatch timeout`, state);
    throw new Error(`${label}: deferred dispatch did not execute ${JSON.stringify(state)}\n${error.message}`);
  }
  await page.waitForSelector('.life-overlay', { timeout: 3000 });
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  const state = await diagnostics();
  console.log(`[modal-popover] ${label} opened`, state);
  if (!state.dispatcher || state.dispatcher.arms < 1 || state.dispatcher.keyups < 1 || state.dispatcher.attempts < 1 || state.dispatcher.dispatches <= before || state.dispatcher.lastError || state.dispatcher.lastDrop) {
    throw new Error(`${label}: deferred E dispatch regression ${JSON.stringify(state)}`);
  }
  if (!state.modalOpen || !state.overlay || !state.pauseHidden || state.pointerLocked || !state.modalVisible || !state.resumePending || state.suppressedUnlocks < 1) {
    throw new Error(`${label}: modal Pointer Lock regression ${JSON.stringify(state)}`);
  }
}

async function closeResume(label) {
  await page.click('.life-close');
  await page.waitForFunction(() => !document.querySelector('.life-overlay') && window.ToonValley.state.modalOpen === false, null, { timeout: 6000 });
  await page.waitForFunction(() => !document.getElementById('pause-screen').classList.contains('hidden'), null, { timeout: 6000 });
  await page.click('#resume-button');
  await requireGamePointerLock(`${label} resume`);
  if (!(await page.evaluate(() => document.getElementById('pause-screen').classList.contains('hidden')))) throw new Error(`${label}: pause overlay remained after Resume`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  checkpoint(`game globals ready (${headed ? 'headed' : 'headless'} Chromium)`);

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('real browser Pointer Lock active');

  const capabilities = await page.evaluate(() => ({
    nativeModalExit: window.ToonValleyPointerGuard.nativeModalExit,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    executesAfterKeyboardEvent: window.ToonValleyDeferredInteractionDispatch.executesAfterKeyboardEvent,
    releasesPointerLockBeforeUI: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockBeforeUI,
    releasesPointerLockAfterKeyEvent: window.ToonValleyDeferredInteractionDispatch.releasesPointerLockAfterKeyEvent,
    preservesInteractionActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservesPhysicalActionPath: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    queuedActionsSurviveBlur: window.ToonValleyDeferredInteractionDispatch.queuedActionsSurviveBlur
  }));
  if (!capabilities.nativeModalExit || !capabilities.modalPauseSuppression || !capabilities.explicitResumeAfterModal || !capabilities.executesAfterKeyboardEvent || !capabilities.releasesPointerLockBeforeUI || !capabilities.releasesPointerLockAfterKeyEvent || !capabilities.preservesInteractionActions || !capabilities.preservesPhysicalActionPath || !capabilities.queuedActionsSurviveBlur) {
    throw new Error(`Missing modal/input capabilities ${JSON.stringify(capabilities)}`);
  }

  await moveToInteraction('home', 'Open decorating menu');
  await openNearestWithE('home decorating');
  checkpoint('home decorating popover stable');
  await closeResume('home decorating');

  const beforeMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('KeyW'); await wait(450); await page.keyboard.up('KeyW');
  const afterMove = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(afterMove.x - beforeMove.x, afterMove.z - beforeMove.z) < 0.25) throw new Error(`Gameplay did not resume after popover ${JSON.stringify({ beforeMove, afterMove })}`);
  checkpoint('WASD movement resumed');

  await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await requireGamePointerLock('shop precondition');
  await openNearestWithE('furniture catalog');
  checkpoint('furniture catalog popover stable');
  await closeResume('furniture catalog');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed with headed Chromium and real Pointer Lock transitions', { base: remoteURL || 'localhost', capabilities, final: await diagnostics() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
