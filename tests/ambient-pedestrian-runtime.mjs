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

    const a=TV.scene.getObjectByName('square-errand-1');
    const b=TV.scene.getObjectByName('square-errand-2');
    a.position.set(6,TV.terrainHeight(6,-6),-6);
    b.position.set(6.5,TV.terrainHeight(6.5,-6),-6);
    for(let i=0;i<8;i++)A.advance(.1);
    const afterSocial=A.getState();

    let maxErrands=0,maxSniffs=0,bagSeen=false;
    for(let i=0;i<420;i++){
      A.advance(.25);
      const snapshot=A.getState();
      maxErrands=Math.max(maxErrands,...snapshot.map(x=>x.completedErrands||0));
      maxSniffs=Math.max(maxSniffs,...snapshot.map(x=>x.sniffCount||0));
      bagSeen=bagSeen||snapshot.some(x=>x.carryingBag);
    }
    const afterActivities=A.getState();
    return {
      active:A.active,
      townSquareErrands:A.townSquareErrands,
      sunshineParkJoggers:A.sunshineParkJoggers,
      terrainFollowing:A.terrainFollowing,
      routePauses:A.routePauses,
      contextualDestinationActivities:A.contextualDestinationActivities,
      playerAwareYielding:A.playerAwareYielding,
      socialEncounters:A.socialEncounters,
      visibleShoppingErrands:A.visibleShoppingErrands,
      parkDogWalking:A.parkDogWalking,
      walkerCount:A.walkerCount,
      squareWalkerCount:A.squareWalkerCount,
      parkJoggerCount:A.parkJoggerCount,
      parkDogWalkerCount:A.parkDogWalkerCount,
      before,afterTravel,afterYield,afterSocial,afterActivities,maxErrands,maxSniffs,bagSeen,
      rootPresent:Boolean(TV.scene.getObjectByName('ambient-pedestrian-life')),
      dogPresent:Boolean(TV.scene.getObjectByName('companion-dog')),
      bagPropCount:[1,2,3].filter(n=>TV.scene.getObjectByName(`square-errand-${n}`)?.getObjectByName('shopping-bag')).length
    };
  });
  if(!report.active||!report.townSquareErrands||!report.sunshineParkJoggers||!report.terrainFollowing||!report.routePauses||!report.contextualDestinationActivities||!report.playerAwareYielding||!report.socialEncounters||!report.visibleShoppingErrands||!report.parkDogWalking)throw new Error(`Ambient pedestrian feature flags missing ${JSON.stringify(report)}`);
  if(!report.rootPresent||report.walkerCount!==6||report.squareWalkerCount!==3||report.parkJoggerCount!==2||report.parkDogWalkerCount!==1)throw new Error(`Ambient pedestrian population did not initialize ${JSON.stringify(report)}`);
  if(report.before.length!==6||report.afterActivities.length!==6)throw new Error(`Ambient pedestrian state count changed unexpectedly ${JSON.stringify(report)}`);
  const moved=report.afterTravel.filter((state,i)=>Math.hypot(state.x-report.before[i].x,state.z-report.before[i].z)>.5||state.completedSegments>report.before[i].completedSegments);
  if(moved.length!==6)throw new Error(`Not every ambient pedestrian advanced along a route ${JSON.stringify({before:report.before,after:report.afterTravel})}`);
  if(report.afterTravel.some(x=>x.destinationActivities!==x.routePoints))throw new Error(`Ambient routes are missing contextual destinations ${JSON.stringify(report.afterTravel)}`);
  if(report.afterYield[0].yieldCount<=report.afterTravel[0].yieldCount||report.afterYield[0].playerYield<=0)throw new Error(`Nearest ambient pedestrian did not yield to the player ${JSON.stringify({before:report.afterTravel[0],after:report.afterYield[0]})}`);
  if(report.afterSocial.filter(x=>x.kind==='square-errand'&&x.socialCount>0).length<2)throw new Error(`Nearby town pedestrians did not stop for a social encounter ${JSON.stringify(report.afterSocial)}`);
  if(!report.bagSeen||report.maxErrands<1||report.bagPropCount!==3)throw new Error(`Town shopping errands did not physically progress ${JSON.stringify(report)}`);
  if(!report.dogPresent||report.maxSniffs<1||!report.afterActivities.some(x=>x.hasDog))throw new Error(`Park dog walking did not physically progress ${JSON.stringify(report)}`);
  if(report.afterActivities.some(x=>x.activityCount<1))throw new Error(`Not every ambient pedestrian reached a contextual destination ${JSON.stringify(report.afterActivities)}`);
  if(report.afterActivities.some(x=>!Number.isFinite(x.y)||!Number.isFinite(x.x)||!Number.isFinite(x.z)))throw new Error(`Ambient pedestrian produced invalid terrain position ${JSON.stringify(report.afterActivities)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Ambient social encounters, physical shopping errands, dog walking, yielding, and contextual activities passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
