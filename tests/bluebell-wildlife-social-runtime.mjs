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
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<18;i++)W.advance(.1);
    const adult=root?.getObjectByName('bluebell-duck-1');
    const duck2=root?.getObjectByName('bluebell-duck-2');
    const duck3=root?.getObjectByName('bluebell-duck-3');
    const beforeShelter=[duck2,duck3].map(d=>d?{x:d.position.x,z:d.position.z}:null);
    TV.player.position.set(adult.position.x+6.1,adult.position.y,adult.position.z);
    for(let i=0;i<16;i++)S.advance(.1);
    const afterShelter=[duck2,duck3].map(d=>d?{x:d.position.x,z:d.position.z}:null);
    const shelterState=S.getState();

    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<8;i++)W.advance(.1);
    const states=W.getState().dragonflies;
    let idx=states.findIndex(d=>d.perch<=0&&d.dodge<=0);
    if(idx<0){for(let i=0;i<20;i++)W.advance(.1);idx=W.getState().dragonflies.findIndex(d=>d.perch<=0&&d.dodge<=0)}
    const dragon=idx>=0?root?.getObjectByName(`bluebell-dragonfly-${idx+1}`):null;
    const dragonBefore=dragon?{x:dragon.position.x,y:dragon.position.y,z:dragon.position.z,yaw:dragon.rotation.y}:null;
    if(dragon)TV.player.position.set(dragon.position.x+4.7,dragon.position.y,dragon.position.z);
    for(let i=0;i<20;i++)S.advance(.1);
    const dragonAfter=dragon?{x:dragon.position.x,y:dragon.position.y,z:dragon.position.z,yaw:dragon.rotation.y}:null;
    const final=S.getState();
    return {flags:{active:S.active,shelter:S.ducklingShelterFormation,inspect:S.playerInspectionHover,pop:S.existingPopulationOnly,low:S.lowAllocationBehavior},beforeShelter,afterShelter,shelterState,dragonBefore,dragonAfter,final};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell social capability flags missing ${JSON.stringify(report.flags)}`);
  if(report.shelterState.shelterCorrections<2||report.shelterState.shelteredDucklingCount<2||report.shelterState.shelterPeakShift<=.001)throw new Error(`Ducklings did not physically tuck behind the adult during player watchfulness ${JSON.stringify(report.shelterState)}`);
  if(!report.dragonBefore||!report.dragonAfter||report.final.inspectionCorrections<2||report.final.inspectionResponses<2||report.final.inspectedDragonflyCount<1||report.final.inspectionTurns<1)throw new Error(`Dragonfly did not perform a visible player inspection hover ${JSON.stringify(report)}`);
  const dragonShift=Math.hypot(report.dragonAfter.x-report.dragonBefore.x,report.dragonAfter.z-report.dragonBefore.z);
  if(dragonShift<.03&&Math.abs(report.dragonAfter.y-report.dragonBefore.y)<.02)throw new Error(`Dragonfly inspection hover produced no meaningful physical movement ${JSON.stringify({before:report.dragonBefore,after:report.dragonAfter,final:report.final})}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell duckling shelter formation and dragonfly player inspection hover passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
