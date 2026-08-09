(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let dispatches = 0;
  let lastPrompt = null;
  let lastError = null;

  const eligible = () => !TV.DEVICE.touch && TV.state.started && !TV.state.modalOpen;
  const currentInteraction = () => {
    const item = TV.state.nearestInteractable;
    if (!item || item.area !== TV.state.area || typeof item.action !== 'function') return null;
    if (item.enabled && !item.enabled()) return null;
    return item;
  };

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !eligible()) return;
    const interaction = currentInteraction();
    if (!interaction) return;
    armedInteraction = interaction;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'KeyE' || !armedInteraction) return;
    const interaction = armedInteraction;
    armedInteraction = null;
    event.preventDefault();
    event.stopImmediatePropagation();

    // Never construct UI, release Pointer Lock, or start a physical gesture inside
    // the browser's active keyboard dispatch. Run the unchanged registered action
    // on the next task after keyup has fully propagated through Chromium/Safari.
    setTimeout(() => {
      if (!eligible()) return;
      if (interaction.area !== TV.state.area || (interaction.enabled && !interaction.enabled())) return;
      dispatches++;
      lastPrompt = interaction.prompt || 'Interact';
      lastError = null;
      try {
        interaction.action();
      } catch (error) {
        lastError = String(error?.stack || error?.message || error);
        console.error('Deferred Toon Valley interaction failed', error);
      }
    }, 0);
  }, true);

  window.addEventListener('blur', () => { armedInteraction = null; });

  window.ToonValleyInteractionKeyupDispatch = Object.freeze({
    active: true,
    executesAfterKeyup: true,
    pending: () => Boolean(armedInteraction),
    dispatchCount: () => dispatches,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError
  });

  console.info('Toon Valley keyup interaction dispatcher ready');
})();
