(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;let wasMovie=false;
  const previous=TV.scene.onBeforeRender;
  TV.scene.onBeforeRender=function(renderer,scene,camera,...rest){
    previous?.call(this,renderer,scene,camera,...rest);
    const movie=Boolean(window.ToonValleyInteractionExperience?.movieView?.());
    if(movie){
      if(!wasMovie){camera.fov=58;camera.zoom=1.08;camera.updateProjectionMatrix();wasMovie=true;}
      const b=TV.areaBounds.theater;camera.position.set(b.cx,4.18,b.cz-7.95);camera.lookAt(b.cx,4.18,b.cz-13.05);return;
    }
    if(wasMovie){wasMovie=false;TV.state.cameraReady=false;}
    if(TV.DEVICE.touch){
      // Core camera pitch mostly moves the camera vertically. Re-aim here so
      // negative pitch actually looks above the player instead of staying level.
      const targetY=TV.player.position.y+1.45-TV.state.pitch*5.4;
      camera.lookAt(TV.player.position.x,targetY,TV.player.position.z);
    }
  };
  window.ToonValleyCameraPolish=Object.freeze({movieFov:58,movieZoom:1.08,touchLook:true});
  console.info('Toon Valley camera experience polish ready');
})();