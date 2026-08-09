(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) return;

  const elementProto = globalThis.Element?.prototype;
  const nativeCapture = elementProto?.setPointerCapture;
  let captureGuarded = Boolean(nativeCapture?.__toonValleyGuarded);
  if (elementProto && typeof nativeCapture === 'function' && !captureGuarded) {
    function guardedSetPointerCapture(pointerId) {
      try {
        return nativeCapture.call(this, pointerId);
      } catch (error) {
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
      // Modal/popover actions are allowed to complete first. Releasing Pointer Lock
      // from a later task avoids re-entering pointerlockchange while the interaction
      // call stack is still constructing UI.
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
        }, 0);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyDeferredModalExit = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitDeferred = true;
  }

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  // The core pointerlockchange listener treats every unlock as a pause. Modal unlocks
  // are intentional, so intercept those unlock events before the core listener can
  // place the pause screen over the popover.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      resumeAfterModal = false;
      return;
    }
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Modal implementations remove/replace DOM synchronously. Observe those changes
  // and reveal the normal Resume screen only after the final modal is truly gone.
  const observer = new MutationObserver(() => queueMicrotask(revealResumeAfterModal));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitDeferred,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
