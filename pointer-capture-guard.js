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
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Every modal system already marks ToonValley.state.modalOpen before it calls
  // document.exitPointerLock(). Suppress only that deliberate unlock so the core
  // pause listener cannot cover the dialog. Ordinary Esc/unfocus unlocks continue
  // to reach the core listener unchanged.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      modalUnlocksSuppressed++;
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

  // Closing the final dialog does not create another pointerlockchange event. Once
  // modal state and DOM are both clear, deliberately expose the normal Resume UI.
  const observer = new MutationObserver(() => queueMicrotask(revealResumeAfterModal));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    nativeModalLifecycle: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
