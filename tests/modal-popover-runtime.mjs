import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(12000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

async function requireGamePointerLock(label) {
  await page.waitForFunction(() => window.ToonValley && document.pointerLockElement === window.ToonValley.renderer.domElement, null, { timeout: 6000 });
  const locked = await page.evaluate(() => document.pointerLockElement === window.ToonValley.renderer.domElement);
  if (!locked) throw new Error(`${label}: game Pointer Lock was not active`);
}

async function requireReleasedForModal(label) {
  await page.waitForSelector('.life-overlay');
  await page.waitForFunction(() => !document.pointerLockElement && window.ToonValley.state.modalOpen === true, null, { timeout: 6000 });
  const state = await page.evaluate(() => ({
    modalOpen: window.ToonValley.state.modalOpen,
    pauseHidden: document.getElementById('pause-screen').classList.contains('hidden'),
    pointerLocked: Boolean(document.pointerLockElement)
  }));
  if (!state.modalOpen || !state.pauseHidden || state.pointerLocked) throw new Error(`${label}: modal release regression ${JSON.stringify(state)}`);
}

async function closeResumeAndRequireGameplay(label) {
  await page.locator('.life-close').dispatchEvent('click');
  await page.waitForFunction(() => !document.querySelector('.life-overlay') && window.ToonValley.state.modalOpen === false, null, { timeout: 6000 });
  await page.waitForFunction(() => !document.getElementById('pause-screen').classList.contains('hidden'), null, { timeout: 6000 });
  const resumeState = await page.evaluate(() => ({
    pauseVisible: !document.getElementById('pause-screen').classList.contains('hidden'),
    pointerLocked: Boolean(document.pointerLockElement),
    modalOpen: window.ToonValley.state.modalOpen
  }));
  if (!resumeState.pauseVisible || resumeState.pointerLocked || resumeState.modalOpen) throw new Error(`${label}: explicit resume state invalid ${JSON.stringify(resumeState)}`);
  await page.click('#resume-button');
  await requireGamePointerLock(`${label} resume`);
  const pauseHidden = await page.evaluate(() => document.getElementById('pause-screen').classList.contains('hidden'));
  if (!pauseHidden) throw new Error(`${label}: pause overlay remained after Resume`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard, null, { timeout: 30000 });
  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await requireGamePointerLock('initial play');

  const guard = await page.evaluate(() => ({
    explicitResumeAfterModal: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    nativeExitPointerLock: window.ToonValleyPointerGuard.nativeExitPointerLock,
    modalPauseSuppression: window.ToonValleyPointerGuard.modalPauseSuppression
  }));
  if (!guard.explicitResumeAfterModal || !guard.nativeExitPointerLock || !guard.modalPauseSuppression) throw new Error(`Pointer guard capabilities missing ${JSON.stringify(guard)}`);

  const npcPrompt = await page.evaluate(() => {
    const TV = window.ToonValley;
    const interaction = TV.interactables.find((item) => /^Talk to /.test(item.prompt || '') && typeof item.action === 'function');
    if (!interaction) throw new Error('No NPC talk interaction found');
    interaction.action();
    return interaction.prompt;
  });
  await requireReleasedForModal(npcPrompt);
  await closeResumeAndRequireGameplay(npcPrompt);

  // Prove that closing/resuming the interaction did not leave desktop gameplay invisibly paused.
  const before = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  await page.keyboard.down('KeyW');
  await wait(450);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => ({ x: window.ToonValley.player.position.x, z: window.ToonValley.player.position.z }));
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.35) throw new Error(`Gameplay did not resume after NPC popover ${JSON.stringify({ before, after })}`);

  // Cover a second modal family and replacement path through ToonPhone.
  await page.evaluate(() => window.ToonValleyLife.openPhone('tasks'));
  await requireReleasedForModal('ToonPhone Tasks');
  await page.locator('[data-tab="inventory"]').dispatchEvent('click');
  await page.waitForSelector('.life-overlay [data-tab="inventory"].active');
  const replacement = await page.evaluate(() => ({ modalOpen: window.ToonValley.state.modalOpen, pointerLocked: Boolean(document.pointerLockElement), pauseHidden: document.getElementById('pause-screen').classList.contains('hidden') }));
  if (!replacement.modalOpen || replacement.pointerLocked || !replacement.pauseHidden) throw new Error(`ToonPhone modal replacement regression ${JSON.stringify(replacement)}`);
  await closeResumeAndRequireGameplay('ToonPhone replacement');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley modal/popover lifecycle passed: ${remoteURL || 'localhost'}`, { npcPrompt, before, after, guard });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
