(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const{THREE}=TV,KEY='toon-valley-side-quests-v1';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const fresh=()=>({day:-1,pets:{done:[],active:null},forage:{collected:[],ready:false,delivered:false},cleanup:{collected:[],ready:false,delivered:false},birds:{started:false,seen:[],ready:false,returned:false},garden:{started:false,watered:[],returned:false},notice:{started:false,stage:'idle',completed:false},market:{started:false,samples:[],completed:false}});
  let state=(()=>{try{return Object.assign(fresh(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return fresh()}})();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(error){console.warn('Unable to save side quest state',error)}}
  const day=()=>Life.getState().world.day;

  const markerRoot=new THREE.Group();TV.scene.add(markerRoot);const markers=[];
  function marker(color){const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color,fog:false,transparent:true,opacity:.95}),bar=new THREE.Mesh(new THREE.BoxGeometry(.32,1.55,.32),m),dot=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),m),ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.07,6,16),m);bar.position.y=1.25;dot.position.y=.15;ring.rotation.x=Math.PI/2;ring.position.y=-.12;g.add(bar,dot,ring);g.visible=false;markerRoot.add(g);const out={group:g,x:0,z:0,ring};markers.push(out);return out}
  function placeMarker(m,x,z,on=true){m.x=x;m.z=z;m.group.position.set(x,TV.terrainHeight(x,z)+6.2,z);m.group.visible=Boolean(on)&&TV.state.area==='world'}
  const petMarker=marker(0xffdf4f),forageMarker=marker(0xd765b8),cleanupMarker=marker(0x60d47a),birdMarker=marker(0x75d9ff),gardenMarker=marker(0x86c95a),noticeMarker=marker(0xff9b54),marketMarker=marker(0xf4c34f);

  const carryRoot=new THREE.Group();TV.player.add(carryRoot);carryRoot.position.set(0,0,0);const carries={};
  function carryBox(id,color,x=.72,y=1.2,z=.15,scale=[.65,.48,.55]){const g=new THREE.Group(),box=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.025);box.scale.set(...scale);g.add(box);g.position.set(x,y,z);g.visible=false;carryRoot.add(g);carries[id]=g;return g}
  carryBox('berries',0xb76b45,-.72,1.2,.15,[.75,.42,.58]);
  carryBox('trash',0x4f7755,.72,1.15,.15,[.62,.72,.48]);
  carryBox('notebook',0x4d91d8,-.55,1.38,.46,[.38,.5,.12]);
  carryBox('watering',0x63b7dd,.72,1.1,.18,[.55,.42,.72]);
  carryBox('notice',0xe9bf62,.7,1.18,.1,[.68,.54,.62]);
  function carry(id,on){if(carries[id])carries[id].visible=Boolean(on)}

  // ---------- Lost-pet escort quests ----------
  const petRoutes=[
    {name:'Mochi',owner:'Mrs. Juniper',door:[68,62.5],house:[68,67],reward:70,forward:[0,-1]},
    {name:'Pepper',owner:'Mr. Maple',door:[-68,-47.5],house:[-68,-52],reward:75,forward:[0,1]},
    {name:'Sunny',owner:'Jamie',door:[-69.5,17],house:[-74,17],reward:80,forward:[1,0]}
  ];
  const petInteractions=petRoutes.map(route=>TV.interactables.find(i=>i.area==='world'&&i.prompt===`Help ${route.name} get home`));
  const owners=[];
  const ownerPalette={body:TV.materials.green,skin:TV.materials.skin,hair:TV.materials.hair,legs:TV.materials.blue,shoes:TV.materials.dark};
  petRoutes.forEach((route,index)=>{
    const npc=TV.createCharacter(ownerPalette,true);npc.scale.setScalar(.9);npc.position.set(route.door[0],TV.terrainHeight(...route.door),route.door[1]);npc.visible=false;npc.userData.name=route.owner;TV.scene.add(npc);owners.push({npc,until:0,index});
    TV.registerInteraction({x:route.door[0],z:route.door[1],radius:3.8,area:'world',prompt:`Knock for ${route.name}'s owner`,enabled:()=>state.pets.active===index&&!state.pets.done.includes(index),action:()=>finishPet(index)});
  });
  function startPet(index){
    if(state.pets.done.includes(index))return;
    if(state.pets.active!==null&&state.pets.active!==index){TV.showToast(`🐾 Finish helping ${petRoutes[state.pets.active].name} first.`,2.3);return}
    state.pets.active=index;const route=petRoutes[index],pet=petInteractions[index]?.object;if(pet)pet.visible=true;placeMarker(petMarker,...route.door,true);TV.showToast(`🐾 ${route.name} is lost. Walk together to ${route.owner}'s house across town, then knock on the marked door.`,4);save();
  }
  function finishPet(index){
    if(state.pets.active!==index||state.pets.done.includes(index))return;const route=petRoutes[index],pet=petInteractions[index]?.object,owner=owners[index];state.pets.done.push(index);state.pets.active=null;if(pet)pet.visible=false;petMarker.group.visible=false;owner.npc.position.set(route.door[0],TV.terrainHeight(...route.door),route.door[1]);owner.npc.visible=true;owner.until=performance.now()+14000;Life.addMoney(route.reward,`${route.name} returned home`);Life.emitProgress('help',2,{activity:'lost-pet-return',name:route.name});const all=state.pets.done.length===petRoutes.length;if(all)Life.addMoney(100,'Neighborhood pet helper bonus');TV.showToast(`🏠 ${route.owner}: “Thank you so much for bringing ${route.name} home!” +$${route.reward}${all?' · All pets home bonus +$100':''}`,4.2);save();
  }
  petInteractions.forEach((interaction,index)=>{if(!interaction)return;interaction.enabled=()=>!state.pets.done.includes(index);interaction.action=()=>startPet(index)});

  // ---------- Berry foraging: gather a basket, then deliver it ----------
  const forageInteractions=TV.interactables.filter(i=>i.area==='world'&&i.prompt==='Gather wild berries');
  const cafe=TV.areaBounds.cafe;
  TV.registerInteraction({x:cafe.cx,z:cafe.cz-6.45,radius:2.8,area:'cafe',prompt:'Hand berry basket to Ari',enabled:()=>state.forage.ready&&!state.forage.delivered,action:()=>{
    state.forage.delivered=true;state.forage.ready=false;carry('berries',false);forageMarker.group.visible=false;Life.addMoney(90,'Cafe berry delivery');Life.emitProgress('help',2,{activity:'berry-delivery'});TV.showToast('🫐 Ari: “Perfect timing — these are going straight into today’s berry cakes!” +$90',3.6);save();
  }});
  forageInteractions.forEach((interaction,index)=>{interaction.enabled=()=>!state.forage.delivered&&!state.forage.ready&&!state.forage.collected.includes(index);interaction.action=()=>{
    if(state.forage.collected.includes(index)||state.forage.ready)return;state.forage.collected.push(index);if(interaction.object)interaction.object.visible=false;Life.emitProgress('explore',1,{activity:'forage'});if(state.forage.collected.length>=4){state.forage.ready=true;carry('berries',true);placeMarker(forageMarker,-15,-?0:0,false);placeMarker(forageMarker,-15,-18.8,true);TV.showToast('🧺 Basket full! Bring the berries into Cloud Nine Cafe and hand them to Ari.',3.2)}else TV.showToast(`🫐 Berries gathered · ${state.forage.collected.length}/4 for a cafe basket.`,2.2);save();}});

  // ---------- Cleanup: collect everything, then dispose of the bag ----------
  const cleanupInteractions=TV.interactables.filter(i=>i.area==='world'&&i.prompt==='Pick up litter');
  const bin=new THREE.Group(),binBody=TV.outlinedMesh(TV.unitBox,TV.mat(0x4e8c63),1.025),binLid=TV.outlinedMesh(TV.unitBox,TV.materials.dark,1.02);binBody.scale.set(1.15,1.5,1.05);binBody.position.y=.75;binLid.scale.set(1.28,.18,1.16);binLid.position.y=1.55;bin.add(binBody,binLid);bin.position.set(-72,TV.terrainHeight(-72,48),48);TV.scene.add(bin);
  TV.registerInteraction({object:bin,radius:3,area:'world',prompt:'Drop cleanup bag in park bin',enabled:()=>state.cleanup.ready&&!state.cleanup.delivered,action:()=>{state.cleanup.ready=false;state.cleanup.delivered=true;carry('trash',false);cleanupMarker.group.visible=false;Life.addMoney(125,'Sunshine Park cleanup');Life.emitProgress('help',3,{activity:'cleanup-complete'});TV.showToast('♻️ Cleanup complete. Milo: “The park looks fantastic — thank you!” +$125',3.5);save()}});
  cleanupInteractions.forEach((interaction,index)=>{interaction.enabled=()=>!state.cleanup.delivered&&!state.cleanup.collected.includes(index);interaction.action=()=>{if(state.cleanup.collected.includes(index))return;state.cleanup.collected.push(index);if(interaction.object)interaction.object.visible=false;Life.emitProgress('help',1,{activity:'cleanup'});if(state.cleanup.collected.length===cleanupInteractions.length){state.cleanup.ready=true;carry('trash',true);placeMarker(cleanupMarker,-72,48,true);TV.showToast('🗑️ The cleanup bag is full. Take it to the marked green bin in Sunshine Park.',3)}else TV.showToast(`♻️ Litter collected · ${state.cleanup.collected.length}/${cleanupInteractions.length}.`,2);save();}});

  // ---------- Bird survey: check out notebook, observe species, return it ----------
  const birdInteractions=TV.interactables.filter(i=>i.area==='world'&&/^Observe /.test(i.prompt||''));
  const library=TV.areaBounds.library;
  function nextBirdMarker(){const next=birdInteractions.find((_,i)=>!state.birds.seen.includes(i));if(next?.object)placeMarker(birdMarker,next.object.position.x,next.object.position.z,true);else placeMarker(birdMarker,-26,-19.6,true)}
  TV.registerInteraction({x:library.cx,z:library.cz-5.5,radius:2.8,area:'library',prompt:'Check out bird survey notebook',enabled:()=>!state.birds.started&&!state.birds.returned,action:()=>{state.birds.started=true;carry('notebook',true);nextBirdMarker();TV.showToast('📘 Mabel: “Log all four valley birds, then bring the notebook back to me.”',3.5);save()}});
  TV.registerInteraction({x:library.cx,z:library.cz-5.5,radius:2.8,area:'library',prompt:'Return completed bird survey to Mabel',enabled:()=>state.birds.ready&&!state.birds.returned,action:()=>{state.birds.returned=true;state.birds.ready=false;carry('notebook',false);birdMarker.group.visible=false;Life.addMoney(115,'Valley bird survey');Life.emitProgress('help',2,{activity:'bird-survey-return'});TV.showToast('🐦 Mabel: “A complete field survey! Luna will love these notes.” +$115',3.5);save()}});
  birdInteractions.forEach((interaction,index)=>{interaction.enabled=()=>state.birds.started&&!state.birds.ready&&!state.birds.returned&&!state.birds.seen.includes(index);interaction.action=()=>{if(!state.birds.started){TV.showToast('📘 Check out a bird-survey notebook from Storybook Library first.',2.4);return}state.birds.seen.push(index);Life.emitProgress('explore',1,{activity:'birdwatching',species:(interaction.prompt||'').replace('Observe ','')});if(state.birds.seen.length===birdInteractions.length){state.birds.ready=true;placeMarker(birdMarker,-26,-19.6,true);TV.showToast('🐦 All four species logged. Return the completed notebook to Mabel in the library.',3)}else{nextBirdMarker();TV.showToast(`🐦 Species logged · ${state.birds.seen.length}/${birdInteractions.length}. Follow the next blue marker.`,2.4)}save();}});

  // ---------- Community garden care: borrow can, water six beds, return can ----------
  const gardenRoot=window.ToonValleyCommunityGarden?.root;const gardenOrigin=gardenRoot?{x:gardenRoot.position.x,z:gardenRoot.position.z}:{x:-116,z:55};
  const barrelPos=[gardenOrigin.x-2.8,gardenOrigin.z-4.2];const bedPositions=[];for(let row=0;row<2;row++)for(let col=0;col<3;col++)bedPositions.push([gardenOrigin.x-4+col*4.3,gardenOrigin.z+1.5+row*4.2]);
  function nextGardenMarker(){const idx=bedPositions.findIndex((_,i)=>!state.garden.watered.includes(i));if(idx>=0)placeMarker(gardenMarker,...bedPositions[idx],true);else placeMarker(gardenMarker,...barrelPos,true)}
  function startGarden(){if(state.garden.returned){TV.showToast('🌱 Today’s full garden-care round is already complete.',2);return}if(!state.garden.started){state.garden.started=true;carry('watering',true);nextGardenMarker();TV.showToast('💧 You borrowed the watering can. Water all six raised beds, then return it to the barrel.',3.2);save()}else TV.showToast(`💧 Garden round in progress · ${state.garden.watered.length}/${bedPositions.length} beds.`,2.2)}
  const tendInteraction=TV.interactables.find(i=>i.area==='world'&&i.prompt==='Tend community garden');if(tendInteraction)tendInteraction.action=startGarden;
  TV.registerInteraction({x:barrelPos[0],z:barrelPos[1],radius:3,area:'world',prompt:'Borrow watering can for garden round',enabled:()=>!state.garden.started&&!state.garden.returned,action:startGarden});
  TV.registerInteraction({x:barrelPos[0],z:barrelPos[1],radius:3,area:'world',prompt:'Return watering can',enabled:()=>state.garden.started&&state.garden.watered.length===bedPositions.length&&!state.garden.returned,action:()=>{state.garden.returned=true;state.garden.started=false;carry('watering',false);gardenMarker.group.visible=false;Life.addMoney(95,'Community garden care round');Life.emitProgress('help',2,{activity:'garden-care-round'});TV.showToast('🌻 Watering can returned. Ivy: “Every bed got proper attention today — thank you!” +$95',3.5);save()}});
  bedPositions.forEach((p,index)=>TV.registerInteraction({x:p[0],z:p[1],radius:2.2,area:'world',prompt:`Water raised garden bed ${index+1}`,enabled:()=>state.garden.started&&!state.garden.returned&&!state.garden.watered.includes(index),action:()=>{state.garden.watered.push(index);Life.emitProgress('help',1,{activity:'garden-bed',bed:index});nextGardenMarker();TV.showToast(state.garden.watered.length===bedPositions.length?'💧 All six beds are watered. Return the can to the barrel.':`💧 Bed watered · ${state.garden.watered.length}/${bedPositions.length}.`,2.1);save()}}));
  TV.interactables.filter(i=>i.area==='world'&&i.prompt==='Water community garden').forEach(i=>{i.enabled=()=>false});

  // ---------- Notice-board errands: accept, collect item, deliver to person/place ----------
  const routines=window.ToonValleyRoutines;const boardInteraction=TV.interactables.find(i=>i.area==='world'&&i.prompt==='Check community notice board'),oldTarget=TV.interactables.find(i=>i.area==='world'&&i.prompt==='Complete community errand');if(oldTarget){oldTarget.enabled=()=>false;if(oldTarget.object)oldTarget.object.visible=false}
  const noticeDefs={
    'Library book drop':{sourceArea:'postOffice',sourceOffset:[0,5.45],sourceOutside:[52.6,-25],sourcePrompt:'Collect returned books from Cal',destArea:'library',destOffset:[0,-5.5],destOutside:[-26,-19.6],destPrompt:'Hand book bundle to Mabel',carry:'returned library books'},
    'Garden seed delivery':{sourceArea:'generalStore',sourceOffset:[0,5.2],sourceOutside:[26,-19.6],sourcePrompt:'Collect seed packet from Nina',destArea:'world',destOffset:[-116,55],destOutside:[-116,55],destPrompt:'Deliver seed packet to community garden',carry:'garden seed packet'},
    'Fire station supply check':{sourceArea:'postOffice',sourceOffset:[0,5.45],sourceOutside:[52.6,-25],sourcePrompt:'Collect fire-station supplies from Cal',destArea:'fireStation',destOffset:[-8,-5.6],destOutside:[-51.8,-25],destPrompt:'Hand supplies to Sam',carry:'fire-station supply crate'}
  };
  const noticeTask=()=>routines?.getCurrentErrand?.()||{name:'Library book drop',reward:55};const noticeDef=()=>noticeDefs[noticeTask().name]||noticeDefs['Library book drop'];
  function noticeWorldTarget(which){const d=noticeDef(),p=which==='source'?d.sourceOutside:d.destOutside;placeMarker(noticeMarker,p[0],p[1],true)}
  function acceptNotice(){if(state.notice.completed){TV.showToast('✅ Today’s notice-board errand is complete.',2);return}if(!state.notice.started){state.notice.started=true;state.notice.stage='collect';noticeWorldTarget('source');TV.showToast(`📌 ${noticeTask().name}: first collect the ${noticeDef().carry}. Follow the orange marker.`,3.5);save()}else TV.showToast(state.notice.stage==='collect'?`📦 First collect the ${noticeDef().carry}.`:`🚶 Deliver the ${noticeDef().carry} to finish the errand.`,2.6)}
  if(boardInteraction)boardInteraction.action=acceptNotice;
  Object.entries(noticeDefs).forEach(([name,d])=>{
    const sb=TV.areaBounds[d.sourceArea],sx=sb.cx+d.sourceOffset[0],sz=sb.cz+d.sourceOffset[1];TV.registerInteraction({x:sx,z:sz,radius:2.8,area:d.sourceArea,prompt:d.sourcePrompt,enabled:()=>noticeTask().name===name&&state.notice.started&&state.notice.stage==='collect'&&!state.notice.completed,action:()=>{state.notice.stage='deliver';carry('notice',true);noticeWorldTarget('dest');TV.showToast(`📦 Collected ${d.carry}. Now make the actual delivery.`,2.8);save()}});
    const destArea=d.destArea;if(destArea==='world'){TV.registerInteraction({x:d.destOffset[0],z:d.destOffset[1],radius:3.2,area:'world',prompt:d.destPrompt,enabled:()=>noticeTask().name===name&&state.notice.stage==='deliver'&&!state.notice.completed,action:finishNotice})}else{const db=TV.areaBounds[destArea];TV.registerInteraction({x:db.cx+d.destOffset[0],z:db.cz+d.destOffset[1],radius:2.8,area:destArea,prompt:d.destPrompt,enabled:()=>noticeTask().name===name&&state.notice.stage==='deliver'&&!state.notice.completed,action:finishNotice})}
  });
  function finishNotice(){const task=noticeTask();state.notice.completed=true;state.notice.stage='done';carry('notice',false);noticeMarker.group.visible=false;Life.addMoney(task.reward,task.name);Life.emitProgress('help',2,{activity:'notice-board-delivery',task:task.name});TV.showToast(`✅ ${task.name} delivered properly. “Thanks for bringing that over!” +$${task.reward}`,3.5);save()}

  // ---------- Farmers-market survey: taste three samples, then report ----------
  const marketInteraction=TV.interactables.find(i=>i.area==='world'&&i.prompt==='Visit the farmers market');const samplePositions=[[-8.2,14.45],[-7.2,15.25],[-6.25,14.55]];
  function nextMarketMarker(){const idx=samplePositions.findIndex((_,i)=>!state.market.samples.includes(i));if(idx>=0)placeMarker(marketMarker,...samplePositions[idx],true);else placeMarker(marketMarker,-7.2,14.8,true)}
  function marketAction(){if(state.market.completed){TV.showToast('🥕 Today’s produce survey is finished. The stall is still open for browsing.',2.4);return}if(!state.market.started){state.market.started=true;nextMarketMarker();TV.showToast('🥕 The vendor needs real feedback: taste all three marked samples, then report back.',3.2);save();return}if(state.market.samples.length<samplePositions.length){TV.showToast(`🥕 Produce survey · ${state.market.samples.length}/${samplePositions.length} samples tasted.`,2.2);return}state.market.completed=true;marketMarker.group.visible=false;Life.addMoney(35,'Farmers market tasting survey');Life.emitProgress('help',1,{activity:'farmers-market-survey'});TV.showToast('🥕 Vendor: “That’s exactly the feedback I needed. Thank you!” +$35',3.2);save()}
  if(marketInteraction)marketInteraction.action=marketAction;
  samplePositions.forEach((p,index)=>TV.registerInteraction({x:p[0],z:p[1],radius:1.7,area:'world',prompt:`Taste market sample ${index+1}`,enabled:()=>state.market.started&&!state.market.completed&&!state.market.samples.includes(index),action:()=>{state.market.samples.push(index);nextMarketMarker();TV.showToast(state.market.samples.length===samplePositions.length?'🥕 All samples tasted. Report back to the vendor.':`🥕 Sample ${state.market.samples.length}/${samplePositions.length}: notes recorded.`,2.1);save()}}));

  function resetForDay(force=false){const today=day();if(!force&&state.day===today)return;state=fresh();state.day=today;forageInteractions.forEach(i=>{if(i.object)i.object.visible=true});cleanupInteractions.forEach(i=>{if(i.object)i.object.visible=true});petInteractions.forEach(i=>{if(i?.object)i.object.visible=true});Object.keys(carries).forEach(id=>carry(id,false));markers.forEach(m=>m.group.visible=false);owners.forEach(o=>o.npc.visible=false);save()}
  resetForDay();
  // Restore object/carry state for the current day after reload.
  forageInteractions.forEach((i,index)=>{if(i.object)i.object.visible=!state.forage.collected.includes(index)&&!state.forage.delivered});cleanupInteractions.forEach((i,index)=>{if(i.object)i.object.visible=!state.cleanup.collected.includes(index)&&!state.cleanup.delivered});petInteractions.forEach((i,index)=>{if(i?.object)i.object.visible=!state.pets.done.includes(index)});carry('berries',state.forage.ready&&!state.forage.delivered);carry('trash',state.cleanup.ready&&!state.cleanup.delivered);carry('notebook',state.birds.started&&!state.birds.returned);carry('watering',state.garden.started&&!state.garden.returned);carry('notice',state.notice.stage==='deliver'&&!state.notice.completed);
  if(state.pets.active!==null)placeMarker(petMarker,...petRoutes[state.pets.active].door,true);if(state.forage.ready&&!state.forage.delivered)placeMarker(forageMarker,-15,-18.8,true);if(state.cleanup.ready&&!state.cleanup.delivered)placeMarker(cleanupMarker,-72,48,true);if(state.birds.started&&!state.birds.returned)nextBirdMarker();if(state.garden.started&&!state.garden.returned)nextGardenMarker();if(state.notice.started&&!state.notice.completed)noticeWorldTarget(state.notice.stage==='collect'?'source':'dest');if(state.market.started&&!state.market.completed)nextMarketMarker();

  let elapsed=0,anim=0;TV.registerUpdateHook(dt=>{anim+=dt;elapsed+=dt;markers.forEach((m,index)=>{m.group.position.y=TV.terrainHeight(m.x,m.z)+6.2+Math.sin(anim*2.4+index)*.25;m.ring.rotation.z+=dt*.6;m.group.visible=m.group.visible&&TV.state.area==='world'});const active=state.pets.active;if(active!==null){const pet=petInteractions[active]?.object;if(pet&&TV.state.area==='world'){pet.visible=true;const behind=1.55,tx=TV.player.position.x-Math.sin(TV.player.rotation.y)*behind,tz=TV.player.position.z-Math.cos(TV.player.rotation.y)*behind,dx=tx-pet.position.x,dz=tz-pet.position.z,dist=Math.hypot(dx,dz);if(dist>10){pet.position.x=tx;pet.position.z=tz}else if(dist>.18){const speed=dist>4?5.8:3.25,step=Math.min(dist,speed*dt);pet.position.x+=dx/dist*step;pet.position.z+=dz/dist*step;pet.rotation.y=Math.atan2(dx,dz)}pet.position.y=TV.terrainHeight(pet.position.x,pet.position.z);}}owners.forEach(o=>{if(!o.npc.visible)return;const r=petRoutes[o.index],life=Math.max(0,(o.until-performance.now())/14000),out=1-Math.min(1,life*4);o.npc.position.x=r.door[0]+r.forward[0]*1.4*out;o.npc.position.z=r.door[1]+r.forward[1]*1.4*out;o.npc.position.y=TV.terrainHeight(o.npc.position.x,o.npc.position.z);const arms=o.npc.userData.arms;if(arms){arms[0].rotation.z=Math.sin(anim*7)*.45;arms[1].rotation.z=-Math.sin(anim*7)*.45}if(performance.now()>o.until)o.npc.visible=false});if(elapsed>=2){elapsed=0;if(state.day!==day())resetForDay(true)}});

  const alreadySubstantive=['Mountain Trail / trail checkpoints','Courier route','Community errand loop','Cafe Rush job','Park Cleanup job','Parcel Delivery job','Street Performer job','Shore and boat fishing'];
  const overhauled=['Lost pet returns','Wild berry forage','Community cleanup','Bird survey','Community garden care','Notice-board errands','Farmers-market survey'];
  window.ToonValleySideQuests=Object.freeze({counts:{overhauled:overhauled.length,petRoutes:petRoutes.length,forageRequired:4,cleanupItems:cleanupInteractions.length,birdSpecies:birdInteractions.length,gardenBeds:bedPositions.length,noticeVariants:Object.keys(noticeDefs).length,marketSamples:samplePositions.length},audit:{alreadySubstantive,overhauled},petRoutes:copy(petRoutes),bedPositions:copy(bedPositions),samplePositions:copy(samplePositions),getState:()=>copy(state),startPet,finishPet,acceptNotice,finishNotice,startGarden,marketAction});
  console.info('Toon Valley side quest overhaul ready',window.ToonValleySideQuests.counts);
})();