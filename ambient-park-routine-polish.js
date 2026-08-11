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
  const boardMat = new THREE.MeshToonMaterial({ color: 0x26343b });
  const digitOn = 0xffe17d;
  const digitOff = 0x39464a;
  const towelMats = [
    new THREE.MeshToonMaterial({ color: 0xf3a2a8 }),
    new THREE.MeshToonMaterial({ color: 0x86c8eb }),
    new THREE.MeshToonMaterial({ color: 0x9bd6a8 }),
    new THREE.MeshToonMaterial({ color: 0xd4a5e9 })
  ];
  const lampIdle = 0x40505a;
  const lampActive = [0x8ff0a4, 0xffe17d, 0x82d8ff];
  const carryBottle = Object.freeze({ x: .3, y: 1.05, z: .13 });

  const gateSpecs = [
    { x: -86, z: 47, yaw: Math.atan2(10, -1) },
    { x: -82, z: 44, yaw: Math.atan2(10, 4) }
  ];

  const digitSegments = Object.freeze({
    0: [1, 1, 1, 1, 1, 1, 0], 1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1], 3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1], 5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1], 7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1], 9: [1, 1, 1, 1, 0, 1, 1]
  });

  function makeSplitDigit(parent, x) {
    const parts = [];
    const specs = [
      [0, .2, .34, .06], [.17, .02, .06, .34], [.17, -.36, .06, .34],
      [0, -.54, .34, .06], [-.17, -.36, .06, .34], [-.17, .02, .06, .34],
      [0, -.17, .34, .06]
    ];
    for (const [sx, sy, w, h] of specs) {
      const material = new THREE.MeshBasicMaterial({ color: digitOff });
      const segment = new THREE.Mesh(new THREE.BoxGeometry(w, h, .035), material);
      segment.position.set(x + sx, sy, .035);
      parent.add(segment);
      parts.push(segment);
    }
    return parts;
  }

  function setDigit(parts, digit) {
    const pattern = digitSegments[digit] || digitSegments[0];
    for (let i = 0; i < parts.length; i += 1) parts[i].material.color.setHex(pattern[i] ? digitOn : digitOff);
  }

  function setSplitBoard(gate, seconds) {
    const whole = Math.max(0, Math.min(99, Math.round(seconds)));
    setDigit(gate.splitDigits[0], Math.floor(whole / 10));
    setDigit(gate.splitDigits[1], whole % 10);
    gate.lastLapSeconds = seconds;
    gate.splitBoardUpdates += 1;
  }

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
    const splitBoard = new THREE.Group();
    splitBoard.name = `sunshine-split-board-${index + 1}`;
    splitBoard.position.set(1.38, 1.48, 0);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, .92, .09), boardMat);
    panel.position.set(0, -.17, 0);
    splitBoard.add(panel);
    const splitDigits = [makeSplitDigit(splitBoard, -.24), makeSplitDigit(splitBoard, .24)];
    setDigit(splitDigits[0], 0);
    setDigit(splitDigits[1], 0);
    group.add(splitBoard);
    group.position.set(spec.x, TV.terrainHeight(spec.x, spec.z), spec.z);
    group.rotation.y = spec.yaw;
    root.add(group);
    return { ...spec, group, lights, splitBoard, splitDigits, flashes: 0, flashLeft: 0, lastLapSeconds: 0, splitBoardUpdates: 0 };
  }

  const paceGates = gateSpecs.map(makePaceGate);
  const lastSegments = new Map();
  const lapStartTimes = new Map();
  const stationTowels = new Map();
  const joggerTowels = new Map();
  const recoveryStates = new Map();
  let lapGatePasses = 0;
  let towelRecoverySessions = 0;
  let hydrationOverlapPreventions = 0;
  let residualBenchPoseResets = 0;
  let stagedRecoveryTransitions = 0;
  let stationTowelArbitrations = 0;
  let lingerRecoverySessions = 0;
  let elapsed = 0;

  function ensureBenchTowels() {
    for (let i = 0; i < 4; i += 1) {
      const benchName = `sunshine-rest-bench-${i + 1}`;
      if (stationTowels.has(benchName)) continue;
      const bench = TV.scene.getObjectByName(benchName);
      if (!bench) continue;
      const towel = new THREE.Mesh(new THREE.BoxGeometry(.5, .035, .28), towelMats[i % towelMats.length]);
      towel.name = `${benchName}-recovery-towel`;
      towel.position.set(.46, .63, -.03);
      towel.rotation.z = -.08;
      bench.add(towel);
      stationTowels.set(benchName, towel);
    }
  }

  function ensureJoggerTowel(group, index) {
    if (joggerTowels.has(group.name)) return joggerTowels.get(group.name);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(.38, .035, .22), towelMats[index % towelMats.length]);
    towel.name = 'jogger-recovery-towel';
    towel.visible = false;
    towel.position.set(.2, 1.24, .18);
    group.add(towel);
    joggerTowels.set(group.name, towel);
    return towel;
  }

  function updatePaceGate(state) {
    if (!lastSegments.has(state.name)) {
      lastSegments.set(state.name, state.completedSegments);
      lapStartTimes.set(state.name, elapsed);
      return;
    }
    const previous = lastSegments.get(state.name);
    if (state.completedSegments > previous && state.routePoints > 0 && state.completedSegments % state.routePoints === 0) {
      const parsed = Number.parseInt(state.name.split('-').pop(), 10);
      const index = Number.isFinite(parsed) ? Math.max(0, Math.min(paceGates.length - 1, parsed - 1)) : 0;
      const gate = paceGates[index];
      const started = lapStartTimes.get(state.name) ?? elapsed;
      const lapSeconds = Math.max(.1, elapsed - started);
      lapStartTimes.set(state.name, elapsed);
      setSplitBoard(gate, lapSeconds);
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

  function bottleIsBusy(group) {
    const bottle = group.getObjectByName('jogger-water-bottle');
    if (!bottle) return false;
    return Math.hypot(bottle.position.x - carryBottle.x, bottle.position.y - carryBottle.y, bottle.position.z - carryBottle.z) > .14;
  }

  function holdAtRecoveryBench(group, benchName) {
    if (!benchName) return;
    const bench = TV.scene.getObjectByName(benchName);
    if (!bench) return;
    group.position.x = bench.position.x;
    group.position.z = bench.position.z;
    group.position.y = TV.terrainHeight(bench.position.x, bench.position.z) + .02;
    group.rotation.y = bench.rotation.y;
    const body = group.getObjectByName('body');
    if (body) body.rotation.x = -.12;
  }

  function updateRecoveryTowel(state, group, index, activeTowelBenches) {
    const towel = ensureJoggerTowel(group, index);
    const atBench = state.activity === 'bench' && state.pause > 0;
    const hydrating = atBench && bottleIsBusy(group);
    const benchName = group.userData.toonValleyRestBench || null;
    let recovery = recoveryStates.get(state.name) || { phase: 'none', benchName: null, lingerUntil: 0 };
    const canLinger = !atBench && state.activity == null && state.pause <= 0 && state.playerYield <= 0 && elapsed < recovery.lingerUntil;
    const active = (atBench && !hydrating) || canLinger;
    const previousPhase = recovery.phase;

    if (hydrating) {
      recovery = { phase: 'hydration', benchName, lingerUntil: 0 };
      if (previousPhase !== 'hydration') hydrationOverlapPreventions += 1;
      group.userData.toonValleyRecoveryHydrationHold = true;
    } else if (atBench) {
      if (previousPhase !== 'towel') {
        towelRecoverySessions += 1;
        if (previousPhase === 'hydration') stagedRecoveryTransitions += 1;
      }
      recovery = { phase: 'towel', benchName, lingerUntil: elapsed + .9 };
      group.userData.toonValleyRecoveryHydrationHold = false;
    } else if (canLinger) {
      if (previousPhase !== 'linger') lingerRecoverySessions += 1;
      recovery.phase = 'linger';
      group.userData.toonValleyRecoveryHydrationHold = false;
      holdAtRecoveryBench(group, recovery.benchName);
    } else {
      recovery = { phase: 'none', benchName: null, lingerUntil: 0 };
      group.userData.toonValleyRecoveryHydrationHold = false;
    }

    recoveryStates.set(state.name, recovery);
    group.userData.toonValleyRecoveryTowelActive = active;

    if (!active) {
      towel.visible = false;
      towel.position.set(.2, 1.24, .18);
      towel.rotation.set(0, 0, 0);
      return;
    }

    if (recovery.benchName) activeTowelBenches.add(recovery.benchName);
    towel.visible = true;
    const phase = .5 + .5 * Math.sin(elapsed * 5.2 + index * 1.7);
    towel.position.set(.08 + .1 * phase, 1.46 + .08 * phase, .13);
    towel.rotation.set(-.18 - .12 * phase, 0, -.32 + .12 * phase);
  }

  function applyStationTowelVisibility(activeTowelBenches) {
    for (const [benchName, stationTowel] of stationTowels) {
      const shouldHide = activeTowelBenches.has(benchName);
      if (stationTowel.visible === shouldHide) stationTowelArbitrations += 1;
      stationTowel.visible = !shouldHide;
    }
  }

  function resetBenchPoseLeak(state, group) {
    if (state.activity === 'bench') return;
    const body = group.getObjectByName('body');
    if (!body || Math.abs(body.rotation.x) <= .001) return;
    body.rotation.x = 0;
    residualBenchPoseResets += 1;
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    ensureBenchTowels();
    const states = Ambient.getState();
    const activeTowelBenches = new Set();
    let joggerIndex = 0;
    for (const state of states) {
      if (state.kind !== 'park-jogger') continue;
      const group = TV.scene.getObjectByName(state.name);
      if (!group) continue;
      updatePaceGate(state);
      updateRecoveryTowel(state, group, joggerIndex, activeTowelBenches);
      resetBenchPoseLeak(state, group);
      joggerIndex += 1;
    }
    applyStationTowelVisibility(activeTowelBenches);
    updateGateLights(safeDt);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      paceGateCount: paceGates.length,
      splitBoardCount: paceGates.filter(gate => gate.splitBoard).length,
      stationTowelCount: stationTowels.size,
      joggerTowelCount: joggerTowels.size,
      lapGatePasses,
      towelRecoverySessions,
      hydrationOverlapPreventions,
      residualBenchPoseResets,
      stagedRecoveryTransitions,
      stationTowelArbitrations,
      activeGateFlashes: paceGates.filter(gate => gate.flashLeft > 0).length,
      activeRecoveryTowels: [...joggerTowels.values()].filter(towel => towel.visible).length,
      activeHydrationStages: [...recoveryStates.values()].filter(state => state.phase === 'hydration').length,
      activeTowelStages: [...recoveryStates.values()].filter(state => state.phase === 'towel' || state.phase === 'linger').length,
      lingerRecoverySessions,
      gateFlashCounts: paceGates.map(gate => gate.flashes),
      splitBoardUpdates: paceGates.map(gate => gate.splitBoardUpdates),
      lastLapSeconds: paceGates.map(gate => gate.lastLapSeconds),
      finitePositions: paceGates.every(gate => Number.isFinite(gate.group.position.x) && Number.isFinite(gate.group.position.y) && Number.isFinite(gate.group.position.z))
    };
  }

  window.ToonValleyAmbientParkRoutinePolish = Object.freeze({
    active: true,
    physicalLapTimingGates: true,
    physicalLapSplitBoards: true,
    physicalBenchRecoveryTowels: true,
    stagedHydrationRecovery: true,
    lingeredTowelCooldown: true,
    sharedBenchTowelArbitration: true,
    benchPoseLeakFix: true,
    getState,
    advance
  });
})();