import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';
const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4198','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4198').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.ToonValleyBluebellMarshLife&&window.ToonValleyBluebellLake&&window.ToonValley?.player,null,{timeout:45000});
 await page.click('#play-button');await wait(150);
 const report=await page.evaluate(()=>{
  const S=window.ToonValleyBluebellMarshLife,TV=window.ToonValley,L=window.ToonValleyBluebellLake;
  const far=()=>TV.player.position.set(220,TV.terrainHeight(220,220),220);
  const stepUntil=(predicate,max=120,dt=.1)=>{for(let i=0;i<max;i++){S.advance(dt);const state=S.getState();if(predicate(state))return state}return S.getState()};
  far();for(let i=0;i<20;i++)S.advance(.1);const calm=S.getState();

  const frog=calm.frogs[0];TV.player.position.set(frog.x,frog.y,frog.z);
  const afterFrog=stepUntil(s=>s.frogJumps>calm.frogJumps&&s.frogs[0].rippleVisible,30,.08);
  far();const frogCycle=stepUntil(s=>s.frogReturns>calm.frogReturns&&s.frogs[0].state==='resting',120,.1);

  const turtle=frogCycle.turtles[0];TV.player.position.set(turtle.x,turtle.y,turtle.z);
  const afterTurtle=stepUntil(s=>s.turtleDives>frogCycle.turtleDives&&['diving','swimming'].includes(s.turtles[0].state),30,.08);
  far();const turtleCycle=stepUntil(s=>s.turtleReturnTurns>frogCycle.turtleReturnTurns&&s.turtles[0].state==='basking',160,.1);

  const minnow=turtleCycle.minnows[0];TV.player.position.set(minnow.x,minnow.y,minnow.z);
  const afterMinnow=stepUntil(s=>s.minnowScatters>turtleCycle.minnowScatters&&s.minnows.some(m=>m.scatter>0&&m.cause==='player'),20,.08);
  far();for(let i=0;i<60;i++)S.advance(.1);const settled=S.getState();
  const root=TV.scene.getObjectByName('bluebell-marsh-life');
  return {flags:{active:S.active,turtles:S.baskingTurtles,dive:S.physicalDiveAndReturn,minnows:S.reactiveMinnowSchool,isolated:S.isolatedFromFishing,budget:S.lowPopulationBudget,paddling:S.visibleTurtlePaddling,returnFacing:S.correctedReturnFacing,schooling:S.coordinatedMovingSchool,bounded:S.boundedMinnowEscape,noSnap:S.noReturnSnap,frogs:S.lilyPadFrogLifecycle,ripples:S.visibleFrogRipples,ecosystem:S.ecosystemDisturbanceReactions},lake:L.lake,calm,afterFrog,frogCycle,afterTurtle,turtleCycle,afterMinnow,settled,root:Boolean(root),children:root?.children.length||0};
 });
 const fail=m=>{throw new Error(m)};
 if(!Object.values(report.flags).every(Boolean))fail(`Capability flags missing ${JSON.stringify(report.flags)}`);
 if(!report.root||report.children!==20||report.calm.turtleCount!==2||report.calm.minnowCount!==7||report.calm.frogCount!==3)fail(`Population failed ${JSON.stringify(report)}`);
 if(report.afterFrog.frogJumps<=report.calm.frogJumps||!report.afterFrog.frogs[0].rippleVisible||report.afterFrog.frogs[0].rippleScale<=1)fail(`Frog jump/ripple missing ${JSON.stringify(report.afterFrog.frogs[0])}`);
 if(report.afterFrog.ecosystemScatters<=report.calm.ecosystemScatters||!report.afterFrog.minnows.some(m=>m.cause==='frog-jump'))fail(`Frog did not disturb nearby minnows ${JSON.stringify(report.afterFrog.minnows)}`);
 if(report.frogCycle.frogReturns<=report.calm.frogReturns||report.frogCycle.frogs[0].state!=='resting')fail(`Frog lifecycle incomplete ${JSON.stringify(report.frogCycle.frogs[0])}`);
 if(report.afterTurtle.turtleDives<=report.frogCycle.turtleDives||Math.abs(report.afterTurtle.turtles[0].paddleAngle)<.03)fail(`Turtle dive/paddling missing ${JSON.stringify(report.afterTurtle.turtles[0])}`);
 if(report.turtleCycle.turtles[0].state!=='basking'||report.turtleCycle.turtleReturnTurns<=report.frogCycle.turtleReturnTurns)fail(`Turtle return incomplete ${JSON.stringify(report.turtleCycle.turtles[0])}`);
 if(report.afterMinnow.minnowScatters<=report.turtleCycle.minnowScatters||!report.afterMinnow.minnows.some(m=>m.scatter>0&&m.cause==='player'))fail(`Player minnow scatter missing ${JSON.stringify(report.afterMinnow)}`);
 const centerTravel=Math.hypot(report.settled.schoolCenter.x-report.calm.schoolCenter.x,report.settled.schoolCenter.z-report.calm.schoolCenter.z);if(centerTravel<.12)fail(`School center did not travel ${centerTravel}`);
 if(!report.settled.minnows.some(m=>Math.abs(m.tailZ)>.05)||!report.settled.minnows.every(m=>Number.isFinite(m.turnRate)))fail('Minnow coordinated motion missing');
 const l=report.lake;
 if(report.settled.turtles.some(t=>!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z)||!Number.isFinite(t.rotationY)||Math.abs(t.x-l.x)>l.rx*1.1||Math.abs(t.z-l.z)>l.rz*1.1))fail(`Turtle left lake bounds ${JSON.stringify(report.settled.turtles)}`);
 if(report.settled.minnows.some(m=>!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(m.z)||m.y<0||Math.hypot((m.x-l.x)/(l.rx*.82),(m.z-l.z)/(l.rz*.82))>1))fail(`Minnow left safe lake bounds ${JSON.stringify(report.settled.minnows)}`);
 if(report.settled.frogs.some(f=>!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.z)||Math.hypot((f.x-l.x)/(l.rx*.75),(f.z-l.z)/(l.rz*.75))>1))fail(`Frog left safe lake bounds ${JSON.stringify(report.settled.frogs)}`);
 if(errors.length)fail(errors.join('\n'));
 console.log('Bluebell marsh turtle, frog, and minnow ecosystem runtime passed');
}finally{await browser.close();if(server)server.kill('SIGTERM')}
