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
    const greeted=A.greet(0);
    const afterGreeting=A.getState();
    TV.player.position.x=220;
    TV.player.position.z=220;
    let parcelCarry=null;
    for(let i=0;i<240;i++){
      A.advance(.25);
      const state=A.getState();
      if(state.some(x=>x.kind==='square-errand'&&x.hasParcel&&x.parcelVisible)){parcelCarry=state;break;}
    }
    let afterActivities=A.getState();
    for(let i=0;i<400;i++){
      if(afterActivities.filter(x=>x.kind==='square-errand').every(x=>x.parcelPickups>0&&x.parcelDeliveries>0))break;
      A.advance(.25);
      afterActivities=A.getState();
    }
    const ambientRoot=TV.scene.getObjectByName('ambient-pedestrian-life');
    const greetingInteractions=TV.interactables.filter(item=>/^(square-errand|park-jogger)-/.test(item.object?.name||''));
    const parcelProps=ambientRoot?.children.filter(child=>child.getObjectByName('errand-parcel')).length||0;
    return {
      active:A.active,
      townSquareErrands:A.townSquareErrands,
      sunshineParkJoggers:A.sunshineParkJoggers,
      terrainFollowing:A.terrainFollowing,
      routePauses:A.routePauses,
      contextualDestinationActivities:A.contextualDestinationActivities,
      playerAwareYielding:A.playerAwareYielding,
      physicalErrandParcels:A.physicalErrandParcels,
      playerGreetings:A.playerGreetings,
      walkerCount:A.walkerCount,
      squareWalkerCount:A.squareWalkerCount,
      parkJoggerCount:A.parkJoggerCount,
      greetingInteractions:greetingInteractions.length,
      parcelProps,
      greeted,
      before,
      afterTravel,
      afterYield,
      afterGreeting,
      parcelCarry,
      afterActivities,
      rootPresent:Boolean(ambientRoot)
    };
  });
  if(!report.active||!report.townSquareErrands||!report.sunshineParkJoggers||!report.terrainFollowing||!report.routePauses||!report.contextualDestinationActivities||!report.playerAwareYielding||!report.physicalErrandParcels||!report.playerGreetings)throw new Error(`Ambient pedestrian feature flags missing ${JSON.stringify(report)}`);
  if(!report.rootPresent||report.walkerCount!==5||report.squareWalkerCount!==3||report.parkJoggerCount!==2)throw new Error(`Ambient pedestrian population did not initialize ${JSON.stringify(report)}`);
  if(report.greetingInteractions!==5)throw new Error(`Ambient pedestrians are missing physical greet interactions ${JSON.stringify(report)}`);
  if(report.parcelProps!==3)throw new Error(`Town Square errand walkers are missing parcel props ${JSON.stringify(report)}`);
  if(report.before.length!==5||report.afterActivities.length!==5)throw new Error(`Ambient pedestrian state count changed unexpectedly ${JSON.stringify(report)}`);
  const moved=report.afterTravel.filter((state,i)=>Math.hypot(state.x-report.before[i].x,state.z-report.before[i].z)>.5||state.completedSegments>report.before[i].completedSegments);
  if(moved.length!==5)throw new Error(`Not every ambient pedestrian advanced along a route ${JSON.stringify({before:report.before,after:report.afterTravel})}`);
  if(report.afterTravel.some(x=>x.destinationActivities!==x.routePoints))throw new Error(`Ambient routes are missing contextual destinations ${JSON.stringify(report.afterTravel)}`);
  if(report.afterYield[0].yieldCount<=report.afterTravel[0].yieldCount||report.afterYield[0].playerYield<=0)throw new Error(`Nearest ambient pedestrian did not yield to the player ${JSON.stringify({before:report.afterTravel[0],after:report.afterYield[0]})}`);
  if(!report.greeted||report.afterGreeting[0].greetingCount!==report.afterYield[0].greetingCount+1||report.afterGreeting[0].activity!=='greeting')throw new Error(`Player greeting did not produce a real pedestrian response ${JSON.stringify({greeted:report.greeted,before:report.afterYield[0],after:report.afterGreeting[0]})}`);
  if(!report.parcelCarry)throw new Error(`No Town Square pedestrian physically picked up and carried a parcel ${JSON.stringify(report.afterActivities)}`);
  const carried=report.parcelCarry.filter(x=>x.kind==='square-errand'&&x.hasParcel);
  if(!carried.length||carried.some(x=>!x.parcelVisible||x.parcelPickups<=x.parcelDeliveries))throw new Error(`Parcel carry state is not visually synchronized ${JSON.stringify(report.parcelCarry)}`);
  const squareDone=report.afterActivities.filter(x=>x.kind==='square-errand');
  if(squareDone.some(x=>x.parcelPickups<1||x.parcelDeliveries<1||x.parcelDeliveries>x.parcelPickups))throw new Error(`Town Square parcel errands did not complete pickup/carry/delivery loops ${JSON.stringify(squareDone)}`);
  if(report.afterActivities.some(x=>x.activityCount<1))throw new Error(`Not every ambient pedestrian reached a contextual destination ${JSON.stringify(report.afterActivities)}`);
  if(report.afterActivities.some(x=>!Number.isFinite(x.y)||!Number.isFinite(x.x)||!Number.isFinite(x.z)))throw new Error(`Ambient pedestrian produced invalid terrain position ${JSON.stringify(report.afterActivities)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Ambient parcel errands, player greetings, yielding, and contextual destination activity passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
