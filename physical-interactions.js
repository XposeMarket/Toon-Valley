(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;const{THREE}=TV;
  const world=new THREE.Vector3();let action=null,slide=null;
  function faceObject(object){if(!object)return;object.getWorldPosition(world);TV.player.rotation.y=Math.atan2(world.x-TV.player.position.x,world.z-TV.player.position.z)}
  function animate(kind,object,duration=1.15){faceObject(object);TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;action={kind,object,left:duration,total:duration};}
  function sitWorld(x,z,rot=0,label='seat',follow=null){TV.state.seated=true;TV.state.seat={position:{x,z},rotation:{y:rot},userData:{label,follow}};TV.player.position.set(x,TV.terrainHeight(x,z)+.02,z);TV.player.rotation.y=rot;TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;TV.state.grounded=true;TV.state.cameraReady=false;}

  // Plaza picnic tables now work like real benches instead of toast-only scenery.
  TV.interactables.filter(i=>i.prompt==='Rest at picnic table').forEach((item,index)=>{item.action=()=>{item.object.getWorldPosition(world);sitWorld(world.x+(index%2?1.05:-1.05),world.z, index%2?-Math.PI/2:Math.PI/2,'picnic table');TV.showToast('🪑 You sit down at the plaza table.',1.7);};});

  // Ride the actual moving swing pivot and follow it every frame.
  const swing=TV.interactables.find(i=>i.prompt==='Play on the swings');
  if(swing){swing.action=()=>{const pivots=swing.object.children.filter(c=>c.isGroup&&Math.abs(c.position.y-2.7)<.25);const pivot=pivots[0];if(!pivot)return;const seat=pivot.children.find(c=>c.isGroup&&c.position.y< -1);(seat||pivot).getWorldPosition(world);sitWorld(world.x,world.z,0,'playground swing',seat||pivot);TV.state.seat.userData.swing=true;TV.showToast('🎠 Move, jump, or use to hop off the swing.',1.9);};}

  // Add a real slide interaction to the existing playground structure.
  const playground=window.ToonValleyCentralPlaza?.playground;
  const slideObject=playground?.children?.find(c=>c.isGroup&&c!==swing?.object&&c.children?.length>=3);
  if(slideObject)TV.registerInteraction({object:slideObject,radius:2.8,area:'world',prompt:'Go down the slide',action:()=>{slideObject.getWorldPosition(world);slide={t:0,start:new THREE.Vector3(world.x,TV.terrainHeight(world.x,world.z)+2.25,world.z-.7),end:new THREE.Vector3(world.x,TV.terrainHeight(world.x,world.z+3)+.1,world.z+3)};TV.playerVelocity.set(0,0,0);TV.state.cameraReady=false;}});

  // Petting now visibly crouches/reaches toward the animal and wags its tail.
  TV.interactables.filter(i=>/^Pet /.test(i.prompt||'')||i.prompt==='Pet your companion').forEach(item=>{const original=item.action;item.action=()=>{animate('pet',item.object,1.25);const tail=item.object?.userData?.tailPivot;if(tail)tail.userData.extraWag=1.25;original?.();};});
  // Lost-pet rescue gets a short physical greeting before the pet disappears home.
  TV.interactables.filter(i=>/^Help .+ get home$/.test(i.prompt||'')).forEach(item=>{const original=item.action;let busy=false;item.action=()=>{if(busy)return;busy=true;animate('pet',item.object,1.05);setTimeout(()=>{original?.();busy=false;},620);};});
  // Gardening actions now use a visible tending/pouring pose.
  TV.interactables.filter(i=>/Water community garden|Tend community garden|Harvest garden produce/.test(i.prompt||'')).forEach(item=>{const original=item.action;item.action=()=>{animate(item.prompt.startsWith('Harvest')?'harvest':'water',item.object,1.2);original?.();};});
  const fountain=TV.interactables.find(i=>i.prompt==='Make a wish at the fountain');if(fountain){const original=fountain.action;fountain.action=()=>{animate('wish',fountain.object,1);original?.();};}

  TV.registerUpdateHook(dt=>{
    if(slide){slide.t+=dt/1.15;const t=Math.min(1,slide.t),s=t*t*(3-2*t);TV.player.position.lerpVectors(slide.start,slide.end,s);TV.player.rotation.y=0;TV.playerVelocity.set(0,0,0);TV.state.grounded=true;TV.state.cameraReady=false;if(t>=1)slide=null;}
    if(TV.state.seated&&TV.state.seat?.userData?.swing){const obj=TV.state.seat.userData.follow;if(obj){obj.getWorldPosition(world);TV.player.position.set(world.x,world.y-.52,world.z);TV.player.rotation.y=obj.getWorldQuaternion(new THREE.Quaternion()).y;TV.state.cameraReady=false;}}
    if(action){action.left-=dt;const d=TV.player.userData;if(action.object)faceObject(action.object);if(action.kind==='pet'){d.bodyRoot.position.y=-.12;d.legs[0].rotation.x=d.legs[1].rotation.x=-.55;d.arms[0].rotation.x=-1.15;d.arms[1].rotation.x=-.72;}else if(action.kind==='water'){d.bodyRoot.rotation.x=.12;d.arms[0].rotation.x=-1.0;d.arms[1].rotation.x=-.45;}else if(action.kind==='harvest'){d.bodyRoot.position.y=-.1;d.legs[0].rotation.x=d.legs[1].rotation.x=-.48;d.arms[0].rotation.x=-.9;d.arms[1].rotation.x=-.9;}else if(action.kind==='wish'){d.arms[0].rotation.x=d.arms[1].rotation.x=-1.15;d.arms[0].rotation.z=.45;d.arms[1].rotation.z=-.45;}if(action.left<=0)action=null;}
    const polished=window.ToonValleyPetPolish;if(polished){TV.interactables.forEach(i=>{const tail=i.object?.userData?.tailPivot;if(tail?.userData?.extraWag>0){tail.userData.extraWag-=dt;tail.rotation.y=Math.sin(performance.now()*.018)*.85;}});}
  });
  window.ToonValleyPhysicalInteractions=Object.freeze({counts:{picnicSeats:TV.interactables.filter(i=>i.prompt==='Rest at picnic table').length,petActions:TV.interactables.filter(i=>/^Pet /.test(i.prompt||'')||i.prompt==='Pet your companion').length,slide:slideObject?1:0,swing:swing?1:0}});
  console.info('Toon Valley physical interactions ready',window.ToonValleyPhysicalInteractions.counts);
})();