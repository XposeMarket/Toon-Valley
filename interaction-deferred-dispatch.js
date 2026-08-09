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

  const canRun = (interaction) => TV.state.started &&
    !TV.state.modalOpen &&
    interaction?.area === TV.state.area &&
    typeof interaction.action === 'function' &&
    (!interaction.enabled || interaction.enabled());

  function executeRequest(request) {
    if (pendingRequest !== request) return;
    clearTimeout(pendingTimer);
    pendingTimer = 0;
    pendingRequest = null;
    attempts++;
    const { interaction } = request;
    if (!canRun(interaction)) {
      lastDrop = 'dispatch-no-longer-valid';
      return;
    }
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      interaction.action();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Toon Valley deferred modal interaction failed', error);
    }
  }

  function beginPointerUnlock(request) {
    if (pendingRequest !== request) return;
    pendingTimer = 0;
    const { interaction } = request;
    if (!canRun(interaction)) {
      pendingRequest = null;
      lastDrop = 'unlock-no-longer-valid';
      return;
    }

    if (document.pointerLockElement !== TV.renderer?.domElement) {
      pendingTimer = setTimeout(() => executeRequest(request), 0);
      return;
    }

    TV.playerVelocity?.set?.(0, 0, 0);
    TV.state.jumpVelocity = 0;
    window.ToonValleyPointerGuard?.armResumeAfterModal?.();

    const startedAt = performance.now();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
    const finishIfUnlocked = () => {
      if (pendingRequest !== request) { cleanup(); return true; }
      if (document.pointerLockElement === TV.renderer?.domElement) return false;
      cleanup();
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => executeRequest(request), 0);
      return true;
    };
    const onPointerLockChange = () => { finishIfUnlocked(); };
    const verifyUnlock = () => {
      pendingTimer = 0;
      if (pendingRequest !== request) { cleanup(); return; }
      if (!canRun(interaction)) {
        cleanup();
        pendingRequest = null;
        lastDrop = 'unlock-no-longer-valid';
        return;
      }
      if (finishIfUnlocked()) return;
      if (performance.now() - startedAt >= 1200) {
        cleanup();
        pendingRequest = null;
        lastDrop = 'pointer-lock-release-timeout';
        console.warn('Toon Valley modal interaction cancelled because Pointer Lock did not release in time', interaction.prompt);
        return;
      }
      pendingTimer = setTimeout(verifyUnlock, 16);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock release before modal interaction failed', error);
    }
    if (!finishIfUnlocked()) pendingTimer = setTimeout(verifyUnlock, 16);
  }

  function schedule(interaction) {
    clearTimeout(pendingTimer);
    schedules++;
    const request = { id: ++requestSequence, interaction };
    pendingRequest = request;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    pendingTimer = setTimeout(() => beginPointerUnlock(request), 0);
  }

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen) return;
    const interaction = TV.state.nearestInteractable;
    if (!interaction || !opensModalUI(interaction) || !canRun(interaction)) return;
    interceptions++;
    event.preventDefault();
    event.stopImmediatePropagation();
    schedule(interaction);
  }, true);

  window.addEventListener('blur', () => {
    if (!pendingRequest) return;
    // Keep an already-scheduled modal handoff alive across the expected Pointer
    // Lock focus transition. Only clear stale timers if no request is pending.
    if (!pendingTimer) return;
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    capturePhaseModalKeyGuard: true,
    interceptsOnlyModalKeyE: true,
    executesAfterKeyboardEvent: true,
    releasesPointerLockBeforeUI: true,
    releasesPointerLockAfterKeyEvent: true,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    touchModalSafety: true,
    queuedActionsSurviveBlur: true,
    observableUnlockPolling: true,
    eventDrivenUnlockHandoff: true,
    raceSafeSingleDispatch: true,
    keepsRenderWorkDuringModal: true,
    pausesRenderWorkForModal: false,
    preModalRenderSuspension: false,
    pending: () => Boolean(pendingTimer || pendingRequest),
    interceptionCount: () => interceptions,
    scheduleCount: () => schedules,
    attemptCount: () => attempts,
    dispatchCount: () => dispatches,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop,
    opensModalUI
  });

  console.info('Toon Valley capture-phase modal interaction handoff ready');
})();
