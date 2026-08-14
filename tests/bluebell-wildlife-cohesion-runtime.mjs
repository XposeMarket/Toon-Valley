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
  await page.waitForFunction(()=>window.ToonValleyBluebellWildlifeCohesion&&window.ToonValleyBluebellWildlife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const C=window.ToonValleyBluebellWildlifeCohesion,W=window.ToonValleyBluebellWildlife,TV=window.ToonValley;
    const root=TV.scene.getObjectByName('bluebell-wildlife');
    TV.player.position.set(220,TV.terrainHeight(220,220),220);for(let i=0;i<24;i++)W.advance(.1);
    const adult=root?.getObjectByName('bluebell-duck-1'),duck2=root?.getObjectByName('bluebell-duck-2'),duck3=root?.getObjectByName('bluebell-duck-3');
    TV.player.position.set(adult.position.x+20,adult.position.y,adult.position.z+20);
    if(duck2){duck2.position.x=adult.position.x+5.2;duck2.position.z=adult.position.z+4.8}
    if(duck3&&duck2){duck3.position.x=duck2.position.x;duck3.position.z=duck2.position.z}
    const beforeCohesion=duck2?Math.hypot(duck2.position.x-adult.position.x,duck2.position.z-adult.position.z):0;
    for(let i=0;i<36;i++)C.advance(.1);
    const afterCohesion=duck2?Math.hypot(duck2.position.x-adult.position.x,duck2.position.z-adult.position.z):0;
    const ducklingDistance=duck2&&duck3?Math.hypot(duck3.position.x-duck2.position.x,duck3.position.z-duck2.position.z):0;

    for(let i=0;i<36&&W.getState().dragonflies.filter(d=>d.perch<=0&&d.dodge<=0).length<2;i++)W.advance(.1);
    const active=[];W.getState().dragonflies.forEach((d,index)=>{if(d.perch<=0&&d.dodge<=0)active.push(index)});
    const first=active[0],second=active[1],dragonA=Number.isInteger(first)?root?.getObjectByName(`bluebell-dragonfly-${first+1}`):null,dragonB=Number.isInteger(second)?root?.getObjectByName(`bluebell-dragonfly-${second+1}`):null;
    if(dragonA&&dragonB){
      const y=TV.terrainHeight(224,220)+1.4;
      dragonA.position.set(224,y,220);dragonB.position.set(224,y,220);
    }
    for(let i=0;i<18;i++)C.advance(.1);
    const laneHorizontal=dragonA&&dragonB?Math.hypot(dragonA.position.x-dragonB.position.x,dragonA.position.z-dragonB.position.z):0;
    const laneVertical=dragonA&&dragonB?Math.abs(dragonA.position.y-dragonB.position.y):0;
    return {flags:{active:C.active,cohesion:C.calmFamilyCohesion,spacing:C.calmDucklingPersonalSpace,lanes:C.dragonflyFlightLaneDeconfliction,pop:C.existingPopulationOnly,low:C.lowAllocationBehavior},beforeCohesion,afterCohesion,ducklingDistance,laneHorizontal,laneVertical,state:C.getState(),dragonPairReady:Boolean(dragonA&&dragonB)};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell cohesion capability flags missing ${JSON.stringify(report.flags)}`);
  if(report.state.calmCohesionCorrections<2||report.state.calmCohesionPeakShift<=.001||report.afterCohesion>=report.beforeCohesion)throw new Error(`Calm duckling cohesion regression ${JSON.stringify(report)}`);
  if(report.state.calmSpacingCorrections<1||report.ducklingDistance<=.05)throw new Error(`Calm duckling spacing regression ${JSON.stringify(report)}`);
  if(!report.dragonPairReady)throw new Error(`Could not prepare airborne dragonfly pair ${JSON.stringify(report)}`);
  if(report.state.laneCorrections<1||report.state.lanePeakVerticalShift<=.001||report.state.lanePeakHorizontalShift<=.001||(report.laneHorizontal<=.05&&report.laneVertical<=.05))throw new Error(`Dragonfly flight-lane regression ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell calm family cohesion and dragonfly flight lanes passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
