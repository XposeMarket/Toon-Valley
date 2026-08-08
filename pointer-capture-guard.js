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
  let modalExitDeferred = Boolean(nativeExitPointerLock?.__toonValleyDeferredModalExit);
  let modalExitTimer = 0;
  if (documentProto && typeof nativeExitPointerLock === 'function' && !modalExitDeferred) {
    function guardedExitPointerLock() {
      // Fallback for programmatic modal opens. Normal desktop E interactions that
      // open UI are pre-released below, so life.js reaches this only when some other
      // caller creates a modal while still locked.
      if (window.ToonValley?.state?.modalOpen) {
        const doc = this;
        clearTimeout(modalExitTimer);
        modalExitTimer = setTimeout(() => {
          modalExitTimer = 0;
          if (!window.ToonValley?.state?.modalOpen || !doc.pointerLockElement) return;
          try { nativeExitPointerLock.call(doc); }
          catch (error) { console.warn('Deferred modal Pointer Lock release failed', error); }
        }, 80);
        return undefined;
      }
      return nativeExitPointerLock.call(this);
    }
    guardedExitPointerLock.__toonValleyDeferredModalExit = true;
    documentProto.exitPointerLock = guardedExitPointerLock;
    modalExitDeferred = true;
  }

  const modalSelector = '.life-overlay,.mb-overlay,.ohx,#build-controls,#ohbuild,#bl-controls';
  const modalPrompts = [
    /^Talk to /,
    /^Browse counter$/,
    /^Order snack$/,
    /^Shop outdoor market$/,
    /^Browse market$/,
    /^Open job & property desk$/,
    /^Browse furniture catalog$/,
    /^Open decorating menu$/
  ];
  let pendingInteraction = null;
  let pendingReleaseTimer = 0;
  let resumeAfterModal = false;

  const gamePointerLocked = () => Boolean(TV.renderer?.domElement && document.pointerLockElement === TV.renderer.domElement);
  const modalUIVisible = () => Boolean(document.querySelector(modalSelector));
  const opensModal = (item) => Boolean(item && modalPrompts.some((pattern) => pattern.test(item.prompt || '')));
  const hidePause = () => document.getElementById('pause-screen')?.classList.add('hidden');

  function clearTemporaryModalGuard() {
    if (TV.state.modalOpen && !modalUIVisible()) TV.setModalOpen(false);
  }

  function runPendingInteraction() {
    if (!pendingInteraction || document.pointerLockElement) return;
    const item = pendingInteraction;
    pendingInteraction = null;
    clearTimeout(pendingReleaseTimer);
    pendingReleaseTimer = 0;
    clearTemporaryModalGuard();
    hidePause();

    // Run only after Pointer Lock is fully gone. The action can now build its DOM
    // popover without also changing Pointer Lock in the same call stack.
    requestAnimationFrame(() => {
      try {
        if (typeof item.enabled === 'function' && !item.enabled()) return;
        item.action?.();
      } catch (error) {
        console.error('Deferred popover interaction failed', error);
        clearTemporaryModalGuard();
        document.getElementById('pause-screen')?.classList.remove('hidden');
      }
    });
  }

  function preflightModalInteraction(event) {
    if (event.code !== 'KeyE' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (TV.DEVICE.touch || !TV.state.started || !gamePointerLocked() || TV.state.modalOpen || pendingInteraction) return;
    const item = TV.state.nearestInteractable;
    if (!opensModal(item) || typeof item.action !== 'function') return;
    if (typeof item.enabled === 'function' && !item.enabled()) return;

    // Consume only UI-producing E interactions. Physical quest/gesture E actions
    // continue to the core document listener untouched, preserving the shared queue.
    event.preventDefault();
    event.stopPropagation();
    pendingInteraction = item;
    resumeAfterModal = true;
    TV.setModalOpen(true); // temporary pause-suppression guard during unlock
    hidePause();

    try {
      if (typeof nativeExitPointerLock === 'function') nativeExitPointerLock.call(document);
      else document.exitPointerLock?.();
    } catch (error) {
      console.warn('Popover preflight Pointer Lock release failed', error);
      pendingInteraction = null;
      clearTemporaryModalGuard();
      document.getElementById('pause-screen')?.classList.remove('hidden');
      return;
    }

    // Some browsers can miss/delay pointerlockchange. If the lock is already gone,
    // this fallback advances the same guarded flow without duplicating the action.
    clearTimeout(pendingReleaseTimer);
    pendingReleaseTimer = setTimeout(runPendingInteraction, 180);
  }

  // Window capture runs before game.js' document KeyE handler. Only modal-producing
  // interactions are intercepted; every hands-on physical interaction remains core.
  window.addEventListener('keydown', preflightModalInteraction, true);

  function showResumeAfterFinalModal() {
    if (!resumeAfterModal || TV.DEVICE.touch || !TV.state.started) return;
    if (TV.state.modalOpen || modalUIVisible() || gamePointerLocked() || pendingInteraction) return;
    document.getElementById('pause-screen')?.classList.remove('hidden');
    resumeAfterModal = false;
  }

  document.addEventListener('pointerlockchange', () => {
    if (TV.DEVICE.touch) return;
    if (gamePointerLocked()) {
      resumeAfterModal = false;
      return;
    }
    if (pendingInteraction) {
      hidePause();
      runPendingInteraction();
      return;
    }
    if (TV.state.modalOpen || modalUIVisible()) {
      resumeAfterModal = Boolean(TV.state.started);
      hidePause();
    }
  });

  const observer = new MutationObserver(() => {
    if (TV.DEVICE.touch || !resumeAfterModal) return;
    queueMicrotask(showResumeAfterFinalModal);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  for (const type of ['click', 'keydown']) {
    document.addEventListener(type, () => queueMicrotask(showResumeAfterFinalModal));
  }

  window.ToonValleyPointerGuard = Object.freeze({
    active: captureGuarded,
    pointerCapture: captureGuarded,
    modalExitDeferred,
    modalExitDelayMs: 80,
    modalInteractionPreflight: true,
    modalPrompts: modalPrompts.map((pattern) => pattern.source),
    modalPauseSuppression: true,
    explicitResumeAfterModal: true,
    pendingInteraction: () => pendingInteraction?.prompt || null,
    resumePending: () => resumeAfterModal
  });
  console.info('Toon Valley pointer/input guard ready', window.ToonValleyPointerGuard);
})();
