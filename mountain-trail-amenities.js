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
  const yellow = TV.materials?.yellow || new THREE.MeshToonMaterial({ color: 0xf1cd62 });
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

  const progressBoard = new THREE.Group(); progressBoard.name = 'foxglove-trail-progress-board'; progressBoard.position.set(-1.72, .32, .67); shelter.add(progressBoard);
  const boardPanel = TV.outlinedMesh(TV.unitBox, wood, 1.02); boardPanel.scale.set(1.9, 1.2, .12); boardPanel.position.y = 1.05; progressBoard.add(boardPanel);
  const boardHeader = TV.outlinedMesh(TV.unitBox, green, 1.02); boardHeader.scale.set(1.55, .24, .15); boardHeader.position.set(0, 1.48, .1); progressBoard.add(boardHeader);
  const stampLights = [];
  for (let i = 0; i < 4; i++) {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .08, 10), dark);
    light.rotation.x = Math.PI / 2;
    light.position.set(-.57 + i * .38, .98, .09);
    progressBoard.add(light); stampLights.push(light);
  }
  let boardStage = 'idle', boardUpdates = 0;
  function readTrailProgress() {
    const s = Community.getState?.() || {};
    const visited = Array.isArray(s.trailVisited) ? s.trailVisited.length : 0;
    let stage = 'idle';
    if (s.trailDone) stage = 'done';
    else if (s.trailAwaitingSignoff) stage = 'signoff';
    else if (s.trailStarted) stage = 'active';
    return { stage, visited: Math.max(0, Math.min(4, visited)) };
  }
  function syncProgressBoard() {
    const next = readTrailProgress();
    if (next.stage !== boardStage) { boardStage = next.stage; boardUpdates += 1; }
    for (let i = 0; i < stampLights.length; i++) stampLights[i].material = i < next.visited ? yellow : dark;
    boardHeader.material = (next.stage === 'signoff' || next.stage === 'done') ? yellow : green;
    return next;
  }
  function inspectProgressBoard() {
    const p = syncProgressBoard();
    if (p.stage === 'idle') TV.showToast('🥾 Trail board: get a route card from the ranger station, then stamp Pine Gate → Foxglove Bend → Cloud Lookout → Sunset Rock.', 3.4);
    else if (p.stage === 'active') TV.showToast(`🥾 Trail board: ${p.visited}/4 stamps. Keep following the marked switchbacks.`, 2.7);
    else if (p.stage === 'signoff') TV.showToast('🏔️ Trail board: 4/4 stamps. Return to the ranger station for final sign-off.', 2.8);
    else TV.showToast('✅ Trail board: today’s route is signed off.', 2.4);
  }
  TV.registerInteraction({ object: progressBoard, radius: 2.8, area: 'world', prompt: 'Check Mountain Trail progress board', action: inspectProgressBoard });

  const wasteStation = new THREE.Group(); wasteStation.name = 'foxglove-trail-waste-station'; wasteStation.position.set(2.05, .18, -1.02); shelter.add(wasteStation);
  const bin = TV.outlinedMesh(TV.unitBox, dark, 1.02); bin.scale.set(.68, 1.02, .68); bin.position.y = .5; wasteStation.add(bin);
  const binLid = TV.outlinedMesh(TV.unitBox, green, 1.02); binLid.scale.set(.82, .12, .82); binLid.position.y = 1.06; wasteStation.add(binLid);
  const wasteWorld = new THREE.Vector3();

  const maint = new THREE.Group(); maint.name = 'mountain-trail-maintenance-volunteer'; root.add(maint);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.62, .9, .38), shirtMat); torso.position.y = 1.05; maint.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.27, 8, 6), skinMat); head.position.y = 1.72; maint.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.29, .34, .16, 8), green); hat.position.y = 1.96; maint.add(hat);
  const broomPivot = new THREE.Group(); broomPivot.position.set(.42, 1.3, .05); maint.add(broomPivot);
  const broom = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, 1.75, 6), wood); broom.rotation.z = -.34; broom.position.y = -.6; broomPivot.add(broom);
  const bristles = new THREE.Mesh(new THREE.BoxGeometry(.42, .16, .2), debrisMat); bristles.position.set(.28, -1.34, 0); broomPivot.add(bristles);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-.18, .62, 0); legR.position.set(.18, .62, 0);
  for (const leg of [legL, legR]) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.17, .65, .18), dark); mesh.position.y = -.32; leg.add(mesh); maint.add(leg); }
  const cleanupSack = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), debrisMat); cleanupSack.scale.set(.78, 1.18, .7); cleanupSack.position.set(-.42, .92, .04); cleanupSack.visible = false; maint.add(cleanupSack);

  const patrolIndices = [6, 7, 8, 9, 10];
  const debrisSpots = [7, 9].map((pathIndex, i) => {
    const p = path[pathIndex], n = normalAt(pathIndex), side = i ? -1 : 1;
    const x = p.x + n.x * 1.3 * side, z = p.z + n.z * 1.3 * side;
    const group = new THREE.Group(); group.name = `trail-debris-${i + 1}`; group.position.set(x, TV.terrainHeight(x, z) + .05, z); root.add(group);
    for (let j = 0; j < 5; j++) { const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(.11 + (j % 2) * .04, 0), debrisMat); leaf.position.set((j - 2) * .18, .08, ((j % 2) - .5) * .32); leaf.scale.y = .45; group.add(leaf); }
    return { group, x, z, cleared: false, respawn: 0, clears: 0 };
  });
  let patrolCursor = 0, patrolDirection = 1, maintenanceDistance = 0, maintenanceClears = 0, maintenanceDisposals = 0, wasteCarryDistance = 0;
  let sweeping = 0, disposing = 0, carryingWaste = false, activeDebris = null;
  const start = path[patrolIndices[0]]; maint.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);

  function nearestUnclearedDebris() {
    let best = null, dist = Infinity;
    for (const d of debrisSpots) if (!d.cleared) { const nd = Math.hypot(d.x - maint.position.x, d.z - maint.position.z); if (nd < dist) { dist = nd; best = d; } }
    return best && dist < 5.2 ? best : null;
  }
  function walkMaintenanceToward(x, z, dt, speed = 2.25) {
    const dx = x - maint.position.x, dz = z - maint.position.z, dist = Math.hypot(dx, dz);
    if (dist <= Math.max(.15, speed * dt)) { maint.position.x = x; maint.position.z = z; maint.position.y = TV.terrainHeight(x, z); legL.rotation.x *= .55; legR.rotation.x *= .55; return 0; }
    const step = Math.min(dist, speed * dt), nx = dx / dist, nz = dz / dist;
    maint.position.x += nx * step; maint.position.z += nz * step; face(maint, nx, nz);
    const stride = Math.sin(elapsed * 8) * .48; legL.rotation.x = stride; legR.rotation.x = -stride;
    maint.position.y = TV.terrainHeight(maint.position.x, maint.position.z);
    return step;
  }
  function updateMaintenance(dt) {
    for (const d of debrisSpots) {
      if (d.cleared) { d.respawn -= dt; if (d.respawn <= 0) { d.cleared = false; d.group.visible = true; } }
    }
    wasteStation.getWorldPosition(wasteWorld);
    if (disposing > 0) {
      disposing = Math.max(0, disposing - dt); broomPivot.rotation.z *= .75; cleanupSack.scale.y = 1.18 + Math.sin(elapsed * 7) * .08;
      face(maint, wasteWorld.x - maint.position.x, wasteWorld.z - maint.position.z);
      if (disposing === 0) { carryingWaste = false; cleanupSack.visible = false; cleanupSack.scale.y = 1.18; maintenanceDisposals += 1; }
      return;
    }
    if (carryingWaste) {
      broomPivot.rotation.z *= .75; cleanupSack.visible = true;
      const step = walkMaintenanceToward(wasteWorld.x, wasteWorld.z, dt, 2.35); wasteCarryDistance += step; maintenanceDistance += step;
      if (step === 0 && Math.hypot(wasteWorld.x - maint.position.x, wasteWorld.z - maint.position.z) < .2) disposing = 1.05;
      return;
    }
    cleanupSack.visible = false;
    if (sweeping > 0 && activeDebris) {
      sweeping = Math.max(0, sweeping - dt); broomPivot.rotation.z = Math.sin(elapsed * 10) * .65; legL.rotation.x *= .7; legR.rotation.x *= .7;
      face(maint, activeDebris.x - maint.position.x, activeDebris.z - maint.position.z);
      if (sweeping === 0) {
        activeDebris.cleared = true; activeDebris.respawn = 30; activeDebris.clears += 1; activeDebris.group.visible = false; maintenanceClears += 1;
        carryingWaste = true; cleanupSack.visible = true; activeDebris = null;
      }
      return;
    }
    broomPivot.rotation.z *= .75;
    const nearby = nearestUnclearedDebris();
    if (nearby) { activeDebris = nearby; sweeping = 1.65; return; }
    const targetIndex = patrolIndices[patrolCursor], target = path[targetIndex];
    const step = walkMaintenanceToward(target.x, target.z, dt, 2.25); maintenanceDistance += step;
    if (step === 0) {
      patrolCursor += patrolDirection;
      if (patrolCursor >= patrolIndices.length - 1 || patrolCursor <= 0) { patrolCursor = Math.max(0, Math.min(patrolIndices.length - 1, patrolCursor)); patrolDirection *= -1; }
    }
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
    const step = Math.max(0, Math.min(.12, Number(dt) || 0)); elapsed += step; updatePump(step); updateMaintenance(step); syncProgressBoard();
  }
  TV.registerUpdateHook(advance); advance(0);

  function getState() {
    pump.getWorldPosition(pumpWorld); wasteStation.getWorldPosition(wasteWorld); const progress = readTrailProgress();
    return {
      shelterCount: 1, pumpCount: 1, progressBoardCount: 1, wasteStationCount: 1, maintenanceCount: 1, debrisCount: debrisSpots.length,
      pumping, pumpUses, hikerRefills, streamVisible: stream.visible,
      pump: { x: pumpWorld.x, y: pumpWorld.y, z: pumpWorld.z },
      progressBoard: { stage: progress.stage, visited: progress.visited, updates: boardUpdates, litStamps: stampLights.filter(m => m.material === yellow).length },
      wasteStation: { x: wasteWorld.x, y: wasteWorld.y, z: wasteWorld.z },
      maintenance: { x: maint.position.x, y: maint.position.y, z: maint.position.z, distance: maintenanceDistance, sweeping, disposing, carryingWaste, wasteCarryDistance, terrainError: Math.abs(maint.position.y - TV.terrainHeight(maint.position.x, maint.position.z)) },
      maintenanceClears, maintenanceDisposals,
      debris: debrisSpots.map(d => ({ x: d.x, z: d.z, cleared: d.cleared, clears: d.clears, visible: d.group.visible }))
    };
  }
  window.ToonValleyMountainTrailAmenities = Object.freeze({ getState, advance, startPump, inspectProgressBoard, physicalPump: true, physicalProgressBoard: true, maintenancePatrol: true, physicalWasteDisposal: true, boundedPopulation: true });
  console.info('Toon Valley Mountain Trail amenities ready', getState());
})();
