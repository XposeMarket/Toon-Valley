import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4199','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4199').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyBluebellWildlifeSocial&&window.ToonValleyBluebellWildlife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const S=window.ToonValleyBluebellWildlifeSocial,W=window.ToonValleyBluebellWildlife,TV=window.ToonValley;
    const root=TV.scene.getObjectByName('bluebell-wildlife');
    TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<18;i++)W.advance(.1);
    const adult=root?.getObjectByName('bluebell-duck-1'),duck2=root?.getObjectByName('bluebell-duck-2'),duck3=root?.getObjectByName('bluebell-duck-3');
    TV.player.position.set(adult.position.x+6.1,adult.position.y,adult.position.z);for(let i=0;i<16;i++)S.advance(.1);const shelterState=S.getState();
    if(duck2&&duck3){duck3.position.x=duck2.position.x;duck3.position.z=duck2.position.z}for(let i=0;i<10;i++)S.advance(.1);
    const spacingState=S.getState(),ducklingDistance=duck2&&duck3?Math.hypot(duck3.position.x-duck2.position.x,duck3.position.z-duck2.position.z):0;
    TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<12;i++)S.advance(.1);const rejoinState=S.getState();
    for(let i=0;i<24&&W.getState().dragonflies.filter(d=>d.perch<=0&&d.dodge<=0).length<2;i++)W.advance(.1);
    const active=[];W.getState().dragonflies.forEach((d,index)=>{if(d.perch<=0&&d.dodge<=0)active.push(index)});
    const first=active[0],second=active[1],dragonA=Number.isInteger(first)?root?.getObjectByName(`bluebell-dragonfly-${first+1}`):null,dragonB=Number.isInteger(second)?root?.getObjectByName(`bluebell-dragonfly-${second+1}`):null;
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    if(dragonA){dragonA.position.x=224.8;dragonA.position.z=220;dragonA.position.y=TV.terrainHeight(224.8,220)+1.3}
    if(dragonB){dragonB.position.x=215.1;dragonB.position.z=220;dragonB.position.y=TV.terrainHeight(215.1,220)+1.45}
    const dragonBefore=[dragonA,dragonB].map(d=>d?{x:d.position.x,y:d.position.y,z:d.position.z}:null);for(let i=0;i<30;i++)S.advance(.1);
    const dragonAfter=[dragonA,dragonB].map(d=>d?{x:d.position.x,y:d.position.y,z:d.position.z}:null),final=S.getState();
    const pairDistance=dragonA&&dragonB?Math.hypot(dragonA.position.x-dragonB.position.x,dragonA.position.z-dragonB.position.z):0;
    return {flags:{active:S.active,shelter:S.ducklingShelterFormation,rejoin:S.ducklingRejoinContinuity,spacing:S.ducklingPersonalSpace,inspect:S.playerInspectionHover,relay:S.dragonflyInspectionRelay,orbit:S.coordinatedInspectionOrbit,pop:S.existingPopulationOnly,low:S.lowAllocationBehavior},shelterState,spacingState,ducklingDistance,rejoinState,dragonBefore,dragonAfter,pairDistance,final};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell social capability flags missing ${JSON.stringify(report.flags)}`);
  if(report.shelterState.shelterCorrections<2||report.shelterState.shelteredDucklingCount<2)throw new Error(`Duckling shelter regression ${JSON.stringify(report.shelterState)}`);
  if(report.spacingState.spacingCorrections<1||report.spacingState.spacingPeakShift<=.001||report.ducklingDistance<=.05)throw new Error(`Duckling spacing regression ${JSON.stringify(report)}`);
  if(report.rejoinState.rejoinCorrections<1||report.rejoinState.rejoinedDucklingCount<1)throw new Error(`Duckling rejoin regression ${JSON.stringify(report.rejoinState)}`);
  if(!report.dragonBefore[0]||!report.dragonBefore[1]||!report.dragonAfter[0]||!report.dragonAfter[1])throw new Error(`Could not prepare dragonfly pair ${JSON.stringify(report)}`);
  if(report.final.inspectionCorrections<2||report.final.relayCorrections<2||report.final.orbitCorrections<4||report.final.orbitPairSeparation<2||report.pairDistance<2)throw new Error(`Dragonfly coordinated orbit regression ${JSON.stringify(report.final)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell family spacing and coordinated inspection orbit passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
