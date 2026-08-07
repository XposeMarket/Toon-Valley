(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-town-activities-v1';
  const fallback = { fishingDay: 0, caught: [], courierDay: 0, courierStep: 0 };
  let state;
  try { state = Object.assign({}, fallback, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (_) { state = { ...fallback }; }
  const fishingSpots = [];
  const courierStops = [];
  function day() { return Life.getState().world.day; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { console.warn('Unable to save town activities', error); } }
  function resetDaily() {
    const today = day();
    if (state.fishingDay !== today) { state.fishingDay = today; state.caught = []; fishingSpots.forEach((spot) => { spot.group.visible = true; }); }
    if (state.courierDay !== today) { state.courierDay = today; state.courierStep = 0; }
    save();
  }
  function makeFishingSpot(x, z, index) {
    const group = new THREE.Group();
    const dock = TV.outlinedMesh(TV.unitBox, TV.materials.brown || TV.mat(0x76523b), 1.03);
    dock.scale.set(1.5, .16, .8); dock.position.y = .08; group.add(dock);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 6), TV.materials.brown || TV.mat(0x76523b));
    post.position.set(.55, .72, 0); group.add(post);
    const bobber = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), TV.materials.red || TV.mat(0xd84a62));
    bobber.position.set(-.45, .2, -.55); group.add(bobber);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    const entry = { group, index }; fishingSpots.push(entry);
    TV.registerInteraction({ object: group, radius: 2.6, area: 'world', prompt: 'Cast fishing line', enabled: () => !state.caught.includes(index), action: () => {
      if (state.caught.includes(index)) return;
      state.caught.push(index); group.visible = false;
      const reward = 24 + ((index * 13 + day()) % 4) * 7;
      Life.addMoney(reward, 'Fresh catch');
      Life.emitProgress('explore', 1, { activity: 'fishing' });
      TV.showToast(`🎣 Fresh catch sold for $${reward} · ${state.caught.length}/${fishingSpots.length}`, 2.5);
      save();
    } });
  }
  function makeCourierStop(x, z, index, label) {
    const group = new THREE.Group();
    const box = TV.outlinedMesh(TV.unitBox, TV.materials.yellow || TV.mat(0xf1c84b), 1.04);
    box.scale.set(.45, .34, .38); box.position.y = .34; group.add(box);
    const band = new THREE.Mesh(TV.unitBox, TV.materials.red || TV.mat(0xd84a62));
    band.scale.set(.08, .36, .4); band.position.y = .34; group.add(band);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    courierStops.push({ group, index, label });
    TV.registerInteraction({ object: group, radius: 2.5, area: 'world', prompt: index === 0 ? 'Pick up courier route' : `Deliver parcel: ${label}`, enabled: () => state.courierStep === index, action: () => {
      if (state.courierStep !== index) return;
      state.courierStep += 1;
      if (index === 0) TV.showToast('📦 Route started · 3 deliveries remaining', 2.5);
      else {
        Life.addMoney(22, 'Courier delivery');
        Life.emitProgress('help', 1, { activity: 'courier', stop: label });
        const complete = state.courierStep >= courierStops.length;
        if (complete) { Life.addMoney(80, 'Courier route bonus'); TV.showToast('🚚 Courier route complete! +$80 bonus', 2.8); }
        else TV.showToast(`📦 Delivered to ${label} · ${courierStops.length - state.courierStep} remaining`, 2.4);
      }
      save();
    } });
  }
  [[-96, 66], [-108, 42], [91, -54], [74, -72]].forEach((p, i) => makeFishingSpot(p[0], p[1], i));
  [[4, 18, 'Post Office'], [32, 34, 'Maple House'], [-28, -22, 'Market Cottage'], [58, -18, 'Hilltop Home']].forEach((p, i) => makeCourierStop(p[0], p[1], i, p[2]));
  resetDaily();
  fishingSpots.forEach((spot) => { spot.group.visible = !state.caught.includes(spot.index); });
  let timer = 0;
  TV.registerUpdateHook((dt) => { timer += dt; if (timer >= 2) { timer = 0; resetDaily(); } });
  window.ToonValleyTownActivities = { getState: () => JSON.parse(JSON.stringify(state)), counts: { fishing: fishingSpots.length, courier: courierStops.length - 1 } };
  console.info('Toon Valley town activities ready', window.ToonValleyTownActivities.counts);
})();
