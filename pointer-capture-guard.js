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

  const documentProto = globalThis.Document?.prototype;
  const nativeExitPointerLock = documentProto?.exitPointerLock;
  let modalExitDeferred = Boolean(nativeExitPointerLock?.__toonValleyDeferredModalExit);
  let modalExitTimer = 0;
  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitDeferred) {
    function guardedExitPointerLock() {
      // life.js builds the dialog and marks modalOpen before asking Pointer Lock to
      // exit. Give the original interaction a full event/paint boundary before
      // pointerlockchange can re-enter pause/UI code. A zero-delay task was still
      // close enough to wedge Chromium/WebKit on some interaction stacks.
      if (window.ToonValley?.state?.modalOpen) {
        const doc = this;
        clearTimeout(modalExitTimer);
        modalExitTimer = setTimeout(() => {
          modalExitTimer = 0;
          if (!window.ToonValley?.state?.modalOpen || !doc.pointerLockElement) return;
          try {
            nativeExitPointerLock.call(doc);
          } catch (error) {
            console.warn('Deferred modal Pointer Lock release failed', error);
          }
        }, 80);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyDeferredModalExit = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitDeferred = true;
  }

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  let resumeAfterModal = false;

  function gamePointerLocked() {
    return Boolean(TV?.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  }

  function modalUIVisible() {
    return Boolean(document.querySelector(modalSelector));
  }

  function hidePauseDuringModal() {
    document.getElementById('pause-screen')?.classList.add('hidden');
  }

  function showResumeAfterFinalModal() {
    if (!resumeAfterModal || TV?.DEVICE?.touch || !TV?.state?.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    // Re-requesting Pointer Lock from the same click that closes a DOM dialog is
    // browser-sensitive. Expose the normal Resume control instead so the next
    // explicit player gesture reacquires Pointer Lock reliably.
    document.getElementById('pause-screen')?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // The core game listener may briefly reveal Pause on unlock. Correct that state
  // after the deferred exit without cancelling pointerlockchange for any other
  // input/UI modules.
  document.addEventListener('pointerlockchange', () => {
    if (!TV || TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      resumeAfterModal = false;
      return;
    }
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePauseDuringModal();
    }
  });

  // Modal replacements can remove one overlay and add the next in the same task.
  // Defer one microtask so only the actual final close reveals Resume.
  const observer = new MutationObserver(() => {
    if (!TV || TV.DEVICE.touch || !resumeAfterModal) return;
    queueMicrotask(() => showResumeAfterFinalModal());
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  // Some modal code clears modalOpen after removing the node. Event listeners run
  // after target handlers, so this catches that final state deterministically.
  for (const type of ['click', 'keydown']) {
    document.addEventListener(type, () => queueMicrotask(() => showResumeAfterFinalModal()));
  }

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitDeferred,
    modalExitDelayMs: 80,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    resumePending: () => resumeAfterModal
  });
  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
