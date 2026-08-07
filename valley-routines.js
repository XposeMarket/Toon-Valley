(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-routines-v1';
  const defaults = { errandDay: -1, accepted: false, completed: false };
  const state = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        errandDay: Number.isFinite(parsed.errandDay) ? parsed.errandDay : defaults.errandDay,
        accepted: parsed.accepted === true,
        completed: parsed.completed === true
      };
    } catch (_) { return { ...defaults }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { console.warn('Unable to save valley routines', error); } }
  function world() { return Life.getState().world; }
  function day() { return world().day; }

  const errands = [
    { name: 'Library book drop', target: [-36, 30], reward: 55, icon: '📚', prompt: 'Drop off library books' },
    { name: 'Garden seed delivery', target: [-2, 55], reward: 60, icon: '🌱', prompt: 'Deliver seed packet' },
    { name: 'Fire station supply check', target: [61, 15], reward: 65, icon: '🧯', prompt: 'Deliver station supplies' }
  ];
  function currentErrand() { return errands[Math.abs(day()) % errands.length]; }

  function resetForDay() {
    const today = day();
    if (state.errandDay === today) return false;
    state.errandDay = today;
    state.accepted = false;
    state.completed = false;
    save();
    return true;
  }

  function makeNoticeBoard() {
    const group = new THREE.Group();
    const postMat = TV.materials.brown || TV.mat(0x76523b);
    for (const x of [-0.72, 0.72]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.9, 6), postMat);
      post.position.set(x, .95, 0); group.add(post);
    }
    const board = TV.outlinedMesh(TV.unitBox, TV.mat(0xd8b46a), 1.035);
    board.scale.set(1.8, 1.05, .12); board.position.y = 1.55; group.add(board);
    const paper = new THREE.Mesh(TV.unitBox, TV.materials.white || TV.mat(0xf5f0df));
    paper.scale.set(1.18, .68, .03); paper.position.set(0, 1.58, .15); group.add(paper);
    group.position.set(9, TV.terrainHeight(9, 24), 24); TV.scene.add(group);
    TV.registerInteraction({
      object: group, radius: 3, area: 'world', prompt: 'Check community notice board',
      enabled: () => true,
      action: () => {
        resetForDay();
        const task = currentErrand();
        if (state.completed) { TV.showToast(`✅ Today's notice-board errand is complete`, 2.3); return; }
        if (state.accepted) { TV.showToast(`${task.icon} ${task.name} is still active`, 2.3); return; }
        state.accepted = true; save();
        TV.showToast(`${task.icon} New errand: ${task.name} · reward $${task.reward}`, 3);
      }
    });
    return group;
  }

  function makeErrandTarget() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.55, .08, 6, 16), TV.mat(0xf3d45b));
    ring.rotation.x = Math.PI / 2; ring.position.y = .16; group.add(ring);
    const pin = TV.outlinedMesh(new THREE.ConeGeometry(.22, .7, 6), TV.mat(0xe15b64), 1.04);
    pin.rotation.x = Math.PI; pin.position.y = 1.05; group.add(pin);
    const syncPosition = () => {
      const task = currentErrand();
      group.position.set(task.target[0], TV.terrainHeight(task.target[0], task.target[1]), task.target[1]);
    };
    syncPosition(); TV.scene.add(group);
    TV.registerInteraction({
      object: group, radius: 2.8, area: 'world',
      prompt: 'Complete community errand',
      enabled: () => state.accepted && !state.completed,
      action: () => {
        if (!state.accepted || state.completed) return;
        const task = currentErrand();
        state.completed = true; save();
        Life.addMoney(task.reward, task.name);
        Life.emitProgress('help', 2, { activity: 'notice-board', task: task.name });
        TV.showToast(`${task.icon} ${task.name} complete! +$${task.reward}`, 2.8);
      }
    });
    return { group, syncPosition };
  }

  function makeStreetLamp(x, z) {
    const group = new THREE.Group();
    const metal = TV.mat(0x3f4650);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .08, 2.8, 7), metal);
    pole.position.y = 1.4; group.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .65, 6), metal);
    arm.rotation.z = Math.PI / 2; arm.position.set(.28, 2.65, 0); group.add(arm);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x6f7680 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), bulbMat);
    bulb.position.set(.57, 2.58, 0); group.add(bulb);
    group.position.set(x, TV.terrainHeight(x, z), z); TV.scene.add(group);
    return { group, bulbMat };
  }

  const lamps = [[-26, 18], [-12, 18], [2, 18], [16, 18], [30, 18], [18, 36], [18, 50], [45, 7], [58, 7], [-40, -12]].map((p) => makeStreetLamp(p[0], p[1]));
  const noticeBoard = makeNoticeBoard();
  const errandTarget = makeErrandTarget();
  resetForDay();

  let lastLampState = null;
  let lastDay = day();
  function updateLampVisuals() {
    const w = world();
    const hour = ((w.minutes || 0) / 60) % 24;
    const on = hour >= 18.5 || hour < 6.5 || w.weather === 'foggy';
    if (on === lastLampState) return;
    lastLampState = on;
    for (const lamp of lamps) lamp.bulbMat.color.setHex(on ? 0xffdf8a : 0x6f7680);
  }
  updateLampVisuals();

  let elapsed = 0;
  TV.registerUpdateHook((dt) => {
    elapsed += dt;
    if (elapsed < 1) return;
    elapsed = 0;
    const today = day();
    if (today !== lastDay) {
      lastDay = today;
      resetForDay();
      errandTarget.syncPosition();
    }
    updateLampVisuals();
    errandTarget.group.visible = state.accepted && !state.completed;
  });
  errandTarget.group.visible = state.accepted && !state.completed;

  window.ToonValleyRoutines = {
    getState: () => JSON.parse(JSON.stringify(state)),
    getCurrentErrand: () => ({ ...currentErrand() }),
    counts: { streetLamps: lamps.length, errands: errands.length },
    noticeBoard
  };
  console.info('Toon Valley routines ready', window.ToonValleyRoutines.counts);
})();
