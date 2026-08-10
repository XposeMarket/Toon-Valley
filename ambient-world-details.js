(() => {
  'use strict';
  const TV = window.ToonValley;
  const A = window.ToonValleyAmbientPedestrianLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !A?.getState) return;
  const { THREE } = TV;
  const ambientRoot = TV.scene.getObjectByName('ambient-pedestrian-life');
  if (!ambientRoot) return;

  const detailRoot = new THREE.Group();
  detailRoot.name = 'ambient-world-details';
  TV.scene.add(detailRoot);
  let elapsed = 0;
  let yieldFacingFixes = 0;
  const priorYield = new Map();
  const rigs = new Map();

  function makeArm(group, name, x, color = 0xf2c39d) {
    const pivot = new THREE.Group();
    pivot.name = `${name}-pivot`;
    pivot.position.set(x, 1.28, 0);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(.12, .48, .12),
      new THREE.MeshToonMaterial({ color })
    );
    arm.name = name;
    arm.position.y = -.23;
    pivot.add(arm);
    group.add(pivot);
    return pivot;
  }

  function ensureRig(state) {
    if (rigs.has(state.name)) return rigs.get(state.name);
    const group = ambientRoot.getObjectByName(state.name);
    if (!group) return null;
    const body = group.getObjectByName('body');
    const bodyColor = body?.material?.color?.getHex?.() || 0x6b8ff5;
    const left = group.getObjectByName('left-arm-pivot') || makeArm(group, 'left-arm', -.31, bodyColor);
    const right = group.getObjectByName('right-arm-pivot') || makeArm(group, 'right-arm', .31, bodyColor);
    const rig = { group, left, right, pose: 'walking' };
    rigs.set(state.name, rig);
    return rig;
  }

  function makeParcelStation(name, x, z, color) {
    const group = new THREE.Group();
    group.name = name;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, .55, .8), new THREE.MeshToonMaterial({ color }));
    base.position.y = .28;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.28, .12, .92), new THREE.MeshToonMaterial({ color: 0xf2d9a2 }));
    shelf.position.y = .62;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), new THREE.MeshToonMaterial({ color: 0x9ce98c }));
    lamp.name = 'status-lamp';
    lamp.position.set(.45, .86, 0);
    group.add(base, shelf, lamp);
    group.position.set(x, TV.terrainHeight(x, z), z);
    detailRoot.add(group);
    return { group, lamp };
  }

  function makeHydrationStand(name, x, z) {
    const group = new THREE.Group();
    group.name = name;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(.62, 1.05, .46), new THREE.MeshToonMaterial({ color: 0x75c7e8 }));
    stand.position.y = .53;
    const top = new THREE.Mesh(new THREE.BoxGeometry(.72, .15, .56), new THREE.MeshToonMaterial({ color: 0xf1f7fb }));
    top.position.y = 1.1;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshToonMaterial({ color: 0x8ce6ff }));
    lamp.name = 'status-lamp';
    lamp.position.set(0, 1.32, 0);
    group.add(stand, top, lamp);
    group.position.set(x, TV.terrainHeight(x, z), z);
    detailRoot.add(group);
    return { group, lamp };
  }

  const pickupStation = makeParcelStation('town-square-parcel-pickup', 3.9, -1.05, 0xd7a462);
  const dropStation = makeParcelStation('town-square-parcel-dropoff', 11.2, -3.05, 0x8ab1ef);
  const hydrationStands = [
    makeHydrationStand('sunshine-park-hydration-west', -76.3, 45.4),
    makeHydrationStand('sunshine-park-hydration-east', -71.5, 55.7)
  ];

  function resetPose(rig) {
    rig.left.rotation.set(0, 0, 0);
    rig.right.rotation.set(0, 0, 0);
    rig.left.position.z = 0;
    rig.right.position.z = 0;
    rig.pose = 'walking';
  }

  function poseRig(state, rig) {
    resetPose(rig);
    if (state.activity === 'greeting') {
      rig.right.rotation.z = -.9 + Math.sin(elapsed * 7) * .32;
      rig.right.rotation.x = -.2;
      rig.pose = 'greeting';
    } else if (state.activity === 'socializing') {
      rig.left.rotation.z = .34 + Math.sin(elapsed * 4.2) * .14;
      rig.right.rotation.z = -.34 - Math.sin(elapsed * 3.8) * .14;
      rig.pose = 'socializing';
    } else if (state.kind === 'park-jogger' && state.activity === 'bench') {
      rig.right.rotation.z = -.7;
      rig.right.rotation.x = -.48;
      rig.left.rotation.z = .12;
      rig.pose = 'hydrating';
    } else if (state.kind === 'park-jogger') {
      rig.left.rotation.x = Math.sin(elapsed * 8.4) * .58;
      rig.right.rotation.x = -Math.sin(elapsed * 8.4) * .58;
      rig.pose = 'jogging';
    } else {
      rig.left.rotation.x = Math.sin(elapsed * 5.2) * .28;
      rig.right.rotation.x = -Math.sin(elapsed * 5.2) * .28;
    }
  }

  function fixYieldFacing(state, rig) {
    const yielding = state.playerYield > 0;
    if (yielding) {
      const player = TV.player?.position;
      if (player) {
        const bearing = Math.atan2(player.x - rig.group.position.x, player.z - rig.group.position.z);
        rig.group.rotation.y = bearing + Math.PI / 2;
      }
      if (!priorYield.get(state.name)) yieldFacingFixes += 1;
    }
    priorYield.set(state.name, yielding);
  }

  function updateWaypointProps(states) {
    const square = states.filter(state => state.kind === 'square-errand');
    const carrying = square.some(state => state.hasParcel);
    const delivering = square.some(state => state.activity === 'plaza-look' && state.hasParcel === false);
    pickupStation.lamp.scale.setScalar(carrying ? 1.32 : 1);
    pickupStation.lamp.position.y = .86 + Math.sin(elapsed * 3.4) * .035;
    dropStation.lamp.scale.setScalar(delivering ? 1.35 : 1);
    dropStation.lamp.position.y = .86 + Math.sin(elapsed * 3.1 + 1) * .035;
    const park = states.filter(state => state.kind === 'park-jogger');
    hydrationStands.forEach((stand, index) => {
      const active = park.some(state => state.activity === 'bench' && Math.abs(state.x - stand.group.position.x) < 9 && Math.abs(state.z - stand.group.position.z) < 9);
      stand.lamp.scale.setScalar(active ? 1.45 : 1);
      stand.lamp.position.y = 1.32 + Math.sin(elapsed * 3.8 + index) * .035;
    });
  }

  function advance(dt = 0) {
    elapsed += Math.max(0, Math.min(.25, Number(dt) || 0));
    const states = A.getState();
    states.forEach(state => {
      const rig = ensureRig(state);
      if (!rig) return;
      poseRig(state, rig);
      fixYieldFacing(state, rig);
    });
    updateWaypointProps(states);
  }

  TV.registerUpdateHook(advance);
  advance(0);

  function getState() {
    return {
      rigCount: rigs.size,
      armMeshCount: ambientRoot.getObjectsByProperty ? ambientRoot.getObjectsByProperty('name', 'left-arm').length + ambientRoot.getObjectsByProperty('name', 'right-arm').length : [...rigs.values()].length * 2,
      yieldFacingFixes,
      waypointCount: detailRoot.children.length,
      parcelStationCount: detailRoot.children.filter(child => child.name.includes('parcel-')).length,
      hydrationStandCount: detailRoot.children.filter(child => child.name.includes('hydration-')).length,
      poses: [...rigs.entries()].map(([name, rig]) => ({
        name,
        pose: rig.pose,
        leftX: rig.left.rotation.x,
        leftZ: rig.left.rotation.z,
        rightX: rig.right.rotation.x,
        rightZ: rig.right.rotation.z,
        rotationY: rig.group.rotation.y
      }))
    };
  }

  window.ToonValleyAmbientWorldDetails = Object.freeze({
    active: true,
    contextualArmGestures: true,
    correctedYieldFacing: true,
    livingParcelWaypoints: true,
    parkHydrationStations: true,
    getState,
    advance
  });
})();
