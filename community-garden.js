(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;if(!TV||!Life)return;const{THREE}=TV;
  const KEY='toon-valley-community-garden-v1';
  const state=Object.assign({lastTendedDay:0,lastHarvestDay:-3,harvests:0},(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}})());
  const saveState=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}};
  const root=new THREE.Group();root.position.set(-116,TV.terrainHeight(-116,55),55);TV.scene.add(root);
  const fence=TV.mat(0xd8c89f),soil=TV.mat(0x7a4d31),leaf=TV.mat(0x4fa75d);
  const shed=TV.outlinedMesh(TV.unitBox,TV.mat(0xe9b96c),1.025);shed.scale.set(4.8,3.2,3.8);shed.position.set(-6,1.6,-3.4);root.add(shed);
  const roof=TV.outlinedMesh(new THREE.ConeGeometry(3.5,1.7,4),TV.materials.red,1.03);roof.rotation.y=Math.PI/4;roof.position.set(-6,4,-3.4);root.add(roof);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.7,.78,1.5,10),TV.materials.blue);barrel.position.set(-2.8,.75,-4.2);root.add(barrel);
  const beds=[];
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const bed=new THREE.Group();bed.position.set(-4+col*4.3,.15,1.5+row*4.2);root.add(bed);
    const box=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.02);box.scale.set(3.4,.45,2.8);box.position.y=.2;bed.add(box);
    const dirt=new THREE.Mesh(TV.unitBox,soil);dirt.scale.set(3.05,.16,2.45);dirt.position.y=.5;bed.add(dirt);
    const plants=[];for(let i=0;i<6;i++){const plant=TV.outlinedMesh(new THREE.IcosahedronGeometry(.28,0),leaf,1.03);plant.position.set(-1.05+(i%3)*1.05,.8,-.65+Math.floor(i/3)*1.3);bed.add(plant);plants.push(plant);}beds.push({bed,plants});
  }
  [[-7,-.8,16,.12],[7,-.8,16,.12],[-7,5.8,.12,13],[7,5.8,.12,13]].forEach(([x,z,w,d])=>{const rail=TV.outlinedMesh(TV.unitBox,fence,1.015);rail.scale.set(w,.7,d);rail.position.set(x,.42,z);root.add(rail);});
  const sign=TV.outlinedMesh(TV.unitBox,TV.materials.yellow,1.03);sign.scale.set(3.2,1.15,.15);sign.position.set(0,1.35,-.7);root.add(sign);
  function day(){return Life.getState().world.day;} function weather(){return Life.getState().world.weather;} function growth(){return Math.max(0,Math.min(1,(day()-state.lastHarvestDay)/2));}
  function syncPlants(){const g=growth();for(const {plants} of beds)plants.forEach((p)=>{const s=.65+g*.65;p.scale.setScalar(s);p.position.y=.68+g*.22;});}
  function tend(){const d=day();if(state.lastTendedDay===d){TV.showToast('🌱 The garden is already tended for today.',1.8);return;}state.lastTendedDay=d;saveState();Life.emitProgress('help',1,{activity:'community-garden'});TV.showToast(weather()==='rainy'?'🌧️ Rain watered the beds; you weeded and checked the seedlings.':'💧 You watered, weeded, and checked every garden bed.',2.6);syncPlants();}
  function harvest(){const d=day(),age=d-state.lastHarvestDay;if(age<2){TV.showToast(`🥕 The vegetables need ${2-age} more day${2-age===1?'':'s'} to ripen.`,2);return;}const cared=d-state.lastTendedDay<=1,pay=cared?95:55;state.lastHarvestDay=d;state.harvests++;saveState();Life.addMoney(pay,'Community garden harvest');Life.emitProgress('help',1,{activity:'garden-harvest'});TV.showToast(`🥕 Harvested a basket for the market. +$${pay}${cared?' care bonus!':''}`,2.8);syncPlants();}
  TV.registerInteraction({x:-116,z:55,radius:7,area:'world',prompt:'Tend community garden',action:tend});
  TV.registerInteraction({x:-111,z:60,radius:5,area:'world',prompt:'Harvest garden produce',action:harvest});
  TV.registerInteraction({object:sign,radius:3.2,area:'world',prompt:'Read community garden sign',action:()=>TV.showToast('🌻 Toon Valley Community Garden · Neighbors share the work and sell ripe produce at the market.',2.6)});
  syncPlants();
  window.ToonValleyCommunityGarden=Object.freeze({counts:{beds:beds.length,plants:beds.length*6},getState:()=>({...state,growth:growth()}),tend,harvest,root});
  console.info('Community Garden ready',window.ToonValleyCommunityGarden.counts);
})();
