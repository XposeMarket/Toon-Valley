(() => {
  'use strict';
  const TV=window.ToonValley,LI=window.ToonValleyLivingInteriors;
  if(!TV||!LI)return;
  const{THREE}=TV;

  // Rainbow Elementary: desks/chairs and seated students now face the chalkboard
  // on the north wall instead of looking back toward the classroom entrance.
  const school=TV.interiorGroups.school,b=TV.areaBounds.school;
  const chairTargets=[];
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)chairTargets.push({x:b.cx-6.3+c*4.2,z:b.cz-3.2+r*3.2,label:'student chair'});
  chairTargets.push({x:b.cx,z:b.cz-5.8,label:'teacher chair'});
  const classroomNames=new Set(['Ms. Maple','Cleo','Milo','Nora','Jasper']);
  let physicalChairs=0,peopleFacingBoard=0,seatActions=0;
  if(school){
    for(const child of school.children){
      if(classroomNames.has(child.userData?.name)){
        child.rotation.y=Math.PI;
        peopleFacingBoard++;
        continue;
      }
      if(!child.isGroup||child.userData?.name||child.children.length<5)continue;
      const match=chairTargets.find(p=>Math.hypot(child.position.x-p.x,child.position.z-p.z)<.18);
      if(match){child.rotation.y=Math.PI;physicalChairs++;}
    }
  }
  for(const item of TV.interactables){
    if(item.area!=='school'||!/^Sit at (student|teacher) chair$/.test(item.prompt||''))continue;
    const label=item.prompt.includes('teacher')?'teacher chair':'student chair';
    item.action=()=>LI.sitAt('school',item.x,item.z,Math.PI,label);
    seatActions++;
  }

  const root=new THREE.Group();TV.scene.add(root);
  const beaconMat=new THREE.MeshBasicMaterial({color:0xffe36e,fog:false}),lakeMat=new THREE.MeshBasicMaterial({color:0x74e5ff,fog:false});
  function beacon(x,z,material){
    const g=new THREE.Group();g.position.set(x,TV.terrainHeight(x,z),z);root.add(g);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,6.8,6),TV.materials.dark);pole.position.y=3.4;g.add(pole);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.72,0),material);gem.position.y=7.15;g.add(gem);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,6,18),material);ring.rotation.x=Math.PI/2;ring.position.y=7.15;g.add(ring);
    return{g,gem,ring};
  }
  const trailBeacon=beacon(-100,34,beaconMat),lakeBeacon=beacon(82,-70,lakeMat);
  function sign(x,z,tx,tz,color,prompt,message){
    const g=new THREE.Group();g.position.set(x,TV.terrainHeight(x,z),z);g.rotation.y=Math.atan2(tx-x,tz-z);root.add(g);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,2.9,6),TV.materials.wood);post.position.y=1.45;g.add(post);
    const board=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.025);board.scale.set(2.8,.8,.18);board.position.set(0,2.45,0);g.add(board);
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(.34,.9,4),TV.materials.white);arrow.rotation.x=Math.PI/2;arrow.position.set(0,2.45,.55);g.add(arrow);
    TV.registerInteraction({x,z,radius:4,area:'world',prompt,action:()=>TV.showToast(message,3)});
  }
  sign(-98,34,-104,46,0xe3a34f,'Read Mountain Trail sign','🥾 MOUNTAIN TRAIL → Follow the wide brown footpath to Pine Gate, Foxglove Bend, Cloud Lookout, and Sunset Rock.');
  sign(76,-39,82,-70,0x4dbce8,'Read Bluebell Lake sign','🌊 BLUEBELL LAKE → Follow the south road to the blue beacon and dock.');
  let time=0;TV.registerUpdateHook(dt=>{time+=dt;for(const [i,o] of [trailBeacon,lakeBeacon].entries()){const s=1+Math.sin(time*2.2+i)*.12;o.gem.scale.setScalar(s);o.ring.rotation.z+=dt*(i?-.35:.35);}});

  window.ToonValleyNavigationPolish=Object.freeze({active:true,classroom:{physicalChairs,peopleFacingBoard,seatActions},wayfinding:{beacons:2,signs:2,trail:{x:-100,z:34},lake:{x:82,z:-70}}});
  console.info('Toon Valley navigation polish ready',window.ToonValleyNavigationPolish);
})();