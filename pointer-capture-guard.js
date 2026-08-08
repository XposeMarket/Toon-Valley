(() => {
  'use strict';

  const TV = window.ToonValley;
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

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  let restoreGameplayPointerLock = false;
  let restoreFallbackTimer = 0;

  function gamePointerLocked() {
    return Boolean(TV?.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  }

  function modalUIVisible() {
    return Boolean(document.querySelector(modalSelector));
  }

  function keepPauseScreenOutOfModalFlow() {
    document.getElementById('pause-screen')?.classList.add('hidden');
  }

  function clearRestoreFallback() {
    if (restoreFallbackTimer) clearTimeout(restoreFallbackTimer);
    restoreFallbackTimer = 0;
  }

  function showExplicitResumeFallback() {
    clearRestoreFallback();
    if (!restoreGameplayPointerLock || TV?.DEVICE?.touch || !TV?.state?.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    // Never leave desktop gameplay in the old invisible-paused state. If the
    // browser refuses an automatic Pointer Lock restore, show the normal Resume
    // overlay so the player has an obvious user-gesture path back into the game.
    document.getElementById('pause-screen')?.classList.remove('hidden');
    restoreGameplayPointerLock = false;
  }

  function restorePointerLockAfterFinalModal() {
    if (!restoreGameplayPointerLock || TV?.DEVICE?.touch || !TV?.state?.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;

    keepPauseScreenOutOfModalFlow();
    const canvas = TV.renderer?.domElement;
    if (!canvas?.requestPointerLock) return showExplicitResumeFallback();

    try {
      const request = canvas.requestPointerLock();
      request?.catch?.(() => showExplicitResumeFallback());
    } catch (_) {
      return showExplicitResumeFallback();
    }

    clearRestoreFallback();
    restoreFallbackTimer = setTimeout(() => {
      if (gamePointerLocked()) {
        restoreGameplayPointerLock = false;
        clearRestoreFallback();
      } else {
        showExplicitResumeFallback();
      }
    }, 450);
  }

  // The core game listener was registered before this module, so this listener
  // runs afterwards without suppressing any other pointer-lock consumers. When a
  // modal deliberately releases Pointer Lock, hide the pause overlay and remember
  // that gameplay should be restored after the final modal/build UI closes.
  document.addEventListener('pointerlockchange', () => {
    if (!TV || TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      restoreGameplayPointerLock = false;
      clearRestoreFallback();
      return;
    }
    if (TV.state.modalOpen || modalUIVisible()) {
      restoreGameplayPointerLock = Boolean(TV.state.started);
      keepPauseScreenOutOfModalFlow();
    }
  });

  // Closing a popover normally happens inside one of these user-activation events.
  // Run after target handlers so life.js can remove/replace the modal first, then
  // restore Pointer Lock while the browser still considers the action user-driven.
  for (const type of ['pointerdown', 'click', 'keydown']) {
    document.addEventListener(type, () => restorePointerLockAfterFinalModal());
  }

  // Covers programmatic modal completion. Automatic Pointer Lock may be rejected
  // without a fresh gesture; the fallback timer then exposes the Resume overlay.
  const observer = new MutationObserver(() => {
    if (!TV || TV.DEVICE.touch) return;
    if (!TV.state.modalOpen && !modalUIVisible()) restorePointerLockAfterFinalModal();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    modalPointerRestore: true,
    nativeExitPointerLock: true,
    restorePending: () => restoreGameplayPointerLock
  });
  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
