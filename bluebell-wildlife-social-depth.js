(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  const S = window.ToonValleyBluebellWildlifeSocial;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState || !S?.getState) return;

  const root = TV.scene.getObjectByName('bluebell-wildlife');
  if (!root) return;
  const duckGroups = [1, 2, 3].map(i => root.getObjectByName(`bluebell-duck-${i}`)).filter(Boolean);
  const dragonGroups = [1, 2, 3, 4].map(i => root.getObjectByName(`bluebell-dragonfly-${i}`)).filter(Boolean);

  let elapsed = 0;
  let checkBackTurns = 0;
  let checkBackResponses = 0;
  let checkBackPeakTurn = 0;
  let checkBackDucklingCount = 0;
  const checkedDucklings = new Set();
  let handoffCorrections = 0;
  let handoffResponses = 0;
  let handoffPeakShift = 0;
  let handoffSwaps = 0;
  let handoffPhase = -1;
  let handoffPairSeparation = 0;
  const handoffLeads = new Set();

  function clampStep(dx, dz, maxStep) {
    const distance = Math.hypot(dx, dz);
    if (distance < .0001) return { x: 0, z: 0 };
    const step = Math.min(distance, maxStep);
    return { x: dx / distance * step, z: dz / distance * step };
  }

  function turnToward(group, x, z, dt, rate) {
    const dx = x - group.position.x;
    const dz = z - group.position.z;
    if (Math.hypot(dx, dz) < .001) return 0;
    const target = Math.atan2(dx, dz);
    let delta = target - group.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const turn = Math.max(-dt * rate, Math.min(dt * rate, delta));
    group.rotation.y += turn;
    return turn;
  }

  function applyAdultCheckBack(dt) {
    const player = TV.player?.position;
    const adult = duckGroups[0];
    const social = S.getState();
    const wildlife = W.getState();
    const adultState = wildlife.ducks?.[0];
    if (!player || !adult || !adultState || adultState.escape > 0 || social.shelterMemory <= .08) return;

    const playerDistance = Math.hypot(adult.position.x - player.x, adult.position.z - player.z);
    if (playerDistance >= 4.7 && playerDistance <= 8.2) return;

    let lagger = null;
    let laggerDistance = 0;
    for (let i = 1; i < duckGroups.length; i++) {
      const duck = duckGroups[i];
      const duckState = wildlife.ducks?.[i];
      if (!duck || !duckState || duckState.escape > 0) continue;
      const distance = Math.hypot(duck.position.x - adult.position.x, duck.position.z - adult.position.z);
      if (distance > laggerDistance) {
        laggerDistance = distance;
        lagger = { duck, index: i };
      }
    }
    if (!lagger || laggerDistance < .72) return;

    const turn = turnToward(adult, lagger.duck.position.x, lagger.duck.position.z, dt, 1.75);
    if (Math.abs(turn) > .0015) {
      checkBackTurns += 1;
      checkBackResponses += 1;
      checkBackPeakTurn = Math.max(checkBackPeakTurn, Math.abs(turn));
      checkedDucklings.add(lagger.index);
      checkBackDucklingCount = checkedDucklings.size;
    }
  }

  function eligibleDragonflies() {
    const player = TV.player?.position;
    const wildlife = W.getState();
    if (!player) return [];
    const entries = [];
    wildlife.dragonflies?.forEach((state, index) => {
      const group = dragonGroups[index];
      if (!group || state.perch > 0 || state.dodge > 0) return;
      const dx = group.position.x - player.x;
      const dz = group.position.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 3.05 || distance > 9.5) return;
      entries.push({ group, index, distance });
    });
    return entries.sort((a, b) => a.index - b.index).slice(0, 2);
  }

  function nudgeRadius(entry, targetRadius, lateral, dt) {
    const player = TV.player?.position;
    if (!player) return 0;
    const dx = entry.group.position.x - player.x;
    const dz = entry.group.position.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .001) return 0;
    const nx = dx / distance;
    const nz = dz / distance;
    const sx = -nz;
    const sz = nx;
    const desiredX = player.x + nx * targetRadius + sx * lateral;
    const desiredZ = player.z + nz * targetRadius + sz * lateral;
    const beforeX = entry.group.position.x;
    const beforeZ = entry.group.position.z;
    const step = clampStep(desiredX - beforeX, desiredZ - beforeZ, Math.min(.03, dt * .15));
    entry.group.position.x += step.x;
    entry.group.position.z += step.z;
    return Math.hypot(entry.group.position.x - beforeX, entry.group.position.z - beforeZ);
  }

  function applyInspectionHandoff(dt) {
    const pair = eligibleDragonflies();
    if (pair.length < 2) {
      handoffPhase = -1;
      return;
    }

    const phase = Math.floor(elapsed / 2.15) % 2;
    if (handoffPhase >= 0 && phase !== handoffPhase) handoffSwaps += 1;
    handoffPhase = phase;
    const lead = pair[phase];
    const wing = pair[1 - phase];
    handoffLeads.add(lead.index);

    const leadShift = nudgeRadius(lead, 3.55, .16, dt);
    const wingShift = nudgeRadius(wing, 5.35, -.2, dt);
    const maxShift = Math.max(leadShift, wingShift);
    if (maxShift > .0005) {
      handoffCorrections += 1;
      handoffResponses += 1;
      handoffPeakShift = Math.max(handoffPeakShift, maxShift);
    }
    handoffPairSeparation = Math.max(
      handoffPairSeparation,
      Math.hypot(lead.group.position.x - wing.group.position.x, lead.group.position.z - wing.group.position.z)
    );
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    applyAdultCheckBack(safeDt);
    applyInspectionHandoff(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      checkBackTurns,
      checkBackResponses,
      checkBackPeakTurn,
      checkBackDucklingCount,
      handoffCorrections,
      handoffResponses,
      handoffPeakShift,
      handoffSwaps,
      handoffPhase,
      handoffLeadCount: handoffLeads.size,
      handoffPairSeparation
    };
  }

  window.ToonValleyBluebellWildlifeSocialDepth = Object.freeze({
    active: true,
    adultFamilyCheckBack: true,
    alternatingInspectionLead: true,
    existingPopulationOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
