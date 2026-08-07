(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV) return;
  const { THREE } = TV;

  // Interaction overlays intentionally release pointer lock. The core pause listener
  // used to interpret that as a pause even when a modal was already open, stacking
  // the pause menu over phones, shops, theater tickets, jobs, etc.
  const pauseScreen = document.getElementById('pause-screen');
  const keepModalAbovePause = () => {
    if (TV.state.modalOpen) pauseScreen?.classList.add('hidden');
  };
  document.addEventListener('pointerlockchange', keepModalAbovePause);
  TV.registerUpdateHook(keepModalAbovePause);

  // Move the original park pond away from the Maple Apartments. Older builds may
  // already have nudged it once, so accept either historical location.
  const pondCandidates = TV.scene.children.filter((obj) =>
    obj.isMesh && obj.geometry?.type === 'CircleGeometry' && obj.material === TV.materials.water
  );
  const oldPond = pondCandidates.find((obj) =>
    Math.hypot(obj.position.x + 76, obj.position.z - 45) < 6 ||
    Math.hypot(obj.position.x + 99, obj.position.z - 48) < 6
  );
  const POND = { x: -112, z: 52 };
  let pondMoved = false;
  if (oldPond) {
    oldPond.position.set(POND.x, TV.terrainHeight(POND.x, POND.z) + 0.09, POND.z);
    oldPond.scale.set(1.2, 0.78, 1);
    oldPond.updateMatrix?.();
    pondMoved = true;

    const shore = new THREE.Mesh(new THREE.RingGeometry(11.2, 14.7, 40), TV.mat(0xd0b46d));
    shore.rotation.x = -Math.PI / 2;
    shore.scale.set(1.2, 0.78, 1);
    shore.position.set(POND.x, oldPond.position.y - 0.025, POND.z);
    TV.scene.add(shore);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.05 + (i % 3) * 0.18, 5), TV.materials.green);
      reed.position.set(
        POND.x + Math.cos(a) * 13.2 * 1.2,
        oldPond.position.y + 0.52,
        POND.z + Math.sin(a) * 13.2 * 0.78
      );
      TV.scene.add(reed);
    }
  }

  // Complete the useful town-road graph. These are real rendered road segments and
  // are also appended to TV.roadSegments so collision/layout/runtime tests see the
  // same road network that the shuttle uses.
  const extraRoads = [
    [-64, 34, -100, 34, 7.4],   // west park connector
    [43, 63, 43, 76, 7.2],      // north homes connector
    [64, -38, 78, -38, 7.4],    // east branch continuation
    [78, -38, 78, -74, 7.4]     // Bluebell Lake approach road
  ];

  function addRoad(x1, z1, x2, z2, width) {
    const dx = x2 - x1, dz = z2 - z1;
    const length = Math.hypot(dx, dz) + 0.8;
    const mx = (x1 + x2) * 0.5, mz = (z1 + z2) * 0.5;
    const y = TV.terrainHeight(mx, mz) + 0.075;
    const angle = Math.atan2(dx, dz);
    const road = new THREE.Mesh(TV.unitBox, TV.materials.road);
    road.position.set(mx, y, mz);
    road.rotation.y = angle;
    road.scale.set(width, 0.16, length);
    TV.scene.add(road);
    TV.roadSegments.push({ x1, z1, x2, z2, width, addedBy: 'world-polish' });

    const stripeCount = Math.max(1, Math.floor(length / 7));
    for (let i = 0; i < stripeCount; i++) {
      const t = (i + 0.5) / stripeCount;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 2.7), TV.materials.roadLine);
      stripe.position.set(x1 + dx * t, y + 0.1, z1 + dz * t);
      stripe.rotation.y = angle;
      TV.scene.add(stripe);
    }
  }
  extraRoads.forEach((road) => addRoad(...road));

  window.ToonValleyWorldPolish = Object.freeze({
    pauseGuard: true,
    pondMoved,
    pond: { ...POND },
    roadsAdded: extraRoads.length,
    roads: extraRoads.map((r) => r.slice())
  });
  console.info('Toon Valley world polish ready', window.ToonValleyWorldPolish);
})();
