(() => {
  'use strict';
  const TV = window.ToonValley;
  const Ambient = window.ToonValleyAmbientPedestrianLife;
  if (!TV?.scene || !TV?.registerUpdateHook || !TV?.terrainHeight || !Ambient?.getState) return;
  const { THREE } = TV;
  const root = new THREE.Group();
  root.name = 'town-square-street-life';
  TV.scene.add(root);

  const skin = new THREE.MeshToonMaterial({ color: 0xf0bd97 });
  const dark = new THREE.MeshToonMaterial({ color: 0x2e3338 });
  const shirt = [0x6fa9e8, 0xe38d67, 0x7dbf8a].map(color => new THREE.MeshToonMaterial({ color }));
  const parcelMat = new THREE.MeshToonMaterial({ color: 0xd79a55 });
  const ribbonMat = new THREE.MeshToonMaterial({ color: 0xf6dd87 });
  const signalDark = new THREE.MeshToonMaterial({ color: 0x3a3e43 });
  const signalStop = new THREE.MeshToonMaterial({ color: 0xf06b65 });
  const signalWalk = new THREE.MeshToonMaterial({ color: 0x75d38c });
  let elapsed = 0;
  let yieldFacingCorrections = 0;

  function person(name, color) {
    const g = new THREE.Group(); g.name = name;
    const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .74, .3), color); body.position.y = 1.05; body.name = 'body'; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), skin); head.position.y = 1.63; head.name = 'head'; g.add(head);
    for (const x of [-.14, .14]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .54, .14), dark); leg.position.set(x, .42, 0); g.add(leg); }
    root.add(g); return g;
  }

  function parcelProp(parent) {
    const p = new THREE.Group(); p.name = 'received-parcel';
    const box = new THREE.Mesh(new THREE.BoxGeometry(.34, .24, .28), parcelMat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(.08, .26, .3), ribbonMat);
    p.add(box, band); p.position.set(.34, 1.08, .16); p.visible = false; parent.add(p); return p;
  }

  const deliveryPoints = [
    { x: 10.5, z: -10.5, name: 'Nell' },
    { x: 12, z: -7, name: 'Sam' },
    { x: 11.5, z: -2, name: 'Ivy' }
  ];
  const recipients = deliveryPoints.map((point, index) => {
    const g = person(`town-square-recipient-${index + 1}`, shirt[index]);
    const angle = index === 2 ? -Math.PI / 2 : Math.PI;
    const ox = Math.sin(angle) * .85, oz = Math.cos(angle) * .85;
    g.position.set(point.x + ox, TV.terrainHeight(point.x + ox, point.z + oz), point.z + oz);
    g.rotation.y = angle + Math.PI;
    return { ...point, group: g, parcel: parcelProp(g), deliveries: 0, thankTimer: 0, parcelTimer: 0 };
  });

  function makeSignal(x, z, rotation = 0) {
    const g = new THREE.Group(); g.name = 'town-square-crosswalk-signal';
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.065, .075, 1.8, 8), signalDark); pole.position.y = .9; g.add(pole);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(.34, .52, .18), signalDark); housing.position.y = 1.72; g.add(housing);
    const stop = new THREE.Mesh(new THREE.CircleGeometry(.095, 12), signalStop); stop.name = 'stop-light'; stop.position.set(0, 1.82, -.096); stop.rotation.y = Math.PI; g.add(stop);
    const walk = new THREE.Mesh(new THREE.CircleGeometry(.095, 12), signalWalk); walk.name = 'walk-light'; walk.position.set(0, 1.60, -.097); walk.rotation.y = Math.PI; walk.visible = false; g.add(walk);
    g.position.set(x, TV.terrainHeight(x, z), z); g.rotation.y = rotation; root.add(g);
    return { group: g, stop, walk, active: false, activations: 0 };
  }

  const signals = [
    makeSignal(1.5, -10.5, 0),
    makeSignal(10.5, -3.5, Math.PI / 2),
    makeSignal(9, -12, 0),
    makeSignal(2.5, -6, Math.PI / 2),
    makeSignal(0, -7, Math.PI / 2),
    makeSignal(12.5, -8.5, 0)
  ];

  let previous = Ambient.getState().filter(s => s.kind === 'square-errand').map(s => ({ pickups: s.parcelPickups, deliveries: s.parcelDeliveries }));

  function nearestRecipient(x, z) {
    let best = recipients[0], bestD = Infinity;
    for (const r of recipients) { const d = Math.hypot(r.x - x, r.z - z); if (d < bestD) { best = r; bestD = d; } }
    return best;
  }

  function syncDeliveries(square) {
    square.forEach((state, index) => {
      const prev = previous[index] || { deliveries: 0 };
      if (state.parcelDeliveries > prev.deliveries) {
        const recipient = nearestRecipient(state.x, state.z);
        recipient.deliveries += state.parcelDeliveries - prev.deliveries;
        recipient.thankTimer = 1.55;
        recipient.parcelTimer = 2.35;
        recipient.parcel.visible = true;
        const dx = state.x - recipient.group.position.x, dz = state.z - recipient.group.position.z;
        recipient.group.rotation.y = Math.atan2(dx, dz);
      }
    });
    previous = square.map(s => ({ pickups: s.parcelPickups, deliveries: s.parcelDeliveries }));
  }

  function updateRecipients(dt) {
    for (const r of recipients) {
      r.thankTimer = Math.max(0, r.thankTimer - dt);
      r.parcelTimer = Math.max(0, r.parcelTimer - dt);
      r.parcel.visible = r.parcelTimer > 0;
      const head = r.group.getObjectByName('head');
      const body = r.group.getObjectByName('body');
      if (r.thankTimer > 0) {
        if (head) head.rotation.y = Math.sin(elapsed * 7) * .18;
        if (body) body.rotation.z = Math.sin(elapsed * 8) * .035;
        r.parcel.position.y = 1.08 + Math.sin(elapsed * 5) * .035;
      } else {
        if (head) head.rotation.y *= .8;
        if (body) body.rotation.z *= .8;
        r.parcel.position.y += (1.08 - r.parcel.position.y) * .2;
      }
    }
  }

  function updateSignals(square) {
    for (const signal of signals) {
      const active = square.some(s => s.activity === 'crosswalk' && Math.hypot(s.x - signal.group.position.x, s.z - signal.group.position.z) < 1.75);
      if (active && !signal.active) signal.activations += 1;
      signal.active = active;
      signal.walk.visible = active;
      signal.stop.visible = !active;
    }
  }

  function correctYieldFacing(states) {
    const player = TV.player?.position; if (!player) return;
    for (const state of states) {
      if (!(state.playerYield > 0)) continue;
      const walker = TV.scene.getObjectByName(state.name); if (!walker) continue;
      const desired = Math.atan2(player.x - walker.position.x, player.z - walker.position.z);
      const diff = Math.atan2(Math.sin(walker.rotation.y - desired), Math.cos(walker.rotation.y - desired));
      if (Math.abs(diff) > .05) { walker.rotation.y = desired; yieldFacingCorrections += 1; }
    }
  }

  function advance(dt = 0) {
    const step = Math.max(0, Math.min(.25, Number(dt) || 0)); elapsed += step;
    const states = Ambient.getState();
    const square = states.filter(s => s.kind === 'square-errand');
    syncDeliveries(square); updateRecipients(step); updateSignals(square); correctYieldFacing(states);
  }
  TV.registerUpdateHook(advance); advance(0);

  function getState() {
    return {
      recipientCount: recipients.length,
      crosswalkSignalCount: signals.length,
      recipientDeliveries: recipients.map(r => r.deliveries),
      recipientThanking: recipients.map(r => r.thankTimer > 0),
      recipientParcelVisible: recipients.map(r => r.parcel.visible),
      signalActivations: signals.map(s => s.activations),
      activeSignals: signals.filter(s => s.active).length,
      yieldFacingCorrections,
      finitePositions: recipients.every(r => Number.isFinite(r.group.position.x) && Number.isFinite(r.group.position.y) && Number.isFinite(r.group.position.z))
    };
  }

  window.ToonValleyTownSquareStreetLife = Object.freeze({
    active: true,
    physicalParcelRecipients: true,
    reactiveCrosswalkSignals: true,
    ambientYieldFacingRepair: true,
    getState,
    advance
  });
})();
