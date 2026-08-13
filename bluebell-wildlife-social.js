(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState) return;

  const root = TV.scene.getObjectByName('bluebell-wildlife');
  if (!root) return;
  const duckGroups = [1, 2, 3].map(i => root.getObjectByName(`bluebell-duck-${i}`)).filter(Boolean);
  const dragonGroups = [1, 2, 3, 4].map(i => root.getObjectByName(`bluebell-dragonfly-${i}`)).filter(Boolean);

  let elapsed = 0;
  let shelterCorrections = 0;
  let shelterResponses = 0;
  let shelterPeakShift = 0;
  const shelteredDucklings = new Set();
  let inspectionCorrections = 0;
  let inspectionTurns = 0;
  let inspectionResponses = 0;
  let inspectionPeakShift = 0;
  let inspectionHeightRange = 0;
  const inspectedDragonflies = new Set();

  function clampStep(dx, dz, maxStep) {
    const distance = Math.hypot(dx, dz);
    if (distance < .0001) return { x: 0, z: 0, distance };
    const step = Math.min(distance, maxStep);
    return { x: dx / distance * step, z: dz / distance * step, distance };
  }

  function applyDucklingShelter(dt) {
    const player = TV.player?.position;
    const state = W.getState();
    const adult = duckGroups[0];
    const adultState = state.ducks?.[0];
    if (!player || !adult || !adultState || adultState.escape > 0) return;

    const fromPlayerX = adult.position.x - player.x;
    const fromPlayerZ = adult.position.z - player.z;
    const playerDistance = Math.hypot(fromPlayerX, fromPlayerZ);
    if (playerDistance < 4.7 || playerDistance > 8.2 || playerDistance < .001) return;

    const awayX = fromPlayerX / playerDistance;
    const awayZ = fromPlayerZ / playerDistance;
    const sideX = -awayZ;
    const sideZ = awayX;

    for (let i = 1; i < duckGroups.length; i++) {
      const duck = duckGroups[i];
      const duckState = state.ducks?.[i];
      if (!duck || !duckState || duckState.escape > 0) continue;
      const side = i % 2 === 0 ? .3 : -.3;
      const desiredX = adult.position.x + awayX * (.82 + i * .08) + sideX * side;
      const desiredZ = adult.position.z + awayZ * (.82 + i * .08) + sideZ * side;
      const beforeX = duck.position.x;
      const beforeZ = duck.position.z;
      const step = clampStep(desiredX - beforeX, desiredZ - beforeZ, Math.min(.052, dt * .24));
      duck.position.x += step.x;
      duck.position.z += step.z;
      const moved = Math.hypot(duck.position.x - beforeX, duck.position.z - beforeZ);
      if (moved > .0005) {
        shelterCorrections += 1;
        shelterResponses += 1;
        shelterPeakShift = Math.max(shelterPeakShift, moved);
        shelteredDucklings.add(i);
        duck.rotation.y = Math.atan2(awayX, awayZ);
      }
    }
  }

  function applyDragonflyInspection(dt) {
    const player = TV.player?.position;
    if (!player || !dragonGroups.length) return;
    const state = W.getState();
    let candidate = null;

    state.dragonflies?.forEach((dragon, index) => {
      const group = dragonGroups[index];
      if (!group || dragon.perch > 0 || dragon.dodge > 0) return;
      const dx = group.position.x - player.x;
      const dz = group.position.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 3.1 || distance > 6.8) return;
      if (!candidate || distance < candidate.distance) candidate = { dragon, group, index, dx, dz, distance };
    });

    if (!candidate || candidate.distance < .001) return;
    const { group, index, dx, dz, distance } = candidate;
    const dirX = dx / distance;
    const dirZ = dz / distance;
    const sideX = -dirZ;
    const sideZ = dirX;
    const lateral = Math.sin(elapsed * 1.9 + index) * .32;
    const desiredRadius = 3.85;
    const desiredX = player.x + dirX * desiredRadius + sideX * lateral;
    const desiredZ = player.z + dirZ * desiredRadius + sideZ * lateral;
    const desiredY = TV.terrainHeight(desiredX, desiredZ) + 1.28 + Math.sin(elapsed * 3.4 + index) * .16;
    const beforeX = group.position.x;
    const beforeY = group.position.y;
    const beforeZ = group.position.z;
    const step = clampStep(desiredX - beforeX, desiredZ - beforeZ, Math.min(.055, dt * .27));
    group.position.x += step.x;
    group.position.z += step.z;
    group.position.y += (desiredY - group.position.y) * Math.min(1, dt * 2.8);

    const lookX = player.x - group.position.x;
    const lookZ = player.z - group.position.z;
    if (Math.hypot(lookX, lookZ) > .001) {
      const targetYaw = Math.atan2(lookX, lookZ);
      let delta = targetYaw - group.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const turn = Math.max(-dt * 2.1, Math.min(dt * 2.1, delta));
      group.rotation.y += turn;
      if (Math.abs(turn) > .002) inspectionTurns += 1;
    }

    const shift = Math.hypot(group.position.x - beforeX, group.position.z - beforeZ);
    const heightShift = Math.abs(group.position.y - beforeY);
    if (shift > .0005 || heightShift > .0005) {
      inspectionCorrections += 1;
      inspectionResponses += 1;
      inspectionPeakShift = Math.max(inspectionPeakShift, shift);
      inspectionHeightRange = Math.max(inspectionHeightRange, heightShift);
      inspectedDragonflies.add(index);
    }
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    applyDucklingShelter(safeDt);
    applyDragonflyInspection(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      shelterCorrections,
      shelterResponses,
      shelterPeakShift,
      shelteredDucklingCount: shelteredDucklings.size,
      inspectionCorrections,
      inspectionTurns,
      inspectionResponses,
      inspectionPeakShift,
      inspectionHeightRange,
      inspectedDragonflyCount: inspectedDragonflies.size,
      ducklingPositions: duckGroups.slice(1).map(duck => ({ x: duck.position.x, y: duck.position.y, z: duck.position.z })),
      dragonflyPositions: dragonGroups.map(dragon => ({ x: dragon.position.x, y: dragon.position.y, z: dragon.position.z, yaw: dragon.rotation.y }))
    };
  }

  window.ToonValleyBluebellWildlifeSocial = Object.freeze({
    active: true,
    ducklingShelterFormation: true,
    playerInspectionHover: true,
    existingPopulationOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
