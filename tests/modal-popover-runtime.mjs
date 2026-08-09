import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const headedPointerLock = process.env.HEADFUL_POINTERLOCK === '1';
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const dispatchSource = readFileSync(new URL('../interaction-deferred-dispatch.js', import.meta.url), 'utf8');
if (!/dispatchNearestModal/.test(dispatchSource) || !/preservesPhysicalActionPath:\s*true/.test(dispatchSource)) throw new Error('Shared modal handoff invariant missing');
if (/interaction\.action\s*=/.test(dispatchSource)) throw new Error('Modal safety must not mutate registered interaction actions');
if (/style\.display\s*=\s*['"]none['"]/.test(dispatchSource)) throw new Error('Modal safety must never display:none the WebGL surface');
if (/style\.visibility\s*=\s*['"]hidden['"]/.test(dispatchSource) || /pausedByVisibility\s*=\s*true/.test(dispatchSource)) throw new Error('Pointer Lock release must not hide or pause the live WebGL scene');
if (!/transientRenderQuiesce:\s*false/.test(dispatchSource) || !/preUnlockRenderQuiesce:\s*false/.test(dispatchSource) || !/transientCanvasDetach:\s*false/.test(dispatchSource)) throw new Error('Pointer Lock handoff must keep rendering and canvas mounted');

const launchOptions = headedPointerLock
  ? { headless: false, channel: 'chrome', args: ['--enable-webgl'] }
  : { headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] };
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.stack || e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('crash', () => errors.push('page crash'));
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild';

async function state() {
  return page.evaluate((selector) => ({
    locked: document.pointerLockElement === window.ToonValley?.renderer?.domElement,
    modalOpen: window.ToonValley?.state?.modalOpen,
    overlay: Boolean(document.querySelector(selector)),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    renderPaused: window.ToonValley?.state?.pausedByVisibility,
    canvasVisibility: window.ToonValley?.renderer?.domElement?.style.visibility || '',
    resumePending: window.ToonValleyPointerGuard?.resumePending?.(),
    modalVisible: window.ToonValleyPointerGuard?.modalVisible?.(),
    suppressedUnlocks: window.ToonValleyPointerGuard?.suppressedModalUnlocks?.(),
    d: window.ToonValleyDeferredInteractionDispatch ? {
      interceptions: window.ToonValleyDeferredInteractionDispatch.interceptionCount(),
      schedules: window.ToonValleyDeferredInteractionDispatch.scheduleCount(),
      attempts: window.ToonValleyDeferredInteractionDispatch.attemptCount(),
      dispatches: window.ToonValleyDeferredInteractionDispatch.dispatchCount(),
      renderQuiesced: window.ToonValleyDeferredInteractionDispatch.renderQuiesced(),
      canvasDetached: window.ToonValleyDeferredInteractionDispatch.canvasDetached(),
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError(),
      lastDrop: window.ToonValleyDeferredInteractionDispatch.lastDrop()
    } : null
  }), modalSelector);
}

async function lock(label) {
  try { await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 2200 }); }
  catch {
    await page.locator('#game canvas').click({ position: { x: 640, y: 380 }, noWaitAfter: true });
    await page.waitForFunction(() => document.pointerLockElement === window.ToonValley?.renderer?.domElement, null, { timeout: 4000 });
  }
  if (!(await state()).locked) throw new Error(`${label}: Pointer Lock unavailable`);
}

async function move(area, prompt) {
  await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    TV.enterInterior(area, { x: 0, z: 10 });
    const i = TV.interactables.find(x => x.area === area && x.prompt === prompt && typeof x.action === 'function');
    if (!i) throw new Error(`Missing interaction ${prompt}`);
    TV.player.position.set(i.x, 0, i.z);
    TV.playerVelocity.set(0, 0, 0);
  }, { area, prompt });
  await page.waitForFunction(prompt => window.ToonValley.state.nearestInteractable?.prompt === prompt, prompt, { timeout: 6000 });
}

async function cycle(label) {
  const before = await state();
  const accepted = await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.dispatchNearestModal());
  if (!accepted) throw new Error(`${label}: shared modal handoff rejected nearest interaction`);
  await page.waitForFunction(selector => window.ToonValley.state.modalOpen && Boolean(document.querySelector(selector)), modalSelector, { timeout: 8000 });
  const opened = await state();
  if (opened.locked || !opened.modalOpen || !opened.overlay || !opened.pauseHidden || opened.renderPaused || opened.canvasVisibility === 'hidden' || !opened.resumePending || !opened.modalVisible || opened.suppressedUnlocks < 1) throw new Error(`${label}: bad open state ${JSON.stringify(opened)}`);
  if (!opened.d || opened.d.dispatches <= before.d.dispatches || opened.d.attempts < 1 || opened.d.lastError || opened.d.lastDrop || opened.d.renderQuiesced || opened.d.canvasDetached) throw new Error(`${label}: dispatcher failed ${JSON.stringify(opened.d)}`);
  const frameA = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  await wait(250);
  const frameB = await page.evaluate(() => window.ToonValley.renderer.info.render.frame);
  if (frameB <= frameA) throw new Error(`${label}: renderer stalled ${frameA}->${frameB}`);
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('.life-close,[data-close],.mb-btn.close'); if (!b) return false; b.click(); return true;
  });
  if (!clicked) throw new Error(`${label}: close button missing`);
  await page.waitForFunction(selector => !window.ToonValley.state.modalOpen && !document.querySelector(selector), modalSelector, { timeout: 4000 });
  const closed = await state();
  if (closed.modalOpen || closed.overlay || closed.pauseHidden || closed.renderPaused || closed.canvasVisibility === 'hidden' || closed.d.renderQuiesced || closed.d.canvasDetached) throw new Error(`${label}: bad close state ${JSON.stringify(closed)}`);
  await page.locator('#resume-button').click({ noWaitAfter: true });
  await lock(`${label} resume`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  const caps = await page.evaluate(() => ({
    nativeExit: window.ToonValleyPointerGuard.nativeModalExit,
    suppressPause: window.ToonValleyPointerGuard.modalPauseSuppression,
    resume: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    liveRender: window.ToonValleyPointerGuard.keepsRenderWorkDuringModal,
    surface: window.ToonValleyPointerGuard.keepsWebGLSurfaceDuringModal,
    shared: window.ToonValleyDeferredInteractionDispatch.sharedModalHandoff,
    noQuiesce: !window.ToonValleyDeferredInteractionDispatch.transientRenderQuiesce && !window.ToonValleyDeferredInteractionDispatch.preUnlockRenderQuiesce,
    noDetach: !window.ToonValleyDeferredInteractionDispatch.transientCanvasDetach,
    preserveActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservePhysical: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    gpuSafe: window.ToonValleyUILayerFix.gpuSafePopoverCompositing
  }));
  if (!Object.values(caps).every(Boolean)) throw new Error(`Missing modal capabilities ${JSON.stringify(caps)}`);
  if (await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({prompt:'Clear park litter'}))) throw new Error('Physical quest classified as modal');

  await page.click('#play-button', { noWaitAfter: true });
  await page.waitForFunction(() => window.ToonValley.state.started === true);
  await lock('initial');
  await move('furnitureStore', 'Browse furniture catalog'); await lock('furniture'); await cycle('furniture');
  await move('generalStore', 'Browse counter'); await lock('store'); await cycle('store');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { headedPointerLock, browserChannel: headedPointerLock ? 'chrome' : 'chromium', final: await state() });
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}