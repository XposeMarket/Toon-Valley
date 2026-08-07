(() => {
  'use strict';

  const tv = window.ToonValley;
  if (!tv || typeof tv.registerUpdateHook !== 'function') return;

  // Keep the existing movement controller, stamina, input, and collision behavior
  // intact while making both walking and sprinting 20% faster.
  const EXTRA_MOVEMENT_SCALE = 0.20;

  tv.registerUpdateHook((dt) => {
    const { state, player, playerVelocity, renderer, DEVICE, isBlocked } = tv;
    if (!state.started || state.pausedByVisibility || state.modalOpen || state.seated) return;
    if (!DEVICE.touch && document.pointerLockElement !== renderer.domElement) return;

    const extraX = playerVelocity.x * dt * EXTRA_MOVEMENT_SCALE;
    const extraZ = playerVelocity.z * dt * EXTRA_MOVEMENT_SCALE;
    if (Math.abs(extraX) + Math.abs(extraZ) < 1e-5) return;

    const oldX = player.position.x;
    const oldZ = player.position.z;
    const nextX = oldX + extraX;
    const nextZ = oldZ + extraZ;

    if (!isBlocked(nextX, nextZ)) {
      player.position.x = nextX;
      player.position.z = nextZ;
      return;
    }

    // Mirror the core controller's axis-by-axis slide behavior at obstacles.
    if (!isBlocked(nextX, oldZ)) player.position.x = nextX;
    if (!isBlocked(player.position.x, nextZ)) player.position.z = nextZ;
  });
})();
