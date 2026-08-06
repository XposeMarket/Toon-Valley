(() => {
  'use strict';

  const STORAGE_KEY = 'toon-valley-world-events-v1';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;

  const { THREE } = TV;
  const state = loadState();
  const forageNodes = [];
  const trailMarkers = [];

  function loadState() {
    try {
      return Object.assign({ forageDay: 0, gathered: [], trailDay: 0, trailProgress: 0 }, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (_) {
      return { forageDay: 0, gathered: [], trailDay: 0, trailProgress: 0 };
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentDay() {
    return Life.getState().world.day;
  }

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
    const entry = { group, index };
    forageNodes.push(entry);
    TV.registerInteraction({
      object: group,
      radius: 2.2,
      area: 'world',
      prompt: 'Gather wild berries',
      enabled: () => !state.gathered.includes(index),
      action: () => {
        if (state.gathered.includes(index)) return;
        state.gathered.push(index);
        group.visible = false;
        Life.addMoney(18, 'Wild berry forage');
        Life.emitProgress('explore', 1, { activity: 'forage' });
        TV.showToast(`🫐 Gathered berries · ${state.gathered.length}/${forageNodes.length}`, 2);
        persist();
      }
    });
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
    TV.registerInteraction({
      object: group,
      radius: 2.5,
      area: 'world',
      prompt: `Check trail marker ${index + 1}`,
      enabled: () => state.trailProgress === index,
      action: () => {
        if (state.trailProgress !== index) return;
        state.trailProgress += 1;
        TV.showToast(state.trailProgress < trailMarkers.length ? `🥾 Trail checkpoint ${state.trailProgress}/${trailMarkers.length}` : '🏅 Valley trail completed! +$120', 2.5);
        if (state.trailProgress >= trailMarkers.length) {
          Life.addMoney(120, 'Valley walking trail');
          Life.emitProgress('explore', 3, { activity: 'trail' });
        }
        persist();
      }
    });
  }

  function resetDailyTrail() {
    const day = currentDay();
    if (state.trailDay === day) return;
    state.trailDay = day;
    state.trailProgress = 0;
    persist();
  }

  [[-34, 67], [-58, 73], [26, 73], [73, 18], [82, -26], [-84, -18]].forEach((p, i) => makeBerryBush(p[0], p[1], i));
  [[-66, 78], [-92, 58], [-104, 22], [-88, -20], [-55, -48]].forEach((p, i) => makeTrailMarker(p[0], p[1], i));

  resetDailyForage();
  resetDailyTrail();
  forageNodes.forEach((entry) => { entry.group.visible = !state.gathered.includes(entry.index); });

  let accumulator = 0;
  TV.registerUpdateHook((dt) => {
    accumulator += dt;
    if (accumulator < 2) return;
    accumulator = 0;
    resetDailyForage();
    resetDailyTrail();
  });

  console.info('Toon Valley world events ready', { forageNodes: forageNodes.length, trailMarkers: trailMarkers.length });
})();