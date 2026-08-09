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
    queueMicrotask(hidePause);
  }

  // Let the browser perform native Pointer Lock transitions. The core listener may
  // momentarily reveal Pause on unlock; immediately repair that state whenever a
  // real modal is active. We deliberately avoid stopImmediatePropagation and avoid
  // monkey-patching exitPointerLock, both of which previously caused re-entry bugs.
  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (modalActive() || resumeAfterModal) {
      modalUnlocksSuppressed++;
      armResumeAfterModal();
      hidePause();
      queueMicrotask(hidePause);
    }
  });

  function syncPauseAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (modalActive() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  const observer = new MutationObserver(() => queueMicrotask(() => {
    if (modalActive()) hidePause();
    else syncPauseAfterModal();
  }));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(syncPauseAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(syncPauseAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    nativeModalExit: true,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible,
    modalActive,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
