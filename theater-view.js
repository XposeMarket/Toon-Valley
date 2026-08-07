(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;const{THREE}=TV,b=TV.areaBounds.theater;if(!b)return;
  const style=document.createElement('style');style.textContent='body.tv-movie-view #life-hud,body.tv-movie-view #hud>.top-left,body.tv-movie-view #hud>.top-right,body.tv-movie-view #hud>.location,body.tv-movie-view #interaction-prompt,body.tv-movie-view #mobile-controls{display:none!important}#tv-movie-exit{position:fixed;z-index:15000;left:50%;bottom:calc(18px + var(--safe-bottom));transform:translateX(-50%);pointer-events:none;background:#0d1119cc;color:#fff;border:2px solid #ffffffaa;border-radius:999px;padding:8px 14px;font:800 11px system-ui;letter-spacing:.04em}';document.head.appendChild(style);
  const hint=document.createElement('div');hint.id='tv-movie-exit';hint.textContent='TAP / CLICK TO STAND UP';hint.style.display='none';document.body.appendChild(hint);
  const moviePos=new THREE.Vector3(b.cx,4.15,b.cz-7.75),movieLook=new THREE.Vector3(b.cx,4.15,b.cz-13.05);let active=false;
  function enter(){if(active)return;active=true;TV.setModalOpen(true);document.body.classList.add('tv-movie-view');hint.style.display='block';TV.player.visible=false;if(document.pointerLockElement)document.exitPointerLock?.();TV.state.cameraReady=false;}
  function leave(stand=true){if(!active)return;active=false;document.body.classList.remove('tv-movie-view');hint.style.display='none';TV.player.visible=true;TV.setModalOpen(false);if(stand&&TV.state.seated)TV.standUpFromSeat(false);TV.state.cameraReady=false;if(TV.DEVICE.touch&&TV.state.started)document.getElementById('mobile-controls')?.classList.remove('hidden');}
  const oldBefore=TV.scene.onBeforeRender;TV.scene.onBeforeRender=function(...args){oldBefore?.apply(this,args);if(!active)return;TV.camera.position.copy(moviePos);TV.camera.lookAt(movieLook);};
  TV.renderer.domElement.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();e.stopImmediatePropagation();leave(true);},true);
  document.addEventListener('keydown',e=>{if(!active||e.repeat)return;if(['Escape','KeyE','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();leave(true);}},true);
  TV.registerUpdateHook(()=>{const should=TV.state.area==='theater'&&TV.state.seated;if(should&&!active)enter();else if(!should&&active)leave(false);});
  window.ToonValleyTheaterView=Object.freeze({get active(){return active;},enter,leave,camera:{x:moviePos.x,y:moviePos.y,z:moviePos.z}});
  console.info('Toon Valley theater view ready');
})();