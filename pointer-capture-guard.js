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

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function scheduleModalPointerRelease(doc = document) {
    if (TV.DEVICE.touch || !TV.state.started) return;
    if (!(TV.state.modalOpen || modalUIVisible()) || !doc.pointerLockElement) return;
    clearTimeout(modalExitTimer);
    modalExitTimer = setTimeout(() => {
      modalExitTimer = 0;
      if (!(TV.state.modalOpen || modalUIVisible()) || !doc.pointerLockElement) return;
      try {
        nativeExitPointerLock?.call(doc);
      } catch (error) {
        console.warn('Deferred modal Pointer Lock release failed', error);
      }
    }, 0);
  }

  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitDeferred) {
    function guardedExitPointerLock() {
      // UI-producing interactions may ask to release Pointer Lock while their modal
      // DOM is still being created. Defer that release until the interaction stack
      // has unwound so pointerlockchange cannot re-enter the pause/UI path mid-build.
      if (window.ToonValley?.state?.modalOpen || modalUIVisible()) {
        scheduleModalPointerRelease(this);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyDeferredModalExit = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitDeferred = true;
  }

  // The core pointerlockchange listener treats every unlock as a pause. Modal unlocks
  // are intentional, so intercept those unlock events before the core listener can
  // place the pause screen over the popover.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) return;
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

  // This observer is also the safety net for browser/platform-specific Pointer Lock
  // timing. If a modal exists but the canvas somehow stayed locked, release it on a
  // later task independently of the modal implementation's own exitPointerLock call.
  const observer = new MutationObserver(() => {
    if (TV.state.modalOpen || modalUIVisible()) scheduleModalPointerRelease(document);
    queueMicrotask(revealResumeAfterModal);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => {
    if (TV.state.modalOpen || modalUIVisible()) scheduleModalPointerRelease(document);
    queueMicrotask(revealResumeAfterModal);
  });
  document.addEventListener('keydown', () => {
    if (TV.state.modalOpen || modalUIVisible()) scheduleModalPointerRelease(document);
    queueMicrotask(revealResumeAfterModal);
  });

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitDeferred,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    forceModalRelease: () => scheduleModalPointerRelease(document)
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
