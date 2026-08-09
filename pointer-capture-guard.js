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
  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  let suppressedUnlocks = 0;

  const gamePointerLocked = () => document.pointerLockElement === TV.renderer?.domElement;
  const modalVisible = () => Boolean(document.querySelector(modalSelector));
  const modalActive = () => Boolean(TV.state.modalOpen || modalVisible());

  function hidePauseForModal() {
    if (TV.DEVICE.touch || !modalActive()) return;
    pauseScreen?.classList.add('hidden');
  }

  function syncPauseAfterModal() {
    if (TV.DEVICE.touch || !TV.state.started || modalActive() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
  }

  // Modal/popover interactions intentionally release Pointer Lock so the mouse can
  // operate the UI. Consume only that unlock before the core bubble listener turns
  // it into a pause overlay. Ordinary Esc/unlock behavior continues unchanged.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch || gamePointerLocked() || !modalActive()) return;
    hidePauseForModal();
    suppressedUnlocks++;
    event.stopImmediatePropagation();
  }, true);

  // Closing the final modal leaves Pointer Lock released by design. Surface the
  // normal Resume affordance once the UI is gone instead of silently freezing input.
  const observer = new MutationObserver(() => queueMicrotask(() => {
    hidePauseForModal();
    syncPauseAfterModal();
  }));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible,
    modalActive,
    suppressedModalUnlocks: () => suppressedUnlocks,
    syncPauseAfterModal
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
