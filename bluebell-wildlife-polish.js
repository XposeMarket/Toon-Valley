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
  let perchResponses = 0;
  let poll = 0;
  let elapsed = 0;
  let cached = W.getState();
  const previous = cached.ducks.map(d => ({ feedCount: d.feedCount, escapeCount: d.escapeCount }));
  const previousPerch = cached.dragonflies.map(d => d.perchCount);
  const perchObjects = [1, 2, 3, 4].map(i => wildlifeRoot.getObjectByName(`bluebell-dragonfly-perch-${i}`));

  function emitRipple(x, y, z, kind) {
    const slot = ripplePool[rippleCursor++ % ripplePool.length];
    slot.life = slot.duration;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, y + .025, z);
    slot.mesh.scale.setScalar(kind === 'escape' ? 1.15 : .82);
    slot.mesh.material.opacity = kind === 'escape' ? .52 : .42;
    ripplesEmitted += 1;
    if (kind === 'escape') escapeRipples += 1;
    else dabbleRipples += 1;
  }

  function pollWildlife() {
    cached = W.getState();
    cached.ducks.forEach((duck, i) => {
      const prev = previous[i] || { feedCount: 0, escapeCount: 0 };
      if (duck.feedCount > prev.feedCount) emitRipple(duck.x, duck.y, duck.z, 'dabble');
      if (duck.escapeCount > prev.escapeCount) emitRipple(duck.x, duck.y, duck.z, 'escape');
      prev.feedCount = duck.feedCount;
      prev.escapeCount = duck.escapeCount;
      previous[i] = prev;
    });
    cached.dragonflies.forEach((dragon, i) => {
      if (dragon.perchCount > (previousPerch[i] || 0)) perchResponses += 1;
      previousPerch[i] = dragon.perchCount;
    });
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    poll += safeDt;
    if (poll >= .12) {
      poll = 0;
      pollWildlife();
    }
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
      perchResponses,
      perchDeflections: perchObjects.map(p => p?.rotation.z ?? null)
    };
  }

  window.ToonValleyBluebellWildlifePolish = Object.freeze({
    active: true,
    duckFamilyAgeMix: true,
    pooledWaterRipples: true,
    dabbleWaterResponse: true,
    escapeWaterResponse: true,
    reactivePerchSway: true,
    lowAllocationPool: true,
    advance,
    getState
  });
})();