(() => {
  'use strict';
  const TV = window.ToonValley, Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const root = new THREE.Group();
  TV.scene.add(root);
  const stops = [
    { name: 'Town Square', x: 17, z: -7, angle: Math.PI / 2 },
    { name: 'Sunshine Park', x: -91, z: 28, angle: 0 },
    { name: 'North Homes', x: 42, z: 77, angle: Math.PI },
    { name: 'Bluebell Lake', x: 92, z: -88, angle: -Math.PI / 3 }
  ];
  const route = [[17,-7],[72,-7],[91,12],[91,58],[42,77],[-12,77],[-75,67],[-91,28],[-91,-7],[-44,-7],[17,-7],[65,-38],[92,-67],[92,-88],[78,-62],[52,-38],[17,-7]];
  const shelterMat = TV.mat(0xf4df9c), routeMat = TV.mat(0x4d91d8), glassMat = TV.materials.glass;
  for (const stop of stops) {
    const g = new THREE.Group();
    g.position.set(stop.x, TV.terrainHeight(stop.x, stop.z), stop.z);
    g.rotation.y = stop.angle;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,2.6,6), TV.materials.dark); post.position.set(-1.5,1.3,0); g.add(post);
    const sign = TV.outlinedMesh(TV.unitBox, routeMat, 1.025); sign.scale.set(1.35,.75,.12); sign.position.set(-1.5,2.45,0); g.add(sign);
    const roof = TV.outlinedMesh(TV.unitBox, shelterMat, 1.02); roof.scale.set(3.5,.16,1.7); roof.position.set(.5,2.45,0); g.add(roof);
    const back = new THREE.Mesh(TV.unitBox, glassMat); back.scale.set(3.3,2.05,.08); back.position.set(.5,1.25,-.78); g.add(back);
    const bench = TV.outlinedMesh(TV.unitBox, TV.materials.wood, 1.02); bench.scale.set(2.3,.22,.55); bench.position.set(.5,.62,-.35); g.add(bench);
    root.add(g);
    TV.registerInteraction({ x: stop.x, z: stop.z, radius: 4.5, area:'world', prompt:`Wait at ${stop.name} shuttle stop`, action:()=>waitAt(stop) });
  }
  const bus = new THREE.Group();
  const body = TV.outlinedMesh(TV.unitBox, routeMat, 1.025); body.scale.set(5.6,2.1,2.45); body.position.y=1.55; bus.add(body);
  const roof = TV.outlinedMesh(TV.unitBox, TV.materials.white, 1.02); roof.scale.set(5.25,.45,2.3); roof.position.y=2.82; bus.add(roof);
  for (const x of [-1.65,0,1.65]) for (const z of [-1.24,1.24]) { const w=new THREE.Mesh(TV.unitBox,glassMat);w.scale.set(1.05,.78,.08);w.position.set(x,1.82,z);bus.add(w); }
  for (const x of [-1.75,1.75]) for (const z of [-1.12,1.12]) { const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.3,10),TV.materials.dark);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.6,z);bus.add(wheel); }
  const destination = TV.outlinedMesh(TV.unitBox, TV.materials.yellow, 1.02); destination.scale.set(1.8,.42,.09); destination.position.set(0,2.28,-1.27); bus.add(destination);
  root.add(bus);
  let segment=0, progress=0, dwell=0, riding=false, clock=0;
  function nearestStopTo(x,z) { let best=0,dist=Infinity;stops.forEach((s,i)=>{const d=Math.hypot(x-s.x,z-s.z);if(d<dist){dist=d;best=i;}});return { index:best, distance:dist }; }
  function routeDistanceTo(stop) { return Math.hypot(bus.position.x-stop.x,bus.position.z-stop.z); }
  function waitAt(stop) {
    const d=routeDistanceTo(stop);
    if (d < 8) return board(stop);
    const estimate=Math.max(1,Math.round(d/18));
    TV.showToast(`🚌 Valley Shuttle is about ${estimate} minute${estimate===1?'':'s'} away. Watch for the blue bus.`,2.7);
  }
  function board(stop) {
    if (riding) return;
    riding=true;
    TV.playerVelocity.set(0,0,0); TV.state.jumpVelocity=0; TV.state.grounded=true; TV.state.cameraReady=false;
    TV.showToast(`🚌 Riding from ${stop.name}. Press E to get off when the shuttle pauses at a stop.`,3.2);
    Life.emitProgress('explore',1,{activity:'valley-shuttle'});
  }
  function leaveAt(stop) {
    riding=false;
    const sideX=Math.cos(bus.rotation.y)*3.2, sideZ=-Math.sin(bus.rotation.y)*3.2;
    TV.player.position.set(stop.x+sideX,TV.terrainHeight(stop.x+sideX,stop.z+sideZ),stop.z+sideZ);
    TV.playerVelocity.set(0,0,0);TV.state.cameraReady=false;
    TV.showToast(`🚏 Arrived at ${stop.name}.`,2);
  }
  document.addEventListener('keydown',(event)=>{
    if(!riding||event.code!=='KeyE'||event.repeat)return;
    const near=nearestStopTo(bus.position.x,bus.position.z);
    if(dwell>0 && near.distance<8){event.preventDefault();event.stopImmediatePropagation();leaveAt(stops[near.index]);}
    else TV.showToast('The shuttle can only stop at marked bus stops.',1.6);
  },true);
  function advanceBus(dt) {
    if (dwell>0) { dwell=Math.max(0,dwell-dt); return; }
    const a=route[segment], b=route[(segment+1)%route.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    progress += dt*7.2/Math.max(.1,len);
    if(progress>=1){segment=(segment+1)%route.length;progress=0;const near=nearestStopTo(b[0],b[1]);if(near.distance<10)dwell=3.2;}
    const p0=route[segment],p1=route[(segment+1)%route.length];
    bus.position.x=THREE.MathUtils.lerp(p0[0],p1[0],progress);bus.position.z=THREE.MathUtils.lerp(p0[1],p1[1],progress);bus.position.y=TV.terrainHeight(bus.position.x,bus.position.z)+.22;
    bus.rotation.y=Math.atan2(p1[0]-p0[0],p1[1]-p0[1]);
  }
  TV.registerUpdateHook(dt=>{clock+=dt;advanceBus(dt);body.position.y=1.55+Math.sin(clock*5)*.015;if(riding){TV.player.position.set(bus.position.x,bus.position.y+.85,bus.position.z);TV.player.rotation.y=bus.rotation.y;TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;TV.state.grounded=true;TV.state.cameraReady=false;}});
  window.ToonValleyTransit=Object.freeze({counts:{stops:stops.length,buses:1},stops,bus,get riding(){return riding;}});
  console.info('Valley Shuttle ready',window.ToonValleyTransit.counts);
})();
