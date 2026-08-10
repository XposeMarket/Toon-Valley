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

  const turtleAnchors = [
    { x: L.x - L.rx * .55, z: L.z - L.rz * .42, swimX: L.x - L.rx * .28, swimZ: L.z - L.rz * .22 },
    { x: L.x + L.rx * .48, z: L.z + L.rz * .35, swimX: L.x + L.rx * .2, swimZ: L.z + L.rz * .12 }
  ];
  const schoolHome = { x: L.x + L.rx * .08, z: L.z - L.rz * .18 };
  const schoolCenter = { x: schoolHome.x, z: schoolHome.z };

  let elapsed = 0;
  let turtleDives = 0;
  let turtleReturnTurns = 0;
  let minnowScatters = 0;
  let boundedEscapeCorrections = 0;
  const turtles = [];
  const minnows = [];

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
    minnows.push({ g, tail, index, angle, scatter:0, scatterX:g.position.x, scatterZ:g.position.z, turnRate:0 });
  }

  turtleAnchors.forEach((_, i) => makeTurtle(i));
  for (let i = 0; i < 7; i++) makeMinnow(i);

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
      if (Math.hypot(a.x - t.g.position.x, a.z - t.g.position.z) < .18 || t.timer <= 0) {
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
      minnowScatters++;
    }
    let tx, tz;
    if (m.scatter > 0) { tx = m.scatterX; tz = m.scatterZ; }
    else {
      const row = (m.index % 3) - 1;
      const ring = .82 + Math.floor(m.index / 3) * .22;
      tx = schoolCenter.x + Math.cos(m.angle + m.index * .7) * ring + row * .08;
      tz = schoolCenter.z + Math.sin(m.angle + m.index * .54) * (.58 + ring * .16);
      const bounded = clampToLake(tx, tz, .68);
      tx = bounded.x; tz = bounded.z;
    }
    const dx = tx - m.g.position.x, dz = tz - m.g.position.z;
    const speed = m.scatter > 0 ? 4.4 : 1.35;
    const d = Math.hypot(dx,dz) || 1;
    const step = Math.min(d, speed * dt);
    m.g.position.x += dx / d * step;
    m.g.position.z += dz / d * step;
    m.g.position.y = waterY - .13 + Math.sin(elapsed * 4 + m.index) * .035;
    const desiredYaw = Math.atan2(dx, dz);
    const delta = Math.atan2(Math.sin(desiredYaw - m.g.rotation.y), Math.cos(desiredYaw - m.g.rotation.y));
    m.turnRate = delta;
    m.g.rotation.y += delta * Math.min(1, dt * 7);
    m.tail.rotation.z = Math.sin(elapsed * (m.scatter > 0 ? 18 : 11) + m.index) * .52;
  }

  function advance(dt = 0) {
    const safe = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safe;
    updateSchoolCenter(safe);
    turtles.forEach(t => updateTurtle(t, safe));
    minnows.forEach(m => updateMinnow(m, safe));
  }
  TV.registerUpdateHook(advance);

  function getState() {
    return {
      turtleCount:turtles.length, minnowCount:minnows.length, turtleDives, turtleReturnTurns, minnowScatters, boundedEscapeCorrections,
      schoolCenter:{ x:schoolCenter.x, z:schoolCenter.z },
      turtles:turtles.map(t => ({ name:t.g.name, x:t.g.position.x, y:t.g.position.y, z:t.g.position.z, rotationY:t.g.rotation.y, state:t.state, dives:t.dives, paddleAngle:t.paddleAngle, headY:t.head.position.y })),
      minnows:minnows.map(m => ({ name:m.g.name, x:m.g.position.x, y:m.g.position.y, z:m.g.position.z, scatter:m.scatter, turnRate:m.turnRate, tailZ:m.tail.rotation.z }))
    };
  }

  window.ToonValleyBluebellMarshLife = Object.freeze({
    active:true, baskingTurtles:true, physicalDiveAndReturn:true, reactiveMinnowSchool:true, isolatedFromFishing:true, lowPopulationBudget:true,
    visibleTurtlePaddling:true, correctedReturnFacing:true, coordinatedMovingSchool:true, boundedMinnowEscape:true,
    advance, getState
  });
})();