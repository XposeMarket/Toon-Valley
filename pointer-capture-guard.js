(() => {
  'use strict';
  const proto = globalThis.Element?.prototype;
  const nativeCapture = proto?.setPointerCapture;
  if (!proto || typeof nativeCapture !== 'function' || nativeCapture.__toonValleyGuarded) {
    window.ToonValleyPointerGuard = Object.freeze({ active: Boolean(nativeCapture?.__toonValleyGuarded) });
    return;
  }
  function guardedSetPointerCapture(pointerId) {
    try {
      return nativeCapture.call(this, pointerId);
    } catch (error) {
      // Mobile Safari and synthetic/browser-emulated touch streams can lose the
      // active pointer between pointerdown and capture. Losing capture should end
      // a drag gracefully, not crash camera/game input.
      if (error?.name === 'NotFoundError' || error?.name === 'InvalidStateError') return undefined;
      throw error;
    }
  }
  guardedSetPointerCapture.__toonValleyGuarded = true;
  proto.setPointerCapture = guardedSetPointerCapture;
  window.ToonValleyPointerGuard = Object.freeze({ active: true });
  console.info('Toon Valley pointer capture guard ready');
})();