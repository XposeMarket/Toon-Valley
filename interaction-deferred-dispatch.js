(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let pendingTimer = 0;
  let pendingUnlock = null;
  let schedules = 0;
  let attempts = 0;
  let dispatches = 0;
  let wrappedCount = 0;
  let lastPrompt = null;
  let lastError = null;
  let lastDrop = null;
  const wrapped = new WeakMap();
  const installed = new WeakSet();

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
      /^Talk to /.test(prompt);
  };

  const canRun = (interaction) => TV.state.started &&
    !TV.state.modalOpen &&
    interaction?.area === TV.state.area &&
    (!interaction.enabled || interaction.enabled());
  const canDefer = (interaction) => !TV.DEVICE.touch && canRun(interaction);

  function unwrapAction(action) {
    const seen = new Set();
    let current = action;
    while (typeof current === 'function' && current.__toonValleyModalSafeWrapper && current.__toonValleyOriginalAction) {
      if (seen.has(current)) throw new Error('Detected recursive Toon Valley modal interaction wrapper');
      seen.add(current);
      current = current.__toonValleyOriginalAction;
    }
    return current;
  }

  function runOriginal(interaction, original, args) {
    const target = unwrapAction(original);
    if (typeof target !== 'function') {
      lastDrop = 'dispatch-missing-original';
      return undefined;
    }
    // The only modal preflight is Pointer Lock release. Keep the renderer/update
    // loop live so the DOM overlay stays responsive on Chromium and integrated GPUs.
    return target.apply(interaction, args);
  }

  function execute(interaction, original, args) {
    pendingTimer = 0;
    pendingUnlock = null;
    attempts++;
    if (!canRun(interaction)) {
      lastDrop = 'dispatch-no-longer-valid';
      return;
    }
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      runOriginal(interaction, original, args);
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Toon Valley deferred interaction failed', error);
    }
  }

  function beginPointerUnlock(interaction, original, args) {
    pendingTimer = 0;
    if (!canDefer(interaction)) {
      pendingUnlock = null;
      lastDrop = 'unlock-no-longer-valid';
      return;
    }

    if (document.pointerLockElement !== TV.renderer?.domElement) {
      pendingTimer = setTimeout(() => execute(interaction, original, args), 0);
      return;
    }

    TV.playerVelocity?.set?.(0, 0, 0);
    TV.state.jumpVelocity = 0;
    window.ToonValleyPointerGuard?.armResumeAfterModal?.();
    pendingUnlock = interaction;

    const startedAt = performance.now();
    const verifyUnlock = () => {
      pendingTimer = 0;
      if (!canDefer(interaction)) {
        pendingUnlock = null;
        lastDrop = 'unlock-no-longer-valid';
        return;
      }
      if (document.pointerLockElement !== TV.renderer?.domElement) {
        pendingTimer = setTimeout(() => execute(interaction, original, args), 0);
        return;
      }
      if (performance.now() - startedAt >= 700) {
        pendingUnlock = null;
        lastDrop = 'pointer-lock-release-timeout';
        console.warn('Toon Valley modal interaction cancelled because Pointer Lock did not release in time', interaction.prompt);
        return;
      }
      pendingTimer = setTimeout(verifyUnlock, 16);
    };

    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock release before modal interaction failed', error);
    }
    pendingTimer = setTimeout(verifyUnlock, 0);
  }

  function schedule(interaction, original, args) {
    clearTimeout(pendingTimer);
    schedules++;
    pendingUnlock = interaction;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    pendingTimer = setTimeout(() => beginPointerUnlock(interaction, original, args), 0);
  }

  function wrapInteraction(interaction) {
    if (!interaction || !opensModalUI(interaction) || typeof interaction.action !== 'function') return false;

    if (installed.has(interaction)) {
      if (interaction.action === wrapped.get(interaction)) return false;
      installed.delete(interaction);
    }

    let original;
    try {
      original = unwrapAction(interaction.action);
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Toon Valley modal wrapper chain was invalid', error);
      return false;
    }
    if (typeof original !== 'function') return false;

    function modalSafeAction(...args) {
      if (!canRun(interaction)) return undefined;
      if (!canDefer(interaction) || document.pointerLockElement !== TV.renderer?.domElement) {
        return runOriginal(interaction, original, args);
      }
      schedule(interaction, original, args);
      return undefined;
    }
    modalSafeAction.__toonValleyModalSafeWrapper = true;
    modalSafeAction.__toonValleyOriginalAction = original;
    interaction.action = modalSafeAction;
    wrapped.set(interaction, modalSafeAction);
    installed.add(interaction);
    wrappedCount++;
    return true;
  }

  function scan() {
    for (const interaction of TV.interactables) wrapInteraction(interaction);
  }

  scan();
  let scanClock = 0;
  TV.registerUpdateHook((dt) => {
    scanClock += dt;
    if (scanClock < 1) return;
    scanClock = 0;
    scan();
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    singleCoreKeyHandler: true,
    actionWrapperArchitecture: true,
    executesAfterKeyboardEvent: true,
    releasesPointerLockBeforeUI: true,
    releasesPointerLockAfterKeyEvent: true,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    touchModalSafety: true,
    queuedActionsSurviveBlur: true,
    recursionGuard: true,
    observableUnlockPolling: true,
    keepsRenderWorkDuringModal: true,
    pausesRenderWorkForModal: false,
    preModalRenderSuspension: false,
    pending: () => Boolean(pendingTimer || pendingUnlock),
    wrappedCount: () => wrappedCount,
    scheduleCount: () => schedules,
    attemptCount: () => attempts,
    dispatchCount: () => dispatches,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop,
    scan
  });

  console.info('Toon Valley modal-safe interaction actions ready', { wrapped: wrappedCount });
})();
