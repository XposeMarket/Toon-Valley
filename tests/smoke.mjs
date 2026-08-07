import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL=process.env.BASE_URL?.replace(/\/$/,'');
const server=remoteURL?null:spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));if(server)await wait(900);
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}});page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
const errors=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.stack||e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
try{
  await page.goto(remoteURL||'http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ToonValley&&window.ToonValleyLife,null,{timeout:30000});
  const initial=await page.evaluate(()=>window.ToonValleyLife.getState());if(initial.version!==4)throw new Error(`Unexpected save version ${initial.version}`);if(initial.player.money<1)throw new Error('Player economy did not initialize');
  await page.click('#play-button');await page.waitForFunction(()=>window.ToonValley.state.started);
  const core=await page.evaluate(()=>{const TV=window.ToonValley;TV.state.modalOpen=true;TV.player.position.set(0,TV.terrainHeight(0,10),10);TV.state.area='world';TV.state.grounded=true;TV.state.jumpVelocity=0;document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));const queuedJump=TV.state.jumpQueued;TV.updatePlayer(.016);const jumped=!TV.state.grounded&&TV.state.jumpVelocity>0;TV.setMobileSprint(true);TV.state.mobileMoveY=1;TV.playerVelocity.set(0,0,0);TV.updatePlayer(.2);const sprintSpeed=Math.hypot(TV.playerVelocity.x,TV.playerVelocity.z);TV.setMobileSprint(false);TV.state.mobileMoveY=0;TV.sitOnBench(TV.benchSeats[0]);const seated=TV.state.seated,stood=TV.standUpFromSeat(false),overlaps=[];for(const building of TV.townBuildings){const bx1=building.x-building.halfW,bx2=building.x+building.halfW,bz1=building.z-building.halfD,bz2=building.z+building.halfD;for(const road of TV.roadSegments){const horizontal=Math.abs(road.z1-road.z2)<.001,vertical=Math.abs(road.x1-road.x2)<.001;if(!horizontal&&!vertical)continue;const rx1=Math.min(road.x1,road.x2)-(vertical?road.width*.5:0),rx2=Math.max(road.x1,road.x2)+(vertical?road.width*.5:0),rz1=Math.min(road.z1,road.z2)-(horizontal?road.width*.5:0),rz2=Math.max(road.z1,road.z2)+(horizontal?road.width*.5:0);if(bx1<rx2&&bx2>rx1&&bz1<rz2&&bz2>rz1)overlaps.push({building:building.label})}}TV.state.modalOpen=false;return{queuedJump,jumped,sprintSpeed,seated,stood,overlaps};});
  if(!core.queuedJump||!core.jumped)throw new Error(`Jump input regression ${JSON.stringify(core)}`);if(core.sprintSpeed<5.2)throw new Error(`Sprint regression ${JSON.stringify(core)}`);if(!core.seated||!core.stood)throw new Error(`Bench sitting regression ${JSON.stringify(core)}`);if(core.overlaps.length)throw new Error(`Building/road overlap ${JSON.stringify(core.overlaps)}`);
  const interior=await page.evaluate(()=>{const TV=window.ToonValley;TV.enterInterior('generalStore',{x:26,z:-18});const entered={x:TV.player.position.x,z:TV.player.position.z,blocked:TV.isBlocked(TV.player.position.x,TV.player.position.z)};const canMove=[[-.5,0],[.5,0],[0,-.5],[0,.5]].some(([dx,dz])=>!TV.isBlocked(entered.x+dx,entered.z+dz));TV.exitInterior();return{entered,canMove,exited:TV.state.area==='world'};});
  if(interior.entered.blocked||!interior.canMove||!interior.exited)throw new Error(`Interior traversal regression ${JSON.stringify(interior)}`);
  await page.evaluate(async()=>{window.ToonValleyLife.addMoney(77);await window.ToonValleyLife.saveGame('smoke-persistence')});const expected=await page.evaluate(()=>window.ToonValleyLife.getState().player.money);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(m=>window.ToonValleyLife&&window.ToonValleyLife.getState().player.money===m,expected,{timeout:30000});
  if(errors.length)throw new Error(errors.join('\n'));console.log(`Toon Valley browser smoke passed: ${remoteURL||'localhost'}`,{core,interior,money:expected});
}finally{await browser.close();server?.kill('SIGTERM')}
