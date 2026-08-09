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
  let unlockCompletionTimer = 0;
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
    // Never construct modal DOM from the pointerlockchange/microtask turn itself.
    // Chromium can deadlock if Pointer Lock teardown and focusable modal creation
    // overlap. The next task runs only after the native unlock event has settled.
    if (typeof action === 'function') setTimeout(action, 0);
  }

  function completeObservedUnlock() {
    if (!interactionUnlockPending || gamePointerLocked()) return false;
    interactionUnlockPending = false;
    clearTimeout(unlockCompletionTimer);
    unlockCompletionTimer = 0;
    modalUnlocksSuppressed++;
    armResumeAfterModal();
    hidePause();
    releasePendingAction();
    return true;
  }

  function watchForUnlock(attempt = 0) {
    clearTimeout(unlockCompletionTimer);
    unlockCompletionTimer = setTimeout(() => {
      unlockCompletionTimer = 0;
      if (!interactionUnlockPending) return;
      if (!gamePointerLocked()) {
        completeObservedUnlock();
        return;
      }
      if (attempt < 30) watchForUnlock(attempt + 1);
      else {
        interactionUnlockPending = false;
        pendingModalAction = null;
        console.error('Pointer Lock did not release before modal interaction');
      }
    }, attempt === 0 ? 0 : 16);
  }

  function prepareModalInteraction(action) {
    if (TV.DEVICE.touch || !TV.state.started) return false;
    pendingModalAction = typeof action === 'function' ? action : null;
    interactionUnlockPending = true;
    armResumeAfterModal();
    clearTimeout(unlockTimer);
    clearTimeout(unlockCompletionTimer);
    if (gamePointerLocked()) {
      // Exit on a separate task so native Pointer Lock never transitions inside
      // the E-key event stack. The document pointerlockchange signal is preferred,
      // while a short polling fallback handles browsers/runners that update
      // pointerLockElement without delivering that event reliably.
      unlockTimer = setTimeout(() => {
        unlockTimer = 0;
        try {
          if (gamePointerLocked()) document.exitPointerLock();
          if (!completeObservedUnlock()) watchForUnlock();
        } catch (error) {
          interactionUnlockPending = false;
          pendingModalAction = null;
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

  // pointerlockchange is a Document event. Let the core listener update its normal
  // pause state first, then repair intentional modal unlocks in the same event turn.
  // Modal construction itself is deferred to the following task by releasePendingAction.
  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (interactionUnlockPending || TV.state.modalOpen || modalUIVisible()) {
      if (!completeObservedUnlock()) {
        armResumeAfterModal();
        modalUnlocksSuppressed++;
      }
      hidePause();
    }
  });

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
    deferredModalConstruction: true,
    documentUnlockHandoff: true,
    unlockPollingFallback: true,
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
