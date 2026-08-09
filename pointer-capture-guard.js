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

  const heldKeys = new Set();
  let pendingModalExit = null;
  let pendingExitFallback = 0;
  let deferredUntilKeyup = 0;

  function flushPendingModalExit() {
    if (!pendingModalExit || heldKeys.has('KeyE')) return;
    const { nativeExit, doc } = pendingModalExit;
    pendingModalExit = null;
    if (pendingExitFallback) clearTimeout(pendingExitFallback);
    pendingExitFallback = 0;
    setTimeout(() => {
      try { nativeExit.call(doc); }
      catch (error) { console.warn('Deferred modal Pointer Lock release failed', error); }
    }, 0);
  }

  document.addEventListener('keydown', (event) => heldKeys.add(event.code), true);
  document.addEventListener('keyup', (event) => {
    heldKeys.delete(event.code);
    if (event.code === 'KeyE') flushPendingModalExit();
  }, true);
  window.addEventListener('blur', () => {
    heldKeys.clear();
    flushPendingModalExit();
  });

  const documentProto = globalThis.Document?.prototype;
  const nativeExitPointerLock = documentProto?.exitPointerLock;
  let modalExitDeferred = Boolean(nativeExitPointerLock?.__toonValleyModalDeferred);
  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitDeferred) {
    function safeExitPointerLock() {
      if (!TV.DEVICE.touch && TV.state.modalOpen && document.pointerLockElement) {
        if (heldKeys.has('KeyE')) {
          pendingModalExit = { nativeExit: nativeExitPointerLock, doc: this };
          deferredUntilKeyup++;
          if (pendingExitFallback) clearTimeout(pendingExitFallback);
          pendingExitFallback = setTimeout(() => {
            heldKeys.delete('KeyE');
            flushPendingModalExit();
          }, 650);
          return undefined;
        }
        const doc = this;
        setTimeout(() => {
          try { nativeExitPointerLock.call(doc); }
          catch (error) { console.warn('Deferred modal Pointer Lock release failed', error); }
        }, 0);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    safeExitPointerLock.__toonValleyModalDeferred = true;
    documentProto.exitPointerLock = safeExitPointerLock;
    modalExitDeferred = true;
  }

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const pauseScreen = document.getElementById('pause-screen');
  let resumeAfterModal = false;
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

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (TV.state.modalOpen || modalUIVisible()) {
      armResumeAfterModal();
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
    modalExitDeferred,
    keyupSafeModalExit: true,
    modalPauseSuppression: true,
    nativePointerLockEvents: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    armResumeAfterModal,
    resumePending: () => resumeAfterModal,
    suppressedModalUnlocks: () => modalUnlocksSuppressed,
    deferredUntilKeyup: () => deferredUntilKeyup
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
