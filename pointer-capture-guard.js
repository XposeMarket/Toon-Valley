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

  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;
  let modalUnlocksSuppressed = 0;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalVisible = () => Boolean(document.querySelector('.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls'));
  const modalActive = () => Boolean(TV.state.modalOpen || modalVisible());
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function armResumeAfterModal() {
    if (TV.DEVICE.touch || !TV.state.started) return;
    resumeAfterModal = true;
    hidePause();
  }

  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      if (!TV.state.modalOpen) resumeAfterModal = false;
      return;
    }
    if (resumeAfterModal || TV.state.modalOpen) {
      modalUnlocksSuppressed++;
      resumeAfterModal = true;
      hidePause();
    }
  });

  function syncPauseAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen) {
      TV.state.pausedByVisibility = true;
      hidePause();
      return;
    }

    // The popover is gone; resume the lightweight game loop so the explicit
    // resume control and subsequent Pointer Lock transition stay responsive.
    // Preserve a real background-tab pause when the document itself is hidden.
    TV.state.pausedByVisibility = Boolean(document.hidden);

    if (gamePointerLocked()) {
      resumeAfterModal = false;
      hidePause();
      return;
    }
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  const syncAfterInput = () => setTimeout(syncPauseAfterModal, 0);
  document.addEventListener('click', syncAfterInput);
  document.addEventListener('keydown', syncAfterInput);
  document.addEventListener('pointerup', syncAfterInput);

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    nativeModalExit: true,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    observerFreeModalSync: true,
    renderLoopFreeModalSync: true,
    suspendsRenderWorkForModal: true,
    modalVisible,
    modalActive,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
