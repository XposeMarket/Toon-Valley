(() => {
  'use strict';
  const TV = window.ToonValley;
  const Community = window.ToonValleyCommunityLife;
  const TrailLife = window.ToonValleyMountainTrailLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.registerInteraction || !TV?.terrainHeight || !Community?.trailPath?.length || !TrailLife?.getState) return;
  const { THREE } = TV;
  const path = Community.trailPath.map(([x, z]) => ({ x, z }));
  const root = new THREE.Group();
  root.name = 'mountain-trail-amenities';
  TV.scene.add(root);

  const wood = TV.materials?.wood || new THREE.MeshToonMaterial({ color: 0x8d633d });
  const dark = TV.materials?.dark || new THREE.MeshToonMaterial({ color: 0x29313a });
  const green = TV.materials?.green || new THREE.MeshToonMaterial({ color: 0x5e9e62 });
  const waterMat = new THREE.MeshToonMaterial({ color: 0x62cbe8, transparent: true, opacity: .78 });
  const shirtMat = new THREE.MeshToonMaterial({ color: 0xd5a54f });
  const skinMat = new THREE.MeshToonMaterial({ color: 0xefbb90 });
  const debrisMat = new THREE.MeshToonMaterial({ color: 0x8b623d });
  let elapsed = 0;

  function normalAt(index) {
    const a = path[Math.max(0, index - 1)], b = path[Math.min(path.length - 1, index + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.max(.001, Math.hypot(dx, dz));
    return { x: dz / len, z: -dx / len };
  }
  function face(group, dx, dz) { if (Math.abs(dx) + Math.abs(dz) > .001) group.rotation.y = Math.atan2(dx, dz); }

  const bendIndex = 8, bend = path[bendIndex], bendN = normalAt(bendIndex);
  const shelter = new THREE.Group(); shelter.name = 'foxglove-rest-shelter';
  shelter.position.set(bend.x + bendN.x * 5.8, TV.terrainHeight(bend.x + bendN.x * 5.8, bend.z + bendN.z * 5.8), bend.z + bendN.z * 5.8); root.add(shelter);
  const deck = TV.outlinedMesh(TV.unitBox, wood, 1.02); deck.scale.set(4.8, .16, 3.2); deck.position.y = .08; shelter.add(deck);
  for (const x of [-2, 2]) for (const z of [-1.25, 1.25]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, 2.7, 6), wood); post.position.set(x, 1.35, z); shelter.add(post); }
  const roof = TV.outlinedMesh(TV.unitBox, green, 1.02); roof.scale.set(5.4, .18, 3.8); roof.position.y = 2.75; roof.rotation.z = .05; shelter.add(roof);
  const bench = TV.outlinedMesh(TV.unitBox, wood, 1.02); bench.scale.set(3.1, .18, .55); bench.position.set(-.55, .58, -.55); shelter.add(bench);
  const back = TV.outlinedMesh(TV.unitBox, wood, 1.02); back.scale.set(3.1, .9, .14); back.position.set(-.55, 1.02, -.82); shelter.add(back);

  const pump = new THREE.Group(); pump.name = 'foxglove-water-pump'; pump.position.set(1.55, .18, .55); shelter.add(pump);
  const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(.24, .31, 1.28, 8), dark); pumpBody.position.y = .64; pump.add(pumpBody);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .68, 7), dark); spout.rotation.z = Math.PI / 2; spout.position.set(.28, .9, .08); pump.add(spout);
  const handlePivot = new THREE.Group(); handlePivot.position.set(-.16, 1.22, 0); pump.add(handlePivot);
  const handle = new THREE.Mesh(TV.unitBox, wood); handle.scale.set(.15, .12, .85); handle.position.z = .35; handlePivot.add(handle);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, .65, 6), waterMat); stream.position.set(.62, .54, .08); stream.visible = false; pump.add(stream);
  let pumping = 0, pumpUses = 0, hikerRefills = 0, lastHikerRefill = -99;
  const pumpWorld = new THREE.Vector3();
  function startPump() {
    if (pumping > 0) { TV.showToast('💧 The trail pump is already flowing.', 1.3); return; }
    pumping = 1.75; pumpUses += 1; stream.visible = true;
    TV.showToast('💧 Pumping fresh trail water…', 1.6);
  }
  TV.registerInteraction({ object: pump, radius: 2.8, area: 'world', prompt: 'Pump fresh water at Foxglove Bend', action: startPump });

  const maint = new THREE.Group(); maint.name = 'mountain-trail-maintenance-volunteer'; root.add(maint);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.62, .9, .38), shirtMat); torso.position.y = 1.05; maint.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27, 8, 6), skinMat); head.position.y = 1.72; maint.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.29, .34, .16, 8), green); hat.position.y = 1.96; maint.add(hat);
  const broomPivot = new THREE.Group(); broomPivot.position.set(.42, 1.3, .05); maint.add(broomPivot);
  const broom = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 1.75, 6), wood); broom.rotation.z = -.34; broom.position.y = -.6; broomPivot.add(broom);
  const bristles = new THREE.Mesh(new THREE.BoxGeometry(.42, .16, .2), debrisMat); bristles.position.set(.28, -1.34, 0); broomPivot.add(bristles);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.18, .62, 0); legR.position.set(.18, .62, 0);
  for (const leg of [legL, legR]) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.17, .65, .18), dark); mesh.position.y = -.32; leg.add(mesh); maint.add(leg); }

  const patrolIndices = [6, 7, 8, 9, 10];
  const debrisSpots = [7, 9].map((pathIndex, i) => {
    const p = path[pathIndex], n = normalAt(pathIndex), side = i ? -1 : 1;
    const x = p.x + n.x * 1.3 * side, z = p.z + n.z * 1.3 * side;
    const group = new THREE.Group(); group.name = `trail-debris-${i + 1}`; group.position.set(x, TV.terrainHeight(x, z) + .05, z); root.add(group);
    for (let j = 0; j < 5; j++) { const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(.11 + (j % 2) * .04, 0), debrisMat); leaf.position.set((j - 2) * .18, .08, ((j % 2) - .5) * .32); leaf.scale.y = .45; group.add(leaf); }
    return { group, x, z, cleared: false, respawn: 0, clears: 0 };
  });
  let patrolCursor = 0, patrolDirection = 1, maintenanceDistance = 0, maintenanceClears = 0, sweeping = 0, activeDebris = null;
  const start = path[patrolIndices[0]]; maint.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);

  function nearestUnclearedDebris() {
    let best = null, dist = Infinity;
    for (const d of debrisSpots) if (!d.cleared) { const nd = Math.hypot(d.x - maint.position.x, d.z - maint.position.z); if (nd < dist) { dist = nd; best = d; } }
    return best && dist < 5.2 ? best : null;
  }
  function updateMaintenance(dt) {
    for (const d of debrisSpots) {
      if (d.cleared) { d.respawn -= dt; if (d.respawn <= 0) { d.cleared = false; d.group.visible = true; } }
    }
    if (sweeping > 0 && activeDebris) {
      sweeping = Math.max(0, sweeping - dt); broomPivot.rotation.z = Math.sin(elapsed * 10) * .65; legL.rotation.x *= .7; legR.rotation.x *= .7;
      face(maint, activeDebris.x - maint.position.x, activeDebris.z - maint.position.z);
      if (sweeping === 0) { activeDebris.cleared = true; activeDebris.respawn = 26; activeDebris.clears += 1; activeDebris.group.visible = false; maintenanceClears += 1; activeDebris = null; }
      return;
    }
    broomPivot.rotation.z *= .75;
    const nearby = nearestUnclearedDebris();
    if (nearby) { activeDebris = nearby; sweeping = 1.65; return; }
    const targetIndex = patrolIndices[patrolCursor], target = path[targetIndex];
    const dx = target.x - maint.position.x, dz = target.z - maint.position.z, dist = Math.hypot(dx, dz), speed = 2.25;
    if (dist <= Math.max(.15, speed * dt)) {
      maint.position.x = target.x; maint.position.z = target.z;
      patrolCursor += patrolDirection;
      if (patrolCursor >= patrolIndices.length - 1 || patrolCursor <= 0) { patrolCursor = Math.max(0, Math.min(patrolIndices.length - 1, patrolCursor)); patrolDirection *= -1; }
    } else {
      const step = Math.min(dist, speed * dt), nx = dx / dist, nz = dz / dist;
      maint.position.x += nx * step; maint.position.z += nz * step; maintenanceDistance += step; face(maint, nx, nz);
      const stride = Math.sin(elapsed * 8) * .48; legL.rotation.x = stride; legR.rotation.x = -stride;
    }
    maint.position.y = TV.terrainHeight(maint.position.x, maint.position.z);
  }

  function updatePump(dt) {
    pump.getWorldPosition(pumpWorld);
    if (pumping > 0) {
      pumping = Math.max(0, pumping - dt); handlePivot.rotation.x = -.55 + Math.sin(elapsed * 8.5) * .42; stream.visible = true;
      if (pumping === 0) { handlePivot.rotation.x = 0; stream.visible = false; TV.showToast('💧 Water bottle filled. Ready for the climb.', 1.8); }
    } else { handlePivot.rotation.x *= .8; stream.visible = false; }
    const hikers = TrailLife.getState()?.hikers || [];
    for (const h of hikers) {
      if (h.activity === 'hydrate' && Math.hypot(h.x - pumpWorld.x, h.z - pumpWorld.z) < 10 && elapsed - lastHikerRefill > 2.5) {
        lastHikerRefill = elapsed; hikerRefills += 1; stream.visible = true;
      }
    }
  }

  function advance(dt = 0) {
    const step = Math.max(0, Math.min(.12, Number(dt) || 0)); elapsed += step; updatePump(step); updateMaintenance(step);
  }
  TV.registerUpdateHook(advance); advance(0);

  function getState() {
    pump.getWorldPosition(pumpWorld);
    return {
      shelterCount: 1, pumpCount: 1, maintenanceCount: 1, debrisCount: debrisSpots.length,
      pumping, pumpUses, hikerRefills, streamVisible: stream.visible,
      pump: { x: pumpWorld.x, y: pumpWorld.y, z: pumpWorld.z },
      maintenance: { x: maint.position.x, y: maint.position.y, z: maint.position.z, distance: maintenanceDistance, sweeping, terrainError: Math.abs(maint.position.y - TV.terrainHeight(maint.position.x, maint.position.z)) },
      maintenanceClears,
      debris: debrisSpots.map(d => ({ x: d.x, z: d.z, cleared: d.cleared, clears: d.clears, visible: d.group.visible }))
    };
  }
  window.ToonValleyMountainTrailAmenities = Object.freeze({ getState, advance, startPump, physicalPump: true, maintenancePatrol: true, boundedPopulation: true });
  console.info('Toon Valley Mountain Trail amenities ready', getState());
})();
