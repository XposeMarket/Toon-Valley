import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4191', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const dispatchSource = readFileSync(new URL('../interaction-deferred-dispatch.js', import.meta.url), 'utf8');
const guardSource = readFileSync(new URL('../pointer-capture-guard.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../ui-layer-fix.js', import.meta.url), 'utf8');
if (!/executesOnKeyup:\s*true/.test(dispatchSource)) throw new Error('Desktop interaction handoff must execute on KeyE keyup');
if (!/preservesPhysicalActionPath:\s*true/.test(dispatchSource)) throw new Error('Physical action path invariant missing');
if (!/explicitPointerLockHandoff:\s*true/.test(dispatchSource) || !/actionRunsAfterUnlock:\s*true/.test(dispatchSource)) throw new Error('Modal Pointer Lock handoff invariant missing');
if (!/guard\?\.armResumeAfterModal\?\.\(\)/.test(dispatchSource)) throw new Error('Modal handoff must arm pause suppression before unlock');
if (!/document\.exitPointerLock\?\.\(\)/.test(dispatchSource)) throw new Error('Dispatcher must release Pointer Lock itself');
if (!/document\.addEventListener\('pointerlockchange',\s*\(\)\s*=>\s*finishModalHandoff/.test(dispatchSource)) throw new Error('Modal action must wait for pointerlockchange handoff');
if (!/handoffTimer\s*=\s*setTimeout\(\(\)\s*=>\s*finishModalHandoff\('timeout'\),\s*180\)/.test(dispatchSource)) throw new Error('Modal handoff needs a bounded browser fallback');
if (/interaction\.action\s*=/.test(dispatchSource)) throw new Error('Desktop E safety must not replace registered interaction actions');
if (!/!gamePointerLocked\(\)/.test(guardSource)) throw new Error('Modal resume guard must only arm from genuine gameplay Pointer Lock');
if (!/freezesWebGLDrawsUnderModal:true/.test(uiSource) || !/canvasRemainsMounted:true/.test(uiSource)) throw new Error('Popover GPU compositing guard missing');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.stack || e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('crash', () => errors.push('page crash'));
const modalSelector = '.life-overlay,.ohx,.mb-overlay,#build-controls,#ohbuild,#bl-controls';

async function snapshot() {
  return page.evaluate((selector) => ({
    modalOpen: Boolean(window.ToonValley?.state?.modalOpen),
    overlay: Boolean(document.querySelector(selector)),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    frame: window.ToonValley?.renderer?.info?.render?.frame ?? -1,
    suppressedFrames: window.ToonValleyUILayerFix?.suppressedFrames?.() ?? -1,
    canvasConnected: Boolean(window.ToonValley?.renderer?.domElement?.isConnected),
    dispatcher: window.ToonValleyDeferredInteractionDispatch ? {
      explicitHandoff: window.ToonValleyDeferredInteractionDispatch.explicitPointerLockHandoff,
      actionAfterUnlock: window.ToonValleyDeferredInteractionDispatch.actionRunsAfterUnlock,
      preservesActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
      preservesPhysical: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
      lastError: window.ToonValleyDeferredInteractionDispatch.lastError()
    } : null
  }), modalSelector);
}

async function openRealInteraction(area, prompt, label) {
  const before = await snapshot();
  const result = await page.evaluate(({ area, prompt }) => {
    const TV = window.ToonValley;
    const interaction = TV.interactables.find((item) => item.area === area && item.prompt === prompt && typeof item.action === 'function');
    if (!interaction) return { missing: true };
    interaction.action();
    return { missing: false, modalOpen: TV.state.modalOpen };
  }, { area, prompt });
  if (result.missing) throw new Error(`${label}: interaction missing`);
  await page.waitForFunction((selector) => window.ToonValley.state.modalOpen && Boolean(document.querySelector(selector)), modalSelector, { timeout: 5000 });
  const opened = await snapshot();
  if (!opened.modalOpen || !opened.overlay || !opened.pauseHidden || !opened.canvasConnected) throw new Error(`${label}: unsafe modal state ${JSON.stringify(opened)}`);
  await wait(300);
  const stable = await snapshot();
  if (stable.suppressedFrames <= opened.suppressedFrames) throw new Error(`${label}: WebGL draws were not suppressed beneath popover ${JSON.stringify({ opened, stable })}`);
  if (stable.frame !== opened.frame) throw new Error(`${label}: renderer still drew beneath popover ${opened.frame}->${stable.frame}`);
  if (!stable.canvasConnected) throw new Error(`${label}: game canvas detached during popover`);
  if (errors.length) throw new Error(`${label}: ${errors.join('\n')}`);
  if (opened.dispatcher?.lastError) throw new Error(`${label}: dispatcher error ${opened.dispatcher.lastError}`);
  return before;
}

async function closeRealModal(label) {
  const before = await snapshot();
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.life-close,[data-close],.mb-btn.close');
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error(`${label}: close button missing`);
  await page.waitForFunction((selector) => !window.ToonValley.state.modalOpen && !document.querySelector(selector), modalSelector, { timeout: 5000 });
  await wait(220);
  const closed = await snapshot();
  if (closed.modalOpen || closed.overlay || !closed.canvasConnected) throw new Error(`${label}: modal did not close cleanly ${JSON.stringify(closed)}`);
  if (closed.frame <= before.frame) throw new Error(`${label}: WebGL rendering did not resume after modal close ${before.frame}->${closed.frame}`);
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });
  const caps = await page.evaluate(() => ({
    nativeExit: window.ToonValleyPointerGuard.nativeModalExit,
    suppressPause: window.ToonValleyPointerGuard.modalPauseSuppression,
    resume: window.ToonValleyPointerGuard.explicitResumeAfterModal,
    keyup: window.ToonValleyDeferredInteractionDispatch.executesOnKeyup,
    explicitHandoff: window.ToonValleyDeferredInteractionDispatch.explicitPointerLockHandoff,
    actionAfterUnlock: window.ToonValleyDeferredInteractionDispatch.actionRunsAfterUnlock,
    preserveActions: window.ToonValleyDeferredInteractionDispatch.preservesInteractionActions,
    preservePhysical: window.ToonValleyDeferredInteractionDispatch.preservesPhysicalActionPath,
    gpuSafe: window.ToonValleyUILayerFix.gpuSafePopoverCompositing,
    freezesDraws: window.ToonValleyUILayerFix.freezesWebGLDrawsUnderModal,
    canvasMounted: window.ToonValleyUILayerFix.canvasRemainsMounted
  }));
  if (!Object.values(caps).every(Boolean)) throw new Error(`Missing modal safety capabilities ${JSON.stringify(caps)}`);
  if (await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({ prompt: 'Clear park litter' }))) throw new Error('Physical quest misclassified as modal UI');
  if (!(await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({ prompt: 'Browse furniture catalog' })))) throw new Error('Furniture catalog must use modal handoff');
  if (!(await page.evaluate(() => window.ToonValleyDeferredInteractionDispatch.opensModalUI({ prompt: 'Browse counter' })))) throw new Error('Store counter must use modal handoff');

  await openRealInteraction('furnitureStore', 'Browse furniture catalog', 'furniture');
  await closeRealModal('furniture');
  await openRealInteraction('generalStore', 'Browse counter', 'store');
  await closeRealModal('store');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { caps, final: await snapshot() });
} finally {
  try { await browser.close(); } catch {}
  server?.kill('SIGTERM');
}
