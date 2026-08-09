(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let arms = 0;
  let keyups = 0;
  let dispatches = 0;
  let modalDispatches = 0;
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

  function execute(interaction) {
    if (!stillValid(interaction)) return;
    const modal = opensModalUI(interaction);
    dispatches++;
    if (modal) {
      modalDispatches++;
      // Arm pause suppression before the interaction has any chance to call the
      // browser's native exitPointerLock(). This is especially important for older
      // modal helpers that release Pointer Lock before their DOM is appended.
      window.ToonValleyPointerGuard?.armResumeAfterModal?.();
    }
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      // Preserve every registered interaction action exactly as authored. Physical
      // quest actions still flow through interaction-experience.js; this dispatcher
      // only moves desktop E execution from keydown to the matching keyup so the
      // browser input task has settled before a modal releases Pointer Lock.
      interaction.action();
      if (modal && !TV.state.modalOpen) window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      window.ToonValleyPointerGuard?.syncPauseAfterModal?.();
      console.error('Toon Valley keyup interaction failed', error);
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !eligible()) return;
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
    nativePointerLockRelease: true,
    sharedModalHandoff: true,
    preservesInteractionActions: true,
    preservesPhysicalActionPath: true,
    interceptsOnlyDesktopE: true,
    opensModalUI,
    pending: () => Boolean(armedInteraction),
    handoffArmed: () => Boolean(window.ToonValleyPointerGuard?.resumePending?.()),
    renderQuiesced: () => false,
    canvasDetached: () => false,
    interceptionCount: () => arms,
    scheduleCount: () => arms,
    attemptCount: () => dispatches,
    dispatchCount: () => dispatches,
    modalDispatchCount: () => modalDispatches,
    keyupCount: () => keyups,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop
  });

  console.info('Toon Valley desktop E keyup dispatcher ready');
})();
