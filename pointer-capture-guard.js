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

  const documentProto = globalThis.Document?.prototype;
  const nativeExitPointerLock = documentProto?.exitPointerLock;
  let modalExitDeferred = Boolean(nativeExitPointerLock?.__toonValleyModalExitGuard);

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;
  let releaseQueued = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function releaseModalPointerLock(doc = document) {
    if (releaseQueued || TV.DEVICE.touch || !TV.state.started) return;
    if (!(TV.state.modalOpen || modalUIVisible()) || !doc.pointerLockElement) return;
    releaseQueued = true;
    setTimeout(() => {
      releaseQueued = false;
      if (!(TV.state.modalOpen || modalUIVisible()) || !doc.pointerLockElement) return;
      try {
        nativeExitPointerLock?.call(doc);
      } catch (error) {
        console.warn('Modal Pointer Lock release failed', error);
      }
    }, 0);
  }

  // Exiting Pointer Lock synchronously from the same keyboard event that opens a
  // dialog can wedge Chromium/WebKit. Modal exits are therefore moved onto the next
  // task. Ordinary Esc/pause exits stay native and synchronous.
  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitDeferred) {
    function guardedExitPointerLock() {
      if (window.ToonValley?.state?.modalOpen) {
        releaseModalPointerLock(this);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyModalExitGuard = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitDeferred = true;
  }

  // The core pointerlockchange listener treats every unlock as a pause. Modal unlocks
  // are intentional, so intercept those events before the core non-capture listener
  // can place the pause screen over the popover.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) return;
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  // Fallback for browsers with unusual Pointer Lock timing: once a modal mutation is
  // observable, independently ensure the canvas is unlocked. The release remains
  // deferred so mutation delivery can never re-enter the keydown interaction stack.
  const observer = new MutationObserver(() => {
    if (TV.state.modalOpen || modalUIVisible()) releaseModalPointerLock(document);
    queueMicrotask(revealResumeAfterModal);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitDeferred,
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    forceModalRelease: () => releaseModalPointerLock(document)
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
