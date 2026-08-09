(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  let armedInteraction = null;
  let arms = 0;
  let keyups = 0;
  let dispatches = 0;
  let preflightUnlocks = 0;
  let lastPrompt = null;
  let lastError = null;
  let lastDrop = null;

  const eligible = () => !TV.DEVICE.touch && TV.state.started && !TV.state.modalOpen;
  const modalPrompt = (prompt = '') => /^(?:Browse counter|Order snack|Shop outdoor market|Open job & property desk|Browse furniture catalog|Open decorating menu|Talk to )/.test(prompt);
  const currentInteraction = () => {
    const item = TV.state.nearestInteractable;
    if (!item || item.area !== TV.state.area || typeof item.action !== 'function') return null;
    if (item.enabled && !item.enabled()) return null;
    return item;
  };

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
    dispatches++;
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;
    lastDrop = null;
    try {
      interaction.action();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Deferred Toon Valley interaction failed', error);
    }
  }

  function executeAfterModalUnlock(interaction) {
    const guard = window.ToonValleyPointerGuard;
    if (!modalPrompt(interaction.prompt) || !guard?.preflightModalUnlock || document.pointerLockElement !== TV.renderer.domElement) {
      setTimeout(() => execute(interaction), 0);
      return;
    }

    preflightUnlocks++;
    guard.prepareModalInteraction();
    const started = performance.now();
    const waitForUnlock = () => {
      if (guard.modalInteractionReady()) {
        setTimeout(() => execute(interaction), 0);
        return;
      }
      if (performance.now() - started > 1800) {
        lastDrop = 'modal-unlock-timeout';
        console.error('Toon Valley modal interaction Pointer Lock release timed out', interaction.prompt);
        return;
      }
      requestAnimationFrame(waitForUnlock);
    };
    requestAnimationFrame(waitForUnlock);
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
    executeAfterModalUnlock(interaction);
  }, true);

  window.addEventListener('blur', () => { armedInteraction = null; });

  window.ToonValleyInteractionKeyupDispatch = Object.freeze({
    active: true,
    executesAfterKeyup: true,
    preflightsModalUnlock: true,
    pending: () => Boolean(armedInteraction),
    armCount: () => arms,
    keyupCount: () => keyups,
    dispatchCount: () => dispatches,
    preflightUnlockCount: () => preflightUnlocks,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError,
    lastDrop: () => lastDrop
  });

  console.info('Toon Valley keyup interaction dispatcher ready');
})();
