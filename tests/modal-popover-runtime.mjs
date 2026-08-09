import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = (ms, message) => wait(ms).then(() => { throw new Error(message); });
if (server) await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const checkpoint = (label) => console.log(`[modal-popover] ${label}`);

async function requireGamePointerLock(label) {
  await page.waitForFunction(() => window.ToonValley && document.pointerLockElement === window.ToonValley.renderer.domElement, null, { timeout: 6000 });
  if (!(await page.evaluate(() => document.pointerLockElement === window.ToonValley.renderer.domElement))) throw new Error(`${label}: game Pointer Lock was not active`);
}

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
    dispatcher: window.ToonValleyInteractionKeyupDispatch ? {
      pending: window.ToonValleyInteractionKeyupDispatch.pending(),
      arms: window.ToonValleyInteractionKeyupDispatch.armCount(),
      keyups: window.ToonValleyInteractionKeyupDispatch.keyupCount(),
      dispatches: window.ToonValleyInteractionKeyupDispatch.dispatchCount(),
      lastPrompt: window.ToonValleyInteractionKeyupDispatch.lastPrompt(),
      lastError: window.ToonValleyInteractionKeyupDispatch.lastError(),
      lastDrop: window.ToonValleyInteractionKeyupDispatch.lastDrop()
    } : null
  }));
}

async function openNearestWithE(label) {
  await Promise.race([
    page.keyboard.press('KeyE'),
    deadline(3000, `${label}: KeyE dispatch hung`)
  ]);
  await wait(100);
  const afterPress = await diagnostics();
  console.log(`[modal-popover] ${label} post-KeyE`, afterPress);
  if (!afterPress.dispatcher || afterPress.dispatcher.arms < 1 || afterPress.dispatcher.keyups < 1 || afterPress.dispatcher.dispatches < 1 || afterPress.dispatcher.lastError || afterPress.dispatcher.lastDrop) {
    throw new Error(`${label}: deferred dispatch regression ${JSON.stringify(afterPress)}`);
  }
  await page.waitForSelector('.life-overlay', { timeout: 6000 });
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  const state = await diagnostics();
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

async function moveToInteraction(area, prompt, returnPoint = { x: 0, z: 10 }) {
  return page.evaluate(({ area, prompt, returnPoint }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, returnPoint);
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) throw new Error(`${prompt} interaction not found in ${area}`);
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
    return { prompt: interaction.prompt, area: TV.state.area };
  }, { area, prompt, returnPoint });
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyInteractionKeyupDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  checkpoint('game globals ready');

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('real browser pointer lock active');

  const guard = await page.evaluate(() => ({
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    nativePointerLockEvents: window.ToonValleyPointerGuard.nativePointerLockEvents,
    modalExitDeferred: window.ToonValleyPointerGuard.modalExitDeferred,
    keyupDispatch: window.ToonValleyInteractionKeyupDispatch.executesAfterKeyup
  }));
  if (!guard.explicitResumeAfterModal || !guard.modalPauseSuppression || !guard.nativePointerLockEvents || !guard.modalExitDeferred || !guard.keyupDispatch) throw new Error(`Pointer/input capabilities missing ${JSON.stringify(guard)}`);

  const homeTarget = await moveToInteraction('home', 'Open decorating menu');
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, homeTarget.prompt, { timeout: 6000 });
  await openNearestWithE(homeTarget.prompt);
  checkpoint('home decorating popover stable after E keyup');
  await closeResume(homeTarget.prompt);

  const before = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('KeyW'); await wait(450); await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.25) throw new Error(`Gameplay did not resume after popover ${JSON.stringify({ before, after })}`);
  checkpoint('WASD movement resumed');

  const shopTarget = await moveToInteraction('furnitureStore', 'Browse furniture catalog');
  await page.waitForFunction((prompt) => window.ToonValley.state.nearestInteractable?.prompt === prompt, shopTarget.prompt, { timeout: 6000 });
  await openNearestWithE(shopTarget.prompt);
  checkpoint('shop catalog popover stable after E keyup');
  await closeResume(shopTarget.prompt);

  await Promise.race([
    page.keyboard.press('KeyT'),
    deadline(3000, 'KeyT input dispatch hung while opening ToonPhone')
  ]);
  await page.waitForSelector('.life-overlay', { timeout: 6000 });
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  await page.click('[data-tab="inventory"]');
  await page.waitForSelector('.life-overlay [data-tab="inventory"].active', { timeout: 6000 });
  const replacement = await diagnostics();
  if (!replacement.modalOpen || replacement.pointerLocked || !replacement.pauseHidden || !replacement.resumePending) throw new Error(`ToonPhone modal replacement regression ${JSON.stringify(replacement)}`);
  await closeResume('ToonPhone replacement');
  checkpoint('ToonPhone replacement stable');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley modal/popover lifecycle passed with post-keyup interactions and real Pointer Lock: ${remoteURL || 'localhost'}`, { homeTarget, shopTarget, guard });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
