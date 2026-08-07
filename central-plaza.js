(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const root = new THREE.Group();
  root.position.set(-14, TV.terrainHeight(-14, 16), 16);
  TV.scene.add(root);
  const stone = TV.mat(0xd9d3c2), blue = TV.mat(0x66bde8), green = TV.mat(0x5da76b), tan = TV.mat(0xe8c98d), red = TV.mat(0xc84d4d), yellow = TV.mat(0xf2c94c), dark = TV.mat(0x57483f), metal = TV.mat(0x59636c);

  const basin = TV.outlinedMesh(new THREE.CylinderGeometry(2.25, 2.45, .45, 18), stone, 1.025); basin.position.set(0,.23,0); root.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.95,1.95,.1,18), blue); water.position.set(0,.47,0); root.add(water);
  const pedestal = TV.outlinedMesh(new THREE.CylinderGeometry(.38,.55,1.7,10), stone, 1.03); pedestal.position.set(0,1.25,0); root.add(pedestal);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(.42,12,8), blue); topper.position.set(0,2.25,0); root.add(topper);
  TV.addCircleCollider(-14,16,2.45);
  TV.registerInteraction({object:root,radius:3.8,area:'world',prompt:'Make a wish at the fountain',action:()=>TV.showToast('⛲ You make a wish for a good day in Toon Valley.',2.4)});

  const stall = new THREE.Group(); stall.position.set(6.8,0,-1.2); root.add(stall);
  const counter = TV.outlinedMesh(TV.unitBox,tan,1.03); counter.scale.set(2.4,.9,1.25); counter.position.y=.45; stall.add(counter);
  const canopy = TV.outlinedMesh(TV.unitBox,red,1.03); canopy.scale.set(2.8,.16,1.55); canopy.position.y=2.35; stall.add(canopy);
  [-1.15,1.15].forEach(x=>{const post=new THREE.Mesh(TV.unitBox,dark);post.scale.set(.12,2.2,.12);post.position.set(x,1.15,-.55);stall.add(post);});
  for(let i=0;i<5;i++){const crate=TV.outlinedMesh(TV.unitBox,i%2?green:tan,1.02);crate.scale.set(.35,.28,.35);crate.position.set(-.8+i*.4,1.02,.05+(i%2)*.18);stall.add(crate);}
  TV.addBoxCollider(-7.2,14.8,2.8,1.6);
  let marketDay=-1,sampleTaken=false;
  function syncDay(){const today=Life.getState().world.day;if(marketDay!==today){marketDay=today;sampleTaken=false;}}
  syncDay();
  TV.registerInteraction({object:stall,radius:3.4,area:'world',prompt:'Visit the farmers market',action:()=>{syncDay();if(!sampleTaken){sampleTaken=true;Life.addMoney(10,'Market tasting survey');Life.emitProgress('help',1,{activity:'farmers-market'});TV.showToast('🥕 You helped taste-test produce. The vendor pays you $10.',2.8);}else TV.showToast('🥬 Fresh produce, jam, and bread are on today’s market table.',2.4);}});

  [[-5.3,-4],[-5,4.2],[4.4,4.4],[4,-4.4]].forEach(([x,z],index)=>{const table=new THREE.Group();table.position.set(x,0,z);root.add(table);const top=TV.outlinedMesh(TV.unitBox,dark,1.02);top.scale.set(1.8,.16,.8);top.position.y=.8;table.add(top);[-.65,.65].forEach(sx=>{const bench=TV.outlinedMesh(TV.unitBox,tan,1.02);bench.scale.set(.28,.18,1.65);bench.position.set(sx,.48,0);table.add(bench);});TV.registerInteraction({object:table,radius:2,area:'world',prompt:'Rest at picnic table',action:()=>TV.showToast(index%2?'🌳 The plaza is calm from here.':'🥪 A perfect spot for lunch.',2)});});

  const playground=new THREE.Group();playground.position.set(-11.5,0,10.5);root.add(playground);
  const playPad=TV.outlinedMesh(TV.unitBox,TV.mat(0xd8bc83),1.015);playPad.scale.set(8,.1,6);playPad.position.y=.03;playground.add(playPad);
  const swingFrame=new THREE.Group();swingFrame.position.set(-2.3,0,0);playground.add(swingFrame);
  [-1.25,1.25].forEach(x=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,3,7),metal);leg.position.set(x,1.5,0);leg.rotation.z=x<0?-.2:.2;swingFrame.add(leg);});
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.8,7),metal);bar.rotation.z=Math.PI/2;bar.position.y=2.8;swingFrame.add(bar);
  const swingSeats=[];
  [-.62,.62].forEach((x,i)=>{const pivot=new THREE.Group();pivot.position.set(x,2.7,0);swingFrame.add(pivot);[-.25,.25].forEach(sx=>{const rope=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,1.65,5),dark);rope.position.set(sx,-.82,0);pivot.add(rope);});const seat=TV.outlinedMesh(TV.unitBox,i?blue:red,1.02);seat.scale.set(.65,.1,.34);seat.position.y=-1.62;pivot.add(seat);swingSeats.push(pivot);});
  const slide=new THREE.Group();slide.position.set(2.1,0,.4);playground.add(slide);
  const tower=TV.outlinedMesh(TV.unitBox,yellow,1.02);tower.scale.set(1.4,1.8,1.4);tower.position.y=.9;slide.add(tower);
  const slideRamp=TV.outlinedMesh(TV.unitBox,blue,1.02);slideRamp.scale.set(.72,.1,2.8);slideRamp.rotation.x=-.48;slideRamp.position.set(0,.95,1.65);slide.add(slideRamp);
  const ladder=new THREE.Mesh(TV.unitBox,metal);ladder.scale.set(.65,1.45,.08);ladder.position.set(0,.8,-.78);slide.add(ladder);
  // Keep the play surface traversable: collide only with solid supports and the slide tower.
  TV.addCircleCollider(-29.05,26.5,.35); TV.addCircleCollider(-26.55,26.5,.35); TV.addBoxCollider(-23.4,26.9,1.55,1.55);
  let playgroundUses=0;
  TV.registerInteraction({object:swingFrame,radius:3,area:'world',prompt:'Play on the swings',action:()=>{playgroundUses+=1;Life.emitProgress('explore',1,{activity:'playground'});TV.showToast(playgroundUses===1?'🛝 You take a quick swing. The park feels more alive already.':'🎠 Another lap on the playground!',2.3);}});

  const dogPark=new THREE.Group();dogPark.position.set(11.5,0,10.2);root.add(dogPark);
  const grass=TV.outlinedMesh(TV.unitBox,TV.mat(0x72ad62),1.01);grass.scale.set(8.2,.08,6.2);grass.position.y=.02;dogPark.add(grass);
  const fenceMat=TV.mat(0xd2c6a8);
  [[0,-3.05,8.2,.12],[-2.7,3.05,2.8,.12],[2.7,3.05,2.8,.12],[-4.05,0,.12,6.2],[4.05,0,.12,6.2]].forEach(([x,z,w,d])=>{const rail=TV.outlinedMesh(TV.unitBox,fenceMat,1.02);rail.scale.set(w,.85,d);rail.position.set(x,.48,z);dogPark.add(rail);});
  const sign=TV.outlinedMesh(TV.unitBox,tan,1.02);sign.scale.set(1.8,.85,.12);sign.position.set(0,1.2,3);dogPark.add(sign);
  function createDog(color,x,z,name){const dog=new THREE.Group();dog.position.set(x,.35,z);dogPark.add(dog);const coat=TV.mat(color);const body=TV.outlinedMesh(new THREE.SphereGeometry(.38,8,6),coat,1.035);body.scale.set(1.4,.78,.82);dog.add(body);const head=TV.outlinedMesh(new THREE.SphereGeometry(.27,8,6),coat,1.035);head.position.set(.48,.16,0);dog.add(head);const tail=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,.62,5),coat);tail.rotation.z=-1;tail.position.set(-.58,.18,0);dog.add(tail);dog.userData.name=name;dog.userData.target=new THREE.Vector2(x,z);dog.userData.timer=0;dog.userData.phase=Math.random()*Math.PI*2;TV.registerInteraction({object:dog,radius:2.2,area:'world',prompt:`Pet ${name}`,action:()=>TV.showToast(`🐶 ${name} gives you an enthusiastic tail wag.`,2.1)});return dog;}
  const dogs=[createDog(0xc98f58,-1.8,-.7,'Biscuit'),createDog(0x5d5350,1.5,.6,'Scout'),createDog(0xe1c9a6,.3,-1.7,'Noodle')];
  TV.registerInteraction({object:sign,radius:2.8,area:'world',prompt:'Read dog park rules',action:()=>TV.showToast('🐕 Toon Valley Dog Park · Please close the gate and share the tennis balls.',2.5)});

  let elapsed=0;
  TV.registerUpdateHook(dt=>{elapsed+=dt;water.rotation.y+=dt*.08;topper.position.y=2.25+Math.sin(elapsed*2.4)*.08;swingSeats[0].rotation.x=Math.sin(elapsed*1.8)*.23;swingSeats[1].rotation.x=Math.sin(elapsed*1.8+Math.PI)*.23;dogs.forEach((dog,index)=>{dog.userData.timer-=dt;if(dog.userData.timer<=0){dog.userData.timer=2.2+index*.45;dog.userData.target.set((Math.random()-.5)*5.4,(Math.random()-.5)*3.7);}const dx=dog.userData.target.x-dog.position.x,dz=dog.userData.target.y-dog.position.z,dist=Math.hypot(dx,dz);if(dist>.15){const step=Math.min(dist,dt*(1.1+index*.12));dog.position.x+=dx/dist*step;dog.position.z+=dz/dist*step;dog.rotation.y=Math.atan2(dx,dz);}dog.position.y=.35+Math.abs(Math.sin(elapsed*5+dog.userData.phase))*.035;});if(Math.floor(elapsed)%3===0)syncDay();});
  window.ToonValleyCentralPlaza={root,fountain:basin,market:stall,picnicTables:4,playground,swingSeats:swingSeats.length,dogPark,dogs:dogs.length};
  console.info('Toon Valley central plaza ready');
})();
