(() => {
  'use strict';
  const STORAGE_KEY = 'toon-valley-world-events-v3';
  const LEGACY_STORAGE_KEYS = ['toon-valley-world-events-v2','toon-valley-world-events-v1'];
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const state = loadState();
  const forageNodes = [], trailMarkers = [], litterNodes = [], birdSpots = [];

  function defaultState() {
    return { forageDay:0,gathered:[],forageHandedIn:false,trailDay:0,trailProgress:0,cleanupDay:0,cleaned:[],cleanupHandedIn:false,birdDay:0,birdsSeen:[] };
  }
  function loadState() {
    try {
      let saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) for (const key of LEGACY_STORAGE_KEYS) { saved = localStorage.getItem(key); if (saved) break; }
      return Object.assign(defaultState(), JSON.parse(saved || '{}'));
    } catch (_) { return defaultState(); }
  }
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(error){console.warn('Unable to persist Toon Valley world events',error)}}
  function currentDay(){return Life.getState().world.day}

  function makeQuestMarker(color=0xf0cf58){
    const group=new THREE.Group();
    const bar=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.035);bar.scale.set(.15,.6,.15);bar.position.y=1.55;group.add(bar);
    const dot=TV.outlinedMesh(new THREE.SphereGeometry(.14,8,6),TV.mat(color),1.035);dot.position.y=.98;group.add(dot);
    return group;
  }

  function makeBerryBush(x,z,index){
    const group=new THREE.Group();
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,.7,6),TV.materials.brown||TV.mat(0x76523b));stem.position.y=.35;group.add(stem);
    for(let i=0;i<5;i++){const leaf=TV.outlinedMesh(new THREE.SphereGeometry(.35,6,4),TV.materials.green||TV.mat(0x59a84f),1.04);leaf.position.set(Math.cos(i*1.26)*.34,.7+(i%2)*.18,Math.sin(i*1.26)*.34);leaf.scale.y=.75;group.add(leaf)}
    for(let i=0;i<4;i++){const berry=new THREE.Mesh(new THREE.SphereGeometry(.09,6,4),TV.materials.red||TV.mat(0xd84a62));berry.position.set(Math.cos(i*1.57)*.42,.82,Math.sin(i*1.57)*.42);group.add(berry)}
    group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);forageNodes.push({group,index});
    TV.registerInteraction({object:group,radius:2.2,area:'world',prompt:'Gather wild berries',enabled:()=>!state.gathered.includes(index)&&!state.forageHandedIn,action:()=>{
      if(state.gathered.includes(index)||state.forageHandedIn)return;state.gathered.push(index);group.visible=false;Life.emitProgress('explore',1,{activity:'forage'});
      const full=state.gathered.length>=forageNodes.length;TV.showToast(full?'🫐 Basket full! Take the berries to the outdoor market stall for payment.':`🫐 Gathered berries · ${state.gathered.length}/${forageNodes.length}`,full?3:2);persist();
    }});
  }

  function makeForageHandIn(){
    const group=new THREE.Group();const crate=TV.outlinedMesh(TV.unitBox,TV.materials.wood||TV.mat(0x9a704d),1.03);crate.scale.set(1.2,.55,.85);crate.position.y=.32;group.add(crate);const marker=makeQuestMarker(0x6fb8e6);group.add(marker);group.position.set(26,TV.terrainHeight(26,-4),-4);TV.scene.add(group);
    TV.registerInteraction({object:group,radius:3,area:'world',prompt:'Sell gathered berry basket',enabled:()=>state.gathered.length>=forageNodes.length&&!state.forageHandedIn,action:()=>{
      if(state.gathered.length<forageNodes.length||state.forageHandedIn)return;state.forageHandedIn=true;Life.addMoney(145,'Wild berry market basket');Life.emitProgress('explore',2,{activity:'forage-complete'});TV.showToast('🧺 Market vendor: “Beautiful berries!” Basket sold · +$145',3);persist();
    }});
    return group;
  }

  function resetDailyForage(){const d=currentDay();if(state.forageDay===d)return;state.forageDay=d;state.gathered=[];state.forageHandedIn=false;forageNodes.forEach(e=>{e.group.visible=true});persist()}

  function makeTrailMarker(x,z,index){
    const group=new THREE.Group();const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,1.4,6),TV.materials.brown||TV.mat(0x76523b));post.position.y=.7;group.add(post);const sign=TV.outlinedMesh(TV.unitBox,TV.materials.yellow||TV.mat(0xf1c84b),1.04);sign.scale.set(.75,.42,.12);sign.position.y=1.38;group.add(sign);group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);trailMarkers.push(group);
    TV.registerInteraction({object:group,radius:2.5,area:'world',prompt:`Check trail marker ${index+1}`,enabled:()=>state.trailProgress===index,action:()=>{if(state.trailProgress!==index)return;state.trailProgress+=1;TV.showToast(state.trailProgress<trailMarkers.length?`🥾 Trail checkpoint ${state.trailProgress}/${trailMarkers.length}`:'🏅 Valley trail completed! +$120',2.5);if(state.trailProgress>=trailMarkers.length){Life.addMoney(120,'Valley walking trail');Life.emitProgress('explore',3,{activity:'trail'})}persist()}});
  }
  function resetDailyTrail(){const d=currentDay();if(state.trailDay===d)return;state.trailDay=d;state.trailProgress=0;persist()}

  function makeLitter(x,z,index){
    const group=new THREE.Group();const paper=TV.outlinedMesh(TV.unitBox,TV.materials.white||TV.mat(0xf2efe5),1.03);paper.scale.set(.32,.035,.24);paper.rotation.y=index*1.7;paper.position.y=.04;group.add(paper);const can=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.28,8),TV.materials.blue||TV.mat(0x4f83c2));can.rotation.z=Math.PI*.5;can.position.set(.25,.1,-.12);group.add(can);group.position.set(x,TV.terrainHeight(x,z)+.02,z);TV.scene.add(group);litterNodes.push({group,index});
    TV.registerInteraction({object:group,radius:2,area:'world',prompt:'Pick up litter',enabled:()=>!state.cleaned.includes(index)&&!state.cleanupHandedIn,action:()=>{if(state.cleaned.includes(index)||state.cleanupHandedIn)return;state.cleaned.push(index);group.visible=false;Life.emitProgress('help',1,{activity:'cleanup'});const full=state.cleaned.length>=litterNodes.length;TV.showToast(full?'♻️ Cleanup bag is full. Take it to the recycling station by Sunshine Park.':`♻️ Litter collected · ${state.cleaned.length}/${litterNodes.length}`,full?3:2.3);persist()}});
  }

  function makeCleanupHandIn(){
    const group=new THREE.Group();const bin=TV.outlinedMesh(TV.unitBox,TV.mat(0x4a9f72),1.03);bin.scale.set(.8,1.15,.7);bin.position.y=.6;group.add(bin);const lid=new THREE.Mesh(TV.unitBox,TV.materials.dark||TV.mat(0x3f4650));lid.scale.set(.9,.12,.78);lid.position.y=1.2;group.add(lid);const marker=makeQuestMarker(0xf0cf58);group.add(marker);group.position.set(-67,TV.terrainHeight(-67,42),42);TV.scene.add(group);
    TV.registerInteraction({object:group,radius:3,area:'world',prompt:'Turn in the cleanup bag',enabled:()=>state.cleaned.length>=litterNodes.length&&!state.cleanupHandedIn,action:()=>{if(state.cleaned.length<litterNodes.length||state.cleanupHandedIn)return;state.cleanupHandedIn=true;Life.addMoney(125,'Sunshine Park cleanup shift');Life.emitProgress('help',2,{activity:'cleanup-complete'});TV.showToast('♻️ Milo: “The park looks fantastic!” Cleanup shift complete · +$125',3.2);persist()}});
    return group;
  }
  function resetDailyCleanup(){const d=currentDay();if(state.cleanupDay===d)return;state.cleanupDay=d;state.cleaned=[];state.cleanupHandedIn=false;litterNodes.forEach(e=>{e.group.visible=true});persist()}

  function makeBirdSpot(x,z,index,species){
    const group=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,1.2,6),TV.materials.brown||TV.mat(0x76523b));pole.position.y=.6;group.add(pole);const feeder=TV.outlinedMesh(new THREE.SphereGeometry(.22,8,6),TV.materials.red||TV.mat(0xd84a62),1.04);feeder.position.y=1.25;feeder.scale.y=1.25;group.add(feeder);const perch=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.65,6),TV.materials.brown||TV.mat(0x76523b));perch.rotation.z=Math.PI*.5;perch.position.y=1.08;group.add(perch);group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);birdSpots.push({group,index,species});
    TV.registerInteraction({object:group,radius:2.6,area:'world',prompt:`Observe ${species}`,enabled:()=>!state.birdsSeen.includes(index),action:()=>{if(state.birdsSeen.includes(index))return;state.birdsSeen.push(index);Life.emitProgress('explore',1,{activity:'birdwatching',species});const complete=state.birdsSeen.length>=birdSpots.length;if(complete)Life.addMoney(90,'Valley bird survey');TV.showToast(complete?'🐦 Bird survey complete! +$90':`🐦 Logged ${species} · ${state.birdsSeen.length}/${birdSpots.length}`,2.5);persist()}});
  }
  function resetDailyBirdwatching(){const d=currentDay();if(state.birdDay===d)return;state.birdDay=d;state.birdsSeen=[];persist()}

  [[-34,67],[-58,73],[26,73],[73,18],[82,-26],[-84,-18]].forEach((p,i)=>makeBerryBush(p[0],p[1],i));
  [[-66,78],[-92,58],[-104,22],[-88,-20],[-55,-48]].forEach((p,i)=>makeTrailMarker(p[0],p[1],i));
  [[-15,24],[18,35],[42,8],[11,-42],[-37,-31],[-72,12]].forEach((p,i)=>makeLitter(p[0],p[1],i));
  [[-44,52,'meadowlark'],[64,42,'bluebird'],[76,-38,'woodpecker'],[-78,-34,'barn owl']].forEach((p,i)=>makeBirdSpot(p[0],p[1],i,p[2]));
  const forageHandIn=makeForageHandIn(),cleanupHandIn=makeCleanupHandIn();

  resetDailyForage();resetDailyTrail();resetDailyCleanup();resetDailyBirdwatching();
  forageNodes.forEach(e=>{e.group.visible=!state.gathered.includes(e.index)});litterNodes.forEach(e=>{e.group.visible=!state.cleaned.includes(e.index)});
  let accumulator=0,floatClock=0;
  TV.registerUpdateHook((dt)=>{accumulator+=dt;floatClock+=dt;forageHandIn.visible=state.gathered.length>=forageNodes.length&&!state.forageHandedIn;cleanupHandIn.visible=state.cleaned.length>=litterNodes.length&&!state.cleanupHandedIn;if(forageHandIn.visible)forageHandIn.position.y=TV.terrainHeight(forageHandIn.position.x,forageHandIn.position.z)+Math.sin(floatClock*2.2)*.06;if(cleanupHandIn.visible)cleanupHandIn.position.y=TV.terrainHeight(cleanupHandIn.position.x,cleanupHandIn.position.z)+Math.sin(floatClock*2.2+1)*.06;if(accumulator<2)return;accumulator=0;resetDailyForage();resetDailyTrail();resetDailyCleanup();resetDailyBirdwatching()});

  window.ToonValleyWorldEvents={getState:()=>JSON.parse(JSON.stringify(state)),counts:{forage:forageNodes.length,trail:trailMarkers.length,cleanup:litterNodes.length,birds:birdSpots.length},taskFlow:{forage:'collect-then-market-hand-in',cleanup:'collect-then-recycling-hand-in',trail:'ordered-checkpoints',birds:'multi-location-survey'}};
  console.info('Toon Valley world events ready',window.ToonValleyWorldEvents.counts);
})();