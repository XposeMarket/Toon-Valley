(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const{THREE}=TV;
  const KEY='toon-valley-community-life-v1';
  const defaults={trailDay:-1,trailStarted:false,trailVisited:[],trailAwaitingSignoff:false,trailDone:false,errandDay:-1,errandIndex:0,errandStarted:false,errandVisited:[],errandAwaitingSignoff:false,errandDone:false};
  const state=Object.assign({...defaults},(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}})());
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}};
  const root=new THREE.Group();TV.scene.add(root);

  // Every stop is comfortably inside the playable radius. The route begins at the
  // west road and uses visible switchbacks instead of an invisible boundary climb.
  const trail=[
    {name:'Pine Gate',x:-126,z:78},
    {name:'Foxglove Bend',x:-160,z:115},
    {name:'Cloud Lookout',x:-172,z:137},
    {name:'Sunset Rock',x:-151,z:158}
  ];
  const trailPath=[[-100,34],[-104,46],[-111,55],[-119,66],[-126,78],[-136,87],[-146,98],[-154,108],[-160,115],[-166,124],[-171,134],[-172,137],[-168,146],[-159,153],[-151,158]];
  const trailMat=TV.mat(0xb98752),trailAlt=TV.mat(0xc89960),markerMat=TV.mat(0x6eaa55),edgeMat=TV.mat(0xe0c08b);
  let trailTiles=0,guideStones=0;
  for(let p=0;p<trailPath.length-1;p++){
    const a=trailPath[p],b=trailPath[p+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(len/3.1));
    for(let s=0;s<steps;s++){
      const t0=s/steps,t1=(s+1)/steps,x0=THREE.MathUtils.lerp(a[0],b[0],t0),z0=THREE.MathUtils.lerp(a[1],b[1],t0),x1=THREE.MathUtils.lerp(a[0],b[0],t1),z1=THREE.MathUtils.lerp(a[1],b[1],t1),mx=(x0+x1)*.5,mz=(z0+z1)*.5,seg=Math.hypot(x1-x0,z1-z0),angle=Math.atan2(x1-x0,z1-z0);
      const tile=new THREE.Mesh(TV.unitBox,(trailTiles%5===0)?trailAlt:trailMat);tile.scale.set(4.5,.11,seg+.28);tile.position.set(mx,TV.terrainHeight(mx,mz)+.075,mz);tile.rotation.y=angle;root.add(tile);trailTiles++;
      if(trailTiles%4===0){
        const nx=Math.cos(angle),nz=-Math.sin(angle);
        for(const side of[-1,1]){const stone=TV.outlinedMesh(new THREE.DodecahedronGeometry(.22,0),edgeMat,1.025);stone.position.set(mx+nx*2.45*side,TV.terrainHeight(mx+nx*2.45*side,mz+nz*2.45*side)+.11,mz+nz*2.45*side);stone.scale.y=.65;root.add(stone);guideStones++;}
      }
    }
  }

  const gate=new THREE.Group();gate.position.set(-104,TV.terrainHeight(-104,46),46);root.add(gate);
  for(const x of[-2.25,2.25]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,3.4,7),TV.materials.wood);post.position.set(x,1.7,0);gate.add(post)}
  const beam=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.025);beam.scale.set(5.1,.36,.42);beam.position.y=3.18;gate.add(beam);
  const gateSign=TV.outlinedMesh(TV.unitBox,TV.materials.yellow,1.025);gateSign.scale.set(3.1,.72,.16);gateSign.position.set(0,2.55,.28);gate.add(gateSign);
  TV.registerInteraction({x:-104,z:46,radius:4.5,area:'world',prompt:'Mountain Trail ranger station',action:handleTrailGate});

  for(let i=0;i<trail.length;i++){
    const point=trail[i],y=TV.terrainHeight(point.x,point.z),post=new THREE.Group();post.position.set(point.x,y,point.z);root.add(post);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,2.4,6),TV.materials.wood);pole.position.y=1.2;post.add(pole);
    const sign=TV.outlinedMesh(TV.unitBox,markerMat,1.025);sign.scale.set(2.15,.7,.14);sign.position.set(0,2.05,0);post.add(sign);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.2,.5,6),TV.materials.yellow);cap.position.y=2.65;post.add(cap);
    TV.registerInteraction({x:point.x,z:point.z,radius:4.6,area:'world',prompt:`Stamp trail card at ${point.name}`,enabled:()=>trailStopEnabled(i),action:()=>visitTrail(i)});
  }

  const lookoutPoint=trail[2],lookout=new THREE.Group();lookout.position.set(lookoutPoint.x,TV.terrainHeight(lookoutPoint.x,lookoutPoint.z)+.15,lookoutPoint.z);root.add(lookout);
  const deck=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.02);deck.scale.set(5.5,.25,4);deck.position.y=.1;lookout.add(deck);
  for(const x of[-2.55,2.55])for(const z of[-1.7,1.7]){const rail=new THREE.Mesh(TV.unitBox,TV.materials.wood);rail.scale.set(.12,1.4,.12);rail.position.set(x,.85,z);lookout.add(rail)}
  const telescope=TV.outlinedMesh(new THREE.CylinderGeometry(.23,.31,1.8,8),TV.materials.dark,1.02);telescope.rotation.z=Math.PI/2;telescope.position.set(0,1.5,-.7);lookout.add(telescope);
  TV.registerInteraction({x:lookoutPoint.x,z:lookoutPoint.z,radius:4.5,area:'world',prompt:'Use Cloud Lookout telescope',action:()=>TV.showToast('🔭 From here you can see Town Square, Bluebell Lake, and the northern homes.',3)});

  function currentDay(){return Life.getState().world.day}
  function ensureTrailDay(){
    const d=currentDay();if(state.trailDay===d)return;
    state.trailDay=d;state.trailStarted=false;state.trailVisited=[];state.trailAwaitingSignoff=false;state.trailDone=false;save();
  }
  function trailStopEnabled(index){ensureTrailDay();return state.trailStarted&&!state.trailAwaitingSignoff&&!state.trailDone&&state.trailVisited.length===index}
  function handleTrailGate(){
    ensureTrailDay();
    if(state.trailDone){TV.showToast('🥾 Today’s Mountain Trail card is signed off. Come back tomorrow for a fresh route.',2.7);return}
    if(!state.trailStarted){state.trailStarted=true;state.trailVisited=[];state.trailAwaitingSignoff=false;save();TV.showToast('🥾 Ranger: “Trail card issued. Follow the brown switchbacks and stamp all four marked stops, then bring the card back here.”',4);return}
    if(state.trailAwaitingSignoff){state.trailAwaitingSignoff=false;state.trailStarted=false;state.trailDone=true;Life.addMoney(120,'Mountain trail ranger sign-off');Life.emitProgress('explore',2,{activity:'hiking-trail-complete'});save();TV.showToast('🏔️ Ranger: “Four stamps, full route. Nice hike!” Trail sign-off complete · +$120',3.6);return}
    const next=trail[state.trailVisited.length];TV.showToast(`🥾 Trail card ${state.trailVisited.length}/${trail.length}. Next stamp: ${next?.name}. Return here after Sunset Rock.`,3);
  }
  function visitTrail(index){
    ensureTrailDay();if(!trailStopEnabled(index))return;
    state.trailVisited.push(index);Life.emitProgress('explore',1,{activity:'hiking-trail',stop:trail[index].name});
    if(state.trailVisited.length===trail.length){state.trailAwaitingSignoff=true;TV.showToast('🏔️ All four trail stamps collected. Hike back down to the Mountain Trail ranger station for sign-off and payment.',3.8)}
    else TV.showToast(`🥾 Trail stamp ${state.trailVisited.length}/${trail.length}: ${trail[index].name}. Next: ${trail[state.trailVisited.length].name}.`,2.6);
    save();
  }

  const errands=[
    {title:'Civic Loop',stops:[{name:'City Hall',x:0,z:-9},{name:'Post Office',x:49,z:-20},{name:'Library',x:14,z:-29}]},
    {title:'Neighborhood Check-in',stops:[{name:'North Homes',x:42,z:77},{name:'Sunshine Park',x:-72,z:48},{name:'Town Square',x:0,z:0}]},
    {title:'Valley Explorer',stops:[{name:'Bluebell Lake',x:82,z:-70},{name:'Community Garden',x:-116,z:55},{name:'Cloud Lookout',x:lookoutPoint.x,z:lookoutPoint.z}]}
  ];
  const board=new THREE.Group();board.position.set(10,TV.terrainHeight(10,-2),-2);root.add(board);
  const boardPanel=TV.outlinedMesh(TV.unitBox,TV.mat(0xf3d279),1.025);boardPanel.scale.set(3.8,2.5,.22);boardPanel.position.y=2;board.add(boardPanel);
  for(const x of[-1.5,1.5]){const leg=new THREE.Mesh(TV.unitBox,TV.materials.wood);leg.scale.set(.22,2.2,.22);leg.position.set(x,.85,0);board.add(leg)}
  const roof=TV.outlinedMesh(TV.unitBox,TV.materials.red,1.02);roof.scale.set(4.4,.24,1.05);roof.position.y=3.45;board.add(roof);
  TV.registerInteraction({object:board,radius:4.2,area:'world',prompt:'Check community errand board',action:showErrand});
  function ensureErrandDay(){
    const d=currentDay();if(state.errandDay===d)return;
    state.errandDay=d;state.errandIndex=d%errands.length;state.errandStarted=false;state.errandVisited=[];state.errandAwaitingSignoff=false;state.errandDone=false;save();
  }
  function activeErrand(){ensureErrandDay();return errands[state.errandIndex]}
  function showErrand(){
    const e=activeErrand();
    if(state.errandDone){TV.showToast(`📌 ${e.title} signed off and paid today. Check back tomorrow.`,2.5);return}
    if(!state.errandStarted){state.errandStarted=true;state.errandVisited=[];state.errandAwaitingSignoff=false;save();TV.showToast(`📌 Accepted: ${e.title}. Check in at ${e.stops[0].name}, follow all three stops in order, then return to this board for sign-off.`,4);return}
    if(state.errandAwaitingSignoff){state.errandAwaitingSignoff=false;state.errandStarted=false;state.errandDone=true;Life.addMoney(165,`Community errand sign-off: ${e.title}`);Life.emitProgress('help',2,{activity:'community-errand-complete',route:e.title});save();TV.showToast(`✅ ${e.title} signed off at the board · +$165`,3.2);return}
    const next=e.stops[state.errandVisited.length];TV.showToast(`📌 ${e.title}: ${state.errandVisited.length}/${e.stops.length}. Next check-in: ${next?.name}. Return here after the third stop.`,3.2);
  }
  errands.forEach((errand,errandIndex)=>errand.stops.forEach((stop,stopIndex)=>TV.registerInteraction({x:stop.x,z:stop.z,radius:5,area:'world',prompt:`Community errand: ${stop.name}`,enabled:()=>{ensureErrandDay();return state.errandStarted&&!state.errandDone&&!state.errandAwaitingSignoff&&state.errandIndex===errandIndex&&state.errandVisited.length===stopIndex},action:()=>completeErrandStop(errandIndex,stopIndex)})));
  function completeErrandStop(errandIndex,stopIndex){
    ensureErrandDay();if(!state.errandStarted||state.errandDone||state.errandAwaitingSignoff||state.errandIndex!==errandIndex||state.errandVisited.length!==stopIndex)return;
    const e=errands[errandIndex];state.errandVisited.push(stopIndex);Life.emitProgress('help',1,{activity:'community-errand',stop:e.stops[stopIndex].name});
    if(state.errandVisited.length===e.stops.length){state.errandAwaitingSignoff=true;TV.showToast(`📍 ${e.title} route complete. Return to the community errand board for final sign-off and payment.`,3.6)}
    else{const next=e.stops[state.errandVisited.length];TV.showToast(`📍 Checked ${e.stops[stopIndex].name}. Next: ${next.name}.`,2.5)}
    save();
  }
  const maxRadius=Math.max(...trail.map(p=>Math.hypot(p.x,p.z)));
  window.ToonValleyCommunityLife=Object.freeze({counts:{trailStops:trail.length,trailTiles,guideStones,errandRoutes:errands.length,errandStops:errands.reduce((n,e)=>n+e.stops.length,0)},trail,trailPath:trailPath.map(p=>p.slice()),trailMaxRadius:maxRadius,errands,getState:()=>({...state,trailVisited:[...state.trailVisited],errandVisited:[...state.errandVisited]}),handleTrailGate,visitTrail,showErrand});
  console.info('Toon Valley community life ready',window.ToonValleyCommunityLife.counts);
})();
