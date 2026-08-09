(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  const pauseScreen = document.getElementById('pause-screen');
  let pendingInteraction = null;
  let pendingSince = 0;
  let releaseScheduled = false;
  let releaseFallback = 0;
  let unlockCount = 0;
  let physicalRelockCount = 0;
  let uiOpenCount = 0;
  let lastPrompt = null;
  let lastError = null;

  const hidePause = () => pauseScreen?.classList.add('hidden');
  const gamePointerLocked = () => document.pointerLockElement === TV.renderer?.domElement;
  const modalVisible = () => Boolean(window.ToonValleyPointerGuard?.modalVisible?.() || document.querySelector('.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls'));
  const nearestInteraction = () => {
    const item = TV.state.nearestInteractable;
    return item && item.area === TV.state.area ? item : null;
  };

  function clearPending() {
    pendingInteraction = null;
    pendingSince = 0;
    releaseScheduled = false;
    if (releaseFallback) clearTimeout(releaseFallback);
    releaseFallback = 0;
  }

  function relockPhysicalInteraction() {
    if (TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen || modalVisible() || gamePointerLocked()) return;
    physicalRelockCount++;
    try { TV.renderer.domElement.requestPointerLock?.(); } catch (error) { console.warn('Unable to restore Pointer Lock after physical interaction', error); }
  }

  function executePending() {
    if (!pendingInteraction || gamePointerLocked()) return false;
    const interaction = pendingInteraction;
    clearPending();
    hidePause();
    lastPrompt = interaction.prompt || 'Interact';
    lastError = null;

    try {
      interaction.action?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.error('Interaction failed after Pointer Lock preflight', error);
      setTimeout(relockPhysicalInteraction, 0);
      return true;
    }

    setTimeout(() => {
      hidePause();
      if (TV.state.modalOpen || modalVisible()) {
        uiOpenCount++;
        window.ToonValleyPointerGuard?.armResumeAfterModal?.();
      } else {
        relockPhysicalInteraction();
      }
    }, 0);
    return true;
  }

  function flushPending() {
    if (!pendingInteraction) return;
    hidePause();
    if (executePending()) return;
    if (performance.now() - pendingSince > 1800) {
      const prompt = pendingInteraction.prompt || 'interaction';
      clearPending();
      lastError = `Pointer Lock did not release for ${prompt}`;
      console.warn(lastError);
      return;
    }
    setTimeout(flushPending, 16);
  }

  function releasePointerLockAfterInput() {
    releaseScheduled = false;
    if (!pendingInteraction) return;
    hidePause();
    try {
      if (gamePointerLocked()) document.exitPointerLock?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.warn('Pointer Lock preflight release failed', error);
      clearPending();
      return;
    }
    setTimeout(flushPending, 0);
  }

  function scheduleRelease() {
    if (!pendingInteraction || releaseScheduled) return;
    releaseScheduled = true;
    setTimeout(releasePointerLockAfterInput, 0);
  }

  function beginPreflight(interaction) {
    if (pendingInteraction || !interaction || typeof interaction.action !== 'function') return false;
    pendingInteraction = interaction;
    pendingSince = performance.now();
    unlockCount++;
    hidePause();

    // Capture KeyE now, but do not mutate Pointer Lock between keydown and keyup.
    // Releasing the lock mid-press can strand Chromium/desktop input dispatch and
    // was the source of popover hangs that looked like a full game crash.
    releaseFallback = setTimeout(scheduleRelease, 250);
    return true;
  }

  function interact() {
    if (TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen || !gamePointerLocked()) return false;
    return beginPreflight(nearestInteraction());
  }

  document.addEventListener('pointerlockchange', () => {
    if (!gamePointerLocked() && pendingInteraction) setTimeout(flushPending, 0);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat) return;
    if (!interact()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('keyup', (event) => {
    if (event.code !== 'KeyE' || !pendingInteraction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (releaseFallback) clearTimeout(releaseFallback);
    releaseFallback = 0;
    scheduleRelease();
  }, true);

  window.ToonValleyInteractionInputPreflight = Object.freeze({
    active: true,
    deferredPointerRelease: true,
    keyupBoundRelease: true,
    interact,
    pending: () => Boolean(pendingInteraction),
    unlockCount: () => unlockCount,
    physicalRelockCount: () => physicalRelockCount,
    uiOpenCount: () => uiOpenCount,
    nearestInteraction,
    lastPrompt: () => lastPrompt,
    lastError: () => lastError
  });

  console.info('Toon Valley interaction input preflight ready');
})();
