(() => {
  'use strict';
  const TV = window.ToonValley, Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-community-life-v1';
  const state = Object.assign({ trailDay: -1, trailVisited: [], errandDay: -1, errandIndex: 0, errandVisited: [], errandDone: false }, (() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; }
  })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
  const root = new THREE.Group();
  TV.scene.add(root);

  const trail = [
    { name: 'Pine Gate', x: -130, z: 88 },
    { name: 'Foxglove Bend', x: -166, z: 116 },
    { name: 'Cloud Lookout', x: -188, z: 145 },
    { name: 'Sunset Rock', x: -151, z: 164 }
  ];
  const trailMat = TV.mat(0xd89b55), markerMat = TV.mat(0x6eaa55);
  for (let i = 0; i < trail.length; i++) {
    const point = trail[i], y = TV.terrainHeight(point.x, point.z);
    const post = new THREE.Group(); post.position.set(point.x, y, point.z); root.add(post);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,2.1,6), TV.materials.wood); pole.position.y=1.05; post.add(pole);
    const sign = TV.outlinedMesh(TV.unitBox, markerMat, 1.025); sign.scale.set(1.7,.62,.12); sign.position.set(0,1.85,0); post.add(sign);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.18,.42,6), trailMat); cap.position.y=2.45; post.add(cap);
    TV.registerInteraction({ x:point.x, z:point.z, radius:4.2, area:'world', prompt:`Check in at ${point.name}`, action:()=>visitTrail(i) });
  }
  for (let i=0;i<trail.length-1;i++) {
    const a=trail[i], b=trail[i+1], steps=Math.max(3,Math.floor(Math.hypot(b.x-a.x,b.z-a.z)/8));
    for(let s=1;s<steps;s++){
      const t=s/steps,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t),stone=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,.18,8),trailMat);
      stone.position.set(x,TV.terrainHeight(x,z)+.08,z);stone.rotation.y=t*5;root.add(stone);
    }
  }
  const lookout = new THREE.Group(); lookout.position.set(-188, TV.terrainHeight(-188,145)+.15,145); root.add(lookout);
  const deck=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.02);deck.scale.set(5.5,.25,4);deck.position.y=.1;lookout.add(deck);
  for(const x of[-2.55,2.55])for(const z of[-1.7,1.7]){const rail=new THREE.Mesh(TV.unitBox,TV.materials.wood);rail.scale.set(.12,1.4,.12);rail.position.set(x,.85,z);lookout.add(rail);}
  const telescope=TV.outlinedMesh(new THREE.CylinderGeometry(.23,.31,1.8,8),TV.materials.dark,1.02);telescope.rotation.z=Math.PI/2;telescope.position.set(0,1.5,-.7);lookout.add(telescope);
  TV.registerInteraction({x:-188,z:145,radius:4.5,area:'world',prompt:'Use Cloud Lookout telescope',action:()=>TV.showToast('🔭 From here you can see Town Square, Bluebell Lake, and the northern homes.',3)});

  function currentDay(){ return Life.getState().world.day; }
  function ensureTrailDay(){ const d=currentDay(); if(state.trailDay!==d){state.trailDay=d;state.trailVisited=[];save();} }
  function visitTrail(index){
    ensureTrailDay();
    if(state.trailVisited.includes(index)){TV.showToast(`🥾 ${trail[index].name} is already stamped today.`,1.7);return;}
    state.trailVisited.push(index); save(); Life.emitProgress('explore',1,{activity:'hiking-trail',stop:trail[index].name});
    if(state.trailVisited.length===trail.length){Life.addMoney(120,'Mountain trail completion');TV.showToast('🏔️ Trail complete! Ranger reward +$120.',2.8);}
    else TV.showToast(`🥾 Trail stamp ${state.trailVisited.length}/${trail.length}: ${trail[index].name}`,2.2);
  }

  const errands = [
    { title:'Civic Loop', stops:[{name:'City Hall',x:0,z:-9},{name:'Post Office',x:49,z:-20},{name:'Library',x:14,z:-29}] },
    { title:'Neighborhood Check-in', stops:[{name:'North Homes',x:42,z:77},{name:'Sunshine Park',x:-72,z:48},{name:'Town Square',x:0,z:0}] },
    { title:'Valley Explorer', stops:[{name:'Bluebell Lake',x:101,z:-100},{name:'Community Garden',x:-116,z:55},{name:'Cloud Lookout',x:-188,z:145}] }
  ];
  const board=new THREE.Group();board.position.set(10,TV.terrainHeight(10,-2),-2);root.add(board);
  const boardPanel=TV.outlinedMesh(TV.unitBox,TV.mat(0xf3d279),1.025);boardPanel.scale.set(3.8,2.5,.22);boardPanel.position.y=2;board.add(boardPanel);
  for(const x of[-1.5,1.5]){const leg=new THREE.Mesh(TV.unitBox,TV.materials.wood);leg.scale.set(.22,2.2,.22);leg.position.set(x,.85,0);board.add(leg);}
  const roof=TV.outlinedMesh(TV.unitBox,TV.materials.red,1.02);roof.scale.set(4.4,.24,1.05);roof.position.y=3.45;board.add(roof);
  TV.registerInteraction({object:board,radius:4.2,area:'world',prompt:'Check community errand board',action:showErrand});

  function ensureErrandDay(){
    const d=currentDay(); if(state.errandDay===d)return;
    state.errandDay=d; state.errandIndex=d%errands.length; state.errandVisited=[]; state.errandDone=false; save();
  }
  function activeErrand(){ensureErrandDay();return errands[state.errandIndex];}
  function showErrand(){const e=activeErrand();const next=e.stops.find((_,i)=>!state.errandVisited.includes(i));if(state.errandDone)TV.showToast(`📌 ${e.title} completed today. Check back tomorrow.`,2.2);else TV.showToast(`📌 ${e.title}: ${state.errandVisited.length}/${e.stops.length}. Next: ${next?.name}.`,3);}
  errands.forEach((errand,errandIndex)=>errand.stops.forEach((stop,stopIndex)=>{
    TV.registerInteraction({x:stop.x,z:stop.z,radius:5,area:'world',prompt:`Community errand: ${stop.name}`,enabled:()=>{ensureErrandDay();return !state.errandDone&&state.errandIndex===errandIndex&&!state.errandVisited.includes(stopIndex);},action:()=>completeErrandStop(errandIndex,stopIndex)});
  }));
  function completeErrandStop(errandIndex,stopIndex){
    ensureErrandDay(); if(state.errandDone||state.errandIndex!==errandIndex||state.errandVisited.includes(stopIndex))return;
    const e=errands[errandIndex];state.errandVisited.push(stopIndex);Life.emitProgress('help',1,{activity:'community-errand',stop:e.stops[stopIndex].name});
    if(state.errandVisited.length===e.stops.length){state.errandDone=true;Life.addMoney(165,`Community errand: ${e.title}`);TV.showToast(`✅ ${e.title} complete! +$165`,2.8);}else{const next=e.stops.find((_,i)=>!state.errandVisited.includes(i));TV.showToast(`📍 Checked ${e.stops[stopIndex].name}. Next: ${next.name}.`,2.5);} save();
  }

  window.ToonValleyCommunityLife=Object.freeze({counts:{trailStops:trail.length,errandRoutes:errands.length,errandStops:errands.reduce((n,e)=>n+e.stops.length,0)},trail,errands,getState:()=>({...state,trailVisited:[...state.trailVisited],errandVisited:[...state.errandVisited]}),visitTrail,showErrand});
  console.info('Toon Valley community life ready',window.ToonValleyCommunityLife.counts);
})();
