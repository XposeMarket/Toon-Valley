(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;const{THREE}=TV;
  const tmp=new THREE.Vector3();let swing=null,petAnim=null,movieView=false,oldFov=TV.camera.fov;
  const pose=TV.player.userData;
  const resetPose=()=>{if(!pose?.legs||!pose?.arms)return;pose.bodyRoot.position.y=.08;pose.legs[0].rotation.x=pose.legs[1].rotation.x=0;pose.arms[0].rotation.x=pose.arms[1].rotation.x=0;pose.arms[0].rotation.z=pose.arms[1].rotation.z=0;};
  const seatedPose=()=>{if(!pose?.legs||!pose?.arms)return;pose.bodyRoot.position.y=.08;pose.legs[0].rotation.x=pose.legs[1].rotation.x=-1.12;pose.arms[0].rotation.x=pose.arms[1].rotation.x=-.22;};
  const crouchPose=()=>{if(!pose?.legs||!pose?.arms)return;pose.bodyRoot.position.y=-.28;pose.legs[0].rotation.x=pose.legs[1].rotation.x=-.62;pose.arms[0].rotation.x=-1.05;pose.arms[1].rotation.x=-.72;pose.arms[0].rotation.z=-.12;pose.arms[1].rotation.z=.12;};
  function sitWorld(x,z,rot=0,kind='seat'){
    if(TV.state.seated)TV.standUpFromSeat(false);TV.state.seated=true;TV.state.seat={position:{x,z},rotation:{y:rot},userData:{kind}};TV.player.position.set(x,TV.currentGroundHeight(x,z)+.62,z);TV.player.rotation.y=rot;TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;TV.state.grounded=true;TV.state.cameraReady=false;seatedPose();
  }
  function startSwing(item){
    const frame=item.object;if(!frame)return;const pivots=frame.children.filter(c=>c.isGroup&&c.position.y>2);const pivot=pivots[0];if(!pivot)return;TV.state.seated=true;TV.state.seat={userData:{kind:'swing'}};swing={pivot};TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;TV.state.grounded=true;TV.state.cameraReady=false;seatedPose();window.ToonValleyLife?.emitProgress('explore',1,{activity:'playground-swing'});TV.showToast('🎠 Swinging! Move, jump, or use to hop off.',2.1);
  }
  function stopMovie(show=true){if(!movieView)return;movieView=false;TV.player.visible=true;TV.camera.fov=oldFov;TV.camera.updateProjectionMatrix();if(TV.state.seated)TV.standUpFromSeat(false);resetPose();TV.state.cameraReady=false;if(show)TV.showToast('🎬 You stand up from your theater seat.',1.5);}
  function startMovie(item){
    const p=item.object?.getWorldPosition?item.object.getWorldPosition(tmp):tmp.set(item.x||895,.6,item.z||0);sitWorld(p.x,p.z,Math.PI,'theater');movieView=true;oldFov=TV.camera.fov;TV.camera.fov=50;TV.camera.updateProjectionMatrix();TV.player.visible=false;TV.state.cameraReady=false;TV.showToast('🎬 Movie view · tap/click or press USE to stand.',2.2);
  }
  function pet(item){
    if(petAnim)return;const target=item.object;if(!target)return;target.getWorldPosition(tmp);const dx=tmp.x-TV.player.position.x,dz=tmp.z-TV.player.position.z;TV.player.rotation.y=Math.atan2(dx,dz);TV.playerVelocity.set(0,0,0);crouchPose();petAnim={t:0,target,original:item._physicalOriginal};TV.showToast('🐾 You crouch down and give them a proper pet.',1.5);
  }
  function wrap(item,kind){if(item._physicalWrapped)return;item._physicalWrapped=true;item._physicalOriginal=item.action;item.action=()=>{
    if(kind==='swing')return startSwing(item);
    if(kind==='movie')return startMovie(item);
    if(kind==='picnic'){item.object?.getWorldPosition?.(tmp);sitWorld(tmp.x,tmp.z,item.object?.rotation?.y||0,'picnic');return TV.showToast('🥪 You sit down at the picnic table.',1.6);}
    if(kind==='pet')return pet(item);
    return item._physicalOriginal?.();
  };}
  for(const item of TV.interactables){
    if(item.prompt==='Play on the swings')wrap(item,'swing');
    else if(item.prompt==='Rest at picnic table')wrap(item,'picnic');
    else if(item.area==='theater'&&/Sit/.test(item.prompt))wrap(item,'movie');
    else if(/^Pet /.test(item.prompt)||item.prompt==='Pet your companion'||/^Help .* get home$/.test(item.prompt))wrap(item,'pet');
  }
  TV.renderer.domElement.addEventListener('pointerdown',e=>{if(!movieView)return;e.preventDefault();e.stopImmediatePropagation();stopMovie(true);},true);
  document.addEventListener('keydown',e=>{if(movieView&&e.code==='KeyE'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();stopMovie(true);}},true);
  const previousSceneBefore=TV.scene.onBeforeRender;
  TV.scene.onBeforeRender=(renderer,scene,camera,...rest)=>{
    previousSceneBefore?.call(TV.scene,renderer,scene,camera,...rest);
    if(movieView){camera.position.set((TV.areaBounds.theater?.cx||895),4.25,-7.8);camera.lookAt((TV.areaBounds.theater?.cx||895),4.2,-13.05);return;}
    if(TV.DEVICE.touch){const lookY=TV.player.position.y+1.45-TV.state.pitch*5.1;camera.lookAt(TV.player.position.x,lookY,TV.player.position.z);}
  };
  TV.registerUpdateHook(dt=>{
    if(swing){if(!TV.state.seated||TV.state.seat?.userData?.kind!=='swing'){swing=null;resetPose();}else{const p=tmp.set(0,-1.55,0);swing.pivot.localToWorld(p);TV.player.position.copy(p);TV.player.position.y+=.18;TV.player.rotation.y=swing.pivot.getWorldQuaternion(new THREE.Quaternion()).setFromEuler?TV.player.rotation.y:TV.player.rotation.y;TV.playerVelocity.set(0,0,0);seatedPose();}}
    if(movieView&&!TV.state.seated)stopMovie(false);
    if(petAnim){petAnim.t+=dt;crouchPose();const d=pose?.arms;if(d){d[0].rotation.x=-1.15+Math.sin(petAnim.t*11)*.18;d[1].rotation.x=-.72;}if(petAnim.t>=.85){const fn=petAnim.original;petAnim=null;resetPose();fn?.();}}
  });
  window.ToonValleyInteractionActions=Object.freeze({counts:{wrapped:TV.interactables.filter(i=>i._physicalWrapped).length},get movieView(){return movieView;},startMovie,stopMovie,sitWorld});
  console.info('Toon Valley physical interactions ready',window.ToonValleyInteractionActions.counts);
})();