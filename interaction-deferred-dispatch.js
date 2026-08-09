(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let handoffInteraction = null;
  let handoffTimer = 0;
  let arms = 0;
  let keyups = 0;
  let dispatches = 0;
  let modalDispatches = 0;
  let pointerHandoffs = 0;
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

  const eligible = () => !TV.DEVICE.touch && TV.state.started && !TV.state.modalOpen;

  function currentInteraction() {
    const interaction = TV.state.nearestInteractable;
    if (!interaction || interaction.area !== TV.state.area || typeof interaction.action !== 'function') return null;
    if (interaction.enabled && !interaction.enabled()) return null;
    return interaction;
  }

  function stillValid(interaction) {
    if (!eligible()) {
      lastDrop = 'dispatch-not-eligible';
      return false;
    }
    if (interaction.area !== TV.state.area) {
      lastDrop = 'dispatch-area-changed';
      return false;
    }
    if (interaction.enabled && !interaction.enabled()) {
      lastDrop = 'dispatch-disabled';
      return false;
    }
    return true;
  }

  function runAction(interaction, modal) {
    if (!stillValid(interaction)) {
      if (modal) window.ToonValleyUILayerFix?.endPopoverTransition?.();
      return;
    }
    dispatches++;
    if (modal) modalDispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      interaction.action();
      if (modal && !TV.state.modalOpen) window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
      console.error('Toon Valley deferred interaction failed', error);
    } finally {
      if (modal) window.ToonValleyUILayerFix?.endPopoverTransition?.();
    }
  }

  function finishModalHandoff(reason = 'pointerlockchange') {
    if (!handoffInteraction) return;
    if (document.pointerLockElement === TV.renderer?.domElement && reason !== 'timeout') return;
    const interaction = handoffInteraction;
    handoffInteraction = null;
    clearTimeout(handoffTimer);
    handoffTimer = 0;
    runAction(interaction, true);
  }

  function execute(interaction) {
    if (!stillValid(interaction)) return;
    const modal = opensModalUI(interaction);
    if (!modal) {
      runAction(interaction, false);
      return;
    }

    const guard = window.ToonValleyPointerGuard;
    const ui = window.ToonValleyUILayerFix;
    ui?.beginPopoverTransition?.();
    const locked = Boolean(guard?.gamePointerLocked?.());
    if (!locked) {
      runAction(interaction, true);
      return;
    }

    if (handoffInteraction) {
      ui?.endPopoverTransition?.();
      lastDrop = 'modal-handoff-already-pending';
      return;
    }
    guard?.armResumeAfterModal?.();
    handoffInteraction = interaction;
    pointerHandoffs++;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock release failed; continuing modal handoff', error);
      finishModalHandoff('release-error');
      return;
    }
    handoffTimer = setTimeout(() => finishModalHandoff('timeout'), 180);
  }

  document.addEventListener('pointerlockchange', () => finishModalHandoff('pointerlockchange'));

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !eligible() || handoffInteraction) return;
    const interaction = currentInteraction();
    if (!interaction) {
      lastDrop = 'keydown-no-current-interaction';
      return;
    }
    armedInteraction = interaction;
    arms++;
    lastPrompt = interaction.prompt || 'Interact';
    lastDrop = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'KeyE') return;
    keyups++;
    if (!armedInteraction) {
      lastDrop = 'keyup-not-armed';
      return;
    }
    const interaction = armedInteraction;
    armedInteraction = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    execute(interaction);
  }, true);

  window.addEventListener('blur', () => {
    armedInteraction = null;
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    capturePhaseModalKeyGuard: true,
    executesOnKeyup: true,
    explicitPointerLockHandoff: true,
    actionRunsAfterUnlock: true,
    prefreezesWebGLBeforeModal: true,
    sharedModalHandoff: true,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    interceptsOnlyDesktopE: true,
    opensModalUI,
    pending: () => Boolean(armedInteraction),
    handoffPending: () => Boolean(handoffInteraction),
    handoffArmed: () => Boolean(window.ToonValleyPointerGuard?.resumePending?.()),
    renderQuiesced: () => Boolean(window.ToonValleyUILayerFix?.transitionPending?.()),
    canvasDetached: () => false,
    interceptionCount: () => arms,
    scheduleCount: () => arms,
    attemptCount: () => dispatches,
    dispatchCount: () => dispatches,
    modalDispatchCount: () => modalDispatches,
    pointerHandoffCount: () => pointerHandoffs,
    keyupCount: () => keyups,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop
  });

  console.info('Toon Valley desktop modal handoff ready');
})();
