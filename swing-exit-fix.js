(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV) return;

  let wasOnSwing = false;
  let lastSwingPosition = null;

  TV.registerUpdateHook(() => {
    const onSwing = Boolean(TV.state.seated && TV.state.seat?.userData?.label === 'swing');

    if (onSwing) {
      wasOnSwing = true;
      lastSwingPosition = { x: TV.player.position.x, z: TV.player.position.z };
      return;
    }

    if (!wasOnSwing) return;
    wasOnSwing = false;

    const base = lastSwingPosition || { x: TV.player.position.x, z: TV.player.position.z };
    lastSwingPosition = null;

    // Swing seats sit directly beneath the frame's overhead crossbar. The
    // generic seat dismount leaves the player inside that frame, so always step
    // them out through the open front of the swing set before normal movement
    // resumes.
    const exitX = base.x;
    const exitZ = base.z + 2.15;
    TV.player.position.set(exitX, TV.terrainHeight(exitX, exitZ), exitZ);
    TV.playerVelocity.set(0, 0, 0);
    TV.state.jumpVelocity = 0;
    TV.state.grounded = true;
    TV.state.cameraReady = false;
  });

  window.ToonValleySwingExitFix = Object.freeze({ active: true, exitDistance: 2.15 });
  console.info('Toon Valley swing exit fix ready');
})();
