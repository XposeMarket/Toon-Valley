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

  const canDefer = (interaction) => !TV.DEVICE.touch &&
    TV.state.started &&
    !TV.state.modalOpen &&
    interaction?.area === TV.state.area &&
    (!interaction.enabled || interaction.enabled());

  function execute(interaction, original, args) {
    pendingTimer = 0;
    pendingUnlock = null;
    attempts++;
    if (!canDefer(interaction)) {
      lastDrop = 'dispatch-no-longer-valid';
      return;
    }
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      original.apply(interaction, args);
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

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.removeEventListener('pointerlockchange', onChange);
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => execute(interaction, original, args), 0);
    };
    const onChange = () => {
      if (document.pointerLockElement !== TV.renderer?.domElement) finish();
    };

    pendingUnlock = interaction;
    document.addEventListener('pointerlockchange', onChange);
    pendingTimer = setTimeout(finish, 700);
    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock release before modal interaction failed', error);
      finish();
    }
  }

  function schedule(interaction, original, args) {
    clearTimeout(pendingTimer);
    schedules++;
    pendingUnlock = interaction;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    // The core game remains the only owner of KeyE. Its normal interaction action
    // calls this wrapper, which returns immediately. Pointer Lock is released from
    // a fresh task after the keyboard event stack has completely unwound, and the
    // original UI action runs only after the unlock transition has completed.
    pendingTimer = setTimeout(() => beginPointerUnlock(interaction, original, args), 0);
  }

  function wrapInteraction(interaction) {
    if (!interaction || !opensModalUI(interaction) || typeof interaction.action !== 'function') return false;
    if (wrapped.get(interaction) === interaction.action) return false;
    const original = interaction.action;
    if (original.__toonValleyModalSafeWrapper) return false;

    function modalSafeAction(...args) {
      if (!canDefer(interaction) || document.pointerLockElement !== TV.renderer?.domElement) {
        return original.apply(interaction, args);
      }
      schedule(interaction, original, args);
      return undefined;
    }
    modalSafeAction.__toonValleyModalSafeWrapper = true;
    modalSafeAction.__toonValleyOriginalAction = original;
    interaction.action = modalSafeAction;
    wrapped.set(interaction, modalSafeAction);
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
    queuedActionsSurviveBlur: true,
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
