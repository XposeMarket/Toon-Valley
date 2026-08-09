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

  function suspendRenderForModal() { return false; }
  function restoreRenderAfterModal() { return false; }

  function armResumeAfterModal() {
    // Only a genuine gameplay Pointer Lock handoff needs a resume gate. This keeps
    // keyboard-opened UI safe in browsers/tests where the mouse was already free,
    // and prevents a modal close from inventing a pause state that did not exist.
    if (TV.DEVICE.touch || !TV.state.started || !gamePointerLocked()) return false;
    resumeAfterModal = true;
    hidePause();
    return true;
  }

  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      if (!TV.state.modalOpen) resumeAfterModal = false;
      return;
    }
    if (resumeAfterModal || TV.state.modalOpen) {
      modalUnlocksSuppressed++;
      if (resumeAfterModal) hidePause();
    }
  });

  function syncPauseAfterModal() {
    if (TV.state.modalOpen) {
      if (!TV.DEVICE.touch && resumeAfterModal) hidePause();
      return;
    }

    if (TV.DEVICE.touch || !TV.state.started || !resumeAfterModal) return;
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
    keepsRenderWorkDuringModal: true,
    keepsWebGLSurfaceDuringModal: true,
    suspendsRenderWorkForModal: false,
    preModalRenderSuspension: false,
    removesWebGLSurfaceDuringModal: false,
    modalVisible,
    modalActive,
    gamePointerLocked,
    suspendRenderForModal,
    restoreRenderAfterModal,
    renderSuspended: () => false,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
