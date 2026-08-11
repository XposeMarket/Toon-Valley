(() => {
  'use strict';
  const TV = window.ToonValley;
  const Ambient = window.ToonValleyAmbientPedestrianLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !Ambient?.getState) return;
  const { THREE } = TV;

  const root = new THREE.Group();
  root.name = 'ambient-park-routine-polish';
  TV.scene.add(root);

  const postMat = new THREE.MeshToonMaterial({ color: 0x466a59 });
  const beamMat = new THREE.MeshToonMaterial({ color: 0xe8cf7c });
  const towelMats = [
    new THREE.MeshToonMaterial({ color: 0xf3a2a8 }),
    new THREE.MeshToonMaterial({ color: 0x86c8eb }),
    new THREE.MeshToonMaterial({ color: 0x9bd6a8 }),
    new THREE.MeshToonMaterial({ color: 0xd4a5e9 })
  ];
  const lampIdle = 0x40505a;
  const lampActive = [0x8ff0a4, 0xffe17d, 0x82d8ff];

  const gateSpecs = [
    { x: -86, z: 47, yaw: Math.atan2(10, -1) },
    { x: -82, z: 44, yaw: Math.atan2(10, 4) }
  ];

  function makePaceGate(spec, index) {
    const group = new THREE.Group();
    group.name = `sunshine-pace-gate-${index + 1}`;
    for (const x of [-.95, .95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.14, 2.2, .14), postMat);
      post.position.set(x, 1.1, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, .18, .18), beamMat);
    beam.position.y = 2.12;
    group.add(beam);
    const lights = [];
    for (let i = 0; i < 3; i += 1) {
      const material = new THREE.MeshBasicMaterial({ color: lampIdle });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), material);
      lamp.position.set((i - 1) * .31, 2.12, .12);
      group.add(lamp);
      lights.push(lamp);
    }
    const y = TV.terrainHeight(spec.x, spec.z);
    group.position.set(spec.x, y, spec.z);
    group.rotation.y = spec.yaw;
    root.add(group);
    return { ...spec, group, lights, flashes: 0, flashLeft: 0 };
  }

  const paceGates = gateSpecs.map(makePaceGate);
  const lastSegments = new Map();
  const stationTow els = new Map();
  const joggerTow els = new Map();
  let lapGatePasses = 0;
  let towelRecoverySessions = 0;
  let residualBenchPoseResets = 0;
  let elapsed = 0;

  function ensureBenchTowels() {
    for (let i = 0; i < 4; i += 1) {
      const benchName = `sunshine-rest-bench-${i + 1}`;
      if (stationTow els.has(benchName)) continue;
      const bench = TV.scene.getObjectByName(benchName);
      if (!bench) continue;
      const towel = new THREE.Mesh(new THREE.BoxGeometry(.5, .035, .28), towelMats[i % towelMats.length]);
      towel.name = `${benchName}-recovery-towel`;
      towel.position.set(.46, .63, -.03);
      towel.rotation.z = -.08;
      bench.add(towel);
      stationTow els.set(benchName, towel);
    }
  }

  function ensureJoggerTowel(group, index) {
    if (joggerTow els.has(group.name)) return joggerTow els.get(group.name);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(.38, .035, .22), towelMats[index % towelMats.length]);
    towel.name = 'jogger-recovery-towel';
    towel.visible = false;
    towel.position.set(.2, 1.24, .18);
    group.add(towel);
    joggerTow els.set(group.name, towel);
    return towel;
  }

  function updatePaceGate(state) {
    if (state.kind !== 'park-jogger') return;
    if (!lastSegments.has(state.name)) {
      lastSegments.set(state.name, state.completedSegments);
      return;
    }
    const previous = lastSegments.get(state.name);
    if (state.completedSegments > previous && state.routePoints > 0 && state.completedSegments % state.routePoints === 0) {
      const index = Math.max(0, Math.min(paceGates.length - 1, Number.parseInt(state.name.split('-').pop(), 10) - 1 || 0));
      const gate = paceGates[index];
      gate.flashes += 1;
      gate.flashLeft = 1.25;
      lapGatePasses += 1;
    }
    lastSegments.set(state.name, state.completedSegments);
  }

  function updateGateLights(dt) {
    for (const gate of paceGates) {
      gate.flashLeft = Math.max(0, gate.flashLeft - dt);
      for (let i = 0; i < gate.lights.length; i += 1) {
        const active = gate.flashLeft > 0 && Math.floor((1.25 - gate.flashLeft) * 8) % 3 >= i;
        gate.lights[i].material.color.setHex(active ? lampActive[i] : lampIdle);
      }
    }
  }

  function updateRecoveryTowel(state, group, index) {
    const towel = ensureJoggerTowel(group, index);
    const active = state.kind === 'park-jogger' && state.activity === 'bench' && state.pause > 0;
    const benchName = group.userData.toonValleyRestBench;
    const stationTowel = benchName ? stationTow els.get(benchName) : null;
    const wasActive = Boolean(group.userData.toonValleyRecoveryTowelActive);
    group.userData.toonValleyRecoveryTowelActive = active;

    if (!active) {
      towel.visible = false;
      towel.position.set(.2, 1.24, .18);
      towel.rotation.set(0, 0, 0);
      if (stationTowel) stationTowel.visible = true;
      return;
    }

    if (!wasActive) towelRecoverySessions += 1;
    if (stationTowel) stationTowel.visible = false;
    towel.visible = true;
    const phase = .5 + .5 * Math.sin(elapsed * 5.2 + index * 1.7);
    towel.position.set(.08 + .1 * phase, 1.46 + .08 * phase, .13);
    towel.rotation.set(-.18 - .12 * phase, 0, -.32 + .12 * phase);
  }

  function resetBenchPoseLeak(state, group) {
    if (state.kind !== 'park-jogger' || state.activity === 'bench') return;
    const body = group.getObjectByName('body');
    if (!body) return;
    if (Math.abs(body.rotation.x) > .001) {
      body.rotation.x = 0;
      residualBenchPoseResets += 1;
    }
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    ensureBenchTowels();
    const states = Ambient.getState();
    let joggerIndex = 0;
    for (const state of states) {
      if (state.kind !== 'park-jogger') continue;
      const group = TV.scene.getObjectByName(state.name);
      if (!group) continue;
      updatePaceGate(state);
      updateRecoveryTowel(state, group, joggerIndex);
      resetBenchPoseLeak(state, group);
      joggerIndex += 1;
    }
    updateGateLights(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      paceGateCount: paceGates.length,
      stationTowelCount: stationTow els.size,
      joggerTowelCount: joggerTow els.size,
      lapGatePasses,
      towelRecoverySessions,
      residualBenchPoseResets,
      activeGateFlashes: paceGates.filter(gate => gate.flashLeft > 0).length,
      activeRecoveryTowels: [...joggerTow els.values()].filter(towel => towel.visible).length,
      gateFlashCounts: paceGates.map(gate => gate.flashes),
      finitePositions: paceGates.every(gate => Number.isFinite(gate.group.position.x) && Number.isFinite(gate.group.position.y) && Number.isFinite(gate.group.position.z))
    };
  }

  window.ToonValleyAmbientParkRoutinePolish = Object.freeze({
    active: true,
    physicalLapTimingGates: true,
    physicalBenchRecoveryTowels: true,
    benchPoseLeakFix: true,
    getState,
    advance
  });
})();