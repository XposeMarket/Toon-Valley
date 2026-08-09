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
  let clock = 0;

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

  function processStopArrival(index) {
    Steward.commuters.forEach(commuter => {
      const trip = trips.get(commuter);
      if (!trip || !commuter.userData.boarded || index !== trip.destinationIndex) return;
      const destination = stops[trip.destinationIndex];
      const p = waitPosition(commuter, destination);
      commuter.userData.boarded = false;
      commuter.visible = true;
      commuter.userData.stop = destination;
      commuter.position.set(p.x, TV.terrainHeight(p.x, p.z), p.z);
      commuter.rotation.y = destination.angle;
      trip.completedTrips += 1;
      trip.disembarkingUntil = clock + Math.max(1.2, Transit.stopDwellSeconds + .25);
    });
  }

  function updateTrips() {
    const current = nearestStopIndex();
    Steward.commuters.forEach(commuter => {
      let trip = trips.get(commuter);
      const stopIndex = Math.max(0, stops.indexOf(commuter.userData.stop));

      if (commuter.userData.boarded && !trip) {
        const destinationIndex = chooseDestination(stopIndex, commuter.userData.slot || 0);
        trip = { originIndex: stopIndex, destinationIndex, boardedAt: clock, disembarkingUntil: 0, completedTrips: 0 };
        trips.set(commuter, trip);
      }

      if (!trip) return;

      if (trip.disembarkingUntil > clock) {
        const destination = stops[trip.destinationIndex];
        const p = waitPosition(commuter, destination);
        commuter.userData.boarded = false;
        commuter.visible = true;
        commuter.position.set(p.x, TV.terrainHeight(p.x, p.z), p.z);
        commuter.rotation.y = destination.angle;
        commuter.userData.stop = destination;
        return;
      }

      if (trip.disembarkingUntil && trip.disembarkingUntil <= clock) {
        trips.delete(commuter);
        return;
      }
    });
    if (Transit.stopped && current.distance < 7) processStopArrival(current.index);
  }

  TV.registerUpdateHook(dt => {
    clock += dt;
    updateTrips();
    updateBoards();
  });

  function getTripState() {
    return Steward.commuters.map(commuter => {
      const trip = trips.get(commuter);
      return {
        name: commuter.name,
        stop: commuter.userData.stop?.name || null,
        boarded: Boolean(commuter.userData.boarded),
        visible: commuter.visible,
        origin: trip ? stops[trip.originIndex]?.name : null,
        destination: trip ? stops[trip.destinationIndex]?.name : null,
        disembarking: Boolean(trip?.disembarkingUntil > clock)
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

  window.ToonValleyTransitRiderLife = Object.freeze({
    active: true,
    destinationTrips: true,
    physicalDisembark: true,
    dynamicStopBoards: true,
    stopBoards,
    getTripState,
    getBoardState,
    chooseDestination,
    processStopArrival,
    refresh: () => { updateTrips(); updateBoards(); }
  });
  console.info('Toon Valley transit rider life ready', { commuters: Steward.commuters.length, boards: stopBoards.length, destinationTrips: true });
})();
