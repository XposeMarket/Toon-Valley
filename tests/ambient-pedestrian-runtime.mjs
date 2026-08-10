import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4193','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4193').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyAmbientPedestrianLife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const A=window.ToonValleyAmbientPedestrianLife;
    const before=A.getState();
    for(let i=0;i<80;i++)A.advance(.25);
    const after=A.getState();
    return {
      active:A.active,
      townSquareErrands:A.townSquareErrands,
      sunshineParkJoggers:A.sunshineParkJoggers,
      terrainFollowing:A.terrainFollowing,
      routePauses:A.routePauses,
      walkerCount:A.walkerCount,
      squareWalkerCount:A.squareWalkerCount,
      parkJoggerCount:A.parkJoggerCount,
      before,
      after,
      rootPresent:Boolean(window.ToonValley.scene.getObjectByName('ambient-pedestrian-life'))
    };
  });
  if(!report.active||!report.townSquareErrands||!report.sunshineParkJoggers||!report.terrainFollowing||!report.routePauses)throw new Error(`Ambient pedestrian feature flags missing ${JSON.stringify(report)}`);
  if(!report.rootPresent||report.walkerCount!==5||report.squareWalkerCount!==3||report.parkJoggerCount!==2)throw new Error(`Ambient pedestrian population did not initialize ${JSON.stringify(report)}`);
  if(report.before.length!==5||report.after.length!==5)throw new Error(`Ambient pedestrian state count changed unexpectedly ${JSON.stringify(report)}`);
  const moved=report.after.filter((state,i)=>Math.hypot(state.x-report.before[i].x,state.z-report.before[i].z)>.5||state.completedSegments>report.before[i].completedSegments);
  if(moved.length!==5)throw new Error(`Not every ambient pedestrian advanced along a route ${JSON.stringify({before:report.before,after:report.after})}`);
  if(report.after.filter(x=>x.kind==='square-errand').some(x=>x.routePoints<4)||report.after.filter(x=>x.kind==='park-jogger').some(x=>x.routePoints<6))throw new Error(`Ambient pedestrian routes are incomplete ${JSON.stringify(report.after)}`);
  if(report.after.some(x=>!Number.isFinite(x.y)||!Number.isFinite(x.x)||!Number.isFinite(x.z)))throw new Error(`Ambient pedestrian produced invalid terrain position ${JSON.stringify(report.after)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Ambient Town Square errand walkers and Sunshine Park joggers passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
