(() => {
  'use strict';
  const TV = window.ToonValley;
  const Community = window.ToonValleyCommunityLife;
  const TrailLife = window.ToonValleyMountainTrailLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !Community?.trailPath?.length || !TrailLife?.getState) return;
  const { THREE } = TV;
  const path = Community.trailPath.map(([x, z]) => ({ x, z }));
  const root = new THREE.Group();
  root.name = 'mountain-trail-ecology';
  TV.scene.add(root);

  const barkMat = TV.materials?.wood || new THREE.MeshToonMaterial({ color: 0x7d5838 });
  const pineMat = new THREE.MeshToonMaterial({ color: 0x4c8a58 });
  const squirrelMat = new THREE.MeshToonMaterial({ color: 0x9a6945 });
  const squirrelLight = new THREE.MeshToonMaterial({ color: 0xc59468 });
  const birdMats = [0x4f80b8, 0xd19b48, 0x8d6bb0, 0xc95c57].map(color => new THREE.MeshToonMaterial({ color }));
  const dark = TV.materials?.dark || new THREE.MeshToonMaterial({ color: 0x28313a });
  const squirrels = [], birds = [], habitats = [];
  let elapsed = 0, totalSquirrelEscapes = 0, totalTreeClimbs = 0, totalBirdFlushes = 0, totalBirdLandings = 0;

  function segmentNormal(index) {
    const a = path[Math.max(0, index - 1)], b = path[Math.min(path.length - 1, index + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.max(.001, Math.hypot(dx, dz));
    return { x: dz / len, z: -dx / len };
  }

  function makeHabitat(index, side) {
    const p = path[index], n = segmentNormal(index), x = p.x + n.x * 5.4 * side, z = p.z + n.z * 5.4 * side;
    const group = new THREE.Group(); group.name = `trail-pine-habitat-${habitats.length + 1}`;
    group.position.set(x, TV.terrainHeight(x, z), z); root.add(group);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.32, .42, 4.5, 7), barkMat); trunk.position.y = 2.25; group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.7 - i * .22, 2.7, 7), pineMat);
      crown.position.y = 3.5 + i * 1.05; group.add(crown);
    }
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, 2.2, 7), barkMat);
    log.rotation.z = Math.PI / 2; log.position.set(-n.x * 1.45, .35, -n.z * 1.45); group.add(log);
    const habitat = { group, x, z, index, side, n };
    habitats.push(habitat); return habitat;
  }

  [makeHabitat(3, 1), makeHabitat(7, -1), makeHabitat(12, 1)];

  function makeSquirrel(habitat, index) {
    const group = new THREE.Group(); group.name = `trail-squirrel-${index + 1}`;
    const body = new THREE.Mesh(new THREE.SphereGeometry(.28, 7, 5), squirrelMat); body.scale.set(.85, .75, 1.2); body.position.y = .3; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 7, 5), squirrelLight); head.position.set(0, .43, .28); group.add(head);
    const tail = new THREE.Mesh(new THREE.TorusGeometry(.29, .09, 5, 9, Math.PI * 1.45), squirrelMat); tail.position.set(0, .52, -.28); tail.rotation.x = Math.PI / 2; tail.rotation.z = -.7; group.add(tail);
    const startX = habitat.x - habitat.n.x * 1.6, startZ = habitat.z - habitat.n.z * 1.6;
    group.position.set(startX, TV.terrainHeight(startX, startZ), startZ); root.add(group);
    const state = { group, tail, habitat, mode: 'forage', targetSide: 1, escapeEvents: 0, climbEvents: 0, distance: 0, perch: 0, cooldown: 0 };
    squirrels.push(state); return state;
  }
  habitats.forEach(makeSquirrel);

  const perchIndices = [4, 8, 11, 14];
  function perchPoint(i) {
    const index = perchIndices[i % perchIndices.length], p = path[index], n = segmentNormal(index), side = i % 2 ? -1 : 1;
    const x = p.x + n.x * 4.2 * side, z = p.z + n.z * 4.2 * side;
    return { x, z, y: TV.terrainHeight(x, z) + 2.4, index };
  }
  const perches = perchIndices.map((_, i) => perchPoint(i));
  perches.forEach((p, i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 2.2, 6), barkMat); post.position.set(p.x, p.y - 1.1, p.z); root.add(post);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 1.15, 6), barkMat); branch.rotation.z = Math.PI / 2; branch.position.set(p.x, p.y - .08, p.z); root.add(branch);
  });

  function makeBird(index) {
    const p = perches[index];
    const group = new THREE.Group(); group.name = `trail-songbird-${index + 1}`;
    const body = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 5), birdMats[index % birdMats.length]); body.scale.set(.85, .8, 1.25); group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.13, 7, 5), dark); head.position.set(0, .12, .17); group.add(head);
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(.28, .035, .16), birdMats[index % birdMats.length]); leftWing.position.x = -.18; group.add(leftWing);
    const rightWing = leftWing.clone(); rightWing.position.x = .18; group.add(rightWing);
    group.position.set(p.x, p.y, p.z); root.add(group);
    const state = { group, leftWing, rightWing, perchIndex: index, mode: 'perched', flight: 0, cooldown: .5 + index * .25, start: null, target: null, flushEvents: 0, landingEvents: 0, distance: 0 };
    birds.push(state); return state;
  }
  perchIndices.forEach((_, i) => makeBird(i));

  function hikerPositions() { return TrailLife.getState()?.hikers || []; }
  function nearestThreat(x, z) {
    let best = Infinity;
    const player = TV.player?.position;
    if (player) best = Math.min(best, Math.hypot(player.x - x, player.z - z));
    for (const h of hikerPositions()) best = Math.min(best, Math.hypot(h.x - x, h.z - z));
    return best;
  }
  function face(group, dx, dz) { if (Math.abs(dx) + Math.abs(dz) > .001) group.rotation.y = Math.atan2(dx, dz); }

  function updateSquirrel(s, dt) {
    s.cooldown = Math.max(0, s.cooldown - dt);
    const threat = nearestThreat(s.group.position.x, s.group.position.z);
    if (s.mode === 'forage' && threat < 3.2 && s.cooldown <= 0) {
      s.mode = 'dash'; s.escapeEvents++; totalSquirrelEscapes++; s.cooldown = 3.2;
    }
    if (s.mode === 'dash') {
      const dx = s.habitat.x - s.group.position.x, dz = s.habitat.z - s.group.position.z, dist = Math.hypot(dx, dz);
      if (dist < .35) { s.mode = 'climb'; s.climbEvents++; totalTreeClimbs++; }
      else { const step = Math.min(dist, 5.2 * dt), nx = dx / dist, nz = dz / dist; s.group.position.x += nx * step; s.group.position.z += nz * step; s.distance += step; face(s.group, nx, nz); s.group.position.y = TV.terrainHeight(s.group.position.x, s.group.position.z); }
    } else if (s.mode === 'climb') {
      const ground = TV.terrainHeight(s.habitat.x, s.habitat.z), top = ground + 2.7;
      s.group.position.x += (s.habitat.x - s.group.position.x) * Math.min(1, dt * 8);
      s.group.position.z += (s.habitat.z - s.group.position.z) * Math.min(1, dt * 8);
      s.group.position.y = Math.min(top, s.group.position.y + 2.4 * dt);
      if (s.group.position.y >= top - .03) { s.mode = 'perched'; s.perch = 1.7; }
    } else if (s.mode === 'perched') {
      s.perch = Math.max(0, s.perch - dt);
      s.tail.rotation.z = -.7 + Math.sin(elapsed * 4.5) * .18;
      if (s.perch <= 0 && threat > 4.5) s.mode = 'descend';
    } else if (s.mode === 'descend') {
      const ground = TV.terrainHeight(s.habitat.x, s.habitat.z);
      s.group.position.y = Math.max(ground, s.group.position.y - 2.2 * dt);
      if (s.group.position.y <= ground + .02) { s.group.position.y = ground; s.mode = 'forage'; s.targetSide *= -1; }
    } else {
      const tx = s.habitat.x + s.habitat.n.x * 2.1 * s.targetSide, tz = s.habitat.z + s.habitat.n.z * 2.1 * s.targetSide;
      const dx = tx - s.group.position.x, dz = tz - s.group.position.z, dist = Math.hypot(dx, dz);
      if (dist < .18) s.targetSide *= -1;
      else { const step = Math.min(dist, 1.15 * dt), nx = dx / dist, nz = dz / dist; s.group.position.x += nx * step; s.group.position.z += nz * step; s.distance += step; face(s.group, nx, nz); }
      s.group.position.y = TV.terrainHeight(s.group.position.x, s.group.position.z);
      s.tail.rotation.z = -.7 + Math.sin(elapsed * 7 + s.habitat.index) * .22;
    }
  }

  function flushBird(b) {
    const next = (b.perchIndex + 1 + (b.perchIndex % 2)) % perches.length;
    b.start = b.group.position.clone(); b.target = perches[next]; b.perchIndex = next; b.mode = 'flying'; b.flight = 0;
    b.flushEvents++; totalBirdFlushes++;
  }
  function updateBird(b, dt) {
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.mode === 'perched') {
      b.leftWing.rotation.z *= .72; b.rightWing.rotation.z *= .72;
      if (b.cooldown <= 0 && nearestThreat(b.group.position.x, b.group.position.z) < 4.1) flushBird(b);
      return;
    }
    b.flight = Math.min(1, b.flight + dt / 1.55);
    const t = b.flight, eased = t * t * (3 - 2 * t), target = b.target;
    const x = THREE.MathUtils.lerp(b.start.x, target.x, eased), z = THREE.MathUtils.lerp(b.start.z, target.z, eased);
    const baseY = THREE.MathUtils.lerp(b.start.y, target.y, eased), y = baseY + Math.sin(Math.PI * t) * 4.1;
    const dx = x - b.group.position.x, dz = z - b.group.position.z;
    b.distance += Math.hypot(dx, dz); b.group.position.set(x, y, z); face(b.group, dx, dz);
    const flap = Math.sin(elapsed * 22) * .9; b.leftWing.rotation.z = .5 + flap; b.rightWing.rotation.z = -.5 - flap;
    if (t >= 1) { b.group.position.set(target.x, target.y, target.z); b.mode = 'perched'; b.cooldown = 2.4; b.landingEvents++; totalBirdLandings++; }
  }

  function advance(dt = 0) {
    const step = Math.max(0, Math.min(.12, Number(dt) || 0)); elapsed += step;
    squirrels.forEach(s => updateSquirrel(s, step)); birds.forEach(b => updateBird(b, step));
  }
  TV.registerUpdateHook(advance); advance(0);

  function getState() {
    return {
      habitatCount: habitats.length, squirrelCount: squirrels.length, birdCount: birds.length,
      totalSquirrelEscapes, totalTreeClimbs, totalBirdFlushes, totalBirdLandings,
      squirrels: squirrels.map(s => ({ name:s.group.name, mode:s.mode, x:s.group.position.x, y:s.group.position.y, z:s.group.position.z, distance:s.distance, escapeEvents:s.escapeEvents, climbEvents:s.climbEvents, terrainError:s.mode==='forage'||s.mode==='dash'?Math.abs(s.group.position.y-TV.terrainHeight(s.group.position.x,s.group.position.z)):0 })),
      birds: birds.map(b => ({ name:b.group.name, mode:b.mode, perchIndex:b.perchIndex, x:b.group.position.x, y:b.group.position.y, z:b.group.position.z, distance:b.distance, flushEvents:b.flushEvents, landingEvents:b.landingEvents }))
    };
  }
  window.ToonValleyMountainTrailEcology = Object.freeze({ active:true, bounded:true, canonicalQuestOwner:'ToonValleyCommunityLife', squirrelEscapeAndClimb:true, songbirdFlushAndLand:true, getState, advance });
})();
