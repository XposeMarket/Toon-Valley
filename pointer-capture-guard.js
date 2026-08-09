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
  let interactionUnlockPending = false;
  let unlockTimer = 0;
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

  function completeObservedUnlock() {
    if (!interactionUnlockPending || gamePointerLocked()) return false;
    interactionUnlockPending = false;
    modalUnlocksSuppressed++;
    armResumeAfterModal();
    hidePause();
    return true;
  }

  function prepareModalInteraction() {
    if (TV.DEVICE.touch || !TV.state.started) return false;
    interactionUnlockPending = true;
    armResumeAfterModal();
    clearTimeout(unlockTimer);
    if (gamePointerLocked()) {
      // Do not call exitPointerLock from inside the keyboard event dispatch. Some
      // Chromium/WebGL combinations can stall the page when Pointer Lock exits
      // synchronously from keyup. Release on the next task, then build UI only
      // after the browser reports (or exposes) the unlocked state.
      unlockTimer = setTimeout(() => {
        unlockTimer = 0;
        try {
          if (gamePointerLocked()) document.exitPointerLock();
          else completeObservedUnlock();
        } catch (error) {
          interactionUnlockPending = false;
          console.error('Unable to release Pointer Lock before modal interaction', error);
        }
      }, 0);
      return true;
    }
    interactionUnlockPending = false;
    return false;
  }

  function modalInteractionReady() {
    if (!gamePointerLocked()) completeObservedUnlock();
    return !gamePointerLocked() && !interactionUnlockPending;
  }

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked() || interactionUnlockPending) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  window.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (interactionUnlockPending || TV.state.modalOpen || modalUIVisible()) {
      event.stopImmediatePropagation();
      if (!completeObservedUnlock()) {
        armResumeAfterModal();
        modalUnlocksSuppressed++;
      }
    }
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(revealResumeAfterModal));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    consumesModalPointerLockChange: true,
    explicitResumeAfterModal: true,
    preflightModalUnlock: true,
    deferredPointerLockExit: true,
    observedUnlockFallback: true,
    modalVisible: modalUIVisible,
    prepareModalInteraction,
    modalInteractionReady,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    interactionUnlockPending: () => interactionUnlockPending,
    suppressedModalUnlocks: () => modalUnlocksSuppressed
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
