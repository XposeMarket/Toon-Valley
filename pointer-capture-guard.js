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
  let modalUnlocksSuppressed = 0;
  let syncClock = 0;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const elementVisible = (element) => {
    if (!element || element.classList?.contains('hidden')) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const modalVisible = () => Array.from(document.querySelectorAll(modalSelector)).some(elementVisible);
  const modalActive = () => Boolean(TV.state.modalOpen || modalVisible());
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function armResumeAfterModal() {
    if (TV.DEVICE.touch || !TV.state.started) return;
    resumeAfterModal = true;
    hidePause();
  }

  // Keep native Pointer Lock semantics. When an interaction intentionally releases
  // the mouse before opening UI, suppress the core pause overlay without rewriting
  // Document.exitPointerLock or stopping propagation.
  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (modalActive() || resumeAfterModal) {
      modalUnlocksSuppressed++;
      armResumeAfterModal();
      hidePause();
    }
  });

  function syncPauseAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (modalActive()) {
      hidePause();
      return;
    }
    if (gamePointerLocked()) {
      resumeAfterModal = false;
      hidePause();
      return;
    }
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Avoid a subtree MutationObserver here. A modal insertion can be followed by
  // substantial UI DOM work; observing the entire body made that insertion part of
  // the modal lifecycle itself and could starve Chromium/Safari after a popover was
  // constructed. A cheap bounded frame check plus the user's closing input is enough
  // to keep Pause hidden while UI is open and expose Resume once it closes.
  TV.registerUpdateHook((dt) => {
    if (!resumeAfterModal) return;
    syncClock += dt;
    if (syncClock < 0.12) return;
    syncClock = 0;
    syncPauseAfterModal();
  });
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
    modalVisible,
    modalActive,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
