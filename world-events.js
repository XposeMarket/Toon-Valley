(() => {
  'use strict';

  const STORAGE_KEY = 'toon-valley-world-events-v2';
  const LEGACY_STORAGE_KEY = 'toon-valley-world-events-v1';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;

  const { THREE } = TV;
  const state = loadState();
  const forageNodes = [];
  const trailMarkers = [];
  const litterNodes = [];
  const birdSpots = [];

  function defaultState() {
    return { forageDay: 0, gathered: [], trailDay: 0, trailProgress: 0, cleanupDay: 0, cleaned: [], birdDay: 0, birdsSeen: [] };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}';
      return Object.assign(defaultState(), JSON.parse(saved));
    } catch (_) {
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Unable to persist Toon Valley world events', error);
    }
  }

  function currentDay() { return Life.getState().world.day; }

  function makeBerryBush(x, z, index) {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, .7, 6), TV.materials.brown || TV.mat(0x76523b));
    stem.position.y = .35;
    group.add(stem);
    for (let i = 0; i < 5; i++) {
      const leaf = TV.outlinedMesh(new THREE.SphereGeometry(.35, 6, 4), TV.materials.green || TV.mat(0x59a84f), 1.04);
      leaf.position.set(Math.cos(i * 1.26) * .34, .7 + (i % 2) * .18, Math.sin(i * 1.26) * .34);
      leaf.scale.y = .75;
      group.add(leaf);
    }
    for (let i = 0; i < 4; i++) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 4), TV.materials.red || TV.mat(0xd84a62));
      berry.position.set(Math.cos(i * 1.57) * .42, .82, Math.sin(i * 1.57) * .42);
      group.add(berry);
    }
    group.position.set(x, TV.terrainHeight(x, z), z);
    TV.scene.add(group);
    forageNodes.push({ group, index });
    TV.registerInteraction({ object: group, radius: 2.2, area: 'world', prompt: 'Gather wild berries', enabled: () => !state.gathered.includes(index), action: () => {
      if (state.gathered.includes(index)) return;
      state.gathered.push(index);
      group.visible = false;
      Life.addMoney(18, 'Wild berry forage');
      Life.emitProgress('explore', 1, { activity: 'forage' });
      TV.showToast(`🫐 Gathered berries · ${state.gathered.length}/${forageNodes.length}`, 2);
      persist();
    } });
  }

  function resetDailyForage() {
    const day = currentDay();
    if (state.forageDay === day) return;
    state.forageDay = day;
    state.gathered = [];
    forageNodes.forEach((entry) => { entry.group.visible = true; });
    persist();
  }

  function makeTrailMarker(x, z, index) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 1.4, 6), TV.materials.brown || TV.mat(0x76523b));
    post.position.y = .7;
    group.add(post);
    const sign = TV.outlinedMesh(TV.unitBox, TV.materials.yellow || TV.mat(0xf1c84b), 1.04);
    sign.scale.set(.75, .42, .12);
    sign.position.y = 1.38;
    group.add(sign);
    group.position.set(x, TV.terrainHeight(x, z), z);
    TV.scene.add(group);
    trailMarkers.push(group);
    TV.registerInteraction({ object: group, radius: 2.5, area: 'world', prompt: `Check trail marker ${index + 1}`, enabled: () => state.trailProgress === index, action: () => {
      if (state.trailProgress !== index) return;
      state.trailProgress += 1;
      TV.showToast(state.trailProgress < trailMarkers.length ? `🥾 Trail checkpoint ${state.trailProgress}/${trailMarkers.length}` : '🏅 Valley trail completed! +$120', 2.5);
      if (state.trailProgress >= trailMarkers.length) {
        Life.addMoney(120, 'Valley walking trail');
        Life.emitProgress('explore', 3, { activity: 'trail' });
      }
      persist();
    } });
  }

  function resetDailyTrail() {
    const day = currentDay();
    if (state.trailDay === day) return;
    state.trailDay = day;
    state.trailProgress = 0;
    persist();
  }

  function makeLitter(x, z, index) {
    const group = new THREE.Group();
    const paper = TV.outlinedMesh(TV.unitBox, TV.materials.white || TV.mat(0xf2efe5), 1.03);
    paper.scale.set(.32, .035, .24);
    paper.rotation.y = index * 1.7;
    paper.position.y = .04;
    group.add(paper);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .28, 8), TV.materials.blue || TV.mat(0x4f83c2));
    can.rotation.z = Math.PI * .5;
    can.position.set(.25, .1, -.12);
    group.add(can);
    group.position.set(x, TV.terrainHeight(x, z) + .02, z);
    TV.scene.add(group);
    litterNodes.push({ group, index });
    TV.registerInteraction({ object: group, radius: 2, area: 'world', prompt: 'Pick up litter', enabled: () => !state.cleaned.includes(index), action: () => {
      if (state.cleaned.includes(index)) return;
      state.cleaned.push(index);
      group.visible = false;
      Life.addMoney(8, 'Community cleanup');
      Life.emitProgress('help', 1, { activity: 'cleanup' });
      const finished = state.cleaned.length >= litterNodes.length;
      if (finished) {
        Life.addMoney(75, 'Clean Valley bonus');
        Life.emitProgress('help', 2, { activity: 'cleanup-complete' });
      }
      TV.showToast(finished ? '♻️ Valley cleanup complete! +$75 bonus' : `♻️ Litter collected · ${state.cleaned.length}/${litterNodes.length}`, 2.5);
      persist();
    } });
  }

  function resetDailyCleanup() {
    const day = currentDay();
    if (state.cleanupDay === day) return;
    state.cleanupDay = day;
    state.cleaned = [];
    litterNodes.forEach((entry) => { entry.group.visible = true; });
    persist();
  }

  function makeBirdSpot(x, z, index, species) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, 1.2, 6), TV.materials.brown || TV.mat(0x76523b));
    pole.position.y = .6;
    group.add(pole);
    const feeder = TV.outlinedMesh(new THREE.SphereGeometry(.22, 8, 6), TV.materials.red || TV.mat(0xd84a62), 1.04);
    feeder.position.y = 1.25;
    feeder.scale.y = 1.25;
    group.add(feeder);
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .65, 6), TV.materials.brown || TV.mat(0x76523b));
    perch.rotation.z = Math.PI * .5;
    perch.position.y = 1.08;
    group.add(perch);
    group.position.set(x, TV.terrainHeight(x, z), z);
    TV.scene.add(group);
    birdSpots.push({ group, index, species });
    TV.registerInteraction({ object: group, radius: 2.6, area: 'world', prompt: `Observe ${species}`, enabled: () => !state.birdsSeen.includes(index), action: () => {
      if (state.birdsSeen.includes(index)) return;
      state.birdsSeen.push(index);
      Life.emitProgress('explore', 1, { activity: 'birdwatching', species });
      const complete = state.birdsSeen.length >= birdSpots.length;
      if (complete) Life.addMoney(90, 'Valley bird survey');
      TV.showToast(complete ? '🐦 Bird survey complete! +$90' : `🐦 Logged ${species} · ${state.birdsSeen.length}/${birdSpots.length}`, 2.5);
      persist();
    } });
  }

  function resetDailyBirdwatching() {
    const day = currentDay();
    if (state.birdDay === day) return;
    state.birdDay = day;
    state.birdsSeen = [];
    persist();
  }

  [[-34, 67], [-58, 73], [26, 73], [73, 18], [82, -26], [-84, -18]].forEach((p, i) => makeBerryBush(p[0], p[1], i));
  [[-66, 78], [-92, 58], [-104, 22], [-88, -20], [-55, -48]].forEach((p, i) => makeTrailMarker(p[0], p[1], i));
  [[-15, 24], [18, 35], [42, 8], [11, -42], [-37, -31], [-72, 12]].forEach((p, i) => makeLitter(p[0], p[1], i));
  [[-44, 52, 'meadowlark'], [64, 42, 'bluebird'], [76, -38, 'woodpecker'], [-78, -34, 'barn owl']].forEach((p, i) => makeBirdSpot(p[0], p[1], i, p[2]));

  resetDailyForage();
  resetDailyTrail();
  resetDailyCleanup();
  resetDailyBirdwatching();
  forageNodes.forEach((entry) => { entry.group.visible = !state.gathered.includes(entry.index); });
  litterNodes.forEach((entry) => { entry.group.visible = !state.cleaned.includes(entry.index); });

  let accumulator = 0;
  TV.registerUpdateHook((dt) => {
    accumulator += dt;
    if (accumulator < 2) return;
    accumulator = 0;
    resetDailyForage();
    resetDailyTrail();
    resetDailyCleanup();
    resetDailyBirdwatching();
  });

  window.ToonValleyWorldEvents = {
    getState: () => JSON.parse(JSON.stringify(state)),
    counts: { forage: forageNodes.length, trail: trailMarkers.length, cleanup: litterNodes.length, birds: birdSpots.length }
  };

  console.info('Toon Valley world events ready', window.ToonValleyWorldEvents.counts);
})();
