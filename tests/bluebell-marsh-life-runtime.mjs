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
  TV.player.position.set(220,TV.terrainHeight(220,220),220);
  for(let i=0;i<15;i++)S.advance(.2);
  const calm=S.getState();

  const frog=calm.frogs[0];TV.player.position.set(frog.x,frog.y,frog.z);S.advance(.1);for(let i=0;i<6;i++)S.advance(.12);const afterFrog=S.getState();
  TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<34;i++)S.advance(.2);const frogCycle=S.getState();

  const turtle=frogCycle.turtles[0];TV.player.position.set(turtle.x,turtle.y,turtle.z);S.advance(.1);for(let i=0;i<4;i++)S.advance(.12);const afterTurtle=S.getState();
  TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<44;i++)S.advance(.2);const turtleCycle=S.getState();

  const minnow=turtleCycle.minnows[0];TV.player.position.set(minnow.x,minnow.y,minnow.z);S.advance(.1);const afterMinnow=S.getState();
  TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<30;i++)S.advance(.2);const settled=S.getState();
  const root=TV.scene.getObjectByName('bluebell-marsh-life');
  return {flags:{active:S.active,turtles:S.baskingTurtles,dive:S.physicalDiveAndReturn,minnows:S.reactiveMinnowSchool,isolated:S.isolatedFromFishing,budget:S.lowPopulationBudget,paddling:S.visibleTurtlePaddling,returnFacing:S.correctedReturnFacing,schooling:S.coordinatedMovingSchool,bounded:S.boundedMinnowEscape,noSnap:S.noReturnSnap,frogs:S.lilyPadFrogLifecycle,ripples:S.visibleFrogRipples,ecosystem:S.ecosystemDisturbanceReactions},lake:L.lake,calm,afterFrog,frogCycle,afterTurtle,turtleCycle,afterMinnow,settled,root:Boolean(root),children:root?.children.length||0};
 });
 if(!Object.values(report.flags).every(Boolean))throw new Error(`Capability flags missing ${JSON.stringify(report.flags)}`);
 if(!report.root||report.children!==20||report.calm.turtleCount!==2||report.calm.minnowCount!==7||report.calm.frogCount!==3)throw new Error(`Population failed ${JSON.stringify(report)}`);
 if(report.afterFrog.frogJumps<=report.calm.frogJumps||!['jumping','swimming'].includes(report.afterFrog.frogs[0].state))throw new Error(`Frog did not physically jump ${JSON.stringify({before:report.calm.frogs[0],after:report.afterFrog.frogs[0]})}`);
 if(!report.afterFrog.frogs[0].rippleVisible||report.afterFrog.frogs[0].rippleScale<=1)throw new Error(`Frog landing ripple missing ${JSON.stringify(report.afterFrog.frogs[0])}`);
 if(report.afterFrog.ecosystemScatters<=report.calm.ecosystemScatters||!report.afterFrog.minnows.some(m=>m.cause==='frog-jump'))throw new Error(`Frog did not disturb nearby minnow school ${JSON.stringify(report.afterFrog.minnows)}`);
 if(report.frogCycle.frogReturns<=report.calm.frogReturns||report.frogCycle.frogs[0].state!=='resting')throw new Error(`Frog did not complete jump/swim/return lifecycle ${JSON.stringify(report.frogCycle.frogs[0])}`);
 if(report.afterTurtle.turtleDives<=report.frogCycle.turtleDives||!['diving','swimming'].includes(report.afterTurtle.turtles[0].state))throw new Error(`Turtle did not dive ${JSON.stringify({before:report.frogCycle.turtles[0],after:report.afterTurtle.turtles[0]})}`);
 if(Math.abs(report.afterTurtle.turtles[0].paddleAngle)<.05)throw new Error(`Turtle paddling was not visible ${JSON.stringify(report.afterTurtle.turtles[0])}`);
 if(report.turtleCycle.turtles[0].state!=='basking'||report.turtleCycle.turtleReturnTurns<=report.frogCycle.turtleReturnTurns)throw new Error(`Turtle did not complete faced swim/return cycle ${JSON.stringify(report.turtleCycle.turtles[0])}`);
 if(report.turtleCycle.turtleReturnSnapsPrevented<=report.frogCycle.turtleReturnSnapsPrevented)throw new Error(`Turtle return did not exercise no-snap convergence ${JSON.stringify({before:report.frogCycle.turtleReturnSnapsPrevented,after:report.turtleCycle.turtleReturnSnapsPrevented})}`);
 if(report.afterMinnow.minnowScatters<=report.turtleCycle.minnowScatters||!report.afterMinnow.minnows.some(m=>m.scatter>0&&m.cause==='player'))throw new Error(`Minnow school did not scatter from player ${JSON.stringify(report.afterMinnow)}`);
 const centerTravel=Math.hypot(report.settled.schoolCenter.x-report.calm.schoolCenter.x,report.settled.schoolCenter.z-report.calm.schoolCenter.z);
 if(centerTravel<.12)throw new Error(`Minnow school center did not travel ${JSON.stringify({calm:report.calm.schoolCenter,settled:report.settled.schoolCenter})}`);
 if(!report.settled.minnows.some(m=>Math.abs(m.tailZ)>.05)||!report.settled.minnows.every(m=>Number.isFinite(m.turnRate)))throw new Error(`Coordinated minnow motion missing ${JSON.stringify(report.settled.minnows)}`);
 const l=report.lake;
 if(report.settled.turtles.some(t=>!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z)||!Number.isFinite(t.rotationY)||Math.abs(t.x-l.x)>l.rx*1.1||Math.abs(t.z-l.z)>l.rz*1.1))throw new Error(`Turtle left lake bounds ${JSON.stringify(report.settled.turtles)}`);
 if(report.settled.minnows.some(m=>!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(m.z)||m.y<0||Math.hypot((m.x-l.x)/(l.rx*.82),(m.z-l.z)/(l.rz*.82))>1))throw new Error(`Minnow state escaped safe lake bounds ${JSON.stringify(report.settled.minnows)}`);
 if(report.settled.frogs.some(f=>!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.z)||Math.hypot((f.x-l.x)/(l.rx*.75),(f.z-l.z)/(l.rz*.75))>1))throw new Error(`Frog left safe lake bounds ${JSON.stringify(report.settled.frogs)}`);
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Bluebell marsh turtle, frog, and minnow ecosystem runtime passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
