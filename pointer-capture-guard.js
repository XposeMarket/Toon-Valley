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
  const gameSurface = document.getElementById('game');
  let resumeAfterModal = false;
  let modalRenderSuspended = false;
  let modalUnlocksSuppressed = 0;
  let previousGameDisplay = '';

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalVisible = () => Boolean(document.querySelector('.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls'));
  const modalActive = () => Boolean(TV.state.modalOpen || modalVisible());
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function suspendRenderForModal() {
    if (modalRenderSuspended) return;
    modalRenderSuspended = true;
    TV.state.pausedByVisibility = true;
    // Some Chromium/iGPU combinations can hard-stall when a DOM overlay is
    // composited over a live WebGL surface even if rendering itself is paused.
    // Remove the canvas surface from compositing for the lifetime of the modal.
    if (gameSurface) {
      previousGameDisplay = gameSurface.style.display;
      gameSurface.style.display = 'none';
    }
  }

  function restoreRenderAfterModal() {
    if (!modalRenderSuspended || TV.state.modalOpen) return false;
    modalRenderSuspended = false;
    if (gameSurface) gameSurface.style.display = previousGameDisplay;
    TV.state.pausedByVisibility = Boolean(document.hidden);
    TV.state.cameraReady = false;
    return true;
  }

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
    if (TV.state.modalOpen) {
      suspendRenderForModal();
      if (!TV.DEVICE.touch) hidePause();
      return;
    }

    restoreRenderAfterModal();

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
    suspendsRenderWorkForModal: true,
    preModalRenderSuspension: true,
    removesWebGLSurfaceDuringModal: true,
    modalVisible,
    modalActive,
    suspendRenderForModal,
    restoreRenderAfterModal,
    renderSuspended: () => modalRenderSuspended,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
