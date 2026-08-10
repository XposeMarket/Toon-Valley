(() => {
  'use strict';
  const TV = window.ToonValley;
  const Ambient = window.ToonValleyAmbientPedestrianLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !Ambient?.getState) return;
  const { THREE } = TV;

  const root = new THREE.Group();
  root.name = 'ambient-pedestrian-polish';
  TV.scene.add(root);

  const coolerMat = new THREE.MeshToonMaterial({ color: 0x82c8e8 });
  const coolerLight = new THREE.MeshToonMaterial({ color: 0xe8f7fb });
  const dark = new THREE.MeshToonMaterial({ color: 0x39434d });
  const wood = new THREE.MeshToonMaterial({ color: 0x9f6e45 });
  const woodLight = new THREE.MeshToonMaterial({ color: 0xc99562 });
  const railMat = new THREE.MeshToonMaterial({ color: 0x6f8377 });
  const phoneMat = new THREE.MeshToonMaterial({ color: 0x26313d });
  const phoneScreenMat = new THREE.MeshBasicMaterial({ color: 0x9de8ff });
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x7bd7ff, transparent: true, opacity: 0.75 });
  const matColors = [0xe99a72, 0x78b9d8, 0x83c792, 0xd39acf];
  const stretchMats = matColors.map(color => new THREE.MeshToonMaterial({ color }));

  const hydrationPoints = [
    { x: -76, z: 46 },
    { x: -84, z: 57 },
    { x: -71, z: 56 },
    { x: -89, z: 49 }
  ];
  const stretchPoints = [
    { x: -86, z: 47 },
    { x: -75, z: 58 },
    { x: -72, z: 48 },
    { x: -88, z: 55 }
  ];
  const benchPoints = [
    { x: -76, z: 46, yaw: 1.25 },
    { x: -84, z: 57, yaw: -1.1 },
    { x: -71, z: 56, yaw: 2.35 },
    { x: -89, z: 49, yaw: .55 }
  ];
  const viewpointPoints = [
    { x: -70, z: 52, yaw: -1.55 },
    { x: -88, z: 52, yaw: 1.52 },
    { x: -82, z: 44, yaw: .05 },
    { x: -79, z: 60, yaw: 3.05 }
  ];

  function makeHydrationStation(point, index) {
    const g = new THREE.Group();
    g.name = `sunshine-hydration-station-${index + 1}`;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.36, .42, .12, 10), dark);
    base.position.y = .06;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, 1.05, 10), coolerMat);
    tank.position.y = .62;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .08, 10), coolerLight);
    cap.position.y = 1.18;
    const spout = new THREE.Mesh(new THREE.BoxGeometry(.22, .1, .24), dark);
    spout.position.set(0, .85, -.29);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(.018, .024, .36, 6), waterMat);
    stream.name = 'water-stream';
    stream.position.set(0, .62, -.36);
    stream.visible = false;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(.72, .34, .06), coolerLight);
    sign.position.set(0, 1.55, .02);
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .7, 6), dark);
    signPost.position.y = 1.28;
    g.add(base, tank, cap, spout, stream, sign, signPost);
    g.position.set(point.x + .7, TV.terrainHeight(point.x + .7, point.z + .2), point.z + .2);
    root.add(g);
    return { ...point, group: g, stream, refills: 0, active: false };
  }

  function makeStretchStation(point, index) {
    const g = new THREE.Group();
    g.name = `sunshine-stretch-station-${index + 1}`;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(1.35, .035, .72), stretchMats[index % stretchMats.length]);
    mat.position.y = .025;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, 1.15, 7), dark);
    post.position.set(-.72, .58, .24);
    const placard = new THREE.Mesh(new THREE.BoxGeometry(.54, .36, .07), coolerLight);
    placard.position.set(-.72, 1.1, .24);
    g.add(mat, post, placard);
    g.position.set(point.x, TV.terrainHeight(point.x, point.z), point.z);
    root.add(g);
    return { ...point, group: g, sessions: 0, active: false };
  }

  function makeBenchStation(point, index) {
    const g = new THREE.Group();
    g.name = `sunshine-rest-bench-${index + 1}`;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.65, .14, .46), woodLight);
    seat.position.y = .52;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.65, .58, .12), wood);
    back.position.set(0, .82, .2);
    for (const x of [-.62, .62]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.13, .55, .13), dark);
      leg.position.set(x, .26, 0);
      g.add(leg);
    }
    g.add(seat, back);
    const offsetX = Math.sin(point.yaw) * -1.15;
    const offsetZ = Math.cos(point.yaw) * -1.15;
    const x = point.x + offsetX;
    const z = point.z + offsetZ;
    g.position.set(x, TV.terrainHeight(x, z), z);
    g.rotation.y = point.yaw;
    root.add(g);
    return { ...point, group: g, sessions: 0, active: false, seatX: x, seatZ: z };
  }

  function makeViewpointStation(point, index) {
    const g = new THREE.Group();
    g.name = `sunshine-viewpoint-${index + 1}`;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, .1, .12), railMat);
    rail.position.set(0, .82, -.46);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.35, .11, .16), woodLight);
    top.position.set(0, 1.12, -.46);
    for (const x of [-1.02, 0, 1.02]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.05, .1), railMat);
      post.position.set(x, .55, -.46);
      g.add(post);
    }
    const signPost = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.1, .08), dark);
    signPost.position.set(-1.35, .56, .15);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(.72, .42, .08), coolerLight);
    sign.position.set(-1.35, 1.08, .15);
    g.add(rail, top, signPost, sign);
    const offsetX = Math.sin(point.yaw) * -.7;
    const offsetZ = Math.cos(point.yaw) * -.7;
    const x = point.x + offsetX;
    const z = point.z + offsetZ;
    g.position.set(x, TV.terrainHeight(x, z), z);
    g.rotation.y = point.yaw;
    root.add(g);
    return { ...point, group: g, sessions: 0, active: false };
  }

  function ensurePhotoPhone(group) {
    let phone = group.getObjectByName('jogger-view-phone');
    if (phone) return phone;
    phone = new THREE.Group();
    phone.name = 'jogger-view-phone';
    const shell = new THREE.Mesh(new THREE.BoxGeometry(.16, .28, .045), phoneMat);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(.13, .22, .012), phoneScreenMat);
    screen.position.z = .029;
    phone.add(shell, screen);
    phone.position.set(.34, 1.08, .12);
    phone.visible = false;
    group.add(phone);
    return phone;
  }

  const hydrationStations = hydrationPoints.map(makeHydrationStation);
  const stretchStations = stretchPoints.map(makeStretchStation);
  const benchStations = benchPoints.map(makeBenchStation);
  const viewpointStations = viewpointPoints.map(makeViewpointStation);
  const hydrationSessions = new Map();
  const lastHydrationCount = new Map();
  const lastActivity = new Map();
  const lastBenchActive = new Map();
  const lastViewpointActive = new Map();
  const lastYield = new Map();
  let yieldFacingCorrections = 0;
  let hydrationSequences = 0;
  let stretchSessions = 0;
  let stretchPoseResets = 0;
  let benchRestSessions = 0;
  let viewpointPhotoSessions = 0;
  let elapsed = 0;

  function nearest(list, x, z) {
    let best = list[0], bestDistance = Infinity;
    for (const item of list) {
      const distance = Math.hypot(item.x - x, item.z - z);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    return best;
  }

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

  function fixYieldFacing(state, group) {
    const yielding = state.playerYield > 0;
    if (yielding) {
      const player = TV.player?.position;
      if (player) group.rotation.y = Math.atan2(player.x - group.position.x, player.z - group.position.z);
      if (!lastYield.get(state.name)) yieldFacingCorrections += 1;
    }
    lastYield.set(state.name, yielding);
  }

  function beginHydration(state, group) {
    const previous = lastHydrationCount.get(state.name) ?? state.hydrationBreaks;
    if (state.hydrationBreaks <= previous) return;
    const station = nearest(hydrationStations, state.x, state.z);
    station.refills += 1;
    hydrationSequences += 1;
    hydrationSessions.set(state.name, { station, elapsed: 0, duration: 1.65 });
    lastHydrationCount.set(state.name, state.hydrationBreaks);
    group.userData.toonValleyHydrationStation = station.group.name;
  }

  function updateHydration(state, group, dt) {
    if (!lastHydrationCount.has(state.name)) lastHydrationCount.set(state.name, state.hydrationBreaks);
    beginHydration(state, group);
    const bottle = group.getObjectByName('jogger-water-bottle');
    const session = hydrationSessions.get(state.name);
    if (!bottle || !session) return;

    session.elapsed = Math.min(session.duration, session.elapsed + dt);
    const p = session.elapsed / session.duration;
    const station = session.station;
    const spoutX = station.group.position.x - group.position.x;
    const spoutY = station.group.position.y + .7 - group.position.y;
    const spoutZ = station.group.position.z - .34 - group.position.z;
    const carry = { x: .3, y: 1.05, z: .13 };
    const mouth = { x: .12, y: 1.52, z: .05 };

    station.active = p >= .2 && p < .44;
    station.stream.visible = station.active;
    if (p < .2) {
      const t = p / .2;
      bottle.position.set(lerp(carry.x, spoutX, t), lerp(carry.y, spoutY, t), lerp(carry.z, spoutZ, t));
      bottle.rotation.set(lerp(.05, 0, t), 0, lerp(-.18, 0, t));
    } else if (p < .44) {
      bottle.position.set(spoutX, spoutY, spoutZ);
      bottle.rotation.set(0, 0, 0);
    } else if (p < .72) {
      const t = (p - .44) / .28;
      bottle.position.set(lerp(spoutX, mouth.x, t), lerp(spoutY, mouth.y, t), lerp(spoutZ, mouth.z, t));
      bottle.rotation.set(lerp(0, -1.05, t), 0, lerp(0, -.28, t));
    } else {
      const t = (p - .72) / .28;
      bottle.position.set(lerp(mouth.x, carry.x, t), lerp(mouth.y, carry.y, t), lerp(mouth.z, carry.z, t));
      bottle.rotation.set(lerp(-1.05, .05, t), 0, lerp(-.28, -.18, t));
    }

    if (session.elapsed >= session.duration) {
      station.active = false;
      station.stream.visible = false;
      hydrationSessions.delete(state.name);
      bottle.position.set(carry.x, carry.y, carry.z);
      bottle.rotation.set(.05, 0, -.18);
    }
  }

  function updateStretch(state, group) {
    const was = lastActivity.get(state.name);
    const active = state.kind === 'park-jogger' && state.activity === 'stretch' && state.pause > 0;
    const body = group.getObjectByName('body');
    const head = group.getObjectByName('head');
    if (active && was !== 'stretch') {
      const station = nearest(stretchStations, state.x, state.z);
      station.sessions += 1;
      stretchSessions += 1;
      group.userData.toonValleyStretchStation = station.group.name;
    }
    if (active) {
      const station = nearest(stretchStations, state.x, state.z);
      station.active = true;
      if (body) body.rotation.z = Math.sin(elapsed * 3.4 + state.completedSegments) * .22;
      if (head) head.rotation.y = Math.sin(elapsed * 2.2 + state.completedSegments) * .28;
      const dx = station.group.position.x - group.position.x;
      const dz = station.group.position.z - group.position.z;
      if (Math.hypot(dx, dz) > .05) group.rotation.y = Math.atan2(dx, dz);
    } else if (was === 'stretch') {
      if (body) body.rotation.z = 0;
      if (head) head.rotation.y = 0;
      stretchPoseResets += 1;
    }
    lastActivity.set(state.name, active ? 'stretch' : state.activity || null);
  }

  function updateBenchRest(state, group) {
    const active = state.kind === 'park-jogger' && state.activity === 'bench' && state.pause > 0;
    const wasActive = lastBenchActive.get(state.name) === true;
    lastBenchActive.set(state.name, active);
    group.userData.toonValleyBenchSeated = false;
    if (!active) return;
    const station = nearest(benchStations, state.x, state.z);
    if (!wasActive) {
      station.sessions += 1;
      benchRestSessions += 1;
    }
    station.active = true;
    group.userData.toonValleyRestBench = station.group.name;
    group.userData.toonValleyBenchSeated = true;
    const targetY = TV.terrainHeight(station.seatX, station.seatZ);
    group.position.x = lerp(group.position.x, station.seatX, .42);
    group.position.z = lerp(group.position.z, station.seatZ, .42);
    group.position.y = targetY + .02;
    group.rotation.y = station.yaw;
    const body = group.getObjectByName('body');
    if (body) body.rotation.x = -.12;
  }

  function updateViewpoint(state, group) {
    const phone = ensurePhotoPhone(group);
    const active = state.kind === 'park-jogger' && state.activity === 'viewpoint' && state.pause > 0;
    const wasActive = lastViewpointActive.get(state.name) === true;
    lastViewpointActive.set(state.name, active);
    if (!active) {
      phone.visible = false;
      phone.position.set(.34, 1.08, .12);
      phone.rotation.set(0, 0, 0);
      return;
    }
    const station = nearest(viewpointStations, state.x, state.z);
    if (!wasActive) {
      station.sessions += 1;
      viewpointPhotoSessions += 1;
    }
    station.active = true;
    group.userData.toonValleyViewpoint = station.group.name;
    group.rotation.y = station.yaw;
    phone.visible = true;
    const lift = .5 + .5 * Math.sin(Math.min(1, Math.max(0, state.pause)) * Math.PI);
    phone.position.set(.12, 1.18 + .32 * lift, .18);
    phone.rotation.set(-.22, 0, Math.sin(elapsed * 2.1 + state.completedSegments) * .06);
  }

  function resetParkBodyPose(state, group) {
    if (state.kind !== 'park-jogger' || state.activity === 'stretch' || state.activity === 'bench') return;
    const body = group.getObjectByName('body');
    if (body) body.rotation.x = 0;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    hydrationStations.forEach(station => { station.active = false; station.stream.visible = false; });
    stretchStations.forEach(station => { station.active = false; });
    benchStations.forEach(station => { station.active = false; });
    viewpointStations.forEach(station => { station.active = false; });
    const states = Ambient.getState();
    for (const state of states) {
      const group = TV.scene.getObjectByName(state.name);
      if (!group) continue;
      fixYieldFacing(state, group);
      if (state.kind === 'park-jogger') {
        updateHydration(state, group, safeDt);
        updateStretch(state, group);
        updateBenchRest(state, group);
        updateViewpoint(state, group);
        resetParkBodyPose(state, group);
      }
    }
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      hydrationStationCount: hydrationStations.length,
      stretchStationCount: stretchStations.length,
      benchStationCount: benchStations.length,
      viewpointStationCount: viewpointStations.length,
      hydrationSequences,
      stretchSessions,
      stretchPoseResets,
      benchRestSessions,
      viewpointPhotoSessions,
      yieldFacingCorrections,
      activeHydrationStations: hydrationStations.filter(station => station.active).length,
      activeStretchStations: stretchStations.filter(station => station.active).length,
      activeBenchStations: benchStations.filter(station => station.active).length,
      activeViewpointStations: viewpointStations.filter(station => station.active).length,
      stationRefills: hydrationStations.map(station => station.refills),
      stationStretchSessions: stretchStations.map(station => station.sessions),
      stationBenchSessions: benchStations.map(station => station.sessions),
      stationViewpointSessions: viewpointStations.map(station => station.sessions),
      finitePositions: [...hydrationStations, ...stretchStations, ...benchStations, ...viewpointStations].every(station => Number.isFinite(station.group.position.x) && Number.isFinite(station.group.position.y) && Number.isFinite(station.group.position.z))
    };
  }

  window.ToonValleyAmbientPedestrianPolish = Object.freeze({
    active: true,
    globalYieldFacingFix: true,
    physicalJoggerHydrationStations: true,
    physicalJoggerStretchStations: true,
    physicalJoggerRestBenches: true,
    physicalJoggerViewpoints: true,
    getState,
    advance
  });
})();