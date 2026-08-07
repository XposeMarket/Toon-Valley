import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const server=spawn('python3',['-m','http.server','4174','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});const wait=(ms)=>new Promise(r=>setTimeout(r,ms));await wait(900);
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.goto('http://127.0.0.1:4174',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.ToonValleyCentralPlaza&&window.ToonValleyPublicInteriors&&window.ToonValleyTheater&&window.ToonValleyOwnedHome&&window.ToonValleyWorldPolish&&window.ToonValleyBluebellLake&&window.ToonValleyTransit&&window.ToonValleyLivingInteriors&&window.ToonValleyInteractionExperience&&window.ToonValleyCameraPolish&&window.ToonValleyServices,null,{timeout:30000});
 const state=await page.evaluate(()=>{
  const TV=window.ToonValley,LI=window.ToonValleyLivingInteriors,T=window.ToonValleyTransit,X=window.ToonValleyInteractionExperience,C=window.ToonValleyCameraPolish;
  const interiors={};for(const area of['cityHall','generalStore','library','cafe','furnitureStore','clinic','fireStation','postOffice','school','theater','home']){TV.enterInterior(area,{x:0,z:10});interiors[area]={visible:!!TV.interiorGroups[area]?.visible,blocked:TV.isBlocked(TV.player.position.x,TV.player.position.z)};TV.exitInterior();}
  TV.enterInterior('cafe',{x:-15,z:28});LI.sitAt('cafe',TV.areaBounds.cafe.cx,TV.areaBounds.cafe.cz+4.8,Math.PI,'cafe booth');const cafeSat=TV.state.seated;TV.standUpFromSeat(false);TV.exitInterior();
  TV.enterInterior('theater',{x:0,z:44});const theaterSeat=TV.interactables.find(i=>i.area==='theater'&&i.prompt==='Sit at theater seat');theaterSeat?.action?.();const movieEntered=X.movieView()&&!TV.player.visible&&TV.state.seated;TV.scene.onBeforeRender?.(TV.renderer,TV.scene,TV.camera);const movieCamera={fov:TV.camera.fov,zoom:TV.camera.zoom};document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const movieExited=!X.movieView()&&TV.player.visible&&!TV.state.seated;TV.exitInterior();
  const swing=TV.interactables.find(i=>i.prompt==='Play on the swings');swing?.action?.();const swingSat=TV.state.seated;TV.standUpFromSeat(false);
  T.waitAt(T.stops[0]);const busWaiting=TV.state.seated&&T.waiting;TV.standUpFromSeat(false);
  TV.setModalOpen(true);document.getElementById('pause-screen').classList.remove('hidden');document.dispatchEvent(new Event('pointerlockchange'));const pauseGuarded=document.getElementById('pause-screen').classList.contains('hidden');TV.setModalOpen(false);
  const onRoad=p=>TV.roadSegments.some(r=>{const dx=r.x2-r.x1,dz=r.z2-r.z1,len2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((p[0]-r.x1)*dx+(p[1]-r.z1)*dz)/len2)),x=r.x1+dx*t,z=r.z1+dz*t;return Math.hypot(p[0]-x,p[1]-z)<=r.width*.5+.75});
  const pets=TV.interactables.filter(i=>/^Pet |^Help .* get home$|Pet your companion/.test(i.prompt||'')&&i.object?.userData?.tvAnimalPolished&&i.object.children.length>10).length;
  const annex=window.ToonValleyServices.gardenAnnex||[];
  return{publicInteriors:window.ToonValleyPublicInteriors.counts,theater:window.ToonValleyTheater.counts,lake:window.ToonValleyBluebellLake.counts,world:window.ToonValleyWorldPolish,living:LI.counts,staff:LI.staffByArea,transit:T.counts,routeOnRoad:T.route.every(onRoad),cafeSat,movieEntered,movieExited,movieCamera,cameraPolish:C,swingSat,busWaiting,pauseGuarded,pets,annexSafe:annex.length===5&&annex.every(p=>p.x<=-128&&p.z>=58),interiors,interactables:TV.interactables.length};
 });
 if(state.publicInteriors.newInteriors!==4||state.publicInteriors.upgradedExisting!==5)throw new Error(`Public interiors missing ${JSON.stringify(state)}`);
 if(state.theater.films!==3||state.theater.seats!==28)throw new Error(`Theater incomplete ${JSON.stringify(state)}`);
 if(state.living.areas!==10||state.living.people<20||state.living.theaterSeats!==28||state.living.cafeSeats<8)throw new Error(`Living interiors incomplete ${JSON.stringify(state)}`);
 if(!state.staff.cafe?.includes('Ari')||!state.staff.theater?.includes('Wren'))throw new Error(`Interior staff missing ${JSON.stringify(state.staff)}`);
 if(!state.cafeSat||!state.movieEntered||!state.movieExited||!state.swingSat||!state.busWaiting)throw new Error(`Physical interaction regression ${JSON.stringify(state)}`);
 if(!state.cameraPolish?.touchLook||state.movieCamera.fov!==58||Math.abs(state.movieCamera.zoom-1.08)>.001)throw new Error(`Camera experience polish missing ${JSON.stringify(state)}`);
 if(!state.pauseGuarded)throw new Error(`Pause overlay still stacks over interaction modals ${JSON.stringify(state)}`);
 if(!state.world.legacyPondRemoved||state.world.roadsAdded<4||!state.annexSafe)throw new Error(`World placement polish missing ${JSON.stringify(state)}`);
 if(!state.routeOnRoad||state.transit.stops!==4)throw new Error(`Shuttle route leaves roads ${JSON.stringify(state)}`);
 if(state.lake.reeds<30||state.lake.lilyPads<8||state.lake.dockPlanks<10)throw new Error(`Lake polish incomplete ${JSON.stringify(state.lake)}`);
 if(state.pets<6)throw new Error(`Pet models were not upgraded ${JSON.stringify(state)}`);
 const bad=Object.entries(state.interiors).find(([,v])=>!v.visible||v.blocked);if(bad)throw new Error(`Interior traversal regression ${JSON.stringify(bad)}`);
 if(errors.length)throw new Error(errors.join('\n'));console.log('Toon Valley extension runtime checks passed',state);
}finally{await browser.close();server.kill('SIGTERM')}
