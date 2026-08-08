(() => {
  'use strict';

  const TV = window.ToonValley;
  const elementProto = globalThis.Element?.prototype;
  const nativeCapture = elementProto?.setPointerCapture;
  let captureGuarded = Boolean(nativeCapture?.__toonValleyGuarded);

  if (elementProto && typeof nativeCapture === 'function' && !captureGuarded) {
    function guardedSetPointerCapture(pointerId) {
      try {
        return nativeCapture.call(this, pointerId);
      } catch (error) {
        // Mobile Safari and synthetic/browser-emulated touch streams can lose the
        // active pointer between pointerdown and capture. Losing capture should end
        // a drag gracefully, not crash camera/game input.
        if (error?.name === 'NotFoundError' || error?.name === 'InvalidStateError') return undefined;
        throw error;
      }
    }
    guardedSetPointerCapture.__toonValleyGuarded = true;
    elementProto.setPointerCapture = guardedSetPointerCapture;
    captureGuarded = true;
  }

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  let resumeAfterModal = false;

  function gamePointerLocked() {
    return Boolean(TV?.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  }

  function modalUIVisible() {
    return Boolean(document.querySelector(modalSelector));
  }

  function hidePauseDuringModal() {
    document.getElementById('pause-screen')?.classList.add('hidden');
  }

  function showResumeAfterFinalModal() {
    if (!resumeAfterModal || TV?.DEVICE?.touch || !TV?.state?.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    // Re-requesting Pointer Lock from the same click that closes a DOM dialog is
    // browser-sensitive and can wedge Chromium/WebKit. The stable flow is explicit:
    // release for the dialog, suppress Pause while the dialog exists, then expose
    // the normal Resume control once the final dialog is gone.
    document.getElementById('pause-screen')?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Core game listener runs first and may briefly reveal Pause on unlock. This
  // listener corrects that state without cancelling pointerlockchange for any of
  // the other input/UI modules.
  document.addEventListener('pointerlockchange', () => {
    if (!TV || TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      resumeAfterModal = false;
      return;
    }
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePauseDuringModal();
    }
  });

  // Modal replacements can remove one overlay and add the next in the same task.
  // Defer one microtask so only the actual final close reveals Resume.
  const observer = new MutationObserver(() => {
    if (!TV || TV.DEVICE.touch || !resumeAfterModal) return;
    queueMicrotask(() => showResumeAfterFinalModal());
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  // Some modal code clears modalOpen after removing the node. Event listeners run
  // after target handlers, so this catches that final state deterministically.
  for (const type of ['click', 'keydown']) {
    document.addEventListener(type, () => queueMicrotask(() => showResumeAfterFinalModal()));
  }

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    nativeExitPointerLock: true,
    resumePending: () => resumeAfterModal
  });
  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
