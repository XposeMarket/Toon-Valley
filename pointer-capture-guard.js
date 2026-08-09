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
  let pendingModalAction = null;
  let unlockTimer = 0;
  let observeTimer = 0;
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

  function releasePendingAction() {
    const action = pendingModalAction;
    pendingModalAction = null;
    if (typeof action === 'function') setTimeout(action, 0);
  }

  function completeObservedUnlock() {
    if (!interactionUnlockPending || gamePointerLocked()) return false;
    interactionUnlockPending = false;
    clearTimeout(observeTimer);
    observeTimer = 0;
    modalUnlocksSuppressed++;
    armResumeAfterModal();
    hidePause();
    releasePendingAction();
    return true;
  }

  function observeUnlock(startedAt) {
    if (completeObservedUnlock()) return;
    if (!interactionUnlockPending) return;
    if (performance.now() - startedAt > 1800) {
      interactionUnlockPending = false;
      pendingModalAction = null;
      console.error('Toon Valley modal interaction Pointer Lock release timed out');
      return;
    }
    observeTimer = setTimeout(() => observeUnlock(startedAt), 12);
  }

  function prepareModalInteraction(action) {
    if (TV.DEVICE.touch || !TV.state.started) return false;
    pendingModalAction = typeof action === 'function' ? action : null;
    interactionUnlockPending = true;
    armResumeAfterModal();
    clearTimeout(unlockTimer);
    clearTimeout(observeTimer);
    if (gamePointerLocked()) {
      const startedAt = performance.now();
      // Arm the observer before asking Chromium to exit Pointer Lock. In some
      // WebGL/Pointer-Lock paths the native exit can abandon the remainder of the
      // current task even though the page stays alive; pre-arming this callback
      // guarantees the modal handoff survives that transition.
      observeTimer = setTimeout(() => observeUnlock(startedAt), 12);
      unlockTimer = setTimeout(() => {
        unlockTimer = 0;
        try {
          if (gamePointerLocked()) document.exitPointerLock();
          else completeObservedUnlock();
        } catch (error) {
          interactionUnlockPending = false;
          pendingModalAction = null;
          clearTimeout(observeTimer);
          observeTimer = 0;
          console.error('Unable to release Pointer Lock before modal interaction', error);
        }
      }, 0);
      return true;
    }
    interactionUnlockPending = false;
    releasePendingAction();
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
    prearmedUnlockObserver: true,
    ownsModalActionHandoff: true,
    modalVisible: modalUIVisible,
    prepareModalInteraction,
    modalInteractionReady,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    interactionUnlockPending: () => interactionUnlockPending,
    modalActionPending: () => Boolean(pendingModalAction),
    suppressedModalUnlocks: () => modalUnlocksSuppressed
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
