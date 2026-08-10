(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight) return;
  const { THREE } = TV;
  const root = new THREE.Group();
  root.name = 'ambient-pedestrian-life';
  TV.scene.add(root);

  const palette = [0xf07b68, 0x6b8ff5, 0x6bc58a, 0xb57be8, 0xf0b85f];
  const walkers = [];
  let elapsed = 0;

  function makePerson(name, color, scale = 1) {
    const g = new THREE.Group();
    g.name = name;
    const body = new THREE.Mesh(new THREE.BoxGeometry(.46, .72, .28), new THREE.MeshToonMaterial({ color }));
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshToonMaterial({ color: 0xf2c39d }));
    head.position.y = 1.62;
    g.add(head);
    for (const x of [-.13, .13]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .55, .14), new THREE.MeshToonMaterial({ color: 0x34383f }));
      leg.position.set(x, .42, 0);
      g.add(leg);
    }
    g.scale.setScalar(scale);
    root.add(g);
    return g;
  }

  const squareRoutes = [
    [{ x: 1.5, z: -10.5 }, { x: 1.5, z: -3.5 }, { x: 10.5, z: -3.5 }, { x: 10.5, z: -10.5 }],
    [{ x: 3.5, z: -12 }, { x: 9, z: -12 }, { x: 12, z: -7 }, { x: 7, z: -2.5 }, { x: 2.5, z: -6 }],
    [{ x: 0, z: -7 }, { x: 4, z: -1.5 }, { x: 11.5, z: -2 }, { x: 12.5, z: -8.5 }, { x: 6, z: -12 }]
  ];
  const parkRoutes = [
    [{ x: -86, z: 47 }, { x: -76, z: 46 }, { x: -70, z: 52 }, { x: -75, z: 58 }, { x: -84, z: 57 }, { x: -88, z: 52 }],
    [{ x: -82, z: 44 }, { x: -72, z: 48 }, { x: -71, z: 56 }, { x: -79, z: 60 }, { x: -88, z: 55 }, { x: -89, z: 49 }]
  ];

  function addWalker(kind, route, index) {
    const runner = kind === 'park-jogger';
    const g = makePerson(`${kind}-${index + 1}`, palette[(index + (runner ? 3 : 0)) % palette.length], runner ? .96 : 1);
    const start = route[index % route.length];
    g.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);
    const state = {
      kind,
      group: g,
      route,
      cursor: (index + 1) % route.length,
      speed: runner ? 2.35 + index * .12 : 1.3 + index * .08,
      pause: runner ? 0 : index * .55,
      completedSegments: 0,
      bob: index * 1.7
    };
    walkers.push(state);
    return state;
  }

  squareRoutes.forEach((route, i) => addWalker('square-errand', route, i));
  parkRoutes.forEach((route, i) => addWalker('park-jogger', route, i));

  function moveWalker(walker, dt) {
    if (walker.pause > 0) {
      walker.pause = Math.max(0, walker.pause - dt);
      walker.group.position.y = TV.terrainHeight(walker.group.position.x, walker.group.position.z) + Math.sin(elapsed * 2 + walker.bob) * .012;
      return;
    }
    const target = walker.route[walker.cursor];
    const dx = target.x - walker.group.position.x;
    const dz = target.z - walker.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= .18) {
      walker.group.position.x = target.x;
      walker.group.position.z = target.z;
      walker.group.position.y = TV.terrainHeight(target.x, target.z);
      walker.cursor = (walker.cursor + 1) % walker.route.length;
      walker.completedSegments += 1;
      walker.pause = walker.kind === 'square-errand' ? 1.15 + (walker.completedSegments % 2) * .45 : .12;
      return;
    }
    const step = Math.min(distance, walker.speed * dt);
    walker.group.position.x += dx / distance * step;
    walker.group.position.z += dz / distance * step;
    walker.group.position.y = TV.terrainHeight(walker.group.position.x, walker.group.position.z);
    walker.group.rotation.y = Math.atan2(dx, dz);
    walker.group.position.y += Math.sin(elapsed * (walker.kind === 'park-jogger' ? 8 : 5) + walker.bob) * .02;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    walkers.forEach(walker => moveWalker(walker, safeDt));
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return walkers.map(walker => ({
      name: walker.group.name,
      kind: walker.kind,
      x: walker.group.position.x,
      z: walker.group.position.z,
      y: walker.group.position.y,
      cursor: walker.cursor,
      pause: walker.pause,
      completedSegments: walker.completedSegments,
      routePoints: walker.route.length
    }));
  }

  window.ToonValleyAmbientPedestrianLife = Object.freeze({
    active: true,
    townSquareErrands: true,
    sunshineParkJoggers: true,
    terrainFollowing: true,
    routePauses: true,
    walkerCount: walkers.length,
    squareWalkerCount: squareRoutes.length,
    parkJoggerCount: parkRoutes.length,
    getState,
    advance
  });
})();
