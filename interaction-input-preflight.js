(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  const pauseScreen = document.getElementById('pause-screen');
  let pending = false;
  let unlockCount = 0;
  let physicalRelockCount = 0;
  let uiOpenCount = 0;

  const hidePause = () => pauseScreen?.classList.add('hidden');
  const gamePointerLocked = () => document.pointerLockElement === TV.renderer?.domElement;
  const modalVisible = () => Boolean(window.ToonValleyPointerGuard?.modalVisible?.() || document.querySelector('.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls'));

  function nearestInteraction() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const item of TV.interactables || []) {
      if (item.area !== TV.state.area) continue;
      if (item.enabled && !item.enabled()) continue;
      const ix = item.object ? item.object.position.x : item.x;
      const iz = item.object ? item.object.position.z : item.z;
      const distance = Math.hypot(TV.player.position.x - ix, TV.player.position.z - iz);
      if (distance < item.radius && distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  function relockPhysicalInteraction() {
    if (TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen || modalVisible() || gamePointerLocked()) return;
    physicalRelockCount++;
    try { TV.renderer.domElement.requestPointerLock?.(); } catch (error) { console.warn('Unable to restore Pointer Lock after physical interaction', error); }
  }

  function executeAfterUnlock(interaction) {
    if (!pending) return;
    pending = false;
    hidePause();
    try {
      interaction.action?.();
    } catch (error) {
      console.error('Interaction failed after Pointer Lock preflight', error);
      setTimeout(relockPhysicalInteraction, 0);
      return;
    }

    queueMicrotask(() => {
      hidePause();
      if (TV.state.modalOpen || modalVisible()) {
        uiOpenCount++;
        window.ToonValleyPointerGuard?.armResumeAfterModal?.();
      } else {
        setTimeout(relockPhysicalInteraction, 0);
      }
    });
  }

  function beginPreflight(interaction) {
    if (pending || !interaction || typeof interaction.action !== 'function') return false;
    pending = true;
    unlockCount++;
    hidePause();

    let executed = false;
    const run = () => {
      if (executed) return;
      executed = true;
      executeAfterUnlock(interaction);
    };

    const onUnlock = () => {
      if (gamePointerLocked()) return;
      hidePause();
      queueMicrotask(hidePause);
      setTimeout(run, 0);
    };
    document.addEventListener('pointerlockchange', onUnlock, { capture: true, once: true });

    try {
      document.exitPointerLock?.();
    } catch (error) {
      console.warn('Pointer Lock preflight release failed', error);
      run();
      return true;
    }

    setTimeout(run, 80);
    return true;
  }

  function interact() {
    if (TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen || !gamePointerLocked()) return false;
    return beginPreflight(nearestInteraction());
  }

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat) return;
    if (!interact()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.ToonValleyInteractionInputPreflight = Object.freeze({
    active: true,
    interact,
    pending: () => pending,
    unlockCount: () => unlockCount,
    physicalRelockCount: () => physicalRelockCount,
    uiOpenCount: () => uiOpenCount,
    nearestInteraction
  });

  console.info('Toon Valley interaction input preflight ready');
})();
