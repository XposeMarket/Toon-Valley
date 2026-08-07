(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const {THREE}=TV,bounds=TV.areaBounds,KEY='toon-valley-town-service-quests-v1';
  if(!bounds.clinic||!bounds.theater)return;
  const fresh=()=>({day:-1,clinic:{stage:'start',done:false},posters:{stage:'start',placed:[],done:false}});
  let state=(()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');return {...fresh(),...p,clinic:{...fresh().clinic,...(p.clinic||{})},posters:{...fresh().posters,...(p.posters||{})}}}catch{return fresh()}})();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('Unable to save town service quests',e)}};
  const day=()=>Life.getState().world.day;

  const markerRoot=new THREE.Group();TV.scene.add(markerRoot);const markers=[];
  function marker(color){const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color,fog:false,transparent:true,opacity:.96}),ring=new THREE.Mesh(new THREE.TorusGeometry(.66,.08,6,18),m),bar=new THREE.Mesh(new THREE.BoxGeometry(.3,1.5,.3),m),dot=new THREE.Mesh(new THREE.SphereGeometry(.23,8,6),m);ring.rotation.x=Math.PI/2;ring.position.y=-.12;bar.position.y=1.25;dot.position.y=.22;g.add(ring,bar,dot);g.visible=false;markerRoot.add(g);const out={group:g,ring,x:0,z:0,active:false};markers.push(out);return out}
  function place(m,x,z){m.x=x;m.z=z;m.active=true;m.group.position.set(x,TV.terrainHeight(x,z)+6.2,z);m.group.visible=TV.state.area==='world'}
  function clear(m){m.active=false;m.group.visible=false}
  const clinicMarker=marker(0x6ad7d0),posterMarker=marker(0xef6ca8);

  const carryRoot=new THREE.Group();TV.player.add(carryRoot);
  function carryBox(color,pos,scale){const g=new THREE.Group(),box=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.025);box.scale.set(...scale);g.add(box);g.position.set(...pos);g.visible=false;carryRoot.add(g);return g}
  const careBasket=carryBox(0x86cba7,[.72,1.16,.16],[.72,.5,.56]);
  const careCard=carryBox(0xf2ead1,[-.58,1.38,.42],[.34,.44,.08]);
  const posterRoll=(()=>{const g=new THREE.Group(),roll=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.82,10),TV.mat(0xf0e3c4));roll.rotation.z=Math.PI/2;g.add(roll);g.position.set(-.64,1.18,.18);g.visible=false;carryRoot.add(g);return g})();

  // Clinic care package: accept -> collect basket -> deliver to a real house -> bring signed card back -> payment.
  const careHome={x:68,z:62.5,owner:'Mrs. Juniper'};
  TV.registerInteraction({x:bounds.clinic.cx-1.8,z:bounds.clinic.cz-5.3,radius:2.8,area:'clinic',prompt:'Ask Rosa about the neighborhood care package',enabled:()=>state.clinic.stage==='start'&&!state.clinic.done,action:()=>{state.clinic.stage='pickup';TV.showToast('🩺 Rosa: “Mrs. Juniper needs this care basket. Take it to her house, then bring me her signed delivery card.”',4);save()}});
  TV.registerInteraction({x:bounds.clinic.cx+2,z:bounds.clinic.cz-5.3,radius:2.6,area:'clinic',prompt:'Collect clinic care basket',enabled:()=>state.clinic.stage==='pickup'&&!state.clinic.done,action:()=>{state.clinic.stage='deliver';careBasket.visible=true;place(clinicMarker,careHome.x,careHome.z);TV.showToast('🧺 Care basket collected. Carry it to Mrs. Juniper’s marked north-side cottage.',3.4);save()}});
  const thanks=TV.createCharacter({body:TV.mat(0x7aa6d8),skin:TV.materials.skin,hair:TV.materials.hair,legs:TV.materials.blue,shoes:TV.materials.dark},true);thanks.scale.setScalar(.88);thanks.position.set(careHome.x+1.2,TV.terrainHeight(careHome.x+1.2,careHome.z-1.6),careHome.z-1.6);thanks.visible=false;TV.scene.add(thanks);
  TV.registerInteraction({x:careHome.x,z:careHome.z,radius:3.2,area:'world',prompt:'Deliver care basket to Mrs. Juniper',enabled:()=>state.clinic.stage==='deliver'&&!state.clinic.done,action:()=>{state.clinic.stage='return';careBasket.visible=false;careCard.visible=true;thanks.visible=true;place(clinicMarker,-17,-19.6);Life.emitProgress('help',2,{activity:'clinic-care-delivery'});TV.showToast('🏡 Mrs. Juniper: “That is so thoughtful — thank you! Please take this signed card back to Rosa.”',4);save()}});
  TV.registerInteraction({x:bounds.clinic.cx,z:bounds.clinic.cz-5.3,radius:2.8,area:'clinic',prompt:'Return signed care card to Rosa',enabled:()=>state.clinic.stage==='return'&&!state.clinic.done,action:()=>{state.clinic.stage='done';state.clinic.done=true;careCard.visible=false;clear(clinicMarker);Life.addMoney(145,'Clinic neighborhood care delivery');Life.emitProgress('help',2,{activity:'clinic-care-route-complete'});TV.showToast('🩺 Rosa: “Perfect — delivered personally and signed back in.” +$145',3.8);save()}});

  // Theater poster round: collect the poster roll, visit three public boards, visibly hang each poster, then return the empty roll.
  const posterStops=[[-9,12,'Central Plaza board'],[-72,48,'Sunshine Park board'],[48,-8,'East Market board']];
  const boards=posterStops.map((p,index)=>{
    const g=new THREE.Group(),post=TV.outlinedMesh(TV.unitBox,TV.mat(0x8d6b48),1.025),panel=TV.outlinedMesh(TV.unitBox,TV.mat(0xf3e7c7),1.02),poster=TV.outlinedMesh(TV.unitBox,TV.mat(index===0?0xf06c9b:index===1?0x70b7e8:0xf2bd4b),1.02);
    post.scale.set(.16,1.8,.16);post.position.set(0,.9,0);panel.scale.set(1.3,.95,.12);panel.position.set(0,2,.03);poster.scale.set(1.08,.74,.05);poster.position.set(0,2,.12);poster.visible=false;g.add(post,panel,poster);g.position.set(p[0],TV.terrainHeight(p[0],p[1]),p[1]);TV.scene.add(g);return {g,poster};
  });
  function nextPoster(){const idx=state.posters.placed.length;if(idx<posterStops.length)place(posterMarker,posterStops[idx][0],posterStops[idx][1]);else place(posterMarker,-10,-24)}
  TV.registerInteraction({x:bounds.theater.cx-1.8,z:bounds.theater.cz-5.3,radius:2.8,area:'theater',prompt:'Ask Wren about the new movie posters',enabled:()=>state.posters.stage==='start'&&!state.posters.done,action:()=>{state.posters.stage='pickup';TV.showToast('🎭 Wren: “Opening night needs posters all over town. Grab the roll, hang all three, then bring the tube back.”',4);save()}});
  TV.registerInteraction({x:bounds.theater.cx+2,z:bounds.theater.cz-5.3,radius:2.6,area:'theater',prompt:'Collect theater poster roll',enabled:()=>state.posters.stage==='pickup'&&!state.posters.done,action:()=>{state.posters.stage='place';posterRoll.visible=true;nextPoster();TV.showToast('📰 Poster roll collected. Hang the three posters in order at the marked public boards.',3.4);save()}});
  posterStops.forEach((p,index)=>TV.registerInteraction({object:boards[index].g,radius:2.8,area:'world',prompt:`Hang poster at ${p[2]}`,enabled:()=>state.posters.stage==='place'&&!state.posters.done&&state.posters.placed.length===index,action:()=>{state.posters.placed.push(index);boards[index].poster.visible=true;Life.emitProgress('help',1,{activity:'theater-poster',board:index});nextPoster();if(state.posters.placed.length===posterStops.length){state.posters.stage='return';TV.showToast('🎬 All three posters are up. Return the empty poster tube to Wren at Moonbeam Theater.',3.3)}else TV.showToast(`🎭 Poster hung · ${state.posters.placed.length}/${posterStops.length}. Follow the next pink marker.`,2.7);save()}}));
  TV.registerInteraction({x:bounds.theater.cx,z:bounds.theater.cz-5.3,radius:2.8,area:'theater',prompt:'Return empty poster tube to Wren',enabled:()=>state.posters.stage==='return'&&!state.posters.done,action:()=>{state.posters.stage='done';state.posters.done=true;posterRoll.visible=false;clear(posterMarker);Life.addMoney(120,'Moonbeam Theater poster round');Life.emitProgress('help',2,{activity:'theater-poster-round-complete'});TV.showToast('🎭 Wren: “The whole valley will know about opening night now!” +$120',3.8);save()}});

  function reset(force=false){const today=day();if(!force&&state.day===today)return;state=fresh();state.day=today;careBasket.visible=false;careCard.visible=false;posterRoll.visible=false;thanks.visible=false;boards.forEach(b=>b.poster.visible=false);markers.forEach(clear);save()}
  reset();
  if(state.clinic.stage==='deliver'){careBasket.visible=true;place(clinicMarker,careHome.x,careHome.z)}
  if(state.clinic.stage==='return'){careCard.visible=true;thanks.visible=true;place(clinicMarker,-17,-19.6)}
  if((state.posters.stage==='place'||state.posters.stage==='return')&&!state.posters.done){posterRoll.visible=true;state.posters.placed.forEach(i=>{if(boards[i])boards[i].poster.visible=true});nextPoster()}
  if(state.posters.done)state.posters.placed.forEach(i=>{if(boards[i])boards[i].poster.visible=true});

  let t=0,elapsed=0;TV.registerUpdateHook(dt=>{t+=dt;elapsed+=dt;markers.forEach((m,i)=>{m.group.position.y=TV.terrainHeight(m.x,m.z)+6.2+Math.sin(t*2.25+i)*.24;m.ring.rotation.z+=dt*.7;m.group.visible=m.active&&TV.state.area==='world'});if(elapsed>=2){elapsed=0;if(state.day!==day())reset(true)}});

  function summaries(){return[
    {icon:'🩺',title:'Clinic Care Package',done:state.clinic.done,status:state.clinic.done?'DONE':state.clinic.stage==='start'?'START':state.clinic.stage==='pickup'?'PICKUP':state.clinic.stage==='deliver'?'DELIVER':'RETURN',text:state.clinic.done?'Rosa received Mrs. Juniper’s signed delivery card.':state.clinic.stage==='start'?'Talk to Rosa inside the Clinic to accept a neighborhood care delivery.':state.clinic.stage==='pickup'?'Collect the care basket from Rosa before leaving the Clinic.':state.clinic.stage==='deliver'?'Carry the care basket to Mrs. Juniper’s marked real house.':'Bring Mrs. Juniper’s signed delivery card back to Rosa for payment.'},
    {icon:'🎭',title:'Moonbeam Poster Round',done:state.posters.done,status:state.posters.done?'DONE':state.posters.stage==='start'?'START':state.posters.stage==='pickup'?'PICKUP':state.posters.stage==='return'?'RETURN':`${state.posters.placed.length}/${posterStops.length}`,text:state.posters.done?'All three public posters are hanging and Wren has the empty tube.':state.posters.stage==='start'?'Talk to Wren inside Moonbeam Theater to start the publicity round.':state.posters.stage==='pickup'?'Collect the poster roll from Wren before heading into town.':state.posters.stage==='return'?'Return the empty poster tube to Wren at Moonbeam Theater.':`Hang the next marked opening-night poster · ${state.posters.placed.length}/${posterStops.length} complete.`}
  ]}
  window.ToonValleyTownServiceQuests=Object.freeze({getState:()=>JSON.parse(JSON.stringify(state)),getSummaries:summaries,counts:{posterStops:posterStops.length},careHome});
  console.info('Toon Valley town service quests ready',{quests:2,posterStops:posterStops.length});
})();