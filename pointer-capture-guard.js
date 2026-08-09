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
  let wrappedCount = 0;
  let scanElapsed = 0;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const hidePause = () => pauseScreen?.classList.add('hidden');

  function interactionOpensModal(item) {
    if (!item || typeof item.action !== 'function') return false;
    if (item.opensModal === true) return true;
    const prompt = item.prompt || '';
    if (/^Talk to /.test(prompt)) return true;
    if (/^(Browse counter|Order snack|Shop outdoor market|Open job & property desk|Browse furniture catalog|Open decorating menu|Buy ticket \/ see a film|Choose a short film)$/.test(prompt)) return true;
    const source = String(item.action);
    return /\b(openNPC|openShop|openCafeCounter|openOutdoorMarket|openJobs|openPhone|openTickets|choose)\b/.test(source);
  }

  function revealResumeAfterModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked()) return;
    pauseScreen?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  function wrapModalInteraction(item) {
    if (!interactionOpensModal(item) || item.userData?.tvModalPointerSafe) return;
    item.userData = item.userData || {};
    item.userData.tvModalPointerSafe = true;
    const action = item.action;
    item.action = (...args) => {
      if (TV.DEVICE.touch || !TV.state.started || !gamePointerLocked()) return action(...args);

      // Mark UI mode before releasing Pointer Lock. The core pointerlockchange
      // listener therefore cannot mistake this deliberate release for Esc/pause.
      resumeAfterModal = true;
      hidePause();
      TV.setModalOpen(true);
      try {
        document.exitPointerLock?.();
      } catch (error) {
        console.warn('Unable to release Pointer Lock before UI interaction', error);
      }

      setTimeout(() => {
        try {
          action(...args);
        } catch (error) {
          console.error('Deferred modal interaction failed', error);
          TV.setModalOpen(false);
        }
        if (!modalUIVisible() && TV.state.modalOpen) TV.setModalOpen(false);
        queueMicrotask(revealResumeAfterModal);
      }, 0);
    };
    wrappedCount++;
  }

  function scanModalInteractions() {
    for (const item of TV.interactables) wrapModalInteraction(item);
  }

  document.addEventListener('pointerlockchange', (event) => {
    if (TV.DEVICE.touch || gamePointerLocked()) return;
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
      event.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(revealResumeAfterModal));
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => queueMicrotask(revealResumeAfterModal));
  document.addEventListener('keydown', () => queueMicrotask(revealResumeAfterModal));

  scanModalInteractions();
  TV.registerUpdateHook((dt) => {
    scanElapsed += dt;
    if (scanElapsed >= 1) {
      scanElapsed = 0;
      scanModalInteractions();
    }
  });

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalPauseSuppression: true,
    modalInteractionWrapping: true,
    explicitResumeAfterModal: true,
    modalVisible: modalUIVisible,
    resumePending: () => resumeAfterModal,
    interactionOpensModal,
    wrappedCount: () => wrappedCount,
    rescan: scanModalInteractions
  });

  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
