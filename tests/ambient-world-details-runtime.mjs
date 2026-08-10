import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4194','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4194').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyAmbientWorldDetails&&window.ToonValleyAmbientPedestrianLife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const A=window.ToonValleyAmbientPedestrianLife;
    const D=window.ToonValleyAmbientWorldDetails;
    const TV=window.ToonValley;
    const initial=D.getState();
    const target=A.getState()[0];
    TV.player.position.x=target.x+.45;
    TV.player.position.z=target.z;
    A.advance(.1);D.advance(.1);
    const yielded=A.getState()[0];
    const afterYield=D.getState();
    const rig=TV.scene.getObjectByName(target.name);
    const playerBearing=Math.atan2(TV.player.position.x-rig.position.x,TV.player.position.z-rig.position.z);
    let perpendicular=Math.abs(Math.atan2(Math.sin(rig.rotation.y-playerBearing),Math.cos(rig.rotation.y-playerBearing)));
    perpendicular=Math.abs(perpendicular-Math.PI/2);
    A.greet(0);D.advance(.1);
    const afterGreeting=D.getState();
    TV.player.position.x=220;TV.player.position.z=220;
    for(let i=0;i<45;i++)A.advance(.25);
    const socialized=A.socialize(1,2);
    D.advance(.1);
    const afterSocial=D.getState();
    let hydrationSeen=false;
    for(let i=0;i<260;i++){
      A.advance(.25);D.advance(.25);
      if(D.getState().poses.some(p=>p.pose==='hydrating')){hydrationSeen=true;break;}
    }
    const finalState=D.getState();
    const detailRoot=TV.scene.getObjectByName('ambient-world-details');
    return {
      flags:{active:D.active,contextualArmGestures:D.contextualArmGestures,correctedYieldFacing:D.correctedYieldFacing,livingParcelWaypoints:D.livingParcelWaypoints,parkHydrationStations:D.parkHydrationStations},
      initial,afterYield,afterGreeting,afterSocial,finalState,yielded,perpendicular,socialized,hydrationSeen,
      detailRootPresent:Boolean(detailRoot),
      parcelPickupPresent:Boolean(detailRoot?.getObjectByName('town-square-parcel-pickup')),
      parcelDropPresent:Boolean(detailRoot?.getObjectByName('town-square-parcel-dropoff')),
      hydrationWestPresent:Boolean(detailRoot?.getObjectByName('sunshine-park-hydration-west')),
      hydrationEastPresent:Boolean(detailRoot?.getObjectByName('sunshine-park-hydration-east'))
    };
  });
  if(Object.values(report.flags).some(v=>!v))throw new Error(`Ambient world detail feature flags missing ${JSON.stringify(report)}`);
  if(!report.detailRootPresent||!report.parcelPickupPresent||!report.parcelDropPresent||!report.hydrationWestPresent||!report.hydrationEastPresent)throw new Error(`Living waypoint props did not initialize ${JSON.stringify(report)}`);
  if(report.initial.rigCount!==5||report.initial.armMeshCount!==10)throw new Error(`Ambient arm rigs did not attach to all five pedestrians ${JSON.stringify(report.initial)}`);
  if(report.initial.waypointCount!==4||report.initial.parcelStationCount!==2||report.initial.hydrationStandCount!==2)throw new Error(`Ambient waypoint counts are wrong ${JSON.stringify(report.initial)}`);
  if(report.yielded.playerYield<=0||report.afterYield.yieldFacingFixes<1||report.perpendicular>.12)throw new Error(`Pedestrian yield orientation was not corrected to a sideways give-way pose ${JSON.stringify({yielded:report.yielded,detail:report.afterYield,perpendicular:report.perpendicular})}`);
  const greetingPose=report.afterGreeting.poses.find(p=>p.name==='square-errand-1');
  if(!greetingPose||greetingPose.pose!=='greeting'||Math.abs(greetingPose.rightZ)<.45)throw new Error(`Greeting arm gesture did not animate ${JSON.stringify(greetingPose)}`);
  if(!report.socialized)throw new Error(`Could not start deterministic social encounter for gesture regression ${JSON.stringify(report.afterSocial)}`);
  const socialPoses=report.afterSocial.poses.filter(p=>['square-errand-2','square-errand-3'].includes(p.name));
  if(socialPoses.length!==2||socialPoses.some(p=>p.pose!=='socializing'||Math.abs(p.leftZ)<.2||Math.abs(p.rightZ)<.2))throw new Error(`Social conversation gestures did not animate both neighbors ${JSON.stringify(socialPoses)}`);
  if(!report.hydrationSeen)throw new Error(`Park jogger never reached a visible hydration gesture ${JSON.stringify(report.finalState)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Ambient yield-facing fix, contextual arm gestures, parcel waypoints, and hydration stations passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
