(() => {
  'use strict';
  const TV = window.ToonValley;
  const W = window.ToonValleyBluebellWildlife;
  const M = window.ToonValleyBluebellMarshLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !W?.getState || !M?.getState) return;

  const { THREE } = TV;
  const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
  const marshRoot = TV.scene.getObjectByName('bluebell-marsh-life');
  if (!wildlifeRoot || !marshRoot) return;

  const socialRoot = new THREE.Group();
  socialRoot.name = 'bluebell-marsh-social';
  TV.scene.add(socialRoot);

  const duckGroups = [1, 2, 3].map(index => wildlifeRoot.getObjectByName(`bluebell-duck-${index}`)).filter(Boolean);
  const turtleGroups = [1, 2].map(index => marshRoot.getObjectByName(`bluebell-turtle-${index}`)).filter(Boolean);
  const frogGroups = [1, 2, 3].map(index => marshRoot.getObjectByName(`bluebell-frog-${index}`)).filter(Boolean);
  const turtleHomeYaw = turtleGroups.map(group => group.rotation.y);
  const turtleWatch = turtleGroups.map(() => ({ level: 0, target: -1 }));

  const throatGeometry = new THREE.SphereGeometry(.09, 8, 6);
  const throatMaterial = new THREE.MeshToonMaterial({ color: 0xd7e978 });
  const frogCalls = frogGroups.map((frog, index) => {
    const throat = new THREE.Mesh(throatGeometry, throatMaterial);
    throat.name = `bluebell-frog-throat-${index + 1}`;
    throat.position.set(0, .13, .31);
    throat.scale.setScalar(.001);
    throat.visible = false;
    frog.add(throat);
    return { throat, delay: Infinity, timer: 0, duration: .64, wasResponse: false };
  });

  let elapsed = 0;
  let chorusCooldown = 1.2;
  let chorusCycles = 0;
  let frogChorusCalls = 0;
  let frogChorusResponses = 0;
  let throatPeakScale = 0;
  let turtleDuckWatchTurns = 0;
  let turtleAlertTicks = 0;
  let turtleAlertPeakLean = 0;
  let turtleReturnTurns = 0;

  function angleDelta(target, current) {
    return Math.atan2(Math.sin(target - current), Math.cos(target - current));
  }

  function turnToward(group, desired, maxTurn) {
    const delta = angleDelta(desired, group.rotation.y);
    const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
    group.rotation.y += turn;
    return Math.abs(turn);
  }

  function nearestDuck(group) {
    let best = -1;
    let distance = Infinity;
    duckGroups.forEach((duck, index) => {
      if (!duck) return;
      const d = Math.hypot(duck.position.x - group.position.x, duck.position.z - group.position.z);
      if (d < distance) {
        distance = d;
        best = index;
      }
    });
    return { index: best, distance };
  }

  function updateTurtleDuckWatch(dt, marshState) {
    turtleGroups.forEach((turtle, index) => {
      const state = marshState.turtles?.[index];
      const watch = turtleWatch[index];
      if (!turtle || !watch) return;

      if (state?.state !== 'basking') {
        watch.level = Math.max(0, watch.level - dt * 2.5);
        watch.target = -1;
        turtle.rotation.z += (0 - turtle.rotation.z) * Math.min(1, dt * 6);
        return;
      }

      const nearest = nearestDuck(turtle);
      const watching = nearest.index >= 0 && nearest.distance <= 5.6;
      const targetLevel = watching ? Math.max(0, Math.min(1, (5.6 - nearest.distance) / 3.7)) : 0;
      watch.level += (targetLevel - watch.level) * Math.min(1, dt * 3.6);
      watch.target = watching ? nearest.index : -1;

      if (watching) {
        const duck = duckGroups[nearest.index];
        const desired = Math.atan2(duck.position.x - turtle.position.x, duck.position.z - turtle.position.z);
        const turned = turnToward(turtle, desired, dt * (1.25 + watch.level * .8));
        if (turned > .0015) turtleDuckWatchTurns += 1;
        if (watch.level > .08) turtleAlertTicks += 1;
      } else {
        const turned = turnToward(turtle, turtleHomeYaw[index] || 0, dt * 1.05);
        if (turned > .0015) turtleReturnTurns += 1;
      }

      const side = index % 2 === 0 ? 1 : -1;
      const targetLean = side * watch.level * .095;
      turtle.rotation.z += (targetLean - turtle.rotation.z) * Math.min(1, dt * 5.2);
      turtleAlertPeakLean = Math.max(turtleAlertPeakLean, Math.abs(turtle.rotation.z));
    });
  }

  function scheduleChorus(marshState) {
    const resting = frogGroups
      .map((frog, index) => ({ frog, index, state: marshState.frogs?.[index] }))
      .filter(item => item.frog && item.state?.state === 'resting');
    if (resting.length < 2) return false;

    const leaderSlot = chorusCycles % resting.length;
    resting.forEach((item, order) => {
      const call = frogCalls[item.index];
      const relative = (order - leaderSlot + resting.length) % resting.length;
      call.delay = relative * .48;
      call.timer = 0;
      call.wasResponse = relative > 0;
    });
    chorusCycles += 1;
    chorusCooldown = 5.7 + (chorusCycles % 3) * .65;
    return true;
  }

  function updateFrogChorus(dt, marshState) {
    chorusCooldown = Math.max(0, chorusCooldown - dt);
    const anyActive = frogCalls.some(call => Number.isFinite(call.delay) || call.timer > 0);
    if (chorusCooldown <= 0 && !anyActive) scheduleChorus(marshState);

    frogCalls.forEach((call, index) => {
      const frogState = marshState.frogs?.[index];
      if (!call) return;
      if (frogState?.state !== 'resting') {
        call.delay = Infinity;
        call.timer = 0;
        call.throat.visible = false;
        call.throat.scale.setScalar(.001);
        return;
      }

      if (Number.isFinite(call.delay)) {
        call.delay -= dt;
        if (call.delay <= 0) {
          call.delay = Infinity;
          call.timer = call.duration;
          frogChorusCalls += 1;
          if (call.wasResponse) frogChorusResponses += 1;
        }
      }

      if (call.timer > 0) {
        call.timer = Math.max(0, call.timer - dt);
        const progress = 1 - call.timer / call.duration;
        const pulse = Math.sin(Math.min(1, progress) * Math.PI);
        const scale = .38 + pulse * 1.28;
        call.throat.visible = call.timer > 0;
        call.throat.scale.set(scale * .9, scale, scale * .82);
        throatPeakScale = Math.max(throatPeakScale, scale);
      } else {
        call.throat.visible = false;
        call.throat.scale.setScalar(.001);
      }
    });
  }

  function advance(dt = 0) {
    const safeDt = Math.max(0, Math.min(.25, Number(dt) || 0));
    elapsed += safeDt;
    const marshState = M.getState();
    updateTurtleDuckWatch(safeDt, marshState);
    updateFrogChorus(safeDt, marshState);
  }

  TV.registerUpdateHook(advance);

  function getState() {
    return {
      elapsed,
      chorusCycles,
      frogChorusCalls,
      frogChorusResponses,
      throatPeakScale,
      activeCalls: frogCalls.filter(call => call.timer > 0).length,
      throatCount: frogCalls.length,
      turtleDuckWatchTurns,
      turtleAlertTicks,
      turtleAlertPeakLean,
      turtleReturnTurns,
      watchedTurtles: turtleWatch.filter(watch => watch.target >= 0 && watch.level > .08).length,
      turtleWatchLevels: turtleWatch.map(watch => watch.level),
      turtleTargets: turtleWatch.map(watch => watch.target)
    };
  }

  window.ToonValleyBluebellMarshSocial = Object.freeze({
    active: true,
    frogCallAndResponse: true,
    physicalThroatPulse: true,
    fixedThroatGeometry: true,
    turtleDuckWatch: true,
    turtleAlertLean: true,
    smoothTurtleReturn: true,
    existingWildlifeOnly: true,
    lowAllocationBehavior: true,
    advance,
    getState
  });
})();
