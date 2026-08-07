(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV?.npcs?.length) return;

  const DESTINATION_DEFS = [
    ['City Hall', 'cityHall'],
    ['Sunny General Store', 'generalStore'],
    ['Storybook Library', 'library'],
    ['Cloud Nine Cafe', 'cafe'],
    ['Happy Home Furnishings', 'furnitureStore'],
    ['Toon Valley Clinic', 'clinic'],
    ['Fire Station', 'fireStation'],
    ['Post Office', 'postOffice'],
    ['Rainbow Elementary', 'school'],
    ['Moonbeam Theater', 'theater']
  ];

  function doorway(building) {
    const rotation = building.rotation || 0;
    const quarterTurn = Math.abs(Math.sin(rotation)) > 0.7;
    const depthHalf = quarterTurn ? building.halfW : building.halfD;
    const fx = Math.sin(rotation), fz = Math.cos(rotation);
    return {
      x: building.x + fx * (depthHalf + 1.25),
      z: building.z + fz * (depthHalf + 1.25),
      exitX: building.x + fx * (depthHalf + 2.8),
      exitZ: building.z + fz * (depthHalf + 2.8),
      rotation
    };
  }

  const destinations = DESTINATION_DEFS.map(([label, area]) => {
    const building = TV.townBuildings.find((b) => b.label === label);
    if (!building || !TV.areaBounds[area]) return null;
    return { label, area, building, ...doorway(building) };
  }).filter(Boolean);

  const states = new Map();
  const rand = (a, b) => a + Math.random() * (b - a);
  const distance2D = (a, x, z) => Math.hypot(a.position.x - x, a.position.z - z);

  function stateFor(npc) {
    if (!states.has(npc)) states.set(npc, {
      phase: 'outside', destination: null, cooldown: rand(5, 18), timer: 0,
      insideTarget: null, insideThink: 0, lastX: npc.position.x, lastZ: npc.position.z, stuck: 0
    });
    return states.get(npc);
  }

  function nearestDestinations(npc) {
    return [...destinations].sort((a, b) => distance2D(npc, a.x, a.z) - distance2D(npc, b.x, b.z));
  }

  function beginApproach(npc, dest) {
    const s = stateFor(npc);
    s.phase = 'approach';
    s.destination = dest;
    s.stuck = 0;
    npc.visible = TV.state.area === 'world';
    npc.userData.target.set(dest.x, dest.z);
    npc.userData.think = 999;
  }

  function enterBuilding(npc, dest) {
    const s = stateFor(npc);
    const b = TV.areaBounds[dest.area];
    const safe = TV.findSafeInteriorPosition(dest.area, { x: b.cx, z: b.cz + b.halfD - 2.2 });
    s.phase = 'inside';
    s.destination = dest;
    s.timer = rand(12, 34);
    s.insideThink = 0;
    s.insideTarget = null;
    s.stuck = 0;
    npc.userData.tvInsideArea = dest.area;
    npc.position.set(safe.x, 0, safe.z);
    npc.visible = TV.state.area === dest.area;
    npc.userData.think = 999;
  }

  function leaveBuilding(npc) {
    const s = stateFor(npc), dest = s.destination;
    if (!dest) return;
    npc.userData.tvInsideArea = null;
    npc.position.set(dest.exitX, TV.terrainHeight(dest.exitX, dest.exitZ), dest.exitZ);
    npc.rotation.y = dest.rotation + Math.PI;
    npc.visible = TV.state.area === 'world';
    npc.userData.target.set(dest.exitX + Math.sin(dest.rotation) * 5, dest.exitZ + Math.cos(dest.rotation) * 5);
    npc.userData.think = rand(1.5, 3.5);
    s.phase = 'outside';
    s.destination = null;
    s.timer = 0;
    s.insideTarget = null;
    s.cooldown = rand(14, 34);
    s.stuck = 0;
  }

  function chooseInsideTarget(dest) {
    const b = TV.areaBounds[dest.area];
    const marginX = Math.max(2.2, b.halfW - 2.2), marginZ = Math.max(2.4, b.halfD - 2.4);
    const candidates = Array.from({ length: 8 }, () => ({
      x: b.cx + rand(-marginX, marginX), z: b.cz + rand(-marginZ, marginZ)
    }));
    const previous = TV.state.area;
    TV.state.area = dest.area;
    const safe = candidates.find((p) => !TV.isBlocked(p.x, p.z));
    TV.state.area = previous;
    return safe || { x: b.cx, z: b.cz + 1.2 };
  }

  function updateInside(npc, s, dt) {
    const dest = s.destination;
    if (!dest) return leaveBuilding(npc);
    npc.visible = TV.state.area === dest.area;
    s.timer -= dt;
    s.insideThink -= dt;
    if (s.timer <= 0) return leaveBuilding(npc);

    if (!s.insideTarget || s.insideThink <= 0 || distance2D(npc, s.insideTarget.x, s.insideTarget.z) < 0.45) {
      s.insideTarget = chooseInsideTarget(dest);
      s.insideThink = rand(3.5, 7.5);
    }

    const dx = s.insideTarget.x - npc.position.x, dz = s.insideTarget.z - npc.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.08) {
      const step = Math.min(dist, (npc.userData.speed || 1.4) * 0.72 * dt);
      npc.position.x += dx / dist * step;
      npc.position.z += dz / dist * step;
      npc.rotation.y = Math.atan2(dx, dz);
      npc.position.y = 0;
      const d = npc.userData;
      if (d?.legs && d?.arms) {
        d.walkPhase += dt * 6;
        const swing = Math.sin(d.walkPhase) * 0.45;
        d.legs[0].rotation.x = swing; d.legs[1].rotation.x = -swing;
        d.arms[0].rotation.x = -swing * 0.65; d.arms[1].rotation.x = swing * 0.65;
      }
    }
  }

  function updateOutside(npc, s, dt) {
    npc.visible = TV.state.area === 'world';
    if (TV.state.area !== 'world') return;

    const moved = Math.hypot(npc.position.x - s.lastX, npc.position.z - s.lastZ);
    const targetDistance = npc.userData.target ? Math.hypot(npc.userData.target.x - npc.position.x, npc.userData.target.y - npc.position.z) : 0;
    s.stuck = moved < 0.012 && targetDistance > 1.1 ? s.stuck + dt : Math.max(0, s.stuck - dt * 2);
    s.lastX = npc.position.x; s.lastZ = npc.position.z;

    if (s.phase === 'approach') {
      const dest = s.destination;
      npc.userData.target.set(dest.x, dest.z);
      npc.userData.think = 999;
      if (distance2D(npc, dest.x, dest.z) < 1.45) return enterBuilding(npc, dest);
      if (s.stuck > 0.75) {
        // If the core wanderer reaches a facade instead of the doorway, turn the
        // collision into a real visit instead of letting the NPC walk forever.
        const near = nearestDestinations(npc).find((d) => distance2D(npc, d.x, d.z) < 8.5);
        if (near) beginApproach(npc, near);
        else { s.phase = 'outside'; s.destination = null; s.cooldown = rand(4, 9); npc.userData.think = 0; }
      }
      return;
    }

    if (s.stuck > 0.8) {
      const near = nearestDestinations(npc).find((d) => distance2D(npc, d.x, d.z) < 9.5);
      if (near) return beginApproach(npc, near);
      npc.userData.target.set(npc.userData.home.x + rand(-5, 5), npc.userData.home.y + rand(-5, 5));
      npc.userData.think = rand(1, 2.5);
      s.stuck = 0;
    }

    s.cooldown -= dt;
    if (s.cooldown <= 0 && destinations.length) {
      const nearby = nearestDestinations(npc).slice(0, 4);
      beginApproach(npc, nearby[Math.floor(Math.random() * nearby.length)]);
    }
  }

  function forceVisit(npcOrIndex, area) {
    const npc = typeof npcOrIndex === 'number' ? TV.npcs[npcOrIndex] : npcOrIndex;
    const dest = destinations.find((d) => d.area === area);
    if (!npc || !dest) return false;
    beginApproach(npc, dest);
    return true;
  }

  function forceEnter(npcOrIndex, area) {
    const npc = typeof npcOrIndex === 'number' ? TV.npcs[npcOrIndex] : npcOrIndex;
    const dest = destinations.find((d) => d.area === area);
    if (!npc || !dest) return false;
    enterBuilding(npc, dest);
    return true;
  }

  function forceExit(npcOrIndex) {
    const npc = typeof npcOrIndex === 'number' ? TV.npcs[npcOrIndex] : npcOrIndex;
    if (!npc || stateFor(npc).phase !== 'inside') return false;
    leaveBuilding(npc);
    return true;
  }

  TV.npcs.forEach(stateFor);
  TV.registerUpdateHook((dt) => {
    for (const npc of TV.npcs) {
      const s = stateFor(npc);
      if (s.phase === 'inside') updateInside(npc, s, dt);
      else updateOutside(npc, s, dt);
    }
  });

  window.ToonValleyNPCBuildingLife = Object.freeze({
    destinations: destinations.map((d) => ({ label: d.label, area: d.area, x: d.x, z: d.z })),
    counts: { destinations: destinations.length, npcs: TV.npcs.length },
    forceVisit, forceEnter, forceExit,
    getState(index) { const npc = TV.npcs[index]; const s = npc && stateFor(npc); return s ? { phase: s.phase, area: s.destination?.area || null } : null; }
  });
  console.info('Toon Valley NPC building life ready', window.ToonValleyNPCBuildingLife.counts);
})();
