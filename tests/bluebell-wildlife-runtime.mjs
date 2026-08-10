import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4196','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4196').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyBluebellWildlife&&window.ToonValleyBluebellLake&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const W=window.ToonValleyBluebellWildlife,TV=window.ToonValley,L=window.ToonValleyBluebellLake;
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    const before=W.getState();
    for(let i=0;i<50;i++)W.advance(.2);
    const afterCruise=W.getState();
    const duck=afterCruise.ducks[0];
    TV.player.position.set(duck.x,duck.y,duck.z);
    W.advance(.1);
    const afterDuckEscape=W.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<20;i++)W.advance(.15);
    const calm=W.getState();
    const dragon=calm.dragonflies[0];
    TV.player.position.set(dragon.x,dragon.y,dragon.z);
    W.advance(.1);
    const afterDragonDodge=W.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<50;i++)W.advance(.2);
    const afterOrbit=W.getState();
    const root=TV.scene.getObjectByName('bluebell-wildlife');
    return {flags:{active:W.active,ducks:W.swimmingDuckFamily,wakes:W.reactiveWakeEffects,dragons:W.shorelineDragonflies,reactive:W.playerReactiveWildlife,budget:W.lowPopulationBudget},lake:L.lake,before,afterCruise,afterDuckEscape,calm,afterDragonDodge,afterOrbit,rootPresent:Boolean(root),childCount:root?.children.length||0};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell wildlife capability flags missing ${JSON.stringify(report.flags)}`);
  if(!report.rootPresent||report.childCount!==7||report.before.duckCount!==3||report.before.dragonflyCount!==4)throw new Error(`Bluebell wildlife population did not initialize ${JSON.stringify(report)}`);
  const duckMoved=report.afterCruise.ducks.some((d,i)=>Math.hypot(d.x-report.before.ducks[i].x,d.z-report.before.ducks[i].z)>.3);
  if(!duckMoved)throw new Error(`Bluebell ducks did not swim ${JSON.stringify({before:report.before.ducks,after:report.afterCruise.ducks})}`);
  if(report.afterDuckEscape.duckEscapes<=report.afterCruise.duckEscapes||!report.afterDuckEscape.ducks.some((d,i)=>d.escapeCount>report.afterCruise.ducks[i].escapeCount&&d.escape>0))throw new Error(`Duck family did not react to nearby player/boat position ${JSON.stringify({before:report.afterCruise,after:report.afterDuckEscape})}`);
  const lake=report.lake;
  if(report.afterOrbit.ducks.some(d=>!Number.isFinite(d.x)||!Number.isFinite(d.y)||!Number.isFinite(d.z)||Math.abs(d.x-lake.x)>lake.rx||Math.abs(d.z-lake.z)>lake.rz))throw new Error(`Duck left playable lake bounds or became invalid ${JSON.stringify(report.afterOrbit.ducks)}`);
  if(report.afterDragonDodge.dragonflyDodges<=report.calm.dragonflyDodges||!report.afterDragonDodge.dragonflies.some((d,i)=>d.dodgeCount>report.calm.dragonflies[i].dodgeCount&&d.dodge>0))throw new Error(`Shoreline dragonfly did not dodge nearby player ${JSON.stringify({before:report.calm,after:report.afterDragonDodge})}`);
  const dragonMoved=report.afterOrbit.dragonflies.some((d,i)=>Math.hypot(d.x-report.afterDragonDodge.dragonflies[i].x,d.z-report.afterDragonDodge.dragonflies[i].z)>.2||d.orbitCount>report.afterDragonDodge.dragonflies[i].orbitCount);
  if(!dragonMoved)throw new Error(`Dragonflies did not continue shoreline patrol ${JSON.stringify({before:report.afterDragonDodge.dragonflies,after:report.afterOrbit.dragonflies})}`);
  if(report.afterOrbit.dragonflies.some(d=>!Number.isFinite(d.x)||!Number.isFinite(d.y)||!Number.isFinite(d.z)||d.y<0))throw new Error(`Dragonfly terrain state became invalid ${JSON.stringify(report.afterOrbit.dragonflies)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell duck family and shoreline dragonflies passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
