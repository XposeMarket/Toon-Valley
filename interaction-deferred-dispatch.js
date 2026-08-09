(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let pendingTimer = 0;
  let arms = 0;
  let keyups = 0;
  let dispatches = 0;
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

  function stillValid(interaction) {
    if (!eligible()) { lastDrop = 'dispatch-not-eligible'; return false; }
    if (interaction.area !== TV.state.area) { lastDrop = 'dispatch-area-changed'; return false; }
    if (interaction.enabled && !interaction.enabled()) { lastDrop = 'dispatch-disabled'; return false; }
    return true;
  }

  function execute(interaction) {
    pendingTimer = 0;
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

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !eligible()) return;
    const interaction = currentInteraction();
    if (!interaction) { lastDrop = 'keydown-no-current-interaction'; return; }
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
    if (!armedInteraction) { lastDrop = 'keyup-not-armed'; return; }
    const interaction = armedInteraction;
    armedInteraction = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Never mutate modal or Pointer Lock state while the browser is dispatching a
    // keyboard event. The next macrotask preserves the player gesture semantics
    // while allowing modal actions to release Pointer Lock without re-entering the
    // active key event. Physical interactions still flow through their existing
    // action wrappers/gesture queue unchanged.
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => execute(interaction), 0);
  }, true);

  window.addEventListener('blur', () => {
    armedInteraction = null;
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }
  });

  window.ToonValleyDeferredInteractionDispatch = Object.freeze({
    active: true,
    executesAfterKeyboardEvent: true,
    preservesInteractionActions: true,
    pending: () => Boolean(armedInteraction || pendingTimer),
    armCount: () => arms,
    keyupCount: () => keyups,
    dispatchCount: () => dispatches,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop
  });

  console.info('Toon Valley deferred interaction dispatcher ready');
})();
