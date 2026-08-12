(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState) return;
  const { THREE } = TV;
  const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
  if (!wildlifeRoot) return;

  const duckGroups = [1, 2, 3].map(i => wildlifeRoot.getObjectByName(`bluebell-duck-${i}`)).filter(Boolean);
  const duckScales = [1, .74, .69];
  duckGroups.forEach((duck, i) => duck.scale.setScalar(duckScales[i] || 1));
  const dragonGroups = [1, 2, 3, 4].map(i => wildlifeRoot.getObjectByName(`bluebell-dragonfly-${i}`)).filter(Boolean);

  const rippleRoot = new THREE.Group();
  rippleRoot.name = 'bluebell-wildlife-ripple-pool';
  TV.scene.add(rippleRoot);
  const rippleGeometry = new THREE.RingGeometry(.2, .26, 18);
  const ripplePool = Array.from({ length: 12 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xe9fbff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(rippleGeometry, material);
    mesh.name = `bluebell-wildlife-ripple-${index + 1}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    rippleRoot.add(mesh);
    return { mesh, life: 0, duration: .9 };
  });
  let rippleCursor = 0;
  let ripplesEmitted = 0;
  let dabbleRipples = 0;
  let escapeRipples = 0;
  let wakeRipples = 0;
  let familyEscapeBursts = 0;
  let regroupCorrections = 0;
  let maxFamilyLag = 0;
  let perchResponses = 0;
  let familyWatchResponses = 0;
  let watchCorrections = 0;
  let dragonflyPairChases = 0;
  let chaseCorrections = 0;
  let chaseCooldown = 2.2;
  let activeChase = null;
  let poll = 0;
  let elapsed = 0;
  let cached = W.getState();
  const previous = cached.ducks.map(d => ({ feedCount: d.feedCount, escapeCount: d.escapeCount }));
  const previousPositions = cached.ducks.map(d => ({ x: d.x, y: d.y, z: d.z, trailDistance: 0 }));
  const previousPerch = cached.dragonflies.map(d => d.perchCount);
  const perchObjects = [1, 2, 3, 4].map(i => wildlifeRoot.getObjectByName(`bluebell-dragonfly-perch-${i}`));

  function emitRipple(x, y, z, kind) {
    const slot = ripplePool[rippleCursor++ % ripplePool.length];
    slot.life = slot.duration;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, y + .025, z);
    slot.mesh.scale.setScalar(kind === 'escape' ? 1.15 : kind === 'wake' ? .58 : .82);
    slot.mesh.material.opacity = kind === 'escape' ? .52 : kind === 'wake' ? .3 : .42;
    ripplesEmitted += 1;
    if (kind === 'escape') escapeRipples += 1;
    else if (kind === 'wake') wakeRipples += 1;
    else dabbleRipples += 1;
  }

  function pollWildlife() {
    cached = W.getState();
    let familyEscapeTriggered = false;
    cached.ducks.forEach((duck, i) => {
      const prev = previous[i] || { feedCount: 0, escapeCount: 0 };
      const position = previousPositions[i] || { x: duck.x, y: duck.y, z: duck.z, trailDistance: 0 };
      if (duck.feedCount > prev.feedCount) emitRipple(duck.x, duck.y, duck.z, 'dabble');
      if (duck.escapeCount > prev.escapeCount) familyEscapeTriggered = true;

      const moved = Math.hypot(duck.x - position.x, duck.z - position.z);
      position.trailDistance += moved;
      const wakeThreshold = i === 0 ? .22 : .16;
      if (duck.escape <= 0 && duck.feed <= 0 && duck.preen <= 0 && position.trailDistance >= wakeThreshold) {
        emitRipple(position.x, position.y, position.z, 'wake');
        position.trailDistance = 0;
      }
      position.x = duck.x;
      position.y = duck.y;
      position.z = duck.z;
      previousPositions[i] = position;
      prev.feedCount = duck.feedCount;
      prev.escapeCount = duck.escapeCount;
      previous[i] = prev;
      maxFamilyLag = Math.max(maxFamilyLag, Number(duck.formationDistance) || 0);
    });

    if (familyEscapeTriggered) {
      familyEscapeBursts += 1;
      cached.ducks.forEach(duck => {
        if (duck.escape > 0) emitRipple(duck.x, duck.y, duck.z, 'escape');
      });
    }

    cached.dragonflies.forEach((dragon, i) => {
      if (dragon.perchCount > (previousPerch[i] || 0)) perchResponses += 1;
      previousPerch[i] = dragon.perchCount;
    });
  }

  function applyFamilyRegroup(dt) {
    const ducks = cached.ducks || [];
    for (let i = 1; i < Math.min(duckGroups.length, ducks.length); i++) {
      const state = ducks[i];
      const duck = duckGroups[i];
      const guide = duckGroups[i - 1];
      const lag = Number(state?.formationDistance) || 0;
      if (!duck || !guide || state?.escape > 0 || lag < .9) continue;
      const dx = guide.position.x - duck.position.x;
      const dz = guide.position.z - duck.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < .001) continue;
      const correction = Math.min(.11, dt * (.22 + Math.min(1.1, lag - .9) * .28));
      duck.position.x += dx / distance * correction;
      duck.position.z += dz / distance * correction;
      regroupCorrections += 1;
    }
  }

  function applyFamilyWatchfulness(dt) {
    const adult = duckGroups[0];
    const player = TV.player?.position;
    const adultState = cached.ducks?.[0];
    if (!adult || !player || !adultState || adultState.escape > 0) return;
    const dx = player.x - adult.position.x;
    const dz = player.z - adult.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 4.7 || distance > 8.2) return;
    const targetYaw = Math.atan2(dx, dz);
    let delta = targetYaw - adult.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const turn = Math.max(-dt * 1.35, Math.min(dt * 1.35, delta));
    adult.rotation.y += turn;
    watchCorrections += 1;
    if (Math.abs(turn) > .002) familyWatchResponses += 1;

    for (let i = 1; i < duckGroups.length; i++) {
      const duck = duckGroups[i];
      const guide = duckGroups[i - 1];
      const state = cached.ducks?.[i];
      if (!duck || !guide || state?.escape > 0) continue;
      const gx = guide.position.x - duck.position.x;
      const gz = guide.position.z - duck.position.z;
      const gap = Math.hypot(gx, gz);
      if (gap <= .82 || gap < .001) continue;
      const correction = Math.min(.045, dt * .12);
      duck.position.x += gx / gap * correction;
      duck.position.z += gz / gap * correction;
      watchCorrections += 1;
    }
  }

  function updateDragonflyPairChase(dt) {
    chaseCooldown = Math.max(0, chaseCooldown - dt);
    if (activeChase) {
      activeChase.life = Math.max(0, activeChase.life - dt);
      const chaser = dragonGroups[activeChase.chaser];
      const target = dragonGroups[activeChase.target];
      const chaserState = cached.dragonflies?.[activeChase.chaser];
      const targetState = cached.dragonflies?.[activeChase.target];
      if (!chaser || !target || chaserState?.perch > 0 || targetState?.perch > 0 || chaserState?.dodge > 0 || targetState?.dodge > 0) {
        activeChase = null;
        chaseCooldown = Math.max(chaseCooldown, 1.8);
      } else {
        const dx = target.position.x - chaser.position.x;
        const dz = target.position.z - chaser.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > .001) {
          const correction = Math.min(.065, dt * .24, Math.max(0, distance - .32));
          chaser.position.x += dx / distance * correction;
          chaser.position.z += dz / distance * correction;
          chaser.position.y += (target.position.y + .12 - chaser.position.y) * Math.min(1, dt * 2.8);
          chaser.rotation.y = Math.atan2(dx, dz);
          chaseCorrections += 1;
        }
        if (activeChase.life <= 0 || distance < .38) {
          activeChase = null;
          chaseCooldown = 5.8;
        }
      }
    }

    if (!activeChase && chaseCooldown <= 0 && dragonGroups.length > 1) {
      const airborne = cached.dragonflies
        .map((dragon, index) => ({ dragon, index }))
        .filter(({ dragon, index }) => index < dragonGroups.length && dragon.perch <= 0 && dragon.dodge <= 0);
      if (airborne.length > 1) {
        const seed = dragonflyPairChases % airborne.length;
        const chaser = airborne[seed].index;
        let target = airborne[(seed + 1) % airborne.length].index;
        if (target === chaser) target = airborne[(seed + 2) % airborne.length].index;
        activeChase = { chaser, target, life: 1.45 };
        dragonflyPairChases += 1;
      } else {
        chaseCooldown = .8;
      }
    }
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    poll += safeDt;
    if (poll >= .12) {
      poll = 0;
      pollWildlife();
    }
    applyFamilyRegroup(safeDt);
    applyFamilyWatchfulness(safeDt);
    updateDragonflyPairChase(safeDt);
    ripplePool.forEach(slot => {
      if (slot.life <= 0) return;
      slot.life = Math.max(0, slot.life - safeDt);
      const progress = 1 - slot.life / slot.duration;
      const base = slot.mesh.scale.x;
      slot.mesh.scale.setScalar(base + safeDt * 1.15);
      slot.mesh.material.opacity = Math.max(0, .5 * (1 - progress));
      if (slot.life <= 0) slot.mesh.visible = false;
    });
    const dragons = cached.dragonflies || [];
    perchObjects.forEach((perch, i) => {
      if (!perch) return;
      const active = dragons.some(d => d.anchorIndex === i && d.perch > 0);
      const target = Math.sin(elapsed * (active ? 3.1 : 1.25) + i) * (active ? .035 : .009);
      perch.rotation.z += (target - perch.rotation.z) * Math.min(1, safeDt * 5);
    });
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      duckFamilyAgeMix: duckGroups.length === 3 && duckGroups[1]?.scale.x < .8 && duckGroups[2]?.scale.x < .8,
      duckScales: duckGroups.map(d => d.scale.x),
      ripplePoolSize: ripplePool.length,
      activeRippleCount: ripplePool.filter(r => r.mesh.visible).length,
      ripplesEmitted,
      dabbleRipples,
      escapeRipples,
      wakeRipples,
      familyEscapeBursts,
      regroupCorrections,
      maxFamilyLag,
      perchResponses,
      familyWatchResponses,
      watchCorrections,
      adultWatchYaw: duckGroups[0]?.rotation.y ?? null,
      dragonflyPairChases,
      chaseCorrections,
      chaseActive: Boolean(activeChase),
      perchDeflections: perchObjects.map(p => p?.rotation.z ?? null)
    };
  }

  window.ToonValleyBluebellWildlifePolish = Object.freeze({
    active: true,
    duckFamilyAgeMix: true,
    pooledWaterRipples: true,
    dabbleWaterResponse: true,
    escapeWaterResponse: true,
    familyEscapeWaterResponse: true,
    continuousSwimWakeTrails: true,
    ducklingRegroupAssist: true,
    familyWatchfulness: true,
    dragonflyPairChases: true,
    reactivePerchSway: true,
    lowAllocationPool: true,
    advance,
    getState
  });
})();
