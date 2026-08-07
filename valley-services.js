(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-services-v1';
  const defaults = { gardenDay: -1, watered: [], petDay: -1, petsFound: [] };
  let state = load();
  const gardenBeds = [];
  const lostPets = [];
  function load(){try{const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');return{gardenDay:Number.isFinite(parsed.gardenDay)?parsed.gardenDay:defaults.gardenDay,watered:Array.isArray(parsed.watered)?parsed.watered.filter(Number.isInteger):[],petDay:Number.isFinite(parsed.petDay)?parsed.petDay:defaults.petDay,petsFound:Array.isArray(parsed.petsFound)?parsed.petsFound.filter(Number.isInteger):[]};}catch{return{...defaults,watered:[],petsFound:[]}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(error){console.warn('Unable to save valley services',error)}}
  function day(){return Life.getState().world.day}
  function resetDaily(){const today=day();if(state.gardenDay!==today){state.gardenDay=today;state.watered=[];gardenBeds.forEach(e=>e.group.visible=true)}if(state.petDay!==today){state.petDay=today;state.petsFound=[];lostPets.forEach(e=>e.group.visible=true)}save()}
  function makeGardenBed(x,z,index){const group=new THREE.Group(),soil=TV.outlinedMesh(TV.unitBox,TV.mat(0x6f4a32),1.03);soil.scale.set(1.5,.12,.8);soil.position.y=.08;group.add(soil);for(let i=0;i<4;i++){const plant=new THREE.Mesh(new THREE.ConeGeometry(.16,.55,6),TV.materials.green||TV.mat(0x59a84f));plant.position.set(-.9+i*.6,.38,0);group.add(plant)}const can=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.38,8),TV.materials.blue||TV.mat(0x4f83c2));can.position.set(1.15,.25,.45);can.rotation.z=-.2;group.add(can);group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);gardenBeds.push({group,index});TV.registerInteraction({object:group,radius:2.5,area:'world',prompt:'Water community garden',enabled:()=>!state.watered.includes(index),action:()=>{if(state.watered.includes(index))return;state.watered.push(index);Life.addMoney(12,'Community garden care');Life.emitProgress('help',1,{activity:'garden'});const complete=state.watered.length===gardenBeds.length;if(complete)Life.addMoney(60,'Garden caretaker bonus');TV.showToast(complete?'🌱 Community garden cared for! +$60 bonus':`💧 Garden bed watered · ${state.watered.length}/${gardenBeds.length}`,2.5);save()}})}
  function makeLostPet(x,z,index,name,color){const group=new THREE.Group(),coat=TV.mat(color),body=TV.outlinedMesh(new THREE.SphereGeometry(.34,8,6),coat,1.04),head=TV.outlinedMesh(new THREE.SphereGeometry(.25,8,6),coat,1.04);body.scale.set(1.15,.75,.75);body.position.y=.45;head.position.set(.35,.68,0);group.add(body,head);const tail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.55,6),coat);tail.rotation.z=-1.05;tail.position.set(-.5,.58,0);group.add(tail);for(const side of[-1,1]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.09,.23,5),coat);ear.position.set(.34,.94,side*.13);group.add(ear)}group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);lostPets.push({group,index,name});TV.registerInteraction({object:group,radius:2.3,area:'world',prompt:`Help ${name} get home`,enabled:()=>!state.petsFound.includes(index),action:()=>{if(state.petsFound.includes(index))return;state.petsFound.push(index);group.visible=false;Life.addMoney(35,'Lost pet returned');Life.emitProgress('help',2,{activity:'lost-pet',name});const complete=state.petsFound.length===lostPets.length;if(complete)Life.addMoney(85,'Neighborhood pet helper bonus');TV.showToast(complete?'🐾 All lost pets are home! +$85 bonus':`🐾 ${name} returned home · ${state.petsFound.length}/${lostPets.length}`,2.6);save()}})}
  // Daily beds now form a small annex immediately west of the main garden instead
  // of being scattered through the north residential/building footprint.
  [[-132,58],[-128,58],[-132,62],[-128,62],[-132,66]].forEach((p,i)=>makeGardenBed(p[0],p[1],i));
  [[-62,-8,'Mochi',0xe3a86b],[48,61,'Pepper',0x5d5d63],[86,-6,'Sunny',0xd9b73f]].forEach((p,i)=>makeLostPet(p[0],p[1],i,p[2],p[3]));
  resetDaily();lostPets.forEach(e=>{e.group.visible=!state.petsFound.includes(e.index)});let elapsed=0;TV.registerUpdateHook(dt=>{elapsed+=dt;if(elapsed>=2){elapsed=0;resetDaily()}});
  window.ToonValleyServices={getState:()=>JSON.parse(JSON.stringify(state)),counts:{gardenBeds:gardenBeds.length,lostPets:lostPets.length},gardenAnnex:gardenBeds.map(e=>({x:e.group.position.x,z:e.group.position.z}))};
  console.info('Toon Valley services ready',window.ToonValleyServices.counts);
})();