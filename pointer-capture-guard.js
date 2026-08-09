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
  let interactionPreflight = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function interactionOpensModal(item) {
    if (!item || typeof item.action !== 'function') return false;
    if (item.opensModal === true) return true;
    const prompt = item.prompt || '';
    if (/^Talk to /.test(prompt)) return true;
    if (/^(Browse counter|Order snack|Shop outdoor market|Open job & property desk|Browse furniture catalog|Open decorating menu)$/.test(prompt)) return true;
    const source = String(item.action);
    return /\b(openNPC|openShop|openCafeCounter|openOutdoorMarket|openJobs|openPhone)\b/.test(source);
  }

  function revealResumeAfterModal() {
    if (!resumeAfterModal || interactionPreflight || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  function preflightUIInteraction(event, item) {
    if (interactionPreflight || TV.DEVICE.touch || !TV.state.started || !gamePointerLocked()) return false;
    if (!interactionOpensModal(item)) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    interactionPreflight = true;
    resumeAfterModal = true;
    hidePause();
    const action = item.action;

    try {
      nativeExitPointerLock?.call(document);
    } catch (error) {
      interactionPreflight = false;
      console.warn('UI interaction Pointer Lock preflight failed', error);
      queueMicrotask(revealResumeAfterModal);
      return true;
    }

    setTimeout(() => {
      interactionPreflight = false;
      if (!TV.state.started || TV.state.modalOpen || modalUIVisible()) {
        queueMicrotask(revealResumeAfterModal);
        return;
      }
      try {
        action();
      } catch (error) {
        console.error('Deferred UI interaction failed', error);
      }
      queueMicrotask(revealResumeAfterModal);
    }, 0);
    return true;
  }

  function releaseModalPointerLock(doc = document) {
    if (releaseQueued || interactionPreflight || TV.DEVICE.touch || !TV.state.started) return;
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

  // If a modal is opened programmatically while Pointer Lock is still active, move
  // the release onto the next task. Ordinary Esc/pause exits remain native.
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

  // UI-producing E interactions are special: building a dialog and then exiting
  // Pointer Lock from the same keydown can wedge Chromium/WebKit. Release first,
  // suppress the normal pause transition, then invoke only the captured UI action on
  // the next task. Physical interactions are never intercepted and continue through
  // the shared interaction-experience gesture queue unchanged.
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (TV.state.modalOpen || modalUIVisible()) return;
    preflightUIInteraction(event, TV.state.nearestInteractable);
  }, true);

  // The core pointerlockchange listener treats every unlock as a pause. Modal and UI
  // preflight unlocks are intentional, so intercept them before the core listener.
  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) return;
    if (interactionPreflight || TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

  // Fallback for programmatic modal opens and unusual Pointer Lock timing.
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
    modalInteractionPreflight: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    preflightActive: () => interactionPreflight,
    interactionOpensModal,
    forceModalRelease: () => releaseModalPointerLock(document)
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
