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

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;
  let modalExitPending = false;
  let modalUnlocksSuppressed = 0;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function armResumeAfterModal() {
    if (TV.DEVICE.touch || !TV.state.started) return;
    resumeAfterModal = true;
    hidePause();
    queueMicrotask(hidePause);
  }

  // Life/shop/phone overlays already construct their DOM and mark modalOpen before
  // calling document.exitPointerLock(). Defer only that modal-owned release until
  // the current interaction task has returned. This avoids both known failure modes:
  // unlocking before modal construction (Chromium focus deadlock) and releasing
  // Pointer Lock synchronously while the E-key interaction stack is still active.
  const documentProto = globalThis.Document?.prototype;
  const nativeExit = documentProto?.exitPointerLock;
  let modalExitGuarded = Boolean(nativeExit?.__toonValleyModalFirstGuarded);
  if (documentProto && typeof nativeExit === 'function' && !modalExitGuarded) {
    function guardedExitPointerLock() {
      const modalOwned = Boolean(TV.state.modalOpen || modalUIVisible());
      if (!modalOwned) return nativeExit.call(this);
      const doc = this;
      armResumeAfterModal();
      if (modalExitPending) return undefined;
      modalExitPending = true;
      setTimeout(() => {
        try {
          if (doc.pointerLockElement) nativeExit.call(doc);
          else modalExitPending = false;
        } catch (error) {
          modalExitPending = false;
          console.error('Deferred modal Pointer Lock release failed', error);
        }
      }, 0);
      return undefined;
    }
    guardedExitPointerLock.__toonValleyModalFirstGuarded = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitGuarded = true;
  }

  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (modalExitPending || TV.state.modalOpen || modalUIVisible() || resumeAfterModal) {
      modalExitPending = false;
      modalUnlocksSuppressed++;
      armResumeAfterModal();
      hidePause();
      queueMicrotask(hidePause);
    }
  });

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked() || modalExitPending) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  const observer = new MutationObserver(() => queueMicrotask(revealResumeAfterModal));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExit: modalExitGuarded,
    modalFirstLifecycle: true,
    deferredPointerLockExit: true,
    modalPauseSuppression: true,
    consumesModalPointerLockChange: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    modalExitPending: () => modalExitPending,
    suppressedModalUnlocks: () => modalUnlocksSuppressed
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
