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
  const shirt = [0x6fa9e8, 0xe38d67, 0x7dbf8a, 0xb58be8, 0xe9b95e].map(color => new THREE.MeshToonMaterial({ color }));
  const parcelMat = new THREE.MeshToonMaterial({ color: 0xd79a55 });
  const ribbonMat = new THREE.MeshToonMaterial({ color: 0xf6dd87 });
  const shelfMat = new THREE.MeshToonMaterial({ color: 0x8b633f });
  const basketMat = new THREE.MeshToonMaterial({ color: 0xa86f45 });
  const signalDark = new THREE.MeshToonMaterial({ color: 0x3a3e43 });
  const signalStop = new THREE.MeshToonMaterial({ color: 0xf06b65 });
  const signalWalk = new THREE.MeshToonMaterial({ color: 0x75d38c });
  const signalCaution = new THREE.MeshToonMaterial({ color: 0xf2c45d });
  let elapsed = 0;
  let yieldFacingCorrections = 0;

  function person(name, color) {
    const g = new THREE.Group(); g.name = name;
    const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .74, .3), color); body.position.y = 1.05; body.name = 'body'; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), skin); head.position.y = 1.63; head.name = 'head'; g.add(head);
    for (const x of [-.14, .14]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .54, .14), dark); leg.position.set(x, .42, 0); g.add(leg); }
    root.add(g); return g;
  }

  function parcelProp(parent, visible = false, name = 'received-parcel') {
    const p = new THREE.Group(); p.name = name;
    const box = new THREE.Mesh(new THREE.BoxGeometry(.34, .24, .28), parcelMat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(.08, .26, .3), ribbonMat);
    p.add(box, band); p.position.set(.34, 1.08, .16); p.visible = visible; parent.add(p); return p;
  }

  function receivingBasket(name, x, z) {
    const g = new THREE.Group(); g.name = name;
    const base = new THREE.Mesh(new THREE.BoxGeometry(.72, .16, .54), basketMat); base.position.y = .08; g.add(base);
    for (const sideX of [-.34, .34]) { const side = new THREE.Mesh(new THREE.BoxGeometry(.06, .34, .56), basketMat); side.position.set(sideX, .22, 0); g.add(side); }
    for (const sideZ of [-.25, .25]) { const side = new THREE.Mesh(new THREE.BoxGeometry(.68, .34, .06), basketMat); side.position.set(0, .22, sideZ); g.add(side); }
    g.position.set(x, TV.terrainHeight(x, z), z); root.add(g); return g;
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
    const basketX = g.position.x + Math.sin(angle + Math.PI / 2) * .7;
    const basketZ = g.position.z + Math.cos(angle + Math.PI / 2) * .7;
    const basket = receivingBasket(`town-square-receiving-basket-${index + 1}`, basketX, basketZ);
    const storedParcel = parcelProp(basket, false, 'stored-parcel'); storedParcel.position.set(0, .44, 0);
    return { ...point, group: g, parcel: parcelProp(g), basket, storedParcel, deliveries: 0, storedDeliveries: 0, thankTimer: 0, handoffTimer: 0, storedTimer: 0 };
  });

  const pickupPoints = [
    { x: 1.5, z: -3.5 },
    { x: 3.5, z: -12 },
    { x: 7, z: -2.5 },
    { x: 4, z: -1.5 },
    { x: 6, z: -12 }
  ];

  function makePickupStation(point, index) {
    const g = new THREE.Group(); g.name = `town-square-parcel-station-${index + 1}`;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(.82, .68, .36), shelfMat); shelf.position.y = .34; g.add(shelf);
    const top = new THREE.Mesh(new THREE.BoxGeometry(.92, .08, .46), dark); top.position.y = .72; g.add(top);
    const shelfParcels = [];
    for (let i = 0; i < 2; i += 1) {
      const prop = parcelProp(g, true, `shelf-parcel-${i + 1}`);
      prop.scale.setScalar(.78); prop.position.set((i ? .2 : -.2), .88, 0); shelfParcels.push(prop);
    }
    const supplyCrate = new THREE.Mesh(new THREE.BoxGeometry(.56, .42, .5), basketMat); supplyCrate.position.set(-.72, .21, .08); supplyCrate.visible = false; g.add(supplyCrate);
    g.position.set(point.x + .7, TV.terrainHeight(point.x + .7, point.z + .45), point.z + .45); root.add(g);
    const clerk = person(`town-square-parcel-clerk-${index + 1}`, shirt[(index + 2) % shirt.length]);
    clerk.position.set(point.x + .9, TV.terrainHeight(point.x + .9, point.z + 1.05), point.z + 1.05);
    clerk.rotation.y = Math.atan2(point.x - clerk.position.x, point.z - clerk.position.z);
    const handParcel = parcelProp(clerk);
    return { ...point, station: g, shelfParcels, supplyCrate, stock: shelfParcels.length, clerk, handParcel, handoffs: 0, handoffTimer: 0, restockTimer: 0, restocks: 0 };
  }
  const pickupStations = pickupPoints.map(makePickupStation);

  function makeSignal(x, z, rotation = 0) {
    const g = new THREE.Group(); g.name = 'town-square-crosswalk-signal';
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.065, .075, 1.8, 8), signalDark); pole.position.y = .9; g.add(pole);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(.34, .7, .18), signalDark); housing.position.y = 1.68; g.add(housing);
    const stop = new THREE.Mesh(new THREE.CircleGeometry(.085, 12), signalStop); stop.name = 'stop-light'; stop.position.set(0, 1.9, -.096); stop.rotation.y = Math.PI; g.add(stop);
    const caution = new THREE.Mesh(new THREE.CircleGeometry(.085, 12), signalCaution); caution.name = 'caution-light'; caution.position.set(0, 1.68, -.097); caution.rotation.y = Math.PI; caution.visible = false; g.add(caution);
    const walk = new THREE.Mesh(new THREE.CircleGeometry(.085, 12), signalWalk); walk.name = 'walk-light'; walk.position.set(0, 1.46, -.098); walk.rotation.y = Math.PI; walk.visible = false; g.add(walk);
    g.position.set(x, TV.terrainHeight(x, z), z); g.rotation.y = rotation; root.add(g);
    return { group: g, stop, caution, walk, phase: 'stop', walkHold: 0, cautionHold: 0, activations: 0, phaseTransitions: 0 };
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
  function nearestPickup(x, z) {
    let best = pickupStations[0], bestD = Infinity;
    for (const p of pickupStations) { const d = Math.hypot(p.x - x, p.z - z); if (d < bestD) { best = p; bestD = d; } }
    return best;
  }

  function takeShelfParcel(station) {
    if (station.stock <= 0) return;
    station.stock -= 1;
    const prop = station.shelfParcels[station.stock];
    if (prop) prop.visible = false;
    if (station.stock === 0 && station.restockTimer <= 0) station.restockTimer = 2.4;
  }

  function syncParcelEvents(square) {
    square.forEach((state, index) => {
      const prev = previous[index] || { pickups: 0, deliveries: 0 };
      if (state.parcelPickups > prev.pickups) {
        const station = nearestPickup(state.x, state.z);
        const count = state.parcelPickups - prev.pickups;
        station.handoffs += count;
        for (let i = 0; i < count; i += 1) takeShelfParcel(station);
        station.handoffTimer = 1.35;
        station.handParcel.visible = true;
        const dx = state.x - station.clerk.position.x, dz = state.z - station.clerk.position.z;
        station.clerk.rotation.y = Math.atan2(dx, dz);
      }
      if (state.parcelDeliveries > prev.deliveries) {
        const recipient = nearestRecipient(state.x, state.z);
        recipient.deliveries += state.parcelDeliveries - prev.deliveries;
        recipient.thankTimer = 1.25;
        recipient.handoffTimer = 1.85;
        recipient.storedTimer = 0;
        recipient.parcel.visible = true;
        recipient.storedParcel.visible = false;
        recipient.parcel.position.set(.34, 1.08, .16);
        const dx = state.x - recipient.group.position.x, dz = state.z - recipient.group.position.z;
        recipient.group.rotation.y = Math.atan2(dx, dz);
      }
    });
    previous = square.map(s => ({ pickups: s.parcelPickups, deliveries: s.parcelDeliveries }));
  }

  function updatePickupStations(dt) {
    for (const p of pickupStations) {
      p.handoffTimer = Math.max(0, p.handoffTimer - dt);
      p.handParcel.visible = p.handoffTimer > 0;
      const head = p.clerk.getObjectByName('head');
      const body = p.clerk.getObjectByName('body');
      if (p.handoffTimer > 0) {
        p.handParcel.position.x = .31 + Math.sin(elapsed * 5) * .035;
        if (head) head.rotation.y = Math.sin(elapsed * 6) * .12;
        if (body) body.rotation.z = Math.sin(elapsed * 7) * .025;
      } else {
        p.handParcel.position.x += (.34 - p.handParcel.position.x) * .2;
        if (head) head.rotation.y *= .8;
        if (body) body.rotation.z *= .8;
      }
      if (p.restockTimer > 0) {
        p.restockTimer = Math.max(0, p.restockTimer - dt);
        p.supplyCrate.visible = true;
        p.supplyCrate.position.y = .21 + Math.sin(elapsed * 4) * .018;
        if (body) body.rotation.z = Math.sin(elapsed * 5) * .045;
        if (p.restockTimer === 0) {
          p.stock = p.shelfParcels.length;
          p.shelfParcels.forEach(prop => { prop.visible = true; });
          p.supplyCrate.visible = false;
          p.restocks += 1;
        }
      } else {
        p.supplyCrate.visible = false;
      }
    }
  }

  function updateRecipients(dt) {
    for (const r of recipients) {
      r.thankTimer = Math.max(0, r.thankTimer - dt);
      const previousHandoff = r.handoffTimer;
      r.handoffTimer = Math.max(0, r.handoffTimer - dt);
      r.storedTimer = Math.max(0, r.storedTimer - dt);
      const head = r.group.getObjectByName('head');
      const body = r.group.getObjectByName('body');
      if (r.thankTimer > 0) {
        if (head) head.rotation.y = Math.sin(elapsed * 7) * .18;
        if (body) body.rotation.z = Math.sin(elapsed * 8) * .035;
      } else {
        if (head) head.rotation.y *= .8;
        if (body) body.rotation.z *= .8;
      }
      if (r.handoffTimer > 0) {
        const progress = 1 - r.handoffTimer / 1.85;
        const targetWorldX = r.basket.position.x;
        const targetWorldY = r.basket.position.y + .5;
        const targetWorldZ = r.basket.position.z;
        r.parcel.position.x = .34 + (targetWorldX - r.group.position.x - .34) * Math.max(0, (progress - .48) / .52);
        r.parcel.position.y = 1.08 + (targetWorldY - r.group.position.y - 1.08) * Math.max(0, (progress - .48) / .52);
        r.parcel.position.z = .16 + (targetWorldZ - r.group.position.z - .16) * Math.max(0, (progress - .48) / .52);
        r.parcel.visible = true;
      } else if (previousHandoff > 0) {
        r.parcel.visible = false;
        r.storedParcel.visible = true;
        r.storedTimer = 2.8;
        r.storedDeliveries += 1;
      } else if (r.storedTimer === 0) {
        r.storedParcel.visible = false;
      }
    }
  }

  function setSignalPhase(signal, phase) {
    if (signal.phase !== phase) signal.phaseTransitions += 1;
    signal.phase = phase;
    signal.walk.visible = phase === 'walk';
    signal.caution.visible = phase === 'caution' && Math.sin(elapsed * 14) > -.2;
    signal.stop.visible = phase === 'stop';
  }

  function updateSignals(square, dt) {
    for (const signal of signals) {
      const crossing = square.some(s => s.activity === 'crosswalk' && Math.hypot(s.x - signal.group.position.x, s.z - signal.group.position.z) < 1.75);
      if (crossing) {
        if (signal.phase !== 'walk') signal.activations += 1;
        signal.walkHold = 1.35;
        signal.cautionHold = .75;
        setSignalPhase(signal, 'walk');
        continue;
      }
      if (signal.walkHold > 0) {
        signal.walkHold = Math.max(0, signal.walkHold - dt);
        setSignalPhase(signal, 'walk');
      } else if (signal.cautionHold > 0) {
        signal.cautionHold = Math.max(0, signal.cautionHold - dt);
        setSignalPhase(signal, 'caution');
      } else {
        setSignalPhase(signal, 'stop');
      }
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
    syncParcelEvents(square); updatePickupStations(step); updateRecipients(step); updateSignals(square, step); correctYieldFacing(states);
  }
  TV.registerUpdateHook(advance); advance(0);

  function getState() {
    return {
      recipientCount: recipients.length,
      receivingBasketCount: recipients.length,
      pickupStationCount: pickupStations.length,
      crosswalkSignalCount: signals.length,
      recipientDeliveries: recipients.map(r => r.deliveries),
      recipientThanking: recipients.map(r => r.thankTimer > 0),
      recipientParcelVisible: recipients.map(r => r.parcel.visible),
      recipientStoredDeliveries: recipients.map(r => r.storedDeliveries),
      recipientStoredParcelVisible: recipients.map(r => r.storedParcel.visible),
      pickupHandoffs: pickupStations.map(p => p.handoffs),
      pickupParcelVisible: pickupStations.map(p => p.handParcel.visible),
      pickupStock: pickupStations.map(p => p.stock),
      pickupRestocks: pickupStations.map(p => p.restocks),
      pickupSupplyCrateVisible: pickupStations.map(p => p.supplyCrate.visible),
      signalActivations: signals.map(s => s.activations),
      signalPhases: signals.map(s => s.phase),
      signalPhaseTransitions: signals.map(s => s.phaseTransitions),
      activeSignals: signals.filter(s => s.phase === 'walk').length,
      cautionSignals: signals.filter(s => s.phase === 'caution').length,
      yieldFacingCorrections,
      finitePositions: recipients.concat(pickupStations.map(p => ({ group: p.clerk }))).every(r => Number.isFinite(r.group.position.x) && Number.isFinite(r.group.position.y) && Number.isFinite(r.group.position.z))
    };
  }

  window.ToonValleyTownSquareStreetLife = Object.freeze({
    active: true,
    physicalParcelRecipients: true,
    physicalParcelPickupStations: true,
    physicalParcelStockLifecycle: true,
    physicalReceivingBaskets: true,
    reactiveCrosswalkSignals: true,
    timedCrosswalkPhases: true,
    ambientYieldFacingRepair: true,
    getState,
    advance
  });
})();
