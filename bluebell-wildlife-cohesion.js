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
  let calmCohesionCorrections = 0;
  let calmCohesionResponses = 0;
  let calmCohesionPeakShift = 0;
  let calmSpacingCorrections = 0;
  let calmSpacingResponses = 0;
  let calmSpacingClosestDistance = Infinity;
  let laneCorrections = 0;
  let laneResponses = 0;
  let lanePeakVerticalShift = 0;
  let lanePeakHorizontalShift = 0;
  let laneClosestHorizontalDistance = Infinity;

  function clampStep(dx, dz, maxStep) {
    const distance = Math.hypot(dx, dz);
    if (distance < .0001) return { x: 0, z: 0, distance };
    const step = Math.min(distance, maxStep);
    return { x: dx / distance * step, z: dz / distance * step, distance };
  }

  function applyCalmDucklingCohesion(dt) {
    const state = W.getState();
    const adult = duckGroups[0];
    const adultState = state.ducks?.[0];
    if (!adult || !adultState || adultState.escape > 0) return;

    const player = TV.player?.position;
    if (player) {
      const playerDistance = Math.hypot(adult.position.x - player.x, adult.position.z - player.z);
      if (playerDistance <= 8.6) return;
    }

    const forwardX = Math.sin(adult.rotation.y);
    const forwardZ = Math.cos(adult.rotation.y);
    const sideX = forwardZ;
    const sideZ = -forwardX;

    for (let i = 1; i < duckGroups.length; i++) {
      const duck = duckGroups[i];
      const duckState = state.ducks?.[i];
      if (!duck || !duckState || duckState.escape > 0) continue;
      const side = i % 2 === 0 ? .42 : -.42;
      const trailing = 1.05 + (i - 1) * .78;
      const desiredX = adult.position.x - forwardX * trailing + sideX * side;
      const desiredZ = adult.position.z - forwardZ * trailing + sideZ * side;
      const dx = desiredX - duck.position.x;
      const dz = desiredZ - duck.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 2.75) continue;
      const beforeX = duck.position.x;
      const beforeZ = duck.position.z;
      const step = clampStep(dx, dz, Math.min(.036, dt * .18));
      duck.position.x += step.x;
      duck.position.z += step.z;
      const moved = Math.hypot(duck.position.x - beforeX, duck.position.z - beforeZ);
      if (moved > .0005) {
        calmCohesionCorrections += 1;
        calmCohesionResponses += 1;
        calmCohesionPeakShift = Math.max(calmCohesionPeakShift, moved);
        duck.rotation.y = Math.atan2(adult.position.x - duck.position.x, adult.position.z - duck.position.z);
      }
    }

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
        calmSpacingClosestDistance = Math.min(calmSpacingClosestDistance, distance);
        if (distance >= .5) continue;
        if (distance < .001) {
          const angle = elapsed * 1.3 + i * 1.7 + j * .9;
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          distance = 1;
        }
        const shift = Math.min(.024, dt * .13);
        const nx = dx / distance;
        const nz = dz / distance;
        a.position.x -= nx * shift;
        a.position.z -= nz * shift;
        b.position.x += nx * shift;
        b.position.z += nz * shift;
        calmSpacingCorrections += 1;
        calmSpacingResponses += 1;
      }
    }
  }

  function applyDragonflyFlightLanes(dt) {
    const state = W.getState();
    for (let i = 0; i < dragonGroups.length; i++) {
      const a = dragonGroups[i];
      const aState = state.dragonflies?.[i];
      if (!a || !aState || aState.perch > 0 || aState.dodge > 0) continue;
      for (let j = i + 1; j < dragonGroups.length; j++) {
        const b = dragonGroups[j];
        const bState = state.dragonflies?.[j];
        if (!b || !bState || bState.perch > 0 || bState.dodge > 0) continue;
        let dx = b.position.x - a.position.x;
        let dz = b.position.z - a.position.z;
        let horizontal = Math.hypot(dx, dz);
        const vertical = Math.abs(b.position.y - a.position.y);
        laneClosestHorizontalDistance = Math.min(laneClosestHorizontalDistance, horizontal);
        if (horizontal >= 1.05 || vertical >= .42) continue;
        if (horizontal < .001) {
          const angle = elapsed * 1.9 + i * 1.1 + j * .73;
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          horizontal = 1;
        }
        const nx = dx / horizontal;
        const nz = dz / horizontal;
        const horizontalShift = Math.min(.026, dt * .14);
        const verticalShift = Math.min(.028, dt * .16);
        a.position.x -= nx * horizontalShift;
        a.position.z -= nz * horizontalShift;
        b.position.x += nx * horizontalShift;
        b.position.z += nz * horizontalShift;
        const laneSign = ((i + j) % 2 === 0) ? 1 : -1;
        a.position.y -= laneSign * verticalShift;
        b.position.y += laneSign * verticalShift;
        laneCorrections += 1;
        laneResponses += 1;
        lanePeakVerticalShift = Math.max(lanePeakVerticalShift, verticalShift);
        lanePeakHorizontalShift = Math.max(lanePeakHorizontalShift, horizontalShift);
      }
    }
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    applyCalmDucklingCohesion(safeDt);
    applyDragonflyFlightLanes(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      calmCohesionCorrections,
      calmCohesionResponses,
      calmCohesionPeakShift,
      calmSpacingCorrections,
      calmSpacingResponses,
      calmSpacingClosestDistance: Number.isFinite(calmSpacingClosestDistance) ? calmSpacingClosestDistance : null,
      laneCorrections,
      laneResponses,
      lanePeakVerticalShift,
      lanePeakHorizontalShift,
      laneClosestHorizontalDistance: Number.isFinite(laneClosestHorizontalDistance) ? laneClosestHorizontalDistance : null,
      ducklingPositions: duckGroups.slice(1).map(duck => ({ x: duck.position.x, y: duck.position.y, z: duck.position.z })),
      dragonflyPositions: dragonGroups.map(dragon => ({ x: dragon.position.x, y: dragon.position.y, z: dragon.position.z }))
    };
  }

  window.ToonValleyBluebellWildlifeCohesion = Object.freeze({
    active: true,
    calmFamilyCohesion: true,
    calmDucklingPersonalSpace: true,
    dragonflyFlightLaneDeconfliction: true,
    existingPopulationOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
