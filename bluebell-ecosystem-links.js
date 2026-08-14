(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  const M = window.ToonValleyBluebellMarshLife;
  const Lake = window.ToonValleyBluebellLake;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState || !M?.getState || !Lake?.lake) return;

  const { THREE } = TV;
  const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
  const marshRoot = TV.scene.getObjectByName('bluebell-marsh-life');
  if (!wildlifeRoot || !marshRoot) return;

  const lake = Lake.lake;
  const duckGroups = [1, 2, 3].map(i => wildlifeRoot.getObjectByName(`bluebell-duck-${i}`)).filter(Boolean);
  const dragonGroups = [1, 2, 3, 4].map(i => wildlifeRoot.getObjectByName(`bluebell-dragonfly-${i}`)).filter(Boolean);
  const minnowGroups = [1, 2, 3, 4, 5, 6, 7].map(i => marshRoot.getObjectByName(`bluebell-minnow-${i}`)).filter(Boolean);
  const frogGroups = [1, 2, 3].map(i => marshRoot.getObjectByName(`bluebell-frog-${i}`)).filter(Boolean);

  const tongueGeometry = new THREE.BoxGeometry(.04, .035, 1);
  const tongueMaterial = new THREE.MeshToonMaterial({ color: 0xe97886 });
  const frogTongues = frogGroups.map((frog, index) => {
    const mesh = new THREE.Mesh(tongueGeometry, tongueMaterial);
    mesh.name = `bluebell-frog-tongue-${index + 1}`;
    mesh.position.set(0, .21, .3);
    mesh.scale.z = .001;
    mesh.visible = false;
    frog.add(mesh);
    return {
      mesh,
      timer: 0,
      duration: .36,
      cooldown: 1.1 + index * .75,
      targetIndex: -1,
      impacted: false
    };
  });

  const duckPrevious = duckGroups.map(group => ({ x: group.position.x, z: group.position.z }));
  const duckCooldowns = duckGroups.map((_, index) => .35 + index * .18);
  const minnowImpulses = minnowGroups.map(() => ({ x: 0, z: 0, life: 0 }));

  let elapsed = 0;
  let duckMinnowDisturbances = 0;
  let duckMinnowResponses = 0;
  let minnowImpulseCorrections = 0;
  let minnowPeakShift = 0;
  let boundedMinnowCorrections = 0;
  let frogTongueFlicks = 0;
  let frogWatchTurns = 0;
  let frogTonguePeakReach = 0;
  let dragonflyEvasions = 0;
  let evasionPeakShift = 0;

  function clampMinnowToLake(group) {
    const rx = Math.max(.001, lake.rx * .68);
    const rz = Math.max(.001, lake.rz * .68);
    const nx = (group.position.x - lake.x) / rx;
    const nz = (group.position.z - lake.z) / rz;
    const distance = Math.hypot(nx, nz);
    if (distance <= 1) return;
    const scale = 1 / distance;
    group.position.x = lake.x + (group.position.x - lake.x) * scale;
    group.position.z = lake.z + (group.position.z - lake.z) * scale;
    boundedMinnowCorrections += 1;
  }

  function disturbMinnowsFromDuck(duckIndex, duck, moved, wildlifeState) {
    if (!duck || moved < .035 || duckCooldowns[duckIndex] > 0) return;
    const duckState = wildlifeState.ducks?.[duckIndex];
    const strength = duckState?.escape > 0 ? .95 : .62;
    const radius = duckState?.escape > 0 ? 2.05 : 1.55;
    let affected = 0;

    minnowGroups.forEach((minnow, minnowIndex) => {
      if (!minnow) return;
      let dx = minnow.position.x - duck.position.x;
      let dz = minnow.position.z - duck.position.z;
      let distance = Math.hypot(dx, dz);
      if (distance > radius) return;
      if (distance < .02) {
        const angle = elapsed * 2.3 + duckIndex * 1.4 + minnowIndex * .9;
        dx = Math.cos(angle);
        dz = Math.sin(angle);
        distance = 1;
      }
      const closeness = 1 - Math.min(1, distance / radius);
      const impulse = minnowImpulses[minnowIndex];
      impulse.x = dx / distance * (strength + closeness * .5);
      impulse.z = dz / distance * (strength * .82 + closeness * .42);
      impulse.life = Math.max(impulse.life, .7 + closeness * .2);
      affected += 1;
    });

    if (affected > 0) {
      duckMinnowDisturbances += 1;
      duckMinnowResponses += affected;
      duckCooldowns[duckIndex] = duckState?.escape > 0 ? .5 : .82;
    }
  }

  function applyDuckMinnowDisturbance(dt) {
    const wildlifeState = W.getState();
    duckGroups.forEach((duck, index) => {
      duckCooldowns[index] = Math.max(0, duckCooldowns[index] - dt);
      const previous = duckPrevious[index];
      if (!duck || !previous) return;
      const moved = Math.hypot(duck.position.x - previous.x, duck.position.z - previous.z);
      disturbMinnowsFromDuck(index, duck, moved, wildlifeState);
      previous.x = duck.position.x;
      previous.z = duck.position.z;
    });

    minnowGroups.forEach((minnow, index) => {
      const impulse = minnowImpulses[index];
      if (!minnow || !impulse || impulse.life <= 0) return;
      impulse.life = Math.max(0, impulse.life - dt);
      const fade = Math.min(1, impulse.life / .7);
      const shiftX = impulse.x * dt * fade;
      const shiftZ = impulse.z * dt * fade;
      minnow.position.x += shiftX;
      minnow.position.z += shiftZ;
      clampMinnowToLake(minnow);
      const shift = Math.hypot(shiftX, shiftZ);
      if (shift > .0005) {
        minnowImpulseCorrections += 1;
        minnowPeakShift = Math.max(minnowPeakShift, shift);
        minnow.rotation.y = Math.atan2(shiftX, shiftZ);
      }
      impulse.x *= Math.max(0, 1 - dt * 1.7);
      impulse.z *= Math.max(0, 1 - dt * 1.7);
    });
  }

  function turnFrogToward(frog, target, dt) {
    const dx = target.position.x - frog.position.x;
    const dz = target.position.z - frog.position.z;
    if (Math.hypot(dx, dz) < .001) return;
    const desired = Math.atan2(dx, dz);
    let delta = Math.atan2(Math.sin(desired - frog.rotation.y), Math.cos(desired - frog.rotation.y));
    const turn = Math.max(-dt * 4.2, Math.min(dt * 4.2, delta));
    frog.rotation.y += turn;
    if (Math.abs(turn) > .002) frogWatchTurns += 1;
  }

  function chooseDragonflyForFrog(frog, wildlifeState) {
    let best = null;
    let bestDistance = Infinity;
    wildlifeState.dragonflies?.forEach((dragon, index) => {
      const group = dragonGroups[index];
      if (!group || dragon.perch > 0 || dragon.dodge > 0) return;
      const distance = Math.hypot(group.position.x - frog.position.x, group.position.z - frog.position.z);
      if (distance < 1 || distance > 2.8 || distance >= bestDistance) return;
      best = index;
      bestDistance = distance;
    });
    return best;
  }

  function beginTongueFlick(index, targetIndex) {
    const tongue = frogTongues[index];
    if (!tongue || !Number.isInteger(targetIndex)) return;
    tongue.timer = tongue.duration;
    tongue.targetIndex = targetIndex;
    tongue.impacted = false;
    tongue.mesh.visible = true;
    tongue.mesh.scale.z = .001;
    frogTongueFlicks += 1;
  }

  function applyDragonflyEvasion(frog, dragon, tongue) {
    let dx = dragon.position.x - frog.position.x;
    let dz = dragon.position.z - frog.position.z;
    let distance = Math.hypot(dx, dz);
    if (distance < .02) {
      dx = Math.sin(elapsed * 3.1 + tongue.targetIndex);
      dz = Math.cos(elapsed * 3.1 + tongue.targetIndex);
      distance = 1;
    }
    const shift = .24;
    dragon.position.x += dx / distance * shift;
    dragon.position.z += dz / distance * shift;
    dragon.position.y += .13;
    dragon.rotation.y = Math.atan2(dx, dz);
    dragonflyEvasions += 1;
    evasionPeakShift = Math.max(evasionPeakShift, Math.hypot(shift, .13));
  }

  function updateTongue(index, frog, frogState, wildlifeState, dt) {
    const tongue = frogTongues[index];
    if (!tongue || !frog) return;
    tongue.cooldown = Math.max(0, tongue.cooldown - dt);

    if (tongue.timer <= 0) {
      tongue.mesh.visible = false;
      tongue.mesh.scale.z = .001;
      tongue.targetIndex = -1;
      tongue.impacted = false;
      if (frogState?.state !== 'resting' || tongue.cooldown > 0) return;
      const targetIndex = chooseDragonflyForFrog(frog, wildlifeState);
      if (Number.isInteger(targetIndex)) beginTongueFlick(index, targetIndex);
      return;
    }

    tongue.timer = Math.max(0, tongue.timer - dt);
    const dragon = dragonGroups[tongue.targetIndex];
    if (!dragon || frogState?.state !== 'resting') {
      tongue.timer = 0;
      tongue.cooldown = 1.4;
      tongue.mesh.visible = false;
      return;
    }

    turnFrogToward(frog, dragon, dt);
    const progress = 1 - tongue.timer / tongue.duration;
    const distance = Math.hypot(dragon.position.x - frog.position.x, dragon.position.z - frog.position.z);
    const reach = Math.sin(Math.min(1, progress) * Math.PI) * Math.min(1.7, Math.max(.55, distance * .82));
    tongue.mesh.visible = reach > .025;
    tongue.mesh.scale.z = Math.max(.001, reach);
    tongue.mesh.position.z = .3 + reach * .5;
    frogTonguePeakReach = Math.max(frogTonguePeakReach, reach);

    if (!tongue.impacted && progress >= .42) {
      tongue.impacted = true;
      applyDragonflyEvasion(frog, dragon, tongue);
    }

    if (tongue.timer <= 0) {
      tongue.mesh.visible = false;
      tongue.mesh.scale.z = .001;
      tongue.cooldown = 4.8 + index * .55;
    }
  }

  function applyFrogDragonflyPredation(dt) {
    const marshState = M.getState();
    const wildlifeState = W.getState();
    frogGroups.forEach((frog, index) => updateTongue(index, frog, marshState.frogs?.[index], wildlifeState, dt));
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    applyDuckMinnowDisturbance(safeDt);
    applyFrogDragonflyPredation(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      duckMinnowDisturbances,
      duckMinnowResponses,
      minnowImpulseCorrections,
      minnowPeakShift,
      boundedMinnowCorrections,
      frogTongueFlicks,
      frogWatchTurns,
      frogTonguePeakReach,
      dragonflyEvasions,
      evasionPeakShift,
      activeTongues: frogTongues.filter(tongue => tongue.timer > 0).length,
      tongueCount: frogTongues.length,
      minnowPositions: minnowGroups.map(minnow => ({ x: minnow.position.x, y: minnow.position.y, z: minnow.position.z })),
      frogPositions: frogGroups.map(frog => ({ x: frog.position.x, y: frog.position.y, z: frog.position.z, yaw: frog.rotation.y })),
      dragonflyPositions: dragonGroups.map(dragon => ({ x: dragon.position.x, y: dragon.position.y, z: dragon.position.z, yaw: dragon.rotation.y }))
    };
  }

  window.ToonValleyBluebellEcosystemLinks = Object.freeze({
    active: true,
    duckWakeMinnowDisturbance: true,
    frogDragonflyTongueFlick: true,
    physicalPredatorResponse: true,
    fixedTongueGeometry: true,
    boundedMinnowResponses: true,
    existingPopulationOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
