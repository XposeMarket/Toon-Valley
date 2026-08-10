(() => {
  'use strict';
  const TV = window.ToonValley;
  const Lake = window.ToonValleyBluebellLake;
  if (!TV?.scene || !TV?.registerUpdateHook || !Lake?.lake) return;

  const { THREE } = TV;
  const L = Lake.lake;
  const waterY = TV.terrainHeight(L.x, L.z) + .23;
  const root = new THREE.Group();
  root.name = 'bluebell-marsh-life';
  TV.scene.add(root);

  const shellGeo = new THREE.SphereGeometry(.28, 8, 6);
  const headGeo = new THREE.SphereGeometry(.11, 7, 5);
  const limbGeo = new THREE.SphereGeometry(.08, 6, 4);
  const shellMat = new THREE.MeshToonMaterial({ color: 0x526f38 });
  const skinMat = new THREE.MeshToonMaterial({ color: 0x789b55 });
  const logGeo = new THREE.CylinderGeometry(.18, .22, 1.45, 8);
  const logMat = new THREE.MeshToonMaterial({ color: 0x755236 });

  const fishGeo = new THREE.ConeGeometry(.09, .34, 6);
  const fishMats = [0x88c9d8, 0x9ed7c0, 0x7db7ce].map(color => new THREE.MeshToonMaterial({ color }));

  const frogBodyGeo = new THREE.SphereGeometry(.16, 7, 5);
  const frogEyeGeo = new THREE.SphereGeometry(.045, 6, 4);
  const frogLegGeo = new THREE.SphereGeometry(.085, 6, 4);
  const frogMats = [0x65a94d, 0x79b95a, 0x5d9c48].map(color => new THREE.MeshToonMaterial({ color }));
  const frogEyeMat = new THREE.MeshToonMaterial({ color: 0x172027 });
  const padGeo = new THREE.CircleGeometry(.48, 14);
  const padMat = new THREE.MeshToonMaterial({ color: 0x58a95d, side: THREE.DoubleSide });
  const rippleGeo = new THREE.RingGeometry(.18, .25, 18);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xd9f8ff, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide });

  const turtleAnchors = [
    { x: L.x - L.rx * .55, z: L.z - L.rz * .42, swimX: L.x - L.rx * .28, swimZ: L.z - L.rz * .22 },
    { x: L.x + L.rx * .48, z: L.z + L.rz * .35, swimX: L.x + L.rx * .2, swimZ: L.z + L.rz * .12 }
  ];
  const schoolHome = { x: L.x + L.rx * .08, z: L.z - L.rz * .18 };
  const schoolCenter = { x: schoolHome.x, z: schoolHome.z };
  const frogAnchors = [
    { x: L.x + L.rx * .10, z: L.z - L.rz * .09, waterX: L.x + L.rx * .17, waterZ: L.z - L.rz * .15 },
    { x: L.x - L.rx * .20, z: L.z + L.rz * .08, waterX: L.x - L.rx * .13, waterZ: L.z + L.rz * .13 },
    { x: L.x + L.rx * .27, z: L.z + L.rz * .12, waterX: L.x + L.rx * .20, waterZ: L.z + L.rz * .18 }
  ];

  let elapsed = 0;
  let turtleDives = 0;
  let turtleReturnTurns = 0;
  let turtleReturnSnapsPrevented = 0;
  let minnowScatters = 0;
  let boundedEscapeCorrections = 0;
  let frogJumps = 0;
  let frogReturns = 0;
  let ecosystemScatters = 0;
  const turtles = [];
  const minnows = [];
  const frogs = [];

  function playerDistance2(x, z) {
    const p = TV.player?.position;
    if (!p) return Infinity;
    const dx = p.x - x, dz = p.z - z;
    return dx * dx + dz * dz;
  }

  function clampToLake(x, z, radius = .72) {
    const nx = (x - L.x) / Math.max(.001, L.rx * radius);
    const nz = (z - L.z) / Math.max(.001, L.rz * radius);
    const d = Math.hypot(nx, nz);
    if (d <= 1) return { x, z, corrected: false };
    const scale = 1 / d;
    return {
      x: L.x + (x - L.x) * scale,
      z: L.z + (z - L.z) * scale,
      corrected: true
    };
  }

  function faceTarget(group, x, z) {
    const dx = x - group.position.x, dz = z - group.position.z;
    if (Math.hypot(dx, dz) > .01) group.rotation.y = Math.atan2(dx, dz);
  }

  function makeTurtle(index) {
    const a = turtleAnchors[index];
    const log = new THREE.Mesh(logGeo, logMat);
    log.name = `bluebell-basking-log-${index + 1}`;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = index ? -.45 : .3;
    log.position.set(a.x, waterY + .04, a.z);
    root.add(log);

    const g = new THREE.Group();
    g.name = `bluebell-turtle-${index + 1}`;
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.scale.set(1.25, .55, 1.45);
    shell.position.y = .14;
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, .15, .32);
    const feet = [];
    [[-.2,.02,.15],[.2,.02,.15],[-.19,.02,-.17],[.19,.02,-.17]].forEach(([x,y,z]) => {
      const f = new THREE.Mesh(limbGeo, skinMat);
      f.scale.set(1.1,.45,1.4);
      f.position.set(x,y,z);
      g.add(f);
      feet.push(f);
    });
    g.add(shell, head);
    g.position.set(a.x, waterY + .17, a.z);
    root.add(g);
    turtles.push({ g, log, head, feet, anchor:a, state:'basking', timer:1.5 + index, dives:0, phase:index * 1.7, paddleAngle:0, returnTurned:false });
  }

  function makeMinnow(index) {
    const g = new THREE.Group();
    g.name = `bluebell-minnow-${index + 1}`;
    const body = new THREE.Mesh(fishGeo, fishMats[index % fishMats.length]);
    body.rotation.x = Math.PI / 2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.07,.13,4), fishMats[index % fishMats.length]);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -.22;
    g.add(body, tail);
    const angle = index / 7 * Math.PI * 2;
    g.position.set(schoolCenter.x + Math.cos(angle) * .9, waterY - .12, schoolCenter.z + Math.sin(angle) * .65);
    root.add(g);
    minnows.push({ g, tail, index, angle, scatter:0, scatterX:g.position.x, scatterZ:g.position.z, turnRate:0, cause:'school' });
  }

  function makeFrog(index) {
    const a = frogAnchors[index];
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.name = `bluebell-frog-pad-${index + 1}`;
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = index * .7;
    pad.scale.setScalar(index === 1 ? .88 : 1);
    pad.position.set(a.x, waterY + .015, a.z);
    root.add(pad);

    const g = new THREE.Group();
    g.name = `bluebell-frog-${index + 1}`;
    const body = new THREE.Mesh(frogBodyGeo, frogMats[index % frogMats.length]);
    body.scale.set(1.15, .7, 1.35);
    body.position.y = .12;
    const head = new THREE.Mesh(frogBodyGeo, frogMats[index % frogMats.length]);
    head.scale.set(.92, .68, .82);
    head.position.set(0, .18, .19);
    const eyes = [];
    for (const x of [-.075, .075]) {
      const eye = new THREE.Mesh(frogEyeGeo, frogEyeMat);
      eye.position.set(x, .27, .27);
      g.add(eye);
      eyes.push(eye);
    }
    const legs = [];
    for (const x of [-.14, .14]) {
      const leg = new THREE.Mesh(frogLegGeo, frogMats[index % frogMats.length]);
      leg.scale.set(1.35, .5, 1.8);
      leg.position.set(x, .05, -.10);
      g.add(leg);
      legs.push(leg);
    }
    g.add(body, head);
    g.position.set(a.x, waterY + .09, a.z);
    root.add(g);

    const ripple = new THREE.Mesh(rippleGeo, rippleMat.clone());
    ripple.name = `bluebell-frog-ripple-${index + 1}`;
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(a.waterX, waterY + .035, a.waterZ);
    ripple.visible = false;
    root.add(ripple);

    frogs.push({ g, pad, ripple, legs, eyes, anchor:a, state:'resting', timer:1 + index * .65, cooldown:0, phase:index * 1.9, jumpT:0, rippleT:0, startX:a.x, startZ:a.z, jumps:0 });
  }

  turtleAnchors.forEach((_, i) => makeTurtle(i));
  for (let i = 0; i < 7; i++) makeMinnow(i);
  frogAnchors.forEach((_, i) => makeFrog(i));

  function scatterMinnowsFrom(x, z, radius = 3.4, strength = 1.65, cause = 'ecosystem') {
    let affected = 0;
    for (const m of minnows) {
      const dx = m.g.position.x - x, dz = m.g.position.z - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const nx = d > .02 ? dx / d : Math.cos(m.index * 1.7);
      const nz = d > .02 ? dz / d : Math.sin(m.index * 1.7);
      const target = clampToLake(m.g.position.x + nx * strength, m.g.position.z + nz * strength * .82);
      m.scatterX = target.x;
      m.scatterZ = target.z;
      m.scatter = Math.max(m.scatter, .95);
      m.cause = cause;
      if (target.corrected) boundedEscapeCorrections++;
      affected++;
    }
    if (affected) ecosystemScatters++;
    return affected;
  }

  function poseTurtle(t) {
    if (t.state === 'basking') {
      t.paddleAngle *= .75;
      t.head.position.y += (.15 - t.head.position.y) * .2;
      t.feet.forEach(foot => { foot.rotation.x *= .7; foot.rotation.z *= .7; });
      return;
    }
    const pace = t.state === 'diving' ? 11 : t.state === 'returning' ? 7.5 : 8.5;
    t.paddleAngle = Math.sin(elapsed * pace + t.phase) * .62;
    t.feet.forEach((foot, index) => {
      const side = index % 2 ? -1 : 1;
      const fore = index < 2 ? 1 : -.72;
      foot.rotation.x = t.paddleAngle * fore;
      foot.rotation.z = t.paddleAngle * side * .22;
    });
    const targetHeadY = t.state === 'diving' ? .07 : .13;
    t.head.position.y += (targetHeadY - t.head.position.y) * .18;
  }

  function updateTurtle(t, dt) {
    t.timer = Math.max(0, t.timer - dt);
    t.phase += dt;
    const a = t.anchor;
    if (t.state === 'basking') {
      t.g.position.y = waterY + .17 + Math.sin(t.phase * 1.7) * .012;
      if (t.timer <= 0 && playerDistance2(t.g.position.x, t.g.position.z) < 3.25 * 3.25) {
        t.state = 'diving'; t.timer = 1.05; t.dives++; turtleDives++; t.returnTurned = false;
        scatterMinnowsFrom(t.g.position.x, t.g.position.z, 5.4, 1.15, 'turtle-dive');
      }
    } else if (t.state === 'diving') {
      const k = Math.min(1, dt * 2.3);
      t.g.position.x += (a.swimX - t.g.position.x) * k;
      t.g.position.z += (a.swimZ - t.g.position.z) * k;
      t.g.position.y += (waterY - .18 - t.g.position.y) * Math.min(1, dt * 3.2);
      faceTarget(t.g, a.swimX, a.swimZ);
      if (t.timer <= 0) { t.state = 'swimming'; t.timer = 3.3; }
    } else if (t.state === 'swimming') {
      const orbit = t.phase * .7 + t.dives;
      const tx = a.swimX + Math.cos(orbit) * .5;
      const tz = a.swimZ + Math.sin(orbit) * .36;
      const k = Math.min(1, dt * 1.2);
      t.g.position.x += (tx - t.g.position.x) * k;
      t.g.position.z += (tz - t.g.position.z) * k;
      t.g.position.y = waterY - .16 + Math.sin(t.phase * 3) * .018;
      faceTarget(t.g, tx, tz);
      if (t.timer <= 0 && playerDistance2(t.g.position.x, t.g.position.z) > 4.5 * 4.5) { t.state = 'returning'; t.timer = 2.2; }
    } else {
      if (!t.returnTurned) { turtleReturnTurns++; t.returnTurned = true; }
      const k = Math.min(1, dt * 1.6);
      t.g.position.x += (a.x - t.g.position.x) * k;
      t.g.position.z += (a.z - t.g.position.z) * k;
      t.g.position.y += (waterY + .17 - t.g.position.y) * Math.min(1, dt * 2.2);
      faceTarget(t.g, a.x, a.z);
      const distance = Math.hypot(a.x - t.g.position.x, a.z - t.g.position.z);
      if (t.timer <= 0 && distance >= .18) turtleReturnSnapsPrevented++;
      if (distance < .18) {
        t.g.position.set(a.x, waterY + .17, a.z); t.state = 'basking'; t.timer = 2.5;
      }
    }
    poseTurtle(t);
  }

  function updateSchoolCenter(dt) {
    const tx = schoolHome.x + Math.cos(elapsed * .29) * 1.25;
    const tz = schoolHome.z + Math.sin(elapsed * .23) * .82;
    schoolCenter.x += (tx - schoolCenter.x) * Math.min(1, dt * .7);
    schoolCenter.z += (tz - schoolCenter.z) * Math.min(1, dt * .7);
  }

  function updateMinnow(m, dt) {
    m.angle += dt * (.75 + m.index * .035);
    m.scatter = Math.max(0, m.scatter - dt);
    const near = playerDistance2(m.g.position.x, m.g.position.z) < 2.7 * 2.7;
    if (near && m.scatter <= 0) {
      const p = TV.player.position;
      const dx = m.g.position.x - p.x, dz = m.g.position.z - p.z;
      const len = Math.hypot(dx,dz) || 1;
      const target = clampToLake(m.g.position.x + dx / len * 2.1, m.g.position.z + dz / len * 1.7);
      m.scatterX = target.x;
      m.scatterZ = target.z;
      if (target.corrected) boundedEscapeCorrections++;
      m.scatter = 1.15;
      m.cause = 'player';
      minnowScatters++;
    }
    let tx, tz;
    if (m.scatter > 0) { tx = m.scatterX; tz = m.scatterZ; }
    else {
      m.cause = 'school';
      const row = (m.index % 3) - 1;
      const ring = .82 + Math.floor(m.index / 3) * .22;
      tx = schoolCenter.x + Math.cos(m.angle + m.index * .7) * ring + row * .08;
      tz = schoolCenter.z + Math.sin(m.angle + m.index * .54) * (.58 + ring * .16);
      const bounded = clampToLake(tx, tz, .68);
      tx = bounded.x; tz = bounded.z;
    }
    const dx = tx - m.g.position.x, dz = tz - m.g.position.z;
    const speed = m.scatter > 0 ? 4.4 : 1.35;
    const d = Math.hypot(dx,dz);
    if (d > .001) {
      const step = Math.min(d, speed * dt);
      m.g.position.x += dx / d * step;
      m.g.position.z += dz / d * step;
      const desiredYaw = Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(desiredYaw - m.g.rotation.y), Math.cos(desiredYaw - m.g.rotation.y));
      m.turnRate = delta;
      m.g.rotation.y += delta * Math.min(1, dt * 7);
    } else m.turnRate *= .75;
    m.g.position.y = waterY - .13 + Math.sin(elapsed * 4 + m.index) * .035;
    m.tail.rotation.z = Math.sin(elapsed * (m.scatter > 0 ? 18 : 11) + m.index) * .52;
  }

  function updateFrog(f, dt) {
    const a = f.anchor;
    f.timer = Math.max(0, f.timer - dt);
    f.cooldown = Math.max(0, f.cooldown - dt);
    f.phase += dt;
    if (f.rippleT > 0) {
      f.rippleT = Math.max(0, f.rippleT - dt);
      const progress = 1 - f.rippleT / .75;
      f.ripple.visible = true;
      f.ripple.scale.setScalar(1 + progress * 3.2);
      f.ripple.material.opacity = .38 * (1 - progress);
      if (f.rippleT <= 0) f.ripple.visible = false;
    }

    if (f.state === 'resting') {
      f.g.position.set(a.x, waterY + .09 + Math.sin(f.phase * 2.1) * .012, a.z);
      f.g.rotation.x *= .7;
      f.legs.forEach((leg, i) => { leg.rotation.x *= .7; leg.rotation.z = Math.sin(f.phase * 2 + i) * .04; });
      if (f.timer <= 0 && f.cooldown <= 0 && playerDistance2(a.x, a.z) < 3.15 * 3.15) {
        f.state = 'jumping';
        f.jumpT = 0;
        f.startX = f.g.position.x;
        f.startZ = f.g.position.z;
        f.timer = .58;
        f.jumps++;
        frogJumps++;
        scatterMinnowsFrom(a.waterX, a.waterZ, 4.2, 1.6, 'frog-jump');
      }
      return;
    }

    if (f.state === 'jumping') {
      f.jumpT = Math.min(1, f.jumpT + dt / .58);
      const eased = f.jumpT * f.jumpT * (3 - 2 * f.jumpT);
      f.g.position.x = THREE.MathUtils.lerp(f.startX, a.waterX, eased);
      f.g.position.z = THREE.MathUtils.lerp(f.startZ, a.waterZ, eased);
      f.g.position.y = waterY + .08 + Math.sin(f.jumpT * Math.PI) * .82;
      faceTarget(f.g, a.waterX, a.waterZ);
      f.legs.forEach((leg, i) => { leg.rotation.x = -.9 + i * .12; });
      if (f.jumpT >= 1 || f.timer <= 0) {
        f.state = 'swimming';
        f.timer = 2.25 + (f.jumps % 2) * .35;
        f.rippleT = .75;
        f.ripple.scale.setScalar(1);
        f.ripple.material.opacity = .38;
      }
      return;
    }

    if (f.state === 'swimming') {
      const tx = a.waterX + Math.cos(f.phase * 1.35) * .55;
      const tz = a.waterZ + Math.sin(f.phase * 1.15) * .42;
      const k = Math.min(1, dt * 2.0);
      f.g.position.x += (tx - f.g.position.x) * k;
      f.g.position.z += (tz - f.g.position.z) * k;
      f.g.position.y = waterY + .015 + Math.sin(f.phase * 5) * .018;
      faceTarget(f.g, tx, tz);
      f.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(elapsed * 10 + i * Math.PI) * .65; });
      if (f.timer <= 0) {
        f.state = 'returning';
        f.timer = 2.2;
      }
      return;
    }

    const k = Math.min(1, dt * 1.85);
    f.g.position.x += (a.x - f.g.position.x) * k;
    f.g.position.z += (a.z - f.g.position.z) * k;
    f.g.position.y += (waterY + .09 - f.g.position.y) * Math.min(1, dt * 2.4);
    faceTarget(f.g, a.x, a.z);
    f.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(elapsed * 8 + i * Math.PI) * .35; });
    if (Math.hypot(a.x - f.g.position.x, a.z - f.g.position.z) < .14) {
      f.g.position.set(a.x, waterY + .09, a.z);
      f.state = 'resting';
      f.timer = 1.4;
      f.cooldown = 2.4;
      frogReturns++;
    }
  }

  function advance(dt = 0) {
    const safe = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safe;
    updateSchoolCenter(safe);
    turtles.forEach(t => updateTurtle(t, safe));
    minnows.forEach(m => updateMinnow(m, safe));
    frogs.forEach(f => updateFrog(f, safe));
  }
  TV.registerUpdateHook(advance);

  function getState() {
    return {
      turtleCount:turtles.length, minnowCount:minnows.length, frogCount:frogs.length,
      turtleDives, turtleReturnTurns, turtleReturnSnapsPrevented, minnowScatters, boundedEscapeCorrections, frogJumps, frogReturns, ecosystemScatters,
      schoolCenter:{ x:schoolCenter.x, z:schoolCenter.z },
      turtles:turtles.map(t => ({ name:t.g.name, x:t.g.position.x, y:t.g.position.y, z:t.g.position.z, rotationY:t.g.rotation.y, state:t.state, dives:t.dives, paddleAngle:t.paddleAngle, headY:t.head.position.y })),
      minnows:minnows.map(m => ({ name:m.g.name, x:m.g.position.x, y:m.g.position.y, z:m.g.position.z, scatter:m.scatter, turnRate:m.turnRate, tailZ:m.tail.rotation.z, cause:m.cause })),
      frogs:frogs.map(f => ({ name:f.g.name, x:f.g.position.x, y:f.g.position.y, z:f.g.position.z, state:f.state, jumps:f.jumps, rippleVisible:f.ripple.visible, rippleScale:f.ripple.scale.x, legX:f.legs[0].rotation.x }))
    };
  }

  window.ToonValleyBluebellMarshLife = Object.freeze({
    active:true, baskingTurtles:true, physicalDiveAndReturn:true, reactiveMinnowSchool:true, isolatedFromFishing:true, lowPopulationBudget:true,
    visibleTurtlePaddling:true, correctedReturnFacing:true, coordinatedMovingSchool:true, boundedMinnowEscape:true,
    noReturnSnap:true, lilyPadFrogLifecycle:true, visibleFrogRipples:true, ecosystemDisturbanceReactions:true,
    advance, getState
  });
})();