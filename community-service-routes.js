(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-community-service-routes-v2';
  const LEGACY_KEY = 'toon-valley-community-service-routes-v1';
  const defaults = {
    lakeDay: -1, lakeStarted: false, lakeRingCollected: false, lakeVisited: [], lakeAwaitingSignoff: false, lakeDone: false,
    lanternDay: -1, lanternStarted: false, lanternCrateCollected: false, lanternVisited: [], lanternAwaitingSignoff: false, lanternDone: false
  };
  function readStoredState() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}';
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }
  const state = Object.assign({ ...defaults }, readStoredState());
  function normalizeVisited(value, max) {
    if (!Array.isArray(value)) return [];
    const ordered = [];
    for (const item of value) {
      if (!Number.isInteger(item) || item !== ordered.length || item < 0 || item >= max) break;
      ordered.push(item);
    }
    return ordered;
  }
  function normalizeState() {
    state.lakeVisited = normalizeVisited(state.lakeVisited, 3);
    state.lanternVisited = normalizeVisited(state.lanternVisited, 4);
    for (const key of ['lakeStarted','lakeRingCollected','lakeAwaitingSignoff','lakeDone','lanternStarted','lanternCrateCollected','lanternAwaitingSignoff','lanternDone']) state[key] = Boolean(state[key]);
    if (state.lakeDone) { state.lakeStarted = false; state.lakeAwaitingSignoff = false; state.lakeRingCollected = false; state.lakeVisited = [0,1,2]; }
    else {
      if (!state.lakeStarted) { state.lakeRingCollected = false; state.lakeVisited = []; state.lakeAwaitingSignoff = false; }
      if (!state.lakeRingCollected) { state.lakeVisited = []; state.lakeAwaitingSignoff = false; }
      state.lakeAwaitingSignoff = state.lakeRingCollected && state.lakeVisited.length === 3;
    }
    if (state.lanternDone) { state.lanternStarted = false; state.lanternAwaitingSignoff = false; state.lanternCrateCollected = false; state.lanternVisited = [0,1,2,3]; }
    else {
      if (!state.lanternStarted) { state.lanternCrateCollected = false; state.lanternVisited = []; state.lanternAwaitingSignoff = false; }
      if (!state.lanternCrateCollected) { state.lanternVisited = []; state.lanternAwaitingSignoff = false; }
      state.lanternAwaitingSignoff = state.lanternCrateCollected && state.lanternVisited.length === 4;
    }
  }
  normalizeState();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); localStorage.removeItem(LEGACY_KEY); } catch (_) {} };
  save();

  const root = new THREE.Group();
  root.name = 'community-service-routes';
  TV.scene.add(root);
  const makeBox = (x, y, z, sx, sy, sz, mat) => {
    const m = TV.outlinedMesh(TV.unitBox, mat, 1.02);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); root.add(m); return m;
  };
  const makeBeacon = color => {
    const g = new THREE.Group(); g.visible = false; root.add(g);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.16, .3, 4.7, 9, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .2, depthWrite: false }));
    beam.position.y = 2.65; g.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.86, .1, 6, 18), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .24; g.add(ring);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.34, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .98, depthWrite: false }));
    diamond.position.y = 5.1; g.add(diamond);
    return { g, ring, diamond };
  };
  const lakeBeacon = makeBeacon(0x41d9ff), lanternBeacon = makeBeacon(0xffb74a);
  const lakeKiosk = { name: 'Bluebell Lake safety kiosk', x: 77, z: -63 };
  const lakeRack = { name: 'dock life-ring rack', x: 85, z: -72 };
  const lakePosts = [
    { name: 'north shore marker', x: 72, z: -79 },
    { name: 'boathouse marker', x: 91, z: -76 },
    { name: 'south path marker', x: 88, z: -59 }
  ];
  const parkCart = { name: 'Sunshine Park maintenance cart', x: -69, z: 45 };
  const lanternCrate = { name: 'replacement battery crate', x: -73, z: 45 };
  const lanterns = [
    { name: 'west path lantern', x: -82, z: 46 },
    { name: 'playground lantern', x: -75, z: 58 },
    { name: 'pond path lantern', x: -61, z: 56 },
    { name: 'east gate lantern', x: -57, z: 43 }
  ];

  function makeLifeRing(parent, scale = 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.48 * scale, .11 * scale, 6, 16), new THREE.MeshToonMaterial({ color: 0xfff1d0 }));
    const stripeMat = new THREE.MeshToonMaterial({ color: 0xef5b4d });
    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.18 * scale, .19 * scale, .16 * scale), stripeMat);
      const a = i * Math.PI / 2; stripe.position.set(Math.cos(a) * .46 * scale, Math.sin(a) * .46 * scale, 0); stripe.rotation.z = a; ring.add(stripe);
    }
    parent.add(ring); return ring;
  }
  function makeCarryCrate(parent, scale = 1) {
    const crate = TV.outlinedMesh(TV.unitBox, TV.materials.wood, 1.03);
    crate.scale.set(.68 * scale, .48 * scale, .52 * scale); parent.add(crate);
    const batteryMat = new THREE.MeshToonMaterial({ color: 0x76d7ff });
    for (let i = 0; i < 3; i++) {
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(.08 * scale, .08 * scale, .3 * scale, 7), batteryMat);
      cell.rotation.z = Math.PI / 2; cell.position.set((i - 1) * .2 * scale, .3 * scale, 0); parent.add(cell);
    }
    return crate;
  }

  const kioskY = TV.terrainHeight(lakeKiosk.x, lakeKiosk.z), cartY = TV.terrainHeight(parkCart.x, parkCart.z);
  makeBox(lakeKiosk.x, kioskY + 1.3, lakeKiosk.z, 1.8, 2.5, .35, TV.materials.yellow);
  const rackVisual = makeBox(lakeRack.x, TV.terrainHeight(lakeRack.x, lakeRack.z) + .8, lakeRack.z, 1.4, 1.4, .45, TV.materials.wood);
  const rackRingRoot = new THREE.Group(); rackRingRoot.position.set(lakeRack.x, TV.terrainHeight(lakeRack.x, lakeRack.z) + 1.45, lakeRack.z + .28); rackRingRoot.rotation.y = Math.PI / 2; root.add(rackRingRoot); makeLifeRing(rackRingRoot, .9);
  makeBox(parkCart.x, cartY + .65, parkCart.z, 2.1, 1.05, 1.25, TV.materials.green || TV.materials.yellow);
  const crateVisual = makeBox(lanternCrate.x, TV.terrainHeight(lanternCrate.x, lanternCrate.z) + .45, lanternCrate.z, 1.1, .8, .9, TV.materials.wood);
  const postVisuals = lakePosts.map(p => {
    const y = TV.terrainHeight(p.x, p.z);
    makeBox(p.x, y + 1.05, p.z, .22, 2, .22, TV.materials.yellow);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(.28, 0), new THREE.MeshToonMaterial({ color: 0x62e477 })); cap.position.set(p.x, y + 2.24, p.z); cap.visible = false; root.add(cap); return cap;
  });
  const lanternBulbs = lanterns.map(p => {
    const y = TV.terrainHeight(p.x, p.z);
    makeBox(p.x, y + 1.35, p.z, .16, 2.7, .16, TV.materials.dark);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 6), new THREE.MeshToonMaterial({ color: 0x7d8287, emissive: 0x000000, emissiveIntensity: 0 })); lamp.position.set(p.x, y + 2.8, p.z); root.add(lamp); return lamp;
  });

  const carryRoot = new THREE.Group(); carryRoot.name = 'community-service-carried-prop'; carryRoot.position.set(.72, 1.15, .2); carryRoot.rotation.set(.1, .25, -.15); carryRoot.visible = false; TV.player.add(carryRoot);
  const carriedRing = new THREE.Group(); carryRoot.add(carriedRing); makeLifeRing(carriedRing, .75);
  const carriedCrate = new THREE.Group(); carryRoot.add(carriedCrate); carriedCrate.position.set(0, -.12, 0); makeCarryCrate(carriedCrate, .8);

  function currentDay() { return Life.getState().world.day; }
  function ensureLakeDay() {
    const d = currentDay(); if (state.lakeDay === d) return;
    state.lakeDay = d; state.lakeStarted = false; state.lakeRingCollected = false; state.lakeVisited = []; state.lakeAwaitingSignoff = false; state.lakeDone = false; save(); syncVisualState();
  }
  function ensureLanternDay() {
    const d = currentDay(); if (state.lanternDay === d) return;
    state.lanternDay = d; state.lanternStarted = false; state.lanternCrateCollected = false; state.lanternVisited = []; state.lanternAwaitingSignoff = false; state.lanternDone = false; save(); syncVisualState();
  }
  function lakeKioskAction() {
    ensureLakeDay();
    if (state.lakeDone) return TV.showToast('🛟 Today’s lake safety round is signed off. Check back tomorrow.', 2.6);
    if (!state.lakeStarted) { state.lakeStarted = true; save(); syncVisualState(); TV.showToast('🛟 Ranger: “Take the life ring from the dock rack, inspect all three shoreline markers, then bring the ring back here.”', 4); return; }
    if (state.lakeAwaitingSignoff) { state.lakeStarted = false; state.lakeAwaitingSignoff = false; state.lakeRingCollected = false; state.lakeDone = true; Life.addMoney(140, 'Bluebell Lake safety round'); Life.emitProgress('help', 2, { activity: 'lake-safety-round' }); save(); syncVisualState(); TV.showToast('✅ Lake safety round signed off · life ring returned · +$140', 3.4); return; }
    const next = !state.lakeRingCollected ? lakeRack.name : lakePosts[state.lakeVisited.length]?.name;
    TV.showToast(`🛟 Lake round ${state.lakeVisited.length}/${lakePosts.length}. Next: ${next || 'return to the safety kiosk'}.`, 3);
  }
  function collectLifeRing() {
    ensureLakeDay(); if (!state.lakeStarted || state.lakeDone || state.lakeRingCollected) return;
    state.lakeRingCollected = true; save(); syncVisualState(); TV.showToast('🛟 Life ring collected. It is now visibly carried while you inspect the shoreline markers in order.', 3.4);
  }
  function inspectLakePost(index) {
    ensureLakeDay(); if (!state.lakeStarted || !state.lakeRingCollected || state.lakeDone || state.lakeAwaitingSignoff || state.lakeVisited.length !== index) return;
    state.lakeVisited.push(index); Life.emitProgress('help', 1, { activity: 'lake-safety-check', stop: lakePosts[index].name });
    if (state.lakeVisited.length === lakePosts.length) { state.lakeAwaitingSignoff = true; TV.showToast('🛟 All shoreline markers checked. Carry the life ring back to the Bluebell Lake safety kiosk for sign-off.', 3.8); }
    else TV.showToast(`🛟 Checked ${lakePosts[index].name}. The marker is now tagged green. Next: ${lakePosts[state.lakeVisited.length].name}.`, 2.8);
    save(); syncVisualState();
  }
  function lanternCartAction() {
    ensureLanternDay();
    if (state.lanternDone) return TV.showToast('🏮 Today’s park lantern round is complete. Fresh batteries arrive tomorrow.', 2.6);
    if (!state.lanternStarted) { state.lanternStarted = true; save(); syncVisualState(); TV.showToast('🏮 Groundskeeper: “Grab the battery crate, service all four park lanterns in order, then bring the empty crate back.”', 4); return; }
    if (state.lanternAwaitingSignoff) { state.lanternStarted = false; state.lanternAwaitingSignoff = false; state.lanternCrateCollected = false; state.lanternDone = true; Life.addMoney(135, 'Sunshine Park lantern round'); Life.emitProgress('help', 2, { activity: 'park-lantern-round' }); save(); syncVisualState(); TV.showToast('✅ Lantern round signed off · empty crate returned · +$135', 3.4); return; }
    const next = !state.lanternCrateCollected ? lanternCrate.name : lanterns[state.lanternVisited.length]?.name;
    TV.showToast(`🏮 Lantern round ${state.lanternVisited.length}/${lanterns.length}. Next: ${next || 'return to the maintenance cart'}.`, 3);
  }
  function collectLanternCrate() {
    ensureLanternDay(); if (!state.lanternStarted || state.lanternDone || state.lanternCrateCollected) return;
    state.lanternCrateCollected = true; save(); syncVisualState(); TV.showToast('🔋 Battery crate collected and visibly carried. Service all four Sunshine Park lanterns in order.', 3.2);
  }
  function serviceLantern(index) {
    ensureLanternDay(); if (!state.lanternStarted || !state.lanternCrateCollected || state.lanternDone || state.lanternAwaitingSignoff || state.lanternVisited.length !== index) return;
    state.lanternVisited.push(index); Life.emitProgress('help', 1, { activity: 'park-lantern-service', stop: lanterns[index].name });
    if (state.lanternVisited.length === lanterns.length) { state.lanternAwaitingSignoff = true; TV.showToast('🏮 All four lanterns are glowing again. Return the empty battery crate to the maintenance cart for sign-off.', 3.8); }
    else TV.showToast(`🏮 Serviced ${lanterns[index].name}; it is glowing again. Next: ${lanterns[state.lanternVisited.length].name}.`, 2.8);
    save(); syncVisualState();
  }

  function syncVisualState() {
    const carryingLake = state.lakeStarted && state.lakeRingCollected && !state.lakeDone;
    const carryingLantern = state.lanternStarted && state.lanternCrateCollected && !state.lanternDone;
    rackRingRoot.visible = !state.lakeRingCollected && !state.lakeDone;
    rackVisual.visible = true;
    crateVisual.visible = !state.lanternCrateCollected && !state.lanternDone;
    carriedRing.visible = carryingLake;
    carriedCrate.visible = carryingLantern;
    carryRoot.visible = carryingLake || carryingLantern;
    postVisuals.forEach((cap, i) => { cap.visible = state.lakeDone || state.lakeVisited.includes(i); });
    lanternBulbs.forEach((lamp, i) => {
      const serviced = state.lanternDone || state.lanternVisited.includes(i);
      lamp.material.color.setHex(serviced ? 0xffdf57 : 0x7d8287);
      lamp.material.emissive.setHex(serviced ? 0xffa928 : 0x000000);
      lamp.material.emissiveIntensity = serviced ? .75 : 0;
    });
  }
  syncVisualState();

  TV.registerInteraction({ x: lakeKiosk.x, z: lakeKiosk.z, radius: 4.6, area: 'world', prompt: 'Bluebell Lake safety kiosk', action: lakeKioskAction });
  TV.registerInteraction({ x: lakeRack.x, z: lakeRack.z, radius: 4.2, area: 'world', prompt: 'Collect dock life ring', enabled: () => { ensureLakeDay(); return state.lakeStarted && !state.lakeDone && !state.lakeRingCollected; }, action: collectLifeRing });
  lakePosts.forEach((p, i) => TV.registerInteraction({ x: p.x, z: p.z, radius: 4.2, area: 'world', prompt: `Inspect ${p.name}`, enabled: () => { ensureLakeDay(); return state.lakeStarted && state.lakeRingCollected && !state.lakeDone && !state.lakeAwaitingSignoff && state.lakeVisited.length === i; }, action: () => inspectLakePost(i) }));
  TV.registerInteraction({ x: parkCart.x, z: parkCart.z, radius: 4.6, area: 'world', prompt: 'Sunshine Park maintenance cart', action: lanternCartAction });
  TV.registerInteraction({ x: lanternCrate.x, z: lanternCrate.z, radius: 4.2, area: 'world', prompt: 'Collect lantern battery crate', enabled: () => { ensureLanternDay(); return state.lanternStarted && !state.lanternDone && !state.lanternCrateCollected; }, action: collectLanternCrate });
  lanterns.forEach((p, i) => TV.registerInteraction({ x: p.x, z: p.z, radius: 4.2, area: 'world', prompt: `Service ${p.name}`, enabled: () => { ensureLanternDay(); return state.lanternStarted && state.lanternCrateCollected && !state.lanternDone && !state.lanternAwaitingSignoff && state.lanternVisited.length === i; }, action: () => serviceLantern(i) }));

  function currentTargets() {
    ensureLakeDay(); ensureLanternDay();
    let lake = null, lantern = null;
    if (state.lakeStarted && !state.lakeDone) lake = state.lakeAwaitingSignoff ? lakeKiosk : !state.lakeRingCollected ? lakeRack : lakePosts[state.lakeVisited.length] || null;
    if (state.lanternStarted && !state.lanternDone) lantern = state.lanternAwaitingSignoff ? parkCart : !state.lanternCrateCollected ? lanternCrate : lanterns[state.lanternVisited.length] || null;
    return { lake, lantern };
  }
  function placeBeacon(beacon, target, phase, offset) {
    const visible = Boolean(target && TV.state.started && TV.state.area === 'world'); beacon.g.visible = visible; if (!visible) return;
    const y = TV.terrainHeight(target.x, target.z); beacon.g.position.set(target.x, y + .03, target.z); beacon.ring.rotation.z = phase * .35 + offset; beacon.diamond.rotation.y = phase + offset; beacon.diamond.position.y = 5.1 + Math.sin(phase * 1.8 + offset) * .22;
  }
  let phase = 0, timer = null, disposed = false, lastTargets = { lake: null, lantern: null };
  function refresh() { phase += .09; lastTargets = currentTargets(); syncVisualState(); placeBeacon(lakeBeacon, lastTargets.lake, phase, 0); placeBeacon(lanternBeacon, lastTargets.lantern, phase, Math.PI / 2); }
  function schedule() {
    if (disposed) return; refresh(); const active = TV.state.started && TV.state.area === 'world' && (lastTargets.lake || lastTargets.lantern); timer = setTimeout(schedule, active ? 140 : 850);
  }
  function distance(target) { if (!target || TV.state.area !== 'world' || !TV.player?.position) return ''; return ` · ${Math.round(Math.hypot(TV.player.position.x - target.x, TV.player.position.z - target.z))}m`; }
  function getSummaries() {
    ensureLakeDay(); ensureLanternDay(); const targets = currentTargets();
    const lakeStatus = state.lakeDone ? 'DONE' : state.lakeAwaitingSignoff ? 'SIGN OFF' : state.lakeStarted ? `${state.lakeVisited.length}/${lakePosts.length}` : 'START';
    const lakeText = state.lakeDone ? 'Today’s shoreline inspection is signed off.' : !state.lakeStarted ? 'Visit the Bluebell Lake safety kiosk to begin a physical shoreline round.' : !state.lakeRingCollected ? `Collect the dock life ring before starting the inspection${distance(targets.lake)}.` : state.lakeAwaitingSignoff ? `Carry the visible life ring back to the safety kiosk for sign-off${distance(targets.lake)}.` : `Carry the visible life ring to ${targets.lake?.name || 'the next marker'} and inspect it${distance(targets.lake)}.`;
    const lanternStatus = state.lanternDone ? 'DONE' : state.lanternAwaitingSignoff ? 'SIGN OFF' : state.lanternStarted ? `${state.lanternVisited.length}/${lanterns.length}` : 'START';
    const lanternText = state.lanternDone ? 'Today’s park lantern service is signed off.' : !state.lanternStarted ? 'Visit the Sunshine Park maintenance cart to begin the lantern round.' : !state.lanternCrateCollected ? `Collect the replacement battery crate${distance(targets.lantern)}.` : state.lanternAwaitingSignoff ? `Return the visible empty battery crate to the maintenance cart for sign-off${distance(targets.lantern)}.` : `Carry the battery crate to ${targets.lantern?.name || 'the next lantern'} and restore its light${distance(targets.lantern)}.`;
    return [
      { icon: '🛟', title: 'Bluebell Lake Safety Round', done: state.lakeDone, status: lakeStatus, text: lakeText },
      { icon: '🏮', title: 'Sunshine Park Lantern Round', done: state.lanternDone, status: lanternStatus, text: lanternText }
    ];
  }
  function getVisualState() {
    return {
      carriedRing: carriedRing.visible,
      carriedCrate: carriedCrate.visible,
      rackRingVisible: rackRingRoot.visible,
      sourceCrateVisible: crateVisual.visible,
      checkedLakeMarkers: postVisuals.filter(v => v.visible).length,
      litLanterns: lanternBulbs.filter(v => v.material.emissiveIntensity > 0).length
    };
  }
  const priorUI = window.ToonValleySideQuestUI;
  if (priorUI?.getSummaries) window.ToonValleySideQuestUI = Object.freeze({ ...priorUI, getSummaries: () => [...priorUI.getSummaries(), ...getSummaries()] });
  window.ToonValleyCommunityServiceRoutes = Object.freeze({
    active: true, markerCount: 2, physicalCarryProps: true, persistentServiceVisuals: true, stateNormalization: true,
    lakePosts, lanterns, lakeKiosk, lakeRack, parkCart, lanternCrate,
    getState: () => ({ ...state, lakeVisited: [...state.lakeVisited], lanternVisited: [...state.lanternVisited] }),
    getTargets: () => ({ ...lastTargets }), getSummaries, getVisualState, refresh, syncVisualState, lakeKioskAction, collectLifeRing, inspectLakePost, lanternCartAction, collectLanternCrate, serviceLantern,
    dispose: () => { disposed = true; if (timer) clearTimeout(timer); if (carryRoot.parent) carryRoot.parent.remove(carryRoot); }
  });
  schedule();
  console.info('Toon Valley community service routes ready', { lakeStops: lakePosts.length, lanternStops: lanterns.length, markers: 2, physicalCarryProps: true, persistentServiceVisuals: true });
})();