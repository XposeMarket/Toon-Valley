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
  let lastPreflight = { phase: 'idle', prompt: null, error: null };

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
    lastPreflight = { phase: 'releasing', prompt: item.prompt || '', error: null };

    try {
      nativeExitPointerLock?.call(document);
      lastPreflight = { phase: 'released', prompt: item.prompt || '', error: null };
    } catch (error) {
      interactionPreflight = false;
      lastPreflight = { phase: 'release-error', prompt: item.prompt || '', error: String(error?.stack || error) };
      console.warn('UI interaction Pointer Lock preflight failed', error);
      queueMicrotask(revealResumeAfterModal);
      return true;
    }

    setTimeout(() => {
      if (!TV.state.started) {
        interactionPreflight = false;
        lastPreflight = { phase: 'cancelled', prompt: item.prompt || '', error: 'game-not-started' };
        queueMicrotask(revealResumeAfterModal);
        return;
      }
      lastPreflight = { phase: 'executing', prompt: item.prompt || '', error: null };
      try {
        action();
        lastPreflight = { phase: modalUIVisible() || TV.state.modalOpen ? 'opened' : 'executed', prompt: item.prompt || '', error: null };
      } catch (error) {
        lastPreflight = { phase: 'action-error', prompt: item.prompt || '', error: String(error?.stack || error) };
        console.error('Deferred UI interaction failed', error);
      } finally {
        interactionPreflight = false;
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

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (TV.state.modalOpen || modalUIVisible()) return;
    preflightUIInteraction(event, TV.state.nearestInteractable);
  }, true);

  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) return;
    if (interactionPreflight || TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

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
    preflightState: () => ({ ...lastPreflight }),
    interactionOpensModal,
    forceModalRelease: () => releaseModalPointerLock(document)
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
