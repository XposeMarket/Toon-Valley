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
  let shelterMemory = 0;
  const shelteredDucklings = new Set();
  let rejoinCorrections = 0;
  let rejoinResponses = 0;
  let rejoinPeakShift = 0;
  const rejoinedDucklings = new Set();
  let spacingCorrections = 0;
  let spacingResponses = 0;
  let spacingPeakShift = 0;
  let spacingClosestDistance = Infinity;
  let inspectionCorrections = 0;
  let inspectionTurns = 0;
  let inspectionResponses = 0;
  let inspectionPeakShift = 0;
  let inspectionHeightRange = 0;
  const inspectedDragonflies = new Set();
  let relayCorrections = 0;
  let relayTurns = 0;
  let relayResponses = 0;
  let relayPeakShift = 0;
  const relayedDragonflies = new Set();
  let orbitCorrections = 0;
  let orbitResponses = 0;
  let orbitPeakShift = 0;
  let orbitPairSeparation = 0;

  function clampStep(dx, dz, maxStep) {
    const distance = Math.hypot(dx, dz);
    if (distance < .0001) return { x: 0, z: 0, distance };
    const step = Math.min(distance, maxStep);
    return { x: dx / distance * step, z: dz / distance * step, distance };
  }

  function turnToward(group, x, z, dt, turnRate, counter) {
    const lookX = x - group.position.x;
    const lookZ = z - group.position.z;
    if (Math.hypot(lookX, lookZ) < .001) return;
    const targetYaw = Math.atan2(lookX, lookZ);
    let delta = targetYaw - group.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const turn = Math.max(-dt * turnRate, Math.min(dt * turnRate, delta));
    group.rotation.y += turn;
    if (Math.abs(turn) > .002) counter();
  }

  function applyDucklingShelter(dt) {
    const player = TV.player?.position;
    const state = W.getState();
    const adult = duckGroups[0];
    const adultState = state.ducks?.[0];
    if (!player || !adult || !adultState || adultState.escape > 0) return false;

    const fromPlayerX = adult.position.x - player.x;
    const fromPlayerZ = adult.position.z - player.z;
    const playerDistance = Math.hypot(fromPlayerX, fromPlayerZ);
    if (playerDistance < 4.7 || playerDistance > 8.2 || playerDistance < .001) return false;

    shelterMemory = 1.65;
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
    return true;
  }

  function applyDucklingRejoin(dt, shelterActive) {
    const state = W.getState();
    const adult = duckGroups[0];
    const adultState = state.ducks?.[0];
    if (!adult || !adultState || adultState.escape > 0) {
      shelterMemory = 0;
      return;
    }
    if (shelterActive) return;
    shelterMemory = Math.max(0, shelterMemory - dt);
    if (shelterMemory <= 0) return;

    const forwardX = Math.sin(adult.rotation.y);
    const forwardZ = Math.cos(adult.rotation.y);
    const sideX = forwardZ;
    const sideZ = -forwardX;
    for (let i = 1; i < duckGroups.length; i++) {
      const duck = duckGroups[i];
      const duckState = state.ducks?.[i];
      if (!duck || !duckState || duckState.escape > 0) continue;
      const side = i % 2 === 0 ? .34 : -.34;
      const trailing = .9 + (i - 1) * .72;
      const desiredX = adult.position.x - forwardX * trailing + sideX * side;
      const desiredZ = adult.position.z - forwardZ * trailing + sideZ * side;
      const beforeX = duck.position.x;
      const beforeZ = duck.position.z;
      const step = clampStep(desiredX - beforeX, desiredZ - beforeZ, Math.min(.042, dt * .2));
      duck.position.x += step.x;
      duck.position.z += step.z;
      const moved = Math.hypot(duck.position.x - beforeX, duck.position.z - beforeZ);
      if (moved > .0005) {
        rejoinCorrections += 1;
        rejoinResponses += 1;
        rejoinPeakShift = Math.max(rejoinPeakShift, moved);
        rejoinedDucklings.add(i);
        turnToward(duck, adult.position.x, adult.position.z, dt, 2.4, () => {});
      }
    }
  }

  function applyDucklingSpacing(dt, engaged) {
    if (!engaged || duckGroups.length < 3) return;
    const state = W.getState();
    for (let i = 1; i < duckGroups.length; i++) {
      const a = duckGroups[i];
      const aState = state.ducks?.[i];
      if (!a || !aState || aState.escape > 0) continue;
      for (let j = i + 1; j < duckGroups.length; j++) {
        const b = duckGroups[j];
        const bState = state.ducks?.[j];
        if (!b || !bState || bState.escape > 0) continue;
        let dx = b.position.x - a.position.x;
        let dz = b.position.z - a.position.z;
        let distance = Math.hypot(dx, dz);
        spacingClosestDistance = Math.min(spacingClosestDistance, distance);
        if (distance >= .56) continue;
        if (distance < .001) {
          const angle = elapsed * 1.7 + i * 1.3 + j * .7;
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          distance = 1;
        }
        const needed = .56 - Math.min(.56, distance);
        const shift = Math.min(.028, dt * .15, Math.max(.008, needed * .5));
        const nx = dx / distance;
        const nz = dz / distance;
        a.position.x -= nx * shift;
        a.position.z -= nz * shift;
        b.position.x += nx * shift;
        b.position.z += nz * shift;
        spacingCorrections += 1;
        spacingResponses += 1;
        spacingPeakShift = Math.max(spacingPeakShift, shift);
      }
    }
  }

  function eligibleDragonflies(state, player) {
    const candidates = [];
    state.dragonflies?.forEach((dragon, index) => {
      const group = dragonGroups[index];
      if (!group || dragon.perch > 0 || dragon.dodge > 0) return;
      const dx = group.position.x - player.x;
      const dz = group.position.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 3.1 || distance > 9.4) return;
      candidates.push({ dragon, group, index, dx, dz, distance });
    });
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
  }

  function moveDragonflyAroundPlayer(entry, dt, radius, lateral, heightOffset, turnRate, isRelay, orbitAngle = null) {
    const player = TV.player?.position;
    if (!player || entry.distance < .001) return;
    const { group, index, dx, dz, distance } = entry;
    const dirX = Number.isFinite(orbitAngle) ? Math.sin(orbitAngle) : dx / distance;
    const dirZ = Number.isFinite(orbitAngle) ? Math.cos(orbitAngle) : dz / distance;
    const sideX = -dirZ;
    const sideZ = dirX;
    const desiredX = player.x + dirX * radius + sideX * lateral;
    const desiredZ = player.z + dirZ * radius + sideZ * lateral;
    const desiredY = TV.terrainHeight(desiredX, desiredZ) + heightOffset + Math.sin(elapsed * (isRelay ? 2.7 : 3.4) + index) * .16;
    const beforeX = group.position.x;
    const beforeY = group.position.y;
    const beforeZ = group.position.z;
    const step = clampStep(desiredX - beforeX, desiredZ - beforeZ, Math.min(isRelay ? .047 : .055, dt * (isRelay ? .22 : .27)));
    group.position.x += step.x;
    group.position.z += step.z;
    group.position.y += (desiredY - group.position.y) * Math.min(1, dt * (isRelay ? 2.35 : 2.8));
    turnToward(group, player.x, player.z, dt, turnRate, () => {
      if (isRelay) relayTurns += 1;
      else inspectionTurns += 1;
    });

    const shift = Math.hypot(group.position.x - beforeX, group.position.z - beforeZ);
    const heightShift = Math.abs(group.position.y - beforeY);
    if (shift > .0005 || heightShift > .0005) {
      if (isRelay) {
        relayCorrections += 1;
        relayResponses += 1;
        relayPeakShift = Math.max(relayPeakShift, shift);
        relayedDragonflies.add(index);
      } else {
        inspectionCorrections += 1;
        inspectionResponses += 1;
        inspectionPeakShift = Math.max(inspectionPeakShift, shift);
        inspectionHeightRange = Math.max(inspectionHeightRange, heightShift);
        inspectedDragonflies.add(index);
      }
      if (Number.isFinite(orbitAngle)) {
        orbitCorrections += 1;
        orbitResponses += 1;
        orbitPeakShift = Math.max(orbitPeakShift, shift);
      }
    }
  }

  function applyDragonflyInspection(dt) {
    const player = TV.player?.position;
    if (!player || !dragonGroups.length) return;
    const state = W.getState();
    const candidates = eligibleDragonflies(state, player);
    const primary = candidates.find(candidate => candidate.distance <= 6.8);
    if (!primary) return;

    const baseAngle = Math.atan2(primary.dx, primary.dz);
    const sweep = Math.sin(elapsed * .78) * .58;
    const primaryLateral = .18 + Math.sin(elapsed * 1.9 + primary.index) * .14;
    moveDragonflyAroundPlayer(primary, dt, 3.85, primaryLateral, 1.28, 2.1, false, baseAngle + sweep);

    const relay = candidates.find(candidate => candidate.index !== primary.index && candidate.distance <= 9.4);
    if (!relay) return;
    const relayLateral = -.28 + Math.sin(elapsed * 1.45 + relay.index) * .12;
    moveDragonflyAroundPlayer(relay, dt, 5.15, relayLateral, 1.48, 1.75, true, baseAngle + Math.PI - sweep * .72);
    const separation = Math.hypot(primary.group.position.x - relay.group.position.x, primary.group.position.z - relay.group.position.z);
    orbitPairSeparation = Math.max(orbitPairSeparation, separation);
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    const shelterActive = applyDucklingShelter(safeDt);
    applyDucklingRejoin(safeDt, shelterActive);
    applyDucklingSpacing(safeDt, shelterActive || shelterMemory > 0);
    applyDragonflyInspection(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      shelterCorrections,
      shelterResponses,
      shelterPeakShift,
      shelteredDucklingCount: shelteredDucklings.size,
      shelterMemory,
      rejoinCorrections,
      rejoinResponses,
      rejoinPeakShift,
      rejoinedDucklingCount: rejoinedDucklings.size,
      spacingCorrections,
      spacingResponses,
      spacingPeakShift,
      spacingClosestDistance: Number.isFinite(spacingClosestDistance) ? spacingClosestDistance : null,
      inspectionCorrections,
      inspectionTurns,
      inspectionResponses,
      inspectionPeakShift,
      inspectionHeightRange,
      inspectedDragonflyCount: inspectedDragonflies.size,
      relayCorrections,
      relayTurns,
      relayResponses,
      relayPeakShift,
      relayedDragonflyCount: relayedDragonflies.size,
      orbitCorrections,
      orbitResponses,
      orbitPeakShift,
      orbitPairSeparation,
      ducklingPositions: duckGroups.slice(1).map(duck => ({ x: duck.position.x, y: duck.position.y, z: duck.position.z })),
      dragonflyPositions: dragonGroups.map(dragon => ({ x: dragon.position.x, y: dragon.position.y, z: dragon.position.z, yaw: dragon.rotation.y }))
    };
  }

  window.ToonValleyBluebellWildlifeSocial = Object.freeze({
    active: true,
    ducklingShelterFormation: true,
    ducklingRejoinContinuity: true,
    ducklingPersonalSpace: true,
    playerInspectionHover: true,
    dragonflyInspectionRelay: true,
    coordinatedInspectionOrbit: true,
    existingPopulationOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
