(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  const P = window.ToonValleyBluebellWildlifePolish;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState || !P?.getState) return;

  const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
  if (!wildlifeRoot) return;

  const ducks = [1, 2, 3].map(i => wildlifeRoot.getObjectByName(`bluebell-duck-${i}`)).filter(Boolean);
  const dragons = [1, 2, 3, 4].map(i => wildlifeRoot.getObjectByName(`bluebell-dragonfly-${i}`)).filter(Boolean);

  let shelterCorrections = 0;
  let shelterResponses = 0;
  let shelterPeakCompression = 0;
  let postChaseSeparations = 0;
  let postChaseCorrections = 0;
  let postChasePeakLift = 0;
  let previousChaseActive = Boolean(P.getState().chaseActive);
  let separationBurst = null;

  function shelterTargets() {
    const adult = ducks[0];
    const player = TV.player?.position;
    if (!adult || !player) return [];
    const dx = player.x - adult.position.x;
    const dz = player.z - adult.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    const nx = dx / distance;
    const nz = dz / distance;
    const px = -nz;
    const pz = nx;
    return [
      { x: adult.position.x - nx * .54 + px * .24, z: adult.position.z - nz * .54 + pz * .24 },
      { x: adult.position.x - nx * .54 - px * .24, z: adult.position.z - nz * .54 - pz * .24 }
    ];
  }

  function applyDucklingShelter(dt, polishState) {
    const adultState = W.getState().ducks?.[0];
    if (!ducks[0] || ducks.length < 3 || adultState?.escape > 0 || polishState.watchExposure < .85) return;
    const targets = shelterTargets();
    targets.forEach((target, index) => {
      const duck = ducks[index + 1];
      const state = W.getState().ducks?.[index + 1];
      if (!duck || state?.escape > 0) return;
      const dx = target.x - duck.position.x;
      const dz = target.z - duck.position.z;
      const distance = Math.hypot(dx, dz);
      shelterPeakCompression = Math.max(shelterPeakCompression, Math.max(0, 1.35 - distance));
      if (distance < .045) return;
      const correction = Math.min(.075, dt * (.24 + Math.min(1, polishState.watchExposure) * .18), distance);
      duck.position.x += dx / distance * correction;
      duck.position.z += dz / distance * correction;
      duck.rotation.y += (ducks[0].rotation.y - duck.rotation.y) * Math.min(1, dt * 5);
      shelterCorrections += 1;
      if (distance > .22) shelterResponses += 1;
    });
  }

  function beginPostChaseSeparation() {
    if (dragons.length < 2) return;
    const ranked = dragons
      .map((dragon, index) => ({ index, bank: Math.abs(dragon.rotation.z || 0) }))
      .sort((a, b) => b.bank - a.bank)
      .slice(0, 2);
    if (ranked.length < 2) return;
    const a = dragons[ranked[0].index];
    const b = dragons[ranked[1].index];
    let dx = a.position.x - b.position.x;
    let dz = a.position.z - b.position.z;
    let distance = Math.hypot(dx, dz);
    if (distance < .001) {
      dx = 1;
      dz = 0;
      distance = 1;
    }
    separationBurst = {
      life: .85,
      indices: [ranked[0].index, ranked[1].index],
      nx: dx / distance,
      nz: dz / distance,
      baseY: [a.position.y, b.position.y]
    };
    postChaseSeparations += 1;
  }

  function updatePostChaseSeparation(dt, polishState) {
    const chaseActive = Boolean(polishState.chaseActive);
    if (previousChaseActive && !chaseActive) beginPostChaseSeparation();
    previousChaseActive = chaseActive;
    if (!separationBurst) return;

    separationBurst.life = Math.max(0, separationBurst.life - dt);
    const t = separationBurst.life / .85;
    separationBurst.indices.forEach((index, slot) => {
      const dragon = dragons[index];
      const state = W.getState().dragonflies?.[index];
      if (!dragon || state?.perch > 0 || state?.dodge > 0) return;
      const sign = slot === 0 ? 1 : -1;
      const sideStep = Math.min(.04, dt * (.12 + t * .14));
      dragon.position.x += separationBurst.nx * sideStep * sign;
      dragon.position.z += separationBurst.nz * sideStep * sign;
      const liftTarget = separationBurst.baseY[slot] + .18 + t * .17;
      dragon.position.y += (liftTarget - dragon.position.y) * Math.min(1, dt * 4.6);
      dragon.rotation.z += (sign * .16 * t - dragon.rotation.z) * Math.min(1, dt * 5.2);
      postChasePeakLift = Math.max(postChasePeakLift, dragon.position.y - separationBurst.baseY[slot]);
      postChaseCorrections += 1;
    });

    if (separationBurst.life <= 0) separationBurst = null;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    const polishState = P.getState();
    applyDucklingShelter(safeDt, polishState);
    updatePostChaseSeparation(safeDt, polishState);
  }

  function getState() {
    const targets = shelterTargets();
    return {
      shelterCorrections,
      shelterResponses,
      shelterPeakCompression,
      shelterDistances: targets.map((target, index) => {
        const duck = ducks[index + 1];
        return duck ? Math.hypot(target.x - duck.position.x, target.z - duck.position.z) : null;
      }),
      postChaseSeparations,
      postChaseCorrections,
      postChasePeakLift,
      separationActive: Boolean(separationBurst)
    };
  }

  TV.registerUpdateHook(advance);
  window.ToonValleyBluebellWildlifeSocial = Object.freeze({
    active: true,
    ducklingShelterFormation: true,
    postChaseSeparationClimb: true,
    advance,
    getState
  });
})();
