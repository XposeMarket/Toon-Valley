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
  const turtle=calm.turtles[0];TV.player.position.set(turtle.x,turtle.y,turtle.z);S.advance(.1);for(let i=0;i<4;i++)S.advance(.12);const afterTurtle=S.getState();
  TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<38;i++)S.advance(.2);const turtleCycle=S.getState();
  const minnow=turtleCycle.minnows[0];TV.player.position.set(minnow.x,minnow.y,minnow.z);S.advance(.1);const afterMinnow=S.getState();
  TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<30;i++)S.advance(.2);const settled=S.getState();
  const root=TV.scene.getObjectByName('bluebell-marsh-life');
  return {flags:{active:S.active,turtles:S.baskingTurtles,dive:S.physicalDiveAndReturn,minnows:S.reactiveMinnowSchool,isolated:S.isolatedFromFishing,budget:S.lowPopulationBudget,paddling:S.visibleTurtlePaddling,returnFacing:S.correctedReturnFacing,schooling:S.coordinatedMovingSchool,bounded:S.boundedMinnowEscape},lake:L.lake,calm,afterTurtle,turtleCycle,afterMinnow,settled,root:Boolean(root),children:root?.children.length||0};
 });
 if(!Object.values(report.flags).every(Boolean))throw new Error(`Capability flags missing ${JSON.stringify(report.flags)}`);
 if(!report.root||report.children!==11||report.calm.turtleCount!==2||report.calm.minnowCount!==7)throw new Error(`Population failed ${JSON.stringify(report)}`);
 if(report.afterTurtle.turtleDives<=report.calm.turtleDives||!['diving','swimming'].includes(report.afterTurtle.turtles[0].state))throw new Error(`Turtle did not dive ${JSON.stringify({before:report.calm.turtles[0],after:report.afterTurtle.turtles[0]})}`);
 if(Math.abs(report.afterTurtle.turtles[0].paddleAngle)<.05)throw new Error(`Turtle paddling was not visible ${JSON.stringify(report.afterTurtle.turtles[0])}`);
 if(report.turtleCycle.turtles[0].state!=='basking'||report.turtleCycle.turtleReturnTurns<=report.calm.turtleReturnTurns)throw new Error(`Turtle did not complete faced swim/return cycle ${JSON.stringify(report.turtleCycle.turtles[0])}`);
 if(report.afterMinnow.minnowScatters<=report.turtleCycle.minnowScatters||!report.afterMinnow.minnows.some(m=>m.scatter>0))throw new Error(`Minnow school did not scatter ${JSON.stringify(report.afterMinnow)}`);
 const centerTravel=Math.hypot(report.settled.schoolCenter.x-report.calm.schoolCenter.x,report.settled.schoolCenter.z-report.calm.schoolCenter.z);
 if(centerTravel<.12)throw new Error(`Minnow school center did not travel ${JSON.stringify({calm:report.calm.schoolCenter,settled:report.settled.schoolCenter})}`);
 if(!report.settled.minnows.some(m=>Math.abs(m.tailZ)>.05)||!report.settled.minnows.every(m=>Number.isFinite(m.turnRate)))throw new Error(`Coordinated minnow motion missing ${JSON.stringify(report.settled.minnows)}`);
 const l=report.lake;
 if(report.settled.turtles.some(t=>!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.z)||!Number.isFinite(t.rotationY)||Math.abs(t.x-l.x)>l.rx*1.1||Math.abs(t.z-l.z)>l.rz*1.1))throw new Error(`Turtle left lake bounds ${JSON.stringify(report.settled.turtles)}`);
 if(report.settled.minnows.some(m=>!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(m.z)||m.y<0||Math.hypot((m.x-l.x)/(l.rx*.82),(m.z-l.z)/(l.rz*.82))>1))throw new Error(`Minnow state escaped safe lake bounds ${JSON.stringify(report.settled.minnows)}`);
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Bluebell marsh turtle and minnow runtime passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
