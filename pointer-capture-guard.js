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
  let modalExitSynchronous = Boolean(nativeExitPointerLock?.__toonValleyModalExitGuard);

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function releaseModalPointerLock(doc = document) {
    if (TV.DEVICE.touch || !TV.state.started) return;
    if (!(TV.state.modalOpen || modalUIVisible()) || !doc.pointerLockElement) return;
    try {
      nativeExitPointerLock?.call(doc);
    } catch (error) {
      console.warn('Modal Pointer Lock release failed', error);
    }
  }

  // Life/shop/build UI sets modalOpen only after its DOM is fully constructed. At
  // that point it is safe to release Pointer Lock synchronously. A capture-phase
  // pointerlockchange listener below prevents the core pause handler from treating
  // this intentional unlock as an ordinary pause.
  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitSynchronous) {
    function guardedExitPointerLock() {
      if (window.ToonValley?.state?.modalOpen) {
        try {
          return nativeExitPointerLock.call(this);
        } catch (error) {
          console.warn('Modal Pointer Lock release failed', error);
          return undefined;
        }
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyModalExitGuard = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitSynchronous = true;
  }

  // The core pointerlockchange listener treats every unlock as a pause. Modal unlocks
  // are intentional, so intercept those events before the core non-capture listener
  // can place the pause screen over the popover.
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

  // Fallback for browsers with unusual Pointer Lock timing: once a modal mutation is
  // observable, independently ensure the canvas is unlocked. This no longer drives
  // the normal path and therefore cannot strand an interaction behind a timer.
  const observer = new MutationObserver(() => {
    if (TV.state.modalOpen || modalUIVisible()) releaseModalPointerLock(document);
    queueMicrotask(revealResumeAfterModal);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitSynchronous,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    forceModalRelease: () => releaseModalPointerLock(document)
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
