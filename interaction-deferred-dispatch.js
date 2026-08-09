(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let pendingTimer = 0;
  let pendingRequest = null;
  let requestSequence = 0;
  let schedules = 0;
  let attempts = 0;
  let dispatches = 0;
  let interceptions = 0;
  let lastPrompt = null;
  let lastError = null;
  let lastDrop = null;
  let handoffModalArmed = false;
  let renderQuiesced = false;
  let nativeRender = null;
  let quiesceCount = 0;

  const opensModalUI = (interaction) => {
    const prompt = interaction?.prompt || '';
    return prompt === 'Browse counter' ||
      prompt === 'Order snack' ||
      prompt === 'Shop outdoor market' ||
      prompt === 'Browse market' ||
      prompt === 'Open job & property desk' ||
      prompt === 'Ask about town' ||
      prompt === 'Browse furniture catalog' ||
      prompt === 'Open decorating menu' ||
      prompt === 'Buy ticket / see a film' ||
      prompt === 'Choose a short film' ||
      /^Talk to /.test(prompt);
  };

  const canRun = (interaction, allowHandoff = false) => {
    const action = interaction?.action;
    return TV.state.started &&
      (!TV.state.modalOpen || (allowHandoff && handoffModalArmed)) &&
      interaction?.area === TV.state.area &&
      typeof action === 'function' &&
      (!interaction.enabled || interaction.enabled());
  };

  // Pointer Lock release and active WebGL presentation can deadlock Chromium on
  // some GPU/ANGLE paths. Keep the canvas mounted and gameplay state untouched,
  // but suppress renderer.render only for the unlock transition itself. The
  // original render function is restored before any modal DOM/action executes.
  function quiesceWebGLForUnlock() {
    if (renderQuiesced || !TV.renderer || typeof TV.renderer.render !== 'function') return;
    nativeRender = TV.renderer.render;
    TV.renderer.render = function toonValleyUnlockRenderNoop() {};
    renderQuiesced = true;
    quiesceCount++;
  }

  function restoreWebGLAfterUnlock() {
    if (!renderQuiesced) return;
    if (nativeRender) TV.renderer.render = nativeRender;
    nativeRender = null;
    renderQuiesced = false;
  }

  function disarmHandoff(showResume = true) {
    if (!handoffModalArmed) return;
    handoffModalArmed = false;
    if (TV.state.modalOpen) TV.setModalOpen(false);
    if (showResume) window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
  }

  function clearPending(request, drop = null) {
    if (pendingRequest !== request) return;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingRequest = null;
    restoreWebGLAfterUnlock();
    if (request?.modalSentinel) disarmHandoff(true);
    if (drop) lastDrop = drop;
  }

  function executeRequest(request) {
    if (pendingRequest !== request) return;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingRequest = null;
    restoreWebGLAfterUnlock();
    attempts++;
    const { interaction } = request;
    if (!canRun(interaction, true)) {
      if (request.modalSentinel) disarmHandoff(true);
      lastDrop = 'dispatch-no-longer-valid';
      return;
    }
    if (request.modalSentinel) disarmHandoff(false);
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      interaction.action();
      if (!TV.state.modalOpen) window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
      console.error('Toon Valley deferred modal interaction failed', error);
    }
  }

  function beginPointerUnlock(request) {
    if (pendingRequest !== request) return;
    const { interaction } = request;
    if (!canRun(interaction)) {
      clearPending(request, 'unlock-no-longer-valid');
      return;
    }

    if (document.pointerLockElement !== TV.renderer?.domElement) {
      pendingTimer = setTimeout(() => executeRequest(request), 0);
      return;
    }

    TV.playerVelocity?.set?.(0, 0, 0);
    TV.state.jumpVelocity = 0;
    window.ToonValleyPointerGuard?.armResumeAfterModal?.();
    handoffModalArmed = true;
    request.modalSentinel = true;
    TV.setModalOpen(true);
    quiesceWebGLForUnlock();

    const startedAt = performance.now();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
    const finishIfUnlocked = () => {
      if (pendingRequest !== request) {
        cleanup();
        restoreWebGLAfterUnlock();
        return true;
      }
      if (document.pointerLockElement === TV.renderer?.domElement) return false;
      cleanup();
      restoreWebGLAfterUnlock();
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => executeRequest(request), 0);
      return true;
    };
    const onPointerLockChange = () => { finishIfUnlocked(); };
    const verifyUnlock = () => {
      pendingTimer = 0;
      if (pendingRequest !== request) {
        cleanup();
        restoreWebGLAfterUnlock();
        return;
      }
      if (!canRun(interaction, true)) {
        cleanup();
        clearPending(request, 'unlock-no-longer-valid');
        return;
      }
      if (finishIfUnlocked()) return;
      if (performance.now() - startedAt >= 1500) {
        cleanup();
        clearPending(request, 'pointer-lock-release-timeout');
        console.warn('Toon Valley modal interaction cancelled because Pointer Lock did not release in time', interaction.prompt);
        return;
      }
      pendingTimer = setTimeout(verifyUnlock, 16);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    try {
      document.exitPointerLock?.();
    } catch (error) {
      cleanup();
      clearPending(request, 'pointer-lock-release-error');
      lastError = String(error?.stack || error?.message || error);
      console.warn('Pointer Lock release before modal interaction failed', error);
      return;
    }
    if (!finishIfUnlocked()) pendingTimer = setTimeout(verifyUnlock, 16);
  }

  function schedule(interaction) {
    if (pendingRequest) clearPending(pendingRequest, 'superseded');
    schedules++;
    const request = { id: ++requestSequence, interaction, modalSentinel: false };
    pendingRequest = request;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    beginPointerUnlock(request);
  }

  function dispatchNearestModal() {
    const interaction = TV.state.nearestInteractable;
    if (!interaction || !opensModalUI(interaction) || !canRun(interaction)) return false;
    interceptions++;
    schedule(interaction);
    return true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen) return;
    if (!dispatchNearestModal()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('pagehide', () => {
    if (pendingRequest) clearPending(pendingRequest, 'pagehide');
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingRequest = null;
    restoreWebGLAfterUnlock();
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    capturePhaseModalKeyGuard: true,
    interceptsOnlyModalKeyE: true,
    sharedModalHandoff: true,
    modalHandoffSentinel: true,
    executesAfterKeyboardEvent: true,
    releasesPointerLockBeforeUI: true,
    releasesPointerLockWithinInputEvent: true,
    releasesPointerLockAfterKeyEvent: false,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    touchModalSafety: true,
    queuedActionsSurviveBlur: true,
    observableUnlockPolling: true,
    eventDrivenUnlockHandoff: true,
    raceSafeSingleDispatch: true,
    transientRenderQuiesce: true,
    webglOnlyTransitionQuiesce: true,
    transientCanvasDetach: false,
    preUnlockRenderQuiesce: true,
    keepsCanvasMountedDuringUnlock: true,
    mutatesVisibilityStateDuringUnlock: false,
    keepsRenderWorkDuringModal: true,
    pausesRenderWorkForModal: false,
    preModalRenderSuspension: false,
    pending: () => Boolean(pendingTimer || pendingRequest),
    handoffArmed: () => handoffModalArmed,
    renderQuiesced: () => renderQuiesced,
    canvasDetached: () => false,
    quiesceCount: () => quiesceCount,
    interceptionCount: () => interceptions,
    scheduleCount: () => schedules,
    attemptCount: () => attempts,
    dispatchCount: () => dispatches,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop,
    opensModalUI,
    dispatchNearestModal
  });

  console.info('Toon Valley capture-phase modal interaction handoff ready');
})();