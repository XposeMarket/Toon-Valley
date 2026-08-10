(() => {
  'use strict';
  const TV = window.ToonValley;
  const Lake = window.ToonValleyBluebellLake;
  if (!TV?.scene || !TV?.registerUpdateHook || !Lake?.lake) return;
  const { THREE } = TV;
  const LAKE = Lake.lake;
  const waterY = TV.terrainHeight(LAKE.x, LAKE.z) + .23;

  const root = new THREE.Group();
  root.name = 'bluebell-wildlife';
  TV.scene.add(root);

  const duckBodyGeometry = new THREE.SphereGeometry(.3, 8, 6);
  const duckHeadGeometry = new THREE.SphereGeometry(.17, 8, 6);
  const duckWingGeometry = new THREE.SphereGeometry(.2, 7, 5);
  const duckBodyMaterials = [0x73563c, 0x5d754b, 0xc5aa72].map(color => new THREE.MeshToonMaterial({ color }));
  const duckHeadMaterials = [0x4d6d43, 0x664b36, 0x8d754f].map(color => new THREE.MeshToonMaterial({ color }));
  const billMaterial = new THREE.MeshToonMaterial({ color: 0xe0a33d });
  const wakeMaterial = new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide });

  const dragonBodyGeometry = new THREE.CylinderGeometry(.025, .035, .28, 6);
  const dragonWingGeometry = new THREE.PlaneGeometry(.22, .08);
  const dragonBodyMaterial = new THREE.MeshToonMaterial({ color: 0x31575d });
  const dragonWingMaterials = [0x79dff0, 0xa1f1df, 0x8cbcf4, 0xc3a7f3].map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .66, side: THREE.DoubleSide, depthWrite: false }));

  const ducks = [];
  const dragonflies = [];
  let elapsed = 0;
  let duckEscapes = 0;
  let dragonflyDodges = 0;

  const dragonAnchors = [
    { x: LAKE.x - LAKE.rx * .62, z: LAKE.z - LAKE.rz * .55 },
    { x: LAKE.x + LAKE.rx * .58, z: LAKE.z - LAKE.rz * .48 },
    { x: LAKE.x + LAKE.rx * .7, z: LAKE.z + LAKE.rz * .32 },
    { x: LAKE.x - LAKE.rx * .68, z: LAKE.z + LAKE.rz * .38 }
  ];

  function makeDuck(index) {
    const group = new THREE.Group();
    group.name = `bluebell-duck-${index + 1}`;
    const body = new THREE.Mesh(duckBodyGeometry, duckBodyMaterials[index % duckBodyMaterials.length]);
    body.scale.set(1, .72, 1.28);
    body.position.y = .18;
    const head = new THREE.Mesh(duckHeadGeometry, duckHeadMaterials[index % duckHeadMaterials.length]);
    head.position.set(0, .42, .29);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(.13, .055, .16), billMaterial);
    bill.position.set(0, .4, .48);
    const leftWing = new THREE.Mesh(duckWingGeometry, duckBodyMaterials[index % duckBodyMaterials.length]);
    const rightWing = leftWing.clone();
    leftWing.scale.set(.45, .28, .85); rightWing.scale.copy(leftWing.scale);
    leftWing.position.set(-.24, .2, -.02); rightWing.position.set(.24, .2, -.02);
    const wake = new THREE.Mesh(new THREE.RingGeometry(.25, .55, 16, 1, 0, Math.PI), wakeMaterial.clone());
    wake.rotation.x = -Math.PI / 2;
    wake.rotation.z = Math.PI;
    wake.position.set(0, .02, -.47);
    group.add(body, head, bill, leftWing, rightWing, wake);
    const angle = .5 + index * 2.05;
    group.position.set(LAKE.x + Math.cos(angle) * (7 + index * 1.5), waterY, LAKE.z + Math.sin(angle) * (5.2 + index));
    root.add(group);
    ducks.push({ group, index, phase: angle, speed: .34 + index * .035, escape: 0, escapeCount: 0, wake, bobPhase: index * 1.7 });
  }

  function makeDragonfly(index) {
    const group = new THREE.Group();
    group.name = `bluebell-dragonfly-${index + 1}`;
    const body = new THREE.Mesh(dragonBodyGeometry, dragonBodyMaterial);
    body.rotation.z = Math.PI / 2;
    const material = dragonWingMaterials[index % dragonWingMaterials.length];
    const leftFront = new THREE.Mesh(dragonWingGeometry, material);
    const rightFront = new THREE.Mesh(dragonWingGeometry, material);
    const leftBack = new THREE.Mesh(dragonWingGeometry, material);
    const rightBack = new THREE.Mesh(dragonWingGeometry, material);
    leftFront.position.set(-.1, .02, .02); rightFront.position.set(.1, .02, .02);
    leftBack.position.set(-.09, .02, -.08); rightBack.position.set(.09, .02, -.08);
    group.add(body, leftFront, rightFront, leftBack, rightBack);
    const anchor = dragonAnchors[index % dragonAnchors.length];
    group.position.set(anchor.x, TV.terrainHeight(anchor.x, anchor.z) + 1.2, anchor.z);
    root.add(group);
    dragonflies.push({ group, index, anchorIndex: index, phase: index * 1.42, dodge: 0, dodgeCount: 0, orbitCount: 0, wings: [leftFront, rightFront, leftBack, rightBack] });
  }

  for (let i = 0; i < 3; i++) makeDuck(i);
  for (let i = 0; i < 4; i++) makeDragonfly(i);

  function playerDistance2(position) {
    const p = TV.player?.position;
    if (!p) return Infinity;
    const dx = p.x - position.x, dz = p.z - position.z;
    return dx * dx + dz * dz;
  }

  function updateDuck(duck, dt) {
    duck.escape = Math.max(0, duck.escape - dt);
    if (duck.escape <= 0 && playerDistance2(duck.group.position) < 4.3 * 4.3) {
      duck.escape = 2.4;
      duck.escapeCount += 1;
      duckEscapes += 1;
      duck.phase += Math.PI * .72;
    }
    const boost = duck.escape > 0 ? 2.35 : 1;
    duck.phase += dt * duck.speed * boost;
    const rx = LAKE.rx * (.34 + duck.index * .055);
    const rz = LAKE.rz * (.3 + duck.index * .045);
    const desiredX = LAKE.x + Math.cos(duck.phase) * rx;
    const desiredZ = LAKE.z + Math.sin(duck.phase * .92 + duck.index * .3) * rz;
    const dx = desiredX - duck.group.position.x, dz = desiredZ - duck.group.position.z;
    const distance = Math.hypot(dx, dz);
    const follow = Math.min(1, dt * (duck.escape > 0 ? 5.5 : 2.2));
    duck.group.position.x += dx * follow;
    duck.group.position.z += dz * follow;
    duck.group.position.y = waterY + Math.sin(elapsed * 2.3 + duck.bobPhase) * .035;
    if (distance > .01) duck.group.rotation.y = Math.atan2(dx, dz);
    duck.wake.material.opacity = .2 + (duck.escape > 0 ? .34 : .12) + Math.sin(elapsed * 5 + duck.index) * .04;
    duck.wake.scale.setScalar(duck.escape > 0 ? 1.35 : 1);
  }

  function updateDragonfly(dragon, dt) {
    dragon.phase += dt * (1.25 + dragon.index * .06);
    dragon.dodge = Math.max(0, dragon.dodge - dt);
    if (dragon.dodge <= 0 && playerDistance2(dragon.group.position) < 2.2 * 2.2) {
      dragon.dodge = 1.15;
      dragon.dodgeCount += 1;
      dragonflyDodges += 1;
      dragon.anchorIndex = (dragon.anchorIndex + 1 + dragon.index) % dragonAnchors.length;
    }
    const anchor = dragonAnchors[dragon.anchorIndex];
    const radius = dragon.dodge > 0 ? 1.35 : .58;
    const desiredX = anchor.x + Math.cos(dragon.phase * 1.7) * radius;
    const desiredZ = anchor.z + Math.sin(dragon.phase * 1.35) * radius;
    const follow = Math.min(1, dt * (dragon.dodge > 0 ? 7 : 3.2));
    dragon.group.position.x += (desiredX - dragon.group.position.x) * follow;
    dragon.group.position.z += (desiredZ - dragon.group.position.z) * follow;
    const ground = TV.terrainHeight(dragon.group.position.x, dragon.group.position.z);
    dragon.group.position.y = ground + 1.05 + Math.sin(elapsed * 4.2 + dragon.phase) * .18 + (dragon.dodge > 0 ? .42 : 0);
    dragon.group.rotation.y = Math.atan2(desiredX - dragon.group.position.x, desiredZ - dragon.group.position.z);
    const flap = Math.sin(elapsed * 28 + dragon.index) * .7;
    dragon.wings[0].rotation.z = flap; dragon.wings[1].rotation.z = -flap;
    dragon.wings[2].rotation.z = -flap * .8; dragon.wings[3].rotation.z = flap * .8;
    if (Math.hypot(desiredX - dragon.group.position.x, desiredZ - dragon.group.position.z) < .08) dragon.orbitCount += 1;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    ducks.forEach(duck => updateDuck(duck, safeDt));
    dragonflies.forEach(dragon => updateDragonfly(dragon, safeDt));
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      duckCount: ducks.length,
      dragonflyCount: dragonflies.length,
      duckEscapes,
      dragonflyDodges,
      ducks: ducks.map(duck => ({ name: duck.group.name, x: duck.group.position.x, y: duck.group.position.y, z: duck.group.position.z, escape: duck.escape, escapeCount: duck.escapeCount, phase: duck.phase })),
      dragonflies: dragonflies.map(dragon => ({ name: dragon.group.name, x: dragon.group.position.x, y: dragon.group.position.y, z: dragon.group.position.z, anchorIndex: dragon.anchorIndex, dodge: dragon.dodge, dodgeCount: dragon.dodgeCount, orbitCount: dragon.orbitCount }))
    };
  }

  window.ToonValleyBluebellWildlife = Object.freeze({
    active: true,
    swimmingDuckFamily: true,
    reactiveWakeEffects: true,
    shorelineDragonflies: true,
    playerReactiveWildlife: true,
    lowPopulationBudget: true,
    advance,
    getState
  });
})();
