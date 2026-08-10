(() => {
  'use strict';
  const TV = window.ToonValley;
  const A = window.ToonValleyAmbientPedestrianLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight) return;
  const { THREE } = TV;

  const root = new THREE.Group();
  root.name = 'ambient-wildlife';
  TV.scene.add(root);

  const pigeonBodyGeometry = new THREE.SphereGeometry(.14, 7, 5);
  const pigeonHeadGeometry = new THREE.SphereGeometry(.085, 7, 5);
  const pigeonWingGeometry = new THREE.BoxGeometry(.18, .035, .11);
  const pigeonBodyMaterial = new THREE.MeshToonMaterial({ color: 0x65717d });
  const pigeonHeadMaterial = new THREE.MeshToonMaterial({ color: 0x7f8c96 });
  const pigeonWingMaterial = new THREE.MeshToonMaterial({ color: 0x4f5962 });
  const pigeonBeakMaterial = new THREE.MeshToonMaterial({ color: 0xe8b65a });

  const butterflyBodyGeometry = new THREE.CylinderGeometry(.025, .03, .18, 6);
  const butterflyWingGeometry = new THREE.CircleGeometry(.12, 8, 0, Math.PI);
  const butterflyBodyMaterial = new THREE.MeshToonMaterial({ color: 0x4a3d35 });
  const butterflyMaterials = [0xf09bc2, 0xf5cc62, 0x85d9df, 0xb59cf0].map(color => new THREE.MeshToonMaterial({ color, side: THREE.DoubleSide }));

  const pigeons = [];
  const butterflies = [];
  let elapsed = 0;
  let playerScatters = 0;
  let pedestrianScatters = 0;
  let butterflyDodges = 0;

  const squareRoosts = [
    { x: 4.8, z: -8.4 },
    { x: 7.6, z: -6.1 },
    { x: 9.2, z: -9.2 },
    { x: 2.7, z: -5.1 }
  ];
  const parkPatches = [
    { x: -83.7, z: 48.5 },
    { x: -76.8, z: 50.7 },
    { x: -73.4, z: 56.1 },
    { x: -84.9, z: 55.2 },
    { x: -79.3, z: 58.4 }
  ];

  function makePigeon(index) {
    const group = new THREE.Group();
    group.name = `town-square-pigeon-${index + 1}`;
    const body = new THREE.Mesh(pigeonBodyGeometry, pigeonBodyMaterial);
    body.scale.set(1, .8, 1.2);
    body.position.y = .14;
    const head = new THREE.Mesh(pigeonHeadGeometry, pigeonHeadMaterial);
    head.position.set(0, .24, .13);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(.04, .09, 5), pigeonBeakMaterial);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, .23, .24);
    const leftWing = new THREE.Mesh(pigeonWingGeometry, pigeonWingMaterial);
    const rightWing = leftWing.clone();
    leftWing.position.set(-.12, .16, 0);
    rightWing.position.set(.12, .16, 0);
    group.add(body, head, beak, leftWing, rightWing);
    const start = squareRoosts[index % squareRoosts.length];
    group.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);
    root.add(group);
    const state = {
      group,
      index,
      anchor: { ...start },
      target: { ...squareRoosts[(index + 1) % squareRoosts.length] },
      mode: 'pecking',
      modeTime: .5 + index * .28,
      flightHeight: 0,
      scatterCount: 0,
      leftWing,
      rightWing,
      completedHops: 0
    };
    pigeons.push(state);
    return state;
  }

  function makeButterfly(index) {
    const group = new THREE.Group();
    group.name = `sunshine-park-butterfly-${index + 1}`;
    const body = new THREE.Mesh(butterflyBodyGeometry, butterflyBodyMaterial);
    body.rotation.z = Math.PI / 2;
    const material = butterflyMaterials[index % butterflyMaterials.length];
    const leftWing = new THREE.Mesh(butterflyWingGeometry, material);
    const rightWing = new THREE.Mesh(butterflyWingGeometry, material);
    leftWing.position.x = -.07;
    rightWing.position.x = .07;
    rightWing.rotation.y = Math.PI;
    group.add(body, leftWing, rightWing);
    const patch = parkPatches[index % parkPatches.length];
    const angle = index * 1.25;
    group.position.set(patch.x + Math.cos(angle) * .45, TV.terrainHeight(patch.x, patch.z) + 1.05 + (index % 2) * .18, patch.z + Math.sin(angle) * .45);
    root.add(group);
    const state = {
      group,
      index,
      patchIndex: index % parkPatches.length,
      phase: index * 1.71,
      dodge: 0,
      dodgeCount: 0,
      orbitCount: 0,
      leftWing,
      rightWing
    };
    butterflies.push(state);
    return state;
  }

  squareRoosts.forEach((_, index) => makePigeon(index));
  parkPatches.forEach((_, index) => makeButterfly(index));

  function nearbyAmbient(position, radius, kinds) {
    if (!A?.getState) return false;
    const r2 = radius * radius;
    return A.getState().some(state => {
      if (kinds && !kinds.includes(state.kind)) return false;
      const dx = state.x - position.x;
      const dz = state.z - position.z;
      return dx * dx + dz * dz <= r2;
    });
  }

  function scatterPigeon(pigeon, source = 'player') {
    if (!pigeon || pigeon.mode === 'flying') return false;
    const current = pigeon.group.position;
    const candidates = squareRoosts.slice().sort((a, b) => {
      const da = (a.x - current.x) ** 2 + (a.z - current.z) ** 2;
      const db = (b.x - current.x) ** 2 + (b.z - current.z) ** 2;
      return db - da;
    });
    pigeon.target = { ...candidates[(pigeon.index + pigeon.scatterCount) % Math.min(2, candidates.length)] };
    pigeon.mode = 'flying';
    pigeon.modeTime = 1.15;
    pigeon.flightHeight = .15;
    pigeon.scatterCount += 1;
    if (source === 'player') playerScatters += 1;
    else pedestrianScatters += 1;
    return true;
  }

  function updatePigeon(pigeon, dt) {
    const player = TV.player?.position;
    if (pigeon.mode !== 'flying') {
      if (player) {
        const dx = player.x - pigeon.group.position.x;
        const dz = player.z - pigeon.group.position.z;
        if (dx * dx + dz * dz < 2.25 * 2.25 && scatterPigeon(pigeon, 'player')) return;
      }
      if (nearbyAmbient(pigeon.group.position, 1.45, ['square-errand']) && scatterPigeon(pigeon, 'pedestrian')) return;
    }

    if (pigeon.mode === 'flying') {
      const dx = pigeon.target.x - pigeon.group.position.x;
      const dz = pigeon.target.z - pigeon.group.position.z;
      const distance = Math.hypot(dx, dz);
      const step = Math.min(distance, 4.2 * dt);
      if (distance > .05) {
        pigeon.group.position.x += dx / distance * step;
        pigeon.group.position.z += dz / distance * step;
        pigeon.group.rotation.y = Math.atan2(dx, dz);
      }
      pigeon.modeTime = Math.max(0, pigeon.modeTime - dt);
      const progress = 1 - pigeon.modeTime / 1.15;
      pigeon.flightHeight = .2 + Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI) * 1.15;
      pigeon.group.position.y = TV.terrainHeight(pigeon.group.position.x, pigeon.group.position.z) + pigeon.flightHeight;
      const flap = Math.sin(elapsed * 20 + pigeon.index) * .75;
      pigeon.leftWing.rotation.z = flap;
      pigeon.rightWing.rotation.z = -flap;
      if (distance <= .08 || pigeon.modeTime === 0) {
        pigeon.group.position.x = pigeon.target.x;
        pigeon.group.position.z = pigeon.target.z;
        pigeon.group.position.y = TV.terrainHeight(pigeon.target.x, pigeon.target.z);
        pigeon.leftWing.rotation.z = 0;
        pigeon.rightWing.rotation.z = 0;
        pigeon.mode = 'settling';
        pigeon.modeTime = .7;
        pigeon.completedHops += 1;
      }
      return;
    }

    pigeon.modeTime = Math.max(0, pigeon.modeTime - dt);
    pigeon.group.position.y = TV.terrainHeight(pigeon.group.position.x, pigeon.group.position.z);
    if (pigeon.mode === 'pecking') {
      pigeon.group.rotation.x = Math.max(-.12, Math.sin(elapsed * 8 + pigeon.index) * .1 - .03);
    } else {
      pigeon.group.rotation.x = 0;
    }
    if (pigeon.modeTime === 0) {
      if (pigeon.mode === 'settling') {
        pigeon.mode = 'pecking';
        pigeon.modeTime = 1.1 + (pigeon.index % 3) * .25;
      } else {
        const next = squareRoosts[(pigeon.index + pigeon.completedHops + 1) % squareRoosts.length];
        pigeon.target = { ...next };
        pigeon.mode = 'flying';
        pigeon.modeTime = 1.15;
      }
    }
  }

  function updateButterfly(butterfly, dt) {
    const patch = parkPatches[butterfly.patchIndex];
    butterfly.phase += dt * (.9 + butterfly.index * .035);
    butterfly.dodge = Math.max(0, butterfly.dodge - dt);
    const player = TV.player?.position;
    let threatened = nearbyAmbient(butterfly.group.position, 1.5, ['park-jogger']);
    if (player) {
      const dx = player.x - butterfly.group.position.x;
      const dz = player.z - butterfly.group.position.z;
      threatened ||= dx * dx + dz * dz < 1.8 * 1.8;
    }
    if (threatened && butterfly.dodge <= 0) {
      butterfly.dodge = .8;
      butterfly.dodgeCount += 1;
      butterflyDodges += 1;
      butterfly.patchIndex = (butterfly.patchIndex + 2 + butterfly.index) % parkPatches.length;
    }
    const activePatch = parkPatches[butterfly.patchIndex];
    const radius = butterfly.dodge > 0 ? .9 : .48 + (butterfly.index % 2) * .12;
    const desiredX = activePatch.x + Math.cos(butterfly.phase * 1.4 + butterfly.index) * radius;
    const desiredZ = activePatch.z + Math.sin(butterfly.phase * 1.15 + butterfly.index) * radius;
    const follow = Math.min(1, dt * (butterfly.dodge > 0 ? 6 : 2.4));
    butterfly.group.position.x += (desiredX - butterfly.group.position.x) * follow;
    butterfly.group.position.z += (desiredZ - butterfly.group.position.z) * follow;
    const baseY = TV.terrainHeight(butterfly.group.position.x, butterfly.group.position.z);
    butterfly.group.position.y = baseY + .9 + Math.sin(elapsed * 2.8 + butterfly.phase) * .22 + (butterfly.dodge > 0 ? .35 : 0);
    const flap = .3 + Math.abs(Math.sin(elapsed * 11 + butterfly.phase)) * .95;
    butterfly.leftWing.rotation.y = flap;
    butterfly.rightWing.rotation.y = Math.PI - flap;
    butterfly.group.rotation.y = Math.atan2(desiredX - butterfly.group.position.x, desiredZ - butterfly.group.position.z);
    if (Math.hypot(desiredX - butterfly.group.position.x, desiredZ - butterfly.group.position.z) < .1) butterfly.orbitCount += 1;
    if (!Number.isFinite(patch.x + patch.z)) butterfly.patchIndex = 0;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    pigeons.forEach(pigeon => updatePigeon(pigeon, safeDt));
    butterflies.forEach(butterfly => updateButterfly(butterfly, safeDt));
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      pigeonCount: pigeons.length,
      butterflyCount: butterflies.length,
      playerScatters,
      pedestrianScatters,
      butterflyDodges,
      pigeons: pigeons.map(pigeon => ({
        name: pigeon.group.name,
        x: pigeon.group.position.x,
        y: pigeon.group.position.y,
        z: pigeon.group.position.z,
        mode: pigeon.mode,
        scatterCount: pigeon.scatterCount,
        completedHops: pigeon.completedHops,
        flightHeight: pigeon.flightHeight
      })),
      butterflies: butterflies.map(butterfly => ({
        name: butterfly.group.name,
        x: butterfly.group.position.x,
        y: butterfly.group.position.y,
        z: butterfly.group.position.z,
        patchIndex: butterfly.patchIndex,
        dodge: butterfly.dodge,
        dodgeCount: butterfly.dodgeCount,
        orbitCount: butterfly.orbitCount
      }))
    };
  }

  window.ToonValleyAmbientWildlife = Object.freeze({
    active: true,
    reactiveTownSquarePigeons: true,
    reactiveSunshineParkButterflies: true,
    pedestrianAwareWildlife: true,
    terrainFollowing: true,
    lowPopulationBudget: true,
    getState,
    advance,
    scatter: index => scatterPigeon(pigeons[index], 'player')
  });
})();
