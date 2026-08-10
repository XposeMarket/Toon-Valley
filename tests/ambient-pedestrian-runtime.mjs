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
    const TV=window.ToonValley;
    const before=A.getState();
    for(let i=0;i<80;i++)A.advance(.25);
    const afterTravel=A.getState();
    const target=afterTravel[0];
    TV.player.position.x=target.x;
    TV.player.position.z=target.z;
    A.advance(.1);
    const afterYield=A.getState();
    TV.player.position.x=220;
    TV.player.position.z=220;
    for(let i=0;i<120;i++)A.advance(.25);
    const afterActivities=A.getState();
    return {
      active:A.active,
      townSquareErrands:A.townSquareErrands,
      sunshineParkJoggers:A.sunshineParkJoggers,
      terrainFollowing:A.terrainFollowing,
      routePauses:A.routePauses,
      contextualDestinationActivities:A.contextualDestinationActivities,
      playerAwareYielding:A.playerAwareYielding,
      walkerCount:A.walkerCount,
      squareWalkerCount:A.squareWalkerCount,
      parkJoggerCount:A.parkJoggerCount,
      before,
      afterTravel,
      afterYield,
      afterActivities,
      rootPresent:Boolean(TV.scene.getObjectByName('ambient-pedestrian-life'))
    };
  });
  if(!report.active||!report.townSquareErrands||!report.sunshineParkJoggers||!report.terrainFollowing||!report.routePauses||!report.contextualDestinationActivities||!report.playerAwareYielding)throw new Error(`Ambient pedestrian feature flags missing ${JSON.stringify(report)}`);
  if(!report.rootPresent||report.walkerCount!==5||report.squareWalkerCount!==3||report.parkJoggerCount!==2)throw new Error(`Ambient pedestrian population did not initialize ${JSON.stringify(report)}`);
  if(report.before.length!==5||report.afterActivities.length!==5)throw new Error(`Ambient pedestrian state count changed unexpectedly ${JSON.stringify(report)}`);
  const moved=report.afterTravel.filter((state,i)=>Math.hypot(state.x-report.before[i].x,state.z-report.before[i].z)>.5||state.completedSegments>report.before[i].completedSegments);
  if(moved.length!==5)throw new Error(`Not every ambient pedestrian advanced along a route ${JSON.stringify({before:report.before,after:report.afterTravel})}`);
  if(report.afterTravel.some(x=>x.destinationActivities!==x.routePoints))throw new Error(`Ambient routes are missing contextual destinations ${JSON.stringify(report.afterTravel)}`);
  if(report.afterYield[0].yieldCount<=report.afterTravel[0].yieldCount||report.afterYield[0].playerYield<=0)throw new Error(`Nearest ambient pedestrian did not yield to the player ${JSON.stringify({before:report.afterTravel[0],after:report.afterYield[0]})}`);
  if(report.afterActivities.some(x=>x.activityCount<1))throw new Error(`Not every ambient pedestrian reached a contextual destination ${JSON.stringify(report.afterActivities)}`);
  if(report.afterActivities.some(x=>!Number.isFinite(x.y)||!Number.isFinite(x.x)||!Number.isFinite(x.z)))throw new Error(`Ambient pedestrian produced invalid terrain position ${JSON.stringify(report.afterActivities)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Reactive ambient pedestrians, player yielding, and contextual destination activity passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
