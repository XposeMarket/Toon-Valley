(() => {
  'use strict';
  const elementProto = globalThis.Element?.prototype;
  const nativeCapture = elementProto?.setPointerCapture;
  let captureGuarded = Boolean(nativeCapture?.__toonValleyGuarded);
  if (elementProto && typeof nativeCapture === 'function' && !captureGuarded) {
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
    elementProto.setPointerCapture = guardedSetPointerCapture;
    captureGuarded = true;
  }

  const documentProto = globalThis.Document?.prototype;
  const nativeExit = documentProto?.exitPointerLock;
  let modalExitGuarded = Boolean(nativeExit?.__toonValleyModalGuarded);
  if (documentProto && typeof nativeExit === 'function' && !modalExitGuarded) {
    function guardedExitPointerLock() {
      // Life/shop/theater modals mark modalOpen before asking to release pointer
      // lock. Releasing synchronously from the same interaction call can re-enter
      // pointerlockchange while that UI is still being constructed. Defer only that
      // modal-opening case; ordinary Esc/pause pointer-lock behavior stays native.
      if (window.ToonValley?.state?.modalOpen) {
        const doc = this;
        setTimeout(() => {
          try { nativeExit.call(doc); } catch (error) { console.warn('Deferred pointer-lock release failed', error); }
        }, 0);
        return undefined;
      }
      return nativeExit.call(this);
    }
    guardedExitPointerLock.__toonValleyModalGuarded = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitGuarded = true;
  }

  // Modal/popover interactions deliberately release pointer lock so the mouse can
  // operate the UI. The core game's pointerlockchange listener normally interprets
  // any unlock as a pause request. Intercept that event during a modal release so
  // the pause screen cannot cover the popover and make the game appear to crash.
  document.addEventListener('pointerlockchange', (event) => {
    if (!window.ToonValley?.state?.modalOpen) return;
    document.getElementById('pause-screen')?.classList.add('hidden');
    event.stopImmediatePropagation();
  }, true);

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExit: modalExitGuarded,
    modalPauseSuppression: true
  });
  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();