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
    const owner = new THREE.Group();
    const shirt = TV.mat(color);
    const skin = TV.mat(0xf0bd91);
    const body = TV.outlinedMesh(new THREE.CylinderGeometry(.27, .34, .85, 8), shirt, 1.025);
    body.position.y = .93; owner.add(body);
    const head = TV.outlinedMesh(new THREE.SphereGeometry(.25, 9, 7), skin, 1.025);
    head.position.y = 1.58; owner.add(head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .72, 6), TV.materials.dark || TV.mat(0x3f4650));
      leg.position.set(side * .13, .36, 0); owner.add(leg);
    }
    return owner;
  }

  function makeQuestMarker() {
    const marker = new THREE.Group();
    const mat = TV.materials.yellow || TV.mat(0xf4d34f);
    const bar = TV.outlinedMesh(TV.unitBox, mat, 1.04); bar.scale.set(.18, .72, .18); bar.position.y = 2.55; marker.add(bar);
    const dot = TV.outlinedMesh(new THREE.SphereGeometry(.17, 8, 6), mat, 1.04); dot.position.y = 1.85; marker.add(dot);
    return marker;
  }

  function makeLostPet(x, z, index, name, color, home) {
    const group = makePetModel(color);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    const entry = { group, index, name, spawn: { x, z }, home, following: false };
    lostPets.push(entry);

    const homeGroup = new THREE.Group();
    homeGroup.position.set(home.x, TV.terrainHeight(home.x, home.z), home.z); TV.scene.add(homeGroup);
    const mat = TV.outlinedMesh(TV.unitBox, TV.materials.wood || TV.mat(0x9a704d), 1.025);
    mat.scale.set(1.55, .08, .85); mat.position.set(0, .05, .5); homeGroup.add(mat);
    const marker = makeQuestMarker(); marker.position.set(0, 0, 0); homeGroup.add(marker);
    const owner = makeOwner(home.ownerColor); owner.position.set(1.1, 0, .2); owner.visible = false; homeGroup.add(owner);
    petHomes.push({ group: homeGroup, marker, owner, index });

    TV.registerInteraction({
      object: group, radius: 2.3, area: 'world', prompt: `Help ${name} get home`,
      enabled: () => !state.petsFound.includes(index) && state.activePet === null,
      action: () => {
        if (state.petsFound.includes(index) || state.activePet !== null) return;
        state.activePet = index; entry.following = true; save();
        TV.showToast(`🐾 ${name} trusts you! Walk together to ${home.label}. Look for the yellow !`, 3.5);
      }
    });

    TV.registerInteraction({
      object: homeGroup, radius: 3.4, area: 'world', prompt: `Knock on ${home.owner}'s door`,
      enabled: () => state.activePet === index && !state.petsFound.includes(index),
      action: () => {
        if (state.activePet !== index || state.petsFound.includes(index)) return;
        const dist = Math.hypot(group.position.x - homeGroup.position.x, group.position.z - homeGroup.position.z);
        if (dist > 6) {
          TV.showToast(`🐾 ${name} is too far away. Bring ${name} to the door with you.`, 2.7);
          return;
        }
        owner.visible = true;
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
          ? `🏠 “Thank you so much for bringing ${name} home!” +$${reward} · All lost pets returned! +$100 bonus`
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
      petHomes.forEach((home) => { home.marker.visible = false; home.owner.visible = false; });
    }
    save();
  }

  [[-132,58],[-128,58],[-132,62],[-128,62],[-132,66]].forEach((p,i) => makeGardenBed(p[0], p[1], i));
  [
    [-62,-8,'Mochi',0xe3a86b,{x:44,z:75,label:'the north-side blue house',owner:'Jamie',ownerColor:0x5d8bd3}],
    [48,61,'Pepper',0x5d5d63,{x:-38,z:-19,label:'the market cottage',owner:'Avery',ownerColor:0xd8776f}],
    [86,-6,'Sunny',0xd9b73f,{x:63,z:39,label:'the east neighborhood home',owner:'Robin',ownerColor:0x63a66f}]
  ].forEach((p,i) => makeLostPet(p[0], p[1], i, p[2], p[3], p[4]));

  resetDaily();
  lostPets.forEach((entry) => {
    const found = state.petsFound.includes(entry.index);
    entry.group.visible = !found || state.activePet === entry.index;
    entry.following = state.activePet === entry.index;
  });

  let elapsed = 0;
  TV.registerUpdateHook((dt) => {
    elapsed += dt;
    for (const entry of lostPets) {
      const active = state.activePet === entry.index && !state.petsFound.includes(entry.index);
      const home = petHomes[entry.index];
      home.marker.visible = active;
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
    if (elapsed >= 2) { elapsed = 0; resetDaily(); }
  });

  window.ToonValleyServices = {
    getState: () => JSON.parse(JSON.stringify(state)),
    counts: { gardenBeds: gardenBeds.length, lostPets: lostPets.length },
    gardenAnnex: gardenBeds.map((e) => ({ x: e.group.position.x, z: e.group.position.z })),
    petHomes: lostPets.map((e) => ({ name: e.name, x: e.home.x, z: e.home.z, label: e.home.label })),
    questStyle: 'multi-step-escort-return'
  };
  console.info('Toon Valley services ready', window.ToonValleyServices.counts);
})();