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
    body.name = 'body';
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshToonMaterial({ color: 0xf2c39d }));
    head.name = 'head';
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
    [{ x: 1.5, z: -10.5, activity: 'crosswalk' }, { x: 1.5, z: -3.5, activity: 'storefront' }, { x: 10.5, z: -3.5, activity: 'crosswalk' }, { x: 10.5, z: -10.5, activity: 'plaza-look' }],
    [{ x: 3.5, z: -12, activity: 'storefront' }, { x: 9, z: -12, activity: 'crosswalk' }, { x: 12, z: -7, activity: 'plaza-look' }, { x: 7, z: -2.5, activity: 'storefront' }, { x: 2.5, z: -6, activity: 'crosswalk' }],
    [{ x: 0, z: -7, activity: 'crosswalk' }, { x: 4, z: -1.5, activity: 'storefront' }, { x: 11.5, z: -2, activity: 'plaza-look' }, { x: 12.5, z: -8.5, activity: 'crosswalk' }, { x: 6, z: -12, activity: 'storefront' }]
  ];
  const parkRoutes = [
    [{ x: -86, z: 47, activity: 'stretch' }, { x: -76, z: 46, activity: 'bench' }, { x: -70, z: 52, activity: 'viewpoint' }, { x: -75, z: 58, activity: 'stretch' }, { x: -84, z: 57, activity: 'bench' }, { x: -88, z: 52, activity: 'viewpoint' }],
    [{ x: -82, z: 44, activity: 'viewpoint' }, { x: -72, z: 48, activity: 'stretch' }, { x: -71, z: 56, activity: 'bench' }, { x: -79, z: 60, activity: 'viewpoint' }, { x: -88, z: 55, activity: 'stretch' }, { x: -89, z: 49, activity: 'bench' }]
  ];

  const activityDurations = Object.freeze({
    crosswalk: 1.2,
    storefront: 2.25,
    'plaza-look': 1.6,
    stretch: 1.05,
    bench: 1.8,
    viewpoint: 1.35
  });

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
      activity: null,
      activityCount: 0,
      completedSegments: 0,
      bob: index * 1.7,
      playerYield: 0,
      yieldCooldown: 0,
      yieldCount: 0
    };
    walkers.push(state);
    return state;
  }

  squareRoutes.forEach((route, i) => addWalker('square-errand', route, i));
  parkRoutes.forEach((route, i) => addWalker('park-jogger', route, i));

  function activityDuration(activity, walker) {
    const base = activityDurations[activity] || (walker.kind === 'square-errand' ? 1.15 : .18);
    return base + (walker.activityCount % 2) * .2;
  }

  function applyIdlePose(walker) {
    const { group, activity } = walker;
    const head = group.getObjectByName('head');
    const body = group.getObjectByName('body');
    if (head) head.rotation.y = 0;
    if (body) body.rotation.z = 0;
    if (activity === 'crosswalk') {
      group.rotation.y += Math.sin(elapsed * 2.4 + walker.bob) * .018;
      if (head) head.rotation.y = Math.sin(elapsed * 3.1 + walker.bob) * .42;
    } else if (activity === 'storefront' || activity === 'viewpoint' || activity === 'plaza-look') {
      if (head) head.rotation.y = Math.sin(elapsed * 1.5 + walker.bob) * .22;
    } else if (activity === 'stretch') {
      if (body) body.rotation.z = Math.sin(elapsed * 3.6 + walker.bob) * .08;
    } else if (activity === 'bench') {
      group.position.y -= .08;
    }
  }

  function shouldYieldToPlayer(walker) {
    const player = TV.player?.position;
    if (!player || walker.yieldCooldown > 0 || walker.pause > 0 || walker.playerYield > 0) return false;
    const dx = player.x - walker.group.position.x;
    const dz = player.z - walker.group.position.z;
    return dx * dx + dz * dz < 1.55 * 1.55;
  }

  function moveWalker(walker, dt) {
    walker.yieldCooldown = Math.max(0, walker.yieldCooldown - dt);
    if (shouldYieldToPlayer(walker)) {
      walker.playerYield = .72;
      walker.yieldCooldown = 1.45;
      walker.yieldCount += 1;
    }
    if (walker.playerYield > 0) {
      walker.playerYield = Math.max(0, walker.playerYield - dt);
      walker.group.position.y = TV.terrainHeight(walker.group.position.x, walker.group.position.z) + Math.sin(elapsed * 2 + walker.bob) * .01;
      const player = TV.player?.position;
      if (player) walker.group.rotation.y = Math.atan2(player.x - walker.group.position.x, player.z - walker.group.position.z) + Math.PI;
      return;
    }
    if (walker.pause > 0) {
      walker.pause = Math.max(0, walker.pause - dt);
      walker.group.position.y = TV.terrainHeight(walker.group.position.x, walker.group.position.z) + Math.sin(elapsed * 2 + walker.bob) * .012;
      applyIdlePose(walker);
      if (walker.pause === 0) walker.activity = null;
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
      walker.activity = target.activity || null;
      walker.activityCount += walker.activity ? 1 : 0;
      walker.cursor = (walker.cursor + 1) % walker.route.length;
      walker.completedSegments += 1;
      walker.pause = activityDuration(walker.activity, walker);
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
      activity: walker.activity,
      activityCount: walker.activityCount,
      playerYield: walker.playerYield,
      yieldCount: walker.yieldCount,
      completedSegments: walker.completedSegments,
      routePoints: walker.route.length,
      destinationActivities: walker.route.filter(point => point.activity).length
    }));
  }

  window.ToonValleyAmbientPedestrianLife = Object.freeze({
    active: true,
    townSquareErrands: true,
    sunshineParkJoggers: true,
    terrainFollowing: true,
    routePauses: true,
    contextualDestinationActivities: true,
    playerAwareYielding: true,
    walkerCount: walkers.length,
    squareWalkerCount: squareRoutes.length,
    parkJoggerCount: parkRoutes.length,
    getState,
    advance
  });
})();
