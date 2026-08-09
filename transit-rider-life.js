(() => {
  'use strict';
  const TV = window.ToonValley;
  const Transit = window.ToonValleyTransit;
  const Steward = window.ToonValleyTransitStewardship;
  if (!TV || !Transit?.stops?.length || !Steward?.commuters?.length) return;
  const { THREE } = TV;
  const root = new THREE.Group();
  root.name = 'transit-rider-life';
  TV.scene.add(root);
  const stops = Transit.stops;
  const trips = new Map();
  const palette = [0x64d7ff, 0x8bdc82, 0xffd35a, 0xe58cff];
  const WALK_SPEED = 1.8;
  const ACTIVITY_SPEED = 1.15;
  let clock = 0;

  const destinations = [
    { x: 7, z: -7, label: 'Town Square plaza' },
    { x: 58, z: 66, label: 'North Homes porches' },
    { x: -78, z: 51, label: 'Sunshine Park lawn' },
    { x: 63, z: -79, label: 'Bluebell Lake overlook' }
  ];

  const pedestrianRoutes = [
    {
      outbound: [{ x: 14, z: -8 }, { x: 11, z: -7 }, { x: 7, z: -7 }],
      activity: [{ x: 7, z: -7 }, { x: 4.5, z: -5.5 }, { x: 7, z: -3.5 }, { x: 9.5, z: -5.5 }, { x: 7, z: -7 }]
    },
    {
      outbound: [{ x: 51, z: 59 }, { x: 54, z: 62 }, { x: 58, z: 66 }],
      activity: [{ x: 58, z: 66 }, { x: 61, z: 66 }, { x: 61, z: 69 }, { x: 57, z: 69 }, { x: 58, z: 66 }]
    },
    {
      outbound: [{ x: -88, z: 42 }, { x: -84, z: 46 }, { x: -78, z: 51 }],
      activity: [{ x: -78, z: 51 }, { x: -74, z: 53 }, { x: -77, z: 56 }, { x: -82, z: 54 }, { x: -78, z: 51 }]
    },
    {
      outbound: [{ x: 69, z: -71 }, { x: 66, z: -75 }, { x: 63, z: -79 }],
      activity: [{ x: 63, z: -79 }, { x: 67, z: -81 }, { x: 64, z: -84 }, { x: 59, z: -82 }, { x: 63, z: -79 }]
    }
  ];

  const nearestStopIndex = () => {
    let best = 0, distance = Infinity;
    stops.forEach((s, i) => {
      const d = Math.hypot(Transit.bus.position.x - s.routeX, Transit.bus.position.z - s.routeZ);
      if (d < distance) { distance = d; best = i; }
    });
    return { index: best, distance };
  };

  function chooseDestination(originIndex, slot) {
    const hop = 1 + ((originIndex + slot) % Math.max(1, stops.length - 1));
    return (originIndex + hop) % stops.length;
  }

  const stopBoards = stops.map((stop, index) => {
    const y = TV.terrainHeight(stop.x, stop.z);
    const g = new THREE.Group();
    g.position.set(stop.x + 1.62, y + 2.28, stop.z);
    g.rotation.y = stop.angle;
    root.add(g);
    const frame = TV.outlinedMesh(TV.unitBox, TV.materials.dark, 1.02);
    frame.scale.set(1.15, .7, .12);
    g.add(frame);
    const face = new THREE.Mesh(TV.unitBox, new THREE.MeshToonMaterial({ color: 0x18232d }));
    face.scale.set(1.02, .56, .135);
    face.position.z = .015;
    g.add(face);
    const destination = new THREE.Mesh(new THREE.BoxGeometry(.72, .12, .05), new THREE.MeshToonMaterial({ color: palette[(index + 1) % palette.length], emissive: palette[(index + 1) % palette.length], emissiveIntensity: .22 }));
    destination.position.set(0, .16, .09);
    g.add(destination);
    const bars = Array.from({ length: 4 }, (_, n) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.16, .12, .05), new THREE.MeshToonMaterial({ color: 0x4a5560, emissive: 0x000000, emissiveIntensity: 0 }));
      m.position.set(-.3 + n * .2, -.14, .09);
      g.add(m);
      return m;
    });
    return { group: g, destination, bars, index, stop, eta: 0, near: false };
  });

  const passengerRoot = new THREE.Group();
  passengerRoot.name = 'shuttle-visible-passengers';
  Transit.bus.add(passengerRoot);
  const passengerSlots = Steward.commuters.map((commuter, index) => {
    const g = new THREE.Group();
    const side = index % 2 ? .68 : -.68;
    const row = Math.floor(index / 2);
    g.position.set(side, .96, -1.7 + row * 1.12);
    g.rotation.y = side > 0 ? -.14 : .14;
    const bodyColor = palette[index % palette.length];
    const body = new THREE.Mesh(new THREE.BoxGeometry(.34, .52, .28), new THREE.MeshToonMaterial({ color: bodyColor }));
    body.position.y = .36;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.18, 7, 5), new THREE.MeshToonMaterial({ color: 0xf2c39d }));
    head.position.y = .79;
    g.add(head);
    g.visible = false;
    passengerRoot.add(g);
    return g;
  });

  function routeDistanceToStop(stop) {
    return Math.hypot(Transit.bus.position.x - stop.routeX, Transit.bus.position.z - stop.routeZ);
  }

  function updateBoards() {
    stopBoards.forEach(board => {
      const d = routeDistanceToStop(board.stop);
      const near = d < 18;
      board.near = near;
      board.eta = Math.max(0, Math.round(d / 6.4));
      const lit = near ? 4 : d < 40 ? 3 : d < 75 ? 2 : 1;
      board.bars.forEach((bar, i) => {
        const active = i < lit;
        bar.material.color.setHex(active ? 0x68e48d : 0x4a5560);
        bar.material.emissive.setHex(active ? 0x145d2c : 0x000000);
        bar.material.emissiveIntensity = active ? (near ? .85 : .35) : 0;
      });
      board.destination.material.emissiveIntensity = near ? .8 + Math.sin(clock * 5) * .15 : .22;
    });
  }

  function waitPosition(commuter, stop) {
    const base = commuter.userData.baseOffset || { x: 0, z: -1.5 };
    return { x: stop.x + base.x, z: stop.z + base.z };
  }

  function moveToward(commuter, point, dt, speed = WALK_SPEED) {
    const dx = point.x - commuter.position.x;
    const dz = point.z - commuter.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .001) return 0;
    const step = Math.min(distance, dt * speed);
    commuter.position.x += dx / distance * step;
    commuter.position.z += dz / distance * step;
    commuter.position.y = TV.terrainHeight(commuter.position.x, commuter.position.z);
    commuter.rotation.y = Math.atan2(dx, dz);
    return distance - step;
  }

  function beginTrip(commuter) {
    const stopIndex = Math.max(0, stops.indexOf(commuter.userData.stop));
    const destinationIndex = chooseDestination(stopIndex, commuter.userData.slot || 0);
    const trip = {
      originIndex: stopIndex,
      destinationIndex,
      boardedAt: clock,
      phase: 'riding',
      completedTrips: 0,
      routeCursor: 0,
      activityCursor: 0,
      returnCursor: -1
    };
    trips.set(commuter, trip);
    commuter.userData.riderLifeManaged = true;
    commuter.visible = false;
    return trip;
  }

  function processStopArrival(index) {
    Steward.commuters.forEach(commuter => {
      const trip = trips.get(commuter);
      if (!trip || trip.phase !== 'riding' || !commuter.userData.boarded || index !== trip.destinationIndex) return;
      const destination = stops[trip.destinationIndex];
      const p = waitPosition(commuter, destination);
      commuter.userData.boarded = false;
      commuter.userData.stop = destination;
      commuter.userData.riderLifeManaged = true;
      commuter.userData.cooldown = Math.max(commuter.userData.cooldown || 0, Transit.stopDwellSeconds + 2.2);
      commuter.visible = true;
      commuter.position.set(p.x, TV.terrainHeight(p.x, p.z), p.z);
      commuter.rotation.y = destination.angle;
      trip.completedTrips += 1;
      trip.phase = 'walking';
      trip.routeCursor = 0;
      trip.activityCursor = 0;
      trip.returnCursor = pedestrianRoutes[trip.destinationIndex].outbound.length - 2;
    });
  }

  function followPath(commuter, path, cursorKey, dt, speed) {
    let cursor = tripSafeCursor(path, commuter, cursorKey);
    const target = path[cursor];
    if (!target) return true;
    if (moveToward(commuter, target, dt, speed) <= .22) cursor += 1;
    commuter.__toonValleyTransitCursor = cursor;
    return cursor >= path.length;
  }

  function tripSafeCursor(path, commuter, key) {
    const trip = trips.get(commuter);
    const cursor = Number.isInteger(trip?.[key]) ? trip[key] : 0;
    commuter.__toonValleyTransitCursor = cursor;
    return Math.max(0, Math.min(path.length, cursor));
  }

  function updateTrip(commuter, trip, dt) {
    if (trip.phase === 'riding') {
      commuter.userData.riderLifeManaged = true;
      commuter.userData.boarded = true;
      commuter.visible = false;
      return;
    }

    const route = pedestrianRoutes[trip.destinationIndex];
    const destinationStop = stops[trip.destinationIndex];
    commuter.userData.riderLifeManaged = true;
    commuter.userData.boarded = false;
    commuter.visible = true;

    if (trip.phase === 'walking') {
      const target = route.outbound[trip.routeCursor];
      if (!target || moveToward(commuter, target, dt) <= .22) trip.routeCursor += 1;
      if (trip.routeCursor >= route.outbound.length) {
        trip.phase = 'activity';
        trip.activityCursor = 1;
      }
      return;
    }

    if (trip.phase === 'activity') {
      const target = route.activity[trip.activityCursor];
      if (!target || moveToward(commuter, target, dt, ACTIVITY_SPEED) <= .22) trip.activityCursor += 1;
      if (trip.activityCursor >= route.activity.length) {
        trip.phase = 'returning';
        trip.returnCursor = route.outbound.length - 2;
      }
      return;
    }

    if (trip.phase === 'returning') {
      if (trip.returnCursor >= 0) {
        const target = route.outbound[trip.returnCursor];
        if (!target || moveToward(commuter, target, dt) <= .22) trip.returnCursor -= 1;
        return;
      }
      const p = waitPosition(commuter, destinationStop);
      if (moveToward(commuter, p, dt) <= .22) {
        commuter.position.set(p.x, TV.terrainHeight(p.x, p.z), p.z);
        commuter.rotation.y = destinationStop.angle;
        commuter.userData.riderLifeManaged = false;
        commuter.userData.cooldown = Math.max(commuter.userData.cooldown || 0, Transit.stopDwellSeconds + 2.2);
        trips.delete(commuter);
      }
    }
  }

  function updateTrips(dt = 0) {
    const current = nearestStopIndex();
    Steward.commuters.forEach(commuter => {
      let trip = trips.get(commuter);
      if (commuter.userData.boarded && !trip) trip = beginTrip(commuter);
      if (trip) updateTrip(commuter, trip, dt);
    });
    if (Transit.stopped && current.distance < 7) processStopArrival(current.index);
  }

  function updatePassengers() {
    Steward.commuters.forEach((commuter, index) => {
      const trip = trips.get(commuter);
      const visible = Boolean(trip?.phase === 'riding' && commuter.userData.boarded);
      passengerSlots[index].visible = visible;
      if (visible) passengerSlots[index].position.y = .96 + Math.sin(clock * 4 + index) * .012;
    });
  }

  TV.registerUpdateHook(dt => {
    clock += dt;
    updateTrips(dt);
    updatePassengers();
    updateBoards();
  });

  function getTripState() {
    return Steward.commuters.map(commuter => {
      const trip = trips.get(commuter);
      const destinationPoint = trip ? destinations[trip.destinationIndex] : null;
      const route = trip ? pedestrianRoutes[trip.destinationIndex] : null;
      return {
        name: commuter.name,
        stop: commuter.userData.stop?.name || null,
        boarded: Boolean(commuter.userData.boarded),
        visible: commuter.visible,
        origin: trip ? stops[trip.originIndex]?.name : null,
        destination: trip ? stops[trip.destinationIndex]?.name : null,
        phase: trip?.phase || null,
        disembarking: Boolean(trip && trip.phase !== 'riding'),
        walkingToDestination: Boolean(trip?.phase === 'walking'),
        destinationActivity: Boolean(trip?.phase === 'activity'),
        returningToStop: Boolean(trip?.phase === 'returning'),
        routeCursor: trip?.routeCursor ?? null,
        activityCursor: trip?.activityCursor ?? null,
        destinationPoint: destinationPoint ? { ...destinationPoint } : null,
        routePointCount: route?.outbound.length || 0,
        activityPointCount: route?.activity.length || 0,
        distanceToDestination: destinationPoint ? Math.hypot(commuter.position.x - destinationPoint.x, commuter.position.z - destinationPoint.z) : null
      };
    });
  }

  function getBoardState() {
    return stopBoards.map(board => ({
      stop: board.stop.name,
      nextDestination: stops[(board.index + 1) % stops.length].name,
      etaSeconds: board.eta,
      near: board.near,
      litBars: board.bars.filter(bar => bar.material.emissiveIntensity > 0).length
    }));
  }

  function getPassengerState() {
    return {
      activePassengers: passengerSlots.filter(slot => slot.visible).length,
      slots: passengerSlots.map(slot => slot.visible)
    };
  }

  window.ToonValleyTransitRiderLife = Object.freeze({
    active: true,
    destinationTrips: true,
    physicalDisembark: true,
    dynamicStopBoards: true,
    visibleBusPassengers: true,
    destinationWalks: true,
    sidewalkRouting: true,
    destinationActivities: true,
    stopBoards,
    passengerSlots,
    destinations,
    pedestrianRoutes,
    getTripState,
    getBoardState,
    getPassengerState,
    chooseDestination,
    processStopArrival,
    refresh: (dt = 0) => { updateTrips(dt); updatePassengers(); updateBoards(); }
  });
  console.info('Toon Valley transit rider life ready', {
    commuters: Steward.commuters.length,
    boards: stopBoards.length,
    destinationTrips: true,
    visibleBusPassengers: true,
    destinationWalks: true,
    sidewalkRouting: true,
    destinationActivities: true
  });
})();
