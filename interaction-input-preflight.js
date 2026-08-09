(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  const pauseScreen = document.getElementById('pause-screen');
  let pendingInteraction = null;
  let pendingSince = 0;
  let unlockCount = 0;
  let physicalRelockCount = 0;
  let uiOpenCount = 0;
  let lastPrompt = null;
  let lastError = null;

  const hidePause = () => pauseScreen?.classList.add('hidden');
  const gamePointerLocked = () => document.pointerLockElement === TV.renderer?.domElement;
  const modalVisible = () => Boolean(window.ToonValleyPointerGuard?.modalVisible?.() || document.querySelector('.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls'));

  function worldPosition(item) {
    if (!item.object) return { x: item.x, z: item.z };
    if (typeof item.object.getWorldPosition === 'function' && TV.THREE?.Vector3) {
      const point = new TV.THREE.Vector3();
      item.object.getWorldPosition(point);
      return { x: point.x, z: point.z };
    }
    return { x: item.object.position.x, z: item.object.position.z };
  }

  function nearestInteraction() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const item of TV.interactables || []) {
      if (item.area !== TV.state.area) continue;
      if (item.enabled && !item.enabled()) continue;
      const point = worldPosition(item);
      const distance = Math.hypot(TV.player.position.x - point.x, TV.player.position.z - point.z);
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

  function executePending() {
    if (!pendingInteraction || gamePointerLocked()) return false;
    const interaction = pendingInteraction;
    pendingInteraction = null;
    pendingSince = 0;
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

    queueMicrotask(() => {
      hidePause();
      if (TV.state.modalOpen || modalVisible()) {
        uiOpenCount++;
        window.ToonValleyPointerGuard?.armResumeAfterModal?.();
      } else {
        setTimeout(relockPhysicalInteraction, 0);
      }
    });
    return true;
  }

  function flushPending() {
    if (!pendingInteraction) return;
    hidePause();
    if (executePending()) return;
    if (performance.now() - pendingSince > 1200) {
      const prompt = pendingInteraction.prompt || 'interaction';
      pendingInteraction = null;
      pendingSince = 0;
      lastError = `Pointer Lock did not release for ${prompt}`;
      console.warn(lastError);
      return;
    }
    requestAnimationFrame(flushPending);
  }

  function beginPreflight(interaction) {
    if (pendingInteraction || !interaction || typeof interaction.action !== 'function') return false;
    pendingInteraction = interaction;
    pendingSince = performance.now();
    unlockCount++;
    hidePause();

    try {
      document.exitPointerLock?.();
    } catch (error) {
      lastError = String(error?.stack || error?.message || error);
      console.warn('Pointer Lock preflight release failed', error);
      pendingInteraction = null;
      pendingSince = 0;
      return false;
    }

    queueMicrotask(flushPending);
    requestAnimationFrame(flushPending);
    return true;
  }

  function interact() {
    if (TV.DEVICE.touch || !TV.state.started || TV.state.modalOpen || !gamePointerLocked()) return false;
    return beginPreflight(nearestInteraction());
  }

  document.addEventListener('pointerlockchange', () => {
    if (!gamePointerLocked()) queueMicrotask(flushPending);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat) return;
    if (!interact()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.ToonValleyInteractionInputPreflight = Object.freeze({
    active: true,
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
