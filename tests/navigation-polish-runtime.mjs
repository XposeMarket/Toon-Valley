import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4179','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4179').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
// WebAudio output is irrelevant to this UI test and can stall SwiftShader/headless
// runners. Product audio remains untouched; only CI gets a no-audio browser.
await page.addInitScript(()=>{try{Object.defineProperty(window,'AudioContext',{value:undefined,writable:true,configurable:true});Object.defineProperty(window,'webkitAudioContext',{value:undefined,writable:true,configurable:true});}catch{}});
try{
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.ToonValleyNavigationPolish&&window.ToonValleyTransit&&window.ToonValleyCommunityLife&&window.ToonValleyBluebellLake&&window.ToonValleyTownActivities&&window.ToonValleyUILayerFix,null,{timeout:45000});
 await page.click('#play-button');await wait(120);
 const state=await page.evaluate(()=>{
  const TV=window.ToonValley,T=window.ToonValleyTransit,C=window.ToonValleyCommunityLife,N=window.ToonValleyNavigationPolish,L=window.ToonValleyBluebellLake,A=window.ToonValleyTownActivities,U=window.ToonValleyUILayerFix;
  const stop=T.stops.reduce((best,s)=>Math.hypot(T.bus.position.x-s.routeX,T.bus.position.z-s.routeZ)>Math.hypot(T.bus.position.x-best.routeX,T.bus.position.z-best.routeZ)?s:best,T.stops[0]);
  T.waitAt(stop);const busSeat={seated:TV.state.seated,rotation:TV.player.rotation.y,expected:stop.angle,label:TV.state.seat?.userData?.label};TV.standUpFromSeat(false);
  TV.enterInterior('school',{x:0,z:0});const names=new Set(['Ms. Maple','Cleo','Milo','Nora','Jasper']);const people=[...TV.interiorGroups.school.children].filter(o=>names.has(o.userData?.name)).map(o=>({name:o.userData.name,rotation:o.rotation.y}));const seat=TV.interactables.find(i=>i.area==='school'&&i.prompt==='Sit at student chair');seat?.action?.();const schoolSeat={seated:TV.state.seated,rotation:TV.player.rotation.y};TV.standUpFromSeat(false);TV.exitInterior();
  L.board();L.fish();const boatFishing={fx:L.fishingFX,casting:L.casting};L.leave();
  return{busSeat,dwell:T.stopDwellSeconds,classroom:N.classroom,wayfinding:N.wayfinding,people,schoolSeat,trail:C.counts,trailMaxRadius:C.trailMaxRadius,worldRadius:TV.CONFIG.worldRadius,trailStart:C.trailPath[0],shoreFishing:A.fishingFX,spots:A.fishingSpots,boatFishing,dock:!!document.getElementById('tv-desktop-dock'),shortcuts:U.desktopShortcuts};
 });
 if(!state.busSeat.seated||state.busSeat.label!=='shuttle bench'||Math.abs(state.busSeat.rotation-state.busSeat.expected)>.01)throw new Error(`Bus stop facing wrong ${JSON.stringify(state.busSeat)}`);
 if(state.dwell<4.5)throw new Error(`Shuttle dwell too short ${state.dwell}`);
 if(state.classroom.physicalChairs<12||state.classroom.peopleFacingBoard<5||state.classroom.seatActions<13)throw new Error(`Classroom orientation incomplete ${JSON.stringify(state.classroom)}`);
 if(state.people.some(p=>Math.abs(Math.abs(p.rotation)-Math.PI)>.01)||!state.schoolSeat.seated||Math.abs(Math.abs(state.schoolSeat.rotation)-Math.PI)>.01)throw new Error(`School still faces away from board ${JSON.stringify({people:state.people,seat:state.schoolSeat})}`);
 if(state.trail.trailTiles<40||state.trailMaxRadius>=state.worldRadius-4||state.trailStart[0]!==-100||state.trailStart[1]!==34)throw new Error(`Trail still hidden/unreachable ${JSON.stringify(state)}`);
 if(state.wayfinding.beacons<2||state.wayfinding.signs<2)throw new Error(`Wayfinding missing ${JSON.stringify(state.wayfinding)}`);
 if(state.shoreFishing!=='curved-line-and-bobber'||state.spots.some(p=>Math.hypot(p.x-112,p.z+82)>42))throw new Error(`Shore fishing placement/FX wrong ${JSON.stringify(state.spots)}`);
 if(state.boatFishing.fx!=='rod-curved-line-bobber'||!state.boatFishing.casting)throw new Error(`Boat fishing cast missing ${JSON.stringify(state.boatFishing)}`);
 if(!state.dock||state.shortcuts.phone!=='P'||state.shortcuts.tasks!=='T'||state.shortcuts.inventory!=='I')throw new Error(`Desktop life controls missing ${JSON.stringify(state)}`);
 await page.keyboard.press('t');
 await page.waitForSelector('.life-overlay',{state:'visible',timeout:8000});
 const modal=await page.evaluate(()=>({modal:window.ToonValley.state.modalOpen,pointer:!!document.pointerLockElement,pauseHidden:document.getElementById('pause-screen')?.classList.contains('hidden'),title:document.querySelector('.life-window h2')?.textContent||'',tasks:document.querySelector('.life-tab.active')?.textContent||''}));
 if(!modal.modal||modal.pointer||!modal.pauseHidden||!modal.title.includes('ToonPhone')||!modal.tasks.includes('Tasks'))throw new Error(`Desktop tasks modal did not unlock mouse ${JSON.stringify(modal)}`);
 if(errors.length)throw new Error(errors.join('\n'));console.log('Navigation/fishing/desktop UI checks passed',state,modal);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
