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
if (!/explicitPointerLockHandoff:\s*true/.test(dispatchSource) || !/actionRunsAfterUnlock:\s*true/.test(dispatchSource)) throw new Error('Modal handoff invariant missing');
if (!/guard\?\.armResumeAfterModal\?\.\(\)/.test(dispatchSource)) throw new Error('Modal handoff must arm pause suppression before unlock');
if (!/document\.exitPointerLock\?\.\(\)/.test(dispatchSource)) throw new Error('Dispatcher must release Pointer Lock itself');
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

async function snapshot() {
  return page.evaluate(() => ({
    modalOpen: Boolean(window.ToonValley?.state?.modalOpen),
    overlay: Boolean(document.querySelector('.life-overlay')),
    pauseHidden: document.getElementById('pause-screen')?.classList.contains('hidden'),
    frame: window.ToonValley?.renderer?.info?.render?.frame ?? -1,
    suppressedFrames: window.ToonValleyUILayerFix?.suppressedFrames?.() ?? -1,
    canvasConnected: Boolean(window.ToonValley?.renderer?.domElement?.isConnected),
    lastError: window.ToonValleyDeferredInteractionDispatch?.lastError?.() || null,
    dispatchCount: window.ToonValleyDeferredInteractionDispatch?.dispatchCount?.() ?? -1
  }));
}

async function installSyntheticModalAction() {
  await page.evaluate(() => {
    const TV = window.ToonValley;
    TV.state.started = true;
    document.body.classList.add('tv-started');
    const open = () => {
      TV.setModalOpen(true);
      const old = document.querySelector('.life-overlay');
      old?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'life-overlay';
      overlay.innerHTML = '<section><button class="life-close" data-close>Close</button><h2>Modal Regression</h2></section>';
      overlay.querySelector('[data-close]').onclick = () => {
        overlay.remove();
        TV.setModalOpen(false);
      };
      document.body.appendChild(overlay);
    };
    TV.state.nearestInteractable = { area: TV.state.area, prompt: 'Talk to Modal Test', action: open };
    window.__tvOpenSyntheticModal = open;
  });
}

async function closeSyntheticModal() {
  await page.locator('.life-overlay [data-close]').click();
  await page.waitForFunction(() => !window.ToonValley.state.modalOpen && !document.querySelector('.life-overlay'));
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyPointerGuard && window.ToonValleyDeferredInteractionDispatch && window.ToonValleyUILayerFix, null, { timeout: 30000 });

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

  await installSyntheticModalAction();

  // Direct modal creation validates the compositor guard independently of world/save systems.
  const before = await snapshot();
  await page.evaluate(() => {
    window.ToonValleyUILayerFix.beginPopoverTransition();
    try { window.__tvOpenSyntheticModal(); }
    finally { window.ToonValleyUILayerFix.endPopoverTransition(); }
  });
  await page.waitForFunction(() => window.ToonValley.state.modalOpen && Boolean(document.querySelector('.life-overlay')));
  const opened = await snapshot();
  await wait(250);
  const stable = await snapshot();
  if (!opened.canvasConnected || !stable.canvasConnected) throw new Error(`canvas detached during modal ${JSON.stringify({ before, opened, stable })}`);
  if (stable.suppressedFrames <= opened.suppressedFrames) throw new Error(`WebGL draws were not suppressed beneath popover ${JSON.stringify({ opened, stable })}`);
  if (stable.frame !== opened.frame) throw new Error(`renderer still drew beneath popover ${opened.frame}->${stable.frame}`);
  await closeSyntheticModal();
  await wait(180);
  const closed = await snapshot();
  if (!closed.canvasConnected || closed.modalOpen || closed.overlay) throw new Error(`modal did not close cleanly ${JSON.stringify(closed)}`);
  if (closed.frame <= stable.frame) throw new Error(`WebGL rendering did not resume after modal close ${stable.frame}->${closed.frame}`);

  // Actual capture-phase E path: keydown arms, keyup dispatches the registered action.
  await installSyntheticModalAction();
  const dispatchBefore = await snapshot();
  await page.keyboard.down('e');
  await page.keyboard.up('e');
  await page.waitForFunction(() => window.ToonValley.state.modalOpen && Boolean(document.querySelector('.life-overlay')));
  const dispatched = await snapshot();
  if (dispatched.dispatchCount !== dispatchBefore.dispatchCount + 1) throw new Error(`E dispatcher did not run exactly once ${JSON.stringify({ dispatchBefore, dispatched })}`);
  if (dispatched.lastError) throw new Error(`dispatcher error ${dispatched.lastError}`);
  if (!dispatched.canvasConnected) throw new Error(`dispatcher detached game canvas ${JSON.stringify(dispatched)}`);
  await closeSyntheticModal();
  await wait(180);

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley modal/popover lifecycle passed', { caps, final: await snapshot() });
} finally {
  try { await browser.close(); } catch {}
  server?.kill('SIGTERM');
}
