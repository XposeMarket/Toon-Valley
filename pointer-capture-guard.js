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

  function prepareModalInteraction() {
    if (TV.DEVICE.touch || !TV.state.started) return false;
    interactionUnlockPending = true;
    armResumeAfterModal();
    if (gamePointerLocked()) {
      try {
        document.exitPointerLock();
      } catch (error) {
        interactionUnlockPending = false;
        console.error('Unable to release Pointer Lock before modal interaction', error);
        return false;
      }
      return true;
    }
    interactionUnlockPending = false;
    return false;
  }

  function modalInteractionReady() {
    return !gamePointerLocked();
  }

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked() || interactionUnlockPending) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Run from window capture so intentional UI unlocks are intercepted before the
  // core document-level pause handler. Preflight unlocks happen before the modal
  // exists, so interactionUnlockPending is part of the suppression condition.
  window.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (interactionUnlockPending || TV.state.modalOpen || modalUIVisible()) {
      event.stopImmediatePropagation();
      armResumeAfterModal();
      interactionUnlockPending = false;
      modalUnlocksSuppressed++;
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
