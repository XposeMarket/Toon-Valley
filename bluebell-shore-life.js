(() => {
  'use strict';
  const TV = window.ToonValley;
  const Lake = window.ToonValleyBluebellLake;
  if (!TV?.scene || !TV?.registerUpdateHook || !Lake?.lake) return;

  const { THREE } = TV;
  const LAKE = Lake.lake;
  const waterY = TV.terrainHeight(LAKE.x, LAKE.z) + .23;
  const root = new THREE.Group();
  root.name = 'bluebell-shore-life';
  TV.scene.add(root);

  const padGeometry = new THREE.CylinderGeometry(.42, .48, .045, 14);
  const padMaterial = new THREE.MeshToonMaterial({ color: 0x5e9d4b });
  const frogBodyGeometry = new THREE.SphereGeometry(.15, 7, 5);
  const frogHeadGeometry = new THREE.SphereGeometry(.11, 7, 5);
  const frogMaterials = [0x6ea64a, 0x8ab65a, 0x548b42].map(color => new THREE.MeshToonMaterial({ color }));
  const frogEyeMaterial = new THREE.MeshBasicMaterial({ color: 0x182219 });

  const heronBodyMaterial = new THREE.MeshToonMaterial({ color: 0xaab8c5 });
  const heronWingMaterial = new THREE.MeshToonMaterial({ color: 0x8f9ba7 });
  const heronLegMaterial = new THREE.MeshToonMaterial({ color: 0xd4a65b });
  const heronBeakMaterial = new THREE.MeshToonMaterial({ color: 0xe0a143 });
  const heronBodyGeometry = new THREE.SphereGeometry(.24, 8, 6);
  const heronWingGeometry = new THREE.SphereGeometry(.26, 7, 5);
  const heronNeckGeometry = new THREE.CylinderGeometry(.055, .07, .48, 6);
  const heronHeadGeometry = new THREE.SphereGeometry(.13, 7, 5);
  const heronLegGeometry = new THREE.CylinderGeometry(.025, .03, .5, 5);
  const rippleGeometry = new THREE.RingGeometry(.16, .22, 20);
  const fishGlintGeometry = new THREE.SphereGeometry(.065, 6, 4);
  const fishGlintMaterial = new THREE.MeshBasicMaterial({ color: 0xd9f4ff });

  const frogAnchors = [
    { x: LAKE.x - LAKE.rx * .46, z: LAKE.z + LAKE.rz * .38 },
    { x: LAKE.x - LAKE.rx * .18, z: LAKE.z + LAKE.rz * .56 },
    { x: LAKE.x + LAKE.rx * .31, z: LAKE.z + LAKE.rz * .47 }
  ];
  const heronAnchors = [
    { x: LAKE.x + LAKE.rx * .72, z: LAKE.z - LAKE.rz * .16 },
    { x: LAKE.x + LAKE.rx * .6, z: LAKE.z + LAKE.rz * .3 },
    { x: LAKE.x - LAKE.rx * .64, z: LAKE.z - LAKE.rz * .18 }
  ];

  const frogs = [];
  const ripples = [];
  let elapsed = 0;
  let frogJumps = 0;
  let frogSplashRipples = 0;
  let heronFlights = 0;
  let heronHunts = 0;
  let heronStrikeRipples = 0;

  function playerDistance2(position) {
    const p = TV.player?.position;
    if (!p) return Infinity;
    const dx = p.x - position.x;
    const dz = p.z - position.z;
    return dx * dx + dz * dz;
  }

  function makeRipple(index) {
    const material = new THREE.MeshBasicMaterial({ color: 0xbcecff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(rippleGeometry, material);
    mesh.name = `bluebell-shore-ripple-${index + 1}`;
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    root.add(mesh);
    const state = { mesh, life: 0, maxLife: 0, strength: 0 };
    ripples.push(state);
    return state;
  }

  for (let i = 0; i < 8; i += 1) makeRipple(i);

  function emitRipple(x, z, strength = 1) {
    let ripple = ripples.find(item => item.life <= 0);
    if (!ripple) ripple = ripples.reduce((oldest, item) => item.life < oldest.life ? item : oldest, ripples[0]);
    ripple.life = .82;
    ripple.maxLife = .82;
    ripple.strength = Math.max(.45, Math.min(1.3, strength));
    ripple.mesh.position.set(x, waterY + .045, z);
    ripple.mesh.scale.setScalar(.5);
    ripple.mesh.material.opacity = .72 * ripple.strength;
    ripple.mesh.visible = true;
  }

  function updateRipples(dt) {
    for (const ripple of ripples) {
      if (ripple.life <= 0) continue;
      ripple.life = Math.max(0, ripple.life - dt);
      const progress = 1 - ripple.life / ripple.maxLife;
      ripple.mesh.scale.setScalar(.5 + progress * (3.2 + ripple.strength));
      ripple.mesh.material.opacity = Math.max(0, (1 - progress) * .72 * ripple.strength);
      if (ripple.life <= 0) ripple.mesh.visible = false;
    }
  }

  function makeFrog(index) {
    const anchor = frogAnchors[index];
    const pad = new THREE.Mesh(padGeometry, padMaterial);
    pad.name = `bluebell-lily-pad-${index + 1}`;
    pad.position.set(anchor.x, waterY + .025, anchor.z);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(.32, .08, .16), new THREE.MeshBasicMaterial({ color: 0x7bc568 }));
    notch.position.set(.26, .02, 0);
    pad.add(notch);

    const frog = new THREE.Group();
    frog.name = `bluebell-frog-${index + 1}`;
    const material = frogMaterials[index % frogMaterials.length];
    const body = new THREE.Mesh(frogBodyGeometry, material);
    body.scale.set(1.2, .75, 1.35);
    body.position.y = .12;
    const head = new THREE.Mesh(frogHeadGeometry, material);
    head.position.set(0, .23, .13);
    const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(.028, 5, 4), frogEyeMaterial);
    const eyeRight = eyeLeft.clone();
    eyeLeft.position.set(-.06, .29, .19);
    eyeRight.position.set(.06, .29, .19);
    frog.add(body, head, eyeLeft, eyeRight);
    frog.position.set(anchor.x, waterY + .07, anchor.z);
    root.add(pad, frog);
    frogs.push({ frog, pad, anchor, index, jump: 0, rest: 0, jumpCount: 0, startX: anchor.x, startZ: anchor.z, targetX: anchor.x, targetZ: anchor.z, lastEscapeX: 0, lastEscapeZ: 0 });
  }

  function makeHeron() {
    const group = new THREE.Group();
    group.name = 'bluebell-heron';
    const body = new THREE.Mesh(heronBodyGeometry, heronBodyMaterial);
    body.scale.set(.8, 1.05, 1.35);
    body.position.y = .72;
    const neck = new THREE.Mesh(heronNeckGeometry, heronBodyMaterial);
    neck.position.set(0, 1.03, .17);
    neck.rotation.x = -.18;
    const head = new THREE.Mesh(heronHeadGeometry, heronBodyMaterial);
    head.position.set(0, 1.3, .27);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(.055, .34, 6), heronBeakMaterial);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.28, .48);
    const leftWing = new THREE.Mesh(heronWingGeometry, heronWingMaterial);
    const rightWing = leftWing.clone();
    leftWing.scale.set(.45, .22, 1.15);
    rightWing.scale.copy(leftWing.scale);
    leftWing.position.set(-.21, .75, -.03);
    rightWing.position.set(.21, .75, -.03);
    const leftLeg = new THREE.Mesh(heronLegGeometry, heronLegMaterial);
    const rightLeg = leftLeg.clone();
    leftLeg.position.set(-.08, .28, .02);
    rightLeg.position.set(.08, .28, .02);
    group.add(body, neck, head, beak, leftWing, rightWing, leftLeg, rightLeg);
    const fishGlint = new THREE.Mesh(fishGlintGeometry, fishGlintMaterial);
    fishGlint.name = 'bluebell-heron-fish-glint';
    fishGlint.visible = false;
    fishGlint.position.y = waterY + .055;
    root.add(fishGlint);
    const anchor = heronAnchors[0];
    group.position.set(anchor.x, Math.max(waterY - .09, TV.terrainHeight(anchor.x, anchor.z) + .05), anchor.z);
    root.add(group);
    return { group, neck, head, beak, leftWing, rightWing, fishGlint, anchorIndex: 0, state: 'wading', timer: 1.8, flightCount: 0, huntCount: 0, stepPhase: 0, strikeX: anchor.x, strikeZ: anchor.z };
  }

  for (let i = 0; i < frogAnchors.length; i++) makeFrog(i);
  const heron = makeHeron();

  function updateFrog(item, dt) {
    item.rest = Math.max(0, item.rest - dt);
    if (item.jump <= 0 && item.rest <= 0 && playerDistance2(item.frog.position) < 2.15 * 2.15) {
      item.jump = 1;
      item.jumpCount += 1;
      frogJumps += 1;
      item.startX = item.frog.position.x;
      item.startZ = item.frog.position.z;
      const playerX = TV.player?.position.x ?? (item.frog.position.x - 1);
      const playerZ = TV.player?.position.z ?? (item.frog.position.z - 1);
      const dx = item.frog.position.x - playerX;
      const dz = item.frog.position.z - playerZ;
      const len = Math.hypot(dx, dz) || 1;
      item.lastEscapeX = dx / len;
      item.lastEscapeZ = dz / len;
      item.targetX = item.anchor.x + item.lastEscapeX * .9;
      item.targetZ = item.anchor.z + item.lastEscapeZ * .9;
      emitRipple(item.startX, item.startZ, .72);
      frogSplashRipples += 1;
    }
    if (item.jump > 0) {
      item.jump = Math.max(0, item.jump - dt * 1.85);
      const t = 1 - item.jump;
      item.frog.position.x = item.startX + (item.targetX - item.startX) * t;
      item.frog.position.z = item.startZ + (item.targetZ - item.startZ) * t;
      item.frog.position.y = waterY + .07 + Math.sin(Math.PI * t) * .72;
      item.frog.rotation.x = Math.sin(Math.PI * t) * -.28;
      if (item.jump === 0) {
        item.rest = 2.6;
        emitRipple(item.frog.position.x, item.frog.position.z, .95);
        frogSplashRipples += 1;
      }
      return;
    }
    const returnFollow = Math.min(1, dt * .85);
    item.frog.position.x += (item.anchor.x - item.frog.position.x) * returnFollow;
    item.frog.position.z += (item.anchor.z - item.frog.position.z) * returnFollow;
    item.frog.position.y = waterY + .07 + Math.sin(elapsed * 2.1 + item.index) * .018;
    item.frog.rotation.x = 0;
  }

  function beginHeronFlight() {
    heron.state = 'flying';
    heron.timer = 2.8;
    heron.flightCount += 1;
    heronFlights += 1;
    heron.anchorIndex = (heron.anchorIndex + 1) % heronAnchors.length;
    heron.fishGlint.visible = false;
    heron.neck.rotation.x = -.18;
    heron.head.position.set(0, 1.3, .27);
    heron.beak.position.set(0, 1.28, .48);
  }

  function beginHeronHunt() {
    const forwardX = Math.sin(heron.group.rotation.y);
    const forwardZ = Math.cos(heron.group.rotation.y);
    heron.strikeX = heron.group.position.x + forwardX * .72;
    heron.strikeZ = heron.group.position.z + forwardZ * .72;
    heron.fishGlint.position.set(heron.strikeX, waterY + .055, heron.strikeZ);
    heron.fishGlint.visible = true;
    heron.state = 'stalking';
    heron.timer = 1.35;
  }

  function updateHeron(dt) {
    heron.timer = Math.max(0, heron.timer - dt);
    heron.stepPhase += dt;
    const playerNear = playerDistance2(heron.group.position) < 4.5 * 4.5;
    if (playerNear && heron.state !== 'flying' && heron.state !== 'landing') beginHeronFlight();

    const anchor = heronAnchors[heron.anchorIndex];
    if (heron.state === 'flying') {
      const follow = Math.min(1, dt * 1.4);
      const dx = anchor.x - heron.group.position.x;
      const dz = anchor.z - heron.group.position.z;
      heron.group.position.x += dx * follow;
      heron.group.position.z += dz * follow;
      heron.group.position.y += (waterY + 3.4 - heron.group.position.y) * Math.min(1, dt * 2.2);
      heron.group.rotation.y = Math.atan2(dx, dz);
      const flap = Math.sin(elapsed * 14) * .9;
      heron.leftWing.rotation.z = flap;
      heron.rightWing.rotation.z = -flap;
      if (heron.timer <= 0 || Math.hypot(dx, dz) < .45) {
        heron.state = 'landing';
        heron.timer = 1.15;
      }
      return;
    }

    if (heron.state === 'landing') {
      const ground = Math.max(waterY - .09, TV.terrainHeight(anchor.x, anchor.z) + .05);
      heron.group.position.x += (anchor.x - heron.group.position.x) * Math.min(1, dt * 2.4);
      heron.group.position.z += (anchor.z - heron.group.position.z) * Math.min(1, dt * 2.4);
      heron.group.position.y += (ground - heron.group.position.y) * Math.min(1, dt * 2.6);
      heron.leftWing.rotation.z *= Math.max(0, 1 - dt * 4);
      heron.rightWing.rotation.z *= Math.max(0, 1 - dt * 4);
      if (heron.timer <= 0) {
        heron.group.position.set(anchor.x, ground, anchor.z);
        heron.state = 'wading';
        heron.timer = 2.5;
      }
      return;
    }

    const ground = Math.max(waterY - .09, TV.terrainHeight(heron.group.position.x, heron.group.position.z) + .05);
    heron.group.position.y = ground + Math.sin(heron.stepPhase * 2.2) * .015;
    heron.leftWing.rotation.z = 0;
    heron.rightWing.rotation.z = 0;

    if (heron.state === 'stalking') {
      const crouch = .5 + .5 * Math.sin((1.35 - heron.timer) * 4);
      heron.neck.rotation.x = -.18 - crouch * .38;
      heron.head.position.y = 1.3 - crouch * .18;
      heron.beak.position.y = 1.28 - crouch * .2;
      heron.fishGlint.scale.setScalar(.85 + Math.sin(elapsed * 10) * .16);
      if (heron.timer <= 0) {
        heron.state = 'striking';
        heron.timer = .52;
        heron.huntCount += 1;
        heronHunts += 1;
        emitRipple(heron.strikeX, heron.strikeZ, 1.25);
        heronStrikeRipples += 1;
      }
      return;
    }

    if (heron.state === 'striking') {
      const strike = Math.max(0, Math.min(1, heron.timer / .52));
      heron.neck.rotation.x = -.82 + strike * .18;
      heron.head.position.y = .96 + strike * .14;
      heron.beak.position.y = .92 + strike * .16;
      heron.fishGlint.visible = heron.timer > .22;
      if (heron.timer <= 0) {
        heron.state = 'wading';
        heron.timer = 3.2;
        heron.fishGlint.visible = false;
        heron.neck.rotation.x = -.18;
        heron.head.position.set(0, 1.3, .27);
        heron.beak.position.set(0, 1.28, .48);
      }
      return;
    }

    heron.neck.rotation.x = -.18;
    heron.head.position.set(0, 1.3, .27);
    heron.beak.position.set(0, 1.28, .48);
    heron.group.rotation.y += Math.sin(elapsed * .37) * dt * .08;
    if (heron.timer <= 0 && !playerNear) beginHeronHunt();
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    frogs.forEach(item => updateFrog(item, safeDt));
    updateHeron(safeDt);
    updateRipples(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      frogCount: frogs.length,
      frogJumps,
      frogSplashRipples,
      activeRipples: ripples.filter(item => item.life > 0).length,
      heronFlights,
      heronHunts,
      heronStrikeRipples,
      frogs: frogs.map(item => ({ name: item.frog.name, x: item.frog.position.x, y: item.frog.position.y, z: item.frog.position.z, jump: item.jump, jumpCount: item.jumpCount, rest: item.rest, lastEscapeX: item.lastEscapeX, lastEscapeZ: item.lastEscapeZ })),
      heron: { name: heron.group.name, x: heron.group.position.x, y: heron.group.position.y, z: heron.group.position.z, state: heron.state, anchorIndex: heron.anchorIndex, flightCount: heron.flightCount, huntCount: heron.huntCount, fishGlintVisible: heron.fishGlint.visible }
    };
  }

  window.ToonValleyBluebellShoreLife = Object.freeze({
    active: true,
    reactiveLilyFrogs: true,
    visibleFrogJumps: true,
    frogWaterRipples: true,
    wadingHeron: true,
    heronStalkAndStrike: true,
    reactiveHeronFlight: true,
    lowPopulationBudget: true,
    advance,
    getState
  });
})();
