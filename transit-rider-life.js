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
  let boardTextClock = -1;

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

  function makeBoardLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 160;
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.84, .76), material);
    mesh.position.set(0, 0, .086);
    return { canvas, texture, mesh };
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
    destination.visible = false;
    g.add(destination);
    const bars = Array.from({ length: 4 }, (_, n) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.16, .12, .05), new THREE.MeshToonMaterial({ color: 0x4a5560, emissive: 0x000000, emissiveIntensity: 0 }));
      m.position.set(-.3 + n * .2, -.26, .09);
      g.add(m);
      return m;
    });
    const label = makeBoardLabel();
    label.mesh.position.y = .08;
    g.add(label.mesh);
    return { group: g, destination, bars, label, index, stop, eta: 0, near: false, waiting: 0, nextDestination: '' };
  });

  function routeDistanceToStop(stop) {
    return Math.hypot(Transit.bus.position.x - stop.routeX, Transit.bus.position.z - stop.routeZ);
  }

  function drawBoard(board) {
    const { canvas, texture } = board.label;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#18232d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fbff';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(board.stop.name.toUpperCase(), 18, 38);
    ctx.fillStyle = '#8fe9ff';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(`NEXT  ${board.nextDestination}`, 18, 76);
    ctx.fillStyle = board.near ? '#87f2a4' : '#ffd86e';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(board.near ? 'SHUTTLE ARRIVING' : `ETA ~${board.eta}s`, 18, 112);
    ctx.fillStyle = '#d8e0e7';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(`${board.waiting} WAITING`, 18, 142);
    texture.needsUpdate = true;
  }

  function updateBoards(forceText = false) {
    stopBoards.forEach(board => {
      const d = routeDistanceToStop(board.stop);
      const near = d < 18;
      board.near = near;
      board.eta = Math.max(0, Math.round(d / 6.4));
      board.nextDestination = stops[(board.index + 1) % stops.length].name;
      board.waiting = Steward.commuters.filter(c => !c.userData.boarded && c.userData.stop === board.stop).length;
      const lit = near ? 4 : d < 40 ? 3 : d < 75 ? 2 : 1;
      board.bars.forEach((bar, i) => {
        const active = i < lit;
        bar.material.color.setHex(active ? 0x68e48d : 0x4a5560);
        bar.material.emissive.setHex(active ? 0x145d2c : 0x000000);
        bar.material.emissiveIntensity = active ? (near ? .85 : .35) : 0;
      });
      if (forceText || Math.floor(clock) !== boardTextClock) drawBoard(board);
    });
    boardTextClock = Math.floor(clock);
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
      const target = waitPosition(commuter, destination);
      const start = { x: Transit.bus.position.x, z: Transit.bus.position.z };
      commuter.userData.boarded = false;
      commuter.visible = true;
      commuter.userData.stop = destination;
      commuter.position.set(start.x, TV.terrainHeight(start.x, start.z), start.z);
      commuter.rotation.y = destination.angle;
      trip.completedTrips += 1;
      trip.disembarkingStartedAt = clock;
      trip.disembarkingUntil = clock + Math.max(1.5, Transit.stopDwellSeconds + .35);
      trip.disembarkStart = start;
      trip.disembarkTarget = target;
    });
  }

  function updateTrips() {
    const current = nearestStopIndex();
    Steward.commuters.forEach(commuter => {
      let trip = trips.get(commuter);
      const stopIndex = Math.max(0, stops.indexOf(commuter.userData.stop));

      if (commuter.userData.boarded && !trip) {
        const destinationIndex = chooseDestination(stopIndex, commuter.userData.slot || 0);
        trip = { originIndex: stopIndex, destinationIndex, boardedAt: clock, disembarkingStartedAt: 0, disembarkingUntil: 0, disembarkStart: null, disembarkTarget: null, completedTrips: 0 };
        trips.set(commuter, trip);
      }

      if (!trip) return;

      // The legacy commuter animator used to eject riders after its five-second cooldown.
      // Once a destination trip exists, this layer owns the rider until the assigned stop.
      if (!trip.disembarkingUntil && !commuter.userData.boarded) {
        commuter.userData.boarded = true;
        commuter.visible = false;
      }

      if (trip.disembarkingUntil > clock) {
        const destination = stops[trip.destinationIndex];
        const start = trip.disembarkStart || { x: Transit.bus.position.x, z: Transit.bus.position.z };
        const target = trip.disembarkTarget || waitPosition(commuter, destination);
        const duration = Math.max(.6, trip.disembarkingUntil - trip.disembarkingStartedAt);
        const t = Math.min(1, Math.max(0, (clock - trip.disembarkingStartedAt) / duration));
        const eased = 1 - Math.pow(1 - t, 2);
        const x = start.x + (target.x - start.x) * eased;
        const z = start.z + (target.z - start.z) * eased;
        commuter.userData.boarded = false;
        commuter.visible = true;
        commuter.position.set(x, TV.terrainHeight(x, z), z);
        commuter.rotation.y = Math.atan2(target.x - x, target.z - z);
        commuter.userData.stop = destination;
        return;
      }

      if (trip.disembarkingUntil && trip.disembarkingUntil <= clock) {
        const destination = stops[trip.destinationIndex];
        const target = trip.disembarkTarget || waitPosition(commuter, destination);
        commuter.userData.boarded = false;
        commuter.visible = true;
        commuter.userData.stop = destination;
        commuter.position.set(target.x, TV.terrainHeight(target.x, target.z), target.z);
        commuter.rotation.y = destination.angle;
        trips.delete(commuter);
      }
    });
    if (Transit.stopped && current.distance < 7) processStopArrival(current.index);
  }

  TV.registerUpdateHook(dt => {
    clock += dt;
    updateTrips();
    updateBoards();
  });
  updateBoards(true);

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
        disembarking: Boolean(trip?.disembarkingUntil > clock),
        completedTrips: trip?.completedTrips || 0
      };
    });
  }

  function getBoardState() {
    return stopBoards.map(board => ({
      stop: board.stop.name,
      nextDestination: board.nextDestination || stops[(board.index + 1) % stops.length].name,
      etaSeconds: board.eta,
      near: board.near,
      waiting: board.waiting,
      readableLabel: Boolean(board.label?.texture),
      litBars: board.bars.filter(bar => bar.material.emissiveIntensity > 0).length
    }));
  }

  window.ToonValleyTransitRiderLife = Object.freeze({
    active: true,
    destinationTrips: true,
    rideLifecycleOwnership: true,
    physicalDisembark: true,
    animatedDisembark: true,
    dynamicStopBoards: true,
    readableStopBoards: true,
    stopBoards,
    getTripState,
    getBoardState,
    chooseDestination,
    processStopArrival,
    refresh: () => { updateTrips(); updateBoards(true); }
  });
  console.info('Toon Valley transit rider life ready', { commuters: Steward.commuters.length, boards: stopBoards.length, destinationTrips: true, animatedDisembark: true, readableStopBoards: true });
})();
