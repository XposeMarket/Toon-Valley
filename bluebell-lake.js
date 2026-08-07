(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;if(!TV||!Life)return;const{THREE}=TV;
  const LAKE={x:112,z:-82,rx:28,rz:21};
  const rootY=TV.terrainHeight(LAKE.x,LAKE.z)+.08;
  const root=new THREE.Group();root.position.set(LAKE.x,rootY,LAKE.z);TV.scene.add(root);

  const earth=new THREE.Mesh(new THREE.CircleGeometry(1,72),TV.mat(0x8d7a52));earth.rotation.x=-Math.PI/2;earth.scale.set(LAKE.rx+4,LAKE.rz+4,1);earth.position.y=-.08;root.add(earth);
  const sand=new THREE.Mesh(new THREE.CircleGeometry(1,72),TV.mat(0xd9bd79));sand.rotation.x=-Math.PI/2;sand.scale.set(LAKE.rx+2.2,LAKE.rz+2.2,1);sand.position.y=-.025;root.add(sand);
  const waterMat=new THREE.MeshPhongMaterial({color:0x48bce8,shininess:85,specular:0xbdefff,transparent:true,opacity:.94});
  const water=new THREE.Mesh(new THREE.CircleGeometry(1,72),waterMat);water.rotation.x=-Math.PI/2;water.scale.set(LAKE.rx,LAKE.rz,1);water.position.y=.05;root.add(water);
  const shimmerMat=new THREE.MeshBasicMaterial({color:0xc6f5ff,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
  const shimmer=new THREE.Mesh(new THREE.RingGeometry(.3,1,72),shimmerMat);shimmer.rotation.x=-Math.PI/2;shimmer.scale.set(LAKE.rx*.88,LAKE.rz*.88,1);shimmer.position.y=.075;root.add(shimmer);

  const reeds=[];
  for(let i=0;i<38;i++){const a=i*Math.PI*2/38,r=1+(i%4)*.012;const reed=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.05+(i%4)*.16,5),TV.materials.green);reed.position.set(Math.cos(a)*(LAKE.rx+1.1)*r,.5,Math.sin(a)*(LAKE.rz+1.0)*r);reed.rotation.z=i%2?-.07:.07;root.add(reed);reeds.push(reed);}
  for(let i=0;i<18;i++){const a=(i/18)*Math.PI*2+.18;const rock=TV.outlinedMesh(new THREE.DodecahedronGeometry(.42+(i%3)*.08,0),TV.materials.rock,1.03);rock.position.set(Math.cos(a)*(LAKE.rx+2.6),.18,Math.sin(a)*(LAKE.rz+2.5));rock.scale.y=.65;root.add(rock);}
  const lilyPads=[];
  for(let i=0;i<12;i++){const a=.4+i*2.23,r=.28+(i%5)*.1;const pad=new THREE.Mesh(new THREE.CircleGeometry(.38+(i%3)*.08,14),TV.mat(i%3===0?0x4f9e57:0x63b968));pad.rotation.x=-Math.PI/2;pad.position.set(Math.cos(a)*LAKE.rx*r,.09,Math.sin(a)*LAKE.rz*r);root.add(pad);lilyPads.push(pad);if(i%4===0){const bloom=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),TV.materials.pink);bloom.position.copy(pad.position);bloom.position.y=.18;root.add(bloom);}}

  // Dock starts on dry ground beside the new lake-approach road and extends into water.
  const dock=new THREE.Group();dock.position.set(82,TV.terrainHeight(82,-70)+.2,-70);TV.scene.add(dock);
  for(let i=0;i<13;i++){const plank=TV.outlinedMesh(TV.unitBox,i%2?TV.mat(0x9e6638):TV.materials.wood,1.02);plank.scale.set(.88,.16,3.9);plank.position.set(i*.88,.08,0);dock.add(plank);}
  for(const x of[0,3.5,7,10.5])for(const z of[-1.75,1.75]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,2.1,6),TV.materials.dark);post.position.set(x,-.52,z);dock.add(post);}
  const sign=TV.outlinedMesh(TV.unitBox,TV.materials.yellow,1.03);sign.scale.set(3.2,1.05,.18);sign.position.set(-.8,1.55,2.15);dock.add(sign);
  const ropeMat=TV.mat(0xcaa56b);for(const z of[-1.85,1.85]){const rail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,10.5,5),ropeMat);rail.rotation.z=Math.PI/2;rail.position.set(5.2,1.05,z);dock.add(rail);}
  TV.registerInteraction({x:82,z:-70,radius:4.2,area:'world',prompt:'Visit Bluebell Lake dock',action:()=>TV.showToast('🌊 Bluebell Lake has a real shoreline, dock, rowboat, reeds, lilies, and fishing water.',2.6)});

  const boat=new THREE.Group(),visual=new THREE.Group(),waterY=rootY+.13;boat.position.set(94,waterY,-70);boat.rotation.y=Math.PI/2;boat.add(visual);TV.scene.add(boat);
  const hull=TV.outlinedMesh(TV.unitBox,TV.mat(0x8f5833),1.03);hull.scale.set(2.25,.45,4.9);hull.position.y=.18;visual.add(hull);
  const bow=TV.outlinedMesh(new THREE.ConeGeometry(1.25,2.2,4),TV.mat(0xa96d3d),1.03);bow.rotation.x=Math.PI/2;bow.rotation.y=Math.PI/4;bow.position.set(0,.15,3.35);visual.add(bow);
  for(const x of[-1.05,1.05]){const side=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.02);side.scale.set(.22,.62,4.9);side.position.set(x,.58,0);visual.add(side);}
  for(const z of[-1.35,0,1.35]){const bench=TV.outlinedMesh(TV.unitBox,TV.materials.cream,1.02);bench.scale.set(1.75,.18,.32);bench.position.set(0,.84,z);visual.add(bench);}
  const oars=[];for(const side of[-1,1]){const oar=new THREE.Group();const shaft=new THREE.Mesh(TV.unitBox,TV.materials.wood);shaft.scale.set(.12,.09,4.4);const blade=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.02);blade.scale.set(.48,.11,.9);blade.position.z=2.45;oar.add(shaft,blade);oar.position.set(side*1.18,.92,0);oar.rotation.y=side*.75;visual.add(oar);oars.push(oar);}
  const lantern=TV.outlinedMesh(new THREE.CylinderGeometry(.18,.22,.45,8),TV.materials.yellow,1.03);lantern.position.set(0,1.08,-1.95);visual.add(lantern);
  const wake=[];for(const side of[-.65,.65]){const w=new THREE.Mesh(new THREE.RingGeometry(.25,.62,18),new THREE.MeshBasicMaterial({color:0xe0f9ff,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false}));w.rotation.x=-Math.PI/2;w.position.set(side,.02,-2.75);visual.add(w);wake.push(w);}

  const css=document.createElement('style');css.textContent='#bl-controls{position:fixed;z-index:13000;left:50%;bottom:calc(14px + var(--safe-bottom));transform:translateX(-50%);background:#fff4d1;border:4px solid #172027;border-radius:16px;box-shadow:0 6px 0 #172027;padding:9px;display:flex;gap:8px;align-items:center;font:800 13px system-ui;color:#172027}#bl-controls button{border:3px solid #172027;border-radius:11px;background:#8fdcff;font-weight:900;padding:9px}@media(max-width:760px){#bl-controls{font-size:11px;max-width:92vw;flex-wrap:wrap;justify-content:center}}';document.head.appendChild(css);
  let riding=false,speed=0,lastFish=-99,clock=0;const keys=Object.create(null);
  function controls(){document.getElementById('bl-controls')?.remove();const d=document.createElement('div');d.id='bl-controls';d.innerHTML='<span>Joystick/WASD rows · steer left/right</span><button data-fish>🎣 FISH</button><button data-leave>⚓ DOCK</button>';document.body.appendChild(d);d.querySelector('[data-fish]').onclick=fish;d.querySelector('[data-leave]').onclick=leave;}
  function board(){if(riding)return;riding=true;controls();TV.state.seated=false;TV.playerVelocity.set(0,0,0);TV.state.cameraReady=false;TV.showToast('🚣 Row around Bluebell Lake. Use the joystick or WASD; fish from anywhere on the water.',3);}
  function leave(){if(!riding)return;riding=false;speed=0;document.getElementById('bl-controls')?.remove();TV.player.position.set(82,TV.terrainHeight(82,-70),-70);TV.playerVelocity.set(0,0,0);TV.state.grounded=true;TV.state.cameraReady=false;for(const k of Object.keys(keys))delete keys[k];TV.showToast('⚓ Back on the dock.',1.8);}
  function fish(){if(!riding)return;const now=performance.now()/1000;if(now-lastFish<3.5){TV.showToast('Let the water settle for a second.',1.4);return;}lastFish=now;const catches=[['sunfish',18],['bluegill',24],['silver trout',38],['golden carp',55]],pick=catches[Math.floor(Math.random()*catches.length)];Life.addMoney(pick[1],`Bluebell Lake ${pick[0]}`);Life.emitProgress('explore',1,{activity:'boat-fishing',fish:pick[0]});TV.showToast(`🎣 Caught a ${pick[0]}! +$${pick[1]}`,2.4);}
  TV.registerInteraction({object:boat,radius:4,area:'world',prompt:'Board wooden rowboat',enabled:()=>!riding,action:board});
  document.addEventListener('keydown',e=>{if(!riding)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyF','KeyE','Space'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}if(e.code==='KeyF'&&!e.repeat)return fish();if(e.code==='KeyE'&&!e.repeat)return leave();keys[e.code]=true;},true);document.addEventListener('keyup',e=>{if(riding)keys[e.code]=false;},true);
  TV.registerUpdateHook(dt=>{clock+=dt;shimmer.rotation.z+=dt*.025;shimmer.material.opacity=.13+Math.sin(clock*.8)*.035;boat.position.y=waterY+Math.sin(clock*1.7)*.04;if(!riding)return;const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+THREE.MathUtils.clamp(TV.state.mobileMoveY||0,-1,1),turn=(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0)-THREE.MathUtils.clamp(TV.state.mobileMoveX||0,-1,1);boat.rotation.y+=turn*dt*1.2*(.5+Math.min(1,Math.abs(speed)/2.5));speed=THREE.MathUtils.damp(speed,THREE.MathUtils.clamp(f,-1,1)*4.8,3.2,dt);if(Math.abs(f)<.04)speed=THREE.MathUtils.damp(speed,0,1.7,dt);const nx=boat.position.x+Math.sin(boat.rotation.y)*speed*dt,nz=boat.position.z+Math.cos(boat.rotation.y)*speed*dt,ex=(nx-LAKE.x)/(LAKE.rx-3.5),ez=(nz-LAKE.z)/(LAKE.rz-3);if(ex*ex+ez*ez<1){boat.position.x=nx;boat.position.z=nz;}else speed*=-.15;oars.forEach((o,i)=>o.rotation.x=Math.sin(clock*4.2+i*Math.PI)*.18*Math.min(1,Math.abs(speed)/2.4));wake.forEach(w=>w.material.opacity=.12+Math.min(.35,Math.abs(speed)*.06));TV.player.position.set(boat.position.x,boat.position.y+.62,boat.position.z);TV.player.rotation.y=boat.rotation.y;TV.playerVelocity.set(0,0,0);TV.state.jumpVelocity=0;TV.state.grounded=true;TV.state.seated=false;TV.state.cameraReady=false;});

  window.ToonValleyBluebellLake=Object.freeze({lake:{...LAKE},counts:{lakes:1,boats:1,reeds:reeds.length,lilyPads:lilyPads.length,dockPlanks:13},legacyPondMoved:Boolean(window.ToonValleyWorldPolish?.pondMoved),board,leave,fish,boat});
  console.info('Bluebell Lake ready',window.ToonValleyBluebellLake.counts);
})();
