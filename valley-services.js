(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-services-v2';
  const LEGACY_KEY = 'toon-valley-services-v1';
  const defaults = { gardenDay: -1, watered: [], petDay: -1, petsFound: [], activePet: null };
  const gardenBeds = [];
  const lostPets = [];
  const petHomes = [];
  let state = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}');
      return {
        gardenDay: Number.isFinite(parsed.gardenDay) ? parsed.gardenDay : defaults.gardenDay,
        watered: Array.isArray(parsed.watered) ? parsed.watered.filter(Number.isInteger) : [],
        petDay: Number.isFinite(parsed.petDay) ? parsed.petDay : defaults.petDay,
        petsFound: Array.isArray(parsed.petsFound) ? parsed.petsFound.filter(Number.isInteger) : [],
        activePet: Number.isInteger(parsed.activePet) ? parsed.activePet : null
      };
    } catch (_) {
      return { ...defaults, watered: [], petsFound: [] };
    }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { console.warn('Unable to save valley services', error); } }
  function day() { return Life.getState().world.day; }

  function makeGardenBed(x, z, index) {
    const group = new THREE.Group();
    const soil = TV.outlinedMesh(TV.unitBox, TV.mat(0x6f4a32), 1.03);
    soil.scale.set(1.5, .12, .8); soil.position.y = .08; group.add(soil);
    for (let i = 0; i < 4; i++) {
      const plant = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 6), TV.materials.green || TV.mat(0x59a84f));
      plant.position.set(-.9 + i * .6, .38, 0); group.add(plant);
    }
    const can = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .38, 8), TV.materials.blue || TV.mat(0x4f83c2));
    can.position.set(1.15, .25, .45); can.rotation.z = -.2; group.add(can);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    gardenBeds.push({ group, index });
    TV.registerInteraction({
      object: group, radius: 2.5, area: 'world', prompt: 'Water community garden bed',
      enabled: () => !state.watered.includes(index),
      action: () => {
        if (state.watered.includes(index)) return;
        state.watered.push(index);
        Life.emitProgress('help', 1, { activity: 'garden' });
        const complete = state.watered.length === gardenBeds.length;
        if (complete) {
          Life.addMoney(120, 'Community garden caretaker shift');
          TV.showToast('🌱 All five beds are watered. Caretaker shift complete! +$120', 3);
        } else {
          TV.showToast(`💧 Bed watered · ${state.watered.length}/${gardenBeds.length}. Keep going.`, 2.3);
        }
        save();
      }
    });
  }

  function makePetModel(color) {
    const group = new THREE.Group();
    const coat = TV.mat(color);
    const body = TV.outlinedMesh(new THREE.SphereGeometry(.34, 8, 6), coat, 1.04);
    const head = TV.outlinedMesh(new THREE.SphereGeometry(.25, 8, 6), coat, 1.04);
    body.scale.set(1.15, .75, .75); body.position.y = .45; head.position.set(.35, .68, 0); group.add(body, head);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .55, 6), coat);
    tail.rotation.z = -1.05; tail.position.set(-.5, .58, 0); group.add(tail);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.09, .23, 5), coat);
      ear.position.set(.34, .94, side * .13); group.add(ear);
    }
    return group;
  }

  function makeOwner(color) {
    const owner = TV.createCharacter({
      body: TV.mat(color), skin: TV.materials.skin, hair: TV.materials.hair,
      legs: TV.materials.blue, shoes: TV.materials.dark
    }, true);
    owner.scale.setScalar(.88);
    return owner;
  }

  function makeQuestMarker() {
    const marker = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdf4f, fog: false });
    const bar = TV.outlinedMesh(TV.unitBox, mat, 1.04); bar.scale.set(.2, .9, .2); bar.position.y = 3.35; marker.add(bar);
    const dot = TV.outlinedMesh(new THREE.SphereGeometry(.2, 8, 6), mat, 1.04); dot.position.y = 2.35; marker.add(dot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.72, .08, 6, 18), mat); ring.rotation.x = Math.PI / 2; ring.position.y = 1.95; marker.add(ring);
    marker.userData.ring = ring;
    return marker;
  }

  function makeLostPet(x, z, index, name, color, home) {
    const group = makePetModel(color);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    const entry = { group, index, name, spawn: { x, z }, home, following: false };
    lostPets.push(entry);

    // This group sits at the actual front door of a real residential house.
    const homeGroup = new THREE.Group();
    homeGroup.position.set(home.x, TV.terrainHeight(home.x, home.z), home.z); TV.scene.add(homeGroup);
    const doormat = TV.outlinedMesh(TV.unitBox, TV.mat(0xa8754c), 1.025);
    doormat.scale.set(1.55, .08, .85); doormat.position.set(0, .05, .5); homeGroup.add(doormat);
    const marker = makeQuestMarker(); homeGroup.add(marker);
    const owner = makeOwner(home.ownerColor); owner.position.set(1.1, 0, -1.6); owner.visible = false; homeGroup.add(owner);
    petHomes.push({ group: homeGroup, marker, owner, index, thanksAt: 0 });

    TV.registerInteraction({
      object: group, radius: 2.3, area: 'world', prompt: `Help ${name} get home`,
      enabled: () => !state.petsFound.includes(index) && state.activePet === null,
      action: () => {
        if (state.petsFound.includes(index) || state.activePet !== null) return;
        state.activePet = index; entry.following = true; save();
        TV.showToast(`🐾 ${name} trusts you! Walk together across town to ${home.label}. Look for the yellow ! above the real house door.`, 4);
      }
    });

    TV.registerInteraction({
      object: homeGroup, radius: 3.4, area: 'world', prompt: `Knock on ${home.owner}'s door`,
      enabled: () => state.activePet === index && !state.petsFound.includes(index),
      action: () => {
        if (state.activePet !== index || state.petsFound.includes(index)) return;
        const dist = Math.hypot(group.position.x - homeGroup.position.x, group.position.z - homeGroup.position.z);
        if (dist > 6) {
          TV.showToast(`🐾 ${name} is too far away. Bring ${name} all the way to the door with you.`, 2.7);
          return;
        }
        const homeData = petHomes[index];
        owner.visible = true; owner.position.set(1.1, 0, -1.6); homeData.thanksAt = performance.now();
        marker.visible = false;
        entry.following = false;
        group.position.set(home.x + .45, TV.terrainHeight(home.x + .45, home.z + .55), home.z + .55);
        state.petsFound.push(index); state.activePet = null;
        const reward = 70 + index * 10;
        Life.addMoney(reward, `Returned ${name} home`);
        Life.emitProgress('help', 2, { activity: 'lost-pet', name });
        const complete = state.petsFound.length === lostPets.length;
        if (complete) Life.addMoney(100, 'Neighborhood pet helper bonus');
        TV.showToast(complete
          ? `🏠 ${home.owner}: “Thank you so much for bringing ${name} home!” +$${reward} · All lost pets returned! +$100 bonus`
          : `🏠 ${home.owner}: “Thank you so much for bringing ${name} home!” +$${reward}`, 4);
        save();
      }
    });
  }

  function resetDaily() {
    const today = day();
    if (state.gardenDay !== today) { state.gardenDay = today; state.watered = []; }
    if (state.petDay !== today) {
      state.petDay = today; state.petsFound = []; state.activePet = null;
      lostPets.forEach((entry) => {
        entry.following = false; entry.group.position.set(entry.spawn.x, TV.terrainHeight(entry.spawn.x, entry.spawn.z), entry.spawn.z); entry.group.visible = true;
      });
      petHomes.forEach((home) => { home.marker.visible = false; home.owner.visible = false; home.thanksAt = 0; });
    }
    save();
  }

  [[-132,58],[-128,58],[-132,62],[-128,62],[-132,66]].forEach((p,i) => makeGardenBed(p[0], p[1], i));
  [
    [-62,-8,'Mochi',0xe3a86b,{x:68,z:62.5,label:'Mrs. Juniper’s north-side cottage',owner:'Mrs. Juniper',ownerColor:0x5d8bd3}],
    [48,61,'Pepper',0x5d5d63,{x:-68,z:-47.5,label:'Mr. Maple’s market cottage',owner:'Mr. Maple',ownerColor:0xd8776f}],
    [86,-6,'Sunny',0xd9b73f,{x:-69.5,z:17,label:'Jamie’s west-side house',owner:'Jamie',ownerColor:0x63a66f}]
  ].forEach((p,i) => makeLostPet(p[0], p[1], i, p[2], p[3], p[4]));

  resetDaily();
  lostPets.forEach((entry) => {
    const found = state.petsFound.includes(entry.index);
    entry.group.visible = !found || state.activePet === entry.index;
    entry.following = state.activePet === entry.index;
  });

  let elapsed = 0, clock = 0;
  TV.registerUpdateHook((dt) => {
    elapsed += dt; clock += dt;
    for (const entry of lostPets) {
      const active = state.activePet === entry.index && !state.petsFound.includes(entry.index);
      const home = petHomes[entry.index];
      home.marker.visible = active;
      if (active) {
        home.marker.position.y = Math.sin(clock * 2.5 + entry.index) * .22;
        if (home.marker.userData.ring) home.marker.userData.ring.rotation.z += dt * .8;
      }
      if (!active || !entry.following || TV.state.area !== 'world') continue;
      const px = TV.player.position.x, pz = TV.player.position.z;
      const dx = px - entry.group.position.x, dz = pz - entry.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.1) {
        const speed = Math.min(7.2, 3.5 + dist * .35);
        const step = Math.min(dist - 1.7, speed * dt);
        entry.group.position.x += dx / dist * step;
        entry.group.position.z += dz / dist * step;
        entry.group.position.y = TV.terrainHeight(entry.group.position.x, entry.group.position.z);
        entry.group.rotation.y = Math.atan2(dx, dz);
      }
    }
    for (const home of petHomes) {
      if (!home.owner.visible || !home.thanksAt) continue;
      const p = Math.min(1, (performance.now() - home.thanksAt) / 900);
      home.owner.position.z = THREE.MathUtils.lerp(-1.6, .2, p);
      const arms = home.owner.userData?.arms;
      if (arms && p > .45) {
        arms[0].rotation.z = Math.sin(clock * 7) * .45;
        arms[1].rotation.z = -Math.sin(clock * 7) * .2;
      }
    }
    if (elapsed >= 2) { elapsed = 0; resetDaily(); }
  });

  window.ToonValleyServices = {
    getState: () => JSON.parse(JSON.stringify(state)),
    counts: { gardenBeds: gardenBeds.length, lostPets: lostPets.length },
    gardenAnnex: gardenBeds.map((e) => ({ x: e.group.position.x, z: e.group.position.z })),
    petHomes: lostPets.map((e) => ({ name: e.name, x: e.home.x, z: e.home.z, label: e.home.label, owner: e.home.owner })),
    questStyle: 'multi-step-escort-real-house-owner-handoff'
  };
  console.info('Toon Valley services ready', window.ToonValleyServices.counts);
})();