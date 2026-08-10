(() => {
  'use strict';
  const TV = window.ToonValley;
  const Community = window.ToonValleyCommunityLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !Community?.trailPath?.length) return;
  const { THREE } = TV;
  const path = Community.trailPath.map(([x, z]) => ({ x, z }));
  const root = new THREE.Group();
  root.name = 'mountain-trail-life';
  TV.scene.add(root);

  const skin = new THREE.MeshToonMaterial({ color: 0xf1bd92 });
  const dark = TV.materials?.dark || new THREE.MeshToonMaterial({ color: 0x313943 });
  const backpackMat = new THREE.MeshToonMaterial({ color: 0x7a5a3a });
  const bottleMat = new THREE.MeshToonMaterial({ color: 0x62b8d6 });
  const cameraMat = new THREE.MeshToonMaterial({ color: 0x29313a });
  const hikerColors = [0x5c8dd8, 0xcf6f5e];
  const hikers = [];
  let elapsed = 0;
  let totalYieldEvents = 0;
  let totalPassingEvents = 0;
  let totalLandmarkActivities = 0;

  function makeArm(group, x) {
    const arm = new THREE.Group();
    arm.position.set(x, 1.42, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.16, .58, .16), skin);
    mesh.position.y = -.28;
    arm.add(mesh);
    group.add(arm);
    return arm;
  }

  function makeHiker(index, startIndex, direction) {
    const group = new THREE.Group();
    group.name = `mountain-hiker-${index + 1}`;
    const bodyMat = new THREE.MeshToonMaterial({ color: hikerColors[index % hikerColors.length] });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.62, .9, .38), bodyMat); body.position.y = 1.05; body.name = 'body'; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 6), skin); head.position.y = 1.72; group.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, .18, 8), dark); hat.position.y = 1.97; group.add(hat);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(.5, .64, .24), backpackMat); pack.position.set(0, 1.1, -.31); pack.name = 'backpack'; group.add(pack);
    const leftArm = makeArm(group, -.41), rightArm = makeArm(group, .41);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .28, 7), bottleMat);
    bottle.position.set(.06, -.55, .04); bottle.visible = false; rightArm.add(bottle);
    const camera = new THREE.Mesh(new THREE.BoxGeometry(.28, .2, .16), cameraMat);
    camera.position.set(0, -.55, .16); camera.visible = false; rightArm.add(camera);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .08, 8), dark);
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, .12); camera.add(lens);
    const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
    leftLeg.position.set(-.18, .62, 0); rightLeg.position.set(.18, .62, 0);
    for (const leg of [leftLeg, rightLeg]) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.17, .65, .18), dark); mesh.position.y = -.32; leg.add(mesh); group.add(leg); }
    const p = path[startIndex];
    group.position.set(p.x, TV.terrainHeight(p.x, p.z), p.z);
    root.add(group);
    const state = {
      group, leftArm, rightArm, leftLeg, rightLeg, bottle, camera,
      index: startIndex, targetIndex: startIndex + direction, direction,
      pause: index ? .8 : .2, yielding: 0, yieldCooldown: 0, passing: 0, passingSide: index ? -1 : 1,
      distance: 0, landmarkPauses: 0, yieldEvents: 0, passingEvents: 0,
      activity: 'none', activityTime: 0, activityEvents: 0
    };
    hikers.push(state);
    return state;
  }

  makeHiker(0, 1, 1);
  makeHiker(1, path.length - 3, -1);

  function makeRanger() {
    const group = new THREE.Group();
    group.name = 'mountain-trail-ranger';
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(.72, 1, .42), new THREE.MeshToonMaterial({ color: 0x5c8758 })); shirt.position.y = 1.05; group.add(shirt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.29, 8, 6), skin); head.position.y = 1.78; group.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(.32, .38, .18, 8), new THREE.MeshToonMaterial({ color: 0x9b733f })); hat.position.y = 2.02; group.add(hat);
    const arm = new THREE.Group(); arm.position.set(.43, 1.42, 0); group.add(arm);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(.16, .58, .16), skin); armMesh.position.y = -.28; arm.add(armMesh);
    const clipboard = new THREE.Mesh(new THREE.BoxGeometry(.44, .54, .07), new THREE.MeshToonMaterial({ color: 0xe3c982 })); clipboard.position.set(-.48, 1.25, .3); clipboard.rotation.x = -.18; clipboard.visible = false; group.add(clipboard);
    const stamp = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .22, 7), new THREE.MeshToonMaterial({ color: 0xc94f55 })); stamp.position.set(.45, 1.12, .28); stamp.rotation.z = Math.PI / 2; stamp.visible = false; group.add(stamp);
    group.position.set(-107.1, TV.terrainHeight(-107.1, 46.2), 46.2);
    root.add(group);
    return { group, arm, clipboard, stamp, mode: 'idle', signoffGestures: 0, lastAwaiting: false, lastDone: false };
  }
  const ranger = makeRanger();

  function isLandmark(index) { return index === 4 || index === 8 || index === 11 || index === path.length - 1 || index === 0; }
  function face(group, dx, dz) { if (Math.abs(dx) + Math.abs(dz) > .001) group.rotation.y = Math.atan2(dx, dz); }

  function activityFor(index) {
    if (index === 8) return 'hydrate';
    if (index === 11) return 'photo';
    if (index === 4) return 'stretch';
    if (index === 0 || index === path.length - 1) return 'vista';
    return 'none';
  }

  function beginLandmarkActivity(hiker) {
    const activity = activityFor(hiker.index);
    if (activity === 'none') return;
    hiker.activity = activity;
    hiker.activityTime = activity === 'photo' ? 2.4 : 1.5;
    hiker.activityEvents += 1;
    totalLandmarkActivities += 1;
  }

  function clearActivityPose(hiker) {
    hiker.bottle.visible = false;
    hiker.camera.visible = false;
    hiker.leftArm.rotation.x *= .72;
    hiker.rightArm.rotation.x *= .72;
    hiker.leftArm.rotation.z *= .72;
    hiker.rightArm.rotation.z *= .72;
  }

  function updateLandmarkActivity(hiker, dt) {
    if (hiker.activityTime <= 0) {
      hiker.activity = 'none';
      clearActivityPose(hiker);
      return false;
    }
    hiker.activityTime = Math.max(0, hiker.activityTime - dt);
    hiker.leftLeg.rotation.x *= .75;
    hiker.rightLeg.rotation.x *= .75;
    if (hiker.activity === 'hydrate') {
      hiker.bottle.visible = true;
      hiker.rightArm.rotation.x = -1.45;
      hiker.rightArm.rotation.z = -.18;
    } else if (hiker.activity === 'photo') {
      hiker.camera.visible = true;
      hiker.leftArm.rotation.x = -1.28;
      hiker.rightArm.rotation.x = -1.28;
      hiker.leftArm.rotation.z = .24;
      hiker.rightArm.rotation.z = -.24;
      const target = path[Math.min(path.length - 1, hiker.index + hiker.direction)];
      face(hiker.group, target.x - hiker.group.position.x, target.z - hiker.group.position.z);
    } else if (hiker.activity === 'stretch') {
      hiker.leftArm.rotation.z = 1.15;
      hiker.rightArm.rotation.z = -1.15;
      hiker.leftArm.rotation.x = Math.sin(elapsed * 2.4) * .16;
      hiker.rightArm.rotation.x = -hiker.leftArm.rotation.x;
    } else if (hiker.activity === 'vista') {
      hiker.leftArm.rotation.z = .28;
      hiker.rightArm.rotation.z = -.28;
      hiker.leftArm.rotation.x = -.24;
      hiker.rightArm.rotation.x = -.24;
    }
    return true;
  }

  function advanceHiker(hiker, dt) {
    hiker.yieldCooldown = Math.max(0, hiker.yieldCooldown - dt);
    const player = TV.player?.position;
    const dxp = player ? player.x - hiker.group.position.x : 999;
    const dzp = player ? player.z - hiker.group.position.z : 999;
    const playerDistance = Math.hypot(dxp, dzp);

    if (hiker.passing > 0) {
      hiker.passing = Math.max(0, hiker.passing - dt);
      const target = path[hiker.targetIndex];
      const tx = target.x - hiker.group.position.x, tz = target.z - hiker.group.position.z;
      const tdist = Math.max(.001, Math.hypot(tx, tz));
      const nx = tx / tdist, nz = tz / tdist;
      const lateralX = nz * hiker.passingSide, lateralZ = -nx * hiker.passingSide;
      const speed = 2.35;
      hiker.group.position.x += (nx * .72 + lateralX * .68) * speed * dt;
      hiker.group.position.z += (nz * .72 + lateralZ * .68) * speed * dt;
      hiker.distance += speed * dt * .72;
      face(hiker.group, nx, nz);
      const stride = Math.sin(elapsed * 8.8 + hiker.index) * .5;
      hiker.leftLeg.rotation.x = stride; hiker.rightLeg.rotation.x = -stride;
      hiker.group.position.y = TV.terrainHeight(hiker.group.position.x, hiker.group.position.z);
      clearActivityPose(hiker);
      return;
    }

    hiker.yielding = Math.max(0, hiker.yielding - dt);
    if (playerDistance < 2.45 && hiker.yielding <= 0 && hiker.yieldCooldown <= 0) {
      hiker.yielding = .82;
      hiker.yieldCooldown = 3.2;
      hiker.yieldEvents += 1;
      totalYieldEvents += 1;
    }
    if (hiker.yielding > 0) {
      face(hiker.group, dxp, dzp);
      hiker.leftLeg.rotation.x *= .72;
      hiker.rightLeg.rotation.x *= .72;
      clearActivityPose(hiker);
      return;
    }
    if (playerDistance < 2.15 && hiker.yieldCooldown > 0 && hiker.yieldCooldown < 2.38) {
      hiker.passing = 1.15;
      hiker.passingEvents += 1;
      totalPassingEvents += 1;
      hiker.passingSide *= -1;
      clearActivityPose(hiker);
      return;
    }

    if (updateLandmarkActivity(hiker, dt)) return;
    if (hiker.pause > 0) {
      hiker.pause = Math.max(0, hiker.pause - dt);
      hiker.leftLeg.rotation.x *= .75;
      hiker.rightLeg.rotation.x *= .75;
      clearActivityPose(hiker);
      return;
    }
    const target = path[hiker.targetIndex];
    const dx = target.x - hiker.group.position.x, dz = target.z - hiker.group.position.z;
    const dist = Math.hypot(dx, dz);
    const speed = 3.05;
    if (dist <= Math.max(.12, speed * dt)) {
      hiker.group.position.x = target.x; hiker.group.position.z = target.z;
      hiker.index = hiker.targetIndex;
      if (isLandmark(hiker.index)) {
        hiker.pause = hiker.index === 11 ? .35 : .25;
        hiker.landmarkPauses += 1;
        beginLandmarkActivity(hiker);
      }
      if (hiker.index === 0 || hiker.index === path.length - 1) hiker.direction *= -1;
      hiker.targetIndex = Math.max(0, Math.min(path.length - 1, hiker.index + hiker.direction));
    } else {
      const step = Math.min(dist, speed * dt), nx = dx / dist, nz = dz / dist;
      hiker.group.position.x += nx * step; hiker.group.position.z += nz * step; hiker.distance += step;
      face(hiker.group, nx, nz);
      const stride = Math.sin(elapsed * 8 + hiker.index) * .55;
      hiker.leftLeg.rotation.x = stride; hiker.rightLeg.rotation.x = -stride;
      hiker.leftArm.rotation.x = -stride * .45; hiker.rightArm.rotation.x = stride * .45;
    }
    hiker.group.position.y = TV.terrainHeight(hiker.group.position.x, hiker.group.position.z);
  }

  function updateRanger(dt) {
    const state = Community.getState();
    const player = TV.player?.position;
    const dx = player ? player.x - ranger.group.position.x : 999;
    const dz = player ? player.z - ranger.group.position.z : 999;
    const close = Math.hypot(dx, dz) < 8;
    if (close) face(ranger.group, dx, dz);
    ranger.clipboard.visible = Boolean(state.trailStarted || state.trailAwaitingSignoff);
    ranger.stamp.visible = Boolean(state.trailAwaitingSignoff);
    if (state.trailAwaitingSignoff) {
      ranger.mode = 'signoff-ready';
      ranger.arm.rotation.z = -.7 + Math.sin(elapsed * 6.5) * .16;
      ranger.stamp.position.y = 1.12 + Math.sin(elapsed * 6.5) * .08;
      if (!ranger.lastAwaiting) ranger.signoffGestures += 1;
    } else if (state.trailDone) {
      ranger.mode = 'complete';
      ranger.arm.rotation.z = close ? -.95 + Math.sin(elapsed * 5) * .25 : -.25;
    } else if (state.trailStarted) {
      ranger.mode = 'card-active';
      ranger.arm.rotation.z = close ? -.48 : -.16;
    } else if (close) {
      ranger.mode = 'welcoming';
      ranger.arm.rotation.z = -.92 + Math.sin(elapsed * 5.3) * .28;
    } else {
      ranger.mode = 'idle';
      ranger.arm.rotation.z += (0 - ranger.arm.rotation.z) * Math.min(1, dt * 7);
    }
    ranger.lastAwaiting = Boolean(state.trailAwaitingSignoff);
    ranger.lastDone = Boolean(state.trailDone);
  }

  function advance(dt = 0) {
    const step = Math.max(0, Math.min(.12, Number(dt) || 0));
    elapsed += step;
    hikers.forEach(hiker => advanceHiker(hiker, step));
    updateRanger(step);
  }
  TV.registerUpdateHook(advance);
  advance(0);

  function getState() {
    return {
      hikerCount: hikers.length,
      totalYieldEvents,
      totalPassingEvents,
      totalLandmarkActivities,
      hikers: hikers.map(h => ({
        name: h.group.name, x: h.group.position.x, y: h.group.position.y, z: h.group.position.z,
        index: h.index, targetIndex: h.targetIndex, direction: h.direction, pause: h.pause, yielding: h.yielding,
        yieldCooldown: h.yieldCooldown, passing: h.passing, distance: h.distance, landmarkPauses: h.landmarkPauses,
        yieldEvents: h.yieldEvents, passingEvents: h.passingEvents, activity: h.activity, activityTime: h.activityTime,
        activityEvents: h.activityEvents, bottleVisible: h.bottle.visible, cameraVisible: h.camera.visible,
        terrainError: Math.abs(h.group.position.y - TV.terrainHeight(h.group.position.x, h.group.position.z))
      })),
      ranger: { mode: ranger.mode, clipboardVisible: ranger.clipboard.visible, stampVisible: ranger.stamp.visible, signoffGestures: ranger.signoffGestures },
      pathPoints: path.length
    };
  }

  window.ToonValleyMountainTrailLife = Object.freeze({
    active: true,
    canonicalOwner: 'ToonValleyCommunityLife',
    boundedHikerPopulation: hikers.length,
    responsiveRanger: true,
    terrainFollowing: true,
    playerAwarePassing: true,
    landmarkActivities: true,
    getState,
    advance
  });
})();
