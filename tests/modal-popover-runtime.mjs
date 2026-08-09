import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

async function requireReleasedForModal(label) {
  await page.waitForSelector('.life-overlay', { timeout: 6000 });
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  const state = await page.evaluate(() => ({
    modalOpen: window.ToonValley.state.modalOpen,
    pauseHidden: document.getElementById('pause-screen').classList.contains('hidden'),
    pointerLocked: Boolean(document.pointerLockElement),
    modalVisible: window.ToonValleyPointerGuard.modalVisible(),
    resumePending: window.ToonValleyPointerGuard.resumePending(),
    unlocks: window.ToonValleyInteractionInputPreflight.unlockCount(),
    ui: window.ToonValleyInteractionInputPreflight.uiOpenCount()
  }));
  if (!state.modalOpen || !state.pauseHidden || state.pointerLocked || !state.modalVisible || !state.resumePending || state.unlocks < 1 || state.ui < 1) throw new Error(`${label}: modal release regression ${JSON.stringify(state)}`);
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
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyInteractionInputPreflight && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  checkpoint('game globals ready');

  await page.evaluate(() => {
    const TV = window.ToonValley;
    document.__tvTestPointerLock = null;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get() { return document.__tvTestPointerLock || null; } });
    Object.defineProperty(TV.renderer.domElement, 'requestPointerLock', { configurable: true, value() {
      document.__tvTestPointerLock = TV.renderer.domElement;
      setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
      return Promise.resolve();
    }});
    Object.defineProperty(document, 'exitPointerLock', { configurable: true, value() {
      document.__tvTestPointerLock = null;
      setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
    }});
  });

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('initial pointer lock active');

  const guard = await page.evaluate(() => ({
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    nativeModalLifecycle: window.ToonValleyPointerGuard.nativeModalLifecycle,
    preflightActive: window.ToonValleyInteractionInputPreflight.active,
    hasInteract: typeof window.ToonValleyInteractionInputPreflight.interact === 'function'
  }));
  if (!guard.explicitResumeAfterModal || !guard.modalPauseSuppression || !guard.nativeModalLifecycle || !guard.preflightActive || !guard.hasInteract) throw new Error(`Pointer guard capabilities missing ${JSON.stringify(guard)}`);

  const modalTarget = await page.evaluate(() => {
    const TV = window.ToonValley;
    TV.enterInterior('home', { x: 0, z: 10 });
    const interaction = TV.interactables.find((item) => item.area === 'home' && item.prompt === 'Open decorating menu' && typeof item.action === 'function');
    if (!interaction) throw new Error('Home decorating modal interaction not found');
    TV.player.position.set(interaction.x, 0, interaction.z);
    TV.playerVelocity.set(0, 0, 0);
    return { prompt: interaction.prompt, area: TV.state.area };
  });
  if (modalTarget.area !== 'home') throw new Error(`Failed to enter home for modal test: ${JSON.stringify(modalTarget)}`);
  await page.waitForFunction((prompt) => document.getElementById('interaction-prompt')?.textContent.includes(prompt), modalTarget.prompt, { timeout: 6000 });
  if (!(await page.evaluate(() => window.ToonValleyInteractionInputPreflight.interact()))) throw new Error('Desktop interaction preflight refused the home decorating interaction');
  await requireReleasedForModal(modalTarget.prompt);
  checkpoint('home decorating popover opened after safe preflight');
  await closeResume(modalTarget.prompt);

  const before = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('KeyW'); await wait(450); await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.25) throw new Error(`Gameplay did not resume after popover ${JSON.stringify({ before, after })}`);
  checkpoint('WASD movement resumed');

  await page.evaluate(() => window.ToonValleyUILayerFix.openTab('tasks'));
  await page.waitForSelector('.life-overlay', { timeout: 6000 });
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  await page.click('[data-tab="inventory"]');
  await page.waitForSelector('.life-overlay [data-tab="inventory"].active', { timeout: 6000 });
  const replacement = await page.evaluate(() => ({ modalOpen: window.ToonValley.state.modalOpen, pointerLocked: Boolean(document.pointerLockElement), pauseHidden: document.getElementById('pause-screen').classList.contains('hidden') }));
  if (!replacement.modalOpen || replacement.pointerLocked || !replacement.pauseHidden) throw new Error(`ToonPhone modal replacement regression ${JSON.stringify(replacement)}`);
  await closeResume('ToonPhone replacement');
  checkpoint('ToonPhone replacement stable');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley modal/popover lifecycle passed: ${remoteURL || 'localhost'}`, { modalTarget, guard });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
