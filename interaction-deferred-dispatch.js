(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let pendingTimer = 0;
  let pendingUnlock = null;
  let arms = 0;
  let keyups = 0;
  let attempts = 0;
  let dispatches = 0;
  let blurs = 0;
  let lastPrompt = null;
  let lastError = null;
  let lastDrop = null;

  const eligible = () => !TV.DEVICE.touch && TV.state.started && !TV.state.modalOpen;
  const currentInteraction = () => {
    const item = TV.state.nearestInteractable;
    if (!item || item.area !== TV.state.area || typeof item.action !== 'function') return null;
    if (item.enabled && !item.enabled()) return null;
    return item;
  };

  // Only intercept interactions known to open mouse-driven UI. Physical actions,
  // seats, quest steps, fishing, pets, etc. remain on the core KeyE path so the
  // shared interaction-experience gesture queue keeps its original behavior.
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

  function stillValid(interaction) {
    if (!eligible()) { lastDrop = 'dispatch-not-eligible'; return false; }
    if (interaction.area !== TV.state.area) { lastDrop = 'dispatch-area-changed'; return false; }
    if (interaction.enabled && !interaction.enabled()) { lastDrop = 'dispatch-disabled'; return false; }
    return true;
  }

  function execute(interaction) {
    pendingTimer = 0;
    pendingUnlock = null;
    attempts++;
    if (!stillValid(interaction)) return;
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      interaction.action();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Toon Valley deferred interaction failed', error);
    }
  }

  function executeAfterPointerUnlock(interaction) {
    clearTimeout(pendingTimer);
    if (document.pointerLockElement !== TV.renderer?.domElement) {
      pendingTimer = setTimeout(() => execute(interaction), 0);
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
      pendingTimer = setTimeout(() => execute(interaction), 0);
    };
    const onChange = () => {
      if (document.pointerLockElement !== TV.renderer?.domElement) finish();
    };

    pendingUnlock = interaction;
    document.addEventListener('pointerlockchange', onChange);
    pendingTimer = setTimeout(finish, 500);
    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock release before modal interaction failed', error);
      finish();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !eligible()) return;
    const interaction = currentInteraction();
    if (!interaction) { lastDrop = 'keydown-no-current-interaction'; return; }
    if (!opensModalUI(interaction)) return;
    armedInteraction = interaction;
    arms++;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'KeyE' || !armedInteraction) return;
    keyups++;
    const interaction = armedInteraction;
    armedInteraction = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    executeAfterPointerUnlock(interaction);
  }, true);

  // Losing focus can accompany Pointer Lock release. An unfinished keydown can be
  // abandoned; once keyup has queued a UI interaction, its unlock/dispatch path is
  // intentionally preserved rather than silently cancelled.
  window.addEventListener('blur', () => {
    blurs++;
    armedInteraction = null;
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    executesAfterKeyboardEvent: true,
    releasesPointerLockBeforeUI: true,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    queuedActionsSurviveBlur: true,
    pending: () => Boolean(armedInteraction || pendingTimer || pendingUnlock),
    armCount: () => arms,
    keyupCount: () => keyups,
    attemptCount: () => attempts,
    dispatchCount: () => dispatches,
    blurCount: () => blurs,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop
  });

  console.info('Toon Valley deferred modal interaction dispatcher ready');
})();
