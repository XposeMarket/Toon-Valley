(() => {
  'use strict';

  const TV = window.ToonValley;
  const Community = window.ToonValleyCommunityLife;
  if (!TV || !Community) return;

  const { THREE } = TV;
  const root = new THREE.Group();
  root.name = 'community-objective-wayfinding';
  TV.scene.add(root);

  function makeBeacon(color) {
    const group = new THREE.Group();
    group.visible = false;
    root.add(group);

    const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.24, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98, depthWrite: false });

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 5.8, 10, 1, true), beamMat);
    beam.position.y = 3.15;
    group.add(beam);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 6, 22), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    group.add(ring);

    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), coreMat);
    diamond.position.y = 6.15;
    group.add(diamond);

    return { group, ring, diamond };
  }

  const trailBeacon = makeBeacon(0xffdc46);
  const errandBeacon = makeBeacon(0x4fb7ff);
  const trailGate = { name: 'Mountain Trail ranger station', x: -104, z: 46 };
  const errandBoard = { name: 'Community errand board', x: 10, z: -2 };
  let phase = 0;
  let lastTargets = { trail: null, errand: null };

  function currentTargets() {
    const state = Community.getState();
    let trail = null;
    let errand = null;

    if (state.trailStarted && !state.trailDone) {
      if (state.trailAwaitingSignoff) trail = trailGate;
      else trail = Community.trail[state.trailVisited.length] || null;
    }

    if (state.errandStarted && !state.errandDone) {
      const route = Community.errands[state.errandIndex];
      if (state.errandAwaitingSignoff) errand = errandBoard;
      else errand = route?.stops?.[state.errandVisited.length] || null;
    }

    return { trail, errand };
  }

  function placeBeacon(beacon, target, offset = 0) {
    const visible = Boolean(target && TV.state.started && TV.state.area === 'world');
    beacon.group.visible = visible;
    if (!visible) return;
    const y = TV.terrainHeight(target.x, target.z);
    beacon.group.position.set(target.x, y + 0.03, target.z);
    beacon.ring.rotation.z = phase * 0.38 + offset;
    beacon.diamond.position.y = 6.15 + Math.sin(phase * 2.1 + offset) * 0.28;
    beacon.diamond.rotation.y = phase * 1.25 + offset;
  }

  function update() {
    phase += 0.055;
    const targets = currentTargets();
    lastTargets = targets;
    placeBeacon(trailBeacon, targets.trail, 0);
    placeBeacon(errandBeacon, targets.errand, Math.PI * 0.5);
  }

  function distanceLabel(target) {
    if (!target || !TV.player?.position || TV.state.area !== 'world') return '';
    const dx = TV.player.position.x - target.x;
    const dz = TV.player.position.z - target.z;
    return ` · ${Math.round(Math.hypot(dx, dz))}m`;
  }

  function getSummaries() {
    const state = Community.getState();
    const targets = currentTargets();
    const route = Community.errands[state.errandIndex];

    let trailStatus = 'START';
    let trailText = 'Visit the Mountain Trail ranger station to collect a trail card before hiking.';
    if (state.trailDone) {
      trailStatus = 'DONE';
      trailText = 'Today’s four-stop Mountain Trail route has been stamped and signed off.';
    } else if (state.trailAwaitingSignoff) {
      trailStatus = 'SIGN OFF';
      trailText = `Return to the yellow marker at the ranger station for sign-off and payment${distanceLabel(targets.trail)}.`;
    } else if (state.trailStarted) {
      const next = Community.trail[state.trailVisited.length];
      trailStatus = `${state.trailVisited.length}/${Community.trail.length}`;
      trailText = `Follow the yellow marker to ${next?.name || 'the next trail stop'} and stamp the trail card${distanceLabel(targets.trail)}.`;
    }

    let errandStatus = 'START';
    let errandText = `Check the community errand board to accept today’s ${route?.title || 'route'}.`;
    if (state.errandDone) {
      errandStatus = 'DONE';
      errandText = `${route?.title || 'Community route'} has been signed off and paid today.`;
    } else if (state.errandAwaitingSignoff) {
      errandStatus = 'SIGN OFF';
      errandText = `Return to the blue marker at the community errand board for final sign-off${distanceLabel(targets.errand)}.`;
    } else if (state.errandStarted) {
      const next = route?.stops?.[state.errandVisited.length];
      errandStatus = `${state.errandVisited.length}/${route?.stops?.length || 3}`;
      errandText = `Follow the blue marker to ${next?.name || 'the next check-in'} and complete the route in order${distanceLabel(targets.errand)}.`;
    }

    return [
      { icon: '🥾', title: 'Mountain Trail Card', done: state.trailDone, status: trailStatus, text: trailText },
      { icon: '📍', title: route?.title || 'Community Errand Route', done: state.errandDone, status: errandStatus, text: errandText }
    ];
  }

  const timer = setInterval(update, 120);
  update();

  window.ToonValleyCommunityObjectives = Object.freeze({
    active: true,
    markerCount: 2,
    getSummaries,
    getTargets: () => ({ ...lastTargets }),
    refresh: update,
    dispose: () => clearInterval(timer)
  });

  console.info('Toon Valley community objective wayfinding ready', { markers: 2, trackedActivities: 2 });
})();
