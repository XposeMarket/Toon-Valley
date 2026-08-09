(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  const Transit = window.ToonValleyTransit;
  if (!TV || !Life || !Transit?.stops?.length) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-transit-stewardship-v1';
  const defaults = { day: -1, started: false, toolkitCollected: false, serviced: [], awaitingSignoff: false, done: false };
  function readState() {
    try { const parsed = JSON.parse(localStorage.getItem(KEY) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; }
    catch (_) { return {}; }
  }
  const state = Object.assign({ ...defaults }, readState());
  function normalizeServiced(value) {
    if (!Array.isArray(value)) return [];
    const ordered = [];
    for (const item of value) {
      if (!Number.isInteger(item) || item !== ordered.length || item < 0 || item >= Transit.stops.length) break;
      ordered.push(item);
    }
    return ordered;
  }
  function normalizeState() {
    state.started = Boolean(state.started); state.toolkitCollected = Boolean(state.toolkitCollected); state.awaitingSignoff = Boolean(state.awaitingSignoff); state.done = Boolean(state.done);
    state.serviced = normalizeServiced(state.serviced);
    if (state.done) { state.started = false; state.toolkitCollected = false; state.awaitingSignoff = false; state.serviced = Transit.stops.map((_, i) => i); }
    else if (!state.started) { state.toolkitCollected = false; state.serviced = []; state.awaitingSignoff = false; }
    else if (!state.toolkitCollected) { state.serviced = []; state.awaitingSignoff = false; }
    else state.awaitingSignoff = state.serviced.length === Transit.stops.length;
  }
  normalizeState();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
  save();

  const root = new THREE.Group(); root.name = 'transit-stewardship-life'; TV.scene.add(root);
  const stewardCart = { name: 'Town Square transit steward cart', x: 10.5, z: -11.5 };
  const toolkitSpot = { name: 'transit toolkit', x: 7.5, z: -11.5 };
  const panels = Transit.stops.map((s, i) => ({ name: `${s.name} shelter service panel`, stopName: s.name, x: s.x + (i % 2 ? -3.2 : 3.2), z: s.z + (i < 2 ? 2.6 : -2.6) }));
  const matCart = TV.mat(0x4d91d8), matPanel = TV.mat(0xf4df9c), matDone = TV.mat(0x5fd578), matLamp = TV.mat(0xffd35a);
  const makeBox = (x, y, z, sx, sy, sz, mat) => { const m = TV.outlinedMesh(TV.unitBox, mat, 1.025); m.scale.set(sx, sy, sz); m.position.set(x, y, z); root.add(m); return m; };
  makeBox(stewardCart.x, TV.terrainHeight(stewardCart.x, stewardCart.z) + .65, stewardCart.z, 1.8, 1.1, 1.2, matCart);
  const toolkitSource = makeBox(toolkitSpot.x, TV.terrainHeight(toolkitSpot.x, toolkitSpot.z) + .42, toolkitSpot.z, .95, .62, .78, TV.materials.wood);
  const panelVisuals = panels.map(p => {
    const y = TV.terrainHeight(p.x, p.z);
    const post = makeBox(p.x, y + 1.05, p.z, .18, 2, .18, TV.materials.dark);
    const board = makeBox(p.x, y + 1.72, p.z, .92, .72, .16, matPanel);
    const tick = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshToonMaterial({ color: 0x5fd578 })); tick.position.set(p.x, y + 2.45, p.z); tick.visible = false; root.add(tick);
    return { post, board, tick };
  });

  const carryRoot = new THREE.Group(); carryRoot.name = 'transit-steward-toolkit'; carryRoot.position.set(.7, 1.08, .18); carryRoot.rotation.set(.08, .2, -.12); carryRoot.visible = false; TV.player.add(carryRoot);
  const carryBox = TV.outlinedMesh(TV.unitBox, TV.materials.wood, 1.03); carryBox.scale.set(.58, .4, .46); carryRoot.add(carryBox);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.24, .055, 5, 10, Math.PI), new THREE.MeshToonMaterial({ color: 0x34383f })); handle.rotation.z = Math.PI; handle.position.y = .42; carryRoot.add(handle);
  for (const x of [-.18, .18]) { const tool = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .5, 6), new THREE.MeshToonMaterial({ color: x < 0 ? 0xffd35a : 0x76d7ff })); tool.position.set(x, .18, 0); carryRoot.add(tool); }

  const beacon = new THREE.Group(); beacon.visible = false; root.add(beacon);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.15, .28, 4.5, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x64d7ff, transparent: true, opacity: .2, depthWrite: false })); beam.position.y = 2.55; beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.78, .09, 6, 18), new THREE.MeshBasicMaterial({ color: 0x64d7ff, transparent: true, opacity: .92, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = .2; beacon.add(ring);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.31, 0), new THREE.MeshBasicMaterial({ color: 0x64d7ff })); diamond.position.y = 4.9; beacon.add(diamond);

  function makeCommuter(stop, index) {
    const g = new THREE.Group(); g.name = `transit-commuter-${stop.name}-${index}`; root.add(g);
    const palette = [0xf07b68, 0x6b8ff5, 0x6bc58a, 0xb57be8];
    const bodyMat = new THREE.MeshToonMaterial({ color: palette[(index + Transit.stops.indexOf(stop)) % palette.length] });
    const skin = new THREE.MeshToonMaterial({ color: 0xf2c39d });
    const dark = new THREE.MeshToonMaterial({ color: 0x34383f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.46, .72, .28), bodyMat); body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), skin); head.position.y = 1.62; g.add(head);
    for (const x of [-.13, .13]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .55, .14), dark); leg.position.set(x, .42, 0); g.add(leg); }
    g.userData.stop = stop; g.userData.slot = index; g.userData.boarded = false; g.userData.cooldown = 0; g.userData.baseOffset = { x: (index ? .9 : -.55), z: -1.55 - index * .18 };
    return g;
  }
  const commuters = Transit.stops.flatMap(stop => [makeCommuter(stop, 0), makeCommuter(stop, 1)]);
  const arrivalLamps = Transit.stops.map(stop => {
    const y = TV.terrainHeight(stop.x, stop.z);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 7, 6), new THREE.MeshToonMaterial({ color: 0x75808a, emissive: 0x000000, emissiveIntensity: 0 }));
    lamp.position.set(stop.x - 1.5, y + 2.96, stop.z); root.add(lamp); return lamp;
  });

  function currentDay() { return Life.getState().world.day; }
  function ensureDay() {
    const day = currentDay(); if (state.day === day) return;
    state.day = day; state.started = false; state.toolkitCollected = false; state.serviced = []; state.awaitingSignoff = false; state.done = false; save(); syncVisuals();
  }
  function cartAction() {
    ensureDay();
    if (state.done) return TV.showToast('🚌 Today’s shuttle shelter round is signed off. Check back tomorrow.', 2.7);
    if (!state.started) { state.started = true; save(); syncVisuals(); TV.showToast('🧰 Transit steward: “Take the toolkit, service all four shuttle shelters in route order, then bring it back for sign-off.”', 4.2); return; }
    if (state.awaitingSignoff) { state.started = false; state.toolkitCollected = false; state.awaitingSignoff = false; state.done = true; Life.addMoney(160, 'Shuttle stop steward round'); Life.emitProgress('help', 2, { activity: 'transit-steward-round' }); save(); syncVisuals(); TV.showToast('✅ Shuttle shelter round signed off · toolkit returned · +$160', 3.5); return; }
    const target = !state.toolkitCollected ? toolkitSpot.name : panels[state.serviced.length]?.name || stewardCart.name;
    TV.showToast(`🚌 Shelter round ${state.serviced.length}/${panels.length}. Next: ${target}.`, 3);
  }
  function collectToolkit() {
    ensureDay(); if (!state.started || state.done || state.toolkitCollected) return;
    state.toolkitCollected = true; save(); syncVisuals(); TV.showToast('🧰 Toolkit collected. It is visibly carried while you service each real shuttle stop.', 3.2);
  }
  function servicePanel(index) {
    ensureDay();
    if (!state.started || !state.toolkitCollected || state.done || state.awaitingSignoff || state.serviced.length !== index) return;
    state.serviced.push(index); Life.emitProgress('help', 1, { activity: 'transit-stop-service', stop: panels[index].stopName });
    if (state.serviced.length === panels.length) { state.awaitingSignoff = true; TV.showToast('🚌 All four shelters serviced. Carry the toolkit back to the Town Square transit steward cart for sign-off.', 3.8); }
    else TV.showToast(`🧰 ${panels[index].stopName} shelter serviced. Next: ${panels[state.serviced.length].stopName}.`, 2.8);
    save(); syncVisuals();
  }
  function syncVisuals() {
    toolkitSource.visible = state.started && !state.toolkitCollected && !state.done;
    carryRoot.visible = state.started && state.toolkitCollected && !state.done;
    panelVisuals.forEach((v, i) => { const done = state.done || state.serviced.includes(i); v.tick.visible = done; v.board.material = done ? matDone : matPanel; });
  }
  syncVisuals();

  TV.registerInteraction({ x: stewardCart.x, z: stewardCart.z, radius: 3.2, area: 'world', prompt: 'Transit steward cart', action: cartAction });
  TV.registerInteraction({ x: toolkitSpot.x, z: toolkitSpot.z, radius: 2.8, area: 'world', prompt: 'Collect transit toolkit', enabled: () => { ensureDay(); return state.started && !state.done && !state.toolkitCollected; }, action: collectToolkit });
  panels.forEach((p, i) => TV.registerInteraction({ x: p.x, z: p.z, radius: 2.7, area: 'world', prompt: `Service ${p.stopName} shelter`, enabled: () => { ensureDay(); return state.started && state.toolkitCollected && !state.done && !state.awaitingSignoff && state.serviced.length === i; }, action: () => servicePanel(i) }));

  function currentTarget() {
    ensureDay(); if (!state.started || state.done) return null;
    if (state.awaitingSignoff) return stewardCart;
    if (!state.toolkitCollected) return toolkitSpot;
    return panels[state.serviced.length] || null;
  }
  function distanceTo(target) { if (!target || TV.state.area !== 'world' || !TV.player?.position) return ''; return ` · ${Math.round(Math.hypot(TV.player.position.x - target.x, TV.player.position.z - target.z))}m`; }
  function getSummaries() {
    ensureDay(); const target = currentTarget();
    const status = state.done ? 'DONE' : state.awaitingSignoff ? 'SIGN OFF' : state.started ? `${state.serviced.length}/${panels.length}` : 'START';
    const text = state.done ? 'Today’s shuttle shelters are serviced and signed off.' : !state.started ? 'Visit the Town Square transit steward cart to begin a hands-on shelter round.' : !state.toolkitCollected ? `Collect the transit toolkit${distanceTo(target)}.` : state.awaitingSignoff ? `Carry the toolkit back to the steward cart for final sign-off${distanceTo(target)}.` : `Travel to ${target?.stopName || 'the next shuttle stop'} and service its shelter panel${distanceTo(target)}.`;
    return [{ icon: '🚌', title: 'Shuttle Stop Steward Round', done: state.done, status, text }];
  }
  const priorUI = window.ToonValleySideQuestUI;
  if (priorUI?.getSummaries) window.ToonValleySideQuestUI = Object.freeze({ ...priorUI, getSummaries: () => [...priorUI.getSummaries(), ...getSummaries()] });

  let phase = 0;
  function updateCommuter(g, dt) {
    const stop = g.userData.stop, base = g.userData.baseOffset;
    const distBus = Math.hypot(Transit.bus.position.x - stop.routeX, Transit.bus.position.z - stop.routeZ);
    const atStop = Transit.stopped && distBus < 7;
    if (g.userData.boarded) {
      g.userData.cooldown = Math.max(0, g.userData.cooldown - dt);
      if (!atStop && distBus > 18 && g.userData.cooldown <= 0) { g.userData.boarded = false; g.visible = true; }
    }
    if (!g.userData.boarded && atStop) {
      const dx = Transit.bus.position.x - g.position.x, dz = Transit.bus.position.z - g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < .9) { g.userData.boarded = true; g.userData.cooldown = 5; g.visible = false; return; }
      const step = Math.min(d, dt * 3.2); if (d > .001) { g.position.x += dx / d * step; g.position.z += dz / d * step; }
      return;
    }
    if (!g.userData.boarded) {
      const x = stop.x + base.x, z = stop.z + base.z, y = TV.terrainHeight(x, z);
      g.position.x += (x - g.position.x) * Math.min(1, dt * 4); g.position.z += (z - g.position.z) * Math.min(1, dt * 4); g.position.y = y;
      g.rotation.y = stop.angle; g.position.y += Math.sin(phase * 1.7 + g.userData.slot) * .015;
    }
  }
  commuters.forEach(g => { const s = g.userData.stop, o = g.userData.baseOffset; g.position.set(s.x + o.x, TV.terrainHeight(s.x + o.x, s.z + o.z), s.z + o.z); g.rotation.y = s.angle; });

  let lastTarget = null;
  TV.registerUpdateHook(dt => {
    phase += dt;
    ensureDay(); syncVisuals();
    lastTarget = currentTarget();
    const showBeacon = Boolean(lastTarget && TV.state.started && TV.state.area === 'world'); beacon.visible = showBeacon;
    if (showBeacon) { const y = TV.terrainHeight(lastTarget.x, lastTarget.z); beacon.position.set(lastTarget.x, y + .03, lastTarget.z); ring.rotation.z = phase * .7; diamond.rotation.y = phase * 1.4; diamond.position.y = 4.9 + Math.sin(phase * 2.2) * .18; }
    Transit.stops.forEach((stop, i) => {
      const d = Math.hypot(Transit.bus.position.x - stop.routeX, Transit.bus.position.z - stop.routeZ), lamp = arrivalLamps[i];
      const near = d < 18, approaching = d < 35;
      lamp.material.color.setHex(near ? 0x63e281 : approaching ? 0xffd35a : 0x75808a);
      lamp.material.emissive.setHex(near ? 0x1d7a3b : approaching ? 0x6d4a00 : 0x000000);
      lamp.material.emissiveIntensity = near ? .9 : approaching ? .45 : 0;
      lamp.scale.setScalar(1 + (near ? Math.sin(phase * 5) * .12 : 0));
    });
    commuters.forEach(g => updateCommuter(g, dt));
  });

  function getVisualState() {
    return {
      toolkitSourceVisible: toolkitSource.visible, carriedToolkit: carryRoot.visible,
      servicedPanels: panelVisuals.filter(v => v.tick.visible).length,
      waitingCommuters: commuters.filter(g => g.visible && !g.userData.boarded).length,
      boardedCommuters: commuters.filter(g => g.userData.boarded).length,
      arrivalLampStates: arrivalLamps.map(l => l.material.emissiveIntensity)
    };
  }
  window.ToonValleyTransitStewardship = Object.freeze({
    active: true, physicalToolkit: true, animatedCommuters: true, arrivalFeedback: true, stateNormalization: true,
    stewardCart, toolkitSpot, panels, commuters, arrivalLamps,
    getState: () => ({ ...state, serviced: [...state.serviced] }), getTarget: () => lastTarget || currentTarget(), getSummaries, getVisualState,
    refresh: () => { ensureDay(); syncVisuals(); lastTarget = currentTarget(); }, cartAction, collectToolkit, servicePanel
  });
  console.info('Toon Valley transit stewardship ready', { stops: panels.length, commuters: commuters.length, physicalToolkit: true, arrivalFeedback: true });
})();