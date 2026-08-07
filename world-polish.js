(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV) return;
  const { THREE } = TV;
  const pauseScreen=document.getElementById('pause-screen');
  const keepModalAbovePause=()=>{if(TV.state.modalOpen)pauseScreen?.classList.add('hidden');};
  document.addEventListener('pointerlockchange',keepModalAbovePause);TV.registerUpdateHook(keepModalAbovePause);
  const pondCandidates=TV.scene.children.filter(o=>o.isMesh&&o.geometry?.type==='CircleGeometry'&&o.material===TV.materials.water);
  const oldPond=pondCandidates.find(o=>Math.hypot(o.position.x+76,o.position.z-45)<8||Math.hypot(o.position.x+99,o.position.z-48)<8||Math.hypot(o.position.x+112,o.position.z-52)<8);
  const legacyPondRemoved=!!oldPond;if(oldPond)TV.scene.remove(oldPond);
  const extraRoads=[[-64,34,-100,34,7.4],[43,63,43,76,7.2],[64,-38,78,-38,7.4],[78,-38,78,-74,7.4]];
  function addRoad(x1,z1,x2,z2,width){const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz)+.8,mx=(x1+x2)*.5,mz=(z1+z2)*.5,y=TV.terrainHeight(mx,mz)+.075,angle=Math.atan2(dx,dz),road=new THREE.Mesh(TV.unitBox,TV.materials.road);road.position.set(mx,y,mz);road.rotation.y=angle;road.scale.set(width,.16,length);TV.scene.add(road);TV.roadSegments.push({x1,z1,x2,z2,width,addedBy:'world-polish'});const count=Math.max(1,Math.floor(length/7));for(let i=0;i<count;i++){const t=(i+.5)/count,s=new THREE.Mesh(new THREE.BoxGeometry(.16,.025,2.7),TV.materials.roadLine);s.position.set(x1+dx*t,y+.1,z1+dz*t);s.rotation.y=angle;TV.scene.add(s);}}
  extraRoads.forEach(r=>addRoad(...r));
  window.ToonValleyWorldPolish=Object.freeze({pauseGuard:true,legacyPondRemoved,roadsAdded:extraRoads.length,roads:extraRoads.map(r=>r.slice())});
  console.info('Toon Valley world polish ready',window.ToonValleyWorldPolish);
})();