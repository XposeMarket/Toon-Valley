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

  function addShoppingBag(group, color) {
    const bag = new THREE.Group();
    bag.name = 'shopping-bag';
    const body = new THREE.Mesh(new THREE.BoxGeometry(.28, .34, .18), new THREE.MeshToonMaterial({ color }));
    body.position.y = .13;
    bag.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.11, .025, 5, 8, Math.PI), new THREE.MeshToonMaterial({ color: 0x6d4b2d }));
    handle.rotation.z = Math.PI;
    handle.position.y = .34;
    bag.add(handle);
    bag.position.set(.36, .7, .02);
    bag.visible = false;
    group.add(bag);
    return bag;
  }

  function addDog(group, color = 0xb7804e) {
    const dog = new THREE.Group();
    dog.name = 'companion-dog';
    const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .28, .26), new THREE.MeshToonMaterial({ color }));
    body.position.y = .34;
    dog.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.25, .24, .24), new THREE.MeshToonMaterial({ color }));
    head.position.set(0, .47, .28);
    dog.add(head);
    for (const x of [-.16, .16]) for (const z of [-.08, .08]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, .25, .08), new THREE.MeshToonMaterial({ color: 0x805b39 }));
      leg.position.set(x, .14, z);
      dog.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .3), new THREE.MeshToonMaterial({ color }));
    tail.position.set(0, .43, -.27);
    tail.rotation.x = -.45;
    dog.add(tail);
    dog.position.set(-.7, 0, -.35);
    group.add(dog);
    return dog;
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
  const dogRoute = [{ x: -84, z: 45, activity: 'sniff' }, { x: -77, z: 44, activity: 'sniff' }, { x: -71, z: 50, activity: 'viewpoint' }, { x: -74, z: 57, activity: 'sniff' }, { x: -82, z: 59, activity: 'viewpoint' }, { x: -88, z: 53, activity: 'sniff' }];

  const activityDurations = Object.freeze({
    crosswalk: 1.2, storefront: 2.25, 'plaza-look': 1.6,
    stretch: 1.05, bench: 1.8, viewpoint: 1.35, sniff: 1.5
  });

  function addWalker(kind, route, index) {
    const runner = kind === 'park-jogger';
    const dogWalker = kind === 'park-dog-walker';
    const g = makePerson(`${kind}-${index + 1}`, palette[(index + (runner ? 3 : dogWalker ? 1 : 0)) % palette.length], runner ? .96 : 1);
    const start = route[index % route.length];
    g.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);
    const bag = kind === 'square-errand' ? addShoppingBag(g, palette[(index + 2) % palette.length]) : null;
    const dog = dogWalker ? addDog(g, index % 2 ? 0xd09a65 : 0x9a6b45) : null;
    const state = {
      kind, group: g, route, cursor: (index + 1) % route.length,
      speed: runner ? 2.35 + index * .12 : dogWalker ? 1.15 : 1.3 + index * .08,
      pause: runner ? 0 : index * .55, activity: null, activityCount: 0,
      completedSegments: 0, bob: index * 1.7, playerYield: 0, yieldCooldown: 0, yieldCount: 0,
      socialPause: 0, socialCooldown: 0, socialCount: 0, socialPartner: null,
      bag, carryingBag: false, completedErrands: 0, dog, sniffCount: 0
    };
    walkers.push(state);
    return state;
  }

  squareRoutes.forEach((route, i) => addWalker('square-errand', route, i));
  parkRoutes.forEach((route, i) => addWalker('park-jogger', route, i));
  addWalker('park-dog-walker', dogRoute, 0);

  function activityDuration(activity, walker) {
    const base = activityDurations[activity] || (walker.kind === 'square-errand' ? 1.15 : .18);
    return base + (walker.activityCount % 2) * .2;
  }

  function onActivityReached(walker, activity) {
    if (walker.kind === 'square-errand' && activity === 'storefront') {
      walker.carryingBag = true;
      if (walker.bag) walker.bag.visible = true;
    } else if (walker.kind === 'square-errand' && activity === 'plaza-look' && walker.carryingBag) {
      walker.carryingBag = false;
      walker.completedErrands += 1;
      if (walker.bag) walker.bag.visible = false;
    }
    if (walker.kind === 'park-dog-walker' && activity === 'sniff') walker.sniffCount += 1;
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
    } else if (activity === 'sniff' && walker.dog) {
      walker.dog.rotation.x = .14 + Math.sin(elapsed * 2.8) * .04;
    }
  }

  function shouldYieldToPlayer(walker) {
    const player = TV.player?.position;
    if (!player || walker.yieldCooldown > 0 || walker.pause > 0 || walker.playerYield > 0 || walker.socialPause > 0) return false;
    const dx = player.x - walker.group.position.x;
    const dz = player.z - walker.group.position.z;
    return dx * dx + dz * dz < 1.55 * 1.55;
  }

  function trySocialEncounters() {
    for (let i = 0; i < walkers.length; i += 1) {
      const a = walkers[i];
      if (a.socialCooldown > 0 || a.pause > 0 || a.playerYield > 0 || a.socialPause > 0) continue;
      for (let j = i + 1; j < walkers.length; j += 1) {
        const b = walkers[j];
        if (a.kind !== b.kind || b.socialCooldown > 0 || b.pause > 0 || b.playerYield > 0 || b.socialPause > 0) continue;
        const distance = Math.hypot(a.group.position.x - b.group.position.x, a.group.position.z - b.group.position.z);
        if (distance > 1.15) continue;
        a.socialPause = b.socialPause = 1.15;
        a.socialCooldown = b.socialCooldown = 7;
        a.socialPartner = b.group.name;
        b.socialPartner = a.group.name;
        a.socialCount += 1;
        b.socialCount += 1;
        return;
      }
    }
  }

  function moveWalker(walker, dt) {
    walker.yieldCooldown = Math.max(0, walker.yieldCooldown - dt);
    walker.socialCooldown = Math.max(0, walker.socialCooldown - dt);
    if (shouldYieldToPlayer(walker)) {
      walker.playerYield = .72;
      walker.yieldCooldown = 1.45;
      walker.yieldCount += 1;
    }
    if (walker.socialPause > 0) {
      walker.socialPause = Math.max(0, walker.socialPause - dt);
      const partner = walkers.find(other => other.group.name === walker.socialPartner);
      if (partner) walker.group.rotation.y = Math.atan2(partner.group.position.x - walker.group.position.x, partner.group.position.z - walker.group.position.z);
      walker.group.position.y = TV.terrainHeight(walker.group.position.x, walker.group.position.z) + Math.sin(elapsed * 2 + walker.bob) * .01;
      if (walker.socialPause === 0) walker.socialPartner = null;
      return;
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
      onActivityReached(walker, walker.activity);
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
    trySocialEncounters();
    walkers.forEach(walker => moveWalker(walker, safeDt));
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return walkers.map(walker => ({
      name: walker.group.name, kind: walker.kind,
      x: walker.group.position.x, z: walker.group.position.z, y: walker.group.position.y,
      cursor: walker.cursor, pause: walker.pause, activity: walker.activity, activityCount: walker.activityCount,
      playerYield: walker.playerYield, yieldCount: walker.yieldCount,
      socialPause: walker.socialPause, socialCount: walker.socialCount, socialPartner: walker.socialPartner,
      completedSegments: walker.completedSegments, routePoints: walker.route.length,
      destinationActivities: walker.route.filter(point => point.activity).length,
      carryingBag: walker.carryingBag, completedErrands: walker.completedErrands,
      hasDog: Boolean(walker.dog), sniffCount: walker.sniffCount
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
    socialEncounters: true,
    visibleShoppingErrands: true,
    parkDogWalking: true,
    walkerCount: walkers.length,
    squareWalkerCount: squareRoutes.length,
    parkJoggerCount: parkRoutes.length,
    parkDogWalkerCount: 1,
    getState,
    advance
  });
})();
