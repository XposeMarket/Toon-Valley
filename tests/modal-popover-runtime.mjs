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

// Use the same deterministic Pointer Lock harness as the established desktop
// runtime test. Production still uses the browser's real Pointer Lock API; this
// shim only makes lock transitions deterministic inside headless Chromium CI.
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
      document.__tvTestPointerLock = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  } catch (_) {}
});

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
    pending: window.ToonValleyPointerGuard.pendingInteraction()
  }));
  if (!state.modalOpen || !state.pauseHidden || state.pointerLocked || state.pending) throw new Error(`${label}: modal release regression ${JSON.stringify(state)}`);
}

async function closeResumeAndRequireGameplay(label) {
  await page.click('.life-close');
  await page.waitForFunction(() => !document.querySelector('.life-overlay') && window.ToonValley.state.modalOpen === false, null, { timeout: 6000 });
  await page.waitForFunction(() => !document.getElementById('pause-screen').classList.contains('hidden'), null, { timeout: 6000 });
  const resumeState = await page.evaluate(() => ({
    pauseVisible: !document.getElementById('pause-screen').classList.contains('hidden'),
    pointerLocked: Boolean(document.pointerLockElement),
    modalOpen: window.ToonValley.state.modalOpen
  }));
  if (!resumeState.pauseVisible || resumeState.pointerLocked || resumeState.modalOpen) throw new Error(`${label}: explicit resume state invalid ${JSON.stringify(resumeState)}`);
  checkpoint(`${label}: explicit Resume shown`);
  await page.click('#resume-button');
  await requireGamePointerLock(`${label} resume`);
  if (!(await page.evaluate(() => document.getElementById('pause-screen').classList.contains('hidden')))) throw new Error(`${label}: pause overlay remained after Resume`);
  checkpoint(`${label}: gameplay pointer lock restored`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  checkpoint('game globals ready');
  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');
  checkpoint('initial pointer lock active');

  const guard = await page.evaluate(() => ({
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    modalExitDeferred: window.ToonValleyPointerGuard.modalExitDeferred,
    modalInteractionPreflight: window.ToonValleyPointerGuard.modalInteractionPreflight,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression,
    prompts: window.ToonValleyPointerGuard.modalPrompts
  }));
  if (!guard.explicitResumeAfterModal || !guard.modalExitDeferred || !guard.modalInteractionPreflight || !guard.modalPauseSuppression || !guard.prompts.some((p) => p.includes('Talk to'))) throw new Error(`Pointer guard capabilities missing ${JSON.stringify(guard)}`);

  const npcTarget = await page.evaluate(() => {
    const TV = window.ToonValley;
    const interaction = TV.interactables.find((item) => /^Talk to /.test(item.prompt || '') && typeof item.action === 'function' && item.area === 'world');
    if (!interaction) throw new Error('No outdoor NPC talk interaction found');
    const x = interaction.object ? interaction.object.position.x : interaction.x;
    const z = interaction.object ? interaction.object.position.z : interaction.z;
    TV.state.area = 'world';
    TV.player.position.set(x, TV.terrainHeight(x, z), z);
    TV.playerVelocity.set(0, 0, 0);
    TV.state.cameraReady = false;
    return { prompt: interaction.prompt, x, z };
  });
  await page.waitForFunction((prompt) => document.getElementById('interaction-prompt')?.textContent.includes(prompt), npcTarget.prompt, { timeout: 6000 });
  checkpoint(`real prompt ready: ${npcTarget.prompt}`);

  // This is the reported production path: E while Pointer Lock is active. The
  // preflight must consume only this modal-producing interaction, release the lock,
  // then run Maya's action after unlock so popover construction cannot re-enter the
  // Pointer Lock/pause stack.
  await page.keyboard.press('KeyE');
  await requireReleasedForModal(npcTarget.prompt);
  checkpoint('real E opened NPC popover after safe unlock');
  await closeResumeAndRequireGameplay(npcTarget.prompt);

  await page.evaluate(() => {
    const TV = window.ToonValley;
    TV.player.position.set(0, TV.terrainHeight(0, 10), 10);
    TV.playerVelocity.set(0, 0, 0);
    TV.state.yaw = 0;
  });
  const before = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('KeyW');
  await wait(450);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.35) throw new Error(`Gameplay did not resume after NPC popover ${JSON.stringify({ before, after })}`);
  checkpoint('WASD movement resumed');

  // ToonPhone already has its own pre-release path. Verify it can replace tabs and
  // close into the same explicit Resume lifecycle without overlapping Pause.
  await page.evaluate(() => window.ToonValleyUILayerFix.openTab('tasks'));
  await requireReleasedForModal('ToonPhone Tasks');
  checkpoint('ToonPhone opened through desktop UI layer');
  await page.click('[data-tab="inventory"]');
  await page.waitForSelector('.life-overlay [data-tab="inventory"].active', { timeout: 6000 });
  const replacement = await page.evaluate(() => ({ modalOpen: window.ToonValley.state.modalOpen, pointerLocked: Boolean(document.pointerLockElement), pauseHidden: document.getElementById('pause-screen').classList.contains('hidden') }));
  if (!replacement.modalOpen || replacement.pointerLocked || !replacement.pauseHidden) throw new Error(`ToonPhone modal replacement regression ${JSON.stringify(replacement)}`);
  checkpoint('ToonPhone modal replacement stayed stable');
  await closeResumeAndRequireGameplay('ToonPhone replacement');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley modal/popover lifecycle passed: ${remoteURL || 'localhost'}`, { npcTarget, before, after, guard });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
