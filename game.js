(() => {
  'use strict';

  const loadError = document.getElementById('load-error');
  if (!window.THREE) {
    loadError.classList.remove('hidden');
    document.getElementById('play-button').disabled = true;
    return;
  }

  // ---------------------------------------------------------------------------
  // Device-aware defaults. The game intentionally favors stable frame pacing
  // over raw resolution so it stays comfortable on phones and 2019 Intel Macs.
  // ---------------------------------------------------------------------------
  const DEVICE = {
    touch: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
    memory: navigator.deviceMemory || 4,
    cores: navigator.hardwareConcurrency || 4,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  const CONFIG = {
    worldRadius: 235,
    mobile: {
      pixelRatio: 0.78,
      minPixelRatio: 0.55,
      far: 145,
      grass: 340,
      trees: 62,
      rocks: 28,
      npcs: 8,
      flowers: 44,
      lamps: 18,
      targetFPS: 30
    },
    low: {
      pixelRatio: 1.0,
      minPixelRatio: 0.68,
      far: 185,
      grass: 650,
      trees: 95,
      rocks: 48,
      npcs: 12,
      flowers: 86,
      lamps: 26,
      targetFPS: 45
    },
    medium: {
      pixelRatio: 1.25,
      minPixelRatio: 0.82,
      far: 245,
      grass: 1120,
      trees: 145,
      rocks: 76,
      npcs: 16,
      flowers: 140,
      lamps: 34,
      targetFPS: 60
    }
  };

  const state = {
    started: false,
    quality: DEVICE.touch || DEVICE.memory <= 4 || DEVICE.cores <= 4 ? 'mobile' : 'low',
    yaw: 0,
    pitch: 0.08,
    stamina: 1,
    jumpVelocity: 0,
    grounded: true,
    lastTime: performance.now(),
    lastRender: 0,
    fpsTime: 0,
    fpsFrames: 0,
    lowFpsSamples: 0,
    highFpsSamples: 0,
    pixelRatioScale: 1,
    toastTimer: 0,
    cameraReady: false,
    area: 'world',
    returnPoint: null,
    mobileMoveX: 0,
    mobileMoveY: 0,
    mobileSprint: false,
    sprintToggle: false,
    jumpQueued: false,
    mobileJumpQueued: false,
    nearestInteractable: null,
    pausedByVisibility: false,
    modalOpen: false,
    seated: false,
    seat: null
  };

  const keys = Object.create(null);
  const colliders = [];
  const interactables = [];
  const npcs = [];
  const staticMeshes = [];
  const temp = {
    v1: new THREE.Vector3(),
    v2: new THREE.Vector3(),
    v3: new THREE.Vector3(),
    obj: new THREE.Object3D(),
    color: new THREE.Color()
  };

  const areaBounds = {
    cityHall: { cx: 500, cz: 0, halfW: 10.2, halfD: 8.2 },
    generalStore: { cx: 535, cz: 0, halfW: 10.2, halfD: 8.2 },
    library: { cx: 570, cz: 0, halfW: 10.2, halfD: 8.2 },
    cafe: { cx: 605, cz: 0, halfW: 10.2, halfD: 8.2 },
    home: { cx: 640, cz: 0, halfW: 12.5, halfD: 9.5 },
    furnitureStore: { cx: 680, cz: 0, halfW: 12.0, halfD: 9.0 }
  };

  const AREA_NAMES = {
    world: 'TOON VALLEY',
    cityHall: 'CITY HALL',
    generalStore: 'SUNNY GENERAL STORE',
    library: 'STORYBOOK LIBRARY',
    cafe: 'CLOUD NINE CAFE',
    home: 'SUNBEAM STUDIO',
    furnitureStore: 'HAPPY HOME FURNISHINGS'
  };

  // ---------- Core renderer / scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x75cfff);
  scene.fog = new THREE.Fog(0x8fd8f5, 70, CONFIG[state.quality].far);

  // Interior geometry is grouped and fully removed from traversal while outdoors.
  const interiorGroups = {};
  for (const area of Object.keys(areaBounds)) {
    const group = new THREE.Group();
    group.name = `interior-${area}`;
    group.visible = false;
    interiorGroups[area] = group;
    scene.add(group);
  }

  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, CONFIG[state.quality].far + 30);
  camera.position.set(0, 7, 10);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
    precision: 'mediump',
    preserveDrawingBuffer: false
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Toon Valley game canvas');
  document.getElementById('game').appendChild(renderer.domElement);

  // Tiny nearest-neighbor lighting ramp = inexpensive cel shading.
  const rampData = new Uint8Array([35, 105, 190, 255]);
  const gradientMap = new THREE.DataTexture(rampData, 4, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;

  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x172027, side: THREE.BackSide });
  const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap });
  const materials = {
    grass: mat(0x7de85d),
    grassDark: mat(0x4fbe46),
    road: mat(0x6f7680),
    sidewalk: mat(0xbcc5c7),
    plaza: mat(0xd8c79d),
    roadLine: new THREE.MeshBasicMaterial({ color: 0xfff7d8 }),
    trunk: mat(0x8c5b32),
    leavesA: mat(0x57de48),
    leavesB: mat(0x79f255),
    rock: mat(0x819099),
    mountain: mat(0x70b569),
    snow: mat(0xeef8ef),
    dark: mat(0x223039),
    water: mat(0x54bfea),
    white: mat(0xfff8e2),
    cream: mat(0xf8e9bc),
    yellow: mat(0xffdf3e),
    orange: mat(0xff7a35),
    red: mat(0xe94d4d),
    pink: mat(0xf29abd),
    purple: mat(0x9f7bdd),
    green: mat(0x55bd68),
    blue: mat(0x45a4ed),
    teal: mat(0x55c8c2),
    skin: mat(0xf3b98b),
    hair: mat(0x4d3227),
    wood: mat(0xa96d3d),
    glass: mat(0x8ee1f0),
    floor: mat(0xe2cda8),
    interiorWall: mat(0xfff0c9)
  };

  scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x5f8d46, 2.15));
  const sun = new THREE.DirectionalLight(0xfff4c6, 2.35);
  sun.position.set(-55, 90, 35);
  scene.add(sun);

  // A single reusable interior light avoids compiling four point-light loops into
  // every outdoor toon material. It only turns on while the player is inside.
  const interiorLight = new THREE.PointLight(0xffd98a, 1.2, 28, 2);
  interiorLight.visible = false;
  scene.add(interiorLight);

  // ---------- Helpers ----------
  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const random = mulberry32(734921);
  const rand = (a, b) => a + (b - a) * random();
  const clamp = THREE.MathUtils.clamp;
  const damp = THREE.MathUtils.damp;

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function terrainHeight(x, z) {
    const r = Math.hypot(x, z);
    const rolling = Math.sin(x * 0.052) * 1.15 + Math.cos(z * 0.044) * 0.95 + Math.sin((x + z) * 0.025) * 0.75;
    const ridge = Math.max(0, r - 118);
    const mountains = Math.pow(ridge / 58, 1.72) * 14;
    const asymmetry = Math.max(0, Math.sin(x * 0.018 + 0.8) + Math.cos(z * 0.021 - 0.5)) * smoothstep(95, 195, r) * 4.4;
    const raw = rolling + mountains + asymmetry;
    const townFlatten = smoothstep(72, 102, Math.hypot(x * 0.92, z));
    return raw * townFlatten - 0.42;
  }

  function currentGroundHeight(x, z) {
    return state.area === 'world' ? terrainHeight(x, z) : 0;
  }

  function outlinedMesh(geometry, material, scale = 1.045) {
    const group = new THREE.Group();
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    outline.scale.setScalar(scale);
    outline.renderOrder = 0;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    group.add(outline, mesh);
    return group;
  }

  function freeze(root) {
    root.traverse((obj) => {
      if (obj.isMesh && !obj.userData.animated) {
        obj.updateMatrix();
        obj.matrixAutoUpdate = false;
        staticMeshes.push(obj);
      }
    });
  }

  function addCircleCollider(x, z, radius, area = 'world') {
    colliders.push({ type: 'circle', x, z, radius, area });
  }

  function addBoxCollider(x, z, halfW, halfD, area = 'world') {
    colliders.push({ type: 'box', x, z, halfW, halfD, area });
  }

  function registerInteraction({ x, z, object = null, radius = 4, text, prompt = 'Interact', area = 'world', action = null, enabled = null }) {
    const item = { x, z, object, radius, text, prompt, area, action, enabled };
    interactables.push(item);
    return item;
  }

  function isBlocked(x, z, playerRadius = 0.52) {
    if (state.area === 'world') {
      if (Math.hypot(x, z) > CONFIG.worldRadius - 4) return true;
    } else {
      const b = areaBounds[state.area];
      if (!b) return true;
      if (x < b.cx - b.halfW + playerRadius || x > b.cx + b.halfW - playerRadius ||
          z < b.cz - b.halfD + playerRadius || z > b.cz + b.halfD - playerRadius) return true;
    }

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.area !== state.area) continue;
      if (c.type === 'circle') {
        const dx = x - c.x;
        const dz = z - c.z;
        const rr = playerRadius + c.radius;
        if (dx * dx + dz * dz < rr * rr) return true;
      } else {
        const dx = Math.abs(x - c.x);
        const dz = Math.abs(z - c.z);
        if (dx < c.halfW + playerRadius && dz < c.halfD + playerRadius) return true;
      }
    }
    return false;
  }

  const roadStripeTransforms = [];
  const roadSegments = [];

  function addRoadSegment(x1, z1, x2, z2, width = 8.2, stripes = true) {
    roadSegments.push({ x1, z1, x2, z2, width });
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz) + 0.8;
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const y = terrainHeight(mx, mz) + 0.07;
    const angle = Math.atan2(dx, dz);

    const road = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1), materials.road);
    road.position.set(mx, y, mz);
    road.rotation.y = angle;
    road.scale.set(width, 1, length);
    scene.add(road);
    freeze(road);

    if (stripes) {
      const segments = Math.floor(length / 7);
      for (let i = 0; i < segments; i++) {
        const t = (i + 0.5) / segments;
        roadStripeTransforms.push([x1 + dx * t, y + 0.1, z1 + dz * t, angle]);
      }
    }
  }

  function addSidewalk(x, z, w, d) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), materials.sidewalk);
    walk.position.set(x, terrainHeight(x, z) + 0.13, z);
    scene.add(walk);
    freeze(walk);
  }

  // ---------- Terrain ----------
  const terrainGeo = new THREE.PlaneGeometry(520, 520, 56, 56);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainPos = terrainGeo.attributes.position;
  for (let i = 0; i < terrainPos.count; i++) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getZ(i);
    terrainPos.setY(i, terrainHeight(x, z));
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, materials.grass);
  terrain.matrixAutoUpdate = false;
  terrain.updateMatrix();
  scene.add(terrain);

  // Pond / park landmark.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(12, 24), materials.water);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-76, terrainHeight(-76, 45) + 0.07, 45);
  pond.scale.set(1.45, 0.86, 1);
  scene.add(pond);
  freeze(pond);

  // ---------- Road network ----------
  // Main roads form a compact, readable town grid while a winding road exits west/east.
  // The civic plaza and major landmarks interrupt the streets instead of
  // having roads visibly pass through buildings, fountains, or the theater.
  addRoadSegment(-84, -2, -16, -2, 8.8, true);
  addRoadSegment(16, -2, 86, -2, 8.8, true);
  addRoadSegment(0, -72, 0, -43, 8.8, true);
  addRoadSegment(0, 15, 0, 43, 8.8, true);
  addRoadSegment(-64, -38, 64, -38, 7.4, false);
  addRoadSegment(-64, 34, 64, 34, 7.4, false);
  addRoadSegment(-43, -66, -43, 63, 7.2, false);
  addRoadSegment(43, -66, 43, 63, 7.2, false);
  addRoadSegment(-84, -2, -112, -12, 8.3, true);
  addRoadSegment(86, -2, 119, 20, 8.3, true);

  // Every dashed center line is one instance in a single draw call.
  const stripeGeometry = new THREE.BoxGeometry(0.16, 0.025, 2.7);
  const roadStripes = new THREE.InstancedMesh(stripeGeometry, materials.roadLine, roadStripeTransforms.length);
  roadStripes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  roadStripeTransforms.forEach(([x, y, z, angle], i) => {
    temp.obj.position.set(x, y, z);
    temp.obj.rotation.set(0, angle, 0);
    temp.obj.scale.set(1, 1, 1);
    temp.obj.updateMatrix();
    roadStripes.setMatrixAt(i, temp.obj.matrix);
  });
  roadStripes.computeBoundingSphere();
  roadStripes.matrixAutoUpdate = false;
  roadStripes.updateMatrix();
  scene.add(roadStripes);

  // Sidewalk pads define walkable civic blocks without expensive curb geometry.
  addSidewalk(0, -27, 31, 20);
  addSidewalk(-27, -26, 18, 21);
  addSidewalk(27, -26, 18, 21);
  addSidewalk(0, 23, 32, 17);

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.5, 0.2, 20), materials.plaza);
  plaza.position.set(0, terrainHeight(0, 0) + 0.11, 0);
  scene.add(plaza);
  freeze(plaza);

  // ---------- Mountains ----------
  const mountainGeo = new THREE.ConeGeometry(18, 44, 7, 1);
  const capGeo = new THREE.ConeGeometry(7.5, 12, 7, 1);
  const mountainMesh = new THREE.InstancedMesh(mountainGeo, materials.mountain, 22);
  const capMesh = new THREE.InstancedMesh(capGeo, materials.snow, 22);
  mountainMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  capMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2 + rand(-0.12, 0.12);
    const radius = rand(168, 218);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const heightScale = rand(0.75, 1.42);
    const baseY = terrainHeight(x, z) + 17 * heightScale;
    temp.obj.position.set(x, baseY, z);
    temp.obj.rotation.set(0, rand(0, Math.PI), rand(-0.05, 0.05));
    temp.obj.scale.set(rand(0.85, 1.2), heightScale, rand(0.85, 1.2));
    temp.obj.updateMatrix();
    mountainMesh.setMatrixAt(i, temp.obj.matrix);

    temp.obj.position.set(x, baseY + 18.2 * heightScale, z);
    temp.obj.rotation.set(0, temp.obj.rotation.y, 0);
    temp.obj.scale.set(rand(0.85, 1.1), heightScale, rand(0.85, 1.1));
    temp.obj.updateMatrix();
    capMesh.setMatrixAt(i, temp.obj.matrix);
  }
  mountainMesh.computeBoundingSphere();
  capMesh.computeBoundingSphere();
  scene.add(mountainMesh, capMesh);

  // ---------- Instanced trees, grass and rocks ----------
  const trunkGeo = new THREE.CylinderGeometry(0.34, 0.5, 2.9, 5);
  const crownGeo = new THREE.IcosahedronGeometry(1.65, 0);
  const trunkInstances = new THREE.InstancedMesh(trunkGeo, materials.trunk, CONFIG.medium.trees);
  const crownInstances = new THREE.InstancedMesh(crownGeo, materials.leavesA, CONFIG.medium.trees);
  trunkInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  crownInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  let treeCount = 0;
  let tries = 0;
  while (treeCount < CONFIG.medium.trees && tries++ < 7000) {
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(random()) * 193 + 22;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    if (Math.abs(x) < 88 && Math.abs(z) < 76) continue;
    if (Math.abs(z + 2) < 8 && x > -120 && x < 125) continue;
    if (Math.hypot(x + 76, z - 45) < 19) continue;
    const y = terrainHeight(x, z);
    const s = rand(0.75, 1.35);

    temp.obj.position.set(x, y + 1.45 * s, z);
    temp.obj.rotation.set(0, rand(0, Math.PI * 2), 0);
    temp.obj.scale.set(s, s, s);
    temp.obj.updateMatrix();
    trunkInstances.setMatrixAt(treeCount, temp.obj.matrix);

    temp.obj.position.set(x, y + 3.75 * s, z);
    temp.obj.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI * 2), rand(-0.12, 0.12));
    temp.obj.scale.set(s * rand(0.9, 1.15), s * rand(0.9, 1.18), s * rand(0.9, 1.15));
    temp.obj.updateMatrix();
    crownInstances.setMatrixAt(treeCount, temp.obj.matrix);
    crownInstances.setColorAt(treeCount, temp.color.setHex(random() > 0.5 ? 0x62e64b : 0x7bf15a));
    if (radius < 108 && treeCount % 4 === 0) addCircleCollider(x, z, 0.68 * s);
    treeCount++;
  }
  crownInstances.instanceColor.needsUpdate = true;
  trunkInstances.computeBoundingSphere();
  crownInstances.computeBoundingSphere();
  scene.add(trunkInstances, crownInstances);

  const grassGeo = new THREE.ConeGeometry(0.14, 0.85, 3, 1);
  const grassInstances = new THREE.InstancedMesh(grassGeo, materials.grassDark, CONFIG.medium.grass);
  grassInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for (let i = 0; i < CONFIG.medium.grass; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(random()) * 202 + 18;
    let x = Math.sin(angle) * radius;
    let z = Math.cos(angle) * radius;
    if (Math.abs(x) < 82 && Math.abs(z) < 70) {
      x += x < 0 ? -75 : 75;
      z += z < 0 ? -35 : 35;
    }
    const y = terrainHeight(x, z);
    const s = rand(0.65, 1.45);
    temp.obj.position.set(x, y + 0.35 * s, z);
    temp.obj.rotation.set(rand(-0.18, 0.18), rand(0, Math.PI * 2), rand(-0.18, 0.18));
    temp.obj.scale.set(s, s, s);
    temp.obj.updateMatrix();
    grassInstances.setMatrixAt(i, temp.obj.matrix);
  }
  grassInstances.computeBoundingSphere();
  scene.add(grassInstances);

  const rockGeo = new THREE.DodecahedronGeometry(0.85, 0);
  const rockInstances = new THREE.InstancedMesh(rockGeo, materials.rock, CONFIG.medium.rocks);
  rockInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for (let i = 0; i < CONFIG.medium.rocks; i++) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(105, 210);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const y = terrainHeight(x, z);
    const s = rand(0.55, 1.8);
    temp.obj.position.set(x, y + 0.34 * s, z);
    temp.obj.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    temp.obj.scale.set(s, s * rand(0.55, 0.95), s * rand(0.7, 1.2));
    temp.obj.updateMatrix();
    rockInstances.setMatrixAt(i, temp.obj.matrix);
  }
  rockInstances.computeBoundingSphere();
  scene.add(rockInstances);

  // ---------- Reusable town geometry ----------
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitRoof = new THREE.ConeGeometry(0.72, 0.52, 4, 1);
  const doorGeo = new THREE.BoxGeometry(1.15, 2.15, 0.18);
  const windowGeo = new THREE.BoxGeometry(0.82, 0.82, 0.13);
  const chimneyGeo = new THREE.BoxGeometry(0.52, 1.25, 0.52);
  const houseColors = [0xffd56a, 0xff9f69, 0x8dd8e7, 0xc5e47d, 0xf1b2d0, 0xb6b3ec];
  const roofColors = [0xd64e45, 0x455d7a, 0x8a5438, 0x684d73];
  const townBuildings = [];

  function createWindows(root, positions, material = materials.yellow) {
    if (!positions.length) return;
    const windows = new THREE.InstancedMesh(windowGeo, material, positions.length);
    windows.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    positions.forEach((p, i) => {
      temp.obj.position.set(p[0], p[1], p[2]);
      temp.obj.rotation.set(p[3] || 0, p[4] || 0, p[5] || 0);
      temp.obj.scale.set(p[6] || 1, p[7] || 1, p[8] || 1);
      temp.obj.updateMatrix();
      windows.setMatrixAt(i, temp.obj.matrix);
    });
    windows.computeBoundingSphere();
    root.add(windows);
  }

  function createHouse(x, z, rotation, colorIndex = 0, size = 1) {
    const root = new THREE.Group();
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = rotation;
    root.scale.setScalar(size);

    const wall = outlinedMesh(unitBox, mat(houseColors[colorIndex % houseColors.length]), 1.025);
    wall.position.y = 1.7;
    wall.scale.set(4.6, 3.4, 4.1);
    root.add(wall);

    const roof = outlinedMesh(unitRoof, mat(roofColors[colorIndex % roofColors.length]), 1.035);
    roof.position.y = 4.15;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(5.0, 4.35, 5.0);
    root.add(roof);

    const door = new THREE.Mesh(doorGeo, materials.dark);
    door.position.set(0, 1.08, 2.12);
    root.add(door);
    createWindows(root, [[-1.35, 2.25, 2.12], [1.35, 2.25, 2.12]]);

    const chimney = outlinedMesh(chimneyGeo, materials.rock, 1.05);
    chimney.position.set(1.35, 4.35, -0.5);
    root.add(chimney);

    scene.add(root);
    addCircleCollider(x, z, 3.0 * size);
    registerInteraction({ x, z, radius: 4.7 * size, prompt: 'Knock', text: 'A cozy Toon Valley home. Someone inside is humming a cheerful song.' });
    freeze(root);
    return root;
  }

  function createTownBuilding(options) {
    const {
      x, z, w = 9, d = 7, h = 6, color = 0xffd56a, roofColor = 0x455d7a,
      label = 'Town Building', enterArea = null, prompt = null, tower = false,
      awningColor = null, columns = 0, icon = null, rotation = 0
    } = options;

    const root = new THREE.Group();
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = rotation;

    const body = outlinedMesh(unitBox, mat(color), 1.018);
    body.position.y = h * 0.5;
    body.scale.set(w, h, d);
    root.add(body);

    const roof = outlinedMesh(unitBox, mat(roofColor), 1.025);
    roof.position.y = h + 0.38;
    roof.scale.set(w + 0.7, 0.72, d + 0.7);
    root.add(roof);

    const door = outlinedMesh(doorGeo, materials.dark, 1.035);
    door.position.set(0, 1.15, d * 0.5 + 0.11);
    root.add(door);

    const windowPositions = [];
    const floors = h > 7 ? [2.35, 5.1] : [2.55];
    for (const y of floors) {
      const count = Math.max(2, Math.floor(w / 2.6));
      for (let i = 0; i < count; i++) {
        const wx = (i - (count - 1) / 2) * 2.25;
        if (Math.abs(wx) < 0.8 && y < 3) continue;
        windowPositions.push([wx, y, d * 0.5 + 0.11, 0, 0, 0, 1.15, 1.0, 1]);
      }
    }
    createWindows(root, windowPositions, materials.glass);

    if (awningColor !== null) {
      const awning = outlinedMesh(unitBox, mat(awningColor), 1.035);
      awning.position.set(0, 3.35, d * 0.5 + 0.8);
      awning.rotation.x = -0.18;
      awning.scale.set(w * 0.72, 0.3, 1.45);
      root.add(awning);
    }

    if (columns > 0) {
      const colGeo = new THREE.CylinderGeometry(0.28, 0.36, h * 0.68, 7);
      for (let i = 0; i < columns; i++) {
        const cx = columns === 1 ? 0 : (i - (columns - 1) / 2) * (w * 0.65 / (columns - 1));
        const col = outlinedMesh(colGeo, materials.white, 1.05);
        col.position.set(cx, h * 0.34, d * 0.5 + 0.68);
        root.add(col);
      }
    }

    if (tower) {
      const towerBody = outlinedMesh(unitBox, mat(color), 1.02);
      towerBody.position.set(0, h + 3.0, -0.2);
      towerBody.scale.set(3.5, 5.2, 3.5);
      root.add(towerBody);
      const towerRoof = outlinedMesh(new THREE.ConeGeometry(2.65, 2.25, 4), mat(roofColor), 1.035);
      towerRoof.position.set(0, h + 6.75, -0.2);
      towerRoof.rotation.y = Math.PI / 4;
      root.add(towerRoof);
      const clockFace = outlinedMesh(new THREE.CylinderGeometry(0.68, 0.68, 0.12, 12), materials.white, 1.06);
      clockFace.rotation.x = Math.PI / 2;
      clockFace.position.set(0, h + 3.45, 1.58);
      root.add(clockFace);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), materials.dark);
      hand.position.set(0.08, h + 3.6, 1.68);
      hand.rotation.z = -0.55;
      root.add(hand);
    }

    if (icon === 'book') {
      const book = outlinedMesh(unitBox, materials.red, 1.04);
      book.position.set(0, h + 1.15, d * 0.5 + 0.12);
      book.scale.set(2.2, 1.2, 0.25);
      root.add(book);
      const page = new THREE.Mesh(unitBox, materials.white);
      page.position.set(0, h + 1.15, d * 0.5 + 0.28);
      page.scale.set(1.82, 0.78, 0.08);
      root.add(page);
    } else if (icon === 'cup') {
      const cup = outlinedMesh(new THREE.CylinderGeometry(0.72, 0.58, 1.05, 10), materials.white, 1.05);
      cup.position.set(0, h + 1.0, d * 0.5 + 0.22);
      root.add(cup);
    } else if (icon === 'cross') {
      const v = outlinedMesh(unitBox, materials.red, 1.045);
      v.position.set(0, h + 1.0, d * 0.5 + 0.22);
      v.scale.set(0.55, 2.15, 0.3);
      const hh = outlinedMesh(unitBox, materials.red, 1.045);
      hh.position.set(0, h + 1.0, d * 0.5 + 0.22);
      hh.scale.set(1.8, 0.55, 0.3);
      root.add(v, hh);
    }

    scene.add(root);
    const quarterTurn = Math.abs(Math.sin(rotation)) > 0.7;
    const colliderHalfW = quarterTurn ? d * 0.5 : w * 0.5;
    const colliderHalfD = quarterTurn ? w * 0.5 : d * 0.5;
    addBoxCollider(x, z, colliderHalfW, colliderHalfD);
    townBuildings.push({ label, x, z, halfW: colliderHalfW, halfD: colliderHalfD, rotation });

    const forwardX = Math.sin(rotation);
    const forwardZ = Math.cos(rotation);
    const doorDistance = d * 0.5 + 1.1;
    const doorX = x + forwardX * doorDistance;
    const doorZ = z + forwardZ * doorDistance;
    const returnDistance = d * 0.5 + 2.5;
    const action = enterArea ? () => enterInterior(enterArea, {
      x: x + forwardX * returnDistance,
      z: z + forwardZ * returnDistance
    }) : null;
    registerInteraction({
      x: doorX,
      z: doorZ,
      radius: 4.2,
      prompt: prompt || (enterArea ? `Enter ${label}` : `Visit ${label}`),
      text: enterArea ? `Entering ${label}…` : `${label} is one of Toon Valley's favorite landmarks.`,
      action
    });
    freeze(root);
    return root;
  }

  // ---------- Expanded Toon Valley town ----------
  // Civic center and four enterable buildings.
  createTownBuilding({ x: 0, z: -27, w: 15, d: 9, h: 7.6, color: 0xf5d58b, roofColor: 0x486a86, label: 'City Hall', enterArea: 'cityHall', tower: true, columns: 4 });
  createTownBuilding({ x: 26, z: -25, w: 12, d: 8.5, h: 6.2, color: 0xffb06e, roofColor: 0x9a4f42, label: 'Sunny General Store', enterArea: 'generalStore', awningColor: 0xffdf3e });
  createTownBuilding({ x: -26, z: -25, w: 12, d: 8.5, h: 6.2, color: 0x91c8e8, roofColor: 0x455d7a, label: 'Storybook Library', enterArea: 'library', icon: 'book' });
  createTownBuilding({ x: -15, z: 23, w: 11, d: 8, h: 5.7, color: 0xf2b1ce, roofColor: 0x704f72, label: 'Cloud Nine Cafe', enterArea: 'cafe', awningColor: 0xffffff, icon: 'cup' });

  // Town services and kid-friendly shops.
  createTownBuilding({ x: 59, z: 16, w: 13, d: 9, h: 6.3, color: 0xf4eee0, roofColor: 0xd34e4e, label: 'Toon Valley Clinic', icon: 'cross', rotation: -Math.PI / 2 });
  createTownBuilding({ x: -58, z: -25, w: 14, d: 10, h: 6.8, color: 0xe95a53, roofColor: 0x3f5365, label: 'Fire Station', rotation: Math.PI / 2 });
  createTownBuilding({ x: 58, z: -25, w: 12, d: 8.5, h: 6.0, color: 0xa8d6e7, roofColor: 0x47627b, label: 'Post Office', rotation: -Math.PI / 2 });
  createTownBuilding({ x: -59, z: 16, w: 15, d: 10, h: 6.5, color: 0xf0d070, roofColor: 0x6f4c3d, label: 'Rainbow Elementary', rotation: Math.PI / 2 });
  createTownBuilding({ x: 16, z: 23, w: 11, d: 8, h: 5.7, color: 0xa5df8c, roofColor: 0x4e735d, label: 'Happy Home Furnishings', enterArea: 'furnitureStore', awningColor: 0xff7a35 });
  createTownBuilding({ x: 0, z: 53, w: 17, d: 10, h: 8.0, color: 0xb6b3ec, roofColor: 0x574d75, label: 'Moonbeam Theater', columns: 3, rotation: Math.PI });

  // Apartment buildings give the town a slightly denser Sims-like neighborhood.
  createTownBuilding({ x: -64, z: 49, w: 15, d: 11, h: 10.5, color: 0xf2a67d, roofColor: 0x70463a, label: 'Maple Apartments', enterArea: 'home', prompt: 'Go home', rotation: Math.PI });
  createTownBuilding({ x: 64, z: 49, w: 15, d: 11, h: 10.5, color: 0x8fd0cf, roofColor: 0x3d6d70, label: 'Hilltop Apartments', rotation: Math.PI });

  // Residential streets.
  const houses = [
    [-68, -52, 0, 0, 1.0], [-52, -52, 0, 1, 0.94], [-28, -53, 0, 2, 1.02], [28, -53, 0, 3, 0.96], [52, -52, 0, 4, 1.04], [68, -52, 0, 5, 0.95],
    [-68, 67, Math.PI, 5, 0.95], [-51, 66, Math.PI, 4, 1.04], [-28, 66, Math.PI, 3, 0.95], [28, 66, Math.PI, 2, 1.03], [51, 66, Math.PI, 1, 0.96], [68, 67, Math.PI, 0, 1.0],
    [-74, -19, Math.PI / 2, 2, 0.95], [-74, 17, Math.PI / 2, 3, 1.04], [74, -19, -Math.PI / 2, 4, 1.0], [74, 17, -Math.PI / 2, 5, 0.96]
  ];
  houses.forEach((h) => createHouse(...h));

  // ---------- Town square fountain and monument ----------
  const fountain = new THREE.Group();
  const basin = outlinedMesh(new THREE.CylinderGeometry(3.1, 3.45, 0.7, 12), materials.rock, 1.025);
  basin.position.y = 0.35;
  const waterDisk = new THREE.Mesh(new THREE.CylinderGeometry(2.72, 2.72, 0.09, 18), materials.water);
  waterDisk.position.y = 0.74;
  const pillar = outlinedMesh(new THREE.CylinderGeometry(0.48, 0.72, 2.65, 8), materials.rock, 1.04);
  pillar.position.y = 1.75;
  const orb = outlinedMesh(new THREE.IcosahedronGeometry(0.72, 1), materials.yellow, 1.06);
  orb.position.y = 3.25;
  fountain.add(basin, waterDisk, pillar, orb);
  fountain.position.set(0, terrainHeight(0, 0) + 0.05, 0);
  scene.add(fountain);
  addCircleCollider(0, 0, 3.5);
  registerInteraction({ x: 0, z: 0, radius: 5.5, prompt: 'Make a wish', text: 'The fountain marks the center of Toon Valley. A shiny coin twinkles at the bottom.' });
  freeze(fountain);

  // The smiling sun monument sits in the east plaza.
  const monument = new THREE.Group();
  monument.position.set(30, terrainHeight(30, 11), 11);
  const pedestal = outlinedMesh(new THREE.CylinderGeometry(2.1, 2.5, 1.1, 8), materials.rock, 1.03);
  pedestal.position.y = 0.55;
  const sunFace = outlinedMesh(new THREE.SphereGeometry(1.35, 10, 8), materials.yellow, 1.05);
  sunFace.position.y = 3.1;
  monument.add(pedestal, sunFace);
  for (let i = 0; i < 8; i++) {
    const ray = outlinedMesh(new THREE.ConeGeometry(0.28, 1.1, 4), materials.orange, 1.05);
    ray.position.set(Math.sin(i * Math.PI / 4) * 2.0, 3.1 + Math.cos(i * Math.PI / 4) * 2.0, 0);
    ray.rotation.z = -i * Math.PI / 4;
    monument.add(ray);
  }
  scene.add(monument);
  addCircleCollider(30, 11, 2.3);
  registerInteraction({ x: 30, z: 11, radius: 4.5, prompt: 'Read plaque', text: 'The Sunny Spirit monument celebrates kindness, curiosity, and very good picnics.' });
  freeze(monument);

  // ---------- Park, playground, benches, market and flowers ----------
  const benchSeats = [];

  function setSeatedPose() {
    const data = player.userData;
    data.moving = 0;
    data.bodyRoot.position.y = 0.08;
    data.bodyRoot.rotation.z = 0;
    data.legs[0].rotation.x = -1.12;
    data.legs[1].rotation.x = -1.12;
    data.arms[0].rotation.x = -0.22;
    data.arms[1].rotation.x = -0.22;
  }

  function standUpFromSeat(showMessage = true) {
    if (!state.seated) return false;
    state.seated = false;
    state.seat = null;
    player.position.y = currentGroundHeight(player.position.x, player.position.z);
    playerVelocity.set(0, 0, 0);
    state.cameraReady = false;
    animateCharacter(player, 0.016, 0);
    if (showMessage) showToast('You stood up.', 1.2);
    return true;
  }

  function sitOnBench(bench) {
    if (!bench || state.area !== 'world') return;
    if (state.seated) {
      standUpFromSeat();
      return;
    }
    const angle = bench.rotation.y;
    player.position.set(
      bench.position.x + Math.sin(angle) * 0.08,
      bench.position.y + 0.62,
      bench.position.z + Math.cos(angle) * 0.08
    );
    player.rotation.y = angle;
    playerVelocity.set(0, 0, 0);
    state.jumpVelocity = 0;
    state.grounded = true;
    state.seated = true;
    state.seat = bench;
    state.cameraReady = false;
    setSeatedPose();
    showToast('Taking a peaceful bench break. Move, jump, or use the bench to stand.', 2.8);
    window.dispatchEvent(new CustomEvent('toonvalley:sit', { detail: { x: bench.position.x, z: bench.position.z } }));
  }

  function createBench(x, z, rotation = 0) {
    const root = new THREE.Group();
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = rotation;
    const seat = outlinedMesh(unitBox, materials.wood, 1.045);
    seat.position.y = 0.75;
    seat.scale.set(2.8, 0.28, 0.7);
    const back = outlinedMesh(unitBox, materials.wood, 1.045);
    back.position.set(0, 1.45, -0.28);
    back.rotation.x = -0.12;
    back.scale.set(2.8, 1.05, 0.22);
    root.add(seat, back);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(unitBox, materials.dark);
      leg.position.set(sx * 0.95, 0.37, 0);
      leg.scale.set(0.18, 0.75, 0.52);
      root.add(leg);
    }
    scene.add(root);
    benchSeats.push(root);
    registerInteraction({
      object: root,
      radius: 3.2,
      prompt: 'Sit on bench',
      text: 'A comfortable Toon Valley bench.',
      action: () => sitOnBench(root)
    });
    freeze(root);
  }

  [[-66, 29, 0.4], [-84, 31, -0.5], [-63, 57, 2.7], [-86, 57, -2.6], [-9, 8, 0], [9, 8, Math.PI], [18, -9, 1.6], [-18, -9, -1.6]].forEach((b) => createBench(...b));

  // Playground slide and swings.
  const playground = new THREE.Group();
  playground.position.set(-65, terrainHeight(-65, 14), 14);
  const platform = outlinedMesh(unitBox, materials.yellow, 1.035);
  platform.position.set(0, 2.2, 0);
  platform.scale.set(2.5, 0.45, 2.5);
  const slide = outlinedMesh(unitBox, materials.red, 1.035);
  slide.position.set(0, 1.25, 2.0);
  slide.rotation.x = -0.54;
  slide.scale.set(1.15, 0.22, 4.6);
  playground.add(platform, slide);
  for (const sx of [-1, 1]) {
    const pole = outlinedMesh(new THREE.CylinderGeometry(0.16, 0.18, 3.9, 6), materials.blue, 1.05);
    pole.position.set(sx * 2.5, 1.95, -1.2);
    playground.add(pole);
  }
  const topBar = outlinedMesh(new THREE.CylinderGeometry(0.17, 0.17, 5.2, 6), materials.blue, 1.05);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(0, 3.8, -1.2);
  playground.add(topBar);
  scene.add(playground);
  addCircleCollider(-65, 14, 3.1);
  registerInteraction({ x: -65, z: 14, radius: 5.0, prompt: 'Play', text: 'The Sunshine Park playground is polished, springy, and ready for adventure.' });
  freeze(playground);

  // Market stalls near the cafe.
  function createStall(x, z, color) {
    const root = new THREE.Group();
    root.position.set(x, terrainHeight(x, z), z);
    const counter = outlinedMesh(unitBox, materials.wood, 1.04);
    counter.position.y = 1.0;
    counter.scale.set(3.5, 1.7, 1.7);
    const canopy = outlinedMesh(unitBox, mat(color), 1.04);
    canopy.position.y = 3.4;
    canopy.scale.set(4.1, 0.35, 2.5);
    root.add(counter, canopy);
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(unitBox, materials.dark);
      pole.position.set(sx * 1.7, 2.1, 0);
      pole.scale.set(0.15, 2.8, 0.15);
      root.add(pole);
    }
    scene.add(root);
    addBoxCollider(x, z, 1.8, 1.0);
    freeze(root);
  }
  createStall(28, 26, 0xffdf3e);
  createStall(35, 26, 0x55c8c2);
  registerInteraction({ x: 31.5, z: 26, radius: 6.0, prompt: 'Browse market', text: 'Fresh food and handmade home goods rotate through the outdoor market.' });

  // Flower beds are one draw call.
  const flowerGeo = new THREE.IcosahedronGeometry(0.18, 0);
  const flowerInstances = new THREE.InstancedMesh(flowerGeo, materials.pink, CONFIG.medium.flowers);
  flowerInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const flowerZones = [[-76, 45, 16], [-8, 11, 8], [8, 11, 8], [29, 14, 7]];
  for (let i = 0; i < CONFIG.medium.flowers; i++) {
    const zone = flowerZones[i % flowerZones.length];
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(random()) * zone[2];
    const x = zone[0] + Math.sin(a) * r;
    const z = zone[1] + Math.cos(a) * r;
    temp.obj.position.set(x, terrainHeight(x, z) + 0.35, z);
    temp.obj.rotation.set(0, rand(0, Math.PI * 2), 0);
    temp.obj.scale.setScalar(rand(0.8, 1.25));
    temp.obj.updateMatrix();
    flowerInstances.setMatrixAt(i, temp.obj.matrix);
    const palette = [0xff7db2, 0xffdf3e, 0xa78cf0, 0xff8d5d];
    flowerInstances.setColorAt(i, temp.color.setHex(palette[i % palette.length]));
  }
  flowerInstances.instanceColor.needsUpdate = true;
  flowerInstances.computeBoundingSphere();
  scene.add(flowerInstances);

  // Street lamps are instanced for low draw cost.
  const lampPostGeo = new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6);
  const lampOrbGeo = new THREE.SphereGeometry(0.36, 7, 5);
  const lampPosts = new THREE.InstancedMesh(lampPostGeo, materials.dark, CONFIG.medium.lamps);
  const lampOrbs = new THREE.InstancedMesh(lampOrbGeo, materials.yellow, CONFIG.medium.lamps);
  const lampPositions = [];
  for (let x = -72; x <= 72; x += 12) {
    lampPositions.push([x, -8], [x, 6]);
  }
  for (let z = -62; z <= 62; z += 14) {
    lampPositions.push([-7, z], [7, z]);
  }
  for (let i = 0; i < CONFIG.medium.lamps; i++) {
    const p = lampPositions[i % lampPositions.length];
    const y = terrainHeight(p[0], p[1]);
    temp.obj.position.set(p[0], y + 2.1, p[1]);
    temp.obj.rotation.set(0, 0, 0);
    temp.obj.scale.set(1, 1, 1);
    temp.obj.updateMatrix();
    lampPosts.setMatrixAt(i, temp.obj.matrix);
    temp.obj.position.set(p[0], y + 4.45, p[1]);
    temp.obj.updateMatrix();
    lampOrbs.setMatrixAt(i, temp.obj.matrix);
  }
  lampPosts.computeBoundingSphere();
  lampOrbs.computeBoundingSphere();
  scene.add(lampPosts, lampOrbs);

  // ---------- Signposts ----------
  function createSign(x, z, rotation, text) {
    const root = new THREE.Group();
    const post = outlinedMesh(new THREE.BoxGeometry(0.28, 2.8, 0.28), materials.trunk, 1.08);
    post.position.y = 1.4;
    const board = outlinedMesh(new THREE.BoxGeometry(2.35, 0.9, 0.18), materials.yellow, 1.055);
    board.position.y = 2.45;
    root.add(post, board);
    root.position.set(x, terrainHeight(x, z), z);
    root.rotation.y = rotation;
    scene.add(root);
    registerInteraction({ x, z, radius: 3.8, prompt: 'Read sign', text });
    freeze(root);
  }
  createSign(-11, 11, 0.2, 'Village Square →  |  Sunshine Park ←');
  createSign(88, 7, 0.5, 'East Trail →  Mountain overlooks and picnic fields.');
  createSign(-92, -7, -0.2, 'West Road →  The old windmill is beyond the hill.');

  // ---------- Windmill landmark ----------
  const windmill = new THREE.Group();
  windmill.position.set(-124, terrainHeight(-124, -18), -18);
  const millBody = outlinedMesh(new THREE.CylinderGeometry(2.7, 3.6, 7.5, 8), mat(0xf4e1aa), 1.025);
  millBody.position.y = 3.75;
  const millRoof = outlinedMesh(new THREE.ConeGeometry(3.2, 2.8, 8), materials.red, 1.035);
  millRoof.position.y = 8.65;
  windmill.add(millBody, millRoof);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.0, 8), materials.dark);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, 6.0, 3.45);
  windmill.add(axle);
  const blades = new THREE.Group();
  blades.userData.animated = true;
  blades.position.set(0, 6.0, 4.0);
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = i * Math.PI / 2;
    const blade = outlinedMesh(new THREE.BoxGeometry(0.55, 5.3, 0.18), materials.white, 1.04);
    blade.position.y = 2.65;
    pivot.add(blade);
    blades.add(pivot);
  }
  windmill.add(blades);
  windmill.userData.blades = blades;
  scene.add(windmill);
  addCircleCollider(-124, -18, 4.2);
  registerInteraction({ x: -124, z: -18, radius: 6.5, prompt: 'Inspect windmill', text: 'The old windmill still turns, even on the calmest days.' });

  // ---------- Clouds ----------
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf5fbff });
  const cloudGeometry = new THREE.IcosahedronGeometry(2.8, 1);
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const root = new THREE.Group();
    const count = 3 + (i % 2);
    for (let j = 0; j < count; j++) {
      const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
      puff.position.set(j * 3.2 - (count - 1) * 1.6, Math.sin(j) * 0.55, rand(-0.5, 0.5));
      puff.scale.set(rand(0.8, 1.3), rand(0.55, 0.9), rand(0.8, 1.2));
      root.add(puff);
    }
    root.position.set(rand(-180, 180), rand(35, 54), rand(-155, 150));
    root.scale.setScalar(rand(0.8, 1.35));
    scene.add(root);
    clouds.push({ root, speed: rand(0.5, 1.1) });
  }

  // ---------- Characters ----------
  function createCharacter(palette, outlined = true) {
    const root = new THREE.Group();
    const bodyRoot = new THREE.Group();
    root.add(bodyRoot);

    const bodyGeo = new THREE.SphereGeometry(0.62, 8, 6);
    const headGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const limbGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.8, 5);
    const footGeo = new THREE.SphereGeometry(0.19, 6, 4);
    const earGeo = new THREE.ConeGeometry(0.18, 0.35, 4);

    const make = (geometry, material, scale = 1.05) => outlined ? outlinedMesh(geometry, material, scale) : new THREE.Mesh(geometry, material);
    const body = make(bodyGeo, palette.body, 1.045);
    body.scale.set(0.92, 1.08, 0.78);
    body.position.y = 1.05;
    bodyRoot.add(body);

    const head = make(headGeo, palette.skin, 1.055);
    head.scale.set(0.96, 0.9, 0.94);
    head.position.set(0, 1.9, 0.06);
    bodyRoot.add(head);

    const hair = make(new THREE.SphereGeometry(0.58, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), palette.hair, 1.045);
    hair.position.set(0, 2.12, 0.01);
    bodyRoot.add(hair);

    for (const sx of [-1, 1]) {
      const ear = make(earGeo, palette.hair, 1.07);
      ear.position.set(0.29 * sx, 2.4, 0.02);
      ear.rotation.z = sx * -0.32;
      bodyRoot.add(ear);
    }

    const eyeGeo = new THREE.SphereGeometry(0.055, 5, 4);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, materials.dark);
      eye.position.set(0.18 * sx, 1.93, 0.53);
      bodyRoot.add(eye);
    }

    const arms = [];
    const legs = [];
    for (const sx of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(0.58 * sx, 1.35, 0);
      const arm = make(limbGeo, palette.skin, 1.08);
      arm.position.y = -0.35;
      arm.rotation.z = sx * -0.14;
      armPivot.add(arm);
      bodyRoot.add(armPivot);
      arms.push(armPivot);

      const legPivot = new THREE.Group();
      legPivot.position.set(0.27 * sx, 0.62, 0);
      const leg = make(limbGeo, palette.legs, 1.08);
      leg.position.y = -0.35;
      legPivot.add(leg);
      const foot = make(footGeo, palette.shoes || materials.dark, 1.07);
      foot.position.set(0, -0.78, 0.12);
      foot.scale.set(0.9, 0.7, 1.35);
      legPivot.add(foot);
      bodyRoot.add(legPivot);
      legs.push(legPivot);
    }

    root.userData = { bodyRoot, arms, legs, walkPhase: rand(0, Math.PI * 2), moving: 0 };
    return root;
  }

  const player = createCharacter({ body: materials.orange, skin: materials.skin, hair: materials.hair, legs: materials.blue, shoes: materials.white }, true);
  player.position.set(0, terrainHeight(0, 10), 10);
  player.rotation.y = Math.PI;
  scene.add(player);
  const playerVelocity = new THREE.Vector3();

  const npcPalettes = [
    { body: mat(0xe95f6a), skin: materials.skin, hair: mat(0x2f2729), legs: mat(0x6faad8), shoes: materials.dark },
    { body: mat(0x65c66d), skin: materials.skin, hair: mat(0x9b612d), legs: mat(0x5967a8), shoes: materials.dark },
    { body: mat(0xe4bf4f), skin: materials.skin, hair: mat(0x513b32), legs: mat(0x8793a3), shoes: materials.dark },
    { body: mat(0x9c78d6), skin: materials.skin, hair: mat(0xd18a37), legs: mat(0x3d7f8f), shoes: materials.dark },
    { body: mat(0x59b8d2), skin: materials.skin, hair: mat(0x402b24), legs: mat(0x4e6f9e), shoes: materials.dark }
  ];

  const npcSpawns = [
    [-12, 4], [13, 5], [-24, 11], [28, 14], [5, -10], [48, 4], [-37, -7], [14, 31], [-55, 9], [58, 35],
    [-60, 45], [39, -13], [-10, 44], [53, -44], [-47, -48], [69, 12]
  ];
  npcSpawns.forEach((spawn, i) => {
    const root = createCharacter(npcPalettes[i % npcPalettes.length], true);
    root.scale.setScalar(rand(0.86, 1.02));
    root.position.set(spawn[0], terrainHeight(spawn[0], spawn[1]), spawn[1]);
    root.rotation.y = rand(0, Math.PI * 2);
    root.userData.home = new THREE.Vector2(spawn[0], spawn[1]);
    root.userData.target = new THREE.Vector2(spawn[0], spawn[1]);
    root.userData.think = rand(0.2, 2.6);
    root.userData.speed = rand(1.1, 1.8);
    root.userData.id = `npc-${i}`;
    root.userData.name = ['Maya','Benny','Pip','Luna','Theo','Milo','Nora','Jasper','Ivy','Finn','Rosie','Otis','Cleo','Sam','Tilly','Wren'][i];
    scene.add(root);
    npcs.push(root);
  });

  // ---------- Interiors ----------
  function createRoom(area, wallColor, floorColor) {
    const b = areaBounds[area];
    const root = new THREE.Group();
    root.position.set(b.cx, 0, b.cz);

    const floor = new THREE.Mesh(unitBox, mat(floorColor));
    floor.position.y = -0.2;
    floor.scale.set(b.halfW * 2 + 0.8, 0.4, b.halfD * 2 + 0.8);
    root.add(floor);

    const ceiling = new THREE.Mesh(unitBox, mat(0xfff6df));
    ceiling.position.y = 7.7;
    ceiling.scale.set(b.halfW * 2 + 0.8, 0.35, b.halfD * 2 + 0.8);
    root.add(ceiling);

    const wallMat = mat(wallColor);
    const back = outlinedMesh(unitBox, wallMat, 1.012);
    back.position.set(0, 3.75, -b.halfD - 0.2);
    back.scale.set(b.halfW * 2 + 0.5, 7.5, 0.4);
    const left = outlinedMesh(unitBox, wallMat, 1.012);
    left.position.set(-b.halfW - 0.2, 3.75, 0);
    left.scale.set(0.4, 7.5, b.halfD * 2 + 0.5);
    const right = outlinedMesh(unitBox, wallMat, 1.012);
    right.position.set(b.halfW + 0.2, 3.75, 0);
    right.scale.set(0.4, 7.5, b.halfD * 2 + 0.5);
    const frontLeft = outlinedMesh(unitBox, wallMat, 1.012);
    frontLeft.position.set(-6.1, 3.75, b.halfD + 0.2);
    frontLeft.scale.set(8.0, 7.5, 0.4);
    const frontRight = outlinedMesh(unitBox, wallMat, 1.012);
    frontRight.position.set(6.1, 3.75, b.halfD + 0.2);
    frontRight.scale.set(8.0, 7.5, 0.4);
    root.add(back, left, right, frontLeft, frontRight);

    const exitDoor = outlinedMesh(doorGeo, materials.dark, 1.04);
    exitDoor.position.set(0, 1.1, b.halfD - 0.15);
    root.add(exitDoor);

    interiorGroups[area].add(root);
    registerInteraction({
      x: b.cx,
      z: b.cz + b.halfD - 1.0,
      radius: 3.0,
      prompt: 'Exit building',
      text: 'Back outside to Toon Valley.',
      area,
      action: exitInterior
    });
    freeze(root);
    return root;
  }

  function addInteriorBox(area, localX, localZ, w, h, d, material, y = h * 0.5, collider = true) {
    const b = areaBounds[area];
    const item = outlinedMesh(unitBox, material, 1.025);
    item.position.set(b.cx + localX, y, b.cz + localZ);
    item.scale.set(w, h, d);
    interiorGroups[area].add(item);
    if (collider) addBoxCollider(b.cx + localX, b.cz + localZ, w * 0.5, d * 0.5, area);
    freeze(item);
    return item;
  }

  function addInteriorTable(area, x, z, w = 3, d = 1.5) {
    const b = areaBounds[area];
    const root = new THREE.Group();
    root.position.set(b.cx + x, 0, b.cz + z);
    const top = outlinedMesh(unitBox, materials.wood, 1.04);
    top.position.y = 1.15;
    top.scale.set(w, 0.28, d);
    root.add(top);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(unitBox, materials.dark);
        leg.position.set(sx * (w * 0.36), 0.56, sz * (d * 0.32));
        leg.scale.set(0.16, 1.1, 0.16);
        root.add(leg);
      }
    }
    interiorGroups[area].add(root);
    addBoxCollider(b.cx + x, b.cz + z, w * 0.5, d * 0.5, area);
    freeze(root);
  }

  createRoom('cityHall', 0xf7e6b7, 0xd7c08c);
  addInteriorBox('cityHall', 0, -4.8, 7.2, 1.6, 1.7, materials.wood, 0.8);
  addInteriorTable('cityHall', -4.8, 0.4, 2.6, 1.4);
  addInteriorTable('cityHall', 4.8, 0.4, 2.6, 1.4);
  const cityEmblem = outlinedMesh(new THREE.IcosahedronGeometry(1.15, 1), materials.yellow, 1.06);
  cityEmblem.position.set(areaBounds.cityHall.cx, 4.7, areaBounds.cityHall.cz - 7.65);
  interiorGroups.cityHall.add(cityEmblem);
  registerInteraction({ x: areaBounds.cityHall.cx, z: areaBounds.cityHall.cz - 4.1, radius: 3.2, prompt: 'Ask about town', text: 'The town desk has maps, festival forms, and a jar full of colorful pencils.', area: 'cityHall' });

  createRoom('generalStore', 0xffe2b4, 0xd5b57f);
  for (const x of [-5.6, 0, 5.6]) {
    addInteriorBox('generalStore', x, -3.2, 2.1, 3.8, 6.2, materials.wood, 1.9);
  }
  addInteriorBox('generalStore', 0, 4.1, 7.0, 1.4, 1.6, materials.teal, 0.7);
  registerInteraction({ x: areaBounds.generalStore.cx, z: areaBounds.generalStore.cz + 3.2, radius: 3.0, prompt: 'Browse counter', text: 'The counter displays juice boxes, postcards, toy cars, and mystery candy bags.', area: 'generalStore' });

  createRoom('library', 0xddebf4, 0xc5ab80);
  for (const x of [-6.5, 6.5]) {
    addInteriorBox('library', x, -2.6, 2.0, 5.0, 8.2, materials.wood, 2.5);
  }
  addInteriorTable('library', 0, -2.0, 5.2, 2.3);
  addInteriorTable('library', 0, 2.0, 5.2, 2.3);
  registerInteraction({ x: areaBounds.library.cx, z: areaBounds.library.cz - 1.8, radius: 3.1, prompt: 'Read a book', text: 'You find “The Moon Rabbit and the Missing Sandwich.” It has excellent pictures.', area: 'library' });

  createRoom('cafe', 0xffe1ed, 0xd7b18c);
  addInteriorBox('cafe', 0, -5.4, 11.0, 1.5, 1.6, materials.purple, 0.75);
  addInteriorTable('cafe', -4.2, 0.4, 2.5, 2.0);
  addInteriorTable('cafe', 0, 0.4, 2.5, 2.0);
  addInteriorTable('cafe', 4.2, 0.4, 2.5, 2.0);
  registerInteraction({ x: areaBounds.cafe.cx, z: areaBounds.cafe.cz - 4.6, radius: 3.0, prompt: 'Order snack', text: 'Today’s special is a star-shaped waffle with berry clouds.', area: 'cafe' });


  createRoom('home', 0xffe8bd, 0xd8b887);
  // The starter studio has useful fixtures from day one and leaves a large open
  // center for player-placed furniture. Life-system code adds the interactive
  // versions and upgrades without rebuilding the room shell.
  addInteriorBox('home', -8.8, -6.5, 4.0, 0.65, 2.1, materials.wood, 0.34, false);
  addInteriorBox('home', 9.2, -6.4, 3.2, 2.4, 2.0, materials.teal, 1.2, false);
  addInteriorBox('home', 8.6, 5.6, 3.0, 2.7, 1.8, materials.white, 1.35, false);

  createRoom('furnitureStore', 0xe3f4d0, 0xc9ad7c);
  for (const x of [-7.8, -2.6, 2.6, 7.8]) addInteriorBox('furnitureStore', x, -4.6, 3.6, 0.55, 2.8, materials.wood, 0.28, false);
  addInteriorBox('furnitureStore', 0, 5.6, 8.6, 1.4, 1.5, materials.orange, 0.7, false);

  function findSafeInteriorPosition(area, preferred = null) {
    const b = areaBounds[area];
    if (!b) return { x: 0, z: 10 };

    const preferredX = Number.isFinite(preferred?.x) ? preferred.x : b.cx;
    const preferredZ = Number.isFinite(preferred?.z) ? preferred.z : b.cz + b.halfD - 1.85;
    const nearDoorZ = b.cz + b.halfD - 1.85;
    const candidates = [
      [preferredX, preferredZ],
      [b.cx, nearDoorZ],
      [b.cx - 2.4, nearDoorZ],
      [b.cx + 2.4, nearDoorZ],
      [b.cx, b.cz + 1.7],
      [b.cx - 3.0, b.cz + 1.0],
      [b.cx + 3.0, b.cz + 1.0],
      [b.cx, b.cz]
    ];

    const previousArea = state.area;
    state.area = area;
    const safe = candidates.find(([x, z]) => !isBlocked(x, z));
    state.area = previousArea;
    return safe ? { x: safe[0], z: safe[1] } : { x: b.cx, z: nearDoorZ };
  }

  function ensurePlayerSafePosition() {
    if (state.area === 'world' || !areaBounds[state.area]) return false;
    if (!isBlocked(player.position.x, player.position.z)) return false;
    const safe = findSafeInteriorPosition(state.area);
    player.position.set(safe.x, 0, safe.z);
    playerVelocity.set(0, 0, 0);
    state.cameraReady = false;
    state.grounded = true;
    showToast('Moved you to a clear spot by the exit.', 2.2);
    return true;
  }

  function enterInterior(area, exteriorPoint) {
    const b = areaBounds[area];
    if (!b) return;
    state.returnPoint = exteriorPoint || { x: player.position.x, z: player.position.z };
    state.seated = false;
    state.seat = null;
    state.area = area;
    interiorGroups[area].visible = true;
    interiorLight.position.set(b.cx, 6.3, b.cz);
    interiorLight.visible = true;
    const spawn = findSafeInteriorPosition(area);
    player.position.set(spawn.x, 0, spawn.z);
    playerVelocity.set(0, 0, 0);
    state.yaw = 0;
    state.pitch = 0.05;
    state.cameraReady = false;
    state.grounded = true;
    updateLocationName();
    showToast(`Welcome to ${AREA_NAMES[area]}.`, 2.2);
  }

  function exitInterior() {
    const point = state.returnPoint || { x: 0, z: 10 };
    const previousArea = state.area;
    if (interiorGroups[previousArea]) interiorGroups[previousArea].visible = false;
    state.area = 'world';
    state.seated = false;
    state.seat = null;
    interiorLight.visible = false;
    player.position.set(point.x, terrainHeight(point.x, point.z), point.z);
    playerVelocity.set(0, 0, 0);
    state.returnPoint = null;
    state.yaw = Math.PI;
    state.pitch = 0.08;
    state.cameraReady = false;
    state.grounded = true;
    updateLocationName();
    showToast('Back outside in Toon Valley.', 1.8);
  }

  // ---------- Quality ----------
  function resizeRenderer() {
    const q = CONFIG[state.quality];
    const ratio = Math.min(devicePixelRatio || 1, q.pixelRatio * state.pixelRatioScale);
    renderer.setPixelRatio(Math.max(q.minPixelRatio, ratio));
    renderer.setSize(innerWidth, innerHeight, false);
  }

  function applyQuality(name) {
    state.quality = name in CONFIG ? name : 'low';
    state.pixelRatioScale = 1;
    const q = CONFIG[state.quality];
    resizeRenderer();
    scene.fog.far = q.far;
    camera.far = q.far + 30;
    camera.updateProjectionMatrix();
    grassInstances.count = q.grass;
    trunkInstances.count = q.trees;
    crownInstances.count = q.trees;
    rockInstances.count = q.rocks;
    flowerInstances.count = q.flowers;
    lampPosts.count = q.lamps;
    lampOrbs.count = q.lamps;
    npcs.forEach((npc, i) => npc.visible = i < q.npcs);
    document.getElementById('quality-label').textContent = state.quality.toUpperCase();
    document.querySelectorAll('.quality').forEach((btn) => btn.classList.toggle('active', btn.dataset.quality === state.quality));
  }
  applyQuality(state.quality);

  // ---------- Input / UI ----------
  const hud = document.getElementById('hud');
  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const toast = document.getElementById('toast');
  const staminaFill = document.getElementById('stamina-fill');
  const fpsLabel = document.getElementById('fps');
  const interactionPrompt = document.getElementById('interaction-prompt');
  const locationName = document.getElementById('location-name');
  const mobileControls = document.getElementById('mobile-controls');

  if (DEVICE.touch) document.body.classList.add('touch-device');

  function updateLocationName() {
    locationName.textContent = AREA_NAMES[state.area] || 'TOON VALLEY';
  }
  updateLocationName();

  function showToast(message, seconds = 2.5) {
    toast.textContent = message;
    toast.classList.add('show');
    state.toastTimer = seconds;
  }

  function lockPointer() {
    if (!DEVICE.touch && renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
  }

  document.querySelectorAll('.quality').forEach((button) => {
    button.addEventListener('click', () => applyQuality(button.dataset.quality));
  });

  document.getElementById('play-button').addEventListener('click', () => {
    state.started = true;
    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    if (DEVICE.touch) {
      mobileControls.classList.remove('hidden');
      showToast('Left thumb moves. Drag the right side to look around.', 3.5);
    } else {
      lockPointer();
      showToast('Welcome to Toon Valley. The town has four buildings you can enter!', 3.5);
    }
  });

  document.getElementById('resume-button').addEventListener('click', lockPointer);
  renderer.domElement.addEventListener('click', () => {
    if (state.started && !DEVICE.touch && document.pointerLockElement !== renderer.domElement) lockPointer();
  });

  document.addEventListener('pointerlockchange', () => {
    if (DEVICE.touch) return;
    const locked = document.pointerLockElement === renderer.domElement;
    if (state.started) pauseScreen.classList.toggle('hidden', locked);
  });

  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    // Conventional mouse-look: right turns right; up tilts the view upward.
    state.yaw -= event.movementX * 0.0028;
    state.pitch = clamp(state.pitch + event.movementY * 0.0018, -0.22, 0.52);
  });

  document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space' && !event.repeat) state.jumpQueued = true;
    if (event.code === 'KeyC' && !event.repeat) {
      state.sprintToggle = !state.sprintToggle;
      showToast(state.sprintToggle ? 'Auto-run enabled.' : 'Auto-run disabled.', 1.4);
    }
    if (event.code === 'KeyQ' && !event.repeat) applyQuality(state.quality === 'medium' ? 'low' : 'medium');
    if (event.code === 'KeyE' && !event.repeat) interact();
  });
  document.addEventListener('keyup', (event) => { keys[event.code] = false; });

  function findNearestInteraction() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const item of interactables) {
      if (item.area !== state.area) continue;
      if (item.enabled && !item.enabled()) continue;
      const ix = item.object ? item.object.position.x : item.x;
      const iz = item.object ? item.object.position.z : item.z;
      const d = Math.hypot(player.position.x - ix, player.position.z - iz);
      if (d < item.radius && d < nearestDistance) {
        nearest = item;
        nearestDistance = d;
      }
    }
    return nearest;
  }

  function interact() {
    if (state.seated) {
      standUpFromSeat();
      return;
    }
    const nearest = findNearestInteraction();
    if (!nearest) {
      showToast('Nothing nearby to interact with.', 1.2);
      return;
    }
    if (nearest.action) nearest.action();
    else showToast(nearest.text, 3.0);
  }

  // Mobile joystick.
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  let joystickPointer = null;

  function updateJoystick(event) {
    const rect = joystickZone.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = Math.min(rect.width, rect.height) * 0.28;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = dx / len * max;
      dy = dy / len * max;
    }
    state.mobileMoveX = clamp(dx / max, -1, 1);
    state.mobileMoveY = clamp(-dy / max, -1, 1);
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  joystickZone.addEventListener('pointerdown', (event) => {
    joystickPointer = event.pointerId;
    joystickZone.setPointerCapture(event.pointerId);
    updateJoystick(event);
    event.preventDefault();
  });
  joystickZone.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointer) return;
    updateJoystick(event);
    event.preventDefault();
  });
  function resetJoystick(event) {
    if (joystickPointer !== null && event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    state.mobileMoveX = 0;
    state.mobileMoveY = 0;
    joystickKnob.style.transform = 'translate(0px, 0px)';
  }
  joystickZone.addEventListener('pointerup', resetJoystick);
  joystickZone.addEventListener('pointercancel', resetJoystick);

  // Right-side swipe camera.
  const lookPad = document.getElementById('look-pad');
  let lookPointer = null;
  let lookX = 0;
  let lookY = 0;
  lookPad.addEventListener('pointerdown', (event) => {
    lookPointer = event.pointerId;
    lookPad.setPointerCapture(event.pointerId);
    lookX = event.clientX;
    lookY = event.clientY;
    event.preventDefault();
  });
  lookPad.addEventListener('pointermove', (event) => {
    if (event.pointerId !== lookPointer) return;
    const dx = event.clientX - lookX;
    const dy = event.clientY - lookY;
    lookX = event.clientX;
    lookY = event.clientY;
    state.yaw -= dx * 0.0062;
    state.pitch = clamp(state.pitch + dy * 0.0042, -0.22, 0.52);
    event.preventDefault();
  });
  function endLook(event) {
    if (event.pointerId === lookPointer) lookPointer = null;
  }
  lookPad.addEventListener('pointerup', endLook);
  lookPad.addEventListener('pointercancel', endLook);

  const sprintButton = document.getElementById('mobile-sprint');
  const jumpButton = document.getElementById('mobile-jump');
  const interactButton = document.getElementById('mobile-interact');

  function setMobileSprint(active) {
    state.mobileSprint = Boolean(active);
    sprintButton.classList.toggle('active', state.mobileSprint);
    sprintButton.setAttribute('aria-pressed', String(state.mobileSprint));
    sprintButton.querySelector('small').textContent = state.mobileSprint ? 'RUNNING' : 'RUN';
  }

  sprintButton.addEventListener('click', (event) => {
    setMobileSprint(!state.mobileSprint);
    event.preventDefault();
  });
  jumpButton.addEventListener('click', (event) => {
    state.mobileJumpQueued = true;
    event.preventDefault();
  });
  interactButton.addEventListener('click', (event) => {
    interact();
    event.preventDefault();
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    resizeRenderer();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    state.pausedByVisibility = document.hidden;
    state.lastTime = performance.now();
  });

  // ---------- Animation ----------
  function animateCharacter(character, dt, speed01) {
    const data = character.userData;
    data.moving = damp(data.moving, speed01, 11, dt);
    data.walkPhase += dt * (3.0 + 8.0 * data.moving);
    const swing = Math.sin(data.walkPhase) * 0.7 * data.moving;
    data.legs[0].rotation.x = swing;
    data.legs[1].rotation.x = -swing;
    data.arms[0].rotation.x = -swing * 0.72;
    data.arms[1].rotation.x = swing * 0.72;
    data.bodyRoot.position.y = Math.abs(Math.sin(data.walkPhase * 2)) * 0.055 * data.moving;
    data.bodyRoot.rotation.z = Math.sin(data.walkPhase) * 0.025 * data.moving;
  }

  function updatePlayer(dt) {
    const keyboardForward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const keyboardSide = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const forwardInput = clamp(keyboardForward + state.mobileMoveY, -1, 1);
    const sideInput = clamp(keyboardSide + state.mobileMoveX, -1, 1);
    const inputMagnitude = Math.min(1, Math.hypot(forwardInput, sideInput));
    const hasInput = inputMagnitude > 0.04;

    if (state.seated) {
      const wantsToStand = hasInput || state.jumpQueued || state.mobileJumpQueued;
      if (wantsToStand) {
        state.jumpQueued = false;
        state.mobileJumpQueued = false;
        standUpFromSeat();
      } else {
        playerVelocity.set(0, 0, 0);
        state.stamina = Math.min(1, state.stamina + dt * 0.22);
        staminaFill.style.transform = `scaleX(${state.stamina.toFixed(3)})`;
        setSeatedPose();
        return;
      }
    }

    const forward = temp.v1.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = temp.v2.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const desired = temp.v3.set(0, 0, 0);
    desired.addScaledVector(forward, forwardInput).addScaledVector(right, sideInput);
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(inputMagnitude);

    const wantsSprint = keys.ShiftLeft || keys.ShiftRight || state.mobileSprint || state.sprintToggle;
    const sprinting = hasInput && wantsSprint && state.stamina > 0.02;
    const maxSpeed = sprinting ? 8.0 : 4.55;
    if (sprinting) state.stamina = Math.max(0, state.stamina - dt * 0.22);
    else state.stamina = Math.min(1, state.stamina + dt * (hasInput ? 0.09 : 0.16));
    staminaFill.style.transform = `scaleX(${state.stamina.toFixed(3)})`;

    const targetVX = desired.x * maxSpeed;
    const targetVZ = desired.z * maxSpeed;
    playerVelocity.x = damp(playerVelocity.x, targetVX, hasInput ? 12 : 8, dt);
    playerVelocity.z = damp(playerVelocity.z, targetVZ, hasInput ? 12 : 8, dt);

    if (hasInput) {
      const targetRotation = Math.atan2(desired.x, desired.z);
      let delta = ((targetRotation - player.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      player.rotation.y += delta * (1 - Math.exp(-14 * dt));
    }

    const oldX = player.position.x;
    const oldZ = player.position.z;
    const nextX = oldX + playerVelocity.x * dt;
    const nextZ = oldZ + playerVelocity.z * dt;
    if (!isBlocked(nextX, nextZ)) {
      player.position.x = nextX;
      player.position.z = nextZ;
    } else {
      if (!isBlocked(nextX, oldZ)) player.position.x = nextX;
      else playerVelocity.x *= -0.08;
      if (!isBlocked(player.position.x, nextZ)) player.position.z = nextZ;
      else playerVelocity.z *= -0.08;
    }

    const groundY = currentGroundHeight(player.position.x, player.position.z);
    const jumpRequested = state.jumpQueued || state.mobileJumpQueued;
    if (state.grounded && jumpRequested) {
      state.jumpVelocity = 7.4;
      state.grounded = false;
      state.jumpQueued = false;
      state.mobileJumpQueued = false;
      keys.Space = false;
    }
    if (!state.grounded) {
      state.jumpVelocity -= 19.5 * dt;
      player.position.y += state.jumpVelocity * dt;
      if (player.position.y <= groundY) {
        player.position.y = groundY;
        state.jumpVelocity = 0;
        state.grounded = true;
      }
    } else {
      player.position.y = damp(player.position.y, groundY, 22, dt);
    }

    animateCharacter(player, dt, clamp(Math.hypot(playerVelocity.x, playerVelocity.z) / 7.0, 0, 1));
  }

  function updateNPCs(dt) {
    if (state.area !== 'world') return;
    for (const npc of npcs) {
      if (!npc.visible) continue;
      // Very distant NPCs think less often; this keeps mobile CPU use predictable.
      const distanceToPlayer = npc.position.distanceToSquared(player.position);
      const updateScale = distanceToPlayer > 3600 ? 0.35 : 1;
      npc.userData.think -= dt * updateScale;
      if (npc.userData.think <= 0) {
        npc.userData.think = rand(2.0, 5.2);
        const angle = rand(0, Math.PI * 2);
        const radius = rand(2.5, 10.5);
        npc.userData.target.set(npc.userData.home.x + Math.sin(angle) * radius, npc.userData.home.y + Math.cos(angle) * radius);
      }
      const dx = npc.userData.target.x - npc.position.x;
      const dz = npc.userData.target.y - npc.position.z;
      const dist = Math.hypot(dx, dz);
      let moving = 0;
      if (dist > 0.45) {
        const step = Math.min(dist, npc.userData.speed * dt);
        const nx = npc.position.x + dx / dist * step;
        const nz = npc.position.z + dz / dist * step;
        if (!isBlockedForNPC(nx, nz)) {
          npc.position.x = nx;
          npc.position.z = nz;
          npc.position.y = terrainHeight(nx, nz);
          const targetRot = Math.atan2(dx, dz);
          let delta = ((targetRot - npc.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
          npc.rotation.y += delta * (1 - Math.exp(-8 * dt));
          moving = 0.65;
        } else {
          npc.userData.think = 0;
        }
      }
      animateCharacter(npc, dt, moving);
    }
  }

  function isBlockedForNPC(x, z) {
    if (Math.hypot(x, z) > CONFIG.worldRadius - 4) return true;
    for (const c of colliders) {
      if (c.area !== 'world') continue;
      if (c.type === 'circle') {
        const dx = x - c.x;
        const dz = z - c.z;
        const rr = 0.4 + c.radius;
        if (dx * dx + dz * dz < rr * rr) return true;
      } else if (Math.abs(x - c.x) < c.halfW + 0.4 && Math.abs(z - c.z) < c.halfD + 0.4) {
        return true;
      }
    }
    return false;
  }

  const cameraDesired = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  function updateCamera(dt) {
    const horizontalDistance = state.area === 'world' ? (DEVICE.touch ? 6.15 : 6.8) : 4.5;
    cameraDesired.set(
      player.position.x + Math.sin(state.yaw) * horizontalDistance,
      player.position.y + 3.3 + state.pitch * 5.2,
      player.position.z + Math.cos(state.yaw) * horizontalDistance
    );
    if (!state.cameraReady) {
      camera.position.copy(cameraDesired);
      state.cameraReady = true;
    } else {
      camera.position.lerp(cameraDesired, 1 - Math.exp(-10 * dt));
    }
    cameraLook.set(player.position.x, player.position.y + 1.35 + state.pitch * 0.8, player.position.z);
    camera.lookAt(cameraLook);
  }

  function updateWorld(dt) {
    if (state.area !== 'world') return;
    windmill.userData.blades.rotation.z += dt * 0.62;
    for (const cloud of clouds) {
      cloud.root.position.x += cloud.speed * dt;
      if (cloud.root.position.x > 215) cloud.root.position.x = -215;
    }
  }

  function updateUI(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) toast.classList.remove('show');
    }

    state.nearestInteractable = findNearestInteraction();
    if (state.nearestInteractable) {
      interactionPrompt.textContent = `${DEVICE.touch ? 'USE' : 'E'} · ${state.nearestInteractable.prompt}`;
      interactionPrompt.classList.add('show');
      interactButton.classList.add('ready');
    } else {
      interactionPrompt.classList.remove('show');
      interactButton.classList.remove('ready');
    }

    state.fpsTime += dt;
    state.fpsFrames++;
    if (state.fpsTime >= 1.2) {
      const fps = Math.round(state.fpsFrames / state.fpsTime);
      fpsLabel.textContent = `${fps} FPS`;
      const q = CONFIG[state.quality];
      const lowThreshold = q.targetFPS * 0.68;
      const highThreshold = q.targetFPS * 0.94;
      if (fps < lowThreshold) {
        state.lowFpsSamples++;
        state.highFpsSamples = 0;
      } else if (fps > highThreshold) {
        state.highFpsSamples++;
        state.lowFpsSamples = 0;
      } else {
        state.lowFpsSamples = 0;
        state.highFpsSamples = 0;
      }

      // Adaptive resolution changes only after repeated samples to avoid pulsing.
      if (state.lowFpsSamples >= 2 && state.pixelRatioScale > 0.62) {
        state.pixelRatioScale = Math.max(0.62, state.pixelRatioScale * 0.86);
        state.lowFpsSamples = 0;
        resizeRenderer();
      } else if (state.highFpsSamples >= 4 && state.pixelRatioScale < 1) {
        state.pixelRatioScale = Math.min(1, state.pixelRatioScale + 0.08);
        state.highFpsSamples = 0;
        resizeRenderer();
      }

      state.fpsTime = 0;
      state.fpsFrames = 0;
    }
  }

  function shouldRunGameplay() {
    if (!state.started || state.pausedByVisibility || state.modalOpen) return false;
    if (DEVICE.touch) return true;
    return document.pointerLockElement === renderer.domElement;
  }


  const extensionHooks = [];
  function registerUpdateHook(callback) {
    if (typeof callback === 'function') extensionHooks.push(callback);
    return () => {
      const index = extensionHooks.indexOf(callback);
      if (index >= 0) extensionHooks.splice(index, 1);
    };
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (state.pausedByVisibility) return;

    const q = CONFIG[state.quality];
    const minFrameTime = 1000 / q.targetFPS;
    if (now - state.lastRender < minFrameTime) return;
    state.lastRender = now;

    const dt = Math.min(0.05, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;

    if (shouldRunGameplay()) {
      updatePlayer(dt);
      updateNPCs(dt);
      updateWorld(dt);
      updateUI(dt);
    } else {
      updateWorld(dt);
      updateUI(dt);
    }
    for (const hook of extensionHooks) {
      try { hook(dt, now); } catch (error) { console.error('[Toon Valley extension]', error); }
    }
    updateCamera(dt);
    renderer.render(scene, camera);
  }


  window.ToonValley = Object.freeze({
    THREE,
    DEVICE,
    CONFIG,
    state,
    scene,
    camera,
    renderer,
    sun,
    interiorLight,
    materials,
    mat,
    outlineMaterial,
    outlinedMesh,
    unitBox,
    terrainHeight,
    currentGroundHeight,
    roadSegments,
    townBuildings,
    benchSeats,
    isBlocked,
    findSafeInteriorPosition,
    ensurePlayerSafePosition,
    player,
    playerVelocity,
    npcs,
    colliders,
    interactables,
    areaBounds,
    AREA_NAMES,
    interiorGroups,
    registerInteraction,
    addBoxCollider,
    addCircleCollider,
    createTownBuilding,
    createHouse,
    createCharacter,
    sitOnBench,
    standUpFromSeat,
    setMobileSprint,
    updatePlayer,
    createRoom,
    addInteriorBox,
    addInteriorTable,
    enterInterior,
    exitInterior,
    updateLocationName,
    showToast,
    applyQuality,
    registerUpdateHook,
    setModalOpen(value) { state.modalOpen = Boolean(value); },
    setAreaName(area, name) { AREA_NAMES[area] = name; updateLocationName(); }
  });
  window.dispatchEvent(new CustomEvent('toonvalley:ready', { detail: window.ToonValley }));

  requestAnimationFrame(loop);
})();
