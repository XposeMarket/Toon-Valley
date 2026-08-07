(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const{THREE}=TV,KEY='toon-valley-neighborhood-quests-v1';
  const fresh=()=>({day:-1,clinic:{stage:'start',done:false},school:{stage:'start',done:false}});
  let state=(()=>{try{return Object.assign(fresh(),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return fresh()}})();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(error){console.warn('Unable to save neighborhood quests',error)}};
  const day=()=>Life.getState().world.day;

  const markerRoot=new THREE.Group();TV.scene.add(markerRoot);const markers=[];
  function makeMarker(color){const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color,fog:false,transparent:true,opacity:.96}),ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.08,6,18),m),bar=new THREE.Mesh(new THREE.BoxGeometry(.3,1.45,.3),m),dot=new THREE.Mesh(new THREE.SphereGeometry(.23,8,6),m);ring.rotation.x=Math.PI/2;ring.position.y=-.1;bar.position.y=1.25;dot.position.y=.25;g.add(ring,bar,dot);g.visible=false;markerRoot.add(g);const out={group:g,ring,x:0,z:0,active:false};markers.push(out);return out}
  function place(m,x,z){m.x=x;m.z=z;m.active=true;m.group.position.set(x,TV.terrainHeight(x,z)+6.1,z);m.group.visible=TV.state.area==='world'}
  function clear(m){m.active=false;m.group.visible=false}
  const clinicMarker=makeMarker(0xff7f9d),schoolMarker=makeMarker(0x9c7cff);

  const carryRoot=new THREE.Group();TV.player.add(carryRoot);
  function box(color,scale){const g=new THREE.Group(),b=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.025);b.scale.set(...scale);g.add(b);g.position.set(.72,1.2,.18);g.visible=false;carryRoot.add(g);return g}
  const soupCarry=box(0xe8b66c,[.58,.38,.58]),artCarry=box(0x9b73d6,[.7,.5,.5]);

  const bounds=TV.areaBounds;
  const outside={cafe:[-15,28.1],clinic:[-75,-9],generalStore:[26,-19.6],school:[72,-35]};
  function setClinic(stage){state.clinic.stage=stage;soupCarry.visible=stage==='return';if(stage==='pickup')place(clinicMarker,...outside.cafe);else if(stage==='return')place(clinicMarker,...outside.clinic);else clear(clinicMarker);save()}
  function setSchool(stage){state.school.stage=stage;artCarry.visible=stage==='return';if(stage==='pickup')place(schoolMarker,...outside.generalStore);else if(stage==='return')place(schoolMarker,...outside.school);else clear(schoolMarker);save()}

  // Clinic recovery meal: Rosa briefing -> cafe pickup -> carry soup back -> Rosa handoff/reward.
  TV.registerInteraction({x:bounds.clinic.cx-6.1,z:bounds.clinic.cz,radius:2.8,area:'clinic',prompt:'Ask Rosa about clinic deliveries',enabled:()=>!state.clinic.done&&state.clinic.stage==='start',action:()=>{setClinic('pickup');TV.showToast('🩺 Rosa: “Could you bring a recovery soup from Ari at Cloud Nine Cafe? Follow the pink marker.”',3.8)}});
  TV.registerInteraction({x:bounds.cafe.cx,z:bounds.cafe.cz-6.45,radius:2.8,area:'cafe',prompt:'Pick up recovery soup from Ari',enabled:()=>!state.clinic.done&&state.clinic.stage==='pickup',action:()=>{setClinic('return');TV.showToast('🥣 Ari packed the recovery soup. Carry it back to Rosa at the clinic.',3.2)}});
  TV.registerInteraction({x:bounds.clinic.cx-6.1,z:bounds.clinic.cz,radius:2.8,area:'clinic',prompt:'Deliver recovery soup to Rosa',enabled:()=>!state.clinic.done&&state.clinic.stage==='return',action:()=>{state.clinic.done=true;setClinic('done');Life.addMoney(110,'Clinic recovery meal run');Life.emitProgress('help',2,{activity:'clinic-meal-run'});TV.showToast('🩺 Rosa: “Perfect — our patient needed something warm. Thank you!” +$110',3.7)}});

  // Classroom art restock: Ms. Maple briefing -> store pickup -> carry supplies back -> teacher handoff/reward.
  TV.registerInteraction({x:bounds.school.cx,z:bounds.school.cz-5.5,radius:2.8,area:'school',prompt:'Ask Ms. Maple about classroom supplies',enabled:()=>!state.school.done&&state.school.stage==='start',action:()=>{setSchool('pickup');TV.showToast('🎨 Ms. Maple: “We ran out of art supplies. Could you collect the reserved kit from Nina at the General Store?”',3.9)}});
  TV.registerInteraction({x:bounds.generalStore.cx,z:bounds.generalStore.cz+5.2,radius:2.8,area:'generalStore',prompt:'Collect classroom art kit from Nina',enabled:()=>!state.school.done&&state.school.stage==='pickup',action:()=>{setSchool('return');TV.showToast('📦 Nina hands you the classroom art kit. Take it back to Ms. Maple at Rainbow Elementary.',3.4)}});
  TV.registerInteraction({x:bounds.school.cx,z:bounds.school.cz-5.5,radius:2.8,area:'school',prompt:'Give art kit to Ms. Maple',enabled:()=>!state.school.done&&state.school.stage==='return',action:()=>{state.school.done=true;setSchool('done');Life.addMoney(105,'Rainbow Elementary art supply run');Life.emitProgress('help',2,{activity:'school-art-run'});TV.showToast('🎨 Ms. Maple: “You saved today’s art lesson! The class says thank you.” +$105',3.8)}});

  function reset(force=false){const today=day();if(!force&&state.day===today)return;state=fresh();state.day=today;soupCarry.visible=false;artCarry.visible=false;markers.forEach(clear);save()}
  reset();
  if(state.clinic.stage==='pickup')place(clinicMarker,...outside.cafe);else if(state.clinic.stage==='return'){soupCarry.visible=true;place(clinicMarker,...outside.clinic)}
  if(state.school.stage==='pickup')place(schoolMarker,...outside.generalStore);else if(state.school.stage==='return'){artCarry.visible=true;place(schoolMarker,...outside.school)}

  let t=0,elapsed=0;TV.registerUpdateHook(dt=>{t+=dt;elapsed+=dt;markers.forEach((m,i)=>{m.group.position.y=TV.terrainHeight(m.x,m.z)+6.1+Math.sin(t*2.3+i)*.24;m.ring.rotation.z+=dt*.65;m.group.visible=m.active&&TV.state.area==='world'});if(elapsed>=2){elapsed=0;if(state.day!==day())reset(true)}});

  function summaries(){return[
    {icon:'🩺',title:'Clinic Recovery Meal',done:state.clinic.done,status:state.clinic.done?'DONE':state.clinic.stage==='start'?'START':state.clinic.stage==='pickup'?'PICKUP':'RETURN',text:state.clinic.done?'Recovery soup delivered to Rosa.':state.clinic.stage==='start'?'Talk to Rosa inside the clinic to begin the recovery-meal errand.':state.clinic.stage==='pickup'?'Go to Cloud Nine Cafe and pick up the recovery soup from Ari.':'Carry the soup back to Rosa inside the clinic for the handoff.'},
    {icon:'🎨',title:'Classroom Art Restock',done:state.school.done,status:state.school.done?'DONE':state.school.stage==='start'?'START':state.school.stage==='pickup'?'PICKUP':'RETURN',text:state.school.done?'Rainbow Elementary’s art supplies were delivered.':state.school.stage==='start'?'Talk to Ms. Maple inside Rainbow Elementary to begin the supply run.':state.school.stage==='pickup'?'Go to the General Store and collect the reserved art kit from Nina.':'Carry the art kit back to Ms. Maple inside Rainbow Elementary.'}
  ]}
  window.ToonValleyNeighborhoodQuests=Object.freeze({active:true,counts:{quests:2},getState:()=>JSON.parse(JSON.stringify(state)),getSummaries:summaries});
  console.info('Toon Valley neighborhood quests ready',window.ToonValleyNeighborhoodQuests.counts);
})();